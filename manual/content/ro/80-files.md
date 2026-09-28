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
