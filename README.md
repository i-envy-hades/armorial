# L'Armorial

Encyclopédie ouverte de l'héraldique — la grammaire, les émaux, les partitions,
les pièces et les meubles du blason, illustrés de figures SVG et sourcés un à un.

Les figures sont dessinées à neuf, sauf celles qui portent un crédit sous elles :
les bêtes, les chimères, les couronnes de rang et quelques meubles dont le tracé
nous dépassait sont empruntés à Wikimedia Commons sous licence libre.

**En ligne : <https://i-envy-hades.github.io/armorial/>**

## Les trois pages

| Page | Contenu | Illustrations |
|---|---|---|
| `index.html` | L'encyclopédie : 11 chapitres, glossaire, répertoires, bibliographie | SVG dessiné depuis `data/data.json`, plus les figures empruntées et créditées |
| `blasons.html` | Armoiries d'États, royaumes, ordres et maisons | Images Wikimedia Commons, créditées une par une |
| `personnages.html` | Armoiries de personnes ayant réellement existé | Images Wikimedia Commons, créditées une par une |

## Consulter le site en local

Les pages chargent leurs données par `fetch`, ce que les navigateurs bloquent sur
`file://`. Il faut donc les servir par HTTP :

```sh
python -m http.server 8000
# puis ouvrir http://localhost:8000/
```

Ouvrir `index.html` par double-clic affichera un message d'erreur, pas la page.

## Étendre le contenu

Tout vit dans `data/`. Aucun code à toucher.

1. **Ajouter un ouvrage** — une entrée dans `data.json` → `sources` :
   `{ auteur, titre, editeur, annee, isbn, type, note }`
2. **Enrichir ou créer un article** — dans `sections[].articles` :
   `{ titre, html, sources: ["joubert1977", …] }` — le tag « Source » se met à jour seul.
3. **Ajouter un terme** — dans `glossaire` : `{ terme, def, sources }`
4. **Ajouter une figure** — dans `tinctures`, `partitions`, `pieces`, `meubles`
   ou `couronnes` : elle sera dessinée automatiquement, à condition que son `kind`
   corresponde à un cas existant dans le moteur de rendu d'`index.html`.

**Règle du projet.** On reformule toujours le savoir avec ses propres mots et on
cite l'ouvrage. On ne copie jamais le texte ni les illustrations d'un ouvrage
protégé. Les points débattus entre sources sont signalés comme tels plutôt que
tranchés arbitrairement.

## Licence

Œuvre originale (textes de synthèse et figures SVG) sous
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.fr) — voir `LICENSE`.

Les illustrations de `blasons.html` et `personnages.html` proviennent de Wikimedia
Commons sous licence libre et restent la propriété de leurs auteurs ; chacune est
créditée sous elle. Les ouvrages cités en bibliographie ne sont pas couverts par
cette licence.
