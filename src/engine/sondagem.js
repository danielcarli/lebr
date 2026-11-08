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
 * Sondagem de simples reconhecimento com SPT — ABNT NBR 6484:2020.
 *
 * Um furo tem a boca numa cota (referencial do projeto), camadas descritas até uma profundidade, um ensaio
 * de penetração a cada metro (NSPT = golpes para cravar os últimos 30 cm do amostrador; quando a cravação
 * para antes, registra-se golpes/penetração, ex.: 50/10) e o nível d'água.
 *
 * Estados de compacidade e consistência (NBR 6484:2020, Anexo A):
 *   areias e siltes arenosos    ≤ 4 fofa · 5–8 pouco compacta · 9–18 medianamente compacta · 19–40 compacta · > 40 muito compacta
 *   argilas e siltes argilosos  ≤ 2 muito mole · 3–5 mole · 6–10 média · 11–19 rija · 20–30 muito rija · > 30 dura
 *
 * Profundidades em m a partir da boca do furo; cotas em m.
 */

/** Solos principais: gênero gramatical (para os adjetivos) e o grupo para a classificação. */
export const SOLOS = {
  argila: { nome: 'Argila', fem: true, grupo: 'coesivo' },
  silte: { nome: 'Silte', fem: false, grupo: 'silte' },
  areia: { nome: 'Areia', fem: true, grupo: 'granular' },
  pedregulho: { nome: 'Pedregulho', fem: false, grupo: 'granular' },
  organico: { nome: 'Solo orgânico', fem: false, grupo: 'coesivo' },
  turfa: { nome: 'Turfa', fem: true, grupo: 'coesivo' },
  aterro: { nome: 'Aterro', fem: false, grupo: 'aterro' },
  rocha: { nome: 'Rocha alterada', fem: true, grupo: 'rocha' },
};

/** Fração secundária (adjetivo): masculino e feminino. */
export const SECUNDARIOS = {
  '': ['', ''],
  arenoso: ['arenoso', 'arenosa'],
  argiloso: ['argiloso', 'argilosa'],
  siltoso: ['siltoso', 'siltosa'],
  pedregulhoso: ['pedregulhoso', 'pedregulhosa'],
  organico: ['orgânico', 'orgânica'],
  comPedregulhos: ['com pedregulhos', 'com pedregulhos'],
};

/** Origem geológica (texto do boletim). */
export const ORIGENS = { '': '', residual: 'residual', aluvionar: 'aluvionar', coluvionar: 'coluvionar', sedimentar: 'sedimentar', marinho: 'marinho', aterro: 'aterro' };

/** Critérios de paralisação (NBR 6484:2020; o impenetrável ao SPT é o do item 5.2.4.2). */
export const PARALISACOES = {
  projeto: 'Atingida a profundidade programada',
  impenetravel: 'Impenetrável ao SPT (5.2.4.2)',
  lavagem: 'Impenetrável à perfuração por lavagem',
  outro: 'Outro critério (ver observações)',
};

const COMPACIDADE = [[4, 'fof'], [8, 'pouco compact'], [18, 'medianamente compact'], [40, 'compact'], [Infinity, 'muito compact']];
const CONSISTENCIA = [[2, 'muito mole', 'muito mole'], [5, 'mole', 'mole'], [10, 'médio', 'média'], [19, 'rijo', 'rija'], [30, 'muito rijo', 'muito rija'], [Infinity, 'duro', 'dura']];

/** Nome do solo com a fração secundária: "Argila siltosa", "Silte arenoso". */
export function nomeDoSolo({ solo, secundario = '' }) {
  const s = SOLOS[solo] ?? SOLOS.argila;
  const adj = (SECUNDARIOS[secundario] ?? SECUNDARIOS[''])[s.fem ? 1 : 0];
  return adj ? `${s.nome} ${adj}` : s.nome;
}

/** Tipo de classificação da camada: 'compacidade', 'consistencia' ou null (aterro, rocha). */
export function tipoDeEstado({ solo, secundario = '' }) {
  const g = SOLOS[solo]?.grupo ?? 'coesivo';
  if (g === 'granular') return 'compacidade';
  if (g === 'coesivo') return 'consistencia';
  if (g === 'silte') return secundario === 'argiloso' ? 'consistencia' : 'compacidade';
  return null;
}

/** Estado de compacidade ou consistência para um NSPT (Anexo A). */
export function estadoPeloN(n, camada) {
  const tipo = tipoDeEstado(camada);
  if (!tipo || !Number.isFinite(n)) return null;
  const fem = (SOLOS[camada.solo] ?? SOLOS.argila).fem;
  if (tipo === 'compacidade') {
    const f = COMPACIDADE.find(([lim]) => n <= lim)[1];
    return `${f}${fem ? 'a' : 'o'}`;
  }
  const c = CONSISTENCIA.find(([lim]) => n <= lim);
  return fem ? c[2] : c[1];
}

/**
 * NSPT equivalente a 30 cm (para gráficos e médias): N·30/penetração quando a cravação parou antes, limitado a
 * max(N, 50) — um "50/10" vale 50 (impenetrável), não 150.
 */
export const nEquivalente = (n, pen = 30) => (pen > 0 && pen < 30 ? Math.min((n * 30) / pen, Math.max(n, 50)) : n);
/** Rótulo do ensaio: "12" ou "50/10". */
export const rotuloN = (n, pen = 30) => (pen > 0 && pen < 30 ? `${n}/${pen}` : String(n));

/**
 * Organiza e confere os dados de um furo.
 * @param {object} f  { cotaBoca, camadas:[{ate, solo, secundario, cor, origem, descricao}], spt:[{prof, n, pen}],
 *                      nivelAgua:{ inicial, final, seco }, limite, paralisacao }
 */
export function analisarSondagem(f) {
  const avisos = [];
  const cota0 = Number(f.cotaBoca ?? 0);
  const camadasIn = (f.camadas ?? []).filter((c) => Number(c.ate) > 0);
  const ordenadas = [...camadasIn].sort((a, b) => a.ate - b.ate);
  const emOrdem = camadasIn.every((c, k) => k === 0 || c.ate > camadasIn[k - 1].ate);
  const spt = (f.spt ?? []).filter((e) => Number.isFinite(Number(e.prof)) && Number.isFinite(Number(e.n)))
    .map((e) => ({ prof: Number(e.prof), n: Number(e.n), pen: Number(e.pen ?? 30) || 30 }))
    .sort((a, b) => a.prof - b.prof);
  const fundoCamadas = ordenadas.length ? ordenadas[ordenadas.length - 1].ate : 0;
  const fundoSpt = spt.length ? spt[spt.length - 1].prof + Math.min(0.45, (spt[spt.length - 1].pen + 15) / 100) : 0;
  const limite = Number(f.limite) > 0 ? Number(f.limite) : Math.max(fundoCamadas, fundoSpt);

  // ensaios: profundidade média do trecho de 45 cm (as camadas são atribuídas por ela)
  const ensaios = spt.map((e) => ({ ...e, meio: e.prof + 0.3, cota: cota0 - e.prof, rotulo: rotuloN(e.n, e.pen), neq: nEquivalente(e.n, e.pen) }));
  let de = 0;
  const camadas = ordenadas.map((c, k) => {
    const nessa = ensaios.filter((e) => e.meio > de - 1e-9 && (e.meio <= c.ate + 1e-9 || (k === ordenadas.length - 1 && e.meio > c.ate)));
    const ns = nessa.map((e) => e.neq);
    const nMin = ns.length ? Math.min(...ns) : null, nMax = ns.length ? Math.max(...ns) : null;
    const nMedio = ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null;
    const e1 = estadoPeloN(nMin, c), e2 = estadoPeloN(nMax, c);
    const estado = e1 == null ? null : e1 === e2 ? e1 : `${e1} a ${e2}`;
    const r = {
      indice: k, de, ate: c.ate, espessura: c.ate - de, cotaTopo: cota0 - de, cotaBase: cota0 - c.ate,
      solo: c.solo, secundario: c.secundario ?? '', cor: c.cor ?? '', origem: c.origem ?? '', descricaoLivre: c.descricao ?? '',
      nome: nomeDoSolo(c), tipoEstado: tipoDeEstado(c), estado, nMin, nMax, nMedio, ensaios: nessa.length,
    };
    r.descricao = [r.nome, r.cor, r.estado, r.origem ? (r.origem === 'aterro' ? '' : r.origem) : '', r.descricaoLivre].filter(Boolean).join(', ');
    for (const e of nessa) e.camada = k;
    de = c.ate;
    return r;
  });

  // nível d'água
  const na = f.nivelAgua ?? {};
  const naIni = Number(na.inicial), naFin = Number(na.final);
  const nivelAgua = {
    seco: !!na.seco,
    inicial: Number.isFinite(naIni) && na.inicial !== null && na.inicial !== '' ? naIni : null,
    final: Number.isFinite(naFin) && na.final !== null && na.final !== '' ? naFin : null,
  };
  nivelAgua.cotaInicial = nivelAgua.inicial != null ? cota0 - nivelAgua.inicial : null;
  nivelAgua.cotaFinal = nivelAgua.final != null ? cota0 - nivelAgua.final : null;

  // conferências do boletim
  const lacunas = [];
  for (let k = 1; k < ensaios.length; k++) if (ensaios[k].prof - ensaios[k - 1].prof > 1.0 + 1e-6) lacunas.push([ensaios[k - 1].prof, ensaios[k].prof]);
  if (ensaios.length && ensaios[0].prof > 1.0 + 1e-6) lacunas.unshift([0, ensaios[0].prof]);
  const fora = ensaios.filter((e) => e.prof > limite + 1e-6);
  const verificacoes = [
    { nome: 'Camadas em ordem de profundidade', item: 'NBR 6484', valor: emOrdem ? 'sim' : 'fora de ordem', limite: 'crescente', ok: emOrdem && camadasIn.length > 0 },
    { nome: 'Perfil descrito até o fim do furo', item: 'NBR 6484', valor: `${fmt(fundoCamadas)} m`, limite: `≥ ${fmt(limite)} m`, ok: fundoCamadas >= limite - 0.05 },
    { nome: 'Ensaio SPT a cada metro', item: 'NBR 6484', valor: lacunas.length ? `${lacunas.length} intervalo(s) maior(es) que 1 m` : `${ensaios.length} ensaio(s)`, limite: '≤ 1 m entre ensaios', ok: ensaios.length > 0 && !lacunas.length },
    { nome: 'Ensaios dentro do furo', item: 'NBR 6484', valor: fora.length ? `${fora.length} abaixo do limite` : 'sim', limite: `até ${fmt(limite)} m`, ok: !fora.length },
    { nome: 'Nível d’água registrado', item: 'NBR 6484', valor: nivelAgua.seco ? 'furo seco' : nivelAgua.inicial != null ? `${fmt(nivelAgua.inicial)} m` : 'não informado', limite: 'NA ou furo seco', ok: nivelAgua.seco || nivelAgua.inicial != null },
  ];
  if (nivelAgua.seco && nivelAgua.inicial != null) avisos.push('O furo está marcado como seco e tem nível d’água informado — confira o boletim.');
  if (nivelAgua.inicial != null && nivelAgua.inicial > limite) avisos.push('O nível d’água está abaixo do fim do furo.');
  if (camadas.some((c) => c.tipoEstado && c.ensaios === 0)) avisos.push('Há camada sem ensaio SPT: o estado de compacidade ou consistência fica sem classificação.');

  return {
    cotaBoca: cota0, limite, cotaFundo: cota0 - limite, camadas, ensaios, nivelAgua, verificacoes, avisos,
    nMaximo: ensaios.length ? Math.max(...ensaios.map((e) => e.neq)) : 0,
  };
}

const fmt = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');

/* ------------------------------------------------------------------ consultas (para as fundações) */

/** Camada analisada na profundidade p (m a partir da boca). */
export function camadaNa(analise, p) {
  return analise.camadas.find((c) => p > c.de - 1e-9 && p <= c.ate + 1e-9) ?? (p > 0 ? analise.camadas.at(-1) ?? null : analise.camadas[0] ?? null);
}

/** NSPT do ensaio mais próximo da profundidade p. */
export function nsptNa(analise, p) {
  if (!analise.ensaios.length) return null;
  return analise.ensaios.reduce((a, e) => (Math.abs(e.prof - p) < Math.abs(a.prof - p) ? e : a), analise.ensaios[0]);
}

/** NSPT médio (equivalente a 30 cm) dos ensaios entre as profundidades a e b. */
export function nsptMedio(analise, a, b) {
  const es = analise.ensaios.filter((e) => e.prof >= a - 1e-9 && e.prof <= b + 1e-9);
  return es.length ? es.reduce((s, e) => s + e.neq, 0) / es.length : null;
}

/** Furo mais próximo de um ponto (x, y) da planta, entre elementos { local: { x, y } }. */
export function furoMaisProximo(furos, x, y) {
  let melhor = null;
  for (const f of furos) {
    if (!f.local) continue;
    const d = Math.hypot(f.local.x - x, f.local.y - y);
    if (!melhor || d < melhor.distancia) melhor = { furo: f, distancia: d };
  }
  return melhor;
}
