"use strict";
const FP = "https://commons.wikimedia.org/wiki/Special:FilePath/";
const CPAGE = "https://commons.wikimedia.org/wiki/File:";
const WIKI = "https://fr.wikipedia.org/wiki/";
/* contour de l'écu du Projet:Blasons (600 × 660), le même que les fichiers Commons repris ici :
   les écus dessinés et les écus empruntés se superposent donc exactement */
const SHIELD = "M1.4,1.4 H599.4 V520.9 C594.8,566.5 567.8,582.6 533.2,588.6 H368.1 C327.8,590 304.6,620.1 300.4,658.3 C296.2,620.1 273,590 232.7,588.6 H67.6 C33,582.6 6,566.5 1.3,520.9 Z";
const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
const ZOOMS = [1.3, 2.2, 3, 4.2, 6, 8.5, 12, 17, 24, 34, 48];
const MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const TW = 78, TIER_H = 72, RULER_H = 42, BAND_H = 34, OROW_H = 17;
/* les frises disponibles : data/frises.json (une par fichier de données ; l'emblème est un fichier Commons déjà crédité dans la lignée) */
let LIGNEES = [], GROUPES = [];
/* vocabulaire par défaut ; une lignée le surcharge par R.mots */
const MOTS = { regne: "règne", sans: "Sans souverain", bande: "Armes du royaume", maisons: "Maisons", devises: "Devises", rivaux: "Rivaux", souverain: "souverain", armesDe: "Armes du royaume" };
const W = (R, k) => R.mots?.[k] ?? MOTS[k];
/* visionneuse « images » : écus Commons et sceaux numérotés, au lieu des lis animés */
const isImg = R => R.viewer === "img";
const deOf = s => (/^[AEIOUYÉÈH]/i.test(s) ? "d'" : "de ") + s;
/* émaux du champ, pour la bande des armes */
const TINC = { or: "#d9b556", argent: "#e9e5da", gueules: "#b3261e", azur: "#2a56a5", sable: "#1d1d1f", sinople: "#2f8a4a", pourpre: "#7a3d7a" };
function champCss(a){
  const [c1, c2 = c1] = (a.champ || []).map(t => TINC[t] || "#777");
  if(!c1) return "";
  const g = "linear-gradient(rgba(255,255,255,.16),rgba(0,0,0,.22))";
  const f = {
    parti: `linear-gradient(90deg,${c1} 50%,${c2} 50%)`,
    coupe: `linear-gradient(${c1} 50%,${c2} 50%)`,
    tranche: `linear-gradient(45deg,${c2} 50%,${c1} 50%)`,
    taille: `linear-gradient(135deg,${c1} 50%,${c2} 50%)`,
    ecartele: `conic-gradient(${c2} 0 25%,${c1} 0 50%,${c2} 0 75%,${c1} 0) 0 0/26px 100%`,
    bande: `repeating-linear-gradient(45deg,${c1} 0 6px,${c2} 6px 12px)`,
    barre: `repeating-linear-gradient(-45deg,${c1} 0 6px,${c2} 6px 12px)`,
    fasce: `repeating-linear-gradient(${c1} 0 4px,${c2} 4px 8px)`,
    pal: `repeating-linear-gradient(90deg,${c1} 0 6px,${c2} 6px 12px)`,
    echiquete: `conic-gradient(${c1} 0 25%,${c2} 0 50%,${c1} 0 75%,${c2} 0) 0 0/12px 12px`,
    chape: `linear-gradient(90deg,${c2} 0 18%,${c1} 18% 82%,${c2} 82%)`,
  }[a.part] || c1;
  return `${g},${f}`;
}
/* bulle de plomb numérotée : le jeton des papes sans armoiries */
function sealSvg(r, big){
  const name = (r.court || "").replace(/Iᵉʳ|Ier/, "I").toUpperCase();
  const nm = big ? `<text class="sl-n" x="100" y="86" text-anchor="middle" font-size="21"${name.length > 11 ? ` textLength="146" lengthAdjust="spacingAndGlyphs"` : ""}>${esc(name)}</text><path d="M52,100 H148" stroke="rgba(20,22,26,.45)" stroke-width="2"/>` : "";
  return `<svg class="${big ? "seal-big" : "tk-seal"}" viewBox="0 0 200 200" aria-hidden="true">
    <circle cx="100" cy="100" r="95" fill="url(#g-plomb)" stroke="#26292e" stroke-width="4"/>
    <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(22,24,28,.6)" stroke-width="7" stroke-dasharray="0.5 11" stroke-linecap="round"/>
    <circle cx="100" cy="100" r="95" fill="url(#g-relief)"/>
    ${nm}<text class="sl-n" x="100" y="${big ? 140 : 126}" text-anchor="middle" font-size="${big ? 36 : (String(r.num).length > 2 ? 66 : 80)}">${esc(r.num ?? "")}</text></svg>`;
}

let DATA, FRISE;                                  // FRISE : la ligne de data/frises.json affichée (son id sert aux liens vers la chronologie)
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
/* texte affiché : échappé, et « Iᵉʳ », « XIIIᵉ » en vrais exposants (les lettres modificatrices manquent aux polices) */
const txt = s => esc(s).replace(/ᵉʳ/g, "<sup>er</sup>").replace(/ʳᵉ/g, "<sup>re</sup>").replace(/ᵉ/g, "<sup>e</sup>");
const wikiUrl = t => WIKI + encodeURIComponent(t.replace(/ /g, "_"));
const commonsImg = (f, w) => FP + encodeURIComponent(f) + "?width=" + w;
const commonsPage = f => CPAGE + encodeURIComponent(f.replace(/ /g, "_"));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- dates ---------- */
function yr(v){
  if(typeof v === "number") return v;
  const [y, m, d] = v.split("-").map(Number);
  return y + ((m - 1) * 30.44 + (d - 1)) / 365.25;
}
/* une année entière vaut jusqu'à la fin de l'année ; une date exacte, jusqu'au jour dit */
const endAct = v => typeof v === "number" ? v + 1 : yr(v);
function fmt(v){
  if(typeof v === "number") return String(v);
  const [y, m, d] = v.split("-").map(Number);
  return `${d === 1 ? "1ᵉʳ" : d} ${MOIS[m - 1]} ${y}`;
}
function spanTxt(o){
  const a = typeof o.debut === "number" ? o.debut : +o.debut.slice(0, 4);
  const b = typeof o.fin === "number" ? o.fin : +o.fin.slice(0, 4);
  return a === b ? `${a}` : `${a} – ${b}`;
}
function spanLong(o){
  if(o.approx) return o.approx;
  if(o.encours) return `depuis le ${fmt(o.debut)}`;
  return fmt(o.debut) === fmt(o.fin) ? fmt(o.debut) : `${fmt(o.debut)} – ${fmt(o.fin)}`;
}
function duree(o){
  const d = yr(o.fin) - yr(o.debut);
  if(d < 1){ const j = Math.round(d * 365.25); return j <= 1 ? "un jour" : `${j} jours`; }
  const n = Math.round(d);
  return n <= 1 ? "un an" : `${n} ans`;
}

/* ---------- tracés ---------- */
const LIS_W = 79, LIS_H = 104;
const SEME = (() => {
  const pts = [];
  [70, 190, 310, 430, 550].forEach((y, r) => {
    (r % 2 ? [0, 150, 300, 450, 600] : [75, 225, 375, 525]).forEach(x => pts.push([x, y]));
  });
  return pts;
})();
const MODERNE = { pts: [[150, 205], [450, 205], [300, 458]], s: 2.25 };
const ORLEANS = { pts: [[150, 282], [450, 282], [300, 498]], s: 1.9 };
/* les trois lis de France moderne naissent des lis du semé les plus proches */
const MAP3 = (() => {
  const used = new Set();
  return MODERNE.pts.map(([tx, ty]) => {
    let best = -1, bd = 1e9;
    SEME.forEach(([x, y], i) => { const d = Math.hypot(x - tx, y - ty); if(!used.has(i) && d < bd){ bd = d; best = i; } });
    used.add(best); return best;
  });
})();
const CENTER_I = SEME.reduce((b, [x, y], i) => Math.hypot(x - 300, y - 318) < Math.hypot(SEME[b][0] - 300, SEME[b][1] - 318) ? i : b, 0);

function lisUse(x, y, s = 1){
  const w = LIS_W * s, h = LIS_H * s;
  return `<use href="#lis" x="${(x - w / 2).toFixed(1)}" y="${(y - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"/>`;
}
function beadsAlong(pts, step){
  const out = [];
  for(let i = 0; i < pts.length - 1; i++){
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const n = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / step));
    for(let k = i ? 1 : 0; k <= n; k++) out.push([x1 + (x2 - x1) * k / n, y1 + (y2 - y1) * k / n]);
  }
  return out;
}
/* demi-escarboucle de Navarre (mi-parti) : bâtons pommetés, orle fermé, cœur de sinople */
function navarreHalf(){
  const C = [300, 318];
  const orle = [[300, 30], [570, 30], [570, 505], [522, 560], [360, 562], [300, 624]];
  const staves = [[300, 30], [570, 30], [570, 318], [522, 560], [300, 624]].map(p => [C, p]);
  const lines = [orle, ...staves];
  const poly = pts => pts.map(p => p.join(",")).join(" ");
  let s = `<rect x="300" width="300" height="660" fill="url(#g-gules)"/>`;
  s += lines.map(l => `<polyline points="${poly(l)}" fill="none" stroke="#3a2608" stroke-width="15" stroke-linejoin="round"/>`).join("");
  s += lines.map(l => `<polyline points="${poly(l)}" fill="none" stroke="#d9b556" stroke-width="8" stroke-linejoin="round"/>`).join("");
  const beads = [];
  lines.forEach(l => beadsAlong(l, 66).forEach(p => beads.push(p)));
  s += beads.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="19" fill="url(#g-or)" stroke="#3a2608" stroke-width="4"/>`).join("");
  s += `<circle cx="300" cy="318" r="36" fill="url(#g-or)" stroke="#3a2608" stroke-width="4"/>
        <circle cx="300" cy="318" r="23" fill="#2f8a4a" stroke="#123d20" stroke-width="3"/>`;
  return `<g clip-path="url(#clip-right)">${s}</g>`;
}
function lambel(){
  const pend = [175, 300, 425].map(cx => `<path d="M${cx - 24},90 L${cx + 24},90 L${cx + 36},182 L${cx - 36},182 Z"/>`).join("");
  return `<g fill="url(#g-argent)" stroke="#2a2a2a" stroke-width="5" stroke-linejoin="round"><rect x="92" y="54" width="416" height="38" rx="3"/>${pend}</g>`;
}
const GHOST = `<path d="${SHIELD}" fill="rgba(227,197,121,.07)" stroke="rgba(227,197,121,.7)" stroke-width="16" stroke-dasharray="36 24"/>`;

/* écu figé, pour les jetons de la frise */
function armsStatic(id){
  const a = DATA.armes[id];
  /* écu Commons d'un autre contour : montré entier, sans découpe ni filet */
  if(a.free) return `<image href="${commonsImg(a.file, 160)}" width="600" height="660" preserveAspectRatio="xMidYMid meet"/>`;
  let inner = "";
  if(a.file){
    inner = `<image href="${commonsImg(a.file, 160)}" width="600" height="660" preserveAspectRatio="none"/>`;
  } else {
    const field = `<rect width="600" height="660" fill="url(#g-azur)"/>`;
    const gold = body => `<g fill="url(#g-or)" stroke="#3a2608">${body}</g>`;
    switch(a.draw){
      case "aucune": return GHOST;
      case "embleme": return GHOST + `<g fill="rgba(227,197,121,.15)" stroke="#e3c579">${lisUse(300, 318, 3.1)}</g>`;
      case "ancien": inner = field + gold(SEME.map(([x, y]) => lisUse(x, y)).join("")); break;
      case "navarre-ancien": inner = field + gold(SEME.map(([x, y]) => lisUse(x, y)).join("")) + navarreHalf(); break;
      case "moderne": inner = field + gold(MODERNE.pts.map(([x, y]) => lisUse(x, y, MODERNE.s)).join("")); break;
      case "orleans": inner = field + gold(ORLEANS.pts.map(([x, y]) => lisUse(x, y, ORLEANS.s)).join("")) + lambel(); break;
    }
  }
  return `<g clip-path="url(#clip-shield)">${inner}<path d="${SHIELD}" fill="url(#g-relief)"/></g>
          <path d="${SHIELD}" fill="none" stroke="#120e08" stroke-width="12"/>`;
}

/* fleur de lis de Yorick (« Meuble héraldique Fleur de lys.svg », CC BY-SA 3.0), tracés inchangés */
const LIS_PATHS = `<g stroke-width="9">
    <path fill-rule="evenodd" d="M 407.02914,608.69929 C 408.45371,546.74328 423.7803,489.15982 452.31871,434.59069 C 527.03313,277.40489 755.23905,281.15895 704.93393,473.402 C 686.39707,544.24137 623.42532,585.87586 548.61507,593.01701 C 554.01466,574.35164 583.71536,508.36456 559.73954,495.45545 C 521.40138,496.90385 473.7952,563.16055 462.34672,594.75617 C 460.69402,599.29227 461.15631,604.53418 459.31088,608.99624"/>
    <g transform="translate(-38.53215,-44.5769)">
      <path fill-rule="evenodd" d="M 350.52292,657.37224 C 349.09835,595.41623 333.77176,537.83277 305.23335,483.26364 C 230.51893,326.07784 2.3130139,329.8319 52.618133,522.07495 C 71.154997,592.91432 134.12674,634.54881 208.93699,641.68996 C 203.5374,623.02459 173.8367,557.03751 197.81252,544.1284 C 236.15068,545.5768 283.75686,611.8335 295.20534,643.42912 C 296.85804,647.96522 296.39575,653.20713 298.24118,657.66919"/>
      <path d="M 393.6259,57.12017 C 314.9116,141.96961 262.06129,240.08175 284.84465,355.15142 C 297.41422,418.63533 327.88647,477.43115 349.3759,538.58892 C 362.81238,576.95877 366.24813,617.04065 364.65715,657.37017 L 431.4384,657.37017 C 428.24189,616.744 435.24511,577.37193 446.71965,538.58892 C 467.19384,477.05062 498.34544,418.68339 511.2509,355.15142 C 535.37892,236.37223 478.74399,146.7919 402.8134,57.49517 L 398.17297,51.576902 L 393.6259,57.12017 z"/>
      <path fill-rule="evenodd" d="M 331.34465,704.40142 C 317.38299,743.53144 260.45647,815.19349 230.21965,835.62017 C 222.37748,840.91802 267.70602,832.5686 288.0009,828.12017 C 314.61991,822.28553 349.21835,793.92258 348.40715,803.93267 C 348.33151,849.77093 361.21819,926.25691 394.8134,961.40142 L 397.99548,964.78902 L 401.28215,961.40142 C 434.85984,922.23047 447.51976,853.35944 447.6884,803.93267 C 446.8772,793.92258 481.47565,822.28553 508.09465,828.12017 C 528.38953,832.5686 573.71807,840.91802 565.8759,835.62017 C 535.63908,815.19349 478.74383,743.53144 464.78215,704.40142 L 331.34465,704.40142 z"/>
      <rect x="239.3521" y="655.37946" width="317.88773" height="51.503345"/>
    </g></g>`;

/* défs globales : la fleur de lis, dégradés, découpes, un symbole par armoirie ; plus le semé de fond */
function buildDefs(){
  const R0 = DATA.royaumes[0];
  const key = `<g transform="rotate(45)"><circle cy="-8" r="4.2"/><path d="M0,-3.8 V10 M0,5 h3.4 M0,8.4 h3.4"/></g><g transform="rotate(-45)"><circle cy="-8" r="4.2"/><path d="M0,-3.8 V10 M0,5 h-3.4 M0,8.4 h-3.4"/></g>`;
  const at = (x, y, s) => `<g transform="translate(${x},${y})">${s}</g>`;
  const SEMIS = {
    papaute: `<g fill="none" stroke="#e3c579" stroke-width="1.8" stroke-linecap="round">${at(16, 19, key)}${at(48, 57, key)}</g>`,
    habsbourg: [[16, 19], [48, 57]].map(([x, y]) => at(x, y, `<path d="M-8,-10h16v9c0,6-4,10-8,12c-4,-2-8,-6-8,-12z" fill="#b3261e" stroke="#e3c579" stroke-width="1.2"/><rect x="-8" y="-4.6" width="16" height="4.4" fill="#e9e5da"/>`)).join(""),
    angleterre: [[16, 19], [48, 57]].map(([x, y]) => at(x, y, [0, 72, 144, 216, 288].map(a => `<circle cx="${(6.4 * Math.cos((a - 90) * Math.PI / 180)).toFixed(2)}" cy="${(6.4 * Math.sin((a - 90) * Math.PI / 180)).toFixed(2)}" r="5" fill="#b3261e"/>`).join("") + `<circle r="5.4" fill="#efe6cf"/><circle r="2.2" fill="#e3c579"/>`)).join(""),
    savoie: `<g fill="#e3c579">${[[16, 19], [48, 57]].map(([x, y]) => at(x, y, `<path d="M-2.6,-9h5.2v6.4h6.4v5.2h-6.4v6.4h-5.2v-6.4h-6.4v-5.2h6.4z"/>`)).join("")}</g>`,
    ecosse: `<g stroke="#e8e4d4" stroke-width="2.6" stroke-linecap="round" fill="none">${[[16, 19], [48, 57]].map(([x, y]) => at(x, y, `<path d="M-6,-6L6,6M6,-6L-6,6"/>`)).join("")}</g>`,
    portugal: [[16, 19], [48, 57]].map(([x, y]) => at(x, y, `<path d="M-6,-8h12v10c0,5-3,8-6,10c-3,-2-6,-5-6,-10z" fill="#2a56a5" stroke="#e8e4d4" stroke-width="1.2"/><g fill="#e8e4d4"><circle cx="0" cy="-4" r="1.2"/><circle cx="-3" cy="-1" r="1.2"/><circle cx="3" cy="-1" r="1.2"/><circle cx="-2" cy="3" r="1.2"/><circle cx="2" cy="3" r="1.2"/></g>`)).join(""),
    espagne: `<g fill="#e3c579">${[[16, 19], [48, 57]].map(([x, y]) => at(x, y, `<rect x="-7" y="-2" width="14" height="11"/><rect x="-7" y="-6" width="3" height="5"/><rect x="-1.5" y="-6" width="3" height="5"/><rect x="4" y="-6" width="3" height="5"/>`)).join("")}</g>`,
    bourgogne: [[16, 19], [48, 57]].map(([x, y]) => at(x, y, `<path d="M-7,-9h14v10c0,5-3,8-7,11c-4,-3-7,-6-7,-11z" fill="#2a56a5" stroke="#b3261e" stroke-width="1.6"/><g stroke="#e3c579" stroke-width="2.4"><path d="M-6,-3L4,-8M-6,3L6,-3M-3,8L6,3"/></g>`)).join(""),
  };
  const semis = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 76">${SEMIS[R0.theme] ?? `<defs><symbol id="l" viewBox="10 4 698 920">${LIS_PATHS}</symbol></defs><g fill="#e3c579"><use href="#l" x="7" y="7" width="18" height="24"/><use href="#l" x="39" y="45" width="18" height="24"/></g>`}</svg>`;
  document.documentElement.style.setProperty("--semis", `url("data:image/svg+xml,${encodeURIComponent(semis)}")`);
  const grads = `
    <linearGradient id="g-azur" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="#3a70c2"/><stop offset=".55" stop-color="#21498f"/><stop offset="1" stop-color="#173a78"/></linearGradient>
    <linearGradient id="g-gules" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="#d23a2f"/><stop offset="1" stop-color="#8e1b18"/></linearGradient>
    <linearGradient id="g-or" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="#fbe7a1"/><stop offset=".4" stop-color="#e2bd58"/><stop offset=".7" stop-color="#b98e32"/><stop offset="1" stop-color="#f0d27f"/></linearGradient>
    <linearGradient id="g-argent" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#e6e2d8"/><stop offset=".75" stop-color="#c7c1b1"/><stop offset="1" stop-color="#f4f1ea"/></linearGradient>
    <radialGradient id="g-relief" cx="36%" cy="24%" r="85%"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></radialGradient>
    <linearGradient id="g-shine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <radialGradient id="g-plomb" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#c9ccd0"/><stop offset=".55" stop-color="#8d9298"/><stop offset="1" stop-color="#5a5f66"/></radialGradient>
    <clipPath id="clip-shield"><path d="${SHIELD}"/></clipPath>
    <clipPath id="clip-right"><rect x="300" y="0" width="300" height="660"/></clipPath>`;
  const syms = DATA.royaumes.some(isImg) ? "" : Object.keys(DATA.armes).map(id => `<symbol id="arms-${id}" viewBox="-8 -8 616 676">${armsStatic(id)}</symbol>`).join("");
  $("#gdefs").innerHTML = `<symbol id="lis" viewBox="10 4 698 920">${LIS_PATHS}</symbol>` + grads + syms + ornDefs();
}
/* couronnes et colliers des jetons, dans le repère de l'écu (600 × 660) : la couronne au-dessus, le collier autour */
function ornDefs(){
  const gold = `fill="url(#g-or)" stroke="#3a2608" stroke-width="6"`;
  const band = `<path d="M78,-64 H522 V0 H78 Z" ${gold}/><circle cx="170" cy="-32" r="14" fill="#b3261e" stroke="#3a2608" stroke-width="4"/><circle cx="300" cy="-32" r="16" fill="#2a56a5" stroke="#3a2608" stroke-width="4"/><circle cx="430" cy="-32" r="14" fill="#b3261e" stroke="#3a2608" stroke-width="4"/>`;
  const lisF = `<g fill="url(#g-or)" stroke="#3a2608">${lisUse(300, -128, 1.35)}${lisUse(112, -112, 1.05)}${lisUse(488, -112, 1.05)}</g>`;
  const pearls = [205, 395].map(x => `<circle cx="${x}" cy="-84" r="11" ${gold}/>`).join("");
  const pearlF = [112, 300, 488].map(x => `<circle cx="${x}" cy="-92" r="22" ${gold}/>`).join("");
  const arc = "M104,-66 C118,-262 482,-262 496,-66 M300,-66 V-262";
  const arches = `<g fill="none" stroke-linecap="round"><path d="${arc}" stroke="#3a2608" stroke-width="30"/><path d="${arc}" stroke="#e2bd58" stroke-width="18"/></g>`;
  const orb = `<circle cx="300" cy="-284" r="24" ${gold}/>`;
  const crossD = "M300,-308 V-368 M278,-342 H322";
  const cross = `<path d="${crossD}" stroke="#3a2608" stroke-width="16" stroke-linecap="round"/><path d="${crossD}" stroke="#e2bd58" stroke-width="8" stroke-linecap="round"/>`;
  const topLis = `<g fill="url(#g-or)" stroke="#3a2608">${lisUse(300, -336, .6)}</g>`;
  const cap = `<path d="M108,-64 C122,-236 478,-236 492,-64 Z" fill="#8e1b18"/>`;
  const pattee = (x, y, s) => `<path d="M${x - 7 * s},${y - 22 * s} h${14 * s} l${-4 * s},${15 * s} l${15 * s},${-4 * s} v${14 * s} l${-15 * s},${-4 * s} l${4 * s},${15 * s} h${-14 * s} l${4 * s},${-15 * s} l${-15 * s},${4 * s} v${-14 * s} l${15 * s},${4 * s} z" ${gold}/>`;
  const croixLis = [112, 300, 488].map(x => pattee(x, -100, 1.5)).join("") + `<g fill="url(#g-or)" stroke="#3a2608">${lisUse(206, -96, .7)}${lisUse(394, -96, .7)}</g>`;
  const crowns = {
    "ouverte": band + pearls + lisF,
    "fermee": arches + band + pearls + lisF + orb + topLis,
    "imperiale": cap + arches + band + pearlF + orb + cross,
    "fermee-sans-lis": arches + band + pearlF + orb + cross,
    "anglaise-ouverte": band + croixLis,
    "anglaise": cap + arches + band + croixLis + orb + cross,
  };
  const ell = (rx, ry, n) => Array.from({ length: n }, (_, k) => { const t = Math.PI * k / (n - 1); return [300 + rx * Math.cos(t), 190 + ry * Math.sin(t)]; });
  const beads = (pts, r, fill) => pts.map(([x, y], k) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${typeof fill === "function" ? fill(k) : fill}" stroke="#3a2608" stroke-width="4"/>`).join("");
  const sm = beads(ell(345, 560, 17), 17, "url(#g-or)") + `<ellipse cx="300" cy="772" rx="24" ry="30" ${gold}/>`;
  const se = beads(ell(392, 595, 21), 15, k => k % 2 ? "#4a78c8" : "url(#g-or)") + `<circle cx="300" cy="808" r="26" fill="#f4f1ea" stroke="#3a2608" stroke-width="5"/><circle cx="300" cy="808" r="9" fill="#4a78c8"/>`;
  const star = Array.from({ length: 10 }, (_, k) => { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 15 : 36; return `${(300 + rr * Math.cos(a)).toFixed(1)},${(792 + rr * Math.sin(a)).toFixed(1)}`; }).join(" ");
  const lh = `<path d="M645,190 A345,560 0 0 1 -45,190" fill="none" stroke="#6d1410" stroke-width="30"/><path d="M645,190 A345,560 0 0 1 -45,190" fill="none" stroke="#d63a2c" stroke-width="20"/><polygon points="${star}" fill="#f4f1ea" stroke="#3a2608" stroke-width="5"/><circle cx="300" cy="792" r="9" ${gold}/>`;
  /* Annonciade : roses et lacs d'amour alternés, médaillon ovale */
  const an = ell(345, 552, 19).map(([x, y], k) => k % 2
    ? `<g fill="url(#g-or)" stroke="#3a2608" stroke-width="4"><circle cx="${(x - 8).toFixed(1)}" cy="${y.toFixed(1)}" r="9"/><circle cx="${(x + 8).toFixed(1)}" cy="${y.toFixed(1)}" r="9"/></g>`
    : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="14" ${gold}/>`).join("")
    + `<ellipse cx="300" cy="782" rx="28" ry="36" ${gold}/><ellipse cx="300" cy="782" rx="17" ry="25" fill="#f4f1ea" stroke="#3a2608" stroke-width="3"/>`;
  /* Toison d'or : briquets et pierres à feu alternés, bélier suspendu */
  const to = ell(345, 552, 23).map(([x, y], k) => k % 2
    ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="#c23a2c" stroke="#3a2608" stroke-width="4"/>`
    : `<rect x="${(x - 12).toFixed(1)}" y="${(y - 8).toFixed(1)}" width="24" height="16" rx="6" ${gold}/>`).join("")
    + `<path d="M262,790 C262,770 338,770 338,790 L330,806 L270,806 Z M286,806 V826 M314,806 V826" ${gold}/><circle cx="300" cy="770" r="10" ${gold}/>`;
  const collars = { "sm": sm, "sm-se": sm + se, "lh": lh, "annonciade": an, "toison": to,
    /* Jarretière : courroie d'azur bordée d'or autour de l'écu, boucle en pointe */
    "jarretiere": `<ellipse cx="300" cy="345" rx="352" ry="380" fill="none" stroke="#3a2608" stroke-width="58"/><ellipse cx="300" cy="345" rx="352" ry="380" fill="none" stroke="#d9b556" stroke-width="50"/><ellipse cx="300" cy="345" rx="352" ry="380" fill="none" stroke="#1f3f8f" stroke-width="40"/><ellipse cx="300" cy="345" rx="352" ry="380" fill="none" stroke="#d9b556" stroke-width="3" stroke-dasharray="4 22"/><rect x="268" y="700" width="64" height="52" rx="8" fill="none" stroke="#d9b556" stroke-width="12"/><path d="M300,752 L286,830 H314 Z" fill="#1f3f8f" stroke="#d9b556" stroke-width="6"/>` };
  return Object.entries(crowns).map(([k, v]) => `<g id="crown-${k}">${v}</g>`).join("") +
         Object.entries(collars).map(([k, v]) => `<g id="collar-${k}">${v}</g>`).join("");
}
const armsIcon = id => `<svg viewBox="-8 -8 616 676" aria-hidden="true"><use href="#arms-${id}"/></svg>`;
/* jeton de la frise : l'écu, sa couronne et son collier au milieu de la période */
function tokenIcon(R, id, y, r){
  if(isImg(R)){
    const a = DATA.armes[id];
    return a.file ? `<img src="${commonsImg(a.file, 90)}" alt="" loading="lazy" draggable="false">` : sealSvg(r, false);
  }
  const cr = ornAt(R, "couronne", y), co = ornAt(R, "colliers", y);
  return `<svg viewBox="-110 -380 820 1220" aria-hidden="true">${co ? `<use href="#collar-${co.type}"/>` : ""}<use href="#arms-${id}" x="-8" y="-8" width="616" height="676"/>${cr ? `<use href="#crown-${cr.type}"/>` : ""}</svg>`;
}

/* écu central, animé */
function bigSvg(){
  const semis = SEME.map((p, i) => `<g class="lis" data-i="${i}">${lisUse(0, 0)}</g>`).join("");
  const files = Object.entries(DATA.armes).filter(([, a]) => a.file);
  const image = ([id, a]) => `<image class="b-img" data-k="${id}" href="${commonsImg(a.file, 600)}" width="600" height="660" preserveAspectRatio="${a.free ? "xMidYMid meet" : "none"}"/>`;
  const imgs = files.filter(([, a]) => !a.free).map(image).join("");
  const free = files.filter(([, a]) => a.free).map(image).join("");
  return `<svg class="big" viewBox="-14 -14 628 688" role="img" aria-label="Armoiries du règne sous la ligne de lecture">
    <g clip-path="url(#clip-shield)">
      <rect class="b-field" width="600" height="660"/>
      <g class="b-semis" fill="url(#g-or)" stroke="#3a2608">${semis}</g>
      <g class="b-nav">${navarreHalf()}</g>
      <g class="b-lambel">${lambel()}</g>
      ${imgs}
      <path class="b-relief" d="${SHIELD}" fill="url(#g-relief)"/>
      <rect class="b-shine" x="-280" y="-60" width="170" height="800" fill="url(#g-shine)"/>
    </g>
    <path class="b-outline" d="${SHIELD}"/>
    ${free}
  </svg>`;
}
function setBig(svg, armsId){
  const a = armsId ? DATA.armes[armsId] : null;
  const st = !a ? "vide" : a.file ? (a.free ? "free" : "img") : a.draw;
  svg.dataset.state = st;
  const hidden = s => SEME.map(([x, y]) => ({ x, y, s, o: 0 }));
  let tg;
  if(st === "ancien" || st === "navarre-ancien") tg = SEME.map(([x, y]) => ({ x, y, s: 1, o: 1 }));
  else if(st === "moderne" || st === "orleans"){
    const P = st === "moderne" ? MODERNE : ORLEANS;
    tg = hidden(.25);
    MAP3.forEach((i, k) => { tg[i] = { x: P.pts[k][0], y: P.pts[k][1], s: P.s, o: 1 }; });
  }
  else if(st === "embleme"){ tg = hidden(.25); tg[CENTER_I] = { x: 300, y: 318, s: 3.1, o: 1 }; }
  else tg = hidden(st === "img" || st === "free" ? 1 : .25);
  svg.querySelectorAll(".lis").forEach((g, i) => {
    const t = tg[i];
    g.style.transform = `translate(${t.x}px,${t.y}px) scale(${t.s})`;
    g.style.opacity = t.o;
    g.style.transitionDelay = REDUCE ? "0s" : `${(i * 37) % 260}ms`;
  });
  svg.querySelectorAll(".b-img").forEach(im => im.classList.toggle("on", !!a && im.dataset.k === armsId));
  svg.classList.toggle("nav-on", st === "navarre-ancien");
  svg.classList.toggle("lambel-on", st === "orleans");
  if(!REDUCE){ svg.classList.remove("shine"); void svg.getBoundingClientRect(); svg.classList.add("shine"); }
}

/* ---------- données ---------- */
function prepare(R){
  R.maisonsById = Object.fromEntries(R.maisons.map((m, i) => [m.id, { ...m, idx: i }]));
  const today = new Date().toISOString().slice(0, 10);
  R.regnes.forEach((r, i) => {
    if(r.fin == null){ r.fin = today; r.encours = true; }
    r.i = i; r.s = yr(r.debut); r.e = yr(r.fin); r.eAct = endAct(r.fin);
    r.ph = (r.phases || [{ debut: r.debut, fin: r.fin, armes: r.armes }])
      .map(p => ({ ...p, s: yr(p.debut), e: yr(p.fin) }));
  });
  /* vacances ordinaires entre deux règnes, quand la lignée le demande (sede vacante) */
  if(R.videAuto){
    const ord = [...R.regnes].sort((a, b) => a.s - b.s);
    const known = R.vides.map(v => [yr(v.debut), endAct(v.fin)]);
    for(let k = 0; k < ord.length - 1; k++){
      const a = ord[k], b = ord[k + 1];
      if(b.s - a.eAct <= 1 / 365.25) continue;
      if(known.some(([s, e]) => s < b.s && e > a.eAct)) continue;
      R.vides.push({ ...R.videAuto, debut: a.fin, fin: b.debut, auto: true });
    }
  }
  R.vides.forEach(v => { v.vide = true; v.s = yr(v.debut); v.e = yr(v.fin); v.eAct = endAct(v.fin); });
  (R.rivaux || []).forEach((r, k) => { r.k = k; r.s = yr(r.debut); r.e = Math.max(yr(r.fin), r.s + .04); });
  if(R.kin){
    R.kinOf = {};
    R.regnes.forEach(r => { if(!r.suite && DATA.armes[r.armes]?.file) (R.kinOf[r.armes] ||= []).push(r); });
  }
  R.jalons.forEach((j, k) => { j.k = k; j.y = yr(j.annee); });
  (R.grandesArmes || []).forEach(g => { g.s = yr(g.debut); g.e = yr(g.fin); });
  (R.ornements || []).forEach(row => row.segs.forEach(s => { s.s = yr(s.debut); s.e = yr(s.fin); }));
  R.order = [...R.regnes].sort((a, b) => a.s - b.s);
  R.first = R.order[0].s;
  R.segs = bandSegments(R);
}
/* qui règne à l'instant Y : le règne actif commencé le plus tard (gère restaurations et Cent-Jours) */
function stateAt(R, Y){
  Y = Math.max(Y, R.first);
  let best = null;
  for(const o of [...R.regnes, ...R.vides]) if(o.s <= Y && Y < o.eAct && (!best || o.s > best.s)) best = o;
  if(!best) return null;
  if(best.vide) return { item: best, armes: best.armes || null, ph: null };
  return stateOf(best, Y);
}
function stateOf(r, Y){
  let ph = r.ph[0];
  for(const p of r.ph) if(p.s <= Y) ph = p;
  return { item: r, armes: ph.armes, ph };
}
/* périodes sans chevauchement : grandes armes, ornements */
const within = (list, Y) => (list || []).find(o => o.s <= Y && Y < o.e) || null;
const gaAt = (R, Y) => within(R.grandesArmes, Y);
const ornAt = (R, id, Y) => within((R.ornements || []).find(o => o.id === id)?.segs, Y);
const rivalsAt = (R, Y) => (R.rivaux || []).filter(r => r.s <= Y && Y < r.e);
function bandSegments(R){
  const pts = new Set([R.debut, R.fin]);
  [...R.regnes, ...R.vides].forEach(o => { pts.add(o.s); pts.add(o.e); pts.add(o.eAct); (o.ph || []).forEach(p => pts.add(p.s)); });
  const xs = [...pts].filter(v => v >= R.debut && v <= R.fin).sort((a, b) => a - b);
  const segs = [];
  for(let i = 0; i < xs.length - 1; i++){
    const st = stateAt(R, (xs[i] + xs[i + 1]) / 2);
    const key = st ? (st.item.vide ? "v:" + st.item.nom : st.armes) : "none";
    const last = segs[segs.length - 1];
    if(last && last.key === key) last.e = xs[i + 1];
    else segs.push({ s: xs[i], e: xs[i + 1], key, st });
  }
  return segs;
}
const srcLinks = ids => (ids || []).map(id => DATA.sources[id]).filter(Boolean)
  .map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${txt(s.label)}</a>`).join(" · ");
const srcLabels = ids => (ids || []).map(id => DATA.sources[id]?.label).filter(Boolean).map(esc).join(" · ");
const credit = f => `<a href="${commonsPage(f.file)}" target="_blank" rel="noopener">« ${txt(f.file)} »</a> — ${txt(f.auteur)}, ${f.licurl ? `<a href="${esc(f.licurl)}" target="_blank" rel="noopener">${txt(f.lic)}</a>` : txt(f.lic)}`;

/* ---------- infobulle ---------- */
const tip = $("#tip");
let tipTimer = 0;
function showTip(html, el){
  clearTimeout(tipTimer);
  tip.innerHTML = html;
  const r = el.getBoundingClientRect();
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  const x = clamp(r.left + r.width / 2 - tw / 2, 8, innerWidth - tw - 8);
  let y = r.top - th - 12;
  if(y < 8) y = r.bottom + 12;
  tip.style.left = x + "px"; tip.style.top = y + "px";
  tip.classList.add("on");
}
function hideTip(){ tip.classList.remove("on"); }

function houseLine(R, r){
  const m = R.maisonsById[r.maison], parts = [];
  if(R.ordinal && r.num) parts.push(`${r.num === 1 ? "1ᵉʳ" : r.num + "ᵉ"} ${W(R, "souverain")}`);
  if(m?.nom) parts.push(m.nom);
  if(r.branche) parts.push(r.branche);
  return parts.map(txt).join(" · ");
}
const APOST = "A posteriori : armes prêtées après coup, que ce pape n'a pas portées.";
function tipReign(R, r){
  const parts = r.ph.map(p => {
    const a = DATA.armes[p.armes];
    const when = r.ph.length > 1 ? `${spanTxt(p)} · ` : "";
    return `<div class="t-arms">${when}${txt(a.nom)}${a.apost ? " · a posteriori" : ""}</div>` +
      (a.blason ? `<div class="t-bl${a.blason.length > 180 ? " long" : ""}">« ${txt(a.blason)} »</div>` : `<div class="t-bl dim">${a.apost ? "Armes inventées après coup, non blasonnées par les sources lues" : "Pas d'armoiries attestées"}</div>`);
  }).join("");
  const mid = (r.s + r.e) / 2;
  const orn = isImg(R)
    ? (R.ornements || []).map(row => ornAt(R, row.id, mid)?.label).filter(Boolean)
    : [["couronne", "couronne "], ["tenants", ""], ["supports", ""], ["colliers", "collier "]]
      .map(([id, pre]) => { const s = ornAt(R, id, mid); return s ? pre + s.label : ""; }).filter(Boolean);
  const d = r.devise;
  return `<div class="t-house">${houseLine(R, r)}</div>
    <div class="t-name">${txt(r.nom)}</div>
    <div class="t-dates">${txt(spanLong(r))} · ${duree(r)}${r.encours ? " (en cours)" : ""}</div>
    ${parts}
    ${orn.length ? `<div class="t-orn">${isImg(R) ? "Ornements" : "Autour de l'écu"} : ${txt(orn.join(" · "))}</div>` : ""}
    ${d ? `<div class="t-orn">${d.embleme ? "Emblème : " + txt(d.embleme) : ""}${d.embleme && d.mot ? " · " : ""}${d.mot ? `devise « ${txt(d.mot)} »` : ""}</div>` : ""}
    ${r.avant ? `<div class="t-orn">Avant le trône : ${txt(r.avant.map(a => a.titre).join(", puis "))}</div>` : ""}
    ${r.note ? `<div class="t-note">${txt(r.note)}</div>` : ""}
    <div class="t-hint">Écu : centrer · nom : Wikipédia ↗</div>`;
}
function tipOrn(row, s){
  return `<div class="t-house">${txt(row.nom)}</div><div class="t-name">${txt(s.label)}</div>
    <div class="t-dates">${txt(spanTxt(s))}${s.flou ? " · début sans date précise" : ""}</div>
    <div class="t-bl" style="font-style:normal;font-size:.92rem">${txt(s.texte)}</div>
    <div class="t-note">${srcLabels(s.sources)}</div>`;
}
function tipDevise(r){
  const d = r.devise;
  return `<div class="t-house">Devise · ${txt(r.court)}</div>
    ${d.embleme ? `<div class="t-arms">${txt(d.embleme)}</div>` : ""}
    ${d.mot ? `<div class="t-bl">« ${txt(d.mot)} »</div>` : ""}
    ${d.trad ? `<div class="t-dates">${txt(d.trad)}</div>` : ""}
    ${d.texte ? `<div class="t-note">${txt(d.texte)}</div>` : ""}`;
}
function tipAvant(a){
  return `<div class="t-house">Avant le trône</div><div class="t-name">${txt(a.titre)}</div>
    ${a.dates ? `<div class="t-dates">${txt(a.dates)}</div>` : ""}
    <div class="t-bl">« ${txt(a.blason)} »</div>
    ${a.note ? `<div class="t-note">${txt(a.note)}</div>` : ""}`;
}
function tipSeg(R, seg){
  const span = `${Math.floor(seg.s)} – ${Math.floor(seg.e)}`;
  if(seg.st?.item.vide){
    const v = seg.st.item;
    return `<div class="t-house">${txt(W(R, "sans"))}</div><div class="t-name">${txt(v.nom)}</div><div class="t-dates">${txt(spanLong(v))}</div>${v.note ? `<div class="t-note">${txt(v.note)}</div>` : ""}`;
  }
  const a = DATA.armes[seg.key];
  return `<div class="t-house">${txt(W(R, "armesDe"))}${a.apost ? " · a posteriori" : ""}</div><div class="t-name">${txt(a.nom)}</div><div class="t-dates">${span}</div>
    ${a.blason ? `<div class="t-bl">« ${txt(a.blason)} »</div>` : ""}
    ${a.note && !isImg(R) ? `<div class="t-note">${txt(a.note)}</div>` : ""}`;
}
function tipRival(r){
  const a = r.armes ? DATA.armes[r.armes] : null;
  return `<div class="t-house">${txt(r.label || (r.type === "éphémère" ? "Pape éphémère" : "Antipape"))}${r.obedience ? " · obédience " + txt(deOf(r.obedience)) : ""}</div>
    <div class="t-name">${txt(r.nom)}</div><div class="t-dates">${txt(spanLong(r))}</div>
    ${a ? `<div class="t-arms">${txt(a.nom)}</div>${a.blason ? `<div class="t-bl">« ${txt(a.blason)} »</div>` : ""}${a.desaccord ? `<div class="t-note"><b>Désaccord :</b> ${txt(a.desaccord)}</div>` : ""}` : ""}
    ${r.type === "éphémère" ? `<div class="t-note">Élu mais jamais consacré : la liste ne le compte pas parmi les papes.</div>` : ""}
    ${r.note ? `<div class="t-note">${txt(r.note)}</div>` : ""}`;
}
function tipJalon(j){
  return `<div class="t-house">Jalon · ${txt(j.label || Math.floor(j.y))}</div><div class="t-name">${txt(j.titre)}</div>
    <div class="t-bl" style="font-style:normal;font-size:.92rem">${txt(j.texte)}</div>
    ${j.desaccord ? `<div class="t-note"><b>Désaccord :</b> ${txt(j.desaccord)}</div>` : ""}
    <div class="t-note">${srcLabels(j.sources)}</div>`;
}

/* ---------- une frise par royaume ---------- */
function buildRealm(R){
  const sec = document.createElement("section");
  sec.className = "stage" + (R.theme ? " theme-" + R.theme : ""); sec.id = "r-" + R.id;
  const img = isImg(R), hasGA = !!R.grandesArmes?.length;
  const viewerHTML = img
    ? `<div class="pv" role="img" aria-label="Armoiries du pontificat sous la ligne de lecture"><img alt=""><img alt=""><div class="pv-seal"></div><span class="pv-stamp">a posteriori</span></div>`
    : bigSvg();
  const hint = img
    ? "La ligne d'or est le présent de la frise : l'écu et le cartouche suivent le pontificat qu'elle traverse. Les écus tramés ou sablés sont a posteriori ; les sceaux de plomb numérotés marquent les papes sans armoiries. Sous les papes, les antipapes ; en rouge et or, les vacances du Siège."
    : "La ligne d'or est le présent de la frise : l'écu et le cartouche suivent le règne qu'elle traverse. Sous la bande des armes, les ornements ; sous les règnes, les devises.";
  sec.innerHTML = `
    <div class="stage-in">
      <header class="stage-head">
        <p class="eyebrow">${txt(R.nom)} · ${Math.floor(R.first)} – ${Math.floor(Math.max(...R.regnes.map(r => r.e)))}</p>
        <h2>${txt(R.titre)}</h2>
        <p class="lede">${txt(R.lede)}</p>
        <p class="stage-links"><a href="chronologie.html#l=${FRISE.id}${DATA.royaumes.length > 1 ? "-" + R.id : ""}">Les repères de cette lignée dans la chronologie →</a></p>
      </header>
      <div class="viewer">
        <div class="big-wrap">
          <div class="big-stage">${viewerHTML}<div class="ga-view"><img alt=""><img alt=""><p class="ga-empty" hidden></p></div></div>
          <div class="vtabs" role="group" aria-label="Affichage"${hasGA ? "" : " hidden"}><button type="button" data-m="ecu" class="on" aria-pressed="true">Écu</button><button type="button" data-m="ga" aria-pressed="false">Grandes armes</button></div>
        </div>
        <div class="panel" aria-live="polite"></div>
        <aside class="side" aria-label="Ornements, armes d'avant le trône et devise"></aside>
      </div>
      <div class="toast" aria-live="polite"></div>
    </div>
    <div class="frise">
      <div class="track" tabindex="0" aria-label="Frise des règnes : flèches gauche et droite pour passer d'un règne à l'autre, plus et moins pour zoomer"><div class="canvas"></div></div>
      <div class="reader"><span class="r-year"></span></div>
    </div>
    <div class="stage-in">
      <div class="controls">
        <button class="cbtn c-play invite" type="button"><span class="ic">▶</span><span class="lb">Parcourir</span></button>
        <button class="cbtn sq c-prev" type="button" aria-label="Règne précédent">‹</button>
        <button class="cbtn sq c-next" type="button" aria-label="Règne suivant">›</button>
        <div class="minimap" role="slider" aria-label="Position dans le temps" tabindex="-1"><div class="mm-in"></div><div class="mm-win"></div></div>
        <button class="cbtn sq c-out" type="button" aria-label="Dézoomer">−</button>
        <button class="cbtn sq c-in" type="button" aria-label="Zoomer">+</button>
        <button class="cbtn c-fit" type="button">Tout voir</button>
      </div>
      <p class="hint">${hint}</p>
    </div>`;
  $("#royaumes").appendChild(sec);

  const T = {
    R, sec, ppy: R.zoom ?? 8.5, key: "", armsKey: undefined, raf: 0, play: 0, ac: new AbortController(),
    track: $(".track", sec), canvas: $(".canvas", sec), big: $(img ? ".pv" : ".big", sec), panel: $(".panel", sec),
    bigWrap: $(".big-wrap", sec), gaView: $(".ga-view", sec), side: $(".side", sec), mode: "ecu", cardTab: "ga",
    toast: $(".toast", sec), year: $(".r-year", sec), mm: $(".minimap", sec), mmIn: $(".mm-in", sec), mmWin: $(".mm-win", sec),
  };
  T.X = y => T.padL + (y - R.debut) * T.ppy;
  layout(T);
  buildMini(T);
  wire(T);
  if(!img) setBig(T.big, null);
  jumpTo(T, R.depart ?? 1248);
  /* l'écu « éclot » la première fois qu'il entre dans l'écran ; seuil sur l'écu seul, qui tient toujours dans la fenêtre */
  T.seen = REDUCE || !("IntersectionObserver" in window);
  if(!T.seen){
    const io = T.io = new IntersectionObserver(es => {
      if(!es.some(e => e.isIntersecting)) return;
      io.disconnect(); T.seen = true; T.armsKey = undefined; update(T);
    }, { threshold: .4 });
    io.observe(T.big);
  }
  requestAnimationFrame(() => update(T, true));
  return T;
}

function layout(T){
  const R = T.R, VW = T.track.clientWidth || innerWidth;
  T.padL = Math.round(VW / 2);
  const X = T.X;
  const width = Math.round(T.padL * 2 + (R.fin - R.debut) * T.ppy);
  let h = "";

  /* règle : graduations et filigrane des siècles */
  const step = T.ppy >= 12 ? 5 : T.ppy >= 5 ? 10 : 25;
  const labelEvery = T.ppy >= 12 ? 25 : T.ppy >= 5 ? 50 : 100;
  let ruler = "", wm = "";
  for(let y = Math.ceil(R.debut / step) * step; y <= R.fin; y += step){
    const cls = y % 100 === 0 ? "maj" : y % 50 === 0 ? "mid" : "";
    ruler += `<div class="tick ${cls}" style="left:${X(y)}px">${y % labelEvery === 0 ? `<span>${y}</span>` : ""}</div>`;
  }
  for(let c = Math.floor(R.debut / 100); c * 100 <= R.fin; c++){
    const mid = clamp(c * 100 + 50, R.debut, R.fin);
    wm += `<div class="wm" style="left:${X(mid)}px">${roman(c + 1)}<small style="font-size:.3em;vertical-align:top">e</small></div>`;
  }
  h += `<div class="ruler">${ruler}</div>`;

  /* bande des armes du royaume */
  const img = isImg(R);
  h += `<div class="band"><div class="row-label">${txt(W(R, "bande"))}</div>${R.segs.map((sg, i) => {
    const x1 = X(sg.s), w = Math.max(2, X(sg.e) - x1);
    const isV = sg.st?.item.vide;
    const a = isV ? DATA.armes[sg.st.item.armes] : DATA.armes[sg.key];
    const label = isV ? sg.st.item.nom : a?.nom || "";
    let cls = isV ? " vide" : "", sty = "";
    if(img){
      if(isV && sg.st.item.armes === "sede-vacante") cls += " ombr";
      if(!isV && a?.gravure) cls += " grav";
      if(!isV && a?.apost) cls += " apost";
      if(!isV && a?.champ) sty = `;background:${champCss(a)}`;
    }
    return `<div class="seg${cls}" data-seg="${i}" data-k="${esc(sg.key)}" style="left:${x1}px;width:${w - 2}px${sty}">${w > 70 ? `<span>${txt(label)}</span>` : ""}</div>`;
  }).join("")}</div>`;

  /* ornements extérieurs : une ligne par élément (couronne, tenants, supports, colliers, manteau) */
  const ORN = R.ornements || [];
  h += `<div class="orn">${ORN.map((row, ri) => `<div class="orow"><div class="row-label">${txt(row.nom)}</div>${row.segs.map((s, si) => {
    const x1 = X(s.s), w = Math.max(3, X(Math.min(s.e, R.fin)) - x1);
    return `<div class="os${s.flou ? " flou" : ""}" data-r="${ri}" data-s="${si}" data-t="${esc(s.type)}" style="left:${x1}px;width:${w}px">${w > 64 ? `<span>${txt(s.label)}</span>` : ""}</div>`;
  }).join("")}</div>`).join("")}</div>`;
  const ORN_H = ORN.length ? ORN.length * OROW_H + 7 : 0;

  /* les règnes sur une seule ligne (ils se succèdent sans se chevaucher) ; les écus s'étagent
     pour ne pas se couvrir ; en vue d'ensemble, ils perdent leur nom pour se serrer */
  const compact = T.ppy < 3.4;
  const tw = compact ? 40 : TW, th = compact ? 46 : TIER_H;
  T.canvas.classList.toggle("compact", compact);
  const rs = R.regnes.filter(r => !r.suite).map(r => ({ r, cx: (X(r.s) + X(r.e)) / 2 })).sort((a, b) => a.cx - b.cx);
  const right = [], MAXT = img ? 5 : 4;
  rs.forEach(t => {
    let tier = right.findIndex(v => v + 4 <= t.cx - tw / 2);
    if(tier < 0){ if(right.length < MAXT){ tier = right.length; right.push(0); } else tier = right.indexOf(Math.min(...right)); }
    right[tier] = t.cx + tw / 2; t.tier = tier;
  });
  const laneH = 30 + Math.max(1, right.length) * th;
  let lane = "";
  R.regnes.forEach(r => {
    const m = R.maisonsById[r.maison];
    const bx = X(r.s), bw = Math.max(3, X(r.e) - bx);
    const ph = r.ph.slice(1).map(p => `<i class="ph" style="left:${X(p.s) - bx - 1}px"></i>`).join("");
    lane += `<div class="bar${r.suite ? " suite" : ""}" data-i="${r.i}" style="left:${bx}px;width:${bw}px;--c:${m.couleur}">${ph}</div>`;
  });
  rs.forEach(({ r, cx, tier }) => {
    const seen = new Set();
    const icons = r.ph.filter(p => !seen.has(p.armes) && seen.add(p.armes))
      .map(p => tokenIcon(R, p.armes, (p.s + Math.min(p.e, r.e)) / 2, r)).join("");
    const a0 = DATA.armes[r.ph[0].armes];
    const aria = `${r.nom}, ${spanTxt(r)}, ${a0.nom}${a0.apost ? " (a posteriori)" : ""}${a0.blason ? " : " + a0.blason : ""}`;
    lane += `<div class="reign${img && a0.apost ? " apost" : ""}" data-i="${r.i}" data-a="${esc(r.ph[0].armes)}" style="left:${cx}px;bottom:${22 + tier * th}px;--stem:${5 + tier * th}px">
      <button class="rb" type="button" aria-label="${esc(aria)}">${icons}</button>
      <a class="rn" href="${wikiUrl(r.wiki)}" target="_blank" rel="noopener" draggable="false">${txt(r.court)}</a>
    </div>`;
  });
  h += `<div class="lane" style="height:${laneH}px">${lane}</div>`;

  /* rivaux (antipapes) : une ligne à part, colorée par obédience */
  if(R.rivaux?.length){
    const rv = R.rivaux.map(r => {
      const x1 = X(r.s), w = Math.max(5, X(r.e) - x1), a = r.armes ? DATA.armes[r.armes] : null;
      const ob = r.obedience ? " ob-" + r.obedience.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
      return `<div class="rv${ob}${r.type === "éphémère" ? " eph" : ""}" data-k="${r.k}" tabindex="0" style="left:${x1}px;width:${w}px" aria-label="${esc(r.nom + ", " + spanTxt(r))}">${a?.file ? `<img src="${commonsImg(a.file, 60)}" alt="" loading="lazy" draggable="false">` : ""}${w > 64 ? `<span>${txt(r.court)}</span>` : ""}</div>`;
    }).join("");
    h += `<div class="rivrow"><div class="row-label">${txt(W(R, "rivaux"))}</div>${rv}</div>`;
  }

  /* devises et emblèmes personnels : un médaillon par roi qui en a une de sourcée */
  const dms = R.regnes.filter(r => r.devise && !r.suite).map(r => {
    const d = r.devise, cx = (X(r.s) + X(r.e)) / 2;
    const aria = `Devise ${deOf(r.nom)}${d.mot ? " : " + d.mot : ""}${d.embleme ? ", emblème " + d.embleme : ""}`;
    return `<button class="dm" type="button" data-i="${r.i}" style="left:${cx}px" aria-label="${esc(aria)}">${d.file ? `<img src="${commonsImg(d.file, 80)}" alt="" loading="lazy" draggable="false">` : "✦"}</button>`;
  }).join("");
  if(dms) h += `<div class="devrow"><div class="row-label">${txt(W(R, "devises"))}</div>${dms}</div>`;

  /* bande des maisons : chaque passage d'une maison à l'autre */
  const runs = [];
  R.order.forEach(r => {
    const last = runs[runs.length - 1];
    if(last && last.m === r.maison && r.s - last.e < 1) last.e = Math.max(last.e, r.e);
    else runs.push({ m: r.maison, s: r.s, e: r.e });
  });
  h += `<div class="houses"><div class="row-label">${txt(W(R, "maisons"))}</div>${runs.map(u => {
    const m = R.maisonsById[u.m], x1 = X(u.s), w = Math.max(2, X(u.e) - x1);
    return `<div class="hs" style="left:${x1}px;width:${w}px;--c:${m.couleur}">${w > 60 && m.nom ? `<span>${txt(m.nom)}</span>` : ""}</div>`;
  }).join("")}</div>`;

  /* zones sans souverain, jalons */
  const gaps = R.vides.map(v => `<div class="gapzone" style="left:${X(v.s)}px;width:${X(Math.min(v.e, R.fin)) - X(v.s)}px;top:${RULER_H + BAND_H + ORN_H}px"></div>`).join("");
  const jl = R.jalons.map(j => `<div class="jl" style="left:${X(j.y)}px"></div>`).join("");
  const jm = R.jalons.map(j => `<button class="jm" type="button" data-j="${j.k}" style="left:${X(j.y)}px;top:${RULER_H - 7}px;bottom:auto" aria-label="${esc((j.label || Math.floor(j.y)) + " — " + j.titre)}"><i></i></button>`).join("");

  T.canvas.style.width = width + "px";
  T.canvas.innerHTML = wm + gaps + jl + h + jm;
  T.tokens = [...T.canvas.querySelectorAll(".reign")];
  T.bars = [...T.canvas.querySelectorAll(".bar")];
  T.dms = [...T.canvas.querySelectorAll(".dm")];
  T.marks = [...T.canvas.querySelectorAll(".jm")];
  T.rvs = [...T.canvas.querySelectorAll(".rv")];
}
function roman(n){
  const t = [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
  let s = ""; for(const [v, r] of t) while(n >= v){ s += r; n -= v; } return s;
}

/* ---------- mini-carte ---------- */
function buildMini(T){
  const R = T.R, span = R.fin - R.debut, pc = y => ((y - R.debut) / span * 100).toFixed(3) + "%";
  const segs = R.segs.map(sg => {
    const isV = sg.st?.item.vide, a = isV ? null : DATA.armes[sg.key];
    const cls = isV ? " vide" + (sg.st.item.armes === "sede-vacante" ? " ombr" : "") : a?.gravure ? " grav" : "";
    const sty = isImg(R) && a?.champ ? `;background:${champCss(a)}` : "";
    return `<div class="mm-seg seg${cls}" data-k="${esc(sg.key)}" style="left:${pc(sg.s)};width:calc(${pc(sg.e)} - ${pc(sg.s)})${sty}"></div>`;
  }).join("");
  const bars = R.regnes.map(r => {
    const m = R.maisonsById[r.maison];
    return `<div class="mm-bar" style="left:${pc(r.s)};width:max(2px,calc(${pc(r.e)} - ${pc(r.s)}));top:${20 + (R.maisons.length > 7 ? m.idx % 5 : m.idx) * 3.6}px;background:${m.couleur}"></div>`;
  }).join("");
  T.mmIn.innerHTML = segs + bars;
}

/* ---------- lecture de la position ---------- */
const centerYear = T => (T.track.scrollLeft + T.track.clientWidth / 2 - T.padL) / T.ppy + T.R.debut;
function jumpTo(T, Y){ T.track.scrollLeft = T.X(Y) - T.track.clientWidth / 2; }
function glideTo(T, Y, ms = 750){
  cancelAnimationFrame(T.glide);
  if(T.pin?.y !== Y) T.pin = null;
  const from = T.track.scrollLeft, to = clamp(T.X(Y) - T.track.clientWidth / 2, 0, T.track.scrollWidth - T.track.clientWidth);
  const land = () => { if(T.pin){ T.pin.sl = T.track.scrollLeft; schedule(T); } };
  if(REDUCE || Math.abs(to - from) < 2){ T.track.scrollLeft = to; land(); return; }
  const t0 = performance.now();
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const step = now => {
    const t = Math.min(1, (now - t0) / ms);
    T.track.scrollLeft = from + (to - from) * ease(t);
    if(t < 1) T.glide = requestAnimationFrame(step); else land();
  };
  T.glide = requestAnimationFrame(step);
}
/* un pixel vaut des semaines : le règne cliqué reste épinglé tant que la frise ne bouge pas */
function goReign(T, r){
  const y = (r.s + Math.min(r.e, T.R.fin)) / 2;
  setPlay(T, false);
  T.pin = { r, y, sl: NaN };
  glideTo(T, y);
}
const pinned = T => T.pin && Math.abs(T.track.scrollLeft - T.pin.sl) <= 1;
function readState(T, Y){
  if(pinned(T)) return stateOf(T.pin.r, T.pin.y);
  const st = stateAt(T.R, Y);
  if(!st?.item.vide || !T.R.videAuto) return st;
  /* une vacance plus courte qu'un pixel ne doit pas masquer le pontificat qu'elle touche */
  const h = .5 / T.ppy;
  let best = null;
  for(const r of T.R.regnes)
    if(r.s < Y + h && r.eAct > Y - h && (!best || Math.abs(r.s + r.e - 2 * Y) < Math.abs(best.s + best.e - 2 * Y))) best = r;
  return best ? stateOf(best, clamp(Y, best.s, best.e)) : st;
}
const schedule = T => { if(!T.raf) T.raf = requestAnimationFrame(() => { T.raf = 0; update(T); }); };

function update(T, force){
  const R = T.R, Y = centerYear(T);
  T.year.textContent = Math.floor(clamp(Y, R.debut, R.fin));
  const st = readState(T, Y);
  const ga = st && !st.item.vide ? gaAt(R, Y) : null;
  const gk = ga ? ga.file + "@" + ga.s : "";
  if(gk !== T.gaKey){ T.gaKey = gk; setGA(T, ga); }
  const rk = isImg(R) ? rivalsAt(R, Y).map(r => r.k).join(",") : "";
  const key = st ? (st.item.vide ? "v" + st.item.nom + st.item.s : "r" + st.item.i) + "|" + (st.armes || "") + "|" + gk + "|" + rk : "";
  if(key !== T.key || force){
    T.key = key;
    renderPanel(T, st, ga);
    const cur = st && !st.item.vide ? st.item.i : -1;
    T.tokens.forEach(t => t.classList.toggle("current", +t.dataset.i === cur));
    T.bars.forEach(b => b.classList.toggle("current", +b.dataset.i === cur));
    T.dms.forEach(b => b.classList.toggle("current", +b.dataset.i === cur));
  }
  const armsKey = st ? st.armes + (isImg(R) && !st.item.vide && !DATA.armes[st.armes]?.file ? "#" + st.item.i : "") : null;
  if(T.seen && armsKey !== T.armsKey){ T.armsKey = armsKey; isImg(R) ? setPV(T, st) : setBig(T.big, st ? st.armes : null); }
  /* jalon proche de la ligne de lecture */
  const thr = Math.max(2.5, 46 / T.ppy);
  let near = null;
  for(const j of R.jalons) if(Math.abs(j.y - Y) <= thr && (!near || Math.abs(j.y - Y) < Math.abs(near.y - Y))) near = j;
  if((near?.k ?? -1) !== T.nearK){
    T.nearK = near?.k ?? -1;
    T.marks.forEach(m => m.classList.toggle("near", +m.dataset.j === T.nearK));
    if(near){
      T.toast.innerHTML = `<span class="ty">${txt(near.label || Math.floor(near.y))}</span><div><span class="tt">${txt(near.titre)}</span>${txt(near.texte)}
        ${near.desaccord ? `<span class="dz"><b>Désaccord :</b> ${txt(near.desaccord)}</span>` : ""}
        <span class="src">${srcLinks(near.sources)}</span></div>`;
      T.toast.classList.add("on");
    } else T.toast.classList.remove("on");
  }
  /* fenêtre de la mini-carte */
  const span = R.fin - R.debut, half = T.track.clientWidth / 2 / T.ppy;
  const l = (Y - half - R.debut) / span, w = 2 * half / span;
  T.mmWin.style.left = (l * 100) + "%"; T.mmWin.style.width = (w * 100) + "%";
}

function renderPanel(T, st, ga){
  const P = T.panel, R = T.R, img = isImg(R);
  T.cur = st?.item || null;
  if(!st){ P.innerHTML = ""; T.side.innerHTML = ""; return; }
  const it = st.item;
  let html;
  if(it.vide){
    const va = it.armes ? DATA.armes[it.armes] : null;
    html = `<p class="p-house">${txt(W(R, "sans"))}</p><h3 class="p-name">${txt(it.nom)}</h3>
      <p class="p-dates"><b>${txt(spanLong(it))}</b>${img ? " · " + duree(it) : ""}</p>
      ${va ? `<p class="p-arms">${txt(va.nom)}</p>` : `<p class="p-bl dim">Pas d'armes du souverain.</p>`}
      ${it.note ? `<p class="p-note">${txt(it.note)}<span class="src">${srcLinks(it.sources)}</span></p>` : ""}
      ${it.wiki ? `<p class="p-links"><a class="btn-wiki" href="${wikiUrl(it.wiki)}" target="_blank" rel="noopener">Lire sur Wikipédia ↗</a></p>` : ""}
      ${va?.file ? `<p class="p-credit">Figure : ${credit(va)}, via Wikimedia Commons.</p>` : ""}`;
  } else {
    const a = DATA.armes[st.armes];
    const phaseTxt = it.ph.length > 1 ? ` <span style="opacity:.7">(${txt(spanTxt(st.ph))})</span>` : "";
    const L = DATA.lis;
    const credit = a.file
      ? `Figure : <a href="${commonsPage(a.file)}" target="_blank" rel="noopener">« ${txt(a.file)} »</a> — ${txt(a.auteur)}, ${a.licurl ? `<a href="${esc(a.licurl)}" target="_blank" rel="noopener">${txt(a.lic)}</a>` : txt(a.lic)}, via Wikimedia Commons.`
      : a.draw !== "aucune" && L
        ? `Figure dessinée par l'encyclopédie ; fleur de lis : <a href="${commonsPage(L.file)}" target="_blank" rel="noopener">« ${txt(L.file)} »</a> — ${txt(L.auteur)}, <a href="${esc(L.licurl)}" target="_blank" rel="noopener">${txt(L.lic)}</a>.`
        : img ? "Sceau de plomb numéroté dessiné par l'encyclopédie : il marque le rang du pape dans la liste, pas un objet réel." : "";
    const trad = img && typeof it.debut === "number" && !it.approx ? ` <span style="opacity:.7">(dates traditionnelles)</span>` : "";
    const kin = img && R.kinOf?.[st.armes]?.filter(r => r !== it) || [];
    const aNote = a.note && (img || stateAt(R, st.ph.s - 1e-3)?.armes !== st.armes);
    html = `<p class="p-house">${houseLine(R, it)}</p>
      <h3 class="p-name">${txt(it.nom)}</h3>
      <p class="p-dates"><b>${txt(spanLong(it))}</b>${trad} · ${duree(it)} de ${txt(W(R, "regne"))}${it.encours ? " (en cours)" : ""}</p>
      ${img && it.naissance ? `<p class="p-born">Né <i>${txt(it.naissance)}</i></p>` : ""}
      <p class="p-arms">${txt(a.nom)}${phaseTxt}${img && a.apost ? ` <span class="ap">a posteriori</span>` : ""}</p>
      ${a.blason ? `<p class="p-bl${a.blason.length > 180 ? " long" : ""}">« ${txt(a.blason)} »</p>` : `<p class="p-bl dim">${a.apost ? "Armes inventées après coup ; les sources lues ne les blasonnent pas." : "Pas d'armoiries attestées."}</p>`}
      ${img && a.apost && !a.gravure ? `<p class="p-note">${txt(APOST)}</p>` : ""}
      ${it.note ? `<p class="p-note">${txt(it.note)}<span class="src">${srcLinks(it.sources)}</span></p>` : ""}
      ${aNote ? `<p class="p-note">${txt(a.note)}<span class="src">${srcLinks(a.sources)}</span></p>` : `<p class="p-note"><span class="src">${a.blason ? "Blasonnement d'après " : ""}${srcLinks(a.sources)}</span></p>`}
      ${img && a.desaccord ? `<p class="p-note"><b class="dz">Désaccord :</b> ${txt(a.desaccord)}</p>` : ""}
      ${kin.length ? `<p class="p-note">Mêmes armes : ${kin.map(r => txt(r.court)).join(", ")}.</p>` : ""}
      <p class="p-links"><a class="btn-wiki" href="${wikiUrl(it.wiki)}" target="_blank" rel="noopener">${txt(it.court)} sur Wikipédia ↗</a></p>
      ${credit ? `<p class="p-credit">${credit}</p>` : ""}`;
  }
  P.innerHTML = html;
  T.side.innerHTML = it.vide && !img ? "" : cardsHTML(T, it, ga);
  if(!REDUCE){ P.classList.remove("swap"); void P.offsetWidth; P.classList.add("swap"); }
}
/* visionneuse « images » : fondu entre deux écus, ou la bulle de plomb numérotée */
function setPV(T, st){
  const pv = T.big, [a, b] = pv.querySelectorAll("img"), seal = $(".pv-seal", pv);
  const A = st?.armes ? DATA.armes[st.armes] : null;
  pv.classList.toggle("apost", !!A?.apost);
  if(!A?.file){
    a.classList.remove("on"); b.classList.remove("on");
    seal.innerHTML = st && !st.item.vide ? sealSvg(st.item, true) : "";
    seal.classList.remove("on"); void seal.offsetWidth;
    seal.classList.toggle("on", !!seal.innerHTML);
    return;
  }
  seal.classList.remove("on");
  const cur = a.classList.contains("on") ? a : b, nxt = cur === a ? b : a, key = T.armsKey;
  if(cur.dataset.f === A.file && cur.classList.contains("on")) return;
  const url = commonsImg(A.file, 600);
  const show = () => { if(T.armsKey !== key) return; nxt.classList.add("on"); cur.classList.remove("on"); };
  nxt.dataset.f = A.file; nxt.alt = A.nom;
  if(nxt.src === url && nxt.complete) show();
  else { nxt.onload = show; nxt.src = url; }
}
/* trois cartouches à onglets : grandes armes de la période, armes d'avant le trône, devise */
function cardsHTML(T, it, ga){
  const out = [];
  if(ga) out.push(["ga", "Grandes armes", `<h4>Grandes armes <small>${txt(spanTxt(ga))}</small></h4>
    <img class="c-img" src="${commonsImg(ga.file, 360)}" alt="Grandes armes — ${esc(ga.titre)}" loading="lazy" title="Afficher en grand">
    <p class="c-t">${txt(ga.titre)}</p>
    <ul>${ga.ornements.map(o => `<li>${txt(o)}</li>`).join("")}</ul>
    ${ga.note ? `<p class="c-note">${txt(ga.note)}</p>` : ""}
    <p class="c-cr">${credit(ga)} · ${srcLinks(ga.sources)}</p>`]);
  if(it.avant?.length){
    const files = [...new Map(it.avant.map(a => [a.file, a])).values()];
    out.push(["avant", "Avant le trône", `<h4>Avant le trône</h4>
      ${it.avant.map((a, k) => `<div class="av"><img class="av-i" data-k="${k}" src="${commonsImg(a.file, 120)}" alt="${esc(a.titre + " : " + a.blason)}" loading="lazy"><div><b>${txt(a.titre)}</b><span>${txt(a.dates || "")}</span></div></div>`).join("")}
      ${it.avant.filter(a => a.note).map(a => `<p class="c-note">${txt(a.note)}</p>`).join("")}
      <p class="c-cr">${files.map(credit).join(" · ")} · ${srcLinks([...new Set(it.avant.flatMap(a => a.sources))])}</p>`]);
  }
  if(it.devise){
    const d = it.devise;
    out.push(["devise", "Devise", `<h4>Devise et emblème</h4>
      <div class="dv">${d.file ? `<img src="${commonsImg(d.file, 160)}" alt="${esc(d.legende || d.embleme || "")}" loading="lazy">` : ""}<div>
        ${d.embleme ? `<div class="em">${txt(d.embleme)}</div>` : ""}
        ${d.mot ? `<div class="mot">« ${txt(d.mot)} »</div>` : ""}
        ${d.trad ? `<div class="tr">${txt(d.trad)}</div>` : ""}</div></div>
      ${d.texte ? `<p class="c-note">${txt(d.texte)}</p>` : ""}
      ${isImg(T.R) && d.desaccord ? `<p class="c-note"><b class="dz">Désaccord :</b> ${txt(d.desaccord)}</p>` : ""}
      <p class="c-cr">${d.file ? credit(d) + (d.legende ? ` (${txt(d.legende)})` : "") + " · " : ""}${srcLinks(d.sources)}</p>`]);
  }
  if(isImg(T.R)){
    const rv = rivalsAt(T.R, centerYear(T));
    if(rv.length){
      const files = rv.map(r => r.armes && DATA.armes[r.armes]).filter(a => a?.file);
      const lab = rv.every(r => r.type === "éphémère") ? "Pape éphémère" : "Antipape";
      out.unshift(["rival", lab, `<h4>${lab}${rv.length > 1 ? "s" : ""} <small>face à ${txt(it.court || it.nom)}</small></h4>
        ${rv.map(r => { const a = r.armes ? DATA.armes[r.armes] : null;
          return `<div class="av">${a?.file ? `<img src="${commonsImg(a.file, 120)}" alt="${esc(a.nom)}" loading="lazy">` : sealSvg({ court: r.court, num: "" }, false)}<div><b>${txt(r.nom)}</b><span>${txt(spanLong(r))}${r.obedience ? " · obédience " + txt(deOf(r.obedience)) : ""}</span></div></div>
            ${a?.blason ? `<p class="c-note">« ${txt(a.blason)} »</p>` : ""}
            ${a?.note ? `<p class="c-note">${txt(a.note)}</p>` : ""}
            ${a?.desaccord ? `<p class="c-note"><b class="dz">Désaccord :</b> ${txt(a.desaccord)}</p>` : ""}
            ${r.note ? `<p class="c-note">${txt(r.note)}</p>` : ""}`; }).join("")}
        <p class="c-cr">${files.map(credit).join(" · ")}${files.length ? " · " : ""}${srcLinks(["liste_papes", "armoiries_papales"])}</p>`]);
    }
    const S = T.R.sceau;
    const Y = centerYear(T);
    const orn = (T.R.ornements || []).map(row => [row, ornAt(T.R, row.id, Y)]).filter(([, s]) => s);
    if(orn.length) out.push(["orn", "Ornements", `<h4>Autour de l'écu <small>${Math.floor(Y)}</small></h4>
      <ul>${orn.map(([row, s]) => `<li><b style="color:var(--parch);font-weight:500">${txt(row.nom)}</b> — ${txt(s.label)}</li>`).join("")}</ul>
      ${orn.map(([, s]) => `<p class="c-note">${txt(s.texte)}</p>`).join("")}
      <p class="c-cr">${srcLinks([...new Set(orn.flatMap(([, s]) => s.sources))])}</p>`]);
    if(S && !it.vide && !DATA.armes[it.armes]?.file) out.push(["sceau", "Sceau", `<h4>Le sceau du pape</h4>
      <img class="c-img" src="${commonsImg(S.file, 360)}" alt="${esc(S.legende)}" loading="lazy" style="cursor:default">
      <p class="c-t">${txt(S.legende)}</p><p class="c-note">${txt(S.texte)}</p>
      <p class="c-cr">${credit(S)} · ${srcLinks(S.sources)}</p>`]);
  }
  if(!out.length) return "";
  const on = out.some(([k]) => k === T.cardTab) ? T.cardTab : out[0][0];
  return `<div class="ctabs" role="tablist">${out.map(([k, lab]) => `<button type="button" role="tab" data-c="${k}" class="${k === on ? "on" : ""}" aria-selected="${k === on}">${lab}</button>`).join("")}</div>
    <div class="cards">${out.map(([k, , body]) => `<div class="card${k === on ? " on" : ""}" data-c="${k}" role="tabpanel">${body}</div>`).join("")}</div>`;
}
/* vue « grandes armes » : fondu entre deux images */
function setGA(T, ga){
  const [a, b] = T.gaView.querySelectorAll("img"), empty = T.gaView.querySelector(".ga-empty");
  if(!ga){
    a.classList.remove("on"); b.classList.remove("on");
    empty.hidden = false; empty.textContent = "Pas de grandes armes attestées pour cette période.";
    return;
  }
  empty.hidden = true;
  const cur = a.classList.contains("on") ? a : b, nxt = cur === a ? b : a, key = T.gaKey;
  nxt.onload = () => { if(T.gaKey !== key) return; nxt.classList.add("on"); cur.classList.remove("on"); };
  nxt.alt = `Grandes armes — ${ga.titre}`;
  nxt.src = commonsImg(ga.file, 700);
}
function setMode(T, m){
  T.mode = m;
  T.bigWrap.classList.toggle("ga", m === "ga");
  T.bigWrap.querySelectorAll(".vtabs button").forEach(b => { const on = b.dataset.m === m; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
}

/* ---------- lecture automatique ---------- */
function setPlay(T, on){
  const b = $(".c-play", T.sec);
  cancelAnimationFrame(T.play); T.play = 0;
  b.classList.remove("invite");
  b.classList.toggle("on", on);
  $(".ic", b).textContent = on ? "❚❚" : "▶";
  $(".lb", b).textContent = on ? "Pause" : "Parcourir";
  if(!on) return;
  const max = T.track.scrollWidth - T.track.clientWidth;
  if(T.track.scrollLeft >= max - 2) jumpTo(T, T.R.first);
  let pos = T.track.scrollLeft, last = performance.now();
  const YPS = 16;
  const step = now => {
    const dt = Math.min(64, now - last) / 1000; last = now;
    pos += YPS * T.ppy * dt;
    T.track.scrollLeft = Math.round(pos);
    if(pos >= max){ setPlay(T, false); return; }
    T.play = requestAnimationFrame(step);
  };
  T.play = requestAnimationFrame(step);
}

/* ---------- zoom ---------- */
function zoomTo(T, ppy, clientX){
  const rect = T.track.getBoundingClientRect();
  const pin = clientX == null && pinned(T) ? T.pin : null;
  const ax = clientX == null ? rect.width / 2 : clientX - rect.left;
  const Ya = pin ? pin.y : (T.track.scrollLeft + ax - T.padL) / T.ppy + T.R.debut;
  T.ppy = clamp(ppy, ZOOMS[0], ZOOMS[ZOOMS.length - 1]);
  layout(T);
  T.track.scrollLeft = T.padL + (Ya - T.R.debut) * T.ppy - ax;
  if(pin) pin.sl = T.track.scrollLeft;
  T.key = ""; T.nearK = undefined;
  update(T, true);
}
const zoomStep = (T, dir) => {
  const i = ZOOMS.findIndex(z => z >= T.ppy - 1e-6);
  zoomTo(T, ZOOMS[clamp((i < 0 ? ZOOMS.length - 1 : i) + dir, 0, ZOOMS.length - 1)]);
};
function neighbour(T, dir){
  const Y = centerYear(T), st = readState(T, Y);
  const cur = st && !st.item.vide ? st.item : null;
  const list = T.R.order;
  let target;
  if(dir > 0) target = list.find(r => cur ? r.s > cur.s : r.s > Y);
  else target = [...list].reverse().find(r => cur ? r.s < cur.s : r.s < Y);
  if(target) goReign(T, target);
}

/* ---------- interactions ---------- */
function wire(T){
  const tr = T.track;
  tr.addEventListener("scroll", () => { hideTip(); schedule(T); }, { passive: true });

  /* glisser à la souris, avec inertie ; le toucher garde le défilement natif */
  let drag = null, suppress = false;
  tr.addEventListener("pointerdown", e => {
    if(e.pointerType === "touch" || e.button !== 0) return;
    setPlay(T, false); cancelAnimationFrame(T.glide);
    drag = { x: e.clientX, sl: tr.scrollLeft, id: e.pointerId, moved: false, vx: 0, lx: e.clientX, lt: performance.now() };
  });
  tr.addEventListener("pointermove", e => {
    if(!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if(!drag.moved && Math.abs(dx) > 5){ drag.moved = true; tr.setPointerCapture(drag.id); tr.classList.add("dragging"); hideTip(); }
    if(!drag.moved) return;
    tr.scrollLeft = drag.sl - dx;
    const now = performance.now(), dt = now - drag.lt;
    if(dt > 0){ drag.vx = .8 * ((e.clientX - drag.lx) / dt) + .2 * drag.vx; drag.lx = e.clientX; drag.lt = now; }
  });
  const end = () => {
    if(!drag) return;
    const d = drag; drag = null;
    tr.classList.remove("dragging");
    if(!d.moved) return;
    suppress = true; setTimeout(() => suppress = false, 0);
    let v = -d.vx * 16;
    if(REDUCE || Math.abs(v) < 2) return;
    const coast = () => { tr.scrollLeft += v; v *= .93; if(Math.abs(v) > .5) T.glide = requestAnimationFrame(coast); };
    T.glide = requestAnimationFrame(coast);
  };
  tr.addEventListener("pointerup", end);
  tr.addEventListener("pointercancel", end);
  tr.addEventListener("click", e => { if(suppress){ e.preventDefault(); e.stopPropagation(); } }, true);

  tr.addEventListener("wheel", e => {
    if(!e.ctrlKey){ if(Math.abs(e.deltaX) > Math.abs(e.deltaY)) setPlay(T, false); return; }
    e.preventDefault();
    zoomTo(T, T.ppy * Math.exp(-e.deltaY * .0022), e.clientX);
  }, { passive: false });

  tr.addEventListener("keydown", e => {
    if(e.key === "ArrowRight"){ e.preventDefault(); setPlay(T, false); neighbour(T, 1); }
    else if(e.key === "ArrowLeft"){ e.preventDefault(); setPlay(T, false); neighbour(T, -1); }
    else if(e.key === "Home"){ e.preventDefault(); glideTo(T, T.R.first); }
    else if(e.key === "End"){ e.preventDefault(); glideTo(T, T.R.fin); }
    else if(e.key === "+" || e.key === "="){ e.preventDefault(); zoomStep(T, 1); }
    else if(e.key === "-"){ e.preventDefault(); zoomStep(T, -1); }
  });

  /* écu : centrer ; bande et jalons : centrer aussi */
  T.canvas.addEventListener("click", e => {
    const rb = e.target.closest(".rb");
    if(rb){ const r = T.R.regnes[+rb.parentElement.dataset.i]; goReign(T, r);
      if(matchMedia("(hover: none)").matches){ showTip(tipReign(T.R, r), rb); tipTimer = setTimeout(hideTip, 2600); } return; }
    const jm = e.target.closest(".jm");
    if(jm){ setPlay(T, false); glideTo(T, T.R.jalons[+jm.dataset.j].y); return; }
    const bar = e.target.closest(".bar");
    if(bar){ goReign(T, T.R.regnes[+bar.dataset.i]); return; }
    const dm = e.target.closest(".dm");
    if(dm){ goReign(T, T.R.regnes[+dm.dataset.i]); return; }
    const os = e.target.closest(".os");
    if(os){ const s = T.R.ornements[+os.dataset.r].segs[+os.dataset.s]; setPlay(T, false); glideTo(T, (s.s + Math.min(s.e, T.R.fin)) / 2); return; }
    const rv = e.target.closest(".rv");
    if(rv){ const r = T.R.rivaux[+rv.dataset.k]; setPlay(T, false); glideTo(T, (r.s + r.e) / 2);
      if(matchMedia("(hover: none)").matches){ showTip(tipRival(r), rv); tipTimer = setTimeout(hideTip, 2600); } return; }
    const sg = e.target.closest(".seg");
    if(sg){ const s = T.R.segs[+sg.dataset.seg]; setPlay(T, false); glideTo(T, (s.s + s.e) / 2); }
  });

  /* infobulles : survol et focus */
  const tipFor = el => {
    if(el.matches(".rb")) return tipReign(T.R, T.R.regnes[+el.parentElement.dataset.i]);
    if(el.matches(".rn")) return tipReign(T.R, T.R.regnes[+el.parentElement.dataset.i]);
    if(el.matches(".bar")) return tipReign(T.R, T.R.regnes[+el.dataset.i]);
    if(el.matches(".seg")) return tipSeg(T.R, T.R.segs[+el.dataset.seg]);
    if(el.matches(".rv")) return tipRival(T.R.rivaux[+el.dataset.k]);
    if(el.matches(".jm")) return tipJalon(T.R.jalons[+el.dataset.j]);
    if(el.matches(".dm")) return tipDevise(T.R.regnes[+el.dataset.i]);
    if(el.matches(".os")){ const row = T.R.ornements[+el.dataset.r]; return tipOrn(row, row.segs[+el.dataset.s]); }
    return null;
  };
  const target = e => e.target.closest?.(".rb,.rn,.seg,.jm,.bar,.dm,.os,.rv");
  /* mêmes armes : survoler un écu allume ceux des autres papes qui le partagent */
  const kin = el => {
    T.tokens.forEach(t => t.classList.remove("kin"));
    const a = el?.closest(".reign")?.dataset.a;
    if(!T.R.kinOf?.[a] || T.R.kinOf[a].length < 2) return;
    T.tokens.forEach(t => { if(t.dataset.a === a && t !== el.closest(".reign")) t.classList.add("kin"); });
  };
  T.canvas.addEventListener("pointerover", e => {
    if(e.pointerType === "touch" || drag?.moved) return;
    const el = target(e); if(el) showTip(tipFor(el), el.matches(".rn") ? el.parentElement.querySelector(".rb") : el);
    if(T.R.kin) kin(el?.matches(".rb,.rn") ? el : null);
  });
  T.canvas.addEventListener("pointerout", e => { const el = target(e); if(el && !el.contains(e.relatedTarget)){ hideTip(); if(T.R.kin) kin(null); } });
  T.canvas.addEventListener("focusin", e => { const el = target(e); if(el) showTip(tipFor(el), el); });
  T.canvas.addEventListener("focusout", hideTip);

  /* commandes */
  $(".vtabs", T.sec).addEventListener("click", e => { const b = e.target.closest("button[data-m]"); if(b) setMode(T, b.dataset.m); });
  T.side.addEventListener("click", e => {
    const tb = e.target.closest(".ctabs button");
    if(tb){
      T.cardTab = tb.dataset.c;
      T.side.querySelectorAll(".ctabs button").forEach(b => { const on = b === tb; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
      T.side.querySelectorAll(".card").forEach(c => c.classList.toggle("on", c.dataset.c === T.cardTab));
      return;
    }
    if(e.target.closest(".c-img") && T.R.grandesArmes?.length) setMode(T, "ga");
  });
  T.side.addEventListener("pointerover", e => {
    const im = e.target.closest(".av-i");
    if(im && T.cur?.avant) showTip(tipAvant(T.cur.avant[+im.dataset.k]), im);
  });
  T.side.addEventListener("pointerout", e => { if(e.target.closest(".av-i")) hideTip(); });
  $(".c-play", T.sec).addEventListener("click", () => setPlay(T, !T.play));
  $(".c-prev", T.sec).addEventListener("click", () => { setPlay(T, false); neighbour(T, -1); });
  $(".c-next", T.sec).addEventListener("click", () => { setPlay(T, false); neighbour(T, 1); });
  $(".c-in", T.sec).addEventListener("click", () => zoomStep(T, 1));
  $(".c-out", T.sec).addEventListener("click", () => zoomStep(T, -1));
  $(".c-fit", T.sec).addEventListener("click", () => {
    const Y = centerYear(T);
    zoomTo(T, (T.track.clientWidth - 60) / (T.R.fin - T.R.debut));
    jumpTo(T, Y); update(T, true);
  });

  /* mini-carte : cliquer ou glisser pour se déplacer */
  const mmYear = e => { const r = T.mm.getBoundingClientRect(); return T.R.debut + clamp((e.clientX - r.left) / r.width, 0, 1) * (T.R.fin - T.R.debut); };
  let mmDrag = false;
  T.mm.addEventListener("pointerdown", e => { mmDrag = true; T.mm.setPointerCapture(e.pointerId); setPlay(T, false); cancelAnimationFrame(T.glide); jumpTo(T, mmYear(e)); });
  T.mm.addEventListener("pointermove", e => { if(mmDrag) jumpTo(T, mmYear(e)); });
  T.mm.addEventListener("pointerup", () => { mmDrag = false; });
  T.mm.addEventListener("pointercancel", () => { mmDrag = false; });

  let rs = 0;
  addEventListener("resize", () => { clearTimeout(rs); rs = setTimeout(() => {
    const pin = pinned(T) ? T.pin : null, Y = pin ? pin.y : centerYear(T);
    layout(T); jumpTo(T, Y);
    if(pin) pin.sl = T.track.scrollLeft;
    update(T, true);
  }, 120); }, { signal: T.ac.signal });
}

/* ---------- méthode et crédits ---------- */
function buildMethod(){
  const all = [...Object.values(DATA.armes), ...DATA.royaumes.flatMap(R => [...(R.grandesArmes || []), ...(R.sceau ? [R.sceau] : []),
    ...R.regnes.flatMap(r => [...(r.avant || []), ...(r.devise ? [r.devise] : [])])])].filter(a => a.file);
  const uniq = [...new Map(all.map(a => [a.file, a])).values()];
  const R0 = DATA.royaumes[0];
  if(R0.methode){
    $("#method").innerHTML = `
      <div class="box"><span class="k">Méthode</span>${R0.methode.map(p => `<p>${txt(p)}</p>`).join("")}</div>
      <div class="box"><span class="k">Figures</span>
        <p>${txt(R0.figures || "Les sceaux de plomb numérotés et les bandes d'émaux sont dessinés par l'encyclopédie. Écus, gravures, emblème de la sede vacante et bulle viennent de Wikimedia Commons, chacun avec son auteur et sa licence vérifiés sur sa page :")}</p>
        <ul>${uniq.map(a => `<li>${credit(a)}</li>`).join("")}</ul>
      </div>
      <div class="box"><span class="k">Sources</span>
        <ul>${Object.values(DATA.sources).map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${txt(s.label)}</a></li>`).join("")}</ul>
      </div>`;
    return;
  }
  $("#method").innerHTML = `
    <div class="box"><span class="k">Méthode</span>
      <p>Chaque blasonnement, chaque ornement, chaque devise et chaque jalon renvoie aux pages lues pour l'établir. Quand elles divergent — date du premier semé, passage aux trois lis, armes de la Restauration, charge de 1831, traduction d'une devise — la frise donne les versions en présence sans trancher. Les dates d'apparition sans source précise (anges tenants, manteau et pavillon) sont montrées en fondu.</p>
      <p>Les dates de règne suivent la <a href="${esc(DATA.sources.liste_monarques.url)}" target="_blank" rel="noopener">Liste des monarques de France</a>. Les noms renvoient à l'article Wikipédia du souverain.</p>
    </div>
    <div class="box"><span class="k">Figures</span>
      <p>Semé, trois lis, mi-parti de Navarre et lambel d'Orléans sont dessinés par l'encyclopédie, avec la fleur de lis de ${txt(DATA.lis.auteur)} (<a href="${commonsPage(DATA.lis.file)}" target="_blank" rel="noopener">« ${txt(DATA.lis.file)} »</a>, <a href="${esc(DATA.lis.licurl)}" target="_blank" rel="noopener">${txt(DATA.lis.lic)}</a>) ; couronnes et colliers des jetons aussi. Les autres écus, les grandes armes, les armes d'avant le trône et les emblèmes viennent de Wikimedia Commons :</p>
      <ul>${uniq.map(a => `<li>${credit(a)}</li>`).join("")}</ul>
    </div>
    <div class="box"><span class="k">Sources</span>
      <ul>${Object.values(DATA.sources).map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${txt(s.label)}</a></li>`).join("")}</ul>
    </div>`;
}

/* une lignée à la fois : le sélecteur change l'ancre (#france, #papaute) et la page reconstruit la scène */
let LIVE = [], GEN = 0;
const fold = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const lpLabel = (l, tag) => `<img class="lp-em" src="${commonsImg(l.embleme, 80)}" alt="" loading="lazy"><span class="lp-t">${tag ? `<small>${tag}</small>` : ""}<b>${txt(l.nom)}</b><em>${txt(l.dates)}</em></span>`;
function renderPicker(L){
  $("#lp-btn").innerHTML = lpLabel(L, "Lignée") + `<svg class="lp-chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;
  $("#lp-btn").setAttribute("aria-label", `Lignée affichée : ${L.nom}. Changer de lignée`);
  $("#lp-list").innerHTML = GROUPES.map(g => {
    const ls = LIGNEES.filter(l => l.groupe === g);
    return ls.length ? `<p class="lp-g">${txt(g)}</p>` + ls.map(l => `<a class="lp-it${l === L ? " on" : ""}" href="#${l.id}" data-k="${esc(fold([l.nom, l.groupe, l.dates, l.mots || ""].join(" ")))}"${l === L ? ` aria-current="page"` : ""}>${lpLabel(l)}</a>`).join("") : "";
  }).join("") + `<p class="lp-none" hidden>Aucune lignée ne correspond.</p>`;
}
function pickerOpen(open){
  const btn = $("#lp-btn"), panel = $("#lp-panel");
  btn.setAttribute("aria-expanded", open);
  panel.hidden = !open;
  if(open){ $("#lp-q").value = ""; filterPicker(""); $("#lp-q").focus(); }
}
function filterPicker(q){
  const k = fold(q.trim());
  let n = 0;
  $("#lp-list").querySelectorAll(".lp-it").forEach(a => { const ok = !k || a.dataset.k.includes(k); a.hidden = !ok; n += ok; });
  $("#lp-list").querySelectorAll(".lp-g").forEach(g => {
    let el = g.nextElementSibling, any = false;
    while(el && el.classList.contains("lp-it")){ any ||= !el.hidden; el = el.nextElementSibling; }
    g.hidden = !any;
  });
  $("#lp-list .lp-none").hidden = n > 0;
}
$("#lp-btn").addEventListener("click", () => pickerOpen($("#lp-panel").hidden));
$("#lp-q").addEventListener("input", e => filterPicker(e.target.value));
$("#lpick").addEventListener("keydown", e => {
  const items = [...$("#lp-list").querySelectorAll(".lp-it:not([hidden])")];
  const i = items.indexOf(document.activeElement);
  if(e.key === "Escape" && !$("#lp-panel").hidden){ e.preventDefault(); pickerOpen(false); $("#lp-btn").focus(); }
  else if(e.key === "ArrowDown" && items.length && !$("#lp-panel").hidden){ e.preventDefault(); items[Math.min(i + 1, items.length - 1)].focus(); }
  else if(e.key === "ArrowUp" && i >= 0){ e.preventDefault(); i ? items[i - 1].focus() : $("#lp-q").focus(); }
  else if(e.key === "Enter" && e.target.id === "lp-q" && items[0]){ e.preventDefault(); items[0].click(); }
});
$("#lp-list").addEventListener("click", e => { if(e.target.closest(".lp-it")) pickerOpen(false); });
document.addEventListener("pointerdown", e => { if(!$("#lp-panel").hidden && !e.target.closest("#lpick")) pickerOpen(false); });
async function load(id){
  const L = LIGNEES.find(l => l.id === id) || LIGNEES[0], g = ++GEN;
  renderPicker(L);
  LIVE.forEach(T => { T.ac.abort(); T.io?.disconnect(); cancelAnimationFrame(T.play); cancelAnimationFrame(T.glide); cancelAnimationFrame(T.raf); });
  LIVE = []; hideTip();
  let data;
  try{
    const res = await fetch(L.file);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  }catch(err){
    if(g !== GEN) return;
    $("#royaumes").innerHTML = `<p class="err">Les données n'ont pas pu être chargées (${txt(err.message || err)}). Cette page doit être servie par HTTP — par exemple <code>python -m http.server</code> — et non ouverte depuis le disque.</p>`;
    $("#method").innerHTML = "";
    return;
  }
  if(g !== GEN) return;
  DATA = data; FRISE = L;
  $("#royaumes").innerHTML = "";
  document.title = `L'Armorial — Lignées · ${L.nom}`;
  buildDefs();
  LIVE = DATA.royaumes.map(R => { prepare(R); return buildRealm(R); });
  buildMethod();
}
/* la liste des frises d'abord, puis la frise demandée par l'ancre de l'adresse (#france, #papaute…) */
async function start(){
  try{
    const res = await fetch("data/frises.json");
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    ({ groupes: GROUPES, frises: LIGNEES } = await res.json());
  }catch(err){
    $("#royaumes").innerHTML = `<p class="err">La liste des frises n'a pas pu être chargée (${txt(err.message || err)}). Cette page doit être servie par HTTP — par exemple <code>python -m http.server</code> — et non ouverte depuis le disque.</p>`;
    return;
  }
  addEventListener("hashchange", () => load(location.hash.slice(1)));
  load(location.hash.slice(1));
}
start();
