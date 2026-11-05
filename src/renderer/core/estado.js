/*
 * LEBR — Laboratório de Estruturas Brasil
 * Copyright (C) 2026 Daniel Michelon De Carli
 *
 * Feito com uso da inteligência artificial Claude Opus 5.5, sob a orientação de Daniel Michelon De Carli.
 *
 * Este programa é software livre: você pode redistribuí-lo e/ou modificá-lo nos termos da GNU General Public
 * License, versão 3, publicada pela Free Software Foundation. É distribuído na esperança de ser útil, mas SEM
 * NENHUMA GARANTIA, nem mesmo a garantia implícita de COMERCIALIZAÇÃO ou de ADEQUAÇÃO A UMA FINALIDADE
 * ESPECÍFICA. Veja o arquivo LICENSE ou <https://www.gnu.org/licenses/gpl-3.0.html>.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 */
/**
 * Estado da aplicação: projeto aberto, caminho do arquivo, alterações
 * pendentes e histórico de desfazer/refazer.
 *
 * Toda modificação do projeto passa por `alterar()`, que guarda um
 * instantâneo para o histórico e notifica a interface.
 */
import { Emissor } from './eventos.js';
import { novoId, proximoCodigo } from './projeto.js';

const LIMITE_HISTORICO = 100;

class Estado extends Emissor {
  projeto = null;
  caminho = null;
  sujo = false;
  #desfazer = [];
  #refazer = [];

  abrir(projeto, caminho = null) {
    this.projeto = projeto;
    this.caminho = caminho;
    this.#desfazer = [];
    this.#refazer = [];
    this.marcarSujo(false);
    this.emit('projeto', projeto);
  }

  fechar() {
    this.projeto = null;
    this.caminho = null;
    this.#desfazer = [];
    this.#refazer = [];
    this.marcarSujo(false);
    this.emit('projeto', null);
  }

  marcarSujo(v) {
    this.sujo = v;
    this.emit('sujo', v);
  }

  /**
   * Aplica uma alteração ao projeto.
   * @param {(projeto) => void} fn   função que modifica o projeto no lugar
   * @param {object} [info]
   * @param {string} [info.descricao]   texto para o histórico
   * @param {string} [info.elementoId]  elemento afetado
   * @param {boolean} [info.estrutural] se a mudança altera a estrutura da tela (ex.: nova carga)
   * @param {object} [info.origem]      quem fez a mudança (para evitar redesenho desnecessário)
   * @param {boolean} [info.invalidar=true] marca o resultado do elemento como desatualizado
   */
  alterar(fn, info = {}) {
    if (!this.projeto) return;
    // resultados de cálculo são derivados dos dados: não entram no histórico de desfazer (num projeto grande, uma
    // cópia do projeto por elemento calculado esgotaria a memória)
    if (!info.calculo) {
      this.#desfazer.push(JSON.stringify(this.projeto));
      if (this.#desfazer.length > LIMITE_HISTORICO) this.#desfazer.shift();
      this.#refazer = [];
    }
    fn(this.projeto);
    if (info.elementoId && info.invalidar !== false) {
      const el = this.elemento(info.elementoId);
      if (el?.resultado) el.resultado.desatualizado = true;
    }
    this.marcarSujo(true);
    this.emit('alterado', info);
  }

  get podeDesfazer() { return this.#desfazer.length > 0; }
  get podeRefazer() { return this.#refazer.length > 0; }

  desfazer() {
    if (!this.podeDesfazer) return;
    this.#refazer.push(JSON.stringify(this.projeto));
    this.projeto = JSON.parse(this.#desfazer.pop());
    this.marcarSujo(true);
    this.emit('alterado', { descricao: 'desfazer', estrutural: true, historico: true });
  }

  refazer() {
    if (!this.podeRefazer) return;
    this.#desfazer.push(JSON.stringify(this.projeto));
    this.projeto = JSON.parse(this.#refazer.pop());
    this.marcarSujo(true);
    this.emit('alterado', { descricao: 'refazer', estrutural: true, historico: true });
  }

  /* --- elementos ------------------------------------------------------ */

  elemento(id) {
    return this.projeto?.elementos.find((e) => e.id === id) ?? null;
  }

  elementosDoModulo(...modulos) {
    return this.projeto?.elementos.filter((e) => modulos.includes(e.modulo)) ?? [];
  }

  /** Cria um elemento a partir de um módulo registrado. */
  criarElemento(modulo) {
    const codigo = proximoCodigo(this.projeto, modulo.prefixo);
    const el = { id: novoId(modulo.prefixo.toLowerCase()), modulo: modulo.id, codigo, nome: codigo, ...modulo.criar(this.projeto), resultado: null };
    this.alterar((p) => p.elementos.push(el), { descricao: `Criar ${codigo}`, estrutural: true, elementoId: el.id, invalidar: false });
    this.emit('elemento:criado', el);
    return el;
  }

  duplicarElemento(id) {
    const orig = this.elemento(id);
    if (!orig) return null;
    const prefixo = orig.codigo.replace(/\d+$/, '');
    const copia = { ...structuredClone(orig), id: novoId(prefixo.toLowerCase()), codigo: proximoCodigo(this.projeto, prefixo), resultado: null };
    copia.nome = copia.codigo;
    // A cópia não ocupa o mesmo lugar do original: fica em "Não posicionados" na montagem.
    delete copia.posicao;
    // Ligações com outros elementos (reações de lajes, vigas, pilares) são do original:
    // copiá-las contaria a mesma carga duas vezes. Ao posicionar, "Conectar" refaz as da cópia.
    let removidas = 0;
    if (Array.isArray(copia.cargas)) {
      const antes = copia.cargas.length;
      copia.cargas = copia.cargas.filter((c) => c?.tipo !== 'elemento');
      removidas = antes - copia.cargas.length;
    }
    this.alterar((p) => p.elementos.splice(p.elementos.indexOf(orig) + 1, 0, copia), { descricao: `Duplicar ${orig.codigo}`, estrutural: true });
    this.emit('elemento:criado', copia);
    this.ultimaDuplicacao = { id: copia.id, ligacoesRemovidas: removidas };
    return copia;
  }

  removerElemento(id) {
    const el = this.elemento(id);
    if (!el) return;
    this.alterar((p) => {
      p.elementos = p.elementos.filter((e) => e.id !== id);
      // remove cargas que vinham do elemento apagado
      for (const e of p.elementos) if (Array.isArray(e.cargas)) e.cargas = e.cargas.filter((c) => c.elementoId !== id);
    }, { descricao: `Excluir ${el.codigo}`, estrutural: true });
    this.emit('elemento:removido', el);
  }

  /** Elementos que recebem carga do elemento indicado. */
  dependentesDe(id) {
    return this.projeto?.elementos.filter((e) => e.pilarId === id || (Array.isArray(e.cargas) && e.cargas.some((c) => c.elementoId === id))) ?? [];
  }
}

export const estado = new Estado();
