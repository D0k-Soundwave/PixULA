## Farbe

In den klassischen Modi wählen Sie keine Farbe für ein Pixel. Sie wählen die
zwei Farben, die eine ganze Zelle benutzt, dazu zwei Schalter.

- **TINTE** ist die Farbe der Tintenpixel.
- **PAPIER** ist die Farbe der Papierpixel.
- **HELL** hebt beide auf ihre hellere Variante an. Es gibt einen
  Hell-Schalter pro Zelle, also sind Tinte und Papier entweder beide hell oder
  keines von beiden.
- **BLINKEN** tauscht auf echter Hardware etwa zweimal pro Sekunde Tinte und
  Papier.

Die linke Maustaste zeichnet Tintenpixel. Die rechte zeichnet Papierpixel und
setzt dieselben vier Attribute, die die linke Taste setzen würde. Bei einem
Stift tut die Seitentaste dasselbe wie die rechte Maustaste.

Der **Radierer** macht etwas anderes als beide. Er macht Tintenpixel zu
Papierpixeln und lässt die Attribute der Zelle unverändert, selbst wenn er das
letzte Tintenpixel der Zelle radiert. Um auch die Attribute zu entfernen,
radieren Sie mit einem neuen Strich noch einmal über die leere Zelle: Tinte,
Papier, Hell und Blinken kehren zu Schwarz auf Weiß zurück, und auf einer oberen
Ebene wird die Zelle wieder durchsichtig. Eine Zelle, die noch Tintenpixel
enthält, behält ihre Attribute, egal wie oft Sie darüber radieren.
Die Option **Attribute** des Radierers, in Bildschirmmodi mit Zellattributen
sichtbar, ändert das: Auf aktuelle setzen radiert die Tintenpixel und gibt der
Zelle die Attribute der Farbleiste, wie das Wischwerkzeug von ZX Paintbrush, und
Behalten, die Vorgabe, ist das Verhalten von oben.

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

**Attribute kopieren, Pixel invertieren und Pixel und Attribute invertieren**
sind drei weitere Zellwerkzeuge in derselben Schaltfläche Zellwerkzeug und
funktionieren genauso: eines wählen, dann über Zellen klicken oder ziehen. Jedes
Ziehen wird in einem Schritt rückgängig gemacht, und das Werkzeug bleibt an, bis
Sie es ausschalten. **Attribute kopieren** nimmt die Attribute auf, die die
Zelle unter Ihrem ersten Klick zeigt, und gibt sie jeder Zelle, über die Sie
ziehen; die Farbleiste ändert sich nicht. **Pixel invertieren** macht die
Tintenpixel jeder ganzen Zelle zu Papierpixeln und die Papierpixel zu
Tintenpixeln und lässt die Attribute (eine leere Zelle wird gefüllt). **Pixel
und Attribute invertieren** tauscht zusätzlich
Tinte und Papier, sodass jede Zelle gleich aussieht; es dient zum Aufräumen
eines importierten Bildes, überspringt Zellen, in denen auch eine andere Ebene
zeichnet, und wird in ULAplus und ULANext nicht angeboten. Ein Zellwerkzeug wird
nur in den Bildschirmmodi angeboten, in denen es funktionieren kann: Die
Schaltfläche Zellwerkzeug listet nur die passenden auf (und ist ausgeblendet, wo
keines passt), und Pixel invertieren funktioniert auch in Timex Hi-Res, wo die
Pixel in 8-mal-8-Zellen liegen.

**XOR / Über und XOR / Jeder Durchgang** kehren Pixel um, Tinte zu Papier und
Papier zu Tinte, statt Tintenpixel zu zeichnen, und geben der Zelle beide die
gewählten Attribute. XOR / Über kehrt jedes Pixel einmal pro Strich um; wer im
selben Strich über die eigene Linie zurückfährt, ändert also nichts weiter. XOR
/ Jeder Durchgang kehrt ein Pixel jedes Mal um, wenn der Strich über es
hinweggeht: Ein Zug des Pinsels ist ein Durchgang, wie sehr sich der Pinsel
unterwegs auch selbst überlappt, aber ein Strich, der ein Pixel verlässt und
zurückkommt, kehrt es erneut um – eine Acht hebt sich also
dort auf, wo sie sich kreuzt. Formen, Kurven, Füllungen und Text sind immer ein
einziger Durchgang, damit liefern beide Modi dort dasselbe Ergebnis.

**Invers** vertauscht, was die beiden Maustasten tun: Die linke Taste zeichnet
Papierpixel, die rechte Tintenpixel, wie INVERSE 1 in BASIC. Sie wird in den Einstellungen eingeschaltet, oder mit Shift+I, und die Statusleiste sagt „Invers
ist an“, solange es an ist. In Tinte umfärben, Papier umfärben und den beiden
XOR-Modi ändert es nichts, weil beide Tasten dort dasselbe tun; die Statusleiste
sagt das. Text und Stempel zeichnen ihre Buchstaben und Formen in Papierpixeln
statt in Tintenpixeln, ein Muster legt seine Tintenpixel als Papierpixel und
seine Papierpixel als Tintenpixel, und die Füllung füllt mit der linken Taste
mit Papierpixeln und mit der rechten mit Tintenpixeln. Radierer, Tauschen und Umfärben ignorieren es. Es wird zwischen den
Sitzungen gemerkt und mit dem Zeichenmodus in Vorgaben gespeichert.

**Attributkern.** Für den runden und den quadratischen Pinsel, Formumrisse und
die Bézierkurve legt Attributkern fest, wie viel einer dicken Linie die
Zellattribute übernimmt. Eine Linie zeichnet immer jedes Tintenpixel. Steht
Attributkern auf 1 Pixel oder 4 Pixel, übernehmen nur die Zellen unter der Mitte
der Linie Ihre Attribute, eine so breite Linie, die ihrer Mitte folgt; die
übrigen Zellen darunter bekommen die Tintenpixel in den Attributen, die sie
schon hatten, sodass eine dicke Linie mit weniger Zellen kollidiert. Ganze
Linie, die Vorgabe, gibt jeder Zelle, die die Linie berührt, Ihre Attribute. Die
Option erscheint nur in Bildschirmmodi mit Zellattributen. Bei Spiegeln hat die
gespiegelte Linie einen eigenen Kern, und bei XOR behalten die Zellen außerhalb
des Kerns ihre Attribute.

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

**Palettenplätze.** Die ULAplus-Palette und die Next-Palette haben je vier Plätze, unter Bild > Palette (Platz 1 bis Platz 4). Der benutzte Platz ist abgehakt, und der Paletteneditor sagt, welchen Platz er bearbeitet. Ein neues Dokument beginnt auf Platz 1, die anderen Plätze enthalten die Standardpalette, bis Sie sie benutzen. Ein anderer Platz ändert die Farben, mit denen das Bild angezeigt wird, und nie die Attribute des Bildes. Jede Wahl ist ein Rückgängig-Schritt. Die Plätze werden in einem Projekt und in der automatischen Sicherung gespeichert, aber erst, nachdem Sie einen Platz benutzt haben; ein aus einer anderen Dateiart geöffnetes Bild beginnt auf Platz 1, und die anderen Plätze enthalten Kopien seiner Palette. Die Exporte als .scr, .tap und Bild benutzen immer den benutzten Platz. Die Modi mit fester Palette (Standard-ULA, die Multicolor-Modi, GigaScreen und die Timex-Modi) haben keine Plätze.

**Palette invertieren** (nur ULAplus) tauscht in jeder der vier CLUTs die Tinten-Hälfte (Einträge 0-7) mit der Papier-Hälfte (Einträge 8-15), in einem Rückgängig-Schritt; zweimal angewandt ist die Palette wieder wie vorher. Damit ein ULAplus-Bild nach dem Invertieren gleich aussieht, nehmen Sie Palette invertieren und danach Bild > Attribute > Invertieren. Der Rand folgt der Papier-Hälfte von CLUT 0 und ändert daher ebenfalls die Farbe. Die Next-Modi haben keine Paletteninvertierung, weil ULANext Tinte in 8 Paletteneinträgen und Papier in 32 hält.

**CLUT-Tasten.** In den ULAplus-Modi wählen Strg+Umschalt+1 bis Strg+Umschalt+4 die CLUT 0 bis 3, genau wie die CLUT-Wahl in der Farbleiste. In anderen Modi sagt die Statuszeile das und sonst passiert nichts.

**Standardfarben.** Unter Einstellungen > Einstellungen können Sie bei Standardfarben die 15 Farben ändern, die die Modi Standard, Multicolor, GigaScreen und Timex zeigen. Helles Schwarz ist immer Schwarz. Die Farben ändern, was Sie sehen und was die Bildexporte enthalten (PNG, GIF, BMP, JPG); sie ändern nie die Bytes von .scr- oder .tap-Dateien, und der Import eines Bildes gleicht weiterhin mit den originalen Spectrum-Farben ab, sodass dasselbe Foto auf jedem Rechner dasselbe Bild ergibt. ULAplus- und Next-Paletten sind getrennt. OK wendet die Farben an, Abbrechen behält nichts, und Auf Standard zurücksetzen bringt die Originale zurück. Sie werden in diesem Browser gespeichert, nicht im Projekt. .pal laden liest eine Standardfarben-Datei von ZX Paintbrush (256 Bytes), .pal speichern schreibt eine; so nehmen Sie Ihre Farben in einen anderen Browser mit.

**Palettenbänder.** Datei > Palette als TAP speichern schreibt die ULAplus-Palette als Band mit 176 Bytes. Auf einem Spectrum mit `LOAD ""` geladen setzt es die 64 Paletteneinträge und lädt dann die nächste Datei auf dem Band; ein Palettenband kann also vor einem Bild- oder Spielband stehen. Datei > Palette laden und Datei > Öffnen lesen Palettenbänder: die von PixULA und die von ZX Paintbrush. Ein Palettenband geht in einem Rückgängig-Schritt in den benutzten Palettenplatz und wird nicht zur geöffneten Datei.

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

Die Pipette nimmt all das wieder auf: die Attribute beider Bildschirme und welche
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
  512×192 ab. Hi-Res hat keine Zellattribute – jeder Bildschirm hat ein
  Farbschema für das ganze Bild –, also zeigt die Leiste eine Schemazeile für
  Bildschirm A und eine für Bildschirm B, und Malen zeigt die vier Mischungen
  der beiden. Das sind `.hrg`-Dateien.

Ein Wechsel zwischen den Zwei-Bildschirm-Modi behält beide Bildschirme, nach
denselben Regeln, nach denen ein einzelner Bildschirm umgewandelt wird.

### Attribute

Die Einträge Attribute im Menü Bild ändern die Attribute der Zellen; die Pixel
bleiben, wo sie sind. Invertieren tauscht Tinte und Papier in jeder Zelle und
behält Hell und Blinken. Löschen schreibt die aktuelle Tinte, das Papier, Hell
und Blinken in jede Zelle; die Felder „vorhandene verwenden“ behalten, was eine
Zelle schon hat. Horizontal spiegeln und Vertikal spiegeln spiegeln die
Zellattribute. Jeder Befehl wirkt auf die Auswahl (alle berührten Zellen) oder auf
das ganze Bild, wenn nichts ausgewählt ist, und ist mit einem Schritt
rückgängig zu machen. Die Einträge sind in Modi ohne Zellattribute (Timex Hi-res,
Layer 2, LoRes), bei schwebendem Stempel ohne eigene Attribute und auf einer gesperrten Ebene
ausgegraut.

Ändern... findet Zellen anhand ihrer Attribute und ersetzt sie. Suchen legt fest, welche Zellen gelten: jedes Feld ist ein Wert oder Beliebig. Ersetzen durch legt fest, was daraus wird: jedes Feld ist ein Wert oder Beibehalten. Der Dialog zeigt, wie viele Zellen sich ändern, bevor Sie OK drücken, und OK wird mit einem Schritt rückgängig gemacht. GigaScreen hat eine Gruppe für Bildschirm A und eine für Bildschirm B; in ULAplus ersetzt CLUT 0-3 die Optionen Hell und Blinken. Abbrechen ändert nichts.

### Pixel

Die Einträge Pixel im Menü Bild ändern die Pixel und lassen die Attribute in ihren Zellen. Horizontal spiegeln und Vertikal spiegeln spiegeln die Pixel. Pixel und Attribute invertieren invertiert die Pixel und tauscht außerdem Tinte und Papier jeder Zelle, sodass das Bild gleich aussieht. Er wird in Modi ohne Zellattribute nicht angeboten (Layer 2, LoRes, Timex Hi-res) und ist grau, solange ein Stempel schwebt. In ULAplus und ULANext wird er ebenfalls nicht angeboten, weil das Tauschen von Tinte und Papier das Aussehen des Bildes ändern würde.

Die Option Verschieben im Abschnitt Verschieben des Transform-Panels legt fest, was sich bewegt. Pixel und Attribute (Vorgabe) verschiebt ganze Zellen mit ihrem Papier. Nur Pixel verschiebt die Pixel um ein Pixel oder eine Zelle. Nur Attribute verschiebt die Zellattribute Zelle für Zelle. Das Feld hat auch die vier Diagonalen. Solange ein Stempel schwebt, ist Verschieben grau, weil eine Verschiebung den ganzen Stempel bewegt.

Die Pfeiltasten folgen bei einer Auswahl derselben Option Verschieben.

### Stempel

Wenn ein Stempel eingeschaltet ist, zeigt das Feld **Transformieren**, wie er gesetzt wird.

**Attribute** wählt zwischen Nur Pixel und Eigene Attribute. Nur Pixel setzt die Pixel des Stempels in den Attributen der Attributleiste, wie bisher. Eigene Attribute setzt die Attribute, die der Stempel trägt, Zelle für Zelle: ein Stempel aus dem Karteneditor oder einer, der aus einem Bild in einem Modus mit Zellattributen kopiert wurde. Ein aus dem Bild kopierter Stempel beginnt als Nur Pixel, sodass ein Einfügen genau wie früher landet. Eigene Attribute legt den Stempel auf ganze Zellen, ignoriert Zeichenmodus, Farbleiste und XOR-Schalter und lässt sich nicht skalieren, drehen, biegen, spiegeln, invertieren oder umranden; das Feld graut das aus und nennt den Grund. Eine Formänderung bei einem Nur-Pixel-Stempel verwirft die Attribute, die er trug. Invers vertauscht weiterhin, was Tintenpixel und Papierpixel tun. Haben die Zellen des Stempels eine andere Größe als der aktuelle Bildschirmmodus, ist nur Nur Pixel möglich.

**Durchscheinen** (nur bei Eigene Attribute) lässt statt des Attributs des Stempels das Attribut durchscheinen, das schon auf der Seite ist. Tinte, Papier, Hell und Blinken haben je ein Kästchen. ULAplus hat ein CLUT-Kästchen für Hell und Blinken zusammen. In GigaScreen gilt jedes Kästchen für beide Bildschirme.

**Papierpixel** bestimmt, was die Papierpixel des Stempels tun. Hintergrund lassen lässt das Bild darunter in Ruhe (ein Stempel mit eigenen Attributen färbt das Papier darunter trotzdem um, außer Papier scheint durch). Hintergrund löschen macht das Bild darunter ebenfalls zu Papierpixeln, über das ganze Rechteck des Stempels. Zeichenmodi ohne Gegenteil (XOR, Tinte umfärben, Papier umfärben) und der eigene XOR-Schalter des Stempels lassen die Papierpixel in Ruhe, und das Feld sagt das. Papierpixel gibt es in jedem Bildschirmmodus, auch ohne Zellattribute.

**In Nur Pixel umwandeln** verwirft die Attribute des Stempels endgültig und behält seine Pixel. Die Wahl Nur Pixel bei Attribute behält sie, sodass man zurückschalten kann. Jede Änderung ist ein Rückgängig-Schritt.

Solange ein Stempel mit eigenen Attributen eingeschaltet ist, wirken die Befehle unter Bild > Attribute (Invertieren, Löschen, beide Spiegelungen und Ändern...) auf die Zellen des Stempels statt auf das Bild, ob er schwebt oder abgelegt ist. Sie ignorieren die Auswahl und berühren nie die Pixel des Stempels; eine Zelle, die der Stempel nicht abdeckt, bleibt unverändert. Spiegeln spiegelt die Attributzellen des Stempels, seine Pixel bleiben, wo sie sind. Ein GigaScreen-Stempel hat einen Attributsatz für beide Bildschirme, daher zeigt der Dialog Ändern eine Gruppe. Jeder Befehl ist ein Rückgängig-Schritt. Bei einem Stempel ohne eigene Attribute bleiben sie ausgegraut.
