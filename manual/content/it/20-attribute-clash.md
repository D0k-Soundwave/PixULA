## Il conflitto di attributi

Lo Spectrum conserva un’immagine in due parti separate.

La prima è una bitmap: 256 per 192 punti, un bit ciascuno, acceso o spento. La
seconda è una griglia di colore, un byte per ogni blocco 8 per 8 di quei punti:
32 byte in larghezza e 24 in altezza. Ognuno di questi byte indica di che
colore deve essere l’**inchiostro** (i punti accesi), di che colore la
**carta** (i punti spenti), se la coppia è **luminosa** e se deve
**lampeggiare**.

Quindi la forma dell’immagine ha una risoluzione di 256 per 192, e il suo
colore di 32 per 24. Ogni cella 8 per 8 può mostrare due colori, e ogni punto
al suo interno è l’uno o l’altro.

![Due linee diagonali che si incrociano su un’area di disegno ingrandita con la griglia delle celle visibile. La linea blu diventa rossa in ogni cella attraversata anche da quella rossa](img/attribute-clash.png)

*Una linea blu e una rossa che si incrociano, all’800% con la griglia delle
celle. Dove la linea rossa attraversa una cella, anche la linea blu in quella
cella è rossa. Il tratto rosso è arrivato per secondo e ha impostato il colore
d’inchiostro dell’intera cella, compresi i punti già posati dal tratto blu.*

Questo è ciò che si intende per «conflitto di attributi» (*attribute clash*).
Disegnare in una parte di una cella cambia il colore di tutto il resto della
cella, e nessuna impostazione lo disattiva: è così che funziona l’hardware.

### Lavorarci insieme

La maggior parte degli artisti Spectrum pianifica le aree di colore prima dei
dettagli, disponendo l’immagine in modo che i confini di colore cadano sui
confini delle celle. Quando una cella ha bisogno di una tonalità che non può
contenere, si ricorre alla retinatura: due colori intrecciati abbastanza fini
da farli fondere all’occhio.

PixULA aiuta in tre modi.

**La griglia delle celle.** Attivala accanto ai controlli zoom e vedrai
esattamente dove un cambio di colore è gratuito e dove ti costerà.

**Le modalità di disegno.** Un tratto non deve per forza cambiare insieme punti
e colori. Puoi impostare i punti lasciando stare i colori, o ricolorare una
cella senza toccare un punto. Il capitolo sul colore le elenca.

**La libreria di motivi.** Il suo nucleo è una serie di tessere con densità
d’inchiostro misurate, quelle a cui ricorrere quando una cella ha bisogno di un
grigio che non può contenere.

### Dove le regole cambiano

L’hardware successivo ha allentato il vincolo in vari modi, e PixULA sa
lavorare con tutti. Le macchine Timex hanno reso più fine la griglia di colore.
ULAplus ha sostituito i sedici colori fissi con una tavolozza a scelta.
GigaScreen alterna due immagini abbastanza in fretta da suggerire colori che
nessuna delle due contiene. Lo ZX Spectrum Next abbandona del tutto lo schema
nelle modalità Layer 2 e LoRes, dove ogni pixel porta il proprio colore.

Puoi spostare un’immagine dall’una all’altra: vedi il capitolo successivo.
