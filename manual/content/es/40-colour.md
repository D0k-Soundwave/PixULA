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

**XOR / Encima y XOR / Cada pasada** invierten los puntos en lugar de
encenderlos, y los dos dan a la celda los colores elegidos. XOR / Encima
invierte cada punto una vez por trazo, así que volver sobre tu propia línea en
el mismo trazo no cambia nada más. XOR / Cada pasada invierte un punto cada vez
que el trazo pasa por él: una pasada del pincel cuenta como una, por mucho que
el pincel se solape consigo mismo por el camino, pero un trazo que deja un punto
y vuelve lo invierte otra vez, así que un ocho se anula donde se cruza. Las
formas, las curvas, los rellenos y el texto son siempre una sola pasada, así que
con ellos los dos modos dan el mismo resultado.

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
