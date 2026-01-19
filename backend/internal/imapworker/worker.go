package imapworker

import (
	"cattymail/internal/config"
	"cattymail/internal/domain"
	"cattymail/internal/redisstore"
	"context"
	"fmt"
	"io"
	"log"
	"strings"
	"time"

	"github.com/emersion/go-imap"
	"github.com/emersion/go-imap/client"
	"github.com/emersion/go-message/mail"
	"github.com/oklog/ulid/v2"
)

type Worker struct {
	cfg   *config.Config
	store *redisstore.Store
}

func New(cfg *config.Config, store *redisstore.Store) *Worker {
	return &Worker{cfg: cfg, store: store}
}

func (w *Worker) Start(ctx context.Context) {
	ticker := time.NewTicker(time.Duration(w.cfg.PollSeconds) * time.Second)
	defer ticker.Stop()

	log.Println("IMAP Worker started")

	// Initial run
	if err := w.process(ctx); err != nil {
		log.Printf("Error in IMAP process: %v", err)
	}

	for {
		select {
		case <-ctx.Done():
			log.Println("IMAP Worker stopping...")
			return
		case <-ticker.C:
			if err := w.process(ctx); err != nil {
				log.Printf("Error in IMAP process: %v", err)
			}
		}
	}
}

func (w *Worker) process(ctx context.Context) error {
	connStr := fmt.Sprintf("%s:%d", w.cfg.IMAPHost, w.cfg.IMAPPort)
	c, err := client.DialTLS(connStr, nil)
	if err != nil {
		return fmt.Errorf("failed to dial IMAP: %w", err)
	}
	defer c.Logout()

	if err := c.Login(w.cfg.IMAPUser, w.cfg.IMAPPass); err != nil {
		return fmt.Errorf("failed to login: %w", err)
	}

	mbox, err := c.Select("INBOX", false)
	if err != nil {
		return fmt.Errorf("failed to select INBOX: %w", err)
	}

	lastUID, err := w.store.GetLastProcessedUID(ctx)
	if err != nil {
		return fmt.Errorf("failed to get last UID: %w", err)
	}
	if lastUID == 0 {
		// If 0, maybe we start from now? Or fetch all. 
		// Let's assume we want to process everything if it's the first time, 
		// OR maybe strict to "only new". 
		// If we want only new, we'd need to persist state better.
		// For now, let's treat 0 as "start from beginning" but practically 
		// for a new deployment on an existing box, this might ingest old mail.
		// Given catch-all, probably fine.
		// But let's set lastUID to mbox.UidNext - 1 if we wanted to skip old.
		// The prompt says "Fetch only new messages (UID > last_uid)".
		// If last_uid is 0, then 1 > 0, so we fetch all.
	}

	if lastUID >= mbox.UidNext {
		return nil
	}

	seqSet := new(imap.SeqSet)
	// We want UIDs > lastUID.
	// Range: lastUID+1 : *
	from := lastUID + 1
	seqSet.AddRange(from, mbox.UidNext)

	messages := make(chan *imap.Message, 10)
	done := make(chan error, 1)

	section := &imap.BodySectionName{}
	items := []imap.FetchItem{imap.FetchEnvelope, imap.FetchUid, imap.FetchInternalDate, section.FetchItem()}

	go func() {
		done <- c.UidFetch(seqSet, items, messages)
	}()

	var newMaxUID uint32 = lastUID

	for msg := range messages {
		if msg.Uid > newMaxUID {
			newMaxUID = msg.Uid
		}

		processed, err := w.store.IsUIDProcessed(ctx, msg.Uid)
		if err != nil {
			log.Printf("Failed to check UID processed for %d: %v", msg.Uid, err)
			continue
		}
		if processed {
			continue
		}

		if err := w.ingestMessage(ctx, msg, section); err != nil {
			log.Printf("Failed to ingest message %d: %v", msg.Uid, err)
		}
	}

	if err := <-done; err != nil {
		return fmt.Errorf("fetch failed: %w", err)
	}

	if newMaxUID > lastUID {
		if err := w.store.SetLastProcessedUID(ctx, newMaxUID); err != nil {
			log.Printf("Failed to update last UID: %v", err)
		}
	}

	return nil
}

func (w *Worker) ingestMessage(ctx context.Context, msg *imap.Message, section *imap.BodySectionName) error {
	r := msg.GetBody(section)
	if r == nil {
		return fmt.Errorf("server didn't return message body")
	}

	// Create a buffered reader to check size without reading everything if possible, 
	// or just read all. `go-message` parses from reader.
	// To check size, we can read all bytes.
	bodyBytes, err := io.ReadAll(r)
	if err != nil {
		return fmt.Errorf("failed to read body: %w", err)
	}

	if len(bodyBytes) > w.cfg.MaxEmailBytes {
		log.Printf("Message %d too large: %d bytes", msg.Uid, len(bodyBytes))
		return nil
	}

	mr, err := mail.CreateReader(strings.NewReader(string(bodyBytes)))
	if err != nil {
		return fmt.Errorf("failed to create mail reader: %w", err)
	}

	header := mr.Header
    
    // Header parsing
    originalTo := w.extractRecipient(header)
    if originalTo == "" {
        // Fallback: Check if we can find it in To list if header parsing failed partially?
        log.Printf("Message %d skipped: No valid recipient found in headers", msg.Uid)
        return nil
    }
    
    recipParts := strings.Split(originalTo, "@")
    if len(recipParts) != 2 {
         return nil
    }
    recipLocal := recipParts[0]
    recipDomain := recipParts[1]

    // We blindly reserve/create if getting email (Catch-All logic)
    // But per requirements, check if specific handling needed.
    // "Identify original recipient... Determine... Store"
    // We'll create the inbox implicitly by storing.
    
    fromList, err := header.AddressList("From")
    from := ""
    if err == nil && len(fromList) > 0 {
        from = fromList[0].String()
    }
    
    subject, err := header.Subject()
    if err != nil {
        subject = "(No Subject)"
    }
    
    date, err := header.Date()
    if err != nil {
        date = msg.InternalDate
    }

	var textBody, htmlBody string

	// Process parts
	for {
		p, err := mr.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			break
		}

		switch h := p.Header.(type) {
		case *mail.InlineHeader:
            // This is the header for this part
            // We can read the body
            b, _ := io.ReadAll(p.Body)
			t, _, _ := h.ContentType()
            if t == "text/plain" {
                textBody += string(b)
            } else if t == "text/html" {
                htmlBody += string(b)
            }
		}
	}

	messageID := ulid.Make().String()
    
    dbMsg := &domain.Message{
        ID: messageID,
        Domain: recipDomain,
        Local: recipLocal,
        OriginalTo: originalTo,
        From: from,
        Subject: subject,
        Date: date,
        Text: textBody,
        HTML: htmlBody,
        IMAPUID: msg.Uid,
    }
    
    return w.store.SaveMessage(ctx, dbMsg)
}

func (w *Worker) extractRecipient(h mail.Header) string {
    sysHeaders := []string{"Delivered-To", "X-Original-To", "Envelope-To"}
    for _, key := range sysHeaders {
        if val := h.Get(key); val != "" {
            if w.isValidDomainEmail(val) {
                return w.normalizeEmail(val)
            }
        }
    }
    
    toList, _ := h.AddressList("To")
    for _, addr := range toList {
        if w.isValidDomainEmail(addr.Address) {
            return w.normalizeEmail(addr.Address)
        }
    }
    return ""
}

func (w *Worker) isValidDomainEmail(email string) bool {
    parts := strings.Split(email, "@")
    if len(parts) != 2 {
        return false
    }
    domain := strings.ToLower(strings.TrimSpace(parts[1]))
    for _, d := range w.cfg.AllowedDomains {
        if domain == d {
            return true
        }
    }
    return false
}

func (w *Worker) normalizeEmail(email string) string {
    return strings.ToLower(strings.TrimSpace(email))
}
