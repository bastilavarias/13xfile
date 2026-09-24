package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDesktopAPIRejectsUntrustedBrowserOrigin(t *testing.T) {
	handler := withCORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "http://127.0.0.1:8791/api/state", nil)
	req.Header.Set("Origin", "https://evil.example")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected forbidden, got %d", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("untrusted origin was reflected: %q", got)
	}
}

func TestDesktopAPIAllowsWailsOrigin(t *testing.T) {
	handler := withCORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "http://127.0.0.1:8791/api/state", nil)
	req.Header.Set("Origin", "http://wails.localhost")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected OK, got %d", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://wails.localhost" {
		t.Fatalf("unexpected allow origin %q", got)
	}
}

func TestDesktopAPIAllowsWailsSchemeAndNoOrigin(t *testing.T) {
	if !desktopOriginAllowed("wails://wails") {
		t.Fatal("expected wails://wails to be allowed")
	}
	if !desktopOriginAllowed("wails://localhost") {
		t.Fatal("expected wails://localhost to be allowed")
	}
	if !desktopOriginAllowed("") {
		t.Fatal("expected requests without Origin to be allowed")
	}
}

func TestDesktopAPIDevOriginRequiresExplicitSetting(t *testing.T) {
	const devOrigin = "http://localhost:5173"
	if desktopOriginAllowed(devOrigin) {
		t.Fatal("dev origin should not be allowed by default")
	}
	t.Setenv("THIRTEENXFILE_DESKTOP_DEV_ORIGIN", devOrigin)
	if !desktopOriginAllowed(devOrigin) {
		t.Fatal("configured dev origin should be allowed")
	}
}
