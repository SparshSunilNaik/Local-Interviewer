(function () {
  var root = document.documentElement;
  document.getElementById("theme-btn").addEventListener("click", function () {
    var t = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", t);
    try { localStorage.setItem("li-site-theme", t); } catch (e) {}
  });
})();
