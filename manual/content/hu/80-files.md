## Fájlok

Kétféle dolgot menthetsz, és fontos, hogy a megfelelőhöz nyúlj.

**A projekt** úgy őrzi meg a munkádat, ahogy otthagytad: minden réteget, a
palettát, a képernyőmódot, az eszközeidet és beállításaikat, a referenciaképet
és azt, ahová néztél. Ez egy `.pixula` fájl, amelyet a **Fájl > Projekt
mentése** ír, és ezt érdemes használni, amíg egy kép még készül.

**A kép** egyetlen összeolvasztott képernyő egy olyan formátumban, amelyet egy
másik program is ért – `.scr` emulátorhoz, `.png` megmutatáshoz, `.tap`
valódi hardveren való betöltéshez. Ezeket a **Fájl > Kép mentése másként** írja.
Csak a képet tartalmazzák, semmi mást – ezt akarod, ha továbbadod az
eredményt, de nem ezt, ha tovább akarsz dolgozni rajta.

### Kép importálása

Egy fotó vagy más kép (PNG, JPG, GIF) megnyitásakor három átalakítás jelenik meg egymás mellett - Éles, Lágy és Lapos -, és arra kattintasz, amelyik tetszik. A Lágy alakítja tinta- és papírpixelekké az árnyalatokat, és az előnézetek alatti **Raszterezés** lista dönti el, hogyan: alapértelmezés az import saját Floyd-Steinberg eljárása, a lista pedig a ZX Paintbrush másik 30 módszerét is kínálja - küszöbök, hibaterítés, Bayer-mátrixok, klaszterpontok és szupercellák. A módszer választása újrarajzolja a Lágyat, és az Élest is, ha már választottál módszert (a Lapos soha nem raszterez). A rendezett módszerek folytatódnak az attribútumcellák között, így a minta az egész képen végigfut; a hibaterítés minden cellán belül marad, mert minden cellának saját két színe van. A Layer 2 és LoRes üzemmódban a lista is működik: minden pixel a két legközelebbi palettaszín közé kerül, és az egész kép egy blokk, így a hibaterítés az egész képen végigfut.

### A kép egy részének mentése

A **Fájl > Kijelölés mentése másként** ugyanazokat a formátumokat listázza, mint a Kép mentése másként, mindegyik csak akkor nyitott, ha a kijelölés megfelel neki. A PNG, a BMP és a JPEG bármilyen téglalapot elfogad. A ZXP, SEV, ZED, ASM, C, BIN és ATR egész attribútumcellákat fogad: a kijelölést előbb cellákhoz igazítja, és az állapotsor szól róla. A ColorTiles egész 16x16-os csempéket fogad. Azok a formátumok, amelyek egy egész képernyő lenyomatai (SCR, szalagok, MLT és hasonlók), csak akkor nyitottak, ha a kijelölés a teljes képernyő. Az ASM, C, BIN és ATR soronként írja ki a részt: a bittérképet soronkénti bájtblokkként fentről lefelé, az attribútumokat cellánként egy bájtként; ezt a klasszikus, multicolor és ULAplus módokban teszik. A szabadkézi vagy ellipszis kijelölés a befoglaló téglalapját menti. A zárt formátum megmondja az okát, ha rámutatsz. A Kép mentése másként az egész képet menti, a kijelölést figyelmen kívül hagyja.

### Új kép egy kijelölésből

A **Szerkesztés > Új kép a kijelölésből** a kijelölést teszi a teljes képpé. A kijelölést előbb egész cellákhoz igazítja. Mielőtt bármit tenne, rákérdez, és a Ctrl+Z visszaadja a régi képet. Minden réteg megmarad, és erre a blokkra vágódik, amely a bal felső sarokba kerül; a többi üres, a háttér ott fehér Papír. A képernyőmód ugyanaz marad, a kép névtelen lesz, így a következő Mentés nevet kér.

### Automatikus mentés és biztonsági másolatok

A PixULA néhány percenként a böngésző saját tárhelyére mentheti a munkádat, és
visszakínálhatja, ha egy munkamenet rosszul ér véget. Ez ki van kapcsolva, amíg
nem választasz gyakoriságot: állítsd be az **Automatikus mentés (percenként,
0 = ki)** értéket a Beállításokban, az Általános részben.

Választhatsz egy mappát is a lemezen, és minden automatikus mentés egy
sorszámozott változatot ír bele – `picture V1.pixula`, `picture V2.pixula` és
így tovább. A számozást minden alkalommal a mappából olvassa vissza, így egy
újra megnyitott kép folytatja a sorozatot ahelyett, hogy V1-től kezdené, és két
munkamenet ugyanazon a képen egyetlen változatsorozaton osztozik. Hogy hányat
őrizzen meg, a Beállításokban adhatod meg; az alapérték 20.

Egy dologra számíts. A böngésző nem nyit meg újra egy korábbi munkamenetben
választott mappát a megerősítésed nélkül, és az automatikus mentés időzítője nem
kérdezhet helyetted. Ezért az újratöltés utáni első mentés megáll és vár rád. A
Beállításokban van egy **Mentések folytatása** gomb, és a megnyomása az a
megerősítés, amelyre a böngésző vár.

{{formats}}
