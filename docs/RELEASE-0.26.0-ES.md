# MDLxL 0.26.0 - NormalsXL renovado, guardado MDL corregido

## NormalsXL

- NormalsXL ahora recalcula las normales igual que Retera's Model Studio. Nunca añade ni quita vértices, así que el tamaño del archivo no cambia.
- Las normales se reconstruyen solo a partir de los triángulos, así que zonas enteras de normales erróneas, invertidas o vacías se corrigen con un clic. Las costuras de textura se suavizan y los bordes que el modelo ya separa siguen nítidos.
- Las partes en huesos distintos y las partes intercambiables no se suavizan entre sí.
- El panel es más sencillo: un control Ángulo de suavizado (90° por defecto), Mostrar normales, Aplicar y Cancelar.
- Las líneas de normales se ven en cuanto se abre NormalsXL: las amarillas son normales que cambia y las azules no cambian.
- Corregir orientación es un botón y un paso de deshacer propios. Gira los triángulos que miran al lado equivocado, también grupos enteros, y las partes cerradas vueltas del revés. Nunca añade vértices.
- Con vértices seleccionados, solo cambia la zona seleccionada.

## Guardado

- Los modelos con un color de geoset con el tinte desactivado, o con datos del editor MDLVis, ahora se pueden guardar como MDL. El juego ignora ambos, así que MDL los omite y la barra de estado lo indica. MDX los sigue conservando.

## Actualización

En 0.25.1, abre Ajustes > Configuración > Buscar actualizaciones > Actualizar y reiniciar.
