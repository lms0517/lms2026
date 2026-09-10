const fs=require('fs'),vm=require('vm'),assert=require('assert');
for(const theme of ['eng','eng2']){
 const html=fs.readFileSync(`apps/${theme}/index.html`,'utf8');
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(m[1].trim())new vm.Script(m[1]);
 new vm.Script(fs.readFileSync(`apps/${theme}/simulation.js`,'utf8'));
 const ctx=vm.createContext({console,window:{},document:{getElementById:()=>null}});
 vm.runInContext(html.slice(html.indexOf('const CONFIG ='),html.indexOf('const $ =')),ctx);
 vm.runInContext(html.slice(html.indexOf('const GL3D ='),html.indexOf('const SIM3D =')),ctx);
 let cases=0;
 for(const area of [120,500,2000])for(const height of [2.5,12,30])for(const temp of ['ambient','frozen']){
  ctx.input={temp,area,height,build:'new',inDay:250,outDay:200,stock:300,cells:1500,palletH:1.8,palletW:1200,palletL:1200};
  vm.runInContext('STATE.data=input;window.d_data=input;window.est_data=Engine.estimateCells(input);window.roi_data=Engine.roi(input,window.est_data);',ctx);
  const d=vm.runInContext('GL3D.buildData()',ctx);
  assert.equal(d.cellsShown,d.aisles*d.sBay*(d.sDF+d.sDB)*d.sTier);
  assert.equal(d.cellsShown,vm.runInContext('window.roi_data.targetCells',ctx));
  assert.equal(Math.round(d.cellsShown*d.occ),Math.min(300,d.cellsShown));
  cases++;
 }
 // Execute the actual occupancy loop with a minimal mesh/math adapter.
 const begin=html.indexOf('const cellsShown=aisles*sBay*(sDF+sDB)*sTier;');
 const end=html.indexOf('boxes.castShadow=shadow&&fi<=2500;',begin);
 const occupancy=html.slice(begin,end)+'return {fi,pallets,boxes,cards};';
 const run=new Function('T','D','sBay','sDF','sDB','sTier','aisles','cellW','cellD','cellH','blocks','m4','palG','palM','boxG','boxM','cardM',occupancy);
 class Mesh{constructor(g,m,n){this.capacity=n;this.count=n;}setMatrixAt(i){assert(i<this.capacity);}}
 for(const aisles of [1,2,8])for(const occ of [0,.01,.197,.85,1]){
   const blocks=Array.from({length:aisles*2},(_,i)=>({z0:i*7,deep:4}));
   const result=run({InstancedMesh:Mesh},{occ},19,4,4,5,aisles,1.4,1.4,2.05,blocks,{makeTranslation(){}},null,null,null,null,null);
   assert.equal(result.fi,Math.round(aisles*19*8*5*occ));assert.equal(result.fi,result.boxes.count+result.cards.count);
 }
 console.log(`${theme}: syntax, ${cases} sizing scenarios, 15 actual occupancy-loop scenarios passed`);
}
assert.equal(fs.readFileSync('apps/eng/simulation.js','utf8'),fs.readFileSync('apps/eng2/simulation.js','utf8'));
assert.equal(fs.readFileSync('apps/eng/simulation.css','utf8'),fs.readFileSync('apps/eng2/simulation.css','utf8'));
console.log('Theme parity passed');
