import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as T from '../eng/vendor/three.module.min.js';
import { GLTFLoader } from '../eng/vendor/GLTFLoader.js';
import { extract,applyLibrary } from '../eng/higgsfield-models.js';

const b=fs.readFileSync(new URL('../assets/warehouse-higgsfield.glb',import.meta.url));
const {scene}=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
const library={};
for(const [key,name] of Object.entries({shuttle:'SHUTTLE_01_ANIMATED',pallet:'PALLET_TRACKED_001',forklift:'AGF_FORKLIFT',tower:'LIFTER_1',carriage:'LIFTER_1_CARRIAGE'}))library[key]=extract(scene,name);
for(const theme of ['eng','eng2']){
 const html=fs.readFileSync(new URL(`../${theme}/index.html`,import.meta.url),'utf8');
 const paint=new Proxy({measureText:()=>({width:100})},{get:(o,k)=>k in o?o[k]:()=>{}});
 const ctx=vm.createContext({console,window:{},document:{getElementById:()=>null,createElement:()=>({getContext:()=>paint})},T});
 vm.runInContext(html.slice(html.indexOf('const CONFIG ='),html.indexOf('const $ =')),ctx);
 vm.runInContext(html.slice(html.indexOf('const GL3D ='),html.indexOf('const SIM3D =')),ctx);
 vm.runInContext('const SIM3D={init(){},reset(){}};',ctx);
 vm.runInContext(fs.readFileSync(new URL(`../${theme}/higgsfield.js`,import.meta.url),'utf8'),ctx);
 for(const [area,height,stock] of [[120,2.5,3],[500,12,1000],[2000,30,6000]]){
  ctx.input={temp:'ambient',area,height,build:'new',inDay:250,outDay:200,stock,cells:1500,palletH:1.8,palletW:1200,palletL:1200};
  vm.runInContext('STATE.data=input;window.d_data=input;window.est_data=Engine.estimateCells(input);window.roi_data=Engine.roi(input,window.est_data);',ctx);
  const e=vm.runInContext('GL3D',ctx);e.THREE=T;e.D=e.buildData();e.scene=new T.Scene();e.disposables=[];
  // Canvas texture painting is irrelevant to mesh placement; run the actual world builder.
  e.tex=()=>new T.Texture();e.buildWorld(false);
  const original=e.storageMeshes[0],positions=[];
  for(let i=0;i<original.count;i++){const m=new T.Matrix4();original.getMatrixAt(i,m);positions.push(m.elements.slice(12,15));}
  const root=e.actors.animPallet,rootPose=root.position.clone();
  globalThis.document={createElement:()=>({getContext:()=>paint})};
  applyLibrary(e,library);
  assert(e.higgsfieldScene);
  assert(e.world.getObjectByName('Higgsfield / cobalt uprights'));
  assert.equal(e.world.getObjectByName('Higgsfield / cobalt uprights').count,e.D.aisles*(e.D.sBay+1)*(e.D.sDF+e.D.sDB+2));
  assert(e.bbox.min.y<0 && e.bbox.max.y>e.D.rackH);
  assert(e.higgsfieldApplied);assert.equal(e.actors.animPallet,root);assert(root.position.equals(rootPose));
  assert.equal(e.storageCount,Math.min(stock,e.D.cellsShown));
  for(const mesh of e.storageMeshes){
    assert.equal(mesh.count,original.count);
    assert(!mesh.boundingSphere||Number.isFinite(mesh.boundingSphere.radius));
    for(let i=0;i<mesh.count;i++){
      const m=new T.Matrix4();mesh.getMatrixAt(i,m);
      assert(Math.abs(m.elements[12]-positions[i][0])<1e-5);
      assert(Math.abs(m.elements[13]-(positions[i][1]-.055+.23))<1e-5);
      assert(Math.abs(m.elements[14]-positions[i][2])<1e-5);
    }
  }
  const box=new T.Box3().setFromObject(root.children[0]);
  assert(Math.abs(box.getSize(new T.Vector3()).x-e.D.cellW*.82)<1e-5);
  assert(Math.abs(box.min.y+.055)<1e-5);
  // Real animation transforms remain valid with imported equipment attached.
  for(const t of [0,6.2,10.4,11.6,15.6,17.2,19.99]){
    e.tick(t);e.world.updateMatrixWorld(true);
    if(e.actors.shuttles[0])assert(Math.abs(e.actors.shuttles[0].position.y-(e.anchors.liftTopY-.72+.2))<.009);
    e.world.traverse(n=>assert(n.matrixWorld.elements.every(Number.isFinite)));
  }
  // Disposing a world must leave the templates usable for the next calculation.
  const owned=e.storageMeshes[0].geometry;
  assert.notEqual(owned,library.pallet.children[0].geometry);
  for(const o of new Set(e.disposables))o.dispose?.();
 }
 for(const file of ['higgsfield.js','higgsfield-models.js','higgsfield-scene.js','higgsfield-reference.html','vendor/GLTFLoader.js','vendor/BufferGeometryUtils.js','vendor/SkeletonUtils.js'])assert.equal(fs.readFileSync(new URL('../eng/'+file,import.meta.url),'utf8'),fs.readFileSync(new URL('../eng2/'+file,import.meta.url),'utf8'));
 console.log(theme+': actual GLB, 3 input-driven worlds, inventory positions, 7 animation stages, resource ownership passed');
}
