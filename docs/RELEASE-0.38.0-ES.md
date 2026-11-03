# MDLxL 0.38.0

**Diseño y geosets**
- Los controles del modelo pasan a la barra superior: la conversión MDX y DPI/Scroll están junto al idioma, el color de equipo y **Suave**. Los modelos abiertos son pestañas en la parte inferior. **Ajustes > Complementos…** abre el panel de complementos. Desaparecen los mensajes de estado rutinarios; los errores aparecen brevemente sobre la línea de tiempo.
- **Conjunto compacto** es la nueva lista de geosets predeterminada: casillas numeradas en lugar de la lista con marcas. **Ajustes > Apariencia > Interfaz** ofrece **Conjunto compacto**, **Conjunto clásico** y **Color del Conjunto compacto**. VIS siempre muestra **Conjunto clásico**.
- Los grupos de geosets son pestañas en lugar de un desplegable. **Nueva pestaña** (+) y las acciones de **Pestaña** están en el encabezado **Geosets**.
- Haz clic derecho en un geoset para **Ocultar Geoset** y **Mostrar siempre**. Con **Ocultar extras** activado, fijar la visibilidad de un geoset a 0 ya no lo saca de la lista mientras trabajas.
- Un solo conjunto de iconos basado en MDLVis para todas las barras (mano = **Mover**, herradura = **Rotar**, lupa = **Escalar**); la herramienta activa sigue iluminada.
- Clic derecho en **Huesos** para elegir **Ayudantes** y **Huesos** en Huesos, Movimiento, Animaciones, POSE y VIS. Vista muestra los mismos controles en VIS y XL.

**Mover y rotar**
- **Restricciones del plano**: un mismo gizmo para **Mover** y **Rotar** en todos los editores 3D, como en MDLVis. En la vista cuádruple, cada panel Frontal/Superior/Lateral usa su propio plano; Perspectiva conserva la elección XY/ZX/YZ.
- Al mantener Mayús durante un movimiento restringido aparece un candado naranja con el eje bloqueado junto al puntero.
- Todos los arrastres se actualizan una vez por fotograma: UV Wrapper, el movimiento de mallas y el giro de cámara ya no van con retraso. El punto donde sueltas no cambia.
- Mover vértices en la vista cuádruple ya no va con retraso y la geometría ya no desaparece en las vistas ortográficas.
- UV Wrapper: **Zoom** agranda o reduce la selección en cualquier dirección de arrastre; **Rotar** gira uno a uno con el ratón e ignora los ajustes de rotación 3D. **Líneas** y **Selección a través** están justo al lado de **Selección en vista previa**.
- Movimiento y Animaciones: el cuadro **Rotar alrededor del eje** queda bajo **Secuencia actual**.

**Efectos**
- **FX** (creador de animaciones globales) da a partes de tu modelo aspectos permanentes con sus propias secuencias globales, como runas brillantes, agua que fluye o pieles de terreno. Cada aspecto tiene sus capas y **Duración del ciclo**; **Abrir en EMTR** abre su emisor en el editor completo.
- EMTR añade efectos igual que las cintas: elige un efecto de la **Biblioteca**, se coloca en los vértices seleccionados sobre su hueso y luego **Crear** o **Cancelar**. La navegación es la misma que en la Biblioteca principal.
- Las nuevas cintas de arma de EMTR usan la imagen de estela de arma de Blizzard, así que el borde brillante se queda en el arma durante el golpe.
- La pestaña **Movimiento** del **Editor de emisores** funciona en modelos sin animaciones; **Colocar ráfaga en el cabezal** explica que antes hace falta una animación.
- Sphereomancer mantiene estable la vista previa al editar, parte de las formas de colisión del propio modelo, ofrece preajustes (**x2 unidad estándar** por defecto) y **Añadir esfera** / **Añadir cuadrado**. Cada forma tiene una casilla numerada que se puede arrastrar.

**Biblioteca y piezas**
- Las texturas de la **Biblioteca** y todos los selectores de texturas ofrecen **Estilo del Editor de mundos** (predeterminado) junto a **Estándar**: explora las texturas por entrada del Editor de mundos, como los modelos.
- Bitz **Reemplazar pieza** toma la visibilidad de la pieza que reemplaza; las importaciones completas reciben la visibilidad estándar de cadáver.
- Un aviso **Corregir modelo** repara valores que Warcraft III solo puede guardar como fotogramas clave antes de Guardar, Huesos, Movimiento/Animaciones, **Gestores** y **Exhibición**. Antes esos modelos no se podían guardar.
- Barra de vértices: **Soldadura nuclear** une los vértices seleccionados en el mismo punto cuando sus geosets comparten material. **Separar por partes sueltas** y **Separación total** comparten fila.
- Auto Corpse: una pieza agarrada tiene un tirador para subirla o bajarla, y los arrastres siguen al ratón con cualquier **Tamaño**.

**IA**
- Se eliminan los pájaros de Offload. Cada pestaña de modelo conserva su propio chat directo; varias pueden trabajar a la vez y los chats antiguos siguen abriéndose.
- La IA nombra los geosets por el número que muestra la lista **Geosets**, consulta las funciones del editor en un solo paso y puede medir una regla en cada fotograma de cada animación.

**Correcciones e inicio**
- Si Windows no puede iniciar WebGL, MDLxL vuelve a intentarlo una vez con renderizado por software, sin editar accesos directos.
- Los modelos abiertos con doble clic se abren en el MDLxL instalado, no en una copia de prueba que se ejecutó por última vez.
- El menú **Añadir forma** de Forge vuelve a cerrarse con un segundo clic, un clic fuera o Escape. El menú de idioma ya no queda tapado por la barra del retrato.
- Los controles de visualización dicen **Velocidad de reproducción**; el control que cambia el tiempo del modelo dice **Velocidad de animación**.
- Los puntos cuadrados de los vértices ya no quedan ocultos tras materiales mezclados.
- **Ayuda > Comprobación del modelo** muestra solo los resultados del comprobador de Hive; ya no se mezclan las advertencias estructurales propias de MDLxL.
- Actualizaciones: esta versión también acepta el nombre de descarga fijo que se usará desde 0.39.0. Las copias más antiguas deben actualizar primero a 0.38.0.
