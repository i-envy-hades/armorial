/* L'ARMORIAL — outil du curateur (tools/calendrier.html) : classe les cartes par difficulté et écrit les jours à venir dans la base. */
(async () => {
  "use strict";
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  /* l'écu des premiers jours, joués avec l'ancien calendrier (data/jeu.json, retiré) : il reste celui du niveau Chevalier */
  const ANCIEN = ["Luxembourg", "Georges Ier de Grèce", "Royaume de Gwynedd", "Allemagne", "Canton de Neuchâtel", "Duché de Gueldre", "Canton de Lucerne", "Maison de Hohenzollern", "Canton de Zurich", "Danemark", "Royaume du Hedjaz", "Arménie"];
  /* des personnages assez connus pour être devinés ; les autres cartes de Personnages restent des réponses possibles */
  const CONNUS = new Set(["Édouard III d'Angleterre", "Édouard de Woodstock, le Prince Noir", "Bertrand du Guesclin", "Jean-Baptiste Colbert", "Jules Mazarin", "Jacques Cœur", "Margrethe II",
    "Alexandre II de Russie", "Léopold Ier de Belgique", "Haakon VII", "Pie II", "Paul IV", "Georges Ier de Grèce", "René II de Lorraine"]);
  const RUBRIQUE = { "Europe d'aujourd'hui": -1, "Suisse": -0.5, "Provinces": 0.5, "Empires": 0.5, "Ordres": 1, "Maisons": 1.5, "Personnages": 2 };
  const NIV = ["page", "chevalier", "heraut"];

  /* ---------- les cartes et leur note de difficulté ---------- */
  await chargerLecteur();
  const [b, p] = await Promise.all(["data/blasons.json", "data/personnages.json"].map(u => fetch(u).then(r => r.json())));
  const cartes = [];
  for (const a of [...b.map(x => ({ ...x, cat: x.cat || "Blasons réels" })), ...p.filter(x => CONNUS.has(x.nom)).map(x => ({ ...x, cat: "Personnages" }))]) {
    if (!a.blason || !a.file) continue;
    const r = lireCarte(a);
    if (!r.ok) continue;
    const e = r.etat, S = normalizeAll({ ...fresh(), q: e.q, ab: e.ab, gb: e.gb || "", xc: e.xc || "", xb: e.xb || "", xp: e.xp || "", h1: e.h1, h2: e.h2, A: e.A.map(x => ({ ...x })) });
    cartes.push({ nom: a.nom, cat: a.cat, note: note(S, a.cat) });
  }
  function note(S, cat) {
    const idx = active(S), A = S.A;
    let s = S.q === "2" || S.q === "4" ? 3 : S.q ? 2 : 0;
    if (S.ab) s += 2;
    if (S.xc) s += 1;
    for (const i of idx) {
      const a = A[i];
      if (a.f !== "plein") s += 1;
      if (a.p) s += 1;
      for (const m of [a.m, a.m2]) if (m) s += Gen.FACILE.includes(m) ? 1 : 2;
      if (a.m && a.nb !== "1" && a.nb !== "seme") s += 0.5;
    }
    const emaux = new Set(idx.flatMap(i => { const a = A[i]; return [a.t1, a.f !== "plein" && a.t2, a.p && a.tp, a.m && a.tm]; }).filter(Boolean));
    return s + Math.max(0, emaux.size - 2) * 0.5 + (RUBRIQUE[cat] || 0);
  }
  cartes.sort((x, y) => x.note - y.note || x.nom.localeCompare(y.nom, "fr"));
  const tiers = Math.ceil(cartes.length / 3);
  const POOLS = { page: cartes.slice(0, tiers), chevalier: cartes.slice(tiers, 2 * tiers), heraut: cartes.slice(2 * tiers) };
  $("#niveaux").innerHTML = `${cartes.length} cartes lisibles : ${NIV.map(k => `<b>${k}</b> ${POOLS[k].length} (notes ${POOLS[k][0].note} à ${POOLS[k][POOLS[k].length - 1].note})`).join(" · ")}.
    <details><summary>Voir le classement</summary><table>${cartes.map(c => `<tr><td>${c.note}</td><td>${esc(c.nom)}</td><td>${esc(c.cat)}</td></tr>`).join("")}</table></details>`;

  /* ---------- la connexion ---------- */
  await Compte.pret;
  const qui = () => {
    if (!Compte.enLigne) { $("#qui").innerHTML = `<span class="err">Pas de base en ligne configurée (data/compte.json).</span>`; return; }
    const uid = Compte.uid();
    $("#qui").innerHTML = uid ? `Connecté. Votre uid : <code>${esc(uid)}</code> — c'est lui qui doit remplacer <code>UID_DU_CURATEUR</code> dans tools/firebase/firestore.rules.` : `Non connecté.`;
    $("#b-compte").hidden = !!uid;
  };
  qui();
  $("#b-compte").addEventListener("click", () => Compte.ouvre());
  if (Compte.surSynchro) Compte.surSynchro(qui);

  /* ---------- le tirage ---------- */
  const auj = Jour.numero();
  $("#auj").textContent = auj;
  const dejaEcrit = Compte.enLigne ? await Compte.jour(auj).catch(() => null) : null;      // le premier passage écrit depuis le jour n° 1
  $("#de").value = dejaEcrit ? auj + 1 : 1; $("#a").value = auj + 365;
  const hasard = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  const melange = a => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(hasard() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
  /* chaque niveau parcourt son tiers dans un ordre mélangé, puis recommence dans un autre ordre (pas deux fois la même carte de suite) */
  const tireur = liste => { let file = []; let dernier = ""; return () => { if (!file.length) { file = melange(liste.map(c => c.nom)); if (file[0] === dernier) file.push(file.shift()); } return (dernier = file.shift()); }; };
  let JOURS = [];
  const garde = () => { $("#garde").hidden = !(+$("#de").value <= auj); };
  $("#de").addEventListener("input", garde); garde();
  $("#b-prevoir").addEventListener("click", () => {
    const de = Math.max(1, +$("#de").value), a = Math.max(de, +$("#a").value);
    const t = Object.fromEntries(NIV.map(k => [k, tireur(POOLS[k])]));
    JOURS = [];
    for (let n = de; n <= a; n++) {
      const ecu = Object.fromEntries(NIV.map(k => [k, t[k]()]));
      if (n <= auj && ANCIEN[n - 1]) ecu.chevalier = ANCIEN[n - 1];
      for (const k of ["page", "heraut"]) while (ecu[k] === ecu.chevalier) ecu[k] = t[k]();
      JOURS.push({ n, champs: { ouvre: Jour.ouvre(n), ecu, graine: crypto.getRandomValues(new Uint32Array(1))[0] } });
    }
    $("#apercu").innerHTML = `<table class="${$("#voir").checked ? "" : "flou"}"><tr><th>n°</th><th>Page</th><th>Chevalier</th><th>Héraut</th></tr>${JOURS.slice(0, 60).map(j => `<tr><td>${j.n} (${esc(Jour.quand(j.n))})</td>${NIV.map(k => `<td>${esc(j.champs.ecu[k])}</td>`).join("")}</tr>`).join("")}</table>${JOURS.length > 60 ? `<p>… et ${JOURS.length - 60} jours de plus.</p>` : ""}`;
    $("#b-ecrire").disabled = !JOURS.length;
    $("#sortie").textContent = `${JOURS.length} jours prêts (n° ${de} à ${a}).`;
  });
  $("#voir").addEventListener("change", () => { const tb = $("#apercu table"); if (tb) tb.classList.toggle("flou", !$("#voir").checked); });
  $("#b-ecrire").addEventListener("click", async () => {
    const bt = $("#b-ecrire"); bt.disabled = true;
    $("#sortie").textContent = "Écriture…";
    try { await Compte.ecritJours(JOURS); $("#sortie").innerHTML = `<span class="ok">${JOURS.length} jours écrits (n° ${JOURS[0].n} à ${JOURS[JOURS.length - 1].n}).</span>`; }
    catch (e) { $("#sortie").innerHTML = `<span class="err">${esc(e.message)}</span>`; bt.disabled = false; }
  });
})();
