## Fichiers

Il y a deux choses différentes à enregistrer, et il importe de choisir la
bonne.

**Un projet** conserve votre travail tel que vous l’avez laissé : chaque
calque, la palette, le mode d’écran, vos outils et leurs réglages, l’image de
référence et l’endroit que vous regardiez. C’est un fichier `.pixula`, écrit
par **Fichier > Enregistrer le projet**, et c’est ce qu’il faut utiliser tant
qu’une image est en cours.

**Une image** est un seul écran aplati dans un format qu’un autre programme
comprend – un `.scr` pour un émulateur, un `.png` à montrer, un `.tap` à
charger sur une vraie machine. **Fichier > Enregistrer l’image sous** les
écrit. Ils ne contiennent que l’image, ce qu’il faut pour transmettre le
résultat, mais pas si vous comptez continuer à travailler dessus.

### Importer une image

L'ouverture d'une photo ou d'une autre image (PNG, JPG, GIF) montre trois conversions côte à côte - Nette, Douce et Plate - et vous cliquez sur celle qui vous plaît. La Douce est celle qui transforme les teintes en pixels d'encre et de papier, et la liste **Tramage** sous les aperçus choisit comment : par défaut c'est le Floyd-Steinberg propre à l'import, et la liste propose aussi les 30 autres méthodes de ZX Paintbrush - seuils, diffusion d'erreur, matrices de Bayer, points groupés et supercellules. Choisir une méthode redessine Doux, et aussi Net dès que vous en avez choisi une (Plat n'est jamais tramé). Les méthodes ordonnées se poursuivent d'une cellule d'attributs à l'autre, de sorte que la trame court sur toute l'image ; la diffusion d'erreur reste dans chaque cellule, car chaque cellule a ses deux couleurs. Dans les modes Layer 2 et LoRes la liste fonctionne aussi : chaque pixel est placé entre ses deux couleurs de palette les plus proches et toute l'image est un seul bloc, donc la diffusion d'erreur parcourt toute l'image.

### Enregistrer une partie d'une image

**Fichier > Enregistrer la sélection sous** liste les mêmes formats que Enregistrer l'image sous, chacun ouvert seulement si la sélection lui convient. PNG, BMP et JPEG acceptent n'importe quel rectangle. ZXP, SEV, ZED, ASM, C, BIN et ATR acceptent des cellules d'attributs entières : la sélection est d'abord ajustée aux cellules et la barre d'état le dit. ColorTiles accepte des tuiles entières de 16x16. Les formats qui sont un vidage d'un écran entier (SCR, cassettes, MLT et semblables) ne sont ouverts que si la sélection est l'écran entier. ASM, C, BIN et ATR écrivent la partie ligne par ligne : la bitmap en bloc d'octets par ligne, de haut en bas, et les attributs un octet par cellule ; ils le font dans les modes classique, multicolore et ULAplus. Une sélection à main levée ou elliptique enregistre son rectangle englobant. Un format fermé dit pourquoi quand on le pointe. Enregistrer l'image sous enregistre toute l'image et ignore la sélection.

### Une nouvelle image depuis une sélection

**Édition > Nouvelle image depuis la sélection** fait de la sélection l'image entière. La sélection est d'abord ajustée aux cellules entières. Elle demande avant d'agir, et Ctrl+Z rend l'ancienne image. Tous les calques sont gardés et découpés à ce bloc, qui passe en haut à gauche ; le reste est vide, et le fond y est du Papier blanc. Le mode d'écran reste le même et l'image devient sans titre, si bien que l'enregistrement suivant demande un nom.

### Enregistrement automatique et sauvegardes

PixULA peut enregistrer votre travail dans le stockage du navigateur toutes
les quelques minutes et vous le proposer si une session se termine mal. C’est
désactivé tant que vous n’avez pas choisi la fréquence : réglez
**Enregistrement auto toutes les (minutes, 0 = désactivé)** dans les
Préférences, sous Général.

Vous pouvez aussi choisir un dossier sur le disque, et chaque enregistrement
automatique y écrira une version numérotée – `picture V1.pixula`,
`picture V2.pixula`, etc. La numérotation est relue dans le dossier à chaque
fois : rouvrir une image continue la série au lieu de repartir de V1, et deux
sessions sur la même image partagent une même série de versions. Réglez le
nombre à conserver dans les Préférences ; la valeur par défaut est 20.

Une chose à savoir. Un navigateur ne rouvre pas un dossier choisi lors d’une
session précédente sans votre confirmation, et la minuterie de
l’enregistrement automatique ne peut pas la demander à votre place. La
première sauvegarde après un rechargement s’arrête donc et vous attend. Les
Préférences ont un bouton **Reprendre les sauvegardes**, et cliquer dessus est
la confirmation qu’attend le navigateur.

{{formats}}
