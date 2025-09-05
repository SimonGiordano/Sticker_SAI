/* js/app.js - manifest robusto + carrito (size modal) + contacto + preview */

const MANIFEST_PATH = "stickers/manifest.json";
const STICKERS_PATH = "stickers/";
const CONFIG_PATH = "config.json";

/* DOM */
const gallery = document.getElementById("gallery");
const searchInput = document.getElementById("search");
const onlySelected = document.getElementById("onlySelected");

const cartBtn = document.getElementById("cartBtn");
const cartCountEl = document.getElementById("cartCount");
const cartModal = document.getElementById("cartModal");
const cartItemsEl = document.getElementById("cartItems");
const closeCart = document.getElementById("closeCart");
const clearCartBtn = document.getElementById("clearCart");
const checkoutBtn = document.getElementById("checkoutBtn");
const cartSummary = document.getElementById("cartSummary");

const categoriesContainer = document.getElementById("categoriesContainer");

/* contact */
const contactBtn = document.getElementById("contactBtn");
const contactModal = document.getElementById("contactModal");
const closeContact = document.getElementById("closeContact");
const contactMessageEl = document.getElementById("contactMessage");
const contactSend = document.getElementById("contactSend");
const contactClear = document.getElementById("contactClear");

/* preview */
const previewModal = document.getElementById("previewModal");
const closePreview = document.getElementById("closePreview");
const previewImg = document.getElementById("previewImg");
const previewName = document.getElementById("previewName");

/* size modal */
const sizeModal = document.getElementById("sizeModal");
const closeSizeModal = document.getElementById("closeSizeModal");
const sizeOptionEls = document.querySelectorAll(".size-option");
const specialSizeInput = document.getElementById("specialSizeInput");
const customSize = document.getElementById("customSize");
const confirmSizeBtn = document.getElementById("confirmSizeBtn");

/* Estado */
let manifestData = null; // { all:[], byCategory:[] }
let stickers = []; // lista mostrada (por defecto manifestData.all)
let cart = loadCart();
let WHATSAPP_NUMBER = "";
let selectedCategory = null; // null = todas
let pendingSticker = null;
let selectedSize = null;

/* UTIL */
function stripExt(s){ return String(s).replace(/\.[^/.]+$/, ""); }
function loadCart(){
  try{ const s = localStorage.getItem("sai_cart"); return s ? JSON.parse(s) : {}; }catch(e){ return {}; }
}
function saveCart(){ try{ localStorage.setItem("sai_cart", JSON.stringify(cart)); }catch(e){} updateCartCount(); }
function updateCartCount(){ const total = Object.values(cart).reduce((a,b)=>a+(b.qty||0),0); if(cartCountEl) cartCountEl.textContent = total; }

/* CONFIG */
async function fetchConfig(){
  try{
    const r = await fetch(CONFIG_PATH, { cache: "no-cache" });
    if(r.ok){ const cfg = await r.json(); WHATSAPP_NUMBER = (cfg.whatsapp||"").trim(); return; }
  }catch(e){}
  WHATSAPP_NUMBER = "";
}

/* NORMALIZAR MANIFEST */
function normalizeItemFromPath(pathOrName){
  const path = String(pathOrName).replace(/^\.\//,"");
  const parts = path.split("/");
  const file = parts[parts.length-1];
  const name = stripExt(file);
  const category = parts.length>1 ? parts[0] : "General";
  return { name, path, category };
}
function normalizeObjectItem(obj){
  const path = obj.path || obj.rel || obj.name || "";
  const parts = String(path).split("/");
  const file = parts[parts.length-1] || "";
  let name = "";
  if(obj.name && typeof obj.name === "string") name = stripExt(obj.name);
  else name = stripExt(file);
  const category = obj.category || (parts.length>1 ? parts[0] : "General");
  return { name, path: String(path), category };
}
function sortByName(a,b){ return a.name.localeCompare(b.name, undefined, { numeric:true, sensitivity:"base" }); }
function sortByCategoryThenName(a,b){
  if(a.category < b.category) return -1;
  if(a.category > b.category) return 1;
  return sortByName(a,b);
}

/* CARGAR MANIFEST */
async function loadManifest(){
  try{
    const r = await fetch(MANIFEST_PATH, { cache: "no-cache" });
    if(r.ok){
      const data = await r.json();
      if(data && typeof data === "object" && (data.all || data.byCategory)){
        const normAll = Array.isArray(data.all) ? data.all.map(i => (typeof i==="string") ? normalizeItemFromPath(i) : normalizeObjectItem(i)) : [];
        const normBy = Array.isArray(data.byCategory) ? data.byCategory.map(i => (typeof i==="string") ? normalizeItemFromPath(i) : normalizeObjectItem(i)) : [];
        manifestData = { all: normAll.slice().sort(sortByName), byCategory: normBy.slice().sort(sortByCategoryThenName) };
        stickers = manifestData.all.slice();
        buildCategoriesAndRender();
        return;
      }
      if(Array.isArray(data)){
        let items = [];
        if(data.length === 0) items = [];
        else if(typeof data[0] === "string") items = data.map(p => normalizeItemFromPath(p));
        else items = data.map(o => normalizeObjectItem(o));
        manifestData = { all: items.slice().sort(sortByName), byCategory: items.slice().sort(sortByCategoryThenName) };
        stickers = manifestData.all.slice();
        buildCategoriesAndRender();
        return;
      }
    }
  }catch(e){
    console.warn("manifest read err", e);
  }

  // fallback: show message
  if(gallery) gallery.innerHTML = `<div style="padding:18px;color:#163536">No se encontró stickers/manifest.json. Generá el manifest o usá el workflow.</div>`;
}

/* CATEGORÍAS */
function buildCategoriesAndRender(){
  const list = (manifestData && manifestData.byCategory) ? manifestData.byCategory : stickers;
  const map = new Map();
  for(const s of list){ const cat = s.category || "General"; map.set(cat, (map.get(cat)||0)+1); }
  const cats = Array.from(map.keys()).sort((a,b)=> a.localeCompare(b));
  renderCategories(cats, map);
  renderGallery();
}

function renderCategories(cats, countsMap){
  if(!categoriesContainer) return;
  categoriesContainer.innerHTML = "";
  const allPill = document.createElement("div");
  allPill.className = "category-pill" + (selectedCategory === null ? " active" : "");
  allPill.textContent = `Todas (${manifestData && Array.isArray(manifestData.all) ? manifestData.all.length : stickers.length})`;
  allPill.addEventListener("click", ()=> { selectedCategory = null; stickers = manifestData.all.slice(); renderCategories(cats, countsMap); renderGallery(); });
  categoriesContainer.appendChild(allPill);

  for(const c of cats){
    const pill = document.createElement("div");
    pill.className = "category-pill" + (selectedCategory === c ? " active" : "");
    pill.textContent = `${c} (${countsMap.get(c)||0})`;
    pill.addEventListener("click", ()=> { selectedCategory = c; // use byCategory but filter in renderGallery
      renderCategories(cats, countsMap); renderGallery(); });
    categoriesContainer.appendChild(pill);
  }
}

/* CARD + GALLERY */
function createCard(sticker){
  const filename = sticker.name; // sin extension
  const fig = document.createElement("div");
  fig.className = "card";
  fig.dataset.filename = filename;
  fig.dataset.path = sticker.path;
  fig.dataset.category = sticker.category;

  const thumb = document.createElement("div"); thumb.className = "thumb";
  const img = document.createElement("img");
  img.src = STICKERS_PATH + sticker.path;
  img.alt = filename;
  img.loading = "lazy";
  img.addEventListener("click", ()=> openPreview(sticker));
  thumb.appendChild(img);

  const name = document.createElement("div"); name.className = "filename"; name.textContent = filename;

  const actions = document.createElement("div"); actions.className = "actions";
  const addBtn = document.createElement("button"); addBtn.className = "add-btn"; addBtn.textContent = "Agregar";
  addBtn.addEventListener("click", ()=> openSizeModal(sticker));
  const qtyBadge = document.createElement("span"); qtyBadge.className = "qty-badge"; qtyBadge.textContent = cartQtyForName(filename);

  actions.appendChild(addBtn);
  actions.appendChild(qtyBadge);

  fig.appendChild(thumb);
  fig.appendChild(name);
  fig.appendChild(actions);
  return fig;
}

function cartQtyForName(name){
  return Object.values(cart).filter(i=> i.name === name).reduce((s,it)=> s+it.qty, 0);
}

function renderGallery(){
  if(!gallery) return;
  const q = (searchInput?.value || "").trim().toLowerCase();
  gallery.innerHTML = "";

  // choose list depending on selectedCategory
  let list = [];
  if(selectedCategory === null) list = (manifestData && manifestData.all) ? manifestData.all : stickers;
  else list = (manifestData && manifestData.byCategory) ? manifestData.byCategory.filter(s => s.category === selectedCategory) : stickers.filter(s => s.category === selectedCategory);

  const filtered = list.filter(s=>{
    if(q && !(s.name.toLowerCase().includes(q) || s.path.toLowerCase().includes(q))) return false;
    if(onlySelected?.checked && !cartHasAnyForName(s.name)) return false;
    return true;
  });

  if(filtered.length === 0){
    gallery.innerHTML = `<div style="padding:18px;color:#163536">No se encontraron stickers.</div>`;
    return;
  }
  for(const s of filtered) gallery.appendChild(createCard(s));
  updateCardBadges();
}

function cartHasAnyForName(name){
  return Object.values(cart).some(i => i.name === name);
}

function updateCardBadges(){
  document.querySelectorAll(".card").forEach(card=>{
    const fn = card.dataset.filename;
    const badge = card.querySelector(".qty-badge");
    if(badge) badge.textContent = cartQtyForName(fn);
  });
}

/* CART: la clave combina path + size para permitir duplicados del mismo sticker con distinta medida */
function addToCartObj(stickerObj, size){
  const key = `${stickerObj.path}|||${size}`;
  if(cart[key]) cart[key].qty++;
  else cart[key] = { name: stickerObj.name, path: stickerObj.path, size, qty: 1 };
  saveCart();
  renderCart();
  updateCardBadges();
}

/* RENDER CART */
function renderCart(){
  if(!cartItemsEl) return;
  cartItemsEl.innerHTML = "";
  const keys = Object.keys(cart);
  if(keys.length === 0){
    cartItemsEl.innerHTML = "<div style='padding:12px;color:#dff'>No hay productos en el carrito.</div>";
    cartSummary.textContent = "";
    updateCartCount();
    updateCardBadges();
    return;
  }
  let totalItems = 0;
  for(const k of keys){
    const item = cart[k];
    totalItems += item.qty;
    const row = document.createElement("div");
    row.className = "cart-item";

    const im = document.createElement("img");
    im.src = STICKERS_PATH + item.path;
    im.alt = item.name;

    const meta = document.createElement("div"); meta.className = "meta";
    const nm = document.createElement("div"); nm.className = "name"; nm.textContent = `${item.name} (${item.size})`;
    const qdiv = document.createElement("div"); qdiv.className = "qty"; qdiv.textContent = `Cantidad: ${item.qty}`;
    meta.appendChild(nm); meta.appendChild(qdiv);

    const controls = document.createElement("div"); controls.style.display="flex"; controls.style.gap="6px";
    const plus = document.createElement("button"); plus.textContent = "+"; plus.addEventListener("click", ()=> changeQty(k,1));
    const minus = document.createElement("button"); minus.textContent = "-"; minus.addEventListener("click", ()=> changeQty(k,-1));
    const del = document.createElement("button"); del.textContent = "Eliminar"; del.addEventListener("click", ()=> removeCartKey(k));
    controls.appendChild(plus); controls.appendChild(minus); controls.appendChild(del);

    row.appendChild(im); row.appendChild(meta); row.appendChild(controls);
    cartItemsEl.appendChild(row);
  }
  cartSummary.textContent = `Total de artículos: ${totalItems}`;
  updateCartCount();
  updateCardBadges();
}

function changeQty(key, delta){
  if(!cart[key]) return;
  cart[key].qty += delta;
  if(cart[key].qty <= 0) delete cart[key];
  saveCart();
  renderCart();
}
function removeCartKey(key){ delete cart[key]; saveCart(); renderCart(); }

/* CHECKOUT -> WhatsApp */
function checkout(){
  const items = Object.values(cart).map(i => `${i.name} (${i.size}) x${i.qty}`);
  if(items.length === 0){ alert("El carrito está vacío."); return; }
  if(!WHATSAPP_NUMBER){ alert("No hay número de WhatsApp configurado. Edita config.json en el repo."); return; }
  const message = `Hola! Quiero comprar los siguientes stickers:\n- ${items.join("\n- ")}`;
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}

/* SIZE MODAL (abrir desde Add) */
function openSizeModal(sticker){
  pendingSticker = sticker;
  selectedSize = null;
  if(customSize) customSize.value = "";
  if(specialSizeInput) specialSizeInput.style.display = "none";
  sizeOptionEls.forEach(el => el.classList.remove("active"));
  if(sizeModal) { sizeModal.classList.remove("hidden"); sizeModal.setAttribute("aria-hidden","false"); }
}
function closeSizeModalFunc(){
  pendingSticker = null;
  selectedSize = null;
  if(sizeModal){ sizeModal.classList.add("hidden"); sizeModal.setAttribute("aria-hidden","true"); }
}
if(sizeOptionEls){
  sizeOptionEls.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      sizeOptionEls.forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      const s = btn.dataset.size;
      if(s === "especial"){
        if(specialSizeInput) specialSizeInput.style.display = "block";
        selectedSize = null;
      } else {
        if(specialSizeInput) specialSizeInput.style.display = "none";
        selectedSize = s;
      }
    });
  });
}
if(confirmSizeBtn){
  confirmSizeBtn.addEventListener("click", ()=>{
    if(!pendingSticker) return;
    let finalSize = selectedSize;
    if(!finalSize && customSize && customSize.value.trim()) finalSize = customSize.value.trim();
    if(!finalSize){ alert("Por favor seleccioná o escribí una medida."); return; }
    addToCartObj(pendingSticker, finalSize);
    closeSizeModalFunc();
  });
}
if(closeSizeModal) closeSizeModal.addEventListener("click", ()=> closeSizeModalFunc());

/* CONTACT modal */
if(contactBtn) contactBtn.addEventListener("click", ()=> {
  if(contactMessageEl) contactMessageEl.value = "";
  if(contactModal){ contactModal.classList.remove("hidden"); contactModal.setAttribute("aria-hidden","false"); }
});
if(closeContact) closeContact.addEventListener("click", ()=> { if(contactModal){ contactModal.classList.add("hidden"); contactModal.setAttribute("aria-hidden","true"); }});
if(contactClear) contactClear.addEventListener("click", ()=> { if(contactModal){ contactModal.classList.add("hidden"); contactModal.setAttribute("aria-hidden","true"); }});
if(contactSend) contactSend.addEventListener("click", ()=>{
  const text = (contactMessageEl?.value || "").trim();
  if(!WHATSAPP_NUMBER){ alert("No hay número de WhatsApp configurado. Edita config.json en el repo."); return; }
  const prefix = "Hola, vengo para consultarte: ";
  const message = prefix + text;
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
});

/* PREVIEW modal */
function openPreview(sticker){
  if(!previewModal) return;
  previewImg.src = STICKERS_PATH + sticker.path;
  previewImg.alt = sticker.name;
  previewName.textContent = sticker.name;
  previewModal.classList.remove("hidden");
  previewModal.setAttribute("aria-hidden","false");
}
if(closePreview) closePreview.addEventListener("click", ()=> { if(previewModal){ previewModal.classList.add("hidden"); previewModal.setAttribute("aria-hidden","true"); }});
if(previewModal) previewModal.addEventListener("click", (e)=> { if(e.target === previewModal) { previewModal.classList.add("hidden"); previewModal.setAttribute("aria-hidden","true"); }});

/* Eventos UI */
searchInput?.addEventListener("input", ()=> renderGallery());
onlySelected?.addEventListener("change", ()=> renderGallery());
cartBtn?.addEventListener("click", ()=> { if(cartModal) { renderCart(); cartModal.classList.remove("hidden"); cartModal.setAttribute("aria-hidden","false"); }});
closeCart?.addEventListener("click", ()=> { if(cartModal){ cartModal.classList.add("hidden"); cartModal.setAttribute("aria-hidden","true"); }});
clearCartBtn?.addEventListener("click", ()=> { if(confirm("Vaciar el carrito?")) { cart = {}; saveCart(); renderCart(); if(cartModal) { cartModal.classList.add("hidden"); cartModal.setAttribute("aria-hidden","true"); }}} );
checkoutBtn?.addEventListener("click", ()=> checkout());

/* cerrar modales con ESC */
document.addEventListener("keydown", (e)=>{
  if(e.key === "Escape"){
    if(cartModal && !cartModal.classList.contains("hidden")) { cartModal.classList.add("hidden"); cartModal.setAttribute("aria-hidden","true"); }
    if(previewModal && !previewModal.classList.contains("hidden")) { previewModal.classList.add("hidden"); previewModal.setAttribute("aria-hidden","true"); }
    if(contactModal && !contactModal.classList.contains("hidden")) { contactModal.classList.add("hidden"); contactModal.setAttribute("aria-hidden","true"); }
    if(sizeModal && !sizeModal.classList.contains("hidden")) { sizeModal.classList.add("hidden"); sizeModal.setAttribute("aria-hidden","true"); }
  }
});

/* INIT */
(async function init(){
  await fetchConfig();
  await loadManifest();
  updateCartCount();
  renderCart();
})();
