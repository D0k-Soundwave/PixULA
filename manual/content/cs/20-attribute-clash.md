## Konflikt atributů

Spectrum ukládá obrázek ve dvou oddělených částech.

První je bitmapa: 256 × 192 pixelů, každý jeden bit, pixel inkoustu, nebo
pixel papíru. Druhá je mřížka atributů, jeden bajt na každý blok 8 × 8 těchto
pixelů – 32 bajtů na šířku a 24 na výšku. Každý z těchto bajtů určuje barvu
**Inkoustu** (barvu pixelů inkoustu), barvu **Papíru** (barvu pixelů papíru),
zda má dvojice **Jas** a zda má **Blikání**.

Tvar obrázku má tedy rozlišení 256 × 192, ale jeho barva jen 32 × 24. Každá
buňka 8 × 8 může zobrazit dvě barvy a každý pixel v ní má jednu, nebo druhou.

![Dvě úhlopříčné čáry se kříží na zvětšeném plátně se zobrazenou mřížkou buněk. Modrá čára zčervená v každé buňce, kterou prochází i červená](img/attribute-clash.png)

*Modrá a červená čára se kříží, při 800 % se zapnutou mřížkou buněk. Kde
červená čára prochází buňkou, je modrá čára v této buňce také červená. Červený
tah přišel druhý a nastavil Inkoust pro celou buňku, včetně pixelů inkoustu,
které už položil modrý tah.*

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

**Režimy kreslení.** Tah nemusí měnit pixely i atributy zároveň. Můžete kreslit
pixely inkoustu a atributy nechat být, nebo přebarvit buňku, aniž byste se
dotkli jediného pixelu.
Kapitola o barvě je vyjmenovává.

**Knihovna vzorů.** Jejím jádrem je sada dlaždic s naměřenou hustotou pixelů inkoustu
– po ní sáhnete, když buňka potřebuje šedou, kterou nepojme.

### Vidět pixely

Tři přepínače v nabídce Zobrazit mění to, co obrazovka ukazuje, aniž by se
změnil obrázek. **Atributy vypnuty** zobrazí pixely inkoustu černě a pixely papíru
bíle, takže vidíte, které pixely jsou opravdu inkoust. **Barevná mřížka** udělá totéž a navíc obarví
buňky jako šachovnici, takže jsou hranice buněk dobře vidět; ona a Atributy vypnuty
se navzájem vypínají. **Zastavit blikání** ponechá každou blikající buňku v
jejích normálních barvách. Žádný z nich se nedotýká obrázku, kroku zpět ani
exportu: uložený obrázek vypadá stejně, ať jsou zapnuté, nebo ne. Prohlížeč si
je pamatuje a přepínač, který v aktuálním režimu obrazovky nemůže fungovat, je
šedý – najetím myši uvidíte proč. U GigaScreen a MultiGiga ukazuje Atributy vypnuty
čtyři úrovně šedi: bílou tam, kde nemá pixel inkoustu žádná obrazovka, světle šedou
pro pixel inkoustu jen na obrazovce A, tmavší šedou jen pro obrazovku B a černou pro obě.

### Údaje u ukazatele

Pás pod obrázkem a stavový řádek říkají, kde je ukazatel. V **Předvolbách**
volba *Údaje u ukazatele ukazují* přidá atribut pod ukazatelem (jeho číslo
desítkově i šestnáctkově, pak Inkoust, Papír, Jas a Blikání; v ULAplus CLUT; v
GigaScreen obě obrazovky) a paměťovou adresu bajtu pixelu a jeho atributového
bajtu. Adresy existují tam, kde má skutečný stroj pevné rozložení: Standard ULA
a ULAplus (zobrazovací soubor od $4000, atributy od $5800), Timex hi-colour
(atributy ve druhém zobrazovacím souboru na $6000), Timex hi-res (sudé bajtové
sloupce na $4000, liché na $6000) a GigaScreen (obrazovka A jako standardní,
obrazovka B v bance 7 na $C000; přiřazení obrazovek bankám je konvence). Ostatní
režimy hlásí, že adresu nemají.

*Y se počítá od* lze nastavit na spodek, takže údaj čte jako BASIC PLOT, kde 0,0
je levý dolní roh a Y jde od 0 do 175. To existuje jen na horních 176 řádcích
obrázku 256 na 192; pod nimi a na jiných obrazovkách se zobrazí pomlčka. Mění se
jen údaj.

**Vlastní mřížka...** v nabídce Zobrazit nakreslí mřížku s libovolným krokem X a
Y, nastavovaným zvlášť, a **Zobrazit vlastní mřížku** ji zapíná a vypíná. Čáry
bližší než čtyři pixely na obrazovce se vynechají, dokud nepřiblížíte. Zapnuté
mřížky se při dalším spuštění vrátí. V Předvolbách *Barvy mřížek* nastavují
barvu každé mřížky; ponecháte-li zaškrtnuto *Barva motivu*, mřížka sleduje
motiv.

### Kde platí jiná pravidla

Pozdější hardware omezení různě uvolnil a PixULA umí pracovat se všemi
variantami. Stroje Timex zjemnily mřížku atributů. ULAplus nahradil šestnáct
pevných barev paletou dle vlastní volby. GigaScreen střídá dva obrázky tak
rychle, že vznikají barvy, které žádný z nich neobsahuje. ZX Spectrum Next ve
svých režimech Layer 2 a LoRes tento systém úplně opouští: tam má každý pixel
vlastní barvu.

Obrázek můžete mezi nimi převádět – viz další kapitola.
