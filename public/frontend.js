// ============================================================
//  FRONTEND — ATELIÊ MASSAS ARTESANAIS
//  Interface, carrinho, histórico local e pedido via WhatsApp
// ============================================================
(() => {
  'use strict';

  const CONFIG = {
    NUMERO_WHATSAPP: '5527995265371',
    NOME_LOJA: 'Ateliê Massas Artesanais',
    CHAVE_CARRINHO: 'atelie_carrinho_v1',
    CHAVE_HISTORICO: 'atelie_historico_v1',
    MAX_HISTORICO: 20
  };

  const CATEGORIAS_FIXAS = ['Molhos', 'Massas Lisas', 'Massas Recheadas'];

  const formatoMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const PLACEHOLDER_IMG =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 225"><rect width="300" height="225" fill="%23F3E8D2"/><text x="50%" y="50%" font-family="sans-serif" font-size="16" fill="%23A79C89" text-anchor="middle" dy=".3em">Sem foto disponível</text></svg>'
    );

  // ---------- Estado ----------
  let todosProdutos = [];
  let produtosFiltrados = [];
  let categoriaAtiva = 'todas';
  let carrinho = lerStorage(CONFIG.CHAVE_CARRINHO, []);
  let produtoDetalheAtual = null;
  let rolagemJaFeita = false; // controla o scroll automático apenas uma vez por busca

  // ---------- Utilitários ----------
  function lerStorage(chave, padrao) {
    try {
      const valor = localStorage.getItem(chave);
      return valor ? JSON.parse(valor) : padrao;
    } catch {
      return padrao;
    }
  }

  function gravarStorage(chave, valor) {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
    } catch (erro) {
      console.error('Não foi possível salvar no armazenamento local:', erro);
    }
  }

  function escapar(texto) {
    const div = document.createElement('div');
    div.textContent = String(texto ?? '');
    return div.innerHTML;
  }

  function debounce(fn, atraso = 250) {
    let temporizador;
    return (...args) => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => fn(...args), atraso);
    };
  }

  function normalizar(texto) {
    return String(texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  // ---------- Elementos DOM ----------
  const el = (id) => document.getElementById(id);

  const dom = {
    logoImg: el('logoImg'),
    logoFallback: el('logoFallback'),
    inputBusca: el('inputBusca'),
    inputBuscaMobile: el('inputBuscaMobile'),
    btnLimparBusca: el('btnLimparBusca'),
    btnBuscar: el('btnBuscar'),
    btnBuscarMobile: el('btnBuscarMobile'),
    sugestoesBusca: el('sugestoesBusca'),
    sugestoesBuscaMobile: el('sugestoesBuscaMobile'),
    filtrosContainer: el('filtrosContainer'),
    tituloCategoria: el('tituloCategoria'),
    produtosGrid: el('produtosGrid'),
    produtosContador: el('produtosContador'),
    produtosVazio: el('produtosVazio'),
    btnResetarBusca: el('btnResetarBusca'),

    sobreposicao: el('sobreposicao'),

    carrinhoBadge: el('carrinhoBadge'),
    btnAbrirCarrinho: el('btnAbrirCarrinho'),
    carrinhoPainel: el('carrinhoPainel'),
    btnFecharCarrinho: el('btnFecharCarrinho'),
    carrinhoVazio: el('carrinhoVazio'),
    btnVoltarCardapio: el('btnVoltarCardapio'),
    carrinhoLista: el('carrinhoLista'),
    carrinhoRodape: el('carrinhoRodape'),
    inputObservacoes: el('inputObservacoes'),
    carrinhoTotal: el('carrinhoTotal'),
    btnFinalizarWhatsApp: el('btnFinalizarWhatsApp'),

    btnVerHistorico: el('btnVerHistorico'),
    modalHistoricoOverlay: el('modalHistoricoOverlay'),
    btnFecharHistorico: el('btnFecharHistorico'),
    historicoConteudo: el('historicoConteudo'),
    btnLimparHistorico: el('btnLimparHistorico'),

    modalDetalhesOverlay: el('modalDetalhesOverlay'),
    btnFecharDetalhes: el('btnFecharDetalhes'),
    detalhesTitulo: el('detalhesTitulo'),
    detalhesImagem: el('detalhesImagem'),
    detalhesCategoria: el('detalhesCategoria'),
    detalhesDescricao: el('detalhesDescricao'),
    detalhesPorcao: el('detalhesPorcao'),
    detalhesTempo: el('detalhesTempo'),
    detalhesIngredientes: el('detalhesIngredientes'),
    detalhesPreco: el('detalhesPreco'),
    quantidadeInput: el('quantidadeInput'),
    btnMenos: el('btnMenos'),
    btnMais: el('btnMais'),
    btnAdicionarCarrinho: el('btnAdicionarCarrinho'),

    whatsappFlutuante: el('whatsappFlutuante'),
    regiaoNotificacoes: el('regiaoNotificacoes'),
    anoAtual: el('anoAtual')
  };

  // ============================================================
  // Inicialização
  // ============================================================
  function inicializar() {
    dom.anoAtual.textContent = new Date().getFullYear();
    dom.whatsappFlutuante.href = linkWhatsApp('Olá! Gostaria de saber mais sobre o cardápio.');
    dom.logoImg.addEventListener('error', () => {
      dom.logoImg.hidden = true;
      dom.logoFallback.hidden = false;
    });

    configurarEventosCarrinho();
    configurarEventosModais();
    configurarEventosBusca();
    configurarEventosFiltros();
    configurarEventosSugestoes();
    configurarEventosGlobais();

    atualizarCarrinhoDOM();
    carregarCategorias();
    carregarProdutos();
  }

  document.addEventListener('DOMContentLoaded', inicializar);

  // ============================================================
  // Carregamento de dados (API)
  // ============================================================
  async function carregarProdutos() {
    renderizarEsqueleto();
    try {
      const resposta = await fetch('/api/produtos');
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      todosProdutos = await resposta.json();
      produtosFiltrados = [...todosProdutos];

      console.log('Produtos carregados:', todosProdutos);

      renderizarProdutos(produtosFiltrados);
    } catch (erro) {
      console.error('Falha ao carregar produtos:', erro);
      dom.produtosGrid.innerHTML = '<p class="erro-carregamento">Não foi possível carregar o cardápio agora. Tente recarregar a página em instantes.</p>';
      dom.produtosContador.textContent = '';
    }
  }

  async function carregarCategorias() {
    try {
      const resposta = await fetch('/api/categorias');
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      const categorias = await resposta.json();
      renderizarFiltros(categorias);
    } catch (erro) {
      console.error('Falha ao carregar categorias:', erro);
      // Mesmo sem API, renderiza com as fixas
      renderizarFiltros([]);
    }
  }

  // ============================================================
  // Renderização — filtros
  // ============================================================
  function renderizarFiltros(categorias) {
    const frag = document.createDocumentFragment();

    // Botão "Todas as massas" sempre presente
    const btnTodas = criarBotaoFiltro('todas', 'Todas as massas');
    frag.appendChild(btnTodas);

    // Adiciona as categorias fixas
    CATEGORIAS_FIXAS.forEach((cat) => {
      frag.appendChild(criarBotaoFiltro(cat, cat));
    });

    // Adiciona as categorias dinâmicas que não estejam já nas fixas
    categorias.forEach((cat) => {
      if (!CATEGORIAS_FIXAS.includes(cat)) {
        frag.appendChild(criarBotaoFiltro(cat, cat));
      }
    });

    dom.filtrosContainer.innerHTML = '';
    dom.filtrosContainer.appendChild(frag);
  }

  function criarBotaoFiltro(valor, rotulo) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filtro-pill' + (valor === categoriaAtiva ? ' is-active' : '');
    btn.dataset.categoria = valor;
    btn.textContent = rotulo;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', String(valor === categoriaAtiva));
    return btn;
  }

  // ============================================================
  // Renderização — produtos
  // ============================================================
  function renderizarEsqueleto() {
    dom.produtosContador.textContent = 'Carregando…';
    dom.produtosVazio.hidden = true;
    dom.produtosGrid.innerHTML = Array.from({ length: 6 })
      .map(() => '<div class="produto-card-skeleton" aria-hidden="true"></div>')
      .join('');
  }

  function renderizarProdutos(lista) {
    dom.produtosContador.textContent = `${lista.length} prato${lista.length === 1 ? '' : 's'} encontrado${lista.length === 1 ? '' : 's'}`;

    if (lista.length === 0) {
      dom.produtosGrid.innerHTML = '';
      dom.produtosVazio.hidden = false;
      return;
    }
    dom.produtosVazio.hidden = true;

    const frag = document.createDocumentFragment();
    lista.forEach((produto) => frag.appendChild(criarCardProduto(produto)));
    dom.produtosGrid.innerHTML = '';
    dom.produtosGrid.appendChild(frag);
  }

  function criarCardProduto(produto) {
    const card = document.createElement('article');
    card.className = 'produto-card';

    card.innerHTML = `
      <div class="produto-imagem-wrapper">
        ${produto.destaque ? '<span class="selo-destaque">Feito à mão</span>' : ''}
        <img src="${escapar(produto.imagem || 'imagens/placeholder.png')}" alt="${escapar(produto.nome)}" class="produto-imagem" loading="lazy">
      </div>
      <div class="produto-info">
        <span class="produto-categoria">${escapar(produto.categoria)}</span>
        <h3 class="produto-titulo">${escapar(produto.nome)}</h3>
        <p class="produto-descricao">${escapar(produto.descricao)}</p>
        <div class="produto-rodape">
          <span class="produto-preco">${formatoMoeda.format(Number(produto.preco) || 0)}</span>
          <button type="button" class="botao-detalhes" data-id="${produto.id}">Ver opções</button>
        </div>
      </div>
    `;

    card.querySelector('img').addEventListener('error', (e) => { e.target.src = PLACEHOLDER_IMG; });
    card.querySelector('.botao-detalhes').addEventListener('click', () => abrirModalDetalhes(produto.id));
    return card;
  }

  // ============================================================
  // Modal de detalhes
  // ============================================================
  function abrirModalDetalhes(id) {
    produtoDetalheAtual = todosProdutos.find((p) => p.id === id);
    if (!produtoDetalheAtual) return;

    const p = produtoDetalheAtual;
    dom.detalhesTitulo.textContent = p.nome;
    dom.detalhesImagem.src = p.imagem || 'imagens/placeholder.png';
    dom.detalhesImagem.alt = p.nome;
    dom.detalhesImagem.onerror = () => { dom.detalhesImagem.src = PLACEHOLDER_IMG; };
    dom.detalhesCategoria.textContent = p.categoria || '';
    dom.detalhesDescricao.textContent = p.descricao || '';
    dom.detalhesPorcao.textContent = p.peso || p.porcao || 'Não especificado';
    dom.detalhesTempo.textContent = p.tempo_preparo || p.tempoPreparo || 'Pronto para consumo';
    dom.detalhesIngredientes.textContent = p.ingredientes || 'Não informado';
    dom.detalhesPreco.textContent = Number(p.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    dom.quantidadeInput.value = 1;

    abrirModal(dom.modalDetalhesOverlay);
  }

  // ============================================================
  // Carrinho
  // ============================================================
  function adicionarItemAoCarrinho(produto, quantidade) {
    const existente = carrinho.find((item) => item.id === produto.id);
    if (existente) {
      existente.quantidade += quantidade;
    } else {
      carrinho.push({ id: produto.id, nome: produto.nome, preco: Number(produto.preco) || 0, quantidade });
    }
    salvarCarrinho();
    atualizarCarrinhoDOM();
    fecharTodosModais();
    notificar(`${quantidade}x ${produto.nome} adicionado à sacola!`);
  }

  function salvarCarrinho() {
    gravarStorage(CONFIG.CHAVE_CARRINHO, carrinho);
  }

  function atualizarCarrinhoDOM() {
    const totalItens = carrinho.reduce((acc, item) => acc + item.quantidade, 0);
    dom.carrinhoBadge.textContent = totalItens;

    if (carrinho.length === 0) {
      dom.carrinhoVazio.hidden = false;
      dom.carrinhoLista.hidden = true;
      dom.carrinhoRodape.hidden = true;
      return;
    }

    dom.carrinhoVazio.hidden = true;
    dom.carrinhoLista.hidden = false;
    dom.carrinhoRodape.hidden = false;

    let valorTotal = 0;
    dom.carrinhoLista.innerHTML = carrinho
      .map((item, index) => {
        const subtotal = item.preco * item.quantidade;
        valorTotal += subtotal;
        return `
        <li class="item-carrinho">
          <div class="item-carrinho-info">
            <p class="item-carrinho-nome">${escapar(item.nome)}</p>
            <span class="item-carrinho-preco">${formatoMoeda.format(item.preco)} cada</span>
            <div class="item-carrinho-controles">
              <div class="qtd-controle">
                <button type="button" data-acao="menos" data-index="${index}" aria-label="Diminuir quantidade">&minus;</button>
                <span>${item.quantidade}</span>
                <button type="button" data-acao="mais" data-index="${index}" aria-label="Aumentar quantidade">+</button>
              </div>
              <button type="button" class="item-carrinho-remover" data-acao="remover" data-index="${index}">Remover</button>
            </div>
          </div>
          <span class="item-carrinho-subtotal">${formatoMoeda.format(subtotal)}</span>
        </li>`;
      })
      .join('');

    dom.carrinhoTotal.textContent = formatoMoeda.format(valorTotal);
  }

  function alterarQuantidade(index, delta) {
    if (!carrinho[index]) return;
    carrinho[index].quantidade += delta;
    if (carrinho[index].quantidade <= 0) carrinho.splice(index, 1);
    salvarCarrinho();
    atualizarCarrinhoDOM();
  }

  function removerItem(index) {
    carrinho.splice(index, 1);
    salvarCarrinho();
    atualizarCarrinhoDOM();
  }

  function linkWhatsApp(mensagem) {
    return `https://wa.me/${CONFIG.NUMERO_WHATSAPP}?text=${encodeURIComponent(mensagem)}`;
  }

  function finalizarPedidoWhatsApp() {
    if (carrinho.length === 0) return;

    let mensagem = `*Novo pedido — ${CONFIG.NOME_LOJA}*\n\n`;
    let total = 0;

    carrinho.forEach((item) => {
      const subtotal = item.preco * item.quantidade;
      total += subtotal;
      mensagem += `• ${item.quantidade}x ${item.nome} — ${formatoMoeda.format(subtotal)}\n`;
    });

    const obs = dom.inputObservacoes.value.trim();
    if (obs) mensagem += `\n*Observações:* ${obs}\n`;

    mensagem += `\n*Total estimado:* ${formatoMoeda.format(total)}`;

    salvarPedidoHistorico(carrinho, total);

    carrinho = [];
    salvarCarrinho();
    atualizarCarrinhoDOM();
    dom.inputObservacoes.value = '';
    fecharTodosModais();

    window.open(linkWhatsApp(mensagem), '_blank', 'noopener');
  }

  // ============================================================
  // Histórico local
  // ============================================================
  function salvarPedidoHistorico(itens, total) {
    const historico = lerStorage(CONFIG.CHAVE_HISTORICO, []);
    historico.unshift({
      id: Date.now(),
      data: new Date().toLocaleString('pt-BR'),
      itens: itens.map(({ nome, quantidade }) => ({ nome, quantidade })),
      total
    });
    gravarStorage(CONFIG.CHAVE_HISTORICO, historico.slice(0, CONFIG.MAX_HISTORICO));
  }

  function renderizarHistorico() {
    const historico = lerStorage(CONFIG.CHAVE_HISTORICO, []);
    if (historico.length === 0) {
      dom.historicoConteudo.innerHTML = '<p class="vazio-msg">Você ainda não fez pedidos neste navegador.</p>';
      return;
    }

    dom.historicoConteudo.innerHTML = historico
      .map(
        (pedido) => `
        <div class="historico-card">
          <div class="historico-cabecalho">
            <strong>Pedido #${String(pedido.id).slice(-6)}</strong>
            <small>${escapar(pedido.data)}</small>
          </div>
          <ul>
            ${pedido.itens.map((i) => `<li>${i.quantidade}x ${escapar(i.nome)}</li>`).join('')}
          </ul>
          <div class="historico-total">Total: ${formatoMoeda.format(Number(pedido.total) || 0)}</div>
        </div>`
      )
      .join('');
  }

  // ============================================================
  // Modais e painel — abrir / fechar
  // ============================================================
  function abrirModal(elemento) {
    dom.sobreposicao.hidden = false;
    requestAnimationFrame(() => dom.sobreposicao.classList.add('is-visivel'));
    elemento.hidden = false;
    elemento.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function abrirPainelCarrinho() {
    dom.sobreposicao.hidden = false;
    requestAnimationFrame(() => {
      dom.sobreposicao.classList.add('is-visivel');
      dom.carrinhoPainel.classList.add('is-aberto');
    });
    dom.carrinhoPainel.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function fecharTodosModais() {
    dom.sobreposicao.classList.remove('is-visivel');
    dom.carrinhoPainel.classList.remove('is-aberto');
    dom.carrinhoPainel.setAttribute('aria-hidden', 'true');
    dom.modalDetalhesOverlay.hidden = true;
    dom.modalDetalhesOverlay.setAttribute('aria-hidden', 'true');
    dom.modalHistoricoOverlay.hidden = true;
    dom.modalHistoricoOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    setTimeout(() => {
      if (!dom.carrinhoPainel.classList.contains('is-aberto')) dom.sobreposicao.hidden = true;
    }, 350);
  }

  // ============================================================
  // Notificações (toast)
  // ============================================================
  function notificar(mensagem) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = mensagem;
    dom.regiaoNotificacoes.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('saindo');
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  // ============================================================
  // Sugestões (autocomplete)
  // ============================================================
  function exibirSugestoes(termo) {
    const termoNormalizado = normalizar(termo);
    const listaDesktop = dom.sugestoesBusca;
    const listaMobile = dom.sugestoesBuscaMobile;
    const limpar = () => {
      listaDesktop.innerHTML = '';
      listaDesktop.classList.remove('is-ativo');
      listaMobile.innerHTML = '';
      listaMobile.classList.remove('is-ativo');
    };

    // Só mostra sugestões a partir de 2 caracteres
    if (!termoNormalizado || termoNormalizado.length < 2) {
      limpar();
      return;
    }

    const sugestoes = todosProdutos
      .filter(p => 
        normalizar(p.nome).includes(termoNormalizado) ||
        normalizar(p.descricao).includes(termoNormalizado) ||
        normalizar(p.categoria).includes(termoNormalizado)
      )
      .slice(0, 6);

    const html = sugestoes.length
      ? sugestoes.map(p => `<div class="sugestao-item" data-id="${p.id}">${escapar(p.nome)}</div>`).join('')
      : '<div class="sugestao-vazia">Nenhuma massa encontrada</div>';

    listaDesktop.innerHTML = html;
    listaDesktop.classList.add('is-ativo');
    listaMobile.innerHTML = html;
    listaMobile.classList.add('is-ativo');
  }

  // ============================================================
  // Eventos — Carrinho
  // ============================================================
  function configurarEventosCarrinho() {
    dom.btnAbrirCarrinho.addEventListener('click', abrirPainelCarrinho);
    dom.btnFecharCarrinho.addEventListener('click', fecharTodosModais);
    dom.btnVoltarCardapio.addEventListener('click', fecharTodosModais);

    // Ações delegadas na lista do carrinho (+ / - / remover)
    dom.carrinhoLista.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-acao]');
      if (!btn) return;
      const index = Number(btn.dataset.index);
      if (btn.dataset.acao === 'mais') alterarQuantidade(index, 1);
      if (btn.dataset.acao === 'menos') alterarQuantidade(index, -1);
      if (btn.dataset.acao === 'remover') removerItem(index);
    });

    dom.btnFinalizarWhatsApp.addEventListener('click', finalizarPedidoWhatsApp);
  }

  // ============================================================
  // Eventos — Modais globais (sobreposição, Esc, etc.)
  // ============================================================
  function configurarEventosModais() {
    dom.sobreposicao.addEventListener('click', fecharTodosModais);

    // Fechar modais clicando fora da caixa
    [dom.modalDetalhesOverlay, dom.modalHistoricoOverlay].forEach((overlay) => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) fecharTodosModais();
      });
    });

    // Esc fecha qualquer painel/modal aberto
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') fecharTodosModais();
    });

    // Detalhes
    dom.btnFecharDetalhes.addEventListener('click', fecharTodosModais);

    // Quantidade no modal de detalhes
    dom.btnMais.addEventListener('click', () => {
      dom.quantidadeInput.value = Math.min(99, (parseInt(dom.quantidadeInput.value, 10) || 1) + 1);
    });
    dom.btnMenos.addEventListener('click', () => {
      dom.quantidadeInput.value = Math.max(1, (parseInt(dom.quantidadeInput.value, 10) || 1) - 1);
    });
    dom.quantidadeInput.addEventListener('change', () => {
      const valor = Math.min(99, Math.max(1, parseInt(dom.quantidadeInput.value, 10) || 1));
      dom.quantidadeInput.value = valor;
    });

    dom.btnAdicionarCarrinho.addEventListener('click', () => {
      if (!produtoDetalheAtual) return;
      const quantidade = parseInt(dom.quantidadeInput.value, 10) || 1;
      adicionarItemAoCarrinho(produtoDetalheAtual, quantidade);
    });
  }

  // ============================================================
  // Eventos — Busca
  // ============================================================
  function configurarEventosBusca() {
    const aoBuscar = debounce((valor) => {
    dom.btnLimparBusca.hidden = !valor;
    aplicarFiltros(valor);
    exibirSugestoes(valor);
},  200);

    dom.inputBusca.addEventListener('input', (e) => {
      dom.inputBuscaMobile.value = e.target.value;
      aoBuscar(e.target.value);
    });

    dom.inputBuscaMobile.addEventListener('input', (e) => {
      dom.inputBusca.value = e.target.value;
      aoBuscar(e.target.value);
    });

    dom.btnBuscar.addEventListener('click', () => {
      const termo = dom.inputBusca.value;
      aplicarFiltros(termo);
      exibirSugestoes(termo);
});

    dom.btnBuscarMobile.addEventListener('click', () => {
      const termo = dom.inputBuscaMobile.value;
      aplicarFiltros(termo);
      exibirSugestoes(termo);
      if (termo.trim() && !rolagemJaFeita) {
        const secaoProdutos = document.getElementById('produtos');
        if (secaoProdutos) {
          secaoProdutos.scrollIntoView({ behavior: 'smooth', block: 'start' });
          rolagemJaFeita = true;
        }
      }
    });

    dom.btnLimparBusca.addEventListener('click', limparBusca);
  }

  // ============================================================
  // Eventos — Filtros de categoria
  // ============================================================
  function configurarEventosFiltros() {
    dom.filtrosContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.filtro-pill');
      if (!btn) return;

      categoriaAtiva = btn.dataset.categoria;
      dom.filtrosContainer.querySelectorAll('.filtro-pill').forEach((b) => {
        const ativo = b === btn;
        b.classList.toggle('is-active', ativo);
        b.setAttribute('aria-selected', String(ativo));
      });

      dom.tituloCategoria.textContent = categoriaAtiva === 'todas' ? 'Nossas especialidades' : categoriaAtiva;
      aplicarFiltros();
    });

    dom.btnResetarBusca.addEventListener('click', () => {
      limparBusca();
      categoriaAtiva = 'todas';
      dom.filtrosContainer.querySelectorAll('.filtro-pill').forEach((b) => {
        const ativo = b.dataset.categoria === 'todas';
        b.classList.toggle('is-active', ativo);
        b.setAttribute('aria-selected', String(ativo));
      });
      dom.tituloCategoria.textContent = 'Nossas especialidades';
      aplicarFiltros();
    });
  }

  // ============================================================
  // Eventos — Sugestões (dropdown)
  // ============================================================
  function configurarEventosSugestoes() {
    // Fechar dropdown ao clicar fora
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.busca')) {
        dom.sugestoesBusca.classList.remove('is-ativo');
        dom.sugestoesBuscaMobile.classList.remove('is-ativo');
      }
    });

    // Clicar em uma sugestão
    document.addEventListener('click', (e) => {
      const item = e.target.closest('.sugestao-item');
      if (!item) return;
      const id = Number(item.dataset.id);
      const produto = todosProdutos.find(p => p.id === id);
      if (produto) {
        abrirModalDetalhes(produto.id);
        dom.inputBusca.value = '';
        dom.inputBuscaMobile.value = '';
        rolagemJaFeita = false; // reset para permitir novo scroll
        dom.sugestoesBusca.classList.remove('is-ativo');
        dom.sugestoesBuscaMobile.classList.remove('is-ativo');
        aplicarFiltros('');
      }
    });
  }

  // ============================================================
  // Eventos — Histórico
  // ============================================================
  function configurarEventosGlobais() {
    dom.btnVerHistorico.addEventListener('click', () => {
      renderizarHistorico();
      dom.modalHistoricoOverlay.hidden = false;
      dom.modalHistoricoOverlay.setAttribute('aria-hidden', 'false');
      dom.sobreposicao.hidden = false;
      requestAnimationFrame(() => dom.sobreposicao.classList.add('is-visivel'));
      document.body.style.overflow = 'hidden';
    });

    dom.btnFecharHistorico.addEventListener('click', fecharTodosModais);
    dom.btnLimparHistorico.addEventListener('click', () => {
      gravarStorage(CONFIG.CHAVE_HISTORICO, []);
      renderizarHistorico();
    });
  }

  // ============================================================
  // Limpeza / Filtros
  // ============================================================
  function limparBusca() {
    dom.inputBusca.value = '';
    dom.inputBuscaMobile.value = '';
    dom.btnLimparBusca.hidden = true;
    rolagemJaFeita = false;
    aplicarFiltros('');
    exibirSugestoes('');
    dom.sugestoesBusca.classList.remove('is-ativo');
    dom.sugestoesBuscaMobile.classList.remove('is-ativo');
  }

  function aplicarFiltros(termoBusca) {
    const termo = normalizar(termoBusca ?? dom.inputBusca.value);

    produtosFiltrados = todosProdutos.filter((p) => {
      const bateCategoria = categoriaAtiva === 'todas' || normalizar(p.categoria) === normalizar(categoriaAtiva);
      const bateBusca =
        !termo ||
        normalizar(p.nome).includes(termo) ||
        normalizar(p.descricao).includes(termo) ||
        normalizar(p.categoria).includes(termo);
      return bateCategoria && bateBusca;
    });

    console.log('Buscando por:', termo, '→', produtosFiltrados);

    renderizarProdutos(produtosFiltrados);
  }
})();