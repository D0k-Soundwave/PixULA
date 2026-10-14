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

**Veľké písma.** Nové veľké písmo... vytvorí veľkú sadu CHX, akú používa ZX-Editor Second Edition: každý znak je široký aj vysoký 8, 16, 24 alebo 32 pixelov (šírka a výška sa volia osobitne) a editor namiesto zoznamu šírok ukazuje veľkosť. Zaškrtnutím Vyplniť písmom vyberiete ľubovoľné písmo z rovnakého zoznamu, aký používa nástroj Text, koľko výšky znaku majú písmená zaberať (v percentách) a či ležia vľavo, v strede alebo vpravo. Ak zaškrtnete Proporcionálne, každé písmeno sa uloží len takto široké, ako potrebuje, v celých stĺpcoch po 8 pixelov, takže i zaberie menej miesta ako W; znak Medzera si vždy ponechá aspoň jeden stĺpec. Vyplniť z písma... urobí to isté jedným krokom s veľkým písmom, ktoré už máte. Veľké písmo sa dá uložiť len ako `.chx` (ostatné formáty a výpisy v assembleri, C a binárne obsahujú znaky 8 × 8), nedá sa z neho zachytiť bunka z plátna. Nástroj Text aj Písanie na plátno ho používajú ako každé uložené písmo, každé písmeno tak široké, ako je uložené. Otvorenie veľkého `.chx` ponechá každý znak v jeho vlastnej veľkosti a znak, ktorý súbor vynecháva, zostane pri ďalšom uložení vynechaný. Usporiadanie znaku z viacerých blokov 8 × 8 v súbore vychádza zo zverejneného popisu formátu a nebolo overené na súbore uloženom samotným ZX Paintbrush, preto veľké písmo vytvorené tu otvorte v ZX Paintbrush, než sa naň spoľahnete.

**Tieňovanie a vrátenie späť.** Pri písme, ktorého znaky sú široké celý počet stĺpcov po 8 pixeloch, štyri tlačidlá Tieňovanie zatieňujú alebo odtieňujú po jednom stĺpci vľavo alebo vpravo upravovaného znaku. Zatienený stĺpec je zobrazený šrafovaním a neukladá sa: súbor `.chx` obsahuje takýto znak užší a znak zatienený celý je zo súboru vynechaný. Body pod tieňovaním zostávajú v editore zachované, takže odtienenie ich vráti, v súbore však nie sú. Zatieniť všetko podľa znaku to urobí pre všetky znaky naraz: zatieni prázdne stĺpce na oboch stranách bodov, Medzere ponechá jeden stĺpec a ostatné prázdne znaky vynechá. Znak Medzera si vždy ponechá aspoň jeden stĺpec, pretože súbor `.chx` ju musí obsahovať. Po exporte `.chx` stavový riadok uvedie, koľko znakov bolo uložených užších, koľko ich bolo vynechaných a u koľkých boli pod tieňovaním body. Editor písma má aj Späť a Znova (dve tlačidlá alebo Ctrl+Z a Ctrl+Y): jeden ťah na editačnej ploche je jeden krok, rovnako ako každé tlačidlo, Nové veľké písmo, Vyplniť z písma, Načítať písmo ROM alebo import. Písanie do poľa s názvom písma sa do toho nepočíta.

**Všetky znaky.** Tlačidlo Všetky znaky nahradí editor jedného znaku mapou celého písma, všetky znaky vedľa seba po 16 v riadku, na ktorú kreslíte rovnakým Štetcom, Gumou, Čiarou a Výplňou, takže ťah môže prejsť z jedného znaku do druhého. Jeden ťah je jedna zmena a jeden krok Späť a Výplň zostáva vnútri znaku, na ktorý kliknete. Nástroj Zatieniť zatieni alebo odtieni stĺpec s 8 pixelmi, na ktorý kliknete, od bližšieho okraja jeho znaku; zatienené stĺpce sú šrafované. Nástroj Posun presúva mapu, tak ju prstom posuniete, pretože mapa inak prijíma každý dotyk na kreslenie. Tlačidlá mínus, Prispôsobiť a plus menia zväčšenie po celých krokoch. V mape aj v mriežke znakov prechádzajú šípky, Home a End od znaku k znaku a napísanie znaku ho vyberie. Kresliť pixely len klávesnicou sa nedá.

### Editor máp

Mapa je mriežka dlaždíc, kde dlaždica je jedna bunka 8 × 8 – osem bajtov bitmapy
a jeden bajt atribútov. Mapy umožňujú postaviť hraciu plochu väčšiu než jedna
obrazovka.

![Editor máp s paletou dlaždíc a posuvnou plochou mapy](img/dialog-map-editor.png)

*Dlaždice vľavo, mapa vpravo.*

Maľujte ľavým tlačidlom a mažte pravým, alebo vyplnením nahraďte súvislú oblasť
rovnakých dlaždíc. Dlaždice pochádzajú z aktuálneho vzoru a farieb, alebo priamo
z plátna.

Uložte ako `.zxtm`, ak chcete pokračovať v práci – je to vlastný formát PixULA a
uchová všetko –, alebo ako `.zxm`, alebo ako assembler, C či surové binárne dáta
na vloženie do programu.

### Prvky mapy

**Hľadanie opakujúcich sa častí.** Vyberte blok obrázka (celé bunky; výber sa najprv upraví na bunky) a zvoľte Úpravy > Nájsť prvok mapy, alebo stlačte Ctrl+F ako v ZX Paintbrush. Otvorí sa panel Prvky mapy a každé miesto, kde sa blok objavuje, je na obrázku orámované; Predchádzajúce a Ďalšie nimi prechádzajú a posúvajú obrázok. Zoznam **Zhoda** hovorí, čo znamená „rovnaké“: Body a farby (body aj bajty farieb sú rovnaké), Len body (farby sa ignorujú) alebo Vyzerá rovnako (bunky by ukazovali rovnaké farby v oboch fázach blikania - prázdna bunka sa zhoduje s každou prázdnou bunkou toho istého papiera a bunka s obrátenými bodmi a vymenenými atramentom a papierom sa zhoduje s originálom; v GigaScreen a páre Timex sa každá obrazovka porovnáva osobitne). Timex hi-res nemá farby buniek, a preto ponúka len posledné dve. Miesta, ktoré sa navzájom prekrývajú, a miesta, ktoré už zakrýva skorší prvok, sa vynechajú a počet hovorí koľko. **Prijať** uloží prvok s mapou a zakryje jeho miesta číslovanými poľami. Prijatie obrázok nikdy nemení a nie je krokom Späť - Ctrl+Z prvok ponechá; zmažte ho v paneli. Hľadanie funguje tam, kde sú bunky 8 × 8 s farbami: Standard, ULAplus, ULANext, GigaScreen a Timex hi-res; inde povie prečo nie. Ctrl+F už pri práci s obrázkom neotvára vlastné hľadanie prehliadača (ponuka prehliadača áno).

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
