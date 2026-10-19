## Szín

A klasszikus módokban nem egy pixel színét választod. Egy egész cella két színét
választod, meg két jelzőt.

- **TINTA** a tintapixelek színe.
- **PAPÍR** a papírpixelek színe.
- **FÉNYESSÉG** mindkettőt a világosabb változatukra emeli. Cellánként egy
  Fényesség-jelző van, így a Tinta és a Papír vagy együtt fényes, vagy egyik
  sem.
- **VILLOGÁS** a valódi hardveren másodpercenként nagyjából kétszer felcseréli a
  Tintát és a Papírt.

A bal egérgomb tintapixeleket rajzol. A jobb papírpixeleket rajzol, és
ugyanazt a négy attribútumot állítja be, amelyet a bal is beállítana. Tollnál az
oldalgomb ugyanazt teszi, mint a jobb egérgomb.

A **radír** mindkettőtől eltérően működik. A tintapixeleket papírpixelekké
változtatja, a cella attribútumait viszont érintetlenül hagyja, akkor is, ha a cella
utolsó tintapixelét radírozza ki. Ha az attribútumokat is törölni akarod, radírozz át újra az üres cellán egy új
vonással: a Tinta, a Papír, a Fényesség és a Villogás visszaáll fekete a
fehéren értékre, felsőbb rétegen pedig a cella ismét átlátszó lesz. Az a cella,
amelyben még vannak tintapixelek, megtartja az attribútumait, akárhányszor radírozol át
rajta.
A radír **Attribútumok** beállítása, amely a cellaattribútumokat használó képernyőmódokban
látszik, ezt változtatja meg: A jelenlegire állítás kiradírozza a tintapixeleket, és a
színsáv attribútumait adja a cellának, mint a ZX Paintbrush törlőeszköze, a Megtartás,
az alapértelmezés, pedig a fent leírt viselkedés.

A négy rész mindegyike **meglévő használata** állásba is tehető: ez a színsávban
alatta lévő kockás négyzet. Egy vonás ekkor minden cella adott részét úgy
hagyja, ahogy van, a beállításod írása helyett. Tedd a TINTÁT, a PAPÍRT és a
FÉNYESSÉGET meglévőre, kapcsold be a VILLOGÁST, és a kitöltés **Csak
attribútumok kitöltése** beállítása egy egész területet villogóvá tesz egyetlen
szín megváltoztatása nélkül. A Shift+B és a Shift+F a FÉNYESSÉGET és a VILLOGÁST
kapcsolja, a Shift+T pedig mind a négyet meglévőre állítja. ULAplus módban a
FÉNYESSÉG és a VILLOGÁS a CLUT-ot választja ki, ezért a CLUT-választónak
egyetlen négyzete van, amely minden cella saját CLUT-ját megtartja.

### Rajzolási módok

A rajzolási mód azt változtatja meg, mit tesz egy vonás. Munkamenetek között is
megmarad, ezért az állapotsor mindig mutatja, ha nem Normál – egyes módokban a
vonás semmi láthatót nem hagy, és különben nem tudnád, miért.

A felső sávnak három gombja van: **Rajzmód**, **Celláeszköz** és **Tükrözés**.
Mindegyik az éppen érvényes választást mutatja. Kattints rá, és alatta megnyílik
a többi választás kis rácsa; kattints az egyikre, és a rács bezárul. Az Esc
billentyűvel vagy máshová kattintással változtatás nélkül bezárhatod. A rajzmód
és a tükrözés együtt működik: XOR és Vízszintes beállítással egy vonás tükrözött
XOR-vonás. A celláeszköz, ha be van kapcsolva, átveszi az összes vonást.

{{draw-modes}}

Az ecset minden változata, a kitöltés, az alakzatok, a Bézier-görbe, a szöveg, a
**Bélyegzők** panel bélyegzői és az átmenet bal gombja követik a rajzolási
módot. A radír, a pipetta, a kijelölés mozgatása, beillesztése és törlése, az
**Átalakítás** panel, a **Csak attribútumok kitöltése** beállítás, valamint a
Felcserél és az Átszínezés gomb figyelmen kívül hagyja.

**A Tinta átszínezése nem ugyanaz, mint az Átszínezés.** A Tinta átszínezése és
a Papír átszínezése rajzmódok: minden cellát átszíneznek, amelyet az aktuális
eszköz érint - kis ecsetnél néhányat, kitöltött téglalapnál mindet, amelyet
lefed - és a tükrözés érvényes. Az **Átszínezés** a Celláeszköz gombban a mutató
alatti teljes cellát színezi át, bármelyik eszköz van kiválasztva, az
ecsetmérettől és a tükrözéstől függetlenül. A **Csere** ugyanabból a gombból
ugyanígy működik, és felcseréli minden cella Tintáját és Papírját. Mindkettő
addig marad bekapcsolva, amíg ki nem kapcsolod - válaszd a Nincs lehetőséget,
válaszd újra, kattints jobb gombbal a vászonra, vagy válassz eszközt vagy
rajzmódot - és az állapotsor kiírja, amíg be van kapcsolva.

Az **Attribútumok másolása, a Pixelek megfordítása és a Pixelek és attribútumok
megfordítása** három további celláeszköz ugyanabban a Celláeszköz gombban, és ugyanúgy
működnek: válassz egyet, majd kattints vagy húzz cellákon. Minden húzás egy
lépésben visszavonható, és az eszköz addig marad bekapcsolva, amíg ki nem
kapcsolod. Az **Attribútumok
másolása** felveszi az első kattintás alatti cella attribútumait, és megadja őket
minden cellának, amelyen végighúzol; a színsáv nem változik. A **Pixelek
megfordítása** minden egész cella tintapixeleit papírpixelekké, a papírpixeleit
tintapixelekké változtatja, az attribútumokat meghagyja (az üres cellát kitölti). A **Pixelek és attribútumok
megfordítása** ezen felül felcseréli a Tintát és a Papírt, így minden cella
ugyanúgy néz ki; importált kép rendbetételére való, kihagyja azokat a cellákat,
amelyekbe másik réteg is rajzol, és ULAplusban és ULANextben nem érhető el. A
celláeszközök csak azokban a képernyőmódokban érhetők el, ahol működhetnek: a
Celláeszköz gomb csak az érvényeseket sorolja fel (és el van rejtve ott, ahol
egy sem érvényes), a Pixelek megfordítása pedig a Timex Hi-resben is működik,
ahol a pixelek 8 × 8-as cellákban vannak.

**Az XOR / Fölé és az XOR / Minden áthaladás** megfordítja a pixeleket, a tintát
papírrá, a papírt tintává, ahelyett, hogy tintapixeleket rajzolna, és mindkettő a választott attribútumokat adja a cellának. Az
XOR / Fölé vonásonként egyszer fordít meg minden pixelt, így ha ugyanabban a
vonásban visszamész a saját vonaladon, az már semmin sem változtat. Az XOR /
Minden áthaladás minden alkalommal megfordít egy pixelt, amikor a vonás áthalad
rajta: az ecset egy húzása egy áthaladás, akármennyire fedi is önmagát útközben,
de ha a vonás elhagy egy pixelt, majd visszatér hozzá, újra megfordítja, így a
nyolcas ott kioltja magát, ahol keresztezi önmagát. Az alakzatok, a görbék, a
kitöltések és a szöveg mindig egyetlen áthaladás, így ezeknél a két mód ugyanazt
adja.

Az **Fordított** felcseréli, mit csinál a két egérgomb: a bal gomb
papírpixeleket rajzol, a jobb tintapixeleket, mint a BASIC INVERSE 1 utasítása. A Beállításokban kapcsolható be, vagy a Shift+I-vel, és az állapotsor kiírja, hogy „A fordított
mód be van kapcsolva”, amíg be van. A Tinta átszínezése, a Papír átszínezése és
a két XOR mód esetében nem változtat semmit, mert ott a két gomb ugyanazt teszi;
az állapotsor ezt is kiírja. A szöveg és a bélyegek a betűiket és alakzataikat
papírpixelekkel rajzolják tintapixelek helyett, a minta a tintapixeleit papírpixelként, a papírpixeleit tintaként rakja
le, a kitöltés pedig a bal gombbal papírpixelekkel, a jobbal tintapixelekkel tölt. A radír, a
Csere és az Átszínezés figyelmen kívül hagyja. A program megjegyzi a
munkamenetek között, és a rajzmóddal együtt a beállításkészletekben is
tárolódik.

Az **Attribútummag** a kerek és négyzetes ecsetnél, az alakzatok körvonalainál és a
Bézier-görbénél megadja, hogy egy vastag vonal mekkora része veszi át a cellák
attribútumait. A vonal mindig minden tintapixelt megrajzol. Ha az Attribútummag 1 pixel vagy 4
pixel, csak a vonal közepe alatti cellák veszik át az attribútumaidat, egy olyan széles
vonal, amely a középvonalat követi; az alatta lévő többi cella a tintapixeleket a már
meglévő attribútumaival kapja, így a vastag vonal kevesebb cellával ütközik. A teljes
vonal, az alapértelmezés, minden cellának, amelyet a vonal érint, a te attribútumaidat adja. A
beállítás csak cellaattribútumokat használó képernyőmódokban jelenik meg. Tükrözésnél
a tükrözött vonalnak saját magja van, XOR esetén pedig a magon kívüli cellák
megtartják az attribútumaikat.

### Paletták

Két módcsalád engedi magukat a színeket is megváltoztatni. Az ULAplus 64
színregisztert ad, négy tizenhatos palettába rendezve. A Next módok 256 színt
adnak, mindegyiket kilenc bitből.

A paletták fájlok. Készíthetsz egyet, elmentheted, és betöltheted egy másik
képbe a **Fájl > Paletta betöltése** és a **Fájl > Paletta mentése** menüponttal
vagy a palettaszerkesztőből. A betöltéshez nem kell megnyitnod a szerkesztőt,
hiszen palettát általában még a rajzolás előtt töltünk be.

Ahol egy fájlformátumban van hely palettának – a 6976 bájtos `.scr`, a `.nxi`, a
Timex-változat –, ott a paletta a képpel együtt utazik.

**Palettahelyek.** Az ULAplus palettának és a Next palettának egyaránt négy helye van, a Kép > Paletta menüben (1. hely – 4. hely). A használatban levő hely be van jelölve, és a palettaszerkesztő megmondja, melyiket szerkeszti. Az új dokumentum az 1. helyen indul, a többi hely az alapértelmezett palettát tartja, amíg nem használod őket. Másik hely választása a kép megjelenítési színeit változtatja, a kép attribútumait soha. Minden választás egy visszavonási lépés. A helyek a projektben és az automatikus mentésben tárolódnak, de csak akkor, ha használtál egy helyet; más fájltípusból megnyitott kép az 1. helyen indul, a többi hely a palettájának másolatát tartja. A .scr, .tap és képexportok mindig a használatban levő helyet használják. A rögzített palettájú módoknak (Standard ULA, a Multicolor módok, GigaScreen és a Timex módok) nincsenek helyeik.

**Paletta invertálása** (csak ULAplus) a négy CLUT mindegyikében felcseréli a Tinta-felet (0–7. bejegyzés) a Papír-fellel (8–15. bejegyzés), egy visszavonási lépésben; kétszer végrehajtva visszaáll a paletta. Hogy egy ULAplus kép invertálás után ugyanúgy nézzen ki, használd a Paletta invertálása parancsot, majd a Kép > Attribútumok > Invertálás parancsot. A keret a 0. CLUT Papír-felét követi, ezért ő is színt vált. A Next módoknak nincs palettainvertálója, mert az ULANext a Tintát 8, a Papírt 32 palettabejegyzésben tartja.

**CLUT billentyűk.** Az ULAplus módokban a Ctrl+Shift+1 – Ctrl+Shift+4 a 0–3. CLUT-ot választja, ugyanúgy, mint a színsáv CLUT-választója. Más módokban az állapotsor ezt közli, egyébként nem történik semmi.

**Szabványos színek.** A Beállítások > Beállítások ablak Szabványos színek részében megváltoztathatod azt a 15 színt, amelyet a Standard, Multicolor, GigaScreen és Timex módok mutatnak. A fényes fekete mindig fekete. A színek azt változtatják, amit látsz és amit a képexportok (PNG, GIF, BMP, JPG) tartalmaznak; a .scr és .tap fájlok bájtjait soha, és a kép importálása továbbra is az eredeti Spectrum-színekhez illeszt, így ugyanaz a fotó minden gépen ugyanazt a képet adja. Az ULAplus és a Next paletták külön vannak. Az OK alkalmazza a színeket, a Mégse semmit sem tart meg, a Visszaállítás szabványosra visszaadja az eredetiket. Ebben a böngészőben tárolódnak, nem a projektben. A .pal betöltése egy ZX Paintbrush szabványosszín-fájlt olvas (256 bájt), a .pal mentése ilyet ír; így viheted át a színeidet másik böngészőbe.

**Palettaszalagok.** A Fájl > Paletta mentése TAP-ként az ULAplus palettát 176 bájtos szalagként írja. Spectrumon `LOAD ""` paranccsal betöltve beállítja a 64 palettabejegyzést, majd betölti a szalag következő fájlját, így a palettaszalag állhat egy kép- vagy játékszalag előtt. A Fájl > Paletta betöltése és a Fájl > Megnyitás palettaszalagokat olvas: a PixULA sajátjait és a ZX Paintbrushét. A palettaszalag egy visszavonási lépésben kerül a használt palettahelyre, és nem lesz a megnyitott fájl.

### GigaScreen

A GigaScreen két teljes képernyőt tárol, és felváltva mutatja őket,
másodpercenként ötvenszer. A szem minden pixel két színét egybemossa, így egy
cella, amelynek mindkét képernyőn van egy Tintája és egy Papírja, **négy** színt
mutathat, az egész kép pedig nagyjából százat.

Sosem csak az egyik képernyőre rajzolsz. Minden vonás mindkettőre ír, és a
színsáv párokban dolgozik:

- A **Képernyő A** és a **Képernyő B** saját Tinta- és Papír-mintákkal és saját
  **FÉNYESSÉG** beállítással rendelkezik. A Villogás egyetlen közös beállítás.
- A **Festés** azt a négy színt mutatja, amely ezekből a választásokból adódik,
  pontosan úgy keverve, ahogy a vászon mutatja: Tinta mindkét képernyőn, Tinta
  csak az A-n, Tinta csak a B-n és Papír mindkettőn. Válassz egyet, és a bal
  gomb azzal fest. A jobb gomb mindig Papírt fest mindkét képernyőre.
- Válassz ugyanazt a Tintát mindkét képernyőre, és a Festés bal felső mintája
  ez a szín lesz, keveretlenül – így rajzolsz meg mindent, ami nem tűnhet
  kevertnek.

A pipetta mindezt visszaveszi: mindkét képernyő attribútumait és azt, hogy a négy
közül melyiket mutatja a pixel.

A megjelenítési gombok csak azt változtatják meg, mit mutat a vászon, azt
sosem, hová kerül a vonás. Az **Átlag** az, amit a szem a valódi gépen lát. A
**Villódzás** minden képkockában felcseréli a két képernyőt, ahogy a hardver is.
Az **A** és a **B** egy képernyőt mutat önmagában. A PNG-ként mentett vagy
exportált kép Átlagot használ, ha éppen Villódzás látszik, mert egy állókép nem
villódzhat.

A GigaScreenbe lépéskor a kép mindkét képernyőre átmásolódik, így ugyanúgy néz
ki, mint előtte. Kilépéskor az A képernyő megmarad, a B elvész; ha a B
képernyőn valami eltérő van, előre figyelmeztetést kapsz.

Ugyanez a munkamódszer két további villódzó módra is érvényes:

- A **MultiGigaScreen 8×4, 8×2 és 8×1** a két képernyőt a finomabb Multicolor
  cellákra teszi, így a négy szín 4, 2 vagy egyetlen soronként érvényes 8×8-as
  blokk helyett. Ezek a MultiArtist `.mg4`, `.mg2` és `.mg1` fájljai.
- A **Timex Hi-res GigaScreen** két 512×192-es nagy felbontású képernyőt
  váltogat. A nagy felbontásnak nincsenek cellaattribútumai – minden képernyőnek egy
  színsémája van az egész képre –, ezért a sáv egy sémasort mutat a
  Képernyő A-hoz és egyet a Képernyő B-hez, a Festés pedig a kettő négy keverékét. Ezek
  `.hrg` fájlok.

A kétképernyős módok közötti váltás mindkét képernyőt megtartja, ugyanazon
szabályok szerint, ahogy egyetlen képernyő átalakul.

### Attribútumok

A Kép menü Attribútumok menüpontjai a cellák attribútumait változtatják, a pixelek
helyben maradnak. Az Invertálás minden cellában felcseréli a Tintát és a
Papírt, és megtartja a Fényességet és a Villogást. A Törlés az aktuális Tintát,
Papírt, Fényességet és Villogást írja minden cellába; a „meglévő használata”
jelölőnégyzetek megtartják, ami a cellában már van. A Vízszintes tükrözés és a
Függőleges tükrözés tükrözi a cellák attribútumait. Minden parancs a kijelölésen
(minden érintett cellán) hajtódik végre, kijelölés nélkül az egész képen, és
egy lépésben visszavonható. A menüpontok szürkék a cellaattribútumokat nem használó
módokban (Timex Hi-res, Layer 2, LoRes), saját attribútumok nélküli lebegő bélyegző közben és zárolt
rétegen.

A Módosítás... a cellákat az attribútumaik alapján keresi meg és cseréli le. A Keresés adja meg, mely cellákat kell találni: minden mező érték vagy Bármely. A Csere erre adja meg, mivé válnak: minden mező érték vagy Megtartás. A párbeszédpanel az OK megnyomása előtt megmutatja, hány cella változik, az OK pedig egy lépésben visszavonható. A GigaScreen-en külön csoport van az A és a B képernyőnek; ULAplus módban a CLUT 0-3 a Fényesség és a Villogás helyét veszi át. A Mégse nem változtat semmit.

### Pixelek

A Kép menü Pixelek elemei a pixeleket módosítják, az attribútumokat pedig a cellákban hagyják. A Vízszintes tükrözés és a Függőleges tükrözés a pixeleket tükrözi. A Pixelek és attribútumok invertálása invertálja a pixeleket, és cellánként a Tintát és a Papírt is felcseréli, így a kép változatlan marad. Olyan módokban nem érhető el, ahol nincsenek cellaattribútumok (Layer 2, LoRes, Timex Hi-res), és szürke, amíg bélyeg lebeg. ULAplusban és ULANextben ez sem érhető el, mert a Tinta és a Papír felcserélése megváltoztatná a kép kinézetét.

A Transform panel Eltolás szakaszában a Mozgatás választja ki, mi mozog. A Pixelek és attribútumok (alapérték) egész cellákat mozgat a Papírjukkal együtt. A Csak pixelek a pixeleket pixelenként vagy cellánként mozgatja. A Csak attribútumok a cellaattribútumokat cellánként mozgatja. Az irányítóelemen az átlós irányok is megvannak. Amíg bélyeg lebeg, a Mozgatás szürke, mert az eltolás a teljes bélyeget mozgatja.

Kijelölés esetén a nyilak ugyanezt a Mozgatás-választást követik.

### Bélyegzők

Ha egy bélyegző be van kapcsolva, az **Átalakítás** panel mutatja, hogyan helyezi le.

Az **Attribútumok** a Csak pixelek és a Saját attribútumok között választ. A Csak pixelek a bélyegző pixeleit az attribútumsáv attribútumaival rakja le, mint mindig. A Saját attribútumok a bélyegző hordozta attribútumokat rakja le cellánként: a térképszerkesztő bélyegzőjét, vagy egy cellaattribútumos módban képről másoltat. A képről másolt bélyegző Csak pixelek állapotban indul, így a beillesztés pontosan úgy esik, mint korábban. A Saját attribútumok egész cellákra illeszti a bélyegzőt, figyelmen kívül hagyja a rajzmódot, a színsávot és az XOR kapcsolót, és nem méretezhető, nem forgatható, nem hajlítható, nem tükrözhető, nem invertálható és nem körvonalazható; a panel ezeket szürkíti és megmondja miért. Egy Csak pixelek bélyegző alakjának megváltoztatása eldobja a hordozott attribútumokat. Az Inverz továbbra is felcseréli, mit csinálnak a tinta- és a papírpixelek. Ha a bélyegző cellái más méretűek, mint a jelenlegi képernyőmódé, csak a Csak pixelek lehetséges.

Az **Átlátszás** (csak Saját attribútumoknál) a bélyegzőé helyett a lapon már levő attribútumot engedi át. A Tintának, Papírnak, Fényességnek és Villogásnak külön négyzete van. Az ULAplus-nak egy CLUT négyzete van a Fényességhez és Villogáshoz együtt. A GigaScreenben minden négyzet mindkét képernyőre vonatkozik.

A **Papírpixelek** döntik el, mit tesznek a bélyegző papírpixelei. A Háttér marad nem bántja az alattuk levő képet (a saját attribútumú bélyegző ettől még átszínezi alattuk a Papírt, hacsak a Papír át nem látszik). A Háttér törlése az alattuk levő képet is papírpixelekké teszi, a bélyegző teljes téglalapján. Az ellentét nélküli rajzmódok (XOR, Tinta átszínezése, Papír átszínezése) és a bélyegző saját XOR kapcsolója békén hagyják a papírpixeleket, és a panel ezt kiírja. A Papírpixelek minden képernyőmódban elérhetők, cellaattribútumok nélkül is.

Az **Átalakítás csak pixelekké** véglegesen elveti a bélyegző attribútumait, a pixeleit megtartja. Az Attribútumoknál a Csak pixelek választás megtartja őket, így vissza lehet kapcsolni. Minden módosítás egy visszavonási lépés.

Amíg egy saját attribútumokat hordozó bélyegző be van kapcsolva, a Kép > Attribútumok parancsai (Invertálás, Törlés, mindkét Tükrözés és Csere...) a bélyegző celláira hatnak a kép helyett, akár lebeg, akár el van téve. Figyelmen kívül hagyják a kijelölést, és sosem érintik a bélyegző pixeleit; a bélyegző által le nem fedett cella változatlan marad. A Tükrözés a bélyegző attribútumcelláit tükrözi, a pixelei a helyükön maradnak. A GigaScreen bélyegzőnek egy attribútumkészlete van mindkét képernyőre, ezért a Csere párbeszédablak egy csoportot mutat. Minden parancs egy visszavonási lépés. Saját attribútumok nélküli bélyegzőnél szürkék maradnak.
