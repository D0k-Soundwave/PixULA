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

{{tools}}
