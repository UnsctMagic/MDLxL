# MDLxL 0.25.0 - Editor de retratos, Ocultar extras, BITZ y pegado de RGB más limpios

## Retrato

- Nuevo editor de la cámara del retrato en Movimiento. Vista con marco de retrato muestra el modelo a través de su cámara de retrato, como lo muestra el juego en el panel inferior. Gira y acerca la vista con el ratón y pulsa Establecer vista actual para conservar el plano. Deshacer funciona.
- Nueva cámara añade una cámara encuadrada en la cabeza y los hombros. Si el modelo no tiene animación Portrait, el enlace "No Portrait animation · Create" la crea.
- El menú "⋯" reúne los controles extra: nombre y valores de la cámara, objetivos predefinidos, planos Front y Level, iluminación de retrato del juego, guías de composición y cambio entre Idle y Talk.

## Geosets

- Invertir se sustituye por Ocultar extras. Un clic oculta de la lista de geosets y de la vista los geosets de cadáver y de fondo del retrato (los que nunca se ven en Stand, Walk ni Attack). No se borra nada. Vuelve a pulsar para recuperarlos. Invertir sigue en el menú del botón derecho.

## BITZ

- Reemplazar pieza ahora coloca el Bit en el editor de vértices. Aplicar reemplazo lo deja en el centro de la pieza sustituida, seleccionado y con Mover activo, para colocarlo con las herramientas normales de vértices. Los huesos y pesos siguen viniendo de la pieza sustituida.
- Las vistas previas de BITZ y Collect Bit vuelven a girar con el ratón.

## Animación

- Un geoset pegado desde otro modelo recibe un único color RGB fijo y nunca trae consigo una secuencia global, así que ya no aparecen secuencias globales duplicadas.
- Establecer en secuencia, Set All y Bake RGB ahora funcionan con pistas que usan una secuencia global.

## Actualización

En 0.24.2, abre Ajustes > Configuración > Buscar actualizaciones > Actualizar y reiniciar.
