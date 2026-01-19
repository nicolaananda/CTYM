package redisstore

import (
	"context"
	"fmt"
	"time"

	"cattymail/internal/domain"
)

// GetTotalAddresses returns count of all address keys
func (s *Store) GetTotalAddresses(ctx context.Context) (int64, error) {
	var cursor uint64
	var count int64

	for {
		keys, nextCursor, err := s.client.Scan(ctx, cursor, "addr:*", 100).Result()
		if err != nil {
			return 0, err
		}
		count += int64(len(keys))
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}
	return count, nil
}

// GetTotalMessages returns count of all message keys
func (s *Store) GetTotalMessages(ctx context.Context) (int64, error) {
	var cursor uint64
	var count int64

	for {
		keys, nextCursor, err := s.client.Scan(ctx, cursor, "msg:*", 100).Result()
		if err != nil {
			return 0, err
		}
		count += int64(len(keys))
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}
	return count, nil
}

// GetActiveAddresses returns count of addresses with TTL > 0
func (s *Store) GetActiveAddresses(ctx context.Context) (int64, error) {
	var cursor uint64
	var count int64

	for {
		keys, nextCursor, err := s.client.Scan(ctx, cursor, "addr:*", 100).Result()
		if err != nil {
			return 0, err
		}
		
		// Check TTL for each key
		for _, key := range keys {
			ttl, err := s.client.TTL(ctx, key).Result()
			if err == nil && ttl > 0 {
				count++
			}
		}
		
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}
	return count, nil
}

// GetMessagesLast24h returns count of messages from last 24 hours
func (s *Store) GetMessagesLast24h(ctx context.Context) (int64, error) {
	var cursor uint64
	var count int64
	yesterday := time.Now().Add(-24 * time.Hour).Unix()

	for {
		keys, nextCursor, err := s.client.Scan(ctx, cursor, "inbox:*", 100).Result()
		if err != nil {
			return 0, err
		}

		for _, inboxKey := range keys {
			// Count messages with score > yesterday
			c, err := s.client.ZCount(ctx, inboxKey, fmt.Sprintf("%d", yesterday), "+inf").Result()
			if err == nil {
				count += c
			}
		}

		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}
	return count, nil
}

// GetAllAddresses returns paginated list of all addresses
func (s *Store) GetAllAddresses(ctx context.Context, offset, limit int) ([]string, error) {
	var cursor uint64
	var addresses []string
	skip := offset
	collected := 0

	for {
		keys, nextCursor, err := s.client.Scan(ctx, cursor, "addr:*", 100).Result()
		if err != nil {
			return nil, err
		}

		for _, key := range keys {
			if skip > 0 {
				skip--
				continue
			}
			if collected >= limit {
				return addresses, nil
			}
			// Extract address from key format "addr:domain:local"
			addresses = append(addresses, key)
			collected++
		}

		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}
	return addresses, nil
}

// GetAllMessages returns paginated list of all messages
func (s *Store) GetAllMessages(ctx context.Context, offset, limit int) ([]*domain.Message, error) {
	var cursor uint64
	var messageIDs []string
	skip := offset
	collected := 0

	// First, collect message IDs
	for {
		keys, nextCursor, err := s.client.Scan(ctx, cursor, "msg:*", 100).Result()
		if err != nil {
			return nil, err
		}

		for _, key := range keys {
			if skip > 0 {
				skip--
				continue
			}
			if collected >= limit {
				break
			}
			messageIDs = append(messageIDs, key)
			collected++
		}

		if collected >= limit {
			break
		}

		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}

	// Fetch actual messages
	var messages []*domain.Message
	for _, msgKey := range messageIDs {
		val, err := s.client.Get(ctx, msgKey).Result()
		if err != nil {
			continue
		}

		var msg domain.Message
		if err := json.Unmarshal([]byte(val), &msg); err == nil {
			messages = append(messages, &msg)
		}
	}

	return messages, nil
}

// DeleteMessage deletes a message by ID
func (s *Store) DeleteMessage(ctx context.Context, id string) error {
	msgKey := fmt.Sprintf("msg:%s", id)
	
	// Get message to find its inbox
	val, err := s.client.Get(ctx, msgKey).Result()
	if err != nil {
		return err
	}

	var msg domain.Message
	if err := json.Unmarshal([]byte(val), &msg); err != nil {
		return err
	}

	// Delete from inbox and message
	pipe := s.client.Pipeline()
	pipe.Del(ctx, msgKey)
	inboxKey := fmt.Sprintf("inbox:%s:%s", msg.Domain, msg.Local)
	pipe.ZRem(ctx, inboxKey, id)
	_, err = pipe.Exec(ctx)
	
	return err
}

// GetDomainStats returns message count per domain
func (s *Store) GetDomainStats(ctx context.Context) (map[string]int64, error) {
	stats := make(map[string]int64)
	var cursor uint64

	for {
		keys, nextCursor, err := s.client.Scan(ctx, cursor, "inbox:*", 100).Result()
		if err != nil {
			return nil, err
		}

		for _, inboxKey := range keys {
			// Extract domain from "inbox:domain:local"
			parts := splitInboxKey(inboxKey)
			if len(parts) >= 2 {
				domain := parts[1]
				count, err := s.client.ZCard(ctx, inboxKey).Result()
				if err == nil {
					stats[domain] += count
				}
			}
		}

		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}
	return stats, nil
}

func splitInboxKey(key string) []string {
	// "inbox:domain:local" -> ["inbox", "domain", "local"]
	var parts []string
	start := 0
	for i := 0; i < len(key); i++ {
		if key[i] == ':' {
			parts = append(parts, key[start:i])
			start = i + 1
		}
	}
	if start < len(key) {
		parts = append(parts, key[start:])
	}
	return parts
}
