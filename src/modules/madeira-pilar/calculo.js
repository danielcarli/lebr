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
 * Pilar ou montante de madeira de seção retangular — NBR 7190-1:2022
 * (montantes de parede light wood frame: NBR 16936:2023, com o eixo fraco
 * travado pelo painel de fechamento).
 *
 * Compressão com estabilidade pelo método da esbeltez relativa (λrel, kc, βc)
 * e flexocompressão com kM = 0,7. Limite L0 ≤ 40 vezes a dimensão da seção.
 */
import { compressaoMadeira } from '../../engine/madeira.js';
import { materialDoElemento, materialInicial, memorialMaterial } from '../madeira-comum/material.js';

const f = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');
const r2 = (v) => Math.round(v * 100) / 100 || 0;

export function criarPilarMadeira(projeto) {
  return {
    ...materialInicial(projeto),
    b: 12, h: 12, comprimento: 2.8,
    KEx: 1.0, KEy: 1.0,
    montante: false, travamentoY: 0.6,      // m — espaçamento das fixações do painel (montantes)
    pesoProprio: true,
    momentos: { x: 0, y: 0 },               // característicos permanentes (kN·m)
    cargas: [{ id: 'c1', tipo: 'concentrada', natureza: 'g', valor: 20, descricao: 'Cobertura' }],
  };
}

export function normalCaracteristica(el, ctx, m) {
  let g = 0, q = 0;
  const origem = [];
  if (el.pesoProprio) {
    const pp = (m.peso * el.b * el.h * el.comprimento) / 1e4;
    g += pp; origem.push({ texto: 'Peso próprio', g: pp, q: 0 });
  }
  for (const c of el.cargas ?? []) {
    if (c.tipo === 'concentrada') {
      if (c.natureza === 'q') q += c.valor; else g += c.valor;
      origem.push({ texto: c.descricao || 'Concentrada', g: c.natureza === 'q' ? 0 : c.valor, q: c.natureza === 'q' ? c.valor : 0 });
    } else if (c.tipo === 'elemento') {
      const r = ctx.cargasDe(c.elementoId, c.ligacao);
      g += r.g; q += r.q;
      origem.push({ texto: `Reação de ${ctx.elemento(c.elementoId)?.codigo ?? '?'} (${c.ligacao})`, g: r.g, q: r.q });
    }
  }
  return { g, q, origem };
}

export function cargasTransmitidas(el, ctx) {
  const { m } = materialDoElemento(el, ctx.parametros);
  const { g, q } = normalCaracteristica(el, ctx, m);
  return { base: { g, q } };
}

export const ligacoes = () => [{ id: 'base', nome: 'Base do pilar', tipo: 'pontual' }];

export function calcularPilarMadeira(el, ctx) {
  const { m, p } = materialDoElemento(el, ctx.parametros);
  const { b, h } = el;
  if (!(b > 0 && h > 0 && el.comprimento > 0)) throw new Error('Informe a seção e o comprimento do pilar.');
  const { g, q, origem } = normalCaracteristica(el, ctx, m);
  if (!(g + q > 0)) throw new Error('O pilar não tem carga normal — adicione cargas ou reações de vigas.');
  const avisos = [], verificacoes = [], memorial = [memorialMaterial(m, p)];

  const Nd = p.gg * g + p.gq * q;
  const Mxd = p.gg * (el.momentos?.x ?? 0), Myd = p.gg * (el.momentos?.y ?? 0);
  const L = el.comprimento * 100;
  const L0x = el.KEx * L;
  const L0y = el.montante ? Math.min(el.travamentoY * 100, el.KEy * L) : el.KEy * L;
  const r = compressaoMadeira({ Nd, Mxd, Myd, b, h, L0x, L0y, m });

  verificacoes.push({ nome: 'Esbeltez — eixo x (L0 ≤ 40·h)', item: 'NBR 7190-1', valor: `L0/h = ${f(r.limiteEsbeltez.x, 1)}`, limite: '≤ 40', ok: r.limiteEsbeltez.x <= 40 + 1e-9 });
  verificacoes.push({ nome: 'Esbeltez — eixo y (L0 ≤ 40·b)', item: 'NBR 7190-1', valor: `L0/b = ${f(r.limiteEsbeltez.y, 1)}`, limite: '≤ 40', ok: r.limiteEsbeltez.y <= 40 + 1e-9 });
  verificacoes.push({ nome: r.semInstab ? 'Compressão / flexocompressão — x' : 'Estabilidade — eixo x', item: 'NBR 7190-1', valor: f(r.interacaoX, 3), limite: '≤ 1', ok: r.interacaoX <= 1 + 1e-9 });
  verificacoes.push({ nome: r.semInstab ? 'Compressão / flexocompressão — y' : 'Estabilidade — eixo y', item: 'NBR 7190-1', valor: f(r.interacaoY, 3), limite: '≤ 1', ok: r.interacaoY <= 1 + 1e-9 });
  if (Math.min(b, h) < 5) avisos.push('Dimensão abaixo de 5 cm: confira as dimensões mínimas da NBR 7190-1 para peças principais.');
  if (el.montante) avisos.push(`Montante: eixo fraco travado pelo painel a cada ${f(el.travamentoY)} m (NBR 16936). As fixações devem garantir esse travamento.`);

  memorial.push({ titulo: 'Cargas', linhas: [
    ...origem.map((o) => `${o.texto}: g = ${f(o.g)} kN · q = ${f(o.q)} kN`),
    `Nd = ${f(p.gg)}·g + ${f(p.gq)}·q = ${f(Nd)} kN · Mx,d = ${f(Mxd)} kN·m · My,d = ${f(Myd)} kN·m`,
  ] });
  memorial.push({ titulo: 'Estabilidade (esbeltez relativa)', linhas: [
    `Eixo x: L0 = ${f(L0x / 100)} m · λx = ${f(r.lambdaX, 1)} · λrel,x = ${f(r.relX, 3)} · kc,x = ${f(r.kcx, 3)}`,
    `Eixo y: L0 = ${f(L0y / 100)} m · λy = ${f(r.lambdaY, 1)} · λrel,y = ${f(r.relY, 3)} · kc,y = ${f(r.kcy, 3)} (βc = ${f(m.betaC, 1)})`,
    `σNc,d = ${f(r.sigmaN)} MPa · σMx,d = ${f(r.sigmaMx)} MPa · σMy,d = ${f(r.sigmaMy)} MPa · fc0,d = ${f(m.fc0d)} MPa · fm,d = ${f(m.fmd)} MPa`,
    r.semInstab
      ? `λrel < 0,3: (σN/fc0,d)² + σMx/fm,d + kM·σMy/fm,d = ${f(r.interacaoX, 3)} e ${f(r.interacaoY, 3)}`
      : `σN/(kc·fc0,d) + σMx/fm,d + kM·σMy/fm,d = ${f(r.interacaoX, 3)} (x) e ${f(r.interacaoY, 3)} (y), kM = ${f(m.kM, 1)}`,
  ] });

  const Nrd = Math.min(r.kcx, r.kcy) * m.fc0d * b * h / 10; // kN, compressão centrada
  return {
    ok: verificacoes.every((v) => v.ok),
    avisos, verificacoes, memorial,
    classe: m.nome, Nk: { g: r2(g), q: r2(q) }, Nd: r2(Nd), NRd: r2(Nrd),
    lambdaX: r2(r.lambdaX), lambdaY: r2(r.lambdaY), relX: r.relX, relY: r.relY, kcx: r.kcx, kcy: r.kcy,
    interacao: Math.max(r.interacaoX, r.interacaoY),
  };
}
