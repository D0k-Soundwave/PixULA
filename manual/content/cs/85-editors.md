## Editory

Čtyři věci, které PixULA vytváří, nejsou obrázky, a každá má v nabídce Soubor
vlastní okno.

### Editor písma

Znaková sada Spectra má 96 nebo 256 znaků, každý uložený jako sloupec bajtů
řádků. Zde je upravujete po jednom.

![Editor písma s mřížkou znaků na jedné straně a jedním upravovaným znakem na druhé](img/dialog-font-editor.png)

*Vyberte znak z mřížky vlevo a upravte ho vpravo.*

Znaky mohou být široké 4, 6 nebo 8 pixelů při výšce buňky. Zúžení písma
natrvalo zahodí pravé sloupce, takže zkoušíte-li šířky, postupujte od úzké k
široké.

Můžete začít písmem ZX ROM, převzít znak z plátna nebo načíst sadu `.ch4`,
`.ch6`, `.ch8`, `.chr` nebo `.chx` z jiného nástroje pro Spectrum. Pojmenováním
písma ho přidáte do své knihovny a nástroj Text ho pak nabídne vedle
vestavěného písma ROM.

**Velká písma.** Nové velké písmo... vytvoří velkou sadu CHX, jakou používá ZX-Editor Second Edition: každý znak je široký i vysoký 8, 16, 24 nebo 32 pixelů (šířka a výška se volí zvlášť) a editor místo seznamu šířek ukazuje velikost. Zaškrtnutím Vyplnit písmem vyberete libovolné písmo ze stejného seznamu, jaký používá nástroj Text, kolik výšky znaku mají písmena zabírat (v procentech) a zda leží vlevo, uprostřed nebo vpravo. Zaškrtnete-li Proporcionální, každé písmeno se uloží jen tak široké, jak potřebuje, v celých sloupcích po 8 pixelech, takže i zabere méně místa než W; znak Mezera si vždy ponechá alespoň jeden sloupec. Vyplnit z písma... totéž provede jedním krokem s velkým písmem, které už máte. Velké písmo lze uložit jen jako `.chx` (ostatní formáty a výpisy v assembleru, C a binární obsahují znaky 8 × 8), nelze z něj zachytit buňku z plátna. Nástroj Text i Psaní na plátno ho používají jako každé uložené písmo, každé písmeno tak široké, jak je uložené. Otevření velkého `.chx` ponechá každý znak v jeho vlastní velikosti a znak, který soubor vynechává, zůstane při dalším uložení vynechán. Uspořádání znaku z několika bloků 8 × 8 v souboru vychází ze zveřejněného popisu formátu a nebylo ověřeno na souboru uloženém samotným ZX Paintbrush, proto velké písmo vytvořené zde otevřete v ZX Paintbrush, než se na něj spolehnete.

**Stínování a vrácení zpět.** U písma, jehož znaky jsou široké celý počet sloupců po 8 pixelech, čtyři tlačítka Stínování zastiňují nebo odstiňují po jednom sloupci vlevo nebo vpravo upravovaného znaku. Zastíněný sloupec je zobrazen šrafováním a neukládá se: soubor `.chx` obsahuje takový znak užší a znak zastíněný celý je ze souboru vynechán. Pixely inkoustu pod stínováním zůstávají v editoru zachovány, takže odstínění je vrátí, v souboru ale nejsou. Zastínit vše podle znaku to provede pro všechny znaky najednou: zastíní prázdné sloupce po obou stranách pixelů inkoustu, Mezeře ponechá jeden sloupec a ostatní prázdné znaky vynechá. Znak Mezera si vždy ponechá alespoň jeden sloupec, protože soubor `.chx` ji musí obsahovat. Po exportu `.chx` stavový řádek uvede, kolik znaků bylo uloženo užších, kolik jich bylo vynecháno a u kolika byly pod stínováním pixely inkoustu. Editor písma má také Zpět a Znovu (dvě tlačítka nebo Ctrl+Z a Ctrl+Y): jeden tah na editační ploše je jeden krok, stejně jako každé tlačítko, Nové velké písmo, Vyplnit z písma, Načíst písmo ROM nebo import. Psaní do pole s názvem písma se do toho nepočítá.

**Všechny znaky.** Tlačítko Všechny znaky nahradí editor jednoho znaku mapou celého písma, všechny znaky vedle sebe po 16 v řádku, na kterou kreslíte stejným Štětcem, Gumou, Čárou a Výplní, takže tah může přejít z jednoho znaku do druhého. Jeden tah je jedna změna a jeden krok Zpět a Výplň zůstává uvnitř znaku, na který kliknete. Nástroj Stínovat zastíní nebo odstíní sloupec o 8 pixelech, na který kliknete, od bližšího okraje jeho znaku; zastíněné sloupce jsou šrafované. Nástroj Posun přetahuje mapu, čímž ji prstem posunete, protože mapa jinak přijímá každý dotyk ke kreslení. Tlačítka mínus, Přizpůsobit a plus mění zvětšení po celých krocích. V mapě i v mřížce znaků přecházejí šipky, Home a End od znaku ke znaku a napsání znaku ho vybere. Kreslit pixely jen klávesnicí nelze.

### Editor map

Mapa je mřížka dlaždic, kde dlaždice je jedna buňka 8 × 8 – osm bajtů bitmapy a
jeden bajt atributů. Mapy umožňují postavit hrací plochu větší než jedna
obrazovka.

![Editor map s paletou dlaždic a posuvnou plochou mapy](img/dialog-map-editor.png)

*Dlaždice vlevo, mapa vpravo.*

Malujte levým tlačítkem a mažte pravým, nebo vyplněním nahraďte souvislou
oblast stejných dlaždic. Dlaždice pocházejí z aktuálního vzoru a atributů, nebo
přímo z plátna.

Uložte jako `.zxtm`, chcete-li pokračovat v práci – je to vlastní formát PixULA
a uchová vše –, nebo jako `.zxm`, nebo jako assembler, C či surová binární data
pro vložení do programu.

### Prvky mapy

**Hledání opakujících se částí.** Vyberte blok obrázku (celé buňky; výběr se nejprve upraví na buňky) a zvolte Úpravy > Najít prvek mapy, nebo stiskněte Ctrl+F jako v ZX Paintbrush. Otevře se panel Prvky mapy a každé místo, kde se blok objevuje, je na obrázku orámováno; Předchozí a Další jimi procházejí a posouvají obrázek. Seznam **Shoda** říká, co znamená „stejné“: Pixely a atributy (pixely i bajty atributů jsou shodné), Jen pixely (atributy se ignorují) nebo Vypadá stejně (buňky by ukazovaly stejné barvy v obou fázích blikání - prázdná buňka se shoduje s každou prázdnou buňkou téhož Papíru a buňka s obrácenými pixely a prohozeným Inkoustem a Papírem se shoduje s originálem; v GigaScreen a páru Timex se každá obrazovka porovnává zvlášť). Timex hi-res nemá atributy buněk, a proto nabízí jen poslední dvě. Místa, která se navzájem překrývají, a místa, která už zakrývá dřívější prvek, se vynechají a počet říká kolik. **Přijmout** uloží prvek s mapou a zakryje jeho místa číslovanými poli. Přijetí obrázek nikdy nemění a není krokem Zpět - Ctrl+Z prvek ponechá; smažte ho v panelu. Hledání funguje tam, kde jsou buňky 8 × 8 s atributy: Standard, ULAplus, ULANext, GigaScreen a Timex hi-res; jinde řekne proč ne. Ctrl+F už při práci s obrázkem neotevírá vlastní hledání prohlížeče (nabídka prohlížeče ano). **Seznam.** Panel Prvky mapy vypisuje každý prvek s tlačítky Ukázat (orámuje jeho místa a pokaždé vybere další) a Smazat (nejdřív se zeptá; obrázek se nemění). **Shift+M** nebo Zobrazení > Obrázky prvků mapy vymění číslovaná pole za vlastní obrázek každého prvku v barvách, které obrázek ukazuje (pár GigaScreen se smíchá). Na zakryté místo lze dál kreslit; tahy zůstanou skryté pod krytem, dokud prvek nesmažete. Nový, Otevřít a Nový obrázek z výběru se před opuštěním prvků zeptají. **V souborech.** Prvky se ukládají s mapou (`.zxtm`), s projektem (`.pixula`) i s automatickým záložním uložením. Soubor > Uložit obrázek jako > ZXM zapíše obrázek spolu s jeho prvky jako ZX Paintbrush (jen Standard ULA; prvky z jiného režimu obrazovky se s upozorněním vynechají) a Soubor > Otevřít u `.zxm` vrátí obojí. `.zxm` Editoru map nadále obsahuje jen jeho dlaždicovou mapu. Hledání nelze začít na bloku, který už pokrývá dřívější prvek: upozornění ten prvek pojmenuje a jeho smazáním se blok uvolní. Ctrl+Z po otevření obrázku nebo po Nový obrázek z výběru vrátí starý obrázek i s jeho prvky.

### Editor spritů

Sprity Next mají 16 × 16 pixelů s jedním indexem palety na pixel a arch jich
pojme až 64.

![Editor spritů s archem spritů a mřížkou pro úpravy](img/dialog-sprite-editor.png)

*Na jedné straně arch, na druhé sprite, který kreslíte.*

Archy spritů se ukládají do souborů `.spr`, ne do obrázku, takže arch ukládejte
zvlášť. V indexovaných režimech můžete sprite převzít z plátna a otisknout ho na
něj.

### Editor palety

**Obrázek > Upravit paletu**, v režimech s upravitelnou paletou. ULAplus
zobrazuje jako čtyři palety po šestnácti a paletu Next jako řady devítibitových
barev. Každá zvolená barva se zaokrouhlí na nejbližší hodnotu, kterou hardware
skutečně dokáže uložit, takže to, co vidíte, ukáže i počítač.

Každá změna je samostatný krok zpět. Palety lze také načítat a ukládat bez
otevření tohoto okna – viz kapitola o barvě.

### Bloky pásky

**Soubor > Bloky pásky** otevře `.tap` nebo `.tzx` a vypíše jeho obsah. Použijte
ho k načtení jedné obrazovky z pásky s několika, nebo k přidání aktuálního
obrázku na pásku jako nového bloku a opětovnému uložení pásky.

Bloky, na které jste nesáhli, se zapíší zpět bajt po bajtu, takže přidáte-li
obrazovku na cizí pásku, zbytek zůstane přesně takový, jaký byl.
