## Súbory

Uložiť sa dajú dve rôzne veci a záleží na tom, po ktorej siahnete.

**Projekt** uchová vašu prácu tak, ako ste ju opustili: každú vrstvu, paletu,
režim obrazovky, vaše nástroje a ich nastavenia, referenčný obrázok a miesto,
kam ste sa pozerali. Je to súbor `.pixula`, ktorý zapisuje **Súbor > Uložiť
projekt**, a je to to pravé, kým je obrázok rozpracovaný.

Projekt s animáciou sa ukladá novším spôsobom, ktorý každú snímku zabalí len raz, a preto sa neotvorí v PixULA 0.1.0-beta.2 ani staršom. Projekt bez animácie sa otvorí v každej verzii.

**Obrázok** je jedna zlúčená obrazovka vo formáte, ktorému rozumie iný program –
`.scr` pre emulátor, `.png` na ukázanie, `.tap` na nahranie na skutočný hardvér.
Zapisuje ich **Súbor > Uložiť obrázok ako**. Obsahujú len obrázok a nič iné –
to chcete, keď výsledok odovzdávate, nie keď na ňom chcete ďalej pracovať.

### Import obrázka

Pri otvorení fotky alebo iného obrázka (PNG, JPG, GIF) sa vedľa seba ukážu tri prevody - Ostrý, Hladký a Plochý - a kliknete na ten, ktorý sa vám páči. Hladký mení odtiene na pixely atramentu a papiera a zoznam **Dithering** pod náhľadmi určuje ako: predvolený je vlastný Floyd-Steinberg importu a zoznam ponúka aj ďalších 30 metód ZX Paintbrush - prahy, rozptyl chyby, Bayerove matice, zhlukové bodky a superbunky. Výber metódy prekreslí Hladký a tiež Ostrý, keď ste nejakú vybrali (Plochý nikdy nerastruje). Usporiadané metódy pokračujú cez atribútové bunky, takže vzor beží cez celý obrázok; rozptyl chyby zostáva vnútri každej bunky, pretože každá bunka má svoje dve farby. V režimoch Layer 2 a LoRes zoznam funguje tiež: každý pixel sa umiestni medzi svoje dve najbližšie farby palety a celý obrázok je jeden blok, takže rozptyl chyby beží cez celý obrázok.

Ovládacie prvky **Umiestnenie** vedľa nich určujú, kde obrázok na obrazovke leží - sú to tie isté prvky ako v paneli Referencia. **Prispôsobiť** ukáže celý obrázok s čiernymi pruhmi, **Vyplniť** pokryje obrazovku a presah oreže, **Roztiahnuť** ho roztiahne presne na veľkosť obrazovky bez ohľadu na jeho tvar a **Na stred** ho vráti doprostred. **Mierka** ho zväčšuje okolo jeho stredu (pod nulou je zrkadlený), **Otočenie** ho otáča, polia **Posun** a smerový ovládač ho posúvajú po jednom pixeli a **Preklopiť vodorovne** a **Preklopiť zvisle** ho zrkadlia. Náhľady sledujú každú zmenu a čo obrázok nepokryje, bude čierne. Ak je načítaný referenčný obrázok, **Použiť umiestnenie referencie** umiestni import presne tam, kde leží referencia: najprv si fotku zarovnajte nad kresbou ako referenciu a potom ju na tom mieste importujte.

### Uloženie časti obrázka

**Súbor > Uložiť výber ako** ponúka rovnaké formáty ako Uložiť obrázok ako, každý len vtedy, keď sa pre výber hodí. PNG, BMP a JPEG vezmú ľubovoľný obdĺžnik. ZXP, SEV, ZED, ASM, C, BIN a ATR vezmú celé atribútové bunky: výber sa najprv prispôsobí bunkám a stavový riadok to oznámi. ColorTiles vezme celé dlaždice 16x16. Formáty, ktoré sú výpisom jednej celej obrazovky (SCR, pásky, MLT a podobné), sú otvorené len vtedy, keď je výber celá obrazovka. ASM, C, BIN a ATR zapíšu časť po riadkoch: bitmapu ako blok bajtov na riadok zhora nadol a atribúty po jednom bajte na bunku; robia to v klasických, multicolor a ULAplus režimoch. Výber od ruky alebo elipsa uloží svoj ohraničujúci obdĺžnik. Zavretý formát povie prečo, keď naň ukážete. Uložiť obrázok ako ukladá celý obrázok a výber ignoruje.

### Nový obrázok z výberu

**Úpravy > Nový obrázok z výberu** urobí z výberu celý obrázok. Výber sa najprv prispôsobí celým bunkám. Pred akciou sa opýta a Ctrl+Z vráti pôvodný obrázok. Všetky vrstvy zostanú a sú orezané na ten blok, ktorý sa presunie vľavo hore; zvyšok je prázdny a pozadie je tam biely Papier. Režim obrazovky ostane rovnaký a obrázok sa stane nepomenovaným, takže ďalšie Uložiť sa opýta na názov.

### Automatické ukladanie a zálohy

PixULA vie každých pár minút ukladať vašu prácu do úložiska prehliadača a znova
ju ponúknuť, keď relácia skončí zle. Je to vypnuté, kým nezvolíte interval:
nastavte **Automatické ukladanie každých (minút, 0 = vypnuté)** v Predvoľbách, v
časti Všeobecné.

Môžete tiež zvoliť priečinok na disku a každé automatické uloženie doň zapíše
očíslovanú verziu – `picture V1.pixula`, `picture V2.pixula` a tak ďalej.
Číslovanie sa zakaždým načíta z priečinka, takže znova otvorený obrázok v rade
pokračuje, namiesto aby začínal od V1, a dve relácie nad tým istým obrázkom
zdieľajú jeden rad verzií. Koľko ich uchovať, nastavíte v Predvoľbách; predvolené
je 20.

Jednu vec treba čakať. Prehliadač znova neotvorí priečinok zvolený v
predchádzajúcej relácii bez vášho potvrdenia a časovač automatického ukladania
sa nemôže spýtať za vás. Prvá záloha po opätovnom načítaní sa preto zastaví a
počká na vás. V Predvoľbách je tlačidlo **Obnoviť zálohovanie** a jeho stlačenie
je to potvrdenie, na ktoré prehliadač čaká.

{{formats}}
