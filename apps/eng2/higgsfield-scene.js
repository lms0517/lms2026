import * as T from './vendor/three.module.min.js';

// Parametric reconstruction of warehouse_scene.py: the source's rack structure,
// raised plinth, steel rails, marked floor and presentation lighting.
export function composeWarehouse(e){
  const D=e.D,A=e.anchors,ac=e.actors,G=e.world;
  const cargo=e.storageMeshes;
  const dock=e.groups.gDock;
  const forklifts=ac.forklifts||[],agfs=ac.agfs||[];
  G.clear();
  e.groups.gAGF.clear();e.groups.gConv.clear();
  G.add(e.groups.gAGF,e.groups.gConv,dock);dock.visible=false;
  ac.shuttles.forEach(n=>G.add(n));ac.lifters.forEach(n=>G.add(n.g));
  [ac.animPallet,...ac.convPallets,...ac.shuttleLoad].filter(Boolean).forEach(n=>G.add(n));
  if(ac.crane)G.add(ac.crane.mast,ac.crane.car);
  forklifts.forEach(n=>(ac.unmanned?e.groups.gAGF:G).add(n));
  agfs.forEach(n=>e.groups.gAGF.add(n.g));
  cargo.forEach(n=>G.add(n));
  e.lodFar=[];ac.turntable=null;
  const mat=(color,metalness=.2,roughness=.45)=>e.mat({color,metalness,roughness});
  const blue=mat(0x2c70b5,.5,.31),orange=mat(0xf98a35,.4,.35),steel=mat(0xa1b8c6,.7,.3);
  const floorM=mat(0x526c7a,.08,.72),edge=mat(0x172e42,.25,.45),dark=mat(0x243746,.5,.35);
  const mint=mat(0x24dba5),yellow=mat(0xf7bd42),white=mat(0xd9ecf5);
  const unit=e.geo(new T.BoxGeometry(1,1,1));
  function batch(name,specs,material,parent=G){
    const mesh=new T.InstancedMesh(unit,material,Math.max(1,specs.length));mesh.name=name;mesh.count=specs.length;
    const m=new T.Matrix4(),q=new T.Quaternion();
    specs.forEach(([x,y,z,w,h,d],i)=>mesh.setMatrixAt(i,m.compose(new T.Vector3(x,y,z),q,new T.Vector3(w,h,d))));
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();parent.add(mesh);e.track(mesh);return mesh;
  }
  const fw=D.rackW+13,fd=D.totalD+14,cx=D.rackW/2-2.5,cz=D.totalD/2-3;
  batch('Higgsfield / concrete slab',[[cx,-.34,cz,fw,.68,fd]],floorM);
  batch('Higgsfield / foundation plinth',[[cx,-.8,cz,fw+.4,.22,fd+.4]],edge);
  const grid=[];
  for(let x=-8;x<D.rackW+4;x+=2)grid.push([x,.008,cz,.014,.01,fd-.6]);
  for(let z=-9.5;z<D.totalD+3.7;z+=2)grid.push([cx,.008,z,fw-.6,.01,.014]);
  const gridMesh=batch('Higgsfield / two metre grid',grid,steel);gridMesh.castShadow=false;
  const posts=[],beams=[],rails=[];
  const mod=(D.sDF+D.sDB)*D.cellD+D.aisleW+D.moduleGap;
  for(let a=0;a<D.aisles;a++){
    for(const [z0,deep] of [[a*mod,D.sDF],[a*mod+D.sDF*D.cellD+D.aisleW,D.sDB]]){
      for(let i=0;i<=D.sBay;i++)for(let j=0;j<=deep;j++)posts.push([i*D.cellW,D.rackH/2,z0+j*D.cellD,.10,D.rackH,.10]);
      for(let t=0;t<D.sTier;t++){
        const y=t*D.cellH;
        for(let j=0;j<=deep;j++)beams.push([D.rackW/2,y+.10,z0+j*D.cellD,D.rackW,.17,.095]);
        for(let i=0;i<D.sBay;i++)for(const off of [.17,.83])rails.push([(i+off)*D.cellW,y+.2,z0+deep*D.cellD/2,.055,.06,deep*D.cellD]);
      }
    }
    for(let t=0;t<D.sTier;t++)for(const off of [-.49,.49])rails.push([D.rackW/2,t*D.cellH+.14,a*mod+D.sDF*D.cellD+D.aisleW/2+off,D.rackW,.14,.09]);
  }
  batch('Higgsfield / cobalt uprights',posts,blue);
  batch('Higgsfield / orange load beams',beams,orange);
  batch('Higgsfield / steel deep lane rails',rails,steel);
  // Raise stored pallets onto the rails, while retaining all input-derived X/Z slots.
  const m=new T.Matrix4();
  cargo.forEach(mesh=>{for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);m.elements[13]+=.23;mesh.setMatrixAt(i,m);}mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();});
  function conveyor(group,x,z0,z1){
    group.clear();group.position.set(x,0,0);group.rotation.set(0,0,0);const length=z1-z0,mid=(z0+z1)/2;
    batch('Higgsfield / conveyor frame',[[0,.48,mid,1.48,.22,length],[-.7,.64,mid,.10,.21,length],[.7,.64,mid,.10,.21,length]],dark,group);
    const supports=[];for(let z=z0+.3;z<=z1-.25;z+=2.2)for(const x of [-.55,.55])supports.push([x,.25,z,.12,.5,.12]);
    batch('Higgsfield / conveyor supports',supports,steel,group);
    const g=e.geo(new T.CylinderGeometry(.07,.07,1.28,12));
    const rolls=new T.InstancedMesh(g,steel,Math.max(1,Math.floor(length/.23)));
    for(let i=0;i<rolls.count;i++){m.makeRotationZ(Math.PI/2);m.setPosition(0,.60,z0+.15+i*.23);rolls.setMatrixAt(i,m);}
    group.add(rolls);e.track(rolls);return group;
  }
  G.add(conveyor(ac.conv.group,A.convStart.x,A.convStart.z-2.8,A.convEnd.z));
  if(ac.convOut)e.groups.gConv.add(conveyor(ac.convOut.group,D.rackW+2,-5,Math.min(D.totalD,6)));
  const markings=[];
  for(let z=-5;z<D.totalD+2;z+=2)markings.push([-6,.027,z,.10,.018,1.1]);
  for(let x=0;x<D.rackW+3;x+=2)markings.push([x,.027,-5.4,1.1,.018,.10]);
  batch('Higgsfield / pedestrian markings',markings,yellow);
  batch('Higgsfield / inbound zone',[[-2,-.001,-7.8,5.5,.045,2.1]],mint);
  batch('Higgsfield / outbound zone',[[D.rackW+1,-.001,-6.5,5.5,.045,2.1]],mat(0x278fbd));
  // Flat floor lettering keeps the overview uncluttered, as in the source scene.
  function floorText(text,x,z,width,height,color='#e1f0f7'){
    const c=document.createElement('canvas');c.width=2048;c.height=128;
    const context=c.getContext('2d');context.font='600 72px sans-serif';context.fillStyle=color;context.textAlign='center';context.textBaseline='middle';context.fillText(text,1024,64,2000);
    const texture=e.track(new T.CanvasTexture(c));texture.colorSpace=T.SRGBColorSpace;
    const material=e.track(new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));
    const mesh=new T.Mesh(e.geo(new T.PlaneGeometry(width,height)),material);mesh.rotation.set(-Math.PI/2,0,Math.PI);mesh.position.set(x,.055,z);G.add(mesh);
  }
  floorText('AUTOMATED STORAGE  /  '+D.cellsShown.toLocaleString('en-US')+' CELLS',D.rackW/2,-2.2,Math.min(24,D.rackW+2),1.05);
  floorText(D.sBay+' BAYS  ×  '+(D.sDF+D.sDB)+' DEEP  ×  '+D.sTier+' TIERS  ×  '+D.aisles+' AISLES',D.rackW/2,-3.45,Math.min(21,D.rackW+2),.8);
  floorText('01  INBOUND',-2,-7.8,4.8,.7,'#123344');floorText('04  OUTBOUND',D.rackW+1,-6.5,4.8,.7);
  // Inspection portal and terminal use the same source scene vocabulary.
  batch('Higgsfield / inspection portal',[[A.convStart.x-.83,1.55,A.convStart.z+.8,.12,3.1,.14],[A.convStart.x+.83,1.55,A.convStart.z+.8,.12,3.1,.14],[A.convStart.x,3.05,A.convStart.z+.8,1.8,.14,.18]],yellow);
  batch('Higgsfield / WCS terminal',[[-4.2,.65,A.convEnd.z-2,.2,1.3,.24],[-4.2,1.5,A.convEnd.z-2,.75,.5,.2]],dark);
  batch('Higgsfield / WCS screen',[[-4.2,1.5,A.convEnd.z-2.11,.63,.36,.02]],mint);
  // Original optional dock remains available through its scope focus.
  const dockGround=batch('Dock platform',[[-16,-.36,D.totalD*.5,15,.65,D.totalD+8]],floorM,dock);dockGround.userData.noFrame=true;
  e.scene.background=new T.Color(0x0c1b2a);e.scene.fog=new T.Fog(0x0c1b2a,1000,2000);
  e.scene.children.filter(n=>n.isLight).forEach(n=>e.scene.remove(n));
  e._hemi=new T.HemisphereLight(0xe3f3ff,0x506579,2.1);e.scene.add(e._hemi);
  const sun=new T.DirectionalLight(0xfff1de,3.2);sun.position.set(-20,40,-25);sun.target.position.set(cx,0,cz);
  sun.castShadow=e.storageCount<=3500;sun.shadow.mapSize.set(2048,2048);
  const span=Math.max(fw,fd)*.65;Object.assign(sun.shadow.camera,{left:-span,right:span,top:span,bottom:-span,near:.5,far:200});sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.0004;sun.shadow.normalBias=.04;
  e.scene.add(sun,sun.target);const fill=new T.DirectionalLight(0xa4d4ff,1.6);fill.position.set(35,20,25);e.scene.add(fill);
  if(e.renderer){e.renderer.toneMappingExposure=.85;e.renderer.shadowMap.enabled=sun.castShadow;e.renderer.shadowMap.type=T.PCFShadowMap;}
  if(e.camera){e.camera.fov=30;e.camera.updateProjectionMatrix();}
  e.bbox=new T.Box3(new T.Vector3(cx-fw/2-.3,-1,cz-fd/2-.3),new T.Vector3(cx+fw/2+.3,D.rackH+1.5,cz+fd/2+.3));
  e.center.set(cx,D.rackH*.17,cz);e.homeCenter.copy(e.center);
  e.higgsfieldScene=true;
}
