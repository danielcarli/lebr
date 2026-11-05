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
 * Ações da montagem para as fundações (sem interface, testáveis no Node):
 *   - criarSapatasNosPilares: uma sapata ligada a cada pilar que chega à fundação e ainda não tem uma;
 *   - criarBlocosNosPilares: um bloco sobre estacas ligado a cada pilar da fundação sem sapata nem bloco;
 *   - criarNivelBaldrame: nível de baldrame abaixo do pavimento mais baixo, com os arranques dos pilares e as
 *     vigas baldrame no mesmo traçado das vigas do pavimento de cima.
 */
import { novoId, proximoCodigo } from './projeto.js';
import { pavimentosOrdenados, centroPilar, aplicarLigacoes, detectarLigacoes, novoIdPavimento, secaoViga } from './montagem.js';
import { criarSapata, pilaresDeFundacao, COBRIMENTO_SOLO } from '../../modules/concreto-sapata/calculo.js';
import { criarBloco } from '../../modules/concreto-bloco/calculo.js';

/** Módulos que apoiam um pilar na fundação (um por pilar). */
export const APOIOS_DE_FUNDACAO = ['concreto.sapata', 'concreto.bloco'];
const temApoio = (projeto, pilarId) => projeto.elementos.some((e) => APOIOS_DE_FUNDACAO.includes(e.modulo) && e.pilarId === pilarId);

/** Código livre: o preferido, ou o próximo da série do prefixo. */
const codigoLivre = (projeto, preferido, prefixo) => (projeto.elementos.some((e) => e.codigo === preferido) ? proximoCodigo(projeto, prefixo) : preferido);

/**
 * Cria as sapatas que faltam sob os pilares da fundação.
 * @returns {string[]} ids das sapatas criadas
 */
export function criarSapatasNosPilares(projeto, registro) {
  const criadas = [];
  for (const { pilar } of pilaresDeFundacao(projeto, registro)) {
    if (temApoio(projeto, pilar.id)) continue;
    const codigo = codigoLivre(projeto, `S${pilar.codigo.replace(/^[A-Za-z]+/, '')}`, 'S');
    const el = { id: novoId('s'), modulo: 'concreto.sapata', codigo, nome: `Sapata de ${pilar.codigo}`, ...criarSapata(projeto), pilarId: pilar.id, resultado: null };
    projeto.elementos.push(el);
    criadas.push(el.id);
  }
  return criadas;
}

/**
 * Cria os blocos sobre estacas que faltam sob os pilares da fundação (pilares que já têm sapata ficam como estão).
 * @param {object} op  { estaca: ajustes da estaca (tipo, D, L…) }
 * @returns {string[]} ids dos blocos criados
 */
export function criarBlocosNosPilares(projeto, registro, { estaca = {} } = {}) {
  const criados = [];
  for (const { pilar } of pilaresDeFundacao(projeto, registro)) {
    if (temApoio(projeto, pilar.id)) continue;
    const codigo = codigoLivre(projeto, `B${pilar.codigo.replace(/^[A-Za-z]+/, '')}`, 'B');
    const base = criarBloco(projeto);
    const el = { id: novoId('b'), modulo: 'concreto.bloco', codigo, nome: `Bloco de ${pilar.codigo}`, ...base, estaca: { ...base.estaca, ...estaca }, pilarId: pilar.id, resultado: null };
    projeto.elementos.push(el);
    criados.push(el.id);
  }
  return criados;
}

/** Carga de parede padrão sobre o baldrame (alvenaria de vedação do térreo). */
const paredeBaldrame = (altura) => ({ id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, tipo: 'alvenaria', material: 'ceramico-vedacao', espessura: 14, revestimento: 2, altura, aberturas: 0, vao: 'todos', descricao: 'Parede do térreo' });

/**
 * Cria o nível de baldrame abaixo do pavimento mais baixo.
 * @param {object} op  { arranque: comprimento dos arranques abaixo do baldrame (m), secao: {b, h} das vigas baldrame (cm) }
 * @returns {{ pavimento, arranques:string[], vigas:string[], ligacoes:number, sapatas:number }}
 */
export function criarNivelBaldrame(projeto, registro, { arranque = 1.0, secao = { b: 15, h: 40 } } = {}) {
  const pavs = pavimentosOrdenados(projeto);
  if (!pavs.length) throw new Error('O projeto não tem pavimentos.');
  if (pavs.some((p) => p.tipo === 'baldrame')) throw new Error('O projeto já tem um nível de baldrame.');
  const baixo = pavs[0];
  const doBaixo = projeto.elementos.filter((e) => e.posicao?.pavimento === baixo.id);
  const pilares = doBaixo.filter((e) => e.modulo === 'concreto.pilar');
  if (!pilares.length) throw new Error(`O ${baixo.nome} não tem pilares de concreto para levar ao baldrame.`);
  // cota do baldrame: a base dos pilares do pavimento mais baixo
  const cota = Math.round(Math.min(...pilares.map((p) => baixo.cota - (p.comprimento ?? 3))) * 100) / 100;
  const pav = { id: novoIdPavimento(), nome: 'Baldrame', cota, tipo: 'baldrame', analise: baixo.analise ?? 'isolada' };
  projeto.pavimentos.push(pav);

  // arranques: do topo da sapata ao baldrame, no prumo de cada pilar do pavimento mais baixo
  const arranques = [];
  for (const p of pilares) {
    const a = structuredClone(p);
    a.id = novoId('p');
    a.codigo = codigoLivre(projeto, `PB${p.codigo.replace(/^\D+/, '')}`, 'PB');
    a.nome = `Arranque de ${p.codigo}`;
    a.posicao = { ...p.posicao, pavimento: pav.id };
    a.comprimento = arranque;
    a.cargas = [];
    a.resultado = null;
    if (a.le) a.le = { x: null, y: null };
    projeto.elementos.push(a);
    arranques.push({ de: p.id, id: a.id });
  }
  // sapatas que estavam sob os pilares do pavimento de baixo passam para os arranques
  let sapatas = 0;
  for (const s of projeto.elementos.filter((e) => APOIOS_DE_FUNDACAO.includes(e.modulo))) {
    const a = arranques.find((x) => x.de === s.pilarId);
    if (a) { s.pilarId = a.id; s.resultado = null; sapatas++; }
  }

  // vigas baldrame no traçado das vigas do pavimento de baixo
  const vigas = [];
  const altParede = Math.max(1, Math.round((baixo.cota - cota - secao.h / 100) * 100) / 100);
  for (const v of doBaixo.filter((e) => e.modulo === 'concreto.viga')) {
    const b = structuredClone(v);
    b.id = novoId('v');
    b.codigo = proximoCodigo(projeto, 'VB');
    b.nome = `Baldrame sob ${v.codigo}`;
    b.posicao = { ...v.posicao, pavimento: pav.id };
    b.secao = { ...secaoViga(v), b: secao.b, h: secao.h };
    b.baldrame = true;
    b.cargas = [paredeBaldrame(altParede)];
    b.resultado = null;
    projeto.elementos.push(b);
    vigas.push(b.id);
  }
  const ligacoes = aplicarLigacoes(projeto, detectarLigacoes(projeto, registro));
  return { pavimento: pav, arranques: arranques.map((a) => a.id), vigas, ligacoes, sapatas, centro: centroPilar(pilares[0]) };
}

export { COBRIMENTO_SOLO };
