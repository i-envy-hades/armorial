/* L'ARMORIAL — l'Atelier : l'interface. Le dessin est dans assets/dessin.js, la grammaire dans assets/blasonnement.js. */
const F = $("#panel");
let S = fresh(), KT = "1";
const cur = () => S.A[CUR];

/* ---------- interface ---------- */
function chipRow(el) {
  const name = el.dataset.name;
  el.innerHTML = DATA.tinctures.map(t => `<label class="chip" title="${esc(t.nom)} (${esc(t.type.toLowerCase())})"><input type="radio" name="${name}" value="${esc(t.nom)}"><span>${shieldSwatch(t.nom, "couleur", 26)}${esc(t.nom)}</span></label>`).join("");
}
function fillSelects() {
  F.part.innerHTML = DATA.partitions.map(p => `<option value="${esc(p.kind)}">${esc(p.nom)}</option>`).join("");
  F.p.innerHTML = `<option value="">Aucune</option>` + [...DATA.pieces, ...(ATL.pieces || [])].filter(p => PIECES[p.kind]).map(p => `<option value="${esc(p.kind)}">${esc(p.nom)}</option>`).join("");
  F.cn.innerHTML = F.cn2.innerHTML = `<option value="">Aucune</option>` + DATA.tinctures.filter(t => t.type !== "Fourrure").map(t => `<option value="${esc(t.nom)}">Couronné ${de(t.nom)}</option>`).join("");
  F.pf.innerHTML = `<option value="">Aucun</option>` + DATA.tinctures.filter(t => t.type !== "Fourrure").map(t => `<option value="${esc(t.nom)}">Bordée ${de(t.nom)}</option>`).join("");
  const cats = [...new Set(ATL.meubles.map(m => m.cat))];
  F.m.innerHTML = `<option value="">Aucun</option>` + cats.map(c => `<optgroup label="${esc(c)}">${ATL.meubles.filter(m => m.cat === c).map(m => `<option value="${esc(m.kind)}">${esc(m.nom)}</option>`).join("")}</optgroup>`).join("");
  F.m2.innerHTML = F.m.innerHTML;
  F.ci.innerHTML = F.m.innerHTML.replace("Aucun", "Aucun");                                        // le cimier se prend dans les mêmes meubles
  F.br.innerHTML = `<option value="">Aucune</option><optgroup label="Pièces de brisure">${Object.entries(BRIS_PIECES).map(([k, v]) => `<option value="${k}">${esc(v.nom)}</option>`).join("")}</optgroup>`
    + `<optgroup label="Figures de brisure">${BRIS_FIGS.map(k => `<option value="${k}">${esc(meuble(k).nom)}</option>`).join("")}</optgroup>`;
  F.lpc.innerHTML = `<option value="">Rien</option>` + LAMBEL_FIGS.map(k => `<option value="${k}">${cap(meuble(k).plur)}</option>`).join("");
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
  const curs = [...(S.q ? cellNames(S) : S.ab ? [[0, "Écu"]] : []), ...(S.ab ? [[4, "Écusson"]] : [])];
  $("#r-halves").hidden = S.q !== "p";
  $("#cur-seg").innerHTML = curs.map(([i, l]) => `<label><input type="radio" name="cur" value="${i}"${i === CUR ? " checked" : ""}><span>${l}</span></label>`).join("");
  $("#r-cur").hidden = $("#q-note").hidden = !curs.length;
  const cs = m ? countsFor(a) : [];
  F.nb.innerHTML = cs.map(n => `<option value="${n}">${n === "seme" ? "semé" : n}</option>`).join("");
  const ds = dispos(a);
  F.d.innerHTML = ds.map(d => `<option value="${d.id}">${esc(d.lab)}</option>`).join("");
  F.nb2.innerHTML = Object.keys(PLEIN).map(n => `<option value="${n}">${n}</option>`).join("");
  F.d2.innerHTML = PLEIN[a.nb2].map(d => `<option value="${d.id}">${esc(d.lab)}</option>`).join("");
  /* le nombre de pièces dépend du champ rayé : six, huit… ou des pièces rebattues pour un nombre impair ; des tires pour l'échiqueté ; rien pour le fuselé */
  const lab = n => a.ray === "chequy" ? `${NB[n]} tires` : +n % 2 ? `${NB[(n - 1) / 2]} ${RAY_PIECE[a.ray]}s (pièces rebattues)` : `${NB[n]} pièces`;
  F.n.innerHTML = rayNs(a.ray).map(n => `<option value="${n}">${esc(lab(+n))}</option>`).join("");
  F.n.hidden = a.ray.startsWith("lozengy");
  F.hp.innerHTML = ATL.ornements.heaumes.filter(h => h.type === S.ht).map(h => `<option value="${h.pos}">${esc(ATL.ornements.heaumePos[h.pos])}</option>`).join("");
  const bp = brisPiece(a), bf = BRIS_FIGS.includes(a.br);
  F.lbr.innerHTML = `<option value="">Droit</option>` + Object.entries(CONTOUR_NOM).filter(([k]) => k !== "alesee").map(([k, v]) => `<option value="${k}">${cap(v)}</option>`).join("");
  F.brd.innerHTML = bf ? dispos(brisArms(a)).map(d => `<option value="${d.id}">${esc(d.lab)}</option>`).join("") : "";
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
  $("#r-pf").hidden = !a.p || a.p === "bordure" || a.p === "orle";
  /* le bord : droit, décoré, ou alésé (seulement pour les pièces qui s'alèsent) */
  F.ln.innerHTML = `<option value="">Droit</option>` + Object.entries(CONTOUR_NOM).filter(([k]) => k !== "alesee" || ALESEE_OK.has(a.p)).map(([k, v]) => `<option value="${k}">${cap(v)}</option>`).join("");
  setField("ln", a.ln);
  $("#r-ct").hidden = !(m && m.asym);
  $("#r-ct2").hidden = !(m2 && m2.asym);
  $("#r-nb").hidden = !m || cs.length < 2;
  $("#r-d").hidden = !m || m.seul || ds.length < 2;
  $("#r-tm").hidden = !m;
  const canSur = a.p && LAYOUT["sur-" + a.p], canAut = a.p && LAYOUT[a.p], canSous = a.p && BRO_OK.has(a.p) && a.nb !== "seme";
  $("#r-pos").hidden = !m || !a.p || [canSur, canAut, canSous].filter(Boolean).length < 2;
  [...F.elements.pos].forEach(r => { r.closest("label").hidden = !{ sur: canSur, autour: canAut, sous: canSous }[r.value]; });
  $("#r-ta").hidden = !m || !m.accent;
  $("#r-cn").hidden = !m || !m.couronne;
  $("#r-iss").hidden = !m || m.seul || a.nb !== "1" || !!a.p;                                   // « issant » : un seul meuble, sans pièce
  [...F.elements.iss].forEach(r => { if (r.value === "t") r.closest("label").hidden = !(S.q === "p" && CUR < 2); });          // le demi-meuble : seulement dans une moitié du parti
  if (m?.accentMot) $("#l-ta").textContent = m.accentLabel || cap(m.accentMot.split(/[ ,]/)[0]);
  const note = $("#m-note");
  note.hidden = !m?.file;
  if (m?.file) note.textContent = `Figure empruntée à Wikimedia Commons, recolorée ici : ${m.file.auteur}, ${m.file.lic}.`;
  $("#r-m2").hidden = !m;
  $("#r-nb2").hidden = $("#r-d2").hidden = $("#r-tm2").hidden = !m2;
  $("#r-ta2").hidden = !m2 || !m2.accent;
  $("#r-cn2").hidden = !m2 || !m2.couronne;
  if (m2?.accentMot) $("#l-ta2").textContent = m2.accentLabel || cap(m2.accentMot.split(/[ ,]/)[0]);
  $("#r-tl1").hidden = $("#r-tl2").hidden = S.hm !== "hl";
  const mci = S.hm && S.ci && meuble(S.ci);
  $("#r-ci").hidden = !S.hm;
  $("#r-cim").hidden = $("#r-cit").hidden = !mci;
  $("#r-cia").hidden = !mci || !mci.accent;
  if (mci?.accentMot) $("#l-cia").textContent = mci.accentLabel || cap(mci.accentMot.split(/[ ,]/)[0]);
  $("#r-pa").hidden = !S.hm || !!S.ci;                                                            // le cimier prend la place du panache
  $("#r-pa1").hidden = $("#r-pa2").hidden = !S.hm || !S.pa || !!S.ci;
  $("#r-ts").hidden = !S.su;
  $("#r-mc").hidden = $("#r-ml").hidden = !S.mt;
  $("#r-dt").hidden = !S.dv.trim();
  $("#r-hp").hidden = !S.hm;
  $("#r-hs").hidden = S.hp === "face";
  $("#hm-note").textContent = "";
  $("#r-tbr").hidden = !a.br;
  $("#r-sbr").hidden = !(bp && bp.sens);
  $("#r-lbr").hidden = !(bp && bp.bord);
  $("#r-brn").hidden = $("#r-brd").hidden = !bf;
  const lam = a.br === "lambel";
  $("#r-brj").hidden = !(bf || lam);
  $("#r-lpn").hidden = $("#r-lpc").hidden = !lam;
  $("#r-lpt").hidden = $("#r-lpk").hidden = !(lam && a.lpc);
  $("#r-lpw").hidden = !(lam && a.lpc && +a.lpn % 2);
  if (bf || lam) {
    $("#k-brsz").value = a.brsz; $("#k-brdx").value = a.brdx; $("#k-brdy").value = -a.brdy;
    $("#o-brsz").textContent = a.brsz + " %";
    $("#o-brdx").textContent = +a.brdx ? (a.brdx > 0 ? "→ " : "← ") + Math.abs(a.brdx) : "0";
    $("#o-brdy").textContent = +a.brdy ? (a.brdy < 0 ? "↑ " : "↓ ") + Math.abs(a.brdy) : "0";
  }
  $("#r-pj").hidden = !a.p;
  if (a.p) {
    $("#k-pdx").value = a.pdx; $("#k-pdy").value = -a.pdy;
    $("#o-pdx").textContent = +a.pdx ? (a.pdx > 0 ? "→ " : "← ") + Math.abs(a.pdx) : "0";
    $("#o-pdy").textContent = +a.pdy ? (a.pdy < 0 ? "↑ " : "↓ ") + Math.abs(a.pdy) : "0";
  }
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

/* cercle d'or autour du meuble que visent les curseurs (aperçu seulement, pas dans les exports) */
function marker() {
  if (!/^[12]\.\d$/.test(KT)) return "";
  const a = cur(), [g, i] = KT.split(".").map(Number), m = meuble(g === 1 ? a.m : a.m2);
  HSIDE = S.q === "p" && CUR < 2 ? CUR : 0;
  const p = (g === 1 ? ptsFor(a, m) : pts2(a))[i];
  HSIDE = 0;
  if (!p) return "";
  if (S.q === "p" && CUR !== 4) return partiCells(S).filter(c => c.arm === CUR).map(c => { const m = partiMap(c); return `<circle cx="${m.cx + (p[0] - 100) * m.vpx + m.shx}" cy="${m.cy + (p[1] - 126) * m.vpy + m.shy}" r="${Math.max(6, 82 * p[2] * m.pk)}" fill="none" stroke="#c9a227" stroke-width="2.2" stroke-dasharray="6 4" pointer-events="none"/>`; }).join("");
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
  $("#credits").innerHTML = creditsHtml(cr);
  afficheOrigine();
  const h = [encode(S), ORIGINE ? `de=${ORIGINE.gal}:${ORIGINE.slug}` : ""].filter(Boolean).join("&");
  history.replaceState(null, "", h ? "#" + h : location.pathname);
}

/* ---------- exports ---------- */
function standalone(St, scale = 3) {
  const defs = (globalDefs().match(/<defs>([\s\S]*)<\/defs>/) || ["", ""])[1];
  const b = blazonAll(St), o = ornText(St), c = compose(St, "x"), d = origineTxt(St);
  const credit = creditsOf(St).map(creditTxt).join(" ; ");
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${c.vb.join(" ")}" width="${Math.round(c.vb[2] * scale)}" height="${Math.round(c.vb[3] * scale)}">
  <title>${esc(b)}</title>
  <desc>${esc("Composé dans l'Atelier de L'Armorial (CC BY-SA 4.0)." + (d ? " " + d + "." : "") + (o ? " " + o + "." : "") + (credit ? " Figures : " + credit + "." : ""))}</desc>
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
  const oLines = [origineTxt(s), ornText(s)].filter(Boolean).flatMap(t => wrapText(ctx, t, W - 120));
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
  ["Trois pals", { A0: { f: "ray", ray: "paly", n: "7", t1: "Or", t2: "Gueules", m: "" } }],
  ["Bordure engrêlée", { A0: { t1: "Or", m: "lion", nb: "1", tm: "Sable", ta: "Gueules", p: "bordure", tp: "Gueules", ln: "engrele" } }],
  ["Franc-quartier", { A0: { t1: "Or", m: "epee", nb: "1", tm: "Argent", p: "franc-quartier", tp: "Azur", pos: "sur" } }],
  ["Angleterre", { A0: { t1: "Gueules", m: "leopard", nb: "3", d: "pal", tm: "Or", ta: "Azur", sz: "190" } }],
  ["Aigle bicéphale", { A0: { t1: "Or", m: "aigle-bicephale", nb: "1", tm: "Sable", ta: "Gueules" } }],
  ["Échiqueté", { A0: { f: "ray", ray: "chequy", n: "6", t1: "Argent", t2: "Gueules", m: "" } }],
  ["Fuselé en bande", { A0: { f: "ray", ray: "lozengybend", n: "6", t1: "Azur", t2: "Argent", m: "" } }],
  ["Chevronné", { A0: { f: "ray", ray: "chevronny", n: "6", t1: "Or", t2: "Sable", m: "" } }],
  ["Burelé", { A0: { f: "ray", ray: "barry", n: "10", t1: "Argent", t2: "Gueules", m: "" } }],
  ["Fasce alésée", { A0: { t1: "Argent", m: "", p: "fasce", tp: "Gueules", ln: "alesee" } }],
  ["Croix bordée", { A0: { t1: "Azur", m: "", p: "croix", tp: "Gueules", pf: "Argent" } }],
  ["Bande brochante", { A0: { t1: "Or", m: "lion", nb: "1", tm: "Gueules", ta: "Gueules", p: "bande", tp: "Azur", pos: "sous" } }],
  ["Neuf étoiles", { A0: { t1: "Azur", m: "etoile6", nb: "9", tm: "Or" } }],
  ["Sur le tout", { q: "2", ab: "1", A0: { t1: "Gueules", m: "lion", nb: "1", tm: "Or", ta: "Azur" }, A1: { t1: "Azur", m: "fleurdelis", nb: "3", tm: "Or", p: "" }, A4: { t1: "Argent", m: "", p: "croix", tp: "Gueules" } }],
  ["Brisé d'un croissant", { A0: { t1: "Azur", m: "fleurdelis", nb: "3", tm: "Or", br: "croissant", tbr: "Argent" } }],
  ["Brisé d'une bordure", { A0: { t1: "Azur", m: "fleurdelis", nb: "3", tm: "Or", br: "bordure", tbr: "Gueules" } }],
  ["Brisé d'un bâton", { A0: { t1: "Azur", m: "fleurdelis", nb: "3", tm: "Or", br: "baton", tbr: "Gueules", sbr: "barre" } }],
  ["Lambel", { A0: { t1: "Azur", m: "fleurdelis", nb: "3", tm: "Or", br: "lambel", tbr: "Argent" } }],
  ["Lambel chargé", { A0: { t1: "Azur", m: "fleurdelis", nb: "3", tm: "Or", br: "lambel", tbr: "Gueules", lpn: "5", lpc: "roundel", lpt: "Or", lpk: "2" } }],
  ["Parti", { q: "p", A0: { t1: "Azur", m: "fleurdelis", nb: "3", tm: "Or", p: "" }, A1: { t1: "Gueules", m: "leopard", nb: "3", tm: "Or", ta: "Azur", d: "pal", p: "" } }],
  ["Demi-aigle au parti", { q: "p", A0: { t1: "Or", m: "aigle", nb: "1", tm: "Sable", ta: "Gueules", iss: "t", p: "" }, A1: { t1: "Gueules", m: "clef", nb: "1", tm: "Or", p: "" } }],
  ["Parti écartelé", { q: "p", h1: "2", A0: { t1: "Azur", m: "fleurdelis", nb: "3", tm: "Or", p: "" }, A2: { t1: "Gueules", m: "leopard", nb: "3", tm: "Or", ta: "Azur", d: "pal", p: "" }, A1: { t1: "Or", m: "lion", nb: "1", tm: "Gueules", ta: "Azur", p: "" } }],
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
  if (s.f === "plein" && Math.random() < .12) { s.f = "ray"; s.ray = pick(RAYS); s.n = pick(rayNs(s.ray)); }                  // de temps en temps, un champ rayé ou un pavage
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
  S = { ...S, q: etat.q, ab: etat.ab, h1: etat.h1, h2: etat.h2, A: etat.A.map(a => ({ ...a })) };
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
  const r = lire(dem);
  afficheLecture(r, dem);
  if (r.ok) appliqueLecture(r.etat); else render();          // non compris : l'écu ne bouge pas, mais il est dessiné, et l'adresse redevient un lien de partage
  return true;
}

/* ---------- partir d'un blason réel : les cartes des galeries ---------- */
const GALERIES = { blasons: { fichier: "data/blasons.json", titre: "Blasons réels", page: "blasons.html" }, personnages: { fichier: "data/personnages.json", titre: "Personnages", page: "personnages.html" } };
const COMMONS_W = "https://commons.wikimedia.org/wiki/";
let CARTES = null;                 // [{ gal, slug, a, r }] : toutes les cartes des galeries, et ce que le lecteur fait de leur blasonnement
let ORIGINE = null;                // { gal, slug, c } : la carte d'où l'on part (« de=blasons:… » dans l'adresse) ; c : la carte, quand les galeries sont là
/* « de=blasons:royaume-de-france-moderne » → { gal, slug } ; rien d'autre n'est accepté */
function origineDemandee(h) {
  const m = /^(blasons|personnages):([a-z0-9-]+)$/.exec(new URLSearchParams(h.replace(/^#/, "")).get("de") || "");
  return m ? { gal: m[1], slug: m[2], c: null } : null;
}
async function chargeCartes() {
  const listes = await Promise.all(Object.entries(GALERIES).map(async ([gal, G]) => {
    const r = await fetch(G.fichier);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()).map(a => ({ gal, slug: slugCarte(a.nom), a, r: a.blason ? lire(a.blason) : null }));
  }));
  CARTES = listes.flat();
}
/* le sélecteur : les cartes que le lecteur relit en entier, par galerie et par rubrique. Rien n'y est écrit en dur : quand le lecteur
   apprend un mot, les armes qu'il relit de plus y entrent d'elles-mêmes */
function remplitReels() {
  const ok = CARTES.filter(c => c.r && c.r.ok), groupes = new Map();
  for (const c of ok) { const g = GALERIES[c.gal].titre + (c.a.cat ? " · " + c.a.cat : ""); groupes.set(g, [...(groupes.get(g) || []), c]); }
  $("#reel").innerHTML = `<option value="">Choisir des armes réelles (${ok.length})…</option>` + [...groupes].map(([g, cs]) =>
    `<optgroup label="${esc(g)}">${cs.map(c => `<option value="${CARTES.indexOf(c)}">${esc(c.a.nom)}</option>`).join("")}</optgroup>`).join("");
  $("#reel-note").innerHTML = `${ok.length} des ${CARTES.filter(c => c.r).length} blasonnements des galeries : l'Atelier ne dessine que ce qu'il relit en entier, et la liste s'allonge à mesure qu'il apprend des mots. Un clic sur l'écu d'une carte de <a href="blasons.html">Blasons réels</a> ou de <a href="personnages.html">Personnages</a> mène ici aussi.`;
}
/* la carte demandée par l'adresse, une fois les galeries chargées ; inconnue, on l'oublie. Si le lecteur ne la relit pas,
   son texte va dans la zone de saisie, surligné là où il bute (c'est ce que l'on vient voir) */
function resoudOrigine() {
  if (!ORIGINE || !CARTES) return;
  ORIGINE.c = CARTES.find(c => c.gal === ORIGINE.gal && c.slug === ORIGINE.slug && c.r) || null;          // une carte sans blasonnement n'a rien à ouvrir
  if (!ORIGINE.c) { ORIGINE = null; return; }
  const { a, r } = ORIGINE.c;
  if (r && !r.ok && !$("#lire").value.trim()) { $("#lire").value = a.blason; afficheLecture(r, a.blason); }
}
/* en arrivant d'une carte (ou d'un autre lien « #lire=… »), on va droit à l'écu : le bandeau est passé, l'en-tête fixe ne le cache pas */
function allerALEcu() {
  const m = $(".mast");
  scrollTo(0, $("#wrap").getBoundingClientRect().top + scrollY - (m ? m.offsetHeight : 0) - 10);
}
function partirDe(c) {
  ORIGINE = { gal: c.gal, slug: c.slug, c };
  $("#lire").value = c.a.blason;
  lireLeChamp();
  if (matchMedia("(max-width: 860px)").matches) allerALEcu();                     // sur téléphone, l'écu est au-dessus du formulaire
}
/* l'empreinte des armes (sans les ornements ni les réglages graphiques) : sont-ce encore celles de la carte ? */
const empreinte = St => JSON.stringify(canonAll(St));
function empreinteCarte(c) {
  if (!c.emp) { const e = c.r.etat; c.emp = empreinte({ q: e.q, ab: e.ab, h1: e.h1, h2: e.h2, A: e.A.map(a => normalize({ ...a })) }); }
  return c.emp;
}
const armesDeLaCarte = (St, c) => !!(c && c.r && c.r.ok) && empreinte(St) === empreinteCarte(c);
/* pour les exports : « Armes de … » ou « D'après les armes de … » */
function origineTxt(St) {
  const c = ORIGINE && ORIGINE.c;
  if (!c) return "";
  return `${armesDeLaCarte(St, c) ? "Armes de" : "D'après les armes de"} « ${c.a.nom} » (L'Armorial, ${GALERIES[c.gal].titre})`;
}
/* sous l'écu : la carte d'où l'on part, son image (de Wikimedia Commons, créditée) à comparer au dessin, et si l'on s'en est écarté */
function afficheOrigine() {
  const el = $("#origine"), c = ORIGINE && ORIGINE.c;
  if (CARTES) $("#reel").value = c && c.r && c.r.ok ? String(CARTES.indexOf(c)) : "";
  el.hidden = !c;
  if (!c) { el.innerHTML = afficheOrigine.h = ""; return; }
  const a = c.a, G = GALERIES[c.gal], fichier = encodeURIComponent(a.file);
  const etat = !c.r || !c.r.ok
    ? `<p class="or-etat ko">L'Atelier ne relit pas encore ce blasonnement : l'écu dessiné ici n'est pas celui de la carte.</p>`
    : armesDeLaCarte(S, c)
      ? `<p class="or-etat ok">Ce sont les armes de la carte, telles qu'elle les blasonne.${ornText(S) || S.sh ? " La forme de l'écu et les ornements sont de votre main : le blasonnement ne les dit pas." : ""}</p>`
      : `<p class="or-etat mod">Vous les avez modifiées : ce ne sont plus les armes de la carte. <button type="button" class="lnk" id="b-origine">Revenir aux armes de la carte</button></p>`;
  const lic = a.lic ? (a.licurl ? `<a href="${esc(a.licurl)}" target="_blank" rel="noopener">${esc(a.lic)}</a>` : esc(a.lic)) : "licence libre";
  const h = `<img class="or-img" src="${COMMONS_W}Special:FilePath/${fichier}?width=200" alt="Armoiries — ${esc(a.nom)} : l'image de la carte" loading="lazy">
    <div class="or-txt">
      <p class="or-k">Parti d'un blason réel · ${G.titre}</p>
      <p class="or-nom"><a href="${G.page}#${c.slug}">${esc(a.nom)}</a></p>
      ${etat}
      <p class="or-cr">À gauche, l'image de la carte : <a href="${COMMONS_W}File:${fichier}" target="_blank" rel="noopener">« ${esc(a.file)} »</a>${a.auteur ? ` — ${esc(a.auteur)}` : ""}, ${lic}, via Wikimedia Commons.</p>
    </div>`;
  if (h !== afficheOrigine.h) el.innerHTML = afficheOrigine.h = h;          // render() passe ici à chaque curseur : l'image n'est refaite que si la carte ou l'état changent
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
  $("#examples").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; S = example(EXEMPLES[+b.dataset.i][1]); ORIGINE = null; CUR = 0; KT = "1"; render(); });
  ORIGINE = origineDemandee(location.hash);
  const arrivee = /(^|[#&])(lire|de)=/.test(location.hash);
  S = decode(location.hash);
  const onInput = e => {
    const t = e.target;
    if (t.id === "lire") { clearTimeout(lireT); lireT = setTimeout(lireLeChamp, 450); return; }
    if (t.id === "reel") { if (e.type === "change" && t.value && CARTES && CARTES[+t.value]) partirDe(CARTES[+t.value]); return; }
    if (t.name === "cur") { CUR = +t.value; KT = "1"; syncForm(); render(); return; }
    if (t.name === "q" || t.name === "h1" || t.name === "h2") { readForm(); S = normalizeAll(S); syncForm(); render(); return; }      // des armes peuvent disparaître : le formulaire montre alors celles qui restent avant que l'événement « change » ne le relise
    if (t.id === "k-t") { KT = t.value; syncAdj(); render(); return; }
    if (/^k-(sz|dx|dy)$/.test(t.id)) { setAdj([+$("#k-sz").value, +$("#k-dx").value, -$("#k-dy").value]); render(); return; }
    if (/^k-p(dx|dy)$/.test(t.id)) { const a = cur(); a.pdx = $("#k-pdx").value; a.pdy = String(-$("#k-pdy").value); render(); return; }
    if (/^k-br(sz|dx|dy)$/.test(t.id)) { const a = cur(); a.brsz = $("#k-brsz").value; a.brdx = $("#k-brdx").value; a.brdy = String(-$("#k-brdy").value); render(); return; }
    readForm(); render();
  };
  F.addEventListener("input", onInput);
  F.addEventListener("change", onInput);
  $("#b-reset").addEventListener("click", () => { setAdj([100, 0, 0]); render(); });
  $("#b-preset").addEventListener("click", () => { Object.assign(cur(), { pdx: "0", pdy: "0" }); render(); });
  $("#b-brreset").addEventListener("click", () => { Object.assign(cur(), { brsz: "100", brdx: "0", brdy: "0" }); render(); });
  $("#b-link").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(location.href); toast("Lien copié"); } catch { toast("Copiez l'adresse de la page"); }
  });
  $("#b-svg").addEventListener("click", () => download(slug(S) + ".svg", new Blob([standalone(S)], { type: "image/svg+xml" })));
  $("#b-png").addEventListener("click", () => exportPng(S).catch(e => toast("Export impossible : " + e.message)));
  $("#b-rand").addEventListener("click", () => { S = random(); ORIGINE = null; render(); });
  $("#b-lire").addEventListener("click", lireLeChamp);
  $("#b-recopier").addEventListener("click", () => { $("#lire").value = blazonAll(S); lireLeChamp(); $("#lire").focus(); });
  $("#lire").addEventListener("keydown", e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); lireLeChamp(); } });
  $("#origine").addEventListener("click", e => {
    if (!e.target.closest("#b-origine") || !ORIGINE || !ORIGINE.c) return;
    $("#lire").value = ORIGINE.c.a.blason; lireLeChamp();
  });
  addEventListener("hashchange", () => {
    ORIGINE = origineDemandee(location.hash); resoudOrigine();
    if (!lireDepuisAdresse()) { S = decode(location.hash); render(); }
  });
  if (!lireDepuisAdresse()) render();
  if (arrivee) allerALEcu();
  /* les galeries arrivent ensuite : le sélecteur « Partir d'un blason réel » et la carte d'où l'on part */
  try { await chargeCartes(); }
  catch (e) { $("#reel").innerHTML = `<option value="">Galeries indisponibles (${esc(e.message)})</option>`; $("#reel").disabled = true; ORIGINE = null; render(); return; }
  remplitReels(); resoudOrigine(); render();
})();
