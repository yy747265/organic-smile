"""End-to-end check: admin API writes -> MongoDB -> public API reads.  Cleans up after itself.

    pip install requests
    python smoke_test.py --admin http://127.0.0.1:8000 --public http://127.0.0.1:8001 --token YOUR_ADMIN_TOKEN
    python smoke_test.py --admin http://127.0.0.1:8000 --public https://YOUR-PROJECT.vercel.app --token ...
"""
import argparse
import sys
import time

import requests

ap = argparse.ArgumentParser()
ap.add_argument("--admin", default="http://127.0.0.1:8000")
ap.add_argument("--public", default="http://127.0.0.1:8001")
ap.add_argument("--token", required=True)
a = ap.parse_args()
A, P, H = a.admin.rstrip("/"), a.public.rstrip("/"), {"X-Admin-Token": a.token}
PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
fails = 0


def check(name, cond, extra=""):
    global fails
    print(("PASS " if cond else "FAIL ") + name + (f"  -> {extra}" if not cond and extra else ""))
    fails += not cond


def pub(path, **params):  # the _t param bypasses Vercel's 30s CDN cache
    return requests.get(P + path, params={**params, "_t": time.time()}, timeout=20)


check("admin rejects missing/wrong token", requests.get(A + "/admin/products").status_code == 401
      and requests.get(A + "/admin/products", headers={"X-Admin-Token": "nope"}).status_code == 401)
check("admin accepts token", requests.get(A + "/admin/ping", headers=H).status_code == 200)
check("public /api/health", pub("/api/health").status_code == 200, pub("/api/health").text)

img = requests.post(A + "/admin/images", headers=H, json={"data": PNG}); check("upload image", img.status_code == 201, img.text)
img_id = img.json().get("id")
bad = requests.post(A + "/admin/images", headers=H, json={"data": "data:text/html;base64,PGI+"}); check("reject non-image upload", bad.status_code == 400)

body = {"name": "__smoke_test__", "category": "dried", "sizes": [{"label": "250g", "price": 99}, {"label": "500g", "price": 180}], "images": [img_id]}
r = requests.post(A + "/admin/products", headers=H, json=body); check("create product", r.status_code == 201, r.text)
pid = r.json().get("id")
check("reject duplicate name", requests.post(A + "/admin/products", headers=H, json=body).status_code == 409)
check("reject bad category", requests.post(A + "/admin/products", headers=H, json={**body, "name": "x", "category": "zzz"}).status_code == 422)
check("reject price <= 0", requests.post(A + "/admin/products", headers=H, json={**body, "name": "y", "sizes": [{"label": "a", "price": 0}]}).status_code == 422)

o = requests.post(A + "/admin/offers", headers=H, json={"text": "__smoke offer__"}); check("create offer", o.status_code == 201, o.text)
oid = o.json().get("id")
h = requests.put(A + "/admin/hero", headers=H, json={"title": "__smoke hero__", "mainImage": img_id}); check("save hero", h.status_code == 200, h.text)

lst = pub("/api/products", q="__smoke").json()
check("public list finds product (search q)", any(p["id"] == pid for p in lst["items"]), str(lst)[:200])
check("public category filter", any(p["id"] == pid for p in pub("/api/products", category="dried", q="__smoke").json()["items"])
      and not pub("/api/products", category="powder", q="__smoke").json()["items"])
one = pub(f"/api/products/{pid}"); check("public product by id", one.status_code == 200 and one.json()["priceFrom"] == 99, one.text)
url = (one.json().get("images") or [""])[0]
im = requests.get(url, timeout=20) if url.startswith("http") else None
check("public image URL serves the PNG", im is not None and im.status_code == 200 and im.headers.get("content-type") == "image/png", url)
check("public categories endpoint", any(c["id"] == "dried" and c["count"] >= 1 for c in pub("/api/categories").json()))
check("public offers endpoint", any(x["text"] == "__smoke offer__" for x in pub("/api/offers").json()))
hero = pub("/api/hero").json(); check("public hero endpoint", hero["title"] == "__smoke hero__" and hero["mainImage"], str(hero))
sf = pub("/api/storefront").json(); check("public storefront bundle", set(sf) == {"hero", "offers", "categories", "products"}, str(list(sf)))

requests.patch(A + f"/admin/products/{pid}", headers=H, json={"isActive": False})
check("hidden product disappears from public API", pub(f"/api/products/{pid}").status_code == 404
      and not any(p["id"] == pid for p in pub("/api/products", q="__smoke").json()["items"]))

# cleanup
check("delete product", requests.delete(A + f"/admin/products/{pid}", headers=H).status_code == 200)
check("product image removed with product", requests.get(url, timeout=20).status_code == 404 if url.startswith("http") else True)
requests.delete(A + f"/admin/offers/{oid}", headers=H)
requests.put(A + "/admin/hero", headers=H, json={"title": ""}); requests.delete(A + "/admin/hero", headers=H)
check("hero images reset", pub("/api/hero").json()["mainImage"] is None)
print("\nALL PASSED" if not fails else f"\n{fails} CHECK(S) FAILED")
sys.exit(1 if fails else 0)
