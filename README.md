# L'Armorial

Encyclopédie ouverte de l'héraldique : la grammaire du blason, les émaux, les partitions, les pièces et les
meubles, illustrés de figures SVG et sourcés un à un — avec, autour, des armoiries réelles, des frises
de lignées et un atelier pour composer les siennes.

**En ligne : <https://i-envy-hades.github.io/armorial/>**

Aucun framework, aucune étape de compilation : des pages HTML, des scripts, des fichiers de données JSON.
Pour modifier le contenu, on modifie un fichier JSON et on publie.

## Les neuf pages

| Page | Contenu | Données |
|---|---|---|
| `index.html` — **L'encyclopédie** | Quatorze chapitres (origines, écu, émaux, partitions, règles, pièces, meubles, blasonnement, ornements, droit du blason, droit comparé, brisures, **alliances**, **hérauts et armoiriaux**), glossaire et répertoire de plus de 350 termes, bibliographie, recherche. Les figures sont dessinées en SVG ; celles qu'on emprunte portent leur crédit. Une bande sous le bandeau renvoie aux autres pages. | `data/data.json` |
| `blasons.html` — **Blasons réels** | Armoiries d'États, de royaumes, d'ordres et de maisons : de vraies images de Wikimedia Commons, créditées une à une, avec leur blasonnement — les cantons suisses, vingt-sept États d'Europe d'aujourd'hui, des maisons des Pays-Bas, d'Allemagne et du Nord. **Partir d'un blason réel** : quand l'Atelier sait relire le blasonnement d'une carte, un clic sur son écu (ou sur le bouton « Redessiner dans l'Atelier ») l'ouvre dans l'Atelier pour le modifier ; sous les autres, une ligne dit où le lecteur bute, avec un lien qui montre le texte surligné dans l'Atelier. Chaque carte a son adresse (`#royaume-de-france-moderne`). | `data/blasons.json` |
| `personnages.html` — **Personnages** | Armoiries de personnes ayant existé, avec leur blasonnement (mêmes écus à ouvrir dans l'Atelier, mêmes adresses). | `data/personnages.json` |
| `lignees.html` — **Lignées** | Les armes des souverains règne après règne, sur une frise qu'on fait glisser : rois de France, d'Angleterre, d'Écosse et de Portugal, ducs de Bourgogne, rois de Castille, d'Aragon et d'Espagne, maisons de Savoie et de Habsbourg, papauté. | `data/frises.json` et un fichier par lignée |
| `atelier.html` — **L'Atelier** | On compose des armes (champ, pièce, meubles, ornements) ; le blasonnement s'écrit tout seul, dans l'ordre où un héraut le lirait. Et inversement : on tape un blasonnement, l'écu se dessine. Ou l'on part d'un blason réel des galeries (« Partir d'un blason réel ») : l'image de la carte reste sous l'écu, et l'Atelier dit si l'on s'en est écarté. Lien de partage, export SVG et PNG, rappel de la règle des émaux, crédits de chaque figure empruntée. | `data/atelier.json`, `data/data.json` |
| `exercices.html` — **S'exercer** | Des questions tirées à neuf à chaque fois par le moteur de l'Atelier : lire un écu, deviner des armes sur leur texte, juger la règle des émaux, nommer les points de l'écu, réviser le vocabulaire, reconnaître des armes réelles — trois niveaux, la réponse expliquée, et un **défi du jour** (six questions, les mêmes pour tous, résultat à copier). Une question n'est posée que si le lecteur de blasonnement relit à l'identique le texte de l'écu. | `data/data.json`, `data/atelier.json`, `data/blasons.json` |
| `transmission.html` — **La transmission des armes** | Pourquoi les écus changent : un arbre qui se déplie, de onze familles à vraie descendance (Capétiens et toutes leurs branches, Habsbourg, Castille, Angleterre, Écosse, Savoie, Nassau, Oldenbourg : Danemark, Norvège, Suède, Russie, Grèce ; Wettin : Saxe, Belgique, Portugal, Bulgarie, Brésil, Royaume-Uni ; Wittelsbach : Bavière, Palatinat, Suède, Grèce ; Lorraine), avec leurs mariages entre maisons jusqu'aux maisons récentes. Chaque passage d'armes (branche cadette, mariage, héritage, union ou traité, prétention) dit ce qu'il change dans l'écu et, quand une source lue le donne, pourquoi ; sinon la page écrit « Raison non établie ». Chaque carte porte une étiquette de couleur qui dit comment ses armes sont venues (« Mariage · 1901–1910 », « Cadette · 1858 »), avec un point de couleur pour un autre type d'apport. Une maison qui n'a pas de branche à elle (l'Aragon, Delmenhorst) n'a pas de carte : elle apparaît là où son mariage ou son union change les armes d'une autre. | `data/transmission.json` (les blasons et figures viennent de `capetiens.json`, des frises, ou de la section `armes` du fichier pour les maisons sans frise) |
| `recherche.html` — **Rechercher** | Une recherche dans tout le site (articles, glossaire, vocabulaire, blasons, personnages, règnes et armes des lignées, arbre de la transmission des armes, sources) : sans accent ni majuscule, tous les mots dans la même entrée. Chaque résultat mène à l'endroit où il se lit. | tous les fichiers de données |
| `404.html` | La page d'erreur de GitHub Pages, avec une recherche. | — |

### Ce que sait faire l'Atelier

- **L'écu** : simple, parti (deux moitiés, chacune avec ses armes entières, resserrées de moitié, et au besoin un demi-meuble mouvant du trait du parti : « Parti : au 1, d'or à la demi-aigle de sable mouvant du trait du parti ; au 2, de gueules à la clef d'or » ; ou une moitié elle-même écartelée, comme dans l'exemple « Parti écartelé » : « Parti : au 1, écartelé : aux 1 et 4, … ; aux 2 et 3, … ; au 2, … »), écartelé (1-4 / 2-3, ou en quatre), avec ou sans écusson en abîme (« sur le tout ») ; quinze formes d'écu. Le lecteur relit « Parti : au 1, … ; au 2, … » et « Parti, en 1 … et en 2 … » ; « parti d'azur et de gueules » reste un champ à deux émaux.
- **Le champ** : plein, partagé (parti, coupé, tranché, taillé, tiercé, gironné, traits ondé, crénelé, denché, engrêlé, cannelé, dancetté, nébulé…) ou rayé (fascé, palé, bandé, barré, chevronné, de six à douze pièces — burelé, vergeté, coticé à partir de dix — ou des pièces rebattues : « d'or à trois pals de gueules », « à trois chevrons »), échiqueté (de trois à huit tires) et fuselé (droit, en bande, en barre) ; neuf émaux, fourrures comprises.
- **La pièce** : chef, fasce, pal, bande, barre, croix, sautoir, chevron, cotice, bordure, orle, canton, franc-quartier, pairle — à bord droit, ondé, nébulé, dancetté, engrêlé, cannelé ou denché, ou alésée (fasce, pal, bande, barre, chevron, sautoir), bordée d'un filet d'un autre émail (« la croix de gueules bordée d'argent »), brochant sur les meubles du champ (« au lion d'or, à la bande de gueules brochant sur le tout »).
- **Les meubles** : plus de cent dix — dont des bêtes (lion rampant, passant ou léopard, léopard lionné, aigle couronnée ou non, à deux têtes ou au vol abaissé, bouquetin, chèvre et biche saillants, cerf passant, courant ou couché, cheval cabré ou passant, ours passant ou rampant, sanglier, loup passant ou ravissant, taureau, bélier, licorne, colombe, cygne, choucas, alérion, couleuvre, poisson, griffon, dragon, wyvern…), l'arbre, la grenade et la fleur de néflier, le faisceau de licteur et la crosse de Bâle (dessinée ici) —, jusqu'à deux sortes ensemble ; nombre (de un à huit, neuf, dix et douze), disposition (en chef, en pal, 2 et 1, semé, en orle…), sens (contourné ; la hache « le fer à dextre » ou « à senestre »), issant (un seul meuble, qui sort de la pointe de l'écu), couronne d'un lion, contre-changé sur un champ partagé (« de l'un en l'autre », « de l'un à l'autre » : chaque part du meuble prend l'émail de l'autre part du champ), réglages de taille et de position.
- **La brisure** : ce qui distingue un cadet de son aîné, posée par-dessus tout le reste (« …, brisé d'un bâton de gueules péri en barre »). Pièces : bordure (droite ou à l'un des six bords), bâton péri, filet, canton, franc-quartier ; figures : croissant, molette, merlette, annelet, fleur de lis, rose, étoile, besant, coquille, d'un à trois, avec leur disposition. Émail au choix, sens en bande ou en barre, réglages de taille et de position. Le lecteur relit « brisé d'un… » à la fin d'un blasonnement. **Le lambel** est une brisure à part entière : de deux à six pendants, d'un émail au choix, et les pendants peuvent porter une figure (croissant, molette, merlette, annelet, fleur de lis, rose, étoile, besant, coquille, croisette ; une à trois par pendant, sur chaque pendant ou sur celui du milieu) — « brisé d'un lambel d'argent à cinq pendants chargé sur chaque pendant d'un besant de gueules ». Le lecteur lit aussi « au lambel d'argent », « au lambel de gueules à trois pendants » et « celui du milieu chargé de… ». Les anciennes adresses où le lambel était un meuble sont converties.
- **Les ornements** : couronnes de rang, heaumes (deux modèles, trois positions), lambrequins, panache, cimier (un meuble posé sur le heaume, entier ou issant), manteau doublé d'hermine, de vair ou d'un autre émail et pavillon qui le coiffe (dessinés par l'encyclopédie), supports, colliers d'ordres, devise sur un bandeau.
- **La sortie** : le blasonnement, la liste des ornements, l'avertissement si la règle des émaux est enfreinte, un lien qui garde toute la composition, un export SVG ou PNG portant ses crédits.
- **Partir d'un blason réel** : un sélecteur propose les cartes de Blasons réels et de Personnages dont l'Atelier relit le blasonnement en entier (il les relit au chargement : rien n'est écrit en dur, la liste s'allonge avec le lecteur). On y arrive aussi par l'écu d'une carte : `atelier.html#lire=…&de=blasons:royaume-de-france-moderne`. Sous l'écu, la carte d'origine (son image de Commons, créditée, à comparer au dessin) et son état : « ce sont les armes de la carte », ou « vous les avez modifiées », avec de quoi y revenir ; les ornements ajoutés ne comptent pas, le blasonnement ne les dit pas. L'adresse garde la carte d'origine, et les exports la nomment (« D'après les armes de… »). Une carte que le lecteur ne relit pas s'ouvre aussi, texte surligné là où il bute.
- **La lecture** : on tape « D'azur à trois fleurs de lis d'or » (ou on arrive par `atelier.html#lire=…`, l'adresse des boutons des galeries) et l'écu se dessine. L'Atelier lit tout ce qu'il sait écrire — écartelé, écusson sur le tout, pièces et leurs bords, meubles chargés ou accompagnés, semés — et quelques variantes de plume (accents et majuscules libres, « plain », « lys », virgules, commentaires entre parenthèses, « du même »). **Ce qui n'est pas compris est signalé, jamais deviné** : un mot inconnu, un ordre qu'il ne sait pas lire, un nombre ou une disposition qu'il ne sait pas dessiner sont surlignés dans le texte, avec la raison, et l'écu ne bouge pas. Ce qu'il lit en fixant lui-même un détail que le texte ne dit pas (la disposition de deux meubles, l'attribut de l'aigle…) est dit en « réserves » sous la zone de saisie. Voir `assets/lecture.js`.

## Consulter le site en local

Les pages chargent leurs données par `fetch`, ce que les navigateurs refusent sur `file://`. Il faut donc les servir :

```sh
python3 -m http.server 8000
# puis ouvrir http://localhost:8000/
```

Ouvrir `index.html` par double-clic affiche un message d'erreur, pas la page.

## Organisation du dépôt

```
index.html  blasons.html  personnages.html  lignees.html  atelier.html
exercices.html  transmission.html  recherche.html  404.html      les pages (squelette et textes propres à chacune)
sitemap.xml  robots.txt                                                           pour les moteurs de recherche

assets/
  site.css          socle commun : polices, couleurs, bandeau (menu replié sur téléphone), parchemin, impression
  chrome.js         bandeau de navigation, lien d'évitement et sceau du pied de page, communs à toutes les pages
  blason.js         le dessin héraldique : émaux, partitions, pièces (et leurs contours), meubles — partagé par l'encyclopédie et l'Atelier
  blasonnement.js   le modèle des armes : grammaire, état d'une composition, normalisation, blasonnement (sans dessin)
  dessin.js         le dessin d'une composition (champ, pièce, meubles, ornements, crédits) : de l'état au SVG — partagé par l'Atelier et S'exercer
  lecture.js        le lecteur de blasonnement : du texte à l'écu, l'inverse de blazonAll() ; décrit en tête du fichier
  index.js .css     l'encyclopédie            atelier.js .css   l'Atelier (l'interface seule)
  exercices.js .css S'exercer
  transmission.js .css  La transmission des armes   recherche.js .css     la recherche du site
  lignees.js        les frises (son CSS reste dans lignees.html, voir plus bas)
  blasons.js .css   Blasons réels             personnages.js .css   Personnages      (ils chargent le lecteur pour poser leurs boutons)
  cartes.js         les adresses des cartes des galeries (et le filtre qu'on lève pour y aller)
  epopee*.js .css   l'habillage « chronique » : bandeaux, cartes, mouvement léger (désactivé avec prefers-reduced-motion)
  bandeau.css       le même bandeau (menu voilé, barre de lecture, héros, pied de page) pour les pages qui ont leur propre feuille : L'Atelier, Lignées, 404
  favicon.svg  og.jpg   l'icône du site, l'image de partage (un écu composé par l'Atelier)
  fonts/            polices auto-hébergées (licence OFL, texte joint)
  meubles/          figures SVG des meubles empruntés à Wikimedia Commons
  ornements/        couronnes, heaumes, lambrequins, colliers, panache (Commons)
  epopee/           images d'ambiance des bandeaux (générées par IA, sans écu réel)

data/
  data.json         tout le contenu de l'encyclopédie
  blasons.json  personnages.json    les images de Commons des deux galeries
  frises.json       la liste des frises de la page Lignées
  lignees.json (rois de France)  angleterre.json  ecosse.json  portugal.json  espagne.json (Castille, Aragon, Espagne)  bourgogne.json
  savoie.json  habsbourg.json  papaute.json     une lignée par fichier
  atelier.json      meubles et ornements de l'Atelier
  capetiens.json    l'arbre des maisons et branches capétiennes
  transmission.json les passages d'armes d'une maison à l'autre (type, effet, raison, sources)

tools/
  check_data.py     vérifie les données, les fichiers cités, les gabarits, l'ordre des scripts et le plan du site (sans dépendance)
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
  Pour citer une page précise, on remplace l'identifiant par `{ "id": "joubert1977", "p": "p. 34-35" }` : le tag devient « Joubert (1977), p. 34-35 »,
  et un terme du glossaire qui cite ainsi une page l'affiche à la suite de sa définition.
  Une section peut aussi porter une galerie (`"figure"`), un article un diagramme (`"diagram"`) ou une galerie de règles (`"gallery"`).
- **Ajouter un terme** : dans `glossaire` `{ "terme", "def", "sources" }` (ou dans `repertoire`, `attributs`, `positions`).
- **Ajouter une figure** dans `tinctures`, `partitions`, `pieces`, `meubles` ou `couronnes`. Elle est dessinée toute seule si son
  `kind` existe dans `assets/blason.js` (`partitionInner`, `pieceInner`, `chargeInner`) — `check_data.py` vérifie. Sinon, on cite une
  figure libre de Commons : `"image": { "file", "auteur", "lic", "licurl" }`.

- **Ajouter un chapitre** : un objet de plus dans `sections` (`id`, `label`, `eyebrow`, `title`, `lede`, `figure`, `articles`). Il prend un décor dans `PLATES` et, si l'on veut,
  une miniature d'époque dans `MINIA` (`assets/index.js`) : une image de Commons du domaine public, créditée. Un encadré « état des connaissances » est un article
  `{ "note": true, "html": … }` : il n'a pas d'adresse, on ne peut donc pas s'y renvoyer.
- **Modifier `data/data.json` sans le reformater** : le fichier est mis en forme à la main ; on y insère des morceaux de texte plutôt que de le re-sérialiser tout entier.

### Les Capétiens — `data/capetiens.json`

Un nœud par maison ou branche : `id`, `nom`, `dates`, `parent` (un seul nœud n'en a pas), `fondateur`, `armes` (`blason`, et `quand` pour un état daté), une figure de Commons
(`file`, `auteur`, `lic`, `licurl`), `notes`, `lien`/`lienTxt` (vers une frise), `idem` (même figure qu'un autre nœud). Ce fichier n'a plus de page à lui : c'est la source des
nœuds capétiens de la page de la transmission des armes (`cap:<id>`), où chaque branche est reliée à sa maison d'origine.

### La transmission des armes — `data/transmission.json`

`noeuds[]` : `id`, `ref` (`cap:<id>` dans `capetiens.json`, `<frise>:<id d'armes>` dans une lignée, ou `tr:<id>` dans la section `armes` du fichier), `nom`, `dates`, `parent` (l'arbre ; les racines n'en ont pas), `apport` (une maison qui entre dans l'écu d'une autre par mariage, héritage ou union, sans branche propre : pas de carte, une pastille sous les armes qu'elle nourrit ; elle n'a pas de parent). `armes{}` : pour les maisons sans frise, `nom`, `blason`, `file`, `auteur`, `lic`, `licurl` et `src` (la page où le blasonnement est lu). `liens[]` : `de`, `vers`, `type` (`cadette`, `mariage`, `heritage`, `annexion`, `pretention`), `annee`, `effet` (ce qui change dans l'écu), `pourquoi` (la raison, seulement si une source lue la donne), sinon `lacune` (ce qui manque), `sources[]`, `jalon` (`<frise>:<année>`, pour renvoyer au jalon de la frise), `desaccord`, `lien`. Les blasonnements, figures et crédits ne sont pas recopiés : la page les lit à la source. Un nœud peut avoir plusieurs passages entrants (par exemple un héritage et un mariage) : celui qui vient de son `parent` trace la branche, les autres s'affichent dans le panneau. Ce n'est pas une généalogie : seuls les passages qui changent un écu y figurent.

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
3. Si la lignée a sa propre ambiance : un thème (`"theme": "…"`), c'est-à-dire une règle `.stage.theme-…` dans `lignees.html` pour les couleurs et un motif de semis dans `SEMIS` (`assets/lignees.js`). Sans thème, la frise prend celui de la France.

Un fichier peut porter plusieurs `royaumes[]` (Habsbourg, Espagne) : leurs frises s'empilent dans la page, mais seuls `methode` et `figures` du *premier* sont affichés, et les crédits de toutes les figures sont réunis dessous. La méthode de toute la lignée se décrit donc dans le premier.

### L'Atelier — `data/atelier.json`

- **Un meuble** : `kind` (identifiant unique), `nom`, `sing`, `plur`, `g` (`m` ou `f`), `cat` (la famille du menu), puis
  - soit `draw` : le nom d'un dessin de `chargeInner()` dans `assets/blason.js` ;
  - soit `file` (`path` du SVG dans `assets/meubles/`, `commons`, `auteur`, `lic`, `licurl`) avec `box` (où l'inscrire dans l'écu de 200 × 252),
    `main` (les couleurs du fichier que l'émail du meuble remplace) et, si le meuble a une seconde couleur, `accent` et `accentMot` (« armé et lampassé »).
    Une couleur s'écrit `#fcef3c`, ou `fill:#000` quand le même noir sert aussi aux contours : seuls les remplissages changent (le bec et les pattes du cygne).
    Un fichier à feuille de style interne (le poisson) est accepté : ses classes sont préfixées pour que deux copies de couleurs différentes ne se mêlent pas.
  `asym: true` marque un meuble qui change d'aspect quand on le contourne (un lion, une clef) ; les meubles symétriques n'en ont pas.
  Le lecteur de blasonnement reconnaît `sing` et `plur`, plus `alias` : une liste de paires `["lion léopardé", "lions léopardés"]` pour les autres noms
  d'un même meuble (un nom ne peut servir à deux meubles ni à une pièce : `check_data.py` le vérifie). Deux drapeaux aident à lire et à écrire juste :
  `accentTrait: true` quand l'attribut est un trait du dessin et pas seulement une couleur (l'aigle « couronnée », la panthère « incensée » : on le dit toujours),
  `allongee: true` pour les bêtes passantes, dont on précise d'ordinaire la disposition (le lecteur le rappelle quand le texte se tait).
  `couronne: [x, y, largeur]` dit où poser une couronne sur la tête de la bête (dans le cadre de l'écu, 200 × 252) : elle peut alors être « couronnée ».
  `homonyme` permet à deux meubles de partager un nom (l'aigle, couronnée ou non) : le lecteur garde celui qui lit le plus loin dans le texte (« … et couronnée de gueules »).
  `file.vb` donne la boîte du dessin quand le fichier n'a pas de `viewBox` et que sa page est plus grande que la figure.
- **Une pièce** : une entrée dans `pieces`, un dessin dans `pieceInner()` (et, si l'on veut des bords décorés, dans `pieceDecoree()`), sa grammaire dans `PIECES` et ses
  dispositions de meubles dans `LAYOUT`, tous deux en tête de `assets/blasonnement.js` (le lecteur de blasonnement et l'Atelier s'en servent ensemble).
- **Un ornement** : dans `ornements` (couronnes, heaumes, colliers, supports) ; le SVG va dans `assets/ornements/`.

Les figures empruntées gardent leur licence et leur crédit : l'Atelier les recolore, et l'écrit sous chaque écu et dans chaque export.

## Vérifier avant de publier

```sh
python3 tools/check_data.py          # instantané : données, fichiers cités, gabarits, ordre des scripts, menu, plan du site, ancres, et le glossaire définit-il les mots de l'Atelier ?
```

Le test de fumée charge chaque page dans un vrai navigateur, vérifie qu'elle se construit sans erreur, que les cartes sont dans leurs
grilles, que les ancres d'adresse mènent au bon chapitre, que les neuf frises se dessinent, puis soumet l'Atelier à une série de
blasonnements connus et à des compositions tirées au hasard (qui ne doivent jamais échouer). Il vérifie aussi le lecteur de blasonnement :
chaque écu que l'Atelier sait écrire doit se relire à l'identique (mêmes armes, même texte, même dessin) ; les textes qu'il ne doit pas
comprendre sont refusés avec la bonne raison ; un mot inconnu fait refuser le texte ; et chaque écu cliquable, chaque bouton « Redessiner dans l'Atelier » des
galeries mène à un blasonnement relu en entier, l'Atelier montrant la carte d'où l'on part (et ce que l'on en a changé) ; les autres cartes disent où le lecteur bute. Il vérifie enfin les pages S'exercer (chaque question tirée a une seule bonne réponse, des textes que le lecteur relit à l'identique,
une règle des émaux juste ; le défi du jour se joue de bout en bout), Rechercher (chaque lien d'un résultat mène à une ancre qui existe), La transmission des armes, et le
téléphone (375 px : aucune page ne déborde en largeur, le menu se replie derrière un bouton) :

```sh
pip install playwright               # une fois ; utilise Google Chrome s'il est installé, sinon : python3 -m playwright install chromium
python3 tools/smoke_test.py          # deux minutes environ ; FUZZ=500 pour pousser l'Atelier plus loin
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

## Atelier : trois choses à savoir

- **Champ `atelier`** (dans `blasons.json` et `personnages.json`) : un blasonnement de remplacement, que l'Atelier lit à la place du texte de la carte quand l'image
  Commons montre autre chose que la source, ou que la source emploie un nom que l'Atelier ne connaît pas (« France ancien »). Le texte de la source n'est jamais modifié ;
  la carte signale que le dessin suit l'image.
- **Épaisseur de la croix** : un curseur règle l'épaisseur d'une croix (pièce), de la croix posée en meuble comme de celle d'une case.
- **Bordure, orle et brisure en bordure** suivent la case où elles sont posées (moitié d'un parti, quartier), bord décoré compris pour la bordure.
- **Brisure sur tout l'écu** : sur un parti ou un écartelé, la brisure des premières armes peut se poser sur l'écu entier (« Écartelé : … ; le tout brisé d'un lambel d'argent »), comme au Prince Noir. Sur un écu parti ou écartelé la brisure est toujours à tout l'écu : elle se règle avec les premières armes, et une brisure posée sur une autre case y est ramenée ; le lecteur relit « ; le tout brisé d'un… ».

- **Quatre figures refaites** (octobre 2026), dans l'Atelier comme dans l'encyclopédie : le *gland* (figure empruntée « tigé et feuillé », de Jean-Paul Gibert, CC BY 4.0 ; l'Atelier dit « feuillé de sinople », la tige est de l'émail du gland), la *croix pattée* et la *croix recroisettée* (tracées d'un seul contour, quatre bras tournés autour du centre) et la *crosse de Bâle* (le crochet repris des armes de Bâle-Ville du règlement de l'armée suisse, domaine public).

- **Vocabulaire ajouté** (octobre 2026) : *vache passante* (collier et clochette réglables : « colletée et clarinée »), *navire* (figures libres de Commons, créditées) ; 23 fiches ajoutées à l'encyclopédie pour les meubles que l'Atelier dessinait sans qu'elle les présente (ours, sanglier, taureau, loup, bélier, cygne, poisson, couleuvre, alérion, choucas, colombe, bouquetin, chèvre, biche, wyvern, faisceau, grenade, fleur de néflier, arbre, hache, couronne, vache, navire) ; 9 entrées de glossaire tirées de la « Liste des meubles héraldiques » de Wikipédia (rencontre, sommé, surmonté, terrassé, écusson, colonne, dextrochère, vache, navire) ; « croix recroisetée » (un seul t) se lit.
- **Deuxième passe de vocabulaire** (octobre 2026) :
  - *Parties colorables* : les cornes de la vache passent à l'attribut (« accorné, colleté et clariné d'azur » ; le lecteur accepte une partie de la liste, et le dit) ; la hache du faisceau suit le lien (« lié d'argent, la hache du même »).
  - *Figures de Commons reprises* (créditées sous la figure, fiche d'encyclopédie pour chacune) : pin (fûté), casque, tête de loup arrachée, colonne, flèche (empennée), rencontre de cerf (ramé), orbe crucifère, bras. Deux entrées de glossaire : *ramé*, *empenné / ferré / fûté*.
  - *« sommé de » et « surmonté de »* se lisent comme « accompagné en chef de », « surmontant » comme « accompagné en pointe de » : l'Atelier le dit en réserve et réécrit « accompagné ». Les aigles acceptent « becquée et membrée » seules (un seul émail pour le bec, les serres et la couronne, dit en réserve).
  - *Champ `atelier` + `atelierNote`* : Valence, Premier Empire, Pays-Bas, Vaud, Neuchâtel, Fábry ; la note de la carte dit ce que le dessin laisse de côté.

- **Épaisseur par défaut** (octobre 2026) : fasce, chef, pal, bande et barre ont le tiers de l'écu, comme le disent les traités (Wikipédia, « Pièce (héraldique) ») ; meubles posés dessus ou autour recalés. La croix, le sautoir et le chevron gardent leur cote. « Fascé de quatre pièces » se lit.
- **Pal par défaut** (octobre 2026) : seuls le lion passant et le léopard se posent en pal sans qu'on le dise ; pour tout autre meuble, « en pal » reste une disposition au choix (de deux à cinq meubles), et une figure allongée s'y dessine à pleine largeur sans mordre sur sa voisine (taille réglée sur sa hauteur réelle). Le taureau et le poisson sont devenus des figures allongées.
- **Boutons « Exemples »** (octobre 2026) : les 36 boutons se relisent tous sans écart ; ajouts : croix mince, clef, parti bordé (bordure dans une case), lambel sur tout l'écu ; « Demi-aigle au parti » prend la clef contournée.

- **Troisième passe** (octobre 2026) :
  - *Navire* : « navire » est maintenant le navire toutes voiles dehors (Cfaerber, CC BY-SA 3.0) ; l'ancien dessin devient « navire à voile carguée » ; un *vaisseau* à trois mâts s'y ajoute.
  - *Harpe* (cordes colorables : « cordée d'argent ») et *ciboire* (extrait des armes de Galice, ce qui rend lisible la carte du royaume de Galice ; « du même » se lit aussi après un semé).
  - *Rencontres* sur le modèle de la rencontre de cerf : ours (lampassé), sanglier (défendu), loup, lion et léopard (lampassés), bélier (accorné), avec fiche d'encyclopédie, et deux entrées de glossaire (*défendu / allumé*, *cordé*).
  - *Bras* : un réglage « Inclinaison » (droit, 45° ou couché, à dextre ou à senestre), exclusif, qui ne change que le dessin, pas le blasonnement ; un meuble s'y ouvre en ajoutant `"incline": true` à sa fiche de `atelier.json`.
  - La carte de l'Empire britannique se lit (champ `atelier`, sans le double trescheur de l'Écosse).
- **Liste des meubles** (menu « Meuble ») : triée par ordre alphabétique à l'intérieur de chaque catégorie (octobre 2026).
- **Couronne** (octobre 2026) : le meuble « couronne » reprend la couronne à fleurons de Jean-Paul Gibert (CC BY 4.0) à la place de l'ancien tracé, trop simple ; deux meubles s'y ajoutent, la *couronne antique* (Gibert, CC BY 4.0) et la *couronne de laurier* (Henrysalome, CC BY-SA 3.0), avec leurs fiches d'encyclopédie.
- **Bêtes couronnées** (octobre 2026) : toutes les bêtes portent maintenant la couronne (« couronné d'or ») — lions, léopards, cerfs, chevaux, ours, sanglier, taureau, loups, bélier, bouquetin, chèvre, vache, cygne, colombe, poisson, sirène, mélusine, dragon, wyvern, basilic, griffon, phénix, salamandre, guivre, couleuvre, choucas, licorne, panthère. Les aigles gardent leur image, qui a déjà la couronne. Chaque figure a son point d'ancrage sur la tête (`couronne: [x, y, largeur]` dans `atelier.json`, le centre de la couronne dans le repère de l'écu) ; la forme se choisit, *à fleurons* ou *antique* (dessin seul, le blasonnement ne la dit pas). Pour caler une nouvelle bête : afficher la figure sur une grille de 10 unités et relever le haut de la tête.
- **Cartes rendues lisibles** (octobre 2026, sept lots, de 87 à 100 cartes sur 167) :
  - *Compositions à deux armes* : **coupé**, **tranché** et **taillé** (« Coupé : au 1, … ; au 2, … »), à côté du parti ; leurs parties ne s'écartèlent pas. Dans le chef d'un coupé, une figure
    issante sort du trait ; dans un tranché (un taillé), des meubles posés en bande (en barre) longent le trait. Zélande, Monténégro (son écusson seul), Bosnie-Herzégovine.
  - *Champs et dispositions* : **fascé ondé** (« fascé ondé », ou « ondé d'argent et d'azur », de quatre, six ou huit pièces) ; **treize meubles** en trois pals 4, 5 et 4 (Valais) ;
    **sept meubles en bande** ; une fasce **« accompagnée en chef de … et en pointe de … »**, deux meubles différents de part et d'autre (réglage « Place » du second meuble ; Galicie-Lodomérie).
  - *Lambel* : des châteaux sur les pendants, et « au lambel de gueules, chaque pendant chargé de… » (Artois).
  - *Figures* : le **lion à la queue fourchée et passée en sautoir** (Syryatsu, domaine public ; une variante qui porte le nom « lion », champ `queue` dans `atelier.json` ; Limbourg) ;
    le **rencontre de bœuf** (Rinaldum et Ripounet, CC BY-SA 3.0 ; sans anneau, langue ni yeux d'un autre émail ; Uri) et le **lion couronné tenant une hache**, extrait des armes de Norvège
    d'Odejea (CC BY-SA 3.0, champ `extrait` du crédit ; Norvège, Haakon VII) — ces deux-là, de provenance imparfaite, choisis par le curateur.
  - *Figures remises à dextre* : ours rampant, wyvern, biche saillante, chèvre saillante et salamandre regardaient à senestre dans leurs fichiers (`"retourne": true`) ; Appenzell Rhodes-Intérieures.
  - *Lecture* : « couronné, armé et lampassé d'or » (la couronne en tête des attributs) ; la traverse se dessine en cotice (Namur) ; Ferdinand de Bulgarie (couronne fermée dessinée à fleurons).
  - *Cartes sans blasonnement* : l'Irak a reçu le blasonnement de Hubert de Vries (un paysage, sans émaux dans la source ; illisible par l'Atelier).
- **Écusson et meuble brochant** (octobre 2026) : l'*écusson* est un meuble (un petit écu, réduit par `k` dans `atelier.json`), et un second meuble peut broche sur le premier, seul et au centre : « à l'écusson d'argent, aux rais d'escarboucle d'or brochant sur le tout » (réglage « Brochant sur le tout », champ `bro2`) ; « aux rais d'escarboucle » se lit comme un seul meuble dit au pluriel (`pluriel` dans `atelier.json`). La carte de Clèves se lit.

- **Pièce chargée brochant sur un meuble** (octobre 2026) : « au faisceau de licteur d'or, à la fasce de gueules brochant sur le tout, chargée de trois étoiles d'or » — le meuble du champ, seul et au centre, passe sous la pièce, les figures de la pièce restent dessus (réglage « Pièce : Brochant sur le meuble », champ `pbro`). La carte de Mazarin se lit.

- **Chef de coupé parti et pièce de l'un en l'autre** (octobre 2026) : le chef d'un coupé peut être partie en deux (réglage « Chef : parti » ; champ `h1` = `p`, trois armes : chef dextre 0, chef senestre 2, pointe 1) — « Coupé : au 1, parti : au 1, … ; au 2, … ; au 2, … » ; une pièce se dit « de l'un en l'autre » sur un champ partagé de deux émaux, sans meuble (« à la croix de l'un en l'autre », champ `pcc`, dessinée deux fois sous masque) ; et une liste d'attributs (« lampassé et vilené de gueules ») passe désormais même quand le premier mot est celui que connaît la bête. La carte des Grisons se lit (son texte propre à l'Atelier est dans `blasons.json`, champ `atelier`).

- **« Chacun accompagné de… » et croissant contourné** (octobre 2026) : « à trois croissants contournés d'argent, chacun accompagné d'une étoile du même » — une figure du second meuble auprès de chaque figure du premier (réglage « Chacun accompagné », champ `cha` ; deux meubles ou plus, sans pièce) ; le croissant se contourne en tournant (`ctRot` dans `atelier.json` : ouvert à senestre), non en miroir. La carte du Sultanat d'Égypte se lit.

- **Crancelin et fascé impair à pièces chargées** (octobre 2026) : le *crancelin* est un meuble emprunté à Commons (Henri Salomé, CC BY-SA 3.0), ce qui donne les armes de Saxe sur l'écusson de Léopold II (texte propre à l'Atelier : « sur le tout burelé…, au crancelin de sinople ») ; « Fascé de gueules et d'or de cinq pièces, les trois fasces de gueules chargées de huit besants d'or, 3, 3 et 2 » — un fascé de nombre impair dont les pièces du premier émail portent les meubles, répartis comme le dit le texte (réglage « Sur : les pièces du premier émail », champ `rc`). Les cartes de Léopold II et de Fleming se lisent.

- **Bordure componée aux compons chargés** (octobre 2026) : « à la bordure componée de gueules et d'argent, les compons de gueules chargés d'un château donjonné d'or, ceux d'argent d'un lion de gueules » — seize compons égaux le long du contour (traits en pointillé de même longueur), une figure au milieu de chacun ; réglage « Compons » (champ `cmp`) pour la bordure, le second émail et les figures (`tpc`, `cm1`, `cm2`…) se disent par le blasonnement. Dans une case de parti, la bordure reste unie. La carte de Cordoue se lit.

- **Bande ornée d'un rinceau, six figures en bande** (octobre 2026) : « à la bande d'argent ornée d'un rinceau de sable, accompagnée de six fleurs de lis d'or, trois en chef et trois en pointe » — une tige sinueuse à feuilles alternées dessinée le long de la bande ou de la barre (champ `ri`, réglage « Rinceau »), et la disposition « trois en chef et trois en pointe » pour la bande et la barre. La carte du royaume de Bosnie se lit, en écu seul (le timbre — heaume, panache de plumes de paon — n'est pas dessiné ; la note de la carte le dit).

- **Franc-quartier senestre** (octobre 2026) : « au franc-quartier senestre de gueules chargé d'une croisette d'argent » (champ `fqs`, réglage « Côté ») ; la figure suit le franc-quartier. La carte de Schwytz se lit (sa source dit « à la croisette d'argent, au franc-quartier senestre » ; l'image montre bien la croisette au chef senestre).

- **Un meuble plus grand et chargé, cinq figures en orle** (octobre 2026) : « à cinq tourteaux de gueules posés en orle, et, en chef, un tourteau plus grand d'azur chargé de trois fleurs de lis d'or » — le second meuble, seul en chef, se dit « plus grand » (champ `big2`) ; un tourteau ainsi grandi porte une à trois figures (`m2c`, `m2cn`, `m2ct`, par le blasonnement) ; cinq figures se posent aussi en orle. La carte de la maison de Médicis se lit.

- **Bande élargie, bête qui monte la bande ; Thurgovie** (octobre 2026) : « la bande élargie d'or » (champ `lrg`, réglage « Largeur ») ; une bête allongée posée sur une bande ou une barre en suit désormais la pente, la tête vers le haut de la pièce, plus grande (l'ours de Berne). Thurgovie se dessine par un texte propre à l'Atelier (un lion dans chaque partie du tranché, comme sur l'image). Les cartes de Berne et de Thurgovie se lisent.

- **Fasces ondées en nombre impair, cinq cartes par texte propre à l'Atelier** (octobre 2026) : « de sable à trois fasces ondées d'argent » (Argovie) ; Nidwald (la clé, sans son double panneton), Finlande (le lion, sans ses épées), Henri de Monpezat (le Danemark en semé de cœurs) et Jan Lubrański (le pin, de sinople) se dessinent avec une note qui dit ce que l'image a de plus. Chaque note s'affiche sous la carte.

- **Trois figures de Commons, cinq cartes acceptées une à une** (octobre 2026) : l'*aigle de Brandebourg* (coiffé, tenant sceptre et épée, écusson au sceptre : HeraldLanguage, CC BY 4.0), la *colombe tenant un rameau* et le *mont à trois coupeaux* (Jpgibert, CC BY 4.0). Cartes : Brandebourg ; Chypre (la source ne dit pas l'émail de la colombe : argent, dit dans la note) ; Slovaquie ; les deux Albanie (l'aigle seul, sans le casque de Scanderbeg, dit dans la note). Refusées par Arthur : Schaffhouse (bélier passant), Oxenstierna (rencontre de bœuf), Grenade (bande sans devise).

- **Quatre meubles de plus** (octobre 2026) : le *sabre* (Etxeko, CC BY-SA 4.0), la *lance* (Zigeuner, CC BY-SA 3.0), le *rameau d'olivier* (Henry Salomé, CC BY-SA 4.0), et l'*épée* refaite à partir de Commons (Archimatth, CC BY-SA 4.0 : épée médiévale à croisée, retournée pointe en haut) ; sabre et épée se disent « garni(e) d'or » (garde et poignée : l'attribut `garni` s'accorde désormais). Les épées passées en sautoir, le sceptre, la mitre, le briquet et le double panneton de la clé restent à trouver.

- **Deux figures « passées en sautoir »** (octobre 2026) : une nouvelle disposition pour deux meubles (lances, épées, sabres…), dite et lue « passés en sautoir ». Carte acceptée : *Islande* (croix de gueules bordée d'argent, croix centrée ; la croix scandinave décalée reste à tracer). Hedjaz et Kiszka, essayés, ont été refusés : trop de détails perdus.


- **Trois meubles de plus et un réglage d'angle** (octobre 2026) : le *sceptre* (Xavigivax, CC BY-SA 4.0), la *mitre* (Greentubing, domaine public ; « perfilée d'or ») et le *briquet* (Henry Salomé, CC BY-SA 3.0). Le curseur « Angle » du réglage graphique tourne un meuble isolé ou tout un groupe (par pas de 15°), sans toucher au blasonnement : c'est ce qui permet de tourner les briquets « adossés deux à deux ». Carte acceptée : *Serbie* (l'aigle et l'écusson à la croix cantonnée de quatre briquets ; les deux lis sous les pattes ne sont pas dessinés).


- **Crosse, aigle de Moravie, âne, mitre sans fanons** (octobre 2026) : la *crosse* (Frédéric Michel, CC BY-SA 4.0), l'*aigle échiquetée de Moravie* (Kirk979, CC BY-SA 4.0), l'*âne* (Jacques63, CC BY-SA 4.0), et une *mitre* sans fanons (Stannered, domaine public) qui remplace la précédente. Un meuble seul se pose désormais « en barre », « en bande » ou « en fasce » (« en pal » se lit, c'est sa pose ordinaire) ; la mitre se réduit quand elle broche sur un autre meuble. Cartes acceptées : *Andorre* (mitre sur crosse en barre, pals de Foix et de Catalogne, deux vaches du Béarn) et *Tchéquie* (la Silésie est dessinée avec l'aigle couronnée, sans son croissant sur le cœur).


- **Chevalier monté** (octobre 2026) : figure de Ssolbergj (CC BY-SA 4.0), recolorée (le chevalier prend l'émail du meuble, le cheval reste blanc, l'écu reste d'azur). Carte acceptée : *Lituanie* (le chevalier d'argent sur champ de gueules ; la croix patriarcale de l'écu n'est pas tracée).


- **Saint Georges terrassant le dragon** (octobre 2026) : figure de Gaeser, tirée des armes de la Géorgie (domaine public), recolorée d'un seul émail. Cartes acceptées : *Géorgie*, *Russie* et *Alexandre II de Russie* (l'écusson de la Moscovie posé sur le tout, au cœur de l'aigle ; sceptre, orbe et couronnes fermées non dessinés).


- **Croix sur l'écartelé** (octobre 2026) : un écartelé peut porter une croix sur ses quatre quartiers (émail, bord et forme au choix, droite ou pattée), dite « écartelé par une croix pattée d'argent bordée de gueules » ; les figures des quartiers se resserrent alors (sauf un semé). Carte acceptée : *Frederik X* (Dannebrog, Oldenbourg sur le tout ; le premier quartier est semé de cœurs sans en compter neuf).


- **Saint Fridolin, lion couché, casque de Skanderbeg** (octobre 2026) : le *saint Fridolin* est découpé des armes de Glaris (domaine public, nimbe, bâton et livre recolorés d'un émail), le *lion couché* vient de Sodacan (CC BY-SA 3.0) et le *casque de Skanderbeg* d'une variante des armes d'Albanie (CC BY-SA 3.0, auteur non nommé sur Commons). La carte *Glaris* est désormais dessinée avec son saint ; *Karthli* reste une ébauche, avec l'épée et le lion couché.


- **Réglages proposés par une carte** (octobre 2026) : une carte peut porter `atelierAjust` (par exemple `sz=76&dy=26&sz2=60&dy2=-24` : taille, décalages et angle du premier ou du second meuble des premières armes) ; l'Atelier l'applique à l'ouverture de la carte. Les deux cartes d'Albanie l'utilisent pour monter le casque de Skanderbeg au-dessus de l'aigle réduite ; les curseurs « Ajuster » de l'Atelier permettent de les reprendre à la main.



- **Treize cartes de plus** (octobre 2026) : sept *Blasons réels* hors des lignées et des lieux déjà traités (le royaume de Jérusalem, armes « à enquerre » ; les seigneurs de Lusignan ; le duché de Normandie ; l'Irlande, le Luxembourg, la Slovénie, la Moldavie) et six *Personnages* réunis dans un groupe « Plumes, savants et chefs de guerre » (Jeanne d'Arc, Shakespeare et sa lance, Montaigne qui blasonne lui-même ses armes, Thomas More, Pascal, la famille de Gaulle). Toutes les images sont chargées depuis Wikimedia Commons (aucun téléchargement), créditées à l'auteur de la page de description ; `check_data.py` et `check_commons.py` passent (0 erreur). L'Atelier relit cinq des sept blasons (le Luxembourg par un texte propre, « fourchée » pour « fourchue ») ; il ne relit pas encore la Slovénie (mont Triglav), la Moldavie (tête d'aurochs) ni les six personnages (figures à trouver : agneau pascal, patte de lion, coq de bruyère, noix de galle, tête de licorne ; « soutenant », « la pointe d'argent »).
- **L'écu d'une carte s'agrandit au clic** (octobre 2026) : une boîte `<dialog>` montre l'image à 1000 px (Échap ou un clic dehors la ferme) ; l'écu n'est plus un lien vers l'Atelier, qui s'ouvre par le bouton « Redessiner dans l'Atelier ». `smoke_test.py` en tient compte ; ses six échecs restants (croissant contourné, franc-quartier, 600 écus et 60 écus au hasard) datent d'avant.

## Ce qui reste à faire

Reste de la liste de travail de l'Atelier, dans l'ordre où on la reprendrait :

1. **Trente-six ébauches à reprendre** (octobre 2026) : les 167 cartes se lisent désormais, mais 36 le font par une version simplifiée (`atelier` dans `blasons.json` et `personnages.json`), dont la note sous la carte dit ce qui manque. À ajuster à la main dans l'Atelier (cliquer l'écu de la carte) : Grenade, Séville, Irak, Karthli, Hedjaz, Glaris, Schaffhouse, Appenzell Rhodes-Extérieures, Arménie, Croatie, Danemark, Hongrie, Liechtenstein, Suède, Ascanie, Margrethe II, Carafa, Fuchs, Kiszka, Oxenstierna, Thuresdotter, Pierre III, Constantin et Michel Nikolaïevitch, Maria Nikolaïevna, Adolphe-Frédéric, Charles XIII, Georges Ier de Grèce, Georges de Danemark, Gloucester, Albert de Saxe-Cobourg, Léopold Ier, Frédéric V, Charles VII, Louise et René II de Lorraine.
   - *Figures encore à trouver* : branche d'épine (Carafa), âne couché (Karthli), aigle bicéphale tenant sceptre et orbe, colombe de Chypre dont le blasonnement ne dit pas l'émail.
   - *Constructions encore absentes* : sceptre et épée de natures différentes passés en sautoir, meubles sur une bordure, barres ondées, parti d'un tranché sur le tout, quartiers à plus de quatre figures, nombre exact de cœurs (neuf) autour de lions, blason à plusieurs écus accolés.
2. **Calage des couronnes des bêtes** : fait (octobre 2026) pour les 38 bêtes, à la main avec `tools/couronnes.html` ; la couronne est dans le même repère que la figure, elle suit donc sa taille, son déplacement et son angle dans l'Atelier. L'outil reste là pour reprendre une bête (clic, flèches, molette, « Copier les ancrages modifiés », puis coller les valeurs dans `data/atelier.json`).

## Limites connues

- **Trois cartes sans blasonnement**, laissées ainsi par choix du curateur : la Saxe (grandes armes à douze quartiers et écusson ; aucun blasonnement écrit trouvé, de.wikipedia
  « Wappen Sachsens » montre l'image sans la décrire, heraldry-wiki « Sachsen (Kingdom) » le note « wanted » ; la carte renvoie à la page de la transmission des armes),
  d'Avalos (it.wikipedia « D'Avalos » blasonne un écartelé d'Avalos, d'Aquino et del Borgo qui ne correspond pas à l'image) et Rodríguez Gallego (écu trop petit, aucune source écrite).
  Les autres cartes jadis vides ont un blasonnement **lu à vue sur l'image**, que la carte signale.
- **Cartes écartées faute d'armes propres** : l'Empire colonial danois (ses colonies portaient les armes royales de Danemark-Norvège), le royaume ahom (un insigne royal,
  dessiné en 2010 par un contributeur de Wikipédia, sans blasonnement) et les Dix-Sept Provinces comme ensemble (le fichier montrait les armes de Philippe le Beau) ; douze des provinces ont
  chacune leur carte. Le « Califat chérifien » est devenu le royaume du Hedjaz (blasonnement de Hubert de Vries, d'après les billets de 1924 ; aucune source lue ne donne d'armes au califat de 1924).
  Gregers Matsson porte les armes que donne le *Svenskt biografiskt lexikon* (d'azur à la fleur de lis d'or) : le seul fichier de Commons qui les montre droites est celui de la famille Lillie
  de 1625, aux émaux inverses ; la carte échange l'or et l'azur à l'affichage (champ `filtre`, assets/cartes.js) et le dit.
- **Petits écrans** : toutes les pages tiennent en 375 px, mais l'Atelier, avec ses nombreuses commandes, reste un long formulaire sur téléphone.
- **Les images viennent de Wikimedia Commons** : les pages ne sont pas autonomes, et un fichier renommé ou supprimé là-bas manque ici.
  `check_commons.py` le signale ; copier les images dans le dépôt, avec leurs crédits, les rendrait indépendantes.
- **Sources** : elles sont citées par ouvrage, presque toujours sans numéro de page (le format `{ "id", "p" }` existe, mais n'est pas encore utilisé) ;
  certaines lignées s'appuient surtout sur Wikipédia. Le chapitre « Brisures » et les entrées du glossaire ajoutées avec lui (canton, pairle, sur le tout,
  cabré, accompagné, accosté, cantonné, chargé, rangé en, semé, plain) reposent sur des pages de Wikipédia, lues puis reformulées — leurs désaccords avec
  d'autres sources sont signalés dans le texte —, sans renvoi aux pages de Joubert ni de Pastoureau : le curateur a choisi (octobre 2026) de ne pas en ajouter.
- **Le CSS de `lignees.html` reste dans la page** : quatre de ses règles renvoient par `url(#…)` à des dégradés définis dans la page, ce que
  les navigateurs n'interprètent pas tous de la même manière depuis une feuille de style externe.
- **Le code n'a pas de licence propre** : `LICENSE` ne couvre que les textes et les figures originales.
- **Le lecteur de blasonnement** ne comprend que ce que l'Atelier sait dessiner : un peu plus d'un tiers des blasonnements des galeries (57 sur 141). Il lit les attributs des bêtes en liste
  (« armé, lampassé et vilené de gueules » : l'Atelier les colore d'un seul émail, et le dit), la couronne d'un lion (« lion couronné d'or »), « du champ », « aux trois… », les quartiers séparés par des virgules. Il ne lit pas une bordure autour d'une croix-meuble, les attitudes que l'Atelier ne dessine pas (ours dressé, bouquetin saillant…), ni les meubles absents de l'Atelier (harpe, sceptre, crosse, faisceau…), ni « de l'un en l'autre ».
  Il ne lit pas les ornements (couronne, heaume, cimier, supports). Il pose « 2 et 1 » pour trois meubles dont le texte ne dit pas la disposition, et le dit.
- **L'Atelier** : encore peu d'attitudes — une ou deux par bête, « saillant » pour le bouquetin, la chèvre et la biche seulement ; « issant » ne se dit que d'un meuble seul, sans pièce, et sort toujours de la pointe ; le manteau et le pavillon sont une silhouette unique, de proportions fixes (ni armes sur les côtés, ni toque des pairs) ; le fuselé a des proportions fixes ; pas de losangé, d'emmanché, de fretté ni de vairé comme champs.
- **Pièces, alliances, hérauts** : les chapitres « Pièces » (sauf son premier article), « Blasonnement » (sauf le premier), « Alliances » et « Hérauts et armoriaux », l'article sur le cimier,
  le cri et la devise reposent sur des pages de Wikipédia lues puis reformulées (leurs désaccords sont signalés, ceux de Wikipédia avec elle-même compris), pas sur Joubert ni Pastoureau.
- **L'arbre de la transmission des armes** n'est pas une généalogie : il ne suit que les passages qui changent un écu, avec une ligne principale par nœud ; une raison n'y est écrite que si une page lue la donne (une trentaine de passages disent encore « raison non établie »). Les branches capétiennes reprennent la classification de la page « Armorial des Capétiens », qui ne dit rien de la parenté entre personnes au-delà de la présentation du fondateur de chaque branche.
- **Les exercices** ne couvrent que ce que l'Atelier sait écrire (trois niveaux de difficulté, des écus à un ou deux meubles, parfois écartelés) ; l'exercice « Armes réelles » dépend de Commons.
- **Les résultats de S'exercer** ne sont gardés que dans le navigateur du lecteur (`localStorage`) : ni compte, ni classement.
- **Tests** : `smoke_test.py` n'a pas pu être exécuté lors de l'ajout des pages S'exercer, Rechercher et La transmission des armes ; leurs contrôles ont été écrits d'après des mesures faites dans Chrome
  à la main. Le premier passage de la CI dira s'ils tiennent.

