const WHATSAPP_NUMBER = "5492323521229";
const MANIFEST_PATH = "stickers/manifest.json";
const STICKERS_PATH = "stickers/";
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

function loadCart(){
  try{
    const s = localStorage.getItem("sai_cart");
    return s ? JSON.parse(s) : {};
  }catch(e){
    return {};
  }
}

function saveCart(){
  localStorage.setItem("sai_cart", JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount(){
  const total = Object.values(cart).reduce((a,b)=>a+(b.qty||0),0);
  cartCountEl.textContent = total;
}

async function loadManifest(){
  try{
    const r = await fetch(MANIFEST_PATH, {cache:"no-cache"});
    if(!r.ok) throw new Error("no manifest");
    const list = await r.json();
    stickers = Array.isArray(list) ? list : [];
    renderGallery();
  }catch(err){
    gallery.innerHTML = `<div class="error">No se encontró manifest.json en stickers/. Si trabajas localmente, ejecuta <code>node scripts/generate-manifest.js</code> y sube el archivo al repo.</div>`;
  }
}

function createCard(filename){
  const fig = document.createElement("div");
  fig.className = "card";
  const thumb = document.createElement("div");
  thumb.className = "thumb";
  const img = document.createElement("img");
  img.src = STICKERS_PATH + filename;
  img.alt = filename;
  img.loading = "lazy";
  thumb.appendChild(img);
  const name = document.createElement("div");
  name.className = "filename";
  name.textContent = filename;
  const actions = document.createElement("div");
  actions.className = "actions";

  const addBtn = document.createElement("button");
  addBtn.className = "add-btn";
  addBtn.textContent = "Agregar";
  addBtn.addEventListener("click", ()=> addToCart(filename));

  const qtyBadge = document.createElement("span");
  qtyBadge.className = "qty-badge";
  const currentQty = cart[filename] ? cart[filename].qty : 0;
  qtyBadge.textContent = currentQty;

  actions.appendChild(addBtn);
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
    if(q && !name.toLowerCase().includes(q)) return false;
    if(f && !name.toLowerCase().includes(f)) return false;
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
    const fname = card.querySelector(".filename").textContent;
    b.textContent = cart[fname] ? cart[fname].qty : 0;
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
  if(!cart[filename]) return;
  cart[filename].qty += delta;
  if(cart[filename].qty <= 0) delete cart[filename];
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
    name.textContent = item.name;
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
  const items = Object.values(cart).map(i => `${i.name} x${i.qty}`);
  if(items.length === 0){
    alert("El carrito está vacío.");
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

loadManifest();
updateCartCount();
