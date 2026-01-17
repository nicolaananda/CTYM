package main

import (
	"cattymail/internal/api"
	"cattymail/internal/config"
	"cattymail/internal/redisstore"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"context"
	"time"
)

func main() {
	cfg := config.Load()

	store, err := redisstore.New(cfg.RedisURL, cfg.TTLSeconds)
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}

	handler := api.New(cfg, store)
	srv := &http.Server{
		Addr:    ":8080",
		Handler: handler.Router(),
	}

	go func() {
		log.Println("API Server starting on :8080")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("ListenAndServe: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down API server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}
	log.Println("Server exiting")
}
