# MDLxL 0.28.3 - Corrección urgente

**Correcciones**

- Collect Bit: guardar ya no falla cuando existe una textura diferente en BitsAndParts. Las piezas recopiladas guardan solo su MDX y conservan exactamente las rutas de textura del modelo de origen. No se copian ni sobrescriben archivos de textura.
- Se puede recopilar una pieza aunque sus texturas no estén cargadas. Se conservan la geometría, los materiales, las UV y las pistas de animación RGB.

**Actualización**  En 0.28.2, abra Settings > Configuration > Search for updates > Update and restart.
