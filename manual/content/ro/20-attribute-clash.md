## Conflictul de atribute

Spectrum păstrează o imagine în două părți separate.

Prima este un bitmap: 256 pe 192 de puncte, câte un bit fiecare, aprins sau
stins. A doua este o grilă de culoare, câte un octet pentru fiecare bloc de 8 pe
8 din aceste puncte – 32 de octeți pe lățime și 24 pe înălțime. Fiecare octet
spune ce culoare să aibă **cerneala** (punctele aprinse), ce culoare
**hârtia** (punctele stinse), dacă perechea este **luminoasă** și dacă trebuie
să **clipească**.

Așadar forma imaginii are o rezoluție de 256 pe 192, iar culoarea ei una de 32
pe 24. Fiecare celulă de 8 pe 8 poate arăta două culori, iar fiecare punct din
ea are una sau cealaltă.

![Două linii diagonale care se încrucișează pe o pânză mărită, cu grila de celule afișată. Linia albastră devine roșie în fiecare celulă prin care trece și linia roșie](img/attribute-clash.png)

*O linie albastră și una roșie care se încrucișează, la 800% cu grila de celule.
Unde linia roșie trece printr-o celulă, linia albastră din acea celulă e și ea
roșie. Trăsătura roșie a venit a doua și a stabilit culoarea cernelii pentru
toată celula, inclusiv pentru punctele puse deja de trăsătura albastră.*

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

**Modurile de desen.** O trăsătură nu trebuie să schimbe deodată și punctele, și
culorile. Puteți pune puncte fără să atingeți culorile sau recolora o celulă fără
să atingeți vreun punct. Capitolul despre culoare le enumeră.

**Biblioteca de modele.** Nucleul ei este un set de plăci cu densități de
cerneală măsurate – la ele apelați când o celulă are nevoie de un gri pe care nu
îl poate ține.

### Unde regulile sunt altele

Hardware-ul de mai târziu a relaxat constrângerea în diverse feluri, iar PixULA
poate lucra cu toate. Calculatoarele Timex au făcut grila de culoare mai fină.
ULAplus a înlocuit cele șaisprezece culori fixe cu o paletă aleasă de dvs.
GigaScreen alternează două imagini suficient de repede încât să sugereze culori
pe care niciuna nu le conține. ZX Spectrum Next renunță complet la schemă în
modurile Layer 2 și LoRes, unde fiecare pixel are propria culoare.

Puteți muta o imagine între oricare dintre ele – vedeți capitolul următor.
