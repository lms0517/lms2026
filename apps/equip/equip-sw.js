/* 그룹사 장비 견적 — 서비스워커
   앱 셸을 캐시해 오프라인(현장·창고 안)에서도 견적을 만들 수 있게 한다. */
const V = 'lf-v2-spin';
const SHELL = [
  './equip.html',
  './equip.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
];
self.addEventListener('install', e => {
  /* 사진은 미리 받지 않는다 — 360° 시퀀스는 기종당 수십 장이라
     앱을 처음 여는 자리에서 다 받으면 느리다. 화면에 뜬 것만 아래에서 캐시한다. */
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 이 SW는 장비 견적앱 자산만 담당한다.
   같은 스코프의 다른 페이지(index.html 등)는 건드리지 않고 네트워크로 흘려보낸다. */
const mine = url => SHELL.some(p => url.pathname.endsWith(p.replace('./', '')));
/* 장비 사진(360° 시퀀스 포함) — 받아온 것만 캐시에 남겨 현장에서 다시 쓴다 */
const isPhoto = url => url.pathname.includes('/photos/');

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (isPhoto(url)) {
    e.respondWith(caches.open(V).then(c =>
      c.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) c.put(req, res.clone());   /* 없는 사진(404)은 캐시하지 않는다 */
        return res;
      }))
    ));
    return;
  }
  if (!mine(url)) return;

  if (req.mode === 'navigate') {
    /* 문서는 네트워크 우선 — 새 버전을 받되, 오프라인이면 캐시로 */
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(V).then(c => c.put('./equip.html', copy));
          return res;
        })
        .catch(() => caches.match('./equip.html'))
    );
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
