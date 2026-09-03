/* 2 Para desk access is open temporarily. Keep token forwarding for the future login screen. */
(function () {
  var token = sessionStorage.getItem("niaOpsToken") || "";
  var rawFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var request = init ? Object.assign({}, init) : {};
    var url = typeof input === "string" ? input : (input && input.url) || "";
    var sameOrigin = !/^https?:/i.test(url) || url.indexOf(location.origin) === 0;
    if (token && sameOrigin && (/^\/api\//.test(url) || /^\/v1\/staff\//.test(url))) {
      var headers = new Headers((request && request.headers) || (input && input.headers) || {});
      headers.set("Authorization", "Bearer " + token);
      request.headers = headers;
    }
    return rawFetch(input, request);
  };
  window.NIA_STAFF_READY = Promise.resolve({ id: "stf-open-desk", name: "2 Para desk", role: "open" });
})();

/* Every staff table can be sorted by any column, including tables rendered after API calls. */
(function () {
  var collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

  function cellValue(row, index) {
    var cell = row.cells[index];
    if (!cell) return { empty: true, value: "" };
    var raw = (cell.getAttribute("data-sort-value") || cell.textContent || "").trim();
    if (!raw) return { empty: true, value: "" };
    var number = raw.replace(/[₹,$%\s]/g, "");
    var negative = /^\([\d.]+\)$/.test(number);
    if (negative) number = "-" + number.slice(1, -1);
    if (/^-?\d+(?:\.\d+)?$/.test(number)) {
      return { empty: false, type: "number", value: Number(number) };
    }
    if (/^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/.test(raw)) {
      var time = Date.parse(raw);
      if (!Number.isNaN(time)) return { empty: false, type: "number", value: time };
    }
    return { empty: false, type: "text", value: raw };
  }

  function compareRows(a, b, index, direction) {
    var av = cellValue(a.row, index);
    var bv = cellValue(b.row, index);
    if (av.empty !== bv.empty) return av.empty ? 1 : -1;
    var result;
    if (av.type === "number" && bv.type === "number") result = av.value - bv.value;
    else result = collator.compare(String(av.value), String(bv.value));
    return result ? result * direction : a.order - b.order;
  }

  function sortTable(table, header, index) {
    var next = header.getAttribute("aria-sort") === "ascending" ? "descending" : "ascending";
    table.querySelectorAll("thead th[aria-sort]").forEach(function (th) {
      th.setAttribute("aria-sort", th === header ? next : "none");
      var button = th.querySelector(".table-sort-button");
      if (button) {
        var label = (button.getAttribute("data-label") || button.textContent || "Column").trim();
        button.setAttribute("aria-label", "Sort by " + label + (th === header ? ", " + next : ""));
      }
    });
    var direction = next === "ascending" ? 1 : -1;
    table.querySelectorAll("tbody").forEach(function (body) {
      var rows = Array.from(body.rows).map(function (row, order) { return { row: row, order: order }; });
      rows.sort(function (a, b) { return compareRows(a, b, index, direction); });
      rows.forEach(function (item) { body.appendChild(item.row); });
    });
  }

  function enhanceTable(table) {
    if (!table || table.getAttribute("data-sortable") === "true") return;
    var headers = table.querySelectorAll("thead th");
    if (!headers.length) return;
    table.setAttribute("data-sortable", "true");
    headers.forEach(function (header, index) {
      var label = (header.textContent || "Column").trim();
      var button = document.createElement("button");
      button.type = "button";
      button.className = "table-sort-button";
      button.setAttribute("data-label", label);
      button.setAttribute("aria-label", "Sort by " + label);
      while (header.firstChild) button.appendChild(header.firstChild);
      header.appendChild(button);
      header.scope = "col";
      header.setAttribute("aria-sort", "none");
      button.addEventListener("click", function () { sortTable(table, header, index); });
    });
  }

  function enhanceWithin(root) {
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.matches && root.matches("table")) enhanceTable(root);
    if (root.querySelectorAll) root.querySelectorAll("table").forEach(enhanceTable);
  }

  function start() {
    enhanceWithin(document);
    new MutationObserver(function (changes) {
      changes.forEach(function (change) {
        change.addedNodes.forEach(enhanceWithin);
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();

/* Polo staff rail: highlight current desk, switch ops.html panes. */
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
