## Nástroje

Lišta seskupuje nástroje podle toho, co s obrázkem dělají: nejprve vše, co
nanáší inkoust, pak výběr, pak vodítko, které výběr umožňuje, pak nástroje
umisťující hotovou grafiku a nakonec ty, které mění jen váš pohled.

Režim kreslení, zrcadlo a vodítko platí pro všechny tyto nástroje, proto se
nastavují jednou v horní liště režimů, místo aby se opakovaly v možnostech
každého nástroje.

![Panel možností nástroje s nastavením štětce](img/tool-options-brush.png)

*Možnosti vybraného nástroje se objeví v tomto panelu – zde štětce.*

Štětec nemá nad obrázkem zaměřovací kříž. Od velikosti 2 je ukazatelem obrys
plochy, kterou vybarví. Při velikosti 1 je ukazatelem malé plus široké tři
pixely a tečka uprostřed je pixel, který štětec vybarví, v barvě, kterou ho
vybarví: váš inkoust s použitým jasem, nebo vlastní inkoust buňky, když je
inkoust nastaven na „použít stávající barvu“. Během kreslení tečka ukazuje, co
jste právě namalovali. Nad šedou plochou kolem obrázku se vrátí běžný ukazatel.
Sprej, Slábnutí, Vzorek a Šrafování fungují stejně.

Mnoho voleb platí jen v kombinaci s jinou. Tabulky níže mají sloupec
**Zobrazeno, když** s podmínkou, za které se řádek objeví; řádky označené „vždy“
jsou tam bez ohledu na ostatní nastavení.

**Obrazce z bodů.** Seznam Tvar má skupinu Obrazce, které se kreslí umísťováním bodů: Lomená čára, Mnohoúhelník, Trojúhelník, Paprsky, Kolmá čára a Rovnoběžná čára (klávesa L vybere nástroj Obrazec). Kliknutím přidáte bod, stisknutím a tažením kreslíte od ruky. Dvojklik nebo Enter obrazec dokončí; zůstane na obrázku jako náhled, který lze ještě měnit, a další Enter jej nakreslí jedním krokem zpět. Backspace odebere poslední bod (celou čáru od ruky najednou), Esc obrazec zahodí bez kreslení a kliknutí jinam nebo volba jiného nástroje jej nakreslí. Trojúhelník, Kolmá čára a Rovnoběžná čára se dokončí samy u třetího bodu: natáhněte první čáru a klikněte na poslední bod. Kolmá čára přidá druhou čáru z paty kolmice z vašeho bodu na první čáru; Rovnoběžná čára přidá kopii první čáry s vaším bodem uprostřed. Paprsky spojí každý další bod s prvním. Mnohoúhelník a Trojúhelník lze vyplnit. Obrazce se řídí režimem kreslení, Inverzí, poli „použít existující“, zrcadlením a vodítkem kreslení jako každý tvar a v náhledu jsou přesně tak, jak se nakreslí.

**Styl čáry, Otočení a Zaoblení.** Nástroj Tvar, nástroj Obrazec a Bézierova křivka sdílejí Styl čáry: Plná, Čárkovaná, Tečkovaná, Čerchovaná, Čerchovaná se dvěma tečkami a Žádná. Čárkované styly se kreslí jen na jednopixelovou čáru, proto jsou nad tloušťkou 1 zašedlé; vzor běží po obrysu i kolem rohů a každý paprsek nebo čára obrazce začíná vlastní. Žádná nekreslí obrys, použijte ji s Vyplnit, abyste nakreslili jen vnitřek. Bézierova křivka Žádnou nemá. Otočení (-180 až 180 stupňů, po směru hodin) otáčí obdélník, čtverec, zaoblený obdélník, elipsu nebo rovnoběžník kolem středu jejich rámečku a otáčí oblouk, výseč, trojúhelník, kosočtverec nebo pravidelný mnohoúhelník kolem bodu, kde jste stiskli. Zaoblení určuje, jak jsou zaoblené rohy zaobleného obdélníku, od ostrých rohů při 0 po půlkruhové konce při 100. Bézierova křivka, kterou ještě upravujete, se nakreslí, když zvolíte jiný nástroj, a Esc ji zahodí. Náhled tvaru nebo křivky ukazuje zrcadlené kopie a drží se uvnitř vodítka kreslení, stejně jako hotová kresba.

**Úpravy, přesouvání, otáčení a klonování obrazce.** Hotový obrazec a Bézierova křivka zůstanou na obrázku jako náhled, dokud je nenakreslíte. Dokud čekají, můžete tahem za kterýkoli čtvercový bod změnit jejich tvar, tahem za obrazec jej přesunout, tahem za kulatý úchyt nad ním jej otočit a šipkami jej posouvat (o jeden pixel, se Shift nebo při přichytávání k mřížce o jednu buňku). Ctrl+Z vrátí poslední z těchto úprav, pak samotný obrazec a teprve potom obrázek. Enter, kliknutí jinam, uložení nebo volba jiného nástroje jej nakreslí jedním krokem zpět. Tvar z nástroje Tvar se obvykle nakreslí hned, jak pustíte tlačítko; zaškrtněte v jeho volbách **Ponechat upravitelné** a bude čekat jako obrazec, s úchytem na každém konci tahu. **Úpravy > Klonovat poslední obrazec** (Shift+C) otevře kopii posledního nakresleného obrazce, tvaru nebo křivky, připravenou k přesunu, otočení nebo změně; chcete-li změnit barvy nebo styl čáry už nakresleného, stiskněte Ctrl+Z a pak Klonovat poslední obrazec. Dokud obrazec čeká, řídí se barvami, stylem čáry a výplní, které zvolíte, stejně jako hotová kresba. Bézierova křivka je výjimka: tvar měníte jejími úchyty a posouváte ji šipkami, ale nelze ji celou přetáhnout ani otočit a Ctrl+Z zahodí celou křivku najednou. Bézierova křivka je výjimka: tvar měníte jejími úchyty a posouváte ji šipkami, ale nelze ji celou přetáhnout ani otočit a Ctrl+Z zahodí celou křivku najednou.

**Rozprašovač se vzorem.** Nastavte u rozprašovače Rozložení na **Vzor** a místo teček bude klást malé celé obrazce - kolečka, čtverečky nebo krátké čárky. Vyberte obrazec, jeho velikost a zda je plný, nebo jen obrys; Průtok určuje, kolik plochy se snaží pokrýt. Uvnitř oblasti se kladou jen celé obrazce, takže příliš malý rozprašovač nenakreslí nic.

**Přichytávání a jeho krok.** Přichytávání (tlačítko pod plátnem nebo Shift+S) způsobí, že výběry, tvary, body obrazců, text a vkládané kusy dosednou na mřížku; kreslení od ruky se nikdy nepřichytává. Seznam vedle tlačítka určuje mřížku: atributovou buňku režimu (8x8, nebo 8x4, 8x2 či 8x1 v multicolor režimech), 16x16, celou obrazovku 256x192 (jen na plátně větším než jedna obrazovka, např. Layer 2 320 a 640), nebo vlastní krok, jehož vodorovnou a svislou velikost nastavíte v Nastavení v části Kreslení. Volba kroku také zapne přichytávání. Vložený kus dosedne levým horním rohem na mřížku. Při zapnutém přichytávání šipky posouvají čekající obrazec, plovoucí kus nebo konec přechodu o jeden krok; výběr nesoucí své barvy se posouvá o krok zaokrouhlený na celé buňky. ZX Paintbrush posouvá klávesnicí po jednom bodu bez ohledu na rastr, takže se to záměrně liší.

{{tools}}
