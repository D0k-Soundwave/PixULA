## Animácia

PixULA animuje dvoma spôsobmi. **Animácia obrazovky** mení zo snímky na snímku
celý obrázok. **Animácia spritu** mení jeden jeho blok, kráčajúcu postavu alebo
viajúcu vlajku, zatiaľ čo zvyšok obrázka za ním stojí. Obe dodržiavajú každé
pravidlo režimu obrazovky: snímka sa skladá z celých atribútových buniek, takže
nikdy nerozdelí atribúty bunky.

### Začiatok animácie

**Animácia > Nová animácia obrazovky** urobí z obrázka snímku 1. Každá vrstva
sa stane animovanou: má v každej snímke vlastný obsah.

**Animácia > Nová animácia spritu...** sa spýta na názov, šírku a výšku, polohu
a počet snímok na začiatok. Veľkosť sa zaokrúhli nahor na celé bunky režimu a
dialóg povie, čo z nej vzniklo: v režime 8x1 sa z 20 x 20 stane 24 x 20. Použiť
výber prevezme veľkosť a miesto z výberu. Ak chcete sprite umiestniť kliknutím,
najprv vyberte blok nástrojom Výber (Veľkosť: Vlastná). **Nová animácia spritu
z výberu** navyše presunie vybraný blok ako snímku 1 na vlastnú vrstvu spritu.
Bodkovaná čiara tesne mimo jeho okna ukazuje, kde je.

Obrázok môže mať niekoľko animácií; výber hore v paneli Animácia určí, ktorá je
otvorená. Režim obrazovky sa nemôže zmeniť, kým má obrázok animácie.

### Snímky

Panel Animácia ukazuje každú snímku ako malý obrázok s číslom a oneskorením.
Kliknutím na ňu na ňu prejdete, alebo stlačte `,` a `.` pre predchádzajúcu a
nasledujúcu snímku. Na zobrazenej snímke kreslíte každým nástrojom presne ako
na statickom obrázku: kolízia atribútov, režimy kreslenia, Zrkadlo, pečiatky,
Flash aj Späť fungujú ako vždy.

Pridať vloží za zobrazenú snímku prázdnu snímku a Duplikovať jej kópiu;
Zmazať, Vľavo a Vpravo ju zmažú a posunú. Oneskorenie je čas, počas ktorého
snímka zostane na obrazovke, v snímkach Spectra po 1/50 s, a Nastaviť všetky
dá toto oneskorenie všetkým snímkam. Ak chcete preniesť časť snímky do ďalšej,
skopírujte ju (**Animácia > Snímka na pečiatku** skopíruje okno spritu),
prejdite na ďalšiu snímku a položte pečiatku. Vrátenie kroku urobeného na inej
snímke vás vráti na tú snímku.

**Animácia > Pečiatky na snímky** urobí z každej pečiatky v zozname Pečiatky
novú snímku, položenú tam, kde pečiatka stojí; pečiatky zostanú.

### Vrstvy v animácii

Kým je otvorená animácia, má každý riadok panelu Vrstvy prepínač Animovaná /
Spoločná. Animovaná vrstva má v každej snímke vlastný obsah; spoločná vyzerá
vo všetkých snímkach rovnako, ako pozadie nakreslené raz. Animovaná vrstvu
skopíruje do každej snímky; Spoločná ponechá zobrazenú snímku, po potvrdení.
Nové vrstvy patria k otvorenej animácii a Zlúčiť nadol, Zlúčiť vybrané a
Zlúčiť všetko pôsobia na každú snímku.

### Prehrávanie

Prehrať (Enter) prehrá otvorenú animáciu na obrázku; sprite sa pohybuje po
svojom pozadí a FLASH aj blikanie GigaScreen bežia ďalej. Prvá,
Predchádzajúca, Ďalšia a Posledná prechádzajú snímkami (podržaním
Predchádzajúca alebo Ďalšia pokračujete) a Stop sa vráti na snímku, odkiaľ
prehrávanie začalo. Kliknutie na obrázok alebo Escape pozastaví. Opakovanie
prehrá snímky v slučke, raz alebo tam a späť. Rýchlosť prehráva rýchlejšie
alebo pomalšie bez zmeny oneskorení a Prehrať snímky prehrá iba časť animácie.

### Obkresľovanie snímok

**Obkresliť** pod snímkou ukáže tú snímku vyblednuto, kým kreslíte ostatné, ako
náhľadovú vrstvu v paneli Vrstvy. Prepínač **Cibuľová šupka** rovnako ukáže
predchádzajúcu a nasledujúcu snímku a obe vás nasledujú, keď meníte snímku.
**Vrstva > Nová náhľadová vrstva** pridá jednu z nich samostatne.

Náhľadová vrstva dodržiava pravidlo systému vrstiev: jej papierové pixely a
prázdne bunky sú priehľadné, atrament vrstiev nad ňou ju zakryje a nad tým, čo
je pod ňou, sa ukazuje vyblednuto. Posuňte ju nahor alebo nadol, aby ležala
nad alebo pod vrstvou, na ktorú kreslíte. Každá má vlastné krytie, tónovanie
(skoršie snímky načerveno, neskoršie namodro) a zobrazenie či skrytie a
zmazanie odstráni iba náhľad. Náhľad nikdy nie je súčasťou obrázka: nikdy sa
naň nekreslí, nezlučuje sa ani neexportuje a pri prehrávaní je skrytý.

### Export

**Animácia > Exportovať animáciu**:

- **Číslované obrazovky...** uloží každú snímku ako vlastnú obrazovku Spectra,
  očíslovanú po poradí (`walk_001.scr`, `walk_002.scr` a tak ďalej), v
  akomkoľvek formáte obrazovky, ktorý režim vie uložiť. Každý súbor je presne
  to, čo pre tú snímku zapíše Uložiť obrázok ako. Vyberiete názov, prvé číslo,
  počet číslic a snímky. Ak prehliadač vie zapisovať do priečinka, vyberiete
  ho; inak obrazovky prídu ako jeden `.zip`.
- **Animovaný GIF** prehrá snímky s ich oneskoreniami, vrátane FLASH a
  GigaScreen.
- **Hárok spritov PNG** položí snímky vedľa seba, 16 v rade.
- **SevenuP, všetky snímky** zapíše až 32 snímok do jedného `.sev`
  (štandardný režim). Otvorenie `.sev` s viacerými snímkami z nich urobí
  animáciu spritu.
- **Páska** zapíše jeden SCREEN$ na snímku do `.tap` alebo `.tzx`. Obsahuje
  obrazovky, nie program, ktorý ich prehrá.
- **Sprity pre Next** zapíše animáciu spritu 16 x 16 v režimoch Layer 2 a LoRes
  ako hárok `.spr`.

Animácie sa ukladajú v projektoch PixULA, v záchrannom uložení aj v zálohách.
