## Súbory

Uložiť sa dajú dve rôzne veci a záleží na tom, po ktorej siahnete.

**Projekt** uchová vašu prácu tak, ako ste ju opustili: každú vrstvu, paletu,
režim obrazovky, vaše nástroje a ich nastavenia, referenčný obrázok a miesto,
kam ste sa pozerali. Je to súbor `.pixula`, ktorý zapisuje **Súbor > Uložiť
projekt**, a je to to pravé, kým je obrázok rozpracovaný.

**Obrázok** je jedna zlúčená obrazovka vo formáte, ktorému rozumie iný program –
`.scr` pre emulátor, `.png` na ukázanie, `.tap` na nahranie na skutočný hardvér.
Zapisuje ich **Súbor > Uložiť obrázok ako**. Obsahujú len obrázok a nič iné –
to chcete, keď výsledok odovzdávate, nie keď na ňom chcete ďalej pracovať.

### Import obrázka

Pri otvorení fotky alebo iného obrázka (PNG, JPG, GIF) sa vedľa seba ukážu tri prevody - Ostrý, Hladký a Plochý - a kliknete na ten, ktorý sa vám páči. Hladký mení odtiene na bodky a zoznam **Dithering** pod náhľadmi určuje ako: predvolený je vlastný Floyd-Steinberg importu a zoznam ponúka aj ďalších 30 metód ZX Paintbrush - prahy, rozptyl chyby, Bayerove matice, zhlukové bodky a superbunky. Výber metódy prepne na náhľad Hladký. Usporiadané metódy pokračujú cez atribútové bunky, takže vzor beží cez celý obrázok; rozptyl chyby zostáva vnútri každej bunky, pretože každá bunka má svoje dve farby. V režimoch Layer 2 a LoRes je zoznam zosivený: tieto režimy majú vlastný farebný dithering.

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
