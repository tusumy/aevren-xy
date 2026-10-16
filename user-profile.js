(()=>{
  "use strict";
  const KEY="xy.userProfile.v1";
  const DEFAULT="你";
  function read(){
    try{
      const value=JSON.parse(localStorage.getItem(KEY)||"{}");
      return typeof value?.name==="string"&&value.name.trim()?value.name.trim().slice(0,40):DEFAULT;
    }catch{return DEFAULT}
  }
  function name(){return read()}
  function setName(input){
    const value=String(input??"").replace(/[\r\n\t]/g," ").trim().slice(0,40);
    if(!value)throw Error("请先填写你的名字");
    localStorage.setItem(KEY,JSON.stringify({name:value}));
    window.dispatchEvent(new CustomEvent("xy-user-profile-change",{detail:{name:value}}));
    return value;
  }
  function replace(text,roleName){
    if(typeof text!=="string"||!text.includes("{{"))return text;
    const yours=name();
    const other=String(roleName||window.xyCurrentCharacter?.()?.name||"角色").trim()||"角色";
    return text.replace(/{{\s*(user|username|user_name|char|charname|character)\s*}}/gi,
      (_all,key)=>/^(?:user|username|user_name)$/i.test(key)?yours:other);
  }
  function mapContent(content,roleName){
    if(typeof content==="string")return replace(content,roleName);
    if(Array.isArray(content))return content.map(p=>{
      if(typeof p==="string")return replace(p,roleName);
      if(p&&typeof p==="object"&&typeof p.text==="string")return {...p,text:replace(p.text,roleName)};
      return p;
    });
    return content;
  }
  window.xyTavernMacros={name,setName,replace,mapContent,storageKey:KEY};
})();