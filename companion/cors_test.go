package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// pairedServer builds a Server and drives it through a real pairing
// exchange, returning the minted token - the same path an artist's click on
// Enable Pairing produces, per design spec 4.2.
func pairedServer(t *testing.T) (*Server, string) {
	t.Helper()
	s := newServer()
	s.pairing.EnablePairing()

	req := httptest.NewRequest(http.MethodPost, "/pair", nil)
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("pairing failed: expected 200, got %d", rec.Code)
	}
	return s, rec.Body.String()
}

// Every response must carry Access-Control-Allow-Origin: * - design spec
// 4.1: PixULA runs from file://, whose Origin is opaque/null and cannot be
// checked, so CORS is opened permissively and the token is the entire
// access-control boundary. This must hold for the unauthenticated /status
// route, for an authenticated route answered with a real token, and for an
// authenticated route answered WITHOUT one (a 401 is still a response).
func TestCORSOriginHeaderOnEveryResponse(t *testing.T) {
	s, token := pairedServer(t)

	cases := []struct {
		name   string
		method string
		path   string
		auth   string
	}{
		{"unauthenticated status", http.MethodGet, "/status", ""},
		{"authenticated with valid token", http.MethodGet, "/folders", "Bearer " + token},
		{"authenticated without token (still a response)", http.MethodGet, "/folders", ""},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			req := httptest.NewRequest(c.method, c.path, nil)
			if c.auth != "" {
				req.Header.Set("Authorization", c.auth)
			}
			rec := httptest.NewRecorder()
			s.Handler().ServeHTTP(rec, req)

			got := rec.Header().Get("Access-Control-Allow-Origin")
			if got != "*" {
				t.Errorf("expected Access-Control-Allow-Origin: *, got %q (status %d)", got, rec.Code)
			}
		})
	}
}

// The concrete case that was completely broken before this fix: a browser
// preflight to an authenticated route carries no Authorization header (there
// is no way to attach a bearer token to an OPTIONS request), so it must
// succeed on its own and hand back the CORS headers the real request needs.
func TestOptionsPreflightSucceedsWithoutToken(t *testing.T) {
	s := newServer() // deliberately unpaired - no token exists at all

	cases := []struct {
		name        string
		path        string
		wantMethods []string // methods that must appear in Access-Control-Allow-Methods
	}{
		{"unauthenticated route", "/status", []string{"GET", "OPTIONS"}},
		{"pair route", "/pair", []string{"POST", "OPTIONS"}},
		{"authenticated multi-method route", "/folders/abc123/file/some/path.png",
			[]string{"GET", "PUT", "DELETE", "OPTIONS"}},
		{"authenticated single-method route", "/folders", []string{"GET", "OPTIONS"}},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodOptions, c.path, nil)
			rec := httptest.NewRecorder()
			s.Handler().ServeHTTP(rec, req)

			if rec.Code != http.StatusNoContent && rec.Code != http.StatusOK {
				t.Fatalf("expected 204 or 200, got %d", rec.Code)
			}

			if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "*" {
				t.Errorf("expected Access-Control-Allow-Origin: *, got %q", got)
			}

			allow := rec.Header().Get("Access-Control-Allow-Methods")
			for _, m := range c.wantMethods {
				if !strings.Contains(allow, m) {
					t.Errorf("expected Access-Control-Allow-Methods (%q) to contain %q", allow, m)
				}
			}

			headers := rec.Header().Get("Access-Control-Allow-Headers")
			for _, h := range []string{"Authorization", "Content-Type"} {
				if !strings.Contains(headers, h) {
					t.Errorf("expected Access-Control-Allow-Headers (%q) to contain %q", headers, h)
				}
			}
		})
	}
}

// Regression check: adding CORS must not weaken auth on the real (non-
// OPTIONS) requests those preflights stand in for. Missing or wrong bearer
// tokens are still rejected exactly as before; a correct one still works.
func TestAuthStillEnforcedOnRealRequestsAfterCORS(t *testing.T) {
	s, token := pairedServer(t)

	cases := []struct {
		name   string
		header string
		want   int
	}{
		{"missing token", "", http.StatusUnauthorized},
		{"wrong token", "Bearer not-the-token", http.StatusUnauthorized},
		{"correct token", "Bearer " + token, http.StatusOK},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/folders", nil)
			if c.header != "" {
				req.Header.Set("Authorization", c.header)
			}
			rec := httptest.NewRecorder()
			s.Handler().ServeHTTP(rec, req)

			if rec.Code != c.want {
				t.Errorf("expected %d, got %d", c.want, rec.Code)
			}
		})
	}
}
