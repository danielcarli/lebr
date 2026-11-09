/*
 * LEBR — Laboratório de Estruturas Brasil
 * Copyright (C) 2026 Daniel Michelon De Carli
 *
 * Feito com uso da inteligência artificial Claude Fable 5.1, sob a orientação de Daniel Michelon De Carli.
 *
 * Este programa é software livre: você pode redistribuí-lo e/ou modificá-lo nos termos da GNU Affero General
 * Public License, versão 3, publicada pela Free Software Foundation. É distribuído na esperança de ser útil, mas
 * SEM NENHUMA GARANTIA, nem mesmo a garantia implícita de COMERCIALIZAÇÃO ou de ADEQUAÇÃO A UMA FINALIDADE
 * ESPECÍFICA. Veja o arquivo LICENSE ou <https://www.gnu.org/licenses/agpl-3.0.html>.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * Fechamento do caminho das cargas num projeto inteiro: o peso total somado elemento a elemento, por fora do
 * encadeamento de reações (áreas das lajes × carga, peso próprio das vigas e pilares, paredes, telhado…), tem de
 * chegar à fundação pela cadeia laje → viga → pilar → fundação. Uma carga perdida ou contada duas vezes aparece aqui
 * mesmo que cada elemento, isolado, esteja certo.
 */
import { cargaParede } from '../engine/cargas.js';
import { dimensoesLaje } from '../renderer/core/montagem.js';
import { calcularElemento } from '../renderer/core/calculo.js';
import { secaoDoVao } from '../engine/viga-secoes.js';
import { MODULOS_CALCULO } from './calculos.js';

const ORDEM = { sondagens: -1, telhados: -0.5, lajes: 0, escadas: 0.5, reservatorios: 0.6, vigas: 1, pilares: 2, fundacoes: 3 };
const registro = { obter: (id) => MODULOS_CALCULO[id] };

/** Calcula todos os elementos na ordem das dependências. */
export function calcularProjeto(projeto) {
  const cat = (e) => MODULOS_CALCULO[e.modulo]?.categoria;
  for (const e of [...projeto.elementos].sort((a, b) => (ORDEM[cat(a)] ?? 5) - (ORDEM[cat(b)] ?? 5))) e.resultado = calcularElemento(e, projeto, registro);
  return projeto;
}

const lin = (c) => (c.tipo === 'distribuida' ? { g: c.natureza === 'q' ? 0 : c.valor, q: c.natureza === 'q' ? c.valor : 0 } : c.tipo === 'alvenaria' ? { g: cargaParede(c).g, q: 0 } : null);

/**
 * Peso característico (g, q em kN) que entra na estrutura, somado elemento a elemento, e o que chega às fundações.
 * @returns {{ entra: {g:number,q:number, partes:object}, fundacao: {g:number,q:number, n:number}, perdas: string[], desvio: number }}
 */
export function fechamentoDoCaminhoDasCargas(projeto) {
  const els = projeto.elementos;
  const mod = (e) => MODULOS_CALCULO[e.modulo];
  const entra = { g: 0, q: 0 }, partes = {};
  const soma = (chave, g, q) => { entra.g += g; entra.q += q; const p = (partes[chave] ??= { g: 0, q: 0 }); p.g += g; p.q += q; };
  const perdas = [];
  for (const e of els) {
    const r = e.resultado, cat = mod(e)?.categoria;
    if (!r || r.erro) { if (cat && cat !== 'sondagens') perdas.push(`${e.codigo}: ${r?.erro ?? 'sem resultado'}`); continue; }
    if (cat === 'lajes') {
      const { lx, ly } = dimensoesLaje(e), A = lx * ly;
      if (r.cargas?.g != null) soma('lajes', r.cargas.g * A, (r.cargas.q ?? 0) * A);
      // cantos/bordas livres: toda a carga vai às bordas presas, nada se perde
    } else if (cat === 'vigas') {
      // peso próprio vão a vão (cada vão com a sua seção)
      const pp = e.pesoProprio === false || e.modulo === 'madeira.viga' ? 0
        : (e.vaos ?? []).reduce((s, v, k) => { const sc = secaoDoVao(e, k); return s + (25 * sc.b * sc.h / 1e4) * (Number(v.L) || 0); }, 0);
      let g = pp, q = 0;
      for (const c of e.cargas ?? []) {
        const l = lin(c);
        if (l) {
          const vaos = c.vao === 'todos' || c.vao == null ? e.vaos : [e.vaos[Number(c.vao)]].filter(Boolean);
          const Lc = vaos.reduce((s, v) => s + (Number(v.L) || 0), 0);
          g += l.g * Lc; q += l.q * Lc;
        } else if (c.tipo === 'concentrada') { if (c.natureza === 'q') q += c.valor; else g += c.valor; }
      }
      soma(e.modulo === 'madeira.viga' ? 'madeira' : 'vigas', g, q);
      // o que a viga recebe de elementos sem posição na montagem (cargas "elemento" de módulos que não entram
      // na soma independente) conta pelos próprios módulos abaixo
    } else if (cat === 'pilares') {
      if (e.modulo === 'madeira.pilar') continue;
      const L = e.comprimento ?? 3;
      const A = e.forma === 'circular' ? (Math.PI * (e.D ?? 0) ** 2) / 4 : (e.bx ?? 0) * (e.by ?? 0);
      let g = e.pesoProprio === false ? 0 : (25 * A * L) / 1e4, q = 0;
      for (const c of e.cargas ?? []) if (c.tipo === 'concentrada') { if (c.natureza === 'q') q += c.valor; else g += c.valor; }
      soma('pilares', g, q);
    } else if (cat === 'escadas') {
      // reações nas vigas (o que a escada entrega) e o que vai para alvenaria/terreno (perda declarada pelo módulo)
      let g = 0, q = 0;
      const Lap = Number(e.largura) || 1;                                       // reações por metro de largura
      for (const t of r.tramos ?? []) for (const a of t.apoios ?? []) { if (a.vigas?.length) { g += a.g * Lap; q += a.q * Lap; } else perdas.push(`${e.codigo}: ${a.nome ?? a.id} sem viga (${((a.g + a.q) * Lap).toFixed(1)} kN vão para alvenaria ou terreno)`); }
      soma('escadas', g, q);
    } else if (cat === 'reservatorios') {
      // pesos do próprio módulo (água, paredes, fundo e tampa): independentes das reações nas vigas
      if (r.pesos) soma('reservatórios', r.pesos.G, r.pesos.Q);
    } else if (cat === 'telhados') {
      if (e.modulo === 'madeira.telhado' && r.reacoes) {
        const lig = projeto.elementos.some((v) => (v.cargas ?? []).some((c) => c.tipo === 'elemento' && c.elementoId === e.id));
        if (lig) soma('telhado', r.reacoes.Gtot, r.reacoes.Qtot); else perdas.push(`${e.codigo}: telhado sem ligação às vigas`);
      }
    }
  }
  // fundações: o que chega (Nk dos pilares nas sapatas, blocos e radier; estacas isoladas contam pelo bloco)
  const fundacao = { g: 0, q: 0, n: 0 };
  for (const e of els) {
    const r = e.resultado;
    if (!r || r.erro) continue;
    if (e.modulo === 'concreto.sapata' || e.modulo === 'concreto.bloco') { fundacao.g += r.Nk?.g ?? 0; fundacao.q += r.Nk?.q ?? 0; fundacao.n++; }
    if (e.modulo === 'concreto.radier') { for (const p of r.pilares ?? []) { fundacao.g += p.g ?? p.Nk; fundacao.q += p.q ?? 0; } fundacao.n++; }
    if (e.modulo === 'concreto.sapataCorrida' && r.viga) { fundacao.g += r.nk.g * r.L; fundacao.q += r.nk.q * r.L; fundacao.n++; }
  }
  // pilares cujo lance mais baixo não tem fundação no projeto: contam como "chegam ao terreno" pela base
  const temFund = (id) => els.some((f) => (f.pilarId === id) || (f.modulo === 'concreto.radier' && (f.resultado?.pilares ?? []).some((p) => p.id === id)));
  const pilaresBase = els.filter((e) => e.modulo === 'concreto.pilar' && e.posicao && !els.some((o) => o.modulo === 'concreto.pilar' && o !== e && (o.cargas ?? []).some((c) => c.tipo === 'elemento' && c.elementoId === e.id && c.ligacao === 'base')));
  const semFund = pilaresBase.filter((e) => !temFund(e.id));
  for (const e of semFund) if (e.resultado?.Nk) { fundacao.g += e.resultado.Nk.g; fundacao.q += e.resultado.Nk.q; }
  const total = entra.g + entra.q, chega = fundacao.g + fundacao.q;
  return { entra: { ...entra, partes }, fundacao, semFundacao: semFund.map((e) => e.codigo), perdas, desvio: total > 0 ? (chega - total) / total : 0 };
}
