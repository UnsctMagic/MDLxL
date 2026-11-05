# MDLxL 0.38.3

- **Correction importante d’OptimizeXL :** les modèles enregistrés après OptimizeXL pouvaient être corrompus et afficher de longues pointes étirées dans Warcraft III, alors qu’ils semblaient corrects dans MDLxL. Le même problème pouvait survenir après l’ajout des premières formes de collision, rubans ou points d’attache d’un modèle. MDLxL enregistre désormais chaque modèle dans l’ordre où le jeu le lit. Un modèle déjà enregistré de cette façon est réparé la prochaine fois que vous le modifiez et l’enregistrez.
- La récupération continue d’enregistrer après avoir quitté Citadel Paint en plein coup de pinceau, pendant des clics répétés dans un grand modèle et pendant la fermeture de MDLxL.
- Console IA : **Local workspace** permet à l’IA d’exécuter ses propres vérifications et de conserver des fichiers temporaires pour une tâche, après vous l’avoir demandé avec une carte Oui/Non. Si vous modifiez le modèle pendant que l’IA travaille, choisissez **Open as new model** ou **Merge** ; une fusion s’annule en un seul Undo.
- L’espagnol, le russe et le chinois traduisent désormais tous les résultats du vérificateur Hive.
- Les copies antérieures à 0.38.0 peuvent de nouveau se mettre à jour depuis l’application.
- Le Shredder de la fenêtre de mise à jour reste caché derrière le bord d’où il dépasse.

Mise à jour : Settings > Configuration > Search for updates > Update and restart, ou téléchargez le ZIP portable complet depuis la page MDLxL.
