## Archivos

Hay dos cosas distintas que puedes guardar, y es importante elegir la
adecuada.

**Un proyecto** conserva tu trabajo tal como lo dejaste: cada capa, la paleta,
el modo de pantalla, tus herramientas y sus ajustes, la imagen de referencia y
la zona que estabas mirando. Es un archivo `.pixula`, escrito con
**Archivo > Guardar proyecto**, y es lo que debes usar mientras una imagen
sigue en curso.

**Una imagen** es una sola pantalla aplanada en un formato que entiende otro
programa: un `.scr` para un emulador, un `.png` para enseñarla, un `.tap` para
cargarla en hardware real. **Archivo > Guardar imagen como** los escribe.
Contienen la imagen y nada más, que es lo que quieres al entregar el resultado,
y no lo que quieres si piensas seguir trabajando en ella.

### Importar una imagen

Al abrir una foto u otra imagen (PNG, JPG, GIF) se muestran tres conversiones una junto a otra - Nítida, Suave y Plana - y haces clic en la que prefieras. Suave es la que convierte los tonos en puntos, y la lista **Tramado** bajo las vistas previas elige cómo: por defecto es el Floyd-Steinberg propio del importador, y la lista ofrece además los otros 30 métodos de ZX Paintbrush - umbrales, difusión de error, matrices de Bayer, puntos agrupados y superceldas. Elegir un método pasa a la vista previa Suave. Los métodos ordenados continúan a través de las celdas de atributos, de modo que el patrón recorre toda la imagen; la difusión de error se queda dentro de cada celda, porque cada celda tiene sus dos colores. En los modos Layer 2 y LoRes la lista aparece atenuada: esos modos conservan su propio tramado de color.

### Guardar parte de una imagen

**Archivo > Guardar selección como** lista los mismos formatos que Guardar imagen como, cada uno abierto solo si la selección le sirve. PNG, BMP y JPEG aceptan cualquier rectángulo. ZXP, SEV, ZED, ASM, C, BIN y ATR aceptan celdas de atributos completas: la selección se ajusta primero a celdas y la barra de estado lo dice. ColorTiles acepta teselas completas de 16x16. Los formatos que son un volcado de una pantalla entera (SCR, cintas, MLT y similares) solo están abiertos cuando la selección es la pantalla entera. ASM, C, BIN y ATR escriben la parte fila a fila: el mapa de bits como un bloque de bytes por fila, de arriba abajo, y los atributos un byte por celda; lo hacen en los modos clásico, multicolor y ULAplus. Una selección a mano alzada o elíptica guarda su rectángulo envolvente. Un formato cerrado dice por qué al señalarlo. Guardar imagen como guarda la imagen entera e ignora la selección.

### Una imagen nueva desde una selección

**Edición > Nueva imagen desde la selección** convierte la selección en la imagen entera. La selección se ajusta primero a celdas completas. Pregunta antes de hacer nada, y Ctrl+Z devuelve la imagen anterior. Se conservan todas las capas, recortadas a ese bloque, que pasa a la esquina superior izquierda; el resto queda vacío, y el fondo allí es papel blanco. El modo de pantalla sigue igual y la imagen queda sin título, así que el siguiente Guardar pide un nombre.

### Guardado automático y copias

PixULA puede guardar tu trabajo en el almacenamiento del propio navegador cada
pocos minutos y ofrecértelo si una sesión termina mal. Está desactivado hasta
que elijas la frecuencia: ajusta **Guardado automático cada (minutos, 0 =
desactivado)** en Preferencias, en General.

También puedes elegir una carpeta del disco, y cada guardado automático
escribirá en ella una versión numerada: `picture V1.pixula`,
`picture V2.pixula`, etc. La numeración se lee de la carpeta cada vez, así que
al reabrir una imagen la serie continúa en vez de volver a V1, y dos sesiones
sobre la misma imagen comparten un único juego de versiones. Indica cuántas
conservar en Preferencias; por defecto son 20.

Algo que conviene saber. Un navegador no vuelve a abrir una carpeta elegida en
una sesión anterior sin que lo confirmes, y el temporizador del guardado
automático no puede pedirlo por ti. Así que la primera copia tras recargar se
detiene y te espera. Preferencias tiene un botón **Reanudar copias**, y
pulsarlo es la confirmación que espera el navegador.

{{formats}}
