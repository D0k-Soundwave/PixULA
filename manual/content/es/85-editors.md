## Los editores

Cuatro cosas que hace PixULA no son imágenes, y cada una tiene su propia
ventana en el menú Archivo.

### El editor de fuentes

Un juego de caracteres de Spectrum tiene 96 o 256 glifos, cada uno guardado
como una pila de bytes de fila. Este editor los modifica de uno en uno.

![El editor de fuentes, con la cuadrícula de glifos a un lado y un carácter en edición al otro](img/dialog-font-editor.png)

*Elige un carácter de la cuadrícula de la izquierda y edítalo a la derecha.*

Los glifos pueden tener 4, 6 u 8 píxeles de ancho por la altura de la celda.
Estrechar una fuente descarta para siempre las columnas de la derecha, así que
si estás probando anchos, trabaja de estrecho a ancho.

Puedes empezar con la fuente ZX ROM, capturar un glifo del lienzo o cargar un
juego `.ch4`, `.ch6`, `.ch8`, `.chr` o `.chx` de otra herramienta de Spectrum.
Al poner nombre a una fuente se añade a tu biblioteca, y la herramienta Texto
la ofrece entonces junto a la fuente ROM integrada.

### El editor de mapas

Un mapa es una cuadrícula de mosaicos, donde un mosaico es una celda de 8 por
8: ocho bytes de mapa de bits y un byte de atributos. Los mapas te permiten
construir un escenario más grande que una sola pantalla.

![El editor de mapas, con la paleta de mosaicos y una zona de mapa desplazable](img/dialog-map-editor.png)

*Los mosaicos a la izquierda, el mapa a la derecha.*

Pinta con el botón izquierdo y borra con el derecho, o usa el relleno para
sustituir una zona conectada de mosaicos iguales. Los mosaicos salen del patrón
y los colores actuales, o directamente del lienzo. Puedes volcar un mapa en el
lienzo, y un solo deshacer revierte todo.

Guarda como `.zxtm` para seguir trabajando (es el formato propio de PixULA y lo
conserva todo), o como `.zxm`, o como ensamblador, C o binario en bruto para
incluirlo en un programa.

### El editor de sprites

Los sprites de Next son de 16 por 16 píxeles con un índice de paleta por
píxel, y una hoja contiene hasta 64.

![El editor de sprites, con una hoja de sprites y la cuadrícula de edición](img/dialog-sprite-editor.png)

*La hoja a un lado, el sprite que estás dibujando al otro.*

Las hojas de sprites se guardan en archivos `.spr`, no dentro de tu imagen,
así que guarda la hoja por separado. En los modos indexados puedes capturar un
sprite del lienzo y estampar uno sobre él.

### El editor de paletas

**Imagen > Editar paleta**, en los modos con paleta editable. Muestra ULAplus
como cuatro paletas de dieciséis y la paleta Next como filas de colores de
nueve bits. Cualquier color que elijas se ajusta al valor más cercano que el
hardware puede guardar de verdad, así que lo que ves es lo que mostrará la
máquina.

Cada cambio es un paso de deshacer aparte. Las paletas también pueden cargarse
y guardarse sin abrir esta ventana: consulta el capítulo sobre el color.

### Bloques de cinta

**Archivo > Bloques de cinta** abre un `.tap` o un `.tzx` y enumera lo que
contiene. Úsalo para cargar una pantalla de una cinta que contiene varias, o
para añadir tu imagen actual a una cinta como bloque nuevo y volver a guardar
la cinta.

Los bloques que no has tocado se escriben byte a byte, así que añadir una
pantalla a la cinta de otra persona deja el resto exactamente como estaba.
