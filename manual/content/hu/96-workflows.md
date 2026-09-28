## Munkafolyamatok

Néhány gyakori feladat az elejétől a végéig.

### Az első képed

1. Nyisd meg a `PixULA.html` fájlt. Szabványos ULA módban kezdesz egy üres,
   256×192-es képernyővel.
2. Kapcsold be a cellarácsot a nagyításvezérlők mellett, hogy lásd a 8×8-as
   blokkokat, amelyekben a szín tárolódik.
3. Válassz tintaszínt a színsávon vagy az 1–8 billentyűkkel, papírszínt pedig
   egy mintára való jobb kattintással.
4. Rajzolj az **Ecsettel**. Bal gomb a tinta, jobb a papír.
5. Nagyíts a `+` és a `-` billentyűvel. Tartsd lenyomva a szóközt és húzd, hogy
   mozogj, vagy használd a **Nézet mozgatása** eszközt.
6. A `Ctrl+Z` visszavon. A `Ctrl+S` egy `.pixula` projektet ment, amely a képen
   kívül a rétegeidet és beállításaidat is megőrzi.

Ha a színfoltokat a részletek előtt rakod le, általában munkát spórolsz, mert egy
cellahatárra nem eső színhatár újra és újra megváltoztatja a már rendezett
színeket.

### Fénykép átrajzolása

1. Nyisd meg a **Referencia** panelt, és töltsd be a fényképet. A rajzod mögött
   helyezkedik el az általad megadott átlátszósággal, helyzettel és mérettel, és
   sosem része a mentett képnek.
2. Rajzolj rá egy normál rétegen.
3. Ha a referencia valaha elmosódottabbnak tűnik az eredetinél, a panel jelzi,
   és felkínál egy **Fénykép megkeresése** gombot. A PixULA a lemezen lévő
   fájlra hivatkozik, így ha a fotó elköltözik, csak egy kis előnézet marad
   belőle.

### Fénykép átalakítása

Hogy a PixULA végezze az átalakítást:

1. **Fájl > Betöltés**, és válassz egy `.png`, `.jpg` vagy `.gif` fájlt.
2. Az importálási ablak három átalakítást mutat egymás mellett: Éles, Lágy és
   Sík. Hogy melyik néz ki a legjobban, teljesen a fényképtől függ, ezért
   érdemes mindig mindhármat összehasonlítani.
3. Állítsd a fényerőt, a kontrasztot és a méretezést, amíg az előnézet jól nem
   olvasható, majd fogadd el.

ULAplus és Next módokban a paletta a képedből épül fel, így nem vagy korlátozva
az ULA tizenhat színére. Ez általában nagy különbséget jelent.

### Betűkészlet készítése

1. **Fájl > Betűkészlet-szerkesztő**.
2. Indulj ki a ZX ROM betűkészletből, vagy importálj egy `.ch8` vagy `.chr`
   készletet.
3. Válassz ki egy karaktert, és szerkeszd. 4, 6 és 8 pixeles szélesség érhető
   el, de a keskenyítés végleg eldobja a jobb oldali oszlopokat, ezért ha
   kísérletezel, a keskenytől haladj felfelé.
4. Nevezd el a betűkészletet, hogy bekerüljön a könyvtáradba.
5. Válaszd a **Szöveg** eszközt. A betűkészleted megjelenik a listájában a ROM
   mellett. Gépelj, helyezd el a szöveget, és a véglegesítés előtt méretezd
   vagy forgasd – menet közben a jelekből rajzolódik újra, így bármilyen
   méretben éles marad.

### Térkép építése csempékből

1. Rajzold a vászonra azokat a cellákat, amelyeket csempeként szeretnél
   használni.
2. **Fájl > Térképszerkesztő**, és vedd át őket a csempekészletbe.
3. Állítsd be a térkép méretét, és fess. A bal gomb lerak egy csempét, a jobb
   radíroz, a kitöltés pedig lecseréli az azonos csempék összefüggő területét.
4. Exportáld `.zxtm` formátumba, ha tovább dolgoznál rajta, vagy assembly, C
   vagy nyers bináris formában, hogy programban használd.

### Rajzolás a ZX Spectrum Nextre

1. Válassz egy Next módot a Kép menüben – 256, 320 vagy 640 széles Layer 2 módot
   vagy az egyik LoRes módot.
2. Ezekben a módokban nincs attribútumütközés; minden pixelnek saját
   palettaindexe van. Egy 256 kilencbites színből álló palettát kezelsz, amelyet
   a **Kép > Paletta szerkesztése** menüpontban szerkesztesz, és `.pal` vagy
   `.npl` formátumba mentesz.
3. Mentsd a képet `.nxi` formátumba, amely a palettát is tartalmazza, vagy
   `.sl2`-be a nyers bitképhez.
4. Sprite-okhoz használd a **Fájl > Sprite-szerkesztő** menüpontot, és a lapot
   `.spr` formátumba mentsd.

Egy klasszikus képet átalakíthatsz Next módba és vissza. A visszaút azt jelenti,
hogy minden cellát újra két színre kell szorítani, ezért abban az irányban
számíts részletvesztésre; a PixULA szól, mielőtt megtenné.

### Kép valódi hardverre

- **Emulátorhoz** ments `.scr` fájlt. Ez a Spectrum képernyőmemóriájának nyers
  tartalma, és minden emulátor olvassa. A pontos méret a képernyőmódtól függ – a
  képernyőmódokról szóló fejezet táblázata mindegyikhez megadja.
- **Valódi géphez** ments `.tap` vagy `.tzx` fájlt. Ha a képernyődet egy olyan
  szalaghoz akarod adni, amelyen már más fájlok is vannak, használd a
  **Fájl > Szalagblokkok** menüpontot.
- **Ha olyannak mutatnád meg, akinek nincs Spectruma**, ments `.png` fájlt. Ha a
  kép villogó cellákat használ, ments `.gif` fájlt, és jelöld be a **VILLOGÓ
  cellák animálása** lehetőséget – ez a hardver saját ütemében kétképkockás
  hurkot ír, így a villogás megmarad.
