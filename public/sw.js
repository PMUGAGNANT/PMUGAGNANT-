self.addEventListener("push", function (event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "PMU Gagnant";
  const options = {
    body: data.body || "Nouveau signal disponible",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: data.tag || "pmu-signal",
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";
  event.waitUntil(clients.openWindow(url));
});
