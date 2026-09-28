## Méthodes de travail

Quelques tâches courantes, du début à la fin.

### Votre première image

1. Ouvrez `PixULA.html`. Vous commencez en ULA standard avec un écran vierge
   de 256 sur 192.
2. Activez la grille de cellules, à côté des commandes de zoom, pour voir les
   blocs de 8 sur 8 dans lesquels la couleur est stockée.
3. Choisissez une couleur d’encre dans la barre de couleurs ou avec les
   touches 1 à 8, et une couleur de papier par un clic droit sur une pastille.
4. Dessinez avec le **Pinceau**. Bouton gauche pour l’encre, droit pour le
   papier.
5. Zoomez avec `+` et `-`. Maintenez la barre d’espace et faites glisser pour
   vous déplacer, ou utilisez l’outil **Déplacer la vue**.
6. `Ctrl+Z` annule. `Ctrl+S` enregistre un projet `.pixula`, qui garde vos
   calques et réglages en plus de l’image.

Poser vos zones de couleur avant les détails fait en général gagner du
travail, car une limite de couleur qui ne tombe pas sur une limite de cellule
continuera de changer des couleurs que vous aviez déjà fixées.

### Décalquer une photo

1. Ouvrez le panneau **Référence** et chargez votre photo. Elle se place
   derrière votre dessin avec l’opacité, la position et l’échelle que vous
   choisissez, et ne fait jamais partie de l’image enregistrée.
2. Dessinez par-dessus sur un calque normal.
3. Si la référence paraît un jour moins nette que l’original, le panneau le
   signale et propose un bouton **Localiser la photo**. PixULA fait un lien
   vers le fichier sur le disque : si la photo est déplacée, il ne reste
   qu’un petit aperçu.

### Convertir une photo

Pour laisser PixULA faire la conversion :

1. **Fichier > Charger**, et choisissez un `.png`, `.jpg` ou `.gif`.
2. La fenêtre d’import montre trois conversions côte à côte : Net, Doux et
   Plat. Laquelle rend le mieux dépend entièrement de la photo ; il vaut donc
   la peine de comparer les trois à chaque fois.
3. Réglez la luminosité, le contraste et la mise à l’échelle jusqu’à ce que
   l’aperçu soit lisible, puis validez.

En ULAplus et dans les modes Next, la palette est construite à partir de votre
image : vous n’êtes pas limité aux seize couleurs de l’ULA. Cela fait
généralement une grande différence.

### Créer une police

1. **Fichier > Éditeur de police**.
2. Partez de la police ZX ROM, ou importez un jeu `.ch8` ou `.chr`.
3. Choisissez un caractère et modifiez-le. Des largeurs de 4, 6 et 8 pixels
   sont disponibles, mais rétrécir supprime définitivement les colonnes de
   droite : si vous faites des essais, partez du plus étroit.
4. Donnez un nom à la police pour l’ajouter à votre bibliothèque.
5. Choisissez l’outil **Texte**. Votre police apparaît dans sa liste à côté de
   la police ROM. Tapez, placez le texte, puis mettez-le à l’échelle ou
   faites-le pivoter avant de valider – il est redessiné à partir des glyphes
   au fur et à mesure et reste net à toute taille.

### Construire une carte à partir de tuiles

1. Dessinez sur la zone de dessin les cellules que vous voulez utiliser comme
   tuiles.
2. **Fichier > Éditeur de cartes**, et capturez-les dans le jeu de tuiles.
3. Réglez la taille de la carte et peignez. Le bouton gauche place une tuile,
   le droit efface, et le remplissage remplace une zone connexe de tuiles
   identiques.
4. Exportez en `.zxtm` pour continuer à travailler, ou en assembleur, C ou
   binaire brut pour l’utiliser dans un programme.

### Dessiner pour le ZX Spectrum Next

1. Choisissez un mode Next dans le menu Image – Layer 2 en 256, 320 ou 640 de
   large, ou l’un des modes LoRes.
2. Il n’y a pas de conflit d’attributs dans ces modes ; chaque pixel porte son
   propre index de palette. Ce que vous gérez, c’est une palette de 256
   couleurs de neuf bits, modifiée par **Image > Modifier la palette** et
   enregistrée en `.pal` ou `.npl`.
3. Enregistrez l’image en `.nxi`, qui contient la palette, ou en `.sl2` pour
   le bitmap brut.
4. Pour les sprites, utilisez **Fichier > Éditeur de sprites** et enregistrez
   la planche en `.spr`.

Vous pouvez convertir une image classique vers un mode Next et inversement. Le
retour oblige à ramener chaque cellule à deux couleurs : attendez-vous à
perdre des détails dans ce sens ; PixULA vous prévient avant de le faire.

### Mettre une image sur une vraie machine

- **Pour un émulateur**, enregistrez un `.scr`. C’est le contenu brut de la
  mémoire écran du Spectrum, et tous les émulateurs le lisent. La taille
  exacte dépend du mode d’écran – le tableau du chapitre sur les modes d’écran
  la donne pour chacun.
- **Pour une vraie machine**, enregistrez un `.tap` ou un `.tzx`. Pour ajouter
  votre écran à une cassette qui contient déjà d’autres fichiers, utilisez
  **Fichier > Blocs de cassette**.
- **Pour montrer l’image à quelqu’un sans Spectrum**, enregistrez un `.png`.
