const cacheName = '__CACHE_NAME__';
const cacheFiles = __CACHE_FILES__;
// 监听install事件，安装完成后，进行文件缓存
self.addEventListener('install', e => {
    console.log('%cService Worker install', 'color:#fff;background:#5397f5;padding:0 18px');
    const cacheOpenPromise = caches.open(cacheName).then(cache => cache.addAll(cacheFiles));
    self.skipWaiting();
    e.waitUntil(cacheOpenPromise);
});

self.addEventListener('activate', e => {
    console.log('%cService Worker activate', 'color:#fff;background:#00b94e;padding:0 18px');
    const cachePromise = caches.keys().then(keys =>
        Promise.all(
            keys.map(key => {
                if (key !== cacheName) {
                    console.log(`%cService Worker cache updated: ${key} ===> ${cacheName}`, 'color:#fff;background:#cc1c0a;padding:0 18px');
                    return caches.delete(key);
                }
            })
        )
    );
    e.waitUntil(cachePromise);
    // 注意不能忽略这行代码，否则第一次加载会导致fetch事件不触发
    return self.clients.claim();
});

self.addEventListener('fetch', e => {
    e.respondWith(
        caches
            .match(e.request)
            .then(cache => {
                if (cache) {
                    console.log(`cache hint: ${e.request.url}`);
                }
                return cache || fetch(e.request);
            })
            .catch(err => {
                console.log(err);
                return fetch(e.request);
            })
    );
});
