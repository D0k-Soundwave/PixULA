## Attributkonflikt

Der Spectrum speichert ein Bild in zwei getrennten Teilen.

Der erste ist eine Bitmap: 256 × 192 Punkte, jeder ein Bit, an oder aus. Der
zweite ist ein Farbraster mit einem Byte für jeden 8×8-Block dieser Punkte –
32 Bytes breit und 24 hoch. Jedes dieser Bytes legt fest, welche Farbe die
**Tinte** haben soll (die gesetzten Punkte), welche Farbe das **Papier** haben
soll (die nicht gesetzten Punkte), ob das Paar **hell** ist und ob es
**blinken** soll.

Die Form Ihres Bildes hat also eine Auflösung von 256 × 192, seine Farbe aber
nur 32 × 24. Jede 8×8-Zelle kann zwei Farben zeigen, und jeder Punkt darin hat
die eine oder die andere.

![Zwei diagonale Linien kreuzen sich auf einer vergrößerten Zeichenfläche mit eingeblendetem Zellraster. Die blaue Linie wird in jeder Zelle rot, durch die auch die rote Linie läuft](img/attribute-clash.png)

*Eine blaue und eine rote Linie kreuzen sich, bei 800 % mit Zellraster. Wo die
rote Linie durch eine Zelle läuft, ist auch die blaue Linie in dieser Zelle
rot. Der rote Strich kam als zweiter und hat die Tintenfarbe für die ganze
Zelle gesetzt, auch für die Punkte, die der blaue Strich schon gesetzt hatte.*

Genau das bedeutet „Attributkonflikt“ (englisch *attribute clash*). Wer in einem
Teil einer Zelle zeichnet, ändert die Farbe von allem anderen darin, und keine
Einstellung schaltet das ab – so funktioniert die Hardware.

### Damit arbeiten

Die meisten Spectrum-Grafiker planen ihre Farbflächen vor den Details und legen
das Bild so an, dass Farbgrenzen auf Zellgrenzen fallen. Braucht eine Zelle
einen Ton, den sie nicht darstellen kann, wird gerastert: zwei Farben so fein
verschränkt, dass das Auge sie mischt.

PixULA hilft dabei auf dreierlei Weise.

**Das Zellraster.** Schalten Sie es neben den Zoom-Reglern ein, und Sie sehen
genau, wo ein Farbwechsel nichts kostet und wo er Sie etwas kostet.

**Zeichenmodi.** Ein Strich muss nicht Punkte und Farben zugleich ändern. Sie
können Punkte setzen und die Farben in Ruhe lassen oder eine Zelle umfärben,
ohne einen Punkt zu berühren. Das Kapitel über Farbe listet sie auf.

**Die Musterbibliothek.** Ihr Kern ist eine Reihe von Kacheln mit gemessener
Tintendichte – das, wozu Sie greifen, wenn eine Zelle ein Grau braucht, das sie
nicht darstellen kann.

### Die Punkte sehen

Drei Schalter im Menü Ansicht ändern, was der Bildschirm zeigt, ohne das Bild zu
ändern. **Farben aus** zeigt die Punkte schwarz auf weiß, sodass Sie sehen,
welche Punkte wirklich gesetzt sind. **Farbraster** tut dasselbe und färbt die
Zellen zusätzlich wie ein Schachbrett, damit die Zellgrenzen gut zu erkennen
sind; es und Farben aus schalten sich gegenseitig aus. **Blinken stoppen** hält
jede blinkende Zelle in ihren normalen Farben. Keiner der Schalter berührt das
Bild, Rückgängig oder einen Export: Ein gespeichertes Bild sieht gleich aus, ob
sie an oder aus sind. Der Browser merkt sie sich, und ein Schalter, der im
aktuellen Bildschirmmodus nicht wirken kann, ist grau – fahren Sie mit der Maus
darüber, um den Grund zu sehen. Bei GigaScreen und MultiGiga zeigt Farben aus
vier Graustufen: weiß, wo keiner der beiden Bildschirme einen Punkt hat,
hellgrau bei einem Punkt nur auf Bildschirm A, dunkleres Grau nur auf Bildschirm
B und schwarz bei beiden.

### Die Zeigeranzeige lesen

Der Streifen unter dem Bild und die Statusleiste sagen, wo der Zeiger ist. In
den **Einstellungen** ergänzt *Die Zeigeranzeige zeigt* das Attribut unter dem
Zeiger (seine Zahl dezimal und hexadezimal, dann Tinte, Papier, hell und
blinken; in ULAplus die CLUT; in GigaScreen beide Bildschirme) und die
Speicheradresse des Pixel-Bytes und seines Attribut-Bytes. Adressen gibt es
dort, wo die echte Maschine ein festes Layout hat: Standard-ULA und ULAplus
(Bilddatei ab $4000, Attribute ab $5800), Timex-Hi-Colour (Attribute in der
zweiten Bilddatei ab $6000), Timex-Hi-Res (gerade Byte-Spalten ab $4000,
ungerade ab $6000) und GigaScreen (Bildschirm A wie üblich, Bildschirm B in Bank
7 ab $C000; welcher Bildschirm zu welcher Bank gehört, ist eine Konvention).
Andere Modi sagen, dass sie keine Adresse haben.

*Y wird gezählt von* lässt sich auf unten stellen, sodass die Anzeige wie BASIC
PLOT liest: 0,0 ist die linke untere Ecke, Y läuft von 0 bis 175. Das gibt es
nur über den oberen 176 Zeilen eines 256-mal-192-Bildes; darunter und auf
anderen Bildschirmen zeigt die Anzeige einen Strich. Es ändert nur die Anzeige.

**Eigenes Raster...** im Menü Ansicht zeichnet ein Raster mit beliebigem X- und
Y-Schritt, getrennt einstellbar, und **Eigenes Raster anzeigen** schaltet es ein
und aus. Linien, die auf dem Bildschirm näher als vier Pixel beieinander liegen,
entfallen, bis Sie hineinzoomen. Die eingeschalteten Raster kommen beim nächsten
Start wieder. In den Einstellungen legt *Rasterfarben* die Farbe jedes Rasters
fest; bleibt *Farbe des Designs* angehakt, folgt das Raster dem Design.

### Wo andere Regeln gelten

Spätere Hardware hat die Beschränkung auf verschiedene Weise gelockert, und
PixULA beherrscht all diese Varianten. Timex-Rechner machten das Farbraster
feiner. ULAplus ersetzte die festen sechzehn Farben durch eine Palette nach
Wahl. GigaScreen wechselt zwei Bilder so schnell ab, dass Farben entstehen, die
keines der beiden enthält. Der ZX Spectrum Next verzichtet in seinen Modi
Layer 2 und LoRes ganz auf dieses Schema: Dort trägt jedes Pixel seine eigene
Farbe.

Sie können ein Bild zwischen all diesen Modi verschieben – siehe nächstes
Kapitel.
