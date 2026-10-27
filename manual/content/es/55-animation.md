## Animación

PixULA anima de dos maneras. Una **animación de pantalla** cambia toda la
imagen de un fotograma a otro. Una **animación de sprite** cambia un bloque de
ella, una figura que camina o una bandera que ondea, mientras el resto de la
imagen se queda quieto detrás. Las dos respetan todas las reglas del modo de
pantalla: un fotograma está hecho de celdas de atributos enteras, así que nunca
parte los atributos de una celda.

### Empezar una animación

**Animación > Nueva animación de pantalla** convierte la imagen en el
fotograma 1. Cada capa pasa a ser animada: tiene su propio contenido en cada
fotograma.

**Animación > Nueva animación de sprite...** pide un nombre, un ancho y un
alto, una posición y cuántos fotogramas tener al principio. El tamaño se
redondea hacia arriba a celdas enteras del modo, y el diálogo dice en qué se ha
convertido: en el modo 8x1, 20 x 20 pasa a ser 24 x 20. Usar la selección toma
el tamaño y el lugar de una selección. Para colocar el sprite con un clic,
selecciona antes el bloque con la herramienta Selección (Tamaño:
Personalizado). **Nueva animación de sprite desde la selección** además lleva
el bloque seleccionado a la capa propia del sprite como fotograma 1. Una línea
de puntos justo fuera de su ventana muestra dónde está.

Una imagen puede tener varias animaciones; el selector de arriba del panel
Animación elige la que está abierta. El modo de pantalla no puede cambiar
mientras la imagen tenga animaciones.

### Fotogramas

El panel Animación muestra cada fotograma en pequeño, con su número y su
retardo. Haz clic en uno para ir a él, o pulsa `,` y `.` para el fotograma
anterior y el siguiente. Dibujas en el fotograma mostrado con cada herramienta,
igual que en una imagen fija: el conflicto de atributos, los modos de dibujo,
el Espejo, los sellos, el Flash y Deshacer funcionan como siempre.

Añadir pone un fotograma vacío tras el mostrado y Duplicar una copia de él;
Eliminar, Izquierda y Derecha lo eliminan y lo mueven. El retardo es el tiempo
que el fotograma queda en pantalla, en fotogramas del Spectrum de 1/50 s, y
Aplicar a todos da ese retardo a todos los fotogramas. Para llevar parte de un
fotograma al siguiente, cópiala (**Animación > Fotograma a sello** copia la
ventana de un sprite), ve al fotograma siguiente y coloca el sello. Deshacer un
paso hecho en otro fotograma te lleva de vuelta a ese fotograma.

**Animación > Sellos a fotogramas** hace un fotograma nuevo con cada sello de
la lista Sellos, colocado donde está aparcado; los sellos se quedan.

### Capas en una animación

Mientras hay una animación abierta, cada fila del panel Capas tiene un
interruptor Animada / Compartida. Una capa animada tiene su propio contenido en
cada fotograma; una compartida se ve igual en todos, como un fondo que dibujas
una vez. Hacer animada una capa la copia en cada fotograma; hacerla compartida
conserva el fotograma mostrado, y antes pregunta. Las capas nuevas se unen a la
animación abierta, y Combinar hacia abajo, Combinar selección y Acoplar actúan
sobre cada fotograma.

### Reproducir

Reproducir (Intro) reproduce la animación abierta sobre la imagen; un sprite se
mueve sobre su fondo, y el FLASH y el parpadeo GigaScreen siguen funcionando.
Primero, Anterior, Siguiente y Último recorren los fotogramas (mantén pulsado
Anterior o Siguiente para seguir), y Detener vuelve al fotograma donde empezó.
Un clic en la imagen o Escape pausa. Repetir reproduce los fotogramas en bucle,
una vez o de ida y vuelta. Velocidad reproduce más rápido o más lento sin
cambiar los retardos, y Reproducir fotogramas reproduce solo una parte.

### Calcar fotogramas

**Calcar** bajo un fotograma muestra ese fotograma atenuado mientras dibujas
los demás, como capa de vista previa en el panel Capas. El interruptor **Papel
cebolla** muestra igual el fotograma anterior y el siguiente, y te siguen
cuando cambias de fotograma. **Capa > Nueva capa de vista previa** añade uno de
ellos por separado.

Una capa de vista previa sigue la regla del sistema de capas: sus píxeles de
papel y sus celdas vacías son transparentes, la tinta de las capas de encima la
tapa, y se ve atenuada sobre lo que hay debajo. Súbela o bájala para ponerla
encima o debajo de la capa en la que dibujas. Cada una tiene su propia
opacidad, un tinte (fotogramas anteriores en rojo, posteriores en azul) y
mostrar u ocultar, y eliminarla quita solo la vista previa. Una vista previa
nunca forma parte de la imagen: nunca se dibuja en ella, ni se combina ni se
exporta, y se oculta mientras se reproduce.

### Exportar

**Animación > Exportar animación**:

- **Pantallas numeradas...** guarda cada fotograma como su propia pantalla de
  Spectrum, numerada en orden (`walk_001.scr`, `walk_002.scr` y así), en
  cualquier formato de pantalla que el modo sepa guardar. Cada archivo es
  exactamente lo que Guardar imagen como escribe para ese fotograma. Eliges el
  nombre, el primer número, las cifras y los fotogramas. Si el navegador puede
  escribir en una carpeta, eliges una; si no, las pantallas llegan en un solo
  `.zip`.
- **GIF animado** reproduce los fotogramas con sus retardos, incluidos el FLASH
  y el GigaScreen.
- **Hoja de sprites PNG** pone los fotogramas uno junto a otro, 16 por fila.
- **SevenuP, todos los fotogramas** escribe hasta 32 fotogramas en un `.sev`
  (modo estándar). Abrir un `.sev` de varios fotogramas crea una animación de
  sprite con ellos.
- **Cinta** escribe un SCREEN$ por fotograma en un `.tap` o un `.tzx`. Contiene
  las pantallas, no un programa que las reproduzca.
- **Sprites de Next** escribe una animación de sprite de 16 x 16 de los modos
  Layer 2 y LoRes como hoja `.spr`.

Las animaciones se guardan en los proyectos de PixULA, en el guardado de
recuperación y en las copias de seguridad.
