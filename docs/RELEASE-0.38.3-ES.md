# MDLxL 0.38.3

- **Corrección importante de OptimizeXL:** los modelos guardados después de usar OptimizeXL podían quedar dañados y mostrar largos picos estirados en Warcraft III, aunque en MDLxL se vieran bien. Lo mismo podía ocurrir al añadir por primera vez formas de colisión, cintas o puntos de anclaje a un modelo. MDLxL ahora guarda cada modelo en el orden en que lo lee el juego. Un modelo ya guardado de esa forma se repara la próxima vez que lo modifiques y lo guardes.
- La recuperación sigue guardando después de salir de Citadel Paint a mitad de un trazo, mientras haces clic continuamente en un modelo grande y mientras MDLxL se cierra.
- Consola de IA: **Local workspace** permite a la IA ejecutar sus propias comprobaciones y guardar archivos temporales para una tarea, tras preguntarte con una tarjeta Sí/No. Si editas el modelo mientras la IA trabaja, elige **Open as new model** o **Merge**; una combinación se deshace con un solo Undo.
- El español, el ruso y el chino traducen ahora todos los hallazgos del comprobador de Hive.
- Las copias anteriores a 0.38.0 vuelven a poder actualizarse desde la aplicación.
- El Shredder de la ventana de actualización permanece oculto tras el borde por el que asoma.

Actualiza desde Settings > Configuration > Search for updates > Update and restart, o descarga el ZIP portátil completo desde la página de MDLxL.
