/* L'ARMORIAL — le formulaire de retour : retour.html et en-feedback.html.
   Le message part directement dans la base (retours/{id}), sans compte ; tools/firebase/firestore.rules en vérifie la forme et réserve la lecture
   au curateur (tools/retours.html). Contre les envois à la chaîne : un champ invisible, que seul un robot remplit, et une minute entre deux messages. */
(async () => {
  "use strict";
  const $ = s => document.querySelector(s);
  const form = $("#ret-form"), err = $("#ret-err"), ok = $("#ret-ok");
  const CLE_DERNIER = "armorial.retour.dernier", ATTENTE = 60000;

  /* d'où l'on vient : le lien du pied de page le dit ; seule une page du site sert de lien de retour */
  const depuis = (new URLSearchParams(location.search).get("depuis") || "").slice(0, 200);
  const pageDuSite = /^[\w-]+\.html(#[^\s<>"]*)?$/.test(depuis);
  if (depuis) { const p = $("#ret-depuis"); p.textContent = `${Tr("Depuis la page", "From the page")}${Tr(" : ", ": ")}${depuis}`; p.hidden = false; }
  if (pageDuSite) $("#ret-retour").setAttribute("href", depuis);

  let CFG = {};
  try { CFG = await (await fetch("data/compte.json")).json(); } catch (e) { /* sans base : dit ci-dessous à l'envoi */ }

  const dernier = () => { try { return +localStorage.getItem(CLE_DERNIER) || 0; } catch (e) { return 0; } };
  const garde = () => { try { localStorage.setItem(CLE_DERNIER, String(Date.now())); } catch (e) { /* sans mémoire : pas de délai */ } };
  const merci = () => { form.hidden = true; const m = $("#ret-merci"); m.hidden = false; m.focus(); };
  async function envoie(champs) {
    const id = Array.from(crypto.getRandomValues(new Uint8Array(24)), o => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[o % 62]).join("");
    const hote = CFG.emulateur ? `${CFG.emulateur}/firestore` : "https://firestore.googleapis.com";
    const fields = Object.fromEntries(Object.entries(champs).map(([k, v]) => [k, { stringValue: v }]));
    fields.cree = { timestampValue: new Date().toISOString() };
    const r = await fetch(`${hote}/v1/projects/${CFG.projet}/databases/(default)/documents/retours/${id}?key=${encodeURIComponent(CFG.cle)}&currentDocument.exists=false`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields }) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  }

  form.addEventListener("submit", async e => {
    e.preventDefault();
    err.textContent = "";
    if ($("#ret-site").value) return merci();                  // un robot : on ne lui dit rien
    const message = $("#ret-message").value.trim(), email = $("#ret-email").value.trim();
    if (message.length < 3) { err.textContent = Tr("Écrivez d'abord votre message.", "Please write your message first."); return $("#ret-message").focus(); }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = Tr("Cette adresse e-mail ne semble pas valable.", "This e-mail address doesn't look valid."); return $("#ret-email").focus(); }
    if (!CFG.projet) { err.textContent = Tr("L'envoi n'est pas disponible pour l'instant.", "Sending isn't available right now."); return; }
    const attente = dernier() + ATTENTE - Date.now();
    if (attente > 0) { err.textContent = Tr(`Vous venez d'envoyer un message : patientez encore ${Math.ceil(attente / 1000)} secondes.`, `You've just sent a message: please wait ${Math.ceil(attente / 1000)} more seconds.`); return; }
    ok.disabled = true;
    try {
      await envoie({ type: form.elements.type.value, message, page: depuis, langue: LANGUE, ...(email ? { email } : {}) });
      garde(); merci();
    } catch (x) { err.textContent = Tr("Le message n'est pas parti. Réessayez dans un moment.", "The message wasn't sent. Please try again in a moment."); }
    finally { ok.disabled = false; }
  });
})();
