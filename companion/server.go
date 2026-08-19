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
	folders *folderStore
	fonts   *fontStore
}

func newServer() *Server {
	s := &Server{mux: http.NewServeMux(), pairing: newPairing(), folders: newFolderStore()}
	s.fonts = newFontStore()
	s.fonts.Refresh()
	s.mux.HandleFunc("GET /status", s.handleStatus)
	s.mux.HandleFunc("POST /pair", s.pairing.HandlePair)

	auth := s.pairing.requireToken
	s.mux.Handle("POST /folders/choose", auth(http.HandlerFunc(s.handleFoldersChoose)))
	s.mux.Handle("GET /folders", auth(http.HandlerFunc(s.handleFoldersList)))
	s.mux.Handle("GET /folders/{id}/list", auth(http.HandlerFunc(s.handleFolderList)))
	s.mux.Handle("GET /folders/{id}/file/{relpath...}", auth(http.HandlerFunc(s.handleFolderFile)))
	s.mux.Handle("PUT /folders/{id}/file/{relpath...}", auth(http.HandlerFunc(s.handleFolderFile)))
	s.mux.Handle("DELETE /folders/{id}/file/{relpath...}", auth(http.HandlerFunc(s.handleFolderFile)))
	s.mux.Handle("GET /fonts", auth(http.HandlerFunc(s.handleFontsList)))
	s.mux.Handle("GET /fonts/{id}/file", auth(http.HandlerFunc(s.handleFontFile)))
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
