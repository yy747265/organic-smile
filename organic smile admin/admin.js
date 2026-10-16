/* ORGANIC Smile admin panel -> talks to the admin API (main.py) */
(function () {
    'use strict';
    const ADMIN_API = (window.ADMIN_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
    const PUBLIC_API = (window.PUBLIC_API_URL || 'http://127.0.0.1:8001').replace(/\/$/, '');
    const CAT_NAMES = { dried: 'فواكه مجففة', powder: 'بودر طبيعي' };
    const $ = id => document.getElementById(id);

    /* ---------- helpers ---------- */
    function notify(msg, bad) {
        const n = document.createElement('div');
        n.textContent = msg;
        n.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:999;padding:12px 22px;border-radius:999px;font-weight:700;' +
            'font-family:Tajawal,sans-serif;max-width:90vw;' + (bad ? 'background:#e62227;color:#fff' : 'background:#C9A961;color:#000');
        document.body.append(n); setTimeout(() => n.remove(), bad ? 5000 : 2500);
    }
    function h(tag, props, ...kids) {
        const e = document.createElement(tag);
        Object.entries(props || {}).forEach(([k, v]) => {
            if (v == null) return;
            if (k === 'text') e.textContent = v; else if (k === 'class') e.className = v;
            else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
        });
        kids.flat().forEach(c => c != null && e.append(c)); return e;
    }
    function askToken() {
        const t = prompt('أدخل مفتاح الإدارة (ADMIN_TOKEN):');
        if (t) sessionStorage.setItem('adminToken', t.trim());
        return t ? t.trim() : null;
    }
    async function adminFetch(path, opts = {}, retried = false) {
        const token = sessionStorage.getItem('adminToken') || askToken();
        if (!token) throw new Error('مطلوب مفتاح الإدارة');
        let res;
        try {
            res = await fetch(ADMIN_API + path, {
                method: opts.method || 'GET',
                headers: { 'X-Admin-Token': token, ...(opts.json ? { 'Content-Type': 'application/json' } : {}) },
                body: opts.json ? JSON.stringify(opts.json) : undefined
            });
        } catch (e) {
            console.error('Admin API unreachable:', ADMIN_API, e);
            throw new Error(
                'تعذر الاتصال بالخادم.\n' +
                '1. افتح ترمينال في مجلد "organic smile admin"\n' +
                '2. شغّل: uvicorn main:app --port 8000 --reload\n' +
                '3. تأكد أن .env يحتوي على MONGO_URI_WRITE و ADMIN_TOKEN\n' +
                'العنوان الحالي: ' + ADMIN_API
            );
        }
        if (res.status === 401 && !retried) { sessionStorage.removeItem('adminToken'); return adminFetch(path, opts, true); }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const d = data.detail;
            throw new Error(Array.isArray(d) ? d.map(x => `${(x.loc || []).slice(1).join('.')}: ${x.msg}`).join(' | ') : (d || 'خطأ ' + res.status));
        }
        return data;
    }
    // shrink photos in the browser (max 1000px JPEG) so uploads stay small and fast
    async function compress(file, maxSide = 1000, quality = 0.82) {
        const bmp = await createImageBitmap(file);
        const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
        const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(bmp, 0, 0, c.width, c.height);
        return c.toDataURL('image/jpeg', quality);
    }
    async function uploadImage(file) {
        const r = await adminFetch('/admin/images', { method: 'POST', json: { data: await compress(file) } });
        return r.id;
    }
    const deleteImagesQuietly = ids => Promise.all(ids.map(id => adminFetch('/admin/images/' + id, { method: 'DELETE' }).catch(() => {})));
    function clearPreview(id) { const b = $(id); if (b) b.innerHTML = ''; }
    function busy(form, on) { const b = form.querySelector('button[type=submit]'); if (b) b.disabled = on; }

    /* ---------- products ---------- */
    async function loadProducts() {
        const list = $('productsList'); if (!list) return;
        try {
            const products = await adminFetch('/admin/products');
            list.replaceChildren();
            products.forEach(p => {
                const sizes = (p.sizes || []).map(s => typeof s === 'string' ? s : `${s.label} - ${s.price}`).join(' | ');
                const active = p.isActive !== false;
                list.append(h('div', { class: 'item-row' },
                    h('div', {}, h('span', { class: 'category-badge', text: CAT_NAMES[p.category] || p.category }),
                        h('strong', { text: p.name }), h('br'), h('small', { text: sizes, style: 'color:#9b9686' })),
                    h('div', { style: 'display:flex;gap:8px' },
                        h('button', { type: 'button', class: 'btn-delete', text: active ? 'إخفاء' : 'إظهار',
                            style: active ? '' : 'color:#C9A961;border-color:#C9A961;background:none',
                            onclick: async () => {
                                try { await adminFetch('/admin/products/' + p.id, { method: 'PATCH', json: { isActive: !active } }); loadProducts(); }
                                catch (e) { notify(e.message, true); }
                            } }),
                        h('button', { type: 'button', class: 'btn-delete', text: 'حذف',
                            onclick: async () => {
                                if (!confirm(`هل أنت متأكد من حذف: ${p.name}؟`)) return;
                                try { await adminFetch('/admin/products/' + p.id, { method: 'DELETE' }); notify('تم الحذف بنجاح'); loadProducts(); }
                                catch (e) { notify(e.message, true); }
                            } }))));
            });
        } catch (e) { list.replaceChildren(h('p', { text: e.message, style: 'color:#ff6b6f' })); }
    }

    function initProductForm() {
        const addSize = $('addSizeBtn'), box = $('sizesContainer'), form = $('addProductForm');
        if (addSize) addSize.addEventListener('click', () => box.append(h('div', { class: 'size-row' },
            h('input', { type: 'text', placeholder: 'الحجم (مثال: 250 جرام)', class: 'size-name' }),
            h('input', { type: 'number', placeholder: 'السعر (ج.م)', class: 'size-price', min: '1', step: 'any' }))));
        if (!form) return;
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const sizes = Array.from(document.querySelectorAll('.size-row')).map(r => ({
                label: r.querySelector('.size-name').value.trim(), price: parseFloat(r.querySelector('.size-price').value) }))
                .filter(s => s.label || s.price);
            if (!sizes.length || sizes.some(s => !s.label || !(s.price > 0))) return notify('أدخل اسم وسعراً صحيحاً لكل حجم', true);
            const files = Array.from($('pFiles').files);
            if (!files.length) return notify('اختر صورة واحدة على الأقل', true);
            if (files.length > 8) return notify('الحد الأقصى 8 صور', true);

            busy(form, true);
            const uploaded = [];
            try {
                for (const f of files) uploaded.push(await uploadImage(f));
                await adminFetch('/admin/products', { method: 'POST', json: {
                    name: $('pName').value.trim(), description: '', category: $('pCategory').value,
                    sizes, images: uploaded, isActive: true } });
                notify('تم إضافة المنتج بنجاح!');
                form.reset(); clearPreview('previewProduct');
                box.querySelectorAll('.size-row').forEach((r, i) => i && r.remove());
                loadProducts();
            } catch (err) {
                await deleteImagesQuietly(uploaded);               // don't leave orphan images behind
                notify(err.message, true);
            } finally { busy(form, false); }
        });
    }

    /* ---------- offers ---------- */
    async function loadOffers() {
        const list = $('offersList'); if (!list) return;
        try {
            const offers = await adminFetch('/admin/offers');
            list.replaceChildren();
            offers.forEach(o => list.append(h('div', { class: 'item-row' },
                h('span', { text: o.text }),
                h('button', { type: 'button', class: 'btn-delete', text: 'حذف', onclick: async () => {
                    try { await adminFetch('/admin/offers/' + o.id, { method: 'DELETE' }); loadOffers(); }
                    catch (e) { notify(e.message, true); } } }))));
        } catch (e) { list.replaceChildren(h('p', { text: e.message, style: 'color:#ff6b6f' })); }
    }
    function initOfferForm() {
        const form = $('addOfferForm'); if (!form) return;
        form.addEventListener('submit', async e => {
            e.preventDefault(); busy(form, true);
            try {
                const text = $('offerText').value.trim();
                const existing = await adminFetch('/admin/offers');
                await adminFetch('/admin/offers', { method: 'POST', json: { text, order: existing.length } });
                form.reset(); notify('تمت إضافة العرض'); loadOffers();
            } catch (err) { notify(err.message, true); } finally { busy(form, false); }
        });
    }

    /* ---------- hero ---------- */
    async function loadHero() {
        if (!$('heroForm')) return;
        try {
            const hero = await adminFetch('/admin/hero');
            $('heroTitleInput').value = hero.title || '';
            [['previewHeroTitle', hero.titleImage], ['previewHeroMain', hero.mainImage]].forEach(([box, ref]) => {
                clearPreview(box);
                if (ref && /^[0-9a-f]{24}$/.test(ref)) $(box).append(h('img', { src: `${PUBLIC_API}/api/images/${ref}`, alt: '' }));
            });
        } catch (e) { notify(e.message, true); }
    }
    function initHeroForm() {
        const form = $('heroForm'); if (!form) return;
        form.addEventListener('submit', async e => {
            e.preventDefault(); busy(form, true);
            const uploaded = [];
            try {
                const payload = { title: $('heroTitleInput').value.trim() };
                const t = $('heroTitleImgInput').files[0], m = $('heroMainImgInput').files[0];
                if (t) { payload.titleImage = await uploadImage(t); uploaded.push(payload.titleImage); }
                if (m) { payload.mainImage = await uploadImage(m); uploaded.push(payload.mainImage); }
                await adminFetch('/admin/hero', { method: 'PUT', json: payload });
                $('heroTitleImgInput').value = ''; $('heroMainImgInput').value = '';
                notify('تم حفظ تغييرات الواجهة'); loadHero();
            } catch (err) { await deleteImagesQuietly(uploaded); notify(err.message, true); }
            finally { busy(form, false); }
        });
        $('removeHeroImgsBtn').addEventListener('click', async () => {
            if (!confirm('إزالة صور الواجهة المخصصة والعودة للشكل الافتراضي؟')) return;
            try { await adminFetch('/admin/hero', { method: 'DELETE' }); notify('تمت الإزالة'); loadHero(); }
            catch (err) { notify(err.message, true); }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        const change = $('changeTokenBtn');
        if (change) change.addEventListener('click', () => { sessionStorage.removeItem('adminToken'); askToken(); loadAll(); });
        initProductForm(); initOfferForm(); initHeroForm();
        loadAll();
    });
    function loadAll() { loadProducts(); loadOffers(); loadHero(); }
})();
