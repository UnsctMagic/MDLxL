# MDLxL 0.40.4

- Einstellungen > Konfiguration > Dateisymbole: „MDLxL aus Windows entfernen“ nimmt MDLxL aus Windows heraus (Dateisymbole, „Öffnen mit“, Standard-Apps). Vor dem Löschen des MDLxL-Ordners verwenden. Die Wahl eines Dateisymbols fügt MDLxL wieder hinzu.

## 0.40.3

- XFER ist schwer richtig hinzubekommen und bleibt daher in Arbeit: Prüfe jedes Ergebnis, manche Modelle musst du noch von Hand nachbessern.
- ANIM ist vorerst entfernt und kommt erst zurück, wenn es nützlich ist.
- XFER (Übertragung, F11): gibt einem Modell Bewegung von einem anderen Modell. Verpflanzen setzt das Modell mit allen Animationen auf das Skelett des anderen Modells; Retargeting übernimmt Bewegung Körperteil für Körperteil. Drehung, Position oder Mix bestimmt, wie die Gliedmaßen folgen. Siehe die XFER-Anleitung (PDF).
- Jeder Schieberegler hat ein kleines − und +, die ihn um einen Schritt bewegen.
- Scheitelpunkteditor: Das neue Werkzeug Schneiden (Taste I) teilt ein Dreieck an einem neuen Punkt auf einer seiner Kanten.
- UV Wrapper: Einpassen schiebt die gewählten UVs in einen Bereich, den du auf der Textur markierst. Textur ersetzen… steht am Ende der Materialzeile. RGB-Vorschau zeigt wieder das RGB des ganzen Modells.
- Bewegung: Bewegungspfad zeichnet den Weg der gewählten Knochen (die Farbe steht unter Einstellungen > Darstellung > Editorhilfen). Lokale Achsen dreht die Griffe von Drehen mit dem gewählten Knochen. Ereignisse zeigen ihren Sound-, Blut- oder Spawn-Namen; ein Doppelklick auf ein Ereignis-Frame zeigt es in Animationen.
- Die Ansichten Oben und Unten drehen sich um die senkrechte Achse des Modells, statt es umzukippen.
- Eine laufende Animation pausiert, während du bearbeitest, und spielt danach weiter.
- Das Bearbeitungsfeld hat einen Ausblenden-Knopf. Schmale Ansichten zeigen die Kameraleiste als Symbole.
- FX: Schnellansichten behalten Looks, solange das Modell offen ist, und FX öffnet bei großen Modellen schneller. FX und EMTR speichern Bilder als .blp.
- EMTR: Beim Wechseln des Emitters spielt der Effekt nicht mehr neu ab. PRE2-Emissionsflächen zeigen in der Vorschau in die richtige Richtung.
- OptimizeXL: Ausdehnung berechnen bietet Voll oder Nur nötige (kleinere Datei). Ungenutzte Daten hält FX-Ebenen im Takt. Neu anordnen funktioniert bei Modellen mit kurzen Geoset-Grenztabellen.
- Hilfe > Problem melden… schickt mir direkt einen kurzen Bericht als reinen Text.
- KI: arbeitet ohne Unterbrechungen, KI-Arbeit ansehen spielt jeden KI-Schritt im Editor ab, mehr KI-Anbieter (zuerst Claude, dann Codex) und Zeichennotizen im UV Wrapper und in Bewegung.
- Knotenverwaltung: Die Soundsuche findet Sounds aus jeder Erweiterung.

Aktualisiere über Einstellungen > Konfiguration > Nach Updates suchen, oder mit dem portablen ZIP.
