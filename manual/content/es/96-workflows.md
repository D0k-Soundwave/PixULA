## Flujos de trabajo

Algunas tareas habituales, de principio a fin.

### Tu primera imagen

1. Abre `PixULA.html`. Empiezas en ULA estándar con una pantalla vacía de 256
   por 192.
2. Activa la cuadrícula de celdas, junto a los controles de zoom, para ver los
   bloques de 8 por 8 en los que se guarda el color.
3. Elige un color de tinta en la barra de color o con las teclas 1 a 8, y un
   color de papel con clic derecho sobre una muestra.
4. Dibuja con el **Pincel**. Botón izquierdo para la tinta, derecho para el
   papel.
5. Haz zoom con `+` y `-`. Mantén la barra espaciadora y arrastra para moverte,
   o usa la herramienta **Desplazar vista**.
6. `Ctrl+Z` deshace. `Ctrl+S` guarda un proyecto `.pixula`, que conserva tus
   capas y ajustes además de la imagen.

Definir tus zonas de color antes que el detalle suele ahorrar trabajo, porque
un límite de color que no cae en un límite de celda seguirá cambiando colores
que ya habías resuelto.

### Calcar una fotografía

1. Abre el panel **Referencia** y carga tu fotografía. Queda detrás de tu
   dibujo con la opacidad, la posición y la escala que elijas, y nunca forma
   parte de la imagen que guardas.
2. Dibuja encima en una capa normal.
3. Si alguna vez la referencia se ve menos nítida que el original, el panel lo
   indicará y ofrecerá un botón **Buscar foto**. PixULA enlaza al archivo del
   disco, así que si la foto se mueve, solo queda una pequeña vista previa.

### Convertir una fotografía

Para que PixULA haga la conversión por ti:

1. **Archivo > Cargar**, y elige un `.png`, `.jpg` o `.gif`.
2. La ventana de importación muestra tres conversiones una junto a otra:
   Nítido, Suave y Plano. Cuál queda mejor depende por completo de la
   fotografía, así que vale la pena comparar las tres cada vez.
3. Ajusta el brillo, el contraste y el escalado hasta que la vista previa se
   lea bien, y acepta.

En ULAplus y en los modos Next la paleta se construye a partir de tu imagen,
así que no estás limitado a los dieciséis colores de la ULA. Eso suele marcar
una gran diferencia.

### Crear una fuente

1. **Archivo > Editor de fuentes**.
2. Empieza con la fuente ZX ROM, o importa un juego `.ch8` o `.chr`.
3. Selecciona un carácter y edítalo. Hay anchos de 4, 6 y 8 píxeles, pero
   estrechar descarta para siempre las columnas de la derecha, así que si
   experimentas, ve de estrecho a ancho.
4. Pon nombre a la fuente para añadirla a tu biblioteca.
5. Selecciona la herramienta **Texto**. Tu fuente aparece en su lista junto a
   la ROM. Escribe, coloca el texto y escálalo o gíralo antes de fijarlo: se
   vuelve a dibujar a partir de los glifos sobre la marcha, así que se mantiene
   nítido a cualquier tamaño.

### Construir un mapa con mosaicos

1. Dibuja en el lienzo las celdas que quieras usar como mosaicos.
2. **Archivo > Editor de mapas**, y captúralas en el juego de mosaicos.
3. Fija el tamaño del mapa y pinta. El botón izquierdo coloca un mosaico, el
   derecho borra, y el relleno sustituye una zona conectada de mosaicos
   iguales.
4. Exporta como `.zxtm` para seguir trabajando, o como ensamblador, C o binario
   en bruto para usarlo en un programa.

### Dibujar para el ZX Spectrum Next

1. Elige un modo Next en el menú Imagen: Layer 2 de 256, 320 o 640 de ancho, o
   uno de los modos LoRes.
2. En estos modos no hay choque de atributos; cada píxel lleva su propio índice
   de paleta. Lo que gestionas es una paleta de 256 colores de nueve bits,
   editada desde **Imagen > Editar paleta** y guardada como `.pal` o `.npl`.
3. Guarda la imagen como `.nxi`, que lleva la paleta dentro, o como `.sl2` para
   el mapa de bits en bruto.
4. Para sprites, usa **Archivo > Editor de sprites** y guarda la hoja como
   `.spr`.

Puedes convertir una imagen clásica a un modo Next y volver. Volver implica
ajustar de nuevo cada celda a dos colores, así que espera perder detalle en ese
sentido; PixULA te lo dice antes de hacerlo.

### Llevar una imagen al hardware real

- **Para un emulador**, guarda un `.scr`. Es el contenido en bruto de la
  memoria de pantalla del Spectrum, y todos los emuladores lo leen. El tamaño
  exacto depende del modo de pantalla: la tabla del capítulo de modos de
  pantalla lo da para cada uno.
- **Para una máquina real**, guarda un `.tap` o `.tzx`. Para añadir tu pantalla
  a una cinta que ya contiene otros archivos, usa **Archivo > Bloques de
  cinta**.
- **Para enseñarla a alguien sin Spectrum**, guarda un `.png`. Si la imagen usa
  celdas con flash, guarda un `.gif` y marca **Animar celdas FLASH**: escribe
  un bucle de dos fotogramas al ritmo del propio hardware, así que el parpadeo
  se conserva.
