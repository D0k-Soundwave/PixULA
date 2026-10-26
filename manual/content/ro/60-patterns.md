## Modele și dithering

O celulă cu două culori nu are ton intermediar. Ca să sugerați unul, întrețeseți
cele două culori pe care le aveți și lăsați ochiul să le amestece, iar
biblioteca de modele există ca să vă dea plăci care fac asta la intensități
cunoscute.

Ca să folosiți una, activați **Folosește model** într-un instrument care o
oferă – umplerea și pensula cu model o fac – și alegeți o placă din panoul de
modele.

Plăcile numite `density-NN` sunt generate, iar numărul este proporția reală de
pixeli de cerneală din placă: `density-25` are cerneală într-un sfert din pixeli. Familiile semiton și
zgomot acoperă aceeași gamă de gri cu altă textură, ca să puteți schimba aspectul
unei nuanțe fără a-i schimba cât de închisă este.

Puteți și să vă desenați propriile plăci în Editorul de modele și să le păstrați
în propria bibliotecă alături de acestea.

**Din imagine.** Butonul **Din imagine...** din panoul de modele creează o umplere dintr-un fișier imagine (PNG, JPG sau GIF). O fereastră arată placa așa cum se va repeta și oferă Luminozitate, Contrast, Scalare, Dimensiunea plăcii (pătrat de 8, 16 sau 32 de pixeli) și aceleași 31 de metode de dither ca importul; implicit, Floyd-Steinberg. Părțile întunecate ale imaginii devin pixeli de cerneală. OK adaugă placa în biblioteca ta sub numele fișierului - un al doilea fișier cu același nume devine "nume 2" și nu îl înlocuiește niciodată pe primul - și o face modelul curent, gata pentru umplere și pensula de model.

{{patterns}}
