/* L'ARMORIAL — le compte du joueur : un pseudo, des armes à soi, et le carnet de chaque jeu.

   Tout reste d'abord dans ce navigateur (localStorage, facultatif : sans lui on joue sans mémoire). Le profil local, c'est un pseudo
   et des armes de joueur ; le carnet de chaque jeu garde les scores. Un code de sauvegarde passe le tout d'un appareil à l'autre.

   Les armes de joueur sont un écu de l'Atelier, entièrement libre : on les compose dans atelier.html (« Prendre pour mes armes »).
   On les garde sous la forme de l'adresse de l'Atelier (etatCode() de assets/dessin.js : « t1=Gueules&m=lion&nb=1&tm=Or »).
   Les anciens profils (un champ, un meuble, son émail) sont relus et convertis (armesCode).

   Les jeux ne parlent qu'à `Compte` (profil(), carnet(jeu), enregistre(jeu, carnet), sur(fn)). Les comptes en ligne (assets/enligne.js,
   Firebase) s'y branchent sans rien changer aux jeux. Points d'accroche : `Compte.ligne` (la section « Compte en ligne » de la fenêtre
   du profil), `Compte.fusion[jeu](local, distant)` (comment deux carnets d'un même jeu se fondent en un), `Compte.scoresDe[jeu](carnet)`
   (les parties terminées, pour le classement), que chaque jeu fournit ; `Compte.pret` est une promesse résolue quand la première
   synchronisation est faite ; `Compte.biblio` (la bibliothèque d'armes, réservée aux comptes en ligne).

   Le dessin : sur une page qui charge le moteur de l'Atelier (blasonnement.js, dessin.js et les données), Compte.prepare(code) dessine
   des armes et les garde ; Compte.dessin(code) rend le dessin déjà prêt (ou "" et le prépare). Sans moteur, les armes ne se dessinent pas. */
(() => {
  const CLE = "armorial.compte.v1", CLE_BROUILLON = "armorial.compte.brouillon";
  let M = { profil: null, carnets: {} };
  const abonnes = new Set();
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- les armes : l'état de l'Atelier, en une ligne ---------- */
  const EMAUX = ["Or", "Argent", "Gueules", "Azur", "Sable", "Sinople", "Pourpre"];
  const ANCIENS_MEUBLES = ["lion", "aigle", "etoile", "croissant", "fleurdelis", "coeur", "rose", "epee"];
  const ARMES_MAX = 2000;
  /* n'importe quelle valeur (un vieux profil, une base de données) → un code d'armes ; "" vaut l'écu par défaut de l'Atelier */
  const armesCode = a => {
    if (typeof a === "string") return a.length <= ARMES_MAX && !/[<>]/.test(a) ? a.replace(/^#/, "") : "";
    if (a && typeof a === "object" && EMAUX.includes(a.champ) && EMAUX.includes(a.tm) && ANCIENS_MEUBLES.includes(a.meuble))
      return `t1=${a.champ}&m=${a.meuble}&nb=1&tm=${a.tm}`;                     // les armes des premiers profils : « D'azur au lion d'or »
    return "";
  };
  /* des armes pour commencer, à reprendre dans l'Atelier ; toutes suivent la règle des émaux */
  const DEPARTS = ["t1=Gueules&m=lion&nb=1&tm=Or", "t1=Or&m=aigle&nb=1&tm=Sable", "t1=Azur&m=etoile&tm=Argent", "t1=Argent&m=&p=croix&tp=Gueules",
    "t1=Sinople&m=licorne&nb=1&tm=Argent", "t1=Sable&m=leopard&nb=1&tm=Or", "t1=Gueules&m=tour&nb=1&tm=Argent", "t1=Azur&m=dragon&nb=1&tm=Or",
    "t1=Argent&m=cerf&nb=1&tm=Gueules", "f=ray&ray=barry&t1=Argent&t2=Azur&m=", "t1=Pourpre&m=croissant&tm=Argent", "t1=Gueules&m=griffon&nb=1&tm=Or",
    "t1=Or&m=ours&nb=1&tm=Sable", "f=part&t1=Gueules&t2=Or&m=", "t1=Azur&m=coquille&tm=Or", "t1=Argent&m=merlette&tm=Sable"];
  const auHasard = (sauf = "") => { const l = DEPARTS.filter(x => x !== sauf); return l[Math.floor(Math.random() * l.length)]; };

  /* ---------- stockage ---------- */
  const propre = p => p && typeof p === "object" ? { pseudo: String(p.pseudo || ""), armes: armesCode(p.armes), cree: String(p.cree || "") } : null;
  const lire = () => { try { const m = JSON.parse(localStorage.getItem(CLE) || "null"); if (m && typeof m === "object") M = { profil: propre(m.profil), carnets: m.carnets || {} }; } catch (e) { /* navigation privée : on joue sans mémoire */ } };
  const ecrire = silencieux => { try { localStorage.setItem(CLE, JSON.stringify(M)); } catch (e) { /* idem */ } if (!silencieux) abonnes.forEach(f => { try { f(); } catch (e) { /* un abonné fautif ne gêne pas les autres */ } }); };
  lire();

  /* 2 à 24 caractères : lettres, chiffres, espace, _ . - ; commence par une lettre ou un chiffre (même règle dans tools/firebase/firestore.rules) */
  const pseudoValide = p => { const t = String(p).trim().replace(/\s+/g, " "); return /^[\p{L}\p{N}][\p{L}\p{N} _.\-]{1,23}$/u.test(t) ? t : ""; };
  const aujourdhui = () => new Date().toISOString().slice(0, 10);

  /* ---------- le dessin des armes (si la page charge le moteur de l'Atelier) ---------- */
  const DESSINS = new Map(), EN_COURS = new Map();
  let numero = 0;
  const moteur = () => typeof etatDe === "function" && typeof compose === "function" && typeof DATA !== "undefined" && DATA && typeof ATL !== "undefined" && ATL;
  const etatPret = code => { const St = etatDe(code); normalizeAll(St); return St; };
  function prepare(code) {
    code = armesCode(code);
    if (DESSINS.has(code)) return Promise.resolve(DESSINS.get(code));
    if (!moteur()) return Promise.resolve("");
    if (!EN_COURS.has(code)) EN_COURS.set(code, (async () => {
      const cur = typeof CUR !== "undefined" ? CUR : 0;                       // normalizeAll touche au quartier en cours de l'Atelier : on le lui rend
      try {
        const St = etatPret(code); await loadAll(St);
        const c = compose(St, "cpt" + ++numero);
        const svg = `<svg class="ecu" viewBox="${c.vb.join(" ")}" aria-hidden="true">${c.svg}</svg>`;
        DESSINS.set(code, svg); return svg;
      } catch (e) { DESSINS.set(code, ""); return ""; }
      finally { EN_COURS.delete(code); if (typeof CUR !== "undefined") CUR = cur; }
    })());
    return EN_COURS.get(code);
  }
  const dessin = code => { code = armesCode(code); if (DESSINS.has(code)) return DESSINS.get(code); prepare(code).then(() => API.actualiseEcu()); return ""; };
  const blasonDe = code => { try { if (!moteur()) return ""; const cur = typeof CUR !== "undefined" ? CUR : 0; const t = blazonAll(etatPret(armesCode(code))); if (typeof CUR !== "undefined") CUR = cur; return t; } catch (e) { return ""; } };

  /* ---------- l'interface publique ---------- */
  const API = {
    mode: "local",
    enLigne: false, ligne: null, biblio: null, pret: Promise.resolve(), fusion: {}, scoresDe: {},      // remplis par assets/enligne.js et par chaque jeu
    interne: { lire: () => M, ecrire(m, silencieux) { M = { profil: propre(m.profil), carnets: m.carnets || {} }; ecrire(silencieux); } },
    profil: () => M.profil,
    carnet: jeu => M.carnets[jeu] || null,
    enregistre(jeu, carnet) { M.carnets[jeu] = carnet; ecrire(); },
    sur(f) { abonnes.add(f); return () => abonnes.delete(f); },
    armesCode, prepare, dessin, blasonDe, pseudoValide, auHasard,
    /* « Prendre pour mes armes » (l'Atelier) : un profil existant change d'armes ; sinon la fenêtre s'ouvre pour choisir un pseudo */
    prendreArmes(code) {
      code = armesCode(code);
      if (M.profil) { M.profil = { ...M.profil, armes: code }; ecrire(); return true; }
      ouvre({ armes: code }); return false;
    },
    exporter() { try { return btoa(unescape(encodeURIComponent(JSON.stringify(M)))); } catch (e) { return ""; } },
    importer(code) {
      try {
        const m = JSON.parse(decodeURIComponent(escape(atob(String(code).trim()))));
        if (!m || typeof m !== "object" || (m.profil && typeof m.profil !== "object") || (m.carnets && typeof m.carnets !== "object")) return false;
        M = { profil: propre(m.profil), carnets: m.carnets || {} }; ecrire(); return true;
      } catch (e) { return false; }
    },
  };
  window.Compte = API;

  /* ---------- la fenêtre du profil ---------- */
  let dlg = null, brouillon = null, biblioListe = null, biblioErr = "";
  const surAtelier = () => /(^|\/)atelier\.html$/.test(location.pathname);
  const gardeBrouillon = () => { try { sessionStorage.setItem(CLE_BROUILLON, JSON.stringify(brouillon)); } catch (e) { /* idem */ } };
  const reprendBrouillon = () => { try { const b = JSON.parse(sessionStorage.getItem(CLE_BROUILLON) || "null"); sessionStorage.removeItem(CLE_BROUILLON); return b && typeof b === "object" ? b : null; } catch (e) { return null; } };

  function ouvre(opts = {}) {
    if (!dlg) {
      dlg = document.createElement("dialog"); dlg.className = "cpt"; dlg.setAttribute("aria-labelledby", "cpt-titre");
      dlg.addEventListener("click", e => { if (e.target === dlg || e.target.closest("[data-fermer]")) dlg.close(); });
      document.body.appendChild(dlg);
    }
    const p = M.profil, b = reprendBrouillon();
    brouillon = { pseudo: (b && b.pseudo) || (p ? p.pseudo : ""), armes: p ? p.armes : auHasard() };
    if (opts.armes !== undefined) brouillon.armes = armesCode(opts.armes);
    biblioListe = null; biblioErr = "";
    refait();
    if (!dlg.open) dlg.showModal();
    (dlg.querySelector("#cpt-pseudo") || dlg.querySelector("button")).focus();
    chargeBiblio();
  }
  const refait = () => { const pseudo = dlg.querySelector("#cpt-pseudo"); if (pseudo) brouillon.pseudo = pseudo.value; dlg.innerHTML = vue(); lie(); };

  async function chargeBiblio() {
    if (!API.biblio || !API.biblio.dispo()) return;
    try { biblioListe = await API.biblio.liste(); biblioErr = ""; } catch (e) { biblioErr = e.message; }
    await Promise.all((biblioListe || []).map(x => prepare(x.armes)));
    if (dlg && dlg.open) refait();
  }

  function vue() {
    const p = M.profil, b = brouillon, connecte = API.ligne && API.ligne.connecte();
    const versAtelier = surAtelier() ? "" : `atelier.html#${b.armes ? b.armes + "&" : ""}pour=profil`;
    const biblio = !API.biblio || !connecte ? ""
      : `<div class="cpt-biblio"><p class="cpt-lab">Ma bibliothèque</p>${biblioErr ? `<p class="cpt-err">${esc(biblioErr)}</p>`
        : !biblioListe ? `<p class="cpt-regle">Chargement…</p>`
        : biblioListe.length ? `<ul class="cpt-biblio-l">${biblioListe.map(x => `<li><button type="button" data-armes="${esc(x.armes)}" title="${esc(x.nom)}"${x.armes === b.armes ? ' aria-pressed="true"' : ""}><span class="cpt-mini">${dessin(x.armes)}</span><span>${esc(x.nom)}</span></button></li>`).join("")}</ul>`
        : `<p class="cpt-regle">Vide pour l'instant : dans l'Atelier, « Enregistrer dans ma bibliothèque ».</p>`}</div>`;
    return `<form method="dialog" class="cpt-f" id="cpt-form" novalidate>
      <button type="button" class="cpt-x" data-fermer aria-label="Fermer">×</button>
      <h2 id="cpt-titre">${p ? "Votre profil" : "Créer mon profil"}</h2>
      <p class="cpt-intro">${p ? "Votre pseudo et vos armes accompagnent vos scores." : "Un pseudo et des armes à vous : elles s'affichent à côté de vos scores."}</p>
      <div class="cpt-armes"><div class="cpt-ecu" id="cpt-ecu" aria-hidden="true">${dessin(b.armes)}</div>
        <div class="cpt-armes-t"><p class="cpt-blz" id="cpt-blz">${esc(blasonDe(b.armes))}</p>
          <p class="cpt-armes-acts">${versAtelier ? `<a class="cpt-btn" id="cpt-atelier" href="${esc(versAtelier)}">Composer mes armes dans l'Atelier</a>` : `<span class="cpt-regle">Composez vos armes ici même, puis « Prendre pour mes armes ».</span>`}
            <button type="button" class="cpt-btn cpt-btn-2" id="cpt-hasard">Au hasard</button></p></div></div>
      ${biblio}
      <label class="cpt-lab" for="cpt-pseudo">Pseudo</label>
      <input id="cpt-pseudo" name="pseudo" type="text" maxlength="24" autocomplete="nickname" spellcheck="false" value="${esc(b.pseudo)}" placeholder="Votre nom de héraut">
      <p class="cpt-err" id="cpt-err" role="alert" hidden></p>
      <div class="cpt-acts"><button type="submit" class="main">${p ? "Enregistrer" : "Créer mon profil"}</button>${p ? `<button type="button" id="cpt-efface" class="lnk">Effacer le profil</button>` : ""}</div>
      ${API.ligne ? "" : `<p class="cpt-note"><b>Où sont gardés vos scores ?</b> Dans ce navigateur, sur cet appareil, et nulle part ailleurs. Le code ci-dessous passe vos scores d'un appareil à l'autre.</p>`}
      <details class="cpt-sauve"><summary>Sauvegarde : exporter ou importer</summary>
        <label class="cpt-lab" for="cpt-code">Code de sauvegarde</label>
        <textarea id="cpt-code" rows="3" spellcheck="false" readonly>${esc(API.exporter())}</textarea>
        <div class="cpt-acts"><button type="button" id="cpt-copie" class="lnk">Copier le code</button><button type="button" id="cpt-import" class="lnk">Importer un code (remplace les scores de ce navigateur)</button></div>
        <p class="cpt-ret" id="cpt-ret" role="status"></p>
      </details>
    </form>${API.ligne ? API.ligne.vue(M.profil) : ""}`;
  }

  const profilDuFormulaire = () => {
    const pseudo = pseudoValide(dlg.querySelector("#cpt-pseudo").value);
    return pseudo ? { pseudo, armes: brouillon.armes, cree: (M.profil && M.profil.cree) || aujourdhui() } : null;
  };
  function lie() {
    const f = dlg.querySelector("#cpt-form"), err = dlg.querySelector("#cpt-err"), ret = dlg.querySelector("#cpt-ret"), code = dlg.querySelector("#cpt-code");
    const montre = m => { err.textContent = m; err.hidden = !m; };
    f.addEventListener("input", e => { if (e.target.name === "pseudo") brouillon.pseudo = e.target.value; });
    const atelier = dlg.querySelector("#cpt-atelier");
    if (atelier) atelier.addEventListener("click", gardeBrouillon);               // le pseudo tapé attend le retour de l'Atelier
    dlg.querySelector("#cpt-hasard").addEventListener("click", () => { brouillon.armes = auHasard(brouillon.armes); refait(); dlg.querySelector("#cpt-hasard").focus(); });
    dlg.querySelectorAll("[data-armes]").forEach(bt => bt.addEventListener("click", () => { brouillon.armes = armesCode(bt.dataset.armes); refait(); }));
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const pf = profilDuFormulaire();
      if (!pf) { montre("Le pseudo compte de 2 à 24 caractères : lettres, chiffres, espace, _ . -"); f.pseudo.focus(); return; }
      if (API.ligne && API.ligne.connecte() && (!M.profil || M.profil.pseudo.toLowerCase() !== pf.pseudo.toLowerCase()) && (await API.ligne.pseudoLibre(pf.pseudo)) === false) { montre("Ce pseudo est déjà pris : choisissez-en un autre."); f.pseudo.focus(); return; }
      M.profil = pf; ecrire(); dlg.close();
    });
    const efface = dlg.querySelector("#cpt-efface");
    if (efface) efface.addEventListener("click", () => {
      if (!efface.dataset.sur) { efface.dataset.sur = "1"; efface.textContent = "Confirmer : effacer le profil (les scores restent)"; return; }
      M.profil = null; ecrire(); dlg.close();
    });
    dlg.querySelector("#cpt-copie").addEventListener("click", async () => {
      code.select();
      try { await navigator.clipboard.writeText(code.value); ret.textContent = "Code copié."; } catch (e) { ret.textContent = "Sélectionné : copiez-le avec le clavier."; }
    });
    if (API.ligne) API.ligne.lie(dlg, {
      profil: profilDuFormulaire,
      enregistre: pf => { M.profil = pf; ecrire(); },
      refait: () => { refait(); chargeBiblio(); },
      ferme: () => dlg.close(),
      pseudoManquant: () => { montre("Choisissez d'abord un pseudo (2 à 24 caractères : lettres, chiffres, espace, _ . -) : il vous représentera au classement."); f.pseudo.focus(); },
    });
    dlg.querySelector("#cpt-import").addEventListener("click", () => {
      if (code.readOnly) { code.readOnly = false; code.value = ""; code.placeholder = "Collez ici le code d'un autre appareil, puis recliquez sur « Importer »."; code.focus(); return; }
      if (API.importer(code.value)) { ret.textContent = "Importé."; setTimeout(() => dlg.close(), 500); } else ret.textContent = "Ce code n'est pas lisible.";
    });
  }

  /* un dessin arrive : la fenêtre ouverte le reprend */
  API.actualiseEcu = () => {
    if (!dlg || !dlg.open || !brouillon) return;
    const e = dlg.querySelector("#cpt-ecu"); if (e && !e.firstChild) e.innerHTML = dessin(brouillon.armes);
    const t = dlg.querySelector("#cpt-blz"); if (t && !t.textContent) t.textContent = blasonDe(brouillon.armes);
    dlg.querySelectorAll("[data-armes]").forEach(bt => { const m = bt.querySelector(".cpt-mini"); if (m && !m.firstChild) m.innerHTML = dessin(bt.dataset.armes); });
  };
  API.ouvre = ouvre;
  /* retour de l'Atelier avec un pseudo en attente : la fenêtre se rouvre */
  API.reprendSiBrouillon = () => { try { if (sessionStorage.getItem(CLE_BROUILLON)) ouvre(); } catch (e) { /* idem */ } };
})();
