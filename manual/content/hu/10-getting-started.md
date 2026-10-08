## Első lépések

A PixULA pixelgrafikus szerkesztő a ZX Spectrumhoz és a ZX Spectrum Nexthez.
Böngészőben fut, a saját lemezed egy mappájából, telepítés, szerver és
internetkapcsolat nélkül.

Csomagold ki a mappát, ahová szeretnéd, és kattints duplán a `PixULA.html`
fájlra. Ennyi a telepítés. A mappán kívülre semmi sem íródik, hacsak nem kéred,
és semmi, amit rajzolsz, nem hagyja el a gépedet.

### Amit először érdemes tudni

A Spectrum nem tud akármilyen színt akárhová tenni. A képet pixelenként egy
bites bitképként tárolja, amelyre egy külön, jóval durvább színrács kerül, és
minden 8×8-as blokkon belül csak két szín áll rendelkezésre. Ez az egyetlen
tény határozza meg minden eszköz viselkedését, és erről szól a következő
fejezet.

### Eligazodás

![A PixULA ablaka: menüsor, módsáv, eszközsáv, színsáv, vászon, panelek és állapotsor](img/workspace.png)

*A teljes ablak.*

- **A menüsor** legfelül: fájlok, szerkesztés, nézet, rétegek, maga a kép,
  beállítások és súgó.
- **A módsáv** alatta: rajzolási módok, a Felcserél és az Átszínezés, valamint a tükrözés.
- **Az eszközsáv** bal oldalt, tetején a visszavonással és az újra
  végrehajtással.
- **A színsáv** mellette, az aktuális képernyőmód palettájával.
- **A vászon** középen.
- **A panelek** jobb oldalt: rétegek, eszközbeállítások, átalakítás, a
  referenciakép, készletek.
- **Az állapotsor** alul, amely a képernyőmódot, a rajzolási módot és azt
  mutatja, hogy az érintés rajzol-e.

![Az eszközsáv](img/tool-rail.png)

*Az eszközsáv. A visszavonás és az újra fent vannak; az alattuk lévő eszközök
aszerint vannak csoportosítva, mit tesznek a képpel.*

![A színsáv](img/colour-rail.png)

*A színsáv: bal oldalt TINTA, jobb oldalt PAPÍR, fölöttük FÉNYESSÉG és
VILLOGÁS.*

![A módsáv](img/colour-bar.png)

*A módsáv: rajzolási módok, aztán a Felcserél és az Átszínezés, aztán a tükrözés.*

![Az oldalpanelek](img/panels.png)

*A panelek. Mindegyik összecsukható, így csak azokat tarthatod nyitva, amelyeket
használsz.*

![Az állapotsor](img/status-bar.png)

*Az állapotsor azokat a beállításokat mutatja, amelyektől a következő vonásod
függ.*

Az eszközsávon nincsenek feliratok – a gombok mellett nincs hely nekik. Vidd a
mutatót bármelyik vezérlő fölé, hogy lásd a nevét, és hagyd ott, hogy egy
magyarázó mondatot is elolvashass. Táblagépen tartsd lenyomva helyette; a
nyomva tartás közben nem vált eszközt.

### Táblagépen

Fektetve tartsd a táblagépet. A PixULA táblagépen ugyanazt az ablakot használja,
mint számítógépen, és állítva nincs elég szélesség a vászonnak a panelek mellett,
ezért megkér, hogy fordítsd el az eszközt. Kis képernyőn az egész felület
összezsugorodik, de sosem olyan méret alá, amelyet egy ujj még eltalál, és a
választott felületméret nagyobb képernyőn visszatér. Csatlakoztatott egérrel
vagy érintőpaddal a táblagép számítógépként viselkedik, és bármelyik
tájolásban használható.
