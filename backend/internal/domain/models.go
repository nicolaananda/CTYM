package domain

import "time"

type Message struct {
	ID         string    `json:"id"`
	Domain     string    `json:"domain"`
	Local      string    `json:"local"`
	OriginalTo string    `json:"original_to"`
	From       string    `json:"from"`
	Subject    string    `json:"subject"`
	Date       time.Time `json:"date"`
	Text       string    `json:"text"`
	HTML       string    `json:"html,omitempty"`
	IMAPUID    uint32    `json:"imap_uid,omitempty"`
}

type Address struct {
	Email     string    `json:"email"`
	Local     string    `json:"local"`
	Domain    string    `json:"domain"`
	ExpiresAt time.Time `json:"expires_at"`
}
