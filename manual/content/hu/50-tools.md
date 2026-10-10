## Az eszközök

A sáv aszerint csoportosítja az eszközöket, mit tesznek a képpel: először minden,
ami tintát tesz le, aztán a kijelölés, aztán a vezető, amelyet a kijelölés
lehetővé tesz, aztán a kész grafikát elhelyező eszközök, végül azok, amelyek
csak a nézetet változtatják.

A rajzolási mód, a tükrözés és a vezető minden itteni eszközre érvényes, ezért
egyszer kell beállítani őket a módsávon, nem minden eszköz beállításai között.

![Az Eszközbeállítások panel az ecset beállításaival](img/tool-options-brush.png)

*A kiválasztott eszköz beállításai ebben a panelben jelennek meg – itt az
ecseté.*

Az ecsetnek nincs célkeresztje a kép fölött. 2-es mérettől az a körvonal a
mutató, amelyet be fog festeni. 1-es méretnél a mutató egy három pixel széles
kis plusz jel, és a közepén lévő pont az a pixel, amelyet az ecset befest,
abban a színben, amelyben befesti: a tintád alkalmazott FÉNYESSÉGGEL, vagy a
cella saját tintája, ha a tinta „meglévő szín használata” értékre van állítva.
Rajzolás közben a pont azt mutatja, amit épp megfestettél. A kép körüli szürke
terület fölött visszatér a normál mutató. A Spray, az Elhalványulás, a Minta és
a Vonalkázás ugyanígy működik.

Sok beállítás csak egy másikkal együtt érvényes. Az alábbi táblázatokban van egy
**Mikor látható** oszlop, amely megadja, milyen feltétellel jelenik meg a sor; a
„mindig” jelölésű sorok minden egyéb beállítástól függetlenül ott vannak.

**Pontokból álló alakzatok.** Az Alakzat lista tartalmaz egy Alakzatok csoportot, amelyeket pontok lerakásával rajzolsz: Töröttvonal, Sokszög, Háromszög, Sugarak, Merőleges vonal és Párhuzamos vonal (az L billentyű választja az Alakzat eszközt). Kattintással pontot adsz hozzá, nyomva húzással szabadkézi vonalat rajzolsz. A dupla kattintás vagy az Enter befejezi az alakzatot, amely még módosítható előnézetként marad a képen; még egy Enter megrajzolja, egy visszavonási lépésben. A Backspace törli az utolsó pontot (a szabadkézi vonalat egészében), az Esc elveti az alakzatot rajzolás nélkül, a máshová kattintás vagy másik eszköz választása pedig megrajzolja. A Háromszög, a Merőleges vonal és a Párhuzamos vonal a harmadik pontnál magától befejeződik: húzd ki az első vonalat, majd kattints az utolsó pontra. A Merőleges vonal második vonalat ad a pontodból az első vonalra állított merőleges talppontjától; a Párhuzamos vonal az első vonal másolatát adja, a pontoddal a közepén. A Sugarak minden további pontot az elsőhöz köt. A Sokszög és a Háromszög kitölthető. Az alakzatok mint minden forma követik a rajzmódot, az Inverzet, a „meglévő használata” négyzeteket, a tükrözést és a rajzvezetőt, és az előnézet pontosan olyan, ahogy megrajzolódnak.

**Vonalstílus, Forgatás és Lekerekítés.** Az Alakzat eszköz, az Alakzatok eszköz és a Bézier-görbe közös Vonalstílust használ: Folytonos, Szaggatott, Pontozott, Szaggatott-pontozott, Szaggatott-pont-pont és Nincs. A szaggatott stílusok csak egy képpont vastag vonalon rajzolódnak, ezért 1-nél vastagabbnál szürkék; a minta a körvonal mentén fut, a sarkokon át is, és egy alakzat minden sugara vagy vonala a sajátját kezdi. A Nincs nem rajzol körvonalat, a Kitöltöttel együtt használd, hogy csak a belső készüljön el. A Bézier-görbének nincs Nincs. A Forgatás (-180 és 180 fok között, óramutató járásával megegyezően) a téglalapot, négyzetet, lekerekített téglalapot, ellipszist és paralelogrammát a keretük közepe körül forgatja, az ívet, körcikket, háromszöget, rombuszt és szabályos sokszöget pedig a megnyomott pont körül. A Lekerekítés a lekerekített téglalap sarkainak kerekségét adja, 0-nál éles sarok, 100-nál félkör végek. A még szerkesztett Bézier-görbe másik eszköz választásakor megrajzolódik, az Esc elveti. Az alakzat vagy görbe előnézete mutatja a tükrözött másolatokat és a rajzvezetőn belül marad, mint a kész rajz.

**Alakzat szerkesztése, mozgatása, forgatása és másolása.** A kész Alakzat és a Bézier-görbe előnézetként a képen marad, amíg meg nem rajzolod. Amíg várakoznak, bármelyik négyzet alakú pontjukat húzva átformálhatod, magát az alakzatot húzva mozgathatod, a fölötte levő kerek gombot húzva forgathatod, a nyílbillentyűkkel pedig eltolhatod (egy képponttal, Shifttel vagy rácshoz igazításkor egy cellával). A Ctrl+Z az utolsó ilyen módosítást vonja vissza, aztán magát az alakzatot, és csak utána a képet. Az Enter, máshová kattintás, mentés vagy másik eszköz választása egy visszavonási lépésben megrajzolja. Az Alakzat eszköz formája általában a felengedéskor megrajzolódik; jelöld be a beállításaiban a **Maradjon szerkeszthető** négyzetet, és úgy vár, mint egy alakzat, a húzás mindkét végén fogóval. A **Szerkesztés > Utolsó alakzat másolása** (Shift+C) megnyit egy másolatot az utoljára rajzolt alakzatról, formáról vagy görbéről, mozgatásra, forgatásra vagy módosításra készen; egy már megrajzolt színeinek vagy vonalstílusának módosításához nyomj Ctrl+Z-t, majd Utolsó alakzat másolása parancsot. Amíg az alakzat vár, a kiválasztott színeket, vonalstílust és kitöltést követi, mint a kész rajz.

**Mintás permet.** Állítsd a Permet eloszlását **Minta**-ra, és pontok helyett apró, egész alakzatokat - köröket, négyzeteket vagy rövid vonalakat - rak le. Válaszd ki az alakzatot, a méretét, és hogy kitöltött vagy csak körvonal; az Áramlás azt adja meg, a terület mekkora részét igyekeznek lefedni. A permetezett területen belül csak egész alakzatok kerülnek le, így egy olyan kicsi permet, amelybe nem fér egy alakzat, semmit sem rajzol.

{{tools}}
