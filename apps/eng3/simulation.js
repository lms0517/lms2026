/* 3D presentation layer. Sizing and financial estimates remain in Engine.
   Routes are explanatory sequences, not a queue/throughput simulation. */
(() => {
  'use strict';
  const byId=id=>document.getElementById(id);
  const state={direction:'in',routes:true,dimensions:true,level:0,view:'iso'};
  const inbound=[['입고 이송','입고 컨베이어에서 파렛트를 리프트로 이송합니다.',0],['리프트 상승','목표 보관층까지 수직으로 이동합니다.',6.2],['통로 이동','선택한 보관 위치까지 반송 설비가 이동합니다.',11.6],['보관 적입','통로에서 보관 셀 안쪽으로 화물을 이재합니다.',15.6],['설비 복귀','적입을 마친 설비가 다음 작업을 준비합니다.',17.2]];
  const outbound=[['셀 인출','보관 셀에서 파렛트를 통로로 인출합니다.',0],['통로 복귀','입출고 스테이션 방향으로 화물을 반송합니다.',2],['리프트 이재','수직 반송 설비에 화물을 인계합니다.',7],['리프트 하강','출고를 위해 입출고층까지 내려옵니다.',9],['출고 이송','공용 입출고 라인을 통해 화물을 반출합니다.',14]];
  const steps=()=>{const s=(state.direction==='in'?inbound:outbound).map(x=>x.slice());if(GL3D.D&&GL3D.D.sTier===1){const i=state.direction==='in'?1:3;s[i]=['스테이션 대기','1단 배치이므로 수직 이동 없이 같은 높이에서 이재를 준비합니다.',s[i][2]];}return s;};
  const baseResult=renderResult;
  renderResult=function(){
    baseResult();
    Object.assign(state,{direction:'in',routes:true,dimensions:true,level:0,view:'iso'});
    const panel=byId('simPanel'), inner=panel.querySelector('.roi-panel-inner');
    const L=window.roi_data.layout,d=window.d_data||STATE.data,tp=Engine.throughput(d);
    const occupied=d.stock>0?Math.min(L.cellsBuilt,Math.round(d.stock)):Math.round(L.cellsBuilt*.85);
    inner.insertAdjacentHTML('afterbegin',`<div class="sim-heading"><div><strong>입력한 창고를 3D로 확인하세요</strong><small>공간 규모를 살펴보고, 화물 한 개의 이동 과정을 따라가 보세요.</small></div><span class="sim-badge" id="simRenderer">3D 준비 중</span></div>
      <div class="sim-kpis">
      <div class="sim-kpi"><span>구축 규모 · 계산 결과 연동</span><b>${fmt(L.cellsBuilt)} 셀</b><small>${L.aisles}통로 · ${L.bay}Bay · ${L.tier}단</small></div>
      <div class="sim-kpi"><span>랙 외곽 치수</span><b>${L.rackW.toFixed(1)} × ${(L.footD-6).toFixed(1)} m</b><small>랙 높이 ${L.rackH.toFixed(1)}m · 입력 층고 ${d.height}m</small></div>
      <div class="sim-kpi"><span>보관 화물 · ${d.stock>0?'입력 재고 반영':'미입력: 85% 예시'}</span><b>${fmt(occupied)} 매</b><small>${(occupied/L.cellsBuilt*100).toFixed(1)}% 점유${d.stock>L.cellsBuilt?' · 공간 초과 '+fmt(d.stock-L.cellsBuilt)+'매':''}</small></div>
      <div class="sim-kpi"><span>시간당 필요 처리량 · 입력 기준</span><b>${fmt(tp.perHr)} PLT/h</b><small>입 ${tp.inHr} · 출 ${tp.outHr}${tp.split?'':' (50:50 가정)'} · ${tp.opHours}시간 운영</small></div></div>`);
    const wrap=inner.querySelector('.sim-wrap');
    wrap.insertAdjacentHTML('beforeend','<div class="sim-live" id="simLive"><b>배치 준비 중</b><span>입력한 규모로 장면을 생성합니다.</span></div>');
    const controls=document.createElement('div');controls.className='sim-controls';
    wrap.after(controls);
    controls.innerHTML=`<div class="sim-tools" aria-label="3D 시점"><button data-view="iso" aria-pressed="true">조감도</button><button data-view="top" aria-pressed="false">평면 보기</button><button data-view="aisle" aria-pressed="false">통로 내부</button><button data-view="lift" aria-pressed="false">입출고 설비</button><label>단면 <select id="simLevel" aria-label="표시할 보관층"><option value="0">전체 ${L.tier}단</option>${Array.from({length:L.tier},(_,i)=>`<option value="${i+1}">${i+1}단까지</option>`).join('')}</select></label></div>
      <div class="sim-tools"><button id="simRoutes" aria-pressed="true">이동 경로</button><button id="simDimensions" aria-pressed="true">치수 표시</button><button id="simDirectionIn" aria-pressed="true">입고 시연</button><button id="simDirectionOut" aria-pressed="false">출고 시연</button></div>
      <div class="sim-sequence"><div class="sim-seq-head"><strong id="simSequenceTitle">화물 이동 과정 · 입고</strong><span>20초 반복 시연 · 실제 처리 시간과 무관</span></div><div class="sim-stages" id="simStages"></div><div class="sim-scrub"><input id="simTimeline" type="range" min="0" max="19.99" step="0.01" value="0" aria-label="공정 시연 위치"><output id="simTime">0.0 / 20s</output></div><p class="sim-explain" id="simExplain"></p></div>`;
    const bar=inner.querySelector('.sim-bar');controls.appendChild(bar);
    bar.insertAdjacentHTML('beforeend','<button class="sim-btn" id="simSpeed" onclick="SIM3D.cycleSpeed()">속도 1×</button>');
    controls.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>SIMDETAIL.view(b.dataset.view));
    byId('simLevel').onchange=e=>SIMDETAIL.cut(+e.target.value);
    byId('simRoutes').onclick=()=>SIMDETAIL.toggle('routes');
    byId('simDimensions').onclick=()=>SIMDETAIL.toggle('dimensions');
    byId('simDirectionIn').onclick=()=>SIMDETAIL.direction('in');
    byId('simDirectionOut').onclick=()=>SIMDETAIL.direction('out');
    byId('simTimeline').oninput=e=>SIMDETAIL.seek(+e.target.value);
    SIMDETAIL.stageButtons();
    panel.classList.add('show');byId('simToggle').setAttribute('aria-expanded','true');
    requestAnimationFrame(()=>SIM3D.init());
  };
  const baseInit=GL3D.init;
  GL3D.init=function(){
    this.animT=0;this.speed=1;
    baseInit.call(this);
    this.renderer.localClippingEnabled=true;
    SIMDETAIL.build(this);SIMDETAIL.stageButtons();this.tick(0);this.render();
    if(this._detailResize)this._detailResize.disconnect();
    this._detailResize=new ResizeObserver(()=>{if(!this.renderer||!this.canvas)return;const w=this.canvas.clientWidth,h=this.canvas.clientHeight;if(w&&h&&(this._detailW!==w||this._detailH!==h)){this._detailW=w;this._detailH=h;this.resize(w,h);}});
    this._detailResize.observe(this.canvas);
  };
  const originalTick=GL3D.tick;
  GL3D.tick=function(t){
    let sceneTime=t;
    if(state.direction==='out'){
      // Reverse the existing connected route, with visible transfer dwell times.
      const keys=[[0,17.19],[2,15.6],[7,11.6],[9,10.4],[14,6.2],[15.2,5],[19.99,0]];
      let i=0;while(i<keys.length-2&&t>keys[i+1][0])i++;
      const a=keys[i],b=keys[i+1];sceneTime=a[1]+(b[1]-a[1])*Math.max(0,Math.min(1,(t-a[0])/(b[0]-a[0])));
    }
    originalTick.call(this,sceneTime);
    // Keep the main shuttle under its load through the deep-lane transfer.
    const sh=this.actors.shuttles[0],ap=this.actors.animPallet;
    if(sceneTime>=this.PH.liftEnd&&sceneTime<this.PH.handoff){const k=this.sCurve((sceneTime-this.PH.liftEnd)/(this.PH.handoff-this.PH.liftEnd));ap.position.x=this.anchors.convEnd.x+(this.anchors.railFromX-this.anchors.convEnd.x)*k;}
    if(sh&&sceneTime<this.PH.liftEnd){sh.position.y=this.anchors.liftTopY-.72;sh.position.z=this.anchors.railZ;}
    if(sh&&sceneTime>=this.PH.railEnd&&sceneTime<this.PH.depositEnd){sh.position.z=ap.position.z;sh.position.y=ap.position.y-.72;}
    else if(sh&&sceneTime>=this.PH.depositEnd){sh.position.z=this.anchors.dropZ+(this.anchors.railZ-this.anchors.dropZ)*this.sCurve((sceneTime-this.PH.depositEnd)/(this.LOOP-this.PH.depositEnd));}
    if(state.direction==='out')this.actors.convPallets.forEach(p=>p.visible=false);
    if(this.detailMarker){this.detailMarker.position.copy(ap.position);this.detailMarker.visible=ap.visible&&!this.concept;this.detailMarker.rotation.y=t*.8;}
    SIMDETAIL.update(t);
  };
  // Pause retains positions and simulation time, so scrubbing and resume are consistent.
  GL3D.stop=function(){this.playing=false;if(this.raf){cancelAnimationFrame(this.raf);this.raf=0;}const b=byId('simPlay');if(b){b.classList.remove('on');b.textContent='▶ 데모 재생';}if(this.renderer)this.render();};
  const baseReset=GL3D.reset;
  GL3D.reset=function(){if(this._detailResize)this._detailResize.disconnect();this._detailResize=null;this._detailW=this._detailH=null;baseReset.call(this);this.detailRoutes=this.detailDimensions=this.detailMarker=this.storageMeshes=this.detailArrows=null;};
  const initSim=SIM3D.init;
  SIM3D.init=async function(){await initSim.call(this);const badge=byId('simRenderer');if(!this.engine)return;if(badge)badge.textContent=this.engine===GL3D?'3D · 입력값 반영':'2D · 호환 모드';if(this.engine!==GL3D){document.querySelectorAll('.sim-controls button,.sim-controls select,.sim-controls input').forEach(b=>{if(!['simPlay','simFsBtn'].includes(b.id))b.disabled=true;});byId('simLive').innerHTML='<b>2D 호환 모드</b><span>이 환경에서 WebGL을 사용할 수 없습니다.</span>';byId('simExplain').textContent='공정별 제어와 단면 보기는 WebGL 지원 브라우저에서 사용할 수 있습니다.';}};
  // Move the canvas together with captions and controls when entering fullscreen.
  const enterFull=SIM3D.enterFull,exitFull=SIM3D.exitFull;
  SIM3D.enterFull=function(){if(this.full||!this.engine)return;const wrap=byId('simCanvas').parentNode,controls=document.querySelector('#simPanel .sim-controls');enterFull.call(this);if(!this.full)return;this._detailHome={wrap,parent:wrap.parentNode,next:wrap.nextSibling,controls,cp:controls.parentNode,cn:controls.nextSibling};wrap.appendChild(byId('simCanvas'));wrap.insertBefore(byId('simCanvas'),wrap.firstChild);byId('simFS').querySelector('.fs-cv').appendChild(wrap);controls.appendChild(byId('simFS').querySelector('.sim-bar'));byId('simFS').appendChild(controls);};
  SIM3D.exitFull=function(skip){if(!this.full)return;const h=this._detailHome;if(h){h.cp.insertBefore(h.controls,h.cn&&h.cn.parentNode===h.cp?h.cn:null);h.parent.insertBefore(h.wrap,h.next&&h.next.parentNode===h.parent?h.next:null);const bar=h.controls.querySelector('.sim-bar');if(bar)byId('simFS').appendChild(bar);this._detailHome=null;}exitFull.call(this,skip);};
  const baseConcept=SIM3D.toggleConcept,baseCinema=SIM3D.toggleCinema;
  SIM3D.toggleConcept=function(){if(GL3D.concept){baseConcept.call(this);SIMDETAIL.normal();GL3D.tick(0);return;}SIMDETAIL.normal();baseConcept.call(this);byId('simLive').style.display='none';};
  SIM3D.toggleCinema=function(){SIMDETAIL.direction('in');baseCinema.call(this);};
  window.SIMDETAIL={
    normal(){if(GL3D.concept){GL3D.setConcept(false);const b=byId('simConcept');b.classList.remove('on');b.textContent='📐 개념 설명';}SIM3D.cinemaOff();if(byId('simLive'))byId('simLive').style.display='';},
    stageButtons(){byId('simStages').innerHTML=steps().map((s,i)=>`<button class="sim-stage" data-stage="${i}" aria-current="${i===0?'step':'false'}"><b>0${i+1}</b>${s[0]}</button>`).join('');byId('simStages').querySelectorAll('button').forEach(b=>b.onclick=()=>this.seek(steps()[+b.dataset.stage][2]));},
    seek(t){if(SIM3D.engine!==GL3D)return;this.normal();GL3D.stop();GL3D.animT=t;GL3D.tick(t);GL3D.render();},
    direction(k){if(SIM3D.engine!==GL3D)return;this.normal();state.direction=k;(GL3D.detailArrows||[]).forEach(a=>a.arrow.setDirection(a.direction.clone().multiplyScalar(k==='in'?1:-1)));byId('simDirectionIn').setAttribute('aria-pressed',k==='in');byId('simDirectionOut').setAttribute('aria-pressed',k==='out');byId('simSequenceTitle').textContent='화물 이동 과정 · '+(k==='in'?'입고':'출고 · 공용 스테이션');this.stageButtons();this.seek(0);},
    view(k){if(SIM3D.engine!==GL3D)return;this.normal();state.view=k;document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===k));if(k==='top'){GL3D.center.copy(GL3D.homeCenter);GL3D.sph.theta=0;GL3D.sph.phi=.03;GL3D.sph.r=GL3D.fitRadius(GL3D.bbox,0,.03,GL3D.camera.aspect);GL3D.vel.t=GL3D.vel.p=0;GL3D.render();}else SIM3D.preset(k);},
    cut(level){if(SIM3D.engine!==GL3D)return;this.normal();state.level=level;const e=GL3D,T=e.THREE,p=new T.Plane(new T.Vector3(0,-1,0),level*e.D.cellH+.05);e.world.traverse(n=>{if(n.material){for(const m of [].concat(n.material)){m.clippingPlanes=level?[p]:[];m.clipShadows=true;m.needsUpdate=true;}}});this.update(e.animT);e.render();},
    toggle(key){if(SIM3D.engine!==GL3D)return;state[key]=!state[key];const g=key==='routes'?GL3D.detailRoutes:GL3D.detailDimensions;if(g)g.visible=state[key];byId(key==='routes'?'simRoutes':'simDimensions').setAttribute('aria-pressed',state[key]);GL3D.render();},
    update(t){if(!byId('simTime')||!GL3D.D)return;const s=steps();let index=0;s.forEach((x,i)=>{if(t>=x[2])index=i;});byId('simTime').textContent=t.toFixed(1)+' / 20s';byId('simTimeline').value=t;byId('simStages').querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-current',i===index?'step':'false'));const cut=state.level?' · '+state.level+'단 위 숨김':'';byId('simExplain').textContent=s[index][1]+cut;const live=byId('simLive');const text=`<b>${state.direction==='in'?'입고':'출고'} · ${s[index][0]}</b><span>${fmt(GL3D.D.cellsShown)}셀 · ${GL3D.D.sTier}단${cut} · 설명용 동작</span>`;if(live.innerHTML!==text)live.innerHTML=text;},
    build(e){
      const T=e.THREE,D=e.D,A=e.anchors;
      const routes=e.detailRoutes=new T.Group(),dims=e.detailDimensions=new T.Group();e.world.add(routes,dims);
      const vec=a=>new T.Vector3(...a);
      const line=(points,color,parent)=>{const g=e.geo(new T.BufferGeometry().setFromPoints(points.map(vec)));const m=e.track(new T.LineBasicMaterial({color,transparent:true,opacity:.9,depthTest:false}));const l=new T.Line(g,m);l.renderOrder=20;parent.add(l);};
      const pts=[[A.convStart.x,A.convStart.y,A.convStart.z],[A.convEnd.x,A.convEnd.y,A.convEnd.z],[A.convEnd.x,A.liftTopY,A.convEnd.z],[A.railFromX,A.liftTopY,A.railZ],[A.railToX,A.liftTopY,A.railZ],[A.railToX,A.liftTopY,A.dropZ]];
      // Tubes retain a visible width when the entire warehouse is framed.
      e.detailArrows=[];
      for(let i=0;i<pts.length-1;i++){
        const a=vec(pts[i]),b=vec(pts[i+1]),v=b.clone().sub(a),length=v.length();if(length<.01)continue;
        const tube=new T.Mesh(e.geo(new T.TubeGeometry(new T.LineCurve3(a,b),1,.075,6,false)),e.track(new T.MeshBasicMaterial({color:0x20eab0,depthTest:false,transparent:true,opacity:.85})));tube.renderOrder=20;routes.add(tube);
        const arrow=new T.ArrowHelper(v.normalize(),a.clone().lerp(b,.55),Math.min(1.5,length*.4),0x9dffe1,.55,.4);arrow.line.material.depthTest=arrow.cone.material.depthTest=false;arrow.line.renderOrder=arrow.cone.renderOrder=21;e.track(arrow.line.material);e.track(arrow.cone.material);routes.add(arrow);e.detailArrows.push({arrow,direction:v.clone()});
      }
      pts.forEach(p=>{const dot=new T.Mesh(e.geo(new T.SphereGeometry(.16,12,8)),e.track(new T.MeshBasicMaterial({color:0x6fffd7,depthTest:false})));dot.position.copy(vec(p));dot.renderOrder=21;routes.add(dot);});
      const ring=new T.Mesh(e.geo(new T.TorusGeometry(Math.max(D.cellW,D.cellD)*.65,.055,6,36)),e.track(new T.MeshBasicMaterial({color:0x64ffd1,depthTest:false})));ring.rotation.x=Math.PI/2;ring.renderOrder=22;
      e.detailMarker=new T.Group();e.detailMarker.add(ring);e.world.add(e.detailMarker);
      const label=(text,position)=>{const c=document.createElement('canvas');c.width=512;c.height=96;const x=c.getContext('2d');x.fillStyle='#12283eee';x.fillRect(0,0,512,96);x.strokeStyle='#6b92b7';x.lineWidth=3;x.strokeRect(2,2,508,92);x.font='600 36px sans-serif';x.fillStyle='#e4f1ff';x.textAlign='center';x.textBaseline='middle';x.fillText(text,256,48);const tex=e.track(new T.CanvasTexture(c));const m=e.track(new T.SpriteMaterial({map:tex,depthTest:false,transparent:true}));const sp=new T.Sprite(m);sp.position.copy(vec(position));const scale=Math.max(3.8,Math.max(D.rackW,D.totalD)*.14);sp.scale.set(scale,scale*96/512,1);sp.renderOrder=24;dims.add(sp);};
      const tick=(p,axis)=>{const a=p.slice(),b=p.slice();a[axis]-=.35;b[axis]+=.35;line([a,b],0x9bc9ff,dims);};
      line([[0,.18,-2],[D.rackW,.18,-2]],0x9bc9ff,dims);tick([0,.18,-2],2);tick([D.rackW,.18,-2],2);label('W '+D.rackW.toFixed(1)+' m',[D.rackW/2,.8,-2.5]);
      line([[D.rackW+2,.18,0],[D.rackW+2,.18,D.totalD]],0x9bc9ff,dims);tick([D.rackW+2,.18,0],0);tick([D.rackW+2,.18,D.totalD],0);label('D '+D.totalD.toFixed(1)+' m',[D.rackW+3,1,D.totalD/2]);
      line([[-.8,0,0],[-.8,D.rackH,0]],0x9bc9ff,dims);tick([-.8,0,0],0);tick([-.8,D.rackH,0],0);label('H '+D.rackH.toFixed(1)+' m',[-1.8,D.rackH*.6,0]);
    }
  };
})();
