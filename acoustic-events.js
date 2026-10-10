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
  async function analyzeBlob(blob){
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx||!blob||blob.size>18*1024*1024)return [];
    let ctx=null;
    try{
      ctx=new Ctx();
      const buffer=await ctx.decodeAudioData(await blob.arrayBuffer());
      const data=buffer.getChannelData(0),rate=buffer.sampleRate;
      if(!data.length||!rate)return [];
      const frame=Math.max(256,Math.floor(rate*.08)),step=Math.max(frame,Math.floor(rate*.12));
      let pulses=0,active=0,zeroCrossTotal=0,frames=0,high=0;
      for(let off=0;off<data.length&&off<rate*45;off+=step){
        let rms=0,z=0,peak=0;
        const end=Math.min(data.length,off+frame),n=end-off;
        for(let j=off;j<end;j++){
          const v=data[j];rms+=v*v;peak=Math.max(peak,Math.abs(v));
          if(j>off&&((v>=0)!==(data[j-1]>=0)))z++;
        }
        const power=Math.sqrt(rms/Math.max(1,n));
        if(power>.028){active++;zeroCrossTotal+=z/Math.max(1,n)}
        if(power>.06&&peak>.4)pulses++;
        if(power>.022&&z/Math.max(1,n)>.18)high++;
        frames++;
      }
      const events=[];
      if(frames>=8&&pulses>=3&&pulses<frames*.35)events.push("录音中有多次短促的声音");
      if(frames>=8&&active>=frames*.20&&high>=active*.45)events.push("录音中存在持续的高频噪声或气流声");
      return events.slice(0,2);
    }catch{
      // Incompatible codec/device: no claim about the sound.
      return [];
    }finally{try{await ctx?.close()}catch{}}
  }
  window.xyAcousticEvents={start,analyzeBlob};
})();
