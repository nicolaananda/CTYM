package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	RedisURL             string
	IMAPHost             string
	IMAPPort             int
	IMAPUser             string
	IMAPPass             string
	AllowedDomains       []string
	TTLSeconds           int
	PollSeconds          int
	MaxEmailBytes        int
	RateLimitCreatePerMin int
	RateLimitFetchPerMin  int
	LogLevel             string
	ExpiredWeb           string
	AdminPassword        string
	JWTSecret            string
}

func Load() *Config {
	return &Config{
		RedisURL:             getEnv("REDIS_URL", "redis://localhost:6379/0"),
		IMAPHost:             getEnv("IMAP_HOST", "mail.nicola.id"),
		IMAPPort:             getEnvInt("IMAP_PORT", 993),
		IMAPUser:             getEnv("IMAP_USER", "catsflix@nicola.id"),
		IMAPPass:             getEnv("IMAP_PASS", ""),
		AllowedDomains:       strings.Split(getEnv("ALLOWED_DOMAINS", "catty.my.id,cattyprems.top"), ","),
		TTLSeconds:           getEnvInt("TTL_SECONDS", 86400),
		PollSeconds:          getEnvInt("POLL_SECONDS", 20),
		MaxEmailBytes:        getEnvInt("MAX_EMAIL_BYTES", 5242880), // 5MB
		RateLimitCreatePerMin: getEnvInt("RATE_LIMIT_CREATE_PER_MIN", 10),
		RateLimitFetchPerMin:  getEnvInt("RATE_LIMIT_FETCH_PER_MIN", 60),
		LogLevel:             getEnv("LOG_LEVEL", "info"),
		ExpiredWeb:           getEnv("EXPIRED_WEB", ""),
		AdminPassword:        getEnv("ADMIN_PASSWORD", "0401"),
		JWTSecret:            getEnv("JWT_SECRET", ""),
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if value, ok := os.LookupEnv(key); ok {
		if i, err := strconv.Atoi(value); err == nil {
			return i
		}
	}
	return fallback
}
