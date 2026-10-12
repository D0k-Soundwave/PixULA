## Dateien

Es gibt zwei verschiedene Dinge, die Sie speichern können, und es ist wichtig,
zum richtigen zu greifen.

**Ein Projekt** bewahrt Ihre Arbeit so, wie Sie sie verlassen haben: jede Ebene,
die Palette, den Bildschirmmodus, Ihre Werkzeuge und deren Einstellungen, das
Referenzbild und den Bildausschnitt. Das ist eine `.pixula`-Datei, geschrieben
von **Datei > Projekt speichern**, und sie ist das Richtige, solange ein Bild
noch in Arbeit ist.

**Ein Bild** ist ein einzelner, zusammengeführter Bildschirm in einem Format,
das ein anderes Programm versteht – eine `.scr` für einen Emulator, eine `.png`
zum Herzeigen, eine `.tap` zum Laden auf echter Hardware. Diese schreibt
**Datei > Bild speichern unter**. Sie enthalten das Bild und sonst nichts – was
Sie wollen, wenn Sie das Ergebnis weitergeben, nicht aber, wenn Sie
weiterarbeiten möchten.

### Ein Bild importieren

Beim Öffnen eines Fotos oder anderen Bildes (PNG, JPG, GIF) werden drei Umwandlungen nebeneinander gezeigt - Scharf, Weich und Flach - und Sie klicken die an, die Ihnen gefällt. Weich verwandelt Schattierungen in Punkte, und die Liste **Dithering** unter den Vorschauen bestimmt wie: Standard ist das eigene Floyd-Steinberg des Imports, und die Liste bietet auch die 30 anderen Verfahren von ZX Paintbrush - Schwellen, Fehlerdiffusion, Bayer-Matrizen, Clusterpunkte und Superzellen. Die Wahl eines Verfahrens schaltet auf die Vorschau Weich. Geordnete Verfahren laufen über Attributzellen hinweg weiter, das Muster zieht sich also über das ganze Bild; die Fehlerdiffusion bleibt innerhalb jeder Zelle, weil jede Zelle ihre eigenen zwei Farben hat. In den Modi Layer 2 und LoRes ist die Liste ausgegraut: Diese Modi behalten ihr eigenes Farb-Dithering.

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
