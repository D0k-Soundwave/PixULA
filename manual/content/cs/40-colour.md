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

### Režimy kreslení

Režim kreslení mění, co tah udělá, a platí pro každý nástroj. Pamatuje se mezi
relacemi, takže ho stavový řádek zobrazuje, kdykoli je jiný než Normální – v
některých z těchto režimů tah nezanechá nic viditelného a jinak byste neměli jak
poznat proč.

{{draw-modes}}

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
