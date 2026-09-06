# 엔지니어링(자동화창고 1차 개념제안) 앱 — 인수인계 문서

> 다른 AI(GPT 등)나 다른 개발자가 이 앱을 **이어서 수정**할 때 필요한 정보 전부.
> 작성 기준: 2026-09-06 · 저장소 `lms0517/lms2026` · 브랜치 `claude/sales-hub`

---

## 1. 이 앱이 하는 일

영업 담당자가 고객 창고의 **면적·층고·물동량 6가지**만 입력하면
① 맞는 자동화 시스템 판정 → ② 개략 규모(셀 수)·투자비 → ③ ROI·회수기간 →
④ 3D 시뮬레이션으로 그 규모를 그려 보여주는 **1차 개념제안 도구**.

- 배포: <https://lms0517.github.io/lms2026/apps/eng/> (GitHub Pages, `claude/sales-hub` 브랜치 루트)
- 밝은 스타일 버전2: <https://lms0517.github.io/lms2026/apps/eng2/> (계산 로직 동일, CSS 토큰만 다름)
- 빌드 없음. `index.html` 하나(약 6,100줄)에 HTML·CSS·JS가 전부 들어 있다. 프레임워크 없음.

## 2. 파일 구성

```
apps/eng/
  index.html              앱 전부 (HTML + <style> + <script> vanilla JS)
  manifest.webmanifest    PWA
  sw.js                   서비스워커. PREFIX="eng-lms-", 문서는 network-first
  vendor/three.module.min.js   three.js r185 (→ ./three.core.min.js 를 import)
  vendor/three.core.min.js     ※ 코어만. OrbitControls·RoomEnvironment 같은 addons 없음
  pdfjs/pdf.min.js, pdf.worker.min.js   소개서 PDF 뷰어
  logisall_intro.pdf, tspg_intro.pdf    소개 자료 (각 8MB, 이 묶음에서는 제외)
  icon-192.png, icon-512.png, apple-touch-icon.png
apps/eng2/                 위와 같은 구성 + 밝은 테마. sw PREFIX="eng2-lms-"
```

**로컬 실행**: `index.html` 을 그냥 열면 된다(파일 프로토콜에서도 3D까지 동작).
서비스워커만 http(s) 에서 등록된다.

## 3. 코드 지도 (`apps/eng/index.html`, 줄 번호는 현재 기준·수정하면 밀린다)

| 줄 | 섹션 | 내용 |
|---|---|---|
| 19–492 | `<style>` | 전역 CSS 토큰(`:root`) + 화면별 스타일 |
| 495–780 | HTML | 상단바 · STEP1 회사소개 · STEP2 입력폼 · STEP3 결과 · 모달들 |
| 785–841 | `[CONFIG]` | **요율·상수 전부.** 값 조정은 여기 한 곳 |
| 843–962 | `[DATA]` 시스템 매칭 | 온도·물동량·층고 → 시스템 계열 판정 규칙, 반론 대응 문구 |
| 1238–1336 | `[DATA]` 레퍼런스 | TSPG 공급실적 43건, 영상 매칭 DB |
| 1337–1349 | `[STATE]` | `STATE.data` — 입력값 보관 |
| 1351–1504 | `[QUOTES]` | **실제 견적서 5건 DB. CAPEX 단가의 유일한 근거** |
| 1506–1885 | `[CAPEX]` | 항목별 투자비 모델. `estimate()` / `estimateConv()` / `estimateDock()` |
| 1887–2267 | `[ENGINE]` | 계산 로직 (아래 4장) |
| 2269–2542 | `[UI]` | 화면 전환·입력 수집·결과 렌더 |
| 2564–2769 | QR 인코더 | 외부 라이브러리 없는 QR (대시보드와 같은 코드) |
| 2771–2830 | 소개서 전달 | `shareMenu()` — 이메일 / QR / 톡 |
| 2925–3270 | `renderResult()` | 결과 화면 HTML 생성 |
| 3278–3690 | `[SIM2D]` | three.js 실패 시 캔버스 2D 폴백 |
| 3695–5411 | `[GL3D]` | **3D 렌더러 본체** |
| 5413–5546 | `[SIM3D]` | 오케스트레이터 (GL3D 우선, 실패 시 SIM2D) |
| 5548– | `[DATA]` 소개자료 | PDF·유튜브·블로그 링크 |

## 4. 계산 흐름 (Engine)

입력 6가지: `f_temp` 온도대 · `f_build` 공사분류 · `f_area` 면적(평) · `f_height` 유효층고(m)
· `f_inDay`/`f_outDay` 일 입출고 (또는 `f_volume` 월 물동량)
추가 입력: `f_palletW`/`f_palletL` 파렛트 가로·세로(mm) · `f_palletH` 적재높이 · `f_palletKg`
· `f_stock` 현재 재고 · `f_storeDays` 평균 보관일수 · `f_cells` **구축 셀규모(비우면 면적 최대)**

```
Engine.matchSystem(d)          → 시스템 계열 키 (shuttle / stc / mdps / mini / conv …)
Engine.cellDims(d, sysKey)     → 셀 1칸 치수
     · 4-way 멀티딥: cellW = 파렛트폭 + 0.2m, cellD = 파렛트깊이 + 0.2m, 통로손실 20%
     · 싱글딥 스태커크레인(stc): cellW = +0.45, cellD = +0.10,
       통로손실 = 1 − 2·cellD /(2·cellD + 1.6)   (통로 1.6m / 모듈 4.0m ≈ 3.1㎡/셀/단)
Engine.estimateCells(d)        → {cells, tiers, areaM2, loadH, cellW, cellD, cellM2, aisleLoss, kind}
     tiers = floor((유효층고 − 여유) / (적재높이 + RACK_BEAM_M 0.25))
Engine.buildRatio(d, est)      → 랙 블록이 창고 바닥에서 차지하는 비율 (아래 5장)
Engine.layout(d, est, target)  → {aisles, bay, dF, dB, tier, cellsBuilt, footW, footD, rackW, rackH}
     3D·투자비·요약이 모두 이 layout.cellsBuilt 한 숫자를 쓴다
Engine.roi(d, est)             → targetCells = f_cells 입력값(있으면) ∩ 면적한도, CAPEX·OPEX·회수기간
Engine.scope(d, est, tp, roi)  → 제안 가능 4영역(자동창고 / 무인이송 / 고정형 이송설비 / 자동상하차)
```

**권장 규모 두 가지**(결과 화면 오른쪽 칸)
- 재고 기반 = 현재 재고 × 1.2
- 물동량 기반 = 월 물동량 ÷ 30 × 평균 보관일수
- 재고를 입력하면 재고 기준을, 없으면 물동량 기준을 재무계산에 쓴다.
- 왼쪽 칸 「공간 최대 수용」은 면적·층고를 가득 채웠을 때의 한도(참고용).

## 5. 상수와 그 근거 — 고칠 때 반드시 읽을 것

`CONFIG`(785–841줄) 주석에 근거를 다 적어 놨다. 성격이 두 가지로 갈린다.

**[실측] 실제 견적서에서 역산 — 함부로 바꾸지 말 것**
| 상수 | 값 | 근거 |
|---|---|---|
| `CELL_FOOTPRINT_M2` | 1.96㎡ | 견적 3건 평균 1.35 셀/평/단과 일치 |
| `AISLE_LOSS` | 0.20 | 대한냉동·영풍·제품창고 3건 역산 |
| `CAPEX` 랙/셔틀/리프트/컨베이어 단가 | — | `[QUOTES]` 견적 5건 |

**[가정/추정] 캘리브레이션 대상**
| 상수 | 값 | 성격 |
|---|---|---|
| `STATION_ZONE_M` | 8.0m | 리프트 2.3 + 입출고 컨베이어·버퍼 5.7 (3D가 그리는 깊이와 동일) |
| `CLEARANCE_M` | 1.0m | 랙–벽 점검·소방 이격 |
| `BUILD_LOSS` | 신설 1.0 / 증축 0.95 / 기존 0.90 | 기둥·기존 도크 손실 |
| `CAPEX.CONV`, `CAPEX.DOCK` | — | 컨베이어·자동상하차 모델. 실측 아님 |
| `LABOR_COST_MAN` 4,000만원, `LABOR_REDUCTION` 0.65, `OPEX_RATE` 3.5% | — | 재무 가정 |
| `WORK_DAYS_MONTH` 26, `OP_HOURS` 8 | — | 운영 기준(사용자 확정) |

**랙 블록 비율(`Engine.buildRatio`)** — 예전에는 상수 0.55 였으나, "자동창고 전용 건물에
검수·사무 공간이 왜 필요하냐"는 지적을 받아 **기하 계산**으로 바꿨다.
랙 블록을 정사각 s×s 로 보고 `s² + (3c+z)·s + 2c(z+c) − A = 0` 을 풀어 `ratio = s²/A`.
결과: 500평 ≈ 0.75, 120평 ≈ 0.55, 2,000평 ≈ 0.87 (규모가 클수록 올라감) × `BUILD_LOSS`.

## 6. 3D 시뮬레이션 (GL3D)

- three.js **코어만** 있다. addons 없음 → `PMREMGenerator`, `MeshPhysicalMaterial`,
  `CanvasTexture` 등 코어 API로 직접 만들었다. OrbitControls 없이 포인터 이벤트를 직접 처리한다.
- `buildData()` 가 `Engine.layout` 결과를 그대로 읽는다 → **화면 셀 수 = 투자비 셀 수 = 요약 셀 수**.
  (예전엔 12,000셀·14단을 넘으면 표시를 축약해 숫자가 어긋났다. 그 축약은 제거함.)
- 설비 대수도 계산값: 셔틀 `qty.shuttleQty`(≤12), 리프트 `qty.lifterQty` 를 통로·단에 분배.
- `fitView()` 는 8-코너 투영 이분법으로 규모와 무관하게 전체가 화면에 들어오게 반경을 잡는다.
- 성능: `InstancedMesh` + 거리 LOD(`applyLOD`), dpr 상한 2, 그림자는 3,000셀 이하에서만.
- 외부 API: `SIM3D.init() / reset() / togglePlay() / stop() / fitView()`.

## 7. 최근 작업 이력 (최신순)

| 커밋 | 내용 |
|---|---|
| `efa4f39` | 밝은 스타일 버전을 `apps/eng2` 로 분리(기존 eng 은 그대로), 권장 규모 칸 잘림 수정 |
| `1c14dbf` | 헤더에 빌드 시각 표시 + 서비스워커 캐시 무효화 |
| `15d8105` | 소개서 「카톡 전달」 → 「전달」(이메일 / QR / 톡) |
| `9c05abd` | 시스템별 보관 밀도(싱글딥 비교), 권장 규모를 재고 기반·물동량 기반으로 나눠 표시 |
| `3c1cf46` | 결과 화면 정리, 고정형 이송설비·자동상하차를 개략값에서 계산 모델로 |
| `14ee752` | 랙 블록 비율을 상수 0.55 → 기하 계산 |
| `f70e808` | `apps/eng` 로 이관, 파렛트 규격 가로/세로 입력, 셀규모 입력, 3D 재작성 |

## 8. 남은 과제

1. `STATION_ZONE_M` · `CLEARANCE_M` · `CAPEX.CONV` · `CAPEX.DOCK` 를 실제 TSPG 견적으로 검증·보정.
2. 세로 전체화면에서 3D 프레이밍을 조금 더 크게 잡을 여지가 있다.
3. eng 과 eng2 가 **파일 두 벌**이다. 계산 로직을 고치면 양쪽 다 고쳐야 한다.
   (`scratchpad/lightify.py` 가 eng → eng2 변환 스크립트다. eng 을 고친 뒤 다시 돌리면 된다.)
4. 견적 DB(`[QUOTES]`)가 5건뿐 — 건수가 늘면 CAPEX 정확도가 올라간다.

## 9. 이어서 작업할 때의 규칙

- **한 파일에 다 들어 있다.** 빌드·번들·npm 없음. 편집 후 브라우저 새로고침이 전부.
- 계산을 바꾸면 결과 화면·계산 근거 모달·3D 캡션 **세 곳의 숫자가 같은지** 확인할 것.
  (같은 값을 세 군데서 따로 계산하지 말고 `Engine.roi` 가 돌려주는 값을 쓴다.)
- CSS 는 `:root` 토큰 위주. 색을 바꿀 때는 토큰을 먼저 본다.
- 상수를 바꿀 때는 주석의 [실측]/[가정] 표시를 지우지 말고 근거를 같이 갱신할 것.
- 배포는 `claude/sales-hub` 브랜치에 push 하면 GitHub Pages 가 1~3분 뒤 반영한다.

---

### GPT에게 넘길 때 쓸 첫 프롬프트 예시

```
첨부한 index.html 은 자동화창고 1차 개념제안 웹앱이다(빌드 없는 단일 파일, vanilla JS).
같이 넣은 HANDOFF.md 에 구조·계산 로직·상수 근거·남은 과제가 정리돼 있으니 먼저 읽어라.
수정할 때는 (1) CONFIG 상수의 [실측] 표시된 값은 근거 없이 바꾸지 말고,
(2) 결과 화면·계산 근거 모달·3D 캡션의 셀 수가 항상 같은 값(Engine.roi)에서 나오게 하고,
(3) 전체 파일을 다시 뱉지 말고 바꿀 부분만 정확한 앞뒤 문맥과 함께 알려줘.
오늘 할 일: <여기에 요청>
```
