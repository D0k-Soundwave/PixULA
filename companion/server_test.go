package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestStatusUnauthenticated(t *testing.T) {
	s := newServer()
	req := httptest.NewRequest(http.MethodGet, "/status", nil)
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var body struct {
		Version string `json:"version"`
		Paired  bool   `json:"paired"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("bad JSON body: %v", err)
	}
	if body.Version == "" {
		t.Fatal("expected a non-empty version")
	}
	if body.Paired != false {
		t.Fatal("expected paired=false on a fresh server")
	}
}
