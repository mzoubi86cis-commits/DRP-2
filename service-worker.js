/* ==========================================================================
   Service Worker - نظام الحضور والغياب BTEC
   يعمل على تخزين الملفات محلياً للعمل دون اتصال
   ========================================================================== */

const CACHE_NAME = "btec-attendance-v1";

// الملفات التي سيتم تخزينها مسبقاً
const PRECACHE_URLS = [
    "./",
    "./index.html",
    "./style.css",
    "./config.js",
    "./cloud.js",
    "./students.js",
    "./attendance.js",
    "./reports.js",
    "./admin.js",
    "./app.js",
    "./manifest.json",
    "./icons/icon-192.png",
    "./icons/icon-512.png"
];

// ===== تثبيت Service Worker =====
self.addEventListener("install", function(event) {
    console.log("🔧 SW: Installing...");
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log("📦 SW: Caching files");
                return cache.addAll(PRECACHE_URLS);
            })
            .then(function() {
                return self.skipWaiting();
            })
            .catch(function(err) {
                console.error("❌ SW: Cache failed", err);
            })
    );
});

// ===== تفعيل Service Worker =====
self.addEventListener("activate", function(event) {
    console.log("✅ SW: Activating...");
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName !== CACHE_NAME) {
                        console.log("🗑️ SW: Deleting old cache:", cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

// ===== اعتراض الطلبات =====
self.addEventListener("fetch", function(event) {
    const url = new URL(event.request.url);
    
    // لا تخزن طلبات JSONBin.io (بيانات المستخدم - تحتاج تحديث دائم)
    if (url.hostname === "api.jsonbin.io") {
        return; // اتركها تمر مباشرة
    }
    
    // لا تخزن طلبات CDN أيضاً (لأنها كبيرة)
    if (url.hostname === "cdn.jsdelivr.net" || url.hostname.includes("fonts.gstatic")) {
        return;
    }
    
    // استراتيجية: cache-first مع تحديث في الخلفية
    event.respondWith(
        caches.match(event.request).then(function(cachedResponse) {
            if (cachedResponse) {
                // أعد من الكاش، وحدّث في الخلفية
                fetch(event.request).then(function(networkResponse) {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then(function(cache) {
                            cache.put(event.request, networkResponse.clone());
                        });
                    }
                }).catch(function() {
                    // فشل التحديث، لا مشكلة - نستخدم الكاش
                });
                return cachedResponse;
            }
            
            // ليس في الكاش - احضره من الشبكة
            return fetch(event.request).then(function(networkResponse) {
                if (!networkResponse || networkResponse.status !== 200) {
                    return networkResponse;
                }
                // خزنه للاستخدام لاحقاً
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(function(cache) {
                    cache.put(event.request, responseToCache);
                });
                return networkResponse;
            }).catch(function() {
                // لا يوجد اتصال ولا يوجد في الكاش
                // إذا كان طلب صفحة HTML، أعد index.html من الكاش
                if (event.request.mode === "navigate") {
                    return caches.match("./index.html");
                }
                return new Response("غير متصل بالإنترنت", {
                    status: 503,
                    headers: { "Content-Type": "text/plain; charset=utf-8" }
                });
            });
        })
    );
});

// ===== استقبال رسائل من الصفحة =====
self.addEventListener("message", function(event) {
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});