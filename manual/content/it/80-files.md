## File

Ci sono due cose diverse che puoi salvare, ed è importante scegliere quella
giusta.

**Un progetto** conserva il lavoro come l’hai lasciato: ogni livello, la
tavolozza, la modalità schermo, i tuoi strumenti e le loro impostazioni,
l’immagine di riferimento e il punto che stavi guardando. È un file `.pixula`,
scritto da **File > Salva progetto**, ed è quello da usare finché un’immagine è
in lavorazione.

**Un’immagine** è un solo schermo appiattito in un formato che un altro
programma comprende: un `.scr` per un emulatore, un `.png` da mostrare, un
`.tap` da caricare sull’hardware reale. Li scrive **File > Salva immagine con
nome**. Contengono l’immagine e nient’altro, che è ciò che vuoi quando consegni
il risultato, e non ciò che vuoi se intendi continuare a lavorarci.

### Importare un'immagine

Aprendo una foto o un'altra immagine (PNG, JPG, GIF) si vedono affiancate tre conversioni - Nitida, Morbida e Piatta - e si clicca su quella che piace. La Morbida è quella che trasforma le sfumature in punti, e l'elenco **Dithering** sotto le anteprime sceglie come: il predefinito è il Floyd-Steinberg proprio dell'importazione, e l'elenco offre anche gli altri 30 metodi di ZX Paintbrush - soglie, diffusione dell'errore, matrici di Bayer, punti raggruppati e supercelle. Scegliere un metodo passa all'anteprima Morbida. I metodi ordinati proseguono attraverso le celle di attributi, così il motivo corre su tutta l'immagine; la diffusione dell'errore resta dentro ogni cella, perché ogni cella ha i suoi due colori. Nelle modalità Layer 2 e LoRes l'elenco è disattivato: quelle modalità mantengono il proprio dithering a colori.

### Salvare una parte di un'immagine

**File > Salva selezione come** elenca gli stessi formati di Salva immagine come, ciascuno aperto solo se la selezione gli si addice. PNG, BMP e JPEG accettano qualunque rettangolo. ZXP, SEV, ZED, ASM, C, BIN e ATR accettano celle di attributi intere: la selezione viene prima adattata alle celle e la barra di stato lo dice. ColorTiles accetta tessere intere da 16x16. I formati che sono un dump di uno schermo intero (SCR, nastri, MLT e simili) sono aperti solo quando la selezione è lo schermo intero. ASM, C, BIN e ATR scrivono la parte riga per riga: la bitmap come blocco di byte per riga, dall'alto in basso, e gli attributi un byte per cella; lo fanno nelle modalità classica, multicolor e ULAplus. Una selezione a mano libera o ellittica salva il suo rettangolo di contenimento. Un formato chiuso dice perché quando lo indichi. Salva immagine come salva l'immagine intera e ignora la selezione.

### Una nuova immagine da una selezione

**Modifica > Nuova immagine dalla selezione** trasforma la selezione nell'immagine intera. La selezione viene prima adattata a celle intere. Chiede prima di fare qualcosa, e Ctrl+Z restituisce la vecchia immagine. Tutti i livelli restano, ritagliati a quel blocco, che passa in alto a sinistra; il resto è vuoto, e lo sfondo lì è carta bianca. La modalità schermo resta la stessa e l'immagine diventa senza titolo, così il Salva successivo chiede un nome.

### Salvataggio automatico e backup

PixULA può salvare il lavoro nella memoria del browser ogni pochi minuti e
riproportelo se una sessione finisce male. È disattivato finché non scegli la
frequenza: imposta **Salvataggio automatico ogni (minuti, 0 = disattivato)**
nelle Preferenze, sotto Generale.

Puoi anche scegliere una cartella sul disco, e ogni salvataggio automatico vi
scriverà una versione numerata: `picture V1.pixula`, `picture V2.pixula` e così
via. La numerazione viene riletta dalla cartella ogni volta, quindi riaprire
un’immagine continua la sequenza invece di ripartire da V1, e due sessioni
sulla stessa immagine condividono un’unica serie di versioni. Imposta quante
conservarne nelle Preferenze; il valore predefinito è 20.

Una cosa da sapere. Un browser non riapre una cartella scelta in una sessione
precedente senza la tua conferma, e il timer del salvataggio automatico non può
chiederla al posto tuo. Quindi il primo backup dopo un ricaricamento si ferma e
ti aspetta. Le Preferenze hanno un pulsante **Riprendi i backup**, e premerlo è
la conferma che il browser aspetta.

{{formats}}
