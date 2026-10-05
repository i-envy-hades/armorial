/* L'ARMORIAL — mouvement léger des pages Blasons réels et Personnages :
   barre de lecture, menu qui passe du voile au parchemin, parallaxe douce du bandeau,
   image de fond chargée à la demande, compteurs du bandeau. Sans dépendance ;
   éteint avec prefers-reduced-motion. La page se lit sans ce fichier. */
(() => {
  const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  const hero = document.querySelector(".hero"), bar = document.querySelector(".progress i"), bg = document.querySelector(".hero-bg2");
  if(!hero) return;

  let queued = false;
  const frame = () => {
    queued = false;
    const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
    if(bar) bar.style.setProperty("--p", h > 0 ? Math.min(1, y / h).toFixed(4) : 0);
    const mast = document.querySelector(".mast");
    if(mast) mast.classList.toggle("solid", y > hero.offsetHeight - 90);
    if(!reduce && bg && y < hero.offsetHeight + 200) bg.style.setProperty("--py", (y * .22).toFixed(1) + "px");
  };
  const ask = () => { if(!queued){ queued = true; requestAnimationFrame(frame); } };
  addEventListener("scroll", ask, {passive:true}); addEventListener("resize", ask); frame();

  /* image du bandeau et du pied de page : chargées après la page, elles apparaissent en fondu */
  const charge = (url, ok) => { if(!url) return; const i = new Image(); i.onload = () => ok(url); i.src = url; };
  if(bg) charge(bg.dataset.img, u => { bg.style.backgroundImage = `url("${u}")`; bg.classList.add("on"); });
  /* une vidéo d'ambiance (data-video) : seulement sur grand écran, sans « réduire les animations » ni économie de données ;
     elle se pose sur l'image, qui reste l'affiche, et s'arrête quand le bandeau sort de l'écran */
  if(bg && bg.dataset.video && !reduce && !matchMedia("(max-width:700px)").matches && !(navigator.connection && navigator.connection.saveData)){
    const v = document.createElement("video");
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = "auto"; v.setAttribute("aria-hidden", "true"); v.tabIndex = -1;
    v.src = bg.dataset.video;
    v.addEventListener("playing", () => v.classList.add("on"), {once:true});
    bg.appendChild(v);
    const joue = () => v.play().catch(() => {});
    if("IntersectionObserver" in window) new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? joue() : v.pause())).observe(hero); else joue();
  }
  const foot = document.querySelector("footer");
  if(foot && foot.dataset.img) charge(foot.dataset.img, u => foot.style.setProperty("--foot-img", `url("${new URL(u, location.href).href}")`));   // une variable CSS se résout depuis la feuille de style : on donne l'adresse entière

  /* les chiffres du bandeau se comptent en montant */
  document.querySelectorAll(".hero-facts .n").forEach(n => {
    const to = parseInt(n.textContent, 10);
    if(reduce || !to) return;
    const t0 = performance.now() + 1100, dur = 1200;
    n.textContent = "0";
    const step = t => { const k = Math.max(0, Math.min(1, (t - t0) / dur)); n.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if(k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
})();
