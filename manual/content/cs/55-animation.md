## Animace

PixULA animuje dvěma způsoby. **Animace obrazovky** mění ze snímku na snímek
celý obrázek. **Animace spritu** mění jeden jeho blok, kráčející postavu nebo
vlající vlajku, zatímco zbytek obrázku za ním stojí. Obě dodržují každé
pravidlo režimu obrazovky: snímek se skládá z celých atributových buněk, takže
nikdy nerozdělí atributy buňky.

### Začátek animace

**Animace > Nová animace obrazovky** udělá z obrázku snímek 1. Každá vrstva se
stane animovanou: má v každém snímku vlastní obsah.

**Animace > Nová animace spritu...** se zeptá na název, šířku a výšku, polohu a
počet snímků na začátek. Velikost se zaokrouhlí nahoru na celé buňky režimu a
dialog řekne, co z ní vzniklo: v režimu 8x1 se z 20 x 20 stane 24 x 20. Použít
výběr převezme velikost a místo z výběru. Chcete-li sprite umístit kliknutím,
nejprve vyberte blok nástrojem Výběr (Velikost: Vlastní). **Nová animace spritu
z výběru** navíc přesune vybraný blok jako snímek 1 na vlastní vrstvu spritu.
Tečkovaná čára těsně vně jeho okna ukazuje, kde je.

Obrázek může mít několik animací; výběr nahoře v panelu Animace určí, která je
otevřená. Režim obrazovky se nemůže změnit, dokud má obrázek animace.

### Snímky

Panel Animace ukazuje každý snímek jako malý obrázek s číslem a prodlevou.
Kliknutím na něj na něj přejdete, nebo stiskněte `,` a `.` pro předchozí a
další snímek. Na zobrazeném snímku kreslíte každým nástrojem přesně jako na
statickém obrázku: kolize atributů, režimy kreslení, Zrcadlo, razítka, Flash i
Zpět fungují jako vždy.

Přidat vloží za zobrazený snímek prázdný snímek a Duplikovat jeho kopii;
Smazat, Vlevo a Vpravo ho smažou a posunou. Prodleva je doba, po kterou snímek
zůstane na obrazovce, ve snímcích Spectra po 1/50 s, a Nastavit vše dá tuto
prodlevu všem snímkům. Chcete-li přenést část snímku do dalšího, zkopírujte ji
(**Animace > Snímek na razítko** zkopíruje okno spritu), přejděte na další
snímek a položte razítko. Vrácení kroku provedeného na jiném snímku vás vrátí
na ten snímek.

**Animace > Razítka na snímky** udělá z každého razítka v seznamu Razítka
nový snímek, položený tam, kde razítko stojí; razítka zůstanou.

### Vrstvy v animaci

Dokud je otevřená animace, má každý řádek panelu Vrstvy přepínač Animovaná /
Sdílená. Animovaná vrstva má v každém snímku vlastní obsah; sdílená vypadá ve
všech snímcích stejně, jako pozadí nakreslené jednou. Animovaná vrstvu
zkopíruje do každého snímku; Sdílená ponechá zobrazený snímek, po potvrzení.
Nové vrstvy patří k otevřené animaci a Sloučit dolů, Sloučit vybrané a Sloučit
vše působí na každý snímek.

### Přehrávání

Přehrát (Enter) přehraje otevřenou animaci na obrázku; sprite se pohybuje po
svém pozadí a FLASH i blikání GigaScreen běží dál. První, Předchozí, Další a
Poslední procházejí snímky (podržením Předchozí nebo Další pokračujete) a Stop
se vrátí na snímek, odkud přehrávání začalo. Kliknutí na obrázek nebo Escape
pozastaví. Opakování přehraje snímky ve smyčce, jednou nebo tam a zpět.
Rychlost přehrává rychleji nebo pomaleji bez změny prodlev a Přehrát snímky
přehraje jen část animace.

### Obkreslování snímků

**Obkreslit** pod snímkem ukáže ten snímek vybledle, zatímco kreslíte ostatní,
jako náhledovou vrstvu v panelu Vrstvy. Přepínač **Cibulová slupka** stejně
ukáže předchozí a další snímek a oba vás následují, když měníte snímek.
**Vrstva > Nová náhledová vrstva** přidá jeden z nich samostatně.

Náhledová vrstva dodržuje pravidlo systému vrstev: její papírové pixely a
prázdné buňky jsou průhledné, inkoust vrstev nad ní ji zakryje a nad tím, co je
pod ní, se ukazuje vybledle. Posuňte ji nahoru nebo dolů, aby ležela nad nebo
pod vrstvou, na kterou kreslíte. Každá má vlastní krytí, tónování (dřívější
snímky červeně, pozdější modře) a zobrazení či skrytí a smazání odstraní jen
náhled. Náhled nikdy není součástí obrázku: nikdy se na něj nekreslí, neslučuje
se ani neexportuje a při přehrávání je skrytý.

### Export

**Animace > Exportovat animaci**:

- **Číslované obrazovky...** uloží každý snímek jako vlastní obrazovku
  Spectra, očíslovanou popořadě (`walk_001.scr`, `walk_002.scr` a tak dále), v
  jakémkoli formátu obrazovky, který režim umí uložit. Každý soubor je přesně
  to, co pro ten snímek zapíše Uložit obrázek jako. Vyberete název, první
  číslo, počet číslic a snímky. Umí-li prohlížeč zapisovat do složky, vyberete
  ji; jinak obrazovky přijdou jako jeden `.zip`.
- **Animovaný GIF** přehraje snímky s jejich prodlevami, včetně FLASH a
  GigaScreen.
- **Arch spritů PNG** položí snímky vedle sebe, 16 v řadě.
- **SevenuP, všechny snímky** zapíše až 32 snímků do jednoho `.sev`
  (standardní režim). Otevření `.sev` s více snímky z nich udělá animaci
  spritu.
- **Páska** zapíše jeden SCREEN$ na snímek do `.tap` nebo `.tzx`. Obsahuje
  obrazovky, ne program, který je přehraje.
- **Sprity pro Next** zapíše animaci spritu 16 x 16 v režimech Layer 2 a LoRes
  jako arch `.spr`.

Animace se ukládají v projektech PixULA, v záchranném uložení i v zálohách.
