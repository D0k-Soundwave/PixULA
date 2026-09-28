## Les éditeurs

Quatre choses que fait PixULA ne sont pas des images, et chacune a sa propre
fenêtre dans le menu Fichier.

### L’éditeur de police

Un jeu de caractères Spectrum compte 96 ou 256 glyphes, chacun stocké comme
une pile d’octets de ligne. Cet éditeur les modifie un glyphe à la fois.

![L’éditeur de police, avec la grille des glyphes d’un côté et un caractère en cours d’édition de l’autre](img/dialog-font-editor.png)

*Choisissez un caractère dans la grille à gauche et modifiez-le à droite.*

Les glyphes peuvent faire 4, 6 ou 8 pixels de large sur la hauteur de la
cellule. Rétrécir une police supprime définitivement les colonnes de droite :
si vous essayez des largeurs, allez du plus étroit au plus large.

Vous pouvez partir de la police ZX ROM, capturer un glyphe depuis la zone de
dessin, ou charger un jeu `.ch4`, `.ch6`, `.ch8`, `.chr` ou `.chx` d’un autre
outil Spectrum. Nommer une police l’ajoute à votre bibliothèque, et l’outil
Texte la propose alors à côté de la police ROM intégrée.

### L’éditeur de cartes

Une carte est une grille de tuiles, une tuile étant une cellule de 8 sur 8 –
huit octets de bitmap et un octet d’attribut. Les cartes permettent de
construire un terrain de jeu plus grand qu’un seul écran.

![L’éditeur de cartes, avec la palette de tuiles et une zone de carte défilante](img/dialog-map-editor.png)

*Les tuiles à gauche, la carte à droite.*

Peignez avec le bouton gauche et effacez avec le droit, ou utilisez le
remplissage pour remplacer une zone connexe de tuiles identiques. Les tuiles
viennent du motif et des couleurs en cours, ou directement de la zone de
dessin. Vous pouvez rendre une carte sur la zone de dessin, et une seule
annulation défait le tout.

Enregistrez en `.zxtm` pour continuer à travailler – c’est le format propre à
PixULA et il garde tout –, ou en `.zxm`, ou en assembleur, C ou binaire brut à
intégrer dans un programme.

### L’éditeur de sprites

Les sprites Next font 16 sur 16 pixels avec un index de palette par pixel, et
une planche en contient jusqu’à 64.

![L’éditeur de sprites, avec une planche de sprites et la grille d’édition](img/dialog-sprite-editor.png)

*La planche d’un côté, le sprite que vous dessinez de l’autre.*

Les planches de sprites sont conservées dans des fichiers `.spr`, pas dans
votre image : enregistrez donc la planche séparément. Dans les modes indexés,
vous pouvez capturer un sprite depuis la zone de dessin et en tamponner un
dessus.

### L’éditeur de palette

**Image > Modifier la palette**, dans les modes qui ont une palette
modifiable. Il montre ULAplus sous forme de quatre palettes de seize et la
palette Next en rangées de couleurs de neuf bits. Toute couleur choisie est
ramenée à la valeur la plus proche que le matériel peut réellement stocker :
ce que vous voyez est ce que la machine affichera.

Chaque modification est une étape d’annulation distincte. Les palettes peuvent
aussi être chargées et enregistrées sans ouvrir cette fenêtre – voir le
chapitre sur la couleur.

### Blocs de cassette

**Fichier > Blocs de cassette** ouvre un `.tap` ou un `.tzx` et liste son
contenu. Servez-vous-en pour charger un écran d’une cassette qui en contient
plusieurs, ou pour ajouter votre image actuelle à une cassette comme nouveau
bloc et réenregistrer la cassette.

Les blocs que vous n’avez pas touchés sont réécrits octet pour octet : ajouter
un écran à la cassette de quelqu’un d’autre laisse le reste exactement tel
qu’il était.
