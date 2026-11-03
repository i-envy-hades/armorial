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
  return `${Tr("Blasonnement d'après", "Blazon translated from the French, after")} <a href="${s.url}" target="_blank" rel="noopener">${s.label}</a>${s.note ? ` (${s.note})` : ""} — ${Tr("domaine public", "public domain")}.`;
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
let CURRENT="Tous";
function render(){
  const list = CURRENT==="Tous" ? ARMS : ARMS.filter(a=>a.cat===CURRENT);
  document.getElementById("grid").innerHTML = list.map(card).join("");
  const c=document.getElementById("count");
  if(c) c.textContent = Tr(`${list.length} blason${list.length>1?"s":""}`, `${list.length} coat${list.length>1?"s":""} of arms`);
}
function buildTools(){
  const cats=["Tous",...new Set(ARMS.map(a=>a.cat).filter(Boolean))];
  const tools=document.getElementById("tools");
  tools.innerHTML = `<span class="lab">${Tr("Filtrer", "Filter")}</span>`+
    cats.map(c=>`<button class="chip${c==="Tous"?" on":""}" data-c="${c}">${c==="Tous"?Tr("Tous","All"):c}</button>`).join("")+
    `<span class="count" id="count"></span>`;
  tools.addEventListener("click",e=>{
    const b=e.target.closest(".chip"); if(!b) return;
    CURRENT=b.dataset.c;
    [...tools.querySelectorAll(".chip")].forEach(x=>x.classList.toggle("on",x===b));
    render();
  });
}
async function init(){
  try{
    // les données du lecteur de blasonnement arrivent en même temps ; si elles manquent, la page se passe du bouton
    [ARMS] = await Promise.all([lireDonnees('data/blasons.json'), chargerLecteur().catch(() => {})]);
    LECTURES = lectures(ARMS);
    LISIBLES = new Set([...LECTURES].filter(([, r]) => r.ok).map(([a]) => a));
  }catch(err){
    document.getElementById("grid").innerHTML =
      Tr(`<p>Les données n'ont pas pu être chargées (${err.message||err}). Cette page doit être servie par HTTP — par exemple <code>python -m http.server</code> — et non ouverte depuis le disque.</p>`, `<p>The data couldn't load (${err.message||err}). This page must be served over HTTP — for example with <code>python -m http.server</code> — not opened from disk.</p>`);
    return;
  }
  buildTools();
  render();
  /* une carte a son adresse (assets/cartes.js) : si un filtre la cache, on le lève */
  const toutes = () => { CURRENT = "Tous"; document.querySelectorAll("#tools .chip").forEach(x => x.classList.toggle("on", x.dataset.c === "Tous")); render(); };
  allerCarte(toutes); addEventListener("hashchange", () => allerCarte(toutes));
  const f = document.getElementById("facts");
  if(f) f.innerHTML = `<div class="c"><span class="n">${ARMS.length}</span><span class="l">${Tr("Blasons", "Coats of arms")}</span></div>
    <div class="c"><span class="n">${new Set(ARMS.map(a => a.cat).filter(Boolean)).size}</span><span class="l">${Tr("Catégories", "Categories")}</span></div>
    <div class="c"><span class="n">${LISIBLES.size}</span><span class="l">${Tr("Relus par l'Atelier", "Read by the Atelier")}</span></div>`;
}
init();
