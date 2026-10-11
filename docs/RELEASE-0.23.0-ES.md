# MDLxL 0.23.0 - POSE, archivos y rendimiento

## POSE y Movement

- Copiar/Ctrl+C captura la pose completa del fotograma actual; Pegar/Ctrl+V la restaura en otro fotograma con un solo paso de Deshacer. Mover una mano o un pie puede arrastrar suavemente el cuerpo conectado.
- El giro del codo o la rodilla mantiene la mano o el pie en su sitio y conserva su orientación. Focused Skeleton muestra los controles asignados y las articulaciones.
- Restrict, junto a Setup, mantiene el cuerpo quieto al mover una mano o un pie. Pin es más fácil de pulsar, permanece bajo el puntero, admite Espacio/Intro y conserva una marca visible.
- Controller empieza desplegado, con Highlight KF y Highlight Chain encima del selector Controller type. Restrictions empieza contraído.
- La apariencia de los controles, el esqueleto, los manipuladores y Pin se configura de forma independiente. Lordaeron es el valor predeterminado; cada sección Appearance tiene su propio selector y empieza contraída salvo Presets.
- Multiselect from List aparece debajo de Object en Bones y Movement, separado de los detalles por una línea. Multiselect y Billboarded incluyen explicaciones al pasar el puntero.
- Los arrastres de rotación responden de forma uniforme en los ejes y planos. Los extremos visibles tienen prioridad, la rotación numérica sigue disponible y Escape, la pérdida de foco o de captura del puntero cancela cambios sin terminar.

## Archivos de Warcraft

- Configuración > Warcraft III permite añadir carpetas CASC y archivos MPQ, recordarlos y eliminar entradas individuales.
- Los archivos personalizados aportan texturas y recursos de eventos antes que los datos del juego instalado; las texturas junto al modelo mantienen su prioridad. Sigue disponible la detección normal del juego.

## Biblioteca de emisores y vista 3D

- La biblioteca inicia o reanuda automáticamente un índice incompleto. La indexación usa un proceso separado, reintenta bloqueos temporales de archivos en Windows y evita recargas completas repetidas.
- Las páginas posteriores cargan sus vistas previas y el regreso desde un efecto sigue respondiendo durante la indexación.
- El límite de FPS ya no omite repetidamente los refrescos de pantalla. La reproducción sigue usando el tiempo realmente transcurrido.

## Actualización

En 0.22.1, abre Configuración > Ratón > Buscar actualizaciones > Actualizar y reiniciar. Después de actualizar, Updates está al principio de Configuración > Configuration. También puedes descargar el ZIP portátil completo para Windows desde [Low Polyworks](https://www.lowpolyworks.com/mdlxl), extraer toda la carpeta y ejecutar MDLxL.exe.
