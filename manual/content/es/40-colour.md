## El color

En los modos clásicos no eliges un color para un píxel. Eliges los dos colores
que usará toda una celda, más dos indicadores.

- **TINTA** es el color de los puntos encendidos.
- **PAPEL** es el color de los puntos apagados.
- **BRILLO** sube ambos a su versión más clara. Hay un indicador de brillo por
  celda, así que tinta y papel tienen brillo juntos o ninguno lo tiene.
- **FLASH** intercambia tinta y papel unas dos veces por segundo en el hardware
  real.

El botón izquierdo del ratón dibuja con tinta. El derecho dibuja con papel:
apaga el punto y fija los mismos cuatro valores que fijaría el izquierdo. En un
lápiz, el botón lateral hace lo mismo que el botón derecho.

El **borrador** hace algo distinto de ambos. Apaga puntos y deja intactos los
colores de la celda, incluso cuando borra el último punto de la celda. Para
borrar también los colores, vuelve a pasar el borrador sobre la celda vacía con
un trazo nuevo: tinta, papel, brillo y flash vuelven a negro sobre blanco, y en
una capa superior la celda vuelve a ser transparente. Una celda que aún tiene
puntos conserva sus colores por muchas veces que pases el borrador.
La opción **Colores** de la goma, visible en los modos de pantalla con colores
de celda, cambia esto: Poner los actuales borra los puntos y da a la celda los
colores de la barra, como la herramienta de borrado de ZX Paintbrush, y
Conservar, la opción por defecto, es el comportamiento descrito arriba.

Cada uno de los cuatro también puede ponerse en **usar el existente**: la
casilla a cuadros que tiene debajo en la barra de color. Así un trazo deja esa
parte de cada celda como ya está, en lugar de escribir tu ajuste. Pon TINTA,
PAPEL y BRILLO en existente y activa FLASH, y la opción **Rellenar solo
atributos** de la herramienta de relleno hará parpadear toda una zona sin
cambiar ningún color. Mayús+B y Mayús+F cambian BRILLO y FLASH, y Mayús+T pone
los cuatro en existente. En ULAplus, BRILLO y FLASH eligen la CLUT, así que el
selector de CLUT tiene una sola casilla, que conserva la CLUT de cada celda.

### Modos de dibujo

El modo de dibujo cambia lo que hace un trazo. Se conserva entre sesiones, así
que la barra de estado lo muestra siempre que no sea Normal: en algunos de estos
modos un trazo no deja nada visible, y de otro modo no tendrías forma de saber
por qué.

{{draw-modes}}

El pincel en todas sus formas, el relleno, las formas, la curva Bézier, el
texto, los sellos del panel **Sellos** y el botón izquierdo del degradado siguen
el modo de dibujo. El borrador, el cuentagotas, mover, pegar y borrar una
selección, el panel **Transformar**, la opción **Rellenar solo atributos** y los
botones Intercambiar y Recolorear lo ignoran.

**Recolorear tinta no es lo mismo que Recolorear.** Recolorear tinta y
Recolorear papel son modos de dibujo: recolorean cada celda que toca la
herramienta actual (unas pocas con un pincel pequeño, todas las que cubre
un rectángulo relleno) y el Espejo se aplica. **Recolorear**, justo
después del separador, recolorea la celda entera bajo el puntero sea cual
sea la herramienta elegida, sin tener en cuenta el tamaño del pincel ni el
Espejo. **Intercambiar**, a su lado, funciona igual e intercambia la tinta
y el papel de cada celda. Cualquiera de los dos sigue activo hasta que
vuelvas a pulsarlo o elijas una herramienta o un modo de dibujo, y la
barra de estado lo indica mientras está activo.

**Copiar colores, Invertir puntos e Invertir puntos y colores** son tres
operaciones de celda más junto a Intercambiar y Recolorear, y funcionan igual:
haz clic en el botón y luego haz clic o arrastra sobre celdas. Cada arrastre se
deshace en un paso, y siguen activas hasta que vuelvas a hacer clic en el botón
o elijas una herramienta o un modo de dibujo. **Copiar colores** recoge los
colores que muestra la celda bajo tu primer clic y los da a cada celda sobre la
que arrastras; la barra de colores no cambia. **Invertir puntos** borra los
puntos puestos de cada celda entera y pone los borrados, y deja los colores (una
celda en blanco se llena). **Invertir puntos y colores** además intercambia
tinta y papel, de modo que cada celda se ve igual; sirve para ordenar una imagen
importada, se salta las celdas en las que dibuja también otra capa y no se
ofrece en ULAplus ni ULANext. Una herramienta de celda solo existe en los modos
de pantalla donde puede funcionar: su botón se oculta en los demás, e Invertir
puntos también funciona en Timex Hi-res, donde los puntos están en celdas de 8
por 8.

**XOR / Encima y XOR / Cada pasada** invierten los puntos en lugar de
encenderlos, y los dos dan a la celda los colores elegidos. XOR / Encima
invierte cada punto una vez por trazo, así que volver sobre tu propia línea en
el mismo trazo no cambia nada más. XOR / Cada pasada invierte un punto cada vez
que el trazo pasa por él: una pasada del pincel cuenta como una, por mucho que
el pincel se solape consigo mismo por el camino, pero un trazo que deja un punto
y vuelve lo invierte otra vez, así que un ocho se anula donde se cruza. Las
formas, las curvas, los rellenos y el texto son siempre una sola pasada, así que
con ellos los dos modos dan el mismo resultado.

**Inverso** intercambia lo que hacen los dos botones del ratón: el izquierdo
borra puntos y el derecho los pone, como INVERSE 1 en BASIC. Se activa en Preferencias, o con Mayús+I, y la barra de estado dice «Inverso
activado» mientras lo está. No cambia nada en Recolorear tinta, Recolorear papel
ni en los dos modos XOR, que dan el mismo trabajo a ambos botones, y la barra de
estado lo dice. El texto y los sellos borran sus letras y formas en lugar de
ponerlas, un patrón pone sus puntos como borrados y sus huecos como puntos, y el
relleno rellena con papel con el botón izquierdo y con tinta con el derecho. La
goma, Intercambiar y Recolorear lo ignoran. Se recuerda entre sesiones y se
guarda en los preajustes junto con el modo de dibujo.

**Núcleo de color.** Para el pincel redondo y cuadrado, los contornos de formas
y la curva de Bézier, Núcleo de color dice cuánto de una línea gruesa toma los
colores de la celda. Una línea siempre pone todos los puntos. Con Núcleo de
color en 1 píxel o 4 píxeles, solo las celdas bajo el centro de la línea, una
línea de ese ancho que sigue su centro, toman tus colores; las demás celdas bajo
ella reciben los puntos con los colores que ya tenían, así que una línea gruesa
choca con menos celdas. Toda la línea, la opción por defecto, colorea cada celda
que toca la línea. La opción solo aparece en modos de pantalla con colores de
celda. Con Espejo la línea reflejada tiene su propio núcleo, y con XOR las
celdas fuera del núcleo conservan sus colores.

### Paletas

Dos familias de modos te permiten cambiar los propios colores. ULAplus te da 64
registros de color, organizados como cuatro paletas de dieciséis. Los modos
Next te dan 256 colores de nueve bits cada uno.

Las paletas son archivos. Puedes crear una, guardarla y cargarla en otra
imagen, desde **Archivo > Cargar paleta** y **Archivo > Guardar paleta** o
desde el editor de paletas. No hace falta abrir el editor para cargar una, ya
que cargar una paleta suele hacerse antes de empezar a dibujar.

Cuando un formato de archivo tiene sitio para una paleta (`.scr` de 6976
bytes, `.nxi`, la variante Timex), la paleta viaja también dentro de la imagen.

### GigaScreen

GigaScreen mantiene dos pantallas completas y las muestra alternándolas,
cincuenta veces por segundo. Tu ojo mezcla los dos colores de cada píxel en
uno, así que una celda con una tinta y un papel en cada pantalla puede mostrar
**cuatro** colores, y la imagen entera puede llegar a unos cien.

Nunca dibujas en una sola pantalla. Cada trazo escribe en las dos, y la barra
de color funciona por parejas:

- **Pantalla A** y **Pantalla B** tienen cada una sus muestras de tinta y papel
  y su propio **BRILLO**. El flash es un único ajuste para ambas.
- **Pintar** muestra los cuatro colores que resultan de esas elecciones,
  mezclados exactamente como los muestra el lienzo: tinta en ambas pantallas,
  tinta solo en A, tinta solo en B y papel en ambas. Elige uno y el botón
  izquierdo pinta con él. El botón derecho siempre pinta papel en ambas
  pantallas.
- Elige la misma tinta en las dos pantallas y la muestra superior izquierda de
  Pintar es ese color, sin mezclar: así se dibuja todo lo que no deba parecer
  mezclado.

El cuentagotas recoge todo esto: los colores de ambas pantallas y cuál de los
cuatro muestra el píxel.

Los botones de visualización cambian solo lo que muestra el lienzo, nunca a
dónde va un trazo. **Promedio** es lo que ve el ojo en la máquina real.
**Parpadeo** intercambia las dos pantallas en cada fotograma, como hace el
hardware. **A** y **B** muestran una pantalla sola. Una imagen que guardas o
exportas como PNG usa Promedio cuando se muestra Parpadeo, ya que una imagen
fija no puede parpadear.

Entrar en GigaScreen copia tu imagen en ambas pantallas, así que se ve igual
que antes. Al salir se conserva la pantalla A y se descarta la B, y se te avisa
antes si la pantalla B contiene algo distinto.

La misma forma de trabajar sirve para otros dos modos de parpadeo:

- **MultiGigaScreen 8×4, 8×2 y 8×1** ponen las dos pantallas sobre las celdas
  Multicolor más finas, así que los cuatro colores son por cada 4, 2 o una
  línea en vez de por bloque de 8 por 8. Son los archivos `.mg4`, `.mg2` y
  `.mg1` de MultiArtist.
- **Timex alta resolución GigaScreen** alterna dos pantallas de alta resolución
  de 512 por 192. La alta resolución no tiene colores de celda (cada pantalla
  tiene un esquema de color para toda la imagen), así que la barra muestra una
  fila de esquemas para la Pantalla A y otra para la Pantalla B, y Pintar
  muestra las cuatro mezclas de ambos. Son archivos `.hrg`.

Cambiar entre cualquiera de los modos de dos pantallas conserva ambas
pantallas, con las mismas reglas con que se convierte una pantalla sencilla.

### Atributos

Los elementos Atributos del menú Imagen cambian los colores de las celdas y
dejan los puntos donde están. Invertir intercambia tinta y papel en cada
celda y conserva brillo y parpadeo. Borrar escribe la tinta, el papel, el
brillo y el parpadeo actuales en cada celda; las casillas «usar existente»
conservan lo que ya tiene cada celda. Voltear horizontalmente y Voltear
verticalmente reflejan los colores de las celdas. Cada orden actúa sobre la
selección (todas las celdas que toca) o sobre toda la imagen si no hay
selección, y se deshace en un solo paso. Los elementos aparecen atenuados en
los modos sin colores de celda (Timex Hi-res, Layer 2, LoRes), mientras flota
un sello y en una capa bloqueada.

Cambiar... busca celdas por sus colores y las reemplaza. Buscar indica qué celdas coinciden: cada campo es un valor o Cualquiera. Reemplazar por indica en qué se convierten: cada campo es un valor o Mantener. El cuadro muestra cuántas celdas cambiarán antes de pulsar Aceptar, y Aceptar se deshace en un solo paso. GigaScreen tiene un grupo para la Pantalla A y otro para la Pantalla B; en ULAplus, CLUT 0-3 ocupa el lugar de Brillo y Parpadeo. Cancelar no cambia nada.

### Puntos

Los elementos Puntos del menú Imagen cambian los puntos y dejan los colores en sus celdas. Voltear horizontal y Voltear vertical reflejan los puntos. Invertir puntos y colores también intercambia la tinta y el papel de cada celda, así que la imagen se ve igual. No se ofrece en modos sin colores de celda (Layer 2, LoRes, Timex Hi-res), y aparece en gris mientras flota un sello. En ULAplus y ULANext tampoco se ofrece, porque intercambiar tinta y papel cambiaría el aspecto de la imagen.

La opción Mover de la sección Desplazar del panel de Transformar decide qué se mueve. Puntos y colores (por defecto) mueve celdas completas con su papel. Solo puntos mueve los puntos un píxel o una celda cada vez. Solo colores mueve los colores de celda una celda cada vez. La cruceta tiene también las diagonales. Mientras flota un sello, Mover aparece en gris, porque un desplazamiento mueve todo el sello.

Las flechas siguen la misma opción Mover cuando hay una selección.
