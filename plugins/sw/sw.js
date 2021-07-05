var cacheName = '__CACHE_NAME__'
var cacheFiles = __CACHE_FILES__
// 监听install事件，安装完成后，进行文件缓存
self.addEventListener('install', function(e) {
    console.log("%cService Worker install", "color:#fff;background:#5397f5;padding:0 18px")
	var cacheOpenPromise = caches.open(cacheName).then(function(cache) {
		return cache.addAll(cacheFiles)
	})
	self.skipWaiting()
	e.waitUntil(cacheOpenPromise)
})

self.addEventListener('activate', function(e) {
    console.log("%cService Worker activate", "color:#fff;background:#00b94e;padding:0 18px")
	var cachePromise = caches.keys().then(function(keys) {
		return Promise.all(
			keys.map(function(key) {
				if (key !== cacheName) {
					console.log(`%cService Worker cache updated: ${key} ===> ${cacheName}`, "color:#fff;background:#cc1c0a;padding:0 18px")
					return caches.delete(key)
				}
			})
		)
	})
	e.waitUntil(cachePromise)
	// 注意不能忽略这行代码，否则第一次加载会导致fetch事件不触发
	return self.clients.claim()
})

self.addEventListener('fetch', function(e) {
	e.respondWith(
		caches
			.match(e.request)
			.then(function(cache) {
				if (cache) {
					console.log('cache hint: ' + e.request.url)
				}
				return cache || fetch(e.request)
			})
			.catch(function(err) {
				console.log(err)
				return fetch(e.request)
			})
	)
})
