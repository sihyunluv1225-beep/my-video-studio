const {chromium}=require('playwright');const {spawn}=require('child_process');
const mode=process.argv[2]; const D=__dirname;
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1080,height:1920}});
  await p.goto('http://127.0.0.1:8765/reel.html'); await p.evaluate(()=>preload()); await p.waitForTimeout(300);
  const dur=await p.evaluate(()=>DUR);
  if(mode==='stills'){
    const ts=process.argv.slice(3).map(Number);
    for(const t of ts){await p.evaluate(t=>renderAt(t),t);await p.waitForTimeout(50);await p.screenshot({path:`${D}/still_${t}.jpg`,type:'jpeg',quality:80});}
  } else {
    const fps=30,n=Math.ceil(dur*fps);
    const ff=spawn('ffmpeg',['-y','-f','image2pipe','-framerate',String(fps),'-c:v','mjpeg','-i','-','-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-shortest','-c:v','libx264','-preset','slow','-crf','17','-pix_fmt','yuv420p','-profile:v','high','-movflags','+faststart','-c:a','aac','-b:a','128k',process.argv[3]],{stdio:['pipe','ignore','inherit']});
    for(let i=0;i<n;i++){await p.evaluate(t=>renderAt(t),i/fps);const buf=await p.screenshot({type:'jpeg',quality:95});if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));}
    ff.stdin.end(); await new Promise(r=>ff.on('close',r)); console.log('frames',n);
  }
  await b.close();
})();
