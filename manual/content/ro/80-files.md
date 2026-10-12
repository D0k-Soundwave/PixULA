## Fișiere

Puteți salva două lucruri diferite și contează la care apelați.

**Un proiect** păstrează munca așa cum ați lăsat-o: fiecare strat, paleta, modul
de ecran, instrumentele și setările lor, imaginea de referință și locul în care
priveați. Este un fișier `.pixula`, scris de **Fișier > Salvează proiectul**, și
pe el îl folosiți cât timp o imagine este încă în lucru.

**O imagine** este un singur ecran aplatizat într-un format pe care alt program
îl înțelege – un `.scr` pentru un emulator, un `.png` de arătat, un `.tap` de
încărcat pe hardware real. **Fișier > Salvează imaginea ca** le scrie. Conțin
imaginea și nimic altceva, ceea ce vreți când predați rezultatul, și nu ce vreți
dacă intenționați să lucrați mai departe la ea.

### Importul unei imagini

Deschiderea unei fotografii sau a altei imagini (PNG, JPG, GIF) arată trei conversii una lângă alta - Clară, Fină și Plată - iar tu o alegi cu un clic pe cea care îți place. Fină este cea care transformă nuanțele în puncte, iar lista **Dither** de sub previzualizări alege cum: implicit este Floyd-Steinberg propriu al importului, iar lista oferă și celelalte 30 de metode ZX Paintbrush - praguri, difuzia erorii, matrice Bayer, puncte grupate și supercelule. Alegerea unei metode trece la previzualizarea Fină. Metodele ordonate continuă peste celulele de atribute, deci modelul străbate toată imaginea; difuzia erorii rămâne în interiorul fiecărei celule, fiindcă fiecare celulă are cele două culori ale ei. În modurile Layer 2 și LoRes lista este estompată: aceste moduri își păstrează propriul dither de culoare.

### Salvarea unei părți dintr-o imagine

**Fișier > Salvează selecția ca** listează aceleași formate ca Salvează imaginea ca, fiecare deschis doar dacă selecția i se potrivește. PNG, BMP și JPEG primesc orice dreptunghi. ZXP, SEV, ZED, ASM, C, BIN și ATR primesc celule de atribute întregi: selecția este mai întâi potrivită la celule, iar bara de stare spune asta. ColorTiles primește plăci întregi de 16x16. Formatele care sunt o copie a unui ecran întreg (SCR, benzi, MLT și altele asemenea) sunt deschise doar când selecția este ecranul întreg. ASM, C, BIN și ATR scriu partea rând cu rând: bitmapul ca bloc de octeți pe rând, de sus în jos, iar atributele un octet pe celulă; fac asta în modurile clasic, multicolor și ULAplus. O selecție de mână liberă sau eliptică salvează dreptunghiul ei de încadrare. Un format închis spune de ce când îl indici. Salvează imaginea ca salvează întreaga imagine și ignoră selecția.

### O imagine nouă dintr-o selecție

**Editare > Imagine nouă din selecție** face din selecție întreaga imagine. Selecția este mai întâi potrivită la celule întregi. Întreabă înainte să facă ceva, iar Ctrl+Z aduce înapoi imaginea veche. Toate straturile rămân, tăiate la acel bloc, care trece în colțul stânga-sus; restul este gol, iar fundalul de acolo este hârtie albă. Modul de ecran rămâne același, iar imaginea devine fără nume, deci următorul Salvează cere un nume.

### Salvare automată și copii de rezervă

PixULA vă poate salva munca în spațiul de stocare al browserului la fiecare
câteva minute și v-o poate oferi înapoi dacă o sesiune se termină prost. E oprit
până alegeți frecvența: setați **Salvare automată la fiecare (minute, 0 =
oprit)** în Preferințe, la General.

Puteți alege și un folder pe disc, iar fiecare salvare automată va scrie în el o
versiune numerotată – `picture V1.pixula`, `picture V2.pixula` și așa mai
departe. Numerotarea este citită din folder de fiecare dată, așa că redeschiderea
unei imagini continuă secvența în loc să reînceapă de la V1, iar două sesiuni pe
aceeași imagine împart un singur set de versiuni. Setați câte să păstrați în
Preferințe; valoarea implicită este 20.

Un lucru de așteptat. Un browser nu redeschide un folder ales într-o sesiune
anterioară fără confirmarea dvs., iar temporizatorul salvării automate nu poate
cere în locul dvs. Așa că prima copie după o reîncărcare se oprește și vă
așteaptă. Preferințele au un buton **Reia copiile de rezervă**, iar apăsarea lui
este confirmarea pe care o așteaptă browserul.

{{formats}}
