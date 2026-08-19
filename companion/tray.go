package main

import "fyne.io/systray"

// runTray blocks for the life of the process. onReady wires the menu;
// systray.Run must own the OS event loop, which is why main() calls this
// last and the HTTP server is started in its own goroutine beforehand.
func runTray(p *pairing, quit func()) {
	systray.Run(func() {
		systray.SetTitle("PixULA Companion")
		systray.SetTooltip("PixULA Companion - optional file access bridge")

		enable := systray.AddMenuItem("Enable Pairing", "Allow the next PixULA tab to connect")
		systray.AddSeparator()
		quitItem := systray.AddMenuItem("Quit", "Stop the companion")

		go func() {
			for {
				select {
				case <-enable.ClickedCh:
					p.EnablePairing()
				case <-quitItem.ClickedCh:
					systray.Quit()
					return
				}
			}
		}()
	}, quit)
}
