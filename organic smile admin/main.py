"""ORGANIC Smile - ADMIN API (uses the WRITE database user).

Run locally:  uvicorn main:app --port 8000 --reload
Every /admin/* route requires the header  X-Admin-Token: <ADMIN_TOKEN from .env>
"""
import base64
import binascii
import hmac
import os
import re
from datetime import datetime, timezone
from typing import List, Optional

from bson import Binary, ObjectId
from bson.errors import InvalidId
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from pymongo import MongoClient

load_dotenv()

DB_NAME = os.environ.get("MONGO_DB", "organic_smile")
ORIGINS = [o.strip() for o in os.environ.get(
    "ALLOWED_ORIGINS",
    "http://127.0.0.1:5500,http://localhost:5500,http://127.0.0.1:5501,http://localhost:5501",
).split(",") if o.strip()]
CATEGORIES = {"dried", "powder"}
MAX_IMAGE_BYTES = 2 * 1024 * 1024

app = FastAPI(title="ORGANIC Smile admin API")
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

_client: Optional[MongoClient] = None


def get_db():
    global _client
    uri = os.environ.get("MONGO_URI_WRITE")
    if not uri:
        raise HTTPException(503, "MONGO_URI_WRITE is not configured")
    if _client is None:
        _client = MongoClient(uri, serverSelectionTimeoutMS=5000)
    return _client[DB_NAME]


def require_admin(x_admin_token: Optional[str] = Header(None)):
    expected = os.environ.get("ADMIN_TOKEN", "")
    if not expected:
        raise HTTPException(503, "ADMIN_TOKEN is not set in .env - refusing to accept writes")
    if not x_admin_token or not hmac.compare_digest(x_admin_token, expected):
        raise HTTPException(401, "Invalid admin token")


def now():
    return datetime.now(timezone.utc)


def oid_or_404(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(404, "Not found")


# ---------- validation models ----------

IMAGE_REF = re.compile(r"^([0-9a-f]{24}|https?://\S+|images/[\w\-. /]+)$")


class Size(BaseModel):
    label: str = Field(min_length=1, max_length=60)
    price: float = Field(gt=0, le=1_000_000)

    @field_validator("label")
    @classmethod
    def strip_label(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("size label is empty")
        return v


def _check_category(v):
    if v not in CATEGORIES:
        raise ValueError(f"category must be one of {sorted(CATEGORIES)}")
    return v


def _check_images(v):
    for ref in v:
        if not IMAGE_REF.match(ref):
            raise ValueError(f"invalid image reference: {ref[:40]}")
    return v


class ProductIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field("", max_length=2000)
    category: str
    sizes: List[Size] = Field(min_length=1, max_length=12)
    images: List[str] = Field(default_factory=list, max_length=8)
    isActive: bool = True

    @field_validator("category")
    @classmethod
    def cat(cls, v):
        return _check_category(v)

    @field_validator("images")
    @classmethod
    def imgs(cls, v):
        return _check_images(v)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("name is empty")
        return v


class ProductPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    description: Optional[str] = Field(None, max_length=2000)
    category: Optional[str] = None
    sizes: Optional[List[Size]] = Field(None, min_length=1, max_length=12)
    images: Optional[List[str]] = Field(None, max_length=8)
    isActive: Optional[bool] = None

    @field_validator("category")
    @classmethod
    def cat(cls, v):
        return v if v is None else _check_category(v)

    @field_validator("images")
    @classmethod
    def imgs(cls, v):
        return v if v is None else _check_images(v)


class OfferIn(BaseModel):
    text: str = Field(min_length=1, max_length=200)
    isActive: bool = True
    order: int = 0


class OfferPatch(BaseModel):
    text: Optional[str] = Field(None, min_length=1, max_length=200)
    isActive: Optional[bool] = None
    order: Optional[int] = None


class HeroIn(BaseModel):
    """Only the fields you send are changed; send null to clear one."""
    title: Optional[str] = Field(None, max_length=200)
    titleImage: Optional[str] = None
    mainImage: Optional[str] = None

    @field_validator("titleImage", "mainImage")
    @classmethod
    def img(cls, v):
        if v is not None and not IMAGE_REF.match(v):
            raise ValueError("invalid image reference")
        return v


class ImageIn(BaseModel):
    data: str  # a data URL: data:image/jpeg;base64,....


# ---------- helpers ----------

def ser(doc: dict) -> dict:
    out = {("id" if k == "_id" else k): v for k, v in doc.items()}
    out["id"] = str(out["id"])
    for k in ("createdAt", "updatedAt"):
        if hasattr(out.get(k), "isoformat"):
            out[k] = out[k].isoformat()
    return out


def is_uploaded(ref) -> bool:
    return bool(ref) and re.fullmatch(r"[0-9a-f]{24}", ref) is not None


def delete_images(db, refs):
    ids = [ObjectId(r) for r in set(refs) if is_uploaded(r)]
    if ids:
        db.images.delete_many({"_id": {"$in": ids}})


_MAGIC = {"image/jpeg": b"\xff\xd8\xff", "image/png": b"\x89PNG\r\n\x1a\n", "image/webp": b"RIFF"}


def decode_image(data_url: str):
    m = re.match(r"^data:(image/(?:jpeg|png|webp));base64,(.+)$", data_url, re.S)
    if not m:
        raise HTTPException(400, "Image must be a jpeg/png/webp data URL")
    mime = m.group(1)
    try:
        raw = base64.b64decode(m.group(2), validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(400, "Image is not valid base64")
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(413, f"Image larger than {MAX_IMAGE_BYTES // 1024 // 1024}MB")
    if not raw.startswith(_MAGIC[mime]) or (mime == "image/webp" and raw[8:12] != b"WEBP"):
        raise HTTPException(400, "File content does not match its image type")
    return mime, raw


# ---------- auth check & stats ----------

@app.get("/admin/ping", dependencies=[Depends(require_admin)])
def ping():
    return {"ok": True}


@app.get("/admin/stats", dependencies=[Depends(require_admin)])
def stats():
    db = get_db()
    by_cat = {r["_id"]: r["n"] for r in db.products.aggregate([{"$group": {"_id": "$category", "n": {"$sum": 1}}}])}
    return {
        "products": db.products.count_documents({}),
        "activeProducts": db.products.count_documents({"isActive": {"$ne": False}}),
        "offers": db.offers.count_documents({}),
        "images": db.images.count_documents({}),
        "byCategory": by_cat,
    }


# ---------- products ----------

@app.get("/admin/products", dependencies=[Depends(require_admin)])
def list_products():
    return [ser(d) for d in get_db().products.find().sort("_id", -1)]


@app.get("/admin/products/{pid}", dependencies=[Depends(require_admin)])
def get_product(pid: str):
    doc = get_db().products.find_one({"_id": oid_or_404(pid)})
    if not doc:
        raise HTTPException(404, "Product not found")
    return ser(doc)


@app.post("/admin/products", status_code=201, dependencies=[Depends(require_admin)])
def add_product(product: ProductIn):
    db = get_db()
    if db.products.find_one({"name": product.name}, collation={"locale": "en", "strength": 2}):
        raise HTTPException(409, "A product with this name already exists")
    doc = product.model_dump()
    doc["createdAt"] = doc["updatedAt"] = now()
    doc["_id"] = db.products.insert_one(doc).inserted_id
    return ser(doc)


def _update_product(pid: str, fields: dict):
    db = get_db()
    oid = oid_or_404(pid)
    old = db.products.find_one({"_id": oid})
    if not old:
        raise HTTPException(404, "Product not found")
    if "name" in fields and fields["name"].strip().lower() != old.get("name", "").lower():
        if db.products.find_one({"name": fields["name"].strip(), "_id": {"$ne": oid}},
                                collation={"locale": "en", "strength": 2}):
            raise HTTPException(409, "A product with this name already exists")
    if "name" in fields:
        fields["name"] = fields["name"].strip()
    fields["updatedAt"] = now()
    db.products.update_one({"_id": oid}, {"$set": fields})
    if "images" in fields:  # drop uploads that were removed from the product
        delete_images(db, set(old.get("images", [])) - set(fields["images"]))
    return ser(db.products.find_one({"_id": oid}))


@app.put("/admin/products/{pid}", dependencies=[Depends(require_admin)])
def replace_product(pid: str, product: ProductIn):
    return _update_product(pid, product.model_dump())


@app.patch("/admin/products/{pid}", dependencies=[Depends(require_admin)])
def patch_product(pid: str, patch: ProductPatch):
    fields = patch.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(400, "Nothing to update")
    return _update_product(pid, fields)


@app.delete("/admin/products/{pid}", dependencies=[Depends(require_admin)])
def delete_product(pid: str):
    db = get_db()
    doc = db.products.find_one_and_delete({"_id": oid_or_404(pid)})
    if not doc:
        raise HTTPException(404, "Product not found")
    delete_images(db, doc.get("images", []))
    return {"deleted": pid}


# ---------- offers (the ticker bar) ----------

@app.get("/admin/offers", dependencies=[Depends(require_admin)])
def list_offers():
    return [ser(d) for d in get_db().offers.find().sort([("order", 1), ("_id", 1)])]


@app.post("/admin/offers", status_code=201, dependencies=[Depends(require_admin)])
def add_offer(offer: OfferIn):
    doc = offer.model_dump()
    doc["text"] = doc["text"].strip()
    if not doc["text"]:
        raise HTTPException(422, "Offer text is empty")
    doc["createdAt"] = now()
    doc["_id"] = get_db().offers.insert_one(doc).inserted_id
    return ser(doc)


@app.put("/admin/offers/{oid}", dependencies=[Depends(require_admin)])
def update_offer(oid: str, patch: OfferPatch):
    fields = patch.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(400, "Nothing to update")
    db = get_db()
    res = db.offers.update_one({"_id": oid_or_404(oid)}, {"$set": fields})
    if not res.matched_count:
        raise HTTPException(404, "Offer not found")
    return ser(db.offers.find_one({"_id": ObjectId(oid)}))


@app.delete("/admin/offers/{oid}", dependencies=[Depends(require_admin)])
def delete_offer(oid: str):
    if not get_db().offers.delete_one({"_id": oid_or_404(oid)}).deleted_count:
        raise HTTPException(404, "Offer not found")
    return {"deleted": oid}


# ---------- hero section ----------

@app.get("/admin/hero", dependencies=[Depends(require_admin)])
def get_hero():
    doc = get_db().settings.find_one({"_id": "hero"}) or {}
    return {"title": doc.get("title", ""), "titleImage": doc.get("titleImage"), "mainImage": doc.get("mainImage")}


@app.put("/admin/hero", dependencies=[Depends(require_admin)])
def save_hero(hero: HeroIn):
    fields = hero.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(400, "Nothing to update")
    db = get_db()
    old = db.settings.find_one({"_id": "hero"}) or {}
    fields["updatedAt"] = now()
    db.settings.update_one({"_id": "hero"}, {"$set": fields}, upsert=True)
    for key in ("titleImage", "mainImage"):  # free replaced / cleared uploads
        if key in fields and old.get(key) and old.get(key) != fields[key]:
            delete_images(db, [old[key]])
    return get_hero()


@app.delete("/admin/hero", dependencies=[Depends(require_admin)])
def reset_hero_images():
    """Remove the custom hero images (keeps the title text) -> storefront falls back to its default look."""
    db = get_db()
    old = db.settings.find_one({"_id": "hero"}) or {}
    db.settings.update_one({"_id": "hero"}, {"$set": {"titleImage": None, "mainImage": None, "updatedAt": now()}}, upsert=True)
    delete_images(db, [old.get("titleImage"), old.get("mainImage")])
    return get_hero()


# ---------- image upload ----------

@app.post("/admin/images", status_code=201, dependencies=[Depends(require_admin)])
def upload_image(img: ImageIn):
    mime, raw = decode_image(img.data)
    res = get_db().images.insert_one({"mime": mime, "data": Binary(raw), "size": len(raw), "createdAt": now()})
    return {"id": str(res.inserted_id), "size": len(raw)}


@app.delete("/admin/images/{iid}", dependencies=[Depends(require_admin)])
def remove_image(iid: str):
    if not get_db().images.delete_one({"_id": oid_or_404(iid)}).deleted_count:
        raise HTTPException(404, "Image not found")
    return {"deleted": iid}
