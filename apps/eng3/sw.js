/* ENG v3 (apps/eng3) — Service Worker
   - HTML 문서: network-first (온라인이면 항상 최신, 오프라인이면 마지막 정상본)
   - 정적 자원(three.js·pdf.js·아이콘 등): cache-first
   ★ activate 에서는 자기 접두사(eng3-lms-)로 시작하는 캐시만 정리한다 —
     전체를 지우면 같은 사이트의 다른 앱(eng·eng2 등) 오프라인 캐시까지 날아간다. */
const PREFIX = "eng3-lms-";
const CACHE  = PREFIX + "3.0.1009.7";
const APP_HTML = "index.html";

/* 공용 자원은 상위 경로(../)를 그대로 참조한다. 스코프 밖 URL도 캐시는 가능하다. */
const ASSETS = [
  APP_HTML, "./higgsfield-scene.js?v=3.0.4", "./higgsfield-reference.html",
  "./higgsfield.js?v=3.1.2", "./higgsfield-models.js?v=3.0.4",
  "../assets/warehouse-higgsfield.glb", "./vendor/GLTFLoader.js", "./vendor/BufferGeometryUtils.js", "./vendor/SkeletonUtils.js",
  "./simulation.js?v=3.2.1", "./simulation.css?v=3.2.0",
  "./vendor/three.module.min.js", "./vendor/three.core.min.js",
  "manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./pdfjs/pdf.min.js",
  "./pdfjs/pdf.worker.min.js"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      // 개별 실패가 설치 전체를 막지 않도록 하나씩 담는다
      .then(c => Promise.all(ASSETS.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(
        ks.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  // PDF·Range 요청은 건드리지 않는다(안드로이드 PDF 뷰어 호환)
  if (req.url.split("?")[0].endsWith(".pdf") || req.headers.has("range")) return;

  const isDoc = req.mode === "navigate" ||
                (req.destination === "document") ||
                req.url.endsWith(APP_HTML);

  if (isDoc) {
    e.respondWith(
      fetch(req, { cache: "reload" }).then(resp => {
        // 정상 응답만 저장 — 서버 오류(4xx·5xx) 화면이 오프라인용 정상본을 덮어쓰지 않게
        if (!resp.ok) return caches.match(req).then(r => r || caches.match(APP_HTML)).then(r => r || resp);
        const copy = resp.clone();
        e.waitUntil(caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}));
        return resp;
      }).catch(() => caches.match(req).then(r => r || caches.match(APP_HTML)))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(resp => {
      if (resp.ok) {
        const copy = resp.clone();
        e.waitUntil(caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}));
      }
      return resp;
    }).catch(() => cached))
  );
});
