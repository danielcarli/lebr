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
 * Grelha de pavimento (NBR 6118, 14.7.6): as vigas de concreto de um pavimento analisadas juntas,
 * como uma grelha de barras no plano, com o motor de pórtico (engine/portico.js, tipo 'grelha').
 *
 * Modelo:
 *   - nós nos apoios de cada viga, nos cruzamentos entre vigas e onde uma viga se apoia em outra;
 *   - barras com a seção b × h de cada viga, Ecs do concreto do projeto e rigidez à torção reduzida
 *     a 15 % da elástica (fissuração; NBR 6118, 14.7.6.2 — conferir);
 *   - apoio de viga sobre pilar: apoio vertical com molas de rotação iguais à rigidez dos lances do
 *     pilar, 4·E·I/ℓ para baixo e para cima (engastamento elástico, 14.6.7.1); com "engaste" declarado
 *     na viga, rotações impedidas;
 *   - apoio de viga sobre outra viga (sem pilar no ponto): nó comum, sem apoio — a reação passa de uma
 *     viga para a outra;
 *   - cruzamento definido (core/cruzamentos.js): "A apoia em B" põe rótula em A no nó (A descarrega em B, que
 *     passa contínua); "sem transferência" não cria nó comum;
 *   - apoio declarado sem pilar e sem outra viga (parede, por exemplo): apoio vertical que impede o giro
 *     da viga em torno do próprio eixo (como na viga isolada), sem impedir a flexão;
 *   - cargas: as mesmas das vigas isoladas, por caso (G e Q): peso próprio, distribuídas, paredes,
 *     concentradas, reações das lajes e torção dos balanços (com o sentido dado pelo lado da laje).
 *
 * Para cada viga devolve os esforços nos mesmos pontos e no mesmo formato do solver de vigas contínuas
 * (engine/viga-solver.js), de modo que o dimensionamento continua igual.
 */
import { analisarPortico, esforcosNaSecao, propriedadesMaterial } from '../../engine/portico.js';
import { contextoCalculo } from '../../renderer/core/calculo.js';
import { eixoViga, tipoDe, secaoPilar, centroPilar, cantosLaje, pavimento, pavimentoAbaixo, pavimentosOrdenados, TOLERANCIA } from '../../renderer/core/montagem.js';
import { montarCasos } from '../concreto-viga/calculo.js';
import { cruzamentosDoPavimento } from '../../renderer/core/cruzamentos.js';

export const FATOR_TORCAO_GRELHA = 0.15;
export const MODOS_ANALISE = [
  { valor: 'isolada', texto: 'Vigas isoladas', dica: 'Cada viga como viga contínua sobre apoios rígidos' },
  { valor: 'grelha', texto: 'Grelha', dica: 'Vigas do pavimento juntas: viga apoiada em viga e engastamento elástico nos pilares' },
];

/** Modo de análise das vigas de um pavimento: 'isolada' (padrão) ou 'grelha'. */
export const modoDoPavimento = (projeto, pavId) => (pavimento(projeto, pavId)?.analise === 'grelha' ? 'grelha' : 'isolada');

const PASSOS_VAO = 40;
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2).replace('.', ',') : '—');

/* ------------------------------------------------------------------ cache */

const cache = new Map(); // chave → resultado (poucas entradas: pavimentos recentes)
function chaveDe(projeto, pavId) {
  const els = projeto.elementos
    .filter((e) => e.posicao && (e.posicao.pavimento === pavId || e.posicao.pavimento === acimaDe(projeto, pavId)?.id))
    .map(({ resultado, ...resto }) => resto); // eslint-disable-line no-unused-vars
  // cargas de elementos de outros pavimentos (lajes sem posição, por exemplo) também entram
  const refs = new Set(els.flatMap((e) => (Array.isArray(e.cargas) ? e.cargas : []).filter((c) => c?.tipo === 'elemento').map((c) => c.elementoId)));
  const extra = projeto.elementos.filter((e) => refs.has(e.id) && !els.some((x) => x.id === e.id)).map(({ resultado, ...resto }) => resto); // eslint-disable-line no-unused-vars
  return JSON.stringify([pavId, projeto.parametros, projeto.pavimentos, els, extra]);
}
function acimaDe(projeto, pavId) {
  const ord = pavimentosOrdenados(projeto);
  const i = ord.findIndex((p) => p.id === pavId);
  return i >= 0 ? ord[i + 1] ?? null : null;
}

/**
 * Grelha do pavimento (com cache). Nunca lança erro: devolve { erro } quando não dá para montar.
 * @param {object} projeto
 * @param {string} pavId
 * @param {{obter(id:string):object}} registro
 */
export function grelhaDoPavimento(projeto, pavId, registro) {
  const chave = chaveDe(projeto, pavId);
  if (cache.has(chave)) return cache.get(chave);
  let r;
  try { r = montarEResolver(projeto, pavId, registro); } catch (err) { r = { erro: err.message, vigas: [] }; }
  cache.set(chave, r);
  if (cache.size > 12) cache.delete(cache.keys().next().value);
  return r;
}

/* ------------------------------------------------------------------ montagem do modelo */

/**
 * Vigas de concreto de um pavimento como barras: nós em planta (apoios, cruzamentos, encontros), apoios
 * (pilar, outra viga, apoio declarado) e barras com as cargas de cada caso. Usado pela grelha e pelo
 * pórtico espacial do edifício.
 */
export function montarVigasDoPavimento(projeto, pavId, registro) {
  const avisos = [];
  const tipo = (e) => tipoDe(e, registro);
  const doPav = projeto.elementos.filter((e) => e.posicao?.pavimento === pavId);
  const vigas = doPav.filter((e) => e.modulo === 'concreto.viga' && (e.vaos ?? []).length);
  const outrasVigas = doPav.filter((e) => tipo(e) === 'viga' && e.modulo !== 'concreto.viga');
  if (outrasVigas.length) avisos.push(`Vigas de outros materiais (${outrasVigas.map((e) => e.codigo).join(', ')}) ficam fora da grelha e continuam isoladas.`);
  if (!vigas.length) return { erro: 'Não há vigas de concreto posicionadas neste pavimento.', vigas: [], avisos, nos: [], dados: [], barras: [], apoioDe: new Map() };
  const pilares = doPav.filter((e) => tipo(e) === 'pilar');
  const acima = acimaDe(projeto, pavId);
  const pilaresAcima = acima ? projeto.elementos.filter((e) => e.posicao?.pavimento === acima.id && tipo(e) === 'pilar') : [];
  const mat = propriedadesMaterial({ fck: projeto.parametros.concreto.fck, agregado: projeto.parametros.concreto.agregado });

  // ---------------------------------------------------------- nós
  const nos = []; // { id, p, vigas:Set }
  const noEm = (p) => {
    let n = nos.find((q) => dist(q.p, p) <= TOLERANCIA * 0.5);
    if (!n) { n = { id: `N${nos.length + 1}`, p, vigas: new Set() }; nos.push(n); }
    return n;
  };
  const dados = vigas.map((el) => {
    const eixo = eixoViga(el);
    const xs = eixo.apoios.map((_, k) => eixo.vaos[k]?.[0] ?? eixo.L);
    return { el, eixo, sApoios: xs, sNos: new Set(xs) };
  });
  // cruzamentos definidos (roteiro, etapa L3): "sem transferência" não cria nó comum; "A apoia em B" dá rótula em A
  const cruz = new Map(cruzamentosDoPavimento(projeto, registro, pavId).map((c) => [`${c.a.id}|${c.b.id}`, c]));
  const cruzDe = (x, y) => cruz.get(`${x}|${y}`) ?? cruz.get(`${y}|${x}`);
  // cruzamentos e encontros (com tolerância nas pontas)
  for (let a = 0; a < dados.length; a++) {
    for (let b = a + 1; b < dados.length; b++) {
      if (cruzDe(dados[a].el.id, dados[b].el.id)?.sem) continue;
      const A = dados[a].eixo, B = dados[b].eixo;
      const den = A.u[0] * B.u[1] - A.u[1] * B.u[0];
      if (Math.abs(den) < 1e-6) continue; // paralelas
      const dx = B.a[0] - A.a[0], dy = B.a[1] - A.a[1];
      const t = (dx * B.u[1] - dy * B.u[0]) / den;
      const r = (dx * A.u[1] - dy * A.u[0]) / den;
      if (t < -TOLERANCIA || t > A.L + TOLERANCIA || r < -TOLERANCIA || r > B.L + TOLERANCIA) continue;
      dados[a].sNos.add(Math.max(0, Math.min(A.L, t)));
      dados[b].sNos.add(Math.max(0, Math.min(B.L, r)));
    }
  }
  for (const d of dados) {
    const lista = [...d.sNos].sort((x, y) => x - y).filter((s, k, arr) => k === 0 || s - arr[k - 1] > 0.02);
    d.pontos = lista.map((s) => {
      const p = [d.eixo.a[0] + d.eixo.u[0] * s, d.eixo.a[1] + d.eixo.u[1] * s];
      const n = noEm(p);
      n.vigas.add(d.el.id);
      return { s, no: n };
    });
    d.noDoApoio = d.sApoios.map((s) => d.pontos.reduce((m, q) => (Math.abs(q.s - s) < Math.abs(m.s - s) ? q : m), d.pontos[0]).no);
  }

  // ---------------------------------------------------------- apoios
  const pilarEm = (p, lista) => lista.find((pl) => { const { bx, by } = secaoPilar(pl); return dist(p, centroPilar(pl)) <= Math.max(TOLERANCIA, Math.max(bx, by) / 200); });
  const apoioDe = new Map(); // nó → { uz, engaste, pilar, eixos }
  const temApoioNoNo = (vigaId, n) => { const d = dados.find((x) => x.el.id === vigaId); return d.noDoApoio.some((m, k) => m === n && d.el.apoios[k] !== 'livre'); };
  for (const d of dados) {
    d.tipoApoio = d.el.apoios.map(() => null);
    d.el.apoios.forEach((tp, k) => {
      if (tp === 'livre') return;
      const n = d.noDoApoio[k];
      const pl = pilarEm(n.p, pilares);
      // outras vigas que passam pelo nó (ou o têm como extremidade livre): esta viga se apoia nelas
      const outras = [...n.vigas].filter((id) => id !== d.el.id && !temApoioNoNo(id, n));
      const a = apoioDe.get(n) ?? { uz: false, engaste: false, pilar: null, eixos: [] };
      if (pl) {
        a.uz = true; a.pilar = pl; d.tipoApoio[k] = { tipo: 'pilar', pilar: pl.codigo };
      } else if (outras.length) {
        d.tipoApoio[k] = { tipo: 'viga', vigas: outras };
        if (tp === 'engaste') avisos.push(`${d.el.codigo}, apoio ${k + 1}: "engaste" sobre outra viga — na grelha vale a continuidade com ${outras.map((id) => vigas.find((v) => v.id === id)?.codigo).join(', ')}.`);
        apoioDe.set(n, a);
        return;
      } else {
        a.uz = true; d.tipoApoio[k] = { tipo: 'apoio' };
      }
      if (tp === 'engaste') a.engaste = true;
      a.eixos.push(d.eixo.u);
      apoioDe.set(n, a);
    });
  }
  // ---------------------------------------------------------- cruzamentos com apoio definido: rótula na viga apoiada
  const rotulas = new Map(); // viga id → Set de nós com rótula
  for (const c of cruz.values()) {
    if (!c.apoiada || c.implicito) continue;
    const d = dados.find((x) => x.el.id === c.apoiada.id);
    const s = c.apoiada === c.a ? c.sa : c.sb;
    if (!d) continue;
    // a viga apoiada com apoio declarado no ponto continua contínua sobre a outra (apoio indireto)
    if (d.el.apoios?.some((t, k) => t !== 'livre' && Math.abs(d.sApoios[k] - s) <= TOLERANCIA)) continue;
    const pt = d.pontos.reduce((m, q) => (Math.abs(q.s - s) < Math.abs(m.s - s) ? q : m), d.pontos[0]);
    if (!rotulas.has(d.el.id)) rotulas.set(d.el.id, new Set());
    rotulas.get(d.el.id).add(pt.no.id);
  }

  // ---------------------------------------------------------- barras e cargas
  const barras = [];
  for (const d of dados) {
    const ctx = contextoCalculo(projeto, registro, [d.el.id]);
    const casos = montarCasos(d.el, ctx);
    d.casos = casos;
    const x0 = d.sApoios;
    const vaoDe = (s) => { let v = 0; for (let k = 0; k < d.el.vaos.length; k++) if (s >= x0[k] - 1e-9) v = k; return v; };
    const b = d.el.secao.b, h = d.el.secao.h;
    d.barras = [];
    for (let k = 0; k < d.pontos.length - 1; k++) {
      const P0 = d.pontos[k], P1 = d.pontos[k + 1];
      if (P0.no === P1.no) continue;
      const v = vaoDe((P0.s + P1.s) / 2);
      const Lb = dist(P0.no.p, P1.no.p);
      const cargas = [];
      if (casos.G.q[v]) cargas.push({ tipo: 'q', dir: 'Z', valor: -casos.G.q[v], caso: 'G' });
      if (casos.Q.q[v]) cargas.push({ tipo: 'q', dir: 'Z', valor: -casos.Q.q[v], caso: 'Q' });
      const id = `${d.el.codigo}·${d.barras.length + 1}`;
      const barra = { id, i: P0.no.id, j: P1.no.id, secao: { b, h }, fatorTorcao: FATOR_TORCAO_GRELHA, cargas, s0: P0.s, s1: P1.s, vao: v, Lb };
      const rot = rotulas.get(d.el.id);
      if (rot) { const ri = rot.has(P0.no.id), rj = rot.has(P1.no.id); if (ri || rj) barra.rotula = ri && rj ? 'ambas' : ri ? 'i' : 'j'; }
      d.barras.push(barra);
      barras.push(barra);
    }
    // concentradas
    for (const [caso, lista] of [['G', casos.G.P], ['Q', casos.Q.P]]) {
      for (const pc of lista) {
        if (!pc.P) continue;
        const s = x0[pc.vao] + pc.x;
        const br = d.barras.find((x) => x.vao === pc.vao && s >= x.s0 - 1e-9 && s <= x.s1 + 1e-9) ?? d.barras.find((x) => s >= x.s0 - 1e-9 && s <= x.s1 + 1e-9);
        if (br) br.cargas.push({ tipo: 'P', dir: 'Z', valor: -pc.P, a: ((s - br.s0) / (br.s1 - br.s0)) * br.Lb, caso });
      }
    }
    // torção distribuída, com o sentido pelo lado em que está a laje em balanço
    for (const tq of casos.torcoes) {
      let sinal = 1;
      if (tq.fonteId) {
        const laje = ctx.elemento(tq.fonteId);
        if (laje?.posicao) {
          const cs = cantosLaje(laje);
          const c = [cs.reduce((s, p) => s + p[0], 0) / 4, cs.reduce((s, p) => s + p[1], 0) / 4];
          const n = [-d.eixo.u[1], d.eixo.u[0]];
          const lado = (c[0] - d.eixo.a[0]) * n[0] + (c[1] - d.eixo.a[1]) * n[1];
          sinal = lado >= 0 ? -1 : 1; // laje à esquerda do eixo: torção no sentido −x local
        }
      }
      for (const br of d.barras.filter((x) => tq.vaos.includes(x.vao))) {
        if (tq.g) br.cargas.push({ tipo: 'mt', valor: sinal * tq.g, caso: 'G' });
        if (tq.q) br.cargas.push({ tipo: 'mt', valor: sinal * tq.q, caso: 'Q' });
      }
    }
  }
  return { avisos, vigas, pilares, pilaresAcima, mat, nos, dados, apoioDe, barras, pilarEm };
}

function montarEResolver(projeto, pavId, registro) {
  const base = montarVigasDoPavimento(projeto, pavId, registro);
  if (base.erro) return { erro: base.erro, vigas: [], avisos: base.avisos };
  const { avisos, vigas, pilaresAcima, mat, nos, dados, apoioDe, barras, pilarEm } = base;
  const nosModelo = nos.map((n) => {
    const a = apoioDe.get(n);
    const no = { id: n.id, x: n.p[0], y: n.p[1], z: 0 };
    if (!a?.uz) return no;
    no.apoio = a.engaste ? '001110' : '001000';
    if (a.engaste) return no;
    if (a.pilar?.modulo === 'concreto.pilar') {
      no.molasRot = molasDoPilar(a.pilar, pilarEm(n.p, pilaresAcima), mat.E);
    } else {
      // sem pilar de concreto: impede o giro em torno do eixo da viga se todas as vigas do nó forem paralelas
      const dirs = [...n.vigas].map((id) => dados.find((d) => d.el.id === id).eixo.u);
      const paralelas = dirs.every((u) => Math.abs(u[0] * dirs[0][1] - u[1] * dirs[0][0]) < 1e-6);
      if (paralelas) no.molasRot = [{ eixo: [dirs[0][0], dirs[0][1], 0], k: 1e9 }];
    }
    return no;
  });

  const modelo = { tipo: 'grelha', material: { E: mat.E, nu: mat.nu }, nos: nosModelo, barras: barras.map(({ s0, s1, vao, Lb, ...b }) => b) }; // eslint-disable-line no-unused-vars
  // garante os dois casos mesmo sem carga variável
  modelo.cargas = [{ no: nosModelo[0].id, Fz: 0, caso: 'G' }, { no: nosModelo[0].id, Fz: 0, caso: 'Q' }];
  const res = analisarPortico(modelo);
  avisos.push(...res.avisos);
  const idx = new Map(res.barras.map((b, k) => [b.id, k]));

  // ---------------------------------------------------------- resultados por viga
  const porViga = dados.map((d) => {
    const porCaso = (caso) => paraFormatoViga(d, res.porCaso[caso], idx);
    const rG = porCaso('G'), rQ = porCaso('Q');
    // nós compartilhados com outras vigas sem pilar nem apoio: força que as outras vigas aplicam nesta
    const interacoes = d.pontos.filter((pt) => pt.no.vigas.size > 1 && !apoioDe.get(pt.no)?.uz).map((pt) => {
      const outras = [...pt.no.vigas].filter((id) => id !== d.el.id).map((id) => vigas.find((v) => v.id === id)?.codigo);
      const forca = (caso) => forcaNoNo(d, pt.no.id, res.porCaso[caso], idx);
      const k = d.sApoios.findIndex((s) => Math.abs(s - pt.s) < 0.03);
      return { x: Math.round(pt.s * 1000) / 1000, no: pt.no.id, com: outras, Rg: forca('G'), Rq: forca('Q'), apoioDaViga: k >= 0 && d.el.apoios[k] !== 'livre' ? k : null };
    });
    return { id: d.el.id, codigo: d.el.codigo, rG, rQ, interacoes, tipoApoio: d.tipoApoio, barras: d.barras.map((b) => b.id) };
  });

  return {
    resultado: res, modelo, vigas: porViga, avisos,
    nos: nosModelo.map((n) => {
      const a = apoioDe.get(nos.find((q) => q.id === n.id));
      const vigasNo = [...nos.find((q) => q.id === n.id).vigas].map((id) => vigas.find((v) => v.id === id)?.codigo);
      return { id: n.id, x: n.x, y: n.y, vigas: vigasNo, apoio: a?.uz ? (a.engaste ? 'engaste' : a.pilar ? 'pilar' : 'apoio') : vigasNo.length > 1 ? 'viga' : null, pilar: a?.pilar?.codigo ?? null, molasRot: n.molasRot ?? null };
    }),
    barrasDesenho: barras.map((b) => ({ id: b.id, i: b.i, j: b.j })),
    fatorTorcao: FATOR_TORCAO_GRELHA,
  };
}

/** Molas de rotação do pilar (kN·m/rad) nos eixos da seção: Σ 4·E·I/ℓ dos lances abaixo e acima. */
function molasDoPilar(pilar, acima, E) {
  const molas = [];
  const ang = ((pilar.posicao?.angulo ?? 0) * Math.PI) / 180;
  const ea = [Math.cos(ang), Math.sin(ang), 0], eb = [-Math.sin(ang), Math.cos(ang), 0];
  const contrib = (pl) => {
    if (!pl || pl.modulo !== 'concreto.pilar') return [0, 0];
    const { bx, by, D } = secaoPilar(pl);
    const l = pl.comprimento ?? 3;
    // giro em torno do eixo de bx: flexão com a dimensão by; em torno do eixo de by: com bx (m⁴); círculo: πD⁴/64
    const Ic = D ? (Math.PI * (D / 100) ** 4) / 64 : null;
    const Ia = Ic ?? ((bx / 100) * (by / 100) ** 3) / 12, Ib = Ic ?? ((by / 100) * (bx / 100) ** 3) / 12;
    return [(4 * E * Ia) / l, (4 * E * Ib) / l];
  };
  const [ka1, kb1] = contrib(pilar), [ka2, kb2] = contrib(acima);
  if (ka1 + ka2 > 0) molas.push({ eixo: ea, k: ka1 + ka2 });
  if (kb1 + kb2 > 0) molas.push({ eixo: eb, k: kb1 + kb2 });
  return molas;
}

/** Força vertical (kN, para cima) que os nós aplicam nas barras desta viga num nó. */
function forcaNoNo(d, noId, rc, idx) {
  let s = 0;
  for (const b of d.barras) {
    const F = rc.barras[idx.get(b.id)].forcasExtremidade;
    if (b.i === noId) s += F[1];
    if (b.j === noId) s += F[7];
  }
  return Math.round(s * 1000) / 1000;
}

/** Converte o resultado de um caso no formato do solver de vigas contínuas (pontos, reações). */
function paraFormatoViga(d, rc, idx) {
  const el = d.el;
  const pontos = [];
  const amostra = (s, lado) => {
    // lado: 'esq' usa a barra que termina em s, 'dir' a que começa em s
    const lista = d.barras;
    let b = lado === 'esq' ? lista.find((x) => s > x.s0 + 1e-9 && s <= x.s1 + 1e-9) : lista.find((x) => s >= x.s0 - 1e-9 && s < x.s1 - 1e-9);
    b ??= lista.find((x) => s >= x.s0 - 1e-9 && s <= x.s1 + 1e-9);
    if (!b) return null;
    const rb = rc.barras[idx.get(b.id)]._rb;
    let xl = ((s - b.s0) / (b.s1 - b.s0)) * b.Lb;
    if (lado === 'esq-p') xl = Math.max(0, xl - 1e-9);
    return esforcosNaSecao(rb, Math.max(0, Math.min(b.Lb, xl)));
  };
  el.vaos.forEach((vv, v) => {
    const x0 = d.sApoios[v], L = vv.L;
    const marcas = [];
    for (let k = 0; k <= PASSOS_VAO; k++) marcas.push({ x: (L * k) / PASSOS_VAO, lado: k === 0 ? 'dir' : k === PASSOS_VAO ? 'esq' : 'dir' });
    // nós internos do vão (vigas que se apoiam nesta): valor dos dois lados
    for (const pt of d.pontos) if (pt.s > x0 + 1e-6 && pt.s < x0 + L - 1e-6) marcas.push({ x: pt.s - x0, lado: 'esq' }, { x: pt.s - x0, lado: 'dir' });
    // cargas concentradas: valor dos dois lados
    for (const lista of [d.casos.G.P, d.casos.Q.P]) for (const pc of lista) if (pc.vao === v && pc.x > 1e-6 && pc.x < L - 1e-6) marcas.push({ x: pc.x, lado: 'esq-p' }, { x: pc.x, lado: 'dir' });
    const vistos = new Set();
    marcas.sort((a, b) => a.x - b.x || (a.lado.startsWith('esq') ? -1 : 1));
    for (const m of marcas) {
      const chave = `${m.x.toFixed(6)}|${m.lado}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      const e = amostra(x0 + m.x, m.lado);
      if (!e) continue;
      pontos.push({ x: x0 + m.x, vao: v, V: e.Vy, M: e.Mz, T: e.T, v: 0 });
    }
  });
  const reacoes = el.apoios.map((tp, k) => ({ V: tp === 'livre' ? 0 : forcaNoNo(d, d.noDoApoio[k].id, rc, idx) }));
  return { pontos, reacoes, grelha: true };
}

/** Grelha do pavimento de uma viga, no contexto de cálculo do módulo (ou null se a viga não estiver posicionada). */
export function grelhaDaViga(el, ctx) {
  if (!el.posicao?.pavimento || !ctx.projeto) return null;
  const registro = { obter: (id) => ctx.modulo(id) };
  const g = grelhaDoPavimento(ctx.projeto, el.posicao.pavimento, registro);
  const v = g.vigas?.find((x) => x.id === el.id) ?? null;
  return { modo: modoDoPavimento(ctx.projeto, el.posicao.pavimento), erro: g.erro ?? null, viga: v, avisos: g.avisos ?? [], fatorTorcao: FATOR_TORCAO_GRELHA };
}

/** Texto curto de uma interação (para o memorial). */
export function textoInteracao(it, codigo) {
  const sentido = it.Rg + it.Rq >= 0 ? `${codigo} se apoia em ${it.com.join(', ')}` : `${it.com.join(', ')} descarrega em ${codigo}`;
  return `x = ${f2(it.x)} m: ${sentido} — força g = ${f2(Math.abs(it.Rg))} kN · q = ${f2(Math.abs(it.Rq))} kN`;
}
