## Bien démarrer

PixULA est un éditeur de pixel art pour le ZX Spectrum et le ZX Spectrum Next.
Il fonctionne dans un navigateur, depuis un dossier sur votre propre disque,
sans installation, sans serveur et sans connexion Internet.

Décompressez le dossier où vous voulez et double-cliquez sur `PixULA.html`.
C’est toute l’installation. Rien n’est écrit hors de ce dossier sans que vous
le demandiez, et rien de ce que vous dessinez ne quitte votre machine.

### La chose à savoir d’abord

Le Spectrum ne peut pas mettre n’importe quelle couleur n’importe où. Il stocke
votre image comme un bitmap d’un bit par pixel, recouvert d’une grille de
couleur séparée et bien plus grossière, et seules deux couleurs sont
disponibles dans chaque bloc de 8 sur 8. Ce seul fait détermine le
comportement de chaque outil ici, et c’est le sujet du chapitre suivant.

### S’y retrouver

![La fenêtre de PixULA : barre de menus, barre des modes, barre d’outils, barre de couleurs, zone de dessin, panneaux et barre d’état](img/workspace.png)

*La fenêtre entière.*

- **La barre de menus** tout en haut : les fichiers, l’édition, l’affichage,
  les calques, l’image elle-même, les paramètres et l’aide.
- **La barre des modes** juste dessous : modes de dessin, miroir et bordure.
- **La barre d’outils** à gauche, avec Annuler et Rétablir en haut.
- **La barre de couleurs** à côté, avec la palette du mode d’écran en cours.
- **La zone de dessin** au milieu.
- **Les panneaux** à droite : calques, options d’outil, transformation, image
  de référence, préréglages.
- **La barre d’état** en bas, qui indique le mode d’écran, le mode de dessin
  et si le toucher dessine.

![La barre d’outils](img/tool-rail.png)

*La barre d’outils. Annuler et Rétablir sont en haut ; les outils en dessous
sont regroupés selon ce qu’ils font à l’image.*

![La barre de couleurs](img/colour-rail.png)

*La barre de couleurs : ENCRE à gauche, PAPIER à droite, avec LUMINEUX et
CLIGNOTANT au-dessus.*

![La barre des modes](img/colour-bar.png)

*La barre des modes : modes de dessin, miroir et couleur de bordure.*

![Les panneaux latéraux](img/panels.png)

*Les panneaux. Chacun se replie, pour ne garder ouverts que ceux que vous
utilisez.*

![La barre d’état](img/status-bar.png)

*La barre d’état, qui affiche les réglages dont dépend l’effet de votre
prochain trait.*

La barre d’outils n’a pas d’étiquettes – il n’y a pas la place à côté des
boutons. Survolez une commande pour voir son nom, et restez dessus pour lire
une phrase d’explication. Sur une tablette, appuyez longuement ; cet appui ne
change pas d’outil pour autant.

### Sur une tablette

Tenez la tablette à l’horizontale. PixULA utilise la même fenêtre sur tablette
que sur ordinateur, et à la verticale il n’y a pas assez de largeur pour la
zone de dessin à côté des panneaux : le programme vous demande donc de
tourner l’appareil. Sur un petit écran, toute l’interface rétrécit pour tenir,
jamais en dessous d’une taille qu’un doigt peut encore toucher, et la taille de
l’interface choisie revient sur un écran plus grand. Avec une souris ou un pavé
tactile branché, la tablette est traitée comme un ordinateur et s’utilise dans
les deux sens.
