// ============================================================
//  SERVIDOR NODE.JS — ATELIÊ MASSAS ARTESANAIS
//  Requer: npm install express
//  Executar: npm start   (ou: node app.js)
// ============================================================

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORTA = process.env.PORT || 5000;
const LOJA_NOME = 'Ateliê Massas Artesanais';

// Caminho da pasta pública e do arquivo de dados
const CAMINHO_PUBLICO = __dirname; // seus arquivos HTML/CSS/JS estão na raiz
const CAMINHO_PRODUTOS = path.join(__dirname, 'produtos.json'); // o JSON está na raiz

app.disable('x-powered-by');
app.use(express.json());

// Serve os arquivos estáticos da raiz
app.use(express.static(CAMINHO_PUBLICO, { maxAge: '1h', extensions: ['html'] }));

// ------------------------------------------------------------
// Camada de dados
// ------------------------------------------------------------
let cache = { mtimeMs: 0, produtos: [] };

function carregarProdutos() {
  try {
    // Se o arquivo não existir, retorna array vazio (mas você já tem o arquivo)
    if (!fs.existsSync(CAMINHO_PRODUTOS)) {
      return [];
    }

    const stat = fs.statSync(CAMINHO_PRODUTOS);
    if (stat.mtimeMs !== cache.mtimeMs) {
      const conteudo = fs.readFileSync(CAMINHO_PRODUTOS, 'utf-8');
      const dados = JSON.parse(conteudo);
      cache = {
        mtimeMs: stat.mtimeMs,
        produtos: Array.isArray(dados.produtos) ? dados.produtos : []
      };
    }
    return cache.produtos;
  } catch (erro) {
    console.error(`❌ Erro ao ler produtos.json: ${erro.message}`);
    return [];
  }
}

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// ------------------------------------------------------------
// Rotas da API
// ------------------------------------------------------------
app.get('/api/status', (req, res) => {
  res.json({ ok: true, loja: LOJA_NOME, totalProdutos: carregarProdutos().length });
});

app.get('/api/categorias', (req, res) => {
  const produtos = carregarProdutos();
  const categorias = [...new Set(produtos.map((p) => p.categoria).filter(Boolean))];
  categorias.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  res.json(categorias);
});

app.get('/api/produtos', (req, res) => {
  let produtos = carregarProdutos();
  const { categoria, busca } = req.query;

  if (categoria && normalizar(categoria) !== 'todas') {
    const categoriaAlvo = normalizar(categoria);
    produtos = produtos.filter((p) => normalizar(p.categoria) === categoriaAlvo);
  }

  if (busca) {
    const termo = normalizar(busca);
    produtos = produtos.filter(
      (p) =>
        normalizar(p.nome).includes(termo) ||
        normalizar(p.descricao).includes(termo) ||
        normalizar(p.categoria).includes(termo)
    );
  }

  res.json(produtos);
});

app.get('/api/produtos/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ erro: 'ID inválido' });
  }

  const produto = carregarProdutos().find((p) => p.id === id);
  if (!produto) {
    return res.status(404).json({ erro: 'Produto não encontrado' });
  }
  res.json(produto);
});

app.use('/api', (req, res) => {
  res.status(404).json({ erro: 'Endpoint não encontrado' });
});

// Fallback para páginas não encontradas (serve o index.html se não achar)
app.use((req, res) => {
  res.sendFile(path.join(CAMINHO_PUBLICO, 'index.html'), (erro) => {
    if (erro) res.status(404).send('Página não encontrada');
  });
});

app.use((err, req, res, next) => {
  console.error('❌ Erro não tratado:', err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

app.listen(PORTA, () => {
  console.log(`\n🍝 ${LOJA_NOME} rodando em http://localhost:${PORTA}`);
  console.log(`   Produtos carregados: ${carregarProdutos().length}\n`);
});