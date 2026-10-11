/* L'ARMORIAL — « L'Écu du jour » : un écu mystère par jour, six essais.

   Le principe : on propose le nom d'armes réelles (un État, une province, une maison, un personnage) ; la page les dessine
   et les compare à l'écu caché, case par case — émaux, partition, pièce, meubles, nombre, rubrique. Les émaux de l'écu mystère
   qu'on a trouvés s'allument sur son dessin, les autres restent gris ; le dessin se précise à chaque essai.

   D'où vient chaque chose :
   - les armes : data/blasons.json et data/personnages.json ; une carte n'entre dans le jeu que si le lecteur de blasonnement
     (assets/lecture.js) la relit en entier : on compare ce que l'Atelier a compris, et on dessine ce qu'il sait dessiner ;
   - l'écu du jour : data/jeu.json (« ordre » : une carte par jour, à partir de « debut ») ; le même pour tous, sans serveur.
     Pour ajouter des armes, les ajouter à la FIN de « ordre » : les jours déjà joués gardent leurs armes ;
   - les scores et les essais du jour : le carnet « ecu » de assets/compte.js (gardé dans le navigateur, facultatif).

   Pour essayer un autre jour sans attendre : jeu.html#n=3 rejoue l'écu n° 3 (hors concours : ni série ni statistiques). */
(async () => {
  "use strict";
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
  const JEU = "ecu";
  const EMAUX = ["Or", "Argent", "Gueules", "Azur", "Sable", "Sinople", "Pourpre", "Hermine", "Vair"];
  const GRIS = "#d3ccb7";                                           // un émail pas encore trouvé

  /* ---------- le carnet : statistiques et fusion (avant tout await : les accroches doivent exister quand la synchronisation en ligne démarre) ---------- */
  const carnetVide = () => ({ stats: { joues: 0, gagnes: 0, serie: 0, serieMax: 0, dernierGagne: 0, rep: [0, 0, 0, 0, 0, 0] }, jours: {} });
  /* une partie terminée (jour n, essais, gagne) entre dans les statistiques */
  const applique = (st, n, j) => {
    st.joues++;
    if (j.gagne) { st.gagnes++; st.serie = (st.dernierGagne === n - 1 ? st.serie : 0) + 1; st.dernierGagne = n; st.serieMax = Math.max(st.serieMax, st.serie); st.rep[j.essais.length - 1]++; }
    else st.serie = 0;
  };
  /* les statistiques se refont depuis les jours joués : c'est ce qui permet de fondre deux carnets (deux appareils) sans rien compter deux fois */
  const recalcule = jours => {
    const st = carnetVide().stats;
    Object.keys(jours).map(Number).sort((a, b) => a - b).forEach(n => { if (jours[n].fini) applique(st, n, jours[n]); });
    return st;
  };
  const meilleur = (a, b) => !a ? b : !b ? a : a.fini !== b.fini ? (a.fini ? a : b) : (a.essais.length >= b.essais.length ? a : b);      // un jour fini l'emporte, sinon la partie la plus avancée
  Compte.fusion[JEU] = (local, distant) => {
    const jours = {};
    for (const n of new Set([...Object.keys((local && local.jours) || {}), ...Object.keys((distant && distant.jours) || {})])) jours[n] = meilleur(local && local.jours && local.jours[n], distant && distant.jours && distant.jours[n]);
    return { stats: recalcule(jours), jours };
  };
  Compte.scoresDe[JEU] = c => Object.entries((c && c.jours) || {}).filter(([, j]) => j && j.fini).map(([n, j]) => ({ jour: +n, essais: j.essais.length, gagne: !!j.gagne }));

  /* ---------- le jour ---------- */
  const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const cleDe = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const utc = d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());                      // minuit local, compté en jours entiers
  const quand = d => `${JOURS[d.getDay()]} ${d.getDate() === 1 ? "1ᵉʳ" : d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;

  /* ---------- ce qu'on lit d'une carte : les traits comparés ---------- */
  const mk = e => { const S = { ...fresh(), q: e.q, ab: e.ab, gb: e.gb || "", xc: e.xc || "", xb: e.xb || "", xp: e.xp || "", h1: e.h1, h2: e.h2, A: e.A.map(x => ({ ...x })) }; normalizeAll(S); return S; };
  const actifs = e => { const n = e.q === "4" ? 4 : e.q === "" ? 1 : 2, idx = [...Array(n).keys()]; if (e.ab) idx.push(4); return idx; };    // les armes réellement posées sur l'écu
  const Q_NOM = { p: "Parti", c: "Coupé", t: "Tranché", l: "Taillé", "2": "Écartelé", "4": "Écartelé" };
  const RAY_NOM = { barry: "Fascé", barryonde: "Fascé ondé", paly: "Palé", bendy: "Bandé", bendysin: "Barré", chevronny: "Chevronné", chequy: "Échiqueté", lozengy: "Fuselé", lozengybend: "Fuselé en bande", lozengysin: "Fuselé en barre" };
  const PART_NOM = { parti: "Parti", coupe: "Coupé", tranche: "Tranché", taille: "Taillé", tierce: "Tiercé", gironne: "Gironné" };
  /* des meubles « de la même famille » : toutes les aigles, tous les lions (léopards compris), toutes les croix… */
  const FAMILLE_A_PART = { leopard: "lion", croisette: "croix", "rencontre-boeuf": "boeuf" };
  const famille = k => FAMILLE_A_PART[k] || k.split("-")[0].replace(/\d+$/, "");
  const nomMeuble = k => { const m = ATL.meubles.find(x => x.kind === k); return cap1((m && (m.sing || m.nom)) || k); };
  const nomPiece = p => cap1(String(p).replace(/-/g, " "));

  function traits(c) {
    const e = c.etat, A = e.A, idx = actifs(e), A0 = A[0];
    const texte = plie(blazonAll(c.S));
    const emaux = EMAUX.filter(n => new RegExp(`\\b${plie(n)}\\b`).test(texte));
    const compo = Q_NOM[e.q] || (A0.f === "ray" ? RAY_NOM[A0.ray] : A0.f === "part" ? (PART_NOM[A0.part] || cap1(A0.part || "Parti")) : "Plein");
    const pieces = [...new Set(idx.map(i => A[i].p).filter(Boolean))].map(nomPiece);
    const meubles = [...new Set(idx.flatMap(i => [A[i].m, A[i].m2]).filter(Boolean))];
    const premier = idx.find(i => A[i].m);
    const nombre = premier === undefined ? 0 : (+A[premier].nb || 1);
    return { emaux, compo, pieces, meubles, nombre, cat: c.cat };
  }

  /* chaque case : { cls: "ok" | "mid" | "no", ... } ; l'ordre est celui des colonnes et des pastilles du partage */
  function compare(g, m) {
    const inter = (a, b) => a.filter(x => b.includes(x));
    const memes = (a, b) => a.length === b.length && inter(a, b).length === a.length;
    const emaux = { cls: memes(g.emaux, m.emaux) ? "ok" : inter(g.emaux, m.emaux).length ? "mid" : "no", pts: g.emaux.map(n => ({ n, dans: m.emaux.includes(n) })) };
    const compo = { cls: g.compo === m.compo ? "ok" : "no", txt: g.compo };
    const pieces = { cls: !g.pieces.length && !m.pieces.length ? "ok" : memes(g.pieces, m.pieces) ? "ok" : inter(g.pieces, m.pieces).length ? "mid" : "no", txt: g.pieces.length ? g.pieces.join(", ") : "Aucune" };
    const mf = m.meubles.map(famille);
    const puces = g.meubles.map(k => ({ k, cls: m.meubles.includes(k) ? "ok" : mf.includes(famille(k)) ? "mid" : "no" }));
    const meubles = { puces, cls: !g.meubles.length && !m.meubles.length ? "ok" : puces.length && memes(g.meubles, m.meubles) ? "ok" : puces.some(p => p.cls !== "no") ? "mid" : "no" };
    const nombre = { n: g.nombre, cls: g.nombre === m.nombre ? "ok" : "no", fl: g.nombre && m.nombre && g.nombre !== m.nombre ? (m.nombre > g.nombre ? "↑" : "↓") : "" };
    const cat = { cls: g.cat === m.cat ? "ok" : "no", txt: g.cat };
    return { emaux, compo, pieces, meubles, nombre, cat };
  }
  const COLS = ["emaux", "compo", "pieces", "meubles", "nombre", "cat"];
  const ENTETE = { emaux: "Émaux", compo: "Écu", pieces: "Pièce", meubles: "Meubles", nombre: "Nombre", cat: "Rubrique" };
  const SYMB = { ok: "✓", mid: "≈", no: "✗" }, EMOJI = { ok: "🟩", mid: "🟨", no: "⬜" }, VERDICT = { ok: "identique", mid: "proche", no: "différent" };

  /* ---------- chargement ---------- */
  let CARTES = [], CAL = null;
  try {
    await chargerLecteur();                                          // data/data.json et data/atelier.json
    const [b, p, cal] = await Promise.all(["data/blasons.json", "data/personnages.json", "data/jeu.json"].map(u => fetch(u).then(r => { if (!r.ok) throw new Error(`${u} : HTTP ${r.status}`); return r.json(); })));
    CAL = cal;
    const tout = [...b.map(a => ({ ...a, gal: "blasons", cat: a.cat || "Blasons réels" })), ...p.map(a => ({ ...a, gal: "personnages", cat: "Personnages" }))];
    for (const a of tout) {
      if (!a.blason || !a.file) continue;
      const r = lire(texteAtelier(a));
      if (!r.ok) continue;
      const c = { ...a, etat: r.etat, S: mk(r.etat), cle: plie(`${a.nom} ${a.porteur || ""}`) };
      c.canon = blazonAll(c.S); c.t = traits(c);
      CARTES.push(c);
    }
  } catch (e) {
    $("#jeu-chargement").textContent = `Le jeu n'a pas pu se charger (${e.message}). Cette page doit être servie par HTTP, et non ouverte depuis le disque.`;
    return;
  }
  const PAR_NOM = new Map(CARTES.map(c => [c.nom, c]));
  $("#gdefs").innerHTML = globalDefs();

  /* ---------- le tirage du jour ---------- */
  const auj = new Date(), debut = (([y, m, d]) => new Date(y, m - 1, d))(CAL.debut.split("-").map(Number));
  const numAuj = Math.max(1, Math.floor((utc(auj) - utc(debut)) / 864e5) + 1);                // n° 1 le jour de « debut »
  const demande = /^#n=(\d+)$/.exec(location.hash);
  const hors = !!demande && +demande[1] >= 1 && +demande[1] < numAuj;                           // un jour passé, pour essayer : hors concours
  const N = hors ? +demande[1] : numAuj;
  const ordre = CAL.ordre.filter(n => PAR_NOM.has(n));
  const cible = PAR_NOM.get(ordre[(N - 1) % ordre.length]);
  const jourDe = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + N - 1);
  const ESSAIS = CAL.essais || 6;

  /* ---------- le carnet (scores) : lu une fois la synchronisation en ligne faite (trois secondes au plus) ---------- */
  await Compte.pret;
  let C = Compte.carnet(JEU) || carnetVide();
  C.stats = { ...carnetVide().stats, ...C.stats }; C.jours = C.jours || {};
  const sauveCarnet = () => Compte.enregistre(JEU, C);
  const jourSauve = () => (hors ? null : C.jours[N]) || null;

  /* ---------- l'état de la partie ---------- */
  const J = { essais: [], fini: false, gagne: false, trouves: new Set(), hors };
  const sauve = () => {
    if (hors) return;
    C.jours[N] = { essais: J.essais.map(c => c.nom), fini: J.fini, gagne: J.gagne };
    sauveCarnet();
  };

  /* ---------- le dessin ---------- */
  let compteur = 0;
  async function svgDe(c, { gris, flou } = {}) {
    await loadAll(c.S);
    const op = tinctPaint, oc = tinctColor;
    try {
      if (gris) { window.tinctPaint = n => (gris.has(n) ? op(n) : GRIS); window.tinctColor = n => (gris.has(n) ? oc(n) : GRIS); }       // seuls les émaux trouvés gardent leur couleur
      const r = compose(c.S, "j" + ++compteur);
      return `<svg class="ecu" viewBox="${r.vb.join(" ")}" aria-hidden="true">${r.svg}</svg>`;
    } finally { window.tinctPaint = op; window.tinctColor = oc; }
  }
  /* les armes de joueur (assets/compte.js) : un blasonnement très simple, dessiné à la demande ; la fenêtre du profil se rafraîchit quand le dessin est prêt */
  const AVATARS = new Map(), EN_COURS = new Set();
  async function prepareAvatar(texte) {
    if (AVATARS.has(texte) || EN_COURS.has(texte)) return;
    EN_COURS.add(texte);
    try {
      const r = lire(texte);
      if (!r.ok) return;
      const S = mk(r.etat); await loadAll(S);
      const c = compose(S, "av" + ++compteur);
      AVATARS.set(texte, `<svg class="ecu" viewBox="${c.vb.join(" ")}" aria-hidden="true">${c.svg}</svg>`);
    } finally { EN_COURS.delete(texte); }
  }
  Compte.dessin = texte => {
    const v = AVATARS.get(texte);
    if (!v) prepareAvatar(texte).then(() => Compte.actualiseEcu && Compte.actualiseEcu());
    return v || "";
  };

  /* ---------- l'écu mystère et les émaux ---------- */
  async function dessineMystere() {
    const fini = J.fini, nb = J.essais.length;
    $("#jeu-ecu").innerHTML = await svgDe(cible, fini ? undefined : { gris: J.trouves });
    $("#jeu-mystere").style.setProperty("--flou", fini ? 0 : Math.max(0, 6 - nb * 1.5).toFixed(2) + "px");
    $("#jeu-mystere").classList.toggle("vide", !nb && !fini);
    $("#jeu-ecu").setAttribute("aria-label", fini ? `Les armes : ${cible.nom}` : `Les armes mystères, ${J.trouves.size} ${J.trouves.size > 1 ? "émaux trouvés" : "émail trouvé"} sur ${cible.t.emaux.length}`);
    $("#jeu-leg").textContent = fini ? cible.nom : "Armes mystères";
  }
  function dessinePalette() {
    const absents = new Set(J.essais.flatMap(c => c.t.emaux).filter(n => !cible.t.emaux.includes(n)));
    const couleur = n => (DATA.tinctures.find(t => t.nom === n) || {}).color || "#888";
    $("#jeu-palette").innerHTML = EMAUX.map(n => {
      const etat = J.trouves.has(n) ? "oui" : absents.has(n) ? "non" : "";
      const dit = etat === "oui" ? "dans l'écu mystère" : etat === "non" ? "pas dans l'écu mystère" : "pas encore essayé";
      return `<li class="em ${etat}" data-e="${n}" style="--c:${couleur(n)}"><span class="pastille" aria-hidden="true">${etat === "oui" ? "✓" : etat === "non" ? "✗" : ""}</span><span class="nom">${n.toLowerCase()}<b class="sr"> : ${dit}</b></span></li>`;
    }).join("");
    const total = cible.t.emaux.length;
    $("#jeu-nb").innerHTML = `L'écu mystère compte <b>${total} ${total > 1 ? "émaux" : "émail"}</b> : ${J.trouves.size} trouvé${J.trouves.size > 1 ? "s" : ""}.`;
  }

  /* ---------- une réponse : une ligne ---------- */
  function ligne(c, cmp, i) {
    const cases = COLS.map(col => {
      const x = cmp[col];
      let contenu = "", dit = "";
      if (col === "emaux") {
        contenu = x.pts.map(p => `<span class="pt ${p.dans ? "oui" : "non"}" style="--c:${(DATA.tinctures.find(t => t.nom === p.n) || {}).color}" title="${p.n.toLowerCase()}${p.dans ? " : dans l'écu mystère" : " : absent"}"></span>`).join("");
        dit = x.pts.map(p => `${p.n.toLowerCase()} ${p.dans ? "présent" : "absent"}`).join(", ");
      } else if (col === "meubles") {
        contenu = x.puces.length ? x.puces.map(p => `<span class="mb ${p.cls}">${esc(nomMeuble(p.k))}</span>`).join("") : "Aucun";
        dit = x.puces.length ? x.puces.map(p => `${nomMeuble(p.k)} ${VERDICT[p.cls]}`).join(", ") : "aucun meuble";
      } else if (col === "nombre") {
        contenu = x.n ? `${x.n}${x.fl ? `<span class="fl" title="${x.fl === "↑" ? "plus" : "moins"}">${x.fl}</span>` : ""}` : "—";
        dit = x.n ? `${x.n}${x.fl ? (x.fl === "↑" ? ", l'écu mystère en a plus" : ", l'écu mystère en a moins") : ""}` : "aucun meuble";
      } else { contenu = esc(x.txt); dit = x.txt; }
      return `<li class="case ${x.cls}" style="--i:${i * COLS.length + COLS.indexOf(col)}"><span class="ent">${ENTETE[col]}</span><span class="val">${contenu}</span><span class="sym" aria-hidden="true">${SYMB[x.cls]}</span><span class="sr">${ENTETE[col]} : ${esc(dit)} — ${VERDICT[x.cls]}</span></li>`;
    }).join("");
    return cases;
  }
  async function ajouteLigne(c, i, anime) {
    const cmp = compare(c.t, cible.t);
    const li = document.createElement("li");
    li.className = "essai" + (anime ? " neuf" : "");
    li.innerHTML = `<div class="essai-tete"><span class="mini">${await svgDe(c)}</span><span class="essai-nom"><b>${esc(c.nom)}</b></span><span class="essai-n">${i + 1}/${ESSAIS}</span></div><ul class="cases">${ligne(c, cmp, i)}</ul>`;
    $("#jeu-liste-essais").appendChild(li);
    return cmp;
  }

  /* ---------- la saisie : une liste de réponses possibles ---------- */
  const champ = $("#jeu-nom"), liste = $("#jeu-liste"), aide = $("#jeu-aide-saisie");
  let sugg = [], actif = -1, choisi = null;
  const proposables = () => { const deja = new Set(J.essais.map(c => c.nom)); return CARTES.filter(c => !deja.has(c.nom)); };
  function filtre(q) {
    const t = plie(q.trim());
    if (!t) return [];
    return proposables().filter(c => c.cle.includes(t)).sort((a, b) => (plie(b.nom).startsWith(t) - plie(a.nom).startsWith(t)) || a.nom.localeCompare(b.nom, "fr")).slice(0, 8);
  }
  function montreListe() {
    sugg = filtre(champ.value); actif = sugg.length ? 0 : -1;
    liste.innerHTML = sugg.map((c, i) => `<li role="option" id="jeu-o${i}" data-i="${i}" aria-selected="${i === actif}"${i === actif ? ' class="on"' : ""}><b>${esc(c.nom)}</b><small>${esc(c.cat)}</small></li>`).join("");
    liste.hidden = !sugg.length; champ.setAttribute("aria-expanded", String(!!sugg.length));
    if (actif >= 0) champ.setAttribute("aria-activedescendant", "jeu-o0"); else champ.removeAttribute("aria-activedescendant");
    if (q0().length && !sugg.length) aide.textContent = "Aucune arme de ce nom dans le jeu : essayez un autre mot."; else aide.textContent = "";
  }
  const q0 = () => champ.value.trim();
  function bouge(d) {
    if (!sugg.length) return;
    actif = (actif + d + sugg.length) % sugg.length;
    [...liste.children].forEach((li, i) => { li.classList.toggle("on", i === actif); li.setAttribute("aria-selected", String(i === actif)); });
    champ.setAttribute("aria-activedescendant", `jeu-o${actif}`);
    liste.children[actif].scrollIntoView({ block: "nearest" });
  }
  function choisit(c) { choisi = c; champ.value = c.nom; liste.hidden = true; champ.setAttribute("aria-expanded", "false"); aide.textContent = ""; }
  champ.addEventListener("input", () => { choisi = null; montreListe(); });
  champ.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (liste.hidden) montreListe(); else bouge(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); bouge(-1); }
    else if (e.key === "Escape") { liste.hidden = true; champ.setAttribute("aria-expanded", "false"); }
    else if (e.key === "Enter" && !liste.hidden && actif >= 0) { e.preventDefault(); choisit(sugg[actif]); }
  });
  liste.addEventListener("mousedown", e => { e.preventDefault(); const li = e.target.closest("li[data-i]"); if (li) { choisit(sugg[+li.dataset.i]); champ.focus(); } });
  champ.addEventListener("blur", () => setTimeout(() => { liste.hidden = true; champ.setAttribute("aria-expanded", "false"); }, 120));
  champ.addEventListener("focus", () => { if (q0() && !choisi) montreListe(); });

  $("#jeu-saisie").addEventListener("submit", async e => {
    e.preventDefault();
    if (J.fini) return;
    let c = choisi;
    if (!c) {                                                           // le nom tapé en entier, ou une seule proposition
      const t = plie(q0()), exacts = proposables().filter(x => plie(x.nom) === t);
      c = exacts.length === 1 ? exacts[0] : (filtre(champ.value).length === 1 ? filtre(champ.value)[0] : null);
    }
    if (!c) {
      aide.textContent = !q0() ? "Tapez le nom d'un État, d'une province, d'une maison…"
        : filtre(champ.value).length ? "Choisissez des armes dans la liste proposée." : "Aucune arme de ce nom dans le jeu : essayez un autre mot.";
      champ.focus(); return;
    }
    await devine(c);
  });

  /* ---------- une réponse ---------- */
  let occupe = false;
  async function devine(c) {
    if (occupe || J.fini) return;
    occupe = true;
    try {
      champ.value = ""; choisi = null; liste.hidden = true; aide.textContent = "";
      J.essais.push(c);
      c.t.emaux.forEach(n => { if (cible.t.emaux.includes(n)) J.trouves.add(n); });
      const i = J.essais.length - 1, cmp = await ajouteLigne(c, i, true);
      const gagne = c === cible || c.canon === cible.canon;             // les mêmes armes sous un autre nom (deux cartes pour un même écu) comptent
      if (gagne || J.essais.length >= ESSAIS) { J.fini = true; J.gagne = gagne; }
      $("#jeu-annonce").textContent = `${c.nom} : ${COLS.map(k => `${ENTETE[k]} ${VERDICT[cmp[k].cls]}`).join(", ")}.`;
      if (J.fini) termine(); else sauve();
      majEssais(); dessinePalette();
      await dessineMystere();
      if (J.fini) await montreResultat();
      else champ.focus();
    } finally { occupe = false; }
  }
  function termine() {
    const deja = !hors && C.jours[N] && C.jours[N].fini;
    if (!hors && !deja) applique(C.stats, N, { gagne: J.gagne, essais: J.essais });
    sauve();
    setTimeout(() => dessineClassement(true), 1800);                            // le temps que le résultat parte en ligne
  }
  const majEssais = () => {
    const n = J.essais.length, reste = ESSAIS - n;
    $("#jeu-essais").textContent = J.fini ? (J.gagne ? `Trouvé en ${n}` : "Perdu") : `Essai ${n + 1} sur ${ESSAIS}`;
    $("#jeu-saisie").hidden = J.fini; aide.hidden = J.fini;
    if (!J.fini) champ.placeholder = n ? `Encore ${reste} essai${reste > 1 ? "s" : ""}…` : "Un État, une province, une maison…";
  };

  /* ---------- la fin de la partie ---------- */
  const imageDe = a => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(a.file)}?width=420`;
  function texteDePartage() {
    const lignes = J.essais.map(c => { const m = compare(c.t, cible.t); return COLS.map(k => EMOJI[m[k].cls]).join(""); });
    return `L'Écu du jour n° ${N} — ${J.gagne ? J.essais.length : "X"}/${ESSAIS}${hors ? " (hors concours)" : ""}\n${lignes.join("\n")}\nhttps://armorial.web.app/jeu.html`;
  }
  let minuteur = 0;
  async function montreResultat() {
    const r = $("#jeu-resultat"), a = cible, n = J.essais.length;
    const lien = a.gal === "blasons" ? `blasons.html#${slugCarte(a.nom)}` : `personnages.html#${slugCarte(a.nom)}`;
    const atelier = adresseAtelier(a, a.gal);
    r.className = "jeu-resultat " + (J.gagne ? "ok" : "ko");
    r.innerHTML = `<h2>${J.gagne ? (n === 1 ? "Du premier coup !" : n <= 3 ? "Bien vu !" : "Trouvé !") : "Perdu… pour cette fois"}</h2>
      <p class="res-dit">${J.gagne ? `Ces armes sont celles de <b>${esc(a.nom)}</b>${n === 1 ? "" : `, trouvées en ${n} essais`}.` : `C'étaient les armes de <b>${esc(a.nom)}</b>.`}</p>
      <figure class="res-fig"><img src="${esc(imageDe(a))}" alt="Armoiries : ${esc(a.nom)}" width="220" referrerpolicy="no-referrer"${styleFiltre(a)}>
        <figcaption>${a.porteur ? `${esc(a.porteur)}<br>` : ""}<i>${esc(a.blason)}</i></figcaption></figure>
      <p class="res-actes"><button type="button" class="main" id="jeu-partage">Partager mon résultat</button><span class="res-copie" id="jeu-copie" role="status"></span></p>
      <p class="res-liens"><a href="${lien}">Voir la carte dans l'Armorial</a> · <a href="${atelier}">Redessiner dans l'Atelier</a></p>
      <p class="res-prochain" id="jeu-prochain"></p>
      <p class="res-credit">Image : <i>${esc(a.file)}</i>, ${esc(a.auteur || "auteur inconnu")}, ${a.licurl ? `<a href="${esc(a.licurl)}" rel="noopener">${esc(a.lic)}</a>` : esc(a.lic || "licence libre")}, via Wikimedia Commons.</p>`;
    r.hidden = false;
    $("#jeu-partage").addEventListener("click", async () => {
      const t = texteDePartage(), msg = $("#jeu-copie");
      try { await navigator.clipboard.writeText(t); msg.textContent = "Copié : collez-le où vous voulez."; }
      catch (e) { window.prompt("Copiez votre résultat :", t); }
    });
    clearInterval(minuteur);
    const tic = () => {
      const maintenant = new Date(), demain = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() + 1), s = Math.max(0, Math.round((demain - maintenant) / 1000));
      const el = $("#jeu-prochain"); if (!el) return;
      if (hors) { el.innerHTML = `Écu n° ${N} rejoué hors concours. <a href="jeu.html">Retour à l'écu du jour</a>`; return; }
      el.textContent = `Prochain écu dans ${String(Math.floor(s / 3600)).padStart(2, "0")} h ${String(Math.floor(s / 60) % 60).padStart(2, "0")} min ${String(s % 60).padStart(2, "0")} s`;
      if (s === 0) location.reload();
    };
    tic(); minuteur = setInterval(tic, 1000);
    r.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "instant" : "smooth" });
    r.focus({ preventScroll: true });
  }

  /* ---------- le côté : profil, scores, autres jeux ---------- */
  function dessineCote() {
    const s = C.stats, p = Compte.profil(), vivante = s.dernierGagne >= numAuj - 1 ? s.serie : 0;
    const max = Math.max(1, ...s.rep);
    const armes = p ? Compte.dessin(Compte.armesTexte(p.armes)) : "";
    $("#jeu-profil").innerHTML = `<h2 id="jeu-profil-t">Votre carnet</h2>
      <div class="pf">${p ? `<span class="pf-ecu">${armes}</span><span class="pf-nom"><b>${esc(p.pseudo)}</b><small>joueur depuis le ${esc(p.cree.split("-").reverse().join("/"))}</small></span>`
        : `<span class="pf-nom"><b>Joueur anonyme</b><small>Créez un profil pour signer vos scores de vos propres armes.</small></span>`}</div>
      <dl class="stats"><div><dt>Parties</dt><dd>${s.joues}</dd></div><div><dt>Victoires</dt><dd>${s.joues ? Math.round(100 * s.gagnes / s.joues) : 0} %</dd></div><div><dt>Série</dt><dd>${vivante}</dd></div><div><dt>Record</dt><dd>${s.serieMax}</dd></div></dl>
      <ol class="rep" aria-label="Répartition des victoires par nombre d'essais">${s.rep.map((n, i) => `<li><span class="rn">${i + 1}</span><span class="rb"><i style="width:${n ? Math.max(8, Math.round(100 * n / max)) : 0}%"></i></span><span class="rv">${n}</span></li>`).join("")}</ol>
      <p class="pf-acts"><button type="button" class="lnk" id="jeu-pf">${p ? "Modifier mon profil" : "Créer mon profil"}</button></p>`;
    $("#jeu-pf").addEventListener("click", () => Compte.ouvre());
  }
  function dessineAutres() {
    let defiFait = false;
    try { const m = JSON.parse(localStorage.getItem("armorial.exercices.v1") || "null"); defiFait = !!(m && m.defi && m.defi.date === cleDe(new Date())); } catch (e) { /* sans mémoire */ }
    const L = [
      ["exercices.html#defi", "Défi du jour", "Six questions, les mêmes pour tous", defiFait ? "Fait aujourd'hui" : ""],
      ["exercices.html#lire", "Lire un écu", "Le texte de ces armes", ""],
      ["exercices.html#reel", "Armes réelles", "À qui sont ces armes ?", ""],
      ["exercices.html#regle", "La règle des émaux", "Régulières ou non ?", ""],
    ];
    $("#jeu-autres").innerHTML = L.map(([href, t, d, f]) => `<li><a href="${href}"><span class="t">${t}</span><span class="d">${d}</span>${f ? `<span class="f">${f}</span>` : ""}</a></li>`).join("")
      + `<li class="bientot"><span class="t">Bientôt</span><span class="d">D'autres petits jeux : l'ordre des émaux, le blason express…</span></li>`;
  }

  /* ---------- le classement (comptes en ligne seulement) ---------- */
  const CL = { onglet: "jour", jour: null, general: null, erreur: false };
  const sameNom = (a, b) => a && b && a.toLowerCase() === b.toLowerCase();
  async function dessineClassement(frais) {
    const el = $("#jeu-classement");
    if (!el || !Compte.enLigne) return;
    el.hidden = false;
    try {
      [CL.jour, CL.general] = await Promise.all([Compte.classementJour(JEU, numAuj, { frais }), Compte.classementGeneral(JEU, { frais })]);
      CL.erreur = false;
      const textes = new Set([...CL.jour, ...CL.general].map(x => Compte.armesTexte(x.armes)).filter(Boolean));
      await Promise.all([...textes].map(prepareAvatar));
    } catch (e) { CL.erreur = true; }
    rendClassement();
  }
  function rendClassement() {
    const el = $("#jeu-classement"), moi = (Compte.profil() || {}).pseudo, connecte = Compte.ligne && Compte.ligne.connecte();
    const liste = CL.onglet === "jour" ? CL.jour : CL.general;
    const ligne = (x, i) => `<li${sameNom(x.pseudo, moi) ? ' class="moi"' : ""}><span class="rg">${i + 1}</span><span class="mini">${Compte.dessin(Compte.armesTexte(x.armes))}</span><b>${esc(x.pseudo)}</b><span class="sc">${CL.onglet === "jour" ? `${x.essais} essai${x.essais > 1 ? "s" : ""}` : `${x.victoires} victoire${x.victoires > 1 ? "s" : ""}`}</span></li>`;
    el.innerHTML = `<h2 id="jeu-classement-t">Classement</h2>
      <div class="onglets" role="tablist" aria-label="Classement"><button type="button" role="tab" aria-selected="${CL.onglet === "jour"}" data-o="jour">Du jour</button><button type="button" role="tab" aria-selected="${CL.onglet === "general"}" data-o="general">Général</button></div>
      ${CL.erreur || !liste ? `<p class="cl-vide">Le classement n'est pas disponible pour l'instant.</p>`
        : liste.length ? `<ol class="cl">${liste.map(ligne).join("")}</ol>` : `<p class="cl-vide">${CL.onglet === "jour" ? "Personne n'a encore trouvé l'écu du jour : soyez le premier." : "Le classement se remplit avec les premières parties."}</p>`}
      ${connecte ? "" : `<p class="cl-aide"><button type="button" class="lnk" id="jeu-cl-compte">Créez un compte en ligne</button> pour y figurer.</p>`}`;
    el.querySelectorAll("[data-o]").forEach(b => b.addEventListener("click", () => { CL.onglet = b.dataset.o; rendClassement(); }));
    const cc = $("#jeu-cl-compte"); if (cc) cc.addEventListener("click", () => Compte.ouvre());
  }
  if (Compte.surSynchro) { let t = 0; Compte.surSynchro(() => { clearTimeout(t); t = setTimeout(() => { dessineCote(); if (J.fini) dessineClassement(true); }, 300); }); }
  Compte.sur(() => { C = Compte.carnet(JEU) || C; dessineCote(); });

  /* ---------- départ ---------- */
  $("#jeu-jour").innerHTML = `Écu n° ${N}<small>${quand(jourDe)}${hors ? " · hors concours" : ""}</small>`;
  const sv = jourSauve();
  const premiere = !C.stats.joues && !(sv && sv.essais.length);
  $("#jeu-regles").open = premiere;
  dessineAutres();
  { const p = Compte.profil(); if (p) await prepareAvatar(Compte.armesTexte(p.armes)); }      // les armes du joueur, pour son carnet
  dessineCote();
  dessinePalette(); majEssais();
  /* une partie commencée aujourd'hui reprend là où elle s'est arrêtée */
  if (sv) {
    for (const nom of sv.essais) { const c = PAR_NOM.get(nom); if (!c) continue; J.essais.push(c); c.t.emaux.forEach(n => { if (cible.t.emaux.includes(n)) J.trouves.add(n); }); }
    J.fini = !!sv.fini; J.gagne = !!sv.gagne;
    for (let i = 0; i < J.essais.length; i++) await ajouteLigne(J.essais[i], i, false);
    dessinePalette(); majEssais();
  }
  await dessineMystere();
  $("#jeu-chargement").hidden = true; $("#jeu-grille").hidden = false;
  if (J.fini) await montreResultat();
  dessineClassement();
  /* pour les tests (tools/smoke_test.py) : l'état et les fonctions, sans rien changer à la page */
  window.EcuDuJour = { J, cible, CARTES, N, devine, compare, traits, texteDePartage, hors };
})();
