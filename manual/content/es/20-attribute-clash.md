## El choque de atributos

El Spectrum guarda una imagen en dos partes separadas.

La primera es un mapa de bits: 256 por 192 puntos, de un bit cada uno,
encendido o apagado. La segunda es una cuadrícula de color, un byte por cada
bloque de 8 por 8 de esos puntos: 32 bytes a lo ancho y 24 a lo alto. Cada
byte indica de qué color debe ser la **tinta** (los puntos encendidos), de qué
color el **papel** (los puntos apagados), si la pareja tiene **brillo** y si
debe **parpadear** (flash).

Así, la forma de tu imagen tiene una resolución de 256 por 192, y su color una
de 32 por 24. Cada celda de 8 por 8 puede mostrar dos colores, y cada punto
dentro de ella es uno u otro.

![Dos líneas diagonales que se cruzan en un lienzo ampliado con la cuadrícula de celdas visible. La línea azul se vuelve roja en cada celda por la que también pasa la roja](img/attribute-clash.png)

*Una línea azul y una roja que se cruzan, al 800 % con la cuadrícula de celdas.
Donde la línea roja atraviesa una celda, la línea azul de esa celda también es
roja. El trazo rojo llegó después y fijó el color de tinta de toda la celda,
incluidos los puntos que ya había puesto el trazo azul.*

Esto es lo que significa «choque de atributos» (*attribute clash*). Dibujar en
una parte de una celda cambia el color de todo lo demás que hay en ella, y no
hay ningún ajuste que lo desactive: así funciona el hardware.

### Cómo trabajar con él

La mayoría de los artistas de Spectrum planifican sus zonas de color antes que
el detalle, y disponen la imagen para que los límites de color caigan en los
límites de celda. Cuando una celda necesita un tono que no puede contener,
traman: dos colores intercalados con la finura suficiente para que el ojo los
mezcle.

PixULA ayuda con esto de tres maneras.

**La cuadrícula de celdas.** Actívala junto a los controles de zoom y verás
exactamente dónde un cambio de color sale gratis y dónde te costará.

**Los modos de dibujo.** Un trazo no tiene por qué cambiar a la vez los puntos
y los colores. Puedes poner puntos sin tocar los colores, o recolorear una
celda sin tocar un punto. El capítulo sobre el color los enumera.

**La biblioteca de patrones.** Su núcleo es un conjunto de teselas con
densidades de tinta medidas, que es lo que usarás cuando una celda necesite un
gris que no puede contener.

### Ver los puntos

Tres interruptores del menú Ver cambian lo que muestra la pantalla sin cambiar
la imagen. **Colores desactivados** muestra los puntos en negro sobre blanco,
para que veas qué puntos están realmente activos. **Cuadrícula de color** hace
lo mismo y además tiñe las celdas como un tablero de ajedrez, para distinguir
fácilmente los límites de celda; ella y Colores desactivados se desactivan
mutuamente. **Detener parpadeo** mantiene cada celda parpadeante en sus colores
normales. Ninguno toca la imagen, el deshacer ni una exportación: una imagen
guardada se ve igual con ellos activados o no. El navegador los recuerda, y un
interruptor que no puede funcionar en el modo de pantalla actual aparece en
gris: pasa el ratón por encima para ver por qué. En GigaScreen y MultiGiga,
Colores desactivados muestra cuatro niveles de gris: blanco donde ninguna
pantalla tiene punto, gris claro para un punto solo en la pantalla A, un gris
más oscuro solo en la pantalla B y negro en ambas.

### Leer el puntero

La franja bajo la imagen y la barra de estado dicen dónde está el puntero. En
**Preferencias**, *La lectura del puntero muestra* añade el atributo bajo el
puntero (su número en decimal y en hexadecimal, luego tinta, papel, brillo y
parpadeo; la CLUT en ULAplus; ambas pantallas en GigaScreen) y la dirección de
memoria del byte del píxel y de su byte de atributo. Hay direcciones donde la
máquina real tiene una disposición fija: ULA estándar y ULAplus (fichero de
pantalla desde $4000, atributos desde $5800), Timex de color alto (atributos en
el segundo fichero de pantalla, en $6000), Timex de alta resolución (columnas de
bytes pares en $4000, impares en $6000) y GigaScreen (pantalla A como la
estándar, pantalla B en el banco 7 en $C000; qué pantalla va en qué banco es una
convención). Los demás modos indican que no tienen dirección.

*Y se cuenta desde* puede ponerse abajo, de modo que la lectura se lea como
BASIC PLOT, donde 0,0 es la esquina inferior izquierda y Y va de 0 a 175. Eso
existe solo sobre las 176 filas superiores de una imagen de 256 por 192; debajo,
y en otras pantallas, la lectura muestra un guion. Solo cambia la lectura.

**Cuadrícula personalizada...** en el menú Ver dibuja una cuadrícula con
cualquier paso X e Y, ajustados por separado, y **Mostrar cuadrícula
personalizada** la activa y desactiva. Las líneas a menos de cuatro píxeles de
pantalla entre sí se omiten hasta que acerques el zoom. Las cuadrículas
activadas vuelven la próxima vez que abras el programa. En Preferencias,
*Colores de las cuadrículas* fija el color de cada una; si dejas marcado *Color
del tema*, la cuadrícula sigue el tema.

### Donde las reglas cambian

El hardware posterior relajó la restricción de varias formas, y PixULA puede
trabajar con todas. Las máquinas Timex hicieron más fina la cuadrícula de
color. ULAplus sustituyó los dieciséis colores fijos por una paleta a tu
elección. GigaScreen alterna dos imágenes lo bastante rápido como para sugerir
colores que ninguna de ellas contiene. El ZX Spectrum Next abandona el esquema
por completo en sus modos Layer 2 y LoRes, donde cada píxel lleva su propio
color.

Puedes pasar una imagen de uno a otro: consulta el capítulo siguiente.
