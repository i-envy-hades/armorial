/* L'ARMORIAL — le compte du joueur : un pseudo, des armes à soi, et le carnet de chaque jeu.

   Aujourd'hui tout reste dans ce navigateur (localStorage, facultatif : sans lui on joue sans mémoire). Le « compte »
   est un profil local : un pseudo et des armes de joueur, qui ne sont qu'un blasonnement (« D'azur au lion d'or »),
   et un carnet par jeu (les scores). Un code de sauvegarde permet de les passer d'un appareil à l'autre.

   Les jeux ne parlent qu'à `Compte` (profil(), carnet(jeu), enregistre(jeu, carnet), sur(fn)). Les comptes en ligne (assets/enligne.js,
   Firebase) s'y branchent sans rien changer aux jeux : tant que data/compte.json est vide, rien ne sort du navigateur.
   Points d'accroche : `Compte.ligne` (la section « Compte en ligne » de la fenêtre du profil), `Compte.fusion[jeu](local, distant)`
   (comment deux carnets d'un même jeu se fondent en un) et `Compte.scoresDe[jeu](carnet)` (les parties terminées, pour le classement),
   que chaque jeu fournit ; `Compte.pret` est une promesse résolue quand la première synchronisation est faite.

   La fenêtre du profil dessine les armes avec `Compte.dessin(texte) → svg` que la page fournit (le moteur de l'Atelier ; elle peut
   répondre vide et rappeler `Compte.actualiseEcu()` quand le dessin est prêt) ;
   le choix des armes enseigne au passage la règle des émaux : pas de métal sur métal, pas de couleur sur couleur. */
(() => {
  const CLE = "armorial.compte.v1";
  let M = { profil: null, carnets: {} };
  const abonnes = new Set();

  /* ---------- stockage : seul endroit à remplacer pour un service en ligne ---------- */
  const lire = () => { try { const m = JSON.parse(localStorage.getItem(CLE) || "null"); if (m && typeof m === "object") M = { profil: m.profil || null, carnets: m.carnets || {} }; } catch (e) { /* navigation privée : on joue sans mémoire */ } };
  const ecrire = silencieux => { try { localStorage.setItem(CLE, JSON.stringify(M)); } catch (e) { /* idem */ } if (!silencieux) abonnes.forEach(f => { try { f(); } catch (e) { /* un abonné fautif ne gêne pas les autres */ } }); };
  lire();

  /* ---------- les armes de joueur : un champ, un meuble, son émail ---------- */
  const METAUX = ["Or", "Argent"], COULEURS = ["Gueules", "Azur", "Sable", "Sinople", "Pourpre"];
  const MOT = { Or: "or", Argent: "argent", Gueules: "gueules", Azur: "azur", Sable: "sable", Sinople: "sinople", Pourpre: "pourpre" };
  const COULEUR = { Or: "#c9a63a", Argent: "#f4efe2", Gueules: "#8e1b18", Azur: "#20406e", Sable: "#211c17", Sinople: "#2f5a34", Pourpre: "#5c3566" };
  const de = t => (/^[aeiou]/.test(MOT[t]) ? "d'" : "de ") + MOT[t];
  const MEUBLES = [["lion", "au lion"], ["aigle", "à l'aigle"], ["etoile", "à l'étoile"], ["croissant", "au croissant"], ["fleurdelis", "à la fleur de lis"], ["coeur", "au cœur"], ["rose", "à la rose"], ["epee", "à l'épée"]];
  const NOM_MEUBLE = { lion: "Lion", aigle: "Aigle", etoile: "Étoile", croissant: "Croissant", fleurdelis: "Fleur de lis", coeur: "Cœur", rose: "Rose", epee: "Épée" };
  /* le blasonnement des armes de joueur ; "" si une valeur n'est pas de la liste (les armes des autres joueurs viennent d'une base de données : on ne s'y fie pas) */
  const armesTexte = a => {
    const { champ, meuble, tm } = a || {}, m = MEUBLES.find(x => x[0] === meuble);
    if (!own(MOT, champ) || !own(MOT, tm) || !m) return "";
    return `${de(champ).replace(/^d'/, "D'").replace(/^de /, "De ")} ${m[1]} ${de(tm)}`;
  };
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const emauxPour = champ => (METAUX.includes(champ) ? COULEURS : METAUX);         // la règle des émaux : l'inverse du champ

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  /* 2 à 24 caractères : lettres, chiffres, espace, _ . - ; commence par une lettre ou un chiffre (même règle dans tools/firebase/firestore.rules) */
  const pseudoValide = p => { const t = String(p).trim().replace(/\s+/g, " "); return /^[\p{L}\p{N}][\p{L}\p{N} _.\-]{1,23}$/u.test(t) ? t : ""; };

  /* ---------- l'interface publique ---------- */
  const API = {
    mode: "local",
    enLigne: false, ligne: null, pret: Promise.resolve(), fusion: {}, scoresDe: {},      // remplis par assets/enligne.js et par chaque jeu
    interne: { lire: () => M, ecrire(m, silencieux) { M = { profil: m.profil || null, carnets: m.carnets || {} }; ecrire(silencieux); } },
    profil: () => M.profil,
    carnet: jeu => M.carnets[jeu] || null,
    enregistre(jeu, carnet) { M.carnets[jeu] = carnet; ecrire(); },
    sur(f) { abonnes.add(f); return () => abonnes.delete(f); },
    dessin: null,                                    // fourni par la page : texte du blason → balise <svg>
    armesTexte,
    exporter() { try { return btoa(unescape(encodeURIComponent(JSON.stringify(M)))); } catch (e) { return ""; } },
    importer(code) {
      try {
        const m = JSON.parse(decodeURIComponent(escape(atob(String(code).trim()))));
        if (!m || typeof m !== "object" || (m.profil && typeof m.profil !== "object") || (m.carnets && typeof m.carnets !== "object")) return false;
        M = { profil: m.profil || null, carnets: m.carnets || {} }; ecrire(); return true;
      } catch (e) { return false; }
    },
  };
  window.Compte = API;

  /* ---------- la fenêtre du profil ---------- */
  let dlg = null, brouillon = null;
  const dessine = texte => { try { return API.dessin ? API.dessin(texte) : ""; } catch (e) { return ""; } };

  function ouvre() {
    if (!dlg) {
      dlg = document.createElement("dialog"); dlg.className = "cpt"; dlg.setAttribute("aria-labelledby", "cpt-titre");
      dlg.addEventListener("click", e => { if (e.target === dlg || e.target.closest("[data-fermer]")) dlg.close(); });
      document.body.appendChild(dlg);
    }
    const p = M.profil;
    brouillon = p ? { pseudo: p.pseudo, ...p.armes } : { pseudo: "", champ: "Azur", meuble: "lion", tm: "Or" };
    dlg.innerHTML = vue();
    lie();
    dlg.showModal();
    (dlg.querySelector("#cpt-pseudo") || dlg.querySelector("button")).focus();
  }

  function vue() {
    const p = M.profil, b = brouillon, tms = emauxPour(b.champ);
    if (!tms.includes(b.tm)) b.tm = tms[0];
    const texte = armesTexte(b);
    const swatch = (nom, nomChamp, coche, aria) => `<label class="cpt-sw" title="${esc(nom)}"><input type="radio" name="${nomChamp}" value="${nom}"${coche ? " checked" : ""}><span style="--c:${COULEUR[nom]}"><b class="sr">${esc(aria || nom)}</b></span></label>`;
    return `<form method="dialog" class="cpt-f" id="cpt-form" novalidate>
      <button type="button" class="cpt-x" data-fermer aria-label="Fermer">×</button>
      <h2 id="cpt-titre">${p ? "Votre profil" : "Créer mon profil"}</h2>
      <p class="cpt-intro">${p ? "Vos armes de joueur et votre pseudo accompagnent vos scores." : "Un pseudo et des armes à vous : elles s'affichent à côté de vos scores."}</p>
      <div class="cpt-armes"><div class="cpt-ecu" id="cpt-ecu" aria-hidden="true">${dessine(texte)}</div>
        <p class="cpt-blz" id="cpt-blz">${esc(texte)}</p></div>
      <label class="cpt-lab" for="cpt-pseudo">Pseudo</label>
      <input id="cpt-pseudo" name="pseudo" type="text" maxlength="24" autocomplete="nickname" spellcheck="false" value="${esc(b.pseudo)}" placeholder="Votre nom de héraut">
      <fieldset><legend class="cpt-lab">Champ de l'écu</legend><div class="cpt-sws">${[...METAUX, ...COULEURS].map(n => swatch(n, "champ", n === b.champ, n.toLowerCase())).join("")}</div></fieldset>
      <fieldset><legend class="cpt-lab">Meuble</legend><div class="cpt-meubles">${MEUBLES.map(([k]) => `<label class="cpt-mb"><input type="radio" name="meuble" value="${k}"${k === b.meuble ? " checked" : ""}><span>${NOM_MEUBLE[k]}</span></label>`).join("")}</div></fieldset>
      <fieldset><legend class="cpt-lab">Émail du meuble <span class="cpt-regle">— ${METAUX.includes(b.champ) ? "sur un métal, une couleur" : "sur une couleur, un métal"} (<a href="index.html#emaux" target="_blank" rel="noopener">la règle des émaux</a>)</span></legend>
        <div class="cpt-sws">${tms.map(n => swatch(n, "tm", n === b.tm, n.toLowerCase())).join("")}</div></fieldset>
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

  function lie() {
    const f = dlg.querySelector("#cpt-form"), err = dlg.querySelector("#cpt-err"), ret = dlg.querySelector("#cpt-ret"), code = dlg.querySelector("#cpt-code");
    const montre = m => { err.textContent = m; err.hidden = !m; };
    f.addEventListener("input", e => {
      if (e.target.name === "pseudo") { brouillon.pseudo = e.target.value; return; }
      if (e.target.name === "champ" || e.target.name === "meuble" || e.target.name === "tm") {
        brouillon[e.target.name] = e.target.value;
        const pseudo = f.pseudo.value; dlg.innerHTML = vue(); brouillon.pseudo = pseudo; dlg.querySelector("#cpt-pseudo").value = pseudo; lie();      // les émaux possibles changent avec le champ
        const nom = e.target.name, suivant = dlg.querySelector(`input[name="${nom}"]:checked`); if (suivant) suivant.focus();
      }
    });
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const pseudo = pseudoValide(f.pseudo.value);
      if (!pseudo) { montre("Le pseudo compte de 2 à 24 caractères : lettres, chiffres, espace, _ . -"); f.pseudo.focus(); return; }
      if (API.ligne && API.ligne.connecte() && (!M.profil || M.profil.pseudo.toLowerCase() !== pseudo.toLowerCase()) && (await API.ligne.pseudoLibre(pseudo)) === false) { montre("Ce pseudo est déjà pris : choisissez-en un autre."); f.pseudo.focus(); return; }
      M.profil = { pseudo, armes: { champ: brouillon.champ, meuble: brouillon.meuble, tm: brouillon.tm }, cree: (M.profil && M.profil.cree) || new Date().toISOString().slice(0, 10) };
      ecrire(); dlg.close();
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
      profil: () => { const pseudo = pseudoValide(f.pseudo.value); return pseudo ? { pseudo, armes: { champ: brouillon.champ, meuble: brouillon.meuble, tm: brouillon.tm }, cree: (M.profil && M.profil.cree) || new Date().toISOString().slice(0, 10) } : null; },
      enregistre: pf => { M.profil = pf; ecrire(); },
      refait: () => { const pseudo = f.pseudo.value; dlg.innerHTML = vue(); brouillon.pseudo = pseudo; dlg.querySelector("#cpt-pseudo").value = pseudo; lie(); },
      ferme: () => dlg.close(),
      pseudoManquant: () => { montre("Choisissez d'abord un pseudo (2 à 24 caractères : lettres, chiffres, espace, _ . -) : il vous représentera au classement."); f.pseudo.focus(); },
    });
    dlg.querySelector("#cpt-import").addEventListener("click", () => {
      if (code.readOnly) { code.readOnly = false; code.value = ""; code.placeholder = "Collez ici le code d'un autre appareil, puis recliquez sur « Importer »."; code.focus(); return; }
      if (API.importer(code.value)) { ret.textContent = "Importé."; setTimeout(() => dlg.close(), 500); } else ret.textContent = "Ce code n'est pas lisible.";
    });
  }

  /* la page dessine les armes à la demande : quand un dessin arrive, la fenêtre ouverte le reprend */
  API.actualiseEcu = () => { const e = dlg && dlg.open && dlg.querySelector("#cpt-ecu"); if (e && brouillon) e.innerHTML = dessine(armesTexte(brouillon)); };
  API.ouvre = ouvre;
})();
