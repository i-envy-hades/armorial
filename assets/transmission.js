/* L'ARMORIAL — La transmission des armes (prototype) : l'arbre des passages d'armes d'une maison à l'autre.

   Lit data/transmission.json : des nœuds (un état d'armes : une maison, ou une étape de ses armes) et des liens (un passage,
   d'un type : branche cadette, mariage, héritage, union ou traité, prétention — avec ce qu'il change dans l'écu, la raison
   quand une source la donne, ses sources). Les blasonnements, figures et crédits ne sont pas recopiés : chaque nœud renvoie à
   data/capetiens.json (« cap:id ») ou aux armes d'une frise (« frise:id »), et un lien peut renvoyer à un jalon de frise
   (« frise:année »). La page ne devine rien : un lien sans raison écrite affiche « Raison non établie ».
   Adresse : transmission.html#bdv ouvre ce nœud. */
(async () => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const plie = s => String(s).toLowerCase().replace(/œ/g, "oe").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const gu = s => Tr(`«&nbsp;${s}&nbsp;»`, `“${s}”`);
  const FP = "https://commons.wikimedia.org/wiki/Special:FilePath/", PG = "https://commons.wikimedia.org/wiki/File:";
  const vignette = (f, w) => FP + encodeURIComponent(f) + "?width=" + w;

  const TYPES = {
    cadette: { nom: Tr("Branche cadette", "Cadet branch"), court: Tr("Cadette", "Cadet"), c: "#8e1b18", txt: Tr("Un fils ou un frère du roi garde ses armes et y met une marque (une brisure), ou prend celles de son fief.", "A son or brother of the king keeps his arms and adds a mark (a difference), or takes those of his fief.") },
    mariage: { nom: Tr("Mariage", "Marriage"), court: Tr("Mariage", "Marriage"), c: "#a2527a", txt: Tr("Les armes d'une épouse ou d'un époux entrent dans l'écu, en quartier, en cœur ou accolées.", "The arms of a wife or husband enter the shield, as a quarter, at the centre or impaled.") },
    heritage: { nom: Tr("Héritage ou succession", "Inheritance or succession"), court: Tr("Héritage", "Inheritance"), c: "#a9812e", txt: Tr("Une couronne, un duché ou un titre change de maison : ses armes s'ajoutent, ou remplacent les anciennes.", "A crown, duchy or title changes house: its arms are added, or replace the old ones.") },
    annexion: { nom: Tr("Union, conquête ou traité", "Union, conquest or treaty"), court: Tr("Union / traité", "Union / treaty"), c: "#20406e", txt: Tr("Un territoire entre dans l'écu parce qu'il est annexé, conquis, uni ou cédé par un traité.", "A territory enters the shield because it is annexed, conquered, united or ceded by treaty.") },
    pretention: { nom: Tr("Prétention", "Claim"), court: Tr("Prétention", "Claim"), c: "#5f4b8b", txt: Tr("Des armes sont portées pour un trône que l'on revendique sans le tenir.", "Arms are borne for a throne claimed but not held.") },
  };
  const ORDRE = Object.keys(TYPES);

  let T, F, CAP; const LIG = {};
  try {
    [T, F, CAP] = await Promise.all([lireDonnees("data/transmission.json"), lireDonnees("data/frises.json"), lireDonnees("data/capetiens.json")]);
    const L = await Promise.all(F.frises.map(f => lireDonnees(f.file)));
    F.frises.forEach((f, i) => { LIG[f.id] = L[i]; });
    await chargerLecteur().catch(() => {});            // le lecteur de blasonnement (assets/lecture.js) : sans lui, pas de bouton « Atelier »
  } catch (e) {
    $("#chargement").textContent = Tr(`Les données n'ont pas pu être chargées (${e.message}). Cette page doit être servie par HTTP, et non ouverte depuis le disque.`, `The data couldn't load (${e.message}). This page must be served over HTTP, and not opened from disk.`);
    return;
  }

  /* ---------- résoudre les renvois ---------- */
  const CAPN = Object.fromEntries(CAP.noeuds.map(n => [n.id, n]));
  const FRISE = Object.fromEntries(F.frises.map(f => [f.id, f]));
  function armes(ref) {
    const [k, id] = ref.split(":");
    if (k === "cap") {
      const n = CAPN[id];
      return { blasons: n.armes.map(a => ({ quand: a.quand, blason: a.blason, blasonEn: a.blasonEn })), file: n.file, auteur: n.auteur, lic: n.lic, licurl: n.licurl, fondateur: n.fondateur, wiki: n.wiki, notes: n.notes || [], lien: n.lien && versLangue(n.lien), lienTxt: n.lienTxt };
    }
    if (k === "tr") {                                   // maison sans frise : armes, figure et crédit portés par transmission.json
      const a = T.armes[id];
      return { blasons: a.blason ? [{ blason: a.blason, blasonEn: a.blasonEn }] : [], file: a.file, auteur: a.auteur, lic: a.lic, licurl: a.licurl, notes: a.note ? [a.note] : [], src: a.src };
    }
    const a = LIG[k].armes[id];
    return { blasons: a.blason ? [{ blason: a.blason, blasonEn: a.blasonEn }] : [], file: a.file, auteur: a.auteur, lic: a.lic, licurl: a.licurl, notes: a.note ? [a.note] : [], lien: versLangue(`lignees.html#${k}`), lienTxt: Tr(`Frise « ${FRISE[k].nom} »`, `Timeline “${FRISE[k].nom}”`) };
  }
  function jalonDe(ref) {
    const [k, an] = ref.split(":");
    for (const R of LIG[k].royaumes) for (const j of R.jalons || []) if (typeof j.annee === "number" && j.annee === Number(an)) return { ...j, frise: k, src: (j.sources || []).map(s => LIG[k].sources[s]).filter(Boolean) };
    return null;
  }
  const N = T.noeuds.map(n => ({ ...n, A: armes(n.ref), in: [], out: [] }));
  const PAR_ID = Object.fromEntries(N.map(n => [n.id, n]));
  T.liens.forEach((l, i) => { l.i = i; PAR_ID[l.vers].in.push(l); PAR_ID[l.de].out.push(l); });
  N.forEach(n => n.in.sort((a, b) => (b.de === n.parent) - (a.de === n.parent)));    // la ligne principale d'abord
  const enfants = id => N.filter(n => n.parent === id);
  const prim = n => n.in.find(l => l.de === n.parent);
  const lienSrc = ids => ids.map(id => { const s = T.sources[id]; return s ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(sourceLue(s.label))}</a>` : esc(id); }).join(" · ");
  const lire_atelier = texte => typeof window.lire === "function" && window.lire(texte).ok;

  /* ---------- l'arbre ---------- */
  /* sur chaque carte : le type du passage qui y mène (« Mariage · 1901–1910 »), et un point de couleur pour chaque autre type d'apport */
  function etiquette(n) {
    const p = prim(n); if (!p) return "";
    const autres = [...new Set(n.in.filter(l => l !== p && l.type !== p.type).map(l => l.type))];
    return `<span class="kd">${esc(TYPES[p.type].court)} · ${esc(p.annee)}</span>${autres.length ? `<span class="pts">${autres.map(t => `<i class="pt t-${t}" title="${Tr("Aussi :", "Also:")} ${esc(TYPES[t].nom)}"></i>`).join("")}</span>` : ""}`;
  }
  function carte(n, fils) {
    const ap = n.in.filter(l => PAR_ID[l.de].apport).map(l => PAR_ID[l.de]);
    return `<div class="corps"><div class="ligne"><button type="button" class="carte" data-id="${n.id}" aria-pressed="false">
      ${n.A.file ? `<img class="ecu" src="${esc(vignette(n.A.file, 96))}" alt="" width="40" height="46" loading="lazy">` : `<span class="ecu ecu-vide" aria-hidden="true"></span>`}
      <span class="txt"><b>${esc(n.nom)}</b><span class="dt">${esc(n.dates)}</span>${etiquette(n)}</span>${n.in.length > 1 ? `<span class="nl" title="${Tr(`${n.in.length} apports dans ces armes`, `${n.in.length} contributions to these arms`)}">${n.in.length}</span>` : ""}</button>${fils.length ? `<button type="button" class="plus" data-id="${n.id}" aria-expanded="false" aria-label="${Tr("Descendants de", "Descendants of")} ${esc(n.nom)}${Tr(" :", ":")} ${fils.length}">${fils.length}</button>` : ""}</div>${ap.length ? `<div class="apports"><span>${Tr("avec", "with")}</span>${ap.map(a => `<button type="button" class="ap-chip" data-id="${a.id}" title="${esc(a.nom)} (${esc(a.dates)})">${a.A.file ? `<img src="${esc(vignette(a.A.file, 48))}" alt="" width="16" loading="lazy">` : ""}${esc(a.nom)}</button>`).join("")}</div>` : ""}</div>`;
  }
  function noeud(n) {
    const fils = enfants(n.id), p = prim(n);
    const types = [...new Set(n.in.map(l => l.type))].join(" ");
    return `<li class="nd${p ? " t-" + p.type : ""}" id="n-${n.id}" data-id="${n.id}" data-types="${types}">${carte(n, fils)}${fils.length ? `<ul class="fils" hidden>${fils.map(noeud).join("")}</ul>` : ""}</li>`;
  }
  $("#arbre").innerHTML = N.filter(n => !n.parent && !n.apport).map(noeud).join("");
  $("#chargement").hidden = true; $("#scene").hidden = false;

  /* ---------- le panneau ---------- */
  const mini = n => `<span class="mi">${n.A.file ? `<img src="${esc(vignette(n.A.file, 110))}" alt="" width="46" loading="lazy">` : ""}<i>${esc(n.nom)}</i></span>`;
  function blocLien(l, n) {
    const t = TYPES[l.type], de = PAR_ID[l.de], j = l.jalon ? jalonDe(l.jalon) : null, dz = l.desaccord || (j && j.desaccord);
    return `<article class="lien t-${l.type}">
      <header><span class="tag">${esc(t.nom)}</span><span class="an">${esc(l.annee)}</span><span class="de">${Tr("depuis", "from")} <button type="button" class="va" data-id="${de.id}">${esc(de.nom)}</button></span></header>
      <div class="ap">${mini(de)}<b aria-hidden="true">→</b>${mini(n)}</div>
      <p class="ef"><span>${Tr("Dans l'écu", "In the shield")}</span> ${esc(l.effet)}</p>
      ${l.pourquoi ? `<p class="pq"><span>${Tr("Pourquoi", "Why")}</span> ${esc(l.pourquoi)}</p>` : `<p class="pq lac"><span>${Tr("Pourquoi", "Why")}</span> ${Tr("Raison non établie.", "Reason not established.")}</p>`}
      ${l.lacune ? `<p class="lac2">${esc(l.lacune)}</p>` : ""}
      ${dz ? `<p class="dz"><b>${Tr("Les sources divergent.", "The sources differ.")}</b> ${esc(dz)}</p>` : ""}
      ${j ? `<details class="jal"><summary>${Tr("Ce que disent les frises", "What the timelines say")} (${esc(String(j.annee))})</summary><p><b>${esc(j.titre)}.</b> ${esc(j.texte)}</p>${j.src.length ? `<p class="s">${j.src.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(sourceLue(s.label))}</a>`).join(" · ")}</p>` : ""}<p><a href="${versLangue("lignees.html")}#${j.frise}">${Tr("Voir la frise →", "See the timeline →")}</a></p></details>` : ""}
      ${l.sources.length ? `<p class="sr">${Tr("Sources :", "Sources:")} ${lienSrc(l.sources)}</p>` : ""}
      ${l.lien ? `<p class="li"><a href="${esc(l.lien.href)}">${esc(l.lien.texte)} →</a></p>` : ""}
    </article>`;
  }
  function panneau(n) {
    const A = n.A, h = [];
    h.push(`<div class="tete">${A.file ? `<img class="fig" src="${esc(vignette(A.file, 260))}" alt="${Tr("Armoiries", "Arms")} — ${esc(n.nom)}" width="120" loading="lazy">` : ""}<div><h2>${esc(n.nom)}</h2><p class="dt">${esc(n.dates)}</p></div></div>`);
    for (const a of A.blasons) h.push(`<p class="bl">${a.quand ? `<span class="q">${esc(a.quand)}</span> ` : ""}${gu(esc(a.blasonEn || a.blason))}</p>`);
    if (!A.blasons.length) h.push(`<p class="bl vide">${Tr("Blasonnement non donné par la page lue.", "Blazon not given by the page read.")}</p>`);
    if (A.fondateur) h.push(`<p class="fo"><span>${Tr("Premier porteur", "First bearer")}</span> ${esc(A.fondateur)}${A.wiki ? ` · <a href="https://fr.wikipedia.org/wiki/${encodeURI(A.wiki)}" target="_blank" rel="noopener">${Tr("sur Wikipédia", "on French Wikipedia")}</a>` : ""}.</p>`);
    for (const t of A.notes) h.push(`<p class="no">${esc(t)}</p>`);
    if (A.src && T.sources[A.src]) h.push(`<p class="no">${Tr("Blasonnement lu dans :", "Blazon read in:")} <a href="${esc(T.sources[A.src].url)}" target="_blank" rel="noopener">${esc(sourceLue(T.sources[A.src].label))}</a>.</p>`);
    const li = [];
    if (A.lien) li.push(`<a href="${esc(A.lien)}">${esc(A.lienTxt || Tr("Voir la frise", "See the timeline"))} →</a>`);
    const a0 = A.blasons[0];
    if (a0 && a0.blason) { let ok = false; try { ok = lire_atelier(a0.blason); } catch (e) { /* le lecteur manque */ } if (ok) li.push(`<a href="${versLangue("atelier.html")}#lire=${encodeURIComponent(a0.blason)}">${Tr("Redessiner dans l'Atelier", "Redraw in the Atelier")}</a>`); }
    if (li.length) h.push(`<p class="li">${li.join(" · ")}</p>`);
    if (!n.in.length) h.push(n.apport ? Tr(`<h3>Une maison qui entre dans l'écu d'une autre</h3><p class="no">Cette maison n'a pas sa propre branche dans l'arbre : ses armes entrent dans celles d'une autre, par mariage, héritage ou union. Les passages qui en sortent sont listés plus bas.</p>`, `<h3>A house that enters another's shield</h3><p class="no">This house has no branch of its own in the tree: its arms enter those of another, by marriage, inheritance or union. The passages leading out of it are listed below.</p>`) : Tr(`<h3>Origine</h3><p class="no">Point de départ de l'arbre : les premières armes connues de cette maison (ou de ce royaume) dans les pages lues. Ce qui est antérieur aux armoiries n'y figure pas.</p>`, `<h3>Origin</h3><p class="no">Starting point of the tree: the first known arms of this house (or kingdom) in the pages read. What predates arms is not included.</p>`));
    else h.push(`<h3>${Tr("Comment ces armes sont venues", "How these arms came about")}</h3>` + n.in.map(l => blocLien(l, n)).join(""));
    if (n.out.length) h.push(`<h3>${Tr("Ce que ces armes ont transmis", "What these arms passed on")}</h3><ul class="sortie">` + n.out.map(l => `<li><span class="tg t-${l.type}">${esc(TYPES[l.type].nom)}</span> ${esc(l.annee)} → <button type="button" class="va" data-id="${l.vers}">${esc(PAR_ID[l.vers].nom)}</button></li>`).join("") + `</ul>`);
    if (A.file) h.push(`<p class="cr">${Tr("Figure :", "Figure:")} <a href="${PG}${encodeURIComponent(A.file.replace(/ /g, "_"))}" target="_blank" rel="noopener">${Tr(`« ${esc(A.file)} »`, `“${esc(A.file)}”`)}</a> — ${esc(A.auteur)}, ${A.licurl ? `<a href="${esc(A.licurl)}" target="_blank" rel="noopener">${esc(A.lic)}</a>` : esc(A.lic)}, via Wikimedia Commons.</p>`);
    return h.join("");
  }
  const nbType = {}; T.liens.forEach(l => { nbType[l.type] = (nbType[l.type] || 0) + 1; });
  function accueil() {
    $("#panneau").innerHTML = `${Tr(`<h2>Lire l'arbre</h2><p class="no">Chaque écu est un état d'armes. Son étiquette de couleur dit comment il est venu (« Mariage · 1901–1910 », « Cadette · 1858 »…) ; un point de couleur à côté signale un autre type d'apport. Cliquez l'écu pour le détail ; le nombre à sa droite déplie les armes qui en sont sorties. Un chiffre sur l'écu indique plusieurs apports ; une pastille « avec » sous un écu signale une maison qui n'a pas sa propre branche et entre dans l'écu d'une autre.</p>`, `<h2>Reading the tree</h2><p class="no">Each shield is a state of arms. Its coloured tag says how it came about (“Marriage · 1901–1910”, “Cadet · 1858”…); a coloured dot beside it signals another kind of contribution. Click the shield for details; the number to its right unfolds the arms that came out of it. A figure on the shield indicates several contributions; a “with” chip under a shield signals a house that has no branch of its own and enters another's shield.</p>`)}
      <ul class="legende">${ORDRE.filter(t => nbType[t]).map(t => `<li class="t-${t}"><b>${esc(TYPES[t].nom)}</b> <span class="n">${nbType[t]}</span><br>${esc(TYPES[t].txt)}</li>`).join("")}</ul>
      <p class="no">${Tr("Quand les sources lues ne disent pas pourquoi, le lien affiche « Raison non établie » : mieux vaut un blanc qu'une histoire inventée.", "When the sources read do not say why, the link shows “Reason not established”: better a gap than an invented story.")}</p>`;
  }

  /* ---------- déplier, choisir ---------- */
  function pousse(id, on) {
    const li = $("#n-" + id); if (!li) return;
    const ul = li.querySelector(":scope > .fils"), b = li.querySelector(":scope > .corps .plus");
    if (!ul) return;
    const v = on === undefined ? ul.hidden : on;
    ul.hidden = !v; b.setAttribute("aria-expanded", v);
  }
  const ouvreChemin = id => { for (let p = PAR_ID[id].parent; p; p = PAR_ID[p].parent) pousse(p, true); };
  const vue = $("#vue");
  function centrer(el) {
    if (!el) return;
    if (vue.scrollHeight > vue.clientHeight + 2 || vue.scrollWidth > vue.clientWidth + 2) {
      const r = el.getBoundingClientRect(), v = vue.getBoundingClientRect();
      vue.scrollBy({ left: r.left - v.left - v.width / 2 + r.width / 2, top: r.top - v.top - v.height / 2 + r.height / 2, behavior: "smooth" });
    } else el.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  let SEL = "";
  function choisir(id, centre = true) {
    const n = PAR_ID[id]; if (!n) return;
    const cible = n.apport ? PAR_ID[(n.out[0] || {}).vers] : n;     // une maison en apport n'a pas de carte : on va à la première qui la reçoit
    if (cible) ouvreChemin(cible.id);
    SEL = id;
    $$(".carte").forEach(c => { const on = c.dataset.id === id; c.classList.toggle("on", on); c.setAttribute("aria-pressed", on); c.classList.remove("lie"); });
    $$(".ap-chip").forEach(c => c.classList.toggle("on", c.dataset.id === id));
    $$(".nd.chemin").forEach(li => li.classList.remove("chemin"));
    if (!n.apport) for (let p = id; p; p = PAR_ID[p].parent) $("#n-" + p).classList.add("chemin");
    for (const l of [...n.in, ...n.out]) { const o = l.de === id ? l.vers : l.de; const c = $(`.carte[data-id="${o}"]`); if (c) c.classList.add("lie"); }
    $("#panneau").innerHTML = panneau(n); $("#panneau").scrollTop = 0;
    history.replaceState(null, "", "#" + id);
    if (centre && cible) centrer($(`.carte[data-id="${cible.id}"]`));
    if (matchMedia("(max-width:760px)").matches) $("#panneau").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  $("#arbre").addEventListener("click", e => {
    const p = e.target.closest(".plus"); if (p) { pousse(p.dataset.id); return; }
    const k = e.target.closest(".ap-chip"); if (k) { choisir(k.dataset.id); return; }
    const c = e.target.closest(".carte"); if (c) choisir(c.dataset.id, false);
  });
  $("#panneau").addEventListener("click", e => { const b = e.target.closest(".va"); if (b) choisir(b.dataset.id); });
  let tout = false;
  $("#deplie").addEventListener("click", e => { tout = !tout; N.forEach(n => pousse(n.id, tout)); e.target.textContent = tout ? Tr("Tout replier", "Fold all") : Tr("Tout déplier", "Unfold all"); });

  /* ---------- types de passage : mettre en relief ---------- */
  $("#chips").innerHTML = `<button type="button" class="chip on" data-t="" aria-pressed="true">${Tr("Tout l'arbre", "The whole tree")}</button>` + ORDRE.filter(t => nbType[t]).map(t => `<button type="button" class="chip t-${t}" data-t="${t}" aria-pressed="false"><i></i>${esc(TYPES[t].nom)} <span class="n">${nbType[t]}</span></button>`).join("");
  let SORTE = "";
  function relief() {
    if (SORTE && !tout) { tout = true; N.forEach(n => pousse(n.id, true)); $("#deplie").textContent = Tr("Tout replier", "Fold all"); }
    $$(".nd").forEach(li => li.classList.toggle("dim", !!SORTE && !li.dataset.types.split(" ").includes(SORTE)));
    $$(".chip").forEach(b => { const on = b.dataset.t === SORTE; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    $("#cpt").textContent = SORTE ? `${nbType[SORTE]} passage${nbType[SORTE] > 1 ? "s" : ""}${Tr(" :", ":")} ${TYPES[SORTE].nom.toLowerCase()}` : Tr(`${N.length} états d'armes, ${T.liens.length} passages`, `${N.length} states of arms, ${T.liens.length} passages`);
  }
  $("#chips").addEventListener("click", e => { const b = e.target.closest(".chip"); if (!b) return; SORTE = b.dataset.t; relief(); });

  /* ---------- chercher ---------- */
  const INDEX = N.map(n => ({ n, t: plie([n.nom, n.dates, ...n.A.blasons.map(b => b.blasonEn || b.blason), n.A.fondateur || "", n.apport ? Tr("apport mariage", "contribution marriage") : ""].join(" ")) }));
  const res = $("#res");
  function cherche() {
    const mots = plie($("#q").value).split(/\s+/).filter(Boolean);
    if (!mots.length) { res.hidden = true; return; }
    const dansNom = x => mots.every(m => plie(x.n.nom).includes(m));          // un nom qui contient les mots passe avant un blasonnement qui les contient
    const r = INDEX.filter(x => mots.every(m => x.t.includes(m))).sort((a, b) => dansNom(b) - dansNom(a)).slice(0, 8);
    res.innerHTML = r.length ? r.map(x => `<li><button type="button" data-id="${x.n.id}">${esc(x.n.nom)} <i>${esc(x.n.dates)}${x.n.apport ? Tr(" · par mariage", " · by marriage") : ""}</i></button></li>`).join("") : `<li class="vide">${Tr(`Rien dans l'arbre pour « ${esc($("#q").value)} ».`, `Nothing in the tree for “${esc($("#q").value)}”.`)}</li>`;
    res.hidden = false;
  }
  $("#q").addEventListener("input", cherche);
  $("#q").addEventListener("keydown", e => { if (e.key === "Escape") { res.hidden = true; } if (e.key === "Enter") { const b = $("button", res); if (b) { b.click(); e.preventDefault(); } } });
  res.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; choisir(b.dataset.id); res.hidden = true; $("#q").value = ""; });

  /* ---------- glisser pour se déplacer ---------- */
  let g = null;
  vue.addEventListener("pointerdown", e => {
    if (e.pointerType === "touch" || e.button !== 0 || e.target.closest("button,a,input")) return;
    g = { x: e.clientX, y: e.clientY, l: vue.scrollLeft, t: vue.scrollTop }; vue.setPointerCapture(e.pointerId); vue.classList.add("glisse");
  });
  vue.addEventListener("pointermove", e => { if (g) { vue.scrollLeft = g.l - (e.clientX - g.x); vue.scrollTop = g.t - (e.clientY - g.y); } });
  const lache = () => { g = null; vue.classList.remove("glisse"); };
  vue.addEventListener("pointerup", lache); vue.addEventListener("pointercancel", lache);

  /* ---------- crédits, chiffres, adresse ---------- */
  const figs = [...new Map(N.filter(n => n.A.file).map(n => [n.A.file, n.A])).values()];
  $("#credits-l").innerHTML = figs.map(A => `<li><a href="${PG}${encodeURIComponent(A.file.replace(/ /g, "_"))}" target="_blank" rel="noopener">${Tr(`« ${esc(A.file)} »`, `“${esc(A.file)}”`)}</a> — ${esc(A.auteur)}, ${A.licurl ? `<a href="${esc(A.licurl)}" target="_blank" rel="noopener">${esc(A.lic)}</a>` : esc(A.lic)}</li>`).join("");
  $("#credits summary").textContent = Tr(`Crédits des figures (${figs.length})`, `Figure credits (${figs.length})`);
  $("#credits").hidden = false;
  const avec = T.liens.filter(l => l.pourquoi).length;
  $("#facts").innerHTML = [[N.length, Tr("états d'armes", "states of arms")], [T.liens.length, "passages"], [avec, Tr("avec une raison sourcée", "with a sourced reason")], [N.filter(n => !n.parent && !n.apport).length, Tr("familles", "families")]].map(([n, l]) => `<div class="c"><span class="n">${n}</span><span class="l">${l}</span></div>`).join("");
  accueil(); relief();
  const depuisAdresse = () => { const h = decodeURIComponent(location.hash.replace(/^#/, "")); if (PAR_ID[h] && h !== SEL) choisir(h); };
  addEventListener("hashchange", depuisAdresse);
  const h0 = decodeURIComponent(location.hash.replace(/^#/, ""));
  if (PAR_ID[h0]) choisir(h0); else pousse("cap", true);          // à l'arrivée, la première branche est déployée : on voit comment ça pousse
  window.Transmission = { noeuds: N, liens: T.liens, types: TYPES };                 // pour les tests
})();
