/* Service worker for HVAC Module 1 (module-01-app.html).
   Must sit in the same folder as the page and be served over HTTPS (or from localhost). */
var CACHE = "hvac-m1-shell-v1";
var SHELL = ["./module-01-app.html", "./", "./sw.js"];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // Add one by one so a missing "./" (no directory index) can't break install.
      return Promise.all(SHELL.map(function (u) {
        return cache.add(new Request(u, { cache: "reload" })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k.indexOf("hvac-m1-shell-") === 0 && k !== CACHE;
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// The page posts its own URL so it is cached even if the file was renamed.
self.addEventListener("message", function (event) {
  var d = event.data || {};
  if (d.type === "cache-urls" && Array.isArray(d.urls)) {
    var same = d.urls.filter(function (u) {
      try { return new URL(u, self.location.href).origin === self.location.origin; } catch (e) { return false; }
    });
    event.waitUntil(caches.open(CACHE).then(function (cache) {
      return Promise.all(same.map(function (u) { return cache.add(u).catch(function () {}); }));
    }));
  }
});

// Stale-while-revalidate: answer from cache instantly, refresh the cache in the background.
self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  var cacheP = caches.open(CACHE);
  var network = cacheP.then(function (cache) {
    return fetch(req).then(function (res) {
      if (res && res.ok && res.type === "basic") cache.put(req, res.clone());
      return res;
    });
  });
  event.waitUntil(network.catch(function () {}));

  event.respondWith(cacheP.then(function (cache) {
    return cache.match(req, { ignoreSearch: req.mode === "navigate" }).then(function (cached) {
      if (cached) return cached;
      return network.catch(function () {
        if (req.mode === "navigate") {
          return cache.match("./module-01-app.html").then(function (r) {
            return r || new Response("Offline and this page isn't cached yet.", { status: 503, headers: { "Content-Type": "text/plain" } });
          });
        }
        return new Response("", { status: 504 });
      });
    });
  }));
});
