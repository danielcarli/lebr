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
 * Pré-dimensionamento no lançamento (roteiro, etapa L8): regras práticas para o primeiro palpite de seção, antes do
 * cálculo — o cálculo de cada elemento continua sendo a verificação.
 *   - viga: h = L/10 (um vão), L/12 (contínua) ou L/5 (balanço), pelo maior vão, em múltiplos de 5 cm; b mantido;
 *   - laje maciça: h = máx(Lx/40, mínimo da NBR 6118, 13.2.4.1: 8 cm de piso, 10 cm em balanço), em cm inteiros;
 *   - pilar: área de influência Ai (metade da distância aos pilares vizinhos em cada direção), Nk = q·Ai·n com n
 *     pavimentos acima, Ac = γ·Nk / (0,85·fcd + ρ·σs,0,2%), γ = 1,8 (interno), 2,2 (extremidade) ou 2,5 (canto),
 *     ρ = 1,5 %; mantém o lado menor (≥ 19 cm) e acha o maior em múltiplos de 5 cm (nunca diminui a seção atual).
 * Fontes: Pinheiro, Fundamentos do concreto e projeto de edifícios (EESC-USP, 2007), cap. 5; Bastos, Pilares de
 * concreto armado (UNESP, 2017); NBR 6118:2023, 13.2.3 e 13.2.4.1.
 */
import { tipoDe, centroPilar, pavimentosOrdenados } from './montagem.js';
import { parametrosDoElemento } from './criterios.js';

const para5 = (cm) => Math.ceil(cm / 5 - 1e-9) * 5;
const fmt = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');

/** Carga média por pavimento (kN/m²) usada na área de influência, por uso do projeto. */
export const CARGA_POR_AREA = { residencial: 12, comercial: 13, garagem: 15 };

export function sugerirViga(el) {
  const vaos = (el.vaos ?? []).map((v) => v.L ?? 0);
  if (!vaos.length) return null;
  const ap = el.apoios ?? [];
  // vão em balanço: uma das pontas livre
  const balancos = vaos.map((_, k) => ap[k] === 'livre' || ap[k + 1] === 'livre');
  const internos = vaos.filter((_, k) => !balancos[k]);
  const continua = internos.length > 1;
  const cands = [];
  for (let k = 0; k < vaos.length; k++) {
    const L = vaos[k] * 100;
    if (balancos[k]) cands.push({ h: L / 5, regra: `balanço L/5 = ${fmt(vaos[k])} m / 5` });
    else cands.push({ h: L / (continua ? 12 : 10), regra: `${continua ? 'contínua' : 'um vão'} L/${continua ? 12 : 10} = ${fmt(vaos[k])} m / ${continua ? 12 : 10}` });
  }
  const pior = cands.reduce((m, c) => (c.h > m.h ? c : m));
  const h = Math.max(25, para5(pior.h));
  const b = el.secao?.b ?? 20;
  return { tipo: 'viga', secao: { b, h }, texto: `h = ${h} cm (${pior.regra} = ${fmt(pior.h / 100)} m, em múltiplos de 5 cm)` };
}

export function sugerirLaje(el) {
  if (el.lx == null) {
    // lajes em uma direção: o fabricante dá a altura pela tabela da vigota; a regra serve só de referência
    const L = el.L ?? 0;
    return { tipo: 'laje', h: null, texto: `Laje em uma direção: altura pela tabela do fabricante (referência: L/25 = ${fmt((L * 100) / 25, 0)} cm).` };
  }
  const lx = Math.min(el.lx, el.ly);
  const balanco = Object.values(el.bordas ?? {}).includes('livre');
  const minimo = balanco ? 10 : 8;
  const regra = (lx * 100) / 40;
  const h = Math.max(minimo, Math.ceil(regra - 1e-9));
  return { tipo: 'laje', h, texto: `h = ${h} cm (máx(Lx/40 = ${fmt(regra, 1)} cm; mínimo de ${minimo} cm ${balanco ? 'em balanço' : 'de piso'}, NBR 6118, 13.2.4.1))` };
}

/** Área de influência do pilar (m²) e a posição dele na planta (interno, extremidade ou canto). */
export function areaDeInfluencia(projeto, registro, pilar) {
  const [x, y] = centroPilar(pilar);
  const outros = projeto.elementos.filter((e) => e.id !== pilar.id && e.posicao?.pavimento === pilar.posicao?.pavimento && tipoDe(e, registro) === 'pilar').map(centroPilar);
  const alinhado = 0.6; // m — tolerância para "na mesma linha"
  const viz = (dir) => {
    const ds = outros.map(([ox, oy]) => (dir === 'x+' ? (Math.abs(oy - y) <= alinhado && ox > x ? ox - x : null)
      : dir === 'x-' ? (Math.abs(oy - y) <= alinhado && ox < x ? x - ox : null)
        : dir === 'y+' ? (Math.abs(ox - x) <= alinhado && oy > y ? oy - y : null)
          : (Math.abs(ox - x) <= alinhado && oy < y ? y - oy : null))).filter((d) => d != null);
    return ds.length ? Math.min(...ds) : null;
  };
  const d = { xp: viz('x+'), xm: viz('x-'), yp: viz('y+'), ym: viz('y-') };
  const ax = ((d.xp ?? 0) + (d.xm ?? 0)) / 2, ay = ((d.yp ?? 0) + (d.ym ?? 0)) / 2;
  const faltaX = (d.xp == null) + (d.xm == null), faltaY = (d.yp == null) + (d.ym == null);
  const posicao = faltaX && faltaY ? 'canto' : faltaX || faltaY ? 'extremidade' : 'interno';
  return { Ai: ax * ay, ax, ay, posicao };
}

/** Pavimentos que o pilar sustenta: o dele e todos os de cima onde há pilar no mesmo prumo. */
function pavimentosSustentados(projeto, registro, pilar) {
  const ord = pavimentosOrdenados(projeto);
  const i = ord.findIndex((p) => p.id === pilar.posicao?.pavimento);
  if (i < 0) return 1;
  const [x, y] = centroPilar(pilar);
  let n = 1;
  for (let k = i + 1; k < ord.length; k++) {
    const temAcima = projeto.elementos.some((e) => e.posicao?.pavimento === ord[k].id && tipoDe(e, registro) === 'pilar' && Math.hypot(centroPilar(e)[0] - x, centroPilar(e)[1] - y) <= 0.3);
    if (!temAcima) break;
    n++;
  }
  return n;
}

export const GAMA_POSICAO = { interno: 1.8, extremidade: 2.2, canto: 2.5 };

export function sugerirPilar(projeto, registro, el, { q = CARGA_POR_AREA[projeto.parametros?.uso] ?? 12, rho = 0.015 } = {}) {
  const { Ai, ax, ay, posicao } = areaDeInfluencia(projeto, registro, el);
  if (!(Ai > 0)) return { tipo: 'pilar', bx: null, by: null, texto: 'Sem pilares vizinhos alinhados nas duas direções: não há área de influência para estimar.' };
  const n = pavimentosSustentados(projeto, registro, el);
  const Nk = q * Ai * n; // kN
  const gama = GAMA_POSICAO[posicao];
  const par = parametrosDoElemento(projeto.parametros, el);
  const fck = par.concreto?.fck ?? 25;
  const fcd = fck / 10 / (par.coeficientes?.gc ?? 1.4); // kN/cm²
  const sigma = 0.85 * fcd + rho * 42; // σs a 0,2 % no CA-50: 42 kN/cm²
  const Ac = Math.max(360, (gama * Nk) / sigma); // cm² (mínimo da NBR 6118, 13.2.3)
  // a regra não diminui a seção: se a atual já tem a área, fica como está
  const atual = (el.bx ?? 20) * (el.by ?? 20);
  if (atual >= Ac - 1e-9) {
    return { tipo: 'pilar', bx: el.bx, by: el.by, Ai, n, Nk, gama, Ac, posicao,
      texto: `${el.bx} × ${el.by} cm já atende (Ac necessária ${fmt(Ac, 0)} cm² ≤ ${fmt(atual, 0)} cm²; Ai = ${fmt(Ai)} m², n = ${n}, Nk = ${fmt(Nk, 0)} kN, pilar ${posicao}, γ = ${fmt(gama, 1)})` };
  }
  const menor = Math.max(19, Math.min(el.bx ?? 20, el.by ?? 20));
  const maior = Math.max(menor, para5(Ac / menor));
  // mantém a orientação: o lado que já era o maior continua maior
  const [bx, by] = (el.bx ?? 20) <= (el.by ?? 20) ? [menor, maior] : [maior, menor];
  return {
    tipo: 'pilar', bx, by, Ai, n, Nk, gama, Ac, posicao,
    texto: `${bx} × ${by} cm (Ai = ${fmt(ax)} × ${fmt(ay)} = ${fmt(Ai)} m², n = ${n}, Nk = ${fmt(q, 0)} × ${fmt(Ai)} × ${n} = ${fmt(Nk, 0)} kN; pilar ${posicao}, γ = ${fmt(gama, 1)}; Ac = ${fmt(Ac, 0)} cm²)`,
  };
}

/** Sugestão para o elemento (viga, laje ou pilar de concreto), ou null. */
export function sugestaoDe(projeto, registro, el) {
  if (!String(el?.modulo).startsWith('concreto.')) return null;
  const t = tipoDe(el, registro);
  if (t === 'viga') return sugerirViga(el);
  if (t === 'laje') return sugerirLaje(el);
  if (t === 'pilar' && el.posicao) return sugerirPilar(projeto, registro, el);
  return null;
}

/** Aplica a sugestão (altera no lugar). @returns {boolean} se mudou algo */
export function aplicarSugestao(el, s) {
  if (!s) return false;
  let mudou = false;
  if (s.tipo === 'viga' && s.secao && (el.secao?.h !== s.secao.h || el.secao?.b !== s.secao.b)) { el.secao = { ...el.secao, ...s.secao }; mudou = true; }
  if (s.tipo === 'laje' && s.h && el.h !== s.h) { el.h = s.h; mudou = true; }
  if (s.tipo === 'pilar' && s.bx && (el.bx !== s.bx || el.by !== s.by)) { el.bx = s.bx; el.by = s.by; mudou = true; }
  if (mudou && el.resultado) el.resultado.desatualizado = true;
  return mudou;
}
