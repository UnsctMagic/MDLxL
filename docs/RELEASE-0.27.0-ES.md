# MDLxL 0.27.0 - AnimXL, nuevo Editor de emisores, modelado directo en Forja

## AnimXL (nuevo, experimental)

- AnimXL da forma a las animaciones de un modelo con efectos de estilo físico. Ábrelo con el botón rojo ANIM o desde el menú Módulos.
- AnimXL es experimental: el resultado puede variar según el esqueleto. Revisa la animación antes de guardar; Confirmar como nueva conserva la original.
- Efectos: Suavizado, Retraso, Asentamiento, Peso, Arrastre, Movimiento secundario, Impacto de pisada, Preparación, Exageración, Movimiento en reposo, Pausa y reacción y Simulación de caída. Ajustes predefinidos: Predeterminado, Pesado, Ágil, Relajado y Caída.
- Aplica los efectos a todo el esqueleto (Automático) o solo a los Huesos elegidos. Con Elegir tramo das forma solo a una parte de la línea de tiempo; las claves de fuera no cambian.
- Los pies se quedan apoyados, el agarre a dos manos se mantiene en el arma y los bucles siguen siendo continuos.
- Compara el resultado con En paralelo, Esqueleto original, Trayectorias (el camino que dibuja la punta de un hueso) y la gráfica de movimiento. Arrastra el rombo de una pose para cambiar cuándo ocurre.
- Confirmar sustituye la animación en un solo paso de deshacer. Confirmar como nueva conserva la original y añade una animación nueva.

## Editor de emisores (EMTR)

- Los emisores de partículas tienen dos pestañas, Aspecto y Movimiento, en lugar de seis. Cada ajuste aparece una sola vez.
- Durante su vida: una sola tabla fija Color, Tamaño y Transp. % Al nacer, A mitad y al Fin de la vida de la partícula.
- Las hojas de sprites se detectan solas. Fotogramas muestra los patrones que usa el propio juego para esa imagen (Toda la animación, Primera mitad, Fotograma fijo, En bucle…). Con "Custom…" eliges los fotogramas tú mismo.
- Las cintas caben en una sola pantalla con los ajustes que importan en el juego. La pista de reproducción muestra cuándo se ve la cinta: arrastra sus rombos, y + añade otra parte.
- Tamaño suave: clic derecho en la pista, arrastra los extremos verdes y Confirmar. La cinta crece o se encoge con suavidad entre claves.
- Las cintas nuevas brillan más junto a la hoja y se desvanecen hacia la cola.
- Ajustar manualmente muestra el texto MDL exacto de cualquier emisor. Pasa el ratón por una palabra resaltada para ver qué significa.

## Forja

- Forja se abre sobre una cuadrícula con las formas apoyadas en ella.
- Doble clic en una cara para seleccionarla, lista para Mover. Mantén E y arrastra para extruir; al soltar vuelves a Mover.
- Cortar crea secciones iguales o un corte donde hagas clic, en las caras elegidas o en toda la forma.
- Doblar, Abultar/Pellizcar, Estrechar, Biselar y Torsión ahora son tiradores en la vista. Arrastra el tirador dorado; ✓ conserva el cambio y Esc lo cancela.

## Animaciones

- Ahora se pueden mover, rotar y escalar huesos en animaciones globales.
- Al guardar una animación global nueva, queda donde MdlVis la busca: justo después de la lista de animaciones.

## Editor

- Plano de trabajo desactivado: la herramienta Mover ahora muestra también en Vértices y en Forja las flechas y los cuadrados de POSE. Arrastra una flecha para mover a lo largo de un eje, o un cuadrado para mover en un plano, como alternativa a Mayús + XY/ZX/YZ.
- Pestañas de modelos: con muchos modelos abiertos, las pestañas se estrechan con "…" (el final del nombre sigue visible) y la pestaña activa conserva su nombre completo. Ya no hay barra de desplazamiento: usa la rueda del ratón o las flechas pequeñas.
- Arrastra archivos desde el Explorador a MDLxL para abrirlos como con Archivo > Abrir: se encuentran las texturas junto al modelo, Guardar escribe en el mismo archivo, Archivos recientes lo recuerda y varios modelos se abren cada uno en su pestaña.
- Al cerrar con cambios sin guardar: Guardar arriba, ¿CANCELAR? en amarillo y Cerrar en rojo, separado abajo. Esc cancela.
- El Editor UV se queda dentro de su pestaña de modelo como una ventana pequeña y movible. El editor de vértices sigue disponible mientras está abierto.
- Copiar y pegar un geoset dentro del mismo modelo conserva sus huesos originales.
- POSE oculta el tirador de la pelvis cuando solo repite el del cuerpo.

## Correcciones

- Algunos modelos editados no se podían guardar ("Save verification failed … PivotPoints"). Ya se guardan.

## Actualización

En 0.26.0, abre Ajustes > Configuración > Buscar actualizaciones > Actualizar y reiniciar.
