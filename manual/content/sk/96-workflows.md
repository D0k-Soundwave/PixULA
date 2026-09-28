## Postupy

Niekoľko bežných úloh od začiatku do konca.

### Váš prvý obrázok

1. Otvorte `PixULA.html`. Začínate v Štandardnej ULA s prázdnou obrazovkou
   256 × 192.
2. Zapnite bunkovú mriežku vedľa ovládania priblíženia, aby ste videli bloky
   8 × 8, v ktorých sa ukladá farba.
3. Vyberte farbu atramentu vo farebnej lište alebo klávesmi 1 až 8 a farbu
   papiera pravým kliknutím na vzorku.
4. Kreslite **Štetcom**. Ľavé tlačidlo pre atrament, pravé pre papier.
5. Približujte klávesmi `+` a `-`. Podržte medzerník a ťahajte, aby ste sa
   posunuli, alebo použite nástroj **Posun zobrazenia**.
6. `Ctrl+Z` vracia späť. `Ctrl+S` uloží projekt `.pixula`, ktorý okrem obrázka
   uchová aj vrstvy a nastavenia.

Rozvrhnúť farebné plochy pred detailmi zvyčajne ušetrí prácu, pretože hranica
farby, ktorá nepadne na hranicu bunky, bude znova a znova meniť farby, ktoré ste
už vyriešili.

### Obkreslenie fotografie

1. Otvorte panel **Referencia** a načítajte fotografiu. Leží za kresbou s
   priehľadnosťou, polohou a mierkou, ktoré nastavíte, a nikdy nie je súčasťou
   ukladaného obrázka.
2. Kreslite cez ňu na bežnej vrstve.
3. Ak referencia niekedy vyzerá menej ostro než originál, panel na to upozorní
   a ponúkne tlačidlo **Nájsť fotografiu**. PixULA odkazuje na súbor na disku,
   takže keď sa fotka presunie, zostane z nej len malý náhľad.

### Prevod fotografie

Aby prevod urobil PixULA:

1. **Súbor > Načítať** a vyberte `.png`, `.jpg` alebo `.gif`.
2. Okno importu ukáže tri prevody vedľa seba: Ostrý, Hladký a Plochý. Ktorý
   vyzerá najlepšie, závisí úplne od fotografie, takže sa oplatí zakaždým
   porovnať všetky tri.
3. Upravte jas, kontrast a mierku, kým náhľad nebude dobre čitateľný, a
   potvrďte.

V ULAplus a v režimoch Next sa paleta zostaví z vášho obrázka, takže nie ste
obmedzení šestnástimi farbami ULA. To zvyčajne urobí veľký rozdiel.

### Vytvorenie písma

1. **Súbor > Editor písma**.
2. Začnite písmom ZX ROM alebo importujte sadu `.ch8` či `.chr`.
3. Vyberte znak a upravte ho. K dispozícii sú šírky 4, 6 a 8 pixelov, ale
   zúženie natrvalo zahodí pravé stĺpce, takže pri skúšaní postupujte od úzkej.
4. Pomenujte písmo, aby ste ho pridali do knižnice.
5. Vyberte nástroj **Text**. Vaše písmo sa objaví v zozname vedľa písma ROM.
   Napíšte text, umiestnite ho a pred potvrdením ho zväčšite alebo otočte –
   priebežne sa prekresľuje zo znakov, takže zostáva ostrý v akejkoľvek
   veľkosti.

### Stavba mapy z dlaždíc

1. Nakreslite na plátno bunky, ktoré chcete použiť ako dlaždice.
2. **Súbor > Editor máp** a prevezmite ich do sady dlaždíc.
3. Nastavte veľkosť mapy a maľujte. Ľavé tlačidlo kladie dlaždicu, pravé maže a
   vyplnenie nahradí súvislú oblasť rovnakých dlaždíc.
4. Exportujte ako `.zxtm`, ak chcete pokračovať v práci, alebo ako assembler, C
   či surové binárne dáta na použitie v programe.

### Kreslenie pre ZX Spectrum Next

1. V ponuke Obrázok vyberte režim Next – Layer 2 so šírkou 256, 320 alebo 640
   alebo jeden z režimov LoRes.
2. V týchto režimoch nie je konflikt atribútov; každý pixel nesie vlastný index
   palety. Spravujete paletu 256 deväťbitových farieb, upravovanú cez
   **Obrázok > Upraviť paletu** a ukladanú ako `.pal` alebo `.npl`.
3. Uložte obrázok ako `.nxi`, ktorý paletu obsahuje, alebo ako `.sl2` pre holú
   bitmapu.
4. Pre sprity použite **Súbor > Editor spritov** a hárok uložte ako `.spr`.

Klasický obrázok môžete previesť do režimu Next a späť. Cesta späť znamená znova
vtesnať každú bunku do dvoch farieb, takže v tomto smere počítajte so stratou
detailov; PixULA vám to povie skôr, než to urobí.

### Obrázok na skutočnom hardvéri

- **Pre emulátor** uložte `.scr`. Je to surový obsah obrazovej pamäte Spectra a
  prečíta ho každý emulátor. Presná veľkosť závisí od režimu obrazovky – pre
  každý ju uvádza tabuľka v kapitole o režimoch obrazovky.
- **Pre skutočný počítač** uložte `.tap` alebo `.tzx`. Ak chcete svoju obrazovku
  pridať na pásku, na ktorej už sú iné súbory, použite **Súbor > Bloky pásky**.
- **Ak ho chcete ukázať niekomu bez Spectra**, uložte `.png`.
