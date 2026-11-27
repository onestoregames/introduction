// 언어 결정·전환. <head> 에서 바로 실행해 첫 화면부터 맞는 언어로 그린다.
(function (root) {
  "use strict";
  var LANGS = ["ko", "en", "zh", "ja"];
  var ATTR = { ko: "ko", en: "en", zh: "zh-Hans", ja: "ja" };
  var KEY = "introLang";

  // 주소의 ?lang= → 지난번 선택 → 브라우저 언어 → 영어
  function pickLang(query, stored, navLangs) {
    if (LANGS.indexOf(query) >= 0) return query;
    if (LANGS.indexOf(stored) >= 0) return stored;
    var list = navLangs || [];
    for (var i = 0; i < list.length; i++) {
      var two = String(list[i]).toLowerCase().slice(0, 2);
      if (LANGS.indexOf(two) >= 0) return two;
    }
    return "en";
  }

  // href 에 lang=<lang> 을 붙인다. 이미 있으면 바꿔 끼운다. #조각은 맨 뒤에 둔다.
  function withLang(href, lang) {
    var hash = "", i = href.indexOf("#");
    if (i >= 0) { hash = href.slice(i); href = href.slice(0, i); }
    href = href.replace(/([?&])lang=[^&]*(&|$)/, function (m, lead, tail) { return tail ? lead : ""; });
    return href + (href.indexOf("?") >= 0 ? "&" : "?") + "lang=" + lang + hash;
  }

  // 담당자 QR 레퍼럴(33_qr-referral). ?ref=<코드> 를 90일 보관하고 조회·신청 클릭을 집계 서버로 보낸다.
  // 보내는 값은 코드·이벤트·언어뿐(개인정보 없음). ref 없이 온 방문자는 아무것도 보내지 않는다.
  var REF_KEY = "introRef", SENT_KEY = "introRefSent", REF_TTL = 90 * 86400000;
  var REF_ENDPOINT = "https://intro-ref.lsi7564.workers.dev/hit";

  function parseRef(v) {
    if (v == null) return null;
    var s = String(v).trim().toLowerCase();
    return /^[a-z0-9]{2,16}$/.test(s) ? s : null;
  }

  function kstDay(ms) { return new Date(ms + 9 * 3600000).toISOString().slice(0, 10); }

  // 보관값 {code, ts} → 코드. 90일 지났거나 형식이 틀리면 null
  function storedRef(raw, now) {
    var o;
    try { o = JSON.parse(raw); } catch (e) { return null; }
    if (!o || !parseRef(o.code) || typeof o.ts !== "number" || now - o.ts > REF_TTL) return null;
    return parseRef(o.code);
  }

  // 하루 1회 제한. sent = {"날짜|코드|이벤트": 1}. 보낼지와, 오늘 키만 남긴 새 객체를 돌려준다
  function shouldSend(sent, day, code, ev) {
    var next = {}, key = day + "|" + code + "|" + ev;
    for (var k in sent || {}) if (k.indexOf(day + "|") === 0) next[k] = 1;
    var send = !next[key];
    next[key] = 1;
    return { send: send, sent: next };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { pickLang: pickLang, withLang: withLang, parseRef: parseRef, kstDay: kstDay,
      storedRef: storedRef, shouldSend: shouldSend };
    return;
  }

  var doc = root.document, h = doc.documentElement;
  function read() { try { return root.localStorage.getItem(KEY); } catch (e) { return null; } }
  function write(v) { try { root.localStorage.setItem(KEY, v); } catch (e) { /* 저장 불가 환경은 무시 */ } }

  function setRoot(lang) {
    h.setAttribute("data-lang", lang);
    h.lang = ATTR[lang];
    var title = h.getAttribute("data-title-" + lang);
    if (title) doc.title = title;
    var meta = doc.querySelector('meta[name="description"]'), desc = h.getAttribute("data-desc-" + lang);
    if (meta && desc) meta.setAttribute("content", desc);
  }

  function setBody(lang) {
    doc.querySelectorAll(".lang-toggle a").forEach(function (b) {
      if (b.getAttribute("data-set") === lang) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
    });
    doc.querySelectorAll("a[data-lang-link]").forEach(function (a) {
      a.setAttribute("href", withLang(a.getAttribute("href"), lang));
    });
  }

  var nav = root.navigator;
  var lang = pickLang(new URLSearchParams(root.location.search).get("lang"), read(),
    nav.languages && nav.languages.length ? nav.languages : [nav.language]);
  setRoot(lang);

  // 중·일 화면은 첫 글자부터 Noto 로 그려야 새로고침 때 글꼴이 바뀌어 보이지 않는다(정적 preload 는 Paperlogy 만).
  var noto = { zh: "NotoSC", ja: "NotoJP" }[lang];
  if (noto) [400, 600, 800].forEach(function (w) {
    var l = doc.createElement("link");
    l.rel = "preload"; l.as = "font"; l.type = "font/woff2"; l.crossOrigin = "anonymous";
    l.href = "fonts/" + noto + "-" + w + ".woff2";
    doc.head.appendChild(l);
  });

  // 주소의 ?lang= 을 항상 현재 언어로 맞춘다 → 주소창 링크가 곧 그 언어의 개별 링크
  function syncUrl() {
    try { root.history.replaceState(null, "", withLang(root.location.pathname + root.location.search + root.location.hash, lang)); } catch (e) { /* 무시 */ }
  }

  function load(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
  function store(k, v) { try { root.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  var urlRef = null;
  try { urlRef = parseRef(new URLSearchParams(root.location.search).get("ref")); } catch (e) { /* 무시 */ }
  if (urlRef) store(REF_KEY, JSON.stringify({ code: urlRef, ts: Date.now() }));
  var ref = urlRef || storedRef(load(REF_KEY), Date.now());
  var memSent = {}; // 저장소를 못 쓰는 환경: 이 페이지 안에서만 하루 1회 제한

  function hit(ev) {
    if (!ref) return;
    var sent = memSent, raw = load(SENT_KEY);
    if (raw) { try { sent = JSON.parse(raw) || {}; } catch (e) { sent = {}; } }
    var r = shouldSend(sent, kstDay(Date.now()), ref, ev);
    if (!store(SENT_KEY, JSON.stringify(r.sent))) memSent = r.sent;
    if (!r.send) return;
    var body = JSON.stringify({ ref: ref, ev: ev, lang: lang });
    try { if (root.navigator.sendBeacon && root.navigator.sendBeacon(REF_ENDPOINT, body)) return; } catch (e) { /* 아래 fetch 로 */ }
    try {
      root.fetch(REF_ENDPOINT, { method: "POST", keepalive: true, headers: { "Content-Type": "text/plain" }, body: body })
        .catch(function () { /* 집계 실패는 화면에 영향 없음 */ });
    } catch (e) { /* 무시 */ }
  }

  doc.addEventListener("DOMContentLoaded", function () {
    setBody(lang);
    syncUrl();
    if (urlRef) hit("visit");
    doc.addEventListener("click", function (e) {
      var f = e.target.closest && e.target.closest("a[data-form]");
      if (f) hit(f.getAttribute("data-form") === "update" ? "apply_update" : "apply_new");
    });
    doc.addEventListener("click", function (e) {
      var b = e.target.closest(".lang-toggle a");
      if (!b) return;
      e.preventDefault();
      lang = b.getAttribute("data-set");
      setRoot(lang);
      setBody(lang);
      write(lang);
      syncUrl();
    });
  });
})(typeof window !== "undefined" ? window : globalThis);
