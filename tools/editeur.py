"""La console des blasons : un petit serveur local qui sert le dépôt et enregistre les changements d'une carte.

    python3 tools/editeur.py            puis ouvrir http://127.0.0.1:8140/tools/editeur.html
                                        (ou http://127.0.0.1:8140/tools/formes.html : la forme de l'écu de chaque carte)

Il ne fait que deux choses : servir les fichiers du dépôt (sans cache), et recevoir de la page tools/editeur.html la
modification d'UNE carte de data/blasons.json ou data/personnages.json. Il n'écoute que sur 127.0.0.1.

Champs que la console peut écrire, et rien d'autre :
  blason        le blasonnement affiché sur la carte
  atelier       ce que l'Atelier lit, quand l'image montre autre chose que la source (vide : champ retiré)
  atelierAjust  réglages de taille et de position (« sz=60&dy=-40&q2.an=45 » : q2. à q5. visent un autre quartier, l'écusson en abîme)
  atelierNote   la phrase affichée sous la carte quand « atelier » est posé
  sansAtelier   vrai : la carte est retirée de l'Atelier (et du jeu du jour) ; faux : champ retiré
  aRefaire      note du curateur sur ce qui reste à refaire (privée : jamais affichée sur le site)
  aVerifier     carte nouvelle, à comparer à son image dans la console (privé ; faux : champ retiré)
  forme         la forme de l'écu, quand l'image en montre une autre que le français moderne (une clé de SHAPES, assets/dessin.js)

Les fichiers sont réécrits comme le reste du dépôt (indentation de 2, accents gardés) : git diff ne montre que la carte touchée.
Rien n'est commité : c'est à vous de relire le diff, puis de commiter et publier."""
import functools, http.server, json, os, pathlib, re, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = int(os.environ.get("PORT", 8140))
GALERIES = {"blasons": ROOT / "data" / "blasons.json", "personnages": ROOT / "data" / "personnages.json"}
TEXTE_MAX = 800
FORMES = {"", "ancien", "losange", "targe", "ovale", "banniere", "anglais", "suisse", "italien", "sannitique", "iberique", "hongrois", "pl16", "pl17", "pl19"}      # les clés de SHAPES (assets/dessin.js)


def valide(champs):
    """renvoie (champs nettoyés, erreur)"""
    out = {}
    for k, v in champs.items():
        if k in ("blason", "atelier", "atelierNote", "aRefaire"):
            if not isinstance(v, str) or len(v) > TEXTE_MAX: return None, f"« {k} » : texte de {TEXTE_MAX} caractères au plus"
            out[k] = " ".join(v.split())                       # espaces et retours à la ligne repliés : une carte tient sur une ligne
        elif k == "atelierAjust":
            if not isinstance(v, str) or not re.fullmatch(r"[a-z0-9=&.\-]{0,400}", v): return None, "« atelierAjust » : réglages mal formés"
            out[k] = v
        elif k == "forme":
            if v not in FORMES: return None, f"« forme » : forme inconnue ({v!r})"
            out[k] = v
        elif k == "aVerifier":
            if not isinstance(v, bool): return None, "« aVerifier » : vrai ou faux"
            out[k] = v
        elif k == "sansAtelier":
            if not isinstance(v, bool): return None, "« sansAtelier » : vrai ou faux"
            out[k] = v
        else:
            return None, f"champ non modifiable : « {k} »"
    return out, None


def enregistre(galerie, nom, champs):
    if galerie not in GALERIES: return None, "galerie inconnue"
    champs, err = valide(champs)
    if err: return None, err
    fichier = GALERIES[galerie]
    cartes = json.loads(fichier.read_text(encoding="utf-8"))
    cible = [c for c in cartes if c.get("nom") == nom]
    if len(cible) != 1: return None, f"carte introuvable : « {nom} »"
    carte = cible[0]
    if "blason" in champs and not champs["blason"]: return None, "le blasonnement ne peut pas être vide"
    for k, v in champs.items():
        if v in ("", False): carte.pop(k, None)               # un champ vide ou faux n'existe pas : le fichier reste net
        else: carte[k] = v
    texte = json.dumps(cartes, ensure_ascii=False, indent=2) + "\n"
    fd, tmp = tempfile.mkstemp(dir=str(fichier.parent), suffix=".tmp")    # écriture atomique : jamais de fichier à moitié écrit
    with os.fdopen(fd, "w", encoding="utf-8") as f: f.write(texte)
    os.replace(tmp, fichier)
    return carte, None


class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store"); super().end_headers()

    def envoie(self, code, data):
        corps = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(code); self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corps))); self.end_headers(); self.wfile.write(corps)

    def do_POST(self):
        hote = (self.headers.get("Host") or "").split(":")[0]
        if self.path != "/__api/carte" or hote not in ("127.0.0.1", "localhost") or self.headers.get("X-Editeur") != "1":
            return self.envoie(403, {"erreur": "refusé"})
        try:
            n = int(self.headers.get("Content-Length") or 0)
            if n <= 0 or n > 20000: raise ValueError("taille")
            b = json.loads(self.rfile.read(n))
            carte, err = enregistre(b.get("galerie"), b.get("nom"), b.get("champs") or {})
        except Exception as e:
            return self.envoie(400, {"erreur": f"requête illisible ({e})"})
        if err: return self.envoie(422, {"erreur": err})
        self.envoie(200, {"carte": carte})


if __name__ == "__main__":
    s = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), functools.partial(H, directory=str(ROOT)))
    print(f"Console des blasons : http://127.0.0.1:{PORT}/tools/editeur.html  (Ctrl-C pour arrêter)", flush=True)
    try: s.serve_forever()
    except KeyboardInterrupt: print("\narrêt")
