## Farba

V klasických režimoch nevyberáte farbu pixelu. Vyberáte dve farby, ktoré použije
celá bunka, a k nim dva príznaky.

- **ATRAMENT** je farba pixelov atramentu.
- **PAPIER** je farba pixelov papiera.
- **JASNÝ** zdvihne obe farby na ich jasnejšiu verziu. Príznak Jasu je jeden na
  bunku, takže Atrament a Papier sú jasné buď oba, alebo ani jeden.
- **BLIKANIE** na skutočnom hardvéri vymieňa Atrament a Papier zhruba dvakrát
  za sekundu.

Ľavé tlačidlo myši kreslí pixely atramentu. Pravé kreslí pixely papiera a
nastaví tie isté štyri atribúty, aké by nastavilo ľavé. Pri pere robí bočné
tlačidlo to isté čo pravé tlačidlo myši.

**Guma** robí niečo iné než oboje. Mení pixely atramentu na pixely papiera a
atribúty bunky necháva tak, aj keď zmaže posledný pixel atramentu v bunke. Ak
chcete zmazať aj atribúty, prejdite gumou cez prázdnu bunku znova novým ťahom:
Atrament, Papier, Jas a Blikanie sa vrátia na
čiernu na bielej a na hornej vrstve bude bunka opäť priehľadná. Bunka, v ktorej
sú ešte pixely atramentu, si atribúty ponechá, nech cez ňu gumou prejdete koľkokrát chcete.
Voľba **Atribúty** pri gume, zobrazená v režimoch obrazovky s atribútmi buniek,
to mení: Nastaviť na aktuálne zmaže pixely atramentu a dá bunke atribúty z
farebnej lišty, ako stierací
nástroj ZX Paintbrush, a Ponechať, predvolená voľba, je správanie opísané
vyššie.

Každú zo štyroch častí možno nastaviť aj na **použiť existujúce**: kockované
políčko pod ňou na farebnej lište. Ťah potom túto časť každej bunky ponechá tak,
ako je, namiesto toho, aby zapísal vaše nastavenie. Nastavte ATRAMENT, PAPIER a
JASNÝ na existujúce a zapnite BLIKANIE a voľba **Vyplniť iba atribúty** nástroja
výplne rozbliká celú plochu bez zmeny jedinej farby. Shift+B a Shift+F prepínajú
JASNÝ a BLIKANIE a Shift+T nastaví všetky štyri na existujúce. V ULAplus volia
JASNÝ a BLIKANIE tabuľku CLUT, preto má výber CLUT jediné políčko, ktoré ponechá
CLUT každej bunky.

### Režimy kreslenia

Režim kreslenia mení, čo ťah urobí. Pamätá sa medzi reláciami, takže ho stavový
riadok zobrazuje vždy, keď je iný než Normálny – v niektorých z týchto režimov
ťah nezanechá nič viditeľné a inak by ste nemali ako zistiť prečo.

Horný pás má tri tlačidlá: **Režim kreslenia**, **Nástroj buniek** a
**Zrkadlenie**. Každé ukazuje platnú voľbu. Kliknutím pod ním otvoríte malú
mriežku ďalších volieb; kliknutím na jednu sa mriežka zatvorí. Klávesom Escape
alebo kliknutím inam ju zatvoríte bez zmeny. Režim kreslenia a Zrkadlenie
fungujú spoločne: ak nastavíte XOR a Vodorovne, ťah je zrkadlený ťah XOR.
Nástroj buniek, keď je zapnutý, preberá každý ťah.

{{draw-modes}}

Štetec vo všetkých podobách, vypĺňanie, tvary, Bézierova krivka, text, pečiatky
z panela **Pečiatky** a ľavé tlačidlo prechodu sa riadia režimom kreslenia.
Guma, kvapkadlo, presúvanie, vkladanie a mazanie výberu, panel
**Transformácia**, voľba **Vyplniť iba atribúty** a tlačidlá Zameniť a Prefarbiť
ho neberú do úvahy.

**Prefarbiť Atrament nie je to isté ako Prefarbiť.** Prefarbiť Atrament a
Prefarbiť Papier sú režimy kreslenia: prefarbujú každú bunku, ktorej sa nástroj
dotkne - niekoľko pri malom štetci, každú, ktorú pokrýva vyplnený obdĺžnik - a
platí Zrkadlenie. **Prefarbiť** v tlačidle Nástroj buniek prefarbuje celú bunku
pod ukazovateľom bez ohľadu na zvolený nástroj, bez ohľadu na veľkosť štetca a
Zrkadlenie. **Vymeniť** z toho istého tlačidla funguje rovnako a vymení Atrament
s Papierom každej bunky. Oboje zostáva zapnuté, kým ho nevypnete - zvoľte
Žiadny, zvoľte ho znova, kliknite pravým tlačidlom na plátno alebo vyberte
nástroj či režim kreslenia - a stavový riadok to hlási, kým je zapnuté.

**Iba atribúty** je tretí z týchto režimov kreslenia. Dá každej bunke, ktorej sa
nástroj dotkne, Atrament, Papier, Jas a Blikanie naraz a nekreslí žiadny pixel,
ako ZX Paintbrush s vypnutým kreslením pixelov. Každá zo štyroch častí nastavená
na **použiť existujúce** zostane v každej bunke tak, ako je: s Papierom na
existujúcom robí to isté ako Prefarbiť Atrament, s Atramentom na existujúcom to
isté ako Prefarbiť Papier. Rovnako ako pri nich obe tlačidlá robia to isté a
režim sa ponúka iba v režimoch obrazovky, ktorých bunky majú atribúty.

**Kopírovať atribúty, Invertovať pixely a Invertovať pixely a atribúty** sú ďalšie tri
nástroje pre bunky v tom istom tlačidle Nástroj buniek a fungujú rovnako:
vyberte jeden a klikajte alebo ťahajte cez bunky. Každé ťahanie sa vracia jedným
krokom a nástroj zostáva zapnutý, kým ho nevypnete. **Kopírovať atribúty** prevezme
atribúty, ktoré ukazuje bunka pod prvým kliknutím, a dá ich každej bunke, cez ktorú
ťaháte; paleta farieb sa nemení. **Invertovať pixely** zmení pixely atramentu
každej celej bunky na pixely papiera a pixely papiera na atrament, atribúty
ponechá (prázdnu bunku vyplní). **Invertovať pixely a atribúty** navyše vymení
Atrament s Papierom, takže každá bunka
vyzerá rovnako; slúži na upratanie importovaného obrázka, preskakuje bunky, do
ktorých kreslí aj iná vrstva, a v ULAplus a ULANext sa neponúka. Nástroj pre
bunky sa ponúka len v režimoch obrazovky, kde môže fungovať: tlačidlo Nástroj
buniek uvádza len tie, ktoré platia (a je skryté tam, kde žiadny neplatí), a
Invertovať pixely funguje aj v Timex Hi-res, kde sú pixely v bunkách 8 × 8.

**XOR / Cez a XOR / Každý prejazd** pixely prepínajú, z atramentu na papier a z
papiera na atrament, namiesto toho, aby kreslili pixely atramentu, a oba dajú
bunke zvolené atribúty. XOR / Cez prepne každý pixel raz za
ťah, takže návrat po vlastnej čiare v tom istom ťahu už nič nezmení. XOR / Každý
prejazd prepne pixel zakaždým, keď cez neho ťah prejde: jeden ťah štetca je jeden
prejazd, aj keď sa štetec cestou sám prekrýva, ale ťah, ktorý pixel opustí a vráti
sa k nemu, ho prepne znova, takže osmička sa zruší tam, kde sa kríži. Tvary,
krivky, výplne a text sú vždy jediný prejazd, takže pri nich oba režimy dávajú
rovnaký výsledok.

**Inverzia** vymení, čo robia obe tlačidlá myši: ľavé tlačidlo kreslí pixely papiera a pravé
pixely atramentu, ako INVERSE 1 v BASICu. Zapína sa v Nastaveniach, alebo klávesom Shift+I, a stavový riadok hlási „Inverzia je zapnutá“, kým
trvá. V režimoch Prefarbiť Atrament, Prefarbiť Papier, Iba atribúty a v dvoch
režimoch XOR nič
nemení, lebo obe tlačidlá tam robia to isté; stavový riadok to hovorí. Text a
pečiatky kreslia svoje písmená a tvary pixelmi papiera namiesto pixelov
atramentu, vzor kladie svoje pixely atramentu ako pixely papiera a svoje pixely
papiera ako atrament, a výplň vypĺňa ľavým tlačidlom pixelmi papiera a pravým
pixelmi atramentu. Guma, Vymeniť a Prefarbiť ju ignorujú. Pamätá sa medzi
reláciami a ukladá sa v predvoľbách spolu s režimom kreslenia.

**Atribútové jadro.** Pri okrúhlom a štvorcovom štetci, obrysoch tvarov a
Bézierovej krivke hovorí Atribútové jadro, aká veľká časť hrubej čiary preberá
atribúty buniek. Čiara vždy nakreslí všetky pixely atramentu. S Atribútovým
jadrom na 1 pixel alebo 4 pixely preberajú vaše atribúty len bunky pod stredom
čiary, čiarou takej šírky, ktorá sleduje jej stred; ostatné bunky pod ňou
dostanú pixely atramentu v atribútoch, ktoré už mali, takže hrubá čiara koliduje
s menej bunkami. Celá čiara, predvolená voľba, dá vaše atribúty každej bunke,
ktorej sa čiara dotkne. Voľba sa zobrazuje len v režimoch obrazovky s atribútmi
buniek. Pri Zrkadlení má zrkadlená čiara vlastné jadro a pri XOR si bunky mimo
jadra ponechajú svoje atribúty.

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

**Pozície palety.** Paleta ULAplus a paleta Next majú každá štyri pozície, v ponuke Obrázok > Paleta (Pozícia 1 – Pozícia 4). Použitá pozícia je zaškrtnutá a editor palety hovorí, ktorú upravuje. Nový dokument začína na Pozícii 1 a ostatné držia predvolenú paletu, kým ich nepoužijete. Výber inej pozície zmení farby, ktorými sa obrázok zobrazuje, a nikdy nezmení atribúty obrázka. Každá voľba je jeden krok späť. Pozície sa ukladajú do projektu a do automatickej zálohy, ale až keď ste nejakú použili; obrázok otvorený z iného druhu súboru začína na Pozícii 1 a ostatné držia kópie jeho palety. Exporty .scr, .tap a obrázkov vždy používajú použitú pozíciu. Režimy s pevnou paletou (Standard ULA, režimy Multicolor, GigaScreen a režimy Timex) pozície nemajú.

**Invertovať paletu** (len ULAplus) vymení polovicu Atramentu (položky 0-7) s polovicou Papiera (položky 8-15) každej zo štyroch CLUT v jednom kroku späť; dvojité vykonanie paletu vráti. Aby obrázok ULAplus po invertovaní vyzeral rovnako, použite Invertovať paletu a potom Obrázok > Atribúty > Invertovať. Okraj sleduje polovicu Papiera CLUT 0, takže zmení farbu tiež. Režimy Next invertor palety nemajú, pretože ULANext drží Atrament v 8 položkách palety a Papier v 32.

**Klávesy CLUT.** V režimoch ULAplus vyberajú Ctrl+Shift+1 až Ctrl+Shift+4 CLUT 0 až 3, rovnako ako voľba CLUT na lište farieb. V iných režimoch to stavový riadok oznámi a nič iné sa nestane.

**Štandardné farby.** V Nastavenia > Predvoľby môžete v časti Štandardné farby zmeniť 15 farieb, ktoré ukazujú režimy Standard, Multicolor, GigaScreen a Timex. Jasná čierna je vždy čierna. Farby menia, čo vidíte a čo obsahujú exporty obrázkov (PNG, GIF, BMP, JPG); nikdy nemenia bajty súborov .scr ani .tap a import obrázka stále porovnáva s pôvodnými farbami Spectra, takže tá istá fotografia dá na každom stroji ten istý obrázok. Palety ULAplus a Next sú oddelené. OK farby použije, Zrušiť nič nezachová a Vrátiť štandardné vráti pôvodné. Ukladajú sa v tomto prehliadači, nie v projekte. Načítať .pal číta súbor štandardných farieb ZX Paintbrush (256 bajtov) a Uložiť .pal ho zapíše, čo je spôsob, ako farby preniesť do iného prehliadača.

**Pásky s paletou.** Súbor > Uložiť paletu ako TAP zapíše paletu ULAplus ako 176-bajtovú pásku. Načítaná na Spectre príkazom `LOAD ""` nastaví 64 položiek palety a potom načíta ďalší súbor na páske, takže páska s paletou môže byť pred páskou s obrázkom alebo hrou. Súbor > Načítať paletu a Súbor > Otvoriť čítajú pásky s paletou: vlastné pásky PixULA aj ZX Paintbrush. Páska s paletou ide do používanej pozície palety jedným krokom späť a nestane sa otvoreným súborom.

### GigaScreen

GigaScreen uchováva dve úplné obrazovky a zobrazuje ich striedavo, päťdesiatkrát
za sekundu. Oko zmieša dve farby každého pixelu do jednej, takže bunka s jedným
Atramentom a jedným Papierom na každej obrazovke môže zobraziť **štyri** farby a
celý obrázok ich dosiahne okolo sto.

Nikdy nekreslíte len na jednu obrazovku. Každý ťah zapisuje do oboch a farebná
lišta pracuje v pároch:

- **Obrazovka A** a **Obrazovka B** majú každá vlastné vzorky Atramentu a
  Papiera a vlastný **JASNÝ**. Blikanie je jedno spoločné nastavenie.
- **Maľovať** ukazuje štyri farby, ktoré z týchto volieb vzniknú, zmiešané
  presne tak, ako ich ukazuje plátno: Atrament na oboch obrazovkách, Atrament
  len na A, Atrament len na B a Papier na oboch. Vyberte jednu a ľavé tlačidlo
  ňou maľuje. Pravé tlačidlo vždy maľuje Papier na oboch obrazovkách.
- Zvoľte pre obe obrazovky ten istý Atrament a ľavá horná vzorka v Maľovať bude
  touto farbou, nezmiešanou – tak sa kreslí všetko, čo nemá vyzerať zmiešane.

Kvapkadlo to všetko zase prevezme: atribúty oboch obrazoviek a to, ktorú zo štyroch
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
  512 × 192. Vysoké rozlíšenie nemá atribúty buniek – každá obrazovka má jednu
  farebnú schému pre celý obrázok –, takže lišta ukazuje rad schém pre
  Obrazovku A a jeden pre Obrazovku B a Maľovať ukazuje štyri ich zmesi. Sú to
  súbory `.hrg`.

Prepnutie medzi ľubovoľnými dvojobrazovkovými režimami zachová obe obrazovky
podľa tých istých pravidiel, podľa ktorých sa prevádza jediná obrazovka.

### Atribúty

Položky Atribúty v ponuke Obrázok menia atribúty buniek a pixely nechávajú na
mieste. Invertovať prehodí Atrament a Papier v každej bunke a zachová Jas a
Blikanie. Vymazať zapíše aktuálny Atrament, Papier, Jas a Blikanie do každej
bunky; zaškrtnuté polia „použiť existujúce“ ponechajú to, čo bunka už má.
Otočiť vodorovne a Otočiť zvisle zrkadlia atribúty buniek. Každý príkaz pôsobí na
výber (všetky bunky, ktorých sa dotýka), alebo na celý obrázok, ak nič nie je
vybraté, a vracia sa jedným krokom. Položky sú šedé v režimoch bez atribútov
buniek (Timex Hi-res, Layer 2, LoRes), keď pláva pečiatka bez vlastných atribútov, a na zamknutej
vrstve.

Zmeniť... nájde bunky podľa ich atribútov a nahradí ich. Hľadať určuje, ktoré bunky sa majú nájsť: každé pole je hodnota alebo Ľubovoľné. Nahradiť za určuje, čím sa stanú: každé pole je hodnota alebo Ponechať. Dialóg ukáže, koľko buniek sa zmení, skôr než stlačíte OK, a OK sa vráti jedným krokom späť. Na GigaScreene sú skupiny Obrazovka A a Obrazovka B; v ULAplus CLUT 0-3 nahrádza voľby Jas a Blikanie. Zrušiť nič nemení.

### Pixely

Položky Pixely v ponuke Obrázok menia pixely a atribúty nechávajú v ich bunkách. Otočiť vodorovne a Otočiť zvisle zrkadlia pixely. Invertovať pixely a atribúty invertuje pixely a navyše prehodí Atrament a Papier v každej bunke, takže obrázok vyzerá rovnako. Nedá sa použiť v režimoch bez atribútov buniek (Layer 2, LoRes, Timex Hi-res) a keď pláva pečiatka, je sivá. V ULAplus a ULANext sa tiež neponúka, lebo výmena Atramentu a Papiera by zmenila vzhľad obrázka.

Voľba Posun v sekcii Posun panela Transformácia určuje, čo sa hýbe. Pixely a atribúty (predvolené) posúva celé bunky aj s ich Papierom. Iba pixely posúva pixely o pixel alebo o bunku naraz. Iba atribúty posúva atribúty buniek po jednej bunke. Ovládací kríž má aj uhlopriečky. Keď pláva pečiatka, Posun je sivý, pretože posun presúva celú pečiatku.

Šípky pri výbere sledujú rovnakú voľbu Posun.

### Pečiatky

Keď je pečiatka zapojená, panel **Transformácia** ukazuje, ako sa kladie.

**Atribúty** vyberajú medzi Iba pixely a Vlastné atribúty. Iba pixely kladie pixely pečiatky v atribútoch z lišty atribútov, ako vždy. Vlastné atribúty kladú atribúty, ktoré pečiatka nesie, bunku po bunke: pečiatku z Editora máp alebo pečiatku skopírovanú z obrázka v režime s atribútmi buniek. Pečiatka skopírovaná z obrázka začína ako Iba pixely, takže sa vloží presne ako predtým. Vlastné atribúty usadia pečiatku na celé bunky, ignorujú režim kreslenia, lištu farieb aj prepínač XOR a pečiatku nemožno zmenšiť, otáčať, ohnúť, preklopiť, invertovať ani obrysovať; panel to zašedí a povie prečo. Zmena tvaru pečiatky Iba pixely zahodí atribúty, ktoré niesla. Inverzia stále vymieňa, čo robia pixely atramentu a pixely papiera. Ak majú bunky pečiatky inú veľkosť ako súčasný režim obrazovky, je možné len Iba pixely.

**Presvitanie** (len Vlastné atribúty) nechá namiesto atribútu pečiatky presvitať atribút, ktorý už je na strane. Atrament, Papier, Jas a Blikanie majú každý svoje políčko. ULAplus má jedno políčko CLUT pre Jas a Blikanie spolu. V GigaScreen každé políčko platí pre obe obrazovky.

**Pixely papiera** rozhodujú, čo robia pixely papiera pečiatky. Ponechať pozadie nechá obraz pod nimi na pokoji (pečiatka s vlastnými atribútmi pod nimi stále prefarbí Papier, pokiaľ nepresvitá Papier). Zmazať pozadie z obrazu pod nimi tiež urobí pixely papiera, na celom obdĺžniku pečiatky. Režimy kreslenia bez opaku (XOR, Prefarbiť Atrament, Prefarbiť Papier) a vlastný prepínač XOR pečiatky nechajú pixely papiera na pokoji a panel to oznámi. Pixely papiera sú dostupné v každom režime obrazovky, aj v tých bez atribútov buniek.

**Previesť na iba pixely** navždy zahodí atribúty pečiatky a ponechá jej pixely. Voľba Iba pixely v Atribútoch ich zachová, takže sa dá vrátiť. Každá zmena je jeden krok späť.

Kým je zapojená pečiatka s vlastnými atribútmi, príkazy Obrázok > Atribúty (Invertovať, Vymazať, obe Otočenia a Zmeniť...) pôsobia na bunky pečiatky, nie na obrázok, či už pláva, alebo je odložená. Ignorujú výber a nikdy sa nedotknú pixelov pečiatky a bunka, ktorú pečiatka nepokrýva, zostane bez zmeny. Otočenie zrkadlí atribútové bunky pečiatky, kým jej pixely zostanú na mieste. Pečiatka na GigaScreen má jednu sadu atribútov pre obe obrazovky, takže dialóg Zmeniť ukazuje jednu skupinu. Každý príkaz je jeden krok späť. Pri pečiatke bez vlastných atribútov zostanú šedé.
