## Animation

PixULA animiert auf zwei Arten. Eine **Bildschirmanimation** ändert von Bild zu
Bild das ganze Bild. Eine **Sprite-Animation** ändert einen Block davon, eine
laufende Figur oder eine wehende Fahne, während der Rest des Bildes dahinter
stillsteht. Beide halten jede Regel des Bildschirmmodus ein: ein Bild besteht
aus ganzen Attributzellen und teilt daher nie die Attribute einer Zelle.

### Eine Animation beginnen

![Das Menü Animation](img/menu-animation.png)

![Der Dialog Neue Sprite-Animation](img/dialog-new-sprite.png)

**Animation > Neue Bildschirmanimation** macht das Bild zu Bild 1. Jede Ebene
wird animiert: sie hat in jedem Bild eigenen Inhalt.

**Animation > Neue Sprite-Animation...** fragt nach Name, Breite und Höhe,
Position und der Zahl der Bilder zu Beginn. Die Größe wird auf ganze Zellen des
Modus aufgerundet, und der Dialog sagt, was daraus wurde: im Modus 8x1 wird
20 x 20 zu 24 x 20. Auswahl verwenden übernimmt Größe und Ort einer Auswahl. Um
das Sprite per Klick zu setzen, wählen Sie den Block zuerst mit dem
Auswahlwerkzeug (Größe: Eigene). **Neue Sprite-Animation aus Auswahl** schiebt
den gewählten Block zudem als Bild 1 auf die eigene Ebene des Sprites. Eine
gepunktete Linie knapp außerhalb seines Fensters zeigt, wo es liegt.

Ein Bild kann mehrere Animationen enthalten; die Auswahl oben im Feld Animation
bestimmt die geöffnete. Der Bildschirmmodus kann sich nicht ändern, solange das
Bild Animationen hat.

### Bilder

![Das Bedienfeld Animation mit den sechs Bildern eines springenden Balls](img/animation-panel.png)

Das Feld Animation zeigt jedes Bild als kleines Bild mit Nummer und
Verzögerung. Klicken Sie eines an, um hinzugehen, oder drücken Sie `,` und `.`
für das Bild davor und danach. Sie zeichnen auf dem gezeigten Bild mit jedem
Werkzeug genau wie auf einem Standbild: Attribut-Clash, Zeichenmodi, Spiegeln,
Stempel, Flash und Rückgängig funktionieren wie immer.

Hinzufügen setzt ein leeres Bild hinter das gezeigte, Duplizieren eine Kopie
davon; Löschen, Links und Rechts löschen und verschieben es. Die Verzögerung
ist die Zeit, die das Bild stehen bleibt, in Spectrum-Bildern zu 1/50 s, und
Für alle gibt jedem Bild diese Verzögerung. Um einen Teil eines Bildes ins
nächste mitzunehmen, kopieren Sie ihn (**Animation > Bild als Stempel** kopiert
das Fenster eines Sprites), gehen zum nächsten Bild und setzen den Stempel. Wer
einen Schritt rückgängig macht, der auf einem anderen Bild gemacht wurde, kehrt
zu diesem Bild zurück.

**Animation > Stempel als Bilder** macht aus jedem Stempel der Liste Stempel
ein neues Bild, gesetzt dort, wo der Stempel abgelegt ist; die Stempel bleiben.

### Ebenen in einer Animation

![Das Bedienfeld Ebenen mit einer animierten und einer gemeinsamen Ebene und den zwei Vorschauebenen der Zwiebelhaut](img/animation-layers.png)

Solange eine Animation geöffnet ist, hat jede Zeile im Feld Ebenen einen
Schalter Animiert / Gemeinsam. Eine animierte Ebene hat in jedem Bild eigenen
Inhalt; eine gemeinsame Ebene sieht in jedem Bild gleich aus, wie ein
Hintergrund, den Sie einmal zeichnen. Animiert kopiert die Ebene in jedes Bild;
Gemeinsam behält das gezeigte Bild und fragt vorher. Neue Ebenen gehören zur
geöffneten Animation, und Nach unten zusammenführen, Auswahl zusammenführen und
Reduzieren wirken auf jedes Bild.

### Abspielen

Abspielen (Enter) spielt die geöffnete Animation auf dem Bild ab; ein Sprite
bewegt sich über seinem Hintergrund, und FLASH und das GigaScreen-Flackern
laufen weiter. Erstes, Zurück, Weiter und Letztes blättern durch die Bilder
(Zurück oder Weiter gedrückt halten blättert weiter), und Stopp kehrt zum Bild
zurück, bei dem das Abspielen begann. Ein Klick auf das Bild oder Escape hält
an. Wiederholen spielt die Bilder in einer Schleife, einmal oder hin und
zurück. Tempo spielt schneller oder langsamer, ohne die Verzögerungen zu
ändern, und Bilder abspielen spielt nur einen Teil der Animation.

### Bilder durchpausen

**Pausen** unter einem Bild zeigt dieses Bild blass, während Sie die anderen
zeichnen, als Vorschauebene im Feld Ebenen. Der Schalter **Zwiebelhaut** zeigt
das Bild davor und danach genauso, und beide folgen Ihnen, wenn Sie das Bild
wechseln. **Ebene > Neue Vorschauebene** fügt eines davon einzeln hinzu.

Eine Vorschauebene folgt der Regel des Ebenensystems: ihre Papierpixel und
leeren Zellen sind durchsichtig, die Tinte der Ebenen darüber verdeckt sie, und
sie liegt blass über dem, was darunter ist. Schieben Sie sie nach oben oder
unten, um sie über oder unter die Ebene zu legen, auf der Sie zeichnen. Jede
hat eine eigene Deckkraft, eine Tönung (frühere Bilder rot, spätere blau) und
Ein- und Ausblenden, und Löschen entfernt nur die Vorschau. Eine Vorschau ist
nie Teil des Bildes: sie wird nie bemalt, zusammengeführt oder exportiert und
ist beim Abspielen ausgeblendet.

### Exportieren

**Animation > Animation exportieren**:

- **Nummerierte Bildschirme...** speichert jedes Bild als eigenen
  Spectrum-Bildschirm, der Reihe nach nummeriert (`walk_001.scr`,
  `walk_002.scr` und so weiter), in jedem Bildschirmformat, das der Modus
  speichern kann. Jede Datei ist genau das, was Bild speichern unter für dieses
  Bild schreibt. Sie wählen Name, erste Nummer, Stellen und Bilder. Wo der
  Browser in einen Ordner schreiben kann, wählen Sie einen; sonst kommen die
  Bildschirme als eine `.zip`.
- **Animiertes GIF** spielt die Bilder mit ihren Verzögerungen ab, FLASH und
  GigaScreen eingeschlossen.
- **PNG-Sprite-Bogen** legt die Bilder nebeneinander, 16 pro Reihe.
- **SevenuP, alle Bilder** schreibt bis zu 32 Bilder in eine `.sev`
  (Standardmodus). Eine `.sev` mit mehreren Bildern öffnet sich als
  Sprite-Animation.
- **Band** schreibt pro Bild einen SCREEN$ auf eine `.tap` oder `.tzx`. Es
  enthält die Bildschirme, kein Programm, das sie abspielt.
- **Next-Sprites** schreibt eine 16 x 16 Sprite-Animation in den Modi Layer 2
  und LoRes als `.spr`-Bogen.

Animationen werden in PixULA-Projekten, in der Wiederherstellungsspeicherung
und in Sicherungen gespeichert.
