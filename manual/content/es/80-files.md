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
