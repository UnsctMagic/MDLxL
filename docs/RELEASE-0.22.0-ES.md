# MDLxL 0.22.0 - Animador POSE y mejoras de edición

## Empezar a posar
1. Abre **Movement (F3)**. Elige una animación y un fotograma. Pulsa **POSE**.
2. Selecciona un control de mano, pie o cuerpo. Usa **Move** o **Rotate**. Mueve **Bend** para orientar el codo o la rodilla. Arrastra directamente, toma una flecha por su eje o usa un cuadrado para mover en su plano.
3. Mueve Body/Pelvis para posar el personaje conectado. Pulsa **Pin** junto a una mano, pie o pezuña seleccionada para fijarla; pulsa **Pinned** para soltarla.
4. **Add** crea un control: elige un símbolo, pulsa su hueso, revisa la cadena resaltada y pulsa **Add handle**. **Adjust chain** permite elegir Start, End y articulaciones de flexión. **Setup** edita controles existentes. Puedes seleccionar huesos en la vista y girar la cámara durante la configuración.
5. Una mira roja parpadea sobre el control que bloquea el movimiento. Suelta el anclaje o ajusta la pose. El botón de la mira activa/desactiva el aviso. La edición habitual de huesos sigue disponible.

El reconocimiento automático usa el esqueleto, la geometría y las animaciones existentes. Algunas estructuras necesitan Add/Setup. Cada arrastre terminado escribe claves nativas y admite Deshacer. Guarda como siempre.

## Otras novedades
- Controles conectados de torso y jinete, mejor reconocimiento de estructuras complejas y poses más rápidas en modelos grandes.
- Cuadrados de plano pequeños y fijos, flechas con tamaño máximo y resaltado neón al pulsar. POSE recuerda su visualización y restaura la vista normal al desactivarlo.
- **Fix and paste** repara referencias al pegar. La unión de geosets con el mismo material ofrece opciones para resolver conflictos.
- La proyección UV mantiene juntos los geosets seleccionados. **Triangles** subdivide las caras seleccionadas dentro de sus límites originales.
- La búsqueda **Vibe** mejora las coincidencias y la respuesta al escribir.
- Los cambios de cámara/modelo del retrato actualizan sus límites animados. No es una solución confirmada para todos los retratos negros en Warcraft III.

## Actualizar o descargar
1. Abre **Settings > Mouse** (Configuración > Ratón). Los controles de actualización están arriba.
2. Pulsa **Buscar actualizaciones** y después **Actualizar y reiniciar**. Guarda los cambios cuando se solicite y deja que el editor se cierre y reinicie. No lo abras durante la instalación.
3. Si falla o se comporta mal, usa [la descarga completa](https://www.lowpolyworks.com/mdlxl/). Extrae todo el ZIP en una carpeta nueva y ejecuta **MDLxL.exe**. Mantén juntas las carpetas incluidas. Conserva el perfil anterior y tus bibliotecas personales; no los borres.

**Aviso de lanzamiento:** El autor estará ausente al publicarse; las respuestas pueden tardar. Se comprobaron las poses, las claves nativas y el actualizador; no se probó una animación completa creada de principio a fin. Informa de los problemas y usa la descarga completa si hace falta.

[PDF - Español](https://github.com/UnsctMagic/MDLxL/releases/download/v0.22.0/MDLxL-0.22.0-Quick-Manual-ES.pdf)
