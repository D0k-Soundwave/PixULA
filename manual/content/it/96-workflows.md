## Procedure

Alcuni lavori comuni, dall’inizio alla fine.

### La tua prima immagine

1. Apri `PixULA.html`. Parti in ULA standard con uno schermo vuoto di 256 per
   192.
2. Attiva la griglia delle celle, accanto ai controlli zoom, per vedere i
   blocchi 8 per 8 in cui è memorizzato il colore.
3. Scegli un colore d’inchiostro dalla barra dei colori o con i tasti da 1 a 8,
   e un colore di carta con un clic destro su un campione.
4. Disegna con il **Pennello**. Tasto sinistro per l’inchiostro, destro per la
   carta.
5. Zooma con `+` e `-`. Tieni premuta la barra spaziatrice e trascina per
   spostarti, o usa lo strumento **Sposta vista**.
6. `Ctrl+Z` annulla. `Ctrl+S` salva un progetto `.pixula`, che conserva livelli
   e impostazioni oltre all’immagine.

Definire le aree di colore prima dei dettagli di solito fa risparmiare lavoro,
perché un confine di colore che non cade su un confine di cella continuerà a
cambiare colori che avevi già sistemato.

### Ricalcare una fotografia

1. Apri il pannello **Riferimento** e carica la fotografia. Resta dietro al
   disegno con l’opacità, la posizione e la scala che imposti, e non fa mai
   parte dell’immagine che salvi.
2. Disegnaci sopra su un livello normale.
3. Se il riferimento sembra meno nitido dell’originale, il pannello lo segnala
   e offre un pulsante **Trova foto**. PixULA collega il file sul disco, quindi
   se la foto viene spostata ne resta solo una piccola anteprima.

### Convertire una fotografia

Per lasciare che sia PixULA a convertire:

1. **File > Carica**, e scegli un `.png`, `.jpg` o `.gif`.
2. La finestra di importazione mostra tre conversioni affiancate: Nitido,
   Morbido e Piatto. Quale renda meglio dipende interamente dalla fotografia,
   quindi vale la pena confrontarle tutte e tre ogni volta.
3. Regola luminosità, contrasto e ridimensionamento finché l’anteprima non si
   legge bene, poi conferma.

In ULAplus e nelle modalità Next la tavolozza viene costruita dall’immagine,
quindi non sei limitato ai sedici colori dell’ULA. Di solito fa una grande
differenza.

### Creare un carattere

1. **File > Editor dei caratteri**.
2. Parti dal carattere ZX ROM, o importa un set `.ch8` o `.chr`.
3. Seleziona un carattere e modificalo. Sono disponibili larghezze di 4, 6 e 8
   pixel, ma restringere scarta per sempre le colonne di destra, quindi se
   sperimenti procedi dal più stretto.
4. Dai un nome al carattere per aggiungerlo alla tua libreria.
5. Seleziona lo strumento **Testo**. Il tuo carattere compare nel suo elenco
   accanto a quello ROM. Scrivi, posiziona il testo e ridimensionalo o ruotalo
   prima di confermarlo: viene ridisegnato dai glifi man mano, quindi resta
   nitido a qualsiasi dimensione.

### Costruire una mappa con le tessere

1. Disegna sull’area di disegno le celle che vuoi usare come tessere.
2. **File > Editor di mappe**, e catturale nel set di tessere.
3. Imposta la dimensione della mappa e dipingi. Il tasto sinistro posa una
   tessera, il destro cancella, e il riempimento sostituisce un’area connessa
   di tessere uguali.
4. Esporta come `.zxtm` per continuare a lavorarci, o come assembly, C o
   binario grezzo da usare in un programma.

### Disegnare per lo ZX Spectrum Next

1. Scegli una modalità Next dal menu Immagine: Layer 2 larga 256, 320 o 640, o
   una delle modalità LoRes.
2. In queste modalità non c’è conflitto di attributi; ogni pixel porta il
   proprio indice di tavolozza. Quello che gestisci è una tavolozza di 256
   colori a nove bit, modificata da **Immagine > Modifica tavolozza** e salvata
   come `.pal` o `.npl`.
3. Salva l’immagine come `.nxi`, che contiene la tavolozza, o come `.sl2` per la
   bitmap grezza.
4. Per gli sprite, usa **File > Editor di sprite** e salva il foglio come
   `.spr`.

Puoi convertire un’immagine classica in una modalità Next e viceversa. Tornare
indietro significa ridurre di nuovo ogni cella a due colori, quindi aspettati
di perdere dettaglio in quella direzione; PixULA te lo dice prima di farlo.

### Portare un’immagine sull’hardware reale

- **Per un emulatore**, salva un `.scr`. È il contenuto grezzo della memoria
  video dello Spectrum, e ogni emulatore lo legge. La dimensione esatta dipende
  dalla modalità schermo: la tabella nel capitolo sulle modalità schermo la
  indica per ognuna.
- **Per una macchina reale**, salva un `.tap` o un `.tzx`. Per aggiungere il tuo
  schermo a un nastro che contiene già altri file, usa **File > Blocchi
  nastro**.
- **Per mostrarla a chi non ha uno Spectrum**, salva un `.png`.
