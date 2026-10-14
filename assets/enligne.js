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
    EMAIL_EXISTS: "Un compte existe déjà avec cet e-mail : utilisez « me connecter ».",
    INVALID_LOGIN_CREDENTIALS: "E-mail ou mot de passe incorrect.", INVALID_PASSWORD: "E-mail ou mot de passe incorrect.", EMAIL_NOT_FOUND: "E-mail ou mot de passe incorrect.",
    WEAK_PASSWORD: "Mot de passe trop faible : 8 caractères au moins, mieux avec des chiffres et des lettres.", INVALID_EMAIL: "Adresse e-mail invalide.", MISSING_PASSWORD: "Saisissez un mot de passe.",
    TOO_MANY_ATTEMPTS_TRY_LATER: "Trop de tentatives : réessayez dans quelques minutes.", USER_DISABLED: "Ce compte est désactivé.",
    OPERATION_NOT_ALLOWED: "L'inscription par e-mail n'est pas activée dans Firebase (voir tools/firebase/SETUP.md, étape 2).",
    CREDENTIAL_TOO_OLD_LOGIN_AGAIN: "Session trop ancienne : reconnectez-vous, puis réessayez.",
    PERMISSION_DENIED: "Accès refusé par la base : les règles de tools/firebase/firestore.rules ne sont pas publiées, ou ne correspondent pas (voir SETUP.md, étape 3).",
    API_KEY_INVALID: "La clé web de data/compte.json n'est pas valable.", API_KEY_HTTP_REFERRER_BLOCKED: "Cette clé web est limitée à d'autres adresses de site (Google Cloud → Identifiants).",
  };
  function erreurDe(data, statut) {
    const corps = Array.isArray(data) ? data[0] : data;                   // runQuery et batchGet répondent leurs erreurs dans un tableau
    const e = corps && corps.error, brut = e && e.message ? String(e.message) : "";
    const code = (e && e.status && e.status !== "UNKNOWN" ? e.status : brut.split(/[\s:]/)[0]) || String(statut);
    const out = new Error(MOTIFS[code] || MOTIFS[brut.split(/[\s:]/)[0]] || brut || `Erreur ${statut}`);
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
    catch (e) { const err = new Error("Le service en ligne ne répond pas : vérifiez votre connexion."); err.reseau = true; throw err; }
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
      profil = { pseudo: pf.pseudo, armes: API.armesCode(pf.armes), cree: String(pf.cree || "").slice(0, 10) || (M.profil && M.profil.cree) || "" };
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
    /* ce qu'on dit de soi pour le classement général : parties, victoires, essais moyens de chaque jeu */
    const resume = {}, nouveauxScores = [];
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
        const writes = [{ update: doc(`profils/${uid}`, { pseudo: M.profil.pseudo, armes: M.profil.armes, cree: M.profil.cree, ...resume }) }];
        if (y.pseudo !== nouveau) {
          if (y.pseudo) writes.push({ delete: `${RACINE}/pseudos/${y.pseudo}` });
          writes.push({ update: doc(`pseudos/${nouveau}`, { uid, pseudo: M.profil.pseudo }), currentDocument: { exists: false } });
        }
        try { await fsAuth(":commit", { methode: "POST", corps: { writes } }); }
        catch (e) { if (e.code === "ALREADY_EXISTS" || e.statut === 409) { const p = new Error("Ce pseudo est déjà pris : modifiez-le dans votre profil."); p.code = "pseudo"; throw p; } throw e; }
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
    } catch (e) { throw new Error("Le module de connexion de Google n'a pas pu se charger : vérifiez votre connexion."); }
    const auth = A.initializeAuth(app, { persistence: A.inMemoryPersistence, popupRedirectResolver: A.browserPopupRedirectResolver });
    auth.languageCode = "fr";
    return (fb = { A, auth });
  }
  const MOTIFS_GOOGLE = {
    "auth/popup-closed-by-user": "Connexion annulée.", "auth/cancelled-popup-request": "Connexion annulée.", "auth/user-cancelled": "Connexion annulée.",
    "auth/popup-blocked": "Le navigateur a bloqué la fenêtre de Google : autorisez les fenêtres surgissantes pour ce site, puis réessayez.",
    "auth/unauthorized-domain": "Ce site n'est pas encore autorisé pour la connexion Google (Firebase → Authentication → Settings → Authorized domains).",
    "auth/operation-not-allowed": "La connexion Google n'est pas activée dans Firebase (Authentication → Sign-in method).",
    "auth/account-exists-with-different-credential": "Un compte existe déjà avec cet e-mail et un mot de passe : connectez-vous avec l'e-mail.",
    "auth/network-request-failed": "Le service en ligne ne répond pas : vérifiez votre connexion.",
  };
  async function viaGoogle() {
    if (CFG.emulateur) {                                                  // essais en local (mock_firebase.py) : pas de fenêtre Google, un e-mail de test
      const email = (window.prompt("Essai local : l'e-mail du compte Google simulé", "joueur@example.com") || "").trim();
      if (!email) throw new Error("Connexion annulée.");
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
      if (!S) throw new Error("La bibliothèque est réservée aux comptes en ligne.");
      if ((await biblio.liste()).length >= BIBLIO_MAX) throw new Error(`Votre bibliothèque est pleine (${BIBLIO_MAX} armes) : retirez-en avant d'en ajouter.`);
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
      if (!S.email) throw new Error("Aucune adresse e-mail n'est liée à ce compte.");
      await fsAuth(":commit", { methode: "POST", corps: { writes: [{ update: doc(`abonnes/${S.uid}`, { email: S.email, depuis: new Date() }) }] } });
    },
  };

  /* ---------- actions du joueur ---------- */
  const pseudoLibre = async pseudo => { try { return (await lisDoc(`pseudos/${seg(idPseudo(pseudo))}`, false)) === null; } catch (e) { return null; } };
  async function cree(email, mdp, profil) {
    if ((await pseudoLibre(profil.pseudo)) === false) throw new Error("Ce pseudo est déjà pris : choisissez-en un autre.");
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
      if (d.localId !== S.uid) throw new Error("Ce n'est pas le compte Google de ce profil : rien n'a été supprimé.");
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
  const enCache = async (cle, frais, charge) => {
    try { const c = JSON.parse(sessionStorage.getItem("armorial.cl." + cle) || "null"); if (!frais && c && Date.now() - c.t < 30000) return c.v; } catch (e) { /* sans cache */ }
    const v = await charge();
    try { sessionStorage.setItem("armorial.cl." + cle, JSON.stringify({ t: Date.now(), v })); } catch (e) { /* idem */ }
    return v;
  };
  /* Les meilleurs du jour. Avec l'index composite de SETUP.md (étape 5) et « "index": true » dans data/compte.json, Firestore trie
     et ne renvoie que dix résultats ; sans lui, on lit jusqu'à cent résultats et on trie ici : même classement, plus de lectures. */
  API.classementJour = (jeu, jour, { frais = false } = {}) => enCache(`j|${jeu}|${jour}`, frais, async () => {
    const requ = sq => requete(FS + ":runQuery", { methode: "POST", corps: { structuredQuery: { from: [{ collectionId: "scores" }], where: filtre("vic", "EQUAL", `${jeu}|${+jour}`), ...sq } } });
    let r = null;
    if (CFG.index) {                                              // « index »: true dans data/compte.json : l'index existe (même s'il se construit encore, on retombe sur la lecture simple)
      try { r = await requ({ orderBy: [{ field: { fieldPath: "essais" }, direction: "ASCENDING" }, { field: { fieldPath: "cree" }, direction: "ASCENDING" }], limit: 30 }); }      // trente : à essais égaux, les détails départagent ici
      catch (e) { if (e.code !== "FAILED_PRECONDITION") throw e; }
    }
    if (!r) r = await requ({ limit: 100 });
    const top = nettoie(r, "document").map(x => decChamps(x.document.fields)).sort((a, b) => a.essais - b.essais || (a.details | 0) - (b.details | 0) || (a.cree < b.cree ? -1 : 1)).slice(0, 10);
    const pf = await profilsDe(top.map(x => x.uid));
    return top.filter(x => pf[x.uid]).map(x => ({ pseudo: pf[x.uid].pseudo, armes: pf[x.uid].armes, essais: x.essais, details: x.details | 0 }));
  });
  API.classementGeneral = (jeu, { frais = false } = {}) => enCache(`g|${jeu}`, frais, async () => {
    if (!/^[a-z0-9_]+$/.test(jeu)) return [];
    const v = `v_${jeu}`, r = await requete(FS + ":runQuery", { methode: "POST", corps: { structuredQuery: { from: [{ collectionId: "profils" }], where: filtre(v, "GREATER_THAN", 0), orderBy: [{ field: { fieldPath: v }, direction: "DESCENDING" }], limit: 30 } } });
    return nettoie(r, "document").map(x => decChamps(x.document.fields)).filter(p => p.pseudo)
      .map(p => ({ pseudo: p.pseudo, armes: p.armes, joues: p[`j_${jeu}`] || 0, victoires: p[v] || 0, essais_moyens: p[`m_${jeu}`] || 0 }))
      .sort((a, b) => b.victoires - a.victoires || a.essais_moyens - b.essais_moyens).slice(0, 10);
  });

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
      if (S) return `<section class="cpt-ligne" aria-labelledby="cpt-ligne-t"><h3 id="cpt-ligne-t">Compte en ligne</h3>
        <p>Connecté${S.via === "google" ? " avec Google" : ""}${profil ? ` sous le pseudo <b>${esc(profil.pseudo)}</b>` : ""} : vos scores vous suivent d'un appareil à l'autre, vous figurez au classement, et vos armes se gardent dans votre bibliothèque.</p>
        ${profil ? "" : `<p class="cpt-err" role="alert">Choisissez un pseudo ci-dessus, puis « Créer mon profil » : c'est lui qui vous représente au classement.</p>`}
        ${etatSynchro.ok ? "" : `<p class="cpt-err" role="alert">Synchronisation impossible : ${esc(etatSynchro.msg)}</p>`}
        ${S.email ? `<label class="cpt-case"><input type="checkbox" id="cpt-nouvelles" disabled><span>M'écrire à <b>${esc(S.email)}</b> quand l'Armorial a du nouveau : nouveaux jeux, grandes mises à jour, quelques messages par an au plus. Décochez pour vous désinscrire.</span></label>` : ""}
        ${brouillonLigne.supprime
          ? (S.via === "google"
            ? `<div class="cpt-supp"><p>Supprimer le compte efface en ligne votre pseudo, vos scores, votre bibliothèque et votre inscription aux nouvelles. Google vous demandera de confirmer.</p>
                <div class="cpt-acts"><button type="button" class="main" data-act="supprime-google">Confirmer avec Google et supprimer</button><button type="button" class="lnk" data-act="supprime-non">Annuler</button></div>
                <p class="cpt-err" id="cpt-ligne-err" role="alert" hidden></p></div>`
            : `<form id="cpt-supp-form" novalidate><label class="cpt-lab" for="cpt-supp-mdp">Pour supprimer, saisissez à nouveau votre mot de passe</label>
              <input id="cpt-supp-mdp" type="password" autocomplete="current-password">
              <div class="cpt-acts"><button type="submit" class="main" data-act="supprime-ok">Supprimer définitivement</button><button type="button" class="lnk" data-act="supprime-non">Annuler</button></div>
              <p class="cpt-err" id="cpt-ligne-err" role="alert" hidden></p></form>`)
          : `<div class="cpt-acts"><button type="button" class="lnk" data-act="deco">Se déconnecter</button><button type="button" class="lnk" data-act="supprime">Supprimer mon compte en ligne</button></div><p class="cpt-err" id="cpt-ligne-err" role="alert" hidden></p>`}
        <p class="cpt-ret" id="cpt-ligne-msg" role="status">${esc(brouillonLigne.msg)}</p></section>`;
      return `<section class="cpt-ligne" aria-labelledby="cpt-ligne-t"><h3 id="cpt-ligne-t">Compte en ligne <small>facultatif</small></h3>
        <p>Vos scores sur tous vos appareils, votre place au classement, et une bibliothèque pour garder les armes que vous composez dans l'Atelier.</p>
        <button type="button" class="cpt-google" data-act="google">${G}<span>Continuer avec Google</span></button>
        <p class="cpt-err" id="cpt-ligne-err" role="alert" hidden></p>
        <details class="cpt-mdp"${brouillonLigne.mdpOuvert ? " open" : ""}><summary>Ou avec un e-mail et un mot de passe</summary>
        <form id="cpt-ligne-form" novalidate>
          <label class="cpt-lab" for="cpt-email">E-mail</label>
          <input id="cpt-email" type="email" autocomplete="email" inputmode="email" spellcheck="false" value="${esc(brouillonLigne.email)}">
          <label class="cpt-lab" for="cpt-mdp">Mot de passe <span class="cpt-regle">— 8 caractères au moins</span></label>
          <input id="cpt-mdp" type="password" autocomplete="current-password" minlength="8" value="${esc(brouillonLigne.mdp)}">
          <div class="cpt-acts"><button type="submit" class="main" data-act="cree">Créer mon compte</button><button type="button" class="lnk" data-act="connecte">J'ai déjà un compte : me connecter</button></div>
        </form></details>
        <p class="cpt-fine">Gardés en ligne : votre e-mail (jamais montré), votre pseudo, vos armes, vos scores, votre bibliothèque. Vous pouvez tout supprimer d'ici, à tout moment.</p>
        <p class="cpt-ret" id="cpt-ligne-msg" role="status">${esc(brouillonLigne.msg)}</p></section>`;
    },
    lie(dlg, ctx) {
      const racine = dlg.querySelector(".cpt-ligne");
      if (!racine) return;
      const erreur = m => { const e = dlg.querySelector("#cpt-ligne-err"); if (e) { e.textContent = m; e.hidden = !m; } };
      const msg = m => { brouillonLigne.msg = m; const e = dlg.querySelector("#cpt-ligne-msg"); if (e) e.textContent = m; };
      const travaille = async (bouton, f) => {
        brouillonLigne.msg = ""; erreur(""); bouton.disabled = true; const avant = bouton.innerHTML; bouton.textContent = "Un instant…";
        try { await f(); } catch (e) { erreur(e.message); } finally { bouton.disabled = false; bouton.innerHTML = avant; }
      };
      const d = racine.querySelector(".cpt-mdp");
      if (d) d.addEventListener("toggle", () => { brouillonLigne.mdpOuvert = d.open; });
      const form = dlg.querySelector("#cpt-ligne-form");
      if (form) {
        form.addEventListener("input", e => { if (e.target.id === "cpt-email") brouillonLigne.email = e.target.value; if (e.target.id === "cpt-mdp") brouillonLigne.mdp = e.target.value; });
        const lit = () => {
          const email = form.querySelector("#cpt-email").value.trim(), mdp = form.querySelector("#cpt-mdp").value;
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { erreur("Saisissez une adresse e-mail valide."); return null; }
          if (mdp.length < 8) { erreur("Le mot de passe compte 8 caractères au moins."); return null; }
          erreur(""); return { email, mdp };
        };
        form.addEventListener("submit", async e => {
          e.preventDefault();
          const id = lit(); if (!id) return;
          const profil = ctx.profil(); if (!profil) { ctx.pseudoManquant(); return; }
          await travaille(form.querySelector('[data-act="cree"]'), async () => {
            await cree(id.email, id.mdp, profil);
            brouillonLigne.mdp = ""; brouillonLigne.msg = "Compte créé : vous êtes connecté."; ctx.refait();
          });
        });
        form.querySelector('[data-act="connecte"]').addEventListener("click", async e => {
          const id = lit(); if (!id) return;
          await travaille(e.currentTarget, async () => {
            await connecte(id.email, id.mdp);
            brouillonLigne.mdp = ""; msg("Connecté : la page se recharge…"); setTimeout(() => location.reload(), 700);      // le jeu repart des carnets fondus
          });
        });
      }
      const supp = dlg.querySelector("#cpt-supp-form");
      if (supp) supp.addEventListener("submit", async e => {
        e.preventDefault();
        const mdp = supp.querySelector("#cpt-supp-mdp").value;
        if (!mdp) { erreur("Saisissez votre mot de passe."); return; }
        await travaille(supp.querySelector('[data-act="supprime-ok"]'), async () => {
          await supprime(mdp);
          brouillonLigne.supprime = false; brouillonLigne.msg = "Compte en ligne supprimé (e-mail, pseudo, scores, bibliothèque). Vos scores restent sur cet appareil."; ctx.refait();
        });
      });
      const nv = dlg.querySelector("#cpt-nouvelles");
      if (nv) {
        nouvelles.lit().then(oui => { nv.checked = oui; nv.disabled = false; }).catch(() => { nv.disabled = false; });
        nv.addEventListener("change", async () => {
          nv.disabled = true;
          try { await nouvelles.regle(nv.checked); msg(nv.checked ? "C'est noté : vous recevrez les nouvelles de l'Armorial." : "Désinscrit : plus aucun message."); }
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
            if (API.profil()) { msg("Connecté : la page se recharge…"); setTimeout(() => location.reload(), 700); }
            else { brouillonLigne.msg = "Connecté avec Google."; ctx.refait(); }
          });
        }
        if (b.dataset.act === "supprime-google") await travaille(b, async () => {
          await supprime();
          brouillonLigne.supprime = false; brouillonLigne.msg = "Compte en ligne supprimé (pseudo, scores, bibliothèque). Vos scores restent sur cet appareil."; ctx.refait();
        });
        if (b.dataset.act === "deco") { await deconnecte(); brouillonLigne.msg = "Déconnecté. Vos scores restent sur cet appareil."; ctx.refait(); }
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
