/* L'ARMORIAL — Chronologie : une seule ligne du temps pour tout le site.

   Rien n'est écrit ici. La page lit :
   - data/frises.json, puis le fichier de chaque lignée : royaumes[].jalons (annee, label, titre, texte, desaccord, sources) ;
   - data/chronologie.json : les repères des origines et du droit, reformulés des chapitres de l'encyclopédie ;
   - data/data.json : seulement pour nommer les ouvrages que citent ces repères.
   Les jalons gardent leurs sources et leur désaccord éventuel ; chacun renvoie à sa frise (lignees.html#<frise>) ou à son chapitre.
   Adresse : chronologie.html#l=france,savoie&q=mot&d=1 (lignées, recherche, désaccords) ; #1603 mène à l'année. */
(async () => {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const plie = s => String(s).toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const get = async p => { const r = await fetch(p); if (!r.ok) throw new Error(`HTTP ${r.status} — ${p}`); return r.json(); };
  const ROMAIN = ["", "Iᵉʳ", "IIᵉ", "IIIᵉ", "IVᵉ", "Vᵉ", "VIᵉ", "VIIᵉ", "VIIIᵉ", "IXᵉ", "Xᵉ", "XIᵉ", "XIIᵉ", "XIIIᵉ", "XIVᵉ", "XVᵉ", "XVIᵉ", "XVIIᵉ", "XVIIIᵉ", "XIXᵉ", "XXᵉ", "XXIᵉ"];
  /* une couleur par lignée, assez distinctes pour se lire d'un coup d'œil ; les trois royaumes d'Espagne partagent la leur */
  const COULEUR = { france: "#20406e", bourgogne: "#6b4a8a", angleterre: "#8e1b18", ecosse: "#2f7390", portugal: "#2e7d4f", espagne: "#b8892b", savoie: "#c4572a", habsbourg: "#4b4b4b", papaute: "#7a6a3a", origines: "#a9812e", droit: "#2c2113" };

  let frises, chr, data, fichiers;
  try {
    [frises, chr, data] = await Promise.all([get("data/frises.json"), get("data/chronologie.json"), get("data/data.json")]);
    fichiers = await Promise.all(frises.frises.map(f => get(f.file)));
  } catch (e) {
    $("#chargement").textContent = `Les données n'ont pas pu être chargées (${e.message}). Cette page doit être servie par HTTP, et non ouverte depuis le disque.`;
    return;
  }

  /* ---------- rassembler les événements ---------- */
  const annee = a => parseInt(String(a).slice(0, 4), 10);
  const EV = [], LIGNEES = [];                                           // LIGNEES : { id, nom, couleur, n } dans l'ordre des chips
  const ouvrage = id => { const s = data.sources[id]; return s ? `${s.auteur}, « ${s.titre} »` : id; };
  frises.frises.forEach((f, i) => {
    const D = fichiers[i], multi = (D.royaumes || []).length > 1;
    for (const R of D.royaumes || []) {
      const id = multi ? `${f.id}-${R.id}` : f.id, nom = multi ? R.titre || R.nom : f.nom;
      LIGNEES.push({ id, nom, frise: f.id, couleur: COULEUR[f.id] || "#555", n: 0 });
      for (const j of R.jalons || []) {
        EV.push({
          an: annee(j.annee), date: typeof j.annee === "string" ? j.annee : "", label: j.label || String(annee(j.annee)),
          titre: j.titre, texte: j.texte, desaccord: j.desaccord || "",
          sources: (j.sources || []).map(s => { const x = (D.sources || {})[typeof s === "string" ? s : s.id]; return x ? { label: x.label, url: x.url } : { label: String(s) }; }),
          lignee: id, lien: `lignees.html#${f.id}`, lienTxt: "Voir la frise",
        });
      }
    }
  });
  for (const k of ["origines", "droit"]) LIGNEES.push({ id: k, nom: k === "origines" ? "Origines du blason" : "Droit du blason", couleur: COULEUR[k], n: 0, repere: true });
  for (const r of chr.reperes) EV.push({
    an: annee(r.annee), date: "", label: r.label || String(annee(r.annee)), titre: r.titre, texte: r.texte, desaccord: r.desaccord || "",
    sources: (r.sources || []).map(s => ({ label: ouvrage(s) })), lignee: r.groupe, lien: r.lien, lienTxt: "Voir le chapitre",
  });
  EV.forEach((e, i) => { e.i = i; });
  EV.sort((a, b) => a.an - b.an || (a.date || "").localeCompare(b.date || "") || a.i - b.i);
  const parId = Object.fromEntries(LIGNEES.map(l => [l.id, l]));
  EV.forEach(e => { parId[e.lignee].n++; e.cherche = plie([e.titre, e.texte, e.label, e.an, parId[e.lignee].nom, e.desaccord].join(" ")); });

  /* ---------- état : lignées retenues, recherche, désaccords ---------- */
  const ET = { l: new Set(), q: "", d: false };
  const lireAdresse = () => {
    const h = new URLSearchParams(location.hash.replace(/^#/, ""));
    ET.l = new Set((h.get("l") || "").split(",").filter(x => parId[x]));
    ET.q = h.get("q") || ""; ET.d = h.get("d") === "1";
  };
  const ecrisAdresse = () => {
    const h = new URLSearchParams();
    if (ET.l.size) h.set("l", [...ET.l].join(","));
    if (ET.q) h.set("q", ET.q);
    if (ET.d) h.set("d", "1");
    const s = h.toString();
    history.replaceState(null, "", s ? "#" + s.replace(/%2C/g, ",") : location.pathname + location.search);
  };

  /* ---------- le dessin ---------- */
  const siecleDe = an => Math.ceil(an / 100);
  const visible = e => (!ET.l.size || ET.l.has(e.lignee)) && (!ET.d || e.desaccord) && (!ET.q || ET.q.split(/\s+/).filter(Boolean).every(m => e.cherche.includes(plie(m))));
  const carte = e => {
    const L = parId[e.lignee];
    const src = e.sources.map(s => s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>` : esc(s.label)).join(" ; ");
    return `<li class="ev${e.desaccord ? " dz" : ""}" style="--c:${L.couleur}" id="ev-${e.i}" data-an="${e.an}">
      <div class="ev-an"><b>${esc(e.label)}</b></div>
      <article class="ev-c">
        <p class="ev-l"><span class="pt" aria-hidden="true"></span>${esc(L.nom)}</p>
        <h3>${esc(e.titre)}</h3>
        <p class="ev-t">${esc(e.texte)}</p>
        ${e.desaccord ? `<p class="ev-d"><b>Les sources divergent.</b> ${esc(e.desaccord)}</p>` : ""}
        <p class="ev-s">${src ? `Sources : ${src} · ` : ""}<a href="${esc(e.lien)}">${esc(e.lienTxt)} →</a></p>
      </article></li>`;
  };
  function dessine() {
    const vus = EV.filter(visible);
    const siecles = [...new Set(vus.map(e => siecleDe(e.an)))];
    $("#tl").innerHTML = vus.length ? siecles.map(s => `<section class="sc" id="siecle-${s}" aria-labelledby="h-${s}"><h2 id="h-${s}"><span>${ROMAIN[s] || s + "ᵉ"} siècle</span><small>${(n => `${n} repère${n > 1 ? "s" : ""}`)(vus.filter(e => siecleDe(e.an) === s).length)}</small></h2><ol class="tl">${vus.filter(e => siecleDe(e.an) === s).map(carte).join("")}</ol></section>`).join("")
      : `<p class="vide">Aucun repère ne répond à ces filtres. <button type="button" class="lnk" id="vide-r">Tout afficher</button></p>`;
    const nav = $("#siecles");
    nav.hidden = vus.length < 2;
    nav.innerHTML = `<span class="lab">Aller au</span>` + siecles.map(s => `<a href="#siecle-${s}" data-s="${s}">${ROMAIN[s] || s + "ᵉ"}</a>`).join("");
    $("#cpt").textContent = `${vus.length} repère${vus.length > 1 ? "s" : ""} sur ${EV.length}`;
    document.querySelectorAll(".chip[data-l]").forEach(b => { const on = ET.l.has(b.dataset.l); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    $("#chip-tout").classList.toggle("on", !ET.l.size); $("#chip-tout").setAttribute("aria-pressed", !ET.l.size);
    const v = $("#vide-r"); if (v) v.addEventListener("click", () => { ET.l.clear(); ET.q = ""; ET.d = false; $("#q").value = ""; $("#desac").checked = false; maj(); });
  }
  function maj() { dessine(); ecrisAdresse(); }

  /* ---------- les commandes ---------- */
  $("#chips").innerHTML = `<button type="button" class="chip on" id="chip-tout" aria-pressed="true">Tout</button>` + LIGNEES.map(l => `<button type="button" class="chip" data-l="${l.id}" aria-pressed="false" style="--c:${l.couleur}"><i class="pt" aria-hidden="true"></i>${esc(l.nom)} <span class="n">${l.n}</span></button>`).join("");
  $("#chips").addEventListener("click", e => {
    const b = e.target.closest(".chip"); if (!b) return;
    if (b.id === "chip-tout") ET.l.clear(); else if (ET.l.has(b.dataset.l)) ET.l.delete(b.dataset.l); else ET.l.add(b.dataset.l);
    maj();
  });
  let t = 0;
  $("#q").addEventListener("input", e => { clearTimeout(t); t = setTimeout(() => { ET.q = e.target.value.trim(); maj(); }, 160); });
  $("#desac").addEventListener("change", e => { ET.d = e.target.checked; maj(); });
  $("#siecles").addEventListener("click", e => {
    const a = e.target.closest("a"); if (!a) return;
    e.preventDefault();
    const s = $("#siecle-" + a.dataset.s); if (s) s.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth", block: "start" });
  });

  /* ---------- démarrage ---------- */
  const dem = location.hash.replace(/^#/, "");
  if (/^\d{3,4}$/.test(dem)) ET.l.clear(); else lireAdresse();
  $("#q").value = ET.q; $("#desac").checked = ET.d;
  $("#facts").innerHTML = [[EV.length, "repères datés"], [LIGNEES.filter(l => !l.repere).length, "lignées et royaumes"], [EV.filter(e => e.desaccord).length, "désaccords signalés"]].map(([n, l]) => `<div class="c"><span class="n">${n}</span><span class="l">${l}</span></div>`).join("");
  $("#chargement").hidden = true;
  dessine();
  if (/^\d{3,4}$/.test(dem)) {                                         // chronologie.html#1603 : la première ligne de l'année, ou la plus proche
    const cible = EV.find(e => e.an >= +dem) || EV[EV.length - 1], n = $("#ev-" + cible.i);
    if (n) { n.scrollIntoView({ block: "center" }); n.classList.add("flash"); }
  }
  addEventListener("hashchange", () => { if (/^\d{3,4}$/.test(location.hash.slice(1))) return; lireAdresse(); $("#q").value = ET.q; $("#desac").checked = ET.d; dessine(); });
})();
