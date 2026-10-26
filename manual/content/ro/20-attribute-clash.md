## Conflictul de atribute

Spectrum păstrează o imagine în două părți separate.

Prima este un bitmap: 256 pe 192 de pixeli, câte un bit fiecare, un pixel de
cerneală sau un pixel de hârtie. A doua este o grilă de atribute, câte un octet
pentru fiecare bloc de 8 pe 8 din acești pixeli – 32 de octeți pe lățime și 24
pe înălțime. Fiecare octet spune ce culoare să aibă **Cerneala** (culoarea
pixelilor de cerneală), ce culoare **Hârtia** (culoarea pixelilor de hârtie),
dacă perechea are **Luminos** și dacă are **Clipire**.

Așadar forma imaginii are o rezoluție de 256 pe 192, iar culoarea ei una de 32
pe 24. Fiecare celulă de 8 pe 8 poate arăta două culori, iar fiecare pixel din
ea are una sau cealaltă.

![Două linii diagonale care se încrucișează pe o pânză mărită, cu grila de celule afișată. Linia albastră devine roșie în fiecare celulă prin care trece și linia roșie](img/attribute-clash.png)

*O linie albastră și una roșie care se încrucișează, la 800% cu grila de celule.
Unde linia roșie trece printr-o celulă, linia albastră din acea celulă e și ea
roșie. Trăsătura roșie a venit a doua și a stabilit Cerneala pentru
toată celula, inclusiv pentru pixelii de cerneală puși deja de trăsătura albastră.*

Asta înseamnă „conflictul de atribute” (*attribute clash*). Desenul într-o parte
a unei celule schimbă culoarea a tot ce e în ea, și nicio setare nu îl oprește –
așa funcționează hardware-ul.

### Cum lucrați cu el

Majoritatea artiștilor Spectrum își planifică zonele de culoare înaintea
detaliilor, aranjând imaginea astfel încât granițele de culoare să cadă pe
granițele celulelor. Când o celulă are nevoie de o nuanță pe care nu o poate
ține, se folosește dithering: două culori întrețesute atât de fin încât ochiul
le amestecă.

PixULA vă ajută în trei moduri.

**Grila de celule.** Activați-o lângă comenzile de zoom și veți vedea exact unde
o schimbare de culoare e gratuită și unde vă va costa.

**Modurile de desen.** O trăsătură nu trebuie să schimbe deodată și pixelii, și
atributele. Puteți desena pixeli de cerneală fără să atingeți atributele sau
recolora o celulă fără să atingeți vreun pixel. Capitolul despre culoare le enumeră.

**Biblioteca de modele.** Nucleul ei este un set de plăci cu densități
măsurate de pixeli de cerneală – la ele apelați când o celulă are nevoie de un gri pe care nu
îl poate ține.

### Vizualizarea pixelilor

Trei comutatoare din meniul Vizualizare schimbă ceea ce arată ecranul, fără să
schimbe imaginea. **Atribute oprite** arată pixelii de cerneală în negru și pixelii
de hârtie în alb, ca să vezi care pixeli sunt cu adevărat de cerneală. **Grilă de culori** face același lucru și
colorează în plus celulele ca o tablă de șah, ca limitele celulelor să se vadă
bine; ea și Atribute oprite se opresc una pe alta. **Oprește clipirea** păstrează
fiecare celulă care clipește în culorile ei normale. Niciunul nu atinge
imaginea, anularea sau o exportare: o imagine salvată arată la fel, fie că sunt
pornite sau nu. Browserul le reține, iar un comutator care nu poate funcționa în
modul de ecran curent este gri – treci cu mouse-ul peste el ca să vezi de ce. În
GigaScreen și MultiGiga, Atribute oprite arată patru niveluri de gri: alb unde
niciun ecran nu are pixel de cerneală, gri deschis pentru un pixel de cerneală
doar pe ecranul A, un gri
mai închis doar pe ecranul B și negru pentru ambele.

### Citirea cursorului

Banda de sub imagine și bara de stare spun unde este cursorul. În
**Preferințe**, *Citirea cursorului arată* adaugă atributul de sub cursor
(numărul lui în zecimal și în hexazecimal, apoi Cerneală, Hârtie, Luminos și
Clipire; CLUT în ULAplus; ambele ecrane în GigaScreen) și adresa de memorie a
octetului pixelului și a octetului lui de atribut. Adresele există acolo unde
mașina reală are o dispunere fixă: ULA standard și ULAplus (fișierul de afișare
de la $4000, atributele de la $5800), Timex hi-colour (atributele în al doilea
fișier de afișare, la $6000), Timex hi-res (coloanele de octeți pare la $4000,
cele impare la $6000) și GigaScreen (ecranul A ca cel standard, ecranul B în
banca 7 la $C000; care ecran aparține cărei bănci este o convenție). Celelalte
moduri spun că nu au adresă.

*Y se numără de la* poate fi pus pe jos, ca citirea să arate ca în BASIC PLOT,
unde 0,0 este colțul din stânga jos, iar Y merge de la 0 la 175. Aceasta există
doar pe cele 176 de rânduri de sus ale unei imagini de 256 pe 192; dedesubt și
pe alte ecrane citirea arată o liniuță. Schimbă doar citirea.

**Grilă personalizată...** din meniul Vizualizare desenează o grilă cu orice pas
X și Y, setate separat, iar **Arată grila personalizată** o pornește și o
oprește. Liniile mai apropiate de patru pixeli pe ecran sunt omise până faci
zoom. Grilele pornite revin la următoarea deschidere a programului. În
Preferințe, *Culorile grilelor* stabilește culoarea fiecărei grile; dacă lași
bifat *Culoarea temei*, grila urmează tema.

### Unde regulile sunt altele

Hardware-ul de mai târziu a relaxat constrângerea în diverse feluri, iar PixULA
poate lucra cu toate. Calculatoarele Timex au făcut grila de atribute mai fină.
ULAplus a înlocuit cele șaisprezece culori fixe cu o paletă aleasă de dvs.
GigaScreen alternează două imagini suficient de repede încât să sugereze culori
pe care niciuna nu le conține. ZX Spectrum Next renunță complet la schemă în
modurile Layer 2 și LoRes, unde fiecare pixel are propria culoare.

Puteți muta o imagine între oricare dintre ele – vedeți capitolul următor.
