/* Higgsfield equipment adapter. Engine remains the only sizing authority. */
(()=>{
  const build=GL3D.buildWorld;
  GL3D.buildWorld=function(shadow){
    build.call(this,shadow);this.higgsfieldApplied=false;
    if(this.higgsfield)this.higgsfield.module.applyLibrary(this,this.higgsfield.library);
  };
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
        const [three,module]=await Promise.all([import('./vendor/three.module.min.js'),import('./higgsfield-models.js?v=0911.2')]);
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
      if(badge&&this.engine===GL3D){badge.textContent=ready?'Higgsfield 3D · 입력값 반영':'기본 3D · 모델 로딩 실패';badge.dataset.model=ready?'higgsfield':'fallback';}
    })();
    pending=task;task.finally(()=>{if(pending===task)pending=null;});return task;
  };
})();
