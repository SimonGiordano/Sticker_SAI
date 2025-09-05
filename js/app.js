/* js/app.js - buscador único, contacto y preview de imagen */

const MANIFEST_PATH = "stickers/manifest.json";
const STICKERS_PATH = "stickers/";
const CONFIG_PATH = "config.json";

// DOM
const gallery = document.getElementById("gallery");
const searchInput = document.getElementById("search"); // único buscador (topbar)
const onlySelected = document.getElementById("onlySelected");

// Carrito
const cartBtn = document.getElementById("cartBtn");
const cartCountEl = document.getElementById("cartCount");
const cartModal = document.getElementById("cartModal");
const cartItemsEl = document.getElementById("cartItems");
const closeCart = document.getElementById("closeCart");
const clearCartBtn = document.getElementById("clearCart");
const checkoutBtn = document.getElementById("checkoutBtn");
const cartSummary = document.getElementById("cartSummary");

// Categorías
const categoriesContainer = document.getElementById("categoriesContainer");

// Contacto
const contactBtn = document.getElementById("contactBtn");
const contactModal = document.getElementById("contactModal");
const closeContact = document.getElementById("closeContact");
const contactMessageEl = document.getElementById("contactMessage");
const contactSend = document.getElementById("contactSend");
const contactClear = document.getElementById("contactClear");

// Preview imagen
const previewModal = document.getElementById("previewModal");
const closePreview = document.getElementById("closePreview");
const previewImg = document.getElementById("previewImg");
const previewName = document.getElementById("previewName");

// Estado
let manifestData = null; // { all: [...], byCategory: [...] }
let stickers = [];       // lista actual a renderizar
let cart = loadCart();
let WHATSAPP_NUMBER = "";
let selectedCategory = null; // null = todas

/* Utils */
function loadCart(){
  try{
    const s = localStorage.getItem("sai_cart");
    return s ? JSON.parse(s) : {};
  }catch(e){
    return {};
  }
}
function saveCart(){
  try{ localStorage.setItem("sai_cart", JSON.stringify(cart)); }catch(e){}
  updateCartCount();
}
function updateCartCount(){
  const total = Object.values(cart).reduce((a,b)=>a+(b.qty||0),0);
  cartCountEl.textContent = total;
}
function stripExtension(name){
  return String(name).replace(/\.[^/.]+$/, "");
}

/* Config */
async function fetchConfig(){
  try{
    const r = await fetch(CONFIG_PATH, { cache: "no-cache" });
    if(!r.ok) throw new Error("no config");
    const cfg = await r.json();
    WHATSAPP_NUMBER = (cfg.whatsapp || "").trim();
  }catch(e){
    WHATSAPP_NUMBER = "";
    console.warn("No se pudo cargar config.json");
  }
}

/* Normalizadores y orden */
function normalizeItemFromPath(pathOrName){
  const path = String(pathOrName).replace(/^\.\//, "");
  const parts = path.split("/");
  const file = parts[parts.length - 1];
  const name = stripExtension(file);
  const category = parts.length > 1 ? parts[0] : "General";
  return { name, path, category };
}
function normalizeObjectItem(obj){
  const path = obj.path || obj.rel || obj.name || "";
  const parts = String(path).split("/");
  const fileFromPath = parts[parts.length - 1] || "";
  let name = "";
  if(obj.name && typeof obj.name === "string"){
    name = stripExtension(obj.name);
  } else {
    name = stripExtension(fileFromPath);
  }
  const category = obj.category || (parts.length > 1 ? parts[0] : "General");
  return { name, path: String(path), category };
}
function sortByName(a,b){
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
}
function sortByCategoryThenName(a,b){
  if(a.category < b.category) return -1;
  if(a.category > b.category) return 1;
  return sortByName(a,b);
}

/* Carga de manifest con soporte a formato viejo y nuevo */
async function loadManifest(){
  try{
    const r = await fetch(MANIFEST_PATH, { cache: "no-cache" });
    if(r.ok){
      const data = await r.json();

      // Formato nuevo { all, byCategory }
      if(data && typeof data === "object" && (data.all || data.byCategory)){
        const normAll = Array.isArray(data.all) ? data.all.map(item =>
          (typeof item === "string") ? normalizeItemFromPath(item) : normalizeObjectItem(item)
        ) : [];
        const normByCat = Array.isArray(data.byCategory) ? data.byCategory.map(item =>
          (typeof item === "string") ? normalizeItemFromPath(item) : normalizeObjectItem(item)
        ) : [];
        manifestData = {
          all: normAll.slice().sort(sortByName),
          byCategory: normByCat.slice().sort(sortByCategoryThenName)
        };
        stickers = manifestData.all.slice();
        buildCategoriesAndRender();
        return;
      }

      // Formato viejo: array
      if(Array.isArray(data)){
        let items = [];
        if(data.length === 0){
          items = [];
        } else if(typeof data[0] === "string"){
          items = data.map(p => normalizeItemFromPath(p));
        } else {
          items = data.map(o => normalizeObjectItem(o));
        }
        const allSorted = items.slice().sort(sortByName);
        const byCategorySorted = items.slice().sort(sortByCategoryThenName);
        manifestData = { all: allSorted, byCategory: byCategorySorted };
        stickers = manifestData.all.slice();
        buildCategoriesAndRender();
        return;
      }
    }
  }catch(e){
    console.warn("Error leyendo manifest:", e);
  }

  // Fallback GitHub API (si repo público y body data-attrs seteados)
  try{
    const owner = document.body.dataset.ghOwner || "";
    const repo = document.body.dataset.ghRepo || "";
    if(owner && repo){
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/stickers`;
      const r2 = await fetch(apiUrl);
      if(r2.ok){
        const data = await r2.json();
        const items = data
          .filter(f => f.type === "file" && /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name))
          .map(f => ({ name: stripExtension(f.name), path: f.name, category: "General" }));
        const allSorted = items.slice().sort(sortByName);
        const byCategorySorted = items.slice().sort(sortByCategoryThenName);
        manifestData = { all: allSorted, byCategory: byCategorySorted };
        stickers = manifestData.all.slice();
        buildCategoriesAndRender();
        return;
      }
    }
  }catch(e){
    console.warn("GitHub API fallback:", e);
  }

  gallery.innerHTML = `<div class="error">No se encontró stickers/manifest.json ni el fallback. Generá el manifest o usá el workflow.</div>`;
}

/* UI de categorías */
function buildCategoriesAndRender(){
  const listForCounts = (manifestData && manifestData.byCategory) ? manifestData.byCategory : stickers;
  const map = new Map();
  for(const s of listForCounts){
    const cat = s.category || "General";
    map.set(cat, (map.get(cat) || 0) + 1);
  }
  const cats = Array.from(map.keys()).sort((a,b)=> a.localeCompare(b));
  renderCategories(cats, map);
  renderGallery();
}
function renderCategories(cats, countsMap){
  categoriesContainer.innerHTML = "";

  const allCount = (manifestData && Array.isArray(manifestData.all)) ? manifestData.all.length : stickers.length;
  const allPill = document.createElement("div");
  allPill.className = "category-pill" + (selectedCategory === null ? " active" : "");
  allPill.textContent = `Todas (${allCount})`;
  allPill.addEventListener("click", ()=> {
    selectedCategory = null;
    stickers = (manifestData && manifestData.all) ? manifestData.all.slice() : stickers;
    renderCategories(cats, countsMap);
    renderGallery();
  });
  categoriesContainer.appendChild(allPill);

  for(const c of cats){
    const pill = document.createElement("div");
    pill.className = "category-pill" + (selectedCategory === c ? " active" : "");
    pill.textContent = `${c} (${countsMap.get(c) || 0})`;
    pill.addEventListener("click", ()=> {
      selectedCategory = c;
      stickers = (manifestData && manifestData.byCategory) ? manifestData.byCategory.slice() : stickers;
      renderCategories(cats, countsMap);
      renderGallery();
    });
    categoriesContainer.appendChild(pill);
  }
}

/* Gallery */
function createCard(sticker){
  const filename = sticker.name; // ya sin extensión
  const fig = document.createElement("div");
  fig.className = "card";
  fig.dataset.filename = filename;
  fig.dataset.path = sticker.path;
  fig.dataset.category = sticker.category;

  const thumb = document.createElement("div");
  thumb.className = "thumb";
  const img = document.createElement("img");
  img.src = STICKERS_PATH + sticker.path;
  img.alt = filename;
  img.loading = "lazy";

  // abrir modal de preview al click
  img.addEventListener("click", () => openPreview(sticker));

  thumb.appendChild(img);

  const name = document.createElement("div");
  name.className = "filename";
  name.textContent = filename; // filename ya viene sin .png

  const actions = document.createElement("div");
  actions.className = "actions";

  const addBtn = document.createElement("button");
  addBtn.className = "add-btn";
  addBtn.textContent = "Agregar";
  addBtn.addEventListener("click", ()=> addToCart(filename));

  const removeBtn = document.createElement("button");
  removeBtn.className = "remove-btn";
  removeBtn.textContent = "-";
  removeBtn.title = "Quitar 1";
  removeBtn.addEventListener("click", (e)=>{
    e.stopPropagation();
    changeQty(filename, -1);
    updateCardBadges();
  });

  const qtyBadge = document.createElement("span");
  qtyBadge.className = "qty-badge";
  const currentQty = cart[filename] ? cart[filename].qty : 0;
  qtyBadge.textContent = currentQty;

  actions.appendChild(addBtn);
  actions.appendChild(removeBtn);
  actions.appendChild(qtyBadge);

  fig.appendChild(thumb);
  fig.appendChild(name);
  fig.appendChild(actions);

  return fig;
}

function renderGallery(){
  const q = (searchInput?.value||"").trim().toLowerCase();
  gallery.innerHTML = "";

  const filtered = stickers.filter(s=>{
    if(selectedCategory && s.category !== selectedCategory) return false;
    const lowerName = String(s.name).toLowerCase();
    if(q && !lowerName.includes(q)) return false;
    if(onlySelected?.checked && !cart[s.name]) return false;
    return true;
  });

  if(filtered.length === 0){
    gallery.innerHTML = `<div style="padding:18px;color:#163536">No se encontraron stickers.</div>`;
    return;
  }

  for(const s of filtered){
    const card = createCard(s);
    gallery.appendChild(card);
  }
  updateCardBadges();
}

function updateCardBadges(){
  const badges = document.querySelectorAll(".qty-badge");
  badges.forEach(b=>{
    const card = b.closest(".card");
    if(!card) return;
    const fname = card.dataset.filename;
    b.textContent = cart[fname] ? cart[fname].qty : 0;
    const addBtn = card.querySelector(".add-btn");
    if(addBtn){
      const q = cart[fname] ? cart[fname].qty : 0;
      addBtn.textContent = q > 0 ? `Agregar (+)` : `Agregar`;
    }
  });
}

/* Preview */
function openPreview(sticker){
  if(!previewModal) return;
  previewImg.src = STICKERS_PATH + sticker.path;
  previewImg.alt = sticker.name;
  previewName.textContent = sticker.name; // sin extensión
  previewModal.classList.remove("hidden");
  previewModal.setAttribute("aria-hidden","false");
}
function closePreviewModal(){
  if(!previewModal) return;
  previewModal.classList.add("hidden");
  previewModal.setAttribute("aria-hidden","true");
}

/* Carrito */
function addToCart(filename){
  if(cart[filename]) cart[filename].qty++;
  else cart[filename] = { name: filename, qty: 1 };
  saveCart();
  updateCardBadges();
}
function removeFromCart(filename){
  delete cart[filename];
  saveCart();
  renderCart();
}
function changeQty(filename, delta){
  if(!cart[filename]){
    if(delta > 0) cart[filename] = { name: filename, qty: delta };
    else return;
  } else {
    cart[filename].qty += delta;
  }
  if(cart[filename] && cart[filename].qty <= 0) delete cart[filename];
  saveCart();
  renderCart();
}
function renderCart(){
  cartItemsEl.innerHTML = "";
  const keys = Object.keys(cart);
  if(keys.length === 0){
    cartItemsEl.innerHTML = "<div style='padding:12px;color:#dff'>No hay productos en el carrito.</div>";
    cartSummary.textContent = "";
    updateCardBadges();
    updateCartCount();
    return;
  }
  let totalItems = 0;
  for(const k of keys){
    const item = cart[k];
    totalItems += item.qty;
    const row = document.createElement("div");
    row.className = "cart-item";

    const im = document.createElement("img");
    // buscar path en manifestData.all
    const sObj = (manifestData && manifestData.all) ? manifestData.all.find(s => s.name === item.name) : null;
    const imgPath = sObj ? sObj.path : `${item.name}.png`; // fallback
    im.src = STICKERS_PATH + imgPath;
    im.alt = item.name;

    const meta = document.createElement("div");
    meta.className = "meta";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = item.name; // sin extensión
    const qty = document.createElement("div");
    qty.className = "qty";
    qty.textContent = `Cantidad: ${item.qty}`;
    meta.appendChild(name);
    meta.appendChild(qty);

    const controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.gap = "6px";
    const plus = document.createElement("button");
    plus.textContent = "+";
    plus.addEventListener("click", ()=> changeQty(item.name, 1));
    const minus = document.createElement("button");
    minus.textContent = "-";
    minus.addEventListener("click", ()=> changeQty(item.name, -1));
    const del = document.createElement("button");
    del.textContent = "Eliminar";
    del.addEventListener("click", ()=> removeFromCart(item.name));

    controls.appendChild(plus);
    controls.appendChild(minus);
    controls.appendChild(del);

    row.appendChild(im);
    row.appendChild(meta);
    row.appendChild(controls);
    cartItemsEl.appendChild(row);
  }
  cartSummary.textContent = `Total de artículos: ${totalItems}`;
  updateCardBadges();
  updateCartCount();
}

/* Modales & checkout */
function openCart(){ renderCart(); cartModal.classList.remove("hidden"); cartModal.setAttribute("aria-hidden","false"); }
function closeCartModal(){ cartModal.classList.add("hidden"); cartModal.setAttribute("aria-hidden","true"); }
function clearCart(){ cart = {}; saveCart(); renderCart(); closeCartModal(); }

function checkout(){
  const items = Object.values(cart).map(i => `${i.name} x${i.qty}`);
  if(items.length === 0){ alert("El carrito está vacío."); return; }
  if(!WHATSAPP_NUMBER){ alert("No hay número de WhatsApp configurado. Edita config.json en el repo."); return; }
  const message = `Hola! Quiero comprar los siguientes stickers: ${items.join(", ")}`;
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}

/* Contacto */
function openContact(){
  if(!contactModal) return;
  contactMessageEl.value = "";
  contactModal.classList.remove("hidden");
  contactModal.setAttribute("aria-hidden","false");
}
function closeContactModal(){
  if(!contactModal) return;
  contactModal.classList.add("hidden");
  contactModal.setAttribute("aria-hidden","true");
}
function sendContact(){
  const text = (contactMessageEl.value || "").trim();
  if(!WHATSAPP_NUMBER){
    alert("No hay número de WhatsApp configurado. Edita config.json en el repo.");
    return;
  }
  const prefix = "Hola, vengo para consultarte: ";
  const message = prefix + text;
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}

/* Eventos */
searchInput?.addEventListener("input", ()=> renderGallery());
onlySelected?.addEventListener("change", ()=> renderGallery());

cartBtn?.addEventListener("click", ()=> openCart());
closeCart?.addEventListener("click", ()=> closeCartModal());
clearCartBtn?.addEventListener("click", ()=> {
  if(confirm("Vaciar el carrito?")) clearCart();
});
checkoutBtn?.addEventListener("click", ()=> checkout());

// Contacto
contactBtn?.addEventListener("click", openContact);
closeContact?.addEventListener("click", closeContactModal);
contactClear?.addEventListener("click", closeContactModal);
contactSend?.addEventListener("click", sendContact);

// Preview
closePreview?.addEventListener("click", closePreviewModal);
// Cerrar preview al click en backdrop
previewModal?.addEventListener("click", (e)=>{
  if(e.target === previewModal) closePreviewModal();
});
// Cerrar modales con ESC
document.addEventListener("keydown", (e)=>{
  if(e.key === "Escape"){
    if(!cartModal.classList.contains("hidden")) closeCartModal();
    if(previewModal && !previewModal.classList.contains("hidden")) closePreviewModal();
    if(contactModal && !contactModal.classList.contains("hidden")) closeContactModal();
  }
});

/* init */
(async function init(){
  await fetchConfig();
  await loadManifest();
  updateCartCount();
})();
