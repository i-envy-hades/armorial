"""Vérifie la cohérence des données de l'Armorial : python tools/check_data.py"""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
errors = []

def walk(o, path=""):
    if isinstance(o, dict):
        yield path, o
        for k, v in o.items(): yield from walk(v, f"{path}.{k}")
    elif isinstance(o, list):
        for i, v in enumerate(o): yield from walk(v, f"{path}[{i}]")

for f in sorted((ROOT / "data").glob("*.json")):
    try:
        data = json.loads(f.read_text(encoding="utf-8"))
    except ValueError as e:
        errors.append(f"{f.name}: JSON invalide ({e})"); continue
    if not isinstance(data, dict): continue
    srcs = data.get("sources")
    keys = set(srcs) if isinstance(srcs, dict) else {s.get("id") for s in srcs or [] if isinstance(s, dict)}
    for path, o in walk(data):
        if path == "": continue
        refs = o.get("sources")
        if keys and isinstance(refs, list):
            for s in refs:
                if isinstance(s, str) and s not in keys: errors.append(f"{f.name}{path}: source inconnue « {s} »")
        if isinstance(o.get("file"), str) and o["file"] and not (o.get("auteur") and o.get("lic")):
            errors.append(f"{f.name}{path}: figure « {o['file']} » sans auteur ou licence")
    armes = data.get("armes")
    for R in data.get("royaumes", []):
        for r in R.get("regnes", []):
            for a in [r.get("armes")] + [p.get("armes") for p in r.get("phases", [])]:
                if a and a not in armes: errors.append(f"{f.name}: {r.get('nom')} → armes inconnues « {a} »")

html = (ROOT / "lignees.html").read_text(encoding="utf-8")
for m in re.finditer(r'file:\s*"(data/[^"]+)"', html):
    if not (ROOT / m.group(1)).exists(): errors.append(f"lignees.html: {m.group(1)} introuvable")

print("\n".join(errors) or "OK")
sys.exit(1 if errors else 0)
