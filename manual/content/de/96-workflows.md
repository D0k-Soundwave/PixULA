## Arbeitsabläufe

Einige häufige Aufgaben, von Anfang bis Ende.

### Ihr erstes Bild

1. Öffnen Sie `PixULA.html`. Sie beginnen in Standard-ULA mit einem leeren
   Bildschirm von 256 × 192.
2. Schalten Sie neben den Zoom-Reglern das Zellraster ein, damit Sie die
   8×8-Blöcke sehen, in denen die Farbe gespeichert wird.
3. Wählen Sie eine Tintenfarbe in der Farbleiste oder mit den Zifferntasten 1
   bis 8 und eine Papierfarbe per Rechtsklick auf ein Farbfeld.
4. Zeichnen Sie mit dem **Pinsel**. Linke Taste für Tinte, rechte für Papier.
5. Zoomen Sie mit `+` und `-`. Halten Sie die Leertaste und ziehen Sie, um sich
   zu bewegen, oder nutzen Sie das Werkzeug **Ansicht verschieben**.
6. `Strg+Z` macht rückgängig. `Strg+S` speichert ein `.pixula`-Projekt, das
   neben dem Bild auch Ihre Ebenen und Einstellungen bewahrt.

Die Farbflächen vor den Details anzulegen spart meist Arbeit, denn eine
Farbgrenze, die nicht auf eine Zellgrenze fällt, ändert immer wieder Farben,
die Sie schon festgelegt hatten.

### Ein Foto abpausen

1. Öffnen Sie den Bereich **Referenz** und laden Sie Ihr Foto. Es liegt mit
   einstellbarer Deckkraft, Position und Größe hinter Ihrer Grafik und ist nie
   Teil des gespeicherten Bildes.
2. Zeichnen Sie auf einer normalen Ebene darüber.
3. Wirkt die Referenz einmal unschärfer als das Original, weist der Bereich
   darauf hin und bietet die Schaltfläche **Foto suchen** an. PixULA verknüpft
   die Datei auf der Festplatte; wird das Foto verschoben, bleibt nur eine
   kleine Vorschau davon übrig.

### Ein Foto umwandeln

So lassen Sie PixULA die Umwandlung erledigen:

1. **Datei > Laden** und eine `.png`, `.jpg` oder `.gif` wählen.
2. Der Importdialog zeigt drei Umwandlungen nebeneinander: Scharf, Weich und
   Flach. Welche am besten aussieht, hängt ganz vom Foto ab; es lohnt sich
   also, jedes Mal alle drei zu vergleichen.
3. Passen Sie Helligkeit, Kontrast und Skalierung an, bis die Vorschau gut
   wirkt, und bestätigen Sie.

In ULAplus und den Next-Modi wird die Palette aus Ihrem Bild erstellt, Sie sind
also nicht auf die sechzehn ULA-Farben beschränkt. Das macht meist einen großen
Unterschied.

### Eine Schrift erstellen

1. **Datei > Zeichensatz-Editor**.
2. Beginnen Sie mit der ZX-ROM-Schrift oder importieren Sie einen Satz `.ch8`
   oder `.chr`.
3. Wählen Sie ein Zeichen und bearbeiten Sie es. Breiten von 4, 6 und 8 Pixeln
   stehen zur Wahl, aber Verschmälern verwirft die rechten Spalten endgültig –
   arbeiten Sie sich also von schmal nach breit vor, wenn Sie experimentieren.
4. Geben Sie der Schrift einen Namen, um sie in Ihre Bibliothek aufzunehmen.
5. Wählen Sie das Werkzeug **Text**. Ihre Schrift erscheint in der Liste neben
   der ROM-Schrift. Tippen Sie, platzieren Sie den Text und skalieren oder
   drehen Sie ihn vor dem Absetzen – er wird dabei aus den Zeichen neu
   gezeichnet und bleibt in jeder Größe scharf.

### Eine Karte aus Kacheln bauen

1. Zeichnen Sie die Zellen, die Sie als Kacheln verwenden wollen, auf die
   Zeichenfläche.
2. **Datei > Karteneditor**, und übernehmen Sie sie in den Kachelsatz.
3. Legen Sie die Kartengröße fest und malen Sie. Die linke Taste setzt eine
   Kachel, die rechte radiert, und das Füllen ersetzt einen zusammenhängenden
   Bereich gleicher Kacheln.
4. Exportieren Sie als `.zxtm`, um weiterzuarbeiten, oder als Assembler, C oder
   Rohdaten zur Verwendung in einem Programm.

### Für den ZX Spectrum Next zeichnen

1. Wählen Sie im Menü Bild einen Next-Modus – Layer 2 mit 256, 320 oder 640
   Pixeln Breite oder einen der LoRes-Modi.
2. In diesen Modi gibt es keinen Attributkonflikt; jedes Pixel trägt seinen
   eigenen Palettenindex. Sie verwalten stattdessen eine Palette von 256
   Neun-Bit-Farben, bearbeitet über **Bild > Palette bearbeiten** und
   gespeichert als `.pal` oder `.npl`.
3. Speichern Sie das Bild als `.nxi`, das die Palette enthält, oder als `.sl2`
   für die reine Bitmap.
4. Für Sprites nutzen Sie **Datei > Sprite-Editor** und speichern den Satz als
   `.spr`.

Sie können ein klassisches Bild in einen Next-Modus umwandeln und wieder
zurück. Der Rückweg bedeutet, jede Zelle erneut auf zwei Farben zu bringen,
rechnen Sie in dieser Richtung also mit Detailverlust; PixULA sagt es Ihnen,
bevor es passiert.

### Ein Bild auf echte Hardware bringen

- **Für einen Emulator** speichern Sie eine `.scr`. Das ist der rohe Inhalt des
  Spectrum-Bildschirmspeichers, und jeder Emulator liest ihn. Die genaue Größe
  hängt vom Bildschirmmodus ab – die Tabelle im Kapitel Bildschirmmodi nennt
  sie für jeden.
- **Für einen echten Rechner** speichern Sie eine `.tap` oder `.tzx`. Um Ihren
  Bildschirm zu einem Band mit anderen Dateien hinzuzufügen, verwenden Sie
  **Datei > Bandblöcke**.
- **Um es jemandem ohne Spectrum zu zeigen**, speichern Sie eine `.png`.
  Verwendet das Bild blinkende Zellen, speichern Sie eine `.gif` und kreuzen
  **BLINKEN-Zellen animieren** an – das schreibt eine Schleife aus zwei Bildern
  im Takt der Hardware, sodass das Blinken erhalten bleibt.
