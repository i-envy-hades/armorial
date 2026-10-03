/* L'ARMORIAL — éléments communs à toutes les pages : bandeau de navigation et sceau du pied de page.

   Pour ajouter une page au menu, il suffit d'ajouter une ligne à PAGES ci-dessous.

   Chaque page pose, tout en haut de son <body>, l'en-tête vide suivi de ce script :
     <header class="mast" data-page="atelier"></header>
     <script src="assets/chrome.js"></script>
   data-page est l'identifiant de la page dans PAGES ; l'en-tête garde ce qui lui est propre
   (la recherche, pour l'encyclopédie). Le pied de page reçoit le sceau en tête, ses textes restent à la page. */
(function () {
  const PAGES = [
    ["index", "index.html", "L'encyclopédie"],
    ["blasons", "blasons.html", "Blasons réels"],
    ["personnages", "personnages.html", "Personnages"],
    ["lignees", "lignees.html", "Lignées"],
    ["atelier", "atelier.html", "Atelier"],
  ];
  const BRAND = `<a class="brand" href="index.html"><svg class="cross" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10 2h4v8h8v4h-8v8h-4v-8H2v-4h8z"/></svg>L'Armorial</a>`;
  const SEAL = `<svg class="seal" viewBox="0 0 100 100" role="img" aria-label="Sceau de cire">
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

  /* le bandeau : posé tout de suite, avant que le reste de la page ne s'affiche, pour que rien ne saute */
  const head = document.querySelector("header.mast[data-page]");
  if (head) {
    const here = head.dataset.page;
    head.insertAdjacentHTML("afterbegin", BRAND + "<nav>" + PAGES.map(([id, href, label]) =>
      `<a href="${href}"${id === here ? ' class="here"' : ""}>${label}</a>`).join("") + "</nav>");
  }

  /* le sceau : le pied de page n'existe pas encore à cet instant */
  document.addEventListener("DOMContentLoaded", () => {
    const foot = document.querySelector("footer");
    if (foot) (foot.querySelector(".foot") || foot).insertAdjacentHTML("afterbegin", SEAL);
  });
})();
