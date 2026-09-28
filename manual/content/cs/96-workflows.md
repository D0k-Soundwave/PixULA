## Postupy

Několik běžných úkolů od začátku do konce.

### Váš první obrázek

1. Otevřete `PixULA.html`. Začínáte ve Standardní ULA s prázdnou obrazovkou
   256 × 192.
2. Zapněte buňkovou mřížku vedle ovládání přiblížení, abyste viděli bloky 8 × 8,
   ve kterých se ukládá barva.
3. Vyberte barvu inkoustu v barevné liště nebo klávesami 1 až 8 a barvu papíru
   pravým kliknutím na vzorek.
4. Kreslete **Štětcem**. Levé tlačítko pro inkoust, pravé pro papír.
5. Přibližujte klávesami `+` a `-`. Podržte mezerník a táhněte, abyste se
   posunuli, nebo použijte nástroj **Posun zobrazení**.
6. `Ctrl+Z` vrací zpět. `Ctrl+S` uloží projekt `.pixula`, který kromě obrázku
   uchová i vrstvy a nastavení.

Rozvrhnout barevné plochy před detaily obvykle ušetří práci, protože hranice
barvy, která nepadne na hranici buňky, bude znovu a znovu měnit barvy, které
jste už vyřešili.

### Obkreslení fotografie

1. Otevřete panel **Reference** a načtěte fotografii. Leží za kresbou s
   průhledností, polohou a měřítkem, které nastavíte, a nikdy není součástí
   ukládaného obrázku.
2. Kreslete přes ni na běžné vrstvě.
3. Pokud reference někdy vypadá méně ostře než originál, panel na to upozorní a
   nabídne tlačítko **Najít fotografii**. PixULA odkazuje na soubor na disku,
   takže když se fotka přesune, zůstane z ní jen malý náhled.

### Převod fotografie

Aby převod udělal PixULA:

1. **Soubor > Načíst** a vyberte `.png`, `.jpg` nebo `.gif`.
2. Okno importu ukáže tři převody vedle sebe: Ostrý, Hladký a Plochý. Který
   vypadá nejlépe, záleží zcela na fotografii, takže se vyplatí pokaždé porovnat
   všechny tři.
3. Upravte jas, kontrast a měřítko, dokud náhled nebude dobře čitelný, a
   potvrďte.

V ULAplus a v režimech Next se paleta sestaví z vašeho obrázku, takže nejste
omezeni šestnácti barvami ULA. To obvykle udělá velký rozdíl.

### Vytvoření písma

1. **Soubor > Editor písma**.
2. Začněte písmem ZX ROM nebo importujte sadu `.ch8` či `.chr`.
3. Vyberte znak a upravte ho. K dispozici jsou šířky 4, 6 a 8 pixelů, ale
   zúžení natrvalo zahodí pravé sloupce, takže při zkoušení postupujte od úzké.
4. Pojmenujte písmo, abyste ho přidali do knihovny.
5. Vyberte nástroj **Text**. Vaše písmo se objeví v seznamu vedle písma ROM.
   Napište text, umístěte ho a před potvrzením ho zvětšete nebo otočte –
   průběžně se překresluje ze znaků, takže zůstává ostrý v jakékoli velikosti.

### Stavba mapy z dlaždic

1. Nakreslete na plátno buňky, které chcete použít jako dlaždice.
2. **Soubor > Editor map** a převezměte je do sady dlaždic.
3. Nastavte velikost mapy a malujte. Levé tlačítko pokládá dlaždici, pravé maže
   a vyplnění nahradí souvislou oblast stejných dlaždic.
4. Exportujte jako `.zxtm`, chcete-li pokračovat v práci, nebo jako assembler, C
   či surová binární data pro použití v programu.

### Kreslení pro ZX Spectrum Next

1. V nabídce Obrázek vyberte režim Next – Layer 2 o šířce 256, 320 nebo 640
   nebo jeden z režimů LoRes.
2. V těchto režimech není konflikt atributů; každý pixel nese vlastní index
   palety. Spravujete paletu 256 devítibitových barev, upravovanou přes
   **Obrázek > Upravit paletu** a ukládanou jako `.pal` nebo `.npl`.
3. Uložte obrázek jako `.nxi`, který paletu obsahuje, nebo jako `.sl2` pro
   holou bitmapu.
4. Pro sprity použijte **Soubor > Editor spritů** a arch uložte jako `.spr`.

Klasický obrázek můžete převést do režimu Next a zpět. Cesta zpět znamená znovu
vměstnat každou buňku do dvou barev, takže v tomto směru počítejte se ztrátou
detailů; PixULA vám to řekne dřív, než to udělá.

### Obrázek na skutečném hardwaru

- **Pro emulátor** uložte `.scr`. Je to surový obsah obrazové paměti Spectra a
  přečte ho každý emulátor. Přesná velikost závisí na režimu obrazovky – pro
  každý ji uvádí tabulka v kapitole o režimech obrazovky.
- **Pro skutečný počítač** uložte `.tap` nebo `.tzx`. Chcete-li svou obrazovku
  přidat na pásku, na které už jsou jiné soubory, použijte **Soubor > Bloky
  pásky**.
- **Chcete-li ho ukázat někomu bez Spectra**, uložte `.png`. Pokud obrázek
  používá blikající buňky, uložte `.gif` a zaškrtněte **Animovat buňky
  BLIKÁNÍ** – zapíše se smyčka dvou snímků v tempu samotného hardwaru, takže
  blikání přežije.
