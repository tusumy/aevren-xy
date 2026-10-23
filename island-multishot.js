/* Distinct cinematic compositions. The destination illustration appears only in the final shot. */
(()=>{
"use strict";
const world=document.querySelector("#xyIslandWorld");
const film=world?.querySelector(".xy-island-film");
const sprites=window.xyIslandMotionSprites;
if(!world||!film||!sprites?.swing||!sprites?.fly||!sprites?.land)return;
const svg=(sky,front)=>'<svg class="xy-cine-art" viewBox="0 0 720 1280" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="sk" x2="0" y2="1"><stop stop-color="'+sky+'"/><stop offset=".48" stop-color="#e0dfe9"/><stop offset="1" stop-color="#96c3c9"/></linearGradient><radialGradient id="sun"><stop stop-color="#fffce7"/><stop offset="1" stop-color="#fff3e6" stop-opacity="0"/></radialGradient><linearGradient id="rock" x2=".5" y2="1"><stop stop-color="#adb9ae"/><stop offset="1" stop-color="#607c8a"/></linearGradient></defs>'+
'<rect width="720" height="1280" fill="url(#sk)"/><circle cx="580" cy="247" r="220" fill="url(#sun)"/>'+
'<path d="M-60 685 Q140 589 256 689 T496 675 Q600 615 790 702 L790 880 -60 880Z" fill="#94b3c1" opacity=".42"/>'+
'<g fill="#fff8f5" opacity=".62"><ellipse cx="70" cy="725" rx="230" ry="86"/><ellipse cx="545" cy="860" rx="305" ry="107"/><ellipse cx="220" cy="1150" rx="290" ry="96"/><ellipse cx="660" cy="1090" rx="210" ry="77"/></g>'+front+'</svg>';
const petals=Array.from({length:25},(_,i)=>'<circle cx="'+((i*79)%560+10)+'" cy="'+((i*53)%190+5)+'" r="'+(7+i%5*4)+'" fill="'+(i%3===0?"#ffe6dc":"#f5c5d3")+'" opacity=".76"/>').join("");
const branch='<path d="M-80 120 Q130 38 295 61 T550 -50" fill="none" stroke="#866675" stroke-width="50" stroke-linecap="round"/><path d="M147 72 Q294 90 436 232" fill="none" stroke="#9e7c85" stroke-width="18"/>'+petals;
const ridge='<path d="M-80 1050 Q100 934 280 1032 L325 1280 -80 1280Z" fill="url(#rock)"/><path d="M-80 1030 Q105 960 279 1034 L301 1088 Q120 1066 -80 1115 Z" fill="#a6bda9"/>';
const village='<path d="M356 946 Q373 882 397 870 L424 806 L450 861 Q480 885 496 947Z" fill="#7794a4" opacity=".83"/><path d="M387 891 L431 853 470 891Z" fill="#576f86" opacity=".8"/><rect x="407" y="897" width="35" height="26" fill="#d3c9bb"/>';
const waves='<g stroke="#fffaf7" stroke-width="10" opacity=".38" fill="none"><path d="M-90 1140 Q230 870 790 450"/><path d="M-50 945 Q270 690 810 315"/><path d="M-65 823 Q307 624 760 606"/></g>';
const img=name=>'<img class="xy-cine-sprite xy-cine-sprite-'+name+'" alt="" draggable="false" src="'+sprites[name]+'">';
const frame=(name,art,extra="")=>'<section class="xy-cine-shot xy-cine-'+name+'" aria-hidden="true">'+art+extra+'</section>';
film.innerHTML=
 frame("leaf",svg("#ead1de",branch+ridge),'<div class="xy-cine-leaf-veil"></div>')+
 frame("swing",svg("#eac8da",branch+ridge+village),'<img class="xy-cine-bough" src="'+sprites.tree+'" alt="">'+img("swing"))+
 frame("jump",svg("#d3c6e7",waves+petals),img("fly")+'<div class="xy-cine-speed"></div>')+
 frame("cloud",svg("#aebfdb",waves+village),img("fly")+'<div class="xy-cine-cloud-front"></div>')+
 frame("land",'<div class="xy-cine-island-bg"></div>'+img("land")+'<div class="xy-cine-landing-cloud"></div>');
film.classList.add("xy-cine-story");
world.classList.add("xy-cinema-multishot");
if(window.xyIslandPaintingData?.startsWith("data:image/"))
 film.style.setProperty("--xy-cine-home",'url("'+window.xyIslandPaintingData+'")');
})();
