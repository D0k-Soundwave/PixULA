package main

import (
	"encoding/json"
	"net/http"
	"strings"
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

	// routeMethods accumulates, per path (the part of the pattern after the
	// verb), every HTTP method actually registered against it - built from
	// the real registrations below so it can never drift from them. It
	// feeds the OPTIONS preflight handlers registered at the end of this
	// function: one per distinct path, answering with exactly the methods
	// that path supports.
	routeMethods := map[string][]string{}
	handle := func(pattern string, h http.Handler) {
		verb, path, ok := strings.Cut(pattern, " ")
		if !ok {
			panic("companion: route pattern missing a method: " + pattern)
		}
		s.mux.Handle(pattern, h)
		routeMethods[path] = append(routeMethods[path], verb)
	}

	handle("GET /status", http.HandlerFunc(s.handleStatus))
	handle("POST /pair", http.HandlerFunc(s.pairing.HandlePair))

	auth := s.pairing.requireToken
	handle("POST /folders/choose", auth(http.HandlerFunc(s.handleFoldersChoose)))
	handle("GET /folders", auth(http.HandlerFunc(s.handleFoldersList)))
	handle("GET /folders/{id}/list", auth(http.HandlerFunc(s.handleFolderList)))
	handle("GET /folders/{id}/file/{relpath...}", auth(http.HandlerFunc(s.handleFolderFile)))
	handle("PUT /folders/{id}/file/{relpath...}", auth(http.HandlerFunc(s.handleFolderFile)))
	handle("DELETE /folders/{id}/file/{relpath...}", auth(http.HandlerFunc(s.handleFolderFile)))
	handle("GET /fonts", auth(http.HandlerFunc(s.handleFontsList)))
	handle("GET /fonts/{id}/file", auth(http.HandlerFunc(s.handleFontFile)))

	// CORS preflight (design spec 4.1): PixULA runs from file://, whose
	// Origin is opaque/null and cannot be checked, so CORS is opened
	// permissively and the bearer token (4.2) is the entire access-control
	// boundary. A browser preflight carries no Authorization header (there
	// is no way to attach one to an OPTIONS request), so these handlers are
	// registered OUTSIDE requireToken and must succeed without a token -
	// the real request that follows is still fully gated by requireToken
	// as before.
	for path, methods := range routeMethods {
		allow := strings.Join(append(methods, http.MethodOptions), ", ")
		s.mux.HandleFunc("OPTIONS "+path, func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Methods", allow)
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.WriteHeader(http.StatusNoContent)
		})
	}
	return s
}

// withCORSOrigin stamps Access-Control-Allow-Origin on every response, on
// every route (authenticated or not, OPTIONS or not) - see design spec 4.1.
// It is a literal wildcard, never an echoed request Origin: a file:// page's
// Origin can't be meaningfully checked, so there is nothing to validate and
// no access-control claim being made by this header.
func withCORSOrigin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		next.ServeHTTP(w, r)
	})
}

func (s *Server) Handler() http.Handler { return withCORSOrigin(s.mux) }

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"version": version,
		"paired":  s.pairing.IsPaired(),
	})
}
