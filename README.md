# L'Armorial

Encyclopédie ouverte de l'héraldique : la grammaire du blason, les émaux, les partitions, les pièces et les
meubles, illustrés de figures SVG et sourcés un à un — avec, autour, des armoiries réelles, des frises
de lignées et un atelier pour composer les siennes.

**En ligne : <https://i-envy-hades.github.io/armorial/>**

Aucun framework, aucune étape de compilation : des pages HTML, des scripts, des fichiers de données JSON.
Pour modifier le contenu, on modifie un fichier JSON et on publie.

## Les cinq pages

| Page | Contenu | Données |
|---|---|---|
| `index.html` — **L'encyclopédie** | Douze chapitres (origines, écu, émaux, partitions, règles, pièces, meubles, blasonnement, ornements, droit du blason, droit comparé, brisures), glossaire et répertoire de plus de 300 termes, bibliographie, recherche. Les figures sont dessinées en SVG ; celles qu'on emprunte portent leur crédit. | `data/data.json` |
| `blasons.html` — **Blasons réels** | Armoiries d'États, de royaumes, d'ordres et de maisons : de vraies images de Wikimedia Commons, créditées une à une, avec leur blasonnement. | `data/blasons.json` |
| `personnages.html` — **Personnages** | Armoiries de personnes ayant existé, avec leur blasonnement. | `data/personnages.json` |
| `lignees.html` — **Lignées** | Les armes des souverains règne après règne, sur une frise qu'on fait glisser : rois de France, rois d'Angleterre, maison de Savoie, Habsbourg, papauté. | `data/frises.json` et un fichier par lignée |
| `atelier.html` — **L'Atelier** | On compose des armes (champ, pièce, meubles, ornements) ; le blasonnement s'écrit tout seul, dans l'ordre où un héraut le lirait. Lien de partage, export SVG et PNG, rappel de la règle des émaux, crédits de chaque figure empruntée. | `data/atelier.json`, `data/data.json` |

### Ce que sait faire l'Atelier

- **L'écu** : simple, écartelé (1-4 / 2-3, ou en quatre), avec ou sans écusson en abîme (« sur le tout ») ; quinze formes d'écu.
- **Le champ** : plein, partagé (parti, coupé, tranché, taillé, tiercé, gironné, traits ondé, crénelé, denché, engrêlé, cannelé, dancetté, nébulé…) ou rayé (fascé, palé, bandé, barré) ; neuf émaux, fourrures comprises.
- **La pièce** : chef, fasce, pal, bande, barre, croix, sautoir, chevron, bordure, orle, canton, franc-quartier, pairle — à bord droit, ondé, nébulé, dancetté, engrêlé, cannelé ou denché.
- **Les meubles** : près de quatre-vingt-dix — dont des bêtes (lion rampant, passant ou léopard, aigle à une ou deux têtes, cerf, cheval, griffon, dragon…) —, jusqu'à deux sortes ensemble ; nombre, disposition (en chef, en pal, 2 et 1, semé, en orle…), sens (contourné), réglages de taille et de position.
- **Les ornements** : couronnes de rang, heaumes (deux modèles, trois positions), lambrequins, panache, supports, colliers d'ordres, devise sur un bandeau.
- **La sortie** : le blasonnement, la liste des ornements, l'avertissement si la règle des émaux est enfreinte, un lien qui garde toute la composition, un export SVG ou PNG portant ses crédits.

## Consulter le site en local

Les pages chargent leurs données par `fetch`, ce que les navigateurs refusent sur `file://`. Il faut donc les servir :

```sh
python3 -m http.server 8000
# puis ouvrir http://localhost:8000/
```

Ouvrir `index.html` par double-clic affiche un message d'erreur, pas la page.

## Organisation du dépôt

```
index.html  blasons.html  personnages.html  lignees.html  atelier.html     les cinq pages (squelette et textes propres à chacune)
sitemap.xml                                                                  plan du site, pour les moteurs de recherche

assets/
  site.css          socle commun : polices, couleurs, bandeau, parchemin, animations
  chrome.js         bandeau de navigation et sceau du pied de page, communs à toutes les pages
  blason.js         le dessin héraldique : émaux, partitions, pièces (et leurs contours), meubles — partagé par l'encyclopédie et l'Atelier
  index.js .css     l'encyclopédie            atelier.js .css   l'Atelier
  lignees.js        les frises (son CSS reste dans lignees.html, voir plus bas)
  blasons.js .css   Blasons réels             personnages.js .css   Personnages
  favicon.svg       l'icône du site
  fonts/            polices auto-hébergées (licence OFL, texte joint)
  meubles/          figures SVG des meubles empruntés à Wikimedia Commons
  ornements/        couronnes, heaumes, lambrequins, colliers, panache (Commons)

data/
  data.json         tout le contenu de l'encyclopédie
  blasons.json  personnages.json    les images de Commons des deux galeries
  frises.json       la liste des frises de la page Lignées
  lignees.json (rois de France)  angleterre.json  savoie.json  habsbourg.json  papaute.json     une lignée par fichier
  atelier.json      meubles et ornements de l'Atelier

tools/
  check_data.py     vérifie les données, les fichiers cités et les gabarits (sans dépendance)
  smoke_test.py     charge chaque page dans un vrai navigateur et la fait travailler (Playwright)
  check_commons.py  vérifie auprès de Wikimedia Commons que les figures empruntées existent toujours, en licence libre

.github/workflows/  check.yml (à chaque envoi)   commons.yml (chaque lundi)
```

Le bandeau de navigation est écrit une seule fois, dans `assets/chrome.js` : pour ajouter une page au menu, on ajoute
une ligne à la liste `PAGES` de ce fichier, et on pose dans la nouvelle page `<header class="mast" data-page="…"></header>`
suivi de `<script src="assets/chrome.js"></script>` (voir `atelier.html`).

## Étendre le contenu

Après chaque modification : `python3 tools/check_data.py`. Il dit, en français, ce qui cloche (source inconnue,
fichier introuvable, figure sans licence, « kind » sans dessin…).

### Dans l'encyclopédie — `data/data.json`

- **Ajouter un ouvrage** : une entrée dans `sources`
  `{ "auteur", "titre", "editeur", "annee", "isbn", "type", "note" }`.
- **Enrichir ou créer un article** : dans `sections[].articles`
  `{ "titre", "html", "sources": ["joubert1977", …] }` — le tag « Source » de l'article se met à jour tout seul.
  Une section peut aussi porter une galerie (`"figure"`), un article un diagramme (`"diagram"`) ou une galerie de règles (`"gallery"`).
- **Ajouter un terme** : dans `glossaire` `{ "terme", "def", "sources" }` (ou dans `repertoire`, `attributs`, `positions`).
- **Ajouter une figure** dans `tinctures`, `partitions`, `pieces`, `meubles` ou `couronnes`. Elle est dessinée toute seule si son
  `kind` existe dans `assets/blason.js` (`partitionInner`, `pieceInner`, `chargeInner`) — `check_data.py` vérifie. Sinon, on cite une
  figure libre de Commons : `"image": { "file", "auteur", "lic", "licurl" }`.

### Blasons réels et Personnages

Une entrée de plus dans `data/blasons.json` ou `data/personnages.json` : le nom, le blasonnement, et la figure de Commons
(`file`, `auteur`, `lic`, `licurl`). `blasonSrc` (`{ label, url, note }`) cite la source du blasonnement quand elle n'est pas
le domaine public.

### Une lignée de plus (page Lignées)

1. Créer `data/<nom>.json` sur le modèle de `data/savoie.json` : `sources` (les pages lues), `armes` (chaque écu : `nom`, `blason`,
   `file`/`auteur`/`lic`… ou un dessin simple, `note`, `sources`) et `royaumes[]` avec ses `maisons`, `regnes` (nom, dates, maison, `armes`,
   `sources`), `vides`, `jalons` (les dates qui comptent), `grandesArmes` et `ornements` (couronne, collier, tenants… avec leurs dates).
   Quand les sources divergent, on le dit : `desaccord` dans un jalon, `approx` dans une date.
2. Ajouter une ligne à `data/frises.json` : `id`, `nom`, `groupe`, `dates`, `file`, et `embleme` (un fichier de Commons déjà crédité dans la lignée).

### L'Atelier — `data/atelier.json`

- **Un meuble** : `kind` (identifiant unique), `nom`, `sing`, `plur`, `g` (`m` ou `f`), `cat` (la famille du menu), puis
  - soit `draw` : le nom d'un dessin de `chargeInner()` dans `assets/blason.js` ;
  - soit `file` (`path` du SVG dans `assets/meubles/`, `commons`, `auteur`, `lic`, `licurl`) avec `box` (où l'inscrire dans l'écu de 200 × 252),
    `main` (les couleurs du fichier que l'émail du meuble remplace) et, si le meuble a une seconde couleur, `accent` et `accentMot` (« armé et lampassé »).
  `asym: true` marque un meuble qui change d'aspect quand on le contourne (un lion, une clef) ; les meubles symétriques n'en ont pas.
- **Une pièce** : une entrée dans `pieces`, un dessin dans `pieceInner()` (et, si l'on veut des bords décorés, dans `pieceDecoree()`), sa grammaire dans `PIECES` et ses
  dispositions de meubles dans `LAYOUT`, tous deux en tête de `assets/atelier.js`.
- **Un ornement** : dans `ornements` (couronnes, heaumes, colliers, supports) ; le SVG va dans `assets/ornements/`.

Les figures empruntées gardent leur licence et leur crédit : l'Atelier les recolore, et l'écrit sous chaque écu et dans chaque export.

## Vérifier avant de publier

```sh
python3 tools/check_data.py          # instantané : données, fichiers cités, gabarits, menu
```

Le test de fumée charge chaque page dans un vrai navigateur, vérifie qu'elle se construit sans erreur, que les cartes sont dans leurs
grilles, que les ancres d'adresse mènent au bon chapitre, que les cinq frises se dessinent, puis soumet l'Atelier à une série de
blasonnements connus et à des compositions tirées au hasard (qui ne doivent jamais échouer) :

```sh
pip install playwright               # une fois ; utilise Google Chrome s'il est installé, sinon : python3 -m playwright install chromium
python3 tools/smoke_test.py          # une trentaine de secondes ; FUZZ=500 pour pousser l'Atelier plus loin
```

Les images de Wikimedia Commons sont remplacées par un pixel dans ce test : il ne dépend pas du réseau.

```sh
python3 tools/check_commons.py       # interroge Commons : fichiers disparus ou renommés, licences qui changent
```

GitHub fait tourner `check_data.py` et le test de fumée à chaque envoi, et `check_commons.py` chaque lundi.

## Publication

Le site est servi par GitHub Pages (Réglages → Pages indique la branche publiée). Rien à compiler : ce qui est sur cette branche est ce que
voient les lecteurs, au bout d'une ou deux minutes. Si le site change d'adresse, les URL de `sitemap.xml` et les balises `canonical` et
`og:url` de chaque page sont à mettre à jour. Un lecteur qui connaissait déjà le site peut en garder l'ancienne version une dizaine de
minutes (le cache de GitHub Pages) : un rechargement forcé — Ctrl + Maj + R, ou Cmd + Maj + R sur Mac — suffit à vérifier une mise en ligne.

## Règle du projet

On reformule toujours le savoir avec ses propres mots et on cite l'ouvrage. On ne copie jamais le texte ni les illustrations d'un ouvrage
protégé. Les points débattus entre sources sont signalés comme tels, plutôt que tranchés arbitrairement. Les images empruntées n'entrent
que sous licence libre, avec leur auteur, leur licence et un lien vers leur page.

## Licence et crédits

Œuvre originale (textes de synthèse et figures SVG) sous [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.fr) — voir `LICENSE`.
Les images de Wikimedia Commons restent la propriété de leurs auteurs, sous leur licence ; chacune est créditée sous elle.
Les ouvrages cités en bibliographie ne sont pas couverts par cette licence. Les polices (Marcellus, Marcellus SC, EB Garamond) sont sous
licence OFL, dont le texte est dans `assets/fonts/`.

## Limites connues

- **Petits écrans** : l'encyclopédie et l'Atelier ne sont pas encore adaptés au téléphone (la page déborde en largeur) ; les trois autres pages le sont.
- **Les images viennent de Wikimedia Commons** : les pages ne sont pas autonomes, et un fichier renommé ou supprimé là-bas manque ici.
  `check_commons.py` le signale ; copier les images dans le dépôt, avec leurs crédits, les rendrait indépendantes.
- **Sources** : elles sont citées par ouvrage, sans numéro de page ; certaines lignées s'appuient surtout sur Wikipédia.
- **Le CSS de `lignees.html` reste dans la page** : quatre de ses règles renvoient par `url(#…)` à des dégradés définis dans la page, ce que
  les navigateurs n'interprètent pas tous de la même manière depuis une feuille de style externe.
- **Le code n'a pas de licence propre** : `LICENSE` ne couvre que les textes et les figures originales.
- **L'Atelier** : peu d'attitudes — le lion existe rampant, passant et léopard, l'aigle à une ou deux têtes, mais la plupart des bêtes n'ont
  qu'un dessin ; ni manteau ni pavillon ; les pièces alésées n'y sont pas.
