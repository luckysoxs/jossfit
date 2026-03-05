from fastapi import APIRouter, Query
from pydantic import BaseModel

router = APIRouter(prefix="/store", tags=["Store"])

STORE_URL = "https://johnleopard.com.mx/JOSSFIT"

# Static product catalog
PRODUCTS = [
    {
        "id": 1, "name": "Performance Tee", "category": "Training",
        "price": 599.00, "image": "/images/store/training-tee.jpg",
        "description": "Playera de entrenamiento de alto rendimiento",
    },
    {
        "id": 2, "name": "Essential Hoodie", "category": "Hoodies",
        "price": 899.00, "image": "/images/store/hoodie.jpg",
        "description": "Hoodie esencial para tu día a día",
    },
    {
        "id": 3, "name": "Training Joggers", "category": "Joggers",
        "price": 799.00, "image": "/images/store/joggers.jpg",
        "description": "Joggers diseñados para entrenar y salir",
    },
    {
        "id": 4, "name": "Casual Polo", "category": "Polos",
        "price": 699.00, "image": "/images/store/polo.jpg",
        "description": "Polo casual con estilo deportivo",
    },
    {
        "id": 5, "name": "Everyday Tee", "category": "Casual",
        "price": 499.00, "image": "/images/store/casual-tee.jpg",
        "description": "Playera casual para uso diario",
    },
    {
        "id": 6, "name": "Zip Hoodie", "category": "Hoodies",
        "price": 999.00, "image": "/images/store/zip-hoodie.jpg",
        "description": "Hoodie con zipper para mayor comodidad",
    },
    {
        "id": 7, "name": "Slim Joggers", "category": "Joggers",
        "price": 849.00, "image": "/images/store/slim-joggers.jpg",
        "description": "Joggers slim fit para un look moderno",
    },
    {
        "id": 8, "name": "Tank Top", "category": "Training",
        "price": 449.00, "image": "/images/store/tank.jpg",
        "description": "Tank top para entrenamientos intensos",
    },
]


class ProductResponse(BaseModel):
    id: int
    name: str
    category: str
    price: float
    image: str
    description: str
    store_url: str = STORE_URL


@router.get("/products", response_model=list[ProductResponse])
def list_products(category: str | None = Query(None)):
    products = PRODUCTS
    if category:
        products = [p for p in products if p["category"].lower() == category.lower()]
    return [ProductResponse(**p) for p in products]


@router.get("/url")
def get_store_url():
    return {"url": STORE_URL}
