## Konflikt atribútov

Spectrum ukladá obrázok v dvoch oddelených častiach.

Prvá je bitmapa: 256 × 192 bodov, každý jeden bit, rozsvietený alebo zhasnutý.
Druhá je mriežka farieb, jeden bajt na každý blok 8 × 8 týchto bodov – 32 bajtov
na šírku a 24 na výšku. Každý z týchto bajtov určuje farbu **atramentu**
(rozsvietené body), farbu **papiera** (zhasnuté body), či je dvojica **jasná** a
či má **blikať**.

Tvar obrázka má teda rozlíšenie 256 × 192, no jeho farba len 32 × 24. Každá
bunka 8 × 8 môže zobraziť dve farby a každý bod v nej má jednu alebo druhú.

![Dve uhlopriečne čiary sa križujú na zväčšenom plátne so zobrazenou mriežkou buniek. Modrá čiara sčervenie v každej bunke, cez ktorú prechádza aj červená](img/attribute-clash.png)

*Modrá a červená čiara sa križujú, pri 800 % so zapnutou mriežkou buniek. Kde
červená čiara prechádza bunkou, je modrá čiara v tejto bunke tiež červená.
Červený ťah prišiel druhý a nastavil farbu atramentu pre celú bunku vrátane
bodov, ktoré už položil modrý ťah.*

Tomu sa hovorí „konflikt atribútov“ (*attribute clash*). Kreslenie v jednej časti
bunky zmení farbu všetkého ostatného v nej a žiadne nastavenie to nevypne – tak
funguje hardvér.

### Ako s tým pracovať

Väčšina grafikov na Spectre plánuje farebné plochy pred detailmi a skladá
obrázok tak, aby hranice farieb padli na hranice buniek. Keď bunka potrebuje
odtieň, ktorý nepojme, použijú rozptyl: dve farby prekladané tak jemne, že ich
oko zmieša.

PixULA s tým pomáha tromi spôsobmi.

**Bunková mriežka.** Zapnite ju vedľa ovládania priblíženia a presne uvidíte,
kde je zmena farby zadarmo a kde vás bude niečo stáť.

**Režimy kreslenia.** Ťah nemusí meniť body aj farby naraz. Môžete kresliť body
a farby nechať tak, alebo prefarbiť bunku bez toho, aby ste sa dotkli jediného
bodu. Kapitola o farbe ich vymenúva.

**Knižnica vzorov.** Jej jadrom je sada dlaždíc s nameranou hustotou atramentu –
po nej siahnete, keď bunka potrebuje sivú, ktorú nepojme.

### Kde platia iné pravidlá

Neskorší hardvér obmedzenie rôzne uvoľnil a PixULA vie pracovať so všetkými
variantmi. Stroje Timex zjemnili mriežku farieb. ULAplus nahradil šestnásť
pevných farieb paletou podľa vlastnej voľby. GigaScreen strieda dva obrázky tak
rýchlo, že vznikajú farby, ktoré žiadny z nich neobsahuje. ZX Spectrum Next vo
svojich režimoch Layer 2 a LoRes tento systém úplne opúšťa: tam má každý pixel
vlastnú farbu.

Obrázok môžete medzi nimi prevádzať – pozrite ďalšiu kapitolu.
