# ORGANIC Smile

```
GitHub Pages (storefront)  ──►  Vercel  public API (read-only, MONGO_URI_READ)  ──►  MongoDB Atlas
Admin panel (local)        ──►  admin API (main.py, MONGO_URI_WRITE + ADMIN_TOKEN) ──►  MongoDB Atlas
```

## Run locally
```bash
# 1. admin API  (port 8000)
cd "organic smile admin" && pip install -r requirements.txt
cp .env.example .env        # fill MONGO_URI_WRITE and ADMIN_TOKEN
python setup_db.py          # once: validators, indexes, migrates old products
uvicorn main:app --port 8000 --reload

# 2. public API (port 8001)
cd "organic smile public api" && pip install -r requirements.txt
cp .env.example .env        # fill MONGO_URI_READ
uvicorn api.index:app --port 8001 --reload

# 3. serve the two front-ends (VS Code Live Server, port 5500, or:)
python -m http.server 5500   # run inside the storefront folder, and again (5501) in the admin folder
```
Open `admin.html`, enter your ADMIN_TOKEN, add products. Open the storefront `index.html`.

## Deploy
* **Public API** → Vercel project rooted at `organic smile public api`; set `MONGO_URI_READ` (and optionally `ALLOWED_ORIGINS`). In Atlas → Network Access allow `0.0.0.0/0` (Vercel has no fixed IP).
* **Storefront** → push to GitHub Pages; edit `API_BASE` in `config.js` to your Vercel URL.
* Verify: `python smoke_test.py --admin http://127.0.0.1:8000 --public https://YOUR.vercel.app --token ...`

## Endpoints
**Public (GET only)** — `/api/health` · `/api/products?category=&q=&limit=&skip=` · `/api/products/{id}` · `/api/categories` · `/api/offers` · `/api/hero` · `/api/storefront` (hero+offers+categories+products in one call) · `/api/images/{id}`

**Admin (header `X-Admin-Token`)** — `GET /admin/ping` · `GET /admin/stats` ·
products: `GET/POST /admin/products`, `GET/PUT/PATCH/DELETE /admin/products/{id}` ·
offers: `GET/POST /admin/offers`, `PUT/DELETE /admin/offers/{id}` ·
hero: `GET/PUT/DELETE /admin/hero` · images: `POST /admin/images`, `DELETE /admin/images/{id}`

Interactive docs: `http://127.0.0.1:8000/docs` and `http://127.0.0.1:8001/docs`.

## Data shape
Product: `{id, name, description, category: "dried"|"powder", sizes: [{label, price}], images: [id|url], isActive}`.
Images uploaded in the admin are resized in the browser and stored in the `images` collection; the public API turns their ids into `/api/images/{id}` URLs.
