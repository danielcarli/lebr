/*
 * LEBR — Laboratório de Estruturas Brasil
 * Copyright (C) 2026 Daniel Michelon De Carli
 *
 * Feito com uso da inteligência artificial Claude Opus 5.5, sob a orientação de Daniel Michelon De Carli.
 *
 * Este programa é software livre: você pode redistribuí-lo e/ou modificá-lo nos termos da GNU Affero General
 * Public License, versão 3, publicada pela Free Software Foundation. É distribuído na esperança de ser útil, mas
 * SEM NENHUMA GARANTIA, nem mesmo a garantia implícita de COMERCIALIZAÇÃO ou de ADEQUAÇÃO A UMA FINALIDADE
 * ESPECÍFICA. Veja o arquivo LICENSE ou <https://www.gnu.org/licenses/agpl-3.0.html>.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * Workbench: monta a janela no modelo do VS Code e gerencia
 * barra lateral, abas de editor, painel inferior e barra de status.
 *
 * A bancada não conhece projetos nem módulos — apenas exibe o que
 * as visões e editores registrados entregam.
 */
import { h, limpar } from './dom.js';
import { icone } from './icones.js';
import { botaoIcone } from './componentes.js';
import { criarBarraMenus } from './menus.js';

const PREF = 'lebr.layout';

export class Workbench {
  visoes = new Map();
  /** Grupos de editores lado a lado: [esquerdo] ou [esquerdo, direito]. */
  grupos = [];
  foco = 0;            // índice do grupo com o foco
  /** id da aba fixada no grupo da direita (ex.: 'visualizacao3d'), ou null */
  fixadaDireita = null;
  /** Abas que servem de apoio a outras (ex.: 3D, montagem): com o editor dividido, o que se abre a partir delas vai para o outro lado. */
  vistasDeApoio = new Set();
  #fracao = 0.5;       // largura do grupo da esquerda (fração do espaço dos editores)
  #visaoAtual = null;
  #painelAba = 'saida';
  #fechadas = [];

  constructor(raiz, { plataforma }) {
    this.raiz = raiz;
    document.documentElement.classList.add(`plataforma-${plataforma}`);
    this.#montar();
    this.#restaurarLayout();
  }

  /* ---------------------------------------------------------------- DOM */
  #montar() {
    this.menubarSlot = h('div', { style: { display: 'contents' } });
    this.tituloCentro = h('div', { class: 'titulo-centro' });
    const titulo = h('header', { class: 'titulo' },
      h('div', { class: 'titulo-marca' }, h('i'), 'LEBR'),
      this.menubarSlot,
      this.tituloCentro,
    );

    this.atividadeTopo = h('div', { style: { display: 'contents' } });
    this.atividadeBase = h('div', { style: { display: 'contents' } });
    const atividade = h('nav', { class: 'atividade', 'aria-label': 'Barra de atividades' }, this.atividadeTopo, h('div', { class: 'atividade-sep' }), this.atividadeBase);

    this.lateralTitulo = h('span');
    this.lateralAcoes = h('div', { class: 'acoes' });
    this.lateralCorpo = h('div', { class: 'lateral-corpo' });
    const alcaLateral = h('div', { class: 'alca' });
    this.lateral = h('aside', { class: 'lateral' }, h('div', { class: 'lateral-cab' }, this.lateralTitulo, this.lateralAcoes), this.lateralCorpo, alcaLateral);

    this.gruposEl = h('div', { class: 'editor-grupos' });
    this.#novoGrupo();

    this.painelAbasEl = h('div', { style: { display: 'contents' } });
    this.painelCorpo = h('div', { class: 'painel-corpo' });
    const alcaPainel = h('div', { class: 'alca' });
    this.painel = h('section', { class: 'painel' },
      alcaPainel,
      h('div', { class: 'painel-cab' }, this.painelAbasEl,
        h('div', { class: 'acoes' },
          botaoIcone({ icone: 'lixeira', titulo: 'Limpar saída', aoClicar: () => this.limparSaida() }),
          botaoIcone({ icone: 'fechar', titulo: 'Fechar painel', aoClicar: () => this.alternarPainel(false) }))),
      this.painelCorpo);

    const editorCol = h('div', { class: 'editor-col' }, this.gruposEl, this.painel);
    this.corpo = h('div', { class: 'corpo' }, atividade, this.lateral, editorCol);

    this.statusEsq = h('div', { style: { display: 'contents' } });
    this.statusDir = h('div', { style: { display: 'contents' } });
    const status = h('footer', { class: 'status' }, this.statusEsq, h('div', { class: 'status-sep' }), this.statusDir);
    this.statusEl = status;

    this.raiz.append(titulo, this.corpo, status);

    this.#arrastar(alcaLateral, 'x', (v) => this.#definirLarguraLateral(v));
    this.#arrastar(alcaPainel, 'y', (v) => this.#definirAlturaPainel(v));
  }

  #arrastar(alca, eixo, aplicar) {
    alca.addEventListener('mousedown', (e) => {
      e.preventDefault();
      alca.classList.add('arrastando');
      const mover = (ev) => aplicar(eixo === 'x' ? ev.clientX - 48 : window.innerHeight - 24 - ev.clientY);
      const soltar = () => {
        alca.classList.remove('arrastando');
        window.removeEventListener('mousemove', mover);
        window.removeEventListener('mouseup', soltar);
        this.#salvarLayout();
      };
      window.addEventListener('mousemove', mover);
      window.addEventListener('mouseup', soltar);
    });
  }

  #definirLarguraLateral(v) {
    this.larguraLateral = Math.max(200, Math.min(520, v));
    document.documentElement.style.setProperty('--larg-lateral', `${this.larguraLateral}px`);
  }

  #definirAlturaPainel(v) {
    this.alturaPainel = Math.max(110, Math.min(window.innerHeight * 0.7, v));
    document.documentElement.style.setProperty('--alt-painel', `${this.alturaPainel}px`);
  }

  #salvarLayout() {
    try {
      localStorage.setItem(PREF, JSON.stringify({
        lateral: this.larguraLateral, painel: this.alturaPainel,
        lateralVisivel: !this.corpo.classList.contains('sem-lateral'),
        painelVisivel: !this.painel.classList.contains('fechado'),
        fracao: this.#fracao,
      }));
    } catch { /* armazenamento indisponível */ }
  }

  #restaurarLayout() {
    let p = {};
    try { p = JSON.parse(localStorage.getItem(PREF) ?? '{}'); } catch { /* ignora */ }
    if (p.lateral) this.#definirLarguraLateral(p.lateral);
    if (p.painel) this.#definirAlturaPainel(p.painel);
    if (p.lateralVisivel === false) this.corpo.classList.add('sem-lateral');
    if (p.painelVisivel === false) this.painel.classList.add('fechado');
    if (p.fracao > 0.15 && p.fracao < 0.85) this.#fracao = p.fracao;
  }

  /* ---------------------------------------------------------------- título e menus */
  definirMenus(definicao) {
    limpar(this.menubarSlot).append(criarBarraMenus(definicao));
  }

  definirTitulo({ projeto, sujo, detalhe }) {
    limpar(this.tituloCentro).append(
      ...(projeto ? [h('strong', null, projeto), sujo && h('i', { class: 'sujo', title: 'Alterações não salvas' }), detalhe && h('span', null, `— ${detalhe}`)] : [h('span', null, 'LEBR — Laboratório de Estruturas Brasil')]).filter(Boolean),
    );
  }

  /* ---------------------------------------------------------------- barra lateral */
  /**
   * @param {{id, titulo, icone, render:(el)=>void, acoes?:()=>Node[], contador?:()=>number}} v
   */
  registrarVisao(v) {
    this.visoes.set(v.id, v);
    v.botao = h('button', { class: 'atividade-botao', title: v.titulo, 'aria-label': v.titulo, onClick: () => this.alternarVisao(v.id) }, icone(v.icone, { tamanho: 22, traco: 1.4 }));
    this.atividadeTopo.append(v.botao);
  }

  adicionarBotaoAtividade({ icone: ic, titulo, aoClicar }) {
    const b = h('button', { class: 'atividade-botao', title: titulo, 'aria-label': titulo, onClick: (e) => aoClicar(e, b) }, icone(ic, { tamanho: 22, traco: 1.4 }));
    this.atividadeBase.append(b);
    return b;
  }

  alternarVisao(id) {
    const fechada = this.corpo.classList.contains('sem-lateral');
    if (this.#visaoAtual === id && !fechada) { this.alternarLateral(false); return; }
    this.mostrarVisao(id);
  }

  mostrarVisao(id) {
    const v = this.visoes.get(id);
    if (!v) return;
    this.#visaoAtual = id;
    this.corpo.classList.remove('sem-lateral');
    for (const outra of this.visoes.values()) outra.botao.classList.toggle('ativo', outra.id === id);
    this.redesenharVisao();
    this.#salvarLayout();
  }

  redesenharVisao() {
    const v = this.visoes.get(this.#visaoAtual);
    if (!v) return;
    this.lateralTitulo.textContent = v.titulo;
    limpar(this.lateralAcoes).append(...(v.acoes?.() ?? []));
    const rolagem = this.lateralCorpo.scrollTop;
    limpar(this.lateralCorpo);
    v.render(this.lateralCorpo);
    this.lateralCorpo.scrollTop = rolagem;
    for (const visao of this.visoes.values()) {
      visao.botao.querySelector('.contador')?.remove();
      const n = visao.contador?.();
      if (n) visao.botao.append(h('span', { class: 'contador' }, String(n)));
    }
  }

  alternarLateral(forcar) {
    const mostrar = forcar ?? this.corpo.classList.contains('sem-lateral');
    this.corpo.classList.toggle('sem-lateral', !mostrar);
    for (const v of this.visoes.values()) v.botao.classList.toggle('ativo', mostrar && v.id === this.#visaoAtual);
    if (mostrar && !this.#visaoAtual) this.mostrarVisao(this.visoes.keys().next().value);
    this.#salvarLayout();
  }

  /* ---------------------------------------------------------------- grupos de editores */
  #novoGrupo() {
    const g = { abas: [], ativa: null, instancia: null, rolagem: new Map() };
    g.abasEl = h('div', { class: 'abas', role: 'tablist' });
    g.editorEl = h('main', { class: 'editor' });
    g.soltarEl = h('div', { class: 'zona-soltar' });
    g.el = h('section', { class: 'grupo-editor' }, g.abasEl, h('div', { class: 'grupo-corpo' }, g.editorEl, g.soltarEl));
    // clicar em qualquer ponto do grupo passa o foco para ele (sem redesenhar)
    g.el.addEventListener('mousedown', () => this.focar(this.grupos.indexOf(g)), true);
    this.#alvoDeArrasto(g);
    this.grupos.push(g);
    if (this.grupos.length === 2) {
      this.divisorEl = h('div', { class: 'divisor-grupos', title: 'Arraste para redimensionar' });
      this.#arrastarDivisor(this.divisorEl);
      this.gruposEl.append(this.divisorEl);
    }
    this.gruposEl.append(g.el);
    this.#aplicarDivisao();
    return g;
  }

  #removerGrupoDireito() {
    const g = this.grupos[1];
    if (!g) return;
    g.instancia?.destruir?.();
    g.el.remove();
    this.divisorEl?.remove();
    this.divisorEl = null;
    this.grupos.length = 1;
    this.foco = 0;
    this.#aplicarDivisao();
  }

  #aplicarDivisao() {
    const dividido = this.grupos.length > 1;
    this.gruposEl.classList.toggle('dividido', dividido);
    if (this.grupos[0]) this.grupos[0].el.style.flexBasis = dividido ? `${this.#fracao * 100}%` : '';
    if (this.grupos[1]) this.grupos[1].el.style.flexBasis = `${(1 - this.#fracao) * 100}%`;
    this.grupos.forEach((g, i) => g.el.classList.toggle('focado', dividido && i === this.foco));
  }

  #arrastarDivisor(alca) {
    alca.addEventListener('mousedown', (e) => {
      e.preventDefault();
      alca.classList.add('arrastando');
      document.body.classList.add('redimensionando');
      const r = this.gruposEl.getBoundingClientRect();
      const mover = (ev) => {
        this.#fracao = Math.max(0.2, Math.min(0.8, (ev.clientX - r.left) / r.width));
        this.#aplicarDivisao();
      };
      const soltar = () => {
        alca.classList.remove('arrastando');
        document.body.classList.remove('redimensionando');
        window.removeEventListener('mousemove', mover);
        window.removeEventListener('mouseup', soltar);
        this.#salvarLayout();
      };
      window.addEventListener('mousemove', mover);
      window.addEventListener('mouseup', soltar);
    });
  }

  /** Arrastar abas: soltar na barra de abas de um grupo move a aba para lá; soltar na metade direita do editor divide. */
  #alvoDeArrasto(g) {
    const tipo = 'application/x-lebr-aba';
    const temAba = (e) => [...(e.dataTransfer?.types ?? [])].includes(tipo);
    const posicaoNaBarra = (e) => {
      const abas = [...g.abasEl.querySelectorAll('.aba')];
      const i = abas.findIndex((el) => { const r = el.getBoundingClientRect(); return e.clientX < r.left + r.width / 2; });
      return i < 0 ? abas.length : i;
    };
    g.abasEl.addEventListener('dragover', (e) => { if (!temAba(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; g.abasEl.classList.add('soltar'); });
    g.abasEl.addEventListener('dragleave', () => g.abasEl.classList.remove('soltar'));
    g.abasEl.addEventListener('drop', (e) => {
      if (!temAba(e)) return;
      e.preventDefault(); e.stopPropagation();
      g.abasEl.classList.remove('soltar');
      this.moverAba(e.dataTransfer.getData(tipo), this.grupos.indexOf(g), posicaoNaBarra(e));
    });
    const lado = (e) => {
      const r = g.editorEl.getBoundingClientRect();
      // com um grupo só, a metade direita abre um grupo novo; nos demais casos, o grupo inteiro recebe a aba
      return this.grupos.length === 1 && e.clientX > r.left + r.width / 2 ? 'direita' : 'centro';
    };
    const corpo = g.soltarEl.parentElement;
    corpo.addEventListener('dragover', (e) => {
      if (!temAba(e)) return;
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      g.soltarEl.dataset.lado = lado(e);
      g.soltarEl.classList.add('visivel');
    });
    corpo.addEventListener('dragleave', (e) => { if (!corpo.contains(e.relatedTarget)) g.soltarEl.classList.remove('visivel'); });
    corpo.addEventListener('drop', (e) => {
      if (!temAba(e)) return;
      e.preventDefault(); e.stopPropagation();
      g.soltarEl.classList.remove('visivel');
      const id = e.dataTransfer.getData(tipo);
      const destino = lado(e) === 'direita' ? 1 : this.grupos.indexOf(g);
      this.moverAba(id, destino);
    });
  }

  /** Há dois grupos de editores lado a lado? */
  get dividido() { return this.grupos.length > 1; }

  /** Todas as abas abertas, da esquerda para a direita. */
  get abas() { return this.grupos.flatMap((g) => g.abas); }

  /** id da aba ativa do grupo com o foco. */
  get ativa() { return this.grupos[this.foco]?.ativa ?? null; }

  /** Editor (elemento DOM) do grupo com o foco. */
  get editorEl() { return this.grupos[this.foco]?.editorEl; }

  #grupoDe(id) { return this.grupos.find((g) => g.abas.some((a) => a.id === id)) ?? null; }

  /** Índice do grupo em que está a aba (−1 se não está aberta). */
  grupoDaAba(id) { const g = this.#grupoDe(id); return g ? this.grupos.indexOf(g) : -1; }

  /** Passa o foco para o grupo i, sem redesenhar os editores. */
  focar(i) {
    if (!this.grupos[i] || i === this.foco) return;
    this.foco = i;
    this.#aplicarDivisao();
    this.emitirMudancaAba?.(this.ativa);
  }

  /** Grupo em que uma aba nova abre: a fixada vai para a direita; com ela lá, as demais ficam à esquerda. */
  #destino(def) {
    if (this.fixadaDireita && def.id === this.fixadaDireita) return 1;
    const g1 = this.grupos[1];
    if (this.foco === 1 && g1?.abas.some((a) => a.id === this.fixadaDireita)) return 0;
    // com o editor dividido, o que se abre a partir de uma vista de apoio (3D, montagem) vai para o outro lado
    if (this.dividido && this.vistasDeApoio.has(this.ativa) && !this.vistasDeApoio.has(def.id)) {
      const outro = 1 - this.foco;
      // o lado da aba fixada não recebe outras abas
      if (!(outro === 1 && g1?.abas.some((a) => a.id === this.fixadaDireita))) return outro;
    }
    return this.foco;
  }

  /**
   * @param {object} def
   * @param {string} def.id
   * @param {() => string} def.titulo
   * @param {string} def.icone
   * @param {(container:HTMLElement) => ({destruir?, aoAlterar?}|void)} def.render
   * @param {() => boolean} [def.marcada]  exibe ponto terracota (ex.: resultado desatualizado)
   * @param {object} [op]
   * @param {0|1} [op.grupo]  0 = esquerda, 1 = direita (cria o grupo da direita se preciso)
   */
  abrirAba(def, { grupo } = {}) {
    const existente = this.#grupoDe(def.id);
    if (existente && (grupo == null || this.grupos.indexOf(existente) === grupo)) { this.ativarAba(def.id); return; }
    if (existente) { this.moverAba(def.id, grupo); return; }
    const i = grupo ?? this.#destino(def);
    const g = i === 1 ? (this.grupos[1] ?? this.#novoGrupo()) : this.grupos[0];
    g.abas.push(def);
    this.ativarAba(def.id);
  }

  ativarAba(id) {
    const g = this.#grupoDe(id);
    if (!g) return;
    if (g.ativa) g.rolagem.set(g.ativa, g.editorEl.scrollTop);
    g.ativa = id;
    this.foco = this.grupos.indexOf(g);
    this.#aplicarDivisao();
    this.desenharAbas();
    this.#redesenharGrupo(g);
    this.emitirMudancaAba?.(id);
  }

  /**
   * Move uma aba para o grupo `destino` (0 ou 1), na posição `pos` da barra.
   * Um grupo que fica vazio é fechado (o da direita passa para a esquerda).
   */
  moverAba(id, destino, pos = null) {
    const origem = this.#grupoDe(id);
    if (!origem) return;
    const iOrigem = this.grupos.indexOf(origem);
    const def = origem.abas.find((a) => a.id === id);
    // reordenar na mesma barra
    if (iOrigem === destino) {
      const k = origem.abas.indexOf(def);
      origem.abas.splice(k, 1);
      const p = pos == null ? origem.abas.length : pos > k ? pos - 1 : pos;
      origem.abas.splice(Math.min(p, origem.abas.length), 0, def);
      this.ativarAba(id);
      return;
    }
    // a única aba do único grupo não tem para onde ir
    if (!this.dividido && origem.abas.length === 1) return;
    const alvo = destino === 1 ? (this.grupos[1] ?? this.#novoGrupo()) : this.grupos[0];
    origem.abas.splice(origem.abas.indexOf(def), 1);
    origem.rolagem.delete(id);
    if (origem.ativa === id) {
      origem.instancia?.destruir?.();
      origem.instancia = null;
      origem.ativa = origem.abas.at(-1)?.id ?? null;
    }
    alvo.abas.splice(pos == null ? alvo.abas.length : Math.min(pos, alvo.abas.length), 0, def);
    alvo.ativa = id;
    if (!origem.abas.length && this.#podeJuntar(origem)) {
      this.#juntar();
      this.ativarAba(id);
      return;
    }
    this.#redesenharGrupo(origem);
    this.ativarAba(id);
  }

  /** Um grupo vazio se fecha — exceto o da esquerda quando a direita guarda a aba fixada. */
  #podeJuntar(vazio) {
    if (!this.dividido) return false;
    if (vazio === this.grupos[0] && this.grupos[1].abas.some((a) => a.id === this.fixadaDireita)) return false;
    return true;
  }

  /** Junta os dois grupos num só (o que tiver abas fica à esquerda). */
  #juntar() {
    const [g0, g1] = this.grupos;
    if (!g1) return;
    if (!g0.abas.length) {
      g0.instancia?.destruir?.();
      g0.instancia = null;
      g0.abas = g1.abas; g0.ativa = g1.ativa; g0.rolagem = g1.rolagem;
      g1.abas = [];
      this.#removerGrupoDireito();
      this.desenharAbas();
      this.#redesenharGrupo(g0);
    } else {
      g0.abas.push(...g1.abas);
      this.#removerGrupoDireito();
      this.desenharAbas();
    }
  }

  /** Divide o editor: a aba ativa vai para o outro lado (com um grupo só, abre o da direita). */
  dividir(id = this.ativa) {
    if (!id) return;
    const i = this.grupoDaAba(id);
    this.moverAba(id, i === 1 ? 0 : 1);
  }

  /** Volta a um grupo só, com todas as abas. */
  juntarGrupos() {
    if (!this.dividido) return;
    const ativa = this.ativa;
    const [g0, g1] = this.grupos;
    g1.instancia?.destruir?.();
    g1.instancia = null;
    g0.abas.push(...g1.abas);
    g1.abas = [];
    this.#removerGrupoDireito();
    if (ativa) this.ativarAba(ativa); else this.desenharAbas();
  }

  /**
   * Fixa a aba `id` no grupo da direita (ou solta, com null). Se ela já está aberta, vai para a direita.
   */
  fixarADireita(id) {
    this.fixadaDireita = id;
    if (id && this.#grupoDe(id) && this.grupoDaAba(id) !== 1) this.moverAba(id, 1);
    this.desenharAbas();
  }

  fecharAba(id = this.ativa) {
    const g = this.#grupoDe(id);
    if (!g) return;
    const i = g.abas.findIndex((a) => a.id === id);
    const gi = this.grupos.indexOf(g);
    // guarda para "Reabrir aba fechada" (as mais recentes no fim)
    this.#fechadas = [...this.#fechadas.filter((d) => d.def.id !== id), { def: g.abas[i], pos: i, grupo: gi }].slice(-20);
    g.abas.splice(i, 1);
    g.rolagem.delete(id);
    if (!g.abas.length && this.#podeJuntar(g)) {
      g.instancia?.destruir?.();
      g.instancia = null;
      g.ativa = null;
      this.#juntar();
      const outro = this.grupos[0];
      this.foco = 0;
      this.#aplicarDivisao();
      this.desenharAbas();
      if (gi === 0) { /* o grupo da direita já foi redesenhado na esquerda */ } else if (!outro.instancia) this.#redesenharGrupo(outro);
      this.emitirMudancaAba?.(this.ativa);
      return;
    }
    if (g.ativa === id) {
      const prox = g.abas[i] ?? g.abas[i - 1];
      g.ativa = null;
      if (prox) this.ativarAba(prox.id);
      else { this.desenharAbas(); this.#redesenharGrupo(g); this.emitirMudancaAba?.(this.ativa); }
    } else this.desenharAbas();
  }

  fecharAbasOnde(pred) {
    for (const a of [...this.abas]) if (pred(a)) this.fecharAba(a.id);
  }

  abaAtiva() {
    const g = this.grupos[this.foco];
    return g?.abas.find((a) => a.id === g.ativa) ?? null;
  }

  /** Aba ativa de cada grupo (esquerda, direita). */
  abasVisiveis() { return this.grupos.map((g) => g.abas.find((a) => a.id === g.ativa)).filter(Boolean); }

  /** Ativa a aba vizinha no grupo com o foco: +1 a próxima, −1 a anterior, voltando ao início/fim (como no VS Code). */
  ativarVizinha(delta) {
    const abas = this.grupos[this.foco]?.abas ?? [];
    const n = abas.length;
    if (n < 2) return;
    const i = Math.max(0, abas.findIndex((a) => a.id === this.ativa));
    this.ativarAba(abas[(i + delta + n) % n].id);
  }

  /** Ativa a aba na posição indicada do grupo com o foco (1 = primeira; −1 = última). */
  ativarPosicao(pos) {
    const abas = this.grupos[this.foco]?.abas ?? [];
    const a = pos < 0 ? abas.at(pos) : abas[pos - 1];
    if (a) this.ativarAba(a.id);
  }

  /**
   * Reabre a última aba fechada que ainda faz sentido (`valida` recusa, por exemplo,
   * a aba de um elemento que foi excluído). Retorna a aba reaberta ou null.
   */
  reabrirAba(valida = () => true) {
    while (this.#fechadas.length) {
      const { def, pos, grupo } = this.#fechadas.pop();
      if (this.#grupoDe(def.id) || !valida(def)) continue;
      // volta para o lado de onde saiu (a aba fixada, sempre para a direita)
      const direita = grupo === 1 || def.id === this.fixadaDireita;
      const g = direita ? (this.grupos[1] ?? (this.grupos[0].abas.length ? this.#novoGrupo() : this.grupos[0])) : this.grupos[0];
      g.abas.splice(Math.min(pos, g.abas.length), 0, def); // volta para onde estava
      this.ativarAba(def.id);
      return def;
    }
    return null;
  }

  /** Esvazia a pilha de abas fechadas (ao trocar de projeto). */
  esquecerFechadas() { this.#fechadas = []; }

  desenharAbas() {
    this.grupos.forEach((g, gi) => {
      limpar(g.abasEl);
      for (const a of g.abas) {
        const ativa = a.id === g.ativa;
        const fixada = a.id === this.fixadaDireita && gi === 1;
        const el = h('div', {
          class: ['aba', ativa && 'ativa', fixada && 'fixada'], role: 'tab', 'aria-selected': String(ativa), title: a.dica?.() ?? '', draggable: 'true',
          onMousedown: (e) => {
            if (e.button === 1) { e.preventDefault(); this.fecharAba(a.id); }
            else if (e.button === 0) { if (ativa && g.instancia) this.focar(gi); else this.ativarAba(a.id); }
          },
          onDragstart: (e) => { e.dataTransfer.setData('application/x-lebr-aba', a.id); e.dataTransfer.effectAllowed = 'move'; document.body.classList.add('arrastando-aba'); },
          onDragend: () => { document.body.classList.remove('arrastando-aba'); for (const x of this.grupos) { x.soltarEl.classList.remove('visivel'); x.abasEl.classList.remove('soltar'); } },
          onContextmenu: (e) => this.aoMenuAba?.(e, a, gi),
        },
          icone(a.icone, { tamanho: 14 }),
          h('span', { class: 'aba-titulo' }, a.titulo()),
          a.marcada?.() && h('i', { class: 'marca-desat', title: 'Resultado desatualizado' }),
          fixada && h('span', { class: 'aba-pino', title: 'Fixada à direita' }, icone('pino', { tamanho: 12, traco: 1.8 })),
          h('button', { class: 'aba-fechar', title: 'Fechar', draggable: 'false', onMousedown: (e) => { e.stopPropagation(); if (e.button === 0) this.fecharAba(a.id); } }, icone('fechar', { tamanho: 13 })),
        );
        g.abasEl.append(el);
      }
      g.abasEl.append(h('div', { class: 'abas-vazio' }));
      // ações do grupo: dividir (no grupo com o foco) e fechar o grupo da direita
      const acoes = h('div', { class: 'abas-acoes' });
      if (gi === this.grupos.length - 1) acoes.append(h('button', { class: 'abas-acao', title: this.dividido ? 'Mover a aba para o outro lado (Ctrl+\\)' : 'Dividir o editor: abrir a aba ativa à direita (Ctrl+\\)', onClick: () => this.dividir(g.ativa ?? this.ativa) }, icone('dividir', { tamanho: 15 })));
      if (gi === 1) acoes.append(h('button', { class: 'abas-acao', title: 'Juntar os dois lados', onClick: () => this.juntarGrupos() }, icone('fechar', { tamanho: 14 })));
      g.abasEl.append(acoes);
      g.abasEl.querySelector('.aba.ativa')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }

  #redesenharGrupo(g) {
    g.instancia?.destruir?.();
    g.instancia = null;
    limpar(g.editorEl);
    g.editorEl.className = 'editor';
    const a = g.abas.find((x) => x.id === g.ativa);
    if (!a) {
      g.editorEl.append(h('div', { class: 'editor-vazio' }, icone('documento', { tamanho: 44, traco: 0.9 }),
        this.dividido && h('p', null, 'Arraste uma aba para cá ou abra um elemento no explorador.')));
      return;
    }
    g.instancia = a.render(g.editorEl) ?? null;
    g.editorEl.scrollTop = g.rolagem.get(a.id) ?? 0;
  }

  /** Redesenha a aba indicada (no grupo em que estiver) ou a do grupo com o foco. */
  redesenharAba(id) {
    const g = id ? this.#grupoDe(id) : this.grupos[this.foco];
    if (!g || (id && g.ativa !== id)) return;
    this.#redesenharGrupo(g);
  }

  /** Redesenha as abas visíveis dos dois grupos. */
  redesenharTodas() { for (const g of this.grupos) this.#redesenharGrupo(g); }

  /** Instância (retorno do render) da aba, se ela estiver visível. */
  instanciaDe(id) { const g = this.#grupoDe(id); return g?.ativa === id ? g.instancia : null; }

  /** Repassa uma alteração do projeto aos editores visíveis. O que não tratar, redesenha. */
  notificarAba(info) {
    for (const g of this.grupos) {
      const tratou = g.instancia?.aoAlterar?.(info);
      if (!tratou) {
        const pos = g.editorEl.scrollTop;
        this.#redesenharGrupo(g);
        g.editorEl.scrollTop = pos;
      }
    }
    this.desenharAbas();
  }

  /* ---------------------------------------------------------------- painel */
  definirAbasPainel(abas) {
    this.abasPainel = abas; // [{id, titulo, contador?:()=>number, render:(el)=>void}]
    this.desenharPainel();
  }

  mostrarPainel(id) {
    this.#painelAba = id;
    this.alternarPainel(true);
    this.desenharPainel();
  }

  alternarPainel(forcar) {
    const mostrar = forcar ?? this.painel.classList.contains('fechado');
    this.painel.classList.toggle('fechado', !mostrar);
    this.#salvarLayout();
  }

  desenharPainel() {
    limpar(this.painelAbasEl);
    for (const a of this.abasPainel ?? []) {
      const n = a.contador?.();
      this.painelAbasEl.append(h('button', { class: ['painel-aba', a.id === this.#painelAba && 'ativa'], onClick: () => this.mostrarPainel(a.id) },
        a.titulo, n ? h('span', { class: 'contador' }, String(n)) : null));
    }
    const a = this.abasPainel?.find((x) => x.id === this.#painelAba);
    limpar(this.painelCorpo);
    this.painelCorpo.className = 'painel-corpo';
    a?.render(this.painelCorpo);
    if (a?.id === 'saida') this.painelCorpo.scrollTop = this.painelCorpo.scrollHeight;
  }

  /** Aba ativa do painel inferior ('saida', 'problemas', 'console'…). */
  get painelAtivo() { return this.#painelAba; }

  limparSaida() { this.aoLimparSaida?.(this.#painelAba); this.desenharPainel(); }

  /* ---------------------------------------------------------------- status */
  /**
   * @param {object} p
   * @param {'ok'|'falha'|'pendente'} [p.situacao]  cor da barra: verde (tudo atende), terracota (algum erro) ou
   *        cinza-chumbo (ainda não calculado/validado)
   * @param {string} [p.titulo]  explicação da cor (dica ao passar o mouse)
   */
  definirStatus({ esquerda = [], direita = [], situacao = null, titulo = '' }) {
    limpar(this.statusEsq).append(...esquerda);
    limpar(this.statusDir).append(...direita);
    this.statusEl.classList.remove('situacao-ok', 'situacao-falha', 'situacao-pendente');
    if (situacao) this.statusEl.classList.add(`situacao-${situacao}`);
    this.statusEl.title = titulo;
  }
}

/** Item da barra de status. */
export function itemStatus({ texto, icone: ic, titulo, aoClicar, classe = '' }) {
  const tag = aoClicar ? 'button' : 'span';
  return h(tag, { class: ['status-item', classe], title: titulo ?? '', onClick: aoClicar }, ic && icone(ic, { tamanho: 13, traco: 1.8 }), texto);
}
