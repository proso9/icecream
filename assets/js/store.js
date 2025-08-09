(() => {
  const STORAGE_KEYS = {
    items: "icecream_items",
    quantities: "icecream_cart_quantities"
  };

  const defaultItems = [
    {
      id: "ic-vanilla",
      name: "香草雪糕",
      priceCny: 6.0,
      imageUrl: "",
      unit: "支"
    },
    {
      id: "ic-choco",
      name: "巧克力雪糕",
      priceCny: 8.5,
      imageUrl: "",
      unit: "支"
    },
    {
      id: "ic-matcha",
      name: "抹茶雪糕",
      priceCny: 9.9,
      imageUrl: "",
      unit: "支"
    },
    {
      id: "ic-strawberry",
      name: "草莓雪球",
      priceCny: 7.5,
      imageUrl: "",
      unit: "支"
    }
  ];

  function safeParse(jsonText, fallback) {
    try { return JSON.parse(jsonText); } catch { return fallback; }
  }

  function getItems() {
    const text = localStorage.getItem(STORAGE_KEYS.items);
    const items = safeParse(text, null);
    if (!Array.isArray(items) || items.length === 0) {
      localStorage.setItem(STORAGE_KEYS.items, JSON.stringify(defaultItems));
      return defaultItems.slice();
    }
    return items;
  }

  function saveItems(items) {
    if (!Array.isArray(items)) return;
    localStorage.setItem(STORAGE_KEYS.items, JSON.stringify(items));
  }

  function getQuantities() {
    const text = localStorage.getItem(STORAGE_KEYS.quantities);
    const q = safeParse(text, {});
    return q && typeof q === "object" ? q : {};
  }

  function saveQuantities(quantities) {
    localStorage.setItem(STORAGE_KEYS.quantities, JSON.stringify(quantities || {}));
  }

  function clearQuantities() { saveQuantities({}); }

  function addItem(item) {
    const items = getItems();
    const id = item.id || `ic-${Date.now().toString(36)}`;
    const clean = {
      id,
      name: String(item.name || "未命名"),
      priceCny: Math.max(0, Number(item.priceCny || 0)),
      imageUrl: String(item.imageUrl || ""),
      unit: String(item.unit || "支")
    };
    items.push(clean);
    saveItems(items);
    return clean;
  }

  function updateItem(updated) {
    const items = getItems();
    const idx = items.findIndex(x => x.id === updated.id);
    if (idx === -1) return false;
    items[idx] = {
      ...items[idx],
      name: String(updated.name ?? items[idx].name),
      priceCny: Math.max(0, Number(updated.priceCny ?? items[idx].priceCny)),
      imageUrl: String(updated.imageUrl ?? items[idx].imageUrl),
      unit: String(updated.unit ?? items[idx].unit)
    };
    saveItems(items);
    return true;
  }

  function deleteItem(id) {
    const items = getItems();
    const next = items.filter(x => x.id !== id);
    saveItems(next);
    const q = getQuantities();
    if (q[id] != null) { delete q[id]; saveQuantities(q); }
  }

  function exportItems() {
    const data = { version: 1, generatedAt: new Date().toISOString(), items: getItems() };
    return JSON.stringify(data, null, 2);
  }

  function importItemsFromText(jsonText) {
    const data = safeParse(jsonText, null);
    if (!data) throw new Error("导入失败：JSON 无法解析");
    const arr = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : null);
    if (!arr) throw new Error("导入失败：未找到 items 数组");
    const cleaned = arr.map((x, i) => ({
      id: String(x.id || `ic-${Date.now().toString(36)}-${i}`),
      name: String(x.name || "未命名"),
      priceCny: Math.max(0, Number(x.priceCny || 0)),
      imageUrl: String(x.imageUrl || ""),
      unit: String(x.unit || "支")
    }));
    saveItems(cleaned);
    // 清空购物数量，避免旧 ID 残留
    clearQuantities();
    return cleaned.length;
  }

  function currencyCny(n) { return `CNY ${Number(n || 0).toFixed(2)}`; }

  window.IcecreamStore = {
    getItems,
    saveItems,
    addItem,
    updateItem,
    deleteItem,
    getQuantities,
    saveQuantities,
    clearQuantities,
    exportItems,
    importItemsFromText,
    currencyCny,
  };
})();


