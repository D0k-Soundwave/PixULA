## Il colore

Nelle modalità classiche non scegli un colore per un pixel. Scegli i due colori
che userà un’intera cella, più due indicatori.

- **INCHIOSTRO** è il colore dei punti accesi.
- **CARTA** è il colore dei punti spenti.
- **LUMINOSO** porta entrambi alla loro versione più chiara. C’è un solo
  indicatore di luminosità per cella, quindi inchiostro e carta sono luminosi
  insieme o per niente.
- **LAMPEGGIO** scambia inchiostro e carta circa due volte al secondo
  sull’hardware reale.

Il tasto sinistro del mouse disegna con l’inchiostro. Il destro disegna con la
carta: spegne il punto e imposta gli stessi quattro valori del sinistro. Su una
penna, il pulsante laterale fa ciò che fa il tasto destro.

La **gomma** fa qualcosa di diverso da entrambi. Spegne i punti e lascia
intatti i colori della cella, anche quando cancella l’ultimo punto della cella.
Per cancellare anche i colori, ripassa sulla cella vuota con un nuovo tratto:
inchiostro, carta, luminoso e lampeggio tornano a nero su bianco, e su un
livello superiore la cella torna trasparente. Una cella che contiene ancora dei
punti mantiene i suoi colori per quante volte tu ci passi sopra.

### Modalità di disegno

La modalità di disegno cambia ciò che fa un tratto, e vale per ogni strumento.
Si conserva tra le sessioni, per cui la barra di stato la mostra ogni volta che
è diversa da Normale: in alcune di queste modalità un tratto non lascia nulla
di visibile, e altrimenti non avresti modo di capire perché.

{{draw-modes}}

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

### GigaScreen

GigaScreen conserva due schermi completi e li mostra alternandoli, cinquanta
volte al secondo. L’occhio fonde i due colori di ogni pixel in uno, quindi una
cella con un inchiostro e una carta su ogni schermo può mostrare **quattro**
colori, e l’immagine intera arrivare a circa cento.

Non disegni mai su un solo schermo. Ogni tratto scrive su entrambi, e la barra
dei colori lavora a coppie:

- **Schermo A** e **Schermo B** hanno ciascuno i propri campioni di inchiostro
  e carta e il proprio **LUMINOSO**. Il lampeggio è un’impostazione unica per
  entrambi.
- **Dipingi** mostra i quattro colori che risultano da queste scelte, mescolati
  esattamente come li mostra l’area di disegno: inchiostro su entrambi gli
  schermi, inchiostro solo su A, inchiostro solo su B e carta su entrambi.
  Scegline uno e il tasto sinistro dipinge con quello. Il tasto destro dipinge
  sempre carta su entrambi gli schermi.
- Scegli lo stesso inchiostro per entrambi gli schermi e il campione in alto a
  sinistra di Dipingi è quel colore, puro: è così che si disegna tutto ciò che
  non deve sembrare mescolato.

Il contagocce riprende tutto questo: i colori di entrambi gli schermi e quale
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
  da 512 per 192. L’alta risoluzione non ha colori di cella – ogni schermo ha
  uno schema di colori per tutta l’immagine – quindi la barra mostra una riga
  di schemi per lo Schermo A e una per lo Schermo B, e Dipingi mostra le
  quattro combinazioni dei due. Sono file `.hrg`.

Passare da una modalità a due schermi all’altra mantiene entrambi gli schermi,
con le stesse regole con cui si converte uno schermo singolo.
