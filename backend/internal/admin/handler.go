package admin

import (
	"cattymail/internal/config"
	"cattymail/internal/redisstore"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
)

type AdminHandler struct {
	cfg   *config.Config
	store *redisstore.Store
	auth  *AuthService
}

func NewAdminHandler(cfg *config.Config, store *redisstore.Store) (*AdminHandler, error) {
	auth, err := NewAuthService(cfg.AdminPassword, cfg.JWTSecret)
	if err != nil {
		return nil, err
	}

	return &AdminHandler{
		cfg:   cfg,
		store: store,
		auth:  auth,
	}, nil
}

// Middleware to check JWT token
func (h *AdminHandler) AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Missing authorization header", http.StatusUnauthorized)
			return
		}

		// Extract token from "Bearer <token>"
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, "Invalid authorization header format", http.StatusUnauthorized)
			return
		}

		token := parts[1]
		_, err := h.auth.ValidateToken(token)
		if err != nil {
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// Login handler
func (h *AdminHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.auth.ValidatePassword(req.Password); err != nil {
		http.Error(w, "Invalid password", http.StatusUnauthorized)
		return
	}

	token, err := h.auth.GenerateToken()
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"token": token,
	})
}

// Get statistics
func (h *AdminHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	totalAddresses, _ := h.store.GetTotalAddresses(ctx)
	totalMessages, _ := h.store.GetTotalMessages(ctx)
	activeAddresses, _ := h.store.GetActiveAddresses(ctx)
	messagesLast24h, _ := h.store.GetMessagesLast24h(ctx)
	domainStats, _ := h.store.GetDomainStats(ctx)

	// Convert domain stats to array format
	var topDomains []map[string]interface{}
	for domain, count := range domainStats {
		topDomains = append(topDomains, map[string]interface{}{
			"domain": domain,
			"count":  count,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"totalAddresses":  totalAddresses,
		"totalMessages":   totalMessages,
		"activeAddresses": activeAddresses,
		"messagesLast24h": messagesLast24h,
		"topDomains":      topDomains,
	})
}

// Get domains
func (h *AdminHandler) GetDomains(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"domains": h.cfg.AllowedDomains,
	})
}

// Get config
func (h *AdminHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"ttlSeconds":           h.cfg.TTLSeconds,
		"rateLimitCreatePerMin": h.cfg.RateLimitCreatePerMin,
		"rateLimitFetchPerMin":  h.cfg.RateLimitFetchPerMin,
		"maxEmailBytes":        h.cfg.MaxEmailBytes,
		"expiredWeb":           h.cfg.ExpiredWeb,
		"allowedDomains":       h.cfg.AllowedDomains,
	})
}

// Get all addresses (paginated)
func (h *AdminHandler) GetAddresses(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	
	// TODO: Parse offset and limit from query params
	offset := 0
	limit := 50

	addresses, err := h.store.GetAllAddresses(ctx, offset, limit)
	if err != nil {
		http.Error(w, "Failed to fetch addresses", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"addresses": addresses,
		"offset":    offset,
		"limit":     limit,
	})
}

// Get all messages (paginated)
func (h *AdminHandler) GetMessages(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	
	// TODO: Parse offset and limit from query params
	offset := 0
	limit := 50

	messages, err := h.store.GetAllMessages(ctx, offset, limit)
	if err != nil {
		http.Error(w, "Failed to fetch messages", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"messages": messages,
		"offset":   offset,
		"limit":    limit,
	})
}

// Delete message
func (h *AdminHandler) DeleteMessage(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	if err := h.store.DeleteMessage(ctx, id); err != nil {
		http.Error(w, "Failed to delete message", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "deleted",
	})
}

// Get health status
func (h *AdminHandler) GetHealth(w http.ResponseWriter, r *http.Request) {
	// TODO: Check Redis and IMAP connection
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"redis": "connected",
		"imap":  "unknown",
	})
}
