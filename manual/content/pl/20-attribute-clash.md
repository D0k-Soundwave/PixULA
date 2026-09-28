## Konflikt atrybutów

Spectrum przechowuje obraz w dwóch osobnych częściach.

Pierwsza to bitmapa: 256 na 192 punkty, po jednym bicie, włączony lub
wyłączony. Druga to siatka koloru, jeden bajt na każdy blok 8 na 8 tych punktów
– 32 bajty w poziomie i 24 w pionie. Każdy z tych bajtów określa kolor
**tuszu** (punktów włączonych), kolor **papieru** (punktów wyłączonych), czy
para jest **jasna** i czy ma **migać**.

Kształt obrazu ma więc rozdzielczość 256 na 192, a jego kolor 32 na 24. Każda
komórka 8 na 8 może pokazać dwa kolory, a każdy punkt w niej ma jeden albo
drugi.

![Dwie ukośne linie przecinające się na powiększonym płótnie z widoczną siatką komórek. Niebieska linia staje się czerwona w każdej komórce, przez którą przechodzi też czerwona](img/attribute-clash.png)

*Niebieska i czerwona linia przecinające się, w powiększeniu 800% z siatką
komórek. Tam, gdzie czerwona linia przechodzi przez komórkę, niebieska linia w
tej komórce też jest czerwona. Czerwone pociągnięcie przyszło drugie i ustawiło
kolor tuszu dla całej komórki, łącznie z punktami postawionymi już przez
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

**Tryby rysowania.** Pociągnięcie nie musi zmieniać jednocześnie punktów i
kolorów. Możesz stawiać punkty, nie ruszając kolorów, albo przebarwić komórkę,
nie dotykając żadnego punktu. Wymienia je rozdział o kolorze.

**Biblioteka wzorów.** Jej rdzeniem jest zestaw kafli o zmierzonej gęstości
tuszu – po nie sięgasz, gdy komórka potrzebuje szarości, której nie może
pomieścić.

### Gdzie reguły są inne

Późniejszy sprzęt na różne sposoby złagodził to ograniczenie, a PixULA potrafi
pracować ze wszystkimi. Komputery Timex zagęściły siatkę koloru. ULAplus
zastąpił szesnaście stałych kolorów paletą do wyboru. GigaScreen przełącza dwa
obrazy tak szybko, że sugeruje kolory, których nie ma w żadnym z nich. ZX
Spectrum Next w trybach Layer 2 i LoRes całkiem porzuca ten schemat: tam każdy
piksel ma własny kolor.

Obraz można przenosić między nimi – zobacz następny rozdział.
