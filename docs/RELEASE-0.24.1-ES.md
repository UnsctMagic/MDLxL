# MDLxL 0.24.1 - Velocidad de animación fluida

## Velocidad de animación

- Arrastrar un control deslizante de velocidad de animación ya no va lento. La animación se recalcula una sola vez, al soltar el control, y cada arrastre es un solo paso de deshacer.
- Cada control de velocidad (Animation Actual Speed, Master Controller y cada animación en Adjust All Speed) tiene ahora una casilla numérica. Escribe una velocidad de 1 a 300% y pulsa Enter.
- Mientras se escribe la nueva velocidad, aparece una barra fina bajo el control.
- Se eliminó Remember Original Timing. Un cambio de velocidad se guarda solo como la sincronización real del modelo, sin datos adicionales de MDLxL en el archivo, así que al volver a abrir un modelo sus velocidades se muestran al 100%. Los datos de sincronización guardados por versiones anteriores se eliminan la próxima vez que se guarde el modelo.

## Actualización

En 0.24.0, abre Ajustes > Configuración > Buscar actualizaciones > Actualizar y reiniciar.
