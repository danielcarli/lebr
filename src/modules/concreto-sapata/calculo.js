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
 * Sapata isolada de concreto armado — cálculo (NBR 6122:2019 · NBR 6118:2023, 22.6).
 *
 * Geotecnia (valores característicos): carga do pilar + peso próprio da sapata + solo sobre ela; tensão
 * admissível informada ou estimada pelo SPT do furo mais próximo; tensões na base com os momentos.
 * Estrutura (valores de cálculo, γf da carga do pilar): flexão pelo CEB-70 nas duas direções, compressão
 * diagonal no contorno C (rígidas e flexíveis) e, nas flexíveis, punção em C' e cortante como laje.
 */
import { dimensionarFlexao } from '../../engine/flexao.js';
import { verificarCortanteLaje } from '../../engine/cisalhamento.js';
import { resistenciaConcreto, perimetro } from '../../engine/puncao.js';
import { areaBarra, fmtPhi } from '../../engine/barras.js';
import { analisarSondagem, nsptMedio, furoMaisProximo } from '../../engine/sondagem.js';
import {
  tensaoAdmissivelSPT, dimensoesBalancosIguais, tensoesNaBase, alturaRigida, sapataRigida, volumeSapata, momentoS1, ancoragemBasica, DIMENSAO_MINIMA,
} from '../../engine/sapata.js';
import { porticoDoPilar, porticoNosPilares } from '../comum/portico-edificio.js';
import { centroPilar } from '../../renderer/core/montagem.js';
import { COBRIMENTO_MM } from '../../engine/materiais.js';

const f = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');
const r2 = (v) => Math.round(v * 100) / 100 || 0;
const r1 = (v) => Math.round(v * 10) / 10 || 0;
const arred5 = (v) => Math.ceil((v - 1e-6) / 5) * 5;

/** Cobrimento nominal de elementos em contato com o solo (NBR 6118, Tabela 7.2), cm. */
export const COBRIMENTO_SOLO = Object.fromEntries(Object.entries(COBRIMENTO_MM.solo).map(([k, v]) => [k, v / 10]));

export function criarSapata(projeto) {
  return {
    pilarId: null,                         // pilar apoiado (ligação pilar → sapata)
    ap: 20, bp: 30,                        // cm — seção do pilar quando não há pilar ligado
    cargas: { g: 300, q: 80 },             // kN — quando não há pilar ligado
    momentos: { x: 0, y: 0 },              // kN·m característicos adicionais na base (Mx flete com A, My com B)
    profundidade: 1.5,                     // m — base da sapata abaixo do terreno (cota 0 do projeto)
    solo: { modo: 'informada', tensao: 200, sondagemId: null, gama: 18 },
    geometria: { modo: 'automatica', A: 180, B: 190, h: 50, h0: 25 },
    cobrimento: COBRIMENTO_SOLO[projeto?.parametros?.classeAgressividade ?? 'II'] ?? 3.0,
    armadura: { phiPilar: null },          // bitola do pilar para a ancoragem (null = a do pilar calculado, ou 12,5)
  };
}

/** Pilares cujo lance chega à fundação (sem pilar embaixo), com o centro em planta. */
export function pilaresDeFundacao(projeto, registro) {
  const pilar = (e) => e.modulo === 'concreto.pilar' && e.posicao;
  const pavs = [...(projeto.pavimentos ?? [])].sort((a, b) => a.cota - b.cota);
  const indice = (id) => pavs.findIndex((p) => p.id === id);
  const lista = [];
  for (const p of projeto.elementos.filter(pilar)) {
    const i = indice(p.posicao.pavimento);
    const c = centroPilar(p);
    const abaixo = i > 0 ? pavs[i - 1].id : null;
    const temEmbaixo = abaixo && projeto.elementos.some((q) => pilar(q) && q.posicao.pavimento === abaixo && Math.hypot(...centroPilar(q).map((v, k) => v - c[k])) < 0.05);
    if (!temEmbaixo) lista.push({ pilar: p, centro: c });
  }
  return lista;
}

/** Cargas, seção e posição do pilar ligado. */
export function dadosDoPilar(el, ctx) {
  const p = el.pilarId ? ctx.elemento(el.pilarId) : null;
  if (el.pilarId && !p) throw new Error('O pilar ligado a esta sapata não existe mais.');
  if (!p) return { pilar: null, ap: el.ap, bp: el.bp, g: el.cargas?.g ?? 0, q: el.cargas?.q ?? 0, Mx: 0, My: 0, origem: 'informada', centro: null, angulo: 0 };
  if (p.modulo !== 'concreto.pilar') throw new Error(`${p.codigo} não é um pilar de concreto.`);
  let g, q, Mx = 0, My = 0, origem = 'elementos';
  if (porticoNosPilares(ctx.projeto)) {
    const pt = porticoDoPilar(p, ctx);
    if (pt && !pt.erro && pt.lance?.fundacao) {
      const G = pt.lance.porCaso.G.base, Q = pt.lance.porCaso.Q.base;
      g = G.N; q = Q.N; Mx = G.Mx + Q.Mx; My = G.My + Q.My; origem = 'portico';
    }
  }
  if (origem === 'elementos') ({ g, q } = ctx.cargasDe(p.id, 'base'));
  return { pilar: p, ap: p.bx, bp: p.by, g, q, Mx, My, origem, centro: p.posicao ? centroPilar(p) : null, angulo: p.posicao?.angulo ?? 0 };
}

/** Escolhe bitola e espaçamento para a armadura As (cm²) distribuída numa largura (cm). */
export function escolherMalha({ As, largura, cob }) {
  const util = largura - 2 * cob;
  for (const phi of [10, 12.5, 16, 20, 25]) {
    const a = areaBarra(phi);
    const n = Math.max(2, Math.ceil(As / a - 1e-9));
    const s = util / (n - 1);
    if (s < 10) continue;               // espaçamento ≥ 10 cm (concretagem)
    const n2 = Math.max(n, Math.ceil(util / 20) + 1); // e ≤ 20 cm
    const s2 = util / (n2 - 1);
    return { phi, n: n2, s: Math.floor(s2 * 2) / 2, AsEf: n2 * a, rotulo: `${n2} ø ${fmtPhi(phi)} c/ ${f(Math.floor(s2 * 2) / 2, 1)}` };
  }
  return null;
}

/** Tensão admissível do solo (kPa) para a largura B (cm). */
function tensaoAdmissivel(el, ctx, B, dp) {
  const solo = el.solo ?? {};
  if (solo.modo !== 'spt') return { sigma: Number(solo.tensao) || 0, modo: 'informada', avisos: [] };
  const furos = ctx.projeto.elementos.filter((e) => e.modulo === 'geotecnia.sondagem');
  if (!furos.length) return { sigma: null, modo: 'spt', avisos: ['Não há furos de sondagem no projeto: cadastre um (Novo: Sondagem SPT) ou informe a tensão admissível.'] };
  let furo = solo.sondagemId ? furos.find((x) => x.id === solo.sondagemId) : null;
  let distancia = null;
  if (!furo) {
    const ponto = dp.centro ?? [el.local?.x ?? 0, el.local?.y ?? 0];
    const m = furoMaisProximo(furos, ponto[0], ponto[1]);
    furo = m?.furo ?? furos[0];
    distancia = m?.distancia ?? null;
  }
  const an = analisarSondagem(furo);
  const de = an.cotaBoca - (0 - el.profundidade);           // profundidade da base no furo (m)
  const ate = de + (2 * B) / 100;                           // bulbo: 2·B abaixo da base
  const N = nsptMedio(an, de - 0.5, ate);
  const t = tensaoAdmissivelSPT(N);
  const avisos = [...t.avisos];
  if (ate > an.limite + 0.01) avisos.push(`O bulbo da sapata (até ${f(ate)} m no furo ${furo.codigo}) passa do fim da sondagem (${f(an.limite)} m).`);
  const na = an.nivelAgua;
  if (!na.seco && na.inicial != null && na.inicial < ate) avisos.push(`Nível d'água a ${f(na.inicial)} m no furo ${furo.codigo}, dentro do bulbo da sapata: considere a redução da capacidade do solo submerso.`);
  return { sigma: t.sigma, modo: 'spt', N, Nusado: t.Nusado, furo: { id: furo.id, codigo: furo.codigo, distancia }, de, ate, avisos };
}

export function calcularSapata(el, ctx) {
  const { concreto: c, aco: s, gg, gq, gama } = ctx.materiais;
  const avisos = [], verificacoes = [], memorial = [];
  const dp = dadosDoPilar(el, ctx);
  const { ap, bp } = dp;
  const Mx = Math.abs(dp.Mx) + Math.abs(el.momentos?.x ?? 0), My = Math.abs(dp.My) + Math.abs(el.momentos?.y ?? 0);
  const Nk = dp.g + dp.q;
  if (!(Nk > 0)) throw new Error('A sapata não recebe carga: ligue um pilar ou informe g e q.');
  const D = Number(el.profundidade) || 0;
  const gs = Number(el.solo?.gama) || 18;
  const cob = Number(el.cobrimento) || 3;
  const pilarRes = dp.pilar?.resultado;
  const phiPilar = Number(el.armadura?.phiPilar) || pilarRes?.armadura?.phi || 12.5;
  const anc = ancoragemBasica({ phi: phiPilar, c, s });

  // ---------------------------------------------------------------- geometria
  const pesos = (g) => {
    const V = volumeSapata({ ...g, ap, bp });
    const PP = V * gama;
    // reaterro sobre a sapata: escavação A × B até a profundidade D, menos o concreto da sapata e o do pilar acima dela
    const terra = Math.max(0, (g.A * g.B) / 1e4 * D - V - (ap * bp) / 1e4 * Math.max(0, D - g.h / 100)) * gs;
    return { V, PP, terra };
  };
  let geo, sig = null;
  if (el.geometria?.modo === 'manual') {
    const g0 = el.geometria;
    geo = { A: g0.A, B: g0.B, h: g0.h, h0: Math.min(g0.h0 ?? g0.h, g0.h) };
    sig = tensaoAdmissivel(el, ctx, Math.min(geo.A, geo.B), dp);
  } else {
    // automática: área pela tensão admissível (que, pelo SPT, depende de B), balanços iguais, sapata rígida e
    // ancoragem das barras do pilar; com excentricidade, as duas dimensões crescem até a borda e o núcleo atenderem
    let A = Math.max(DIMENSAO_MINIMA, ap + 20), B = Math.max(DIMENSAO_MINIMA, bp + 20), extra = 0.05 * Nk, acresc = 0, antes = '';
    for (let it = 0; it < 80; it++) {
      sig = tensaoAdmissivel(el, ctx, Math.min(A, B), dp);
      if (!(sig.sigma > 0)) break;
      const req = dimensoesBalancosIguais({ area: (Nk + extra) / sig.sigma, ap, bp });
      A = req.A + acresc; B = req.B + acresc;
      const h = Math.max(30, arred5(alturaRigida({ A, B, ap, bp })), arred5(anc.lb + cob + 2));
      const h0 = Math.max(20, arred5(h / 3));
      geo = { A, B, h, h0 };
      const pz = pesos(geo);
      extra = pz.PP + pz.terra;
      const t = tensoesNaBase({ N: Nk + extra, A, B, Mx, My });
      const sig2 = tensaoAdmissivel(el, ctx, Math.min(A, B), dp);
      const chave = `${A}×${B}`;
      const atende = t.sMed <= sig2.sigma + 1e-6 && t.sMax <= 1.3 * sig2.sigma + 1e-6 && t.nucleo;
      if (atende && chave === antes) { sig = sig2; break; }
      if (t.sMed <= sig2.sigma + 1e-6 && !atende) acresc += 5;
      antes = chave;
      sig = sig2;
    }
  }
  avisos.push(...(sig?.avisos ?? []));
  if (!(sig?.sigma > 0)) throw new Error(sig?.avisos?.[0] ?? 'Informe a tensão admissível do solo.');
  if (!geo) throw new Error('Não foi possível dimensionar a sapata.');
  const { A, B, h, h0 } = geo;
  if (A < ap || B < bp) throw new Error('A sapata é menor que o pilar.');

  // ---------------------------------------------------------------- geotecnia (característico)
  const pz = pesos(geo);
  const Ntot = Nk + pz.PP + pz.terra;
  const t = tensoesNaBase({ N: Ntot, A, B, Mx, My });
  verificacoes.push(
    { nome: 'Tensão média no solo', item: 'NBR 6122', valor: `${f(t.sMed, 0)} kPa`, limite: `≤ σadm = ${f(sig.sigma, 0)} kPa`, ok: t.sMed <= sig.sigma + 1e-6 },
    { nome: 'Tensão máxima na borda', item: 'NBR 6122', valor: `${f(t.sMax, 0)} kPa`, limite: `≤ 1,3·σadm = ${f(1.3 * sig.sigma, 0)} kPa`, ok: t.sMax <= 1.3 * sig.sigma + 1e-6 },
    { nome: 'Base inteiramente comprimida (núcleo central)', item: 'NBR 6122', valor: `6ex/A + 6ey/B = ${f((6 * t.ex) / (A / 100) + (6 * t.ey) / (B / 100))}`, limite: '≤ 1', ok: t.nucleo },
    { nome: 'Menor dimensão em planta', item: 'NBR 6122', valor: `${f(Math.min(A, B), 0)} cm`, limite: `≥ ${DIMENSAO_MINIMA} cm`, ok: Math.min(A, B) >= DIMENSAO_MINIMA },
  );
  if (D < 1.5) avisos.push(`Base a ${f(D)} m do terreno: a NBR 6122 pede no mínimo 1,5 m junto às divisas — confira a profundidade.`);

  // ---------------------------------------------------------------- estrutura (cálculo)
  const rigida = sapataRigida({ A, B, ap, bp, h });
  const Nd = gg * dp.g + gq * dp.q;
  const fd = Nd / Nk;                                         // γf médio da carga do pilar
  const Mxd = fd * Mx, Myd = fd * My;
  const td = tensoesNaBase({ N: Nd, A, B, Mx: Mxd, My: Myd });
  const sigD = Math.max(td.sMed, td.sMax);                    // tensão de cálculo (a favor da segurança: a máxima, uniforme)
  const d = h - cob - 1;                                      // altura útil média (cm)
  const cx = (A - ap) / 2, cy = (B - bp) / 2;
  const flex = (largura, balanco, apDir) => {
    const M = momentoS1({ sigma: sigD, largura, balanco, ap: apDir });
    const r = dimensionarFlexao({ Md: M, b: largura, h, d, c, s });
    const malha = escolherMalha({ As: r.As, largura, cob });
    return { Md: M, As: r.As, AsCalc: r.AsCalc, AsMin: r.AsMin, ok: r.ok && !!malha, malha, avisos: r.avisos };
  };
  const fx = flex(B, cx, ap);    // barras paralelas a A, distribuídas na largura B
  const fy = flex(A, cy, bp);    // barras paralelas a B, distribuídas na largura A
  for (const [rot, fl] of [['A (x)', fx], ['B (y)', fy]]) {
    verificacoes.push({ nome: `Flexão na direção ${rot}`, item: '22.6.4.1', valor: fl.malha ? `${fl.malha.rotulo} = ${f(fl.malha.AsEf)} cm²` : '—', limite: `As ≥ ${f(fl.As)} cm²`, ok: fl.ok });
  }
  if ([cx, cy].some((cc) => cc > 2 * h)) avisos.push('Balanço maior que 2·h: o modelo do CEB-70 sai do intervalo usual — a sapata é muito flexível.');

  // compressão diagonal no contorno C (19.5.3.1 — rígidas e flexíveis)
  const u0 = 2 * (ap + bp);
  const FC = Nd - td.sMed * (ap * bp) / 1e4;
  const tauC = (FC / (u0 * d)) * 10;
  const tauRd2 = 0.27 * (1 - c.fck / 250) * c.fcd;
  verificacoes.push({ nome: 'Compressão diagonal no contorno C', item: '19.5.3.1', valor: `τSd = ${f(tauC)} MPa`, limite: `≤ τRd2 = ${f(tauRd2)} MPa`, ok: tauC <= tauRd2 + 1e-9 });

  let puncao = null, cortante = null;
  const rho = Math.sqrt((fx.malha?.AsEf ?? fx.As) / (B * d) * ((fy.malha?.AsEf ?? fy.As) / (A * d)));
  if (rigida) {
    verificacoes.push({ nome: 'Punção no contorno C′', item: '22.6.2.2', valor: 'sapata rígida', limite: 'dispensada', ok: true });
  } else {
    // punção em C' (a 2d da face), descontando a reação do solo dentro do contorno
    const p1 = perimetro({ c1: ap, c2: bp, d, r: 2 * d });
    const dentro = ap + 4 * d <= A && bp + 4 * d <= B;
    const areaC1 = (ap * bp + 2 * 2 * d * (ap + bp) + Math.PI * (2 * d) ** 2) / 1e4; // m²
    const F1 = Math.max(0, Nd - td.sMed * Math.min(areaC1, (A * B) / 1e4));
    const conc = resistenciaConcreto({ d, rho, fck: c.fck });
    const tau1 = (F1 / (p1.u * d)) * 10;
    puncao = { u: p1.u, F: F1, tauSd: tau1, tauRd1: conc.tauRd1, dentro, ok: !dentro || tau1 <= conc.tauRd1 + 1e-9 };
    verificacoes.push({ nome: 'Punção no contorno C′ (2d)', item: '19.5.3.2', valor: dentro ? `τSd = ${f(tau1)} MPa` : 'C′ fora da sapata', limite: dentro ? `≤ τRd1 = ${f(conc.tauRd1)} MPa` : 'dispensada', ok: puncao.ok });
    // cortante como laje (19.4.1) a d da face, em cada direção
    const corte = (largura, balanco, As) => {
      const Vd = sigD * (largura / 100) * Math.max(0, balanco - d) / 100;
      return verificarCortanteLaje({ Vd, d, As1: As, c, bw: largura });
    };
    cortante = { x: corte(B, cx, fx.malha?.AsEf ?? fx.As), y: corte(A, cy, fy.malha?.AsEf ?? fy.As) };
    for (const [rot, v] of [['A (x)', cortante.x], ['B (y)', cortante.y]]) {
      verificacoes.push({ nome: `Cortante sem armadura transversal — ${rot}`, item: '19.4.1', valor: `VSd = ${f(v.Vd, 1)} kN`, limite: `≤ VRd1 = ${f(v.VRd1, 1)} kN`, ok: v.ok });
    }
  }
  // ancoragem das barras do pilar na sapata (9.4.2.4)
  const hUtilAnc = h - cob - 2 * ((fx.malha?.phi ?? 12.5) / 10);
  verificacoes.push({ nome: `Ancoragem das barras do pilar (ø ${fmtPhi(phiPilar)})`, item: '9.4.2.4', valor: `h − c − 2ø = ${f(hUtilAnc, 1)} cm`, limite: `≥ lb = ${f(anc.lb, 1)} cm`, ok: hUtilAnc >= anc.lb - 1e-6 });
  if (h0 < Math.max(20, h / 3) - 1e-6) avisos.push(`Altura da borda h0 = ${f(h0, 0)} cm abaixo do usual (≥ h/3 e ≥ 20 cm).`);
  const incl = h > h0 ? Math.atan((h - h0) / Math.max(1, Math.min(cx, cy) - 2.5)) * (180 / Math.PI) : 0;
  if (incl > 33) avisos.push(`Inclinação das faces de ${f(incl, 0)}°: acima de cerca de 30° o concreto precisa de fôrma na face superior.`);

  // ---------------------------------------------------------------- memorial
  memorial.push(
    { titulo: 'Carga', linhas: [
      dp.pilar ? `Pilar ${dp.pilar.codigo} (${f(ap, 0)} × ${f(bp, 0)} cm): Nk = ${f(dp.g)} (g) + ${f(dp.q)} (q) kN — ${dp.origem === 'portico' ? 'reações do pórtico espacial na base do pilar' : 'cargas dos elementos'}.` : `Carga informada: Nk = ${f(dp.g)} (g) + ${f(dp.q)} (q) kN, pilar ${f(ap, 0)} × ${f(bp, 0)} cm.`,
      `Momentos característicos na base: Mx = ${f(Mx)} kN·m, My = ${f(My)} kN·m${dp.origem === 'portico' ? ' (G + Q do pórtico, mais os informados)' : ''}.`,
      `Peso próprio da sapata: ${f(pz.V, 3)} m³ × ${f(gama, 0)} kN/m³ = ${f(pz.PP)} kN; solo sobre a sapata (γ = ${f(gs, 0)} kN/m³): ${f(pz.terra)} kN. N total = ${f(Ntot)} kN.`,
    ] },
    { titulo: 'Tensão admissível', linhas: sig.modo === 'spt'
      ? [`Estimativa pelo SPT (Teixeira e Godoy): σadm = 20·N kPa, com N médio de ${f(sig.N, 1)} entre ${f(sig.de)} e ${f(sig.ate)} m no furo ${sig.furo?.codigo}${sig.furo?.distancia != null ? ` (a ${f(sig.furo.distancia)} m)` : ''} — bulbo de 2·B abaixo da base.${sig.Nusado !== sig.N ? ` N limitado a ${f(sig.Nusado, 0)}.` : ''}`, `σadm = ${f(sig.sigma, 0)} kPa.`]
      : [`Tensão admissível informada: σadm = ${f(sig.sigma, 0)} kPa.`] },
    { titulo: 'Dimensões', linhas: [
      `${el.geometria?.modo === 'manual' ? 'Informadas' : 'Automáticas (balanços iguais, sapata rígida e ancoragem do pilar)'}: A = ${f(A, 0)} cm, B = ${f(B, 0)} cm, h = ${f(h, 0)} cm, h0 = ${f(h0, 0)} cm; base a ${f(D)} m do terreno.`,
      `Rigidez (22.6.1): (A − ap)/3 = ${f(cx * 2 / 3, 1)} cm e (B − bp)/3 = ${f(cy * 2 / 3, 1)} cm → sapata ${rigida ? 'rígida' : 'flexível'}.`,
      `Tensões no solo: σméd = ${f(t.sMed, 0)} kPa, σmáx = ${f(t.sMax, 0)} kPa, σmín = ${f(t.sMin, 0)} kPa (ex = ${f(t.ex * 100, 1)} cm, ey = ${f(t.ey * 100, 1)} cm).`,
    ] },
    { titulo: 'Flexão (CEB-70, seção S1 a 0,15·ap da face)', linhas: [
      `Nd = ${f(Nd)} kN; σd = ${f(sigD, 0)} kPa (a maior tensão de cálculo, sem o peso próprio); d = h − c − 1 = ${f(d, 1)} cm.`,
      `Direção A: M1 = σd·B·(cA + 0,15·ap)²/2 = ${f(fx.Md)} kN·m → As = ${f(fx.As)} cm² (mín. ${f(fx.AsMin)}) → ${fx.malha?.rotulo ?? '—'}.`,
      `Direção B: M1 = σd·A·(cB + 0,15·bp)²/2 = ${f(fy.Md)} kN·m → As = ${f(fy.As)} cm² (mín. ${f(fy.AsMin)}) → ${fy.malha?.rotulo ?? '—'}.`,
    ] },
    { titulo: 'Cisalhamento e punção', linhas: [
      `Contorno C: u0 = ${f(u0, 0)} cm, FSd = ${f(FC)} kN, τSd = ${f(tauC)} MPa ≤ τRd2 = ${f(tauRd2)} MPa?`,
      rigida ? 'Sapata rígida: a punção fica dentro do cone de 45° e não precisa ser verificada (22.6.2.2).' : `Punção em C′: u = ${f(puncao.u, 0)} cm, FSd reduzida pela reação do solo = ${f(puncao.F)} kN, τSd = ${f(puncao.tauSd)} MPa, τRd1 = ${f(puncao.tauRd1)} MPa.`,
      `Ancoragem das barras do pilar: lb = (ø/4)·fyd/fbd = ${f(anc.lb, 1)} cm (fbd = ${f(anc.fbd)} MPa).`,
    ] },
  );

  return {
    ok: verificacoes.every((v) => v.ok),
    avisos, verificacoes, memorial,
    pilar: dp.pilar ? { id: dp.pilar.id, codigo: dp.pilar.codigo } : null, origem: dp.origem, ap, bp,
    Nk: { g: r2(dp.g), q: r2(dp.q) }, Mk: { x: r2(Mx), y: r2(My) }, Nd: r2(Nd), Ntot: r2(Ntot), PP: r2(pz.PP), terra: r2(pz.terra), volume: Math.round(pz.V * 1000) / 1000,
    sigmaAdm: r1(sig.sigma), tensao: { modo: sig.modo, N: sig.N != null ? r2(sig.N) : null, furo: sig.furo ?? null, de: sig.de, ate: sig.ate },
    A, B, h, h0, rigida, profundidade: D, cobrimento: cob, d: r2(d),
    tensoes: { med: r1(t.sMed), max: r1(t.sMax), min: r1(t.sMin), ex: r2(t.ex * 100), ey: r2(t.ey * 100), nucleo: t.nucleo },
    flexao: {
      x: { Md: r2(fx.Md), As: r2(fx.As), AsMin: r2(fx.AsMin), malha: fx.malha },
      y: { Md: r2(fy.Md), As: r2(fy.As), AsMin: r2(fy.AsMin), malha: fy.malha },
    },
    compressaoC: { tauSd: r2(tauC), tauRd2: r2(tauRd2) },
    puncao: puncao && { ...puncao, tauSd: r2(puncao.tauSd), tauRd1: r2(puncao.tauRd1), F: r2(puncao.F) },
    cortante: cortante && { x: { Vd: r2(cortante.x.Vd), VRd1: r2(cortante.x.VRd1) }, y: { Vd: r2(cortante.y.Vd), VRd1: r2(cortante.y.VRd1) } },
    ancoragem: { phi: phiPilar, lb: r1(anc.lb) },
  };
}
