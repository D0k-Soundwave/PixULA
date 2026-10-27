## Animazione

PixULA anima in due modi. Un'**animazione schermo** cambia l'intera immagine da
un fotogramma all'altro. Un'**animazione sprite** ne cambia un blocco, una
figura che cammina o una bandiera che sventola, mentre il resto dell'immagine
resta fermo dietro. Entrambe rispettano ogni regola della modalità schermo: un
fotogramma è fatto di celle di attributi intere, quindi non divide mai gli
attributi di una cella.

### Iniziare un'animazione

**Animazione > Nuova animazione schermo** trasforma l'immagine nel
fotogramma 1. Ogni livello diventa animato: ha un contenuto proprio in ogni
fotogramma.

**Animazione > Nuova animazione sprite...** chiede un nome, larghezza e
altezza, una posizione e quanti fotogrammi avere all'inizio. La dimensione si
arrotonda per eccesso a celle intere della modalità, e la finestra dice cosa è
diventata: nella modalità 8x1, 20 x 20 diventa 24 x 20. Usa la selezione prende
dimensione e posto da una selezione. Per posare lo sprite con un clic, seleziona
prima il blocco con lo strumento Selezione (Dimensione: Personalizzata).
**Nuova animazione sprite dalla selezione** sposta anche il blocco selezionato
sul livello dello sprite come fotogramma 1. Una linea punteggiata appena fuori
dalla sua finestra mostra dove si trova.

Un'immagine può contenere più animazioni; il selettore in cima al pannello
Animazione sceglie quella aperta. La modalità schermo non può cambiare finché
l'immagine ha animazioni.

### Fotogrammi

Il pannello Animazione mostra ogni fotogramma in piccolo, con numero e
ritardo. Clicca su uno per andarci, o premi `,` e `.` per il fotogramma prima e
dopo. Disegni sul fotogramma mostrato con ogni strumento, esattamente come su
un'immagine ferma: conflitto di attributi, modalità di disegno, Specchio,
timbri, Flash e Annulla funzionano come sempre.

Aggiungi mette un fotogramma vuoto dopo quello mostrato e Duplica una sua
copia; Elimina, Sinistra e Destra lo eliminano e lo spostano. Il ritardo è
quanto il fotogramma resta sullo schermo, in fotogrammi dello Spectrum da
1/50 s, e Applica a tutti dà quel ritardo a ogni fotogramma. Per portare parte
di un fotogramma nel successivo, copiala (**Animazione > Fotogramma in timbro**
copia la finestra di uno sprite), vai al fotogramma dopo e posa il timbro.
Annullare un passo fatto su un altro fotogramma ti riporta a quel fotogramma.

**Animazione > Timbri in fotogrammi** fa un nuovo fotogramma di ogni timbro
dell'elenco Timbri, posato dove il timbro è parcheggiato; i timbri restano.

### Livelli in un'animazione

Finché un'animazione è aperta, ogni riga del pannello Livelli ha un interruttore
Animato / Condiviso. Un livello animato ha un contenuto proprio in ogni
fotogramma; uno condiviso è uguale in ogni fotogramma, come uno sfondo
disegnato una volta. Rendere animato un livello lo copia in ogni fotogramma;
renderlo condiviso tiene il fotogramma mostrato, dopo una conferma. I nuovi
livelli entrano nell'animazione aperta, e Unisci in basso, Unisci selezionati e
Appiattisci agiscono su ogni fotogramma.

### Riproduzione

Riproduci (Invio) riproduce l'animazione aperta sull'immagine; uno sprite si
muove sul suo sfondo, e il FLASH e lo sfarfallio GigaScreen continuano. Primo,
Precedente, Successivo e Ultimo scorrono i fotogrammi (tieni premuto Precedente
o Successivo per continuare), e Stop torna al fotogramma da cui è partita. Un
clic sull'immagine o Esc mette in pausa. Ripeti riproduce i fotogrammi in
ciclo, una volta o avanti e indietro. Velocità riproduce più veloce o più lento
senza cambiare i ritardi, e Riproduci fotogrammi ne riproduce solo una parte.

### Ricalcare i fotogrammi

**Ricalca** sotto un fotogramma lo mostra sbiadito mentre disegni gli altri,
come livello di anteprima nel pannello Livelli. L'interruttore **Buccia di
cipolla** mostra allo stesso modo il fotogramma prima e quello dopo, che ti
seguono quando cambi fotogramma. **Livello > Nuovo livello di anteprima** ne
aggiunge uno da solo.

Un livello di anteprima segue la regola del sistema dei livelli: i suoi pixel
di carta e le celle vuote sono trasparenti, l'inchiostro dei livelli sopra lo
copre, e si vede sbiadito su ciò che sta sotto. Spostalo su o giù per metterlo
sopra o sotto il livello su cui disegni. Ognuno ha una propria opacità, una
tinta (fotogrammi precedenti in rosso, successivi in blu) e mostra o nascondi, ed
eliminarlo toglie solo l'anteprima. Un'anteprima non fa mai parte
dell'immagine: non ci si disegna, non si unisce né si esporta, ed è nascosta
durante la riproduzione.

### Esportare

**Animazione > Esporta animazione**:

- **Schermate numerate...** salva ogni fotogramma come una propria schermata
  Spectrum, numerata in ordine (`walk_001.scr`, `walk_002.scr` e così via), in
  qualunque formato di schermata la modalità sappia salvare. Ogni file è
  esattamente ciò che Salva immagine come scrive per quel fotogramma. Scegli il
  nome, il primo numero, le cifre e i fotogrammi. Se il browser può scrivere in
  una cartella ne scegli una; altrimenti le schermate arrivano in un solo
  `.zip`.
- **GIF animata** riproduce i fotogrammi con i loro ritardi, FLASH e GigaScreen
  compresi.
- **Foglio di sprite PNG** mette i fotogrammi uno accanto all'altro, 16 per
  riga.
- **SevenuP, tutti i fotogrammi** scrive fino a 32 fotogrammi in un `.sev`
  (modalità standard). Aprire un `.sev` di più fotogrammi ne fa un'animazione
  sprite.
- **Nastro** scrive uno SCREEN$ per fotogramma in un `.tap` o un `.tzx`.
  Contiene le schermate, non un programma che le riproduca.
- **Sprite Next** scrive un'animazione sprite 16 x 16 delle modalità Layer 2 e
  LoRes come foglio `.spr`.

Le animazioni si salvano nei progetti PixULA, nel salvataggio di recupero e nei
backup.
