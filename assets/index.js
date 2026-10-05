/* ============================================================================
   L'ARMORIAL — page d'accueil : construit l'encyclopédie à partir de data/data.json.
   Pour étendre le contenu, voir l'en-tête d'index.html ; pour le dessin des
   figures, assets/blason.js.
   ============================================================================ */

let DATA;

/* ============================================================================
   CONSTRUCTION DE LA PAGE
   ============================================================================ */

const escHtml = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

const commonsSrc  = f => "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(f) + "?width=300";
const commonsPage = f => "https://commons.wikimedia.org/wiki/File:" + encodeURIComponent(f);

/* Figure empruntée : la licence oblige à citer fichier, auteur et licence sous l'image. */
function citedFig(im, alt, nom, en){
  return `<div class="fig">
    <div class="figimg"><img loading="lazy" src="${commonsSrc(im.file)}" alt="${alt}"></div>
    <div class="nom">${nom}</div><div class="en">${en}</div>
    <div class="credit"><a href="${commonsPage(im.file)}" target="_blank" rel="noopener">« ${im.file} »</a> — ${im.auteur}, <a href="${im.licurl}" target="_blank" rel="noopener">${im.lic}</a>, via Wikimedia Commons${im.note ? " · " + im.note : ""}</div>
  </div>`;
}

/* « Pierre Joubert » -> Joubert ; « Wikipédia (contributeurs) » -> Wikipédia */
function srcLabel(s){
  const base = s.auteur.split(/[;(]/)[0].trim() || s.auteur.trim();
  const words = base.split(/\s+/);
  const who = (words.length > 1 && words.length <= 3) ? words[words.length-1] : base;
  const an = (String(s.annee).match(/\d{4}/) || [s.annee])[0];
  return `${who} (${an})`;
}

/* une source se cite par son identifiant ("joubert1977") ou, pour une page précise, par { "id": "joubert1977", "p": "p. 34-35" } */
function srcRef(r){
  const id = typeof r === "string" ? r : r.id, p = typeof r === "string" ? "" : r.p;
  const s = DATA.sources[id];
  return (s ? srcLabel(s) : id) + (p ? ", " + p : "");
}
function srcTag(refs){
  if(!refs || !refs.length) return "";
  const names = [...new Set(refs.map(srcRef))];
  return `<div class="src-tag">Source : <b>${names.join(" · ")}</b></div>`;
}

function figureGallery(kind){
  if(kind==="tinctures"){
    const cards = DATA.tinctures.map(t=>`
      <div class="fig">
        <div><div>${shieldSwatch(t.nom,"couleur",84)}</div><div class="swlabel">Couleur</div></div>
        <div><div>${shieldSwatch(t.nom,"gravure",84)}</div><div class="swlabel">Gravure</div></div>
        <div class="meta"><div class="cat">${t.type}</div><div class="nom">${t.nom}</div><div class="en">${t.en}</div></div>
      </div>`).join("");
    return `<div class="gal tinct">${cards}</div>`;
  }
  if(kind==="partitions"){
    const cards = DATA.partitions.map(p=>`
      <div class="fig">${shieldPartition(p.kind,p.t)}<div class="nom">${p.nom}</div><div class="en">${p.en}</div></div>`).join("");
    return `<div class="gal figs">${cards}</div>`;
  }
  if(kind==="pieces"){
    const cards = DATA.pieces.map(p=>`
      <div class="fig">${shieldPiece(p.kind,p.champ,p.piece)}<div class="nom">${p.nom}</div><div class="en">${p.en}</div></div>`).join("");
    return `<div class="gal figs">${cards}</div>`;
  }
  if(kind==="meubles"){
    // un meuble porte `image` quand notre tracé ne le rendait pas : on cite alors une figure libre
    const card = m => m.image
      ? citedFig(m.image, `Meuble héraldique — ${m.nom}`, m.nom, m.en)
      : `<div class="fig">${shieldCharge(m.kind,m.champ,m.charge)}<div class="nom">${m.nom}</div><div class="en">${m.en}</div></div>`;
    const familles = [...new Set(DATA.meubles.map(m => m.cat))];
    return familles.map(f =>
      `<h4 class="galcat">${f}</h4><div class="gal figs">${DATA.meubles.filter(m => m.cat === f).map(card).join("")}</div>`
    ).join("");
  }
  if(kind==="couronnes"){
    const cards = DATA.couronnes.map(c => citedFig(c.image, `Couronne héraldique — ${c.nom}`, c.nom, c.en)).join("");
    return `<div class="gal figs">${cards}</div>`;
  }
  return "";
}

/* galeries du chapitre « Règles » : traits vierges, recoupements, courbes, alésures */
function reglesGallery(kind){
  if(kind==="traits"){
    const cards = DATA.regles.traits.map(t=>`
      <div class="fig">${shieldTraitDemo(t.dir)}<div class="nom">${t.nom}</div><div class="en">${t.en}</div></div>`).join("");
    return `<div class="gal figs">${cards}</div>`;
  }
  if(kind==="recoupements"){
    const cards = DATA.regles.recoupements.map(r=>`
      <div class="fig">${shieldRecoupement(r.kind, r.n, tinctPaint('Argent'), tinctPaint('Gueules'))}<div class="nom">${r.nom}</div><div class="en">${r.en}</div></div>`).join("");
    return `<div class="gal figs">${cards}</div>`;
  }
  if(kind==="courbes"){
    const cards = DATA.regles.courbes.map(c=>`
      <div class="fig">${shieldPartition(c.kind,["Argent","Azur"])}<div class="nom">${c.nom}</div></div>`).join("");
    return `<div class="gal figs">${cards}</div>`;
  }
  if(kind==="alesees"){
    const cards = DATA.regles.alesees.map(al=>`
      <div class="fig">${shieldPieceAlesee(al.kind, "Or", al.alesee?"Sable":"Gueules", al.alesee)}<div class="nom">${al.nom}</div></div>`).join("");
    return `<div class="gal figs">${cards}</div>`;
  }
  if(kind==="attributs" || kind==="positions"){
    return `<dl class="glossary">${DATA[kind].map(t=>
      `<div class="gloss-item"><dt>${t.terme}</dt><dd>${t.def}</dd></div>`).join("")}</dl>`;
  }
  if(kind==="repertoire"){
    const fams = [...new Set(DATA.repertoire.map(r => r.cat))];
    return fams.map(f => `<h4 class="galcat">${f}</h4><dl class="glossary">${
      DATA.repertoire.filter(r => r.cat === f).map(r =>
        `<div class="gloss-item"><dt>${r.terme}</dt><dd>${r.def}</dd></div>`).join("")}</dl>`).join("");
  }
  return "";
}

/* diagrammes appelés depuis un article par sa clé `diagram` */
const DIAGRAMS = { ecu: ecuPoints, eccl1969: ecclDiagram, empire1808: empireDiagram, suisse2013: suisseDiagram };

/* la recherche couvre le glossaire, le répertoire et les deux tables de vocabulaire ;
   en cas d'homonymie, la définition du glossaire l'emporte */
function searchPool(){
  const pool = DATA.glossaire.map(g => ({ terme: g.terme, def: g.def, src: "Glossaire" }));
  const vus = new Set(pool.map(p => p.terme.toLowerCase()));
  const ajoute = (liste, src) => liste.forEach(t => {
    if(vus.has(t.terme.toLowerCase())) return;
    vus.add(t.terme.toLowerCase());
    pool.push({ terme: t.terme, def: t.def, src: src || t.cat });
  });
  ajoute(DATA.attributs, "Attributs");
  ajoute(DATA.positions, "Positions");
  ajoute(DATA.repertoire, null);
  return pool;
}

/* « Un signe pour reconnaître le chevalier » -> un-signe-pour-reconnaitre-le-chevalier :
   l'adresse d'un article, pour qu'on puisse en partager le lien */
const slug = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");

/* bandeaux de chapitre : un décor d'ambiance par section (assets/epopee/, images générées par IA) */
const PLATES = Object.fromEntries(["origines","ecu","emaux","partitions","regles","pieces","meubles","blasonnement","ornements","droit","droit-compare","brisures","glossaire","bibliotheque"].map(k => [k, k]));
/* une miniature d'époque par chapitre, encadrée dans le bandeau : œuvres du domaine public, créditées une à une */
const PD = "domaine public";
const MINIA = {
  origines: { file: "René d'Anjou Livre des tournois France Provence XVe siècle.jpg", legende: "Cuirasse et tassettes, Livre des tournois du roi René", auteur: "Barthélemy d'Eyck", lic: "Public domain" },
  ecu: { file: "Bayeux Tapestry scene51 Battle of Hastings Norman knights and archers.jpg", legende: "Chevaliers normands, tapisserie de Bayeux (scène 51)", auteur: "photographie de Myrabella", lic: "Public domain" },
  emaux: { file: "Gelre Folio 92r.jpg", legende: "Armorial de Gelre, f. 92r", auteur: "Claes Heynensoon", lic: "Public domain" },
  partitions: { file: "Gelre Folio 67v.jpg", legende: "Armorial de Gelre, f. 67v", auteur: "Claes Heynensoon", lic: "Public domain" },
  regles: { file: "Armorial Wijnbergen.jpg", legende: "Armorial Wijnbergen", auteur: "auteur inconnu", lic: "Public domain" },
  pieces: { file: "Gelre Folio 56v.jpg", legende: "Armorial de Gelre, f. 56v : armes royales d'Angleterre et apparentées", auteur: "Claes Heynensoon", lic: "Public domain" },
  meubles: { file: "Armorial Gelre Flemish Flag.jpg", legende: "Armorial de Gelre, f. 80r : armes de provinces belges et de Flandre", auteur: "Claes Heynensoon", lic: "Public domain" },
  blasonnement: { file: "Toison d'Or (Folio 120r).jpg", legende: "Armorial de la Toison d'or, f. 120r : familles de Pologne", auteur: "Jean Le Fèvre de Saint-Remy", lic: "Public domain" },
  ornements: { file: "Wappenbuch Grünenberg 1483 - fol. 131.jpg", legende: "Armes de Bruno von Schauenburg, Wappenbuch de Grünenberg (1483)", auteur: "Konrad Grünenberg", lic: "Public domain" },
  droit: { file: "Livre des tournois du roi René offert par Louis de Gruuthuse - BNF Fr2692 f1.jpg", legende: "Livre des tournois du roi René, exemplaire de Louis de Gruuthuse, f. 1", auteur: "Maître du cardinal de Bourbon", lic: "Public domain" },
  "droit-compare": { file: "Battle of crecy froissart.jpg", legende: "La bataille de Crécy, Chroniques de Froissart", auteur: "Loyset Liédet", lic: "Public domain" },
  brisures: { file: "Froissart Battle Scene BL Arundel 67.jpg", legende: "Scène de mêlée, Chroniques de Froissart (BL Arundel 67)", auteur: "Jean Froissart (manuscrit)", lic: "Public domain" },
  glossaire: { file: "Toison d'Or (Folio 119v).jpg", legende: "Armorial de la Toison d'or, f. 119v : familles de Pologne", auteur: "Jean Le Fèvre de Saint-Remy", lic: "Public domain" },
  bibliotheque: { file: "Sacre Robert II le Pieux - Grandes Chroniques de France - BNF, FR 2615, fol.149r.jpg", legende: "Sacre de Robert II, Grandes Chroniques de France (BnF, Fr. 2615, f. 149)", auteur: "auteur inconnu", lic: "Public domain" },
};
/* chapitres ajoutés après coup : décor emprunté à un chapitre voisin, miniature propre */
Object.assign(PLATES, { alliances: "partitions", heraults: "blasons-hero", villes: "droit-compare" });
Object.assign(MINIA, {
  alliances: { file: "Stowe Armorial 2.jpg", legende: "Le Stowe Armorial (1806), composé pour la famille Temple-Grenville : une généalogie en quartiers", auteur: "P. Sonard", lic: "Public domain" },
  heraults: { file: "Montjoye Saint Denis Roy d'armes de France.jpg", legende: "« Montjoye Saint Denis », roi d'armes de France, estampe du XVIIᵉ siècle", auteur: "Stefano della Bella", lic: "Public domain" },
  villes: { file: "Armorial de la Gilde Drapière Bruxelles 02.jpg", legende: "Armorial de la gilde drapière de Bruxelles (1713-1724) : les armes de ses membres", auteur: "artiste inconnu", lic: "Public domain" },
});
const miniaHtml = id => {
  const m = MINIA[id]; if(!m) return "";
  const page = "https://commons.wikimedia.org/wiki/File:" + encodeURIComponent(m.file.replace(/ /g, "_"));
  const src = "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(m.file) + "?width=520";
  return `<figure class="minia"><img src="${src}" alt="${escHtml(m.legende)}" loading="lazy" decoding="async">
          <figcaption>${escHtml(m.legende)}<a href="${page}" target="_blank" rel="noopener">${escHtml(m.auteur)} · ${PD}</a></figcaption></figure>`;
};
const roman = n => ["","I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV","XV"][n] || String(n);
let nChap = 0;
const plate = (id, num, eyebrow, title, lede) => `<header class="plate"${PLATES[id] ? ` data-img="assets/epopee/${PLATES[id]}.jpg"` : ""}>
        <div class="plate-bg" data-parallax="0.12" aria-hidden="true"></div>
        <span class="num" aria-hidden="true">${num}</span>
        <div class="plate-in"><p class="eyebrow">${eyebrow}</p><h2 class="display">${title}</h2><p class="lede">${lede}</p></div>
        ${miniaHtml(id)}
      </header>`;

function buildMain(){
  const main = document.getElementById("main");
  let html = "";
  const pris = new Set([...DATA.sections.map(s => s.id), "glossaire", "bibliotheque"]);
  const adresse = titre => {
    const base = slug(titre) || "article";
    let id = base, n = 2;
    while(pris.has(id)) id = `${base}-${n++}`;
    pris.add(id);
    return id;
  };

  const nbMots = h => h.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  DATA.sections.forEach(sec=>{
    const num = roman(++nChap);
    let arts = "", k = 0;
    const ids = [];
    sec.articles.forEach(a=>{
      if(a.note){ arts += `<div class="callout reveal">${a.html}</div>`; return; }
      let extra = "";
      if(a.diagram && DIAGRAMS[a.diagram]) extra = `<div class="ecu-diagram">${DIAGRAMS[a.diagram]()}</div>`;
      if(a.gallery) extra += `<div class="reveal">${reglesGallery(a.gallery)}</div>`;
      const id = adresse(a.titre); k++; ids.push([id, a.titre]);
      /* un article = un <details> : le premier est ouvert, les autres se déplient ; l'adresse (#id) l'ouvre */
      arts += `<details class="article art reveal" id="${id}"${k === 1 ? " open" : ""}>
        <summary><span class="art-n">${num}.${k}</span><h3>${a.titre}</h3><span class="art-meta">${nbMots(a.html)} mots</span></summary>
        <div class="art-body">${a.html}${extra}${srcTag(a.sources)}</div></details>`;
    });
    const chips = ids.length >= 3 ? `<nav class="chips" aria-label="Dans ce chapitre"><span>Dans ce chapitre</span>${ids.map(([id, t], i) => `<a href="#${id}">${num}.${i + 1} ${t}</a>`).join("")}<button type="button" class="fold" data-fold="${sec.id}">Tout déplier</button></nav>` : "";
    let gallery = "";
    if(sec.figure){
      const n = (DATA[sec.figure] || []).length, big = n > 24;
      gallery = `<details class="art art-planche reveal"${big ? "" : " open"}>
        <summary><span class="art-n">◈</span><h3>Planche${n ? " : " + n + " figures" : " des figures"}</h3><span class="art-meta">${big ? "à déplier" : ""}</span></summary>
        <div class="art-body">${figureGallery(sec.figure)}</div></details>`;
    }
    html += `<section class="section" id="${sec.id}">
      ${plate(sec.id, num, sec.eyebrow, sec.title, sec.lede)}
      ${chips}
      ${arts}
      ${gallery}
    </section>
    <hr class="ornament">`;
  });

  // ---- glossaire ----
  html += `<section class="section" id="glossaire">
    ${plate("glossaire", "§", "Répertoire", "Glossaire du blason", "Le vocabulaire minimal pour lire des armoiries. Utilise la recherche en haut de page.")}
    <p class="gloss-count" id="gcount"></p>
    <nav class="gnav" id="gnav" aria-label="Lettres du glossaire"></nav>
    <div class="glossary" id="glist"></div>
  </section>
  <hr class="ornament">`;

  // ---- bibliothèque ----
  const types = {};
  Object.values(DATA.sources).forEach(s => { types[s.type] = (types[s.type] || 0) + 1; });
  const books = Object.values(DATA.sources).map(s=>`
    <div class="book reveal" data-type="${escHtml(s.type)}">
      <div class="spine" aria-hidden="true"></div>
      <div>
        <h3>${s.titre}</h3>
        <div class="by">${s.auteur}</div>
        <div class="facts">${s.editeur}, ${s.annee}${s.isbn && s.isbn!=="—" ? " · ISBN "+s.isbn : ""}</div>
        <div class="kind">${s.type}</div>
        <details class="book-note"><summary>Notre lecture</summary><div class="note"><p>${s.note}</p></div></details>
      </div>
    </div>`).join("");
  const filtre = `<div class="bfilter" role="group" aria-label="Filtrer les sources par genre"><button type="button" class="on" data-t="">Toutes (${Object.keys(DATA.sources).length})</button>${Object.entries(types).map(([t, c]) => `<button type="button" data-t="${escHtml(t)}">${t} (${c})</button>`).join("")}</div>`;
  html += `<section class="section" id="bibliotheque">
    ${plate("bibliotheque", "§", "La bibliothèque", "Les sources", "Chaque ouvrage trouvé enrichit l'encyclopédie et rejoint cette étagère. C'est le cœur du projet : le savoir grandit livre après livre.")}
    ${filtre}
    <div class="biblio">${books}</div>
  </section>`;

  main.innerHTML = html;
}

function buildRail(){
  const list = document.getElementById("rail-list");
  const items = DATA.sections.map(s=>`<li><a href="#${s.id}">${s.label}</a></li>`).join("")
    + `<li><a href="#glossaire">Glossaire</a></li>`
    + `<li><a href="#bibliotheque">Sources</a></li>`;
  list.innerHTML = items;
}

/* sommaire : sous le chapitre en cours, la liste de ses articles */
function fillRail(){
  document.querySelectorAll("#rail-list > li").forEach(li => {
    const id = li.querySelector("a").getAttribute("href").slice(1);
    const arts = [...document.querySelectorAll(`#${CSS.escape(id)} details.article`)];
    if(arts.length < 2) return;
    li.insertAdjacentHTML("beforeend", `<ol class="sub">${arts.map(a => `<li><a href="#${a.id}">${a.querySelector("h3").textContent}</a></li>`).join("")}</ol>`);
  });
}

/* un lien vers un article (ou vers quoi que ce soit dedans) déplie ce qui le contient */
function openFor(el){ for(let n = el; n; n = n.parentElement) if(n.tagName === "DETAILS") n.open = true; }
function wireFolds(){
  document.addEventListener("click", e => {
    const a = e.target.closest('a[href^="#"]');
    if(a){
      let id = a.getAttribute("href").slice(1);
      try{ id = decodeURIComponent(id); }catch(err){ /* adresse mal formée */ }
      const t = document.getElementById(id); if(t) openFor(t);
    }
    const f = e.target.closest(".fold");
    if(f){
      const sec = document.getElementById(f.dataset.fold), arts = [...sec.querySelectorAll("details.article")];
      const ouvrir = arts.some(d => !d.open);
      arts.forEach(d => { d.open = ouvrir; });
      f.textContent = ouvrir ? "Tout replier" : "Tout déplier";
    }
    const b = e.target.closest(".bfilter button");
    if(b){
      document.querySelectorAll(".bfilter button").forEach(x => x.classList.toggle("on", x === b));
      document.querySelectorAll(".biblio .book").forEach(k => { k.hidden = !!b.dataset.t && k.dataset.type !== b.dataset.t; });
    }
  });
  addEventListener("hashchange", () => {
    let id = location.hash.slice(1);
    try{ id = decodeURIComponent(id); }catch(err){ /* idem */ }
    const t = document.getElementById(id); if(t) openFor(t);
  });
}

function buildCounts(){
  const el = document.getElementById("counts");
  const nSrc = Object.keys(DATA.sources).length;
  const nTerms = DATA.glossaire.length + DATA.attributs.length + DATA.positions.length + DATA.repertoire.length;
  const nFig = DATA.tinctures.length + DATA.partitions.length + DATA.pieces.length + DATA.meubles.length
    + DATA.regles.traits.length + DATA.regles.recoupements.length + DATA.regles.courbes.length + DATA.regles.alesees.length;
  el.innerHTML = `
    <div class="c"><span class="n">${nSrc}</span><span class="l">Sources</span></div>
    <div class="c"><span class="n">${nTerms}</span><span class="l">Termes</span></div>
    <div class="c"><span class="n">${nFig}</span><span class="l">Figures</span></div>`;
}

/* ---- glossaire + recherche ---- */
function renderGlossary(filter=""){
  const list = document.getElementById("glist");
  const count = document.getElementById("gcount");
  const f = filter.trim().toLowerCase();
  const items = DATA.glossaire
    .slice()
    .sort((a,b)=>a.terme.localeCompare(b.terme,"fr"))
    .filter(g=> !f || g.terme.toLowerCase().includes(f) || g.def.toLowerCase().includes(f));
  const hl = (txt)=> f ? txt.replace(new RegExp("("+f.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","ig"),"<mark>$1</mark>") : txt;
  if(!items.length){
    const nav0 = document.getElementById("gnav"); if(nav0) nav0.innerHTML = "";
    list.innerHTML = `<p class="gloss-empty">Aucun terme ne correspond à « ${escHtml(filter)} ». Ce mot n'est peut-être pas encore couvert — il le sera au prochain livre.</p>`;
  } else {
    /* le glossaire ne montre une source que lorsqu'elle renvoie à une page précise */
    const pages = g => (g.sources || []).filter(r => typeof r !== "string" && r.p).map(srcRef).join(" · ");
    const lettre = t => { const c = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : "#"; };
    const groupes = {};
    items.forEach(g => (groupes[lettre(g.terme)] ||= []).push(g));
    const lettres = Object.keys(groupes).sort();
    list.innerHTML = lettres.map(L => `<dl class="gl-group" id="gl-${L}"><div class="gl-letter" aria-hidden="true">${L}</div>${groupes[L].map(g => `<div class="gloss-item" id="${termeId(g.terme, DATA.glossaire)}"><dt>${hl(g.terme)}</dt><dd>${hl(g.def)}${pages(g) ? ` <span class="gloss-src">(${pages(g)})</span>` : ""}</dd></div>`).join("")}</dl>`).join("");
    const nav = document.getElementById("gnav");
    if(nav) nav.innerHTML = lettres.map(L => `<a href="#gl-${L}">${L}<sup>${groupes[L].length}</sup></a>`).join("");
  }
  count.textContent = `${items.length} terme${items.length>1?"s":""}${f?" trouvé"+(items.length>1?"s":""):" répertoriés"}`;
}

/* ---- scroll spy ---- */
function initSpy(){
  const links = [...document.querySelectorAll(".rail a")];
  const map = new Map(links.map(a=>[a.getAttribute("href").slice(1),a]));
  const obs = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        links.forEach(l=>l.classList.remove("active"));
        const a = map.get(e.target.id);
        document.querySelectorAll(".rail li.on").forEach(x => x.classList.remove("on"));
        if(a){ a.classList.add("active"); a.parentElement.classList.add("on"); }
      }
    });
  },{rootMargin:"-45% 0px -50% 0px",threshold:0});
  document.querySelectorAll(".section").forEach(s=>obs.observe(s));
}

/* ---- reveal on scroll ---- */
function initReveal(){
  const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  const show = r => r.classList.add("in");
  if(reduce){document.querySelectorAll(".reveal").forEach(show);return;}
  const obs = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{ if(e.isIntersecting){ show(e.target); obs.unobserve(e.target);} });
  },{rootMargin:"0px 0px -8% 0px",threshold:0});
  document.querySelectorAll(".reveal").forEach(r=>{
    // Un bloc plus haut que l'écran ne peut pas s'animer utilement : on l'affiche d'emblée.
    // C'est aussi ce qui le met à l'abri du piège du seuil — son ratio d'intersection
    // plafonne à hauteur d'écran / hauteur du bloc et resterait sous tout seuil non nul.
    if(r.getBoundingClientRect().height > innerHeight) show(r);
    else obs.observe(r);
  });
}

async function init(){
  try{
    const res = await fetch('data/data.json');
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    DATA = await res.json();
  }catch(err){
    document.getElementById("main").innerHTML =
      `<section class="section"><p class="eyebrow">Erreur</p>
       <h2 class="display">Données indisponibles</h2>
       <p class="lede">Le fichier <code>data/data.json</code> n'a pas pu être chargé (${escHtml(err.message||err)}).</p>
       <p>Si cette page est ouverte directement depuis le disque, servez-la par HTTP — par exemple <code>python -m http.server</code> — car <code>fetch</code> est bloqué sur <code>file://</code>.</p></section>`;
    return;
  }

  document.body.insertAdjacentHTML("afterbegin", globalDefs());

  /* ---- boot ---- */
  const heroSvg = document.querySelector(".hero-shield");
  heroSvg.innerHTML = heroShieldInner();

  buildCounts();
  buildRail();
  buildMain();
  fillRail();
  wireFolds();
  renderGlossary();
  initSpy();
  initReveal();
  document.dispatchEvent(new Event("armorial:ready"));

  /* la page se construit après coup : le navigateur a déjà manqué l'ancre de l'adresse
     (index.html#emaux), on s'y rend nous-mêmes — puis on s'y replace quand les polices ont
     fini de se charger, car elles changent la hauteur du texte au-dessus */
  if(location.hash.length > 1){
    let id = location.hash.slice(1);
    try{ id = decodeURIComponent(id); }catch(err){ /* adresse mal formée : on garde le texte tel quel */ }
    const cible = document.getElementById(id);
    if(cible){
      openFor(cible);
      const aller = () => cible.scrollIntoView({behavior:"instant", block:"start"});   // « instant » : le CSS impose sinon un défilement doux
      const debut = performance.now();
      let libre = true;                                                                  // on ne reprend pas la main si le lecteur a commencé à défiler
      ["wheel", "touchstart", "keydown", "pointerdown"].forEach(ev => addEventListener(ev, () => { libre = false; }, {once:true, passive:true}));
      const replace = () => { if(libre && performance.now() - debut < 5000) aller(); };  // et seulement pendant les premières secondes
      aller();
      void document.body.offsetHeight;                                                   // la mise en page déclenche le chargement des polices
      document.fonts.ready.then(replace);
      addEventListener("load", replace);
    }
  }

  /* ---- recherche : menu de résultats sous le champ ---- */
  const qInput = document.getElementById("q");
  const sBox = document.getElementById("sresults");
  /* écran étroit : le champ n'a de place que pour un mot d'invite court */
  const etroit = matchMedia("(max-width:1120px)"), invite = () => { qInput.placeholder = etroit.matches ? "Rechercher…" : "Rechercher un terme du blason…"; };
  invite(); etroit.addEventListener("change", invite);
  let sActive = -1;

  function escRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }
  function mark(txt,f){ return f ? txt.replace(new RegExp("("+escRe(f)+")","ig"),"<mark>$1</mark>") : txt; }

  function runSearch(raw){
    const f = raw.trim().toLowerCase();
    renderGlossary(raw); // filtre aussi le glossaire complet, en bas
    sActive = -1;
    if(!f){ sBox.hidden = true; sBox.innerHTML = ""; qInput.setAttribute("aria-expanded","false"); return; }
    const hits = searchPool()
      .filter(g=> g.terme.toLowerCase().includes(f) || g.def.toLowerCase().includes(f))
      .sort((a,b)=>{
        const ai=a.terme.toLowerCase().startsWith(f)?0:1, bi=b.terme.toLowerCase().startsWith(f)?0:1;
        return ai-bi || a.terme.localeCompare(b.terme,"fr");
      })
      .slice(0,8);
    if(!hits.length){
      sBox.innerHTML = `<div class="sr-empty">Aucun terme ne correspond à « ${escHtml(raw)} ». Ce mot n'est peut-être pas encore couvert — il le sera au prochain livre.</div>`;
    } else {
      sBox.innerHTML = hits.map(g=>
        `<button type="button" class="sr" role="option" data-term="${escHtml(g.terme)}">
          <span class="t">${mark(g.terme,f)}</span><span class="o">${g.src}</span><span class="d">${mark(g.def,f)}</span>
        </button>`).join("");
    }
    sBox.hidden = false;
    qInput.setAttribute("aria-expanded","true");
  }

  function gotoTerm(term){
    sBox.hidden = true;
    qInput.setAttribute("aria-expanded","false");
    renderGlossary(term);
    // le terme peut vivre dans le glossaire, dans le répertoire ou dans une table de vocabulaire
    setTimeout(()=>{
      const items = [...document.querySelectorAll(".gloss-item")];
      const hit = items.find(it=> it.querySelector("dt") && it.querySelector("dt").textContent.trim().toLowerCase()===term.trim().toLowerCase());
      const cible = hit || document.getElementById("glossaire");
      if(cible) cible.scrollIntoView({behavior:"smooth", block: hit ? "center" : "start"});
      if(hit){ hit.classList.add("flash"); setTimeout(()=>hit.classList.remove("flash"),1600); }
    },120);
  }

  qInput.addEventListener("input", e=> runSearch(e.target.value));
  qInput.addEventListener("focus", e=>{ if(e.target.value.trim()) runSearch(e.target.value); });
  qInput.addEventListener("keydown", e=>{
    const opts = [...sBox.querySelectorAll(".sr")];
    if(e.key==="ArrowDown" && opts.length){ e.preventDefault(); sActive=Math.min(sActive+1,opts.length-1); }
    else if(e.key==="ArrowUp" && opts.length){ e.preventDefault(); sActive=Math.max(sActive-1,0); }
    else if(e.key==="Enter"){ e.preventDefault(); const t=(opts[sActive]||opts[0]); if(t) gotoTerm(t.dataset.term); return; }
    else if(e.key==="Escape"){ sBox.hidden=true; qInput.setAttribute("aria-expanded","false"); return; }
    else return;
    opts.forEach((o,i)=>o.classList.toggle("on", i===sActive));
  });
  sBox.addEventListener("mousedown", e=>{
    const btn = e.target.closest(".sr");
    if(btn){ e.preventDefault(); gotoTerm(btn.dataset.term); }
  });
  document.addEventListener("click", e=>{
    if(!e.target.closest(".search")){ sBox.hidden=true; qInput.setAttribute("aria-expanded","false"); }
  });
}
init();

/* impression : un <details> fermé n'imprime pas son contenu ; on ouvre tous les articles le temps de l'impression, puis on remet chacun comme il était */
let ouvertsAvantImpression = [];
addEventListener("beforeprint", () => { const tous = [...document.querySelectorAll("details.art")]; ouvertsAvantImpression = tous.filter(d => d.open); tous.forEach(d => { d.open = true; }); });
addEventListener("afterprint", () => document.querySelectorAll("details.art").forEach(d => { d.open = ouvertsAvantImpression.includes(d); }));
