## La couleur

Dans les modes classiques, vous ne choisissez pas une couleur pour un pixel.
Vous choisissez les deux couleurs qu’utilisera toute une cellule, plus deux
indicateurs.

- **ENCRE** est la couleur des points allumés.
- **PAPIER** est la couleur des points éteints.
- **LUMINEUX** fait passer les deux à leur version plus claire. Il n’y a qu’un
  indicateur lumineux par cellule : encre et papier sont lumineux ensemble ou
  pas du tout.
- **CLIGNOTANT** échange encre et papier environ deux fois par seconde sur le
  vrai matériel.

Le bouton gauche de la souris dessine à l’encre. Le bouton droit dessine au
papier : il éteint le point et fixe les mêmes quatre valeurs que le bouton
gauche. Sur un stylet, le bouton latéral fait ce que fait le bouton droit.

La **gomme** fait autre chose que les deux. Elle éteint des points et laisse
les couleurs de la cellule intactes, même quand elle efface le dernier point
de la cellule. Pour effacer aussi les couleurs, repassez sur la cellule vide
avec un nouveau trait : encre, papier, lumineux et clignotant reviennent à noir
sur blanc, et sur un calque supérieur la cellule redevient transparente. Une
cellule qui contient encore des points garde ses couleurs, quel que soit le
nombre de passages de gomme.

### Modes de dessin

Le mode de dessin change l’effet d’un trait, et s’applique à tous les outils.
Il est conservé d’une session à l’autre ; la barre d’état l’affiche donc dès
qu’il vaut autre chose que Normal – dans certains de ces modes un trait ne
laisse rien de visible, et vous n’auriez sinon aucun moyen de savoir pourquoi.

{{draw-modes}}

### Palettes

Deux familles de modes permettent de changer les couleurs elles-mêmes. ULAplus
vous donne 64 registres de couleur, organisés en quatre palettes de seize. Les
modes Next vous donnent 256 couleurs de neuf bits chacune.

Les palettes sont des fichiers. Vous pouvez en créer une, l’enregistrer et la
charger dans une autre image, par **Fichier > Charger une palette** et
**Fichier > Enregistrer la palette** ou depuis l’éditeur de palette. Inutile
d’ouvrir l’éditeur pour en charger une : on charge généralement une palette
avant de commencer à dessiner.

Quand un format de fichier a de la place pour une palette – `.scr` à 6976
octets, `.nxi`, la variante Timex –, la palette voyage aussi dans l’image.

### GigaScreen

GigaScreen conserve deux écrans complets et les affiche en alternance,
cinquante fois par seconde. L’œil mélange les deux couleurs de chaque pixel en
une seule : une cellule avec une encre et un papier sur chaque écran peut donc
afficher **quatre** couleurs, et l’image entière atteindre une centaine.

Vous ne dessinez jamais sur un seul écran. Chaque trait écrit les deux, et la
barre de couleurs fonctionne par paires :

- **Écran A** et **Écran B** ont chacun leurs propres pastilles d’encre et de
  papier et leur propre **LUMINEUX**. Le clignotement est un réglage commun
  aux deux.
- **Peindre** montre les quatre couleurs que donnent ces choix, mélangées
  exactement comme les montre la zone de dessin : encre sur les deux écrans,
  encre sur A seulement, encre sur B seulement, et papier sur les deux.
  Choisissez-en une et le bouton gauche peint avec. Le bouton droit peint
  toujours le papier sur les deux écrans.
- Choisissez la même encre pour les deux écrans et la pastille en haut à
  gauche de Peindre est cette couleur, pure – c’est ainsi qu’on dessine ce qui
  ne doit pas paraître mélangé.

La pipette récupère tout cela : les couleurs des deux écrans et laquelle des
quatre le pixel affiche.

Les boutons d’affichage ne changent que ce que montre la zone de dessin,
jamais la destination d’un trait. **Moyenne** est ce que l’œil voit sur la
vraie machine. **Scintillement** échange les deux écrans à chaque trame, comme
le fait le matériel. **A** et **B** montrent un écran seul. Une image
enregistrée ou exportée en PNG utilise Moyenne quand Scintillement est
affiché, car une image fixe ne peut pas scintiller.

Passer en GigaScreen copie votre image sur les deux écrans : elle a le même
aspect qu’avant. En sortir garde l’écran A et abandonne l’écran B, et vous
êtes averti avant si l’écran B contient quelque chose de différent.

La même façon de travailler couvre deux autres modes à scintillement :

- **MultiGigaScreen 8×4, 8×2 et 8×1** placent les deux écrans sur les cellules
  Multicolor plus fines : les quatre couleurs valent pour 4, 2 ou une seule
  ligne au lieu d’un bloc de 8 sur 8. Ce sont les fichiers `.mg4`, `.mg2` et
  `.mg1` de MultiArtist.
- **Timex haute résolution GigaScreen** alterne deux écrans haute résolution
  de 512 sur 192. La haute résolution n’a pas de couleurs de cellule – chaque
  écran a un seul schéma de couleurs pour toute l’image –, la barre affiche
  donc une rangée de schémas pour l’Écran A et une pour l’Écran B, et Peindre
  montre les quatre mélanges des deux. Ce sont les fichiers `.hrg`.

Passer d’un mode à deux écrans à un autre conserve les deux écrans, selon les
mêmes règles que la conversion d’un écran simple.
