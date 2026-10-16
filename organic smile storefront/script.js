/* ORGANIC Smile storefront - talks ONLY to the public read-only API (see config.js) */
(function () {
    'use strict';
    const CFG = window.ORGANIC_CONFIG || {};
    const API = (CFG.API_BASE || '').replace(/\/$/, '');
    const WA = CFG.WHATSAPP || '201061429669';
    const FALLBACK_IMG = 'images/logo.jpg';
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

    /* ---------- tiny helpers ---------- */
    function h(tag, props, ...kids) {              // builds DOM with textContent => no XSS from product data
        const e = document.createElement(tag);
        Object.entries(props || {}).forEach(([k, v]) => {
            if (v == null || v === false) return;
            if (k === 'class') e.className = v;
            else if (k === 'text') e.textContent = v;
            else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
            else e.setAttribute(k, v);
        });
        kids.flat().forEach(c => c != null && e.append(c));
        return e;
    }
    async function api(path) {
        const r = await fetch(API + path, { headers: { Accept: 'application/json' } });
        if (!r.ok) { const err = new Error('API ' + r.status); err.status = r.status; throw err; }
        return r.json();
    }
    const fmt = n => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
    function toast(msg) {
        const t = $('#toast'); if (!t) return;
        t.textContent = msg; t.classList.add('show');
        clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
    }

    /* ---------- language (AR default, EN toggle) ---------- */
    const EN = {
        nav_home: 'Home', nav_store: 'Store', nav_offers: 'Offers', nav_story: 'Our story', nav_usage: 'How to use', nav_contact: 'Contact us',
        search_placeholder: 'Search for a product...', hero_title_highlight: 'ORGANIC Smile', hero_title: 'Luxury of nature in every bite',
        hero_desc: 'Enjoy the finest dried fruits and natural products, carefully selected for a shopping experience worthy of your taste.',
        btn_shop: 'Shop now', btn_story: 'Discover our story', products_title_1: 'Our', products_title_2: 'featured products',
        products_subtitle: 'Discover our luxury collection of 100% natural dried fruits and powders',
        cat_all: 'All products', cat_dried: 'Dried fruits', cat_powder: 'Natural powders',
        about_title: 'Our story with ORGANIC Smile',
        about_p1: 'At ORGANIC Smile we believe nature offers the best. We carefully choose the finest dried fruits and nuts from 100% natural sources.',
        about_p2: 'Our goal is a luxury shopping experience that combines high quality and great taste, with products that suit your taste and keep you healthy.',
        feat1: '100% natural & organic', feat2: 'Guaranteed quality', feat3: 'Fast delivery', feat4: 'Healthy & delicious',
        newsletter_title: 'Subscribe to our newsletter', newsletter_desc: 'Get the latest offers and exclusive discounts straight to your inbox',
        btn_subscribe: 'Subscribe', footer_about: 'Your first stop for dried fruits and luxury natural products, carefully selected.',
        footer_links: 'Quick links', footer_service: 'Customer service', footer_return: 'Return policy', footer_shipping: 'Shipping & delivery',
        footer_faq: 'FAQ', footer_privacy: 'Privacy policy', footer_location: 'Cairo, Egypt'
    };
    const T = {
        ar: { from: 'يبدأ من', cur: 'ج.م', add: 'أضف إلى السلة', added: 'تمت الإضافة إلى السلة', none: 'لا توجد منتجات مطابقة.',
              err: 'تعذر تحميل البيانات من الخادم. حاول مرة أخرى لاحقاً.', cartLink: 'عرض السلة', order: 'اطلب الآن عبر واتساب',
              qty: 'الكمية', size: 'الحجم', missing: 'المنتج غير موجود', fill: 'من فضلك أكمل الاسم ورقم الهاتف والعنوان', subscribed: 'تم الاشتراك، شكراً لك!' },
        en: { from: 'From', cur: 'EGP', add: 'Add to cart', added: 'Added to cart', none: 'No matching products.',
              err: 'Could not load data from the server. Please try again later.', cartLink: 'View cart', order: 'Order now on WhatsApp',
              qty: 'Quantity', size: 'Size', missing: 'Product not found', fill: 'Please fill in name, phone and address', subscribed: 'Subscribed, thank you!' }
    };
    let lang = localStorage.getItem('organicLang') === 'en' ? 'en' : 'ar';
    const t = k => T[lang][k];

    function setText(el, text) {
        const node = Array.from(el.childNodes).find(n => n.nodeType === 3 && n.textContent.trim());
        if (node) node.textContent = text + (el.children.length ? ' ' : ''); else if (!el.children.length) el.textContent = text;
    }
    function applyLang() {
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl';
        document.body.classList.toggle('en', lang === 'en');
        $$('[data-i18n]').forEach(el => {
            if (!el.dataset.ar) el.dataset.ar = (Array.from(el.childNodes).find(n => n.nodeType === 3 && n.textContent.trim()) || el).textContent.trim();
            setText(el, lang === 'en' ? (EN[el.dataset.i18n] || el.dataset.ar) : el.dataset.ar);
        });
        $$('[data-i18n-placeholder]').forEach(el => {
            if (!el.dataset.arPh) el.dataset.arPh = el.placeholder;
            el.placeholder = lang === 'en' ? (EN[el.dataset.i18nPlaceholder] || el.dataset.arPh) : el.dataset.arPh;
        });
        const btn = $('#langBtn'); if (btn) btn.textContent = lang === 'en' ? 'عربي' : 'EN';
    }

    /* ---------- cart (localStorage) ---------- */
    let cart = [];
    try {
        cart = (JSON.parse(localStorage.getItem('organicCart')) || []).map(i => ({
            key: i.key || i.name, id: i.id || '', name: i.name, size: i.size || '',
            price: Number(i.price) || 0, img: i.img || '', qty: Number(i.qty) || 1 }));
    } catch (e) { cart = []; }
    const saveCart = () => { localStorage.setItem('organicCart', JSON.stringify(cart)); updateCartCount(); };
    function updateCartCount() { const c = $('#cartCount'); if (c) c.textContent = cart.reduce((s, i) => s + i.qty, 0); }
    function addToCart(p, size, qty) {
        const key = p.id + '|' + size.label;
        const ex = cart.find(i => i.key === key);
        if (ex) ex.qty += qty;
        else cart.push({ key, id: p.id, name: p.name, size: size.label, price: size.price, img: p.images[0] || '', qty });
        saveCart(); renderCart(); toast(t('added'));
    }
    function cartTotal() { return cart.reduce((s, i) => s + i.price * i.qty, 0); }

    function renderCart() {
        const body = $('#cartModalBody'); if (!body) return;
        let list = $('#cartItems');
        if (!list) { list = h('div', { id: 'cartItems', style: 'display:flex;flex-direction:column;gap:10px' }); body.prepend(list); }
        list.replaceChildren();
        cart.forEach(item => {
            const change = d => { item.qty = Math.max(1, item.qty + d); saveCart(); renderCart(); };
            list.append(h('div', { class: 'cart-item-row' },
                h('div', { class: 'cart-item-info' },
                    h('img', { class: 'cart-item-img', src: item.img || FALLBACK_IMG, alt: item.name, onerror(e) { e.target.src = FALLBACK_IMG; } }),
                    h('div', {}, h('strong', { text: item.name }), h('br'),
                        h('small', { text: `${item.size} — ${fmt(item.price)} ${t('cur')}`, style: 'color:#C9A961' }))),
                h('div', { style: 'display:flex;align-items:center;gap:8px' },
                    h('button', { type: 'button', text: '−', 'aria-label': '-', onclick: () => change(-1), style: 'width:28px;height:28px;border-radius:50%;border:1px solid #C9A961;background:none;color:#C9A961;cursor:pointer' }),
                    h('span', { text: item.qty }),
                    h('button', { type: 'button', text: '+', 'aria-label': '+', onclick: () => change(1), style: 'width:28px;height:28px;border-radius:50%;border:1px solid #C9A961;background:none;color:#C9A961;cursor:pointer' }),
                    h('button', { type: 'button', text: '×', 'aria-label': 'remove', style: 'background:none;border:none;color:#ff6b6f;font-size:22px;cursor:pointer',
                        onclick: () => { cart = cart.filter(i => i !== item); saveCart(); renderCart(); } }))));
        });
        const empty = cart.length === 0;
        const es = $('#emptyCartState'), ft = $('#cartModalFooter');
        if (es) es.style.display = empty ? '' : 'none';
        if (ft) ft.style.display = empty ? 'none' : '';
        const tot = $('#cartTotalPrice'); if (tot) tot.textContent = `${fmt(cartTotal())} ${t('cur')}`;
    }
    const openCart = () => { renderCart(); $('#cartModalOverlay').classList.add('active'); };
    const closeCart = () => $('#cartModalOverlay').classList.remove('active');

    function checkout() {
        const name = $('#clientName').value.trim(), phone = $('#clientPhone').value.trim(), addr = $('#clientAddress').value.trim();
        if (!name || phone.replace(/\D/g, '').length < 8 || !addr) { toast(t('fill')); return; }
        const lines = cart.map((i, n) => `${n + 1}) ${i.name} (${i.size}) × ${i.qty} = ${fmt(i.price * i.qty)} ج.م`);
        const msg = ['طلب جديد من ORGANIC Smile', '', `الاسم: ${name}`, `الهاتف: ${phone}`, `العنوان: ${addr}`, '', 'الطلبات:', ...lines, '', `الإجمالي: ${fmt(cartTotal())} ج.م`].join('\n');
        window.open(`https://wa.me/${WA}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
        cart = []; saveCart(); renderCart(); closeCart();
    }

    /* ---------- hero + offers ticker (from /api/storefront) ---------- */
    function applyHero(hero) {
        if (!hero) return;
        const title = $('#heroTitleText');
        if (hero.title && title) { title.textContent = hero.title; title.removeAttribute('data-i18n'); }
        if (hero.titleImage) {
            $('#heroTitleImg').src = hero.titleImage;
            $('#heroTitleImgContainer').style.display = 'block';
            $('#heroTitleContainer').style.display = 'none';
        }
        if (hero.mainImage) $('#heroMainImg').src = hero.mainImage;
    }
    function renderTicker(offers) {
        const bar = $('#tickerContainer'), track = $('#adminTicker'); if (!bar || !track) return;
        track.replaceChildren();
        if (!offers || !offers.length) { bar.style.display = 'none'; return; }
        bar.style.display = '';
        let half = [...offers]; while (half.length < 6) half = half.concat(offers);
        [...half, ...half].forEach(o => track.append(h('span', {}, h('i', { class: 'fa-solid fa-star' }), o.text)));  // 2 identical halves = seamless -50% marquee
    }

    /* ---------- products ---------- */
    const state = { category: 'all', q: '', products: [], req: 0 };

    function productCard(p) {
        const sizes = p.sizes.length ? p.sizes : [{ label: '', price: p.priceFrom }];
        let sel = sizes[0];
        const price = h('span', { class: 'current-price', text: `${fmt(sel.price)} ${t('cur')}` });
        const href = `product.html?id=${encodeURIComponent(p.id)}`;
        const img = h('img', { class: 'product-image', src: p.images[0] || FALLBACK_IMG, alt: p.name, loading: 'lazy',
            onerror(e) { e.target.src = FALLBACK_IMG; } });
        const select = sizes.length > 1 ? h('select', { class: 'size-select', 'aria-label': t('size'),
            onchange(e) { sel = sizes[e.target.selectedIndex]; price.textContent = `${fmt(sel.price)} ${t('cur')}`; } },
            sizes.map(s => h('option', { text: s.label }))) : (sizes[0].label ? h('small', { text: sizes[0].label, style: 'color:#777' }) : null);
        return h('div', { class: 'product-card' },
            h('a', { href, class: 'product-image-container', style: 'display:block' }, img),
            h('div', { class: 'product-info' },
                h('h3', { class: 'product-title' }, h('a', { href, text: p.name, style: 'color:inherit;text-decoration:none' })),
                select,
                h('div', { class: 'product-price' }, price),
                h('button', { type: 'button', class: 'add-to-cart', text: t('add'), onclick: () => addToCart(p, sel, 1) })));
    }
    function renderProducts() {
        const grid = $('#productsGrid'); if (!grid) return;
        grid.replaceChildren();
        if (!state.products.length) {
            grid.append(h('div', { style: 'grid-column:1/-1;text-align:center;padding:40px;color:#888' },
                h('i', { class: 'fa-solid fa-box-open', style: 'font-size:40px;margin-bottom:15px;color:#C9A961;display:block' }),
                h('p', { text: t('none') })));
            return;
        }
        state.products.forEach(p => grid.append(productCard(p)));
    }
    async function fetchProducts() {
        const my = ++state.req;                      // ignore out-of-order responses while typing/switching tabs
        const qs = new URLSearchParams();
        if (state.category !== 'all') qs.set('category', state.category);
        if (state.q) qs.set('q', state.q);
        try {
            const data = await api('/api/products?' + qs);
            if (my !== state.req) return;
            state.products = data.items; renderProducts();
        } catch (e) { if (my === state.req) showGridError(); }
    }
    function showGridError() {
        const grid = $('#productsGrid'); if (!grid) return;
        grid.replaceChildren(h('div', { style: 'grid-column:1/-1;text-align:center;padding:40px;color:#e62227' },
            h('i', { class: 'fa-solid fa-server', style: 'font-size:40px;margin-bottom:15px;display:block' }), h('p', { text: t('err') })));
    }
    async function loadHome() {
        if (!$('#productsGrid')) return;
        try {
            const d = await api('/api/storefront');
            applyHero(d.hero); renderTicker(d.offers);
            state.products = d.products.items; renderProducts();
        } catch (e) { console.error(e); showGridError(); }
    }

    /* ---------- product page (product.html?id=...) ---------- */
    const PP = {
        ar: { home: 'الرئيسية', store: 'المتجر', cat: 'القسم', dried: 'فواكه مجففة', powder: 'بودر طبيعي', sizeLbl: 'اختر الحجم', qtyLbl: 'الكمية',
              total: 'الإجمالي', details: 'تفاصيل المنتج', sizes: 'الأحجام المتاحة', related: 'منتجات مشابهة', back: 'العودة للمتجر',
              nfM: 'ممكن يكون اتحذف أو الرابط غير صحيح.', inc: 'زيادة الكمية', dec: 'تقليل الكمية', img: 'عرض الصورة',
              dDried: 'فواكه مجففة طبيعية مختارة بعناية، مناسبة كسناك صحي أو إضافة للفطار والحلويات.',
              dPowder: 'بودر طبيعي مناسب للمشروبات والسموذي والمخبوزات والحلويات.', f1: '100% طبيعي وعضوي', f2: 'جودة مضمونة', f3: 'توصيل سريع' },
        en: { home: 'Home', store: 'Shop', cat: 'Category', dried: 'Dried Fruits', powder: 'Natural Powder', sizeLbl: 'Choose size', qtyLbl: 'Quantity',
              total: 'Total', details: 'Product details', sizes: 'Available sizes', related: 'Related products', back: 'Back to shop',
              nfM: 'It may have been removed or the link is incorrect.', inc: 'Increase quantity', dec: 'Decrease quantity', img: 'View image',
              dDried: 'Carefully selected natural dried fruit, perfect as a healthy snack or a topping for breakfast and desserts.',
              dPowder: 'Natural powder for drinks, smoothies, baking and desserts.', f1: '100% natural & organic', f2: 'Guaranteed quality', f3: 'Fast delivery' }
    };
    let rerenderProduct = null;                      // set while a product page is shown; called on language change

    async function loadProductPage() {
        const root = $('#ppRoot'); if (!root) return;
        const params = new URLSearchParams(location.search);
        try {
            let p;
            if (params.get('id')) p = await api('/api/products/' + encodeURIComponent(params.get('id')));
            else if (params.get('name')) {                                  // old links: product.html?name=...
                const r = await api('/api/products?q=' + encodeURIComponent(params.get('name')));
                p = r.items.find(x => x.name === params.get('name'));
                if (!p) throw Object.assign(new Error('nf'), { status: 404 });
            } else throw Object.assign(new Error('nf'), { status: 404 });
            let related = [];
            try {                                                            // non-critical: never blocks the page
                related = (await api(`/api/products?category=${encodeURIComponent(p.category)}&limit=5`)).items.filter(x => x.id !== p.id).slice(0, 4);
            } catch (e) { /* ignore */ }
            const draw = () => renderProductPage(root, p, related);
            rerenderProduct = draw; draw();
        } catch (e) {
            const pp = PP[lang];
            root.replaceChildren(h('div', { class: 'pp-empty' }, h('i', { class: 'fa-solid fa-box-open' }),
                h('h2', { text: e.status === 404 ? t('missing') : t('err') }),
                e.status === 404 ? h('p', { text: pp.nfM }) : null,
                h('a', { href: 'index.html#productsSection', text: pp.back })));
        }
    }

    function renderProductPage(root, p, related) {
        const pp = PP[lang];
        const sizes = p.sizes.length ? p.sizes : [{ label: '—', price: p.priceFrom }];
        const images = p.images.length ? p.images : [FALLBACK_IMG];
        const st = { size: 0, qty: 1, img: 0 };                              // survives only until the next language re-render
        const catName = p.category === 'powder' ? pp.powder : p.category === 'dried' ? pp.dried : p.category;
        document.title = `${p.name} | ORGANIC Smile`;

        const mainImg = h('img', { src: images[0], alt: p.name, onerror(e) { e.target.src = FALLBACK_IMG; } });
        const mainWrap = h('div', { class: 'pp-gallery-main', onclick: () => openLightbox(images[st.img]) }, mainImg);
        const thumbBtns = images.map((src, i) => h('button', { type: 'button', 'aria-label': `${pp.img} ${i + 1}`,
            onclick: () => { st.img = i; refresh(); } }, h('img', { src, alt: '' })));
        const thumbs = images.length > 1 ? h('div', { class: 'pp-thumbs' }, thumbBtns) : null;

        // The price block is the UNIT price of the chosen size - it never multiplies with quantity.
        // The multiplied value lives only in the reserved "total" line below the buttons.
        const priceEl = h('div', { class: 'pp-price' });
        const sizeBtns = sizes.map((s, i) => h('button', { type: 'button', class: 'pp-size', text: s.label, onclick: () => { st.size = i; refresh(); } }));
        const qtyEl = h('span', { text: '1' });
        const totalEl = h('p', { class: 'pp-total' });

        function refresh() {
            const s = sizes[st.size];
            priceEl.textContent = `${fmt(s.price)} ${t('cur')}`;
            qtyEl.textContent = st.qty;
            totalEl.textContent = st.qty > 1 ? `${pp.total}: ${fmt(s.price * st.qty)} ${t('cur')}` : '';   // empty line keeps its height (min-height) -> no layout jump
            sizeBtns.forEach((b, i) => b.classList.toggle('active', i === st.size));
            thumbBtns.forEach((b, i) => b.classList.toggle('active', i === st.img));
            mainImg.src = images[st.img];
        }

        const rows = [h('div', { class: 'pp-row' }, h('span', { text: pp.cat }), h('span', { text: catName })),
            h('div', { class: 'pp-row' }, h('span', { text: pp.sizes }), h('span', { text: sizes.length })),
            ...sizes.map(s => h('div', { class: 'pp-row' }, h('span', { text: s.label }), h('span', { text: `${fmt(s.price)} ${t('cur')}` })))];   // every size/price listed once

        const relSection = related.length ? h('section', { class: 'pp-related' }, h('h2', { text: pp.related }),
            h('div', { class: 'pp-rel-grid' }, related.map(r => h('a', { class: 'pp-rel', href: `product.html?id=${encodeURIComponent(r.id)}` },
                h('img', { src: r.images[0] || FALLBACK_IMG, alt: r.name, loading: 'lazy', onerror(e) { e.target.src = FALLBACK_IMG; } }),
                h('div', {}, h('strong', { text: r.name }), h('span', { text: `${t('from')} ${fmt(r.priceFrom)} ${t('cur')}` })))))) : null;

        root.replaceChildren(
            h('nav', { class: 'pp-crumbs', 'aria-label': 'breadcrumb' },
                h('a', { href: 'index.html', text: pp.home }), h('span', { text: '/' }),
                h('a', { href: 'index.html#productsSection', text: pp.store }), h('span', { text: '/' }), h('span', { text: p.name })),
            h('div', { class: 'pp-grid' },
                h('div', {}, mainWrap, thumbs),
                h('div', {},
                    h('span', { class: 'pp-badge', text: catName }),
                    h('h1', { class: 'pp-title', text: p.name }),
                    h('p', { class: 'pp-desc', text: p.description || (p.category === 'powder' ? pp.dPowder : pp.dDried) }),
                    priceEl,
                    h('span', { class: 'pp-label', text: pp.sizeLbl }), h('div', { class: 'pp-sizes' }, sizeBtns),
                    h('span', { class: 'pp-label', text: pp.qtyLbl }),
                    h('div', { class: 'pp-buy' },
                        h('div', { class: 'pp-qty' },
                            h('button', { type: 'button', text: '−', 'aria-label': pp.dec, onclick: () => { st.qty = Math.max(1, st.qty - 1); refresh(); } }), qtyEl,
                            h('button', { type: 'button', text: '+', 'aria-label': pp.inc, onclick: () => { st.qty = Math.min(99, st.qty + 1); refresh(); } })),
                        h('button', { type: 'button', class: 'pp-add', onclick: () => addToCart(p, sizes[st.size], st.qty) },
                            h('i', { class: 'fa-solid fa-bag-shopping' }), ' ' + t('add'))),
                    totalEl,
                    h('button', { type: 'button', class: 'pp-wa', onclick: () => {
                        const s = sizes[st.size];
                        const msg = `🛒 *طلب من ORGANIC Smile*\n------------------------------\n📦 *${p.name}* (${s.label})\nالكمية: ${st.qty} | الإجمالي: ${fmt(s.price * st.qty)} ج.م\n------------------------------\nيرجى تأكيد الطلب وتحديد عنوان التوصيل.`;
                        window.open(`https://wa.me/${WA}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
                    } }, h('i', { class: 'fa-brands fa-whatsapp' }), ' ' + t('order')),
                    h('div', { class: 'pp-details' }, h('h2', { text: pp.details }), rows,
                        h('ul', { class: 'pp-points' },
                            h('li', {}, h('i', { class: 'fa-solid fa-leaf' }), pp.f1),
                            h('li', {}, h('i', { class: 'fa-solid fa-award' }), pp.f2),
                            h('li', {}, h('i', { class: 'fa-solid fa-truck-fast' }), pp.f3))))),
            relSection);
        refresh();
    }
    function openLightbox(src) {
        const box = h('div', { class: 'pp-lightbox', onclick: () => box.remove() }, h('img', { src, alt: '' }));
        document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { box.remove(); document.removeEventListener('keydown', esc); } });
        document.body.append(box);
    }

    /* ---------- init ---------- */
    document.addEventListener('DOMContentLoaded', () => {
        applyLang(); updateCartCount(); renderCart();

        const langBtn = $('#langBtn');
        if (langBtn) langBtn.addEventListener('click', () => {
            lang = lang === 'ar' ? 'en' : 'ar'; localStorage.setItem('organicLang', lang);
            applyLang(); renderProducts(); renderCart(); if (rerenderProduct) rerenderProduct();
        });
        const menuBtn = $('#mobileMenuBtn'), links = $('#navLinks');
        if (menuBtn && links) {
            menuBtn.addEventListener('click', () => links.classList.toggle('active'));
            $$('a', links).forEach(a => a.addEventListener('click', () => links.classList.remove('active')));
        }
        $$('.tab-btn').forEach(b => b.addEventListener('click', () => {
            $$('.tab-btn').forEach(x => x.classList.toggle('active', x === b));
            state.category = b.dataset.category || 'all'; fetchProducts();
        }));
        const search = $('#searchInput');
        if (search) {
            let timer;
            search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { state.q = search.value.trim(); fetchProducts(); }, 300); });
            search.addEventListener('keydown', e => { if (e.key === 'Enter') { const s = $('#productsSection'); if (s) s.scrollIntoView({ behavior: 'smooth' }); } });
        }
        const overlay = $('#cartModalOverlay');
        if (overlay) {
            $('#openCartBtn').addEventListener('click', openCart);
            $('#closeCartBtn').addEventListener('click', closeCart);
            overlay.addEventListener('click', e => { if (e.target === overlay) closeCart(); });
            document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCart(); });
            $('#continueShoppingBtn').addEventListener('click', () => { closeCart(); const s = $('#productsSection'); if (s) s.scrollIntoView({ behavior: 'smooth' }); else location.href = 'index.html#productsSection'; });
            $('#checkoutBtn').addEventListener('click', checkout);
            if (location.hash === '#cart') openCart();
        }
        const nl = $('#newsletterForm');
        if (nl) nl.addEventListener('submit', e => { e.preventDefault(); nl.reset(); toast(t('subscribed')); });

        loadHome();
        loadProductPage();
    });
})();
