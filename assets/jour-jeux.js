/* L'ARMORIAL — deux jeux du jour (jour.html) : « L'Intrus » (#intrus) et « Le blasonnement à trous » (#trous).

   L'Intrus : cinq manches de quatre écus ; dans chacune, un seul enfreint la règle des émaux (métal sur métal, couleur sur couleur).
   Le blasonnement à trous : un écu, son blasonnement, et quatre trous (émaux, pièce, meuble, nombre) à remplir ; deux essais.
   Les écus sont tirés par assets/generateur.js avec la graine du document du jour (assets/jour.js) : les mêmes pour tous, ce jour-là.
   Les carnets : « intrus » et « trous » (assets/jour.js). */
(async () => {
  "use strict";
  const ESC = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const MANCHES = [1, 1, 2, 2, 3], ESSAIS_TROUS = 2;
  const JEUX = {
    intrus: { titre: "L'<em>Intrus</em>", nom: "L'Intrus" },
    trous: { titre: "À <em>trous</em>", nom: "Le blasonnement à trous" },
  };
  const jeuDemande = () => (location.hash === "#trous" ? "trous" : "intrus");
  addEventListener("hashchange", () => location.reload());
  const JEU = jeuDemande();
  if (location.hash !== "#" + JEU) history.replaceState(null, "", "#" + JEU);
  document.title = `${JEUX[JEU].nom} — le jeu du jour de l'Armorial`;
  $("#jj-titre").innerHTML = JEUX[JEU].titre;
  document.querySelectorAll(".jj-onglets [data-jeu]").forEach(a => { const on = a.dataset.jeu === JEU; a.classList.toggle("on", on); if (on) a.setAttribute("aria-current", "page"); });

  /* ---------- le jour ---------- */
  const N = Jour.numero(), arret = msg => { $("#jj-chargement").textContent = msg; };
  try { await chargerLecteur(); } catch (e) { return arret(`Le jeu n'a pas pu se charger (${e.message}).`); }
  $("#gdefs").innerHTML = globalDefs();
  const t = await Jour.charge(N);
  if (!t.doc) return arret(t.msg);
  await Compte.pret;
  const K = Jour.carnet(JEU);
  let compteur = 0;
  async function ecu(St, etiquette) {
    await loadAll(St);
    const c = compose(St, "jj" + ++compteur);
    return `<svg class="ecu" viewBox="${c.vb.join(" ")}" ${etiquette ? `role="img" aria-label="${ESC(etiquette)}"` : 'aria-hidden="true"'}>${c.svg}</svg>`;
  }
  let minuteur = 0;
  function prochain(el, quoi) {
    const tic = () => { if (!document.body.contains(el)) return clearInterval(minuteur); el.textContent = `${quoi} dans ${Jour.compteARebours()}`; if (Jour.avantDemain() === 0) location.reload(); };
    clearInterval(minuteur); tic(); minuteur = setInterval(tic, 1000);
  }
  function resultat({ gagne, titre, dit, partage, quoi }) {
    const r = $("#jj-resultat");
    r.className = "jeu-resultat " + (gagne ? "ok" : "ko");
    r.innerHTML = `<h2>${titre}</h2><p class="res-dit">${dit}</p>
      <p class="res-actes"><button type="button" class="jx-go" id="jj-partage">Partager mon résultat</button><button type="button" class="jx-go jx-go-2" id="jj-voir-stats">Mes statistiques</button><span class="res-copie" id="jj-copie" role="status"></span></p>
      <p class="res-liens"><a href="./">L'écu du jour</a> · <a href="#${JEU === "intrus" ? "trous" : "intrus"}">${JEU === "intrus" ? "Le blasonnement à trous" : "L'Intrus"}</a> · <a href="atelier.html#defi=dessin">Dessine-moi</a></p>
      <p class="res-prochain" id="jj-prochain"></p>`;
    r.hidden = false;
    $("#jj-partage").addEventListener("click", () => Jour.partage(partage, $("#jj-copie")));
    $("#jj-voir-stats").addEventListener("click", () => ouvreStats());
    prochain($("#jj-prochain"), quoi);
    r.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth" });
  }

  /* ---------- les statistiques ---------- */
  function ouvreStats() {
    const s = K.relit().stats, max = Math.max(1, ...s.rep);
    const etiq = JEU === "intrus" ? i => `${i}/5` : i => `${i + 1}`;
    $("#jj-stats").innerHTML = `<h2 id="jj-stats-t">${ESC(JEUX[JEU].nom)} <small>vos statistiques</small></h2>
      <dl class="stats"><div><dt>Parties</dt><dd>${s.joues}</dd></div><div><dt>Victoires</dt><dd>${s.joues ? Math.round(100 * s.gagnes / s.joues) : 0}<small>%</small></dd></div><div><dt>Série</dt><dd>${K.serie()}</dd></div><div><dt>Record</dt><dd>${s.serieMax}</dd></div></dl>
      <h3 class="rep-t">${JEU === "intrus" ? "Parties par bonnes réponses" : "Victoires par nombre d'essais"}</h3>
      <ol class="rep">${s.rep.map((n, i) => `<li><span class="rn">${etiq(i)}</span><span class="rb"><i style="width:${n ? Math.max(9, Math.round(100 * n / max)) : 0}%">${n || ""}</i></span></li>`).join("")}</ol>`;
    $("#dlg-stats").showModal();
  }
  $("#jx-stats").addEventListener("click", ouvreStats);
  $("#dlg-stats").addEventListener("click", e => { if (e.target === e.currentTarget || e.target.closest("[data-fermer]")) e.currentTarget.close(); });

  /* ================= L'Intrus ================= */
  /* des armes régulières, dont un émail passe dans la classe (métal ou couleur) de ce qu'il couvre */
  function fautif(rng, niv) {
    for (let i = 0; i < 300; i++) {
      const St = Gen.clone(Gen.tireArmes(rng, niv)), a = St.A[0], cles = [];
      if (St.q || St.ab) continue;
      if (a.f === "plein" && a.p) cles.push(["tp", a.t1]);
      if (a.f === "plein" && a.m && a.pos !== "sur") cles.push(["tm", a.t1]);
      if (a.m && a.p && a.pos === "sur") cles.push(["tm", a.tp]);
      if (!cles.length) continue;
      const [k, dessous] = Gen.pick(rng, cles);
      a[k] = Gen.sameClass(rng, dessous);
      if (k === "tm" && !a.ta) a.ta = a.tm;
      if (Gen.valide(St, false) && ruleAll(St).length) return St;
    }
    return null;
  }
  function manche(rng, niv) {
    const bons = [], vus = new Set();
    for (let i = 0; bons.length < 3 && i < 60; i++) { const St = Gen.tireArmes(rng, niv), e = Gen.empreinte(St); if (!vus.has(e)) { vus.add(e); bons.push(St); } }
    const faux = fautif(rng, niv) || fautif(rng, 1);
    const ecus = Gen.melange(rng, [...bons.map(St => ({ St, faux: false })), { St: faux, faux: true }]);
    return { niv, ecus, fautes: ruleAll(faux) };
  }
  async function intrus() {
    const rng = Jour.hasard(t.doc, "intrus"), M = MANCHES.map(niv => manche(rng, niv));
    const sv = K.jour(N), J = sv ? { essais: [...sv.essais], fini: !!sv.fini, gagne: !!sv.gagne, note: sv.note || 0 } : { essais: [], fini: false, gagne: false, note: 0 };
    const juste = (i, c) => M[i].ecus[c].faux;
    const marques = () => J.essais.map((c, i) => (juste(i, c) ? "🟩" : "🟥")).join("");
    const box = $("#jj");
    async function montre(i, repondu) {
      const m = M[i], svgs = await Promise.all(m.ecus.map((e, k) => ecu(e.St, `Écu ${k + 1} : ${blazonAll(e.St)}`)));
      const choisi = J.essais[i];
      box.innerHTML = `<div class="jx-tete"><h2 class="jeu-jour">L'Intrus n° ${N}<small>${Jour.quand(N)}</small></h2><p class="jx-points" aria-hidden="true">${MANCHES.map((_, k) => `<i class="${k < J.essais.length ? (juste(k, J.essais[k]) ? "ok" : "no") : ""}"></i>`).join("")}</p><span class="jeu-essais">Manche ${i + 1} sur ${MANCHES.length}</span></div>
        <p class="jj-ask">Un de ces quatre écus <b>enfreint la règle des émaux</b> : métal sur métal, ou couleur sur couleur. Lequel ?</p>
        <div class="jj-ecus" role="group" aria-label="Les quatre écus">${m.ecus.map((e, k) => `<button type="button" class="jj-ecu${repondu ? (e.faux ? " ok" : k === choisi ? " ko" : " dim") : ""}" data-k="${k}"${repondu ? " disabled" : ""}>${svgs[k]}<span class="jj-k">${k + 1}</span></button>`).join("")}</div>
        ${repondu ? `<div class="jj-fb ${juste(i, choisi) ? "ok" : "ko"}"><p><b>${juste(i, choisi) ? "Bien vu." : "Non : c'était l'écu " + (m.ecus.findIndex(e => e.faux) + 1) + "."}</b> ${m.fautes.map(ESC).join(" ")}</p>
          <p class="jj-blz">«&nbsp;${ESC(blazonAll(m.ecus.find(e => e.faux).St))}&nbsp;»</p>
          ${i + 1 < MANCHES.length ? `<button type="button" class="jx-go" id="jj-suite">Manche suivante →</button>` : ""}</div>` : ""}`;
      box.querySelectorAll(".jj-ecu:not([disabled])").forEach(b => b.addEventListener("click", () => repond(i, +b.dataset.k)));
      const s = $("#jj-suite"); if (s) s.addEventListener("click", () => montre(i + 1, false));
    }
    async function repond(i, k) {
      if (J.fini || J.essais.length !== i) return;
      J.essais.push(k);
      J.note = J.essais.filter((c, n) => juste(n, c)).length;
      if (J.essais.length >= MANCHES.length) { J.fini = true; J.gagne = J.note >= 3; K.clos(N, { ...J }); }
      else K.garde(N, { ...J });
      await montre(i, true);
      if (J.fini) fin();
    }
    function fin() {
      const n = J.note;
      resultat({ gagne: J.gagne, titre: n === 5 ? "Sans faute !" : n >= 3 ? "Bien lu !" : "La règle est retorse…", quoi: "Prochaines manches",
        dit: `<b>${n}</b> intrus trouvé${n > 1 ? "s" : ""} sur ${MANCHES.length}. <a href="encyclopedie.html#emaux">Relire la règle des émaux</a>.`,
        partage: `L'Intrus n° ${N} — ${n}/${MANCHES.length}\n${marques()}\nhttps://armorial.web.app/jour.html#intrus` });
    }
    $("#jj-chargement").hidden = true; box.hidden = false;
    if (J.fini) { await montre(MANCHES.length - 1, true); fin(); }
    else await montre(J.essais.length, false);
    window.JeuDuJour = { jeu: "intrus", M, J, repond };
  }

  /* ================= Le blasonnement à trous ================= */
  const EMAUX = ["Or", "Argent", "Gueules", "Azur", "Sable", "Sinople", "Pourpre"];
  const NOMBRES = { 2: "deux", 3: "trois", 4: "quatre", 5: "cinq", 6: "six", 7: "sept", 8: "huit", 9: "neuf" };
  const DE = t => (/^[aeiouh]/.test(MOT[t]) ? "d'" : "de ") + MOT[t];
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  /* les trous possibles : [début, fin, juste, options, nature] dans le texte ; on en garde quatre, deux émaux au plus, sans chevauchement */
  function trous(rng) {
    for (let essai = 0; essai < 60; essai++) {
      const St = Gen.tireArmes(rng, 2), a = St.A[0], texte = blazonAll(St), bas = texte.toLowerCase(), C = [];
      const cherche = (mot, depuis = 0) => { const re = new RegExp(`(^|[\\s'])(${mot.replace(/[-]/g, "\\-")})(?=[\\s,;.]|$)`, "g"); re.lastIndex = depuis; const m = re.exec(bas); return m ? m.index + m[1].length : -1; };
      const pose = (i, juste, options, nature) => { if (i >= 0) C.push({ i, j: i + juste.length, juste, options, nature }); };
      if (a.f === "plein" && bas.startsWith(DE(a.t1))) C.push({ i: 0, j: DE(a.t1).length, juste: cap(DE(a.t1)), options: EMAUX.map(x => cap(DE(x))), nature: "email" });
      let ip = -1;
      if (a.p && PIECES[a.p]) {
        ip = cherche(a.p);
        const g = PIECES[a.p].g, pool = Gen.PIECES_N[3].filter(p => PIECES[p] && PIECES[p].g === g);
        pose(ip, a.p, pool, "piece");
        if (ip >= 0 && a.tp && !a.pcc) pose(bas.indexOf(" " + DE(a.tp), ip) + 1 || -1, DE(a.tp), EMAUX.map(DE), "email");
      }
      const m = a.m && meuble(a.m);
      if (m && a.nb !== "seme") {
        const plur = a.nb !== "1", nom = plur ? m.plur : m.sing, im = cherche(nom);
        const pool = Gen.poolMeubles(2).map(meuble).filter(x => x && x.g === m.g && !x.homonyme).map(x => (plur ? x.plur : x.sing));
        pose(im, nom, [...new Set(pool)], "meuble");
        if (plur && NOMBRES[a.nb] && im > 0) { const n = NOMBRES[a.nb]; if (bas.slice(im - n.length - 1, im - 1) === n) pose(im - n.length - 1, n, Object.values(NOMBRES), "nombre"); }
        if (im >= 0 && a.tm && !a.cc) pose(bas.indexOf(" " + DE(a.tm), im) + 1 || -1, DE(a.tm), EMAUX.map(DE), "email");
      }
      const tri = Gen.melange(rng, C.filter(c => c.options.includes(c.juste))), garde = [];
      for (const c of tri) {
        if (garde.length >= 4) break;
        if (c.nature === "email" && garde.filter(x => x.nature === "email").length >= 2) continue;
        if (garde.some(x => c.i < x.j && x.i < c.j)) continue;
        garde.push(c);
      }
      if (garde.length < 3) continue;
      garde.sort((x, y) => x.i - y.i);
      garde.forEach(c => { const autres = Gen.melange(rng, c.options.filter(o => o !== c.juste)).slice(0, c.nature === "email" ? 6 : 5); c.options = Gen.melange(rng, [c.juste, ...autres]); });
      return { St, texte, trous: garde };
    }
    return null;
  }
  async function aTrous() {
    const rng = Jour.hasard(t.doc, "trous"), Q = trous(rng);
    if (!Q) return arret("Le blasonnement du jour n'a pas pu se préparer.");
    const sv = K.jour(N), J = sv ? { essais: [...sv.essais], fini: !!sv.fini, gagne: !!sv.gagne, choix: sv.choix || [] } : { essais: [], fini: false, gagne: false, choix: [] };
    const box = $("#jj"), svg = await ecu(Q.St, "L'écu dont il faut compléter le blasonnement");
    const dernier = () => J.essais[J.essais.length - 1] || "";
    const bon = k => dernier()[k] === "1";
    function montre() {
      let h = "", pos = 0;
      Q.trous.forEach((c, k) => {
        h += ESC(Q.texte.slice(pos, c.i)); pos = c.j;
        const v = J.choix[k] || "";
        if (J.fini || bon(k)) h += `<span class="jj-trou ${bon(k) ? "ok" : "ko"}">${ESC(J.fini && !bon(k) ? c.juste : v)}</span>${J.fini && !bon(k) && v ? ` <s class="jj-faux">${ESC(v)}</s>` : ""}`;
        else h += `<select class="jj-trou${J.essais.length ? " ko" : ""}" data-k="${k}" aria-label="Trou ${k + 1}"><option value="">…</option>${c.options.map(o => `<option${o === v ? " selected" : ""}>${ESC(o)}</option>`).join("")}</select>`;
      });
      h += ESC(Q.texte.slice(pos));
      box.innerHTML = `<div class="jx-tete"><h2 class="jeu-jour">Le blasonnement à trous n° ${N}<small>${Jour.quand(N)}</small></h2><span class="jeu-essais">${J.fini ? (J.gagne ? `Trouvé en ${J.essais.length}` : "Perdu") : `Essai ${J.essais.length + 1} sur ${ESSAIS_TROUS}`}</span></div>
        <p class="jj-ask">Regardez l'écu, et rendez à son blasonnement les mots qui manquent.</p>
        <div class="jj-trous"><div class="jj-un">${svg}</div><p class="jj-texte">«&nbsp;${h}&nbsp;»</p></div>
        ${J.fini ? "" : `<p class="jj-acts"><button type="button" class="jx-go" id="jj-ok">Vérifier</button><span class="jj-aide" id="jj-aide" role="status"></span></p>`}`;
      box.querySelectorAll("select.jj-trou").forEach(s => s.addEventListener("change", () => { J.choix[+s.dataset.k] = s.value; s.classList.remove("ko"); }));
      const ok = $("#jj-ok"); if (ok) ok.addEventListener("click", verifie);
    }
    function verifie() {
      if (J.fini) return;
      if (Q.trous.some((c, k) => !bon(k) && !J.choix[k])) { $("#jj-aide").textContent = "Remplissez tous les trous."; return; }
      const v = Q.trous.map((c, k) => (J.choix[k] === c.juste ? "1" : "0")).join("");
      J.essais.push(v);
      if (!v.includes("0") || J.essais.length >= ESSAIS_TROUS) { J.fini = true; J.gagne = !v.includes("0"); K.clos(N, { ...J }); }
      else K.garde(N, { ...J });
      montre();
      if (J.fini) fin();
    }
    function fin() {
      const grille = J.essais.map(v => [...v].map(c => (c === "1" ? "🟩" : "⬜")).join("")).join("\n");
      resultat({ gagne: J.gagne, titre: J.gagne ? (J.essais.length === 1 ? "Du premier coup !" : "Bien lu !") : "Presque…", quoi: "Prochain blasonnement",
        dit: J.gagne ? `Tous les trous remplis${J.essais.length === 1 ? " du premier coup" : " en deux essais"}.` : "Les bonnes réponses sont dans le texte. <a href=\"encyclopedie.html#glossaire\">Le glossaire</a> aide à les retenir.",
        partage: `Le blasonnement à trous n° ${N} — ${J.gagne ? J.essais.length : "X"}/${ESSAIS_TROUS}\n${grille}\nhttps://armorial.web.app/jour.html#trous` });
    }
    $("#jj-chargement").hidden = true; box.hidden = false;
    montre();
    if (J.fini) fin();
    window.JeuDuJour = { jeu: "trous", Q, J, verifie };
  }

  if (JEU === "intrus") await intrus(); else await aTrous();
})();
