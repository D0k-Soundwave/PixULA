## Editory

Štyri veci, ktoré PixULA vytvára, nie sú obrázky, a každá má v ponuke Súbor
vlastné okno.

### Editor písma

Znaková sada Spectra má 96 alebo 256 znakov, každý uložený ako stĺpec bajtov
riadkov. Tu ich upravujete po jednom.

![Editor písma s mriežkou znakov na jednej strane a jedným upravovaným znakom na druhej](img/dialog-font-editor.png)

*Vyberte znak z mriežky vľavo a upravte ho vpravo.*

Znaky môžu byť široké 4, 6 alebo 8 pixelov pri výške bunky. Zúženie písma
natrvalo zahodí pravé stĺpce, takže ak skúšate šírky, postupujte od úzkej k
širokej.

Môžete začať písmom ZX ROM, prevziať znak z plátna alebo načítať sadu `.ch4`,
`.ch6`, `.ch8`, `.chr` alebo `.chx` z iného nástroja pre Spectrum. Pomenovaním
písma ho pridáte do svojej knižnice a nástroj Text ho potom ponúkne vedľa
vstavaného písma ROM.

### Editor máp

Mapa je mriežka dlaždíc, kde dlaždica je jedna bunka 8 × 8 – osem bajtov bitmapy
a jeden bajt atribútov. Mapy umožňujú postaviť hraciu plochu väčšiu než jedna
obrazovka.

![Editor máp s paletou dlaždíc a posuvnou plochou mapy](img/dialog-map-editor.png)

*Dlaždice vľavo, mapa vpravo.*

Maľujte ľavým tlačidlom a mažte pravým, alebo vyplnením nahraďte súvislú oblasť
rovnakých dlaždíc. Dlaždice pochádzajú z aktuálneho vzoru a farieb, alebo priamo
z plátna. Mapu môžete vykresliť späť na plátno a jediné späť vráti všetko.

Uložte ako `.zxtm`, ak chcete pokračovať v práci – je to vlastný formát PixULA a
uchová všetko –, alebo ako `.zxm`, alebo ako assembler, C či surové binárne dáta
na vloženie do programu.

### Editor spritov

Sprity Next majú 16 × 16 pixelov s jedným indexom palety na pixel a hárok ich
pojme až 64.

![Editor spritov s hárkom spritov a mriežkou na úpravy](img/dialog-sprite-editor.png)

*Na jednej strane hárok, na druhej sprite, ktorý kreslíte.*

Hárky spritov sa ukladajú do súborov `.spr`, nie do obrázka, takže hárok
ukladajte zvlášť. V indexovaných režimoch môžete sprite prevziať z plátna a
odtlačiť ho naň.

### Editor palety

**Obrázok > Upraviť paletu**, v režimoch s upraviteľnou paletou. ULAplus
zobrazuje ako štyri palety po šestnásť a paletu Next ako rady deväťbitových
farieb. Každá zvolená farba sa zaokrúhli na najbližšiu hodnotu, ktorú hardvér
skutočne dokáže uložiť, takže to, čo vidíte, ukáže aj počítač.

Každá zmena je samostatný krok späť. Palety sa dajú aj načítať a ukladať bez
otvorenia tohto okna – pozrite kapitolu o farbe.

### Bloky pásky

**Súbor > Bloky pásky** otvorí `.tap` alebo `.tzx` a vypíše jeho obsah. Použite
ho na načítanie jednej obrazovky z pásky s viacerými, alebo na pridanie
aktuálneho obrázka na pásku ako nového bloku a opätovné uloženie pásky.

Bloky, na ktoré ste nesiahli, sa zapíšu späť bajt po bajte, takže ak pridáte
obrazovku na cudziu pásku, zvyšok zostane presne taký, aký bol.
