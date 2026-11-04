/* L'ARMORIAL — « Mon armorial » (mon-armorial.html, en-my-armorial.html) : la collection du joueur.
   Les cases sont les écus déjà ouverts, tous niveaux : ceux des jours écoulés (Jour.ecusOuverts). Pas les écus à venir, que nul ne doit connaître,
   ni ceux qui ne sortiront peut-être jamais : une case vide peut toujours se remplir, et mène à sa partie.
   Une case se remplit dès que l'écu de ce jour et de ce niveau a été trouvé, le jour même ou en le rejouant (Jour.etatDuJour) : rien de plus n'est enregistré. */
(async () => {
  "use strict";
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const NIVEAUX = { page: { jeu: "ecu_page", nom: Tr("Écuyer", "Squire") }, chevalier: { jeu: "ecu", nom: Tr("Chevalier", "Knight") }, heraut: { jeu: "ecu_heraut", nom: Tr("Seigneur", "Lord") } };
  const ACCUEIL = Tr("./", "en.html");
  const SILHOUETTE = `<svg viewBox="0 0 200 252" aria-hidden="true"><path d="M18,16 L182,16 L182,120 C182,178 146,214 100,236 C54,214 18,178 18,120 Z"/></svg>`;
  const etat = $("#ma-etat");

  let cartes, trad = {};
  try {
    await chargerLecteur();
    const [b, p] = await Promise.all(["data/blasons.json", "data/personnages.json"].map(lireDonnees));
    if (LANGUE === "en") trad = await lisJson("data/en/vocabulaire.json");
    cartes = new Map([...b.map(a => ({ ...a, gal: "blasons", cat: a.cat || "Blasons réels" })), ...p.map(a => ({ ...a, gal: "personnages", cat: "Personnages" }))].map(a => [a.nom, a]));
  } catch (e) { etat.textContent = Tr(`Votre armorial n'a pas pu s'ouvrir (${e.message}).`, `Your armorial couldn't open (${e.message}).`); return; }
  $("#gdefs").innerHTML = globalDefs();
  await Compte.pret;
  const ouverts = await Jour.ecusOuverts();
  const rubrique = cat => (trad.rubriques && trad.rubriques[cat]) || cat;

  /* un écu : son premier jour trouvé, sinon son premier jour à tenter */
  const ecus = new Map();
  const auj = Jour.numero();
  for (const n of Object.keys(ouverts).map(Number).sort((x, y) => x - y)) {
    for (const [niv, v] of Object.entries(NIVEAUX)) {
      const nom = ouverts[n][niv], a = cartes.get(nom);
      if (!a || !a.blason) continue;
      const lu = lireCarte(a);
      if (!lu.ok) continue;
      const e = ecus.get(nom) || { a, lu, trouve: null, attente: null };
      const r = Jour.etatDuJour(v.jeu, n);
      if (r === "gagne" && !e.trouve) e.trouve = { n, niv };
      if (r === "" && !e.attente) e.attente = { n, niv };
      if (!e.reprise) e.reprise = { n, niv };                    // tout a été tenté et manqué : on peut rejouer le premier
      ecus.set(nom, e);
    }
  }
  if (!ecus.size) { etat.textContent = Tr("Votre armorial a besoin de la base en ligne pour s'ouvrir : réessayez dans un moment.", "Your armorial needs the online database to open: please try again in a moment."); return; }

  /* le dessin : seuls les écus trouvés ; les cases vides ne disent rien de l'écu qu'elles attendent */
  const liste = [...ecus.values()], trouves = liste.filter(e => e.trouve);
  let compteur = 0;
  async function svgDe(e, classe) {
    const St = armesDeCarte(e.lu.etat);
    await loadAll(St);
    const r = compose(St, "ma" + ++compteur);
    return `<svg class="${classe}" viewBox="${r.vb.join(" ")}" aria-hidden="true">${r.svg}</svg>`;
  }
  await Promise.all(trouves.map(async e => { try { e.svg = await svgDe(e, "ecu"); } catch (x) { e.svg = SILHOUETTE; } }));

  const adresseCase = ({ n, niv }) => `${ACCUEIL}?niveau=${niv}${n === auj ? "" : `#n=${n}`}`;
  const caseDe = e => {
    if (e.trouve) return `<li><button type="button" class="ma-case" data-nom="${esc(e.a.nom)}">${e.svg}<span>${esc(nomCarte(e.a))}</span></button></li>`;
    const c = e.attente || e.reprise;
    return `<li><a class="ma-vide${e.attente ? "" : " manque"}" href="${esc(adresseCase(c))}" aria-label="${esc(Tr(`Écu n° ${c.n}, niveau ${NIVEAUX[c.niv].nom} : à trouver`, `Shield #${c.n}, ${NIVEAUX[c.niv].nom} level: to find`))}">${SILHOUETTE}<span>${Tr(`n° ${c.n}`, `#${c.n}`)}</span></a></li>`;
  };
  const rubriques = [...new Set(liste.map(e => e.a.cat))].map(cat => ({ cat, l: liste.filter(e => e.a.cat === cat) }));
  rubriques.sort((x, y) => y.l.filter(e => e.trouve).length - x.l.filter(e => e.trouve).length || y.l.length - x.l.length);
  $("#ma-livre").innerHTML = rubriques.map(({ cat, l }) => {
    const f = l.filter(e => e.trouve);
    return `<section class="ma-rub"><h2>${esc(rubrique(cat))} <small>${f.length} / ${l.length}</small></h2><ol class="ma-grille">${[...f.sort((x, y) => x.trouve.n - y.trouve.n), ...l.filter(e => !e.trouve)].map(caseDe).join("")}</ol></section>`;
  }).join("");

  const pct = Math.round(100 * trouves.length / liste.length);
  const bilan = $("#ma-bilan");
  bilan.innerHTML = `<p class="ma-compte"><b>${trouves.length}</b> ${Tr(`écu${trouves.length > 1 ? "s" : ""} sur ${liste.length} déjà ouverts`, `of ${liste.length} shields opened so far`)}</p>
    <div class="ma-barre" role="img" aria-label="${pct} %"><i style="width:${pct}%"></i></div>
    <p class="ma-suite">${Tr("De nouveaux écus s'ouvrent chaque jour. Les écus rejoués comptent aussi, sans points.", "New shields open every day. Replayed shields count too, without points.")} <a href="${ACCUEIL}#archives">${Tr("Les écus passés", "Past shields")}</a></p>`;
  bilan.hidden = false;
  etat.hidden = true;

  /* un écu trouvé : ce qu'il y a à en retenir */
  const dlg = $("#ma-detail");
  $("#ma-livre").addEventListener("click", async ev => {
    const b = ev.target.closest(".ma-case"); if (!b) return;
    const e = ecus.get(b.dataset.nom), a = e.a, grand = e.svg.replace('class="ecu"', 'class="ecu grand"');
    const lien = versLangue(`${a.gal === "blasons" ? "blasons" : "personnages"}.html#${slugCarte(a.nom)}`);
    $("#ma-detail-c").innerHTML = `${grand}<h2 id="ma-detail-t">${esc(nomCarte(a))}</h2>
      ${a.porteur || a.meta ? `<p class="ma-porteur">${esc(a.porteur || a.meta)}</p>` : ""}
      <p class="ma-blason"><i>${esc(blasonCarte(a))}</i></p>
      ${a.desc ? `<p>${esc(a.desc)}</p>` : ""}
      <p class="ma-trouve">${Tr(`Trouvé le n° ${e.trouve.n}, ${Jour.quand(e.trouve.n)}, au niveau ${NIVEAUX[e.trouve.niv].nom}`, `Found on #${e.trouve.n}, ${Jour.quand(e.trouve.n)}, at ${NIVEAUX[e.trouve.niv].nom} level`)}</p>
      <p class="ma-liens"><a href="${esc(lien)}">${Tr("Voir la carte et son image réelle", "See the card and its real image")}</a> · <a href="${esc(adresseAtelier(a, a.gal))}">${Tr("Redessiner dans l'Atelier", "Redraw it in the Atelier")}</a></p>`;
    dlg.showModal();
  });
  dlg.addEventListener("click", ev => { if (ev.target === dlg || ev.target.closest("[data-fermer]")) dlg.close(); });
})();
