/* L'ARMORIAL — le modèle des armes : grammaire, état d'une composition et blasonnement.
   Ni DOM ni dessin : ce fichier sert à l'Atelier (assets/atelier.js) comme au lecteur de blasonnement
   (assets/lecture.js), qui en est l'inverse. Il lit les globaux DATA (data/data.json) et ATL (data/atelier.json),
   que la page qui le charge remplit. */
let DATA, ATL;

/* ---------- grammaire ---------- */
const MOT = { Or: "or", Argent: "argent", Gueules: "gueules", Azur: "azur", Sable: "sable", Sinople: "sinople", Pourpre: "pourpre", Hermine: "hermine", Vair: "vair" };
const voy = w => /^[aeiouyhéèêâîôûœ]/i.test(w);
const de = t => (voy(MOT[t]) ? "d'" : "de ") + MOT[t];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const NB = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize"];
const art = (w, g) => voy(w) ? "l'" : g === "f" ? "la " : "le ";
const aArt = (w, g) => voy(w) ? "à l'" : g === "f" ? "à la " : "au ";
/* accorde les participes en -é : « armé et lampassé » → « armées et lampassées » */
const agree = (phrase, g, pl) => phrase.replace(/é(?=[\s,]|$)/g, "é" + (g === "f" ? "e" : "") + (pl ? "s" : ""));
const classe = t => (DATA.tinctures.find(x => x.nom === t) || {}).type;

const PIECES = {
  chef: { g: "m" }, fasce: { g: "f" }, pal: { g: "m" }, bande: { g: "f" }, barre: { g: "f" },
  croix: { g: "f" }, sautoir: { g: "m" }, chevron: { g: "m" }, bordure: { g: "f" }, orle: { g: "m" },
  canton: { g: "m" }, "franc-quartier": { g: "m" }, pairle: { g: "m" }, cotice: { g: "f" },        // propres à l'Atelier : voir « pieces » dans data/atelier.json
};
/* les pièces qui peuvent brocher sur des meubles du champ (« à l'aigle de sable, à la cotice de gueules brochant sur le tout »), et celles qui s'alèsent */
const BRO_OK = new Set(["fasce", "pal", "bande", "barre", "chevron", "croix", "sautoir", "pairle", "cotice"]);
const ALESEE_OK = new Set(["fasce", "pal", "bande", "barre", "chevron", "sautoir"]);          // la croix alésée est un meuble de l'Atelier
/* le bord d'une pièce, tel qu'on le blasonne ; les tracés sont dans assets/blason.js (CONTOURS) */
const CONTOUR_NOM = { onde: "ondé", nebule: "nébulé", dancette: "dancetté", engrele: "engrêlé", cannele: "cannelé", denche: "denché", alesee: "alésé" };
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
/* positions des meubles [x, y, échelle, rotation] dans le repère de l'écu (200 × 252) */
const B = 38.3;
/* champ plein : dispositions au choix ; la première est celle qu'on ne dit pas, sauf si sa phrase est donnée.
   ph = participe au masculin singulier, accordé ensuite ; plein:true = exclu avec bordure ou orle */
/* « trois léopards l'un sur l'autre » : autre façon, pour la lecture, de dire des meubles posés en pal */
const L_PAL = [" l'un sur l'autre", " l'une sur l'autre", " les uns sur les autres", " les unes sur les autres"];
const PLEIN = {
  1: [{ id: "", lab: "Au centre", ph: "", pts: [[100, 118, 1]] },
      { id: "chef", lab: "En chef", ph: " en chef", pts: [[100, 60, .48]] },
      { id: "pointe", lab: "En pointe", ph: " en pointe", pts: [[100, 176, .48]] },
      { id: "cd", lab: "Au canton dextre du chef", ph: " au canton dextre du chef", pts: [[54, 54, .38]] },
      { id: "cs", lab: "Au canton senestre du chef", ph: " au canton senestre du chef", pts: [[146, 54, .38]] }],
  2: [{ id: "", lab: "En fasce", ph: " posé en fasce", pts: [[62, 112, .5], [138, 112, .5]] },
      { id: "pal", lab: "En pal", ph: " posé en pal", alt: L_PAL, pts: [[100, 70, .42], [100, 170, .42]] },
      { id: "bande", lab: "En bande", ph: " posé en bande", pts: [[62, 74, .4], [138, 164, .4]] },
      { id: "barre", lab: "En barre", ph: " posé en barre", pts: [[138, 74, .4], [62, 164, .4]] },
      { id: "chef", lab: "En chef", ph: " rangé en chef", pts: [[64, 58, .36], [136, 58, .36]] }],
  3: [{ id: "", lab: "2 et 1", ph: "", pts: [[62, 80, .46], [138, 80, .46], [100, 168, .46]] },
      { id: "mal", lab: "1 et 2 (mal ordonnés)", ph: " mal ordonné", pts: [[100, 66, .42], [60, 158, .42], [140, 158, .42]] },
      { id: "fasce", lab: "En fasce", ph: " rangé en fasce", pts: [[48, 116, .3], [100, 116, .3], [152, 116, .3]] },
      { id: "chef", lab: "En chef", ph: " rangé en chef", pts: [[50, 56, .28], [100, 56, .28], [150, 56, .28]] },
      { id: "pal", lab: "En pal", ph: " posé en pal", alt: L_PAL, pts: [[100, 54, .3], [100, 120, .3], [100, 186, .3]] },
      { id: "bande", lab: "En bande", ph: " posé en bande", pts: [[52, 62, .3], [100, 118, .3], [148, 174, .3]] },
      { id: "barre", lab: "En barre", ph: " posé en barre", pts: [[148, 62, .3], [100, 118, .3], [52, 174, .3]] }],
  4: [{ id: "", lab: "2 et 2", ph: " posé 2 et 2", pts: [[62, 82, .42], [138, 82, .42], [62, 162, .42], [138, 162, .42]] },
      { id: "croix", lab: "En croix", ph: " posé en croix", pts: [[100, 54, .28], [48, 118, .28], [152, 118, .28], [100, 184, .28]] },
      { id: "fasce", lab: "En fasce", ph: " rangé en fasce", pts: [[34, 116, .22], [78, 116, .22], [122, 116, .22], [166, 116, .22]] },
      { id: "pal", lab: "En pal", ph: " posé en pal", alt: L_PAL, pts: [[100, 46, .22], [100, 102, .22], [100, 158, .22], [100, 212, .2]] }],
  5: [{ id: "", lab: "En sautoir", ph: " posé en sautoir", pts: [[56, 64, .34], [144, 64, .34], [100, 118, .34], [64, 176, .34], [136, 176, .34]] },
      { id: "croix", lab: "En croix", ph: " posé en croix", pts: [[100, 50, .26], [46, 118, .26], [100, 118, .26], [154, 118, .26], [100, 186, .26]] },
      { id: "221", lab: "2, 2 et 1", ph: " posé 2, 2 et 1", pts: [[64, 62, .3], [136, 62, .3], [64, 128, .3], [136, 128, .3], [100, 192, .3]] }],
  6: [{ id: "", lab: "3, 2 et 1", ph: " posé 3, 2 et 1", pts: [[48, 62, .3], [100, 62, .3], [152, 62, .3], [72, 120, .3], [128, 120, .3], [100, 180, .3]] },
      { id: "222", lab: "2, 2 et 2", ph: " posé 2, 2 et 2", pts: [[62, 60, .3], [138, 60, .3], [62, 124, .3], [138, 124, .3], [66, 186, .26], [134, 186, .26]] },
      { id: "33", lab: "3 et 3", ph: " posé 3 et 3", pts: [[48, 78, .28], [100, 78, .28], [152, 78, .28], [48, 154, .28], [100, 154, .28], [152, 154, .28]] },
      { id: "orle", lab: "En orle", ph: " en orle", plein: true, pts: [[48, 52, .2], [152, 52, .2], [34, 122, .2], [166, 122, .2], [58, 190, .2], [142, 190, .2]] }],
  7: [{ id: "", lab: "3, 3 et 1", ph: " posé 3, 3 et 1", pts: [[48, 62, .27], [100, 62, .27], [152, 62, .27], [48, 124, .27], [100, 124, .27], [152, 124, .27], [100, 186, .27]] },
      { id: "43", lab: "4 et 3", ph: " posé 4 et 3", pts: [[34, 84, .23], [78, 84, .23], [122, 84, .23], [166, 84, .23], [56, 152, .23], [100, 152, .23], [144, 152, .23]] }],
  8: [{ id: "", lab: "En orle", ph: " en orle", plein: true, pts: [[42, 46, .18], [100, 38, .18], [158, 46, .18], [34, 112, .18], [166, 112, .18], [46, 176, .18], [154, 176, .18], [100, 218, .18]] }],
  9: [{ id: "", lab: "3, 3 et 3", ph: " posé 3, 3 et 3", alt: [" posé en trois pals"], pts: [[48, 62, .26], [100, 62, .26], [152, 62, .26], [48, 124, .26], [100, 124, .26], [152, 124, .26], [56, 186, .26], [100, 186, .26], [144, 186, .26]] }],
  10: [{ id: "", lab: "4, 3, 2 et 1", ph: " posé 4, 3, 2 et 1", pts: [[40, 52, .2], [80, 52, .2], [120, 52, .2], [160, 52, .2], [60, 104, .2], [100, 104, .2], [140, 104, .2], [80, 156, .2], [120, 156, .2], [100, 206, .2]] },
       { id: "orle", lab: "En orle", ph: " en orle", plein: true, pts: [[46, 46, .17], [100, 38, .17], [154, 46, .17], [34, 96, .17], [166, 96, .17], [34, 150, .17], [166, 150, .17], [66, 196, .17], [134, 196, .17], [100, 222, .17]] }],
  12: [{ id: "", lab: "4, 4 et 4", ph: " posé 4, 4 et 4", pts: [[40, 62, .17], [80, 62, .17], [120, 62, .17], [160, 62, .17], [40, 120, .17], [80, 120, .17], [120, 120, .17], [160, 120, .17], [58, 178, .17], [86, 178, .17], [114, 178, .17], [142, 178, .17]] },
       { id: "orle", lab: "En orle", ph: " en orle", plein: true, pts: [[46, 46, .15], [100, 38, .15], [154, 46, .15], [34, 86, .15], [166, 86, .15], [32, 126, .15], [168, 126, .15], [40, 166, .15], [160, 166, .15], [64, 198, .15], [136, 198, .15], [100, 222, .15]] }],
};
/* la pièce que répètent les rayures (palé → pal…), pour dire « à trois pals » quand le nombre de zones est impair */
const RAY_PIECE = { barry: "fasce", paly: "pal", bendy: "bande", bendysin: "barre", chevronny: "chevron" };
/* les champs rayés : les quatre sens du trait, les chevrons, l'échiqueté (n = nombre de tires) et le fuselé (trois sens) */
const RAYS = ["barry", "paly", "bendy", "bendysin", "chevronny", "chequy", "lozengy", "lozengybend", "lozengysin"];
const RAY_BANDES = ["5", "6", "7", "8", "9", "10", "11", "12", "13"], RAY_TIRES = ["3", "4", "5", "6", "7", "8"];
const rayNs = ray => ray === "chequy" ? RAY_TIRES : ray.startsWith("lozengy") ? ["6"] : RAY_BANDES;
/* à partir de dix pièces, les pièces diminuées changent de nom (burelé, vergeté, coticé) ; le nombre par défaut est six, ou dix pour ces noms-là */
const RAY_NOM = { barry: ["Fascé", "Burelé"], paly: ["Palé", "Vergeté"], bendy: ["Bandé", "Coticé"], bendysin: ["Barré", "Coticé en barre"], chevronny: ["Chevronné", "Chevronné"] };
function rayTexte(s) {
  const n = +s.n, ems = `${de(s.t1)} et ${de(s.t2)}`;
  if (s.ray === "chequy") return `Échiqueté ${ems}${n === 6 ? "" : ` de ${NB[n]} tires`}`;
  if (s.ray.startsWith("lozengy")) return `Fuselé${{ lozengybend: " en bande", lozengysin: " en barre" }[s.ray] || ""} ${ems}`;
  /* un nombre impair de zones laisse aux deux bords l'émail du champ : ce sont des pièces rebattues, « d'or à trois pals de gueules » */
  if (n % 2) return `${cap(de(s.t1))} à ${NB[(n - 1) / 2]} ${RAY_PIECE[s.ray]}s ${de(s.t2)}`;
  const [petit, grand] = RAY_NOM[s.ray];
  return `${n >= 10 ? grand : petit} ${ems}${n === 6 || (n === 10 && s.ray !== "chevronny") ? "" : ` de ${NB[n]} pièces`}`;
}
const PLEINLIKE = new Set(["plein", "bordure", "orle"]);
const LAYOUT = {
  chef: { 1: [[100, 154, .62]], 2: [[64, 146, .42], [136, 146, .42]], 3: [[62, 120, .36], [138, 120, .36], [100, 192, .34]] },
  fasce: { 2: [[100, 60, .4], [100, 196, .34]], 3: [[62, 60, .36], [138, 60, .36], [100, 196, .34]],
           6: [[46, 60, .26], [100, 60, .26], [154, 60, .26], [64, 186, .24], [100, 186, .24], [136, 186, .24]] },
  pal: { 2: [[46, 118, .34], [154, 118, .34]] },
  bande: { 2: [[146, 66, .36], [56, 178, .34]] },
  cotice: { 2: [[146, 66, .3], [56, 178, .28]] },                                  // trop étroite pour porter des meubles : ils l'accompagnent
  barre: { 2: [[54, 66, .36], [144, 178, .34]] },
  chevron: { 3: [[58, 70, .36], [142, 70, .36], [100, 200, .3]] },
  croix: { 4: [[49, 54, .28], [151, 54, .28], [54, 166, .26], [146, 166, .26]] },
  sautoir: { 4: [[100, 48, .28], [42, 124, .28], [158, 124, .28], [100, 210, .22]] },
  "sur-chef": { 1: [[100, 47, .3]], 2: [[68, 47, .28], [132, 47, .28]], 3: [[52, 47, .26], [100, 47, .26], [148, 47, .26]] },
  "sur-fasce": { 1: [[100, 130, .3]], 3: [[52, 130, .24], [100, 130, .24], [148, 130, .24]] },
  "sur-pal": { 1: [[100, 120, .28]], 3: [[100, 62, .24], [100, 128, .24], [100, 194, .22]] },
  "sur-bande": { 1: [[100, 126, .26, -B]], 3: [[54, 67, .22, -B], [100, 126, .22, -B], [146, 184, .22, -B]] },
  "sur-barre": { 1: [[100, 126, .26, B]], 3: [[146, 67, .22, B], [100, 126, .22, B], [54, 184, .22, B]] },
  "sur-chevron": { 1: [[100, 112, .22]], 3: [[100, 112, .22], [64, 152, .2], [136, 152, .2]] },
  "sur-croix": { 1: [[100, 112, .22]], 5: [[100, 112, .18], [100, 54, .17], [100, 180, .16], [44, 112, .17], [156, 112, .17]] },
  "sur-sautoir": { 1: [[100, 123, .24]], 5: [[100, 123, .2], [56, 68, .18], [144, 68, .18], [56, 178, .18], [144, 178, .18]] },
  pairle: { 3: [[100, 58, .3], [52, 172, .28], [148, 172, .28]] },
  "sur-canton": { 1: [[40, 35, .2]] },
  "sur-franc-quartier": { 1: [[51, 45, .26]] },
};
/* bordure et orle n'ont pas de disposition propre (LAYOUT vide, mais présent : on peut y poser des meubles « autour ») ; ils suivent celles du champ plein (PLEIN) */
for (const p of ["bordure", "orle"]) LAYOUT[p] = {};
const VERBE = { croix: "cantonné", sautoir: "cantonné", pal: "accosté" };
function dispo(ctx, n, g) {
  if (ctx === "fasce" && n === 2) return g === "f" ? ", l'une en chef et l'autre en pointe" : ", l'un en chef et l'autre en pointe";
  if (ctx === "fasce" && n === 6) return ", trois en chef et trois en pointe";
  return "";
}
function dispos(s) {
  const ctx = ctxOf(s);
  if (!PLEINLIKE.has(ctx) || s.nb === "seme") return [];
  return (PLEIN[s.nb] || []).filter(d => ctx === "plein" || !d.plein);
}
const dispoOf = s => { const ds = dispos(s); return ds.find(d => d.id === s.d) || ds[0]; };
const dph = (s, c) => { const d = dispoOf(s); return d ? agree(d.ph, c.g, c.pl) : ""; };
/* réglages graphiques : par groupe (sz, dx, dy ; sz2…) et par meuble (ad = "1.0:120,4,-6|2.1:…") */
const adMap = a => new Map((a.ad || "").split("|").filter(Boolean).map(x => { const [k, v] = x.split(":"); return [k, (v || "").split(",").map(Number)]; }));
const adStr = map => [...map].map(([k, v]) => k + ":" + v.join(",")).join("|");
const dispo2 = s => (PLEIN[s.nb2] || PLEIN[3]).find(d => d.id === s.d2) || (PLEIN[s.nb2] || PLEIN[3])[0];
const arms2 = s => ({ ...s, m: s.m2, nb: s.nb2, tm: s.tm2, ta: s.ta2, ct: s.ct2, cn: s.cn2, iss: "", pos: "autour", p: "" });
/* la brisure : une pièce ou une figure de plus, posée sur les armes pleines (« …, brisé d'un bâton de gueules péri en bande ») ; c'est ce qui distingue un cadet de son aîné.
   Les pièces se dessinent comme les autres (assets/blason.js) ; les figures suivent les dispositions du champ plein, réduites. Le lambel a sa propre entrée. */
const BRIS_PIECES = { bordure: { nom: "Bordure", g: "f", bord: true }, baton: { nom: "Bâton", g: "m", sens: true }, filet: { nom: "Filet", g: "m", sens: true },
  canton: { nom: "Canton", g: "m", bord: true }, "franc-quartier": { nom: "Franc-quartier", g: "m", bord: true },
  lambel: { nom: "Lambel", g: "m", pend: true } };
const BRIS_FIGS = ["croissant", "molette", "merlette", "annelet", "fleurdelis", "rose", "etoile", "roundel", "coquille"];     // les marques de cadence anglaises, puis l'étoile, le besant et la coquille
const LAMBEL_FIGS = [...BRIS_FIGS, "croisette"];                                           // ce que peuvent porter les pendants d'un lambel
const brisPiece = s => (own(BRIS_PIECES, s.br) ? BRIS_PIECES[s.br] : null);
const lambelArms = s => ({ ...s, m: s.lpc, m2: "", nb: s.lpk, tm: s.lpt, ta: s.lpt, ct: "", cn: "", iss: "", d: "", pos: "autour", p: "" });
const brisArms = s => ({ ...s, m: s.br, m2: "", nb: s.brn, tm: s.tbr, ta: s.tbr, ct: "", cn: "", iss: "", d: s.brd, pos: "autour", p: "" });
const count1 = s => { const m = s.m && meuble(s.m); return !m || s.nb === "seme" ? 0 : m.seul ? 1 : +s.nb; };
const count2 = s => s.m && s.m2 ? +s.nb2 : 0;

/* ---------- état : les ornements, jusqu'à quatre armes pour l'écartelé, et un écusson en abîme ---------- */
const ADEF = { f: "plein", t1: "Azur", t2: "Gueules", t3: "Or", part: "parti", ray: "barry", n: "6", p: "", tp: "Or", m: "fleurdelis", nb: "3", pos: "autour", tm: "Or", ta: "Gueules",
  d: "", sz: "100", dx: "0", dy: "0", m2: "", nb2: "3", d2: "chef", tm2: "Argent", ta2: "Gueules", sz2: "100", dx2: "0", dy2: "0", ad: "",
  ct: "", ct2: "", ln: "", pf: "", cn: "", cn2: "", iss: "",
  br: "", tbr: "Argent", sbr: "bande", lbr: "", brn: "1", brd: "", brsz: "100", brdx: "0", brdy: "0",
  lpn: "3", lpc: "", lpt: "Gueules", lpk: "1", lpw: "", pdx: "0", pdy: "0" };       // pdx, pdy : le décalage graphique de la pièce ; le lambel : son nombre de pendants, la figure qu'ils portent, son émail, combien par pendant, et sur lesquels ("" : chacun, « milieu »)       // la brisure : sa sorte, son émail, son sens (bâton, filet), son bord, le nombre et la place de ses figures, et leurs réglages graphiques       // iss : « issant », la moitié haute du meuble sortant de la pointe de l'écu               // cn : l'émail de la couronne que porte le meuble (« lion couronné d'or »), s'il peut en porter une
const ADEFS = [ADEF, { ...ADEF, t1: "Gueules", m: "", p: "croix", tp: "Argent" }, { ...ADEF, t1: "Or", m: "lion", nb: "1", tm: "Gueules", ta: "Azur" }, { ...ADEF, t1: "Argent", m: "", p: "fasce", tp: "Gueules" },
  { ...ADEF, t1: "Or", m: "aigle", nb: "1", tm: "Sable", ta: "Gueules" },       // la cinquième : l'écusson en abîme (« sur le tout »)
  { ...ADEF, t1: "Azur", m: "etoile", nb: "3", tm: "Argent" }, { ...ADEF, t1: "Gueules", m: "", p: "croix", tp: "Argent" },
  { ...ADEF, t1: "Or", m: "lion", nb: "1", tm: "Gueules", ta: "Azur" }, { ...ADEF, t1: "Argent", m: "", p: "fasce", tp: "Gueules" }];      // 5 à 8 : les armes en plus des moitiés d'un parti qui s'écartelle (HALF_ARMS)

/* un parti : deux moitiés (armes 0 et 1), dont chacune peut s'écarteler (h1, h2 : "", "2" pour 1-4 / 2-3, "4" en quatre) ; ses quartiers 2, 3, 4 prennent alors les armes de HALF_ARMS */
const HALF_ARMS = [[0, 2, 3, 5], [1, 6, 7, 8]];
const halfMode = (St, h) => (h ? St.h2 : St.h1);
/* les armes de chaque quartier d'une moitié écartelée, dans l'ordre 1-2-3-4 ; null si la moitié est simple */
const halfQuarters = (St, h) => { const a = HALF_ARMS[h], m = halfMode(St, h); return m === "2" ? [a[0], a[1], a[1], a[0]] : m === "4" ? a.slice() : null; };
const halfUsed = (St, h) => { const a = HALF_ARMS[h], m = halfMode(St, h); return m === "2" ? a.slice(0, 2) : m === "4" ? a.slice() : [a[0]]; };
const active = St => (!St.q ? [0] : St.q === "2" ? [0, 1] : St.q === "p" ? [...halfUsed(St, 0), ...halfUsed(St, 1)] : [0, 1, 2, 3]).concat(St.ab ? [4] : []);
const meuble = k => ATL.meubles.find(m => m.kind === k);
/* « sous » : les meubles sont sur le champ, la pièce brochant sur le tout (ils suivent alors les dispositions du champ plein) */
function ctxOf(s) { return s.p ? (s.pos === "sur" ? "sur-" + s.p : s.pos === "sous" ? "plein" : s.p) : "plein"; }
function countsFor(s) {
  const m = meuble(s.m);
  if (!m) return [];
  if (m.seul) return ["1"];
  const ctx = ctxOf(s);
  const ns = PLEINLIKE.has(ctx) ? Object.keys(PLEIN).filter(n => ctx === "plein" || PLEIN[n].some(d => !d.plein)) : Object.keys(LAYOUT[ctx] || {});
  return s.f === "plein" && s.pos !== "sur" && s.pos !== "sous" ? [...ns, "seme"] : ns;
}
const num = (v, lo, hi, d) => { const n = Math.round(+v); return String(Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d); };
function normalize(s) {
  /* l'ancien lambel-meuble (des adresses déjà partagées) est devenu la brisure */
  if (s.m === "lambel" || s.m2 === "lambel") {
    if (!s.br) Object.assign(s, { br: "lambel", tbr: s.m === "lambel" ? s.tm : s.tm2 });
    if (s.m === "lambel") s.m = ""; else s.m2 = "";
  }
  /* l'adresse de la page peut porter n'importe quoi : chaque valeur est ramenée à une valeur permise (own : pas de noms hérités, comme « constructor ») */
  for (const k of ["t1", "t2", "t3", "tp", "tm", "ta", "tm2", "ta2"]) if (!own(MOT, s[k])) s[k] = ADEF[k];
  if (!["plein", "part", "ray"].includes(s.f)) s.f = "plein";
  if (!RAYS.includes(s.ray)) s.ray = "barry";
  if (!rayNs(s.ray).includes(s.n)) s.n = ADEF.n;                                    // pair : « fascé de six pièces » ; impair : des pièces rebattues (5, 7, 9… : deux, trois, quatre pals, fasces…)
  if (s.pos !== "sur" && s.pos !== "sous") s.pos = "autour";
  if (!own(PLEIN, s.nb) && s.nb !== "seme") s.nb = ADEF.nb;
  if (!DATA.partitions.some(p => p.kind === s.part)) s.part = "parti";
  if (s.p && !own(PIECES, s.p)) s.p = "";
  if (s.m && !meuble(s.m)) s.m = "";
  if (!s.p || !s.m || s.nb === "seme" || !BRO_OK.has(s.p)) { if (s.pos === "sous") s.pos = "autour"; }
  if (!s.p) s.pos = "autour";
  if (s.p && s.pos === "sur" && !LAYOUT["sur-" + s.p]) s.pos = "autour";
  if (s.m && s.p && s.pos === "autour" && !LAYOUT[s.p]) s.pos = BRO_OK.has(s.p) && s.nb !== "seme" ? "sous" : "sur";
  const cs = countsFor(s);
  if (s.m && !cs.includes(s.nb)) s.nb = cs.includes("3") ? "3" : cs[0];
  if (!dispos(s).some(d => d.id === s.d)) s.d = "";
  if (!s.m || (s.m2 && !meuble(s.m2))) s.m2 = "";
  /* le bord de la pièce ; le sens des meubles (seuls les meubles asymétriques se contournent) */
  if (!s.p || !own(CONTOUR_NOM, s.ln) || (s.ln === "alesee" && !ALESEE_OK.has(s.p))) s.ln = "";
  if (!s.p || s.p === "bordure" || s.p === "orle" || !own(MOT, s.pf)) s.pf = "";                  // le filet : « la croix de gueules bordée d'argent »
  const mm = s.m && meuble(s.m), mm2 = s.m2 && meuble(s.m2);
  s.cn = mm && mm.couronne && own(MOT, s.cn) ? s.cn : "";
  s.cn2 = mm2 && mm2.couronne && own(MOT, s.cn2) ? s.cn2 : "";
  s.iss = mm && !mm.seul && (s.iss === "1" || s.iss === "t") && s.nb === "1" && !s.p ? s.iss : "";               // un seul meuble, sans pièce ; « t » : demi-meuble mouvant du trait du parti (voir normalizeAll)
  s.ct = mm && mm.asym && s.ct === "1" ? "1" : "";
  s.ct2 = mm2 && mm2.asym && s.ct2 === "1" ? "1" : "";
  /* la brisure : une pièce ou une marque de la liste, son émail ; le sens ne vaut que pour le bâton et le filet, le bord que pour les pièces qui en ont un, le nombre et la place que pour les figures */
  if (s.br && !own(BRIS_PIECES, s.br) && !(BRIS_FIGS.includes(s.br) && meuble(s.br))) s.br = "";
  if (!own(MOT, s.tbr)) s.tbr = ADEF.tbr;
  const bp = brisPiece(s);
  s.sbr = bp && bp.sens && s.sbr === "barre" ? "barre" : "bande";
  s.lbr = bp && bp.bord && own(CONTOUR_NOM, s.lbr) && s.lbr !== "alesee" ? s.lbr : "";
  if (!BRIS_FIGS.includes(s.br)) { s.brn = "1"; s.brd = ""; }
  else {
    if (!["1", "2", "3"].includes(s.brn)) s.brn = "1";
    if (!dispos(brisArms(s)).some(d => d.id === s.brd)) s.brd = "";
  }
  const lam = s.br === "lambel";
  s.lpn = lam && ["2", "3", "4", "5", "6"].includes(s.lpn) ? s.lpn : "3";
  if (!lam || !LAMBEL_FIGS.includes(s.lpc) || !meuble(s.lpc)) s.lpc = "";
  s.lpk = s.lpc && ["1", "2", "3"].includes(s.lpk) ? s.lpk : "1";
  s.lpw = s.lpc && s.lpw === "milieu" && +s.lpn % 2 ? "milieu" : "";
  if (!s.lpc || !own(MOT, s.lpt)) s.lpt = ADEF.lpt;
  s.brsz = num(s.brsz, 30, 250, 100); s.brdx = num(s.brdx, -80, 80, 0); s.brdy = num(s.brdy, -80, 80, 0);
  s.pdx = s.p ? num(s.pdx, -80, 80, 0) : "0"; s.pdy = s.p ? num(s.pdy, -80, 80, 0) : "0";
  if (!own(PLEIN, s.nb2)) s.nb2 = "3";
  if (!PLEIN[s.nb2].some(d => d.id === s.d2)) s.d2 = "";
  for (const x of ["", "2"]) { s["sz" + x] = num(s["sz" + x], 30, 200, 100); s["dx" + x] = num(s["dx" + x], -60, 60, 0); s["dy" + x] = num(s["dy" + x], -60, 60, 0); }
  const map = adMap(s), n1 = count1(s), n2 = count2(s);
  for (const [k, v] of map) {
    const [g, i] = k.split(".").map(Number);
    if (!(g === 1 && i < n1 || g === 2 && i < n2) || v.length !== 3 || v.some(x => !Number.isFinite(x))) map.delete(k);
    else map.set(k, [+num(v[0], 30, 200, 100), +num(v[1], -60, 60, 0), +num(v[2], -60, 60, 0)]);
  }
  s.ad = adStr(map);
  return s;
}

/* ce que des armes montrent et disent : les champs sans objet (l'émail d'un second champ qui n'existe pas) et les réglages graphiques
   n'y figurent pas. Sert à comparer deux compositions : le lecteur de blasonnement (assets/lecture.js) et les tests */
function canon(a) {
  const o = { f: a.f }, m = a.m && meuble(a.m), m2 = m && a.m2 && meuble(a.m2);
  if (a.f === "plein") o.t1 = a.t1;
  else if (a.f === "part") { Object.assign(o, { part: a.part, t1: a.t1, t2: a.t2 }); if (a.part.startsWith("tierce")) o.t3 = a.t3; }
  else Object.assign(o, { ray: a.ray, ...(a.ray.startsWith("lozengy") ? {} : { n: a.n }), t1: a.t1, t2: a.t2 });
  if (a.p) Object.assign(o, { p: a.p, tp: a.tp, ln: a.ln, pf: a.pf });
  if (m) {
    Object.assign(o, { m: a.m, nb: a.nb, tm: a.tm });
    if (a.p) o.pos = a.pos;
    if (m.accent) o.ta = a.ta;
    if (m.asym) o.ct = a.ct;
    if (m.couronne) o.cn = a.cn;
    if (a.iss) o.iss = a.iss;
    if (dispos(a).length) o.d = a.d;
  }
  if (m2) {
    Object.assign(o, { m2: a.m2, nb2: a.nb2, d2: a.d2, tm2: a.tm2 });
    if (m2.accent) o.ta2 = a.ta2;
    if (m2.asym) o.ct2 = a.ct2;
    if (m2.couronne) o.cn2 = a.cn2;
  }
  if (a.br) {
    Object.assign(o, { br: a.br, tbr: a.tbr });
    const bp = brisPiece(a);
    if (bp && bp.sens) o.sbr = a.sbr;
    if (bp && bp.bord) o.lbr = a.lbr;
    if (bp && bp.pend) { Object.assign(o, { lpn: a.lpn, lpc: a.lpc }); if (a.lpc) Object.assign(o, { lpt: a.lpt, lpk: a.lpk, lpw: a.lpw }); }
    if (!bp) Object.assign(o, { brn: a.brn, brd: a.brd });
  }
  return o;
}
const canonAll = St => ({ q: St.q, ab: St.ab, h1: St.h1 || "", h2: St.h2 || "", A: active(St).map(i => canon(St.A[i])) });

/* ---------- le blasonnement ---------- */
/* l'attribut d'un meuble (« armé et lampassé d'azur ») ne se dit que s'il change quelque chose : de l'émail du corps, on se tait.
   Ceux qui sont un trait du dessin (« couronné », « incensé », « dans des flammes »…) se disent toujours */
const accentDit = (m, s) => !!(m.accent && m.accentMot && (m.accentFixe || m.accentTrait || s.ta !== s.tm));
function charges(s) {
  const m = meuble(s.m), seme = s.nb === "seme", n = seme ? 0 : +s.nb, pl = seme || n > 1;
  let nom = m.sing, nomPl = m.plur, g = m.g;
  if (m.kind === "roundel") { const metal = classe(s.tm) === "Métal"; nom = metal ? "besant" : "tourteau"; nomPl = metal ? "besants" : "tourteaux"; g = "m"; }
  if (s.iss === "t") nom = "demi-" + nom;
  /* la couronne : de l'émail du meuble, elle se dit devant lui (« un lion couronné d'or ») ; d'un autre, après l'attribut (« … armé et lampassé de gueules couronné d'argent ») */
  const couronne = s.cn ? " " + agree("couronné", g, pl) : "", mem = s.cn && s.cn === s.tm;
  const acc = (accentDit(m, s) ? " " + (m.accentFixe ? m.accentMot : agree(m.accentMot, g, pl)) + " " + de(s.ta) : "") + (s.cn && !mem ? couronne + " " + de(s.cn) : "");
  const ctr = (s.iss === "1" ? (g === "f" ? " issante" : " issant") : "") + (s.ct ? " " + agree("contourné", g, pl) : "") + (mem ? couronne : "");   // « un lion contourné d'or », « trois lions contournés couronnés d'or »
  return { m, n, pl, nom, nomPl, g, acc, ctr, mv: s.iss === "t" ? " mouvant du trait du parti" : "", tinct: de(s.tm) };
}
function semePhrase(c, s) {
  const m = c.m;
  if (m.kind === "roundel") return (classe(s.tm) === "Métal" ? "besanté " : "tourteauté ") + de(s.tm);
  if (m.semeAdj) return m.semeAdj + " " + de(s.tm);
  return `semé de ${c.nomPl}${c.ctr} ${c.tinct}${c.acc}`;                       // « semé de lions d'or armés et lampassés de gueules »
}
function blazonCore(s) {
  let champ;
  if (s.f === "part") {
    const p = DATA.partitions.find(x => x.kind === s.part);
    champ = s.part.startsWith("tierce") ? `${p.nom} ${de(s.t1)}, ${de(s.t2)} et ${de(s.t3)}` : `${p.nom} ${de(s.t1)} et ${de(s.t2)}`;
  } else if (s.f === "ray") {
    champ = rayTexte(s);
  } else champ = cap(de(s.t1));
  const parti = s.f !== "plein";
  const m = s.m && meuble(s.m);
  const c = m ? charges(s) : null;
  const seme = c && s.nb === "seme";
  if (seme) champ += " " + semePhrase(c, s);
  const groupe = c && !seme ? (c.n === 1 ? `${aArt(c.nom, c.g)}${c.nom}` : `à ${NB[c.n]} ${c.nomPl}`) + `${c.ctr} ${c.tinct}${c.acc}${c.mv}` : "";
  const grpObj = c && !seme ? (c.n === 1 ? `${c.g === "f" ? "d'une" : "d'un"} ${c.nom}` : `de ${NB[c.n]} ${c.nomPl}`) + `${c.ctr} ${c.tinct}${c.acc}` : "";
  /* le second meuble : « accompagné de … », « et de … », ou meuble du champ quand le premier est sur la pièce ou semé */
  let x2 = null;
  if (c && count2(s)) {
    const c2 = charges(arms2(s)), ph = agree(dispo2(s).ph, c2.g, c2.pl);
    const obj = (c2.n === 1 ? `${c2.g === "f" ? "d'une" : "d'un"} ${c2.nom}` : `de ${NB[c2.n]} ${c2.nomPl}`) + `${c2.ctr} ${c2.tinct}${c2.acc}${ph}`;
    const alone = (c2.n === 1 ? `${aArt(c2.nom, c2.g)}${c2.nom}` : `à ${NB[c2.n]} ${c2.nomPl}`) + `${c2.ctr} ${c2.tinct}${c2.acc}${ph}`;
    x2 = { obj, alone, acc: `, ${agree("accompagné", c.g, c.pl)} ${obj}` };
  }
  if (!s.p) {
    if (!c) return champ + (parti ? "" : " plein");
    if (seme) return champ + (x2 ? ", " + x2.alone : "");
    return `${champ}${parti ? "," : ""} ${groupe}${dph(s, c)}${parti && c.n === 1 ? " brochant sur le tout" : ""}${x2 ? x2.acc : ""}`;
  }
  const P = PIECES[s.p], pnom = s.p;
  const bord = s.ln ? " " + agree(CONTOUR_NOM[s.ln], P.g, false) : "";                // « la fasce ondée », « le chef denché »
  const filet = s.pf ? ` ${agree("bordé", P.g, false)} ${de(s.pf)}` : "";                       // « la croix de gueules bordée d'argent »
  const pieceTxt = `${aArt(pnom, P.g)}${pnom}${bord} ${de(s.tp)}${filet}`;
  const broche = parti && !["chef", "bordure", "orle", "canton", "franc-quartier"].includes(s.p) ? " brochant sur le tout" : "";
  if (c && !seme && s.pos === "sous") return `${champ}${parti ? "," : ""} ${groupe}${dph(s, c)}${x2 ? x2.acc : ""}, ${pieceTxt} brochant sur le tout`;
  const sep = parti || seme ? ", " : " ";
  const lead = x2 && (seme || s.pos === "sur") ? `${parti || seme ? "," : ""} ${x2.alone}, ` : sep;
  if (c && !seme && s.pos === "sur") {
    const charge = agree("chargé", P.g, false);
    return `${champ}${lead}${pieceTxt}${broche ? broche + "," : ""} ${charge} ${grpObj}`;
  }
  if (c && !seme && (s.p === "chef" || s.p === "bordure" || s.p === "orle"))
    return `${champ}${parti ? "," : ""} ${groupe}${s.p === "chef" ? "" : dph(s, c)}${x2 ? x2.acc : ""}, ${pieceTxt}`;
  if (c && !seme) {
    const v = agree(VERBE[s.p] || "accompagné", P.g, false);
    return `${champ}${sep}${pieceTxt}${broche ? broche + "," : ""} ${v} ${grpObj}${dispo(s.p, c.n, c.g)}${x2 ? " et " + x2.obj : ""}`;
  }
  return `${champ}${lead}${pieceTxt}${broche}`;
}
/* « d'un lambel d'argent » · « d'un lambel d'argent à cinq pendants chargé sur chaque pendant d'un besant de gueules » */
function lambelTxt(s) {
  let t = `d'un lambel ${de(s.tbr)}${s.lpn !== "3" ? ` à ${NB[+s.lpn]} pendants` : ""}`;
  if (s.lpc) {
    const c = charges(lambelArms(s));
    t += ` chargé ${s.lpw === "milieu" ? "sur le pendant du milieu" : "sur chaque pendant"} ${c.n === 1 ? (c.g === "f" ? "d'une" : "d'un") + " " + c.nom : "de " + NB[c.n] + " " + c.nomPl}${c.ctr} ${c.tinct}${c.acc}`;
  }
  return t;
}
/* la brisure, dite après les armes pleines : « brisé d'un bâton de gueules péri en bande », « brisé d'un croissant d'argent en chef » */
function brisTxt(s) {
  const bp = brisPiece(s), t = de(s.tbr);
  if (bp && bp.pend) return lambelTxt(s);
  if (bp) {
    const bord = s.lbr ? " " + agree(CONTOUR_NOM[s.lbr], bp.g, false) : "";
    return `${bp.g === "f" ? "d'une" : "d'un"} ${s.br === "baton" ? "bâton" : s.br}${bord} ${t}` + (s.br === "baton" ? ` péri en ${s.sbr}` : s.br === "filet" ? ` en ${s.sbr}` : "");
  }
  const arms = brisArms(s), c = charges(arms);
  return `${c.n === 1 ? (c.g === "f" ? "d'une" : "d'un") + " " + c.nom : "de " + NB[c.n] + " " + c.nomPl}${c.ctr} ${c.tinct}${c.acc}${dph(arms, c)}`;
}
const blazon = s => blazonCore(s) + (s.br ? ", brisé " + brisTxt(s) : "");
const QLAB = { 2: ["aux 1 et 4", "aux 2 et 3"], 4: ["au 1", "au 2", "au 3", "au 4"] };
const QNAME = { 2: ["Quartiers 1 et 4", "Quartiers 2 et 3"], 4: ["Quartier 1", "Quartier 2", "Quartier 3", "Quartier 4"] };
/* les armes que l'on peut modifier (hors écusson), avec leur nom */
function cellNames(St) {
  if (St.q !== "p") return St.q ? QNAME[St.q].map((l, i) => [i, l]) : [];
  return [0, 1].flatMap(h => {
    const nom = h ? "senestre" : "dextre", m = halfMode(St, h), a = HALF_ARMS[h];
    return m === "2" ? [[a[0], `Moitié ${nom} : quartiers 1 et 4`], [a[1], `Moitié ${nom} : quartiers 2 et 3`]]
      : m === "4" ? a.map((i, n) => [i, `Moitié ${nom} : quartier ${n + 1}`]) : [[a[0], `Moitié ${nom} (${h + 1})`]];
  });
}
function blazonAll(St) {
  const lo = b => b.charAt(0).toLowerCase() + b.slice(1);
  let b;
  if (!St.q) b = blazon(St.A[0]);
  else if (St.q === "p") {
    /* chaque moitié : des armes, ou un écartelé « écartelé : aux 1 et 4, … ; aux 2 et 3, … » (les quartiers se disent alors avant la moitié suivante) */
    const moitie = h => {
      const m = halfMode(St, h), a = HALF_ARMS[h];
      if (!m) return lo(blazon(St.A[a[0]]));
      const labs = m === "2" ? QLAB[2] : QLAB[4];
      return "écartelé : " + halfUsed(St, h).map((i, n) => `${labs[n]}, ${lo(blazon(St.A[i]))}`).join(" ; ");
    };
    b = `Parti : au 1, ${moitie(0)} ; au 2, ${moitie(1)}`;
  } else b = "Écartelé : " + active(St).filter(i => i < 4).map(i => `${QLAB[St.q][i]}, ${lo(blazon(St.A[i]))}`).join(" ; ");
  if (St.ab) b += (St.q ? " ; " : ", ") + "sur le tout " + lo(blazon(St.A[4]));            // l'écusson en abîme
  return b;
}
