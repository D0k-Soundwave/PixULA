## Wzory i dithering

Komórka z dwoma kolorami nie ma półtonu. Aby go zasugerować, przeplata się dwa
dostępne kolory i pozwala oku je zmieszać, a biblioteka wzorów daje kafle, które
robią to ze znaną intensywnością.

Aby użyć kafla, włącz **Użyj wzoru** w narzędziu, które to oferuje – robią to
wypełnienie i pędzel wzoru – i wybierz kafel w panelu wzorów.

Kafle o nazwach `density-NN` są generowane, a liczba to rzeczywisty udział
pikseli tuszu w kaflu: `density-25` ma tusz w jednej czwartej swoich pikseli. Rodziny półtonów i szumu
pokrywają ten sam zakres szarości z inną fakturą, więc możesz zmienić wygląd
odcienia bez zmiany jego ciemności.

Możesz też rysować własne kafle w Edytorze wzorów i trzymać je we własnej
bibliotece obok tych.

**Z obrazu.** Przycisk **Z obrazu...** w panelu wzorów tworzy wypełnienie z pliku obrazu (PNG, JPG lub GIF). Okno pokazuje kafelek tak, jak będzie się powtarzał, i oferuje Jasność, Kontrast, Skalowanie, Rozmiar kafelka (kwadrat 8, 16 lub 32 pikseli) oraz te same 31 metod ditheringu co import; domyślnie Floyd-Steinberg. Ciemne części obrazu stają się pikselami tuszu. OK dodaje kafelek do twojej biblioteki pod nazwą pliku - drugi plik o tej samej nazwie staje się "nazwa 2" i nigdy nie zastępuje pierwszego - i ustawia go jako bieżący wzór, gotowy do wypełniania i pędzla wzoru.

{{patterns}}
