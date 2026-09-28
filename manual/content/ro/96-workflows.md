## Fluxuri de lucru

Câteva sarcini obișnuite, de la început la sfârșit.

### Prima imagine

1. Deschideți `PixULA.html`. Începeți în ULA standard cu un ecran gol de 256 pe
   192.
2. Activați grila de celule, lângă comenzile de zoom, ca să vedeți blocurile de
   8 pe 8 în care se stochează culoarea.
3. Alegeți o culoare de cerneală din bara de culori sau cu tastele 1–8 și o
   culoare de hârtie cu clic dreapta pe o mostră.
4. Desenați cu **Pensula**. Butonul stâng pentru cerneală, dreptul pentru
   hârtie.
5. Faceți zoom cu `+` și `-`. Țineți apăsată bara de spațiu și trageți ca să vă
   deplasați sau folosiți instrumentul **Deplasare vedere**.
6. `Ctrl+Z` anulează. `Ctrl+S` salvează un proiect `.pixula`, care păstrează
   straturile și setările pe lângă imagine.

Stabilirea zonelor de culoare înaintea detaliilor economisește de obicei muncă,
pentru că o graniță de culoare care nu cade pe o graniță de celulă va schimba
mereu culori pe care le-ați stabilit deja.

### Copierea după o fotografie

1. Deschideți panoul **Referință** și încărcați fotografia. Stă în spatele
   desenului la opacitatea, poziția și scara pe care le setați și nu face
   niciodată parte din imaginea salvată.
2. Desenați peste ea pe un strat normal.
3. Dacă referința pare vreodată mai puțin clară decât originalul, panoul vă
   spune și oferă un buton **Găsește fotografia**. PixULA face legătura cu
   fișierul de pe disc, așa că dacă fotografia e mutată, rămâne doar o mică
   previzualizare.

### Convertirea unei fotografii

Ca să lăsați PixULA să facă conversia:

1. **Fișier > Încarcă** și alegeți un `.png`, `.jpg` sau `.gif`.
2. Fereastra de import arată trei conversii una lângă alta: Clar, Fin și Plat.
   Care arată cel mai bine depinde în întregime de fotografie, așa că merită să
   le comparați pe toate trei de fiecare dată.
3. Reglați luminozitatea, contrastul și scalarea până când previzualizarea se
   citește bine, apoi acceptați.

În ULAplus și în modurile Next paleta este construită din imaginea dvs., așa că
nu sunteți limitat la cele șaisprezece culori ULA. De obicei asta face o mare
diferență.

### Crearea unui font

1. **Fișier > Editor de fonturi**.
2. Porniți de la fontul ZX ROM sau importați un set `.ch8` ori `.chr`.
3. Selectați un caracter și editați-l. Sunt disponibile lățimi de 4, 6 și 8
   pixeli, dar îngustarea aruncă definitiv coloanele din dreapta, așa că dacă
   experimentați, urcați de la îngust.
4. Dați fontului un nume ca să-l adăugați în bibliotecă.
5. Selectați instrumentul **Text**. Fontul dvs. apare în lista lui lângă cel
   ROM. Tastați, plasați textul și scalați-l sau rotiți-l înainte de a-l fixa –
   este redesenat din glife pe parcurs, așa că rămâne clar la orice dimensiune.

### Construirea unei hărți din plăci

1. Desenați pe pânză celulele pe care vreți să le folosiți ca plăci.
2. **Fișier > Editor de hărți** și capturați-le în setul de plăci.
3. Setați dimensiunea hărții și pictați. Butonul stâng pune o placă, dreptul
   șterge, iar umplerea înlocuiește o zonă conectată de plăci identice.
4. Exportați ca `.zxtm` ca să lucrați mai departe sau ca asamblare, C ori binar
   brut de folosit într-un program.

### Desenul pentru ZX Spectrum Next

1. Alegeți un mod Next din meniul Imagine – Layer 2 lat de 256, 320 sau 640 ori
   unul dintre modurile LoRes.
2. În aceste moduri nu există conflict de atribute; fiecare pixel are propriul
   index de paletă. Ce gestionați este o paletă de 256 de culori pe nouă biți,
   editată din **Imagine > Editează paleta** și salvată ca `.pal` sau `.npl`.
3. Salvați imaginea ca `.nxi`, care conține paleta, sau ca `.sl2` pentru
   bitmapul brut.
4. Pentru sprite-uri, folosiți **Fișier > Editor de sprite-uri** și salvați
   foaia ca `.spr`.

Puteți converti o imagine clasică într-un mod Next și înapoi. Întoarcerea
înseamnă potrivirea din nou a fiecărei celule la două culori, așa că așteptați-vă
să pierdeți detalii în acea direcție; PixULA vă spune înainte s-o facă.

### O imagine pe hardware real

- **Pentru un emulator**, salvați un `.scr`. Este conținutul brut al memoriei de
  ecran a Spectrum-ului și orice emulator îl citește. Dimensiunea exactă depinde
  de modul de ecran – tabelul din capitolul despre modurile de ecran o dă pentru
  fiecare.
- **Pentru o mașină reală**, salvați un `.tap` sau `.tzx`. Ca să adăugați ecranul
  pe o bandă care conține deja alte fișiere, folosiți **Fișier > Blocuri de
  bandă**.
- **Ca să-l arătați cuiva fără Spectrum**, salvați un `.png`. Dacă imaginea
  folosește celule care clipesc, salvați un `.gif` și bifați **Animează
  celulele CLIPIRE** – se scrie o buclă de două cadre în ritmul hardware-ului,
  așa că clipirea supraviețuiește.
