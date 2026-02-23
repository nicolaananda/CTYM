package redisstore

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"cattymail/internal/domain"

	"github.com/redis/go-redis/v9"
)

type Store struct {
	client *redis.Client
	ttl    time.Duration
}

func New(redisURL string, ttlSeconds int) (*Store, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}

	client := redis.NewClient(opts)
	if err := client.Ping(context.Background()).Err(); err != nil {
		return nil, err
	}

	return &Store{
		client: client,
		ttl:    time.Duration(ttlSeconds) * time.Second,
	}, nil
}

func (s *Store) ReserveAddress(ctx context.Context, emailDomain, local string) (bool, error) {
	key := fmt.Sprintf("addr:%s:%s", emailDomain, local)
	success, err := s.client.SetNX(ctx, key, "1", s.ttl).Result()
	if err != nil {
		return false, err
	}
	return success, nil
}

func (s *Store) EnsureAddress(ctx context.Context, emailDomain, local string) error {
	key := fmt.Sprintf("addr:%s:%s", emailDomain, local)
	// Set (Upsert) - always succeeds and refreshes TTL
	return s.client.Set(ctx, key, "1", s.ttl).Err()
}

func (s *Store) SaveMessage(ctx context.Context, msg *domain.Message) error {
	// 1. Save message content
	msgKey := fmt.Sprintf("msg:%s", msg.ID)
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	pipe := s.client.Pipeline()
	pipe.Set(ctx, msgKey, data, s.ttl)

	// 2. Add to inbox
	inboxKey := fmt.Sprintf("inbox:%s:%s", msg.Domain, msg.Local)
	pipe.ZAdd(ctx, inboxKey, redis.Z{
		Score:  float64(msg.Date.Unix()),
		Member: msg.ID,
	})
	pipe.Expire(ctx, inboxKey, s.ttl)

	// 3. Mark IMAP UID as processed (if present) - include folder for uniqueness
	if msg.IMAPUID > 0 && msg.IMAPFolder != "" {
		uidKey := fmt.Sprintf("imap:uid:%s:%d", msg.IMAPFolder, msg.IMAPUID)
		pipe.Set(ctx, uidKey, "1", s.ttl)
	}

	_, err = pipe.Exec(ctx)
	if err != nil {
		return err
	}

	// 4. Publish SSE notification
	channel := fmt.Sprintf("inbox:%s:%s", msg.Domain, msg.Local)
	_ = s.client.Publish(ctx, channel, msg.ID).Err()

	return nil
}

func (s *Store) Subscribe(ctx context.Context, emailDomain, local string) *redis.PubSub {
	channel := fmt.Sprintf("inbox:%s:%s", emailDomain, local)
	return s.client.Subscribe(ctx, channel)
}

func (s *Store) IsUIDProcessed(ctx context.Context, folder string, uid uint32) (bool, error) {
	key := fmt.Sprintf("imap:uid:%s:%d", folder, uid)
	exists, err := s.client.Exists(ctx, key).Result()
	return exists > 0, err
}

func (s *Store) GetLastProcessedUID(ctx context.Context) (uint32, error) {
	val, err := s.client.Get(ctx, "imap:last_uid").Uint64()
	if err == redis.Nil {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	return uint32(val), nil
}

func (s *Store) SetLastProcessedUID(ctx context.Context, uid uint32) error {
	return s.client.Set(ctx, "imap:last_uid", uid, 0).Err()
}

func (s *Store) GetFolderLastUID(ctx context.Context, folder string) (uint32, error) {
	key := fmt.Sprintf("imap:last_uid:%s", folder)
	val, err := s.client.Get(ctx, key).Uint64()
	if err == redis.Nil {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	return uint32(val), nil
}

func (s *Store) SetFolderLastUID(ctx context.Context, folder string, uid uint32) error {
	key := fmt.Sprintf("imap:last_uid:%s", folder)
	return s.client.Set(ctx, key, uid, 0).Err()
}

func (s *Store) GetInbox(ctx context.Context, emailDomain, local string, limit int, before int64) ([]*domain.Message, error) {
	inboxKey := fmt.Sprintf("inbox:%s:%s", emailDomain, local)

	// Default range: -inf to +inf (all)
	// If before is set, use it as max score exclusive
	max := "+inf"
	if before > 0 {
		max = fmt.Sprintf("(%d", before)
	}

	// RevRangeByScore to get newest first
	ids, err := s.client.ZRevRangeByScore(ctx, inboxKey, &redis.ZRangeBy{
		Min:   "-inf",
		Max:   max,
		Count: int64(limit),
	}).Result()
	if err != nil {
		return nil, err
	}

	if len(ids) == 0 {
		return []*domain.Message{}, nil
	}

	// Fetch actual messages
	var keys []string
	for _, id := range ids {
		keys = append(keys, fmt.Sprintf("msg:%s", id))
	}

	// MGet to fetch all
	vals, err := s.client.MGet(ctx, keys...).Result()
	if err != nil {
		return nil, err
	}

	var messages []*domain.Message
	for _, val := range vals {
		if val == nil {
			continue // Expired?
		}
		var msg domain.Message
		if str, ok := val.(string); ok {
			if err := json.Unmarshal([]byte(str), &msg); err == nil {
				messages = append(messages, &msg)
			}
		}
	}

	return messages, nil
}

func (s *Store) GetMessage(ctx context.Context, id string) (*domain.Message, error) {
	val, err := s.client.Get(ctx, fmt.Sprintf("msg:%s", id)).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, nil // Not found
		}
		return nil, err
	}

	var msg domain.Message
	if err := json.Unmarshal([]byte(val), &msg); err != nil {
		return nil, err
	}
	return &msg, nil
}

func (s *Store) RateLimit(ctx context.Context, ip string, action string, limit int, window time.Duration) (bool, error) {
	key := fmt.Sprintf("ratelimit:%s:%s", action, ip)

	pipe := s.client.Pipeline()
	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, window)
	_, err := pipe.Exec(ctx)
	if err != nil {
		return false, err
	}

	return incr.Val() <= int64(limit), nil
}
