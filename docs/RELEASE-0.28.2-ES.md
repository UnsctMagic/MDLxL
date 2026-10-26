# MDLxL 0.28.2 - Rendimiento de marcadores y correcciones de edición

## Cambios

- Los marcadores de huesos, esqueleto y puntos de unión requieren menos tiempo de CPU al dibujarse. Se conservan los iconos, colores, tamaños, resaltados de selección y controles del ratón. En la prueba local con Blood Dragon Nightmare, el procesamiento conjunto de marcadores bajó de 23,8 a 6,7 ms. Esta medición corresponde a los marcadores, no al fotograma completo; el resultado depende del equipo. No hace falta modificar el modelo.
- Los Bits recopilados conservan sus propios materiales al guardarlos o reutilizarlos. Un material aparentemente equivalente que apunta a otra textura ya no puede sustituir al material de la pieza, evitando partes ausentes o incorrectas después de guardar.
- Se pueden soldar vértices sueltos antes de que tengan triángulos: primero se unen los puntos y después se crea una cara. Se mantiene la protección que impide eliminar todos los triángulos de una malla existente al soldar.
- Se actualizaron los créditos del proyecto y las atribuciones técnicas, conservando los avisos de las bibliotecas y recursos que utiliza MDLxL.

Esta versión incluye todos los cambios integrados desde 0.28.1: créditos (#248), soldadura de vértices sueltos (#249), materiales de Bits recopilados (#250) y renderizado de marcadores (#251).

## Actualización

Abra Settings > Configuration > Search for updates > Update and restart, o descargue el ZIP portátil completo desde la página de MDLxL.
