(() => {
  const store = window.IcecreamStore;

  function createElement(tag, className) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    return el;
  }

  function renderCatalog(items, quantities) {
    const container = document.getElementById("catalog");
    const tmpl = document.getElementById("card-template");
    container.innerHTML = "";
    const frag = document.createDocumentFragment();
    for (const item of items) {
      const node = tmpl.content.cloneNode(true);
      const card = node.querySelector(".card");
      const img = node.querySelector(".card-img");
      const title = node.querySelector(".card-title");
      const price = node.querySelector(".price");
      const minus = node.querySelector(".minus");
      const plus = node.querySelector(".plus");
      const input = node.querySelector(".qty-input");

      // 图片占位，保持原比例展示
      if (item.imageUrl) {
        img.src = item.imageUrl;
        img.alt = item.name;
      } else {
        const svg = encodeURIComponent(`
          <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 360' width='600' height='360'>
            <defs>
              <linearGradient id='g' x1='0' x2='1' y1='0' y2='1'>
                <stop offset='0%' stop-color='rgba(255,255,255,0.55)'/>
                <stop offset='100%' stop-color='rgba(255,255,255,0.2)'/>
              </linearGradient>
            </defs>
            <rect width='600' height='360' rx='28' ry='28' fill='url(#g)'/>
            <g fill='rgba(14,17,22,0.65)'>
              <circle cx='300' cy='150' r='68'/>
              <rect x='270' y='210' width='60' height='70' rx='12'/>
            </g>
          </svg>`);
        img.src = `data:image/svg+xml;charset=UTF-8,${svg}`;
        img.alt = `${item.name} 占位图`;
      }

      title.textContent = item.name;
      price.textContent = `${store.currencyCny(item.priceCny)} / ${item.unit || "件"}`;

      const q = Number(quantities[item.id] || 0);
      input.value = String(q);
      input.min = "0";
      input.step = "1";
      input.inputMode = "numeric";

      const commit = (next) => {
        const quantitiesNow = store.getQuantities();
        if (Number.isFinite(next) && next >= 0) quantitiesNow[item.id] = next; else delete quantitiesNow[item.id];
        store.saveQuantities(quantitiesNow);
        updateSummary();
      };

      minus.addEventListener("click", () => {
        const cur = Math.max(0, Number(input.value || 0) - 1);
        input.value = String(cur);
        commit(cur);
      });
      plus.addEventListener("click", () => {
        const cur = Math.max(0, Number(input.value || 0) + 1);
        input.value = String(cur);
        commit(cur);
      });
      input.addEventListener("change", () => {
        const cur = Math.max(0, Math.floor(Number(input.value || 0)));
        input.value = String(cur);
        commit(cur);
      });

      frag.appendChild(node);
    }
    container.appendChild(frag);
  }

  async function updateSummary() {
    const items = await store.getItems();
    const q = store.getQuantities();
    const listEl = document.getElementById("summary-list");
    const totalEl = document.getElementById("grand-total");
    listEl.innerHTML = "";

    const frag = document.createDocumentFragment();
    let total = 0;
    for (const item of items) {
      const qty = Number(q[item.id] || 0);
      if (qty <= 0) continue;
      const line = qty * item.priceCny;
      total += line;

      const row = createElement("div", "summary-item");
      const name = createElement("div"); name.textContent = `${item.name}`;
      const info = createElement("div", "muted"); info.textContent = `${qty} × ${store.currencyCny(item.priceCny)}`;
      const money = createElement("div"); money.textContent = store.currencyCny(line);
      row.appendChild(name); row.appendChild(info); row.appendChild(money);
      frag.appendChild(row);
    }
    listEl.appendChild(frag);
    totalEl.textContent = store.currencyCny(total);
  }

  function clearCart() {
    store.clearQuantities();
    // 同步 UI
    const inputs = document.querySelectorAll(".qty-input");
    inputs.forEach(i => i.value = "0");
    updateSummary();
  }

  async function boot() {
    try { await store.init(); } catch {}
    const items = await store.getItems();
    const quantities = store.getQuantities();
    renderCatalog(items, quantities);
    updateSummary();
    const clearBtn = document.getElementById("clear-cart");
    clearBtn.addEventListener("click", clearCart);
  }

  document.addEventListener("DOMContentLoaded", () => { boot(); });
})();


