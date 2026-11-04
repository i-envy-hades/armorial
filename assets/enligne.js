/* L'ARMORIAL — les comptes en ligne (Firebase) : se connecter, retrouver ses scores partout, figurer au classement.

   Ce fichier ne fait rien tant que data/compte.json est vide : le site reste alors tel qu'il est, tout dans le navigateur.
   Pour l'activer : tools/firebase/SETUP.md (créer le projet, activer e-mail + mot de passe et Firestore, publier firestore.rules,
   recopier l'identifiant du projet et la clé web).

   On parle à Firebase par ses interfaces HTTP (fetch). Seule exception : « Continuer avec Google » charge, au moment du clic seulement,
   le module d'authentification de Firebase (gstatic.com) pour ouvrir la fenêtre de Google ; on en garde les jetons et tout le reste
   passe par HTTP, comme pour un compte e-mail.
   - Authentification : Identity Toolkit (accounts:signUp, accounts:signInWithPassword, accounts:delete) et Secure Token
     (renouvellement du jeton) ; le jeton de session accompagne les requêtes Firestore (Authorization).
   - Données : Firestore (documents, commit, batchGet, runQuery). Ce que chacun peut lire ou écrire est réglé par la
     base elle-même (tools/firebase/firestore.rules) : la clé web, publique par nature, n'ouvre rien d'autre.
   - Ce qui part en ligne : l'e-mail (gardé par Firebase seul, jamais montré), le pseudo, les armes de joueur, le carnet de chaque jeu,
     la bibliothèque d'armes et, pour le classement, le résultat de chaque partie terminée. L'e-mail n'entre dans la liste des
     abonnés (« abonnes ») que si le joueur coche la case des nouvelles ; il se désinscrit en la décochant.

   Les documents :
     profils/{uid}                  pseudo, armes (l'état de l'Atelier, en une ligne), cree, et par jeu : j_<jeu> (parties), v_<jeu> (victoires),
                                    m_<jeu> (essais moyens des victoires)
     profils/{uid}/carnets/{jeu}    donnees (le carnet, en JSON), maj ; privé
     profils/{uid}/bibliotheque/{id} nom, armes, cree : les armes gardées par le joueur ; privé
     abonnes/{uid}                  email, depuis : qui veut recevoir les nouvelles de l'Armorial par e-mail ; privé (le curateur le lit
                                    dans la console Firebase)
     pseudos/{pseudo en minuscules} uid, pseudo : un pseudo = un document, créé une seule fois (c'est ce qui le rend unique)
     scores/{uid}_{jeu}_{jour}      uid, jeu, jour, essais, gagne, cree, vic (« jeu|jour », seulement pour une victoire) ; non modifiable
     maisons/{code}                 nom, cree : un petit classement entre amis ; se lit avec son code, ne se liste pas ; ses membres sont
                                    les profils dont le champ « maison » porte ce code

   Synchronisation : à chaque chargement, on tire le profil et les carnets distants et on les fond avec les locaux (Compte.fusion[jeu],
   fourni par chaque jeu) ; à chaque enregistrement, on pousse ce qui a changé après un court délai (profil, carnets, nouveaux résultats :
   Compte.scoresDe[jeu]). Un petit registre local (armorial.sync.v1) retient ce qui est déjà parti, pour ne pas le renvoyer. */
(() => {
  "use strict";
  const API = window.Compte;
  if (!API) return;
  const CLE_S = "armorial.session.v1", CLE_Y = "armorial.sync.v1";
  let CFG = null, S = null, Y = null, enTire = false, minuteur = 0;
  const etatSynchro = { ok: true, msg: "", quand: 0 };
  const abonnesSynchro = new Set();
  API.surSynchro = f => { abonnesSynchro.add(f); return () => abonnesSynchro.delete(f); };
  const dit = () => abonnesSynchro.forEach(f => { try { f(etatSynchro); } catch (e) { /* un abonné fautif ne gêne pas les autres */ } });
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- mémoire locale : la session, et ce qui est déjà parti ---------- */
  const lireS = () => { try { const s = JSON.parse(localStorage.getItem(CLE_S) || "null"); return s && s.idToken && s.refreshToken && s.uid ? s : null; } catch (e) { return null; } };
  const ecrireS = s => { S = s; try { if (s) localStorage.setItem(CLE_S, JSON.stringify(s)); else localStorage.removeItem(CLE_S); } catch (e) { /* sans mémoire : la session dure le temps de la page */ } };
  const registre = uid => {                                           // le registre de synchronisation de ce compte (repart à zéro si c'est un autre)
    if (Y && Y.uid === uid) return Y;
    try { const y = JSON.parse(localStorage.getItem(CLE_Y) || "null"); if (y && y.uid === uid) return (Y = y); } catch (e) { /* idem */ }
    return (Y = { uid, pseudo: "", hash: "", carnets: {}, pousses: {} });
  };
  const gardeRegistre = () => { try { localStorage.setItem(CLE_Y, JSON.stringify(Y)); } catch (e) { /* idem */ } };

  /* ---------- adresses (l'« emulateur » ne sert qu'aux essais en local : tools/firebase/mock_firebase.py) ---------- */
  let AUTH, TOKEN, FS, RACINE;
  function adresses() {
    const h = CFG.emulateur;
    AUTH = (h ? h + "/identitytoolkit" : "https://identitytoolkit.googleapis.com") + "/v1";
    TOKEN = (h ? h + "/securetoken" : "https://securetoken.googleapis.com") + "/v1/token";
    FS = (h ? h + "/firestore" : "https://firestore.googleapis.com") + `/v1/projects/${CFG.projet}/databases/(default)/documents`;
    RACINE = `projects/${CFG.projet}/databases/(default)/documents`;
  }

  /* ---------- HTTP ---------- */
  const MOTIFS = {
    EMAIL_EXISTS: Tr("Un compte existe déjà avec cet e-mail : utilisez « me connecter ».", "An account already exists with this e-mail: choose “log in”."),
    INVALID_LOGIN_CREDENTIALS: Tr("E-mail ou mot de passe incorrect.", "Incorrect e-mail or password."), INVALID_PASSWORD: Tr("E-mail ou mot de passe incorrect.", "Incorrect e-mail or password."), EMAIL_NOT_FOUND: Tr("E-mail ou mot de passe incorrect.", "Incorrect e-mail or password."),
    WEAK_PASSWORD: Tr("Mot de passe trop faible : 8 caractères au moins, mieux avec des chiffres et des lettres.", "Password too weak: at least 8 characters, ideally with digits and letters."), INVALID_EMAIL: Tr("Adresse e-mail invalide.", "Invalid e-mail address."), MISSING_PASSWORD: Tr("Saisissez un mot de passe.", "Please enter a password."),
    TOO_MANY_ATTEMPTS_TRY_LATER: Tr("Trop de tentatives : réessayez dans quelques minutes.", "Too many attempts: try again in a few minutes."), USER_DISABLED: Tr("Ce compte est désactivé.", "This account is disabled."),
    OPERATION_NOT_ALLOWED: Tr("L'inscription par e-mail n'est pas activée dans Firebase (voir tools/firebase/SETUP.md, étape 2).", "E-mail sign-up isn't enabled in Firebase (see tools/firebase/SETUP.md, step 2)."),
    CREDENTIAL_TOO_OLD_LOGIN_AGAIN: Tr("Session trop ancienne : reconnectez-vous, puis réessayez.", "Your session is too old: log in again, then retry."),
    PERMISSION_DENIED: Tr("Accès refusé par la base : les règles de tools/firebase/firestore.rules ne sont pas publiées, ou ne correspondent pas (voir SETUP.md, étape 3).", "Access denied by the database: the rules in tools/firebase/firestore.rules aren't published, or don't match (see SETUP.md, step 3)."),
    API_KEY_INVALID: Tr("La clé web de data/compte.json n'est pas valable.", "The web key in data/compte.json isn't valid."), API_KEY_HTTP_REFERRER_BLOCKED: Tr("Cette clé web est limitée à d'autres adresses de site (Google Cloud → Identifiants).", "This web key is restricted to other site addresses (Google Cloud → Credentials)."),
  };
  function erreurDe(data, statut) {
    const corps = Array.isArray(data) ? data[0] : data;                   // runQuery et batchGet répondent leurs erreurs dans un tableau
    const e = corps && corps.error, brut = e && e.message ? String(e.message) : "";
    const code = (e && e.status && e.status !== "UNKNOWN" ? e.status : brut.split(/[\s:]/)[0]) || String(statut);
    const out = new Error(MOTIFS[code] || MOTIFS[brut.split(/[\s:]/)[0]] || brut || `${Tr("Erreur", "Error")} ${statut}`);
    out.statut = statut; out.code = code; return out;
  }
  async function requete(url, { methode = "GET", corps, form, auth = false } = {}) {
    const h = {};
    if (auth) { await renouvelleSiBesoin(); if (S) h.Authorization = "Bearer " + S.idToken; }
    let body;
    if (form) { h["Content-Type"] = "application/x-www-form-urlencoded"; body = new URLSearchParams(form).toString(); }
    else if (corps !== undefined) { h["Content-Type"] = "application/json"; body = JSON.stringify(corps); }
    let r;
    try { r = await fetch(url + (url.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(CFG.cle), { method: methode, headers: h, body }); }
    catch (e) { const err = new Error(Tr("Le service en ligne ne répond pas : vérifiez votre connexion.", "The online service isn't responding: check your connection.")); err.reseau = true; throw err; }
    let data = null; try { data = await r.json(); } catch (e) { /* réponse vide */ }
    if (!r.ok) throw erreurDe(data, r.status);
    return data;
  }
  let renouvellement = null;
  async function renouvelleSiBesoin() {
    if (!S || S.expires_at - 60 > Date.now() / 1000) return;
    if (!renouvellement) renouvellement = (async () => {
      try {
        const d = await requete(TOKEN, { methode: "POST", form: { grant_type: "refresh_token", refresh_token: S.refreshToken } });
        ecrireS({ ...S, idToken: d.id_token, refreshToken: d.refresh_token || S.refreshToken, expires_at: Math.floor(Date.now() / 1000) + (+d.expires_in || 3600) });
      } catch (e) { if (!e.reseau) ecrireS(null); else throw e; }          // session périmée ou révoquée : on repasse en local
      finally { renouvellement = null; }
    })();
    await renouvellement;
  }
  const pose = (d, email, via = "mdp") => ecrireS({ idToken: d.idToken, refreshToken: d.refreshToken, expires_at: Math.floor(Date.now() / 1000) + (+d.expiresIn || 3600), uid: d.localId, email, via });
  const identite = (point, corps) => requete(`${AUTH}/accounts:${point}`, { methode: "POST", corps });

  /* ---------- valeurs Firestore : { stringValue }, { integerValue }, { mapValue }… ---------- */
  const enc = v => v === null ? { nullValue: null } : typeof v === "string" ? { stringValue: v } : typeof v === "boolean" ? { booleanValue: v }
    : typeof v === "number" ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }) : v instanceof Date ? { timestampValue: v.toISOString() } : { mapValue: { fields: encChamps(v) } };
  const encChamps = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, enc(v)]));
  const dec = x => "stringValue" in x ? x.stringValue : "integerValue" in x ? +x.integerValue : "doubleValue" in x ? x.doubleValue : "booleanValue" in x ? x.booleanValue
    : "timestampValue" in x ? x.timestampValue : "mapValue" in x ? decChamps(x.mapValue.fields) : null;
  const decChamps = f => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, dec(v)]));
  const doc = (chemin, champs) => ({ name: `${RACINE}/${chemin}`, fields: encChamps(champs) });
  const seg = s => encodeURIComponent(s);
  const idPseudo = p => p.toLowerCase();
  const fsAuth = (suite, opts) => requete(FS + suite, { ...opts, auth: true });
  const lisDoc = async (chemin, auth = true) => { try { const d = await requete(`${FS}/${chemin}`, { auth }); return decChamps(d.fields); } catch (e) { if (e.statut === 404 || e.code === "NOT_FOUND") return null; throw e; } };
  async function liste(chemin) {                                     // une collection entière, page après page (mille documents au plus)
    const out = []; let jeton = "";
    do {
      const d = await fsAuth(`/${chemin}?pageSize=100${jeton ? "&pageToken=" + encodeURIComponent(jeton) : ""}`);
      out.push(...(d.documents || []).map(x => ({ id: x.name.split("/").pop(), ...decChamps(x.fields) })));
      jeton = d.nextPageToken || "";
    } while (jeton && out.length < 1000);
    return out;
  }
  const nettoie = (r, k) => (r || []).filter(x => x[k]);
  const parTrancheDe = (liste, n) => { const out = []; for (let i = 0; i < liste.length; i += n) out.push(liste.slice(i, i + n)); return out; };

  /* ---------- tirer, fondre, pousser ---------- */
  async function tire() {
    if (!S) return;
    const y = registre(S.uid);
    const [pf, cs] = await Promise.all([lisDoc(`profils/${seg(S.uid)}`), liste(`profils/${seg(S.uid)}/carnets`)]);
    const M = API.interne.lire(), carnets = { ...M.carnets };
    let profil = M.profil, change = false;
    if (pf && pf.pseudo) {
      profil = { pseudo: pf.pseudo, armes: API.armesCode(pf.armes), cree: String(pf.cree || "").slice(0, 10) || (M.profil && M.profil.cree) || "", ...(pf.maison ? { maison: pf.maison } : {}) };
      change = JSON.stringify(profil) !== JSON.stringify(M.profil);
      if (!y.pseudo) y.pseudo = idPseudo(pf.pseudo);                        // ce pseudo est déjà à nous : inutile de le redemander
    }
    for (const c of cs) {
      let distant; try { distant = JSON.parse(c.donnees); } catch (e) { continue; }
      const local = carnets[c.id] || null, fond = API.fusion[c.id] ? API.fusion[c.id](local, distant) : (local ? local : distant);
      if (JSON.stringify(fond) !== JSON.stringify(local)) { carnets[c.id] = fond; change = true; }
    }
    if (change) { enTire = true; try { API.interne.ecrire({ profil, carnets }, true); } finally { enTire = false; } }
    gardeRegistre();
  }
  async function pousse() {
    if (!S) return;
    const M = API.interne.lire(), uid = S.uid, y = registre(uid);
    /* ce qu'on dit de soi pour les classements : parties, victoires, essais moyens de chaque jeu, le total des points et ceux de la semaine,
       « s_<semaine> » (celle-ci et la précédente, pour le tableau d'honneur ; les plus anciennes disparaissent d'elles-mêmes) */
    const resume = { points: Jour.totalPoints() }, nouveauxScores = [];
    for (const w of [Jour.semaine(), Jour.semaine() - 1]) { const p = Jour.pointsSemaine(w); if (p) resume[`s_${w}`] = p; }
    for (const [jeu, c] of Object.entries(M.carnets)) {
      const sc = API.scoresDe[jeu] ? API.scoresDe[jeu](c) : [], vic = sc.filter(x => x.gagne);
      resume[`j_${jeu}`] = sc.length; resume[`v_${jeu}`] = vic.length;
      if (vic.length) resume[`m_${jeu}`] = Math.round(100 * vic.reduce((a, x) => a + x.essais, 0) / vic.length) / 100;
      for (const x of sc) if (!(y.pousses[jeu] || []).includes(x.jour)) nouveauxScores.push({ jeu, ...x });
    }
    /* le profil et son pseudo : une seule écriture atomique (commit) ; un pseudo n'est créé qu'une fois, d'où le « exists: false » */
    if (M.profil && API.pseudoValide(M.profil.pseudo)) {
      const nouveau = idPseudo(M.profil.pseudo), empreinte = JSON.stringify([M.profil, resume, y.pseudo === nouveau]);
      if (empreinte !== y.hash) {
        const writes = [{ update: doc(`profils/${uid}`, { pseudo: M.profil.pseudo, armes: M.profil.armes, cree: M.profil.cree, ...(M.profil.maison ? { maison: M.profil.maison } : {}), ...resume }) }];
        if (y.pseudo !== nouveau) {
          if (y.pseudo) writes.push({ delete: `${RACINE}/pseudos/${y.pseudo}` });
          writes.push({ update: doc(`pseudos/${nouveau}`, { uid, pseudo: M.profil.pseudo }), currentDocument: { exists: false } });
        }
        try { await fsAuth(":commit", { methode: "POST", corps: { writes } }); }
        catch (e) { if (e.code === "ALREADY_EXISTS" || e.statut === 409) { const p = new Error(Tr("Ce pseudo est déjà pris : modifiez-le dans votre profil.", "This username is taken: change it in your profile.")); p.code = "pseudo"; throw p; } throw e; }
        y.pseudo = nouveau; y.hash = JSON.stringify([M.profil, resume, true]);
      }
    }
    /* les carnets : privés, remplacés tels quels quand ils ont changé */
    for (const [jeu, c] of Object.entries(M.carnets)) {
      const json = JSON.stringify(c);
      if (y.carnets[jeu] === json) continue;
      await fsAuth(`/profils/${seg(uid)}/carnets/${seg(jeu)}`, { methode: "PATCH", corps: { fields: encChamps({ donnees: json, maj: new Date() }) } });
      y.carnets[jeu] = json;
    }
    /* les résultats : créés une fois, jamais modifiés. Ceux qui sont déjà en ligne (envoyés d'un autre appareil) sont repérés d'abord
       (lecture publique) : les réécrire serait une modification, que les règles refusent. Envoi par « commit », comme le profil. */
    const note = x => (y.pousses[x.jeu] = y.pousses[x.jeu] || []).push(x.jour);
    for (const lot of parTrancheDe(nouveauxScores, 20)) {
      const nom = x => `${RACINE}/scores/${uid}_${x.jeu}_${x.jour}`;
      const r = await requete(FS + ":batchGet", { methode: "POST", corps: { documents: lot.map(nom) } });
      const enLigne = new Set((r || []).filter(d => d.found).map(d => d.found.name));
      const aEcrire = lot.filter(x => !enLigne.has(nom(x)));
      if (aEcrire.length) {
        try {
          await fsAuth(":commit", { methode: "POST", corps: { writes: aEcrire.map(x => ({
            update: doc(`scores/${uid}_${x.jeu}_${x.jour}`, { uid, jeu: x.jeu, jour: x.jour, essais: x.essais, details: x.details | 0, gagne: !!x.gagne, cree: new Date(), ...(x.gagne ? { vic: `${x.jeu}|${x.jour}` } : {}) }),
            currentDocument: { exists: false } })) } });
        } catch (e) { gardeRegistre(); throw e; }
      }
      lot.forEach(note);
    }
    gardeRegistre();
  }
  async function synchro(sens) {
    if (!CFG || !S) return;
    try {
      if (sens !== "pousse") await tire();
      await pousse();
      Object.assign(etatSynchro, { ok: true, msg: "", quand: Date.now() });
    } catch (e) {
      Object.assign(etatSynchro, { ok: false, msg: e.message });
    }
    dit();
  }
  /* un enregistrement local déclenche l'envoi, après un court délai (plusieurs essais d'affilée : un seul envoi) */
  API.sur(() => { if (CFG && S && !enTire) { clearTimeout(minuteur); minuteur = setTimeout(() => synchro("pousse"), 800); } });

  /* ---------- « Continuer avec Google » ---------- */
  /* Le module d'authentification de Firebase, chargé au premier clic ; la fenêtre de Google s'ouvre sur le domaine du projet
     (<projet>.firebaseapp.com). Il faut, dans la console Firebase : Authentication → Sign-in method → Google activé, et le site
     (armorial.web.app) dans Authentication → Settings → Authorized domains (voir tools/firebase/SETUP.md). */
  const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
  let fb = null;
  async function sdk() {
    if (fb) return fb;
    let A, app;
    try {
      const [mApp, mAuth] = await Promise.all([import(SDK + "firebase-app.js"), import(SDK + "firebase-auth.js")]);
      A = mAuth; app = mApp.initializeApp({ apiKey: CFG.cle, authDomain: CFG.domaine || `${CFG.projet}.firebaseapp.com`, projectId: CFG.projet }, "armorial");
    } catch (e) { throw new Error(Tr("Le module de connexion de Google n'a pas pu se charger : vérifiez votre connexion.", "Google's sign-in module couldn't load: check your connection.")); }
    const auth = A.initializeAuth(app, { persistence: A.inMemoryPersistence, popupRedirectResolver: A.browserPopupRedirectResolver });
    auth.languageCode = LANGUE;
    return (fb = { A, auth });
  }
  const MOTIFS_GOOGLE = {
    "auth/popup-closed-by-user": Tr("Connexion annulée.", "Sign-in cancelled."), "auth/cancelled-popup-request": Tr("Connexion annulée.", "Sign-in cancelled."), "auth/user-cancelled": Tr("Connexion annulée.", "Sign-in cancelled."),
    "auth/popup-blocked": Tr("Le navigateur a bloqué la fenêtre de Google : autorisez les fenêtres surgissantes pour ce site, puis réessayez.", "The browser blocked Google's window: allow pop-ups for this site, then try again."),
    "auth/unauthorized-domain": Tr("Ce site n'est pas encore autorisé pour la connexion Google (Firebase → Authentication → Settings → Authorized domains).", "This site isn't yet authorized for Google sign-in (Firebase → Authentication → Settings → Authorized domains)."),
    "auth/operation-not-allowed": Tr("La connexion Google n'est pas activée dans Firebase (Authentication → Sign-in method).", "Google sign-in isn't enabled in Firebase (Authentication → Sign-in method)."),
    "auth/account-exists-with-different-credential": Tr("Un compte existe déjà avec cet e-mail et un mot de passe : connectez-vous avec l'e-mail.", "An account already exists with this e-mail and a password: log in with the e-mail."),
    "auth/network-request-failed": Tr("Le service en ligne ne répond pas : vérifiez votre connexion.", "The online service isn't responding: check your connection."),
  };
  async function viaGoogle() {
    if (CFG.emulateur) {                                                  // essais en local (mock_firebase.py) : pas de fenêtre Google, un e-mail de test
      const email = (window.prompt("Essai local : l'e-mail du compte Google simulé", "joueur@example.com") || "").trim();
      if (!email) throw new Error(Tr("Connexion annulée.", "Sign-in cancelled."));
      const d = await identite("signInWithIdp", { postBody: `id_token=essai&providerId=google.com&email=${encodeURIComponent(email)}`, requestUri: location.origin, returnSecureToken: true });
      return { idToken: d.idToken, refreshToken: d.refreshToken, expiresIn: d.expiresIn, localId: d.localId, email: d.email || email };
    }
    const { A, auth } = await sdk();
    const fournisseur = new A.GoogleAuthProvider(); fournisseur.setCustomParameters({ prompt: "select_account" });
    let u;
    try { u = (await A.signInWithPopup(auth, fournisseur)).user; }
    catch (e) { throw new Error(MOTIFS_GOOGLE[e.code] || `Connexion Google impossible (${e.code || e.message}).`); }
    const t = await u.getIdTokenResult();
    return { idToken: t.token, refreshToken: u.refreshToken, expiresIn: Math.max(60, Math.round((Date.parse(t.expirationTime) - Date.now()) / 1000)), localId: u.uid, email: u.email || "" };
  }
  async function avecGoogle() {
    const d = await viaGoogle();
    pose(d, d.email, "google");
    await synchro();                                                      // un profil en ligne revient ; sinon le profil de ce navigateur part
    if (!etatSynchro.ok) throw new Error(etatSynchro.msg);
  }

  /* ---------- la bibliothèque d'armes (comptes en ligne seulement) et les nouvelles par e-mail ---------- */
  const idAuHasard = () => { const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"; let s = ""; for (const x of crypto.getRandomValues(new Uint8Array(20))) s += c[x % c.length]; return s; };
  const BIBLIO_MAX = 200;
  const biblio = {
    dispo: () => !!S,
    async liste() {
      if (!S) return [];
      const l = await liste(`profils/${seg(S.uid)}/bibliotheque`);
      return l.map(x => ({ id: x.id, nom: String(x.nom || ""), armes: API.armesCode(x.armes), cree: x.cree || "" })).sort((a, b) => (a.cree < b.cree ? 1 : -1));
    },
    async ajoute(nom, armes) {
      if (!S) throw new Error(Tr("La bibliothèque est réservée aux comptes en ligne.", "The library is for online accounts only."));
      if ((await biblio.liste()).length >= BIBLIO_MAX) throw new Error(Tr(`Votre bibliothèque est pleine (${BIBLIO_MAX} armes) : retirez-en avant d'en ajouter.`, `Your library is full (${BIBLIO_MAX} arms): remove some before adding more.`));
      const id = idAuHasard();
      await fsAuth(":commit", { methode: "POST", corps: { writes: [{ update: doc(`profils/${S.uid}/bibliotheque/${id}`, { nom: String(nom).trim().slice(0, 60) || "Sans nom", armes: API.armesCode(armes), cree: new Date() }), currentDocument: { exists: false } }] } });
      return id;
    },
    async retire(id) {
      if (!S || !/^[A-Za-z0-9]{8,32}$/.test(id)) return;
      await fsAuth(":commit", { methode: "POST", corps: { writes: [{ delete: `${RACINE}/profils/${S.uid}/bibliotheque/${id}` }] } });
    },
  };
  const nouvelles = {
    async lit() { return S ? !!(await lisDoc(`abonnes/${seg(S.uid)}`)) : false; },
    async regle(oui) {
      if (!S) return;
      if (!oui) return void await fsAuth(":commit", { methode: "POST", corps: { writes: [{ delete: `${RACINE}/abonnes/${S.uid}` }] } });
      if (!S.email) throw new Error(Tr("Aucune adresse e-mail n'est liée à ce compte.", "No e-mail address is linked to this account."));
      await fsAuth(":commit", { methode: "POST", corps: { writes: [{ update: doc(`abonnes/${S.uid}`, { email: S.email, depuis: new Date() }) }] } });
    },
  };

  /* ---------- actions du joueur ---------- */
  const pseudoLibre = async pseudo => { try { return (await lisDoc(`pseudos/${seg(idPseudo(pseudo))}`, false)) === null; } catch (e) { return null; } };
  async function cree(email, mdp, profil) {
    if ((await pseudoLibre(profil.pseudo)) === false) throw new Error(Tr("Ce pseudo est déjà pris : choisissez-en un autre.", "This username is taken: please choose another."));
    pose(await identite("signUp", { email, password: mdp, returnSecureToken: true }), email);
    registre(S.uid); Y.pseudo = ""; Y.hash = ""; Y.carnets = {}; Y.pousses = {};
    API.interne.ecrire({ ...API.interne.lire(), profil }, true);
    await synchro("pousse");
    if (!etatSynchro.ok) throw new Error(etatSynchro.msg);
  }
  async function connecte(email, mdp) {
    pose(await identite("signInWithPassword", { email, password: mdp, returnSecureToken: true }), email);
    await synchro();
    if (!etatSynchro.ok) throw new Error(etatSynchro.msg);
  }
  async function deconnecte() { ecrireS(null); dit(); }                      // les jetons n'ont pas de point de sortie à appeler : on les oublie
  /* supprimer le compte : on se reconnecte d'abord (Firebase l'exige pour cet acte : mot de passe, ou à nouveau la fenêtre de Google),
     puis on efface les documents, puis le compte */
  async function supprime(mdp) {
    if (!S) throw new Error("Reconnectez-vous d'abord.");
    if (S.via === "google") {
      const d = await viaGoogle();
      if (d.localId !== S.uid) throw new Error(Tr("Ce n'est pas le compte Google de ce profil : rien n'a été supprimé.", "This isn't the Google account of this profile: nothing was deleted."));
      pose(d, d.email, "google");
    } else {
      if (!S.email) throw new Error("Reconnectez-vous d'abord.");
      pose(await identite("signInWithPassword", { email: S.email, password: mdp, returnSecureToken: true }), S.email);
    }
    const uid = S.uid, y = registre(uid), dernier = [];
    const pf = await lisDoc(`profils/${seg(uid)}`), scores = await requete(FS + ":runQuery", { methode: "POST", auth: true, corps: { structuredQuery: { from: [{ collectionId: "scores" }], where: { fieldFilter: { field: { fieldPath: "uid" }, op: "EQUAL", value: { stringValue: uid } } }, limit: 2000 } } });
    const cs = await liste(`profils/${seg(uid)}/carnets`), bs = await liste(`profils/${seg(uid)}/bibliotheque`);
    for (const s of nettoie(scores, "document")) dernier.push(s.document.name);
    for (const c of cs) dernier.push(`${RACINE}/profils/${uid}/carnets/${c.id}`);
    for (const b of bs) dernier.push(`${RACINE}/profils/${uid}/bibliotheque/${b.id}`);
    dernier.push(`${RACINE}/abonnes/${uid}`);
    const pseudo = (pf && pf.pseudo ? idPseudo(pf.pseudo) : "") || y.pseudo;
    const ps = pseudo ? await lisDoc(`pseudos/${seg(pseudo)}`, false) : null;          // un commit est tout ou rien : n'effacer que ce qui existe et nous appartient
    if (ps && ps.uid === uid) dernier.push(`${RACINE}/pseudos/${pseudo}`);
    dernier.push(`${RACINE}/profils/${uid}`);
    for (const lot of parTrancheDe(dernier, 400)) await fsAuth(":commit", { methode: "POST", corps: { writes: lot.map(name => ({ delete: name })) } });      // 500 écritures au plus par commit
    await identite("delete", { idToken: S.idToken });
    ecrireS(null); Y = null; try { localStorage.removeItem(CLE_Y); } catch (e) { /* idem */ }
    dit();
  }

  /* ---------- classements (lecture publique) ---------- */
  const filtre = (champ, op, valeur) => ({ fieldFilter: { field: { fieldPath: champ }, op, value: enc(valeur) } });
  async function profilsDe(uids) {
    if (!uids.length) return {};
    const r = await requete(FS + ":batchGet", { methode: "POST", corps: { documents: [...new Set(uids)].map(u => `${RACINE}/profils/${u}`) } });
    const out = {};
    for (const x of r || []) if (x.found) out[x.found.name.split("/").pop()] = decChamps(x.found.fields);
    return out;
  }
  /* un classement se garde trente secondes dans l'onglet : chaque lecture de document compte dans le quota gratuit de Firebase */
  const enCache = async (cle, frais, charge, duree = 30000) => {
    try { const c = JSON.parse(sessionStorage.getItem("armorial.cl." + cle) || "null"); if (!frais && c && Date.now() - c.t < duree) return c.v; } catch (e) { /* sans cache */ }
    const v = await charge();
    try { sessionStorage.setItem("armorial.cl." + cle, JSON.stringify({ t: Date.now(), v })); } catch (e) { /* idem */ }
    return v;
  };
  /* combien de documents répondent à ce filtre : une lecture, sans les lire tous ; sans réponse, le classement s'affiche quand même, sans ce nombre */
  const compte = async (collectionId, where) => {
    try {
      const r = await requete(FS + ":runAggregationQuery", { methode: "POST", corps: { structuredAggregationQuery: { structuredQuery: { from: [{ collectionId }], where }, aggregations: [{ alias: "n", count: {} }] } } });
      const x = (r || []).find(y => y.result);
      return x ? +x.result.aggregateFields.n.integerValue : null;
    } catch (e) { return null; }
  };
  /* Les meilleurs du jour : on lit jusqu'à cent victoires et on les classe ici par points, qui ne sont pas enregistrés (les jeux sans points : par le
     moins d'essais). Avec l'index composite
     de SETUP.md (étape 5) et « "index": true » dans data/compte.json, ces cent-là sont celles qui ont demandé le moins d'essais. */
  API.classementJour = (jeu, jour, { frais = false } = {}) => enCache(`j|${jeu}|${jour}`, frais, async () => {
    const requ = sq => requete(FS + ":runQuery", { methode: "POST", corps: { structuredQuery: { from: [{ collectionId: "scores" }], where: filtre("vic", "EQUAL", `${jeu}|${+jour}`), ...sq } } });
    let r = null;
    if (CFG.index) {                                              // « index »: true dans data/compte.json : l'index existe (même s'il se construit encore, on retombe sur la lecture simple)
      try { r = await requ({ orderBy: [{ field: { fieldPath: "essais" }, direction: "ASCENDING" }, { field: { fieldPath: "cree" }, direction: "ASCENDING" }], limit: 100 }); }
      catch (e) { if (e.code !== "FAILED_PRECONDITION") throw e; }
    }
    if (!r) r = await requ({ limit: 100 });
    const tous = nettoie(r, "document").map(x => decChamps(x.document.fields)).map(x => ({ ...x, details: x.details | 0, points: API.points[jeu] ? API.points[jeu](x.essais, x.details | 0) : -x.essais })).sort((a, b) => b.points - a.points || (a.cree < b.cree ? -1 : 1));
    const top = tous.slice(0, 10), pf = await profilsDe(top.map(x => x.uid));
    const [gagnants, joueurs] = await Promise.all([compte("scores", filtre("vic", "EQUAL", `${jeu}|${+jour}`)), compte("scores", { compositeFilter: { op: "AND", filters: [filtre("jeu", "EQUAL", jeu), filtre("jour", "EQUAL", +jour)] } })]);
    return { top: top.filter(x => pf[x.uid]).map(x => ({ pseudo: pf[x.uid].pseudo, armes: pf[x.uid].armes, essais: x.essais, details: x.details, points: x.points, cumul: pf[x.uid].points || 0 })),
      points: tous.map(x => x.points), gagnants: gagnants === null ? tous.length : gagnants, joueurs };
  });
  /* Les meilleurs selon un champ du profil, tel que chacun l'a envoyé à sa dernière visite ; « moi » : mes points, pour dire ma place */
  const meilleursPar = async (champ, limit) => {
    const r = await requete(FS + ":runQuery", { methode: "POST", corps: { structuredQuery: { from: [{ collectionId: "profils" }], where: filtre(champ, "GREATER_THAN", 0), orderBy: [{ field: { fieldPath: champ }, direction: "DESCENDING" }], limit } } });
    return nettoie(r, "document").map(x => decChamps(x.document.fields)).filter(p => p.pseudo)
      .map(p => ({ pseudo: p.pseudo, armes: p.armes, points: p[champ], cumul: p.points || 0, victoires: Object.keys(API.points).reduce((t, jeu) => t + (p[`v_${jeu}`] || 0), 0) }));
  };
  const classementPar = (champ, frais, moi) => enCache(`p|${champ}|${moi}`, frais, async () => {
    const [top, total, devant] = await Promise.all([meilleursPar(champ, 10), compte("profils", filtre(champ, "GREATER_THAN", 0)), moi ? compte("profils", filtre(champ, "GREATER_THAN", moi)) : null]);
    return { top, total, devant };
  });
  API.classementGeneral = ({ frais = false, moi = 0 } = {}) => classementPar("points", frais, moi);
  API.classementSemaine = (w, { frais = false, moi = 0 } = {}) => classementPar(`s_${w}`, frais, moi);
  /* Le tableau d'honneur : le ou les premiers d'une semaine finie ; il ne change plus guère, d'où le cache d'une heure */
  API.honneur = w => enCache(`h|${w}`, false, async () => {
    const l = await meilleursPar(`s_${w}`, 3);
    return l.filter(x => x.points === l[0].points);
  }, 3600000);
  /* ---------- les maisons : un petit classement entre amis, pour qui a le code ---------- */
  const SIGNES_MAISON = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";     // sans 0, O, 1 ni I : le code se recopie sans erreur ; le même alphabet dans firestore.rules
  const poseMaison = async maison => {
    const M = API.interne.lire(), { maison: ancienne, ...profil } = M.profil;
    API.interne.ecrire({ ...M, profil: maison ? { ...profil, maison } : profil }, true);
    await synchro("pousse");
    if (!etatSynchro.ok) throw new Error(etatSynchro.msg);
  };
  API.maison = {
    lis: code => lisDoc(`maisons/${seg(code)}`, false),
    async fonde(nom) {
      nom = String(nom).trim().replace(/\s+/g, " ");
      if (nom.length < 2 || nom.length > 40 || /[<>]/.test(nom)) throw new Error(Tr("Le nom d'une maison compte de 2 à 40 caractères, sans < ni >.", "A house name has 2 to 40 characters, without < or >."));
      for (let essai = 0; ; essai++) {                          // un code peut déjà être pris : on en tire un autre
        const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), o => SIGNES_MAISON[o % SIGNES_MAISON.length]).join("");
        try { await fsAuth(":commit", { methode: "POST", corps: { writes: [{ update: doc(`maisons/${code}`, { nom, cree: new Date() }), currentDocument: { exists: false } }] } }); await poseMaison(code); return code; }
        catch (e) { if (essai >= 2 || (e.code !== "ALREADY_EXISTS" && e.statut !== 409)) throw e; }
      }
    },
    async rejoint(code) {
      code = String(code).trim().toUpperCase();
      if (!/^[A-Z2-9]{6}$/.test(code) || !(await API.maison.lis(code))) throw new Error(Tr("Aucune maison ne porte ce code.", "No house has this code."));
      await poseMaison(code);
    },
    quitte: () => poseMaison(null),
    /* ses membres, classés sur la semaine w */
    async membres(code, w) {
      const r = await requete(FS + ":runQuery", { methode: "POST", corps: { structuredQuery: { from: [{ collectionId: "profils" }], where: filtre("maison", "EQUAL", code), limit: 100 } } });
      return nettoie(r, "document").map(x => decChamps(x.document.fields)).filter(p => p.pseudo)
        .map(p => ({ pseudo: p.pseudo, armes: p.armes, points: p[`s_${w}`] || 0, cumul: p.points || 0 })).sort((a, b) => b.points - a.points || (a.pseudo < b.pseudo ? -1 : 1));
    },
  };

  /* ---------- les jeux du jour : jours/{n}, lisible seulement une fois le jour venu (heure du serveur, voir firestore.rules) ---------- */
  API.jour = async n => {
    try { return await lisDoc(`jours/${+n}`, false); }
    catch (e) { if (e.code === "PERMISSION_DENIED") return null; throw e; }       // un jour qui n'est pas encore ouvert
  };
  API.uid = () => (S ? S.uid : "");
  /* le curateur seul (son uid est dans firestore.rules) : écrit le calendrier, quatre cents jours par envoi au plus */
  API.ecritJours = async jours => {
    if (!S) throw new Error("Connectez-vous d'abord.");
    for (const lot of parTrancheDe(jours, 400)) await fsAuth(":commit", { methode: "POST", corps: { writes: lot.map(j => ({ update: doc(`jours/${j.n}`, j.champs) })) } });
  };

  /* ---------- la section « Compte en ligne » de la fenêtre du profil ---------- */
  const brouillonLigne = { email: "", mdp: "", msg: "", supprime: false, mdpOuvert: false };
  const G = `<svg viewBox="0 0 48 48" aria-hidden="true" width="20" height="20"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;
  const ligne = {
    connecte: () => !!S,
    pseudoLibre,
    vue(profil) {
      if (S) return `<section class="cpt-ligne" aria-labelledby="cpt-ligne-t"><h3 id="cpt-ligne-t">${Tr("Compte en ligne", "Online account")}</h3>
        <p>${Tr(`Connecté${S.via === "google" ? " avec Google" : ""}${profil ? ` sous le pseudo <b>${esc(profil.pseudo)}</b>` : ""} : vos scores vous suivent d'un appareil à l'autre, vous figurez au classement, et vos armes se gardent dans votre bibliothèque.`, `Logged in${S.via === "google" ? " with Google" : ""}${profil ? ` as <b>${esc(profil.pseudo)}</b>` : ""}: your scores follow you from one device to another, you appear on the leaderboard, and your arms are kept in your library.`)}</p>
        ${profil ? "" : `<p class="cpt-err" role="alert">${Tr("Choisissez un pseudo ci-dessus, puis « Créer mon profil » : c'est lui qui vous représente au classement.", "Choose a username above, then “Create my profile”: it represents you on the leaderboard.")}</p>`}
        ${etatSynchro.ok ? "" : `<p class="cpt-err" role="alert">${Tr("Synchronisation impossible :", "Sync failed:")} ${esc(etatSynchro.msg)}</p>`}
        ${S.email ? `<label class="cpt-case"><input type="checkbox" id="cpt-nouvelles" disabled><span>${Tr(`M'écrire à <b>${esc(S.email)}</b> quand l'Armorial a du nouveau : nouveaux jeux, grandes mises à jour, quelques messages par an au plus. Décochez pour vous désinscrire.`, `Write to me at <b>${esc(S.email)}</b> when the Armorial has news: new games, major updates, a few messages a year at most. Untick to unsubscribe.`)}</span></label>` : ""}
        ${brouillonLigne.supprime
          ? (S.via === "google"
            ? `<div class="cpt-supp"><p>${Tr("Supprimer le compte efface en ligne votre pseudo, vos scores, votre bibliothèque et votre inscription aux nouvelles. Google vous demandera de confirmer.", "Deleting the account erases your username, scores, library and news subscription online. Google will ask you to confirm.")}</p>
                <div class="cpt-acts"><button type="button" class="main" data-act="supprime-google">${Tr("Confirmer avec Google et supprimer", "Confirm with Google and delete")}</button><button type="button" class="lnk" data-act="supprime-non">${Tr("Annuler", "Cancel")}</button></div>
                <p class="cpt-err" id="cpt-ligne-err" role="alert" hidden></p></div>`
            : `<form id="cpt-supp-form" novalidate><label class="cpt-lab" for="cpt-supp-mdp">${Tr("Pour supprimer, saisissez à nouveau votre mot de passe", "To delete, enter your password again")}</label>
              <input id="cpt-supp-mdp" type="password" autocomplete="current-password">
              <div class="cpt-acts"><button type="submit" class="main" data-act="supprime-ok">${Tr("Supprimer définitivement", "Delete permanently")}</button><button type="button" class="lnk" data-act="supprime-non">${Tr("Annuler", "Cancel")}</button></div>
              <p class="cpt-err" id="cpt-ligne-err" role="alert" hidden></p></form>`)
          : `<div class="cpt-acts"><button type="button" class="lnk" data-act="deco">${Tr("Se déconnecter", "Log out")}</button><button type="button" class="lnk" data-act="supprime">${Tr("Supprimer mon compte en ligne", "Delete my online account")}</button></div><p class="cpt-err" id="cpt-ligne-err" role="alert" hidden></p>`}
        <p class="cpt-ret" id="cpt-ligne-msg" role="status">${esc(brouillonLigne.msg)}</p></section>`;
      return `<section class="cpt-ligne" aria-labelledby="cpt-ligne-t"><h3 id="cpt-ligne-t">${Tr("Compte en ligne <small>facultatif</small>", "Online account <small>optional</small>")}</h3>
        <p>${Tr("Vos scores sur tous vos appareils, votre place au classement, et une bibliothèque pour garder les armes que vous composez dans l'Atelier.", "Your scores on all your devices, your place on the leaderboard, and a library for the arms you design in the Atelier.")}</p>
        <button type="button" class="cpt-google" data-act="google">${G}<span>${Tr("Continuer avec Google", "Continue with Google")}</span></button>
        <p class="cpt-err" id="cpt-ligne-err" role="alert" hidden></p>
        <details class="cpt-mdp"${brouillonLigne.mdpOuvert ? " open" : ""}><summary>${Tr("Ou avec un e-mail et un mot de passe", "Or with an e-mail and a password")}</summary>
        <form id="cpt-ligne-form" novalidate>
          <label class="cpt-lab" for="cpt-email">E-mail</label>
          <input id="cpt-email" type="email" autocomplete="email" inputmode="email" spellcheck="false" value="${esc(brouillonLigne.email)}">
          <label class="cpt-lab" for="cpt-mdp">${Tr("Mot de passe <span class=\"cpt-regle\">— 8 caractères au moins</span>", "Password <span class=\"cpt-regle\">— at least 8 characters</span>")}</label>
          <input id="cpt-mdp" type="password" autocomplete="current-password" minlength="8" value="${esc(brouillonLigne.mdp)}">
          <div class="cpt-acts"><button type="submit" class="main" data-act="cree">${Tr("Créer mon compte", "Create my account")}</button><button type="button" class="lnk" data-act="connecte">${Tr("J'ai déjà un compte : me connecter", "I already have an account: log in")}</button></div>
        </form></details>
        <p class="cpt-fine">${Tr("Gardés en ligne : votre e-mail (jamais montré), votre pseudo, vos armes, vos scores, votre bibliothèque. Vous pouvez tout supprimer d'ici, à tout moment.", "Kept online: your e-mail (never shown), username, arms, scores and library. You can delete everything from here at any time.")}</p>
        <p class="cpt-ret" id="cpt-ligne-msg" role="status">${esc(brouillonLigne.msg)}</p></section>`;
    },
    lie(dlg, ctx) {
      const racine = dlg.querySelector(".cpt-ligne");
      if (!racine) return;
      const erreur = m => { const e = dlg.querySelector("#cpt-ligne-err"); if (e) { e.textContent = m; e.hidden = !m; } };
      const msg = m => { brouillonLigne.msg = m; const e = dlg.querySelector("#cpt-ligne-msg"); if (e) e.textContent = m; };
      const travaille = async (bouton, f) => {
        brouillonLigne.msg = ""; erreur(""); bouton.disabled = true; const avant = bouton.innerHTML; bouton.textContent = Tr("Un instant…", "One moment…");
        try { await f(); } catch (e) { erreur(e.message); } finally { bouton.disabled = false; bouton.innerHTML = avant; }
      };
      const d = racine.querySelector(".cpt-mdp");
      if (d) d.addEventListener("toggle", () => { brouillonLigne.mdpOuvert = d.open; });
      const form = dlg.querySelector("#cpt-ligne-form");
      if (form) {
        form.addEventListener("input", e => { if (e.target.id === "cpt-email") brouillonLigne.email = e.target.value; if (e.target.id === "cpt-mdp") brouillonLigne.mdp = e.target.value; });
        const lit = () => {
          const email = form.querySelector("#cpt-email").value.trim(), mdp = form.querySelector("#cpt-mdp").value;
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { erreur(Tr("Saisissez une adresse e-mail valide.", "Please enter a valid e-mail address.")); return null; }
          if (mdp.length < 8) { erreur(Tr("Le mot de passe compte 8 caractères au moins.", "The password must have at least 8 characters.")); return null; }
          erreur(""); return { email, mdp };
        };
        form.addEventListener("submit", async e => {
          e.preventDefault();
          const id = lit(); if (!id) return;
          const profil = ctx.profil(); if (!profil) { ctx.pseudoManquant(); return; }
          await travaille(form.querySelector('[data-act="cree"]'), async () => {
            await cree(id.email, id.mdp, profil);
            brouillonLigne.mdp = ""; brouillonLigne.msg = Tr("Compte créé : vous êtes connecté.", "Account created: you're logged in."); ctx.refait();
          });
        });
        form.querySelector('[data-act="connecte"]').addEventListener("click", async e => {
          const id = lit(); if (!id) return;
          await travaille(e.currentTarget, async () => {
            await connecte(id.email, id.mdp);
            brouillonLigne.mdp = ""; msg(Tr("Connecté : la page se recharge…", "Logged in: the page is reloading…")); setTimeout(() => location.reload(), 700);      // le jeu repart des carnets fondus
          });
        });
      }
      const supp = dlg.querySelector("#cpt-supp-form");
      if (supp) supp.addEventListener("submit", async e => {
        e.preventDefault();
        const mdp = supp.querySelector("#cpt-supp-mdp").value;
        if (!mdp) { erreur(Tr("Saisissez votre mot de passe.", "Please enter your password.")); return; }
        await travaille(supp.querySelector('[data-act="supprime-ok"]'), async () => {
          await supprime(mdp);
          brouillonLigne.supprime = false; brouillonLigne.msg = Tr("Compte en ligne supprimé (e-mail, pseudo, scores, bibliothèque). Vos scores restent sur cet appareil.", "Online account deleted (e-mail, username, scores, library). Your scores remain on this device."); ctx.refait();
        });
      });
      const nv = dlg.querySelector("#cpt-nouvelles");
      if (nv) {
        nouvelles.lit().then(oui => { nv.checked = oui; nv.disabled = false; }).catch(() => { nv.disabled = false; });
        nv.addEventListener("change", async () => {
          nv.disabled = true;
          try { await nouvelles.regle(nv.checked); msg(nv.checked ? Tr("C'est noté : vous recevrez les nouvelles de l'Armorial.", "Noted: you'll receive news from the Armorial.") : Tr("Désinscrit : plus aucun message.", "Unsubscribed: no more messages.")); }
          catch (e) { nv.checked = !nv.checked; erreur(e.message); }
          finally { nv.disabled = false; }
        });
      }
      racine.addEventListener("click", async e => {
        const b = e.target.closest("[data-act]"); if (!b || b.type === "submit") return;
        if (b.dataset.act === "google") {
          /* le pseudo déjà tapé devient le profil de ce navigateur : il partira avec la connexion, si le compte n'en a pas encore */
          const pf = ctx.profil(); if (pf && !API.profil()) ctx.enregistre(pf);
          await travaille(b, async () => {
            await avecGoogle();
            if (API.profil()) { msg(Tr("Connecté : la page se recharge…", "Logged in: the page is reloading…")); setTimeout(() => location.reload(), 700); }
            else { brouillonLigne.msg = Tr("Connecté avec Google.", "Logged in with Google."); ctx.refait(); }
          });
        }
        if (b.dataset.act === "supprime-google") await travaille(b, async () => {
          await supprime();
          brouillonLigne.supprime = false; brouillonLigne.msg = Tr("Compte en ligne supprimé (pseudo, scores, bibliothèque). Vos scores restent sur cet appareil.", "Online account deleted (username, scores, library). Your scores remain on this device."); ctx.refait();
        });
        if (b.dataset.act === "deco") { await deconnecte(); brouillonLigne.msg = Tr("Déconnecté. Vos scores restent sur cet appareil.", "Logged out. Your scores remain on this device."); ctx.refait(); }
        if (b.dataset.act === "supprime") { brouillonLigne.supprime = true; ctx.refait(); }
        if (b.dataset.act === "supprime-non") { brouillonLigne.supprime = false; ctx.refait(); }
      });
    },
  };

  /* ---------- départ ---------- */
  API.pret = (async () => {
    try {
      const r = await fetch("data/compte.json"), c = r.ok ? await r.json() : null;
      if (!c || !/^[a-z][a-z0-9-]{3,28}[a-z0-9]$/.test(c.projet || "") || !/^AIza[0-9A-Za-z_-]{30,50}$/.test(c.cle || "")) return;      // pas de compte en ligne : tout reste local
      const local = /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
      CFG = { projet: c.projet, cle: c.cle, index: c.index === true, domaine: /^[a-z0-9.-]+\.[a-z]{2,}$/.test(c.domaine || "") ? c.domaine : "", emulateur: local && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(c.emulateur || "") ? c.emulateur : "" };
    } catch (e) { return; }
    adresses();
    API.enLigne = true; API.mode = "en ligne"; API.ligne = ligne; API.biblio = biblio;
    ecrireS(lireS());
    if (S) await Promise.race([synchro(), new Promise(res => setTimeout(res, 3000))]);        // le jeu n'attend pas plus de trois secondes
  })();
})();
