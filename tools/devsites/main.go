package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

type site struct {
	name string
	addr string
	dir  string
}

func main() {
	root, err := os.Getwd()
	if err != nil {
		log.Fatal(err)
	}

	sites := []site{
		{name: "13xfile", addr: env("MAIN_ADDR", "127.0.0.1:8080"), dir: filepath.Join(root, "web")},
		{name: "feed", addr: env("FEED_ADDR", "127.0.0.1:8081"), dir: filepath.Join(root, "feed")},
		{name: "share", addr: env("SHARE_ADDR", "127.0.0.1:8082"), dir: filepath.Join(root, "share")},
	}

	for _, item := range sites {
		if info, err := os.Stat(item.dir); err != nil || !info.IsDir() {
			log.Fatalf("%s directory is unavailable: %s", item.name, item.dir)
		}
	}

	errs := make(chan error, len(sites))
	for _, item := range sites {
		item := item
		go func() {
			handler := http.FileServer(http.Dir(item.dir))
			server := &http.Server{
				Addr:              item.addr,
				Handler:           noCache(handler),
				ReadHeaderTimeout: 5 * time.Second,
			}
			log.Printf("%-7s http://%s", item.name, item.addr)
			errs <- server.ListenAndServe()
		}()
	}

	if err := <-errs; err != nil {
		log.Fatal(err)
	}
}

func env(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func noCache(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}

func init() {
	log.SetFlags(0)
	log.SetPrefix("[pages] ")
	fmt.Print("")
}
