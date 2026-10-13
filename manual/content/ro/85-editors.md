## Editoarele

Patru lucruri pe care le face PixULA nu sunt imagini, și fiecare are propria
fereastră în meniul Fișier.

### Editorul de fonturi

Un set de caractere Spectrum are 96 sau 256 de glife, fiecare stocat ca un teanc
de octeți de rând. Acesta le editează câte o glifă pe rând.

![Editorul de fonturi, cu grila de glife pe o parte și un caracter în editare pe cealaltă](img/dialog-font-editor.png)

*Alegeți un caracter din grila din stânga și editați-l în dreapta.*

Glifele pot avea lățimea de 4, 6 sau 8 pixeli pe înălțimea celulei. Îngustarea
unui font aruncă definitiv coloanele din dreapta, așa că dacă încercați lățimi,
mergeți de la îngust la lat.

Puteți porni de la fontul ZX ROM, captura o glifă de pe pânză sau încărca un set
`.ch4`, `.ch6`, `.ch8`, `.chr` sau `.chx` dintr-un alt instrument Spectrum.
Denumirea unui font îl adaugă în biblioteca dvs., iar instrumentul Text îl oferă
apoi alături de fontul ROM încorporat.

**Fonturi mari.** Font mare nou... creează un set de fonturi mari CHX, de felul celui folosit de ZX-Editor Second Edition: fiecare caracter are 8, 16, 24 sau 32 de pixeli în lățime și în înălțime (lățimea și înălțimea se aleg separat), iar editorul arată dimensiunea în locul listei de lățimi. Bifează Umple cu un font ca să alegi orice font din aceeași listă pe care o folosește instrumentul Text, cât din înălțimea caracterului acoperă literele (în procente) și dacă stau la stânga, la mijloc sau la dreapta. Bifează Proporțional și fiecare literă se salvează doar atât de lată cât are nevoie, în coloane întregi de 8 pixeli, astfel încât un i ocupă mai puțin loc decât un W; caracterul Spațiu păstrează mereu cel puțin o coloană. Umple dintr-un font... face același lucru într-un singur pas cu un font mare pe care îl ai deja. Un font mare poate fi salvat doar ca `.chx` (celelalte formate și listările în asamblare, C și binar conțin caractere de 8 pe 8), nu poate captura o celulă din pânză și instrumentul Text nu îl oferă încă. Deschiderea unui `.chx` mare păstrează fiecare caracter la dimensiunea lui, iar un caracter pe care fișierul îl omite rămâne omis la salvarea următoare. Felul în care un caracter din mai multe blocuri de 8 pe 8 este așezat în fișier urmează descrierea publicată a formatului și nu a fost verificat cu un fișier salvat de ZX Paintbrush însuși, așa că deschide în ZX Paintbrush un font mare făcut aici înainte să te bazezi pe el.

**Umbrire și anulare.** Pentru un font ale cărui caractere au lățimea unui număr întreg de coloane de 8 pixeli, cele patru butoane de umbrire umbresc sau scot din umbră câte o coloană, la stânga sau la dreapta caracterului pe care îl editezi. O coloană umbrită este desenată hașurat și nu se salvează: un fișier `.chx` conține caracterul mai îngust, iar un caracter umbrit de la un capăt la altul este omis din fișier. Punctele de sub umbrire se păstrează în editor, deci scoaterea din umbră le readuce, dar ele nu sunt în fișier. Umbrește tot după potrivire face asta pentru toate caracterele deodată: umbrește coloanele goale de pe ambele părți ale punctelor, lasă Spațiului o coloană și omite celelalte caractere goale. Caracterul Spațiu păstrează mereu cel puțin o coloană, pentru că un fișier `.chx` trebuie să îl conțină. După o exportare `.chx`, linia de stare spune câte caractere au fost salvate mai înguste, câte au fost omise și câte aveau puncte sub umbrire. Editorul de fonturi are și Anulează și Refă (cele două butoane sau Ctrl+Z și Ctrl+Y): o trăsătură pe suprafața de editare este un pas, la fel ca fiecare buton, Font mare nou, Umple dintr-un font, Încarcă fontul ROM sau un import. Scrierea în caseta cu numele fontului nu intră aici.

**Toate caracterele.** Butonul Toate caracterele înlocuiește editorul unui singur caracter cu o hartă a întregului font, toate caracterele alăturate, câte 16 pe rând, pe care desenezi cu aceleași Pensulă, Radieră, Linie și Umplere, astfel încât o trăsătură poate trece de la un caracter la următorul. O trăsătură este o schimbare și un pas de anulare, iar Umplerea rămâne în interiorul caracterului pe care faci clic. Instrumentul Umbrește umbrește sau scoate din umbră coloana de 8 pixeli pe care faci clic, de la marginea cea mai apropiată a caracterului ei; coloanele umbrite sunt hașurate. Instrumentul Mută trage harta, așa o derulezi cu degetul, pentru că altfel harta păstrează fiecare atingere pentru desenat. Butoanele minus, Potrivește și plus schimbă mărirea în pași întregi. În hartă și în grila de caractere, săgețile, Home și End trec de la un caracter la altul, iar tastarea unui caracter îl alege. Nu se pot desena pixeli doar cu tastatura.

### Editorul de hărți

O hartă este o grilă de plăci, unde o placă este o celulă de 8 pe 8 – opt octeți
de bitmap și un octet de atribute. Hărțile vă permit să construiți un teren de
joc mai mare decât un singur ecran.

![Editorul de hărți, cu paleta de plăci și o zonă de hartă derulabilă](img/dialog-map-editor.png)

*Plăcile în stânga, harta în dreapta.*

Pictați cu butonul stâng și ștergeți cu cel drept sau folosiți umplerea ca să
înlocuiți o zonă conectată de plăci identice. Plăcile provin din modelul și
culorile curente sau direct de pe pânză. Puteți reda o hartă înapoi pe pânză, iar
o singură anulare inversează totul.

Salvați ca `.zxtm` ca să lucrați mai departe – este formatul propriu PixULA și
păstrează tot – sau ca `.zxm`, sau ca asamblare, C ori binar brut de inclus într-un
program.

### Editorul de sprite-uri

Sprite-urile Next au 16 pe 16 pixeli, cu un index de paletă pe pixel, iar o foaie
conține până la 64.

![Editorul de sprite-uri, cu o foaie de sprite-uri și grila de editare](img/dialog-sprite-editor.png)

*Foaia pe o parte, sprite-ul pe care îl desenați pe cealaltă.*

Foile de sprite-uri se păstrează în fișiere `.spr`, nu în imagine, așa că salvați
foaia separat. În modurile indexate puteți captura un sprite de pe pânză și
ștampila unul pe ea.

### Editorul de palete

**Imagine > Editează paleta**, în modurile care au paletă editabilă. Arată
ULAplus ca patru palete de câte șaisprezece și paleta Next ca rânduri de culori
pe nouă biți. Orice culoare alegeți este adusă la cea mai apropiată valoare pe
care hardware-ul o poate stoca efectiv, așa că ce vedeți este ce va arăta
mașina.

Fiecare modificare este un pas de anulare separat. Paletele pot fi și încărcate
și salvate fără a deschide această fereastră – vedeți capitolul despre culoare.

### Blocuri de bandă

**Fișier > Blocuri de bandă** deschide un `.tap` sau `.tzx` și listează ce
conține. Folosiți-l ca să încărcați un ecran de pe o bandă care are mai multe sau
ca să adăugați imaginea curentă pe o bandă ca bloc nou și să salvați din nou
banda.

Blocurile pe care nu le-ați atins sunt rescrise octet cu octet, așa că adăugarea
unui ecran pe banda altcuiva lasă restul exact cum era.
