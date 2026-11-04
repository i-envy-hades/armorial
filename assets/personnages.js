const FP = "https://commons.wikimedia.org/wiki/Special:FilePath/";
const PAGE = "https://commons.wikimedia.org/wiki/File:";
function src(file){ return FP + encodeURIComponent(file) + "?width=440"; }
function page(file){ return PAGE + encodeURIComponent(file); }

/* les personnages sont rangés par ce que leurs armes enseignent ; chaque groupe a sa phrase (tirée des fiches) */
const GROUPES = [
  { id: "angleterre", titre: Tr("Rois d'Angleterre : l'écu suit les prétentions", "Kings of England: the shield follows the claims"), texte: Tr("Édouard III écartèle les léopards d'Angleterre des lis de France qu'il revendique ; les autres rois sont dans la frise des rois d'Angleterre.", "Edward III quarters the lions of England with the lilies of France that he claims; the other kings are in the timeline of the kings of England.") },
  { id: "brisures", titre: Tr("Brisures : héritiers et cadets", "Differencing: heirs and younger sons"), texte: Tr("Le lambel d'argent du Prince Noir, la cotice de du Guesclin, la branche d'épine d'un Carafa sur les fasces de sa famille : une marque posée sur l'écu pour distinguer.", "The Black Prince's silver label, du Guesclin's bendlet, a Carafa's thorn branch on his family's bars: a mark placed on the shield to tell bearers apart.") },
  { id: "parlantes", titre: Tr("Armes parlantes et devises", "Canting arms and mottoes"), texte: Tr("La couleuvre (coluber) de Colbert, les cœurs et les coquilles de Jacques Cœur, le faisceau de licteur de Mazarin : des armes qui disent un nom, une origine, un programme.", "Colbert's grass snake (coluber), the hearts and scallops of Jacques Cœur, Mazarin's lictor's fasces: arms that state a name, an origin, a programme.") },
  { id: "eglise", titre: Tr("Papes et prélats", "Popes and prelates"), texte: Tr("Les armes de deux papes, Paul IV et Pie II, et de prélats de Hongrie, de Pologne et d'Espagne, avec une abbesse suédoise.", "The arms of two popes, Paul IV and Pius II, and of prelates from Hungary, Poland and Spain, with a Swedish abbess.") },
  { id: "aujourdhui", titre: Tr("Maisons royales d'aujourd'hui", "Today's royal houses"), texte: Tr("En 1972, la reine Margrethe II simplifie les armes du Danemark.", "In 1972, Queen Margrethe II simplified the arms of Denmark.") },
  { id: "nord", titre: Tr("Du Danemark à la Russie : l'écu suit la couronne", "From Denmark to Russia: the shield follows the crown"), texte: Tr("Haakon VII ne garde que le lion de Norvège ; Pierre III accole l'aigle de Russie à Holstein-Gottorp, Alexandre II ne garde que l'aigle ; les frères cadets d'Alexandre II portent une ancre, des haches ou des canons, et la bande de Bade ou une devise saxonne pour leurs épouses ; Georges de Danemark, époux d'une reine, n'ajoute rien d'anglais à son écu.", "Haakon VII keeps only the lion of Norway; Peter III sets the eagle of Russia beside Holstein-Gottorp, Alexander II keeps only the eagle; the younger brothers of Alexander II bear an anchor, axes or cannons, and the bend of Baden or a Saxon motto for their wives; George of Denmark, a queen's husband, adds nothing English to his shield.") },
  { id: "trones", titre: Tr("Un prince allemand sur un trône étranger", "A German prince on a foreign throne"), texte: Tr("Le burelé de Saxe devient un écusson sur le lion de Belgique ou un quartier de l'écu d'un prince consort ; le fuselé de Bavière se pose sur la croix de Grèce ; Frédéric V, roi de Bohême un hiver, perd son électorat ; Louise de Lorraine et René II montrent des armes mi-parties ou combinées.", "The barruly of Saxony becomes an escutcheon on the lion of Belgium or a quarter in a prince consort's shield; the fusily of Bavaria settles on the cross of Greece; Frederick V, King of Bohemia for one winter, loses his electorate; Louise of Lorraine and René II show dimidiated or combined arms.") },
  { id: "esprits", titre: Tr("Plumes, savants et chefs de guerre", "Writers, scholars and warlords"), texte: Tr("Une lance qui fait un jeu de mots avec le nom de Shakespeare, la patte de lion que Montaigne blasonne lui-même, l'épée et la couronne de Jeanne d'Arc, l'agneau pascal de Pascal, les coqs de bruyère et les licornes de Thomas More, un tiercé « emprunté » pour les de Gaulle.", "A spear that puns on the name of Shakespeare, the lion's paw that Montaigne blazons himself, the sword and crown of Joan of Arc, Pascal's paschal lamb, Thomas More's moorcocks and unicorns, a “borrowed” tierced shield for the de Gaulles.") },
  { id: "familles", titre: Tr("Familles : le même écu de génération en génération", "Families: the same shield from generation to generation"), texte: Tr("Trois FitzAlan sous un même lion d'or ; la famille Fleming, de Finlande ; Sigrid Gyllenstierna et Erik Eriksson sous une même étoile à sept rais ; le lis d'or de Gregers Matsson ; des familles d'Italie, de Pologne et de Lituanie.", "Three FitzAlans under one gold lion; the Fleming family, of Finland; Sigrid Gyllenstierna and Erik Eriksson under one seven-pointed star; Gregers Matsson's gold lily; families from Italy, Poland and Lithuania.") },
];
let PEOPLE, LECTURES = new Map(), LISIBLES = new Set(), GROUPE = "tous", REQ = "";   // ce que le lecteur de l'Atelier fait de chaque blasonnement (assets/lecture.js), et les armes qu'il relit

function card(p){
  const alt = Tr(`Armoiries de ${p.nom}`, `Coat of arms of ${nomCarte(p)}`) + (p.blason ? ` — ${blasonCarte(p)}` : ""), r = LECTURES.get(p);
  return `<article class="ar" id="${slugCarte(p.nom)}">
    ${ecuCarte(p, "personnages", `<img loading="lazy" src="${src(p.file)}" alt="${alt}"${styleFiltre(p)}>`, LISIBLES.has(p))}
    <h3>${nomCarte(p)}</h3>
    <p class="meta">${p.meta}</p>
    ${p.blason ? `<p class="bl">${blasonCarte(p)}</p>` : ""}
    ${LISIBLES.has(p) ? lienAtelier(p, "personnages") : r ? buteAtelier(p, r, "personnages") : ""}
    ${p.desc ? `<p class="desc">${p.desc}</p>` : ""}
    ${p.liens && p.liens.length ? `<p class="liens">${p.liens.map(l => `<a href="${l.href}">${l.t}</a>`).join("")}</p>` : ""}
    <p class="src">Illustration${Tr(" :", ":")} <a href="${page(p.file)}" target="_blank" rel="noopener">${Tr(`« ${p.file} »`, `“${p.file}”`)}</a> — ${p.auteur}, <a href="${p.licurl}" target="_blank" rel="noopener">${p.lic}</a>, via Wikimedia Commons${p.filtreNote ? ` ; ${p.filtreNote}` : ""}. ${blLine(p)}</p>
  </article>`;
}
function blLine(p){
  const s = p.blasonSrc;
  if (!p.blason) return Tr("Blasonnement non établi : les pages lues ne le donnent pas.", "Blazon not established: the pages read don't give it.");
  if (!s) return Tr("Blasonnement : domaine public.", "Blazon: public domain.");
  return `${Tr("Blasonnement d'après", "Blazon translated from the French, after")} <a href="${s.url}" target="_blank" rel="noopener">${sourceLue(s.label)}</a>${s.note ? ` (${s.note})` : ""} — ${Tr("domaine public", "public domain")}.`;
}
const fold = t => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function visibles(){
  const q = fold(REQ).trim();
  return PEOPLE.filter(p => (GROUPE === "tous" || p.groupe === GROUPE) && (!q || fold([p.nom, p.nomEn, p.meta, p.blason, p.blasonEn, p.desc].join(" ")).includes(q)));
}
function render(){
  const list = visibles(), grid = document.getElementById("grid"), n = document.getElementById("count");
  if(n) n.textContent = Tr(`${list.length} personnage${list.length > 1 ? "s" : ""}`, `${list.length} ${list.length > 1 ? "people" : "person"}`);
  if(!list.length){ grid.innerHTML = `<p class="gloss-empty">${Tr("Aucun personnage ne correspond. Essayez un nom, un pays, une pièce (« lion », « lambel »)…", "Nobody matches. Try a name, a country, a charge (“lion”, “label”)…")}</p>`; return; }
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
  t.innerHTML = `<label class="srch"><span class="lab">${Tr("Chercher", "Search")}</span><input id="q" type="search" placeholder="${Tr("un nom, un pays, « lion », « lambel »…", "a name, a country, “lion”, “label”…")}" autocomplete="off"></label>`
    + `<div class="chips-g"><button type="button" class="chip on" data-g="tous">${Tr("Tous", "All")} (${PEOPLE.length})</button>${GROUPES.map(g => `<button type="button" class="chip" data-g="${g.id}">${g.titre.split(/ ?: /)[0]} (${n(g.id)})</button>`).join("")}</div>`
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
    [PEOPLE] = await Promise.all([lireDonnees('data/personnages.json'), chargerLecteur().catch(() => {})]);
    LECTURES = lectures(PEOPLE);
    LISIBLES = new Set([...LECTURES].filter(([, r]) => r.ok).map(([p]) => p));
  }catch(err){
    document.getElementById("grid").innerHTML =
      Tr(`<p>Les données n'ont pas pu être chargées (${err.message||err}). Cette page doit être servie par HTTP — par exemple <code>python -m http.server</code> — et non ouverte depuis le disque.</p>`, `<p>The data couldn't load (${err.message||err}). This page must be served over HTTP — for example with <code>python -m http.server</code> — not opened from disk.</p>`);
    return;
  }
  outils();
  render();
  /* une carte a son adresse (assets/cartes.js) : si un groupe ou la recherche la cache, on les lève */
  const tous = () => { GROUPE = "tous"; REQ = ""; const q = document.getElementById("q"); if(q) q.value = ""; document.querySelectorAll("#tools .chip").forEach(x => x.classList.toggle("on", x.dataset.g === "tous")); render(); };
  allerCarte(tous); addEventListener("hashchange", () => allerCarte(tous));
  const f = document.getElementById("facts");
  if(f) f.innerHTML = `<div class="c"><span class="n">${PEOPLE.length}</span><span class="l">${Tr("Personnages", "People")}</span></div>
    <div class="c"><span class="n">${LISIBLES.size}</span><span class="l">${Tr("Relus par l'Atelier", "Read by the Atelier")}</span></div>`;
}
init();
