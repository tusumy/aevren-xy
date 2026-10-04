(()=>{
  const forceClose=()=>{
    document.querySelector("#panel")?.classList.remove("open");
    document.querySelector("#sidebar")?.classList.remove("open");
    document.querySelector("#scrim")?.classList.remove("show");
  };
  document.addEventListener("click",e=>{
    const close=e.target.closest?.("#closePanel");
    if(!close)return;
    e.preventDefault();
    e.stopPropagation();
    forceClose();
  },true);
})();
