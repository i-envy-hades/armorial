/* L'ARMORIAL — mouvement de la « chronique » (index.html seulement).
   Sans dépendance : barre de lecture, parallaxe douce,
   chargement paresseux des bandeaux de chapitre, compteurs.
   Tout s'éteint avec prefers-reduced-motion ; la page se lit sans ce fichier. */
(() => {
  const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  const hero = document.querySelector(".hero");
  const bar = document.querySelector(".progress i");
  if(!hero) return;

  /* ---- la vidéo du bandeau (2,5 Mo) ne se charge que si elle sert : écran large, mouvement permis, pas d'économie de données ;
     sinon le fond reste l'affiche (assets/epopee/tournoi-ecus.jpg), déjà préchargée ---- */
  const video = document.querySelector(".hero-bg video");
  if(video && !reduce && !matchMedia("(max-width:700px)").matches && !(navigator.connection && navigator.connection.saveData)){
    video.preload = "auto";
    video.play().catch(() => {});
  }

  /* ---- défilement : barre, bandeau, parallaxe (une image d'animation à la fois) ---- */
  let layers = [...document.querySelectorAll("[data-parallax]")], queued = false;
  const frame = () => {
    queued = false;
    const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
    if(bar) bar.style.setProperty("--p", h > 0 ? Math.min(1, y / h).toFixed(4) : 0);
    const mast = document.querySelector(".mast");
    if(mast) mast.classList.toggle("solid", y > hero.offsetHeight - 90);
    if(reduce) return;
    for(const el of layers){
      const r = el.parentElement.getBoundingClientRect();
      if(r.bottom < -240 || r.top > innerHeight + 240) continue;
      const k = parseFloat(el.dataset.parallax) || 0.2;
      el.style.setProperty("--py", ((r.top + r.height / 2 - innerHeight / 2) * -k).toFixed(1) + "px");
    }
  };
  const ask = () => { if(!queued){ queued = true; requestAnimationFrame(frame); } };
  addEventListener("scroll", ask, {passive:true});
  addEventListener("resize", ask);
  frame();

  /* ---- bandeaux de chapitre : l'image se charge à l'approche, puis apparaît ---- */
  const plates = () => {
    const io = new IntersectionObserver((es) => es.forEach(e => {
      if(!e.isIntersecting) return;
      io.unobserve(e.target);
      const pl = e.target, bg = pl.querySelector(".plate-bg"), img = new Image();
      img.onload = () => { bg.style.backgroundImage = `url("${img.src}")`; pl.classList.add("on"); };
      img.onerror = () => pl.classList.add("on");
      img.src = pl.dataset.img;
    }), {rootMargin:"700px 0px"});
    document.querySelectorAll(".plate[data-img]").forEach(p => io.observe(p));
    layers = [...document.querySelectorAll("[data-parallax]")]; ask();
  };

  /* ---- compteurs du héros ---- */
  const counters = () => {
    document.querySelectorAll(".hero .counts .n").forEach(n => {
      const to = parseInt(n.textContent, 10);
      if(reduce || !to) return;
      const t0 = performance.now() + 1500, dur = 1400;
      n.textContent = "0";
      const step = (t) => {
        const k = Math.max(0, Math.min(1, (t - t0) / dur)), e = 1 - Math.pow(1 - k, 3);
        n.textContent = Math.round(to * e);
        if(k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  };

  const ready = () => { plates(); counters(); };
  if(document.querySelector(".plate")) ready();
  else document.addEventListener("armorial:ready", ready, {once:true});
})();
