## Die Editoren

Vier Dinge, die PixULA erstellt, sind keine Bilder, und jedes hat im Menü Datei
ein eigenes Fenster.

### Der Zeichensatz-Editor

Ein Spectrum-Zeichensatz umfasst 96 oder 256 Zeichen, jedes als Stapel von
Zeilenbytes gespeichert. Hier bearbeiten Sie sie Zeichen für Zeichen.

![Der Zeichensatz-Editor, mit dem Zeichenraster auf der einen Seite und einem einzelnen Zeichen in Bearbeitung auf der anderen](img/dialog-font-editor.png)

*Wählen Sie links ein Zeichen aus dem Raster und bearbeiten Sie es rechts.*

Zeichen können 4, 6 oder 8 Pixel breit sein, bei Zellenhöhe. Beim Verschmälern
einer Schrift gehen die rechten Spalten endgültig verloren; wenn Sie Breiten
ausprobieren, arbeiten Sie also von schmal nach breit.

Sie können mit der ZX-ROM-Schrift beginnen, ein Zeichen von der Zeichenfläche
übernehmen oder einen Zeichensatz `.ch4`, `.ch6`, `.ch8`, `.chr` oder `.chx`
aus einem anderen Spectrum-Werkzeug laden. Wenn Sie einer Schrift einen Namen
geben, kommt sie in Ihre Bibliothek, und das Textwerkzeug bietet sie dann neben
der eingebauten ROM-Schrift an.

### Der Karteneditor

Eine Karte ist ein Raster aus Kacheln, wobei eine Kachel eine 8×8-Zelle ist –
acht Bitmap-Bytes und ein Attributbyte. Mit Karten bauen Sie Spielfelder, die
größer als ein einzelner Bildschirm sind.

![Der Karteneditor mit der Kachelpalette und einem scrollbaren Kartenbereich](img/dialog-map-editor.png)

*Links die Kacheln, rechts die Karte.*

Malen Sie mit der linken Taste und radieren Sie mit der rechten, oder ersetzen
Sie mit dem Füllen einen zusammenhängenden Bereich gleicher Kacheln. Kacheln
stammen aus dem aktuellen Muster und den aktuellen Farben oder direkt von der
Zeichenfläche. Sie können eine Karte zurück auf die Zeichenfläche übertragen,
und ein einziges Rückgängig macht das Ganze rückgängig.

Speichern Sie als `.zxtm`, um weiterzuarbeiten – das ist PixULAs eigenes Format
und bewahrt alles –, oder als `.zxm` oder als Assembler, C oder Rohdaten zum
Einbinden in ein Programm.

### Der Sprite-Editor

Next-Sprites sind 16 × 16 Pixel groß, mit einem Palettenindex pro Pixel, und
ein Satz fasst bis zu 64 davon.

![Der Sprite-Editor mit einem Sprite-Satz und dem Bearbeitungsraster](img/dialog-sprite-editor.png)

*Auf der einen Seite der Satz, auf der anderen das Sprite, das Sie zeichnen.*

Sprite-Sätze werden in `.spr`-Dateien gespeichert, nicht in Ihrem Bild; sichern
Sie den Satz also separat. In den indizierten Modi können Sie ein Sprite von
der Zeichenfläche übernehmen und eines darauf stempeln.

### Der Paletteneditor

**Bild > Palette bearbeiten**, in den Modi mit bearbeitbarer Palette. Er zeigt
ULAplus als vier Paletten zu sechzehn Farben und die Next-Palette als Reihen von
Neun-Bit-Farben. Jede gewählte Farbe wird auf den nächsten Wert gerundet, den
die Hardware tatsächlich speichern kann – was Sie sehen, zeigt also auch der
Rechner.

Jede Änderung ist ein eigener Rückgängig-Schritt. Paletten lassen sich auch
laden und speichern, ohne dieses Fenster zu öffnen – siehe das Kapitel über
Farbe.

### Bandblöcke

**Datei > Bandblöcke** öffnet eine `.tap` oder `.tzx` und listet ihren Inhalt
auf. Damit laden Sie einen Bildschirm aus einem Band mit mehreren oder fügen Ihr
aktuelles Bild als neuen Block zu einem Band hinzu und speichern das Band
wieder.

Blöcke, die Sie nicht angefasst haben, werden Byte für Byte zurückgeschrieben;
fügen Sie also einen Bildschirm zum Band eines anderen hinzu, bleibt der Rest
genau so, wie er war.
