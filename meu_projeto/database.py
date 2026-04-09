import json
import os

DB_FILE = 'produtos.json'

def load_db():
    if not os.path.exists(DB_FILE):
        return []
    try:
        with open(DB_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return [] # Se o JSON estiver corrompido, retorna vazio em vez de travar

def save_db(data):
    with open(DB_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

def get_product_by_id(product_id):
    products = load_db()
    return next((p for p in products if p['id'] == product_id), None)

def delete_product_by_id(product_id):
    products = load_db()
    new_products = [p for p in products if p['id'] != product_id]
    save_db(new_products)