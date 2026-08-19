package main

import (
	"encoding/json"
	"net/http"
)

const version = "0.1.0"

// Server owns the HTTP routing and every piece of companion state
// (pairing, folders, fonts) built up across this phase's later tasks.
type Server struct {
	mux     *http.ServeMux
	pairing *pairing
}

func newServer() *Server {
	s := &Server{mux: http.NewServeMux(), pairing: newPairing()}
	s.mux.HandleFunc("GET /status", s.handleStatus)
	s.mux.HandleFunc("POST /pair", s.pairing.HandlePair)
	return s
}

func (s *Server) Handler() http.Handler { return s.mux }

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"version": version,
		"paired":  s.pairing.IsPaired(),
	})
}
