## Pliki

Można zapisać dwie różne rzeczy i ważne jest, po którą sięgnąć.

**Projekt** zachowuje pracę tak, jak ją zostawiłeś: każdą warstwę, paletę, tryb
ekranu, narzędzia i ich ustawienia, obraz referencyjny i miejsce, na które
patrzyłeś. To plik `.pixula` zapisywany przez **Plik > Zapisz projekt** i
właśnie jego używaj, dopóki obraz jest w toku.

**Obraz** to jeden spłaszczony ekran w formacie zrozumiałym dla innego
programu – `.scr` dla emulatora, `.png`, żeby komuś pokazać, `.tap` do
wczytania na prawdziwym sprzęcie. Zapisuje je **Plik > Zapisz obraz jako**.
Zawierają tylko obraz i nic więcej – to, czego chcesz, przekazując wynik, a nie
to, czego chcesz, jeśli zamierzasz dalej nad nim pracować.

### Autozapis i kopie zapasowe

PixULA może co kilka minut zapisywać pracę w pamięci przeglądarki i proponować
ją ponownie, jeśli sesja skończy się źle. Jest to wyłączone, dopóki nie wybierzesz
częstotliwości: ustaw **Autozapis co (minut, 0 = wyłączony)** w Preferencjach, w
zakładce Ogólne.

Możesz też wybrać folder na dysku, a każdy autozapis zapisze tam numerowaną
wersję – `picture V1.pixula`, `picture V2.pixula` i tak dalej. Numeracja jest
za każdym razem odczytywana z folderu, więc ponowne otwarcie obrazu kontynuuje
serię zamiast zaczynać od V1, a dwie sesje nad tym samym obrazem dzielą jeden
zestaw wersji. Liczbę przechowywanych wersji ustawisz w Preferencjach;
domyślnie 20.

Jedna rzecz, której warto się spodziewać. Przeglądarka nie otworzy ponownie
folderu wybranego w poprzedniej sesji bez Twojego potwierdzenia, a zegar
autozapisu nie może zapytać za Ciebie. Pierwsza kopia po przeładowaniu
zatrzymuje się więc i czeka. W Preferencjach jest przycisk **Wznów kopie
zapasowe**, a jego naciśnięcie to potwierdzenie, na które czeka przeglądarka.

{{formats}}
