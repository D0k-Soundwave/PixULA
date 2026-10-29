## Animation

PixULA anime de deux façons. Une **animation d'écran** change toute l'image
d'une image à l'autre. Une **animation de sprite** en change un bloc, un
personnage qui marche ou un drapeau qui flotte, pendant que le reste de l'image
reste immobile derrière. Les deux respectent chaque règle du mode d'écran : une
image est faite de cellules d'attributs entières, elle ne coupe donc jamais les
attributs d'une cellule.

### Commencer une animation

![Le menu Animation](img/menu-animation.png)

![La boîte de dialogue Nouvelle animation de sprite](img/dialog-new-sprite.png)

**Animation > Nouvelle animation d'écran** fait de l'image l'image 1. Chaque
calque devient animé : il a son propre contenu dans chaque image.

**Animation > Nouvelle animation de sprite...** demande un nom, une largeur et
une hauteur, une position et le nombre d'images de départ. La taille est
arrondie aux cellules entières du mode, et le dialogue indique ce qu'elle est
devenue : en mode 8x1, 20 x 20 devient 24 x 20. Utiliser la sélection reprend la
taille et la place d'une sélection. Pour placer le sprite d'un clic,
sélectionnez d'abord le bloc avec l'outil Sélection (Taille : Personnalisée).
**Nouvelle animation de sprite depuis la sélection** déplace aussi le bloc
sélectionné sur le calque du sprite comme image 1. Un trait pointillé juste à
l'extérieur de sa fenêtre montre où il se trouve.

Une image peut contenir plusieurs animations ; le sélecteur en haut du panneau
Animation choisit celle qui est ouverte. Le mode d'écran ne peut pas changer
tant que l'image a des animations.

### Les images

![Le panneau Animation avec les six images d'une balle qui rebondit](img/animation-panel.png)

Le panneau Animation montre chaque image en petit, avec son numéro et son
délai. Cliquez sur l'une pour y aller, ou appuyez sur `,` et `.` pour l'image
d'avant et d'après. Vous dessinez sur l'image affichée avec chaque outil,
exactement comme sur une image fixe : conflit d'attributs, modes de dessin,
Miroir, tampons, Flash et Annuler marchent comme toujours.

Ajouter place une image vide après celle affichée, Dupliquer une copie ;
Supprimer, Gauche et Droite la suppriment et la déplacent. Le délai est le
temps que l'image reste à l'écran, en images du Spectrum de 1/50 s, et Pour
toutes donne ce délai à chaque image. Pour emporter une partie d'une image dans
la suivante, copiez-la (**Animation > Image en tampon** copie la fenêtre d'un
sprite), allez à l'image suivante et posez le tampon. Annuler une étape faite
sur une autre image vous ramène à cette image.

**Animation > Tampons en images** fait une nouvelle image de chaque tampon de
la liste Tampons, posé là où il est garé ; les tampons restent.

### Les calques dans une animation

![Le panneau Calques avec un calque animé, un calque partagé et les deux calques d'aperçu de la pelure d'oignon](img/animation-layers.png)

Tant qu'une animation est ouverte, chaque ligne du panneau Calques a un
interrupteur Animé / Partagé. Un calque animé a son propre contenu dans chaque
image ; un calque partagé est le même dans chaque image, comme un décor dessiné
une fois. Rendre un calque animé le copie dans chaque image ; le rendre partagé
garde l'image affichée, après confirmation. Les nouveaux calques rejoignent
l'animation ouverte, et Fusionner vers le bas, Fusionner la sélection et
Aplatir agissent sur chaque image.

### Lecture

Lecture (Entrée) joue l'animation ouverte sur l'image ; un sprite se déplace sur
son décor, et le FLASH et le scintillement GigaScreen continuent. Première,
Précédente, Suivante et Dernière parcourent les images (maintenez Précédente ou
Suivante pour continuer), et Arrêt revient à l'image de départ. Un clic sur
l'image ou Échap met en pause. Répétition joue les images en boucle, une fois ou
en aller-retour. Vitesse joue plus vite ou plus lentement sans changer les
délais, et Lire les images ne joue qu'une partie de l'animation.

### Décalquer des images

**Calquer** sous une image affiche cette image estompée pendant que vous
dessinez les autres, comme calque d'aperçu dans le panneau Calques.
L'interrupteur **Pelure d'oignon** affiche de même l'image d'avant et celle
d'après, et elles vous suivent quand vous changez d'image. **Calque > Nouveau
calque d'aperçu** en ajoute une seule.

Un calque d'aperçu suit la règle du système de calques : ses pixels de papier
et ses cellules vides sont transparents, l'encre des calques au-dessus le
recouvre, et il s'affiche estompé sur ce qui est dessous. Montez-le ou
descendez-le pour le mettre au-dessus ou au-dessous du calque où vous dessinez.
Chacun a sa propre opacité, une teinte (images précédentes en rouge, suivantes
en bleu) et l'affichage ou le masquage, et le supprimer n'enlève que l'aperçu.
Un aperçu ne fait jamais partie de l'image : on ne dessine jamais dessus, il
n'est jamais fusionné ni exporté, et il est masqué pendant la lecture.

### Exporter

**Animation > Exporter l'animation** :

- **Écrans numérotés...** enregistre chaque image comme son propre écran
  Spectrum, numéroté dans l'ordre (`walk_001.scr`, `walk_002.scr` et ainsi de
  suite), dans tout format d'écran que le mode sait enregistrer. Chaque fichier
  est exactement ce qu'Enregistrer l'image sous écrit pour cette image. Vous
  choisissez le nom, le premier numéro, les chiffres et les images. Si le
  navigateur peut écrire dans un dossier, vous en choisissez un ; sinon les
  écrans arrivent en un seul `.zip`.
- **GIF animé** joue les images avec leurs délais, FLASH et GigaScreen compris.
- **Planche de sprites PNG** met les images côte à côte, 16 par rangée.
- **SevenuP, toutes les images** écrit jusqu'à 32 images dans un `.sev` (mode
  standard). Ouvrir un `.sev` de plusieurs images en fait une animation de
  sprite.
- **Cassette** écrit un SCREEN$ par image dans un `.tap` ou un `.tzx`. Elle
  contient les écrans, pas un programme pour les jouer.
- **Sprites Next** écrit une animation de sprite 16 x 16 des modes Layer 2 et
  LoRes en planche `.spr`.

Les animations sont enregistrées dans les projets PixULA, dans l'enregistrement
de récupération et dans les sauvegardes.
