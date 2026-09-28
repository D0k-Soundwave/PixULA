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
