## Nástroje

Lišta zoskupuje nástroje podľa toho, čo s obrázkom robia: najprv všetko, čo
nanáša atrament, potom výber, potom vodidlo, ktoré výber umožňuje, potom
nástroje umiestňujúce hotovú grafiku a nakoniec tie, ktoré menia len váš
pohľad.

Režim kreslenia, zrkadlo a vodidlo platia pre všetky tieto nástroje, preto sa
nastavujú raz v hornej lište režimov, namiesto aby sa opakovali v možnostiach
každého nástroja.

![Panel možností nástroja s nastavením štetca](img/tool-options-brush.png)

*Možnosti vybraného nástroja sa objavia v tomto paneli – tu štetca.*

Štetec nemá nad obrázkom zameriavací kríž. Od veľkosti 2 je ukazovateľom obrys
plochy, ktorú vyfarbí. Pri veľkosti 1 je ukazovateľom malé plus široké tri
pixely a bodka v strede je pixel, ktorý štetec vyfarbí, vo farbe, ktorou ho
vyfarbí: váš atrament s použitým jasom, alebo vlastný atrament bunky, keď je
atrament nastavený na „použiť existujúcu farbu“. Počas kreslenia bodka ukazuje,
čo ste práve namaľovali. Nad sivou plochou okolo obrázka sa vráti bežný
ukazovateľ. Sprej, Slabnutie, Vzorka a Šrafovanie fungujú rovnako.

Mnoho volieb platí len v kombinácii s inou. Tabuľky nižšie majú stĺpec
**Zobrazené, keď** s podmienkou, za ktorej sa riadok objaví; riadky označené
„vždy“ sú tam bez ohľadu na ostatné nastavenia.

**Obrazce z bodov.** Zoznam Tvar má skupinu Obrazce, ktoré sa kreslia umiestňovaním bodov: Lomená čiara, Mnohouholník, Trojuholník, Lúče, Kolmá čiara a Rovnobežná čiara (kláves L vyberie nástroj Obrazec). Kliknutím pridáte bod, stlačením a ťahaním kreslíte od ruky. Dvojklik alebo Enter obrazec dokončí; zostane na obrázku ako náhľad, ktorý možno ešte meniť, a ďalší Enter ho nakreslí jedným krokom späť. Backspace odoberie posledný bod (celú čiaru od ruky naraz), Esc obrazec zahodí bez kreslenia a kliknutie inde alebo voľba iného nástroja ho nakreslí. Trojuholník, Kolmá čiara a Rovnobežná čiara sa dokončia samy pri treťom bode: ťahajte prvú čiaru a kliknite na posledný bod. Kolmá čiara pridá druhú čiaru z päty kolmice z vášho bodu na prvú čiaru; Rovnobežná čiara pridá kópiu prvej čiary s vaším bodom v strede. Lúče spoja každý ďalší bod s prvým. Mnohouholník a Trojuholník možno vyplniť. Obrazce sa riadia režimom kreslenia, Inverziou, poľami „použiť existujúce“, zrkadlením a vodidlom kreslenia ako každý tvar a náhľad je presne taký, ako sa nakreslia.

**Štýl čiary, Otočenie a Zaoblenie.** Nástroj Tvar, nástroj Obrazec a Bézierova krivka zdieľajú Štýl čiary: Plná, Čiarkovaná, Bodkovaná, Čiarkovaná s bodkou, Čiarkovaná s dvoma bodkami a Žiadna. Čiarkované štýly sa kreslia len na jednopixelovú čiaru, preto sú nad hrúbkou 1 zašednuté; vzor beží pozdĺž obrysu aj okolo rohov a každý lúč alebo čiara obrazca začína vlastný. Žiadna nekreslí obrys, použite ju s Vyplniť, aby ste nakreslili len vnútro. Bézierova krivka Žiadnu nemá. Otočenie (od -180 do 180 stupňov, v smere hodinových ručičiek) otáča obdĺžnik, štvorec, zaoblený obdĺžnik, elipsu alebo rovnobežník okolo stredu ich rámika a otáča oblúk, výseč, trojuholník, kosoštvorec alebo pravidelný mnohouholník okolo bodu, kde ste stlačili. Zaoblenie určuje, aké okrúhle sú rohy zaobleného obdĺžnika, od ostrých rohov pri 0 po polkruhové konce pri 100. Bézierova krivka, ktorú ešte upravujete, sa nakreslí, keď zvolíte iný nástroj, a Esc ju zahodí. Náhľad tvaru alebo krivky ukazuje zrkadlené kópie a drží sa vnútri vodidla kreslenia, rovnako ako hotová kresba.

**Úpravy, presúvanie, otáčanie a klonovanie obrazca.** Hotový obrazec a Bézierova krivka zostanú na obrázku ako náhľad, kým ich nenakreslíte. Kým čakajú, môžete ťahom za ktorýkoľvek štvorcový bod zmeniť ich tvar, ťahom za obrazec ho presunúť, ťahom za okrúhly úchyt nad ním ho otočiť a šípkami ho posúvať (o jeden pixel, so Shift alebo pri prichytávaní k mriežke o jednu bunku). Ctrl+Z vráti poslednú z týchto úprav, potom samotný obrazec a až potom obrázok. Enter, kliknutie inde, uloženie alebo voľba iného nástroja ho nakreslí jedným krokom späť. Tvar z nástroja Tvar sa zvyčajne nakreslí hneď po pustení tlačidla; zaškrtnite v jeho voľbách **Ponechať upraviteľné** a bude čakať ako obrazec, s úchytom na každom konci ťahu. **Úpravy > Klonovať posledný obrazec** (Shift+C) otvorí kópiu posledného nakresleného obrazca, tvaru alebo krivky, pripravenú na presun, otočenie alebo zmenu; ak chcete zmeniť farby alebo štýl čiary už nakresleného, stlačte Ctrl+Z a potom Klonovať posledný obrazec. Kým obrazec čaká, riadi sa farbami, štýlom čiary a výplňou, ktoré zvolíte, rovnako ako hotová kresba. Bézierova krivka je výnimka: tvar meníte jej úchytmi a posúvate ju šípkami, ale nemožno ju celú pretiahnuť ani otočiť a Ctrl+Z zahodí celú krivku naraz.

**Sprej so vzorom.** Nastavte pri spreji Rozloženie na **Vzor** a namiesto bodiek bude klásť malé celé obrazce - kolieska, štvorčeky alebo krátke čiarky. Vyberte obrazec, jeho veľkosť a či je plný, alebo len obrys; Prietok určuje, koľko plochy sa snažia pokryť. V oblasti spreja sa kladú len celé obrazce, takže príliš malý sprej nenakreslí nič.

**Prichytávanie a jeho krok.** Prichytávanie (tlačidlo pod plátnom alebo Shift+S) spôsobí, že výbery, tvary, body obrazcov, text a vkladané kusy dosadnú na mriežku; kreslenie od ruky sa nikdy neprichytáva. Zoznam vedľa tlačidla určuje mriežku: atribútovú bunku režimu (8x8, alebo 8x4, 8x2 či 8x1 v multicolor režimoch), 16x16, celú obrazovku 256x192 (len na plátne väčšom ako jedna obrazovka, napr. Layer 2 320 a 640), alebo vlastný krok, ktorého vodorovnú a zvislú veľkosť nastavíte v Nastaveniach v časti Kreslenie. Voľba kroku tiež zapne prichytávanie. Vložený kus dosadne ľavým horným rohom na mriežku. Pri zapnutom prichytávaní šípky posúvajú čakajúci obrazec, plávajúci kus alebo koniec prechodu o jeden krok; výber nesúci svoje farby sa posúva o krok zaokrúhlený na celé bunky. ZX Paintbrush posúva klávesnicou po jednom bode bez ohľadu na rastr, takže sa to zámerne líši.

**Veľkosti výberu.** Pri obdĺžnikovom výbere volí zoznam **Veľkosť**, čo ťah vyberie. Voľná je obdĺžnik ľubovoľnej veľkosti. Bunka vyberie celé atribútové bunky, ktorých sa dotkne. 16x16, Obrazovka (256x192, na plátne väčšom ako jedna obrazovka) a Vlastná (šírka a výška bloku, ktoré nastavíte) vyberajú celé bloky tej veľkosti: klik vyberie jeden blok, ťah všetky bloky, ktorých dosiahne. Bloky Bunka ležia na mriežke buniek; ostatné bloky začínajú tam, kde stlačíte myš, alebo pri zapnutom prichytávaní na prichytávacej bunke, v ktorej ste stlačili. Blok nikdy nepresiahne okraj obrázka. Pri zapnutom prichytávaní vyberie Voľný ťah z jedného bodu prichytenia do druhého presne vzdialenosť medzi nimi.

{{tools}}
