## Konflikt atrybutów

Spectrum przechowuje obraz w dwóch osobnych częściach.

Pierwsza to bitmapa: 256 na 192 piksele, po jednym bicie, piksel tuszu albo
piksel papieru. Druga to siatka atrybutów, jeden bajt na każdy blok 8 na 8 tych
pikseli – 32 bajty w poziomie i 24 w pionie. Każdy z tych bajtów określa kolor
**Tuszu** (kolor pikseli tuszu), kolor **Papieru** (kolor pikseli papieru), czy
para ma **Jasność** i czy ma **Miganie**.

Kształt obrazu ma więc rozdzielczość 256 na 192, a jego kolor 32 na 24. Każda
komórka 8 na 8 może pokazać dwa kolory, a każdy piksel w niej ma jeden albo
drugi.

![Dwie ukośne linie przecinające się na powiększonym płótnie z widoczną siatką komórek. Niebieska linia staje się czerwona w każdej komórce, przez którą przechodzi też czerwona](img/attribute-clash.png)

*Niebieska i czerwona linia przecinające się, w powiększeniu 800% z siatką
komórek. Tam, gdzie czerwona linia przechodzi przez komórkę, niebieska linia w
tej komórce też jest czerwona. Czerwone pociągnięcie przyszło drugie i ustawiło
Tusz dla całej komórki, łącznie z pikselami tuszu postawionymi już przez
niebieskie.*

To właśnie oznacza „konflikt atrybutów” (*attribute clash*). Rysowanie w jednej
części komórki zmienia kolor wszystkiego innego w niej i żadne ustawienie tego
nie wyłącza – tak działa sprzęt.

### Jak z tym pracować

Większość grafików Spectrum planuje obszary koloru przed szczegółami, układając
obraz tak, by granice koloru wypadały na granicach komórek. Gdy komórka
potrzebuje odcienia, którego nie może pomieścić, stosuje się dithering: dwa
kolory przeplecione tak drobno, że oko je miesza.

PixULA pomaga w tym na trzy sposoby.

**Siatka komórek.** Włącz ją obok przycisków powiększenia, a zobaczysz
dokładnie, gdzie zmiana koloru jest darmowa, a gdzie będzie Cię kosztować.

**Tryby rysowania.** Pociągnięcie nie musi zmieniać jednocześnie pikseli i
atrybutów. Możesz rysować piksele tuszu, nie ruszając atrybutów, albo przebarwić
komórkę, nie dotykając żadnego piksela. Wymienia je rozdział o kolorze.

**Biblioteka wzorów.** Jej rdzeniem jest zestaw kafli o zmierzonej gęstości
pikseli tuszu – po nie sięgasz, gdy komórka potrzebuje szarości, której nie może
pomieścić.

### Podgląd pikseli

Trzy przełączniki w menu Widok zmieniają to, co pokazuje ekran, nie zmieniając
obrazu. **Wyłącz atrybuty** pokazuje piksele tuszu na czarno, a piksele papieru
na biało, żebyś widział, które piksele są naprawdę tuszem. **Siatka kolorów** robi to samo i dodatkowo
barwi komórki jak szachownicę, żeby dobrze było widać granice komórek; ona i
Wyłącz atrybuty wzajemnie się wyłączają. **Zatrzymaj miganie** trzyma każdą
migającą komórkę w jej zwykłych kolorach. Żaden z nich nie dotyka obrazu,
cofania ani eksportu: zapisany obraz wygląda tak samo, czy są włączone, czy nie.
Przeglądarka je zapamiętuje, a przełącznik, który nie może działać w bieżącym
trybie ekranu, jest wyszarzony – najedź na niego, żeby zobaczyć dlaczego. W
GigaScreen i MultiGiga Wyłącz atrybuty pokazuje cztery poziomy szarości: biel
tam, gdzie żaden ekran nie ma piksela tuszu, jasnoszary dla piksela tuszu tylko
na ekranie A,
ciemniejszy szary tylko na ekranie B i czerń dla obu.

### Odczyt wskaźnika

Pasek pod obrazem i pasek stanu mówią, gdzie jest wskaźnik. W **Preferencjach**
opcja *Odczyt wskaźnika pokazuje* dodaje atrybut pod wskaźnikiem (jego numer
dziesiętnie i szesnastkowo, potem Tusz, Papier, Jasność i Miganie; CLUT w ULAplus;
oba ekrany w GigaScreen) oraz adres pamięci bajtu piksela i jego bajtu atrybutu.
Adresy istnieją tam, gdzie prawdziwa maszyna ma stały układ: Standard ULA i
ULAplus (plik ekranu od $4000, atrybuty od $5800), Timex hi-colour (atrybuty w
drugim pliku ekranu, od $6000), Timex hi-res (parzyste kolumny bajtów od $4000,
nieparzyste od $6000) i GigaScreen (ekran A jak standardowy, ekran B w banku 7
od $C000; to, który ekran należy do którego banku, jest konwencją). Inne tryby
podają, że nie mają adresu.

*Y liczy się od* można ustawić na dół, aby odczyt wyglądał jak w BASIC PLOT,
gdzie 0,0 to lewy dolny róg, a Y biegnie od 0 do 175. Istnieje to tylko w
górnych 176 wierszach obrazu 256 na 192; poniżej i na innych ekranach odczyt
pokazuje kreskę. Zmienia tylko odczyt.

**Siatka własna...** w menu Widok rysuje siatkę o dowolnym kroku X i Y,
ustawianych osobno, a **Pokaż siatkę własną** włącza ją i wyłącza. Linie bliższe
niż cztery piksele na ekranie są pomijane, dopóki nie powiększysz widoku.
Włączone siatki wracają przy następnym uruchomieniu programu. W Preferencjach
*Kolory siatek* ustawiają kolor każdej siatki; jeśli zostawisz zaznaczone *Kolor
motywu*, siatka podąża za motywem.

### Gdzie reguły są inne

Późniejszy sprzęt na różne sposoby złagodził to ograniczenie, a PixULA potrafi
pracować ze wszystkimi. Komputery Timex zagęściły siatkę atrybutów. ULAplus
zastąpił szesnaście stałych kolorów paletą do wyboru. GigaScreen przełącza dwa
obrazy tak szybko, że sugeruje kolory, których nie ma w żadnym z nich. ZX
Spectrum Next w trybach Layer 2 i LoRes całkiem porzuca ten schemat: tam każdy
piksel ma własny kolor.

Obraz można przenosić między nimi – zobacz następny rozdział.
