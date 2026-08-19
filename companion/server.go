package main

import (
	"encoding/json"
	"net/http"
)

const version = "0.1.0"

// Server owns the HTTP routing and every piece of companion state
// (pairing, folders, fonts) built up across this phase's later tasks.
type Server struct {
	mux *http.ServeMux
	// paired reports whether a token has ever been issued this run. Real
	// pairing state (Task 2) replaces this placeholder field directly —
	// it is not read anywhere yet, so it is safe to widen there.
	paired bool
}

func newServer() *Server {
	s := &Server{mux: http.NewServeMux()}
	s.mux.HandleFunc("GET /status", s.handleStatus)
	return s
}

func (s *Server) Handler() http.Handler { return s.mux }

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"version": version,
		"paired":  s.paired,
	})
}
