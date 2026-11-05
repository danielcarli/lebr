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
 * Estruturas de madeira — ABNT NBR 7190-1:2022
 *
 * Unidades: tensões e módulos em MPa; dimensões de seção em cm; esforços em kN e kN·m.
 *
 * Fontes dos valores (ver docs/MADEIRA.md): classes, kmod1, kmod2, γw, fluência,
 * βc, kM e o método de estabilidade (λrel, kc) conforme trabalhos acadêmicos que
 * reproduzem a NBR 7190-1:2022. Pontos marcados "REFERÊNCIA" não foram
 * confirmados no texto da norma e devem ser conferidos.
 */

/* ======================================================================== classes */

/** Espécies nativas — corpos de prova isentos de defeitos (umidade 12 %). */
const NATIVAS = [
  { id: 'D20', fc0k: 20, fvk: 4, E0m: 10000, rho: 500 },
  { id: 'D30', fc0k: 30, fvk: 5, E0m: 12000, rho: 625 },
  { id: 'D40', fc0k: 40, fvk: 6, E0m: 14500, rho: 750 },
  { id: 'D50', fc0k: 50, fvk: 7, E0m: 16500, rho: 850 },
  { id: 'D60', fc0k: 60, fvk: 8, E0m: 19500, rho: 1000 },
];

/** Peças estruturais — coníferas. [fmk, ft0k, fc0k, fc90k, fvk, E0m(GPa), E005(GPa), Gm(GPa), ρk, ρm] */
const CONIFERAS = {
  C14: [14, 8, 16, 2.0, 3.0, 7, 4.7, 0.4, 290, 350],
  C16: [16, 10, 17, 2.2, 3.2, 8, 5.4, 0.5, 310, 370],
  C18: [18, 11, 18, 2.2, 3.4, 9, 6.0, 0.6, 320, 380],
  C20: [20, 12, 19, 2.3, 3.6, 9.5, 6.4, 0.6, 330, 390],
  C22: [22, 13, 20, 2.4, 3.8, 10, 6.7, 0.6, 340, 410],
  C24: [24, 14, 21, 2.5, 4.0, 11, 7.4, 0.7, 350, 420],
  C27: [27, 16, 22, 2.6, 4.0, 12, 7.7, 0.7, 370, 450],
  C30: [30, 18, 23, 2.7, 4.0, 12, 8.0, 0.8, 380, 460],
  C35: [35, 21, 25, 2.8, 4.0, 13, 8.7, 0.8, 400, 480],
  C40: [40, 24, 26, 2.9, 4.0, 14, 9.4, 0.9, 420, 500],
  C45: [45, 27, 27, 3.1, 4.0, 15, 10, 0.9, 440, 520],
  C50: [50, 30, 29, 3.2, 4.0, 16, 11, 1.0, 460, 550],
};

/** Peças estruturais — folhosas de reflorestamento. Mesma ordem de colunas. */
const FOLHOSAS = {
  D18: [18, 11, 18, 7.5, 3.4, 9.5, 8, 0.6, 475, 570],
  D24: [24, 14, 21, 7.8, 4.0, 10, 8.5, 0.6, 485, 580],
  D30e: [30, 18, 23, 8.0, 4.0, 11, 9.2, 0.7, 530, 640],
  D35: [35, 21, 25, 8.1, 4.0, 12, 10, 0.8, 540, 650],
  D40e: [40, 24, 26, 8.3, 4.0, 13, 11, 0.8, 560, 660],
  D50e: [50, 30, 29, 9.3, 4.0, 14, 12, 0.9, 620, 750],
  D60e: [60, 36, 32, 11, 4.5, 17, 14, 1.1, 700, 840],
  D70: [70, 42, 34, 13.5, 5.0, 20, 16.8, 1.25, 900, 1080],
};

/** Folhosas estruturais que repetem o nome de uma classe nativa recebem sufixo "e" no id. */
function deTabela(id, grupo, v) {
  const [fmk, ft0k, fc0k, fc90k, fvk, E0m, E005, Gm, rhok, rhom] = v;
  return { id, nome: id.replace(/e$/, ''), grupo, fmk, ft0k, fc0k, fc90k, fvk, E0m: E0m * 1000, E005: E005 * 1000, Gm: Gm * 1000, rho: rhom, rhok };
}

/** Todas as classes, prontas para consulta. */
export const CLASSES_MADEIRA = [
  ...NATIVAS.map((c) => ({
    id: c.id, nome: c.id, grupo: 'nativa',
    fmk: null,                    // espécies nativas: fm,d = fc0,d
    ft0k: c.fc0k / 0.77,          // REFERÊNCIA: relação fc0/ft0 = 0,77
    fc0k: c.fc0k,
    fc90k: 0.25 * c.fc0k,         // REFERÊNCIA: fc90 = 0,25·fc0
    fvk: c.fvk,
    E0m: c.E0m, E005: 0.7 * c.E0m, Gm: c.E0m / 16,
    rho: c.rho,
  })),
  ...Object.entries(CONIFERAS).map(([id, v]) => deTabela(id, 'conifera', v)),
  ...Object.entries(FOLHOSAS).map(([id, v]) => deTabela(id, 'folhosa', v)),
];

export const GRUPOS_MADEIRA = {
  nativa: 'Espécies nativas (corpos de prova)',
  conifera: 'Peças estruturais — coníferas',
  folhosa: 'Peças estruturais — folhosas',
};

export const classeMadeira = (id) => CLASSES_MADEIRA.find((c) => c.id === id) ?? null;

/* ======================================================================== coeficientes */

/** kmod,1 — classe de carregamento (madeira serrada, roliça, MLC, MLCC, LVL). */
export const KMOD1 = { permanente: 0.6, longa: 0.7, media: 0.8, curta: 0.9, instantanea: 1.1 };

export const CARREGAMENTOS = [
  { valor: 'permanente', texto: 'Permanente (> 10 anos)' },
  { valor: 'longa', texto: 'Longa duração (6 meses a 10 anos)' },
  { valor: 'media', texto: 'Média duração (1 semana a 6 meses)' },
  { valor: 'curta', texto: 'Curta duração (< 1 semana)' },
  { valor: 'instantanea', texto: 'Instantânea' },
];

/** kmod,2 — classe de umidade (madeira serrada, roliça, MLC, MLCC, LVL). */
export const KMOD2 = { 1: 1.0, 2: 0.9, 3: 0.8, 4: 0.7 };

export const UMIDADES = [
  { valor: 1, texto: '1 — Uamb ≤ 65 % (Ueq 12 %)' },
  { valor: 2, texto: '2 — 65 % < Uamb ≤ 75 % (Ueq 15 %)' },
  { valor: 3, texto: '3 — 75 % < Uamb ≤ 85 % (Ueq 18 %)' },
  { valor: 4, texto: '4 — Uamb > 85 % (Ueq ≥ 25 %)' },
];

/** Coeficiente de fluência φ por classe de umidade e de carregamento. */
export const FLUENCIA = {
  seco: { permanente: 0.8, longa: 0.8, media: 0.3, curta: 0.1, instantanea: 0 },
  umido: { permanente: 2.0, longa: 2.0, media: 1.0, curta: 0.5, instantanea: 0 },
};

/** Comprimento de flambagem L0 = KE·L conforme vinculação. */
export const KE_VINCULOS = [
  { valor: 1.0, texto: 'Articulado nas duas extremidades (KE = 1,0)' },
  { valor: 0.8, texto: 'Engastado e articulado (KE = 0,8)' },
  { valor: 0.65, texto: 'Engastado nas duas extremidades (KE = 0,65)' },
  { valor: 1.2, texto: 'Engastado, topo com rotação impedida e deslocável (KE = 1,2)' },
  { valor: 2.1, texto: 'Engastado e livre (KE = 2,1)' },
  { valor: 2.4, texto: 'Articulado e topo deslocável com rotação impedida (KE = 2,4)' },
];

/* ======================================================================== material */

/**
 * Propriedades de cálculo de uma classe.
 * @param {string} id  classe (ex.: 'C24', 'D40')
 * @param {object} op
 * @param {number} op.umidade        classe de umidade 1–4
 * @param {string} op.carregamento   chave de KMOD1
 * @param {string} [op.tipo]         'serrada' | 'mlc'
 * @param {number} [op.gwc=1.4]      γw para tensões normais
 * @param {number} [op.gwv=1.8]      γw para cisalhamento
 */
export function madeira(id, { umidade = 2, carregamento = 'longa', tipo = 'serrada', gwc = 1.4, gwv = 1.8 } = {}) {
  const c = classeMadeira(id);
  if (!c) throw new Error(`Classe de madeira desconhecida: ${id}.`);
  const kmod1 = KMOD1[carregamento] ?? 0.7;
  const kmod2 = KMOD2[umidade] ?? 0.9;
  const kmod = kmod1 * kmod2;
  const fc0d = (kmod * c.fc0k) / gwc;
  const fmd = c.fmk ? (kmod * c.fmk) / gwc : fc0d;
  return {
    ...c, umidade, carregamento, tipo, gwc, gwv,
    kmod1, kmod2, kmod,
    fc0d, fmd,
    ft0d: (kmod * c.ft0k) / gwc,
    fc90d: (kmod * c.fc90k) / gwc,
    fvd: (kmod * c.fvk) / gwv,
    Eef: kmod * c.E0m,                         // Ec0,ef = kmod1·kmod2·E0,med
    peso: (c.rho * 9.81) / 1000,               // kN/m³ (ρ em kg/m³)
    phi: FLUENCIA[umidade <= 2 ? 'seco' : 'umido'].permanente,
    betaC: tipo === 'mlc' ? 0.1 : 0.2,
    kM: 0.7,                                   // seções retangulares
  };
}

/** Lê os parâmetros de madeira do projeto com valores padrão. */
export function parametrosMadeira(par = {}) {
  return { classe: 'C24', umidade: 2, carregamento: 'longa', tipo: 'serrada', gwc: 1.4, gwv: 1.8, gg: 1.4, gq: 1.5, flecha: 200, ...par };
}

/* ======================================================================== verificações */

const secao = (b, h) => ({ A: b * h, Wx: (b * h * h) / 6, Wy: (h * b * b) / 6, Ix: (b * h ** 3) / 12, Iy: (h * b ** 3) / 12 });

/** Flexão simples: σM,d = Md/W ≤ fm,d. Md em kN·m, b e h em cm. */
export function flexaoMadeira({ Md, b, h, m }) {
  const sigma = (Math.abs(Md) * 100 / secao(b, h).Wx) * 10; // MPa
  return { sigma, f: m.fmd, uso: sigma / m.fmd, ok: sigma <= m.fmd * (1 + 1e-9) };
}

/** Cisalhamento em seção retangular: τd = 1,5·Vd/(b·h) ≤ fv,d. */
export function cisalhamentoMadeira({ Vd, b, h, m }) {
  const tau = (1.5 * Math.abs(Vd) / (b * h)) * 10;
  return { tau, f: m.fvd, uso: tau / m.fvd, ok: tau <= m.fvd * (1 + 1e-9) };
}

/**
 * Estabilidade lateral de vigas de seção retangular (REFERÊNCIA: critério da NBR 7190,
 * coeficiente βM com βE = 4 e γf = 1,4). Dispensa verificação se L1/b ≤ Ec0,ef/(βM·fc0,d);
 * caso contrário exige σc1,d ≤ Ec0,ef/((L1/b)·βM).
 * @param {number} L1  distância entre travamentos da borda comprimida (cm)
 */
export function estabilidadeLateral({ L1, b, h, sigma, m }) {
  const r = h / b;
  const betaM = (1 / (0.26 * Math.PI)) * (4 / 1.4) * r ** 1.5 / Math.sqrt(Math.max(0.05, r - 0.63));
  const limite = m.Eef / (betaM * m.fc0d);
  const esbeltez = L1 / b;
  if (esbeltez <= limite) return { betaM, esbeltez, limite, dispensada: true, ok: true, uso: esbeltez / limite };
  const sigmaLim = m.Eef / (esbeltez * betaM);
  return { betaM, esbeltez, limite, dispensada: false, sigmaLim, ok: sigma <= sigmaLim, uso: sigma / sigmaLim };
}

/** Compressão normal ao grão no apoio: σc90,d = Rd/(b·c) ≤ fc90,d (αn = 1, a favor da segurança). */
export function apoioMadeira({ Rd, b, c, m }) {
  const sigma = (Math.abs(Rd) / (b * c)) * 10;
  return { sigma, f: m.fc90d, uso: sigma / m.fc90d, ok: sigma <= m.fc90d * (1 + 1e-9) };
}

/** Fator de estabilidade kc a partir da esbeltez relativa (curva com βc). */
export function fatorKc(lambdaRel, betaC) {
  if (lambdaRel < 0.3) return 1;
  const k = 0.5 * (1 + betaC * (lambdaRel - 0.3) + lambdaRel ** 2);
  return Math.min(1, 1 / (k + Math.sqrt(k * k - lambdaRel ** 2)));
}

/**
 * Compressão ou flexocompressão de peça retangular b (direção x da seção, cm) × h (direção y, cm).
 * Eixo x = flexão no plano de h (momento Mx); eixo y = flexão no plano de b (momento My).
 * @param {number} L0x  comprimento de flambagem para flexão em torno de x (cm) — usa h
 * @param {number} L0y  comprimento de flambagem para flexão em torno de y (cm) — usa b
 */
export function compressaoMadeira({ Nd, Mxd = 0, Myd = 0, b, h, L0x, L0y, m }) {
  const s = secao(b, h);
  const sigmaN = (Nd / s.A) * 10;
  const sigmaMx = (Math.abs(Mxd) * 100 / s.Wx) * 10;
  const sigmaMy = (Math.abs(Myd) * 100 / s.Wy) * 10;
  const ix = h / Math.sqrt(12), iy = b / Math.sqrt(12);
  const lambdaX = L0x / ix, lambdaY = L0y / iy;
  const raiz = Math.sqrt(m.fc0k / m.E005);
  const relX = (lambdaX / Math.PI) * raiz, relY = (lambdaY / Math.PI) * raiz;
  const kcx = fatorKc(relX, m.betaC), kcy = fatorKc(relY, m.betaC);
  const kM = m.kM;
  const flex = sigmaMx > 0 || sigmaMy > 0;

  // Sem instabilidade (λrel < 0,3 nas duas direções): interação com o termo de compressão ao quadrado
  const semInstab = relX < 0.3 && relY < 0.3;
  let ix1, iy1;
  if (semInstab) {
    const n2 = (sigmaN / m.fc0d) ** 2;
    ix1 = n2 + sigmaMx / m.fmd + kM * sigmaMy / m.fmd;
    iy1 = n2 + kM * sigmaMx / m.fmd + sigmaMy / m.fmd;
  } else {
    ix1 = sigmaN / (kcx * m.fc0d) + sigmaMx / m.fmd + kM * sigmaMy / m.fmd;
    iy1 = sigmaN / (kcy * m.fc0d) + kM * sigmaMx / m.fmd + sigmaMy / m.fmd;
  }
  return {
    sigmaN, sigmaMx, sigmaMy, lambdaX, lambdaY, relX, relY, kcx, kcy, semInstab, flex,
    interacaoX: ix1, interacaoY: iy1,
    limiteEsbeltez: { x: L0x / h, y: L0y / b, ok: L0x <= 40 * h + 1e-9 && L0y <= 40 * b + 1e-9 },
    ok: ix1 <= 1 + 1e-9 && iy1 <= 1 + 1e-9,
  };
}

/** Flecha final com fluência: ufin = (uG + ψ2·uQ)·(1 + φ). */
export const flechaFinal = ({ uG, uQ, psi2, phi }) => (uG + psi2 * uQ) * (1 + phi);
