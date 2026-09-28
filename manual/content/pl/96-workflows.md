## Sposoby pracy

Kilka typowych zadań od początku do końca.

### Twój pierwszy obraz

1. Otwórz `PixULA.html`. Zaczynasz w trybie Standardowe ULA z pustym ekranem
   256 na 192.
2. Włącz siatkę komórek obok przycisków powiększenia, aby widzieć bloki 8 na 8,
   w których zapisywany jest kolor.
3. Wybierz kolor tuszu na pasku kolorów lub klawiszami od 1 do 8, a kolor
   papieru – prawym kliknięciem próbki.
4. Rysuj **Pędzlem**. Lewy przycisk to tusz, prawy – papier.
5. Powiększaj klawiszami `+` i `-`. Przytrzymaj spację i przeciągnij, aby się
   przesunąć, albo użyj narzędzia **Przesuń widok**.
6. `Ctrl+Z` cofa. `Ctrl+S` zapisuje projekt `.pixula`, który oprócz obrazu
   zachowuje warstwy i ustawienia.

Wyznaczenie obszarów koloru przed szczegółami zwykle oszczędza pracy, bo granica
koloru, która nie wypada na granicy komórki, będzie wciąż zmieniać kolory, które
już ustaliłeś.

### Odrysowywanie zdjęcia

1. Otwórz panel **Referencja** i wczytaj zdjęcie. Leży za rysunkiem z
   ustawioną przez Ciebie przezroczystością, położeniem i skalą i nigdy nie jest
   częścią zapisywanego obrazu.
2. Rysuj na nim na zwykłej warstwie.
3. Jeśli referencja kiedyś wygląda mniej ostro niż oryginał, panel to zgłosi i
   zaproponuje przycisk **Znajdź zdjęcie**. PixULA odwołuje się do pliku na
   dysku, więc gdy zdjęcie zostanie przeniesione, zostaje tylko mały podgląd.

### Konwersja zdjęcia

Aby konwersję wykonał PixULA:

1. **Plik > Wczytaj** i wybierz `.png`, `.jpg` lub `.gif`.
2. Okno importu pokazuje obok siebie trzy konwersje: Ostry, Gładki i Płaski.
   Która wygląda najlepiej, zależy wyłącznie od zdjęcia, więc warto za każdym
   razem porównać wszystkie trzy.
3. Dostosuj jasność, kontrast i skalowanie, aż podgląd będzie czytelny, i
   zatwierdź.

W ULAplus i trybach Next paleta jest budowana z Twojego obrazu, więc nie
ogranicza Cię szesnaście kolorów ULA. Zwykle robi to dużą różnicę.

### Tworzenie czcionki

1. **Plik > Edytor czcionek**.
2. Zacznij od czcionki ZX ROM albo zaimportuj zestaw `.ch8` lub `.chr`.
3. Wybierz znak i edytuj go. Dostępne są szerokości 4, 6 i 8 pikseli, ale
   zwężenie na zawsze odrzuca prawe kolumny, więc eksperymentując, idź od wąskiej.
4. Nadaj czcionce nazwę, aby dodać ją do biblioteki.
5. Wybierz narzędzie **Tekst**. Twoja czcionka pojawi się na liście obok
   czcionki ROM. Wpisz tekst, umieść go, przeskaluj lub obróć przed
   zatwierdzeniem – jest na bieżąco rysowany z glifów, więc pozostaje ostry w
   każdym rozmiarze.

### Budowanie mapy z kafli

1. Narysuj na płótnie komórki, których chcesz użyć jako kafli.
2. **Plik > Edytor map** i przechwyć je do zestawu kafli.
3. Ustaw rozmiar mapy i maluj. Lewy przycisk kładzie kafel, prawy wymazuje, a
   wypełnienie zastępuje spójny obszar takich samych kafli.
4. Wyeksportuj jako `.zxtm`, żeby dalej pracować, albo jako asembler, C lub
   surowe dane binarne do użycia w programie.

### Rysowanie dla ZX Spectrum Next

1. Wybierz tryb Next w menu Obraz – Layer 2 o szerokości 256, 320 lub 640 albo
   jeden z trybów LoRes.
2. W tych trybach nie ma konfliktu atrybutów; każdy piksel ma własny indeks
   palety. Zarządzasz paletą 256 dziewięciobitowych kolorów, edytowaną przez
   **Obraz > Edytuj paletę** i zapisywaną jako `.pal` lub `.npl`.
3. Zapisz obraz jako `.nxi`, który zawiera paletę, albo `.sl2` dla samej
   bitmapy.
4. Dla sprite’ów użyj **Plik > Edytor sprite’ów** i zapisz arkusz jako `.spr`.

Klasyczny obraz można przekonwertować do trybu Next i z powrotem. Powrót oznacza
ponowne dopasowanie każdej komórki do dwóch kolorów, więc w tę stronę licz się z
utratą szczegółów; PixULA uprzedzi Cię, zanim to zrobi.

### Obraz na prawdziwym sprzęcie

- **Dla emulatora** zapisz `.scr`. To surowa zawartość pamięci ekranu Spectrum
  i odczyta ją każdy emulator. Dokładny rozmiar zależy od trybu ekranu – podaje
  go dla każdego tabela w rozdziale o trybach ekranu.
- **Dla prawdziwego komputera** zapisz `.tap` lub `.tzx`. Aby dodać swój ekran
  do taśmy, na której są już inne pliki, użyj **Plik > Bloki taśmy**.
- **Żeby pokazać komuś bez Spectrum**, zapisz `.png`.
