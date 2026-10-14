/* L'ARMORIAL — des armes au hasard, et leurs voisines : le générateur commun de S'exercer (assets/exercices.js)
   et des jeux du jour (assets/jour-jeux.js, assets/atelier.js en mode défi).

   Les écus sont composés par le moteur de l'Atelier ; une graine (mulberry) donne la même suite à tous.
   Demande, chargés avant lui : assets/blason.js, assets/blasonnement.js, assets/lecture.js, assets/dessin.js. */
const Gen = (() => {
  const METAUX = ["Or", "Argent"], COULEURS = ["Gueules", "Azur", "Sable", "Sinople"], COULEURS_P = [...COULEURS, "Pourpre"];
  const clone = o => JSON.parse(JSON.stringify(o));

  /* ---------- hasard réglé : une graine donne la même suite à tous ---------- */
  const mulberry = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const graine = s => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; } return x; };
  const pick = (rng, a) => a[Math.floor(rng() * a.length)];
  const melange = (rng, a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const tire = (rng, paires) => { let x = rng() * paires.reduce((s, p) => s + p[1], 0); for (const [v, w] of paires) { x -= w; if (x < 0) return v; } return paires[0][0]; };

  /* ---------- le stock : les meubles qu'on reconnaît d'emblée, puis ceux qu'il faut avoir lus ---------- */
  const FACILE = ["lion", "aigle", "fleurdelis", "etoile", "croissant", "rose", "tour", "coquille", "roundel", "soleil", "clef", "epee", "ancre", "cerf", "cygne", "arbre", "coeur", "trefle"];
  const MOYEN = ["leopard", "griffon", "dragon", "licorne", "ours", "loup", "sanglier", "cheval", "poisson", "panthere", "merlette", "quintefeuille", "macle", "losange", "annelet", "croisette", "cloche", "roue", "chateau", "main", "gerbe", "epi", "gland", "molette", "aigle-bicephale", "comete", "eclair", "fercheval", "tau", "goutte", "rustre", "fusee", "quartefeuille", "tiercefeuille"];
  const PIECES_1 = ["chef", "fasce", "pal", "bande", "barre", "croix", "sautoir", "chevron"];
  const PIECES_N = { 1: PIECES_1, 2: [...PIECES_1, "bordure", "orle", "canton"], 3: [...PIECES_1, "bordure", "orle", "canton", "franc-quartier", "pairle"] };
  const poolMeubles = niv => (niv === 1 ? FACILE : niv === 2 ? [...FACILE, ...MOYEN] : ATL.meubles.map(m => m.kind).filter(k => k !== "billette" && k !== "croix")).filter(meuble);
  const SEMES = ["fleurdelis", "etoile", "croisette", "roundel", "coquille", "trefle", "rose", "croissant"];

  const sameClass = (rng, t, pool = COULEURS_P) => pick(rng, (classe(t) === "Métal" ? METAUX : pool).filter(x => x !== t));
  const contre = (rng, t, pool = COULEURS) => (classe(t) === "Métal" ? pick(rng, pool) : pick(rng, METAUX));   // un émail qui se détache de t

  /* ---------- des armes au hasard : un quartier ---------- */
  function armesSimples(rng, niv, force) {
    const s = { ...ADEF, m: "", p: "", pos: "autour", ct: "", ln: "", nb: "3", f: "plein" };
    const poolC = niv > 1 ? COULEURS_P : COULEURS;
    s.t1 = rng() < .5 ? pick(rng, METAUX) : pick(rng, poolC);
    const autre = () => contre(rng, s.t1, poolC);
    const meubleAvec = (nbs, tm) => { s.m = pick(rng, poolMeubles(niv)); s.nb = pick(rng, nbs); s.tm = tm; s.ta = niv === 1 || rng() < .5 ? tm : pick(rng, ["Gueules", "Azur", "Or", "Argent", "Sable"].filter(t => t !== tm)); };
    const recette = force || tire(rng, niv === 1 ? [["meuble", 5], ["piece", 4], ["piece-meubles", 2]]
      : niv === 2 ? [["piece-meubles", 3], ["piece-chargee", 2], ["partition", 3], ["raye", 1], ["bordure", 2], ["meuble", 2]]
      : [["piece-meubles", 2], ["piece-chargee", 2], ["partition", 2], ["raye", 1], ["bordure", 1], ["deux-meubles", 2], ["seme", 1], ["contourne", 1], ["bord", 2]]);
    switch (recette) {
      case "meuble": meubleAvec(niv === 1 ? ["1", "1", "2", "3", "3"] : ["1", "2", "3", "3", "4", "5", "6"], autre()); break;
      case "piece": s.p = pick(rng, PIECES_N[niv]); s.tp = autre(); break;
      case "piece-meubles": s.p = pick(rng, ["fasce", "chevron", "bande", "pal", "croix", "barre", "sautoir"]); s.tp = autre(); meubleAvec(["3", "3", "1", "2", "4"], autre()); break;
      case "piece-chargee": s.p = pick(rng, ["fasce", "bande", "pal", "chevron", "croix", "chef", "sautoir"]); s.tp = autre(); s.pos = "sur"; meubleAvec(["1", "3", "3"], contre(rng, s.tp, poolC)); break;
      case "partition": {
        s.f = "part"; s.part = pick(rng, ["parti", "coupe", "tranche", "taille"]);
        if (rng() < .5) { s.t2 = sameClass(rng, s.t1, poolC); if (classe(s.t1) === "Métal") s.t2 = s.t1 === "Or" ? "Argent" : "Or"; meubleAvec(["1"], classe(s.t1) === "Métal" ? pick(rng, poolC) : pick(rng, METAUX)); }
        else s.t2 = contre(rng, s.t1, poolC);
        break;
      }
      case "raye": s.f = "ray"; s.ray = pick(rng, ["barry", "paly", "bendy", "bendysin"]); s.n = pick(rng, niv === 1 ? ["6"] : ["6", "6", "7", "5", "9"]); s.t2 = contre(rng, s.t1, poolC); break;   // 5, 7, 9 : « d'or à trois pals de gueules »
      case "bordure": s.p = "bordure"; s.tp = autre(); meubleAvec(["1"], autre()); break;
      case "deux-meubles": meubleAvec(["1"], autre()); s.m2 = pick(rng, poolMeubles(niv).filter(k => k !== s.m)); s.nb2 = pick(rng, ["1", "3"]); s.d2 = "chef"; s.tm2 = autre(); s.ta2 = s.tm2; break;
      case "seme": meubleAvec(["seme"], autre()); s.m = pick(rng, SEMES.filter(meuble)); s.nb = "seme"; break;
      case "contourne": meubleAvec(["1"], autre()); s.m = pick(rng, ["lion", "leopard", "griffon", "dragon", "licorne", "clef", "aigle"].filter(meuble)); s.ct = "1"; break;
      case "bord": s.p = pick(rng, ["fasce", "chef", "bande", "chevron", "pal", "bordure"]); s.tp = autre(); s.ln = pick(rng, Object.keys(CONTOUR_NOM)); if (rng() < .5) meubleAvec(["1", "3"], autre()); break;
    }
    return s;
  }
  function armes(rng, niv) {
    const St = fresh(), r = rng();
    if (niv === 3 && r < .26) { St.q = "2"; St.A[0] = armesSimples(rng, 2); St.A[1] = armesSimples(rng, 1); }
    else if (niv === 3 && r < .38) { St.ab = "1"; St.A[0] = armesSimples(rng, 1, "meuble"); St.A[4] = armesSimples(rng, 1, "piece"); }
    else if (niv === 3 && r < .46) { const s = armesSimples(rng, 2, "meuble"); s.f = "part"; s.part = pick(rng, ["tierce-pal", "tierce-fasce"]); s.t1 = pick(rng, METAUX); s.t2 = pick(rng, COULEURS); s.t3 = pick(rng, COULEURS.filter(t => t !== s.t2)); s.m = ""; St.A[0] = s; }
    else St.A[0] = armesSimples(rng, niv);
    return St;
  }
  const empreinte = St => JSON.stringify(canonAll(St));
  /* des armes sont bonnes à poser si l'Atelier les accepte telles quelles, si la règle des émaux y est tenue (sauf exercice sur cette règle)
     et si le lecteur relit le texte qu'on en tire, à l'identique et sans réserve */
  function valide(St, regle = true) {
    const avant = empreinte(St);
    normalizeAll(St);
    if (empreinte(St) !== avant) return false;
    if (regle && ruleAll(St).length) return false;
    const r = lire(blazonAll(St));
    return !!(r.ok && r.exact && !r.notes.length && empreinte(r.etat) === avant);
  }
  function tireArmes(rng, niv) {
    for (let i = 0; i < 120; i++) { const St = armes(rng, niv); if (valide(St)) return St; }
    const St = fresh(); St.A[0] = { ...ADEF, t1: "Azur", m: "fleurdelis", nb: "3", tm: "Or", ta: "Or" }; normalizeAll(St); return St;
  }

  /* ---------- des armes voisines, où un seul trait change ---------- */
  const MUT = {
    quartiers(rng, a, c) { if (c.q !== "2") return false; [c.A[0], c.A[1]] = [c.A[1], c.A[0]]; return true; },
    champ(rng, a) { if (a.f === "plein" || rng() < .5) a.t1 = sameClass(rng, a.t1); else a.t2 = sameClass(rng, a.t2); return true; },
    emailMeuble(rng, a) { if (!a.m) return false; a.tm = sameClass(rng, a.tm); return true; },
    emailPiece(rng, a) { if (!a.p) return false; a.tp = sameClass(rng, a.tp); return true; },
    nombre(rng, a) { if (!a.m || a.nb === "seme") return false; const cs = countsFor(a).filter(n => n !== a.nb && n !== "seme"); if (!cs.length) return false; a.nb = pick(rng, cs); return true; },
    meuble(rng, a) { if (!a.m) return false; const cat = meuble(a.m).cat, c = ATL.meubles.filter(m => m.cat === cat && m.kind !== a.m && poolMeubles(3).includes(m.kind) && !m.seul); if (!c.length) return false; a.m = pick(rng, c).kind; return true; },
    piece(rng, a) { if (!a.p) return false; a.p = pick(rng, PIECES_1.filter(p => p !== a.p)); a.ln = ""; return true; },
    rayures(rng, a) { if (a.f !== "ray") return false; if (rng() < .5) a.ray = pick(rng, ["barry", "paly", "bendy", "bendysin"].filter(r => r !== a.ray)); else a.n = pick(rng, ["5", "6", "7", "8", "9"].filter(n => n !== a.n)); return true; },
    partition(rng, a) { const l = ["parti", "coupe", "tranche", "taille"]; if (a.f !== "part" || !l.includes(a.part)) return false; a.part = pick(rng, l.filter(x => x !== a.part)); return true; },
    disposition(rng, a) { const ds = dispos(a); if (!a.m || ds.length < 2) return false; a.d = pick(rng, ds.filter(d => d.id !== a.d).map(d => d.id)); return true; },
    sens(rng, a) { const m = a.m && meuble(a.m); if (!m || !m.asym) return false; a.ct = a.ct === "1" ? "" : "1"; return true; },
    place(rng, a) { if (!a.p || !a.m) return false; a.pos = a.pos === "sur" ? "autour" : "sur"; return true; },
    retrait(rng, a) { if (a.m && a.p) { if (rng() < .5) a.m = ""; else a.p = ""; return true; } return false; },
  };
  function voisines(rng, St, n) {
    const out = [], vus = new Set([empreinte(St)]), textes = new Set([blazonAll(St)]), aspects = new Set();
    for (let essai = 0; essai < 240 && out.length < n; essai++) {
      const c = clone(St), act = active(c), qi = pick(rng, act), nom = pick(rng, Object.keys(MUT));
      if (essai < 120 && aspects.has(nom)) continue;                       // d'abord des différences de nature variée, puis on se contente de ce qu'on trouve
      if (c.q && nom === "retrait") continue;
      if (!MUT[nom](rng, c.A[qi], c)) continue;
      if (!valide(c)) continue;
      const e = empreinte(c), t = blazonAll(c);
      if (vus.has(e) || textes.has(t)) continue;
      vus.add(e); textes.add(t); aspects.add(nom); out.push(c);
    }
    return out;
  }

  /* ---------- le texte, et ce qui change d'un texte à l'autre ---------- */
  const mots = t => t.split(/\s+/).filter(Boolean);
  /* mots de b absents de a (plus longue sous-suite commune) : ce sont eux qu'on souligne */
  function difference(a, b) {
    const A = mots(a), B = mots(b), L = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
    for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const commun = new Set(); let i = 0, j = 0;
    while (i < A.length && j < B.length) { if (A[i] === B[j]) { commun.add(j); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++; }
    return B.map((w, k) => commun.has(k) ? esc(w) : `<mark>${esc(w)}</mark>`).join(" ");
  }

  return { METAUX, COULEURS, COULEURS_P, clone, mulberry, graine, pick, melange, tire, FACILE, MOYEN, PIECES_1, PIECES_N, poolMeubles, SEMES,
    sameClass, contre, armesSimples, armes, empreinte, valide, tireArmes, MUT, voisines, mots, difference };
})();
