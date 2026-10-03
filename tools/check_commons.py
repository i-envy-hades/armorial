"""Vérifie auprès de Wikimedia Commons que les figures empruntées existent toujours et gardent leur licence.

    python tools/check_commons.py

Le site cite des centaines de fichiers de Wikimedia Commons. Un fichier peut y être renommé, supprimé,
ou changer de licence : ce script le dit avant que le site ne montre une image manquante.
  - ERREUR : fichier introuvable, ou licence qui n'est plus libre (NC, ND, inconnue) ;
  - avertissement : fichier renommé (l'image s'affiche encore, mais son crédit cite l'ancien nom),
    ou licence différente de celle qu'annoncent nos données.
Sans réseau, le script le dit et s'arrête sans erreur (sauf avec --strict).
Il interroge l'API de Commons par lots de 40 titres, poliment : une dizaine de requêtes en tout."""
import json, pathlib, re, sys, time, urllib.error, urllib.parse, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
API = "https://commons.wikimedia.org/w/api.php"
UA = "armorial-check/1.0 (https://github.com/i-envy-hades/armorial ; verification des credits)"
LIBRE = re.compile(r"^(CC BY(-SA)? \d\.\d|CC0.*|Public domain|PD[ -].*|No restrictions)$", re.I)
EQUIV = {"domaine public": "public domain"}

def rang(licence):
    """0 : domaine public ou CC0 ; 1 : CC BY ; 2 : CC BY-SA (de la plus permissive à la plus contraignante)"""
    l = licence.lower()
    return 2 if "by-sa" in l else 1 if l.startswith("ccby") else 0

def noms():
    """nom de fichier Commons -> licence annoncée par nos données (ou None)"""
    vus = {}
    def parcours(o):
        if isinstance(o, dict):
            for cle in ("file", "commons"):
                v = o.get(cle)
                if isinstance(v, str) and v and not v.startswith(("data/", "assets/")):
                    vus.setdefault(v.replace("_", " "), o.get("lic"))
            for v in o.values(): parcours(v)
        elif isinstance(o, list):
            for v in o: parcours(v)
    for f in sorted((ROOT / "data").glob("*.json")):
        parcours(json.loads(f.read_text(encoding="utf-8")))
    for f in sorted((ROOT / "assets").glob("*.js")):      # figures codées dans le moteur (ex. ECCL_FIGURES)
        t = f.read_text(encoding="utf-8")
        for m in re.finditer(r'file:\s*"([^"]+\.(?:svg|png|jpe?g))"[^}]*?lic:\s*"([^"]+)"', t, re.S):
            vus.setdefault(m.group(1).replace("_", " "), m.group(2))
    return vus

def interroge(titres):
    q = urllib.parse.urlencode({"action": "query", "titles": "|".join("File:" + t for t in titres), "prop": "imageinfo",
        "iiprop": "extmetadata", "iiextmetadatafilter": "LicenseShortName", "format": "json", "formatversion": "2", "redirects": "1"})
    req = urllib.request.Request(f"{API}?{q}", headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.load(r)

def main():
    strict = "--strict" in sys.argv
    fichiers = noms()
    erreurs, avis, pages = [], [], {}
    renvois = {}
    try:
        liste = list(fichiers)
        for i in range(0, len(liste), 40):
            d = interroge(liste[i:i + 40])["query"]
            for n in d.get("normalized", []): renvois[n["from"]] = n["to"]
            for n in d.get("redirects", []): renvois[n["from"]] = n["to"]
            for p in d["pages"]: pages[p["title"]] = p
            time.sleep(0.5)
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        print(f"Commons injoignable ({e}) : rien vérifié.")
        sys.exit(1 if strict else 0)

    def suit(t):
        for _ in range(5):                       # normalisation puis redirection, éventuellement en chaîne
            if t not in renvois: break
            t = renvois[t]
        return t
    for nom, annoncee in fichiers.items():
        t0 = "File:" + nom
        t = suit(t0)
        p = pages.get(t)
        if not p or p.get("missing"):
            erreurs.append(f"introuvable sur Commons : « {nom} »"); continue
        if t != t0 and t.replace("_", " ") != t0.replace("_", " "):
            avis.append(f"renommé : « {nom} » → « {t[5:]} » (l'image s'affiche, le crédit cite l'ancien nom)")
        reelle = ((p.get("imageinfo") or [{}])[0].get("extmetadata", {}).get("LicenseShortName", {}) or {}).get("value", "")
        if not LIBRE.match(reelle):
            erreurs.append(f"licence non libre ou inconnue : « {nom} » → « {reelle or '?'} »")
        elif annoncee:
            a = EQUIV.get(annoncee.lower(), annoncee.lower()).replace(" ", "")
            b = reelle.lower().replace(" ", "")
            # annoncer une licence plus stricte que celle de Commons est sans danger (fichier à licences multiples,
            # par exemple) ; annoncer une licence plus permissive que la vraie n'est pas permis
            if a != b and (rang(a) < rang(b) or (rang(a) == rang(b) and rang(a) > 0)):
                avis.append(f"licence différente : « {nom} » annoncée « {annoncee} », Commons dit « {reelle} »")
    for a in avis: print("avertissement :", a)
    for e in erreurs: print("ERREUR :", e)
    print(f"{len(fichiers)} fichiers vérifiés, {len(erreurs)} erreur(s), {len(avis)} avertissement(s)")
    sys.exit(1 if erreurs else 0)

if __name__ == "__main__":
    main()
