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
