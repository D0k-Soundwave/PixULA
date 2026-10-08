## Primeros pasos

PixULA es un editor de pixel art para el ZX Spectrum y el ZX Spectrum Next.
Funciona en un navegador, desde una carpeta de tu propio disco, sin instalación,
sin servidor y sin conexión a Internet.

Descomprime la carpeta donde quieras y haz doble clic en `PixULA.html`. Esa es
toda la instalación. No se escribe nada fuera de esa carpeta a menos que lo
pidas, y nada de lo que dibujas sale de tu equipo.

### Lo primero que hay que saber

El Spectrum no puede poner cualquier color en cualquier sitio. Guarda tu imagen
como un mapa de bits de un bit por píxel, con una cuadrícula de color aparte y
mucho más gruesa superpuesta, y dentro de cada bloque de 8 por 8 solo hay dos
colores disponibles. Ese único hecho determina cómo se comporta cada
herramienta, y de él trata el capítulo siguiente.

### Orientarse

![La ventana de PixULA: barra de menús, barra de modos, barra de herramientas, barra de color, lienzo, paneles y barra de estado](img/workspace.png)

*La ventana completa.*

- **La barra de menús** en la parte superior: archivos, edición, la vista,
  capas, la propia imagen, ajustes y ayuda.
- **La barra de modos** debajo: modos de dibujo, Intercambiar y Recolorear, y espejo.
- **La barra de herramientas** a la izquierda, con deshacer y rehacer arriba.
- **La barra de color** a su lado, con la paleta del modo de pantalla actual.
- **El lienzo** en el centro.
- **Los paneles** a la derecha: capas, opciones de herramienta, transformar,
  la imagen de referencia, preajustes.
- **La barra de estado** en la parte inferior, que muestra el modo de
  pantalla, el modo de dibujo y si el tacto dibuja.

![La barra de herramientas](img/tool-rail.png)

*La barra de herramientas. Deshacer y rehacer están arriba; las herramientas de
debajo se agrupan según lo que hacen a la imagen.*

![La barra de color](img/colour-rail.png)

*La barra de color: TINTA a la izquierda, PAPEL a la derecha, con BRILLO y
FLASH encima.*

![La barra de modos](img/colour-bar.png)

*La barra de modos: modos de dibujo, luego Intercambiar y Recolorear, luego espejo.*

![Los paneles laterales](img/panels.png)

*Los paneles. Cada uno se pliega, para que tengas abiertos solo los que usas.*

![La barra de estado](img/status-bar.png)

*La barra de estado, con los ajustes que determinan lo que hará tu próximo
trazo.*

La barra no tiene etiquetas: no hay sitio junto a los botones. Pasa el puntero
sobre cualquier control para ver su nombre, y mantenlo encima para leer una
frase que lo explica. En una tableta, mantén pulsado; esa pulsación no cambia
además de herramienta.

### En una tableta

Sostén la tableta en horizontal. PixULA usa la misma ventana en una tableta que
en un ordenador, y en vertical no hay anchura suficiente para el lienzo junto a
los paneles, así que te pide girar el dispositivo. En una pantalla pequeña toda
la interfaz se reduce para caber, nunca por debajo de un tamaño que un dedo aún
pueda acertar, y el tamaño de la interfaz que elegiste vuelve en una pantalla
mayor. Con un ratón o un trackpad conectado, la tableta se trata como un
ordenador y puede usarse en cualquier orientación.
