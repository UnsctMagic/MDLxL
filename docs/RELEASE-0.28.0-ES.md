# MDLxL 0.28.0 - Vista de influencia de huesos, Apariencia más clara, Ordenar mi lío, sellos de Paint

## Movimiento

- Nuevo modo de visualización **Influencia de huesos**, y la vista por defecto de Movimiento. El modelo se vuelve un fantasma transparente y uniforme con el esqueleto dibujado encima. Las partes que mueve el hueso seleccionado se vuelven naranjas; las que lo siguen a través de huesos hijos, naranja claro.
- Movimiento conserva su propia vista. Vértices y los demás editores conservan la suya (Malla alámbrica por defecto).
- **F** alterna entre Vista texturizada y la última vista que elegiste en ese editor: Malla alámbrica ↔ Texturizada, Influencia de huesos ↔ Texturizada.
- **Huesos** y **Esqueleto enfocado** empiezan activados en Movimiento; **Esqueleto** empieza desactivado. MDLxL recuerda los interruptores de visualización que cambies la próxima vez que lo abras.
- El interruptor **Huesos** es común a Huesos, Movimiento y Animaciones. Los huesos que muestra Esqueleto enfocado se pueden pulsar aunque Huesos esté desactivado.
- Los paneles derechos de todos los editores comparten un ancho, 240 px por defecto. Arrastra el borde izquierdo del panel para cambiarlo; haz doble clic en el borde para restablecerlo.

## Ajustes → Apariencia

- Apariencia muestra una página cada vez. Elige una página en la lista de la izquierda: Ajustes predefinidos, Interfaz, Ventana gráfica, Mallas, Vértices, Huesos y esqueleto, Influencia de huesos, Controladores, Listas y carpetas, Vista cuádruple, Ayudas del editor, Citadel Paint.
- **Huesos y esqueleto**: estilo de hueso (Cubos y líneas sombreadas, Articulación y cono, Barra), estilo de conector (Sombreado, Afilado), colores de huesos, huesos raíz, el hueso seleccionado, su padre y sus hijos, y grosor de conector y de resaltado de la cadena, con vista previa. La cadena seleccionada se resalta con la misma forma. Los colores de los huesos vuelven a seguir estos ajustes.
- **Mallas**: estilo **Todas las aristas** o **Líneas ocultas** (en Malla alámbrica, las líneas detrás de la malla se ven como guiones tenues) e intensidad de las líneas ocultas.
- **Influencia de huesos**: opacidad del fantasma y sus tres colores.

## Ordenar mi lío

- Se abre con una lista de lo que contiene el modelo, agrupada por textura: geosets, materiales, diferencias y la corrección propuesta.
- Tú eliges qué correcciones aplicar; solo se aplican esas.

## Citadel Paint

- Los sellos detallados como Silver Chainmail se mantienen nítidos al acercar la vista o en zonas UV pequeñas, y al pasar el ratón se ve el resultado real antes de hacer clic.
- Nueva herramienta **Difuminar** (N) junto a Borrar: arrastra para empujar y extender los colores pintados.
- **Copiar textura** (Ctrl+Alt+C) y **Pegar textura** (Ctrl+Alt+V) llevan la textura pintada a Photoshop o GIMP y de vuelta.
- **Trazos** (Mayús+Z) lista tus trazos; deshaz o restaura un trazo mientras los posteriores se mantienen.

## Forja

- Mayús+doble clic añade una cara a las caras ya seleccionadas.
- Los cortes siguen el contorno de la cara y las extrusiones mantienen la geometría más simple: sin puntos de más ni astillas finas.

## OptimizeXL

- Insanity Fixer avisa cuando vértices con peso mezclan un hueso escalado a cero. En el juego esos vértices se estiran en picos largos, aunque el modelo se vea bien en el editor. El aviso muestra la primera animación afectada; nunca cambia el modelo.

## Editor

- Los archivos MDL, MDX y de proyecto de Paint tienen su propio icono en el Explorador. Elige uno en Ajustes → Configuración → Iconos de archivo.
- El Editor UV se abre ampliado. Sustituir una textura reutiliza el material y la textura existentes en lugar de añadir copias nuevas cada vez.
- Funciona mejor en PCs sin tarjeta gráfica.
- Animaciones: Visibilidad y color sigue a los geosets marcados tras cambiar de pestaña, y los controles de Animaciones siguen visibles cuando se mantiene la rotación de cámara.

## Correcciones

- Ajustes → Configuración → Importar configuración vuelve a funcionar. Todos los archivos se rechazaban con «Conflicting shortcut G».
- Los efectos generados del Warcraft III actual (3.0.1) vuelven a verse en la vista previa, por ejemplo la sangre del caballero. Sus modelos ahora están en formato 1800. La primera aparición ya no congela la reproducción un momento.
- En Movimiento, hacer doble clic sobre emisores superpuestos vuelve a recorrerlos con los huesos visibles.
- Deshacer tras Importar pieza completa (BitsAndParts) quita la pieza en un solo paso.
- Los nombres largos de las pestañas de modelos se leen correctamente con lectores de pantalla.
- Ya no aparece un error poco frecuente de la vista previa al cambiar de editor rápidamente.
- La etiqueta secundaria de una fila seleccionada en la lista de Nodos se lee bien en los temas oscuros.
- La exportación MDX ya no escribe LevelOfDetail -1 en geosets de Reforged.

## Actualizar

En 0.27.0, abre Ajustes > Configuración > Buscar actualizaciones > Actualizar y reiniciar.
