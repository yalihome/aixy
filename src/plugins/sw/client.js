if (__resourceQuery) {
    const querystring = require('querystring');
    var overrides = querystring.parse(__resourceQuery.slice(1));
}

if ('serviceWorker' in navigator) {
    if (overrides.flush === 'true') {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            registrations.forEach(item => {
                item.unregister();
            });
        });
        caches.keys().then(key => {
            caches.delete(key);
        });
        console.log('%cService Worker disabled', 'color:#fff;background:#cc1c0a;padding:0 18px');
    } else {
        navigator.serviceWorker.register(overrides.filename, {scope: overrides.scope || '/'});
    }
}
