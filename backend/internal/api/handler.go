package api

import (
	"cattymail/internal/admin"
	"cattymail/internal/config"
	"cattymail/internal/domain"
	"cattymail/internal/redisstore"
	"context"
	"encoding/json"
	"math/rand"
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
	cfg         *config.Config
	store       *redisstore.Store
	adminHandler *admin.AdminHandler
}

func New(cfg *config.Config, store *redisstore.Store) *Handler {
	adminHandler, err := admin.NewAdminHandler(cfg, store)
	if err != nil {
		// Log error but continue - admin panel will be unavailable
		// In production, you might want to handle this differently
	}

	return &Handler{
		cfg:          cfg,
		store:        store,
		adminHandler: adminHandler,
	}
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
	r.Use(h.expirationMiddleware)

	r.Route("/api", func(r chi.Router) {
		r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		})
		r.Get("/readyz", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		})
		r.Get("/status", h.getStatus)
		r.Get("/domains", h.getPublicDomains)

		r.Post("/address/random", h.createRandomAddress)
		r.Post("/address/custom", h.createCustomAddress)
		
		r.Get("/inbox/{domain}/{local}", h.getInbox)
		r.Get("/message/{id}", h.getMessage)

		// Admin routes
		if h.adminHandler != nil {
			r.Post("/admin/login", h.adminHandler.Login)
			
			// Protected admin routes
			r.Group(func(r chi.Router) {
				r.Use(h.adminHandler.AuthMiddleware)
				
				r.Get("/admin/stats", h.adminHandler.GetStats)
				
				// Domains
				r.Get("/admin/domains", h.adminHandler.GetDomains)
				r.Post("/admin/domains", h.adminHandler.AddDomain)
				r.Delete("/admin/domains/{domain}", h.adminHandler.RemoveDomain)
				
				// Config & Settings
				r.Get("/admin/config", h.adminHandler.GetConfig)
				r.Get("/admin/settings", h.adminHandler.GetSettings)
				r.Post("/admin/settings", h.adminHandler.UpdateSettings)

				r.Get("/admin/addresses", h.adminHandler.GetAddresses)
				r.Get("/admin/messages", h.adminHandler.GetMessages)
				r.Delete("/admin/messages/{id}", h.adminHandler.DeleteMessage)
				r.Get("/admin/health", h.adminHandler.GetHealth)
			})
		}
	})

	return r
}

func (h *Handler) getPublicDomains(w http.ResponseWriter, r *http.Request) {
	// Get static domains from config
	domains := make([]string, len(h.cfg.AllowedDomains))
	copy(domains, h.cfg.AllowedDomains)

	// Get dynamic domains from Redis
	dynamicDomains, err := h.store.GetDomains(r.Context())
	if err == nil {
		// Dedup map
		seen := make(map[string]bool)
		for _, d := range domains {
			seen[d] = true
		}
		
		// Add dynamic domains if not duplicate
		for _, d := range dynamicDomains {
			if !seen[d] {
				domains = append(domains, d)
				seen[d] = true
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string][]string{
		"domains": domains,
	})
}

type CreateAddressRequest struct {
	Domain string `json:"domain"`
	Local  string `json:"local,omitempty"`
}

var indonesianNames = []string{
	"adi", "agus", "ahmad", "andi", "arif", "bambang", "budi", "candra",
	"dedi", "deni", "edi", "eko", "fajar", "ferry", "gunawan", "hadi",
	"hendra", "indra", "joko", "kevin", "kurnia", "lukman", "made",
	"mahendra", "muhammad", "nanda", "putra", "rahmat", "rendi", "rizki",
	"sandi", "slamet", "sugeng", "taufik", "wahyu", "wawan", "yoga", "yudi",
	"zainal", "zaki", "dewi", "fitri", "maya", "putri", "rani", "sari",
	"wati", "yuni", "ani", "dian", "eka", "intan", "lina", "nina",
	"ratna", "rina", "sinta", "tika", "wulan", "yanti",
	"abdul", "aditya", "agung", "anwar", "ari", "arum", "astuti", "bagus",
	"bayu", "bintang", "cahyo", "danang", "darmawan", "desy", "dwi", "enny",
	"farhan", "febri", "galih", "gita", "hafiz", "hasan", "heru", "iman",
	"irwan", "kartika", "kusuma", "lestari", "mulyono", "nur", "panji", "pratama",
	"purnama", "ridwan", "saputra", "setiawan", "teguh", "tri", "utami", "widodo",
	"ade", "adnan", "aisyah", "akbar", "alamsyah", "aldy", "ali", "alif",
	"amalia", "aminah", "amir", "andika", "anggi", "anggun", "anisa", "annisa",
	"antono", "apriani", "ardian", "arianto", "arifin", "ariyanto", "arizona", "arya",
	"asri", "aura", "aziz", "azizah", "badar", "basuki", "benny", "berlian",
	"bima", "bisma", "chairul", "citra", "damar", "danu", "darsono", "david",
	"deri", "dicky", "didik", "dimas", "dina", "dinda", "erik", "erlangga",
	"erna", "erwin", "fadlan", "fadli", "fany", "farid", "fathir", "fauzan",
	"fauzi", "feby", "fira", "firman", "fitria", "gia", "gilang", "grace",
	"gumilar", "hamzah", "hana", "hanif", "haris", "hendri", "hidayat", "hikmah",
	"husen", "ibrahim", "ihsan", "ika", "ikhsan", "ikbal", "indah", "ira",
	"irfan", "ismail", "iswan", "iwan", "jamal", "jefri", "johan", "juli",
	"julia", "julio", "kadir", "kamal", "karina", "kasih", "kemal", "khairul",
	"khoirul", "kiki", "komang", "krishna", "laksamana", "laras", "latif", "lia",
	"linda", "lucky", "lutfi", "maman", "mansur", "mardi", "marwan", "maulana",
	"mega", "melati", "mira", "muamar", "mulyadi", "munir", "mutia", "nabil",
	"nadia", "nadir", "najwa", "nanang", "nasir", "naufal", "nazar", "nila",
	"novi", "novita", "nugroho", "nurul", "nyoman", "okta", "oktavia", "panjaitan",
	"permadi", "permata", "perdana", "ponco", "prasetyo", "prayitno", "puji", "purwanto",
	"raden", "radit", "raffi", "rafli", "raihan", "rama", "ramadhan", "ramlan",
	"raya", "reza", "rizal", "rizky", "roni", "rosyid", "rudy", "ruslan",
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

	if !h.isValidDomain(r.Context(), req.Domain) {
		http.Error(w, "Invalid domain", http.StatusBadRequest)
		return
	}

	// Retry loop for random address
	for i := 0; i < 5; i++ {
		// Pick a random Indonesian name
		name := indonesianNames[rand.Intn(len(indonesianNames))]
		// Generate 5 random digits
		digits := rand.Intn(90000) + 10000 // generates 10000-99999
		local := fmt.Sprintf("%s%d", name, digits)

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

	if !h.isValidDomain(r.Context(), req.Domain) {
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

func (h *Handler) getStatus(w http.ResponseWriter, r *http.Request) {
	expired := h.cfg.IsExpired()
	
	response := map[string]interface{}{
		"expired": expired,
	}
	
	if h.cfg.ExpiredWeb != "" {
		if expirationDate, err := h.cfg.GetExpirationDate(); err == nil {
			response["expirationDate"] = expirationDate.Format("2006-01-02")
		}
	}
	
	if expired {
		response["message"] = "This service has expired"
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *Handler) expirationMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Allow /api/status to always work so frontend can check expiration
		if r.URL.Path == "/api/status" || r.URL.Path == "/api/healthz" || r.URL.Path == "/api/readyz" {
			next.ServeHTTP(w, r)
			return
		}
		
		// Check if expired
		if h.cfg.IsExpired() {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Service has expired",
			})
			return
		}
		
		next.ServeHTTP(w, r)
	})
}

func (h *Handler) isValidDomain(ctx context.Context, d string) bool {
	// 1. Check static config first
	for _, allowed := range h.cfg.AllowedDomains {
		if d == allowed {
			return true
		}
	}
	
	// 2. Check dynamic domains from Redis
	dynamicDomains, err := h.store.GetDomains(ctx)
	if err == nil {
		for _, allowed := range dynamicDomains {
			if d == allowed {
				return true
			}
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


