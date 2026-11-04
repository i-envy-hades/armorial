"""Test de fumée : charge chaque page dans un vrai navigateur et vérifie qu'elle se construit.

    pip install playwright            # une fois
    python tools/smoke_test.py        # utilise Google Chrome s'il est installé

Sans Chrome : « playwright install chromium » télécharge un navigateur de rechange (le script le prend tout seul).
Le site est servi en local ; les images de Wikimedia Commons sont remplacées par un pixel transparent,
si bien que le test ne dépend ni du réseau ni de l'humeur de Wikimedia.

Ce que l'on contrôle : aucune erreur dans la console, aucun fichier local manquant, aucune balise absurde
(« <div, »), toutes les cartes dans leur grille, la recherche, les ancres d'adresse, les frises,
l'Atelier (blasonnements connus, puis des compositions au hasard qui ne doivent jamais échouer), le lecteur de blasonnement
(chaque écu que l'Atelier sait écrire doit se relire à l'identique ; ce qui n'est pas compris est refusé, jamais deviné)
les boutons « Redessiner dans l'Atelier » et les écus cliquables des galeries, « Partir d'un blason réel » dans l'Atelier, les pages S'exercer (chaque question posée est cohérente), L'Écu du jour (une partie gagnée, une partie perdue, le profil), Rechercher
(chaque lien d'un résultat mène à une ancre qui existe) et La transmission des armes, enfin le téléphone (375 px : rien ne déborde, le menu se replie).
Code de sortie 1 au premier échec. FUZZ=500 python tools/smoke_test.py pousse l'Atelier plus loin (500 compositions)."""
import functools, http.server, json, os, pathlib, random, re, sys, threading, unicodedata, urllib.parse

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sys.exit("Playwright manque : pip install playwright")

ROOT = pathlib.Path(__file__).resolve().parent.parent
PIXEL = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000001e221bc330000000049454e44ae426082")
echecs, lignes = [], []

def ok(msg): lignes.append(f"  ok   {msg}")
def ko(msg):
    lignes.append(f"  ECHEC {msg}"); echecs.append(msg)
    if os.environ.get("GITHUB_ACTIONS"): print("::error title=Test de fumée::" + str(msg).replace("%", "%25").replace("\r", " ").replace("\n", " ")[:900], flush=True)      # une annotation : lisible sans compte, contrairement au journal
def verifie(cond, msg):
    (ok if cond else ko)(msg)
    return cond

def serveur():
    class H(http.server.SimpleHTTPRequestHandler):
        def end_headers(self):
            self.send_header("Cache-Control", "no-store"); super().end_headers()
        def log_message(self, *a): pass
    s = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(H, directory=str(ROOT)))
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s, f"http://127.0.0.1:{s.server_address[1]}"

sys.path.insert(0, str(ROOT / "tools" / "firebase"))
import mock_firebase as MF                                   # le faux Firebase : les jeux du jour lisent leur document dans la base

ECUS = {"page": "Belgique", "chevalier": "Canton de Zurich", "heraut": "Maison de Médicis"}
def serveur_en_ligne():
    """le site servi par le faux Firebase, avec un document du jour ouvert pour hier, aujourd'hui et demain (le jour de Paris)"""
    import datetime
    n = (datetime.date.today() - datetime.date(2026, 10, 9)).days + 1
    for k in range(n - 1, n + 2):
        MF.DB["docs"][f"jours/{k}"] = {"ouvre": "2000-01-01T00:00:00Z", "ecu": dict(ECUS), "graine": 12345}
    return MF.serve()

def lance(p):
    try: return p.chromium.launch(channel="chrome", headless=True)
    except Exception: return p.chromium.launch(headless=True)

def ouvre(browser, base, page_url, attente):
    """ouvre une page ; renvoie (page, erreurs) une fois `attente` (sélecteur) apparu"""
    ctx = browser.new_context(viewport={"width": 1280, "height": 900}, locale="fr-FR")
    ctx.route("**/*", lambda r: r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200, content_type="image/png", body=PIXEL))
    page = ctx.new_page()
    erreurs = []
    page.on("pageerror", lambda e: erreurs.append(f"erreur JavaScript : {e}"))
    page.on("console", lambda m: m.type == "error" and erreurs.append(f"console : {m.text}"))
    page.on("response", lambda r: r.url.startswith(base) and r.status >= 400 and erreurs.append(f"HTTP {r.status} : {r.url.replace(base, '')}"))
    page.goto(f"{base}/{page_url}")
    page.wait_for_selector(attente, timeout=20000)
    # le texte prérendu (tools/prerendu.py) est déjà dans le HTML : on attend que le script l'ait remplacé par la page construite
    page.wait_for_function("!document.documentElement.innerHTML.includes('<!--pr\\u00e9rendu:')", timeout=20000)
    page.wait_for_timeout(600)
    return page, erreurs

BALISES_ABSURDES = "[...document.querySelectorAll('*')].filter(e => !/^[A-Za-z][A-Za-z0-9:-]*$/.test(e.tagName)).map(e => e.tagName)"

def propre(nom, page, erreurs):
    verifie(not erreurs, f"{nom} : aucune erreur" + ("" if not erreurs else " — " + " | ".join(erreurs[:3])))
    absurdes = page.evaluate(BALISES_ABSURDES)
    verifie(not absurdes, f"{nom} : aucune balise absurde" + ("" if not absurdes else f" — {absurdes[:3]}"))

def data(nom): return json.loads((ROOT / "data" / nom).read_text(encoding="utf-8"))
def slug_carte(nom):                                         # l'adresse d'une carte des galeries, comme slugCarte (assets/cartes.js)
    s = re.sub(r"[\u0300-\u036f]", "", unicodedata.normalize("NFD", nom)).lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")
MENU = re.findall(r'\["(\w+)",\s*"([\w.-]+\.html|\./)",\s*"([^"]+)"', (ROOT / "assets" / "chrome.js").read_text(encoding="utf-8"))      # (identifiant, fichier, libellé) du bandeau

# ------------------------------------------------------------------ pages
def test_index(browser, base):
    D = data("data.json")
    page, erreurs = ouvre(browser, base, "encyclopedie.html", "#main .section")
    verifie(page.locator(".section").count() == len(D["sections"]) + 2, "index : un chapitre par section, plus le glossaire et les sources")
    verifie(page.locator("#main .article[id]").count() > 20, "index : les articles ont une adresse")
    ids = page.evaluate("[...document.querySelectorAll('[id]')].map(e => e.id)")
    verifie(len(ids) == len(set(ids)), "index : aucune adresse en double")
    # chaque galerie contient toutes ses cartes (c'était le bug de la galerie des traits)
    egares = page.evaluate("document.querySelectorAll('.reveal > .fig, .article > .fig').length")
    verifie(egares == 0, "index : aucune carte sortie de sa galerie")
    traits = page.evaluate("[...document.querySelectorAll('.gal.figs')].map(g => g.children.length)")
    verifie(len(D["regles"]["traits"]) in traits, "index : la galerie des traits montre ses quatre écus")
    # le glossaire définit ce que l'Atelier écrit ; le chapitre « Brisures » ne tient plus en un paragraphe ; une source peut citer une page
    termes = page.evaluate("[...document.querySelectorAll('#glist dt')].map(d => d.textContent)")
    verifie(all(x in termes for x in ("Canton", "Pairle", "Sur le tout", "Cabré")), "index : le glossaire définit canton, pairle, sur le tout et cabré")
    verifie(page.locator("#brisures .article").count() >= 5, "index : le chapitre « Brisures » compte plusieurs articles")
    verifie("Joubert (1977), p. 1" in page.evaluate("srcTag([{ id: 'joubert1977', p: 'p. 1' }])"), "index : une source peut citer une page précise")
    # recherche
    page.fill("#q", "lampass")
    page.wait_for_selector("#sresults .sr", timeout=5000)
    verifie(page.locator("#sresults .sr").count() >= 1, "index : la recherche trouve « lampassé »")
    propre("index", page, erreurs)
    page.context.close()
    # ancre d'adresse : la page se construit après coup, il faut qu'elle y aille
    page, erreurs = ouvre(browser, base, "encyclopedie.html#emaux", "#main .section")
    page.wait_for_timeout(2500)          # le temps que les polices arrivent et que la page se replace
    haut = page.evaluate("document.getElementById('emaux').getBoundingClientRect().top")
    verifie(60 < haut < 80, f"index#emaux : la page se place sur le chapitre, sous le bandeau (haut à {haut:.0f} px)")
    propre("index#emaux", page, erreurs)
    page.context.close()
    # une ancre mal formée ne casse rien
    page, erreurs = ouvre(browser, base, "encyclopedie.html#%E0%A4%A", "#main .section")
    page.fill("#q", "lampass"); page.wait_for_selector("#sresults .sr", timeout=5000)
    propre("index#ancre mal formée", page, erreurs)
    page.context.close()

def test_galerie(browser, base, page_url, fichier, nom):
    page, erreurs = ouvre(browser, base, page_url, ".ar")
    verifie(page.locator(".ar").count() == len(data(fichier)), f"{nom} : une carte par entrée de {fichier}")
    verifie(page.locator("header.mast nav a").count() == len(MENU) and page.locator("header.mast nav a.here").count() == 1, f"{nom} : menu complet, page courante marquée")
    verifie(page.locator("footer .seal").count() == 1, f"{nom} : sceau du pied de page")
    propre(nom, page, erreurs)
    page.context.close()

def test_lignees(browser, base):
    F = data("frises.json")
    for fr in F["frises"]:
        page, erreurs = ouvre(browser, base, f"lignees.html#{fr['id']}", "#royaumes .stage, #royaumes > *")
        page.wait_for_timeout(1200)
        verifie(fr["nom"] in page.title(), f"lignées/{fr['id']} : titre « {page.title()} »")
        verifie(page.locator("#royaumes svg").count() > 5, f"lignées/{fr['id']} : la frise est dessinée")
        propre(f"lignées/{fr['id']}", page, erreurs)
        page.context.close()

# ------------------------------------------------------------------ Atelier
FUZZ = """async (n) => {
  const pick = a => a[Math.floor(Math.random() * a.length)], O = ATL.ornements, pb = [];
  for (let i = 0; i < n; i++) {
    try {
      const St = fresh();
      St.q = pick(["", "2", "4", "c", "t", "l"]);
      for (let j = 0; j < 4; j++) St.A[j] = { ...randomArms(), f: pick(["plein", "part", "ray"]), part: pick(DATA.partitions.map(p => p.kind)),
        ray: pick(RAYS), n: pick(["3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"]), t3: pick(Object.keys(MOT)),
        m2: Math.random() < .4 ? pick(ATL.meubles).kind : "", nb2: pick(["1", "2", "3", "4"]),
        nb: pick(["1", "2", "3", "4", "5", "6", "8", "seme"]), p: Math.random() < .6 ? pick(Object.keys(PIECES)) : "", iss: pick(["", "", "1"]), pos: pick(["autour", "sur", "sous"]), pf: pick(["", "", "", ...Object.keys(MOT)]), cn: pick(["", "", ...Object.keys(MOT)]), cn2: pick(["", "", ...Object.keys(MOT)]),
        ln: pick(["", ...Object.keys(CONTOUR_NOM)]), ct: pick(["", "1"]), ct2: pick(["", "1"]) };
      St.cr = pick(["", ...O.couronnes.map(c => c.kind)]); St.hm = pick(["", "h", "hl"]); St.ht = pick(Object.keys(O.heaumeTypes)); St.hp = pick(Object.keys(O.heaumePos));
      St.pa = pick(["", "3", "5"]); St.su = pick(["", ...O.supports.map(x => x.kind)]); St.co = pick(["", ...O.colliers.map(c => c.kind)]);
      St.dv = Math.random() < .5 ? "Dieu et mon droit" : ""; St.dt = pick(Object.keys(DEVISES)); St.sh = pick(Object.keys(SHAPES));
      St.ab = pick(["", "1"]); if (St.ab) St.A[4] = { ...randomArms(), ln: pick(["", ...Object.keys(CONTOUR_NOM)]) };
      S = normalizeAll(St); await loadAll(S);
      const c = compose(S), b = blazonAll(S), o = ornText(S);
      ruleAll(S); creditsOf(S);
      const svg = c.svg.replace(/data:[^"]+/g, "");
      if (/undefined|\\[object|NaN/.test(b + o)) pb.push("texte : " + b);
      if (/NaN|undefined/.test(svg)) pb.push("svg : " + b);
      if (!c.vb.every(Number.isFinite)) pb.push("viewBox : " + b);
      if (/ {2}|,,| ,|\\.\\./.test(b)) pb.push("typographie : " + b);
      const back = decode("#" + encode(S));                       // le lien de partage doit redonner la même composition
      if (blazonAll(normalizeAll(back)) !== b) pb.push("lien de partage : " + b);
    } catch (e) { pb.push("exception : " + (e && e.message || e)); }
  }
  S = fresh(); SHIELD_D = SHAPES[""].d;
  return pb;
}"""

def blasonne(page, etat):
    """blasonnement d'un état de l'Atelier (dict : { 'A0': {...}, 'q': ..., ... })"""
    return page.evaluate("""(ex) => { const St = example(ex); const s = normalizeAll(St); return blazonAll(s); }""", etat)

# (composition, blasonnement attendu) : des armes connues, et des cas de grammaire
CONNUES = [
    ({"A0": {"t1": "Azur", "m": "fleurdelis", "nb": "3", "tm": "Or"}}, "D'azur à trois fleurs de lis d'or"),
    ({"A0": {"t1": "Gueules", "m": "", "p": "croix", "tp": "Argent"}}, "De gueules à la croix d'argent"),
    ({"A0": {"t1": "Azur", "m": "fleurdelis", "nb": "seme", "tm": "Or"}}, "D'azur semé de fleurs de lis d'or"),
    ({"A0": {"t1": "Argent", "p": "chef", "tp": "Azur", "pos": "sur", "m": "etoile", "nb": "3", "tm": "Or"}}, "D'argent au chef d'azur chargé de trois étoiles d'or"),
    ({"A0": {"t1": "Argent", "p": "bande", "tp": "Gueules", "pos": "sur", "m": "coquille", "nb": "3", "tm": "Or"}}, "D'argent à la bande de gueules chargée de trois coquilles d'or"),
    ({"A0": {"t1": "Argent", "p": "croix", "tp": "Gueules", "m": "merlette", "nb": "4", "tm": "Sable"}}, "D'argent à la croix de gueules cantonnée de quatre merlettes de sable"),
    ({"A0": {"t1": "Azur", "p": "chevron", "tp": "Or", "m": "croissant", "nb": "3", "tm": "Argent"}}, "D'azur au chevron d'or accompagné de trois croissants d'argent"),
    ({"A0": {"t1": "Gueules", "m": "lion", "nb": "3", "tm": "Or", "ta": "Azur"}}, "De gueules à trois lions d'or armés et lampassés d'azur"),
    ({"A0": {"f": "part", "part": "parti", "t1": "Azur", "t2": "Gueules", "m": "fleurdelis", "nb": "1", "tm": "Or"}}, "Parti d'azur et de gueules, à la fleur de lis d'or brochant sur le tout"),
    ({"A0": {"f": "ray", "ray": "barry", "n": "8", "t1": "Argent", "t2": "Azur", "m": ""}}, "Fascé d'argent et d'azur de huit pièces"),
    # bords des pièces (accord en genre : la fasce ondée, le chef denché)
    ({"A0": {"t1": "Argent", "m": "", "p": "fasce", "tp": "Azur", "ln": "onde"}}, "D'argent à la fasce ondée d'azur"),
    ({"A0": {"t1": "Or", "m": "", "p": "bordure", "tp": "Gueules", "ln": "engrele"}}, "D'or à la bordure engrêlée de gueules"),
    ({"A0": {"t1": "Azur", "m": "", "p": "bande", "tp": "Argent", "ln": "engrele"}}, "D'azur à la bande engrêlée d'argent"),
    ({"A0": {"t1": "Argent", "m": "", "p": "chef", "tp": "Azur", "ln": "denche"}}, "D'argent au chef denché d'azur"),
    ({"A0": {"t1": "Gueules", "m": "", "p": "croix", "tp": "Argent", "ln": "denche"}}, "De gueules à la croix denchée d'argent"),
    ({"A0": {"t1": "Argent", "m": "", "p": "sautoir", "tp": "Sable", "ln": "dancette"}}, "D'argent au sautoir dancetté de sable"),
    # meubles contournés (accord au pluriel, au féminin)
    ({"A0": {"t1": "Azur", "m": "lion", "nb": "1", "tm": "Or", "ta": "Gueules", "ct": "1"}}, "D'azur au lion contourné d'or armé et lampassé de gueules"),
    ({"A0": {"t1": "Gueules", "m": "lion", "nb": "3", "tm": "Or", "ta": "Azur", "ct": "1"}}, "De gueules à trois lions contournés d'or armés et lampassés d'azur"),
    ({"A0": {"t1": "Or", "m": "aigle", "nb": "1", "tm": "Sable", "ta": "Gueules", "ct": "1"}}, "D'or à l'aigle contournée de sable becquée, membrée et couronnée de gueules"),
    ({"A0": {"t1": "Azur", "m": "croissant", "nb": "1", "tm": "Or", "ct": "1"}}, "D'azur au croissant contourné d'or"),   # le croissant se contourne en tournant (ctRot)
    ({"A0": {"t1": "Azur", "m": "etoile", "nb": "1", "tm": "Or", "ct": "1"}}, "D'azur à l'étoile d'or"),   # une étoile retournée ne change pas : le réglage est ignoré
    # les bêtes de Commons : léopard, lion passant, aigle à deux têtes, cerf, cheval (dont l'accord au pluriel : « chevaux cabrés »)
    ({"A0": {"t1": "Gueules", "m": "leopard", "nb": "3", "d": "pal", "tm": "Or", "ta": "Azur", "sz": "190"}}, "De gueules à trois léopards d'or armés et lampassés d'azur"),       # trois léopards : en pal sans qu'on le dise
    ({"A0": {"t1": "Azur", "m": "lion-passant", "nb": "1", "tm": "Or", "ta": "Gueules"}}, "D'azur au lion passant d'or armé et lampassé de gueules"),
    ({"A0": {"t1": "Or", "m": "aigle-bicephale", "nb": "1", "tm": "Sable", "ta": "Gueules"}}, "D'or à l'aigle bicéphale de sable becquée, membrée et couronnée de gueules"),
    ({"A0": {"t1": "Sinople", "m": "cerf", "nb": "1", "tm": "Or"}}, "De sinople au cerf passant d'or"),
    ({"A0": {"t1": "Azur", "m": "cheval", "nb": "3", "tm": "Argent", "ct": "1"}}, "D'azur à trois chevaux cabrés contournés d'argent"),
    # les figures de Commons ajoutées ensuite : ours, sanglier, loup, cygne, poisson, arbre (l'attribut se dit en entier, ou pas du tout)
    ({"A0": {"t1": "Azur", "m": "ours", "nb": "1", "tm": "Argent", "ta": "Gueules"}}, "D'azur à l'ours passant d'argent lampassé et vilené de gueules"),
    ({"A0": {"t1": "Gueules", "m": "sanglier", "nb": "3", "tm": "Or", "ta": "Sable"}}, "De gueules à trois sangliers passants d'or onglés et lampassés de sable"),
    ({"A0": {"t1": "Argent", "m": "loup", "nb": "1", "tm": "Sable"}}, "D'argent au loup passant de sable"),
    ({"A0": {"t1": "Azur", "m": "cygne", "nb": "1", "tm": "Argent", "ta": "Sable"}}, "D'azur au cygne d'argent becqué et membré de sable"),
    ({"A0": {"t1": "Azur", "m": "cygne", "nb": "1", "tm": "Argent", "ta": "Argent"}}, "D'azur au cygne d'argent"),
    ({"A0": {"t1": "Azur", "m": "poisson", "nb": "3", "tm": "Argent"}}, "D'azur à trois poissons d'argent"),
    ({"A0": {"t1": "Or", "m": "arbre", "nb": "1", "tm": "Sinople", "ta": "Sable"}}, "D'or à l'arbre de sinople fûté de sable"),
    # pièces propres à l'Atelier
    ({"A0": {"t1": "Argent", "m": "", "p": "canton", "tp": "Gueules"}}, "D'argent au canton de gueules"),
    ({"A0": {"t1": "Or", "m": "epee", "nb": "1", "tm": "Argent", "p": "franc-quartier", "tp": "Azur", "pos": "sur"}}, "D'or au franc-quartier d'azur chargé d'une épée d'argent garnie de gueules"),
    ({"A0": {"t1": "Argent", "m": "etoile", "nb": "3", "tm": "Azur", "p": "pairle", "tp": "Gueules"}}, "D'argent au pairle de gueules accompagné de trois étoiles d'azur"),
    # champs rayés : burelé, vergeté, coticé, chevronné, échiqueté, fuselé (les noms que prennent les rayures à partir de dix pièces)
    ({"A0": {"f": "ray", "ray": "barry", "n": "10", "t1": "Argent", "t2": "Gueules", "m": ""}}, "Burelé d'argent et de gueules"),
    ({"A0": {"f": "ray", "ray": "paly", "n": "12", "t1": "Or", "t2": "Azur", "m": ""}}, "Vergeté d'or et d'azur de douze pièces"),
    ({"A0": {"f": "ray", "ray": "bendysin", "n": "10", "t1": "Or", "t2": "Gueules", "m": ""}}, "Coticé en barre d'or et de gueules"),
    ({"A0": {"f": "ray", "ray": "chevronny", "n": "6", "t1": "Or", "t2": "Sable", "m": ""}}, "Chevronné d'or et de sable"),
    ({"A0": {"f": "ray", "ray": "chevronny", "n": "7", "t1": "Or", "t2": "Gueules", "m": ""}}, "D'or à trois chevrons de gueules"),
    ({"A0": {"f": "ray", "ray": "chequy", "n": "6", "t1": "Argent", "t2": "Gueules", "m": ""}}, "Échiqueté d'argent et de gueules"),
    ({"A0": {"f": "ray", "ray": "chequy", "n": "4", "t1": "Or", "t2": "Azur", "m": ""}}, "Échiqueté d'or et d'azur de quatre tires"),
    ({"A0": {"f": "ray", "ray": "lozengybend", "n": "6", "t1": "Azur", "t2": "Argent", "m": ""}}, "Fuselé en bande d'azur et d'argent"),
    # pièces alésées, filet, pièce brochant sur des meubles, cotice, nombres de meubles au-delà de huit, étoiles à six rais
    ({"A0": {"t1": "Argent", "m": "", "p": "fasce", "tp": "Gueules", "ln": "alesee"}}, "D'argent à la fasce alésée de gueules"),
    ({"A0": {"t1": "Azur", "m": "", "p": "croix", "tp": "Gueules", "pf": "Argent"}}, "D'azur à la croix de gueules bordée d'argent"),
    ({"A0": {"t1": "Azur", "m": "lion", "nb": "1", "tm": "Or", "ta": "Or", "p": "bande", "tp": "Gueules", "pos": "sous"}}, "D'azur au lion d'or, à la bande de gueules brochant sur le tout"),
    ({"A0": {"t1": "Or", "m": "", "p": "cotice", "tp": "Azur"}}, "D'or à la cotice d'azur"),
    ({"A0": {"t1": "Azur", "m": "etoile", "nb": "9", "tm": "Or"}}, "D'azur à neuf étoiles d'or posées 3, 3 et 3"),
    ({"A0": {"t1": "Azur", "m": "roundel", "nb": "12", "tm": "Argent"}}, "D'azur à douze besants d'argent posés 4, 4 et 4"),
    ({"A0": {"t1": "Azur", "m": "etoile6", "nb": "3", "tm": "Or"}}, "D'azur à trois étoiles à six rais d'or"),
    # les attitudes ajoutées ensuite (figures de Commons) : ours rampant, loup ravissant, cerf courant ou couché, cheval passant, licorne assise, léopard lionné, taureau,
    # colombe essorante, aigle au vol abaissé, wyvern, bélier passant
    ({"A0": {"t1": "Argent", "m": "ours-rampant", "nb": "1", "tm": "Sable", "ta": "Gueules"}}, "D'argent à l'ours rampant de sable lampassé et vilené de gueules"),
    ({"A0": {"t1": "Gueules", "m": "loup-ravissant", "nb": "1", "tm": "Argent"}}, "De gueules au loup ravissant d'argent"),
    ({"A0": {"t1": "Azur", "m": "cerf-courant", "nb": "1", "tm": "Or"}}, "D'azur au cerf courant d'or"),
    ({"A0": {"t1": "Sinople", "m": "cerf-couche", "nb": "1", "tm": "Or"}}, "De sinople au cerf couché d'or"),
    ({"A0": {"t1": "Azur", "m": "cheval-passant", "nb": "1", "tm": "Argent"}}, "D'azur au cheval passant d'argent"),
    ({"A0": {"t1": "Gueules", "m": "licorne-assise", "nb": "1", "tm": "Argent"}}, "De gueules à la licorne assise d'argent"),
    ({"A0": {"t1": "Azur", "m": "leopard-lionne", "nb": "1", "tm": "Or", "ta": "Gueules"}}, "D'azur au léopard lionné d'or armé et lampassé de gueules"),
    ({"A0": {"t1": "Argent", "m": "taureau", "nb": "1", "tm": "Gueules"}}, "D'argent au taureau de gueules"),
    ({"A0": {"t1": "Azur", "m": "colombe-essorante", "nb": "1", "tm": "Argent", "ta": "Gueules"}}, "D'azur à la colombe essorante d'argent becquée et membrée de gueules"),
    ({"A0": {"t1": "Or", "m": "aigle-vol-abaisse", "nb": "1", "tm": "Sable", "ta": "Gueules"}}, "D'or à l'aigle au vol abaissé de sable becquée, membrée et couronnée de gueules"),
    ({"A0": {"t1": "Argent", "m": "wyverne", "nb": "1", "tm": "Sinople", "ta": "Gueules"}}, "D'argent au wyvern de sinople lampassé de gueules"),
    ({"A0": {"t1": "Gueules", "m": "belier", "nb": "1", "tm": "Argent", "ta": "Or"}}, "De gueules au bélier passant d'argent accorné et onglé d'or"),
    # issant : la moitié haute d'un seul meuble, sortant de la pointe
    ({"A0": {"t1": "Azur", "m": "lion", "nb": "1", "tm": "Or", "ta": "Or", "iss": "1"}}, "D'azur au lion issant d'or"),
    ({"A0": {"t1": "Azur", "m": "lion", "nb": "1", "tm": "Or", "ta": "Gueules", "iss": "1", "ct": "1"}}, "D'azur au lion issant contourné d'or armé et lampassé de gueules"),
    ({"A0": {"t1": "Argent", "m": "aigle", "nb": "1", "tm": "Azur", "ta": "Azur", "iss": "1"}}, "D'argent à l'aigle issante d'azur becquée, membrée et couronnée d'azur"),
    # la couronne d'une bête : de son émail (devant), d'un autre (après l'attribut)
    ({"A0": {"t1": "Gueules", "m": "lion", "nb": "1", "tm": "Or", "ta": "Azur", "cn": "Or"}}, "De gueules au lion couronné d'or armé et lampassé d'azur"),
    ({"A0": {"t1": "Gueules", "m": "lion", "nb": "3", "tm": "Or", "ta": "Azur", "cn": "Argent", "ct": "1"}}, "De gueules à trois lions contournés d'or armés et lampassés d'azur couronnés d'argent"),
    ({"A0": {"t1": "Azur", "m": "leopard", "nb": "1", "tm": "Or", "ta": "Or", "cn": "Or"}}, "D'azur au léopard couronné d'or"),
    # l'écusson en abîme
    ({"ab": "1", "A0": {"t1": "Azur", "m": "fleurdelis", "nb": "3", "tm": "Or"}, "A4": {"t1": "Argent", "m": "", "p": "croix", "tp": "Gueules"}},
     "D'azur à trois fleurs de lis d'or, sur le tout d'argent à la croix de gueules"),
    ({"q": "2", "ab": "1", "A0": {"t1": "Gueules", "m": "lion", "nb": "1", "tm": "Or", "ta": "Azur"}, "A1": {"t1": "Azur", "m": "fleurdelis", "nb": "3", "tm": "Or", "p": ""}, "A4": {"t1": "Argent", "m": "", "p": "croix", "tp": "Gueules"}},
     "Écartelé : aux 1 et 4, de gueules au lion d'or armé et lampassé d'azur ; aux 2 et 3, d'azur à trois fleurs de lis d'or ; sur le tout d'argent à la croix de gueules"),
]

def test_atelier(browser, base, n_fuzz):
    page, erreurs = ouvre(browser, base, "atelier.html", "#blz:not(:empty)")
    verifie(page.inner_text("#blz").strip("« »  ") == "D'azur à trois fleurs de lis d'or", "atelier : l'écu par défaut se blasonne")
    for etat, attendu in CONNUES:
        obtenu = blasonne(page, etat)
        verifie(obtenu == attendu, f"atelier : « {attendu} »" + ("" if obtenu == attendu else f" — obtenu « {obtenu} »"))
    for ex in page.evaluate("EXEMPLES.map(e => e[0])"):
        page.locator("#examples button").get_by_text(ex, exact=True).click(); page.wait_for_timeout(250)
    # l'interface : les commandes sont bien reliées à l'état (champs, pièce, bord, sens, écusson)
    page.evaluate("S = fresh(); render()"); page.wait_for_timeout(300)
    blz = lambda: page.inner_text("#blz")
    page.select_option("select[name=m]", "lion"); page.wait_for_timeout(200)
    page.click("#r-ct label:has-text('Contourné')"); page.wait_for_timeout(300)
    verifie("contourné" in blz(), "atelier : la commande « Contourné » agit sur le blasonnement")
    page.select_option("select[name=p]", "fasce"); page.wait_for_timeout(200)
    page.select_option("select[name=ln]", "onde"); page.wait_for_timeout(300)
    verifie("fasce ondée" in blz(), "atelier : la commande « Bord » agit sur la pièce")
    page.click("text=Écusson en abîme"); page.wait_for_timeout(400)
    verifie("sur le tout" in blz(), "atelier : « Écusson en abîme » ajoute l'écusson")
    page.click("#cur-seg label:has-text('Écusson')"); page.wait_for_timeout(300)
    page.select_option("select[name=p]", "pairle"); page.wait_for_timeout(300)
    verifie("pairle" in blz().split("sur le tout")[1], "atelier : on modifie bien les armes de l'écusson, pas celles de l'écu")
    verifie("pairle" not in blz().split("sur le tout")[0], "atelier : les armes de l'écu n'ont pas bougé")
    url = page.url
    verifie("ab=1" in url and "e_p=pairle" in url and "ln=onde" in url and "ct=1" in url, "atelier : l'adresse garde tout (lien de partage)")
    page.goto(url); page.wait_for_selector("#blz:not(:empty)"); page.wait_for_timeout(500)
    verifie("pairle" in blz().split("sur le tout")[1] and "fasce ondée" in blz(), "atelier : le lien de partage redonne la même composition")
    ok = page.evaluate("""async () => {
        const St = fresh(); St.q = "2"; St.A[0] = { ...ADEF, m: "poisson", nb: "1", tm: "Argent" }; St.A[1] = { ...ADEF, m: "poisson", nb: "1", tm: "Gueules" };
        S = normalizeAll(St); await loadAll(S); const svg = compose(S).svg; S = fresh();
        return !/\\.st0\\s*\\{/.test(svg) && (svg.match(/<style/g) || []).length >= 2;   // le poisson a une feuille de style interne : ses classes sont préfixées, copie par copie
    }""")
    verifie(ok, "atelier : deux copies d'un meuble à feuille de style interne gardent chacune leurs couleurs")
    ok = page.evaluate("""async () => {
        const St = fresh(); Object.assign(St, { hm: "hl", ci: "lion", cim: "issant", cit: "Or", cia: "Gueules" });
        S = normalizeAll(St); await loadAll(S); const c = compose(S), t = ornText(S);
        const sans = fresh(); Object.assign(sans, { ci: "lion" }); normalizeAll(sans); await loadAll(sans); const c0 = compose(sans);
        S = fresh();
        return /Cimier : un lion issant d'or armé et lampassé de gueules/.test(t) && c.svg.includes("ci-a") && !c0.svg.includes("ci-a");   // le cimier ne se pose que sur un heaume
    }""")
    verifie(ok, "atelier : le cimier se pose sur le heaume (et seulement sur lui), entier ou issant, et se dit")
    ok = page.evaluate("""async () => {
        const St = fresh(); Object.assign(St, { mt: "p", mc: "Gueules", ml: "Hermine" });
        S = normalizeAll(St); await loadAll(S); const c = compose(S), t = ornText(S), sans = compose(normalizeAll(fresh()));
        S = fresh();
        return t === "Manteau surmonté d'un pavillon de gueules doublé d'hermine" && c.vb[3] > sans.vb[3] * 1.8 && c.vb[2] > sans.vb[2] * 1.5;   // la tente et le manteau agrandissent la page
    }""")
    verifie(ok, "atelier : le manteau et le pavillon se dessinent autour de l'écu et se disent")
    pb = page.evaluate(FUZZ, n_fuzz)
    verifie(not pb, f"atelier : {n_fuzz} compositions au hasard sans défaut" + ("" if not pb else f" — {pb[:3]}"))
    propre("atelier", page, erreurs)
    page.context.close()

def test_atelier_adresse_truquee(browser, base):
    """un lien bricolé (valeurs absurdes, noms de propriétés d'objets…) ne doit rien casser : l'Atelier le ramène à des valeurs permises"""
    page, erreurs = ouvre(browser, base, "atelier.html#sh=constructor&dt=toString&ln=__proto__&ct=1&ab=oui&e_p=zzz&p=nimporte&m=zzz&nb=constructor&nb2=toString&q=9&hm=hl&ht=hasOwnProperty&hp=valueOf&cr=valueOf&t1=constructor&tm=__proto__&f=zzz&ray=zzz&n=3&pos=zzz&d=zzz&sz=abc&ad=1.0:x,y,z", "#blz:not(:empty)")
    verifie(page.evaluate("typeof SHIELD_D === 'string' && SHIELD_D.startsWith('M')"), "atelier : un lien truqué laisse un contour d'écu valide")
    verifie(page.inner_text("#blz").strip() != "", "atelier : un lien truqué donne tout de même un blasonnement")
    propre("atelier (lien truqué)", page, erreurs)
    page.context.close()

# ------------------------------------------------------------------ lecture d'un blasonnement
# (texte, réécriture par l'Atelier, fragment attendu parmi les réserves ou "")
LUS = [
    ("D'azur à trois fleurs de lis d'or", "D'azur à trois fleurs de lis d'or", ""),
    ("d'azur a trois fleurs de lys d'or", "D'azur à trois fleurs de lis d'or", ""),           # majuscules, accents et « lys » libres
    ("D'hermine plain", "D'hermine plein", ""),
    ("De gueules à la croix d'argent", "De gueules à la croix d'argent", ""),
    ("D'azur semé de fleurs de lis d'or", "D'azur semé de fleurs de lis d'or", ""),
    ("D'argent au chef d'azur chargé de trois étoiles d'or", "D'argent au chef d'azur chargé de trois étoiles d'or", ""),
    ("D'argent à la fasce ondée de sable", "D'argent à la fasce ondée de sable", ""),
    ("D'azur au lion contourné d'or armé et lampassé de gueules", "D'azur au lion contourné d'or armé et lampassé de gueules", ""),
    ("D'azur au lion d'or contourné", "D'azur au lion contourné d'or", ""),                    # « contourné » après l'émail
    ("D'azur à l'aigle d'argent, becquée, membrée et couronnée d'or", "D'azur à l'aigle d'argent becquée, membrée et couronnée d'or", ""),
    ("D'or à six fleurs de lis d'azur, posées 3, 2 et 1", "D'or à six fleurs de lis d'azur posées 3, 2 et 1", ""),
    ("De gueules au lion d'or", "De gueules au lion d'or", ""),                                 # attribut sans émail : l'émail du corps
    ("D'azur au cygne d'argent becqué et membré de sable", "D'azur au cygne d'argent becqué et membré de sable", ""),
    ("D'or à l'arbre de sinople fûté de sable", "D'or à l'arbre de sinople fûté de sable", ""),
    ("De sinople au sanglier passant d'or", "De sinople au sanglier passant d'or", ""),
    ("D'argent à l'aigle de sable", "D'argent à l'aigle de sable", ""),                        # l'aigle sans couronne ; « couronnée » la donne couronnée
    ("D'or à l'aigle de sable, armée, becquée et lampassée de gueules", "D'or à l'aigle de sable becquée et membrée de gueules", "colore d'un seul émail"),
    ("D'azur à quatre étoiles d'or", "D'azur à quatre étoiles d'or posées 2 et 2", "2 et 2"),   # disposition non dite : signalée (trois léopards, eux, vont en pal sans qu'on le dise)
    ("D'azur à deux étoiles d'or", "D'azur à deux étoiles d'or posées en fasce", "disposition non précisée"),
    ("D'azur à trois étoiles d'or en fasce", "D'azur à trois étoiles d'or rangées en fasce", ""),
    ("D'azur au chevron d'or accompagné de trois croissants du même", "D'azur au chevron d'or accompagné de trois croissants d'or", ""),
    # sur un champ divisé, « brochant sur le tout » dit qu'une pièce chargée passe sur le meuble seul du champ (pbro) ; sinon on ne le dit pas : les deux armes ne s'écrivent pas pareil
    ("Coupé d'or et d'azur, à l'étoile de gueules, à la fasce d'argent brochant sur le tout, chargée de trois roses de sable", "Coupé d'or et d'azur, à l'étoile de gueules, à la fasce d'argent brochant sur le tout, chargée de trois roses de sable", ""),
    ("Coupé d'or et d'azur, à l'étoile de gueules, à la fasce d'argent chargée de trois roses de sable", "Coupé d'or et d'azur, à l'étoile de gueules, à la fasce d'argent chargée de trois roses de sable", ""),
    # le « et » qui suit l'aigle échiquetée amène le groupe suivant quand aucun émail ne vient
    ("D'argent au chevron d'azur accompagné de trois aigles échiquetées de gueules et d'une étoile d'or", "D'argent au chevron d'azur accompagné de trois aigles échiquetées de gueules et d'une étoile d'or", ""),
    ("De gueules à la croix vidée, cléchée et pommetée d'or", "De gueules à la croix cléchée, vidée et pommetée d'or", ""),
    ("D'azur à la fasce d'or chargée de trois coquilles de sable, accompagnée de trois cœurs de gueules", "D'azur à trois cœurs de gueules, à la fasce d'or chargée de trois coquilles de sable", ""),
    ("D'or à cinq tourteaux de gueules et, en chef, un tourteau d'azur", "D'or à cinq tourteaux de gueules posés en sautoir, accompagnés d'un tourteau d'azur en chef", "en sautoir"),
    ("Parti d'azur et de gueules, à la croix d'or", "Parti d'azur et de gueules, à la croix d'or brochant sur le tout", ""),
    ("Tiercé en pal de gueules, d'argent et d'azur", "Tiercé en pal de gueules, d'argent et d'azur", ""),
    ("Fascé d'argent et d'azur de huit pièces", "Fascé d'argent et d'azur de huit pièces", ""),
    ("D'or à trois pals de gueules", "D'or à trois pals de gueules", ""),                    # pièces rebattues : un champ rayé de sept zones
    ("D'or à quatre pals de gueules", "D'or à quatre pals de gueules", ""),
    ("De gueules à trois fasces d'argent", "De gueules à trois fasces d'argent", ""),
    ("D'azur à deux bandes d'or", "D'azur à deux bandes d'or", ""),
    ("D'azur à la bande d'argent ornée d'un rinceau de sable, accompagnée de six fleurs de lis d'or, trois en chef et trois en pointe", "D'azur à la bande d'argent ornée d'un rinceau de sable, accompagnée de six fleurs de lis d'or, trois en chef et trois en pointe", ""),
    ("De gueules à trois croissants contournés d'argent, chacun accompagné d'une étoile à cinq rais du même", "De gueules à trois croissants contournés d'argent, chacun accompagné d'une étoile d'argent", ""),
    ("Coupé : au 1, parti : au 1, d'or plein ; au 2, de gueules plein ; au 2, d'azur plein", "Coupé : au 1, parti : au 1, d'or plein ; au 2, de gueules plein ; au 2, d'azur plein", ""),
    ("Parti d'azur et d'or, à la croix de l'un en l'autre", "Parti d'azur et d'or, à la croix de l'un en l'autre brochant sur le tout", ""),
    ("D'argent au bouquetin saillant de sable, lampassé et vilené de gueules", "D'argent au bouquetin saillant de sable lampassé de gueules", "vilené"),
    ("D'argent à deux barres de sable, à la croix d'or brochant sur le tout", "D'argent à deux barres de sable, à la croix d'or brochant sur le tout", ""),
    ("Écartelé : aux 1 et 4, d'azur semé de fleurs de lis d'or (France ancien) ; aux 2 et 3, de gueules à trois léopards d'or (Angleterre)",
     "Écartelé : aux 1 et 4, d'azur semé de fleurs de lis d'or ; aux 2 et 3, de gueules à trois léopards d'or", "Commentaire ignoré"),
    ("Écartelé : au 1, d'azur ; au 2, de gueules ; au 3, d'or ; au 4, de sable", "Écartelé : au 1, d'azur plein ; au 2, de gueules plein ; au 3, d'or plein ; au 4, de sable plein", ""),
    ("Écartelé : aux 1 et 3, d'azur ; aux 2 et 4, de gueules", "Écartelé : au 1, d'azur plein ; au 2, de gueules plein ; au 3, d'azur plein ; au 4, de gueules plein", ""),
    ("D'azur au lion d'or, sur le tout d'argent à la croix de gueules", "D'azur au lion d'or, sur le tout d'argent à la croix de gueules", ""),
    ("Parti d'azur et de gueules à la bande d'or brochant sur le tout, sur le tout de sinople à l'étoile d'argent",
     "Parti d'azur et de gueules, à la bande d'or brochant sur le tout, sur le tout de sinople à l'étoile d'argent", ""),
    # ce que la galerie a appris à relire : « aux » devant un nombre, la disposition avant l'attribut, une liste d'attributs, « du champ », les quartiers séparés par une virgule
    ("D'or aux trois léopards d'azur posés en pal, armés et lampassés de gueules", "D'or à trois léopards d'azur armés et lampassés de gueules", ""),
    ("D'argent, à l'ours passant de sable, armé, lampassé et vilené de gueules", "D'argent à l'ours passant de sable lampassé et vilené de gueules", "colore d'un seul émail"),
    ("D'argent à trois lions passant de sable", "D'argent à trois lions passants de sable", ""),
    ("Écartelé : aux 1 et 4 d'argent, aux 2 et 3 de sable", "Écartelé : aux 1 et 4, d'argent plein ; aux 2 et 3, de sable plein", ""),
    ("Écartelé : en 1 et 4, d'or ; en 2 et 3, de gueules", "Écartelé : aux 1 et 4, d'or plein ; aux 2 et 3, de gueules plein", ""),
    ("D'azur à l'étoile à six rais d'or", "D'azur à l'étoile à six rais d'or", ""),
    ("Fuselé d'argent et de gueules", "Fuselé d'argent et de gueules", ""),
    ("Burelé d'argent et de gueules", "Burelé d'argent et de gueules", ""),
    ("Burelé d'or et de sable de huit pièces", "Fascé d'or et de sable de huit pièces", ""),
    ("Chevronné d'or et de gueules, de douze pièces", "Chevronné d'or et de gueules de douze pièces", ""),
    ("Échiqueté d'argent et de gueules de quatre tires", "Échiqueté d'argent et de gueules de quatre tires", ""),
    ("D'or à trois chevrons de gueules", "D'or à trois chevrons de gueules", ""),
    ("D'azur à la croix de gueules bordée d'argent", "D'azur à la croix de gueules bordée d'argent", ""),
    ("D'argent à la fasce alésée de gueules", "D'argent à la fasce alésée de gueules", ""),
    ("D'azur à la croix alésée d'argent", "D'azur à la croix alésée d'argent", ""),            # un meuble de l'Atelier, non une pièce alésée
    ("D'azur au lion d'or, à la bande de gueules brochant sur le tout", "D'azur au lion d'or, à la bande de gueules brochant sur le tout", ""),
    ("De gueules au lion rampant d'or couronné d'or aussi", "De gueules au lion couronné d'or", ""),
    ("D'or au lion de sable armé, lampassé et couronné de gueules", "D'or au lion de sable armé et lampassé de gueules couronné de gueules", "colore d'un seul émail"),
    ("D'argent à trois lions de sinople, armés et lampassés de gueules, couronnés d'or", "D'argent à trois lions de sinople armés et lampassés de gueules couronnés d'or", ""),
    ("D'azur au lion d'or issant", "D'azur au lion issant d'or", ""),
    ("D'azur au lion issant contourné d'or", "D'azur au lion issant contourné d'or", ""),
    ("D'azur à neuf cœurs d'or posés en trois pals", "D'azur à neuf cœurs d'or posés 3, 3 et 3", ""),
    ("D'azur à douze besants d'argent posés 4, 4 et 4", "D'azur à douze besants d'argent posés 4, 4 et 4", ""),
    ("Coupé : au 1, d'or au lion issant de gueules ; au 2, ondé d'argent et d'azur", "Coupé : au 1, d'or au lion issant de gueules ; au 2, fascé ondé d'argent et d'azur", ""),      # la Zélande
    ("Coupé, en 1, d'or à trois étoiles de gueules ; en 2, d'azur à la fasce d'argent", "Coupé : au 1, d'or à trois étoiles de gueules ; au 2, d'azur à la fasce d'argent", ""),
    ("Fascé ondé d'or et de gueules de huit pièces", "Fascé ondé d'or et de gueules de huit pièces", ""),
    ("D'azur à la fasce de gueules, accompagnée en chef d'un choucas de sable et en pointe de trois couronnes d'or",
     "D'azur à la fasce de gueules accompagnée en chef d'un choucas de sable et en pointe de trois couronnes d'or", ""),      # la Galicie-Lodomérie
    ("D'argent au lion de gueules, la queue fourchée passée en sautoir, armé, lampassé et couronné d'or",
     "D'argent au lion de gueules, à la queue fourchée et passée en sautoir, armé et lampassé d'or couronné d'or", "colore d'un seul émail"),      # le Limbourg
    ("De gueules au lion d'argent, couronné, armé et lampassé d'or", "De gueules au lion d'argent armé et lampassé d'or couronné d'or", "colore d'un seul émail"),
    ("Tranché : au 1, d'or ; au 2, d'azur à sept étoiles d'argent posées en bande", "Tranché : au 1, d'or plein ; au 2, d'azur à sept étoiles d'argent posées en bande", ""),      # Bosnie-Herzégovine
    ("Taillé : au 1, d'azur au lion d'or ; au 2, de gueules à la croix d'argent", "Taillé : au 1, d'azur au lion d'or ; au 2, de gueules à la croix d'argent", ""),
    ("De gueules au lion couronné d'or, tenant une hache d'argent emmanchée du même", "De gueules au lion couronné d'or, tenant une hache d'argent emmanchée du même", ""),      # la Norvège
    ("D'or au rencontre de bœuf de sable", "D'or au rencontre de bœuf de sable", ""),      # Uri
    ("D'azur à treize besants d'or", "D'azur à treize besants d'or posés en trois pals 4, 5 et 4", "4, 5 et 4"),          # le Valais
    ("D'azur semé de fleurs de lis d'or, au lambel de gueules, chaque pendant chargé de trois châteaux donjonnés d'or",
     "D'azur semé de fleurs de lis d'or, brisé d'un lambel de gueules chargé sur chaque pendant de trois châteaux donjonnés d'or", ""),      # l'Artois
]
# (texte, fragment de l'explication) : refusés, avec la raison — jamais devinés
REFUSES = [
    ("D'azur au calice d'or", "calice"),
    ("D'or à sept pals de gueules", "Plusieurs pals"),
    ("De gueules à sept fasces d'argent", "Plusieurs fasces"),
    ("D'azur à la rose d'argent couronnée d'or", "couronnée"),                 # seules les bêtes portent une couronne
    ("D'azur à la croix d'or chargée d'un lion issant de gueules", "issant"),
    ("D'azur à deux lions issants d'or", "issants"),
    ("D'azur à onze étoiles d'or", "onze étoiles"),
    ("D'azur à la fasce d'or ondée", "avant son émail"),
    ("D'azur à l'ours d'or", "« ours » seul"),                               # le nom de l'Atelier est « ours passant » : on le propose
    ("D'azur au cheval d'argent", "cheval cabré"),
    ("D'azur à trois croix d'or", "croix alésée"),
    ("D'azur à la panthère d'or armée et lampassée de gueules", "en entier"),   # les aigles et la vache acceptent un attribut partiel, pas la panthère
    ("D'azur à la bande d'or brochant sur le tout", "champ divisé"),
    ("D'azur au canton d'or accompagné de deux étoiles d'argent", "autour du canton"),
    ("D'azur à l'étoile contournée d'or", "ne se contourne pas"),
    ("D'azur à trois étoiles d'or contournées", "ne se contourne pas"),
    ("D'azur au lion d'or armé de gueules", "armé et lampassé"),
    ("Écartelé : aux 1 et 4, d'azur ; aux 2 et 3, de gueules ; au 5, d'or", "quartier 5"),
    ("Écartelé : au 1, d'azur ; au 2, de gueules", "Il manque"),
    ("D'azur à la croix", "s'arrête trop tôt"),
    ("D'azur à trois", "s'arrête trop tôt"),
    ("Fascé d'argent et d'azur de sept pièces", "six, huit"),
    ("D'azur à l'étoile à neuf rais d'or", "à neuf rais"),
    ("D'azur plein à la croix d'or", "plein"),
    ("D'azur à la croix d'or (", "Parenthèse"),
    ("sur le tout d'argent à la croix de gueules", "après les armes"),
    ("Écartelé de France ancien et d'Angleterre", "France"),
    ("Coupé : au 1, écartelé : aux 1 et 4, d'or ; aux 2 et 3, d'azur ; au 2, de gueules", "ne s'écartèlent pas"),
    ("D'or au chevron d'azur accompagné en chef de deux étoiles de gueules et en pointe d'un croissant de sable", "que d'une fasce"),
    ("D'or à la fasce d'azur accompagnée en chef de deux étoiles de gueules et en pointe de quatre croissants de sable", "de chaque côté de la fasce"),
    ("Tranché : au 1, écartelé : aux 1 et 4, d'or ; aux 2 et 3, d'azur ; au 2, de gueules", "d'un tranché ne s'écartèlent pas"),
    ("Fascé ondé d'or et de gueules de dix pièces", "fascé ondé à quatre, six ou huit"),
]
# armes de la galerie que l'Atelier doit savoir relire (la liste peut s'allonger, jamais se raccourcir) et d'autres qu'il doit refuser
BLASONS_LISIBLES = ["Royaume de France (moderne)", "Royaume d'Angleterre", "Archiduché d'Autriche", "Couronne d'Aragon", "Comté de Foix",
                    "Duché de Bretagne", "Duché de Savoie", "République de Gênes", "Ordre Teutonique", "Ordre de Saint-Jean (Hospitaliers)",
                    "Maison d'Este", "Maison Farnèse", "Marquisat de Saluces", "Comté de Toulouse", "Maison Grimaldi", "Monaco", "Maison de Hohenberg", "Royaume d'Islande",
                    "Royaume de Gwynedd", "Canton d'Obwald", "Canton de Bâle-Ville", "Canton de Bâle-Campagne", "Canton du Jura", "Canton de Saint-Gall", "Maison d'Arenberg", "Maison de Lorraine",
                    "Royaume de Grenade (couronne de Castille)", "Saint-Empire romain germanique",
                    "Comté d'Artois", "Comté de Namur", "Canton du Valais", "Comté de Zélande", "Monténégro", "Royaume de Galicie et de Lodomérie",
                    "Canton d'Appenzell Rhodes-Intérieures", "Duché de Limbourg", "Bosnie-Herzégovine", "Canton d'Uri", "Norvège", "Canton des Grisons", "Sultanat d'Égypte", "Royaume de Cordoue", "Royaume de Bosnie", "Canton de Schwytz", "Maison de Médicis", "Canton de Berne", "Canton de Thurgovie", "Canton d'Argovie", "Canton de Nidwald", "Finlande", "Province de Brandebourg", "Chypre", "Slovaquie", "Albanie", "Royaume d'Albanie (1939-1943)", "Islande", "Serbie", "Andorre", "Tchéquie", "Lituanie", "Géorgie", "Russie"]
# (le Saint-Empire est relu depuis que les aigles acceptent « becquée et membrée » seules, dit en réserve)
BLASONS_REFUSES = ["Slovénie", "Moldavie"]
PERSONNAGES_LISIBLES = ["Édouard III d'Angleterre", "Edmond FitzAlan (2e comte d'Arundel)",
                        "John FitzAlan", "Richard FitzAlan", "Pie II", "Jacques Cœur", "Paul IV", "Nanker", "Jean-Baptiste Colbert", "Bertrand du Guesclin", "Ferdinand de Bulgarie", "Haakon VII", "Léopold II de Belgique", "Henri de Monpezat", "Jan Lubrański"]
PERSONNAGES_REFUSES = ["Jeanne d'Arc", "Michel de Montaigne"]

# armes au hasard (comme le FUZZ de l'Atelier, avec plus de variété dans les émaux et les dispositions)
ARMES_HASARD = """(pick) => ({ ...randomArms(), f: pick(["plein", "plein", "part", "ray"]), part: pick(DATA.partitions.map(p => p.kind)),
    ray: pick(RAYS), n: pick(["3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"]), t3: pick(Object.keys(MOT)), m2: Math.random() < .4 ? pick(ATL.meubles).kind : "", nb2: pick(["1", "2", "3", "4"]),
    nb: pick(["1", "2", "3", "4", "5", "6", "8", "seme"]), p: Math.random() < .6 ? pick(Object.keys(PIECES)) : "", iss: pick(["", "", "1"]), pos: pick(["autour", "sur", "sous"]), pf: pick(["", "", "", ...Object.keys(MOT)]), cn: pick(["", "", ...Object.keys(MOT)]), cn2: pick(["", "", ...Object.keys(MOT)]),
    ln: pick(["", ...Object.keys(CONTOUR_NOM)]), ct: pick(["", "1"]), ct2: pick(["", "1"]), cc: pick(["", "", "", "en", "a"]), ta: pick([...Object.keys(MOT), ""]), ta2: pick(Object.keys(MOT)), cp: pick(["", "", "1"]),
    d: pick(["", "chef", "pal", "fasce", "croix", "pointe", "bande", "barre", "mal", "222", "33", "221", "orle", "cd", "cs"]),
    d2: pick(["", "chef", "pal", "fasce", "croix", "pointe", "bande", "barre", "mal", "222", "33", "221", "cd", "cs"]),
    tm: pick(Object.keys(MOT)), tm2: pick(Object.keys(MOT)), tp: pick(Object.keys(MOT)), t1: pick(Object.keys(MOT)), t2: pick(Object.keys(MOT)) })"""
ECU_HASARD = """(pick) => {
    const St = fresh(), arms = %s;
    St.q = pick(["", "", "2", "4", "c", "t", "l"]);
    for (let j = 0; j < 4; j++) St.A[j] = arms(pick);
    St.ab = pick(["", "", "1"]); if (St.ab) St.A[4] = { ...randomArms(), ln: pick(["", ...Object.keys(CONTOUR_NOM)]) };
    return normalizeAll(St);
}""" % ARMES_HASARD

# écu → blasonnement → écu : le lecteur doit rendre exactement ce que l'Atelier a écrit (mêmes armes, même texte, rien à signaler
# que la disposition des figures allongées, que le texte de l'Atelier ne dit pas pour trois figures)
LECTURE_ALLER_RETOUR = """(n) => {
  const pick = a => a[Math.floor(Math.random() * a.length)], ecu = %s, pb = [];
  const permis = x => /disposition non précisée pour .* \\(dites « posés en pal »/.test(x);
  for (let i = 0; i < n; i++) {
    const s0 = ecu(pick), b = blazonAll(s0), r = lire(b);
    if (!r.ok) { pb.push("refusé : " + b + " — " + r.erreurs.map(e => e.msg).join(" / ")); continue; }
    if (JSON.stringify(canonAll(s0)) !== JSON.stringify(canonAll(r.etat))) pb.push("autres armes : " + b);
    else if (!r.exact) pb.push("réécrit autrement : " + b + " → " + r.reecrit);
    else if (r.notes.some(x => !permis(x))) pb.push("réserves : " + b + " — " + r.notes.join(" / "));
  }
  S = fresh();
  return pb;
}""" % ECU_HASARD

# la même chose, mais sur le dessin : l'écu relu doit être dessiné trait pour trait comme l'original
LECTURE_DESSIN = """async (n) => {
  const pick = a => a[Math.floor(Math.random() * a.length)], ecu = %s, pb = [];
  for (let i = 0; i < n; i++) {
    const s0 = ecu(pick), b = blazonAll(s0), r = lire(b);
    if (!r.ok) { pb.push("refusé : " + b); continue; }
    const s1 = normalizeAll({ ...fresh(), q: r.etat.q, ab: r.etat.ab, A: r.etat.A.map(a => ({ ...a })) });
    await loadAll(s0); await loadAll(s1);
    uid = BID = 0; const d0 = drawShield(s0, "a"); uid = BID = 0; const d1 = drawShield(s1, "a");     // les compteurs d'identifiants (motifs, masques de bordure) repartent de zéro
    if (d0 !== d1) pb.push("dessin différent : " + b);
  }
  S = fresh();
  return pb;
}""" % ECU_HASARD

# jamais deviné : un mot inconnu glissé dans un blasonnement le fait refuser ; un salmigondis de mots du blason ne fait jamais d'exception,
# et ce qu'il donne par hasard est un écu cohérent (qui se relit à l'identique)
LECTURE_SALADE = """(n) => {
  const pick = a => a[Math.floor(Math.random() * a.length)], ecu = %s, pb = [];
  const mots = [];
  for (let i = 0; i < 40; i++) mots.push(...blazonAll(ecu(pick)).split(/\\s+/));
  for (let i = 0; i < n; i++) {
    const b = blazonAll(ecu(pick)).split(" "), k = Math.floor(Math.random() * (b.length + 1));
    const m = [...b.slice(0, k), "zzz", ...b.slice(k)].join(" ");
    try { if (lire(m).ok) pb.push("mot inconnu accepté : " + m); } catch (e) { pb.push("exception : " + m + " — " + e.message); }
    const salade = Array.from({ length: 3 + Math.floor(Math.random() * 14) }, () => pick(mots)).join(" ");
    try {
      const r = lire(salade);
      if (r.ok) {
        const r2 = lire(blazonAll(r.etat));
        if (!r2.ok || JSON.stringify(canonAll(r.etat)) !== JSON.stringify(canonAll(r2.etat))) pb.push("lecture incohérente : " + salade);
      }
    } catch (e) { pb.push("exception : " + salade + " — " + e.message); }
  }
  S = fresh();
  return pb;
}""" % ECU_HASARD

def test_lecture(browser, base, n_fuzz):
    page, erreurs = ouvre(browser, base, "atelier.html", "#blz:not(:empty)")
    for texte, reecrit, reserve in LUS:
        r = page.evaluate("t => { const r = lire(t); return { ok: r.ok, reecrit: r.reecrit, notes: r.notes, erreurs: r.erreurs.map(e => e.msg) }; }", texte)
        bon = r["ok"] and r["reecrit"] == reecrit and (not reserve or any(reserve in n for n in r["notes"]))
        verifie(bon, f"lecture : « {texte[:70]}{'…' if len(texte) > 70 else ''} »" + ("" if bon else f" — obtenu {r}"))
    for texte, raison in REFUSES:
        r = page.evaluate("t => { const r = lire(t); return { ok: r.ok, erreurs: r.erreurs.map(e => e.msg) }; }", texte)
        bon = not r["ok"] and any(raison in e for e in r["erreurs"])
        verifie(bon, f"lecture refusée : « {texte[:60]} » ({raison})" + ("" if bon else f" — obtenu {r}"))
    pbro = page.evaluate("t => [t, t.replace(' brochant sur le tout,', '')].map(x => lire(x).etat.A[0].pbro)", "Coupé d'or et d'azur, à l'étoile de gueules, à la fasce d'argent brochant sur le tout, chargée de trois roses de sable")
    verifie(pbro == ["1", ""], f"lecture : sur un champ divisé, seule la pièce dite « brochant sur le tout » passe sur le meuble ({pbro})")
    vide = page.evaluate("() => { const r = lire('   '); return r.vide && !r.ok && !r.erreurs.length; }")
    verifie(vide, "lecture : un texte vide n'est ni compris ni une erreur")
    n = max(300, n_fuzz * 10)
    pb = page.evaluate(LECTURE_ALLER_RETOUR, n)
    verifie(not pb, f"lecture : {n} écus au hasard se relisent à l'identique" + ("" if not pb else f" — {pb[:3]}"))
    pb = page.evaluate(LECTURE_DESSIN, max(40, n_fuzz))
    verifie(not pb, f"lecture : {max(40, n_fuzz)} écus relus sont dessinés trait pour trait comme l'original" + ("" if not pb else f" — {pb[:3]}"))
    pb = page.evaluate(LECTURE_SALADE, max(200, n_fuzz * 3))
    verifie(not pb, "lecture : un mot inconnu fait refuser le texte, un salmigondis ne fait pas d'exception et ne donne que des écus cohérents" + ("" if not pb else f" — {pb[:3]}"))
    # l'interface : on tape, l'écu se dessine ; on se trompe, c'est signalé et l'écu ne bouge pas
    blz = lambda: page.inner_text("#blz")
    page.fill("#lire", "D'azur à la fasce d'or"); page.wait_for_timeout(900)
    verifie(blz().strip("« »  ") == "D'azur à la fasce d'or" and page.locator("#lire-etat.ok").count() == 1, "lecture : taper un blasonnement dessine l'écu")
    page.fill("#lire", "D'azur à la fasce d'or et au calice de sable"); page.wait_for_timeout(900)
    verifie(page.locator("#lire-etat.ko mark").count() >= 1 and blz().strip("« »  ") == "D'azur à la fasce d'or", "lecture : un blasonnement non compris est surligné et laisse l'écu comme il était")
    verifie("calice" in page.inner_text("#lire-etat"), "lecture : le mot que l'Atelier ne connaît pas est nommé")
    page.click("#b-recopier"); page.wait_for_timeout(500)
    verifie(page.input_value("#lire") == "D'azur à la fasce d'or", "lecture : « Reprendre le blasonnement actuel » recopie le blasonnement dans la zone de saisie")
    page.fill("#lire", "D'azur à quatre étoiles d'or"); page.wait_for_timeout(900)
    verifie(page.locator("#lire-etat li:has-text('2 et 2')").count() == 1, "lecture : les réserves s'affichent")
    page.evaluate("S = fresh(); S.cr = 'duc'; S.A[0].t1 = 'Gueules'; render()"); page.wait_for_timeout(300)
    page.fill("#lire", "D'argent à la croix de sable"); page.wait_for_timeout(900)
    verifie(page.evaluate("S.cr") == "duc" and blz().strip("« »  ") == "D'argent à la croix de sable", "lecture : lire des armes laisse les ornements de la composition")
    propre("atelier (lecture)", page, erreurs)
    page.context.close()
    # l'adresse « #lire=… » (celle des boutons des galeries)
    page, erreurs = ouvre(browser, base, "atelier.html#lire=" + urllib.parse.quote("D'azur au chef d'or chargé de trois étoiles de sable"), "#blz:not(:empty)")
    verifie(page.inner_text("#blz").strip("« »  ") == "D'azur au chef d'or chargé de trois étoiles de sable" and page.input_value("#lire") == "D'azur au chef d'or chargé de trois étoiles de sable",
            "lecture : l'adresse « #lire=… » dessine l'écu et remplit la zone de saisie")
    verifie(page.url.startswith(base + "/atelier.html#") and "lire=" not in page.url, "lecture : l'adresse redevient le lien de partage habituel")
    propre("atelier (#lire)", page, erreurs)
    page.context.close()
    page, erreurs = ouvre(browser, base, "atelier.html#lire=" + urllib.parse.quote("D'azur au calice d'or"), "#lire-etat.ko")
    verifie(page.locator("#lire-etat.ko mark").count() == 1, "lecture : une adresse « #lire=… » non comprise est signalée")
    propre("atelier (#lire refusé)", page, erreurs)
    page.context.close()

def test_boutons(browser, base, page_url, fichier, lisibles, refuses, nom):
    """sous les blasonnements que l'Atelier relit en entier, un bouton ouvre l'Atelier, et l'écu de la carte aussi ; sous les autres, une ligne dit où il bute"""
    gal = page_url.split(".")[0]
    page, erreurs = ouvre(browser, base, page_url, ".ar .redo")
    cartes = {c["nom"]: c for c in page.evaluate("""[...document.querySelectorAll('.ar')].map(a => ({ nom: a.querySelector('h3').textContent, id: a.id,
        redo: a.querySelector('.redo a')?.getAttribute('href') || null, ecu: a.querySelector('a.shield')?.getAttribute('href') || null, ecuNu: a.querySelector('.shield') !== null,
        non: a.querySelector('.redo-non')?.textContent || null, nonHref: a.querySelector('.redo-non a')?.getAttribute('href') || null }))""")}
    verifie(all(cartes.get(n, {}).get("redo") for n in lisibles), f"{nom} : un bouton « Redessiner dans l'Atelier » sous chaque blasonnement lisible" + ("" if all(cartes.get(n, {}).get("redo") for n in lisibles) else f" — manque {[n for n in lisibles if not cartes.get(n, {}).get('redo')]}"))
    verifie(not any(cartes.get(n, {}).get("redo") for n in refuses), f"{nom} : aucun bouton sous ce que l'Atelier ne comprend pas" + ("" if not any(cartes.get(n, {}).get("redo") for n in refuses) else f" — {[n for n in refuses if cartes.get(n, {}).get('redo')]}"))
    sans = [a["nom"] for a in data(fichier) if not a.get("blason")]
    verifie(not any(cartes[n]["redo"] or cartes[n]["ecu"] or cartes[n]["non"] for n in sans), f"{nom} : rien sous une carte sans blasonnement, et son écu ne mène nulle part")
    verifie(all(c["ecu"] is None and c["ecuNu"] for c in cartes.values()), f"{nom} : l'écu d'une carte n'est pas un lien (il s'agrandit ; l'Atelier s'ouvre par le bouton)")
    avec = [a["nom"] for a in data(fichier) if a.get("blason") and not a.get("sansAtelier")]
    verifie(all(bool(cartes[n]["redo"]) != bool(cartes[n]["non"]) for n in avec), f"{nom} : sous chaque blasonnement, le bouton ou la ligne qui dit où l'Atelier bute, jamais les deux")
    retirees = [a["nom"] for a in data(fichier) if a.get("blason") and a.get("sansAtelier")]
    verifie(not any(cartes[n]["redo"] or cartes[n]["non"] for n in retirees), f"{nom} : rien sous une carte retirée de l'Atelier (sansAtelier)")
    verifie(all("bute sur « " in (cartes[n]["non"] or "") for n in refuses), f"{nom} : sous un blasonnement refusé, l'endroit où l'Atelier bute est cité")
    params = lambda h: page.evaluate("h => Object.fromEntries(new URLSearchParams(h.split('#')[1]))", h)
    avec_bouton = [c for c in cartes.values() if c["redo"]]
    verifie(all(page.evaluate("t => lire(t).ok", params(c["redo"])["lire"]) for c in avec_bouton), f"{nom} : chaque bouton porte un blasonnement que le lecteur comprend")
    verifie(all(params(c["redo"]).get("de") == f"{gal}:{c['id']}" == f"{gal}:{slug_carte(c['nom'])}" for c in avec_bouton), f"{nom} : chaque lien vers l'Atelier dit de quelle carte il part")
    verifie(all(not page.evaluate("t => lire(t).ok", params(c["nonHref"])["lire"]) and params(c["nonHref"]).get("de") == f"{gal}:{c['id']}" for c in cartes.values() if c["nonHref"]),
            f"{nom} : « Voir où dans l'Atelier » porte le texte refusé et la carte d'où il vient")
    propre(nom + " (boutons)", page, erreurs)
    # un clic sur l'écu l'agrandit, sans quitter la page ; Échap le referme ; le bouton « Redessiner » ouvre l'Atelier sur les armes, et y montre la carte d'où l'on part
    cible = lisibles[-1]
    carte = page.locator(".ar", has=page.locator("h3", has_text=cible))
    carte.locator(".shield").click()
    page.wait_for_selector("#agrandi[open]")
    verifie(page.locator("#agrandi img").count() == 1 and cible in page.inner_text("#agrandi .ag-t") and page.locator("#agrandi a").count() == 0 and page.url.endswith(page_url), f"{nom} : un clic sur l'écu l'agrandit (nom de la carte, pas de lien vers l'Atelier), sans quitter la page")
    page.keyboard.press("Escape")
    verifie(page.locator("#agrandi[open]").count() == 0, f"{nom} : Échap referme l'image agrandie")
    carte.locator(".redo a").click()
    page.wait_for_url("**/atelier.html*"); page.wait_for_selector("#origine:not([hidden]) .or-etat"); page.wait_for_timeout(600)
    attendu = next(a.get("atelier") or a["blason"] for a in data(fichier) if a["nom"] == cible)       # le champ « atelier » : ce que l'Atelier lit pour suivre l'image
    verifie(page.input_value("#lire") == attendu and page.locator("#lire-etat.ok").count() == 1, f"{nom} : le bouton ouvre l'Atelier, qui lit le blasonnement de « {cible} »")
    verifie(page.inner_text("#origine .or-nom") == cible and page.locator("#origine .or-etat.ok").count() == 1, f"{nom} : l'Atelier montre la carte d'où l'on part et dit que ce sont ses armes")
    verifie(f"de={gal}:{slug_carte(cible)}" in page.url and "lire=" not in page.url, f"{nom} : l'adresse de l'Atelier redevient un lien de partage qui garde la carte d'origine")
    page.context.close()

def test_partir(browser, base):
    """« Partir d'un blason réel » : le sélecteur propose les cartes relues, et elles seules ; la carte d'origine suit les modifications ; on y revient"""
    page, erreurs = ouvre(browser, base, "atelier.html", "#reel")
    page.wait_for_function("document.querySelectorAll('#reel optgroup').length > 0")
    relues = page.evaluate("""async () => { const t = []; for (const f of ['blasons', 'personnages']) for (const a of await (await fetch('data/' + f + '.json')).json()) if (a.blason && !a.sansAtelier && lire(a.atelier || a.blason).ok) t.push(a.nom); return t; }""")
    options = page.evaluate("[...document.querySelectorAll('#reel option')].filter(o => o.value).map(o => o.textContent)")
    verifie(sorted(options) == sorted(relues) and len(relues) >= len(BLASONS_LISIBLES) + len(PERSONNAGES_LISIBLES),
            f"partir : le sélecteur propose les {len(relues)} cartes des galeries que le lecteur relit, et elles seules")
    blz = lambda: page.inner_text("#blz").strip("« »  ")
    etat = lambda: page.get_attribute("#origine .or-etat", "class")
    bretagne = next(a["blason"] for a in data("blasons.json") if a["nom"] == "Duché de Bretagne")
    page.select_option("#reel", label="Duché de Bretagne"); page.wait_for_timeout(900)
    verifie(blz() == page.evaluate("t => lire(t).reecrit", bretagne) and page.input_value("#lire") == bretagne, "partir : choisir une carte dessine ses armes et met son blasonnement dans la zone de saisie")
    verifie(page.inner_text("#origine .or-nom") == "Duché de Bretagne" and "ok" in etat() and "de=blasons:duche-de-bretagne" in page.url, "partir : la carte d'origine s'affiche sous l'écu, et l'adresse la garde")
    verifie("Armes de « Duché de Bretagne »" in page.evaluate("standalone(S)"), "partir : l'export nomme les armes de la carte")
    page.locator("[data-name=t1] input[value=Azur]").check(force=True); page.wait_for_timeout(700)
    verifie("mod" in etat() and page.locator("#b-origine").count() == 1, "partir : modifier les armes le dit, avec de quoi revenir à la carte")
    verifie("D&#39;après les armes de « Duché de Bretagne »" in page.evaluate("standalone(S)"), "partir : l'export des armes modifiées dit d'où elles viennent")      # l'apostrophe est échappée dans le SVG
    page.reload(); page.wait_for_selector("#origine:not([hidden]) .or-etat"); page.wait_for_timeout(500)
    verifie("mod" in etat() and blz().startswith("D'azur"), "partir : recharger la page garde la composition et la carte d'origine")
    page.click("#b-origine"); page.wait_for_timeout(700)
    verifie("ok" in etat() and blz() == page.evaluate("t => lire(t).reecrit", bretagne), "partir : « Revenir aux armes de la carte » les redonne")
    page.select_option("select[name=cr]", index=1); page.wait_for_timeout(700)
    verifie("ok" in etat() and "ornements" in page.inner_text("#origine .or-etat"), "partir : une couronne ajoutée ne change pas les armes de la carte")
    page.click("#examples button >> nth=0"); page.wait_for_timeout(700)
    verifie(page.is_hidden("#origine") and "de=" not in page.url and page.input_value("#reel") == "", "partir : un exemple fait oublier la carte d'origine")
    propre("partir", page, erreurs)
    page.context.close()
    # une carte que le lecteur ne relit pas : le texte surligné, l'écu inchangé mais dessiné, la carte nommée
    chypre = next(a["blason"] for a in data("blasons.json") if a["nom"] == "Slovénie")      # (la Norvège, puis Chypre, se lisent désormais ; la Slovénie, avec son mont Triglav, reste refusée)
    page, erreurs = ouvre(browser, base, "atelier.html#lire=" + urllib.parse.quote(chypre) + "&de=blasons:slovenie", "#origine:not([hidden]) .or-etat")
    verifie("ko" in etat() and page.locator("#lire-etat.ko mark").count() >= 1 and blz() != "", "partir : une carte que le lecteur ne relit pas s'ouvre, texte surligné, sans rien deviner")
    verifie("de=blasons:slovenie" in page.url and "lire=" not in page.url, "partir : son adresse garde la carte")
    page.reload(); page.wait_for_selector("#origine:not([hidden]) .or-etat"); page.wait_for_timeout(500)
    verifie(page.input_value("#lire") == chypre and page.locator("#lire-etat.ko mark").count() >= 1, "partir : rechargée, elle remet le texte de la carte dans la zone de saisie, surligné")
    propre("partir (refusé)", page, erreurs)
    page.context.close()
    # une carte inconnue, une adresse truquée : ignorées
    sans = next(slug_carte(a["nom"]) for a in data("blasons.json") if not a.get("blason"))
    for de in ("blasons:n-existe-pas", "ailleurs:royaume-de-france-moderne", "blasons:<b>x</b>", "blasons:" + sans):
        page, erreurs = ouvre(browser, base, "atelier.html#lire=" + urllib.parse.quote("D'or à la croix de gueules") + "&de=" + urllib.parse.quote(de), "#reel")
        page.wait_for_function("document.querySelectorAll('#reel optgroup').length > 0"); page.wait_for_timeout(400)
        verifie(page.is_hidden("#origine") and "de=" not in page.url and blz() == "D'or à la croix de gueules", f"partir : « de={de} » est ignoré, l'écu dessiné")
        propre("partir (de truqué)", page, erreurs)
        page.context.close()

# ------------------------------------------------------------------ téléphone
def test_telephone(browser, base):
    """à 375 px, aucune page ne déborde en largeur ; le menu se replie derrière un bouton, s'ouvre, se ferme à Échap"""
    for ident, fichier, libelle in MENU:
        ctx = browser.new_context(viewport={"width": 375, "height": 812}, locale="fr-FR", is_mobile=True, has_touch=True)
        ctx.route("**/*", lambda r: r.continue_() if r.request.url.startswith(base) else r.fulfill(status=200, content_type="image/png", body=PIXEL))
        page = ctx.new_page()
        erreurs = []
        page.on("pageerror", lambda e: erreurs.append(str(e)))
        page.goto(f"{base}/{fichier}")
        page.wait_for_selector("header.mast nav a", state="attached", timeout=20000)
        page.wait_for_timeout(2500)
        sw = page.evaluate("document.documentElement.scrollWidth")
        verifie(sw <= 376, f"téléphone/{ident} : la page ne déborde pas en largeur ({sw} px pour 375)")
        verifie(page.locator("header.mast .rub button").count() == 3 and page.locator("header.mast .rub button").first.is_visible() and page.locator("header.mast nav a.nav-t").first.is_visible(), f"téléphone/{ident} : les rubriques du menu restent visibles")
        droite = page.evaluate("Math.max(...[...document.querySelectorAll('header.mast nav > *, header.mast > *')].filter(e => e.getBoundingClientRect().width).map(e => e.getBoundingClientRect().right))")
        verifie(droite <= 376, f"téléphone/{ident} : le bandeau tient dans la largeur ({droite})")
        hauteur = page.evaluate("[document.querySelector('header.mast').getBoundingClientRect().height, parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mast'))]")
        verifie(abs(hauteur[0] - hauteur[1]) <= 8, f"téléphone/{ident} : --mast suit la hauteur du bandeau ({hauteur})")
        page.locator("header.mast .rub button").nth(2).click()
        sous = page.locator("header.mast .rub-sous").nth(2)
        verifie(sous.is_visible() and sous.locator("a").count() == 3 and page.evaluate("document.querySelector('#rub-2').getBoundingClientRect().right") <= 376, f"téléphone/{ident} : une rubrique s'ouvre dans la largeur")
        page.locator("header.mast .rub button").nth(0).click()
        verifie(not sous.is_visible() and page.locator("header.mast .rub-sous").nth(0).is_visible(), f"téléphone/{ident} : une seule rubrique à la fois")
        page.keyboard.press("Escape")
        verifie(not page.locator("header.mast .rub-sous").nth(0).is_visible(), f"téléphone/{ident} : Échap referme la rubrique")
        verifie(not erreurs, f"téléphone/{ident} : aucune erreur" + ("" if not erreurs else f" — {erreurs[:2]}"))
        ctx.close()

# ------------------------------------------------------------------ S'exercer
VERIF_QUESTIONS = """async (n) => {
  const pb = [], plan = [["lire", 1], ["lire", 2], ["lire", 3], ["dessiner", 1], ["dessiner", 2], ["dessiner", 3], ["regle", 1], ["regle", 2], ["regle", 3], ["vocab", 1], ["vocab", 2], ["vocab", 3], ["points", 1], ["reel", 1]];
  for (const [id, niv] of plan) {
    if (!Exercices.ids.includes(id)) { pb.push("exercice absent : " + id); continue; }
    for (let seed = 1; seed <= n; seed++) {
      let q;
      try { q = await Exercices.fabrique(id, niv, seed * 7919 + niv); } catch (e) { pb.push(id + niv + " exception : " + e.message); continue; }
      const mal = m => pb.push(`${id}${niv} graine ${seed} : ${m}`);
      if (id === "lire" || id === "dessiner") {
        if (q.choix.length !== 4) mal("choix = " + q.choix.length);
        if (q.choix.filter(c => c.ok).length !== 1) mal("pas exactement une bonne réponse");
        if (new Set(q.choix.map(c => c.texte)).size !== q.choix.length) mal("textes en double");
        if (q.choix.find(c => c.ok).texte !== q.texte) mal("la bonne réponse n'est pas le texte de l'écu");
        for (const c of q.choix) { const r = lire(c.texte); if (!r.ok || !r.exact) mal("texte non relu : " + c.texte); }
      } else if (id === "regle") {
        if ((q.fautes.length === 0) !== (ruleAll(q.St).length === 0)) mal("fautes incohérentes");
      } else if (id === "vocab" || id === "points" || id === "reel") {
        if (q.choix.length !== 4 || new Set(q.choix.map(c => c.texte)).size !== 4) mal("choix mal formés");
        if (q.choix.filter(c => c.ok).length !== 1) mal("pas exactement une bonne réponse");
      }
    }
  }
  return pb;
}"""

def test_exercices(browser, base):
    page, erreurs = ouvre(browser, base, "exercices.html", ".ex-carte")
    ids = page.evaluate("Exercices.ids")
    verifie(page.locator(".ex-carte").count() == len(ids), f"exercices : une carte par exercice ({len(ids)})")
    pb = page.evaluate(VERIF_QUESTIONS, 20)
    verifie(not pb, "exercices : les questions tirées sont cohérentes (une seule bonne réponse, textes relus par le lecteur, règle des émaux juste)" + ("" if not pb else f" — {pb[:3]}"))
    # la même graine donne la même question (c'est ce qui fait le défi du jour)
    memes = page.evaluate("""async () => { const a = await Exercices.fabrique("lire", 2, 4242), b = await Exercices.fabrique("lire", 2, 4242); return a.texte === b.texte && a.choix.map(c => c.texte).join("|") === b.choix.map(c => c.texte).join("|"); }""")
    verifie(memes, "exercices : une même graine redonne la même question")
    # une partie : on répond, la réponse s'explique, la question suivante vient
    page.click(".ex-carte[data-id=lire]"); page.wait_for_selector(".ex-q .ex-c"); page.wait_for_timeout(400)
    verifie(page.locator(".ex-q .ex-c").count() == 4 and page.locator(".ex-q svg.ecu").count() == 1, "exercices : « Lire un écu » montre un écu et quatre propositions")
    page.keyboard.press("2"); page.wait_for_timeout(300)
    verifie(page.locator(".ex-c.ok").count() == 1 and page.locator("#ex-fb .ex-verdict").count() == 1 and page.locator("#ex-suite:visible").count() == 1, "exercices : la touche « 2 » répond, la bonne réponse est marquée et expliquée")
    verifie(page.locator(".ex-c:not([disabled])").count() == 0, "exercices : après la réponse, les propositions sont figées")
    page.click("#ex-suite"); page.wait_for_selector(".ex-q .ex-c:not([disabled])"); page.wait_for_timeout(300)
    verifie("sur 1" in page.inner_text("#ex-score"), "exercices : le score compte une question jouée")
    page.click("#ex-retour"); page.wait_for_selector(".ex-carte")
    # le défi du jour : six questions, puis le résultat à partager
    page.click(".ex-carte[data-id=defi]")
    for i in range(6):
        page.wait_for_selector(".ex-q .ex-c:not([disabled])", timeout=20000); page.wait_for_timeout(300)
        page.keyboard.press("1"); page.wait_for_selector("#ex-suite:visible"); page.wait_for_timeout(150)
        page.click("#ex-suite")
    page.wait_for_selector(".ex-final")
    verifie(page.locator(".ex-grille").count() == 1 and page.locator("#ex-copie").count() == 1, "exercices : le défi du jour se termine sur une grille de résultat à copier")
    propre("exercices", page, erreurs)
    page.context.close()
    # l'adresse « #defi » ouvre le défi ; les questions du jour sont les mêmes d'une visite à l'autre
    qs = []
    for _ in range(2):
        page, erreurs = ouvre(browser, base, "exercices.html#defi", ".ex-q .ex-c")
        qs.append(page.inner_text(".ex-q"))
        page.context.close()
    verifie(qs[0] == qs[1], "exercices : la première question du défi est la même à chaque visite du jour")

# ------------------------------------------------------------------ L'Écu du jour
PARTIE_JEU = """async (nom) => { const E = window.EcuDuJour; await E.devine(E.CARTES.find(c => c.nom === nom)); return E.J.essais.length; }"""

def devine_au_clavier(page, nom):
    """ce que fait un joueur : taper le nom, choisir dans la liste (Entrée), valider (Entrée)"""
    page.fill("#jeu-nom", nom)
    page.wait_for_selector("#jeu-liste li", state="visible", timeout=3000)
    page.keyboard.press("Enter"); page.keyboard.press("Enter")

def test_jeu(browser, base):
    page, erreurs = ouvre(browser, base, "index.html", "#jeu-grille:not([hidden])")
    page.wait_for_selector("#jeu-ecu svg", timeout=10000)
    verifie(page.locator("#dlg-aide[open]").count() == 1, "jeu : à la première visite, la fenêtre « Comment jouer ? » s'ouvre")
    page.click("#dlg-aide .jx-go")
    E = page.evaluate("({ n: EcuDuJour.N, pool: EcuDuJour.CARTES.length, cible: EcuDuJour.cible.nom, noms: EcuDuJour.CARTES.map(c => c.nom) })")
    verifie(E["pool"] >= 100, f"jeu : plus de cent armes proposables (le lecteur en relit {E['pool']})")
    verifie(E["cible"] == ECUS["chevalier"], f"jeu : l'écu du jour est celui du document du jour, niveau Chevalier par défaut ({E['cible']})")
    verifie(page.evaluate("(() => { const M = EcuDuJour.devoile(EcuDuJour.cible.S, 0); return !M.q && M.A[0].f === 'plein' && !M.A[0].m && !M.A[0].p; })()"), "jeu : avant le premier essai, l'écu mystère ne montre que sa silhouette")
    verifie(page.locator("#jeu-niveaux a").count() == 3 and page.locator("#jeu-niveaux a.on").count() == 1, "jeu : trois niveaux en onglets, le niveau joué marqué")
    verifie(page.locator("#jeu-palette .em").count() == 9, "jeu : la palette montre les neuf émaux")
    verifie(page.locator("#jeu-ecu > svg").count() == 1 and page.locator(".essai").count() == 0, "jeu : l'écu mystère est dessiné, aucun essai pour l'instant")
    # les traits lus : fleurs de lis d'azur d'or, trois, sur un champ plein
    tr = page.evaluate("(() => { const c = EcuDuJour.CARTES.find(x => x.nom === 'Royaume de France (moderne)'); return EcuDuJour.traits(c); })()")
    verifie(tr["emaux"] == ["Or", "Azur"] and tr["compo"] == "Plein" and tr["meubles"] == ["fleurdelis"] and tr["nombre"] == 3 and tr["pieces"] == [], f"jeu : la France moderne se lit « azur, or, plein, trois fleurs de lis » ({tr})")
    memes = page.evaluate("(() => { const c = EcuDuJour.CARTES[0]; const m = EcuDuJour.compare(c.t, c.t); return Object.values(m).every(x => x.cls === 'ok'); })()")
    verifie(memes, "jeu : des armes comparées à elles-mêmes sont identiques partout")
    # un essai perdant, au clavier
    perdante = page.evaluate("EcuDuJour.CARTES.find(c => c.canon !== EcuDuJour.cible.canon && c.t.emaux.some(e => EcuDuJour.cible.t.emaux.includes(e)) && c.t.emaux.some(e => !EcuDuJour.cible.t.emaux.includes(e))).nom")
    devine_au_clavier(page, perdante.lower())
    page.wait_for_selector(".essai .case", timeout=8000); page.wait_for_timeout(500)
    verifie(page.locator(".essai").count() == 1 and page.locator(".essai .case").count() == 6, "jeu : une réponse ajoute une ligne de six cases")
    attendu = page.evaluate("(() => { const c = EcuDuJour.J.essais[0], m = EcuDuJour.cible.t.emaux; return [c.t.emaux.filter(e => m.includes(e)).length, c.t.emaux.filter(e => !m.includes(e)).length]; })()")
    verifie([page.locator(".em.oui").count(), page.locator(".em.non").count()] == attendu, f"jeu : la palette allume les émaux trouvés et barre les absents ({attendu})")
    verifie("essai 2 sur 6" in page.text_content("#jeu-essais").lower(), "jeu : le compteur d'essais avance")
    verifie(page.locator("#jeu-liste li").count() == 0 or not page.locator("#jeu-liste").is_visible(), "jeu : la liste de propositions se referme après la réponse")
    # la même armes ne se propose pas deux fois
    page.fill("#jeu-nom", perdante.lower()); page.wait_for_timeout(150)
    verifie(perdante not in page.locator("#jeu-liste li b").all_inner_texts(), "jeu : une arme déjà proposée disparaît de la liste")
    page.fill("#jeu-nom", "")
    # la partie se reprend après un rechargement
    page.reload(); page.wait_for_selector("#jeu-grille:not([hidden])", timeout=20000); page.wait_for_selector(".essai .case", timeout=8000)
    verifie(page.locator(".essai").count() == 1 and page.locator(".em.oui").count() == attendu[0], "jeu : après un rechargement, la partie reprend où elle s'était arrêtée")
    # un nom qui n'existe pas n'est pas un essai
    page.fill("#jeu-nom", "zzzzqq"); page.keyboard.press("Enter"); page.wait_for_timeout(200)
    verifie(page.locator(".essai").count() == 1 and "Ni arme ni détail" in page.inner_text("#jeu-aide-saisie"), "jeu : un nom inconnu n'est pas un essai, et la page le dit")
    # la victoire : résultat, partage, statistiques
    devine_au_clavier(page, E["cible"])
    page.wait_for_selector("#jeu-resultat:not([hidden])", timeout=8000)
    verifie("Ces armes sont celles de" in page.inner_text("#jeu-resultat") and E["cible"] in page.inner_text("#jeu-resultat"), "jeu : la victoire donne le nom des armes")
    verifie(page.locator("#jeu-resultat img").count() == 1 and "Wikimedia Commons" in page.inner_text(".res-credit"), "jeu : l'image réelle est montrée avec son crédit")
    verifie(not page.locator("#jeu-saisie").is_visible(), "jeu : la saisie disparaît une fois la partie finie")
    verifie("Pour aller plus loin" in page.text_content(".jx-armorial"), "jeu : la partie finie, le bloc de l'encyclopédie n'est plus un indice")
    termes = page.evaluate("""() => Object.fromEntries(["D'azur à trois fleurs de lis d'or", "Écartelé d'or et de gueules, à quatre lionceaux de l'un à l'autre, armés et lampassés d'azur", "De gueules à la croix pattée d'argent", "De gueules à la fasce d'or", "Fascé d'or et de gueules"].map(t => [t, termesDe(t).map(x => x.terme)]))""")
    verifie(termes["D'azur à trois fleurs de lis d'or"][0] == "Fleur de lis", f"jeu : un terme au pluriel est reconnu ({termes})")
    verifie({"Écartelé", "Lion", "Armé", "Lampassé"} <= set(termes["Écartelé d'or et de gueules, à quatre lionceaux de l'un à l'autre, armés et lampassés d'azur"]), f"jeu : les mots du blasonnement sont reconnus ({termes})")
    verifie("Croix" not in termes["De gueules à la croix pattée d'argent"] and "Croix pattée" in termes["De gueules à la croix pattée d'argent"], f"jeu : le terme le plus long l'emporte ({termes})")
    verifie("Fascé" not in termes["De gueules à la fasce d'or"] and "Fasce" not in termes["Fascé d'or et de gueules"], f"jeu : « fasce » n'est pas « fascé » ({termes})")
    partage = page.evaluate("EcuDuJour.texteDePartage()")
    verifie(partage.startswith(f"L'Écu du jour n° {E['n']} · Chevalier — 2/6") and partage.count("\n") == 3 and "🟩🟩🟩🟩🟩🟩" in partage, f"jeu : le texte de partage porte le numéro, le score et une ligne par essai ({partage!r})")
    st = page.evaluate("Compte.carnet('ecu').stats")
    verifie(st["joues"] == 1 and st["gagnes"] == 1 and st["serie"] == 1 and st["rep"][1] == 1, f"jeu : les statistiques comptent la victoire en deux essais ({st})")
    pts = page.evaluate("[Compte.points.ecu(1, 0), Compte.points.ecu(2, 12), Compte.points.ecu(3, 0), Compte.points.ecu(6, 99), Compte.points.ecu_page(1, 0), Compte.points.ecu_heraut(1, 0)]")
    verifie(pts == [150, 74, 105, 15, 100, 200], f"jeu : le barème (un essai pèse plus que quelques détails, 10 points au moins, multiplié selon le niveau) ({pts})")
    gagnes = page.evaluate("[Compte.points.ecu(2, EcuDuJour.J.details.length), Jour.totalPoints()]")
    verifie(f"+{gagnes[0]}" in page.inner_text(".res-points") and gagnes[0] == gagnes[1], f"jeu : la fin de partie dit les points gagnés ({gagnes})")
    temps = page.evaluate("[Jour.semaine(3), Jour.semaine(4), Jour.semaine(10), Jour.semaine(11), Jour.titre(249), Jour.titre(250).nom, Jour.titre(20000).nom, Jour.titreSuivant(20000)]")
    verifie(temps == [0, 1, 1, 2, None, "Poursuivant d'armes", "Roi d'armes", None], f"jeu : la semaine commence le lundi et les titres suivent les seuils ({temps})")
    page.wait_for_selector("#jeu-classement .onglets", state="attached", timeout=8000)
    verifie(page.locator("#jeu-classement .onglets button").count() == 4, "jeu : le classement a quatre onglets (jour, semaine, général, maison)")
    page.reload(); page.wait_for_selector("#jeu-resultat:not([hidden])", timeout=20000)
    st = page.evaluate("Compte.carnet('ecu').stats")
    verifie(st["joues"] == 1, "jeu : recharger une partie finie ne la recompte pas")
    # le profil : créer, des armes au hasard, sauvegarde
    page.click("#jeu-pf"); page.wait_for_selector("dialog.cpt[open]")
    page.wait_for_selector("#cpt-ecu svg", timeout=5000)
    avant = page.inner_text("#cpt-blz"); page.click("#cpt-hasard"); page.wait_for_selector("#cpt-ecu svg", timeout=5000)
    verifie(page.inner_text("#cpt-blz") != avant and page.locator("#cpt-atelier[href^='atelier.html#']").count() == 1, "jeu/profil : « Au hasard » change les armes ; un lien les ouvre dans l'Atelier")
    armes = page.evaluate("document.querySelector('#cpt-atelier').getAttribute('href').replace(/^atelier\\.html#/, '').replace(/&?pour=profil$/, '')")
    page.fill("#cpt-pseudo", "<b>X</b>"); page.click("#cpt-form button.main")
    verifie(page.locator("#cpt-err").is_visible() and page.evaluate("Compte.profil()") is None, "jeu/profil : un pseudo avec des chevrons est refusé")
    page.fill("#cpt-pseudo", "Héraut Test"); page.click("#cpt-form button.main")
    page.wait_for_selector("dialog.cpt:not([open])", state="attached")
    pf = page.evaluate("Compte.profil()")
    verifie(pf and pf["pseudo"] == "Héraut Test" and pf["armes"] == armes and "Héraut Test" in page.inner_text("#jx-moi-nom"), "jeu/profil : le profil est créé, avec ses armes, et affiché en haut de la page")
    code = page.evaluate("Compte.exporter()")
    page.evaluate("localStorage.clear()")
    verifie(page.evaluate("(c) => Compte.importer(c)", code) and page.evaluate("Compte.carnet('ecu').stats.gagnes") == 1 and not page.evaluate("Compte.importer('pas un code')"), "jeu/profil : le code de sauvegarde rend le profil et les scores ; un code illisible est refusé")
    propre("jeu", page, erreurs)
    page.context.close()
    # la défaite : six mauvaises réponses, la série retombe, les armes sont révélées
    page, erreurs = ouvre(browser, base, "index.html", "#jeu-grille:not([hidden])")
    page.wait_for_selector("#jeu-ecu svg", timeout=10000)
    page.evaluate("document.querySelectorAll('dialog[open]').forEach(d => d.close())")
    page.evaluate("""async () => { const E = EcuDuJour; for (const c of E.CARTES.filter(c => c.canon !== E.cible.canon).slice(0, 6)) await E.devine(c); }""")
    page.wait_for_selector("#jeu-resultat:not([hidden])", timeout=8000)
    verifie("Perdu" in page.inner_text("#jeu-resultat h2") and f"C'étaient les armes de {E['cible']}" in page.inner_text("#jeu-resultat"), "jeu : après six essais manqués, la partie est perdue et les armes sont révélées")
    st = page.evaluate("Compte.carnet('ecu').stats")
    verifie(st["joues"] == 1 and st["gagnes"] == 0 and st["serie"] == 0, f"jeu : la défaite compte une partie, aucune victoire, pas de série ({st})")
    verifie(page.evaluate("EcuDuJour.texteDePartage()").startswith(f"L'Écu du jour n° {E['n']} · Chevalier — X/6"), "jeu : le partage d'une défaite porte « X/6 »")
    propre("jeu (défaite)", page, erreurs)
    page.context.close()
    # l'écu du jour est le même pour tous : deux visiteurs, les mêmes armes
    cibles = []
    for _ in range(2):
        page, erreurs = ouvre(browser, base, "index.html", "#jeu-grille:not([hidden])")
        cibles.append(page.evaluate("EcuDuJour.cible.nom")); page.context.close()
    verifie(cibles[0] == cibles[1], "jeu : deux visiteurs ont les mêmes armes mystères le même jour")
    # le niveau Héraut : son écu, cinq essais, pas de rubrique
    page, erreurs = ouvre(browser, base, "index.html?niveau=heraut", "#jeu-grille:not([hidden])")
    H = page.evaluate("({ cible: EcuDuJour.cible.nom, essais: EcuDuJour.ESSAIS })")
    page.evaluate("document.querySelectorAll('dialog[open]').forEach(d => d.close())")
    page.evaluate("""async () => { const E = EcuDuJour; await E.devine(E.CARTES.find(c => c.canon !== E.cible.canon)); }""")
    page.wait_for_selector(".essai .case", timeout=8000)
    verifie(H == {"cible": ECUS["heraut"], "essais": 5} and page.locator(".essai .case").count() == 5, f"jeu : le niveau Héraut a son écu, cinq essais, et ne dit pas la rubrique ({H})")
    propre("jeu (Héraut)", page, erreurs)
    page.context.close()

def test_mon_armorial_et_image(browser, base):
    ctx = browser.new_context(viewport={"width": 375, "height": 812}, locale="fr-FR", is_mobile=True, has_touch=True)
    ctx.add_init_script("try { localStorage.setItem('armorial.jeu.aide', '1'); } catch (e) {}")
    page = ctx.new_page(); erreurs = []
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.goto(f"{base}/mon-armorial.html"); page.wait_for_selector(".ma-vide", timeout=30000)
    verifie(page.locator(".ma-case").count() == 0 and page.locator(".ma-vide").count() == 3 and "0" in page.inner_text(".ma-compte"), f"mon armorial : sans partie, trois cases vides, une par écu ouvert ({page.locator('.ma-vide').count()})")
    texte = page.inner_text("#ma-livre")
    verifie(all(v not in texte for v in ECUS.values()), "mon armorial : une case vide ne dit pas quel écu elle attend")
    verifie(page.evaluate("document.documentElement.scrollWidth") <= 376, "mon armorial : tient à 375 pixels")
    # trouver l'écu du jour au niveau Chevalier : il rejoint l'armorial, et l'image se dessine
    page.goto(f"{base}/index.html"); page.wait_for_selector("#jeu-ecu svg", timeout=20000)
    page.evaluate("EcuDuJour.devine(EcuDuJour.cible)"); page.wait_for_selector("#jeu-resultat:not([hidden])", timeout=8000)
    page.click("#jeu-image"); page.wait_for_function("document.querySelector('#img-apercu').naturalWidth === 1080", timeout=20000)
    verifie(page.locator("#dlg-image[open]").count() == 1 and page.locator("#img-telecharge").get_attribute("download") == f"armorial-ecu-{page.evaluate('EcuDuJour.N')}.png", "image : le bouton dessine l'image, prête à télécharger")
    verifie(page.locator("#img-choix").is_visible() and not page.locator("#img-montre").is_checked(), "image : le jour même, l'écu reste caché par défaut")
    pixels = page.evaluate("""async () => { const lit = async m => { const c = await EcuDuJour.canvasDuResultat(m), x = c.getContext('2d'), d = x.getImageData(70, 215, 420, 520).data; let col = 0; for (let i = 0; i < d.length; i += 40) { if (Math.abs(d[i] - d[i + 1]) > 40 || Math.abs(d[i + 1] - d[i + 2]) > 40) col++; } return col; }; return [await lit(false), await lit(true)]; }""")
    verifie(pixels[1] > pixels[0] * 3 and pixels[1] > 50, f"image : la case à cocher montre l'écu, en couleurs ; sinon, une silhouette grise ({pixels})")
    page.evaluate("document.querySelector('#dlg-image').close()")
    page.goto(f"{base}/mon-armorial.html"); page.wait_for_selector(".ma-case", timeout=30000)
    verifie(page.locator(".ma-case").count() == 1 and ECUS["chevalier"] in page.inner_text(".ma-case") and page.locator(".ma-case svg.ecu path").count() > 0, "mon armorial : l'écu trouvé y prend sa place, dessiné")
    png = page.locator(".ma-case svg.ecu").screenshot()
    couleurs = page.evaluate("""async b64 => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); const d = x.getImageData(0, 0, i.width, i.height).data; let bleu = 0, clair = 0; for (let k = 0; k < d.length; k += 4) { if (d[k + 2] > d[k] + 30) bleu++; else if (d[k] > 190 && d[k + 1] > 190 && d[k + 2] > 180) clair++; } return [bleu, clair]; }""", __import__("base64").b64encode(png).decode())
    verifie(couleurs[0] > 100 and couleurs[1] > 100, f"mon armorial : l'écu garde ses émaux, tranché d'argent et d'azur, et ses dégradés ({couleurs})")
    page.click(".ma-case"); page.wait_for_selector("#ma-detail[open] .ma-blason", timeout=5000)
    verifie(ECUS["chevalier"] in page.inner_text("#ma-detail") and page.locator("#ma-detail a").count() == 2, "mon armorial : un écu trouvé dit son blasonnement et renvoie à sa carte")
    page.click("#ma-detail [data-fermer]")
    href = page.locator(".ma-vide").first.get_attribute("href")
    verifie(href.startswith("./?niveau=") , f"mon armorial : une case vide mène à sa partie ({href})")
    # en anglais, et le jour n'est pas relu une seconde fois
    page.goto(f"{base}/en-my-armorial.html"); page.wait_for_selector(".ma-case", timeout=30000)
    verifie("My armorial" in page.inner_text("h1") and "shields opened" in page.inner_text(".ma-compte"), "mon armorial en anglais : la page est traduite")
    verifie(not erreurs, f"mon armorial et image : aucune erreur JavaScript ({erreurs[:2]})")
    ctx.close()

def test_archives(browser, base):
    ctx = browser.new_context(viewport={"width": 375, "height": 812}, locale="fr-FR", is_mobile=True, has_touch=True)
    ctx.add_init_script("try { localStorage.setItem('armorial.jeu.aide', '1'); } catch (e) {}")
    page = ctx.new_page(); erreurs = []
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.goto(f"{base}/index.html"); page.wait_for_selector("#jeu-grille:not([hidden])", timeout=20000)
    page.wait_for_selector("#jeu-autres [data-archives]", timeout=8000)
    page.click("#jeu-autres [data-archives]"); page.wait_for_selector("#dlg-archives[open] .ar-grille", timeout=5000)
    n = page.evaluate("EcuDuJour.N")
    verifie(page.locator("#dlg-archives[open]").count() == 1, "archives : la carte ouvre le calendrier")
    verifie(page.locator(f".ar-j[data-n='{n - 1}']").count() == 1 and page.locator(f".ar-j[data-n='{n + 1}']").count() == 0, "archives : hier se joue, demain n'est pas ouvert")
    verifie(page.locator("#jeu-archives [data-pas='1']").is_disabled() or page.evaluate("Jour.dateDu(EcuDuJour.N).getUTCMonth() !== Jour.dateDu(EcuDuJour.N - 1).getUTCMonth()"), "archives : pas de mois à venir")
    largeur = page.evaluate("document.querySelector('#dlg-archives').scrollWidth <= document.querySelector('#dlg-archives').clientWidth + 1")
    verifie(largeur, "archives : le calendrier tient à 375 pixels")
    # rejouer un écu d'hier : hors concours, et l'issue reste dans le calendrier
    avant = page.evaluate("JSON.stringify((Compte.carnet('ecu') || {}).stats || null)")
    page.click(f".ar-j[data-n='{n - 1}']")
    page.wait_for_function(f"window.EcuDuJour && EcuDuJour.N === {n - 1} && EcuDuJour.hors", timeout=20000)
    verifie("hors concours" in page.inner_text("#jeu-jour"), "archives : le même niveau recharge bien la page, annoncée hors concours")
    page.wait_for_selector("#jeu-ecu svg", timeout=10000)
    page.evaluate("EcuDuJour.devine(EcuDuJour.cible)")
    page.wait_for_selector("#jeu-resultat:not([hidden])", timeout=8000)
    verifie(page.locator(".res-points").count() == 0, "archives : un écu rejoué ne rapporte pas de points")
    verifie(page.evaluate("JSON.stringify((Compte.carnet('ecu') || {}).stats || null)") == avant and page.evaluate("Jour.totalPoints()") == 0, "archives : ni statistiques ni points changés")
    verifie(page.evaluate(f"Compte.carnet('archives').ecu[{n - 1}].g") == 1, "archives : l'issue est gardée à part")
    page.click("#jeu-resultat [data-archives]"); page.wait_for_selector(f".ar-j.gagne[data-n='{n - 1}']", timeout=5000)
    verifie("1 écu trouvé" in page.inner_text("#jeu-archives"), "archives : le calendrier marque l'écu trouvé et le compte")
    # un autre niveau a ses propres cases ; l'adresse directe ouvre le calendrier
    page.click("#jeu-archives [data-niv=heraut]"); page.wait_for_selector("#jeu-archives [data-niv=heraut][aria-selected=true]")
    verifie(page.locator(".ar-j.gagne").count() == 0, "archives : chaque niveau a ses propres cases")
    page.goto(f"{base}/index.html#archives"); page.wait_for_selector("#dlg-archives[open] .ar-grille", timeout=20000)
    verifie("index.html#archives" in page.url, "archives : l'adresse directe ouvre le calendrier, sans partir vers l'encyclopédie")
    # le retour à l'écu du jour, depuis le calendrier
    page.click(f".ar-j[data-n='{n}']"); page.wait_for_function(f"window.EcuDuJour && EcuDuJour.N === {n} && !EcuDuJour.hors", timeout=20000)
    verifie(True, "archives : la case d'aujourd'hui ramène à l'écu du jour")
    verifie(not erreurs, f"archives : aucune erreur JavaScript ({erreurs[:2]})")
    ctx.close()

def test_retour(browser, base):
    retours = lambda: [v for k, v in MF.DB["docs"].items() if k.startswith("retours/")]
    # depuis le pied d'une page : le formulaire sait d'où l'on vient
    page, erreurs = ouvre(browser, base, "blasons.html#x", "#grid .ar")
    verifie(page.locator("footer #lien-retour").count() == 1, "retour : le lien est au pied de la page")
    page.click("footer #lien-retour"); page.wait_for_selector("#ret-form", timeout=8000)
    verifie("blasons.html#x" in page.inner_text("#ret-depuis") and "depuis=blasons.html" in page.url, f"retour : le formulaire dit la page d'où l'on vient ({page.url})")
    verifie(page.locator("footer #lien-retour").count() == 0, "retour : le formulaire ne renvoie pas vers lui-même")
    page.click("#ret-ok")
    verifie("message" in page.inner_text("#ret-err") and not retours(), "retour : un message vide n'est pas envoyé, et la page le dit")
    page.fill("#ret-message", "<img src=x onerror=alert(1)> Le lion regarde du mauvais côté")
    page.fill("#ret-email", "pas-une-adresse"); page.click("#ret-ok")
    verifie("e-mail" in page.inner_text("#ret-err") and not retours(), "retour : une adresse fausse est refusée")
    page.fill("#ret-email", "lecteur@essai.fr"); page.click("#ret-ok")
    page.wait_for_selector("#ret-merci:not([hidden])", timeout=8000)
    r = retours()
    verifie(len(r) == 1 and r[0]["type"] == "erreur" and r[0]["page"] == "blasons.html#x" and r[0]["email"] == "lecteur@essai.fr" and r[0]["langue"] == "fr", f"retour : le message part, avec sa page et son e-mail ({r})")
    verifie(page.locator("#ret-retour").get_attribute("href") == "blasons.html#x", "retour : le lien de retour ramène à la page d'où l'on vient")
    # une minute entre deux messages, et le champ invisible
    page.goto(f"{base}/retour.html"); page.wait_for_selector("#ret-form")
    page.fill("#ret-message", "Un second message"); page.click("#ret-ok")
    page.wait_for_function("document.querySelector('#ret-err').textContent.includes('patientez')", timeout=5000)
    verifie(len(retours()) == 1, "retour : une minute entre deux messages")
    page.evaluate("localStorage.removeItem('armorial.retour.dernier'); document.querySelector('#ret-site').value = 'robot'")
    page.click("#ret-ok"); page.wait_for_selector("#ret-merci:not([hidden])", timeout=8000)
    verifie(len(retours()) == 1, "retour : un robot qui remplit le champ invisible croit avoir réussi, rien ne part")
    # une adresse d'origine étrangère ne devient pas un lien
    page.goto(f"{base}/retour.html?depuis=https://mechant.example/"); page.wait_for_selector("#ret-form")
    verifie(page.locator("#ret-retour").get_attribute("href") == "./", "retour : le lien de retour ne quitte jamais le site")
    # en anglais
    en, _ = ouvre(browser, base, "en-feedback.html", "#ret-form")
    verifie("Report or suggest" in en.inner_text("h1"), "retour en anglais : la page est traduite")
    en.fill("#ret-message", "The lion faces the wrong way"); en.check("input[value=idee]"); en.click("#ret-ok")
    en.wait_for_selector("#ret-merci:not([hidden])", timeout=8000)
    verifie(any(x["langue"] == "en" and x["type"] == "idee" and "email" not in x for x in retours()), "retour en anglais : le message part, sans e-mail")
    en.context.close()
    # la lecture : refusée à un joueur, permise au curateur ; un message n'est jamais pris pour du HTML
    verifie(page.evaluate("fetch(`${location.origin}/firestore/v1/projects/armorial-test/databases/(default)/documents/retours?key=AIza${'B'.repeat(35)}`).then(r => r.status)") == 403, "retour : sans compte, on ne lit pas les messages")
    page.context.close()
    joueur, _ = ouvre(browser, base, "index.html", "#jeu-grille:not([hidden])")
    inscrit_au_jeu(joueur, "Quidam", "quidam@essai.fr")
    joueur.goto(f"{base}/tools/retours.html"); joueur.wait_for_selector("#qui .err", timeout=15000)
    verifie(joueur.locator("#messages li").count() == 0, "retour : un autre compte ne lit pas les messages")
    joueur.context.close()
    cur, _ = ouvre(browser, base, "index.html", "#jeu-grille:not([hidden])")
    cur.on("dialog", lambda d: d.accept())
    inscrit_au_jeu(cur, "Curateur", "curateur@essai.fr")
    cur.goto(f"{base}/tools/retours.html"); cur.wait_for_selector("#messages li", timeout=15000)
    verifie(cur.locator("#messages li").count() == 2 and cur.locator("#messages img").count() == 0 and "<img src=x" in cur.inner_text("#messages"), "retour : le curateur lit les messages, sans que leur HTML s'exécute")
    cur.locator("#messages .efface").first.click()
    cur.wait_for_function("document.querySelectorAll('#messages li').length === 1", timeout=8000)
    verifie(len(retours()) == 1, "retour : le curateur efface un message")
    cur.context.close()

def inscrit_au_jeu(page, pseudo, email):
    """un compte sur le faux Firebase, par la fenêtre du profil"""
    page.evaluate("document.querySelectorAll('dialog[open]').forEach(d => d.close())")
    page.evaluate(f"Compte.interne.ecrire({{ ...Compte.interne.lire(), profil: {{ pseudo: {pseudo!r}, armes: 't1=Azur&m=lion&nb=1&tm=Or', cree: '2026-11-04' }} }}, false); Compte.ouvre()")
    page.click("dialog[open] details.cpt-mdp summary")
    page.fill("#cpt-email", email); page.fill("#cpt-mdp", "mot-de-passe-d-essai")
    page.click("dialog[open] button:has-text('Créer mon compte')")
    page.wait_for_function("Compte.ligne.connecte()", timeout=8000)
    page.evaluate("document.querySelectorAll('dialog[open]').forEach(d => d.close())")

def onglet_maison(page):
    page.evaluate("document.querySelector('#dlg-classement').open || document.querySelector('#jx-classement').click()")
    page.wait_for_selector("#jeu-classement [data-o=maison]", timeout=8000)
    page.click("#jeu-classement [data-o=maison]")

def test_maisons(browser, base):
    page, _ = ouvre(browser, base, "index.html", "#jeu-grille:not([hidden])")
    page.on("dialog", lambda d: d.accept())
    inscrit_au_jeu(page, "Alix", "alix@essai.fr")
    onglet_maison(page)
    page.wait_for_selector("#cl-fonde", timeout=8000)
    page.fill("#cl-nom", "x"); page.click("#cl-fonde button")
    page.wait_for_function("document.querySelector('#cl-err').textContent.includes('2 à 40')", timeout=5000)
    verifie(not [k for k in MF.DB["docs"] if k.startswith("maisons/")], "maisons : un nom trop court ne fonde rien, et la page le dit")
    page.fill("#cl-code", "ZZZZZZ"); page.click("#cl-rejoint button")
    page.wait_for_function("document.querySelector('#cl-err').textContent.includes('Aucune maison')", timeout=5000)
    verifie(True, "maisons : un code inconnu est refusé, et la page le dit")
    page.fill("#cl-nom", "Les <b>Amis</b>"); page.click("#cl-fonde button")
    page.wait_for_function("document.querySelector('#cl-err').textContent.includes('<')", timeout=5000)
    page.fill("#cl-nom", "Les Amis du Lion"); page.click("#cl-fonde button")
    page.wait_for_selector("#jeu-classement .cl li", timeout=8000)
    code = page.inner_text("#jeu-classement .cl-place b")
    profil = lambda nom: next(v for k, v in MF.DB["docs"].items() if k.startswith("profils/") and k.count("/") == 1 and v.get("pseudo") == nom)
    verifie(MF.DB["docs"].get(f"maisons/{code}", {}).get("nom") == "Les Amis du Lion" and profil("Alix").get("maison") == code, f"maisons : fonder crée la maison et y inscrit son fondateur ({code})")
    # le second joueur arrive par le lien d'invitation, sans compte
    p2, _ = ouvre(browser, base, f"index.html?maison={code}", "#jeu-grille:not([hidden])")
    p2.on("dialog", lambda d: d.accept())
    p2.wait_for_function("document.querySelector('#jeu-classement .cl-place') && document.querySelector('#jeu-classement .cl-place').textContent.includes('Les Amis du Lion')", timeout=8000)
    verifie(p2.locator("#dlg-classement[open]").count() == 1, "maisons : le lien d'invitation ouvre la maison et dit son nom")
    inscrit_au_jeu(p2, "Berenice", "berenice@essai.fr")
    onglet_maison(p2)
    p2.wait_for_selector("#jeu-classement [data-m=accepte]", timeout=8000)
    p2.click("#jeu-classement [data-m=accepte]")
    p2.wait_for_function("document.querySelectorAll('#jeu-classement .cl li').length === 2", timeout=8000)
    verifie("maison=" not in p2.url and profil("Berenice").get("maison") == code, f"maisons : l'invitation acceptée, les deux membres figurent et l'adresse perd le code ({p2.url})")
    verifie(p2.locator("#jeu-classement .cl li[data-r='1']").count() == 2, "maisons : à points égaux, les deux membres partagent le premier rang")
    # enregistrer son profil ne fait pas quitter la maison
    p2.evaluate("document.querySelectorAll('dialog[open]').forEach(d => d.close()); Compte.ouvre()")
    p2.click("dialog[open] button:has-text('Enregistrer')")
    p2.wait_for_timeout(1500)
    verifie(profil("Berenice").get("maison") == code and p2.evaluate("Compte.profil().maison") == code, "maisons : modifier son profil garde la maison")
    # après un rechargement, sur un appareil neuf comme sur celui-ci, la maison revient de la base
    p2.goto(f"{base}/index.html"); p2.wait_for_selector("#jeu-grille:not([hidden])", timeout=20000)
    p2.wait_for_function("Compte.ligne && Compte.ligne.connecte() && Compte.profil() && Compte.profil().maison", timeout=8000)
    onglet_maison(p2)
    p2.wait_for_function("document.querySelectorAll('#jeu-classement .cl li').length === 2", timeout=8000)
    p2.click("#jeu-classement [data-m=quitte]")
    p2.wait_for_selector("#cl-fonde", timeout=8000)
    p2.wait_for_timeout(800)
    verifie("maison" not in profil("Berenice") and not p2.evaluate("Compte.profil().maison"), "maisons : quitter retire la maison du profil, en ligne et ici")
    p2.context.close(); page.context.close()
    # à 375 pixels, avec un profil : ni la barre ni les quatre onglets ne débordent, en français comme en anglais
    for adresse in ("index.html", "en.html"):
        ctx = browser.new_context(viewport={"width": 375, "height": 812}, locale="fr-FR", is_mobile=True, has_touch=True)
        ctx.add_init_script("try { localStorage.setItem('armorial.compte.v1', JSON.stringify({ profil: { pseudo: 'Testeur', armes: 't1=Azur&m=lion&nb=1&tm=Or', cree: '2026-11-04' }, carnets: {} })); localStorage.setItem('armorial.jeu.aide', '1'); } catch (e) {}")
        m = ctx.new_page(); m.goto(f"{base}/{adresse}"); m.wait_for_selector("#jeu-grille:not([hidden])", timeout=20000); m.wait_for_selector("#jeu-classement .onglets", state="attached", timeout=8000)
        m.click("#jx-classement"); m.wait_for_timeout(500)
        mes = m.evaluate("({ page: document.documentElement.scrollWidth, droite: document.querySelector('.jx-droite').getBoundingClientRect().right, onglets: [...document.querySelectorAll('#jeu-classement .onglets button')].every(b => b.scrollWidth <= b.clientWidth + 1) })")
        verifie(mes["page"] <= 375 and mes["droite"] <= 375 and mes["onglets"], f"téléphone/{adresse} : la barre et les onglets du classement tiennent ({mes})")
        ctx.close()

def test_jeu_en(browser, base):
    """le jeu en anglais (en.html) : même partie, mêmes carnets ; le français reste la clé, l'anglais ne sert qu'à l'affichage et à la saisie"""
    page, erreurs = ouvre(browser, base, "en.html", "#jeu-grille:not([hidden])")
    page.wait_for_selector("#jeu-ecu svg", timeout=10000)
    page.click("#dlg-aide .jx-go")
    verifie(page.evaluate("document.documentElement.lang") == "en" and page.inner_text(".jx-logo span") == "Shield of the Day", "jeu en anglais : la page s'appelle Shield of the Day")
    E = page.evaluate("({ n: EcuDuJour.N, cible: EcuDuJour.cible.nom, aff: EcuDuJour.cible.aff })")
    verifie(E["cible"] == ECUS["chevalier"], f"jeu en anglais : le même écu du jour que la page française ({E['cible']})")
    verifie(page.inner_text("#jeu-jour").startswith(f"Shield #{E['n']}") and "Knight" in page.inner_text("#jeu-niveaux"), "jeu en anglais : le numéro du jour et les niveaux sont traduits")
    manque = page.evaluate("""async () => { const T = await fetch("data/en/vocabulaire.json").then(r => r.json()), table = { e: "emaux", c: "compo", p: "pieces", m: "meubles" };
      return [...[...EcuDuJour.DETAILS.values()].filter(d => !T[table[d.cle[0]]][d.nom]).map(d => d.nom), ...EcuDuJour.CARTES.filter(c => !c.nomEn || !c.blasonEn).map(c => c.nom)]; }""")
    verifie(not manque, f"jeu en anglais : tout le vocabulaire du jeu et toutes ses cartes sont traduits ({manque[:8]})")
    # la saisie : le nom anglais, le nom français, le mot du blason anglais
    liste = lambda q: (page.fill("#jeu-nom", q), page.wait_for_timeout(50), page.inner_text("#jeu-liste") if page.locator("#jeu-liste li").count() else "")[2]
    verifie("Germany" in liste("germany") and "Germany" in liste("allemagne"), "jeu en anglais : une carte se trouve par son nom anglais ou français")
    verifie("Gules" in liste("gules") and "CLUE" in liste("gules").upper(), "jeu en anglais : un détail se demande avec le mot anglais")
    page.fill("#jeu-nom", "")
    # une réponse perdante au clavier : l'anglais à l'écran, le français dans le carnet
    c = page.evaluate("""(() => { const L = EcuDuJour.CARTES, c = L.find(x => x.nom !== x.aff && x.canon !== EcuDuJour.cible.canon && !L.some(y => y !== x && y.aff.toLowerCase().startsWith(x.aff.toLowerCase()))); return { nom: c.nom, aff: c.aff }; })()""")
    devine_au_clavier(page, c["aff"].lower())
    page.wait_for_selector(".essai .case", timeout=8000); page.wait_for_timeout(500)
    ligne = page.inner_text(".essai")
    verifie(c["aff"] in ligne and "TINCTURES" in ligne.upper() and "Émaux" not in ligne, f"jeu en anglais : la réponse s'affiche en anglais ({c['aff']})")
    verifie("Guess 2 of 6" in page.inner_text("#jeu-essais"), "jeu en anglais : le compteur d'essais est traduit")
    garde = page.evaluate(f"Compte.carnet('ecu').jours[{E['n']}].essais")
    verifie(garde == [c["nom"]], f"jeu en anglais : le carnet garde le nom français de la carte ({garde})")
    # la fin de la partie
    page.evaluate(PARTIE_JEU, E["cible"]); page.wait_for_selector("#jeu-resultat:not([hidden])", timeout=8000)
    res = page.inner_text("#jeu-resultat")
    verifie(f"These are the arms of {E['aff']}" in res and page.evaluate("EcuDuJour.cible.blasonEn") in res, "jeu en anglais : le résultat et le blasonnement sont en anglais")
    partage = page.evaluate("EcuDuJour.texteDePartage()")
    verifie(partage.startswith(f"Shield of the Day #{E['n']} · Knight — 2/6") and f"armorial.web.app/en.html?niveau=chevalier" in partage, "jeu en anglais : le partage est en anglais et mène à en.html")
    # changer de langue : la même partie, et le choix est gardé
    page.click("#jx-langue"); page.wait_for_selector("#jeu-grille:not([hidden])", timeout=20000)
    verifie(page.evaluate("document.documentElement.lang") == "fr" and "Trouvé en 2" in page.inner_text("#jeu-essais"), "jeu en anglais : le bouton FR montre la même partie en français")
    page.goto(f"{base}/lignees.html"); page.wait_for_selector("header.mast a")
    verifie(page.evaluate("document.documentElement.lang") == "fr" and page.locator(".bandeau-langue").count() == 0, "jeu en anglais : qui a choisi le français reste sur la page française, sans bandeau")
    page.goto(f"{base}/index.html"); page.wait_for_selector("#jx-langue", state="attached"); page.click("#jx-langue"); page.wait_for_url("**/en.html*", timeout=10000)
    page.goto(f"{base}/"); page.wait_for_url("**/en.html*", timeout=10000)
    verifie(True, "jeu en anglais : qui a choisi l'anglais revient à en.html depuis l'accueil")
    page.goto(f"{base}/lignees.html"); page.wait_for_url("**/en-lineages.html*", timeout=10000)
    verifie(True, "jeu en anglais : qui a choisi l'anglais est renvoyé vers la page anglaise")
    propre("jeu en anglais", page, erreurs)
    page.context.close()

FRANCAIS_FRISE = re.compile(r"\b(puis|règnes?|armes|écus?|jalon|sans|avec|depuis|devise|fils|mort|roi|reine|duc|blasonnement|couronne|collier|désaccord|figure dessinée|undefined|NaN)\b|\[object", re.I)
def francais_restant(textes, sources=()):
    """Les titres de pages citées (sources, entre guillemets) restent en français ; le reste ne doit plus l'être"""
    faux = []
    for t in textes:
        for s_ in sources: t = t.replace(s_, "")
        t = re.sub(r"“[^”]*”", "", t)
        m = FRANCAIS_FRISE.search(t)
        if m: faux.append(t[max(0, m.start() - 50):m.end() + 40])
    return faux

def test_lignees_en(browser, base):
    F = data("frises.json")
    for fr in F["frises"]:
        X = data(fr["file"].split("/")[-1])
        page, erreurs = ouvre(browser, base, f"en-lineages.html#{fr['id']}", "#royaumes .stage")
        page.wait_for_timeout(900)
        verifie(page.title().startswith("Lineages · ") and fr["nom"] not in page.title() or fr["nom"] in ("Portugal",), f"lignées en anglais/{fr['id']} : titre « {page.title()} »")
        jetons = sum(1 for R in X["royaumes"] for r in R["regnes"] if not r.get("suite"))
        verifie(page.locator("#royaumes .reign").count() == jetons, f"lignées en anglais/{fr['id']} : les {jetons} règnes sont sur la frise (même nombre qu'en français)")
        r = page.evaluate("""() => {
          const brut = h => { const d = document.createElement("div"); d.innerHTML = h; return d.textContent; };
          const out = [];
          for (const R of DATA.royaumes) {
            out.push(R.nom, R.titre, R.lede);
            for (const r of R.regnes) { out.push(tipReign(R, r)); if (r.devise) out.push(tipDevise(r)); for (const a of r.avant || []) out.push(tipAvant(a)); }
            for (const j of R.jalons) out.push(tipJalon(j));
            for (const r of R.rivaux || []) out.push(tipRival(r));
            for (const row of R.ornements || []) for (const s of row.segs) out.push(tipOrn(row, s));
            for (const s of R.segs) if (s.st) out.push(tipSeg(R, s));
            for (const g of R.grandesArmes || []) out.push(g.titre, ...g.ornements, g.note || "");
          }
          return { textes: out.map(brut), sources: Object.values(DATA.sources).map(s => s.label), interface: [...document.querySelectorAll(".stage .hint, .stage .controls, .stage .vtabs, .stage .panel .p-dates, .stage .side, .lp-bar")].map(e => e.textContent),
            blasons: Object.values(DATA.armes).filter(a => a.blason && !a.blasonEn).length, wiki: [...document.querySelectorAll(".rn")].every(a => a.href.startsWith("https://fr.wikipedia.org/wiki/")) };
        }""")
        faux = francais_restant(r["textes"] + r["interface"], r["sources"])
        verifie(not faux, f"lignées en anglais/{fr['id']} : plus de français dans les {len(r['textes'])} bulles ({len(faux)} ; {faux[:3]})")
        verifie(r["blasons"] == 0, f"lignées en anglais/{fr['id']} : chaque blasonnement a son anglais")
        verifie(r["wiki"], f"lignées en anglais/{fr['id']} : les noms mènent toujours à l'article français")
        propre(f"lignées en anglais/{fr['id']}", page, erreurs)
        page.context.close()
    page, erreurs = ouvre(browser, base, "en-lineages.html#papaute", "#royaumes .stage")
    page.wait_for_timeout(900)
    r = page.evaluate("""() => { const R = DATA.royaumes[0]; const p = R.regnes.find(x => x.num === 2); return { m: houseLine(R, p), date: fmt("1789-07-14"), siecle: document.querySelector(".wm").textContent, ob: obed("Pise"), court: R.regnes[265].court }; }""")
    verifie(r["m"].startswith("2nd pope") and r["date"] == "14 July 1789" and r["siecle"] == "1st" and r["ob"] == "Pisa obedience", f"lignées en anglais : rang, date et siècle s'écrivent en anglais ({r})")
    page.click("#lp-btn"); page.fill("#lp-q", "Burgundy")
    verifie(page.locator(".lp-it:not([hidden])").count() >= 1, "lignées en anglais : le sélecteur cherche en anglais")
    propre("lignées en anglais (papauté)", page, erreurs)
    page.context.close()

def test_transmission_en(browser, base):
    D = data("transmission.json")
    page, erreurs = ouvre(browser, base, "en-transmission.html", ".carte")
    cartes = sum(1 for n in D["noeuds"] if not n.get("apport"))
    verifie(page.locator(".carte").count() == cartes, f"transmission en anglais : une carte par état d'armes ({cartes}), comme en français")
    verifie("reading the tree" in page.inner_text("#panneau").lower() and "states of arms" in page.inner_text("#facts").lower(), "transmission en anglais : l'accueil du panneau et les chiffres sont en anglais")
    faux = page.evaluate("""async () => {
      const lus = [];
      for (const n of Transmission.noeuds) { location.hash = n.id; await new Promise(r => setTimeout(r, 12)); const c = document.querySelector("#panneau").cloneNode(true); c.querySelectorAll("a[target=_blank], .sr, .cr").forEach(x => x.remove()); lus.push(c.textContent); }
      return lus;
    }""")
    verifie(len(faux) == len(D["noeuds"]) and not francais_restant(faux), f"transmission en anglais : plus de français dans les {len(faux)} panneaux ({francais_restant(faux)[:3]})")
    liens = page.evaluate("""() => [...document.querySelectorAll("#panneau a[href]")].map(a => a.getAttribute("href")).filter(h => !h.startsWith("http"))""")
    verifie(not [h for h in liens if re.match(r"(lignees|atelier|encyclopedie)\.html", h)], f"transmission en anglais : les liens mènent aux pages anglaises ({liens[:4]})")
    page.goto(f"{base}/en-transmission.html#fr1"); page.wait_for_timeout(300)
    page.goto(f"{base}/en-transmission.html"); page.wait_for_selector(".carte")
    page.fill("#q", "Castile"); page.wait_for_selector("#res li button")
    verifie(page.locator("#res li button").count() >= 1, "transmission en anglais : on y cherche en anglais")
    propre("transmission en anglais", page, erreurs)
    page.context.close()
    page, erreurs = ouvre(browser, base, "en-search.html", "#q")
    page.wait_for_function("document.querySelector('#aide').textContent.includes('entries')", timeout=30000)
    r = page.evaluate("""() => Recherche.cherche("Castile").map(d => d.lien)""")
    verifie(any(h.startswith("en-lineages.html#") for h in r) and not any(h.startswith(("lignees.html", "transmission.html")) for h in r), f"recherche en anglais : les lignées se trouvent en anglais et mènent à leur page anglaise ({r[:3]})")
    propre("recherche en anglais (lignées)", page, erreurs)
    page.context.close()

def test_galeries_en(browser, base):
    """Blasons réels et Personnages en anglais : le texte traduit, les adresses des cartes et le lecteur de blasonnement restent ceux de la page française"""
    for page_en, page_fr, fichier in (("en-arms.html", "blasons.html", "blasons.json"), ("en-people.html", "personnages.html", "personnages.json")):
        page, erreurs = ouvre(browser, base, page_en, "#grid .ar .bl")
        page.wait_for_timeout(300)
        cartes = data(fichier)
        ids = page.evaluate("[...document.querySelectorAll('#grid .ar')].map(a => a.id)")
        verifie(page.evaluate("document.documentElement.lang") == "en" and len(ids) == len(cartes), f"{page_en} : toutes les cartes sont là ({len(ids)})")
        attendu = page.evaluate("fetch('data/en/cartes.json').then(r => r.json())")
        titres = page.evaluate("[...document.querySelectorAll('#grid .ar h3')].map(x => x.textContent)")
        verifie(all(attendu["noms"][c["nom"]] in titres for c in cartes), f"{page_en} : chaque carte porte son nom anglais")
        verifie(page.evaluate("[...document.querySelectorAll('#grid .ar .bl')].every(x => !/^(D'|De |Écartelé|Parti|Coupé)/.test(x.textContent))"), f"{page_en} : les blasonnements sont en anglais")
        fr = page.evaluate("[...document.querySelectorAll('#grid .ar .redo a')].filter(a => !a.getAttribute('href').includes('lire=')).length")
        verifie(fr == 0, f"{page_en} : « Redraw it in the Atelier » lit toujours le blasonnement français")
        verifie(page.locator(".mast-langue[data-langue='fr']").count() == 1, f"{page_en} : le lien FR est dans le bandeau")
        page.click(".mast-langue"); page.wait_for_url(f"**/{page_fr}*", timeout=10000); page.wait_for_selector("#grid .ar .bl", timeout=20000)
        verifie(page.evaluate("document.documentElement.lang") == "fr", f"{page_en} : le lien FR mène à {page_fr}")
        propre(page_en, page, erreurs)
        page.context.close()

def test_encyclopedie_en(browser, base):
    """l'encyclopédie en anglais : mêmes chapitres et mêmes adresses que la française, le texte traduit, le glossaire et la recherche en anglais"""
    page, erreurs = ouvre(browser, base, "en-encyclopedia.html", "#main .section")
    page.wait_for_selector("#glist .gloss-item", timeout=20000)
    fr = data("data.json")
    ids = page.evaluate("[...document.querySelectorAll('#main > .section')].map(s => s.id)")
    verifie(ids == [s["id"] for s in fr["sections"]] + ["glossaire", "bibliotheque"], f"encyclopédie en anglais : les mêmes chapitres, aux mêmes adresses ({len(ids)})")
    verifie(page.evaluate("document.documentElement.lang") == "en" and page.inner_text("h1.display") == "THE ART OF HERALDRY" or page.inner_text("h1.display").lower() == "the art of heraldry", "encyclopédie en anglais : le titre est traduit")
    verifie(page.locator("#un-signe-pour-reconnaitre-le-chevalier h3").inner_text() == "A sign to recognise the knight", "encyclopédie en anglais : un article garde son adresse française, son titre est anglais")
    verifie(page.locator("#origines .plate h2").inner_text().lower() == "where heraldry comes from", "encyclopédie en anglais : le titre du chapitre est traduit")
    verifie(page.locator(f"#{json.dumps('terme-gueules')[1:-1]} dt").inner_text() == "Gules (gueules)", "encyclopédie en anglais : un terme du glossaire garde son adresse, avec l'anglais et le français")
    # la recherche, en anglais et en français ; un mot pris dans une balise ne casse pas la définition
    page.fill("#q", "gules"); page.wait_for_timeout(150)
    verifie("Gules (gueules)" in page.inner_text("#sresults"), "encyclopédie en anglais : la recherche trouve le mot anglais")
    page.fill("#q", "gueules"); page.wait_for_timeout(150)
    verifie("Gules (gueules)" in page.inner_text("#sresults"), "encyclopédie en anglais : la recherche trouve le mot français")
    page.fill("#q", "lang"); page.wait_for_timeout(150)
    verifie(page.locator("#glist mark").count() >= 0 and 'lang="fr"' not in page.inner_text("#glist"), "encyclopédie en anglais : surligner ne casse pas les balises des définitions")
    page.fill("#q", ""); page.wait_for_timeout(150)
    # une figure : le nom anglais, le français dessous
    verifie(page.locator(".gal.tinct .fig").first.locator(".nom").inner_text() == "Or" and "Azure" in page.locator(".gal.tinct").inner_text(), "encyclopédie en anglais : les émaux ont leur nom anglais")
    verifie(page.locator(".mast-langue[data-langue='fr']").get_attribute("href") == "encyclopedie.html", "encyclopédie en anglais : le lien FR mène à la page française")
    propre("encyclopédie en anglais", page, erreurs)
    page.context.close()

def test_blason_en(browser, base):
    """le blasonnement anglais : chaque meuble a son nom, et aucun mot français ne reste sur des écus tirés au hasard, dans toutes les poses"""
    page, erreurs = ouvre(browser, base, "en-daily.html", "#jj .jj-ecu")
    r = page.evaluate("""() => {
      const textes = [], rng = Gen.mulberry(4242);
      for (let i = 0; i < 900; i++) textes.push(blazonAllEn(Gen.tireArmes(rng, 1 + i % 3)));
      for (const m of ATL.meubles) for (const nb of ["1", "3", "seme"]) { const St = fresh(); St.A[0] = { ...ADEF, t1: "Azur", m: m.kind, nb, tm: "Or", ta: "Gueules" }; normalizeAll(St); textes.push(blazonAllEn(St)); }
      for (const p of Object.keys(PIECES)) for (const ln of ["", "onde"]) for (const pos of ["autour", "sur", "sous"]) { const St = fresh(); St.A[0] = { ...ADEF, t1: "Argent", p, tp: "Gueules", ln, m: "lion", nb: "1", pos, tm: "Or", ta: "Azur" }; normalizeAll(St); textes.push(blazonAllEn(St)); }
      for (const q of ["2", "4", "p", "c", "t", "l"]) { const St = fresh(); St.q = q; St.ab = "1"; normalizeAll(St); textes.push(blazonAllEn(St)); }
      for (const ray of RAYS) for (const n of rayNs(ray)) { const St = fresh(); St.A[0] = { ...ADEF, f: "ray", ray, n, t1: "Or", t2: "Gueules", m: "" }; normalizeAll(St); textes.push(blazonAllEn(St)); }
      for (const pt of DATA.partitions) { const St = fresh(); St.A[0] = { ...ADEF, f: "part", part: pt.kind, t1: "Or", t2: "Gueules", t3: "Azur", m: "" }; normalizeAll(St); textes.push(blazonAllEn(St)); }
      return { manque: ATL.meubles.filter(m => !MEUBLE_EN[m.kind]).map(m => m.kind), textes };
    }""")
    verifie(not r["manque"], f"blasonnement anglais : chaque meuble a son nom anglais ({r['manque'][:6]})")
    francais = re.compile(r"\\b(de|du|des|le|la|les|au|aux|un|une|et|à|chargé|accompagné|sur|brochant|plein|mouvant|armé|lampassé|couronné|undefined|NaN)\\b|\\bd'|\\bl'", re.I)
    faux = [t for t in r["textes"] if francais.search(t.replace("fleur-de-lis", "").replace("fleurs-de-lis", ""))]
    verifie(not faux, f"blasonnement anglais : aucun mot français sur {len(r['textes'])} écus ({faux[:3]})")
    propre("blasonnement anglais", page, erreurs)
    page.context.close()

def test_jeux_du_jour_en(browser, base):
    """L'Intrus et le blasonnement à trous en anglais : les mêmes écus que la page française, le texte en anglais"""
    fr, e0 = ouvre(browser, base, "jour.html#intrus", "#jj .jj-ecu")
    ecus_fr = fr.evaluate("JeuDuJour.M[0].ecus.map(e => blazonAll(e.St))")
    fr.goto(f"{base}/jour.html#trous"); fr.wait_for_selector("#jj select.jj-trou", timeout=20000)      # changer de jeu recharge la page (hashchange)
    trou_fr = fr.evaluate("blazonAll(JeuDuJour.Q.St)")
    fr.context.close()
    page, erreurs = ouvre(browser, base, "en-daily.html#intrus", "#jj .jj-ecu")
    verifie(page.evaluate("JeuDuJour.M[0].ecus.map(e => blazonAll(e.St))") == ecus_fr, "jeux du jour en anglais : L'Intrus tire les mêmes écus")
    verifie("Round 1 of 5" in page.inner_text("#jj") and "rule of tincture" in page.inner_text(".jj-ask"), "jeux du jour en anglais : L'Intrus est en anglais")
    page.click(".jj-ecu[data-k='0']"); page.wait_for_selector(".jj-fb")
    faute = page.inner_text(".jj-fb")
    verifie(("Metal on metal" in faute or "Colour on colour" in faute or "same tincture" in faute) and " sur " not in faute, f"jeux du jour en anglais : la faute est dite en anglais ({faute[:120]})")
    verifie(page.locator("#jx-langue[data-langue='fr']").count() == 1, "jeux du jour en anglais : le bouton FR est là")
    page.context.close()
    page, erreurs = ouvre(browser, base, "en-daily.html#trous", "#jj select.jj-trou")
    verifie(page.evaluate("blazonAll(JeuDuJour.Q.St)") == trou_fr, "jeux du jour en anglais : à trous tire le même écu")
    verifie(page.evaluate("JeuDuJour.Q.trous.length") >= 3 and page.evaluate("JeuDuJour.Q.trous.every(c => c.options.includes(c.juste))"), "jeux du jour en anglais : les trous ont leur réponse parmi les choix")
    # sur 200 tirages : les trous français se retrouvent tous dans le texte anglais, au bon endroit
    r = page.evaluate("""() => { const pb = []; for (let g = 1; g <= 200; g++) { const q = JeuDuJour.essaiTrous(g); if (!q) continue; if (q.trous.length < 3) pb.push([g, q.texte, q.trous.length]); for (const c of q.trous) if (q.texte.slice(c.i, c.j) !== c.juste || !c.options.includes(c.juste) || new Set(c.options).size < 3) pb.push([g, q.texte, c.juste, c.options]); } return pb; }""")
    verifie(not r, f"jeux du jour en anglais : 200 tirages de trous corrects ({r[:3]})")
    # une partie : tout juste du premier coup
    for k, juste in enumerate(page.evaluate("JeuDuJour.Q.trous.map(c => c.juste)")):
        page.select_option(f"select.jj-trou[data-k='{k}']", juste)
    page.click("#jj-ok"); page.wait_for_selector("#jj-resultat:not([hidden])", timeout=8000)
    verifie("First try" in page.inner_text("#jj-resultat"), "jeux du jour en anglais : la partie se termine en anglais")
    verifie("Fill in the Blazon" in page.evaluate("document.title"), "jeux du jour en anglais : le titre est traduit")
    propre("jeux du jour en anglais", page, erreurs)
    page.context.close()

FRANCAIS_EN = re.compile(r"\b(de|du|des|le|la|les|au|aux|une|et|sur|chargé|accompagné|brochant|mouvant|armé|lampassé|couronné|meuble|meubles|émail|écu|pièce|undefined|NaN)\b|\bd'|\bl'|\[object", re.I)

def test_exercices_en(browser, base):
    """S'exercer en anglais : les mêmes tirages que la page française (le défi du jour reste commun), tout le texte montré en anglais"""
    graines = "[...Array(60).keys()].map(i => i + 1)"
    tirage = f"""async () => {{ const out = []; for (const seed of {graines}) {{ const a = await Exercices.fabrique("lire", 1 + seed % 3, seed), b = await Exercices.fabrique("vocab", 2, seed), c = await Exercices.fabrique("regle", 2, seed), d = await Exercices.fabrique("points", 1, seed);
      out.push([Gen.empreinte(a.St), a.choix.map(x => x.ok), b.cible.terme, b.choix.map(x => x.ok), Gen.empreinte(c.St), d.r, d.c]); }} return out; }}"""
    fr, e0 = ouvre(browser, base, "exercices.html", ".ex-carte")
    attendu = fr.evaluate(tirage); fr.context.close()
    page, erreurs = ouvre(browser, base, "en-practice.html", ".ex-carte")
    verifie(page.evaluate(tirage) == attendu, "exercices en anglais : les tirages sont ceux de la page française")
    verifie(page.locator(".ex-carte").count() == 7 and "Read a shield" in page.inner_text("#ex-cartes"), "exercices en anglais : le menu est en anglais")
    r = page.evaluate("""async () => {
      const faux = [], textes = [], doublons = [];
      for (let seed = 1; seed <= 90; seed++) {
        const a = await Exercices.fabrique("lire", 1 + seed % 3, seed), b = await Exercices.fabrique("vocab", 1 + seed % 3, seed), c = await Exercices.fabrique("regle", 1 + seed % 3, seed), d = await Exercices.fabrique("reel", 1, seed);
        textes.push(...a.choix.map(x => x.texte), ...(c.fautes || []), c.texte, b.def, ...c.paires.map(p => p.quoi + " " + p.lieu));
        if (new Set(a.choix.map(x => x.texte)).size < a.choix.length) doublons.push(a.choix.map(x => x.texte));
        if (new Set(b.choix.map(x => x.texte)).size < b.choix.length) doublons.push(b.choix.map(x => x.texte));
        if (new Set(d.choix.map(x => x.texte)).size < d.choix.length) doublons.push(d.choix.map(x => x.texte));
        if (!b.cible.defEn || !b.cible.termeEn || /[<>]/.test(b.def)) faux.push(b.cible.terme);
        const nu = b.cible.termeEn.replace(/\\(.*?\\)/g, "").trim().toLowerCase();
        if (nu.length > 3 && b.def.toLowerCase().includes(nu)) faux.push("visible : " + nu);
      }
      return { faux, textes, doublons };
    }""")
    verifie(not r["faux"], f"exercices en anglais : chaque terme a son anglais, et la définition ne le donne pas ({r['faux'][:4]})")
    verifie(not r["doublons"], f"exercices en anglais : quatre réponses distinctes en anglais ({r['doublons'][:2]})")
    faux = [t for t in r["textes"] if FRANCAIS_EN.search(t.replace("fleur-de-lis", "").replace("fleurs-de-lis", "").replace("▁▁▁▁", ""))]
    print(f"    (exercices en anglais : {len(faux)} textes à relire sur {len(r['textes'])} : {faux[:4]})")
    # une série de chaque exercice : la réponse et l'explication sont en anglais
    for ident, attendu_txt in (("lire", "The blazon of this shield"), ("dessiner", "The blazon"), ("regle", "Reread the chapter"), ("vocab", "glossary"), ("points", "marked point")):
        page.goto(f"{base}/en-practice.html#{ident}"); page.reload(); page.wait_for_selector(".ex-q .ex-c", timeout=20000)
        page.locator(".ex-q .ex-c").first.click(); page.wait_for_selector(".ex-fb.ok, .ex-fb.ko")
        fb = page.inner_text("#ex-fb")
        verifie(attendu_txt in fb and ("Well spotted" in fb or "Not quite" in fb), f"exercices en anglais : {ident}, l'explication est en anglais ({fb[:100]!r})")
        verifie(page.locator("#ex-fb a[href*='encyclopedie.html'], #ex-fb a[href^='atelier.html'], #ex-fb a[href^='blasons.html']").count() == 0, f"exercices en anglais : {ident}, les liens mènent aux pages anglaises")
    verifie(page.evaluate("document.documentElement.lang") == "en" and page.locator(".mast-langue[data-langue='fr']").count() == 1, "exercices en anglais : le lien FR est là")
    propre("exercices en anglais", page, erreurs)
    page.context.close()

def test_atelier_en(browser, base):
    """l'Atelier en anglais : les libellés et le blasonnement en anglais, l'état et le champ de saisie en français"""
    page, erreurs = ouvre(browser, base, "en-atelier.html", "#blz:not(:empty)")
    r = page.evaluate("""() => {
      const lib = [...document.querySelectorAll("#panel legend, #panel .lab, #panel label, #panel option:not(#reel option), #panel .note, #panel optgroup:not(#reel optgroup)")].map(e => e.label || e.textContent.trim()).filter(Boolean);
      lib.push(...Object.values(PLEIN).flat().map(d => libelle(d.lab)), ...Object.values(SHAPES).map(v => libelle(v.nom)), ...Object.values(DEVISES).map(v => libelle(v.nom)), ...ATL.ornements.couronnes.map(c => libelle(c.nom)), ...ATL.ornements.colliers.map(c => libelle(c.nom)), ...Object.values(BRIS_PIECES).map(v => libelle(v.nom)));
      const noms = ATL.meubles.map(nomMeubleLu);
      return { lib: [...new Set(lib)], noms, doublons: noms.filter((n, i) => noms.indexOf(n) !== i), attributs: ATL.meubles.filter(m => m.accentMot && !m.accentLabel && !ACCENT_EN[m.accentMot] && m.accentMot !== "et").map(m => m.accentMot) };
    }""")
    faux = [t for t in r["lib"] if FRANCAIS_EN.search(re.sub(r"fleurs?-de-lis", "", t, flags=re.I).replace("(de l'un en l'autre)", "").replace("(de l'un à l'autre)", "").replace("D'azur à trois fleurs de lis d'or", "")) or re.search(r"[éèêàç]", t.replace("Contourné", "").replace("semé", "").replace("(de l'un à l'autre)", "").replace("Semé", ""))]
    verifie(not faux, f"atelier en anglais : aucun libellé français ({len(r['lib'])} libellés ; {faux[:8]})")
    verifie(not r["doublons"], f"atelier en anglais : chaque meuble a un nom distinct ({r['doublons'][:5]})")
    verifie(not r["attributs"], f"atelier en anglais : chaque attribut a son mot ({r['attributs'][:5]})")
    # les exemples : blasonnement, ornements et crédits en anglais ; l'état reste français
    textes = page.evaluate("""async () => { const out = []; const bs = [...document.querySelectorAll("#examples button")];
      for (const b of bs) { b.click(); await new Promise(r => setTimeout(r, 120)); out.push($("#blz").textContent, $("#orn").textContent, $("#warn").textContent, $("#credits").textContent.replace(/“[^”]*”/g, "")); } return out; }""")
    faux = [t for t in textes if t and FRANCAIS_EN.search(re.sub(r"fleurs?-de-lis", "", t, flags=re.I))]
    verifie(not faux, f"atelier en anglais : les {len(textes) // 4} exemples s'écrivent en anglais ({faux[:3]})")
    # le champ de saisie lit le français, et le blasonnement s'écrit en anglais
    page.fill("#lire", "D'azur à trois fleurs de lis d'or"); page.click("#b-lire"); page.wait_for_selector("#lire-etat.ok")
    verifie("Understood" in page.inner_text("#lire-etat") and page.inner_text("#blz") == "Azure, three fleurs-de-lis or", f"atelier en anglais : un blasonnement français tapé donne l'écu ({page.inner_text('#blz')!r})")
    page.fill("#lire", "Azure, three stars or"); page.click("#b-lire"); page.wait_for_selector("#lire-etat.ko")
    verifie("Not understood" in page.inner_text("#lire-etat"), "atelier en anglais : un texte anglais est signalé, sans rien deviner")
    page.click("#b-recopier"); page.wait_for_selector("#lire-etat.ok")
    verifie(page.input_value("#lire") == "D'azur à trois fleurs de lis d'or", f"atelier en anglais : on reprend le blasonnement en français ({page.input_value('#lire')!r})")
    # le lien de partage ne dépend pas de la langue
    page.locator("#examples button").nth(1).click(); page.wait_for_function("location.hash.includes('Gueules')")
    verifie("Gules" not in page.url, f"atelier en anglais : l'adresse garde l'état français ({page.url[-60:]})")
    # une carte : son nom est en anglais
    page.goto(f"{base}/en-atelier.html#lire=" + urllib.parse.quote("D'azur à trois fleurs de lis d'or") + "&de=blasons:royaume-de-france-moderne"); page.reload(); page.wait_for_selector("#origine:not([hidden]) .or-etat", timeout=20000)
    origine = page.inner_text("#origine")
    verifie("These are the arms on the card" in origine and "real arms" in origine.lower(), f"atelier en anglais : la carte d'origine est en anglais ({origine[:100]!r})")
    # les galeries y mènent
    g, e2 = ouvre(browser, base, "en-arms.html", ".redo a")
    verifie(g.locator(".redo a[href^='atelier.html']").count() == 0 and g.locator(".redo a[href^='en-atelier.html']").count() > 0, "atelier en anglais : les cartes anglaises mènent à l'Atelier anglais")
    g.context.close()
    # le jeu du jour : la même cible que la page française, le texte en anglais
    fr, e0 = ouvre(browser, base, "atelier.html#defi=dessin", "#defi-ok")
    cible = fr.evaluate("Gen.empreinte(DessineMoi.cible)"); fr.context.close()
    d, e1 = ouvre(browser, base, "en-atelier.html#defi=dessin", "#defi-ok")
    verifie(d.evaluate("Gen.empreinte(DessineMoi.cible)") == cible, "Draw It for Me : la même cible que Dessine-moi")
    verifie("draw it for me" in d.inner_text("#defi").lower() and d.inner_text("h1").lower() == "draw it for me" and "attempt 1 of 3" in d.inner_text("#defi").lower(), f"Draw It for Me : la page est en anglais ({d.inner_text('#defi')[:120]!r})")
    d.click("#defi-ok"); d.wait_for_selector(".defi-essais li")
    verifie("attempt 1" in d.inner_text(".defi-essais").lower() and "the field" in d.inner_text(".defi-essais").lower(), f"Draw It for Me : l'essai se lit en anglais ({d.inner_text('.defi-essais')[:80]!r})")
    propre("Draw It for Me", d, e1)
    d.context.close()
    propre("atelier en anglais", page, erreurs)
    page.context.close()

def test_recherche_en(browser, base):
    """la recherche en anglais : on trouve par l'anglais et par le français, et les résultats mènent aux pages anglaises"""
    page, erreurs = ouvre(browser, base, "en-search.html", "#aide")
    page.wait_for_function("window.Recherche", timeout=20000)
    r = page.evaluate("Recherche.cherche('gules')[0]")
    verifie(r["titre"] == "Gules (gueules)" and r["lien"].startswith("en-encyclopedia.html#terme-gueules"), f"recherche en anglais : un mot anglais mène au glossaire anglais ({r})")
    r = page.evaluate("Recherche.cherche('allemagne').find(x => x.type === 'bla')")
    verifie(r and r["titre"] == "Germany" and r["lien"] == "en-arms.html#allemagne", f"recherche en anglais : un nom français trouve la carte, affichée en anglais ({r})")
    page.fill("#q", "germany"); page.wait_for_selector("#res .r", timeout=5000)
    verifie("result" in page.inner_text("#cpt") and page.locator("#types .chip").first.inner_text().startswith("All"), "recherche en anglais : le résultat s'affiche en anglais")
    page.click("#res .r-t"); page.wait_for_url("**/en-*.html#*", timeout=10000)
    verifie("en-" in page.url, f"recherche en anglais : un résultat ouvre une page anglaise ({page.url})")
    propre("recherche en anglais", page, erreurs)
    page.context.close()

def test_404_en(browser, base):
    """la page 404 suit le choix du lecteur"""
    page, erreurs = ouvre(browser, base, "404.html", "h1")
    verifie(page.inner_text("h1").lower() == "page introuvable", "404 : en français par défaut")
    page.evaluate("localStorage.setItem('armorial.langue', 'en')"); page.reload(); page.wait_for_selector("h1")
    verifie(page.inner_text("h1").lower() == "page not found" and page.evaluate("document.documentElement.lang") == "en" and page.locator(".bandeau-langue").count() == 0, "404 : en anglais pour qui lit en anglais")
    verifie(page.locator(".perdu .liens a[href='en.html']").count() == 1, "404 : les liens mènent aux pages anglaises")
    page.context.close()

def test_jeux_du_jour(browser, base):
    """L'Intrus, le blasonnement à trous (jour.html) et Dessine-moi (atelier.html#defi=dessin) : tirés de la graine du jour"""
    page, erreurs = ouvre(browser, base, "jour.html#intrus", ".jj-ecu")
    M = page.evaluate("JeuDuJour.M.map(m => ({ n: m.ecus.length, faux: m.ecus.filter(e => e.faux).length, fautes: ruleAll(m.ecus.find(e => e.faux).St).length, bons: m.ecus.filter(e => !e.faux).every(e => !ruleAll(e.St).length) }))")
    verifie(len(M) == 5 and all(m["n"] == 4 and m["faux"] == 1 and m["fautes"] > 0 and m["bons"] for m in M), "jeux du jour : L'Intrus a cinq manches de quatre écus, un seul enfreint la règle")
    for i in range(5):
        page.evaluate("async i => JeuDuJour.repond(i, JeuDuJour.M[i].ecus.findIndex(e => e.faux))", i)
        if i < 4: page.click("#jj-suite")
    page.wait_for_selector("#jj-resultat:not([hidden])", timeout=5000)
    c = page.evaluate("Compte.carnet('intrus')")
    verifie(c["stats"]["gagnes"] == 1 and c["stats"]["rep"][5] == 1, "jeux du jour : cinq intrus trouvés font une victoire « 5/5 »")
    page.wait_for_selector("#jj-classement .cl-t", timeout=8000)
    verifie("1ʳᵉ" in page.inner_text("#jj-classement"), "jeux du jour : la fin de partie montre le classement du jour et la place du joueur")
    propre("jeux du jour (L'Intrus)", page, erreurs)
    page.context.close()
    page, erreurs = ouvre(browser, base, "jour.html#trous", "select.jj-trou")
    Q = page.evaluate("JeuDuJour.Q.trous.map(t => t.options.includes(t.juste))")
    verifie(3 <= len(Q) <= 4 and all(Q), f"jeux du jour : le blasonnement à trous a trois ou quatre trous, la bonne réponse parmi les choix ({len(Q)})")
    page.evaluate("() => document.querySelectorAll('select.jj-trou').forEach(s => { s.value = JeuDuJour.Q.trous[+s.dataset.k].juste; s.dispatchEvent(new Event('change')); })")
    page.click("#jj-ok"); page.wait_for_selector("#jj-resultat:not([hidden])", timeout=5000)
    verifie(page.evaluate("JeuDuJour.J.gagne && JeuDuJour.J.essais.length === 1"), "jeux du jour : les bons mots du premier coup gagnent en un essai")
    propre("jeux du jour (à trous)", page, erreurs)
    page.context.close()
    page, erreurs = ouvre(browser, base, "atelier.html#defi=dessin", "#defi-ok")
    verifie(page.locator("#lire").is_hidden() and page.locator("#blz").is_hidden() and page.locator("#examples").is_hidden(), "jeux du jour : en défi, l'Atelier cache la lecture, les exemples et le blasonnement en cours")
    page.click("#defi-ok"); page.wait_for_selector(".defi-essais li", timeout=5000)
    verifie(page.locator(".defi-essais li").count() == 1 and "#defi=dessin" in page.url, "jeux du jour : un essai faux est dit trait par trait, et l'adresse ne livre pas l'écu")
    page.evaluate("async () => { S = JSON.parse(JSON.stringify(DessineMoi.cible)); await render(); }")
    page.click("#defi-ok"); page.wait_for_selector(".defi-fin.ok", timeout=5000)
    verifie(page.evaluate("Compte.carnet('dessin').stats.gagnes") == 1, "jeux du jour : Dessine-moi gagné au deuxième essai")
    propre("jeux du jour (Dessine-moi)", page, erreurs)
    page.context.close()

# ------------------------------------------------------------------ Rechercher
def test_recherche(browser, base):
    page, erreurs = ouvre(browser, base, "recherche.html#q=lambel", ".r")
    verifie(page.locator(".r").count() >= 5 and page.locator(".r-ty[data-t=glo]").count() >= 1, "recherche : « lambel » trouve le glossaire et des articles")
    verifie(page.locator(".chip").count() >= 3, "recherche : les rubriques proposent leur nombre de résultats")
    page.fill("#q", "zzzzzz"); page.wait_for_selector(".r-vide", timeout=5000)
    verifie(True, "recherche : une requête sans réponse le dit")
    liens = page.evaluate("""() => { const out = new Set(); for (const q of ["a", "e", "i", "o", "u", "er", "on", "ou", "lion", "lis", "gueules"]) Recherche.cherche(q).forEach(r => out.add(r.lien)); return [...out]; }""")
    # chaque lien doit mener à une ancre qui existe : on charge les pages visées une fois, et on lit leurs adresses
    ancres = {}
    for cible in ("encyclopedie.html", "blasons.html", "personnages.html"):
        pg, er = ouvre(browser, base, cible, "main .section, .ar" if cible == "encyclopedie.html" else ".ar")
        pg.wait_for_timeout(800)
        ancres[cible] = set(pg.evaluate("[...document.querySelectorAll('[id]')].map(e => e.id)"))
        pg.context.close()
    frises = {f["id"] for f in data("frises.json")["frises"]}
    transmission = {n["id"] for n in data("transmission.json")["noeuds"]}
    manquants = []
    for l in liens:
        page_, _, a = l.partition("#")
        if page_ in ancres: ok = a in ancres[page_]
        elif page_ == "lignees.html": ok = a in frises
        elif page_ == "transmission.html": ok = a in transmission
        else: ok = False
        if not ok: manquants.append(l)
    verifie(not manquants, f"recherche : les {len(liens)} liens de résultats mènent à une ancre qui existe" + ("" if not manquants else f" — {manquants[:5]}"))
    propre("recherche", page, erreurs)
    page.context.close()
    # l'adresse d'une carte de galerie mène à la carte, même si un filtre la cache
    page, erreurs = ouvre(browser, base, "blasons.html#" + "royaume-de-france-moderne", ".ar.flash")
    verifie(page.locator(".ar.flash").count() == 1, "galerie : l'adresse d'une carte mène à la carte")
    propre("blasons#carte", page, erreurs)
    page.context.close()

# ------------------------------------------------------------------ La transmission des armes
def test_transmission(browser, base):
    D = data("transmission.json")
    page, erreurs = ouvre(browser, base, "transmission.html", ".carte")
    cartes = sum(1 for n in D["noeuds"] if not n.get("apport"))
    verifie(page.locator(".carte").count() == cartes, f"transmission : une carte par état d'armes ({cartes}) ; les maisons en apport n'ont pas de carte")
    if page.locator(".carte[data-id=art]").is_hidden():      # Artois est sous une branche repliée : on déplie ses ancêtres
        for plus in page.locator(".plus[aria-expanded=false]").all():
            if plus.is_visible(): plus.click(); page.wait_for_timeout(100)
            if page.locator(".carte[data-id=art]").is_visible(): break
    page.click(".carte[data-id=art]"); page.wait_for_timeout(250)
    verifie("châteaux" in page.inner_text("#panneau") and "pourquoi" in page.inner_text("#panneau").lower(), "transmission : un clic montre ce qui change dans l'écu et pourquoi (Artois et ses châteaux)")
    page.click(".chip[data-t=mariage]"); page.wait_for_timeout(250)
    verifie(0 < page.locator(".nd.dim").count() < len(D["noeuds"]), "transmission : choisir un type de passage estompe les autres branches")
    verifie(page.locator("#credits li").count() >= 30, "transmission : les crédits de toutes les figures sont en bas de page")
    propre("transmission", page, erreurs)
    page.context.close()
    page, erreurs = ouvre(browser, base, "transmission.html#arag", "#panneau .tete")
    verifie("une maison qui entre dans l'écu d'une autre" in page.inner_text("#panneau").lower(), "transmission : l'adresse d'une maison en apport (Aragon) ouvre sa fiche")
    page.context.close()
    page, erreurs = ouvre(browser, base, "transmission.html#bven", ".carte.on")
    verifie(page.locator(".carte.on").count() == 1, "transmission : l'adresse d'une branche profonde déplie le chemin et la sélectionne")
    page.context.close()


def main():
    random.seed(1)
    n_fuzz = int(os.environ.get("FUZZ", 60))                 # FUZZ=500 pour une vérification plus poussée
    srv, base = serveur()
    srv2, base_en_ligne = serveur_en_ligne()
    with sync_playwright() as p:
        browser = lance(p)
        for nom, f in (("index", lambda: test_index(browser, base)),
                       ("blasons", lambda: test_galerie(browser, base, "blasons.html", "blasons.json", "blasons")),
                       ("personnages", lambda: test_galerie(browser, base, "personnages.html", "personnages.json", "personnages")),
                       ("lignées", lambda: test_lignees(browser, base)),
                       ("atelier", lambda: test_atelier(browser, base, n_fuzz)),
                       ("atelier (lien truqué)", lambda: test_atelier_adresse_truquee(browser, base)),
                       ("lecture", lambda: test_lecture(browser, base, n_fuzz)),
                       ("boutons blasons", lambda: test_boutons(browser, base, "blasons.html", "blasons.json", BLASONS_LISIBLES, BLASONS_REFUSES, "blasons")),
                       ("boutons personnages", lambda: test_boutons(browser, base, "personnages.html", "personnages.json", PERSONNAGES_LISIBLES, PERSONNAGES_REFUSES, "personnages")),
                       ("partir d'un blason réel", lambda: test_partir(browser, base)),
                       ("jeu", lambda: test_jeu(browser, base_en_ligne)),
                       ("maisons", lambda: test_maisons(browser, base_en_ligne)),
                       ("archives", lambda: test_archives(browser, base_en_ligne)),
                       ("mon armorial et image", lambda: test_mon_armorial_et_image(browser, base_en_ligne)),
                       ("retour", lambda: test_retour(browser, base_en_ligne)),
                       ("jeu en anglais", lambda: test_jeu_en(browser, base_en_ligne)),
                       ("galeries en anglais", lambda: test_galeries_en(browser, base)),
                       ("encyclopédie en anglais", lambda: test_encyclopedie_en(browser, base)),
                       ("blasonnement anglais", lambda: test_blason_en(browser, base_en_ligne)),
                       ("jeux du jour en anglais", lambda: test_jeux_du_jour_en(browser, base_en_ligne)),
                       ("exercices en anglais", lambda: test_exercices_en(browser, base_en_ligne)),
                       ("atelier en anglais", lambda: test_atelier_en(browser, base_en_ligne)),
                       ("lignées en anglais", lambda: test_lignees_en(browser, base)),
                       ("transmission en anglais", lambda: test_transmission_en(browser, base)),
                       ("recherche en anglais", lambda: test_recherche_en(browser, base)),
                       ("404 en anglais", lambda: test_404_en(browser, base)),
                       ("jeux du jour", lambda: test_jeux_du_jour(browser, base_en_ligne)),
                       ("exercices", lambda: test_exercices(browser, base)),
                       ("recherche", lambda: test_recherche(browser, base)),
                       ("transmission", lambda: test_transmission(browser, base)),
                       ("téléphone", lambda: test_telephone(browser, base))):
            try: f()
            except Exception as e: ko(f"{nom} : exception du test — {e}")
        browser.close()
    srv.shutdown()
    print("\n".join(lignes))
    print(f"\n{len(lignes) - len(echecs)} contrôles réussis, {len(echecs)} échec(s)")
    sys.exit(1 if echecs else 0)

if __name__ == "__main__":
    main()
