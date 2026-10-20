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

**Grandes polices.** Nouvelle grande police... crée un jeu de grandes polices CHX, comme celui qu'utilise ZX-Editor Second Edition : chaque caractère fait 8, 16, 24 ou 32 pixels de large et de haut (largeur et hauteur se choisissent séparément), et l'éditeur affiche la taille à la place de la liste des largeurs. Cochez Remplir avec une police pour choisir n'importe quelle police de la même liste que l'outil Texte, la part de la hauteur du caractère que couvrent les lettres (en pourcentage) et si elles se placent à gauche, au centre ou à droite. Cochez Proportionnelle et chaque lettre n'est enregistrée qu'aussi large que nécessaire, en colonnes entières de 8 pixels, si bien qu'un i prend moins de place qu'un W ; le caractère Espace garde toujours au moins une colonne. Remplir depuis une police... fait la même chose en une seule étape sur une grande police que vous avez déjà. Une grande police ne peut être enregistrée qu'en `.chx` (les autres formats et les listings assembleur, C et binaire contiennent des caractères de 8 sur 8), ne peut pas capturer une cellule de la toile. L'outil Texte et Saisir sur la toile l'utilisent comme toute police enregistrée, chaque lettre de la largeur où elle est enregistrée. Ouvrir un grand `.chx` laisse chaque caractère à sa propre taille, et un caractère que le fichier omet reste omis à l'enregistrement suivant. La façon dont un caractère de plusieurs blocs de 8 sur 8 est disposé dans le fichier suit la description publiée du format et n'a pas été vérifiée sur un fichier enregistré par ZX Paintbrush lui-même ; ouvrez donc dans ZX Paintbrush une grande police faite ici avant de vous y fier.

**Ombrage et annulation.** Pour une police dont les caractères font un nombre entier de colonnes de 8 pixels, les quatre boutons d'ombrage ombrent ou désombrent une colonne à la fois, à gauche ou à droite du caractère que vous modifiez. Une colonne ombrée est dessinée hachurée et n'est pas enregistrée : un fichier `.chx` contient ce caractère plus étroit, et un caractère ombré de part en part est omis du fichier. Les pixels d'encre sous l'ombrage sont conservés dans l'éditeur, si bien que désombrer les ramène, mais ils ne sont pas dans le fichier. Tout ombrer au plus juste le fait pour tous les caractères à la fois : il ombre les colonnes vides de chaque côté de ses pixels d'encre, laisse une colonne à l'Espace et omet les autres caractères vides. Le caractère Espace garde toujours au moins une colonne, car un fichier `.chx` doit le contenir. Après une exportation `.chx`, la ligne d'état indique combien de caractères ont été enregistrés plus étroits, combien ont été omis et combien avaient des pixels d'encre sous l'ombrage. L'éditeur de polices a aussi Annuler et Rétablir (les deux boutons, ou Ctrl+Z et Ctrl+Y) : un tracé sur la surface d'édition est une étape, tout comme chaque bouton, Nouvelle grande police, Remplir depuis une police, Charger la police ROM ou une importation. La saisie dans la zone du nom de la police n'en fait pas partie.

**Tous les caractères.** Le bouton Tous les caractères remplace l'éditeur d'un caractère par une carte de toute la police, tous les caractères côte à côte, 16 par ligne, sur laquelle vous dessinez avec le même Pinceau, la même Gomme, Ligne et Remplissage, si bien qu'un tracé peut passer d'un caractère au suivant. Un tracé est un changement et une étape d'annulation, et le Remplissage reste dans le caractère sur lequel vous cliquez. L'outil Ombrer ombre ou désombre la colonne de 8 pixels sur laquelle vous cliquez, à partir du bord le plus proche de son caractère ; les colonnes ombrées sont hachurées. L'outil Déplacer fait glisser la carte, ce qui permet de la faire défiler au doigt, car la carte garde sinon chaque toucher pour dessiner. Les boutons moins, Ajuster et plus changent le zoom par pas entiers. Dans la carte et dans la grille des caractères, les flèches, Début et Fin passent d'un caractère à l'autre, et taper un caractère le choisit. Il n'est pas possible de dessiner des pixels uniquement au clavier.

**Attributs.** Un caractère d'un fichier `.chx` peut avoir ses propres attributs : chacun de ses blocs de 8 sur 8 a une Encre, un Papier, une Brillance et un Clignotement, et l'éditeur dessine chaque bloc avec eux - dans la grille des caractères, sur la surface d'édition et dans la carte Tous les caractères (une petite marque dans le coin de la surface d'édition indique le Clignotement). Choisissez l'outil Attributs et cliquez sur un bloc pour lui donner l'Encre, le Papier, la Brillance et le Clignotement de la barre d'attributs. Un fichier `.chx` donne des attributs à un caractère entier : le premier clic sur un caractère sans attributs les donne donc à tous ses blocs ; ensuite chaque clic change un bloc. Tous les blocs donne au caractère entier les attributs de la barre, et Retirer les attributs les enlève, si bien que l'outil Texte prend la barre d'attributs pour ce caractère. Chaque clic et chaque bouton est une étape d'Annuler. Les attributs demandent une police dont la largeur est un nombre entier de colonnes de 8 pixels et une barre d'attributs avec Encre et Papier ; en Timex hi-res, Layer 2 et LoRes l'outil dit pourquoi il ne peut pas. Ouvrir un `.chx` garde l'octet d'attributs de chaque bloc et l'enregistrement le réécrit ; un caractère sans attributs est enregistré exactement comme avant. Les autres formats et les listings assembleur, C et binaire ne gardent pas d'attributs, et après un tel export la ligne d'état dit combien de caractères ont perdu les leurs. Comme pour les grandes polices, cette disposition suit la description publiée du format et n'a pas été vérifiée sur un fichier en couleur enregistré par ZX Paintbrush.

### L’éditeur de cartes

Une carte est une grille de tuiles, une tuile étant une cellule de 8 sur 8 –
huit octets de bitmap et un octet d’attribut. Les cartes permettent de
construire un terrain de jeu plus grand qu’un seul écran.

![L’éditeur de cartes, avec la palette de tuiles et une zone de carte défilante](img/dialog-map-editor.png)

*Les tuiles à gauche, la carte à droite.*

Peignez avec le bouton gauche et effacez avec le droit, ou utilisez le
remplissage pour remplacer une zone connexe de tuiles identiques. Les tuiles
viennent du motif et des attributs en cours, ou directement de la zone de
dessin.

Enregistrez en `.zxtm` pour continuer à travailler – c’est le format propre à
PixULA et il garde tout –, ou en `.zxm`, ou en assembleur, C ou binaire brut à
intégrer dans un programme.

### Éléments de carte

**Trouver les parties répétées.** Sélectionnez un bloc de l’image (cellules entières ; la sélection est d’abord ajustée aux cellules) et choisissez Édition > Trouver un élément de carte, ou appuyez sur Ctrl+F comme dans ZX Paintbrush. Le panneau Éléments de carte s’ouvre et chaque endroit où le bloc apparaît est entouré sur l’image ; Précédent et Suivant les parcourent et font défiler l’image jusqu’à chacun. La liste **Correspondance** dit ce que « pareil » veut dire : Pixels et attributs (les pixels et les octets d'attribut sont égaux), Pixels seulement (les attributs sont ignorés) ou Semble identique (les cellules montreraient les mêmes couleurs dans les deux phases du clignotement - une cellule vide correspond à toute cellule vide du même Papier, et une cellule aux pixels inversés avec Encre et Papier échangés correspond à l’original ; en GigaScreen et dans la paire Timex chaque écran est comparé séparément). Le Timex hi-res n’a pas d’attributs de cellule et ne propose donc que les deux derniers. Les endroits qui se chevauchent et ceux qu’un élément précédent couvre déjà sont écartés, et le compte dit combien. **Accepter** enregistre l’élément avec la carte et couvre ses endroits de cases numérotées. Accepter ne change jamais l’image et n’est pas une étape d’annulation - Ctrl+Z laisse l’élément tranquille ; supprimez-le dans le panneau. La recherche fonctionne là où les cellules sont de 8 sur 8 avec des attributs : Standard, ULAplus, ULANext, GigaScreen et Timex hi-res ; ailleurs elle dit pourquoi pas. Ctrl+F n’ouvre plus la recherche propre du navigateur pendant que vous travaillez sur l’image (le menu du navigateur, si). **La liste.** Le panneau Éléments de carte énumère chaque élément avec Afficher (entoure ses emplacements et choisit le suivant à chaque fois) et Supprimer (demande d’abord ; l’image ne change pas). **Maj+M**, ou Affichage > Images des éléments de carte, remplace les cases numérotées par l’image propre de chaque élément, dans les couleurs que montre l’image (une paire GigaScreen est mélangée). Vous pouvez toujours dessiner sur un emplacement couvert ; les traits restent cachés sous la couverture jusqu’à la suppression de l’élément. Nouveau, Ouvrir et Nouvelle image depuis la sélection demandent avant d’abandonner des éléments. **Dans les fichiers.** Les éléments sont enregistrés avec la carte (`.zxtm`), avec un projet (`.pixula`) et avec la sauvegarde automatique de récupération. Fichier > Enregistrer l’image sous > ZXM écrit l’image avec ses éléments, comme ZX Paintbrush (Standard ULA seulement ; les éléments d’un autre mode d’écran sont écartés avec un avis), et Fichier > Ouvrir d’un `.zxm` ramène les deux. Le `.zxm` de l’éditeur de cartes ne contient toujours que sa carte de tuiles. Une recherche ne peut pas commencer sur un bloc qu’un élément précédent couvre déjà : un avis nomme cet élément, et le supprimer libère le bloc. Ctrl+Z après l’ouverture d’une image, ou après Nouvelle image depuis la sélection, ramène l’ancienne image avec ses éléments.

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
