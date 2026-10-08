## Primii pași

PixULA este un editor de pixel art pentru ZX Spectrum și ZX Spectrum Next.
Rulează într-un browser, dintr-un folder de pe propriul disc, fără instalare,
fără server și fără conexiune la internet.

Dezarhivați folderul oriunde doriți și faceți dublu clic pe `PixULA.html`.
Aceasta este toată instalarea. Nimic nu se scrie în afara acelui folder decât
dacă cereți, și nimic din ce desenați nu părăsește calculatorul.

### Primul lucru de știut

Spectrum nu poate pune orice culoare oriunde. Stochează imaginea ca bitmap cu un
bit pe pixel, peste care se află o grilă de culoare separată, mult mai grosieră,
iar în fiecare bloc de 8 pe 8 sunt disponibile doar două culori. Acest singur
fapt determină comportamentul fiecărui instrument, iar capitolul următor este
despre el.

### Orientarea

![Fereastra PixULA: bara de meniu, bara de moduri, bara de instrumente, bara de culori, pânza, panourile și bara de stare](img/workspace.png)

*Întreaga fereastră.*

- **Bara de meniu** sus: fișiere, editare, vizualizare, straturi, imaginea
  însăși, setări și ajutor.
- **Bara de moduri** dedesubt: moduri de desen, Schimbă și Recolorează, apoi oglindă.
- **Bara de instrumente** în stânga, cu anulare și refacere sus.
- **Bara de culori** alături, cu paleta modului de ecran curent.
- **Pânza** la mijloc.
- **Panourile** în dreapta: straturi, opțiuni unealtă, transformare, imaginea de
  referință, presetări.
- **Bara de stare** jos, care arată modul de ecran, modul de desen și dacă
  atingerea desenează.

![Bara de instrumente](img/tool-rail.png)

*Bara de instrumente. Anularea și refacerea sunt sus; instrumentele de dedesubt
sunt grupate după ce fac imaginii.*

![Bara de culori](img/colour-rail.png)

*Bara de culori: CERNEALĂ în stânga, HÂRTIE în dreapta, cu LUMINOS și CLIPIRE
deasupra.*

![Bara de moduri](img/colour-bar.png)

*Bara de moduri: moduri de desen, apoi Schimbă și Recolorează, apoi oglindă.*

![Panourile laterale](img/panels.png)

*Panourile. Fiecare se restrânge, ca să păstrați deschise doar pe cele pe care
le folosiți.*

![Bara de stare](img/status-bar.png)

*Bara de stare, cu setările de care depinde ce va face următoarea trăsătură.*

Bara nu are etichete – lângă butoane nu e loc pentru ele. Treceți cu indicatorul
peste orice control ca să-i vedeți numele și rămâneți pe el ca să citiți o
propoziție care îl explică. Pe o tabletă, țineți apăsat; apăsarea lungă nu
schimbă și instrumentul.

### Pe o tabletă

Țineți tableta orizontal. PixULA folosește pe tabletă aceeași fereastră ca pe
calculator, iar vertical nu e destulă lățime pentru pânză lângă panouri, așa că
vă cere să rotiți dispozitivul. Pe un ecran mic, întreaga interfață se
micșorează ca să încapă, dar niciodată sub o dimensiune pe care un deget o mai
poate nimeri, iar dimensiunea interfeței aleasă revine pe un ecran mai mare. Cu
un mouse sau un trackpad conectat, tableta este tratată ca un calculator și
poate fi folosită în orice orientare.
