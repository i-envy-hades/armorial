"""Test de fumée : charge chaque page dans un vrai navigateur et vérifie qu'elle se construit.

    pip install playwright            # une fois
    python tools/smoke_test.py        # utilise Google Chrome s'il est installé

Sans Chrome : « playwright install chromium » télécharge un navigateur de rechange (le script le prend tout seul).
Le site est servi en local ; les images de Wikimedia Commons sont remplacées par un pixel transparent,
si bien que le test ne dépend ni du réseau ni de l'humeur de Wikimedia.

Ce que l'on contrôle : aucune erreur dans la console, aucun fichier local manquant, aucune balise absurde
(« <div, »), toutes les cartes dans leur grille, la recherche, les ancres d'adresse, les cinq frises,
et l'Atelier (blasonnements connus, puis des compositions au hasard qui ne doivent jamais échouer).
Code de sortie 1 au premier échec. FUZZ=500 python tools/smoke_test.py pousse l'Atelier plus loin (500 compositions)."""
import functools, http.server, json, os, pathlib, random, re, sys, threading

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
    verifie(page.locator("header.mast nav a").count() == 5 and page.locator("header.mast nav a.here").count() == 1, f"{nom} : menu complet, page courante marquée")
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
      St.q = pick(["", "2", "4"]);
      for (let j = 0; j < 4; j++) St.A[j] = { ...randomArms(), f: pick(["plein", "part", "ray"]), part: pick(DATA.partitions.map(p => p.kind)),
        ray: pick(["barry", "paly", "bendy", "bendysin"]), n: pick(["6", "8"]), t3: pick(Object.keys(MOT)),
        m2: Math.random() < .4 ? pick(ATL.meubles).kind : "", nb2: pick(["1", "2", "3", "4"]),
        nb: pick(["1", "2", "3", "4", "5", "6", "8", "seme"]), p: Math.random() < .6 ? pick(Object.keys(PIECES)) : "", pos: pick(["autour", "sur"]),
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
    # pièces propres à l'Atelier
    ({"A0": {"t1": "Argent", "m": "", "p": "canton", "tp": "Gueules"}}, "D'argent au canton de gueules"),
    ({"A0": {"t1": "Or", "m": "epee", "nb": "1", "tm": "Argent", "p": "franc-quartier", "tp": "Azur", "pos": "sur"}}, "D'or au franc-quartier d'azur chargé d'une épée d'argent"),
    ({"A0": {"t1": "Argent", "m": "etoile", "nb": "3", "tm": "Azur", "p": "pairle", "tp": "Gueules"}}, "D'argent au pairle de gueules accompagné de trois étoiles d'azur"),
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
        page.click(f"#examples button:text-is('{ex}')"); page.wait_for_timeout(250)
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
                       ("atelier (lien truqué)", lambda: test_atelier_adresse_truquee(browser, base))):
            try: f()
            except Exception as e: ko(f"{nom} : exception du test — {e}")
        browser.close()
    srv.shutdown()
    print("\n".join(lignes))
    print(f"\n{len(lignes) - len(echecs)} contrôles réussis, {len(echecs)} échec(s)")
    sys.exit(1 if echecs else 0)

if __name__ == "__main__":
    main()
