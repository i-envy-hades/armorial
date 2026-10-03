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

function srcTag(ids){
  if(!ids || !ids.length) return "";
  const names = [...new Set(ids.map(i=>{
    const s = DATA.sources[i];
    return s ? srcLabel(s) : i;
  }))];
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

  DATA.sections.forEach(sec=>{
    let arts = "";
    sec.articles.forEach(a=>{
      if(a.note){ arts += `<div class="article reveal">${a.html}</div>`; return; }
      let extra = "";
      if(a.diagram && DIAGRAMS[a.diagram]) extra = `<div class="ecu-diagram">${DIAGRAMS[a.diagram]()}</div>`;
      if(a.gallery) extra += `<div class="reveal">${reglesGallery(a.gallery)}</div>`;
      arts += `<div class="article reveal" id="${adresse(a.titre)}"><h3>${a.titre}</h3>${a.html}${extra}${srcTag(a.sources)}</div>`;
    });
    let gallery = sec.figure ? `<div class="reveal">${figureGallery(sec.figure)}</div>` : "";
    html += `<section class="section" id="${sec.id}">
      <p class="eyebrow">${sec.eyebrow}</p>
      <h2 class="display">${sec.title}</h2>
      <p class="lede">${sec.lede}</p>
      ${arts}
      ${gallery}
    </section>
    <hr class="ornament">`;
  });

  // ---- glossaire ----
  html += `<section class="section" id="glossaire">
    <p class="eyebrow">Répertoire</p>
    <h2 class="display">Glossaire du blason</h2>
    <p class="lede">Le vocabulaire minimal pour lire des armoiries. Utilise la recherche en haut de page.</p>
    <p class="gloss-count" id="gcount"></p>
    <dl class="glossary" id="glist"></dl>
  </section>
  <hr class="ornament">`;

  // ---- bibliothèque ----
  const books = Object.values(DATA.sources).map(s=>`
    <div class="book reveal">
      <div class="spine" aria-hidden="true"></div>
      <div>
        <h3>${s.titre}</h3>
        <div class="by">${s.auteur}</div>
        <div class="facts">${s.editeur}, ${s.annee}${s.isbn && s.isbn!=="—" ? " · ISBN "+s.isbn : ""}</div>
        <div class="kind">${s.type}</div>
        <div class="note"><p>${s.note}</p></div>
      </div>
    </div>`).join("");
  html += `<section class="section" id="bibliotheque">
    <p class="eyebrow">La bibliothèque</p>
    <h2 class="display">Les sources</h2>
    <p class="lede">Chaque ouvrage trouvé enrichit l'encyclopédie et rejoint cette étagère. C'est le cœur du projet : le savoir grandit livre après livre.</p>
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
    list.innerHTML = `<p class="gloss-empty">Aucun terme ne correspond à « ${escHtml(filter)} ». Ce mot n'est peut-être pas encore couvert — il le sera au prochain livre.</p>`;
  } else {
    list.innerHTML = items.map(g=>`<div class="gloss-item"><dt>${hl(g.terme)}</dt><dd>${hl(g.def)}</dd></div>`).join("");
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
        const a = map.get(e.target.id); if(a) a.classList.add("active");
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
  renderGlossary();
  initSpy();
  initReveal();

  /* la page se construit après coup : le navigateur a déjà manqué l'ancre de l'adresse
     (index.html#emaux), on s'y rend nous-mêmes — puis on s'y replace quand les polices ont
     fini de se charger, car elles changent la hauteur du texte au-dessus */
  if(location.hash.length > 1){
    let id = location.hash.slice(1);
    try{ id = decodeURIComponent(id); }catch(err){ /* adresse mal formée : on garde le texte tel quel */ }
    const cible = document.getElementById(id);
    if(cible){
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
