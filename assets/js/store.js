(() => {
  const STORAGE_KEYS = {
    // 仅用于购物车数量；商品数据改为本地文件
    quantities: "icecream_cart_quantities"
  };

  const defaultItems = [
    { id: "ic-vanilla", name: "香草雪糕", priceCny: 6.0, imageUrl: "", unit: "支" },
    { id: "ic-choco", name: "巧克力雪糕", priceCny: 8.5, imageUrl: "", unit: "支" },
    { id: "ic-matcha", name: "抹茶雪糕", priceCny: 9.9, imageUrl: "", unit: "支" },
    { id: "ic-strawberry", name: "草莓雪球", priceCny: 7.5, imageUrl: "", unit: "支" }
  ];

  function safeParse(jsonText, fallback) {
    try { return JSON.parse(jsonText); } catch { return fallback; }
  }

  // ====== IndexedDB 极简封装：保存文件句柄（非数据本体） ======
  const IDB_DB_NAME = "icecream-db";
  const IDB_STORE_SETTINGS = "settings";
  const IDB_KEY_HANDLE = "dataFileHandle";

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE_SETTINGS)) {
          db.createObjectStore(IDB_STORE_SETTINGS);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("打开 IndexedDB 失败"));
    });
  }

  async function idbGet(storeName, key) {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const st = tx.objectStore(storeName);
        const req = st.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } finally { db.close(); }
  }

  async function idbSet(storeName, key, value) {
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const st = tx.objectStore(storeName);
        st.put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  }

  // ====== 文件系统访问 API 封装 ======
  /** @type {FileSystemFileHandle|null} */
  let fileHandle = null;
  /** @type {Array|null} */
  let itemsCache = null;

  function isFsSupported() {
    return !!(window.showOpenFilePicker && window.showSaveFilePicker);
  }

  async function ensurePermission(mode = "readwrite", handle = fileHandle) {
    if (!handle) return false;
    if (!handle.queryPermission || !handle.requestPermission) return true;
    const opts = { mode };
    const q = await handle.queryPermission(opts);
    if (q === "granted") return true;
    const r = await handle.requestPermission(opts);
    return r === "granted";
  }

  async function readItemsFromHandle(handle) {
    const file = await handle.getFile();
    const text = await file.text();
    const data = safeParse(text, null);
    const arr = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : null);
    if (!arr) throw new Error("文件格式不正确：未找到 items 数组");
    return arr.map((x, i) => ({
      id: String(x.id || `ic-${Date.now().toString(36)}-${i}`),
      name: String(x.name || "未命名"),
      priceCny: Math.max(0, Number(x.priceCny || 0)),
      imageUrl: String(x.imageUrl || ""),
      unit: String(x.unit || "支")
    }));
  }

  async function writeItemsToHandle(handle, items) {
    const payload = { version: 1, updatedAt: new Date().toISOString(), items: items || [] };
    const writable = await handle.createWritable();
    await writable.write(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }));
    await writable.close();
  }

  async function init() {
    // 若支持文件系统 API，尝试恢复上次选择的文件句柄
    if (isFsSupported()) {
      try {
        const stored = await idbGet(IDB_STORE_SETTINGS, IDB_KEY_HANDLE);
        if (stored) {
          fileHandle = stored; // FileSystemFileHandle 可被结构化克隆存入 IDB
          const ok = await ensurePermission("read");
          if (ok) {
            try {
              itemsCache = await readItemsFromHandle(fileHandle);
            } catch {
              // 无法读取时，保持默认缓存
              itemsCache = defaultItems.slice();
            }
          } else {
            itemsCache = defaultItems.slice();
          }
        } else {
          itemsCache = defaultItems.slice();
        }
      } catch {
        itemsCache = defaultItems.slice();
      }
    } else {
      // 不支持：退化为内存缓存（不使用 localStorage 持久化商品数据）
      itemsCache = defaultItems.slice();
    }
  }

  async function getItems() {
    if (!itemsCache) await init();
    return Array.isArray(itemsCache) ? itemsCache.slice() : [];
  }

  async function saveItems(items) {
    itemsCache = Array.isArray(items) ? items.slice() : [];
    if (fileHandle && isFsSupported()) {
      const ok = await ensurePermission("readwrite");
      if (!ok) throw new Error("没有写入权限");
      await writeItemsToHandle(fileHandle, itemsCache);
    }
  }

  async function chooseDataFile() {
    if (!isFsSupported()) throw new Error("当前浏览器不支持选择本地文件");
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [{ description: "JSON 文件", accept: { "application/json": [".json"] } }]
    });
    await ensurePermission("read", handle);
    fileHandle = handle;
    await idbSet(IDB_STORE_SETTINGS, IDB_KEY_HANDLE, fileHandle);
    itemsCache = await readItemsFromHandle(fileHandle);
    return getCurrentFileName();
  }

  async function createDataFile() {
    if (!isFsSupported()) throw new Error("当前浏览器不支持创建本地文件");
    const handle = await window.showSaveFilePicker({
      suggestedName: "icecream-items.json",
      types: [{ description: "JSON 文件", accept: { "application/json": [".json"] } }]
    });
    fileHandle = handle;
    await idbSet(IDB_STORE_SETTINGS, IDB_KEY_HANDLE, fileHandle);
    itemsCache = defaultItems.slice();
    await writeItemsToHandle(fileHandle, itemsCache);
    return getCurrentFileName();
  }

  function getCurrentFileName() {
    // 某些浏览器 fileHandle.name 可用
    return fileHandle && (fileHandle.name || "已选择数据文件");
  }

  // ====== CRUD（基于文件） ======
  async function addItem(item) {
    const items = await getItems();
    const id = item.id || `ic-${Date.now().toString(36)}`;
    const clean = {
      id,
      name: String(item.name || "未命名"),
      priceCny: Math.max(0, Number(item.priceCny || 0)),
      imageUrl: String(item.imageUrl || ""),
      unit: String(item.unit || "支")
    };
    items.push(clean);
    await saveItems(items);
    return clean;
  }

  async function updateItem(updated) {
    const items = await getItems();
    const idx = items.findIndex(x => x.id === updated.id);
    if (idx === -1) return false;
    items[idx] = {
      ...items[idx],
      name: String(updated.name ?? items[idx].name),
      priceCny: Math.max(0, Number(updated.priceCny ?? items[idx].priceCny)),
      imageUrl: String(updated.imageUrl ?? items[idx].imageUrl),
      unit: String(updated.unit ?? items[idx].unit)
    };
    await saveItems(items);
    return true;
  }

  async function deleteItem(id) {
    const items = await getItems();
    const next = items.filter(x => x.id !== id);
    await saveItems(next);
    const q = getQuantities();
    if (q[id] != null) { delete q[id]; saveQuantities(q); }
  }

  async function exportItems() {
    const data = { version: 1, generatedAt: new Date().toISOString(), items: await getItems() };
    return JSON.stringify(data, null, 2);
  }

  async function importItemsFromText(jsonText) {
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
    await saveItems(cleaned);
    // 清空购物数量，避免旧 ID 残留
    clearQuantities();
    return cleaned.length;
  }

  // ====== 购物车（仍使用 localStorage） ======
  function getQuantities() {
    const text = localStorage.getItem(STORAGE_KEYS.quantities);
    const q = safeParse(text, {});
    return q && typeof q === "object" ? q : {};
  }

  function saveQuantities(quantities) {
    localStorage.setItem(STORAGE_KEYS.quantities, JSON.stringify(quantities || {}));
  }

  function clearQuantities() { saveQuantities({}); }

  function currencyCny(n) { return `CNY ${Number(n || 0).toFixed(2)}`; }

  window.IcecreamStore = {
    // 初始化与文件操作
    init,
    chooseDataFile,
    createDataFile,
    getCurrentFileName,
    // 数据 CRUD
    getItems,
    saveItems,
    addItem,
    updateItem,
    deleteItem,
    exportItems,
    importItemsFromText,
    // 购物车
    getQuantities,
    saveQuantities,
    clearQuantities,
    // 工具
    currencyCny,
  };
})();


