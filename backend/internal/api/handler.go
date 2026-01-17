package api

import (
	"cattymail/internal/config"
	"cattymail/internal/domain"
	"cattymail/internal/redisstore"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/rs/cors"
)

type Handler struct {
	cfg   *config.Config
	store *redisstore.Store
}

func New(cfg *config.Config, store *redisstore.Store) *Handler {
	return &Handler{cfg: cfg, store: store}
}

func (h *Handler) Router() http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	})
	r.Use(c.Handler)

	r.Route("/api", func(r chi.Router) {
		r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		})
		r.Get("/readyz", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		})

		r.Post("/address/random", h.createRandomAddress)
		r.Post("/address/custom", h.createCustomAddress)
		
		r.Get("/inbox/{domain}/{local}", h.getInbox)
		r.Get("/message/{id}", h.getMessage)
	})

	return r
}

type CreateAddressRequest struct {
	Domain string `json:"domain"`
	Local  string `json:"local,omitempty"`
}

func (h *Handler) createRandomAddress(w http.ResponseWriter, r *http.Request) {
	if !h.checkRateLimit(w, r, "create", h.cfg.RateLimitCreatePerMin) {
		return
	}

	var req CreateAddressRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if !h.isValidDomain(req.Domain) {
		http.Error(w, "Invalid domain", http.StatusBadRequest)
		return
	}

	// Retry loop for random address
	for i := 0; i < 5; i++ {
		bytes := make([]byte, 4)
		if _, err := rand.Read(bytes); err != nil {
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		local := hex.EncodeToString(bytes)

		success, err := h.store.ReserveAddress(r.Context(), req.Domain, local)
		if err != nil {
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}
		if success {
			h.respondWithAddress(w, req.Domain, local)
			return
		}
	}
	http.Error(w, "Failed to generate unique address", http.StatusConflict)
}

func (h *Handler) createCustomAddress(w http.ResponseWriter, r *http.Request) {
	if !h.checkRateLimit(w, r, "create", h.cfg.RateLimitCreatePerMin) {
		return
	}

	var req CreateAddressRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if !h.isValidDomain(req.Domain) {
		http.Error(w, "Invalid domain", http.StatusBadRequest)
		return
	}

	local := strings.ToLower(strings.TrimSpace(req.Local))

	match, _ := regexp.MatchString(`^[a-z0-9][a-z0-9._-]{2,30}$`, local)
	if !match {
		http.Error(w, "Invalid username format. Must be 3-30 chars, alphanumeric with dots/scores.", http.StatusBadRequest)
		return
	}

	reserved := []string{"admin", "root", "postmaster", "support", "noreply", "abuse", "mailer-daemon"}
	for _, word := range reserved {
		if local == word {
			http.Error(w, "Username is reserved", http.StatusBadRequest)
			return
		}
	}

	// Allow claiming/accessing existing address (refresh TTL)
	err := h.store.EnsureAddress(r.Context(), req.Domain, local)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
    // Success implied, proceed to respond

	h.respondWithAddress(w, req.Domain, local)
}

func (h *Handler) respondWithAddress(w http.ResponseWriter, d, local string) {
	resp := domain.Address{
		Email:     fmt.Sprintf("%s@%s", local, d),
		Local:     local,
		Domain:    d,
		ExpiresAt: time.Now().Add(time.Duration(h.cfg.TTLSeconds) * time.Second),
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) getInbox(w http.ResponseWriter, r *http.Request) {
	domainParam := chi.URLParam(r, "domain")
	localParam := chi.URLParam(r, "local")
	
	if !h.checkRateLimit(w, r, "fetch", h.cfg.RateLimitFetchPerMin) {
		return
	}

	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if i, err := strconv.Atoi(l); err == nil && i > 0 && i <= 100 {
			limit = i
		}
	}

	var before int64 = 0
	if b := r.URL.Query().Get("before"); b != "" {
		if i, err := strconv.ParseInt(b, 10, 64); err == nil {
			before = i
		}
	}

	msgs, err := h.store.GetInbox(r.Context(), domainParam, localParam, limit, before)
	if err != nil {
		http.Error(w, "Failed to fetch inbox", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(msgs)
}

func (h *Handler) getMessage(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	
	msg, err := h.store.GetMessage(r.Context(), id)
	if err != nil {
		http.Error(w, "Failed to fetch message", http.StatusInternalServerError)
		return
	}
	if msg == nil {
		http.Error(w, "Message not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(msg)
}

func (h *Handler) isValidDomain(d string) bool {
	for _, allowed := range h.cfg.AllowedDomains {
		if d == allowed {
			return true
		}
	}
	return false
}

func (h *Handler) checkRateLimit(w http.ResponseWriter, r *http.Request, action string, limit int) bool {
	ip := r.RemoteAddr
	// Very basic IP extraction. Behind proxy might need X-Real-IP
	if xrip := r.Header.Get("X-Real-IP"); xrip != "" {
		ip = xrip
	} else if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		ip = strings.TrimSpace(parts[0])
	}
	// Strip port if present
	if strings.Contains(ip, ":") {
		host, _, err := net.SplitHostPort(ip)
		if err == nil {
			ip = host
		}
	}

	allowed, err := h.store.RateLimit(r.Context(), ip, action, limit, time.Minute)
	if err != nil {
		// Open fail? Or block? Let's log and allow 
		// For now, block on error to be safe or allowed
		return true 
	}
	if !allowed {
		http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
		return false
	}
	return true
}


