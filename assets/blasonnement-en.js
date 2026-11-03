/* L'ARMORIAL — le blasonnement en anglais : la même grammaire que blazonAll() (assets/blasonnement.js), en anglais.
   Il n'écrit que pour le lecteur. Le français reste la référence : le lecteur de blasonnement (assets/lecture.js), le générateur d'armes
   et les empreintes s'appuient sur blazonAll(). Les pages anglaises chargent ce fichier après blasonnement.js et écrivent avec blazonLu().
   Mêmes noms de fonctions qu'en français, suffixés En, dans le même ordre : une tournure ajoutée d'un côté s'ajoute de l'autre ;
   tools/smoke_test.py vérifie que chaque meuble d'atelier.json a son nom, et qu'aucun mot français ne reste sur des milliers d'écus tirés au hasard. */
const MOT_EN = { Or: "or", Argent: "argent", Gueules: "gules", Azur: "azure", Sable: "sable", Sinople: "vert", Pourpre: "purpure", Hermine: "ermine", Vair: "vair" };
const NB_EN = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen"];
const un = nom => (/^the /.test(nom) ? nom : (/^(?:[aeio]|u(?!ni))/i.test(nom) ? "an " : "a ") + nom);
const PIECE_EN = { chef: "chief", fasce: "fess", pal: "pale", bande: "bend", barre: "bend sinister", croix: "cross", sautoir: "saltire", chevron: "chevron", bordure: "bordure", orle: "orle", canton: "canton", "franc-quartier": "quarter", pairle: "pall", cotice: "bendlet" };
const CONTOUR_EN = { onde: "wavy", nebule: "nebuly", dancette: "dancetty", engrele: "engrailed", cannele: "invected", denche: "indented", alesee: "couped" };
const ACCENT_EN = { "accorné et onglé": "horned and unguled", "accorné": "horned", "accorné, colleté et clariné": "horned, collared and belled", "armé et lampassé": "armed and langued", "armé, lampassé et incensé": "armed, langued and incensed", "becqué et membré": "beaked and membered", "becqué, membré et couronné": "beaked, membered and crowned", "cordé": "stringed", "dans des flammes": "in flames", "défendu": "tusked", "empenné": "flighted", "fûté": "with a trunk", "garni": "hilted", "lampassé et vilené": "langued and pizzled", "lampassé": "langued", "lié": "bound", "onglé et lampassé": "unguled and langued", "ouvert": "open", "paré": "vested", "percé": "pierced", "perfilé": "outlined", "ramé": "attired", "sur son immortalité": "on its immortality", "virolé": "banded" };
/* le nom de chaque meuble, au singulier et au pluriel ; un nom commençant par « the » n'a pas d'article (« the keys of Saint Peter ») */
const MEUBLE_EN = {
  lion: ["lion", "lions"], "lion-queue-fourchee": ["lion", "lions"], "lion-hache": ["crowned lion", "crowned lions"], "lion-passant": ["lion passant", "lions passant"], leopard: ["lion passant guardant", "lions passant guardant"], "leopard-lionne": ["lion rampant guardant", "lions rampant guardant"],
  "aigle-sans-couronne": ["eagle", "eagles"], aigle: ["eagle", "eagles"], "aigle-bicephale": ["double-headed eagle", "double-headed eagles"], "aigle-vol-abaisse": ["eagle with wings lowered", "eagles with wings lowered"], "aigle-brandebourg": ["eagle of Brandenburg", "eagles of Brandenburg"],
  croix: ["cross couped", "crosses couped"], fleurdelis: ["fleur-de-lis", "fleurs-de-lis"], "fleurdelis-florencee": ["Florentine fleur-de-lis", "Florentine fleurs-de-lis"], croissant: ["crescent", "crescents"],
  etoile: ["star", "stars"], etoile6: ["six-pointed star", "six-pointed stars"], etoile7: ["seven-pointed star", "seven-pointed stars"], etoile8: ["eight-pointed star", "eight-pointed stars"], molette: ["spur rowel", "spur rowels"], roundel: ["bezant", "bezants"],
  rose: ["rose", "roses"], macle: ["mascle", "mascles"], rustre: ["rustre", "rustres"], losange: ["lozenge", "lozenges"], fusee: ["fusil", "fusils"], billette: ["billet", "billets"], annelet: ["annulet", "annulets"], vire: ["vire", "vires"],
  escarboucle: ["escarbuncle", "escarbuncles"], "mont-trois-coupeaux": ["triple mount", "triple mounts"], crancelin: ["crancelin", "crancelins"], flanchis: ["flanchis", "flanchis"], croisette: ["small cross", "small crosses"], goutte: ["drop", "drops"],
  quartefeuille: ["quatrefoil", "quatrefoils"], quintefeuille: ["cinquefoil", "cinquefoils"], tiercefeuille: ["tiercefoil", "tiercefoils"], trefle: ["trefoil", "trefoils"], "fer-moulin": ["millrind", "millrinds"], roc: ["chess rook", "chess rooks"], fermail: ["buckle", "buckles"],
  moucheture: ["ermine spot", "ermine spots"], merlette: ["martlet", "martlets"], chaussetrappe: ["caltrap", "caltraps"], crampon: ["crampon", "crampons"], tau: ["tau", "taus"],
  "croix-pattee": ["cross formy", "crosses formy"], "croix-potencee": ["cross potent", "crosses potent"], "croix-recroisettee": ["cross crosslet", "crosses crosslet"], "croix-ancree": ["cross moline", "crosses moline"], "croix-lorraine": ["cross of Lorraine", "crosses of Lorraine"], "croix-latine": ["Latin cross", "Latin crosses"], "croix-jerusalem": ["cross of Jerusalem", "crosses of Jerusalem"], "croix-malte": ["Maltese cross", "Maltese crosses"], "croix-saint-andre": ["cross of Saint Andrew", "crosses of Saint Andrew"], "croix-orthodoxe": ["Orthodox cross", "Orthodox crosses"], "croix-celtique": ["Celtic cross", "Celtic crosses"], "croix-huguenote": ["Huguenot cross", "Huguenot crosses"], "croix-toulouse": ["cross voided, clechy and pommetty", "crosses voided, clechy and pommetty"], "croix-fleurdelisee": ["cross flory", "crosses flory"], "croix-treflee": ["cross botonny", "crosses botonny"], "croix-pommee": ["cross pommelly", "crosses pommelly"], "croix-patonnee": ["cross patonce", "crosses patonce"], "croix-fourchee": ["cross fourchy", "crosses fourchy"], "croix-recroisettee-fichee": ["cross crosslet fitchy", "crosses crosslet fitchy"], "croix-saint-jacques": ["cross of Saint James", "crosses of Saint James"],
  soleil: ["sun", "suns"], "soleil-figure": ["sun in splendour", "suns in splendour"], comete: ["comet", "comets"], eclair: ["lightning bolt", "lightning bolts"], coquille: ["scallop", "scallops"], fercheval: ["horseshoe", "horseshoes"], cloche: ["bell", "bells"], clef: ["key", "keys"], "clefs-saint-pierre": ["the keys of Saint Peter", "the keys of Saint Peter"],
  epee: ["sword", "swords"], lance: ["spear", "spears"], sabre: ["sabre", "sabres"], "rameau-olivier": ["olive branch", "olive branches"], sceptre: ["sceptre", "sceptres"], mitre: ["mitre", "mitres"], briquet: ["firesteel", "firesteels"], crosse: ["crozier", "croziers"], "aigle-moravie": ["eagle chequy", "eagles chequy"], ane: ["donkey", "donkeys"],
  chevalier: ["mounted knight", "mounted knights"], "saint-georges": ["Saint George", "Saints George"], "saint-fridolin": ["Saint Fridolin", "Saints Fridolin"], "casque-skanderbeg": ["helmet of Skanderbeg", "helmets of Skanderbeg"], "lion-couche": ["lion couchant", "lions couchant"], ancre: ["anchor", "anchors"], tour: ["tower", "towers"], couronne: ["crown", "crowns"], hache: ["battle axe", "battle axes"], chateau: ["towered castle", "towered castles"], cor: ["horn", "horns"], roue: ["wheel of Mainz", "wheels of Mainz"],
  "feuille-ortie": ["nettle leaf", "nettle leaves"], gland: ["acorn", "acorns"], epi: ["ear of wheat", "ears of wheat"], gerbe: ["garb", "garbs"], arbre: ["tree", "trees"], coeur: ["heart", "hearts"], main: ["hand appaumy", "hands appaumy"], "main-benissante": ["hand in blessing", "hands in blessing"],
  griffon: ["griffin", "griffins"], dragon: ["dragon", "dragons"], wyverne: ["wyvern", "wyverns"], licorne: ["unicorn", "unicorns"], "licorne-assise": ["unicorn sejant", "unicorns sejant"], panthere: ["heraldic panther", "heraldic panthers"], cerf: ["stag passant", "stags passant"], "cerf-courant": ["stag courant", "stags courant"], "cerf-couche": ["stag lodged", "stags lodged"], "biche-saillante": ["hind salient", "hinds salient"], cheval: ["horse rearing", "horses rearing"], "cheval-passant": ["horse passant", "horses passant"], ours: ["bear passant", "bears passant"], "ours-rampant": ["bear rampant", "bears rampant"], sanglier: ["boar passant", "boars passant"], taureau: ["bull", "bulls"], loup: ["wolf passant", "wolves passant"], "loup-ravissant": ["wolf rampant", "wolves rampant"], belier: ["ram passant", "rams passant"], "bouquetin-saillant": ["ibex salient", "ibexes salient"], "chevre-saillante": ["goat salient", "goats salient"],
  cygne: ["swan", "swans"], "colombe-essorante": ["dove rising", "doves rising"], "colombe-rameau": ["dove with a branch", "doves with a branch"], poisson: ["fish", "fish"], sirene: ["mermaid", "mermaids"], melusine: ["Melusine", "Melusines"], basilic: ["basilisk", "basilisks"], phenix: ["phoenix", "phoenixes"], salamandre: ["salamander", "salamanders"], guivre: ["wyvern", "wyverns"], couleuvre: ["undulating serpent", "undulating serpents"], alerion: ["alerion", "alerions"], "saint-ferdinand": ["Saint Ferdinand", "Saints Ferdinand"], "aigle-imperiale": ["imperial eagle", "imperial eagles"], "aigle-federale": ["federal eagle", "federal eagles"], choucas: ["jackdaw", "jackdaws"], faisceau: ["lictor's fasces", "lictor's fasces"], grenade: ["pomegranate", "pomegranates"], neflier: ["medlar flower", "medlar flowers"], "crosse-bale": ["stylised crozier", "stylised croziers"], vache: ["cow passant", "cows passant"], navire: ["ship", "ships"], pin: ["pine tree", "pine trees"], casque: ["helmet", "helmets"], "tete-de-loup": ["wolf's head erased", "wolves' heads erased"], colonne: ["column", "columns"], fleche: ["arrow", "arrows"], "rencontre-cerf": ["stag's head caboshed", "stags' heads caboshed"], orbe: ["globus cruciger", "globi cruciger"], bras: ["arm", "arms"], "navire-cargue": ["ship with furled sail", "ships with furled sails"], vaisseau: ["vessel", "vessels"], harpe: ["harp", "harps"], ciboire: ["ciborium", "ciboria"],
  "rencontre-ours": ["bear's head caboshed", "bears' heads caboshed"], "rencontre-sanglier": ["boar's head caboshed", "boars' heads caboshed"], "rencontre-loup": ["wolf's head caboshed", "wolves' heads caboshed"], "rencontre-lion": ["lion's face", "lions' faces"], "rencontre-leopard": ["leopard's face", "leopards' faces"], "rencontre-boeuf": ["bull's head caboshed", "bulls' heads caboshed"], "rencontre-belier": ["ram's head caboshed", "rams' heads caboshed"], "couronne-antique": ["antique crown", "antique crowns"], "couronne-laurier": ["laurel wreath", "laurel wreaths"], ecusson: ["escutcheon", "escutcheons"],
};
const em = t => MOT_EN[t] || t;
const ccTexteEn = () => "counterchanged";
/* la place d'un meuble, d'après la phrase française de PLEIN (assets/blasonnement.js) */
function placeEn(ph, n) {
  const p = String(ph || "").trim();
  if (!p) return "";
  const dit = { "en chef": "in chief", "en pointe": "in base", "au canton dextre du chef": "in dexter chief", "au canton senestre du chef": "in sinister chief", "rangé en chef": "in chief", "rangé en fasce": "in fess", "passé en sautoir": "in saltire", "posé en sautoir": "in saltire", "posé en croix": "in cross", "en orle": "in orle", "mal ordonné": "1 and 2", "posé en pal": "in pale",
    "posé en fasce": n === 1 ? "fesswise" : "in fess", "posé en bande": n === 1 ? "bendwise" : "in bend", "posé en barre": n === 1 ? "bendwise sinister" : "in bend sinister" }[p];
  if (dit) return " " + dit;
  const m = /^posé (?:en trois pals )?([\d, ]+) et (\d+)$/.exec(p);
  return m ? ` ${/trois pals/.test(p) ? "in three pales of " : ""}${m[1]} and ${m[2]}` : "";
}
const dphEn = (s, c) => { const d = dispoOf(s); return d ? placeEn(d.ph, c.n) : ""; };

function chargesEn(s) {
  const m = meuble(s.m), seme = s.nb === "seme", n = seme ? 0 : +s.nb;
  let [nom, nomPl] = MEUBLE_EN[m.kind] || [m.sing, m.plur];
  if (m.kind === "roundel") { const metal = classe(s.tm) === "Métal"; nom = metal ? "bezant" : "torteau"; nomPl = metal ? "bezants" : "torteaux"; }
  if (s.iss === "t") nom = "demi-" + nom;
  /* la couronne : de l'émail du meuble, elle se dit devant lui (« a crowned lion or ») ; d'un autre, après l'attribut (« …, armed and langued gules, crowned argent ») */
  const mem = s.cn && !s.cc && s.cn === s.tm;
  if (mem && !/^(crowned|the) /.test(nom)) { nom = "crowned " + nom; nomPl = "crowned " + nomPl; }
  let acc = "";
  if (accentDit(m, s)) {
    const t = s.ta ? em(s.ta) : "of the same";
    acc = m.accentMot === "et" ? ` and ${t}` : `, ${ACCENT_EN[m.accentMot] || m.accentMot} ${t}` + (m.accentPlus ? ", the axe of the same" : "");
  }
  if (s.cn && !mem) acc += `, crowned ${em(s.cn)}`;
  const ctr = (s.iss === "1" ? " issuant" : "") + (s.ct ? " contourné" : "");
  const fixe = m.fixe ? `, ${{ "feuillé": "leaved", "tigé et feuillé": "stalked and leaved" }[m.fixe.mot] || m.fixe.mot} ${em(m.fixe.t)}` : "";
  const queue = m.queue ? (m.kind === "lion-hache" ? ", holding an axe argent hafted of the same" : ", with a forked tail in saltire") : "";
  return { m, n, nom, nomPl, acc: queue + acc + fixe, ctr, mv: s.iss === "t" ? " issuing from the line of division" : "", tinct: s.cc ? ccTexteEn() : em(s.tm) };
}
const groupeEn = c => (c.n === 1 ? un(c.nom) : `${NB_EN[c.n]} ${c.nomPl}`) + `${c.ctr} ${c.tinct}${c.acc}`;
function semePhraseEn(c, s) {
  if (c.m.kind === "roundel") return (classe(s.tm) === "Métal" ? "bezanty " : "tortelly ") + em(s.tm);
  if (c.m.semeAdj) return ({ "billeté": "billety", "goutté": "gutty" }[c.m.semeAdj] || c.m.semeAdj) + " " + em(s.tm);
  return `semé of ${c.nomPl}${c.ctr} ${c.tinct}${c.acc}`;
}
const RAY_PIECE_EN = { barry: "bars", barryonde: "bars wavy", paly: "pales", bendy: "bends", bendysin: "bends sinister", chevronny: "chevrons" };
function rayTexteEn(s) {
  const n = +s.n, ems = `${em(s.t1)} and ${em(s.t2)}`;
  if (s.ray === "chequy") return `Chequy ${ems}${n === 6 ? "" : ` of ${NB_EN[n]} rows`}`;
  if (s.ray.startsWith("lozengy")) return `Fusily${{ lozengybend: " in bend", lozengysin: " in bend sinister" }[s.ray] || ""} ${ems}`;
  if (n % 2) return `${cap(em(s.t1))}, ${NB_EN[(n - 1) / 2]} ${RAY_PIECE_EN[s.ray]} ${em(s.t2)}`;
  const nom = { barry: n >= 10 ? "Barruly" : "Barry", barryonde: "Barry wavy", paly: "Paly", bendy: "Bendy", bendysin: "Bendy sinister", chevronny: "Chevronny" }[s.ray];
  return `${nom}${n === 6 || (n === 10 && s.ray === "barry") ? "" : ` of ${NB_EN[n]}`} ${ems}`;
}
function dispoEn(ctx, n) {
  if (ctx === "fasce" && n === 2) return ", one in chief and the other in base";
  if ((ctx === "fasce" || ctx === "bande" || ctx === "barre") && n === 6) return ", three in chief and three in base";
  return "";
}
function blazonCoreEn(s) {
  let champ;
  if (s.f === "part") {
    const p = DATA.partitions.find(x => x.kind === s.part), nom = cap(p.en.replace(/^tierced per /, "tierced in ").replace(/ of eight$/, ""));
    champ = s.part.startsWith("tierce") ? `${nom} ${em(s.t1)}, ${em(s.t2)} and ${em(s.t3)}` : `${nom} ${em(s.t1)} and ${em(s.t2)}`;
  } else if (s.f === "ray") champ = rayTexteEn(s);
  else champ = cap(em(s.t1));
  const parti = s.f !== "plein";
  const m = s.m && meuble(s.m), c = m ? chargesEn(s) : null, seme = c && s.nb === "seme";
  if (seme) champ += " " + semePhraseEn(c, s);
  const groupe = c && !seme ? groupeEn(c) + c.mv : "", grpObj = c && !seme ? groupeEn(c) : "";
  let x2 = null;
  if (c && count2(s)) {
    const c2 = chargesEn(arms2(s)), ph = s.cha ? "" : placeEn(dispo2(s).ph, c2.n), obj = groupeEn(c2) + ph;
    let chg = "";
    if (s.m2c) { const cx = chargesEn({ ...ADEF, m: s.m2c, nb: s.m2cn, tm: s.m2ct, ta: s.m2ct, ct: "", cn: "", cc: "", iss: "", p: "", pos: "autour", m2: "" }); chg = ` charged with ${groupeEn(cx)}`; }
    const big = s.big2 ? `, and in chief ${un("larger " + c2.nom)}${c2.ctr} ${c2.tinct}${c2.acc}${chg}` : "";
    x2 = { obj, alone: obj, acc: big || (s.cha ? `, each accompanied by ${obj}` : `, between ${obj}`), bro: `, ${obj} over all` };
  }
  if (s.rc && c) {
    const dist = rcDist(s), liste = dist.length > 1 ? dist.slice(0, -1).join(", ") + " and " + dist[dist.length - 1] : String(dist[0]);
    return `Barry of ${NB_EN[+s.n]} ${em(s.t1)} and ${em(s.t2)}, the ${NB_EN[dist.length]} ${em(s.t1)} bars charged with ${grpObj}, ${liste}`;
  }
  if (!s.p) {
    if (!c) return champ + (parti ? "" : " plain");
    if (seme) return champ + (x2 ? ", " + x2.alone : "");
    return `${champ}, ${groupe}${dphEn(s, c)}${parti && c.n === 1 && !s.cc ? " over all" : ""}${x2 ? (s.bro2 ? x2.bro : x2.acc) : ""}`;
  }
  const pnom = PIECE_EN[s.p] || s.p;
  const bord = s.ln ? " " + (CONTOUR_EN[s.ln] || s.ln) : "";
  const filet = s.pf ? ` fimbriated ${em(s.pf)}` : "";
  const cmObj = (k, t) => `${un((MEUBLE_EN[k] || [meuble(k).sing])[0])} ${em(t)}`;
  const cmTxt = !s.cmp ? "" : s.cm1 ? `, the ${em(s.tp)} compons charged with ${cmObj(s.cm1, s.cm1t)}` + (s.cm2 ? `, the ${em(s.tpc)} ones with ${cmObj(s.cm2, s.cm2t)}` : "")
    : s.cm2 ? `, the ${em(s.tpc)} compons charged with ${cmObj(s.cm2, s.cm2t)}` : "";
  const pieceTxt = s.cmp ? `${un(pnom)} compony ${em(s.tp)} and ${em(s.tpc)}${cmTxt}`
    : `${un((s.fqs ? "sinister " : "") + (s.lrg ? "broad " : "") + pnom)}${bord} ${s.pcc ? ccTexteEn() : em(s.tp)}${filet}${s.ri ? ` decorated with a foliate scroll ${em(s.ri)}` : ""}`;
  const broche = parti && !["chef", "bordure", "orle", "canton", "franc-quartier"].includes(s.p) ? " over all" : "";
  if (c && !seme && s.pos === "sous") return `${champ}, ${groupe}${dphEn(s, c)}${x2 ? x2.acc : ""}, ${pieceTxt} over all`;
  const lead = x2 && (seme || s.pos === "sur") ? `, ${x2.alone}, ` : ", ";
  if (c && !seme && s.pos === "sur") return `${champ}${lead}${pieceTxt}${s.pbro ? " over all," : broche && !(x2 && s.nb2 === "1") ? broche + "," : ""} charged with ${grpObj}`;
  if (c && !seme && (s.p === "chef" || s.p === "bordure" || s.p === "orle")) return `${champ}, ${groupe}${s.p === "chef" ? "" : dphEn(s, c)}${x2 ? x2.acc : ""}, ${pieceTxt}`;
  if (c && !seme && s.cp && count2(s)) {
    const c2 = chargesEn(arms2(s));
    return `${champ}, ${pieceTxt}${broche ? broche + "," : s.ri ? "," : ""} between in chief ${grpObj} and in base ${groupeEn(c2)}`;
  }
  if (c && !seme) return `${champ}, ${pieceTxt}${broche ? broche + "," : s.ri ? "," : ""} between ${grpObj}${dispoEn(s.p, c.n)}${x2 ? " and " + x2.obj : ""}`;
  return `${champ}${lead}${pieceTxt}${broche}`;
}
function lambelTxtEn(s) {
  let t = `a label ${em(s.tbr)}${s.lpn !== "3" ? ` of ${NB_EN[+s.lpn]} points` : ""}`;
  if (s.lpc) t += ` charged ${s.lpw === "milieu" ? "on the middle point" : "on each point"} with ${groupeEn(chargesEn(lambelArms(s)))}`;
  return t;
}
function brisTxtEn(s) {
  const bp = brisPiece(s), t = em(s.tbr);
  if (bp && bp.pend) return lambelTxtEn(s);
  if (bp) {
    const bord = s.lbr ? " " + (CONTOUR_EN[s.lbr] || s.lbr) : "", sens = s.sbr === "barre" ? "bendwise sinister" : "bendwise";
    const nom = { baton: "baton", filet: "filet", bordure: "bordure", canton: "canton", "franc-quartier": "quarter" }[s.br] || s.br;
    return `${un(nom)}${bord} ${t}` + (s.br === "baton" ? ` couped, ${sens}` : s.br === "filet" ? ` ${sens}` : "");
  }
  const arms = brisArms(s), c = chargesEn(arms);
  return groupeEn(c) + dphEn(arms, c);
}
const blazonEn = s => blazonCoreEn(s) + (s.br ? ", differenced by " + brisTxtEn(s) : "");
const QLAB_EN = { 2: ["1 and 4", "2 and 3"], 4: ["1", "2", "3", "4"] };
const QDEUX_EN = { c: "Per fess", t: "Per bend", l: "Per bend sinister" };
function blazonAllEn(St) {
  const lo = b => b.charAt(0).toLowerCase() + b.slice(1);
  const bz = i => (i === 0 && St.q && St.gb === "1" ? blazonCoreEn(St.A[0]) : blazonEn(St.A[i]));
  let b;
  if (!St.q) b = blazonEn(St.A[0]);
  else if (St.q === "p") {
    const moitie = h => {
      const m = halfMode(St, h), a = HALF_ARMS[h];
      if (!m) return lo(bz(a[0]));
      const labs = m === "2" ? QLAB_EN[2] : QLAB_EN[4];
      return "quarterly: " + halfUsed(St, h).map((i, n) => `${labs[n]}, ${lo(bz(i))}`).join("; ");
    };
    b = `Per pale: 1, ${moitie(0)}; 2, ${moitie(1)}`;
  } else if (chefParti(St)) b = `Per fess: 1, per pale: 1, ${lo(bz(0))}; 2, ${lo(bz(2))}; 2, ${lo(bz(1))}`;
  else if (QDEUX_EN[St.q]) b = `${QDEUX_EN[St.q]}: 1, ${lo(bz(0))}; 2, ${lo(bz(1))}`;
  else b = "Quarterly" + (St.xc ? ` by a cross${St.xp ? " formy" : ""} ${em(St.xc)}${St.xb ? ` fimbriated ${em(St.xb)}` : ""}` : "") + ": " + active(St).filter(i => i < 4).map(i => `${QLAB_EN[St.q][i]}, ${lo(bz(i))}`).join("; ");
  if (St.q && St.gb === "1" && St.A[0].br) b += "; the whole differenced by " + brisTxtEn(St.A[0]);
  if (St.ab) b += (St.q ? "; " : ", ") + "overall " + lo(blazonEn(St.A[4]));
  return b;
}

/* ---------- la règle des émaux : les mêmes contrôles que rule() (assets/dessin.js), dits en anglais ---------- */
function ruleEn(s) {
  const out = [];
  const check = (fig, sur, quoi, lieu) => {
    const a = classe(fig), b = classe(sur);
    if (fig === sur) out.push(`${quoi} ${em(fig)} on ${lieu} ${em(sur)}: same tincture, the figure disappears.`);
    else if (a === b && a !== "Fourrure") out.push(`${a === "Métal" ? "Metal on metal" : "Colour on colour"}: ${quoi.charAt(0).toLowerCase() + quoi.slice(1)} ${em(fig)} on ${lieu} ${em(sur)}.`);
  };
  if (s.p && s.f === "plein") check(s.tp, s.t1, cap("the " + (PIECE_EN[s.p] || s.p)), "a field");
  if (s.m) {
    const m = meuble(s.m), quoi = s.nb === "1" || m.seul ? "The charge" : "The charges";
    if (s.p && s.pos === "sur") check(s.tm, s.tp, quoi, { chef: "the chief", canton: "the canton", "franc-quartier": "the quarter" }[s.p] || "the ordinary");
    else if (s.f === "plein") check(s.tm, s.t1, quoi, "a field");
  }
  if (count2(s) && s.f === "plein") check(s.tm2, s.t1, s.nb2 === "1" ? "The second charge" : "The second charges", "a field");
  return out;
}
const nomCelluleEn = nom => nom.replace(/^Chef : dextre/, "Chief: dexter").replace(/^Chef : senestre/, "Chief: sinister").replace(/^Pointe/, "Base").replace(/^Quartiers 1 et 4/, "Quarters 1 and 4").replace(/^Quartiers 2 et 3/, "Quarters 2 and 3").replace(/^Quartier/, "Quarter")
  .replace(/^Moitié du chef/, "Half in chief").replace(/^Moitié de la pointe/, "Half in base").replace(/^Partie haute/, "Upper part").replace(/^Partie basse/, "Lower part")
  .replace(/^Moitié dextre/, "Dexter half").replace(/^Moitié senestre/, "Sinister half").replace(/ : quartiers 1 et 4/, ": quarters 1 and 4").replace(/ : quartiers 2 et 3/, ": quarters 2 and 3").replace(/ : quartier/, ": quarter");
function ruleAllEn(St) {
  const out = !St.q ? ruleEn(St.A[0]) : cellNames(St).flatMap(([i, nom]) => ruleEn(St.A[i]).map(w => `${nomCelluleEn(nom)}: ${w}`));
  return St.ab ? [...out, ...ruleEn(St.A[4]).map(w => `Escutcheon: ${w}`)] : out;
}
