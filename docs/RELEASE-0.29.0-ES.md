# MDLxL 0.29.0 - Attachemator, Biblioteca de Warcraft III, Glow Up, fondos de retrato

## Attachemator

- Nuevo en el modo Huesos → Herramientas. Coloca los puntos de enlace estándar (Origin, OverHead, Head, Chest, manos, pies, patas traseras de las monturas, Weapon) en los huesos correctos, como los tienen las unidades de Blizzard.
- Los puntos existentes se reconocen por su nombre, se mueven y se vuelven a emparentar; los que ya están bien no se tocan.
- Una ventana de vista previa muestra todos los puntos. Desmarca un punto para dejarlo como está, o arrástralo con el control Mover habitual. Nada cambia hasta **Confirmar**, que es un solo paso de Deshacer.

## Biblioteca de Warcraft III

- El botón **LIBR** abre todo el juego: pestañas **Texturas**, **Modelos**, **Sonidos** y **Todos los archivos**, con un filtro de versión (Classic, Reforged, Forsaken Kingdom y más).
- Los modelos se pueden explorar con **Estilo del Editor de mundos** (raza › unidades, héroes, edificios, hechizos, objetos, decoraciones, cada uno con su icono del juego) o por las carpetas del propio juego.
- Búsqueda instantánea entre unos 175 000 archivos. Busca `painting`, `art` o `loading screen` para encontrar solo las ilustraciones del juego.
- Los modelos muestran una vista 3D giratoria con selector de animación. Doble clic o **Abrir en el editor** lo abre en una pestaña nueva. Los sonidos suenan al hacer clic; cualquier archivo se puede sacar con **Guardar una copia…**.
- Si una textura ya está en el modelo, al añadirla se pregunta: **Usar material existente** o **Crear un material nuevo**.
- Los selectores de texturas (Replace Texture, Material Manager, EMTR, Forge, Citadel Paint) funcionan igual que antes.

## Glow Up (ahora en EMTR)

- Glow Up pasa de Forge a EMTR, junto a Añadir cinta. Crea el brillo de héroe como los héroes de Blizzard: tres planos de brillo de equipo que laten a los pies y una fila de cuadrados de brillo a lo largo del arma.
- Casillas Origin glow y Weapon glow (con selector de arma) y un control Brightness. El tamaño y la posición se ajustan arrastrando los controles en la vista previa, como con los emisores; la vista previa se gira con el ratón. **Crear** es un solo paso de Deshacer.

## Fondo de retrato

- **Add Background** en la barra del retrato (Movimiento y Animaciones) añade detrás del modelo el fondo de color de equipo al estilo de Warcraft, colocado para la cámara seleccionada como en los retratos SD de Blizzard. Solo se ve en las animaciones Portrait.
- Si el modelo ya tiene uno, el botón dice **Refresh Background** y lo vuelve a colocar para la cámara actual.
- **▾** abre los controles Tamaño y Altura con una pequeña vista del encuadre del juego, y **Blizzard default**.

## OptimizeXL

- **Corregir todo** repara todos los problemas que informa el comprobador, muestra todas las reparaciones a la vez y vuelve a comprobar. **Aprobar todas las correcciones** las conserva. Los problemas que requieren una decisión ofrecen una **Opción** con un valor por defecto.
- Las vistas Antes y Después están una junto a la otra.
- **Guardar** escribe el resultado en tu modelo abierto (un paso de Deshacer). El primer guardado ofrece **Hacer copia y guardar**.

## Forge

- Copia o refleja una extrusión o un bisel sobre la misma forma y colócalo con Mover, Rotar y el Plano de trabajo. El control **Imán** lo mantiene sobre la superficie.
- Mantén **Shift** para ajustar cortes y extrusiones a los que coinciden. **Mezcla** une caras planas contiguas para extruirlas como una sola superficie.

## Editor

- Zoom en **Perspectiva**: al alejar, la cámara retrocede en lugar de abrir el objetivo, así las partes cercanas ya no se estiran por la pantalla.
- Los **eventos de sonido** muestran todos los sonidos del juego, agrupados por uso (Hechizos, Armas y proyectiles, Unidades…), con filtros ROC / TFT / RE / FK. Los eventos Sangre y Huella muestran solo los suyos.
- **Apariencia → Huesos y esqueleto** tiene por separado Estilo de hueso (Cubos, Rombos) y Estilo del esqueleto (Sombreado, Afilado, Cono, Barra).
- Editor UV: el teclado numérico mueve las UV seleccionadas en ocho direcciones.
- Los emisores en huesos orientados a la cámara ya no se mueven al girar la cámara mientras editas. Resaltar claves también muestra las claves de visibilidad del emisor.

## Correcciones

- Las etiquetas Huesos / Ayudantes / Refs se leen bien en los temas oscuros.
- POSE vuelve a poder pulsar los marcadores de Ayudantes (por ejemplo, la cabeza del Footman).
- Desplazar la rueda sobre el nombre de la animación ya no desplaza también el panel lateral.

## Actualización

Abre Ajustes > Configuración > Buscar actualizaciones > Actualizar y reiniciar, o descarga el ZIP portátil completo desde la página de MDLxL.
