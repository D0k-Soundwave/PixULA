## Die Werkzeuge

Die Werkzeugleiste gruppiert die Werkzeuge danach, was sie mit dem Bild tun:
zuerst alles, was Tinte aufträgt, dann die Auswahl, dann die Begrenzung, die
die Auswahl ermöglicht, dann die Werkzeuge, die fertige Grafik platzieren, und
zuletzt die, die nur Ihre Ansicht verändern.

Zeichenmodus, Spiegeln und Begrenzung gelten für jedes Werkzeug hier. Sie
werden daher einmal in der Modusleiste eingestellt, statt in den Optionen jedes
Werkzeugs aufzutauchen.

![Das Bedienfeld Werkzeugoptionen mit den Pinseleinstellungen](img/tool-options-brush.png)

*Die Optionen des gewählten Werkzeugs erscheinen in diesem Bedienfeld – hier
die des Pinsels.*

Der Pinsel hat kein Fadenkreuz über dem Bild. Ab Größe 2 ist der Umriss der
Fläche, die er malen wird, der Zeiger. Bei Größe 1 ist der Zeiger ein kleines
Plus von drei Pixeln Breite, und der Punkt in seiner Mitte ist das Pixel, das
der Pinsel malen wird, in der Farbe, in der er es malen wird: Ihre Tinte mit
angewandtem HELL oder die vorhandene Tinte der Zelle, wenn Tinte auf „vorhandene
Farbe verwenden“ steht. Während Sie zeichnen, zeigt der Punkt, was Sie gerade
gemalt haben. Über der grauen Fläche um das Bild kehrt der normale Zeiger
zurück. Sprühen, Verlauf, Muster und Schraffur funktionieren genauso.

Viele Optionen wirken nur in Verbindung mit einer anderen. Die Tabellen unten
haben eine Spalte **Sichtbar, wenn** mit der Bedingung, unter der eine Zeile
erscheint; Zeilen mit „immer“ sind unabhängig von allem anderen vorhanden.

**Punktfiguren.** Die Formenliste hat eine Gruppe Figuren, die durch Setzen von Punkten gezeichnet werden: Linienzug, Polygon, Dreieck, Strahlen, Senkrechte Linie und Parallele Linie (die Taste L wählt das Figurenwerkzeug). Klicken setzt einen Punkt, Drücken und Ziehen zeichnet freihand. Doppelklick oder Enter beendet die Figur; sie bleibt als änderbare Vorschau im Bild, und ein weiteres Enter zeichnet sie in einem Rückgängig-Schritt. Die Rücktaste entfernt den letzten Punkt (einen Freihandzug als Ganzes), Esc verwirft die Figur ohne zu zeichnen, und ein Klick woanders oder ein anderes Werkzeug zeichnet sie. Dreieck, Senkrechte Linie und Parallele Linie sind beim dritten Punkt von selbst fertig: die erste Linie ziehen, dann den letzten Punkt anklicken. Eine Senkrechte Linie fügt vom Lotfußpunkt Ihres Punktes auf der ersten Linie eine zweite Linie hinzu; eine Parallele Linie fügt eine Kopie der ersten Linie mit Ihrem Punkt in der Mitte hinzu. Strahlen verbindet jeden weiteren Punkt mit dem ersten. Polygon und Dreieck können gefüllt werden. Figuren folgen dem Zeichenmodus, Invers, den „Vorhandenes beibehalten“-Feldern, der Spiegelung und der Zeichenführung wie jede Form, und die Vorschau zeigt genau, wie sie gezeichnet werden.

**Linienart, Drehung und Rundung.** Das Formwerkzeug, das Figurenwerkzeug und die Bézierkurve teilen sich eine Linienart: Durchgezogen, Gestrichelt, Gepunktet, Strichpunkt, Strich-Punkt-Punkt und Keine. Die Strichstile werden nur auf einer Linie von einem Pixel Stärke gezeichnet und sind darüber ausgegraut; das Muster läuft am Umriss entlang, auch um Ecken, und jeder Strahl oder jede Linie einer Figur beginnt ihr eigenes. Keine zeichnet keinen Umriss, nutzen Sie sie mit Gefüllt, um nur das Innere zu zeichnen. Die Bézierkurve hat kein Keine. Drehung (-180 bis 180 Grad, im Uhrzeigersinn) dreht Rechteck, Quadrat, abgerundetes Rechteck, Ellipse oder Parallelogramm um die Mitte ihres Rahmens und dreht Bogen, Sektor, Dreieck, Raute oder regelmäßiges Vieleck um den Punkt, an dem Sie gedrückt haben. Rundung bestimmt, wie rund die Ecken des abgerundeten Rechtecks sind, von eckig bei 0 bis Halbkreis-Enden bei 100. Eine Bézierkurve, die Sie noch bearbeiten, wird beim Wechsel zu einem anderen Werkzeug gezeichnet, und Esc verwirft sie. Die Vorschau einer Form oder Kurve zeigt die gespiegelten Kopien und bleibt innerhalb der Zeichenführung, wie die fertige Zeichnung.

**Eine Figur bearbeiten, verschieben, drehen und klonen.** Eine fertige Figur und eine Bézierkurve bleiben als Vorschau im Bild, bis Sie sie zeichnen. Solange eine wartet, können Sie jeden ihrer quadratischen Punkte ziehen, um sie umzuformen, die Figur selbst ziehen, um sie zu verschieben, den runden Knauf darüber ziehen, um sie zu drehen, und mit den Pfeiltasten verschieben (ein Pixel, oder eine Zelle mit Umschalt oder mit Rasterfang). Strg+Z nimmt die letzte dieser Änderungen zurück, dann die Figur selbst und erst dann das Bild. Enter, ein Klick woanders, Speichern oder ein anderes Werkzeug zeichnet sie in einem Rückgängig-Schritt. Eine Form aus dem Formwerkzeug wird normalerweise gezeichnet, sobald Sie loslassen; haken Sie in den Optionen **Bearbeitbar halten** an, und sie wartet wie eine Figur, mit einem Griff an jedem Ende des Ziehens. **Bearbeiten > Letzte Figur klonen** (Umschalt+C) öffnet eine Kopie der zuletzt gezeichneten Figur, Form oder Kurve, bereit zum Verschieben, Drehen oder Ändern; um Farben oder Linienart einer schon gezeichneten zu ändern, drücken Sie Strg+Z und dann Letzte Figur klonen. Solange eine Figur wartet, folgt sie den gewählten Farben, der Linienart und der Füllung, wie die fertige Zeichnung.

**Sprühmuster.** Stellen Sie die Verteilung des Sprühwerkzeugs auf **Muster**, dann setzt es statt Punkten kleine ganze Figuren - Kreise, Quadrate oder kurze Striche. Wählen Sie die Figur, ihre Größe und ob sie gefüllt oder nur ein Umriss ist; der Fluss bestimmt, wie viel der Fläche sie abdecken sollen. Innerhalb der Sprühfläche werden nur ganze Figuren gesetzt, ein Spray, das für eine Figur zu klein ist, zeichnet also nichts.

{{tools}}
