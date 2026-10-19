## Il colore

Nelle modalità classiche non scegli un colore per un pixel. Scegli i due colori
che userà un’intera cella, più due indicatori.

- **INCHIOSTRO** è il colore dei pixel d’inchiostro.
- **CARTA** è il colore dei pixel di carta.
- **LUMINOSO** porta entrambi alla loro versione più chiara. C’è un solo
  indicatore di Luminosità per cella, quindi Inchiostro e Carta sono luminosi
  insieme o per niente.
- **LAMPEGGIO** scambia Inchiostro e Carta circa due volte al secondo
  sull’hardware reale.

Il tasto sinistro del mouse disegna pixel d’inchiostro. Il destro disegna pixel
di carta e imposta gli stessi quattro attributi del sinistro. Su una
penna, il pulsante laterale fa ciò che fa il tasto destro.

La **gomma** fa qualcosa di diverso da entrambi. Trasforma i pixel d’inchiostro
in pixel di carta e lascia intatti gli attributi della cella, anche quando
cancella l’ultimo pixel d’inchiostro della cella. Per cancellare anche gli
attributi, ripassa sulla cella vuota con un nuovo tratto: Inchiostro, Carta,
Luminosità e Lampeggio tornano a nero su bianco, e su un livello superiore la
cella torna trasparente. Una cella che contiene ancora pixel d’inchiostro
mantiene i suoi attributi per quante volte tu ci passi sopra.
L'opzione **Attributi** della gomma, visibile nelle modalità schermo con
attributi di cella, cambia questo: Imposta i correnti cancella i pixel
d'inchiostro e dà alla cella gli attributi della barra, come lo strumento di pulizia di ZX Paintbrush, e Mantieni,
l'impostazione predefinita, è il comportamento descritto sopra.

Ognuno dei quattro può anche essere impostato su **usa esistente**: la casella a
scacchi sotto di esso nella barra dei colori. Un tratto lascia allora quella
parte di ogni cella com'è, invece di scrivere la tua impostazione. Metti
INCHIOSTRO, CARTA e LUMINOSO su esistente e attiva LAMPEGGIO, e l'opzione
**Riempi solo attributi** dello strumento di riempimento farà lampeggiare
un'intera area senza cambiare un colore. Maiusc+B e Maiusc+F attivano o
disattivano LUMINOSO e LAMPEGGIO, e Maiusc+T mette tutti e quattro su esistente.
In ULAplus, LUMINOSO e LAMPEGGIO scelgono la CLUT, quindi il selettore CLUT ha
una sola casella, che mantiene la CLUT di ogni cella.

### Modalità di disegno

La modalità di disegno cambia ciò che fa un tratto. Si conserva tra le sessioni,
per cui la barra di stato la mostra ogni volta che è diversa da Normale: in
alcune di queste modalità un tratto non lascia nulla di visibile, e altrimenti
non avresti modo di capire perché.

La barra in alto ha tre pulsanti: **Modalità di disegno**, **Strumento cella** e
**Specchio**. Ognuno mostra la scelta in vigore. Fai clic e sotto si apre una
piccola griglia delle altre scelte; fai clic su una e la griglia si chiude.
Premi Esc, o fai clic altrove, per chiuderla senza cambiare nulla. Modalità di
disegno e specchio lavorano insieme: con XOR e Orizzontale, un tratto è un
tratto XOR riflesso. Lo strumento cella, quando ce n'è uno attivo, prende in
carico ogni tratto.

{{draw-modes}}

Il pennello in tutte le sue forme, il riempimento, le forme, la curva di Bézier,
il testo, i timbri del pannello **Timbri** e il tasto sinistro del gradiente
seguono la modalità di disegno. La gomma, il contagocce, spostare, incollare ed
eliminare una selezione, il pannello **Trasformazione**, l’opzione **Riempi solo
attributi** e i pulsanti Scambia e Ricolora la ignorano.

**Ricolora inchiostro non è la stessa cosa di Ricolora.** Ricolora inchiostro e
Ricolora carta sono modalità di disegno: ricolorano ogni cella toccata dallo
strumento attuale - poche con un pennello piccolo, tutte quelle coperte da un
rettangolo pieno - e lo specchio si applica. **Ricolora**, nel pulsante
Strumento cella, ricolora l'intera cella sotto il puntatore qualunque sia lo
strumento, ignorando dimensione del pennello e specchio. **Scambia**, dallo
stesso pulsante, funziona allo stesso modo e scambia Inchiostro e Carta di ogni
cella. Entrambi restano attivi finché non li spegni - scegli Nessuno, sceglilo
di nuovo, fai clic destro sull'area di disegno o scegli uno strumento o una
modalità di disegno - e la barra di stato lo dice finché è attivo.

**Solo attributi** è la terza di queste modalità di disegno. Dà a ogni cella
toccata dallo strumento attuale Inchiostro, Carta, Luminosità e Lampeggio tutti
insieme e non disegna alcun pixel, come ZX Paintbrush con il disegno dei pixel
spento. Ognuna delle quattro parti impostata su **usa esistente** resta com'è in
ogni cella: con la Carta su esistente fa ciò che fa Ricolora inchiostro, con
l'Inchiostro su esistente ciò che fa Ricolora carta. Come in quelle, i due
pulsanti fanno la stessa cosa, ed è offerta solo nelle modalità schermo le cui
celle hanno attributi.

**Copia attributi, Inverti pixel e Inverti pixel e attributi** sono altri tre
strumenti cella nello stesso pulsante Strumento cella e funzionano allo stesso
modo: scegline uno, poi fai clic o trascina sulle celle. Ogni trascinamento si
annulla in un passo e lo strumento resta attivo finché non lo spegni. **Copia
attributi** prende gli attributi che mostra la cella sotto il tuo primo clic e
li dà a ogni cella su cui trascini; la barra dei colori non cambia. **Inverti
pixel** trasforma i pixel d'inchiostro di ogni cella intera in pixel di carta e
i pixel di carta in inchiostro, e lascia gli attributi (una cella vuota viene
riempita). **Inverti pixel e attributi** scambia anche Inchiostro e Carta, così ogni cella ha lo stesso aspetto; serve a
riordinare un'immagine importata, salta le celle in cui disegna anche un altro
livello e non è offerto in ULAplus né ULANext. Uno strumento cella è offerto
solo nelle modalità schermo in cui può funzionare: il pulsante Strumento cella
elenca solo quelli validi (ed è nascosto dove nessuno lo è), e Inverti pixel
funziona anche in Timex Hi-res, dove i pixel sono in celle da 8 per 8.

**XOR / Sopra e XOR / Ogni passaggio** invertono i pixel, da inchiostro a carta
e da carta a inchiostro, invece di disegnare pixel d'inchiostro, ed entrambi
danno alla cella gli attributi scelti. XOR / Sopra inverte ogni pixel una volta
per tratto, quindi ripassare sulla tua linea nello stesso tratto non cambia
altro. XOR / Ogni passaggio inverte un pixel ogni volta che il tratto ci passa
sopra: una passata del pennello è un passaggio, per quanto il pennello si
sovrapponga a se stesso lungo la strada, ma un tratto che lascia un pixel e poi
ci torna lo inverte di nuovo, così un otto si annulla dove si incrocia. Forme,
curve, riempimenti e testo sono sempre un solo passaggio, quindi con questi le
due modalità danno lo stesso risultato.

**Inverso** scambia ciò che fanno i due pulsanti del mouse: il sinistro disegna
pixel di carta e il destro pixel d'inchiostro, come INVERSE 1 del BASIC. Si attiva nelle Preferenze, oppure con Maiusc+I, e la barra di stato dice “Inverso
attivo” finché lo è. Non cambia nulla in Ricolora inchiostro, Ricolora carta,
Solo attributi e nelle due modalità XOR, dove i due pulsanti fanno la stessa cosa, e la barra di
stato lo dice. Il testo e i timbri disegnano le loro lettere e forme in pixel di
carta invece che in pixel d'inchiostro, un motivo posa i suoi pixel d'inchiostro
come pixel di carta e i suoi pixel di carta come inchiostro, e il riempimento
riempie di pixel di carta col sinistro e di pixel d'inchiostro col destro. La gomma, Scambia e Ricolora lo ignorano. Viene ricordato tra le
sessioni e salvato nei preset insieme alla modalità di disegno.

**Nucleo di attributi.** Per il pennello tondo e quadrato, i contorni delle
forme e la curva di Bézier, Nucleo di attributi dice quanta parte di una linea
spessa prende gli attributi della cella. Una linea disegna sempre tutti i suoi
pixel d'inchiostro. Con Nucleo di attributi su 1 pixel o 4 pixel, solo le celle
sotto il centro della linea, una linea di quella larghezza che ne segue il
centro, prendono i tuoi attributi; le altre celle sotto di essa ricevono i pixel
d'inchiostro con gli attributi che avevano già, così una linea spessa si
scontra con meno celle. Tutta la linea, l'impostazione predefinita, dà i tuoi
attributi a ogni cella toccata dalla linea. L'opzione compare solo nelle
modalità schermo con attributi di cella. Con Specchio la linea riflessa ha un
nucleo proprio, e con XOR le celle fuori dal nucleo mantengono i loro attributi.

### Tavolozze

Due famiglie di modalità permettono di cambiare i colori stessi. ULAplus offre
64 registri di colore, organizzati come quattro tavolozze da sedici. Le
modalità Next offrono 256 colori da nove bit ciascuno.

Le tavolozze sono file. Puoi crearne una, salvarla e caricarla in un’altra
immagine, da **File > Carica tavolozza** e **File > Salva tavolozza** o
dall’editor di tavolozze. Non serve aprire l’editor per caricarne una, perché di
solito una tavolozza si carica prima di iniziare a disegnare.

Dove un formato di file ha spazio per una tavolozza – `.scr` da 6976 byte,
`.nxi`, la variante Timex – la tavolozza viaggia anche dentro l’immagine.

**Posizioni della tavolozza.** La tavolozza ULAplus e la tavolozza Next hanno quattro posizioni ciascuna, in Immagine > Tavolozza (Posizione 1 – Posizione 4). La posizione in uso è spuntata, e l'editor della tavolozza dice quale modifica. Un nuovo documento parte dalla Posizione 1, e le altre contengono la tavolozza predefinita finché non le usi. Scegliere un'altra posizione cambia i colori con cui l'immagine è mostrata e non cambia mai gli attributi dell'immagine. Ogni scelta è un passo di annullamento. Le posizioni sono salvate in un progetto e nel backup automatico, ma solo dopo che ne hai usata una; un'immagine aperta da un altro tipo di file parte dalla Posizione 1 e le altre contengono copie della sua tavolozza. Le esportazioni .scr, .tap e immagine usano sempre la posizione in uso. Le modalità a tavolozza fissa (ULA standard, le modalità Multicolor, GigaScreen e le modalità Timex) non hanno posizioni.

**Inverti tavolozza** (solo ULAplus) scambia la metà Inchiostro (voci 0-7) con la metà Carta (voci 8-15) di ciascuna delle quattro CLUT, in un passo di annullamento; farlo due volte riporta la tavolozza com'era. Per invertire un'immagine ULAplus in modo che resti uguale, usa Inverti tavolozza e poi Immagine > Attributi > Inverti. Il bordo segue la metà Carta della CLUT 0 e quindi cambia colore anche lui. Le modalità Next non hanno l'inversione della tavolozza, perché ULANext tiene l'Inchiostro in 8 voci di tavolozza e la Carta in 32.

**Tasti CLUT.** Nelle modalità ULAplus, Ctrl+Maiusc+1 – Ctrl+Maiusc+4 scelgono la CLUT 0-3, come la scelta della CLUT nella barra dei colori. Nelle altre modalità la barra di stato lo dice e non succede altro.

**Colori standard.** In Impostazioni > Preferenze, Colori standard permette di cambiare i 15 colori che mostrano le modalità Standard, Multicolor, GigaScreen e Timex. Il nero brillante è sempre nero. I colori cambiano ciò che vedi e ciò che contengono le esportazioni di immagini (PNG, GIF, BMP, JPG); non cambiano mai i byte dei file .scr o .tap, e l'importazione di un'immagine continua a confrontarsi con i colori originali dello Spectrum, così la stessa foto dà la stessa immagine su ogni macchina. Le tavolozze ULAplus e Next sono separate. OK applica i colori, Annulla non conserva nulla e Ripristina standard rimette gli originali. Sono conservati in questo browser, non nel progetto. Carica .pal legge un file di colori standard di ZX Paintbrush (256 byte) e Salva .pal ne scrive uno, che è il modo per portare i tuoi colori in un altro browser.

**Nastri della tavolozza.** File > Salva tavolozza come TAP scrive la tavolozza ULAplus come nastro di 176 byte. Caricato su uno Spectrum con `LOAD ""` imposta le 64 voci della tavolozza e poi carica il file successivo sul nastro, così un nastro di tavolozza può stare davanti a un nastro di immagine o di gioco. File > Carica tavolozza e File > Apri leggono i nastri di tavolozza: quelli di PixULA e quelli di ZX Paintbrush. Un nastro di tavolozza entra nella posizione di tavolozza in uso con un passo di annullamento e non diventa il file aperto.

### GigaScreen

GigaScreen conserva due schermi completi e li mostra alternandoli, cinquanta
volte al secondo. L’occhio fonde i due colori di ogni pixel in uno, quindi una
cella con un Inchiostro e una Carta su ogni schermo può mostrare **quattro**
colori, e l’immagine intera arrivare a circa cento.

Non disegni mai su un solo schermo. Ogni tratto scrive su entrambi, e la barra
dei colori lavora a coppie:

- **Schermo A** e **Schermo B** hanno ciascuno i propri campioni di Inchiostro
  e Carta e il proprio **LUMINOSO**. Il lampeggio è un’impostazione unica per
  entrambi.
- **Dipingi** mostra i quattro colori che risultano da queste scelte, mescolati
  esattamente come li mostra l’area di disegno: Inchiostro su entrambi gli
  schermi, Inchiostro solo su A, Inchiostro solo su B e Carta su entrambi.
  Scegline uno e il tasto sinistro dipinge con quello. Il tasto destro dipinge
  sempre Carta su entrambi gli schermi.
- Scegli lo stesso Inchiostro per entrambi gli schermi e il campione in alto a
  sinistra di Dipingi è quel colore, puro: è così che si disegna tutto ciò che
  non deve sembrare mescolato.

Il contagocce riprende tutto questo: gli attributi di entrambi gli schermi e quale
dei quattro mostra il pixel.

I pulsanti di visualizzazione cambiano solo ciò che mostra l’area di disegno,
mai dove va un tratto. **Media** è ciò che l’occhio vede sulla macchina reale.
**Sfarfallio** scambia i due schermi a ogni fotogramma, come fa l’hardware.
**A** e **B** mostrano uno schermo da solo. Un’immagine salvata o esportata in
PNG usa Media quando è mostrato Sfarfallio, perché un’immagine fissa non può
sfarfallare.

Entrare in GigaScreen copia l’immagine su entrambi gli schermi, quindi appare
come prima. Uscirne mantiene lo schermo A e scarta lo schermo B, e vieni
avvisato prima se lo schermo B contiene qualcosa di diverso.

Lo stesso modo di lavorare vale per altre due modalità a sfarfallio:

- **MultiGigaScreen 8×4, 8×2 e 8×1** mettono i due schermi sulle celle
  Multicolor più fini, quindi i quattro colori valgono per 4, 2 o una sola
  riga invece che per blocco 8 per 8. Sono i file `.mg4`, `.mg2` e `.mg1` di
  MultiArtist.
- **Timex alta risoluzione GigaScreen** alterna due schermi ad alta risoluzione
  da 512 per 192. L’alta risoluzione non ha attributi di cella – ogni schermo ha
  uno schema di colori per tutta l’immagine – quindi la barra mostra una riga
  di schemi per lo Schermo A e una per lo Schermo B, e Dipingi mostra le
  quattro combinazioni dei due. Sono file `.hrg`.

Passare da una modalità a due schermi all’altra mantiene entrambi gli schermi,
con le stesse regole con cui si converte uno schermo singolo.

### Attributi

Le voci Attributi del menu Immagine cambiano gli attributi delle celle e
lasciano i pixel dove sono. Inverti scambia Inchiostro e Carta in ogni cella e
mantiene Luminosità e Lampeggio. Cancella scrive Inchiostro, Carta,
Luminosità e Lampeggio correnti in ogni cella; le caselle «usa esistente»
conservano ciò che la cella ha già. Capovolgi orizzontalmente e Capovolgi
verticalmente specchiano gli attributi delle celle. Ogni comando agisce sulla
selezione (tutte le celle toccate) o sull'intera immagine se non c'è selezione,
e si annulla con un solo passo. Le voci sono disattivate nelle modalità senza
attributi di cella (Timex Hi-res, Layer 2, LoRes), mentre un timbro senza attributi propri è fluttuante e
su un livello bloccato.

Cambia... trova le celle in base ai loro attributi e le sostituisce. Trova indica quali celle selezionare: ogni campo è un valore o Qualsiasi. Sostituisci con indica come diventano: ogni campo è un valore o Mantieni. La finestra mostra quante celle cambieranno prima di premere OK, e OK si annulla con un solo passo. Su GigaScreen ci sono un gruppo per lo Schermo A e uno per lo Schermo B; in ULAplus, CLUT 0-3 prende il posto di Luminoso e Lampeggio. Annulla non cambia nulla.

### Pixel

Le voci Pixel del menu Immagine modificano i pixel e lasciano gli attributi nelle loro celle. Capovolgi orizzontale e Capovolgi verticale specchiano i pixel. Inverti pixel e attributi inverte i pixel e scambia anche Inchiostro e Carta di ogni cella, così l'immagine resta uguale. Non è offerto nelle modalità senza attributi di cella (Layer 2, LoRes, Timex Hi-res) ed è grigio mentre un timbro è in sospeso. In ULAplus e ULANext non è offerto nemmeno, perché scambiare Inchiostro e Carta cambierebbe l'aspetto dell'immagine.

La scelta Sposta nella sezione Sposta del pannello Trasforma stabilisce cosa si muove. Pixel e attributi (predefinito) sposta intere celle con la loro Carta. Solo pixel sposta i pixel di un pixel o di una cella alla volta. Solo attributi sposta gli attributi di cella una cella alla volta. Il pad ha anche le diagonali. Mentre un timbro è in sospeso, Sposta è grigio, perché uno spostamento muove l'intero timbro.

Con una selezione attiva, le frecce seguono la stessa scelta Sposta.

### Timbri

Quando un timbro è attivo, il pannello **Trasforma** mostra come viene messo.

**Attributi** sceglie tra Solo pixel e Attributi propri. Solo pixel mette i pixel del timbro con gli attributi della barra degli attributi, come sempre. Attributi propri mette gli attributi che il timbro porta, cella per cella: un timbro dell'Editor mappe, o uno copiato da un'immagine in una modalità con attributi di cella. Un timbro copiato dall'immagine parte come Solo pixel, così un incolla cade esattamente come prima. Attributi propri posa il timbro su celle intere, ignora la modalità di disegno, la barra dei colori e l'interruttore XOR, e non si può ridimensionare, ruotare, curvare, ribaltare, invertire o contornare; il pannello li rende grigi e dice perché. Cambiare la forma di un timbro Solo pixel scarta gli attributi che portava. Inverso scambia ancora ciò che fanno i pixel d'inchiostro e di carta. Se le celle del timbro hanno una dimensione diversa da quella della modalità schermo attuale, è possibile solo Solo pixel.

**Trasparenza** (solo con Attributi propri) lascia trasparire l'attributo già presente sulla pagina al posto di quello del timbro. Inchiostro, Carta, Luminosità e Lampeggio hanno ciascuno una casella. ULAplus ha una casella CLUT per Luminosità e Lampeggio insieme. In GigaScreen ogni casella copre entrambi gli schermi.

**Pixel di carta** decide cosa fanno i pixel di carta del timbro. Lascia lo sfondo lascia stare il disegno sotto (un timbro con attributi propri ricolora comunque la Carta sotto, salvo che la Carta traspaia). Cancella lo sfondo rende anche il disegno sotto pixel di carta, su tutto il rettangolo del timbro. Le modalità di disegno senza opposto (XOR, Ricolora inchiostro, Ricolora carta) e l'interruttore XOR del timbro lasciano stare i pixel di carta, e il pannello lo dice. Pixel di carta è disponibile in ogni modalità schermo, anche senza attributi di cella.

**Converti in solo pixel** scarta per sempre gli attributi del timbro e tiene i suoi pixel. La scelta Solo pixel in Attributi li conserva, così si può tornare indietro. Ogni modifica è un passo di annullamento.

Finché è attivo un timbro con attributi propri, i comandi Immagine > Attributi (Inverti, Cancella, i due Capovolgi e Cambia...) agiscono sulle celle del timbro invece che sull'immagine, sia che fluttui sia che sia riposto. Ignorano la selezione e non toccano mai i pixel del timbro, e una cella che il timbro non copre resta com'è. Capovolgi specchia le celle di attributi del timbro mentre i suoi pixel restano dove sono. Un timbro GigaScreen ha un solo gruppo di attributi per entrambi gli schermi, quindi la finestra Cambia mostra un solo gruppo. Ogni comando è un passo di annullamento. Con un timbro senza attributi propri restano disattivati.
