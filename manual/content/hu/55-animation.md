## Animáció

A PixULA kétféleképpen animál. A **képernyőanimáció** képkockáról képkockára az
egész képet változtatja. A **sprite-animáció** a kép egy blokkját változtatja,
egy sétáló alakot vagy egy lobogó zászlót, miközben a kép többi része mögötte
áll. Mindkettő betartja a képernyőmód minden szabályát: egy képkocka egész
attribútumcellákból áll, így sosem vágja ketté egy cella attribútumait.

### Animáció indítása

![Az Animáció menü](img/menu-animation.png)

![Az Új sprite-animáció párbeszédablak](img/dialog-new-sprite.png)

Az **Animáció > Új képernyőanimáció** a képet az 1. képkockává teszi. Minden
réteg animált lesz: minden képkockában saját tartalma van.

Az **Animáció > Új sprite-animáció...** nevet, szélességet és magasságot,
helyet és a kezdő képkockák számát kéri. A méret felfelé kerekedik a mód egész
celláira, és a párbeszéd megmondja, mi lett belőle: 8x1 módban a 20 x 20-ból
24 x 20 lesz. A Kijelölés használata egy kijelölés méretét és helyét veszi át.
Ha kattintással akarod elhelyezni a sprite-ot, előbb jelöld ki a blokkot a
Kijelölés eszközzel (Méret: Egyéni). Az **Új sprite-animáció a kijelölésből**
a kijelölt blokkot is átviszi a sprite saját rétegére 1. képkockaként. Egy
pontozott vonal közvetlenül az ablaka körül mutatja, hol van.

Egy képnek több animációja is lehet; az Animáció panel tetején lévő választó
dönti el, melyik nyitott. A képernyőmód nem változhat, amíg a képnek animációi
vannak.

### Képkockák

![Az Animáció panel egy pattogó labda hat képkockájával](img/animation-panel.png)

Az Animáció panel minden képkockát kis képként mutat, a számával és a
késleltetésével. Kattints egyre, hogy odamenj, vagy nyomd meg a `,` és a `.`
billentyűt az előző és a következő képkockához. A látható képkockára minden
eszközzel ugyanúgy rajzolsz, mint egy állóképre: az attribútumütközés, a
rajzolási módok, a Tükör, a bélyegzők, a Flash és a Visszavonás a szokásos
módon működik.

A Hozzáadás üres képkockát tesz a látható után, a Másolat pedig annak egy
másolatát; a Törlés, a Balra és a Jobbra törli és mozgatja. A késleltetés az az
idő, amíg a képkocka a képernyőn marad, 1/50 s-os Spectrum-képkockákban, a
Mindre pedig minden képkockának ezt a késleltetést adja. Ha egy képkocka egy
részét át akarod vinni a következőbe, másold le (az **Animáció > Képkockából
bélyegző** egy sprite ablakát másolja), menj a következő képkockára, és tedd le
a bélyegzőt. Egy másik képkockán tett lépés visszavonása visszavisz arra a
képkockára.

Az **Animáció > Bélyegzőkből képkockák** a Bélyegzők lista minden
bélyegzőjéből új képkockát készít, oda téve, ahol a bélyegző áll; a
bélyegzők megmaradnak.

### Rétegek egy animációban

![A Rétegek panel egy animált és egy közös réteggel, valamint a hagymahéj két előnézeti rétegével](img/animation-layers.png)

Amíg egy animáció nyitva van, a Rétegek panel minden sorában van egy Animált /
Közös kapcsoló. Az animált rétegnek minden képkockában saját tartalma van; a
közös minden képkockában ugyanúgy néz ki, mint egy egyszer megrajzolt háttér.
Az Animált minden képkockába átmásolja a réteget; a Közös a látható képkockát
tartja meg, előtte rákérdez. Az új rétegek a nyitott animációhoz tartoznak, és
a Lefelé egyesítés, a Kijelöltek egyesítése és a Kép összevonása minden
képkockára hat.

### Lejátszás

A Lejátszás (Enter) a képen játssza le a nyitott animációt; egy sprite a
háttere fölött mozog, a FLASH és a GigaScreen villogása pedig tovább fut. Az
Első, az Előző, a Következő és az Utolsó végiglépked a képkockákon (az Előzőt
vagy a Következőt nyomva tartva tovább lép), a Leállítás pedig visszatér arra a
képkockára, ahonnan a lejátszás indult. Egy kattintás a képre vagy az Escape
szünetet tart. Az Ismétlés körbe, egyszer vagy oda-vissza játssza le a
képkockákat. A Sebesség gyorsabban vagy lassabban játszik a késleltetések
megváltoztatása nélkül, a Lejátszott képkockák pedig csak az animáció egy
részét játssza le.

### Képkockák átrajzolása

Egy képkocka alatt az **Átrajzol** halványan mutatja azt a képkockát, amíg a
többit rajzolod, előnézeti rétegként a Rétegek panelen. A **Hagymahéj**
kapcsoló ugyanígy mutatja az előző és a következő képkockát, és ezek követnek,
amikor képkockát váltasz. A **Réteg > Új előnézeti réteg** ezek egyikét külön
adja hozzá.

Az előnézeti réteg a rétegrendszer szabályát követi: papírpixelei és üres
cellái átlátszók, a fölötte lévő rétegek tintája eltakarja, és halványan
látszik azon, ami alatta van. Mozgasd fel vagy le, hogy a rajzolt réteg fölé
vagy alá kerüljön. Mindegyiknek saját átlátszósága, színezése (korábbi
képkockák piros, későbbiek kék) és megjelenítése vagy elrejtése van, a törlése
pedig csak az előnézetet veszi el. Az előnézet sosem része a képnek: sosem
rajzolnak rá, nem egyesül és nem exportálódik, lejátszás közben pedig rejtve
van.

### Exportálás

**Animáció > Animáció exportálása**:

- A **Számozott képernyők...** minden képkockát saját Spectrum-képernyőként
  ment, sorrendben számozva (`walk_001.scr`, `walk_002.scr` és így tovább),
  bármilyen képernyőformátumban, amelyet a mód menteni tud. Minden fájl
  pontosan az, amit a Kép mentése másként arra a képkockára ír. Te választod a
  nevet, az első számot, a számjegyeket és a képkockákat. Ha a böngésző tud
  mappába írni, választasz egyet; különben a képernyők egyetlen `.zip`-ben
  érkeznek.
- Az **Animált GIF** a késleltetéseikkel játssza le a képkockákat, a FLASH-t és
  a GigaScreent is.
- A **PNG sprite-lap** egymás mellé teszi a képkockákat, soronként 16-ot.
- A **SevenuP, minden képkocka** legfeljebb 32 képkockát ír egy `.sev`-be
  (szabványos mód). Egy több képkockás `.sev` megnyitása sprite-animációt
  készít belőlük.
- A **Kazetta** képkockánként egy SCREEN$-t ír egy `.tap`-ba vagy `.tzx`-be. A
  képernyőket tartalmazza, nem egy programot, amely lejátssza őket.
- A **Next sprite-ok** egy 16 x 16-os sprite-animációt ír ki a Layer 2 és
  LoRes módokból `.spr` lapként.

Az animációk a PixULA-projektekbe, a helyreállító mentésbe és a biztonsági
mentésekbe kerülnek.
