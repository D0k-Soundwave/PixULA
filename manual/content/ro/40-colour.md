## Culoarea

În modurile clasice nu alegeți culoarea unui pixel. Alegeți cele două culori pe
care le va folosi o celulă întreagă, plus două indicatoare.

- **CERNEALĂ** este culoarea pixelilor de cerneală.
- **HÂRTIE** este culoarea pixelilor de hârtie.
- **LUMINOS** le ridică pe amândouă la varianta mai deschisă. Există un
  indicator Luminos pe celulă, deci Cerneala și Hârtia sunt luminoase
  împreună sau deloc.
- **CLIPIRE** schimbă între ele Cerneala și Hârtia de aproximativ două ori pe
  secundă pe hardware-ul real.

Butonul stâng al mouse-ului desenează pixeli de cerneală. Cel drept desenează
pixeli de hârtie și setează aceleași patru atribute pe care le-ar seta cel
stâng. La un stilou, butonul lateral face ce face butonul drept.

**Radiera** face altceva decât amândouă. Transformă pixelii de cerneală în
pixeli de hârtie și lasă atributele celulei neatinse, chiar și când șterge
ultimul pixel de cerneală din celulă. Ca să ștergeți și atributele, treceți din
nou cu radiera peste celula goală cu o trăsătură nouă: Cerneala, Hârtia,
Luminos și Clipire revin la negru pe alb, iar pe un strat superior celula
devine din nou transparentă. O celulă care mai are pixeli de cerneală își
păstrează atributele, oricât de des ați trece cu radiera peste ea.
Opțiunea **Atribute** a radierei, vizibilă în modurile de ecran cu atribute de
celulă, schimbă asta: Setează pe cele curente șterge pixelii de cerneală și dă
celulei atributele din bară, ca unealta de ștergere din ZX Paintbrush, iar Păstrează,
implicit, este comportamentul descris mai sus.

Fiecare dintre cele patru poate fi pusă și pe **folosește existentul**: căsuța
în carouri de sub ea din bara de culori. O trăsătură lasă atunci acea parte a
fiecărei celule așa cum este, în loc să scrie setarea dumneavoastră. Puneți
CERNEALĂ, HÂRTIE și LUMINOS pe existent și porniți CLIPIRE, iar opțiunea **Umple
doar atributele** a uneltei de umplere face să clipească o zonă întreagă fără a
schimba vreo culoare. Shift+B și Shift+F comută LUMINOS și CLIPIRE, iar Shift+T
le pune pe toate patru pe existent. În ULAplus, LUMINOS și CLIPIRE aleg CLUT-ul,
așa că selectorul de CLUT are o singură căsuță, care păstrează CLUT-ul fiecărei
celule.

### Moduri de desen

Modul de desen schimbă ce face o trăsătură. Se păstrează între sesiuni, așa că
bara de stare îl arată ori de câte ori este altul decât Normal – în unele dintre
aceste moduri o trăsătură nu lasă nimic vizibil și altfel n-ați avea cum să
aflați de ce.

Bara de sus are trei butoane: **Mod de desen**, **Unealtă de celulă** și
**Oglindă**. Fiecare arată alegerea în vigoare. Fă clic pe el și dedesubt se
deschide o grilă mică cu celelalte alegeri; fă clic pe una și grila se închide.
Apasă Escape, sau fă clic în altă parte, ca s-o închizi fără nicio schimbare.
Modul de desen și Oglinda lucrează împreună: cu XOR și Orizontal, o trăsătură
este o trăsătură XOR oglindită. Unealta de celulă, când una este pornită, preia
fiecare trăsătură.

{{draw-modes}}

Pensula în toate formele ei, umplerea, formele, curba Bézier, textul, ștampilele
din panoul **Ștampile** și butonul stâng al gradientului urmează modul de desen.
Radiera, pipeta, mutarea, lipirea și ștergerea unei selecții, panoul
**Transformare**, opțiunea **Umple doar atributele** și butoanele Schimbă și
Recolorează îl ignoră.

**Recolorează cerneala nu este același lucru cu Recolorează.** Recolorează
cerneala și Recolorează hârtia sunt moduri de desen: recolorează fiecare celulă
atinsă de unealta curentă - câteva cu o pensulă mică, fiecare celulă acoperită
de un dreptunghi plin - și Oglinda se aplică. **Recolorează**, din butonul
Unealtă de celulă, recolorează întreaga celulă de sub cursor, orice unealtă ar
fi aleasă, ignorând mărimea pensulei și Oglinda. **Schimbă**, din același buton,
funcționează la fel și schimbă Cerneala cu Hârtia fiecărei celule. Oricare
rămâne pornit până îl oprești - alege Niciuna, alege-l din nou, fă clic dreapta
pe pânză sau alege o unealtă ori un mod de desen - iar bara de stare spune asta
cât timp este pornit.

**Copiază atributele, Inversează pixelii și Inversează pixelii și atributele**
sunt încă trei unelte de celulă în același buton Unealtă de celulă și
funcționează la fel: alege una, apoi fă clic sau trage peste celule. Fiecare
tragere se anulează dintr-un pas, iar unealta rămâne pornită până o oprești.
**Copiază atributele** ia atributele pe care le arată celula de sub primul tău
clic și le dă fiecărei celule peste care tragi; bara de culori nu se schimbă.
**Inversează pixelii** transformă pixelii de cerneală ai fiecărei celule întregi
în pixeli de hârtie și pixelii de hârtie în cerneală, lăsând atributele (o
celulă goală o umple). **Inversează pixelii și atributele** schimbă în plus
Cerneala cu Hârtia, astfel
încât fiecare celulă arată la fel; servește la ordonarea unei imagini importate,
sare peste celulele în care desenează și alt strat și nu este oferit în ULAplus
și ULANext. O unealtă de celulă este oferită doar în modurile de ecran în care
poate funcționa: butonul Unealtă de celulă listează doar pe cele potrivite (și
este ascuns acolo unde niciuna nu se potrivește), iar Inversează pixelii
funcționează și în Timex Hi-res, unde pixelii sunt în celule de 8 pe 8.

**XOR / Peste și XOR / Fiecare trecere** inversează pixelii, din cerneală în
hârtie și din hârtie în cerneală, în loc să deseneze pixeli de cerneală, și
amândouă dau celulei atributele alese. XOR / Peste inversează fiecare
pixel o dată pe trăsătură, deci revenirea peste propria linie în aceeași
trăsătură nu mai schimbă nimic. XOR / Fiecare trecere inversează un pixel de
fiecare dată când trăsătura trece peste el: o mișcare a pensulei este o trecere,
oricât s-ar suprapune pensula cu ea însăși pe drum, dar o trăsătură care
părăsește un pixel și revine îl inversează din nou, așa că un opt se anulează
acolo unde se intersectează. Formele, curbele, umplerile și textul sunt
întotdeauna o singură trecere, deci la ele cele două moduri dau același
rezultat.

**Invers** schimbă ce fac cele două butoane ale mouse-ului: cel stâng desenează
pixeli de hârtie, cel drept pixeli de cerneală, ca INVERSE 1 din BASIC. Se pornește în Preferințe, sau cu Shift+I, iar bara de stare spune „Inversul este pornit”
cât timp este. Nu schimbă nimic în Recolorează cerneala, Recolorează hârtia și
în cele două moduri XOR, unde ambele butoane fac același lucru, iar bara de
stare o spune. Textul și ștampilele își desenează literele și formele în pixeli
de hârtie în loc de pixeli de cerneală, un model își pune pixelii de cerneală ca
pixeli de hârtie și pixelii de hârtie ca cerneală, iar umplerea umple cu pixeli
de hârtie cu butonul stâng și cu pixeli de cerneală cu cel drept. Radiera,
Schimbă și Recolorează îl ignoră. Este reținut între sesiuni și salvat în
presetări împreună cu modul de desen.

**Nucleu de atribute.** Pentru pensula rotundă și pătrată, contururile formelor
și curba Bézier, Nucleu de atribute spune cât dintr-o linie groasă preia
atributele celulei. O linie desenează întotdeauna toți pixelii de cerneală. Cu
Nucleu de atribute pe 1 pixel sau 4 pixeli, doar celulele de sub mijlocul
liniei, o linie atât de lată care urmează centrul ei, preiau atributele tale;
celelalte celule de dedesubt primesc pixelii de cerneală în atributele pe care
le aveau deja, așa că o linie groasă se ciocnește cu mai puține celule. Toată
linia, implicit, dă atributele tale fiecărei celule atinse de linie. Opțiunea
apare doar în modurile de ecran cu atribute de celulă. Cu Oglindă, linia
oglindită are un nucleu propriu, iar cu XOR celulele din afara nucleului își
păstrează atributele.

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

**Locurile paletei.** Paleta ULAplus și paleta Next au câte patru locuri, în Imagine > Paletă (Locul 1 – Locul 4). Locul folosit este bifat, iar editorul de paletă spune pe care îl editează. Un document nou începe pe Locul 1, iar celelalte rețin paleta implicită până le folosești. Alegerea altui loc schimbă culorile cu care este afișată imaginea și nu schimbă niciodată atributele imaginii. Fiecare alegere este un pas de anulare. Locurile se salvează într-un proiect și în copia automată, dar abia după ce ai folosit un loc; o imagine deschisă dintr-un alt fel de fișier începe pe Locul 1, iar celelalte rețin copii ale paletei ei. Exporturile .scr, .tap și de imagine folosesc mereu locul în uz. Modurile cu paletă fixă (ULA standard, modurile Multicolor, GigaScreen și modurile Timex) nu au locuri.

**Inversează paleta** (doar ULAplus) schimbă jumătatea de Cerneală (intrările 0-7) cu jumătatea de Hârtie (intrările 8-15) a fiecăreia dintre cele patru CLUT, într-un pas de anulare; făcut de două ori, readuce paleta. Ca să inversezi o imagine ULAplus astfel încât să arate la fel, folosește Inversează paleta, apoi Imagine > Atribute > Inversează. Bordura urmează jumătatea de Hârtie a CLUT 0, deci își schimbă și ea culoarea. Modurile Next nu au inversor de paletă, pentru că ULANext ține Cerneala în 8 intrări de paletă și Hârtia în 32.

**Tastele CLUT.** În modurile ULAplus, Ctrl+Shift+1 până la Ctrl+Shift+4 aleg CLUT 0-3, ca alegerea CLUT din bara de culori. În alte moduri bara de stare spune asta și nu se întâmplă nimic altceva.

**Culori standard.** În Setări > Preferințe, Culori standard permite schimbarea celor 15 culori pe care le arată modurile Standard, Multicolor, GigaScreen și Timex. Negrul strălucitor este mereu negru. Culorile schimbă ce vezi și ce conțin exporturile de imagini (PNG, GIF, BMP, JPG); nu schimbă niciodată octeții fișierelor .scr sau .tap, iar importul unei imagini se potrivește în continuare cu culorile originale ale Spectrum-ului, deci aceeași fotografie dă aceeași imagine pe orice mașină. Paletele ULAplus și Next sunt separate. OK aplică culorile, Anulează nu păstrează nimic, iar Revino la standard le pune la loc pe cele originale. Sunt păstrate în acest browser, nu în proiect. Încarcă .pal citește un fișier de culori standard ZX Paintbrush (256 de octeți), iar Salvează .pal scrie unul, ceea ce este calea de a-ți duce culorile în alt browser.

**Benzi cu paletă.** Fișier > Salvează paleta ca TAP scrie paleta ULAplus ca bandă de 176 de octeți. Încărcată pe un Spectrum cu `LOAD ""`, setează cele 64 de intrări ale paletei și apoi încarcă următorul fișier de pe bandă, deci o bandă cu paletă poate sta înaintea unei benzi cu imagine sau joc. Fișier > Încarcă paleta și Fișier > Deschide citesc benzile cu paletă: cele ale PixULA și cele ZX Paintbrush. O bandă cu paletă intră în locul de paletă în uz printr-un pas de anulare și nu devine fișierul deschis.

### GigaScreen

GigaScreen păstrează două ecrane întregi și le afișează alternativ, de cincizeci
de ori pe secundă. Ochiul amestecă cele două culori ale fiecărui pixel într-una,
așa că o celulă cu o Cerneală și o Hârtie pe fiecare ecran poate arăta **patru**
culori, iar imaginea întreagă poate ajunge la vreo sută.

Nu desenați niciodată pe un singur ecran. Fiecare trăsătură scrie pe amândouă,
iar bara de culori lucrează în perechi:

- **Ecranul A** și **Ecranul B** au fiecare propriile mostre de Cerneală și
  Hârtie și propriul **LUMINOS**. Clipire este o singură setare pentru
  amândouă.
- **Pictează** arată cele patru culori care rezultă din aceste alegeri,
  amestecate exact cum le arată pânza: Cerneală pe ambele ecrane, Cerneală doar
  pe A, Cerneală doar pe B și Hârtie pe ambele. Alegeți una și butonul stâng
  pictează cu ea. Butonul drept pictează mereu Hârtie pe ambele ecrane.
- Alegeți aceeași Cerneală pentru ambele ecrane și mostra din stânga sus din
  Pictează este acea culoare, pură – așa se desenează tot ce nu trebuie să pară
  amestecat.

Pipeta preia înapoi toate acestea: atributele ambelor ecrane și care dintre cele
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
  înaltă de 512 pe 192. Rezoluția înaltă nu are atribute de celulă – fiecare ecran
  are o schemă de culori pentru toată imaginea –, așa că bara arată un rând de
  scheme pentru Ecranul A și unul pentru Ecranul B, iar Pictează arată cele
  patru amestecuri ale lor. Acestea sunt fișiere `.hrg`.

Trecerea între oricare dintre modurile cu două ecrane păstrează ambele ecrane,
după aceleași reguli după care se convertește un ecran simplu.

### Atribute

Elementele Atribute din meniul Imagine schimbă atributele celulelor și lasă
pixelii pe loc. Inversează schimbă Cerneala cu Hârtia în fiecare celulă și
păstrează Luminos și Clipire. Șterge scrie atributele Cerneală, Hârtie,
Luminos și Clipire curente în fiecare celulă; casetele „folosește
existentul” păstrează ce are deja fiecare celulă. Oglindește orizontal și
Oglindește vertical oglindesc atributele celulelor. Fiecare comandă lucrează pe
selecție (toate celulele atinse) sau pe toată imaginea când nu e nimic
selectat, și se anulează dintr-un pas. Elementele sunt estompate în modurile
fără atribute de celulă (Timex Hi-res, Layer 2, LoRes), cât timp o ștampilă fără atribute proprii plutește și pe un strat blocat.

Modifică... găsește celulele după atributele lor și le înlocuiește. Caută indică ce celule se potrivesc: fiecare câmp este o valoare sau Oricare. Înlocuiește cu indică ce devin: fiecare câmp este o valoare sau Păstrează. Caseta arată câte celule se vor modifica înainte de a apăsa OK, iar OK se anulează dintr-un singur pas. GigaScreen are un grup pentru Ecranul A și unul pentru Ecranul B; în ULAplus, CLUT 0-3 ia locul opțiunilor Luminozitate și Clipire. Renunță nu schimbă nimic.

### Pixeli

Elementele Pixeli din meniul Imagine modifică pixelii și lasă atributele în celulele lor. Oglindire orizontală și Oglindire verticală oglindesc pixelii. Inversează pixelii și atributele inversează pixelii și schimbă și Cerneala cu Hârtia din fiecare celulă, astfel încât imaginea rămâne la fel. Nu este oferit în moduri fără atribute de celulă (Layer 2, LoRes, Timex Hi-res) și apare cenușiu cât timp o ștampilă plutește. În ULAplus și ULANext nu este oferit nici el, pentru că schimbarea Cernelii cu Hârtia ar schimba aspectul imaginii.

Alegerea Deplasare din secțiunea Deplasare a panoului Transformare stabilește ce se mută. Pixeli și atribute (implicit) mută celule întregi cu Hârtia lor. Doar pixeli mută pixelii cu un pixel sau o celulă pe rând. Doar atribute mută atributele celulelor câte o celulă. Panoul are și diagonale. Cât timp o ștampilă plutește, Deplasare este cenușie, pentru că o deplasare mută întreaga ștampilă.

Când există o selecție, săgețile urmează aceeași alegere Deplasare.

### Ștampile

Când o ștampilă este activă, panoul **Transformare** arată cum este așezată.

**Atribute** alege între Doar pixeli și Atribute proprii. Doar pixeli pune pixelii ștampilei în atributele din bara de atribute, ca întotdeauna. Atribute proprii pune atributele pe care le poartă ștampila, celulă cu celulă: o ștampilă din Editorul de hărți sau una copiată dintr-o imagine într-un mod cu atribute de celulă. O ștampilă copiată din imagine începe ca Doar pixeli, deci o lipire cade exact ca înainte. Atribute proprii așază ștampila pe celule întregi, ignoră modul de desen, bara de culori și comutatorul XOR, și nu poate fi scalată, rotită, curbată, răsturnată, inversată sau conturată; panoul le face gri și spune de ce. Schimbarea formei unei ștampile Doar pixeli renunță la atributele pe care le purta. Inversul tot schimbă ce fac pixelii de cerneală și pixelii de hârtie. Dacă celulele ștampilei au altă mărime decât modul de ecran curent, este posibil doar Doar pixeli.

**Transparență** (doar Atribute proprii) lasă să se vadă atributul deja aflat pe pagină în locul celui al ștampilei. Cerneala, Hârtia, Luminozitatea și Clipirea au fiecare câte o căsuță. ULAplus are o căsuță CLUT pentru Luminozitate și Clipire împreună. În GigaScreen fiecare căsuță acoperă ambele ecrane.

**Pixeli de hârtie** hotărăște ce fac pixelii de hârtie ai ștampilei. Păstrează fundalul lasă desenul de dedesubt în pace (o ștampilă cu atribute proprii tot recolorează Hârtia de dedesubt, dacă nu se vede Hârtia). Șterge fundalul face și desenul de dedesubt pixeli de hârtie, pe tot dreptunghiul ștampilei. Modurile de desen fără opus (XOR, Recolorează cerneala, Recolorează hârtia) și comutatorul XOR propriu al ștampilei lasă pixelii de hârtie în pace, iar panoul spune asta. Pixeli de hârtie este disponibil în orice mod de ecran, chiar și fără atribute de celulă.

**Convertește în doar pixeli** renunță definitiv la atributele ștampilei și păstrează pixelii. Alegerea Doar pixeli din Atribute le păstrează, deci te poți întoarce. Fiecare schimbare este un pas de anulare.

Cât timp este activă o ștampilă cu atribute proprii, comenzile Imagine > Atribute (Inversează, Șterge, ambele Oglindiri și Schimbă...) acționează asupra celulelor ștampilei în loc de imagine, fie că plutește, fie că este pusă deoparte. Ignoră selecția și nu ating niciodată pixelii ștampilei, iar o celulă pe care ștampila nu o acoperă rămâne cum este. Oglindirea oglindește celulele de atribute ale ștampilei, iar pixelii ei rămân pe loc. O ștampilă GigaScreen are un singur set de atribute pentru ambele ecrane, deci dialogul Schimbă arată un singur grup. Fiecare comandă este un pas de anulare. Pentru o ștampilă fără atribute proprii rămân estompate.
