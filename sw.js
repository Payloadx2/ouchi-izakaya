/* おうち居酒屋 サービスワーカー（Web Push 受け皿） */

// 新しいSWを待機させず即座に有効化（iOSでの更新反映を早める）
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (event) { event.waitUntil(self.clients.claim()); });

// ページ読み込み（HTML）は常にネットワーク優先で最新を取得。
// ホーム画面アイコン起動と通知タップ起動でHTMLのキャッシュが分かれ、古い版が出る問題への対策。
// オフライン時のみ直近に取得できたHTMLへフォールバックする。
self.addEventListener("fetch", function (event) {
  const req = event.request;
  if (req.mode !== "navigate") return; // HTML以外（JS/CSS/画像/CDN）はブラウザ任せ
  event.respondWith(
    fetch(req.url, { cache: "no-store" })
      .then(function (res) {
        const copy = res.clone();
        caches.open("oi-html").then(function (c) { c.put("__index__", copy); }).catch(function () {});
        return res;
      })
      .catch(function () {
        return caches.open("oi-html").then(function (c) { return c.match("__index__"); })
          .then(function (r) { return r || Response.error(); });
      })
  );
});

// 「起動時に開くべき開催ID」をCacheに保存/消去（タスクキルからの復帰用）
function setPendingEvent(id) {
  if (!id) return Promise.resolve();
  return caches.open("oi-nav").then(function (c) {
    return c.put("/__pending_event__", new Response(JSON.stringify({ id: id, ts: Date.now() })));
  }).catch(function () {});
}
function clearPendingEvent() {
  return caches.open("oi-nav").then(function (c) { return c.delete("/__pending_event__"); }).catch(function () {});
}

self.addEventListener("push", function (event) {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  const title = data.title || "おうち居酒屋";
  const eventId = data.eventId || null;
  const options = {
    body: data.body || "新しいオーダーが入りました",
    icon: "apple-touch-icon.png",
    badge: "apple-touch-icon.png",
    tag: data.tag || "order",
    data: { url: data.url || "./", eventId: eventId }
  };
  // 通知表示と同時に、開催IDを先に保存しておく（タップ前に書くのでレースが起きない）
  event.waitUntil(Promise.all([
    self.registration.showNotification(title, options),
    setPendingEvent(eventId)
  ]));
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
          // 起動中のアプリがある → その場で開催詳細へ。Cacheは使わないので消しておく
          c.postMessage({ type: "open-event", eventId: eventId });
          return clearPendingEvent().then(function () { return c.focus(); });
        }
      }
      // 開いている画面が無い（タスクキル等）→ 開催IDを（念のため新しい時刻で）保存してから起動
      return setPendingEvent(eventId).then(function () {
        if (self.clients.openWindow) return self.clients.openWindow(url);
      });
    })
  );
});
