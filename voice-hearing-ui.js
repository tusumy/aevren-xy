(()=>{
function mount(host){
  if(!host||host.querySelector("#xyHearingSettings"))return;
  const cfg=window.xyVoiceHearing.config();
  const box=document.createElement("div");
  box.id="xyHearingSettings";
  box.style.cssText="border:1px solid #9cb7a4;border-radius:15px;padding:13px;margin:14px 0;display:grid;gap:9px";
  const heading=document.createElement("strong");heading.textContent="声音感知 · ears / Seven Ears";box.append(heading);
  const desc=document.createElement("small");desc.textContent="默认关闭。ears 对照个人声音，Seven Ears 分析录音留言。需要受保护的 HTTPS 服务。";box.append(desc);
  function checkbox(text,value){
    const label=document.createElement("label"),input=document.createElement("input");
    input.type="checkbox";input.checked=!!value;label.append(input,document.createTextNode(" "+text));box.append(label);return input;
  }
  function address(label,value){
    const title=document.createElement("label"),input=document.createElement("input");
    title.textContent=label;input.type="url";input.placeholder="https://你的声音代理地址";input.value=value||"";
    box.append(title,input);return input;
  }
  const ears=checkbox("使用 ears",cfg.ears),earsUrl=address("ears 地址",cfg.earsUrl);
  const seven=checkbox("语音留言使用 Seven Ears",cfg.seven),sevenUrl=address("Seven Ears 地址",cfg.sevenUrl);
  const secret=document.createElement("input");secret.type="password";secret.placeholder="声音代理访问令牌";secret.value=cfg.accessKey||"";
  const secretLabel=document.createElement("label");secretLabel.textContent="代理令牌（仅当前会话）";box.append(secretLabel,secret);
  const button=document.createElement("button"),status=document.createElement("small");
  button.type="button";button.textContent="保存声音感知";button.className="panel-action";
  status.textContent="没有配置时继续使用原语音转写。";
  box.append(button,status);host.append(box);
  button.onclick=()=>{
    const next={ears:ears.checked,seven:seven.checked,earsUrl:earsUrl.value.trim(),sevenUrl:sevenUrl.value.trim()};
    const safe=raw=>{try{const u=new URL(raw);return u.protocol==="https:"||(u.protocol==="http:"&&["localhost","127.0.0.1"].includes(u.hostname))}catch{return false}};
    if((next.ears&&!safe(next.earsUrl))||(next.seven&&!safe(next.sevenUrl))){status.textContent="需要 HTTPS 地址，未保存";return}
    sessionStorage.setItem("xy.voice.hearing.key",secret.value.trim());
    localStorage.setItem("xy.voice.hearing.v1",JSON.stringify(next));
    status.textContent="声音设置已保存，下条录音生效";
  };
}
window.xyVoiceHearing.mount=mount;
})();