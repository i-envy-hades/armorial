const FP = "https://commons.wikimedia.org/wiki/Special:FilePath/";
const PAGE = "https://commons.wikimedia.org/wiki/File:";
function src(file){ return FP + encodeURIComponent(file) + "?width=440"; }
function page(file){ return PAGE + encodeURIComponent(file); }

/* les personnages sont rangés par ce que leurs armes enseignent ; chaque groupe a sa phrase (tirée des fiches) */
const GROUPES = [
  { id: "angleterre", titre: "Rois d'Angleterre : l'écu suit les prétentions", texte: "Des trois léopards de Richard Iᵉʳ aux lis de France qu'Édouard III puis Henri VI écartèlent à ses armes ; Richard III y ajoute son emblème personnel, le sanglier blanc." },
  { id: "brisures", titre: "Brisures : héritiers et cadets", texte: "Le lambel d'argent du Prince Noir, la cotice de du Guesclin, la branche d'épine d'un Carafa sur les fasces de sa famille : une marque posée sur l'écu pour distinguer." },
  { id: "parlantes", titre: "Armes parlantes et devises", texte: "La couleuvre (coluber) de Colbert, les cœurs et les coquilles de Jacques Cœur, le faisceau de licteur de Mazarin : des armes qui disent un nom, une origine, un programme." },
  { id: "eglise", titre: "Papes et prélats", texte: "Les armes de deux papes, Paul IV et Pie II, et de prélats de Hongrie, de Pologne et d'Espagne, avec une abbesse suédoise." },
  { id: "aujourdhui", titre: "Maisons royales d'aujourd'hui", texte: "En 1972, la reine Margrethe II simplifie les armes du Danemark ; l'Afghanistan, lui, n'a qu'un emblème et non des armes blasonnées." },
  { id: "familles", titre: "Familles : le même écu de génération en génération", texte: "Trois FitzAlan sous un même lion d'or ; trois Fleming de Finlande ; Sigrid Gyllenstierna et Erik Eriksson sous une même étoile à sept rais ; des familles d'Italie, de Pologne et de Lituanie." },
];
let PEOPLE, LISIBLES = new Set(), GROUPE = "tous", REQ = "";                // LISIBLES : les armes que l'Atelier sait relire (assets/lecture.js)

function card(p){
  const alt = p.blason ? `Armoiries de ${p.nom} — ${p.blason}` : `Armoiries de ${p.nom}`;
  return `<article class="ar" id="${slugCarte(p.nom)}">
    <div class="shield"><img loading="lazy" src="${src(p.file)}" alt="${alt}"></div>
    <h3>${p.nom}</h3>
    <p class="meta">${p.meta}</p>
    ${p.blason ? `<p class="bl">${p.blason}</p>` : ""}
    ${LISIBLES.has(p) ? lienAtelier(p) : ""}
    ${p.desc ? `<p class="desc">${p.desc}</p>` : ""}
    ${p.liens && p.liens.length ? `<p class="liens">${p.liens.map(l => `<a href="${l.href}">${l.t}</a>`).join("")}</p>` : ""}
    <p class="src">Illustration : <a href="${page(p.file)}" target="_blank" rel="noopener">« ${p.file} »</a> — ${p.auteur}, <a href="${p.licurl}" target="_blank" rel="noopener">${p.lic}</a>, via Wikimedia Commons. ${blLine(p)}</p>
  </article>`;
}
function blLine(p){
  const s = p.blasonSrc;
  if (!p.blason) return "Blasonnement non établi : les pages lues ne le donnent pas.";
  if (!s) return "Blasonnement : domaine public.";
  return `Blasonnement d'après <a href="${s.url}" target="_blank" rel="noopener">${s.label}</a>${s.note ? ` (${s.note})` : ""} — domaine public.`;
}
const fold = t => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function visibles(){
  const q = fold(REQ).trim();
  return PEOPLE.filter(p => (GROUPE === "tous" || p.groupe === GROUPE) && (!q || fold([p.nom, p.meta, p.blason, p.desc].join(" ")).includes(q)));
}
function render(){
  const list = visibles(), grid = document.getElementById("grid"), n = document.getElementById("count");
  if(n) n.textContent = `${list.length} personnage${list.length > 1 ? "s" : ""}`;
  if(!list.length){ grid.innerHTML = `<p class="gloss-empty">Aucun personnage ne correspond. Essayez un nom, un pays, une pièce (« lion », « lambel »)…</p>`; return; }
  if(REQ.trim()){ grid.innerHTML = `<div class="grid-in">${list.map(card).join("")}</div>`; return; }   // en recherche, une seule grille
  grid.innerHTML = GROUPES.filter(g => list.some(p => p.groupe === g.id)).map(g => `
    <section class="gp" id="g-${g.id}">
      <header class="gp-head"><h2>${g.titre}</h2><p>${g.texte}</p></header>
      <div class="grid-in">${list.filter(p => p.groupe === g.id).map(card).join("")}</div>
    </section>`).join("");
}
function outils(){
  const t = document.getElementById("tools");
  if(!t) return;
  const n = id => PEOPLE.filter(p => p.groupe === id).length;
  t.innerHTML = `<label class="srch"><span class="lab">Chercher</span><input id="q" type="search" placeholder="un nom, un pays, « lion », « lambel »…" autocomplete="off"></label>`
    + `<div class="chips-g"><button type="button" class="chip on" data-g="tous">Tous (${PEOPLE.length})</button>${GROUPES.map(g => `<button type="button" class="chip" data-g="${g.id}">${g.titre.split(" : ")[0]} (${n(g.id)})</button>`).join("")}</div>`
    + `<span class="count" id="count"></span>`;
  t.addEventListener("click", e => {
    const b = e.target.closest(".chip"); if(!b) return;
    GROUPE = b.dataset.g;
    t.querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x === b));
    render();
  });
  t.querySelector("#q").addEventListener("input", e => { REQ = e.target.value; render(); });
}
async function init(){
  try{
    const [res] = await Promise.all([fetch('data/personnages.json'), chargerLecteur().catch(() => {})]);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    PEOPLE = await res.json();
    LISIBLES = armesLisibles(PEOPLE);
  }catch(err){
    document.getElementById("grid").innerHTML =
      `<p>Les données n'ont pas pu être chargées (${err.message||err}). Cette page doit être servie par HTTP — par exemple <code>python -m http.server</code> — et non ouverte depuis le disque.</p>`;
    return;
  }
  outils();
  render();
  /* une carte a son adresse (assets/cartes.js) : si un groupe ou la recherche la cache, on les lève */
  const tous = () => { GROUPE = "tous"; REQ = ""; const q = document.getElementById("q"); if(q) q.value = ""; document.querySelectorAll("#tools .chip").forEach(x => x.classList.toggle("on", x.dataset.g === "tous")); render(); };
  allerCarte(tous); addEventListener("hashchange", () => allerCarte(tous));
  const f = document.getElementById("facts");
  if(f) f.innerHTML = `<div class="c"><span class="n">${PEOPLE.length}</span><span class="l">Personnages</span></div>
    <div class="c"><span class="n">${LISIBLES.size}</span><span class="l">Relus par l'Atelier</span></div>`;
}
init();
