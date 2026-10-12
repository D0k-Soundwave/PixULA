## Les outils

La barre regroupe les outils selon ce qu’ils font à l’image : d’abord tout ce
qui pose de l’encre, puis la sélection, puis le guide que la sélection rend
possible, puis les outils qui placent un dessin terminé, et enfin ceux qui ne
changent que votre vue.

Le mode de dessin, le miroir et le guide s’appliquent à tous ces outils ; ils
se règlent donc une fois dans la barre des modes au lieu d’apparaître dans les
options de chaque outil.

![Le panneau Options d’outil montrant les réglages du pinceau](img/tool-options-brush.png)

*Les options de l’outil choisi apparaissent dans ce panneau – ici, le
pinceau.*

Le pinceau n’a pas de réticule sur l’image. À partir de la taille 2, le
contour de la zone qu’il va peindre est le pointeur. À la taille 1, le
pointeur est une petite croix de trois pixels, et le point en son centre est
le pixel que le pinceau va peindre, dans la couleur qu’il va peindre : votre
encre avec LUMINEUX appliqué, ou l’encre existante de la cellule quand
l’encre est réglée sur « utiliser la couleur existante ». Pendant que vous
dessinez, le point montre ce que vous venez de peindre. Au-dessus de la zone
grise autour de l’image, le pointeur normal revient. Les outils Aérographe,
Dégradé, Motif et Hachures fonctionnent de la même façon.

Beaucoup d’options ne s’appliquent qu’en combinaison avec une autre. Les
tableaux ci-dessous ont une colonne **Visible si** donnant la condition
d’affichage de chaque ligne ; les lignes marquées « toujours » sont présentes
quel que soit le reste.

**Figures à points.** La liste des Formes a un groupe Figures, tracées en plaçant des points : Polyligne, Polygone, Triangle, Rayons, Ligne perpendiculaire et Ligne parallèle (la touche L choisit l'outil Figure). Cliquez pour ajouter un point, ou appuyez et glissez pour un tracé libre. Un double-clic ou Entrée termine la figure, qui reste sur l'image comme un aperçu encore modifiable ; Entrée de nouveau la dessine, en une seule étape d'annulation. Retour arrière retire le dernier point (un tracé libre entier à la fois), Échap abandonne la figure sans la dessiner, et cliquer ailleurs ou choisir un autre outil la dessine. Le Triangle, la Ligne perpendiculaire et la Ligne parallèle se terminent seuls au troisième point : glissez la première ligne, puis cliquez le dernier point. Une Ligne perpendiculaire ajoute une seconde ligne depuis le pied de la perpendiculaire de votre point sur la première ligne ; une Ligne parallèle ajoute une copie de la première avec votre point en son milieu. Rayons relie chaque point suivant au premier. Le Polygone et le Triangle peuvent être remplis. Les figures suivent le mode de dessin, Inverse, les cases « utiliser l'existant », la symétrie et le guide de dessin comme toute forme, et l'aperçu est exactement ce qui sera dessiné.

**Style de ligne, Rotation et Arrondi.** L'outil Forme, l'outil Figure et la courbe de Bézier partagent un Style de ligne : Pleine, Tirets, Pointillé, Tiret-point, Tiret-point-point et Aucune. Les styles à tirets ne se tracent que sur une ligne d'un pixel, ils sont donc grisés au-delà de l'épaisseur 1 ; le motif suit le contour, y compris les coins, et chaque rayon ou ligne d'une figure commence le sien. Aucune ne trace pas de contour : utilisez-la avec Rempli pour ne tracer que l'intérieur. La courbe de Bézier n'a pas Aucune. Rotation (de -180 à 180 degrés, dans le sens horaire) fait tourner un rectangle, un carré, un rectangle arrondi, une ellipse ou un parallélogramme autour du milieu de leur boîte, et fait tourner un arc, un secteur, un triangle, un losange ou un polygone régulier autour du point où vous avez appuyé. Arrondi règle la rondeur des coins du rectangle arrondi, de coins carrés à 0 à des bouts en demi-cercle à 100. Une courbe de Bézier que vous modifiez encore est dessinée quand vous choisissez un autre outil, et Échap l'abandonne. L'aperçu d'une forme ou d'une courbe montre les copies en miroir et reste dans le guide de dessin, comme le dessin terminé.

**Modifier, déplacer, tourner et cloner une figure.** Une figure terminée et une courbe de Bézier restent sur l'image comme aperçu jusqu'à ce que vous les dessiniez. Tant qu'elles attendent, vous pouvez glisser n'importe lequel de leurs points carrés pour les déformer, glisser la figure pour la déplacer, glisser la poignée ronde au-dessus pour la tourner, et utiliser les flèches pour la déplacer (d'un pixel, ou d'une cellule avec Maj ou avec l'aimantation à la grille). Ctrl+Z annule la dernière de ces modifications, puis la figure elle-même, et seulement ensuite l'image. Entrée, un clic ailleurs, l'enregistrement ou le choix d'un autre outil la dessine, en une seule étape d'annulation. Une forme de l'outil Forme se dessine normalement dès que vous relâchez ; cochez **Garder modifiable** dans ses options et elle attend comme une figure, avec une poignée à chaque bout du glissement. **Édition > Cloner la dernière figure** (Maj+C) ouvre une copie de la dernière figure, forme ou courbe dessinée, prête à être déplacée, tournée ou modifiée ; pour changer les couleurs ou le style de ligne d'une figure déjà dessinée, appuyez sur Ctrl+Z puis sur Cloner la dernière figure. Tant qu'une figure attend, elle suit les couleurs, le style de ligne et le remplissage choisis, comme le dessin terminé. La courbe de Bézier fait exception : on la modifie par ses poignées et on la déplace avec les flèches, mais on ne peut ni la faire glisser en entier ni la tourner, et Ctrl+Z abandonne toute la courbe d'un coup.

**Spray à motif.** Réglez la Répartition de l'aérosol sur **Motif** et il pose de petites figures entières - cercles, carrés ou traits courts - au lieu de points. Choisissez la figure, sa taille et si elle est pleine ou juste un contour ; le Débit dit quelle part de la zone elles cherchent à couvrir. Seules des figures entières sont posées dans la zone, donc un spray trop petit pour une figure ne dessine rien.

**L'aimantation et son pas.** L'aimantation (le bouton sous la toile, ou Maj+S) fait tomber les sélections, formes, points de figure, texte et morceaux collés sur une grille ; le dessin à main levée n'est jamais aimanté. La liste à côté du bouton règle la grille : la cellule d'attributs du mode (8x8, ou 8x4, 8x2 ou 8x1 dans les modes multicolores), 16x16, un écran entier de 256x192 (seulement sur une toile plus grande qu'un écran, comme Layer 2 320 et 640) ou votre propre pas, dont vous réglez la largeur et la hauteur dans les Préférences, sous Dessin. Choisir un pas active aussi l'aimantation. Un morceau collé tombe avec son coin supérieur gauche sur la grille. L'aimantation active, les flèches déplacent d'un pas une figure en attente, un morceau flottant ou l'extrémité du dégradé ; une sélection qui porte ses couleurs se déplace du pas arrondi en cellules entières. ZX Paintbrush déplace au clavier pixel par pixel quel que soit son saut de trame, donc ceci diffère volontairement.

{{tools}}
