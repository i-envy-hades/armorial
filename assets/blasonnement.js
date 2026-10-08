/* L'ARMORIAL — le modèle des armes : grammaire, état d'une composition et blasonnement.
   Ni DOM ni dessin : ce fichier sert à l'Atelier (assets/atelier.js) comme au lecteur de blasonnement
   (assets/lecture.js), qui en est l'inverse. Il lit les globaux DATA (data/data.json) et ATL (data/atelier.json),
   que la page qui le charge remplit. */
let DATA, ATL;

/* ---------- grammaire ---------- */
const MOT = { Or: "or", Argent: "argent", Gueules: "gueules", Azur: "azur", Sable: "sable", Sinople: "sinople", Pourpre: "pourpre", Hermine: "hermine", Vair: "vair" };
/* h aspiré : « la hache », « le heaume », non « l'hache » */
const H_ASPIRE = /^(hach|harp|heaum|hériss|héron|hibou|hure|huchet|hamaïde|hallebard|hampe|houx|hêtre)/i;
const voy = w => /^[aeiouyhéèêâîôûœ]/i.test(w) && !H_ASPIRE.test(w);
const de = t => (voy(MOT[t]) ? "d'" : "de ") + MOT[t];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const NB = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize"];
const art = (w, g) => voy(w) ? "l'" : g === "f" ? "la " : "le ";
const aArt = (w, g) => (typeof ATL !== "undefined" && ATL && ATL.meubles.some(m => m.pluriel && m.sing === w)) ? "aux " : voy(w) ? "à l'" : g === "f" ? "à la " : "au ";
/* accorde les participes en -é : « armé et lampassé » → « armées et lampassées » */
const agree = (phrase, g, pl) => phrase.replace(/(é|ouvert|garni)(?=[\s,]|$)/g, (x, w) => w + (g === "f" ? "e" : "") + (pl ? "s" : ""));         // « ouvert » : la grenade ouverte
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
      { id: "cs", lab: "Au canton senestre du chef", ph: " au canton senestre du chef", pts: [[146, 54, .38]] },
      { id: "barre", lab: "En barre", ph: " posé en barre", pts: [[100, 118, 1, 45]] },
      { id: "bande", lab: "En bande", ph: " posé en bande", pts: [[100, 118, 1, -45]] },
      { id: "fasce", lab: "En fasce", ph: " posé en fasce", pts: [[100, 118, 1, -90]] }],
  2: [{ id: "", lab: "En fasce", ph: " posé en fasce", pts: [[62, 112, .5], [138, 112, .5]] },
      { id: "pal", lab: "En pal", ph: " posé en pal", alt: L_PAL, pts: [[100, 70, .42], [100, 170, .42]] },
      { id: "bande", lab: "En bande", ph: " posé en bande", pts: [[62, 74, .4], [138, 164, .4]] },
      { id: "barre", lab: "En barre", ph: " posé en barre", pts: [[138, 74, .4], [62, 164, .4]] },
      { id: "chef", lab: "En chef", ph: " rangé en chef", pts: [[64, 58, .36], [136, 58, .36]] },
      { id: "sautoir", lab: "Passés en sautoir", ph: " passé en sautoir", alt: [" posé en sautoir"], pts: [[100, 118, .85, 40], [100, 118, .85, -40]] }],
  3: [{ id: "", lab: "2 et 1", ph: "", alt: [" posé 2 et 1"], pts: [[62, 80, .46], [138, 80, .46], [100, 168, .46]] },
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
      { id: "orle", lab: "En orle", ph: " en orle", alt: [" posé en orle"], plein: true, pts: [[34, 84, .19], [166, 84, .19], [46, 152, .19], [154, 152, .19], [100, 206, .19]] },
      { id: "221", lab: "2, 2 et 1", ph: " posé 2, 2 et 1", pts: [[64, 62, .3], [136, 62, .3], [64, 128, .3], [136, 128, .3], [100, 192, .3]] },
      { id: "pal", lab: "En pal", ph: " posé en pal", alt: L_PAL, pts: [[100, 40, .19], [100, 83, .19], [100, 126, .19], [100, 169, .18], [100, 210, .16]] }],
  6: [{ id: "", lab: "3, 2 et 1", ph: " posé 3, 2 et 1", pts: [[48, 62, .3], [100, 62, .3], [152, 62, .3], [72, 120, .3], [128, 120, .3], [100, 180, .3]] },
      { id: "222", lab: "2, 2 et 2", ph: " posé 2, 2 et 2", pts: [[62, 60, .3], [138, 60, .3], [62, 124, .3], [138, 124, .3], [66, 186, .26], [134, 186, .26]] },
      { id: "33", lab: "3 et 3", ph: " posé 3 et 3", pts: [[48, 78, .28], [100, 78, .28], [152, 78, .28], [48, 154, .28], [100, 154, .28], [152, 154, .28]] },
      { id: "orle", lab: "En orle", ph: " en orle", plein: true, pts: [[48, 52, .2], [152, 52, .2], [34, 122, .2], [166, 122, .2], [58, 190, .2], [142, 190, .2]] }],
  7: [{ id: "", lab: "3, 3 et 1", ph: " posé 3, 3 et 1", pts: [[48, 62, .27], [100, 62, .27], [152, 62, .27], [48, 124, .27], [100, 124, .27], [152, 124, .27], [100, 186, .27]] },
      { id: "43", lab: "4 et 3", ph: " posé 4 et 3", pts: [[34, 84, .23], [78, 84, .23], [122, 84, .23], [166, 84, .23], [56, 152, .23], [100, 152, .23], [144, 152, .23]] },
      { id: "bande", lab: "En bande", ph: " posé en bande", pts: [[34, 44, .17], [56, 71, .17], [78, 99, .17], [100, 126, .17], [122, 153, .17], [144, 181, .17], [166, 208, .17]] }],
  8: [{ id: "", lab: "En orle", ph: " en orle", plein: true, pts: [[42, 46, .18], [100, 38, .18], [158, 46, .18], [34, 112, .18], [166, 112, .18], [46, 176, .18], [154, 176, .18], [100, 218, .18]] }],
  9: [{ id: "", lab: "3, 3 et 3", ph: " posé 3, 3 et 3", alt: [" posé en trois pals"], pts: [[48, 62, .26], [100, 62, .26], [152, 62, .26], [48, 124, .26], [100, 124, .26], [152, 124, .26], [56, 186, .26], [100, 186, .26], [144, 186, .26]] }],
  10: [{ id: "", lab: "4, 3, 2 et 1", ph: " posé 4, 3, 2 et 1", pts: [[40, 52, .2], [80, 52, .2], [120, 52, .2], [160, 52, .2], [60, 104, .2], [100, 104, .2], [140, 104, .2], [80, 156, .2], [120, 156, .2], [100, 206, .2]] },
       { id: "orle", lab: "En orle", ph: " en orle", plein: true, pts: [[46, 46, .17], [100, 38, .17], [154, 46, .17], [34, 96, .17], [166, 96, .17], [34, 150, .17], [166, 150, .17], [66, 196, .17], [134, 196, .17], [100, 222, .17]] }],
  12: [{ id: "", lab: "4, 4 et 4", ph: " posé 4, 4 et 4", pts: [[40, 62, .17], [80, 62, .17], [120, 62, .17], [160, 62, .17], [40, 120, .17], [80, 120, .17], [120, 120, .17], [160, 120, .17], [58, 178, .17], [86, 178, .17], [114, 178, .17], [142, 178, .17]] },
       { id: "orle", lab: "En orle", ph: " en orle", plein: true, pts: [[46, 46, .15], [100, 38, .15], [154, 46, .15], [34, 86, .15], [166, 86, .15], [32, 126, .15], [168, 126, .15], [40, 166, .15], [160, 166, .15], [64, 198, .15], [136, 198, .15], [100, 222, .15]] }],
  /* les treize étoiles du Valais : trois pals, celui du milieu sur le trait du parti */
  13: [{ id: "", lab: "En trois pals, 4, 5 et 4", ph: " posé en trois pals 4, 5 et 4", alt: [" posé 4, 5 et 4"], pts: [[52, 50, .21], [52, 96, .21], [52, 142, .21], [58, 188, .21], [100, 42, .19], [100, 86, .19], [100, 130, .19], [100, 174, .19], [100, 216, .19], [148, 50, .21], [148, 96, .21], [148, 142, .21], [142, 188, .21]] }],
};
/* la pièce que répètent les rayures (palé → pal…), pour dire « à trois pals » quand le nombre de zones est impair */
const RAY_PIECE = { barry: "fasce", barryonde: "fasce", paly: "pal", bendy: "bande", bendysin: "barre", chevronny: "chevron" };
/* les champs rayés : les quatre sens du trait, les chevrons, l'échiqueté (n = nombre de tires) et le fuselé (trois sens) */
const RAYS = ["barry", "barryonde", "paly", "bendy", "bendysin", "chevronny", "chequy", "lozengy", "lozengybend", "lozengysin"];
const RAY_BANDES = ["4", "5", "6", "7", "8", "9", "10", "11", "12", "13"], RAY_TIRES = ["3", "4", "5", "6", "7", "8"];
const rayNs = ray => ray === "chequy" ? RAY_TIRES : ray.startsWith("lozengy") ? ["6"] : ray === "barryonde" ? ["4", "5", "6", "7", "8", "9"] : RAY_BANDES;          // le fascé ondé : un nombre pair de pièces
/* à partir de dix pièces, les pièces diminuées changent de nom (burelé, vergeté, coticé) ; le nombre par défaut est six, ou dix pour ces noms-là */
const RAY_NOM = { barry: ["Fascé", "Burelé"], barryonde: ["Fascé ondé", "Fascé ondé"], paly: ["Palé", "Vergeté"], bendy: ["Bandé", "Coticé"], bendysin: ["Barré", "Coticé en barre"], chevronny: ["Chevronné", "Chevronné"] };
function rayTexte(s) {
  const n = +s.n, ems = `${de(s.t1)} et ${de(s.t2)}`;
  if (s.ray === "chequy") return `Échiqueté ${ems}${n === 6 ? "" : ` de ${NB[n]} tires`}`;
  if (s.ray.startsWith("lozengy")) return `Fuselé${{ lozengybend: " en bande", lozengysin: " en barre" }[s.ray] || ""} ${ems}`;
  /* un nombre impair de zones laisse aux deux bords l'émail du champ : ce sont des pièces rebattues, « d'or à trois pals de gueules » */
  if (n % 2) return `${cap(de(s.t1))} à ${NB[(n - 1) / 2]} ${RAY_PIECE[s.ray]}s${s.ray === "barryonde" ? " ondées" : ""} ${de(s.t2)}`;
  const [petit, grand] = RAY_NOM[s.ray];
  return `${n >= 10 ? grand : petit} ${ems}${n === 6 || (n === 10 && s.ray !== "chevronny") ? "" : ` de ${NB[n]} pièces`}`;
}
const PLEINLIKE = new Set(["plein", "bordure", "orle"]);
const LAYOUT = {
  chef: { 1: [[100, 160, .56]], 2: [[64, 152, .4], [136, 152, .4]], 3: [[62, 126, .32], [138, 126, .32], [100, 194, .32]] },
  fasce: { 2: [[100, 56, .38], [100, 200, .32]], 3: [[62, 56, .22], [138, 56, .22], [100, 200, .2]],
           6: [[46, 54, .24], [100, 54, .24], [154, 54, .24], [68, 194, .2], [100, 194, .2], [132, 194, .2]] },
  pal: { 2: [[46, 118, .34], [154, 118, .34]] },
  bande: { 2: [[146, 66, .36], [56, 178, .34]], 6: [[93, 38, .22], [125, 79, .22], [157, 120, .22], [113, 220, .22], [81, 179, .22], [49, 139, .22]] },
  cotice: { 2: [[146, 66, .3], [56, 178, .28]] },                                  // trop étroite pour porter des meubles : ils l'accompagnent
  barre: { 2: [[54, 66, .36], [144, 178, .34]], 6: [[107, 38, .22], [75, 79, .22], [43, 120, .22], [87, 220, .22], [119, 179, .22], [151, 139, .22]] },
  chevron: { 3: [[58, 70, .36], [142, 70, .36], [100, 200, .3]] },
  croix: { 4: [[49, 54, .28], [151, 54, .28], [54, 166, .26], [146, 166, .26]] },
  sautoir: { 4: [[100, 48, .28], [42, 124, .28], [158, 124, .28], [100, 210, .22]] },
  "fasce-cp": { 1: [[100, 62, .4]], 2: [[64, 62, .32], [136, 62, .32]], 3: [[50, 62, .26], [100, 62, .26], [150, 62, .26]] },     // « accompagnée en chef de …» (cp) : les premiers meubles au-dessus de la fasce
  "sur-chef": { 1: [[100, 52, .36]], 2: [[66, 52, .33], [134, 52, .33]], 3: [[50, 52, .3], [100, 52, .3], [150, 52, .3]] },
  "sur-fasce": { 1: [[100, 130, .38]], 3: [[50, 130, .3], [100, 130, .3], [150, 130, .3]] },
  "sur-pal": { 1: [[100, 120, .32]], 3: [[100, 60, .28], [100, 128, .28], [100, 196, .25]] },
  "sur-bande": { 1: [[100, 126, .3, -B]], 3: [[56, 70, .26, -B], [100, 126, .26, -B], [144, 182, .26, -B]] },
  "sur-barre": { 1: [[100, 126, .3, B]], 3: [[144, 70, .26, B], [100, 126, .26, B], [56, 182, .26, B]] },
  "sur-chevron": { 1: [[100, 112, .22]], 3: [[100, 112, .22], [64, 152, .2], [136, 152, .2]] },
  "sur-croix": { 1: [[100, 112, .22]], 5: [[100, 112, .18], [100, 54, .17], [100, 180, .16], [44, 112, .17], [156, 112, .17]] },
  "sur-sautoir": { 1: [[100, 123, .24]], 5: [[100, 123, .2], [56, 68, .18], [144, 68, .18], [56, 178, .18], [144, 178, .18]] },
  pairle: { 3: [[100, 58, .3], [52, 172, .28], [148, 172, .28]] },
  "sur-canton": { 1: [[40, 35, .2]] },
  "sur-franc-quartier": { 1: [[51, 45, .26]] },
};
/* bordure et orle n'ont pas de disposition propre (LAYOUT vide, mais présent : on peut y poser des meubles « autour ») ; ils suivent celles du champ plein (PLEIN) */
for (const p of ["bordure", "orle"]) LAYOUT[p] = {};
/* « … et en pointe de … » (cp) : les seconds meubles sous la fasce (Galicie-Lodomérie : un choucas en chef, trois couronnes en pointe) */
const CP_POINTE = { 1: [[100, 192, .34]], 2: [[70, 186, .28], [130, 186, .28]], 3: [[66, 176, .27], [134, 176, .27], [100, 212, .24]] };
const VERBE = { croix: "cantonné", sautoir: "cantonné", pal: "accosté" };
function dispo(ctx, n, g) {
  if (ctx === "fasce" && n === 2) return g === "f" ? ", l'une en chef et l'autre en pointe" : ", l'un en chef et l'autre en pointe";
  if ((ctx === "fasce" || ctx === "bande" || ctx === "barre") && n === 6) return ", trois en chef et trois en pointe";
  return "";
}
/* deux ou trois lions ou léopards passants se posent l'un sur l'autre sans qu'on le dise ; « posés 2 et 1 » se dit (id « base ») */
const palParDefaut = s => { const m = s.m && meuble(s.m); return !!(m && m.palDefaut && (s.nb === "2" || s.nb === "3")); };
function dispos(s) {
  const ctx = ctxOf(s);
  if (!PLEINLIKE.has(ctx) || s.nb === "seme") return [];
  const ds = (PLEIN[s.nb] || []).filter(d => ctx === "plein" || !d.plein), pal = palParDefaut(s) && ds.find(d => d.id === "pal");
  return pal ? [{ ...pal, id: "", ph: "", pal: true }, ...ds.filter(d => d !== pal).map(d => d.id === "" ? { ...d, id: "base", ph: d.ph || " posé 2 et 1" } : d)] : ds;
}
const dispoOf = s => { const ds = dispos(s); return ds.find(d => d.id === s.d) || ds[0]; };
const dph = (s, c) => { const d = dispoOf(s); return d ? agree(d.ph, c.g, c.pl) : ""; };
/* réglages graphiques : par groupe (sz, dx, dy ; sz2…) et par meuble (ad = "1.0:120,4,-6|2.1:…") */
const adMap = a => new Map((a.ad || "").split("|").filter(Boolean).map(x => { const [k, v] = x.split(":"); return [k, (v || "").split(",").map(Number)]; }));
const adStr = map => [...map].map(([k, v]) => k + ":" + v.join(",")).join("|");
const dispo2 = s => (PLEIN[s.nb2] || PLEIN[3]).find(d => d.id === s.d2) || (PLEIN[s.nb2] || PLEIN[3])[0];
const arms2 = s => ({ ...s, m: s.m2, nb: s.nb2, tm: s.tm2, ta: s.ta2, ct: s.ct2, cn: s.cn2, iss: "", cc: "", pos: "autour", p: "" });
/* la brisure : une pièce ou une figure de plus, posée sur les armes pleines (« …, brisé d'un bâton de gueules péri en bande ») ; c'est ce qui distingue un cadet de son aîné.
   Les pièces se dessinent comme les autres (assets/blason.js) ; les figures suivent les dispositions du champ plein, réduites. Le lambel a sa propre entrée. */
const BRIS_PIECES = { bordure: { nom: "Bordure", g: "f", bord: true }, baton: { nom: "Bâton", g: "m", sens: true }, filet: { nom: "Filet", g: "m", sens: true },
  canton: { nom: "Canton", g: "m", bord: true }, "franc-quartier": { nom: "Franc-quartier", g: "m", bord: true },
  lambel: { nom: "Lambel", g: "m", pend: true } };
const BRIS_FIGS = ["croissant", "molette", "merlette", "annelet", "fleurdelis", "rose", "etoile", "roundel", "coquille"];     // les marques de cadence anglaises, puis l'étoile, le besant et la coquille
const LAMBEL_FIGS = [...BRIS_FIGS, "croisette", "chateau"];                                // ce que peuvent porter les pendants d'un lambel (les châteaux : Artois)
const brisPiece = s => (own(BRIS_PIECES, s.br) ? BRIS_PIECES[s.br] : null);
const lambelArms = s => ({ ...s, m: s.lpc, m2: "", nb: s.lpk, tm: s.lpt, ta: s.lpt, ct: "", cn: "", iss: "", cc: "", d: "", pos: "autour", p: "" });
const brisArms = s => ({ ...s, m: s.br, m2: "", nb: s.brn, tm: s.tbr, ta: s.tbr, ct: "", cn: "", iss: "", cc: "", d: s.brd, pos: "autour", p: "" });
const count1 = s => { const m = s.m && meuble(s.m); return !m || s.nb === "seme" ? 0 : m.seul ? 1 : +s.nb; };
const count2 = s => s.m && s.m2 ? +s.nb2 : 0;

/* ---------- état : les ornements, jusqu'à quatre armes pour l'écartelé, et un écusson en abîme ---------- */
const ADEF = { f: "plein", t1: "Azur", t2: "Gueules", t3: "Or", part: "parti", ray: "barry", n: "6", p: "", tp: "Or", m: "fleurdelis", nb: "3", pos: "autour", tm: "Or", ta: "Gueules",
  d: "", sz: "100", dx: "0", dy: "0", m2: "", nb2: "3", d2: "chef", cp: "", tm2: "Argent", ta2: "Gueules", sz2: "100", dx2: "0", dy2: "0", an: "0", an2: "0", ad: "",
  ct: "", ct2: "", ln: "", pf: "", cn: "", cn2: "", iss: "", cc: "",
  br: "", tbr: "Argent", sbr: "bande", lbr: "", brn: "1", brd: "", brsz: "100", brdx: "0", brdy: "0",
  lpn: "3", lpc: "", lpt: "Gueules", lpk: "1", lpw: "", pdx: "0", pdy: "0", pth: "100", rot: "0", cnk: "", cnk2: "", bro2: "", pbro: "", pcc: "", cha: "", rc: "", cmp: "", tpc: "Argent", cm1: "", cm1t: "Or", cm2: "", cm2t: "Gueules", ri: "", fqs: "", big2: "", m2c: "", m2cn: "3", m2ct: "Or", lrg: "" };       // pdx, pdy : le décalage graphique de la pièce ; le lambel : son nombre de pendants, la figure qu'ils portent, son émail, combien par pendant, et sur lesquels ("" : chacun, « milieu »)       // la brisure : sa sorte, son émail, son sens (bâton, filet), son bord, le nombre et la place de ses figures, et leurs réglages graphiques       // iss : « issant », la moitié haute du meuble sortant de la pointe de l'écu               // cn : l'émail de la couronne que porte le meuble (« lion couronné d'or »), s'il peut en porter une
const ADEFS = [ADEF, { ...ADEF, t1: "Gueules", m: "", p: "croix", tp: "Argent" }, { ...ADEF, t1: "Or", m: "lion", nb: "1", tm: "Gueules", ta: "Azur" }, { ...ADEF, t1: "Argent", m: "", p: "fasce", tp: "Gueules" },
  { ...ADEF, t1: "Or", m: "aigle", nb: "1", tm: "Sable", ta: "Gueules" },       // la cinquième : l'écusson en abîme (« sur le tout »)
  { ...ADEF, t1: "Azur", m: "etoile", nb: "3", tm: "Argent" }, { ...ADEF, t1: "Gueules", m: "", p: "croix", tp: "Argent" },
  { ...ADEF, t1: "Or", m: "lion", nb: "1", tm: "Gueules", ta: "Azur" }, { ...ADEF, t1: "Argent", m: "", p: "fasce", tp: "Gueules" }];      // 5 à 8 : les armes en plus des moitiés d'un parti qui s'écartelle (HALF_ARMS)

/* deux armes, sans plus : l'écartelé 1-4 / 2-3, le coupé, le tranché et le taillé (le parti, lui, peut écarteler ses moitiés) */
const DEUX = new Set(["2", "c", "t", "l"]);
/* coupé, tranché, taillé : « Coupé : au 1, … ; au 2, … » ; le nom et les deux parties */
const QDEUX = { c: ["Coupé", "Moitié du chef (1)", "Moitié de la pointe (2)"], t: ["Tranché", "Partie haute (1)", "Partie basse (2)"], l: ["Taillé", "Partie haute (1)", "Partie basse (2)"] };
/* un parti : deux moitiés (armes 0 et 1), dont chacune peut s'écarteler (h1, h2 : "", "2" pour 1-4 / 2-3, "4" en quatre) ; ses quartiers 2, 3, 4 prennent alors les armes de HALF_ARMS */
const HALF_ARMS = [[0, 2, 3, 5], [1, 6, 7, 8]];
const halfMode = (St, h) => (h ? St.h2 : St.h1);
/* les armes de chaque quartier d'une moitié écartelée, dans l'ordre 1-2-3-4 ; null si la moitié est simple */
const halfQuarters = (St, h) => { const a = HALF_ARMS[h], m = halfMode(St, h); return m === "2" ? [a[0], a[1], a[1], a[0]] : m === "4" ? a.slice() : null; };
const halfUsed = (St, h) => { const a = HALF_ARMS[h], m = halfMode(St, h); return m === "2" ? a.slice(0, 2) : m === "4" ? a.slice() : [a[0]]; };
/* un coupé dont la partie du chef est partie (h1 « p ») : trois armes, le chef à dextre (0), le chef à senestre (2), la pointe (1) */
const chefParti = St => St.q === "c" && St.h1 === "p";
const active = St => (!St.q ? [0] : DEUX.has(St.q) ? (chefParti(St) ? [0, 2, 1] : [0, 1]) : St.q === "p" ? [...halfUsed(St, 0), ...halfUsed(St, 1)] : [0, 1, 2, 3]).concat(St.ab ? [4] : []);
const meuble = k => ATL.meubles.find(m => m.kind === k);
/* « sous » : les meubles sont sur le champ, la pièce brochant sur le tout (ils suivent alors les dispositions du champ plein) */
function ctxOf(s) { return s.p ? (s.pos === "sur" ? "sur-" + s.p : s.pos === "sous" ? "plein" : s.p === "fasce" && s.cp ? "fasce-cp" : s.p) : "plein"; }
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
  for (const k of ["t1", "t2", "t3", "tp", "tm", "ta", "tm2", "ta2"]) if (!own(MOT, s[k]) && !(k === "ta" && s[k] === "")) s[k] = ADEF[k];
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
  /* « à la fasce … accompagnée en chef de A et en pointe de B » : une, deux ou trois figures de chaque côté */
  s.cp = s.cp === "1" && s.p === "fasce" && s.pos === "autour" && s.m && s.nb !== "seme" && s.m2 && meuble(s.m2) && ["1", "2", "3"].includes(s.nb2) ? "1" : "";
  const cs = countsFor(s);
  if (s.m && !cs.includes(s.nb)) s.nb = cs.includes("3") ? "3" : cs[0];
  if (palParDefaut(s) && s.d === "pal") s.d = "";
  if (!dispos(s).some(d => d.id === s.d)) s.d = "";
  if (!s.m || (s.m2 && !meuble(s.m2))) s.m2 = "";
  /* le bord de la pièce ; le sens des meubles (seuls les meubles asymétriques se contournent) */
  if (!s.p || !own(CONTOUR_NOM, s.ln) || (s.ln === "alesee" && !ALESEE_OK.has(s.p))) s.ln = "";
  if (!s.p || s.p === "bordure" || s.p === "orle" || !own(MOT, s.pf)) s.pf = "";                  // le filet : « la croix de gueules bordée d'argent »
  const mm = s.m && meuble(s.m), mm2 = s.m2 && meuble(s.m2);
  s.cn = mm && mm.couronne && own(MOT, s.cn) ? s.cn : "";
  s.cn2 = mm2 && mm2.couronne && own(MOT, s.cn2) ? s.cn2 : "";
  s.cnk = s.cn && s.cnk === "antique" ? "antique" : ""; s.cnk2 = s.cn2 && s.cnk2 === "antique" ? "antique" : "";             // la forme de la couronne : un choix de dessin, que le blasonnement ne dit pas
  s.iss = mm && !mm.seul && (s.iss === "1" || s.iss === "t") && s.nb === "1" && !s.p ? s.iss : "";               // un seul meuble, sans pièce ; « t » : demi-meuble mouvant du trait du parti (voir normalizeAll)
  s.ct = mm && mm.asym && s.ct === "1" ? "1" : "";
  s.ct2 = mm2 && mm2.asym && s.ct2 === "1" ? "1" : "";
  s.cc = ccPossible(s) && (s.cc === "en" || s.cc === "a") ? s.cc : "";
  s.pcc = pccPossible(s) && (s.pcc === "en" || s.pcc === "a") ? s.pcc : "";
  if (s.ta === "" && !s.cc) s.ta = ADEF.ta;                                          // ta vide : l'attribut d'un meuble contre-changé, contre-changé avec lui
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
  s.pdx = s.p && s.p !== "bordure" && s.p !== "orle" ? num(s.pdx, -80, 80, 0) : "0"; s.pdy = s.p && s.p !== "bordure" && s.p !== "orle" ? num(s.pdy, -80, 80, 0) : "0";      // la bordure et l'orle longent toujours les bords
  s.pth = s.p === "croix" ? num(s.pth, 50, 250, 100) : "100";
  s.rot = s.m && (meuble(s.m) || {}).incline && ["-90", "-45", "45", "90"].includes(String(s.rot)) ? String(s.rot) : "0";             // l'inclinaison du dessin, pour les meubles qui s'inclinent (le bras) ; le blasonnement ne la dit pas
  if (!own(PLEIN, s.nb2)) s.nb2 = "3";
  if (!PLEIN[s.nb2].some(d => d.id === s.d2)) s.d2 = "";
  s.bro2 = s.bro2 === "1" && s.m && s.m2 && s.nb2 === "1" && s.nb !== "seme" && !s.p && !s.cc ? "1" : "";             // le second meuble broche sur le premier : au centre, seul
  if (s.bro2) s.d2 = "";
  s.pbro = s.pbro === "1" && s.p && s.pos === "sur" && s.m && s.m2 && s.nb2 === "1" && s.nb !== "seme" ? "1" : "";       // la pièce chargée broche sur le meuble du champ, qui est seul, au centre
  if (s.pbro) s.d2 = "";
  s.cha = s.cha === "1" && s.m && s.m2 && s.nb2 === "1" && s.nb !== "seme" && +s.nb >= 2 && !(mm && mm.seul) && !s.p && !s.cc && !s.bro2 && !s.iss ? "1" : "";       // « chacun accompagné d'une étoile » : une figure du second meuble auprès de chaque figure du premier
  if (s.cha) s.d2 = "";
  s.rc = s.rc === "1" && rcPossible(s) ? "1" : "";                    // les meubles sur les pièces du premier émail d'un fascé impair
  if (s.rc) s.d = "";
  s.lrg = s.lrg === "1" && (s.p === "bande" || s.p === "barre") && !s.ln ? "1" : "";                // la bande (barre) élargie (Berne)
  /* le second meuble, seul en chef, plus grand que les autres (Médicis) ; un tourteau ainsi grandi peut porter une à trois figures */
  s.big2 = s.big2 === "1" && s.m && s.m2 && s.nb2 === "1" && s.d2 === "chef" && !s.p && s.nb !== "seme" && !s.cp && !s.bro2 && !s.pbro && !s.cha ? "1" : "";
  { let mc = s.m2c && meuble(s.m2c); if (mc) { mc = ATL.meubles.find(o => o.sing === mc.sing); s.m2c = mc.kind; }
    if (!s.big2 || s.m2 !== "roundel" || !mc || mc.seul || mc.queue) s.m2c = "";
    if (!s.m2c || !["1", "2", "3"].includes(s.m2cn)) s.m2cn = ADEF.m2cn;
    if (!s.m2c || !own(MOT, s.m2ct)) s.m2ct = ADEF.m2ct; }
  s.fqs = s.p === "franc-quartier" && s.fqs === "1" ? "1" : "";                // le franc-quartier senestre (Schwytz)
  s.ri = (s.p === "bande" || s.p === "barre") && own(MOT, s.ri) ? s.ri : "";                // la bande (barre) ornée d'un rinceau
  /* la bordure componée : deux émaux en alternance, et, sur les compons de chacun, une figure (cm1 sur ceux du premier émail, cm2 sur ceux du second) */
  if (!own(MOT, s.tpc)) s.tpc = ADEF.tpc;
  s.cmp = s.cmp === "1" && s.p === "bordure" && !s.ln && !s.pf && s.pos !== "sur" ? "1" : "";
  if (s.cmp && s.tpc === s.tp) s.tpc = s.tp === "Argent" ? "Or" : "Argent";
  for (const [k, kt] of [["cm1", "cm1t"], ["cm2", "cm2t"]]) {
    let mm = s[k] && meuble(s[k]);
    if (mm) { mm = ATL.meubles.find(o => o.sing === mm.sing); s[k] = mm.kind; }       // deux meubles de même nom : le texte lit le premier de la liste
    if (!s.cmp || !mm || mm.seul || mm.queue) s[k] = "";
    if (!s[k] || !own(MOT, s[kt])) s[kt] = ADEF[kt];
  }
  for (const x of ["", "2"]) { s["sz" + x] = num(s["sz" + x], 30, 200, 100); s["dx" + x] = num(s["dx" + x], -60, 60, 0); s["dy" + x] = num(s["dy" + x], -60, 60, 0); s["an" + x] = num(s["an" + x], -180, 180, 0); }
  const map = adMap(s), n1 = count1(s), n2 = count2(s);
  for (const [k, v] of map) {
    const [g, i] = k.split(".").map(Number);
    if (!(g === 1 && i < n1 || g === 2 && i < n2) || v.length < 3 || v.length > 4 || v.some(x => !Number.isFinite(x))) map.delete(k);
    else map.set(k, [+num(v[0], 30, 200, 100), +num(v[1], -60, 60, 0), +num(v[2], -60, 60, 0), ...(v.length === 4 ? [+num(v[3], -180, 180, 0)] : [])]);
  }
  s.ad = adStr(map);
  return s;
}

/* « de l'un en l'autre » (cc « en ») ou « de l'un à l'autre » (« a ») : le meuble prend, sur chaque part du champ, l'émail de l'autre part.
   Il faut un champ partagé de deux émaux et des meubles posés sur le champ (pas sur une pièce) ; ni besant ni tourteau, dont le nom dit l'émail */
const ccPossible = s => !!(s.m && meuble(s.m) && s.m !== "roundel" && s.f === "part" && !s.part.startsWith("tierce") && s.pos !== "sur" && s.t1 !== s.t2);
/* la pièce de l'un en l'autre (« à la croix de l'un en l'autre ») : sans meuble, sur un champ partagé de deux émaux ; la bordure et l'orle, dessinées à part, ne s'y prêtent pas */
const pccPossible = s => !!(s.p && !s.m && s.p !== "bordure" && s.p !== "orle" && s.f === "part" && !s.part.startsWith("tierce") && s.t1 !== s.t2);
/* « Fascé de gueules et d'or de cinq pièces, les trois fasces de gueules chargées de huit besants d'or, 3, 3 et 2 » : un fascé de nombre impair dont les pièces du premier émail portent les meubles (rc) */
const rcPossible = s => !!(s.f === "ray" && s.ray === "barry" && +s.n % 2 && +s.n >= 5 && s.m && meuble(s.m) && !meuble(s.m).seul && !s.p && !s.m2 && !s.cc && !s.iss && s.nb !== "seme" && +s.nb >= (+s.n + 1) / 2);
const rcDist = s => { const K = (+s.n + 1) / 2, nb = +s.nb; return Array.from({ length: K }, (_, i) => Math.floor(nb / K) + (i < nb % K ? 1 : 0)); };
const ccTexte = cc => cc === "a" ? "de l'un à l'autre" : "de l'un en l'autre";

/* ce que des armes montrent et disent : les champs sans objet (l'émail d'un second champ qui n'existe pas) et les réglages graphiques
   n'y figurent pas. Sert à comparer deux compositions : le lecteur de blasonnement (assets/lecture.js) et les tests */
function canon(a) {
  const o = { f: a.f }, m = a.m && meuble(a.m), m2 = m && a.m2 && meuble(a.m2);
  if (a.f === "plein") o.t1 = a.t1;
  else if (a.f === "part") { Object.assign(o, { part: a.part, t1: a.t1, t2: a.t2 }); if (a.part.startsWith("tierce")) o.t3 = a.t3; }
  else Object.assign(o, { ray: a.ray, ...(a.ray.startsWith("lozengy") ? {} : { n: a.n }), t1: a.t1, t2: a.t2 });
  if (a.p) Object.assign(o, a.pcc ? { p: a.p, pcc: a.pcc, ln: a.ln, pf: a.pf } : { p: a.p, tp: a.tp, ln: a.ln, pf: a.pf });
  if (a.ri) o.ri = a.ri;
  if (a.lrg) o.lrg = "1";
  if (a.fqs) o.fqs = "1";
  if (a.cmp) Object.assign(o, { cmp: "1", tpc: a.tpc, cm1: a.cm1, cm2: a.cm2, ...(a.cm1 ? { cm1t: a.cm1t } : {}), ...(a.cm2 ? { cm2t: a.cm2t } : {}) });
  if (m) {
    Object.assign(o, a.cc ? { m: a.m, nb: a.nb, cc: a.cc } : { m: a.m, nb: a.nb, tm: a.tm });       // contre-changé : l'émail du meuble est celui du champ
    if (a.p) o.pos = a.pos;
    if (m.accent) o.ta = a.ta;
    if (m.asym) o.ct = a.ct;
    if (m.couronne) o.cn = a.cn;
    if (a.iss) o.iss = a.iss;
    if (a.rc) o.rc = "1";
    if (dispos(a).length) o.d = a.d;
  }
  if (m2) {
    Object.assign(o, { m2: a.m2, nb2: a.nb2, ...(a.cp ? { cp: a.cp } : { d2: a.d2 }), tm2: a.tm2 });
    if (m2.accent) o.ta2 = a.ta2;
    if (m2.asym) o.ct2 = a.ct2;
    if (m2.couronne) o.cn2 = a.cn2;
    if (a.bro2) o.bro2 = "1";
    if (a.pbro) o.pbro = "1";
    if (a.big2) o.big2 = "1";
    if (a.m2c) Object.assign(o, { m2c: a.m2c, m2cn: a.m2cn, m2ct: a.m2ct });
    if (a.cha) o.cha = "1";
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
const canonAll = St => ({ q: St.q, ab: St.ab, gb: St.gb || "", h1: St.h1 || "", h2: St.h2 || "", A: active(St).map(i => canon(St.A[i])) });

/* ---------- le blasonnement ---------- */
/* l'attribut d'un meuble (« armé et lampassé d'azur ») ne se dit que s'il change quelque chose : de l'émail du corps, on se tait.
   Ceux qui sont un trait du dessin (« couronné », « incensé », « dans des flammes »…) se disent toujours */
const accentDit = (m, s) => !!(m.accent && m.accentMot && (m.accentFixe || m.accentTrait || (s.cc ? !!s.ta : s.ta !== s.tm)));
function charges(s) {
  const m = meuble(s.m), seme = s.nb === "seme", n = seme ? 0 : +s.nb, pl = seme || n > 1;
  let nom = m.sing, nomPl = m.plur, g = m.g;
  if (m.kind === "roundel") { const metal = classe(s.tm) === "Métal"; nom = metal ? "besant" : "tourteau"; nomPl = metal ? "besants" : "tourteaux"; g = "m"; }
  if (s.iss === "t") nom = "demi-" + nom;
  /* la couronne : de l'émail du meuble, elle se dit devant lui (« un lion couronné d'or ») ; d'un autre, après l'attribut (« … armé et lampassé de gueules couronné d'argent ») */
  const couronne = s.cn ? " " + agree("couronné", g, pl) : "", mem = s.cn && !s.cc && s.cn === s.tm;
  /* ta vide (contre-changé) : l'attribut suit le corps, « du même » */
  const acc = (accentDit(m, s) ? " " + (m.accentFixe ? m.accentMot : agree(m.accentMot, g, pl)) + " " + (s.ta ? de(s.ta) : "du même") + (m.accentPlus ? ", " + m.accentPlus : "") : "") + (s.cn && !mem ? couronne + " " + de(s.cn) : "");
  const ctr = (s.iss === "1" ? (g === "f" ? " issante" : " issant") : "") + (s.ct ? " " + agree("contourné", g, pl) : "") + (mem ? couronne : "");   // « un lion contourné d'or », « trois lions contournés couronnés d'or »
  /* une partie du dessin toujours du même émail se dit toujours (« la grenade d'or ouverte de gueules, tigée et feuillée de sinople ») */
  const fixe = m.fixe ? `, ${agree(m.fixe.mot, g, pl)} ${de(m.fixe.t)}` : "";
  /* une variante de la figure, dite après l'émail (« au lion d'argent, à la queue fourchée et passée en sautoir, armé… ») */
  const queue = m.queue ? `, ${m.queue.mot}${acc ? "," : ""}` : "";
  return { m, n, pl, nom, nomPl, g, acc: queue + acc + fixe, ctr, mv: s.iss === "t" ? " mouvant du trait du parti" : "", tinct: s.cc ? ccTexte(s.cc) : de(s.tm) };
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
    const c2 = charges(arms2(s)), ph = s.cha ? "" : agree(dispo2(s).ph, c2.g, c2.pl);
    const obj = (c2.n === 1 ? `${c2.g === "f" ? "d'une" : "d'un"} ${c2.nom}` : `de ${NB[c2.n]} ${c2.nomPl}`) + `${c2.ctr} ${c2.tinct}${c2.acc}${ph}`;
    const alone = (c2.n === 1 ? `${aArt(c2.nom, c2.g)}${c2.nom}` : `à ${NB[c2.n]} ${c2.nomPl}`) + `${c2.ctr} ${c2.tinct}${c2.acc}${ph}`;
    const grand = s.big2 ? ` plus ${c2.g === "f" ? "grande" : "grand"}` : "";
    let chg = "";
    if (s.m2c) { const cx = charges({ ...ADEF, m: s.m2c, nb: s.m2cn, tm: s.m2ct, ta: s.m2ct, ct: "", cn: "", cc: "", iss: "", p: "", pos: "autour", m2: "" }); chg = ` ${agree("chargé", c2.g, false)} ${cx.n === 1 ? (cx.g === "f" ? "d'une" : "d'un") + " " + cx.nom : "de " + NB[cx.n] + " " + cx.nomPl}${cx.ctr} ${cx.tinct}${cx.acc}`; }
    const big = s.big2 ? `, et, en chef, ${c2.g === "f" ? "une" : "un"} ${c2.nom}${grand}${c2.ctr} ${c2.tinct}${c2.acc}${chg}` : "";
    x2 = { obj, alone, acc: big || (s.cha ? `, chacun accompagné ${obj}` : `, ${agree("accompagné", c.g, c.pl)} ${obj}`), bro: `, ${alone} brochant sur le tout` };
  }
  if (s.rc && c) {
    const dist = rcDist(s), liste = dist.length > 1 ? dist.slice(0, -1).join(", ") + " et " + dist[dist.length - 1] : String(dist[0]);
    return `Fascé ${de(s.t1)} et ${de(s.t2)} de ${NB[+s.n]} pièces, les ${NB[dist.length]} fasces ${de(s.t1)} chargées ${grpObj}, ${liste}`;
  }
  if (!s.p) {
    if (!c) return champ + (parti ? "" : " plein");
    if (seme) return champ + (x2 ? ", " + x2.alone : "");
    return `${champ}${parti ? "," : ""} ${groupe}${dph(s, c)}${parti && c.n === 1 && !s.cc ? " brochant sur le tout" : ""}${x2 ? (s.bro2 ? x2.bro : x2.acc) : ""}`;       // contre-changé, le meuble ne broche pas : il se partage
  }
  const P = PIECES[s.p], pnom = s.p;
  const bord = s.ln ? " " + agree(CONTOUR_NOM[s.ln], P.g, false) : "";                // « la fasce ondée », « le chef denché »
  const filet = s.pf ? ` ${agree("bordé", P.g, false)} ${de(s.pf)}` : "";                       // « la croix de gueules bordée d'argent »
  const cmObj = (k, t) => { const mm = meuble(k); return `${mm.g === "f" ? "d'une" : "d'un"} ${mm.sing} ${de(t)}`; };
  const cmTxt = !s.cmp ? "" : s.cm1 ? `, les compons ${de(s.tp)} chargés ${cmObj(s.cm1, s.cm1t)}` + (s.cm2 ? `, ceux ${de(s.tpc)} ${cmObj(s.cm2, s.cm2t)}` : "")
    : s.cm2 ? `, les compons ${de(s.tpc)} chargés ${cmObj(s.cm2, s.cm2t)}` : "";
  const pieceTxt = s.cmp ? `${aArt(pnom, P.g)}${pnom} componée ${de(s.tp)} et ${de(s.tpc)}${cmTxt}` : `${aArt(pnom, P.g)}${pnom}${s.fqs ? " senestre" : ""}${s.lrg ? " élargie" : ""}${bord} ${s.pcc ? ccTexte(s.pcc) : de(s.tp)}${filet}${s.ri ? ` ornée d'un rinceau ${de(s.ri)}` : ""}`;
  const broche = parti && !["chef", "bordure", "orle", "canton", "franc-quartier"].includes(s.p) ? " brochant sur le tout" : "";
  if (c && !seme && s.pos === "sous") return `${champ}${parti ? "," : ""} ${groupe}${dph(s, c)}${x2 ? x2.acc : ""}, ${pieceTxt} brochant sur le tout`;
  const sep = parti || seme ? ", " : " ";
  const lead = x2 && (seme || s.pos === "sur") ? `${parti || seme ? "," : ""} ${x2.alone}, ` : sep;
  if (c && !seme && s.pos === "sur") {
    const charge = agree("chargé", P.g, false);
    return `${champ}${lead}${pieceTxt}${s.pbro ? " brochant sur le tout," : broche ? broche + "," : ""} ${charge} ${grpObj}`;
  }
  if (c && !seme && (s.p === "chef" || s.p === "bordure" || s.p === "orle"))
    return `${champ}${parti ? "," : ""} ${groupe}${s.p === "chef" ? "" : dph(s, c)}${x2 ? x2.acc : ""}, ${pieceTxt}`;
  if (c && !seme && s.cp && count2(s)) {
    const c2 = charges(arms2(s)), obj2 = (c2.n === 1 ? `${c2.g === "f" ? "d'une" : "d'un"} ${c2.nom}` : `de ${NB[c2.n]} ${c2.nomPl}`) + `${c2.ctr} ${c2.tinct}${c2.acc}`;
    return `${champ}${sep}${pieceTxt}${broche ? broche + "," : s.ri ? "," : ""} ${agree("accompagné", P.g, false)} en chef ${grpObj} et en pointe ${obj2}`;
  }
  if (c && !seme) {
    const v = agree(VERBE[s.p] || "accompagné", P.g, false);
    return `${champ}${sep}${pieceTxt}${broche ? broche + "," : s.ri ? "," : ""} ${v} ${grpObj}${dispo(s.p, c.n, c.g)}${x2 ? " et " + x2.obj : ""}`;
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
  if (chefParti(St)) return [[0, "Chef : dextre (1)"], [2, "Chef : senestre (2)"], [1, "Pointe (3)"]];
  if (QDEUX[St.q]) return [[0, QDEUX[St.q][1]], [1, QDEUX[St.q][2]]];
  if (St.q !== "p") return St.q ? QNAME[St.q].map((l, i) => [i, l]) : [];
  return [0, 1].flatMap(h => {
    const nom = h ? "senestre" : "dextre", m = halfMode(St, h), a = HALF_ARMS[h];
    return m === "2" ? [[a[0], `Moitié ${nom} : quartiers 1 et 4`], [a[1], `Moitié ${nom} : quartiers 2 et 3`]]
      : m === "4" ? a.map((i, n) => [i, `Moitié ${nom} : quartier ${n + 1}`]) : [[a[0], `Moitié ${nom} (${h + 1})`]];
  });
}
function blazonAll(St) {
  const lo = b => b.charAt(0).toLowerCase() + b.slice(1);
  const bz = i => (i === 0 && St.q && St.gb === "1" ? blazonCore(St.A[0]) : blazon(St.A[i]));      // la brisure de tout l'écu se dit à la fin
  let b;
  if (!St.q) b = blazon(St.A[0]);
  else if (St.q === "p") {
    /* chaque moitié : des armes, ou un écartelé « écartelé : aux 1 et 4, … ; aux 2 et 3, … » (les quartiers se disent alors avant la moitié suivante) */
    const moitie = h => {
      const m = halfMode(St, h), a = HALF_ARMS[h];
      if (!m) return lo(bz(a[0]));
      const labs = m === "2" ? QLAB[2] : QLAB[4];
      return "écartelé : " + halfUsed(St, h).map((i, n) => `${labs[n]}, ${lo(bz(i))}`).join(" ; ");
    };
    b = `Parti : au 1, ${moitie(0)} ; au 2, ${moitie(1)}`;
  } else if (chefParti(St)) b = `Coupé : au 1, parti : au 1, ${lo(bz(0))} ; au 2, ${lo(bz(2))} ; au 2, ${lo(bz(1))}`;      // le chef d'un coupé, partie en deux : le chef à dextre, à senestre, puis la pointe
  else if (QDEUX[St.q]) b = `${QDEUX[St.q][0]} : au 1, ${lo(bz(0))} ; au 2, ${lo(bz(1))}`;           // un coupé : deux moitiés, en chef et en pointe (elles ne s'écartèlent pas)
  else b = "Écartelé : " + active(St).filter(i => i < 4).map(i => `${QLAB[St.q][i]}, ${lo(bz(i))}`).join(" ; ");
  if (St.q && St.gb === "1" && St.A[0].br) b += " ; le tout brisé " + brisTxt(St.A[0]);
  if (St.ab) b += (St.q ? " ; " : ", ") + "sur le tout " + lo(blazon(St.A[4]));            // l'écusson en abîme
  return b;
}
