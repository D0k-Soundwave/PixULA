## Kolor

W trybach klasycznych nie wybierasz koloru piksela. Wybierasz dwa kolory, których
użyje cała komórka, oraz dwa znaczniki.

- **TUSZ** to kolor pikseli tuszu.
- **PAPIER** to kolor pikseli papieru.
- **JASNOŚĆ** podnosi oba do jaśniejszej wersji. Na komórkę przypada jeden
  znacznik Jasności, więc Tusz i Papier są jasne razem albo wcale.
- **MIGANIE** na prawdziwym sprzęcie zamienia Tusz i Papier mniej więcej dwa
  razy na sekundę.

Lewy przycisk myszy rysuje piksele tuszu. Prawy rysuje piksele papieru i
ustawia te same cztery atrybuty, które ustawiłby lewy. Na piórze przycisk boczny robi
to samo co prawy przycisk myszy.

**Gumka** działa inaczej niż oba. Zamienia piksele tuszu w piksele papieru i
zostawia atrybuty komórki bez zmian, nawet gdy wymazuje ostatni piksel tuszu w
komórce. Aby wymazać też atrybuty, przejdź gumką po pustej komórce jeszcze raz
nowym pociągnięciem: Tusz, Papier, Jasność i Miganie wracają do czarnego na białym, a na wyższej warstwie komórka
znów staje się przezroczysta. Komórka, w której są jeszcze piksele tuszu, zachowuje
atrybuty, ile razy byś jej nie wymazywał.
Opcja **Atrybuty** gumki, widoczna w trybach ekranu z atrybutami komórek, to
zmienia: Ustaw bieżące wymazuje piksele tuszu i nadaje komórce atrybuty z
paska, jak
narzędzie wycierania w ZX Paintbrush, a Zachowaj, domyślne, to zachowanie
opisane wyżej.

Każdy z czterech można też ustawić na **użyj istniejącego**: to kratkowane pole
pod nim na pasku kolorów. Pociągnięcie zostawia wtedy tę część każdej komórki
bez zmian, zamiast zapisywać twoje ustawienie. Ustaw TUSZ, PAPIER i JASNOŚĆ na
istniejące i włącz MIGANIE, a opcja **Wypełnij tylko atrybuty** narzędzia
wypełniania sprawi, że cały obszar będzie migał bez zmiany żadnego koloru.
Shift+B i Shift+F przełączają JASNOŚĆ i MIGANIE, a Shift+T ustawia wszystkie
cztery na istniejące. W ULAplus JASNOŚĆ i MIGANIE wybierają CLUT, więc wybór
CLUT ma jedno pole, które zachowuje CLUT każdej komórki.

### Tryby rysowania

Tryb rysowania zmienia to, co robi pociągnięcie. Jest zapamiętywany między
sesjami, więc pasek stanu pokazuje go zawsze, gdy jest inny niż Normalny – w
niektórych z tych trybów pociągnięcie nie zostawia nic widocznego i inaczej nie
wiedziałbyś dlaczego.

Górny pasek ma trzy przyciski: **Tryb rysowania**, **Narzędzie komórki** i
**Lustro**. Każdy pokazuje obowiązujący wybór. Kliknij go, a pod nim otworzy się
mała siatka pozostałych wyborów; kliknij jeden, a siatka się zamknie. Naciśnij
Escape albo kliknij gdzie indziej, aby zamknąć ją bez zmian. Tryb rysowania i
Lustro działają razem: przy ustawieniu XOR i Poziomo pociągnięcie jest odbitym
pociągnięciem XOR. Narzędzie komórki, gdy jest włączone, przejmuje każde
pociągnięcie.

{{draw-modes}}

Pędzel we wszystkich odmianach, wypełnianie, kształty, krzywa Béziera, tekst,
stemple z panelu **Stemple** i lewy przycisk gradientu stosują się do trybu
rysowania. Gumka, pipeta, przesuwanie, wklejanie i usuwanie zaznaczenia, panel
**Transformacja**, opcja **Wypełnij tylko atrybuty** oraz przyciski Zamień i
Zmień kolor go pomijają.

**Przekoloruj Tusz to nie to samo co Przekoloruj.** Przekoloruj Tusz i
Przekoloruj Papier to tryby rysowania: przekolorowują każdą komórkę, której
dotyka bieżące narzędzie - kilka przy małym pędzlu, każdą, którą pokrywa
wypełniony prostokąt - i obowiązuje Lustro. **Przekoloruj**, w przycisku
Narzędzie komórki, przekolorowuje całą komórkę pod wskaźnikiem, jakiekolwiek
narzędzie jest wybrane, bez względu na rozmiar pędzla. **Zamień**, z
tego samego przycisku, działa tak samo i zamienia Tusz z Papierem w każdej
komórce. Oba zostają włączone, dopóki ich nie wyłączysz - wybierz Brak, wybierz
je ponownie, kliknij prawym przyciskiem płótno albo wybierz narzędzie lub tryb
rysowania - a pasek stanu mówi o tym, dopóki są włączone.

**Tylko atrybuty** to trzeci z tych trybów rysowania. Nadaje każdej komórce,
której dotyka bieżące narzędzie, Tusz, Papier, Jasność i Miganie naraz i nie
rysuje żadnego piksela, jak ZX Paintbrush z wyłączonym rysowaniem pikseli. Każda
z czterech części ustawiona na **użyj istniejącego** zostaje w każdej komórce
bez zmian: z Papierem na istniejącym działa jak Przekoloruj Tusz, z Tuszem na
istniejącym jak Przekoloruj Papier. Tak jak w nich oba przyciski robią to samo,
a tryb jest dostępny tylko w trybach ekranu, których komórki mają atrybuty.

**Kopiuj atrybuty, Odwróć piksele i Odwróć piksele i atrybuty** to trzy kolejne
narzędzia komórki w tym samym przycisku Narzędzie komórki i działają tak samo:
wybierz jedno, potem klikaj lub przeciągaj po komórkach. Każde przeciągnięcie
cofa się jednym krokiem, a narzędzie zostaje włączone, dopóki go nie wyłączysz.
**Kopiuj atrybuty** pobiera atrybuty, które pokazuje komórka pod pierwszym
kliknięciem, i nadaje je każdej komórce, po której przeciągasz; pasek kolorów
się nie zmienia. **Odwróć piksele** zamienia piksele tuszu każdej całej komórki
w piksele papieru, a piksele papieru w tusz, a atrybuty zostawia (pustą komórkę
wypełnia). **Odwróć piksele i atrybuty** dodatkowo zamienia Tusz z Papierem, więc każda komórka wygląda
tak samo; służy do porządkowania zaimportowanego obrazu, pomija komórki, w
których rysuje też inna warstwa, i nie jest dostępne w ULAplus i ULANext.
Narzędzie komórki jest oferowane tylko w trybach ekranu, w których może działać:
przycisk Narzędzie komórki wymienia tylko pasujące (i jest ukryty tam, gdzie
żadne nie pasuje), a Odwróć piksele działa też w Timex Hi-res, gdzie piksele leżą
w komórkach 8 na 8. Przy włączonym Lustrze każde narzędzie komórki, także Zamień i Przekoloruj, działa też na lustrzanym odbiciu każdej komórki, której dotknie: odbita komórka dostaje tę samą zmianę własnych pikseli i atrybutów.

**XOR / Na wierzchu i XOR / Każde przejście** odwracają piksele, z tuszu na
papier i z papieru na tusz, zamiast rysować piksele tuszu, i oba nadają komórce
wybrane atrybuty. XOR / Na wierzchu odwraca każdy piksel raz na pociągnięcie, więc powrót po własnej linii w tym samym pociągnięciu
niczego już nie zmienia. XOR / Każde przejście odwraca piksel za każdym razem,
gdy pociągnięcie po nim przechodzi: jeden ruch pędzla to jedno przejście, choćby
pędzel po drodze nakładał się sam na siebie, ale pociągnięcie, które opuści
piksel i do niego wróci, odwraca go ponownie, więc ósemka znosi się tam, gdzie
się krzyżuje. Kształty, krzywe, wypełnienia i tekst to zawsze jedno przejście,
więc dla nich oba tryby dają ten sam wynik.

**Odwróć** zamienia to, co robią dwa przyciski myszy: lewy rysuje piksele papieru, a
prawy piksele tuszu, jak INVERSE 1 w BASIC-u. Włącza się go w Preferencjach albo klawiszami Shift+I, a pasek stanu mówi „Odwrócenie jest włączone”, dopóki
trwa. Nie zmienia niczego w trybach Przekoloruj Tusz, Przekoloruj Papier, Tylko
atrybuty i w dwóch trybach XOR, gdzie oba przyciski robią to samo, i pasek stanu to mówi.
Tekst i pieczątki rysują swoje litery i kształty pikselami papieru zamiast
pikseli tuszu, wzór kładzie swoje piksele tuszu jako piksele papieru, a swoje
piksele papieru jako tusz, a wypełnienie wypełnia pikselami papieru lewym
przyciskiem i pikselami tuszu prawym. Gumka, Zamień i Przekoloruj
go ignorują. Jest zapamiętywane między sesjami i zapisywane w ustawieniach
wstępnych razem z trybem rysowania.

**Rdzeń atrybutów.** Dla okrągłego i kwadratowego pędzla, konturów kształtów i
krzywej Béziera Rdzeń atrybutów mówi, jaka część grubej linii przejmuje atrybuty
komórek. Linia zawsze rysuje wszystkie piksele tuszu. Przy Rdzeniu atrybutów 1
piksel lub 4 piksele tylko komórki pod środkiem linii, linią tak szeroką, która
podąża za jej środkiem, przejmują twoje atrybuty; pozostałe komórki pod nią
dostają piksele tuszu w atrybutach, które już miały, więc gruba linia koliduje z
mniejszą liczbą komórek. Cała linia, ustawienie domyślne, nadaje twoje atrybuty
każdej komórce, której linia dotyka. Opcja pojawia się tylko w trybach ekranu z
atrybutami komórek. Przy Lustrze odbita linia ma własny rdzeń, a przy XOR
komórki poza rdzeniem zachowują swoje atrybuty.

### Palety

Dwie rodziny trybów pozwalają zmieniać same kolory. ULAplus daje 64 rejestry
kolorów, ułożone jako cztery palety po szesnaście. Tryby Next dają 256 kolorów
po dziewięć bitów.

Palety są plikami. Możesz utworzyć paletę, zapisać ją i wczytać do innego
obrazu – przez **Plik > Wczytaj paletę** i **Plik > Zapisz paletę** albo z
edytora palety. Nie trzeba otwierać edytora, żeby ją wczytać, bo paletę zwykle
wczytuje się, zanim zacznie się rysować.

Jeśli format pliku ma miejsce na paletę – `.scr` o rozmiarze 6976 bajtów,
`.nxi`, wariant Timex – paleta podróżuje też wewnątrz obrazu.

**Miejsca na palety.** Paleta ULAplus i paleta Next mają po cztery miejsca, w menu Obraz > Paleta (Miejsce 1 – Miejsce 4). Używane miejsce jest zaznaczone, a edytor palety mówi, które edytuje. Nowy dokument zaczyna na Miejscu 1, a pozostałe zawierają paletę domyślną, dopóki ich nie użyjesz. Wybór innego miejsca zmienia kolory, którymi obraz jest pokazywany, i nigdy nie zmienia atrybutów obrazu. Każdy wybór to jeden krok cofania. Miejsca są zapisywane w projekcie i w automatycznej kopii, ale dopiero gdy użyjesz któregoś miejsca; obraz otwarty z innego rodzaju pliku zaczyna na Miejscu 1, a pozostałe zawierają kopie jego palety. Eksporty .scr, .tap i obrazów zawsze używają używanego miejsca. Tryby ze stałą paletą (Standard ULA, tryby Multicolor, GigaScreen i tryby Timex) nie mają miejsc.

**Odwróć paletę** (tylko ULAplus) zamienia połowę Tuszu (wpisy 0-7) z połową Papieru (wpisy 8-15) w każdej z czterech CLUT, w jednym kroku cofania; dwukrotne użycie przywraca paletę. Aby odwrócić obraz ULAplus tak, by wyglądał tak samo, użyj Odwróć paletę, a potem Obraz > Atrybuty > Odwróć. Ramka podąża za połową Papieru CLUT 0, więc też zmienia kolor. Tryby Next nie mają odwracania palety, bo ULANext trzyma Tusz w 8 wpisach palety, a Papier w 32.

**Klawisze CLUT.** W trybach ULAplus Ctrl+Shift+1 do Ctrl+Shift+4 wybierają CLUT 0-3, tak jak wybór CLUT na pasku kolorów. W innych trybach pasek stanu to mówi i nic więcej się nie dzieje.

**Kolory standardowe.** W Ustawienia > Preferencje sekcja Kolory standardowe pozwala zmienić 15 kolorów, które pokazują tryby Standard, Multicolor, GigaScreen i Timex. Jasna czerń jest zawsze czernią. Kolory zmieniają to, co widzisz, i to, co zawierają eksporty obrazów (PNG, GIF, BMP, JPG); nigdy nie zmieniają bajtów plików .scr ani .tap, a import obrazu nadal dopasowuje do oryginalnych kolorów Spectrum, więc to samo zdjęcie daje ten sam obraz na każdej maszynie. Palety ULAplus i Next są osobne. OK stosuje kolory, Anuluj nie zachowuje niczego, a Przywróć standardowe przywraca oryginały. Są zapamiętane w tej przeglądarce, nie w projekcie. Wczytaj .pal czyta plik kolorów standardowych ZX Paintbrush (256 bajtów), a Zapisz .pal zapisuje taki plik, co jest sposobem na przeniesienie kolorów do innej przeglądarki.

**Taśmy z paletą.** Plik > Zapisz paletę jako TAP zapisuje paletę ULAplus jako taśmę 176 bajtów. Wczytana na Spectrum poleceniem `LOAD ""` ustawia 64 wpisy palety, a potem wczytuje następny plik z taśmy, więc taśma z paletą może stać przed taśmą z obrazem lub grą. Plik > Wczytaj paletę i Plik > Otwórz czytają taśmy z paletą: własne PixULA i ZX Paintbrush. Taśma z paletą trafia do używanego miejsca palety jednym krokiem cofania i nie staje się otwartym plikiem.

### GigaScreen

GigaScreen przechowuje dwa pełne ekrany i pokazuje je na przemian, pięćdziesiąt
razy na sekundę. Oko miesza dwa kolory każdego piksela w jeden, więc komórka z
jednym Tuszem i jednym Papierem na każdym ekranie może pokazać **cztery**
kolory, a cały obraz około stu.

Nigdy nie rysujesz na jednym ekranie. Każde pociągnięcie zapisuje oba, a pasek
kolorów działa parami:

- **Ekran A** i **Ekran B** mają własne próbki Tuszu i Papieru oraz własną
  **JASNOŚĆ**. Miganie jest jednym ustawieniem dla obu.
- **Maluj** pokazuje cztery kolory wynikające z tych wyborów, zmieszane
  dokładnie tak, jak pokazuje je płótno: Tusz na obu ekranach, Tusz tylko na A,
  Tusz tylko na B i Papier na obu. Wybierz jeden, a lewy przycisk będzie nim
  malować. Prawy przycisk zawsze maluje Papier na obu ekranach.
- Wybierz ten sam Tusz dla obu ekranów, a lewa górna próbka w Maluj będzie tym
  kolorem, czystym – tak rysuje się wszystko, co nie ma wyglądać na
  zmieszane.

Pipeta pobiera to wszystko z powrotem: atrybuty obu ekranów i to, który z
czterech pokazuje piksel.

Przyciski wyświetlania zmieniają tylko to, co pokazuje płótno, nigdy to, gdzie
trafia pociągnięcie. **Średnia** to to, co oko widzi na prawdziwym komputerze.
**Migotanie** zamienia oba ekrany w każdej klatce, jak robi to sprzęt. **A** i
**B** pokazują jeden ekran. Obraz zapisany lub wyeksportowany jako PNG używa
Średniej, gdy wyświetlane jest Migotanie, bo nieruchomy obraz nie może
migotać.

Wejście w GigaScreen kopiuje obraz na oba ekrany, więc wygląda tak samo jak
przedtem. Wyjście zachowuje ekran A i odrzuca ekran B; jeśli ekran B zawiera
coś innego, zostaniesz ostrzeżony wcześniej.

Tak samo pracuje się w dwóch innych trybach migotania:

- **MultiGigaScreen 8×4, 8×2 i 8×1** kładą oba ekrany na drobniejsze komórki
  Multicolor, więc cztery kolory dotyczą 4, 2 lub jednej linii, a nie bloku 8
  na 8. To pliki `.mg4`, `.mg2` i `.mg1` programu MultiArtist.
- **Timex Hi-res GigaScreen** przełącza dwa ekrany wysokiej rozdzielczości 512
  na 192. Wysoka rozdzielczość nie ma atrybutów komórek – każdy ekran ma jeden
  schemat kolorów dla całego obrazu – więc pasek pokazuje rząd schematów dla
  Ekranu A i jeden dla Ekranu B, a Maluj pokazuje cztery ich mieszanki. To
  pliki `.hrg`.

Przełączanie między dowolnymi trybami dwuekranowymi zachowuje oba ekrany, według
tych samych reguł, według których konwertuje się pojedynczy ekran.

### Atrybuty

Pozycje Atrybuty w menu Obraz zmieniają atrybuty komórek, a piksele zostają
na miejscu. Odwróć zamienia Tusz z Papierem w każdej komórce i zachowuje
Jasność oraz Miganie. Wyczyść zapisuje bieżący Tusz, Papier, Jasność i
Miganie w każdej komórce; pola „użyj istniejących” zachowują to, co komórka
ma już teraz. Odbij poziomo i Odbij pionowo odbijają atrybuty komórek. Każde
polecenie działa na zaznaczenie (wszystkie dotknięte komórki) albo na cały
obraz, gdy nic nie jest zaznaczone, i cofa się jednym krokiem. Pozycje są
wyszarzone w trybach bez atrybutów komórek (Timex Hi-res, Layer 2, LoRes), gdy pieczątka bez własnych atrybutów jest w toku i na zablokowanej warstwie.

Zmień... znajduje komórki po ich atrybutach i zamienia je. Znajdź określa, które komórki dopasować: każde pole to wartość albo Dowolny. Zamień na określa, na co się zmienią: każde pole to wartość albo Zachowaj. Okno pokazuje, ile komórek się zmieni, zanim naciśniesz OK, a OK cofa się jednym krokiem. Tryb GigaScreen ma grupę Ekran A i grupę Ekran B; w ULAplus CLUT 0-3 zastępuje Jasność i Miganie. Anuluj nic nie zmienia.

### Piksele

Pozycje Piksele w menu Obraz zmieniają piksele i zostawiają atrybuty w ich komórkach. Odbij poziomo i Odbij pionowo odbijają piksele. Odwróć piksele i atrybuty odwraca piksele i dodatkowo zamienia Tusz z Papierem w każdej komórce, więc obraz wygląda tak samo. Nie jest oferowane w trybach bez atrybutów komórek (Layer 2, LoRes, Timex Hi-res) i jest wyszarzone, gdy unosi się pieczątka. W ULAplus i ULANext też nie jest dostępne, bo zamiana Tuszu z Papierem zmieniłaby wygląd obrazu.

Wybór Przesuń w sekcji Przesunięcie panelu Transformacja określa, co się przesuwa. Piksele i atrybuty (domyślnie) przesuwa całe komórki razem z ich Papierem. Tylko piksele przesuwa piksele o piksel lub o komórkę naraz. Tylko atrybuty przesuwa atrybuty komórek po jednej komórce. Krzyżak ma też przekątne. Gdy unosi się pieczątka, Przesuń jest wyszarzone, bo przesunięcie przenosi całą pieczątkę.

Gdy coś jest zaznaczone, klawisze strzałek stosują ten sam wybór Przesuń.

### Pieczątki

Gdy pieczątka jest włączona, panel **Przekształcanie** pokazuje, jak jest kładziona.

**Atrybuty** wybiera między Tylko piksele a Własne atrybuty. Tylko piksele kładzie piksele pieczątki w atrybutach z paska atrybutów, jak zawsze. Własne atrybuty kładzie atrybuty, które niesie pieczątka, komórka po komórce: pieczątkę z Edytora map albo skopiowaną z obrazu w trybie z atrybutami komórek. Pieczątka skopiowana z obrazu zaczyna jako Tylko piksele, więc wklejenie ląduje dokładnie jak dawniej. Własne atrybuty układają pieczątkę na całych komórkach, ignorują tryb rysowania, pasek kolorów i przełącznik XOR, a pieczątki nie można skalować, obracać, wyginać, odbijać, odwracać ani obrysowywać; panel wyszarza te opcje i mówi dlaczego. Zmiana kształtu pieczątki Tylko piksele odrzuca atrybuty, które niosła. Inwersja nadal zamienia, co robią piksele tuszu i piksele papieru. Jeśli komórki pieczątki mają inny rozmiar niż bieżący tryb ekranu, możliwe jest tylko Tylko piksele.

**Prześwit** (tylko Własne atrybuty) pozwala, by zamiast atrybutu pieczątki prześwitywał atrybut, który już jest na stronie. Tusz, Papier, Jasność i Miganie mają po jednym polu. ULAplus ma jedno pole CLUT dla Jasności i Migania razem. W GigaScreen każde pole obejmuje oba ekrany.

**Piksele papieru** decydują, co robią piksele papieru pieczątki. Zostaw tło zostawia obraz pod nimi w spokoju (pieczątka z własnymi atrybutami nadal przemalowuje Papier pod nimi, chyba że prześwituje Papier). Wyczyść tło zamienia też obraz pod nimi w piksele papieru, na całym prostokącie pieczątki. Tryby rysowania bez przeciwieństwa (XOR, Przekoloruj Tusz, Przekoloruj Papier) i własny przełącznik XOR pieczątki zostawiają piksele papieru w spokoju, a panel to mówi. Piksele papieru są dostępne w każdym trybie ekranu, także w tych bez atrybutów komórek.

**Zamień na same piksele** na stałe odrzuca atrybuty pieczątki i zachowuje jej piksele. Wybór Tylko piksele w Atrybutach je zachowuje, więc można wrócić. Każda zmiana to jeden krok cofania.

Dopóki włączona jest pieczątka z własnymi atrybutami, polecenia Obraz > Atrybuty (Odwróć, Wymaż, oba Odbij i Zmień...) działają na komórki pieczątki zamiast na obraz, czy to unoszącej się, czy odłożonej. Ignorują zaznaczenie i nigdy nie dotykają pikseli pieczątki, a komórka, której pieczątka nie pokrywa, zostaje bez zmian. Odbijanie odbija komórki atrybutów pieczątki, a jej piksele zostają na miejscu. Pieczątka GigaScreen ma jeden zestaw atrybutów dla obu ekranów, więc okno Zmień pokazuje jedną grupę. Każde polecenie to jeden krok cofania. Dla pieczątki bez własnych atrybutów pozostają wyszarzone.
