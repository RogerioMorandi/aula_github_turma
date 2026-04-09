const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = 3000;

// ============================================
// CORS - LIBERADO TOTALMENTE PARA AULA
// ============================================
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// ============================================
// RESTO DO CÓDIGO (igual ao anterior)
// ============================================

const dirs = ['uploads', 'data'];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

const DB_FILE = './data/motos.json';

function initDB() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({ motos: [], nextId: 1 }, null, 2));
    }
}

function lerBanco() {
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (erro) {
        return { motos: [], nextId: 1 };
    }
}

function salvarBanco(dados) {
    dados.ultimaAtualizacao = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(dados, null, 2));
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `moto-${Date.now()}-${Math.round(Math.random()*1E9)}${ext}`);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const permitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        cb(null, permitidos.includes(file.mimetype));
    }
});

// ============================================
// ROTAS
// ============================================

app.get('/api/motos', (req, res) => {
    const { modelo, marca, minValor, maxValor } = req.query;
    const db = lerBanco();
    let resultado = [...db.motos];

    if (modelo) {
        resultado = resultado.filter(m => 
            m.modelo.toLowerCase().includes(modelo.toLowerCase())
        );
    }
    if (marca) {
        resultado = resultado.filter(m => 
            m.marca.toLowerCase() === marca.toLowerCase()
        );
    }
    if (minValor) resultado = resultado.filter(m => m.valor >= parseFloat(minValor));
    if (maxValor) resultado = resultado.filter(m => m.valor <= parseFloat(maxValor));

    resultado.sort((a, b) => b.id - a.id);

    res.json({ total: resultado.length, motos: resultado });
});

app.get('/api/motos/:id', (req, res) => {
    const db = lerBanco();
    const moto = db.motos.find(m => m.id === parseInt(req.params.id));
    if (!moto) return res.status(404).json({ erro: 'Moto não encontrada' });
    res.json(moto);
});

app.get('/api/marcas', (req, res) => {
    const db = lerBanco();
    const marcas = [...new Set(db.motos.map(m => m.marca))].sort();
    res.json({ total: marcas.length, marcas });
});

app.get('/api/estatisticas', (req, res) => {
    const db = lerBanco();
    const motos = db.motos;
    const stats = { total: motos.length, porMarca: {}, valorTotal: 0, valorMedio: 0 };
    
    if (motos.length > 0) {
        motos.forEach(m => stats.porMarca[m.marca] = (stats.porMarca[m.marca] || 0) + 1);
        const comValor = motos.filter(m => m.valor);
        if (comValor.length > 0) {
            stats.valorTotal = comValor.reduce((a, m) => a + m.valor, 0);
            stats.valorMedio = stats.valorTotal / comValor.length;
        }
    }
    res.json(stats);
});

app.post('/api/motos', upload.single('imagem'), (req, res) => {
    const { marca, modelo, consumo, valor, ano } = req.body;
    
    if (!marca || !modelo) {
        return res.status(400).json({ erro: 'Marca e modelo são obrigatórios' });
    }

    const db = lerBanco();
    const novaMoto = {
        id: db.nextId++,
        marca: marca.trim(),
        modelo: modelo.trim(),
        ano: ano ? parseInt(ano) : null,
        consumo: consumo ? parseFloat(consumo) : null,
        valor: valor ? parseFloat(valor) : null,
        imagem: req.file ? `/uploads/${req.file.filename}` : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    db.motos.push(novaMoto);
    salvarBanco(db);

    console.log(`✅ [POST] Moto ${novaMoto.id} cadastrada`);
    res.status(201).json({ mensagem: 'Moto cadastrada!', moto: novaMoto });
});

app.put('/api/motos/:id', upload.single('imagem'), (req, res) => {
    const db = lerBanco();
    const id = parseInt(req.params.id);
    const index = db.motos.findIndex(m => m.id === id);
    
    if (index === -1) return res.status(404).json({ erro: 'Moto não encontrada' });

    const moto = db.motos[index];
    const { marca, modelo, consumo, valor, ano } = req.body;

    if (marca) moto.marca = marca.trim();
    if (modelo) moto.modelo = modelo.trim();
    if (ano !== undefined) moto.ano = ano ? parseInt(ano) : null;
    if (consumo !== undefined) moto.consumo = consumo ? parseFloat(consumo) : null;
    if (valor !== undefined) moto.valor = valor ? parseFloat(valor) : null;

    if (req.file) {
        if (moto.imagem) {
            const antiga = path.join(__dirname, moto.imagem);
            if (fs.existsSync(antiga)) fs.unlinkSync(antiga);
        }
        moto.imagem = `/uploads/${req.file.filename}`;
    }

    moto.updated_at = new Date().toISOString();
    salvarBanco(db);

    console.log(`✏️ [PUT] Moto ${id} atualizada`);
    res.json({ mensagem: 'Moto atualizada!', moto });
});

app.delete('/api/motos/:id', (req, res) => {
    const db = lerBanco();
    const id = parseInt(req.params.id);
    const index = db.motos.findIndex(m => m.id === id);
    
    if (index === -1) return res.status(404).json({ erro: 'Moto não encontrada' });

    const moto = db.motos[index];
    if (moto.imagem) {
        const imgPath = path.join(__dirname, moto.imagem);
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    db.motos.splice(index, 1);
    salvarBanco(db);

    console.log(`🗑️ [DELETE] Moto ${id} deletada`);
    res.json({ mensagem: 'Moto deletada!', id, motoDeletada: moto });
});

// Tratamento de erros
app.use((erro, req, res, next) => {
    if (erro instanceof multer.MulterError) {
        return res.status(400).json({ erro: erro.message });
    }
    if (erro) return res.status(400).json({ erro: erro.message });
    next();
});

// ============================================
// INICIAR SERVIDOR
// ============================================

initDB();

const LOCAL_IP = (() => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return 'localhost';
})();

app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    ╔══════════════════════════════════════════════════════════╗
    ║           🏍️  SERVIDOR DE MOTOS INICIADO!               ║
    ╠══════════════════════════════════════════════════════════╣
    ║                                                          ║
    ║  📍 Local:    http://localhost:${PORT}                     ║
    ║  🌐 Rede:     http://${LOCAL_IP}:${PORT}          ║
    ║                                                          ║
    ║  ⚠️  Se der erro de CORS, verifique o console do navegador ║
    ║                                                          ║
    ╚══════════════════════════════════════════════════════════╝
    `);
});