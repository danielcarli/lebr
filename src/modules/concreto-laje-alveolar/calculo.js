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
 * Laje alveolar pré-fabricada protendida — NBR 14861:2022, NBR 9062:2017 e NBR 6118:2023
 *
 * O painel alveolar (protensão, perdas, transferência, fissuração e resistência ao fogo da seção) é projetado e
 * garantido pelo fabricante (NBR 14861). Este módulo verifica a APLICAÇÃO do painel no projeto: compara os esforços
 * de cálculo do vão com a capacidade do catálogo (MRd, MRd− e VRd por metro), verifica os deslocamentos da Tabela 13.3
 * da NBR 6118 — vibração (L/350, cargas acidentais), aceitabilidade sensorial (L/250, flecha final com a fluência,
 * descontada a contraflecha do fabricante limitada a L/350) e, havendo paredes, L/500 e 10 mm após a parede —, o
 * comprimento de apoio e a capa, e transmite as reações às vigas. Os dados do painel são sempre do fabricante: os
 * valores iniciais são exemplos.
 *
 * Bordas: x0 e x1 são as extremidades dos painéis — apoiadas, engastadas (continuidade
 * pela capa armada ou por alvéolos preenchidos) ou livres (balanço, engastado na outra
 * ponta). Com momento negativo, ele é comparado ao MRd− informado (armadura negativa
 * na capa ou nos alvéolos preenchidos). y0 e y1 são as bordas laterais (apoiada ou livre).
 */
import { FCK_MIN } from '../../engine/materiais.js';
import { analisarViga } from '../../engine/viga-solver.js';
import { bordasFaixa, apoiosFaixa, balancoFaixa, validarFaixa, descreverFaixa, avisosLaterais } from '../comum/bordas.js';

const f = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');
const r2 = (v) => Math.round(v * 100) / 100 || 0;

export function criarLajeAlveolar() {
  return {
    L: 7, largura: 5,
    capa: 5, apoio: 10,
    fluencia: 2,     // coeficiente de fluência φ (NBR 6118, 8.2.11) para as flechas finais
    bordas: { x0: 'apoiada', x1: 'apoiada', y0: 'apoiada', y1: 'apoiada' },
    painel: {
      nome: 'Exemplo LA20 (substituir pelo catálogo)',
      h: 20, larguraPainel: 125, alveolos: 6,
      peso: 2.9,      // kN/m² — peso próprio do painel, sem capa
      MRd: 95,        // kN·m/m — momento resistente de cálculo
      MRdNeg: 0,      // kN·m/m — momento negativo resistente (capa armada ou alvéolos preenchidos); só com engaste ou balanço
      VRd: 75,        // kN/m — cortante resistente de cálculo
      EI: 16000,      // kN·m²/m — rigidez em serviço
      contraflecha: 0, // mm — contraflecha líquida na montagem (protensão − peso do painel), do fabricante
      cordoalhas: 7,  // por painel — do catálogo (desenho e 3D)
      phiCordoalha: 9.5, // mm
    },
    cargas: { revestimento: 1.0, acidental: 3.0, outras: 1.0 },
  };
}

/** Cargas características por m² (a capa entra como permanente). */
export function cargasAlveolar(el, ctx) {
  const capa = (ctx.materiais.gama * (el.capa ?? 0)) / 100;
  const g = el.painel.peso + capa + (el.cargas?.revestimento ?? 0) + (el.cargas?.outras ?? 0) + (el.cargas?.paredes ?? 0);
  return { painel: el.painel.peso, capa, g, q: el.cargas?.acidental ?? 0 };
}

/**
 * Comprimento mínimo de apoio usual dos fabricantes (cm): 10 cm até h = 20 cm e 15 cm acima (sobre apoio plano;
 * menos que isso só com o fabricante). Não é um valor da NBR 14861 — é a prática dos catálogos.
 */
export const apoioMinimo = (h) => (h <= 20 ? 10 : 15);

/** Esforços característicos da faixa de 1 m (G e Q separados). */
function analisar(el, ctx) {
  const bordas = bordasFaixa(el);
  const apoios = apoiosFaixa(bordas);
  const cg = cargasAlveolar(el, ctx);
  const base = { vaos: [el.L], apoios, P: [], EI: [el.painel.EI] };
  const rG = analisarViga({ ...base, q: [cg.g] });
  const rQ = analisarViga({ ...base, q: [cg.q] });
  return { bordas, apoios, cg, rG, rQ, base };
}

/** Reações por metro de viga de apoio (kN/m); a extremidade livre não transmite carga. */
export function cargasTransmitidas(el, ctx) {
  const { rG, rQ, apoios } = analisar(el, ctx);
  const out = {};
  const balanco = apoios.includes('livre');
  ['apoio-a', 'apoio-b'].forEach((id, k) => {
    if (apoios[k] === 'livre') return;
    out[id] = { g: rG.reacoes[k].V, q: rQ.reacoes[k].V };
    if (balanco) out[id].t = { g: Math.abs(rG.reacoes[k].M), q: Math.abs(rQ.reacoes[k].M) }; // torção de equilíbrio
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

export function calcularLajeAlveolar(el, ctx) {
  const { concreto: c, gg, gq, psi2, caa } = ctx.materiais;
  const P = el.painel;
  if (!(el.L > 0)) throw new Error('Informe o vão do painel.');
  if (!(P.MRd > 0 && P.VRd > 0 && P.EI > 0)) throw new Error('Informe MRd, VRd e EI do painel conforme o catálogo do fabricante.');
  validarFaixa(bordasFaixa(el));
  const avisos = [], verificacoes = [], memorial = [];
  const L = el.L;
  const { bordas, apoios, cg, rG, rQ, base } = analisar(el, ctx);
  const balanco = balancoFaixa(bordas);
  const engaste = bordas.x0 === 'engastada' || bordas.x1 === 'engastada';
  const biapoiada = !balanco && !engaste;
  const pd = gg * cg.g + gq * cg.q;

  const pts = rG.pontos.map((p, i) => ({ M: gg * p.M + gq * rQ.pontos[i].M, V: gg * p.V + gq * rQ.pontos[i].V }));
  const Md = Math.max(0, ...pts.map((p) => p.M));
  const MdNeg = Math.min(0, ...pts.map((p) => p.M));
  const Vd = Math.max(...pts.map((p) => Math.abs(p.V)));
  const MRdNeg = P.MRdNeg ?? 0;

  const flecha = (w) => Math.abs(analisarViga({ ...base, q: [w] }).vaos[0].flecha) * 1000;
  const fq = flecha(cg.q);                                  // mm, só acidental (vibração)
  const fSob = flecha((cg.g - cg.painel) + psi2 * cg.q);    // cargas aplicadas após a montagem (imediata)
  const Lef = (balanco ? 2 : 1) * L * 1000;                 // Tabela 13.3: no balanço, o vão equivalente é 2L
  const limVib = Lef / 350;
  // aceitabilidade sensorial (Tabela 13.3, L/250): flecha final das cargas aplicadas depois da montagem, com a
  // fluência (1 + φ), menos a contraflecha líquida do fabricante, considerada até L/350 (13.3); o peso do painel é
  // compensado na contraflecha líquida informada
  const phi = Math.max(0, el.fluencia ?? 2);
  const cf = Math.max(0, P.contraflecha ?? 0), cfMax = Lef / 350;
  const fFinal = (1 + phi) * fSob - Math.min(cf, cfMax);
  const limVisual = Lef / 250;
  // paredes sobre a laje (Tabela 13.3: L/500 e 10 mm após a construção da parede): a fluência do que já estava
  // aplicado (capa) continua, e as cargas da parede, do revestimento e ψ2·q entram com (1 + φ)
  const paredes = el.cargas?.paredes ?? 0;
  const fParede = paredes > 0 ? phi * flecha(cg.capa) + (1 + phi) * flecha(cg.g - cg.painel - cg.capa + psi2 * cg.q) : 0;
  const limParede = Math.min(Lef / 500, 10);
  const apMin = apoioMinimo(P.h);
  const nPaineis = Math.ceil((el.largura * 100) / P.larguraPainel - 1e-9);
  const esbeltez = (L * 100) / (P.h + (el.capa ?? 0));

  if (Md > 0.01 || !balanco) verificacoes.push({ nome: 'Momento fletor', item: 'NBR 14861 · catálogo', valor: `Md = ${f(Md)} kN·m/m`, limite: `MRd = ${f(P.MRd)} kN·m/m`, ok: Md <= P.MRd });
  if (MdNeg < -0.01) verificacoes.push({ nome: balanco ? 'Momento negativo no engaste do balanço' : 'Momento negativo no engaste', item: 'NBR 6118 · 17.2', valor: `Md− = ${f(-MdNeg)} kN·m/m`, limite: MRdNeg > 0 ? `MRd− = ${f(MRdNeg)} kN·m/m` : 'MRd− não informado', ok: MRdNeg > 0 && -MdNeg <= MRdNeg });
  verificacoes.push({ nome: 'Força cortante no apoio', item: 'NBR 14861 · catálogo', valor: `VSd = ${f(Vd)} kN/m`, limite: `VRd = ${f(P.VRd)} kN/m`, ok: Vd <= P.VRd });
  verificacoes.push({ nome: 'Vibração (flecha das cargas acidentais)', item: '13.3 — Tabela 13.3', valor: `${f(fq, 1)} mm`, limite: `${balanco ? '2L' : 'L'}/350 = ${f(limVib, 1)} mm`, ok: fq <= limVib });
  verificacoes.push({ nome: 'Aceitabilidade sensorial (flecha final − contraflecha)', item: '13.3 — Tabela 13.3', valor: `${f(fFinal, 1)} mm`, limite: `${balanco ? '2L' : 'L'}/250 = ${f(limVisual, 1)} mm`, ok: fFinal <= limVisual });
  if (paredes > 0) verificacoes.push({ nome: 'Paredes sobre a laje (flecha após a parede)', item: '13.3 — Tabela 13.3', valor: `${f(fParede, 1)} mm`, limite: `${balanco ? '2L' : 'L'}/500 e 10 mm = ${f(limParede, 1)} mm`, ok: fParede <= limParede });
  verificacoes.push({ nome: 'Comprimento de apoio', item: 'prática dos fabricantes · NBR 9062', valor: `${f(el.apoio ?? 0, 1)} cm`, limite: `≥ ${f(apMin, 0)} cm (h ${P.h <= 20 ? '≤' : '>'} 20 cm)`, ok: (el.apoio ?? 0) >= apMin });
  if ((el.capa ?? 0) > 0) verificacoes.push({ nome: `Concreto da capa (CAA ${caa})`, item: '7.4.2', valor: `C${c.fck}`, limite: `≥ C${FCK_MIN[caa]}`, ok: c.fck >= FCK_MIN[caa] });

  avisos.push(`Capacidades e rigidez do painel vêm do catálogo do fabricante; confira os valores digitados e o comprimento mínimo de apoio (adotado ${f(el.apoio ?? 0, 0)} cm).`);
  if (P.nome?.toLowerCase().includes('exemplo')) avisos.push('O painel ainda está com os valores de exemplo: substitua pelos dados do fabricante antes de usar o resultado.');
  if (esbeltez > 45) avisos.push(`Relação vão/altura ${f(esbeltez, 0)} acima de 45: confira com o fabricante a viabilidade e a contraflecha da protensão.`);
  if ((el.capa ?? 0) > 0) avisos.push('A capa entra só como carga (sem seção composta) — a favor da segurança.');
  if ((el.capa ?? 0) > 0 && el.capa < 5) avisos.push(`Capa de ${f(el.capa, 1)} cm: os fabricantes pedem em geral 5 cm ou mais, armada com tela, e de concreto C30 ou superior — confirme no catálogo.`);
  if (!((el.capa ?? 0) > 0)) avisos.push('Sem capa: a laje só funciona como diafragma e só distribui cargas entre os painéis com as chavetas (juntas longitudinais) preenchidas com graute.');
  if (paredes > 0) avisos.push('Paredes sobre a laje alveolar: a carga de uma parede paralela aos painéis fica em um ou dois painéis; a distribuição transversal depende das chavetas preenchidas (NBR 14861) — confirme a capacidade dos painéis mais carregados com o fabricante. Aqui a parede entra como carga distribuída equivalente.');
  if (!(cf > 0)) avisos.push('Contraflecha do fabricante não informada: a flecha final não desconta a contraflecha da protensão (a favor da segurança).');
  else if (cf > cfMax) avisos.push(`A contraflecha informada (${f(cf, 1)} mm) passa de ${balanco ? '2L' : 'L'}/350 = ${f(cfMax, 1)} mm: só esse limite foi descontado (13.3).`);
  avisos.push('Furos, recortes e cargas concentradas reduzem a capacidade do painel e não estão nos valores do catálogo — verifique com o fabricante. A resistência ao fogo (NBR 14432 e NBR 15200) depende do cobrimento das cordoalhas e é dada pelo fabricante.');
  if (MdNeg < -0.01 && !(MRdNeg > 0)) avisos.push('Há momento negativo: informe o MRd− da armadura negativa (capa armada ou alvéolos preenchidos com barras).');
  if (balanco) avisos.push('Balanço em laje alveolar: a protensão fica na face inferior e é desfavorável no balanço — exige armadura negativa na capa ou em alvéolos preenchidos e confirmação do fabricante.');
  else if (engaste) avisos.push('Continuidade (engaste) em laje alveolar: o painel é fabricado biapoiado; o engaste depende da armadura negativa na capa ou nos alvéolos preenchidos.');
  avisos.push(...avisosLaterais(bordas, 'o painel de borda fica com a lateral sem apoio — confira com o fabricante o travamento e o acabamento da borda.'));

  memorial.push({ titulo: 'Painel', linhas: [
    `${P.nome} · h = ${f(P.h, 0)} cm · largura ${f(P.larguraPainel, 0)} cm · ${nPaineis} painéis para ${f(el.largura)} m · vão/altura = ${f(esbeltez, 1)}`,
    `Catálogo: peso ${f(P.peso)} kN/m² · MRd ${f(P.MRd)} kN·m/m${MRdNeg > 0 ? ` · MRd− ${f(MRdNeg)} kN·m/m` : ''} · VRd ${f(P.VRd)} kN/m · EI ${f(P.EI, 0)} kN·m²/m`,
  ] });
  memorial.push({ titulo: `Cargas e esforços (${descreverFaixa(bordas)})`, linhas: [
    `Bordas: esquerda ${bordas.x0}, direita ${bordas.x1}, laterais ${bordas.y0} / ${bordas.y1}`,
    `g = painel ${f(cg.painel)} + capa ${f(cg.capa)} + revestimento e outras ${f(cg.g - cg.painel - cg.capa)} = ${f(cg.g)} kN/m² · q = ${f(cg.q)} kN/m²`,
    biapoiada
      ? `pd = ${f(gg)}·g + ${f(gq)}·q = ${f(pd)} kN/m² · Md = pd·L²/8 = ${f(Md)} kN·m/m · VSd = pd·L/2 = ${f(Vd)} kN/m`
      : `pd = ${f(gg)}·g + ${f(gq)}·q = ${f(pd)} kN/m² · Md+ = ${f(Md)} · Md− = ${f(MdNeg)} kN·m/m · VSd = ${f(Vd)} kN/m (faixa de 1 m, rigidez EI do catálogo)`,
  ] });
  memorial.push({ titulo: 'Serviço (Tabela 13.3)', linhas: [
    `Vibração: flecha das cargas acidentais = ${f(fq)} mm ≤ ${balanco ? '2L' : 'L'}/350 = ${f(limVib)} mm`,
    `Flecha imediata das cargas aplicadas após a montagem (capa, revestimento, outras${paredes > 0 ? ', paredes' : ''} + ψ2·q) = ${f(fSob)} mm`,
    `Flecha final = (1 + φ)·${f(fSob)} − contraflecha ${f(Math.min(cf, cfMax))} mm = (1 + ${f(phi, 1)})·${f(fSob)} − ${f(Math.min(cf, cfMax))} = ${f(fFinal)} mm ≤ ${balanco ? '2L' : 'L'}/250 = ${f(limVisual)} mm (contraflecha até ${balanco ? '2L' : 'L'}/350 = ${f(cfMax)} mm)`,
    ...(paredes > 0 ? [`Após a parede: φ·f(capa) + (1 + φ)·f(parede, revestimento, outras, ψ2·q) = ${f(fParede)} mm ≤ min(${balanco ? '2L' : 'L'}/500; 10 mm) = ${f(limParede)} mm`] : []),
    `Coeficientes: γg = ${f(gg, 2)} e γq = ${f(gq, 2)} (a NBR 8681 admite 1,30 para o peso próprio de pré-moldados; aqui fica o valor do projeto, a favor da segurança) · ψ2 = ${f(psi2, 2)}`,
  ] });
  memorial.push({ titulo: 'Apoio e capa', linhas: [
    `Comprimento de apoio ${f(el.apoio ?? 0, 1)} cm ≥ ${f(apMin, 0)} cm (prática dos fabricantes: 10 cm até h = 20 cm, 15 cm acima, sobre apoio plano)`,
    (el.capa ?? 0) > 0 ? `Capa ${f(el.capa, 1)} cm de concreto C${c.fck}, armada com tela (usual ≥ 5 cm, C30)` : 'Sem capa — chavetas preenchidas com graute',
  ] });

  const reacoes = ['apoio-a', 'apoio-b'].map((id, k) => (apoios[k] === 'livre' ? null : {
    id, nome: k === 0 ? 'Borda esquerda (x = 0)' : `Borda direita (x = ${f(L)} m)`, tipo: bordas[k === 0 ? 'x0' : 'x1'],
    g: r2(rG.reacoes[k].V), q: r2(rQ.reacoes[k].V), d: r2(gg * rG.reacoes[k].V + gq * rQ.reacoes[k].V),
  })).filter(Boolean);

  return {
    ok: verificacoes.every((v) => v.ok),
    avisos, verificacoes, memorial,
    bordas, balanco,
    cargas: { painel: r2(cg.painel), capa: r2(cg.capa), g: r2(cg.g), q: r2(cg.q), pd: r2(pd) },
    Md: r2(Md), MdNeg: r2(MdNeg), Vd: r2(Vd), MRd: P.MRd, MRdNeg, VRd: P.VRd,
    flecha: { q: r2(fq), sobreposta: r2(fSob), lim: r2(limVib), final: r2(fFinal), limFinal: r2(limVisual), contraflecha: r2(Math.min(cf, cfMax)), parede: r2(fParede), limParede: r2(limParede) },
    apoioMinimo: apMin,
    nPaineis, esbeltez: r2(esbeltez),
    reacoes,
  };
}
