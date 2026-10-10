## Instrumentele

Bara grupează instrumentele după ce fac imaginii: întâi tot ce pune cerneală,
apoi selecția, apoi ghidajul pe care îl face posibil selecția, apoi
instrumentele care plasează o lucrare terminată și, la final, cele care schimbă
doar vederea.

Modul de desen, oglinda și ghidajul se aplică tuturor acestor instrumente, așa
că se setează o dată în bara de moduri, în loc să apară în opțiunile fiecărui
instrument.

![Panoul de opțiuni ale uneltei cu setările pensulei](img/tool-options-brush.png)

*Opțiunile instrumentului selectat apar în acest panou – aici, ale pensulei.*

Pensula nu are cruce de ochire deasupra imaginii. De la dimensiunea 2 în sus,
conturul zonei pe care o va picta este indicatorul. La dimensiunea 1
indicatorul este un mic plus de trei pixeli, iar punctul din mijloc este pixelul
pe care pensula îl va picta, în culoarea în care îl va picta: cerneala dvs. cu
LUMINOS aplicat sau cerneala existentă a celulei când cerneala e setată pe
„folosește culoarea existentă”. În timp ce desenați, punctul arată ce tocmai ați
pictat. Deasupra zonei gri din jurul imaginii revine indicatorul normal. Spray,
Estompare, Model și Hașură funcționează la fel.

Multe opțiuni se aplică doar în combinație cu alta. Tabelele de mai jos au o
coloană **Afișată când** cu condiția în care apare fiecare rând; rândurile
marcate „întotdeauna” sunt acolo indiferent de restul.

**Figuri din puncte.** Lista Forme are un grup Figuri, desenate prin plasarea de puncte: Linie frântă, Poligon, Triunghi, Raze, Linie perpendiculară și Linie paralelă (tasta L alege instrumentul Figură). Fă clic pentru a adăuga un punct sau apasă și trage pentru un traseu liber. Dublu clic sau Enter termină figura, care rămâne pe imagine ca o previzualizare încă modificabilă; încă un Enter o desenează, într-un singur pas de anulare. Backspace scoate ultimul punct (un traseu liber întreg odată), Esc renunță la figură fără a desena, iar un clic în altă parte sau alegerea altui instrument o desenează. Triunghiul, Linia perpendiculară și Linia paralelă se termină singure la al treilea punct: trage prima linie, apoi fă clic pe ultimul punct. O Linie perpendiculară adaugă o a doua linie din piciorul perpendicularei punctului tău pe prima linie; o Linie paralelă adaugă o copie a primei linii cu punctul tău la mijloc. Razele unesc fiecare punct următor cu primul. Poligonul și Triunghiul pot fi umplute. Figurile respectă modul de desen, Inversul, căsuțele „folosește ce există”, oglindirea și ghidajul de desen ca orice formă, iar previzualizarea este exact ce se va desena.

**Stil de linie, Rotire și Rotunjire.** Instrumentul Formă, instrumentul Figură și curba Bézier împart un Stil de linie: Continuă, Linie întreruptă, Punctată, Linie-punct, Linie-punct-punct și Niciuna. Stilurile cu linii se desenează doar pe o linie de un pixel, deci sunt estompate peste grosimea 1; modelul urmează conturul, inclusiv colțurile, iar fiecare rază sau linie a unei figuri îl începe pe al ei. Niciuna nu desenează contur: folosește-o cu Umplut ca să desenezi doar interiorul. Curba Bézier nu are Niciuna. Rotire (de la -180 la 180 de grade, în sens orar) rotește un dreptunghi, un pătrat, un dreptunghi rotunjit, o elipsă sau un paralelogram în jurul mijlocului casetei lor, și rotește un arc, un sector, un triunghi, un romb sau un poligon regulat în jurul punctului unde ai apăsat. Rotunjire stabilește cât de rotunde sunt colțurile dreptunghiului rotunjit, de la colțuri drepte la 0 la capete semicirculare la 100. O curbă Bézier pe care o editezi încă este desenată când alegi alt instrument, iar Esc o renunță. Previzualizarea unei forme sau curbe arată copiile oglindite și rămâne în ghidajul de desen, ca desenul terminat.

**Editarea, mutarea, rotirea și clonarea unei figuri.** O figură terminată și o curbă Bézier rămân pe imagine ca previzualizare până le desenezi. Cât timp așteaptă, poți trage oricare dintre punctele lor pătrate ca să le remodelezi, poți trage figura ca s-o muți, poți trage butonul rotund de deasupra ca s-o rotești și poți folosi săgețile ca s-o muți (un pixel, sau o celulă cu Shift ori cu atragerea la grilă). Ctrl+Z anulează ultima dintre aceste editări, apoi figura însăși și abia apoi imaginea. Enter, un clic în altă parte, salvarea sau alegerea altui instrument o desenează, într-un singur pas de anulare. O formă din instrumentul Formă se desenează de obicei imediat ce dai drumul; bifează **Păstrează editabil** în opțiunile ei și așteaptă ca o figură, cu un mâner la fiecare capăt al tragerii. **Editare > Clonează ultima figură** (Shift+C) deschide o copie a ultimei figuri, forme sau curbe desenate, gata de mutat, rotit sau schimbat; ca să schimbi culorile sau stilul de linie al uneia deja desenate, apasă Ctrl+Z și apoi Clonează ultima figură. Cât timp o figură așteaptă, urmează culorile, stilul de linie și umplerea alese, ca desenul terminat. Curba Bézier face excepție: o modifici prin mânerele ei și o muți cu săgețile, dar nu poate fi trasă întreagă sau rotită, iar Ctrl+Z abandonează curba întreagă dintr-odată.

**Spray cu model.** Pune Distribuția sprayului pe **Model** și va așeza mici figuri întregi - cercuri, pătrate sau linii scurte - în loc de puncte. Alege figura, mărimea ei și dacă e plină sau doar contur; Debitul spune cât din zonă încearcă să acopere. În zona sprayului se așază doar figuri întregi, deci un spray prea mic pentru o figură nu desenează nimic.

{{tools}}
