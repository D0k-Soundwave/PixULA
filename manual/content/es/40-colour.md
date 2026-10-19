## El color

En los modos clásicos no eliges un color para un píxel. Eliges los dos colores
que usará toda una celda, más dos indicadores.

- **TINTA** es el color de los píxeles de tinta.
- **PAPEL** es el color de los píxeles de papel.
- **BRILLO** sube ambos a su versión más clara. Hay un indicador de Brillo por
  celda, así que Tinta y Papel tienen brillo juntos o ninguno lo tiene.
- **FLASH** intercambia Tinta y Papel unas dos veces por segundo en el hardware
  real.

El botón izquierdo del ratón dibuja píxeles de tinta. El derecho dibuja píxeles
de papel y fija los mismos cuatro atributos que fijaría el izquierdo. En un
lápiz, el botón lateral hace lo mismo que el botón derecho.

El **borrador** hace algo distinto de ambos. Convierte los píxeles de tinta en
píxeles de papel y deja intactos los atributos de la celda, incluso cuando borra
el último píxel de tinta de la celda. Para borrar también los atributos, vuelve
a pasar el borrador sobre la celda vacía con un trazo nuevo: Tinta, Papel,
Brillo y Parpadeo vuelven a negro sobre blanco, y en una capa superior la celda
vuelve a ser transparente. Una celda que aún tiene píxeles de tinta conserva sus
atributos por muchas veces que pases el borrador.
La opción **Atributos** de la goma, visible en los modos de pantalla con
atributos de celda, cambia esto: Poner los actuales borra los píxeles de tinta y
da a la celda los atributos de la barra, como la herramienta de borrado de ZX Paintbrush, y
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

La franja superior tiene tres botones: **Modo de dibujo**, **Herramienta de
celda** y **Espejo**. Cada uno muestra la opción en vigor. Haz clic y debajo se
abre una pequeña cuadrícula con las demás opciones; haz clic en una y la
cuadrícula se cierra. Pulsa Escape, o haz clic en cualquier otro sitio, para
cerrarla sin cambiar nada. El modo de dibujo y el espejo funcionan juntos: con
XOR y Horizontal, un trazo es un trazo XOR reflejado. La herramienta de celda,
cuando hay una activa, se encarga de todos los trazos.

{{draw-modes}}

El pincel en todas sus formas, el relleno, las formas, la curva Bézier, el
texto, los sellos del panel **Sellos** y el botón izquierdo del degradado siguen
el modo de dibujo. El borrador, el cuentagotas, mover, pegar y borrar una
selección, el panel **Transformar**, la opción **Rellenar solo atributos** y los
botones Intercambiar y Recolorear lo ignoran.

**Recolorear tinta no es lo mismo que Recolorear.** Recolorear tinta y
Recolorear papel son modos de dibujo: recolorean cada celda que toca la
herramienta actual - unas pocas con un pincel pequeño, todas las que cubre un
rectángulo relleno - y el espejo se aplica. **Recolorear**, en el botón
Herramienta de celda, recolorea la celda entera bajo el puntero sea cual sea la
herramienta, ignorando el tamaño del pincel y el espejo. **Intercambiar**, del
mismo botón, funciona igual e intercambia la Tinta y el Papel de cada celda.
Cualquiera de los dos sigue activo hasta que lo apagues - elige Ninguna, elígelo
de nuevo, haz clic derecho en el lienzo o elige una herramienta o un modo de
dibujo - y la barra de estado lo dice mientras está activo.

**Solo atributos** es el tercero de estos modos de dibujo. Da a cada celda que
toca la herramienta actual la Tinta, el Papel, el Brillo y el Parpadeo a la vez
y no dibuja ningún píxel, como ZX Paintbrush con el dibujo de píxeles
desactivado. Cada una de las cuatro partes puesta en **usar el existente** queda
en cada celda como está: con el Papel en existente hace lo mismo que Recolorear
tinta, con la Tinta en existente lo mismo que Recolorear papel. Como en ellos,
ambos botones hacen lo mismo, y solo se ofrece en los modos de pantalla cuyas
celdas tienen atributos.

**Copiar atributos, Invertir píxeles e Invertir píxeles y atributos** son tres
herramientas de celda más en el mismo botón Herramienta de celda, y funcionan
igual: elige una y luego haz clic o arrastra sobre celdas. Cada arrastre se
deshace en un paso y la herramienta sigue activa hasta que la apagues. **Copiar
atributos** recoge los atributos que muestra la celda bajo tu primer clic y los
da a cada celda sobre la que arrastras; la barra de colores no cambia.
**Invertir píxeles** convierte los píxeles de tinta de cada celda entera en
píxeles de papel y los píxeles de papel en tinta, y deja los atributos (una
celda en blanco se llena). **Invertir píxeles y atributos** además intercambia
la Tinta y el Papel, de modo que cada celda se ve igual; sirve para
ordenar una imagen importada, se salta las celdas en las que dibuja también otra
capa y no se ofrece en ULAplus ni ULANext. Una herramienta de celda solo se
ofrece en los modos de pantalla donde puede funcionar: el botón Herramienta de
celda lista solo las que valen (y se oculta donde ninguna vale), e Invertir
píxeles también funciona en Timex Hi-res, donde los píxeles están en celdas de 8
por 8.

**XOR / Encima y XOR / Cada pasada** invierten los píxeles, de tinta a papel y
de papel a tinta, en lugar de dibujar píxeles de tinta, y los dos dan a la celda
los atributos elegidos. XOR / Encima invierte cada píxel una vez por trazo, así
que volver sobre tu propia línea en el mismo trazo no cambia nada más. XOR /
Cada pasada invierte un píxel cada vez que el trazo pasa por él: una pasada del
pincel cuenta como una, por mucho que el pincel se solape consigo mismo por el
camino, pero un trazo que deja un píxel y vuelve lo invierte otra vez, así que un ocho se anula donde se cruza. Las
formas, las curvas, los rellenos y el texto son siempre una sola pasada, así que
con ellos los dos modos dan el mismo resultado.

**Inverso** intercambia lo que hacen los dos botones del ratón: el izquierdo
dibuja píxeles de papel y el derecho píxeles de tinta, como INVERSE 1 en BASIC. Se activa en Preferencias, o con Mayús+I, y la barra de estado dice «Inverso
activado» mientras lo está. No cambia nada en Recolorear tinta, Recolorear papel,
Solo atributos ni en los dos modos XOR, que dan el mismo trabajo a ambos botones, y la barra de
estado lo dice. El texto y los sellos dibujan sus letras y formas en píxeles de papel en lugar
de píxeles de tinta, un patrón pone sus píxeles de tinta como píxeles de papel y
sus píxeles de papel como tinta, y el relleno rellena con píxeles de papel con
el botón izquierdo y con píxeles de tinta con el derecho. La
goma, Intercambiar y Recolorear lo ignoran. Se recuerda entre sesiones y se
guarda en los preajustes junto con el modo de dibujo.

**Núcleo de atributos.** Para el pincel redondo y cuadrado, los contornos de
formas y la curva de Bézier, Núcleo de atributos dice cuánto de una línea gruesa
toma los atributos de la celda. Una línea siempre dibuja todos sus píxeles de
tinta. Con Núcleo de atributos en 1 píxel o 4 píxeles, solo las celdas bajo el
centro de la línea, una línea de ese ancho que sigue su centro, toman tus
atributos; las demás celdas bajo ella reciben los píxeles de tinta con los
atributos que ya tenían, así que una línea gruesa choca con menos celdas. Toda
la línea, la opción por defecto, da tus atributos a cada celda que toca la
línea. La opción solo aparece en modos de pantalla con atributos de celda. Con
Espejo la línea reflejada tiene su propio núcleo, y con XOR las celdas fuera del
núcleo conservan sus atributos.

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

**Ranuras de paleta.** La paleta ULAplus y la paleta Next tienen cada una cuatro ranuras, en Imagen > Paleta (Ranura 1 a Ranura 4). La ranura en uso está marcada, y el editor de paleta dice qué ranura edita. Un documento nuevo empieza en la Ranura 1, y las demás guardan la paleta por defecto hasta que las uses. Elegir otra ranura cambia los colores con que se muestra la imagen y nunca cambia los atributos de la imagen. Cada elección es un paso de deshacer. Las ranuras se guardan en un proyecto y en la copia de seguridad automática, pero solo una vez que has usado una ranura; una imagen abierta desde otro tipo de archivo empieza en la Ranura 1 y las demás guardan copias de su paleta. Las exportaciones .scr, .tap y de imagen usan siempre la ranura en uso. Los modos de paleta fija (ULA estándar, los modos Multicolor, GigaScreen y los modos Timex) no tienen ranuras.

**Invertir paleta** (solo ULAplus) intercambia la mitad de Tinta (entradas 0-7) con la mitad de Papel (entradas 8-15) de cada una de las cuatro CLUT, en un paso de deshacer; hacerlo dos veces devuelve la paleta. Para invertir una imagen ULAplus de modo que se vea igual, usa Invertir paleta y luego Imagen > Atributos > Invertir. El borde sigue la mitad de Papel de la CLUT 0, así que también cambia de color. Los modos Next no tienen inversor de paleta, porque ULANext guarda la Tinta en 8 entradas de paleta y el Papel en 32.

**Teclas CLUT.** En los modos ULAplus, Ctrl+Mayús+1 a Ctrl+Mayús+4 eligen la CLUT 0 a 3, igual que la elección de CLUT de la barra de colores. En otros modos la barra de estado lo dice y no pasa nada más.

**Colores estándar.** En Ajustes > Preferencias, Colores estándar permite cambiar los 15 colores que muestran los modos Estándar, Multicolor, GigaScreen y Timex. El negro brillante es siempre negro. Los colores cambian lo que ves y lo que contienen las exportaciones de imagen (PNG, GIF, BMP, JPG); nunca cambian los bytes de los archivos .scr o .tap, y al importar una imagen se sigue comparando con los colores originales del Spectrum, así que la misma foto da la misma imagen en cualquier máquina. Las paletas ULAplus y Next son aparte. Aceptar aplica los colores, Cancelar no guarda nada y Restablecer estándar devuelve los originales. Se guardan en este navegador, no en el proyecto. Cargar .pal lee un archivo de colores estándar de ZX Paintbrush (256 bytes) y Guardar .pal escribe uno, que es la forma de llevar tus colores a otro navegador.

**Cintas de paleta.** Archivo > Guardar paleta como TAP escribe la paleta ULAplus como una cinta de 176 bytes. Cargada en un Spectrum con `LOAD ""` fija las 64 entradas de la paleta y luego carga el siguiente archivo de la cinta, así que una cinta de paleta puede ir delante de una cinta de imagen o de juego. Archivo > Cargar paleta y Archivo > Abrir leen cintas de paleta: las de PixULA y las de ZX Paintbrush. Una cinta de paleta entra en la ranura de paleta en uso como un paso de deshacer y no se convierte en el archivo abierto.

### GigaScreen

GigaScreen mantiene dos pantallas completas y las muestra alternándolas,
cincuenta veces por segundo. Tu ojo mezcla los dos colores de cada píxel en
uno, así que una celda con una Tinta y un Papel en cada pantalla puede mostrar
**cuatro** colores, y la imagen entera puede llegar a unos cien.

Nunca dibujas en una sola pantalla. Cada trazo escribe en las dos, y la barra
de color funciona por parejas:

- **Pantalla A** y **Pantalla B** tienen cada una sus muestras de Tinta y Papel
  y su propio **BRILLO**. El Parpadeo es un único ajuste para ambas.
- **Pintar** muestra los cuatro colores que resultan de esas elecciones,
  mezclados exactamente como los muestra el lienzo: Tinta en ambas pantallas,
  Tinta solo en A, Tinta solo en B y Papel en ambas. Elige uno y el botón
  izquierdo pinta con él. El botón derecho siempre pinta Papel en ambas
  pantallas.
- Elige la misma Tinta en las dos pantallas y la muestra superior izquierda de
  Pintar es ese color, sin mezclar: así se dibuja todo lo que no deba parecer
  mezclado.

El cuentagotas recoge todo esto: los atributos de ambas pantallas y cuál de los
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
  de 512 por 192. La alta resolución no tiene atributos de celda (cada pantalla
  tiene un esquema de color para toda la imagen), así que la barra muestra una
  fila de esquemas para la Pantalla A y otra para la Pantalla B, y Pintar
  muestra las cuatro mezclas de ambos. Son archivos `.hrg`.

Cambiar entre cualquiera de los modos de dos pantallas conserva ambas
pantallas, con las mismas reglas con que se convierte una pantalla sencilla.

### Atributos

Los elementos Atributos del menú Imagen cambian los atributos de las celdas y
dejan los píxeles donde están. Invertir intercambia Tinta y Papel en cada
celda y conserva Brillo y Parpadeo. Borrar escribe la Tinta, el Papel, el
Brillo y el Parpadeo actuales en cada celda; las casillas «usar existente»
conservan lo que ya tiene cada celda. Voltear horizontalmente y Voltear
verticalmente reflejan los atributos de las celdas. Cada orden actúa sobre la
selección (todas las celdas que toca) o sobre toda la imagen si no hay
selección, y se deshace en un solo paso. Los elementos aparecen atenuados en
los modos sin atributos de celda (Timex Hi-res, Layer 2, LoRes), mientras flota un sello sin atributos propios y en una capa bloqueada.

Cambiar... busca celdas por sus atributos y las reemplaza. Buscar indica qué celdas coinciden: cada campo es un valor o Cualquiera. Reemplazar por indica en qué se convierten: cada campo es un valor o Mantener. El cuadro muestra cuántas celdas cambiarán antes de pulsar Aceptar, y Aceptar se deshace en un solo paso. GigaScreen tiene un grupo para la Pantalla A y otro para la Pantalla B; en ULAplus, CLUT 0-3 ocupa el lugar de Brillo y Parpadeo. Cancelar no cambia nada.

### Píxeles

Los elementos Píxeles del menú Imagen cambian los píxeles y dejan los atributos en sus celdas. Voltear horizontal y Voltear vertical reflejan los píxeles. Invertir píxeles y atributos invierte los píxeles y también intercambia la Tinta y el Papel de cada celda, así que la imagen se ve igual. No se ofrece en modos sin atributos de celda (Layer 2, LoRes, Timex Hi-res), y aparece en gris mientras flota un sello. En ULAplus y ULANext tampoco se ofrece, porque intercambiar Tinta y Papel cambiaría el aspecto de la imagen.

La opción Mover de la sección Desplazar del panel de Transformar decide qué se mueve. Píxeles y atributos (por defecto) mueve celdas completas con su Papel. Solo píxeles mueve los píxeles un píxel o una celda cada vez. Solo atributos mueve los atributos de celda una celda cada vez. La cruceta tiene también las diagonales. Mientras flota un sello, Mover aparece en gris, porque un desplazamiento mueve todo el sello.

Las flechas siguen la misma opción Mover cuando hay una selección.

### Sellos

Cuando un sello está activo, el panel **Transformar** muestra cómo se coloca.

**Atributos** elige entre Solo píxeles y Atributos propios. Solo píxeles coloca los píxeles del sello con los atributos de la barra de atributos, como siempre. Atributos propios coloca los atributos que lleva el sello, celda a celda: un sello del Editor de mapas o uno copiado de una imagen en un modo con atributos de celda. Un sello copiado de la imagen empieza como Solo píxeles, así que un pegado cae exactamente como antes. Atributos propios coloca el sello en celdas enteras, ignora el modo de dibujo, la barra de colores y el interruptor XOR, y no se puede escalar, girar, curvar, voltear, invertir ni perfilar; el panel lo atenúa y dice por qué. Cambiar la forma de un sello Solo píxeles descarta los atributos que llevaba. Inverso sigue intercambiando lo que hacen los píxeles de tinta y los de papel. Si las celdas del sello tienen otro tamaño que las del modo de pantalla actual, solo es posible Solo píxeles.

**Dejar ver** (solo con Atributos propios) deja ver el atributo que ya hay en la página en lugar del del sello. Tinta, Papel, Brillo y Parpadeo tienen cada uno su casilla. ULAplus tiene una casilla CLUT para Brillo y Parpadeo juntos. En GigaScreen cada casilla cubre las dos pantallas.

**Píxeles de papel** decide qué hacen los píxeles de papel del sello. Dejar el fondo deja en paz el dibujo de debajo (un sello con atributos propios sigue recoloreando el Papel de debajo, salvo que se vea el Papel). Borrar el fondo convierte también el dibujo de debajo en píxeles de papel, en todo el rectángulo del sello. Los modos de dibujo sin opuesto (XOR, Recolorear tinta, Recolorear papel) y el interruptor XOR propio del sello dejan en paz los píxeles de papel, y el panel lo dice. Píxeles de papel está disponible en todos los modos de pantalla, también sin atributos de celda.

**Convertir a solo píxeles** descarta los atributos del sello para siempre y conserva sus píxeles. La opción Solo píxeles en Atributos los conserva, así que se puede volver. Cada cambio es un paso de deshacer.

Mientras un sello con atributos propios está activo, los comandos de Imagen > Atributos (Invertir, Borrar, los dos Voltear y Cambiar...) actúan sobre las celdas del sello en lugar de la imagen, flote o esté guardado. Ignoran la selección y nunca tocan los píxeles del sello, y una celda que el sello no cubre se deja como está. Voltear refleja las celdas de atributos del sello mientras sus píxeles se quedan donde están. Un sello de GigaScreen tiene un solo juego de atributos para las dos pantallas, así que el diálogo Cambiar muestra un grupo. Cada comando es un paso de deshacer. Con un sello sin atributos propios siguen atenuados.
