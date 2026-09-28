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
