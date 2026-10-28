const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");

test("web phone screen retains live interaction hooks in redesigned pearl glass UI",()=>{
 const js=read("call-core.js"),css=read("call-core.css"),index=read("index.html");
 new vm.Script(js,{filename:"call-core.js"});
 for(const cls of [
   "xy-call","xy-call-card","xy-call-avatar","xy-call-name","xy-call-status","xy-call-time",
   "xy-call-transcript","xy-call-push","xy-call-fallback","xy-call-answer","xy-call-hangup"
 ]){
   assert.ok(js.includes('class="'+cls)||js.includes('class="'+cls+' '),"missing required existing call UI: "+cls);
   assert.ok(css.includes("."+cls),"missing call styling for: "+cls);
 }
 assert.ok(js.includes("acceptBtn.onclick=answer;hangupBtn.onclick=hangup;"));
 assert.ok(js.includes("pushBtn.onclick="));
 assert.ok(js.includes('fallbackInput.onkeydown='));
 assert.ok(js.includes("window.AevrenVoice"),"voice processing should be intact");
 assert.ok(js.includes("kind:\"call\""),"connected call logs must persist");
 assert.ok(js.includes('class="xy-call-button-disc"'));
 assert.ok(js.includes('class="xy-call-identity"'));
 assert.ok(js.includes('role="log"'));
 assert.ok(css.includes(".xy-call-actions button[hidden]"),"connected state must hide answer control");
 assert.ok(css.includes(".xy-call.ringing"),"incoming state styling");
 assert.ok(css.includes(".xy-call.connected"),"connected state styling");
 assert.ok(css.includes("@media(max-width:760px)"),"phone breakpoint");
 assert.ok(css.includes("prefers-reduced-motion"),"accessibility reduced-motion");
 assert.ok(css.includes('data-theme-mode="dark"'),"dark styling");
 assert.ok(index.includes("call-core.css?v=xy20261028pearlaura1"));
 assert.ok(index.includes("call-core.js?v=xy20261028pearlaura1"));
});

test("native locked-screen call screen preserves notification answer and decline intents",()=>{
 const native=read("android/app/src/main/java/com/aevren/xy/IncomingCallActivity.kt");
 const manager=read("android/app/src/main/java/com/aevren/xy/NativeCallManager.kt");
 const splash=read("android/app/src/main/java/com/aevren/xy/SeaSplashView.kt");
 for(const method of ["NativeCallManager.ACTION_ANSWER","NativeCallManager.ACTION_DECLINE",
   "NativeCallManager.dismiss(this)","MainActivity.ACTION_NATIVE_CALL_ANSWER",
   "NativeCallManager.EXTRA_CHARACTER_ID","NativeCallManager.EXTRA_CHARACTER_NAME",
   "setShowWhenLocked(true)","setTurnScreenOn(true)","FLAG_KEEP_SCREEN_ON",
   "NativeCallManager.loadAvatar(this, characterId)"]){
   assert.ok(native.includes(method),"missing original call behavior: "+method);
 }
 assert.ok(native.includes("PearlCallBackdrop"),"call screen needs the pearl atmosphere");
 assert.ok(native.includes("GradientDrawable.OVAL"),"avatar and buttons should be round");
 assert.ok(native.includes("clipToOutline = true"),"photo avatar should be circular");
 assert.ok(native.includes('callButton("接听"'));
 assert.ok(native.includes('callButton("拒绝"'));
 assert.ok(!native.includes("android.widget.Button"),"remove default material buttons");
 assert.ok(!native.includes('setBackgroundColor(Color.rgb(220, 233, 227))'),"remove flat old background");
 assert.ok(manager.includes("ACTION_ANSWER")&&manager.includes("ACTION_DECLINE"));
 assert.ok(splash.includes("RadialGradient"),"stylistically align with current startup page");
});
