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
 * Casos de carga e combinações de ações — ABNT NBR 8681:2003 e NBR 6118:2023, 11.7 e 11.8.
 *
 * Um caso de carga é um conjunto de ações características analisado sozinho (G = permanentes,
 * Q = variável de uso, V = vento…). Como a análise é linear, o esforço de uma combinação é a soma
 * dos esforços de cada caso multiplicados pelos fatores da combinação.
 *
 * ELU — combinações últimas normais (11.8.2.1, Tabela 11.3):
 *   Fd = γg·Fgk + γq·(Fq1k + Σ ψ0j·Fqjk)
 *   com as permanentes agrupadas, γg = 1,4 quando desfavoráveis e 1,0 quando favoráveis (Tabela 11.1),
 *   e cada variável tomada como principal; uma variável favorável é omitida (fator 0).
 * ELS — combinações de serviço (11.8.3, Tabela 11.4):
 *   quase permanente  Fd = Fgk + Σ ψ2j·Fqjk
 *   frequente         Fd = Fgk + ψ1·Fq1k + Σ ψ2j·Fqjk
 *   rara              Fd = Fgk + Fq1k + Σ ψ1j·Fqjk
 */

/** Fatores de redução ψ0, ψ1 e ψ2 das cargas de uso — NBR 6118:2023, Tabela 11.2. */
export const PSI_USO = {
  residencial: { psi0: 0.5, psi1: 0.4, psi2: 0.3, nome: 'Locais sem predominância de equipamentos fixos nem de elevadas concentrações de pessoas (edifícios residenciais)' },
  comercial: { psi0: 0.7, psi1: 0.6, psi2: 0.4, nome: 'Locais com predominância de equipamentos fixos ou de elevadas concentrações de pessoas (escritórios, comércio, edifícios públicos)' },
  garagem: { psi0: 0.8, psi1: 0.7, psi2: 0.6, nome: 'Bibliotecas, arquivos, oficinas e garagens' },
};

/** Vento — NBR 6118:2023, Tabela 11.2 (usado a partir da etapa de vento). */
export const PSI_VENTO = { psi0: 0.6, psi1: 0.3, psi2: 0 };

/** Coeficientes de ponderação das ações (γ) e fatores ψ a partir dos parâmetros do projeto. */
export function coeficientesAcoes(parametros = {}) {
  const k = parametros.coeficientes ?? {};
  const base = PSI_USO[parametros.uso] ?? PSI_USO.residencial;
  return {
    gg: k.gg ?? 1.4,
    ggFav: k.ggFav ?? 1.0,
    gq: k.gq ?? 1.4,
    psi0: k.psi0 ?? base.psi0,
    psi1: k.psi1 ?? base.psi1,
    psi2: k.psi2 ?? base.psi2,
  };
}

/** Casos de carga usados pelos elementos: permanentes (G) e variável de uso (Q). */
export function casosPadrao(coef) {
  return [
    { id: 'G', nome: 'Permanentes', tipo: 'permanente' },
    { id: 'Q', nome: 'Variável de uso', tipo: 'variavel', psi0: coef.psi0, psi1: coef.psi1, psi2: coef.psi2 },
  ];
}

/** Casos de vento (NBR 6123): uma direção por caso, mutuamente exclusivas. */
export const CASOS_VENTO = [
  { id: 'V1', nome: 'Vento 0°', angulo: 0 },
  { id: 'V2', nome: 'Vento 90°', angulo: 90 },
  { id: 'V3', nome: 'Vento 180°', angulo: 180 },
  { id: 'V4', nome: 'Vento 270°', angulo: 270 },
];

/**
 * Desaprumo considerado sozinho (11.3.3.4.1): ação horizontal exclusiva por direção, com γq e ψ0 = ψ1 = ψ2 = 1
 * (a imperfeição é permanente; entra inteira em todas as combinações com a direção dela — a favor da
 * segurança em relação ao γ = 1,2 das ações permanentes indiretas).
 */
export const PSI_DESAPRUMO = { psi0: 1, psi1: 1, psi2: 1 };

/**
 * Casos do edifício: G, Q e as quatro direções horizontais.
 * @param {object} parametros
 * @param {{id:string, nome?:string, acao:'vento'|'desaprumo'|'combinado'}[]} [horizontais]  ação de cada caso
 *        V1 a V4 (do pórtico do edifício); sem a lista, o vento ativo nos parâmetros dá os quatro casos de vento.
 */
export function casosGlobais(parametros = {}, horizontais = null) {
  const coef = coeficientesAcoes(parametros);
  const base = casosPadrao(coef);
  if (horizontais) {
    return [...base, ...horizontais.map((h) => {
      const v = CASOS_VENTO.find((c) => c.id === h.id) ?? {};
      return { ...v, id: h.id, nome: h.nome ?? v.nome, acao: h.acao, tipo: 'variavel', grupo: 'vento', ...(h.acao === 'desaprumo' ? PSI_DESAPRUMO : PSI_VENTO) };
    })];
  }
  if (!parametros.vento?.ativo) return base;
  return [...base, ...CASOS_VENTO.map((v) => ({ ...v, tipo: 'variavel', grupo: 'vento', ...PSI_VENTO }))];
}

/**
 * Majora os casos horizontais das combinações últimas (15.7.2: esforços horizontais × 0,95·γz).
 * @param {object[]} combinacoes  @param {object[]} casos
 * @param {Record<string, number>} fatores  fator por caso (ex.: { V1: 1.08, V3: 1.08 }); 1 não muda nada
 */
export function majorarHorizontais(combinacoes, casos, fatores) {
  return combinacoes.map((c) => {
    if (c.tipo !== 'ELU') return c;
    const ids = Object.keys(c.fatores).filter((id) => (fatores[id] ?? 1) !== 1 && c.fatores[id]);
    if (!ids.length) return c;
    const f = { ...c.fatores };
    for (const id of ids) f[id] = Math.round(f[id] * fatores[id] * 10000) / 10000;
    return { ...c, fatores: f, expressao: expressao(f, casos), majorada: true };
  });
}

const fmt = (v) => String(Math.round(v * 1000) / 1000).replace('.', ',');

/** Expressão legível de uma combinação: "1,4·G + 1,4·Q". */
export function expressao(fatores, casos) {
  const partes = casos.filter((c) => fatores[c.id]).map((c) => `${fatores[c.id] === 1 ? '' : `${fmt(fatores[c.id])}·`}${c.id}`);
  return partes.join(' + ') || '0';
}

/**
 * Gera as combinações de cálculo.
 * @param {{id:string, nome:string, tipo:'permanente'|'variavel', psi0?:number, psi1?:number, psi2?:number}[]} casos
 * @param {{gg?:number, ggFav?:number, gq?:number}} [coef]
 * @returns {{id:string, tipo:'ELU'|'QP'|'FREQ'|'RARA', nome:string, fatores:Record<string,number>, expressao:string, principal:string|null}[]}
 */
export function gerarCombinacoes(casos, { gg = 1.4, ggFav = 1.0, gq = 1.4 } = {}) {
  const perm = casos.filter((c) => c.tipo === 'permanente');
  const todasVars = casos.filter((c) => c.tipo === 'variavel');
  const lista = [];
  const chaves = new Set();
  const add = (tipo, nome, fatores, principal = null) => {
    const chave = `${tipo}|${casos.map((c) => fatores[c.id] ?? 0).join(',')}`;
    if (chaves.has(chave)) return;
    chaves.add(chave);
    lista.push({ tipo, nome, fatores, principal });
  };
  // ações variáveis exclusivas (ex.: vento em 0°, 90°, 180° e 270°, com o mesmo `grupo`) nunca atuam juntas:
  // cada cenário toma no máximo uma de cada grupo
  const livres = todasVars.filter((v) => !v.grupo);
  const grupos = [...new Set(todasVars.filter((v) => v.grupo).map((v) => v.grupo))].map((g) => todasVars.filter((v) => v.grupo === g));
  // subconjuntos das variáveis livres (do conjunto completo ao vazio: uma variável favorável é omitida)
  let subconj = [[]];
  for (const v of [...livres].reverse()) subconj = [...subconj.map((s) => [v, ...s]), ...subconj];
  const comGrupos = (base) => {
    let cs = [base];
    for (const gr of grupos) cs = cs.flatMap((c) => [...gr.map((v) => [...c, v]), c]);
    return cs;
  };
  const cenariosELU = subconj.flatMap(comGrupos);
  const cenarios = comGrupos(livres); // ELS: variáveis livres sempre presentes

  // ELU: cada variável como principal (as demais com ψ0), depois só as permanentes
  for (const g of [gg, ggFav]) {
    const desc = g === gg ? 'permanentes desfavoráveis' : 'permanentes favoráveis';
    for (const vars of cenariosELU) {
      for (const p of vars) {
        const f = Object.fromEntries(perm.map((c) => [c.id, g]));
        for (const v of vars) f[v.id] = v === p ? gq : gq * (v.psi0 ?? 0.5);
        const outras = vars.filter((v) => v !== p && v.grupo);
        add('ELU', `${p.nome} principal${outras.length ? ` (com ${outras.map((v) => v.nome.toLowerCase()).join(', ')})` : ''}, ${desc}`, f, p.id);
      }
    }
  }
  for (const g of [gg, ggFav]) {
    add('ELU', `Só permanentes (${g === gg ? 'desfavoráveis' : 'favoráveis'}), variáveis omitidas`, Object.fromEntries(perm.map((c) => [c.id, g])));
  }

  // ELS
  const fPerm = () => Object.fromEntries(perm.map((c) => [c.id, 1]));
  for (const vars of cenarios) add('QP', 'Quase permanente', { ...fPerm(), ...Object.fromEntries(vars.map((v) => [v.id, v.psi2 ?? 0.3])) });
  for (const vars of cenarios) for (const p of vars) {
    add('FREQ', `Frequente — ${p.nome.toLowerCase()} principal`, { ...fPerm(), ...Object.fromEntries(vars.map((v) => [v.id, v === p ? (v.psi1 ?? 0.4) : (v.psi2 ?? 0.3)])) }, p.id);
  }
  for (const vars of cenarios) for (const p of vars) {
    add('RARA', `Rara — ${p.nome.toLowerCase()} principal`, { ...fPerm(), ...Object.fromEntries(vars.map((v) => [v.id, v === p ? 1 : (v.psi1 ?? 0.4)])) }, p.id);
  }
  if (!todasVars.length) add('RARA', 'Rara', fPerm());

  const cont = {};
  return lista.map((c) => {
    cont[c.tipo] = (cont[c.tipo] ?? 0) + 1;
    const sufixo = c.tipo === 'QP' ? '' : String(cont[c.tipo]);
    return { id: `${c.tipo}${sufixo}`, ...c, expressao: expressao(c.fatores, casos) };
  });
}

/** Valor de uma combinação: Σ fator · valor do caso. */
export function combinar(fatores, valores) {
  let s = 0;
  for (const [id, f] of Object.entries(fatores)) s += f * (valores[id] ?? 0);
  return s;
}

/**
 * Envoltória de uma grandeza ao longo de pontos.
 * @param {{id:string, fatores:object}[]} combinacoes
 * @param {Record<string, number[]>} porCaso  valores de cada caso em cada ponto
 * @returns {{max:number[], min:number[], combMax:string[], combMin:string[]}}
 */
export function envolvente(combinacoes, porCaso) {
  const n = Object.values(porCaso)[0]?.length ?? 0;
  const max = new Array(n).fill(-Infinity), min = new Array(n).fill(Infinity);
  const combMax = new Array(n).fill(null), combMin = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const v = Object.fromEntries(Object.entries(porCaso).map(([k, arr]) => [k, arr[i]]));
    for (const c of combinacoes) {
      const x = combinar(c.fatores, v);
      if (x > max[i] + 1e-9) { max[i] = x; combMax[i] = c.id; }
      if (x < min[i] - 1e-9) { min[i] = x; combMin[i] = c.id; }
    }
  }
  return { max, min, combMax, combMin };
}

/** Combinação que dá o maior (ou menor) valor de uma grandeza escalar. */
export function extremo(combinacoes, valores, { menor = false } = {}) {
  let melhor = null;
  for (const c of combinacoes) {
    const x = combinar(c.fatores, valores);
    if (!melhor || (menor ? x < melhor.valor - 1e-9 : x > melhor.valor + 1e-9)) melhor = { valor: x, id: c.id };
  }
  return melhor;
}

export const doTipo = (combinacoes, tipo) => combinacoes.filter((c) => c.tipo === tipo);
