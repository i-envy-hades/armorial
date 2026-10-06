/* L'ARMORIAL — rendu héraldique partagé (encyclopédie, atelier).
   Lit le global DATA (data/data.json) au moment de l'appel. */

/* ============================================================================
   RENDU HÉRALDIQUE — figures SVG dessinées à partir des données
   ============================================================================ */

/* let : l'atelier change la forme de l'écu ; l'encyclopédie garde celle-ci */
let SHIELD_D = "M18,16 L182,16 L182,120 C182,178 146,214 100,236 C54,214 18,178 18,120 Z";
const VB = "0 0 200 252";
let uid = 0;

/* trouve la couleur brute d'un émail par son nom */
function tinctColor(nom){
  const t = DATA.tinctures.find(x=>x.nom===nom);
  if(!t){ console.warn(`[armorial] émail inconnu : « ${nom} »`); return "#888"; }
  return t.color;
}

/* remplissage « peint » : métaux en dégradé, fourrures en semis, couleurs à plat */
function tinctPaint(nom){
  const t = DATA.tinctures.find(x=>x.nom===nom);
  if(!t){ console.warn(`[armorial] émail inconnu : « ${nom} »`); return "#888"; }
  if(t.hatch==="ermine") return "url(#h-ermine)";
  if(t.hatch==="vair")   return "url(#h-vair)";
  if(nom==="Or")     return "url(#m-or)";
  if(nom==="Argent") return "url(#m-argent)";
  return t.color;
}

function ermineSpot(cx,cy){
  return `<g transform="translate(${cx},${cy})" fill="#1a1712">
    <circle cx="0" cy="-7" r="1.7"/><circle cx="-3.2" cy="-4.6" r="1.7"/><circle cx="3.2" cy="-4.6" r="1.7"/>
    <path d="M0,-3.4 C-1.2,0 -3,4 -5.2,8.4 L-2.3,6.6 L0,9.6 L2.3,6.6 L5.2,8.4 C3,4 1.2,0 0,-3.4 Z"/>
  </g>`;
}

/* hachures de gravure et fourrures ; ids globaux, émis une seule fois.
   Fourrures à l'échelle de l'écu (200 de large) : quatre mouchetures par rang, quatre cloches de vair par tire. */
function hatchPatterns(){
  return `
  <pattern id="h-dots" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="4.5" cy="4.5" r="1" fill="#1a1712"/></pattern>
  <pattern id="h-vert" width="7" height="7" patternUnits="userSpaceOnUse"><line x1="3.5" y1="0" x2="3.5" y2="7" stroke="#1a1712" stroke-width=".8"/></pattern>
  <pattern id="h-horiz" width="7" height="7" patternUnits="userSpaceOnUse"><line x1="0" y1="3.5" x2="7" y2="3.5" stroke="#1a1712" stroke-width=".8"/></pattern>
  <pattern id="h-cross" width="7" height="7" patternUnits="userSpaceOnUse"><line x1="3.5" y1="0" x2="3.5" y2="7" stroke="#1a1712" stroke-width=".8"/><line x1="0" y1="3.5" x2="7" y2="3.5" stroke="#1a1712" stroke-width=".8"/></pattern>
  <pattern id="h-bend" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0,0 L8,8" stroke="#1a1712" stroke-width=".8"/></pattern>
  <pattern id="h-bendsin" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M8,0 L0,8" stroke="#1a1712" stroke-width=".8"/></pattern>
  <pattern id="h-ermine" width="50" height="50" patternUnits="userSpaceOnUse" x="-7" y="2">
    <rect width="50" height="50" fill="#f4efe2"/>
    <g transform="scale(1.25)">${ermineSpot(10,10)}${ermineSpot(30,30)}</g>
  </pattern>
  <pattern id="h-vair" width="50" height="68" patternUnits="userSpaceOnUse" x="-7" y="16">
    <rect width="50" height="68" fill="#20406e"/>
    <path d="M0,34 L0,20 L7,12 L7,0 L25,0 L25,12 L32,20 L32,34 Z" fill="#f4efe2"/>
    <path d="M25,68 L25,54 L32,46 L32,34 L50,34 L50,46 L57,54 L57,68 Z" fill="#f4efe2"/>
    <path d="M-25,68 L-25,54 L-18,46 L-18,34 L0,34 L0,46 L7,54 L7,68 Z" fill="#f4efe2"/>
  </pattern>`;
}

/* défs partagées par tous les écus ; insérées une seule fois dans le document */
function globalDefs(){
  return `<svg width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute"><defs>
    <linearGradient id="m-or" x1="0" y1="0" x2=".4" y2="1">
      <stop offset="0%" stop-color="#e9d191"/><stop offset="36%" stop-color="#c49c40"/>
      <stop offset="64%" stop-color="#a9812e"/><stop offset="100%" stop-color="#dcba6b"/>
    </linearGradient>
    <linearGradient id="m-argent" x1="0" y1="0" x2=".4" y2="1">
      <stop offset="0%" stop-color="#ffffff"/><stop offset="40%" stop-color="#e6e2d8"/>
      <stop offset="68%" stop-color="#cac5b6"/><stop offset="100%" stop-color="#f2efe7"/>
    </linearGradient>
    <radialGradient id="relief" cx="38%" cy="26%" r="80%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity=".26"/>
      <stop offset="48%" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity=".32"/>
    </radialGradient>
    <pattern id="diaper" width="36" height="36" patternUnits="userSpaceOnUse">
      <g fill="none" stroke="#1a1712" stroke-width="1" stroke-linecap="round">
        <path d="M18,2 L34,18 L18,34 L2,18 Z"/>
        <path d="M18,10 C22,14 22,22 18,26 C14,22 14,14 18,10 Z"/>
        <path d="M0,0 L5,5 M36,0 L31,5 M0,36 L5,31 M36,36 L31,31"/>
      </g>
      <circle cx="18" cy="18" r="1.7" fill="#1a1712"/>
    </pattern>
    ${hatchPatterns()}
  </defs></svg>`;
}

/* finition commune : diaprure, relief, filet d'or intérieur, puis trait de contour.
   `plain` sert aux écus de gravure, qui doivent rester en noir et blanc. */
function shieldFinish(sw=2.4, plain=false){
  const painted = plain ? "" : `
    <path d="${SHIELD_D}" fill="url(#diaper)" opacity=".07"/>
    <path d="${SHIELD_D}" fill="url(#relief)"/>
    <path d="${SHIELD_D}" fill="none" stroke="url(#m-or)" stroke-width="1.1" opacity=".5" transform="translate(100,126) scale(.974) translate(-100,-126)"/>`;
  return `${painted}
    <path d="${SHIELD_D}" fill="none" stroke="#1a1712" stroke-width="${sw}"/>`;
}

/* renvoie la valeur de remplissage pour un émail, en mode 'couleur' ou 'gravure' */
function tinctFill(nom, mode){
  const t = DATA.tinctures.find(x=>x.nom===nom) || {color:"#888",hatch:"none"};
  if(mode==="couleur") return tinctPaint(nom);
  // gravure : fond parchemin clair + hachure noire
  const map = {dots:"h-dots",vert:"h-vert",horiz:"h-horiz",cross:"h-cross",bend:"h-bend",bendsin:"h-bendsin"};
  if(t.hatch==="none")   return "#f4efe2";
  if(t.hatch==="ermine") return "url(#h-ermine)";
  if(t.hatch==="vair")   return "url(#h-vair)";
  return `url(#${map[t.hatch]})`;
}

/* un écu simple rempli d'un émail (mode couleur ou gravure) */
function shieldSwatch(nom, mode, w=90){
  return `<svg viewBox="${VB}" width="${w}" role="img" aria-label="${nom} — ${mode}">
    ${mode==="gravure"?`<path d="${SHIELD_D}" fill="#f4efe2"/>`:""}
    <path d="${SHIELD_D}" fill="${tinctFill(nom,mode)}"/>
    ${shieldFinish(2.2, mode==="gravure")}
  </svg>`;
}

/* écu partitionné */
/* ---- traits : styles de la ligne de partition ---- */
function traitLineRel(style){
  switch(style){
    case "onde":    {let s="";for(let i=0;i<8;i++)s+=(i%2?"q12.5,9 25,0":"q12.5,-9 25,0");return s;}
    case "crenele": {let s="";for(let i=0;i<5;i++)s+="l0,-12 l20,0 l0,12 l20,0";return s;}
    case "denche":  {let s="";for(let i=0;i<4;i++)s+="l25,-12 l25,12";return s;}
    case "engrele": {let s="";for(let i=0;i<8;i++)s+="a12.5,9 0 0 1 25,0";return s;}
    case "cannele": {let s="";for(let i=0;i<8;i++)s+="a12.5,9 0 0 0 25,0";return s;}
    case "dancette":{let s="";for(let i=0;i<3;i++)s+="l33.34,-18 l33.33,18";return s;}
    case "nebule":  {let s="";for(let i=0;i<8;i++)s+=(i%2?"a12.5,10 0 0 1 25,0":"a12.5,10 0 0 0 25,0");return s;}
    case "vivre":   {let s="";for(let i=0;i<10;i++)s+=(i%2?"l10,10 l10,-10":"l10,-10 l10,10");return s;}
    default:        return "L200,126";
  }
}
function coupeTrait(style,a,b){
  const line = traitLineRel(style);
  return `<rect width="200" height="252" fill="${b}"/>`+
         `<path d="M0,0 L0,126 ${line} L200,0 Z" fill="${a}"/>`+
         `<path d="M0,126 ${line}" fill="none" stroke="#1a1712" stroke-width="1.2"/>`;
}
function gironne(a,b){
  const cx=100,cy=126;
  const pts=[[100,0],[200,0],[200,126],[200,252],[100,252],[0,252],[0,126],[0,0]];
  let s="";
  for(let i=0;i<8;i++){ const p1=pts[i], p2=pts[(i+1)%8];
    s+=`<path d="M${cx},${cy} L${p1[0]},${p1[1]} L${p2[0]},${p2[1]} Z" fill="${i%2?b:a}"/>`; }
  return s;
}
function shieldPartition(kind, tinc){
  const id = ++uid;
  const cid = "clip"+id;
  return `<svg viewBox="${VB}" width="120" role="img" aria-label="${kind}">
    <defs><clipPath id="${cid}"><path d="${SHIELD_D}"/></clipPath></defs>
    <g clip-path="url(#${cid})">${partitionInner(kind, tinc)}</g>
    ${shieldFinish()}
  </svg>`;
}
/* brut : les remplissages sont donnés tels quels (couleurs d'un masque, par exemple), non des noms d'émaux */
function partitionInner(kind, tinc, brut){
  const P = brut ? (x => x) : tinctPaint, a = P(tinc[0]), b = P(tinc[1]), c = tinc[2]?P(tinc[2]):a;
  let inner = "";
  switch(kind){
    case "parti": inner = `<rect x="0" y="0" width="100" height="252" fill="${a}"/><rect x="100" y="0" width="100" height="252" fill="${b}"/>`; break;
    case "coupe": inner = `<rect x="0" y="0" width="200" height="126" fill="${a}"/><rect x="0" y="126" width="200" height="126" fill="${b}"/>`; break;
    case "tranche": inner = `<rect width="200" height="252" fill="${b}"/><path d="M0,0 L200,0 L200,252 Z" fill="${a}"/>`; break;
    case "taille": inner = `<rect width="200" height="252" fill="${b}"/><path d="M200,0 L200,252 L0,252 Z" fill="${a}"/>`; break;
    case "ecartele": inner = `<rect x="0" y="0" width="100" height="126" fill="${a}"/><rect x="100" y="0" width="100" height="126" fill="${b}"/><rect x="0" y="126" width="100" height="126" fill="${b}"/><rect x="100" y="126" width="100" height="126" fill="${a}"/>`; break;
    case "sautoirpart": inner = `<rect width="200" height="252" fill="${b}"/><path d="M100,126 L0,0 L200,0 Z" fill="${a}"/><path d="M100,126 L0,252 L200,252 Z" fill="${a}"/>`; break;
    case "coupe-onde":    inner = coupeTrait("onde",a,b); break;
    case "coupe-crenele": inner = coupeTrait("crenele",a,b); break;
    case "coupe-denche":  inner = coupeTrait("denche",a,b); break;
    case "coupe-engrele": inner = coupeTrait("engrele",a,b); break;
    case "coupe-cannele": inner = coupeTrait("cannele",a,b); break;
    case "coupe-dancette": inner = coupeTrait("dancette",a,b); break;
    case "coupe-nebule": inner = coupeTrait("nebule",a,b); break;
    case "coupe-vivre": inner = coupeTrait("vivre",a,b); break;
    case "tierce-pal": inner = `<rect x="0" width="66.7" height="252" fill="${a}"/><rect x="66.7" width="66.6" height="252" fill="${b}"/><rect x="133.3" width="66.7" height="252" fill="${c}"/>`; break;
    case "tierce-fasce": inner = `<rect y="0" width="200" height="84" fill="${a}"/><rect y="84" width="200" height="84" fill="${b}"/><rect y="168" width="200" height="84" fill="${c}"/>`; break;
    case "gironne": inner = gironne(a,b); break;
  }
  return inner;
}

/* ---- écus vierges des règles (trait simple, recoupement, alésure) ---- */
function shieldBlank(inner, label){
  const id = ++uid, cid = "clb"+id;
  return `<svg viewBox="${VB}" width="120" role="img" aria-label="${label}">
    <defs><clipPath id="${cid}"><path d="${SHIELD_D}"/></clipPath></defs>
    <path d="${SHIELD_D}" fill="#f4efe2"/>
    <g clip-path="url(#${cid})">${inner}</g>
    ${shieldFinish()}
  </svg>`;
}
/* trait simple : une seule ligne rouge sur écu vierge, pour isoler la direction du trait */
function shieldTraitDemo(dir){
  let line = "";
  if(dir==="v")  line = `<line x1="100" y1="0" x2="100" y2="252"/>`;
  if(dir==="h")  line = `<line x1="0" y1="126" x2="200" y2="126"/>`;
  if(dir==="d1") line = `<line x1="0" y1="0" x2="200" y2="252"/>`;   // tranché : chef dextre → pointe senestre
  if(dir==="d2") line = `<line x1="200" y1="0" x2="0" y2="252"/>`;   // taillé : chef senestre → pointe dextre
  return shieldBlank(`<g stroke="#8e1b18" stroke-width="4" stroke-linecap="round">${line}</g>`, "trait "+dir);
}
/* ---- fleur de lis du bandeau ----
   Tracés de « Meuble héraldique Fleur de lys.svg » (Yorick, Projet:Blasons, CC BY-SA 3.0),
   repris tels quels et ramenés dans le repère de l'écu ; seules les couleurs changent.
   Crédit affiché sous l'écu du bandeau. Le groupe interne porte la transformation :
   l'animation CSS de .charge écraserait un attribut transform posé sur le même élément. */
function fleurDeLisPaths(){
  return `<g transform="translate(38.84,36.95) scale(.172) translate(-3.914,-4)" stroke-width="9">
    <path fill-rule="evenodd" d="M 407.02914,608.69929 C 408.45371,546.74328 423.7803,489.15982 452.31871,434.59069 C 527.03313,277.40489 755.23905,281.15895 704.93393,473.402 C 686.39707,544.24137 623.42532,585.87586 548.61507,593.01701 C 554.01466,574.35164 583.71536,508.36456 559.73954,495.45545 C 521.40138,496.90385 473.7952,563.16055 462.34672,594.75617 C 460.69402,599.29227 461.15631,604.53418 459.31088,608.99624"/>
    <g transform="translate(-38.53215,-44.5769)">
      <path fill-rule="evenodd" d="M 350.52292,657.37224 C 349.09835,595.41623 333.77176,537.83277 305.23335,483.26364 C 230.51893,326.07784 2.3130139,329.8319 52.618133,522.07495 C 71.154997,592.91432 134.12674,634.54881 208.93699,641.68996 C 203.5374,623.02459 173.8367,557.03751 197.81252,544.1284 C 236.15068,545.5768 283.75686,611.8335 295.20534,643.42912 C 296.85804,647.96522 296.39575,653.20713 298.24118,657.66919"/>
      <path d="M 393.6259,57.12017 C 314.9116,141.96961 262.06129,240.08175 284.84465,355.15142 C 297.41422,418.63533 327.88647,477.43115 349.3759,538.58892 C 362.81238,576.95877 366.24813,617.04065 364.65715,657.37017 L 431.4384,657.37017 C 428.24189,616.744 435.24511,577.37193 446.71965,538.58892 C 467.19384,477.05062 498.34544,418.68339 511.2509,355.15142 C 535.37892,236.37223 478.74399,146.7919 402.8134,57.49517 L 398.17297,51.576902 L 393.6259,57.12017 z"/>
      <path fill-rule="evenodd" d="M 331.34465,704.40142 C 317.38299,743.53144 260.45647,815.19349 230.21965,835.62017 C 222.37748,840.91802 267.70602,832.5686 288.0009,828.12017 C 314.61991,822.28553 349.21835,793.92258 348.40715,803.93267 C 348.33151,849.77093 361.21819,926.25691 394.8134,961.40142 L 397.99548,964.78902 L 401.28215,961.40142 C 434.85984,922.23047 447.51976,853.35944 447.6884,803.93267 C 446.8772,793.92258 481.47565,822.28553 508.09465,828.12017 C 528.38953,832.5686 573.71807,840.91802 565.8759,835.62017 C 535.63908,815.19349 478.74383,743.53144 464.78215,704.40142 L 331.34465,704.40142 z"/>
      <rect x="239.3521" y="655.37946" width="317.88773" height="51.503345"/>
    </g>
  </g>`;
}

/* ---- blasons vierges timbrés d'une couronne de rang ---- */
/* ============================================================================
   DIAGRAMMES DU CHAPITRE « DROIT DU BLASON »
   ============================================================================ */

/* Les ornements ecclésiastiques complets (mitre, crosse, galero à houppes) demandent
   un tracé que nos essais ne rendaient pas correctement : on emprunte ici deux figures
   libres du Projet:Blasons, créditées sous elles, comme pour le lion et l'aigle. */
const ECCL_FIGURES = [
  {
    titre: "Rome, depuis 1969",
    desc: "chapeau vert à six houppes de chaque côté et croix de procession — ni mitre ni crosse",
    file: "Template-Bishop.svg",
    auteur: "Alejandro Rojas (SajoR)",
    lic: "CC BY-SA 2.5",
    licurl: "https://creativecommons.org/licenses/by-sa/2.5/deed.fr"
  },
  {
    titre: "Cantorbéry, non concernée",
    desc: "l'Église d'Angleterre a gardé la mitre que l'instruction retirait à Rome",
    file: "External Ornaments of an Anglican Bishop.svg",
    auteur: "Tom Lemmens",
    lic: "CC BY-SA 3.0",
    licurl: "https://creativecommons.org/licenses/by-sa/3.0/deed.fr",
    note: "Le fichier est nommé « Bishop » mais sa page Commons le décrit comme les ornements d'un archevêque anglican."
  }
];
function ecclDiagram(){
  return `<div class="diagram-row">${ECCL_FIGURES.map(f => `
    <figure>
      <div class="figimg"><img loading="lazy" src="${commonsSrc(f.file)}" alt="Ornements extérieurs — ${f.titre}"></div>
      <figcaption><b>${f.titre}</b><span>${f.desc}</span></figcaption>
      <div class="credit"><a href="${commonsPage(f.file)}" target="_blank" rel="noopener">« ${f.file} »</a> — ${f.auteur}, <a href="${f.licurl}" target="_blank" rel="noopener">${f.lic}</a>, via Wikimedia Commons${f.note ? " · " + f.note : ""}</div>
    </figure>`).join("")}</div>`;
}

/* ---- meubles de l'héraldique d'Empire ---- */
function abeille(x, y, s){
  return `<g transform="translate(${x},${y}) scale(${s})" stroke="#7a5c1e" stroke-linejoin="round">
    <g fill="url(#m-or)" stroke-width="${(1.3 / s).toFixed(2)}">
      <path d="M-5,-3 C-15,-12 -20,-2 -10,4 Z"/><path d="M5,-3 C15,-12 20,-2 10,4 Z"/>
      <ellipse cx="0" cy="5" rx="5.4" ry="8.6"/><circle cx="0" cy="-6" r="3.6"/>
    </g>
    <path d="M-4.4,3 H4.4 M-4,8 H4" fill="none" stroke-width="${(1.5 / s).toFixed(2)}"/>
  </g>`;
}
function etoilePetite(x, y, s, fill, stroke){
  return `<g transform="translate(${x},${y}) scale(${s})" fill="${fill}" stroke="${stroke}" stroke-width="${(0.9 / s).toFixed(2)}">
    <path d="M0,-26 L7,-8 L26,-8 L11,4 L17,24 L0,12 L-17,24 L-11,4 L-26,-8 L-7,-8 Z"/></g>`;
}
function epeeGraphic(x, y, s, fill, stroke){
  return `<g transform="translate(${x},${y}) scale(${s})" fill="${fill}" stroke="${stroke}" stroke-width="${(1.1 / s).toFixed(2)}" stroke-linejoin="round">
    <path d="M0,-36 L4,-27 L4,9 L-4,9 L-4,-27 Z"/>
    <rect x="-13" y="9" width="26" height="4.6" rx="2.2"/>
    <rect x="-2.6" y="13.6" width="5.2" height="12" rx="2.2"/>
    <circle cx="0" cy="29" r="4.2"/></g>`;
}

/* les quatre marques de rang que 1808 fait entrer DANS l'écu */
function empireShield(kind){
  const id = ++uid, cid = "clemp" + id;
  const semeAt = [[36, 17], [78, 17], [120, 17], [162, 17], [57, 42], [99, 42], [141, 42]];
  let ins = "", lab = "";
  if(kind === "prince"){
    lab = "chef d'azur semé d'abeilles d'or";
    ins = `<rect x="0" y="0" width="200" height="58" fill="${tinctPaint('Azur')}"/>`
      + semeAt.map(([x, y]) => abeille(x, y, 0.62)).join("");
  }
  if(kind === "duc"){
    lab = "chef de gueules semé d'étoiles d'argent";
    ins = `<rect x="0" y="0" width="200" height="58" fill="${tinctPaint('Gueules')}"/>`
      + semeAt.map(([x, y]) => etoilePetite(x, y, 0.42, tinctPaint('Argent'), chgStroke('Argent'))).join("");
  }
  if(kind === "comte" || kind === "baron"){
    const t = kind === "comte" ? "Azur" : "Gueules";
    lab = `franc-quartier ${kind === "comte" ? "d'azur" : "de gueules"} à l'épée d'argent`;
    ins = `<rect x="0" y="0" width="84" height="74" fill="${tinctPaint(t)}"/>`
      + epeeGraphic(42, 37, 0.82, tinctPaint('Argent'), chgStroke('Argent'));
  }
  return `<svg viewBox="${VB}" width="108" role="img" aria-label="Écu d'or au ${lab}">
    <defs><clipPath id="${cid}"><path d="${SHIELD_D}"/></clipPath></defs>
    <path d="${SHIELD_D}" fill="${tinctPaint('Or')}"/>
    <g clip-path="url(#${cid})">${ins}</g>
    ${shieldFinish()}
  </svg>`;
}
function empireDiagram(){
  const rows = [
    ["prince", "Prince", "chef d'azur semé d'abeilles d'or"],
    ["duc", "Duc", "chef de gueules semé d'étoiles d'argent"],
    ["comte", "Comte militaire", "franc-quartier d'azur à l'épée d'argent"],
    ["baron", "Baron militaire", "franc-quartier de gueules à l'épée d'argent"]
  ];
  return `<div class="diagram-row">${rows.map(([k, t, d]) =>
    `<figure>${empireShield(k)}<figcaption><b>${t}</b><span>${d}</span></figcaption></figure>`).join("")}</div>`;
}

/* ---- la croix suisse de l'art. 1 LPAP : branches de 6 de large sur 7 de long ---- */
function swissCross(){
  const w = 36, a = 42, x0 = 100 - w / 2, y0 = 116 - w / 2 - a;
  return `M${x0},${y0} h${w} v${a} h${a} v${w} h${-a} v${a} h${-w} v${-a} h${-a} v${-w} h${a} Z`;
}
function suisseDiagram(){
  const lab = (x, y, s) => `<text x="${x}" y="${y}" text-anchor="middle" font-family="Marcellus SC,serif" font-size="17" fill="#8e1b18">${s}</text>`;
  const legal = `<svg viewBox="${VB}" width="120" role="img" aria-label="Croix blanche alésée sur fond rouge #FF0000">
    <path d="${SHIELD_D}" fill="#FF0000"/>
    <path d="${swissCross()}" fill="#fff"/>
    ${shieldFinish(2.4, true)}
  </svg>`;
  const ratio = `<svg viewBox="${VB}" width="120" role="img" aria-label="Proportions de la croix : branches de 7 pour 6 de large">
    <path d="${SHIELD_D}" fill="#f3eee0"/>
    <path d="${swissCross()}" fill="#fff" stroke="#1a1712" stroke-width="1.4"/>
    <g stroke="#cabf9f" stroke-width="1" stroke-dasharray="3 3">
      <line x1="82" y1="98" x2="82" y2="134"/><line x1="118" y1="98" x2="118" y2="134"/>
      <line x1="82" y1="98" x2="118" y2="98"/><line x1="82" y1="134" x2="118" y2="134"/>
    </g>
    <path d="M82,43 v6 M82,46 H118 M118,43 v6" fill="none" stroke="#8e1b18" stroke-width="1.4"/>
    ${lab(100, 38, "6")}${lab(100, 83, "7")}${lab(139, 122, "7")}${lab(61, 122, "7")}${lab(100, 161, "7")}${lab(100, 122, "6")}
    ${shieldFinish(2.4, true)}
  </svg>`;
  return `<div class="diagram-row">
    <figure>${legal}<figcaption><b>Art. 1 et annexe 1</b><span>croix blanche alésée sur fond rouge ; le rouge est fixé à #FF0000</span></figcaption>
      <div class="credit">Dessin de l'encyclopédie d'après le texte de l'art. 1 ; la forme de l'écu est la nôtre, non celle de l'annexe 1.</div></figure>
    <figure>${ratio}<figcaption><b>La proportion</b><span>branches égales, « d'un sixième plus longues que larges » : 7 pour 6</span></figcaption></figure>
  </div>`;
}

/* les clefs : la pose et le groupe, un écu par cas */
function clefDiagram(){
  const mini = (champ, corps, label) => {
    const id = ++uid, cid = "clclef" + id;
    return `<svg viewBox="${VB}" width="108" role="img" aria-label="${label}">
      <defs><clipPath id="${cid}"><path d="${SHIELD_D}"/></clipPath></defs>
      <path d="${SHIELD_D}" fill="${tinctPaint(champ)}"/>
      <g clip-path="url(#${cid})">${corps}</g>
      ${shieldFinish()}
    </svg>`;
  };
  const key = (t, tr) => `<g transform="${tr}">${chargeInner("clef", tinctPaint(t), chgStroke(t), "")}</g>`;
  const around = (k, tr, mir) => `translate(100 116) ${tr} scale(${mir ? -k : k} ${k}) translate(-100 -116)`;
  const figs = [
    ["En pal", "l'anneau en pointe, le panneton en chef vers dextre", mini("Gueules", key("Or", ""), "Clef d'or en pal")],
    ["Contournée", "le panneton vers senestre", mini("Gueules", key("Or", "translate(200 0) scale(-1 1)"), "Clef d'or contournée")],
    ["En bande", "le panneton vers la pointe", mini("Gueules", key("Or", around(.85, "rotate(-45)")), "Clef d'or posée en bande")],
    ["Adossées, entretenues", "dos à dos, les anneaux entrelacés", mini("Azur",
      key("Or", around(.8, "translate(-19 0)")) + key("Or", around(.8, "translate(19 0)", true)), "Deux clefs d'or adossées en pal")],
    ["Passées en sautoir", "croisées, l'une d'or, l'autre d'argent", mini("Gueules",
      key("Or", around(.74, "rotate(45)")) + key("Argent", around(.74, "rotate(-45)", true)), "Deux clefs passées en sautoir, l'une d'or, l'autre d'argent")]
  ];
  return `<div class="diagram-row">${figs.map(([t, d, s]) => `<figure>${s}<figcaption><b>${t}</b><span>${d}</span></figcaption></figure>`).join("")}
    <div class="credit">Dessins de l'encyclopédie ; la source ne dit pas comment se tournent les pannetons d'un sautoir, ce choix est le nôtre.</div></div>`;
}

/* recoupements : traits multipliés (burelé/palé/bandé/barré), tiercés, écartelé, gironné */
/* la boîte de l'écu [x0, y0, x1, y1] : les rayures se partagent ce qu'on voit de l'écu, pas la boîte 200 × 252 (« d'or à quatre pals » : de l'or aux deux bords) */
function boiteEcu(){
  try { const m = contourMesure().getBBox(); if(m.width) return [m.x, m.y, m.x + m.width, m.y + m.height]; } catch(err) { /* pas de mesure possible hors navigateur */ }
  return [18, 16, 182, 236];
}
function stripesH(n,a,b){ let s=""; const [, y0, , y1] = boiteEcu(), h=(y1-y0)/n; for(let i=0;i<n;i++){ const top = i ? y0+i*h : 0, bot = i===n-1 ? 252 : y0+(i+1)*h+0.6; s+=`<rect x="0" y="${top.toFixed(2)}" width="200" height="${(bot-top).toFixed(2)}" fill="${i%2?b:a}"/>`; } return s; }
function stripesV(n,a,b){ let s=""; const [x0, , x1] = boiteEcu(), w=(x1-x0)/n; for(let i=0;i<n;i++){ const left = i ? x0+i*w : 0, right = i===n-1 ? 200 : x0+(i+1)*w+0.6; s+=`<rect x="${left.toFixed(2)}" y="0" width="${(right-left).toFixed(2)}" height="252" fill="${i%2?b:a}"/>`; } return s; }
/* bandé / barré : n bandes égales, parallèles à la diagonale de l'écu (de l'angle dextre du chef à l'angle senestre de la pointe), de sorte que
   la première touche l'angle senestre du chef — et la dernière l'angle dextre de la pointe. Chaque bande est un polygone : pas de motif répété,
   donc pas de couture, et le nombre de bandes est celui qu'on demande. Le barré est le miroir du bandé. */
function stripesBendy(n,a,b,sin){
  const L = Math.hypot(252,200), nx = 252/L, ny = -200/L, dx = 200/L, dy = 252/L;
  const demi = 200*252/L, w = 2*demi/n;                 // demi-largeur de l'écu mesurée en travers des bandes, puis largeur d'une bande
  const P = (u,t) => `${(100+u*nx+t*dx).toFixed(2)},${(126+u*ny+t*dy).toFixed(2)}`;
  let s = "";
  for(let i=0;i<n;i++){
    const hi = demi - i*w, lo = demi - (i+1)*w;
    s += `<polygon points="${P(hi,-420)} ${P(hi,420)} ${P(lo,420)} ${P(lo,-420)}" fill="${i%2?b:a}"/>`;
  }
  return sin ? `<g transform="translate(200,0) scale(-1,1)">${s}</g>` : s;
}
/* chevronné : n zones en chevrons emboîtés, la première (celle du chef) de l'émail a. Les n-1 traits sont des V renversés de même pente que
   le chevron de l'Atelier (70 en travers pour 100 en hauteur), espacés régulièrement du chef à la pointe ; on peint de bas en haut. */
function chevronne(n, a, b){
  /* n zones égales sur la hauteur de l'écu (le long de l'axe), la première touchant le chef ; des bras assez plats pour que les chevrons couvrent tout l'écu */
  const col = i => i % 2 ? b : a, pente = .6, [, y0, , y1] = boiteEcu(), pas = (y1 - y0) / n;
  let s = `<rect width="200" height="252" fill="${col(n - 1)}"/>`;
  for(let k = n - 2; k >= 0; k--){
    const ya = y0 + (k + 1) * pas, yb = ya + pente * 300;
    s += `<polygon points="-200,${yb.toFixed(1)} 100,${ya.toFixed(1)} 400,${yb.toFixed(1)} 400,-200 -200,-200" fill="${col(k)}"/>`;
  }
  return s;
}
/* échiqueté de n tires : n rangées de carrés, autant de colonnes que le permet un carré à peu près carré ; l'angle dextre du chef est de l'émail a */
function echiquete(n, a, b){
  const h = 252 / n, cols = Math.max(2, Math.round(200 / h)), w = 200 / cols;
  let s = `<rect width="200" height="252" fill="${a}"/>`;
  for(let r = 0; r < n; r++) for(let c = 0; c < cols; c++) if((r + c) % 2) s += `<rect x="${(c * w).toFixed(2)}" y="${(r * h).toFixed(2)}" width="${(w + .4).toFixed(2)}" height="${(h + .4).toFixed(2)}" fill="${b}"/>`;
  return s;
}
/* fuselé : des fusées (losanges allongés) qui se touchent par la pointe sur une rangée, les rangées alternant les émaux ; en bande ou en barre,
   tout le réseau tourne de l'angle de la diagonale de l'écu (les fusées sont posées en bande, chaque rang dessine une barre) */
function fusele(kind, a, b){
  const w = 40, h = 70, ang = Math.atan(200 / 252) * 180 / Math.PI, rot = { lozengy: 0, lozengybend: -ang, lozengysin: ang }[kind];
  const cx = { lozengy: 0, lozengybend: 200, lozengysin: 0 }[kind];            // le coin dont l'émail est le premier : dextre du chef (sénestre pour le bandé)
  let s = "";
  for(let j = -16; j <= 16; j++) for(let i = -12; i <= 12; i++){
    const x = i * w + j * w / 2, y = j * h / 2;
    s += `<path d="M${x},${y - h / 2} L${x + w / 2},${y} L${x},${y + h / 2} L${x - w / 2},${y} Z" fill="${(j % 2 + 2) % 2 ? b : a}" stroke="${(j % 2 + 2) % 2 ? b : a}" stroke-width=".5"/>`;
  }
  return `<rect width="200" height="252" fill="${a}"/><g transform="translate(${cx},0) rotate(${rot.toFixed(2)})">${s}</g>`;
}
function shieldRecoupement(kind, n, a, b){
  const inner = recoupementInner(kind, n, a, b);
  const id = ++uid, cid = "clr"+id;
  return `<svg viewBox="${VB}" width="120" role="img" aria-label="${kind}">
    <defs><clipPath id="${cid}"><path d="${SHIELD_D}"/></clipPath></defs>
    <g clip-path="url(#${cid})">${inner}</g>
    ${shieldFinish()}
  </svg>`;
}
function recoupementInner(kind, n, a, b){
  let inner = "";
  switch(kind){
    case "barry":
      inner = n===2 ? `<rect width="200" height="126" fill="${a}"/><rect y="126" width="200" height="126" fill="${b}"/>` : stripesH(n,a,b);
      break;
    case "paly":
      inner = n===2 ? `<rect width="100" height="252" fill="${a}"/><rect x="100" width="100" height="252" fill="${b}"/>` : stripesV(n,a,b);
      break;
    case "bendy":
      inner = n===2 ? `<rect width="200" height="252" fill="${b}"/><path d="M0,0 L200,0 L200,252 Z" fill="${a}"/>` : stripesBendy(n,a,b,false);
      break;
    case "bendysin":
      inner = n===2 ? `<rect width="200" height="252" fill="${b}"/><path d="M200,0 L200,252 L0,252 Z" fill="${a}"/>` : stripesBendy(n,a,b,true);
      break;
    case "chevronny":
      inner = chevronne(n, a, b);
      break;
    case "chequy":
      inner = echiquete(n, a, b);
      break;
    case "lozengy": case "lozengybend": case "lozengysin":
      inner = fusele(kind, a, b);
      break;
    case "quarterly":
      inner = `<rect width="100" height="126" fill="${a}"/><rect x="100" width="100" height="126" fill="${b}"/><rect y="126" width="100" height="126" fill="${b}"/><rect x="100" y="126" width="100" height="126" fill="${a}"/>`;
      break;
    case "gyronny":
      inner = gironne(a,b);
      break;
  }
  return inner;
}
/* pièce "au vif de l'écu" (touchant les bords) vs pièce alésée (raccourcie, flottante) */
function shieldPieceAlesee(kind, champ, piece, alesee){
  const id = ++uid, cid = "cla"+id;
  const cf = tinctPaint(champ), pf = tinctPaint(piece);
  let inner = "";
  if(kind==="croix"){
    inner = alesee
      ? `<rect x="74" y="58" width="52" height="146" fill="${pf}"/><rect x="36" y="106" width="128" height="50" fill="${pf}"/>`
      : `<rect x="74" y="0"  width="52" height="252" fill="${pf}"/><rect x="0"  y="104" width="200" height="52" fill="${pf}"/>`;
  } else if(kind==="sautoir"){
    inner = alesee
      ? `<line x1="48" y1="58" x2="152" y2="194" stroke="${pf}" stroke-width="32"/><line x1="152" y1="58" x2="48" y2="194" stroke="${pf}" stroke-width="32"/>`
      : `<line x1="14" y1="16" x2="186" y2="230" stroke="${pf}" stroke-width="40"/><line x1="186" y1="16" x2="14" y2="230" stroke="${pf}" stroke-width="40"/>`;
  } else if(kind==="bande"){
    inner = alesee
      ? `<line x1="48" y1="68" x2="152" y2="184" stroke="${pf}" stroke-width="32" stroke-linecap="round"/>`
      : `<line x1="6" y1="6" x2="200" y2="252" stroke="${pf}" stroke-width="46"/>`;
  }
  return `<svg viewBox="${VB}" width="120" role="img" aria-label="${kind}${alesee?' alésé':''}">
    <defs><clipPath id="${cid}"><path d="${SHIELD_D}"/></clipPath></defs>
    <path d="${SHIELD_D}" fill="${cf}"/>
    <g clip-path="url(#${cid})">${inner}</g>
    ${shieldFinish()}
  </svg>`;
}

/* écu chargé d'une pièce honorable */
function shieldPiece(kind, champ, piece){
  const id = ++uid;
  const cid = "clipp"+id;
  const cf = tinctPaint(champ), pf = tinctPaint(piece);
  return `<svg viewBox="${VB}" width="120" role="img" aria-label="${kind}">
    <defs><clipPath id="${cid}"><path d="${SHIELD_D}"/></clipPath></defs>
    <path d="${SHIELD_D}" fill="${cf}"/>
    <g clip-path="url(#${cid})">${pieceInner(kind, pf)}</g>
    ${shieldFinish()}
  </svg>`;
}
/* ---- contours des pièces : bords ondés, nébulés, dancettés, engrêlés, cannelés, denchés ----
   Une pièce peut border son champ autrement qu'en ligne droite : « une fasce ondée, une bande engrêlée,
   une croix denchée ». On dessine alors son contour à la main : chaque côté long est remplacé par une suite
   de motifs, de sommet à sommet, si bien que les angles de la pièce ne bougent pas.
   par : le motif est symétrique par rapport à son centre, de sorte que les deux bords d'une pièce courent
         parallèlement (ondé, nébulé, dancetté) ; sinon il est tourné vers le dehors de la pièce
         (engrêlé : arcs rentrants et pointes dehors ; cannelé : l'inverse ; denché : dents dehors).
   h, l : hauteur et longueur d'un motif, en multiples d'une unité tirée de la largeur de la pièce. */
const CONTOURS = {
  onde:     { par: true,  h: 1,   l: 5.5 },
  nebule:   { par: true,  h: 1,   l: 5.5 },
  dancette: { par: true,  h: 1.7, l: 6.3 },
  engrele:  { par: false, h: 1,   l: 2.8 },
  cannele:  { par: false, h: 1,   l: 2.8 },
  denche:   { par: false, h: 1,   l: 2.2 },
};

/* De A à B (le stylo est déjà en A) : n motifs du style `style`, de hauteur a.
   cote vaut +1 si le dehors de la pièce est à gauche de la marche (contour parcouru dans le sens des aiguilles
   d'une montre, comme tous les nôtres), -1 s'il est à droite (bord intérieur d'un anneau).
   Un arc d'ellipse « sweep = 1 » bombe à gauche de la marche. */
function bordDecore(A, B, n, style, a, cote){
  const dx = (B[0] - A[0]) / n, dy = (B[1] - A[1]) / n, c = Math.hypot(dx, dy);
  if(!c) return "";
  const nx = cote * dy / c, ny = -cote * dx / c;                 // le dehors, de longueur 1
  const rot = (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(2);
  const f = v => +v.toFixed(2);
  let d = "";
  for(let i = 0; i < n; i++){
    const px = A[0] + dx * i, py = A[1] + dy * i;
    const at = (s, h) => f(px + dx * s + nx * h) + "," + f(py + dy * s + ny * h);   // s : place le long du motif (0 à 1), h : écart vers le dehors
    switch(style){
      case "onde":     d += `Q${at(.25, a)} ${at(.5, 0)}Q${at(.75, -a)} ${at(1, 0)}`; break;
      case "dancette": d += `L${at(.25, a / 2)}L${at(.75, -a / 2)}L${at(1, 0)}`; break;
      case "denche":   d += `L${at(.5, a)}L${at(1, 0)}`; break;
      case "nebule":   d += `A${f(c / 4)},${f(a)} ${rot} 0 ${cote > 0 ? 1 : 0} ${at(.5, 0)}A${f(c / 4)},${f(a)} ${rot} 0 ${cote > 0 ? 0 : 1} ${at(1, 0)}`; break;
      case "engrele":  d += `A${f(c / 2)},${f(a)} ${rot} 0 ${cote > 0 ? 0 : 1} ${at(1, 0)}`; break;
      case "cannele":  d += `A${f(c / 2)},${f(a)} ${rot} 0 ${cote > 0 ? 1 : 0} ${at(1, 0)}`; break;
    }
  }
  return d;
}

/* contour fermé de sommets V ; flags[i] dit si le côté qui part du sommet i porte le motif */
function polyDecore(V, flags, style, a, per){
  const f = v => +v.toFixed(2);
  let d = `M${f(V[0][0])},${f(V[0][1])}`;
  V.forEach((A, i) => {
    const B = V[(i + 1) % V.length];
    d += flags[i] ? bordDecore(A, B, Math.max(1, Math.round(Math.hypot(B[0] - A[0], B[1] - A[1]) / per)), style, a, 1) : `L${f(B[0])},${f(B[1])}`;
  });
  return d + "Z";
}

/* bande droite de demi-largeur hw, de P0 à P1, prolongée de ext aux deux bouts (hors de l'écu) */
function bandePoly(P0, P1, hw, ext = 0){
  const l = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]), u = [(P1[0] - P0[0]) / l, (P1[1] - P0[1]) / l], r = [-u[1], u[0]];
  const A = [P0[0] - ext * u[0], P0[1] - ext * u[1]], B = [P1[0] + ext * u[0], P1[1] + ext * u[1]];
  return { V: [[A[0] - hw * r[0], A[1] - hw * r[1]], [B[0] - hw * r[0], B[1] - hw * r[1]], [B[0] + hw * r[0], B[1] + hw * r[1]], [A[0] + hw * r[0], A[1] + hw * r[1]]],
           flags: [true, false, true, false] };
}

/* pièce en branches (croix, sautoir, pairle, chevron) : des bandes de demi-largeur hw partent du point c dans les
   directions dirs (rangées dans le sens des aiguilles d'une montre) et se prolongent sur la longueur ext, hors de
   l'écu. Renvoie les sommets du contour et, pour chaque côté, s'il faut le décorer (les côtés longs, pas les bouts). */
function branchesPoly(c, dirs, hw, ext){
  const U = dirs.map(([x, y]) => { const l = Math.hypot(x, y); return [x / l, y / l]; }), m = U.length, V = [], flags = [];
  const R = u => [-u[1], u[0]];                                  // à droite de la direction u (écran : y vers le bas)
  const croise = (p, u, q, w) => { const det = u[0] * w[1] - u[1] * w[0], s = ((q[0] - p[0]) * w[1] - (q[1] - p[1]) * w[0]) / det; return [p[0] + s * u[0], p[1] + s * u[1]]; };
  for(let i = 0; i < m; i++){
    const u = U[i], w = U[(i + 1) % m], r = R(u), r2 = R(w), bout = [c[0] + ext * u[0], c[1] + ext * u[1]];
    V.push([bout[0] - hw * r[0], bout[1] - hw * r[1]], [bout[0] + hw * r[0], bout[1] + hw * r[1]],
           croise([c[0] + hw * r[0], c[1] + hw * r[1]], u, [c[0] - hw * r2[0], c[1] - hw * r2[1]], w));
    flags.push(false, true, true);
  }
  return { V, flags };
}
const poly = V => "M" + V.map(p => p[0].toFixed(2) + "," + p[1].toFixed(2)).join("L") + "Z";
const SAUTOIR_DIRS = [[172, -214], [172, 214], [-172, 214], [-172, -214]];     // des bouts du sautoir : coin chef senestre, pointe senestre…
const PAIRLE_DIRS = [[82, -110], [0, 1], [-82, -110]];                            // du cœur vers les deux angles du chef et vers la pointe

/* le contour de l'écu, mesuré sur un tracé caché dans la page (getTotalLength ne marche que sur ce qui est dans le document) */
let MESURE_PATH = null;
function contourMesure(){
  if(!MESURE_PATH){
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "0"); svg.setAttribute("height", "0"); svg.setAttribute("aria-hidden", "true");
    svg.style.cssText = "position:absolute;visibility:hidden";
    MESURE_PATH = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svg.appendChild(MESURE_PATH); document.body.appendChild(svg);
  }
  MESURE_PATH.setAttribute("d", SHIELD_D);
  return MESURE_PATH;
}
/* Le contour de l'écu (réduit de k autour du point (100, cy)), décalé de `ecart` vers le dedans (négatif : vers le dehors),
   parcouru dans le sens des aiguilles d'une montre et rendu en morceaux, d'un angle vif à l'autre. Chaque morceau est une
   polyligne dont les deux bouts sont les coins nets du décalage (le « miter » : le coin reste vif), et dont les points
   intermédiaires ne reculent jamais sur ces coins — c'est ce qui évite les boucles que le décalage d'un angle laisse d'ordinaire. */
function contourDecale(ecart, k = 1, cy = 122){
  const p = contourMesure(), L = p.getTotalLength(), pas = 1.5, N = Math.max(90, Math.ceil(L / pas));
  const at = s => { const P = p.getPointAtLength(((s % L) + L) % L); return [100 + (P.x - 100) * k, cy + (P.y - cy) * k]; };
  let aire = 0;                                                    // sens du tracé : les formes d'écu ne l'ont pas toutes dans le même
  for(let i = 0; i < 64; i++){ const A = at(L * i / 64), B = at(L * (i + 1) / 64); aire += A[0] * B[1] - B[0] * A[1]; }
  const sens = aire >= 0 ? 1 : -1, S = i => sens * L * i / N;
  const dir = (A, B) => { const l = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1; return [(B[0] - A[0]) / l, (B[1] - A[1]) / l]; };
  const angle = (a, b) => Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]);        // de a vers b : > 0 à droite
  const virage = Array.from({ length: N }, (_, i) => angle(dir(at(S(i) - sens * 4), at(S(i))), dir(at(S(i)), at(S(i) + sens * 4))));
  const coins = [];                                                // les angles vifs : maxima locaux de plus de 30°, un par angle
  for(let i = 0; i < N; i++){
    const w = Math.abs(virage[i]);
    if(w < Math.PI / 6) continue;
    let max = true;
    for(let j = 1; j <= 5 && max; j++) if(Math.abs(virage[(i - j + N) % N]) >= w || Math.abs(virage[(i + j) % N]) > w) max = false;
    if(max) coins.push(i);
  }
  /* le coin net du décalage au sommet i, et de combien le décalage recule le long des côtés (négatif : il les prolonge) */
  const miter = i => {
    const s = S(i), a = dir(at(s - sens * 7), at(s - sens * 3)), b = dir(at(s + sens * 3), at(s + sens * 7)), A = at(s - sens * 5), B = at(s + sens * 5);
    const det = a[0] * b[1] - a[1] * b[0];
    let V = at(s);                                                 // le sommet : le croisement des deux côtés prolongés
    if(Math.abs(det) > .05){ const u = ((B[0] - A[0]) * b[1] - (B[1] - A[1]) * b[0]) / det; V = [A[0] + u * a[0], A[1] + u * a[1]]; }
    const n1 = [-a[1], a[0]], n2 = [-b[1], b[0]], den = Math.max(.35, 1 + n1[0] * n2[0] + n1[1] * n2[1]);
    return { P: [V[0] + ecart * (n1[0] + n2[0]) / den, V[1] + ecart * (n1[1] + n2[1]) / den], recul: ecart * Math.tan(Math.max(-1.3, Math.min(1.3, angle(a, b) / 2))) };
  };
  const decale = s => { const [tx, ty] = dir(at(s - sens * 2), at(s + sens * 2)), P = at(s); return [P[0] - ecart * ty, P[1] + ecart * tx]; };    // le dedans est à droite : (-ty, tx)
  if(!coins.length){                                               // aucun angle (l'ovale) : un seul anneau
    const pts = Array.from({ length: N }, (_, i) => decale(S(i)));
    return [[...pts, pts[0]]];
  }
  return coins.map((c, j) => {
    const d = coins[(j + 1) % coins.length], long = (((d - c + N - 1) % N) + 1) * L / N, m0 = miter(c), m1 = miter(d);
    const u0 = Math.max(0, m0.recul) + pas, u1 = long - Math.max(0, m1.recul) - pas, pts = [m0.P];
    for(let u = u0; u <= u1; u += pas) pts.push(decale(S(c) + sens * u));
    pts.push(m1.P);
    return pts;
  });
}
const longueur = pts => pts.slice(1).reduce((s, B, i) => s + Math.hypot(B[0] - pts[i][0], B[1] - pts[i][1]), 0);
/* des morceaux : ces mêmes morceaux découpés en m motifs chacun (m[j] pour le morceau j), les points de départ des motifs, anneau fermé */
function motifsAnneau(morceaux, m){
  const out = [];
  morceaux.forEach((pts, j) => {
    const cum = [0]; pts.slice(1).forEach((B, i) => cum.push(cum[i] + Math.hypot(B[0] - pts[i][0], B[1] - pts[i][1])));
    for(let i = 0; i < m[j]; i++){
      const d = cum[cum.length - 1] * i / m[j];
      let q = 1; while(q < cum.length - 1 && cum[q] < d) q++;
      const f = (d - cum[q - 1]) / ((cum[q] - cum[q - 1]) || 1);
      out.push([pts[q - 1][0] + (pts[q][0] - pts[q - 1][0]) * f, pts[q - 1][1] + (pts[q][1] - pts[q - 1][1]) * f]);
    }
  });
  return out;
}

/* le tracé d'une pièce à bords décorés (ou null si on ne sait pas la décorer) ; mêmes cotes que pieceInner */
function pieceDecoree(kind, line, th = 100, wf = 1, geo = null){      // wf : réduction d'une case de parti ; geo : centre et longueur des bras de la croix d'une case
  const S = CONTOURS[line];
  const largeur = { chef: 62, fasce: 52, pal: 52, bande: 46, barre: 46, croix: 40, sautoir: 40, chevron: 34, canton: 40, "franc-quartier": 50, pairle: 34, bordure: 13, orle: 12, cotice: 23 }[kind];
  if(!S || !largeur) return null;
  const a0 = Math.min(9, Math.max(4, .2 * largeur)), a = a0 * S.h * wf, per = a0 * S.l * wf;
  if(kind === "bordure" || kind === "orle"){
    /* ces deux pièces sont minces : on décale le tracé pour que la largeur moyenne reste celle du bord droit
       (les arcs de l'engrêlé la rognent, ceux du cannelé et les dents du denché l'augmentent) */
    const moy = { engrele: -.785, cannele: .785, denche: .5 }[line] || 0;
    /* l'orle est le contour réduit à .74, large de 16 × .74 ; la bordure ne montre que 13 au-dedans du contour */
    const anneaux = kind === "bordure" ? [contourDecale(13 * wf - moy * a)] : [contourDecale(-5.92 * wf + moy * a, 1 - .26 * wf), contourDecale(5.92 * wf - moy * a, 1 - .26 * wf)];
    /* les anneaux d'une même pièce ont le même nombre de motifs par morceau : leurs ondes restent parallèles */
    const nb = anneaux.every(r => r.length === anneaux[0].length) ? anneaux[0].map((_, j) => Math.max(1, Math.round(anneaux.reduce((s, r) => s + longueur(r[j]), 0) / anneaux.length / per))) : null;
    const f = v => +v.toFixed(2);
    const trace = (morceaux, cote) => {
      const pts = motifsAnneau(morceaux, nb || morceaux.map(pt => Math.max(1, Math.round(longueur(pt) / per))));
      let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
      pts.forEach((A, i) => { d += bordDecore(A, pts[(i + 1) % pts.length], 1, line, a, cote); });
      return d + "Z";
    };
    return (kind === "bordure" ? SHIELD_D : "") + anneaux.map((r, i) => trace(r, i === 0 && kind === "orle" ? 1 : (S.par ? 1 : -1))).join("");
  }
  const forme = {
    chef: () => ({ V: [[-30, -30], [230, -30], [230, 78], [-30, 78]], flags: [false, false, true, false] }),
    fasce: () => bandePoly([0, 130], [200, 130], 26, 30),
    pal: () => bandePoly([100, 0], [100, 252], 26, 30),
    bande: () => bandePoly([6, 6], [200, 252], 23, 40),
    cotice: () => bandePoly([6, 6], [200, 252], 11.5, 40),
    barre: () => bandePoly([194, 6], [0, 252], 23, 40),
    croix: () => branchesPoly(geo ? geo.c : [100, 112], [[0, -1], [1, 0], [0, 1], [-1, 0]], 20 * th / 100 * wf, geo ? geo.ext : 170),
    sautoir: () => branchesPoly([100, 123], SAUTOIR_DIRS, 20, 190),
    chevron: () => branchesPoly([100, 96], [[70, 100], [-70, 100]], 17, 160),
    canton: () => ({ V: [[-30, -30], [62, -30], [62, 54], [-30, 54]], flags: [false, true, true, false] }),
    "franc-quartier": () => ({ V: [[-30, -30], [84, -30], [84, 74], [-30, 74]], flags: [false, true, true, false] }),
    pairle: () => branchesPoly([100, 126], PAIRLE_DIRS, 17, 190),
  }[kind]();
  return polyDecore(forme.V, forme.flags, line, a, per);
}

/* pièce alésée : raccourcie, elle ne touche plus les bords de l'écu (les mêmes cotes que la pièce « au vif », ramenées à l'intérieur) */
function pieceAlesee(kind, pf){
  switch(kind){
    case "fasce": return `<rect x="38" y="104" width="124" height="52" fill="${pf}"/>`;
    case "pal": return `<rect x="74" y="44" width="52" height="170" fill="${pf}"/>`;
    case "bande": return `<line x1="50" y1="68" x2="150" y2="190" stroke="${pf}" stroke-width="40"/>`;
    case "barre": return `<line x1="150" y1="68" x2="50" y2="190" stroke="${pf}" stroke-width="40"/>`;
    case "chevron": return `<path d="M44,184 L100,104 L156,184" fill="none" stroke="${pf}" stroke-width="30"/>`;
    case "sautoir": return `<line x1="52" y1="60" x2="148" y2="192" stroke="${pf}" stroke-width="34"/><line x1="148" y1="60" x2="52" y2="192" stroke="${pf}" stroke-width="34"/>`;
  }
  return null;
}
/* line : contour décoré de la pièce (clé de CONTOURS), « alesee », ou rien pour un bord droit */
/* une croix d'un seul tenant (un seul élément : l'émail, métallique ou non, ne montre aucune couture entre les deux barres) */
const croixTrace = (cx, cy, h, x0, x1, y0, y1) => `M${cx - h},${y0} H${cx + h} V${cy - h} H${x1} V${cy + h} H${cx + h} V${y1} H${cx - h} V${cy + h} H${x0} V${cy - h} H${cx - h} Z`;
/* th : l'épaisseur de la croix, en % de la cote ordinaire */
function pieceInner(kind, pf, line, th){
  th = +th || 100;
  if(line === "alesee"){ const al = pieceAlesee(kind, pf); if(al) return al; }
  else if(line){
    let d = null;
    try{ d = pieceDecoree(kind, line, th); }
    catch(err){ console.warn("[armorial] contour décoré impossible, bord droit à la place :", err); }   // mesurer le contour demande un navigateur complet
    if(d) return `<path d="${d}" fill="${pf}" fill-rule="evenodd"/>`;
  }
  let inner = "";
  switch(kind){
    case "chef": inner = `<rect x="0" y="16" width="200" height="62" fill="${pf}"/>`; break;
    case "fasce": inner = `<rect x="0" y="104" width="200" height="52" fill="${pf}"/>`; break;
    case "pal": inner = `<rect x="74" y="0" width="52" height="252" fill="${pf}"/>`; break;
    case "bande": inner = `<line x1="6" y1="6" x2="200" y2="252" stroke="${pf}" stroke-width="46"/>`; break;
    case "cotice": inner = `<line x1="6" y1="6" x2="200" y2="252" stroke="${pf}" stroke-width="23"/>`; break;
    case "barre": inner = `<line x1="194" y1="6" x2="0" y2="252" stroke="${pf}" stroke-width="46"/>`; break;
    case "croix": { const t = 40 * th / 100; inner = `<path d="${croixTrace(100, 112, t / 2, 0, 200, 0, 252)}" fill="${pf}"/>`; break; }
    case "sautoir": inner = `<path d="M14,16 L186,230 M186,16 L14,230" fill="none" stroke="${pf}" stroke-width="40"/>`; break;
    case "chevron": inner = `<path d="M30,196 L100,96 L170,196" fill="none" stroke="${pf}" stroke-width="34"/>`; break;
    case "bordure": inner = `<path d="${SHIELD_D}" fill="none" stroke="${pf}" stroke-width="26"/>`; break;
    case "orle": inner = `<path d="${SHIELD_D}" transform="translate(100,122) scale(.74) translate(-100,-122)" fill="none" stroke="${pf}" stroke-width="16"/>`; break;
    /* pièces secondaires de l'Atelier : le canton au coin dextre du chef, le franc-quartier (celui de l'Empire, 84 × 74), le pairle en Y */
    case "canton": inner = `<rect x="0" y="0" width="62" height="54" fill="${pf}"/>`; break;
    case "franc-quartier": inner = `<rect x="0" y="0" width="84" height="74" fill="${pf}"/>`; break;
    case "pairle": inner = `<path d="${poly(branchesPoly([100, 126], PAIRLE_DIRS, 17, 190).V)}" fill="${pf}"/>`; break;
    /* pièces de brisure : le bâton, diminutif de la bande qui ne touche pas les bords de l'écu (« péri »), et le filet, plus mince que la cotice et qui va d'un bord à l'autre */
    case "baton-bande": inner = `<line x1="52" y1="64" x2="148" y2="188" stroke="${pf}" stroke-width="15"/>`; break;
    case "baton-barre": inner = `<line x1="148" y1="64" x2="52" y2="188" stroke="${pf}" stroke-width="15"/>`; break;
    case "filet-bande": inner = `<line x1="6" y1="6" x2="200" y2="252" stroke="${pf}" stroke-width="16"/>`; break;
    case "filet-barre": inner = `<line x1="194" y1="6" x2="0" y2="252" stroke="${pf}" stroke-width="16"/>`; break;
  }
  return inner;
}

/* écu du hero : parti d'azur et de gueules à la fleur de lis d'or.
   Renvoie le contenu INTERNE du <svg> (le <svg> existe déjà dans le HTML). */
function heroShieldInner(){
  const cid = "clhero"+(++uid);
  return `
    <defs><clipPath id="${cid}"><path d="${SHIELD_D}"/></clipPath></defs>
    <g class="field" clip-path="url(#${cid})">
      <rect x="0" y="0" width="100" height="252" fill="${tinctPaint('Azur')}"/>
      <rect x="100" y="0" width="100" height="252" fill="${tinctPaint('Gueules')}"/>
      <path d="${SHIELD_D}" fill="url(#diaper)" opacity=".09"/>
    </g>
    <g class="charge" fill="${tinctPaint('Or')}" stroke="#7a5c1e" stroke-width="1.6" stroke-linejoin="round">
      ${fleurDeLisPaths()}
    </g>
    <path class="field" d="${SHIELD_D}" fill="url(#relief)"/>
    <path class="draw" pathLength="1" d="${SHIELD_D}" fill="none" stroke="#1a1712" stroke-width="3"/>`;
}

/* diagramme des points de l'écu */
function ecuPoints(){
  const id=++uid, cid="clpts"+id;
  const gx=[59,100,141], gy=[46,126,200];
  const labels=[
    ["Canton\ndextre","Chef","Canton\nsenestre"],
    ["Flanc\ndextre","Cœur","Flanc\nsenestre"],
    ["Canton\ndextre","Pointe","Canton\nsenestre"]
  ];
  let pts="";
  for(let r=0;r<3;r++)for(let c=0;c<3;c++){
    const t=labels[r][c].split("\n");
    pts+=`<circle cx="${gx[c]}" cy="${gy[r]}" r="3.4" fill="#8e1b18"/>`+
      t.map((ln,i)=>`<text x="${gx[c]}" y="${gy[r]+16+i*11}" text-anchor="middle" font-family="EB Garamond,serif" font-size="10" fill="#5c5446">${ln}</text>`).join("");
  }
  return `<svg viewBox="0 0 200 300" width="230" role="img" aria-label="Les points de l'écu">
    <defs><clipPath id="${cid}"><path d="${SHIELD_D}"/></clipPath></defs>
    <path d="${SHIELD_D}" fill="#f3eee0"/>
    <g clip-path="url(#${cid})" stroke="#d8cfb4" stroke-width="1">
      <line x1="0" y1="86" x2="200" y2="86"/><line x1="0" y1="166" x2="200" y2="166"/>
      <line x1="72" y1="0" x2="72" y2="252"/><line x1="128" y1="0" x2="128" y2="252"/>
    </g>
    ${pts}
    <path d="${SHIELD_D}" fill="none" stroke="#1a1712" stroke-width="2.4"/>
    <text x="30" y="264" text-anchor="middle" font-family="Marcellus SC,serif" font-size="10" letter-spacing="1.5" fill="#20406e">← Dextre</text>
    <text x="170" y="264" text-anchor="middle" font-family="Marcellus SC,serif" font-size="10" letter-spacing="1.5" fill="#20406e">Senestre →</text>
    <text x="100" y="280" text-anchor="middle" font-family="EB Garamond,serif" font-style="italic" font-size="10.5" fill="#5c5446">côtés vus du porteur, non du spectateur</text>
  </svg>`;
}

/* ---- meubles : figures originales dessinées à neuf ---- */
/* étoile à n rais (6, 7 ou 8) : même taille et même épaisseur de trait que l'étoile à cinq rais */
function etoileRais(n, fill, stroke){
  const R = 26, r = R * (n === 6 ? .5 : .42), pts = [];
  for(let i = 0; i < 2 * n; i++){
    const a = Math.PI * i / n, rr = i % 2 ? r : R;
    pts.push((rr * Math.sin(a)).toFixed(2) + "," + (-rr * Math.cos(a)).toFixed(2));
  }
  return `<g transform="translate(100,116) scale(1.7)" fill="${fill}" stroke="${stroke}" stroke-width="0.8"><path d="M${pts.join(" L")} Z"/></g>`;
}
/* le lambel : un filet horizontal d'un seul tenant qui déborde l'écu (le contour le coupe), garni de n pendants ; ils s'allongent quand ils portent des figures */
function lambelGeom(n, long){
  const [d, wt] = n <= 3 ? [44, 32] : n === 4 ? [40, 29] : n === 5 ? [33, 24] : [29, 20];            // écart entre pendants, largeur d'un pendant
  return { wt, wb: Math.round(wt * .72), y0: 61, y1: long ? 116 : 100, xs: Array.from({ length: n }, (_, i) => 100 + (i - (n - 1) / 2) * d) };
}
function lambelInner(n, fill, stroke, long){
  const g = lambelGeom(n, long);
  const pend = g.xs.slice().reverse().map(x => ` L${x + g.wt / 2},${g.y0} L${x + g.wb / 2},${g.y1} L${x - g.wb / 2},${g.y1} L${x - g.wt / 2},${g.y0}`).join("");
  return `<path d="M-80,50 L280,50 L280,${g.y0}${pend} L-80,${g.y0} Z" fill="${fill}" stroke="${stroke}" stroke-width="1.3" stroke-linejoin="round"/>`;
}
function chgStroke(t){
  const m={Or:"#7a5c1e",Argent:"#8a8a8a",Gueules:"#5a1210",Azur:"#16294a",Sable:"#000000",Sinople:"#1c4026",Pourpre:"#3f1440"};
  return m[t]||"#1a1712";
}
function chargeInner(kind, fill, stroke, field){
  switch(kind){
    case "lion": return `
      <g fill="${fill}" stroke="${stroke}" stroke-width="1.7" stroke-linejoin="round">
        <path d="M150,112 C166,105 177,88 173,71 C170,59 161,53 152,56 C160,63 163,74 157,85 C152,93 147,101 146,109 Z"/>
        <path d="M173,71 C179,63 187,61 192,66 C185,66 180,70 176,77 Z"/>
        <path d="M124,105 C140,103 153,113 153,128 C153,141 144,150 131,150 C120,150 113,141 113,128 C113,115 117,107 124,105 Z"/>
        <path d="M58,106 C71,98 93,94 117,95 C138,96 152,103 158,113 C162,122 160,134 151,141 C138,149 115,153 92,151 C72,149 58,141 54,128 C52,119 53,111 58,106 Z"/>
        <path d="M72,104 L62,109 L67,119 L56,118 L54,129 L46,121 L38,129 L36,118 L25,119 L30,109 L20,104 L30,99 L25,89 L36,90 L38,79 L46,87 L54,79 L56,90 L67,89 L62,99 Z"/>
        <path d="M33,92 C22,92 12,99 10,108 C9,115 15,121 26,121 C35,121 41,116 41,107 C41,99 39,92 33,92 Z"/>
        <path d="M116,147 C114,159 113,171 112,183 C109,185 108,190 111,192 L127,192 C130,190 129,185 126,183 C126,171 127,158 129,145 Z"/>
        <path d="M139,148 C137,160 135,172 134,184 C131,186 130,191 133,193 L149,193 C152,191 151,186 148,184 C148,172 149,159 151,146 Z"/>
        <path d="M67,143 C64,158 62,173 61,184 C58,186 57,191 60,193 L76,193 C79,191 78,186 75,184 C75,172 76,157 78,145 Z"/>
        <path d="M82,141 C88,151 94,159 94,167 C94,175 87,179 80,176 C85,171 85,163 79,153 C76,148 76,143 78,140 Z"/>
      </g>
      <circle cx="24" cy="104" r="2.4" fill="#2a1c08"/>
      <circle cx="12" cy="110" r="2" fill="#2a1c08"/>`;
    case "aigle": return `
      <g transform="translate(8,18)" fill="${fill}" stroke="${stroke}" stroke-width="0.6" stroke-linejoin="round">
        <path d="M90,38 C83,38 77,44 77,51 C77,57 82,63 90,63 C93,63 96,62 98,60 L88,58 L98,55 C99,53 100,52 100,51 C100,44 96,38 90,38 Z"/>
        <path d="M90,60 C85,64 83,74 84,88 L96,88 C97,74 95,64 90,60 Z"/>
        <path d="M84,88 C84,108 87,130 90,146 C93,130 96,108 96,88 Z"/>
        <path d="M85,144 C79,150 75,160 76,170 C81,164 84,163 88,164 L88,146 Z"/>
        <path d="M95,144 C101,150 105,160 104,170 C99,164 96,163 92,164 L92,146 Z"/>
        <path d="M83,146 L97,146 L104,196 L96,187 L90,200 L84,187 L76,196 Z"/>
        <path d="M96,92 C104,84 114,74 126,64 C138,54 150,48 158,46 C152,54 150,62 152,70 C144,66 138,70 135,78 C142,78 147,82 149,90 C141,86 134,90 132,98 C138,100 142,104 143,111 C135,106 127,110 124,118 C120,108 108,100 96,102 Z"/>
        <g transform="translate(180,0) scale(-1,1)">
          <path d="M96,92 C104,84 114,74 126,64 C138,54 150,48 158,46 C152,54 150,62 152,70 C144,66 138,70 135,78 C142,78 147,82 149,90 C141,86 134,90 132,98 C138,100 142,104 143,111 C135,106 127,110 124,118 C120,108 108,100 96,102 Z"/>
        </g>
      </g>`;
    case "croissant": return `<path d="M64,108 A42,42 0 1 0 136,108 A34,34 0 1 1 64,108 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/>`;
    case "etoile": return `<g transform="translate(100,116) scale(1.7)" fill="${fill}" stroke="${stroke}" stroke-width="0.8"><path d="M0,-26 L7,-8 L26,-8 L11,4 L17,24 L0,12 L-17,24 L-11,4 L-26,-8 L-7,-8 Z"/></g>`;
    case "etoile6": case "etoile7": case "etoile8": return etoileRais(+kind.slice(6), fill, stroke);
    case "molette": return `<g transform="translate(100,116) scale(1.7)"><path d="M0,-26 L6,-7 L26,-6 L10,5 L16,24 L0,13 L-16,24 L-10,5 L-26,-6 L-6,-7 Z" fill="${fill}" stroke="${stroke}" stroke-width="0.8"/><circle cx="0" cy="2" r="4.5" fill="${field}"/></g>`;
    case "roundel": return `<circle cx="100" cy="116" r="40" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/>`;
    case "rose": return `
      <g transform="translate(100,116)">
        <g fill="${fill}" stroke="${stroke}" stroke-width="1.2">
          <path transform="rotate(0)" d="M0,-16 C18,-46 -18,-46 0,-16 Z"/>
          <path transform="rotate(72)" d="M0,-16 C18,-46 -18,-46 0,-16 Z"/>
          <path transform="rotate(144)" d="M0,-16 C18,-46 -18,-46 0,-16 Z"/>
          <path transform="rotate(216)" d="M0,-16 C18,-46 -18,-46 0,-16 Z"/>
          <path transform="rotate(288)" d="M0,-16 C18,-46 -18,-46 0,-16 Z"/>
        </g>
        <g fill="#2f6b3d">
          <path transform="rotate(36)" d="M0,-30 L4,-40 L-4,-40 Z"/>
          <path transform="rotate(108)" d="M0,-30 L4,-40 L-4,-40 Z"/>
          <path transform="rotate(180)" d="M0,-30 L4,-40 L-4,-40 Z"/>
          <path transform="rotate(252)" d="M0,-30 L4,-40 L-4,-40 Z"/>
          <path transform="rotate(324)" d="M0,-30 L4,-40 L-4,-40 Z"/>
        </g>
        <circle r="12" fill="#c79a3a" stroke="#7a5c1e" stroke-width="1.2"/>
        <g fill="#7a5c1e"><circle cx="0" cy="-5" r="1.6"/><circle cx="4" cy="3" r="1.6"/><circle cx="-4" cy="3" r="1.6"/></g>
      </g>`;

    /* ---------- meubles propres au blason ---------- */
    case "macle": return `<path fill-rule="evenodd" d="M100,44 L148,116 L100,188 L52,116 Z M100,74 L128,116 L100,158 L72,116 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/>`;
    case "rustre": return `<path fill-rule="evenodd" d="M100,44 L148,116 L100,188 L52,116 Z M124,116 A24,24 0 1 0 76,116 A24,24 0 1 0 124,116 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/>`;
    case "losange": return `<path d="M100,44 L148,116 L100,188 L52,116 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/>`;
    case "fusee": return `<path d="M100,30 L136,116 L100,202 L64,116 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/>`;
    case "billette": return `<g fill="${fill}" stroke="${stroke}" stroke-width="1.3">
      <rect x="52" y="60" width="32" height="48" rx="2"/><rect x="116" y="60" width="32" height="48" rx="2"/>
      <rect x="84" y="132" width="32" height="48" rx="2"/></g>`;
    case "annelet": return `<path fill-rule="evenodd" d="M142,116 A42,42 0 1 0 58,116 A42,42 0 1 0 142,116 Z M130,116 A30,30 0 1 0 70,116 A30,30 0 1 0 130,116 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.3"/>`;
    case "vire": return `<g fill="none" stroke="${fill}" stroke-width="9"><circle cx="100" cy="116" r="46"/><circle cx="100" cy="116" r="30"/><circle cx="100" cy="116" r="14"/></g>`;
    case "escarboucle": {
      const rais = [0, 45, 90, 135, 180, 225, 270, 315].map(a =>
        `<g transform="rotate(${a} 100 116)"><path d="M95,116 L95,52 L105,52 L105,116 Z"/>
          <path d="M100,34 C90,42 86,52 91,60 L109,60 C114,52 110,42 100,34 Z"/></g>`).join("");
      return `<g fill="${fill}" stroke="${stroke}" stroke-width="1.1" stroke-linejoin="round">${rais}<circle cx="100" cy="116" r="14"/></g>`;
    }
    case "flanchis": return `<path d="M74,84 L100,110 L126,84 L142,100 L116,126 L142,152 L126,168 L100,142 L74,168 L58,152 L84,126 L58,100 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.4" stroke-linejoin="round"/>`;
    case "frette": return `<g fill="none" stroke="${fill}" stroke-width="11" stroke-linecap="square">
      <path d="M42,58 L158,174"/><path d="M158,58 L42,174"/><path d="M100,50 L154,116 L100,182 L46,116 Z"/></g>`;
    case "lambel": return lambelInner(3, fill, stroke);
    case "trescheur": return `<g fill="none" stroke="${fill}" stroke-linejoin="round">
      <path d="${SHIELD_D}" transform="translate(100,126) scale(.84) translate(-100,-126)" stroke-width="9"/>
      <path d="${SHIELD_D}" transform="translate(100,126) scale(.71) translate(-100,-126)" stroke-width="5"/></g>`;
    case "croisette": return `<path d="M88,60 L112,60 L112,104 L156,104 L156,128 L112,128 L112,172 L88,172 L88,128 L44,128 L44,104 L88,104 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.3"/>`;
    case "goutte": return `<path d="M100,54 C114,88 132,108 132,130 A32,32 0 1 1 68,130 C68,108 86,88 100,54 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/>`;
    case "coupeaux": return `<g fill="${fill}" stroke="${stroke}" stroke-width="1.4" stroke-linejoin="round">
      <path d="M14,240 C14,198 38,168 66,168 C94,168 118,198 118,240 Z"/>
      <path d="M82,240 C82,198 106,168 134,168 C162,168 186,198 186,240 Z"/>
      <path d="M48,240 C48,182 74,144 100,144 C126,144 152,182 152,240 Z"/></g>`;
    case "vivre": return `<path d="M14,94 L58,66 L100,94 L142,66 L186,94 L186,122 L142,94 L100,122 L58,94 L14,122 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.3" stroke-linejoin="round"/>`;
    case "quartefeuille": return `<path d="M100,116 m-52,0 a26,26 0 0 1 26,-26 a26,26 0 0 1 26,-26 a26,26 0 0 1 26,26 a26,26 0 0 1 26,26 a26,26 0 0 1 -26,26 a26,26 0 0 1 -26,26 a26,26 0 0 1 -26,-26 a26,26 0 0 1 -26,-26 z" fill="${fill}" stroke="${stroke}" stroke-width="1.3"/>
      <circle cx="100" cy="116" r="13" fill="${field}"/>`;
    case "quintefeuille": return `<g fill="${fill}" stroke="${stroke}" stroke-width="1.2" stroke-linejoin="round">
      ${[0, 72, 144, 216, 288].map(a => `<path transform="rotate(${a} 100 116)" d="M100,114 C80,100 76,70 100,50 C124,70 120,100 100,114 Z"/>`).join("")}</g>
      <circle cx="100" cy="116" r="11" fill="${field}"/>`;
    case "tiercefeuille": return `<g fill="${fill}" stroke="${stroke}" stroke-width="1.2" stroke-linejoin="round">
      ${[0, 120, 240].map(a => `<path transform="rotate(${a} 100 116)" d="M100,114 C78,98 74,66 100,46 C126,66 122,98 100,114 Z"/>`).join("")}</g>`;
    case "otelle": return `<g fill="${fill}" stroke="${stroke}" stroke-width="1.2" stroke-linejoin="round">
      ${[45, 135, 225, 315].map(a => `<path transform="rotate(${a} 100 116)" d="M100,108 C116,84 116,48 100,26 C84,48 84,84 100,108 Z"/>`).join("")}</g>`;
    case "moucheture": return `<g transform="translate(100,122) scale(9)" fill="${fill}" stroke="${stroke}" stroke-width=".12" stroke-linejoin="round">
      <path d="M0,-5 C-2.2,-1.4 -3.6,1.6 -3.6,3.4 L3.6,3.4 C3.6,1.6 2.2,-1.4 0,-5 Z"/>
      <circle cx="-3.3" cy="-4.4" r="1.15"/><circle cx="0" cy="-6.5" r="1.15"/><circle cx="3.3" cy="-4.4" r="1.15"/></g>`;
    case "fontaine": {
      const cf = "clfont" + (++uid);
      return `<defs><clipPath id="${cf}"><circle cx="100" cy="116" r="44"/></clipPath></defs>
        <circle cx="100" cy="116" r="44" fill="${tinctPaint('Argent')}"/>
        <g clip-path="url(#${cf})" fill="none" stroke="${fill}" stroke-width="10">
          <path d="M52,96 Q66,86 80,96 T108,96 T136,96 T164,96"/>
          <path d="M52,120 Q66,110 80,120 T108,120 T136,120 T164,120"/>
          <path d="M52,144 Q66,134 80,144 T108,144 T136,144 T164,144"/></g>
        <circle cx="100" cy="116" r="44" fill="none" stroke="${stroke}" stroke-width="1.6"/>`;
    }
    case "chaussetrappe": return `<g fill="${fill}" stroke="${stroke}" stroke-width="1.2" stroke-linejoin="round">
      ${[0, 120, 180, 240].map(a => `<path transform="rotate(${a} 100 116)" d="M91,116 L109,116 L100,38 Z"/>`).join("")}
      <circle cx="100" cy="116" r="12"/></g>`;
    case "crampon": return `<path d="M46,48 L154,48 L154,74 L92,74 L154,186 L154,208 L46,208 L46,182 L108,182 L46,70 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.3" stroke-linejoin="round"/>`;
    case "tau": return `<path d="M34,50 L166,50 L166,84 L117,84 L117,198 L83,198 L83,84 L34,84 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.3"/>`;

    /* ---------- la famille de la croix ---------- */
    case "croix-pattee": return `<path d="M82,32 L118,32 L110,96 L174,88 L174,144 L110,136 L118,200 L82,200 L90,136 L26,144 L26,88 L90,96 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.3" stroke-linejoin="round"/>`;
    case "croix-potencee": return `<path d="M62,34 L138,34 L138,48 L114,48 L114,102 L170,102 L170,82 L184,82 L184,150 L170,150 L170,130 L114,130 L114,184 L138,184 L138,198 L62,198 L62,184 L86,184 L86,130 L30,130 L30,150 L16,150 L16,82 L30,82 L30,102 L86,102 L86,48 L62,48 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.3" stroke-linejoin="round"/>`;
    case "croix-recroisettee": return `<g fill="${fill}">
      <path d="M88,52 L112,52 L112,104 L164,104 L164,128 L112,128 L112,180 L88,180 L88,128 L36,128 L36,104 L88,104 Z"/>
      <rect x="64" y="40" width="72" height="12"/><rect x="64" y="180" width="72" height="12"/>
      <rect x="24" y="80" width="12" height="72"/><rect x="164" y="80" width="12" height="72"/>
      <rect x="94" y="28" width="12" height="12"/><rect x="94" y="192" width="12" height="12"/>
      <rect x="12" y="110" width="12" height="12"/><rect x="176" y="110" width="12" height="12"/></g>`;
    case "croix-lorraine": return `<path d="M88,32 L112,32 L112,72 L150,72 L150,94 L112,94 L112,134 L164,134 L164,156 L112,156 L112,202 L88,202 L88,156 L36,156 L36,134 L88,134 L88,94 L50,94 L50,72 L88,72 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.3"/>`;

    /* ---------- astres et éléments ---------- */
    case "soleil": {
      let r = "";
      for(let i = 0; i < 16; i++){
        const a = i * 22.5;
        r += i % 2
          ? `<path transform="rotate(${a} 100 116)" d="M100,64 C106,54 94,44 100,30" fill="none" stroke="${fill}" stroke-width="6" stroke-linecap="round"/>`
          : `<path transform="rotate(${a} 100 116)" d="M93,66 L100,24 L107,66 Z"/>`;
      }
      return `<g fill="${fill}" stroke="${stroke}" stroke-width=".9" stroke-linejoin="round">${r}<circle cx="100" cy="116" r="36"/></g>`;
    }
    case "eclair": return `<path d="M118,34 L68,124 L96,124 L80,200 L134,106 L104,106 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.3" stroke-linejoin="round"/>`;

    /* ---------- objets et bâtiments ---------- */
    case "cloche": return `<g fill="${fill}" stroke="${stroke}" stroke-width="1.4" stroke-linejoin="round">
      <rect x="92" y="44" width="16" height="14" rx="5"/>
      <path d="M100,58 C74,58 60,80 58,110 C56,140 48,158 38,168 L162,168 C152,158 144,140 142,110 C140,80 126,58 100,58 Z"/>
      <rect x="34" y="168" width="132" height="14" rx="4"/>
      <rect x="95" y="182" width="10" height="10"/><circle cx="100" cy="198" r="11"/></g>`;
    /* un seul contour, sans traits intérieurs (anneau en pointe, panneton en chef à dextre) : le dégradé du métal reste d'une pièce */
    case "clef": return `<path d="M90,38 H110 V46 H106 V106 H110 V112 H106 V128 H111 V136 H106 V146.7 A26,26 0 1 1 94,146.7 V136 H89 V128 H94 V112 H90 V106 H94 V88 H60 V80 H76 V72 H60 V64 H76 V56 H60 V46 H90 Z
      M112,172 A12,12 0 1 0 88,172 A12,12 0 1 0 112,172 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.4" stroke-linejoin="round"/>`;
    case "epee": return epeeGraphic(100, 110, 2.15, fill, stroke);
    case "ancre": return `<g fill="${fill}" stroke="${stroke}" stroke-width="1.4" stroke-linejoin="round">
      <path fill-rule="evenodd" d="M117,46 A17,17 0 1 0 83,46 A17,17 0 1 0 117,46 Z M107,46 A7,7 0 1 0 93,46 A7,7 0 1 0 107,46 Z"/>
      <rect x="92" y="60" width="16" height="122"/><rect x="50" y="74" width="100" height="13" rx="6"/>
      <path d="M100,188 C72,188 46,168 40,138 C38,131 45,127 49,133 C58,150 74,162 100,162 C126,162 142,150 151,133 C155,127 162,131 160,138 C154,168 128,188 100,188 Z"/>
      <path d="M34,118 L54,140 L32,148 Z"/><path d="M166,118 L146,140 L168,148 Z"/></g>`;
    /* la couronne ouverte (celle qu'on voit en meuble : « trois couronnes d'or ») : un bandeau gemmé et cinq pointes, dont trois portent une perle */
    case "couronne": return `<g fill="${fill}" stroke="${stroke}" stroke-width="1.4" stroke-linejoin="round">
      <path d="M40,142 L36,96 L70,122 L100,82 L130,122 L164,96 L160,142 Z"/>
      <rect x="40" y="142" width="120" height="30" rx="3"/>
      <circle cx="36" cy="90" r="7"/><circle cx="100" cy="75" r="7"/><circle cx="164" cy="90" r="7"/></g>
      <g fill="${field}"><circle cx="66" cy="157" r="5.5"/><circle cx="100" cy="157" r="5.5"/><circle cx="134" cy="157" r="5.5"/></g>`;
    /* la hache d'armes, le fer à dextre (à gauche pour qui regarde) ; on la contourne pour l'avoir à senestre */
    case "hache": return `<g fill="${fill}" stroke="${stroke}" stroke-width="1.4" stroke-linejoin="round">
      <rect x="95.5" y="42" width="9" height="172" rx="3"/>
      <path d="M95,54 L52,34 C42,64 42,104 52,136 L95,106 Z"/>
      <path d="M105,60 L134,68 L105,84 Z"/>
      <path d="M95,52 L100,28 L105,52 Z"/></g>`;
    case "tour": return `<g fill="${fill}" stroke="${stroke}" stroke-width="1.4" stroke-linejoin="round">
      <path d="M50,76 L50,50 L72,50 L72,64 L89,64 L89,50 L111,50 L111,64 L128,64 L128,50 L150,50 L150,76 Z"/>
      <path d="M58,76 L142,76 L142,200 L58,200 Z"/></g>
      <g fill="${field}"><path d="M80,200 L80,164 A20,20 0 0 1 120,164 L120,200 Z"/>
      <rect x="71" y="96" width="16" height="22" rx="3"/><rect x="113" y="96" width="16" height="22" rx="3"/></g>
      <g fill="none" stroke="${stroke}" stroke-width="1" opacity=".35"><path d="M58,132 L142,132 M58,160 L142,160 M100,76 L100,96 M85,132 L85,160 M115,132 L115,160"/></g>`;
    case "chateau": return `<g fill="${fill}" stroke="${stroke}" stroke-width="1.4" stroke-linejoin="round">
      <path d="M74,88 L74,62 L90,62 L90,74 L110,74 L110,62 L126,62 L126,88 Z"/><rect x="79" y="88" width="42" height="112"/>
      <path d="M30,126 L30,104 L44,104 L44,114 L58,114 L58,104 L72,104 L72,126 Z"/><rect x="35" y="126" width="32" height="74"/>
      <path d="M128,126 L128,104 L142,104 L142,114 L156,114 L156,104 L170,104 L170,126 Z"/><rect x="133" y="126" width="32" height="74"/>
      <rect x="60" y="152" width="80" height="48"/></g>
      <g fill="${field}"><path d="M86,200 L86,172 A14,14 0 0 1 114,172 L114,200 Z"/>
      <rect x="44" y="144" width="14" height="18" rx="3"/><rect x="142" y="144" width="14" height="18" rx="3"/></g>`;
    case "roue": return `<g fill="none" stroke="${fill}" stroke-width="11"><circle cx="100" cy="116" r="50"/>
      <path d="M100,66 L100,166 M57,91 L143,141 M57,141 L143,91"/></g><circle cx="100" cy="116" r="13" fill="${fill}"/>`;

    /* ---------- règne végétal ---------- */
    case "gland": return `<g fill="${fill}" stroke="${stroke}" stroke-width="1.4" stroke-linejoin="round">
      <path d="M95,62 C95,54 100,46 100,46 C100,46 105,54 105,62 Z"/>
      <path d="M66,102 C66,84 81,72 100,72 C119,72 134,84 134,102 C134,109 127,114 100,114 C73,114 66,109 66,102 Z"/>
      <path d="M72,114 C72,150 83,182 100,194 C117,182 128,150 128,114 Z"/></g>`;
    case "gerbe": return `<g fill="${fill}" stroke="${stroke}" stroke-width="1.2" stroke-linejoin="round">
      ${[-30, -18, -6, 6, 18, 30].map(a => `<path transform="rotate(${a} 100 188)" d="M91,188 L91,62 C91,52 100,42 100,42 C100,42 109,52 109,62 L109,188 Z"/>`).join("")}
      <rect x="56" y="130" width="88" height="22" rx="7"/></g>`;

    /* ---------- corps humain ---------- */
    case "coeur": return `<path d="M100,194 C58,158 38,134 38,106 C38,83 55,66 76,66 C88,66 97,72 100,82 C103,72 112,66 124,66 C145,66 162,83 162,106 C162,134 142,158 100,194 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.4" stroke-linejoin="round"/>`;
  }
  return "";
}
function shieldCharge(kind, champ, chargeTinct){
  const id=++uid, cid="clch"+id;
  const cf=tinctPaint(champ), pf=tinctPaint(chargeTinct), st=chgStroke(chargeTinct);
  return `<svg viewBox="${VB}" width="120" role="img" aria-label="${kind} de ${chargeTinct} sur champ de ${champ}">
    <defs><clipPath id="${cid}"><path d="${SHIELD_D}"/></clipPath></defs>
    <path d="${SHIELD_D}" fill="${cf}"/>
    <g clip-path="url(#${cid})">${chargeInner(kind,pf,st,cf)}</g>
    ${shieldFinish()}
  </svg>`;
}
