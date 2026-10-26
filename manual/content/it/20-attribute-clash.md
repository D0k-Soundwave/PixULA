## Il conflitto di attributi

Lo Spectrum conserva un’immagine in due parti separate.

La prima è una bitmap: 256 per 192 pixel, un bit ciascuno, un pixel d’inchiostro
o un pixel di carta. La seconda è una griglia di attributi, un byte per ogni
blocco 8 per 8 di quei pixel: 32 byte in larghezza e 24 in altezza. Ognuno di
questi byte indica di che colore deve essere l’**Inchiostro** (il colore dei
pixel d’inchiostro), di che colore la **Carta** (il colore dei pixel di carta),
se la coppia ha la **Luminosità** e se ha il **Lampeggio**.

Quindi la forma dell’immagine ha una risoluzione di 256 per 192, e il suo
colore di 32 per 24. Ogni cella 8 per 8 può mostrare due colori, e ogni pixel
al suo interno è l’uno o l’altro.

![Due linee diagonali che si incrociano su un’area di disegno ingrandita con la griglia delle celle visibile. La linea blu diventa rossa in ogni cella attraversata anche da quella rossa](img/attribute-clash.png)

*Una linea blu e una rossa che si incrociano, all’800% con la griglia delle
celle. Dove la linea rossa attraversa una cella, anche la linea blu in quella
cella è rossa. Il tratto rosso è arrivato per secondo e ha impostato
l’Inchiostro dell’intera cella, compresi i pixel d’inchiostro già posati dal
tratto blu.*

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

**Le modalità di disegno.** Un tratto non deve per forza cambiare insieme pixel
e attributi. Puoi disegnare pixel d’inchiostro lasciando stare gli attributi, o
ricolorare una cella senza toccare un pixel. Il capitolo sul colore le elenca.

**La libreria di motivi.** Il suo nucleo è una serie di tessere con densità
di pixel d’inchiostro misurate, quelle a cui ricorrere quando una cella ha bisogno di un
grigio che non può contenere.

### Vedere i pixel

Tre interruttori del menu Visualizza cambiano ciò che lo schermo mostra, senza
cambiare l'immagine. **Attributi disattivati** mostra i pixel d'inchiostro in
nero e i pixel di carta in bianco, così vedi quali pixel sono davvero
inchiostro. **Griglia colori** fa lo stesso e in più tinge le celle come una
scacchiera, per vedere bene i confini delle celle; essa e Attributi disattivati
si escludono a vicenda. **Ferma lampeggio**
tiene ogni cella lampeggiante nei suoi colori normali. Nessuno tocca l'immagine,
l'annulla o un'esportazione: un'immagine salvata è identica con gli interruttori
attivi o no. Il browser li ricorda, e un interruttore che non può funzionare
nella modalità schermo corrente è in grigio: passaci sopra per vedere perché.
Con GigaScreen e MultiGiga, Attributi disattivati mostra quattro livelli di
grigio: bianco dove nessuno schermo ha un pixel d'inchiostro, grigio chiaro per
un pixel d'inchiostro solo sullo schermo A, un grigio più scuro solo sullo schermo B e nero per entrambi.

### Leggere il puntatore

La striscia sotto l'immagine e la barra di stato dicono dov'è il puntatore.
Nelle **Preferenze**, *La lettura del puntatore mostra* aggiunge l'attributo
sotto il puntatore (il suo numero in decimale e in esadecimale, poi Inchiostro,
Carta, Luminosità e Lampeggio; la CLUT in ULAplus; entrambi gli schermi in
GigaScreen) e l'indirizzo di memoria del byte del pixel e del suo byte di
attributo. Gli indirizzi esistono dove la macchina reale ha una disposizione
fissa: ULA standard e ULAplus (file di schermo da $4000, attributi da $5800),
Timex hi-colour (attributi nel secondo file di schermo, a $6000), Timex hi-res
(colonne di byte pari a $4000, dispari a $6000) e GigaScreen (schermo A come lo
standard, schermo B nel banco 7 a $C000; quale schermo vada in quale banco è una
convenzione). Le altre modalità dicono di non avere indirizzo.

*La Y si conta da* si può impostare sul basso, così la lettura si legge come
BASIC PLOT, dove 0,0 è l'angolo in basso a sinistra e Y va da 0 a 175. Esiste
solo sulle 176 righe superiori di un'immagine 256 per 192; sotto, e sugli altri
schermi, la lettura mostra un trattino. Cambia solo la lettura.

**Griglia personalizzata...** nel menu Visualizza traccia una griglia con
qualsiasi passo X e Y, impostati separatamente, e **Mostra griglia
personalizzata** la attiva e disattiva. Le linee più vicine di quattro pixel
sullo schermo vengono omesse finché non ingrandisci. Le griglie attivate tornano
alla prossima apertura del programma. Nelle Preferenze, *Colori delle griglie*
imposta il colore di ogni griglia; lasciando spuntato *Colore del tema*, la
griglia segue il tema.

### Dove le regole cambiano

L’hardware successivo ha allentato il vincolo in vari modi, e PixULA sa
lavorare con tutti. Le macchine Timex hanno reso più fine la griglia di attributi.
ULAplus ha sostituito i sedici colori fissi con una tavolozza a scelta.
GigaScreen alterna due immagini abbastanza in fretta da suggerire colori che
nessuna delle due contiene. Lo ZX Spectrum Next abbandona del tutto lo schema
nelle modalità Layer 2 e LoRes, dove ogni pixel porta il proprio colore.

Puoi spostare un’immagine dall’una all’altra: vedi il capitolo successivo.
