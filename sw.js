// Minimaler Service Worker — nur damit PWA-Install funktioniert.
// Bewusst KEIN Caching der /api-Responses, damit news.json immer frisch ist.
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {}); // pass-through
