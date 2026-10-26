## Patrones y tramado

Una celda con dos colores no tiene tono intermedio. Para sugerir uno
intercalas los dos colores que tienes y dejas que el ojo los mezcle, y la
biblioteca de patrones existe para darte teselas que lo hacen con intensidades
conocidas.

Para usar una, activa **Usar patrón** en una herramienta que lo ofrezca (el
relleno y el pincel de patrón lo hacen) y elige una tesela del panel de
patrones.

Las teselas llamadas `density-NN` son generadas, y el número es la proporción
real de píxeles de tinta de la tesela: `density-25` tiene tinta en un cuarto de sus píxeles. Las familias
de semitono y ruido cubren la misma gama de grises con otra textura, así que
puedes cambiar el aspecto de un tono sin cambiar lo oscuro que es.

También puedes dibujar tus propias teselas en el Editor de patrones y
guardarlas en tu biblioteca junto a estas.

**Desde imagen.** El botón **Desde imagen...** del panel de patrones crea un relleno a partir de un archivo de imagen (PNG, JPG o GIF). Un cuadro muestra la pieza tal como se repetirá y ofrece Brillo, Contraste, Escala, Tamaño de pieza (cuadrado de 8, 16 o 32 píxeles) y los mismos 31 métodos de tramado que el importador; por defecto, Floyd-Steinberg. Las partes oscuras de la imagen se convierten en píxeles de tinta. Aceptar añade la pieza a tu propia biblioteca con el nombre del archivo - un segundo archivo con el mismo nombre pasa a ser "nombre 2" y nunca sustituye al primero - y la deja como patrón actual, lista para el relleno y el pincel de patrón.

{{patterns}}
