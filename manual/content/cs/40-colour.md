## Barva

V klasických režimech nevybíráte barvu pixelu. Vybíráte dvě barvy, které použije
celá buňka, a k nim dva příznaky.

- **INKOUST** je barva pixelů inkoustu.
- **PAPÍR** je barva pixelů papíru.
- **JASNÝ** zvedne obě barvy na jejich jasnější verzi. Příznak Jasu je jeden na
  buňku, takže Inkoust a Papír jsou jasné buď oba, nebo ani jeden.
- **BLIKÁNÍ** na skutečném hardwaru prohazuje Inkoust a Papír zhruba dvakrát za
  sekundu.

Levé tlačítko myši kreslí pixely inkoustu. Pravé kreslí pixely papíru a nastaví
stejné čtyři atributy, jaké by nastavilo levé. U pera dělá boční tlačítko totéž
co pravé tlačítko myši.

**Guma** dělá něco jiného než obojí. Mění pixely inkoustu na pixely papíru a
atributy buňky nechává být, i když smaže poslední pixel inkoustu v buňce.
Chcete-li smazat i atributy, přejeďte gumou přes prázdnou buňku znovu novým
tahem: Inkoust, Papír, Jas a Blikání se vrátí na
černou na bílé a na horní vrstvě bude buňka opět průhledná. Buňka, ve které jsou
ještě pixely inkoustu, si atributy ponechá, ať přes ni gumou přejedete kolikrát chcete.
Volba **Atributy** u gumy, zobrazená v režimech obrazovky s atributy buněk, to
mění: Nastavit na aktuální smaže pixely inkoustu a dá buňce atributy z barevné
lišty, jako stírací
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

**Přebarvit Inkoust není totéž co Přebarvit.** Přebarvit Inkoust a Přebarvit
Papír jsou režimy kreslení: přebarvují každou buňku, které se nástroj dotkne
- několik buněk u malého štětce, každou buňku, kterou pokrývá vyplněný obdélník
- a platí Zrcadlení. **Přebarvit** v tlačítku Nástroj buněk přebarvuje celou
buňku pod ukazatelem bez ohledu na zvolený nástroj, nehledě na velikost štětce. **Prohodit** ze stejného tlačítka funguje stejně a vymění Inkoust s
Papírem každé buňky. Obojí zůstává zapnuté, dokud je nevypnete - zvolte Žádný,
zvolte je znovu, klikněte pravým tlačítkem na plátno nebo vyberte nástroj či
režim kreslení - a stavový řádek to hlásí, dokud je zapnuté.

**Pouze atributy** je třetí z těchto režimů kreslení. Dá každé buňce, které se
nástroj dotkne, zvolený Inkoust, Papír, Jas a Blikání najednou a nekreslí žádný
pixel, jako ZX Paintbrush s vypnutým kreslením pixelů. Každá ze čtyř částí
nastavená na **použít stávající** zůstane v každé buňce, jak je: s Papírem na
stávajícím dělá totéž co Přebarvit Inkoust, s Inkoustem na stávajícím totéž co
Přebarvit Papír. Stejně jako u nich obě tlačítka dělají totéž a nabízí se jen v
režimech obrazovky, jejichž buňky mají atributy.

**Kopírovat atributy, Invertovat pixely a Invertovat pixely a atributy** jsou další tři
nástroje pro buňky ve stejném tlačítku Nástroj buněk a fungují stejně: vyberte
jeden a klikejte nebo táhněte přes buňky. Každé tažení se vrací jedním krokem a
nástroj zůstává zapnutý, dokud ho nevypnete. **Kopírovat atributy** převezme atributy,
které ukazuje buňka pod prvním kliknutím, a dá je každé buňce, přes kterou
táhnete; paleta barev se nemění. **Invertovat pixely** změní pixely inkoustu
každé celé buňky na pixely papíru a pixely papíru na inkoust, atributy ponechá
(prázdnou buňku vyplní). **Invertovat pixely a atributy** navíc prohodí Inkoust
s Papírem, takže každá buňka
vypadá stejně; slouží k úklidu importovaného obrázku, přeskakuje buňky, do nichž
kreslí i jiná vrstva, a v ULAplus a ULANext se nenabízí. Nástroj pro buňky se
nabízí jen v režimech obrazovky, kde může fungovat: tlačítko Nástroj buněk uvádí
jen ty, které platí (a je skryté tam, kde žádný neplatí), a Invertovat pixely
funguje i v Timex Hi-res, kde jsou pixely v buňkách 8 × 8. Se zapnutým Zrcadlením každý nástroj pro buňky, včetně Prohodit a Přebarvit, pracuje i na zrcadlovém obrazu každé buňky, které se dotkne: zrcadlová buňka dostane stejnou změnu svých vlastních pixelů a atributů.

**XOR / Přes a XOR / Každý přejezd** pixely přepínají, z inkoustu na papír a z
papíru na inkoust, místo aby kreslily pixely inkoustu, a oba dají buňce zvolené
atributy. XOR / Přes přepne každý pixel jednou za tah, takže
návrat po vlastní čáře ve stejném tahu už nic nezmění. XOR / Každý přejezd
přepne pixel pokaždé, když přes něj tah přejede: jeden tah štětce je jeden
přejezd, i když se štětec cestou sám překrývá, ale tah, který pixel opustí a vrátí
se k němu, ho přepne znovu, takže osmička se zruší tam, kde se kříží. Tvary,
křivky, výplně a text jsou vždy jediný přejezd, takže u nich oba režimy dávají
stejný výsledek.

**Inverze** prohodí, co dělají obě tlačítka myši: levé tlačítko kreslí pixely papíru a
pravé pixely inkoustu, jako INVERSE 1 v BASICu. Zapíná se v Předvolbách, nebo klávesou Shift+I, a stavový řádek hlásí „Inverze je zapnutá“, dokud trvá.
V režimech Přebarvit Inkoust, Přebarvit Papír, Pouze atributy a ve dvou
režimech XOR nic nemění,
protože obě tlačítka tam dělají totéž; stavový řádek to říká. Text a razítka
kreslí svá písmena a tvary pixely papíru místo pixelů inkoustu, vzorek klade
své pixely inkoustu jako pixely papíru a své pixely papíru jako inkoust, a výplň
vyplňuje levým tlačítkem pixely papíru a pravým pixely inkoustu. Guma, Prohodit a Přebarvit ji ignorují. Pamatuje se mezi relacemi a
ukládá se v předvolbách spolu s režimem kreslení.

**Atributové jádro.** U kulatého a čtvercového štětce, obrysů tvarů a Bézierovy
křivky říká Atributové jádro, jak velká část tlusté čáry přebírá atributy buněk.
Čára vždy nakreslí všechny pixely inkoustu. S Atributovým jádrem na 1 pixel nebo
4 pixely přebírají vaše atributy jen buňky pod středem čáry, čárou tak široké,
která sleduje její střed; ostatní buňky pod ní dostanou pixely inkoustu v
atributech, které už měly, takže tlustá čára koliduje s méně buňkami. Celá čára,
výchozí volba, dá vaše atributy každé buňce, které se čára dotkne. Volba se
zobrazuje jen v režimech obrazovky s atributy buněk. U Zrcadlení má zrcadlená
čára vlastní jádro a u XOR si buňky mimo jádro ponechají své atributy.

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

**Pozice palety.** Paleta ULAplus a paleta Next mají každá čtyři pozice v nabídce Obrázek > Paleta (Pozice 1 až Pozice 4). Použitá pozice je zaškrtnutá a editor palety říká, kterou pozici upravuje. Nový dokument začíná na Pozici 1 a ostatní pozice drží výchozí paletu, dokud je nepoužijete. Výběr jiné pozice změní barvy, kterými se obrázek zobrazuje, a nikdy nezmění atributy obrázku. Každá volba je jeden krok zpět. Pozice se ukládají do projektu a do automatické zálohy, ale až poté, co jste nějakou pozici použili; obrázek otevřený z jiného druhu souboru začíná na Pozici 1 a ostatní pozice drží kopie jeho palety. Exporty .scr, .tap a obrázků vždy používají použitou pozici. Režimy s pevnou paletou (Standard ULA, režimy Multicolor, GigaScreen a režimy Timex) pozice nemají.

**Invertovat paletu** (jen ULAplus) prohodí polovinu Inkoustu (položky 0-7) s polovinou Papíru (položky 8-15) každé ze čtyř CLUT v jednom kroku zpět; dvojí provedení paletu vrátí. Aby obrázek ULAplus vypadal po invertování stejně, použijte Invertovat paletu a potom Obrázek > Atributy > Invertovat. Okraj sleduje polovinu Papíru CLUT 0, takže změní barvu také. Režimy Next invertor palety nemají, protože ULANext drží Inkoust v 8 položkách palety a Papír ve 32.

**Klávesy CLUT.** V režimech ULAplus vybírají Ctrl+Shift+1 až Ctrl+Shift+4 CLUT 0 až 3, stejně jako volba CLUT na liště barev. V jiných režimech to stavový řádek oznámí a nic dalšího se nestane.

**Standardní barvy.** V Nastavení > Předvolby můžete v části Standardní barvy změnit 15 barev, které ukazují režimy Standard, Multicolor, GigaScreen a Timex. Jasná černá je vždy černá. Barvy mění, co vidíte a co obsahují exporty obrázků (PNG, GIF, BMP, JPG); nikdy nemění bajty souborů .scr ani .tap a import obrázku stále porovnává s původními barvami Spectra, takže stejná fotografie dá na každém stroji stejný obrázek. Palety ULAplus a Next jsou oddělené. OK barvy použije, Zrušit nic nezachová a Vrátit standardní vrátí původní. Ukládají se v tomto prohlížeči, ne v projektu. Načíst .pal čte soubor standardních barev ZX Paintbrush (256 bajtů) a Uložit .pal jej zapíše, což je způsob, jak barvy přenést do jiného prohlížeče.

**Pásky s paletou.** Soubor > Uložit paletu jako TAP zapíše paletu ULAplus jako 176bajtovou pásku. Načtena na Spectru příkazem `LOAD ""` nastaví 64 položek palety a pak načte další soubor na pásce, takže páska s paletou může být před páskou s obrázkem nebo hrou. Soubor > Načíst paletu a Soubor > Otevřít čtou pásky s paletou: vlastní PixULA i ZX Paintbrush. Páska s paletou jde do použité pozice palety jedním krokem zpět a nestane se otevřeným souborem.

### GigaScreen

GigaScreen uchovává dvě úplné obrazovky a zobrazuje je střídavě, padesátkrát za
sekundu. Oko smíchá dvě barvy každého pixelu v jednu, takže buňka s jedním
Inkoustem a jedním Papírem na každé obrazovce může zobrazit **čtyři** barvy a
celý obrázek jich dosáhne kolem sta.

Nikdy nekreslíte jen na jednu obrazovku. Každý tah zapisuje do obou a barevná
lišta pracuje v párech:

- **Obrazovka A** a **Obrazovka B** mají každá vlastní vzorky Inkoustu a Papíru
  a vlastní **JASNÝ**. Blikání je jedno společné nastavení.
- **Malovat** ukazuje čtyři barvy, které z těchto voleb vzniknou, smíchané
  přesně tak, jak je ukazuje plátno: Inkoust na obou obrazovkách, Inkoust jen na
  A, Inkoust jen na B a Papír na obou. Vyberte jednu a levé tlačítko jí maluje.
  Pravé tlačítko vždy maluje Papír na obou obrazovkách.
- Zvolte pro obě obrazovky stejný Inkoust a levý horní vzorek v Malovat bude
  touto barvou, nesmíchanou – tak se kreslí vše, co nemá vypadat smíchaně.

Kapátko to vše zase převezme: atributy obou obrazovek a to, kterou ze čtyř pixel
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
  Vysoké rozlišení nemá atributy buněk – každá obrazovka má jedno barevné schéma
  pro celý obrázek –, takže lišta ukazuje řadu schémat pro Obrazovku A a jednu
  pro Obrazovku B a Malovat ukazuje čtyři jejich směsi. Jsou to soubory `.hrg`.

Přepnutí mezi libovolnými dvouobrazovkovými režimy zachová obě obrazovky podle
stejných pravidel, podle kterých se převádí jediná obrazovka.

### Atributy

Položky Atributy v nabídce Obrázek mění atributy buněk a pixely nechávají na
místě. Invertovat prohodí Inkoust a Papír v každé buňce a zachová Jas a
Blikání. Vymazat zapíše aktuální Inkoust, Papír, Jas a Blikání do každé buňky;
zaškrtnutá pole „použít existující“ ponechají to, co buňka už má. Otočit
vodorovně a Otočit svisle zrcadlí atributy buněk. Každý příkaz působí na výběr
(všechny buňky, kterých se dotýká), nebo na celý obrázek, není-li nic vybráno,
a vrací se jedním krokem zpět. Položky jsou šedé v režimech bez atributů buněk
(Timex Hi-res, Layer 2, LoRes), když plove razítko bez vlastních atributů, a na zamčené vrstvě.

Změnit... najde buňky podle jejich atributů a nahradí je. Hledat určuje, které buňky vybrat: každé pole je hodnota, nebo Libovolné. Nahradit za určuje, čím se stanou: každé pole je hodnota, nebo Ponechat. Dialog ukáže, kolik buněk se změní, dříve než stisknete OK, a OK se vrátí jedním krokem zpět. Na GigaScreenu jsou skupiny Obrazovka A a Obrazovka B; v ULAplus nahrazuje CLUT 0-3 volby Jas a Blikání. Zrušit nic nemění.

### Pixely

Položky Pixely v nabídce Obrázek mění pixely a atributy nechávají v jejich buňkách. Otočit vodorovně a Otočit svisle zrcadlí pixely. Invertovat pixely a atributy invertuje pixely a navíc prohodí Inkoust a Papír v každé buňce, takže obrázek vypadá stejně. Nenabízí se v režimech bez atributů buněk (Layer 2, LoRes, Timex Hi-res) a když plove razítko, je šedá. V ULAplus a ULANext se také nenabízí, protože by prohození Inkoustu a Papíru změnilo vzhled obrázku.

Volba Posun v sekci Posunout panelu Transformace určuje, co se pohybuje. Pixely a atributy (výchozí) posouvá celé buňky i s jejich Papírem. Jen pixely posouvá pixely po pixelu nebo po buňce. Jen atributy posouvá atributy buněk po buňce. Ovladač má i úhlopříčné směry. Když plove razítko, je volba Posun šedá, protože posun přesouvá celé razítko.

Šipky se řídí stejnou volbou Posun, když je něco vybráno.

### Razítka

Když je razítko zapojené, panel **Transformace** ukazuje, jak se pokládá.

**Atributy** volí mezi Jen pixely a Vlastní atributy. Jen pixely klade pixely razítka v atributech z lišty atributů, jako vždy. Vlastní atributy klade atributy, které razítko nese, buňku po buňce: razítko z Editoru map nebo razítko zkopírované z obrázku v režimu s atributy buněk. Razítko zkopírované z obrázku začíná jako Jen pixely, takže se vloží přesně jako dřív. Vlastní atributy razítko usadí na celé buňky, ignorují režim kreslení, lištu barev i přepínač XOR a razítko nelze zmenšit, otáčet, ohnout, převrátit, invertovat ani obrysovat; panel to zašedí a řekne proč. Změna tvaru razítka Jen pixely zahodí atributy, které nese. Inverze stále prohodí, co dělají pixely inkoustu a pixely papíru. Pokud mají buňky razítka jinou velikost než současný režim obrazovky, je možné jen Jen pixely.

**Prosvítání** (jen Vlastní atributy) nechá místo atributu razítka prosvítat atribut, který už na stránce je. Inkoust, Papír, Jas a Blikání mají každý své políčko. ULAplus má jedno políčko CLUT pro Jas a Blikání dohromady. V GigaScreen každé políčko platí pro obě obrazovky.

**Pixely papíru** rozhodují, co dělají pixely papíru razítka. Ponechat pozadí nechá obraz pod nimi být (razítko s vlastními atributy pod nimi stále přebarví Papír, pokud neprosvítá Papír). Smazat pozadí z obrazu pod nimi také udělá pixely papíru, na celém obdélníku razítka. Režimy kreslení bez opaku (XOR, Přebarvit Inkoust, Přebarvit Papír) a vlastní přepínač XOR razítka nechají pixely papíru být a panel to oznámí. Pixely papíru jsou dostupné v každém režimu obrazovky, i v těch bez atributů buněk.

**Převést na jen pixely** natrvalo zahodí atributy razítka a ponechá jeho pixely. Volba Jen pixely v Atributech je zachová, takže se lze vrátit. Každá změna je jeden krok zpět.

Dokud je zapojené razítko s vlastními atributy, příkazy Obrázek > Atributy (Invertovat, Vymazat, obě Otočení a Změnit...) působí na buňky razítka, ne na obrázek, ať plove, nebo je odložené. Ignorují výběr a nikdy se nedotknou pixelů razítka a buňka, kterou razítko nepokrývá, zůstane beze změny. Otočení zrcadlí atributové buňky razítka, zatímco jeho pixely zůstanou na místě. Razítko na GigaScreenu má jednu sadu atributů pro obě obrazovky, takže dialog Změnit ukazuje jedinou skupinu. Každý příkaz je jeden krok zpět. U razítka bez vlastních atributů zůstanou šedé.
