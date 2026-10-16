"""One-time MongoDB setup: JSON-schema validation, indexes, and migration of old products.

    python setup_db.py            # validators + indexes + migrate legacy products
    python setup_db.py --check    # only report problems, change nothing

Validators use validationLevel "moderate": new writes are checked, old documents are not
rejected. Creating/changing validators (collMod) may need a user with dbAdmin; if your
write user lacks it you will see a hint - indexes and migration still work with readWrite.
"""
import os
import re
import sys

from dotenv import load_dotenv
from pymongo import ASCENDING, MongoClient
from pymongo.errors import OperationFailure

load_dotenv()
CHECK_ONLY = "--check" in sys.argv
db = MongoClient(os.environ["MONGO_URI_WRITE"], serverSelectionTimeoutMS=8000)[os.environ.get("MONGO_DB", "organic_smile")]

SCHEMAS = {
    "products": {"bsonType": "object", "required": ["name", "category", "sizes"], "properties": {
        "name": {"bsonType": "string", "minLength": 1, "maxLength": 120},
        "category": {"enum": ["dried", "powder"]},
        "isActive": {"bsonType": "bool"},
        "images": {"bsonType": "array", "maxItems": 8, "items": {"bsonType": "string"}},
        "sizes": {"bsonType": "array", "minItems": 1, "items": {"bsonType": "object",
                  "required": ["label", "price"], "properties": {
                      "label": {"bsonType": "string"}, "price": {"bsonType": ["double", "int", "long"], "minimum": 0}}}},
    }},
    "offers": {"bsonType": "object", "required": ["text"], "properties": {
        "text": {"bsonType": "string", "minLength": 1, "maxLength": 200}, "isActive": {"bsonType": "bool"}}},
    "images": {"bsonType": "object", "required": ["mime", "data"], "properties": {
        "mime": {"enum": ["image/jpeg", "image/png", "image/webp"]}, "data": {"bsonType": "binData"}}},
}
INDEXES = {
    "products": [[("isActive", ASCENDING), ("category", ASCENDING)], [("name", ASCENDING)]],
    "offers": [[("order", ASCENDING)]],
}

SIZE_RE = re.compile(r"^(.*?)\s*[-–—]\s*(\d+(?:\.\d+)?)\s*(?:EGP|ج\.?\s?م\.?)?\s*$", re.I)


def migrate_products():
    fixed = problems = 0
    for p in db.products.find():
        upd, issues = {}, []
        sizes = []
        for s in p.get("sizes", []):
            if isinstance(s, str):
                m = SIZE_RE.match(s)
                if m:
                    sizes.append({"label": m.group(1).strip(), "price": float(m.group(2))})
                else:
                    issues.append(f"cannot parse size {s!r}")
                    sizes.append({"label": s, "price": 0.0})
            else:
                sizes.append(s)
        if sizes != p.get("sizes"):
            upd["sizes"] = sizes
        if "isActive" not in p:
            upd["isActive"] = True
        if p.get("category") not in ("dried", "powder"):
            issues.append(f"unknown category {p.get('category')!r}")
        bad_imgs = [i for i in p.get("images", []) if i.startswith("images/")]
        if bad_imgs:
            issues.append(f"{len(bad_imgs)} image(s) point to local files {bad_imgs[:2]} - re-upload them from the admin panel")
        if issues:
            problems += 1
            print(f"  ! {p.get('name')}: " + "; ".join(issues))
        if upd and not CHECK_ONLY:
            db.products.update_one({"_id": p["_id"]}, {"$set": upd})
            fixed += 1
        elif upd:
            print(f"  would migrate: {p.get('name')} -> {list(upd)}")
    print(f"products: {fixed} migrated, {problems} with warnings")


def main():
    print("Connected to", db.name, "- collections:", db.list_collection_names())
    migrate_products()
    if CHECK_ONLY:
        return
    existing = set(db.list_collection_names())
    for name, schema in SCHEMAS.items():
        opts = {"validator": {"$jsonSchema": schema}, "validationLevel": "moderate", "validationAction": "error"}
        try:
            if name in existing:
                db.command({"collMod": name, **opts})
            else:
                db.create_collection(name, **opts)
            print(f"validator set on {name}")
        except OperationFailure as e:
            print(f"! could not set validator on {name}: {e.details.get('errmsg', e)}\n"
                  f"  (needs dbAdmin; the API still validates every write with Pydantic)")
    for name, specs in INDEXES.items():
        for keys in specs:
            db[name].create_index(keys)
        print(f"indexes ensured on {name}")


if __name__ == "__main__":
    main()
