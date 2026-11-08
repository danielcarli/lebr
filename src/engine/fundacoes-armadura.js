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
 * Ferragem das fundações: armadura das estacas moldadas in loco (NBR 6122, 8.6.3 e Tabela 4, com a NBR 6118 para o
 * dimensionamento e o detalhamento) e as listas de ferros das sapatas (NBR 6118, 22.6.4) e dos blocos sobre estacas
 * (22.7.4).
 *
 * Unidades: diâmetros e dimensões em cm, comprimentos de estaca em m, forças em kN, tensões em MPa.
 */
import { geometriaEstaca } from './estacas.js';
import { ancoragemBasica, fbd } from './detalhamento.js';
import { areaBarra } from './barras.js';

const arred5 = (v) => Math.ceil((v - 1e-6) / 5) * 5;
const fx = (x, c = 1) => (Number.isFinite(x) ? x.toFixed(c).replace('.', ',') : '—');
const phiTxt = (phi) => String(phi).replace('.', ',');

/* ======================================================================== estacas (NBR 6122:2019) */

/**
 * Tabela 4 da NBR 6122:2019 (estacas moldadas in loco), por tipo e classe de agressividade:
 * classe do concreto, γc, armadura mínima (% de Ac) e comprimento útil mínimo armado (incluindo a ligação com o
 * bloco) e a tensão de compressão simples atuante abaixo da qual não é preciso armar (exceto a ligação com o bloco).
 * Os valores seguem o texto do projeto de revisão de 2018 (consulta nacional) que deu origem à edição de 2019.
 * A broca (trado manual) entra como escavada sem fluido.
 */
export const TABELA4_ESTACAS = {
  helice: { nome: 'Hélice contínua', classes: { baixa: { fck: 30, gc: 2.7 }, alta: { fck: 40, gc: 3.6 } }, rhoMin: 0.004, Lmin: 4.0, sigmaLim: 6.0 },
  escavada: { nome: 'Escavada sem fluido', classes: { baixa: { fck: 25, gc: 3.1 }, alta: { fck: 40, gc: 5.0 } }, rhoMin: 0.004, Lmin: 2.0, sigmaLim: 5.0 },
  broca: { nome: 'Escavada sem fluido (broca)', classes: { baixa: { fck: 25, gc: 3.1 }, alta: { fck: 40, gc: 5.0 } }, rhoMin: 0.004, Lmin: 2.0, sigmaLim: 5.0 },
};
export const GAMA_F_ESTACA = 1.4;
export const FS_ATRITO = 2.0; // fator global da carga admissível: o atrito mobilizado sob a carga de trabalho

/** Parâmetros da Tabela 4 para o tipo e a classe de agressividade (I e II → baixa; III e IV → alta). */
export function parametrosTabela4(tipo, caa = 'II', { fck = null, gc = null } = {}) {
  const t = TABELA4_ESTACAS[tipo];
  if (!t) return null;
  const cl = ['III', 'IV'].includes(caa) ? t.classes.alta : t.classes.baixa;
  return { ...t, fck: Number(fck) || cl.fck, gc: Number(gc) || cl.gc, fckTabela: cl.fck, gcTabela: cl.gc };
}

/** Barras longitudinais da gaiola: ø ≥ 10 mm, no mínimo 6 barras (seção circular, NBR 6118 18.4.2.1 e 18.4.2.2). */
function barrasDaGaiola(As, D, cob, phiT, dmax) {
  const opcoes = [];
  for (const phi of [10, 12.5, 16, 20, 25]) {
    const n = Math.max(6, Math.ceil(As / areaBarra(phi) - 1e-9));
    const raio = D / 2 - cob - phiT / 10 - phi / 20;            // eixo das barras (cm)
    const s = (2 * Math.PI * raio) / n;                          // entre eixos
    const livre = s - phi / 10;
    const aMin = Math.max(2, phi / 10, (1.2 * dmax) / 10);
    if (livre < aMin) continue;
    opcoes.push({ phi, n, AsEf: n * areaBarra(phi), s, livre, sMaxOk: s <= 40 });
  }
  if (!opcoes.length) return null;
  return opcoes.reduce((m, o) => (o.AsEf < m.AsEf - 1e-9 ? o : m));
}

/**
 * Armadura de uma estaca moldada in loco comprimida (NBR 6122:2019, 8.6.3):
 *  - σ = Nk/Ac ≤ tensão-limite da Tabela 4: só a armadura de ligação com o bloco, ρmín no comprimento útil mínimo;
 *  - acima: dimensionada pela NBR 6118 sem excentricidade — Nd = 1,4·Nk ≤ 0,85·fcd·Ac + As·σs (σs para εc = 2 ‰),
 *    com fcd = fck/γc da Tabela 4 —, armada até a profundidade em que a tensão, descontado o atrito lateral
 *    mobilizado, volta ao limite.
 * @param p { tipo, D (cm), secao, L (m), Nk (kN), caa, fck?, gc?, aco: { fyd, Es, fyk (MPa) }, fctd (MPa),
 *            cob (cm), dmax (mm), atrito?: [{ de, ate, R (kN de atrito último no trecho) }] (de/ate a partir do topo) }
 */
export function armaduraEstaca(p) {
  const { tipo, D, secao = 'circular', L, Nk, caa = 'II', aco, fctd, cob = 5, dmax = 19, atrito = null } = p;
  const avisos = [], verificacoes = [], memorial = [];
  if (tipo === 'premoldada') {
    return { aplicavel: false, avisos: ['Estaca pré-moldada: a armadura é a do fabricante (catálogo); no bloco, só a ligação especificada em projeto.'], verificacoes, memorial, posicoes: [] };
  }
  const t = parametrosTabela4(tipo, caa, { fck: p.fck, gc: p.gc });
  if (!t) throw new Error(`Tipo de estaca sem parâmetros da Tabela 4: ${tipo}.`);
  const g = geometriaEstaca({ secao, D });
  const Ac = g.Ap * 1e4;                                       // cm²
  const sigma = Nk / (g.Ap * 1000);                            // MPa
  const fcd = t.fck / t.gc;                                    // MPa
  const Nd = GAMA_F_ESTACA * Nk;
  const NRdc = 0.85 * (fcd / 10) * Ac;                         // kN
  const sigmaS = Math.min(aco.fyd, aco.Es * 0.002) / 10;       // kN/cm² (CA-50: 42)
  const AsMin = t.rhoMin * Ac;
  const precisa = sigma > t.sigmaLim + 1e-9;
  const AsNec = precisa ? Math.max(0, (Nd - NRdc) / sigmaS) : 0;
  const As = Math.max(AsMin, AsNec);
  const AsMax = 0.04 * Ac;
  if (As > AsMax) { avisos.push('A armadura passa de 4 % da seção da estaca: aumente o diâmetro ou reduza a carga.'); }

  // comprimento armado: o mínimo da tabela; se σ passa do limite, até a tensão voltar ao limite
  let Larm = Math.min(L, t.Lmin), zLim = null;
  if (precisa) {
    zLim = L;
    if (atrito?.length) {
      let N = Nk, z = 0;
      const alvo = t.sigmaLim * g.Ap * 1000;                   // kN
      for (const tr of atrito) {
        const dl = tr.ate - tr.de;
        const porM = tr.R / dl / FS_ATRITO;
        if (N - porM * dl <= alvo) { z = tr.de + (N - alvo) / porM; N = alvo; break; }
        N -= porM * dl; z = tr.ate;
      }
      zLim = N <= alvo + 1e-6 ? Math.min(L, z) : L;
    }
    Larm = Math.min(L, Math.max(t.Lmin, Math.ceil(zLim * 2 - 1e-9) / 2));
    if (!atrito?.length) avisos.push('Sem o perfil de atrito lateral, a estaca foi armada em todo o comprimento.');
  }
  // gaiola
  const phiT0 = 6.3;
  const barras = barrasDaGaiola(As, D, cob, phiT0, dmax);
  if (!barras) avisos.push('As barras da gaiola não cabem no perímetro da estaca: aumente o diâmetro.');
  const phiL = barras?.phi ?? 10;
  const phiT = Math.max(5, phiL / 4) <= 6.3 ? 6.3 : 8;        // 18.4.3: ø ≥ 5 mm e ≥ øl/4
  const sEst = Math.floor(Math.min(20, D, (12 * phiL) / 10) * 2) / 2; // 18.4.3: ≤ 20 cm, ≤ menor dimensão, ≤ 12·øl (CA-50)
  const lb = ancoragemBasica({ phi: phiL, fyd: aco.fyd, fbd: fbd({ fctd, boa: true, phi: phiL }) });
  const espera = Math.max(lb, 30);                              // ligação com o bloco: ancoragem reta no bloco

  verificacoes.push({ nome: 'Tensão na estaca', item: 'NBR 6122, Tabela 4', valor: `σ = Nk/Ac = ${fx(sigma, 2)} MPa`, limite: `${precisa ? '>' : '≤'} ${fx(t.sigmaLim, 1)} MPa: ${precisa ? 'armar' : 'só a ligação com o bloco'}`, ok: true });
  if (precisa) verificacoes.push({ nome: 'Compressão da estaca armada', item: 'NBR 6122, 8.6.3', valor: `Nd = ${fx(Nd, 1)} kN`, limite: `≤ 0,85·fcd·Ac + As·σs = ${fx(NRdc + (barras?.AsEf ?? As) * sigmaS, 1)} kN`, ok: Nd <= NRdc + (barras?.AsEf ?? As) * sigmaS + 1e-6 && As <= AsMax });
  verificacoes.push({ nome: 'Armadura mínima da estaca', item: 'NBR 6122, Tabela 4', valor: barras ? `${barras.n} ø ${phiTxt(barras.phi)} = ${fx(barras.AsEf, 2)} cm²` : '—', limite: `≥ ${fx(t.rhoMin * 100, 1)} %·Ac = ${fx(AsMin, 2)} cm²${AsNec > AsMin ? ` · As,nec = ${fx(AsNec, 2)} cm²` : ''}`, ok: !!barras && barras.AsEf >= As - 1e-9 });

  memorial.push(
    `${t.nome}, ø ${fx(D, 0)} cm, Ac = ${fx(Ac, 0)} cm² · CAA ${caa}: concreto C${t.fck}, γc = ${fx(t.gc, 1)} (Tabela 4${p.fck || p.gc ? ', valores informados' : ''}) → fcd = fck/γc = ${fx(fcd, 2)} MPa.`,
    `Carga de trabalho Nk = ${fx(Nk, 1)} kN → σ = Nk/Ac = ${fx(sigma, 2)} MPa ${precisa ? '>' : '≤'} ${fx(t.sigmaLim, 1)} MPa (tensão abaixo da qual não é preciso armar, exceto a ligação com o bloco).`,
    precisa
      ? `Estaca armada (NBR 6118, sem excentricidade): Nd = 1,4·Nk = ${fx(Nd, 1)} kN; 0,85·fcd·Ac = ${fx(NRdc, 1)} kN; σs (εc = 2 ‰) = ${fx(sigmaS * 10, 0)} MPa → As,nec = (Nd − 0,85·fcd·Ac)/σs = ${fx(AsNec, 2)} cm²; mínimo ${fx(t.rhoMin * 100, 1)} % = ${fx(AsMin, 2)} cm².`
      : `Só a armadura de ligação com o bloco: ${fx(t.rhoMin * 100, 1)} %·Ac = ${fx(AsMin, 2)} cm² no comprimento útil mínimo de ${fx(t.Lmin, 1)} m.`,
    precisa
      ? `Comprimento armado: ${atrito?.length ? `a carga cai com o atrito lateral mobilizado (atrito último/${fx(FS_ATRITO, 1)}) até σ = ${fx(t.sigmaLim, 1)} MPa a ${fx(zLim, 2)} m do topo` : 'todo o comprimento'} → ${fx(Larm, 1)} m (mínimo ${fx(t.Lmin, 1)} m).`
      : `Comprimento armado: ${fx(Larm, 1)} m abaixo da cota de arrasamento.`,
    barras ? `Gaiola: ${barras.n} ø ${phiTxt(barras.phi)} (${fx(barras.AsEf, 2)} cm², espaçamento ${fx(barras.s, 1)} cm entre eixos; mínimo de 6 barras e ø ≥ 10 mm, NBR 6118 18.4.2) · estribo circular ø ${phiTxt(phiT)} c/ ${fx(sEst, 1)} (18.4.3: ≤ 20 cm, ≤ D e ≤ 12·øl) · cobrimento ${fx(cob, 1)} cm · espera no bloco ${fx(espera, 0)} cm (lb = ${fx(lb, 0)} cm, boa aderência).` : '',
  );
  const posicoes = [];
  if (barras) {
    const comp = Larm * 100 + espera;
    posicoes.push({ id: 'estaca-long', tipo: 'longitudinal', face: 'vertical', local: `Gaiola da estaca: ${fx(Larm, 1)} m armados + ${fx(espera, 0)} cm de espera no bloco`, phi: barras.phi, n: barras.n, comprimento: arred5(comp), reto: comp, ganchos: 0, emendas: 0 });
    const diam = D - 2 * cob - phiT / 10;
    const cEst = Math.PI * diam + 2 * Math.max((8 * phiT) / 10, 6);
    posicoes.push({ id: 'estaca-estribo', tipo: 'estribo', face: 'transversal', local: `Estribo circular ø ${phiTxt(phiT)} c/ ${fx(sEst, 1)} no trecho armado`, phi: phiT, n: Math.floor((Larm * 100) / sEst) + 1, comprimento: arred5(cEst), reto: cEst, ganchos: 2, forma: `circular ø ${fx(diam, 0)} cm`, circular: true, emendas: 0 });
  }
  return {
    aplicavel: true, tipo, nomeTipo: t.nome, D, Ac, Nk, Nd, sigma, sigmaLim: t.sigmaLim, precisa, fck: t.fck, gc: t.gc, fcd,
    AsMin, AsNec, As, Larm, zLim, Lmin: t.Lmin, barras, estribo: { phi: phiT, s: sEst }, lb, espera, cob,
    avisos: avisos.filter(Boolean), verificacoes, memorial: memorial.filter(Boolean), posicoes,
  };
}

/* ======================================================================== sapata (22.6.4) */

/**
 * Lista de ferros da sapata: malhas de flexão de face a face, com gancho nas duas pontas (22.6.4.1.1).
 * @param p { A, B (cm), cob (cm), malhaX: {phi, n, s} (barras paralelas a A), malhaY (paralelas a B) }
 */
export function detalharSapata({ A, B, cob, malhaX, malhaY }) {
  const posicoes = [];
  const add = (id, m, L, rot) => {
    if (!m?.phi) return;
    const g = 10 * m.phi / 10;                                    // gancho a 90°: +10ø em cada ponta
    const c = L - 2 * cob + 2 * g;
    posicoes.push({ id, tipo: 'positiva', face: 'inferior', local: `${rot}: de face a face, gancho nas duas pontas, c/ ${fx(m.s, 1)}`, phi: m.phi, n: m.n, comprimento: arred5(c), reto: L - 2 * cob, ganchos: 2, emendas: 0 });
  };
  add('malha-a', malhaX, A, 'Malha inferior paralela a A');
  add('malha-b', malhaY, B, 'Malha inferior paralela a B');
  posicoes.forEach((q, i) => { q.N = `N${i + 1}`; });
  return { posicoes, avisos: [], verificacoes: [] };
}

/* ======================================================================== bloco sobre estacas (22.7.4) */

/** "3 ø 12,5" ou "12 ø 10 c/ 15" → { n, phi, s } */
export function lerRotulo(rot) {
  const m = /(\d+)\s*ø\s*([\d,.]+)(?:\s*c\/\s*([\d,.]+))?/.exec(String(rot ?? ''));
  return m ? { n: Number(m[1]), phi: Number(m[2].replace(',', '.')), s: m[3] ? Number(m[3].replace(',', '.')) : null } : null;
}

/**
 * Lista de ferros do bloco: tirantes sobre as estacas e malha de distribuição, armadura de suspensão quando as estacas
 * estão afastadas mais de 3·D (22.7.4.1.3), armaduras laterais e superior nos blocos com as estacas numa linha só
 * (22.7.4.1.5: obrigatórias, sem quantidade na norma — adotadas as da prática usual), estribos horizontais do bloco
 * sobre uma estaca e a gaiola das estacas.
 * @param p { n, A, B, h, cob, e, D, armadura (saída do bloco), suspensao (cm²), emLinha, estaca (saída de armaduraEstaca) }
 */
export function detalharBloco({ n, A, B, h, cob, e, D, armadura, suspensao = null, emLinha = false, estaca = null }) {
  const posicoes = [], avisos = [], notas = [];
  const perna = Math.max(20, h - 2 * cob - 5);                   // gancho subindo pela face do bloco
  const tirante = (id, t, L, rot) => {
    const b = lerRotulo(t?.rotulo);
    if (!b) return null;
    const c = L - 2 * cob + 2 * perna;
    posicoes.push({ id, tipo: 'positiva', face: 'inferior', local: `${rot}${(t.faixas ?? 1) > 1 ? ` (${t.faixas} faixas de ${b.n})` : ''}: sobre as estacas, de face a face, ganchos subindo pelas faces`, phi: b.phi, n: b.n * (t.faixas ?? 1), comprimento: arred5(c), reto: L - 2 * cob, ganchos: 2, emendas: 0 });
    return b;
  };
  let principal = 0;
  if (n === 1) {
    const b = lerRotulo(armadura?.rotulo);
    if (b) {
      const c = 2 * (A - 2 * cob) + 2 * (B - 2 * cob) + 2 * 10 * b.phi / 10;
      posicoes.push({ id: 'estribo-horizontal', tipo: 'estribo', face: 'transversal', local: 'Estribos horizontais fechados contra o fendilhamento (bloco sobre uma estaca)', phi: b.phi, n: b.n, comprimento: arred5(c), reto: c, ganchos: 2, forma: `${fx(A - 2 * cob, 0)} × ${fx(B - 2 * cob, 0)} cm`, emendas: 0 });
    }
  } else {
    const lados = armadura?.tipo === 'lados' && n === 3;
    const bx = tirante('tirante-x', armadura?.x, lados ? e + D : A, lados ? 'Tirantes sobre os lados do triângulo' : 'Tirante paralelo a A');
    const by = lados ? null : tirante('tirante-y', armadura?.y, B, 'Tirante paralelo a B');
    principal = Math.max(bx ? bx.n * areaBarra(bx.phi) * (armadura.x?.faixas ?? 1) : 0, by ? by.n * areaBarra(by.phi) * (armadura.y?.faixas ?? 1) : 0);
    for (const [k, L, rot] of [['x', A, 'paralela a A'], ['y', B, 'paralela a B']]) {
      const m = lerRotulo(armadura?.malha?.[k]);
      if (!m) continue;
      const c = L - 2 * cob + 2 * 10 * m.phi / 10;
      posicoes.push({ id: `malha-${k}`, tipo: 'distribuição', face: 'inferior', local: `Malha de distribuição ${rot} (22.7.4.1.2)${m.s ? `, c/ ${fx(m.s, 1)}` : ''}`, phi: m.phi, n: m.n, comprimento: arred5(c), reto: L - 2 * cob, ganchos: 2, emendas: 0 });
    }
  }
  // armaduras laterais e superior: estacas numa linha só (NBR 6118, 22.7.4.1.5 — obrigatórias, sem valor fixado);
  // quantidades da prática usual (Bastos, Blocos de fundação, UNESP): superior 0,2·As; pele e estribos verticais
  // com As/s ≥ 0,075·B (cm²/m por face, B em cm), espaçamento ≤ d/3 e ≤ 20 cm
  if (emLinha && n >= 2) {
    const d = h - 10;
    const AsSup = 0.2 * principal;
    const phiS = AsSup > 4 * areaBarra(10) ? 12.5 : 10;
    const nS = Math.max(2, Math.ceil(AsSup / areaBarra(phiS) - 1e-9));
    const cS = A - 2 * cob + 2 * perna;
    posicoes.push({ id: 'superior', tipo: 'construtiva', face: 'superior', local: `Armadura superior: 0,2·As = ${fx(AsSup, 2)} cm², ganchos descendo pelas faces`, phi: phiS, n: nS, comprimento: arred5(cS), reto: A - 2 * cob, ganchos: 2, emendas: 0 });
    const sMax = Math.min(20, d / 3);
    const hu = h - 2 * cob;
    const porFace = Math.max(2, Math.ceil(hu / sMax) - 1);
    const AsFace = (0.075 * B * hu) / 100;                          // cm² na altura útil de cada face
    const phiP = [8, 10, 12.5, 16].find((ph) => porFace * areaBarra(ph) >= AsFace - 1e-9) ?? 16;
    const cP = A - 2 * cob + 2 * 10 * phiP / 10;
    posicoes.push({ id: 'pele', tipo: 'pele', face: 'lateral', local: `Armadura de pele: ${porFace} barras por face, As/s ≥ 0,075·B = ${fx(0.075 * B, 2)} cm²/m (${fx(AsFace, 2)} cm² por face), s ≤ ${fx(sMax, 1)} cm`, phi: phiP, n: 2 * porFace, comprimento: arred5(cP), reto: A - 2 * cob, ganchos: 2, emendas: 0 });
    const aswFace = 0.075 * B;                                      // cm²/m por ramo
    let est = null;
    for (const ph of [6.3, 8, 10]) {
      const sEst = Math.floor(Math.min(20, d / 3, (areaBarra(ph) * 100) / aswFace) * 2) / 2;
      if (sEst >= 8) { est = { phi: ph, s: sEst }; break; }
    }
    est ??= { phi: 10, s: 8 };
    const nEst = Math.floor((A - 2 * cob) / est.s) + 1;
    const cE = 2 * (B - 2 * cob) + 2 * (h - 2 * cob) + 2 * 10 * est.phi / 10;
    posicoes.push({ id: 'estribo-vertical', tipo: 'estribo', face: 'transversal', local: `Estribos verticais ø ${phiTxt(est.phi)} c/ ${fx(est.s, 1)}: Asw/s ≥ 0,075·B = ${fx(aswFace, 2)} cm²/m por ramo`, phi: est.phi, n: nEst, comprimento: arred5(cE), reto: cE, ganchos: 2, forma: `${fx(B - 2 * cob, 0)} × ${fx(h - 2 * cob, 0)} cm`, emendas: 0 });
    notas.push('Estacas numa linha só: armaduras laterais e superior obrigatórias (NBR 6118, 22.7.4.1.5), sem quantidade fixada na norma. Adotadas as da prática usual (Bastos, Blocos de fundação, UNESP): superior 0,2·As; pele e estribos verticais com As/s ≥ 0,075·B por face, espaçamento ≤ d/3 e ≤ 20 cm.');
  }
  // suspensão: estacas afastadas mais de 3·D
  if (suspensao > 0) {
    const phiE = 8;
    const ramos = 2;
    const nE = Math.max(2, Math.ceil(suspensao / (ramos * areaBarra(phiE)) - 1e-9));
    const c = 2 * (B - 2 * cob) + 2 * (h - 2 * cob) + 2 * 10 * phiE / 10;
    posicoes.push({ id: 'suspensao', tipo: 'estribo', face: 'transversal', local: `Armadura de suspensão (22.7.4.1.3): ${fx(suspensao, 2)} cm² em estribos verticais entre as estacas`, phi: phiE, n: nE, comprimento: arred5(c), reto: c, ganchos: 2, forma: `${fx(B - 2 * cob, 0)} × ${fx(h - 2 * cob, 0)} cm`, emendas: 0 });
  }
  // gaiola das estacas do bloco
  for (const q of estaca?.posicoes ?? []) posicoes.push({ ...q, id: `${q.id}`, n: q.n * n, local: `${q.local} — ${n} estaca(s)` });
  posicoes.forEach((q, i) => { q.N = `N${i + 1}`; });
  return { posicoes, avisos, verificacoes: [], notas };
}
