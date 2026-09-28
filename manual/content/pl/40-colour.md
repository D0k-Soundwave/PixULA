## Kolor

W trybach klasycznych nie wybierasz koloru piksela. Wybierasz dwa kolory, których
użyje cała komórka, oraz dwa znaczniki.

- **TUSZ** to kolor punktów włączonych.
- **PAPIER** to kolor punktów wyłączonych.
- **JASNOŚĆ** podnosi oba do jaśniejszej wersji. Na komórkę przypada jeden
  znacznik jasności, więc tusz i papier są jasne razem albo wcale.
- **MIGANIE** na prawdziwym sprzęcie zamienia tusz i papier mniej więcej dwa
  razy na sekundę.

Lewy przycisk myszy rysuje tuszem. Prawy rysuje papierem: gasi punkt i ustawia
te same cztery wartości, które ustawiłby lewy. Na piórze przycisk boczny robi
to samo co prawy przycisk myszy.

**Gumka** działa inaczej niż oba. Gasi punkty i zostawia kolory komórki bez
zmian, nawet gdy wymazuje ostatni punkt w komórce. Aby wymazać też kolory,
przejdź gumką po pustej komórce jeszcze raz nowym pociągnięciem: tusz, papier,
jasność i miganie wracają do czarnego na białym, a na wyższej warstwie komórka
znów staje się przezroczysta. Komórka, w której są jeszcze punkty, zachowuje
kolory, ile razy byś jej nie wymazywał.

### Tryby rysowania

Tryb rysowania zmienia to, co robi pociągnięcie, i dotyczy każdego narzędzia.
Jest zapamiętywany między sesjami, więc pasek stanu pokazuje go zawsze, gdy
jest inny niż Normalny – w niektórych z tych trybów pociągnięcie nie zostawia
nic widocznego i inaczej nie wiedziałbyś dlaczego.

{{draw-modes}}

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

### GigaScreen

GigaScreen przechowuje dwa pełne ekrany i pokazuje je na przemian, pięćdziesiąt
razy na sekundę. Oko miesza dwa kolory każdego piksela w jeden, więc komórka z
jednym tuszem i jednym papierem na każdym ekranie może pokazać **cztery**
kolory, a cały obraz około stu.

Nigdy nie rysujesz na jednym ekranie. Każde pociągnięcie zapisuje oba, a pasek
kolorów działa parami:

- **Ekran A** i **Ekran B** mają własne próbki tuszu i papieru oraz własną
  **JASNOŚĆ**. Miganie jest jednym ustawieniem dla obu.
- **Maluj** pokazuje cztery kolory wynikające z tych wyborów, zmieszane
  dokładnie tak, jak pokazuje je płótno: tusz na obu ekranach, tusz tylko na A,
  tusz tylko na B i papier na obu. Wybierz jeden, a lewy przycisk będzie nim
  malować. Prawy przycisk zawsze maluje papier na obu ekranach.
- Wybierz ten sam tusz dla obu ekranów, a lewa górna próbka w Maluj będzie tym
  kolorem, czystym – tak rysuje się wszystko, co nie ma wyglądać na
  zmieszane.

Pipeta pobiera to wszystko z powrotem: kolory obu ekranów i to, który z
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
  na 192. Wysoka rozdzielczość nie ma kolorów komórek – każdy ekran ma jeden
  schemat kolorów dla całego obrazu – więc pasek pokazuje rząd schematów dla
  Ekranu A i jeden dla Ekranu B, a Maluj pokazuje cztery ich mieszanki. To
  pliki `.hrg`.

Przełączanie między dowolnymi trybami dwuekranowymi zachowuje oba ekrany, według
tych samych reguł, według których konwertuje się pojedynczy ekran.
