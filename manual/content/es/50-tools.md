## Las herramientas

La barra agrupa las herramientas según lo que hacen a la imagen: primero todo
lo que pone tinta, luego la selección, luego la guía que la selección hace
posible, después las herramientas que colocan obra terminada y, por último, las
que solo cambian tu vista.

El modo de dibujo, el espejo y la guía se aplican a todas estas herramientas,
así que se ajustan una vez en la barra de modos en lugar de aparecer en las
opciones de cada herramienta.

![El panel de opciones de herramienta con los ajustes del pincel](img/tool-options-brush.png)

*Las opciones de la herramienta seleccionada aparecen en este panel; aquí, el
pincel.*

El pincel no tiene cruz sobre la imagen. A partir del tamaño 2, el contorno de
la zona que va a pintar es el puntero. Con tamaño 1 el puntero es una pequeña
cruz de tres píxeles, y el punto central es el píxel que pintará el pincel, en
el color en que lo pintará: tu tinta con el BRILLO aplicado, o la tinta propia
de la celda cuando la tinta está en «usar el color existente». Mientras
dibujas, el punto muestra lo que acabas de pintar. Sobre la zona gris que rodea
la imagen vuelve el puntero normal. Aerosol, Desvanecido, Patrón y Trama
funcionan igual.

Muchas opciones solo se aplican combinadas con otra. Las tablas de abajo tienen
una columna **Se muestra si** con la condición en que aparece cada fila; las
filas marcadas «siempre» están ahí se ajuste lo que se ajuste.

**Figuras de puntos.** La lista de Formas tiene un grupo de Figuras que se dibujan colocando puntos: Polilínea, Polígono, Triángulo, Rayos, Línea perpendicular y Línea paralela (la tecla L elige la herramienta Figura). Haz clic para añadir un punto, o pulsa y arrastra para un trazo libre. Doble clic o Intro termina la figura, que queda en la imagen como una vista previa que aún puedes cambiar; otro Intro la dibuja, en un solo paso de deshacer. Retroceso quita el último punto (un trazo libre entero de una vez), Esc descarta la figura sin dibujarla, y hacer clic en otro sitio o elegir otra herramienta la dibuja. El Triángulo, la Línea perpendicular y la Línea paralela terminan solos en su tercer punto: arrastra la primera línea y haz clic en el último punto. Una Línea perpendicular añade una segunda línea desde el pie de la perpendicular de tu punto a la primera línea; una Línea paralela añade una copia de la primera con tu punto en el medio. Rayos une cada punto posterior con el primero. El Polígono y el Triángulo se pueden rellenar. Las figuras siguen el modo de dibujo, Inverso, las casillas «usar existente», la simetría y la guía de dibujo como cualquier forma, y la vista previa es exactamente como se dibujarán.

**Estilo de línea, Giro y Redondeo.** La herramienta Forma, la herramienta Figura y la curva de Bézier comparten un Estilo de línea: Continua, Discontinua, Punteada, Raya y punto, Raya-punto-punto y Ninguna. Los estilos de rayas se dibujan solo en una línea de un píxel, así que quedan atenuados por encima de grosor 1; el patrón recorre el contorno, también las esquinas, y cada rayo o línea de una figura empieza el suyo. Ninguna no dibuja contorno: úsala con Relleno para dibujar solo el interior. La curva de Bézier no tiene Ninguna. Giro (de -180 a 180 grados, en sentido horario) gira un rectángulo, cuadrado, rectángulo redondeado, elipse o paralelogramo alrededor del centro de su caja, y gira un arco, sector, triángulo, rombo o polígono regular alrededor del punto donde pulsaste. Redondeo fija lo redondas que son las esquinas del rectángulo redondeado, de esquinas rectas en 0 a extremos semicirculares en 100. Una curva de Bézier que aún editas se dibuja al elegir otra herramienta, y Esc la descarta. La vista previa de una forma o curva muestra las copias reflejadas y se mantiene dentro de la guía de dibujo, como el dibujo terminado.

**Editar, mover, girar y clonar una figura.** Una figura terminada y una curva de Bézier quedan en la imagen como vista previa hasta que las dibujas. Mientras esperan, puedes arrastrar cualquiera de sus puntos cuadrados para cambiar su forma, arrastrar la figura para moverla, arrastrar el mando redondo de encima para girarla y usar las flechas para moverla (un píxel, o una celda con Mayús o con el ajuste a la rejilla). Ctrl+Z deshace la última de estas ediciones, luego la figura y solo después la imagen. Intro, un clic en otro sitio, guardar o elegir otra herramienta la dibuja, en un solo paso de deshacer. Una forma de la herramienta Forma normalmente se dibuja al soltar; marca **Mantener editable** en sus opciones y espera como una figura, con un tirador en cada extremo del arrastre. **Edición > Clonar la última figura** (Mayús+C) abre una copia de la última figura, forma o curva que dibujaste, lista para mover, girar o cambiar; para cambiar los colores o el estilo de línea de una ya dibujada, pulsa Ctrl+Z y luego Clonar la última figura. Mientras una figura espera, sigue los colores, el estilo de línea y el relleno que elijas, como el dibujo terminado. La curva de Bézier es la excepción: se reforma con sus tiradores y se mueve con las flechas, pero no se puede arrastrar entera ni girar, y Ctrl+Z descarta la curva entera de una vez.

**Spray con patrón.** Pon la Distribución del spray en **Patrón** y colocará pequeñas figuras enteras - círculos, cuadrados o rayas cortas - en lugar de puntos. Elige la figura, su tamaño y si es rellena o solo contorno; el Flujo indica cuánta superficie intentan cubrir. Dentro del área solo se colocan figuras enteras, así que un spray demasiado pequeño para una figura no dibuja nada.

**El ajuste y su paso.** El ajuste (el botón bajo el lienzo, o Mayús+S) hace que las selecciones, formas, puntos de figura, texto y piezas pegadas caigan sobre una rejilla; el dibujo a mano alzada nunca se ajusta. La lista junto al botón fija la rejilla: la celda de atributos del modo (8x8, u 8x4, 8x2 o 8x1 en los modos multicolor), 16x16, una pantalla entera de 256x192 (solo en un lienzo mayor que una pantalla, como Layer 2 320 y 640) o tu propio paso, cuyo ancho y alto fijas en Preferencias, en Dibujo. Elegir un paso también activa el ajuste. Una pieza pegada cae con su esquina superior izquierda sobre la rejilla. Con el ajuste activo, las flechas mueven una figura en espera, una pieza flotante o el extremo del degradado un paso; una selección que lleva sus colores se mueve el paso redondeado a celdas enteras. ZX Paintbrush mueve con el teclado píxel a píxel sea cual sea su salto de trama, así que esto difiere a propósito.

**Tamaños de selección.** Con la selección rectangular, la lista **Tamaño** elige lo que selecciona un arrastre. Libre es un rectángulo de cualquier tamaño. Celda selecciona las celdas de atributos completas que toca. 16x16, Pantalla (256x192, en un lienzo mayor que una pantalla) y Personalizado (un ancho y alto de bloque que tú fijas) seleccionan bloques enteros de ese tamaño: un clic elige un bloque, un arrastre todos los que alcanza. Los bloques de Celda están en la rejilla de celdas; los demás empiezan donde pulsas el ratón o, con el ajuste activo, en la celda de ajuste en la que pulsaste. Un bloque nunca pasa del borde de la imagen. Con el ajuste activo, un arrastre Libre de un punto de ajuste a otro selecciona exactamente la distancia entre ellos.

{{tools}}
