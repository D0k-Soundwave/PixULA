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

Egy fotó vagy más kép (PNG, JPG, GIF) megnyitásakor három átalakítás jelenik meg egymás mellett - Éles, Lágy és Lapos -, és arra kattintasz, amelyik tetszik. A Lágy alakítja pontokká az árnyalatokat, és az előnézetek alatti **Raszterezés** lista dönti el, hogyan: alapértelmezés az import saját Floyd-Steinberg eljárása, a lista pedig a ZX Paintbrush másik 30 módszerét is kínálja - küszöbök, hibaterítés, Bayer-mátrixok, klaszterpontok és szupercellák. A módszer választása a Lágy előnézetre vált. A rendezett módszerek folytatódnak az attribútumcellák között, így a minta az egész képen végigfut; a hibaterítés minden cellán belül marad, mert minden cellának saját két színe van. A Layer 2 és LoRes üzemmódban a lista szürke: ezek az üzemmódok megtartják a saját színraszterezésüket.

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
