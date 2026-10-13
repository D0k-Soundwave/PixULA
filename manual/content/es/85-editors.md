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

**Fuentes grandes.** Nueva fuente grande... crea un conjunto de fuentes grandes CHX, como el que usa ZX-Editor Second Edition: cada carácter mide 8, 16, 24 o 32 píxeles de ancho y de alto (ancho y alto se eligen por separado), y el editor muestra el tamaño donde estaba la lista de anchos. Marca Rellenar con una fuente para elegir cualquier fuente de la misma lista que usa la herramienta Texto, cuánta altura del carácter ocupan las letras (en porcentaje) y si van a la izquierda, al centro o a la derecha. Marca Proporcional y cada letra se guarda solo con el ancho que necesita, en columnas enteras de 8 píxeles, de modo que una i ocupa menos que una W; el carácter Espacio conserva siempre al menos una columna. Rellenar desde fuente... hace lo mismo en un solo paso con una fuente grande que ya tengas. Una fuente grande solo se puede guardar como `.chx` (los demás formatos y los listados en ensamblador, C y binario contienen caracteres de 8 por 8), no puede capturar una celda del lienzo y la herramienta Texto aún no la ofrece. Al abrir un `.chx` grande, cada carácter conserva su propio tamaño, y un carácter que el archivo omite sigue omitido al guardar de nuevo. La forma en que un carácter de varios bloques de 8 por 8 se dispone en el archivo sigue la descripción publicada del formato y no se ha comprobado con un archivo guardado por el propio ZX Paintbrush, así que abre en ZX Paintbrush una fuente grande hecha aquí antes de fiarte de ella.

**Sombreado y deshacer.** En una fuente cuyos caracteres miden un número entero de columnas de 8 píxeles, los cuatro botones de Sombreado sombrean o quitan la sombra de una columna cada vez, a la izquierda o a la derecha del carácter que editas. Una columna sombreada se dibuja rayada y no se guarda: un archivo `.chx` contiene ese carácter más estrecho, y un carácter sombreado de lado a lado se omite del archivo. Los puntos bajo el sombreado se conservan en el editor, así que quitar la sombra los devuelve, pero no están en el archivo. Sombrear todo al ajuste lo hace para todos los caracteres a la vez: sombrea las columnas vacías a cada lado de sus puntos, deja una columna al Espacio y omite los demás caracteres en blanco. El carácter Espacio conserva siempre al menos una columna, porque un archivo `.chx` debe contenerlo. Tras exportar un `.chx`, la línea de estado indica cuántos caracteres se guardaron más estrechos, cuántos se omitieron y cuántos tenían puntos bajo el sombreado. El Editor de fuentes también tiene Deshacer y Rehacer (los dos botones, o Ctrl+Z y Ctrl+Y): un trazo en la superficie de edición es un paso, y también lo es cada botón, Nueva fuente grande, Rellenar desde fuente, Cargar fuente ROM o una importación. Escribir en el cuadro del nombre de la fuente no cuenta.

**Todos los caracteres.** El botón Todos los caracteres cambia el editor de un carácter por un mapa de toda la fuente, con todos los caracteres uno junto a otro, 16 por fila, sobre el que dibujas con el mismo Pincel, Borrador, Línea y Relleno, de modo que un trazo puede pasar de un carácter al siguiente. Un trazo es un cambio y un paso de deshacer, y el Relleno se queda dentro del carácter en el que haces clic. La herramienta Sombrear sombrea o quita la sombra de la columna de 8 píxeles en la que haces clic, desde el borde más cercano de su carácter; las columnas sombreadas se rayan. La herramienta Mover arrastra el mapa, que es como se desplaza con un dedo, porque, de lo contrario, el mapa reserva cada toque para dibujar. Los botones menos, Ajustar y más cambian el zoom en pasos enteros. En el mapa y en la cuadrícula de caracteres, las flechas, Inicio y Fin pasan de un carácter a otro, y escribir un carácter lo elige. No se pueden dibujar píxeles solo con el teclado.

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
