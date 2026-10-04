/* L'ARMORIAL — le lecteur de blasonnement : du texte à l'écu.

   C'est l'inverse de blazonAll() (assets/blasonnement.js) : « D'azur à trois fleurs de lis d'or » donne la composition
   que l'Atelier écrirait ainsi. Règle d'or : ce qui n'est pas compris est signalé, jamais deviné. Un texte ne devient
   un écu que s'il est lu en entier, mot à mot ; sinon on rend ce qui bloque, avec sa place dans le texte, et rien n'est dessiné.

   lire(texte) → { ok, etat, notes, erreurs, exact, reecrit }
     ok       vrai si tout le texte est compris et que l'Atelier sait le dessiner
     etat     { q, ab, A } : les armes lues, comme l'Atelier les tient (A[0..3] : quartiers, A[4] : écusson en abîme)
     notes    ce qui est lu avec une réserve (commentaire ignoré, disposition que le texte ne dit pas, attribut de l'aigle…)
     erreurs  [{ de, a, msg }] : ce qui bloque, avec sa place dans le texte
     exact    vrai si l'Atelier réécrit le texte à la lettre (ponctuation mise à part) ; sinon `reecrit` donne sa version
   Lit les globaux DATA et ATL (voir chargerLecteur() pour les pages qui n'ont pas l'Atelier) et blasonnement.js.

   Ce qu'on accepte en plus de ce que l'Atelier écrit : majuscules, accents et virgules libres, « plain » pour « plein »,
   « lys » pour « lis », un commentaire entre parenthèses (ignoré, mais signalé), « contourné » avant ou après l'émail,
   l'attribut sans émail (« au lion d'or » : l'émail du corps) ou « du même », et les noms de la liste `alias` d'atelier.json. */

/* ---------- jetons ---------- */
const LETTRES = "A-Za-zÀ-ÖØ-öø-ÿŒœÆæ";
const ELISIONS = { d: "de", l: "le", qu: "que" };
const SYNONYMES = { plain: "plein", lys: "lis" };
const plie = s => String(s).toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
/* mots (w : forme sans accent ni majuscule ; « d' » devient « de »), nombres, ponctuation, et le reste (k "?") ; guillemets, point et trait d'union sautés */
function decouper(texte) {
  const re = new RegExp(`([${LETTRES}]+)['’]|([${LETTRES}]+)|(\\d+)|([,;:()])|([«»"“”.\\-–—])|(\\S)`, "g"), toks = [];
  for (let m; (m = re.exec(texte));) {
    const de = m.index, a = de + m[0].length;                 // r : le mot tel qu'il est écrit
    if (m[1]) { const w = plie(m[1]); toks.push({ k: "w", w: ELISIONS[w] || w, de, a, r: m[0] }); }
    else if (m[2]) { const w = plie(m[2]); toks.push({ k: "w", w: SYNONYMES[w] || w, de, a, r: m[0] }); }
    else if (m[3]) toks.push({ k: "n", w: m[3], de, a, r: m[0] });
    else if (m[4]) toks.push({ k: "p", w: m[4], de, a, r: m[0] });
    else if (m[6]) toks.push({ k: "?", w: m[6], de, a, r: m[0] });
  }
  return toks;
}
/* les parenthèses sont des commentaires (« (France ancien) ») : on les met de côté */
function sansCommentaires(texte, brut) {
  const toks = [], comm = [], erreurs = [];
  let prof = 0, debut = 0;
  for (const t of brut) {
    if (t.k === "p" && t.w === "(") { if (!prof++) debut = t.de; }
    else if (t.k === "p" && t.w === ")") {
      if (!prof) erreurs.push({ de: t.de, a: t.a, msg: "Parenthèse fermante sans parenthèse ouvrante." });
      else if (!--prof) comm.push(texte.slice(debut, t.a));
    } else if (!prof) toks.push(t);
  }
  if (prof) erreurs.push({ de: debut, a: texte.length, msg: "Parenthèse jamais fermée." });
  return { toks, comm, erreurs };
}

/* ---------- le lexique : tout ce que l'Atelier sait dire, tiré de ses données ---------- */
let LEX = null;
const cles = s => decouper(s).map(t => t.w);
const quatre = ph => [...new Set([["m", 0], ["f", 0], ["m", 1], ["f", 1]].map(([g, pl]) => agree(ph, g, pl)))];      // masculin, féminin, pluriels
/* table de phrases : première clé → [{ k: clés, val }], les plus longues d'abord */
function table(paires) {
  const T = new Map();
  for (const [phrase, val] of paires) { const k = cles(phrase); T.set(k[0], [...(T.get(k[0]) || []), { k, val }]); }
  for (const l of T.values()) l.sort((a, b) => b.k.length - a.k.length);
  return T;
}
function lexique() {
  if (LEX && LEX.d === DATA && LEX.a === ATL) return LEX;
  const L = LEX = { d: DATA, a: ATL, vocab: new Set(["a", "au", "aux", "le", "la", "de", "du", "un", "une", "et", "en", "sur", "tout", "brochant", "plein", "seme", "meme", "pieces", "vert"]) };
  L.emaux = new Map(Object.entries(MOT).map(([k, v]) => [plie(v), k])); L.emaux.set("vert", "Sinople");
  L.compte = new Map(NB.map((w, i) => [w, i]).filter(([w]) => w)); L.compte.set("une", 1);
  const noms = [];
  for (const m of ATL.meubles) {
    if (m.kind === "roundel") continue;
    for (const [s, p] of [[m.sing, m.plur], ...(m.alias || [])]) noms.push([s, { kind: m.kind, nom: s }], [p, { kind: m.kind }]);
  }
  for (const [w, mot] of [["besant", "besant"], ["besants", "besant"], ["tourteau", "tourteau"], ["tourteaux", "tourteau"]]) noms.push([w, { kind: "roundel", mot }]);
  L.noms = table(noms);
  /* noms de plusieurs mots, par leur premier mot : « ours » → « ours passant » */
  L.debuts = new Map();
  for (const [s, v] of noms) if (v.nom && cles(s).length > 1) { const k = cles(s)[0]; L.debuts.set(k, [...(L.debuts.get(k) || []), s]); }
  L.semeAdj = table([...ATL.meubles.filter(m => m.semeAdj).map(m => [m.semeAdj, { kind: m.kind }]), ["besanté", { kind: "roundel", mot: "besant" }], ["tourteauté", { kind: "roundel", mot: "tourteau" }]]);
  L.pieces = table(Object.keys(PIECES).flatMap(p => [[p, { p }], ...(p === "croix" ? [] : [[p + "s", { p, plur: true }]])]));
  L.contours = table(Object.entries(CONTOUR_NOM).flatMap(([k, v]) => quatre(v).map(f => [f, k])));
  L.parts = table(DATA.partitions.map(p => [p.nom, { kind: p.kind, tierce: p.kind.startsWith("tierce") }]));
  L.raye = table([["fascé", "barry"], ["palé", "paly"], ["bandé", "bendy"], ["barré", "bendysin"]]);
  L.accent = {};
  for (const m of ATL.meubles) if (m.accent && m.accentMot) L.accent[m.kind] = table((m.accentFixe ? [m.accentMot] : quatre(m.accentMot)).map(f => [f, true]));
  L.dispos = {};
  /* « posés en pal » = « rangés en pal » = « en pal » : le verbe ne change rien au dessin */
  const variantes = ph => { const m = ph.match(/^(posé|rangé) (en .+)$/); return m ? [ph, "posé " + m[2], "rangé " + m[2], m[2]] : [ph]; };
  for (const [n, ds] of Object.entries(PLEIN)) L.dispos[n] = table(ds.filter(d => d.ph.trim()).flatMap(d => [...new Set(variantes(d.ph.trim()).flatMap(quatre))].map(f => [f, d.id])));
  L.ctr = table(quatre("contourné").map(f => [f, true]));
  L.charge = table(quatre("chargé").map(f => [f, true]));
  L.verbe = table(["accompagné", "cantonné", "accosté"].flatMap(w => quatre(w).map(f => [f, true])));
  L.fasceDispo = table([", l'un en chef et l'autre en pointe", ", l'une en chef et l'autre en pointe", ", trois en chef et trois en pointe"].map(f => [f, true]));
  for (const T of [L.noms, L.semeAdj, L.pieces, L.contours, L.parts, L.raye, ...Object.values(L.accent), ...Object.values(L.dispos), L.ctr, L.charge, L.verbe, L.fasceDispo])
    for (const l of T.values()) for (const e of l) for (const w of e.k) if (/^[a-z]/.test(w)) L.vocab.add(w);
  for (const w of [...L.emaux.keys(), ...L.compte.keys()]) L.vocab.add(w);
  return L;
}
/* pour les pages qui n'ont pas l'Atelier (galeries) : va chercher les données dont le lecteur a besoin */
async function chargerLecteur() {
  if (DATA && ATL) return;
  const [a, b] = await Promise.all([fetch("data/data.json"), fetch("data/atelier.json")]);
  if (!a.ok || !b.ok) throw new Error(`HTTP ${a.ok ? b.status : a.status}`);
  DATA = await a.json(); ATL = await b.json();
}

/* galeries (Blasons réels, Personnages) : quelles armoiries l'Atelier sait-il lire en entier ? Un Set (vide si les données manquent) */
function armesLisibles(liste) {
  try { return new Set(liste.filter(a => a.blason && lire(a.blason).ok)); } catch (e) { return new Set(); }
}
/* le bouton qui ouvre l'Atelier sur ces armes : c'est lui qui relit le blasonnement (adresse « #lire=… ») et dit ses réserves */
const lienAtelier = a => `<p class="redo"><a href="atelier.html#lire=${encodeURIComponent(a.blason)}">Redessiner dans l'Atelier</a></p>`;

/* ---------- l'analyse d'un seul blason (champ, pièce, meubles) : descente récursive sur les jetons ---------- */
/* P = { toks, fin, far, errs, notes } ; chaque pX(P, i) rend l'élément lu et sa fin (i), ou null. `far` retient l'endroit le plus loin atteint
   et ce qu'on y attendait : c'est lui qui dit à l'utilisateur où ça coince. */
const cle = (P, i) => (i < P.fin && P.toks[i] ? P.toks[i].w : null);
function rate(P, i, quoi) {
  if (i > P.far.i) P.far = { i, att: new Set() };
  if (i === P.far.i) P.far.att.add(quoi);
  return null;
}
function suites(T, P, i) {
  const t = i < P.fin && P.toks[i];
  if (!t) return [];
  return (T.get(t.w) || []).filter(e => i + e.k.length <= P.fin && e.k.every((c, j) => P.toks[i + j].w === c)).map(e => ({ n: e.k.length, val: e.val }));
}
const bornes = (P, it, i0) => Object.assign(it, { de: P.toks[i0].de, fin: P.toks[it.i - 1].a });
const erreur = (P, de, a, msg) => { P.errs.push({ de, a, msg }); return null; };

function pEmail(P, i, ref) {                                 // « d'azur » · « de gueules » · « du même » (ref : l'émail déjà dit)
  const t = cle(P, i) === "de" && LEX.emaux.get(cle(P, i + 1));
  if (t) return { t, i: i + 2 };
  if (ref && (cle(P, i) === "du" || cle(P, i) === "de") && cle(P, i + 1) === "meme") return { t: ref, i: i + 2 };
  return rate(P, i, "un émail (« d'azur », « de gueules »…)");
}
/* [,] « armé et lampassé d'azur » · « … du même » : { ta, i } ; ta null s'il n'y en a pas ; null si l'attribut est dit sans émail */
function pAccent(P, i, m, tm) {
  const T = LEX.accent[m.kind];
  if (!T) return { ta: null, i };
  const j = cle(P, i) === "," ? i + 1 : i, s = suites(T, P, j)[0];
  if (!s) return { ta: null, i };
  const k = j + s.n;
  if ((cle(P, k) === "du" || cle(P, k) === "de") && cle(P, k + 1) === "meme") return { ta: tm, i: k + 2 };
  const t = pEmail(P, k);
  return t ? { ta: t.t, i: t.i } : null;
}
/* NOM [contourné] ÉMAIL [contourné] [attribut] */
function pCorps(P, i, ref) {
  for (const { n, val } of suites(LEX.noms, P, i)) {
    const m = meuble(val.kind);
    let j = i + n, ct = false;
    const c1 = suites(LEX.ctr, P, j)[0];
    if (c1) { ct = true; j += c1.n; }
    const t = pEmail(P, j, ref);
    if (!t) {
      if (cle(P, j) === "a" && LEX.compte.has(cle(P, j + 1)) && cle(P, j + 2) === "rais")
        return erreur(P, P.toks[j].de, P.toks[j + 2].a, `« ${cle(P, j + 1) === "un" ? "à un" : "à " + cle(P, j + 1)} rais » : l'Atelier ne dessine qu'un modèle ${voy(m.sing) ? "d'" : "de "}${m.sing}${m.kind === "etoile" ? " (à cinq rais)" : ""}.`);
      continue;
    }
    j = t.i;
    const c2 = !ct && suites(LEX.ctr, P, j)[0];
    if (c2) { ct = true; j += c2.n; }
    const ac = pAccent(P, j, m, t.t);
    if (!ac) continue;
    return { m, tm: t.t, ta: ac.ta, ct, mot: val.mot, i: ac.i };
  }
  const k = cle(P, i), noms = k && !suites(LEX.noms, P, i).length && LEX.debuts.get(k);
  /* une piste, pas une erreur : elle ne parle que si la lecture ne va pas plus loin ailleurs (« la croix » est d'abord une pièce) */
  if (noms && !(P.hint && P.hint.i >= i)) P.hint = { i, de: P.toks[i].de, a: P.toks[i].a, msg: `« ${P.toks[i].r} » seul n'est pas un meuble de l'Atelier : il connaît ${noms.slice(0, 4).map(n => `« ${n} »`).join(", ")}${noms.length > 4 ? ` et ${noms.length - 4} autre${noms.length > 5 ? "s" : ""}` : ""}.` };
  return rate(P, i, "un meuble");
}
/* disposition que le texte dit après des meubles de nombre n : « posés en pal », « rangées en chef », « posées 3, 2 et 1 »… */
function pDispo(P, i, n) {
  const T = LEX.dispos[n], j = cle(P, i) === "," ? i + 1 : i, s = T && suites(T, P, j)[0];
  return s ? { d: s.val, dit: true, i: j + s.n } : { d: "", dit: false, i };
}
function pBrochant(P, i) {                                   // [,] « brochant sur le tout » → fin, ou 0
  const j = cle(P, i) === "," ? i + 1 : i;
  return cle(P, j) === "brochant" && cle(P, j + 1) === "sur" && cle(P, j + 2) === "le" && cle(P, j + 3) === "tout" ? j + 4 : 0;
}
/* après « chargé » ou « accompagné » : « de trois étoiles d'or » · « d'un lion d'or armé et lampassé d'azur » */
function pObjet(P, i, ref) {
  if (cle(P, i) !== "de") return rate(P, i, "« de »");
  const n = LEX.compte.get(cle(P, i + 1));
  if (!n) return rate(P, i + 1, "un nombre (« un », « trois »…)");
  const c = pCorps(P, i + 2, ref);
  if (!c) return null;
  const d = pDispo(P, c.i, n);
  return bornes(P, { n, ...c, d: d.d, dit: d.dit, i: d.i }, i);
}
/* « à la fleur de lis d'or » · « au lion d'or » · « à trois étoiles d'or posées en pal » [brochant sur le tout] */
function pGroupe(P, i) {
  const k = cle(P, i), k1 = cle(P, i + 1);
  let j, n;
  if (k === "au") { j = i + 1; n = 1; }
  else if (k === "a" && (k1 === "le" || k1 === "la")) { j = i + 2; n = 1; }
  else if (k === "a" && LEX.compte.has(k1)) { j = i + 2; n = LEX.compte.get(k1); }
  else return rate(P, k === "a" ? i + 1 : i, k === "a" ? "un article (« à la », « au ») ou un nombre (« à trois »)" : "« à » ou « au »");
  const pl = suites(LEX.pieces, P, j)[0];
  if (pl && pl.val.plur) return erreur(P, P.toks[i].de, P.toks[j + pl.n - 1].a, `Plusieurs ${pl.val.p}s : l'Atelier ne les lit que comme le champ, de deux à quatre, juste après son émail (« D'or à trois ${pl.val.p}s de gueules »)${{ fasce: " ; pour un champ coupé de bandes, écrivez « Fascé d'argent et d'azur de huit pièces »", pal: " ; au-delà, voir « Palé »", bande: " ; au-delà, voir « Bandé »", barre: " ; au-delà, voir « Barré »" }[pl.val.p] || ""}.`);
  const c = pCorps(P, j);
  if (!c) return null;
  const d = pDispo(P, c.i, n);
  let e = d.i;
  const br = pBrochant(P, e);
  if (br) e = br;
  return bornes(P, { t: "groupe", n, ...c, d: d.d, dit: d.dit, broche: !!br, i: e }, i);
}
/* « semé de fleurs de lis d'or » · « billeté d'or » · « besanté d'or » */
function pSeme(P, i) {
  if (cle(P, i) === "seme") {
    if (cle(P, i + 1) !== "de") return rate(P, i + 1, "« de »");
    const c = pCorps(P, i + 2);
    return c && bornes(P, { t: "seme", ...c, seme: true }, i);
  }
  const a = suites(LEX.semeAdj, P, i)[0];
  if (!a) return null;
  const t = pEmail(P, i + a.n);
  return t && bornes(P, { t: "seme", m: meuble(a.val.kind), tm: t.t, ta: null, ct: false, mot: a.val.mot, seme: true, i: t.i }, i);
}
/* « à la fasce ondée d'azur [brochant sur le tout] [chargée de …] [accompagnée de … [et de …]] » */
function pPiece(P, i) {
  const k = cle(P, i);
  const j = k === "au" ? i + 1 : k === "a" && (cle(P, i + 1) === "le" || cle(P, i + 1) === "la") ? i + 2 : -1;
  const ps = j >= 0 && suites(LEX.pieces, P, j)[0];
  if (!ps || ps.val.plur) return undefined;
  let e = j + ps.n, ln = "";
  const cn = suites(LEX.contours, P, e)[0];
  if (cn) { ln = cn.val; e += cn.n; }
  const t = pEmail(P, e);
  if (!t) return null;
  const it = { t: "piece", p: ps.val.p, ln, tp: t.t, broche: false, charge: null, verbe: null, i: t.i };
  for (;;) {
    const q = cle(P, it.i) === "," ? it.i + 1 : it.i, br = pBrochant(P, q);
    if (br) { it.broche = true; it.i = br; continue; }
    const ch = !it.charge && suites(LEX.charge, P, q)[0];
    if (ch) { const o = pObjet(P, q + ch.n, it.tp); if (!o) return null; it.charge = o; it.i = o.i; continue; }
    const vb = !it.verbe && suites(LEX.verbe, P, q)[0];
    if (vb) {
      const o = pObjet(P, q + vb.n, it.tp);
      if (!o) return null;
      let r = o.i, o2 = null;
      const fd = suites(LEX.fasceDispo, P, r)[0];            // « , l'une en chef et l'autre en pointe » : la place est fixée par l'Atelier
      if (fd) r += fd.n;
      if (cle(P, r) === "et" && cle(P, r + 1) === "de") { o2 = pObjet(P, r + 1, o.tm); if (!o2) return null; r = o2.i; }
      it.verbe = { o, o2 }; it.i = r;
      continue;
    }
    break;
  }
  return bornes(P, it, i);
}
/* le champ : « d'azur [plein] » · « parti d'azur et de gueules » · « tiercé en pal de … » · « fascé d'argent et d'azur de huit pièces » */
function pChamp(P) {
  const k = cle(P, 0);
  if (k === "de") {
    const t = pEmail(P, 0);
    if (!t) return null;
    const plein = cle(P, t.i) === "plein";
    /* « d'or à trois pals de gueules » : de deux à quatre pièces rebattues sur le champ = un champ rayé de cinq, sept ou neuf zones (l'émail du champ aux deux bords) */
    if (!plein && cle(P, t.i) === "a" && LEX.compte.has(cle(P, t.i + 1))) {
      const k = LEX.compte.get(cle(P, t.i + 1)), pl = suites(LEX.pieces, P, t.i + 2)[0], RAYE = { pal: "paly", fasce: "barry", bande: "bendy", barre: "bendysin" };
      if (pl && pl.val.plur && RAYE[pl.val.p] && k >= 2 && k <= 4) {
        const t2 = pEmail(P, t.i + 2 + pl.n);
        if (t2) return { ch: { f: "ray", ray: RAYE[pl.val.p], t1: t.t, t2: t2.t, n: String(2 * k + 1) }, i: t2.i };
      }
    }
    return { ch: { f: "plein", t1: t.t }, i: t.i + (plein ? 1 : 0), plein };
  }
  for (const { n, val } of suites(LEX.parts, P, 0)) {
    const t1 = pEmail(P, n);
    if (!t1) continue;
    let i = t1.i, t2, t3;
    if (val.tierce) {
      if (cle(P, i) !== ",") { rate(P, i, "« , » (trois émaux)"); continue; }
      t2 = pEmail(P, i + 1);
      if (!t2 || cle(P, t2.i) !== "et") { if (t2) rate(P, t2.i, "« et » (trois émaux)"); continue; }
      t3 = pEmail(P, t2.i + 1);
      if (!t3) continue;
      return { ch: { f: "part", part: val.kind, t1: t1.t, t2: t2.t, t3: t3.t }, i: t3.i };
    }
    if (cle(P, i) !== "et") { rate(P, i, "« et » (deux émaux)"); continue; }
    t2 = pEmail(P, i + 1);
    if (!t2) continue;
    return { ch: { f: "part", part: val.kind, t1: t1.t, t2: t2.t }, i: t2.i };
  }
  const r = suites(LEX.raye, P, 0)[0];
  if (r) {
    const t1 = pEmail(P, r.n);
    if (!t1) return null;
    if (cle(P, t1.i) !== "et") return rate(P, t1.i, "« et » (deux émaux)");
    const t2 = pEmail(P, t1.i + 1);
    if (!t2) return null;
    let i = t2.i, nn = "6";
    if (cle(P, i) === "de" && LEX.compte.has(cle(P, i + 1)) && cle(P, i + 2) === "pieces") {
      const n = LEX.compte.get(cle(P, i + 1));
      if (n !== 6 && n !== 8) return erreur(P, P.toks[i].de, P.toks[i + 2].a, `« de ${cle(P, i + 1)} pièces » : l'Atelier dessine les champs à six ou à huit pièces.`);
      nn = String(n); i += 3;
    }
    return { ch: { f: "ray", ray: r.val, t1: t1.t, t2: t2.t, n: nn }, i };
  }
  return rate(P, 0, "un champ (« d'azur », « parti d'azur et d'or », « fascé… »…)");
}
/* quand la lecture bute sur un mot qui ressemble à quelque chose que l'Atelier sait dire autrement, on le lui dit */
function aideSuite(P, items, i) {
  const last = items[items.length - 1], w = P.toks[i].w;
  if (!last) return "";
  if (last.t === "piece" && suites(LEX.contours, P, i).length) return `Le bord d'une pièce se dit avant son émail (« à ${aArt(last.p, PIECES[last.p].g).slice(2)}${last.p} ondée d'azur »).`;
  const o = last.t === "piece" ? (last.verbe ? last.verbe.o2 || last.verbe.o : last.charge) : last.t === "acc" ? last.o : last;
  const m = o && o.m;
  if (m && m.accent && m.accentMot) {
    const racines = cles(m.accentMot).filter(c => /^[a-z]/.test(c) && c.length > 3).map(c => c.slice(0, 4));
    if (racines.some(r => w.startsWith(r))) return `Cet attribut se dit en entier dans l'Atelier : « ${m.accentFixe ? m.accentMot : agree(m.accentMot, m.g, o.n > 1)} » (ou rien, si l'émail est celui du meuble).`;
  }
  return "";
}
/* le blason entier : champ, puis meubles et pièce dans l'ordre où l'Atelier les écrit */
function pArmes(P) {
  const ch = pChamp(P);
  if (!ch) return null;
  const items = [];
  let i = ch.i;
  if (ch.plein && i < P.fin) { rate(P, i, "la fin du blasonnement (« plein » se dit d'un champ nu)"); return null; }
  while (i < P.fin) {
    if (cle(P, i) === ",") { i++; continue; }
    const k = cle(P, i);
    let it = null;
    if (k === "seme" || suites(LEX.semeAdj, P, i).length) it = pSeme(P, i);
    else if (k === "a" || k === "au") it = pPiece(P, i) || pGroupe(P, i);              // « la croix d'argent » est une pièce, « la croix de Lorraine » un meuble
    else if (suites(LEX.verbe, P, i).length) {
      const vb = suites(LEX.verbe, P, i)[0], o = pObjet(P, i + vb.n, items.length ? items[items.length - 1].tm : undefined);
      it = o && bornes(P, { t: "acc", o, i: o.i }, i);
    } else if (k === "et" && items.length && items[items.length - 1].t === "groupe") {
      /* « à cinq tourteaux de gueules et, en chef, un tourteau d'azur » : un second meuble, seul, à la place dite */
      let j = i + 1;
      if (cle(P, j) === ",") j++;
      const pl = suites(LEX.dispos[1], P, j)[0];
      if (pl) {
        j += pl.n;
        if (cle(P, j) === ",") j++;
        const c = LEX.compte.get(cle(P, j)) === 1 && pCorps(P, j + 1);
        if (c) { const o = bornes(P, { n: 1, ...c, d: pl.val, dit: true }, i); it = bornes(P, { t: "acc", o, i: c.i }, i); }
      }
      if (!it && !P.errs.length) rate(P, i, "un meuble, une pièce ou la fin du blasonnement");
    } else {
      const aide = aideSuite(P, items, i);
      if (aide) return erreur(P, P.toks[i].de, P.toks[Math.min(i + 2, P.fin - 1)].a, aide);
      rate(P, i, "un meuble (« à trois étoiles… »), une pièce (« à la fasce… ») ou la fin du blasonnement");
    }
    if (!it) return null;
    items.push(it); i = it.i;
  }
  return { ch, items };
}

/* ---------- de l'analyse aux armes de l'Atelier ---------- */
const poseM = (a, o) => Object.assign(a, { m: o.m.kind, nb: o.seme ? "seme" : String(o.n), tm: o.tm, ta: o.ta || o.tm, ct: o.ct ? "1" : "", d: o.d || "" });
const poseM2 = (a, o) => Object.assign(a, { m2: o.m.kind, nb2: String(o.n), tm2: o.tm, ta2: o.ta || o.tm, ct2: o.ct ? "1" : "", d2: o.d || "" });
const posePiece = (a, it) => Object.assign(a, { p: it.p, tp: it.tp, ln: it.ln });
const ORDRE = "L'Atelier lit : le champ, puis soit des meubles (« à trois étoiles d'or »), soit une pièce (« à la fasce d'azur ») avec ses meubles (« chargée de… », « accompagnée de… »)";
/* range les éléments lus dans les armes de l'Atelier — dans les seuls ordres que blazon() écrit, plus « chargée de…, accompagnée de… » */
function assembler(P, r) {
  const a = { ...ADEF, m: "", p: "", m2: "", ...r.ch.ch }, its = r.items, src = {};       // ADEF porte une fleur de lis : le texte seul dit quels meubles il y a
  let k = 0;
  const prend = t => (its[k] && its[k].t === t ? its[k++] : null);
  const sem = prend("seme"), g1 = sem ? null : prend("groupe"), acc = g1 ? prend("acc") : null, g2 = sem ? prend("groupe") : null, pc = prend("piece");
  const mal = (it, msg) => erreur(P, it.de, it.fin, msg);
  if (k < its.length) return mal(its[k], `Cet élément arrive là où l'Atelier ne sait pas le lire. ${ORDRE}.`);
  const br = [g1, g2, pc].find(x => x && x.broche);
  if (br && a.f === "plein") return mal(br, "« brochant sur le tout » n'a de sens, dans l'Atelier, que sur un champ divisé : il ne sait pas poser une pièce par-dessus un meuble.");
  const pose1 = o => { poseM(a, o); src.m = o; }, pose2 = o => { poseM2(a, o); src.m2 = o; }, pose = it => { posePiece(a, it); src.p = it; };
  if (sem) {
    pose1(sem);
    if (g2) pose2(g2);
    if (pc) {
      if (pc.charge || pc.verbe) return mal(pc, "Un semé et une pièce chargée : l'Atelier ne sait pas les combiner.");
      pose(pc);
    }
  } else if (g1) {
    if (!pc) { pose1(g1); if (acc) pose2(acc.o); }
    else if (pc.charge) {                                      // « à trois étoiles d'or, à la fasce d'azur chargée de… » : les étoiles sont celles du champ
      if (acc || pc.verbe) return mal(pc, `Trop de meubles autour de la pièce chargée. ${ORDRE}.`);
      pose2(g1); pose1(pc.charge); a.pos = "sur"; pose(pc);
    } else if (!["chef", "bordure", "orle"].includes(pc.p) || pc.verbe) {
      return mal(pc, `Des meubles avant la pièce : l'Atelier ne les lit ainsi que pour le chef, la bordure et l'orle (« à trois étoiles d'or, au chef d'azur »). Pour les autres pièces, écrivez « à ${aArt(pc.p, PIECES[pc.p].g).slice(2)}${pc.p} …, accompagnée de… ».`);
    } else { pose1(g1); if (acc) pose2(acc.o); pose(pc); }
  } else if (pc) {
    pose(pc);
    if (pc.charge) {
      a.pos = "sur"; pose1(pc.charge);
      if (pc.verbe) {                                          // « chargée de …, accompagnée de … » : le second est un meuble du champ
        if (pc.verbe.o2) return mal(pc, `Trop de meubles autour de la pièce chargée. ${ORDRE}.`);
        pose2(pc.verbe.o);
      }
    } else if (pc.verbe) { pose1(pc.verbe.o); if (pc.verbe.o2) pose2(pc.verbe.o2); }
  }
  return { a, src };
}
/* « de la fasce » · « du chef » · « de l'orle » */
const dePiece = p => { const g = PIECES[p].g; return voy(p) ? `de l'${p}` : g === "f" ? `de la ${p}` : `du ${p}`; };
/* les armes sont-elles dessinables telles quelles ? normalize() ramène sinon ce qu'il ne sait pas faire à autre chose : on le repère
   (en comparant ce qui se voit, canon()) et on le dit. Rend les armes normalisées, ou null après avoir noté les erreurs. */
function verifie(P, a, src, lieu) {
  const b = normalize({ ...a }), x = canon(a), y = canon(b), m = a.m && meuble(a.m), m2 = a.m2 && meuble(a.m2);
  const dit = new Map();                                       // message → élément du texte qu'il vise
  const mets = (it, msg) => { if (!dit.has(msg)) dit.set(msg, it || src.m || src.p || src.m2); };
  const ou = a.p ? (a.pos === "sur" ? ` sur ${art(a.p, PIECES[a.p].g)}${a.p}` : ` autour ${dePiece(a.p)}`) : "";
  const nombres = s => countsFor(s).map(n => n === "seme" ? "semé" : NB[+n] || n).join(", ");
  const diff = new Set([...Object.keys(x), ...Object.keys(y)].filter(key => x[key] !== y[key]));
  /* « contourné » sur une figure symétrique : canon() ne le voit pas (rien ne change au dessin), mais le texte le disait — on ne l'avale pas */
  if (a.ct !== b.ct) diff.add("ct");
  if (a.ct2 !== b.ct2) diff.add("ct2");
  if (diff.has("pos")) { diff.delete("nb"); diff.delete("d"); }                 // l'un entraîne l'autre : on ne dit que la cause
  if (diff.has("nb")) diff.delete("d");
  if (diff.has("nb2")) diff.delete("d2");
  for (const key of diff) {
    if (key === "nb") mets(src.m, `L'Atelier ne sait pas poser ${a.nb === "seme" ? "un semé" : `${NB[+a.nb]} ${m.plur}`}${ou} (nombres possibles : ${nombres(a)}).`);
    else if (key === "nb2") mets(src.m2, `L'Atelier ne sait pas poser ${NB[+a.nb2]} ${m2.plur} (nombres possibles : ${Object.keys(PLEIN).map(n => NB[+n]).join(", ")}).`);
    else if (key === "pos") mets(src.p, `L'Atelier ne sait pas poser des meubles ${a.pos === "sur" ? "sur" : "autour"} ${a.pos === "sur" ? `${art(a.p, PIECES[a.p].g)}${a.p}` : dePiece(a.p)}.`);
    else if (key === "d") mets(src.m, `Cette disposition n'est pas possible ici dans l'Atelier (possibles : ${dispos(a).map(d => d.lab.toLowerCase()).join(" ; ") || "aucune"}).`);
    else if (key === "d2") mets(src.m2, `Cette disposition n'est pas possible dans l'Atelier (possibles : ${(PLEIN[a.nb2] || []).map(d => d.lab.toLowerCase()).join(" ; ")}).`);
    else if (key === "ct") mets(src.m, `${cap(art(m.sing, m.g))}${m.sing} ne se contourne pas dans l'Atelier : retourné de gauche à droite, il ne changerait pas.`);
    else if (key === "ct2") mets(src.m2, `${cap(art(m2.sing, m2.g))}${m2.sing} ne se contourne pas dans l'Atelier : retourné de gauche à droite, il ne changerait pas.`);
    else mets(null, `L'Atelier ne sait pas dessiner cela (${key}).`);
  }
  for (const [msg, it] of dit) erreur(P, it.de, it.fin, msg);
  if (dit.size) return null;
  /* une disposition dite, que l'Atelier ne reprendrait pas (place fixe) : on ne l'ignore pas en silence */
  if (src.m && src.m.dit && !dispos(b).length) return erreur(P, src.m.de, src.m.fin, "Dans l'Atelier, ces meubles ont ici une place fixe : la disposition dite n'y est pas prise en compte.");
  /* réserves : ce que le texte ne dit pas et que l'Atelier a dû fixer */
  const note = t => P.notes.push((lieu ? lieu + " : " : "") + t);
  const plur = (mm, o) => mm.kind === "roundel" ? (classe(o.tm) === "Métal" ? "besants" : "tourteaux") : mm.plur;
  const place = (o, mm, n) => {
    if (!o || o.seme || o.dit || !PLEIN[n]) return;
    const d0 = PLEIN[n][0], pal = mm.allongee && PLEIN[n].some(d => d.id === "pal") ? " (dites « posés en pal » s'ils sont l'un sur l'autre)" : "";
    if (d0.ph.trim() || pal) note(`disposition non précisée pour ${NB[n]} ${plur(mm, o)} : l'Atelier les pose ${d0.lab.toLowerCase()}${pal}.`);
  };
  if (dispos(b).length) place(src.m, m, +b.nb);
  if (b.m2) place(src.m2, m2, +b.nb2);
  for (const [o, mm] of [[src.m, m], [src.m2, m2]]) {
    if (!o || !mm || o.ta || !(mm.accentFixe || mm.accentTrait)) continue;
    note(`${cap(art(mm.sing, mm.g))}${mm.sing} n'est pas dite « ${mm.accentFixe ? mm.accentMot : agree(mm.accentMot, mm.g, false)} » : l'Atelier la dessine ainsi dans tous les cas, de l'émail du meuble faute d'indication.`);
  }
  for (const o of [src.m, src.m2]) if (o && o.mot && ((o.mot === "besant") !== (classe(o.tm) === "Métal"))) note(`${o.mot === "besant" ? "un besant est d'un métal" : "un tourteau est d'une couleur"} : l'Atelier écrira « ${classe(o.tm) === "Métal" ? "besant" : "tourteau"} ».`);
  return b;
}

/* ---------- le texte entier : quartiers, écusson en abîme ---------- */
/* « aux 1 et 4, » · « au 2 » → { nums, i } */
function etiquette(seg) {
  if (!seg[0] || (seg[0].w !== "au" && seg[0].w !== "aux")) return null;
  const nums = [];
  let i = 1;
  for (;;) {
    if (!seg[i] || seg[i].k !== "n") return null;
    nums.push(+seg[i++].w);
    if (seg[i] && seg[i].w === "et") { i++; continue; }
    break;
  }
  if (seg[i] && seg[i].w === ",") i++;
  return { nums, i };
}
function lireArmes(texte, toks, lieu, res) {
  const P = { toks, fin: toks.length, far: { i: -1, att: new Set() }, errs: [], notes: [] };
  const r = pArmes(P), t = r && assembler(P, r), b = t && verifie(P, t.a, t.src, lieu);
  if (b) { res.notes.push(...P.notes); return b; }
  if (P.errs.length) { res.erreurs.push(...P.errs); return null; }
  if (P.hint && P.hint.i >= P.far.i) { res.erreurs.push({ de: P.hint.de, a: P.hint.a, msg: P.hint.msg }); return null; }
  /* pas d'erreur précise : on dit où la lecture s'est arrêtée et ce qu'on y attendait */
  const k = toks[P.far.i], att = [...P.far.att].join(" ou ");
  if (!k) { const fin = toks.length ? toks[toks.length - 1].a : texte.length; res.erreurs.push({ de: fin, a: fin, msg: `Le blasonnement s'arrête trop tôt : l'Atelier attend ${att || "la suite"}.` }); return null; }
  let j = P.far.i;
  while (j + 1 < toks.length && j - P.far.i < 3 && toks[j + 1].k !== "p") j++;
  res.erreurs.push({ de: k.de, a: toks[j].a, msg: `« ${texte.slice(k.de, toks[j].a)} » : ici, l'Atelier attend ${att}.` });
  return null;
}
function lire(texte) {
  const L = lexique(), brut = decouper(texte), { toks, comm, erreurs } = sansCommentaires(texte, brut);
  const res = { ok: false, etat: null, notes: comm.map(c => `Commentaire ignoré : ${c}`), erreurs: [...erreurs], exact: false, reecrit: "" };
  if (!toks.length && !erreurs.length) { res.vide = true; return res; }
  for (const t of toks) {
    if (t.k === "?") res.erreurs.push({ de: t.de, a: t.a, msg: `« ${texte.slice(t.de, t.a)} » : caractère inattendu.` });
    else if (t.k === "w" && !L.vocab.has(t.w)) res.erreurs.push({ de: t.de, a: t.a, msg: `« ${texte.slice(t.de, t.a)} » : mot que l'Atelier ne connaît pas (meuble, pièce, partition ou terme absents de sa liste).` });
  }
  if (res.erreurs.length) return res;
  /* l'écusson en abîme : « , sur le tout … » ou « ; sur le tout … » (et non « brochant sur le tout ») */
  let ab = toks.findIndex((t, i) => i > 0 && t.w === "sur" && toks[i + 1] && toks[i + 1].w === "le" && toks[i + 2] && toks[i + 2].w === "tout" && toks[i - 1].k === "p" && (toks[i - 1].w === "," || toks[i - 1].w === ";"));
  let main = toks, abime = null;
  if (ab >= 0) {
    main = toks.slice(0, ab - 1);
    abime = toks.slice(ab + 3);
    if (abime[0] && abime[0].w === ",") abime.shift();
    if (!abime.length) res.erreurs.push({ de: toks[ab].de, a: toks[ab + 2].a, msg: "« sur le tout » doit être suivi des armes de l'écusson." });
  } else if (toks[0].w === "sur" && toks[1] && toks[1].w === "le" && toks[2] && toks[2].w === "tout") {
    res.erreurs.push({ de: toks[0].de, a: toks[2].a, msg: "« sur le tout » vient après les armes de l'écu, pas avant." });
  }
  const quartele = main[0] && main[0].w === "ecartele" && main[1] && main[1].w === ":";
  const etat = { q: "", ab: "", A: ADEFS.map(a => ({ ...a })) };
  if (!res.erreurs.length && quartele) {
    const segs = [[]];
    for (const t of main.slice(2)) { if (t.k === "p" && t.w === ";") segs.push([]); else segs[segs.length - 1].push(t); }
    const quarts = {}, groupes = [];
    segs.forEach((seg, n) => {
      const e = etiquette(seg);
      if (!e) { const t = seg[0]; res.erreurs.push(t ? { de: t.de, a: seg[Math.min(2, seg.length - 1)].a, msg: "Chaque quartier commence par son numéro : « aux 1 et 4, … », « au 2, … »." } : { de: texte.length, a: texte.length, msg: "Quartier vide après « ; »." }); return; }
      const lieu = e.nums.length > 1 ? `Quartiers ${e.nums.join(" et ")}` : `Quartier ${e.nums[0]}`;
      const a = lireArmes(texte, seg.slice(e.i), lieu, res);
      if (!a) return;
      for (const q of e.nums) { if (!(q >= 1 && q <= 4) || quarts[q]) res.erreurs.push({ de: seg[0].de, a: seg[Math.min(1, seg.length - 1)].a, msg: quarts[q] ? `Le quartier ${q} est donné deux fois.` : `Il n'y a pas de quartier ${q} : l'écartelé en compte quatre.` }); else quarts[q] = a; }
      groupes.push(e.nums.slice().sort().join());
    });
    if (!res.erreurs.length) {
      const manque = [1, 2, 3, 4].filter(q => !quarts[q]);
      if (manque.length) res.erreurs.push({ de: main[0].de, a: main[1].a, msg: `Il manque ${manque.length > 1 ? "les quartiers" : "le quartier"} ${manque.join(", ")}.` });
      else if (groupes.length === 2 && groupes.includes("1,4") && groupes.includes("2,3")) { etat.q = "2"; etat.A[0] = quarts[1]; etat.A[1] = quarts[2]; }
      else { etat.q = "4"; [1, 2, 3, 4].forEach(q => { etat.A[q - 1] = { ...quarts[q] }; }); }
    }
  } else if (!res.erreurs.length) {
    const a = lireArmes(texte, main, "", res);
    if (a) etat.A[0] = a;
  }
  if (!res.erreurs.length && abime) {
    const a = lireArmes(texte, abime, "Écusson", res);
    if (a) { etat.ab = "1"; etat.A[4] = a; }
  }
  if (res.erreurs.length) return res;
  res.ok = true; res.etat = etat;
  res.reecrit = blazonAll(etat);
  const sans = s => cles(s).filter(c => ![",", ";", ":"].includes(c)).join(" ");
  res.exact = sans(res.reecrit) === sans(texte.replace(/\([^)]*\)/g, " "));
  return res;
}
