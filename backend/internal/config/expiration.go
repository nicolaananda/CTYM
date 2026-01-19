package config

import (
	"fmt"
	"time"
)

// IsExpired checks if the website has expired based on ExpiredWeb config
func (c *Config) IsExpired() bool {
	if c.ExpiredWeb == "" {
		return false
	}

	expirationDate, err := parseExpirationDate(c.ExpiredWeb)
	if err != nil {
		// If parsing fails, don't block the site
		return false
	}

	return time.Now().After(expirationDate)
}

// GetExpirationDate returns the parsed expiration date
func (c *Config) GetExpirationDate() (time.Time, error) {
	if c.ExpiredWeb == "" {
		return time.Time{}, fmt.Errorf("no expiration date set")
	}
	return parseExpirationDate(c.ExpiredWeb)
}

// parseExpirationDate parses DD/MM/YYYY format
func parseExpirationDate(dateStr string) (time.Time, error) {
	// Parse DD/MM/YYYY format
	t, err := time.Parse("02/01/2006", dateStr)
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid date format, expected DD/MM/YYYY: %w", err)
	}
	// Set to end of day (23:59:59) so the site expires at midnight
	return time.Date(t.Year(), t.Month(), t.Day(), 23, 59, 59, 0, t.Location()), nil
}
