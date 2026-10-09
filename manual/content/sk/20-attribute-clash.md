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

### Vidieť body

Tri prepínače v ponuke Zobraziť menía to, čo obrazovka ukazuje, bez zmeny
obrázka. **Farby vypnuté** zobrazí body čiernou na bielom, takže vidíte, ktoré
body sú naozaj nastavené. **Farebná mriežka** urobí to isté a navyše zafarbí
bunky ako šachovnicu, takže sú hranice buniek dobre vidieť; ona a Farby vypnuté
sa navzájom vypínajú. **Zastaviť blikanie** nechá každú blikajúcu bunku v jej
normálnych farbách. Žiadny z nich sa nedotýka obrázka, kroku späť ani exportu:
uložený obrázok vyzerá rovnako, či sú zapnuté, alebo nie. Prehliadač si ich
pamätá a prepínač, ktorý v aktuálnom režime obrazovky nemôže fungovať, je sivý –
po prejdení myšou uvidíte prečo. V GigaScreen a MultiGiga ukazuje Farby vypnuté
štyri úrovne sivej: bielu tam, kde nemá bod žiadna obrazovka, svetlosivú pre bod
len na obrazovke A, tmavšiu sivú len pre obrazovku B a čierňu pre obe.

### Údaje o ukazovateli

Pás pod obrázkom a stavový riadok hovoria, kde je ukazovateľ. V **Nastaveniach**
voľba *Údaje o ukazovateli zobrazujú* pridá atribút pod ukazovateľom (jeho číslo
desiatkovo aj šestnástkovo, potom atrament, papier, jas a blikanie; v ULAplus
CLUT; v GigaScreen obe obrazovky) a pamäťovú adresu bajtu pixelu a jeho
atribútového bajtu. Adresy existujú tam, kde má skutočný stroj pevné rozloženie:
Standard ULA a ULAplus (zobrazovací súbor od $4000, atribúty od $5800), Timex
hi-colour (atribúty v druhom zobrazovacom súbore na $6000), Timex hi-res (párne
bajtové stĺpce na $4000, nepárne na $6000) a GigaScreen (obrazovka A ako
štandardná, obrazovka B v banke 7 na $C000; priradenie obrazoviek bankám je
konvencia). Ostatné režimy hlásia, že adresu nemajú.

*Y sa počíta od* možno nastaviť na spodok, takže údaj číta ako BASIC PLOT, kde
0,0 je ľavý dolný roh a Y ide od 0 do 175. To existuje len na horných 176
riadkoch obrázka 256 na 192; pod nimi a na iných obrazovkách sa zobrazí pomlčka.
Mení sa len údaj.

**Vlastná mriežka...** v ponuke Zobraziť nakreslí mriežku s ľubovoľným krokom X
a Y, nastavovaným osobitne, a **Zobraziť vlastnú mriežku** ju zapína a vypína.
Čiary bližšie než štyri pixely na obrazovke sa vynechajú, kým nepriblížite.
Zapnuté mriežky sa pri ďalšom spustení vrátia. V Nastaveniach *Farby mriežok*
určujú farbu každej mriežky; ak necháte zaškrtnuté *Farba motívu*, mriežka
sleduje motív.

### Kde platia iné pravidlá

Neskorší hardvér obmedzenie rôzne uvoľnil a PixULA vie pracovať so všetkými
variantmi. Stroje Timex zjemnili mriežku farieb. ULAplus nahradil šestnásť
pevných farieb paletou podľa vlastnej voľby. GigaScreen strieda dva obrázky tak
rýchlo, že vznikajú farby, ktoré žiadny z nich neobsahuje. ZX Spectrum Next vo
svojich režimoch Layer 2 a LoRes tento systém úplne opúšťa: tam má každý pixel
vlastnú farbu.

Obrázok môžete medzi nimi prevádzať – pozrite ďalšiu kapitolu.
