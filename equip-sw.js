/* 그룹사 장비 견적 — 서비스워커
   앱 셸을 캐시해 오프라인(현장·창고 안)에서도 견적을 만들 수 있게 한다. */
const V = 'lf-v1-photos';
const SHELL = [
  './equip.html',
  './equip.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
];
/* 장비 사진 — 있으면 캐시하고, 없으면 조용히 넘어간다. */
const PHOTOS = [
  './photos/diesel.jpg',
  './photos/diesel.png',
  './photos/diesel.webp',
  './photos/lpg.jpg',
  './photos/lpg.png',
  './photos/lpg.webp',
  './photos/elec.jpg',
  './photos/elec.png',
  './photos/elec.webp',
  './photos/diesel-electric.jpg',
  './photos/diesel-electric.png',
  './photos/diesel-electric.webp',
  './photos/lpg-electric.jpg',
  './photos/lpg-electric.png',
  './photos/lpg-electric.webp',
  './photos/reach.jpg',
  './photos/reach.png',
  './photos/reach.webp',
  './photos/picker.jpg',
  './photos/picker.png',
  './photos/picker.webp',
  './photos/stacker.jpg',
  './photos/stacker.png',
  './photos/stacker.webp',
  './photos/ppt.jpg',
  './photos/ppt.png',
  './photos/ppt.webp',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V)
      .then(c => c.addAll(SHELL)
        /* 사진은 아직 없을 수 있다 — 한 장이 없다고 설치가 실패하면 안 된다 */
        .then(() => Promise.all(PHOTOS.map(u => c.add(u).catch(() => {})))))
      .then(() => self.skipWaiting()));
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
const mine = url => SHELL.concat(PHOTOS).some(p => url.pathname.endsWith(p.replace('./', '')));

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
          caches.open(V).then(c => c.put('./equip.html', copy));
          return res;
        })
        .catch(() => caches.match('./equip.html'))
    );
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
