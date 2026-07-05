package main

import (
	"context"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"imagen/backend/internal/config"
	"imagen/backend/internal/httpapi"
	"imagen/backend/internal/repository"
	"imagen/backend/internal/service"
	"imagen/backend/internal/worker"
)

func main() {
	gin.SetMode(gin.ReleaseMode)
	cfg := config.FromEnv()
	logFile, err := setupLogging(cfg.LogFile)
	if err != nil {
		log.Fatal(err)
	}
	if logFile != nil {
		defer logFile.Close()
	}
	db, err := repository.Open(cfg.DatabaseDSN, cfg.DBPath)
	if err != nil {
		log.Fatal(err)
	}
	if err := repository.Migrate(db); err != nil {
		log.Fatal(err)
	}
	store := repository.NewStore(db)
	app, err := service.New(store, cfg)
	if err != nil {
		log.Fatal(err)
	}
	if err := app.EnsureDefaultProviderAccount(context.Background()); err != nil {
		log.Fatal(err)
	}

	rootCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool := worker.NewPool(app, cfg.Workers)
	pool.Start(rootCtx)
	defer pool.Stop()

	server := &http.Server{
		Addr:              cfg.Addr,
		Handler:           httpapi.New(app),
		ReadHeaderTimeout: 10 * time.Second,
	}
	go func() {
		<-rootCtx.Done()
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = server.Shutdown(ctx)
	}()

	log.Printf("imagen api listening on %s", cfg.Addr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}

func setupLogging(path string) (*os.File, error) {
	if path == "" {
		return nil, nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	file, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return nil, err
	}
	writer := io.MultiWriter(os.Stdout, file)
	log.SetOutput(writer)
	gin.DefaultWriter = writer
	gin.DefaultErrorWriter = writer
	return file, nil
}
