package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestPairResolvesOnEnablePairing(t *testing.T) {
	p := newPairing()

	type result struct {
		code int
		body string
	}
	done := make(chan result, 1)
	go func() {
		req := httptest.NewRequest(http.MethodPost, "/pair", nil)
		rec := httptest.NewRecorder()
		p.HandlePair(rec, req)
		done <- result{rec.Code, rec.Body.String()}
	}()

	// Give the handler a moment to actually start waiting before arming -
	// otherwise this test would pass even if EnablePairing didn't wake a
	// blocked request at all, just a subsequent one.
	time.Sleep(20 * time.Millisecond)
	p.EnablePairing()

	select {
	case r := <-done:
		if r.code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", r.code, r.body)
		}
		if len(r.body) < 32 {
			t.Fatalf("expected a real token in the body, got %q", r.body)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("POST /pair never resolved after EnablePairing")
	}

	if !p.IsPaired() {
		t.Fatal("expected IsPaired() true after a successful pair")
	}
}

func TestPairTimesOutWithoutEnablePairing(t *testing.T) {
	p := newPairing()
	p.pairTimeout = 30 * time.Millisecond // test-only override, see Step 3

	req := httptest.NewRequest(http.MethodPost, "/pair", nil)
	rec := httptest.NewRecorder()
	p.HandlePair(rec, req)

	if rec.Code != http.StatusRequestTimeout {
		t.Fatalf("expected 408, got %d", rec.Code)
	}
}

func TestRequireTokenRejectsMissingOrWrongToken(t *testing.T) {
	p := newPairing()
	p.EnablePairing()
	req0 := httptest.NewRequest(http.MethodPost, "/pair", nil)
	rec0 := httptest.NewRecorder()
	p.HandlePair(rec0, req0)
	token := rec0.Body.String()

	ok := p.requireToken(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	cases := []struct {
		name   string
		header string
		want   int
	}{
		{"missing", "", http.StatusUnauthorized},
		{"wrong", "Bearer not-the-token", http.StatusUnauthorized},
		{"correct", "Bearer " + token, http.StatusOK},
	}
	for _, c := range cases {
		req := httptest.NewRequest(http.MethodGet, "/folders", nil)
		if c.header != "" {
			req.Header.Set("Authorization", c.header)
		}
		rec := httptest.NewRecorder()
		ok.ServeHTTP(rec, req)
		if rec.Code != c.want {
			t.Errorf("%s: expected %d, got %d", c.name, c.want, rec.Code)
		}
	}
}
