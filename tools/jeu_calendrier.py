"""Écrit data/jeu.json : l'ordre des armes mystères de « L'Écu du jour » (index.html, la page d'accueil).

    python3 tools/jeu_calendrier.py liste.txt            # liste.txt : un nom de carte lisible par ligne

Le lecteur de blasonnement tourne dans le navigateur, pas ici : la liste des cartes lisibles se tire de la page
(`lire(texteAtelier(carte)).ok` sur chaque carte de blasons.json et personnages.json) et se passe en fichier.
Seules les cartes de « Blasons réels » et quelques personnages connus deviennent des armes du jour ; toutes les cartes
lisibles restent proposables comme réponse. L'ordre est mélangé avec une graine fixe, sans deux armes de la même rubrique
d'affilée. Un jour = une entrée ; la suite recommence quand la liste est épuisée.
ATTENTION : ne pas relancer sans raison. Réécrire l'ordre change les armes des jours déjà joués ; pour ajouter des cartes,
ajouter à la FIN de « ordre » dans data/jeu.json (le calendrier garde le début, la date « debut » et les jours passés)."""
import json, pathlib, random, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONNUS = {"Édouard III d'Angleterre", "Édouard de Woodstock, le Prince Noir", "Bertrand du Guesclin", "Jean-Baptiste Colbert",
          "Jules Mazarin", "Jacques Cœur", "Margrethe II", "Alexandre II de Russie", "Léopold Ier de Belgique", "Haakon VII",
          "Pie II", "Paul IV", "Georges Ier de Grèce", "René II de Lorraine"}

lisibles = {l.strip() for l in pathlib.Path(sys.argv[1]).read_text(encoding="utf-8").splitlines() if l.strip()}
rub = {}
for f, galerie in (("blasons.json", True), ("personnages.json", False)):
    for a in json.loads((ROOT / "data" / f).read_text(encoding="utf-8")):
        if a["nom"] in lisibles and (galerie or a["nom"] in CONNUS):
            rub[a["nom"]] = a.get("cat") or "Personnages"
noms = sorted(rub)
random.Random(2026).shuffle(noms)
# pas deux armes de la même rubrique d'affilée : on reprend la première qui diffère
ordre = []
while noms:
    i = next((k for k, n in enumerate(noms) if not ordre or rub[n] != rub[ordre[-1]]), 0)
    ordre.append(noms.pop(i))
sortie = {"debut": "2026-10-09", "essais": 6, "ordre": ordre}
(ROOT / "data" / "jeu.json").write_text(json.dumps(sortie, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(len(ordre), "armes du jour")
