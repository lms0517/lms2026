/* 로지스올 지게차 견적 — 서비스워커
   앱 셸을 캐시해 오프라인(현장·창고 안)에서도 견적을 만들 수 있게 한다. */
const V = 'lf-v1';
const SHELL = [
  './forklift.html',
  './forklift.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 이 SW는 지게차 견적앱 자산만 담당한다.
   같은 스코프의 다른 페이지(index.html 등)는 건드리지 않고 네트워크로 흘려보낸다. */
const mine = url => SHELL.some(p => url.pathname.endsWith(p.replace('./', '')));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || !mine(url)) return;

  if (req.mode === 'navigate') {
    /* 문서는 네트워크 우선 — 새 버전을 받되, 오프라인이면 캐시로 */
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(V).then(c => c.put('./forklift.html', copy));
          return res;
        })
        .catch(() => caches.match('./forklift.html'))
    );
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
