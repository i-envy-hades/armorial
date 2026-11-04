/* L'ARMORIAL — outil du curateur (tools/retours.html) : les messages du formulaire de retour, du plus récent au plus ancien.
   Ils viennent de n'importe qui : tout s'affiche échappé, et le lien vers la page citée n'est posé que s'il mène à une page du site. */
(async () => {
  "use strict";
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const TYPES = { erreur: "Erreur", bug: "Problème", idee: "Idée" };
  await Compte.pret;
  async function dessine() {
    const liste = $("#messages"), qui = $("#qui");
    if (!Compte.enLigne) { qui.innerHTML = `<span class="err">Pas de base en ligne configurée (data/compte.json).</span>`; return; }
    const connecte = !!Compte.uid();
    $("#b-compte").hidden = connecte; $("#b-relire").hidden = !connecte;
    if (!connecte) { qui.textContent = "Connectez-vous avec le compte du curateur."; liste.innerHTML = ""; return; }
    let l;
    try { l = await Compte.retours.liste(); }
    catch (e) { qui.innerHTML = `<span class="err">Lecture refusée : ce compte n'est pas celui du curateur, ou les règles ne sont pas publiées (${esc(e.message)}).</span>`; liste.innerHTML = ""; return; }
    qui.textContent = l.length ? `${l.length} message${l.length > 1 ? "s" : ""}.` : "Aucun message pour l'instant.";
    liste.innerHTML = l.map(m => {
      const page = String(m.page || ""), lien = /^[\w-]+\.html(#[^\s<>"]*)?$/.test(page) ? `<a href="${esc(page)}" target="_blank" rel="noopener">${esc(page)}</a>` : esc(page);
      const email = /^[^\s@"<>]+@[^\s@"<>]+$/.test(m.email || "") ? `<a href="mailto:${esc(m.email)}">${esc(m.email)}</a>` : "";
      return `<li data-id="${esc(m.id)}"><div class="tete"><span class="type ${TYPES[m.type] ? esc(m.type) : ""}">${esc(TYPES[m.type] || m.type)}</span><span>${esc(String(m.cree || "").slice(0, 16).replace("T", " "))}</span>${lien ? `<span>${lien}</span>` : ""}<span>${esc(m.langue || "")}</span>${email ? `<span>${email}</span>` : ""}</div>
        <p class="texte">${esc(m.message)}</p><button type="button" class="efface">Effacer</button></li>`;
    }).join("");
  }
  $("#messages").addEventListener("click", async e => {
    const b = e.target.closest(".efface"); if (!b) return;
    if (!confirm("Effacer ce message ? On ne pourra plus le relire.")) return;
    await Compte.retours.efface(b.closest("li").dataset.id);
    dessine();
  });
  $("#b-compte").addEventListener("click", () => Compte.ouvre());
  $("#b-relire").addEventListener("click", dessine);
  if (Compte.surSynchro) { let t = 0; Compte.surSynchro(() => { clearTimeout(t); t = setTimeout(dessine, 300); }); }
  dessine();
})();
