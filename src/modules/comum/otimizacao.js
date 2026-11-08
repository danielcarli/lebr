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
 * Otimização das bitolas de um elemento (0.30).
 *
 * Cada elemento pode pedir, em `elemento.otimizacao`, um critério:
 *  - 'bitolas' — o menor número de bitolas diferentes no elemento (obra mais simples: menos tipos de barra para
 *    comprar, cortar e dobrar); no empate, o menor peso de aço;
 *  - 'aco'     — o menor peso de aço do elemento; no empate, o menor número de bitolas;
 *  - 'segmentos' — o menor número de segmentos de barra: peças cortadas das barras comerciais de 12 m, que é o que se
 *    corta, dobra, amarra e posiciona na obra (barras mais longas que 12 m contam um segmento por emenda); no empate,
 *    o menor peso de aço e depois o menor número de bitolas.
 *
 * O programa recalcula o elemento com várias combinações de bitolas nas posições que estão em "Automática"
 * (as escolhidas pelo usuário ficam como estão) e fica com a melhor que passa em todas as verificações.
 * O peso e as bitolas são medidos pela mesma conta dos quantitativos — pela lista de ferros do detalhamento
 * em vigas, pilares e lajes maciças, com os comprimentos, ancoragens e as edições do usuário.
 */
import { BITOLAS_USO, bitolaFixa } from '../../engine/barras.js';
import { quantitativosDoElemento } from './quantitativos.js';

export const CRITERIOS = {
  bitolas: { nome: 'Menos bitolas diferentes', curto: 'menos bitolas', dica: 'Simplifica a obra: o menor número de bitolas diferentes no elemento; no empate, o menor peso de aço' },
  aco: { nome: 'Menos aço', curto: 'menos aço', dica: 'O menor peso de aço do elemento; no empate, o menor número de bitolas' },
  segmentos: { nome: 'Menos segmentos de barra', curto: 'menos segmentos', dica: 'O menor número de segmentos de barra (peças a cortar, dobrar e posicionar, contando as emendas das barras de 12 m), aceitando até um acréscimo de aço sobre a escolha automática (10 % por padrão); no empate, o menor peso' },
};

/** Posições de bitola que a otimização pode variar, por módulo (as mesmas da seção "Armadura"). */
export const POSICOES_OTIMIZAVEIS = {
  'concreto.viga': [
    { chave: 'inferior', uso: 'viga', rotulo: 'inferiores' },
    { chave: 'superior', uso: 'viga', rotulo: 'superiores' },
    { chave: 'estribo', uso: 'estribo', rotulo: 'estribos' },
  ],
  'concreto.pilar': [
    { chave: 'longitudinal', uso: 'pilar', rotulo: 'longitudinais' },
    { chave: 'estribo', uso: 'estribo', rotulo: 'estribos' },
  ],
  'concreto.laje.macica': [
    { chave: 'inferior', uso: 'laje', rotulo: 'inferiores' },
    { chave: 'superior', uso: 'laje', rotulo: 'superiores' },
  ],
  'concreto.escada': [{ chave: 'inferior', uso: 'laje', rotulo: 'principal' }],
  'concreto.reservatorio': [{ chave: 'phi', uso: 'laje', rotulo: 'barras' }],
};

/** Até este número de combinações, todas são avaliadas; acima, busca por coordenadas a partir de sementes. */
const LIMITE_EXAUSTIVO = 60;

export const otimizavel = (modulo) => !!POSICOES_OTIMIZAVEIS[modulo];

/** Acréscimo de aço aceito no critério de segmentos (%, sobre o peso da escolha automática). */
export const LIMITE_ACO_PADRAO = 10;
export const limiteAcoDe = (el) => {
  const v = Number(el?.otimizacaoLimiteAco);
  return Number.isFinite(v) && v >= 0 ? v : LIMITE_ACO_PADRAO;
};
export const criterioDe = (el) => (CRITERIOS[el?.otimizacao] && otimizavel(el?.modulo) ? el.otimizacao : null);

/** Peso de aço (kg, sem perdas) e bitolas usadas por um resultado, pela conta dos quantitativos. */
export function medirAco(el, resultado, projeto) {
  if (!resultado || resultado.erro) return null;
  const q = quantitativosDoElemento(el, resultado, projeto);
  const kg = Object.entries(q?.aco ?? {}).filter(([, v]) => v > 0.005);
  return {
    kg: kg.reduce((s, [, v]) => s + v, 0),
    bitolas: kg.map(([phi]) => Number(phi)).sort((a, b) => a - b),
    segmentos: Object.values(q?.pecas ?? {}).reduce((s, v) => s + v, 0),
  };
}

const valido = (r) => r && !r.erro && r.ok !== false;

/**
 * Procura a melhor combinação de bitolas para o critério.
 * @param {object} el          elemento (não é alterado)
 * @param {object} projeto
 * @param {(e:object) => object} calcular  calcula o elemento candidato e devolve o resultado do módulo
 * @param {'bitolas'|'aco'} criterio
 * @returns {{resultado:object, otimizacao:object}}
 */
export function otimizarBitolas(el, projeto, calcular, criterio) {
  const limite = limiteAcoDe(el);
  const todas = POSICOES_OTIMIZAVEIS[el.modulo] ?? [];
  const livres = todas.filter((p) => bitolaFixa(el.armadura?.[p.chave]) == null);
  const cache = new Map();
  const avaliar = (escolha) => {
    const chave = livres.map((p) => escolha[p.chave] ?? 'auto').join('|');
    if (cache.has(chave)) return cache.get(chave);
    const armadura = { ...(el.armadura ?? {}) };
    // arquivos antigos sem as chaves: só a posição base fica implícita
    if (livres.some((p) => escolha[p.chave] != null && escolha[p.chave] !== 'auto')) {
      for (const p of todas) armadura[p.chave] ??= 'auto';
      for (const p of livres) armadura[p.chave] = escolha[p.chave] ?? 'auto';
    }
    let resultado;
    try { resultado = calcular({ ...el, armadura }); } catch (err) { resultado = { ok: false, erro: err.message }; }
    const medida = valido(resultado) || resultado?.ok === false ? medirAco(el, resultado, projeto) : null;
    const fixas = livres.filter((p) => (escolha[p.chave] ?? 'auto') !== 'auto').length;
    const item = { escolha: Object.fromEntries(livres.map((p) => [p.chave, escolha[p.chave] ?? 'auto'])), resultado, medida, fixas, ok: valido(resultado) && !!medida };
    cache.set(chave, item);
    return item;
  };
  let teto = Infinity; // peso máximo aceito no critério de segmentos (o automático + o acréscimo permitido)
  const nota = (c) => {
    if (!c.ok) return [Infinity];
    if (criterio === 'segmentos' && c.medida.kg > teto + 1e-9) return [Infinity];
    const kg = Math.round(c.medida.kg * 100) / 100, nb = c.medida.bitolas.length;
    if (criterio === 'bitolas') return [nb, kg, c.fixas];
    if (criterio === 'segmentos') return [c.medida.segmentos, kg, nb, c.fixas];
    return [kg, nb, c.fixas];
  };
  const melhor = (a, b) => {
    const na = nota(a), nb = nota(b);
    for (let i = 0; i < Math.max(na.length, nb.length); i++) {
      if ((na[i] ?? 0) < (nb[i] ?? 0)) return a;
      if ((na[i] ?? 0) > (nb[i] ?? 0)) return b;
    }
    return a;
  };

  const base = avaliar({});
  if (criterio === 'segmentos' && base.ok) teto = base.medida.kg * (1 + limite / 100);
  let atual = base;
  const opcoes = livres.map((p) => ['auto', ...BITOLAS_USO[p.uso]]);
  const total = opcoes.reduce((s, o) => s * o.length, 1);
  if (livres.length && total <= LIMITE_EXAUSTIVO) {
    // todas as combinações
    const rec = (i, esc) => {
      if (i === livres.length) { atual = melhor(atual, avaliar(esc)); return; }
      for (const v of opcoes[i]) rec(i + 1, { ...esc, [livres[i].chave]: v });
    };
    rec(0, {});
  } else if (livres.length) {
    // sementes: a mesma bitola em todas as posições do mesmo uso (barras de cima e de baixo iguais, por exemplo)
    const usos = [...new Set(livres.map((p) => p.uso))];
    const recU = (i, esc) => {
      if (i === usos.length) { atual = melhor(atual, avaliar(esc)); return; }
      for (const v of ['auto', ...BITOLAS_USO[usos[i]]]) {
        const e2 = { ...esc };
        for (const p of livres) if (p.uso === usos[i]) e2[p.chave] = v;
        recU(i + 1, e2);
      }
    };
    recU(0, {});
    // busca por coordenadas: troca uma posição de cada vez enquanto melhorar
    for (let passe = 0; passe < 3; passe++) {
      const antes = atual;
      for (const [i, p] of livres.entries()) {
        for (const v of opcoes[i]) atual = melhor(atual, avaliar({ ...atual.escolha, [p.chave]: v }));
      }
      if (atual === antes) break;
    }
  }

  const otimizacao = {
    criterio,
    escolha: atual.escolha,
    fixadas: Object.fromEntries(todas.filter((p) => !livres.includes(p)).map((p) => [p.chave, bitolaFixa(el.armadura?.[p.chave])])),
    kg: atual.medida ? arred(atual.medida.kg) : null,
    bitolas: atual.medida?.bitolas ?? [],
    segmentos: atual.medida?.segmentos ?? null,
    base: { kg: base.medida ? arred(base.medida.kg) : null, bitolas: base.medida?.bitolas ?? [], segmentos: base.medida?.segmentos ?? null, ok: base.ok },
    avaliadas: cache.size,
    ...(criterio === 'segmentos' ? { limiteAco: limite } : {}),
    melhorou: atual !== base,
    semAlternativa: !atual.ok,
  };
  return { resultado: atual.resultado, otimizacao };
}

const arred = (v) => Math.round(v * 100) / 100;
const CRITERIO_MEMORIAL = {
  bitolas: 'o menor número de bitolas diferentes (no empate, o menor peso de aço)',
  aco: 'o menor peso de aço (no empate, o menor número de bitolas)',
  segmentos: 'o menor número de segmentos de barra com até o acréscimo de aço aceito sobre a escolha automática (no empate, o menor peso de aço)',
};

/** Linhas do memorial da otimização. */
export function memorialOtimizacao(o, todas) {
  const phi = (v) => String(v).replace('.', ',');
  const desc = (b) => (b.length ? b.map((x) => `ø ${phi(x)}`).join(', ') : '—');
  const nomes = Object.fromEntries((todas ?? []).map((p) => [p.chave, p.rotulo]));
  const esc = Object.entries(o.escolha).map(([k, v]) => `${nomes[k] ?? k}: ${v === 'auto' ? 'automática' : `ø ${phi(v)}`}`);
  const fix = Object.entries(o.fixadas ?? {}).map(([k, v]) => `${nomes[k] ?? k}: ø ${phi(v)} (escolhida pelo usuário)`);
  return {
    titulo: `Otimização das bitolas — ${CRITERIOS[o.criterio]?.nome.toLowerCase()}`,
    linhas: [
      `${o.avaliadas} combinação(ões) de bitolas calculadas; adotada a que atende a todas as verificações com ${CRITERIO_MEMORIAL[o.criterio]}.`,
      `Bitolas adotadas: ${[...esc, ...fix].join(' · ')}`,
      `Resultado: ${o.bitolas.length} bitola(s) (${desc(o.bitolas)}) · ${phi(o.kg?.toFixed(1) ?? '—')} kg de aço · ${o.segmentos ?? '—'} segmentos de barra`,
      `Sem otimização: ${o.base.bitolas.length} bitola(s) (${desc(o.base.bitolas)}) · ${phi(o.base.kg?.toFixed(1) ?? '—')} kg · ${o.base.segmentos ?? '—'} segmentos${o.base.ok ? '' : ' (não atendia)'}`,
      ...(o.criterio === 'segmentos' ? [`Acréscimo de aço aceito: até ${phi(o.limiteAco)} % sobre a escolha automática (teto de ${phi(((o.base.kg ?? 0) * (1 + o.limiteAco / 100)).toFixed(1))} kg).`] : []),
      'Peso pela lista de ferros (comprimentos de corte), sem as perdas de obra. Segmentos: peças cortadas das barras de 12 m, uma a mais por emenda.',
    ],
  };
}
