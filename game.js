(() => {
  "use strict";
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const speedEl = document.getElementById("speed");
  const overlay = document.getElementById("overlay");
  const titleEl = document.getElementById("overlayTitle");
  const textEl = document.getElementById("overlayText");
  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const soundBtn = document.getElementById("soundBtn");

  const W = 480, H = 760;
  const road = { x: 65, w: 350, lanes: 3 };
  const laneW = road.w / road.lanes;
  let player, traffic, particles, score, best, speed, roadOffset, spawnTimer, state;
  let left = false, right = false, soundOn = true, lastTime = 0, audioCtx = null;
  best = Number(localStorage.getItem("vamp4_best") || 0);
  bestEl.textContent = String(best).padStart(6, "0");

  function reset() {
    player = { lane: 1, x: road.x + laneW * 1.5, y: H - 145, w: 48, h: 86, targetX: road.x + laneW * 1.5 };
    traffic = []; particles = []; score = 0; speed = 1; roadOffset = 0; spawnTimer = 0;
    updateHud();
  }
  function updateHud() {
    scoreEl.textContent = String(Math.floor(score)).padStart(6, "0");
    speedEl.textContent = Math.floor(90 + speed * 42);
    bestEl.textContent = String(best).padStart(6, "0");
  }
  function beep(freq=440, duration=.07) {
    if (!soundOn) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      osc.frequency.value = freq; osc.type = "sine"; gain.gain.value = .045;
      osc.connect(gain); gain.connect(audioCtx.destination); osc.start();
      gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + duration);
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }
  function roundedRect(x,y,w,h,r,color) {
    ctx.fillStyle=color; ctx.beginPath(); ctx.roundRect(x,y,w,h,r); ctx.fill();
  }
  function drawCar(x,y,w,h,color,isPlayer=false) {
    ctx.save(); ctx.translate(x,y);
    ctx.shadowColor=isPlayer?"#ff315c":"#000"; ctx.shadowBlur=isPlayer?18:8;
    roundedRect(-w/2,-h/2,w,h,11,color);
    ctx.shadowBlur=0;
    roundedRect(-w*.36,-h*.26,w*.72,h*.32,7,isPlayer?"#9ce8ff":"#a9c7db");
    roundedRect(-w*.34,h*.15,w*.68,h*.22,6,"#172437");
    roundedRect(-w*.43,-h*.38,w*.18,9,3,"#fff0b0");
    roundedRect(w*.25,-h*.38,w*.18,9,3,"#fff0b0");
    roundedRect(-w*.43,h*.34,w*.18,8,3,"#ff405f");
    roundedRect(w*.25,h*.34,w*.18,8,3,"#ff405f");
    ctx.fillStyle="#101722";
    ctx.fillRect(-w/2-3,-h*.28,5,18); ctx.fillRect(w/2-2,-h*.28,5,18);
    ctx.fillRect(-w/2-3,h*.18,5,18); ctx.fillRect(w/2-2,h*.18,5,18);
    if(isPlayer){ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.strokeRect(-w/2+2,-h/2+2,w-4,h-4);}
    ctx.restore();
  }
  function drawRoad(dt) {
    ctx.fillStyle="#14251f";ctx.fillRect(0,0,W,H);
    for(let i=0;i<16;i++){ctx.fillStyle=i%2?"#1c342a":"#20392e";ctx.fillRect((i*79+roadOffset*.3)%W,0,34,H);}
    ctx.fillStyle="#292f3b";ctx.fillRect(road.x,0,road.w,H);
    ctx.fillStyle="#f5d66b";ctx.fillRect(road.x-7,0,5,H);ctx.fillRect(road.x+road.w+2,0,5,H);
    ctx.fillStyle="#dbe2e9";
    for(let lane=1;lane<3;lane++){
      const x=road.x+lane*laneW-2;
      for(let y=-90+(roadOffset%130);y<H;y+=130)ctx.fillRect(x,y,4,66);
    }
    ctx.fillStyle="#ffffff12";
    for(let y=-50+(roadOffset%100);y<H;y+=100){ctx.fillRect(road.x+10,y,2,34);ctx.fillRect(road.x+road.w-12,y,2,34);}
  }
  function draw() {
    ctx.clearRect(0,0,W,H); drawRoad();
    traffic.forEach(c=>drawCar(c.x,c.y,c.w,c.h,c.color));
    drawCar(player.x,player.y,player.w,player.h,"#f2385a",true);
    particles.forEach(p=>{ctx.globalAlpha=p.life;ctx.fillStyle="#ffb35c";ctx.fillRect(p.x,p.y,4,4);ctx.globalAlpha=1;});
  }
  function spawnTraffic() {
    const lane=Math.floor(Math.random()*3);
    const colors=["#3285d8","#f2a33b","#8d6be8","#27b99a","#e6e9ef"];
    traffic.push({lane,x:road.x+laneW*(lane+.5),y:-100,w:46,h:82,color:colors[Math.floor(Math.random()*colors.length)],passed:false});
  }
  function hit(a,b) {
    return Math.abs(a.x-b.x)<(a.w+b.w)*.39 && Math.abs(a.y-b.y)<(a.h+b.h)*.39;
  }
  function endGame() {
    state="over"; beep(130,.25);
    if(score>best){best=Math.floor(score);localStorage.setItem("vamp4_best",best);}
    updateHud(); titleEl.textContent="RACE OVER"; textEl.textContent=`Your score: ${Math.floor(score)}. One more run to beat your best!`;
    startBtn.textContent="RACE AGAIN"; overlay.classList.remove("hidden");
  }
  function update(dt) {
    if(state!=="running")return;
    const step=dt/16.67;
    speed=Math.min(3.1,1+score/2200);
    roadOffset=(roadOffset+8*speed*step)%130;
    if(left){player.lane=Math.max(0,player.lane-0.10*step);left=false;}
    if(right){player.lane=Math.min(2,player.lane+0.10*step);right=false;}
    player.lane=Math.max(0,Math.min(2,player.lane));
    player.targetX=road.x+laneW*(player.lane+.5);
    player.x+=(player.targetX-player.x)*Math.min(1,.23*step);
    spawnTimer+=dt;
    if(spawnTimer>Math.max(470,1050-score*.18)){spawnTraffic();spawnTimer=0;}
    traffic.forEach(c=>{
      c.y+=(5.1+speed*2.5)*step;
      if(!c.passed&&c.y>player.y){c.passed=true;score+=25;}
      if(hit(player,c)){endGame();}
    });
    traffic=traffic.filter(c=>c.y<H+120);
    score+=.12*dt; updateHud();
  }
  function frame(t) {
    const dt=Math.min(40,t-lastTime||16.67);lastTime=t;
    update(dt);draw();requestAnimationFrame(frame);
  }
  function start() {reset();state="running";overlay.classList.add("hidden");pauseBtn.textContent="Ⅱ";beep(620);}
  function pause() {
    if(state==="running"){state="paused";titleEl.textContent="PAUSED";textEl.textContent="Take a breath. Your race is waiting.";startBtn.textContent="RESUME RACE";overlay.classList.remove("hidden");pauseBtn.textContent="▶";}
    else if(state==="paused"){state="running";overlay.classList.add("hidden");pauseBtn.textContent="Ⅱ";}
  }
  startBtn.addEventListener("click",()=>{if(state==="paused")pause();else start();});
  pauseBtn.addEventListener("click",pause);
  soundBtn.addEventListener("click",()=>{soundOn=!soundOn;soundBtn.textContent=soundOn?"🔊":"🔇";});
  function bindHold(id,dir){
    const el=document.getElementById(id);
    const down=e=>{e.preventDefault();if(state==="running"){if(dir<0)player.lane=Math.max(0,player.lane-1);else player.lane=Math.min(2,player.lane+1);player.targetX=road.x+laneW*(player.lane+.5);beep(340,.04);}};
    el.addEventListener("pointerdown",down);
  }
  bindHold("leftBtn",-1);bindHold("rightBtn",1);
  window.addEventListener("keydown",e=>{
    if(["ArrowLeft","a","A"].includes(e.key)){e.preventDefault();if(state==="running"){player.lane=Math.max(0,player.lane-1);player.targetX=road.x+laneW*(player.lane+.5);}}
    if(["ArrowRight","d","D"].includes(e.key)){e.preventDefault();if(state==="running"){player.lane=Math.min(2,player.lane+1);player.targetX=road.x+laneW*(player.lane+.5);}}
    if(e.key===" "){e.preventDefault();pause();}
  });
  document.addEventListener("visibilitychange",()=>{if(document.hidden&&state==="running")pause();});
  reset();state="ready";draw();requestAnimationFrame(frame);
})();