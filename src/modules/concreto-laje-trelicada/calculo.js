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
 * Laje treliçada (vigotas pré-moldadas com treliça + enchimento + capa)
 * NBR 6118:2023 (13.2.4.2, 14.6.2.2, 17.2, 19.4.1) e NBR 14859.
 *
 * Modelo: cada nervura é uma viga de seção T (mesa = capa) armada em uma
 * direção, com carga = carga por m² × intereixo. A armadura positiva é a do
 * banzo inferior da treliça (CA-60) mais barras adicionais na vigota.
 *
 * Bordas: x0 e x1 são as extremidades das vigotas (apoiada, engastada ou livre —
 * balanço engastado na outra ponta); y0 e y1 são as bordas laterais (apoiada ou livre).
 *
 * Sentido das vigotas: `direcao` 'x' (padrão) ou 'y' na planta. `L` é sempre o vão das
 * vigotas e `largura` a outra dimensão; as `bordas` gravadas são as da planta e são
 * convertidas para o referencial das vigotas por faixaNaPlanta() antes do cálculo.
 */

/** O elemento no referencial das vigotas (bordas x0/x1 = extremidades, y0/y1 = laterais). */
function naFaixa(el) {
  const f = faixaNaPlanta(el);
  return { ...el, bordas: f.local, vinculo: undefined, planta: f };
}
import { alfaFluencia } from '../../engine/fissuracao.js';
import { analisarFaixa, combinar, flechaFaixa } from '../comum/faixa.js';
import { bordasFaixa, apoiosFaixa, balancoFaixa, validarFaixa, fatorAFaixa, descreverFaixa, avisosLaterais, faixaNaPlanta } from '../comum/bordas.js';
import { dimensionarFlexao } from '../../engine/flexao.js';
import { verificarCortanteLaje, dimensionarEstribos } from '../../engine/cisalhamento.js';
import { areaBarra, escolherBarrasLaje, bitolaFixa, motivoBarraLaje, fmtPhi } from '../../engine/barras.js';
import { FCK_MIN } from '../../engine/materiais.js';
import { propriedadesT, larguraColaborante, dimensionarFlexaoT, inerciaBransonT, escolherBarrasNervura } from '../../engine/secao-t.js';

const f = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');
const r2 = (v) => Math.round(v * 100) / 100 || 0;

/**
 * Treliças eletrossoldadas usuais: TR + altura (cm) + ø banzo superior + ø diagonal + ø banzo inferior (mm).
 * O banzo inferior tem duas barras de aço CA-60.
 */
export const TRELICAS = [
  { nome: 'TR 8644', altura: 8, sup: 6, diag: 4.2, inf: 4.2 },
  { nome: 'TR 12645', altura: 12, sup: 6, diag: 4.2, inf: 5 },
  { nome: 'TR 16745', altura: 16, sup: 7, diag: 4.2, inf: 5 },
  { nome: 'TR 20745', altura: 20, sup: 7, diag: 4.2, inf: 5 },
  { nome: 'TR 25856', altura: 25, sup: 8, diag: 5, inf: 6 },
];

/** Peso específico aparente usual do enchimento (kN/m³) — editável no elemento. */
export const ENCHIMENTOS = {
  ceramico: { nome: 'Lajota cerâmica', peso: 6.5 },
  eps: { nome: 'EPS (isopor)', peso: 0.15 },
  concreto: { nome: 'Bloco de concreto', peso: 13 },
};

export function criarLajeTrelicada() {
  return {
    L: 3.5, largura: 3.5, direcao: 'x',   // L = vão das vigotas; direcao = sentido delas na planta ('x' ou 'y')
    bordas: { x0: 'apoiada', x1: 'apoiada', y0: 'apoiada', y1: 'apoiada' },
    he: 12, hf: 4, intereixo: 42, bw: 9,
    contraflecha: 0,
    enchimento: 'ceramico', pesoEnchimento: 6.5,
    trelica: 'auto',
    armadura: { adicional: 'auto', superior: 'auto' },
    pesoProprio: true,
    cargas: { uso: 'res-sala', revestimento: 1.0, acidental: 1.5, outras: 0 },
  };
}

/** Treliça adotada: a escolhida ou a mais alta que cabe na laje (altura ≤ h − 3 cm). */
export function trelicaAdotada(el) {
  if (el.trelica && el.trelica !== 'auto') return TRELICAS.find((t) => t.nome === el.trelica) ?? TRELICAS[0];
  const h = el.he + el.hf;
  return [...TRELICAS].reverse().find((t) => t.altura <= h - 3) ?? TRELICAS[0];
}

/** Cargas características por m² (kN/m²). */
export function cargasTrelicada(el, ctx) {
  const e = el.intereixo / 100, bw = el.bw / 100, he = el.he / 100, hf = el.hf / 100;
  const gama = ctx.materiais.gama;
  const capa = gama * hf;
  const nervura = (gama * bw * he) / e;
  const ench = (el.pesoEnchimento * (e - bw) * he) / e;
  const pp = el.pesoProprio ? capa + nervura + ench : 0;
  const g = pp + (el.cargas?.revestimento ?? 0) + (el.cargas?.outras ?? 0) + (el.cargas?.paredes ?? 0);
  const q = el.cargas?.acidental ?? 0;
  return { pp, capa, nervura, ench, g, q };
}

function analisar(el, ctx) {
  const { concreto: c } = ctx.materiais;
  const e = el.intereixo / 100;
  const { g, q } = cargasTrelicada(el, ctx);
  const h = el.he + el.hf;
  const bordas = bordasFaixa(el);
  const a = el.L * fatorAFaixa(bordas);
  const bf = larguraColaborante({ bw: el.bw, e: el.intereixo, a });
  const p = propriedadesT({ bf, bw: el.bw, hf: el.hf, h });
  const EI = c.Ecs * 1000 * p.I * 1e-8;
  const fx = analisarFaixa({ L: el.L, apoios: apoiosFaixa(bordas), wg: g * e, wq: q * e, EI });
  return { ...fx, bordas, g, q, e, h, bf, prop: p, EI };
}

/** Reações por metro de viga de apoio (kN/m). Ligações: apoio-a (x = 0) e apoio-b (x = L). */
export function cargasTransmitidas(el, ctx) {
  el = naFaixa(el);
  const { rG, rQ, e, apoios } = analisar(el, ctx);
  const out = {};
  const balanco = apoios.includes('livre');
  ['apoio-a', 'apoio-b'].forEach((id, k) => {
    if (apoios[k] === 'livre') return;
    out[id] = { g: rG.reacoes[k].V / e, q: rQ.reacoes[k].V / e };
    // balanço: o momento do engaste é torção de equilíbrio na viga de apoio (kN·m/m)
    if (balanco) out[id].t = { g: Math.abs(rG.reacoes[k].M) / e, q: Math.abs(rQ.reacoes[k].M) / e };
  });
  return out;
}

/** Ligações: as extremidades vinculadas (borda esquerda = apoio-a, direita = apoio-b). */
export function ligacoes(el) {
  const fx = naFaixa(el);
  const b = fx.bordas, nomes = fx.planta.rotulos;
  const l = [];
  if (b.x0 !== 'livre') l.push({ id: 'apoio-a', nome: nomes.x0, tipo: 'linear' });
  if (b.x1 !== 'livre') l.push({ id: 'apoio-b', nome: nomes.x1.replace('= L', `= ${f(el.L)} m`), tipo: 'linear' });
  return l;
}

export function calcularLajeTrelicada(el, ctx) {
  const { concreto: c, aco: s, gg, gq, psi2, caa, dmax } = ctx.materiais;
  if (!(el.L > 0)) throw new Error('Informe o vão da laje.');
  el = naFaixa(el);
  validarFaixa(el.bordas, el.planta.nomes);
  const cob = ctx.parametros.cobrimento.laje;
  const avisos = [], verificacoes = [], memorial = [];
  const A = analisar(el, ctx);
  const { rG, rQ, e, h, bf, prop } = A;
  const cg = cargasTrelicada(el, ctx);
  const tr = trelicaAdotada(el);

  const pts = combinar(rG, rQ, gg, gq);
  const MdPos = Math.max(0, ...pts.map((p) => p.M));
  const MdNeg = Math.min(0, ...pts.map((p) => p.M));
  const VdMax = Math.max(...pts.map((p) => Math.abs(p.V)));

  // ------------------------------------------------ flexão positiva (nervura T)
  const d = h - cob - 0.5;
  const pos = MdPos > 0.01 ? dimensionarFlexaoT({ Md: MdPos, bf, bw: el.bw, hf: el.hf, h, d, c, s }) : null;
  const AsTrel = 2 * areaBarra(tr.inf);
  const phiAd = bitolaFixa(el.armadura?.adicional), phiNeg = bitolaFixa(el.armadura?.superior);
  const AsTrelEq = AsTrel * (600 / s.fyk);      // banzo CA-60 expresso no aço do projeto
  let adicional = null, AsPosEf = AsTrelEq;
  if (pos) {
    const falta = pos.As - AsTrelEq;
    if (falta > 1e-6) {
      // a vigota comporta até 2 barras adicionais junto ao banzo inferior
      adicional = escolherBarrasNervura({ As: falta, bw: Math.max(el.bw, 12), cob: 1.5, dmax, bitolas: phiAd ? [phiAd] : [5, 6.3, 8, 10, 12.5], maxBarras: 2 });
      AsPosEf += adicional?.AsEf ?? 0;
      if (!adicional) avisos.push(phiAd
        ? `Com ø ${fmtPhi(phiAd)}, a armadura adicional precisaria de mais de 2 barras na vigota — escolha uma bitola maior, aumente a altura ou reduza o intereixo.`
        : 'A armadura positiva não cabe na vigota (treliça + 2 barras) — aumente a altura da laje ou reduza o intereixo.');
    }
  }

  // ------------------------------------------------ flexão negativa (capa tracionada, base da nervura comprimida)
  let neg = null;
  if (MdNeg < -0.01) {
    const fl = dimensionarFlexao({ Md: -MdNeg, b: Math.max(el.bw, 12), h, d: h - cob - 0.5, c, s });
    const porMetro = fl.As / e;
    neg = { ...fl, porMetro, barras: escolherBarrasLaje({ As: porMetro, h, principal: true, phi: phiNeg }) };
    if (!neg.barras && phiNeg) avisos.push(`Negativa na capa: ${motivoBarraLaje({ As: porMetro, h, phi: phiNeg }) ?? `ø ${fmtPhi(phiNeg)} não atende`} — escolha outra bitola.`);
    if (fl.dupla) avisos.push('Momento negativo exige armadura de compressão na nervura — aumente a altura.');
  }

  // ------------------------------------------------ cortante
  const cortanteComoLaje = el.intereixo <= 65;
  let cort;
  if (cortanteComoLaje) cort = verificarCortanteLaje({ Vd: VdMax, d, As1: AsPosEf, c, bw: el.bw });
  else {
    const est = dimensionarEstribos({ Vd: VdMax, bw: el.bw, d, c, s });
    cort = { Vd: VdMax, VRd1: est.VRd2, ok: est.ok, estribos: est };
    avisos.push('Intereixo acima de 65 cm: nervuras verificadas ao cortante como vigas (13.2.4.2).');
  }

  // ------------------------------------------------ flecha (ELS quase permanente)
  const ptsEls = combinar(rG, rQ, 1, psi2);
  const bordas = A.bordas;
  const balanco = balancoFaixa(bordas);
  const Ma = balanco ? Math.max(...ptsEls.map((p) => Math.abs(p.M))) : Math.max(0, ...ptsEls.map((p) => p.M));
  const AsI = balanco ? (neg?.As ?? AsPosEf) : AsPosEf;
  const br = inerciaBransonT({ bf, bw: el.bw, hf: el.hf, h, d, As: AsI, Ma, c, s });
  const f0 = flechaFaixa({ L: el.L, apoios: A.apoios, w: (cg.g + psi2 * cg.q) * e, EI: c.Ecs * 1000 * br.Ieq * 1e-8 });
  const ft = f0 * (1 + alfaFluencia(ctx.parametros.els?.t0 ?? 1).alfaF);
  const flim = ((balanco ? 2 : 1) * el.L * 1000) / 250;
  // contraflecha (13.3): compensa parte da flecha, limitada a L/350
  const cfMax = ((balanco ? 2 : 1) * el.L * 1000) / 350;
  const cf = Math.max(0, el.contraflecha ?? 0);
  const fFinal = ft - Math.min(cf, cfMax);

  // ------------------------------------------------ armadura de distribuição na capa
  const AsDist = 0.9; // cm²/m — mínimo usual para a capa
  const dist = escolherBarrasLaje({ As: AsDist, h: el.hf * 2, principal: false });

  // ------------------------------------------------ verificações
  const l0 = el.intereixo - el.bw;
  const hfMin = Math.max(4, l0 / 15);
  verificacoes.push({ nome: 'Espessura da capa', item: '13.2.4.2', valor: `hf = ${f(el.hf, 1)} cm`, limite: `≥ ${f(hfMin, 1)} cm`, ok: el.hf >= hfMin - 1e-9 });
  verificacoes.push({ nome: 'Largura da nervura', item: '13.2.4.2', valor: `bw = ${f(el.bw, 1)} cm`, limite: '≥ 5 cm', ok: el.bw >= 5 });
  verificacoes.push({ nome: `Concreto mínimo (CAA ${caa})`, item: '7.4.2', valor: `C${c.fck}`, limite: `≥ C${FCK_MIN[caa]}`, ok: c.fck >= FCK_MIN[caa] });
  if (pos) verificacoes.push({ nome: 'Flexão positiva da nervura', item: '17.2', valor: `Md = ${f(MdPos)} kN·m`, limite: `As = ${f(pos.As)} cm² · ef. ${f(AsPosEf)} cm²`, ok: pos.ok && AsPosEf >= pos.As - 1e-6 });
  if (neg) verificacoes.push({ nome: 'Flexão negativa (capa)', item: '17.2', valor: `Md = ${f(MdNeg)} kN·m`, limite: `As = ${f(neg.porMetro)} cm²/m`, ok: !neg.dupla && !!neg.barras });
  verificacoes.push(cortanteComoLaje
    ? { nome: 'Cortante na nervura (como laje)', item: '19.4.1', valor: `VSd = ${f(VdMax)} kN`, limite: `VRd1 = ${f(cort.VRd1)} kN`, ok: cort.ok }
    : { nome: 'Cortante na nervura (como viga)', item: '17.4.2.2', valor: `VSd = ${f(VdMax)} kN`, limite: `VRd2 = ${f(cort.VRd1)} kN`, ok: cort.ok });
  verificacoes.push({ nome: cf > 0 ? 'Flecha total menos contraflecha' : 'Flecha total', item: '13.3', valor: `${f(fFinal, 1)} mm`, limite: `${f(flim, 1)} mm`, ok: fFinal <= flim });
  if (cf > 0) verificacoes.push({ nome: 'Contraflecha', item: '13.3', valor: `${f(cf, 1)} mm`, limite: `≤ L/350 = ${f(cfMax, 1)} mm`, ok: cf <= cfMax + 1e-9 });
  if (fFinal > flim) avisos.push(`Flecha acima do limite: aumente a altura, adote contraflecha (até ${f(cfMax, 1)} mm) ou reduza o vão.`);
  if (!cort.ok && cortanteComoLaje) avisos.push('Cortante acima de VRd1 na nervura: aumente bw, a altura ou use faixa maciça junto ao apoio.');
  if (el.L > 4 && !balanco) avisos.push(el.L > 6
    ? 'Vão acima de 6 m: prever ao menos duas nervuras transversais de travamento.'
    : 'Vão acima de 4 m: prever uma nervura transversal de travamento.');
  if (balanco) {
    avisos.push('Laje em balanço: a armadura negativa da capa deve ser ancorada na laje ou na viga adjacente, e a nervura comprimida junto ao engaste costuma exigir faixa maciça.');
    if (neg?.dupla || (VdMax > 0 && !cort.ok)) avisos.push('Junto ao engaste do balanço, use uma faixa maciça (sem lajota) para absorver a compressão e o cortante.');
  }
  avisos.push(...avisosLaterais(bordas, 'a vigota de borda fica sem a laje vizinha — prever nervura de borda reforçada ou viga de bordo.', el.planta.nomesLaterais));
  if (tr.altura > h - 2) avisos.push(`A treliça ${tr.nome} (${tr.altura} cm) é alta demais para a laje de ${f(h, 0)} cm.`);

  // ------------------------------------------------ memorial
  memorial.push({ titulo: 'Geometria', linhas: [
    `Vigotas na direção ${el.planta.dir} · vão ${f(el.L)} m (${descreverFaixa(bordas, el.planta.nomes)}) · laterais ${bordas.y0} / ${bordas.y1} · planta ${f(el.planta.lx)} × ${f(el.planta.ly)} m · h = ${f(el.he, 0)} + ${f(el.hf, 0)} = ${f(h, 0)} cm · intereixo ${f(el.intereixo, 0)} cm · bw = ${f(el.bw, 1)} cm`,
    `Mesa colaborante bf = ${f(bf, 1)} cm · Ic(T) = ${f(prop.I, 0)} cm⁴ · yinf = ${f(prop.yBot, 2)} cm · treliça ${tr.nome}`,
  ] });
  memorial.push({ titulo: 'Cargas (kN/m²)', linhas: [
    `Capa ${f(cg.capa)} · nervuras ${f(cg.nervura)} · enchimento ${f(cg.ench)} → peso próprio ${f(cg.pp)}`,
    `g = ${f(cg.g)} · q = ${f(cg.q)} · por nervura: g = ${f(cg.g * e)} kN/m, q = ${f(cg.q * e)} kN/m`,
  ] });
  memorial.push({ titulo: 'Flexão (por nervura)', linhas: [
    pos && `Md+ = ${f(MdPos)} kN·m · d = ${f(d)} cm · x = ${f(pos.x)} cm ${pos.comoT ? '(seção T)' : '(LN na mesa)'} · As = ${f(pos.As)} cm² (mín. ${f(pos.AsMin)})`,
    `Treliça ${tr.nome}: banzo inferior 2 ø ${f(tr.inf, 1)} CA-60 = ${f(AsTrel)} cm² (equivale a ${f(AsTrelEq)} cm² de CA-${s.fyk / 10})${adicional ? ` + adicional ${adicional.rotulo} = ${f(adicional.AsEf)} cm²` : ''}`,
    neg && `Md− = ${f(MdNeg)} kN·m · As = ${f(neg.As)} cm²/nervura = ${f(neg.porMetro)} cm²/m → ${neg.barras?.rotulo ?? '—'}`,
  ].filter(Boolean) });
  memorial.push({ titulo: 'Cortante e flecha', linhas: [
    `VSd = ${f(VdMax)} kN · ${cortanteComoLaje ? `VRd1 = ${f(cort.VRd1)} kN (bw = ${f(el.bw, 1)} cm)` : `VRd2 = ${f(cort.VRd1)} kN`}`,
    `Mr = ${f(br.Mr)} kN·m · Ma = ${f(Ma)} kN·m · ${br.fissurada ? `Ieq = ${f(br.Ieq, 0)} cm⁴` : 'Estádio I'} · f0 = ${f(f0)} mm · f∞ = ${f(ft)} mm${cf > 0 ? ` − contraflecha ${f(Math.min(cf, cfMax))} mm = ${f(fFinal)} mm` : ''} ≤ ${f(flim)} mm`,
  ] });

  const reacoes = ['apoio-a', 'apoio-b'].map((id, k) => (A.apoios[k] === 'livre' ? null : {
    id, nome: k === 0 ? el.planta.rotulos.x0 : el.planta.rotulos.x1.replace('= L', `= ${f(el.L)} m`), tipo: bordas[k === 0 ? 'x0' : 'x1'],
    g: r2(rG.reacoes[k].V / e), q: r2(rQ.reacoes[k].V / e), d: r2((gg * rG.reacoes[k].V + gq * rQ.reacoes[k].V) / e),
  })).filter(Boolean);

  return {
    ok: verificacoes.every((v) => v.ok) && !avisos.some((a) => a.includes('aumente')),
    avisos, verificacoes, memorial,
    h, bf: r2(bf), balanco, bordas, direcao: el.planta.dir, cargas: { pp: r2(cg.pp), g: r2(cg.g), q: r2(cg.q) },
    MdPos: r2(MdPos), MdNeg: r2(MdNeg), VdMax: r2(VdMax),
    trelica: tr.nome, AsTrel: r2(AsTrel), AsPos: r2(pos?.As ?? 0), AsPosEf: r2(AsPosEf),
    adicional: adicional && { rotulo: adicional.rotulo, AsEf: r2(adicional.AsEf) },
    negativa: neg && { As: r2(neg.As), porMetro: r2(neg.porMetro), rotulo: neg.barras?.rotulo ?? '—' },
    distribuicao: dist?.rotulo ?? 'ø 5 c/ 20',
    cortante: { Vd: r2(VdMax), VR: r2(cort.VRd1), comoLaje: cortanteComoLaje },
    flecha: { f0: r2(f0), ft: r2(ft), final: r2(fFinal), contraflecha: r2(cf), lim: r2(flim), fissurada: br.fissurada },
    nervuras: Math.ceil((el.largura * 100) / el.intereixo),
    reacoes,
    diagrama: { x: pts.map((p) => r2(p.x)), Md: pts.map((p) => r2(p.M)) },
  };
}
