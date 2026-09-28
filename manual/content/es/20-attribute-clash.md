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

### Donde las reglas cambian

El hardware posterior relajó la restricción de varias formas, y PixULA puede
trabajar con todas. Las máquinas Timex hicieron más fina la cuadrícula de
color. ULAplus sustituyó los dieciséis colores fijos por una paleta a tu
elección. GigaScreen alterna dos imágenes lo bastante rápido como para sugerir
colores que ninguna de ellas contiene. El ZX Spectrum Next abandona el esquema
por completo en sus modos Layer 2 y LoRes, donde cada píxel lleva su propio
color.

Puedes pasar una imagen de uno a otro: consulta el capítulo siguiente.
