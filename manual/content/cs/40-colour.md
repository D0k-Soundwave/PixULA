## Barva

V klasických režimech nevybíráte barvu pixelu. Vybíráte dvě barvy, které použije
celá buňka, a k nim dva příznaky.

- **INKOUST** je barva rozsvícených bodů.
- **PAPÍR** je barva zhasnutých bodů.
- **JASNÝ** zvedne obě barvy na jejich jasnější verzi. Příznak jasu je jeden na
  buňku, takže inkoust a papír jsou jasné buď oba, nebo ani jeden.
- **BLIKÁNÍ** na skutečném hardwaru prohazuje inkoust a papír zhruba dvakrát za
  sekundu.

Levé tlačítko myši kreslí inkoustem. Pravé kreslí papírem: zhasne bod a nastaví
stejné čtyři hodnoty, jaké by nastavilo levé. U pera dělá boční tlačítko totéž
co pravé tlačítko myši.

**Guma** dělá něco jiného než obojí. Zhasíná body a barvy buňky nechává být, i
když smaže poslední bod v buňce. Chcete-li smazat i barvy, přejeďte gumou přes
prázdnou buňku znovu novým tahem: inkoust, papír, jas a blikání se vrátí na
černou na bílé a na horní vrstvě bude buňka opět průhledná. Buňka, ve které jsou
ještě body, si barvy ponechá, ať přes ni gumou přejedete kolikrát chcete.
Volba **Barvy** u gumy, zobrazená v režimech obrazovky s barevnými buňkami, to
mění: Nastavit na aktuální smaže body a dá buňce barvy z palety, jako stírací
nástroj ZX Paintbrush, a Ponechat, výchozí volba, je chování popsané výše.

Každou ze čtyř částí lze také nastavit na **použít stávající**: kostkované
políčko pod ní na barevné liště. Tah pak tuto část každé buňky ponechá, jak je,
místo aby zapsal vaše nastavení. Nastavte INKOUST, PAPÍR a JASNÝ na stávající a
zapněte BLIKÁNÍ, a volba **Vyplnit pouze atributy** nástroje výplně rozbliká
celou plochu, aniž by změnila jedinou barvu. Shift+B a Shift+F přepínají JASNÝ a
BLIKÁNÍ a Shift+T nastaví všechny čtyři na stávající. V ULAplus volí JASNÝ a
BLIKÁNÍ tabulku CLUT, proto má výběr CLUT jediné políčko, které ponechá CLUT
každé buňky.

### Režimy kreslení

Režim kreslení mění, co tah udělá. Pamatuje se mezi relacemi, takže ho stavový
řádek zobrazuje, kdykoli je jiný než Normální – v některých z těchto režimů tah
nezanechá nic viditelného a jinak byste neměli jak poznat proč.

Horní pruh má tři tlačítka: **Režim kreslení**, **Nástroj buněk** a
**Zrcadlení**. Každé ukazuje volbu, která platí. Kliknutím pod ním otevřete
malou mřížku dalších voleb; kliknutím na jednu se mřížka zavře. Klávesou Escape
nebo kliknutím jinam ji zavřete beze změny. Režim kreslení a Zrcadlení fungují
společně: nastavíte-li XOR a Vodorovně, je tah tahem XOR, zrcadleným. Nástroj
buněk, když je zapnutý, přebírá každý tah.

{{draw-modes}}

Štětec ve všech podobách, vyplňování, tvary, Bézierova křivka, text, razítka z
panelu **Razítka** a levé tlačítko přechodu se řídí režimem kreslení. Guma,
kapátko, přesouvání, vkládání a mazání výběru, panel **Transformace**, volba
**Vyplnit pouze atributy** a tlačítka Zaměnit a Přebarvit ho neberou v úvahu.

**Inkoust přebarvit není totéž co Přebarvit.** Inkoust přebarvit a Papír
přebarvit jsou režimy kreslení: přebarvují každou buňku, které se nástroj dotkne
- několik buněk u malého štětce, každou buňku, kterou pokrývá vyplněný obdélník
- a platí Zrcadlení. **Přebarvit** v tlačítku Nástroj buněk přebarvuje celou
buňku pod ukazatelem bez ohledu na zvolený nástroj, nehledě na velikost štětce a
Zrcadlení. **Prohodit** ze stejného tlačítka funguje stejně a vymění inkoust s
papírem každé buňky. Obojí zůstává zapnuté, dokud je nevypnete - zvolte Žádný,
zvolte je znovu, klikněte pravým tlačítkem na plátno nebo vyberte nástroj či
režim kreslení - a stavový řádek to hlásí, dokud je zapnuté.

**Kopírovat barvy, Invertovat body a Invertovat body a barvy** jsou další tři
nástroje pro buňky ve stejném tlačítku Nástroj buněk a fungují stejně: vyberte
jeden a klikejte nebo táhněte přes buňky. Každé tažení se vrací jedním krokem a
nástroj zůstává zapnutý, dokud ho nevypnete. **Kopírovat barvy** převezme barvy,
které ukazuje buňka pod prvním kliknutím, a dá je každé buňce, přes kterou
táhnete; paleta barev se nemění. **Invertovat body** smaže nastavené body každé
celé buňky a nastaví smazané, barvy ponechá (prázdnou buňku vyplní).
**Invertovat body a barvy** navíc prohodí inkoust s papírem, takže každá buňka
vypadá stejně; slouží k úklidu importovaného obrázku, přeskakuje buňky, do nichž
kreslí i jiná vrstva, a v ULAplus a ULANext se nenabízí. Nástroj pro buňky se
nabízí jen v režimech obrazovky, kde může fungovat: tlačítko Nástroj buněk uvádí
jen ty, které platí (a je skryté tam, kde žádný neplatí), a Invertovat body
funguje i v Timex Hi-res, kde jsou body v buňkách 8 × 8.

**XOR / Přes a XOR / Každý přejezd** body přepínají, místo aby je rozsvěcovaly,
a oba dají buňce zvolené barvy. XOR / Přes přepne každý bod jednou za tah, takže
návrat po vlastní čáře ve stejném tahu už nic nezmění. XOR / Každý přejezd
přepne bod pokaždé, když přes něj tah přejede: jeden tah štětce je jeden
přejezd, i když se štětec cestou sám překrývá, ale tah, který bod opustí a vrátí
se k němu, ho přepne znovu, takže osmička se zruší tam, kde se kříží. Tvary,
křivky, výplně a text jsou vždy jediný přejezd, takže u nich oba režimy dávají
stejný výsledek.

**Inverze** prohodí, co dělají obě tlačítka myši: levé tlačítko maže body a
pravé je nastavuje, jako INVERSE 1 v BASICu. Zapíná se v Předvolbách, nebo klávesou Shift+I, a stavový řádek hlásí „Inverze je zapnutá“, dokud trvá.
V režimech Inkoust přebarvit, Papír přebarvit a ve dvou režimech XOR nic nemění,
protože obě tlačítka tam dělají totéž; stavový řádek to říká. Text a razítka
mažou svá písmena a tvary místo jejich nastavení, vzorek klade své body jako
mazání a mezery jako body, a výplň vyplňuje levým tlačítkem papírem a pravým
inkoustem. Guma, Prohodit a Přebarvit ji ignorují. Pamatuje se mezi relacemi a
ukládá se v předvolbách spolu s režimem kreslení.

**Barevné jádro.** U kulatého a čtvercového štětce, obrysů tvarů a Bézierovy
křivky říká Barevné jádro, jak velká část tlusté čáry přebírá barvy buněk. Čára
vždy nastaví všechny body. S Barevným jádrem na 1 pixel nebo 4 pixely přebírají
vaše barvy jen buňky pod středem čáry, čárou tak široké, která sleduje její
střed; ostatní buňky pod ní dostanou body v barvách, které už měly, takže tlustá
čára koliduje s méně buňkami. Celá čára, výchozí volba, obarví každou buňku,
které se čára dotkne. Volba se zobrazuje jen v režimech obrazovky s barevnými
buňkami. U Zrcadlení má zrcadlená čára vlastní jádro a u XOR si buňky mimo jádro
ponechají své barvy.

### Palety

Dvě rodiny režimů umožňují měnit samotné barvy. ULAplus nabízí 64 barevných
registrů uspořádaných jako čtyři palety po šestnácti. Režimy Next nabízejí 256
barev po devíti bitech.

Palety jsou soubory. Můžete paletu vytvořit, uložit a načíst do jiného obrázku –
přes **Soubor > Načíst paletu** a **Soubor > Uložit paletu** nebo z editoru
palety. Kvůli načtení není třeba editor otevírat, protože paleta se obvykle
načítá ještě před kreslením.

Kde má formát souboru místo pro paletu – `.scr` o 6976 bajtech, `.nxi`, varianta
Timex –, cestuje paleta i uvnitř obrázku.

### GigaScreen

GigaScreen uchovává dvě úplné obrazovky a zobrazuje je střídavě, padesátkrát za
sekundu. Oko smíchá dvě barvy každého pixelu v jednu, takže buňka s jedním
inkoustem a jedním papírem na každé obrazovce může zobrazit **čtyři** barvy a
celý obrázek jich dosáhne kolem sta.

Nikdy nekreslíte jen na jednu obrazovku. Každý tah zapisuje do obou a barevná
lišta pracuje v párech:

- **Obrazovka A** a **Obrazovka B** mají každá vlastní vzorky inkoustu a papíru
  a vlastní **JASNÝ**. Blikání je jedno společné nastavení.
- **Malovat** ukazuje čtyři barvy, které z těchto voleb vzniknou, smíchané
  přesně tak, jak je ukazuje plátno: inkoust na obou obrazovkách, inkoust jen na
  A, inkoust jen na B a papír na obou. Vyberte jednu a levé tlačítko jí maluje.
  Pravé tlačítko vždy maluje papír na obou obrazovkách.
- Zvolte pro obě obrazovky stejný inkoust a levý horní vzorek v Malovat bude
  touto barvou, nesmíchanou – tak se kreslí vše, co nemá vypadat smíchaně.

Kapátko to vše zase převezme: barvy obou obrazovek a to, kterou ze čtyř pixel
ukazuje.

Tlačítka zobrazení mění jen to, co ukazuje plátno, nikdy to, kam jde tah.
**Průměr** je to, co oko vidí na skutečném stroji. **Mihotání** prohazuje obě
obrazovky v každém snímku, jako to dělá hardware. **A** a **B** ukazují jednu
obrazovku samotnou. Obrázek uložený nebo exportovaný jako PNG použije Průměr,
když je zobrazeno Mihotání, protože statický obrázek mihotat nemůže.

Přechod do GigaScreen zkopíruje obrázek na obě obrazovky, takže vypadá stejně
jako předtím. Odchod ponechá obrazovku A a zahodí obrazovku B; pokud obrazovka B
obsahuje něco jiného, budete předem upozorněni.

Stejný způsob práce platí pro další dva mihotavé režimy:

- **MultiGigaScreen 8×4, 8×2 a 8×1** kladou obě obrazovky na jemnější buňky
  Multicolor, takže čtyři barvy platí pro 4, 2 nebo jeden řádek místo pro blok
  8 × 8. Jsou to soubory `.mg4`, `.mg2` a `.mg1` programu MultiArtist.
- **Timex Hi-res GigaScreen** střídá dvě obrazovky vysokého rozlišení 512 × 192.
  Vysoké rozlišení nemá barvy buněk – každá obrazovka má jedno barevné schéma
  pro celý obrázek –, takže lišta ukazuje řadu schémat pro Obrazovku A a jednu
  pro Obrazovku B a Malovat ukazuje čtyři jejich směsi. Jsou to soubory `.hrg`.

Přepnutí mezi libovolnými dvouobrazovkovými režimy zachová obě obrazovky podle
stejných pravidel, podle kterých se převádí jediná obrazovka.

### Atributy

Položky Atributy v nabídce Obrázek mění barvy buněk a tečky nechávají na
místě. Invertovat prohodí inkoust a papír v každé buňce a zachová jas a
blikání. Vymazat zapíše aktuální inkoust, papír, jas a blikání do každé buňky;
zaškrtnutá pole „použít existující“ ponechají to, co buňka už má. Otočit
vodorovně a Otočit svisle zrcadlí barvy buněk. Každý příkaz působí na výběr
(všechny buňky, kterých se dotýká), nebo na celý obrázek, není-li nic vybráno,
a vrací se jedním krokem zpět. Položky jsou šedé v režimech bez barev buněk
(Timex Hi-res, Layer 2, LoRes), když plove razítko bez vlastních barev, a na zamčené vrstvě.

Změnit... najde buňky podle jejich barev a nahradí je. Hledat určuje, které buňky vybrat: každé pole je hodnota, nebo Libovolné. Nahradit za určuje, čím se stanou: každé pole je hodnota, nebo Ponechat. Dialog ukáže, kolik buněk se změní, dříve než stisknete OK, a OK se vrátí jedním krokem zpět. Na GigaScreenu jsou skupiny Obrazovka A a Obrazovka B; v ULAplus nahrazuje CLUT 0-3 volby Jas a Blikání. Zrušit nic nemění.

### Tečky

Položky Tečky v nabídce Obrázek mění tečky a barvy nechávají v jejich buňkách. Otočit vodorovně a Otočit svisle zrcadlí tečky. Invertovat tečky a barvy navíc prohodí inkoust a papír v každé buňce, takže obrázek vypadá stejně. Nenabízí se v režimech bez barev buněk (Layer 2, LoRes, Timex Hi-res) a když plove razítko, je šedá. V ULAplus a ULANext se také nenabízí, protože by prohození inkoustu a papíru změnilo vzhled obrázku.

Volba Posun v sekci Posunout panelu Transformace určuje, co se pohybuje. Tečky a barvy (výchozí) posouvá celé buňky i s jejich papírem. Jen tečky posouvá tečky po pixelu nebo po buňce. Jen barvy posouvá barvy buněk po buňce. Ovladač má i úhlopříčné směry. Když plove razítko, je volba Posun šedá, protože posun přesouvá celé razítko.

Šipky se řídí stejnou volbou Posun, když je něco vybráno.

### Razítka

Když je razítko zapojené, panel **Transformace** ukazuje, jak se pokládá.

**Barvy** volí mezi Jen body a Vlastní barvy. Jen body klade body razítka v barvách z lišty atributů, jako vždy. Vlastní barvy klade barvy, které razítko nese, buňku po buňce: razítko z Editoru map nebo razítko zkopírované z obrázku v režimu s barvami buněk. Razítko zkopírované z obrázku začíná jako Jen body, takže se vloží přesně jako dřív. Vlastní barvy razítko usadí na celé buňky, ignorují režim kreslení, lištu barev i přepínač XOR a razítko nelze zmenšit, otáčet, ohnout, převrátit, invertovat ani obrysovat; panel to zašedí a řekne proč. Změna tvaru razítka Jen body zahodí barvy, které nese. Inverze stále prohodí, co dělají plné a prázdné body. Pokud mají buňky razítka jinou velikost než současný režim obrazovky, je možné jen Jen body.

**Prosvítání** (jen Vlastní barvy) nechá místo barvy razítka prosvítat barvu, která už na stránce je. Inkoust, Papír, Jas a Blikání mají každý své políčko. ULAplus má jedno políčko CLUT pro Jas a Blikání dohromady. V GigaScreen každé políčko platí pro obě obrazovky.

**Prázdné body** rozhodují, co dělají prázdné body razítka. Ponechat pozadí nechá obraz pod nimi být (razítko s vlastními barvami pod nimi stále přebarví papír, pokud neprosvítá Papír). Smazat pozadí ho také smaže, na celém obdélníku razítka. Režimy kreslení bez opaku (XOR, Přebarvení inkoustu, Přebarvení papíru) a vlastní přepínač XOR razítka nechají prázdné body být a panel to oznámí. Prázdné body jsou dostupné v každém režimu obrazovky, i bez barev buněk.

**Převést na jen body** natrvalo zahodí barvy razítka a ponechá jeho body. Volba Jen body v Barvách je zachová, takže se lze vrátit. Každá změna je jeden krok zpět.

Dokud je zapojené razítko s vlastními barvami, příkazy Obrázek > Atributy (Invertovat, Vymazat, obě Otočení a Změnit...) působí na buňky razítka, ne na obrázek, ať plove, nebo je odložené. Ignorují výběr a nikdy se nedotknou teček razítka a buňka, kterou razítko nepokrývá, zůstane beze změny. Otočení zrcadlí barevné buňky razítka, zatímco jeho tečky zůstanou na místě. Razítko na GigaScreenu má jednu sadu barev pro obě obrazovky, takže dialog Změnit ukazuje jedinou skupinu. Každý příkaz je jeden krok zpět. U razítka bez vlastních barev zůstanou šedé.
