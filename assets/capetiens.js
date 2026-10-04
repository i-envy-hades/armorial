/* L'ARMORIAL — Les Capétiens : l'arbre des brisures.

   Lit data/capetiens.json (maisons et branches de la page de Wikipédia « Armorial des Capétiens » : place dans l'arbre, dates,
   premier porteur d'armes, blasonnement, figure de Commons créditée) et dessine l'arbre en listes imbriquées : rien à
   calculer, la page n'invente aucune filiation. Seule chose qui lui appartient : le surlignage de la brisure. Quand un
   blasonnement commence par les armes de France (« d'azur semé de fleurs de lis d'or », « d'azur à trois fleurs de lis d'or »),
   ce qui vient après est mis en relief, et rangé sous une sorte de brisure (bordure, lambel, bande, bâton, cotice, barre)
   d'après les mots du texte. Les écus qui ne commencent pas ainsi sont « composés » (écartelés, partis) ou « propres ».
   Adresse : capetiens.html#bourbon-conde ouvre cette branche. */
(async () => {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let D;
  try {
    const r = await fetch("data/capetiens.json");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    D = await r.json();
    await chargerLecteur().catch(() => {});            // le lecteur de blasonnement (assets/lecture.js) : sans lui, pas de bouton « Atelier »
  } catch (e) {
    $("#chargement").textContent = `Les données n'ont pas pu être chargées (${e.message}). Cette page doit être servie par HTTP, et non ouverte depuis le disque.`;
    return;
  }
  const NOEUDS = D.noeuds, PAR_ID = Object.fromEntries(NOEUDS.map(n => [n.id, n]));
  const FP = "https://commons.wikimedia.org/wiki/Special:FilePath/", PG = "https://commons.wikimedia.org/wiki/File:";
  const vignette = (f, w) => FP + encodeURIComponent(f) + "?width=" + w;

  /* ---------- lire la brisure : ce qui suit les armes de France ---------- */
  const FRANCE = /^(?:d['’]azur (?:semé de (?:fleurs de )?(?:lys|lis) d['’]or|(?:à|aux) trois fleurs de (?:lys|lis) d['’]or)|semé de France)\s*,?\s*/i;
  const SORTES = [["bordure", "Bordure", /bordure/i], ["lambel", "Lambel", /lambel/i], ["bande", "Bande", /\bbande\b/i], ["baton", "Bâton", /b[aâ]ton/i], ["cotice", "Cotice", /cotice/i], ["barre", "Barre", /\bbarre\b/i]];
  function brisure(blason) {
    const m = blason && blason.match(FRANCE);
    if (m) {
      const reste = blason.slice(m[0].length), sans = reste.replace(/\b(?:péri[e]? )?en (?:bande|barre)\b/gi, ""),         // « cotice en bande » : la cotice, non la bande
        tags = SORTES.filter(([, , re]) => re.test(sans)).map(([id]) => id);
      return { base: m[0].replace(/[\s,]+$/, ""), reste, tags: tags.length ? tags : reste ? ["autre"] : [] };
    }
    if (!blason) return { base: "", reste: "", tags: [] };
    if (/\bd['’]azur\b.*\b(?:lys|lis)\b/i.test(blason) || /^[ée]cartel[ée]|^parti|^coup[ée]/i.test(blason)) return { base: "", reste: blason, tags: ["composees"] };
    return { base: "", reste: blason, tags: ["propres"] };
  }
  const etat = n => brisure((n.armes[0] || {}).blason);
  NOEUDS.forEach(n => { n.lu = etat(n); });

  /* ---------- l'arbre ---------- */
  const enfants = id => NOEUDS.filter(n => n.parent === id);
  const surligne = (b, lu) => lu.base ? esc(lu.base) + (lu.reste ? `, <mark>${esc(lu.reste)}</mark>` : "") : esc(b);
  const dateTxt = n => n.dates ? `<span class="dt">${esc(n.dates)}</span>` : "";
  function carte(n) {
    const a = n.armes[0], lu = n.lu;
    const resume = n.idem ? `<span class="br idem">Mêmes armes que la maison, ci-dessus.</span>`
      : a ? `<span class="br">${a.quand ? `<i>${esc(a.quand)} :</i> ` : ""}${surligne(a.blason, lu)}</span>` : `<span class="br vide">Blasonnement non donné par la page lue.</span>`;
    return `<button type="button" class="carte" aria-expanded="false" aria-controls="d-${n.id}" data-id="${n.id}">
      ${n.file && !n.idem ? `<img class="ecu" src="${esc(vignette(n.file, 120))}" alt="" width="48" height="53" loading="lazy">` : `<span class="ecu ecu-vide" aria-hidden="true"></span>`}
      <span class="txt"><b>${esc(n.nom)}</b>${dateTxt(n)}${resume}</span></button>`;
  }
  function detail(n) {
    const lu = n.lu, h = [];
    if (n.file && !n.idem) h.push(`<div class="fig"><img src="${esc(vignette(n.file, 260))}" alt="Armoiries — ${esc(n.nom)}" width="150" loading="lazy"></div>`);
    h.push(`<div class="corps">`);
    if (n.fondateur) h.push(`<p class="fo"><span>${n.idem ? "Même premier porteur" : "Premier porteur"}</span> ${esc(n.fondateur)}${n.wiki ? ` · <a href="https://fr.wikipedia.org/wiki/${encodeURI(n.wiki)}" target="_blank" rel="noopener">sur Wikipédia</a>` : ""}.</p>`);
    for (const a of n.armes) {
      const l = brisure(a.blason);
      h.push(`<p class="bl">${a.quand ? `<span class="q">${esc(a.quand)}</span> ` : ""}«&nbsp;${surligne(a.blason, l)}&nbsp;»</p>`);
    }
    if (!n.armes.length) h.push(`<p class="bl vide">Blasonnement non donné par la page lue.</p>`);
    if (lu.base && lu.reste) h.push(`<p class="lec"><b>À lire :</b> les armes de France (<i>${esc(lu.base.toLowerCase())}</i>), puis la marque qui distingue cette branche : <mark>${esc(lu.reste.replace(/^et\s+/i, ""))}</mark>.</p>`);
    else if (lu.tags[0] === "propres") h.push(`<p class="lec">Ces armes ne reprennent pas les lis de France : c'est un écu propre à la maison.</p>`);
    else if (lu.tags[0] === "composees") h.push(`<p class="lec">Écu composé : les armes de France y figurent avec d'autres, en quartiers ou en parti.</p>`);
    for (const t of n.notes || []) h.push(`<p class="no">${esc(t)}</p>`);
    const liens = [];
    if (n.lien) liens.push(`<a href="${esc(n.lien)}">${esc(n.lienTxt || "Voir la frise")} →</a>`);
    const a0 = n.armes[0];
    if (a0 && a0.blason) { let ok = false; try { ok = lire_atelier(a0.blason); } catch (e) { /* le lecteur manque */ } if (ok) liens.push(`<a href="atelier.html#lire=${encodeURIComponent(a0.blason)}">Redessiner dans l'Atelier</a>`); }
    if (liens.length) h.push(`<p class="li">${liens.join(" · ")}</p>`);
    if (n.file && !n.idem) h.push(`<p class="cr">Figure : <a href="${PG}${encodeURIComponent(n.file.replace(/ /g, "_"))}" target="_blank" rel="noopener">« ${esc(n.file)} »</a> — ${esc(n.auteur)}, ${n.licurl ? `<a href="${esc(n.licurl)}" target="_blank" rel="noopener">${esc(n.lic)}</a>` : esc(n.lic)}, via Wikimedia Commons.</p>`);
    h.push(`</div>`);
    return h.join("");
  }
  /* le lecteur de blasonnement de l'Atelier (lire(), dans assets/lecture.js) : le bouton « Redessiner » ne s'offre que s'il lit tout le texte */
  const lire_atelier = texte => typeof window.lire === "function" && window.lire(texte).ok;

  function noeud(n) {
    const fils = enfants(n.id);
    return `<li class="noeud" id="n-${n.id}" data-id="${n.id}" data-tags="${esc(n.lu.tags.join(" "))}">${carte(n)}<div class="detail" id="d-${n.id}" hidden>${detail(n)}</div>${fils.length ? `<ul>${fils.map(noeud).join("")}</ul>` : ""}</li>`;
  }
  const racine = NOEUDS.find(n => !n.parent);
  $("#arbre").innerHTML = `<ul class="arbre">${noeud(racine)}</ul>`;
  $("#chargement").hidden = true;

  /* ---------- crédits ---------- */
  const figs = [...new Map(NOEUDS.filter(n => n.file).map(n => [n.file, n])).values()];
  $("#credits-l").innerHTML = figs.map(n => `<li><a href="${PG}${encodeURIComponent(n.file.replace(/ /g, "_"))}" target="_blank" rel="noopener">« ${esc(n.file)} »</a> — ${esc(n.auteur)}, ${n.licurl ? `<a href="${esc(n.licurl)}" target="_blank" rel="noopener">${esc(n.lic)}</a>` : esc(n.lic)}</li>`).join("");
  $("#credits summary").textContent = `Crédits des figures (${figs.length})`;
  $("#credits").hidden = false;

  /* ---------- sortes de brisure : mettre en relief ---------- */
  const NOM = { bordure: "Bordure", lambel: "Lambel", bande: "Bande", baton: "Bâton", cotice: "Cotice", barre: "Barre", composees: "Armes composées ou mêlées", propres: "Armes sans les lis" };
  const nb = {}; NOEUDS.forEach(n => n.lu.tags.forEach(t => { nb[t] = (nb[t] || 0) + 1; }));
  const ORDRE = ["bordure", "lambel", "bande", "baton", "cotice", "barre", "composees", "propres"].filter(t => nb[t]);
  $("#chips").innerHTML = `<button type="button" class="chip on" data-t="" aria-pressed="true">Tout l'arbre</button>` + ORDRE.map(t => `<button type="button" class="chip" data-t="${t}" aria-pressed="false">${NOM[t]} <span class="n">${nb[t]}</span></button>`).join("");
  let SORTE = "";
  function relief() {
    document.querySelectorAll(".noeud").forEach(li => li.classList.toggle("dim", !!SORTE && !li.dataset.tags.split(" ").includes(SORTE)));
    document.querySelectorAll(".chip").forEach(b => { const on = b.dataset.t === SORTE; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    $("#cpt").textContent = SORTE ? `${nb[SORTE]} branche${nb[SORTE] > 1 ? "s" : ""} : ${NOM[SORTE].toLowerCase()}` : `${NOEUDS.length} maisons et branches`;
    history.replaceState(null, "", SORTE ? "#sorte=" + SORTE : location.pathname + location.search);
  }
  $("#chips").addEventListener("click", e => { const b = e.target.closest(".chip"); if (!b) return; SORTE = b.dataset.t; relief(); });

  /* ---------- déplier ---------- */
  function ouvre(id, on) {
    const c = document.querySelector(`.carte[data-id="${id}"]`), d = document.getElementById("d-" + id);
    if (!c || !d) return;
    const v = on === undefined ? d.hidden : on;
    d.hidden = !v; c.setAttribute("aria-expanded", v);
  }
  $("#arbre").addEventListener("click", e => { const c = e.target.closest(".carte"); if (c) ouvre(c.dataset.id); });
  let tout = false;
  $("#deplie").addEventListener("click", e => { tout = !tout; NOEUDS.forEach(n => ouvre(n.id, tout)); e.target.textContent = tout ? "Tout replier" : "Tout déplier"; });

  /* ---------- chiffres du bandeau, adresse ---------- */
  const brisees = NOEUDS.filter(n => n.lu.base && n.lu.reste).length;
  $("#facts").innerHTML = [[NOEUDS.length, "maisons et branches"], [brisees, "armes brisées de France"], [ORDRE.filter(t => SORTES.some(([id]) => id === t)).length, "sortes de brisures"]].map(([n, l]) => `<div class="c"><span class="n">${n}</span><span class="l">${l}</span></div>`).join("");
  const h = decodeURIComponent(location.hash.replace(/^#/, ""));
  if (h.startsWith("sorte=") && nb[h.slice(6)]) SORTE = h.slice(6);
  relief();
  if (PAR_ID[h]) { ouvre(h, true); const li = document.getElementById("n-" + h); if (li) { li.scrollIntoView({ block: "center" }); li.classList.add("flash"); } }
  window.Capetiens = { noeuds: NOEUDS, brisure };                          // pour les tests
})();
