const FP = "https://commons.wikimedia.org/wiki/Special:FilePath/";
const PAGE = "https://commons.wikimedia.org/wiki/File:";
function src(file){ return FP + encodeURIComponent(file) + "?width=440"; }
function page(file){ return PAGE + encodeURIComponent(file); }

let PEOPLE, LISIBLES = new Set();                // LISIBLES : les armes que l'Atelier sait relire (assets/lecture.js)

function card(p){
  const alt = p.blason ? `Armoiries de ${p.nom} — ${p.blason}` : `Armoiries de ${p.nom}`;
  return `<article class="ar">
    <div class="shield"><img loading="lazy" src="${src(p.file)}" alt="${alt}"></div>
    <h3>${p.nom}</h3>
    <p class="meta">${p.meta}</p>
    ${p.blason ? `<p class="bl">${p.blason}</p>` : ""}
    ${LISIBLES.has(p) ? lienAtelier(p) : ""}
    ${p.desc ? `<p class="desc">${p.desc}</p>` : ""}
    <p class="src">Illustration : <a href="${page(p.file)}" target="_blank" rel="noopener">« ${p.file} »</a> — ${p.auteur}, <a href="${p.licurl}" target="_blank" rel="noopener">${p.lic}</a>, via Wikimedia Commons. ${blLine(p)}</p>
  </article>`;
}
function blLine(p){
  const s = p.blasonSrc;
  if (!p.blason) return "";
  if (!s) return "Blasonnement : domaine public.";
  return `Blasonnement d'après <a href="${s.url}" target="_blank" rel="noopener">${s.label}</a>${s.note ? ` (${s.note})` : ""} — domaine public.`;
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
  document.getElementById("grid").innerHTML = PEOPLE.map(card).join("");
}
init();
