package imapworker

import (
	"cattymail/internal/config"
	"cattymail/internal/domain"
	"cattymail/internal/redisstore"
	"context"
	"crypto/tls"
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
	// Refresh config from Redis
	if dynCfg, err := w.store.GetIMAPConfig(ctx); err == nil && dynCfg != nil {
		w.cfg.IMAPHost = dynCfg.IMAPHost
		w.cfg.IMAPPort = dynCfg.IMAPPort
		w.cfg.IMAPUser = dynCfg.IMAPUser
		w.cfg.IMAPPass = dynCfg.IMAPPass
	}

	// Refresh domains from Redis and merge with system domains
	if customDomains, err := w.store.GetDomains(ctx); err == nil && len(customDomains) > 0 {
		// Create a map to track unique domains
		domainMap := make(map[string]bool)

		// Add system domains from ENV
		for _, d := range w.cfg.AllowedDomains {
			domainMap[d] = true
		}

		// Add custom domains from Redis
		for _, d := range customDomains {
			domainMap[d] = true
		}

		// Convert back to slice
		var mergedDomains []string
		for d := range domainMap {
			mergedDomains = append(mergedDomains, d)
		}

		w.cfg.AllowedDomains = mergedDomains
		log.Printf("Loaded domains: %v (system + custom from Redis)", w.cfg.AllowedDomains)
	} else {
		log.Printf("Using system domains only: %v", w.cfg.AllowedDomains)
	}

	connStr := fmt.Sprintf("%s:%d", w.cfg.IMAPHost, w.cfg.IMAPPort)
	c, err := client.DialTLS(connStr, &tls.Config{InsecureSkipVerify: true})
	if err != nil {
		return fmt.Errorf("failed to dial IMAP: %w", err)
	}
	defer c.Logout()

	if err := c.Login(w.cfg.IMAPUser, w.cfg.IMAPPass); err != nil {
		return fmt.Errorf("failed to login: %w", err)
	}

	// Process multiple folders: INBOX + spam folders
	folders := []string{"INBOX", "INBOX.spam", "INBOX.Junk"}
	for _, folder := range folders {
		if err := w.processFolder(ctx, c, folder); err != nil {
			log.Printf("Error processing folder %s: %v", folder, err)
		}
	}

	return nil
}

func (w *Worker) processFolder(ctx context.Context, c *client.Client, folder string) error {
	mbox, err := c.Select(folder, false)
	if err != nil {
		// Folder might not exist, that's OK — but log it
		log.Printf("Folder %s not found or failed to select: %v", folder, err)
		return nil
	}

	// Use per-folder UID tracking
	uidKey := folder // "INBOX", "Spam", etc.
	lastUID, err := w.store.GetFolderLastUID(ctx, uidKey)
	if err != nil {
		return fmt.Errorf("failed to get last UID for %s: %w", folder, err)
	}

	log.Printf("Folder %s: lastUID=%d, UidNext=%d, Messages=%d", folder, lastUID, mbox.UidNext, mbox.Messages)
	if lastUID >= mbox.UidNext {
		return nil
	}

	seqSet := new(imap.SeqSet)
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

		processed, err := w.store.IsUIDProcessed(ctx, folder, msg.Uid)
		if err != nil {
			log.Printf("Failed to check UID processed for %d: %v", msg.Uid, err)
			continue
		}
		if processed {
			continue
		}

		if err := w.ingestMessage(ctx, msg, section, folder); err != nil {
			log.Printf("Failed to ingest message %d (%s): %v", msg.Uid, folder, err)
		}
	}

	if err := <-done; err != nil {
		return fmt.Errorf("fetch %s failed: %w", folder, err)
	}

	if newMaxUID > lastUID {
		if err := w.store.SetFolderLastUID(ctx, uidKey, newMaxUID); err != nil {
			log.Printf("Failed to update last UID for %s: %v", folder, err)
		}
	}

	return nil
}

func (w *Worker) ingestMessage(ctx context.Context, msg *imap.Message, section *imap.BodySectionName, folder string) error {
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

	// Debug: Log all headers to understand what we're receiving
	log.Printf("Processing message %d - Headers available:", msg.Uid)
	for key := range header.Map() {
		log.Printf("  %s: %s", key, header.Get(key))
	}

	// Header parsing
	originalTo := w.extractRecipient(header)
	if originalTo == "" {
		log.Printf("Message %d skipped: No valid recipient found in headers (allowed domains: %v)", msg.Uid, w.cfg.AllowedDomains)
		return nil
	}
	log.Printf("Message %d - Extracted recipient: %s", msg.Uid, originalTo)

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
		ID:         messageID,
		Domain:     recipDomain,
		Local:      recipLocal,
		OriginalTo: originalTo,
		From:       from,
		Subject:    subject,
		Date:       date,
		Text:       textBody,
		HTML:       htmlBody,
		IMAPUID:    msg.Uid,
		IMAPFolder: folder,
	}

	return w.store.SaveMessage(ctx, dbMsg)
}

func (w *Worker) extractRecipient(h mail.Header) string {
	// Try system headers first (most reliable for catch-all)
	sysHeaders := []string{"Delivered-To", "X-Original-To", "Envelope-To", "X-Envelope-To", "X-Forwarded-To"}
	for _, key := range sysHeaders {
		if val := h.Get(key); val != "" {
			log.Printf("  Checking header %s: %s", key, val)
			email := w.extractEmailFromString(val)
			if email != "" && w.isValidDomainEmail(email) {
				log.Printf("  ✓ Found valid recipient in %s: %s", key, email)
				return w.normalizeEmail(email)
			}
		}
	}

	// Try To header as fallback
	toList, _ := h.AddressList("To")
	for _, addr := range toList {
		log.Printf("  Checking To address: %s", addr.Address)
		if w.isValidDomainEmail(addr.Address) {
			log.Printf("  ✓ Found valid recipient in To: %s", addr.Address)
			return w.normalizeEmail(addr.Address)
		}
	}

	log.Printf("  ✗ No valid recipient found in any header")
	return ""
}

// extractEmailFromString extracts email from various formats like:
// "user@domain.com", "<user@domain.com>", "Name <user@domain.com>"
func (w *Worker) extractEmailFromString(s string) string {
	s = strings.TrimSpace(s)

	// Check if it contains angle brackets
	if strings.Contains(s, "<") && strings.Contains(s, ">") {
		start := strings.Index(s, "<")
		end := strings.Index(s, ">")
		if start < end {
			return strings.TrimSpace(s[start+1 : end])
		}
	}

	// Otherwise return as-is (might be plain email)
	return s
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
