(() => {
  const DEFAULT_ITEMS = [
    { id: "ic-vanilla", name: "香草雪糕", priceCny: 6.0, imageUrl: "", unit: "支" },
    { id: "ic-choco", name: "巧克力雪糕", priceCny: 8.5, imageUrl: "", unit: "支" },
    { id: "ic-matcha", name: "抹茶雪糕", priceCny: 9.9, imageUrl: "", unit: "支" },
    { id: "ic-strawberry", name: "草莓雪球", priceCny: 7.5, imageUrl: "", unit: "支" }
  ];

  function safeParse(text, fallback) {
    try { return JSON.parse(text); } catch { return fallback; }
  }

  async function requestPersistence() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        await navigator.storage.persist();
      }
    } catch {}
  }

  async function getOpfsRoot() {
    if (!navigator.storage || !navigator.storage.getDirectory) {
      throw new Error("此浏览器不支持 OPFS（建议使用最新版 Chromium 浏览器并通过 localhost 访问）");
    }
    await requestPersistence();
    return await navigator.storage.getDirectory();
  }

  async function ensureDataFile() {
    const root = await getOpfsRoot();
    const appDir = await root.getDirectoryHandle("icecream", { create: true });
    const fileHandle = await appDir.getFileHandle("items.json", { create: true });
    return fileHandle;
  }

  async function readItems() {
    const handle = await ensureDataFile();
    const file = await handle.getFile();
    const text = await file.text();
    const parsed = safeParse(text, null);
    if (!parsed || !Array.isArray(parsed.items)) {
      // 初始化为默认数据
      await writeItems(DEFAULT_ITEMS);
      return DEFAULT_ITEMS.slice();
    }
    return parsed.items;
  }

  async function writeItems(items) {
    const handle = await ensureDataFile();
    const writable = await handle.createWritable();
    const payload = JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), items }, null, 2);
    await writable.write(payload);
    await writable.close();
  }

  async function exportText() {
    const items = await readItems();
    const payload = JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), items }, null, 2);
    return payload;
  }

  async function importFromText(jsonText) {
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
    await writeItems(cleaned);
    return cleaned.length;
  }

  window.FileStore = {
    readItems,
    writeItems,
    exportText,
    importFromText,
  };
})();


