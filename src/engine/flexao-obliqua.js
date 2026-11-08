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
 * Flexão composta oblíqua em seção retangular — NBR 6118:2023, 17.2 (ELU de solicitações normais)
 * e 11.3.3.4.3 / 15.3.2 (envoltória mínima de 1ª ordem com efeitos de 2ª ordem).
 *
 * Linha neutra em qualquer direção, por compatibilidade de deformações (domínios 1 a 5),
 * diagrama retangular para o concreto (profundidade λ·x medida perpendicularmente à linha neutra)
 * e bilinear para o aço. Quando a linha neutra é inclinada, a largura da zona comprimida diminui
 * em direção à borda mais comprimida, e a tensão do bloco é multiplicada por 0,9 (17.2.2; conferir o
 * fator na NBR 6118:2023 — a versão de 2014 trocava 0,85·fcd por 0,80·fcd).
 *
 * A curva de interação usa a tensão reduzida em todas as direções, para não criar "picos" nos eixos;
 * pontos de cálculo exatamente sobre um eixo (flexão normal) usam o MRd da flexão normal, com a tensão
 * plena, como antes.
 *
 * Sistema: seção bx (direção x) × by (direção y), origem num canto; barras em {x, y} (cm). Uma seção não retangular
 * (o pilar circular, 0.33) informa `contorno`, um polígono dentro do quadrado bx × by, com o centro em (bx/2, by/2).
 * Mx = momento que comprime a face x = bx (flexão "na direção x", altura bx);
 * My = momento que comprime a face y = by. Esforços em kN e kN·m.
 */

/** Redução da tensão do bloco quando a largura comprimida diminui para a borda (17.2.2). */
export const FATOR_INCLINADA = 0.9;

/** Recorta o polígono pela meia-região z(p) ≥ zc (Sutherland–Hodgman). */
function recortar(poligono, z, zc) {
  const out = [];
  for (let i = 0; i < poligono.length; i++) {
    const a = poligono[i], b = poligono[(i + 1) % poligono.length];
    const za = z(a) - zc, zb = z(b) - zc;
    if (za >= 0) out.push(a);
    if ((za >= 0) !== (zb >= 0)) {
      const t = za / (za - zb);
      out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
    }
  }
  return out;
}

/** Área e centroide de um polígono. */
function areaCentroide(p) {
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    const cr = a.x * b.y - b.x * a.y;
    A += cr; cx += (a.x + b.x) * cr; cy += (a.y + b.y) * cr;
  }
  A /= 2;
  if (Math.abs(A) < 1e-12) return { A: 0, x: 0, y: 0 };
  return { A: Math.abs(A), x: cx / (6 * A), y: cy / (6 * A) };
}

/**
 * Esforços resistentes para uma linha neutra de direção θ e profundidade x.
 * @param {number} teta  ângulo (rad) da normal à linha neutra que aponta para a borda comprimida
 * @param {number} x     profundidade da linha neutra a partir do ponto mais comprimido (cm)
 * @param {{bx:number, by:number, barras:{x:number,y:number,A:number}[]}} sec
 * @returns {{N:number, Mx:number, My:number}}  N em kN (compressão +), momentos em kN·m
 */
export function esforcosObliqua(teta, x, sec, c, s, { fatorBloco = null } = {}) {
  const { bx, by, barras } = sec;
  const nx = Math.cos(teta), ny = Math.sin(teta);
  const xc = bx / 2, yc = by / 2;
  const z = (p) => (p.x - xc) * nx + (p.y - yc) * ny;
  // contorno da seção: o retângulo bx × by ou um polígono informado (seção circular, 0.33)
  const cantos = sec.contorno ?? [{ x: 0, y: 0 }, { x: bx, y: 0 }, { x: bx, y: by }, { x: 0, y: by }];
  const zs = cantos.map(z);
  const zMax = Math.max(...zs), zMin = Math.min(...zs);
  const H = zMax - zMin;
  const prof = (p) => zMax - z(p);                     // profundidade a partir do ponto mais comprimido
  const d = Math.max(...barras.map(prof));

  const ecu = c.ecu / 1000, ec2 = c.ec2 / 1000, esu = 0.010;
  const x23 = (ecu / (ecu + esu)) * d;
  let kappa;
  if (x <= x23) kappa = esu / (d - x);
  else if (x <= H) kappa = ecu / x;
  else kappa = ec2 / (x - (1 - ec2 / ecu) * H);

  // seção circular: a largura comprimida sempre diminui para a borda — 0,9 em qualquer direção (17.2.2)
  const inclinada = !!sec.contorno || Math.abs(Math.sin(2 * teta)) > 1e-6;
  const scd = (c.sigmaCd / 10) * (fatorBloco ?? (inclinada ? FATOR_INCLINADA : 1));
  const a = Math.max(0, Math.min(c.lambda * x, H));
  const comp = a > 0 ? areaCentroide(recortar(cantos, z, zMax - a)) : { A: 0, x: 0, y: 0 };
  const Fc = scd * comp.A;
  let N = Fc, Mx = Fc * (comp.x - xc), My = Fc * (comp.y - yc);
  const fyd = s.fyd / 10, Es = s.Es / 10;
  for (const br of barras) {
    const eps = kappa * (x - prof(br));
    const sig = Math.max(-fyd, Math.min(fyd, Es * eps));
    N += sig * br.A;
    Mx += sig * br.A * (br.x - xc);
    My += sig * br.A * (br.y - yc);
  }
  return { N, Mx: Mx / 100, My: My / 100 };
}

/**
 * Curva de interação Mx–My para a normal Nd (kN): pontos resistentes varrendo a direção da linha neutra.
 * @returns {{pontos:{x:number,y:number}[], Nmax:number, ok:boolean}}  x = MRd,x e y = MRd,y (kN·m)
 */
export function curvaInteracao(Nd, sec, c, s, { passos = 72, fatorBloco = FATOR_INCLINADA } = {}) {
  const H = Math.hypot(sec.bx, sec.by);
  const pontos = [];
  let Nmax = Infinity;
  for (let k = 0; k < passos; k++) {
    const teta = (2 * Math.PI * k) / passos;
    let lo = 1e-4, hi = 200 * H;
    const op = { fatorBloco };
    const Ntopo = esforcosObliqua(teta, hi, sec, c, s, op).N;
    Nmax = Math.min(Nmax, Ntopo);
    if (Nd > Ntopo) return { pontos: [], Nmax: Ntopo, ok: false };
    for (let it = 0; it < 70; it++) {
      const mid = (lo + hi) / 2;
      if (esforcosObliqua(teta, mid, sec, c, s, op).N < Nd) lo = mid; else hi = mid;
    }
    const r = esforcosObliqua(teta, (lo + hi) / 2, sec, c, s, op);
    pontos.push({ x: r.Mx, y: r.My });
  }
  pontos.sort((p, q) => Math.atan2(p.y, p.x) - Math.atan2(q.y, q.x));
  return { pontos, Nmax, ok: true };
}

/**
 * Momento resistente da curva na direção do ponto (Mx, My): interseção do raio com o polígono.
 * @returns {{MRd:number, uso:number}}  MRd = |M| resistente nessa direção; uso = |MSd|/MRd
 */
export function resistenciaNaDirecao(curva, Mx, My) {
  const M = Math.hypot(Mx, My);
  const ang = M > 1e-9 ? Math.atan2(My, Mx) : 0;
  const ux = Math.cos(ang), uy = Math.sin(ang);
  let melhor = null;
  const n = curva.length;
  for (let i = 0; i < n; i++) {
    const a = curva[i], b = curva[(i + 1) % n];
    // resolve t·u = a + s·(b − a), t > 0, 0 ≤ s ≤ 1
    const ex = b.x - a.x, ey = b.y - a.y;
    const den = ux * ey - uy * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = (a.x * ey - a.y * ex) / den;
    const sp = (a.x * uy - a.y * ux) / den;
    if (t > 0 && sp >= -1e-9 && sp <= 1 + 1e-9 && (!melhor || t < melhor)) melhor = t;
  }
  const MRd = melhor ?? 0;
  return { MRd, uso: MRd > 0 ? M / MRd : Infinity };
}

/**
 * Verifica pontos de cálculo contra a curva. Cada ponto: {nome, Mx, My, tipo}.
 * @returns {{pontos:object[], usoMax:number, ok:boolean}}
 */
export function verificarPontos(curva, pontos, { MRdx = null, MRdy = null } = {}) {
  const r = pontos.map((p) => {
    // ponto sobre um eixo: flexão composta normal, com a tensão plena do bloco
    if (MRdx && Math.abs(p.My) < 1e-9 && Math.abs(p.Mx) > 1e-9) return { ...p, MRd: MRdx, uso: Math.abs(p.Mx) / MRdx };
    if (MRdy && Math.abs(p.Mx) < 1e-9 && Math.abs(p.My) > 1e-9) return { ...p, MRd: MRdy, uso: Math.abs(p.My) / MRdy };
    return { ...p, ...resistenciaNaDirecao(curva, p.Mx, p.My) };
  });
  const usoMax = Math.max(0, ...r.map((p) => (Math.hypot(p.Mx, p.My) < 1e-9 ? 0 : p.uso)));
  return { pontos: r, usoMax, ok: usoMax <= 1 + 1e-6 };
}

/** Contorno poligonal de um círculo de diâmetro D (cm), centrado em (D/2, D/2), para a seção circular. */
export function contornoCircular(D, n = 72) {
  return Array.from({ length: n }, (_, k) => {
    const a = (2 * Math.PI * k) / n;
    return { x: D / 2 + (D / 2) * Math.cos(a), y: D / 2 + (D / 2) * Math.sin(a) };
  });
}

/** Pontos da envoltória mínima de 1ª ordem com 2ª ordem: (Mx/Mx,mín)² + (My/My,mín)² = 1 (11.3.3.4.3). */
export function envoltoriaMinima(MxMin, MyMin, n = 24) {
  return Array.from({ length: n }, (_, k) => {
    const a = (2 * Math.PI * k) / n;
    return { Mx: MxMin * Math.cos(a), My: MyMin * Math.sin(a) };
  });
}
