import * as T from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

// Extract reusable equipment, never the source scene's fixed warehouse layout.
// GLB is already Y-up. Bake child transforms relative to each semantic root.
export function extract(scene, name) {
  const root=scene.getObjectByName(name);
  if(!root)throw new Error('Missing model: '+name);
  root.updateWorldMatrix(true,true);
  const inverse=root.matrixWorld.clone().invert(), groups=new Map();
  root.traverse(n=>{
    if(!n.isMesh)return;
    if(Array.isArray(n.material))throw new Error('Unexpected multi-material mesh');
    const g=n.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,n.matrixWorld));
    const key=n.material.uuid;
    if(!groups.has(key))groups.set(key,{material:n.material,geometries:[]});
    groups.get(key).geometries.push(g.index?g.toNonIndexed():g);
    if(g.index)g.dispose();
  });
  const result=new T.Group();result.name=name;
  for(const {material,geometries} of groups.values()){
    const g=mergeGeometries(geometries);geometries.forEach(x=>x.dispose());
    if(!g)throw new Error('Incompatible geometry: '+name);
    result.add(new T.Mesh(g,material.clone()));
  }
  const box=new T.Box3().setFromObject(result);
  const center=box.getCenter(new T.Vector3());
  // Origin at ground contact; keep exact dimensions for input-based scaling.
  result.children.forEach(n=>n.geometry.translate(-center.x,-box.min.y,-center.z));
  result.userData.size=box.getSize(new T.Vector3());
  return result;
}

let cached;
export async function loadLibrary(){
  if(cached)return cached;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch(new URL('../assets/warehouse-higgsfield.glb',import.meta.url),{signal:controller.signal});
    if(!response.ok)throw new Error('Model HTTP '+response.status);
    const bytes=await response.arrayBuffer();
    const {scene}=await new GLTFLoader().parseAsync(bytes,'');
    try{
      const library={};
      for(const [key,name] of Object.entries({shuttle:'SHUTTLE_01_ANIMATED',pallet:'PALLET_TRACKED_001',forklift:'AGF_FORKLIFT',tower:'LIFTER_1',carriage:'LIFTER_1_CARRIAGE'}))library[key]=extract(scene,name);
      cached=library;return library;
    }finally{
      const disposed=new Set();scene.traverse(n=>{for(const o of [n.geometry,...[].concat(n.material||[])])if(o&&!disposed.has(o)){o.dispose();disposed.add(o);}});
    }
  }finally{clearTimeout(timer);}
}

export function applyLibrary(e,library){
  const D=e.D,ac=e.actors,owned={};
  // Per-world resources: resets and clipping must never mutate cached templates.
  function parts(key){
    if(!owned[key])owned[key]=library[key].children.map(n=>({geometry:e.geo(n.geometry.clone()),material:e.track(n.material.clone())}));
    return owned[key];
  }
  function model(key,size,bottom=0){
    const group=new T.Group(),natural=library[key].userData.size;
    group.name='Higgsfield / '+key;
    for(const p of parts(key)){const m=new T.Mesh(p.geometry,p.material);m.castShadow=true;m.receiveShadow=true;group.add(m);}
    group.scale.set(size.x/natural.x,size.y/natural.y,size.z/natural.z);
    group.position.y=bottom;return group;
  }
  const cargoSize=new T.Vector3(D.cellW*.82,.11+D.cellH*.62,D.cellD*.82);
  function replace(target,key,size,bottom=0){
    if(!target)return;
    target.clear();target.add(model(key,size,bottom));target.userData.higgsfield=key;
  }
  ac.shuttles.forEach(g=>replace(g,'shuttle',new T.Vector3(Math.min(1.2,D.cellW*.9),.46,Math.min(1.12,D.cellD*.9))));
  [ac.animPallet,...ac.convPallets,...(ac.shuttleLoad||[])].filter(Boolean).forEach(g=>replace(g,'pallet',cargoSize,-.055));
  // Keep the actor roots and their existing control coordinates intact.
  ac.lifters.forEach(({g,car})=>{
    g.children.slice().filter(n=>n!==car).forEach(n=>g.remove(n));
    const tower=model('tower',new T.Vector3(1.85,D.rackH+1.4,1.8));
    tower.position.x=car.position.x;g.add(tower);
    replace(car,'carriage',new T.Vector3(1.55,.16,1.7),-.08);
  });
  if(ac.unmanned)(ac.forklifts||[]).forEach(g=>{
    const noFrame=g.children.some(n=>n.userData.noFrame);
    replace(g,'forklift',new T.Vector3(1.4,2.65,2.8));
    // Source forks point +Z; the app vehicle's forward axis is -Z.
    g.children[0].rotation.y=Math.PI;
    if(noFrame)g.traverse(n=>{n.userData.noFrame=true;});
    delete g.userData.beacon;
  });
  if(e.scopeOn.agv)ac.agfs.forEach(a=>{replace(a.g,'forklift',new T.Vector3(1.4,2.65,2.8));a.g.children[0].rotation.y=Math.PI;});
  // One set of instances per material, regardless of inventory count.
  const old=e.storageMeshes,base=old[0],natural=library.pallet.userData.size;
  const scale=new T.Matrix4().makeScale(cargoSize.x/natural.x,cargoSize.y/natural.y,cargoSize.z/natural.z);
  const matrix=new T.Matrix4();const meshes=[];
  for(const p of parts('pallet')){
    const material=e.track(p.material.clone());
    if(material.name==='Inbound / mint')material.color.setHex(0xa9b4be);
    const mesh=new T.InstancedMesh(p.geometry,material,Math.max(1,base.count));
    mesh.name='Higgsfield / stored cargo';mesh.count=base.count;
    for(let i=0;i<base.count;i++){
      base.getMatrixAt(i,matrix);matrix.elements[13]-=.055;matrix.multiply(scale);mesh.setMatrixAt(i,matrix);
    }
    mesh.castShadow=base.count<=2500;mesh.receiveShadow=true;mesh.instanceMatrix.needsUpdate=true;
    mesh.computeBoundingSphere();e.world.add(mesh);e.track(mesh);meshes.push(mesh);
  }
  old.forEach(n=>e.world.remove(n));e.storageMeshes=meshes;
  e.higgsfieldApplied=true;
}
