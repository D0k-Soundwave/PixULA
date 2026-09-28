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
