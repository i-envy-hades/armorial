"""Vérifie la cohérence du site : python tools/check_data.py

Sans dépendance (Python 3 seul). Contrôle, dans l'ordre :
  1. les données (data/*.json) : JSON valide, sources connues, figures créditées avec une licence libre ;
  2. les fichiers cités (images, SVG, données) : ils existent ;
  3. les frises de la page Lignées (data/frises.json) ;
  4. le moteur de rendu (assets/blason.js) : chaque « kind » des données y a son dessin ;
  5. l'Atelier (data/atelier.json) : meubles, ornements, fichiers ;
  6. les pages HTML et les scripts : balises équilibrées, pas de coquille dans les gabarits
     (par exemple « <div, »), fichiers liés présents, menu cohérent avec assets/chrome.js.
Code de sortie 1 s'il y a une erreur ; les avertissements n'en provoquent pas."""
import html.parser, json, pathlib, re, sys

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
    for pc in a.get("pieces", []):
        for c in ("kind", "nom", "g"):
            if not pc.get(c): err(f"atelier.json: pièce « {pc.get('kind')} » sans {c}")
        if pc.get("kind") not in dessins["pieceInner"]: err(f"atelier.json: pièce « {pc.get('kind')} » sans dessin dans pieceInner() de assets/blason.js")
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

chrome = (ROOT / "assets" / "chrome.js").read_text(encoding="utf-8")
menu = re.findall(r'\["(\w+)",\s*"([\w.-]+\.html)"', chrome)
for ident, fichier in menu:
    page = ROOT / fichier
    if not page.exists(): err(f"assets/chrome.js: la page « {fichier} » du menu n'existe pas"); continue
    if f'data-page="{ident}"' not in page.read_text(encoding="utf-8"): err(f"{fichier}: <header class=\"mast\" data-page=\"{ident}\"> manquant")
for p in pages:
    if p.name not in {f for _, f in menu}: warnings.append(f"{p.name}: absente du menu (assets/chrome.js)")

for w in warnings: print("avertissement :", w)
print("\n".join(errors) or "OK")
sys.exit(1 if errors else 0)
