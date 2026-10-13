## Edytory

Cztery rzeczy, które tworzy PixULA, nie są obrazami, i każda ma własne okno w
menu Plik.

### Edytor czcionek

Zestaw znaków Spectrum to 96 lub 256 glifów, każdy zapisany jako stos bajtów
wierszy. Ten edytor zmienia je po jednym glifie.

![Edytor czcionek z siatką glifów po jednej stronie i edytowanym znakiem po drugiej](img/dialog-font-editor.png)

*Wybierz znak z siatki po lewej i edytuj go po prawej.*

Glify mogą mieć szerokość 4, 6 lub 8 pikseli przy wysokości komórki. Zwężenie
czcionki na zawsze odrzuca prawe kolumny, więc jeśli próbujesz szerokości,
przechodź od wąskiej do szerokiej.

Możesz zacząć od czcionki ZX ROM, przechwycić glif z płótna albo wczytać zestaw
`.ch4`, `.ch6`, `.ch8`, `.chr` lub `.chx` z innego narzędzia do Spectrum.
Nadanie czcionce nazwy dodaje ją do Twojej biblioteki, a narzędzie Tekst oferuje
ją wtedy obok wbudowanej czcionki ROM.

**Duże czcionki.** Nowa duża czcionka... tworzy duży zestaw czcionek CHX, taki jakiego używa ZX-Editor Second Edition: każdy znak ma 8, 16, 24 lub 32 piksele szerokości i wysokości (szerokość i wysokość wybiera się osobno), a edytor pokazuje rozmiar w miejscu listy szerokości. Zaznacz Wypełnij czcionką, aby wybrać dowolną czcionkę z tej samej listy, której używa narzędzie Tekst, jaką część wysokości znaku mają zajmować litery (w procentach) oraz czy mają leżeć z lewej, na środku czy z prawej. Zaznacz Proporcjonalna, a każda litera zostanie zapisana tylko tak szeroka, jak potrzeba, w pełnych kolumnach po 8 pikseli, więc i zajmuje mniej miejsca niż W; znak Spacja zawsze zachowuje co najmniej jedną kolumnę. Wypełnij z czcionki... robi to samo jednym krokiem z dużą czcionką, którą już masz. Dużą czcionkę można zapisać tylko jako `.chx` (pozostałe formaty oraz listingi asemblerowe, C i binarne zawierają znaki 8 na 8), nie można z niej przechwycić komórki z płótna, a narzędzie Tekst jeszcze jej nie oferuje. Otwarcie dużego `.chx` zachowuje każdy znak w jego własnym rozmiarze, a znak, który plik pomija, pozostaje pominięty przy kolejnym zapisie. Sposób ułożenia w pliku znaku z kilku bloków 8 na 8 wynika z opublikowanego opisu formatu i nie został sprawdzony na pliku zapisanym przez sam ZX Paintbrush, więc otwórz dużą czcionkę zrobioną tutaj w ZX Paintbrush, zanim jej zaufasz.

**Cieniowanie i cofanie.** W czcionce, której znaki mają szerokość równą całkowitej liczbie kolumn po 8 pikseli, cztery przyciski cieniowania zacieniają lub odcieniają po jednej kolumnie z lewej lub z prawej strony edytowanego znaku. Zacieniowana kolumna jest rysowana w kreskowanie i nie jest zapisywana: plik `.chx` zawiera taki znak węższy, a znak zacieniowany na całej szerokości jest pomijany w pliku. Punkty pod cieniowaniem pozostają w edytorze, więc odcienienie je przywraca, ale nie ma ich w pliku. Zacieniuj wszystko do dopasowania robi to dla wszystkich znaków naraz: zacienia puste kolumny po obu stronach punktów, zostawia Spacji jedną kolumnę i pomija pozostałe puste znaki. Znak Spacja zawsze zachowuje co najmniej jedną kolumnę, bo plik `.chx` musi go zawierać. Po eksporcie `.chx` pasek stanu podaje, ile znaków zapisano węziej, ile pominięto i ile miało punkty pod cieniowaniem. Edytor czcionek ma też Cofnij i Ponów (dwa przyciski albo Ctrl+Z i Ctrl+Y): jeden pociągnięcie na powierzchni edycji to jeden krok, tak samo jak każdy przycisk, Nowa duża czcionka, Wypełnij z czcionki, Wczytaj czcionkę ROM czy import. Pisanie w polu nazwy czcionki do tego nie należy.

### Edytor map

Mapa to siatka kafli, a kafel to jedna komórka 8 na 8 – osiem bajtów bitmapy i
jeden bajt atrybutu. Mapy pozwalają zbudować planszę większą niż jeden ekran.

![Edytor map z paletą kafli i przewijanym obszarem mapy](img/dialog-map-editor.png)

*Kafle po lewej, mapa po prawej.*

Maluj lewym przyciskiem i wymazuj prawym albo zastąp wypełnieniem spójny obszar
takich samych kafli. Kafle pochodzą z bieżącego wzoru i kolorów albo prosto z
płótna. Mapę można przenieść z powrotem na płótno, a jedno cofnięcie odwraca
całość.

Zapisz jako `.zxtm`, żeby dalej pracować – to własny format PixULA i zachowuje
wszystko – albo jako `.zxm`, albo jako asembler, C lub surowe dane binarne do
wstawienia w program.

### Edytor sprite’ów

Sprite’y Next mają 16 na 16 pikseli z jednym indeksem palety na piksel, a
arkusz mieści ich do 64.

![Edytor sprite’ów z arkuszem sprite’ów i siatką edycji](img/dialog-sprite-editor.png)

*Arkusz po jednej stronie, rysowany sprite po drugiej.*

Arkusze sprite’ów przechowuje się w plikach `.spr`, a nie w obrazie, więc zapisz
arkusz osobno. W trybach indeksowanych możesz przechwycić sprite’a z płótna i
odbić go na nim jak stempel.

### Edytor palety

**Obraz > Edytuj paletę**, w trybach z edytowalną paletą. Pokazuje ULAplus jako
cztery palety po szesnaście, a paletę Next jako rzędy dziewięciobitowych
kolorów. Każdy wybrany kolor jest dopasowywany do najbliższej wartości, którą
sprzęt naprawdę może zapisać, więc widzisz to, co pokaże komputer.

Każda zmiana to osobny krok cofania. Palety można też wczytywać i zapisywać bez
otwierania tego okna – zobacz rozdział o kolorze.

### Bloki taśmy

**Plik > Bloki taśmy** otwiera `.tap` lub `.tzx` i pokazuje, co jest w środku.
Użyj go, aby wczytać jeden ekran z taśmy zawierającej kilka, albo aby dodać
bieżący obraz do taśmy jako nowy blok i zapisać taśmę ponownie.

Bloki, których nie ruszałeś, są zapisywane bajt w bajt, więc dodanie ekranu do
cudzej taśmy zostawia resztę dokładnie taką, jaka była.
