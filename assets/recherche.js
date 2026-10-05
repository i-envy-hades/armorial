/* L'ARMORIAL — Rechercher : une recherche dans tout le site.

   Rien n'est indexé à l'avance. La page lit les fichiers de données (data.json, blasons.json, personnages.json, frises.json
   et un fichier par lignée), en tire une liste d'entrées en mémoire — type, titre, texte, adresse — et cherche
   dedans : sans accent ni majuscule, tous les mots demandés devant figurer dans la même entrée ; un mot dans le titre compte
   plus qu'un mot dans le texte. Chaque résultat mène à l'endroit où l'entrée se lit (chapitre, terme du glossaire, carte
   d'une galerie, frise).
   Adresse : recherche.html#q=lambel&t=glo (la requête, et la rubrique si on en a choisi une). */
(async () => {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const plie = s => String(s).toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").normalize("NFD").replace(/[̀-ͯ]/g, "");
  /* pliage qui garde la longueur du texte (pour retrouver, dans le texte d'origine, ce qu'on a trouvé dans sa forme pliée) */
  const plieCar = s => Array.from(String(s), c => (c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() || c)[0]).join("");
  /* les adresses du site : la même fonction que dans assets/index.js et assets/cartes.js (« œ » n'y devient pas « oe ») */
  const slug = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const get = async p => { const r = await fetch(p); if (!r.ok) throw new Error(`HTTP ${r.status} — ${p}`); return r.json(); };
  const texteDe = html => String(html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

  /* les rubriques, dans l'ordre où elles départagent deux résultats de même poids */
  const TYPES = [["glo", "Glossaire"], ["art", "Encyclopédie"], ["voc", "Vocabulaire"], ["bla", "Blasons réels"], ["per", "Personnages"], ["lig", "Lignées"], ["src", "Sources"]];
  const NOM = Object.fromEntries(TYPES);
  const RANG = Object.fromEntries(TYPES.map(([id], i) => [id, i]));

  let D, B, P, F, CAP, TR, L;
  try {
    [D, B, P, F, CAP, TR] = await Promise.all([get("data/data.json"), get("data/blasons.json"), get("data/personnages.json"), get("data/frises.json"), get("data/capetiens.json"), get("data/transmission.json")]);
    L = await Promise.all(F.frises.map(f => get(f.file)));
  } catch (e) {
    $("#chargement").textContent = `Les données n'ont pas pu être chargées (${e.message}). Cette page doit être servie par HTTP, et non ouverte depuis le disque.`;
    return;
  }

  /* ---------- la liste des entrées ---------- */
  const DOCS = [];
  const ajoute = (type, titre, texte, lien, meta = "") => DOCS.push({ type, titre, texte, lien, meta, t: plie(titre), x: plie(`${texte} ${meta}`) });

  /* adresses des articles de l'encyclopédie : la même suite que assets/index.js (adresse() de buildMain) */
  const pris = new Set([...D.sections.map(s => s.id), "glossaire", "bibliotheque"]);
  const adresse = titre => { const base = slug(titre) || "article"; let id = base, n = 2; while (pris.has(id)) id = `${base}-${n++}`; pris.add(id); return id; };
  const ancreDe = {};                                             // titre d'un article → son adresse (pour les listes de vocabulaire)
  for (const s of D.sections) {
    ajoute("art", s.title || s.label, s.lede || "", `index.html#${s.id}`, `Chapitre · ${s.label || ""}`);
    for (const a of s.articles) {
      if (a.note || !a.titre) continue;                           // un encadré n'a pas d'adresse
      const id = adresse(a.titre); ancreDe[a.titre] = id;
      ajoute("art", a.titre, texteDe(a.html), `index.html#${id}`, `Article · ${s.title || s.label || ""}`);
    }
  }
  for (const g of D.glossaire) ajoute("glo", g.terme, g.def, `index.html#${termeId(g.terme, D.glossaire)}`, "Glossaire");
  const deja = new Set(D.glossaire.map(g => plie(g.terme)));
  const vocab = (liste, article, meta) => liste.forEach(t => { if (!deja.has(plie(t.terme))) ajoute("voc", t.terme, t.def, `index.html#${ancreDe[article] || "meubles"}`, `${meta}${t.cat ? " · " + t.cat : ""}`); });
  vocab(D.attributs, "Les attributs : nommer les parties", "Attributs");
  vocab(D.positions, "Les positions : nommer l'attitude", "Positions");
  vocab(D.repertoire, "Répertoire des meubles", "Répertoire des meubles");
  for (const [id, s] of Object.entries(D.sources)) ajoute("src", s.titre, `${s.auteur}. ${s.note || ""}`, "index.html#bibliotheque", `${s.auteur}${s.annee ? " · " + s.annee : ""}`);
  for (const a of B) ajoute("bla", a.nom, [a.blason, a.porteur, a.cat].filter(Boolean).join(" · "), `blasons.html#${slug(a.nom)}`, `Blason réel · ${a.cat || ""}`);
  for (const p of P) ajoute("per", p.nom, [p.meta, p.blason, p.desc].filter(Boolean).join(" · "), `personnages.html#${slug(p.nom)}`, "Personnage");
  F.frises.forEach((f, i) => {
    const X = L[i];
    ajoute("lig", f.nom, [f.dates, f.groupe, f.mots].filter(Boolean).join(" · "), `lignees.html#${f.id}`, "Frise");
    for (const R of X.royaumes || []) if (R.titre) ajoute("lig", R.titre, [R.nom, R.lede].filter(Boolean).join(" · "), `lignees.html#${f.id}`, `Frise · ${f.nom}`);
    for (const [cle, a] of Object.entries(X.armes || {})) if (a.blason) ajoute("lig", a.nom, [a.blason, a.note].filter(Boolean).join(" · "), `lignees.html#${f.id}`, `Armes · ${f.nom}`);
    for (const R of X.royaumes || []) {
      for (const r of R.regnes || []) {
        const ar = (X.armes || {})[r.armes];
        ajoute("lig", r.nom, [r.approx || `${r.debut} – ${r.fin ?? ""}`, ar && ar.blason, r.note].filter(Boolean).join(" · "), `lignees.html#${f.id}`, `Règne · ${R.titre || f.nom}`);
      }
    }
  });
  const CAPN = Object.fromEntries(CAP.noeuds.map(n => [n.id, n])), LIGN = Object.fromEntries(F.frises.map((f, i) => [f.id, L[i]]));
  const blasonDe = ref => { const [k, i] = ref.split(":"); const a = k === "cap" ? (CAPN[i] ? { blason: CAPN[i].armes.map(x => x.blason).join(" · ") } : null) : k === "tr" ? TR.armes[i] : (LIGN[k].armes || {})[i]; return (a && a.blason) || ""; };
  for (const n of TR.noeuds) ajoute("lig", n.nom, [n.dates, blasonDe(n.ref), ...TR.liens.filter(l => l.vers === n.id).map(l => [l.effet, l.pourquoi].filter(Boolean).join(" "))].filter(Boolean).join(" · "), `transmission.html#${n.id}`, "Transmission des armes");
  const nbType = {}; DOCS.forEach(d => { nbType[d.type] = (nbType[d.type] || 0) + 1; });

  /* ---------- chercher ---------- */
  const mots = q => plie(q).split(/[^a-z0-9]+/).filter(Boolean);
  function cherche(q) {
    const ms = mots(q);
    if (!ms.length) return [];
    const phrase = ms.join(" ");
    const out = [];
    for (const d of DOCS) {
      let s = 0, tous = true;
      for (const m of ms) {
        const dansTitre = d.t.includes(m);
        if (dansTitre) s += 10 + (new RegExp(`(^|[^a-z0-9])${m}`).test(d.t) ? 6 : 0);
        else if (d.x.includes(m)) s += (new RegExp(`(^|[^a-z0-9])${m}`).test(d.x) ? 3 : 1);
        else { tous = false; break; }
      }
      if (!tous) continue;
      if (ms.length > 1 && d.t.includes(phrase)) s += 12;
      if (d.t === phrase) s += 30;
      out.push({ d, s });
    }
    return out.sort((a, b) => b.s - a.s || RANG[a.d.type] - RANG[b.d.type] || a.d.titre.localeCompare(b.d.titre, "fr")).map(r => r.d);
  }
  /* souligne dans le texte d'origine ce qu'on a trouvé (longueur conservée par plieCar) */
  function surligne(texte, ms) {
    const f = plieCar(texte), zones = [];
    for (const m of ms) for (let i = f.indexOf(m); i >= 0; i = f.indexOf(m, i + m.length)) zones.push([i, i + m.length]);
    zones.sort((a, b) => a[0] - b[0]);
    let out = "", i = 0;
    for (const [a, b] of zones) { if (a < i) { if (b > i) { out += `<mark>${esc(texte.slice(i, b))}</mark>`; i = b; } continue; } out += esc(texte.slice(i, a)) + `<mark>${esc(texte.slice(a, b))}</mark>`; i = b; }
    return out + esc(texte.slice(i));
  }
  function extrait(texte, ms) {
    const f = plieCar(texte);
    let au = -1;
    for (const m of ms) { const k = f.indexOf(m); if (k >= 0 && (au < 0 || k < au)) au = k; }
    if (au < 0) au = 0;
    const de = Math.max(0, au - 70), a = Math.min(texte.length, au + 190);
    return (de > 0 ? "… " : "") + surligne(texte.slice(de, a), ms).replace(/^\s+/, "") + (a < texte.length ? " …" : "");
  }

  /* ---------- l'affichage ---------- */
  const ET = { q: "", t: "", n: 40 };
  const lire = () => { const h = new URLSearchParams(location.hash.replace(/^#/, "")); ET.q = h.get("q") || ""; ET.t = NOM[h.get("t")] ? h.get("t") : ""; };
  const ecrire = () => { const h = new URLSearchParams(); if (ET.q) h.set("q", ET.q); if (ET.t) h.set("t", ET.t); const s = h.toString(); history.replaceState(null, "", s ? "#" + s : location.pathname + location.search); };
  function affiche() {
    const ms = mots(ET.q), tous = cherche(ET.q);
    const n = {}; tous.forEach(d => { n[d.type] = (n[d.type] || 0) + 1; });
    const liste = ET.t ? tous.filter(d => d.type === ET.t) : tous;
    $("#idees").hidden = ms.length > 0;
    $("#types").hidden = !ms.length;
    $("#types").innerHTML = ms.length ? `<button type="button" class="chip${ET.t ? "" : " on"}" data-t="" aria-pressed="${!ET.t}">Tout <span class="n">${tous.length}</span></button>` + TYPES.filter(([id]) => n[id]).map(([id, nom]) => `<button type="button" class="chip${ET.t === id ? " on" : ""}" data-t="${id}" aria-pressed="${ET.t === id}">${nom} <span class="n">${n[id]}</span></button>`).join("") : "";
    if (!ms.length) { $("#res").innerHTML = ""; $("#cpt").textContent = `${DOCS.length} entrées en mémoire, dans ${TYPES.length} rubriques.`; $("#plus-p").hidden = true; return; }
    $("#cpt").textContent = liste.length ? `${liste.length} résultat${liste.length > 1 ? "s" : ""}` : "";
    $("#res").innerHTML = liste.length ? liste.slice(0, ET.n).map(d => `<li class="r"><a class="r-t" href="${esc(d.lien)}">${surligne(d.titre, ms)}</a><span class="r-ty" data-t="${d.type}">${esc(NOM[d.type])}</span><p class="r-x">${extrait(d.texte || d.meta, ms)}</p><p class="r-m">${esc(d.meta)}</p></li>`).join("")
      : `<li class="r-vide">Rien ne correspond à « ${esc(ET.q)} ». Essayez un seul mot, ou sans accord (« lion » plutôt que « lions rampants »).</li>`;
    $("#plus-p").hidden = liste.length <= ET.n;
  }
  const maj = () => { ecrire(); affiche(); };

  /* ---------- les commandes ---------- */
  let t = 0;
  $("#q").addEventListener("input", e => { clearTimeout(t); t = setTimeout(() => { ET.q = e.target.value.trim(); ET.n = 40; maj(); }, 140); });
  $("#types").addEventListener("click", e => { const b = e.target.closest(".chip"); if (!b) return; ET.t = b.dataset.t; ET.n = 40; maj(); });
  $("#plus").addEventListener("click", () => { ET.n += 60; affiche(); });
  const IDEES = ["lion", "fleur de lis", "lambel", "chevron accompagné", "règle des émaux", "écartelé", "bordure", "Savoie", "Napoléon", "pape", "hermine", "cimier"];
  $("#sug").innerHTML = IDEES.map(x => `<button type="button" class="chip" data-q="${esc(x)}">${esc(x)}</button>`).join("");
  $("#sug").addEventListener("click", e => { const b = e.target.closest(".chip"); if (!b) return; $("#q").value = b.dataset.q; ET.q = b.dataset.q; ET.t = ""; ET.n = 40; maj(); $("#q").focus(); });

  /* ---------- démarrage ---------- */
  lire();
  const dem = new URLSearchParams(location.search).get("q");               // recherche.html?q=lion (depuis un lien extérieur)
  if (dem && !ET.q) ET.q = dem.trim();
  $("#q").value = ET.q;
  $("#chargement").hidden = true;
  $("#aide").textContent = `${DOCS.length} entrées : articles, glossaire, blasons, personnages, lignées, sources.`;
  affiche();
  addEventListener("hashchange", () => { lire(); $("#q").value = ET.q; affiche(); });
  if (!ET.q) $("#q").focus({ preventScroll: true });
  window.Recherche = { cherche: q => cherche(q).map(d => ({ type: d.type, titre: d.titre, lien: d.lien })), n: DOCS.length };      // pour les tests
})();
