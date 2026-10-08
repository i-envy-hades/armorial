/* L'ARMORIAL — le dessin des armes : du modèle d'une composition (assets/blasonnement.js) à un SVG.
   Partagé par l'Atelier (assets/atelier.js, qui n'en garde que l'interface) et par les pages qui montrent des écus
   composés par le moteur (S'exercer). Aucune dépendance à une page, à ceci près : le dessin des meubles se mesure dans
   un <svg id="measure" width="0" height="0" style="position:absolute;visibility:hidden"><g></g></svg>, que la page pose.
   Il lit les globaux DATA et ATL (voir blasonnement.js) et les fonctions de dessin de assets/blason.js.
   On s'en sert ainsi : normalizeAll(St), puis await loadAll(St) (charge les figures empruntées), puis compose(St, id).svg. */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

/* une case du parti (drawParti) : MAP resserre le champ et la pièce à la taille de la case ; les figures se repositionnent (px, py, décalage) et se réduisent de pk sans se déformer ; HSIDE : 0 dextre, 1 senestre */
let MAP = null, HSIDE = 0;
/* le champ couvre toute la case ; la pièce et les figures se calent sur ce qu'on en voit (vpx, vpy, shx, shy) */
const sq = (s, vis) => (!MAP || !s ? s : vis
  ? `<g transform="translate(${100 * (1 - MAP.vpx) + MAP.shx},${126 * (1 - MAP.vpy) + MAP.shy}) scale(${MAP.vpx},${MAP.vpy})">${s}</g>`
  : `<g transform="translate(${100 * (1 - MAP.px)},${126 * (1 - MAP.py)}) scale(${MAP.px},${MAP.py})">${s}</g>`);

/* bordure et orle : les dispositions du champ plein, resserrées vers le cœur */
const shrink = (pts, k) => pts.map(([x, y, s, r]) => [100 + (x - 100) * k, 120 + (y - 120) * k, s * k, r]);
const SHRINK = { plein: 1, bordure: .84, orle: .74 };
/* réglages graphiques (adMap, adStr : assets/blasonnement.js) appliqués aux positions */
const adjust = (pts, a, grp, sfx) => {
  const map = adMap(a), k = +a["sz" + sfx] / 100, dx = +a["dx" + sfx], dy = +a["dy" + sfx];
  const rot = grp === 1 ? +a.rot || 0 : 0;
  return pts.map(([x, y, sc, r], i) => { const it = map.get(`${grp}.${i}`) || [100, 0, 0]; return [x + dx + it[1], y + dy + it[2], sc * k * it[0] / 100, (r || 0) + rot]; });
};
/* la hauteur, dans le repère de l'écu, d'une figure empruntée à l'échelle 1 (sa boîte la contient sans la déformer) ; null pour un dessin de l'encyclopédie */
/* mesurée une fois dans le SVG caché #measure (les marges vides du fichier n'y comptent pas) ; à défaut, d'après le viewBox */
const HFIG = {};
function hauteurFigure(m) {
  if (!m.file || !SVGTXT[m.kind]) return null;
  if (m.kind in HFIG) return HFIG[m.kind];
  const [w, h] = m.file.vb ? m.file.vb.slice(2) : vbOf(SVGTXT[m.kind]);
  let H = Math.min(m.box[3], m.box[2] * h / w);
  const g = $("#measure g");
  if (g) {
    const id = `hf-${m.kind}`;
    g.innerHTML = `<defs>${fileSymbol(SVGTXT[m.kind], id, "#000", null, m.file.vb)}</defs>${useFor(m, id)}`;
    try { const b = g.querySelector("use").getBBox(); if (b.height > 1) H = b.height; } catch (e) { /* pas de mise en page : le viewBox suffit */ }
    g.innerHTML = "";
  }
  return HFIG[m.kind] = H;
}
/* l'étendue de l'écu sur la ligne y */
const ROWS = {};
function rowSpan(y) {
  const key = SHIELD_D + y;
  if (ROWS[key]) return ROWS[key];
  const ctx = document.createElement("canvas").getContext("2d"), path = new Path2D(SHIELD_D);
  let x0 = 200, x1 = 0;
  for (let x = 0; x < 200; x++) if (ctx.isPointInPath(path, x + .5, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1); }
  return ROWS[key] = x1 > x0 ? [x0, x1] : [90, 110];
}
/* les figures réparties sur les pièces du premier émail d'un fascé impair (rc), chaque rangée centrée sur sa pièce */
function rcPts(s) {
  const n = +s.n, h = 252 / n, out = [], K = (n + 1) / 2;
  const ys = []; for (let y = 0; y < 252; y += 2) if (rowSpan(y + 1)[1] - rowSpan(y + 1)[0] > 20) ys.push(y);
  const Y0 = ys[0] || 0, Y1 = (ys[ys.length - 1] || 250) + 2;
  rcDist(s).forEach((c, i) => {
    const top = Math.max(2 * i * h, Y0), bot = Math.min((2 * i + 1) * h, i === K - 1 ? Y1 - 16 : Y1), y = (top + bot) / 2;
    const [x0, x1] = rowSpan(y), w = x1 - x0 - 20, sc = Math.min(.24, w / c * .8 / 100, (bot - top) * .8 / 100);
    for (let j = 0; j < c; j++) out.push([x0 + 10 + w * (j + .5) / c, y, sc]);
  });
  return out;
}
function ptsFor(s, m) {
  if (s.nb === "seme") return SEME.map(([x, y, sc]) => [x, y, sc * +s.sz / 100]);
  let pts;
  if (s.iss === "t") pts = [[100 + ((HSIDE ? -50 : 50) - MAP.shx) / MAP.vpx, 116, 1.12]];                // demi-meuble : le centre de la figure sur le trait du parti
  else if (s.iss) pts = [[100, 204, MAP && MAP.coupe ? 1.5 : 1]];             // issant : le meuble, à demi caché par le bas de l'écu (dans le chef d'un coupé, il sort du trait, plus grand)
  else if (s.rc) pts = rcPts(s);
  else if (m.seul) pts = [[100, 116, 1]];
  else if (PLEINLIKE.has(ctxOf(s))) {
    const d = dispoOf(s); pts = d ? shrink(d.pts, SHRINK[ctxOf(s)]) : [];
    if (d && m.allongee) {      // un meuble allongé (léopard) : en pal à pleine largeur, et rapprochés verticalement quand ils sont trois
      if (d.pal || d.id === "pal") {
        pts = pts.map(([x, y, sc, r]) => [x, 116 + (y - 116) * .9, Math.min(.9, sc * 3) * (MAP ? 1.4 : 1), r]);
        /* une figure haute (cerf, bélier) ne doit pas mordre sur sa voisine : sa taille se règle sur sa hauteur réelle et l'écart entre les deux */
        const H = hauteurFigure(m), pas = pts.length > 1 ? Math.abs(pts[1][1] - pts[0][1]) : 0;
        if (H && pas) pts = pts.map(([x, y, sc, r]) => [x, y, Math.min(sc, 1.1 * pas / H * (MAP ? MAP.fpy / MAP.pk : 1)), r]);
      }
      else if (+s.nb === 3 && (d.id === "" || d.id === "base" || d.id === "mal")) pts = pts.map(([x, y, sc, r]) => [x, 116 + (y - 116) * .72, sc * .92, r]);
    }
    /* dans une partie du tranché (du taillé), des meubles posés en bande (en barre) longent le trait, de toute sa longueur (Bosnie-Herzégovine) :
       on part de leur place sur l'écu entier, décalée vers la partie, et on défait la réduction de la case */
    if (d && MAP && MAP.ligne && d.id === MAP.ligne.sens) {
      const [nx, ny] = MAP.ligne.n, long = pts.length >= 5, f = long ? 1 : .7;          // une longue rangée court d'un bout à l'autre ; quelques grands meubles se resserrent vers le cœur
      pts = pts.map(([x, y, sc, r]) => [x * f + 100 * (1 - f), y * f + 126 * (1 - f), sc, r])
        .map(([x, y, sc, r]) => [100 + (x + nx * LIGNE_D * (long ? 1 : 1.3) - 100 - MAP.shx) / MAP.vpx, 126 + (y + ny * LIGNE_D * (long ? 1 : 1.3) - 126 - MAP.shy) / MAP.fpy, sc * (long ? 1.25 : .85) / MAP.pk, r]);
    }
  }
  else pts = (LAYOUT[ctxOf(s)] || {})[s.nb] || [];
  return adjust(pts, s, 1, "");
}
const chaPts = s => ptsFor(s, meuble(s.m)).map(([x, y, sc]) => [x + 20 * sc, y - 22 * sc, sc * .5, 0]);      // une figure du second meuble à côté de chacune du premier
const pts2 = s => adjust(s.cha ? chaPts(s) : s.cp ? CP_POINTE[s.nb2] : s.p === "fasce" && !s.pbro ? dispo2(s).pts.map(([x, y, sc, r]) => [x, y, sc * .55, r]) : dispo2(s).pts, s, 2, "2");   // accompagnant une fasce : plus petits
/* les figures de la brisure : les dispositions du champ plein, réduites (une marque seule au centre est petite), puis les réglages de la brisure */
function brisPts(s) {
  const d = dispoOf(brisArms(s)), k = +s.brsz / 100;
  if (!d) return [];
  const seul = s.brn === "1" && !d.id;
  return d.pts.map(([x, y, sc, r]) => [x + +s.brdx, y + +s.brdy, (seul ? .3 : sc * .62) * k, r]);
}
/* le lambel : le filet et ses pendants, puis les figures qu'ils portent ; taille et position (réglages de la brisure) se prennent depuis le milieu du filet */
function lambelDraw(s, u) {
  const n = +s.lpn, g = lambelGeom(n, !!s.lpc), line = s.tbr === "Sable" ? "#6b6560" : chgStroke(s.tbr);
  let defs = "", ch = "";
  if (s.lpc) {
    const k = +s.lpk, h = (g.y1 - g.y0) / k, sc = Math.min(.75 * (g.wt + g.wb) / 2 / 140, .85 * h / 160);
    const xs = s.lpw === "milieu" ? [g.xs[(n - 1) / 2]] : g.xs;
    defs = symbolFor(lambelArms(s), `lp-${u}`);
    ch = placeAll(xs.flatMap(x => Array.from({ length: k }, (_, j) => [x, g.y0 + h * (j + .5), sc, 0])), meuble(s.lpc), `lp-${u}`, false);
  }
  return { defs, body: `<g transform="translate(${100 + +s.brdx},${50 + +s.brdy}) scale(${+s.brsz / 100}) translate(-100,-50)">${lambelInner(n, tinctPaint(s.tbr), line, !!s.lpc)}${ch}</g>` };
}

/* le filet d'une pièce : son tracé grossi de g de chaque côté (traits plus épais et bouts allongés, remplissages cernés d'un trait), à angles vifs, à l'émail du filet ; la pièce se pose par-dessus */
function filetDe(markup, color, g) {
  const at = (a, k) => parseFloat((a.match(new RegExp(`(?<![\\w-])${k}="([^"]*)"`)) || [])[1]);
  const f = x => +x.toFixed(2);
  const bout = (x, y, tx, ty) => { const L = Math.hypot(x - tx, y - ty) || 1; return [f(x + (x - tx) / L * g), f(y + (y - ty) / L * g)]; };
  return markup.replace(/<(rect|line|path)\b([^>]*?)\/>/g, (m, tag, a) => {
    if (tag === "rect") return `<rect x="${at(a, "x") - g}" y="${at(a, "y") - g}" width="${at(a, "width") + 2 * g}" height="${at(a, "height") + 2 * g}" fill="${color}"/>`;
    if (tag === "line") {
      const [x1, y1, x2, y2] = ["x1", "y1", "x2", "y2"].map(k => at(a, k)), [p1x, p1y] = bout(x1, y1, x2, y2), [p2x, p2y] = bout(x2, y2, x1, y1);
      return `<line x1="${p1x}" y1="${p1y}" x2="${p2x}" y2="${p2y}" stroke="${color}" stroke-width="${at(a, "stroke-width") + 2 * g}"/>`;
    }
    const sw = at(a, "stroke-width");
    if (!Number.isNaN(sw)) {
      let d = (a.match(/(?<![\w-])d="([^"]*)"/) || [])[1];
      const c = d.match(/^M([\d.]+),([\d.]+) L([\d.]+),([\d.]+) L([\d.]+),([\d.]+)$/);
      if (c) { const [, ax, ay, bx, by, cx, cy] = c.map(Number), p = bout(ax, ay, bx, by), q = bout(cx, cy, bx, by); d = `M${p} L${bx},${by} L${q}`; }
      return `<path ${a.replace(/(?<![\w-])d="[^"]*"/, `d="${d}"`).replace(/stroke="[^"]*"/, `stroke="${color}"`).replace(/stroke-width="[\d.]+"/, `stroke-width="${sw + 2 * g}"`)}/>`;
    }
    return `<path ${a.replace(/fill="[^"]*"/, `fill="${color}"`)} stroke="${color}" stroke-width="${2 * g}" stroke-linejoin="miter"/>`;
  });
}
/* bandeaux de devise : pur dessin, sans valeur héraldique ; chaque build() rend la forme, la ligne portant le texte et sa hauteur */
const BAND = { fill: "#f3ecd8", back: "#d9cfb4", fold: "#b9ac8a" };
const bandPaint = (f = BAND.fill, w = 1.2) => `fill="${f}" stroke="#1a1712" stroke-width="${w}" stroke-linejoin="round"`;
const wavy = (xa, xb, Y, k, rev) => {
  const w = xb - xa, c = n => (xa + w * n).toFixed(1);
  return rev ? `C${c(5 / 6)},${Y + k} ${c(2 / 3)},${Y + k} ${c(.5)},${Y} C${c(1 / 3)},${Y - k} ${c(1 / 6)},${Y - k} ${xa},${Y}`
    : `C${c(1 / 6)},${Y - k} ${c(1 / 3)},${Y - k} ${c(.5)},${Y} C${c(2 / 3)},${Y + k} ${c(5 / 6)},${Y + k} ${xb},${Y}`;
};
const swallowBand = (sag) => (x0, x1, y0) => {
  const tail = (x, d) => `<path d="M${x},${y0 + 5} L${x - d * 30},${y0 + 3} L${x - d * 17},${y0 + 19} L${x - d * 30},${y0 + 36} L${x},${y0 + 34} Z" ${bandPaint(BAND.back, 1.1)}/>`;
  return {
    d: `M${x0 + 8},${y0 + 20} Q100,${y0 + 20 + sag * 2} ${x1 - 8},${y0 + 20}`, h: 36 + sag,
    svg: tail(x0 + 6, 1) + tail(x1 - 6, -1) + `<path d="M${x0},${y0} Q100,${y0 + sag * 2} ${x1},${y0} L${x1},${y0 + 30} Q100,${y0 + 30 + sag * 2} ${x0},${y0 + 30} Z" ${bandPaint()}/>`
  };
};
const DEVISES = {
  "": { nom: "Ruban à queues d'aronde", build: swallowBand(12) },
  arc: { nom: "Ruban cintré", build: swallowBand(28) },
  ondule: { nom: "Ruban ondulé", build: (x0, x1, y0) => {
    const k = 28 / 3;
    return { d: `M${x0 + 8},${y0 + 20} ${wavy(x0 + 8, x1 - 8, y0 + 20, k, false)}`, h: 43,
      svg: `<path d="M${x0},${y0} ${wavy(x0, x1, y0, k, false)} L${x1 - 12},${y0 + 15} L${x1},${y0 + 30} ${wavy(x0, x1, y0 + 30, k, true)} L${x0 + 12},${y0 + 15} Z" ${bandPaint()}/>` };
  } },
  droit: { nom: "Bandeau droit, bouts fendus", build: (x0, x1, y0) => ({
    d: `M${x0 + 16},${y0 + 20} L${x1 - 16},${y0 + 20}`, h: 36,
    svg: `<path d="M${x0},${y0} L${x1},${y0} L${x1 - 12},${y0 + 15} L${x1},${y0 + 30} L${x0},${y0 + 30} L${x0 + 12},${y0 + 15} Z" ${bandPaint()}/>`
  }) },
  plis: { nom: "Banderole à plis", build: (x0, x1, y0) => {
    const e = 26, s = 5, L = x0 + e, R = x1 - e;
    const tail = (xo, xi, d) => `<path d="M${xi},${y0 + 12} L${xi},${y0 + 42} L${xo},${y0 + 42} L${xo + d * 12},${y0 + 27} L${xo},${y0 + 12} Z" ${bandPaint(BAND.back, 1.1)}/>`
      + `<path d="M${xi - d * 10},${y0 + 30} L${xi},${y0 + 30} L${xi},${y0 + 42} Z" ${bandPaint(BAND.fold, 1)}/>`;
    return { d: `M${L + 6},${y0 + 20} Q100,${y0 + 20 + s * 2} ${R - 6},${y0 + 20}`, h: 48,
      svg: tail(x0, L + 10, 1) + tail(x1, R - 10, -1) + `<path d="M${L},${y0} Q100,${y0 + s * 2} ${R},${y0} L${R},${y0 + 30} Q100,${y0 + 30 + s * 2} ${L},${y0 + 30} Z" ${bandPaint()}/>` };
  } },
  rouleau: { nom: "Parchemin enroulé", build: (x0, x1, y0) => {
    const roll = x => `<ellipse cx="${x}" cy="${y0 + 15}" rx="9" ry="16" ${bandPaint(BAND.back)}/><ellipse cx="${x}" cy="${y0 + 15}" rx="4" ry="9" ${bandPaint(BAND.fold, .9)}/>`;
    return { d: `M${x0 + 28},${y0 + 20} L${x1 - 28},${y0 + 20}`, h: 34,
      svg: `<path d="M${x0 + 12},${y0 + 2} L${x1 - 12},${y0 + 2} L${x1 - 12},${y0 + 28} L${x0 + 12},${y0 + 28} Z" ${bandPaint()}/>` + roll(x0 + 12) + roll(x1 - 12) };
  } },
  cartouche: { nom: "Cartouche à filet", build: (x0, x1, y0) => ({
    d: `M${x0 + 18},${y0 + 20} L${x1 - 18},${y0 + 20}`, h: 36,
    svg: `<rect x="${x0 + 6}" y="${y0}" width="${x1 - x0 - 12}" height="30" rx="7" ${bandPaint()}/>`
      + `<rect x="${x0 + 10}" y="${y0 + 3.5}" width="${x1 - x0 - 20}" height="23" rx="4" fill="none" stroke="#1a1712" stroke-width=".7"/>`
  }) }
};
const ODEF = { q: "", sh: "", cr: "", hm: "", ht: "grilles", hp: "34", hs: "", tl1: "Gueules", tl2: "Or", pa: "", pa1: "Argent", pa2: "Gueules", su: "", ts: "Or", co: "", dv: "", dt: "", ab: "", gb: "",
  ci: "", cim: "", cit: "Or", cia: "Gueules", h1: "", h2: "",
  mt: "", mc: "Gueules", ml: "Hermine" };          // le manteau (« m ») ou le manteau sous un pavillon (« p »), son émail et sa doublure          // le cimier : un meuble posé sur le heaume (entier ou issant), son émail et celui de son attribut
const BRKEYS = ["br", "tbr", "sbr", "lbr", "brn", "brd", "lpn", "lpc", "lpt", "lpk", "lpw", "brsz", "brdx", "brdy"];
const OPT = new Set(["p", "m", "m2", "d", "d2", "q", "sh", "cr", "hm", "hs", "pa", "su", "co", "dv", "dt", "ab", "gb", "ct", "ct2", "ln", "pf", "ci", "cim", "mt", "cc", "ta", "br", "lbr", "brd", "lpc", "lpw", "h1", "h2", "pcc", "cha", "rc", "cmp", "cm1", "cm2"]);
const PFX = ["", "b_", "c_", "d_", "e_", "f_", "g_", "h_", "i_"];
const fresh = () => ({ ...ODEF, A: ADEFS.map(a => ({ ...a })) });
let CUR = 0;   // le quartier modifié dans l'Atelier ; normalizeAll() le ramène à un quartier actif
function normalizeAll(St) {
  if (!["", "2", "4", "p", "c", "t", "l"].includes(St.q)) St.q = "";
  for (const k of ["h1", "h2"]) if (!(St.q === "p" ? ["", "2", "4"] : St.q === "c" && k === "h1" ? ["", "p"] : [""]).includes(St[k])) St[k] = "";
  for (const k of ["tl1", "tl2", "pa1", "pa2", "ts", "cit", "cia", "mc", "ml"]) if (!own(MOT, St[k])) St[k] = ODEF[k];
  if (!["", "m", "p"].includes(St.mt)) St.mt = "";
  const mci = St.ci && meuble(St.ci);
  if (!mci || mci.seul) St.ci = "";
  if (!["", "issant"].includes(St.cim)) St.cim = "";
  const O = ATL.ornements;
  if (!O.couronnes.some(c => c.kind === St.cr)) St.cr = "";
  if (!["", "h", "hl"].includes(St.hm)) St.hm = "";
  /* chaque modèle n'existe que dans certaines positions : on garde la position si possible, sinon le modèle */
  const has = (t, p) => O.heaumes.some(h => h.type === t && h.pos === p);
  if (!own(O.heaumeTypes, St.ht)) St.ht = "grilles";
  if (!own(O.heaumePos, St.hp)) St.hp = "34";
  if (!has(St.ht, St.hp)) St.hp = O.heaumes.find(h => h.type === St.ht).pos;
  if (!["", "s"].includes(St.hs)) St.hs = "";
  if (!own(SHAPES, St.sh)) St.sh = "";
  if (!["", "1"].includes(St.ab)) St.ab = "";
  if (!["", "3", "5"].includes(St.pa)) St.pa = "";
  if (!O.supports.some(x => x.kind === St.su)) St.su = "";
  if (!O.colliers.some(c => c.kind === St.co)) St.co = "";
  St.dv = String(St.dv || "").slice(0, 48);
  if (!own(DEVISES, St.dt)) St.dt = "";
  St.A.forEach(normalize);
  if (St.q) {                                                                                                  // la brisure est à tout l'écu : elle se range dans les premières armes
    const j = St.A[0].br ? 0 : active(St).find(i => St.A[i].br);
    if (j > 0) for (const k of BRKEYS) St.A[0][k] = St.A[j][k];
    St.A.forEach((a, i) => { if (i) for (const k of BRKEYS) a[k] = ADEF[k] ?? ""; });
    normalize(St.A[0]);
  }
  St.gb = St.q && St.A[0].br ? "1" : "";
  St.A.forEach((a, i) => { if (a.iss === "t" && (St.q !== "p" || i > 1 || halfMode(St, i))) a.iss = ""; });                    // un demi-meuble ne se dit que d'une moitié du parti
  if (!active(St).includes(CUR)) CUR = 0;
  return St;
}

/* ---------- meubles : dessinés ou empruntés, en <symbol> réutilisable ---------- */
const SVGTXT = {};
async function loadSvg(m) {
  if (!m.file || SVGTXT[m.kind]) return;
  const res = await fetch(m.file.path);
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${m.file.path}`);
  SVGTXT[m.kind] = await res.text();
}
const flat = t => (DATA.tinctures.find(x => x.nom === t) || {}).color || "#888";
/* une couleur du fichier à remplacer : « #fcef3c » partout où elle paraît, ou « fill:#000 » quand le même noir sert aussi aux contours (seuls les remplissages changent) */
function colorRe(c) {
  const [, pre, hex] = c.match(/^(?:(fill|stroke):)?(#\w+)$/), h = hex.slice(1).toLowerCase();
  const short = h[0] === h[1] && h[2] === h[3] && h[4] === h[5] ? `|#${h[0]}${h[2]}${h[4]}` : "";
  const named = { ffffff: "|white", "000000": "|black", ff0000: "|red", "008000": "|green" }[h] || "";
  return new RegExp(`${pre ? `(?<=${pre}\\s*[:=]\\s*["']?)` : ""}(#${h}${short}${named})(?![0-9a-z])`, "gi");
}
function recolor(txt, m, tm, ta) {
  let s = txt;
  (m.main || []).forEach(c => { s = s.replace(colorRe(c), "@@M@@"); });
  (m.accent || []).forEach(c => { s = s.replace(colorRe(c), "@@A@@"); });
  (m.drop || []).forEach(c => { s = s.replace(colorRe(c), "none"); });
  (m.line || []).forEach(c => { s = s.replace(colorRe(c), "@@L@@"); });
  (m.fixe ? m.fixe.c : []).forEach(c => { s = s.replace(colorRe(c), "@@F@@"); });          // une partie toujours du même émail (« tigée et feuillée de sinople »)
  return s.replace(/@@F@@/g, m.fixe ? tinctPaint(m.fixe.t) : "").replace(/@@M@@/g, tinctPaint(tm)).replace(/@@A@@/g, tinctPaint(ta)).replace(/@@L@@/g, tm === "Sable" ? "#6b6560" : "#1a1712");
}
/* les meubles dessinés n'ont pas tous la même taille d'origine : on les mesure une fois et on les ramène à celle des figures empruntées */
const NORM = {};
function normOf(m) {
  if (!(m.kind in NORM)) {
    const g = $("#measure g");
    g.innerHTML = m.draw === "lis" ? fleurDeLisPaths() : chargeInner(m.draw, "#000", "#000", "#fff");
    const b = g.getBBox(), k = Math.min(140 / b.width, 160 / b.height);
    NORM[m.kind] = { k, t: `translate(100,116) scale(${k.toFixed(4)}) translate(${(-(b.x + b.width / 2)).toFixed(2)},${(-(b.y + b.height / 2)).toFixed(2)})` };
    g.innerHTML = "";
  }
  return NORM[m.kind];
}
const normed = (m, inner) => {
  if (m.seul) return inner;
  const n = normOf(m);
  return `<g transform="${n.t}">${inner.replace(/stroke-width="([\d.]+)"/g, (a, w) => `stroke-width="${(w / n.k).toFixed(2)}"`)}</g>`;
};
function symbolFor(s, id) {
  const m = meuble(s.m), tm = s.tm, line = tm === "Sable" ? "#6b6560" : "#1a1712";
  if (m.draw === "lis") return `<g id="${id}" fill="${tinctPaint(tm)}" stroke="${tm === "Sable" ? "#6b6560" : chgStroke(tm)}" stroke-width="${(1.6 / normOf(m).k).toFixed(2)}" stroke-linejoin="round">${normed(m, fleurDeLisPaths())}</g>`;
  if (m.draw) {
    const ground = s.pos === "sur" ? tinctPaint(s.tp) : tinctPaint(s.t1);
    return `<g id="${id}">${normed(m, chargeInner(m.draw, tinctPaint(tm), tm === "Sable" ? "#6b6560" : chgStroke(tm), ground))}</g>`;
  }
  if (m.custom === "billette") return `<rect id="${id}" x="76" y="62" width="48" height="108" rx="2" fill="${tinctPaint(tm)}" stroke="${chgStroke(tm)}" stroke-width="1.4"/>`;
  /* base : le fichier n'a pas de couleur propre, son dessin prend directement l'émail ; outline : contour fin pour les silhouettes */
  const txt = recolor(SVGTXT[m.kind], m, tm, s.ta);
  return fileSymbol(txt, id, m.base ? tinctPaint(tm) : line, m.outline ? { stroke: line, width: vbOf(txt)[0] / 70 } : null, m.file.vb);
}
/* un fichier SVG emprunté devient un <symbol> ; ses id internes sont préfixés pour ne pas heurter ceux de la page */
/* vbo : la boîte du dessin, quand le fichier n'a pas de viewBox et que sa page est plus grande que la figure (« file.vb » dans atelier.json) */
function fileSymbol(txt, id, fill, outline, vbo) {
  const [w, h] = vbOf(txt), vb = vbo ? vbo.join(" ") : (txt.match(/<svg\b[^>]*\bviewBox="([^"]+)"/) || [])[1] || `0 0 ${w} ${h}`;
  const st = outline ? ` stroke="${outline.stroke}" stroke-width="${outline.width.toFixed(2)}" paint-order="stroke"` : "";
  return `<symbol id="${id}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet"><g fill="${fill}"${st} stroke-linejoin="round">${fileInner(txt, id)}</g></symbol>`;
}
function fileInner(txt, id) {
  const root = new DOMParser().parseFromString(txt, "image/svg+xml").documentElement;
  const inner = [...root.childNodes].map(n => new XMLSerializer().serializeToString(n)).join("");
  return inner.replace(/\bid="([^"]+)"/g, `id="${id}-$1"`).replace(/url\(#([^)]+)\)/g, (a, x) => x.startsWith("m-") || x.startsWith("h-") ? a : `url(#${id}-${x})`)
              .replace(/(xlink:)?href="#([^"]+)"/g, (a, x, y) => `${x || ""}href="#${id}-${y}"`)
              /* les classes d'une feuille de style interne (.st0, .st1…) deviendraient communes à toute la page, donc à toutes les copies du meuble : on les préfixe, comme les id */
              .replace(/\bclass="([^"]+)"/g, (a, c) => `class="${c.split(/\s+/).map(k => `${id}-${k}`).join(" ")}"`)
              .replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, css => css.replace(/\.([A-Za-z_][\w-]*)/g, `.${id}-$1`));
}
function vbOf(txt) {
  const r = txt.match(/<svg\b[^>]*>/)[0], vb = r.match(/viewBox="([^"]+)"/);
  if (vb) { const p = vb[1].trim().split(/[\s,]+/).map(Number); return [p[2], p[3]]; }
  return [parseFloat(r.match(/\swidth="([\d.]+)/)[1]), parseFloat(r.match(/\sheight="([\d.]+)/)[1])];
}
function useFor(m, id) { return m.file ? `<use href="#${id}" x="${m.box[0]}" y="${m.box[1]}" width="${m.box[2]}" height="${m.box[3]}"/>` : `<use href="#${id}"/>`; }

const SEME = (() => { const p = []; for (let r = 0; r < 8; r++) for (let c = 0; c < 6; c++) p.push([16 + c * 36 + (r % 2 ? 18 : 0), 22 + r * 30, .17]); return p; })();

/* ---------- l'écu ---------- */
/* flip : meuble contourné, retourné vers senestre (miroir autour de son axe) ; m.retourne : le fichier emprunté regarde à senestre, on le remet à dextre */
/* dans une moitié de parti, quelques figures côte à côte se serrent : on les réduit pour qu'elles ne se chevauchent pas */
const facteurMoitie = pts => MAP && MAP.half && pts.length >= 2 && pts.length <= 6 && new Set(pts.map(q => Math.round(q[0]))).size >= 2 ? .7 : 1;
const placeAll = (pts, m, id, flip, over = "") => {
  const fx = facteurMoitie(pts);
  return pts.map(([x, y, k, r]) => {
    const X = MAP ? 100 + (x - 100) * MAP.vpx + MAP.shx : x, Y = MAP ? 126 + (y - 126) * MAP.fpy + MAP.shy : y, K = (MAP ? k * MAP.pk * fx : k) * (m.k || 1);
    const R = (r || 0) + (flip && m.ctRot ? 90 : 0), miroir = m.ctRot ? !!m.retourne : !flip !== !m.retourne;      // ctRot : « contourné » se dessine en tournant le meuble (le croissant ouvert à senestre)
    return `<g transform="translate(${X},${Y})${R ? ` rotate(${R})` : ""} scale(${miroir ? `${-K},${K}` : K}) translate(-100,-116)">${useFor(m, id)}${over}</g>`;
  }).join("");
};
/* la couronne d'une bête (« lion couronné d'or ») : le meuble « couronne » (à fleurons) ou « couronne antique », posé sur la tête de la figure (m.couronne = [x, y, largeur] : le centre de la couronne, dans le cadre de l'écu) */
let CNID = 0;
function couronneDe(m, tinct, forme) {
  if (!m.couronne || !tinct) return "";
  const cm = meuble(forme === "antique" ? "couronne-antique" : "couronne"), txt = SVGTXT[cm.kind];
  if (!txt) return "";
  const [x, y, w] = m.couronne, vb = cm.file.vb, h = w * vb[3] / vb[2];
  return `<svg x="${(x - w / 2).toFixed(1)}" y="${(y - h / 2).toFixed(1)}" width="${w}" height="${h.toFixed(1)}" viewBox="${vb.join(" ")}" overflow="visible"><g fill="#000" stroke-linejoin="round">${fileInner(recolor(txt, cm, tinct, tinct), `cn${++CNID}`)}</g></svg>`;
}
const croixDeCase = (pf, th, line) => {
  const t = 40 * MAP.px * (+th || 100) / 100, x = 100 + MAP.shx, y = 126 - 14 * MAP.vpy + MAP.shy;
  let d = null;
  if (CONTOURS[line]) { try { d = pieceDecoree("croix", line, +th || 100, MAP.px, { c: [x, y], ext: 500 }); } catch (err) { /* la mesure demande un navigateur complet */ } }
  if (d) return `<path d="${d}" fill="${pf}" fill-rule="evenodd"/>`;
  return `<path d="${croixTrace(x, y, t / 2, -400, 500, -400, 500)}" fill="${pf}"/>`;
};
/* bordure et orle d'une case (moitié ou quartier) : ils suivent le contour de l'écu et les traits de partition qui bordent la case, pas l'écu entier.
   edges : les côtés de la case qui sont des traits de partition (l, r, t, b) ; f réduit la largeur comme les figures de la case.
   Un seul élément : pas de couture sous un émail métallique. La bordure occupe les 13 premières unités, l'orle les unités 15,4 à 27,2 depuis le bord. */
let NOBORD = false, BID = 0;
const enBande = k => k === "bordure" || k === "orle";
/* la bordure ou l'orle à bord décoré d'une case : l'anneau décoré de l'écu entier (que la case rogne) et, le long de chaque trait de partition, une bande
   dont le bord intérieur (bordure) ou les deux bords (orle, à 21,3 f du trait, large de 11,84 f) sont décorés */
function bandeDecoree(kind, rect, f, edges, line) {
  let d = null;
  try { d = pieceDecoree(kind, line, 100, f); } catch (err) { /* la mesure du contour demande un navigateur complet */ }
  const S = CONTOURS[line];
  if (!d || !S) return null;
  const [x, y, w, h] = rect, bw = 13 * f, a = 4 * S.h * f, per = 4 * S.l * f;
  if (kind === "orle") {
    const g = cellGeom(rect), c = 21.3 * f, hw = 5.92 * f, vert = e => e === "l" || e === "r";
    const rubans = [...edges].map(e => {
      const xa = e === "l" ? x + c - hw : e === "r" ? x + w - c - hw : g.x0 + c, xb = e === "l" ? x + c + hw : e === "r" ? x + w - c + hw : g.x1 - c;
      const ya = e === "t" ? y + c - hw : e === "b" ? y + h - c - hw : g.y0 + c, yb = e === "t" ? y + c + hw : e === "b" ? y + h - c + hw : g.y1 - c;
      return polyDecore([[xa, ya], [xb, ya], [xb, yb], [xa, yb]], vert(e) ? [false, true, false, true] : [true, false, true, false], line, a, per);
    });
    return `<path d="${d}" fill="#fff" fill-rule="evenodd"/>` + rubans.map(r => `<path d="${r}" fill="#fff"/>`).join("");
  }
  const bande = {
    l: [[[x, y], [x + bw, y], [x + bw, y + h], [x, y + h]], [false, true, false, false]],
    r: [[[x + w - bw, y], [x + w, y], [x + w, y + h], [x + w - bw, y + h]], [false, false, false, true]],
    t: [[[x, y], [x + w, y], [x + w, y + bw], [x, y + bw]], [false, false, true, false]],
    b: [[[x, y + h - bw], [x + w, y + h - bw], [x + w, y + h], [x, y + h]], [true, false, false, false]],
  };
  return `<path d="${d}" fill="#fff" fill-rule="evenodd"/>` + [...edges].map(e => `<path d="${polyDecore(bande[e][0], bande[e][1], line, a, per)}" fill="#fff"/>`).join("");
}
function bandeDeCase(kind, pf, rect, f, edges, line) {
  const [x, y, w, h] = rect;
  const d = SHIELD_D + [...edges].map(e => ({ l: `M${x},${y}V${y + h}`, r: `M${x + w},${y}V${y + h}`, t: `M${x},${y}H${x + w}`, b: `M${x},${y + h}H${x + w}` })[e]).join("");
  const deco = enBande(kind) && line && bandeDecoree(kind, rect, f, edges, line);
  if (deco) {
    const id = `mb${++BID}`;
    return `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="-100" y="-100" width="500" height="500">${deco}</mask></defs><rect x="-100" y="-100" width="500" height="500" fill="${pf}" mask="url(#${id})"/>`;
  }
  if (kind !== "orle") return `<path d="${d}" fill="none" stroke="${pf}" stroke-width="${26 * f}"/>`;
  const id = `mo${++BID}`;
  return `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="-100" y="-100" width="500" height="500"><path d="${d}" fill="none" stroke="#fff" stroke-width="${54.4 * f}"/><path d="${d}" fill="none" stroke="#000" stroke-width="${30.8 * f}"/></mask></defs>`
    + `<rect x="-100" y="-100" width="500" height="500" fill="${pf}" mask="url(#${id})"/>`;
}
const bandeLocale = (kind, pf, line) => `<g transform="translate(${100 - MAP.cx},${126 - MAP.cy})">${bandeDeCase(kind, pf, MAP.rect, MAP.pk, MAP.edges, line)}</g>`;
function drawBody(s, u) {
  let field;
  if (s.f === "part") field = partitionInner(s.part, [s.t1, s.t2, s.t3]);
  else if (s.f === "ray") field = recoupementInner(s.ray, +s.n, tinctPaint(s.t1), tinctPaint(s.t2));
  else field = `<rect width="200" height="252" fill="${tinctPaint(s.t1)}"/>`;
  field = sq(field);
  const m = s.m && meuble(s.m), m2 = count2(s) && meuble(s.m2);
  let defs = "", under = "", over = "";
  if (m && s.cc) {
    /* « de l'un en l'autre » : les meubles deux fois, de chacun des émaux du champ, chaque fois masqués par la part de l'autre émail */
    const pts = ptsFor(s, m), part = k => sq(partitionInner(s.part, k ? ["#000", "#fff"] : ["#fff", "#000"], true));
    defs += symbolFor({ ...s, tm: s.t2, ta: s.ta || s.t2 }, `chg-${u}`) + symbolFor({ ...s, tm: s.t1, ta: s.ta || s.t1 }, `chgx-${u}`)
      + [0, 1].map(k => `<mask id="cc${k}-${u}" maskUnits="userSpaceOnUse" x="-100" y="-100" width="500" height="500">${part(k)}</mask>`).join("");
    const g = `<g mask="url(#cc0-${u})">${placeAll(pts, m, `chg-${u}`, s.ct, couronneDe(m, s.cn, s.cnk))}</g><g mask="url(#cc1-${u})">${placeAll(pts, m, `chgx-${u}`, s.ct, couronneDe(m, s.cn, s.cnk))}</g>`;
    if (s.nb === "seme") under = g; else over = g;
  } else if (m) {
    defs += symbolFor(s, `chg-${u}`);
    const g = placeAll(ptsFor(s, m), m, `chg-${u}`, s.ct, couronneDe(m, s.cn, s.cnk));
    if (s.nb === "seme") under = g; else over = g;
  }
  if (m2) {
    defs += symbolFor(arms2(s), `chg2-${u}`);
    const g2 = placeAll(pts2(s), m2, `chg2-${u}`, s.ct2, couronneDe(m2, s.cn2, s.cnk2));
    if (s.pbro) under += g2; else over += g2;                       // la pièce chargée broche sur ce meuble : il est dessous, ses figures dessus
  }
  const croixCase = MAP && s.p === "croix";      // dans une case du parti, la croix se dessine à sa taille : une mise à l'échelle inégale épaissirait une barre
  const bandeCase = enBande(s.p) && (MAP || NOBORD);
  if (bandeCase) return corps(s, u, defs, field, under, over, !s.p || !MAP ? "" : bandeLocale(s.p, tinctPaint(s.tp), s.ln));
  const cmpOn = s.p === "bordure" && s.cmp && !MAP;          // dans une case, la bordure reste unie
  const dress = paint => {
    let p = cmpOn ? componee(s, u, d => { defs += d; }) : croixCase ? croixDeCase(paint, s.pth, s.ln) : pieceInner(s.p, paint, s.ln, s.pth);
    if (p && s.pf) p = filetDe(p, flat(s.pf), croixCase ? 6 * MAP.vpx : 6) + p;            // le filet : la pièce cernée d'un liseré de l'émail dit
    if (p && (+s.pdx || +s.pdy)) p = `<g transform="translate(${croixCase ? +s.pdx * MAP.vpx : +s.pdx},${croixCase ? +s.pdy * MAP.vpy : +s.pdy})">${p}</g>`;
    return croixCase ? p : sq(p, 1);
  };
  let piece = "";
  if (s.p && s.pcc && pccPossible(s)) {
    /* « de l'un en l'autre » : la pièce deux fois, de chacun des émaux du champ, chaque fois masquée par la part de l'autre émail */
    const part = k => sq(partitionInner(s.part, k ? ["#000", "#fff"] : ["#fff", "#000"], true));
    defs += [0, 1].map(k => `<mask id="pc${k}-${u}" maskUnits="userSpaceOnUse" x="-100" y="-100" width="500" height="500">${part(k)}</mask>`).join("");
    piece = `<g mask="url(#pc0-${u})">${dress(tinctPaint(s.t2))}</g><g mask="url(#pc1-${u})">${dress(tinctPaint(s.t1))}</g>`;
  } else if (s.p) piece = dress(tinctPaint(s.tp));
  return corps(s, u, defs, field, under, over, piece);
}
/* la bordure componée : seize compons égaux le long du contour, en alternance, et leurs figures, une au milieu de chaque compon */
const COMPONS = 16;
function componee(s, u, defs) {
  const g = $("#measure g"), pa = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pa.setAttribute("d", SHIELD_D); g.appendChild(pa);
  const total = pa.getTotalLength(), L = total / COMPONS, at = l => pa.getPointAtLength(((l % total) + total) % total);
  const pts = [[], []];
  for (let k = 0; k < COMPONS; k++) {
    const l = (k + .5) * L, a = at(l - 1.5), b = at(l + 1.5), p = at(l), tx = b.x - a.x, ty = b.y - a.y, n = Math.hypot(tx, ty) || 1;
    let nx = -ty / n, ny = tx / n;
    if (nx * (100 - p.x) + ny * (126 - p.y) < 0) { nx = -nx; ny = -ny; }
    pts[k % 2].push([p.x + nx * 6.5, p.y + ny * 6.5, .105, 0]);
  }
  g.removeChild(pa);
  let out = `<path d="${SHIELD_D}" fill="none" stroke="${tinctPaint(s.tp)}" stroke-width="26"/>`
    + `<path d="${SHIELD_D}" fill="none" stroke="${tinctPaint(s.tpc)}" stroke-width="26" stroke-dasharray="${L.toFixed(3)} ${L.toFixed(3)}" stroke-dashoffset="${L.toFixed(3)}"/>`;
  [[s.cm1, s.cm1t], [s.cm2, s.cm2t]].forEach(([k, t], i) => {
    if (!k) return;
    const mm = meuble(k), id = `cm${i}-${u}`;
    defs(symbolFor({ ...s, m: k, tm: t, ta: t, cc: "", ct: "", cn: "", cnk: "" }, id));
    out += placeAll(pts[i], mm, id, false);
  });
  return out;
}
/* la brisure, par-dessus tout le reste (une pièce de brisure, ou des figures), puis l'assemblage des couches */
function brisLayer(s, u) {
  let defs = "", bris = "";
  if (s.br) {
    if (s.br === "lambel") {
      const l = lambelDraw(s, u); defs += l.defs;
      /* dans une case, le lambel reste à sa place (en chef) mais se réduit sans se déformer : pendants et filet gardent leurs proportions */
      bris = MAP ? `<g transform="translate(${100 + MAP.shx},${126 + (50 - 126) * MAP.vpy + MAP.shy}) scale(${MAP.vpx}) translate(-100,-50)">${l.body}</g>` : l.body;
    }
    else if (s.br === "bordure" && (MAP || NOBORD)) bris = MAP ? bandeLocale("bordure", tinctPaint(s.tbr), s.lbr) : "";
    else if (brisPiece(s)) bris = sq(pieceInner(s.br === "baton" || s.br === "filet" ? `${s.br}-${s.sbr}` : s.br, tinctPaint(s.tbr), s.lbr), 1);
    else { defs += symbolFor(brisArms(s), `br-${u}`); bris = placeAll(brisPts(s), meuble(s.br), `br-${u}`, false); }
  }
  return { defs, bris };
}
function corps(s, u, defs, field, under, over, piece) {
  const b = brisLayer(s, u);
  return { defs: defs + b.defs, body: field + under + (s.pos === "sous" ? over + piece : piece + over) + b.bris };
}
/* la brisure de tout l'écu (écartelé ou parti : « …, le tout brisé d'un lambel ») est celle des premières armes, posée une fois sur l'ensemble */
const GBR = St => (St.q && St.gb === "1" && St.A[0].br ? St.A[0] : null);
const armsCell = (St, ai) => (ai === 0 && GBR(St) ? { ...St.A[0], br: "" } : St.A[ai]);
function draw(s, u = "a", extra = "") {
  const r = drawBody(s, u);
  return `<defs><clipPath id="cl-${u}"><path d="${SHIELD_D}"/></clipPath>${r.defs}</defs><g clip-path="url(#cl-${u})">${r.body}</g>${extra}${shieldFinish()}`;
}
/* l'écusson en abîme (« sur le tout ») : l'écu entier, réduit au rapport AB_K, centré sur le cœur de l'écu */
const AB_K = .4;
function abime(St, u) {
  const r = drawBody(St.A[4], `${u}ab`);
  return `<defs><clipPath id="ab-${u}"><path d="${SHIELD_D}"/></clipPath>${r.defs}</defs>`
    + `<g transform="translate(100,126) scale(${AB_K}) translate(-100,-126)"><g clip-path="url(#ab-${u})">${r.body}</g>${shieldFinish(3.4)}</g>`;
}
/* quartiers : la ligne horizontale passe là où l'écu a autant de surface au-dessus qu'en dessous (la pointe rétrécit le bas) ;
   les armes de chaque quartier, réduites de moitié, sont centrées sur le barycentre de la partie visible */
const QGEO = {};
function quarterGeom() {
  if (QGEO[SHIELD_D]) return QGEO[SHIELD_D];
  const ctx = document.createElement("canvas").getContext("2d"), path = new Path2D(SHIELD_D), pts = [];
  for (let y = 0; y < 252; y++) for (let x = 0; x < 200; x++) if (ctx.isPointInPath(path, x + .5, y + .5)) pts.push([x + .5, y + .5]);
  const ys = pts.map(p => p[1]).sort((a, b) => a - b), split = Math.round(ys[Math.floor(ys.length / 2)]);
  const acc = [0, 1, 2, 3].map(() => [0, 0, 0]);
  for (const [x, y] of pts) { const q = (y < split ? 0 : 2) + (x < 100 ? 0 : 1); acc[q][0] += x; acc[q][1] += y; acc[q][2]++; }
  const rects = [[0, 0, 100, split], [100, 0, 100, split], [0, split, 100, 252 - split], [100, split, 100, 252 - split]];
  return QGEO[SHIELD_D] = { split, q: acc.map(([sx, sy, n], i) => ({ cx: sx / n, cy: sy / n, rect: rects[i] })) };
}
const quarterArms = St => St.q === "2" ? [0, 1, 1, 0] : [0, 1, 2, 3];
/* deux couches par quartier : le champ et la pièce étirés pour couvrir tout le quartier, puis les armes entières
   à demi-taille, centrées sur le barycentre de la partie visible (la pointe ne rogne plus les meubles du bas) */
function qCover(g) {
  const [rx, ry, rw, rh] = g.rect, s = Math.max(rw / 200, rh / 252), w = 200 * s, h = 252 * s;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  return [clamp(g.cx - 100 * s, rx + rw - w, rx), clamp(g.cy - 112 * s, ry + rh - h, ry), s];
}
const qOrigin = g => [g.cx - 50, g.cy - 59, .5];
/* formes citées au chapitre « L'écu » ; toutes tiennent dans la même boîte que l'écu français */
const SHAPES = {
  "": { nom: "Français moderne", d: "M18,16 L182,16 L182,120 C182,178 146,214 100,236 C54,214 18,178 18,120 Z" },
  ancien: { nom: "Triangulaire ancien", d: "M18,16 L182,16 C182,112 152,186 100,236 C48,186 18,112 18,16 Z" },
  losange: { nom: "En losange", d: "M100,10 L190,126 L100,242 L10,126 Z" },
  targe: { nom: "Targe échancrée", d: "M18,20 C64,10 136,10 182,20 L182,124 C182,180 146,214 100,236 C54,214 18,180 18,124 L18,92 C36,84 36,58 18,50 Z" },
  ovale: { nom: "Cartouche ovale", d: "M100,12 A84,114 0 0 1 100,240 A84,114 0 0 1 100,12 Z" },
  banniere: { nom: "Bannière (tournoi)", d: "M18,16 L182,16 L182,236 L18,236 Z" },
  anglais: { nom: "Anglais à cornes", d: "M4,12 C26,8 54,32 100,28 C146,32 174,8 196,12 C188,20 182,30 182,44 L182,120 C182,178 146,214 100,236 C54,214 18,178 18,120 L18,44 C18,30 12,20 4,12 Z" },
  suisse: { nom: "Suisse à trois pointes", d: "M18,16 C48,32 80,30 100,12 C120,30 152,32 182,16 L182,110 C182,170 140,212 100,238 C60,212 18,170 18,110 Z" },
  italien: { nom: "Italien, tête de cheval", d: "M54,16 C80,22 120,22 146,16 L190,90 C156,132 124,190 100,242 C76,190 44,132 10,90 Z" },
  sannitique: { nom: "Italien, sannitique", d: "M20,16 L180,16 L180,214 Q180,230 164,230 L114,230 L100,242 L86,230 L36,230 Q20,230 20,214 Z" },
  iberique: { nom: "Talon arrondi (ibérique)", d: "M18,16 L182,16 L182,126 C182,190 144,236 100,236 C56,236 18,190 18,126 Z" },
  hongrois: { nom: "Hongrois, talon pointu", d: "M18,16 L182,16 L182,118 C182,182 146,220 112,228 L100,242 L88,228 C54,220 18,182 18,118 Z" },
  pl16: { nom: "Polonais, à oreilles", d: "M18,12 C40,24 68,22 100,26 C132,22 160,24 182,12 L182,126 C182,190 144,236 100,236 C56,236 18,190 18,126 Z" },
  pl17: { nom: "Polonais, à échancrures", d: "M100,22 C84,26 48,24 22,12 C26,34 42,50 42,62 C34,70 32,84 42,94 C26,102 16,120 18,140 C20,190 62,222 100,240 C138,222 180,190 182,140 C184,120 174,102 158,94 C168,84 166,70 158,62 C158,50 174,34 178,12 C152,24 116,26 100,22 Z" },
  pl19: { nom: "Polonais, sommet en coin", d: "M18,12 C50,28 150,28 182,12 C186,96 150,192 100,242 C50,192 14,96 18,12 Z" },
};
/* les cases d'un parti : chaque moitié, ou, si elle s'écartèle, ses quatre quartiers */
function partiCells(St) {
  const split = quarterGeom().split, out = [];
  /* tranché, taillé : deux triangles de part et d'autre de la diagonale (les armes de chacun se resserrent sur ce qu'on en voit) */
  if (St.q === "t") return [{ arm: 0, half: 0, poly: [[0, 0], [200, 0], [200, 252]], rect: [0, 0, 200, 252], edges: "", ligne: { sens: "bande", n: [.78, -.62] } },
    { arm: 1, half: 1, poly: [[0, 0], [200, 252], [0, 252]], rect: [0, 0, 200, 252], edges: "", ligne: { sens: "bande", n: [-.78, .62] } }];
  if (St.q === "l") return [{ arm: 0, half: 0, poly: [[0, 0], [200, 0], [0, 252]], rect: [0, 0, 200, 252], edges: "", ligne: { sens: "barre", n: [-.78, -.62] } },
    { arm: 1, half: 1, poly: [[200, 0], [200, 252], [0, 252]], rect: [0, 0, 200, 252], edges: "", ligne: { sens: "barre", n: [.78, .62] } }];
  if (chefParti(St)) return [{ arm: 0, half: 0, rect: [0, 0, 100, split], edges: "rb" }, { arm: 2, half: 1, rect: [100, 0, 100, split], edges: "lb" }, { arm: 1, half: 1, coupe: true, rect: [0, split, 200, 252 - split], edges: "t" }];      // coupé dont le chef est parti : deux cases en chef, une en pointe
  if (St.q === "c") return [{ arm: 0, half: 0, coupe: true, rect: [0, 0, 200, split], edges: "b" }, { arm: 1, half: 1, coupe: true, rect: [0, split, 200, 252 - split], edges: "t" }];      // coupé : la moitié du chef, puis celle de la pointe
  [0, 1].forEach(h => {
    const qa = halfQuarters(St, h), hx = h * 100;
    if (!qa) { out.push({ arm: HALF_ARMS[h][0], half: h, rect: [hx, 0, 100, 252], edges: h ? "l" : "r" }); return; }
    const [a, b] = halfSpan(h), mid = (a + b) / 2;      // le trait de l'écartelé passe au milieu de ce qu'on voit de la moitié, pas au milieu de sa boîte
    const rects = [[a, 0, mid - a, split], [mid, 0, b - mid, split], [a, split, mid - a, 252 - split], [mid, split, b - mid, 252 - split]];
    rects.forEach((rect, n) => out.push({ arm: qa[n], half: h, q: n, rect, rects, a, b, mid, edges: (n % 2 ? (h ? "l" : "lr") : (h ? "lr" : "r")) + (n < 2 ? "b" : "t") }));
  });
  return out;
}
/* la partie visible d'une case (la pointe et les flancs de l'écu en rognent le bas et le côté) : barycentre, largeur et hauteur moyennes */
const CGEO = {};
function cellGeom(rect) {
  const key = SHIELD_D + rect.join();
  if (CGEO[key]) return CGEO[key];
  const ctx = document.createElement("canvas").getContext("2d"), path = new Path2D(SHIELD_D), [rx, ry, rw, rh] = rect;
  let sx = 0, sy = 0, n = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let y = Math.floor(ry); y < ry + rh; y++) for (let x = Math.floor(rx); x < rx + rw; x++) if (ctx.isPointInPath(path, x + .5, y + .5)) {
    sx += x + .5; sy += y + .5; n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1); y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1);
  }
  return CGEO[key] = n ? { cx: sx / n, cy: sy / n, w: n / (y1 - y0), h: n / (x1 - x0), x0, x1, y0, y1 } : { cx: rx + rw / 2, cy: ry + rh / 2, w: rw, h: rh, x0: rx, x1: rx + rw, y0: ry, y1: ry + rh };
}
/* l'étendue horizontale visible d'une moitié de l'écu */
const halfSpan = h => { const g = cellGeom([h * 100, 0, 100, 252]); return [g.x0, g.x1]; };
const HALF_PK = .8, SUB_PK = .3, COUPE_PK = 1.4, DIAG_K = .6, LIGNE_D = 24;
/* le barycentre de ce qu'on voit d'un triangle du tranché ou du taillé (l'écu en rogne la pointe) */
const PGEO = {};
function polyGeom(poly) {
  const key = SHIELD_D + poly.join();
  if (PGEO[key]) return PGEO[key];
  const ctx = document.createElement("canvas").getContext("2d"), path = new Path2D(SHIELD_D), tri = new Path2D("M" + poly.map(p => p.join(",")).join("L") + "Z");
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < 252; y += 2) for (let x = 0; x < 200; x += 2) if (ctx.isPointInPath(path, x + 1, y + 1) && ctx.isPointInPath(tri, x + 1, y + 1)) { sx += x + 1; sy += y + 1; n++; }
  return PGEO[key] = n ? { cx: sx / n, cy: sy / n } : { cx: 100, cy: 126 };
}
function partiMap(c) {
  const [rx, ry, rw, rh] = c.rect, cx = rx + rw / 2, cy = ry + rh / 2, m = { px: rw / 200, py: rh / 252, vpx: rw / 200, vpy: rh / 252, fpy: Math.min(rh / 252, 1.4 * rw / 200), cell: true, half: true, pk: HALF_PK, shx: 0, shy: 0, cx, cy };
  m.rect = c.rect; m.edges = c.edges;
  if (c.poly) { const g = polyGeom(c.poly); return Object.assign(m, { ligne: c.ligne, px: 1, py: 1, vpx: DIAG_K, vpy: DIAG_K, fpy: DIAG_K, pk: DIAG_K, half: false, cx: 100, cy: 126, shx: g.cx - 100, shy: g.cy - 126, gx: g.cx, gy: g.cy }); }
  if (c.coupe) { const g = cellGeom(c.rect); return Object.assign(m, { half: false, coupe: true, shy: g.cy - cy, gx: g.cx, gy: g.cy, pk: Math.min(HALF_PK, COUPE_PK * g.h / 252) }); }      // une moitié de coupé : les figures se règlent sur sa hauteur visible
  if (c.q === undefined) { const g = cellGeom(c.rect); return Object.assign(m, { shx: g.cx - cx, gx: g.cx, gy: g.cy }); }      // une moitié se centre en largeur sur ce qu'on en voit
  const g = cellGeom(c.rect), ratio = Math.min(...c.rects.map(r => Math.min(cellGeom(r).w / r[2], 1)));      // les quatre quartiers gardent la même taille de figure : celle que le plus étroit tolère
  return Object.assign(m, { gx: g.cx, gy: g.cy, half: false, vpx: g.w / 200, vpy: g.h / 252, fpy: Math.min(g.h / 252, 1.4 * g.w / 200), pk: SUB_PK * (rw / 50) * ratio, shx: g.cx - cx, shy: g.cy - cy });
}
/* parti : chaque case reçoit ses armes entières resserrées à sa taille ; une moitié écartelée montre ses quatre quartiers */
function drawParti(St, u, ab) {
  let defs = `<clipPath id="cl-${u}"><path d="${SHIELD_D}"/></clipPath>`, body = "";
  const cells = partiCells(St);
  cells.forEach((c, ci) => {
    const m = partiMap(c), id = `${u}h${ci}`, [rx, ry, rw, rh] = c.rect;
    MAP = m; HSIDE = c.half;
    let r;
    try { r = drawBody(armsCell(St, c.arm), id); } finally { MAP = null; HSIDE = 0; }
    defs += r.defs + `<clipPath id="qr-${id}">${c.poly ? `<path d="M${c.poly.map(p => p.join(",")).join("L")}Z"/>` : `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}"/>`}</clipPath>`;
    body += `<g clip-path="url(#qr-${id})"><g transform="translate(${m.cx - 100},${m.cy - 126})">${r.body}</g></g>`;
  });
  const split = quarterGeom().split;
  let lignes = St.q === "c" ? `M0,${split}H200${chefParti(St) ? `M100,0V${split}` : ""}` : St.q === "t" ? "M0,0L200,252" : St.q === "l" ? "M200,0L0,252" : "M100,0V252";
  cells.filter(c => c.q === 0).forEach(c => { lignes += `M${c.mid},0V252M${c.a},${split}H${c.b}`; });
  body += `<path d="${lignes}" fill="none" stroke="#1a1712" stroke-width=".8" opacity=".55"/>`;
  const gl = GBR(St) ? brisLayer(St.A[0], `${u}g`) : null;
  if (gl) { defs += gl.defs; body += gl.bris; }
  return `<defs>${defs}</defs><g clip-path="url(#cl-${u})">${body}</g>${ab}${shieldFinish()}`;
}
function drawShield(St, u) {
  SHIELD_D = (SHAPES[St.sh] || SHAPES[""]).d;
  const ab = St.ab ? abime(St, u) : "";
  if (!St.q) return draw(St.A[0], u, ab);
  if (["p", "c", "t", "l"].includes(St.q)) return drawParti(St, u, ab);
  const G = quarterGeom();
  let defs = `<clipPath id="cl-${u}"><path d="${SHIELD_D}"/></clipPath>`, body = "";
  quarterArms(St).forEach((ai, qi) => {
    const a = armsCell(St, ai), g = G.q[qi];
    let r, under;
    NOBORD = true;
    try { r = drawBody(a, `${u}q${qi}`); under = drawBody({ ...a, m: "", br: "" }, `${u}u${qi}`); } finally { NOBORD = false; }
    const ed = ["rb", "lb", "rt", "lt"][qi], bande = (enBande(a.p) ? bandeDeCase(a.p, tinctPaint(a.tp), g.rect, .5, ed, a.ln) : "") + (a.br === "bordure" ? bandeDeCase("bordure", tinctPaint(a.tbr), g.rect, .5, ed, a.lbr) : "");
    const [ox, oy, s] = qOrigin(g), [cx, cy, cs] = qCover(g);
    defs += r.defs + under.defs + `<clipPath id="qr-${u}${qi}"><rect x="${g.rect[0]}" y="${g.rect[1]}" width="${g.rect[2]}" height="${g.rect[3]}"/></clipPath>`;
    body += `<g clip-path="url(#qr-${u}${qi})"><g transform="translate(${cx.toFixed(1)},${cy.toFixed(1)}) scale(${cs.toFixed(4)})">${under.body}</g>`
      + `<g transform="translate(${ox.toFixed(1)},${oy.toFixed(1)}) scale(${s})">${r.body}</g>${bande}</g>`;
  });
  body += `<path d="M100,0V252M0,${G.split}H200" fill="none" stroke="#1a1712" stroke-width=".8" opacity=".55"/>`;
  const gl = GBR(St) ? brisLayer(St.A[0], `${u}g`) : null;
  if (gl) { defs += gl.defs; body += gl.bris; }
  return `<defs>${defs}</defs><g clip-path="url(#cl-${u})">${body}</g>${ab}${shieldFinish()}`;
}

/* ---------- les ornements extérieurs ---------- */
const TXT = {};
async function getText(path) {
  if (!(path in TXT)) { const r = await fetch(path); if (!r.ok) throw new Error(`HTTP ${r.status} — ${path}`); TXT[path] = await r.text(); }
}
/* les couronnes sont des PNG : en data URI pour qu'elles survivent à l'export */
async function getDataUri(path) {
  if (path in TXT) return;
  const r = await fetch(path);
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${path}`);
  const b = await r.blob();
  TXT[path] = await new Promise((ok, ko) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = ko; fr.readAsDataURL(b); });
}
const ornOf = s => { const O = ATL.ornements; return { cr: O.couronnes.find(c => c.kind === s.cr), co: O.colliers.find(c => c.kind === s.co), su: O.supports.find(x => x.kind === s.su), hm: s.hm ? O.heaumes.find(h => h.type === s.ht && h.pos === s.hp) || O.heaumes[0] : null }; };
/* boîte du dessin réel d'un fichier (ses marges vides varient d'un fichier à l'autre) */
const BBOX = {};
function bboxOf(key, inner) {
  if (!(key in BBOX)) { const g = $("#measure g"); g.innerHTML = inner; const b = g.getBBox(); BBOX[key] = [b.x, b.y, b.width, b.height]; g.innerHTML = ""; }
  return BBOX[key];
}
async function loadAll(St) {
  const O = ATL.ornements, { cr, co, su, hm } = ornOf(St), jobs = [];
  for (const i of active(St)) { const a = St.A[i]; if (a.m) jobs.push(loadSvg(meuble(a.m))); if (a.m && a.m2) jobs.push(loadSvg(meuble(a.m2))); if (a.cmp) for (const k of [a.cm1, a.cm2]) if (k) jobs.push(loadSvg(meuble(k)));
    if (a.m && a.cn) jobs.push(loadSvg(meuble(a.cnk === "antique" ? "couronne-antique" : "couronne"))); if (a.m && a.m2 && a.cn2) jobs.push(loadSvg(meuble(a.cnk2 === "antique" ? "couronne-antique" : "couronne"))); if (BRIS_FIGS.includes(a.br)) jobs.push(loadSvg(meuble(a.br))); if (a.br === "lambel" && a.lpc) jobs.push(loadSvg(meuble(a.lpc))); }
  if (su) jobs.push(loadSvg(meuble(su.kind)));
  if (St.hm && St.ci) jobs.push(loadSvg(meuble(St.ci)));
  if (hm) jobs.push(getText(hm.path));
  if (St.hm === "hl") jobs.push(getText(O.lambrequins.path));
  if (St.hm && St.pa) jobs.push(getText(O.plume.path));
  if (co) jobs.push(getText(co.path));
  if (cr) jobs.push(getDataUri(cr.png));
  await Promise.all(jobs);
}
const suppAccent = s => s.ts === "Gueules" ? "Azur" : "Gueules";
/* le manteau : une draperie de l'émail mc, doublée de ml, qui retombe autour de l'écu ; le pavillon : la tente qui le coiffe (au souverain seul). Dessinés ici, d'après
   la description de « Manteau (héraldique) » (draperie de couleur, généralement doublée d'hermine) : une moitié, reflétée. Les coordonnées sont celles de l'écu (200 × 252). */
const ourlet = (x0, x1, y, d, n) => { let s = "", w = (x1 - x0) / n; for (let i = 0; i < n; i++) s += `Q${(x0 + w * (i + .5)).toFixed(1)},${y + d} ${(x0 + w * (i + 1)).toFixed(1)},${y}`; return s; };
function manteauSvg(St, u) {
  const pav = St.mt === "p", ext = tinctPaint(St.mc), dbl = tinctPaint(St.ml), or = "url(#m-or)", ink = "#1a1712";
  /* chaque moitié : le contour extérieur, la doublure en retrait, le filet d'or de la doublure */
  const draperie = (hautY, haut, bas, hemY, ex, ixTop, ixBot, hemIn, n1, n2) => {
    const outer = `M100,${hautY} ${haut} ${ourlet(ex, 100, hemY, 14, n1)}`, inner = `M100,${ixTop} ${bas} ${ourlet(ixBot, 100, hemIn, 12, n2)}`;
    return { outer, inner };
  };
  const m = draperie(-26, "C46,-24 -14,32 -44,122 C-62,178 -70,232 -76,284", "C54,-6 6,40 -18,126 C-33,176 -40,226 -44,270", 284, -76, -8, -44, 270, 6, 5);
  const gauche = (o, i, filet) =>
    `<path d="${o} Z" fill="${ext}" stroke="${ext}" stroke-width=".8"/><path d="${o}" fill="none" stroke="${ink}" stroke-width="1.3" stroke-linejoin="round"/>`
    + `<path d="${i} Z" fill="${dbl}" stroke="${dbl}" stroke-width=".8"/><path d="${filet}" fill="none" stroke="${or}" stroke-width="2.4"/><path d="${i}" fill="none" stroke="${ink}" stroke-width=".9" stroke-linejoin="round"/>`;
  const paire = g => `<g>${g}</g><g transform="translate(200,0) scale(-1,1)">${g}</g>`;
  let svg = paire(gauche(m.outer, m.inner, "M100,-8 C54,-6 6,40 -18,126 C-33,176 -40,226 -44,270"));
  let bb = [-80, -30, 360, 330];
  if (pav) {
    const o = `M100,-168 C72,-166 28,-130 4,-70 C-12,-30 -28,12 -40,52 ${ourlet(-40, 100, 52, 14, 5)}`, i = `M100,-146 C78,-143 44,-114 24,-64 C10,-30 -2,2 -10,38 ${ourlet(-10, 100, 38, 10, 4)}`;
    svg += paire(gauche(o, i, "M100,-146 C78,-143 44,-114 24,-64 C10,-30 -2,2 -10,38"))
      + `<circle cx="100" cy="-174" r="7" fill="${or}" stroke="${ink}" stroke-width="1.2"/>`;
    bb = [-80, -184, 360, 484];
  }
  return { svg, bb };
}
const PLAIN_VB = [0, 0, 200, 252];
function compose(St, u = "a") {
  const O = ATL.ornements, { cr, co, su, hm } = ornOf(St), dv = St.dv.trim(), shield = drawShield(St, u);
  if (!cr && !St.hm && !co && !su && !dv && !St.mt) return { vb: PLAIN_VB, svg: shield };
  let defs = "", back = "", front = "", bb = [0, 0, 200, 252];
  const grow = (x, y, w, h) => { bb = [Math.min(bb[0], x), Math.min(bb[1], y), Math.max(bb[2], x + w), Math.max(bb[3], y + h)]; };
  const place = (id, x, y, w, h, flip) => { grow(x, y, w, h); return `<use href="#${id}" x="${x}" y="${y}" width="${w}" height="${h}"${flip ? ` transform="matrix(-1 0 0 1 ${2 * x + w} 0)"` : ""}/>`; };
  const sized = (txt, W) => { const [w, h] = vbOf(txt); return W * h / w; };
  if (St.mt) {
    const M = manteauSvg(St, u);
    back += M.svg;
    grow(M.bb[0], M.bb[1], M.bb[2], M.bb[3]);
  }
  if (St.hm === "hl") {
    const L = O.lambrequins, t = TXT[L.path], W = 330;
    defs += fileSymbol(recolor(t, L, St.tl1, St.tl2), `lb-${u}`, "#1a1712");
    back += place(`lb-${u}`, 100 - W / 2, -66, W, sized(t, W));
  }
  if (co) {
    const t = TXT[co.path], { W, x, y } = co.pos;
    defs += fileSymbol(t, `co-${u}`, "#1a1712");
    back += place(`co-${u}`, x, y, W, sized(t, W));
  }
  if (su) {
    const t = SVGTXT[su.kind], [w, h] = vbOf(t), H = 236, W = Math.min(140, H * w / h);
    defs += symbolFor({ ...ADEF, m: su.kind, tm: St.ts, ta: suppAccent(St) }, `su-${u}`);
    back += place(`su-${u}`, 10 - W, 262 - H, W, H, true) + place(`su-${u}`, 190, 262 - H, W, H, false);
  }
  let top = 8, helm = "", crown = "", plumes = "", helmTop = 0, helmH = 0;
  if (hm) {
    /* le heaume est calé sur son dessin réel : centré sur l'écu, posé sur son bord supérieur ; « à senestre » = retourné */
    const t = hm.main ? recolor(TXT[hm.path], hm, "Argent", "Argent") : TXT[hm.path];
    const inner = fileInner(t, `hm-${u}`), [bx, by0, bw, bh] = bboxOf(hm.path, fileInner(TXT[hm.path], "m"));
    const W = hm.pos === "profil" ? 100 : 112, k = W / bw, base = 50;
    helmH = bh * k; helmTop = base - helmH;
    const flip = St.hp !== "face" && St.hs !== hm.nat;
    helm = `<g transform="translate(100,${base}) scale(${flip ? -k : k},${k}) translate(${-(bx + bw / 2)},${-(by0 + bh)})"><g fill="#1a1712" stroke-linejoin="round">${inner}</g></g>`;
    grow(100 - W / 2, helmTop, W, helmH);
    top = helmTop + helmH * .32;
  }
  let crownY = null, crownH = 0;
  if (cr) {
    const W = hm ? 96 : cr.kind === "roi" ? 120 : 150, H = W * cr.wh[1] / cr.wh[0], x = 100 - W / 2;
    crownY = top - H; crownH = H;
    grow(x, crownY, W, H);
    crown = `<image href="${TXT[cr.png]}" x="${x}" y="${crownY}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  if (hm && St.pa) {
    /* toutes les plumes partent d'un même point, caché par le heaume ou la couronne : on pivote sur la tige du fichier */
    const P = O.plume, t = TXT[P.path], W = 92, H = sized(t, W), sx = W * P.tige[0], sy = H * P.tige[1];
    const by = crownY !== null ? crownY + crownH * .55 : helmTop + helmH * .16;
    defs += fileSymbol(recolor(t, P, St.pa1, St.pa1), `pl1-${u}`, "#1a1712") + fileSymbol(recolor(t, P, St.pa2, St.pa2), `pl2-${u}`, "#1a1712");
    const angles = St.pa === "5" ? [-48, -24, 0, 24, 48] : [-28, 0, 28];
    plumes = angles.map((a, i) => `<g transform="translate(100,${by.toFixed(1)}) rotate(${a}) scale(${a < 0 ? -1 : 1},1) translate(${-sx},${-sy})"><use href="#pl${i % 2 ? 2 : 1}-${u}" width="${W}" height="${H}"/></g>`).join("");
    grow(100 - H - W / 2, by - H - 8, 2 * H + W, H + 8);
  }
  /* le cimier : un meuble posé sur le heaume, sur un bourrelet aux émaux des lambrequins — ou sur la couronne, s'il y en a une ; « issant » : la moitié haute seulement */
  let crest = "";
  if (hm && St.ci) {
    const m = meuble(St.ci), id = `ci-${u}`, issant = St.cim === "issant", k = issant ? .74 : .56, H = 172 * k;
    defs += symbolFor({ ...ADEF, m: St.ci, tm: St.cit, ta: St.cia, nb: "1" }, id);
    const bourrelet = crownY === null;
    const yb = bourrelet ? helmTop + helmH * .1 : crownY + crownH * .22, yc = issant ? yb : yb - H / 2, flipC = (St.hp !== "face" && St.hs === "s") !== !!meuble(St.ci)?.retourne;
    if (bourrelet) {                                                // le bourrelet : six segments aux émaux des lambrequins
      const w = 74, h = 11, x0 = 100 - w / 2, y0 = yb - h / 2;
      let b = "";
      for (let i = 0; i < 6; i++) b += `<rect x="${(x0 + i * w / 6).toFixed(1)}" y="${y0.toFixed(1)}" width="${(w / 6 + .6).toFixed(1)}" height="${h}" rx="3" fill="${tinctPaint(i % 2 ? St.tl2 : St.tl1)}" stroke="#1a1712" stroke-width=".8"/>`;
      crest += b;
      grow(x0, y0, w, h);
    }
    defs += `<clipPath id="cic-${u}"><rect x="-300" y="-400" width="800" height="${(yb + 400).toFixed(1)}"/></clipPath>`;
    crest += `<g${issant ? ` clip-path="url(#cic-${u})"` : ""}><g transform="translate(100,${yc.toFixed(1)}) scale(${flipC ? -k : k},${k}) translate(-100,-116)">${useFor(m, id)}</g></g>`;
    grow(100 - 75 * k, yb - (issant ? H / 2 : H) - 4, 150 * k, (issant ? H / 2 : H) + 4);
  }
  front += (St.ci && hm ? "" : plumes) + helm + crown + crest;
  if (dv) {
    const y0 = co ? co.devY : 262, x0 = su ? -120 : -34, x1 = su ? 320 : 234;
    const B = DEVISES[St.dt].build(x0, x1, y0);
    const fs = Math.min(15, (x1 - x0 - 40) / (dv.length * .66));
    defs += `<path id="dvp-${u}" d="${B.d}"/>`;
    front += B.svg
      + `<text font-family="'EB Garamond', Georgia, serif" font-size="${fs.toFixed(1)}" letter-spacing=".8" fill="#1a1712"><textPath href="#dvp-${u}" startOffset="50%" text-anchor="middle">${esc(dv.toUpperCase())}</textPath></text>`;
    grow(x0 - 30, y0, x1 - x0 + 60, B.h);
  }
  const pad = 8;
  return { vb: [bb[0] - pad, bb[1] - pad, bb[2] - bb[0] + 2 * pad, bb[3] - bb[1] + 2 * pad], svg: `<defs>${defs}</defs>${back}<g>${shield}</g>${front}` };
}
function ornText(St) {
  const { cr, co, su } = ornOf(St), out = [];
  if (St.hm) {
    const O = ATL.ornements;
    let t = `${O.heaumeTypes[St.ht]} ${O.heaumePos[St.hp].toLowerCase()}${St.hp !== "face" ? (St.hs === "s" ? ", tourné à senestre" : ", tourné à dextre") : ""}` + (St.hm === "hl" ? `, lambrequins ${de(St.tl1)} doublés ${de(St.tl2)}` : "");
    if (St.pa) t += `, panache de ${NB[+St.pa]} plumes d'autruche ${St.pa1 === St.pa2 ? de(St.pa1) : de(St.pa1) + " et " + de(St.pa2)}`;
    out.push(t);
  }
  if (St.hm && St.ci) {
    const c = charges({ m: St.ci, nb: "1", tm: St.cit, ta: St.cia, ct: "" }), f = c.g === "f";
    out.push(`Cimier : ${f ? "une" : "un"} ${c.nom}${St.cim ? (f ? " issante" : " issant") : ""} ${c.tinct}${c.acc}`);
  }
  if (St.mt) out.push(`${St.mt === "p" ? "Manteau surmonté d'un pavillon" : "Manteau"} ${de(St.mc)} doublé ${de(St.ml)}`);
  if (cr) out.push(cr.nom);
  if (su) {
    const m = meuble(su.kind);
    out.push(`${su.mot} : deux ${m.plur} ${de(St.ts)}${m.accent && m.accentMot ? " " + agree(m.accentMot, m.g, true) + " " + de(suppAccent(St)) : ""}`);
  }
  if (co) out.push(co.nom);
  if (St.dv.trim()) out.push(`Devise : « ${St.dv.trim()} »`);
  return out.join(" · ");
}


/* ---------- les crédits des figures empruntées à Wikimedia Commons ---------- */
function creditsOf(St) {
  const out = [], add = (label, c, adapt) => {
    const prev = out.find(x => x.commons === c.commons);
    if (prev) { if (!prev.label.toLowerCase().includes(label.toLowerCase())) prev.label += ", " + label.toLowerCase(); }
    else out.push({ label, adapt, commons: c.commons, auteur: c.auteur, lic: c.lic, licurl: c.licurl });
  };
  for (const i of active(St)) {
    const a = St.A[i];
    for (const k of [a.m, count2(a) ? a.m2 : "", BRIS_FIGS.includes(a.br) ? a.br : "", a.br === "lambel" ? a.lpc : ""]) { const m = k && meuble(k); if (m && (m.file || m.credit)) add(cap(m.nom), m.file || m.credit, true); }
  }
  const O = ATL.ornements, { cr, co, su } = ornOf(St);
  if (su) add("Supports", meuble(su.kind).file, true);
  if (cr) add(cr.nom, cr, false);
  if (St.hm) add("Heaume", ornOf(St).hm, false);
  if (St.hm === "hl") add("Lambrequins", O.lambrequins, true);
  if (St.hm && St.ci) { const m = meuble(St.ci); if (m && (m.file || m.credit)) add("Cimier", m.file || m.credit, true); }
  if (St.hm && St.pa) add("Panache", O.plume, true);
  if (co) add(co.nom, co, false);
  return out;
}
const creditTxt = c => `${c.label} : ${c.commons} — ${c.auteur}, ${c.lic}, via Wikimedia Commons${c.adapt ? ", couleurs adaptées" : ""}`;
/* les mêmes crédits, en HTML, avec liens vers la page du fichier et vers la licence */
const creditsHtml = cr => cr.length ? cr.map(c => `${esc(c.label)} : <a href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(c.commons.replace(/ /g, "_"))}" target="_blank" rel="noopener">« ${esc(c.commons)} »</a> — ${esc(c.auteur)}, <a href="${esc(c.licurl)}" target="_blank" rel="noopener">${esc(c.lic)}</a>, via Wikimedia Commons${c.adapt ? " · couleurs adaptées" : ""}`).join("<br>") : "Toutes les figures de cet écu sont dessinées par l'encyclopédie.";

/* ---------- la règle des émaux ---------- */function rule(s) {
  const out = [], word = t => MOT[t];
  const check = (fig, sur, quoi, lieu) => {
    const a = classe(fig), b = classe(sur);
    if (fig === sur) out.push(`${quoi} ${de(fig)} sur ${lieu} ${de(sur)} : même émail, la figure disparaît.`);
    else if (a === b && a !== "Fourrure") out.push(`${a === "Métal" ? "Métal sur métal" : "Couleur sur couleur"} : ${quoi} ${de(fig)} sur ${lieu} ${de(sur)}.`);
  };
  if (s.p && s.f === "plein") check(s.tp, s.t1, cap(art(s.p, PIECES[s.p].g)) + s.p, "un champ");
  if (s.m) {
    const m = meuble(s.m), quoi = s.nb === "1" || m.seul ? "Le meuble" : "Les meubles";
    if (s.p && s.pos === "sur") check(s.tm, s.tp, quoi, { chef: "le chef", canton: "le canton", "franc-quartier": "le franc-quartier" }[s.p] || "la pièce");
    else if (s.f === "plein") check(s.tm, s.t1, quoi, "un champ");
  }
  if (count2(s) && s.f === "plein") check(s.tm2, s.t1, s.nb2 === "1" ? "Le second meuble" : "Les seconds meubles", "un champ");
  return out;
}
function ruleAll(St) {
  const out = !St.q ? rule(St.A[0]) : cellNames(St).flatMap(([i, nom]) => rule(St.A[i]).map(w => `${nom} : ${w}`));
  return St.ab ? [...out, ...rule(St.A[4]).map(w => `Écusson : ${w}`)] : out;
}

