/* L'ARMORIAL — « L'Écu du jour » : un écu mystère par jour et par niveau (Écuyer, Chevalier, Seigneur).

   Le principe : on propose le nom d'armes réelles (un État, une province, une maison, un personnage) ; la page les dessine
   et les compare à l'écu caché, case par case — émaux, partition, pièce, meubles, nombre, rubrique. L'écu mystère se dévoile
   par étapes : d'abord sa seule silhouette, puis ses partitions, ses pièces, ses meubles ; les émaux trouvés s'y allument.
   On peut aussi demander un détail (un émail, une partition, une pièce, un meuble : « lion », « gueules », « écartelé ») : la page
   dit s'il est dans l'écu mystère. Un détail ne coûte pas d'essai — seules les armes réelles comptent — mais il est compté :
   il s'affiche à la fin, dans le partage, et retire des points (le barème : assets/jour.js).

   D'où vient chaque chose :
   - les armes : data/blasons.json et data/personnages.json ; une carte n'entre dans le jeu que si le lecteur de blasonnement
     (assets/lecture.js) la relit en entier : on compare ce que l'Atelier a compris, et on dessine ce qu'il sait dessiner ;
   - l'écu du jour : le document du jour dans la base (assets/jour.js, champ « ecu » : un nom de carte par niveau), lisible
     seulement le jour venu ; le calendrier s'écrit avec tools/calendrier.html, qui classe aussi les cartes par difficulté ;
   - les scores et les essais du jour : un carnet par niveau (ecu_page, ecu, ecu_heraut ; assets/jour.js et assets/compte.js).

   Le niveau : index.html?niveau=page (ou chevalier, heraut) ; sans paramètre, le dernier joué.
   Pour rejouer un jour passé : index.html#n=3 (hors concours : ni série ni statistiques).

   Deux langues : la même page de jeu sert index.html et en.html (« Shield of the Day »), avec les mêmes écus, carnets et classements.
   Le français reste la clé de tout (les noms de cartes du document du jour et du carnet, les traits comparés) ; l'anglais ne sert qu'à
   l'affichage et à la saisie : lireDonnees (assets/chrome.js) donne les textes des cartes, data/en/vocabulaire.json le vocabulaire (voc), Tr(fr, en) le reste. */
(async () => {
  "use strict";
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
  const EMAUX = ["Or", "Argent", "Gueules", "Azur", "Sable", "Sinople", "Pourpre", "Hermine", "Vair"];
  const GRIS = "#d3ccb7";                                           // un émail pas encore trouvé
  const EN = LANGUE === "en";
  let TRAD = {};                                                    // data/en/vocabulaire.json, en anglais seulement
  const voc = (table, s) => (EN && TRAD[table] && TRAD[table][s]) || s;
  const nomEmail = n => voc("emaux", n).toLowerCase();

  /* ---------- le niveau : un écu, un carnet et un classement chacun ---------- */
  const NIVEAUX = {
    page: { jeu: "ecu_page", nom: Tr("Écuyer", "Squire"), essais: 8, dit: Tr("Des États et des cantons connus, aux armes simples ; huit essais.", "Well-known states and cantons, with simple arms; eight guesses.") },
    chevalier: { jeu: "ecu", nom: Tr("Chevalier", "Knight"), essais: 6, dit: Tr("Des armes de toutes sortes ; six essais.", "Arms of all kinds; six guesses.") },
    heraut: { jeu: "ecu_heraut", nom: Tr("Seigneur", "Lord"), essais: 5, dit: Tr("Maisons, écartelés, figures rares ; cinq essais, et la rubrique n'est pas dite.", "Noble houses, quartered arms, rare charges; five guesses, and the category isn't shown.") },
  };
  const CLE_NIV = "armorial.jeu.niveau";
  const NIV = (() => {
    const q0 = new URLSearchParams(location.search).get("niveau"), q = { ecuyer: "page", seigneur: "heraut" }[q0] || q0;      // les niveaux Écuyer et Seigneur s'appelaient Page et Héraut : leurs identifiants restent « page » et « heraut »
    if (q && NIVEAUX[q]) { try { localStorage.setItem(CLE_NIV, q); } catch (e) { /* sans mémoire */ } return q; }
    try { const m = localStorage.getItem(CLE_NIV); if (m && NIVEAUX[m]) return m; } catch (e) { /* idem */ }
    return "chevalier";
  })();
  const JEU = NIVEAUX[NIV].jeu;

  /* ---------- ce qu'on lit d'une carte : les traits comparés ---------- */
  const mk = e => { const S = { ...fresh(), sh: e.sh || "", q: e.q, ab: e.ab, gb: e.gb || "", xc: e.xc || "", xb: e.xb || "", xp: e.xp || "", h1: e.h1, h2: e.h2, A: e.A.map(x => ({ ...x })) }; normalizeAll(S); return S; };
  const actifs = e => { const n = e.q === "4" ? 4 : e.q === "" ? 1 : 2, idx = [...Array(n).keys()]; if (e.ab) idx.push(4); return idx; };    // les armes réellement posées sur l'écu
  const Q_NOM = { p: "Parti", c: "Coupé", t: "Tranché", l: "Taillé", "2": "Écartelé", "4": "Écartelé" };
  const RAY_NOM = { barry: "Fascé", barryonde: "Fascé ondé", paly: "Palé", bendy: "Bandé", bendysin: "Barré", chevronny: "Chevronné", chequy: "Échiqueté", lozengy: "Fuselé", lozengybend: "Fuselé en bande", lozengysin: "Fuselé en barre" };
  const PART_NOM = { parti: "Parti", coupe: "Coupé", tranche: "Tranché", taille: "Taillé", tierce: "Tiercé", "tierce-pal": "Tiercé en pal", ecartele: "Écartelé", gironne: "Gironné" };
  /* des meubles « de la même famille » : toutes les aigles, tous les lions (léopards compris), toutes les croix… */
  const FAMILLE_A_PART = { leopard: "lion", croisette: "croix", "rencontre-boeuf": "boeuf" };
  const famille = k => FAMILLE_A_PART[k] || k.split("-")[0].replace(/\d+$/, "");
  const nomMeuble = k => { const m = ATL.meubles.find(x => x.kind === k); return cap1((m && (m.sing || m.nom)) || k); };
  const nomPiece = p => cap1(String(p).replace(/-/g, " "));
  const affMeuble = k => voc("meubles", nomMeuble(k));

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
    const compo = { cls: g.compo === m.compo ? "ok" : "no", txt: voc("compo", g.compo) };
    const pieces = { cls: !g.pieces.length && !m.pieces.length ? "ok" : memes(g.pieces, m.pieces) ? "ok" : inter(g.pieces, m.pieces).length ? "mid" : "no", txt: g.pieces.length ? g.pieces.map(x => voc("pieces", x)).join(", ") : Tr("Aucune", "None") };
    const mf = m.meubles.map(famille);
    const puces = g.meubles.map(k => ({ k, cls: m.meubles.includes(k) ? "ok" : mf.includes(famille(k)) ? "mid" : "no" }));
    const meubles = { puces, cls: !g.meubles.length && !m.meubles.length ? "ok" : puces.length && memes(g.meubles, m.meubles) ? "ok" : puces.some(p => p.cls !== "no") ? "mid" : "no" };
    const nombre = { n: g.nombre, cls: g.nombre === m.nombre ? "ok" : "no", fl: g.nombre && m.nombre && g.nombre !== m.nombre ? (m.nombre > g.nombre ? "↑" : "↓") : "" };
    const cat = { cls: g.cat === m.cat ? "ok" : "no", txt: voc("rubriques", g.cat) };
    return { emaux, compo, pieces, meubles, nombre, cat };
  }
  const COLS = NIV === "heraut" ? ["emaux", "compo", "pieces", "meubles", "nombre"] : ["emaux", "compo", "pieces", "meubles", "nombre", "cat"];
  const ENTETE = Tr({ emaux: "Émaux", compo: "Écu", pieces: "Pièce", meubles: "Meubles", nombre: "Nombre", cat: "Rubrique" }, { emaux: "Tinctures", compo: "Field", pieces: "Ordinary", meubles: "Charges", nombre: "Number", cat: "Category" });
  const SYMB = { ok: "✓", mid: "≈", no: "✗" }, EMOJI = { ok: "🟩", mid: "🟨", no: "⬜" }, VERDICT = Tr({ ok: "identique", mid: "proche", no: "différent" }, { ok: "identical", mid: "close", no: "different" });

  /* ---------- chargement ---------- */
  let CARTES = [];
  try {
    await chargerLecteur();                                          // data/data.json et data/atelier.json
    const [b, p] = await Promise.all(["data/blasons.json", "data/personnages.json"].map(lireDonnees));
    if (EN) TRAD = await lisJson("data/en/vocabulaire.json");
    const tout = [...b.map(a => ({ ...a, gal: "blasons", cat: a.cat || "Blasons réels" })), ...p.map(a => ({ ...a, gal: "personnages", cat: "Personnages" }))];
    for (const a of tout) {
      if (!a.blason || !a.file) continue;
      const r = lireCarte(a);
      if (!r.ok) continue;
      /* aff : le nom affiché ; en anglais, on cherche aussi par le nom français */
      const c = { ...a, etat: r.etat, S: mk(r.etat), aff: nomCarte(a), cle: plie(`${a.nomEn || ""} ${a.nom} ${a.porteur || ""}`) };
      c.canon = blazonAll(c.S); c.t = traits(c);
      CARTES.push(c);
    }
  } catch (e) {
    $("#jeu-chargement").textContent = Tr(`Le jeu n'a pas pu se charger (${e.message}). Cette page doit être servie par HTTP, et non ouverte depuis le disque.`, `The game couldn't load (${e.message}). This page must be served over HTTP, not opened from disk.`);
    return;
  }
  const PAR_NOM = new Map(CARTES.map(c => [c.nom, c]));

  /* ---------- les détails qu'on peut demander : tout ce que les cartes du jeu emploient ---------- */
  const DETAILS = (() => {
    /* nom : la clé française (carnet, émaux trouvés) ; aff : ce qu'on lit et ce qu'on tape */
    const out = new Map(), meubles = {}, ajoute = (cle, nom, aff, sorte, test) => { if (!out.has(cle)) out.set(cle, { cle, nom, aff, sorte, test, mot: plie(aff), detail: true }); };
    EMAUX.forEach(n => ajoute(`e:${n}`, n, voc("emaux", n), Tr("Émail", "Tincture"), t => t.emaux.includes(n) ? "ok" : "no"));
    for (const c of CARTES) {
      const t = c.t;
      if (t.compo !== "Plein") ajoute(`c:${t.compo}`, t.compo, voc("compo", t.compo), Tr("Partition", "Division"), u => u.compo === t.compo ? "ok" : "no");
      t.pieces.forEach(pc => ajoute(`p:${pc}`, pc, voc("pieces", pc), Tr("Pièce", "Ordinary"), u => u.pieces.includes(pc) ? "ok" : "no"));
      t.meubles.forEach(k => (meubles[nomMeuble(k)] = meubles[nomMeuble(k)] || new Set()).add(k));
    }
    /* un meuble par nom affiché : deux dessins qui portent le même nom (deux lions) ne font qu'un détail */
    for (const [nom, ks] of Object.entries(meubles)) {
      const fam = new Set([...ks].map(famille));
      ajoute(`m:${plie(nom)}`, nom, voc("meubles", nom), Tr("Meuble", "Charge"), u => u.meubles.some(x => ks.has(x)) ? "ok" : u.meubles.some(x => fam.has(famille(x))) ? "mid" : "no");
    }
    return out;
  })();
  const DIT_DETAIL = Tr({ ok: "dans l'écu", mid: "un proche, de la même famille", no: "absent" }, { ok: "on the shield", mid: "a close relative, of the same family", no: "absent" });
  $("#gdefs").innerHTML = globalDefs();

  /* ---------- le tirage du jour : le document du jour, dans la base ---------- */
  const numAuj = Jour.numero();
  const demande = /^#n=(\d+)$/.exec(location.hash);
  const hors = !!demande && +demande[1] >= 1 && +demande[1] < numAuj;                           // un jour passé, pour essayer : hors concours
  const N = hors ? +demande[1] : numAuj;
  const tirage = await Jour.charge(N);
  const cible = tirage.doc && tirage.doc.ecu ? PAR_NOM.get(tirage.doc.ecu[NIV]) : null;
  if (!cible) {
    $("#jeu-chargement").textContent = tirage.doc ? Tr("L'écu de ce jour n'est plus dans le jeu : revenez demain.", "Today's shield is no longer in the game: please come back tomorrow.") : tirage.msg;
    return;
  }
  const ESSAIS = NIVEAUX[NIV].essais;

  /* ---------- le carnet (scores) : lu une fois la synchronisation en ligne faite (trois secondes au plus) ---------- */
  await Compte.pret;
  const K = Jour.carnet(JEU);
  const jourSauve = () => (hors ? null : K.jour(N));

  /* ---------- l'état de la partie ---------- */
  const J = { essais: [], details: [], fini: false, gagne: false, trouves: new Set(), absents: new Set(), hors };
  const etat = () => ({ essais: J.essais.map(c => c.nom), details: J.details.map(d => d.cle), fini: J.fini, gagne: J.gagne, ...(J.abandon ? { abandon: true } : {}) });
  const sauve = () => { if (!hors) K.garde(N, etat()); };

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
  /* les armes des joueurs (assets/compte.js) : l'état de l'Atelier, dessiné à la demande par Compte.prepare(code) */

  /* ---------- l'écu mystère se dévoile par étapes : la silhouette, puis les partitions, les pièces, les meubles ---------- */
  const ETAPES = Tr(["sa silhouette", "ses partitions", "ses pièces", "ses meubles"], ["its outline", "its divisions", "its ordinaries", "its charges"]);
  function devoile(S, k) {
    if (k >= 3) return S;
    const M = JSON.parse(JSON.stringify(S));
    if (k === 0) Object.assign(M, { q: "", ab: "", gb: "", xc: "", xb: "", xp: "", h1: "", h2: "", A: M.A.map((a, i) => (i ? a : { ...ADEF, f: "plein", t1: S.A[0].t1, p: "", m: "", m2: "" })) });
    else M.A = M.A.map(a => ({ ...a, m: "", m2: "", ...(k === 1 ? { p: "", ln: "" } : {}) }));
    normalizeAll(M);
    return M;
  }

  /* ---------- l'écu mystère et les émaux ---------- */
  async function dessineMystere() {
    const fini = J.fini, nb = J.essais.length;
    $("#jeu-ecu").innerHTML = await svgDe(fini ? cible : { ...cible, S: devoile(cible.S, nb) }, fini ? undefined : { gris: J.trouves });
    $("#jeu-mystere").style.setProperty("--flou", fini ? 0 : Math.max(0, 6 - nb * 1.5).toFixed(2) + "px");
    $("#jeu-mystere").classList.toggle("vide", !nb && !fini);
    $("#jeu-mystere").classList.toggle("fini", fini);
    $("#jeu-ecu").setAttribute("aria-label", fini ? Tr(`Les armes : ${cible.aff}`, `The arms: ${cible.aff}`) : Tr(`Les armes mystères, ${J.trouves.size} ${J.trouves.size > 1 ? "émaux trouvés" : "émail trouvé"} sur ${cible.t.emaux.length}`, `The mystery arms, ${J.trouves.size} of ${cible.t.emaux.length} tinctures found`));
    $("#jeu-leg").textContent = fini ? cible.aff : Tr(["Sa silhouette", "+ partitions", "+ pièces", "Armes mystères"], ["Its outline", "+ divisions", "+ ordinaries", "Mystery arms"])[Math.min(nb, 3)];
    $("#jeu-leg").title = fini || nb >= 3 ? "" : Tr(`Au prochain essai, l'écu montrera ${ETAPES[nb + 1]}.`, `On the next guess, the shield will show ${ETAPES[nb + 1]}.`);
  }
  function dessinePalette() {
    const absents = new Set([...J.essais.flatMap(c => c.t.emaux).filter(n => !cible.t.emaux.includes(n)), ...J.absents]);
    const couleur = n => (DATA.tinctures.find(t => t.nom === n) || {}).color || "#888";
    $("#jeu-palette").innerHTML = EMAUX.map(n => {
      const etat = J.trouves.has(n) ? "oui" : absents.has(n) ? "non" : "";
      const dit = etat === "oui" ? Tr("dans l'écu mystère", "on the mystery shield") : etat === "non" ? Tr("pas dans l'écu mystère", "not on the mystery shield") : Tr("pas encore essayé", "not tried yet");
      return `<li class="em ${etat}" data-e="${n}" style="--c:${couleur(n)}"><span class="pastille" aria-hidden="true">${etat === "oui" ? "✓" : etat === "non" ? "✗" : ""}</span><span class="nom">${nomEmail(n)}<b class="sr">${Tr(" : ", ": ")}${dit}</b></span></li>`;
    }).join("");
    const total = cible.t.emaux.length;
    $("#jeu-nb").innerHTML = Tr(`L'écu mystère compte <b>${total} ${total > 1 ? "émaux" : "émail"}</b> : ${J.trouves.size} trouvé${J.trouves.size > 1 ? "s" : ""}.`, `The mystery shield has <b>${total} ${total > 1 ? "tinctures" : "tincture"}</b>: ${J.trouves.size} found.`);
  }

  /* ---------- une réponse : une ligne ---------- */
  function ligne(c, cmp, i) {
    const cases = COLS.map(col => {
      const x = cmp[col];
      let contenu = "", dit = "";
      if (col === "emaux") {
        contenu = x.pts.map(p => `<span class="pt ${p.dans ? "oui" : "non"}" style="--c:${(DATA.tinctures.find(t => t.nom === p.n) || {}).color}" title="${nomEmail(p.n)}${p.dans ? Tr(" : dans l'écu mystère", ": on the mystery shield") : Tr(" : absent", ": absent")}"></span>`).join("");
        dit = x.pts.map(p => `${nomEmail(p.n)} ${p.dans ? Tr("présent", "present") : "absent"}`).join(", ");
      } else if (col === "meubles") {
        contenu = x.puces.length ? x.puces.map(p => `<span class="mb ${p.cls}">${esc(affMeuble(p.k))}</span>`).join("") : Tr("Aucun", "None");
        dit = x.puces.length ? x.puces.map(p => `${affMeuble(p.k)} ${VERDICT[p.cls]}`).join(", ") : Tr("aucun meuble", "no charge");
      } else if (col === "nombre") {
        contenu = x.n ? `${x.n}${x.fl ? `<span class="fl" title="${x.fl === "↑" ? Tr("plus", "more") : Tr("moins", "fewer")}">${x.fl}</span>` : ""}` : "—";
        dit = x.n ? `${x.n}${x.fl ? (x.fl === "↑" ? Tr(", l'écu mystère en a plus", ", the mystery shield has more") : Tr(", l'écu mystère en a moins", ", the mystery shield has fewer")) : ""}` : Tr("aucun meuble", "no charge");
      } else { contenu = esc(x.txt); dit = x.txt; }
      return `<li class="case ${x.cls}" style="--i:${i * COLS.length + COLS.indexOf(col)}"><span class="ent">${ENTETE[col]}</span><span class="val">${contenu}</span><span class="sym" aria-hidden="true">${SYMB[x.cls]}</span><span class="sr">${ENTETE[col]}${Tr(" : ", ": ")}${esc(dit)} — ${VERDICT[x.cls]}</span></li>`;
    }).join("");
    return cases;
  }
  async function ajouteLigne(c, i, anime) {
    const cmp = compare(c.t, cible.t);
    const li = document.createElement("li");
    li.className = "essai" + (anime ? " neuf" : "");
    li.innerHTML = `<div class="essai-tete"><span class="mini">${await svgDe(c)}</span><span class="essai-nom"><b>${esc(c.aff)}</b></span><span class="essai-n">${i + 1}/${ESSAIS}</span></div><ul class="cases">${ligne(c, cmp, i)}</ul>`;
    $("#jeu-liste-essais").appendChild(li);
    return cmp;
  }

  /* ---------- la saisie : une liste de réponses possibles ---------- */
  const champ = $("#jeu-nom"), liste = $("#jeu-liste"), aide = $("#jeu-aide-saisie");
  let sugg = [], actif = -1, choisi = null;
  const proposables = () => { const deja = new Set(J.essais.map(c => c.nom)); return CARTES.filter(c => !deja.has(c.nom)); };
  const detailsLibres = () => { const deja = new Set(J.details.map(d => d.cle)); return [...DETAILS.values()].filter(d => !deja.has(d.cle)); };
  /* la liste mêle les armes (un essai) et les détails (gratuits) : les détails dont le nom commence par le mot tapé passent devant */
  function filtre(q) {
    const t = plie(q.trim());
    if (!t) return [];
    const armes = proposables().filter(c => c.cle.includes(t)).sort((a, b) => (plie(b.aff).startsWith(t) - plie(a.aff).startsWith(t)) || a.aff.localeCompare(b.aff, LANGUE));
    const dets = detailsLibres().filter(d => d.mot.includes(t)).sort((a, b) => (b.mot.startsWith(t) - a.mot.startsWith(t)) || a.aff.localeCompare(b.aff, LANGUE)).slice(0, 3);
    const devant = dets.filter(d => d.mot.startsWith(t));
    return [...devant, ...armes.slice(0, 8 - dets.length), ...dets.filter(d => !d.mot.startsWith(t))].slice(0, 8);
  }
  const filtreArmes = q => filtre(q).filter(x => !x.detail);
  function montreListe() {
    sugg = filtre(champ.value); actif = sugg.length ? 0 : -1;
    liste.innerHTML = sugg.map((c, i) => `<li role="option" id="jeu-o${i}" data-i="${i}" aria-selected="${i === actif}" class="${i === actif ? "on" : ""}${c.detail ? " det" : ""}"><b>${esc(c.aff)}</b><small>${c.detail ? `${Tr("Détail", "Clue")} · ${esc(c.sorte)}` : esc(voc("rubriques", c.cat))}</small></li>`).join("");
    liste.hidden = !sugg.length; champ.setAttribute("aria-expanded", String(!!sugg.length));
    if (actif >= 0) champ.setAttribute("aria-activedescendant", "jeu-o0"); else champ.removeAttribute("aria-activedescendant");
    if (q0().length && !sugg.length) aide.textContent = Tr("Ni arme ni détail de ce nom dans le jeu : essayez un autre mot.", "No arms or clue by that name in the game: try another word."); else aide.textContent = "";
  }
  const q0 = () => champ.value.trim();
  function bouge(d) {
    if (!sugg.length) return;
    actif = (actif + d + sugg.length) % sugg.length;
    [...liste.children].forEach((li, i) => { li.classList.toggle("on", i === actif); li.setAttribute("aria-selected", String(i === actif)); });
    champ.setAttribute("aria-activedescendant", `jeu-o${actif}`);
    liste.children[actif].scrollIntoView({ block: "nearest" });
  }
  function choisit(c) { choisi = c; champ.value = c.aff; liste.hidden = true; champ.setAttribute("aria-expanded", "false"); aide.textContent = ""; }
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
      const t = plie(q0()), exacts = [...proposables().filter(x => plie(x.aff) === t), ...detailsLibres().filter(d => d.mot === t)];
      c = exacts.length === 1 ? exacts[0] : (filtre(champ.value).length === 1 ? filtre(champ.value)[0] : null);
    }
    if (!c) {
      aide.textContent = !q0() ? Tr("Tapez le nom d'un État, d'une province, d'une maison… ou un détail : lion, gueules, croix…", "Type the name of a state, a province, a noble house… or a clue: lion, gules, cross…")
        : filtre(champ.value).length ? Tr("Choisissez dans la liste proposée.", "Choose from the list.") : Tr("Ni arme ni détail de ce nom dans le jeu : essayez un autre mot.", "No arms or clue by that name in the game: try another word.");
      champ.focus(); return;
    }
    if (c.detail) demandeDetail(c); else await devine(c);
  });

  /* ---------- un détail : gratuit, mais compté ---------- */
  function applique(d) {
    const r = d.test(cible.t);
    if (d.cle.startsWith("e:")) (r === "ok" ? J.trouves : J.absents).add(d.nom);
    return r;
  }
  function dessineDetails() {
    const el = $("#jeu-details");
    el.innerHTML = J.details.map(d => { const r = d.test(cible.t); return `<li class="dt ${r}" title="${esc(d.sorte)}${Tr(" : ", ": ")}${DIT_DETAIL[r]}"><span class="dt-s" aria-hidden="true">${SYMB[r]}</span>${esc(d.aff)}<span class="sr">${Tr(" : ", ": ")}${DIT_DETAIL[r]}</span></li>`; }).join("");
    el.hidden = !J.details.length;
    $("#jeu-details-t").hidden = !J.details.length;
    $("#jeu-details-t").textContent = Tr(`${J.details.length} détail${J.details.length > 1 ? "s" : ""} demandé${J.details.length > 1 ? "s" : ""} (sans perdre d'essai)`, `${J.details.length} clue${J.details.length > 1 ? "s" : ""} requested (no guess lost)`);
  }
  function demandeDetail(d) {
    if (J.fini) return;
    champ.value = ""; choisi = null; liste.hidden = true; aide.textContent = "";
    J.details.push(d);
    const r = applique(d);
    $("#jeu-annonce").textContent = `${d.aff}${Tr(" : ", ": ")}${DIT_DETAIL[r]}.`;
    sauve(); majEssais(); dessineDetails(); dessinePalette();
    if (d.cle.startsWith("e:") && r === "ok") dessineMystere();
    champ.focus();
  }

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
      $("#jeu-annonce").textContent = `${c.aff}${Tr(" : ", ": ")}${COLS.map(k => `${ENTETE[k]} ${VERDICT[cmp[k].cls]}`).join(", ")}.`;
      if (J.fini) termine(); else sauve();
      majEssais(); dessinePalette(); dessinePoints();
      await dessineMystere();
      if (J.fini) await montreResultat();
      else champ.focus();
    } finally { occupe = false; }
  }
  /* ---------- abandonner : l'écu se révèle, la partie compte comme perdue (la série retombe) ---------- */
  const btAbandon = $("#jeu-abandon");
  let abandonT = 0;
  btAbandon.addEventListener("click", async () => {
    if (J.fini || occupe) return;
    if (!btAbandon.dataset.sur) {                                       // un premier clic demande confirmation, qui retombe au bout de quelques secondes
      btAbandon.dataset.sur = "1"; btAbandon.textContent = Tr("Sûr ? Cliquez encore pour révéler l'écu (partie perdue)", "Sure? Click again to reveal the shield (counts as a loss)");
      clearTimeout(abandonT); abandonT = setTimeout(() => { delete btAbandon.dataset.sur; btAbandon.textContent = Tr("Abandonner", "Give up"); }, 5000);
      return;
    }
    clearTimeout(abandonT);
    occupe = true;
    try {
      J.fini = true; J.gagne = false; J.abandon = true;
      $("#jeu-annonce").textContent = Tr(`Abandon : c'étaient les armes de ${cible.aff}.`, `Gave up: these were the arms of ${cible.aff}.`);
      termine();
      majEssais(); dessinePalette(); dessinePoints();
      await dessineMystere();
      await montreResultat();
    } finally { occupe = false; }
  });
  function termine() {
    if (!hors) K.clos(N, etat());
    dessineCote();
    setTimeout(() => dessineClassement(true), 1800);                            // le temps que le résultat parte en ligne
  }
  const majEssais = () => {
    const n = J.essais.length, reste = ESSAIS - n;
    const nd = J.details.length, det = nd ? ` · ${nd} ${Tr("détail", "clue")}${nd > 1 ? "s" : ""}` : "";
    $("#jeu-essais").textContent = (J.fini ? (J.gagne ? Tr(`Trouvé en ${n}`, `Found in ${n}`) : J.abandon ? Tr("Abandonné", "Gave up") : Tr("Perdu", "Lost")) : Tr(`Essai ${n + 1} sur ${ESSAIS}`, `Guess ${n + 1} of ${ESSAIS}`)) + det;
    $("#jeu-saisie").hidden = J.fini; aide.hidden = J.fini; $("#jeu-abandon").hidden = J.fini;
    if (!J.fini) champ.placeholder = n ? Tr(`Encore ${reste} essai${reste > 1 ? "s" : ""}… ou un détail`, `${reste} guess${reste > 1 ? "es" : ""} left… or a clue`) : Tr("Des armes, ou un détail : lion, gueules…", "A coat of arms, or a clue: lion, gules…");
  };

  /* ---------- la fin de la partie ---------- */
  const nb = x => x.toLocaleString(Tr("fr-FR", "en-GB"));
  const imageDe = a => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(a.file)}?width=420`;
  function texteDePartage() {
    const lignes = J.essais.map(c => { const m = compare(c.t, cible.t); return COLS.map(k => EMOJI[m[k].cls]).join(""); });
    const nd = J.details.length;
    return `${Tr(`L'Écu du jour n° ${N}`, `Shield of the Day #${N}`)} · ${NIVEAUX[NIV].nom} — ${J.gagne ? J.essais.length : "X"}/${ESSAIS}${J.abandon ? Tr(" (abandon)", " (gave up)") : ""}${nd ? ` · 🔎 ${nd} ${Tr("détail", "clue")}${nd > 1 ? "s" : ""}` : ""}${hors ? Tr(" (hors concours)", " (unranked)") : ""}\n${lignes.join("\n")}\nhttps://armorial.web.app/${Tr("", "en.html")}?niveau=${NIV}`;
  }
  let minuteur = 0;
  async function montreResultat() {
    const r = $("#jeu-resultat"), a = cible, n = J.essais.length;
    const lien = a.gal === "blasons" ? `blasons.html#${slugCarte(a.nom)}` : `personnages.html#${slugCarte(a.nom)}`;
    const atelier = adresseAtelier(a, a.gal);
    /* en anglais : les renvois des cartes mènent à des pages encore en français, ils sont laissés de côté */
    const termes = termesDe(a.blason), renvois = EN ? [] : (a.liens || []).map(l => `<a href="${esc(l.href)}">${esc(l.t)}</a>`);
    r.className = "jeu-resultat " + (J.gagne ? "ok" : "ko");
    r.innerHTML = `<h2>${J.gagne ? (n === 1 ? Tr("Du premier coup !", "First try!") : n <= 3 ? Tr("Bien vu !", "Well spotted!") : Tr("Trouvé !", "Found it!")) : J.abandon ? Tr("Abandon", "You gave up") : Tr("Perdu… pour cette fois", "Lost… this time")}</h2>
      <p class="res-dit">${Tr(J.gagne ? `Ces armes sont celles de <b>${esc(a.aff)}</b>${n === 1 ? "" : `, trouvées en ${n} essais`}${J.details.length ? `${n === 1 ? ", trouvées" : ""} avec ${J.details.length} détail${J.details.length > 1 ? "s" : ""}` : n === 1 ? ", sans aucun détail" : ""}.` : `C'étaient les armes de <b>${esc(a.aff)}</b>.`,
        J.gagne ? `These are the arms of <b>${esc(a.aff)}</b>${n === 1 ? "" : `, found in ${n} guesses`}${J.details.length ? `${n === 1 ? ", found" : ""} with ${J.details.length} clue${J.details.length > 1 ? "s" : ""}` : n === 1 ? ", without a single clue" : ""}.` : `These were the arms of <b>${esc(a.aff)}</b>.`)}</p>
      ${J.gagne && !hors ? `<p class="res-points"><b>+${nb(Compte.points[JEU](n, J.details.length))}</b> points</p>` : ""}
      <figure class="res-fig"><img src="${esc(imageDe(a))}" alt="${Tr("Armoiries", "Coat of arms")}${Tr(" : ", ": ")}${esc(a.aff)}" width="220" referrerpolicy="no-referrer"${styleFiltre(a)}>
        <figcaption>${a.porteur || a.meta ? `${esc(a.porteur || a.meta)}<br>` : ""}<i>${esc(blasonCarte(a))}</i></figcaption></figure>
      ${termes.length ? `<p class="res-retenir"><span>${Tr("À retenir", "French terms to remember")}</span> <span lang="fr">${termes.map(lienTerme).map(versLangue).join(" · ")}</span></p>` : ""}
      ${a.desc ? `<p class="res-histoire">${esc(a.desc)}</p>` : ""}
      <p class="res-actes"><button type="button" class="jx-go" id="jeu-partage">${Tr("Partager mon résultat", "Share my result")}</button><button type="button" class="jx-go jx-go-2" id="jeu-voir-stats">${Tr("Mes statistiques", "My statistics")}</button>${Compte.enLigne ? `<button type="button" class="jx-go jx-go-2" id="jeu-voir-cl">${Tr("Classement", "Leaderboard")}</button>` : ""}<span class="res-copie" id="jeu-copie" role="status"></span></p>
      <p class="res-liens">${[...renvois, `<a href="${versLangue(lien)}">${Tr("Voir la carte dans l'Armorial", "See the card in the Armorial")}</a>`, `<a href="${atelier}">${Tr("Redessiner dans l'Atelier", "Redraw it in the Atelier")}</a>`].join(" · ")}</p>
      <p class="res-prochain" id="jeu-prochain"></p>
      <p class="res-credit">Image${Tr(" : ", ": ")}<i>${esc(a.file)}</i>, ${esc(a.auteur || Tr("auteur inconnu", "unknown author"))}, ${a.licurl ? `<a href="${esc(a.licurl)}" rel="noopener">${esc(a.lic)}</a>` : esc(a.lic || Tr("licence libre", "free licence"))}, via Wikimedia Commons.</p>`;
    r.hidden = false;
    /* la partie finie, l'encyclopédie n'est plus une aide : c'est la suite */
    $(".jx-armorial .jx-sur").textContent = Tr("Pour aller plus loin", "To go further");
    $("#jx-armorial-t").textContent = Tr("L'Armorial vous raconte le reste", "The Armorial tells you the rest");
    $("#jeu-voir-stats").addEventListener("click", () => ouvreDlg("dlg-stats"));
    if ($("#jeu-voir-cl")) $("#jeu-voir-cl").addEventListener("click", () => ouvreDlg("dlg-classement"));
    $("#jeu-partage").addEventListener("click", async () => {
      const t = texteDePartage(), msg = $("#jeu-copie");
      try { await navigator.clipboard.writeText(t); msg.textContent = Tr("Copié : collez-le où vous voulez.", "Copied: paste it anywhere you like."); }
      catch (e) { window.prompt(Tr("Copiez votre résultat :", "Copy your result:"), t); }
    });
    clearInterval(minuteur);
    const tic = () => {
      const el = $("#jeu-prochain"); if (!el) return;
      if (hors) { el.innerHTML = Tr(`Écu n° ${N} rejoué hors concours. <a href="./">Retour à l'écu du jour</a>`, `Shield #${N} replayed, unranked. <a href="en.html">Back to today's shield</a>`); return; }
      const autres = Object.keys(NIVEAUX).filter(k => k !== NIV && !Jour.fait(NIVEAUX[k].jeu, N));
      el.innerHTML = `${Tr("Prochain écu dans", "Next shield in")} ${Jour.compteARebours()}${autres.length ? ` · ${Tr("Encore à jouer aujourd'hui :", "Still to play today:")} ${autres.map(k => `<a href="?niveau=${k}">${NIVEAUX[k].nom}</a>`).join(", ")}` : ""}`;
      if (Jour.avantDemain() === 0) location.reload();
    };
    tic(); minuteur = setInterval(tic, 1000);
    r.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "instant" : "smooth" });
    r.focus({ preventScroll: true });
  }

  /* ---------- les fenêtres : comment jouer, statistiques, classement ---------- */
  function ouvreDlg(id) {
    const d = document.getElementById(id);
    if (!d || d.open) return;
    if (id === "dlg-classement") dessineClassement();
    d.showModal();
  }
  document.querySelectorAll("dialog.jx-dlg").forEach(d => d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-fermer]")) d.close(); }));
  $("#jx-aide").addEventListener("click", () => ouvreDlg("dlg-aide"));
  $("#jx-stats").addEventListener("click", () => ouvreDlg("dlg-stats"));
  $("#jx-classement").addEventListener("click", () => ouvreDlg("dlg-classement"));
  $("#jeu-pf").addEventListener("click", () => Compte.ouvre());

  /* ---------- le profil (la barre du haut) et les statistiques (leur fenêtre) ---------- */
  function dessineCote() {
    const s = K.C.stats, p = Compte.profil(), vivante = K.serie();
    const max = Math.max(1, ...s.rep);
    const armes = p ? Compte.dessin(p.armes) : "";
    $("#jx-moi-ecu").innerHTML = armes || (p ? "" : `<svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="4" fill="currentColor"/><path d="M4 20.5c.8-4.2 4-6.5 8-6.5s7.2 2.3 8 6.5z" fill="currentColor"/></svg>`);
    $("#jx-moi-nom").textContent = p ? p.pseudo : Tr("Profil", "Profile");
    $("#jeu-pf").classList.toggle("avec", !!p);
    $("#jeu-profil").innerHTML = `<h2 id="jeu-profil-t">${Tr("Vos statistiques", "Your statistics")} <small>${Tr(`niveau ${NIVEAUX[NIV].nom}`, `${NIVEAUX[NIV].nom} level`)}</small></h2>
      <div class="pf">${p ? `<span class="pf-ecu">${armes}</span><span class="pf-nom"><b>${esc(p.pseudo)}</b><small>${Tr("joueur depuis le", "playing since")} ${esc(p.cree.split("-").reverse().join("/"))}</small></span>`
        : `<span class="pf-nom"><b>${Tr("Joueur anonyme", "Anonymous player")}</b><small>${Tr("Créez un profil pour signer vos scores de vos propres armes.", "Create a profile to sign your scores with your own arms.")}</small></span>`}</div>
      <dl class="stats"><div><dt>${Tr("Parties", "Played")}</dt><dd>${s.joues}</dd></div><div><dt>${Tr("Victoires", "Wins")}</dt><dd>${s.joues ? Math.round(100 * s.gagnes / s.joues) : 0}<small>%</small></dd></div><div><dt>${Tr("Série", "Streak")}</dt><dd>${vivante}</dd></div><div><dt>${Tr("Record", "Best")}</dt><dd>${s.serieMax}</dd></div></dl>
      <p class="pf-points"><b>${nb(Jour.totalPoints())}</b> ${Tr("points, tous niveaux confondus", "points across all levels")}</p>
      <h3 class="rep-t">${Tr("Victoires par nombre d'essais", "Wins by number of guesses")}</h3>
      <ol class="rep" aria-label="${Tr("Répartition des victoires par nombre d'essais", "Distribution of wins by number of guesses")}">${s.rep.map((n, i) => `<li${J.fini && J.gagne && !hors && J.essais.length === i + 1 ? ' class="auj"' : ""}><span class="rn">${i + 1}</span><span class="rb"><i style="width:${n ? Math.max(9, Math.round(100 * n / max)) : 0}%">${n || ""}</i></span></li>`).join("")}</ol>
      <p class="pf-acts"><button type="button" class="jx-go" id="jeu-pf2">${p ? Tr("Modifier mon profil", "Edit my profile") : Tr("Créer mon profil", "Create my profile")}</button></p>`;
    $("#jeu-pf2").addEventListener("click", () => { $("#dlg-stats").close(); Compte.ouvre(); });
  }
  /* les points du haut : un par essai, de la couleur de la réponse */
  function dessinePoints() {
    $("#jx-points").innerHTML = Array.from({ length: ESSAIS }, (_, i) => {
      const c = J.essais[i];
      const cls = !c ? "" : (c === cible || c.canon === cible.canon) ? "ok" : "no";
      return `<i class="${cls}"></i>`;
    }).join("");
  }
  /* les niveaux de l'écu du jour, en onglets */
  function dessineNiveaux() {
    $("#jeu-niveaux").innerHTML = Object.entries(NIVEAUX).map(([k, v]) => {
      const fait = Jour.fait(v.jeu, N);
      return `<a href="?niveau=${k}${hors ? `#n=${N}` : ""}" class="jx-niv${k === NIV ? " on" : ""}"${k === NIV ? ' aria-current="page"' : ""} title="${esc(v.dit)}"><b>${v.nom}</b><small>${v.essais} ${Tr("essais", "guesses")}${fait && !hors ? Tr(" · fait ✓", " · done ✓") : ""}</small></a>`;
    }).join("");
  }
  /* les autres jeux du jour ; les exercices sont dans S'exercer */
  function dessineAutres() {
    const L = [
      [versLangue("atelier.html#defi=dessin"), Tr("Dessine-moi", "Draw It for Me"), Tr("Un blasonnement : composez l'écu", "A blazon: draw the shield"), "🎨", "or", "dessin"],
      [versLangue("jour.html#intrus"), Tr("L'Intrus", "The Odd One Out"), Tr("Cinq manches : l'écu qui enfreint la règle", "Five rounds: the shield that breaks the rule"), "⚖️", "sinople", "intrus"],
      [versLangue("jour.html#trous"), Tr("Le blasonnement à trous", "Fill in the Blazon"), Tr("Les mots qui manquent au texte", "The words missing from the blazon"), "📜", "pourpre", "trous"],
    ];
    $("#jeu-autres").innerHTML = L.map(([href, t, d, ic, c, jeu]) => `<li><a class="jx-jeu c-${c}" href="${href}"><span class="ic" aria-hidden="true">${ic}</span><span class="t">${t}</span><span class="d">${d}</span><span class="f">${Jour.fait(jeu, numAuj) ? Tr("Fait ✓", "Done ✓") : Tr("Aujourd'hui", "Today")}</span></a></li>`).join("")
      + `<li><a class="jx-jeu c-azur" href="${versLangue("exercices.html")}"><span class="ic" aria-hidden="true">🎓</span><span class="t">${Tr("S'exercer", "Practice")}</span><span class="d">${Tr("Lire, dessiner, la règle, le vocabulaire… à volonté", "Reading, drawing, the rule, vocabulary… as much as you like")}</span><span class="f">${Tr("Sans limite", "Unlimited")}</span></a></li>`;
  }

  /* ---------- le classement (comptes en ligne seulement) ---------- */
  const CL = { onglet: "jour", jour: null, general: null, erreur: false };
  const sameNom = (a, b) => a && b && a.toLowerCase() === b.toLowerCase();
  async function dessineClassement(frais) {
    const el = $("#jeu-classement");
    if (!el || !Compte.enLigne) return;
    $("#jx-classement").hidden = false;
    try {
      [CL.jour, CL.general] = await Promise.all([Compte.classementJour(JEU, numAuj, { frais }), Compte.classementGeneral({ frais })]);
      CL.erreur = false;
      await Promise.all([...new Set([...CL.jour, ...CL.general].map(x => Compte.armesCode(x.armes)))].map(Compte.prepare));
    } catch (e) { CL.erreur = true; }
    rendClassement();
  }
  function rendClassement() {
    const el = $("#jeu-classement"), moi = (Compte.profil() || {}).pseudo, connecte = Compte.ligne && Compte.ligne.connecte();
    const liste = CL.onglet === "jour" ? CL.jour : CL.general;
    const rangDe = x => liste.findIndex(y => y.points === x.points) + 1;      // à points égaux, même rang : 1, 2, 2, 4
    const ligne = x => `<li data-r="${rangDe(x)}"${sameNom(x.pseudo, moi) ? ' class="moi"' : ""}><span class="rg">${rangDe(x)}</span><span class="mini">${Compte.dessin(x.armes)}</span><b>${esc(x.pseudo)}</b><span class="sc">${nb(x.points)} pts<small>${CL.onglet === "jour" ? Tr(`${x.essais} essai${x.essais > 1 ? "s" : ""}${x.details ? ` · ${x.details} dét.` : ""}`, `${x.essais} guess${x.essais > 1 ? "es" : ""}${x.details ? ` · ${x.details} clue${x.details > 1 ? "s" : ""}` : ""}`) : Tr(`${x.victoires} victoire${x.victoires > 1 ? "s" : ""}`, `${x.victoires} win${x.victoires > 1 ? "s" : ""}`)}</small></span></li>`;
    el.innerHTML = `<h2 id="jeu-classement-t">${Tr("Classement", "Leaderboard")}</h2>
      <div class="onglets" role="tablist" aria-label="${Tr("Classement", "Leaderboard")}"><button type="button" role="tab" aria-selected="${CL.onglet === "jour"}" data-o="jour">${Tr("Du jour", "Today")}</button><button type="button" role="tab" aria-selected="${CL.onglet === "general"}" data-o="general">${Tr("Général", "All time")}</button></div>
      <p class="cl-note">${CL.onglet === "jour" ? Tr(`Niveau ${NIVEAUX[NIV].nom}`, `${NIVEAUX[NIV].nom} level`) : Tr("Tous niveaux confondus", "All levels combined")}</p>
      ${CL.erreur || !liste ? `<p class="cl-vide">${Tr("Le classement n'est pas disponible pour l'instant.", "The leaderboard isn't available right now.")}</p>`
        : liste.length ? `<ol class="cl">${liste.map(ligne).join("")}</ol>` : `<p class="cl-vide">${CL.onglet === "jour" ? Tr("Personne n'a encore trouvé l'écu du jour : soyez le premier.", "Nobody has found today's shield yet: be the first.") : Tr("Le classement se remplit avec les premières parties.", "The leaderboard fills up with the first games.")}</p>`}
      ${connecte ? "" : `<p class="cl-aide">${Tr(`<button type="button" class="lnk" id="jeu-cl-compte">Créez un compte en ligne</button> pour y figurer.`, `<button type="button" class="lnk" id="jeu-cl-compte">Create an online account</button> to appear on it.`)}</p>`}`;
    el.querySelectorAll("[data-o]").forEach(b => b.addEventListener("click", () => { CL.onglet = b.dataset.o; rendClassement(); }));
    const cc = $("#jeu-cl-compte"); if (cc) cc.addEventListener("click", () => { $("#dlg-classement").close(); Compte.ouvre(); });
  }
  if (Compte.surSynchro) { let t = 0; Compte.surSynchro(() => { clearTimeout(t); t = setTimeout(() => { dessineCote(); if (J.fini) dessineClassement(true); }, 300); }); }
  Compte.sur(() => { K.relit(); const p = Compte.profil(); if (p) Compte.prepare(p.armes).then(dessineCote); dessineCote(); });

  /* ---------- départ ---------- */
  $("#jeu-jour").innerHTML = `${Tr(`Écu n° ${N}`, `Shield #${N}`)}<small>${Jour.quand(N)}${hors ? Tr(" · hors concours", " · unranked") : ""}</small>`;
  const sv = jourSauve();
  const premiere = !K.C.stats.joues && !(sv && sv.essais.length);
  dessineNiveaux(); dessineAutres();
  { const p = Compte.profil(); if (p) await Compte.prepare(p.armes); }      // les armes du joueur, pour la barre du haut et ses statistiques
  dessineCote();
  dessinePalette(); majEssais(); dessinePoints();
  /* une partie commencée aujourd'hui reprend là où elle s'est arrêtée */
  if (sv) {
    for (const nom of sv.essais) { const c = PAR_NOM.get(nom); if (!c) continue; J.essais.push(c); c.t.emaux.forEach(n => { if (cible.t.emaux.includes(n)) J.trouves.add(n); }); }
    for (const cle of sv.details || []) { const d = DETAILS.get(cle); if (d && !J.details.includes(d)) { J.details.push(d); applique(d); } }
    J.fini = !!sv.fini; J.gagne = !!sv.gagne; J.abandon = !!sv.abandon;
    for (let i = 0; i < J.essais.length; i++) await ajouteLigne(J.essais[i], i, false);
    dessinePalette(); majEssais(); dessinePoints(); dessineDetails();
  }
  await dessineMystere();
  $("#jeu-chargement").hidden = true; $("#jeu-grille").hidden = false;
  if (premiere) { let vu = false; try { vu = !!localStorage.getItem("armorial.jeu.aide"); localStorage.setItem("armorial.jeu.aide", "1"); } catch (e) { /* sans mémoire */ } if (!vu) ouvreDlg("dlg-aide"); }
  Compte.reprendSiBrouillon();                                     // retour de l'Atelier avec un profil en cours : la fenêtre se rouvre
  if (J.fini) await montreResultat();
  dessineClassement();
  /* pour les tests (tools/smoke_test.py) : l'état et les fonctions, sans rien changer à la page */
  window.EcuDuJour = { J, cible, CARTES, DETAILS, N, NIV, ESSAIS, devine, demandeDetail, compare, traits, devoile, texteDePartage, hors };
})();
