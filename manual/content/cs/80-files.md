## Soubory

Uložit lze dvě různé věci a záleží na tom, po které sáhnete.

**Projekt** uchová vaši práci tak, jak jste ji opustili: každou vrstvu, paletu,
režim obrazovky, vaše nástroje a jejich nastavení, referenční obrázek a místo,
kam jste se dívali. Je to soubor `.pixula`, který zapisuje **Soubor > Uložit
projekt**, a je to to pravé, dokud je obrázek rozpracovaný.

Projekt s animací se ukládá novějším způsobem, který každý snímek zabalí jen jednou, a proto se neotevře v PixULA 0.1.0-beta.2 ani starším. Projekt bez animace se otevře v každé verzi.

**Obrázek** je jedna sloučená obrazovka ve formátu, kterému rozumí jiný program
– `.scr` pro emulátor, `.png` k ukázání, `.tap` k nahrání na skutečný hardware.
Zapisuje je **Soubor > Uložit obrázek jako**. Obsahují jen obrázek a nic jiného
– to chcete, když výsledek předáváte, ne když na něm chcete dál pracovat.

### Import obrázku

Při otevření fotky nebo jiného obrázku (PNG, JPG, GIF) se vedle sebe ukážou tři převody - Ostrý, Hladký a Plochý - a kliknete na ten, který se vám líbí. Hladký mění odstíny na pixely inkoustu a papíru a seznam **Dithering** pod náhledy určuje jak: výchozí je vlastní Floyd-Steinberg importu a seznam nabízí i dalších 30 metod ZX Paintbrush - prahy, rozptyl chyby, Bayerovy matice, shlukové tečky a superbuňky. Výběr metody překreslí Hladký a také Ostrý, jakmile jste nějakou vybrali (Plochý nikdy nerastruje). Uspořádané metody pokračují přes atributové buňky, takže vzor běží přes celý obrázek; rozptyl chyby zůstává uvnitř každé buňky, protože každá buňka má své dvě barvy. V režimech Layer 2 a LoRes seznam funguje také: každý pixel se umístí mezi své dvě nejbližší barvy palety a celý obrázek je jeden blok, takže rozptyl chyby běží přes celý obrázek.

### Uložení části obrázku

**Soubor > Uložit výběr jako** nabízí stejné formáty jako Uložit obrázek jako, každý jen tehdy, když se pro výběr hodí. PNG, BMP a JPEG vezmou libovolný obdélník. ZXP, SEV, ZED, ASM, C, BIN a ATR vezmou celé atributové buňky: výběr se nejdřív přizpůsobí buňkám a stavový řádek to oznámí. ColorTiles vezmou celé dlaždice 16x16. Formáty, které jsou výpisem jedné celé obrazovky (SCR, pásky, MLT a podobné), jsou otevřené jen tehdy, když výběr je celá obrazovka. ASM, C, BIN a ATR zapíší část po řádcích: bitmapu jako blok bajtů na řádek shora dolů a atributy po jednom bajtu na buňku; dělají to v klasických, multicolor a ULAplus režimech. Výběr od ruky nebo elipsa uloží svůj ohraničující obdélník. Zavřený formát řekne proč, když na něj ukážete. Uložit obrázek jako ukládá celý obrázek a výběr ignoruje.

### Nový obrázek z výběru

**Úpravy > Nový obrázek z výběru** udělá z výběru celý obrázek. Výběr se nejdřív přizpůsobí celým buňkám. Před akcí se zeptá a Ctrl+Z vrátí původní obrázek. Všechny vrstvy zůstanou a jsou oříznuty na ten blok, který se přesune vlevo nahoru; zbytek je prázdný a pozadí je tam bílý Papír. Režim obrazovky zůstane stejný a obrázek se stane nepojmenovaným, takže další Uložit se zeptá na název.

### Automatické ukládání a zálohy

PixULA umí každých pár minut ukládat vaši práci do úložiště prohlížeče a
nabídnout ji znovu, když relace skončí špatně. Je to vypnuté, dokud nezvolíte
interval: nastavte **Automaticky ukládat každých (minut, 0 = vypnuto)** v
Předvolbách, v části Obecné.

Můžete také zvolit složku na disku a každé automatické uložení do ní zapíše
očíslovanou verzi – `picture V1.pixula`, `picture V2.pixula` a tak dále.
Číslování se pokaždé načte ze složky, takže znovu otevřený obrázek v řadě
pokračuje, místo aby začínal od V1, a dvě relace nad stejným obrázkem sdílejí
jednu řadu verzí. Kolik jich uchovat, nastavíte v Předvolbách; výchozí je 20.

Jednu věc je třeba čekat. Prohlížeč znovu neotevře složku zvolenou v
předchozí relaci bez vašeho potvrzení a časovač automatického ukládání se
nemůže zeptat za vás. První záloha po znovunačtení se proto zastaví a počká na
vás. V Předvolbách je tlačítko **Obnovit zálohování** a jeho stisknutí je to
potvrzení, na které prohlížeč čeká.

{{formats}}
