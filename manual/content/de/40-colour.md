## Farbe

In den klassischen Modi wählen Sie keine Farbe für ein Pixel. Sie wählen die
zwei Farben, die eine ganze Zelle benutzt, dazu zwei Schalter.

- **TINTE** ist die Farbe der gesetzten Punkte.
- **PAPIER** ist die Farbe der nicht gesetzten Punkte.
- **HELL** hebt beide auf ihre hellere Variante an. Es gibt einen
  Hell-Schalter pro Zelle, also sind Tinte und Papier entweder beide hell oder
  keines von beiden.
- **BLINKEN** tauscht auf echter Hardware etwa zweimal pro Sekunde Tinte und
  Papier.

Die linke Maustaste zeichnet mit Tinte. Die rechte zeichnet mit Papier: Sie
löscht den Punkt und setzt dieselben vier Werte, die die linke Taste setzen
würde. Bei einem Stift tut die Seitentaste dasselbe wie die rechte Maustaste.

Der **Radierer** macht etwas anderes als beide. Er löscht Punkte und lässt die
Farben der Zelle unverändert, selbst wenn er den letzten Punkt der Zelle
löscht. Um auch die Farben zu entfernen, radieren Sie mit einem neuen Strich
noch einmal über die leere Zelle: Tinte, Papier, Hell und Blinken kehren zu
Schwarz auf Weiß zurück, und auf einer oberen Ebene wird die Zelle wieder
durchsichtig. Eine Zelle, die noch Punkte enthält, behält ihre Farben, egal wie
oft Sie darüber radieren.

### Zeichenmodi

Der Zeichenmodus ändert, was ein Strich bewirkt. Er bleibt über Sitzungen hinweg
erhalten, daher zeigt die Statusleiste ihn an, sobald er etwas anderes als
Normal ist – in manchen dieser Modi hinterlässt ein Strich nichts Sichtbares,
und sonst hätten Sie keine Möglichkeit zu erkennen, warum.

{{draw-modes}}

Der Pinsel in all seinen Formen, Füllen, die Formen, die Bézierkurve, Text,
Stempel aus dem Bereich **Stempel** und die linke Taste des Verlaufs folgen dem
Zeichenmodus. Der Radierer, die Pipette, das Verschieben, Einfügen und Löschen
einer Auswahl, der Bereich **Transformieren**, die Option **Nur Attribute
füllen** und die Tasten Tauschen und Umfärben beachten ihn nicht.

**Tinte umfärben ist nicht dasselbe wie Umfärben.** Tinte umfärben und Papier
umfärben sind Zeichenmodi und färben jede Zelle um, die das aktuelle Werkzeug
berührt – bei einem kleinen Pinsel wenige Zellen, bei einem gefüllten Rechteck
jede Zelle, die es bedeckt –, und Spiegeln gilt mit. **Umfärben** gleich hinter
dem Trennstrich färbt die ganze Zelle unter dem Zeiger um, egal welches Werkzeug
gewählt ist, ohne Rücksicht auf Pinselgröße und Spiegeln. **Tauschen** daneben
arbeitet genauso und vertauscht Tinte und Papier jeder Zelle. Beide bleiben an,
bis Sie erneut darauf klicken oder ein Werkzeug oder einen Zeichenmodus wählen,
und solange eines an ist, zeigt die Statusleiste es an.

**XOR / Über und XOR / Jeder Durchgang** kehren Punkte um, statt sie zu setzen,
und geben der Zelle beide die gewählten Farben. XOR / Über kehrt jeden Punkt
einmal pro Strich um; wer im selben Strich über die eigene Linie zurückfährt,
ändert also nichts weiter. XOR / Jeder Durchgang kehrt einen Punkt jedes Mal um,
wenn der Strich über ihn hinweggeht: Ein Zug des Pinsels ist ein Durchgang, wie
sehr sich der Pinsel unterwegs auch selbst überlappt, aber ein Strich, der einen
Punkt verlässt und zurückkommt, kehrt ihn erneut um – eine Acht hebt sich also
dort auf, wo sie sich kreuzt. Formen, Kurven, Füllungen und Text sind immer ein
einziger Durchgang, damit liefern beide Modi dort dasselbe Ergebnis.

### Paletten

Zwei Modusfamilien erlauben es, die Farben selbst zu ändern. ULAplus bietet 64
Farbregister, angeordnet als vier Paletten zu je sechzehn. Die Next-Modi bieten
256 Farben mit je neun Bit.

Paletten sind Dateien. Sie können eine erstellen, speichern und in ein anderes
Bild laden – über **Datei > Palette laden** und **Datei > Palette speichern**
oder aus dem Paletteneditor. Zum Laden müssen Sie den Editor nicht öffnen, denn
eine Palette lädt man meist, bevor man zu zeichnen beginnt.

Wo ein Dateiformat Platz für eine Palette hat – `.scr` mit 6976 Bytes, `.nxi`,
die Timex-Variante –, reist die Palette auch im Bild mit.

### GigaScreen

GigaScreen hält zwei vollständige Bildschirme und zeigt sie abwechselnd,
fünfzigmal pro Sekunde. Ihr Auge mischt die beiden Farben jedes Pixels zu
einer, sodass eine Zelle mit je einer Tinte und einem Papier pro Bildschirm
**vier** Farben zeigen kann und das Bild insgesamt rund hundert erreicht.

Sie zeichnen nie auf nur einem Bildschirm. Jeder Strich schreibt beide, und die
Farbleiste arbeitet paarweise:

- **Bildschirm A** und **Bildschirm B** haben jeweils eigene Tinten- und
  Papierfelder und ein eigenes **HELL**. Blinken ist eine gemeinsame
  Einstellung für beide.
- **Malen** zeigt die vier Farben, die sich aus dieser Wahl ergeben, genau so
  gemischt, wie die Zeichenfläche sie zeigt: Tinte auf beiden Bildschirmen,
  Tinte nur auf A, Tinte nur auf B und Papier auf beiden. Wählen Sie eine, und
  die linke Taste malt mit ihr. Die rechte Taste malt immer Papier auf beiden
  Bildschirmen.
- Wählen Sie für beide Bildschirme dieselbe Tinte, und das Feld oben links
  unter Malen ist genau diese Farbe, ungemischt – so zeichnen Sie alles, was
  nicht gemischt aussehen soll.

Die Pipette nimmt all das wieder auf: die Farben beider Bildschirme und welche
der vier das Pixel zeigt.

Die Anzeigeschaltflächen ändern nur, was die Zeichenfläche zeigt, nie, wohin
ein Strich geht. **Mittel** ist das, was das Auge am echten Rechner sieht.
**Flimmern** tauscht die beiden Bildschirme in jedem Bild, wie die Hardware es
tut. **A** und **B** zeigen einen Bildschirm allein. Ein Bild, das Sie als PNG
speichern oder exportieren, verwendet Mittel, wenn Flimmern angezeigt wird,
denn ein Standbild kann nicht flimmern.

Beim Wechsel zu GigaScreen wird Ihr Bild auf beide Bildschirme kopiert, sodass
es aussieht wie vorher. Beim Verlassen bleibt Bildschirm A erhalten und
Bildschirm B entfällt; enthält Bildschirm B etwas anderes, werden Sie vorher
gewarnt.

Dieselbe Arbeitsweise gilt für zwei weitere Flimmermodi:

- **MultiGigaScreen 8×4, 8×2 und 8×1** legen die beiden Bildschirme auf die
  feineren Multicolor-Zellen, sodass die vier Farben je 4, 2 oder eine Zeile
  gelten statt je 8×8-Block. Das sind die Dateien `.mg4`, `.mg2` und `.mg1`
  von MultiArtist.
- **Timex Hi-Res GigaScreen** wechselt zwei hochauflösende Bildschirme mit
  512×192 ab. Hi-Res hat keine Zellfarben – jeder Bildschirm hat ein
  Farbschema für das ganze Bild –, also zeigt die Leiste eine Schemazeile für
  Bildschirm A und eine für Bildschirm B, und Malen zeigt die vier Mischungen
  der beiden. Das sind `.hrg`-Dateien.

Ein Wechsel zwischen den Zwei-Bildschirm-Modi behält beide Bildschirme, nach
denselben Regeln, nach denen ein einzelner Bildschirm umgewandelt wird.
