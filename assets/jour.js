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
  const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const FMT = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23" });
  const aParis = t => Object.fromEntries(FMT.formatToParts(t).filter(p => p.type !== "literal").map(p => [p.type, +p.value]));

  /* ---------- le calendrier ---------- */
  const numero = (t = new Date()) => { const p = aParis(t); return Math.round((Date.UTC(p.year, p.month - 1, p.day) - DEBUT) / 864e5) + 1; };
  /* minuit à Paris, le jour n : l'instant où son document s'ouvre */
  const ouvre = n => { const u = DEBUT + (n - 1) * 864e5, p = aParis(new Date(u)); return new Date(u - (p.hour * 60 + p.minute) * 6e4); };
  const quand = n => { const d = new Date(DEBUT + (n - 1) * 864e5 + 432e5); return `${JOURS[d.getUTCDay()]} ${d.getUTCDate() === 1 ? "1ᵉʳ" : d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
  const avantDemain = () => Math.max(0, Math.round((ouvre(numero() + 1) - Date.now()) / 1000));
  const compteARebours = () => { const s = avantDemain(); return `${String(Math.floor(s / 3600)).padStart(2, "0")} h ${String(Math.floor(s / 60) % 60).padStart(2, "0")} min ${String(s % 60).padStart(2, "0")} s`; };

  /* ---------- le document du jour ---------- */
  const docs = new Map();
  /* { doc } si le jour est ouvert ; { manque: "hors-ligne" | "ferme" | "erreur", msg } sinon */
  async function charge(n) {
    if (docs.has(n)) return docs.get(n);
    await Compte.pret;
    let r;
    if (!Compte.enLigne || !Compte.jour) r = { manque: "hors-ligne", msg: "Les jeux du jour se tirent de la base en ligne de l'Armorial, qui n'est pas configurée ici." };
    else {
      try { const d = await Compte.jour(n); r = d ? { doc: d } : { manque: "ferme", msg: "Les jeux de ce jour ne sont pas encore prêts : revenez un peu plus tard." }; }
      catch (e) { r = { manque: "erreur", msg: `Les jeux du jour n'ont pas pu se charger (${e.message}).` }; }
    }
    if (r.doc) docs.set(n, r);
    return r;
  }
  /* un hasard propre à chaque jeu du jour : la même suite pour tous, ce jour-là seulement */
  const hasard = (doc, jeu) => Gen.mulberry((doc.graine >>> 0) ^ Gen.graine(jeu));

  /* ---------- les carnets ----------
     un carnet : { stats: { joues, gagnes, serie, serieMax, dernierGagne, rep }, jours: { n: { essais: [...], fini, gagne, note? } } }
     rep : la répartition des parties (par nombre d'essais gagnants, ou par note) ; score : ce qui part au classement (le plus petit gagne) */
  const JEUX = {
    ecu_page: { nom: "L'Écu du jour · Page", rep: 8 },
    ecu: { nom: "L'Écu du jour · Chevalier", rep: 6 },
    ecu_heraut: { nom: "L'Écu du jour · Héraut", rep: 5 },
    dessin: { nom: "Dessine-moi", rep: 3 },
    intrus: { nom: "L'Intrus", rep: 6, rang: j => j.note, score: j => 6 - j.note },
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
    Compte.scoresDe[jeu] = c => Object.entries((c && c.jours) || {}).filter(([, j]) => j && j.fini).map(([n, j]) => ({ jour: +n, essais: Math.max(1, Math.min(12, score(jeu, j))), gagne: !!j.gagne }));
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

  return { numero, ouvre, quand, compteARebours, avantDemain, charge, hasard, JEUX, carnet, fait, partage };
})();
