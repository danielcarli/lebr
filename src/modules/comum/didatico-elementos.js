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
 * Elementos das lições do módulo Aprender calculados pelos módulos de verdade (viga, laje maciça e pilar): o mesmo
 * cálculo, a mesma lista de ferros e o mesmo modelo 3D da armadura da página de edição de cada elemento.
 */
import { MODULOS_CALCULO } from '../../validacao/calculos.js';
import { calcularElemento } from '../../renderer/core/calculo.js';
import { criarProjeto } from '../../renderer/core/projeto.js';
import { detalhamentoDe, posicoesDe } from './detalhamento.js';
import { modeloViga, modeloLaje, modeloPilar } from './armadura3d.js';

const reg = { obter: (id) => MODULOS_CALCULO[id] };

function novo(modulo, extra) {
  const projeto = criarProjeto();
  projeto.nome = 'Aprender';
  const el = { id: 'aprender', modulo, codigo: { 'concreto.viga': 'V1', 'concreto.laje.macica': 'L1', 'concreto.pilar': 'P1' }[modulo], nome: 'Exemplo da lição', ...MODULOS_CALCULO[modulo].criar(projeto), ...extra };
  projeto.elementos.push(el);
  return { projeto, el };
}

function fechar(projeto, el, modelo3d) {
  const res = calcularElemento(el, projeto, reg);
  el.resultado = res;
  if (res.erro) return { el, projeto, res, det: null, posicoes: [], modelo: null };
  const det = detalhamentoDe(el, res, projeto);
  const posicoes = posicoesDe(el, res, projeto) ?? [];
  let modelo = null;
  try { modelo = det && posicoes.length ? modelo3d(det, posicoes) : null; } catch { modelo = null; }
  return { el, projeto, res, det, posicoes, modelo };
}

/**
 * Viga de um vão com carga uniforme: g (permanente) e q (acidental) em kN/m, além do peso próprio.
 * tipo: 'biapoiada' | 'balanco' (engaste à esquerda) | 'biengastada'.
 */
export function vigaDidatica({ L = 5, g = 10, q = 5, b = 20, h = 50, tipo = 'biapoiada', fck = 25 } = {}) {
  const apoios = tipo === 'balanco' ? ['engaste', 'livre'] : tipo === 'biengastada' ? ['engaste', 'engaste'] : ['apoio', 'apoio'];
  const { projeto, el } = novo('concreto.viga', {
    secao: { b, h }, vaos: [{ L }], apoios,
    cargas: [
      { id: 'g', tipo: 'distribuida', natureza: 'g', vao: 'todos', valor: g, descricao: 'Permanente' },
      { id: 'q', tipo: 'distribuida', natureza: 'q', vao: 'todos', valor: q, descricao: 'Acidental' },
    ],
  });
  projeto.parametros.concreto = { ...projeto.parametros.concreto, fck };
  const cob = projeto.parametros?.cobrimento?.viga ?? 3;
  return fechar(projeto, el, (det, posicoes) => modeloViga(el, det, posicoes, { cob }));
}

/** Laje maciça apoiada nos quatro lados (ou com bordas dadas), carga de uso q e revestimento g em kN/m². */
export function lajeDidatica({ lx = 4, ly = 5, h = 10, q = 1.5, g = 1, bordas } = {}) {
  const { projeto, el } = novo('concreto.laje.macica', {
    lx, ly, h,
    bordas: bordas ?? { x0: 'apoiada', x1: 'apoiada', y0: 'apoiada', y1: 'apoiada' },
    cargas: { uso: null, revestimento: g, acidental: q, outras: 0 },
  });
  const cob = projeto.parametros?.cobrimento?.laje ?? 2.5;
  return fechar(projeto, el, (det, posicoes) => modeloLaje(el, det, posicoes, { cob }));
}

/** Pilar biarticulado com a carga Nk (kN) no topo, seção bx × by (cm) e comprimento (m). */
export function pilarDidatico({ bx = 20, by = 30, comprimento = 2.8, Nk = 600 } = {}) {
  const { projeto, el } = novo('concreto.pilar', {
    bx, by, comprimento,
    cargas: [{ id: 'n', tipo: 'concentrada', natureza: 'g', valor: Nk, descricao: 'Carga no topo' }],
  });
  return fechar(projeto, el, (det, posicoes) => modeloPilar(el, det, posicoes, { pontos: el.resultado?.armadura?.pontos ?? [], cob: el.resultado?.armadura?.cobrimento ?? 3 }));
}

/** Resumo de uma lista de ferros: [{ N, tipo, n, phi, comprimento, massa }] e a massa total (kg). */
export function resumoLista(posicoes) {
  const linhas = posicoes.map((p) => ({ N: p.N, tipo: p.tipo, local: p.local, n: p.n, phi: p.phi, comprimento: p.comprimento, massa: p.massa ?? 0 }));
  return { linhas, massa: linhas.reduce((s, l) => s + (l.massa || 0), 0) };
}
