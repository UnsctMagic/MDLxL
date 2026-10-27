# MDLxL 0.34.0 - Una IA que mira primero

**IA**
- **Mira primero y cambia una vez**: antes de su primera edición en un trabajo, la IA anota qué está mal de verdad, hasta dónde llega el problema (a menudo más allá de la zona que marcaste), qué debe seguir igual, al menos dos formas de arreglarlo y cuál eligió. MDLxL rechaza sus ediciones hasta que lo haga. Las ediciones simples, como "pon la transparencia en 0,5", no lo necesitan. Haz clic en el paso **Planificando el cambio** para leer el plan.
- **Versiones lado a lado**: la IA guarda el modelo tal como estaba al abrirlo y antes de cada trabajo, puede guardar sus propias versiones, compararlas y volver a cualquiera en un solo paso de Deshacer. Pedirle "vuelve a la versión buena" ya funciona.
- **Diario de decisiones**: para cada modelo, MDLxL recuerda cada trabajo de la IA: tu petición, qué eligió la IA y por qué, qué cambió, cómo salió y qué dijiste después. Cada trabajo nuevo lee las últimas entradas, así que las ediciones anteriores de la IA se tratan como decisiones que se pueden deshacer. El diario se conserva al cambiar entre Codex y Claude y con **Keep a summary**; **Wipe it all** lo borra.
- **Comprobación externa**: cuando la IA dice que una edición está terminada, otra IA que no vio su trabajo juzga tu petición, la lista de lo que debe conservarse y las imágenes de antes y después. Un resultado dudoso vuelve a trabajarse antes de que lo veas, y el chat muestra cada veredicto. Activada por defecto; cuesta una llamada de IA más por cada edición terminada; desactívala con **Comprobación externa** en **Ajustes de conexión**.
- **Investigación web**: un nuevo interruptor con un globo junto a **Editing handbook** permite que la IA busque en la web y lea páginas como los tutoriales de Hive Workshop. Desactivado por defecto. Funciona con Codex, Claude Code y la API de Claude.
- **Esfuerzo de razonamiento** en **Ajustes de conexión**: Predeterminado del proveedor, Media, **Alta** (por defecto) o Muy alto. Cuanto más alto, más cuidadosamente piensa y más consume de tu plan o créditos.
- Con **Editing handbook** activado, cada trabajo lleva ahora la guía completa que necesita (por ejemplo, la de enlaces a huesos para "las piernas atraviesan la falda"). Los patrones de modelos de referencia y las reglas que pases en el chat se tratan como pruebas que comprobar con tu modelo, no como órdenes.
- La IA puede hacer imágenes solo de las partes en cuestión, con sombreado simple, para juzgar mejor formas y huecos.

**Editor**
- **Glow Up**: los dos extremos del brillo del arma se arrastran libremente, por ejemplo hasta la cabeza de un martillo o un hacha, y **Origin brightness %** y **Weapon brightness %** son deslizadores separados. Arrastrar un control pausa la animación, y los controles son más fáciles de agarrar mientras se mueven.
- **Oferta de Actualización automática**: la primera vez que una copia de MDLxL arranca con la Actualización automática desactivada, pregunta una vez si quieres que te avise de una versión nueva. No se descarga nada sin **Actualizar y reiniciar**.
- La etiqueta del botón **CORP** es clara y legible.

**Actualizar** Abre Ajustes > Configuración > Buscar actualizaciones > Actualizar y reiniciar, o descarga el ZIP portátil completo desde la página de MDLxL.
