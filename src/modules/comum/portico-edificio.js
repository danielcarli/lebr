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
 * Pórtico espacial do edifício (NBR 6118, 14.6): vigas de concreto de todos os pavimentos e pilares de
 * todos os lances num só modelo de barras com 6 graus de liberdade por nó (engine/portico.js).
 *
 *   - vigas: as mesmas barras e cargas da grelha de cada pavimento (montarVigasDoPavimento), na cota do
 *     pavimento, com a torção reduzida a 15 %;
 *   - pilares: barras verticais da cota de baixo à cota do pavimento; o pilar de cima nasce no topo do de
 *     baixo (mesmo prumo) ou num nó de viga do pavimento de baixo; sem nada embaixo, engastado na fundação;
 *   - lajes: diafragma rígido em cada pavimento (ux, uy e rz dos nós do nível seguem um nó mestre);
 *   - apoio de viga sem pilar (parede): apoio vertical, como na grelha;
 *   - cargas: as das vigas por caso (G, Q), o peso próprio dos pilares e as cargas concentradas lançadas nos pilares.
 *
 * Os resultados ficam por pilar (lance a lance) e por pavimento (resultante das cargas verticais), para
 * conferir com as reações na fundação.
 */
import { analisarPortico, esforcosNaSecao, propriedadesMaterial } from '../../engine/portico.js';
import { pavimentosOrdenados, tipoDe, secaoPilar, centroPilar, cantosLaje, cantosPilar, eixoViga, TOLERANCIA } from '../../renderer/core/montagem.js';
import { forcasDeVento, TOPOGRAFIAS } from '../../engine/vento.js';
import { CASOS_VENTO } from '../../engine/combinacoes.js';
import { montarVigasDoPavimento, FATOR_TORCAO_GRELHA } from './grelha.js';
import { contextoCalculo } from '../../renderer/core/calculo.js';
import { combinar, extremo, doTipo, casosGlobais, casosPadrao, gerarCombinacoes, coeficientesAcoes, majorarHorizontais } from '../../engine/combinacoes.js';
import { contextoConcreto, concreto } from '../../engine/materiais.js';
import {
  desaprumo, acaoHorizontal, rigidezEquivalente, parametroAlfa, gamaZ, classificarGamaZ, RIGIDEZ_REDUZIDA, CONTRAVENTAMENTOS,
} from '../../engine/estabilidade.js';

const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const r3 = (v) => Math.round(v * 1000) / 1000 || 0;

/** Usar o pórtico no dimensionamento dos pilares? (Parâmetros do projeto › Análise global) */
export const porticoNosPilares = (projeto) => projeto?.parametros?.analiseGlobal?.pilares === 'portico';

const cache = new Map();
function chaveDe(projeto) {
  const els = projeto.elementos.map(({ resultado, ...resto }) => resto); // eslint-disable-line no-unused-vars
  return JSON.stringify([projeto.parametros, projeto.pavimentos, els]);
}

/** Parâmetros de vento do projeto, com os padrões. */
export function parametrosVento(projeto) {
  const v = projeto?.parametros?.vento ?? {};
  return {
    ativo: !!v.ativo, V0: v.V0 ?? 45, referencia: v.referencia ?? '', topografia: v.topografia ?? 'plano',
    S1: v.topografia === 'informado' ? (v.S1 ?? 1) : (TOPOGRAFIAS[v.topografia ?? 'plano']?.S1 ?? 1),
    categoria: v.categoria ?? 'IV', classe: v.classe && v.classe !== 'auto' ? v.classe : null, grupo: v.grupo ?? 2,
    Ca: { x: v.Ca?.x ?? null, y: v.Ca?.y ?? null },
  };
}

/** Parâmetros de estabilidade global do projeto, com os padrões. */
export function parametrosEstabilidade(projeto) {
  const e = projeto?.parametros?.estabilidade ?? {};
  return {
    desaprumo: e.desaprumo ?? true,
    rigidez: RIGIDEZ_REDUZIDA[e.rigidez] ? e.rigidez : 'separada',
    contraventamento: CONTRAVENTAMENTOS[e.contraventamento] ? e.contraventamento : 'porticos',
    majorar: e.majorar ?? true,
  };
}

/** Nome da ação horizontal de cada direção. */
export const ROTULO_ACAO = { vento: 'Vento', desaprumo: 'Desaprumo', combinado: 'Vento + desaprumo' };

/**
 * Ação horizontal de cada direção (vento, desaprumo ou os dois, 11.3.3.4.1) e as forças por nível.
 * niveis: [{ id, nome, cota, G, Q }] acima da base; P = G + Q característico de cada nível.
 */
function acoesHorizontais({ projeto, niveis, zBase, vento, nPilares }) {
  const est = parametrosEstabilidade(projeto);
  const out = { parametros: est, niveis, zBase, avisos: [], desaprumo: null, direcoes: {}, forcas: [], forcasEstabilidade: [], casos: false, lista: null, H: 0, nPilares };
  if (!niveis.length) return out;
  const H = Math.max(...niveis.map((n) => n.cota)) - zBase;
  out.H = H;
  const d = desaprumo({ H, n: nPilares });
  out.desaprumo = d;
  const P = (n) => n.G + n.Q;
  const h = (n) => n.cota - zBase;
  const fw = new Map((vento?.pavimentos ?? []).map((p) => [p.id, p]));
  const Fw = (n, e) => fw.get(n.id)?.[e === 'x' ? 'Fx' : 'Fy'] ?? 0;
  const Md = niveis.reduce((a, n) => a + d.thetaA * P(n) * h(n), 0);
  for (const e of ['x', 'y']) {
    const Mv = niveis.reduce((a, n) => a + Fw(n, e) * h(n), 0);
    const acao = !vento ? (est.desaprumo ? 'desaprumo' : null) : !est.desaprumo ? 'vento' : acaoHorizontal(Mv, Md);
    const theta = acao === 'desaprumo' ? d.thetaA : acao === 'combinado' ? d.thetaASemMin : 0;
    out.direcoes[e] = { acao, Mvento: Mv, Mdesaprumo: Md, theta, razao: Md > 0 ? Mv / Md : Infinity };
  }
  const forca = (n, e) => {
    const dd = out.direcoes[e];
    if (!dd.acao) return { vento: 0, desaprumo: 0 };
    return { vento: dd.acao === 'desaprumo' ? 0 : Fw(n, e), desaprumo: dd.theta * P(n) };
  };
  out.forcas = niveis.map((n) => {
    const fx = forca(n, 'x'), fy = forca(n, 'y');
    return { id: n.id, nome: n.nome, h: h(n), P: P(n), Fx: fx.vento + fx.desaprumo, Fy: fy.vento + fy.desaprumo, FxDesaprumo: fx.desaprumo, FyDesaprumo: fy.desaprumo };
  });
  out.casos = !!(out.direcoes.x.acao || out.direcoes.y.acao);
  out.lista = out.casos ? CASOS_VENTO.map((cv) => {
    const acao = out.direcoes[cv.angulo % 180 === 0 ? 'x' : 'y'].acao;
    return { id: cv.id, acao, nome: `${ROTULO_ACAO[acao]} ${cv.angulo}°` };
  }) : null;
  // sem ações horizontais no modelo, α e γz usam a distribuição do desaprumo (a forma importa, não o valor)
  out.forcasEstabilidade = out.casos ? out.forcas : niveis.map((n) => ({ id: n.id, nome: n.nome, h: h(n), P: P(n), Fx: d.thetaA * P(n), Fy: d.thetaA * P(n) }));
  return out;
}

const NOME_DIR = { x: 'em X', y: 'em Y' };
const CASOS_DIR = { x: ['V1', 'V3'], y: ['V2', 'V4'] };

/**
 * Estabilidade global: α com a rigidez bruta (Ecs·Ic) e γz com a rigidez reduzida (15.7.3), nas duas direções,
 * e as combinações do edifício com os esforços horizontais majorados por 0,95·γz quando for o caso (15.7.2).
 */
function analisarEstabilidade({ projeto, modelo, pilarBarras, horiz, nosDoNivel, cargasHX, cargasHY }) {
  const est = horiz.parametros;
  const par = projeto.parametros;
  const k = coeficientesAcoes(par);
  const casos = horiz.casos ? casosGlobais(par, horiz.lista) : casosPadrao(k);
  const combs = gerarCombinacoes(casos, k);
  const nNiveis = horiz.niveis.length;
  const Nk = horiz.forcasEstabilidade.reduce((a, f) => a + f.P, 0);
  const out = { parametros: est, avisos: [], notas: [], casos, combinacoes: combs, combinacoesSemMajorar: combs, nNiveis, H: horiz.H, Nk, nPilares: horiz.nPilares, x: null, y: null, fatores: {} };
  if (!nNiveis || !(horiz.H > 0)) return out;
  const c = concreto(par.concreto.fck, { agregado: par.concreto.agregado });
  const rel = c.Eci / c.Ecs;
  const red = RIGIDEZ_REDUZIDA[est.rigidez];
  out.rigidez = { ...red, Eci: c.Eci, Ecs: c.Ecs };
  const semCargas = { ...modelo, barras: modelo.barras.map((b) => ({ ...b, cargas: [] })), cargas: [...cargasHX, ...cargasHY] };
  let bruto, reduzido;
  try {
    bruto = analisarPortico(semCargas);
    reduzido = analisarPortico({ ...semCargas, barras: semCargas.barras.map((b) => ({ ...b, fatorEI: (pilarBarras.has(b.id) ? red.pilar : red.viga) * rel })) });
  } catch (err) {
    out.erro = err.message;
    out.avisos.push(`Estabilidade global: ${err.message}`);
    return out;
  }
  const desloc = (r, caso, g) => {
    const m = new Map(r.porCaso[caso].deslocamentos.map((d) => [d.id, d.u]));
    return (id) => { const l = nosDoNivel(id); return l.reduce((a, q) => a + m.get(q.id)[g], 0) / l.length; };
  };
  const niveis = horiz.forcasEstabilidade;
  const topo = niveis.reduce((a, n) => (n.h > a.h ? n : a), niveis[0]);
  for (const e of ['x', 'y']) {
    const caso = e === 'x' ? 'HX' : 'HY', g = e === 'x' ? 0 : 1, chave = e === 'x' ? 'Fx' : 'Fy';
    const forcas = niveis.map((n) => ({ id: n.id, h: n.h, F: n[chave] }));
    const dirOut = { direcao: e, acao: horiz.direcoes[e]?.acao ?? null };
    try {
      const dBruto = desloc(bruto, caso, g), dRed = desloc(reduzido, caso, g);
      const deltaTopo = dBruto(topo.id);
      const EI = rigidezEquivalente(forcas, horiz.H, deltaTopo);
      Object.assign(dirOut, { deltaTopo, EI, ...parametroAlfa({ H: horiz.H, Nk, EI, nNiveis, contraventamento: est.contraventamento }) });
      const delta = new Map(niveis.map((n) => [n.id, Math.abs(dRed(n.id))]));
      const M1k = forcas.reduce((a, f) => a + f.F * f.h, 0);
      const ids = CASOS_DIR[e];
      let cand = combs.filter((cb) => cb.tipo === 'ELU' && ids.some((id) => cb.fatores[id] > 0));
      if (!cand.length) cand = [{ id: '—', fatores: { G: k.gg, Q: k.gq }, expressao: `${String(k.gg).replace('.', ',')}·G + ${String(k.gq).replace('.', ',')}·Q`, semHorizontal: true }];
      let melhor = null;
      for (const cb of cand) {
        const fH = cb.semHorizontal ? k.gq : Math.max(...ids.map((id) => cb.fatores[id] ?? 0));
        const Pd = (n) => (cb.fatores.G ?? 0) * n.G + (cb.fatores.Q ?? 0) * n.Q;
        const dMk = horiz.niveis.reduce((a, n) => a + Pd(n) * (delta.get(n.id) ?? 0), 0);
        const r = dMk / M1k;
        if (!melhor || r > melhor.r) melhor = { r, cb, fH, dMk, Pd };
      }
      const gz = gamaZ({ M1: M1k, dM: melhor.dMk });
      const porGz = nNiveis >= 4;
      const cg = classificarGamaZ(gz.gz);
      let classe = porGz ? cg.classe : (dirOut.nosFixos ? 'fixos' : cg.classe === 'fixos' ? 'moveis' : cg.classe);
      let fator = porGz ? cg.fator : (dirOut.nosFixos ? 1 : cg.fator);
      if (!Number.isFinite(fator)) { fator = 1; classe = 'instavel'; }
      if (!est.majorar) fator = 1;
      Object.assign(dirOut, {
        gz: gz.gz, classe, fator, porGz, comb: melhor.cb.id, expressao: melhor.cb.expressao,
        M1d: M1k * melhor.fH, dMd: melhor.dMk * melhor.fH, M1k,
        niveis: horiz.niveis.map((n) => ({ id: n.id, nome: n.nome, h: n.cota - horiz.zBase, F: forcas.find((f) => f.id === n.id)?.F ?? 0, delta: delta.get(n.id) ?? 0, Pd: melhor.Pd(n) })),
      });
      if (classe === 'instavel') out.avisos.push(`Estabilidade ${NOME_DIR[e]}: ΔMd ≥ M1d — a estrutura é instável com a rigidez reduzida; aumente a rigidez dos pilares e vigas.`);
      else if (cg.classe === 'excede') out.avisos.push(`Estabilidade ${NOME_DIR[e]}: γz = ${gz.gz.toFixed(2).replace('.', ',')} > 1,3 — a majoração por 0,95·γz não vale; é preciso análise de 2ª ordem (P-Δ, Fase 2). Os esforços horizontais foram majorados por 0,95·γz só como estimativa${est.majorar ? '' : ' (majoração desligada)'}.`);
    } catch (err) {
      dirOut.erro = err.message;
      out.avisos.push(`Estabilidade ${NOME_DIR[e]}: ${err.message}`);
    }
    out[e] = dirOut;
  }
  if (nNiveis < 4) out.notas.push(`O γz vale para estruturas com 4 andares ou mais (15.5.3); com ${nNiveis}, a classificação em nós fixos ou móveis é pelo parâmetro α (15.5.2).`);
  if (est.rigidez === 'simplificada' && [out.x, out.y].some((d) => d?.gz > 1.3)) out.notas.push('A rigidez simplificada 0,7·EciIc só vale com γz ≤ 1,3 (15.7.3): use vigas 0,4 e pilares 0,8.');
  if (!horiz.casos) out.notas.push('Sem vento nem desaprumo no modelo: α e γz usam a distribuição do desaprumo só para a avaliação; as combinações ficam sem ações horizontais.');
  out.fatores = { V1: out.x?.fator ?? 1, V3: out.x?.fator ?? 1, V2: out.y?.fator ?? 1, V4: out.y?.fator ?? 1 };
  if (horiz.casos) out.combinacoes = majorarHorizontais(combs, casos, out.fatores);
  return out;
}

/** Planta do edifício: retângulo envolvente dos elementos posicionados (m). */
export function plantaDoEdificio(projeto, registro) {
  const pts = [];
  for (const e of projeto.elementos) {
    if (!e.posicao) continue;
    const t = tipoDe(e, registro);
    if (t === 'laje') pts.push(...cantosLaje(e));
    else if (t === 'viga') { const ex = eixoViga(e); pts.push(ex.a, ex.b); }
    else if (t === 'pilar') pts.push(...cantosPilar(e));
  }
  if (!pts.length) return null;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return { x0, x1, y0, y1, Lx: x1 - x0, Ly: y1 - y0, centro: [(x0 + x1) / 2, (y0 + y1) / 2] };
}

/** Forças de vento do edifício por pavimento (ou { erro }). Terreno na cota 0. */
export function ventoDoProjeto(projeto, registro) {
  const pv = parametrosVento(projeto);
  const planta = plantaDoEdificio(projeto, registro);
  if (!planta) return { erro: 'Não há elementos posicionados na montagem.', parametros: pv };
  try {
    const niveis = pavimentosOrdenados(projeto).map((p) => ({ id: p.id, nome: p.nome, z: p.cota }));
    const r = forcasDeVento({ V0: pv.V0, S1: pv.S1, categoria: pv.categoria, classe: pv.classe, grupo: pv.grupo, Lx: planta.Lx, Ly: planta.Ly, niveis, Ca: pv.Ca });
    return { ...r, planta, parametros: pv };
  } catch (err) { return { erro: err.message, parametros: pv, planta }; }
}

/** Pórtico do edifício (com cache). Nunca lança erro: devolve { erro } quando não dá para montar. */
export function porticoDoEdificio(projeto, registro) {
  const chave = chaveDe(projeto);
  if (cache.has(chave)) return cache.get(chave);
  let r;
  try { r = montarEResolver(projeto, registro); } catch (err) { r = { erro: err.message, pilares: new Map(), pavimentos: [] }; }
  cache.set(chave, r);
  if (cache.size > 6) cache.delete(cache.keys().next().value);
  return r;
}

function montarEResolver(projeto, registro) {
  const avisos = [];
  const pavs = pavimentosOrdenados(projeto);
  const tipo = (e) => tipoDe(e, registro);
  const mat = propriedadesMaterial({ fck: projeto.parametros.concreto.fck, agregado: projeto.parametros.concreto.agregado });
  const gama = projeto.parametros.concreto.pesoEspecifico ?? 25;
  const nos = [], barras = [], cargas = [], diafragmas = [];
  const nosPorPav = new Map(); // pavId → [{ id, p }]
  const resumoPav = [];
  const infoPilar = new Map(); // id do elemento → { barra, pav, base, topo, prumo }
  const noPilarTopo = new Map(); // pavId → [{ p, id, pilarId }]
  const modelados = new Set();

  const novoNo = (id, p, z, apoio) => { const n = { id, x: p[0], y: p[1], z, ...(apoio ? { apoio } : {}) }; nos.push(n); return n; };
  const noNoNivel = (pavId, p) => (nosPorPav.get(pavId) ?? []).find((q) => dist(q.p, p) <= TOLERANCIA * 0.5) ?? null;

  pavs.forEach((pav, ip) => {
    const lista = [];
    nosPorPav.set(pav.id, lista);
    const soma = { G: 0, Q: 0 };
    // ---------------------------------------------------------- vigas do pavimento
    const vg = montarVigasDoPavimento(projeto, pav.id, registro);
    if (vg.erro && vg.vigas.length === 0 && !/Não há vigas/.test(vg.erro)) avisos.push(`${pav.nome}: ${vg.erro}`);
    for (const a of vg.avisos ?? []) avisos.push(`${pav.nome}: ${a}`);
    for (const v of vg.vigas ?? []) modelados.add(v.id);
    const idDe = (n) => `${pav.id}/${n.id}`;
    for (const n of vg.nos) {
      const ap = vg.apoioDe.get(n);
      let apoio = null;
      // apoio declarado sem pilar (parede): apoio vertical; os pilares entram como barras
      if (ap?.uz && !ap.pilar) apoio = ap.engaste ? '001110' : '001000';
      const no = novoNo(idDe(n), n.p, pav.cota, apoio);
      if (apoio && !ap.engaste) {
        const dirs = [...n.vigas].map((id) => vg.dados.find((d) => d.el.id === id).eixo.u);
        const paralelas = dirs.every((u) => Math.abs(u[0] * dirs[0][1] - u[1] * dirs[0][0]) < 1e-6);
        if (paralelas) no.molasRot = [{ eixo: [dirs[0][0], dirs[0][1], 0], k: 1e9 }];
      }
      lista.push({ id: no.id, p: n.p });
    }
    for (const b of vg.barras) {
      const { s0, s1, vao, Lb, ...resto } = b; // eslint-disable-line no-unused-vars
      barras.push({ ...resto, id: `${pav.id}/${b.id}`, i: `${pav.id}/${b.i}`, j: `${pav.id}/${b.j}`, fatorTorcao: FATOR_TORCAO_GRELHA });
      for (const c of b.cargas) {
        const v = c.tipo === 'q' ? -c.valor * b.Lb : c.tipo === 'P' ? -c.valor : 0;
        soma[c.caso] += v;
      }
    }

    // ---------------------------------------------------------- pilares que chegam a este nível
    const pilares = projeto.elementos.filter((e) => e.posicao?.pavimento === pav.id && tipo(e) === 'pilar');
    const topos = [];
    noPilarTopo.set(pav.id, topos);
    const abaixo = ip > 0 ? pavs[ip - 1] : null;
    for (const pl of pilares) {
      if (pl.modulo !== 'concreto.pilar') { avisos.push(`${pl.codigo}: só pilares de concreto entram no pórtico.`); continue; }
      const c = centroPilar(pl);
      let topo = noNoNivel(pav.id, c);
      if (!topo) { const n = novoNo(`${pav.id}/${pl.codigo}`, c, pav.cota); topo = { id: n.id, p: c }; lista.push(topo); }
      // base: topo do pilar de baixo ou nó de viga no nível de baixo; senão, fundação
      let base = abaixo ? noNoNivel(abaixo.id, c) : null;
      let fundacao = false;
      if (!base) {
        const zb = abaixo ? abaixo.cota : pav.cota - (pl.comprimento ?? 3);
        const n = novoNo(`${pav.id}/${pl.codigo}·base`, c, zb, 'engaste');
        base = { id: n.id, p: c };
        fundacao = true;
        if (abaixo) avisos.push(`${pl.codigo}: não há pilar nem viga embaixo no ${abaixo.nome} — engastado na cota ${String(zb).replace('.', ',')} m.`);
      }
      const { bx, by } = secaoPilar(pl);
      const barra = { id: `${pav.id}/${pl.codigo}`, i: base.id, j: topo.id, secao: { b: by, h: bx }, angulo: pl.posicao?.angulo ?? 0, cargas: [] };
      if (pl.pesoProprio) {
        const pp = (gama * bx * by) / 1e4;
        barra.cargas.push({ tipo: 'q', dir: 'Z', valor: -pp, caso: 'G' });
        const L = pav.cota - (nos.find((n) => n.id === base.id).z);
        soma.G += pp * L;
      }
      barras.push(barra);
      // cargas concentradas lançadas no pilar e reações de elementos que não estão no pórtico
      for (const cg of Array.isArray(pl.cargas) ? pl.cargas : []) {
        if (cg.tipo === 'concentrada') {
          const caso = cg.natureza === 'q' ? 'Q' : 'G';
          cargas.push({ no: topo.id, Fz: -Number(cg.valor || 0), caso });
          soma[caso] += Number(cg.valor || 0);
        } else if (cg.tipo === 'elemento') {
          const fonte = projeto.elementos.find((e) => e.id === cg.elementoId);
          if (!fonte || tipo(fonte) === 'pilar' || modelados.has(fonte.id) || (fonte.modulo === 'concreto.viga' && fonte.posicao)) continue;
          try {
            const r = contextoCalculo(projeto, registro, [pl.id]).cargasDe(cg.elementoId, cg.ligacao);
            if (r.g) { cargas.push({ no: topo.id, Fz: -r.g, caso: 'G' }); soma.G += r.g; }
            if (r.q) { cargas.push({ no: topo.id, Fz: -r.q, caso: 'Q' }); soma.Q += r.q; }
            avisos.push(`${pl.codigo}: reação de ${fonte.codigo} aplicada como carga no topo (o elemento não está no pórtico).`);
          } catch { /* ligação inválida: o cálculo do pilar avisa */ }
        }
      }
      topos.push({ p: c, id: topo.id, pilarId: pl.id });
      infoPilar.set(pl.id, { barra: barra.id, pav: pav.id, fundacao, codigo: pl.codigo });
    }
    if (lista.length >= 2) diafragmas.push({ nos: lista.map((q) => q.id) });
    resumoPav.push({ id: pav.id, nome: pav.nome, cota: pav.cota, G: r3(soma.G), Q: r3(soma.Q) });
  });

  if (!barras.length) return { erro: 'Não há vigas nem pilares de concreto posicionados.', pilares: new Map(), pavimentos: resumoPav, avisos };
  // nós que não ficaram ligados a nenhuma barra (nível só com nós soltos) saem do modelo
  const usados = new Set(barras.flatMap((b) => [b.i, b.j]));
  const nosModelo = nos.filter((n) => usados.has(n.id));
  const modelo = {
    tipo: 'espacial', material: { E: mat.E, nu: mat.nu }, nos: nosModelo, barras,
    cargas: [...cargas, { no: nosModelo[0].id, Fz: 0, caso: 'G' }, { no: nosModelo[0].id, Fz: 0, caso: 'Q' }],
    diafragmas: diafragmas.map((d) => ({ nos: d.nos.filter((id) => usados.has(id)) })).filter((d) => d.nos.length >= 2),
  };
  // ---------------------------------------------------------- ações horizontais: vento e desaprumo (11.3.3.4.1)
  // uma força por pavimento em cada direção, com a resultante no centro da planta (diafragma rígido)
  let vento = null;
  if (parametrosVento(projeto).ativo) {
    vento = ventoDoProjeto(projeto, registro);
    if (vento.erro) avisos.push(`Vento: ${vento.erro}`);
  }
  const zBase = Math.min(...nosModelo.map((n) => n.z));
  const nosDoNivel = (pavId) => (nosPorPav.get(pavId) ?? []).filter((q) => usados.has(q.id));
  const nPilares = [...infoPilar.values()].filter((q) => q.fundacao).length;
  const horiz = acoesHorizontais({
    projeto, niveis: resumoPav.filter((pv) => pv.cota > zBase + 1e-9 && nosDoNivel(pv.id).length),
    zBase, vento: vento && !vento.erro ? vento : null, nPilares,
  });
  for (const a of horiz.avisos) avisos.push(a);
  const planta = vento && !vento.erro ? vento.planta : plantaDoEdificio(projeto, registro);
  const centro = planta?.centro ?? [0, 0];
  const noDeAplicacao = new Map(); // pavId → nó mais próximo do centro da planta
  for (const nv of horiz.niveis) {
    const lista = nosDoNivel(nv.id);
    noDeAplicacao.set(nv.id, lista.reduce((a, q) => (dist(q.p, centro) < dist(a.p, centro) ? q : a), lista[0]));
  }
  /** Cargas nodais de uma distribuição de forças por nível ({ id, Fx, Fy }) num caso e num ângulo. */
  const cargasHorizontais = (forcas, caso, angulo) => forcas.flatMap((f) => {
    const m = noDeAplicacao.get(f.id);
    if (!m) return [];
    const r = (angulo * Math.PI) / 180;
    const Fx = Math.round(Math.cos(r)) * f.Fx, Fy = Math.round(Math.sin(r)) * f.Fy;
    const Mz = (centro[0] - m.p[0]) * Fy - (centro[1] - m.p[1]) * Fx;
    return [{ no: m.id, Fx, Fy, Mz, caso }];
  });
  if (vento && !vento.erro) {
    for (const pv of vento.pavimentos) {
      if (noDeAplicacao.has(pv.id)) pv.no = noDeAplicacao.get(pv.id).id;
      else avisos.push(`Vento: ${pv.nome} não tem nós no pórtico — força não aplicada.`);
    }
  }
  if (horiz.casos) for (const cv of CASOS_VENTO) modelo.cargas.push(...cargasHorizontais(horiz.forcas, cv.id, cv.angulo));
  const res = analisarPortico(modelo);
  avisos.push(...res.avisos.filter((a) => !/sem rigidez/.test(a)));

  // ---------------------------------------------------------- estabilidade global: α (rigidez bruta) e γz (rigidez reduzida)
  const pilarBarras = new Set([...infoPilar.values()].map((q) => q.barra));
  const estabilidade = analisarEstabilidade({
    projeto, modelo, pilarBarras, horiz, nosDoNivel, zBase,
    cargasHX: cargasHorizontais(horiz.forcasEstabilidade, 'HX', 0), cargasHY: cargasHorizontais(horiz.forcasEstabilidade, 'HY', 90),
  });
  for (const a of estabilidade.avisos) avisos.push(a);
  const idx = new Map(res.barras.map((b, k) => [b.id, k]));

  // ---------------------------------------------------------- esforços por pilar (eixos do pilar: Mx com bx, My com by)
  const pilares = new Map();
  for (const [elId, inf] of infoPilar) {
    const k = idx.get(inf.barra);
    const ponta = (caso, x) => {
      const rb = res.porCaso[caso].barras[k]._rb;
      const e = esforcosNaSecao(rb, x);
      return { N: -e.N, Mx: e.Mz, My: e.My, Vx: e.Vy, Vy: e.Vz };
    };
    const L = res.barras[k].L;
    const porCaso = Object.fromEntries(res.casos.filter((c) => c !== 'C').map((c) => [c, { base: ponta(c, 0), topo: ponta(c, L) }]));
    pilares.set(elId, { ...inf, L, porCaso });
  }
  // prumadas: pilares ligados topo → base, de baixo para cima
  const baseDe = new Map(barras.map((b) => [b.id, b.i])), topoDe = new Map(barras.map((b) => [b.id, b.j]));
  for (const [, inf] of pilares) {
    let atual = inf, cadeia = [inf];
    for (let g = 0; g < 200; g++) { const abaixo = [...pilares.values()].find((q) => topoDe.get(q.barra) === baseDe.get(atual.barra)); if (!abaixo) break; cadeia.unshift(abaixo); atual = abaixo; }
    atual = inf;
    for (let g = 0; g < 200; g++) { const acima = [...pilares.values()].find((q) => baseDe.get(q.barra) === topoDe.get(atual.barra)); if (!acima) break; cadeia.push(acima); atual = acima; }
    inf.prumada = cadeia.map((q) => q.barra);
  }

  const total = (caso) => r3(-res.porCaso[caso].equilibrio.cargas[2]);
  const reac = (caso) => r3(res.porCaso[caso].equilibrio.reacoes[2]);
  return {
    resultado: res, modelo, pilares, avisos, vento, horizontais: horiz, estabilidade, combinacoes: estabilidade.combinacoes,
    pavimentos: resumoPav,
    totais: { cargasG: total('G'), cargasQ: total('Q'), reacoesG: reac('G'), reacoesQ: reac('Q'), somaPavG: r3(resumoPav.reduce((s, p) => s + p.G, 0)), somaPavQ: r3(resumoPav.reduce((s, p) => s + p.Q, 0)) },
    fatorTorcao: FATOR_TORCAO_GRELHA,
  };
}

/**
 * Esforços de cálculo de um lance pela combinação que dá a maior normal (envoltória ELU no Nd).
 * @returns {{comb:string, Nd:number, Mx:{topo,base}, My:{topo,base}, Ng:number, Nq:number}}
 */
export function esforcosDeCalculo(lance, combinacoes) {
  const elu = doTipo(combinacoes, 'ELU');
  const valores = (ponta, k) => Object.fromEntries(Object.entries(lance.porCaso).map(([c, v]) => [c, v[ponta][k]]));
  const nMax = extremo(elu, valores('base', 'N'));
  return { ...esforcosNaCombinacao(lance, combinacoes.find((c) => c.id === nMax.id)), Ng: lance.porCaso.G.base.N, Nq: lance.porCaso.Q.base.N };
}

/** Esforços de cálculo de um lance numa combinação (N na base, momentos no topo e na base). */
export function esforcosNaCombinacao(lance, comb) {
  const v = (ponta, k) => combinar(comb.fatores, Object.fromEntries(Object.entries(lance.porCaso).map(([c, x]) => [c, x[ponta][k]])));
  return {
    comb: comb.id, Nd: v('base', 'N'),
    Mx: { topo: v('topo', 'Mx'), base: v('base', 'Mx') },
    My: { topo: v('topo', 'My'), base: v('base', 'My') },
  };
}

/** Pórtico visto por um pilar: o lance dele e a prumada inteira (para o resultado do pilar). */
export function porticoDoPilar(el, ctx) {
  if (!el.posicao?.pavimento || !ctx.projeto) return null;
  const registro = { obter: (id) => ctx.modulo(id) };
  const g = porticoDoEdificio(ctx.projeto, registro);
  if (g.erro) return { erro: g.erro };
  const inf = g.pilares.get(el.id);
  if (!inf) return { erro: 'O pilar não entrou no pórtico.' };
  const comb = g.combinacoes ?? contextoConcreto(ctx.projeto.parametros).combinacoesGlobais;
  const porBarra = new Map([...g.pilares.values()].map((q) => [q.barra, q]));
  const pavNome = (id) => ctx.projeto.pavimentos.find((p) => p.id === id)?.nome ?? id;
  const lance = (q) => ({ barra: q.barra, codigo: q.codigo, pavimento: pavNome(q.pav), L: r3(q.L), fundacao: q.fundacao, porCaso: q.porCaso, calculo: esforcosDeCalculo(q, comb), atual: q.barra === inf.barra });
  const combinacoes = comb;
  return {
    lance: lance(inf),
    prumada: inf.prumada.map((b) => lance(porBarra.get(b))).reverse(), // de cima para baixo
    totais: g.totais, pavimentos: g.pavimentos, avisos: g.avisos, combinacoes,
    vento: g.vento && !g.vento.erro ? { forcas: g.vento.pavimentos.map(({ nome, z, Fx, Fy }) => ({ nome, z: r3(z), Fx: r3(Fx), Fy: r3(Fy) })), totais: { Fx: r3(g.vento.totais.Fx), Fy: r3(g.vento.totais.Fy) } } : null,
    horizontais: g.horizontais?.casos ? { lista: g.horizontais.lista, acao: { x: g.horizontais.direcoes.x.acao, y: g.horizontais.direcoes.y.acao } } : null,
    estabilidade: resumoEstabilidade(g.estabilidade, g.horizontais),
  };
}

/** Resumo da estabilidade global para o resultado dos pilares. */
export function resumoEstabilidade(e, horiz) {
  if (!e || !e.x) return null;
  const dp = horiz?.desaprumo;
  const d = (x) => x && !x.erro ? { alfa: r3(x.alfa), alfa1: r3(x.alfa1), gz: Number.isFinite(x.gz) ? r3(x.gz) : null, classe: x.classe, fator: r3(x.fator), comb: x.comb, acao: x.acao } : { erro: x?.erro ?? '—' };
  return {
    x: d(e.x), y: d(e.y), nNiveis: e.nNiveis, nPilares: e.nPilares, H: r3(e.H), Nk: r3(e.Nk), rigidez: e.parametros.rigidez,
    desaprumo: dp ? { theta1: Math.round(dp.theta1 * 1e6) / 1e6, thetaA: Math.round(dp.thetaA * 1e6) / 1e6, n: dp.n } : null,
    avisos: e.avisos, notas: e.notas,
  };
}
