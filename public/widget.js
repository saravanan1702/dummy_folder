/*! Website chat embed. Usage:
 *  <script src="https://YOUR-APP/widget.js" data-channel="CHANNEL_ID" async></script>
 */
(function () {
  if (window.__chatWidgetLoaded) return;
  var script =
    document.currentScript ||
    (function () {
      var all = document.querySelectorAll("script[data-channel]");
      return all[all.length - 1];
    })();
  if (!script) return;
  var channel = script.getAttribute("data-channel");
  if (!channel || !/^[a-z0-9]+$/i.test(channel)) return;
  window.__chatWidgetLoaded = true;

  var origin = new URL(script.src, window.location.href).origin;
  var cfg = { color: "#6246EA", position: "right" };
  var open = false;
  var unread = 0;
  var frame = null;

  var ICON_CHAT =
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>';
  var ICON_CLOSE =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  var root = document.createElement("div");
  root.setAttribute("data-chat-widget", "");
  root.style.cssText = "position:fixed;bottom:20px;z-index:2147483000;font-family:system-ui,sans-serif";

  var panel = document.createElement("div");
  panel.style.cssText =
    "display:none;position:fixed;bottom:92px;width:384px;max-width:calc(100vw - 24px);height:620px;max-height:calc(100vh - 112px);" +
    "border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 18px 50px -12px rgba(22,19,45,.35),0 4px 14px rgba(22,19,45,.12)";

  var button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", "Open chat");
  button.style.cssText =
    "position:relative;width:58px;height:58px;border-radius:50%;border:0;cursor:pointer;display:flex;align-items:center;justify-content:center;" +
    "box-shadow:0 8px 24px -6px rgba(22,19,45,.45);transition:transform .15s ease";
  button.onmouseenter = function () { button.style.transform = "scale(1.06)"; };
  button.onmouseleave = function () { button.style.transform = "scale(1)"; };

  var badge = document.createElement("span");
  badge.style.cssText =
    "display:none;position:absolute;top:-2px;right:-2px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#ef4565;color:#fff;" +
    "font-size:12px;font-weight:700;line-height:20px;text-align:center;box-sizing:border-box";

  function isMobile() { return window.innerWidth < 480; }

  function layout() {
    var side = cfg.position === "left" ? "left" : "right";
    var other = side === "left" ? "right" : "left";
    root.style[side] = "20px";
    root.style[other] = "auto";
    button.style.background = cfg.color;
    if (isMobile()) {
      panel.style.cssText += ";top:0;left:0;right:0;bottom:0;width:100%;max-width:100%;height:100%;max-height:100%;border-radius:0";
    } else {
      panel.style.top = "auto";
      panel.style.bottom = "92px";
      panel.style[side] = "20px";
      panel.style[other] = "auto";
      panel.style.width = "384px";
      panel.style.maxWidth = "calc(100vw - 24px)";
      panel.style.height = "620px";
      panel.style.maxHeight = "calc(100vh - 112px)";
      panel.style.borderRadius = "18px";
    }
  }

  function render() {
    button.innerHTML = open ? ICON_CLOSE : ICON_CHAT;
    button.appendChild(badge);
    button.setAttribute("aria-label", open ? "Close chat" : "Open chat");
    button.setAttribute("aria-expanded", String(open));
    badge.style.display = !open && unread > 0 ? "block" : "none";
    badge.textContent = unread > 9 ? "9+" : String(unread);
    panel.style.display = open ? "block" : "none";
    // On phones the panel is full screen, so its own header carries the close button.
    button.style.display = open && isMobile() ? "none" : "flex";
  }

  function toggle(next) {
    open = typeof next === "boolean" ? next : !open;
    if (open) {
      unread = 0;
      if (!frame) {
        frame = document.createElement("iframe");
        frame.src = origin + "/widget/" + channel + "?embed=1";
        frame.title = "Chat";
        frame.allow = "clipboard-write";
        frame.style.cssText = "width:100%;height:100%;border:0;display:block";
        panel.appendChild(frame);
      }
      layout();
    }
    render();
  }

  button.onclick = function () { toggle(); };

  window.addEventListener("message", function (event) {
    if (event.origin !== origin || !event.data || event.data.source !== "chat-widget") return;
    if (event.data.type === "close") toggle(false);
    if (event.data.type === "message" && !open) { unread += 1; render(); }
  });
  window.addEventListener("resize", function () { if (open) { layout(); render(); } });

  function mount() {
    root.appendChild(panel);
    root.appendChild(button);
    document.body.appendChild(root);
    layout();
    render();
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);

  // Appearance configured in the dashboard (colour, side).
  fetch(origin + "/api/widget/" + channel + "/config")
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (c) { if (c) { cfg = c; layout(); } })
    .catch(function () {});

  // Tiny public API: window.ChatWidget.open() / close() / toggle()
  window.ChatWidget = { open: function () { toggle(true); }, close: function () { toggle(false); }, toggle: function () { toggle(); } };
})();
