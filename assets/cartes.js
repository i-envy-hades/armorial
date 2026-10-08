/* L'ARMORIAL — adresses des cartes des galeries (Blasons réels, Personnages).
   Chaque carte a une adresse : blasons.html#royaume-de-france-moderne. On peut la citer, et la recherche du site y mène.
   Si le filtre en cours cache la carte visée, on le remet à zéro avant de s'y rendre. */
const slugCarte = nom => String(nom).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
function allerCarte(remetsAZero) {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch (e) { return; }                       // adresse mal formée : rien à faire
  if (!id) return;
  let carte = document.getElementById(id);
  if (!carte && remetsAZero) { remetsAZero(); carte = document.getElementById(id); }
  if (!carte || !carte.classList.contains("ar")) return;
  carte.scrollIntoView({ block: "center", behavior: "instant" });
  carte.classList.add("flash");
  setTimeout(() => carte.classList.remove("flash"), 2400);
}

/* Couleurs d'une image de Commons corrigées à l'affichage (champ « filtre » d'une carte) : le fichier reste celui de Commons,
   la carte dit ce qui a été changé. « inverse-or-azur » échange l'or et l'azur du dessin de Dan Koehl
   (or 252,227,62 ↔ azur 56,110,174 ; le noir et le blanc restent), pour Gregers Matsson (data/personnages.json). */
const FILTRES = {
  "inverse-or-azur": "-1.7081 1.9305 0.7776 0 0 -1.6166 2.1524 0.4642 0 0 1.5475 -1.1031 0.5557 0 0 0 0 0 1 0",
};
function styleFiltre(a) {
  const m = a && FILTRES[a.filtre];
  if (!m) return "";
  if (!document.getElementById("filtres-cartes")) document.body.insertAdjacentHTML("beforeend",
    `<svg id="filtres-cartes" width="0" height="0" style="position:absolute" aria-hidden="true">${Object.entries(FILTRES).map(([k, v]) =>
      `<filter id="f-${k}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${v}"/></filter>`).join("")}</svg>`);
  return ` style="filter:url(#f-${a.filtre})"`;
}

/* Un clic sur l'image d'une carte l'agrandit (boîte <dialog> : Échap ou un clic dehors la ferme) ; si l'écu menait à l'Atelier, la vue agrandie y renvoie. */
document.addEventListener("click", e => {
  const img = e.target.closest && e.target.closest(".ar .shield img");
  if (!img || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  const lien = img.closest("a.shield"), carte = img.closest(".ar"), titre = carte.querySelector("h3");
  let d = document.getElementById("agrandi");
  if (!d) {
    d = document.createElement("dialog"); d.id = "agrandi";
    d.addEventListener("click", ev => { if (ev.target === d || ev.target.closest(".ag-x")) d.close(); });
    document.body.appendChild(d);
  }
  const grand = img.currentSrc.replace(/([?&])width=\d+/, "$1width=1000") || img.src;
  d.innerHTML = `<button type="button" class="ag-x" aria-label="Fermer">×</button>
    <img src="${grand.replace(/"/g, "&quot;")}" alt="${(img.alt || "").replace(/"/g, "&quot;")}"${img.getAttribute("style") ? ` style="${img.getAttribute("style")}"` : ""}>
    <p class="ag-t">${titre ? titre.innerHTML : ""}${lien ? ` · <a href="${lien.getAttribute("href")}">Redessiner dans l'Atelier</a>` : ""}</p>`;
  d.showModal();
});
