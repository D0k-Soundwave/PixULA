## Culoarea

În modurile clasice nu alegeți culoarea unui pixel. Alegeți cele două culori pe
care le va folosi o celulă întreagă, plus două indicatoare.

- **CERNEALĂ** este culoarea punctelor aprinse.
- **HÂRTIE** este culoarea punctelor stinse.
- **LUMINOS** le ridică pe amândouă la varianta mai deschisă. Există un
  indicator de luminozitate pe celulă, deci cerneala și hârtia sunt luminoase
  împreună sau deloc.
- **CLIPIRE** schimbă între ele cerneala și hârtia de aproximativ două ori pe
  secundă pe hardware-ul real.

Butonul stâng al mouse-ului desenează cu cerneală. Cel drept desenează cu
hârtie: stinge punctul și setează aceleași patru valori pe care le-ar seta cel
stâng. La un stilou, butonul lateral face ce face butonul drept.

**Radiera** face altceva decât amândouă. Stinge puncte și lasă culorile celulei
neatinse, chiar și când șterge ultimul punct din celulă. Ca să ștergeți și
culorile, treceți din nou cu radiera peste celula goală cu o trăsătură nouă:
cerneala, hârtia, luminozitatea și clipirea revin la negru pe alb, iar pe un
strat superior celula devine din nou transparentă. O celulă care mai are puncte
își păstrează culorile, oricât de des ați trece cu radiera peste ea.

### Moduri de desen

Modul de desen schimbă ce face o trăsătură și se aplică fiecărui instrument. Se
păstrează între sesiuni, așa că bara de stare îl arată ori de câte ori este altul
decât Normal – în unele dintre aceste moduri o trăsătură nu lasă nimic vizibil și
altfel n-ați avea cum să aflați de ce.

{{draw-modes}}

### Palete

Două familii de moduri vă permit să schimbați culorile însele. ULAplus vă oferă
64 de registre de culoare, aranjate ca patru palete de câte șaisprezece.
Modurile Next vă oferă 256 de culori a câte nouă biți.

Paletele sunt fișiere. Puteți crea una, o puteți salva și încărca în altă
imagine, din **Fișier > Încarcă paleta** și **Fișier > Salvează paleta** sau
din editorul de palete. Nu trebuie să deschideți editorul ca să încărcați una,
fiindcă o paletă se încarcă de obicei înainte de a începe desenul.

Unde un format de fișier are loc pentru o paletă – `.scr` de 6976 de octeți,
`.nxi`, varianta Timex –, paleta călătorește și în interiorul imaginii.

### GigaScreen

GigaScreen păstrează două ecrane întregi și le afișează alternativ, de cincizeci
de ori pe secundă. Ochiul amestecă cele două culori ale fiecărui pixel într-una,
așa că o celulă cu o cerneală și o hârtie pe fiecare ecran poate arăta **patru**
culori, iar imaginea întreagă poate ajunge la vreo sută.

Nu desenați niciodată pe un singur ecran. Fiecare trăsătură scrie pe amândouă,
iar bara de culori lucrează în perechi:

- **Ecranul A** și **Ecranul B** au fiecare propriile mostre de cerneală și
  hârtie și propriul **LUMINOS**. Clipirea este o singură setare pentru
  amândouă.
- **Pictează** arată cele patru culori care rezultă din aceste alegeri,
  amestecate exact cum le arată pânza: cerneală pe ambele ecrane, cerneală doar
  pe A, cerneală doar pe B și hârtie pe ambele. Alegeți una și butonul stâng
  pictează cu ea. Butonul drept pictează mereu hârtie pe ambele ecrane.
- Alegeți aceeași cerneală pentru ambele ecrane și mostra din stânga sus din
  Pictează este acea culoare, pură – așa se desenează tot ce nu trebuie să pară
  amestecat.

Pipeta preia înapoi toate acestea: culorile ambelor ecrane și care dintre cele
patru o arată pixelul.

Butoanele de afișare schimbă doar ce arată pânza, niciodată unde ajunge o
trăsătură. **Medie** este ce vede ochiul pe mașina reală. **Pâlpâire** schimbă
cele două ecrane la fiecare cadru, cum face hardware-ul. **A** și **B** arată
un singur ecran. O imagine salvată sau exportată ca PNG folosește Medie când este
afișată Pâlpâire, fiindcă o imagine statică nu poate pâlpâi.

Intrarea în GigaScreen copiază imaginea pe ambele ecrane, așa că arată la fel ca
înainte. Ieșirea păstrează ecranul A și renunță la ecranul B, iar dacă ecranul B
conține ceva diferit, sunteți avertizat dinainte.

Același mod de lucru acoperă încă două moduri cu pâlpâire:

- **MultiGigaScreen 8×4, 8×2 și 8×1** pun cele două ecrane pe celulele
  Multicolor mai fine, așa că cele patru culori sunt pe 4, 2 sau o singură linie
  în loc de pe bloc de 8 pe 8. Acestea sunt fișierele `.mg4`, `.mg2` și `.mg1`
  ale MultiArtist.
- **Timex rezoluție înaltă GigaScreen** alternează două ecrane de rezoluție
  înaltă de 512 pe 192. Rezoluția înaltă nu are culori de celulă – fiecare ecran
  are o schemă de culori pentru toată imaginea –, așa că bara arată un rând de
  scheme pentru Ecranul A și unul pentru Ecranul B, iar Pictează arată cele
  patru amestecuri ale lor. Acestea sunt fișiere `.hrg`.

Trecerea între oricare dintre modurile cu două ecrane păstrează ambele ecrane,
după aceleași reguli după care se convertește un ecran simplu.
