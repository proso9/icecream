(() => {
  const store = window.IcecreamStore;

  function $(sel) { return document.querySelector(sel); }

  function setCurrentFileName(name) {
    const el = document.getElementById("current-file");
    if (!el) return;
    el.textContent = name ? String(name) : "(未选择)";
  }

  function renderTable() {
    const wrap = $("#items-table");
    const tmpl = document.getElementById("item-row-template");
    const items = window.__items__ || [];
    wrap.innerHTML = "";
    const header = document.createElement("div");
    header.className = "table-row";
    header.setAttribute("role", "row");
    header.style.background = "rgba(255,255,255,.08)";
    header.innerHTML = `
      <div class="cell" role="columnheader">图片</div>
      <div class="cell" role="columnheader">名称</div>
      <div class="cell" role="columnheader">单价（CNY）</div>
      <div class="cell" role="columnheader">图片路径</div>
      <div class="cell" role="columnheader">操作</div>
    `;
    wrap.appendChild(header);

    const frag = document.createDocumentFragment();
    for (const it of items) {
      const node = tmpl.content.cloneNode(true);
      const row = node.querySelector(".table-row");
      const thumb = node.querySelector(".thumb");
      const name = node.querySelector(".name");
      const price = node.querySelector(".price");
      const image = node.querySelector(".image");
      const editBtn = node.querySelector('[data-action="edit"]');
      const delBtn = node.querySelector('[data-action="delete"]');

      if (it.imageUrl) thumb.src = it.imageUrl; else thumb.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='100%25' height='100%25' fill='rgba(255,255,255,0.2)'/%3E%3C/svg%3E";
      name.textContent = it.name;
      price.textContent = it.priceCny.toFixed(2);
      image.textContent = it.imageUrl || "(未设置)";

      editBtn.addEventListener("click", () => beginEdit(it));
      delBtn.addEventListener("click", () => {
        if (confirm(`确定删除【${it.name}】吗？`)) {
          store.deleteItem(it.id).then(() => {
            refreshItems();
          });
        }
      });

      frag.appendChild(node);
    }
    wrap.appendChild(frag);
  }

  function beginEdit(item) {
    $("#item-id").value = item.id;
    $("#item-name").value = item.name;
    $("#item-price").value = String(item.priceCny);
    $("#item-image").value = item.imageUrl || "";
    $("#item-name").focus();
  }

  function resetForm() {
    $("#item-id").value = "";
    $("#item-name").value = "";
    $("#item-price").value = "";
    $("#item-image").value = "";
  }

  function onSubmit(e) {
    e.preventDefault();
    const id = $("#item-id").value.trim();
    const name = $("#item-name").value.trim();
    const price = Number($("#item-price").value.trim() || 0);
    const imageUrl = $("#item-image").value.trim();
    if (!name) { alert("请输入名称"); return; }
    if (!(price >= 0)) { alert("请输入正确的价格"); return; }

    if (id) {
      store.updateItem({ id, name, priceCny: price, imageUrl }).then(() => refreshItems());
    } else {
      store.addItem({ name, priceCny: price, imageUrl }).then(() => refreshItems());
    }
    resetForm();
  }

  function onImportClick() { document.getElementById("import-file").click(); }
  function onImportChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const count = await store.importItemsFromText(String(reader.result || ""));
        await refreshItems();
        alert(`导入成功：${count} 条数据`);
      } catch (err) {
        alert((err && err.message) || "导入失败");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file, "utf-8");
  }

  async function onExport() {
    const text = await store.exportItems();
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `icecream-items-${Date.now()}.json`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  async function onChooseFile() {
    try {
      const name = await store.chooseDataFile();
      setCurrentFileName(name);
      await refreshItems();
      alert("已选择数据文件");
    } catch (err) {
      alert(err && err.message ? err.message : "选择数据文件失败");
    }
  }

  async function onCreateFile() {
    try {
      const name = await store.createDataFile();
      setCurrentFileName(name);
      await refreshItems();
      alert("已创建数据文件");
    } catch (err) {
      alert(err && err.message ? err.message : "创建数据文件失败");
    }
  }

  async function refreshItems() {
    window.__items__ = await store.getItems();
    renderTable();
  }

  async function boot() {
    try { await store.init(); } catch {}
    setCurrentFileName(store.getCurrentFileName());
    await refreshItems();
    document.getElementById("item-form").addEventListener("submit", onSubmit);
    document.getElementById("reset-form").addEventListener("click", resetForm);
    document.getElementById("import-btn").addEventListener("click", onImportClick);
    document.getElementById("export-btn").addEventListener("click", onExport);
    document.getElementById("import-file").addEventListener("change", onImportChange);
    const chooseBtn = document.getElementById("choose-file");
    const createBtn = document.getElementById("create-file");
    if (chooseBtn) chooseBtn.addEventListener("click", onChooseFile);
    if (createBtn) createBtn.addEventListener("click", onCreateFile);
  }

  document.addEventListener("DOMContentLoaded", () => { boot(); });
})();


