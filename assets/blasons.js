const FP = "https://commons.wikimedia.org/wiki/Special:FilePath/";
const PAGE = "https://commons.wikimedia.org/wiki/File:";
function src(file){ return FP + encodeURIComponent(file) + "?width=320"; }
function page(file){ return PAGE + encodeURIComponent(file); }

let ARMS, LECTURES = new Map(), LISIBLES = new Set();     // ce que le lecteur de l'Atelier fait de chaque blasonnement (assets/lecture.js), et les armes qu'il relit

function srcLine(a){
  const fileLink = `<a href="${page(a.file)}" target="_blank" rel="noopener">${Tr(`« ${a.file} »`, `“${a.file}”`)}</a>`;
  const who = a.auteur ? `${a.auteur}, ` : "";
  const licPart = a.lic
    ? `<a href="${a.licurl}" target="_blank" rel="noopener">${a.lic}</a>`
    : Tr(`licence libre — voir la page du fichier`, `free licence — see the file page`);
  return `Illustration${Tr(" :", ":")} ${fileLink} — ${who}${licPart}, via Wikimedia Commons. ${blLine(a)}`;
}
function blLine(a){
  const s = a.blasonSrc;
  if (!a.blason) return Tr("Blasonnement non établi : les pages lues ne le donnent pas.", "Blazon not established: the pages read don't give it.");
  if (!s) return Tr("Blasonnement : domaine public.", "Blazon: public domain.");
  return `${Tr("Blasonnement d'après", "Blazon translated from the French, after")} <a href="${s.url}" target="_blank" rel="noopener">${sourceLue(s.label)}</a>${s.note ? ` (${s.note})` : ""} — ${Tr("domaine public", "public domain")}.`;
}
/* renvois vers le reste du site : frise de la lignée, article de l'encyclopédie */
function liens(a){
  return a.liens && a.liens.length ? `<p class="liens">${a.liens.map(l => `<a href="${l.href}">${l.t}</a>`).join("")}</p>` : "";
}
function card(a){
  const alt = Tr("Armoiries", "Coat of arms") + ` — ${nomCarte(a)}` + (a.blason ? `${Tr(" : ", ": ")}${blasonCarte(a)}` : ""), r = LECTURES.get(a);
  return `<article class="ar" id="${slugCarte(a.nom)}" data-cat="${a.cat||''}">
    ${ecuCarte(a, "blasons", `<img loading="lazy" src="${src(a.file)}" alt="${alt}">`, LISIBLES.has(a))}
    ${a.cat ? `<div class="cat">${a.cat}</div>` : ""}
    <h3>${nomCarte(a)}</h3>
    ${a.blason ? `<p class="bl">${blasonCarte(a)}</p>` : ""}
    ${LISIBLES.has(a) ? lienAtelier(a, "blasons") : r ? buteAtelier(a, r, "blasons") : ""}
    ${a.porteur ? `<p class="po">${a.porteur}</p>` : ""}
    ${liens(a)}
    <p class="src">${srcLine(a)}</p>
  </article>`;
}
/* Les filtres et les chiffres se lisent sur les cartes de la page : ils servent aussi bien aux cartes écrites dans le HTML qu'à celles qu'on vient de construire. */
function surPlace(){
  const cartes=[...document.querySelectorAll("#grid .ar")], tools=document.getElementById("tools");
  const cats=[...new Set(cartes.map(c=>c.dataset.cat).filter(Boolean))];
  tools.innerHTML = `<span class="lab">${Tr("Filtrer", "Filter")}</span>`+
    ["Tous",...cats].map(c=>`<button class="chip${c==="Tous"?" on":""}" data-c="${c}">${c==="Tous"?Tr("Tous","All"):c}</button>`).join("")+
    `<span class="count" id="count"></span>`;
  const count=document.getElementById("count");
  const compte=n=>{ count.textContent = Tr(`${n} blason${n>1?"s":""}`, `${n} coat${n>1?"s":""} of arms`); };
  const montre=cat=>{
    let n=0;
    for(const a of cartes){ const on=cat==="Tous"||a.dataset.cat===cat; a.hidden=!on; if(on) n++; }
    compte(n);
    tools.querySelectorAll(".chip").forEach(x=>x.classList.toggle("on",x.dataset.c===cat));
  };
  tools.addEventListener("click",e=>{ const b=e.target.closest(".chip"); if(b) montre(b.dataset.c); });
  compte(cartes.length);
  /* une carte a son adresse (assets/cartes.js) : si un filtre la cache, on le lève */
  const toutes=()=>montre("Tous");
  const fin=()=>{
    const f=document.getElementById("facts");
    if(f) f.innerHTML = `<div class="c"><span class="n">${cartes.length}</span><span class="l">${Tr("Blasons", "Coats of arms")}</span></div>
    <div class="c"><span class="n">${cats.length}</span><span class="l">${Tr("Catégories", "Categories")}</span></div>
    <div class="c"><span class="n">${document.querySelectorAll("#grid .redo").length}</span><span class="l">${Tr("Relus par l'Atelier", "Read by the Atelier")}</span></div>`;
    allerCarte(toutes); addEventListener("hashchange",()=>allerCarte(toutes));
  };
  /* le bandeau se remplit après les autres scripts, comme lorsque les données arrivaient du réseau : ses chiffres ne s'animent pas */
  if(document.readyState==="loading") addEventListener("DOMContentLoaded",fin); else fin();
}
const chargeScript=s=>new Promise((ok,non)=>{ const e=document.createElement("script"); e.src=s; e.onload=ok; e.onerror=()=>non(new Error(`${s} : introuvable`)); document.head.appendChild(e); });
/* construit les cartes depuis les données : avec le lecteur, pour savoir lesquelles s'ouvrent dans l'Atelier */
async function construire(){
  const grid=document.getElementById("grid");
  grid.innerHTML="";
  try{
    await chargeScript("assets/blasonnement.js"); await chargeScript("assets/lecture.js");
    // les données du lecteur de blasonnement arrivent en même temps ; si elles manquent, la page se passe du bouton
    [ARMS] = await Promise.all([lireDonnees('data/blasons.json'), chargerLecteur().catch(() => {})]);
    LECTURES = lectures(ARMS);
    LISIBLES = new Set([...LECTURES].filter(([, r]) => r.ok).map(([a]) => a));
  }catch(err){
    grid.innerHTML =
      Tr(`<p>Les données n'ont pas pu être chargées (${err.message||err}). Cette page doit être servie par HTTP — par exemple <code>python -m http.server</code> — et non ouverte depuis le disque.</p>`, `<p>The data couldn't load (${err.message||err}). This page must be served over HTTP — for example with <code>python -m http.server</code> — not opened from disk.</p>`);
    return;
  }
  grid.innerHTML = ARMS.map(card).join("");
  surPlace();
}
/* Les cartes sont déjà dans le HTML (tools/prerendu.py) : on ne les reconstruit pas et le lecteur n'est pas chargé. Sur un téléphone, mettre 1 000 cartes en page deux fois prenait plusieurs secondes.
   « ?construire », ou un HTML sans cartes, les construit depuis les données : c'est ainsi que tools/prerendu.py obtient ce qu'il écrit. */
if(new URLSearchParams(location.search).has("construire") || !document.querySelector("#grid .ar")) construire(); else surPlace();
