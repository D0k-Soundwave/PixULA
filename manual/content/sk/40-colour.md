## Farba

V klasických režimoch nevyberáte farbu pixelu. Vyberáte dve farby, ktoré použije
celá bunka, a k nim dva príznaky.

- **ATRAMENT** je farba rozsvietených bodov.
- **PAPIER** je farba zhasnutých bodov.
- **JASNÝ** zdvihne obe farby na ich jasnejšiu verziu. Príznak jasu je jeden na
  bunku, takže atrament a papier sú jasné buď oba, alebo ani jeden.
- **BLIKANIE** na skutočnom hardvéri vymieňa atrament a papier zhruba dvakrát
  za sekundu.

Ľavé tlačidlo myši kreslí atramentom. Pravé kreslí papierom: zhasne bod a
nastaví tie isté štyri hodnoty, aké by nastavilo ľavé. Pri pere robí bočné
tlačidlo to isté čo pravé tlačidlo myši.

**Guma** robí niečo iné než oboje. Zhasína body a farby bunky necháva tak, aj keď
zmaže posledný bod v bunke. Ak chcete zmazať aj farby, prejdite gumou cez
prázdnu bunku znova novým ťahom: atrament, papier, jas a blikanie sa vrátia na
čiernu na bielej a na hornej vrstve bude bunka opäť priehľadná. Bunka, v ktorej
sú ešte body, si farby ponechá, nech cez ňu gumou prejdete koľkokrát chcete.

### Režimy kreslenia

Režim kreslenia mení, čo ťah urobí. Pamätá sa medzi reláciami, takže ho stavový
riadok zobrazuje vždy, keď je iný než Normálny – v niektorých z týchto režimov
ťah nezanechá nič viditeľné a inak by ste nemali ako zistiť prečo.

{{draw-modes}}

Štetec vo všetkých podobách, vypĺňanie, tvary, Bézierova krivka, text, pečiatky
z panela **Pečiatky** a ľavé tlačidlo prechodu sa riadia režimom kreslenia.
Guma, kvapkadlo, presúvanie, vkladanie a mazanie výberu, panel
**Transformácia**, voľba **Vyplniť iba atribúty** a tlačidlá Zameniť a Prefarbiť
ho neberú do úvahy.

**Prefarbiť atrament nie je to isté ako Prefarbiť.** Prefarbiť atrament a
Prefarbiť papier sú režimy kreslenia: prefarbia každú bunku, ktorej sa dotkne
aktuálny nástroj (pár buniek malým štetcom, všetky, ktoré pokryje vyplnený
obdĺžnik), a platí pre ne aj Zrkadlo. **Prefarbiť** hneď za oddeľovačom prefarbí
celú bunku pod ukazovateľom bez ohľadu na zvolený nástroj, veľkosť štetca aj
Zrkadlo. **Zameniť** vedľa neho funguje rovnako a v každej bunke zamení atrament
a papier. Ktorékoľvek z nich zostane zapnuté, kým naň znova nekliknete alebo
nezvolíte nástroj či režim kreslenia, a stavový riadok to počas toho zobrazuje.

**XOR / Cez a XOR / Každý prejazd** body prepínajú namiesto toho, aby ich
rozsvecovali, a oba dajú bunke zvolené farby. XOR / Cez prepne každý bod raz za
ťah, takže návrat po vlastnej čiare v tom istom ťahu už nič nezmení. XOR / Každý
prejazd prepne bod zakaždým, keď cez neho ťah prejde: jeden ťah štetca je jeden
prejazd, aj keď sa štetec cestou sám prekrýva, ale ťah, ktorý bod opustí a vráti
sa k nemu, ho prepne znova, takže osmička sa zruší tam, kde sa kríži. Tvary,
krivky, výplne a text sú vždy jediný prejazd, takže pri nich oba režimy dávajú
rovnaký výsledok.

### Palety

Dve rodiny režimov umožňujú meniť samotné farby. ULAplus ponúka 64 farebných
registrov usporiadaných ako štyri palety po šestnásť. Režimy Next ponúkajú 256
farieb po deväť bitov.

Palety sú súbory. Paletu môžete vytvoriť, uložiť a načítať do iného obrázka –
cez **Súbor > Načítať paletu** a **Súbor > Uložiť paletu** alebo z editora
palety. Kvôli načítaniu netreba editor otvárať, pretože paleta sa zvyčajne
načítava ešte pred kreslením.

Kde má formát súboru miesto pre paletu – `.scr` s 6976 bajtmi, `.nxi`, variant
Timex –, cestuje paleta aj vnútri obrázka.

### GigaScreen

GigaScreen uchováva dve úplné obrazovky a zobrazuje ich striedavo, päťdesiatkrát
za sekundu. Oko zmieša dve farby každého pixelu do jednej, takže bunka s jedným
atramentom a jedným papierom na každej obrazovke môže zobraziť **štyri** farby a
celý obrázok ich dosiahne okolo sto.

Nikdy nekreslíte len na jednu obrazovku. Každý ťah zapisuje do oboch a farebná
lišta pracuje v pároch:

- **Obrazovka A** a **Obrazovka B** majú každá vlastné vzorky atramentu a
  papiera a vlastný **JASNÝ**. Blikanie je jedno spoločné nastavenie.
- **Maľovať** ukazuje štyri farby, ktoré z týchto volieb vzniknú, zmiešané
  presne tak, ako ich ukazuje plátno: atrament na oboch obrazovkách, atrament
  len na A, atrament len na B a papier na oboch. Vyberte jednu a ľavé tlačidlo
  ňou maľuje. Pravé tlačidlo vždy maľuje papier na oboch obrazovkách.
- Zvoľte pre obe obrazovky ten istý atrament a ľavá horná vzorka v Maľovať bude
  touto farbou, nezmiešanou – tak sa kreslí všetko, čo nemá vyzerať zmiešane.

Kvapkadlo to všetko zase prevezme: farby oboch obrazoviek a to, ktorú zo štyroch
pixel ukazuje.

Tlačidlá zobrazenia menia len to, čo ukazuje plátno, nikdy to, kam ide ťah.
**Priemer** je to, čo oko vidí na skutočnom stroji. **Mihotanie** vymieňa obe
obrazovky v každej snímke, ako to robí hardvér. **A** a **B** ukazujú jednu
obrazovku samotnú. Obrázok uložený alebo exportovaný ako PNG použije Priemer,
keď je zobrazené Mihotanie, pretože statický obrázok mihotať nemôže.

Prechod do GigaScreen skopíruje obrázok na obe obrazovky, takže vyzerá rovnako
ako predtým. Odchod ponechá obrazovku A a zahodí obrazovku B; ak obrazovka B
obsahuje niečo iné, budete vopred upozornení.

Rovnaký spôsob práce platí pre ďalšie dva mihotavé režimy:

- **MultiGigaScreen 8×4, 8×2 a 8×1** kladú obe obrazovky na jemnejšie bunky
  Multicolor, takže štyri farby platia pre 4, 2 alebo jeden riadok namiesto
  bloku 8 × 8. Sú to súbory `.mg4`, `.mg2` a `.mg1` programu MultiArtist.
- **Timex Hi-res GigaScreen** strieda dve obrazovky vysokého rozlíšenia
  512 × 192. Vysoké rozlíšenie nemá farby buniek – každá obrazovka má jednu
  farebnú schému pre celý obrázok –, takže lišta ukazuje rad schém pre
  Obrazovku A a jeden pre Obrazovku B a Maľovať ukazuje štyri ich zmesi. Sú to
  súbory `.hrg`.

Prepnutie medzi ľubovoľnými dvojobrazovkovými režimami zachová obe obrazovky
podľa tých istých pravidiel, podľa ktorých sa prevádza jediná obrazovka.
