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
 * Seção de cada vão de uma viga: largura b, altura h (cm) e se o vão é invertido (laje apoiada na face inferior).
 *
 * Formato no arquivo: `secao: {b, h}` e `invertida` na viga valem para todos os vãos; cada vão pode trazer `b`, `h`
 * e `invertida` próprios, que prevalecem (`vaos: [{L: 5, h: 60}, {L: 3, invertida: true}]`). Arquivos antigos, sem
 * nada nos vãos, continuam com a seção constante.
 *
 * Níveis (cm), com 0 na face superior da laje (o piso): vão normal com o topo no piso e a base em −h; vão invertido
 * com a base na face inferior da laje (−hLaje) e o topo em h − hLaje.
 */

const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);

/** Seção do vão v: {b, h, invertida} (cm). */
export function secaoDoVao(el, v) {
  const vao = el?.vaos?.[v] ?? {};
  return {
    b: num(vao.b) ?? num(el?.secao?.b) ?? 15,
    h: num(vao.h) ?? num(el?.secao?.h) ?? 40,
    invertida: vao.invertida != null ? !!vao.invertida : !!el?.invertida,
  };
}

/** Seções de todos os vãos, com os níveis da face superior e inferior (cm, 0 no piso). */
export function secoesDaViga(el, { hLaje = 10 } = {}) {
  return (el?.vaos ?? []).map((_, v) => {
    const s = secaoDoVao(el, v);
    const base = s.invertida ? -hLaje : -s.h;
    return { ...s, base, topo: base + s.h };
  });
}

/** A viga tem algum vão com seção ou situação (invertida) diferente dos outros? */
export function secaoVariavel(el) {
  const ss = (el?.vaos ?? []).map((_, v) => secaoDoVao(el, v));
  return ss.some((s) => s.b !== ss[0].b || s.h !== ss[0].h || s.invertida !== ss[0].invertida);
}

/** Algum vão invertido? Todos? */
export function vaosInvertidos(el) {
  const inv = (el?.vaos ?? []).map((_, v) => secaoDoVao(el, v).invertida);
  return { algum: inv.some(Boolean), todos: inv.length > 0 && inv.every(Boolean), lista: inv };
}

/** Maior largura e maior altura entre os vãos (cm) — a "envoltória" da seção, para folgas e desenhos em planta. */
export function secaoEnvolvente(el) {
  const ss = (el?.vaos?.length ? el.vaos : [{}]).map((_, v) => secaoDoVao(el, v));
  return { b: Math.max(...ss.map((s) => s.b)), h: Math.max(...ss.map((s) => s.h)) };
}

/** Volume de concreto (m³) somando os vãos. */
export function volumeViga(el) {
  return (el?.vaos ?? []).reduce((s, v, k) => { const sc = secaoDoVao(el, k); return s + (sc.b * sc.h * (Number(v.L) || 0)) / 1e4; }, 0);
}

/**
 * Seção que vale no apoio k (momento negativo, cortante junto ao apoio): a menor entre os vãos vizinhos — a altura e a
 * largura menores, que são as que limitam a altura útil e o arranjo das barras.
 */
export function secaoNoApoio(secoes, k) {
  const viz = [secoes[k - 1], secoes[k]].filter(Boolean);
  return { b: Math.min(...viz.map((s) => s.b)), h: Math.min(...viz.map((s) => s.h)), invertida: viz.some((s) => s.invertida) };
}

/**
 * As faces da viga continuam alinhadas no apoio interno k? Uma face muda de nível quando a altura muda (topo fixo
 * no piso nas vigas normais, base fixa na laje nas invertidas) ou quando um vão é invertido e o outro não; a face
 * inferior também é tratada como interrompida quando a largura muda (as barras do vão mais largo não cabem no outro).
 * @returns {{superior: boolean, inferior: boolean}}  true = contínua
 */
export function facesContinuas(secoes, k, tol = 0.5) {
  const a = secoes[k - 1], c = secoes[k];
  if (!a || !c) return { superior: true, inferior: true };
  return {
    superior: Math.abs(a.topo - c.topo) <= tol,
    inferior: Math.abs(a.base - c.base) <= tol && Math.abs(a.b - c.b) <= tol,
  };
}

/** Rótulo curto da seção: "20 × 50 cm" ou, com vãos diferentes, "20 × 50 · 20 × 40 inv. cm". */
export function rotuloSecao(el, { sep = ' × ', casas = 0 } = {}) {
  const f = (v) => (Math.round(v * 10 ** casas) / 10 ** casas).toString().replace('.', ',');
  if (!secaoVariavel(el)) { const s = secaoDoVao(el, 0); return `${f(s.b)}${sep}${f(s.h)} cm`; }
  // vãos seguidos iguais aparecem uma vez só
  const partes = [];
  (el.vaos ?? []).forEach((_, v) => {
    const s = secaoDoVao(el, v);
    const t = `${f(s.b)}${sep}${f(s.h)}${s.invertida ? ' inv.' : ''}`;
    if (partes.at(-1) !== t) partes.push(t);
  });
  return `${partes.join(' / ')} cm`;
}

/** Espessura (cm) de uma laje, por módulo: alveolar, entrepiso de madeira, treliçada, maciça e nervurada. */
export function espessuraLaje(el) {
  if (el?.painel?.MRd != null) return (el.painel.h ?? 20) + (el.capa ?? 0);          // alveolar
  if (el?.vigota) return el.vigota.h + (el.painel?.espessura ?? 0) / 10;             // entrepiso de madeira
  if (el?.he != null) return el.he + (el.hf ?? 0);                                   // treliçada
  return el?.h ?? 10;                                                                // maciça e nervurada
}

/**
 * Espessura (cm) das lajes que se apoiam na viga — a base dos vãos invertidos; 10 cm sem laje ligada.
 * @param {(id:string) => object} achar  busca um elemento pelo id
 */
export function espessuraApoiada(viga, achar) {
  const hs = (viga?.cargas ?? []).filter((c) => c?.tipo === 'elemento').map((c) => achar(c.elementoId))
    .filter((e) => e && /laje|entrepiso/.test(e.modulo ?? '')).map(espessuraLaje);
  return hs.length ? Math.max(...hs) : 10;
}
