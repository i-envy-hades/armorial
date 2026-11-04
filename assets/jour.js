/* L'ARMORIAL — les jeux du jour : ce qu'ils ont en commun.

   - Le numéro du jour : n° 1 le 9 octobre 2026, un jour de plus à chaque minuit de Paris (le même pour tous, où qu'on joue).
   - Le document du jour : jours/{n} dans Firestore (assets/enligne.js, Compte.jour) — { ouvre, ecu: { page, chevalier, heraut }, graine }.
     La base ne le donne qu'une fois son heure d'ouverture passée (tools/firebase/firestore.rules) : les jours à venir ne sont lisibles
     nulle part, ni dans le site, ni dans son dépôt. Le curateur écrit le calendrier avec tools/calendrier.html.
   - Les carnets de chaque jeu (assets/compte.js) : parties, séries, répartition ; la fusion de deux appareils et les résultats envoyés au
     classement. Les accroches (Compte.fusion, Compte.scoresDe) sont posées dès le chargement de ce fichier, avant la synchronisation.
   Demande, chargés avant lui : assets/compte.js, assets/enligne.js. */
const Jour = (() => {
  "use strict";
  const DEBUT = Date.UTC(2026, 9, 9), ZONE = "Europe/Paris";
  const MOIS = Tr(["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"], ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]);
  const JOURS = Tr(["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"], ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
  const FMT = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23" });
  const aParis = t => Object.fromEntries(FMT.formatToParts(t).filter(p => p.type !== "literal").map(p => [p.type, +p.value]));

  /* ---------- le calendrier ---------- */
  const numero = (t = new Date()) => { const p = aParis(t); return Math.round((Date.UTC(p.year, p.month - 1, p.day) - DEBUT) / 864e5) + 1; };
  /* minuit à Paris, le jour n : l'instant où son document s'ouvre */
  const ouvre = n => { const u = DEBUT + (n - 1) * 864e5, p = aParis(new Date(u)); return new Date(u - (p.hour * 60 + p.minute) * 6e4); };
  const quand = n => { const d = new Date(DEBUT + (n - 1) * 864e5 + 432e5); return `${JOURS[d.getUTCDay()]} ${d.getUTCDate() === 1 ? Tr("1ᵉʳ", "1") : d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
  const avantDemain = () => Math.max(0, Math.round((ouvre(numero() + 1) - Date.now()) / 1000));
  const compteARebours = () => { const s = avantDemain(); return `${String(Math.floor(s / 3600)).padStart(2, "0")} h ${String(Math.floor(s / 60) % 60).padStart(2, "0")} min ${String(s % 60).padStart(2, "0")} s`; };

  /* ---------- le document du jour ---------- */
  const docs = new Map();
  /* { doc } si le jour est ouvert ; { manque: "hors-ligne" | "ferme" | "erreur", msg } sinon */
  async function charge(n) {
    if (docs.has(n)) return docs.get(n);
    await Compte.pret;
    let r;
    if (!Compte.enLigne || !Compte.jour) r = { manque: "hors-ligne", msg: Tr("Les jeux du jour se tirent de la base en ligne de l'Armorial, qui n'est pas configurée ici.", "The daily games come from the Armorial's online database, which isn't set up here.") };
    else {
      try { const d = await Compte.jour(n); r = d ? { doc: d } : { manque: "ferme", msg: Tr("Les jeux de ce jour ne sont pas encore prêts : revenez un peu plus tard.", "Today's games aren't ready yet: please come back a little later.") }; }
      catch (e) { r = { manque: "erreur", msg: Tr(`Les jeux du jour n'ont pas pu se charger (${e.message}).`, `The daily games couldn't load (${e.message}).`) }; }
    }
    if (r.doc) docs.set(n, r);
    return r;
  }
  /* un hasard propre à chaque jeu du jour : la même suite pour tous, ce jour-là seulement */
  const hasard = (doc, jeu) => Gen.mulberry((doc.graine >>> 0) ^ Gen.graine(jeu));

  /* ---------- les carnets ----------
     un carnet : { stats: { joues, gagnes, serie, serieMax, dernierGagne, rep }, jours: { n: { essais: [...], fini, gagne, note? } } }
     rep : la répartition des parties (par nombre d'essais gagnants, ou par note) ; score : ce qui part au classement (le plus petit gagne) ;
     coef : ce que vaut une victoire à ce niveau (voir le barème) */
  const JEUX = {
    ecu_page: { nom: "L'Écu du jour · Écuyer", rep: 8, coef: 1 },
    ecu: { nom: "L'Écu du jour · Chevalier", rep: 6, coef: 1.5 },
    ecu_heraut: { nom: "L'Écu du jour · Seigneur", rep: 5, coef: 2 },
    dessin: { nom: "Dessine-moi", rep: 3 },
    intrus: { nom: "L'Intrus", rep: 6, rang: j => j.note, score: j => 6 - j.note, marque: e => `${6 - e}/5` },
    trous: { nom: "Le blasonnement à trous", rep: 2 },
  };
  const rang = (jeu, j) => (JEUX[jeu].rang ? JEUX[jeu].rang(j) : j.gagne ? j.essais.length - 1 : -1);
  const score = (jeu, j) => (JEUX[jeu].score ? JEUX[jeu].score(j) : j.essais.length);
  const vide = jeu => ({ stats: { joues: 0, gagnes: 0, serie: 0, serieMax: 0, dernierGagne: 0, rep: new Array(JEUX[jeu].rep).fill(0) }, jours: {} });
  function applique(jeu, st, n, j) {
    st.joues++;
    if (j.gagne) { st.gagnes++; st.serie = (st.dernierGagne === n - 1 ? st.serie : 0) + 1; st.dernierGagne = n; st.serieMax = Math.max(st.serieMax, st.serie); }
    else st.serie = 0;
    const r = rang(jeu, j); if (r >= 0 && r < st.rep.length) st.rep[r]++;
  }
  /* les statistiques se refont depuis les jours joués : deux carnets (deux appareils) se fondent sans rien compter deux fois */
  const recalcule = (jeu, jours) => { const st = vide(jeu).stats; Object.keys(jours).map(Number).sort((a, b) => a - b).forEach(n => { if (jours[n] && jours[n].fini) applique(jeu, st, n, jours[n]); }); return st; };
  const meilleur = (a, b) => !a ? b : !b ? a : a.fini !== b.fini ? (a.fini ? a : b) : ((a.essais || []).length >= (b.essais || []).length ? a : b);     // un jour fini l'emporte, sinon la partie la plus avancée
  for (const jeu of Object.keys(JEUX)) {
    Compte.fusion[jeu] = (local, distant) => {
      const jours = {}, L = (local && local.jours) || {}, D = (distant && distant.jours) || {};
      for (const n of new Set([...Object.keys(L), ...Object.keys(D)])) jours[n] = meilleur(L[n], D[n]);
      return { stats: recalcule(jeu, jours), jours };
    };
    Compte.scoresDe[jeu] = c => Object.entries((c && c.jours) || {}).filter(([, j]) => j && j.fini).map(([n, j]) => ({ jour: +n, essais: Math.max(1, Math.min(12, score(jeu, j))), gagne: !!j.gagne, details: Array.isArray(j.details) ? Math.min(99, j.details.length) : 0 }));
    if (JEUX[jeu].coef) Compte.points[jeu] = (essais, details) => Math.round(JEUX[jeu].coef * Math.max(10, 100 - 15 * (essais - 1) - 3 * details));
  }
  /* le barème de l'Écu du jour (ci-dessus) : 100 points pour un écu trouvé du premier coup, 15 de moins par essai en plus, 3 de moins par détail,
     10 au moins, le tout multiplié selon le niveau ; une défaite ne rapporte rien. Rien de tout cela n'est enregistré : les points se recalculent
     à partir des essais et des détails, si bien que les parties déjà jouées comptent et que le barème peut changer. */
  const somme = garde => Object.keys(Compte.points).reduce((t, jeu) => t + Compte.scoresDe[jeu](Compte.carnet(jeu)).filter(x => x.gagne && garde(x)).reduce((a, x) => a + Compte.points[jeu](x.essais, x.details), 0), 0);
  const totalPoints = () => somme(() => true);
  /* la semaine va du lundi au dimanche, à l'heure de Paris : le n° 4, le lundi 12 octobre 2026, ouvre la semaine 1 */
  const semaine = (n = numero()) => Math.floor((n + 3) / 7);
  const pointsSemaine = (w = semaine()) => somme(x => semaine(x.jour) === w);
  /* les titres : les quatre grades des officiers d'armes (le glossaire, à « Héraut »), selon le total des points */
  const TITRES = [[250, Tr("Poursuivant d'armes", "Pursuivant")], [1000, Tr("Héraut", "Herald")], [5000, Tr("Maréchal d'armes", "Marshal of Arms")], [20000, Tr("Roi d'armes", "King of Arms")]].map(([seuil, nom]) => ({ seuil, nom }));
  const titre = points => [...TITRES].reverse().find(t => points >= t.seuil) || null;
  const titreSuivant = points => TITRES.find(t => points < t.seuil) || null;
  const ordinal = n => Tr(n === 1 ? "1ʳᵉ" : `${n}ᵉ`, `${n}${[, "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || "th"}`);
  /* le classement du jour d'un autre jeu (Dessine-moi, L'Intrus, les trous) : les dix meilleurs, ma place, la part de joueurs qui ont trouvé ;
     il se pose dans `el` à la fin de la partie, et rien ne s'affiche sans comptes en ligne */
  async function classement(el, jeu, n) {
    if (!el || !Compte.enLigne) return;
    let c;
    try { c = await Compte.classementJour(jeu, n, { frais: true }); await Promise.all(c.top.map(x => Compte.prepare(Compte.armesCode(x.armes)))); } catch (e) { return; }
    const esc = s => String(s).replace(/[&<>"]/g, x => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[x]));
    const moi = Compte.scoresDe[jeu](Compte.carnet(jeu)).find(x => x.jour === n && x.gagne), nom = (Compte.profil() || {}).pseudo, connecte = Compte.ligne && Compte.ligne.connecte();
    const marque = JEUX[jeu].marque || (e => Tr(`${e} essai${e > 1 ? "s" : ""}`, `${e} ${e > 1 ? "tries" : "try"}`));
    const rangDe = x => c.top.findIndex(y => y.points === x.points) + 1, r = moi ? c.points.filter(p => p > -moi.essais).length + 1 : 0;
    el.innerHTML = `<h3 class="cl-t">${Tr("Les meilleurs du jour", "Today's best")}</h3>
      ${c.joueurs ? `<p class="cl-note">${Tr(`${c.joueurs} joueur${c.joueurs > 1 ? "s" : ""} en ligne : ${Math.min(100, Math.round(100 * c.gagnants / c.joueurs))} % ont réussi`, `${c.joueurs} player${c.joueurs > 1 ? "s" : ""} online: ${Math.min(100, Math.round(100 * c.gagnants / c.joueurs))}% succeeded`)}</p>` : ""}
      ${c.top.length ? `<ol class="cl">${c.top.map(x => { const t = titre(x.cumul); return `<li data-r="${rangDe(x)}"${nom && x.pseudo.toLowerCase() === nom.toLowerCase() ? ' class="moi"' : ""}><span class="rg">${rangDe(x)}</span><span class="mini">${Compte.dessin(x.armes)}</span><b>${esc(x.pseudo)}${t ? `<small>${t.nom}</small>` : ""}</b><span class="sc">${marque(x.essais)}</span></li>`; }).join("")}</ol>` : `<p class="cl-vide">${Tr("Personne n'a encore réussi aujourd'hui.", "Nobody has succeeded today yet.")}</p>`}
      ${r ? `<p class="cl-place">${connecte ? Tr(`Votre place : <b>${ordinal(r)}</b> sur ${Math.max(c.gagnants, r)}`, `Your place: <b>${ordinal(r)}</b> of ${Math.max(c.gagnants, r)}`) : Tr(`Vous seriez à la <b>${ordinal(r)}</b> place sur ${c.gagnants + 1}`, `You'd be <b>${ordinal(r)}</b> of ${c.gagnants + 1}`)}</p>` : ""}`;
  }
  /* le carnet d'un jeu, prêt à servir : lire le jour n, l'enregistrer, le clore */
  function carnet(jeu) {
    let C = Compte.carnet(jeu) || vide(jeu);
    C.stats = { ...vide(jeu).stats, ...C.stats }; C.jours = C.jours || {};
    if (C.stats.rep.length !== JEUX[jeu].rep) C.stats = recalcule(jeu, C.jours);
    return {
      get C() { return C; },
      relit() { C = Compte.carnet(jeu) || C; return C; },
      jour: n => C.jours[n] || null,
      garde(n, j) { C.jours[n] = j; Compte.enregistre(jeu, C); },
      clos(n, j) { const deja = C.jours[n] && C.jours[n].fini; if (!deja) applique(jeu, C.stats, n, j); C.jours[n] = j; Compte.enregistre(jeu, C); },
      serie() { return C.stats.dernierGagne >= numero() - 1 ? C.stats.serie : 0; },
    };
  }
  /* fait aujourd'hui ? (pour l'accueil) */
  const fait = (jeu, n = numero()) => { const c = Compte.carnet(jeu); return !!(c && c.jours && c.jours[n] && c.jours[n].fini); };

  /* ---------- partager ---------- */
  async function partage(texte, sortie) {
    try { await navigator.clipboard.writeText(texte); if (sortie) sortie.textContent = "Copié : collez-le où vous voulez."; }
    catch (e) { window.prompt("Copiez votre résultat :", texte); }
  }

  return { numero, ouvre, quand, compteARebours, avantDemain, charge, hasard, JEUX, carnet, fait, totalPoints, semaine, pointsSemaine, titre, titreSuivant, ordinal, classement, partage };
})();
