/* L'ARMORIAL — S'exercer : des questions pour apprendre à lire un blason.

   Rien n'y est écrit à la main : les écus sont composés au hasard par le moteur de l'Atelier (assets/dessin.js), leur
   blasonnement est celui que l'Atelier écrit (assets/blasonnement.js), et une question n'est posée que si le lecteur
   (assets/lecture.js) relit ce texte à l'identique — ce qu'on demande de lire est donc sans ambiguïté.
   Les mauvaises réponses sont des écus voisins (un seul trait change), filtrés de la même façon.

   Six exercices : lire un écu (texte à trouver), dessiner des armes (écu à trouver), la règle des émaux, le vocabulaire
   (glossaire de l'encyclopédie), les points de l'écu, et le défi du jour (six questions, les mêmes pour tous : la graine est la date).
   Seul le navigateur garde la trace des séries (localStorage, facultatif : la page marche sans).
   En anglais (en-practice.html), le tirage se fait sur le français, pour que le défi du jour reste le même pour tous : seul le texte montré change (blazonLu, ruleLue). */
(async () => {
  const { METAUX, COULEURS, COULEURS_P, clone, mulberry, graine, pick, melange, PIECES_1, poolMeubles, contre, valide, tireArmes, voisines, difference } = Gen;
  const mois = Tr(["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"], ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]);
  /* le nom qu'on montre : en anglais, à côté du français qui sert de clé (données : lireDonnees, assets/chrome.js) */
  const nomLu = a => a.nomEn || a.nom, blasonLuCarte = a => a.blasonEn || a.blason;
  const termeLu = e => e.termeEn || e.terme, defLue = e => (e.defEn || e.def).replace(/<[^>]+>/g, "");      // en anglais, la définition marque en italique ses mots français : ici, du texte seul
  const piecePrecise = p => (enAnglais() ? "the " + (PIECE_EN[p] || p) : art(p, PIECES[p].g) + p);
  const leMeuble = n => (n === "1" ? Tr("le meuble", "the charge") : Tr("les meubles", "the charges"));
  const leChamp = Tr("le champ", "the field");
  const NATURE = t => (classe(t) === "Métal" ? Tr("un métal", "a metal") : Tr("une couleur", "a colour"));

  /* « Lecture guidée » : le champ, puis la pièce, puis les meubles — l'ordre de lecture du blason */
  function decoupe(a) {
    const bz = enAnglais() ? blazonEn : blazon;
    const plein = bz(a), champ = bz({ ...a, m: "", m2: "", p: "", ln: "" }).replace(Tr(/ plein$/, / plain$/), "");
    const sansM = a.p ? bz({ ...a, m: "", m2: "" }) : champ;
    if (!plein.startsWith(champ)) return null;
    const out = [[Tr("Le champ", "The field"), champ]];
    if (a.p && sansM.startsWith(champ) && plein.startsWith(sansM)) {
      out.push([Tr("La pièce", "The ordinary"), sansM.slice(champ.length).replace(/^,?\s*/, "")]);
      const reste = plein.slice(sansM.length).replace(/^,?\s*/, "");
      if (reste) out.push([Tr("Les meubles", "The charges"), reste]);
    } else if (!a.p) {
      const reste = plein.slice(champ.length).replace(/^,?\s*/, "");
      if (reste) out.push([Tr("Les meubles", "The charges"), reste]);
    } else return null;
    return out.length > 1 ? out : null;
  }
  const sluge = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const lienAtelier = St => `<a href="${versLangue("atelier.html")}#lire=${encodeURIComponent(blazonAll(St))}">${Tr("Ouvrir ces armes dans l'Atelier", "Open these arms in the Atelier")}</a>`;

  /* ---------- dessiner ---------- */
  let compteurEcu = 0;
  async function ecu(St, etiquette) {
    await loadAll(St);
    const c = compose(St, "x" + ++compteurEcu);
    return `<svg class="ecu" viewBox="${c.vb.join(" ")}" ${etiquette === null ? 'aria-hidden="true"' : `role="img" aria-label="${esc(etiquette)}"`}>${c.svg}</svg>`;
  }

  /* ---------- les questions ---------- */
  const LETTRES = ["A", "B", "C", "D"];
  const guillemets = t => Tr(`«&nbsp;${t}&nbsp;»`, `“${t}”`);
  async function qLire(rng, niv, dessiner) {
    let St, vs;
    for (let essai = 0; essai < 8; essai++) { St = tireArmes(rng, niv); vs = voisines(rng, St, 3); if (vs.length === 3) break; }   // des armes trop simples n'ont pas trois voisines : on en tire d'autres
    const choix = melange(rng, [{ St, ok: true }, ...vs.map(v => ({ St: v, ok: false }))]).map(c => ({ ...c, texte: blazonLu(c.St) }));
    return { type: dessiner ? "dessiner" : "lire", niv, St, texte: blazonLu(St), fr: blazonAll(St), choix };
  }
  function qRegle(rng, niv) {
    const veut = rng() < .5;                           // la réponse attendue : armes régulières, ou non
    for (let i = 0; i < 200; i++) {
      const s = { ...ADEF, m: "", p: "", pos: "autour", nb: "3", f: "plein", ct: "" };
      s.t1 = pick(rng, [...METAUX, ...COULEURS_P]);
      const forme = niv === 1 ? pick(rng, ["meuble", "piece"]) : pick(rng, ["meuble", "piece", "charge", "charge"]);
      let paires = [];
      if (forme === "meuble") { s.m = pick(rng, poolMeubles(niv === 3 ? 2 : niv)); s.nb = pick(rng, ["1", "3"]); s.tm = pick(rng, [...METAUX, ...COULEURS_P]); s.ta = s.tm; paires = [{ fig: s.tm, sur: s.t1, quoi: leMeuble(s.nb), lieu: leChamp }]; }
      else if (forme === "piece") { s.p = pick(rng, PIECES_1); s.tp = pick(rng, [...METAUX, ...COULEURS_P]); paires = [{ fig: s.tp, sur: s.t1, quoi: piecePrecise(s.p), lieu: leChamp }]; }
      else {
        s.p = pick(rng, ["fasce", "bande", "pal", "chevron", "croix", "chef"]); s.tp = contre(rng, s.t1, COULEURS_P); s.pos = "sur"; s.m = pick(rng, poolMeubles(2)); s.nb = pick(rng, ["1", "3"]);
        s.tm = pick(rng, [...METAUX, ...COULEURS_P]); s.ta = s.tm;
        paires = [{ fig: s.tm, sur: s.tp, quoi: leMeuble(s.nb), lieu: piecePrecise(s.p) }];
      }
      const St = fresh(); St.A[0] = s;
      if (!valide(St, false)) continue;
      if ((ruleAll(St).length === 0) !== veut) continue;
      return { type: "regle", niv, St, texte: blazonLu(St), paires, fautes: ruleLue(St) };
    }
    const St = fresh(); St.A[0] = { ...ADEF, t1: "Azur", m: "fleurdelis", nb: "3", tm: "Or", ta: "Or" }; normalizeAll(St);
    return { type: "regle", niv, St, texte: blazonLu(St), paires: [{ fig: "Or", sur: "Azur", quoi: leMeuble("3"), lieu: leChamp }], fautes: [] };
  }
  /* le vocabulaire : le glossaire, plus (aux niveaux 2 et 3) les attributs, les positions et le répertoire */
  function reserveVocab(niv) {
    const en = e => ({ termeEn: e.termeEn, defEn: e.defEn });      // la réserve se choisit sur le français : le défi du jour reste le même dans les deux langues
    const g = DATA.glossaire.map(e => ({ terme: e.terme, def: e.def, gloss: true, ...en(e) }));
    const a = [...DATA.attributs, ...DATA.positions].map(e => ({ terme: e.terme, def: e.def, gloss: DATA.glossaire.some(x => x.terme === e.terme), ...en(e) }));
    const r = DATA.repertoire.map(e => ({ terme: e.terme, def: e.def, cat: e.cat, ...en(e) }));
    const tout = niv === 1 ? g.filter(e => e.def.length <= 120) : niv === 2 ? [...g, ...a] : [...g, ...a, ...r];
    const vus = new Set(); return tout.filter(e => e.def.length >= 20 && e.def.length <= 260 && !vus.has(e.terme) && vus.add(e.terme));
  }
  /* la définition ne doit pas contenir le mot qu'on cherche : on le masque (sa racine, aux accords près) */
  function masque(e) {
    const racines = (e.termeEn ? [e.termeEn, e.terme] : [e.terme]).flatMap(t => {
      const racine = plie(t).replace(/[^a-z]/g, "");
      return [racine.length > 5 ? racine.slice(0, -2) : racine.length > 3 ? racine.slice(0, -1) : racine, ...plie(t).split(/[^a-z]+/).filter(m => m.length > 3).map(m => (m.length > 5 ? m.slice(0, -2) : m))];
    });
    const cache = (p, r) => (LANGUE === "en" && r.length <= 3 ? p === r : p.startsWith(r));      // en anglais, « or » ne doit pas masquer « ordinary »
    return defLue(e).replace(/[A-Za-zÀ-ÖØ-öø-ÿŒœ]+/g, w => { const p = plie(w); return racines.some(r => cache(p, r)) ? "▁▁▁▁" : w; });
  }
  function qVocab(rng, niv) {
    const pool = reserveVocab(niv), cible = pick(rng, pool);
    const ressemble = e => e.terme !== cible.terme && (cible.cat ? e.cat === cible.cat : !e.cat);
    let autres = melange(rng, pool.filter(ressemble)).slice(0, 3);
    if (autres.length < 3) autres = melange(rng, pool.filter(e => e.terme !== cible.terme)).slice(0, 3);
    const choix = melange(rng, [{ e: cible, ok: true }, ...autres.map(e => ({ e, ok: false }))]).map(c => ({ ...c, texte: termeLu(c.e) }));
    return { type: "vocab", niv, cible, def: masque(cible), choix };
  }
  /* les points de l'écu : neuf cases, nommées du point de vue du porteur */
  const POINTS = Tr([["Canton dextre du chef", "Chef", "Canton senestre du chef"], ["Flanc dextre", "Cœur", "Flanc senestre"], ["Canton dextre de la pointe", "Pointe", "Canton senestre de la pointe"]],
    [["Dexter chief", "Middle chief", "Sinister chief"], ["Dexter flank", "Fess point", "Sinister flank"], ["Dexter base", "Middle base", "Sinister base"]]);
  const POINTS_AU = Tr([["en haut à gauche", "en haut au centre", "en haut à droite"], ["au milieu à gauche", "au centre", "au milieu à droite"], ["en bas à gauche", "en bas au centre", "en bas à droite"]],
    [["top left", "top centre", "top right"], ["middle left", "centre", "middle right"], ["bottom left", "bottom centre", "bottom right"]]);
  function qPoints(rng) {
    const r = Math.floor(rng() * 3), c = Math.floor(rng() * 3), nom = POINTS[r][c];
    const miroir = c === 1 ? null : POINTS[r][2 - c];
    const autres = POINTS.flat().filter(n => n !== nom && n !== miroir);
    const choix = melange(rng, [nom, ...(miroir ? [miroir] : []), ...melange(rng, autres).slice(0, miroir ? 2 : 3)]).map(n => ({ texte: n, ok: n === nom }));
    return { type: "points", niv: 1, r, c, nom, choix };
  }
  function svgPoints(r, c, deco) {
    const gx = [0, 72, 128, 200], gy = [0, 86, 166, 252], id = "pt" + ++compteurEcu;
    return `<svg class="ecu" viewBox="0 0 200 252" ${deco ? 'aria-hidden="true"' : `role="img" aria-label="${Tr(`Un écu dont le point marqué est ${POINTS_AU[r][c]}, du point de vue du spectateur`, `A shield with the point marked at the ${POINTS_AU[r][c]}, as the viewer sees it`)}"`}><defs><clipPath id="${id}"><path d="${SHIELD_D}"/></clipPath></defs>
      <path d="${SHIELD_D}" fill="#f3eee0"/>
      <g clip-path="url(#${id})"><rect x="${gx[c]}" y="${gy[r]}" width="${gx[c + 1] - gx[c]}" height="${gy[r + 1] - gy[r]}" fill="#8e1b18" opacity=".42"/>
        <g stroke="#cabf9f" stroke-width="1"><line x1="0" y1="86" x2="200" y2="86"/><line x1="0" y1="166" x2="200" y2="166"/><line x1="72" y1="0" x2="72" y2="252"/><line x1="128" y1="0" x2="128" y2="252"/></g>
        <circle cx="${(gx[c] + gx[c + 1]) / 2}" cy="${(gy[r] + gy[r + 1]) / 2}" r="5" fill="#8e1b18"/></g>
      <path d="${SHIELD_D}" fill="none" stroke="#1a1712" stroke-width="2.4"/></svg>`;
  }

  /* armes réelles (data/blasons.json) : à qui sont ces armes, ou lequel de ces blasonnements est le leur ? Les écus sont pondérés par 1/√(taille de leur rubrique) : la Suisse (27 cartes) ne fait pas deux questions sur cinq, ni une rubrique d'un seul écu une question sur sept. */
  let BL = [];
  function tireParRubrique(rng, pool) {
    const taille = {};
    pool.forEach(a => { taille[a.cat] = (taille[a.cat] || 0) + 1; });
    const poids = pool.map(a => 1 / Math.sqrt(taille[a.cat]));
    let t = rng() * poids.reduce((x, y) => x + y, 0);
    for (let i = 0; i < pool.length; i++) { t -= poids[i]; if (t < 0) return pool[i]; }
    return pool[pool.length - 1];
  }
  function qReel(rng) {
    const pool = BL.filter(a => a.file && a.blason), cible = tireParRubrique(rng, pool), variante = rng() < .5 ? "nom" : "texte";
    const memeCat = melange(rng, pool.filter(a => a !== cible && a.cat === cible.cat && a.blason !== cible.blason));
    const autres = [...memeCat, ...melange(rng, pool.filter(a => a !== cible && a.cat !== cible.cat && a.blason !== cible.blason))].slice(0, 3);
    const choix = melange(rng, [{ a: cible, ok: true }, ...autres.map(a => ({ a, ok: false }))]).map(c => ({ ...c, texte: variante === "nom" ? nomLu(c.a) : blasonLuCarte(c.a) }));
    return { type: "reel", niv: 1, variante, cible, choix, indice: memeCat.length >= 3 ? cible.cat : "" };   // la rubrique n'est donnée que si elle n'élimine pas les autres réponses
  }
  const imageReelle = a => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(a.file)}?width=320`;

  /* ---------- les exercices proposés ---------- */
  const EXOS = {
    lire: { titre: Tr("Lire un écu", "Read a shield"), court: Tr("Le texte de ces armes", "The text of these arms"), desc: Tr("Un écu est dessiné : retrouvez le blasonnement qui le décrit parmi quatre propositions voisines.", "A shield is drawn: find the blazon that describes it among four close variants."), niveaux: true, fabrique: (rng, niv) => qLire(rng, niv, false) },
    dessiner: { titre: Tr("Dessiner des armes", "Picture the arms"), court: Tr("L'écu de ce texte", "The shield of this text"), desc: Tr("Un blasonnement est donné : choisissez l'écu qu'il décrit, parmi quatre dessins.", "A blazon is given: choose the shield it describes, among four drawings."), niveaux: true, fabrique: (rng, niv) => qLire(rng, niv, true) },
    regle: { titre: Tr("La règle des émaux", "The rule of tincture"), court: Tr("Régulières ou non ?", "Regular or not?"), desc: Tr("Métal sur métal, couleur sur couleur : ces armes respectent-elles la règle de contrariété ?", "Metal on metal, colour on colour: do these arms keep the rule of tincture?"), niveaux: true, fabrique: async (rng, niv) => qRegle(rng, niv) },
    vocab: { titre: Tr("Le vocabulaire", "The vocabulary"), court: Tr("Le bon mot", "The right word"), desc: Tr("Une définition du glossaire, le terme caché : lequel est-ce ?", "A definition from the glossary, with the term hidden: which is it?"), niveaux: true, fabrique: async (rng, niv) => qVocab(rng, niv) },
    reel: { titre: Tr("Armes réelles", "Real arms"), court: Tr("À qui, et que disent-elles ?", "Whose are they, and what do they say?"), desc: Tr("Des armoiries de la page « Blasons réels » : retrouvez leur porteur, ou lequel de quatre blasonnements est le leur.", "Arms from the “Real arms” page: find their bearer, or which of four blazons is theirs."), niveaux: false, fabrique: async rng => qReel(rng) },
    points: { titre: Tr("Les points de l'écu", "The points of the shield"), court: Tr("Dextre, senestre, chef, pointe…", "Dexter, sinister, chief, base…"), desc: Tr("Un point est marqué sur l'écu : comment le nomme-t-on ? Le piège : on parle du côté du porteur, pas du vôtre.", "A point is marked on the shield: what is it called? The trap: sides are named from the bearer's point of view, not yours."), niveaux: false, fabrique: async rng => qPoints(rng) },
    defi: { titre: Tr("Défi du jour", "Daily challenge"), court: Tr("Six questions, les mêmes pour tous", "Six questions, the same for everyone"), desc: Tr("Chaque jour, six questions tirées d'après la date : les mêmes pour tout le monde. À partager, si l'on veut.", "Every day, six questions drawn from the date: the same for everyone. To share, if you like."), niveaux: false },
  };
  const NIV_AIDE = Tr({ 1: "Un meuble, une pièce : les armes les plus simples.", 2: "Partitions, bordures, pièces chargées, meubles plus rares.", 3: "Écartelé, sur le tout, semés, deux meubles, bords décorés." },
    { 1: "One charge, one ordinary: the simplest arms.", 2: "Divisions, bordures, charged ordinaries, rarer charges.", 3: "Quarterings, an escutcheon over all, semés, two charges, decorated lines." });
  const NIV_NOM = Tr({ 1: "Facile", 2: "Moyen", 3: "Difficile" }, { 1: "Easy", 2: "Medium", 3: "Hard" });
  const DEFI = [["lire", 1], ["lire", 2], ["dessiner", 2], ["regle", 2], ["vocab", 2], ["points", 1]];

  /* ---------- la mémoire du navigateur (facultative) ---------- */
  const CLE = "armorial.exercices.v1";
  let MEM = { niv: "1", stats: {}, defi: null };
  try { const m = JSON.parse(localStorage.getItem(CLE) || "null"); if (m && typeof m === "object") MEM = { ...MEM, ...m }; } catch (e) { /* navigation privée : on joue sans mémoire */ }
  const sauve = () => { try { localStorage.setItem(CLE, JSON.stringify(MEM)); } catch (e) { /* idem */ } };
  const stat = id => (MEM.stats[id] = MEM.stats[id] || { n: 0, ok: 0, serie: 0 });

  /* ---------- le déroulement ---------- */
  const el = { menu: $("#ex-menu"), cartes: $("#ex-cartes"), arene: $("#ex-arene"), q: $("#ex-q"), fb: $("#ex-fb"), suite: $("#ex-suite"), titre: $("#ex-titre"), score: $("#ex-score") };
  let J = null;                                        // la partie en cours : { id, niv, n, ok, serie, serieMax, defi, q, repondu, marques }

  const aujourdhui = () => { const d = new Date(); return { cle: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, txt: `${d.getDate() === 1 ? Tr("1ᵉʳ", "1") : d.getDate()} ${mois[d.getMonth()]} ${d.getFullYear()}` }; };

  async function nouvelleQuestion() {
    el.suite.hidden = true; el.fb.innerHTML = ""; el.fb.className = "ex-fb";
    el.q.innerHTML = `<p class="ex-chargement">${Tr("Les écus se préparent…", "The shields are being prepared…")}</p>`;
    let id = J.id, niv = J.niv, rng = Math.random;
    if (J.defi) { [id, niv] = DEFI[J.n]; rng = mulberry(graine(`${J.defi.cle}:${J.n}`)); }
    const q = await EXOS[id].fabrique(rng, niv);
    J.q = q; J.repondu = false;
    await affiche(q);
    majBarre();
    el.q.focus({ preventScroll: true });
  }
  const contenu = (c, i) => `<span class="k" aria-hidden="true">${LETTRES[i]}</span>`;
  async function affiche(q) {
    let h = "";
    if (q.type === "lire") {
      h = `<p class="ex-ask">${Tr("Quel blasonnement décrit cet écu ?", "Which blazon describes this shield?")}</p><div class="ex-ecu">${await ecu(q.St, Tr("Écu à décrire", "Shield to describe"))}</div>
        <div class="ex-choix" role="group" aria-label="${Tr("Propositions", "Choices")}">${q.choix.map((c, i) => `<button type="button" class="ex-c" data-i="${i}">${contenu(c, i)}<span class="t">${esc(c.texte)}</span></button>`).join("")}</div>`;
    } else if (q.type === "dessiner") {
      const svgs = await Promise.all(q.choix.map((c, i) => ecu(c.St, `${Tr("Écu", "Shield")} ${LETTRES[i]}`)));
      h = `<p class="ex-ask">${Tr("Quel écu correspond à ce blasonnement ?", "Which shield matches this blazon?")}</p><p class="ex-blz">${guillemets(esc(q.texte))}</p>
        <div class="ex-ecus" role="group" aria-label="${Tr("Propositions", "Choices")}">${q.choix.map((c, i) => `<button type="button" class="ex-c ex-cecu" data-i="${i}" aria-label="${Tr("Écu", "Shield")} ${LETTRES[i]}">${contenu(c, i)}${svgs[i]}<span class="ex-sous" hidden></span></button>`).join("")}</div>`;
    } else if (q.type === "regle") {
      h = `<p class="ex-ask">${Tr("Ces armes respectent-elles la règle des émaux ?", "Do these arms keep the rule of tincture?")}</p><div class="ex-ecu">${await ecu(q.St, Tr("Armes à juger", "Arms to judge"))}</div><p class="ex-blz">${guillemets(esc(q.texte))}</p>
        <div class="ex-choix ex-deux" role="group" aria-label="${Tr("Réponses", "Answers")}"><button type="button" class="ex-c" data-i="0"><span class="k" aria-hidden="true">1</span><span class="t">${Tr("Oui, elles la respectent", "Yes, they keep it")}</span></button><button type="button" class="ex-c" data-i="1"><span class="k" aria-hidden="true">2</span><span class="t">${Tr("Non, elles l'enfreignent", "No, they break it")}</span></button></div>`;
    } else if (q.type === "vocab") {
      h = `<p class="ex-ask">${Tr("De quel terme du blason s'agit-il ?", "Which heraldic term is this?")}</p><blockquote class="ex-def">${esc(q.def)}</blockquote>
        <div class="ex-choix ex-courts" role="group" aria-label="${Tr("Propositions", "Choices")}">${q.choix.map((c, i) => `<button type="button" class="ex-c" data-i="${i}">${contenu(c, i)}<span class="t">${esc(c.texte)}</span></button>`).join("")}</div>`;
    } else if (q.type === "reel") {
      const qst = q.variante === "nom" ? Tr("À qui sont ces armes ?", "Whose arms are these?") : Tr("Quel blasonnement décrit ces armes ?", "Which blazon describes these arms?");
      h = `<p class="ex-ask">${qst}</p><div class="ex-ecu ex-reel"><img src="${esc(imageReelle(q.cible))}" alt="${Tr("Armoiries à identifier", "Arms to identify")}" width="240" referrerpolicy="no-referrer"></div>${q.indice ? `<p class="ex-indice">${Tr("Rubrique de la galerie :", "Gallery section:")} ${esc(q.indice)}</p>` : ""}
        <div class="ex-choix${q.variante === "nom" ? " ex-courts" : ""}" role="group" aria-label="${Tr("Propositions", "Choices")}">${q.choix.map((c, i) => `<button type="button" class="ex-c" data-i="${i}">${contenu(c, i)}<span class="t">${esc(c.texte)}</span></button>`).join("")}</div>`;
    } else if (q.type === "points") {
      h = `<p class="ex-ask">${Tr("Comment nomme-t-on le point marqué sur l'écu ?", "What is the point marked on the shield called?")}</p><div class="ex-ecu">${svgPoints(q.r, q.c)}</div>
        <div class="ex-choix ex-courts" role="group" aria-label="${Tr("Propositions", "Choices")}">${q.choix.map((c, i) => `<button type="button" class="ex-c" data-i="${i}">${contenu(c, i)}<span class="t">${esc(c.texte)}</span></button>`).join("")}</div>`;
    }
    el.q.innerHTML = h;
  }

  function reponds(i) {
    if (!J || J.repondu || !J.q) return;
    const q = J.q, boutons = [...el.q.querySelectorAll(".ex-c")];
    const juste = q.type === "regle" ? (i === 0) === (q.fautes.length === 0) : q.choix[i].ok;
    J.repondu = true; J.n++; if (juste) { J.ok++; J.serie++; J.serieMax = Math.max(J.serieMax, J.serie); } else J.serie = 0;
    if (J.defi) J.marques.push(juste);
    const s = stat(J.defi ? "defi" : J.id); s.n++; if (juste) { s.ok++; s.serie++; s.serieMax = Math.max(s.serieMax || 0, s.serie); } else s.serie = 0; sauve();
    boutons.forEach((b, k) => {
      b.disabled = true;
      const bon = q.type === "regle" ? (k === 0) === (q.fautes.length === 0) : q.choix[k].ok;
      b.classList.add(bon ? "ok" : k === i ? "ko" : "dim");
      if (k === i) b.setAttribute("aria-pressed", "true");
    });
    if (q.type === "dessiner") boutons.forEach((b, k) => { const sous = $(".ex-sous", b); sous.hidden = false; sous.innerHTML = q.choix[k].ok ? esc(q.choix[k].texte) : difference(q.texte, q.choix[k].texte); });
    if (q.type === "lire") boutons.forEach((b, k) => { if (!q.choix[k].ok) $(".t", b).innerHTML = difference(q.texte, q.choix[k].texte); });
    el.fb.className = "ex-fb " + (juste ? "ok" : "ko");
    el.fb.innerHTML = `<p class="ex-verdict">${juste ? Tr("Bien vu.", "Well spotted.") : Tr("Pas tout à fait.", "Not quite.")}</p>` + explication(q, juste, i);
    el.suite.hidden = false;
    el.suite.textContent = J.defi && J.n >= DEFI.length ? Tr("Voir mon résultat →", "See my result →") : Tr("Question suivante →", "Next question →");
    majBarre();
    el.suite.focus({ preventScroll: true });
    el.fb.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth" });
  }

  /* les figures empruntées à Commons dans les écus montrés : leurs crédits, comme sous chaque écu de l'Atelier */
  function credits(sts) {
    const vus = new Map(); sts.forEach(St => creditsOf(St).forEach(c => vus.set(c.commons || c.origine, c)));
    return vus.size ? `<p class="ex-credits">${creditsHtml([...vus.values()])}</p>` : "";
  }
  function explication(q, juste, choisi) {
    let h = "";
    const retenir = texte => { const ts = termesDe(texte); return ts.length ? `<p class="ex-retenir"><span>${Tr("À retenir", "Worth remembering")}</span> ${ts.map(lienTermeLu).join(" · ")}</p>` : ""; };      // les mots se cherchent dans le texte français
    const guide = St => { const d = !St.q && !St.ab && decoupe(St.A[0]); return d ? `<dl class="ex-guide">${d.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : ""; };
    if (q.type === "lire" || q.type === "dessiner") {
      h += `<p>${q.type === "lire" ? Tr("Le blasonnement de cet écu", "The blazon of this shield") : Tr("Le blasonnement", "The blazon")}${Tr(" :", ":")} <i>${guillemets(esc(q.texte))}</i>.</p>`;
      h += guide(q.St);
      if (!juste) h += `<p class="ex-aide">${Tr("Les mots qui diffèrent de la bonne réponse sont soulignés dans chaque proposition.", "The words that differ from the right answer are underlined in each choice.")}</p>`;
      h += retenir(q.fr) + `<p class="ex-lien">${lienAtelier(q.St)}</p>` + credits(q.type === "lire" ? [q.St] : q.choix.map(c => c.St));
    } else if (q.type === "regle") {
      const par = q.paires.map(p => Tr(`${cap(p.quoi)} ${de(p.fig)} (${NATURE(p.fig)}) sur ${p.lieu} ${de(p.sur)} (${NATURE(p.sur)})`, `${cap(p.quoi)} ${emailLu(p.fig).toLowerCase()} (${NATURE(p.fig)}) on ${p.lieu} ${emailLu(p.sur).toLowerCase()} (${NATURE(p.sur)})`));
      if (q.fautes.length) h += Tr(`<p>${q.fautes.map(f => esc(f.replace(/ : ([A-ZÉ])/g, (m, c) => " : " + c.toLowerCase()))).join(" ")} La règle interdit de poser métal sur métal ou couleur sur couleur : la figure se lit mal à distance.</p><p class="ex-aide">Si un blason réel enfreint la règle de propos délibéré, on dit de ses armes qu'elles sont « à enquérir » — l'exemple classique est le royaume de Jérusalem : d'argent à la croix potencée d'or.</p>`,
        `<p>${q.fautes.map(f => esc(f)).join(" ")} The rule forbids setting metal on metal or colour on colour: the figure is hard to read at a distance.</p><p class="ex-aide">When real arms break the rule on purpose, they are called arms of enquiry (<i lang="fr">à enquérir</i>). The classic example is the Kingdom of Jerusalem: argent, a cross potent or.</p>`);
      else h += Tr(`<p>${esc(par.join(" ; "))} : l'un se détache de l'autre, la règle est respectée.</p>`, `<p>${esc(par.join("; "))}: one stands out against the other, so the rule is kept.</p>`);
      h += `<p class="ex-lien"><a href="${versLangue("encyclopedie.html")}#emaux">${Tr("Relire le chapitre « Les émaux »", "Reread the chapter “Tinctures”")}</a> · ${lienAtelier(q.St)}</p>` + credits([q.St]);
    } else if (q.type === "vocab") {
      const e = q.cible, lien = e.gloss ? ` · <a href="${versLangue("encyclopedie.html")}#${termeId(e.terme, DATA.glossaire)}">${Tr("dans le glossaire", "in the glossary")}</a>` : "";
      h += `<p><b>${esc(termeLu(e))}</b>${Tr(" :", ":")} ${esc(defLue(e))}${lien}</p>`;
    } else if (q.type === "reel") {
      const a = q.cible, lis = (() => { try { return lireCarte(a).ok; } catch (e) { return false; } })();
      h += `<p><b>${esc(nomLu(a))}</b>${a.porteur ? ` — ${esc(a.porteur)}` : ""}.</p><p>${Tr("Blasonnement :", "Blazon:")} <i>${guillemets(esc(blasonLuCarte(a)))}</i>.</p>`;
      h += retenir(a.blason) + `<p class="ex-lien"><a href="${versLangue("blasons.html")}#${sluge(a.nom)}">${Tr("Voir la carte dans « Blasons réels »", "See the card in “Real arms”")}</a>${lis ? ` · <a href="${versLangue("atelier.html")}#lire=${encodeURIComponent(texteAtelier(a))}">${Tr("Redessiner dans l'Atelier", "Redraw it in the Atelier")}</a>` : ""}</p>`;
      h += `<p class="ex-credits">${Tr("Illustration :", "Image:")} <a href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(a.file)}" target="_blank" rel="noopener">${Tr("« ", "“")}${esc(a.file)}${Tr(" »", "”")}</a> — ${esc(a.auteur)}, <a href="${esc(a.licurl)}" target="_blank" rel="noopener">${esc(a.lic)}</a>, via Wikimedia Commons.</p>`;
    } else if (q.type === "points") {
      h += Tr(`<p>Le point marqué est ${POINTS_AU[q.r][q.c]} pour qui regarde l'écu : c'est le <b>${esc(q.nom.toLowerCase())}</b>.</p>`, `<p>The marked point is at the ${POINTS_AU[q.r][q.c]} to anyone looking at the shield: it is the <b>${esc(q.nom.toLowerCase())}</b>.</p>`);
      if (q.c !== 1) h += `<p class="ex-aide">${q.c === 0 ? Tr("Dextre, c'est la droite du porteur de l'écu : elle se trouve donc à gauche pour qui le regarde.", "Dexter is the right of the person bearing the shield, so it appears on the left to anyone looking at it.") : Tr("Senestre, c'est la gauche du porteur de l'écu : elle se trouve donc à droite pour qui le regarde.", "Sinister is the left of the person bearing the shield, so it appears on the right to anyone looking at it.")} ${Tr("C'est l'erreur la plus commune du débutant.", "It is the most common beginner's mistake.")}</p>`;
      h += `<p class="ex-lien"><a href="${versLangue("encyclopedie.html")}#ecu">${Tr("Relire le chapitre « L'écu »", "Reread the chapter “The shield”")}</a></p>`;
    }
    return h;
  }

  function majBarre() {
    if (!J) return;
    const nom = J.defi ? Tr(`Défi du ${J.defi.txt}`, `Challenge of ${J.defi.txt}`) : `${EXOS[J.id].titre}${EXOS[J.id].niveaux ? " · " + NIV_NOM[J.niv] : ""}`;
    el.titre.textContent = nom;
    if (J.defi) el.score.innerHTML = Tr(`Question <b>${Math.min(J.n + (J.repondu ? 0 : 1), DEFI.length)}</b> sur ${DEFI.length} · <b>${J.ok}</b> juste${J.ok > 1 ? "s" : ""}`, `Question <b>${Math.min(J.n + (J.repondu ? 0 : 1), DEFI.length)}</b> of ${DEFI.length} · <b>${J.ok}</b> right`);
    else el.score.innerHTML = Tr(`<b>${J.ok}</b> juste${J.ok > 1 ? "s" : ""} sur ${J.n} · série <b>${J.serie}</b>${J.serieMax > 2 ? ` (meilleure : ${J.serieMax})` : ""}`, `<b>${J.ok}</b> right out of ${J.n} · streak <b>${J.serie}</b>${J.serieMax > 2 ? ` (best: ${J.serieMax})` : ""}`);
  }

  function resultatDefi() {
    el.suite.hidden = true; el.fb.className = "ex-fb"; el.fb.innerHTML = "";
    const marques = J.marques.map(b => (b ? "🟩" : "🟥")).join(""), ok = J.ok;
    MEM.defi = { date: J.defi.cle, marques: J.marques.map(b => (b ? 1 : 0)).join("") }; sauve();
    const texte = Tr(`L'Armorial · S'exercer — défi du ${J.defi.txt}\n${marques}  ${ok}/${DEFI.length}\nhttps://armorial.web.app/exercices.html#defi`, `The Armorial · Practice — challenge of ${J.defi.txt}\n${marques}  ${ok}/${DEFI.length}\nhttps://armorial.web.app/en-practice.html#defi`);
    const mot = ok === DEFI.length ? Tr("Sans faute : un héraut n'aurait pas mieux lu.", "Flawless: a herald could not have read it better.") : ok >= 4 ? Tr("Une belle lecture.", "A fine reading.") : ok >= 2 ? Tr("Le blason s'apprend : voyez les chapitres cités dans les réponses.", "Heraldry can be learned: see the chapters cited in the answers.") : Tr("Le début d'un long apprentissage — revenez demain.", "The start of a long apprenticeship. Come back tomorrow.");
    el.q.innerHTML = `<div class="ex-final"><p class="ex-ask">${Tr(`Défi du ${esc(J.defi.txt)}`, `Challenge of ${esc(J.defi.txt)}`)}</p><p class="ex-grille" aria-label="${Tr(`${ok} bonnes réponses sur ${DEFI.length}`, `${ok} right answers out of ${DEFI.length}`)}">${marques}</p><p class="ex-note-final"><b>${ok}</b> ${Tr("sur", "out of")} ${DEFI.length}. ${mot}</p>
      <div class="acts"><button type="button" class="main" id="ex-copie">${Tr("Copier le résultat", "Copy the result")}</button><button type="button" id="ex-menu-b">${Tr("Autres exercices", "Other exercises")}</button></div><p class="ex-aide">${Tr("Demain, six autres questions. Le résultat est gardé dans ce navigateur, nulle part ailleurs.", "Tomorrow, six more questions. The result stays in this browser and nowhere else.")}</p></div>`;
    $("#ex-copie").addEventListener("click", async e => { try { await navigator.clipboard.writeText(texte); e.target.textContent = Tr("Copié", "Copied"); } catch (x) { e.target.textContent = Tr("Copiez : ", "Copy: ") + marques; } });
    $("#ex-menu-b").addEventListener("click", versMenu);
    majBarre();
  }

  async function demarre(id) {
    const niv = +MEM.niv || 1;
    J = { id, niv, n: 0, ok: 0, serie: 0, serieMax: 0, defi: id === "defi" ? aujourdhui() : null, marques: [], q: null, repondu: false };
    el.menu.hidden = true; el.arene.hidden = false;
    history.replaceState(null, "", "#" + id);
    scrollTo({ top: Math.max(0, el.arene.getBoundingClientRect().top + scrollY - 70), behavior: "auto" });
    await nouvelleQuestion();
  }
  function versMenu() {
    J = null; el.arene.hidden = true; el.menu.hidden = false; history.replaceState(null, "", location.pathname);
    cartes();
  }
  el.suite.addEventListener("click", () => { if (J.defi && J.n >= DEFI.length) resultatDefi(); else nouvelleQuestion(); });
  $("#ex-retour").addEventListener("click", versMenu);
  el.q.addEventListener("click", e => { const b = e.target.closest(".ex-c"); if (b) reponds(+b.dataset.i); });
  document.addEventListener("keydown", e => {
    if (!J || e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (!J.repondu && J.q) { const i = "1234".includes(k) && k ? +k - 1 : "abcd".indexOf(k); if (i >= 0 && i < el.q.querySelectorAll(".ex-c").length) { e.preventDefault(); reponds(i); } }
    else if (J.repondu && (k === "enter" || k === " ") && !el.suite.hidden && document.activeElement !== el.suite) { e.preventDefault(); el.suite.click(); }
  });

  /* ---------- le menu : un écu d'exemple sur chaque carte ---------- */
  const EXEMPLES = {
    lire: { t1: "Azur", m: "etoile", nb: "3", tm: "Or", ta: "Or" },
    dessiner: { t1: "Gueules", p: "fasce", tp: "Argent", m: "lion", nb: "1", pos: "sur", tm: "Sable", ta: "Sable" },
    regle: { t1: "Argent", m: "croix-potencee", nb: "1", tm: "Or", ta: "Or" },
    vocab: { t1: "Argent", p: "chevron", tp: "Gueules", m: "rose", nb: "3", tm: "Or", ta: "Or" },
    defi: { f: "part", part: "parti", t1: "Azur", t2: "Gueules", m: "fleurdelis", nb: "1", tm: "Or", ta: "Or" },
  };
  async function cartes() {
    const jour = aujourdhui();
    const fait = MEM.defi && MEM.defi.date === jour.cle ? MEM.defi.marques : null;
    const html = [];
    for (const [id, x] of Object.entries(EXOS)) {
      let image;
      if (id === "points") image = svgPoints(0, 0, true);
      else if (id === "reel") image = `<svg class="ecu" viewBox="0 0 200 252" aria-hidden="true"><path d="${SHIELD_D}" fill="#f3eee0" stroke="#1a1712" stroke-width="2.4"/><text x="100" y="150" text-anchor="middle" font-family="Marcellus,serif" font-size="110" fill="#8e1b18" opacity=".85">?</text></svg>`;
      else { const St = fresh(); St.A[0] = { ...ADEF, ...EXEMPLES[id] }; normalizeAll(St); image = await ecu(St, null); }
      const s = MEM.stats[id === "defi" ? "defi" : id];
      const pied = id === "defi" ? (fait ? `<span class="ex-fait">${Tr("Fait aujourd'hui :", "Done today:")} ${[...fait].map(b => (b === "1" ? "🟩" : "🟥")).join("")}</span>` : `<span class="ex-fait">${Tr("Du", "For")} ${esc(jour.txt)}</span>`)
        : s && s.n ? `<span class="ex-fait">${Tr(`${s.ok} juste${s.ok > 1 ? "s" : ""} sur ${s.n}${s.serieMax > 1 ? ` · meilleure série ${s.serieMax}` : ""}`, `${s.ok} right out of ${s.n}${s.serieMax > 1 ? ` · best streak ${s.serieMax}` : ""}`)}</span>` : `<span class="ex-fait">${Tr("Pas encore essayé", "Not tried yet")}</span>`;
      html.push(`<button type="button" class="ex-carte" data-id="${id}"><span class="ex-img">${image}</span><span class="ex-txt"><span class="ex-nom">${esc(x.titre)}</span><span class="ex-court">${esc(x.court)}</span><span class="ex-desc">${esc(x.desc)}</span>${pied}</span></button>`);
    }
    el.cartes.innerHTML = html.join("");
    const niveau = $(`#ex-niv input[value="${MEM.niv}"]`) || $(`#ex-niv input[value="1"]`);
    niveau.checked = true; $("#ex-niv-aide").textContent = NIV_AIDE[niveau.value];
  }
  $("#ex-niv").addEventListener("change", e => { MEM.niv = e.target.value; $("#ex-niv-aide").textContent = NIV_AIDE[MEM.niv]; sauve(); });
  el.cartes.addEventListener("click", e => { const b = e.target.closest(".ex-carte"); if (b) demarre(b.dataset.id); });

  /* ---------- démarrage ---------- */
  try {
    await chargerLecteur();                          // data/data.json et data/atelier.json (assets/lecture.js)
    /* le lecteur et le tirage lisent le français ; en anglais, chaque entrée reçoit son nom et sa définition à côté */
    if (LANGUE === "en") { const T = await lireDonnees("data/data.json"); for (const k of ["glossaire", "attributs", "positions", "repertoire"]) DATA[k].forEach((e, i) => { e.termeEn = T[k][i].termeEn; e.defEn = T[k][i].def; }); }
  } catch (e) {
    $("#ex-chargement").textContent = Tr(`Les données n'ont pas pu être chargées (${e.message}). Cette page doit être servie par HTTP, et non ouverte depuis le disque.`, `The data could not be loaded (${e.message}). This page must be served over HTTP, not opened from disk.`);
    return;
  }
  try { BL = await lireDonnees("data/blasons.json"); } catch (e) { /* sans la galerie, l'exercice « Armes réelles » manque, le reste marche */ }
  if (!BL.length) delete EXOS.reel;
  $("#gdefs").innerHTML = globalDefs();
  /* pour les tests (tools/smoke_test.py) : une question de plus, à graine donnée, sans rien afficher */
  window.Exercices = { ids: Object.keys(EXOS), fabrique: (id, niv, seed) => EXOS[id].fabrique(mulberry(seed), niv), defi: DEFI };
  await cartes();
  $("#ex-chargement").hidden = true; el.menu.hidden = false;
  const dem = location.hash.replace("#", "");
  if (EXOS[dem]) demarre(dem);
  addEventListener("hashchange", () => { const h = location.hash.replace("#", ""); if (EXOS[h] && (!J || J.id !== h)) demarre(h); else if (!h && J) versMenu(); });
})();
