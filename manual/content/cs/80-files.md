## Soubory

Uložit lze dvě různé věci a záleží na tom, po které sáhnete.

**Projekt** uchová vaši práci tak, jak jste ji opustili: každou vrstvu, paletu,
režim obrazovky, vaše nástroje a jejich nastavení, referenční obrázek a místo,
kam jste se dívali. Je to soubor `.pixula`, který zapisuje **Soubor > Uložit
projekt**, a je to to pravé, dokud je obrázek rozpracovaný.

**Obrázek** je jedna sloučená obrazovka ve formátu, kterému rozumí jiný program
– `.scr` pro emulátor, `.png` k ukázání, `.tap` k nahrání na skutečný hardware.
Zapisuje je **Soubor > Uložit obrázek jako**. Obsahují jen obrázek a nic jiného
– to chcete, když výsledek předáváte, ne když na něm chcete dál pracovat.

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
