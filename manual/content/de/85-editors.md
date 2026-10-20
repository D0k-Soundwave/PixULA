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

**Große Schriften.** Neue große Schrift... erstellt einen großen CHX-Zeichensatz, wie ihn ZX-Editor Second Edition verwendet: Jedes Zeichen ist 8, 16, 24 oder 32 Pixel breit und hoch (Breite und Höhe werden getrennt gewählt), und der Editor zeigt die Größe anstelle der Breitenliste. Mit Mit einer Schrift füllen wählen Sie eine beliebige Schrift aus derselben Liste wie im Textwerkzeug, wie viel der Zeichenhöhe die Buchstaben einnehmen (in Prozent) und ob sie links, mittig oder rechts sitzen. Mit Proportional wird jeder Buchstabe nur so breit gespeichert, wie er sein muss, in ganzen 8-Pixel-Spalten, sodass ein i weniger Platz braucht als ein W; das Leerzeichen behält immer mindestens eine Spalte. Aus Schrift füllen... macht dasselbe in einem Schritt mit einer großen Schrift, die Sie schon haben. Eine große Schrift lässt sich nur als `.chx` speichern (die anderen Formate sowie die Assembler-, C- und Binärlisten enthalten 8×8-Zeichen), kann keine Zelle von der Zeichenfläche übernehmen. Das Textwerkzeug und Auf die Leinwand tippen verwenden sie wie jede gespeicherte Schrift, jeden Buchstaben so breit, wie er gespeichert ist. Beim Öffnen einer großen `.chx` behält jedes Zeichen seine eigene Größe, und ein Zeichen, das die Datei auslässt, bleibt beim erneuten Speichern ausgelassen. Wie ein Zeichen aus mehreren 8×8-Blöcken in der Datei angeordnet ist, folgt der veröffentlichten Beschreibung des Formats und wurde nicht an einer von ZX Paintbrush selbst gespeicherten Datei geprüft; öffnen Sie eine hier erstellte große Schrift daher in ZX Paintbrush, bevor Sie sich darauf verlassen.

**Schattierung und Rückgängig.** Bei einer Schrift, deren Zeichen eine ganze Zahl von 8-Pixel-Spalten breit sind, schattieren oder befreien die vier Schaltflächen für die Schattierung jeweils eine Spalte links oder rechts des bearbeiteten Zeichens. Eine schattierte Spalte wird schraffiert gezeichnet und nicht gespeichert: Eine `.chx`-Datei enthält dieses Zeichen schmaler, und ein ganz schattiertes Zeichen fehlt in der Datei. Die Tintenpixel unter der Schattierung bleiben im Editor erhalten, sodass sie beim Freigeben zurückkommen, stehen aber nicht in der Datei. Alle passend schattieren macht das für alle Zeichen auf einmal: Es schattiert die leeren Spalten beiderseits seiner Tintenpixel, lässt dem Leerzeichen eine Spalte und lässt andere leere Zeichen aus. Das Leerzeichen behält immer mindestens eine Spalte, weil eine `.chx`-Datei es enthalten muss. Nach einem `.chx`-Export nennt die Statuszeile, wie viele Zeichen schmaler gespeichert, wie viele ausgelassen wurden und bei wie vielen Tintenpixel unter der Schattierung lagen. Der Zeichensatz-Editor hat außerdem Rückgängig und Wiederholen (die beiden Schaltflächen oder Strg+Z und Strg+Y): Ein Strich auf der Bearbeitungsfläche ist ein Schritt, ebenso jede Schaltfläche, Neue große Schrift, Aus Schrift füllen, ROM-Schrift laden oder ein Import. Das Tippen im Namensfeld gehört nicht dazu.

**Alle Zeichen.** Die Schaltfläche Alle Zeichen ersetzt den Ein-Zeichen-Editor durch eine Karte der ganzen Schrift, alle Zeichen nebeneinander, 16 pro Zeile, auf der Sie mit demselben Pinsel, Radierer, Linie und Füllen zeichnen, sodass ein Strich von einem Zeichen ins nächste laufen kann. Ein Strich ist eine Änderung und ein Rückgängig-Schritt, und Füllen bleibt innerhalb des angeklickten Zeichens. Das Werkzeug Schattieren schattiert oder befreit die angeklickte 8-Pixel-Spalte, vom näheren Rand ihres Zeichens aus; schattierte Spalten sind schraffiert. Das Werkzeug Verschieben zieht die Karte umher, so scrollen Sie sie mit dem Finger, denn die Karte behält sonst jede Berührung zum Zeichnen. Die Schaltflächen Minus, Einpassen und Plus ändern den Zoom in ganzen Schritten. In der Karte und im Zeichenraster bewegen Pfeiltasten, Pos1 und Ende von Zeichen zu Zeichen, und das Tippen eines Zeichens wählt es aus. Pixel allein mit der Tastatur zu zeichnen ist nicht möglich.

**Attribute.** Ein Zeichen einer `.chx`-Datei kann eigene Attribute haben: Jeder seiner 8-mal-8-Blöcke hat Tinte, Papier, Helligkeit und Blinken, und der Editor zeichnet jeden Block darin - im Zeichenraster, auf der Bearbeitungsfläche und in der Karte Alle Zeichen (eine kleine Ecke auf der Bearbeitungsfläche zeigt Blinken). Wählen Sie das Werkzeug Attribute und klicken Sie auf einen Block, um ihm Tinte, Papier, Helligkeit und Blinken der Attributleiste zu geben. Eine `.chx`-Datei gibt einem ganzen Zeichen Attribute, daher gibt der erste Klick auf ein Zeichen ohne Attribute sie allen seinen Blöcken; danach ändert jeder Klick einen Block. Alle Blöcke gibt dem ganzen Zeichen die Attribute der Leiste, und Attribute entfernen nimmt sie wieder weg, sodass das Textwerkzeug für dieses Zeichen die Attributleiste nimmt. Jeder Klick und jede Schaltfläche ist ein Rückgängig-Schritt. Attribute brauchen eine Schrift, deren Breite eine ganze Zahl von 8-Pixel-Spalten ist, und eine Attributleiste mit Tinte und Papier; in Timex hi-res, Layer 2 und LoRes sagt das Werkzeug, warum es nicht geht. Beim Öffnen einer `.chx` bleibt das Attributbyte jedes Blocks erhalten, und Speichern schreibt es zurück; ein Zeichen ohne Attribute wird genau wie bisher gespeichert. Die anderen Formate und die Assembler-, C- und Binärlisten enthalten keine Attribute, und nach einem solchen Export sagt die Statuszeile, wie viele Zeichen ihre verloren haben. Wie bei großen Schriften folgt dieser Aufbau der veröffentlichten Beschreibung des Formats und wurde nicht an einer farbigen Datei geprüft, die ZX Paintbrush gespeichert hat.

### Der Karteneditor

Eine Karte ist ein Raster aus Kacheln, wobei eine Kachel eine 8×8-Zelle ist –
acht Bitmap-Bytes und ein Attributbyte. Mit Karten bauen Sie Spielfelder, die
größer als ein einzelner Bildschirm sind.

![Der Karteneditor mit der Kachelpalette und einem scrollbaren Kartenbereich](img/dialog-map-editor.png)

*Links die Kacheln, rechts die Karte.*

Malen Sie mit der linken Taste und radieren Sie mit der rechten, oder ersetzen
Sie mit dem Füllen einen zusammenhängenden Bereich gleicher Kacheln. Kacheln
stammen aus dem aktuellen Muster und den aktuellen Attributen oder direkt von der
Zeichenfläche.

Speichern Sie als `.zxtm`, um weiterzuarbeiten – das ist PixULAs eigenes Format
und bewahrt alles –, oder als `.zxm` oder als Assembler, C oder Rohdaten zum
Einbinden in ein Programm.

### Kartenelemente

**Wiederkehrende Teile finden.** Wählen Sie einen Bildblock (ganze Zellen; eine Auswahl wird zuerst an Zellen angepasst) und wählen Sie Bearbeiten > Kartenelement suchen oder drücken Sie wie in ZX Paintbrush Strg+F. Das Fenster Kartenelemente öffnet sich, und jede Stelle, an der der Block vorkommt, wird im Bild umrandet; Zurück und Weiter gehen sie durch und rollen das Bild zu jeder. Die Liste **Vergleich** sagt, was „gleich“ heißt: Pixel und Attribute (Pixel und Attributbytes sind gleich), Nur Pixel (Attribute werden ignoriert) oder Sieht gleich aus (die Zellen würden in beiden Blinkphasen dieselben Farben zeigen - eine leere Zelle passt zu jeder leeren Zelle desselben Papiers, und eine Zelle mit invertierten Pixeln und vertauschter Tinte und Papier passt zum Original; bei GigaScreen und dem Timex-Paar wird jeder Bildschirm für sich verglichen). Timex hi-res hat keine Zellattribute und bietet deshalb nur die letzten beiden. Stellen, die sich überlappen, und Stellen, die ein früheres Element schon bedeckt, bleiben weg, und die Zahl sagt, wie viele. **Übernehmen** speichert das Element mit der Karte und bedeckt seine Stellen mit nummerierten Feldern. Übernehmen ändert das Bild nie und ist kein Rückgängig-Schritt - Strg+Z lässt das Element in Ruhe; löschen Sie es im Fenster. Das Suchen funktioniert, wo Zellen 8 mal 8 mit Attributen sind: Standard, ULAplus, ULANext, GigaScreen und Timex hi-res; sonst sagt es, warum nicht. Strg+F öffnet beim Arbeiten am Bild nicht mehr die eigene Suche des Browsers (das Browsermenü schon). **Die Liste.** Das Fenster Kartenelemente führt jedes Element mit Zeigen (umrandet seine Stellen und wählt jedes Mal die nächste aus) und Löschen (fragt vorher; das Bild bleibt unverändert). **Umschalt+M** oder Ansicht > Bilder der Kartenelemente tauscht die nummerierten Felder gegen das eigene Bild jedes Elements, in den Farben, die das Bild zeigt (ein GigaScreen-Paar wird gemischt). Auf eine bedeckte Stelle können Sie weiter zeichnen; die Striche bleiben unter der Abdeckung verborgen, bis das Element gelöscht ist. Neu, Öffnen und Neues Bild aus Auswahl fragen, bevor Elemente verworfen werden. **In Dateien.** Elemente werden mit der Karte (`.zxtm`), mit einem Projekt (`.pixula`) und mit der automatischen Sicherung gespeichert. Datei > Bild speichern unter > ZXM schreibt das Bild zusammen mit seinen Elementen, wie ZX Paintbrush (nur Standard ULA; Elemente aus einem anderen Bildschirmmodus bleiben mit einem Hinweis weg), und Datei > Öffnen einer `.zxm` bringt beides zurück. Die `.zxm` des Karteneditors enthält weiterhin nur seine Kachelkarte. Eine Suche kann nicht auf einem Block beginnen, den ein früheres Element schon bedeckt: ein Hinweis nennt dieses Element, und wenn Sie es löschen, wird der Block frei. Strg+Z nach dem Öffnen eines Bildes oder nach Neues Bild aus Auswahl bringt das alte Bild mitsamt seinen Elementen zurück.

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
