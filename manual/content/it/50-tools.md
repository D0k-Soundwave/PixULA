## Gli strumenti

La barra raggruppa gli strumenti in base a ciò che fanno all’immagine: prima
tutto ciò che stende inchiostro, poi la selezione, poi la guida resa possibile
dalla selezione, poi gli strumenti che collocano un disegno finito e infine
quelli che cambiano solo la tua vista.

La modalità di disegno, lo specchio e la guida valgono per tutti questi
strumenti, quindi si impostano una volta nella barra delle modalità invece di
comparire nelle opzioni di ogni strumento.

![Il pannello Opzioni strumento con le impostazioni del pennello](img/tool-options-brush.png)

*Le opzioni dello strumento selezionato compaiono in questo pannello: qui, il
pennello.*

Il pennello non ha un mirino sull’immagine. Dalla dimensione 2 in su, il
contorno dell’area che dipingerà è il puntatore. Alla dimensione 1 il puntatore
è una piccola croce larga tre pixel, e il punto al centro è il pixel che il
pennello dipingerà, nel colore in cui lo dipingerà: il tuo inchiostro con
LUMINOSO applicato, o l’inchiostro della cella quando l’inchiostro è impostato
su «usa il colore esistente». Mentre disegni, il punto mostra ciò che hai
appena dipinto. Sopra l’area grigia intorno all’immagine torna il puntatore
normale. Spray, Sfumatura, Motivo e Tratteggio funzionano allo stesso modo.

Molte opzioni valgono solo in combinazione con un’altra. Le tabelle sotto hanno
una colonna **Visibile se** con la condizione in cui compare ogni riga; le
righe segnate «sempre» ci sono qualunque sia il resto delle impostazioni.

**Figure a punti.** L'elenco Forme ha un gruppo Figure, disegnate mettendo dei punti: Polilinea, Poligono, Triangolo, Raggi, Linea perpendicolare e Linea parallela (il tasto L sceglie lo strumento Figura). Clicca per aggiungere un punto, o premi e trascina per un tratto libero. Doppio clic o Invio termina la figura, che resta sull'immagine come anteprima ancora modificabile; Invio ancora la disegna, in un solo passo di annullamento. Backspace toglie l'ultimo punto (un tratto libero intero alla volta), Esc scarta la figura senza disegnarla, e cliccare altrove o scegliere un altro strumento la disegna. Il Triangolo, la Linea perpendicolare e la Linea parallela finiscono da soli al terzo punto: trascina la prima linea, poi clicca l'ultimo punto. Una Linea perpendicolare aggiunge una seconda linea dal piede della perpendicolare del tuo punto sulla prima linea; una Linea parallela aggiunge una copia della prima con il tuo punto al centro. Raggi collega ogni punto successivo al primo. Il Poligono e il Triangolo si possono riempire. Le figure seguono la modalità di disegno, Inverso, le caselle «usa esistente», la simmetria e la guida di disegno come ogni forma, e l'anteprima è esattamente come saranno disegnate.

**Stile linea, Rotazione e Arrotondamento.** Lo strumento Forma, lo strumento Figura e la curva di Bézier condividono uno Stile linea: Continua, Tratteggiata, Punteggiata, Tratto-punto, Tratto-punto-punto e Nessuna. Gli stili a tratti si disegnano solo su una linea di un pixel, quindi sono disattivati oltre lo spessore 1; il motivo segue il contorno, anche negli angoli, e ogni raggio o linea di una figura comincia il proprio. Nessuna non disegna il contorno: usala con Riempito per disegnare solo l'interno. La curva di Bézier non ha Nessuna. Rotazione (da -180 a 180 gradi, in senso orario) ruota un rettangolo, un quadrato, un rettangolo arrotondato, un'ellisse o un parallelogramma attorno al centro del loro riquadro, e ruota un arco, un settore, un triangolo, un rombo o un poligono regolare attorno al punto premuto. Arrotondamento regola quanto sono tondi gli angoli del rettangolo arrotondato, da angoli netti a 0 a estremità semicircolari a 100. Una curva di Bézier che stai ancora modificando viene disegnata quando scegli un altro strumento, ed Esc la scarta. L'anteprima di una forma o curva mostra le copie speculari e resta dentro la guida di disegno, come il disegno finito.

**Modificare, spostare, ruotare e clonare una figura.** Una figura finita e una curva di Bézier restano sull'immagine come anteprima finché non le disegni. Finché aspettano, puoi trascinare uno qualsiasi dei loro punti quadrati per cambiarne la forma, trascinare la figura per spostarla, trascinare la manopola rotonda sopra di essa per ruotarla e usare le frecce per muoverla (di un pixel, o di una cella con Maiusc o con l'aggancio alla griglia). Ctrl+Z annulla l'ultima di queste modifiche, poi la figura stessa e solo dopo l'immagine. Invio, un clic altrove, il salvataggio o la scelta di un altro strumento la disegnano, con un solo passo di annullamento. Una forma dello strumento Forma normalmente si disegna appena rilasci; spunta **Mantieni modificabile** nelle sue opzioni e aspetta come una figura, con una maniglia a ogni estremità del trascinamento. **Modifica > Clona l'ultima figura** (Maiusc+C) apre una copia dell'ultima figura, forma o curva disegnata, pronta da spostare, ruotare o cambiare; per cambiare i colori o lo stile di linea di una già disegnata, premi Ctrl+Z e poi Clona l'ultima figura. Finché una figura aspetta, segue i colori, lo stile di linea e il riempimento che scegli, come il disegno finito. La curva di Bézier fa eccezione: si modifica con le sue maniglie e si sposta con le frecce, ma non si può trascinare intera né ruotare, e Ctrl+Z scarta l'intera curva in un colpo solo.

**Spray a motivo.** Imposta la Distribuzione dello spray su **Motivo** e invece dei punti disporrà piccole figure intere - cerchi, quadrati o brevi trattini. Scegli la figura, la sua dimensione e se è piena o solo contorno; il Flusso dice quanta area cercano di coprire. Nell'area dello spray vengono disposte solo figure intere, quindi uno spray troppo piccolo per una figura non disegna nulla.

**L'aggancio e il suo passo.** L'aggancio (il pulsante sotto la tela, o Maiusc+S) fa cadere selezioni, forme, punti di figura, testo e pezzi incollati su una griglia; il disegno a mano libera non viene mai agganciato. L'elenco accanto al pulsante imposta la griglia: la cella di attributi della modalità (8x8, o 8x4, 8x2 o 8x1 nelle modalità multicolor), 16x16, uno schermo intero 256x192 (solo su una tela più grande di uno schermo, come Layer 2 320 e 640) o il tuo passo, di cui imposti larghezza e altezza nelle Preferenze, sotto Disegno. Scegliere un passo attiva anche l'aggancio. Un pezzo incollato cade con l'angolo in alto a sinistra sulla griglia. Con l'aggancio attivo le frecce spostano di un passo una figura in attesa, un pezzo fluttuante o l'estremo del gradiente; una selezione che porta i suoi colori si sposta del passo arrotondato a celle intere. ZX Paintbrush con la tastiera sposta pixel per pixel qualunque sia il suo salto di raster, quindi qui è diverso di proposito.

**Dimensioni della selezione.** Con la selezione rettangolare, l'elenco **Dimensione** sceglie cosa seleziona un trascinamento. Libera è un rettangolo di qualunque dimensione. Cella seleziona le celle di attributi intere che tocca. 16x16, Schermo (256x192, su una tela più grande di uno schermo) e Personalizzata (una larghezza e altezza di blocco che imposti tu) selezionano blocchi interi di quella dimensione: un clic prende un blocco, un trascinamento tutti quelli che raggiunge. I blocchi Cella stanno sulla griglia delle celle; gli altri blocchi iniziano dove premi il mouse o, con l'aggancio attivo, sulla cella di aggancio in cui hai premuto. Un blocco non supera mai il bordo dell'immagine. Con l'aggancio attivo, un trascinamento Libero da un punto di aggancio all'altro seleziona esattamente la distanza tra i due.

{{tools}}
