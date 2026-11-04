/* L'ARMORIAL — l'image d'un résultat de « L'Écu du jour », à partager : un carré de 1080 pixels, dessiné dans le navigateur (rien n'est envoyé).
   Le jour même, l'écu reste une silhouette grise, pour ne pas donner la réponse à ceux qui n'ont pas encore joué.
   Dessiner un écu ici, c'est faire d'un <svg> de la page une image autonome : il lui faut ses dégradés (globalDefs, assets/blason.js). */
const ImageResultat = (() => {
  "use strict";
  const COTE = 1080, ENCRE = "#2a2620", DOUX = "#6f665a", OR = "#a9812e", FOND = "#f7f1e1";
  const COULEURS = { ok: "#3a9d4f", mid: "#f3c33b", no: "#d9d2c2" };
  const SERIF = '"Marcellus", Georgia, serif', SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  async function imageDeSvg(svg) {
    const defs = (/<defs>[\s\S]*<\/defs>/.exec(globalDefs()) || [""])[0];
    const pose = svg.replace(/^<svg\b([^>]*)>/, (m, attrs) => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"${attrs.replace(/\sclass="[^"]*"/, "")}>${defs}`);
    const url = URL.createObjectURL(new Blob([pose], { type: "image/svg+xml" }));
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally { setTimeout(() => URL.revokeObjectURL(url), 2000); }
  }
  function posee(c, img, x, y, l, h) {                 // l'image, entière, au centre de son cadre
    const r = Math.min(l / (img.naturalWidth || l), h / (img.naturalHeight || h)), w = (img.naturalWidth || l) * r, g = (img.naturalHeight || h) * r;
    c.drawImage(img, x + (l - w) / 2, y + (h - g) / 2, w, g);
  }
  function tientDans(c, texte, largeur) {              // coupé s'il le faut : un pseudo peut être long
    if (c.measureText(texte).width <= largeur) return texte;
    let t = texte;
    while (t && c.measureText(t + "…").width > largeur) t = t.slice(0, -1);
    return t + "…";
  }
  const carreArrondi = (c, x, y, l, r) => { c.beginPath(); c.roundRect(x, y, l, l, r); c.fill(); };

  /* d : { titre, sousTitre, score, gagne, points, detail, lignes (cases "ok" | "mid" | "no"), ecu (svg), masque, armes (svg ou ""), pseudo, titreJoueur, invite, adresse } */
  async function dessine(d) {
    try { await Promise.all([document.fonts.load(`64px "Marcellus"`), document.fonts.ready]); } catch (e) { /* la police de secours suffit */ }
    const cv = document.createElement("canvas"); cv.width = cv.height = COTE;
    const c = cv.getContext("2d");
    c.fillStyle = FOND; c.fillRect(0, 0, COTE, COTE);
    c.strokeStyle = OR; c.lineWidth = 5; c.strokeRect(28, 28, COTE - 56, COTE - 56);
    c.textBaseline = "alphabetic";

    /* l'en-tête */
    c.textAlign = "center"; c.fillStyle = ENCRE; c.font = `76px ${SERIF}`;
    c.fillText(d.titre, COTE / 2, 125);
    c.fillStyle = DOUX; c.font = `600 31px ${SANS}`;
    c.fillText(tientDans(c, d.sousTitre, COTE - 120), COTE / 2, 178);

    /* l'écu, à gauche */
    const ecu = await imageDeSvg(d.ecu);
    posee(c, ecu, 70, 215, 420, 520);
    if (d.masque) { c.fillStyle = "#fff"; c.textAlign = "center"; c.font = `170px ${SERIF}`; c.fillText("?", 280, 530); }

    /* le score et la grille, à droite */
    const X = 530, L = COTE - X - 70;
    c.textAlign = "left"; c.fillStyle = d.gagne ? "#26763a" : "#8f1f1b"; c.font = `800 118px ${SANS}`;
    c.fillText(d.score, X, 318);
    c.fillStyle = ENCRE; c.font = `700 40px ${SANS}`;
    if (d.points) c.fillText(tientDans(c, d.points, L), X, 374);
    c.fillStyle = DOUX; c.font = `500 28px ${SANS}`;
    if (d.detail) c.fillText(tientDans(c, d.detail, L), X, d.points ? 414 : 374);
    const cols = d.lignes.length ? d.lignes[0].length : 1, rangs = Math.max(1, d.lignes.length), haut = 440, bas = 742;
    const pas = Math.min(Math.floor(L / cols), Math.floor((bas - haut) / rangs), 74), cote = pas - 8;
    d.lignes.forEach((l, i) => l.forEach((k, j) => { c.fillStyle = COULEURS[k]; carreArrondi(c, X + j * pas, haut + i * pas, cote, 10); }));

    /* le pied : les armes du joueur et l'adresse */
    c.strokeStyle = "rgba(169,129,46,.5)"; c.lineWidth = 2; c.beginPath(); c.moveTo(70, 790); c.lineTo(COTE - 70, 790); c.stroke();
    let x = 70;
    if (d.armes) { try { posee(c, await imageDeSvg(d.armes), 70, 815, 170, 205); x = 260; } catch (e) { /* sans ses armes : le reste de l'image vaut encore */ } }
    c.textAlign = "left"; c.fillStyle = ENCRE;
    if (d.pseudo) {
      c.font = `800 46px ${SANS}`; c.fillText(tientDans(c, d.pseudo, COTE - x - 70), x, 885);
      if (d.titreJoueur) { c.fillStyle = "#8a6a12"; c.font = `600 31px ${SANS}`; c.fillText(tientDans(c, d.titreJoueur, COTE - x - 70), x, 930); }
    }
    c.fillStyle = DOUX; c.font = `500 28px ${SANS}`;
    c.fillText(tientDans(c, d.invite, COTE - x - 70), x, d.pseudo ? 982 : 890);
    c.fillStyle = OR; c.font = `700 32px ${SANS}`;
    c.fillText(tientDans(c, d.adresse, COTE - x - 70), x, d.pseudo ? 1022 : 935);
    return cv;
  }
  return { dessine };
})();
