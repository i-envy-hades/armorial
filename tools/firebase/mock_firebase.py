"""Un faux Firebase minimal (Authentication + Firestore REST), en mémoire, pour essayer assets/enligne.js sans projet réel.

    python3 tools/firebase/mock_firebase.py   puis ouvrir http://127.0.0.1:8130/   (« Continuer avec Google » y demande un e-mail d'essai)

Il sert le site, répond aux adresses d'Identity Toolkit, de Secure Token et de Firestore, et applique à la main l'esprit de
firestore.rules (chacun écrit chez soi, un pseudo ne se crée qu'une fois, un résultat ne se modifie pas). /data/compte.json y est
fabriqué (le vrai reste vide) ; /__db montre ce que la base contient.
Il ne prouve que la logique du site, pas la conformité à Firebase : cela se vérifie une fois le vrai projet créé."""
import functools, http.server, json, os, pathlib, threading, time, urllib.parse, uuid

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
PROJET, CLE = "armorial-test", "AIza" + "B" * 35
BASE = f"projects/{PROJET}/databases/(default)/documents"
DB = {"users": {}, "docs": {}, "tokens": {}, "refresh": {}}
JOURNAL = []
AVEC_INDEX = os.environ.get("INDEX") == "1"          # INDEX=1 : l'index composite de SETUP.md existe ; sinon une requête filtrée et triée est refusée comme sur un vrai projet

class Refus(Exception):
    def __init__(self, code, status, msg=""): self.code, self.status, self.msg = code, status, msg

def val(x):                                           # valeur Firestore -> python
    k = next(iter(x))
    return {"stringValue": lambda v: v, "integerValue": int, "doubleValue": float, "booleanValue": bool, "timestampValue": lambda v: v,
            "nullValue": lambda v: None, "mapValue": lambda v: {a: val(b) for a, b in (v.get("fields") or {}).items()}}[k](x[k])

def champs(d): return {k: val(v) for k, v in (d or {}).items()}

def session(email):
    uid = DB["users"][email]["id"]
    t, r = "id-" + uuid.uuid4().hex, "rf-" + uuid.uuid4().hex
    DB["tokens"][t] = uid; DB["refresh"][r] = email
    return {"idToken": t, "refreshToken": r, "expiresIn": "3600", "localId": uid, "email": email}

def court(chemin): return chemin[len(BASE) + 1:] if chemin.startswith(BASE) else chemin

def regles(op, chemin, uid, apres=None, avant=None, store=None):
    """l'esprit de firestore.rules ; `store` : l'état de la base après l'écriture (pour getAfter)"""
    p = chemin.split("/")
    store = DB["docs"] if store is None else store
    def pas(msg="Missing or insufficient permissions."): raise Refus(403, "PERMISSION_DENIED", msg)
    if p[0] == "profils" and len(p) == 2:
        if op in ("get", "list"): return
        if not uid or uid != p[1]: pas()
        if op == "delete": return
        d = apres
        ps = store.get("pseudos/" + d.get("pseudo", "").lower())
        if not ps or ps.get("uid") != uid: pas()
        return
    if p[0] == "profils" and len(p) == 4 and p[2] == "carnets":
        if not uid or uid != p[1]: pas()
        return
    if p[0] == "profils" and len(p) == 4 and p[2] == "bibliotheque":
        if not uid or uid != p[1]: pas()
        if op in ("create", "update"):
            a = apres or {}
            if set(a) - {"nom", "armes", "cree"} or not (1 <= len(a.get("nom", "")) <= 60) or not isinstance(a.get("armes"), str) or len(a["armes"]) > 2000 or "<" in a["armes"] or ">" in a["armes"]: pas()
        return
    if p[0] == "abonnes" and len(p) == 2:
        if not uid or uid != p[1]: pas()
        if op in ("create", "update"):
            email = next((e for e, x in DB["users"].items() if x["id"] == uid), None)
            if set(apres or {}) - {"email", "depuis"} or apres.get("email") != email: pas()
        return
    if p[0] == "pseudos" and len(p) == 2:
        if op == "get": return
        if op == "list": pas()
        if not uid: pas()
        if op == "create" and not (apres["uid"] == uid and p[1] == apres["pseudo"].lower()): pas()
        if op == "delete" and avant.get("uid") != uid: pas()
        return
    if p[0] == "scores" and len(p) == 2:
        if op in ("get", "list"): return
        if not uid: pas()
        if op == "delete": return None if avant and avant.get("uid") == uid else pas()
        if op != "create" or apres["uid"] != uid or p[1] != f'{uid}_{apres["jeu"]}_{apres["jour"]}': pas()
        return
    pas()

def applique(writes, uid, atomique):
    """applique des écritures ; renvoie la liste des statuts (batchWrite) ou lève Refus (commit, atomique).
    Les règles se jugent sur l'état d'APRÈS les écritures de l'envoi (c'est le sens de getAfter)."""
    etat = dict(DB["docs"]); statuts = []; verifs = []
    for w in writes:
        avant_ecriture, avant_verifs = dict(etat), len(verifs)
        try:
            if "delete" in w:
                ch = court(w["delete"]); avant = etat.get(ch)
                if avant is not None: verifs.append(("delete", ch, None, avant))
                etat.pop(ch, None)
            else:
                ch = court(w["update"]["name"]); existe = ch in etat; nouv = champs(w["update"].get("fields"))
                if (w.get("currentDocument") or {}).get("exists") is False and existe: raise Refus(409, "ALREADY_EXISTS", "Document already exists")
                if existe and ch.startswith(("scores/", "pseudos/")): raise Refus(403, "PERMISSION_DENIED", "no update")
                etat[ch] = nouv; verifs.append(("update" if existe else "create", ch, nouv, None))
            if not atomique:                                     # envoi non atomique : chaque écriture est jugée seule
                for op, ch2, ap, av in verifs[avant_verifs:]: regles(op, ch2, uid, apres=ap, avant=av, store=etat)
            statuts.append({})
        except Refus as r:
            if atomique: raise
            statuts.append({"code": 6 if r.status == "ALREADY_EXISTS" else 7, "message": r.status})
            etat = avant_ecriture; del verifs[avant_verifs:]     # une écriture refusée ne laisse aucune trace
    if atomique:
        for op, ch, ap, av in verifs: regles(op, ch, uid, apres=ap, avant=av, store=etat)
    DB["docs"] = etat
    return statuts

class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def end_headers(self):
        self.send_header("Cache-Control", "no-store"); super().end_headers()
    def send(self, code, data=None):
        body = b"" if data is None else json.dumps(data).encode()
        self.send_response(code); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def erreur(self, code, status, msg=""):
        e = {"error": {"code": code, "message": msg or status, "status": status}}
        self.send(code, [e] if self.path.split("?")[0].endswith((":runQuery", ":batchGet")) else e)      # comme le vrai Firestore : ces deux réponses sont des tableaux
    def uid(self):
        a = self.headers.get("Authorization", "")
        return DB["tokens"].get(a[7:]) if a.startswith("Bearer ") else None
    def corps(self):
        n = int(self.headers.get("Content-Length") or 0); brut = self.rfile.read(n) if n else b""
        if "x-www-form-urlencoded" in (self.headers.get("Content-Type") or ""): return dict(urllib.parse.parse_qsl(brut.decode()))
        return json.loads(brut or b"null")
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == "/__db": return self.send(200, {"users": {e: x["id"] for e, x in DB["users"].items()}, "docs": DB["docs"]})
        if u.path == "/data/compte.json": return self.send(200, {"projet": PROJET, "cle": CLE, "emulateur": f"http://{self.headers['Host']}"})
        if u.path.startswith("/firestore/"): return self.firestore("GET", u)
        super().do_GET()
    def do_POST(self):
        u = urllib.parse.urlparse(self.path)
        if u.path.startswith("/identitytoolkit/"): return self.auth(u)
        if u.path.startswith("/securetoken/"): return self.jeton()
        if u.path.startswith("/firestore/"): return self.firestore("POST", u)
        self.send(404, {})
    do_PATCH = do_POST
    def cle_ok(self, u): return dict(urllib.parse.parse_qsl(u.query)).get("key") == CLE
    def auth(self, u):
        if not self.cle_ok(u): return self.erreur(400, "", "API_KEY_INVALID")
        b = self.corps() or {}; point = u.path.split(":")[-1]
        if point == "signUp":
            if b["email"] in DB["users"]: return self.erreur(400, "", "EMAIL_EXISTS")
            if len(b["password"]) < 6: return self.erreur(400, "", "WEAK_PASSWORD : Password should be at least 6 characters")
            DB["users"][b["email"]] = {"id": uuid.uuid4().hex[:28], "password": b["password"]}
            return self.send(200, session(b["email"]))
        if point == "signInWithPassword":
            x = DB["users"].get(b["email"])
            if not x or not x["password"] or x["password"] != b["password"]: return self.erreur(400, "", "INVALID_LOGIN_CREDENTIALS")
            return self.send(200, session(b["email"]))
        if point == "signInWithIdp":                    # « Continuer avec Google », simulé : l'e-mail passe dans postBody
            email = dict(urllib.parse.parse_qsl(b.get("postBody", ""))).get("email", "")
            if not email: return self.erreur(400, "", "INVALID_IDP_RESPONSE")
            DB["users"].setdefault(email, {"id": uuid.uuid4().hex[:28], "password": None, "google": True})
            return self.send(200, session(email))
        if point == "delete":
            uid = DB["tokens"].get(b.get("idToken"))
            if not uid: return self.erreur(400, "", "INVALID_ID_TOKEN")
            DB["users"] = {e: x for e, x in DB["users"].items() if x["id"] != uid}; return self.send(200, {"kind": "identitytoolkit#DeleteAccountResponse"})
        self.send(404, {})
    def jeton(self):
        b = self.corps() or {}; email = DB["refresh"].get(b.get("refresh_token"))
        if not email or email not in DB["users"]: return self.erreur(400, "", "INVALID_REFRESH_TOKEN")
        s = session(email); JOURNAL.append("refresh")
        self.send(200, {"id_token": s["idToken"], "refresh_token": s["refreshToken"], "expires_in": "3600", "user_id": s["localId"]})
    def firestore(self, meth, u):
        if not self.cle_ok(u): return self.erreur(400, "INVALID_ARGUMENT", "API key not valid")
        chemin = urllib.parse.unquote(u.path.split("/documents", 1)[1]).lstrip("/"); uid = self.uid()
        try:
            if chemin.startswith(":"): return self.racine(chemin[1:], uid)
            if meth == "GET":
                if chemin.count("/") % 2 == 0:          # une collection : lister
                    pre = chemin + "/"; regles("list", chemin + "/x", uid) if not chemin.startswith("profils/") else regles("get", chemin + "/x", uid)
                    docs = [{"name": f"{BASE}/{k}", "fields": v_enc(v)} for k, v in DB["docs"].items() if k.startswith(pre) and "/" not in k[len(pre):]]
                    return self.send(200, {"documents": docs})
                regles("get", chemin, uid)
                if chemin not in DB["docs"]: return self.erreur(404, "NOT_FOUND", "Document not found")
                return self.send(200, {"name": f"{BASE}/{chemin}", "fields": v_enc(DB["docs"][chemin])})
            b = self.corps()                           # PATCH : remplace le document
            applique([{"update": {"name": f"{BASE}/{chemin}", "fields": b["fields"]}}], uid, True)
            self.send(200, {"name": f"{BASE}/{chemin}"})
        except Refus as r: self.erreur(r.code, r.status, r.msg)
    def racine(self, op, uid):
        b = self.corps(); JOURNAL.append(op)
        if op == "commit":
            if not uid: raise Refus(403, "PERMISSION_DENIED", "auth")
            applique(b["writes"], uid, True); return self.send(200, {"writeResults": [{}] * len(b["writes"])})
        if op == "batchWrite":
            if not uid: raise Refus(403, "PERMISSION_DENIED", "auth")
            return self.send(200, {"status": applique(b["writes"], uid, False)})
        if op == "batchGet":
            out = []
            for n in b["documents"]:
                ch = court(n)
                out.append({"found": {"name": n, "fields": v_enc(DB["docs"][ch])}} if ch in DB["docs"] else {"missing": n})
            return self.send(200, out)
        if op == "runQuery":
            q = b["structuredQuery"]; col = q["from"][0]["collectionId"]
            rows = [(k, v) for k, v in DB["docs"].items() if k.startswith(col + "/") and k.count("/") == 1]
            f = (q.get("where") or {}).get("fieldFilter")
            if f and q.get("orderBy") and not AVEC_INDEX and q["orderBy"][0]["field"]["fieldPath"] != f["field"]["fieldPath"]:
                raise Refus(400, "FAILED_PRECONDITION", "The query requires an index.")
            if f:
                champ, op2, cible = f["field"]["fieldPath"], f["op"], val(f["value"])
                rows = [(k, v) for k, v in rows if champ in v and (v[champ] == cible if op2 == "EQUAL" else v[champ] > cible)]
            for o in reversed(q.get("orderBy") or []):
                rows.sort(key=lambda kv: kv[1].get(o["field"]["fieldPath"], 0), reverse=o.get("direction") == "DESCENDING")
            rows = rows[: q.get("limit", 1000)]
            return self.send(200, [{"document": {"name": f"{BASE}/{k}", "fields": v_enc(v)}} for k, v in rows] or [{"readTime": "2026-10-10T00:00:00Z"}])
        self.send(404, {})

def v_enc(d):                                           # python -> valeurs Firestore
    def e(v):
        if isinstance(v, bool): return {"booleanValue": v}
        if isinstance(v, int): return {"integerValue": str(v)}
        if isinstance(v, float): return {"doubleValue": v}
        if isinstance(v, dict): return {"mapValue": {"fields": {a: e(b) for a, b in v.items()}}}
        return {"stringValue": v} if isinstance(v, str) or v is None else {"stringValue": str(v)}
    return {k: e(v) for k, v in d.items()}

def serve(port=0):
    s = http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(H, directory=str(ROOT)))
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s, f"http://127.0.0.1:{s.server_address[1]}"

if __name__ == "__main__":
    s = http.server.ThreadingHTTPServer(("127.0.0.1", 8130), functools.partial(H, directory=str(ROOT)))
    print("faux Firebase sur http://127.0.0.1:8130", flush=True); s.serve_forever()
