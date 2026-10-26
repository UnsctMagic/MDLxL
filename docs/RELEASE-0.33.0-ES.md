# MDLxL 0.33.0 - Aprender, Crear en Movimiento y Cadáver automático

- **Aprender**: el botón **LER** abre un pequeño menú con **Modo de aprendizaje**, **Mostrar atajos** y **Ajustes de aprendizaje…**. Con Mostrar atajos activado, cada botón y ventana muestra su atajo en pequeñas letras verdes. Ctrl+J sigue activando y desactivando el Modo de aprendizaje. Tus ajustes y teclas propias de Shredder se conservan.
- **Alt y luego una tecla**: al pulsar y soltar Alt se muestran las letras de los atajos, y la siguiente tecla ejecuta ese atajo con Alt (Alt y luego R abre Recuperación). Mantener Alt y pulsar la tecla funciona como antes.
- **Espacio siempre reproduce o detiene** la animación, incluso justo después de hacer clic en una casilla, botón, deslizador o lista. Solo los campos de texto conservan el espacio.
- **Crear en Movimiento**: Movimiento tiene un botón **Crear** junto a su lista de animaciones. Funciona exactamente igual que Crear en Animaciones.
- **EMTR abre tus efectos**: si el modelo ya tiene cintas o partículas y no hay nada seleccionado, el Editor de emisores se abre en ellos en lugar del Laboratorio de efectos nuevos.
- **Texturas originales del juego para efectos**: las nuevas chispas, brillos y cintas de EMTR y los mapas HD auxiliares de Forge usan ahora las texturas propias de Warcraft III en lugar de imágenes creadas por MDLxL. Los modelos que usan las imágenes antiguas de MDLxL se cambian al abrirlos, en un solo paso de Deshacer.
- **Cadáver automático (prueba)**: un nuevo botón **CORP** ajusta un cadáver al último fotograma de la animación Death, crea Decay Flesh y Decay Bone y ajusta la visibilidad, con un solo clic. Un Deshacer devuelve el modelo a su estado.
- **Rotación**: Ajustes > Ratón tiene una sección Rotación donde cada editor puede usar **Pivot-based** (seguir un círculo alrededor del centro, por defecto) o **Lineal** (girar según la distancia arrastrada). Pivot-based ya no se atasca ni se invierte cuando el círculo de giro se ve de canto, por ejemplo el giro en Y en las vistas Front y Top.
- **VIS** vuelve a ser el diseño clásico de MDLVis: sin pestañas de modelos, botones de editor ni consola de IA, con la fila de casillas original y un pequeño botón **XL** para volver.
- **Barra superior**: botones izquierdos más grandes, una barra más fina y los botones WC3 a la derecha. Los botones Ocultar/Mostrar se han eliminado. Con la ventana estrecha, los botones de editor inactivos se acortan a su primera letra para que las casillas de visualización conserven sus nombres.
- **Vértices**: la casilla RGB Preview se sustituye por una casilla **RGB** entre las casillas de visualización. Muestra los colores y desvanecimientos del modelo de la animación Stand.
- **Recuperación** guarda un borrador por modelo y solo los 15 más recientes. El primer inicio de esta versión borra una vez los borradores antiguos (el borrador de un cierre inesperado se sigue ofreciendo primero).
- **Iconos de archivo**: también aparecen en archivos que has configurado para "Abrir siempre con" MDLxL.
- Los botones de ancho completo apilados (como Bake Sequence RGB / Bake All RGB) ya no se tocan.

**IA**
- La IA cuesta menos: las peticiones a la API de Claude se guardan en caché, cada petición tiene un límite de pasos y un límite de gasto opcional, y cada petición muestra lo que ha costado. Un chat ya no pasa en silencio a tu clave de API después de cambiar de conexión.
- Interruptor **Editing handbook** (icono de libro, desactivado por defecto): da a la IA reglas generales de edición de Warcraft III y guías paso a paso. Su atajo es W.
- **Offload**: los mensajes de seguimiento van directamente al ayudante correcto, las partes independientes de un modelo pueden trabajarse en paralelo y un ajuste opcional permite que los trabajos sencillos usen un modelo más ligero.
- Las imágenes de la IA ya no fallan tras chats largos, la IA puede hacer primeros planos de la selección y Ajustar a la selección funciona en Animaciones y Movimiento.
- La consola de IA ya no ralentiza el editor mientras se reproduce una animación.

**Actualizar** Abre Ajustes > Configuración > Buscar actualizaciones > Actualizar y reiniciar, o descarga el ZIP portátil completo desde la página de MDLxL.
