## Szín

A klasszikus módokban nem egy pixel színét választod. Egy egész cella két színét
választod, meg két jelzőt.

- **TINTA** a bekapcsolt pontok színe.
- **PAPÍR** a kikapcsolt pontok színe.
- **FÉNYESSÉG** mindkettőt a világosabb változatukra emeli. Cellánként egy
  fényességjelző van, így a tinta és a papír vagy együtt fényes, vagy egyik
  sem.
- **VILLOGÁS** a valódi hardveren másodpercenként nagyjából kétszer felcseréli a
  tintát és a papírt.

A bal egérgomb tintával rajzol. A jobb papírral rajzol: kikapcsolja a pontot, és
ugyanazt a négy értéket állítja be, amelyet a bal is beállítana. Tollnál az
oldalgomb ugyanazt teszi, mint a jobb egérgomb.

A **radír** mindkettőtől eltérően működik. Kikapcsolja a pontokat, a cella
színeit viszont érintetlenül hagyja, akkor is, ha a cella utolsó pontját
törli. Ha a színeket is törölni akarod, radírozz át újra az üres cellán egy új
vonással: a tinta, a papír, a fényesség és a villogás visszaáll fekete a
fehéren értékre, felsőbb rétegen pedig a cella ismét átlátszó lesz. Az a cella,
amelyben még vannak pontok, megtartja a színeit, akárhányszor radírozol át
rajta.

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

{{draw-modes}}

Az ecset minden változata, a kitöltés, az alakzatok, a Bézier-görbe, a szöveg, a
**Bélyegzők** panel bélyegzői és az átmenet bal gombja követik a rajzolási
módot. A radír, a pipetta, a kijelölés mozgatása, beillesztése és törlése, az
**Átalakítás** panel, a **Csak attribútumok kitöltése** beállítás, valamint a
Felcserél és az Átszínezés gomb figyelmen kívül hagyja.

**A Tinta átszínezése nem ugyanaz, mint az Átszínezés.** A Tinta átszínezése és
a Papír átszínezése rajzolási módok: minden cellát átszíneznek, amelyet az
aktuális eszköz érint (kis ecsettel néhányat, egy kitöltött téglalappal mindet,
amelyet lefed), és a Tükrözés is érvényes rájuk. Az **Átszínezés** közvetlenül
az elválasztó után a mutató alatti teljes cellát színezi át, bármelyik eszköz
van kiválasztva, az ecsetmérettől és a Tükrözéstől függetlenül. A mellette lévő
**Felcserél** ugyanígy működik, és minden cellában felcseréli a tintát és a
papírt. Bármelyik bekapcsolva marad, amíg újra rá nem kattintasz, vagy eszközt
vagy rajzolási módot nem választasz, és amíg be van kapcsolva, az állapotsor
jelzi.

**Az XOR / Fölé és az XOR / Minden áthaladás** megfordítja a pontokat ahelyett,
hogy bekapcsolná őket, és mindkettő a választott színeket adja a cellának. Az
XOR / Fölé vonásonként egyszer fordít meg minden pontot, így ha ugyanabban a
vonásban visszamész a saját vonaladon, az már semmin sem változtat. Az XOR /
Minden áthaladás minden alkalommal megfordít egy pontot, amikor a vonás áthalad
rajta: az ecset egy húzása egy áthaladás, akármennyire fedi is önmagát útközben,
de ha a vonás elhagy egy pontot, majd visszatér hozzá, újra megfordítja, így a
nyolcas ott kioltja magát, ahol keresztezi önmagát. Az alakzatok, a görbék, a
kitöltések és a szöveg mindig egyetlen áthaladás, így ezeknél a két mód ugyanazt
adja.

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

### GigaScreen

A GigaScreen két teljes képernyőt tárol, és felváltva mutatja őket,
másodpercenként ötvenszer. A szem minden pixel két színét egybemossa, így egy
cella, amelynek mindkét képernyőn van egy tintája és egy papírja, **négy** színt
mutathat, az egész kép pedig nagyjából százat.

Sosem csak az egyik képernyőre rajzolsz. Minden vonás mindkettőre ír, és a
színsáv párokban dolgozik:

- A **Képernyő A** és a **Képernyő B** saját tinta- és papírmintákkal és saját
  **FÉNYESSÉG** beállítással rendelkezik. A villogás egyetlen közös beállítás.
- A **Festés** azt a négy színt mutatja, amely ezekből a választásokból adódik,
  pontosan úgy keverve, ahogy a vászon mutatja: tinta mindkét képernyőn, tinta
  csak az A-n, tinta csak a B-n és papír mindkettőn. Válassz egyet, és a bal
  gomb azzal fest. A jobb gomb mindig papírt fest mindkét képernyőre.
- Válassz ugyanazt a tintát mindkét képernyőre, és a Festés bal felső mintája
  ez a szín lesz, keveretlenül – így rajzolsz meg mindent, ami nem tűnhet
  kevertnek.

A pipetta mindezt visszaveszi: mindkét képernyő színeit és azt, hogy a négy
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
  váltogat. A nagy felbontásnak nincsenek cellaszínei – minden képernyőnek egy
  színsémája van az egész képre –, ezért a sáv egy sémasort mutat a
  Képernyő A-hoz és egyet a Képernyő B-hez, a Festés pedig a kettő négy keverékét. Ezek
  `.hrg` fájlok.

A kétképernyős módok közötti váltás mindkét képernyőt megtartja, ugyanazon
szabályok szerint, ahogy egyetlen képernyő átalakul.
