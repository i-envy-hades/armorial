/* L'ARMORIAL — « Dessine-moi » : le jeu du jour de l'Atelier (atelier.html#defi=dessin).

   Un blasonnement par jour, le même pour tous (assets/jour.js : la graine du document du jour, assets/generateur.js : les armes) ;
   le joueur compose l'écu avec le formulaire de l'Atelier, puis valide : trois essais. Chaque essai dit si le champ, la pièce et les
   meubles sont justes ; les armes sont trouvées quand leur forme canonique (canonAll : sans ornements ni réglages graphiques) est celle
   du texte. Pendant le défi, l'Atelier cache ce qui donnerait la réponse : la lecture d'un blasonnement, les exemples, les armes réelles,
   et le blasonnement de l'écu en cours.
   Demande, chargés avant lui : assets/atelier.js, assets/generateur.js, assets/jour.js. */
const DessineMoi = (() => {
  "use strict";
  const JEU = "dessin", ESSAIS = 3;
  const GROUPES = [["Le champ", ["f", "t1", "t2", "t3", "part", "ray", "n"]], ["La pièce", ["p", "tp", "ln", "pf", "pcc", "ri", "lrg", "fqs", "cmp"]], ["Les meubles", ["m", "nb", "tm", "cc"]]];
  const SYMB = { ok: "✓", no: "✗" }, EMOJI = { ok: "🟩", no: "⬜" };
  let N = 0, cible = null, texte = "", K = null, J = null, minuteur = 0;
  const box = () => document.getElementById("defi");
  const vierge = () => { const St = fresh(); St.A[0] = { ...ADEF, t1: "Argent", m: "", p: "" }; return normalizeAll(St); };
  const sous = (o, ks) => JSON.stringify(ks.map(k => o[k] ?? ""));

  /* un essai : « ok-no-ok » (champ, pièce, meubles), ou « gagne » */
  function juge(St) {
    if (Gen.empreinte(St) === Gen.empreinte(cible)) return "gagne";
    const a = St.q || St.ab ? null : canon(St.A[0]), b = canon(cible.A[0]);
    return GROUPES.map(([, ks]) => (a && sous(a, ks) === sous(b, ks) ? "ok" : "no")).join("-");
  }
  const cases = v => (v === "gagne" ? GROUPES.map(() => "ok") : v.split("-"));

  async function ecuDe(St, id) {
    await loadAll(St);
    const c = compose(St, id);
    return `<svg class="defi-ecu" viewBox="${c.vb.join(" ")}" role="img" aria-label="${esc(blazonAll(St))}">${c.svg}</svg>`;
  }
  function texteDePartage() {
    const l = J.essais.map(v => cases(v).map(c => EMOJI[c]).join(""));
    return `Dessine-moi n° ${N} — ${J.gagne ? J.essais.length : "X"}/${ESSAIS}\n${l.join("\n")}\nhttps://armorial.web.app/atelier.html#defi=dessin`;
  }

  async function dessine() {
    const b = box(), n = J.essais.length;
    const lignes = J.essais.map((v, i) => `<li class="${v === "gagne" ? "ok" : ""}"><b>Essai ${i + 1}</b> ${v === "gagne" ? "<span class=\"ok\">Les armes sont justes.</span>"
      : cases(v).map((c, k) => `<span class="${c}">${GROUPES[k][0]} ${SYMB[c]}</span>`).join("")}${v !== "gagne" && cases(v).every(c => c === "ok") ? `<span class="no">un détail diffère : la place, la disposition ou un attribut (armé, lampassé…)</span>` : ""}</li>`).join("");
    let fin = "";
    if (J.fini) {
      fin = `<div class="defi-fin ${J.gagne ? "ok" : "ko"}"><p class="defi-verdict">${J.gagne ? (n === 1 ? "Du premier coup !" : "Bien dessiné !") : "Pas cette fois…"}</p>
        <figure><figcaption>Les armes attendues</figcaption>${await ecuDe(cible, "dfc")}</figure>
        <p class="acts"><button type="button" class="main" id="defi-partage">Partager mon résultat</button><a href="./">Les autres jeux du jour</a></p>
        <p class="defi-copie" id="defi-copie" role="status"></p>
        <p class="defi-prochain" id="defi-prochain"></p></div>`;
    }
    b.innerHTML = `<p class="defi-sur">Dessine-moi · n° ${N} <small>${Jour.quand(N)}</small></p>
      <p class="defi-ask">Composez ces armes avec le formulaire, puis validez :</p>
      <blockquote class="defi-blz">«&nbsp;${esc(texte)}&nbsp;»</blockquote>
      ${lignes ? `<ol class="defi-essais">${lignes}</ol>` : ""}
      ${J.fini ? fin : `<p class="acts"><button type="button" class="main" id="defi-ok">Valider mon dessin</button><span class="defi-n">Essai ${n + 1} sur ${ESSAIS}</span></p>`}`;
    if (J.fini) {
      $("#defi-partage").addEventListener("click", () => Jour.partage(texteDePartage(), $("#defi-copie")));
      const tic = () => { const el = $("#defi-prochain"); if (!el) return clearInterval(minuteur); el.textContent = `Prochain blasonnement dans ${Jour.compteARebours()}`; if (Jour.avantDemain() === 0) location.reload(); };
      clearInterval(minuteur); tic(); minuteur = setInterval(tic, 1000);
    } else $("#defi-ok").addEventListener("click", valide);
  }
  async function valide() {
    if (J.fini) return;
    const v = juge(normalizeAll(S));
    J.essais.push(v);
    if (v === "gagne" || J.essais.length >= ESSAIS) { J.fini = true; J.gagne = v === "gagne"; K.clos(N, { ...J }); }
    else K.garde(N, { ...J });
    await dessine();
    box().scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth" });
  }

  /* l'Atelier appelle ceci au démarrage, en mode défi ; renvoie l'état de départ de l'écu */
  async function demarre() {
    document.body.classList.add("defi");
    document.title = "Dessine-moi — le jeu du jour de l'Atelier";
    const h = document.querySelector(".hero .frame");
    if (h) h.innerHTML = `<p class="eyebrow">Le jeu du jour de l'Atelier</p><h1>Dessine-moi</h1><p>Un blasonnement par jour, le même pour tous : composez l'écu qu'il décrit, en trois essais. Chaque essai dit si le champ, la pièce et les meubles sont justes.</p>`;
    const b = box(); b.hidden = false;
    b.innerHTML = `<p class="defi-sur">Dessine-moi</p><p>Le blasonnement du jour se prépare…</p>`;
    N = Jour.numero();
    const t = await Jour.charge(N);
    if (!t.doc) { b.innerHTML = `<p class="defi-sur">Dessine-moi</p><p>${esc(t.msg)}</p><p><a href="atelier.html">Composer librement dans l'Atelier</a></p>`; return vierge(); }
    cible = Gen.tireArmes(Jour.hasard(t.doc, JEU), 2);
    texte = blazonAll(cible);
    await Compte.pret;
    K = Jour.carnet(JEU);
    const sv = K.jour(N);
    J = sv ? { essais: [...sv.essais], fini: !!sv.fini, gagne: !!sv.gagne } : { essais: [], fini: false, gagne: false };
    await dessine();
    return vierge();
  }
  return { demarre, actif: () => /(^|[#&])defi=dessin(&|$)/.test(location.hash), get cible() { return cible; }, juge, valide };
})();
