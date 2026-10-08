## Erste Schritte

PixULA ist ein Pixel-Art-Editor für den ZX Spectrum und den ZX Spectrum Next.
Er läuft im Browser, aus einem Ordner auf Ihrer eigenen Festplatte, ohne
Installation, ohne Server und ohne Internetverbindung.

Entpacken Sie den Ordner an einen beliebigen Ort und doppelklicken Sie auf
`PixULA.html`. Das ist die ganze Einrichtung. Außerhalb dieses Ordners wird
nichts geschrieben, sofern Sie es nicht verlangen, und nichts, was Sie zeichnen,
verlässt Ihren Rechner.

### Das Wichtigste vorab

Der Spectrum kann nicht jede Farbe an jede Stelle setzen. Er speichert Ihr Bild
als Bitmap mit einem Bit pro Pixel, über der ein separates, viel gröberes
Farbraster liegt, und in jedem 8×8-Block stehen nur zwei Farben zur Verfügung.
Diese eine Tatsache bestimmt, wie sich jedes Werkzeug hier verhält, und davon
handelt das nächste Kapitel.

### Orientierung im Programm

![Das PixULA-Fenster: Menüleiste, Modusleiste, Werkzeugleiste, Farbleiste, Zeichenfläche, Bedienfelder und Statusleiste](img/workspace.png)

*Das gesamte Fenster.*

- **Die Menüleiste** ganz oben: Dateien, Bearbeiten, die Ansicht, Ebenen, das
  Bild selbst, Einstellungen und Hilfe.
- **Die Modusleiste** darunter: Zeichenmodi, Tauschen und Umfärben sowie Spiegeln.
- **Die Werkzeugleiste** links, mit Rückgängig und Wiederholen ganz oben.
- **Die Farbleiste** daneben, mit der Palette des aktuellen Bildschirmmodus.
- **Die Zeichenfläche** in der Mitte.
- **Die Bedienfelder** rechts: Ebenen, Werkzeugoptionen, Transformieren, das
  Referenzbild, Voreinstellungen.
- **Die Statusleiste** unten, mit Bildschirmmodus, Zeichenmodus und der
  Anzeige, ob Berührung zeichnet.

![Die Werkzeugleiste](img/tool-rail.png)

*Die Werkzeugleiste. Rückgängig und Wiederholen stehen oben; die Werkzeuge
darunter sind danach gruppiert, was sie mit dem Bild tun.*

![Die Farbleiste](img/colour-rail.png)

*Die Farbleiste: TINTE links, PAPIER rechts, darüber HELL und BLINKEN.*

![Die Modusleiste](img/colour-bar.png)

*Die Modusleiste: Zeichenmodi, dann Tauschen und Umfärben, dann Spiegeln.*

![Die Seitenbereiche](img/panels.png)

*Die Bedienfelder. Jedes lässt sich einklappen, sodass nur die geöffnet
bleiben, die Sie benutzen.*

![Die Statusleiste](img/status-bar.png)

*Die Statusleiste zeigt die Einstellungen, die bestimmen, was Ihr nächster
Strich bewirkt.*

Die Werkzeugleiste hat keine Beschriftungen – neben den Schaltflächen ist dafür
kein Platz. Zeigen Sie auf ein Bedienelement, um seinen Namen zu sehen, und
bleiben Sie darauf, um einen erklärenden Satz zu lesen. Auf einem Tablet halten
Sie stattdessen gedrückt; das Halten wechselt nicht zugleich das Werkzeug.

### Auf dem Tablet

Halten Sie das Tablet quer. PixULA verwendet auf dem Tablet dasselbe Fenster
wie auf dem Computer, und hochkant ist nicht genug Breite für die Zeichenfläche
neben den Bedienfeldern – daher bittet das Programm Sie, das Gerät zu drehen.
Auf einem kleinen Bildschirm schrumpft die ganze Oberfläche passend, aber nie
unter eine Größe, die ein Finger noch treffen kann, und die gewählte
Oberflächengröße kehrt auf einem größeren Bildschirm zurück. Mit angeschlossener
Maus oder Trackpad wird das Tablet wie ein Computer behandelt und kann in beiden
Ausrichtungen benutzt werden.
