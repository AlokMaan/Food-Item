/* Supabase client is initialized in auth.js as `supabaseClient` */
const db = supabaseClient;

const DELIVERY_FEE = 40;
const TAX_RATE = 0.05;

/* Menu items loaded dynamically from Supabase */
let MENU_ITEMS = [];

let cart = [];
let map = null;
let mapInitialized = false;

const navbar = document.getElementById("navbar");
const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");
const menuGrid = document.getElementById("menuGrid");
const cartItems = document.getElementById("cartItems");
const cartEmpty = document.getElementById("cartEmpty");
const cartBadge = document.getElementById("cartBadge");
const subtotalEl = document.getElementById("subtotal");
const taxEl = document.getElementById("tax");
const deliveryFeeEl = document.getElementById("deliveryFee");
const totalBillEl = document.getElementById("totalBill");
const formTotalEl = document.getElementById("formTotal");
const placeOrderBtn = document.getElementById("placeOrderBtn");
const ordersList = document.getElementById("ordersList");
const toastContainer = document.getElementById("toastContainer");

async function init() {
    /* ── Session guard: redirect to login if not authenticated ── */
    const session = await checkSession();
    if (!session.authenticated) {
        window.location.href = "login.html";
        return;
    }
    /* Admin goes to admin page */
    if (session.role === "admin") {
        window.location.href = "admin.html";
        return;
    }

    /* Show user name in navbar */
    const navUserName = document.getElementById("navUserName");
    if (navUserName && session.user) {
        navUserName.textContent = session.user.name || session.user.email || "User";
    }

    /* Fetch products from database */
    try {
        const { data, error } = await db
            .from("products")
            .select("*")
            .eq("available", true)
            .order("created_at", { ascending: true });
        if (!error && data) {
            MENU_ITEMS = data.map(p => ({
                id: p.id,
                name: p.name,
                price: parseFloat(p.price),
                rating: p.rating || "4.5 ★ (0)",
                image: p.image
            }));
        }
    } catch (err) {
        console.error("Failed to load products:", err);
    }

    renderMenu();
    setupNavigation();
    setupScrollEffects();
    setupOrderForm();
    setupIntersectionObserver();
}

/* ── Logout handler (called from HTML onclick) ── */
async function handleLogout() {
    await logout();
}

function renderMenu() {
    menuGrid.innerHTML = MENU_ITEMS.map((item, index) => `
        <div class="menu-card" style="animation-delay: ${index * 0.1}s">
            <div class="menu-card-img">
                <img src="${item.image}" alt="${item.name}" loading="lazy">
                <span class="price-tag">₹${item.price}</span>
            </div>
            <div class="menu-card-body">
                <div>
                    <h3>${item.name}</h3>
                    <div class="rating">${item.rating}</div>
                </div>
                <button class="add-to-cart-btn" onclick="addToCart(${item.id})" aria-label="Add ${item.name} to cart">+</button>
            </div>
        </div>
    `).join("");
}

function setupNavigation() {
    navToggle.addEventListener("click", () => {
        navToggle.classList.toggle("open");
        navLinks.classList.toggle("open");
    });

    document.querySelectorAll(".nav-link").forEach(link => {
        link.addEventListener("click", () => {
            navToggle.classList.remove("open");
            navLinks.classList.remove("open");

            document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
            link.classList.add("active");

            const section = link.getAttribute("data-section");
            if (section === "history") {
                fetchOrders();
            }
            if (section === "map" && !mapInitialized) {
                setTimeout(initMap, 300);
            }
        });
    });
}

function setupScrollEffects() {
    window.addEventListener("scroll", () => {
        if (window.scrollY > 50) {
            navbar.classList.add("scrolled");
        } else {
            navbar.classList.remove("scrolled");
        }

        const sections = document.querySelectorAll(".section");
        let current = "";
        sections.forEach(section => {
            const top = section.offsetTop - 100;
            if (window.scrollY >= top) {
                current = section.id;
            }
        });

        document.querySelectorAll(".nav-link").forEach(link => {
            link.classList.remove("active");
            if (link.getAttribute("data-section") === current) {
                link.classList.add("active");
            }
        });
    });
}

function setupIntersectionObserver() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                if (entry.target.id === "map" && !mapInitialized) {
                    setTimeout(initMap, 300);
                }
                if (entry.target.id === "history") {
                    fetchOrders();
                }
            }
        });
    }, { threshold: 0.2 });

    document.querySelectorAll(".section").forEach(section => {
        observer.observe(section);
    });
}

function addToCart(itemId) {
    const menuItem = MENU_ITEMS.find(i => i.id === itemId);
    if (!menuItem) return;

    const existing = cart.find(c => c.id === itemId);
    if (existing) {
        existing.qty += 1;
    } else {
        cart.push({ ...menuItem, qty: 1 });
    }

    renderCart();
    showToast("success", `${menuItem.name} added to cart!`);
}

function removeFromCart(itemId) {
    cart = cart.filter(c => c.id !== itemId);
    renderCart();
}

function updateQty(itemId, delta) {
    const item = cart.find(c => c.id === itemId);
    if (!item) return;

    item.qty += delta;
    if (item.qty <= 0) {
        removeFromCart(itemId);
        return;
    }

    renderCart();
}

function renderCart() {
    const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
    cartBadge.textContent = totalItems;

    if (cart.length === 0) {
        cartItems.innerHTML = `
            <div class="cart-empty" id="cartEmpty">
                <div class="empty-icon">🛒</div>
                <h3>Your cart is empty</h3>
                <p>Add delicious items from our menu to get started!</p>
                <a href="#menu" class="btn btn-primary">Browse Menu</a>
            </div>
        `;
        placeOrderBtn.disabled = true;
    } else {
        cartItems.innerHTML = cart.map(item => `
            <div class="cart-item">
                <img src="${item.image}" alt="${item.name}" class="cart-item-img">
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <span class="item-price">₹${item.price * item.qty}</span>
                </div>
                <div class="qty-controls">
                    <button class="qty-btn" onclick="updateQty(${item.id}, -1)">−</button>
                    <span class="qty-value">${item.qty}</span>
                    <button class="qty-btn" onclick="updateQty(${item.id}, 1)">+</button>
                </div>
                <button class="remove-btn" onclick="removeFromCart(${item.id})" aria-label="Remove ${item.name}">✕</button>
            </div>
        `).join("");
        placeOrderBtn.disabled = false;
    }

    updateTotals();
}

function updateTotals() {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    const tax = subtotal * TAX_RATE;
    const delivery = cart.length > 0 ? DELIVERY_FEE : 0;
    const total = subtotal + tax + delivery;

    subtotalEl.textContent = `₹${subtotal.toFixed(2)}`;
    taxEl.textContent = `₹${tax.toFixed(2)}`;
    deliveryFeeEl.textContent = cart.length > 0 ? `₹${DELIVERY_FEE.toFixed(2)}` : "₹0.00";
    totalBillEl.textContent = `₹${total.toFixed(2)}`;
    formTotalEl.textContent = `₹${total.toFixed(2)}`;
}

function setupOrderForm() {
    placeOrderBtn.addEventListener("click", async () => {
        const name = document.getElementById("customerName").value.trim();
        const phone = document.getElementById("customerPhone").value.trim();
        const address = document.getElementById("customerAddress").value.trim();

        if (!name || !phone || !address) {
            showToast("error", "Please fill in all delivery details.");
            return;
        }

        if (cart.length === 0) {
            showToast("error", "Your cart is empty. Add items first!");
            return;
        }

        const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
        const tax = subtotal * TAX_RATE;
        const total = subtotal + tax + DELIVERY_FEE;

        const orderItems = cart.map(item => ({
            name: item.name,
            price: item.price,
            qty: item.qty
        }));

        placeOrderBtn.disabled = true;
        placeOrderBtn.innerHTML = `<span>Placing Order...</span>`;

        try {
            const { error } = await db.from("orders").insert({
                customer_name: name,
                phone: phone,
                address: address,
                items: orderItems,
                total_amount: parseFloat(total.toFixed(2))
            });

            if (error) throw error;

            showToast("success", "Order placed successfully! 🎉");
            cart = [];
            renderCart();
            document.getElementById("customerName").value = "";
            document.getElementById("customerPhone").value = "";
            document.getElementById("customerAddress").value = "";
        } catch (err) {
            showToast("error", "Failed to place order. Please try again.");
            console.error(err);
        } finally {
            placeOrderBtn.disabled = cart.length === 0;
            placeOrderBtn.innerHTML = `
                <span>Place Order</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            `;
        }
    });
}

async function fetchOrders() {
    const ordersLoading = document.getElementById("ordersLoading");

    try {
        ordersList.innerHTML = `
            <div class="loading-spinner" id="ordersLoading">
                <div class="spinner"></div>
                <p>Loading orders...</p>
            </div>
        `;

        const { data, error } = await db
            .from("orders")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            ordersList.innerHTML = `
                <div class="no-orders">
                    <div class="empty-icon">📦</div>
                    <h3>No orders yet</h3>
                    <p>Your order history will appear here once you place an order.</p>
                </div>
            `;
            return;
        }

        ordersList.innerHTML = data.map((order, index) => {
            const items = Array.isArray(order.items) ? order.items : [];
            const date = new Date(order.created_at).toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });

            return `
                <div class="order-card" style="animation-delay: ${index * 0.1}s">
                    <div class="order-card-header">
                        <h3>${order.customer_name}</h3>
                        <span class="order-date">${date}</span>
                    </div>
                    <div class="order-items-list">
                        ${items.map(item => `
                            <span class="order-item-chip">
                                <span class="chip-qty">${item.qty}</span>
                                ${item.name}
                            </span>
                        `).join("")}
                    </div>
                    <div class="order-total">₹${order.total_amount.toFixed(2)}</div>
                </div>
            `;
        }).join("");
    } catch (err) {
        ordersList.innerHTML = `
            <div class="no-orders">
                <div class="empty-icon">⚠️</div>
                <h3>Error loading orders</h3>
                <p>Please try again later.</p>
            </div>
        `;
        console.error(err);
    }
}

function initMap() {
    if (mapInitialized) return;
    mapInitialized = true;

    const restaurantCoords = [28.6139, 77.2090];
    const customerCoords = [28.6250, 77.2195];

    map = L.map("deliveryMap", {
        scrollWheelZoom: true,
        zoomControl: true
    }).setView([28.6190, 77.2140], 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(map);

    const restaurantIcon = L.divIcon({
        className: "custom-marker",
        html: '<div style="background:#ff6b35;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 0 20px rgba(255,107,53,0.5);border:3px solid #fff">🍔</div>',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
    });

    const customerIcon = L.divIcon({
        className: "custom-marker",
        html: '<div style="background:#00c853;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 0 20px rgba(0,200,83,0.5);border:3px solid #fff">📍</div>',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
    });

    L.marker(restaurantCoords, { icon: restaurantIcon })
        .addTo(map)
        .bindPopup(`
            <div style="text-align:center;padding:8px">
                <strong style="font-size:14px">🍔 FoodDash Restaurant</strong><br>
                <span style="color:#666;font-size:12px">Connaught Place, New Delhi</span><br>
                <span style="color:#ff6b35;font-size:12px;font-weight:600">Preparing your order...</span>
            </div>
        `);

    L.marker(customerCoords, { icon: customerIcon })
        .addTo(map)
        .bindPopup(`
            <div style="text-align:center;padding:8px">
                <strong style="font-size:14px">📍 Delivery Location</strong><br>
                <span style="color:#666;font-size:12px">Your delivery address</span><br>
                <span style="color:#00c853;font-size:12px;font-weight:600">ETA: 15-20 min</span>
            </div>
        `);

    const routeLine = L.polyline([restaurantCoords, customerCoords], {
        color: "#ff6b35",
        weight: 3,
        opacity: 0.7,
        dashArray: "10, 10"
    }).addTo(map);

    setTimeout(() => {
        map.invalidateSize();
    }, 500);
}

function showToast(type, message) {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${type === "success" ? "✅" : "❌"}</span>
        <span>${message}</span>
    `;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(100px)";
        toast.style.transition = "0.3s ease";
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

document.addEventListener("DOMContentLoaded", init);
