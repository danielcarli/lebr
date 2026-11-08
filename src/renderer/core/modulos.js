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
 * Registro de módulos de cálculo.
 *
 * Um módulo é um arquivo JavaScript (ES module) cuja exportação padrão é
 * uma função-fábrica: `export default (api) => ({ ...definição })`.
 * A fábrica recebe a API do LEBR (componentes de interface, motor de
 * cálculo e utilitários), o que permite instalar módulos externos sem
 * acesso aos arquivos internos. O contrato completo está em docs/MODULOS.md.
 */
import { Emissor } from './eventos.js';

/** Categorias exibidas no explorador. Módulos podem registrar outras. */
const CATEGORIAS = [
  { id: 'vigas', nome: 'Vigas', ordem: 1 },
  { id: 'lajes', nome: 'Lajes', ordem: 2 },
  { id: 'pilares', nome: 'Pilares', ordem: 3 },
];

const OBRIGATORIOS = ['id', 'nome', 'categoria', 'prefixo', 'criar', 'calcular', 'renderEntrada', 'renderResultado'];

/**
 * Sigla do módulo: 3 caracteres alfanuméricos — material + tipo + número
 * (CV1 = viga de concreto, ML1 = entrepiso de madeira…). Exibida no cabeçalho dos elementos.
 */
const SIGLA = /^[A-Z0-9]{3}$/;
const letra = (t) => (String(t ?? '').normalize('NFD').replace(/[^A-Za-z0-9]/g, '')[0] ?? 'X').toUpperCase();

class RegistroModulos extends Emissor {
  #modulos = new Map();
  #categorias = new Map(CATEGORIAS.map((c) => [c.id, c]));
  #falhas = [];

  /** @param {object} def definição já produzida pela fábrica */
  registrar(def, origem = 'interno') {
    const faltando = OBRIGATORIOS.filter((k) => def[k] == null);
    if (faltando.length) throw new Error(`Módulo "${def.id ?? '?'}" incompleto: falta ${faltando.join(', ')}.`);
    if (this.#modulos.has(def.id)) throw new Error(`Já existe um módulo com id "${def.id}".`);
    if (def.novaCategoria && !this.#categorias.has(def.novaCategoria.id)) this.#categorias.set(def.novaCategoria.id, { ordem: 50, ...def.novaCategoria });
    if (!this.#categorias.has(def.categoria)) throw new Error(`Categoria desconhecida: ${def.categoria}.`);
    const sigla = this.#sigla(def);
    this.#modulos.set(def.id, { versao: '0.0.0', material: '', norma: '', descricao: '', ...def, sigla, origem });
    this.emit('registrado', def);
  }

  /** Sigla informada pelo módulo (validada) ou gerada a partir do material e do prefixo. */
  #sigla(def) {
    const usadas = new Set(this.lista().map((m) => m.sigla));
    if (def.sigla != null) {
      const s = String(def.sigla).toUpperCase();
      if (!SIGLA.test(s)) throw new Error(`Módulo "${def.id}": a sigla deve ter 3 letras ou algarismos (ex.: CV1).`);
      if (usadas.has(s)) throw new Error(`Módulo "${def.id}": a sigla ${s} já é usada por outro módulo.`);
      return s;
    }
    const base = letra(def.material) + letra(def.prefixo);
    for (let n = 1; n <= 9; n++) if (!usadas.has(`${base}${n}`)) return `${base}${n}`;
    for (let n = 10; n < 36; n++) { const s = `${base}${n.toString(36).toUpperCase()}`; if (!usadas.has(s)) return s; }
    return `${base}0`;
  }

  /** Módulo pela sigla (ex.: 'CL2'). */
  daSigla(sigla) { return this.lista().find((m) => m.sigla === String(sigla).toUpperCase()) ?? null; }

  falha(info) { this.#falhas.push(info); }
  get falhas() { return [...this.#falhas]; }

  obter(id) { return this.#modulos.get(id) ?? null; }
  lista() { return [...this.#modulos.values()]; }
  categorias() { return [...this.#categorias.values()].sort((a, b) => a.ordem - b.ordem); }
  daCategoria(cat) { return this.lista().filter((m) => m.categoria === cat); }
}

export const modulos = new RegistroModulos();

/**
 * Carrega uma lista de fábricas de módulo.
 * @param {{fabrica:Function, origem:string}[]} fontes
 */
export function instalar(fontes, api) {
  for (const { fabrica, origem } of fontes) {
    try {
      const def = typeof fabrica === 'function' ? fabrica(api) : fabrica;
      modulos.registrar(def, origem);
    } catch (err) {
      console.error(err);
      modulos.falha({ origem, erro: err.message });
    }
  }
}
