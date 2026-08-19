# PixULA Companion

Optional local helper that gives PixULA real folder access and OS-font
access without repeated browser permission prompts. PixULA works fully
without this; see `docs/COMPANION.md` in the repo root for what it does
and why.

## Build

    cd companion
    GOOS=windows GOARCH=amd64 go build -o dist/pixula-companion-windows-amd64.exe .
    GOOS=darwin  GOARCH=amd64 go build -o dist/pixula-companion-darwin-amd64 .
    GOOS=linux   GOARCH=amd64 go build -o dist/pixula-companion-linux-amd64 .

## Test

    go test ./...

## Run

    ./dist/pixula-companion-<platform>
