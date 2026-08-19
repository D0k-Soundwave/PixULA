package main

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"net/http"
	"strings"
	"sync"
	"time"
)

const pairArmWindow = 2 * time.Minute

// pairing owns the whole trust boundary: whether a token exists, and the
// one channel through which a token is ever minted. HandlePair holds an
// HTTP request open until EnablePairing is called from the tray - never
// the reverse. See the "pairing trigger" Global Constraint: EnablePairing
// must only ever be invoked in-process (a tray click, or a test), never
// wired to a route.
type pairing struct {
	mu          sync.Mutex
	token       string
	armed       bool
	armedAt     time.Time
	waiting     chan chan string // pending /pair requests waiting for a token
	pairTimeout time.Duration    // request-side wait limit; overridable in tests
}

func newPairing() *pairing {
	return &pairing{
		waiting:     make(chan chan string),
		pairTimeout: 3 * time.Minute,
	}
}

func (p *pairing) IsPaired() bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.token != ""
}

func newToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic("companion: crypto/rand failed: " + err.Error())
	}
	return hex.EncodeToString(b)
}

// EnablePairing arms a 2-minute window and, if a request is already
// waiting in HandlePair, resolves it immediately with a fresh token.
func (p *pairing) EnablePairing() {
	p.mu.Lock()
	if p.armed {
		p.mu.Unlock()
		return
	}
	p.armed = true
	p.armedAt = time.Now()
	p.mu.Unlock()

	go func() {
		select {
		case reply := <-p.waiting:
			token := newToken()
			p.mu.Lock()
			p.token = token
			p.armed = false
			p.mu.Unlock()
			reply <- token
		case <-time.After(pairArmWindow):
			p.mu.Lock()
			p.armed = false
			p.mu.Unlock()
		}
	}()
}

// HandlePair blocks until EnablePairing resolves it or pairTimeout elapses.
func (p *pairing) HandlePair(w http.ResponseWriter, r *http.Request) {
	reply := make(chan string, 1)
	select {
	case p.waiting <- reply:
	case <-time.After(p.pairTimeout):
		http.Error(w, "no pairing request armed", http.StatusRequestTimeout)
		return
	}

	select {
	case token := <-reply:
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(token))
	case <-time.After(p.pairTimeout):
		http.Error(w, "pairing timed out", http.StatusRequestTimeout)
	}
}

// requireToken gates every route except /status and /pair.
func (p *pairing) requireToken(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		got, ok := strings.CutPrefix(auth, "Bearer ")
		p.mu.Lock()
		want := p.token
		p.mu.Unlock()
		if !ok || want == "" || subtle.ConstantTimeCompare([]byte(got), []byte(want)) != 1 {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}
