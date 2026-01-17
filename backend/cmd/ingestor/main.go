package main

import (
	"cattymail/internal/config"
	"cattymail/internal/imapworker"
	"cattymail/internal/redisstore"
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	cfg := config.Load()

	store, err := redisstore.New(cfg.RedisURL, cfg.TTLSeconds)
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}

	worker := imapworker.New(cfg, store)
	
	ctx, cancel := context.WithCancel(context.Background())
	go worker.Start(ctx)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down Ingestor...")
	
	cancel()
	// Wait a bit?
}
