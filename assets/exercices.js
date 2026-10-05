/* L'ARMORIAL — S'exercer : des questions pour apprendre à lire un blason.

   Rien n'y est écrit à la main : les écus sont composés au hasard par le moteur de l'Atelier (assets/dessin.js), leur
   blasonnement est celui que l'Atelier écrit (assets/blasonnement.js), et une question n'est posée que si le lecteur
   (assets/lecture.js) relit ce texte à l'identique — ce qu'on demande de lire est donc sans ambiguïté.
   Les mauvaises réponses sont des écus voisins (un seul trait change), filtrés de la même façon.

   Six exercices : lire un écu (texte à trouver), dessiner des armes (écu à trouver), la règle des émaux, le vocabulaire
   (glossaire de l'encyclopédie), les points de l'écu, et le défi du jour (six questions, les mêmes pour tous : la graine est la date).
   Seul le navigateur garde la trace des séries (localStorage, facultatif : la page marche sans). */
(async () => {
  const METAUX = ["Or", "Argent"], COULEURS = ["Gueules", "Azur", "Sable", "Sinople"], COULEURS_P = [...COULEURS, "Pourpre"];
  const clone = o => JSON.parse(JSON.stringify(o));
  const mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

  /* ---------- hasard réglé : une graine donne la même suite à tous (défi du jour) ---------- */
  const mulberry = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const graine = s => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; } return x; };
  const pick = (rng, a) => a[Math.floor(rng() * a.length)];
  const melange = (rng, a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const tire = (rng, paires) => { let x = rng() * paires.reduce((s, p) => s + p[1], 0); for (const [v, w] of paires) { x -= w; if (x < 0) return v; } return paires[0][0]; };

  /* ---------- le stock : les meubles qu'on reconnaît d'emblée, puis ceux qu'il faut avoir lus ---------- */
  const FACILE = ["lion", "aigle", "fleurdelis", "etoile", "croissant", "rose", "tour", "coquille", "roundel", "soleil", "clef", "epee", "ancre", "cerf", "cygne", "arbre", "coeur", "trefle"];
  const MOYEN = ["leopard", "griffon", "dragon", "licorne", "ours", "loup", "sanglier", "cheval", "poisson", "panthere", "merlette", "quintefeuille", "macle", "losange", "annelet", "croisette", "cloche", "roue", "chateau", "main", "gerbe", "epi", "gland", "molette", "aigle-bicephale", "comete", "eclair", "fercheval", "tau", "goutte", "rustre", "fusee", "quartefeuille", "tiercefeuille"];
  const PIECES_1 = ["chef", "fasce", "pal", "bande", "barre", "croix", "sautoir", "chevron"];
  const PIECES_N = { 1: PIECES_1, 2: [...PIECES_1, "bordure", "orle", "canton"], 3: [...PIECES_1, "bordure", "orle", "canton", "franc-quartier", "pairle"] };
  const poolMeubles = niv => (niv === 1 ? FACILE : niv === 2 ? [...FACILE, ...MOYEN] : ATL.meubles.map(m => m.kind).filter(k => k !== "billette" && k !== "croix")).filter(meuble);
  const SEMES = ["fleurdelis", "etoile", "croisette", "roundel", "coquille", "trefle", "rose", "croissant"];

  const sameClass = (rng, t, pool = COULEURS_P) => pick(rng, (classe(t) === "Métal" ? METAUX : pool).filter(x => x !== t));
  const contre = (rng, t, pool = COULEURS) => (classe(t) === "Métal" ? pick(rng, pool) : pick(rng, METAUX));   // un émail qui se détache de t

  /* ---------- des armes au hasard : un quartier ---------- */
  function armesSimples(rng, niv, force) {
    const s = { ...ADEF, m: "", p: "", pos: "autour", ct: "", ln: "", nb: "3", f: "plein" };
    const poolC = niv > 1 ? COULEURS_P : COULEURS;
    s.t1 = rng() < .5 ? pick(rng, METAUX) : pick(rng, poolC);
    const autre = () => contre(rng, s.t1, poolC);
    const meubleAvec = (nbs, tm) => { s.m = pick(rng, poolMeubles(niv)); s.nb = pick(rng, nbs); s.tm = tm; s.ta = niv === 1 || rng() < .5 ? tm : pick(rng, ["Gueules", "Azur", "Or", "Argent", "Sable"].filter(t => t !== tm)); };
    const recette = force || tire(rng, niv === 1 ? [["meuble", 5], ["piece", 4], ["piece-meubles", 2]]
      : niv === 2 ? [["piece-meubles", 3], ["piece-chargee", 2], ["partition", 3], ["raye", 1], ["bordure", 2], ["meuble", 2]]
      : [["piece-meubles", 2], ["piece-chargee", 2], ["partition", 2], ["raye", 1], ["bordure", 1], ["deux-meubles", 2], ["seme", 1], ["contourne", 1], ["bord", 2]]);
    switch (recette) {
      case "meuble": meubleAvec(niv === 1 ? ["1", "1", "2", "3", "3"] : ["1", "2", "3", "3", "4", "5", "6"], autre()); break;
      case "piece": s.p = pick(rng, PIECES_N[niv]); s.tp = autre(); break;
      case "piece-meubles": s.p = pick(rng, ["fasce", "chevron", "bande", "pal", "croix", "barre", "sautoir"]); s.tp = autre(); meubleAvec(["3", "3", "1", "2", "4"], autre()); break;
      case "piece-chargee": s.p = pick(rng, ["fasce", "bande", "pal", "chevron", "croix", "chef", "sautoir"]); s.tp = autre(); s.pos = "sur"; meubleAvec(["1", "3", "3"], contre(rng, s.tp, poolC)); break;
      case "partition": {
        s.f = "part"; s.part = pick(rng, ["parti", "coupe", "tranche", "taille"]);
        if (rng() < .5) { s.t2 = sameClass(rng, s.t1, poolC); if (classe(s.t1) === "Métal") s.t2 = s.t1 === "Or" ? "Argent" : "Or"; meubleAvec(["1"], classe(s.t1) === "Métal" ? pick(rng, poolC) : pick(rng, METAUX)); }
        else s.t2 = contre(rng, s.t1, poolC);
        break;
      }
      case "raye": s.f = "ray"; s.ray = pick(rng, ["barry", "paly", "bendy", "bendysin"]); s.n = pick(rng, niv === 1 ? ["6"] : ["6", "6", "7", "5", "9"]); s.t2 = contre(rng, s.t1, poolC); break;   // 5, 7, 9 : « d'or à trois pals de gueules »
      case "bordure": s.p = "bordure"; s.tp = autre(); meubleAvec(["1"], autre()); break;
      case "deux-meubles": meubleAvec(["1"], autre()); s.m2 = pick(rng, poolMeubles(niv).filter(k => k !== s.m)); s.nb2 = pick(rng, ["1", "3"]); s.d2 = "chef"; s.tm2 = autre(); s.ta2 = s.tm2; break;
      case "seme": meubleAvec(["seme"], autre()); s.m = pick(rng, SEMES.filter(meuble)); s.nb = "seme"; break;
      case "contourne": meubleAvec(["1"], autre()); s.m = pick(rng, ["lion", "leopard", "griffon", "dragon", "licorne", "clef", "aigle"].filter(meuble)); s.ct = "1"; break;
      case "bord": s.p = pick(rng, ["fasce", "chef", "bande", "chevron", "pal", "bordure"]); s.tp = autre(); s.ln = pick(rng, Object.keys(CONTOUR_NOM)); if (rng() < .5) meubleAvec(["1", "3"], autre()); break;
    }
    return s;
  }
  function armes(rng, niv) {
    const St = fresh(), r = rng();
    if (niv === 3 && r < .26) { St.q = "2"; St.A[0] = armesSimples(rng, 2); St.A[1] = armesSimples(rng, 1); }
    else if (niv === 3 && r < .38) { St.ab = "1"; St.A[0] = armesSimples(rng, 1, "meuble"); St.A[4] = armesSimples(rng, 1, "piece"); }
    else if (niv === 3 && r < .46) { const s = armesSimples(rng, 2, "meuble"); s.f = "part"; s.part = pick(rng, ["tierce-pal", "tierce-fasce"]); s.t1 = pick(rng, METAUX); s.t2 = pick(rng, COULEURS); s.t3 = pick(rng, COULEURS.filter(t => t !== s.t2)); s.m = ""; St.A[0] = s; }
    else St.A[0] = armesSimples(rng, niv);
    return St;
  }
  const empreinte = St => JSON.stringify(canonAll(St));
  /* des armes sont bonnes à poser si l'Atelier les accepte telles quelles, si la règle des émaux y est tenue (sauf exercice sur cette règle)
     et si le lecteur relit le texte qu'on en tire, à l'identique et sans réserve */
  function valide(St, regle = true) {
    const avant = empreinte(St);
    normalizeAll(St);
    if (empreinte(St) !== avant) return false;
    if (regle && ruleAll(St).length) return false;
    const r = lire(blazonAll(St));
    return !!(r.ok && r.exact && !r.notes.length && empreinte(r.etat) === avant);
  }
  function tireArmes(rng, niv) {
    for (let i = 0; i < 120; i++) { const St = armes(rng, niv); if (valide(St)) return St; }
    const St = fresh(); St.A[0] = { ...ADEF, t1: "Azur", m: "fleurdelis", nb: "3", tm: "Or", ta: "Or" }; normalizeAll(St); return St;
  }

  /* ---------- les mauvaises réponses : des armes voisines, où un seul trait change ---------- */
  const MUT = {
    quartiers(rng, a, c) { if (c.q !== "2") return false; [c.A[0], c.A[1]] = [c.A[1], c.A[0]]; return true; },
    champ(rng, a) { if (a.f === "plein" || rng() < .5) a.t1 = sameClass(rng, a.t1); else a.t2 = sameClass(rng, a.t2); return true; },
    emailMeuble(rng, a) { if (!a.m) return false; a.tm = sameClass(rng, a.tm); return true; },
    emailPiece(rng, a) { if (!a.p) return false; a.tp = sameClass(rng, a.tp); return true; },
    nombre(rng, a) { if (!a.m || a.nb === "seme") return false; const cs = countsFor(a).filter(n => n !== a.nb && n !== "seme"); if (!cs.length) return false; a.nb = pick(rng, cs); return true; },
    meuble(rng, a) { if (!a.m) return false; const cat = meuble(a.m).cat, c = ATL.meubles.filter(m => m.cat === cat && m.kind !== a.m && poolMeubles(3).includes(m.kind) && !m.seul); if (!c.length) return false; a.m = pick(rng, c).kind; return true; },
    piece(rng, a) { if (!a.p) return false; a.p = pick(rng, PIECES_1.filter(p => p !== a.p)); a.ln = ""; return true; },
    rayures(rng, a) { if (a.f !== "ray") return false; if (rng() < .5) a.ray = pick(rng, ["barry", "paly", "bendy", "bendysin"].filter(r => r !== a.ray)); else a.n = pick(rng, ["5", "6", "7", "8", "9"].filter(n => n !== a.n)); return true; },
    partition(rng, a) { const l = ["parti", "coupe", "tranche", "taille"]; if (a.f !== "part" || !l.includes(a.part)) return false; a.part = pick(rng, l.filter(x => x !== a.part)); return true; },
    disposition(rng, a) { const ds = dispos(a); if (!a.m || ds.length < 2) return false; a.d = pick(rng, ds.filter(d => d.id !== a.d).map(d => d.id)); return true; },
    sens(rng, a) { const m = a.m && meuble(a.m); if (!m || !m.asym) return false; a.ct = a.ct === "1" ? "" : "1"; return true; },
    place(rng, a) { if (!a.p || !a.m) return false; a.pos = a.pos === "sur" ? "autour" : "sur"; return true; },
    retrait(rng, a) { if (a.m && a.p) { if (rng() < .5) a.m = ""; else a.p = ""; return true; } return false; },
  };
  function voisines(rng, St, n) {
    const out = [], vus = new Set([empreinte(St)]), textes = new Set([blazonAll(St)]), aspects = new Set();
    for (let essai = 0; essai < 240 && out.length < n; essai++) {
      const c = clone(St), act = active(c), qi = pick(rng, act), nom = pick(rng, Object.keys(MUT));
      if (essai < 120 && aspects.has(nom)) continue;                       // d'abord des différences de nature variée, puis on se contente de ce qu'on trouve
      if (c.q && nom === "retrait") continue;
      if (!MUT[nom](rng, c.A[qi], c)) continue;
      if (!valide(c)) continue;
      const e = empreinte(c), t = blazonAll(c);
      if (vus.has(e) || textes.has(t)) continue;
      vus.add(e); textes.add(t); aspects.add(nom); out.push(c);
    }
    return out;
  }

  /* ---------- le texte, et ce qui change d'un texte à l'autre ---------- */
  const mots = t => t.split(/\s+/).filter(Boolean);
  /* mots de b absents de a (plus longue sous-suite commune) : ce sont eux qu'on souligne */
  function difference(a, b) {
    const A = mots(a), B = mots(b), L = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
    for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const commun = new Set(); let i = 0, j = 0;
    while (i < A.length && j < B.length) { if (A[i] === B[j]) { commun.add(j); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++; }
    return B.map((w, k) => commun.has(k) ? esc(w) : `<mark>${esc(w)}</mark>`).join(" ");
  }
  /* « Lecture guidée » : le champ, puis la pièce, puis les meubles — l'ordre de lecture du blason */
  function decoupe(a) {
    const plein = blazon(a), champ = blazon({ ...a, m: "", m2: "", p: "", ln: "" }).replace(/ plein$/, "");
    const sansM = a.p ? blazon({ ...a, m: "", m2: "" }) : champ;
    if (!plein.startsWith(champ)) return null;
    const out = [["Le champ", champ]];
    if (a.p && sansM.startsWith(champ) && plein.startsWith(sansM)) {
      out.push(["La pièce", sansM.slice(champ.length).replace(/^,?\s*/, "")]);
      const reste = plein.slice(sansM.length).replace(/^,?\s*/, "");
      if (reste) out.push(["Les meubles", reste]);
    } else if (!a.p) {
      const reste = plein.slice(champ.length).replace(/^,?\s*/, "");
      if (reste) out.push(["Les meubles", reste]);
    } else return null;
    return out.length > 1 ? out : null;
  }
  /* quels termes du glossaire figurent dans ce blasonnement : des liens vers l'encyclopédie */
  const sluge = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  function termesDe(texte) {
    const t = " " + plie(texte).replace(/[^a-z0-9]+/g, " ") + " ", emaux = new Set(Object.values(MOT).map(plie));
    const trouves = DATA.glossaire.filter(g => { const w = plie(g.terme).replace(/[^a-z0-9]+/g, " ").trim(); return w.length > 2 && new RegExp(`\\s${w}(e|s|es)?\\s`).test(t); });
    trouves.sort((x, y) => (emaux.has(plie(x.terme)) - emaux.has(plie(y.terme))) || y.terme.length - x.terme.length);
    return trouves.slice(0, 6);
  }
  const lienTerme = g => `<a href="index.html#${termeId(g.terme, DATA.glossaire)}">${esc(g.terme.toLowerCase())}</a>`;
  const lienAtelier = St => `<a href="atelier.html#lire=${encodeURIComponent(blazonAll(St))}">Ouvrir ces armes dans l'Atelier</a>`;

  /* ---------- dessiner ---------- */
  let compteurEcu = 0;
  async function ecu(St, etiquette) {
    await loadAll(St);
    const c = compose(St, "x" + ++compteurEcu);
    return `<svg class="ecu" viewBox="${c.vb.join(" ")}" ${etiquette === null ? 'aria-hidden="true"' : `role="img" aria-label="${esc(etiquette)}"`}>${c.svg}</svg>`;
  }

  /* ---------- les questions ---------- */
  const LETTRES = ["A", "B", "C", "D"];
  async function qLire(rng, niv, dessiner) {
    let St, vs;
    for (let essai = 0; essai < 8; essai++) { St = tireArmes(rng, niv); vs = voisines(rng, St, 3); if (vs.length === 3) break; }   // des armes trop simples n'ont pas trois voisines : on en tire d'autres
    const choix = melange(rng, [{ St, ok: true }, ...vs.map(v => ({ St: v, ok: false }))]).map(c => ({ ...c, texte: blazonAll(c.St) }));
    return { type: dessiner ? "dessiner" : "lire", niv, St, texte: blazonAll(St), choix };
  }
  function qRegle(rng, niv) {
    const veut = rng() < .5;                           // la réponse attendue : armes régulières, ou non
    for (let i = 0; i < 200; i++) {
      const s = { ...ADEF, m: "", p: "", pos: "autour", nb: "3", f: "plein", ct: "" };
      s.t1 = pick(rng, [...METAUX, ...COULEURS_P]);
      const forme = niv === 1 ? pick(rng, ["meuble", "piece"]) : pick(rng, ["meuble", "piece", "charge", "charge"]);
      let paires = [];
      if (forme === "meuble") { s.m = pick(rng, poolMeubles(niv === 3 ? 2 : niv)); s.nb = pick(rng, ["1", "3"]); s.tm = pick(rng, [...METAUX, ...COULEURS_P]); s.ta = s.tm; paires = [{ fig: s.tm, sur: s.t1, quoi: s.nb === "1" ? "le meuble" : "les meubles", lieu: "le champ" }]; }
      else if (forme === "piece") { s.p = pick(rng, PIECES_1); s.tp = pick(rng, [...METAUX, ...COULEURS_P]); paires = [{ fig: s.tp, sur: s.t1, quoi: art(s.p, PIECES[s.p].g) + s.p, lieu: "le champ" }]; }
      else {
        s.p = pick(rng, ["fasce", "bande", "pal", "chevron", "croix", "chef"]); s.tp = contre(rng, s.t1, COULEURS_P); s.pos = "sur"; s.m = pick(rng, poolMeubles(2)); s.nb = pick(rng, ["1", "3"]);
        s.tm = pick(rng, [...METAUX, ...COULEURS_P]); s.ta = s.tm;
        paires = [{ fig: s.tm, sur: s.tp, quoi: s.nb === "1" ? "le meuble" : "les meubles", lieu: art(s.p, PIECES[s.p].g) + s.p }];
      }
      const St = fresh(); St.A[0] = s;
      if (!valide(St, false)) continue;
      const fautes = ruleAll(St);
      if ((fautes.length === 0) !== veut) continue;
      return { type: "regle", niv, St, texte: blazonAll(St), paires, fautes };
    }
    const St = fresh(); St.A[0] = { ...ADEF, t1: "Azur", m: "fleurdelis", nb: "3", tm: "Or", ta: "Or" }; normalizeAll(St);
    return { type: "regle", niv, St, texte: blazonAll(St), paires: [{ fig: "Or", sur: "Azur", quoi: "les meubles", lieu: "le champ" }], fautes: [] };
  }
  /* le vocabulaire : le glossaire, plus (aux niveaux 2 et 3) les attributs, les positions et le répertoire */
  function reserveVocab(niv) {
    const g = DATA.glossaire.map(e => ({ terme: e.terme, def: e.def, gloss: true }));
    const a = [...DATA.attributs, ...DATA.positions].map(e => ({ terme: e.terme, def: e.def, gloss: DATA.glossaire.some(x => x.terme === e.terme) }));
    const r = DATA.repertoire.map(e => ({ terme: e.terme, def: e.def, cat: e.cat }));
    const tout = niv === 1 ? g.filter(e => e.def.length <= 120) : niv === 2 ? [...g, ...a] : [...g, ...a, ...r];
    const vus = new Set(); return tout.filter(e => e.def.length >= 20 && e.def.length <= 260 && !vus.has(e.terme) && vus.add(e.terme));
  }
  /* la définition ne doit pas contenir le mot qu'on cherche : on le masque (sa racine, aux accords près) */
  function masque(e) {
    const racine = plie(e.terme).replace(/[^a-z]/g, "");
    const stem = racine.length > 5 ? racine.slice(0, -2) : racine.length > 3 ? racine.slice(0, -1) : racine;
    const mots = plie(e.terme).split(/[^a-z]+/).filter(m => m.length > 3);
    return e.def.replace(/[A-Za-zÀ-ÖØ-öø-ÿŒœ]+/g, w => { const p = plie(w); return p.startsWith(stem) || mots.some(m => p.startsWith(m.length > 5 ? m.slice(0, -2) : m)) ? "▁▁▁▁" : w; });
  }
  function qVocab(rng, niv) {
    const pool = reserveVocab(niv), cible = pick(rng, pool);
    const ressemble = e => e.terme !== cible.terme && (cible.cat ? e.cat === cible.cat : !e.cat);
    let autres = melange(rng, pool.filter(ressemble)).slice(0, 3);
    if (autres.length < 3) autres = melange(rng, pool.filter(e => e.terme !== cible.terme)).slice(0, 3);
    const choix = melange(rng, [{ e: cible, ok: true }, ...autres.map(e => ({ e, ok: false }))]).map(c => ({ ...c, texte: c.e.terme }));
    return { type: "vocab", niv, cible, def: masque(cible), choix };
  }
  /* les points de l'écu : neuf cases, nommées du point de vue du porteur */
  const POINTS = [["Canton dextre du chef", "Chef", "Canton senestre du chef"], ["Flanc dextre", "Cœur", "Flanc senestre"], ["Canton dextre de la pointe", "Pointe", "Canton senestre de la pointe"]];
  const POINTS_AU = [["en haut à gauche", "en haut au centre", "en haut à droite"], ["au milieu à gauche", "au centre", "au milieu à droite"], ["en bas à gauche", "en bas au centre", "en bas à droite"]];
  function qPoints(rng) {
    const r = Math.floor(rng() * 3), c = Math.floor(rng() * 3), nom = POINTS[r][c];
    const miroir = c === 1 ? null : POINTS[r][2 - c];
    const autres = POINTS.flat().filter(n => n !== nom && n !== miroir);
    const choix = melange(rng, [nom, ...(miroir ? [miroir] : []), ...melange(rng, autres).slice(0, miroir ? 2 : 3)]).map(n => ({ texte: n, ok: n === nom }));
    return { type: "points", niv: 1, r, c, nom, choix };
  }
  function svgPoints(r, c, deco) {
    const gx = [0, 72, 128, 200], gy = [0, 86, 166, 252], id = "pt" + ++compteurEcu;
    return `<svg class="ecu" viewBox="0 0 200 252" ${deco ? 'aria-hidden="true"' : `role="img" aria-label="Un écu dont le point marqué est ${POINTS_AU[r][c]}, du point de vue du spectateur"`}><defs><clipPath id="${id}"><path d="${SHIELD_D}"/></clipPath></defs>
      <path d="${SHIELD_D}" fill="#f3eee0"/>
      <g clip-path="url(#${id})"><rect x="${gx[c]}" y="${gy[r]}" width="${gx[c + 1] - gx[c]}" height="${gy[r + 1] - gy[r]}" fill="#8e1b18" opacity=".42"/>
        <g stroke="#cabf9f" stroke-width="1"><line x1="0" y1="86" x2="200" y2="86"/><line x1="0" y1="166" x2="200" y2="166"/><line x1="72" y1="0" x2="72" y2="252"/><line x1="128" y1="0" x2="128" y2="252"/></g>
        <circle cx="${(gx[c] + gx[c + 1]) / 2}" cy="${(gy[r] + gy[r + 1]) / 2}" r="5" fill="#8e1b18"/></g>
      <path d="${SHIELD_D}" fill="none" stroke="#1a1712" stroke-width="2.4"/></svg>`;
  }

  /* armes réelles (data/blasons.json) : à qui sont ces armes, ou lequel de ces blasonnements est le leur ? Les écus sont pondérés par 1/√(taille de leur rubrique) : la Suisse (27 cartes) ne fait pas deux questions sur cinq, ni une rubrique d'un seul écu une question sur sept. */
  let BL = [];
  function tireParRubrique(rng, pool) {
    const taille = {};
    pool.forEach(a => { taille[a.cat] = (taille[a.cat] || 0) + 1; });
    const poids = pool.map(a => 1 / Math.sqrt(taille[a.cat]));
    let t = rng() * poids.reduce((x, y) => x + y, 0);
    for (let i = 0; i < pool.length; i++) { t -= poids[i]; if (t < 0) return pool[i]; }
    return pool[pool.length - 1];
  }
  function qReel(rng) {
    const pool = BL.filter(a => a.file && a.blason), cible = tireParRubrique(rng, pool), variante = rng() < .5 ? "nom" : "texte";
    const memeCat = melange(rng, pool.filter(a => a !== cible && a.cat === cible.cat && a.blason !== cible.blason));
    const autres = [...memeCat, ...melange(rng, pool.filter(a => a !== cible && a.cat !== cible.cat && a.blason !== cible.blason))].slice(0, 3);
    const choix = melange(rng, [{ a: cible, ok: true }, ...autres.map(a => ({ a, ok: false }))]).map(c => ({ ...c, texte: variante === "nom" ? c.a.nom : c.a.blason }));
    return { type: "reel", niv: 1, variante, cible, choix, indice: memeCat.length >= 3 ? cible.cat : "" };   // la rubrique n'est donnée que si elle n'élimine pas les autres réponses
  }
  const imageReelle = a => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(a.file)}?width=320`;

  /* ---------- les exercices proposés ---------- */
  const EXOS = {
    lire: { titre: "Lire un écu", court: "Le texte de ces armes", desc: "Un écu est dessiné : retrouvez le blasonnement qui le décrit parmi quatre propositions voisines.", niveaux: true, fabrique: (rng, niv) => qLire(rng, niv, false) },
    dessiner: { titre: "Dessiner des armes", court: "L'écu de ce texte", desc: "Un blasonnement est donné : choisissez l'écu qu'il décrit, parmi quatre dessins.", niveaux: true, fabrique: (rng, niv) => qLire(rng, niv, true) },
    regle: { titre: "La règle des émaux", court: "Régulières ou non ?", desc: "Métal sur métal, couleur sur couleur : ces armes respectent-elles la règle de contrariété ?", niveaux: true, fabrique: async (rng, niv) => qRegle(rng, niv) },
    vocab: { titre: "Le vocabulaire", court: "Le bon mot", desc: "Une définition du glossaire, le terme caché : lequel est-ce ?", niveaux: true, fabrique: async (rng, niv) => qVocab(rng, niv) },
    reel: { titre: "Armes réelles", court: "À qui, et que disent-elles ?", desc: "Des armoiries de la page « Blasons réels » : retrouvez leur porteur, ou lequel de quatre blasonnements est le leur.", niveaux: false, fabrique: async rng => qReel(rng) },
    points: { titre: "Les points de l'écu", court: "Dextre, senestre, chef, pointe…", desc: "Un point est marqué sur l'écu : comment le nomme-t-on ? Le piège : on parle du côté du porteur, pas du vôtre.", niveaux: false, fabrique: async rng => qPoints(rng) },
    defi: { titre: "Défi du jour", court: "Six questions, les mêmes pour tous", desc: "Chaque jour, six questions tirées d'après la date : les mêmes pour tout le monde. À partager, si l'on veut.", niveaux: false },
  };
  const NIV_AIDE = { 1: "Un meuble, une pièce : les armes les plus simples.", 2: "Partitions, bordures, pièces chargées, meubles plus rares.", 3: "Écartelé, sur le tout, semés, deux meubles, bords décorés." };
  const NIV_NOM = { 1: "Facile", 2: "Moyen", 3: "Difficile" };
  const DEFI = [["lire", 1], ["lire", 2], ["dessiner", 2], ["regle", 2], ["vocab", 2], ["points", 1]];

  /* ---------- la mémoire du navigateur (facultative) ---------- */
  const CLE = "armorial.exercices.v1";
  let MEM = { niv: "1", stats: {}, defi: null };
  try { const m = JSON.parse(localStorage.getItem(CLE) || "null"); if (m && typeof m === "object") MEM = { ...MEM, ...m }; } catch (e) { /* navigation privée : on joue sans mémoire */ }
  const sauve = () => { try { localStorage.setItem(CLE, JSON.stringify(MEM)); } catch (e) { /* idem */ } };
  const stat = id => (MEM.stats[id] = MEM.stats[id] || { n: 0, ok: 0, serie: 0 });

  /* ---------- le déroulement ---------- */
  const el = { menu: $("#ex-menu"), cartes: $("#ex-cartes"), arene: $("#ex-arene"), q: $("#ex-q"), fb: $("#ex-fb"), suite: $("#ex-suite"), titre: $("#ex-titre"), score: $("#ex-score") };
  let J = null;                                        // la partie en cours : { id, niv, n, ok, serie, serieMax, defi, q, repondu, marques }

  const aujourdhui = () => { const d = new Date(); return { cle: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, txt: `${d.getDate() === 1 ? "1ᵉʳ" : d.getDate()} ${mois[d.getMonth()]} ${d.getFullYear()}` }; };

  async function nouvelleQuestion() {
    el.suite.hidden = true; el.fb.innerHTML = ""; el.fb.className = "ex-fb";
    el.q.innerHTML = `<p class="ex-chargement">Les écus se préparent…</p>`;
    let id = J.id, niv = J.niv, rng = Math.random;
    if (J.defi) { [id, niv] = DEFI[J.n]; rng = mulberry(graine(`${J.defi.cle}:${J.n}`)); }
    const q = await EXOS[id].fabrique(rng, niv);
    J.q = q; J.repondu = false;
    await affiche(q);
    majBarre();
    el.q.focus({ preventScroll: true });
  }
  const contenu = (c, i) => `<span class="k" aria-hidden="true">${LETTRES[i]}</span>`;
  async function affiche(q) {
    let h = "";
    if (q.type === "lire") {
      h = `<p class="ex-ask">Quel blasonnement décrit cet écu ?</p><div class="ex-ecu">${await ecu(q.St, "Écu à décrire")}</div>
        <div class="ex-choix" role="group" aria-label="Propositions">${q.choix.map((c, i) => `<button type="button" class="ex-c" data-i="${i}">${contenu(c, i)}<span class="t">${esc(c.texte)}</span></button>`).join("")}</div>`;
    } else if (q.type === "dessiner") {
      const svgs = await Promise.all(q.choix.map((c, i) => ecu(c.St, `Écu ${LETTRES[i]}`)));
      h = `<p class="ex-ask">Quel écu correspond à ce blasonnement ?</p><p class="ex-blz">«&nbsp;${esc(q.texte)}&nbsp;»</p>
        <div class="ex-ecus" role="group" aria-label="Propositions">${q.choix.map((c, i) => `<button type="button" class="ex-c ex-cecu" data-i="${i}" aria-label="Écu ${LETTRES[i]}">${contenu(c, i)}${svgs[i]}<span class="ex-sous" hidden></span></button>`).join("")}</div>`;
    } else if (q.type === "regle") {
      h = `<p class="ex-ask">Ces armes respectent-elles la règle des émaux ?</p><div class="ex-ecu">${await ecu(q.St, "Armes à juger")}</div><p class="ex-blz">«&nbsp;${esc(q.texte)}&nbsp;»</p>
        <div class="ex-choix ex-deux" role="group" aria-label="Réponses"><button type="button" class="ex-c" data-i="0"><span class="k" aria-hidden="true">1</span><span class="t">Oui, elles la respectent</span></button><button type="button" class="ex-c" data-i="1"><span class="k" aria-hidden="true">2</span><span class="t">Non, elles l'enfreignent</span></button></div>`;
    } else if (q.type === "vocab") {
      h = `<p class="ex-ask">De quel terme du blason s'agit-il ?</p><blockquote class="ex-def">${esc(q.def)}</blockquote>
        <div class="ex-choix ex-courts" role="group" aria-label="Propositions">${q.choix.map((c, i) => `<button type="button" class="ex-c" data-i="${i}">${contenu(c, i)}<span class="t">${esc(c.texte)}</span></button>`).join("")}</div>`;
    } else if (q.type === "reel") {
      const qst = q.variante === "nom" ? "À qui sont ces armes ?" : "Quel blasonnement décrit ces armes ?";
      h = `<p class="ex-ask">${qst}</p><div class="ex-ecu ex-reel"><img src="${esc(imageReelle(q.cible))}" alt="Armoiries à identifier" width="240" referrerpolicy="no-referrer"></div>${q.indice ? `<p class="ex-indice">Rubrique de la galerie : ${esc(q.indice)}</p>` : ""}
        <div class="ex-choix${q.variante === "nom" ? " ex-courts" : ""}" role="group" aria-label="Propositions">${q.choix.map((c, i) => `<button type="button" class="ex-c" data-i="${i}">${contenu(c, i)}<span class="t">${esc(c.texte)}</span></button>`).join("")}</div>`;
    } else if (q.type === "points") {
      h = `<p class="ex-ask">Comment nomme-t-on le point marqué sur l'écu ?</p><div class="ex-ecu">${svgPoints(q.r, q.c)}</div>
        <div class="ex-choix ex-courts" role="group" aria-label="Propositions">${q.choix.map((c, i) => `<button type="button" class="ex-c" data-i="${i}">${contenu(c, i)}<span class="t">${esc(c.texte)}</span></button>`).join("")}</div>`;
    }
    el.q.innerHTML = h;
  }

  function reponds(i) {
    if (!J || J.repondu || !J.q) return;
    const q = J.q, boutons = [...el.q.querySelectorAll(".ex-c")];
    const juste = q.type === "regle" ? (i === 0) === (q.fautes.length === 0) : q.choix[i].ok;
    J.repondu = true; J.n++; if (juste) { J.ok++; J.serie++; J.serieMax = Math.max(J.serieMax, J.serie); } else J.serie = 0;
    if (J.defi) J.marques.push(juste);
    const s = stat(J.defi ? "defi" : J.id); s.n++; if (juste) { s.ok++; s.serie++; s.serieMax = Math.max(s.serieMax || 0, s.serie); } else s.serie = 0; sauve();
    boutons.forEach((b, k) => {
      b.disabled = true;
      const bon = q.type === "regle" ? (k === 0) === (q.fautes.length === 0) : q.choix[k].ok;
      b.classList.add(bon ? "ok" : k === i ? "ko" : "dim");
      if (k === i) b.setAttribute("aria-pressed", "true");
    });
    if (q.type === "dessiner") boutons.forEach((b, k) => { const sous = $(".ex-sous", b); sous.hidden = false; sous.innerHTML = q.choix[k].ok ? esc(q.choix[k].texte) : difference(q.texte, q.choix[k].texte); });
    if (q.type === "lire") boutons.forEach((b, k) => { if (!q.choix[k].ok) $(".t", b).innerHTML = difference(q.texte, q.choix[k].texte); });
    el.fb.className = "ex-fb " + (juste ? "ok" : "ko");
    el.fb.innerHTML = `<p class="ex-verdict">${juste ? "Bien vu." : "Pas tout à fait."}</p>` + explication(q, juste, i);
    el.suite.hidden = false;
    el.suite.textContent = J.defi && J.n >= DEFI.length ? "Voir mon résultat →" : "Question suivante →";
    majBarre();
    el.suite.focus({ preventScroll: true });
    el.fb.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth" });
  }

  /* les figures empruntées à Commons dans les écus montrés : leurs crédits, comme sous chaque écu de l'Atelier */
  function credits(sts) {
    const vus = new Map(); sts.forEach(St => creditsOf(St).forEach(c => vus.set(c.commons, c)));
    return vus.size ? `<p class="ex-credits">${creditsHtml([...vus.values()])}</p>` : "";
  }
  function explication(q, juste, choisi) {
    let h = "";
    const retenir = texte => { const ts = termesDe(texte); return ts.length ? `<p class="ex-retenir"><span>À retenir</span> ${ts.map(lienTerme).join(" · ")}</p>` : ""; };
    const guide = St => { const d = !St.q && !St.ab && decoupe(St.A[0]); return d ? `<dl class="ex-guide">${d.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : ""; };
    if (q.type === "lire" || q.type === "dessiner") {
      h += `<p>${q.type === "lire" ? "Le blasonnement de cet écu" : "Le blasonnement"} : <i>«&nbsp;${esc(q.texte)}&nbsp;»</i>.</p>`;
      h += guide(q.St);
      if (!juste) h += `<p class="ex-aide">Les mots qui diffèrent de la bonne réponse sont soulignés dans chaque proposition.</p>`;
      h += retenir(q.texte) + `<p class="ex-lien">${lienAtelier(q.St)}</p>` + credits(q.type === "lire" ? [q.St] : q.choix.map(c => c.St));
    } else if (q.type === "regle") {
      const par = q.paires.map(p => `${cap(p.quoi)} ${de(p.fig)} (${classe(p.fig) === "Métal" ? "un métal" : "une couleur"}) sur ${p.lieu} ${de(p.sur)} (${classe(p.sur) === "Métal" ? "un métal" : "une couleur"})`);
      if (q.fautes.length) h += `<p>${q.fautes.map(f => esc(f.replace(/ : ([A-ZÉ])/g, (m, c) => " : " + c.toLowerCase()))).join(" ")} La règle interdit de poser métal sur métal ou couleur sur couleur : la figure se lit mal à distance.</p><p class="ex-aide">Si un blason réel enfreint la règle de propos délibéré, on dit de ses armes qu'elles sont « à enquérir » — l'exemple classique est le royaume de Jérusalem : d'argent à la croix potencée d'or.</p>`;
      else h += `<p>${esc(par.join(" ; "))} : l'un se détache de l'autre, la règle est respectée.</p>`;
      h += `<p class="ex-lien"><a href="index.html#emaux">Relire le chapitre « Les émaux »</a> · ${lienAtelier(q.St)}</p>` + credits([q.St]);
    } else if (q.type === "vocab") {
      const e = q.cible, lien = e.gloss ? ` · <a href="index.html#${termeId(e.terme, DATA.glossaire)}">dans le glossaire</a>` : "";
      h += `<p><b>${esc(e.terme)}</b> : ${esc(e.def)}${lien}</p>`;
    } else if (q.type === "reel") {
      const a = q.cible, lis = (() => { try { return lire(a.blason).ok; } catch (e) { return false; } })();
      h += `<p><b>${esc(a.nom)}</b>${a.porteur ? ` — ${esc(a.porteur)}` : ""}.</p><p>Blasonnement : <i>«&nbsp;${esc(a.blason)}&nbsp;»</i>.</p>`;
      h += retenir(a.blason) + `<p class="ex-lien"><a href="blasons.html#${sluge(a.nom)}">Voir la carte dans « Blasons réels »</a>${lis ? ` · <a href="atelier.html#lire=${encodeURIComponent(a.blason)}">Redessiner dans l'Atelier</a>` : ""}</p>`;
      h += `<p class="ex-credits">Illustration : <a href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(a.file)}" target="_blank" rel="noopener">« ${esc(a.file)} »</a> — ${esc(a.auteur)}, <a href="${esc(a.licurl)}" target="_blank" rel="noopener">${esc(a.lic)}</a>, via Wikimedia Commons.</p>`;
    } else if (q.type === "points") {
      h += `<p>Le point marqué est ${POINTS_AU[q.r][q.c]} pour qui regarde l'écu : c'est le <b>${esc(q.nom.toLowerCase())}</b>.</p>`;
      if (q.c !== 1) h += `<p class="ex-aide">${q.c === 0 ? "Dextre, c'est la droite du porteur de l'écu : elle se trouve donc à gauche pour qui le regarde." : "Senestre, c'est la gauche du porteur de l'écu : elle se trouve donc à droite pour qui le regarde."} C'est l'erreur la plus commune du débutant.</p>`;
      h += `<p class="ex-lien"><a href="index.html#ecu">Relire le chapitre « L'écu »</a></p>`;
    }
    return h;
  }

  function majBarre() {
    if (!J) return;
    const nom = J.defi ? `Défi du ${J.defi.txt}` : `${EXOS[J.id].titre}${EXOS[J.id].niveaux ? " · " + NIV_NOM[J.niv] : ""}`;
    el.titre.textContent = nom;
    if (J.defi) el.score.innerHTML = `Question <b>${Math.min(J.n + (J.repondu ? 0 : 1), DEFI.length)}</b> sur ${DEFI.length} · <b>${J.ok}</b> juste${J.ok > 1 ? "s" : ""}`;
    else el.score.innerHTML = `<b>${J.ok}</b> juste${J.ok > 1 ? "s" : ""} sur ${J.n} · série <b>${J.serie}</b>${J.serieMax > 2 ? ` (meilleure : ${J.serieMax})` : ""}`;
  }

  function resultatDefi() {
    el.suite.hidden = true; el.fb.className = "ex-fb"; el.fb.innerHTML = "";
    const marques = J.marques.map(b => (b ? "🟩" : "🟥")).join(""), ok = J.ok;
    MEM.defi = { date: J.defi.cle, marques: J.marques.map(b => (b ? 1 : 0)).join("") }; sauve();
    const texte = `L'Armorial · S'exercer — défi du ${J.defi.txt}\n${marques}  ${ok}/${DEFI.length}\nhttps://i-envy-hades.github.io/armorial/exercices.html#defi`;
    const mot = ok === DEFI.length ? "Sans faute : un héraut n'aurait pas mieux lu." : ok >= 4 ? "Une belle lecture." : ok >= 2 ? "Le blason s'apprend : voyez les chapitres cités dans les réponses." : "Le début d'un long apprentissage — revenez demain.";
    el.q.innerHTML = `<div class="ex-final"><p class="ex-ask">Défi du ${esc(J.defi.txt)}</p><p class="ex-grille" aria-label="${ok} bonnes réponses sur ${DEFI.length}">${marques}</p><p class="ex-note-final"><b>${ok}</b> sur ${DEFI.length}. ${mot}</p>
      <div class="acts"><button type="button" class="main" id="ex-copie">Copier le résultat</button><button type="button" id="ex-menu-b">Autres exercices</button></div><p class="ex-aide">Demain, six autres questions. Le résultat est gardé dans ce navigateur, nulle part ailleurs.</p></div>`;
    $("#ex-copie").addEventListener("click", async e => { try { await navigator.clipboard.writeText(texte); e.target.textContent = "Copié"; } catch (x) { e.target.textContent = "Copiez : " + marques; } });
    $("#ex-menu-b").addEventListener("click", versMenu);
    majBarre();
  }

  async function demarre(id) {
    const niv = +MEM.niv || 1;
    J = { id, niv, n: 0, ok: 0, serie: 0, serieMax: 0, defi: id === "defi" ? aujourdhui() : null, marques: [], q: null, repondu: false };
    el.menu.hidden = true; el.arene.hidden = false;
    history.replaceState(null, "", "#" + id);
    scrollTo({ top: Math.max(0, el.arene.getBoundingClientRect().top + scrollY - 70), behavior: "auto" });
    await nouvelleQuestion();
  }
  function versMenu() {
    J = null; el.arene.hidden = true; el.menu.hidden = false; history.replaceState(null, "", location.pathname);
    cartes();
  }
  el.suite.addEventListener("click", () => { if (J.defi && J.n >= DEFI.length) resultatDefi(); else nouvelleQuestion(); });
  $("#ex-retour").addEventListener("click", versMenu);
  el.q.addEventListener("click", e => { const b = e.target.closest(".ex-c"); if (b) reponds(+b.dataset.i); });
  document.addEventListener("keydown", e => {
    if (!J || e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (!J.repondu && J.q) { const i = "1234".includes(k) && k ? +k - 1 : "abcd".indexOf(k); if (i >= 0 && i < el.q.querySelectorAll(".ex-c").length) { e.preventDefault(); reponds(i); } }
    else if (J.repondu && (k === "enter" || k === " ") && !el.suite.hidden && document.activeElement !== el.suite) { e.preventDefault(); el.suite.click(); }
  });

  /* ---------- le menu : un écu d'exemple sur chaque carte ---------- */
  const EXEMPLES = {
    lire: { t1: "Azur", m: "etoile", nb: "3", tm: "Or", ta: "Or" },
    dessiner: { t1: "Gueules", p: "fasce", tp: "Argent", m: "lion", nb: "1", pos: "sur", tm: "Sable", ta: "Sable" },
    regle: { t1: "Argent", m: "croix-potencee", nb: "1", tm: "Or", ta: "Or" },
    vocab: { t1: "Argent", p: "chevron", tp: "Gueules", m: "rose", nb: "3", tm: "Or", ta: "Or" },
    defi: { f: "part", part: "parti", t1: "Azur", t2: "Gueules", m: "fleurdelis", nb: "1", tm: "Or", ta: "Or" },
  };
  async function cartes() {
    const jour = aujourdhui();
    const fait = MEM.defi && MEM.defi.date === jour.cle ? MEM.defi.marques : null;
    const html = [];
    for (const [id, x] of Object.entries(EXOS)) {
      let image;
      if (id === "points") image = svgPoints(0, 0, true);
      else if (id === "reel") image = `<svg class="ecu" viewBox="0 0 200 252" aria-hidden="true"><path d="${SHIELD_D}" fill="#f3eee0" stroke="#1a1712" stroke-width="2.4"/><text x="100" y="150" text-anchor="middle" font-family="Marcellus,serif" font-size="110" fill="#8e1b18" opacity=".85">?</text></svg>`;
      else { const St = fresh(); St.A[0] = { ...ADEF, ...EXEMPLES[id] }; normalizeAll(St); image = await ecu(St, null); }
      const s = MEM.stats[id === "defi" ? "defi" : id];
      const pied = id === "defi" ? (fait ? `<span class="ex-fait">Fait aujourd'hui : ${[...fait].map(b => (b === "1" ? "🟩" : "🟥")).join("")}</span>` : `<span class="ex-fait">Du ${esc(jour.txt)}</span>`)
        : s && s.n ? `<span class="ex-fait">${s.ok} juste${s.ok > 1 ? "s" : ""} sur ${s.n}${s.serieMax > 1 ? ` · meilleure série ${s.serieMax}` : ""}</span>` : `<span class="ex-fait">Pas encore essayé</span>`;
      html.push(`<button type="button" class="ex-carte" data-id="${id}"><span class="ex-img">${image}</span><span class="ex-txt"><span class="ex-nom">${esc(x.titre)}</span><span class="ex-court">${esc(x.court)}</span><span class="ex-desc">${esc(x.desc)}</span>${pied}</span></button>`);
    }
    el.cartes.innerHTML = html.join("");
    const niveau = $(`#ex-niv input[value="${MEM.niv}"]`) || $(`#ex-niv input[value="1"]`);
    niveau.checked = true; $("#ex-niv-aide").textContent = NIV_AIDE[niveau.value];
  }
  $("#ex-niv").addEventListener("change", e => { MEM.niv = e.target.value; $("#ex-niv-aide").textContent = NIV_AIDE[MEM.niv]; sauve(); });
  el.cartes.addEventListener("click", e => { const b = e.target.closest(".ex-carte"); if (b) demarre(b.dataset.id); });

  /* ---------- démarrage ---------- */
  try {
    await chargerLecteur();                          // data/data.json et data/atelier.json (assets/lecture.js)
  } catch (e) {
    $("#ex-chargement").textContent = `Les données n'ont pas pu être chargées (${e.message}). Cette page doit être servie par HTTP, et non ouverte depuis le disque.`;
    return;
  }
  try { const r = await fetch("data/blasons.json"); if (r.ok) BL = await r.json(); } catch (e) { /* sans la galerie, l'exercice « Armes réelles » manque, le reste marche */ }
  if (!BL.length) delete EXOS.reel;
  $("#gdefs").innerHTML = globalDefs();
  /* pour les tests (tools/smoke_test.py) : une question de plus, à graine donnée, sans rien afficher */
  window.Exercices = { ids: Object.keys(EXOS), fabrique: (id, niv, seed) => EXOS[id].fabrique(mulberry(seed), niv), defi: DEFI };
  await cartes();
  $("#ex-chargement").hidden = true; el.menu.hidden = false;
  const dem = location.hash.replace("#", "");
  if (EXOS[dem]) demarre(dem);
  addEventListener("hashchange", () => { const h = location.hash.replace("#", ""); if (EXOS[h] && (!J || J.id !== h)) demarre(h); else if (!h && J) versMenu(); });
})();
