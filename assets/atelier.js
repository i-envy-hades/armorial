/* L'ARMORIAL — l'Atelier : l'interface. Le dessin est dans assets/dessin.js, la grammaire dans assets/blasonnement.js. */
const F = $("#panel");
let S = fresh(), KT = "1";
const cur = () => S.A[CUR];

/* ---------- interface ---------- */
function chipRow(el) {
  const name = el.dataset.name;
  el.innerHTML = DATA.tinctures.map(t => `<label class="chip" title="${esc(emailLu(t.nom))} (${esc(Tr(t.type.toLowerCase(), { Métal: "metal", Couleur: "colour", Fourrure: "fur" }[t.type]))})"><input type="radio" name="${name}" value="${esc(t.nom)}"><span>${shieldSwatch(t.nom, "couleur", 26)}${esc(emailLu(t.nom))}</span></label>`).join("");
}
const AUCUN = Tr("Aucun", "None"), AUCUNE = Tr("Aucune", "None");
const nomOuEn = p => Tr(p.nom, p.en ? cap(p.en) : libelle(p.nom));      // partitions et pièces : data.json donne le nom anglais
const email1 = t => emailLu(t).toLowerCase();
/* le déroulant à catégories : un long <select> se présente comme un bouton qui ouvre ses rubriques, par ordre alphabétique, chacune fermée
   jusqu'à ce qu'on la déroule. Le <select> reste en place, invisible : c'est lui qui tient la valeur, le formulaire ne change pas.
   vignette(valeur) : une petite image devant chaque choix (facultatif). */
const DEROULANTS = [];
const parNom = (a, b, cle) => cle(a).localeCompare(cle(b), LANGUE);
function deroulant(sel, vignette) {
  const dr = document.createElement("div");
  dr.className = "dr";
  dr.innerHTML = `<button type="button" class="dr-bouton" aria-expanded="false"><span></span></button><div class="dr-panneau" hidden></div>`;
  sel.classList.add("dr-natif"); sel.tabIndex = -1; sel.setAttribute("aria-hidden", "true");
  sel.after(dr);
  const [bouton, panneau] = dr.children;
  const maj = () => { const o = sel.selectedOptions[0]; bouton.firstChild.textContent = o ? o.textContent : ""; };
  const ferme = () => { panneau.hidden = true; panneau.innerHTML = ""; bouton.setAttribute("aria-expanded", "false"); };
  const ligne = o => `<button type="button" class="dr-choix${o.selected ? " on" : ""}" data-v="${esc(o.value)}">${vignette && o.value ? vignette(o.value) : ""}<span>${esc(o.textContent)}</span></button>`;
  const ouvre = () => {
    const seules = [...sel.children].filter(x => x.tagName === "OPTION"), groupes = [...sel.querySelectorAll("optgroup")].sort((a, b) => parNom(a, b, g => g.label));
    panneau.innerHTML = seules.map(ligne).join("") + groupes.map(g => {
      const os = [...g.children].sort((a, b) => parNom(a, b, o => o.textContent));
      return `<details${os.some(o => o.selected) ? " open" : ""}><summary>${esc(g.label)} <small>${os.length}</small></summary><div class="dr-liste">${os.map(ligne).join("")}</div></details>`;
    }).join("");
    panneau.hidden = false; bouton.setAttribute("aria-expanded", "true");
  };
  bouton.addEventListener("click", () => { if (panneau.hidden) { DEROULANTS.forEach(d => d.ferme()); ouvre(); } else ferme(); });
  panneau.addEventListener("click", e => {
    const b = e.target.closest(".dr-choix");
    if (!b) return;
    sel.value = b.dataset.v; ferme(); maj();
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  });
  document.addEventListener("click", e => { if (!panneau.hidden && !dr.contains(e.target)) ferme(); });
  dr.addEventListener("keydown", e => { if (e.key === "Escape" && !panneau.hidden) { ferme(); bouton.focus(); } });
  DEROULANTS.push({ maj, ferme });
  maj();
}
/* la petite image d'une figure, telle qu'elle est dessinée par défaut : le fichier de Commons, ou le dessin de l'Atelier */
function vignetteMeuble(kind) {
  const m = meuble(kind);
  if (!m) return "";
  if (m.file) return `<img class="dr-vi" src="${esc(m.file.path)}" alt="" loading="lazy">`;
  try { const dessin = m.draw === "lis" ? fleurDeLisPaths() : chargeInner(m.draw || kind, "#c9a227", "#1a1712", "#fff"); return dessin ? `<svg class="dr-vi" viewBox="0 0 200 200" fill="#c9a227" stroke="#1a1712" aria-hidden="true">${dessin}</svg>` : ""; } catch { return ""; }
}
function fillSelects() {
  F.part.innerHTML = DATA.partitions.map(p => `<option value="${esc(p.kind)}">${esc(nomOuEn(p))}</option>`).join("");
  F.p.innerHTML = `<option value="">${AUCUNE}</option>` + [...DATA.pieces, ...(ATL.pieces || [])].filter(p => PIECES[p.kind]).map(p => `<option value="${esc(p.kind)}">${esc(nomOuEn(p))}</option>`).join("");
  F.cn.innerHTML = F.cn2.innerHTML = `<option value="">${AUCUNE}</option>` + DATA.tinctures.filter(t => t.type !== "Fourrure").map(t => `<option value="${esc(t.nom)}">${Tr(`Couronné ${de(t.nom)}`, `Crowned ${email1(t.nom)}`)}</option>`).join("");
  F.pf.innerHTML = `<option value="">${AUCUN}</option>` + DATA.tinctures.filter(t => t.type !== "Fourrure").map(t => `<option value="${esc(t.nom)}">${Tr(`Bordée ${de(t.nom)}`, `Fimbriated ${email1(t.nom)}`)}</option>`).join("");
  const rubrique = m => m.rub || m.cat;                                                            // « cat » reste la famille d'une figure (exercices) ; « rub » est son rayon dans le menu
  const cats = [...new Set(ATL.meubles.map(rubrique))];
  F.m.innerHTML = `<option value="">${AUCUN}</option>` + cats.map(c => `<optgroup label="${esc(libelle(c))}">${ATL.meubles.filter(m => rubrique(m) === c).sort((a, b) => nomMeubleLu(a).localeCompare(nomMeubleLu(b), LANGUE)).map(m => `<option value="${esc(m.kind)}">${esc(nomMeubleLu(m))}</option>`).join("")}</optgroup>`).join("");
  F.m2.innerHTML = F.m.innerHTML;
  F.ci.innerHTML = F.m.innerHTML.replace("Aucun", "Aucun");                                        // le cimier se prend dans les mêmes meubles
  F.br.innerHTML = `<option value="">${AUCUNE}</option><optgroup label="${Tr("Pièces de brisure", "Ordinaries of difference")}">${Object.entries(BRIS_PIECES).map(([k, v]) => `<option value="${k}">${esc(libelle(v.nom))}</option>`).join("")}</optgroup>`
    + `<optgroup label="${Tr("Figures de brisure", "Figures of difference")}">${BRIS_FIGS.map(k => `<option value="${k}">${esc(nomMeubleLu(meuble(k)))}</option>`).join("")}</optgroup>`;
  F.lpc.innerHTML = `<option value="">${Tr("Rien", "Nothing")}</option>` + LAMBEL_FIGS.map(k => `<option value="${k}">${cap(plurLu(meuble(k)))}</option>`).join("");
  const O = ATL.ornements;
  F.cr.innerHTML = `<option value="">${AUCUNE}</option>` + O.couronnes.map(c => `<option value="${esc(c.kind)}">${esc(libelle(c.nom))}</option>`).join("");
  F.su.innerHTML = `<option value="">${AUCUN}</option>` + O.supports.map(x => `<option value="${esc(x.kind)}">${Tr("Deux", "Two")} ${esc(plurLu(meuble(x.kind)))}</option>`).join("");
  F.co.innerHTML = `<option value="">${AUCUN}</option>` + O.colliers.map(c => `<option value="${esc(c.kind)}">${esc(libelle(c.nom))}</option>`).join("");
  F.dt.innerHTML = Object.entries(DEVISES).map(([k, v]) => `<option value="${k}">${esc(libelle(v.nom))}</option>`).join("");
  F.sh.innerHTML = Object.entries(SHAPES).map(([k, v]) => `<option value="${k}">${esc(libelle(v.nom))}</option>`).join("");
  F.ht.innerHTML = Object.entries(O.heaumeTypes).map(([k, v]) => `<option value="${esc(k)}">${esc(libelle(v))}</option>`).join("");
  document.querySelectorAll(".chips").forEach(chipRow);
}
function setField(k, v) {
  const el = F.elements[k];
  if (!el) return;
  if (el instanceof RadioNodeList || el.length && el[0]?.type === "radio") [...el].forEach(r => r.checked = r.value === v);
  else if (el.value !== v) el.value = v;
}
let H1_PARTI = "";
/* le mot qui nomme l'attribut d'un meuble (« Armé », « Becqué »…) */
const libAccent = m => (enAnglais() ? (m.accentLabel ? libelle(m.accentLabel) : cap((ACCENT_EN[m.accentMot] || (m.accentMot === "et" ? "and" : m.accentMot)).split(/[ ,]/)[0])) : m.accentLabel || cap(m.accentMot.split(/[ ,]/)[0]));
const celluleLue = n => (enAnglais() ? nomCelluleEn(n) : n);
function syncForm() {
  const a = cur(), m = a.m && meuble(a.m), m2 = count2(a) && meuble(a.m2);
  /* quelles armes se modifient : les quartiers (ou l'écu seul), et l'écusson en abîme s'il y en a un */
  const curs = [...(S.q ? cellNames(S) : S.ab ? [[0, Tr("Écu", "Shield")]] : []), ...(S.ab ? [[4, Tr("Écusson", "Escutcheon")]] : [])];
  $("#r-halves").hidden = S.q !== "p" && S.q !== "c";
  $("#r-x").hidden = S.q !== "2" && S.q !== "4";
  /* un parti a deux moitiés qui s'écartèlent ; un coupé, un chef qui se partit */
  F.h2.hidden = S.q === "c";
  const modeH1 = S.q === "c" ? "c" : "p";
  if (F.h1.dataset.mode !== modeH1) {
    H1_PARTI = H1_PARTI || F.h1.innerHTML;
    F.h1.innerHTML = modeH1 === "c" ? Tr(`<option value="">Chef : simple</option><option value="p">Chef : parti</option><option value="ch">Chef : étroit</option><option value="pa">Champagne</option>`, `<option value="">Chief: plain</option><option value="ch">Chief: narrow</option><option value="p">Chief: per pale</option><option value="pa">Base</option>`) : H1_PARTI;
    F.h1.dataset.mode = modeH1;
    F.h1.setAttribute("aria-label", modeH1 === "c" ? Tr("Chef du coupé", "Chief of the per fess division") : Tr("Moitié dextre du parti", "Dexter half of the per pale division"));
  }
  F.h1.value = S.h1;
  $("#cur-seg").innerHTML = curs.map(([i, l]) => `<label><input type="radio" name="cur" value="${i}"${i === CUR ? " checked" : ""}><span>${celluleLue(l)}</span></label>`).join("");
  $("#r-cur").hidden = $("#q-note").hidden = !curs.length;
  const cs = m ? countsFor(a) : [];
  F.nb.innerHTML = cs.map(n => `<option value="${n}">${n === "seme" ? "semé" : n}</option>`).join("");
  const ds = dispos(a);
  F.d.innerHTML = ds.map(d => `<option value="${d.id}">${esc(libelle(d.lab))}</option>`).join("");
  F.nb2.innerHTML = Object.keys(PLEIN).filter(n => !a.cp || +n <= 3).map(n => `<option value="${n}">${n}</option>`).join("");
  F.d2.innerHTML = PLEIN[a.nb2].map(d => `<option value="${d.id}">${esc(libelle(d.lab))}</option>`).join("");
  /* le nombre de pièces dépend du champ rayé : six, huit… ou des pièces rebattues pour un nombre impair ; des tires pour l'échiqueté ; rien pour le fuselé */
  const lab = n => (enAnglais() ? (a.ray === "chequy" ? `${NB_EN[n]} rows` : +n % 2 ? `${NB_EN[(n - 1) / 2]} ${RAY_PIECE_EN[a.ray]} (${n} pieces)` : `${NB_EN[n]} pieces`)
    : a.ray === "chequy" ? `${NB[n]} tires` : +n % 2 ? `${NB[(n - 1) / 2]} ${RAY_PIECE[a.ray]}s (pièces rebattues)` : `${NB[n]} pièces`);
  F.n.innerHTML = rayNs(a.ray).map(n => `<option value="${n}">${esc(lab(+n))}</option>`).join("");
  F.n.hidden = a.ray.startsWith("lozengy");
  F.hp.innerHTML = ATL.ornements.heaumes.filter(h => h.type === S.ht).map(h => `<option value="${h.pos}">${esc(libelle(ATL.ornements.heaumePos[h.pos]))}</option>`).join("");
  const bp = brisPiece(a), bf = BRIS_FIGS.includes(a.br);
  const bordLu = (k, v) => cap(enAnglais() ? CONTOUR_EN[k] : v);
  F.lbr.innerHTML = `<option value="">${Tr("Droit", "Straight")}</option>` + Object.entries(CONTOUR_NOM).filter(([k]) => k !== "alesee").map(([k, v]) => `<option value="${k}">${bordLu(k, v)}</option>`).join("");
  F.brd.innerHTML = bf ? dispos(brisArms(a)).map(d => `<option value="${d.id}">${esc(libelle(d.lab))}</option>`).join("") : "";
  for (const k of Object.keys(ADEF)) setField(k, a[k]);
  for (const k of Object.keys(ODEF)) setField(k, S[k]);
  const tri = a.f === "part" && a.part.startsWith("tierce");
  $("#r-part").hidden = a.f !== "part";
  $("#r-ray").hidden = a.f !== "ray";
  $("#r-t2").hidden = a.f === "plein";
  $("#r-t3").hidden = !tri;
  $("#l-t1").textContent = a.f === "plein" ? Tr("Émail", "Tincture") : Tr("Premier émail", "First tincture");
  $("#r-tp").hidden = !a.p || !!a.pcc;
  $("#r-big2").hidden = !(m && count2(a) && a.nb2 === "1" && a.d2 === "chef" && !a.cp);
  $("#r-lrg").hidden = !((a.p === "bande" || a.p === "barre") && !a.ln);
  $("#r-fqs").hidden = a.p !== "franc-quartier";
  $("#r-ri").hidden = !(a.p === "bande" || a.p === "barre");
  $("#r-cmp").hidden = !(a.p === "bordure" && !a.ln && !a.pf && a.pos !== "sur");
  $("#r-pcc").hidden = !pccPossible(a);                                        // la pièce « de l'un en l'autre » : sur un champ partagé, sans meuble
  $("#r-ln").hidden = !a.p;
  $("#r-pf").hidden = !a.p || a.p === "bordure" || a.p === "orle";
  /* le bord : droit, décoré, ou alésé (seulement pour les pièces qui s'alèsent) */
  F.ln.innerHTML = `<option value="">${Tr("Droit", "Straight")}</option>` + Object.entries(CONTOUR_NOM).filter(([k]) => k !== "alesee" || ALESEE_OK.has(a.p)).map(([k, v]) => `<option value="${k}">${bordLu(k, v)}</option>`).join("");
  setField("ln", a.ln);
  $("#r-ct").hidden = !(m && m.asym);
  $("#r-rot").hidden = !(m && m.incline);
  $("#r-ct2").hidden = !(m2 && m2.asym);
  $("#r-nb").hidden = !m || cs.length < 2;
  $("#r-d").hidden = !m || m.seul || ds.length < 2;
  $("#r-tm").hidden = !m || !!a.cc;
  $("#r-cc").hidden = !ccPossible(a);                                         // « de l'un en l'autre » : sur un champ partagé de deux émaux
  const canSur = a.p && LAYOUT["sur-" + a.p], canAut = a.p && LAYOUT[a.p], canSous = a.p && BRO_OK.has(a.p) && a.nb !== "seme";
  $("#r-pos").hidden = !m || !a.p || [canSur, canAut, canSous].filter(Boolean).length < 2;
  [...F.elements.pos].forEach(r => { r.closest("label").hidden = !{ sur: canSur, autour: canAut, sous: canSous }[r.value]; });
  $("#r-ta").hidden = !m || !m.accent;
  $("#r-cn").hidden = !m || !m.couronne;
  $("#r-pbro").hidden = !(a.p && a.pos === "sur" && count2(a) && a.nb2 === "1" && a.nb !== "seme");
  $("#r-bro2").hidden = !(m && count2(a) && a.nb2 === "1" && a.nb !== "seme" && !a.p && !a.cc);
  $("#r-rc").hidden = !rcPossible(a);
  $("#r-cha").hidden = !(m && !m.seul && count2(a) && a.nb2 === "1" && a.nb !== "seme" && +a.nb >= 2 && !a.p && !a.cc && !a.bro2 && !a.iss);
  $("#r-cnk").hidden = !m || !m.couronne || !a.cn;
  $("#r-iss").hidden = !m || m.seul || a.nb !== "1" || !!a.p;                                   // « issant » : un seul meuble, sans pièce
  [...F.elements.iss].forEach(r => { if (r.value === "t") r.closest("label").hidden = !(S.q === "p" && CUR < 2); });          // le demi-meuble : seulement dans une moitié du parti
  if (m?.accentMot) $("#l-ta").textContent = libAccent(m);
  const note = $("#m-note");
  note.hidden = !m?.file;
  if (m?.file) note.textContent = Tr(`Figure empruntée à Wikimedia Commons, recolorée ici : ${m.file.auteur}, ${m.file.lic}.`, `Figure borrowed from Wikimedia Commons, recoloured here: ${auteurLu(m.file.auteur)}, ${licenceLue(m.file.lic)}.`);
  $("#r-m2").hidden = !m;
  $("#r-nb2").hidden = $("#r-d2").hidden = $("#r-tm2").hidden = !m2;
  $("#r-cp").hidden = !m2 || a.p !== "fasce" || a.pos !== "autour" || a.nb === "seme";          // « accompagnée en chef de … et en pointe de … »
  if (a.cp) $("#r-d2").hidden = true;
  $("#r-ta2").hidden = !m2 || !m2.accent;
  $("#r-cn2").hidden = !m2 || !m2.couronne;
  $("#r-cnk2").hidden = !m2 || !m2.couronne || !a.cn2;
  if (m2?.accentMot) $("#l-ta2").textContent = libAccent(m2);
  $("#r-tl1").hidden = $("#r-tl2").hidden = S.hm !== "hl";
  const mci = S.hm && S.ci && meuble(S.ci);
  $("#r-ci").hidden = !S.hm;
  $("#r-cim").hidden = $("#r-cit").hidden = !mci;
  $("#r-cia").hidden = !mci || !mci.accent;
  if (mci?.accentMot) $("#l-cia").textContent = libAccent(mci);
  $("#r-pa").hidden = !S.hm || !!S.ci;                                                            // le cimier prend la place du panache
  $("#r-pa1").hidden = $("#r-pa2").hidden = !S.hm || !S.pa || !!S.ci;
  $("#r-ts").hidden = !S.su;
  $("#r-mc").hidden = $("#r-ml").hidden = !S.mt;
  $("#r-dt").hidden = !S.dv.trim();
  $("#r-hp").hidden = !S.hm;
  $("#r-hs").hidden = S.hp === "face";
  $("#hm-note").textContent = "";
  $("#r-tbr").hidden = !a.br;
  $("#br-ctl").hidden = !!S.q && CUR !== 0;
  $("#br-q").hidden = !(S.q && CUR !== 0);
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
  $("#r-pj").hidden = !a.p || a.p === "bordure" || a.p === "orle";
  if (a.p) {
    $("#k-pdx").value = a.pdx; $("#k-pdy").value = -a.pdy;
    $("#o-pdx").textContent = +a.pdx ? (a.pdx > 0 ? "→ " : "← ") + Math.abs(a.pdx) : "0";
    $("#o-pdy").textContent = +a.pdy ? (a.pdy < 0 ? "↑ " : "↓ ") + Math.abs(a.pdy) : "0";
    $("#r-pth").hidden = a.p !== "croix";
    $("#k-pth").value = a.pth; $("#o-pth").textContent = a.pth + " %";
  }
  syncAdj();
}
/* la cible des curseurs : tout un groupe ("1", "2") ou un seul meuble ("1.0", "2.2"…) */
function adjTargets(a) {
  const m = a.m && meuble(a.m), m2 = count2(a) && meuble(a.m2), n1 = count1(a), n2 = count2(a), out = [];
  const all = (mm, n, extra) => (enAnglais() ? (n === 1 ? cap(singLu(mm).replace(/^the /, "")) : `All the ${plurLu(mm).replace(/^the /, "")}`) : n === 1 ? cap(art(mm.sing, mm.g)) + mm.sing : `${mm.g === "f" ? "Toutes les" : "Tous les"} ${mm.plur}`) + extra;
  const NO = Tr("n°", "no.");
  if (m) { out.push(["1", all(m, n1, "")]); if (n1 > 1) for (let i = 0; i < n1; i++) out.push([`1.${i}`, `${cap(singLu(m))} ${NO} ${i + 1}`]); }
  if (m2) { out.push(["2", all(m2, n2, Tr(" (second meuble)", " (second charge)"))]); if (n2 > 1) for (let i = 0; i < n2; i++) out.push([`2.${i}`, `${cap(singLu(m2))} ${NO} ${i + 1} (second)`]); }
  return out;
}
function adjValues(a, t) {
  if (t === "1" || t === "2") { const x = t === "2" ? "2" : ""; return [+a["sz" + x], +a["dx" + x], +a["dy" + x], +a["an" + x]]; }
  const v = adMap(a).get(t) || [100, 0, 0];
  return [v[0], v[1], v[2], v[3] || 0];
}
function syncAdj() {
  const a = cur(), ts = adjTargets(a);
  $("#r-adj").hidden = !ts.length;
  if (!ts.length) return;
  if (!ts.some(([v]) => v === KT)) KT = "1";
  $("#k-t").innerHTML = ts.map(([v, l]) => `<option value="${v}"${v === KT ? " selected" : ""}>${esc(l)}</option>`).join("");
  const [sz, dx, dy, an] = adjValues(a, KT);
  $("#k-sz").value = sz; $("#k-dx").value = dx; $("#k-dy").value = -dy; $("#k-an").value = an;
  $("#o-sz").textContent = sz + " %";
  $("#o-an").textContent = an ? (an > 0 ? "↻ " : "↺ ") + Math.abs(an) + "°" : "0°";
  $("#o-dx").textContent = dx ? (dx > 0 ? "→ " : "← ") + Math.abs(dx) : "0";
  $("#o-dy").textContent = dy ? (dy < 0 ? "↑ " : "↓ ") + Math.abs(dy) : "0";
}
function setAdj(v) {
  const a = cur();
  if (KT === "1" || KT === "2") { const x = KT === "2" ? "2" : ""; a["sz" + x] = String(v[0]); a["dx" + x] = String(v[1]); a["dy" + x] = String(v[2]); a["an" + x] = String(v[3]); return; }
  const map = adMap(a);
  if (v[0] === 100 && !v[1] && !v[2] && !v[3]) map.delete(KT); else map.set(KT, v[3] ? v : v.slice(0, 3));
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
const encode = etatCode, decode = etatDe;                                        // assets/dessin.js

/* cercle d'or autour du meuble que visent les curseurs (aperçu seulement, pas dans les exports) */
function marker() {
  if (!/^[12]\.\d$/.test(KT)) return "";
  const a = cur(), [g, i] = KT.split(".").map(Number), m = meuble(g === 1 ? a.m : a.m2);
  const circle = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#c9a227" stroke-width="2.2" stroke-dasharray="6 4" pointer-events="none"/>`;
  /* dans un parti, chaque case place ses figures à sa façon (carte de la case, demi-meuble sur le trait) : on les calcule sous la même carte que le dessin */
  if (["p", "c", "t", "l"].includes(S.q) && CUR !== 4) return partiCells(S).filter(c => c.arm === CUR).map(c => {
    const mp = partiMap(c);
    let all, fx;
    MAP = mp; HSIDE = c.half;
    try { all = g === 1 ? ptsFor(a, m) : pts2(a); fx = facteurMoitie(all); } finally { MAP = null; HSIDE = 0; }
    const q = all[i];
    return q ? circle(mp.cx + (q[0] - 100) * mp.vpx + mp.shx, mp.cy + (q[1] - 126) * mp.fpy + mp.shy, Math.max(6, 82 * q[2] * mp.pk * fx)) : "";
  }).join("");
  const p = (g === 1 ? ptsFor(a, m) : pts2(a))[i];
  if (!p) return "";
  const spots = CUR === 4 ? [[100 - 100 * AB_K, 126 - 126 * AB_K, AB_K]]               // dans l'écusson en abîme
    : !S.q ? [[0, 0, 1]] : quarterArms(S).map((ai, qi) => ai === CUR ? qOrigin(quarterGeom().q[qi]) : null).filter(Boolean);
  return spots.map(([ox, oy, k]) => circle(ox + p[0] * k, oy + p[1] * k, Math.max(8, 82 * p[2] * k))).join("");
}
async function render() {
  const tok = render.n = (render.n || 0) + 1;
  S = normalizeAll(S);
  try { await loadAll(S); }
  catch (e) { $("#blz").textContent = Tr("Une figure n'a pas pu être chargée (", "A figure could not be loaded (") + e.message + ")."; return; }
  if (tok !== render.n) return;
  syncForm();
  DEROULANTS.forEach(d => d.maj());
  const c = compose(S), sh = $("#shield");
  sh.setAttribute("viewBox", c.vb.join(" "));
  sh.classList.toggle("orn", c.vb !== PLAIN_VB);
  sh.innerHTML = c.svg + marker();
  const b = blazonLu(S);
  $("#blz").textContent = b;
  sh.setAttribute("aria-label", b);
  const o = ornTextLu(S);
  $("#orn").hidden = !o;
  $("#orn").textContent = o;
  const w = ruleLue(S);
  $("#warn").hidden = !w.length;
  $("#warn").innerHTML = w.length ? w.map(esc).join("<br>") + Tr(` La <a href="encyclopedie.html#emaux">règle des émaux</a> l'interdit, sauf armes à enquerre${active(S).some(i => S.A[i].p === "chef") ? " — ou chef dit « cousu »" : ""}.`, ` The <a href="${versLangue("encyclopedie.html")}#emaux">rule of tincture</a> forbids it, except for arms of enquiry${active(S).some(i => S.A[i].p === "chef") ? ", or a chief called “sewn” (<i lang=\"fr\">cousu</i>)" : ""}.`) : "";
  const cr = creditsOf(S);
  $("#credits").innerHTML = creditsHtml(cr);
  afficheOrigine();
  if (DEFI) return;                                               // en défi, l'adresse reste « #defi=dessin » : elle ne livre pas l'écu en cours
  const h = [encode(S), ORIGINE ? `de=${ORIGINE.gal}:${ORIGINE.slug}` : ""].filter(Boolean).join("&");
  history.replaceState(null, "", h ? "#" + h : location.pathname);
}

/* ---------- exports ---------- */
function standalone(St, scale = 3) {
  const defs = (globalDefs().match(/<defs>([\s\S]*)<\/defs>/) || ["", ""])[1];
  const b = blazonLu(St), o = ornTextLu(St), c = compose(St, "x"), d = origineTxt(St);
  const credit = creditsOf(St).map(creditTxt).join(" ; ");
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${c.vb.join(" ")}" width="${Math.round(c.vb[2] * scale)}" height="${Math.round(c.vb[3] * scale)}">
  <title>${esc(b)}</title>
  <desc>${esc(Tr("Composé dans l'Atelier de L'Armorial (CC BY-SA 4.0).", "Composed in the Atelier of The Armorial (CC BY-SA 4.0).") + (d ? " " + d + "." : "") + (o ? " " + o + "." : "") + (credit ? Tr(" Figures : ", " Figures: ") + credit + "." : ""))}</desc>
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
const slug = St => blazonLu(St).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || Tr("armes", "arms");
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
  const lines = wrapText(ctx, Tr("« ", "“") + blazonLu(s) + Tr(" »", "”"), W - 120);
  ctx.font = "italic 20px 'EB Garamond', Georgia, serif";
  const oLines = [origineTxt(s), ornTextLu(s)].filter(Boolean).flatMap(t => wrapText(ctx, t, W - 120));
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
  ctx.fillText(Tr("L'Armorial — atelier · CC BY-SA 4.0", "The Armorial — Atelier · CC BY-SA 4.0"), W / 2, H - 22);
  cv.toBlob(b => download(slug(s) + ".png", b), "image/png");
}

/* ---------- hasard et exemples ---------- */
const EXEMPLES = [
  [Tr("France moderne", "Modern France"), { A0: { t1: "Azur", m: "fleurdelis", nb: "3", tm: "Or" } }],
  [Tr("Savoie", "Savoy"), { A0: { t1: "Gueules", p: "croix", tp: "Argent", m: "" } }],
  [Tr("Bretagne", "Brittany"), { A0: { t1: "Hermine", m: "" } }],
  [Tr("Un semé", "A semé"), { A0: { t1: "Azur", m: "fleurdelis", nb: "seme", tm: "Or", p: "bande", tp: "Gueules" } }],
  [Tr("Chef chargé", "Charged chief"), { A0: { t1: "Argent", p: "chef", tp: "Azur", m: "etoile", nb: "3", pos: "sur", tm: "Or" } }],
  [Tr("Deux meubles", "Two charges"), { A0: { t1: "Azur", m: "lion", nb: "1", tm: "Or", m2: "etoile", nb2: "3", d2: "chef", tm2: "Argent", sz: "85", dy: "14" } }],
  [Tr("Écartelé", "Quarterly"), { q: "2", A0: { t1: "Azur", m: "fleurdelis", nb: "3", tm: "Or" }, A1: { t1: "Gueules", m: "", p: "croix", tp: "Argent" } }],
  [Tr("Heaume à panache", "Helm with a panache"), { hm: "hl", pa: "5", tl1: "Azur", tl2: "Or", pa1: "Or", pa2: "Azur", A0: { t1: "Azur", m: "fleurdelis", nb: "3", tm: "Or" } }],
  [Tr("Lion contourné", "Lion contourné"), { A0: { t1: "Azur", m: "lion", nb: "1", tm: "Or", ta: "Gueules", ct: "1" } }],
  [Tr("Fasce ondée", "Fess wavy"), { A0: { t1: "Argent", m: "", p: "fasce", tp: "Azur", ln: "onde" } }],
  [Tr("Trois pals", "Three pales"), { A0: { f: "ray", ray: "paly", n: "7", t1: "Or", t2: "Gueules", m: "" } }],
  [Tr("Bordure engrêlée", "Bordure engrailed"), { A0: { t1: "Or", m: "lion", nb: "1", tm: "Sable", ta: "Gueules", p: "bordure", tp: "Gueules", ln: "engrele" } }],
  [Tr("Franc-quartier", "Quarter"), { A0: { t1: "Or", m: "epee", nb: "1", tm: "Argent", p: "franc-quartier", tp: "Azur", pos: "sur" } }],
  [Tr("Angleterre", "England"), { A0: { t1: "Gueules", m: "leopard", nb: "3", d: "pal", tm: "Or", ta: "Azur", sz: "190" } }],
  [Tr("Aigle bicéphale", "Double-headed eagle"), { A0: { t1: "Or", m: "aigle-bicephale", nb: "1", tm: "Sable", ta: "Gueules" } }],
  [Tr("Échiqueté", "Chequy"), { A0: { f: "ray", ray: "chequy", n: "6", t1: "Argent", t2: "Gueules", m: "" } }],
  [Tr("Fuselé en bande", "Fusily in bend"), { A0: { f: "ray", ray: "lozengybend", n: "6", t1: "Azur", t2: "Argent", m: "" } }],
  [Tr("Chevronné", "Chevronny"), { A0: { f: "ray", ray: "chevronny", n: "6", t1: "Or", t2: "Sable", m: "" } }],
  [Tr("Burelé", "Barruly"), { A0: { f: "ray", ray: "barry", n: "10", t1: "Argent", t2: "Gueules", m: "" } }],
  [Tr("Fasce alésée", "Fess couped"), { A0: { t1: "Argent", m: "", p: "fasce", tp: "Gueules", ln: "alesee" } }],
  [Tr("Croix bordée", "Cross fimbriated"), { A0: { t1: "Azur", m: "", p: "croix", tp: "Gueules", pf: "Argent" } }],
  [Tr("Croix mince", "Thin cross"), { A0: { t1: "Argent", m: "", p: "croix", tp: "Gueules", pth: "60" } }],
  [Tr("Bande brochante", "Bend over all"), { A0: { t1: "Or", m: "lion", nb: "1", tm: "Gueules", ta: "Gueules", p: "bande", tp: "Azur", pos: "sous" } }],
  [Tr("Neuf étoiles", "Nine stars"), { A0: { t1: "Azur", m: "etoile6", nb: "9", tm: "Or" } }],
  [Tr("Clef", "Key"), { A0: { t1: "Azur", m: "clef", nb: "1", tm: "Or" } }],
  [Tr("Sur le tout", "Escutcheon over all"), { q: "2", ab: "1", A0: { t1: "Gueules", m: "lion", nb: "1", tm: "Or", ta: "Azur" }, A1: { t1: "Azur", m: "fleurdelis", nb: "3", tm: "Or", p: "" }, A4: { t1: "Argent", m: "", p: "croix", tp: "Gueules" } }],
  [Tr("Brisé d'un croissant", "Differenced by a crescent"), { A0: { t1: "Azur", m: "fleurdelis", nb: "3", tm: "Or", br: "croissant", tbr: "Argent" } }],
  [Tr("Brisé d'une bordure", "Differenced by a bordure"), { A0: { t1: "Azur", m: "fleurdelis", nb: "3", tm: "Or", br: "bordure", tbr: "Gueules" } }],
  [Tr("Brisé d'un bâton", "Differenced by a baton"), { A0: { t1: "Azur", m: "fleurdelis", nb: "3", tm: "Or", br: "baton", tbr: "Gueules", sbr: "barre" } }],
  [Tr("Lambel", "Label"), { A0: { t1: "Azur", m: "fleurdelis", nb: "3", tm: "Or", br: "lambel", tbr: "Argent" } }],
  [Tr("Lambel chargé", "Charged label"), { A0: { t1: "Azur", m: "fleurdelis", nb: "3", tm: "Or", br: "lambel", tbr: "Gueules", lpn: "5", lpc: "roundel", lpt: "Or", lpk: "2" } }],
  [Tr("Parti", "Per pale"), { q: "p", A0: { t1: "Azur", m: "fleurdelis", nb: "3", tm: "Or", p: "" }, A1: { t1: "Gueules", m: "leopard", nb: "3", tm: "Or", ta: "Azur", d: "pal", p: "" } }],
  [Tr("Demi-aigle au parti", "Demi-eagle on the line"), { q: "p", A0: { t1: "Or", m: "aigle", nb: "1", tm: "Sable", ta: "Gueules", iss: "t", p: "" }, A1: { t1: "Gueules", m: "clef", nb: "1", tm: "Or", ct: "1", p: "" } }],
  [Tr("Parti bordé", "Per pale with a bordure"), { q: "p", A0: { t1: "Or", m: "lion", nb: "1", tm: "Sable", ta: "Gueules", p: "bordure", tp: "Gueules", ln: "engrele" }, A1: { t1: "Azur", m: "fleurdelis", nb: "3", tm: "Or", p: "" } }],
  [Tr("Lambel sur tout l'écu", "Label over the whole shield"), { q: "2", A0: { t1: "Azur", m: "fleurdelis", nb: "seme", tm: "Or", br: "lambel", tbr: "Argent" }, A1: { t1: "Gueules", m: "leopard", nb: "3", d: "pal", tm: "Or", ta: "Azur", sz: "190", p: "" } }],
  [Tr("Parti écartelé", "Per pale and quartered"), { q: "p", h1: "2", A0: { t1: "Azur", m: "fleurdelis", nb: "3", tm: "Or", p: "" }, A2: { t1: "Gueules", m: "leopard", nb: "3", tm: "Or", ta: "Azur", d: "pal", p: "" }, A1: { t1: "Or", m: "lion", nb: "1", tm: "Gueules", ta: "Azur", p: "" } }],
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
  s.m = Math.random() < .8 ? pick(ATL.meubles.filter(x => !x.lettre)).kind : "";
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
  const liste = l => l.length ? `${Tr("", '<p class="vu">The reader comments in French:</p>')}<ul lang="fr">${l.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
  if (r.ok) {
    el.classList.add("ok");
    el.innerHTML = `<p><b>${Tr("Compris.", "Understood.")}</b> ${Tr("L'écu est dessiné.", "The shield is drawn.")}</p>${r.exact ? "" : `<p class="vu">${Tr("L'Atelier l'écrit :", "In French, the Atelier writes it:")} <span lang="fr">${esc(r.reecrit)}</span></p>`}${liste(r.notes)}`;
  } else {
    el.classList.add("ko");
    el.innerHTML = `<p><b>${Tr("Pas compris.", "Not understood.")}</b> ${Tr("Rien n'est deviné : l'écu n'a pas bougé.", "Nothing is guessed: the shield has not moved.")}</p><p class="vu" lang="fr">${texteMarque(texte, r.erreurs)}</p>${liste(r.erreurs.map(e => e.msg))}${liste(r.notes)}`;
  }
}
/* applique des armes lues : les ornements, la forme de l'écu et le reste de la composition ne bougent pas */
function appliqueLecture(etat) {
  S = { ...S, q: etat.q, ab: etat.ab, gb: etat.gb || "", xc: etat.xc || "", xb: etat.xb || "", xp: etat.xp || "", h1: etat.h1, h2: etat.h2, A: etat.A.map(a => ({ ...a })) };
  CUR = 0; KT = "1";
  render();
}
let lireT = 0;
/* réglages graphiques proposés par une carte (« sz2=60&dy2=-40&q2.an=45 ») : taille (sz, en %), décalages (dx, dy), angle (an) et écart (ec, en %) du premier ou du second
   meuble — de la première des armes, ou, préfixés « q2. » à « q4. », d'un autre quartier, « q5. » de l'écusson en abîme — et, pour la pièce
   (une croix « affinée » : pth=55), son épaisseur en % (pth) et ses décalages (pdx, pdy) ; cs et ce : taille et écart (en %) des figures portées par
   un tourteau plus grand (Médicis : trois fleurs de lis). Les valeurs sont celles de l'état de l'Atelier :
   dy négatif monte la figure (le curseur « Bas ↕ haut » montre l'opposé). */
function appliqueAjust(aj) {
  if (!aj) return;
  for (const [k, v] of new URLSearchParams(aj)) {
    const m = /^(?:q([1-5])\.)?((?:sz|dx|dy|an|ec)2?|pth|pdx|pdy|cs|ce|xz)$/.exec(k);
    if (!m || !isFinite(+v) || Math.abs(+v) > 300) continue;
    const a = S.A[m[1] ? +m[1] - 1 : 0];
    if (a) a[{ cs: "m2cs", ce: "m2ce" }[m[2]] || m[2]] = v;
  }
  render();
}
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
  if (r.ok) appliqueAjust(new URLSearchParams(location.hash.replace(/^#/, "")).get("aj"));
  return true;
}

/* ---------- partir d'un blason réel : les cartes des galeries ---------- */
const GALERIES = { blasons: { fichier: "data/blasons.json", titre: Tr("Blasons réels", "Real arms"), page: versLangue("blasons.html") }, personnages: { fichier: "data/personnages.json", titre: Tr("Personnages", "People"), page: versLangue("personnages.html") } };
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
    return (await lireDonnees(G.fichier)).map(a => ({ gal, slug: slugCarte(a.nom), a, r: a.blason ? lireCarte(a) : null }));
  }));
  CARTES = listes.flat();
}
/* le sélecteur : les cartes que le lecteur relit en entier, par galerie et par rubrique. Rien n'y est écrit en dur : quand le lecteur
   apprend un mot, les armes qu'il relit de plus y entrent d'elles-mêmes */
function remplitReels() {
  const ok = CARTES.filter(c => c.r && c.r.ok), groupes = new Map();
  for (const c of ok) { const g = GALERIES[c.gal].titre + (c.a.cat ? " · " + c.a.cat : ""); groupes.set(g, [...(groupes.get(g) || []), c]); }
  $("#reel").innerHTML = `<option value="">${Tr("Choisir des armes réelles", "Choose real arms")} (${ok.length})…</option>` + [...groupes].map(([g, cs]) =>
    `<optgroup label="${esc(g)}">${cs.map(c => `<option value="${CARTES.indexOf(c)}">${esc(nomCarte(c.a))}</option>`).join("")}</optgroup>`).join("");
  $("#reel-note").innerHTML = Tr(`${ok.length} des ${CARTES.filter(c => c.r).length} blasonnements des galeries : l'Atelier ne dessine que ce qu'il relit en entier, et la liste s'allonge à mesure qu'il apprend des mots. Un clic sur l'écu d'une carte de <a href="blasons.html">Blasons réels</a> ou de <a href="personnages.html">Personnages</a> mène ici aussi.`,
    `${ok.length} of the galleries' ${CARTES.filter(c => c.r).length} blazons: the Atelier only draws what it can read in full (in French), and the list grows as it learns words. The “Redraw it in the Atelier” button under a card in <a href="${GALERIES.blasons.page}">Real arms</a> or <a href="${GALERIES.personnages.page}">People</a> leads here too.`);
}
/* la carte demandée par l'adresse, une fois les galeries chargées ; inconnue, on l'oublie. Si le lecteur ne la relit pas,
   son texte va dans la zone de saisie, surligné là où il bute (c'est ce que l'on vient voir) */
function resoudOrigine() {
  if (!ORIGINE || !CARTES) return;
  ORIGINE.c = CARTES.find(c => c.gal === ORIGINE.gal && c.slug === ORIGINE.slug && c.r) || null;          // une carte sans blasonnement n'a rien à ouvrir
  if (!ORIGINE.c) { ORIGINE = null; return; }
  const { a, r } = ORIGINE.c;
  if (r && !r.ok && !$("#lire").value.trim()) { $("#lire").value = texteAtelier(a); afficheLecture(r, texteAtelier(a)); }
}
/* en arrivant d'une carte (ou d'un autre lien « #lire=… »), on va droit à l'écu : le bandeau est passé, l'en-tête fixe ne le cache pas */
function allerALEcu() {
  const m = $(".mast");
  scrollTo(0, $("#wrap").getBoundingClientRect().top + scrollY - (m ? m.offsetHeight : 0) - 10);
}
function partirDe(c) {
  ORIGINE = { gal: c.gal, slug: c.slug, c };
  S.sh = c.a.forme || "";                                                        // la forme de l'écu vient de la carte (son image), pas du blasonnement
  $("#lire").value = texteAtelier(c.a);
  lireLeChamp();
  appliqueAjust(c.a.atelierAjust);
  if (matchMedia("(max-width: 860px)").matches) allerALEcu();                     // sur téléphone, l'écu est au-dessus du formulaire
}
/* l'empreinte des armes (sans les ornements ni les réglages graphiques) : sont-ce encore celles de la carte ? */
const empreinte = St => JSON.stringify(canonAll(St));
function empreinteCarte(c) {
  if (!c.emp) { const e = c.r.etat; c.emp = empreinte({ q: e.q, ab: e.ab, gb: e.gb || "", xc: e.xc || "", xb: e.xb || "", xp: e.xp || "", h1: e.h1, h2: e.h2, A: e.A.map(a => normalize({ ...a })) }); }
  return c.emp;
}
const armesDeLaCarte = (St, c) => !!(c && c.r && c.r.ok) && empreinte(St) === empreinteCarte(c);
/* pour les exports : « Armes de … » ou « D'après les armes de … » */
function origineTxt(St) {
  const c = ORIGINE && ORIGINE.c;
  if (!c) return "";
  return Tr(`${armesDeLaCarte(St, c) ? "Armes de" : "D'après les armes de"} « ${c.a.nom} » (L'Armorial, ${GALERIES[c.gal].titre})`, `${armesDeLaCarte(St, c) ? "Arms of" : "After the arms of"} “${nomCarte(c.a)}” (The Armorial, ${GALERIES[c.gal].titre})`);
}
/* sous l'écu : la carte d'où l'on part, son image (de Wikimedia Commons, créditée) à comparer au dessin, et si l'on s'en est écarté */
function afficheOrigine() {
  const el = $("#origine"), c = ORIGINE && ORIGINE.c;
  if (CARTES) $("#reel").value = c && c.r && c.r.ok ? String(CARTES.indexOf(c)) : "";
  el.hidden = !c;
  if (!c) { el.innerHTML = afficheOrigine.h = ""; return; }
  const a = c.a, G = GALERIES[c.gal], fichier = encodeURIComponent(a.file);
  const etat = !c.r || !c.r.ok
    ? `<p class="or-etat ko">${Tr("L'Atelier ne relit pas encore ce blasonnement : l'écu dessiné ici n'est pas celui de la carte.", "The Atelier can't read this blazon yet: the shield drawn here is not the one on the card.")}</p>`
    : armesDeLaCarte(S, c)
      ? `<p class="or-etat ok">${Tr("Ce sont les armes de la carte, telles qu'elle les blasonne.", "These are the arms on the card, as it blazons them.")}${ornText(S) || S.sh ? Tr(" La forme de l'écu et les ornements sont de votre main : le blasonnement ne les dit pas.", " The shape of the shield and the ornaments are your own: the blazon doesn't state them.") : ""}</p>`
      : `<p class="or-etat mod">${Tr("Vous les avez modifiées : ce ne sont plus les armes de la carte.", "You have changed them: these are no longer the arms on the card.")} <button type="button" class="lnk" id="b-origine">${Tr("Revenir aux armes de la carte", "Back to the arms on the card")}</button></p>`;
  const lic = a.lic ? (a.licurl ? `<a href="${esc(a.licurl)}" target="_blank" rel="noopener">${esc(a.lic)}</a>` : esc(a.lic)) : Tr("licence libre", "free licence");
  const h = `<img class="or-img" src="${COMMONS_W}Special:FilePath/${fichier}?width=200" alt="${Tr(`Armoiries — ${esc(a.nom)} : l'image de la carte`, `Arms — ${esc(nomCarte(a))}: the card's image`)}" loading="lazy"${styleFiltre(a)}>
    <div class="or-txt">
      <p class="or-k">${Tr("Parti d'un blason réel", "Started from real arms")} · ${G.titre}</p>
      <p class="or-nom"><a href="${G.page}#${c.slug}">${esc(nomCarte(a))}</a></p>
      ${etat}
      <p class="or-cr">${Tr("À gauche, l'image de la carte :", "On the left, the card's image:")} <a href="${COMMONS_W}File:${fichier}" target="_blank" rel="noopener">${Tr("« ", "“")}${esc(a.file)}${Tr(" »", "”")}</a>${a.auteur ? ` — ${esc(a.auteur)}` : ""}, ${lic}, via Wikimedia Commons${a.filtreNote ? ` ; ${esc(a.filtreNote)}` : ""}.</p>
    </div>`;
  if (h !== afficheOrigine.h) el.innerHTML = afficheOrigine.h = h;          // render() passe ici à chaque curseur : l'image n'est refaite que si la carte ou l'état changent
}

/* ---------- vos armes : les armes de joueur (assets/compte.js) et la bibliothèque (comptes en ligne, assets/enligne.js) ---------- */
let POUR_PROFIL = false;                                        // on vient de la fenêtre du profil (« Composer mes armes dans l'Atelier ») : un lien ramène au jeu
let DEFI = false;                                               // « Dessine-moi », le jeu du jour (assets/dessine.js) : atelier.html#defi=dessin
const enLigneConnecte = () => !!(window.Compte && Compte.biblio && Compte.ligne && Compte.ligne.connecte());
function dit(html) { $("#mes-armes-ret").innerHTML = html; }
async function dessineBiblio() {
  const det = $("#biblio");
  if (!enLigneConnecte()) { det.hidden = true; return; }
  let l;
  try { l = await Compte.biblio.liste(); } catch (e) { det.hidden = false; $("#biblio-n").textContent = ""; $("#biblio-l").innerHTML = `<li>${esc(e.message)}</li>`; return; }
  await Promise.all(l.map(x => Compte.prepare(x.armes)));
  det.hidden = false;
  $("#biblio-n").textContent = `(${l.length})`;
  $("#biblio-l").innerHTML = l.length ? l.map(x => `<li><span class="bm" aria-hidden="true">${Compte.dessin(x.armes)}</span><span class="bn">${esc(x.nom)}</span>
      <span class="ba"><button type="button" data-ouvre="${esc(x.armes)}">${Tr("Ouvrir", "Open")}</button><button type="button" data-retire="${esc(x.id)}">${Tr("Retirer", "Remove")}</button></span></li>`).join("")
    : `<li class="biblio-vide">${Tr("Rien encore : « Enregistrer dans ma bibliothèque » garde l'écu affiché.", "Nothing yet: “Save to my library” keeps the shield on display.")}</li>`;
}
function mesArmes() {
  if (!window.Compte) { $("#mes-armes").hidden = true; return; }
  $("#b-miennes").addEventListener("click", () => {
    if (Compte.prendreArmes(encode(S))) dit(`${Tr("Ce sont désormais vos armes de joueur.", "These are now your player arms.")}${POUR_PROFIL ? ` <a href="${Tr("./", "en.html")}">${Tr("Retour au jeu", "Back to the game")}</a>` : ""}`);
    else dit(Tr("Choisissez un pseudo pour créer votre profil.", "Choose a username to create your profile."));
  });
  const f = $("#garder-f"), nom = $("#garder-nom");
  $("#b-garder").addEventListener("click", async () => {
    await Compte.pret;
    if (!enLigneConnecte()) {
      dit(`${Tr("La bibliothèque est réservée aux comptes en ligne.", "The library is for online accounts.")} <button type="button" id="b-compte">${Tr("Créer un compte ou me connecter", "Create an account or sign in")}</button>`);
      $("#b-compte").addEventListener("click", () => Compte.ouvre({ armes: encode(S) }));
      return;
    }
    nom.value = (ORIGINE && ORIGINE.c ? nomCarte(ORIGINE.c.a) : blazonLu(S)).slice(0, 60);
    f.hidden = false; nom.focus(); nom.select(); dit("");
  });
  $("#garder-non").addEventListener("click", () => { f.hidden = true; });
  f.addEventListener("submit", async e => {
    e.preventDefault();
    const bt = f.querySelector("button[type=submit]"); bt.disabled = true;
    try { await Compte.biblio.ajoute(nom.value, encode(S)); f.hidden = true; dit(Tr("Enregistré dans votre bibliothèque.", "Saved to your library.")); $("#biblio").open = true; await dessineBiblio(); }
    catch (err) { dit(esc(err.message)); }
    finally { bt.disabled = false; }
  });
  $("#biblio-l").addEventListener("click", async e => {
    const o = e.target.closest("[data-ouvre]"), r = e.target.closest("[data-retire]");
    if (o) { S = decode(o.dataset.ouvre); ORIGINE = null; CUR = 0; KT = "1"; await render(); allerALEcu(); dit(Tr("Armes reprises de votre bibliothèque.", "Arms taken from your library.")); }
    if (r) {
      if (!r.dataset.sur) { r.dataset.sur = "1"; r.textContent = Tr("Sûr ?", "Sure?"); return; }
      r.disabled = true;
      try { await Compte.biblio.retire(r.dataset.retire); await dessineBiblio(); } catch (err) { dit(esc(err.message)); r.disabled = false; }
    }
  });
  /* la connexion (ou la déconnexion) change ce qu'on peut faire : la bibliothèque suit */
  if (Compte.surSynchro) Compte.surSynchro(() => dessineBiblio());
  Compte.pret.then(dessineBiblio);
}

/* ---------- démarrage ---------- */
(async function init() {
  try {
    const [r1, r2] = await Promise.all([fetch("data/data.json"), fetch("data/atelier.json")]);
    if (!r1.ok || !r2.ok) throw new Error(`HTTP ${r1.ok ? r2.status : r1.status}`);
    DATA = await r1.json(); ATL = await r2.json();
  } catch (e) {
    $("#wrap").innerHTML = `<p class="err">${Tr(`Les données n'ont pas pu être chargées (${esc(e.message)}). Cette page doit être servie par HTTP, et non ouverte depuis le disque.`, `The data could not be loaded (${esc(e.message)}). This page must be served over HTTP, not opened from disk.`)}</p>`;
    return;
  }
  $("#gdefs").innerHTML = globalDefs();
  fillSelects();
  for (const s of [F.m, F.m2, F.ci]) deroulant(s, vignetteMeuble);
  deroulant($("#reel"));
  $("#examples").innerHTML = EXEMPLES.map(([n], i) => `<button type="button" data-i="${i}">${esc(n)}</button>`).join("");
  $("#examples").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; S = example(EXEMPLES[+b.dataset.i][1]); ORIGINE = null; CUR = 0; KT = "1"; render(); });
  ORIGINE = origineDemandee(location.hash);
  POUR_PROFIL = /(^|[#&])pour=profil(&|$)/.test(location.hash);
  DEFI = typeof DessineMoi !== "undefined" && DessineMoi.actif();
  const arrivee = /(^|[#&])(lire|de|pour)=/.test(location.hash);
  S = decode(location.hash);
  const onInput = e => {
    const t = e.target;
    if (t.id === "lire") { clearTimeout(lireT); lireT = setTimeout(lireLeChamp, 450); return; }
    if (t.id === "reel") { if (e.type === "change" && t.value && CARTES && CARTES[+t.value]) partirDe(CARTES[+t.value]); return; }
    if (t.name === "cur") { CUR = +t.value; KT = "1"; syncForm(); render(); return; }
    if (t.name === "q" || t.name === "h1" || t.name === "h2") { readForm(); S = normalizeAll(S); syncForm(); render(); return; }      // des armes peuvent disparaître : le formulaire montre alors celles qui restent avant que l'événement « change » ne le relise
    if (t.id === "k-t") { KT = t.value; syncAdj(); render(); return; }
    if (/^k-(sz|dx|dy|an)$/.test(t.id)) { setAdj([+$("#k-sz").value, +$("#k-dx").value, -$("#k-dy").value, +$("#k-an").value]); render(); return; }
    if (/^k-p(dx|dy|th)$/.test(t.id)) { const a = cur(); a.pdx = $("#k-pdx").value; a.pdy = String(-$("#k-pdy").value); a.pth = $("#k-pth").value; render(); return; }
    if (/^k-br(sz|dx|dy)$/.test(t.id)) { const a = cur(); a.brsz = $("#k-brsz").value; a.brdx = $("#k-brdx").value; a.brdy = String(-$("#k-brdy").value); render(); return; }
    /* on passe au contre-changé : l'attribut le suit (« du même »), sauf si l'on choisit ensuite un émail. Le menu envoie « input » puis « change » :
       on ne relit pas tout le formulaire, dont les émaux cochés ne sont pas encore à jour */
    if (t.name === "cc") { const a = cur(); if (t.value && !a.cc) a.ta = ""; a.cc = t.value; render(); return; }
    readForm(); render();
  };
  F.addEventListener("input", onInput);
  F.addEventListener("change", onInput);
  $("#b-reset").addEventListener("click", () => { setAdj([100, 0, 0, 0]); render(); });
  $("#b-preset").addEventListener("click", () => { Object.assign(cur(), { pdx: "0", pdy: "0", pth: "100" }); render(); });
  $("#b-brreset").addEventListener("click", () => { Object.assign(cur(), { brsz: "100", brdx: "0", brdy: "0" }); render(); });
  $("#b-link").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(location.href); toast(Tr("Lien copié", "Link copied")); } catch { toast(Tr("Copiez l'adresse de la page", "Copy the page address")); }
  });
  $("#b-svg").addEventListener("click", () => download(slug(S) + ".svg", new Blob([standalone(S)], { type: "image/svg+xml" })));
  $("#b-png").addEventListener("click", () => exportPng(S).catch(e => toast(Tr("Export impossible : ", "Export failed: ") + e.message)));
  $("#b-rand").addEventListener("click", () => { S = random(); ORIGINE = null; render(); });
  $("#b-lire").addEventListener("click", lireLeChamp);
  $("#b-recopier").addEventListener("click", () => { $("#lire").value = blazonAll(S); lireLeChamp(); $("#lire").focus(); });
  $("#lire").addEventListener("keydown", e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); lireLeChamp(); } });
  $("#origine").addEventListener("click", e => {
    if (!e.target.closest("#b-origine") || !ORIGINE || !ORIGINE.c) return;
    $("#lire").value = texteAtelier(ORIGINE.c.a); lireLeChamp();
  });
  addEventListener("hashchange", () => {
    if (DEFI) return;
    ORIGINE = origineDemandee(location.hash); resoudOrigine();
    if (!lireDepuisAdresse()) { S = decode(location.hash); render(); }
  });
  if (DEFI) { S = await DessineMoi.demarre(); CUR = 0; KT = "1"; await render(); return; }
  if (!lireDepuisAdresse()) render();
  if (arrivee) allerALEcu();
  mesArmes();
  if (POUR_PROFIL) dit(Tr("Composez vos armes, puis « Prendre pour mes armes de joueur ».", "Design your arms, then “Use as my player arms”."));
  /* les galeries arrivent ensuite : le sélecteur « Partir d'un blason réel » et la carte d'où l'on part */
  try { await chargeCartes(); }
  catch (e) { $("#reel").innerHTML = `<option value="">${Tr("Galeries indisponibles", "Galleries unavailable")} (${esc(e.message)})</option>`; $("#reel").disabled = true; ORIGINE = null; render(); return; }
  remplitReels(); resoudOrigine(); render();
})();
