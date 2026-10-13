## A szerkesztők

Négy dolog, amit a PixULA készít, nem kép, és mindegyiknek saját ablaka van a
Fájl menüben.

### A betűkészlet-szerkesztő

Egy Spectrum-karakterkészlet 96 vagy 256 jelből áll, mindegyik sorbájtok
halmaként tárolva. Itt jelenként szerkesztheted őket.

![A betűkészlet-szerkesztő: az egyik oldalon a jelek rácsa, a másikon egy szerkesztett karakter](img/dialog-font-editor.png)

*Válassz karaktert a bal oldali rácsból, és szerkeszd a jobb oldalon.*

A jelek 4, 6 vagy 8 pixel szélesek lehetnek, cellamagasság mellett. Egy
betűkészlet keskenyítése végleg eldobja a jobb oldali oszlopokat, ezért ha
szélességeket próbálgatsz, a keskenytől haladj a széles felé.

Kiindulhatsz a ZX ROM betűkészletből, átvehetsz egy jelet a vászonról, vagy
betölthetsz egy `.ch4`, `.ch6`, `.ch8`, `.chr` vagy `.chx` készletet egy másik
Spectrum-eszközből. Ha elnevezel egy betűkészletet, bekerül a könyvtáradba, és
a Szöveg eszköz ezután a beépített ROM-betűkészlet mellett kínálja.

**Nagy betűtípusok.** Az Új nagy betűtípus... egy CHX nagybetűkészletet hoz létre, amilyet a ZX-Editor Second Edition használ: minden karakter 8, 16, 24 vagy 32 képpont széles és magas (a szélességet és a magasságot külön választod), és a szerkesztő a szélességlista helyén a méretet mutatja. A Kitöltés betűtípussal kipipálásával kiválaszthatsz bármilyen betűtípust ugyanabból a listából, amelyet a Szöveg eszköz használ, azt, hogy a betűk a karakter magasságának hány százalékát foglalják el, és hogy balra, középre vagy jobbra kerülnek-e. Az Arányos kipipálásakor minden betű csak olyan szélesen kerül mentésre, amilyenre szüksége van, egész 8 képpontos oszlopokban, így az i kevesebb helyet foglal, mint a W; a Szóköz karakter mindig megtart legalább egy oszlopot. A Kitöltés betűtípusból... ugyanezt egyetlen lépésben végzi el egy már meglévő nagy betűtípussal. A nagy betűtípus csak `.chx`-ként menthető (a többi formátum, valamint az assembly, C és bináris listák 8x8-as karaktereket tartalmaznak), nem lehet belőle cellát rögzíteni a vászonról, és a Szöveg eszköz még nem kínálja fel. Nagy `.chx` megnyitásakor minden karakter megtartja a saját méretét, és a fájlból kihagyott karakter újabb mentéskor is kihagyva marad. Az, hogy a több 8x8-as blokkból álló karakter hogyan van elrendezve a fájlban, a formátum nyilvános leírását követi, és nem ellenőriztük magával a ZX Paintbrush által mentett fájlon, ezért az itt készült nagy betűtípust nyisd meg a ZX Paintbrushban, mielőtt megbíznál benne.

**Árnyékolás és visszavonás.** Olyan betűtípusnál, amelynek karakterei egész számú 8 képpontos oszlop szélesek, a négy Árnyékolás gomb egyszerre egy oszlopot árnyékol vagy old fel a szerkesztett karakter bal vagy jobb oldalán. Az árnyékolt oszlop vonalkázva látszik, és nem mentődik: a `.chx` fájl az ilyen karaktert keskenyebben tárolja, a teljesen árnyékolt karakter pedig kimarad a fájlból. Az árnyékolás alatti pontok megmaradnak a szerkesztőben, így a feloldás visszahozza őket, de a fájlban nincsenek benne. A Mind árnyékolása igazításra ezt az összes karakterre egyszerre elvégzi: árnyékolja a pontok két oldalán lévő üres oszlopokat, a Szóköznek meghagy egy oszlopot, a többi üres karaktert kihagyja. A Szóköz karakter mindig megtart legalább egy oszlopot, mert a `.chx` fájlnak tartalmaznia kell. `.chx` exportálása után az állapotsor megmondja, hány karakter lett keskenyebben mentve, hány maradt ki, és hánynak voltak pontjai az árnyékolás alatt. A betűtípus-szerkesztőben van Visszavonás és Újra is (a két gomb vagy a Ctrl+Z és a Ctrl+Y): egy vonás a szerkesztőfelületen egy lépés, és az is, ha rákattintasz egy gombra, az Új nagy betűtípusra, a Kitöltés betűtípusból-ra, a ROM betűtípus betöltésére vagy egy importra. A betűtípus nevének mezőjébe gépelés nem tartozik ide.

**Összes karakter.** Az Összes karakter gomb az egykarakteres szerkesztőt a teljes betűtípus térképére cseréli: az összes karakter egymás mellett, soronként 16, amelyre ugyanazzal az Ecsettel, Radírral, Vonallal és Kitöltéssel rajzolsz, így egy vonás átvezethet egyik karakterből a következőbe. Egy vonás egy változtatás és egy visszavonási lépés, a Kitöltés pedig a rákattintott karakteren belül marad. Az Árnyékol eszköz a rákattintott 8 képpontos oszlopot árnyékolja vagy oldja fel, a karaktere közelebbi széle felől; az árnyékolt oszlopok vonalkázottak. A Mozgat eszköz húzza a térképet, így lehet ujjal görgetni, mert a térkép különben minden érintést rajzolásra tart fenn. A mínusz, Illeszt és plusz gombok egész lépésekben változtatják a nagyítást. A térképen és a karakterrácson a nyilak, a Home és az End karakterről karakterre lépnek, egy karakter beírása pedig kiválasztja azt. Pixeleket csak billentyűzettel rajzolni nem lehet.

### A térképszerkesztő

A térkép csempék rácsa, ahol egy csempe egy 8×8-as cella – nyolc bitképbájt és
egy attribútumbájt. A térképekkel egy képernyőnél nagyobb játékteret építhetsz.

![A térképszerkesztő a csempepalettával és egy görgethető térképterülettel](img/dialog-map-editor.png)

*Bal oldalt a csempék, jobb oldalt a térkép.*

Fess a bal gombbal, radírozz a jobbal, vagy a kitöltéssel cseréld le az azonos
csempék összefüggő területét. A csempék az aktuális mintából és színekből vagy
közvetlenül a vászonról származnak. A térképet visszarajzolhatod a vászonra, és
egyetlen visszavonás az egészet visszafordítja.

Ments `.zxtm` formátumba, ha tovább akarsz dolgozni – ez a PixULA saját
formátuma, és mindent megőriz –, vagy `.zxm`-be, vagy assembly, C vagy nyers
bináris formában, hogy egy programba illeszd.

### A sprite-szerkesztő

A Next sprite-ok 16×16 pixelesek, pixelenként egy palettaindexszel, és egy
lapon legfeljebb 64 fér el.

![A sprite-szerkesztő egy sprite-lappal és a szerkesztőráccsal](img/dialog-sprite-editor.png)

*Az egyik oldalon a lap, a másikon a sprite, amelyet rajzolsz.*

A sprite-lapok `.spr` fájlokban tárolódnak, nem a képedben, ezért a lapot külön
mentsd. Az indexelt módokban átvehetsz egy sprite-ot a vászonról, és
rábélyegezhetsz egyet.

### A palettaszerkesztő

**Kép > Paletta szerkesztése**, a szerkeszthető palettájú módokban. Az ULAplus
palettát négy tizenhatos palettaként, a Next palettát kilencbites színek
soraiként mutatja. Bármilyen színt választasz, az a hardver által ténylegesen
tárolható legközelebbi értékre igazodik, így amit látsz, azt fogja mutatni a gép
is.

Minden módosítás külön visszavonási lépés. A paletták ennek az ablaknak a
megnyitása nélkül is betölthetők és menthetők – lásd a színről szóló fejezetet.

### Szalagblokkok

A **Fájl > Szalagblokkok** megnyit egy `.tap` vagy `.tzx` fájlt, és felsorolja,
mi van benne. Arra használd, hogy egy több képernyőt tartalmazó szalagról
egyet betölts, vagy hogy az aktuális képet új blokként hozzáadd egy szalaghoz,
és a szalagot újra elmentsd.

Azok a blokkok, amelyekhez nem nyúltál, bájtról bájtra íródnak vissza, így ha
valaki más szalagjához adsz egy képernyőt, a többi pontosan olyan marad, amilyen
volt.
