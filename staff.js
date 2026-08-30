/* polo staff rail: highlight current desk, switch ops.html panes */
(function () {
  function pane(name) {
    var tower = document.querySelector(".tower");
    if (tower) tower.setAttribute("data-pane", name || "ops");
  }
  var path = (location.pathname.split("/").pop() || "ops.html");
  if (path === "ops" || path === "") path = "ops.html";
  var hash = location.hash.replace("#", "");
  var key = "";
  if (path === "inventory.html") key = "inventory";
  else if (path === "ageing.html") key = "ageing";
  else if (path === "predict.html") key = "predict";
  else if (path === "po.html") key = hash === "orders" ? "order" : "po";
  else if (path === "dispatch.html") key = "dispatch";
  else if (path === "biker.html") key = "biker";
  else if (path === "invoice.html") key = "invoice";
  else if (path === "pickup.html") key = "pickup";
  else if (path === "recon.html") key = "recon";
  else if (path === "source.html") key = "source";
  else if (path === "hub.html" || path === "next.html") key = "hub";
  else if (path === "ops.html") {
    if (hash === "funnel" || hash === "gates" || hash === "studios") {
      key = hash;
      pane("reports");
    } else if (hash === "reports") {
      pane("reports");
    } else if (hash === "connectors") {
      key = "connectors";
      pane("ops");
    } else {
      pane("ops");
    }
  }
  if (key) {
    document.querySelectorAll('.rail-link[data-nav="' + key + '"]').forEach(function (a) {
      a.classList.add("on");
    });
  }
  document.querySelectorAll(".rail-h[data-pane]").forEach(function (h) {
    h.addEventListener("click", function () {
      pane(h.getAttribute("data-pane"));
    });
  });
  document.querySelectorAll(".rail-link[data-pane]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      if (path !== "ops.html") return;
      e.preventDefault();
      pane(a.getAttribute("data-pane"));
      var id = a.getAttribute("data-nav");
      var el = document.getElementById(id) || document.getElementById(id + "-desk") || document.getElementById("reports-" + id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      if (id) history.replaceState(null, "", "#" + id);
    });
  });
})();
