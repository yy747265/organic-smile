// ضع رقم الواتساب برمز الدولة هنا (مثال: 201234567890)
const WHATSAPP_NUMBER = "201061429669";

// دالة إظهار الإشعارات (Toast Notification)
function showToast(message, isError = false) {
    let toast = document.getElementById("toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        toast.className = "toast";
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = isError ? "toast error show" : "toast show";
    setTimeout(() => {
        toast.className = toast.className.replace("show", "");
    }, 3000);
}

document.addEventListener("DOMContentLoaded", () => {
    // 1. القائمة الجانبية للموبايل
    const mobileMenuBtn = document.getElementById("mobileMenuBtn");
    const navLinks = document.getElementById("navLinks");

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener("click", () => {
            navLinks.classList.toggle("active");
        });
    }

    // 2. تحميل البيانات الأساسية
    loadHeroData();
    loadTicker();
    loadProducts();
    updateCartCount();
    setupCartModal();
    setupImageViewer();
    setupNewsletter();

    // 3. البحث والفلترة
    setupSearchAndFilter();

    // 4. لوحة التحكم
    setupAdminPanel();

    // 5. زر تحويل اللغة
    const langBtn = document.getElementById("langBtn");
    let currentLang = localStorage.getItem("organicLang") || "ar";
    setLanguage(currentLang);

    if (langBtn) {
        langBtn.addEventListener("click", () => {
            currentLang = currentLang === "ar" ? "en" : "ar";
            localStorage.setItem("organicLang", currentLang);
            setLanguage(currentLang);
        });
    }
});

let currentCategory = "all";
let searchQuery = "";

/* ==================== 1. الهيرو ==================== */
function loadHeroData() {
    const heroTitleContainer = document.getElementById("heroTitleContainer");
    const heroTitleText = document.getElementById("heroTitleText");
    const heroTitleImgContainer = document.getElementById("heroTitleImgContainer");
    const heroTitleImg = document.getElementById("heroTitleImg");
    const heroMainImg = document.getElementById("heroMainImg");

    let customTitle = localStorage.getItem("organicHeroTitle");
    let customTitleImg = localStorage.getItem("organicHeroTitleImg");
    let customMainImg = localStorage.getItem("organicHeroMainImg");

    if (customTitleImg) {
        if (heroTitleContainer) heroTitleContainer.style.display = "none";
        if (heroTitleImgContainer && heroTitleImg) {
            heroTitleImg.src = customTitleImg;
            heroTitleImgContainer.style.display = "block";
        }
    } else {
        if (heroTitleImgContainer) heroTitleImgContainer.style.display = "none";
        if (heroTitleContainer) heroTitleContainer.style.display = "block";
        if (heroTitleText && customTitle) heroTitleText.textContent = customTitle;
    }

    if (customMainImg && heroMainImg) {
        heroMainImg.src = customMainImg;
        heroMainImg.style.cursor = "pointer";
        heroMainImg.onclick = () => openImageViewer(customMainImg);
    }
}

/* ==================== 2. شريط العروض ==================== */
function loadTicker() {
    const adminTicker = document.getElementById("adminTicker");
    if (!adminTicker) return;

    let offers = JSON.parse(localStorage.getItem("organicOffers")) || [
        "شحن مجاني للطلبات فوق 700 ج.م",
        "منتجات أورجانيك صحية وطبيعية 100%",
        "جودة فاخرة وتغليف ممتاز"
    ];

    if (offers.length === 0) {
        adminTicker.innerHTML = `<span><i class="fa-solid fa-star"></i> أهلاً بكم في ORGANIC Smile</span>`;
    } else {
        adminTicker.innerHTML = offers.map(o => `<span><i class="fa-solid fa-star"></i> ${o}</span>`).join('');
    }
}

/* ==================== 3. عرض المنتجات والمعرض المكبر ==================== */
function loadProducts() {
    const adminProducts = document.getElementById("adminProducts");
    if (!adminProducts) return;

    let products = JSON.parse(localStorage.getItem("organicProducts")) || [];
    let currentLang = localStorage.getItem("organicLang") || "ar";

    let filteredProducts = products.filter(p => {
        let matchCategory = (currentCategory === "all") || (p.category === currentCategory);
        let matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchCategory && matchSearch;
    });

    if (filteredProducts.length === 0) {
        let msg = translations[currentLang]?.no_products_msg || "لا توجد منتجات مطابقة.";
        adminProducts.innerHTML = `
            <div class="no-products" style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #888;">
                <i class="fa-solid fa-magnifying-glass-minus" style="font-size: 40px; margin-bottom: 10px; color: #C9A961;"></i>
                <p>${msg}</p>
            </div>
        `;
    } else {
        adminProducts.innerHTML = "";
        filteredProducts.forEach((p, pIndex) => {
            let cartText = translations[currentLang]?.add_to_cart || "أضف إلى السلة";
            let images = Array.isArray(p.images) && p.images.length > 0 ? p.images : [p.image || "https://via.placeholder.com/300x300/1a1a1a/C9A961?text=No+Image"];
            let sizes = Array.isArray(p.sizes) && p.sizes.length > 0 ? p.sizes : [{ size: "افتراضي", price: p.price || 0 }];

            let sizeOptions = sizes.map(s => `<option value="${s.price}" data-size="${s.size}">${s.size} - ${s.price} ج.م</option>`).join('');

            let thumbsHtml = "";
            if (images.length > 1) {
                thumbsHtml = `<div class="thumbs-container">` + 
                    images.map(img => `<img src="${img}" class="thumb-img" onclick="changeCardImage(${pIndex}, '${img}')" alt="thumb">`).join('') +
                `</div>`;
            }

            const card = document.createElement("div");
            card.classList.add("product-card");
            card.innerHTML = `
                <div class="product-image-container">
                    <img src="${images[0]}" alt="${p.name}" class="product-image" id="mainImg-${pIndex}" onclick="openImageViewer(this.src)">
                    ${thumbsHtml}
                </div>
                <div class="product-info">
                    <h3 class="product-title">${p.name}</h3>
                    <select class="size-select" id="sizeSelect-${pIndex}" onchange="updateCardPrice(${pIndex})">
                        ${sizeOptions}
                    </select>
                    <div class="product-price">
                        <span class="current-price" id="priceDisplay-${pIndex}">${sizes[0].price} ج.م</span>
                    </div>
                    <button class="add-to-cart" onclick="promptQuantityWithDetails(${pIndex}, '${p.name.replace(/'/g, "\\'")}')">
                        <i class="fa-solid fa-bag-shopping"></i> ${cartText}
                    </button>
                </div>
            `;
            adminProducts.appendChild(card);
        });
    }
}

window.changeCardImage = function(pIndex, imgSrc) {
    const mainImg = document.getElementById(`mainImg-${pIndex}`);
    if (mainImg) mainImg.src = imgSrc;
};

window.updateCardPrice = function(pIndex) {
    const sizeSelect = document.getElementById(`sizeSelect-${pIndex}`);
    const priceDisplay = document.getElementById(`priceDisplay-${pIndex}`);
    if (sizeSelect && priceDisplay) {
        priceDisplay.textContent = `${sizeSelect.value} ج.م`;
    }
};

/* ==================== 4. عارض الصور المكبرة (Image Viewer) ==================== */
function setupImageViewer() {
    const overlay = document.getElementById("imageViewerOverlay");
    const closeBtn = document.getElementById("closeViewerBtn");

    if (closeBtn && overlay) {
        closeBtn.addEventListener("click", () => overlay.classList.remove("active"));
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) overlay.classList.remove("active");
        });
    }
}

window.openImageViewer = function(imgSrc) {
    const overlay = document.getElementById("imageViewerOverlay");
    const fullImg = document.getElementById("fullSizeImage");
    if (overlay && fullImg) {
        fullImg.src = imgSrc;
        overlay.classList.add("active");
    }
};

/* ==================== 5. نظام السلة وربط الواتساب ==================== */
window.promptQuantityWithDetails = function(pIndex, name) {
    const sizeSelect = document.getElementById(`sizeSelect-${pIndex}`);
    const mainImg = document.getElementById(`mainImg-${pIndex}`);
    
    let price = sizeSelect ? parseFloat(sizeSelect.value) : 0;
    let selectedOption = sizeSelect ? sizeSelect.options[sizeSelect.selectedIndex] : null;
    let sizeName = selectedOption ? selectedOption.getAttribute("data-size") : "";
    let image = mainImg ? mainImg.src : "";

    let currentLang = localStorage.getItem("organicLang") || "ar";
    let promptMsg = currentLang === "en" ? `Enter quantity for ${name} (${sizeName}):` : `أدخل الكمية المطلوبة من "${name}" (حجم: ${sizeName}):`;
    
    let qty = prompt(promptMsg, "1");
    if (qty !== null) {
        let quantity = parseInt(qty);
        if (isNaN(quantity) || quantity <= 0) {
            showToast(currentLang === "en" ? "Please enter a valid quantity!" : "من فضلك أدخل رقماً صحيحاً للكمية!", true);
            return;
        }
        let itemFullName = `${name} (${sizeName})`;
        addToCartWithQty(itemFullName, price, image, quantity);
    }
};

function addToCartWithQty(name, price, image, quantity) {
    let cart = JSON.parse(localStorage.getItem("organicCart")) || [];
    
    let existingProduct = cart.find(item => item.name === name);
    if (existingProduct) {
        existingProduct.quantity += quantity;
    } else {
        cart.push({ name, price, image, quantity });
    }

    localStorage.setItem("organicCart", JSON.stringify(cart));
    updateCartCount();

    let currentLang = localStorage.getItem("organicLang") || "ar";
    let alertMsg = currentLang === "en" ? `Added ${quantity} of "${name}" to cart!` : `تمت إضافة عدد (${quantity}) من "${name}" إلى السلة بنجاح!`;
    showToast(alertMsg);
}

function updateCartCount() {
    const cartCount = document.getElementById("cartCount");
    if (!cartCount) return;

    let cart = JSON.parse(localStorage.getItem("organicCart")) || [];
    let totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;
}

function setupCartModal() {
    const cartIcon = document.querySelector(".cart-icon");
    const cartModalOverlay = document.getElementById("cartModalOverlay");
    const closeCartBtn = document.getElementById("closeCartBtn");
    const checkoutBtn = document.getElementById("checkoutBtn");
    const continueShoppingBtn = document.getElementById("continueShoppingBtn");

    if (cartIcon && cartModalOverlay) {
        cartIcon.addEventListener("click", () => {
            renderCartModalItems();
            cartModalOverlay.classList.add("active");
        });
    }

    const closeCart = () => cartModalOverlay.classList.remove("active");

    if (closeCartBtn && cartModalOverlay) {
        closeCartBtn.addEventListener("click", closeCart);
    }

    if (cartModalOverlay) {
        cartModalOverlay.addEventListener("click", (e) => {
            if (e.target === cartModalOverlay) closeCart();
        });
    }

    if (continueShoppingBtn && cartModalOverlay) {
        continueShoppingBtn.addEventListener("click", closeCart);
    }

    if (checkoutBtn) {
        checkoutBtn.addEventListener("click", sendOrderToWhatsApp);
    }
}

function renderCartModalItems() {
    const cartModalBody = document.getElementById("cartModalBody");
    const cartTotalPrice = document.getElementById("cartTotalPrice");
    const emptyCartState = document.getElementById("emptyCartState");
    const cartModalFooter = document.getElementById("cartModalFooter");
    
    if (!cartModalBody || !cartTotalPrice) return;

    let cart = JSON.parse(localStorage.getItem("organicCart")) || [];
    cartModalBody.innerHTML = "";

    if (cart.length === 0) {
        if (emptyCartState) emptyCartState.style.display = "block";
        if (cartModalFooter) cartModalFooter.style.display = "none";
        cartTotalPrice.textContent = "0 ج.م";
        return;
    }

    if (emptyCartState) emptyCartState.style.display = "none";
    if (cartModalFooter) cartModalFooter.style.display = "flex";

    let total = 0;
    cart.forEach((item, index) => {
        let itemTotal = item.price * item.quantity;
        total += itemTotal;

        const row = document.createElement("div");
        row.classList.add("cart-item-row");
        row.innerHTML = `
            <div class="cart-item-info">
                <img src="${item.image}" alt="${item.name}" class="cart-item-img">
                <div>
                    <h4 style="font-size: 14px; margin-bottom: 4px;">${item.name}</h4>
                    <span style="font-size: 12px; color: #C9A961;">${item.price} ج.م × ${item.quantity}</span>
                </div>
            </div>
            <button class="btn-delete" onclick="removeFromCart(${index})">حذف</button>
        `;
        cartModalBody.appendChild(row);
    });

    cartTotalPrice.textContent = `${total} ج.م`;
}

window.removeFromCart = function(index) {
    let cart = JSON.parse(localStorage.getItem("organicCart")) || [];
    cart.splice(index, 1);
    localStorage.setItem("organicCart", JSON.stringify(cart));
    updateCartCount();
    renderCartModalItems();
    showToast("تم حذف المنتج من السلة");
};

function sendOrderToWhatsApp() {
    let cart = JSON.parse(localStorage.getItem("organicCart")) || [];

    if (cart.length === 0) {
        showToast("السلة فارغة حالياً! قم بإضافة المنتجات أولاً.", true);
        return;
    }

    let clientInfo = `👤 *بيانات العميل:* زائر\n\n`;
    let orderDetails = `🛒 *طلب جديد من ORGANIC Smile*\n------------------------------\n${clientInfo}📦 *المنتجات المطلوبة:*\n`;
    let total = 0;

    cart.forEach((item, index) => {
        let itemTotal = item.price * item.quantity;
        total += itemTotal;
        orderDetails += `${index + 1}. *${item.name}*\n   الكمية: ${item.quantity} | السعر: ${itemTotal} ج.م\n`;
    });

    orderDetails += `------------------------------\n💰 *الإجمالي الكلي:* ${total} ج.م\n\nيرجى تأكيد الطلب وتحديد عنوان التوصيل.`;

    let encodedMessage = encodeURIComponent(orderDetails);
    let whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;

    window.open(whatsappUrl, "_blank");
    showToast("جاري تحويلك إلى واتساب...");
}

/* ==================== 6. البحث والفلترة ==================== */
function setupSearchAndFilter() {
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            searchQuery = e.target.value.trim();
            loadProducts();
        });
    }

    const tabBtns = document.querySelectorAll(".tab-btn");
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tabBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentCategory = btn.getAttribute("data-category");
            loadProducts();
        });
    });
}

/* ==================== 7. لوحة التحكم للأدمن ==================== */
function setupAdminPanel() {
    const heroForm = document.getElementById("heroForm");
    const removeHeroImgsBtn = document.getElementById("removeHeroImgsBtn");
    const addOfferForm = document.getElementById("addOfferForm");
    const addProductForm = document.getElementById("addProductForm");
    const addSizeBtn = document.getElementById("addSizeBtn");

    if (heroForm) {
        heroForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const titleVal = document.getElementById("heroTitleInput").value.trim();
            const titleImgFile = document.getElementById("heroTitleImgInput").files[0];
            const mainImgFile = document.getElementById("heroMainImgInput").files[0];

            if (titleVal) {
                localStorage.setItem("organicHeroTitle", titleVal);
                localStorage.removeItem("organicHeroTitleImg");
            }

            const readAndSave = (file, key) => {
                return new Promise((resolve) => {
                    if (!file) return resolve();
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        localStorage.setItem(key, evt.target.result);
                        resolve();
                    };
                    reader.readAsDataURL(file);
                });
            };

            Promise.all([
                readAndSave(titleImgFile, "organicHeroTitleImg"),
                readAndSave(mainImgFile, "organicHeroMainImg")
            ]).then(() => {
                showToast("تم تحديث الواجهة بنجاح!");
                loadHeroData();
            });
        });
    }

    if (removeHeroImgsBtn) {
        removeHeroImgsBtn.addEventListener("click", () => {
            if(confirm("هل أنت متأكد من إزالة صور الواجهة المخصصة والعودة للإعدادات الافتراضية؟")) {
                localStorage.removeItem("organicHeroTitleImg");
                localStorage.removeItem("organicHeroMainImg");
                localStorage.removeItem("organicHeroTitle");
                showToast("تم إعادة الواجهة للشكل الافتراضي بنجاح!");
                loadHeroData();
            }
        });
    }

    if (addSizeBtn) {
        addSizeBtn.addEventListener("click", () => {
            const sizesContainer = document.getElementById("sizesContainer");
            const newRow = document.createElement("div");
            newRow.classList.add("size-row");
            newRow.innerHTML = `
                <input type="text" placeholder="الحجم (مثال: 500 جرام)" class="size-name" required>
                <input type="number" placeholder="السعر (ج.م)" class="size-price" required>
                <button type="button" class="btn-delete" onclick="this.parentElement.remove()" style="padding: 10px;"><i class="fa-solid fa-times"></i></button>
            `;
            sizesContainer.appendChild(newRow);
        });
    }

    if (addOfferForm) {
        renderAdminOffersList();
        addOfferForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const text = document.getElementById("offerText").value.trim();
            if (text) {
                let offers = JSON.parse(localStorage.getItem("organicOffers")) || [];
                offers.push(text);
                localStorage.setItem("organicOffers", JSON.stringify(offers));
                document.getElementById("offerText").value = "";
                renderAdminOffersList();
                showToast("تم إضافة العرض بنجاح!");
            }
        });
    }

    if (addProductForm) {
        renderAdminProductsList();
        addProductForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const name = document.getElementById("pName").value.trim();
            const category = document.getElementById("pCategory").value;
            const files = document.getElementById("pFiles").files;

            const sizeNames = document.querySelectorAll(".size-name");
            const sizePrices = document.querySelectorAll(".size-price");
            let sizes = [];
            sizeNames.forEach((sn, idx) => {
                if (sn.value.trim() && sizePrices[idx].value.trim()) {
                    sizes.push({
                        size: sn.value.trim(),
                        price: parseFloat(sizePrices[idx].value.trim())
                    });
                }
            });

            if (name && sizes.length > 0 && files.length > 0) {
                let imagePromises = [];
                for (let i = 0; i < files.length; i++) {
                    imagePromises.push(new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = (evt) => resolve(evt.target.result);
                        reader.readAsDataURL(files[i]);
                    }));
                }

                Promise.all(imagePromises).then((imagesBase64) => {
                    let products = JSON.parse(localStorage.getItem("organicProducts")) || [];
                    products.push({
                        name,
                        category,
                        sizes,
                        images: imagesBase64,
                        image: imagesBase64[0]
                    });

                    try {
                        localStorage.setItem("organicProducts", JSON.stringify(products));
                        addProductForm.reset();
                        const productPreview = document.getElementById("productPreview");
                        if (productPreview) productPreview.innerHTML = "";
                        
                        renderAdminProductsList();
                        showToast("تم إضافة المنتج بالأحجام والصور المحددة بنجاح!");
                    } catch (err) {
                        showToast("حجم الصور كبير جداً، يرجى اختيار صور أقل أو بحجم أصغر.", true);
                    }
                });
            }
        });
    }
}

function renderAdminOffersList() {
    const offersList = document.getElementById("offersList");
    if (!offersList) return;

    let offers = JSON.parse(localStorage.getItem("organicOffers")) || [];
    offersList.innerHTML = "";
    
    if (offers.length === 0) {
        offersList.innerHTML = `<div class="empty-state">لا توجد عروض مضافة حالياً</div>`;
        return;
    }

    offers.forEach((offer, index) => {
        const row = document.createElement("div");
        row.classList.add("item-row");
        row.innerHTML = `
            <div class="item-info">
                <span class="item-name">${offer}</span>
            </div>
            <div class="item-actions">
                <button class="btn-delete" onclick="deleteOffer(${index})">حذف</button>
            </div>
        `;
        offersList.appendChild(row);
    });
}

window.deleteOffer = function(index) {
    if(confirm("هل أنت متأكد من حذف هذا العرض؟")) {
        let offers = JSON.parse(localStorage.getItem("organicOffers")) || [];
        offers.splice(index, 1);
        localStorage.setItem("organicOffers", JSON.stringify(offers));
        renderAdminOffersList();
        showToast("تم حذف العرض بنجاح");
    }
};

function renderAdminProductsList() {
    const productsList = document.getElementById("productsList");
    if (!productsList) return;

    let products = JSON.parse(localStorage.getItem("organicProducts")) || [];
    productsList.innerHTML = "";
    
    if (products.length === 0) {
        productsList.innerHTML = `<div class="empty-state">لا توجد منتجات مضافة حالياً</div>`;
        return;
    }

    products.forEach((p, pIndex) => {
        let catName = p.category === "powder" ? "بودر طبيعي" : "فواكه مجففة";
        let displayPrice = p.sizes && p.sizes.length > 0 ? p.sizes[0].price : p.price;
        let images = Array.isArray(p.images) && p.images.length > 0 ? p.images : [p.image];

        let imgsHtml = images.map((img, imgIndex) => `
            <div style="position: relative; display: inline-block; margin-left: 5px;">
                <img src="${img}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; border: 1px solid #C9A961;">
                <button onclick="deleteSingleImage(${pIndex}, ${imgIndex})" title="حذف هذه الصورة" style="position: absolute; top: -5px; right: -5px; background: #e62227; color: white; border: none; border-radius: 50%; width: 16px; height: 16px; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;">&times;</button>
            </div>
        `).join('');

        const row = document.createElement("div");
        row.classList.add("item-row");
        row.style.flexDirection = "column";
        row.style.alignItems = "flex-start";
        row.style.gap = "10px";
        row.innerHTML = `
            <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
                <div class="item-info">
                    <span class="item-name"><span class="category-badge">${catName}</span> ${p.name}</span>
                    <span class="item-details">يبدأ من ${displayPrice} ج.م</span>
                </div>
                <button class="btn-delete" onclick="deleteProduct(${pIndex})">حذف المنتج بالكامل</button>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 12px; color: #aaa;">صور المنتج:</span>
                <div>${imgsHtml}</div>
            </div>
        `;
        productsList.appendChild(row);
    });
}

window.deleteSingleImage = function(pIndex, imgIndex) {
    let products = JSON.parse(localStorage.getItem("organicProducts")) || [];
    if (products[pIndex]) {
        let imgs = products[pIndex].images || [products[pIndex].image];
        if (imgs.length <= 1) {
            showToast("يجب أن يحتوي المنتج على صورة واحدة على الأقل.", true);
            return;
        }
        if(confirm("هل تريد حذف هذه الصورة؟")) {
            imgs.splice(imgIndex, 1);
            products[pIndex].images = imgs;
            products[pIndex].image = imgs[0];
            localStorage.setItem("organicProducts", JSON.stringify(products));
            renderAdminProductsList();
            loadProducts();
            showToast("تم حذف الصورة بنجاح");
        }
    }
};

window.deleteProduct = function(index) {
    if(confirm("هل أنت متأكد من حذف هذا المنتج بالكامل؟")) {
        let products = JSON.parse(localStorage.getItem("organicProducts")) || [];
        products.splice(index, 1);
        localStorage.setItem("organicProducts", JSON.stringify(products));
        renderAdminProductsList();
        loadProducts();
        showToast("تم حذف المنتج بنجاح");
    }
};

/* ==================== 8. النشرة البريدية ==================== */
function setupNewsletter() {
    const newsletterForm = document.getElementById("newsletterForm");
    if (newsletterForm) {
        newsletterForm.addEventListener("submit", (e) => {
            e.preventDefault();
            showToast("تم الاشتراك في النشرة البريدية بنجاح!");
            newsletterForm.reset();
        });
    }
}

/* ==================== 9. الترجمة ==================== */
const translations = {
    ar: {
        nav_home: "الرئيسية",
        nav_store: "المتجر",
        nav_offers: "العروض",
        nav_story: "قصتنا",
        nav_usage: "طريقة الاستخدام",
        nav_contact: "تواصل معنا",
        cat_all: "جميع المنتجات",
        cat_dried: "فواكه مجففة",
        cat_powder: "بودر طبيعي",
        search_placeholder: "ابحث عن منتج...",
        hero_title_highlight: "ORGANIC Smile",
        hero_title: "فخامة الطبيعة في كل قضمة",
        hero_desc: "استمتع بأفخم الفواكه المجففة والمنتجات الطبيعية المختارة بعناية، لتجربة تسوق تليق بذوقك الرفيع مع ORGANIC Smile.",
        btn_shop: "تسوق الآن",
        btn_story: "اكتشف قصتنا",
        products_title_1: "منتجاتنا",
        products_title_2: "المميزة",
        products_subtitle: "اكتشف مجموعتنا الفاخرة من الفواكه المجففة والبودر الطبيعي 100%",
        about_title: "قصتنا مع ORGANIC Smile",
        about_p1: "نحن في ORGANIC Smile نؤمن بأن الطبيعة تقدم لنا أفضل ما لديها. نختار بعناية فائقة أجود أنواع الفواكه المجففة والمكسرات من مصادرها الطبيعية 100%.",
        about_p2: "هدفنا هو تقديم تجربة تسوق فاخرة تجمع بين الجودة العالية والمذاق الرائع، لنمنحك منتجات تليق بذوقك الرفيع وتحافظ على صحتك.",
        feat1: "100% طبيعي وعضوي",
        feat2: "جودة مضمونة",
        feat3: "توصيل سريع",
        feat4: "صحي ولذيذ",
        newsletter_title: "اشترك في نشرتنا البريدية",
        newsletter_desc: "احصل على أحدث العروض والخصومات الحصرية مباشرة في بريدك الإلكتروني",
        btn_subscribe: "اشترك الآن",
        footer_about: "متجرك الأول للفواكه المجففة والمنتجات الطبيعية الفاخرة. نقدم لك أفضل المنتجات المختارة بعناية فائقة.",
        footer_links: "روابط سريعة",
        footer_service: "خدمة العملاء",
        footer_return: "سياسة الإرجاع",
        footer_shipping: "الشحن والتوصيل",
        footer_faq: "الأسئلة الشائعة",
        footer_privacy: "سياسة الخصوصية",
        footer_location: "القاهرة، مصر",
        no_products_msg: "لا توجد منتجات مطابقة.",
        add_to_cart: "أضف إلى السلة"
    },
    en: {
        nav_home: "Home",
        nav_store: "Shop",
        nav_offers: "Offers",
        nav_story: "Brand Story",
        nav_usage: "Usage",
        nav_contact: "Contact Us",
        cat_all: "All Products",
        cat_dried: "Dried Fruits",
        cat_powder: "Natural Powder",
        search_placeholder: "Search product...",
        hero_title_highlight: "ORGANIC Smile",
        hero_title: "Nature's Luxury in Every Bite",
        hero_desc: "Enjoy the finest dried fruits and carefully selected natural products for a shopping experience tailored to your refined taste.",
        btn_shop: "Shop Now",
        btn_story: "Our Story",
        products_title_1: "Featured",
        products_title_2: "Products",
        products_subtitle: "Discover our luxury collection of 100% natural dried fruits and powders",
        about_title: "Our Story with ORGANIC Smile",
        about_p1: "At ORGANIC Smile, we believe nature offers its very best. We carefully select the finest dried fruits and nuts from 100% natural sources.",
        about_p2: "Our goal is to deliver a luxury shopping experience combining premium quality and exquisite taste to protect your health.",
        feat1: "100% Natural & Organic",
        feat2: "Guaranteed Quality",
        feat3: "Fast Delivery",
        feat4: "Healthy & Delicious",
        newsletter_title: "Subscribe to Our Newsletter",
        newsletter_desc: "Get the latest exclusive offers and discounts directly in your inbox",
        btn_subscribe: "Subscribe",
        footer_about: "Your premier store for luxury dried fruits and natural products. Bringing you carefully curated selections.",
        footer_links: "Quick Links",
        footer_service: "Customer Service",
        footer_return: "Return Policy",
        footer_shipping: "Shipping & Delivery",
        footer_faq: "FAQ",
        footer_privacy: "Privacy Policy",
        footer_location: "Cairo, Egypt",
        no_products_msg: "No matching products found.",
        add_to_cart: "Add to Cart"
    }
};

function setLanguage(lang) {
    const htmlTag = document.documentElement;
    const bodyTag = document.body;
    const langBtn = document.getElementById("langBtn");

    if (lang === "en") {
        htmlTag.setAttribute("lang", "en");
        htmlTag.setAttribute("dir", "ltr");
        bodyTag.classList.add("en");
        if (langBtn) langBtn.textContent = "AR";
    } else {
        htmlTag.setAttribute("lang", "ar");
        htmlTag.setAttribute("dir", "rtl");
        bodyTag.classList.remove("en");
        if (langBtn) langBtn.textContent = "EN";
    }

    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (translations[lang] && translations[lang][key]) {
            el.innerHTML = translations[lang][key];
        }
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
        const key = el.getAttribute("data-i18n-placeholder");
        if (translations[lang] && translations[lang][key]) {
            el.placeholder = translations[lang][key];
        }
    });

    loadProducts();
    loadHeroData();
}