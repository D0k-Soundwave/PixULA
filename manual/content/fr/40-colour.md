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
L'option **Couleurs** de la gomme, visible dans les modes d'écran avec des
couleurs de cellule, change cela : Mettre les actuelles efface les points et
donne à la cellule les couleurs de la barre, comme l'outil d'essuyage de ZX
Paintbrush, et Garder, le réglage par défaut, est le comportement décrit plus
haut.

Chacun des quatre peut aussi être réglé sur **utiliser l'existant** - la case à
damier sous lui dans la barre de couleurs. Un trait laisse alors cette partie de
chaque cellule telle quelle, au lieu d'écrire votre réglage. Mettez ENCRE,
PAPIER et LUMINEUX sur existant et activez CLIGNOTANT : l'option **Remplir les
attributs seulement** de l'outil de remplissage fait alors clignoter toute une
zone sans changer une couleur. Maj+B et Maj+F basculent LUMINEUX et CLIGNOTANT,
et Maj+T met les quatre sur existant. En ULAplus, LUMINEUX et CLIGNOTANT
choisissent la CLUT : le sélecteur de CLUT a donc une seule case, qui garde la
CLUT de chaque cellule.

### Modes de dessin

Le mode de dessin change l’effet d’un trait. Il est conservé d’une session à
l’autre ; la barre d’état l’affiche donc dès qu’il vaut autre chose que Normal –
dans certains de ces modes un trait ne laisse rien de visible, et vous n’auriez
sinon aucun moyen de savoir pourquoi.

La barre du haut a trois boutons : **Mode de dessin**, **Outil de cellule** et
**Miroir**. Chacun montre le choix en vigueur. Cliquez dessus et une petite
grille des autres choix s'ouvre dessous ; cliquez sur l'un d'eux et la grille se
ferme. Appuyez sur Échap, ou cliquez ailleurs, pour la fermer sans rien changer.
Le mode de dessin et le miroir fonctionnent ensemble : avec XOR et Horizontal,
un trait est un trait XOR reflété. L'outil de cellule, quand il est actif, prend
en charge tous les traits.

{{draw-modes}}

Le pinceau sous toutes ses formes, le remplissage, les formes, la courbe de
Bézier, le texte, les tampons du panneau **Tampons** et le bouton gauche du
dégradé suivent le mode de dessin. La gomme, la pipette, le déplacement, le
collage et la suppression d’une sélection, le panneau **Transformation**,
l’option **Remplir les attributs seulement** et les boutons Échanger et
Recolorer l’ignorent.

**Recolorer l'encre n'est pas la même chose que Recolorer.** Recolorer l'encre
et Recolorer le papier sont des modes de dessin : ils recolorent chaque cellule
que touche l'outil actuel - quelques cellules avec un petit pinceau, toutes
celles que couvre un rectangle plein - et le miroir s'applique. **Recolorer**,
dans le bouton Outil de cellule, recolore la cellule entière sous le pointeur
quel que soit l'outil, sans tenir compte de la taille du pinceau ni du miroir.
**Échanger**, du même bouton, fonctionne de même et échange l'encre et le papier
de chaque cellule. L'un comme l'autre reste actif jusqu'à ce que vous le coupiez
- choisissez Aucun, choisissez-le à nouveau, faites un clic droit sur la zone de
dessin ou choisissez un outil ou un mode de dessin - et la barre d'état
l'indique tant qu'il est actif.

**Copier les couleurs, Inverser les points et Inverser points et couleurs** sont
trois outils de cellule de plus dans le même bouton Outil de cellule, et
fonctionnent de la même façon : choisissez-en un, puis cliquez ou glissez sur
des cellules. Chaque glissement s'annule en une étape, et l'outil reste actif
jusqu'à ce que vous le coupiez. **Copier les couleurs** prend les couleurs que
montre la cellule sous votre premier clic et les donne à chaque cellule sur
laquelle vous glissez ; la barre de couleurs ne change pas. **Inverser les
points** efface les points allumés de chaque cellule entière et allume les
effacés, et laisse les couleurs (une cellule vide est remplie). **Inverser
points et couleurs** échange en plus l'encre et le papier, de sorte que chaque
cellule a le même aspect ; il sert à nettoyer une image importée, saute les
cellules où une autre couche dessine aussi, et n'est pas proposé en ULAplus ni
ULANext. Un outil de cellule n'est proposé que dans les modes d'écran où il peut
fonctionner : le bouton Outil de cellule ne liste que ceux qui conviennent (et
est masqué là où aucun ne convient), et Inverser les points fonctionne aussi en
Timex Hi-res, où les points sont dans des cellules de 8 par 8.

**XOR / Superposer et XOR / Chaque passage** inversent les points au lieu de les
poser, et donnent tous deux à la cellule les couleurs choisies. XOR / Superposer
inverse chaque point une fois par trait : repasser sur votre propre ligne dans
le même trait ne change donc plus rien. XOR / Chaque passage inverse un point
chaque fois que le trait passe dessus : un balayage du pinceau compte pour un
passage, même si le pinceau se chevauche en chemin, mais un trait qui quitte un
point puis y revient l’inverse de nouveau, si bien qu’un huit s’annule là où il
se croise. Les formes, les courbes, les remplissages et le texte sont toujours
un seul passage : avec eux, les deux modes donnent le même résultat.

**Inverse** échange ce que font les deux boutons de la souris : le bouton gauche
efface les points et le droit les allume, comme INVERSE 1 en BASIC. On l'active dans les Préférences, ou avec Maj+I, et la barre d'état indique «
Inverse activé » tant qu'il l'est. Il ne change rien dans Recolorer l'encre,
Recolorer le papier et les deux modes XOR, où les deux boutons font la même
chose, et la barre d'état le dit. Le texte et les tampons effacent leurs lettres
et formes au lieu de les allumer, un motif pose ses points comme des effacements
et ses trous comme des points, et le remplissage remplit avec le papier au
bouton gauche et avec l'encre au bouton droit. La gomme, Échanger et Recolorer
l'ignorent. Il est mémorisé entre les sessions et enregistré dans les
préréglages avec le mode de dessin.

**Cœur de couleur.** Pour le pinceau rond et carré, les contours de formes et la
courbe de Bézier, Cœur de couleur dit quelle part d'une ligne épaisse prend les
couleurs de la cellule. Une ligne allume toujours tous ses points. Avec Cœur de
couleur sur 1 pixel ou 4 pixels, seules les cellules sous le milieu de la ligne,
une ligne de cette largeur qui suit son centre, prennent vos couleurs ; les
autres cellules dessous reçoivent les points dans les couleurs qu'elles avaient
déjà, si bien qu'une ligne épaisse heurte moins de cellules. Toute la ligne, le
réglage par défaut, colore chaque cellule que touche la ligne. L'option
n'apparaît que dans les modes d'écran avec des couleurs de cellule. Avec Miroir,
la ligne reflétée a son propre cœur, et avec XOR les cellules hors du cœur
gardent leurs couleurs.

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

**Emplacements de palette.** La palette ULAplus et la palette Next ont chacune quatre emplacements, dans Image > Palette (Emplacement 1 à Emplacement 4). L'emplacement utilisé est coché, et l'éditeur de palette dit lequel il modifie. Un nouveau document démarre sur l'Emplacement 1, et les autres contiennent la palette par défaut jusqu'à ce que vous les utilisiez. Choisir un autre emplacement change les couleurs avec lesquelles l'image est affichée et ne change jamais les attributs de couleur de l'image. Chaque choix est une étape d'annulation. Les emplacements sont enregistrés dans un projet et dans la sauvegarde automatique, mais seulement une fois que vous en avez utilisé un ; une image ouverte depuis un autre type de fichier démarre sur l'Emplacement 1 et les autres contiennent des copies de sa palette. Les exports .scr, .tap et image utilisent toujours l'emplacement en cours. Les modes à palette fixe (ULA standard, les modes Multicolor, GigaScreen et les modes Timex) n'ont pas d'emplacements.

**Inverser la palette** (ULAplus seulement) échange la moitié encre (entrées 0-7) avec la moitié papier (entrées 8-15) de chacune des quatre CLUT, en une étape d'annulation ; le faire deux fois rétablit la palette. Pour inverser une image ULAplus afin qu'elle reste identique, utilisez Inverser la palette puis Image > Attributs > Inverser. La bordure suit la moitié papier de la CLUT 0 et change donc de couleur aussi. Les modes Next n'ont pas d'inverseur de palette, car ULANext garde l'encre dans 8 entrées de palette et le papier dans 32.

**Touches CLUT.** Dans les modes ULAplus, Ctrl+Maj+1 à Ctrl+Maj+4 choisissent la CLUT 0 à 3, comme le choix de CLUT de la barre de couleurs. Dans les autres modes la barre d'état le dit et rien d'autre ne se passe.

**Couleurs standard.** Dans Réglages > Préférences, Couleurs standard permet de changer les 15 couleurs que montrent les modes Standard, Multicolor, GigaScreen et Timex. Le noir brillant est toujours noir. Les couleurs changent ce que vous voyez et ce que contiennent les exports d'image (PNG, GIF, BMP, JPG) ; elles ne changent jamais les octets des fichiers .scr ou .tap, et l'import d'une image se compare toujours aux couleurs d'origine du Spectrum, si bien que la même photo donne la même image sur toutes les machines. Les palettes ULAplus et Next sont séparées. OK applique les couleurs, Annuler ne garde rien et Rétablir le standard remet les originales. Elles sont conservées dans ce navigateur, pas dans le projet. Charger .pal lit un fichier de couleurs standard ZX Paintbrush (256 octets) et Enregistrer .pal en écrit un, ce qui permet d'emporter vos couleurs dans un autre navigateur.

**Cassettes de palette.** Fichier > Enregistrer la palette en TAP écrit la palette ULAplus sous forme de cassette de 176 octets. Chargée sur un Spectrum avec `LOAD ""`, elle règle les 64 entrées de la palette puis charge le fichier suivant de la cassette ; une cassette de palette peut donc précéder une cassette d'image ou de jeu. Fichier > Charger une palette et Fichier > Ouvrir lisent les cassettes de palette : celles de PixULA et celles de ZX Paintbrush. Une cassette de palette va dans l'emplacement de palette en cours en une étape d'annulation et ne devient pas le fichier ouvert.

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

### Attributs

Les éléments Attributs du menu Image modifient les couleurs des cellules et
laissent les points en place. Inverser échange l'encre et le papier de chaque
cellule et garde le brillant et le clignotement. Effacer écrit l'encre, le
papier, le brillant et le clignotement actuels dans chaque cellule ; les cases
« utiliser l'existant » conservent ce que la cellule possède déjà. Retourner
horizontalement et Retourner verticalement retournent les couleurs des
cellules. Chaque commande agit sur la sélection (toutes les cellules touchées)
ou sur toute l'image sans sélection, et s'annule en une seule fois. Les
éléments sont grisés dans les modes sans couleurs de cellule (Timex Hi-res,
Layer 2, LoRes), pendant qu'un tampon sans couleurs propres flotte, et sur un calque verrouillé.

Modifier... trouve les cellules d'après leurs couleurs et les remplace. Rechercher indique les cellules visées : chaque champ est une valeur ou Tous. Remplacer par indique ce qu'elles deviennent : chaque champ est une valeur ou Conserver. La boîte de dialogue indique combien de cellules vont changer avant que vous ne cliquiez sur OK, et OK s'annule en une seule étape. GigaScreen a un groupe Écran A et un groupe Écran B ; en ULAplus, CLUT 0-3 remplace Brillant et Clignotement. Annuler ne modifie rien.

### Points

Les éléments Points du menu Image modifient les points et laissent les couleurs dans leurs cellules. Miroir horizontal et Miroir vertical retournent les points. Inverser points et couleurs échange aussi l'encre et le papier de chaque cellule, de sorte que l'image reste identique. Ils ne sont pas proposés dans les modes sans couleurs de cellule (Layer 2, LoRes, Timex Hi-res) et sont grisés pendant qu'un tampon flotte. En ULAplus et ULANext il n'est pas proposé non plus, car échanger l'encre et le papier changerait l'aspect de l'image.

Le choix Déplacer de la section Décaler du panneau Transformation indique ce qui se déplace. Points et couleurs (par défaut) déplace des cellules entières avec leur papier. Points seuls déplace les points d'un pixel ou d'une cellule à la fois. Couleurs seules déplace les couleurs de cellule une cellule à la fois. La croix possède aussi les diagonales. Pendant qu'un tampon flotte, Déplacer est grisé, car un décalage déplace tout le tampon.

Les touches fléchées suivent le même choix Déplacer lorsqu'une sélection existe.

### Tampons

Quand un tampon est actif, le panneau **Transformer** montre comment il est posé.

**Couleurs** choisit entre Pixels seuls et Couleurs propres. Pixels seuls pose les points du tampon avec les couleurs de la barre d'attributs, comme toujours. Couleurs propres pose les couleurs que le tampon porte, cellule par cellule : un tampon de l'éditeur de cartes, ou copié d'une image dans un mode à couleurs de cellule. Un tampon copié depuis l'image commence en Pixels seuls, donc un collage tombe exactement comme avant. Couleurs propres cale le tampon sur des cellules entières, ignore le mode de dessin, la barre de couleurs et l'interrupteur XOR, et ne peut être ni redimensionné, tourné, déformé, retourné, inversé ni détouré ; le panneau les grise et dit pourquoi. Changer la forme d'un tampon Pixels seuls abandonne les couleurs qu'il portait. Inverse échange toujours ce que font les points pleins et vides. Si les cellules du tampon n'ont pas la taille du mode d'écran actuel, seul Pixels seuls est possible.

**Transparence** (Couleurs propres seulement) laisse transparaître la couleur déjà présente sur la page à la place de celle du tampon. Encre, Papier, Brillance et Clignotement ont chacun une case. ULAplus a une case CLUT pour Brillance et Clignotement ensemble. En GigaScreen chaque case couvre les deux écrans.

**Points vides** décide ce que font les points vides du tampon. Garder le fond laisse le dessin en dessous tranquille (un tampon aux couleurs propres recolore quand même le papier dessous, sauf si le Papier transparaît). Effacer le fond l'efface aussi, sur tout le rectangle du tampon. Les modes de dessin sans inverse (XOR, Recolorer l'encre, Recolorer le papier) et l'interrupteur XOR propre du tampon laissent les points vides tranquilles, et le panneau le dit. Points vides est disponible dans tous les modes d'écran, même sans couleurs de cellule.

**Convertir en pixels seuls** abandonne définitivement les couleurs du tampon et garde ses points. Le choix Pixels seuls dans Couleurs les garde, donc on peut revenir. Chaque changement est une étape d'annulation.

Tant qu'un tampon aux couleurs propres est actif, les commandes Image > Attributs (Inverser, Effacer, les deux Retourner et Changer...) agissent sur les cellules du tampon et non sur l'image, qu'il flotte ou soit rangé. Elles ignorent la sélection et ne touchent jamais les points du tampon, et une cellule que le tampon ne couvre pas reste telle quelle. Retourner reflète les cellules de couleur du tampon pendant que ses points restent en place. Un tampon GigaScreen porte un seul jeu de couleurs pour les deux écrans, donc la boîte Changer montre un seul groupe. Chaque commande est une étape d'annulation. Pour un tampon sans couleurs propres elles restent grisées.
