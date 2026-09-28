## Souris, stylet et toucher

### Souris

Le bouton gauche dessine à l’encre et le droit au papier. Maj et clic droit
ouvrent le menu de la zone de dessin, qui permet d’accéder à couper, copier et
coller quand un outil utilise le bouton droit pour dessiner.

### Stylet

La pointe du stylet dessine avec l’outil choisi et ne peut pas être
réattribuée. Toutes les autres commandes du stylet le peuvent, dans
**Préférences > Stylet**.

Par défaut, le bouton latéral dessine au papier, comme le bouton droit de la
souris, et la gomme au bout du stylet efface. La liste des Préférences
propose aussi la pipette, le déplacement de la vue, annuler, rétablir,
l’échange des couleurs, le menu de la zone de dessin et le retour à l’outil
précédent.

La pression change la taille et le débit du pinceau dans la mesure que vous
fixez. L’inclinaison est utilisée quand le stylet la transmet.

![La fenêtre Préférences, section stylet](img/dialog-preferences.png)

*Préférences. La section stylet attribue chaque commande de votre stylet ; le
test du stylet en dessous indique ce que le navigateur reçoit réellement.*

Si un bouton semble ne rien faire, essayez le **Test du stylet**. Appuyez
chaque partie du stylet sur la zone : elle s’allume pour tout ce que reçoit le
navigateur. Les pilotes de tablette diffèrent dans ce qu’ils transmettent –
un second bouton latéral, en particulier, n’atteint souvent pas du tout le
navigateur – et ce test vous montre ce que fait le vôtre.

{{pen}}

### Toucher

Un doigt peut faire tout ce que fait une souris, et vous pouvez désactiver le
dessin au doigt tout en gardant le reste. Deux doigts déplacent la vue et
zooment par pincement, et un appui long ouvre le menu de la zone de dessin.

Trois règles distinctes empêchent une main posée de gâcher un trait :

- Un toucher qui arrive alors qu’un stylet ou un bouton de souris est déjà
  enfoncé est ignoré. C’est la main qui tient l’appareil, pas une seconde
  personne qui dessine.
- Un toucher qui arrive peu après la dernière détection du stylet est ignoré
  aussi. La durée de cette fenêtre est réglable ; par défaut, une demi-seconde.
- Le dessin au toucher peut être entièrement désactivé, en laissant au toucher
  le déplacement et le zoom.

Ce dernier réglage est dans la barre d’état plutôt que dans les Préférences,
car c’est celui qu’on voudra le plus probablement changer en cours d’image. Il
affiche son état en permanence, et un clic le change.

Un toucher rejeté ne fait rien du tout – il ne déplace pas non plus la vue.
Une paume égarée qui ferait défiler la vue en plein trait ne vaudrait pas
mieux qu’une paume qui dessinerait dessus.
