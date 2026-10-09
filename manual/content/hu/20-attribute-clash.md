## Attribútumütközés

A Spectrum a képet két külön részben tárolja.

Az első egy bitkép: 256×192 pont, mindegyik egy bit, be- vagy kikapcsolva. A
második egy színrács, e pontok minden 8×8-as blokkjára egy bájt – vízszintesen
32, függőlegesen 24 bájt. Mindegyik bájt megadja, milyen színű legyen a
**tinta** (a bekapcsolt pontok), milyen színű a **papír** (a kikapcsolt
pontok), **fényes-e** a pár, és **villogjon-e**.

A kép formájának felbontása tehát 256×192, a színéé viszont 32×24. Minden 8×8-as
cella két színt mutathat, és benne minden pont vagy az egyik, vagy a másik.

![Két átlós vonal keresztezi egymást egy nagyított vásznon, bekapcsolt cellaráccsal. A kék vonal minden olyan cellában pirossá válik, amelyen a piros is áthalad](img/attribute-clash.png)

*Egy kék és egy piros vonal keresztezi egymást, 800%-on, cellaráccsal. Ahol a
piros vonal áthalad egy cellán, ott a kék vonal is piros abban a cellában. A
piros vonás érkezett másodikként, és az egész cella tintaszínét beállította,
azokét a pontokét is, amelyeket a kék vonás már letett.*

Ezt jelenti az „attribútumütközés” (*attribute clash*). Ha egy cella egyik
részében rajzolsz, a cellában minden más színe is megváltozik, és nincs olyan
beállítás, amely ezt kikapcsolná – így működik a hardver.

### Hogyan dolgozz vele

A legtöbb Spectrum-grafikus a színfoltokat a részletek előtt tervezi meg, és úgy
rendezi a képet, hogy a színhatárok cellahatárokra essenek. Ha egy cellának
olyan árnyalat kell, amelyet nem tud befogadni, raszterezni kell: két színt
olyan finoman váltogatni, hogy a szem összemossa őket.

A PixULA ebben háromféleképpen segít.

**A cellarács.** Kapcsold be a nagyításvezérlők mellett, és pontosan látni
fogod, hol ingyenes egy színváltás, és hol kerül valamibe.

**A rajzolási módok.** Egy vonásnak nem kell egyszerre a pontokat és a színeket
is megváltoztatnia. Tehetsz le pontokat a színek érintése nélkül, vagy
átszínezhetsz egy cellát egyetlen pont érintése nélkül. A színről szóló fejezet
felsorolja őket.

**A mintakönyvtár.** Magja egy sor mért tintasűrűségű csempe – ehhez nyúlsz,
amikor egy cellának olyan szürke kell, amelyet nem tud befogadni.

### A pontok megjelenítése

A Nézet menü három kapcsolója azt változtatja meg, amit a képernyő mutat, a
képet nem. A **Színek kikapcsolva** fehér alapon feketen mutatja a pontokat,
hogy lásd, mely pontok vannak ténylegesen beállítva. A **Színrács** ugyanezt
teszi, és a cellákat sakktáblaszerűen meg is színezi, hogy a cellahatárok jól
látsszanak; ez és a Színek kikapcsolva kikapcsolják egymást. A **Villogás
leállítása** minden villogó cellát a normál színeiben tart. Egyik sem érinti a
képet, a visszavonást vagy az exportálást: a mentett kép ugyanúgy néz ki, akár
be vannak kapcsolva, akár nem. A böngésző megjegyzi őket, és az a kapcsoló,
amely az aktuális képernyőmódban nem működhet, szürkén látszik – vidd fölé az
egeret, hogy lásd, miért. GigaScreen és MultiGiga módban a Színek kikapcsolva
négy szürke szintet mutat: fehér, ahol egyik képernyőn sincs pont,
világosszürke, ha csak az A képernyőn van pont, sötétebb szürke, ha csak a B
képernyőn, és fekete, ha mindkettőn.

### A mutató olvasása

A kép alatti sáv és az állapotsor megmondja, hol van a mutató. A
**Beállításokban** a *A mutatókijelzés mutatja* a mutató alatti attribútumot
egészíti ki (a számát tízes és tizenhatos számrendszerben, majd tinta, papír,
fényes és villogó; ULAplusban a CLUT; GigaScreenben mindkét képernyő), valamint
a képpont bájtjának és attribútumbájtjának memóriacímét. Cím ott van, ahol a
valódi gépnek rögzített elrendezése van: Standard ULA és ULAplus (a képfájl
$4000-től, az attribútumok $5800-tól), Timex hi-colour (az attribútumok a
második képfájlban, $6000-nál), Timex hi-res (a páros bájtoszlopok $4000-nél, a
páratlanok $6000-nél) és GigaScreen (az A képernyő a szokásos, a B képernyő a 7.
bankban, $C000-nél; hogy melyik képernyő melyik bank, az megegyezés kérdése). A
többi mód jelzi, hogy nincs címe.

Az *Az Y számolása innen indul* beállítható alulra, így a kijelzés úgy
olvasható, mint a BASIC PLOT, ahol a 0,0 a bal alsó sarok, az Y pedig 0-tól
175-ig megy. Ez csak egy 256 × 192-es kép felső 176 során létezik; alatta és más
képernyőkön a kijelzés kötőjelet mutat. Csak a kijelzést változtatja.

A Nézet menü **Egyéni rács...** parancsa tetszőleges X és Y lépésű rácsot
rajzol, a két lépés külön állítható, a **Egyéni rács megjelenítése** pedig be-
és kikapcsolja. A képernyőn négy pixelnél közelebbi vonalak kimaradnak, amíg nem
nagyítasz. A bekapcsolt rácsok a program következő megnyitásakor visszatérnek. A
Beállításokban a *Rácsszínek* az egyes rácsok színét adja meg; ha a *Téma színe*
be van jelölve, a rács a témát követi.

### Ahol mások a szabályok

A későbbi hardverek többféleképpen lazítottak a korláton, és a PixULA mindegyikkel
tud dolgozni. A Timex gépek finomabbá tették a színrácsot. Az ULAplus a tizenhat
rögzített színt választható palettára cserélte. A GigaScreen két képet olyan
gyorsan váltogat, hogy olyan színeket sejtet, amelyek egyikben sincsenek meg. A
ZX Spectrum Next a Layer 2 és LoRes módjaiban teljesen elhagyja ezt a rendszert:
ott minden pixelnek saját színe van.

Egy képet bármelyik között átvihetsz – lásd a következő fejezetet.
