## Konflikt atributů

Spectrum ukládá obrázek ve dvou oddělených částech.

První je bitmapa: 256 × 192 bodů, každý jeden bit, rozsvícený nebo zhasnutý.
Druhá je mřížka barev, jeden bajt na každý blok 8 × 8 těchto bodů – 32 bajtů na
šířku a 24 na výšku. Každý z těchto bajtů určuje barvu **inkoustu** (rozsvícené
body), barvu **papíru** (zhasnuté body), zda je dvojice **jasná** a zda má
**blikat**.

Tvar obrázku má tedy rozlišení 256 × 192, ale jeho barva jen 32 × 24. Každá
buňka 8 × 8 může zobrazit dvě barvy a každý bod v ní má jednu, nebo druhou.

![Dvě úhlopříčné čáry se kříží na zvětšeném plátně se zobrazenou mřížkou buněk. Modrá čára zčervená v každé buňce, kterou prochází i červená](img/attribute-clash.png)

*Modrá a červená čára se kříží, při 800 % se zapnutou mřížkou buněk. Kde
červená čára prochází buňkou, je modrá čára v této buňce také červená. Červený
tah přišel druhý a nastavil barvu inkoustu pro celou buňku, včetně bodů, které
už položil modrý tah.*

Tomu se říká „konflikt atributů“ (*attribute clash*). Kreslení v jedné části
buňky změní barvu všeho ostatního v ní a žádné nastavení to nevypne – tak
funguje hardware.

### Jak s tím pracovat

Většina grafiků na Spectru plánuje barevné plochy před detaily a skládá obrázek
tak, aby hranice barev padly na hranice buněk. Když buňka potřebuje odstín,
který nepojme, použijí rozptyl: dvě barvy prokládané tak jemně, že je oko
smíchá.

PixULA s tím pomáhá třemi způsoby.

**Buňková mřížka.** Zapněte ji vedle ovládání přiblížení a přesně uvidíte, kde
je změna barvy zadarmo a kde vás bude něco stát.

**Režimy kreslení.** Tah nemusí měnit body i barvy zároveň. Můžete kreslit body
a barvy nechat být, nebo přebarvit buňku, aniž byste se dotkli jediného bodu.
Kapitola o barvě je vyjmenovává.

**Knihovna vzorů.** Jejím jádrem je sada dlaždic s naměřenou hustotou inkoustu
– po ní sáhnete, když buňka potřebuje šedou, kterou nepojme.

### Kde platí jiná pravidla

Pozdější hardware omezení různě uvolnil a PixULA umí pracovat se všemi
variantami. Stroje Timex zjemnily mřížku barev. ULAplus nahradil šestnáct
pevných barev paletou dle vlastní volby. GigaScreen střídá dva obrázky tak
rychle, že vznikají barvy, které žádný z nich neobsahuje. ZX Spectrum Next ve
svých režimech Layer 2 a LoRes tento systém úplně opouští: tam má každý pixel
vlastní barvu.

Obrázek můžete mezi nimi převádět – viz další kapitola.
