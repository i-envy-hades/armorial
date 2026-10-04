const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const F = $("#panel");

/* bordure et orle : les dispositions du champ plein, resserrées vers le cœur */
const shrink = (pts, k) => pts.map(([x, y, s, r]) => [100 + (x - 100) * k, 120 + (y - 120) * k, s * k, r]);
const SHRINK = { plein: 1, bordure: .84, orle: .74 };
/* réglages graphiques (adMap, adStr : assets/blasonnement.js) appliqués aux positions */
const adjust = (pts, a, grp, sfx) => {
  const map = adMap(a), k = +a["sz" + sfx] / 100, dx = +a["dx" + sfx], dy = +a["dy" + sfx];
  return pts.map(([x, y, sc, r], i) => { const it = map.get(`${grp}.${i}`) || [100, 0, 0]; return [x + dx + it[1], y + dy + it[2], sc * k * it[0] / 100, r]; });
};
function ptsFor(s, m) {
  if (s.nb === "seme") return SEME.map(([x, y, sc]) => [x, y, sc * +s.sz / 100]);
  let pts;
  if (m.seul) pts = [[100, 116, 1]];
  else if (PLEINLIKE.has(ctxOf(s))) { const d = dispoOf(s); pts = d ? shrink(d.pts, SHRINK[ctxOf(s)]) : []; }
  else pts = (LAYOUT[ctxOf(s)] || {})[s.nb] || [];
  return adjust(pts, s, 1, "");
}
const pts2 = s => adjust(dispo2(s).pts, s, 2, "2");

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
const ODEF = { q: "", sh: "", cr: "", hm: "", ht: "grilles", hp: "34", hs: "", tl1: "Gueules", tl2: "Or", pa: "", pa1: "Argent", pa2: "Gueules", su: "", ts: "Or", co: "", dv: "", dt: "", ab: "" };
const OPT = new Set(["p", "m", "m2", "d", "d2", "q", "sh", "cr", "hm", "hs", "pa", "su", "co", "dv", "dt", "ab", "ct", "ct2", "ln"]);
const PFX = ["", "b_", "c_", "d_", "e_"];
const fresh = () => ({ ...ODEF, A: ADEFS.map(a => ({ ...a })) });
let S = fresh(), CUR = 0, KT = "1";
const cur = () => S.A[CUR];
function normalizeAll(St) {
  if (!["", "2", "4"].includes(St.q)) St.q = "";
  for (const k of ["tl1", "tl2", "pa1", "pa2", "ts"]) if (!own(MOT, St[k])) St[k] = ODEF[k];
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
  return s.replace(/@@M@@/g, tinctPaint(tm)).replace(/@@A@@/g, tinctPaint(ta));
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
  return fileSymbol(txt, id, m.base ? tinctPaint(tm) : line, m.outline ? { stroke: line, width: vbOf(txt)[0] / 70 } : null);
}
/* un fichier SVG emprunté devient un <symbol> ; ses id internes sont préfixés pour ne pas heurter ceux de la page */
function fileSymbol(txt, id, fill, outline) {
  const [w, h] = vbOf(txt), vb = (txt.match(/<svg\b[^>]*\bviewBox="([^"]+)"/) || [])[1] || `0 0 ${w} ${h}`;
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
/* flip : meuble contourné, retourné vers senestre (miroir autour de son axe) */
const placeAll = (pts, m, id, flip) => pts.map(([x, y, k, r]) => `<g transform="translate(${x},${y})${r ? ` rotate(${r})` : ""} scale(${flip ? `${-k},${k}` : k}) translate(-100,-116)">${useFor(m, id)}</g>`).join("");
function drawBody(s, u) {
  let field;
  if (s.f === "part") field = partitionInner(s.part, [s.t1, s.t2, s.t3]);
  else if (s.f === "ray") field = recoupementInner(s.ray, +s.n, tinctPaint(s.t1), tinctPaint(s.t2));
  else field = `<rect width="200" height="252" fill="${tinctPaint(s.t1)}"/>`;
  const m = s.m && meuble(s.m), m2 = count2(s) && meuble(s.m2);
  let defs = "", under = "", over = "";
  if (m) {
    defs += symbolFor(s, `chg-${u}`);
    const g = placeAll(ptsFor(s, m), m, `chg-${u}`, s.ct);
    if (s.nb === "seme") under = g; else over = g;
  }
  if (m2) {
    defs += symbolFor(arms2(s), `chg2-${u}`);
    over += placeAll(pts2(s), m2, `chg2-${u}`, s.ct2);
  }
  const piece = s.p ? pieceInner(s.p, tinctPaint(s.tp), s.ln) : "";
  return { defs, body: field + under + piece + over };
}
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
function drawShield(St, u) {
  SHIELD_D = (SHAPES[St.sh] || SHAPES[""]).d;
  const ab = St.ab ? abime(St, u) : "";
  if (!St.q) return draw(St.A[0], u, ab);
  const G = quarterGeom();
  let defs = `<clipPath id="cl-${u}"><path d="${SHIELD_D}"/></clipPath>`, body = "";
  quarterArms(St).forEach((ai, qi) => {
    const a = St.A[ai], r = drawBody(a, `${u}q${qi}`), under = drawBody({ ...a, m: "" }, `${u}u${qi}`), g = G.q[qi];
    const [ox, oy, s] = qOrigin(g), [cx, cy, cs] = qCover(g);
    defs += r.defs + under.defs + `<clipPath id="qr-${u}${qi}"><rect x="${g.rect[0]}" y="${g.rect[1]}" width="${g.rect[2]}" height="${g.rect[3]}"/></clipPath>`;
    body += `<g clip-path="url(#qr-${u}${qi})"><g transform="translate(${cx.toFixed(1)},${cy.toFixed(1)}) scale(${cs.toFixed(4)})">${under.body}</g>`
      + `<g transform="translate(${ox.toFixed(1)},${oy.toFixed(1)}) scale(${s})">${r.body}</g></g>`;
  });
  body += `<path d="M100,0V252M0,${G.split}H200" fill="none" stroke="#1a1712" stroke-width=".8" opacity=".55"/>`;
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
  for (const i of active(St)) { const a = St.A[i]; if (a.m) jobs.push(loadSvg(meuble(a.m))); if (a.m && a.m2) jobs.push(loadSvg(meuble(a.m2))); }
  if (su) jobs.push(loadSvg(meuble(su.kind)));
  if (hm) jobs.push(getText(hm.path));
  if (St.hm === "hl") jobs.push(getText(O.lambrequins.path));
  if (St.hm && St.pa) jobs.push(getText(O.plume.path));
  if (co) jobs.push(getText(co.path));
  if (cr) jobs.push(getDataUri(cr.png));
  await Promise.all(jobs);
}
const suppAccent = s => s.ts === "Gueules" ? "Azur" : "Gueules";
const PLAIN_VB = [0, 0, 200, 252];
function compose(St, u = "a") {
  const O = ATL.ornements, { cr, co, su, hm } = ornOf(St), dv = St.dv.trim(), shield = drawShield(St, u);
  if (!cr && !St.hm && !co && !su && !dv) return { vb: PLAIN_VB, svg: shield };
  let defs = "", back = "", front = "", bb = [0, 0, 200, 252];
  const grow = (x, y, w, h) => { bb = [Math.min(bb[0], x), Math.min(bb[1], y), Math.max(bb[2], x + w), Math.max(bb[3], y + h)]; };
  const place = (id, x, y, w, h, flip) => { grow(x, y, w, h); return `<use href="#${id}" x="${x}" y="${y}" width="${w}" height="${h}"${flip ? ` transform="matrix(-1 0 0 1 ${2 * x + w} 0)"` : ""}/>`; };
  const sized = (txt, W) => { const [w, h] = vbOf(txt); return W * h / w; };
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
  front += plumes + helm + crown;
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
  if (cr) out.push(cr.nom);
  if (su) {
    const m = meuble(su.kind);
    out.push(`${su.mot} : deux ${m.plur} ${de(St.ts)}${m.accent && m.accentMot ? " " + agree(m.accentMot, m.g, true) + " " + de(suppAccent(St)) : ""}`);
  }
  if (co) out.push(co.nom);
  if (St.dv.trim()) out.push(`Devise : « ${St.dv.trim()} »`);
  return out.join(" · ");
}


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
  const out = !St.q ? rule(St.A[0]) : active(St).filter(i => i < 4).flatMap(i => rule(St.A[i]).map(w => `${QNAME[St.q][i]} : ${w}`));
  return St.ab ? [...out, ...rule(St.A[4]).map(w => `Écusson : ${w}`)] : out;
}

/* ---------- interface ---------- */
function chipRow(el) {
  const name = el.dataset.name;
  el.innerHTML = DATA.tinctures.map(t => `<label class="chip" title="${esc(t.nom)} (${esc(t.type.toLowerCase())})"><input type="radio" name="${name}" value="${esc(t.nom)}"><span>${shieldSwatch(t.nom, "couleur", 26)}${esc(t.nom)}</span></label>`).join("");
}
function fillSelects() {
  F.part.innerHTML = DATA.partitions.map(p => `<option value="${esc(p.kind)}">${esc(p.nom)}</option>`).join("");
  F.p.innerHTML = `<option value="">Aucune</option>` + [...DATA.pieces, ...(ATL.pieces || [])].filter(p => PIECES[p.kind]).map(p => `<option value="${esc(p.kind)}">${esc(p.nom)}</option>`).join("");
  F.ln.innerHTML = `<option value="">Droit</option>` + Object.entries(CONTOUR_NOM).map(([k, v]) => `<option value="${k}">${cap(v)}</option>`).join("");
  const cats = [...new Set(ATL.meubles.map(m => m.cat))];
  F.m.innerHTML = `<option value="">Aucun</option>` + cats.map(c => `<optgroup label="${esc(c)}">${ATL.meubles.filter(m => m.cat === c).map(m => `<option value="${esc(m.kind)}">${esc(m.nom)}</option>`).join("")}</optgroup>`).join("");
  F.m2.innerHTML = F.m.innerHTML;
  const O = ATL.ornements;
  F.cr.innerHTML = `<option value="">Aucune</option>` + O.couronnes.map(c => `<option value="${esc(c.kind)}">${esc(c.nom)}</option>`).join("");
  F.su.innerHTML = `<option value="">Aucun</option>` + O.supports.map(x => `<option value="${esc(x.kind)}">Deux ${esc(meuble(x.kind).plur)}</option>`).join("");
  F.co.innerHTML = `<option value="">Aucun</option>` + O.colliers.map(c => `<option value="${esc(c.kind)}">${esc(c.nom)}</option>`).join("");
  F.dt.innerHTML = Object.entries(DEVISES).map(([k, v]) => `<option value="${k}">${esc(v.nom)}</option>`).join("");
  F.sh.innerHTML = Object.entries(SHAPES).map(([k, v]) => `<option value="${k}">${esc(v.nom)}</option>`).join("");
  F.ht.innerHTML = Object.entries(O.heaumeTypes).map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join("");
  document.querySelectorAll(".chips").forEach(chipRow);
}
function setField(k, v) {
  const el = F.elements[k];
  if (!el) return;
  if (el instanceof RadioNodeList || el.length && el[0]?.type === "radio") [...el].forEach(r => r.checked = r.value === v);
  else if (el.value !== v) el.value = v;
}
function syncForm() {
  const a = cur(), m = a.m && meuble(a.m), m2 = count2(a) && meuble(a.m2);
  /* quelles armes se modifient : les quartiers (ou l'écu seul), et l'écusson en abîme s'il y en a un */
  const curs = [...(S.q ? QNAME[S.q].map((l, i) => [i, l]) : S.ab ? [[0, "Écu"]] : []), ...(S.ab ? [[4, "Écusson"]] : [])];
  $("#cur-seg").innerHTML = curs.map(([i, l]) => `<label><input type="radio" name="cur" value="${i}"${i === CUR ? " checked" : ""}><span>${l}</span></label>`).join("");
  $("#r-cur").hidden = $("#q-note").hidden = !curs.length;
  const cs = m ? countsFor(a) : [];
  F.nb.innerHTML = cs.map(n => `<option value="${n}">${n === "seme" ? "semé" : n}</option>`).join("");
  const ds = dispos(a);
  F.d.innerHTML = ds.map(d => `<option value="${d.id}">${esc(d.lab)}</option>`).join("");
  F.nb2.innerHTML = Object.keys(PLEIN).map(n => `<option value="${n}">${n}</option>`).join("");
  F.d2.innerHTML = PLEIN[a.nb2].map(d => `<option value="${d.id}">${esc(d.lab)}</option>`).join("");
  F.hp.innerHTML = ATL.ornements.heaumes.filter(h => h.type === S.ht).map(h => `<option value="${h.pos}">${esc(ATL.ornements.heaumePos[h.pos])}</option>`).join("");
  for (const k of Object.keys(ADEF)) setField(k, a[k]);
  for (const k of Object.keys(ODEF)) setField(k, S[k]);
  const tri = a.f === "part" && a.part.startsWith("tierce");
  $("#r-part").hidden = a.f !== "part";
  $("#r-ray").hidden = a.f !== "ray";
  $("#r-t2").hidden = a.f === "plein";
  $("#r-t3").hidden = !tri;
  $("#l-t1").textContent = a.f === "plein" ? "Émail" : "Premier émail";
  $("#r-tp").hidden = !a.p;
  $("#r-ln").hidden = !a.p;
  $("#r-ct").hidden = !(m && m.asym);
  $("#r-ct2").hidden = !(m2 && m2.asym);
  $("#r-nb").hidden = !m || cs.length < 2;
  $("#r-d").hidden = !m || m.seul || ds.length < 2;
  $("#r-tm").hidden = !m;
  const canSur = a.p && LAYOUT["sur-" + a.p], canAut = a.p && LAYOUT[a.p];
  $("#r-pos").hidden = !m || !a.p || !(canSur && canAut);
  $("#r-ta").hidden = !m || !m.accent;
  if (m?.accentMot) $("#l-ta").textContent = m.accentLabel || cap(m.accentMot.split(/[ ,]/)[0]);
  const note = $("#m-note");
  note.hidden = !m?.file;
  if (m?.file) note.textContent = `Figure empruntée à Wikimedia Commons, recolorée ici : ${m.file.auteur}, ${m.file.lic}.`;
  $("#r-m2").hidden = !m;
  $("#r-nb2").hidden = $("#r-d2").hidden = $("#r-tm2").hidden = !m2;
  $("#r-ta2").hidden = !m2 || !m2.accent;
  if (m2?.accentMot) $("#l-ta2").textContent = m2.accentLabel || cap(m2.accentMot.split(/[ ,]/)[0]);
  $("#r-tl1").hidden = $("#r-tl2").hidden = S.hm !== "hl";
  $("#r-pa").hidden = !S.hm;
  $("#r-pa1").hidden = $("#r-pa2").hidden = !S.hm || !S.pa;
  $("#r-ts").hidden = !S.su;
  $("#r-dt").hidden = !S.dv.trim();
  $("#r-hp").hidden = !S.hm;
  $("#r-hs").hidden = S.hp === "face";
  $("#hm-note").textContent = "";
  syncAdj();
}
/* la cible des curseurs : tout un groupe ("1", "2") ou un seul meuble ("1.0", "2.2"…) */
function adjTargets(a) {
  const m = a.m && meuble(a.m), m2 = count2(a) && meuble(a.m2), n1 = count1(a), n2 = count2(a), out = [];
  const all = (mm, n, extra) => (n === 1 ? cap(art(mm.sing, mm.g)) + mm.sing : `${mm.g === "f" ? "Toutes les" : "Tous les"} ${mm.plur}`) + extra;
  if (m) { out.push(["1", all(m, n1, "")]); if (n1 > 1) for (let i = 0; i < n1; i++) out.push([`1.${i}`, `${cap(m.sing)} n° ${i + 1}`]); }
  if (m2) { out.push(["2", all(m2, n2, " (second meuble)")]); if (n2 > 1) for (let i = 0; i < n2; i++) out.push([`2.${i}`, `${cap(m2.sing)} n° ${i + 1} (second)`]); }
  return out;
}
function adjValues(a, t) {
  if (t === "1" || t === "2") { const x = t === "2" ? "2" : ""; return [+a["sz" + x], +a["dx" + x], +a["dy" + x]]; }
  return adMap(a).get(t) || [100, 0, 0];
}
function syncAdj() {
  const a = cur(), ts = adjTargets(a);
  $("#r-adj").hidden = !ts.length;
  if (!ts.length) return;
  if (!ts.some(([v]) => v === KT)) KT = "1";
  $("#k-t").innerHTML = ts.map(([v, l]) => `<option value="${v}"${v === KT ? " selected" : ""}>${esc(l)}</option>`).join("");
  const [sz, dx, dy] = adjValues(a, KT);
  $("#k-sz").value = sz; $("#k-dx").value = dx; $("#k-dy").value = -dy;
  $("#o-sz").textContent = sz + " %";
  $("#o-dx").textContent = dx ? (dx > 0 ? "→ " : "← ") + Math.abs(dx) : "0";
  $("#o-dy").textContent = dy ? (dy < 0 ? "↑ " : "↓ ") + Math.abs(dy) : "0";
}
function setAdj(v) {
  const a = cur();
  if (KT === "1" || KT === "2") { const x = KT === "2" ? "2" : ""; a["sz" + x] = String(v[0]); a["dx" + x] = String(v[1]); a["dy" + x] = String(v[2]); return; }
  const map = adMap(a);
  if (v[0] === 100 && !v[1] && !v[2]) map.delete(KT); else map.set(KT, v);
  a.ad = adStr(map);
}
function readForm() {
  const a = cur();
  for (const [obj, def] of [[a, ADEF], [S, ODEF]]) for (const k of Object.keys(def)) {
    const el = F.elements[k];
    if (!el) continue;
    const v = el.value ?? "";
    obj[k] = v === "" && !OPT.has(k) ? def[k] : v;
  }
}
function encode(St) {
  const q = new URLSearchParams();
  for (const k of Object.keys(ODEF)) if (St[k] !== ODEF[k]) q.set(k, St[k]);
  for (const i of active(St)) for (const k of Object.keys(ADEF)) if (St.A[i][k] !== ADEFS[i][k]) q.set(PFX[i] + k, St.A[i][k]);
  return q.toString();
}
function decode(h) {
  const q = new URLSearchParams(h.replace(/^#/, "")), St = fresh();
  for (const k of Object.keys(ODEF)) if (q.has(k)) St[k] = q.get(k);
  St.A.forEach((a, i) => { for (const k of Object.keys(ADEF)) if (q.has(PFX[i] + k)) a[k] = q.get(PFX[i] + k); });
  return St;
}

function creditsOf(St) {
  const out = [], add = (label, c, adapt) => {
    const prev = out.find(x => x.commons === c.commons);
    if (prev) { if (!prev.label.toLowerCase().includes(label.toLowerCase())) prev.label += ", " + label.toLowerCase(); }
    else out.push({ label, adapt, commons: c.commons, auteur: c.auteur, lic: c.lic, licurl: c.licurl });
  };
  for (const i of active(St)) {
    const a = St.A[i];
    for (const k of [a.m, count2(a) ? a.m2 : ""]) { const m = k && meuble(k); if (m && (m.file || m.credit)) add(cap(m.nom), m.file || m.credit, true); }
  }
  const O = ATL.ornements, { cr, co, su } = ornOf(St);
  if (su) add("Supports", meuble(su.kind).file, true);
  if (cr) add(cr.nom, cr, false);
  if (St.hm) add("Heaume", ornOf(St).hm, false);
  if (St.hm === "hl") add("Lambrequins", O.lambrequins, true);
  if (St.hm && St.pa) add("Panache", O.plume, true);
  if (co) add(co.nom, co, false);
  return out;
}
const creditTxt = c => `${c.label} : ${c.commons} — ${c.auteur}, ${c.lic}, via Wikimedia Commons${c.adapt ? ", couleurs adaptées" : ""}`;
/* cercle d'or autour du meuble que visent les curseurs (aperçu seulement, pas dans les exports) */
function marker() {
  if (!/^[12]\.\d$/.test(KT)) return "";
  const a = cur(), [g, i] = KT.split(".").map(Number), m = meuble(g === 1 ? a.m : a.m2);
  const p = (g === 1 ? ptsFor(a, m) : pts2(a))[i];
  if (!p) return "";
  const spots = CUR === 4 ? [[100 - 100 * AB_K, 126 - 126 * AB_K, AB_K]]               // dans l'écusson en abîme
    : !S.q ? [[0, 0, 1]] : quarterArms(S).map((ai, qi) => ai === CUR ? qOrigin(quarterGeom().q[qi]) : null).filter(Boolean);
  return spots.map(([ox, oy, k]) => `<circle cx="${ox + p[0] * k}" cy="${oy + p[1] * k}" r="${Math.max(8, 82 * p[2] * k)}" fill="none" stroke="#c9a227" stroke-width="2.2" stroke-dasharray="6 4" pointer-events="none"/>`).join("");
}
async function render() {
  const tok = render.n = (render.n || 0) + 1;
  S = normalizeAll(S);
  try { await loadAll(S); }
  catch (e) { $("#blz").textContent = "Une figure n'a pas pu être chargée (" + e.message + ")."; return; }
  if (tok !== render.n) return;
  syncForm();
  const c = compose(S), sh = $("#shield");
  sh.setAttribute("viewBox", c.vb.join(" "));
  sh.classList.toggle("orn", c.vb !== PLAIN_VB);
  sh.innerHTML = c.svg + marker();
  const b = blazonAll(S);
  $("#blz").textContent = b;
  sh.setAttribute("aria-label", b);
  const o = ornText(S);
  $("#orn").hidden = !o;
  $("#orn").textContent = o;
  const w = ruleAll(S);
  $("#warn").hidden = !w.length;
  $("#warn").innerHTML = w.length ? w.map(esc).join("<br>") + ` La <a href="index.html#emaux">règle des émaux</a> l'interdit, sauf armes à enquerre${active(S).some(i => S.A[i].p === "chef") ? " — ou chef dit « cousu »" : ""}.` : "";
  const cr = creditsOf(S);
  $("#credits").innerHTML = cr.length ? cr.map(c => `${esc(c.label)} : <a href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(c.commons.replace(/ /g, "_"))}" target="_blank" rel="noopener">« ${esc(c.commons)} »</a> — ${esc(c.auteur)}, <a href="${esc(c.licurl)}" target="_blank" rel="noopener">${esc(c.lic)}</a>, via Wikimedia Commons${c.adapt ? " · couleurs adaptées" : ""}`).join("<br>") : "Toutes les figures de cet écu sont dessinées par l'encyclopédie.";
  const h = encode(S);
  history.replaceState(null, "", h ? "#" + h : location.pathname);
}

/* ---------- exports ---------- */
function standalone(St, scale = 3) {
  const defs = (globalDefs().match(/<defs>([\s\S]*)<\/defs>/) || ["", ""])[1];
  const b = blazonAll(St), o = ornText(St), c = compose(St, "x");
  const credit = creditsOf(St).map(creditTxt).join(" ; ");
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${c.vb.join(" ")}" width="${Math.round(c.vb[2] * scale)}" height="${Math.round(c.vb[3] * scale)}">
  <title>${esc(b)}</title>
  <desc>${esc("Composé dans l'Atelier de L'Armorial (CC BY-SA 4.0)." + (o ? " " + o + "." : "") + (credit ? " Figures : " + credit + "." : ""))}</desc>
  <defs>${defs}</defs>
  ${c.svg}
</svg>`;
}
function download(name, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const slug = St => blazonAll(St).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "armes";
function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), 1800); }
function wrapText(ctx, text, maxW) {
  const words = text.split(" "), lines = [];
  let line = "";
  for (const w of words) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  return lines;
}
async function exportPng(s) {
  const svg = standalone(s, 3), vb = compose(s, "y").vb;
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = url; });
  let iw = Math.min(780, vb[2] * 3), ih = iw * vb[3] / vb[2];
  if (ih > 900) { iw *= 900 / ih; ih = 900; }
  const W = 900, cv = document.createElement("canvas"), ctx = cv.getContext("2d");
  ctx.font = "italic 30px 'EB Garamond', Georgia, serif";
  const lines = wrapText(ctx, "« " + blazonAll(s) + " »", W - 120);
  ctx.font = "italic 20px 'EB Garamond', Georgia, serif";
  const oLines = ornText(s) ? wrapText(ctx, ornText(s), W - 120) : [];
  ctx.font = "16px Georgia, serif";
  const crLines = creditsOf(s).flatMap(c => wrapText(ctx, creditTxt(c), W - 120));
  const H = 50 + ih + 40 + lines.length * 40 + oLines.length * 28 + 24 + crLines.length * 22 + 50;
  cv.width = W; cv.height = H;
  ctx.fillStyle = "#f3eee0"; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, (W - iw) / 2, 50, iw, ih);
  URL.revokeObjectURL(url);
  ctx.fillStyle = "#22201b"; ctx.textAlign = "center";
  ctx.font = "italic 30px 'EB Garamond', Georgia, serif";
  let y = 50 + ih + 56;
  for (const l of lines) { ctx.fillText(l, W / 2, y); y += 40; }
  ctx.font = "italic 20px 'EB Garamond', Georgia, serif"; ctx.fillStyle = "#4a4335";
  for (const l of oLines) { ctx.fillText(l, W / 2, y); y += 28; }
  ctx.font = "16px Georgia, serif"; ctx.fillStyle = "#5c5446"; y += 6;
  for (const l of crLines) { ctx.fillText(l, W / 2, y); y += 22; }
  ctx.fillText("L'Armorial — atelier · CC BY-SA 4.0", W / 2, H - 22);
  cv.toBlob(b => download(slug(s) + ".png", b), "image/png");
}

/* ---------- hasard et exemples ---------- */
const EXEMPLES = [
  ["France moderne", { A0: { t1: "Azur", m: "fleurdelis", nb: "3", tm: "Or" } }],
  ["Savoie", { A0: { t1: "Gueules", p: "croix", tp: "Argent", m: "" } }],
  ["Bretagne", { A0: { t1: "Hermine", m: "" } }],
  ["Un semé", { A0: { t1: "Azur", m: "fleurdelis", nb: "seme", tm: "Or", p: "bande", tp: "Gueules" } }],
  ["Chef chargé", { A0: { t1: "Argent", p: "chef", tp: "Azur", m: "etoile", nb: "3", pos: "sur", tm: "Or" } }],
  ["Deux meubles", { A0: { t1: "Azur", m: "lion", nb: "1", tm: "Or", m2: "etoile", nb2: "3", d2: "chef", tm2: "Argent", sz: "85", dy: "14" } }],
  ["Écartelé", { q: "2", A0: { t1: "Azur", m: "fleurdelis", nb: "3", tm: "Or" }, A1: { t1: "Gueules", m: "", p: "croix", tp: "Argent" } }],
  ["Heaume à panache", { hm: "hl", pa: "5", tl1: "Azur", tl2: "Or", pa1: "Or", pa2: "Azur", A0: { t1: "Azur", m: "fleurdelis", nb: "3", tm: "Or" } }],
  ["Lion contourné", { A0: { t1: "Azur", m: "lion", nb: "1", tm: "Or", ta: "Gueules", ct: "1" } }],
  ["Fasce ondée", { A0: { t1: "Argent", m: "", p: "fasce", tp: "Azur", ln: "onde" } }],
  ["Bordure engrêlée", { A0: { t1: "Or", m: "lion", nb: "1", tm: "Sable", ta: "Gueules", p: "bordure", tp: "Gueules", ln: "engrele" } }],
  ["Franc-quartier", { A0: { t1: "Or", m: "epee", nb: "1", tm: "Argent", p: "franc-quartier", tp: "Azur", pos: "sur" } }],
  ["Angleterre", { A0: { t1: "Gueules", m: "leopard", nb: "3", d: "pal", tm: "Or", ta: "Azur", sz: "190" } }],
  ["Aigle bicéphale", { A0: { t1: "Or", m: "aigle-bicephale", nb: "1", tm: "Sable", ta: "Gueules" } }],
  ["Sur le tout", { q: "2", ab: "1", A0: { t1: "Gueules", m: "lion", nb: "1", tm: "Or", ta: "Azur" }, A1: { t1: "Azur", m: "fleurdelis", nb: "3", tm: "Or", p: "" }, A4: { t1: "Argent", m: "", p: "croix", tp: "Gueules" } }],
];
function example(ex) {
  const St = fresh();
  for (const [k, v] of Object.entries(ex)) { if (/^A\d$/.test(k)) Object.assign(St.A[+k[1]], v); else St[k] = v; }
  return St;
}
function randomArms() {
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const metaux = ["Or", "Argent"], couleurs = ["Gueules", "Azur", "Sable", "Sinople"];
  const metalChamp = Math.random() < .5;
  const champ = pick(metalChamp ? metaux : couleurs), contre = list => pick(list.filter(t => t !== champ));
  const s = { ...ADEF, f: Math.random() < .2 ? "part" : "plein", t1: champ, t2: contre(metalChamp ? couleurs : metaux) };
  s.part = pick(["parti", "coupe", "tranche", "ecartele"]);
  s.p = Math.random() < .6 ? pick(Object.keys(PIECES)) : "";
  s.tp = pick(metalChamp ? couleurs : metaux);
  s.m = Math.random() < .8 ? pick(ATL.meubles).kind : "";
  s.pos = Math.random() < .4 ? "sur" : "autour";
  s.tm = s.p && s.pos === "sur" ? pick(metalChamp ? metaux : couleurs) : pick(metalChamp ? couleurs : metaux);
  s.ta = pick(["Gueules", "Azur", "Or"].filter(t => t !== s.tm));
  s.nb = "3";
  s.ln = s.p && Math.random() < .25 ? pick(Object.keys(CONTOUR_NOM)) : "";
  s.ct = (ATL.meubles.find(x => x.kind === s.m) || {}).asym && Math.random() < .3 ? "1" : "";
  return s;
}
function random() {
  const St = fresh();
  St.A[0] = randomArms();
  if (Math.random() < .25) { St.q = "2"; St.A[1] = randomArms(); }
  if (Math.random() < .15) { St.ab = "1"; St.A[4] = randomArms(); }
  return St;
}

/* ---------- écrire un blasonnement (le lecteur est dans assets/lecture.js) ---------- */
/* le texte tapé, avec en surbrillance ce que l'Atelier n'a pas compris */
function texteMarque(texte, erreurs) {
  const zones = erreurs.map(e => [e.de, Math.max(e.a, e.de + 1)]).sort((a, b) => a[0] - b[0]);
  let out = "", i = 0;
  for (const [de, a] of zones) {
    if (de < i) continue;
    out += esc(texte.slice(i, de)) + "<mark>" + esc(texte.slice(de, Math.min(a, texte.length)) || " ") + "</mark>";
    i = Math.min(a, texte.length);
  }
  return out + esc(texte.slice(i));
}
function afficheLecture(r, texte) {
  const el = $("#lire-etat");
  el.className = "lire-etat";
  if (r.vide) { el.innerHTML = ""; return; }
  const liste = l => l.length ? `<ul>${l.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
  if (r.ok) {
    el.classList.add("ok");
    el.innerHTML = `<p><b>Compris.</b> L'écu est dessiné.</p>${r.exact ? "" : `<p class="vu">L'Atelier l'écrit : ${esc(r.reecrit)}</p>`}${liste(r.notes)}`;
  } else {
    el.classList.add("ko");
    el.innerHTML = `<p><b>Pas compris.</b> Rien n'est deviné : l'écu n'a pas bougé.</p><p class="vu">${texteMarque(texte, r.erreurs)}</p>${liste(r.erreurs.map(e => e.msg))}${liste(r.notes)}`;
  }
}
/* applique des armes lues : les ornements, la forme de l'écu et le reste de la composition ne bougent pas */
function appliqueLecture(etat) {
  S = { ...S, q: etat.q, ab: etat.ab, A: etat.A.map(a => ({ ...a })) };
  CUR = 0; KT = "1";
  render();
}
let lireT = 0;
function lireLeChamp() {
  clearTimeout(lireT);
  const texte = $("#lire").value, r = lire(texte);
  afficheLecture(r, texte);
  if (r.ok) appliqueLecture(r.etat);
}
/* une adresse « atelier.html#lire=D'azur à la croix d'or » (galeries) donne le texte à lire */
function lireDepuisAdresse() {
  const dem = new URLSearchParams(location.hash.replace(/^#/, "")).get("lire");
  if (dem === null) return false;
  $("#lire").value = dem;
  lireLeChamp();
  return true;
}

/* ---------- démarrage ---------- */
(async function init() {
  try {
    const [r1, r2] = await Promise.all([fetch("data/data.json"), fetch("data/atelier.json")]);
    if (!r1.ok || !r2.ok) throw new Error(`HTTP ${r1.ok ? r2.status : r1.status}`);
    DATA = await r1.json(); ATL = await r2.json();
  } catch (e) {
    $("#wrap").innerHTML = `<p class="err">Les données n'ont pas pu être chargées (${esc(e.message)}). Cette page doit être servie par HTTP, et non ouverte depuis le disque.</p>`;
    return;
  }
  $("#gdefs").innerHTML = globalDefs();
  fillSelects();
  $("#examples").innerHTML = EXEMPLES.map(([n], i) => `<button type="button" data-i="${i}">${esc(n)}</button>`).join("");
  $("#examples").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; S = example(EXEMPLES[+b.dataset.i][1]); CUR = 0; KT = "1"; render(); });
  S = decode(location.hash);
  const onInput = e => {
    const t = e.target;
    if (t.id === "lire") { clearTimeout(lireT); lireT = setTimeout(lireLeChamp, 450); return; }
    if (t.name === "cur") { CUR = +t.value; KT = "1"; syncForm(); render(); return; }
    if (t.id === "k-t") { KT = t.value; syncAdj(); render(); return; }
    if (/^k-(sz|dx|dy)$/.test(t.id)) { setAdj([+$("#k-sz").value, +$("#k-dx").value, -$("#k-dy").value]); render(); return; }
    readForm(); render();
  };
  F.addEventListener("input", onInput);
  F.addEventListener("change", onInput);
  $("#b-reset").addEventListener("click", () => { setAdj([100, 0, 0]); render(); });
  $("#b-link").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(location.href); toast("Lien copié"); } catch { toast("Copiez l'adresse de la page"); }
  });
  $("#b-svg").addEventListener("click", () => download(slug(S) + ".svg", new Blob([standalone(S)], { type: "image/svg+xml" })));
  $("#b-png").addEventListener("click", () => exportPng(S).catch(e => toast("Export impossible : " + e.message)));
  $("#b-rand").addEventListener("click", () => { S = random(); render(); });
  $("#b-lire").addEventListener("click", lireLeChamp);
  $("#b-recopier").addEventListener("click", () => { $("#lire").value = blazonAll(S); lireLeChamp(); $("#lire").focus(); });
  $("#lire").addEventListener("keydown", e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); lireLeChamp(); } });
  addEventListener("hashchange", () => { if (!lireDepuisAdresse()) { S = decode(location.hash); render(); } });
  if (!lireDepuisAdresse()) render();
})();
