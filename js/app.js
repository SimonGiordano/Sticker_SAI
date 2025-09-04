const MANIFEST_PATH = "stickers/manifest.json";
const STICKERS_PATH = "stickers/";
const CONFIG_PATH = "config.json";

const gallery = document.getElementById("gallery");
const searchInput = document.getElementById("search");
const filterInput = document.getElementById("filterInput");
const onlySelected = document.getElementById("onlySelected");
const cartBtn = document.getElementById("cartBtn");
const cartCountEl = document.getElementById("cartCount");
const cartModal = document.getElementById("cartModal");
const cartItemsEl = document.getElementById("cartItems");
const closeCart = document.getElementById("closeCart");
const clearCartBtn = document.getElementById("clearCart");
const checkoutBtn = document.getElementById("checkoutBtn");
const cartSummary = document.getElementById("cartSummary");

let stickers = [];
let cart = loadCart();
let WHATSAPP_NUMBER = "";

function loadCart(){
  try{
    const s = localStorage.getItem("sai_cart");
    return s ? JSON.parse(s) : {};
  }catch(e){
    return {};
  }
}

function saveCart(){
  try{
    localStorage.setItem("sai_cart", JSON.stringify(cart));
  }catch(e){}
  updateCartCount();
}

function updateCartCount(){
  const total = Object.values(cart).reduce((a,b)=>a+(b.qty||0),0);
  cartCountEl.textContent = total;
}

function stripExtension(name){
  return name.replace(/\.[^/.]+$/, "");
}

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

async function loadManifest(){
  try{
    const r = await fetch(MANIFEST_PATH, {cache:"no-cache"});
    if(r.ok){
      const list = await r.json();
      stickers = Array.isArray(list) ? list : [];
      renderGallery();
      return;
    }
  }catch(err){}

  try{
    const owner = document.body.dataset.ghOwner || "";
    const repo = document.body.dataset.ghRepo || "";
    if(owner && repo){
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/stickers`;
      const r2 = await fetch(apiUrl);
      if(r2.ok){
        const data = await r2.json();
        stickers = data
          .filter(f => f.type === "file" && /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name))
          .map(f => f.name)
          .sort();
        renderGallery();
        return;
      }
    }
  }catch(err){}

  gallery.innerHTML = `<div class="error">No se encontró stickers/manifest.json. Generá el manifest o usá el workflow.</div>`;
}

function createCard(filename){
  const fig = document.createElement("div");
  fig.className = "card";
  fig.dataset.filename = filename;

  const thumb = document.createElement("div");
  thumb.className = "thumb";
  const img = document.createElement("img");
  img.src = STICKERS_PATH + filename;
  img.alt = filename;
  img.loading = "lazy";
  thumb.appendChild(img);

  const displayName = stripExtension(filename);
  const name = document.createElement("div");
  name.className = "filename";
  name.textContent = displayName;

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
  const q = (searchInput.value||"").trim().toLowerCase();
  const f = (filterInput.value||"").trim().toLowerCase();
  gallery.innerHTML = "";
  const filtered = stickers.filter(name=>{
    const lowerName = name.toLowerCase();
    const display = stripExtension(lowerName);
    if(q && !(lowerName.includes(q) || display.includes(q))) return false;
    if(f && !(lowerName.includes(f) || display.includes(f))) return false;
    if(onlySelected.checked && !cart[name]) return false;
    return true;
  });
  if(filtered.length === 0){
    gallery.innerHTML = `<div style="padding:18px;color:#163536">No se encontraron stickers.</div>`;
    return;
  }
  for(const name of filtered){
    const card = createCard(name);
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
    im.src = STICKERS_PATH + item.name;
    im.alt = item.name;
    const meta = document.createElement("div");
    meta.className = "meta";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = stripExtension(item.name);
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

function openCart(){
  renderCart();
  cartModal.classList.remove("hidden");
  cartModal.setAttribute("aria-hidden","false");
}

function closeCartModal(){
  cartModal.classList.add("hidden");
  cartModal.setAttribute("aria-hidden","true");
}

function clearCart(){
  cart = {};
  saveCart();
  renderCart();
  closeCartModal();
}

function checkout(){
  const items = Object.values(cart).map(i => `${stripExtension(i.name)} x${i.qty}`);
  if(items.length === 0){
    alert("El carrito está vacío.");
    return;
  }
  if(!WHATSAPP_NUMBER){
    alert("No hay número de WhatsApp configurado. Edita config.json en el repo.");
    return;
  }
  const message = `Hola! Quiero comprar los siguientes stickers: ${items.join(", ")}`;
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}

searchInput.addEventListener("input", ()=> renderGallery());
filterInput.addEventListener("input", ()=> renderGallery());
onlySelected.addEventListener("change", ()=> renderGallery());
cartBtn.addEventListener("click", ()=> openCart());
closeCart.addEventListener("click", ()=> closeCartModal());
clearCartBtn.addEventListener("click", ()=> {
  if(confirm("Vaciar el carrito?")) clearCart();
});
checkoutBtn.addEventListener("click", ()=> checkout());

(async function init(){
  await fetchConfig();
  await loadManifest();
  updateCartCount();
})();
