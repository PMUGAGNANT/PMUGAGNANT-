self.addEventListener("push", function (event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "TurfEdge";
  const options = {
    body: data.body || "Nouveau signal disponible",
    icon: data.icon || "/logo-turfedge.png",
    badge: data.badge || "/favicon.ico",
    image: data.image,
    tag: data.tag || "pmu-signal",
    requireInteraction: Boolean(data.requireInteraction),
    renotify: Boolean(data.renotify),
    actions: Array.isArray(data.actions) ? data.actions : [],
    data: {
      url: data.url || "/",
      actionUrl: data.data && data.data.actionUrl ? data.data.actionUrl : "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const data = event.notification.data || {};
  const url =
    event.action === "open-home" && data.actionUrl
      ? data.actionUrl
      : data.url || "/";
  event.waitUntil(clients.openWindow(url));
});
