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
const SYNONYMES = { plain: "plein", lys: "lis", bequee: "becquee", bequees: "becquees", beque: "becque", beques: "becques" };
/* « au premier, au deuxième… » disent la place d'un quartier comme « au 1, au 2… » */
const ORDINAUX = { premier: "1", deuxieme: "2", second: "2", seconde: "2", troisieme: "3", quatrieme: "4" };
const plie = s => String(s).toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
/* mots (w : forme sans accent ni majuscule ; « d' » devient « de »), nombres, ponctuation, et le reste (k "?") ; guillemets, point et trait d'union sautés */
function decouper(texte) {
  const re = new RegExp(`([${LETTRES}]+)['’]|([${LETTRES}]+)|(\\d+)|([,;:()])|([«»"“”.\\-–—])|(\\S)`, "g"), toks = [];
  for (let m; (m = re.exec(texte));) {
    const de = m.index, a = de + m[0].length;                 // r : le mot tel qu'il est écrit
    if (m[1]) { const w = plie(m[1]); toks.push({ k: "w", w: ELISIONS[w] || w, de, a, r: m[0] }); }
    else if (m[2]) { const w = plie(m[2]); if (ORDINAUX[w]) toks.push({ k: "n", w: ORDINAUX[w], de, a, r: m[0] }); else toks.push({ k: "w", w: SYNONYMES[w] || w, de, a, r: m[0] }); }
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
  const L = LEX = { d: DATA, a: ATL, vocab: new Set(["a", "au", "aux", "le", "la", "de", "du", "un", "une", "et", "en", "sur", "tout", "brochant", "par", "plein", "seme", "meme", "champ", "aussi", "pieces", "vert", "chacun", "les", "componee", "compons", "ceux", "ornee", "rinceau", "plus", "grand", "grands", "grande", "grandes", "elargie", "ondees"]) };
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
  for (const [s, v] of noms) if (v.nom && cles(s).length > 1) { const k = cles(s)[0]; if (!(L.debuts.get(k) || []).includes(s)) L.debuts.set(k, [...(L.debuts.get(k) || []), s]); }
  L.semeAdj = table([...ATL.meubles.filter(m => m.semeAdj).map(m => [m.semeAdj, { kind: m.kind }]), ["besanté", { kind: "roundel", mot: "besant" }], ["tourteauté", { kind: "roundel", mot: "tourteau" }]]);
  L.pieces = table(Object.keys(PIECES).flatMap(p => [[p, { p }], ...(p === "croix" ? [] : [[p + "s", { p, plur: true }]])]));
  L.contours = table(Object.entries(CONTOUR_NOM).flatMap(([k, v]) => quatre(v).map(f => [f, k])));
  L.parts = table(DATA.partitions.map(p => [p.nom, { kind: p.kind, tierce: p.kind.startsWith("tierce") }]));
  /* champs rayés : { ray, n } ; les noms des petites pièces (burelé, vergeté, coticé) valent dix pièces sauf mention */
  L.raye = table([["fascé", { ray: "barry" }], ["fascé ondé", { ray: "barryonde" }], ["ondé", { ray: "barryonde" }],          // « ondé d'argent et d'azur » : un fascé ondé (Zélande)
    ["palé", { ray: "paly" }], ["bandé", { ray: "bendy" }], ["barré", { ray: "bendysin" }], ["chevronné", { ray: "chevronny" }],
    ["burelé", { ray: "barry", n: "10" }], ["vergeté", { ray: "paly", n: "10" }], ["vergetté", { ray: "paly", n: "10" }], ["coticé", { ray: "bendy", n: "10" }], ["coticé en barre", { ray: "bendysin", n: "10" }],
    ["échiqueté", { ray: "chequy" }], ["fuselé", { ray: "lozengy" }], ["fuselé en bande", { ray: "lozengybend" }], ["fuselé en barre", { ray: "lozengysin" }]]);
  L.queue = {};
  for (const m of ATL.meubles) if (m.queue) L.queue[m.kind] = table(m.queue.lus.map(f => [f, true]));
  L.fixe = {};
  for (const m of ATL.meubles) if (m.fixe) L.fixe[m.kind] = table(quatre(m.fixe.mot).map(f => [f, true]));
  L.accent = {};
  for (const m of ATL.meubles) if (m.accent && m.accentMot) L.accent[m.kind] = table((m.accentFixe ? [m.accentMot] : quatre(m.accentMot)).map(f => [f, true]));
  /* les attributs des bêtes, par classe : « armé » = « membré » = « onglé » (les griffes), « lampassé » = « langué » (la langue)… */
  L.attr = new Map();
  for (const [mot, cl] of [["armé", "A"], ["membré", "A"], ["onglé", "A"], ["lampassé", "L"], ["langué", "L"], ["vilené", "V"], ["becqué", "B"], ["couronné", "C"], ["incensé", "I"], ["accorné", "H"], ["colleté", "K"], ["clariné", "N"]])
    for (const f of quatre(mot)) L.attr.set(cles(f)[0], cl);
  L.dispos = {};
  /* « posés en pal » = « rangés en pal » = « en pal » : le verbe ne change rien au dessin */
  const variantes = ph => { const m = ph.match(/^(posé|rangé) (en .+)$/); return m ? [ph, "posé " + m[2], "rangé " + m[2], m[2]] : [ph]; };
  for (const [n, ds] of Object.entries(PLEIN)) L.dispos[n] = table(ds.filter(d => d.ph.trim() || (d.alt || []).length).flatMap(d => [...new Set([d.ph, ...(d.alt || [])].filter(ph => ph.trim()).flatMap(ph => variantes(ph.trim())).flatMap(quatre))].map(f => [f, d.id])));
  L.ctr = table(quatre("contourné").map(f => [f, true]));
  L.borde = table(quatre("bordé").map(f => [f, true]));
  L.coure = table(quatre("couronné").map(f => [f, true]));
  L.issant = table(["issant", "issante"].map(f => [f, true]));
  L.charge = table(quatre("chargé").map(f => [f, true]));
  L.surmontant = table([["surmontant", true]]);
L.sommet = table(["sommé", "surmonté"].flatMap(w => quatre(w).map(f => [f, true])));
L.verbe = table(["accompagné", "cantonné", "accosté"].flatMap(w => quatre(w).map(f => [f, true])));
  L.fasceDispo = table([", l'un en chef et l'autre en pointe", ", l'une en chef et l'autre en pointe", ", trois en chef et trois en pointe"].map(f => [f, true]));
  L.brisPieces = table(Object.entries(BRIS_PIECES).map(([k, v]) => [v.nom.toLowerCase(), { b: k }]));
  for (const T of [L.noms, L.semeAdj, L.pieces, L.contours, L.parts, L.raye, ...Object.values(L.accent), ...Object.values(L.queue), ...Object.values(L.fixe), ...Object.values(L.dispos), L.ctr, L.borde, L.coure, L.issant, L.charge, L.verbe, L.sommet, L.surmontant, L.fasceDispo, L.brisPieces])
    for (const l of T.values()) for (const e of l) for (const w of e.k) if (/^[a-z]/.test(w)) L.vocab.add(w);
  for (const w of [...L.emaux.keys(), ...L.compte.keys(), ...L.attr.keys(), "tire", "tires", "brise", "peri", "pendant", "pendants", "milieu", "coeur", "centre", "chaque", "celui", "demi", "mouvant", "trait"]) L.vocab.add(w);
  for (const m of ATL.meubles) if (m.accentPlus) for (const w of cles(m.accentPlus)) L.vocab.add(w);
  return L;
}
/* pour les pages qui n'ont pas l'Atelier (galeries) : va chercher les données dont le lecteur a besoin */
async function chargerLecteur() {
  if (DATA && ATL) return;
  const [a, b] = await Promise.all([fetch("data/data.json"), fetch("data/atelier.json")]);
  if (!a.ok || !b.ok) throw new Error(`HTTP ${a.ok ? b.status : a.status}`);
  DATA = await a.json(); ATL = await b.json();
}

/* galeries (Blasons réels, Personnages) : ce que le lecteur fait de chaque blasonnement. Une Map carte → lecture (vide si les données manquent) ;
   rien n'est écrit en dur : quand le lecteur apprend un mot, les cartes qu'il relit de plus s'ouvrent d'elles-mêmes dans l'Atelier */
/* ce que l'Atelier lit d'une carte : son blasonnement, ou, si l'image montre autre chose que la source, le champ « atelier » (ce que dit l'image) */
const texteAtelier = a => a.atelier || a.blason;
function lectures(liste) {
  try { return new Map(liste.filter(a => a.blason).map(a => [a, lire(texteAtelier(a))])); } catch (e) { return new Map(); }
}
/* l'adresse qui ouvre l'Atelier sur ces armes : c'est lui qui relit le blasonnement (« #lire=… ») et dit ses réserves ;
   « de=blasons:royaume-de-france-moderne » dit de quelle carte on part (l'Atelier la montre à côté de son dessin) */
const adresseAtelier = (a, galerie) => `atelier.html#lire=${encodeURIComponent(texteAtelier(a))}${a.atelierAjust ? `&aj=${encodeURIComponent(a.atelierAjust)}` : ""}${galerie ? `&de=${galerie}:${slugCarte(a.nom)}` : ""}`;
const lienAtelier = (a, galerie) => `<p class="redo"><a href="${adresseAtelier(a, galerie)}">Redessiner dans l'Atelier</a></p>${a.atelier ? `<p class="redo-atelier">${a.atelierNote || "Le dessin suit l'image de la carte, qui montre autre chose que la source"} : « ${a.atelier.replace(/&/g, "&amp;").replace(/</g, "&lt;")} ».</p>` : ""}`;
/* l'écu d'une carte : un clic l'agrandit (assets/cartes.js) ; si le lecteur relit ses armes, la vue agrandie propose l'Atelier (au clavier, c'est le bouton « Redessiner ») */
const ecuCarte = (a, galerie, img, lisible) => lisible
  ? `<a class="shield to-at" href="${adresseAtelier(a, galerie)}" tabindex="-1" title="Agrandir l'image">${img}<span class="to-at-k" aria-hidden="true">Agrandir</span></a>`
  : `<div class="shield">${img}</div>`;
/* sous un blasonnement que l'Atelier ne relit pas : où il bute, et de quoi ouvrir quand même le texte dans l'Atelier, où il est surligné */
function buteAtelier(a, r, galerie) {
  const e = r && r.erreurs[0];
  let mot = e ? texteAtelier(a).slice(e.de, e.a).replace(/\s+/g, " ").replace(/^[\s,;:]+/, "").trim() : "";
  if (mot.length > 30) mot = mot.slice(0, 28).trim() + "…";
  mot = mot.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  return `<p class="redo-non">L'Atelier ne relit pas encore ces armes${mot ? ` : il bute sur « ${mot} »` : ""}. <a href="${adresseAtelier(a, galerie)}">Voir où dans l'Atelier</a></p>`;
}

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

function pEmail(P, i, ref) {                                 // « d'azur » · « de gueules » · « du même » · « du champ » (ref : l'émail déjà dit)
  const t = cle(P, i) === "de" && LEX.emaux.get(cle(P, i + 1));
  if (t) return { t, i: i + 2 };
  if (cle(P, i) === "du" && cle(P, i + 1) === "champ" && P.champ) {         // le champ n'a un émail que s'il est plein
    P.notes.push(`« du champ » : lu comme l'émail du champ, ${de(P.champ)}.`);
    return { t: P.champ, i: i + 2 };
  }
  if (ref && (cle(P, i) === "du" || cle(P, i) === "de") && cle(P, i + 1) === "meme") return { t: ref, i: i + 2 };
  return rate(P, i, "un émail (« d'azur », « de gueules »…)");
}
/* [,] « armé et lampassé d'azur » · « … du même » : { ta, i } ; ta null s'il n'y en a pas ; null si l'attribut est dit sans émail */
function pAccent0(P, i, m, tm) {
  const T = LEX.accent[m.kind];
  if (!T) return { ta: null, i };
  const j = cle(P, i) === "," ? i + 1 : i;
  const s0 = suites(T, P, j)[0];
  let s = s0, mots = null, cnAttr = false;
  if (s && !m.accentFixe) {         // « lampassé et vilené de gueules » : un autre attribut suit le mot exact, on lit la liste
    const a = j + s.n, b = cle(P, a) === "," || cle(P, a) === "et" ? a + 1 : -1;
    if (b > 0 && LEX.attr.has(cle(P, b))) s = undefined;
  }
  if (!s && !m.accentFixe) {
    /* « armé, lampassé et vilené de gueules » : une liste d'attributs de la bête. L'Atelier les colore d'un seul émail : on l'accepte si elle
       couvre ce qu'il dit (armé, lampassé…) et n'ajoute que des attributs qu'il ne distingue pas — pas une couronne, des cornes… */
    const need = new Set(cles(m.accentMot).map(w => LEX.attr.get(w)).filter(Boolean)), used = new Set();
    let q = j;
    for (;;) {
      const cl = LEX.attr.get(cle(P, q));
      if (!cl) break;
      used.add(cl); q++;
      if ((cle(P, q) === "," || cle(P, q) === "et") && LEX.attr.has(cle(P, q + 1))) q++; else break;
    }
    const couronne = m.couronne && used.delete("C");                               // « … et couronné de gueules » : la couronne est du même émail que l'attribut
    if (q > j && (m.accentSouple ? used.size > 0 : [...need].every(c => used.has(c))) && [...used].every(c => need.has(c) || "ALVB".includes(c))) {
      s = { n: q - j }; mots = P.toks.slice(j, q).filter(t => t.k === "w" && t.w !== "et").map(t => t.r); cnAttr = !!couronne;
    }
  }
  if (!s) s = s0;
  if (!s) return { ta: null, i };
  const k = j + s.n;
  const noter = () => { if (mots) P.notes.push(`« ${mots.join(", ")} » : l'Atelier colore d'un seul émail ce qu'il appelle « ${m.accentMot} ».`); };
  if ((cle(P, k) === "du" || cle(P, k) === "de") && cle(P, k + 1) === "meme") { noter(); return { ta: tm, i: k + 2, cn: cnAttr ? tm : "" }; }
  const t = pEmail(P, k);
  if (t) noter();
  return t ? { ta: t.t, i: t.i, cn: cnAttr ? t.t : "" } : null;
}
/* NOM [contourné] ÉMAIL [contourné] [attribut] */
/* Deux meubles peuvent porter le même nom (l'aigle, couronnée ou non) : on garde la lecture qui va le plus loin dans le texte
   (« becquée, membrée et couronnée de gueules » n'est lu en entier que par l'aigle couronnée), avec les réserves de celle-là seulement. */
function pCorps(P, i, ref, nb) {
  let best = null, rais = null;
  const base = P.notes.length;
  for (const { n, val } of suites(LEX.noms, P, i)) {
    P.notes.length = base;                                       // les réserves d'une lecture abandonnée ne comptent pas
    const m = meuble(val.kind);
    let j = i + n, ct = false, cnAv = false, iss = false, big = false;
    if (cle(P, j) === "plus" && ["grand", "grande", "grands", "grandes"].includes(cle(P, j + 1))) { big = true; j += 2; }          // « un tourteau plus grand d'azur »
    for (let q = 0; q < 3; q++) {                               // « issant », « contourné » et « couronné » devant l'émail, dans l'ordre qu'on veut
      const c0 = !iss && suites(LEX.issant, P, j)[0];
      if (c0) { iss = true; j += c0.n; continue; }
      const c1 = !ct && suites(LEX.ctr, P, j)[0];
      if (c1) { ct = true; j += c1.n; continue; }
      const k1 = !cnAv && m.couronne && suites(LEX.coure, P, j)[0];
      if (k1) { cnAv = true; j += k1.n; continue; }
      break;
    }
    /* « de l'un en l'autre » (ou « à l'autre ») au lieu d'un émail : le meuble prend l'émail opposé de chaque part du champ ; vérifié à l'assemblage */
    const cc = pContre(P, j), t = cc ? { t: ref || ADEF.tm, i: cc.i } : pEmail(P, j, ref);
    if (!t) {
      if (cle(P, j) === "a" && LEX.compte.has(cle(P, j + 1)) && cle(P, j + 2) === "rais")
        rais = rais || { de: P.toks[j].de, a: P.toks[j + 2].a, msg: `« ${cle(P, j + 1) === "un" ? "à un" : "à " + cle(P, j + 1)} rais » : l'Atelier ne dessine pas ${voy(m.sing) ? "d'" : "de "}${m.sing} à ${cle(P, j + 1)} rais (seulement à cinq, six, sept ou huit).` };
      continue;
    }
    j = t.i;
    const c2 = !ct && suites(LEX.ctr, P, j)[0];
    if (c2) { ct = true; j += c2.n; }
    const c3 = !iss && suites(LEX.issant, P, j)[0];                       // « un lion d'or issant » : aussi après l'émail
    if (c3) { iss = true; j += c3.n; }
    /* une variante qui porte le nom de la figure (« lion ») et se reconnaît à ce qui suit l'émail (« la queue fourchée et passée en sautoir ») */
    if (m.queue) { const jq = cle(P, j) === "," ? j + 1 : j, sq = suites(LEX.queue[m.kind], P, jq)[0]; if (!sq) continue; j = jq + sq.n; }
    /* la couronne d'un autre émail, après l'émail du meuble (« un lion d'or couronné d'argent, armé et lampassé de gueules ») */
    let cn = cnAv ? t.t : "";
    const aussi = q => (cle(P, q) === "aussi" ? q + 1 : q);                               // « couronné d'or aussi » : du même émail
    /* « couronné, armé et lampassé d'or » : sans émail à lui, « couronné » ouvre la liste des attributs, que pAccent lit */
    const pcr = () => { const jb = cle(P, j) === "," ? j + 1 : j, k2 = m.couronne && !cn && suites(LEX.coure, P, jb)[0], te = k2 && pEmail(P, jb + k2.n, t.t); if (te) { cn = te.t; j = aussi(te.i); } return !k2 || !!te || (k2.n === 1 && [",", "et"].includes(cle(P, jb + 1)) && LEX.attr.has(cle(P, jb + 2))); };
    if (!pcr()) continue;
    /* « trois léopards d'azur posés en pal, armés et lampassés de gueules » : la disposition peut précéder l'attribut */
    const dp = nb && m.accent ? pDispo(P, j, nb) : null, avant = dp && dp.dit ? dp : null;
    const ac = pAccent(P, avant ? avant.i : j, m, cc ? "" : t.t);           // contre-changé : « du même » laisse l'attribut suivre le corps
    if (!ac) continue;
    if (ac.cn) cn = ac.cn;
    let fin = ac.i;
    if (!cn && m.couronne) {                                    // « … armé et lampassé de gueules couronné d'argent »
      const jb = cle(P, fin) === "," ? fin + 1 : fin, k3 = suites(LEX.coure, P, jb)[0], te = k3 && pEmail(P, jb + k3.n, t.t);
      if (te) { cn = te.t; fin = aussi(te.i); } else if (k3) continue;
    }
    /* la partie fixe du dessin (« tigée et feuillée de sinople ») : dite, elle doit l'être de son émail ; tue, on le signale */
    if (m.fixe) {
      const jf = cle(P, fin) === "," ? fin + 1 : fin, sf = suites(LEX.fixe[m.kind], P, jf)[0], tf = sf && pEmail(P, jf + sf.n);
      if (sf && !tf) continue;
      if (tf && tf.t !== m.fixe.t) { erreur(P, P.toks[jf].de, P.toks[tf.i - 1].a, `L'Atelier dessine ${art(m.sing, m.g)}${m.sing} ${agree(m.fixe.mot, m.g, false)} ${de(m.fixe.t)}, pas d'un autre émail.`); continue; }
      if (tf) fin = tf.i; else P.notes.push(`${cap(art(m.sing, m.g))}${m.sing} n'est pas ${m.g === "f" ? "dite" : "dit"} « ${agree(m.fixe.mot, m.g, false)} » : l'Atelier ${m.g === "f" ? "la" : "le"} dessine ${agree(m.fixe.mot, m.g, false)} ${de(m.fixe.t)}.`);
    }
    const lu = { m, tm: t.t, ta: ac.ta, ct, cn, iss, big, cc: cc ? cc.cc : "", mot: val.mot, i: fin, pre: avant, notes: P.notes.splice(base) };
    if (!best || lu.i > best.i) best = lu;
  }
  P.notes.length = base;
  if (best) { const { notes, ...lu } = best; P.notes.push(...notes); return lu; }
  if (rais) return erreur(P, rais.de, rais.a, rais.msg);
  const k = cle(P, i), noms = k && !suites(LEX.noms, P, i).length && LEX.debuts.get(k);
  /* une piste, pas une erreur : elle ne parle que si la lecture ne va pas plus loin ailleurs (« la croix » est d'abord une pièce) */
  if (noms && !(P.hint && P.hint.i >= i)) P.hint = { i, de: P.toks[i].de, a: P.toks[i].a, msg: `« ${P.toks[i].r} » seul n'est pas un meuble de l'Atelier : il connaît ${noms.slice(0, 4).map(n => `« ${n} »`).join(", ")}${noms.length > 4 ? ` et ${noms.length - 4} autre${noms.length > 5 ? "s" : ""}` : ""}.` };
  return rate(P, i, "un meuble");
}
/* [,] « de l'un en l'autre » · « de l'un à l'autre » → { cc: "en" | "a", i } ; virgule ensuite permise (« à la clé, de l'un en l'autre, posée en pal ») */
function pContre(P, i) {
  const j = cle(P, i) === "," ? i + 1 : i;
  if (cle(P, j) !== "de" || cle(P, j + 1) !== "le" || cle(P, j + 2) !== "un" || !["en", "a"].includes(cle(P, j + 3)) || cle(P, j + 4) !== "le" || cle(P, j + 5) !== "autre") return null;
  return { cc: cle(P, j + 3), i: j + 6 };
}
/* disposition que le texte dit après des meubles de nombre n : « posés en pal », « rangées en chef », « posées 3, 2 et 1 »… */
function pDispo(P, i, n) {
  const T = LEX.dispos[n], j = cle(P, i) === "," ? i + 1 : i, s = T && suites(T, P, j)[0];
  return s ? { d: s.val, dit: true, i: j + s.n } : { d: "", dit: false, i };
}
/* « …, la hache du même » : la suite que dit un meuble dont l'accent colore deux parties (faisceau : le lien et la hache) */
function pAccent(P, i, m, tm) {
  const r = pAccent0(P, i, m, tm);
  if (r && r.ta != null && m.accentPlus) { const j = cle(P, r.i) === "," ? r.i + 1 : r.i, ks = cles(m.accentPlus); if (ks.every((c, q) => cle(P, j + q) === c)) r.i = j + ks.length; }
  return r;
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
  const c = pCorps(P, i + 2, ref, n);
  if (!c) return null;
  const d = c.pre ? { ...c.pre, i: c.i } : pDispo(P, c.i, n);
  return bornes(P, { n, ...c, d: d.d, dit: d.dit, i: d.i }, i);
}
/* « à la fleur de lis d'or » · « au lion d'or » · « à trois étoiles d'or posées en pal » [brochant sur le tout] */
function pGroupe(P, i) {
  const k = cle(P, i), k1 = cle(P, i + 1);
  let j, n;
  if (k === "au") { j = i + 1; n = 1; }
  else if (k === "a" && (k1 === "le" || k1 === "la")) { j = i + 2; n = 1; }
  else if ((k === "a" || k === "aux") && LEX.compte.has(k1)) { j = i + 2; n = LEX.compte.get(k1); }          // « à trois lions » · « aux trois lions »
  else if (k === "aux" && suites(LEX.noms, P, i + 1).some(s => meuble(s.val.kind).pluriel)) { j = i + 1; n = 1; }     // « aux rais d'escarboucle » : un seul meuble, dit au pluriel
  else return rate(P, k === "a" ? i + 1 : i, k === "a" ? "un article (« à la », « au ») ou un nombre (« à trois »)" : "« à » ou « au »");
  const pl = suites(LEX.pieces, P, j)[0];
  if (pl && pl.val.plur) return erreur(P, P.toks[i].de, P.toks[j + pl.n - 1].a, `Plusieurs ${pl.val.p}s : l'Atelier ne les lit que comme le champ, de deux à six, juste après son émail (« D'or à trois ${pl.val.p}s de gueules »)${{ fasce: " ; pour un champ coupé de bandes, écrivez « Fascé d'argent et d'azur de huit pièces »", pal: " ; au-delà, voir « Palé »", bande: " ; au-delà, voir « Bandé »", barre: " ; au-delà, voir « Barré »" }[pl.val.p] || ""}.`);
  const demi = cle(P, j) === "demi";
  const c = pCorps(P, demi ? j + 1 : j, P.prev, n);
  if (!c) return null;
  const d = c.pre ? { ...c.pre, i: c.i } : pDispo(P, c.i, n);
  let e = d.i, ctApres = false;
  const jp = cle(P, e) === "," ? e + 1 : e;                      // « la clef d'or en pal, contournée » : « en pal » est la pose ordinaire de la clef
  const jq = ["pose", "posee"].includes(cle(P, jp)) ? jp + 1 : jp;                         // « posée en pal »
  if (n === 1 && !d.dit && ["clef", "crosse", "epee", "lance", "sceptre", "sabre"].includes(c.m.kind) && cle(P, jq) === "en" && cle(P, jq + 1) === "pal") { e = jq + 2; P.notes.push(`« en pal » : la pose ordinaire ${c.m.kind === "clef" ? "de la clef" : "de cette figure"}, que l'Atelier ne dit pas.`); }
  /* la hache : « le fer à dextre » est sa pose ordinaire dans l'Atelier ; « le fer à senestre », elle est contournée */
  let ferSen = false;
  if (n === 1 && c.m.kind === "hache" && cle(P, jp) === "le" && cle(P, jp + 1) === "fer" && cle(P, jp + 2) === "a" && ["dextre", "senestre"].includes(cle(P, jp + 3))) {
    ferSen = cle(P, jp + 3) === "senestre";
    if (c.ct && !ferSen) return erreur(P, P.toks[jp].de, P.toks[jp + 3].a, "Une hache contournée a le fer à senestre, pas à dextre.");
    e = jp + 4;
    P.notes.push(ferSen ? "« le fer à senestre » : l'Atelier écrit « contournée »." : "« le fer à dextre » : la pose ordinaire de la hache, que l'Atelier ne dit pas.");
  }
  const jc = cle(P, e) === "," ? e + 1 : e, c4 = !c.ct && suites(LEX.ctr, P, jc)[0];
  if (c4 && e > d.i) { ctApres = true; e = jc + c4.n; }
  /* un demi-meuble : « à la demi-aigle de sable mouvant du trait du parti » (dit après l'émail et les attributs) */
  const jm = cle(P, e) === "," ? e + 1 : e, mv = cle(P, jm) === "mouvant" && cle(P, jm + 1) === "du" && cle(P, jm + 2) === "trait" && cle(P, jm + 3) === "du" && cle(P, jm + 4) === "parti";
  if (mv) e = jm + 5;
  if (demi !== mv) return erreur(P, P.toks[i].de, P.toks[e - 1].a, "Dans l'Atelier, « demi- » et « mouvant du trait du parti » vont ensemble : « à la demi-aigle de sable mouvant du trait du parti ».");
  if (demi && (n !== 1 || c.iss)) return erreur(P, P.toks[i].de, P.toks[e - 1].a, "Un demi-meuble mouvant du trait du parti se dit d'un seul meuble, qui n'est pas « issant ».");
  const br = pBrochant(P, e);
  if (br) e = br;
  return bornes(P, { t: "groupe", n, ...c, ct: c.ct || ctApres || ferSen, d: d.d, dit: d.dit, broche: !!br, trait: mv, i: e }, i);
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
/* « les trois fasces de gueules chargées de huit besants d'or, 3, 3 et 2 » : les figures sur les pièces du premier émail d'un fascé de nombre impair */
function pRC(P, i) {
  const k = LEX.compte.get(cle(P, i + 1)), pl = suites(LEX.pieces, P, i + 2)[0];
  if (!k || !pl || !pl.val.plur || pl.val.p !== "fasce") return rate(P, i + 1, "un nombre et « fasces » (« les trois fasces de gueules chargées de… »)");
  const t = pEmail(P, i + 2 + pl.n);
  if (!t) return null;
  const ch = suites(LEX.charge, P, t.i)[0];
  if (!ch) return rate(P, t.i, "« chargées de »");
  const o = pObjet(P, t.i + ch.n, t.t);
  if (!o) return null;
  let j = o.i;
  const nums = [];
  if (cle(P, j) === ",") {
    j++;
    for (;;) {
      const tk = P.toks[j];
      if (!tk || tk.k !== "n") break;
      nums.push(+tk.w); j++;
      if (cle(P, j) === "," || cle(P, j) === "et") { j++; continue; }
      break;
    }
  }
  return bornes(P, { t: "rc", k, o, tp: t.t, nums, i: j }, i);
}
/* « à la fasce ondée d'azur [brochant sur le tout] [chargée de …] [accompagnée de … [et de …]] » */
function pPiece(P, i) {
  const k = cle(P, i);
  const j = k === "au" ? i + 1 : k === "a" && (cle(P, i + 1) === "le" || cle(P, i + 1) === "la") ? i + 2 : -1;
  const ps = j >= 0 && suites(LEX.pieces, P, j)[0];
  if (!ps || ps.val.plur) return undefined;
  let e = j + ps.n, ln = "", fqs = "", lrg = "";
  if ((ps.val.p === "bande" || ps.val.p === "barre") && cle(P, e) === "elargie") { lrg = "1"; e++; }          // « la bande élargie d'or »
  if (ps.val.p === "franc-quartier" && cle(P, e) === "senestre") { fqs = "1"; e++; }
  const cn = suites(LEX.contours, P, e).find(c => c.val !== "alesee" || ALESEE_OK.has(ps.val.p));         // « la croix alésée » est un meuble : on ne la lit pas comme une pièce alésée
  if (cn) { ln = cn.val; e += cn.n; }
  let cmp = null;
  if (ps.val.p === "bordure" && !ln && cle(P, e) === "componee") {
    /* « la bordure componée de gueules et d'argent, les compons de gueules chargés d'un château d'or, ceux d'argent d'un lion de gueules » */
    const a1 = pEmail(P, e + 1);
    if (!a1) return null;
    if (cle(P, a1.i) !== "et") return rate(P, a1.i, "« et » (deux émaux de la bordure componée)");
    const a2 = pEmail(P, a1.i + 1);
    if (!a2) return null;
    cmp = { t1: a1.t, t2: a2.t, i: a2.i, c: {} };
    const groupe = (q, ceux) => {
      const x = pEmail(P, q + (ceux ? 1 : 2));
      if (!x) return null;
      let o;
      if (ceux) o = pObjet(P, x.i, x.t);
      else { const ch = suites(LEX.charge, P, x.i)[0]; if (!ch) return rate(P, x.i, "« chargés de »"); o = pObjet(P, x.i + ch.n, x.t); }
      if (!o) return null;
      if (o.n !== 1 || o.seme) return erreur(P, o.de, o.fin, "Sur chaque compon, l'Atelier ne pose qu'une figure.");
      if (x.t !== a1.t && x.t !== a2.t) return erreur(P, o.de, o.fin, "Les compons dont on parle sont d'un des deux émaux de la bordure.");
      return { x: x.t, o, i: o.i };
    };
    let q = cle(P, cmp.i) === "," ? cmp.i + 1 : cmp.i;
    if (cle(P, q) === "les" && cle(P, q + 1) === "compons" && cle(P, q + 2) === "de") {
      const g1 = groupe(q, false);
      if (!g1) return null;
      cmp.c[g1.x === a1.t ? 1 : 2] = g1.o; cmp.i = g1.i;
      q = cle(P, cmp.i) === "," ? cmp.i + 1 : cmp.i;
      if (cle(P, q) === "ceux" && cle(P, q + 1) === "de") {
        const g2 = groupe(q, true);
        if (!g2) return null;
        if (g2.x === g1.x) return erreur(P, g2.o.de, g2.o.fin, "Les deux groupes de compons sont de deux émaux différents.");
        cmp.c[g2.x === a1.t ? 1 : 2] = g2.o; cmp.i = g2.i;
      }
    }
  }
  const cc = pContre(P, e), t = cmp ? { t: cmp.t1, i: cmp.i } : cc ? { t: ADEF.tp, i: cc.i } : pEmail(P, e);       // « à la croix de l'un en l'autre »
  if (!t) return null;
  const it = { t: "piece", p: ps.val.p, ln, tp: t.t, fqs, lrg, cmp, pcc: cc && !cmp ? cc.cc : "", pf: "", broche: false, charge: null, verbe: null, i: t.i };
  /* « la croix de gueules bordée d'argent » : un filet d'un autre émail */
  const jb = cle(P, it.i) === "," ? it.i + 1 : it.i, bd = suites(LEX.borde, P, jb)[0];
  if (bd) { const tf = pEmail(P, jb + bd.n); if (!tf) return null; it.pf = tf.t; it.i = tf.i; }
  /* « la bande d'argent ornée d'un rinceau de sable » */
  const jr = cle(P, it.i) === "," ? it.i + 1 : it.i;
  if ((ps.val.p === "bande" || ps.val.p === "barre") && cle(P, jr) === "ornee" && cle(P, jr + 1) === "de" && cle(P, jr + 2) === "un" && cle(P, jr + 3) === "rinceau") {
    const tr = pEmail(P, jr + 4);
    if (!tr) return null;
    it.ri = tr.t; it.i = tr.i;
  }
  for (;;) {
    const q = cle(P, it.i) === "," ? it.i + 1 : it.i, br = pBrochant(P, q);
    if (br) { it.broche = true; it.i = br; continue; }
    const ch = !it.charge && suites(LEX.charge, P, q)[0];
    if (ch) { const o = pObjet(P, q + ch.n, it.tp); if (!o) return null; it.charge = o; it.i = o.i; continue; }
    const vb = !it.verbe && suites(LEX.verbe, P, q)[0];
    if (vb) {
      /* « accompagnée en chef d'un choucas de sable et en pointe de trois couronnes d'or » : deux meubles différents, de part et d'autre */
      if (cle(P, q + vb.n) === "en" && cle(P, q + vb.n + 1) === "chef") {
        const o = pObjet(P, q + vb.n + 2, it.tp);
        if (!o) return null;
        if (!(cle(P, o.i) === "et" && cle(P, o.i + 1) === "en" && cle(P, o.i + 2) === "pointe")) return rate(P, o.i, "« et en pointe de… »");
        const o2 = pObjet(P, o.i + 3, o.tm);
        if (!o2) return null;
        it.verbe = { o, o2, cp: true }; it.i = o2.i;
        continue;
      }
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
    /* « d'or à trois pals de gueules » : de deux à six pièces rebattues sur le champ = un champ rayé de cinq à treize zones (l'émail du champ aux deux bords) */
    const v = cle(P, t.i) === "," ? t.i + 1 : t.i;                 // « de gueules, à trois fasces d'argent » : la virgule est libre
    if (!plein && cle(P, v) === "a" && LEX.compte.has(cle(P, v + 1))) {
      const k = LEX.compte.get(cle(P, v + 1)), pl = suites(LEX.pieces, P, v + 2)[0], RAYE = { pal: "paly", fasce: "barry", bande: "bendy", barre: "bendysin", chevron: "chevronny" };
      if (pl && pl.val.plur && RAYE[pl.val.p] && k >= 2 && k <= 6) {
        const onde = pl.val.p === "fasce" && cle(P, v + 2 + pl.n) === "ondees";          // « de sable à trois fasces ondées d'argent »
        const t2 = pEmail(P, v + 2 + pl.n + (onde ? 1 : 0));
        if (t2) return { ch: { f: "ray", ray: onde ? "barryonde" : RAYE[pl.val.p], t1: t.t, t2: t2.t, n: String(2 * k + 1) }, i: t2.i };
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
    const ray = r.val.ray, losange = ray.startsWith("lozengy");
    let i = t2.i, nn = r.val.n || "6";
    if (cle(P, i) === "," && cle(P, i + 1) === "de" && LEX.compte.has(cle(P, i + 2))) i++;                // « Chevronné d'or et de gueules, de douze pièces »
    if (cle(P, i) === "de" && LEX.compte.has(cle(P, i + 1)) && (cle(P, i + 2) === "pieces" || cle(P, i + 2) === "tires" || cle(P, i + 2) === "tire")) {
      const n = LEX.compte.get(cle(P, i + 1)), mot = cle(P, i + 2) === "pieces" ? "pièces" : "tires", ici = P.toks[i], fin = P.toks[i + 2];
      if (losange) return erreur(P, ici.de, fin.a, "L'Atelier dessine le fuselé tel qu'il est, sans nombre de pièces.");
      if (ray === "chequy" ? mot !== "tires" || !RAY_TIRES.includes(String(n)) : mot !== "pièces" || (n % 2 && !(ray === "barry" && n >= 5 && cle(P, i + 3) === "," && cle(P, i + 4) === "les")) || !rayNs(ray).includes(String(n)))
        return erreur(P, ici.de, fin.a, ray === "chequy" ? `« de ${cle(P, i + 1)} ${mot} » : l'Atelier dessine l'échiqueté de trois à huit tires (six, si l'on ne dit rien).`
          : ray === "barryonde" ? `« de ${cle(P, i + 1)} ${mot} » : l'Atelier dessine le fascé ondé à quatre, six ou huit pièces.`
          : `« de ${cle(P, i + 1)} ${mot} » : l'Atelier dessine les champs rayés à six, huit, dix ou douze pièces (pour les nombres impairs : « d'or à trois pals de gueules »).`);
      nn = String(n); i += 3;
    }
    return { ch: { f: "ray", ray, t1: t1.t, t2: t2.t, n: nn }, i };
  }
  return rate(P, 0, "un champ (« d'azur », « parti d'azur et d'or », « fascé… »…)");
}
/* « brisé d'un bâton de gueules péri en barre » · « brisé d'une bordure engrêlée de gueules » · « brisé d'un croissant d'argent en chef » · « brisé de trois merlettes de sable » */
function pBrisure(P, i) {
  if (cle(P, i + 1) !== "de") return rate(P, i + 1, "« d'un », « d'une » ou « de » suivi d'un nombre");
  const n = LEX.compte.get(cle(P, i + 2)), j = i + 3, bp = n && suites(LEX.brisPieces, P, j)[0];
  if (!bp) {
    const o = pObjet(P, i + 1, undefined);
    return o && bornes(P, { t: "bris", fig: true, ...o }, i);
  }
  if (n !== 1) return erreur(P, P.toks[i].de, P.toks[j + bp.n - 1].a, "Une brisure par une pièce ne se lit qu'au singulier.");
  if (bp.val.b === "lambel") return pLambel(P, j + bp.n, i);
  let e = j + bp.n, lbr = "";
  const cn = suites(LEX.contours, P, e).find(c => c.val !== "alesee");
  if (cn) { lbr = cn.val; e += cn.n; }
  const t = pEmail(P, e);
  if (!t) return null;
  let sbr = "bande", q = t.i;
  if (bp.val.b === "baton" || bp.val.b === "filet") {
    if (bp.val.b === "baton") { if (cle(P, q) !== "peri") return rate(P, q, "« péri » (le bâton ne touche pas les bords de l'écu)"); q++; }
    if (cle(P, q) !== "en") return rate(P, q, "« en bande » ou « en barre »");
    const s = cle(P, q + 1);
    if (s !== "bande" && s !== "barre") return rate(P, q + 1, "« bande » ou « barre »");
    sbr = s; q += 2;
  }
  return bornes(P, { t: "bris", b: bp.val.b, tbr: t.t, sbr, lbr, i: q }, i);
}
/* « d'argent » et « à cinq pendants » dans l'ordre qu'on veut, puis « chargé sur chaque pendant d'un besant de gueules » ; j : le mot qui suit « lambel », i0 : le début de l'élément (« au », « brisé ») */
function pLambel(P, j, i0) {
  const it = { t: "bris", b: "lambel", tbr: "", sbr: "bande", lbr: "", lpn: "3", lpc: "", lpt: "Gueules", lpk: "1", lpw: "", i: j };
  let q = j, nPend = false;
  for (;;) {
    if (!it.tbr && cle(P, q) === "de" && LEX.emaux.has(cle(P, q + 1))) { it.tbr = LEX.emaux.get(cle(P, q + 1)); q += 2; continue; }
    if (!nPend && cle(P, q) === "a" && LEX.compte.has(cle(P, q + 1)) && cle(P, q + 2) === "pendants") {
      const n = LEX.compte.get(cle(P, q + 1));
      if (n < 2 || n > 6) return erreur(P, P.toks[q].de, P.toks[q + 2].a, "L'Atelier dessine des lambels de deux à six pendants.");
      it.lpn = String(n); nPend = true; q += 3; continue;
    }
    break;
  }
  if (!it.tbr) return rate(P, q, "un émail (« d'argent », « de gueules »…)");
  it.i = q;
  let k = cle(P, q) === "," ? q + 1 : q, w = null;
  if (cle(P, k) === "celui" && cle(P, k + 1) === "du" && ["milieu", "coeur", "centre"].includes(cle(P, k + 2))) { w = "milieu"; k += 3; }
  else if (cle(P, k) === "chaque" && cle(P, k + 1) === "pendant") { w = ""; k += 2; }                // « au lambel de gueules, chaque pendant chargé de trois châteaux d'or » (Artois)
  const ch = suites(LEX.charge, P, k)[0];
  if (!ch) return w === null ? bornes(P, it, i0) : rate(P, k, "« chargé de… »");
  k += ch.n;
  if (w === null) {
    if (cle(P, k) === "sur" && cle(P, k + 1) === "chaque" && cle(P, k + 2) === "pendant") { w = ""; k += 3; }
    else if (cle(P, k) === "sur" && cle(P, k + 1) === "le" && cle(P, k + 2) === "pendant" && cle(P, k + 3) === "du" && cle(P, k + 4) === "milieu") { w = "milieu"; k += 5; }
    else return rate(P, k, "« sur chaque pendant » ou « sur le pendant du milieu »");
  }
  const o = pObjet(P, k);
  if (!o) return null;
  const mal = msg => erreur(P, o.de, o.fin, msg);
  if (o.seme || o.ct || o.iss || o.cn) return mal("Sur un pendant, l'Atelier ne pose que des figures simples : ni semé, ni contourné, ni issant, ni couronné.");
  if (!LAMBEL_FIGS.includes(o.m.kind)) return mal(`L'Atelier ne pose sur un pendant que : ${LAMBEL_FIGS.map(f => meuble(f).plur).join(", ")}.`);
  if (o.n > 3) return mal("Un pendant ne porte, dans l'Atelier, qu'une, deux ou trois figures.");
  if (o.dit && o.d !== "pal") return mal("Sur un pendant, les figures se rangent en pal : l'Atelier ne les dispose pas autrement.");
  if (w === "milieu" && !(+it.lpn % 2)) return mal("Le pendant du milieu n'existe que si le lambel a un nombre impair de pendants.");
  Object.assign(it, { lpc: o.m.kind, lpt: o.tm, lpk: String(o.n), lpw: w, i: o.i });
  return bornes(P, it, i0);
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
  P.champ = ch.ch.f === "plein" ? ch.ch.t1 : undefined;             // « du champ » ne se dit que d'un champ d'un seul émail
  const items = [];
  let i = ch.i;
  if (ch.plein && i < P.fin) { rate(P, i, "la fin du blasonnement (« plein » se dit d'un champ nu)"); return null; }
  while (i < P.fin) {
    if (cle(P, i) === ",") { i++; continue; }
    const k = cle(P, i);
    let it = null;
    P.prev = items.length ? items[items.length - 1].tm || items[items.length - 1].tp : undefined;               // « du même » : l'émail dit juste avant
    if (k === "seme" || suites(LEX.semeAdj, P, i).length) it = pSeme(P, i);
    else if (k === "au" && cle(P, i + 1) === "lambel") it = pLambel(P, i + 2, i);
    else if (k === "a" || k === "au" || k === "aux") it = pPiece(P, i) || pGroupe(P, i);              // « la croix d'argent » est une pièce, « la croix de Lorraine » un meuble
    else if (k === "brise") it = pBrisure(P, i);
    else if (k === "les") it = pRC(P, i);
    else if (suites(LEX.surmontant, P, i).length) {
      /* « une étoile surmontant un croissant » : le second meuble est sous le premier, donc en pointe */
      const j = i + suites(LEX.surmontant, P, i)[0].n, ref = items.length ? items[items.length - 1].tm : undefined, n = LEX.compte.get(cle(P, j));
      const c = n ? pCorps(P, j + 1, ref, n) : rate(P, j, "un nombre (« un », « trois »…)"), dd = c && (c.pre ? { ...c.pre, i: c.i } : pDispo(P, c.i, n));
      const o = c && bornes(P, { n, ...c, d: dd.d, dit: dd.dit, i: dd.i }, j);
      if (o) {
        if (o.dit && o.d !== "pointe") return erreur(P, o.de, o.fin, "Après « surmontant », l'Atelier pose le second meuble en pointe, et pas autrement.");
        o.d = "pointe"; o.dit = true; P.notes.push("« surmontant… » : l'Atelier le dit « accompagné en pointe de… ».");
      }
      it = o && bornes(P, { t: "acc", o, i: o.i }, i);
    } else if (k === "chacun" && suites(LEX.verbe, P, i + 1).length) {
      /* « …, chacun accompagné d'une étoile du même » : une figure du second meuble auprès de chaque figure du premier */
      const o = pObjet(P, i + 1 + suites(LEX.verbe, P, i + 1)[0].n, items.length ? items[items.length - 1].tm : undefined);
      it = o && bornes(P, { t: "acc", o, cha: true, i: o.i }, i);
    } else if (suites(LEX.verbe, P, i).length || suites(LEX.sommet, P, i).length) {
      const somme = !suites(LEX.verbe, P, i).length, vb = suites(LEX.verbe, P, i)[0] || suites(LEX.sommet, P, i)[0], o = pObjet(P, i + vb.n, items.length ? items[items.length - 1].tm : undefined);
      /* « sommé de » et « surmonté de » : l'Atelier n'a que l'accompagnement ; un meuble qui en porte un autre à son sommet l'a en chef */
      if (o && somme) {
        if (o.dit && o.d !== "chef") return erreur(P, o.de, o.fin, "Après « sommé » ou « surmonté », l'Atelier pose le second meuble en chef, et pas autrement.");
        o.d = "chef"; o.dit = true; P.notes.push(`« ${P.toks[i].r} de… » : l'Atelier le dit « accompagné en chef de… ».`);
      }
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
        if (c) {
          let e2 = c.i, ch = null;
          const jc = cle(P, e2) === "," ? e2 + 1 : e2, chs = suites(LEX.charge, P, jc)[0];          // « un tourteau plus grand d'azur chargé de trois fleurs de lis d'or »
          if (chs) { ch = pObjet(P, jc + chs.n, c.tm); if (!ch) return null; e2 = ch.i; }
          const o = bornes(P, { n: 1, ...c, d: pl.val, dit: true, ch }, i); it = bornes(P, { t: "acc", o, i: e2 }, i);
        }
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
/* la disposition lue : pour des léopards, « en pal » est la disposition qu'on ne dit pas, et « 2 et 1 » se dit (« base ») */
const dispoLue = o => palParDefaut({ m: o.m.kind, nb: String(o.n) }) ? (o.d === "pal" ? "" : o.dit && !o.d ? "base" : o.d || "") : o.d || "";
const poseM = (a, o) => Object.assign(a, { m: o.m.kind, nb: o.seme ? "seme" : String(o.n), tm: o.tm, ta: o.cc ? o.ta || "" : o.ta || o.tm, ct: o.ct ? "1" : "", cn: o.cn || "", iss: o.trait ? "t" : o.iss ? "1" : "", cc: o.cc || "", d: dispoLue(o) });
const poseM2 = (a, o) => Object.assign(a, { big2: o.big ? "1" : "", m2c: o.ch ? o.ch.m.kind : "", m2cn: o.ch ? String(o.ch.n) : ADEF.m2cn, m2ct: o.ch ? o.ch.tm : ADEF.m2ct, m2: o.m.kind, nb2: String(o.n), tm2: o.tm, ta2: o.ta || o.tm, ct2: o.ct ? "1" : "", cn2: o.cn || "", d2: o.d || "" });
const posePiece = (a, it) => Object.assign(a, { p: it.p, tp: it.tp, lrg: it.lrg || "", fqs: it.fqs || "", ri: it.ri || "", pcc: it.pcc || "", ln: it.ln, pf: it.pf || "" }, it.cmp ? {
  cmp: "1", tpc: it.cmp.t2, cm1: it.cmp.c[1] ? it.cmp.c[1].m.kind : "", cm1t: it.cmp.c[1] ? it.cmp.c[1].tm : ADEF.cm1t, cm2: it.cmp.c[2] ? it.cmp.c[2].m.kind : "", cm2t: it.cmp.c[2] ? it.cmp.c[2].tm : ADEF.cm2t } : {});
const ORDRE = "L'Atelier lit : le champ, puis soit des meubles (« à trois étoiles d'or »), soit une pièce (« à la fasce d'azur ») avec ses meubles (« chargée de… », « accompagnée de… »)";
/* range les éléments lus dans les armes de l'Atelier — dans les seuls ordres que blazon() écrit, plus « chargée de…, accompagnée de… » */
function assembler(P, r) {
  const a = { ...ADEF, m: "", p: "", m2: "", ...r.ch.ch }, its = r.items, src = {};       // ADEF porte une fleur de lis : le texte seul dit quels meubles il y a
  /* la brisure se dit en dernier : on la met de côté, le reste se lit comme avant */
  const bi = its.findIndex(x => x.t === "bris"), bris = bi >= 0 ? its.splice(bi, 1)[0] : null;
  if (bris && bi !== its.length) return erreur(P, bris.de, bris.fin, "La brisure se dit en dernier : « …, brisé d'un… ».");
  if (bris && bris.fig && (bris.ct || bris.iss || bris.cn)) return erreur(P, bris.de, bris.fin, "Dans l'Atelier, une figure de brisure ne se contourne pas, ne sort pas de la pointe et ne porte pas de couronne.");
  let k = 0;
  const prend = t => (its[k] && its[k].t === t ? its[k++] : null);
  const sem = prend("seme"), g1 = sem ? null : prend("groupe"), acc = g1 ? prend("acc") : null, g1b = g1 && !acc ? prend("groupe") : null, g2 = sem ? prend("groupe") : null, pc = prend("piece"), rci = !sem && !g1 && !pc ? prend("rc") : null;
  const mal = (it, msg) => erreur(P, it.de, it.fin, msg);
  if (k < its.length) return mal(its[k], `Cet élément arrive là où l'Atelier ne sait pas le lire. ${ORDRE}.`);
  if (g1b && !g1b.broche) return mal(g1b, "Un second groupe de meubles ne se lit, dans l'Atelier, que s'il broche sur le premier : « à l'écusson d'argent, aux rais d'escarboucle d'or brochant sur le tout ».");
  if (g1b && (pc || g1b.n !== 1)) return mal(g1b, "Le meuble qui broche sur le premier est seul, sans pièce, dans l'Atelier.");
  if (acc && acc.cha && (pc || g1.n < 2 || g1.m.seul || g1.iss || g1.broche || acc.o.n !== 1 || acc.o.dit)) return mal(acc, "« chacun accompagné de… » : l'Atelier le lit de plusieurs meubles (deux ou plus, sans pièce), chacun auprès d'une seule figure, sans place dite (« …, chacun accompagné d'une étoile d'argent »).");
  const broCh = g1 && pc && pc.broche && pc.charge && !pc.verbe && !acc && g1.n === 1 && !g1.broche;         // « au faisceau d'or, à la fasce de gueules brochant sur le tout, chargée de trois étoiles d'or »
  const br = [g1, g2, pc].find(x => x && x.broche);
  const bro = g1 && pc && pc.broche && BRO_OK.has(pc.p) && !pc.charge && !pc.verbe && !sem;         // « à l'aigle de sable, à la cotice de gueules brochant sur le tout »
  if (br && a.f === "plein" && !(bro && br === pc) && !(broCh && br === pc)) return mal(br, "« brochant sur le tout » n'a de sens, dans l'Atelier, que sur un champ divisé ou pour une pièce qui broche sur des meubles (« à l'aigle de sable, à la cotice de gueules brochant sur le tout »).");
  const pose1 = o => { poseM(a, o); src.m = o; }, pose2 = o => { poseM2(a, o); src.m2 = o; }, pose = it => { posePiece(a, it); src.p = it; };
  if (sem) {
    pose1(sem);
    if (g2) pose2(g2);
    if (pc) {
      if (pc.charge || pc.verbe) return mal(pc, "Un semé et une pièce chargée : l'Atelier ne sait pas les combiner.");
      pose(pc);
    }
  } else if (g1) {
    if (!pc) { pose1(g1); if (acc) { pose2(acc.o); if (acc.cha) a.cha = "1"; } if (g1b) { pose2(g1b); a.bro2 = "1"; } }
    else if (bro) { pose1(g1); if (acc) pose2(acc.o); pose(pc); a.pos = "sous"; }
    else if (pc.charge) {                                      // « à trois étoiles d'or, à la fasce d'azur chargée de… » : les étoiles sont celles du champ
      if (acc || pc.verbe) return mal(pc, `Trop de meubles autour de la pièce chargée. ${ORDRE}.`);
      pose2(g1); pose1(pc.charge); a.pos = "sur"; pose(pc);
      if (broCh) a.pbro = "1";
    } else if (!["chef", "bordure", "orle"].includes(pc.p) || pc.verbe) {
      return mal(pc, `Des meubles avant la pièce : l'Atelier ne les lit ainsi que pour le chef, la bordure et l'orle (« à trois étoiles d'or, au chef d'azur »). Pour les autres pièces, écrivez « à ${aArt(pc.p, PIECES[pc.p].g).slice(2)}${pc.p} …, accompagnée de… ».`);
    } else { pose1(g1); if (acc) pose2(acc.o); pose(pc); }
  } else if (pc) {
    pose(pc);
    if (pc.charge) {
      a.pos = "sur"; pose1(pc.charge);
      if (pc.verbe) {                                          // « chargée de …, accompagnée de … » : le second est un meuble du champ
        if (pc.verbe.o2 || pc.verbe.cp) return mal(pc, `Trop de meubles autour de la pièce chargée. ${ORDRE}.`);
        pose2(pc.verbe.o);
      }
    } else if (pc.verbe) {
      if (pc.verbe.cp && pc.p !== "fasce") return mal(pc, "« accompagné en chef de … et en pointe de … » : l'Atelier ne le dit que d'une fasce.");
      pose1(pc.verbe.o); if (pc.verbe.o2) pose2(pc.verbe.o2); if (pc.verbe.cp) a.cp = "1";
    }
  }
  if (rci) {
    const n = +a.n, K = (n + 1) / 2, dist = rcDist({ n: a.n, nb: String(rci.o.n) });
    if (a.f !== "ray" || a.ray !== "barry" || n % 2 === 0 || n < 5) return mal(rci, "« Les fasces … chargées de… » ne se dit, dans l'Atelier, que d'un fascé de nombre impair de pièces (cinq, sept…).");
    if (rci.k !== K) return mal(rci, `Un fascé de ${NB[n]} pièces a ${NB[K]} fasces du premier émail, non ${NB[rci.k]}.`);
    if (rci.tp !== a.t1) return mal(rci, "Les fasces chargées sont celles du premier émail du champ.");
    if (rci.o.seme || rci.o.n < K) return mal(rci, `Il faut au moins une figure par fasce (${NB[K]}).`);
    if (rci.nums.join() !== dist.join()) return mal(rci, `L'Atelier répartit ${NB[rci.o.n]} figures sur ${NB[K]} fasces ainsi : ${dist.join(", ")} (à dire après les figures : « , ${dist.join(", ")} »).`);
    pose1(rci.o); a.rc = "1";
  }
  if (bris) {
    src.bris = bris;
    if (bris.fig) Object.assign(a, { br: bris.m.kind, tbr: bris.tm, brn: String(bris.n), brd: bris.d || "" });
    else Object.assign(a, { br: bris.b, tbr: bris.tbr, sbr: bris.sbr, lbr: bris.lbr }, bris.b === "lambel" ? { lpn: bris.lpn, lpc: bris.lpc, lpt: bris.lpt, lpk: bris.lpk, lpw: bris.lpw } : {});
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
  const ou = a.p ? (a.pos === "sur" ? ` sur ${art(a.p, PIECES[a.p].g)}${a.p}` : a.pos === "sous" ? ` sous ${art(a.p, PIECES[a.p].g)}${a.p}` : ` autour ${dePiece(a.p)}`) : "";
  const nombres = s => countsFor(s).map(n => n === "seme" ? "semé" : NB[+n] || n).join(", ");
  const diff = new Set([...Object.keys(x), ...Object.keys(y)].filter(key => x[key] !== y[key]));
  /* « contourné » sur une figure symétrique : canon() ne le voit pas (rien ne change au dessin), mais le texte le disait — on ne l'avale pas */
  if (a.ct !== b.ct) diff.add("ct");
  if (a.ct2 !== b.ct2) diff.add("ct2");
  if (diff.has("pos")) { diff.delete("nb"); diff.delete("d"); }                 // l'un entraîne l'autre : on ne dit que la cause
  if (diff.has("nb")) diff.delete("d");
  if (diff.has("nb2")) diff.delete("d2");
  if (diff.has("cp")) diff.delete("d2");
  if (diff.has("br")) for (const k of ["tbr", "sbr", "lbr", "brn", "brd", "lpn", "lpc", "lpt", "lpk", "lpw"]) diff.delete(k);
  if (diff.has("brn")) diff.delete("brd");
  for (const key of diff) {
    if (key === "nb") mets(src.m, `L'Atelier ne sait pas poser ${a.nb === "seme" ? "un semé" : `${NB[+a.nb]} ${m.plur}`}${ou} (nombres possibles : ${nombres(a)}).`);
    else if (key === "cp") mets(src.m2, "« en chef … et en pointe … » : l'Atelier pose une, deux ou trois figures de chaque côté de la fasce, ni semé ni contourné autrement.");
    else if (key === "nb2") mets(src.m2, `L'Atelier ne sait pas poser ${NB[+a.nb2]} ${m2.plur} (nombres possibles : ${Object.keys(PLEIN).map(n => NB[+n]).join(", ")}).`);
    else if (key === "pos") mets(src.p, a.pos === "sous" ? `L'Atelier ne sait pas faire brocher ${art(a.p, PIECES[a.p].g)}${a.p} sur des meubles ici.` : `L'Atelier ne sait pas poser des meubles ${a.pos === "sur" ? "sur" : "autour"} ${a.pos === "sur" ? `${art(a.p, PIECES[a.p].g)}${a.p}` : dePiece(a.p)}.`);
    else if (key === "ln") mets(src.p, a.ln === "alesee" ? `${cap(art(a.p, PIECES[a.p].g))}${a.p} ne s'alèse pas dans l'Atelier (alésés : ${[...ALESEE_OK].join(", ")}).` : `L'Atelier ne sait pas dessiner ce bord pour ${art(a.p, PIECES[a.p].g)}${a.p}.`);
    else if (key === "pf") mets(src.p, `L'Atelier ne sait pas border ${art(a.p, PIECES[a.p].g)}${a.p} d'un filet.`);
    else if (key === "d") mets(src.m, `Cette disposition n'est pas possible ici dans l'Atelier (possibles : ${dispos(a).map(d => d.lab.toLowerCase()).join(" ; ") || "aucune"}).`);
    else if (key === "d2") mets(src.m2, `Cette disposition n'est pas possible dans l'Atelier (possibles : ${(PLEIN[a.nb2] || []).map(d => d.lab.toLowerCase()).join(" ; ")}).`);
    else if (key === "iss") mets(src.m, src.m && src.m.trait ? "Dans l'Atelier, un demi-meuble mouvant du trait du parti se dit d'un seul meuble, sans pièce." : "Dans l'Atelier, « issant » ne se dit que d'un seul meuble, sans pièce : il sort de la pointe de l'écu.");
    else if (key === "br") mets(src.bris, `L'Atelier ne brise qu'avec une bordure, un bâton, un filet, un canton, un franc-quartier ou l'une de ces figures : ${BRIS_FIGS.map(k => meuble(k).plur).join(", ")}.`);
    else if (key === "brn") mets(src.bris, "L'Atelier ne pose en brisure qu'une, deux ou trois figures.");
    else if (key === "brd") mets(src.bris, `Cette disposition n'est pas possible pour une brisure dans l'Atelier (possibles : ${dispos(brisArms(a)).map(d => d.lab.toLowerCase()).join(" ; ")}).`);
    else if (/^(tbr|sbr|lbr|lpn|lpc|lpt|lpk|lpw)$/.test(key)) mets(src.bris, "L'Atelier ne sait pas dessiner cette brisure.");
    else if (key === "cn") mets(src.m, `${cap(art(m.sing, m.g))}${m.sing} ne porte pas de couronne dans l'Atelier (seules les bêtes en portent, les aigles l'ayant déjà dessinée).`);
    else if (key === "cn2") mets(src.m2, `${cap(art(m2.sing, m2.g))}${m2.sing} ne porte pas de couronne dans l'Atelier.`);
    else if (key === "ct") mets(src.m, `${cap(art(m.sing, m.g))}${m.sing} ne se contourne pas dans l'Atelier : retourné de gauche à droite, il ne changerait pas.`);
    else if (key === "cc") mets(src.m, "« De l'un en l'autre » : il faut un champ partagé de deux émaux (parti, coupé, tranché, écartelé…) et des meubles posés sur le champ, non sur une pièce ; ni besants ni tourteaux, dont le nom dit l'émail.");
    else if (key === "ct2") mets(src.m2, `${cap(art(m2.sing, m2.g))}${m2.sing} ne se contourne pas dans l'Atelier : retourné de gauche à droite, il ne changerait pas.`);
    else mets(null, `L'Atelier ne sait pas dessiner cela (${key}).`);
  }
  if (src.m2 && src.m2.iss) mets(src.m2, "Dans l'Atelier, « issant » ne se dit que du premier meuble.");
  if (src.m2 && src.m2.cc) mets(src.m2, "Dans l'Atelier, « de l'un en l'autre » ne se dit que du premier meuble.");
  for (const [msg, it] of dit) erreur(P, it.de, it.fin, msg);
  if (dit.size) return null;
  /* une disposition dite, que l'Atelier ne reprendrait pas (place fixe) : on ne l'ignore pas en silence */
  if (src.m && src.m.dit && !dispos(b).length && !b.rc) return erreur(P, src.m.de, src.m.fin, "Dans l'Atelier, ces meubles ont ici une place fixe : la disposition dite n'y est pas prise en compte.");
  /* réserves : ce que le texte ne dit pas et que l'Atelier a dû fixer */
  const note = t => P.notes.push((lieu ? lieu + " : " : "") + t);
  const plur = (mm, o) => mm.kind === "roundel" ? (classe(o.tm) === "Métal" ? "besants" : "tourteaux") : mm.plur;
  const place = (o, mm, n, premier) => {
    if (!o || o.seme || o.dit || !PLEIN[n] || (premier && mm.palDefaut && (n === 2 || n === 3))) return;
    const d0 = PLEIN[n][0], pal = mm.allongee && PLEIN[n].some(d => d.id === "pal") ? " (dites « posés en pal » s'ils sont l'un sur l'autre)" : "";
    if (d0.ph.trim() || pal) note(`disposition non précisée pour ${NB[n]} ${plur(mm, o)} : l'Atelier les pose ${d0.lab.toLowerCase()}${pal}.`);
  };
  if (dispos(b).length && !b.rc) place(src.m, m, +b.nb, true);
  if (b.m2 && !b.cp) place(src.m2, m2, +b.nb2);          // en pointe d'une fasce (cp), leur place est fixe
  if (b.br && BRIS_FIGS.includes(b.br)) place(src.bris, meuble(b.br), +b.brn, true);
  for (const [o, mm] of [[src.m, m], [src.m2, m2]]) {
    if (!o || !mm || o.ta != null || !(mm.accentFixe || mm.accentTrait)) continue;          // ta "" : dit « du même » sur un meuble contre-changé
    note(`${cap(art(mm.sing, mm.g))}${mm.sing} n'est pas dite « ${mm.accentFixe ? mm.accentMot : agree(mm.accentMot, mm.g, false)} » : l'Atelier la dessine ainsi dans tous les cas, de l'émail du meuble faute d'indication.`);
  }
  for (const o of [src.m, src.m2]) if (o && o.mot && ((o.mot === "besant") !== (classe(o.tm) === "Métal"))) note(`${o.mot === "besant" ? "un besant est d'un métal" : "un tourteau est d'une couleur"} : l'Atelier écrira « ${classe(o.tm) === "Métal" ? "besant" : "tourteau"} ».`);
  return b;
}

/* ---------- le texte entier : quartiers, écusson en abîme ---------- */
/* « aux 1 et 4, » · « au 2 » · « en 1 et 4, » → { nums, i } */
function etiquette(seg) {
  if (!seg[0] || !["au", "aux", "en"].includes(seg[0].w)) return null;
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
  if (b) { res.notes.push(...new Set(P.notes)); return b; }
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
/* « Parti : au 1, A ; au 2, B » : chaque moitié est des armes, ou « écartelé : aux 1 et 4, … ; aux 2 et 3, … » (ou « au 1, … ; … ; au 4, … ») ; les moitiés se disent dans l'ordre */
function lireParti(texte, segs, res, etat, main) {
  let k = 0;
  /* « Coupé (Tranché, Taillé) : au 1, … ; au 2, … » : la partie du chef, puis celle de la pointe ; seules les moitiés d'un parti s'écartèlent */
  const Q = { parti: ["p", "Un parti"], coupe: ["c", "Un coupé"], tranche: ["t", "Un tranché"], taille: ["l", "Un taillé"] }[main[0].w], coupe = Q[0] !== "p", nom = Q[1];
  const bute = (seg, msg) => { const t = seg && seg[0]; res.erreurs.push(t ? { de: t.de, a: seg[Math.min(2, seg.length - 1)].a, msg } : { de: main[0].de, a: main[main.length - 1].a, msg }); };
  const moitiés = [];
  for (let h = 0; h < 2; h++) {
    const seg = segs[k++];
    if (!seg || !seg.length) return bute(seg, h ? "Il manque la moitié 2." : "Moitié vide après « ; ».");
    const e = etiquette(seg);
    if (!e || e.nums.length !== 1 || e.nums[0] !== h + 1) return bute(seg, `${nom} compte deux moitiés, dites dans l'ordre : « au 1, … ; au 2, … » (ici, on attend « au ${h + 1} »).`);
    let rest = seg.slice(e.i), mode = "";
    const armes = [];
    if (Q[0] === "c" && h === 0 && rest[0] && rest[0].w === "parti" && rest[1] && rest[1].w === ":") {
      /* « Coupé : au 1, parti : au 1, … ; au 2, … ; au 2, … » : le chef du coupé est partie en deux */
      rest = rest.slice(2); mode = "p";
      for (let n = 0; n < 2; n++) {
        const sg = n ? segs[k++] : rest, en = sg && etiquette(sg);
        if (!en || en.nums.length !== 1 || en.nums[0] !== n + 1) return bute(sg, `Le chef parti d'un coupé compte deux moitiés : « parti : au 1, … ; au 2, … » (ici, on attend « au ${n + 1} »).`);
        const a = lireArmes(texte, sg.slice(en.i), `Chef, ${n ? "senestre" : "dextre"}`, res);
        if (!a) return;
        armes.push(a);
      }
    } else if (rest[0] && rest[0].w === "ecartele" && rest[1] && rest[1].w === ":") {
      if (coupe) return bute(rest, `Dans l'Atelier, les parties ${nom.replace("Un", "d'un")} ne s'écartèlent pas (les moitiés d'un parti, si).`);
      rest = rest.slice(2);
      const e2 = etiquette(rest), cle2 = e2 && e2.nums.slice().sort().join();
      if (cle2 !== "1,4" && cle2 !== "1") return bute(rest, "Un écartelé dans une moitié commence par « aux 1 et 4, … » (puis « aux 2 et 3, … ») ou par « au 1, … » (jusqu'à « au 4, … »).");
      const quarts = cle2 === "1,4" ? ["1,4", "2,3"] : ["1", "2", "3", "4"];
      mode = quarts.length === 2 ? "2" : "4";
      const lieu = n => `Moitié ${h + 1}, quartier${quarts[n].length > 1 ? "s" : ""} ${quarts[n].split(",").join(" et ")}`;
      const a0 = lireArmes(texte, rest.slice(e2.i), lieu(0), res);
      if (!a0) return;
      armes.push(a0);
      for (let n = 1; n < quarts.length; n++) {
        const sg = segs[k++], en = sg && etiquette(sg);
        if (!en || en.nums.slice().sort().join() !== quarts[n]) return bute(sg, `Il manque, dans l'écartelé de la moitié ${h + 1}, le quartier ${quarts[n].split(",").join(" et ")} (« ${quarts[n].length > 1 ? "aux" : "au"} ${quarts[n].split(",").join(" et ")}, … »).`);
        const a = lireArmes(texte, sg.slice(en.i), lieu(n), res);
        if (!a) return;
        armes.push(a);
      }
    } else {
      const a = lireArmes(texte, rest, `Moitié ${h + 1}`, res);
      if (!a) return;
      armes.push(a);
    }
    moitiés.push({ mode, armes });
  }
  if (k < segs.length) return bute(segs[k], `${nom} compte deux moitiés : « au 1, … ; au 2, … ».`);
  etat.q = Q[0]; etat.h1 = moitiés[0].mode; etat.h2 = moitiés[1].mode;
  if (etat.q === "c" && etat.h1 === "p") { etat.A[0] = moitiés[0].armes[0]; etat.A[2] = moitiés[0].armes[1]; etat.A[1] = moitiés[1].armes[0]; return; }
  moitiés.forEach((m, h) => m.armes.forEach((a, n) => { etat.A[HALF_ARMS[h][n]] = a; }));
}
/* « demi-aigle de sable, mouvant du trait du parti, couronnée, becquée… de gueules » : on ramène le trait en dernier, où l'Atelier le lit */
function ramenerMouvant(toks) {
  const w = i => toks[i] && toks[i].w;
  for (let i = 1; i + 5 < toks.length; i++) {
    if (!(w(i) === "mouvant" && w(i + 1) === "du" && w(i + 2) === "trait" && w(i + 3) === "du" && w(i + 4) === "parti" && w(i + 5) === ",")) continue;
    const d = w(i - 1) === "," ? i - 1 : i;
    let f = i + 6;
    while (f < toks.length && w(f) !== ";") f++;
    toks.splice(d, f - d, ...toks.slice(i + 5, f), ...toks.slice(d, i + 5));
    return;
  }
}
function lire(texte) {
  const L = lexique(), brut = decouper(texte), { toks, comm, erreurs } = sansCommentaires(texte, brut);
  ramenerMouvant(toks);
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
  const estLabel = x => main[x] && ["au", "aux", "en"].includes(main[x].w) && main[x + 1] && main[x + 1].k === "n";
  /* « Écartelé par une croix [pattée] d'argent [bordée de gueules] : aux 1 et 4, … » : la croix passe sur les quatre quartiers */
  let croix = null;
  if (main[0] && main[0].w === "ecartele" && main[1] && main[1].w === "par") {
    const w = k => main[k] && main[k].w, em = k => Object.keys(MOT).find(t => MOT[t].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === w(k));
    let j = 2;
    if (w(j) === "une" && w(j + 1) === "croix") {
      j += 2;
      const xp = w(j) === "pattee" ? (j++, "1") : "";
      if (w(j) === "de" && em(j + 1)) {
        const xc = em(j + 1); j += 2;
        let xb = "";
        if (w(j) === "bordee" && w(j + 1) === "de" && em(j + 2)) { xb = em(j + 2); j += 3; }
        if (w(j) === ":") { croix = { xc, xb, xp }; main = [main[0], ...main.slice(j)]; }
      }
    }
  }
  /* « Parti : au 1, … ; au 2, … » · « Parti, en 1 … et en 2 … » ; « Parti d'azur et de gueules » reste un champ à deux émaux */
  const parti = !!(main[0] && ["parti", "coupe", "tranche", "taille"].includes(main[0].w) && main[1] && (main[1].w === ":" || estLabel(1) || (main[1].w === "," && estLabel(2))));
  const quartele = parti || (main[0] && main[0].w === "ecartele" && main[1] && main[1].w === ":");
  const etat = { q: "", ab: "", gb: "", h1: "", h2: "", xc: "", xb: "", xp: "", A: ADEFS.map(a => ({ ...a })) };
  if (croix) Object.assign(etat, croix);
  /* « ; le tout brisé d'un lambel d'argent » : la brisure de tout l'écu, dite après les quartiers ou les moitiés */
  let gbToks = null;
  if (quartele) {
    const kg = main.findIndex((t, i) => i > 0 && t.w === "le" && main[i + 1] && main[i + 1].w === "tout" && main[i + 2] && main[i + 2].w === "brise" && main[i - 1].k === "p" && main[i - 1].w === ";");
    if (kg >= 0) { gbToks = main.slice(kg + 2); main = main.slice(0, kg - 1); }
  }
  if (!res.erreurs.length && quartele) {
    const segs = [[]];
    /* les quartiers se séparent d'un point-virgule, ou d'une virgule devant « aux 2 et 3 », « en 2 et 3 » */
    const reste = main.slice(parti && estLabel(1) ? 1 : 2);
    reste.forEach((t, x) => {
      const sui = reste[x + 1], etiq = sui && ["au", "aux", "en"].includes(sui.w) && reste[x + 2] && reste[x + 2].k === "n";
      const coupe = t.k === "p" && (t.w === ";" || (t.w === "," && etiq)) || (parti && t.w === "et" && etiq);
      if (coupe) segs.push([]); else segs[segs.length - 1].push(t);
    });
    if (parti) lireParti(texte, segs, res, etat, main);
    else {
      const quarts = {}, groupes = [];
      segs.forEach(seg => {
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
    }
  } else if (!res.erreurs.length) {
    const a = lireArmes(texte, main, "", res);
    if (a) etat.A[0] = a;
  }
  if (!res.erreurs.length && abime) {
    const a = lireArmes(texte, abime, "Écusson", res);
    if (a) { etat.ab = "1"; etat.A[4] = a; }
  }
  if (!res.erreurs.length && gbToks) {
    const d0 = gbToks[0].de, f = w => ({ k: "w", w, de: d0, a: d0, r: "" });
    const g = lireArmes(texte, [f("de"), f("or"), { k: "p", w: ",", de: d0, a: d0, r: "" }, ...gbToks], "Brisure de l'écu", res);
    if (g && etat.A[0].br) res.erreurs.push({ de: gbToks[0].de, a: gbToks[gbToks.length - 1].a, msg: "La brisure de tout l'écu ne s'ajoute pas à celle des premières armes : l'Atelier n'en pose qu'une." });
    else if (g) { for (const k of ["br", "tbr", "sbr", "lbr", "brn", "brd", "lpn", "lpc", "lpt", "lpk", "lpw"]) if (k in g) etat.A[0][k] = g[k]; etat.gb = "1"; }
  }
  if (!res.erreurs.length) for (const i of active(etat)) if (etat.A[i].iss === "t" && (etat.q !== "p" || i > 1 || halfMode(etat, i))) res.erreurs.push({ de: 0, a: texte.length, msg: "« demi-… mouvant du trait du parti » ne se dit que d'une moitié d'un parti : « Parti : au 1, … ; au 2, … »." });
  if (res.erreurs.length) return res;
  res.ok = true; res.etat = etat;
  res.reecrit = blazonAll(etat);
  const sans = s => cles(s).filter(c => ![",", ";", ":"].includes(c)).join(" ");
  res.exact = sans(res.reecrit) === sans(texte.replace(/\([^)]*\)/g, " "));
  return res;
}
