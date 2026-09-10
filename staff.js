/* Resolve desk access before any operational request. */
(function () {
  var token = sessionStorage.getItem("niaOpsToken") || "";
  var rawFetch = window.fetch.bind(window);
  var ready;
  if (!document.getElementById('staff-entry-status')) sessionStorage.removeItem('niaStaffEntryRetry');
  function authenticate() {
    return rawFetch('/v1/staff/me', { headers: token ? { Authorization: 'Bearer ' + token } : {} }).then(function (response) {
      if (response.ok) return response.json().then(function (body) { return body.staff; });
      if (response.status !== 401) throw new Error('Desk access is unavailable. Please reload and try again.');
      token = ''; sessionStorage.removeItem('niaOpsToken');
      return new Promise(function (resolve) {
        var dialog = document.createElement('dialog');
        dialog.className = 'staff-signin';
        dialog.setAttribute('aria-labelledby', 'staff-signin-title');
        dialog.innerHTML = '<form><h1 id="staff-signin-title">Sign in to your desk</h1><p>Use your Nia email and operator password.</p><label for="staff-email">Nia email</label><input id="staff-email" name="email" type="email" autocomplete="username" required><label for="staff-password">Operator password</label><input id="staff-password" name="password" type="password" autocomplete="current-password" required><p role="status" class="staff-signin-status"></p><button type="submit">Continue</button></form>';
        dialog.addEventListener('cancel', function (event) { event.preventDefault(); });
        document.body.appendChild(dialog); dialog.showModal();
        dialog.querySelector('form').onsubmit = async function (event) {
          event.preventDefault();
          var button = dialog.querySelector('button');
          var status = dialog.querySelector('[role="status"]');
          button.disabled = true; status.textContent = 'Signing in…';
          try {
            var response = await rawFetch('/v1/staff/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: dialog.querySelector('[name="email"]').value, password: dialog.querySelector('[name="password"]').value }) });
            if (!response.ok) throw new Error(response.status === 401 ? 'Email or password is incorrect.' : 'Sign-in is unavailable. Please try again.');
            var result = await response.json();
            token = result.token; sessionStorage.setItem('niaOpsToken', token);
            dialog.querySelector('[name="password"]').value = '';
            dialog.close(); dialog.remove(); resolve(result.staff);
          } catch (error) { status.textContent = error.message; button.disabled = false; }
        };
      });
    });
  }
  ready = authenticate();
  window.NIA_STAFF_READY = ready;
  window.fetch = async function (input, init) {
    var url = new URL(typeof input === 'string' ? input : input.url, location.href);
    var deskRequest = url.origin === location.origin && (/^\/api\//.test(url.pathname) || /^\/v1\/staff\//.test(url.pathname));
    if (!deskRequest) return rawFetch(input, init);
    await ready;
    var request = Object.assign({}, init || {});
    var headers = new Headers(request.headers || (input && input.headers) || {});
    if (token) headers.set('Authorization', 'Bearer ' + token);
    request.headers = headers;
    var response = await rawFetch(input, request);
    if (response.status === 401 && token) {
      token = ''; sessionStorage.removeItem('niaOpsToken');
      ready = authenticate(); window.NIA_STAFF_READY = ready;
      // Do not replay a write: retain the form and let the operator submit again.
    }
    return response;
  };
})();

/* Keep every staff desk connected to the Rafiqi command center. Use Sikh, Jat, Dogra and Assam Unit names; technical routes remain stable. */
(function () {
  var commandCenterUrl = "https://rafiqicentral.com/2para";

  function makeLink() {
    var link = document.createElement("a");
    link.className = "command-center-return";
    link.href = commandCenterUrl;
    link.textContent = "← Nia Command Center";
    link.setAttribute("aria-label", "Back to Nia Command Center");
    return link;
  }

  function addReturnLinks() {
    var desktopMark = document.querySelector(".tower .top .mark");
    if (desktopMark && !desktopMark.querySelector(".command-center-return")) {
      desktopMark.appendChild(makeLink());
    }
    var narrowCard = document.querySelector(".narrow-card");
    if (narrowCard && !narrowCard.querySelector(".command-center-return")) {
      narrowCard.appendChild(makeLink());
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addReturnLinks);
  else addReturnLinks();
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

/* Sikh Unit staff rail: highlight current desk and switch ops.html panes. */
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
