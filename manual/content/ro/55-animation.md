## Animație

PixULA animează în două feluri. O **animație de ecran** schimbă toată imaginea
de la un cadru la altul. O **animație de sprite** schimbă un bloc din ea, o
figură care merge sau un steag care flutură, în timp ce restul imaginii stă pe
loc în spate. Amândouă respectă fiecare regulă a modului de ecran: un cadru e
făcut din celule de atribute întregi, deci nu împarte niciodată atributele
unei celule.

### Pornirea unei animații

![Meniul Animație](img/menu-animation.png)

![Dialogul Animație nouă de sprite](img/dialog-new-sprite.png)

**Animație > Animație nouă de ecran** face din imagine cadrul 1. Fiecare strat
devine animat: are conținut propriu în fiecare cadru.

**Animație > Animație nouă de sprite...** cere un nume, o lățime și o înălțime,
o poziție și câte cadre să aibă la început. Mărimea se rotunjește în sus la
celule întregi ale modului, iar dialogul spune ce a devenit: în modul 8x1,
20 x 20 devine 24 x 20. Folosește selecția ia mărimea și locul dintr-o
selecție. Ca să pui sprite-ul cu un clic, selectează întâi blocul cu unealta
Selecție (Mărime: Personalizată). **Animație nouă de sprite din selecție** mută
în plus blocul selectat pe stratul propriu al sprite-ului, ca și cadrul 1. O
linie punctată chiar în afara ferestrei lui arată unde este.

O imagine poate avea mai multe animații; selectorul din capul panoului
Animație alege pe cea deschisă. Modul de ecran nu se poate schimba cât timp
imaginea are animații.

### Cadre

![Panoul Animație cu cele șase cadre ale unei mingi care sare](img/animation-panel.png)

Panoul Animație arată fiecare cadru ca o imagine mică, cu numărul și
întârzierea lui. Fă clic pe unul ca să mergi la el, sau apasă `,` și `.` pentru
cadrul dinainte și cel de după. Desenezi pe cadrul afișat cu orice unealtă,
exact ca pe o imagine fixă: conflictul de atribute, modurile de desen,
Oglinda, ștampilele, Flash și Anulează merg ca întotdeauna.

Adaugă pune un cadru gol după cel afișat, iar Duplică o copie a lui; Șterge,
Stânga și Dreapta îl șterg și îl mută. Întârzierea e cât timp rămâne cadrul pe
ecran, în cadre Spectrum de 1/50 s, iar Setează la toate dă această întârziere
fiecărui cadru. Ca să duci o parte dintr-un cadru în următorul, copiaz-o
(**Animație > Cadru în ștampilă** copiază fereastra unui sprite), mergi la
cadrul următor și pune ștampila. Anularea unui pas făcut pe alt cadru te duce
înapoi la acel cadru.

**Animație > Ștampile în cadre** face un cadru nou din fiecare ștampilă din
lista Ștampile, pusă acolo unde stă ștampila; ștampilele rămân.

### Straturi într-o animație

![Panoul Straturi cu un strat animat, unul comun și cele două straturi de previzualizare ale foii de ceapă](img/animation-layers.png)

Cât timp o animație e deschisă, fiecare rând al panoului Straturi are un
comutator Animat / Comun. Un strat animat are conținut propriu în fiecare
cadru; unul comun arată la fel în fiecare cadru, ca un fundal desenat o dată.
Animat copiază stratul în fiecare cadru; Comun păstrează cadrul afișat, după ce
întreabă. Straturile noi intră în animația deschisă, iar Combină în jos,
Combină selectate și Aplatizează lucrează pe fiecare cadru.

### Redare

Redare (Enter) redă animația deschisă pe imagine; un sprite se mișcă peste
fundalul lui, iar FLASH și pâlpâirea GigaScreen continuă. Primul, Anterior,
Următorul și Ultimul trec prin cadre (ține apăsat Anterior sau Următorul ca să
continui), iar Stop revine la cadrul de la care a pornit redarea. Un clic pe
imagine sau Escape pune pe pauză. Repetare redă cadrele în buclă, o dată sau
dus-întors. Viteză redă mai repede sau mai încet fără să schimbe întârzierile,
iar Redă cadrele redă doar o parte a animației.

### Copierea cadrelor

**Copiază** sub un cadru arată acel cadru estompat cât desenezi celelalte, ca
strat de previzualizare în panoul Straturi. Comutatorul **Foaie de ceapă**
arată la fel cadrul dinainte și cel de după, care te urmează când schimbi
cadrul. **Strat > Strat nou de previzualizare** adaugă unul dintre ele singur.

Un strat de previzualizare urmează regula sistemului de straturi: pixelii lui
de hârtie și celulele goale sunt transparente, cerneala straturilor de deasupra
îl acoperă, iar peste ce e dedesubt se vede estompat. Mută-l în sus sau în jos
ca să stea deasupra sau dedesubtul stratului pe care desenezi. Fiecare are
propria opacitate, o nuanță (cadrele anterioare roșu, cele următoare albastru)
și arătare sau ascundere, iar ștergerea lui ia doar previzualizarea. O
previzualizare nu face niciodată parte din imagine: nu se desenează pe ea, nu se
combină și nu se exportă, iar în timpul redării e ascunsă.

### Exportul

**Animație > Exportă animația**:

- **Ecrane numerotate...** salvează fiecare cadru ca ecran Spectrum propriu,
  numerotat în ordine (`walk_001.scr`, `walk_002.scr` și așa mai departe), în
  orice format de ecran pe care modul îl poate salva. Fiecare fișier e exact
  ce scrie Salvează imaginea ca pentru acel cadru. Alegi numele, primul număr,
  cifrele și cadrele. Dacă browserul poate scrie într-un dosar, alegi unul;
  altfel ecranele vin într-un singur `.zip`.
- **GIF animat** redă cadrele cu întârzierile lor, cu tot cu FLASH și
  GigaScreen.
- **Foaie de sprite-uri PNG** pune cadrele unul lângă altul, câte 16 pe rând.
- **SevenuP, toate cadrele** scrie până la 32 de cadre într-un `.sev` (modul
  standard). Deschiderea unui `.sev` cu mai multe cadre face din ele o
  animație de sprite.
- **Casetă** scrie câte un SCREEN$ pe cadru într-un `.tap` sau `.tzx`. Conține
  ecranele, nu un program care să le redea.
- **Sprite-uri Next** scrie o animație de sprite de 16 x 16 din modurile
  Layer 2 și LoRes ca foaie `.spr`.

Animațiile se salvează în proiectele PixULA, în salvarea de recuperare și în
copiile de siguranță.
