## Gli editor

Quattro cose che PixULA crea non sono immagini, e ognuna ha una propria
finestra nel menu File.

### L’editor dei caratteri

Un set di caratteri Spectrum ha 96 o 256 glifi, ognuno memorizzato come una
pila di byte di riga. Questo editor li modifica un glifo alla volta.

![L’editor dei caratteri, con la griglia dei glifi da un lato e un singolo carattere in modifica dall’altro](img/dialog-font-editor.png)

*Scegli un carattere dalla griglia a sinistra e modificalo a destra.*

I glifi possono essere larghi 4, 6 o 8 pixel per l’altezza della cella.
Restringere un carattere scarta per sempre le colonne di destra, quindi se stai
provando delle larghezze, procedi dalla più stretta alla più larga.

Puoi partire dal carattere ZX ROM, catturare un glifo dall’area di disegno o
caricare un set `.ch4`, `.ch6`, `.ch8`, `.chr` o `.chx` da un altro strumento
Spectrum. Dare un nome a un carattere lo aggiunge alla tua libreria, e lo
strumento Testo lo offre allora accanto al carattere ROM integrato.

**Font grandi.** Nuovo font grande... crea un set di font grandi CHX, come quello usato da ZX-Editor Second Edition: ogni carattere è largo e alto 8, 16, 24 o 32 pixel (larghezza e altezza si scelgono separatamente), e l'editor mostra la dimensione al posto dell'elenco delle larghezze. Spunta Riempi con un font per scegliere un qualsiasi font dallo stesso elenco dello strumento Testo, quanta parte dell'altezza del carattere devono coprire le lettere (in percentuale) e se stanno a sinistra, al centro o a destra. Spunta Proporzionale e ogni lettera viene salvata solo larga quanto serve, in colonne intere di 8 pixel, così una i occupa meno spazio di una W; il carattere Spazio mantiene sempre almeno una colonna. Riempi da font... fa lo stesso in un solo passo su un font grande che hai già. Un font grande si può salvare solo come `.chx` (gli altri formati e gli elenchi in assembly, C e binario contengono caratteri 8 per 8), non può catturare una cella dalla tela e lo strumento Testo non lo offre ancora. Aprendo un `.chx` grande ogni carattere resta della propria dimensione, e un carattere che il file omette resta omesso quando salvi di nuovo. Il modo in cui un carattere di più blocchi 8 per 8 è disposto nel file segue la descrizione pubblicata del formato e non è stato verificato con un file salvato da ZX Paintbrush stesso, quindi apri in ZX Paintbrush un font grande fatto qui prima di fidartene.

**Ombreggiatura e annulla.** Per un font i cui caratteri sono larghi un numero intero di colonne da 8 pixel, i quattro pulsanti di ombreggiatura ombreggiano o liberano una colonna alla volta a sinistra o a destra del carattere che stai modificando. Una colonna ombreggiata è disegnata a tratteggio e non viene salvata: un file `.chx` contiene quel carattere più stretto, e un carattere ombreggiato da parte a parte è omesso dal file. I punti sotto l'ombreggiatura restano nell'editor, quindi liberarla li riporta, ma non sono nel file. Ombreggia tutto su misura lo fa per tutti i caratteri insieme: ombreggia le colonne vuote ai due lati dei punti, lascia una colonna allo Spazio e omette gli altri caratteri vuoti. Il carattere Spazio mantiene sempre almeno una colonna, perché un file `.chx` deve contenerlo. Dopo un'esportazione `.chx`, la riga di stato dice quanti caratteri sono stati salvati più stretti, quanti sono stati omessi e quanti avevano punti sotto l'ombreggiatura. L'editor dei font ha anche Annulla e Ripeti (i due pulsanti, o Ctrl+Z e Ctrl+Y): un tratto sulla superficie di modifica è un passo, e lo è anche ogni pulsante, Nuovo font grande, Riempi da font, Carica font ROM o un'importazione. Scrivere nella casella del nome del font non ne fa parte.

**Tutti i caratteri.** Il pulsante Tutti i caratteri sostituisce l'editor di un carattere con una mappa di tutto il font, tutti i caratteri affiancati, 16 per riga, su cui disegni con gli stessi Pennello, Gomma, Linea e Riempimento, così un tratto può passare da un carattere al successivo. Un tratto è una modifica e un passo di annullamento, e il Riempimento resta dentro il carattere su cui clicchi. Lo strumento Ombreggia ombreggia o libera la colonna da 8 pixel su cui clicchi, dal bordo più vicino del suo carattere; le colonne ombreggiate sono tratteggiate. Lo strumento Sposta trascina la mappa, ed è così che si scorre con un dito, perché altrimenti la mappa riserva ogni tocco al disegno. I pulsanti meno, Adatta e più cambiano lo zoom a passi interi. Nella mappa e nella griglia dei caratteri le frecce, Home e Fine passano da un carattere all'altro, e digitare un carattere lo sceglie. Non è possibile disegnare pixel solo con la tastiera.

### L’editor di mappe

Una mappa è una griglia di tessere, dove una tessera è una cella 8 per 8: otto
byte di bitmap e un byte di attributi. Le mappe permettono di costruire un
campo di gioco più grande di un singolo schermo.

![L’editor di mappe, con la tavolozza delle tessere e un’area della mappa scorrevole](img/dialog-map-editor.png)

*Le tessere a sinistra, la mappa a destra.*

Dipingi con il tasto sinistro e cancella con il destro, oppure usa il
riempimento per sostituire un’area connessa di tessere uguali. Le tessere
provengono dal motivo e dai colori correnti, o direttamente dall’area di
disegno. Puoi riportare una mappa sull’area di disegno, e un solo annullamento
inverte il tutto.

Salva come `.zxtm` per continuare a lavorare – è il formato proprio di PixULA e
conserva tutto – oppure come `.zxm`, o come assembly, C o binario grezzo da
inserire in un programma.

### L’editor di sprite

Gli sprite Next sono di 16 per 16 pixel con un indice di tavolozza per pixel, e
un foglio ne contiene fino a 64.

![L’editor di sprite, con un foglio di sprite e la griglia di modifica](img/dialog-sprite-editor.png)

*Il foglio da un lato, lo sprite che stai disegnando dall’altro.*

I fogli di sprite si conservano in file `.spr`, non dentro l’immagine, quindi
salva il foglio a parte. Nelle modalità indicizzate puoi catturare uno sprite
dall’area di disegno e timbrarne uno sopra di essa.

### L’editor di tavolozze

**Immagine > Modifica tavolozza**, nelle modalità con tavolozza modificabile.
Mostra ULAplus come quattro tavolozze da sedici e la tavolozza Next come righe
di colori a nove bit. Qualunque colore tu scelga viene portato al valore più
vicino che l’hardware può davvero memorizzare, quindi ciò che vedi è ciò che la
macchina mostrerà.

Ogni modifica è un passo di annullamento a sé. Le tavolozze si possono anche
caricare e salvare senza aprire questa finestra: vedi il capitolo sul colore.

### Blocchi nastro

**File > Blocchi nastro** apre un `.tap` o un `.tzx` ed elenca cosa contiene.
Usalo per caricare uno schermo da un nastro che ne contiene diversi, o per
aggiungere l’immagine corrente a un nastro come nuovo blocco e salvare di nuovo
il nastro.

I blocchi che non hai toccato vengono riscritti byte per byte, quindi
aggiungere uno schermo al nastro di qualcun altro lascia il resto esattamente
com’era.
