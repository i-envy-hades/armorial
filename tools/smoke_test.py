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
les boutons « Redessiner dans l'Atelier » et les écus cliquables des galeries, « Partir d'un blason réel » dans l'Atelier, les pages S'exercer (chaque question posée est cohérente), Rechercher
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
def ko(msg): lignes.append(f"  ECHEC {msg}"); echecs.append(msg)
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
MENU = re.findall(r'\["(\w+)",\s*"([\w.-]+\.html)",\s*"([^"]+)"', (ROOT / "assets" / "chrome.js").read_text(encoding="utf-8"))      # (identifiant, fichier, libellé) du bandeau

# ------------------------------------------------------------------ pages
def test_index(browser, base):
    D = data("data.json")
    page, erreurs = ouvre(browser, base, "index.html", "#main .section")
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
    page, erreurs = ouvre(browser, base, "index.html#emaux", "#main .section")
    page.wait_for_timeout(2500)          # le temps que les polices arrivent et que la page se replace
    haut = page.evaluate("document.getElementById('emaux').getBoundingClientRect().top")
    verifie(60 < haut < 80, f"index#emaux : la page se place sur le chapitre, sous le bandeau (haut à {haut:.0f} px)")
    propre("index#emaux", page, erreurs)
    page.context.close()
    # une ancre mal formée ne casse rien
    page, erreurs = ouvre(browser, base, "index.html#%E0%A4%A", "#main .section")
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
    ({"A0": {"t1": "Azur", "m": "croissant", "nb": "1", "tm": "Or", "ct": "1"}}, "D'azur au croissant d'or"),   # un croissant ne se contourne pas par simple retournement : le réglage est ignoré
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
    ({"A0": {"t1": "Or", "m": "epee", "nb": "1", "tm": "Argent", "p": "franc-quartier", "tp": "Azur", "pos": "sur"}}, "D'or au franc-quartier d'azur chargé d'une épée d'argent"),
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
    ("D'azur au croissant contourné d'or", "ne se contourne pas"),
    ("D'azur à trois croissants d'or contournés", "ne se contourne pas"),
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
                    "Canton d'Appenzell Rhodes-Intérieures", "Duché de Limbourg", "Bosnie-Herzégovine", "Canton d'Uri", "Norvège"]
# (le Saint-Empire est relu depuis que les aigles acceptent « becquée et membrée » seules, dit en réserve ; les Médicis restent refusés : tourteau de France chargé de trois lis)
BLASONS_REFUSES = ["Royaume de Grenade", "Maison de Médicis"]
PERSONNAGES_LISIBLES = ["Édouard III d'Angleterre", "Edmond FitzAlan (2e comte d'Arundel)",
                        "John FitzAlan", "Richard FitzAlan", "Pie II", "Jacques Cœur", "Paul IV", "Nanker", "Jean-Baptiste Colbert", "Bertrand du Guesclin", "Ferdinand de Bulgarie", "Haakon VII"]
PERSONNAGES_REFUSES = ["Margrethe II", "Giacomo Carafa"]

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
        redo: a.querySelector('.redo a')?.getAttribute('href') || null, ecu: a.querySelector('a.shield')?.getAttribute('href') || null,
        non: a.querySelector('.redo-non')?.textContent || null, nonHref: a.querySelector('.redo-non a')?.getAttribute('href') || null }))""")}
    verifie(all(cartes.get(n, {}).get("redo") for n in lisibles), f"{nom} : un bouton « Redessiner dans l'Atelier » sous chaque blasonnement lisible" + ("" if all(cartes.get(n, {}).get("redo") for n in lisibles) else f" — manque {[n for n in lisibles if not cartes.get(n, {}).get('redo')]}"))
    verifie(not any(cartes.get(n, {}).get("redo") for n in refuses), f"{nom} : aucun bouton sous ce que l'Atelier ne comprend pas" + ("" if not any(cartes.get(n, {}).get("redo") for n in refuses) else f" — {[n for n in refuses if cartes.get(n, {}).get('redo')]}"))
    sans = [a["nom"] for a in data(fichier) if not a.get("blason")]
    verifie(not any(cartes[n]["redo"] or cartes[n]["ecu"] or cartes[n]["non"] for n in sans), f"{nom} : rien sous une carte sans blasonnement, et son écu ne mène nulle part")
    verifie(all(c["ecu"] == c["redo"] for c in cartes.values()), f"{nom} : l'écu d'une carte mène à l'Atelier quand le bouton est là, et seulement alors, à la même adresse")
    avec = [a["nom"] for a in data(fichier) if a.get("blason")]
    verifie(all(bool(cartes[n]["redo"]) != bool(cartes[n]["non"]) for n in avec), f"{nom} : sous chaque blasonnement, le bouton ou la ligne qui dit où l'Atelier bute, jamais les deux")
    verifie(all("bute sur « " in (cartes[n]["non"] or "") for n in refuses), f"{nom} : sous un blasonnement refusé, l'endroit où l'Atelier bute est cité")
    params = lambda h: page.evaluate("h => Object.fromEntries(new URLSearchParams(h.split('#')[1]))", h)
    avec_bouton = [c for c in cartes.values() if c["redo"]]
    verifie(all(page.evaluate("t => lire(t).ok", params(c["redo"])["lire"]) for c in avec_bouton), f"{nom} : chaque bouton porte un blasonnement que le lecteur comprend")
    verifie(all(params(c["redo"]).get("de") == f"{gal}:{c['id']}" == f"{gal}:{slug_carte(c['nom'])}" for c in avec_bouton), f"{nom} : chaque lien vers l'Atelier dit de quelle carte il part")
    verifie(all(not page.evaluate("t => lire(t).ok", params(c["nonHref"])["lire"]) and params(c["nonHref"]).get("de") == f"{gal}:{c['id']}" for c in cartes.values() if c["nonHref"]),
            f"{nom} : « Voir où dans l'Atelier » porte le texte refusé et la carte d'où il vient")
    propre(nom + " (boutons)", page, erreurs)
    # un clic sur l'écu ouvre l'Atelier sur les armes, et y montre la carte d'où l'on part
    cible = lisibles[-1]
    page.locator(".ar", has=page.locator("h3", has_text=cible)).locator("a.shield").click()
    page.wait_for_url("**/atelier.html*"); page.wait_for_selector("#origine:not([hidden]) .or-etat"); page.wait_for_timeout(600)
    attendu = next(a.get("atelier") or a["blason"] for a in data(fichier) if a["nom"] == cible)       # le champ « atelier » : ce que l'Atelier lit pour suivre l'image
    verifie(page.input_value("#lire") == attendu and page.locator("#lire-etat.ok").count() == 1, f"{nom} : un clic sur l'écu ouvre l'Atelier, qui lit le blasonnement de « {cible} »")
    verifie(page.inner_text("#origine .or-nom") == cible and page.locator("#origine .or-etat.ok").count() == 1, f"{nom} : l'Atelier montre la carte d'où l'on part et dit que ce sont ses armes")
    verifie(f"de={gal}:{slug_carte(cible)}" in page.url and "lire=" not in page.url, f"{nom} : l'adresse de l'Atelier redevient un lien de partage qui garde la carte d'origine")
    page.context.close()

def test_partir(browser, base):
    """« Partir d'un blason réel » : le sélecteur propose les cartes relues, et elles seules ; la carte d'origine suit les modifications ; on y revient"""
    page, erreurs = ouvre(browser, base, "atelier.html", "#reel")
    page.wait_for_function("document.querySelectorAll('#reel optgroup').length > 0")
    relues = page.evaluate("""async () => { const t = []; for (const f of ['blasons', 'personnages']) for (const a of await (await fetch('data/' + f + '.json')).json()) if (a.blason && lire(a.atelier || a.blason).ok) t.push(a.nom); return t; }""")
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
    chypre = next(a["blason"] for a in data("blasons.json") if a["nom"] == "Chypre")      # (la Norvège, prise d'abord, se lit depuis le lion à la hache)
    page, erreurs = ouvre(browser, base, "atelier.html#lire=" + urllib.parse.quote(chypre) + "&de=blasons:chypre", "#origine:not([hidden]) .or-etat")
    verifie("ko" in etat() and page.locator("#lire-etat.ko mark").count() >= 1 and blz() != "", "partir : une carte que le lecteur ne relit pas s'ouvre, texte surligné, sans rien deviner")
    verifie("de=blasons:chypre" in page.url and "lire=" not in page.url, "partir : son adresse garde la carte")
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
        verifie(page.locator(".menu-btn").is_visible() and not page.locator("header.mast nav").is_visible(), f"téléphone/{ident} : le menu est replié derrière un bouton")
        page.click(".menu-btn")
        verifie(page.locator("header.mast nav").is_visible() and page.locator("header.mast nav a").count() == len(MENU), f"téléphone/{ident} : le bouton ouvre le menu complet")
        page.keyboard.press("Escape")
        verifie(not page.locator("header.mast nav").is_visible(), f"téléphone/{ident} : Échap referme le menu")
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
    for cible in ("index.html", "blasons.html", "personnages.html"):
        pg, er = ouvre(browser, base, cible, "main .section, .ar" if cible == "index.html" else ".ar")
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
