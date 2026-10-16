/* extras.js - يتحمل بعد script.js في index.html و product.html */
(function () {
    // 1. إعطاء كل منتج معرّف ثابت (id) علشان رابط صفحة المنتج ميتأثرش بالحذف أو الترتيب
    function ensureProductIds() {
        var products = [];
        try {
            products = JSON.parse(localStorage.getItem("organicProducts")) || [];
            var changed = false;
            products.forEach(function (p) {
                if (!p.id) {
                    p.id = "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
                    changed = true;
                }
            });
            if (changed) localStorage.setItem("organicProducts", JSON.stringify(products));
        } catch (e) { /* تجاهل */ }
        return products;
    }
    window.ensureProductIds = ensureProductIds;
    ensureProductIds();

    // 2. الضغط على كارت المنتج في الصفحة الرئيسية يفتح صفحة المنتج
    var grid = document.getElementById("adminProducts");
    if (grid) {
        var productUrl = function (card) {
            var products = ensureProductIds();
            var p = null;
            try {
                // نفس فلترة script.js علشان نعرف الكارت ده أنهي منتج بالظبط
                var filtered = products.filter(function (x) {
                    return (currentCategory === "all" || x.category === currentCategory) &&
                        x.name.toLowerCase().includes(searchQuery.toLowerCase());
                });
                var cards = Array.prototype.slice.call(grid.querySelectorAll(".product-card"));
                p = filtered[cards.indexOf(card)];
            } catch (e) { /* نكمل بالاسم */ }
            if (!p) {
                var title = card.querySelector(".product-title");
                var name = title ? title.textContent.trim() : "";
                p = products.filter(function (x) { return x.name === name; })[0];
            }
            return p ? "product.html?id=" + encodeURIComponent(p.id) : null;
        };

        // capture: علشان الضغط على الصورة يفتح الصفحة بدل العارض المكبر
        grid.addEventListener("click", function (e) {
            if (e.target.closest("select, option, button, .thumb-img, a")) return;
            var card = e.target.closest(".product-card");
            if (!card) return;
            var url = productUrl(card);
            if (url) {
                e.stopPropagation();
                window.location.href = url;
            }
        }, true);

        grid.addEventListener("keydown", function (e) {
            if (e.key === "Enter" && e.target.classList && e.target.classList.contains("product-card")) {
                var url = productUrl(e.target);
                if (url) window.location.href = url;
            }
        });

        var decorate = function () {
            grid.querySelectorAll(".product-card").forEach(function (c) {
                if (!c.hasAttribute("tabindex")) c.setAttribute("tabindex", "0");
            });
        };
        new MutationObserver(decorate).observe(grid, { childList: true });
        decorate();
    }

    // 3. إصلاح: رسالة الواتساب كانت بتتجاهل الاسم والهاتف والعنوان وتكتب "زائر"
    window.sendOrderToWhatsApp = function () {
        var cart = JSON.parse(localStorage.getItem("organicCart")) || [];
        if (cart.length === 0) {
            showToast("السلة فارغة حالياً! قم بإضافة المنتجات أولاً.", true);
            return;
        }
        var val = function (id) {
            var el = document.getElementById(id);
            return el ? el.value.trim() : "";
        };
        var name = val("clientName"), phone = val("clientPhone"), address = val("clientAddress");
        if (!name || !phone || !address) {
            showToast("من فضلك املأ الاسم ورقم الهاتف وعنوان التوصيل.", true);
            return;
        }
        var msg = "🛒 *طلب جديد من ORGANIC Smile*\n------------------------------\n" +
            "👤 *بيانات العميل:*\nالاسم: " + name + "\nالهاتف: " + phone + "\nالعنوان: " + address +
            "\n\n📦 *المنتجات المطلوبة:*\n";
        var total = 0;
        cart.forEach(function (item, i) {
            var t = item.price * item.quantity;
            total += t;
            msg += (i + 1) + ". *" + item.name + "*\n   الكمية: " + item.quantity + " | السعر: " + t + " ج.م\n";
        });
        msg += "------------------------------\n💰 *الإجمالي الكلي:* " + total + " ج.م\n\nيرجى تأكيد الطلب.";
        window.open("https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(msg), "_blank");
        showToast("جاري تحويلك إلى واتساب...");
    };
})();