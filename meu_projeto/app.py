from flask import Flask, render_template, request, redirect, url_for, flash
from werkzeug.utils import secure_filename
import os
import uuid
from database import load_db, save_db, get_product_by_id, delete_product_by_id

app = Flask(__name__)
app.secret_key = "aula_flask_unimax_2026" # Chave para o sistema de mensagens (flash)

# Configurações de Upload
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024 # Limite de 16MB por arquivo

# Garante que a pasta de fotos existe no computador
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

@app.route('/')
def index():
    try:
        products = load_db()
        # Calcula o valor total somando todos os preços com segurança
        total_valor = sum(float(p.get('price', 0)) for p in products)
    except Exception as e:
        print(f"Erro ao carregar index: {e}")
        products = []
        total_valor = 0
        
    return render_template('index.html', products=products, total=total_valor)

@app.route('/add', methods=['GET', 'POST'])
def add_product():
    if request.method == 'POST':
        try:
            # 1. Captura a imagem
            file = request.files.get('image')
            filename = "default.jpg"
            
            if file and file.filename != '':
                filename = f"{uuid.uuid4().hex}_{secure_filename(file.filename)}"
                file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))

            # 2. Captura e limpa o preço (aceita 10.50 ou 10,50)
            raw_price = request.form.get('price', '0').replace(',', '.')
            price_numeric = float(raw_price)

            # 3. Monta o dicionário do produto
            new_product = {
                "id": str(uuid.uuid4()),
                "name": request.form.get('name', 'Produto sem nome'),
                "price": price_numeric,
                "image": filename
            }
            
            # 4. Salva no JSON
            db = load_db()
            db.append(new_product)
            save_db(db)
            
            flash("Produto cadastrado com sucesso!", "success")
            return redirect(url_for('index'))

        except Exception as e:
            print(f"ERRO AO ADICIONAR: {e}")
            flash(f"Erro ao salvar: verifique os dados digitados.", "danger")
            return redirect(url_for('index'))

    return render_template('form.html', action="Adicionar", product=None)

@app.route('/edit/<id>', methods=['GET', 'POST'])
def edit_product(id):
    product = get_product_by_id(id)
    if not product:
        flash("Produto não encontrado!", "danger")
        return redirect(url_for('index'))

    if request.method == 'POST':
        try:
            db = load_db()
            for p in db:
                if p['id'] == id:
                    p['name'] = request.form.get('name')
                    # Atualiza preço com conversão segura
                    raw_price = request.form.get('price', '0').replace(',', '.')
                    p['price'] = float(raw_price)
                    
                    # Se enviou nova imagem, troca
                    file = request.files.get('image')
                    if file and file.filename != '':
                        # Remove a antiga para não entulhar o servidor
                        old_path = os.path.join(app.config['UPLOAD_FOLDER'], p['image'])
                        if os.path.exists(old_path) and p['image'] != "default.jpg":
                            os.remove(old_path)
                        
                        new_filename = f"{uuid.uuid4().hex}_{secure_filename(file.filename)}"
                        file.save(os.path.join(app.config['UPLOAD_FOLDER'], new_filename))
                        p['image'] = new_filename
            
            save_db(db)
            flash("Alterações salvas!", "success")
            return redirect(url_for('index'))
        except Exception as e:
            print(f"ERRO AO EDITAR: {e}")
            flash("Erro ao atualizar o produto.", "danger")
            return redirect(url_for('index'))

    return render_template('form.html', action="Editar", product=product)

@app.route('/delete/<id>')
def delete(id):
    try:
        product = get_product_by_id(id)
        if product:
            # Deleta a imagem física
            image_path = os.path.join(app.config['UPLOAD_FOLDER'], product['image'])
            if os.path.exists(image_path) and product['image'] != "default.jpg":
                os.remove(image_path)
            
            # Deleta do JSON
            delete_product_by_id(id)
            flash("Produto removido!", "success")
    except Exception as e:
        print(f"ERRO AO DELETAR: {e}")
        flash("Não foi possível excluir o item.", "danger")
        
    return redirect(url_for('index'))

if __name__ == '__main__':
    # Mudamos para a porta 8080, que raramente trava
    app.run(debug=True, port=8080)