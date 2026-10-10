(()=>{
  // Lightweight acoustic cues, not a sound-label classifier. Never claim to identify
  // a person, body state, specific event or sound source from these features.
  function start(stream){
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx||!stream?.getAudioTracks?.().length)return null;
    let ctx,source,analyser,interval=null;
    const events=[],windows=[];
    try{
      ctx=new Ctx();source=ctx.createMediaStreamSource(stream);
      analyser=ctx.createAnalyser();analyser.fftSize=1024;analyser.smoothingTimeConstant=.6;
      source.connect(analyser);
      const wave=new Float32Array(analyser.fftSize);
      const bands=new Uint8Array(analyser.frequencyBinCount);
      interval=setInterval(()=>{
        if(ctx.state==="closed")return;
        analyser.getFloatTimeDomainData(wave);analyser.getByteFrequencyData(bands);
        let energy=0,peak=0,changes=0;
        for(let i=0;i<wave.length;i++){
          energy+=wave[i]*wave[i];peak=Math.max(peak,Math.abs(wave[i]));
          if(i&&Math.abs(wave[i]-wave[i-1])>.18)changes++;
        }
        const rms=Math.sqrt(energy/wave.length);
        if(rms<.012)return;
        let low=0,high=0;
        const split=Math.floor(bands.length*.25);
        for(let i=0;i<bands.length;i++){if(i<split)low+=bands[i];else high+=bands[i]}
        windows.push({rms,peak,ratio:high/Math.max(1,low),changes});
        if(windows.length>=20){
          const avg=windows.reduce((a,v)=>a+v.rms,0)/windows.length;
          const highRatio=windows.reduce((a,v)=>a+v.ratio,0)/windows.length;
          const pulses=windows.filter(v=>v.peak>.5&&v.rms>.065).length;
          let label="";
          if(pulses>=3&&pulses<=11)label="检测到数次短促声音";
          else if(avg>.017&&highRatio>2.5)label="检测到持续的高频气流或环境噪声";
          // These categories are intentionally non-specific; don't infer breathing or touch.
          if(label&&events.at(-1)!==label&&events.length<3)events.push(label);
          windows.length=0;
        }
      },125);
      return {stop(){
        if(interval!==null){clearInterval(interval);interval=null}
        try{source.disconnect()}catch{}
        try{analyser.disconnect()}catch{}
        try{ctx.close()}catch{}
        return events.slice();
      }};
    }catch(error){
      if(interval!==null)clearInterval(interval);
      try{source?.disconnect()}catch{}
      try{ctx?.close()}catch{}
      return null;
    }
  }
  window.xyAcousticEvents={start};
})();
