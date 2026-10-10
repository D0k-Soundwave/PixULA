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
Die Option **Farben** des Radierers, in Bildschirmmodi mit Zellfarben sichtbar,
ändert das: Auf aktuelle setzen löscht die Punkte und gibt der Zelle die Farben
der Farbleiste, wie das Wischwerkzeug von ZX Paintbrush, und Behalten, die
Vorgabe, ist das Verhalten von oben.

Jeder der vier Teile lässt sich auch auf **vorhanden verwenden** stellen - das
karierte Kästchen darunter in der Farbleiste. Ein Strich lässt diesen Teil jeder
Zelle dann, wie er ist, statt Ihre Einstellung zu schreiben. Stellen Sie TINTE,
PAPIER und HELL auf vorhanden und schalten Sie BLINKEN ein, dann lässt **Nur
Attribute füllen** des Füllwerkzeugs eine ganze Fläche blinken, ohne eine Farbe
zu ändern. Umschalt+B und Umschalt+F schalten HELL und BLINKEN um, Umschalt+T
stellt alle vier auf vorhanden. In ULAplus wählen HELL und BLINKEN die CLUT,
daher hat die CLUT-Auswahl ein einziges Kästchen, das die CLUT jeder Zelle
behält.

### Zeichenmodi

Der Zeichenmodus ändert, was ein Strich bewirkt. Er bleibt über Sitzungen hinweg
erhalten, daher zeigt die Statusleiste ihn an, sobald er etwas anderes als
Normal ist – in manchen dieser Modi hinterlässt ein Strich nichts Sichtbares,
und sonst hätten Sie keine Möglichkeit zu erkennen, warum.

Die obere Leiste hat drei Schaltflächen: **Zeichenmodus**, **Zellwerkzeug** und
**Spiegeln**. Jede zeigt die gerade gültige Wahl. Ein Klick darauf öffnet
darunter ein kleines Raster der anderen Möglichkeiten; ein Klick auf eine
schließt es. Mit Escape oder einem Klick woanders schließen Sie es, ohne etwas
zu ändern. Zeichenmodus und Spiegeln wirken zusammen: Stellen Sie XOR und
Horizontal ein, ist ein Strich ein gespiegelter XOR-Strich. Das Zellwerkzeug
übernimmt, wenn eines an ist, jeden Strich.

{{draw-modes}}

Der Pinsel in all seinen Formen, Füllen, die Formen, die Bézierkurve, Text,
Stempel aus dem Bereich **Stempel** und die linke Taste des Verlaufs folgen dem
Zeichenmodus. Der Radierer, die Pipette, das Verschieben, Einfügen und Löschen
einer Auswahl, der Bereich **Transformieren**, die Option **Nur Attribute
füllen** und die Tasten Tauschen und Umfärben beachten ihn nicht.

**Tinte umfärben ist nicht dasselbe wie Umfärben.** Tinte umfärben und Papier
umfärben sind Zeichenmodi: Sie färben jede Zelle um, die das aktuelle Werkzeug
berührt - einige Zellen bei einem kleinen Pinsel, jede Zelle, die ein gefülltes
Rechteck bedeckt - und Spiegeln gilt. **Umfärben** in der Schaltfläche
Zellwerkzeug färbt die ganze Zelle unter dem Zeiger um, welches Werkzeug auch
gewählt ist, unabhängig von Pinselgröße und Spiegeln. **Tauschen** aus derselben
Schaltfläche funktioniert genauso und vertauscht Tinte und Papier jeder Zelle.
Beides bleibt an, bis Sie es ausschalten - wählen Sie Keines, wählen Sie es
erneut, klicken Sie mit rechts auf die Zeichenfläche oder wählen Sie ein
Werkzeug oder einen Zeichenmodus - und die Statusleiste sagt es, solange es an
ist.

**Farben kopieren, Punkte invertieren und Punkte und Farben invertieren** sind
drei weitere Zellwerkzeuge in derselben Schaltfläche Zellwerkzeug und
funktionieren genauso: eines wählen, dann über Zellen klicken oder ziehen. Jedes
Ziehen wird in einem Schritt rückgängig gemacht, und das Werkzeug bleibt an, bis
Sie es ausschalten. **Farben kopieren** nimmt die Farben auf, die die Zelle
unter Ihrem ersten Klick zeigt, und gibt sie jeder Zelle, über die Sie ziehen;
die Farbleiste ändert sich nicht. **Punkte invertieren** löscht die gesetzten
Punkte jeder ganzen Zelle und setzt die gelöschten und lässt die Farben (eine
leere Zelle wird gefüllt). **Punkte und Farben invertieren** tauscht zusätzlich
Tinte und Papier, sodass jede Zelle gleich aussieht; es dient zum Aufräumen
eines importierten Bildes, überspringt Zellen, in denen auch eine andere Ebene
zeichnet, und wird in ULAplus und ULANext nicht angeboten. Ein Zellwerkzeug wird
nur in den Bildschirmmodi angeboten, in denen es funktionieren kann: Die
Schaltfläche Zellwerkzeug listet nur die passenden auf (und ist ausgeblendet, wo
keines passt), und Punkte invertieren funktioniert auch in Timex Hi-Res, wo die
Punkte in 8-mal-8-Zellen liegen.

**XOR / Über und XOR / Jeder Durchgang** kehren Punkte um, statt sie zu setzen,
und geben der Zelle beide die gewählten Farben. XOR / Über kehrt jeden Punkt
einmal pro Strich um; wer im selben Strich über die eigene Linie zurückfährt,
ändert also nichts weiter. XOR / Jeder Durchgang kehrt einen Punkt jedes Mal um,
wenn der Strich über ihn hinweggeht: Ein Zug des Pinsels ist ein Durchgang, wie
sehr sich der Pinsel unterwegs auch selbst überlappt, aber ein Strich, der einen
Punkt verlässt und zurückkommt, kehrt ihn erneut um – eine Acht hebt sich also
dort auf, wo sie sich kreuzt. Formen, Kurven, Füllungen und Text sind immer ein
einziger Durchgang, damit liefern beide Modi dort dasselbe Ergebnis.

**Invers** vertauscht, was die beiden Maustasten tun: Die linke Taste löscht
Punkte, die rechte setzt sie, wie INVERSE 1 in BASIC. Sie wird in den Einstellungen eingeschaltet, oder mit Shift+I, und die Statusleiste sagt „Invers
ist an“, solange es an ist. In Tinte umfärben, Papier umfärben und den beiden
XOR-Modi ändert es nichts, weil beide Tasten dort dasselbe tun; die Statusleiste
sagt das. Text und Stempel löschen ihre Buchstaben und Formen, statt sie zu
setzen, ein Muster legt seine Punkte als Löschen und seine Lücken als Punkte,
und die Füllung füllt mit der linken Taste mit Papier und mit der rechten mit
Tinte. Radierer, Tauschen und Umfärben ignorieren es. Es wird zwischen den
Sitzungen gemerkt und mit dem Zeichenmodus in Vorgaben gespeichert.

**Farbkern.** Für den runden und den quadratischen Pinsel, Formumrisse und die
Bézierkurve legt Farbkern fest, wie viel einer dicken Linie die Zellfarben
übernimmt. Eine Linie setzt immer jeden Punkt. Steht Farbkern auf 1 Pixel oder 4
Pixel, übernehmen nur die Zellen unter der Mitte der Linie Ihre Farben, eine so
breite Linie, die ihrer Mitte folgt; die übrigen Zellen darunter bekommen die
Punkte in den Farben, die sie schon hatten, sodass eine dicke Linie mit weniger
Zellen kollidiert. Ganze Linie, die Vorgabe, färbt jede Zelle, die die Linie
berührt. Die Option erscheint nur in Bildschirmmodi mit Zellfarben. Bei Spiegeln
hat die gespiegelte Linie einen eigenen Kern, und bei XOR behalten die Zellen
außerhalb des Kerns ihre Farben.

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

### Attribute

Die Einträge Attribute im Menü Bild ändern die Farben der Zellen; die Punkte
bleiben, wo sie sind. Invertieren tauscht Tinte und Papier in jeder Zelle und
behält Hell und Blinken. Löschen schreibt die aktuelle Tinte, das Papier, Hell
und Blinken in jede Zelle; die Felder „vorhandene verwenden“ behalten, was eine
Zelle schon hat. Horizontal spiegeln und Vertikal spiegeln spiegeln die
Zellfarben. Jeder Befehl wirkt auf die Auswahl (alle berührten Zellen) oder auf
das ganze Bild, wenn nichts ausgewählt ist, und ist mit einem Schritt
rückgängig zu machen. Die Einträge sind in Modi ohne Zellfarben (Timex Hi-res,
Layer 2, LoRes), bei schwebendem Stempel ohne eigene Farben und auf einer gesperrten Ebene
ausgegraut.

Ändern... findet Zellen anhand ihrer Farben und ersetzt sie. Suchen legt fest, welche Zellen gelten: jedes Feld ist ein Wert oder Beliebig. Ersetzen durch legt fest, was daraus wird: jedes Feld ist ein Wert oder Beibehalten. Der Dialog zeigt, wie viele Zellen sich ändern, bevor Sie OK drücken, und OK wird mit einem Schritt rückgängig gemacht. GigaScreen hat eine Gruppe für Bildschirm A und eine für Bildschirm B; in ULAplus ersetzt CLUT 0-3 die Optionen Hell und Blinken. Abbrechen ändert nichts.

### Punkte

Die Einträge Punkte im Menü Bild ändern die Punkte und lassen die Farben in ihren Zellen. Horizontal spiegeln und Vertikal spiegeln spiegeln die Punkte. Punkte und Farben invertieren tauscht außerdem Vordergrund und Hintergrund jeder Zelle, sodass das Bild gleich aussieht. Er wird in Modi ohne Zellenfarben nicht angeboten (Layer 2, LoRes, Timex Hi-res) und ist grau, solange ein Stempel schwebt. In ULAplus und ULANext wird er ebenfalls nicht angeboten, weil das Tauschen von Tinte und Papier das Aussehen des Bildes ändern würde.

Die Option Verschieben im Abschnitt Verschieben des Transform-Panels legt fest, was sich bewegt. Punkte und Farben (Vorgabe) verschiebt ganze Zellen mit ihrem Papier. Nur Punkte verschiebt die Punkte um einen Pixel oder eine Zelle. Nur Farben verschiebt die Zellenfarben Zelle für Zelle. Das Feld hat auch die vier Diagonalen. Solange ein Stempel schwebt, ist Verschieben grau, weil eine Verschiebung den ganzen Stempel bewegt.

Die Pfeiltasten folgen bei einer Auswahl derselben Option Verschieben.

### Stempel

Wenn ein Stempel eingeschaltet ist, zeigt das Feld **Transformieren**, wie er gesetzt wird.

**Farben** wählt zwischen Nur Pixel und Eigene Farben. Nur Pixel setzt die Punkte des Stempels in den Farben der Attributleiste, wie bisher. Eigene Farben setzt die Farben, die der Stempel trägt, Zelle für Zelle: ein Stempel aus dem Karteneditor oder einer, der aus einem Bild in einem Modus mit Zellfarben kopiert wurde. Ein aus dem Bild kopierter Stempel beginnt als Nur Pixel, sodass ein Einfügen genau wie früher landet. Eigene Farben legt den Stempel auf ganze Zellen, ignoriert Zeichenmodus, Farbleiste und XOR-Schalter und lässt sich nicht skalieren, drehen, biegen, spiegeln, invertieren oder umranden; das Feld graut das aus und nennt den Grund. Eine Formänderung bei einem Nur-Pixel-Stempel verwirft die Farben, die er trug. Invers vertauscht weiterhin, was gesetzte und leere Punkte tun. Haben die Zellen des Stempels eine andere Größe als der aktuelle Bildschirmmodus, ist nur Nur Pixel möglich.

**Durchscheinen** (nur bei Eigene Farben) lässt statt der Farbe des Stempels die Farbe durchscheinen, die schon auf der Seite ist. Ink, Paper, Bright und Flash haben je ein Kästchen. ULAplus hat ein CLUT-Kästchen für Bright und Flash zusammen. In GigaScreen gilt jedes Kästchen für beide Bildschirme.

**Leere Punkte** bestimmt, was die leeren Punkte des Stempels tun. Hintergrund lassen lässt das Bild darunter in Ruhe (ein Stempel mit eigenen Farben färbt das Paper darunter trotzdem um, außer Paper scheint durch). Hintergrund löschen löscht es ebenfalls, über das ganze Rechteck des Stempels. Zeichenmodi ohne Gegenteil (XOR, Ink umfärben, Paper umfärben) und der eigene XOR-Schalter des Stempels lassen die leeren Punkte in Ruhe, und das Feld sagt das. Leere Punkte gibt es in jedem Bildschirmmodus, auch ohne Zellfarben.

**In Nur Pixel umwandeln** verwirft die Farben des Stempels endgültig und behält seine Punkte. Die Wahl Nur Pixel bei Farben behält sie, sodass man zurückschalten kann. Jede Änderung ist ein Rückgängig-Schritt.

Solange ein Stempel mit eigenen Farben eingeschaltet ist, wirken die Befehle unter Bild > Attribute (Invertieren, Löschen, beide Spiegelungen und Ändern...) auf die Zellen des Stempels statt auf das Bild, ob er schwebt oder abgelegt ist. Sie ignorieren die Auswahl und berühren nie die Punkte des Stempels; eine Zelle, die der Stempel nicht abdeckt, bleibt unverändert. Spiegeln spiegelt die Farbzellen des Stempels, seine Punkte bleiben, wo sie sind. Ein GigaScreen-Stempel hat einen Farbsatz für beide Bildschirme, daher zeigt der Dialog Ändern eine Gruppe. Jeder Befehl ist ein Rückgängig-Schritt. Bei einem Stempel ohne eigene Farben bleiben sie ausgegraut.
