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
 * Entrepiso de madeira — sistema light wood frame (NBR 16936:2023),
 * dimensionado pela NBR 7190-1:2022.
 *
 * Vigotas (barrotes) igualmente espaçadas sob painel estrutural (OSB ou
 * compensado). Cada vigota é uma faixa em uma direção com carga = carga/m² ×
 * espaçamento. Verificações: flexão, cisalhamento, estabilidade lateral
 * (borda superior travada pelo painel), apoio, flecha final e frequência
 * natural (critério de conforto de referência).
 *
 * Bordas: x0 e x1 são as extremidades das vigotas (apoiada, engastada — vigota contínua
 * ou ligação rígida — ou livre, em balanço); y0 e y1 são as laterais (apoiada ou livre).
 */
import { analisarFaixa } from '../comum/faixa.js';
import { bordasFaixa, apoiosFaixa, balancoFaixa, validarFaixa, descreverFaixa, avisosLaterais } from '../comum/bordas.js';
import { flexaoMadeira, cisalhamentoMadeira, estabilidadeLateral, apoioMadeira, flechaFinal } from '../../engine/madeira.js';
import { materialDoElemento, materialInicial, memorialMaterial } from '../madeira-comum/material.js';

const f = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');
const r2 = (v) => Math.round(v * 100) / 100 || 0;

export const PAINEIS = {
  osb: { nome: 'OSB estrutural', peso: 6.5 },
  compensado: { nome: 'Compensado estrutural', peso: 5.5 },
};

export function criarEntrepiso(projeto) {
  return {
    ...materialInicial(projeto),
    L: 3.6, largura: 4,
    bordas: { x0: 'apoiada', x1: 'apoiada', y0: 'apoiada', y1: 'apoiada' },
    vigota: { b: 4.5, h: 23 }, espacamento: 40,
    painel: { tipo: 'osb', espessura: 18, peso: 6.5 },
    bloqueio: 1.2,          // m — espaçamento dos bloqueadores (travam a borda inferior)
    apoioC: 9,              // cm — apoio sobre a travessa
    pesoProprio: true,
    cargas: { uso: 'res-dormitorio', revestimento: 0.5, forro: 0.2, outras: 0.3, acidental: 1.5 },
  };
}

/** Cargas características por m². */
export function cargasEntrepiso(el, m) {
  const s = el.espacamento / 100;
  const painel = (el.painel.peso * el.painel.espessura) / 1000;
  const vigotas = (m.peso * el.vigota.b * el.vigota.h) / 1e4 / s;
  const pp = el.pesoProprio ? painel + vigotas : 0;
  const c = el.cargas ?? {};
  return { painel, vigotas, pp, g: pp + (c.revestimento ?? 0) + (c.forro ?? 0) + (c.outras ?? 0) + (c.paredes ?? 0), q: c.acidental ?? 0 };
}

function analisar(el, ctx) {
  const { m, p, psi2 } = materialDoElemento(el, ctx.parametros);
  const cg = cargasEntrepiso(el, m);
  const s = el.espacamento / 100;
  const I = (el.vigota.b * el.vigota.h ** 3) / 12;
  const EI = m.E0m * 1000 * I * 1e-8;
  const bordas = bordasFaixa(el);
  const fx = analisarFaixa({ L: el.L, apoios: apoiosFaixa(bordas), wg: cg.g * s, wq: cg.q * s, EI });
  return { m, p, psi2, cg, s, I, EI, bordas, ...fx };
}

/** Reações por metro de viga de apoio. */
export function cargasTransmitidas(el, ctx) {
  const { rG, rQ, s, apoios } = analisar(el, ctx);
  const out = {};
  const balanco = apoios.includes('livre');
  ['apoio-a', 'apoio-b'].forEach((id, k) => {
    if (apoios[k] === 'livre') return;
    out[id] = { g: rG.reacoes[k].V / s, q: rQ.reacoes[k].V / s };
    if (balanco) out[id].t = { g: Math.abs(rG.reacoes[k].M) / s, q: Math.abs(rQ.reacoes[k].M) / s }; // torção de equilíbrio
  });
  return out;
}

/** Ligações: as extremidades vinculadas (borda esquerda = apoio-a, direita = apoio-b). */
export function ligacoes(el) {
  const b = bordasFaixa(el);
  const l = [];
  if (b.x0 !== 'livre') l.push({ id: 'apoio-a', nome: 'Borda esquerda (x = 0)', tipo: 'linear' });
  if (b.x1 !== 'livre') l.push({ id: 'apoio-b', nome: `Borda direita (x = ${f(el.L)} m)`, tipo: 'linear' });
  return l;
}

export function calcularEntrepiso(el, ctx) {
  if (!(el.L > 0)) throw new Error('Informe o vão das vigotas.');
  validarFaixa(bordasFaixa(el));
  const A = analisar(el, ctx);
  const { m, p, psi2, cg, s, I, EI, rG, rQ, apoios, bordas } = A;
  const { b, h } = el.vigota;
  const avisos = [], verificacoes = [], memorial = [memorialMaterial(m, p)];

  const pts = rG.pontos.map((pt, i) => ({ M: p.gg * pt.M + p.gq * rQ.pontos[i].M, V: p.gg * pt.V + p.gq * rQ.pontos[i].V }));
  const MdPos = Math.max(0, ...pts.map((q) => q.M)), MdNeg = Math.min(0, ...pts.map((q) => q.M));
  const VdMax = Math.max(...pts.map((q) => Math.abs(q.V)));

  const flexP = flexaoMadeira({ Md: MdPos, b, h, m });
  const flexN = flexaoMadeira({ Md: MdNeg, b, h, m });
  const cis = cisalhamentoMadeira({ Vd: VdMax, b, h, m });
  // momento negativo comprime a borda inferior, travada apenas pelos bloqueadores
  const est = MdNeg < -1e-6 ? estabilidadeLateral({ L1: el.bloqueio * 100, b, h, sigma: flexN.sigma, m }) : null;

  verificacoes.push({ nome: 'Flexão da vigota', item: 'NBR 7190-1', valor: `${f(Math.max(flexP.sigma, flexN.sigma))} MPa`, limite: `${f(m.fmd)} MPa`, ok: flexP.ok && flexN.ok });
  verificacoes.push({ nome: 'Cisalhamento (τd = 1,5·Vd/A)', item: 'NBR 7190-1', valor: `${f(cis.tau)} MPa`, limite: `${f(m.fvd)} MPa`, ok: cis.ok });
  if (est) verificacoes.push(est.dispensada
    ? { nome: 'Estabilidade lateral (borda inferior)', item: 'NBR 7190-1', valor: `L1/b = ${f(est.esbeltez, 1)}`, limite: `≤ ${f(est.limite, 1)}`, ok: true }
    : { nome: 'Estabilidade lateral (borda inferior)', item: 'NBR 7190-1', valor: `${f(flexN.sigma)} MPa`, limite: `${f(est.sigmaLim)} MPa`, ok: est.ok });

  const reacoes = ['apoio-a', 'apoio-b'].map((id, k) => {
    if (apoios[k] === 'livre') return null;
    const Rd = p.gg * rG.reacoes[k].V + p.gq * rQ.reacoes[k].V;
    const ap = apoioMadeira({ Rd, b, c: el.apoioC, m });
    verificacoes.push({ nome: `Compressão normal na ${k === 0 ? 'borda esquerda' : 'borda direita'}`, item: 'NBR 7190-1', valor: `${f(ap.sigma)} MPa`, limite: `${f(m.fc90d)} MPa`, ok: ap.ok });
    return { id, nome: k === 0 ? 'Borda esquerda (x = 0)' : `Borda direita (x = ${f(el.L)} m)`, tipo: bordas[k === 0 ? 'x0' : 'x1'], g: r2(rG.reacoes[k].V / s), q: r2(rQ.reacoes[k].V / s), d: r2(Rd / s), porVigota: r2(Rd) };
  }).filter(Boolean);

  // ELS
  const balanco = balancoFaixa(bordas);
  const uG = Math.abs(rG.vaos[0].flecha) * 1000, uQ = Math.abs(rQ.vaos[0].flecha) * 1000;
  const ufin = flechaFinal({ uG, uQ, psi2, phi: m.phi });
  const lim = p.flecha ?? 200;
  const ulim = ((balanco ? 2 : 1) * el.L * 1000) / lim;
  verificacoes.push({ nome: 'Flecha final (fluência)', item: 'ELS', valor: `${f(ufin, 1)} mm`, limite: `${balanco ? '2L' : 'L'}/${lim} = ${f(ulim, 1)} mm`, ok: ufin <= ulim });

  // frequência natural da faixa biapoiada: f1 = π/(2L²)·√(EI/m), por metro de largura
  let f1 = null;
  if (bordas.x0 === 'apoiada' && bordas.x1 === 'apoiada') {
    const EIm = (m.E0m * 1e6 * I * 1e-8) / s;            // N·m²/m
    const massa = (cg.g * 1000) / 9.81;                     // kg/m²
    f1 = (Math.PI / (2 * el.L ** 2)) * Math.sqrt(EIm / massa);
    verificacoes.push({ nome: 'Frequência natural (conforto)', item: 'Referência EN 1995-1-1', valor: `${f(f1, 1)} Hz`, limite: '≥ 8 Hz', ok: f1 >= 8 });
  } else avisos.push('Frequência natural calculada apenas para vigotas biapoiadas.');

  if (el.espacamento > 60) avisos.push('Espaçamento acima de 60 cm: confira o painel e o projeto com a NBR 16936.');
  avisos.push('O painel de piso entra como carga; a verificação do próprio painel entre vigotas segue o fabricante.');
  if (balanco) avisos.push('Vigotas em balanço: o engaste exige vigota contínua sobre o apoio (com tramo de equilíbrio) ou ligação rígida; confira o arrancamento no apoio interno e trave a borda inferior junto ao engaste.');
  else if (bordas.x0 === 'engastada' || bordas.x1 === 'engastada') avisos.push('Engaste em madeira: só com vigota contínua sobre o apoio ou ligação rígida dimensionada.');
  avisos.push(...avisosLaterais(bordas, 'prever vigota de borda (dupla) ou viga de bordo para apoiar o painel.'));

  memorial.push({ titulo: 'Geometria e cargas', linhas: [
    `Vigotas ${f(b, 1)} × ${f(h, 1)} cm a cada ${f(el.espacamento, 0)} cm · vão ${f(el.L)} m (${descreverFaixa(bordas)}, laterais ${bordas.y0} / ${bordas.y1}) · ${Math.ceil((el.largura * 100) / el.espacamento) + 1} vigotas para ${f(el.largura)} m`,
    `Peso próprio: painel ${f(cg.painel)} + vigotas ${f(cg.vigotas)} = ${f(cg.pp)} kN/m² · g = ${f(cg.g)} · q = ${f(cg.q)} kN/m²`,
    `Por vigota: g = ${f(cg.g * s)} kN/m · q = ${f(cg.q * s)} kN/m · ELU ${f(p.gg)}·G + ${f(p.gq)}·Q`,
  ] });
  memorial.push({ titulo: 'Verificações da vigota', linhas: [
    `M+d = ${f(MdPos)} kN·m (σ = ${f(flexP.sigma)} MPa, borda superior travada pelo painel)${MdNeg < 0 ? ` · M−d = ${f(MdNeg)} kN·m (σ = ${f(flexN.sigma)} MPa)` : ''} · fm,d = ${f(m.fmd)} MPa`,
    `Vd = ${f(VdMax)} kN · τd = ${f(cis.tau)} MPa ≤ fv,d = ${f(m.fvd)} MPa`,
    `uG = ${f(uG)} mm · uQ = ${f(uQ)} mm · ufin = (uG + ψ2·uQ)(1 + φ) = ${f(ufin)} mm ≤ ${f(ulim)} mm`,
    f1 != null ? `f1 = π/(2L²)·√(EI/m) = ${f(f1, 1)} Hz (EI = ${f(EI, 0)} kN·m² por vigota, massa ${f((cg.g * 1000) / 9.81, 0)} kg/m²)` : null,
  ].filter(Boolean) });

  return {
    ok: verificacoes.every((v) => v.ok),
    avisos, verificacoes, memorial,
    classe: m.nome, bordas, balanco, cargas: { pp: r2(cg.pp), g: r2(cg.g), q: r2(cg.q) },
    MdPos: r2(MdPos), MdNeg: r2(MdNeg), VdMax: r2(VdMax),
    usoFlexao: Math.max(flexP.uso, flexN.uso), usoCis: cis.uso,
    flecha: { uG: r2(uG), uQ: r2(uQ), ufin: r2(ufin), lim: r2(ulim) },
    f1: f1 && r2(f1),
    vigotas: Math.ceil((el.largura * 100) / el.espacamento) + 1,
    reacoes,
  };
}
