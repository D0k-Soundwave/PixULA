## Le conflit d’attributs

Le Spectrum conserve une image en deux parties distinctes.

La première est un bitmap : 256 sur 192 points, un bit chacun, allumé ou
éteint. La seconde est une grille de couleur, un octet pour chaque bloc de 8
sur 8 de ces points – 32 octets en largeur et 24 en hauteur. Chacun de ces
octets indique la couleur de l’**encre** (les points allumés), celle du
**papier** (les points éteints), si la paire est **lumineuse** et si elle doit
**clignoter**.

La forme de votre image a donc une résolution de 256 sur 192, et sa couleur
une résolution de 32 sur 24. Chaque cellule de 8 sur 8 peut afficher deux
couleurs, et chaque point à l’intérieur a l’une ou l’autre.

![Deux lignes diagonales se croisent sur une zone de dessin agrandie avec la grille de cellules affichée. La ligne bleue devient rouge dans chaque cellule que traverse aussi la ligne rouge](img/attribute-clash.png)

*Une ligne bleue et une ligne rouge qui se croisent, à 800 % avec la grille de
cellules. Là où la ligne rouge traverse une cellule, la ligne bleue de cette
cellule est rouge aussi. Le trait rouge est arrivé en second et a fixé la
couleur d’encre de toute la cellule, y compris les points déjà posés par le
trait bleu.*

C’est ce qu’on appelle le « conflit d’attributs » (*attribute clash*). Dessiner
dans une partie d’une cellule change la couleur de tout le reste de la cellule,
et aucun réglage ne le désactive – c’est ainsi que fonctionne le matériel.

### Faire avec

La plupart des graphistes Spectrum planifient leurs zones de couleur avant les
détails, en disposant l’image pour que les limites de couleur tombent sur les
limites de cellules. Quand une cellule a besoin d’une nuance qu’elle ne peut
pas contenir, ils recourent au tramage : deux couleurs entrelacées assez finement pour que
l’œil les mélange.

PixULA vous aide de trois manières.

**La grille de cellules.** Activez-la à côté des commandes de zoom et vous
voyez exactement où un changement de couleur est gratuit et où il vous
coûtera.

**Les modes de dessin.** Un trait n’est pas obligé de changer à la fois les
points et les couleurs. Vous pouvez poser des points sans toucher aux
couleurs, ou recolorer une cellule sans toucher un seul point. Le chapitre sur
la couleur les énumère.

**La bibliothèque de motifs.** Son cœur est une série de motifs à densités
d’encre mesurées – ce qu’il vous faut quand une cellule a besoin d’un gris
qu’elle ne peut pas contenir.

### Là où les règles changent

Le matériel ultérieur a assoupli la contrainte de diverses façons, et PixULA
sait travailler avec toutes. Les machines Timex ont affiné la grille de
couleur. ULAplus a remplacé les seize couleurs fixes par une palette de votre
choix. GigaScreen alterne deux images assez vite pour suggérer des couleurs
qu’aucune des deux ne contient. Le ZX Spectrum Next abandonne complètement ce
système dans ses modes Layer 2 et LoRes, où chaque pixel porte sa propre
couleur.

Vous pouvez faire passer une image de l’un à l’autre – voir le chapitre
suivant.
