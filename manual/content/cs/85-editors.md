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

### Editor map

Mapa je mřížka dlaždic, kde dlaždice je jedna buňka 8 × 8 – osm bajtů bitmapy a
jeden bajt atributů. Mapy umožňují postavit hrací plochu větší než jedna
obrazovka.

![Editor map s paletou dlaždic a posuvnou plochou mapy](img/dialog-map-editor.png)

*Dlaždice vlevo, mapa vpravo.*

Malujte levým tlačítkem a mažte pravým, nebo vyplněním nahraďte souvislou
oblast stejných dlaždic. Dlaždice pocházejí z aktuálního vzoru a barev, nebo
přímo z plátna. Mapu můžete vykreslit zpět na plátno a jediné zpět vrátí vše.

Uložte jako `.zxtm`, chcete-li pokračovat v práci – je to vlastní formát PixULA
a uchová vše –, nebo jako `.zxm`, nebo jako assembler, C či surová binární data
pro vložení do programu.

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
