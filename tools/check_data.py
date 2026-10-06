"""Vérifie la cohérence du site : python tools/check_data.py

Sans dépendance (Python 3 seul). Contrôle, dans l'ordre :
  1. les données (data/*.json) : JSON valide, sources connues, figures créditées avec une licence libre ;
  2. les fichiers cités (images, SVG, données) : ils existent ;
  3. les frises de la page Lignées (data/frises.json) ;
  4. le moteur de rendu (assets/blason.js) : chaque « kind » des données y a son dessin ;
  5. l'Atelier (data/atelier.json) : meubles, noms (le lecteur de blasonnement les reconnaît : pas de doublon), ornements, fichiers ;
  6. les pages HTML et les scripts : balises équilibrées, pas de coquille dans les gabarits
     (par exemple « <div, »), fichiers liés présents, menu cohérent avec assets/chrome.js.
Code de sortie 1 s'il y a une erreur ; les avertissements n'en provoquent pas."""
import html.parser, json, pathlib, re, sys, unicodedata

ROOT = pathlib.Path(__file__).resolve().parent.parent
errors, warnings = [], []
err = errors.append

def walk(o, path=""):
    if isinstance(o, dict):
        yield path, o
        for k, v in o.items(): yield from walk(v, f"{path}.{k}")
    elif isinstance(o, list):
        for i, v in enumerate(o): yield from walk(v, f"{path}[{i}]")

def load(name):
    try: return json.loads((ROOT / name).read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        err(f"{name}: illisible ou JSON invalide ({e})"); return None

# ---------------------------------------------------------------- 1. données
DATA = {}
for f in sorted((ROOT / "data").glob("*.json")):
    d = load(f"data/{f.name}")
    if d is None: continue
    DATA[f.name] = d
    if not isinstance(d, dict): continue
    srcs = d.get("sources")
    keys = set(srcs) if isinstance(srcs, dict) else {s.get("id") for s in srcs or [] if isinstance(s, dict)}
    for path, o in walk(d):
        if path == "": continue
        refs = o.get("sources")
        if keys and isinstance(refs, list):
            for s in refs:
                if isinstance(s, dict) and ("id" in s or "p" in s):         # citation d'une page précise : { "id": "joubert1977", "p": "p. 34-35" }
                    if set(s) - {"id", "p"} or not isinstance(s.get("p"), str) or not s["p"].strip(): err(f"{f.name}{path}: citation mal formée {s} (attendu : {{ \"id\", \"p\" }})")
                    s = s.get("id")
                if isinstance(s, str) and s not in keys: err(f"{f.name}{path}: source inconnue « {s} »")
        if isinstance(o.get("file"), str) and o["file"] and not o["file"].startswith(("data/", "assets/")) and not (o.get("auteur") and o.get("lic")):
            err(f"{f.name}{path}: figure « {o['file']} » sans auteur ou licence")
        lic = o.get("lic")
        if isinstance(lic, str):
            if re.search(r"\b(NC|ND)\b", lic): err(f"{f.name}{path}: licence « {lic} » incompatible avec une reprise sous CC BY-SA")
            if lic.startswith("CC") and not o.get("licurl"): err(f"{f.name}{path}: licence « {lic} » sans lien (licurl)")
    armes = d.get("armes")
    for R in d.get("royaumes", []):
        for r in R.get("regnes", []):
            for a in [r.get("armes")] + [p.get("armes") for p in r.get("phases", [])]:
                if a and a not in armes: err(f"{f.name}: {r.get('nom')} → armes inconnues « {a} »")

# ------------------------------------------------- 2. fichiers cités par les données
for name, d in DATA.items():
    for path, o in walk(d):
        for k, v in o.items():
            if isinstance(v, str) and re.match(r"^(assets|data)/[\w./-]+$", v) and not (ROOT / v).exists():
                err(f"{name}{path}.{k}: fichier introuvable « {v} »")

# -------------------------------------------------------------- 3. frises (Lignées)
fr = DATA.get("frises.json")
if isinstance(fr, dict):
    ids = [x.get("id") for x in fr.get("frises", [])]
    if len(ids) != len(set(ids)): err("frises.json: identifiants en double")
    for x in fr.get("frises", []):
        for k in ("id", "nom", "groupe", "dates", "file", "embleme"):
            if not x.get(k): err(f"frises.json: « {x.get('id')} » sans {k}")
        if x.get("groupe") not in fr.get("groupes", []): err(f"frises.json: groupe inconnu « {x.get('groupe')} » ({x.get('id')})")
        lignee = DATA.get(pathlib.PurePosixPath(x.get("file", "")).name)
        if lignee is None: err(f"frises.json: données introuvables pour « {x.get('id')} » ({x.get('file')})"); continue
        fichiers = {o["file"] for _, o in walk(lignee) if isinstance(o.get("file"), str)}
        if x.get("embleme") not in fichiers: err(f"frises.json: l'emblème « {x.get('embleme')} » n'est crédité nulle part dans {x.get('file')}")
else:
    err("data/frises.json: absent ou mal formé")

# ------------------------------- 3 bis. renvois des cartes (Blasons réels, Personnages)
def slug(t):
    t = re.sub(r"[\u0300-\u036f]", "", unicodedata.normalize("NFD", str(t))).lower()
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", t))
def terme_id(t, glossaire):
    """Même règle que termeId() de assets/chrome.js : Bande et Bandé n'ont pas la même adresse."""
    i, bas = slug(t), str(t).lower()
    double = any(g_.get("terme") != t and slug(g_.get("terme")) == i for g_ in glossaire)
    return unicodedata.normalize("NFC", "terme-" + (re.sub(r"\s+", "-", bas) if double and bas != i else i))
cibles = {"lignees.html": {x.get("id") for x in (DATA.get("frises.json") or {}).get("frises", [])},
          "transmission.html": {n.get("id") for n in (DATA.get("transmission.json") or {}).get("noeuds", [])}}
dd = DATA.get("data.json") or {}
# (un encadré, « note », n'a pas d'adresse : seule la section se vise)
cibles["index.html"] = {s_.get("id") for s_ in dd.get("sections", [])} | {"glossaire", "bibliotheque"} \
    | {slug(a_.get("titre")) for s_ in dd.get("sections", []) for a_ in s_.get("articles", []) if a_.get("titre") and not a_.get("note")} \
    | {terme_id(g_.get("terme"), dd.get("glossaire", [])) for g_ in dd.get("glossaire", [])}
for nom in ("blasons.json", "personnages.json"):
    for e in DATA.get(nom) or []:
        for l in e.get("liens", []):
            page_, _, ancre = str(l.get("href", "")).partition("#")
            if not l.get("t"): err(f"{nom}: « {e.get('nom')} » : un renvoi sans texte")
            elif page_ not in cibles: err(f"{nom}: « {e.get('nom')} » : renvoi vers une page inconnue « {l.get('href')} »")
            elif ancre not in cibles[page_]: err(f"{nom}: « {e.get('nom')} » : l'ancre « {l.get('href')} » n'existe pas")

# --------- 3 ter. un blasonnement s'appuie sur une source (la page Commons du fichier ou un article)
for nom in ("blasons.json", "personnages.json"):
    for e in DATA.get(nom) or []:
        if e.get("blason") and not e.get("blasonSrc"): err(f"{nom}: « {e.get('nom')} » : blasonnement sans source (blasonSrc)")
        s_ = e.get("blasonSrc")
        if s_ is not None and not (isinstance(s_, dict) and s_.get("label") and str(s_.get("url", "")).startswith("http")): err(f"{nom}: « {e.get('nom')} » : blasonSrc mal formé (label et url attendus)")

# --------- 3 quinquies. l'arbre des Capétiens (data/capetiens.json) : un seul sommet, des parents qui existent, des figures créditées
cap_ = DATA.get("capetiens.json")
if cap_ is None or not isinstance(cap_.get("noeuds"), list): err("data/capetiens.json: absent ou sans « noeuds »")
else:
    ids_ = [n_.get("id") for n_ in cap_["noeuds"]]
    if len(ids_) != len(set(ids_)): err("capetiens.json: identifiants en double")
    if sum(1 for n_ in cap_["noeuds"] if not n_.get("parent")) != 1: err("capetiens.json: il faut exactement un sommet (nœud sans parent)")
    for n_ in cap_["noeuds"]:
        nom_ = f"capetiens.json: « {n_.get('nom')} »"
        for c_ in ("id", "nom", "dates", "fondateur", "armes"):
            if c_ not in n_: err(f"{nom_} : « {c_} » manquant")
        if n_.get("parent") and n_["parent"] not in ids_: err(f"{nom_} : parent « {n_['parent']} » inconnu")
        if n_.get("idem") and n_["idem"] not in ids_: err(f"{nom_} : « idem » renvoie à un nœud inconnu « {n_['idem']} »")
        for a_ in n_.get("armes", []):
            if not str(a_.get("blason", "")).strip(): err(f"{nom_} : un blasonnement vide")
        if n_.get("lien"):
            page_, _, ancre = n_["lien"].partition("#")
            if page_ not in cibles or ancre not in cibles[page_]: err(f"{nom_} : renvoi « {n_['lien']} » introuvable")
        if n_.get("file") and not (n_.get("auteur") and n_.get("lic")): err(f"{nom_} : figure sans auteur ou licence")

# --------- 3 sexies. la transmission des armes (data/transmission.json) : renvois résolubles, arbre sans cycle, chaque passage typé et sourcé
tr_ = DATA.get("transmission.json")
if tr_ is None or not isinstance(tr_.get("noeuds"), list) or not isinstance(tr_.get("liens"), list): err("data/transmission.json: absent ou sans « noeuds » / « liens »")
else:
    TYPES_ = {"cadette", "mariage", "heritage", "annexion", "pretention"}
    ids_ = [n_.get("id") for n_ in tr_["noeuds"]]
    if len(ids_) != len(set(ids_)): err("transmission.json: identifiants en double")
    cap_ids = {n_.get("id") for n_ in (cap_ or {}).get("noeuds", [])}
    frises_ = {x.get("id"): DATA.get(pathlib.PurePosixPath(x.get("file", "")).name) or {} for x in (fr or {}).get("frises", [])}
    for n_ in tr_["noeuds"]:
        nom_ = f"transmission.json: nœud « {n_.get('id')} »"
        for c_ in ("id", "ref", "nom", "dates"):
            if not n_.get(c_): err(f"{nom_} : « {c_} » manquant")
        k_, _, i_ = str(n_.get("ref", "")).partition(":")
        if k_ == "cap":
            if i_ not in cap_ids: err(f"{nom_} : « {n_.get('ref')} » absent de capetiens.json")
        elif k_ in frises_:
            a_ = frises_[k_].get("armes", {}).get(i_)
            if not a_ or not a_.get("file"): err(f"{nom_} : « {n_.get('ref')} » sans figure dans la frise")
        elif k_ == "tr":
            a_ = (tr_.get("armes") or {}).get(i_)
            if not a_: err(f"{nom_} : « {n_.get('ref')} » absent de la section « armes »")
            else:
                for c_ in ("nom", "blason", "file", "auteur", "lic", "src"):
                    if not a_.get(c_): err(f"{nom_} : armes « {i_} » sans {c_}")
                if a_.get("src") not in tr_.get("sources", {}): err(f"{nom_} : armes « {i_} » : source « {a_.get('src')} » inconnue")
        else: err(f"{nom_} : renvoi « {n_.get('ref')} » inconnu")
        if n_.get("parent") and n_["parent"] not in ids_: err(f"{nom_} : parent « {n_['parent']} » inconnu")
    par_ = {n_["id"]: n_.get("parent") for n_ in tr_["noeuds"] if n_.get("id")}
    for i_ in par_:                                          # pas de cycle : on remonte au plus loin len(par_) fois
        p_, pas_ = i_, 0
        while p_ and pas_ <= len(par_): p_, pas_ = par_.get(p_), pas_ + 1
        if p_: err(f"transmission.json: cycle de parents à partir de « {i_} »"); break
    liens_ = tr_["liens"]
    for l_ in liens_:
        nom_ = f"transmission.json: passage « {l_.get('de')} » → « {l_.get('vers')} »"
        if l_.get("de") not in par_ or l_.get("vers") not in par_: err(f"{nom_} : extrémité inconnue"); continue
        if l_.get("type") not in TYPES_: err(f"{nom_} : type « {l_.get('type')} » inconnu")
        for c_ in ("annee", "effet"):
            if not str(l_.get(c_, "")).strip(): err(f"{nom_} : « {c_} » vide")
        if not l_.get("pourquoi") and not l_.get("lacune"): err(f"{nom_} : ni raison ni « lacune » (une raison inconnue doit être dite)")
        if l_.get("pourquoi") and not l_.get("sources"): err(f"{nom_} : une raison sans source")
        if l_.get("jalon"):
            fk_, _, an_ = l_["jalon"].partition(":")
            ok_ = any(isinstance(j_.get("annee"), (int, float)) and str(j_["annee"]) == an_ for r_ in frises_.get(fk_, {}).get("royaumes", []) for j_ in r_.get("jalons", []))
            if not ok_: err(f"{nom_} : jalon « {l_['jalon']} » introuvable")
        if l_.get("lien"):
            page_, _, ancre = l_["lien"].get("href", "").partition("#")
            if page_ not in cibles or ancre not in cibles[page_]: err(f"{nom_} : renvoi « {l_['lien'].get('href')} » introuvable")
    for n_ in tr_["noeuds"]:
        if n_.get("parent") and not any(l_.get("de") == n_["parent"] and l_.get("vers") == n_["id"] for l_ in liens_):
            err(f"transmission.json: « {n_['id']} » n'a pas de passage depuis son parent « {n_['parent']} »")
        if n_.get("apport") and n_.get("parent"): err(f"transmission.json: « {n_['id']} » est une maison en apport : elle ne peut pas avoir de parent")
        if n_.get("apport") and not any(l_.get("de") == n_["id"] for l_ in liens_): err(f"transmission.json: la maison en apport « {n_['id']} » ne donne ses armes à personne")

# ------------------------------------------------------- 4. moteur de rendu
JS = (ROOT / "assets" / "blason.js").read_text(encoding="utf-8")
def cases(fn):
    """les « case "…": » d'une fonction de blason.js (de sa déclaration à la fonction suivante)"""
    m = re.search(rf"^function {fn}\(.*?(?=^function |\Z)", JS, re.S | re.M)
    return set(re.findall(r'case\s+"([^"]+)"\s*:', m.group(0))) if m else set()
dessins = {fn: cases(fn) for fn in ("partitionInner", "pieceInner", "chargeInner", "recoupementInner")}
for fn, c in dessins.items():
    if not c: err(f"assets/blason.js: fonction {fn} introuvable ou sans « case »")
d = DATA.get("data.json") or {}
def verifie(liste, fn, quoi, ignore=lambda x: False):
    for x in liste:
        if x.get("kind") and not ignore(x) and x["kind"] not in dessins[fn]:
            err(f"data.json: {quoi} « {x['kind']} » sans dessin dans {fn}() de assets/blason.js")
verifie(d.get("partitions", []), "partitionInner", "partition")
verifie(d.get("regles", {}).get("courbes", []), "partitionInner", "courbe")
verifie(d.get("regles", {}).get("recoupements", []), "recoupementInner", "recoupement")
verifie(d.get("pieces", []), "pieceInner", "pièce")
verifie(d.get("meubles", []), "chargeInner", "meuble", ignore=lambda m: m.get("image"))
cn = re.search(r"const CONTOUR_NOM = \{(.*?)\};", (ROOT / "assets" / "blasonnement.js").read_text(encoding="utf-8"), re.S)
cc = re.search(r"const CONTOURS = \{(.*?)^\};", JS, re.S | re.M)
if cn and cc:
    for k in re.findall(r"(\w+):", cn.group(1)):
        if k == "alesee": continue                           # l'alésé n'est pas un bord décoré : c'est pieceAlesee() dans assets/blason.js
        if not re.search(rf"^\s*{k}\s*:", cc.group(1), re.M): err(f"assets/blasonnement.js: bord « {k} » (CONTOUR_NOM) sans tracé dans CONTOURS de assets/blason.js")
else: err("assets/blasonnement.js ou assets/blason.js: CONTOUR_NOM ou CONTOURS introuvable")
HACHURES = {"none", "ermine", "vair", "dots", "vert", "horiz", "cross", "bend", "bendsin"}
for t in d.get("tinctures", []):
    if t.get("hatch") not in HACHURES: err(f"data.json: émail « {t.get('nom')} » : hachure inconnue « {t.get('hatch')} »")

# ------------------------------------------------------------- 5. Atelier
a = DATA.get("atelier.json")
if isinstance(a, dict):
    kinds = [m.get("kind") for m in a.get("meubles", [])]
    if len(kinds) != len(set(kinds)): err("atelier.json: meubles en double")
    for m in a.get("meubles", []):
        k = m.get("kind")
        for c in ("nom", "sing", "plur", "g", "cat"):
            if not m.get(c): err(f"atelier.json: meuble « {k} » sans {c}")
        if m.get("g") not in ("m", "f"): err(f"atelier.json: meuble « {k} » : genre « {m.get('g')} » (m ou f attendu)")
        if m.get("file"):
            if not m.get("box"): err(f"atelier.json: meuble « {k} » : figure sans « box »")
            for c in ("commons", "auteur", "lic", "licurl"):
                if not m["file"].get(c): err(f"atelier.json: meuble « {k} » : figure sans {c}")
        elif m.get("draw"):
            if m["draw"] != "lis" and m["draw"] not in dessins["chargeInner"]:
                err(f"atelier.json: meuble « {k} » : dessin « {m['draw']} » absent de chargeInner()")
        elif not m.get("custom"): err(f"atelier.json: meuble « {k} » sans dessin ni figure")
    # les noms que le lecteur de blasonnement (assets/lecture.js) reconnaît : sing, plur et alias, sans doublon entre meubles ni avec une pièce
    noms = {}
    par_kind = {m.get("kind"): m for m in a.get("meubles", [])}
    for m in a.get("meubles", []):
        if m.get("homonyme") and m["homonyme"] not in par_kind: err(f"atelier.json: meuble « {m.get('kind')} » : homonyme « {m['homonyme']} » inconnu")
    pieces = {"chef", "fasce", "pal", "bande", "barre", "croix", "sautoir", "chevron", "bordure", "orle", "canton", "franc-quartier", "pairle", "cotice"}
    for m in a.get("meubles", []):
        k = m.get("kind")
        al = m.get("alias", [])
        if not isinstance(al, list) or any(not (isinstance(x, list) and len(x) == 2 and all(isinstance(s, str) and s for s in x)) for x in al):
            err(f"atelier.json: meuble « {k} » : « alias » doit être une liste de paires [singulier, pluriel]"); al = []
        for nom in [m.get("sing"), m.get("plur")] + [s for x in al for s in x]:
            cle = re.sub(r"[-\s]+", " ", (nom or "").lower())
            if cle in pieces: err(f"atelier.json: le nom « {nom} » du meuble « {k} » est aussi celui d'une pièce")
            autre = noms.setdefault(cle, k)
            # deux meubles peuvent partager un nom s'ils le déclarent (« homonyme ») : le lecteur les départage par leurs attributs (l'aigle, couronnée ou non)
            if autre != k and m.get("homonyme") != autre and par_kind.get(autre, {}).get("homonyme") != k:
                err(f"atelier.json: le nom « {nom} » est donné à la fois à « {autre} » et à « {k} »")
        for cle in ("main", "accent", "drop"):
            for c in m.get(cle, []):
                if not (isinstance(c, str) and re.fullmatch(r"(?:(?:fill|stroke):)?#[0-9a-fA-F]{3,8}", c)):
                    err(f"atelier.json: meuble « {k} » : couleur « {c} » dans « {cle} » (attendu : #rrggbb, ou fill:#rrggbb)")
        for drapeau in ("accentTrait", "allongee"):
            if drapeau in m and m[drapeau] is not True: err(f"atelier.json: meuble « {k} » : « {drapeau} » vaut true ou n'existe pas")
        if m.get("accentTrait") and not m.get("accentMot"): err(f"atelier.json: meuble « {k} » : « accentTrait » sans « accentMot »")
    for pc in a.get("pieces", []):
        for c in ("kind", "nom", "g"):
            if not pc.get(c): err(f"atelier.json: pièce « {pc.get('kind')} » sans {c}")
        if pc.get("kind") not in dessins["pieceInner"]: err(f"atelier.json: pièce « {pc.get('kind')} » sans dessin dans pieceInner() de assets/blason.js")
    # le glossaire définit-il les pièces de l'Atelier et les mots dont son blasonnement se sert (voir blazon() dans assets/blasonnement.js) ?
    def mots(s):
        s = re.sub(r"[\u0300-\u036f]", "", __import__("unicodedata").normalize("NFD", s.lower()))
        return re.sub(r"[^a-z0-9]+", " ", s).strip()
    defini = set()
    for liste in ("glossaire", "attributs", "positions", "repertoire"):
        for g in (DATA.get("data.json") or {}).get(liste, []):
            defini.add(mots(g.get("terme", "")))
            defini.update(mots(x) for x in g.get("terme", "").split(","))
    attendus = [pc.get("nom") for pc in a.get("pieces", [])] + ["sur le tout", "brochant", "accompagné", "accosté", "cantonné", "chargé", "rangé en", "contourné", "semé", "plein", "cabré",
               "alésé", "bordé", "échiqueté", "fuselé", "vergeté", "coticé", "chevronné", "burelé", "tire",
               "courant", "couché", "assis", "vol abaissé", "wyvern", "lionné", "ravissant", "essorant", "manteau", "pavillon", "issant", "doublé",
               "de l'un en l'autre"]
    for t in attendus:
        if t and mots(t) not in defini and not any(mots(t) in d for d in defini):
            err(f"data.json: « {t} » est un mot de l'Atelier (pièce ou blasonnement) que le glossaire ne définit pas")
    o = a.get("ornements", {})
    for h in o.get("heaumes", []):
        if h.get("type") not in o.get("heaumeTypes", {}): err(f"atelier.json: heaume « {h.get('kind')} » : type inconnu")
        if h.get("pos") not in o.get("heaumePos", {}): err(f"atelier.json: heaume « {h.get('kind')} » : position inconnue")
    for s in o.get("supports", []):
        if s.get("kind") not in kinds: err(f"atelier.json: support « {s.get('kind')} » : meuble inconnu")

# -------------------------------------------- 6. pages HTML, scripts et gabarits
VOID = {"meta", "link", "br", "hr", "img", "input", "source", "area", "base", "col", "embed", "param", "track", "wbr"}
class Equilibre(html.parser.HTMLParser):
    def __init__(self, nom):
        super().__init__(convert_charrefs=True); self.nom, self.pile = nom, []
    def handle_starttag(self, tag, attrs):
        if tag not in VOID: self.pile.append((tag, self.getpos()[0]))
    def handle_startendtag(self, tag, attrs): pass
    def handle_endtag(self, tag):
        if tag in VOID: return
        if not self.pile or self.pile[-1][0] != tag:
            err(f"{self.nom}:{self.getpos()[0]}: balise fermante </{tag}> sans ouvrante correspondante"
                + (f" (ouverte : <{self.pile[-1][0]}> ligne {self.pile[-1][1]})" if self.pile else ""))
            if any(t == tag for t, _ in self.pile):
                while self.pile and self.pile[-1][0] != tag: self.pile.pop()
                self.pile.pop()
        else: self.pile.pop()

TAGS = "a|b|i|u|em|strong|p|div|span|ul|ol|li|dl|dt|dd|h[1-6]|svg|g|path|rect|circle|ellipse|line|text|use|defs|symbol|button|input|select|option|label|section|article|header|footer|nav|main|img|table|tr|td|th|code|pre|small|sub|sup|figure|figcaption|details|summary"
COQUILLE = re.compile(rf"<(?:{TAGS})[,;:](?=[\s\w])", re.I)   # « <div, suisse2013: … », « <p; »…
pages = sorted(ROOT.glob("*.html"))
for p in pages:
    t = p.read_text(encoding="utf-8")
    eq = Equilibre(p.name); eq.feed(t)
    for tag, ligne in eq.pile: err(f"{p.name}:{ligne}: balise <{tag}> jamais fermée")
    for m in re.finditer(r'(?:src|href)="((?:assets|data)/[^"#?]+)"', t):
        if not (ROOT / m.group(1)).exists(): err(f"{p.name}: fichier lié introuvable « {m.group(1)} »")
for f in pages + sorted((ROOT / "assets").glob("*.js")):
    t = f.read_text(encoding="utf-8")
    for m in COQUILLE.finditer(t):
        err(f"{f.relative_to(ROOT)}:{t.count(chr(10), 0, m.start()) + 1}: coquille probable dans un gabarit : « {t[m.start():m.start() + 40].splitlines()[0]} »")

# l'ordre des scripts : chaque fichier s'appuie sur des globaux que d'autres définissent, il doit venir après eux
DEPENDANCES = {"lecture.js": ["blasonnement.js"], "dessin.js": ["blason.js", "blasonnement.js"], "atelier.js": ["blasonnement.js", "lecture.js", "dessin.js"],
               "exercices.js": ["blason.js", "blasonnement.js", "lecture.js", "dessin.js"],
               "blasons.js": ["lecture.js", "cartes.js"], "personnages.js": ["lecture.js", "cartes.js"]}
for p in pages:
    scripts = re.findall(r'<script src="assets/([\w.-]+)"', p.read_text(encoding="utf-8"))
    for dependant, avant in DEPENDANCES.items():
        if dependant not in scripts: continue
        for a in avant:
            if a not in scripts or scripts.index(a) > scripts.index(dependant): err(f"{p.name}: assets/{a} doit être chargé avant assets/{dependant}")

# le plan du site cite chaque page
plan = (ROOT / "sitemap.xml").read_text(encoding="utf-8") if (ROOT / "sitemap.xml").exists() else ""
for p_ in pages:
    if p_.name == "404.html": continue                        # la page d'erreur n'est ni au plan du site ni au menu
    cible = "armorial/" if p_.name == "index.html" else f"armorial/{p_.name}"
    if f"{cible}</loc>" not in plan: err(f"sitemap.xml: la page « {p_.name} » n'y figure pas")
chrome = (ROOT / "assets" / "chrome.js").read_text(encoding="utf-8")
menu = re.findall(r'\["(\w+)",\s*"([\w.-]+\.html)"', chrome)
for ident, fichier in menu:
    page = ROOT / fichier
    if not page.exists(): err(f"assets/chrome.js: la page « {fichier} » du menu n'existe pas"); continue
    if f'data-page="{ident}"' not in page.read_text(encoding="utf-8"): err(f"{fichier}: <header class=\"mast\" data-page=\"{ident}\"> manquant")
for p in pages:
    if p.name != "404.html" and p.name not in {f for _, f in menu}: warnings.append(f"{p.name}: absente du menu (assets/chrome.js)")

for w in warnings: print("avertissement :", w)
print("\n".join(errors) or "OK")
sys.exit(1 if errors else 0)
