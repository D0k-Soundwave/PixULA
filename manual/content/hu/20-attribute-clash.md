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

### Ahol mások a szabályok

A későbbi hardverek többféleképpen lazítottak a korláton, és a PixULA mindegyikkel
tud dolgozni. A Timex gépek finomabbá tették a színrácsot. Az ULAplus a tizenhat
rögzített színt választható palettára cserélte. A GigaScreen két képet olyan
gyorsan váltogat, hogy olyan színeket sejtet, amelyek egyikben sincsenek meg. A
ZX Spectrum Next a Layer 2 és LoRes módjaiban teljesen elhagyja ezt a rendszert:
ott minden pixelnek saját színe van.

Egy képet bármelyik között átvihetsz – lásd a következő fejezetet.
