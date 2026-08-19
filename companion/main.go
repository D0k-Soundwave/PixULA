package main

import (
	"log"
	"net/http"
)

const defaultAddr = "127.0.0.1:51973"

func main() {
	s := newServer()
	log.Printf("PixULA Companion %s listening on %s", version, defaultAddr)
	if err := http.ListenAndServe(defaultAddr, s.Handler()); err != nil {
		log.Fatalf("companion: failed to bind %s: %v", defaultAddr, err)
	}
}
