(()=>{
  if(document.querySelector("#xySplash"))return;
  const splash=document.createElement("div");
  splash.id="xySplash";
  splash.innerHTML='<div class="xy-splash-scene"><div class="xy-splash-moon"></div><div class="xy-splash-house"><div class="xy-splash-roof"></div><div class="xy-splash-body"></div><div class="xy-splash-door"></div><div class="xy-splash-window"></div></div><div class="xy-splash-sea"><div class="xy-splash-wave"></div><div class="xy-splash-wave"></div><div class="xy-splash-wave"></div></div><div class="xy-splash-title">砚屿</div><div class="xy-splash-sub">回家了</div></div>';
  document.body.appendChild(splash);
  requestAnimationFrame(()=>setTimeout(()=>splash.classList.add("xy-splash-out"),1050));
  setTimeout(()=>splash.remove(),1650);
})();