## Animacja

PixULA animuje na dwa sposoby. **Animacja ekranu** zmienia cały obraz z klatki
na klatkę. **Animacja sprite'a** zmienia jeden jego blok, idącą postać albo
powiewającą flagę, a reszta obrazu stoi za nim w miejscu. Obie przestrzegają
każdej zasady trybu ekranu: klatka składa się z całych komórek atrybutów, więc
nigdy nie dzieli atrybutów komórki.

### Rozpoczęcie animacji

![Menu Animacja](img/menu-animation.png)

![Okno Nowa animacja sprite'a](img/dialog-new-sprite.png)

**Animacja > Nowa animacja ekranu** robi z obrazu klatkę 1. Każda warstwa staje
się animowana: ma własną treść w każdej klatce.

**Animacja > Nowa animacja sprite'a...** pyta o nazwę, szerokość i wysokość,
położenie i liczbę klatek na start. Rozmiar jest zaokrąglany w górę do całych
komórek trybu, a okno mówi, czym się stał: w trybie 8x1 20 x 20 staje się
24 x 20. Użyj zaznaczenia bierze rozmiar i miejsce z zaznaczenia. Aby położyć
sprite'a kliknięciem, najpierw zaznacz blok narzędziem Zaznaczenie (Rozmiar:
Własny). **Nowa animacja sprite'a z zaznaczenia** dodatkowo przenosi
zaznaczony blok jako klatkę 1 na własną warstwę sprite'a. Kropkowana linia tuż
na zewnątrz jego okna pokazuje, gdzie jest.

Obraz może mieć kilka animacji; wybór na górze panelu Animacja decyduje, która
jest otwarta. Trybu ekranu nie można zmienić, dopóki obraz ma animacje.

### Klatki

![Panel Animacja z sześcioma klatkami odbijającej się piłki](img/animation-panel.png)

Panel Animacja pokazuje każdą klatkę jako mały obrazek z numerem i
opóźnieniem. Kliknij jedną, aby do niej przejść, albo naciśnij `,` i `.`, aby
przejść do klatki przed i po. Rysujesz na pokazanej klatce każdym narzędziem
tak samo jak na nieruchomym obrazie: konflikt atrybutów, tryby rysowania,
Lustro, stemple, Flash i Cofnij działają jak zawsze.

Dodaj wstawia pustą klatkę po pokazanej, a Powiel jej kopię; Usuń, W lewo i W
prawo usuwają ją i przesuwają. Opóźnienie to czas, przez jaki klatka zostaje na
ekranie, w klatkach Spectrum po 1/50 s, a Ustaw wszystkie nadaje to opóźnienie
każdej klatce. Aby przenieść część klatki do następnej, skopiuj ją
(**Animacja > Klatka na stempel** kopiuje okno sprite'a), przejdź do następnej
klatki i połóż stempel. Cofnięcie kroku zrobionego na innej klatce przenosi z
powrotem na tę klatkę.

**Animacja > Stemple na klatki** robi nową klatkę z każdego stempla z listy
Stemple, położonego tam, gdzie stempel stoi; stemple zostają.

### Warstwy w animacji

![Panel Warstwy z warstwą animowaną, warstwą wspólną i dwiema warstwami podglądu kalki cebulowej](img/animation-layers.png)

Dopóki animacja jest otwarta, każdy wiersz panelu Warstwy ma przełącznik
Animowana / Wspólna. Warstwa animowana ma własną treść w każdej klatce; wspólna
wygląda tak samo w każdej klatce, jak tło narysowane raz. Animowana kopiuje
warstwę do każdej klatki; Wspólna zachowuje pokazaną klatkę, po pytaniu. Nowe
warstwy dołączają do otwartej animacji, a Scal w dół, Scal zaznaczone i Spłaszcz
działają na każdą klatkę.

### Odtwarzanie

Odtwórz (Enter) odtwarza otwartą animację na obrazie; sprite porusza się po
swoim tle, a FLASH i migotanie GigaScreen działają dalej. Pierwsza, Poprzednia,
Następna i Ostatnia przechodzą przez klatki (przytrzymaj Poprzednia lub
Następna, by przewijać dalej), a Stop wraca do klatki, od której zaczęło się
odtwarzanie. Kliknięcie obrazu lub Escape wstrzymuje. Powtarzanie odtwarza
klatki w pętli, raz albo tam i z powrotem. Szybkość odtwarza szybciej lub
wolniej bez zmiany opóźnień, a Odtwarzaj klatki odtwarza tylko część animacji.

### Odrysowywanie klatek

**Kalka** pod klatką pokazuje tę klatkę wyblakle, gdy rysujesz pozostałe, jako
warstwę podglądu w panelu Warstwy. Przełącznik **Kalka cebulowa** pokazuje tak
samo klatkę przed i po, a obie idą za tobą, gdy zmieniasz klatkę.
**Warstwa > Nowa warstwa podglądu** dodaje jedną z nich osobno.

Warstwa podglądu trzyma się zasady systemu warstw: jej piksele papieru i puste
komórki są przezroczyste, atrament warstw nad nią ją zakrywa, a nad tym, co pod
nią, widać ją wyblakłą. Przesuń ją w górę lub w dół, aby leżała nad lub pod
warstwą, na której rysujesz. Każda ma własne krycie, zabarwienie (wcześniejsze
klatki na czerwono, późniejsze na niebiesko) oraz pokaż i ukryj, a usunięcie
zabiera tylko podgląd. Podgląd nigdy nie jest częścią obrazu: nigdy się na nim
nie rysuje, nie scala się go ani nie eksportuje, a podczas odtwarzania jest
ukryty.

### Eksport

**Animacja > Eksportuj animację**:

- **Numerowane ekrany...** zapisuje każdą klatkę jako osobny ekran Spectrum,
  numerowany po kolei (`walk_001.scr`, `walk_002.scr` i tak dalej), w każdym
  formacie ekranu, jaki tryb potrafi zapisać. Każdy plik to dokładnie to, co
  Zapisz obraz jako zapisuje dla tej klatki. Wybierasz nazwę, pierwszy numer,
  liczbę cyfr i klatki. Jeśli przeglądarka potrafi zapisywać do folderu,
  wybierasz go; w przeciwnym razie ekrany przychodzą jako jeden `.zip`.
- **Animowany GIF** odtwarza klatki z ich opóźnieniami, razem z FLASH i
  GigaScreen.
- **Arkusz sprite'ów PNG** kładzie klatki obok siebie, 16 w rzędzie.
- **SevenuP, wszystkie klatki** zapisuje do 32 klatek w jednym `.sev` (tryb
  standardowy). Otwarcie `.sev` z kilkoma klatkami robi z nich animację
  sprite'a.
- **Taśma** zapisuje jeden SCREEN$ na klatkę w `.tap` lub `.tzx`. Zawiera
  ekrany, a nie program, który je odtworzy.
- **Sprite'y Next** zapisuje animację sprite'a 16 x 16 w trybach Layer 2 i
  LoRes jako arkusz `.spr`.

Animacje są zapisywane w projektach PixULA, w zapisie odzyskiwania i w kopiach
zapasowych.
