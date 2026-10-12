# MDLxL 0.24.0 - Modelos HD y correcciones al guardar

## Modelos HD

- Los modelos HD de Reforged, con texturas HD o pesos de huesos, se abren solo para visualización con un aviso: los modelos HD aún no son compatibles. El guardado está desactivado y el mismo aviso aparece en la barra de estado y en Ayuda > Diagnóstico del modelo.
- Los modelos cuyo único contenido HD es un nombre de sombreador o valores de iluminación HD preguntan si quieres Abrir solo para visualización o Convertir a SD. La conversión elimina esos ajustes; el archivo no cambia hasta que lo guardes.
- El contenido HD pegado en un modelo SD, o colocado desde un ajuste predefinido de partículas, se convierte a SD y un aviso te lo indica. Un nombre de sombreador escrito en el inspector de materiales no se aplica.
- Los recursos de eventos HD y las piezas HD de BitsAndParts muestran el mismo aviso claro en lugar de fallar. Las vistas previas de eventos en los formatos 1300–1800 indican que necesitan un motor de renderizado de Warcraft compatible.

## Guardado

- Guardar como MDL ya no se bloquea cuando un emisor de partículas clásico (ParticleEmitter) tiene Visibilidad.
- Los guardados que se rechazaban por error ahora funcionan: un geoset con todos sus triángulos eliminados, una luz con color ambiental blanco y modelos cuyos ayudantes conservan una marca de hueso sobrante de otras herramientas.

## Actualizaciones y traducciones

- Las actualizaciones desde la aplicación ya se instalan en cuentas de Windows cuya carpeta temporal usa una ruta corta con «~1», habitual con nombres de usuario largos o con caracteres no latinos.
- Los nombres de los atajos de Forge, el interruptor de visualización Eventos y los nuevos avisos HD están traducidos al ruso, español y chino.
- Mejoras internas: más pruebas, archivos de código más pequeños y comprobaciones más rápidas. El comportamiento de MDLxL no cambia.

## Actualización

En 0.23.0, abre Ajustes > Configuración > Buscar actualizaciones > Actualizar y reiniciar. Si la actualización no se instala en una cuenta con carpeta temporal corta «~1», descarga una vez el ZIP portátil completo para Windows desde [Low Polyworks](https://www.lowpolyworks.com/mdlxl), extrae toda la carpeta y ejecuta MDLxL.exe. Las siguientes actualizaciones funcionarán desde la aplicación.
