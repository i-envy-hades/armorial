const FP = "https://commons.wikimedia.org/wiki/Special:FilePath/";
const PAGE = "https://commons.wikimedia.org/wiki/File:";
function src(file){ return FP + encodeURIComponent(file) + "?width=320"; }
function page(file){ return PAGE + encodeURIComponent(file); }

let ARMS, LISIBLES = new Set();                  // LISIBLES : les armes que l'Atelier sait relire (assets/lecture.js)

function srcLine(a){
  const fileLink = `<a href="${page(a.file)}" target="_blank" rel="noopener">« ${a.file} »</a>`;
  const who = a.auteur ? `${a.auteur}, ` : "";
  const licPart = a.lic
    ? `<a href="${a.licurl}" target="_blank" rel="noopener">${a.lic}</a>`
    : `licence libre — voir la page du fichier`;
  return `Illustration : ${fileLink} — ${who}${licPart}, via Wikimedia Commons. ${blLine(a)}`;
}
function blLine(a){
  const s = a.blasonSrc;
  if (!a.blason) return "Blasonnement non établi : les pages lues ne le donnent pas.";
  if (!s) return "Blasonnement : domaine public.";
  return `Blasonnement d'après <a href="${s.url}" target="_blank" rel="noopener">${s.label}</a>${s.note ? ` (${s.note})` : ""} — domaine public.`;
}
/* renvois vers le reste du site : frise de la lignée, article de l'encyclopédie */
function liens(a){
  return a.liens && a.liens.length ? `<p class="liens">${a.liens.map(l => `<a href="${l.href}">${l.t}</a>`).join("")}</p>` : "";
}
function card(a){
  const alt = a.blason ? `Armoiries — ${a.nom} : ${a.blason}` : `Armoiries — ${a.nom}`;
  return `<article class="ar" data-cat="${a.cat||''}">
    <div class="shield"><img loading="lazy" src="${src(a.file)}" alt="${alt}"></div>
    ${a.cat ? `<div class="cat">${a.cat}</div>` : ""}
    <h3>${a.nom}</h3>
    ${a.blason ? `<p class="bl">${a.blason}</p>` : ""}
    ${LISIBLES.has(a) ? lienAtelier(a) : ""}
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
  if(c) c.textContent = `${list.length} blason${list.length>1?"s":""}`;
}
function buildTools(){
  const cats=["Tous",...new Set(ARMS.map(a=>a.cat).filter(Boolean))];
  const tools=document.getElementById("tools");
  tools.innerHTML = `<span class="lab">Filtrer</span>`+
    cats.map(c=>`<button class="chip${c==="Tous"?" on":""}" data-c="${c}">${c}</button>`).join("")+
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
    const [res] = await Promise.all([fetch('data/blasons.json'), chargerLecteur().catch(() => {})]);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    ARMS = await res.json();
    LISIBLES = armesLisibles(ARMS);
  }catch(err){
    document.getElementById("grid").innerHTML =
      `<p>Les données n'ont pas pu être chargées (${err.message||err}). Cette page doit être servie par HTTP — par exemple <code>python -m http.server</code> — et non ouverte depuis le disque.</p>`;
    return;
  }
  buildTools();
  render();
  const f = document.getElementById("facts");
  if(f) f.innerHTML = `<div class="c"><span class="n">${ARMS.length}</span><span class="l">Blasons</span></div>
    <div class="c"><span class="n">${new Set(ARMS.map(a => a.cat).filter(Boolean)).size}</span><span class="l">Catégories</span></div>
    <div class="c"><span class="n">${LISIBLES.size}</span><span class="l">Relus par l'Atelier</span></div>`;
}
init();
