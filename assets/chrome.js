/* L'ARMORIAL — éléments communs à toutes les pages : bandeau de navigation et sceau du pied de page.

   Pour ajouter une page au menu : une ligne à PAGES ci-dessous, et son identifiant dans une rubrique de RUBRIQUES.

   Chaque page pose, tout en haut de son <body>, l'en-tête vide suivi de ce script :
     <header class="mast" data-page="atelier"></header>
     <script src="assets/chrome.js"></script>
   data-page est l'identifiant de la page dans PAGES ; l'en-tête garde ce qui lui est propre
   (la recherche, pour l'encyclopédie). Le pied de page reçoit le sceau en tête, ses textes restent à la page. */
/* L'ancienne adresse (GitHub Pages, i-envy-hades.github.io/armorial/) renvoie vers le site actuel, en gardant la page, la recherche et l'ancre.
   Le dépôt est servi aux deux endroits : cette ligne ne fait rien sur le site actuel. */
if (location.hostname === "i-envy-hades.github.io") location.replace("https://armorial.web.app" + location.pathname.replace(/^\/armorial(\/|$)/, "/") + location.search + location.hash);
/* Le jeu est devenu la page d'accueil (index.html) et l'encyclopédie est passée à encyclopedie.html : un ancien lien vers un chapitre
   (« index.html#emaux ») arrive sur le jeu, qui le renvoie au bon endroit (le jeu, lui, n'emploie que « #n=3 »). */
const ANCIEN_LIEN = /^\/(index\.html)?$/.test(location.pathname.replace(/^\/armorial/, "")) && location.hash && !/^#(n=\d+|jeu|contenu|archives)$/.test(location.hash);
if (ANCIEN_LIEN) location.replace("encyclopedie.html" + location.hash);

/* La langue. Une page dit sa langue par <html lang> ; Tr(fr, en) choisit le texte, pour tous les scripts qui servent aux deux versions.
   JUMELLES : les pages traduites et leur nom anglais (à compléter à chaque page traduite ; tools/check_data.py compare leurs id).
   Le choix du lecteur est gardé : qui lit en anglais est renvoyé vers la page anglaise quand elle existe, et les autres pages lui
   disent qu'elles ne sont qu'en français. Le lien qui change de langue porte data-langue. */
const JUMELLES = { "index.html": "en.html", "encyclopedie.html": "en-encyclopedia.html", "blasons.html": "en-arms.html", "personnages.html": "en-people.html", "recherche.html": "en-search.html", "jour.html": "en-daily.html", "exercices.html": "en-practice.html", "atelier.html": "en-atelier.html", "lignees.html": "en-lineages.html", "transmission.html": "en-transmission.html", "retour.html": "en-feedback.html" };
const JUMELLE_FR = Object.fromEntries(Object.entries(JUMELLES).map(([fr, en]) => [en, fr]));
const PAGE_ICI = location.pathname.split("/").pop() || "index.html";
const LANGUE = document.documentElement.lang === "en" ? "en" : "fr";
const Tr = (fr, en) => (LANGUE === "en" ? en : fr);
const CLE_LANGUE = "armorial.langue";
const langueChoisie = () => { try { return localStorage.getItem(CLE_LANGUE); } catch (e) { return null; } };
const choisitLangue = l => { try { localStorage.setItem(CLE_LANGUE, l); } catch (e) { /* sans mémoire : la langue de la page suffit */ } };
if (LANGUE === "en") choisitLangue("en");
else if (langueChoisie() === "en" && JUMELLES[PAGE_ICI] && !ANCIEN_LIEN) location.replace(JUMELLES[PAGE_ICI] + location.search + location.hash);
/* en anglais, une adresse de page française devient celle de sa jumelle, si elle existe (« blasons.html#x » → « en-arms.html#x ») */
const versLangue = s => (LANGUE === "en" ? String(s).replace(/\b[\w-]+\.html\b/g, m => JUMELLES[m] || m) : s);
const renvoiLangue = a => { const h = a.getAttribute("href"), n = h && !a.dataset.langue ? versLangue(h) : h; if (n !== h) { a.setAttribute("href", n); a.removeAttribute("hreflang"); } };
document.addEventListener("click", e => { const a = e.target.closest && e.target.closest("a[href]"); if (!a) return; if (a.dataset.langue) choisitLangue(a.dataset.langue); else if (LANGUE === "en") renvoiLangue(a); });
if (LANGUE === "en") document.addEventListener("DOMContentLoaded", () => document.querySelectorAll("a[href]").forEach(renvoiLangue));

/* Les données en anglais : le français reste la clé. Chaque table data/en/*.json donne l'anglais de chaque texte français du fichier qu'elle
   traduit, et ses propres règles : _sauts, les champs laissés tels quels ; _facultatifs, ceux traduits seulement si la table les connaît (des noms
   propres, le plus souvent) ; _gardes, ceux qui gardent leur valeur française (le moteur de dessin et les adresses s'y lisent), l'anglais s'ajoutant
   à côté (nom → nomEn) depuis la partie de la table qu'ils désignent. Les autres textes sont remplacés. Une chaîne seule dans une liste n'est pas un texte
   (un identifiant de source), sauf sous une clé de _listes ; une chaîne sous une clé de _ids reste telle quelle (armes : une table ailleurs, un identifiant ici).
   Un texte sans traduction reste en français : tools/check_data.py le signale, avec les mêmes règles. */
const TABLES_EN = { "data/blasons.json": "data/en/cartes.json", "data/personnages.json": "data/en/cartes.json", "data/data.json": "data/en/encyclopedie.json", "data/frises.json": "data/en/lignees.json", "data/lignees.json": "data/en/lignees.json", "data/angleterre.json": "data/en/lignees.json", "data/bourgogne.json": "data/en/lignees.json", "data/ecosse.json": "data/en/lignees.json", "data/espagne.json": "data/en/lignees.json", "data/habsbourg.json": "data/en/lignees.json", "data/papaute.json": "data/en/lignees.json", "data/portugal.json": "data/en/lignees.json", "data/savoie.json": "data/en/lignees.json", "data/capetiens.json": "data/en/lignees.json", "data/transmission.json": "data/en/transmission.json" };
function traduit(o, T, cle) {
  if (Array.isArray(o)) return o.map(x => (typeof x === "string" && (T._listes || []).includes(cle) ? T.textes[x] || x : traduit(x, T, cle)));
  if (!o || typeof o !== "object") return o;
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    if (T._sauts.includes(k)) out[k] = v;
    else if (typeof v !== "string") out[k] = traduit(v, T, k);
    else if ((T._ids || []).includes(k)) out[k] = v;
    else if (k === "href") out[k] = versLangue(v);
    else if (T._gardes[k]) { out[k] = v; const e = T[T._gardes[k]][v]; if (e) out[k + "En"] = e; }
    else out[k] = versLangue(T.textes[v] || v);
  }
  return out;
}
const lisJson = async u => { const r = await fetch(u); if (!r.ok) throw new Error(`${u} : HTTP ${r.status}`); return r.json(); };
/* le titre d'une source reste celui de la page citée ; en anglais, seuls ses guillemets changent, et « Wikipédia » dit la langue de l'article */
const sourceLue = l => (LANGUE === "en" ? String(l).replace(/«\s*/g, "“").replace(/\s*»/g, "”").replace(/Wikipédia/g, "French Wikipedia") : l);
const TABLES_LUES = {};                            // une table sert à plusieurs fichiers : on ne la lit qu'une fois
async function lireDonnees(chemin) {
  const d = await lisJson(chemin);
  const table = LANGUE === "en" && TABLES_EN[chemin];
  return table ? traduit(d, await (TABLES_LUES[table] ||= lisJson(table))) : d;
}

/* Adresse d'un terme du glossaire : « terme-bande ». Quand deux termes ne diffèrent que par l'accent (Bande, Bandé),
   celui qui porte l'accent le garde dans son adresse (« terme-bandé ») : sans cela les deux auraient la même. */
function termeId(terme, glossaire) {
  const s = t => String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const id = s(terme), t = String(terme).toLowerCase();
  const double = glossaire.some(g => g.terme !== terme && s(g.terme) === id);
  return ("terme-" + (double && t !== id ? t.replace(/\s+/g, "-") : id)).normalize("NFC");
}

(function () {
  const PAGES = [
    ["jeu", "./", "L'Écu du jour"],
    ["jour", "jour.html", "Jeux du jour"],
    ["encyclopedie", "encyclopedie.html", "L'encyclopédie"],
    ["blasons", "blasons.html", "Blasons réels"],
    ["personnages", "personnages.html", "Personnages"],
    ["lignees", "lignees.html", "Lignées"],
    ["atelier", "atelier.html", "Atelier"],
    ["transmission", "transmission.html", "Transmission"],
    ["exercices", "exercices.html", "S'exercer"],
    ["recherche", "recherche.html", "Rechercher"],
  ];
  /* les rubriques du menu, toujours visibles ; une page qui n'y figure pas est un lien direct (l'Atelier, et Rechercher, en icône) */
  const RUBRIQUES = [[Tr("Jouer", "Play"), ["jeu", "jour", "exercices"]], [Tr("Apprendre", "Learn"), ["encyclopedie", "transmission"]], [Tr("Armoiries", "Arms"), ["blasons", "personnages", "lignees"]]];
  const NOMS_EN = { jeu: "Shield of the Day", jour: "Daily games", encyclopedie: "Encyclopedia", blasons: "Real arms", personnages: "People", lignees: "Lineages", atelier: "Atelier", transmission: "Transmission", exercices: "Practice", recherche: "Search" };
  const ACCUEIL = Tr("./", "en.html");
  const BRAND = `<a class="brand" href="${ACCUEIL}"><svg class="cross" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10 2h4v8h8v4h-8v8h-4v-8H2v-4h8z"/></svg>${Tr("L'Armorial", "The Armorial")}</a>`;
  const CHEVRON = `<svg class="chevron" viewBox="0 0 12 12" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M2.5 4.5 6 8l3.5-3.5"/></svg>`;
  const LOUPE = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="m15.5 15.5 5 5"/></svg>`;
  const SEAL = `<svg class="seal" viewBox="0 0 100 100" role="img" aria-label="${Tr("Sceau de cire", "Wax seal")}">
    <defs>
      <radialGradient id="wax" cx="38%" cy="32%" r="72%">
        <stop offset="0%" stop-color="#c0362f"/>
        <stop offset="58%" stop-color="#8e1b18"/>
        <stop offset="100%" stop-color="#5d0f0d"/>
      </radialGradient>
    </defs>
    <path fill="url(#wax)" d="M50,4 C62,4 70,10 78,14 C88,19 96,26 95,38 C94,49 88,55 88,64 C88,74 92,84 82,90 C72,96 63,92 52,93 C41,94 31,99 22,92 C13,85 16,74 13,64 C10,54 3,47 6,36 C9,25 20,20 28,14 C36,8 40,4 50,4 Z"/>
    <path fill="none" stroke="#4a0c0a" stroke-width="1.2" opacity=".5" d="M50,12 C72,12 88,28 88,50 C88,72 72,88 50,88 C28,88 12,72 12,50 C12,28 28,12 50,12 Z"/>
    <path fill="#e3c579" opacity=".92" d="M44 28h12v16h16v12H56v16H44V56H28V44h16z"/>
  </svg>`;

  /* le lien vers l'autre langue (le jeu a le sien, dans sa barre) */
  function choixLangue() {
    if (document.body.classList.contains("jeu")) return "";
    if (LANGUE === "en") return JUMELLE_FR[PAGE_ICI] ? `<a class="mast-langue" href="${JUMELLE_FR[PAGE_ICI]}" hreflang="fr" lang="fr" data-langue="fr" title="Lire en français">FR</a>` : "";
    return JUMELLES[PAGE_ICI] ? `<a class="mast-langue" href="${JUMELLES[PAGE_ICI]}" hreflang="en" lang="en" data-langue="en" title="Read in English">EN</a>` : "";
  }
  /* le bandeau : posé tout de suite, avant que le reste de la page ne s'affiche, pour que rien ne saute */
  const head = document.querySelector("header.mast[data-page]");
  if (head) {
    const here = head.dataset.page;
    const lien = (id, classe = "", contenu = null) => {
      const [, href, label] = PAGES.find(p => p[0] === id), classes = [classe, id === here && "here"].filter(Boolean).join(" ");
      return `<a href="${id === "jeu" ? ACCUEIL : versLangue(href)}"${classes ? ` class="${classes}"` : ""}${id === here ? ' aria-current="page"' : ""}>${contenu || (LANGUE === "en" ? NOMS_EN[id] : label)}</a>`;
    };
    const rubrique = ([nom, ids], i) => `<div class="rub"><button type="button" class="nav-t${ids.includes(here) ? " here" : ""}" aria-expanded="false" aria-controls="rub-${i}">${nom}${CHEVRON}</button><div class="rub-sous" id="rub-${i}" hidden>${ids.map(id => lien(id)).join("")}</div></div>`;
    head.insertAdjacentHTML("afterbegin", BRAND + `<nav id="nav-pages" aria-label="${Tr("Pages du site", "Site pages")}">` + RUBRIQUES.map(rubrique).join("") + lien("atelier", "nav-t")
      + lien("recherche", "nav-t nav-rech", `${LOUPE}<span>${LANGUE === "en" ? NOMS_EN.recherche : "Rechercher"}</span>`) + "</nav>" + choixLangue());
    /* qui lit en anglais et arrive sur une page qui n'est qu'en français le lit tout de suite, et sait comment revenir */
    if (LANGUE === "fr" && langueChoisie() === "en" && !JUMELLES[PAGE_ICI]) head.insertAdjacentHTML("afterend", `<p class="bandeau-langue" lang="en">This page is only available in French for now. <a href="en.html">Back to the game in English</a></p>`);
    /* une rubrique s'ouvre au clic ou au toucher, la même partout ; une seule à la fois. Elle se ferme à Échap, à un clic ailleurs, en suivant un lien, ou quand le clavier en sort. */
    const nav = head.querySelector("nav"), boutons = [...nav.querySelectorAll(".rub button")];
    const pose = (b, on) => { b.setAttribute("aria-expanded", on); document.getElementById(b.getAttribute("aria-controls")).hidden = !on; };
    const ferme = () => boutons.forEach(b => pose(b, false));
    boutons.forEach(b => b.addEventListener("click", () => { const on = b.getAttribute("aria-expanded") !== "true"; ferme(); pose(b, on); }));
    nav.addEventListener("click", e => { if (e.target.closest("a")) ferme(); });
    nav.addEventListener("focusout", e => { if (e.relatedTarget && !nav.contains(e.relatedTarget)) ferme(); });
    document.addEventListener("keydown", e => { if (e.key !== "Escape") return; const b = boutons.find(x => x.getAttribute("aria-expanded") === "true"); if (b) { ferme(); b.focus(); } });
    document.addEventListener("click", e => { if (!nav.contains(e.target)) ferme(); });
    addEventListener("pageshow", ferme);                          // au retour arrière, la page revient telle qu'on l'a quittée : le menu ne reste pas ouvert
    /* la hauteur du bandeau dépend de la page et de la largeur : les barres collantes et les ancres la lisent dans --mast */
    if (window.ResizeObserver) new ResizeObserver(() => document.documentElement.style.setProperty("--mast", `${head.offsetHeight}px`)).observe(head);
  }

  /* lien d'évitement : au clavier, un premier Tab propose de passer le menu (la page n'a pas de <main> unique partout : on prend le premier) */
  document.addEventListener("DOMContentLoaded", () => {
    const cible = document.querySelector("main") || document.getElementById("wrap");
    if (!cible || !head) return;
    if (!cible.id) cible.id = "contenu";
    cible.setAttribute("tabindex", "-1");
    head.insertAdjacentHTML("beforebegin", `<a class="skip" href="#${cible.id}">${Tr("Aller au contenu", "Skip to content")}</a>`);
  });

  /* le sceau : le pied de page n'existe pas encore à cet instant */
  document.addEventListener("DOMContentLoaded", () => {
    const foot = document.querySelector("footer");
    if (!foot) return;
    const pied = foot.querySelector(".foot") || foot;
    pied.insertAdjacentHTML("afterbegin", SEAL);
    /* signaler un problème, depuis toute page : le formulaire sait d'où l'on vient, ancre comprise */
    if (PAGE_ICI === "retour.html" || PAGE_ICI === "en-feedback.html") return;
    pied.insertAdjacentHTML("beforeend", `<p class="pied-retour"><a id="lien-retour" href="${Tr("retour.html", "en-feedback.html")}">${Tr("Signaler un problème ou suggérer une idée", "Report a problem or suggest an idea")}</a></p>`);
    document.getElementById("lien-retour").addEventListener("click", e => { e.currentTarget.href = `${Tr("retour.html", "en-feedback.html")}?depuis=${encodeURIComponent(PAGE_ICI + location.hash)}`; });
  });
})();
