/* おうち居酒屋 サービスワーカー（Web Push 受け皿） */
self.addEventListener("push", function (event) {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  const title = data.title || "おうち居酒屋";
  const options = {
    body: data.body || "新しいオーダーが入りました",
    icon: "apple-touch-icon.png",
    badge: "apple-touch-icon.png",
    tag: data.tag || "order",
    data: { url: data.url || "./", eventId: data.eventId || null }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const d = event.notification.data || {};
  const url = d.url || "./";
  const eventId = d.eventId || null;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (const c of list) {
        if ("focus" in c) {
          c.postMessage({ type: "open-event", eventId: eventId }); // 起動中のアプリを開催詳細へ
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url); // 閉じてる時は ?ev=… で起動
    })
  );
});
