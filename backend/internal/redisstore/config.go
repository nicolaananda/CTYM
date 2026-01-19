package redisstore

import (
	"context"
	"cattymail/internal/config"
	"github.com/redis/go-redis/v9"
)

// Dynamic Configuration Keys
const (
	KeyConfigDomains  = "config:domains"
	KeyConfigIMAPHost = "config:imap:host"
	KeyConfigIMAPPort = "config:imap:port"
	KeyConfigIMAPUser = "config:imap:user"
	KeyConfigIMAPPass = "config:imap:pass"
)

// AddDomain adds a domain to the allowlist
func (s *Store) AddDomain(ctx context.Context, domain string) error {
	return s.client.SAdd(ctx, KeyConfigDomains, domain).Err()
}

// RemoveDomain removes a domain from the allowlist
func (s *Store) RemoveDomain(ctx context.Context, domain string) error {
	return s.client.SRem(ctx, KeyConfigDomains, domain).Err()
}

// GetDomains returns all allowed domains from Redis
// If empty, returns nil (caller should fallback to static config)
func (s *Store) GetDomains(ctx context.Context) ([]string, error) {
	domains, err := s.client.SMembers(ctx, KeyConfigDomains).Result()
	if err == redis.Nil {
		return nil, nil
	}
	return domains, err
}

// UpdateIMAPConfig updates IMAP settings in Redis
func (s *Store) UpdateIMAPConfig(ctx context.Context, host string, port int, user, pass string) error {
	pipe := s.client.Pipeline()
	pipe.Set(ctx, KeyConfigIMAPHost, host, 0)
	pipe.Set(ctx, KeyConfigIMAPPort, port, 0)
	pipe.Set(ctx, KeyConfigIMAPUser, user, 0)
	pipe.Set(ctx, KeyConfigIMAPPass, pass, 0)
	_, err := pipe.Exec(ctx)
	return err
}

// GetIMAPConfig fetches IMAP settings from Redis
// Returns values if they exist, otherwise empty strings/0
func (s *Store) GetIMAPConfig(ctx context.Context) (*config.Config, error) {
	// We only return fields related to IMAP
	pipe := s.client.Pipeline()
	hostCmd := pipe.Get(ctx, KeyConfigIMAPHost)
	portCmd := pipe.Get(ctx, KeyConfigIMAPPort)
	userCmd := pipe.Get(ctx, KeyConfigIMAPUser)
	passCmd := pipe.Get(ctx, KeyConfigIMAPPass)
	
	_, err := pipe.Exec(ctx)
	if err != nil && err != redis.Nil {
		return nil, err
	}

	host, _ := hostCmd.Result()
	port, _ := portCmd.Int()
	user, _ := userCmd.Result()
	pass, _ := passCmd.Result()

	// If any critical field is missing, imply "not configured in Redis"
	if host == "" {
		return nil, nil
	}

	return &config.Config{
		IMAPHost: host,
		IMAPPort: port,
		IMAPUser: user,
		IMAPPass: pass,
	}, nil
}
