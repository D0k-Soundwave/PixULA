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
