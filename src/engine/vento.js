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
 * Forças devidas ao vento em edificações — ABNT NBR 6123.
 *
 *   Vk = V0 · S1 · S2 · S3          velocidade característica (m/s)
 *   q  = 0,613 · Vk²                pressão dinâmica (N/m²)
 *   Fa = Ca · q · Ae                força de arrasto (por pavimento: Ae = l1 × altura de influência)
 *   S2 = b · Fr · (z/10)^p          rugosidade do terreno, dimensões da edificação e altura z (m)
 *
 * Valores de b, p, Fr e zg da Tabela 1 e de S3 da Tabela 3 da NBR 6123:1988. A NBR 6123 foi revisada em
 * dezembro de 2023: os parâmetros e o mapa de isopletas devem ser conferidos com a edição em vigor.
 *
 * Coeficiente de arrasto: a norma dá Ca nos ábacos das Figuras 4 (vento de baixa turbulência) e 5 (alta
 * turbulência), em função de l1/l2 e h/l1. Aqui há uma estimativa interpolada para baixa turbulência
 * (coefArrastoEstimado) — o valor lido no ábaco pode ser informado no lugar dela.
 */

/** Categorias de rugosidade do terreno (5.3.1) e parâmetros da Tabela 1. */
export const CATEGORIAS = {
  I: { nome: 'Categoria I', desc: 'Superfícies lisas de grandes dimensões: mar calmo, lagos, rios, pântanos sem vegetação', zg: 250, b: { A: 1.1, B: 1.11, C: 1.12 }, p: { A: 0.06, B: 0.065, C: 0.07 } },
  II: { nome: 'Categoria II', desc: 'Terrenos abertos em nível, com poucos obstáculos isolados (cota média dos obstáculos ≤ 1 m)', zg: 300, b: { A: 1.0, B: 1.0, C: 1.0 }, p: { A: 0.085, B: 0.09, C: 0.1 } },
  III: { nome: 'Categoria III', desc: 'Terrenos planos ou ondulados com obstáculos: sebes, muros, casas de campo esparsas (cota média ≈ 3 m)', zg: 350, b: { A: 0.94, B: 0.94, C: 0.93 }, p: { A: 0.1, B: 0.105, C: 0.115 } },
  IV: { nome: 'Categoria IV', desc: 'Terrenos com muitos obstáculos pouco espaçados: subúrbios, zonas industriais, cidades pequenas (cota média ≈ 10 m)', zg: 420, b: { A: 0.86, B: 0.85, C: 0.84 }, p: { A: 0.12, B: 0.125, C: 0.135 } },
  V: { nome: 'Categoria V', desc: 'Terrenos com obstáculos numerosos, grandes e altos: centros de grandes cidades (cota média ≥ 25 m)', zg: 500, b: { A: 0.74, B: 0.73, C: 0.71 }, p: { A: 0.15, B: 0.16, C: 0.175 } },
};
/** Fator de rajada Fr (sempre o da categoria II), por classe. */
export const FR = { A: 1.0, B: 0.98, C: 0.95 };

/** Classes de edificação pela maior dimensão horizontal ou vertical da superfície frontal (5.3.2). */
export const CLASSES = {
  A: 'Maior dimensão ≤ 20 m (rajada de 3 s)',
  B: 'Maior dimensão entre 20 e 50 m (rajada de 5 s)',
  C: 'Maior dimensão > 50 m (rajada de 10 s)',
};
export const classeDaEdificacao = (maiorDimensao) => (maiorDimensao <= 20 ? 'A' : maiorDimensao <= 50 ? 'B' : 'C');

/** Fator estatístico S3 (Tabela 3). */
export const GRUPOS_S3 = {
  1: { S3: 1.1, desc: 'Edificações cuja ruína total ou parcial pode afetar a segurança ou a socorro após tempestades (hospitais, quartéis, centrais de comunicação)' },
  2: { S3: 1.0, desc: 'Edificações para hotéis, residências, comércio e indústria com alto fator de ocupação' },
  3: { S3: 0.95, desc: 'Edificações e instalações industriais com baixo fator de ocupação (depósitos, silos)' },
  4: { S3: 0.88, desc: 'Vedações (telhas, vidros, painéis de vedação)' },
  5: { S3: 0.83, desc: 'Edificações temporárias e estruturas dos grupos 1 a 3 durante a construção' },
};

/** Fator topográfico S1 (5.2): terreno plano ou fracamente acidentado 1,0; vales profundos protegidos 0,9. */
export const TOPOGRAFIAS = { plano: { S1: 1.0, desc: 'Terreno plano ou fracamente acidentado' }, vale: { S1: 0.9, desc: 'Vale profundo, protegido de ventos de qualquer direção' } };

/** S2 = b · Fr · (z/10)^p, com z limitado à altura gradiente zg. */
export function fatorS2({ z, categoria = 'IV', classe = 'A' }) {
  const cat = CATEGORIAS[categoria];
  if (!cat) throw new Error(`Categoria de rugosidade "${categoria}" inválida (I a V).`);
  if (!FR[classe]) throw new Error(`Classe "${classe}" inválida (A, B ou C).`);
  const zz = Math.min(Math.max(z, 0), cat.zg);
  return cat.b[classe] * FR[classe] * (zz / 10) ** cat.p[classe];
}

/** Pressão dinâmica (kN/m²) para a velocidade característica Vk (m/s). */
export const pressaoDinamica = (Vk) => (0.613 * Vk * Vk) / 1000;

/*
 * Estimativa de Ca para vento de baixa turbulência (Figura 4), por interpolação em l1/l2 (face exposta /
 * profundidade) e h/l1. ESTIMATIVA: confira no ábaco da norma; o projeto pode informar o valor lido.
 */
const CA_R = [0.25, 0.5, 1, 2, 4];
const CA_BASE = [0.85, 0.95, 1.1, 1.3, 1.5];     // h/l1 = 1
const CA_T = [0.25, 0.5, 1, 2, 4, 6];
const CA_FT = [0.85, 0.92, 1.0, 1.08, 1.15, 1.18];
function interpLog(xs, ys, x) {
  const lx = Math.log(Math.min(Math.max(x, xs[0]), xs[xs.length - 1]));
  for (let i = 1; i < xs.length; i++) {
    const a = Math.log(xs[i - 1]), b = Math.log(xs[i]);
    if (lx <= b + 1e-12) return ys[i - 1] + ((ys[i] - ys[i - 1]) * (lx - a)) / (b - a);
  }
  return ys[ys.length - 1];
}
export function coefArrastoEstimado(l1, l2, h) {
  const ca = interpLog(CA_R, CA_BASE, l1 / l2) * interpLog(CA_T, CA_FT, h / l1);
  return Math.round(Math.min(2.2, Math.max(0.7, ca)) * 100) / 100;
}

/**
 * Forças de vento por pavimento nas quatro direções.
 * @param {object} p
 * @param {number} p.V0  velocidade básica (m/s), do mapa de isopletas (Figura 1)
 * @param {number} [p.S1] @param {string} p.categoria @param {string} [p.classe] (padrão: pela maior dimensão)
 * @param {number|string} [p.grupo] grupo de S3 (1 a 5) @param {number} [p.S3] (sobrepõe o grupo)
 * @param {number} p.Lx @param {number} p.Ly  dimensões em planta (m)
 * @param {{id:string, nome?:string, z:number}[]} p.niveis  cotas dos pavimentos acima do terreno (m), de baixo para cima
 * @param {{x?:number|null, y?:number|null}} [p.Ca]  Ca informado para o vento em x (0°/180°) e em y (90°/270°)
 */
export function forcasDeVento({ V0, S1 = 1, categoria = 'IV', classe = null, grupo = 2, S3 = null, Lx, Ly, niveis, Ca = {} }) {
  if (!(V0 > 0)) throw new Error('Informe a velocidade básica V0 (m/s) do mapa de isopletas.');
  if (!(Lx > 0 && Ly > 0)) throw new Error('As dimensões em planta do edifício precisam ser positivas.');
  const ns = [...niveis].filter((n) => n.z > 0).sort((a, b) => a.z - b.z);
  if (!ns.length) throw new Error('Não há pavimentos acima do terreno.');
  const h = ns[ns.length - 1].z;
  const cls = classe ?? classeDaEdificacao(Math.max(Lx, Ly, h));
  const s3 = S3 ?? GRUPOS_S3[grupo]?.S3 ?? 1;
  // 0° e 180°: vento ao longo de X, face exposta l1 = Ly; 90° e 270°: ao longo de Y, l1 = Lx
  const dir = (eixo) => {
    const l1 = eixo === 'x' ? Ly : Lx, l2 = eixo === 'x' ? Lx : Ly;
    const est = coefArrastoEstimado(l1, l2, h);
    const inf = Number(Ca?.[eixo]);
    return { eixo, l1, l2, l1l2: l1 / l2, hl1: h / l1, CaEstimado: est, Ca: Number.isFinite(inf) && inf > 0 ? inf : est, informado: Number.isFinite(inf) && inf > 0 };
  };
  const dx = dir('x'), dy = dir('y');
  const pav = ns.map((n, k) => {
    const zAbaixo = k ? ns[k - 1].z : 0, zAcima = k < ns.length - 1 ? ns[k + 1].z : n.z;
    const hInf = (n.z - zAbaixo) / 2 + (zAcima - n.z) / 2;
    const S2 = fatorS2({ z: n.z, categoria, classe: cls });
    const Vk = V0 * S1 * S2 * s3;
    const q = pressaoDinamica(Vk);
    return { id: n.id, nome: n.nome, z: n.z, hInf, S2, Vk, q, Fx: dx.Ca * q * dx.l1 * hInf, Fy: dy.Ca * q * dy.l1 * hInf };
  });
  const soma = (k) => pav.reduce((s, p) => s + p[k], 0);
  const momento = (k) => pav.reduce((s, p) => s + p[k] * p.z, 0);
  return {
    V0, S1, S3: s3, categoria, classe: cls, h, Lx, Ly, direcoes: { x: dx, y: dy }, pavimentos: pav,
    totais: { Fx: soma('Fx'), Fy: soma('Fy'), Mx: momento('Fx'), My: momento('Fy') },
  };
}

/** Vetor da força de um pavimento no caso de vento de ângulo a (0°, 90°, 180°, 270°). */
export function forcaNaDirecao(pav, angulo) {
  const r = (angulo * Math.PI) / 180;
  const c = Math.round(Math.cos(r)), s = Math.round(Math.sin(r));
  return [c * pav.Fx, s * pav.Fy];
}
