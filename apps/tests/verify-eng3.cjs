// eng3 회귀 검사 — 2026-10 코드 리뷰에서 찾은 결함이 다시 생기지 않게 (실행: node apps/tests/verify-eng3.cjs)
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('apps/eng3/index.html','utf8');
const sw=fs.readFileSync('apps/eng3/sw.js','utf8');

// 문법
for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(m[1].trim())new vm.Script(m[1]);
new vm.Script(fs.readFileSync('apps/eng3/simulation.js','utf8'));
new vm.Script(sw);

// 계산 엔진만 떼어 실행
const ctx=vm.createContext({console,window:{},document:{getElementById:()=>null},fmt:n=>Number(n||0).toLocaleString('ko-KR')});
vm.runInContext(html.slice(html.indexOf('const CONFIG ='),html.indexOf('const $ =')),ctx);
const run=inp=>{ctx.input=Object.assign({temp:'ambient',build:'new',inDay:0,outDay:0,inRatio:50,cells:0,stock:0,storeDays:0,palletH:0,palletW:0,palletL:0},inp);
  return vm.runInContext('(()=>{const est=Engine.estimateCells(input);const roi=Engine.roi(input,est);return {est,roi,tp:Engine.throughput(input)};})()',ctx);};

// 1) 랙 높이는 유효 층고를 넘지 않는다 (적재높이를 낮게 넣어도)
for(const palletH of [0.5,0.9,1.3,1.8])for(const height of [6,10,12,20]){
  const {roi}=run({area:500,height,volume:6000,palletH});
  assert.ok(roi.layout.rackH<=height+1e-9,`랙 높이 ${roi.layout.rackH}m > 층고 ${height}m (적재 ${palletH}m)`);
}
// 2) 빈 입력·말이 안 되는 규모는 '산출 불가'
assert.ok(run({}).roi.infeasible,'빈 입력인데 산출됨');
assert.ok(run({area:1,height:12,volume:1000}).roi.infeasible,'1평인데 산출됨');
assert.ok(run({area:500,height:1,volume:1000}).roi.infeasible,'층고 1m 인데 산출됨');
assert.equal(run({area:800,height:10,volume:6000}).roi.infeasible,'','정상 입력이 산출 불가로 나옴');
// 3) 물동량 기반 보관 수요 = 월 물동량 × 입고 비율 × 보관일수/30 × 1.2
assert.equal(run({area:2000,height:12,volume:10000,inRatio:50,storeDays:15}).roi.demandFromVolume,3000);
assert.equal(run({area:2000,height:12,volume:10000,inRatio:20,storeDays:15}).roi.demandFromVolume,1200);
// 4) 입고 0%·100% 를 그대로 쓴다
{const {tp}=run({area:800,height:10,volume:6000,inRatio:100});assert.equal(tp.inRatio,100);assert.equal(tp.outHr,0);}
{const {tp}=run({area:800,height:10,volume:6000,inRatio:0});assert.equal(tp.inRatio,0);assert.equal(tp.inHr,0);}

// 4-b) 기본값 예시 = 권장 구축 3,000셀, 같은 단수 일반 랙 대비 보관 가능량 +40~67%(업계 범위) 안
{const {roi}=run({area:520,height:10,volume:10000,stock:1000,storeDays:15,palletW:1100,palletL:1100,palletH:1.5});
 assert.equal(roi.targetCells,3000);assert.equal(roi.conv.tiers,5);
 assert.ok(roi.conv.gain>=0.40&&roi.conv.gain<=0.67,`일반 랙 대비 ${Math.round(roi.conv.gain*100)}% — 업계 범위 밖`);
 assert.ok(roi.layout.rackW*(roi.layout.footD-6)<=520*3.305,'랙 블록이 면적보다 큼');}

// 5) 공개 페이지에 원본 견적 정보(현장명·계약금액·견적서 번호)를 넣지 않는다
for(const bad of ['대한냉동','영풍','LAE26','YP-1CAMPUS','PROD-2WAY','contract:','vendor:'])
  assert.ok(!html.includes(bad),`eng3 에 견적 원본 정보 '${bad}' 가 남아 있음`);

// 6) 서비스워커는 정상 응답만 저장한다
assert.ok(/resp\.ok/.test(sw),'서비스워커가 응답 성공 여부를 확인하지 않음');
// 7) PDF.js 취약점(CVE-2024-4367) 임시 차단 설정
assert.ok(/isEvalSupported:\s*false/.test(html),'PDF.js isEvalSupported:false 누락');
// 8) 새 미팅은 공유 링크 입력을 지우고 연다
assert.ok(/location\.replace\(location\.pathname\)/.test(html),'초기화가 주소 뒤 입력을 지우지 않음');

console.log('eng3 회귀 검사 통과');
