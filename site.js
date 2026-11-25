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

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { pickLang: pickLang, withLang: withLang };
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
    doc.querySelectorAll(".lang-toggle button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-set") === lang));
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

  doc.addEventListener("DOMContentLoaded", function () {
    setBody(lang);
    doc.addEventListener("click", function (e) {
      var b = e.target.closest(".lang-toggle button");
      if (!b) return;
      lang = b.getAttribute("data-set");
      setRoot(lang);
      setBody(lang);
      write(lang);
    });
  });
})(typeof window !== "undefined" ? window : globalThis);
