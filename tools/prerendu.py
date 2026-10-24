"""Le prérendu : écrire dans les pages le texte que leurs scripts construisent, pour les moteurs de recherche.

    python3 tools/prerendu.py            (toutes les pages)
    python3 tools/prerendu.py --verifie  (dit seulement si un prérendu est en retard sur ses données ; code 1 si oui)

L'encyclopédie, Blasons réels et Personnages se construisent dans le navigateur, à partir de leurs fichiers JSON : le HTML que reçoit
un moteur de recherche ne contient presque rien. Cet outil ouvre chaque page dans Google Chrome sans fenêtre, laisse son script la
construire, recopie le contenu construit (sans les figures SVG, que le script redessine) dans le fichier HTML, entre deux marques :

    <!--prérendu:main empreinte-->  …  <!--/prérendu:main-->

Au chargement, le script remplace ce contenu par le sien, identique : rien ne change pour le lecteur. L'empreinte (SHA-1 des données
et des scripts qui font la page) dit si le prérendu est à jour : tools/check_data.py avertit quand il ne l'est plus. À relancer après
avoir modifié les données d'une de ces pages, avant de publier.

Demande Google Chrome (/Applications/Google Chrome.app) ; sert le dépôt sur un port libre de 127.0.0.1, le temps du rendu."""
import functools, hashlib, html, http.server, json, pathlib, re, subprocess, sys, threading

ROOT = pathlib.Path(__file__).resolve().parent.parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# page → les blocs à recopier (id de l'élément, ce qui prouve qu'il est construit) et ce dont dépend son contenu
PAGES = {
    "encyclopedie.html": {"blocs": {"main": "#main .section", "rail-list": "#rail-list li", "counts": "#counts *"},
                          "sources": ["data/data.json", "assets/index.js", "assets/blason.js"]},
    "blasons.html": {"blocs": {"grid": "#grid .ar"},
                     "sources": ["data/blasons.json", "assets/blasons.js", "assets/cartes.js", "assets/lecture.js", "assets/blasonnement.js"]},
    "personnages.html": {"blocs": {"grid": "#grid .ar"},
                         "sources": ["data/personnages.json", "assets/personnages.js", "assets/cartes.js", "assets/lecture.js", "assets/blasonnement.js"]},
}

# la page qui ouvre la page à prérendre dans un cadre, attend qu'elle soit construite et rend le contenu des blocs
SONDE = """<!doctype html><meta charset="utf-8"><body><pre id="out">EN COURS</pre>
<iframe id="f" src="%(page)s" style="width:1200px;height:900px"></iframe>
<script>
const blocs = %(blocs)s, f = document.getElementById("f");
let n = 0, avant = null;
const prise = d => { const out = {}; for (const id of Object.keys(blocs)) { const e = d.getElementById(id); out[id] = e ? e.innerHTML : null; } return JSON.stringify(out); };
const tic = setInterval(() => {
  n++;
  const d = f.contentDocument;
  const pret = d && Object.values(blocs).every(s => d.querySelector(s));
  if (!pret && n < 400) return;
  // les compteurs de l'en-tête s'animent : on attend deux prises identiques, à une seconde d'écart
  const p = d ? prise(d) : "{}";
  if (pret && p !== avant && n < 400) { avant = p; return; }
  clearInterval(tic);
  document.getElementById("out").textContent = "DONE " + p;
}, 1000);
</script></body>"""


def empreinte(page):
    h = hashlib.sha1()
    for s in PAGES[page]["sources"]: h.update((ROOT / s).read_bytes())
    return h.hexdigest()[:12]


def nettoie(x):
    x = re.sub(r"(?s)<svg\b.*?</svg>", "", x)                 # les figures : redessinées par le script
    x = re.sub(r"(?s)<!--.*?-->", "", x)
    x = re.sub(r' (?:style="opacity:[^"]*"|data-reveal-done="[^"]*")', "", x)
    # « reveal » cache un bloc jusqu'à ce que le script le fasse apparaître : sans script, le texte doit rester visible
    def classes(m):
        c = m.group(1).split()
        if "reveal" in c: c = [k for k in c if k not in ("reveal", "in")]
        return f' class="{" ".join(c)}"' if c else ""
    return re.sub(r' class="([^"]*)"', classes, x)


def marque(t, id_):
    """(début du contenu, fin du contenu) de l'élément id_ dans le HTML source, marques comprises ou non"""
    m = re.search(r'<(\w+)\b[^>]*\bid="%s"[^>]*>' % re.escape(id_), t)
    if not m: raise SystemExit(f"élément #{id_} introuvable")
    tag, deb = m.group(1), m.end()
    # l'élément est vide dans la source, ou ne contient que notre prérendu (et un <noscript>) : on trouve sa fermeture
    fin = t.index(f"</{tag}>", t.index(f"<!--/prérendu:{id_}-->", deb) if f"<!--/prérendu:{id_}-->" in t[deb:] else deb)
    return deb, fin


def injecte(page, blocs, emp):
    p = ROOT / page
    t = p.read_text(encoding="utf-8")
    for id_, contenu in blocs.items():
        deb, fin = marque(t, id_)
        dedans = t[deb:fin]
        ns = re.search(r"(?s)<noscript>.*?</noscript>", dedans)                     # le message pour qui n'a pas JavaScript reste
        neuf = f"<!--prérendu:{id_} {emp}-->{nettoie(contenu)}<!--/prérendu:{id_}-->" + (ns.group(0) if ns else "")
        t = t[:deb] + neuf + t[fin:]
    p.write_text(t, encoding="utf-8")


def empreinte_ecrite(page):
    t = (ROOT / page).read_text(encoding="utf-8")
    return set(re.findall(r"<!--prérendu:[\w-]+ ([0-9a-f]+)-->", t))


def verifie():
    retard = [pg for pg in PAGES if empreinte_ecrite(pg) != {empreinte(pg)}]
    for pg in retard: print(f"prérendu en retard : {pg} (lancer python3 tools/prerendu.py)")
    return retard


class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def end_headers(self):
        self.send_header("Cache-Control", "no-store"); super().end_headers()
    def do_GET(self):
        if self.path.startswith("/__sonde/"):
            page = self.path.split("/__sonde/", 1)[1]
            corps = (SONDE % {"page": "/" + page, "blocs": json.dumps(PAGES[page]["blocs"])}).encode()
            self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8"); self.send_header("Content-Length", str(len(corps))); self.end_headers(); self.wfile.write(corps)
            return
        super().do_GET()


def rend(base, page):
    for essai in range(3):                                   # le temps virtuel de Chrome s'arrête parfois trop tôt : on recommence
        r = subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-sandbox", "--virtual-time-budget=120000", "--dump-dom", f"{base}/__sonde/{page}"],
                           capture_output=True, text=True, timeout=300)
        m = re.search(r'<pre id="out">DONE (.*?)</pre>', r.stdout, re.S)
        if m:
            blocs = json.loads(html.unescape(m.group(1)))
            if all(blocs.values()): return blocs
    raise SystemExit(f"{page} : la page ne s'est pas construite (Chrome)")


def main():
    if "--verifie" in sys.argv: sys.exit(1 if verifie() else 0)
    if not pathlib.Path(CHROME).exists(): raise SystemExit("Google Chrome introuvable : " + CHROME)
    serveur = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(H, directory=str(ROOT)))
    threading.Thread(target=serveur.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{serveur.server_address[1]}"
    try:
        for page in PAGES:
            blocs = rend(base, page)
            injecte(page, blocs, empreinte(page))
            taille = sum(len(nettoie(v)) for v in blocs.values())
            mots = len(re.sub(r"<[^>]+>", " ", "".join(nettoie(v) for v in blocs.values())).split())
            print(f"{page} : {mots} mots, {taille // 1024} Ko de HTML écrits")
    finally:
        serveur.shutdown()


if __name__ == "__main__":
    main()
