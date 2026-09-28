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
