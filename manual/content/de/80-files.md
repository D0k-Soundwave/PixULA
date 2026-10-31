## Dateien

Es gibt zwei verschiedene Dinge, die Sie speichern können, und es ist wichtig,
zum richtigen zu greifen.

**Ein Projekt** bewahrt Ihre Arbeit so, wie Sie sie verlassen haben: jede Ebene,
die Palette, den Bildschirmmodus, Ihre Werkzeuge und deren Einstellungen, das
Referenzbild und den Bildausschnitt. Das ist eine `.pixula`-Datei, geschrieben
von **Datei > Projekt speichern**, und sie ist das Richtige, solange ein Bild
noch in Arbeit ist.

Ein Projekt mit einer Animation wird auf eine neuere Art gespeichert, die jedes Bild nur einmal packt; es lässt sich darum nicht in PixULA 0.1.0-beta.2 oder älter öffnen. Ein Projekt ohne Animation öffnet sich in jeder Version.

**Ein Bild** ist ein einzelner, zusammengeführter Bildschirm in einem Format,
das ein anderes Programm versteht – eine `.scr` für einen Emulator, eine `.png`
zum Herzeigen, eine `.tap` zum Laden auf echter Hardware. Diese schreibt
**Datei > Bild speichern unter**. Sie enthalten das Bild und sonst nichts – was
Sie wollen, wenn Sie das Ergebnis weitergeben, nicht aber, wenn Sie
weiterarbeiten möchten.

### Ein Bild importieren

Beim Öffnen eines Fotos oder anderen Bildes (PNG, JPG, GIF) werden drei Umwandlungen nebeneinander gezeigt - Scharf, Weich und Flach - und Sie klicken die an, die Ihnen gefällt. Weich verwandelt Schattierungen in Tinten- und Papierpixel, und die Liste **Dithering** unter den Vorschauen bestimmt wie: Standard ist das eigene Floyd-Steinberg des Imports, und die Liste bietet auch die 30 anderen Verfahren von ZX Paintbrush - Schwellen, Fehlerdiffusion, Bayer-Matrizen, Clusterpunkte und Superzellen. Die Wahl eines Verfahrens zeichnet Weich neu, und Scharf ebenfalls, sobald Sie eines gewählt haben (Flach rastert nie). Geordnete Verfahren laufen über Attributzellen hinweg weiter, das Muster zieht sich also über das ganze Bild; die Fehlerdiffusion bleibt innerhalb jeder Zelle, weil jede Zelle ihre eigenen zwei Farben hat. In den Modi Layer 2 und LoRes funktioniert die Liste ebenfalls: Jedes Pixel wird zwischen seine zwei nächsten Palettenfarben gesetzt, und das ganze Bild ist ein Block, die Fehlerdiffusion läuft also über das ganze Bild.

Die **Platzierung**-Regler daneben bestimmen, wo das Bild auf dem Bildschirm liegt - es sind dieselben wie im Referenz-Panel. **Einpassen** zeigt das ganze Bild mit schwarzen Balken, **Ausfüllen** bedeckt den Bildschirm und schneidet den Überstand ab, **Strecken** zieht es genau auf die Größe des Bildschirms, egal welche Form es hat, und **Zentrieren** setzt es wieder in die Mitte. **Skalieren** zoomt es um seine Mitte (unter null wird es gespiegelt), **Drehung** dreht es, die **Versatz**-Felder und das Richtungsfeld verschieben es pixelweise, und **Spiegeln H** und **Spiegeln V** spiegeln es. Die Vorschauen folgen jeder Änderung, und was das Bild nicht bedeckt, wird schwarz. Ist ein Referenzbild geladen, setzt **Platzierung der Referenz übernehmen** den Import genau dorthin, wo die Referenz liegt: Richten Sie ein Foto zuerst als Referenz über Ihrer Zeichnung aus und importieren Sie es dann an dieser Stelle.

### Einen Teil eines Bildes speichern

**Datei > Auswahl speichern unter** listet dieselben Formate wie Bild speichern unter, jedes nur offen, wenn die Auswahl dazu passt. PNG, BMP und JPEG nehmen jedes Rechteck. ZXP, SEV, ZED, ASM, C, BIN und ATR nehmen ganze Attributzellen: Die Auswahl wird zuerst an Zellen angepasst, und die Statuszeile sagt das. ColorTiles nehmen ganze 16x16-Kacheln. Die Formate, die ein Abzug eines ganzen Bildschirms sind (SCR, Bänder, MLT und ähnliche), sind nur offen, wenn die Auswahl der ganze Bildschirm ist. ASM, C, BIN und ATR schreiben den Teil Zeile für Zeile: die Bitmap als Block von Bytes je Zeile von oben nach unten und die Attribute ein Byte je Zelle; das tun sie in den klassischen, Multicolor- und ULAplus-Modi. Eine Freihand- oder Ellipsenauswahl speichert ihr umschließendes Rechteck. Ein geschlossenes Format sagt, warum, wenn man darauf zeigt. Bild speichern unter speichert das ganze Bild und ignoriert die Auswahl.

### Ein neues Bild aus einer Auswahl

**Bearbeiten > Neues Bild aus Auswahl** macht die Auswahl zum ganzen Bild. Die Auswahl wird zuerst an ganze Zellen angepasst. Es fragt, bevor es etwas tut, und Strg+Z bringt das alte Bild zurück. Alle Ebenen bleiben erhalten und werden auf diesen Block zugeschnitten, der nach oben links rückt; der Rest ist leer, und der Hintergrund dort ist weißes Papier. Der Bildschirmmodus bleibt gleich, und das Bild wird unbenannt, sodass das nächste Speichern nach einem Namen fragt.

### Automatisches Speichern und Sicherungen

PixULA kann Ihre Arbeit alle paar Minuten im Speicher des Browsers sichern und
sie nach einer abgebrochenen Sitzung wieder anbieten. Das ist ausgeschaltet,
bis Sie ein Intervall wählen: Stellen Sie **Automatisch speichern alle
(Minuten, 0 = aus)** in den Einstellungen unter Allgemein ein.

Sie können auch einen Ordner auf der Festplatte wählen, und jede automatische
Speicherung legt dort eine nummerierte Version ab – `picture V1.pixula`,
`picture V2.pixula` und so weiter. Die Nummerierung wird jedes Mal aus dem
Ordner gelesen, sodass ein wieder geöffnetes Bild die Folge fortsetzt, statt
bei V1 neu zu beginnen, und zwei Sitzungen am selben Bild teilen sich eine
Versionsreihe. Wie viele aufbewahrt werden, legen Sie in den Einstellungen fest;
Standard ist 20.

Eines ist zu erwarten. Ein Browser öffnet einen in einer früheren Sitzung
gewählten Ordner nicht ohne Ihre Bestätigung erneut, und der Zeitgeber der
automatischen Speicherung kann nicht für Sie fragen. Die erste Sicherung nach
einem Neuladen hält daher an und wartet auf Sie. Die Einstellungen haben eine
Schaltfläche **Sicherung fortsetzen**, und ein Klick darauf ist die
Bestätigung, auf die der Browser wartet.

{{formats}}
