/* Higgsfield equipment adapter. Engine remains the only sizing authority. */
(()=>{
  const build=GL3D.buildWorld;
  GL3D.buildWorld=function(shadow){
    this.higgsfieldScene=false;build.call(this,shadow);this.higgsfieldApplied=false;
    if(this.higgsfield)this.higgsfield.module.applyLibrary(this,this.higgsfield.library);
  };
  const fit=GL3D.fitView,cam=GL3D.applyCam,tick=GL3D.tick,focus=GL3D.focusScope;
  GL3D.fitView=function(){
    if(!this.higgsfieldScene)return fit.call(this);
    this.center.copy(this.homeCenter);this.sph.theta=-2.43;this.sph.phi=1.06;
    this.sph.r=this.fitRadius(this.bbox,this.sph.theta,this.sph.phi,this.camera.aspect);
    this.vel.t=this.vel.p=0;this.render();
  };
  GL3D.applyCam=function(){cam.call(this);if(this.higgsfieldScene&&this.scene?.fog){this.scene.fog.near=this.camera.far*.85;this.scene.fog.far=this.camera.far;}};
  GL3D.tick=function(t){tick.call(this,t);if(this.higgsfieldScene){this.actors.shuttles.forEach((s,i)=>{s.position.y+=.2;const load=this.actors.shuttleLoad[i];if(load)load.position.y=s.position.y+.515;});}};
  GL3D.focusScope=function(k){if(this.higgsfieldScene&&this.groups?.gDock)this.groups.gDock.visible=k==='dock'&&this._scopeFocus!=='dock';focus.call(this,k);};
  const preset=GL3D.preset;
  GL3D.preset=function(k){
    preset.call(this,k);
    if(k==='lift'&&this.higgsfieldApplied){
      const T=this.THREE,A=this.anchors;
      const box=new T.Box3(new T.Vector3(-3.2,0,A.convStart.z-1),new T.Vector3(2,this.D.rackH+1.6,A.convEnd.z+1.5));
      box.getCenter(this.center);this.sph.r=this.fitRadius(box,this.sph.theta,this.sph.phi,this.camera.aspect);this.render();
    }
  };
  const init=SIM3D.init,reset=SIM3D.reset;
  let generation=0,pending=null;
  SIM3D.reset=function(){generation++;pending=null;reset.call(this);};
  SIM3D.init=function(){
    if(this.inited)return Promise.resolve();
    if(pending)return pending;
    const current=generation;
    const task=(async()=>{
      const badge=document.getElementById('simRenderer');
      if(badge)badge.textContent='Higgsfield 모델 준비 중';
      GL3D.higgsfield=null;
      try{
        const [three,module]=await Promise.all([import('./vendor/three.module.min.js'),import('./higgsfield-models.js?v=0911.4')]);
        const library=await module.loadLibrary();
        if(current!==generation)return;
        this.threeMod=three;GL3D.higgsfield={module,library};
      }catch(error){
        if(current!==generation)return;
        console.warn('Higgsfield 모델을 불러오지 못해 기본 모델을 사용합니다.',error);
      }
      if(current!==generation)return;
      await init.call(this);
      if(current!==generation)return;
      const ready=this.engine===GL3D&&GL3D.higgsfieldApplied;
      if(badge&&this.engine===GL3D){badge.textContent=ready?'Higgsfield 장면 · 입력값 반영':'기본 3D · 모델 로딩 실패';badge.dataset.model=ready?'higgsfield':'fallback';}
      if(ready){
        const heading=document.querySelector('.sim-heading strong');if(heading)heading.textContent='Higgsfield 자동창고 3D';
        const small=document.querySelector('.sim-heading small');if(small)small.innerHTML='예시의 랙·바닥·설비 표현을 입력 규모로 재구성했습니다. <a href="./higgsfield-reference.html" target="_blank" rel="noopener">힉스필드 원본 예시 보기 ↗</a>';
        if(document.getElementById('simDimensions')?.getAttribute('aria-pressed')==='true')SIMDETAIL.toggle('dimensions');
        const note=document.getElementById('simNote');if(note)note.innerHTML=note.innerHTML.replace(' · 서 있는 작업자(키 1.7m)가 크기 기준입니다.',' · 랙과 화물은 입력 규격에 맞춘 크기입니다.');
        GL3D.render();
      }
    })();
    pending=task;task.finally(()=>{if(pending===task)pending=null;});return task;
  };
})();
