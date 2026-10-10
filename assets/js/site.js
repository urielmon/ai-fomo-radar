// AI FOMO Radar — language + theme toggles, remembered in localStorage.
(function () {
  var d = document.documentElement;
  function setAlts(lang) {
    var imgs = document.querySelectorAll("img[data-alt-he]");
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i];
      if (!im.hasAttribute("data-alt-en")) im.setAttribute("data-alt-en", im.getAttribute("alt") || "");
      im.setAttribute("alt", im.getAttribute(lang === "he" ? "data-alt-he" : "data-alt-en"));
    }
  }
  function applyLang(lang) {
    d.setAttribute("data-lang", lang);
    d.setAttribute("lang", lang);
    d.setAttribute("dir", lang === "he" ? "rtl" : "ltr");
    setAlts(lang);
    var b = document.getElementById("lang-toggle");
    if (b) b.setAttribute("aria-label", lang === "he" ? "Switch to English" : "עבור לעברית");
  }
  function applyTheme(t) {
    d.setAttribute("data-theme", t);
    var b = document.getElementById("theme-toggle");
    if (b) {
      b.setAttribute("aria-pressed", t === "dark" ? "true" : "false");
      b.setAttribute("aria-label", (d.getAttribute("data-lang") === "he") ? (t === "dark" ? "מעבר למצב בהיר" : "מעבר למצב כהה") : (t === "dark" ? "Switch to light mode" : "Switch to dark mode"));
    }
  }
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  applyLang(d.getAttribute("data-lang") || "en");
  applyTheme(d.getAttribute("data-theme") || "light");
  var lb = document.getElementById("lang-toggle");
  if (lb) lb.addEventListener("click", function () {
    var next = d.getAttribute("data-lang") === "he" ? "en" : "he";
    applyLang(next); applyTheme(d.getAttribute("data-theme")); store("fomo-lang", next);
  });
  var tb = document.getElementById("theme-toggle");
  if (tb) tb.addEventListener("click", function () {
    var next = d.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next); store("fomo-theme", next);
  });
})();
