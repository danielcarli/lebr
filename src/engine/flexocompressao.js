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
 * Flexo-compressão normal em seções retangulares e cálculo de pilares
 * — NBR 6118:2023, 15 (efeitos de 2ª ordem) e 17.2 (ELU de solicitações normais).
 *
 * A seção é verificada por compatibilidade de deformações (domínios 1 a 5),
 * com diagrama retangular para o concreto e diagrama bilinear para o aço.
 * Dimensões em cm, esforços em kN e kN·m.
 */
import { BITOLAS, areaBarra, espacamentoLivreMin, rotuloBarras } from './barras.js';
import { curvaInteracao, verificarPontos, envoltoriaMinima, contornoCircular, resistenciaNaDirecao } from './flexao-obliqua.js';

/**
 * Esforços resistentes para uma posição x da linha neutra.
 * @param {number} x profundidade da LN a partir da face mais comprimida (cm)
 * @param {{b:number,h:number,barras:{y:number,A:number}[]}} sec  y = profundidade da barra (cm)
 * @returns {{N:number, M:number}} N em kN (compressão +), M em kN·cm em relação ao centro
 */
export function esforcosResistentes(x, sec, c, s) {
  const { b, h, barras } = sec;
  const ecu = c.ecu / 1000, ec2 = c.ec2 / 1000, esu = 0.010;
  const d = Math.max(...barras.map((br) => br.y));
  const x23 = (ecu / (ecu + esu)) * d;

  let kappa;
  if (x <= x23) kappa = esu / (d - x);                       // pivô A
  else if (x <= h) kappa = ecu / x;                          // pivô B
  else kappa = ec2 / (x - (1 - ec2 / ecu) * h);              // pivô C

  const scd = c.sigmaCd / 10, fyd = s.fyd / 10, Es = s.Es / 10;
  const a = Math.max(0, Math.min(c.lambda * x, h));
  const Fc = scd * b * a;
  let N = Fc;
  let M = Fc * (h / 2 - a / 2);
  for (const br of barras) {
    const eps = kappa * (x - br.y);
    const sig = Math.max(-fyd, Math.min(fyd, Es * eps));
    N += sig * br.A;
    M += sig * br.A * (h / 2 - br.y);
  }
  return { N, M };
}

/** Momento resistente (kN·m) da seção sob a normal Nd (kN, compressão +). */
export function momentoResistente(Nd, sec, c, s) {
  let lo = 1e-4, hi = 200 * sec.h;
  const Nmax = esforcosResistentes(hi, sec, c, s).N;
  if (Nd > Nmax) return { MRd: 0, Nmax, ok: false };
  for (let it = 0; it < 80; it++) {
    const mid = (lo + hi) / 2;
    if (esforcosResistentes(mid, sec, c, s).N < Nd) lo = mid; else hi = mid;
  }
  const x = (lo + hi) / 2;
  return { MRd: esforcosResistentes(x, sec, c, s).M / 100, x, Nmax, ok: true };
}

/**
 * Armadura simétrica em duas faces opostas (flexo-compressão normal) para Nd e Md dados — o mesmo arranjo dos ábacos
 * de flexão normal (As/2 a d' de cada face). Usado para comparar com exemplos resolvidos por ábaco.
 * @returns {{As:number, omega:number, nu:number, mu:number, ok:boolean}}  As em cm²
 */
export function armaduraDuasFaces({ Nd, Md, b, h, dl, c, s }) {
  const sec = (As) => ({ b, h, barras: [{ y: dl, A: As / 2 }, { y: h - dl, A: As / 2 }] });
  const resiste = (As) => { const r = momentoResistente(Nd, sec(As), c, s); return r.ok && r.MRd >= Md; };
  const fcd = c.fcd / 10, fyd = s.fyd / 10, Ac = b * h;
  let lo = 0, hi = 0.08 * Ac;
  const nu = Nd / (Ac * fcd), mu = (Md * 100) / (Ac * h * fcd);
  if (!resiste(hi)) return { As: NaN, omega: NaN, nu, mu, ok: false };
  if (resiste(0)) return { As: 0, omega: 0, nu, mu, ok: true };
  for (let it = 0; it < 60; it++) { const m = (lo + hi) / 2; if (resiste(m)) hi = m; else lo = m; }
  return { As: hi, omega: (hi * fyd) / (Ac * fcd), nu, mu, ok: true };
}

/** Distribui n barras no contorno de uma seção bx × by (coordenadas do centro das barras, cm). */
export function distribuirBarras({ bx, by, n, o }) {
  let kx = 0, ky = 0; // barras intermediárias por face paralela a x / a y
  for (let r = n - 4; r >= 2; r -= 2) {
    if ((bx - 2 * o) / (kx + 1) >= (by - 2 * o) / (ky + 1)) kx++; else ky++;
  }
  const pts = [];
  const lin = (a, b, k) => Array.from({ length: k + 2 }, (_, i) => a + ((b - a) * i) / (k + 1));
  for (const x of lin(o, bx - o, kx)) { pts.push({ x, y: o }); pts.push({ x, y: by - o }); }
  for (const y of lin(o, by - o, ky).slice(1, -1)) { pts.push({ x: o, y }); pts.push({ x: bx - o, y }); }
  return { pontos: pts, kx, ky };
}

/**
 * Esforços de cálculo em uma direção (pilar-padrão com curvatura aproximada, 15.8.3.3.2).
 * @param {object} p  h = dimensão na direção considerada (cm), le em cm, momentos em kN·m (já majorados)
 */
export function momentoTotal({ Nd, h, b, le, MA = 0, MB = 0, c, i = null, Ac = null }) {
  const hm = h / 100;
  // λ = le/i: retângulo i = h/√12 (λ = 3,46·le/h); círculo i = D/4 (λ = 4·le/D)
  const lambda = i ? le / i : (3.46 * le) / h;
  const M1min = Nd * (0.015 + 0.03 * hm);
  const usaMin = Math.abs(MA) < M1min;
  const M1 = Math.max(Math.abs(MA), M1min);
  const alfaB = usaMin || MA === 0 ? 1 : Math.max(0.4, 0.6 + 0.4 * (MB / MA));
  const e1 = Math.abs(MA) / Nd * 100; // cm
  const lambda1 = Math.min(90, Math.max(35, (25 + 12.5 * (e1 / h)) / alfaB));
  const nu = Nd / ((Ac ?? b * h) * (c.fcd / 10));

  const r = { lambda, lambda1, M1min, M1, alfaB, nu, M2: 0, segundaOrdem: false, metodo: '—', ok: true, avisos: [] };
  if (lambda > 200) { r.ok = false; r.avisos.push('λ > 200: pilar não permitido pela norma.'); }
  else if (lambda > 90) { r.ok = false; r.avisos.push('λ > 90: exige processo mais refinado (fora do escopo deste protótipo).'); }

  if (lambda <= lambda1) {
    r.Md = M1;
    r.metodo = 'Efeitos de 2ª ordem desprezados (λ ≤ λ1)';
  } else {
    const curv = Math.min(0.005 / (hm * (nu + 0.5)), 0.005 / hm); // 1/r (1/m)
    r.M2 = (Nd * (le / 100) ** 2 / 10) * curv;
    r.Md = Math.max(alfaB * M1 + r.M2, M1);
    r.curvatura = curv;
    r.segundaOrdem = true;
    r.metodo = 'Pilar-padrão com curvatura aproximada';
  }
  return r;
}

/**
 * Dimensiona um pilar retangular: busca o arranjo de menor área de aço que
 * resiste às solicitações nas duas direções (flexo-compressão normal em cada uma).
 */
export function dimensionarPilar({ bx, by, lex, ley, Nd, Mx = {}, My = {}, cob, dmax = 19, c, s, phiL = null, phiT: phiTFixo = null }) {
  const bmin = Math.min(bx, by);
  const Ac = bx * by;
  const dirX = momentoTotal({ Nd, h: bx, b: by, le: lex, MA: Mx.A ?? 0, MB: Mx.B ?? 0, c });
  const dirY = momentoTotal({ Nd, h: by, b: bx, le: ley, MA: My.A ?? 0, MB: My.B ?? 0, c });

  // pontos de cálculo da flexão oblíqua (17.2 e 11.3.3.4.3)
  const real = (dir, MA) => (dir.segundaOrdem ? Math.max(dir.alfaB * Math.abs(MA) + dir.M2, Math.abs(MA)) : Math.abs(MA));
  const minX = momentoTotal({ Nd, h: bx, b: by, le: lex, c }).Md;
  const minY = momentoTotal({ Nd, h: by, b: bx, le: ley, c }).Md;
  const pontosCalculo = [
    ...envoltoriaMinima(minX, minY).map((p) => ({ ...p, tipo: 'minima', nome: 'Envoltória mínima com 2ª ordem' })),
  ];
  const MAx = Math.abs(Mx.A ?? 0), MAy = Math.abs(My.A ?? 0);
  if (MAx > 1e-9 || MAy > 1e-9) {
    pontosCalculo.push({ Mx: MAx, My: MAy, tipo: 'extremidade', nome: 'Topo ou base (1ª ordem)' });
    pontosCalculo.push({ Mx: real(dirX, MAx), My: real(dirY, MAy), tipo: 'intermediaria', nome: 'Seção intermediária (com 2ª ordem)' });
  }

  const AsMin = Math.max((0.15 * Nd) / (s.fyd / 10), 0.004 * Ac);
  const AsMax = 0.04 * Ac;

  const candidatos = [];
  // bitola escolhida pelo usuário ou todas as usuais (10 a 25 mm), sempre com ø ≤ b/8 (18.4.2.1)
  const bitolas = phiL ? [phiL] : BITOLAS.filter((f) => f >= 10 && f <= 25);
  for (const phi of bitolas.filter((f) => f / 10 <= bmin / 8)) {
    const phiT = phiTFixo ?? (phi >= 25 ? 6.3 : 5);
    const o = cob + phiT / 10 + phi / 20;
    for (let n = 4; n <= 24; n += 2) {
      const As = n * areaBarra(phi);
      if (As < AsMin - 1e-9) continue;
      if (As > AsMax) break;
      candidatos.push({ phi, n, As, phiT, o });
    }
  }
  candidatos.sort((a, b) => a.As - b.As || a.n - b.n);

  let escolha = null;
  for (const cand of candidatos) {
    const { pontos, kx, ky } = distribuirBarras({ bx, by, n: cand.n, o: cand.o });
    // espaçamentos (18.4.2.2)
    const ccx = (bx - 2 * cand.o) / (kx + 1), ccy = (by - 2 * cand.o) / (ky + 1);
    const livreMin = espacamentoLivreMin(cand.phi, dmax);
    if (Math.min(ccx, ccy) - cand.phi / 10 < livreMin) continue;
    if (Math.max(ccx, ccy) > Math.min(2 * bmin, 40)) continue;

    const A = areaBarra(cand.phi);
    const secX = { b: by, h: bx, barras: pontos.map((p) => ({ y: p.x, A })) };
    const secY = { b: bx, h: by, barras: pontos.map((p) => ({ y: p.y, A })) };
    const rx = momentoResistente(Nd, secX, c, s);
    const ry = momentoResistente(Nd, secY, c, s);
    if (rx.ok && ry.ok && rx.MRd >= dirX.Md && ry.MRd >= dirY.Md) {
      // flexão oblíqua: a curva Mx–My da seção precisa conter todos os pontos de cálculo
      const sec = { bx, by, barras: pontos.map((p) => ({ x: p.x, y: p.y, A })) };
      const curva = curvaInteracao(Nd, sec, c, s);
      if (!curva.ok) continue;
      const verif = verificarPontos(curva.pontos, pontosCalculo, { MRdx: rx.MRd, MRdy: ry.MRd });
      if (!verif.ok) continue;
      escolha = { ...cand, pontos, kx, ky, ccx, ccy, MRdx: rx.MRd, MRdy: ry.MRd, Nmax: rx.Nmax, curva: curva.pontos, obliqua: verif };
      break;
    }
  }

  const r = { bx, by, Ac, Nd, dirX, dirY, AsMin, AsMax, escolha, pontosCalculo, minimos: { x: minX, y: minY }, ok: !!escolha && dirX.ok && dirY.ok, avisos: [...dirX.avisos, ...dirY.avisos] };
  if (phiL && phiL / 10 > bmin / 8) r.avisos.push(`A bitola ø ${String(phiL).replace('.', ',')} passa de b/8 = ${String(Math.round(bmin * 12.5) / 10).replace('.', ',')} mm (18.4.2.1) — escolha uma bitola menor.`);
  else if (!escolha) r.avisos.push(phiL
    ? `Nenhum arranjo com ø ${String(phiL).replace('.', ',')} atende (As ≤ 4% Ac e espaçamentos de 18.4.2.2) — troque a bitola ou aumente a seção.`
    : 'Nenhum arranjo com As ≤ 4% Ac atende às solicitações — aumente a seção ou o fck.');
  if (escolha) {
    escolha.rotulo = rotuloBarras(escolha.n, escolha.phi);
    // estribos (18.4.3)
    const sEst = Math.floor(Math.min(20, bmin, 12 * escolha.phi / 10));
    escolha.estribo = { phi: escolha.phiT, s: sEst, rotulo: `ø ${String(escolha.phiT).replace('.', ',')} c/ ${sEst}` };
    // øt ≥ 5 mm e ≥ ø/4 (18.4.3)
    escolha.estribo.ok = escolha.phiT >= 5 && escolha.phiT >= escolha.phi / 4 - 1e-9;
    if (!escolha.estribo.ok) r.avisos.push(`Estribo ø ${String(escolha.phiT).replace('.', ',')} menor que ø/4 = ${String(escolha.phi / 4).replace('.', ',')} mm (18.4.3) — escolha um estribo maior.`);
  }
  return r;
}

/** Barras igualmente espaçadas num círculo de raio R, centrado em (D/2, D/2) — seção circular (cm). */
export function distribuirBarrasCirculo({ D, n, o }) {
  const R = D / 2 - o;
  return Array.from({ length: n }, (_, k) => {
    const a = Math.PI / 2 + (2 * Math.PI * k) / n;       // a primeira barra no topo da seção (y máximo)
    return { x: Math.round((D / 2 + R * Math.cos(a)) * 1000) / 1000, y: Math.round((D / 2 + R * Math.sin(a)) * 1000) / 1000 };
  });
}

/**
 * Dimensiona um pilar circular de diâmetro D (cm): no mínimo 6 barras igualmente espaçadas no contorno (18.4.2.1),
 * espaçamentos de 18.4.2.2 medidos no círculo das barras, λ = 4·le/D, momento mínimo e 2ª ordem por curvatura
 * aproximada em cada direção (h = D) e a curva de interação da seção circular para a flexão oblíqua — como a seção é
 * simétrica, a verificação é a do momento resultante.
 */
export function dimensionarPilarCircular({ D, lex, ley, Nd, Mx = {}, My = {}, cob, dmax = 19, c, s, phiL = null, phiT: phiTFixo = null }) {
  const Ac = (Math.PI * D * D) / 4, i = D / 4;
  const dirX = momentoTotal({ Nd, h: D, b: D, le: lex, MA: Mx.A ?? 0, MB: Mx.B ?? 0, c, i, Ac });
  const dirY = momentoTotal({ Nd, h: D, b: D, le: ley, MA: My.A ?? 0, MB: My.B ?? 0, c, i, Ac });
  const real = (dir, MA) => (dir.segundaOrdem ? Math.max(dir.alfaB * Math.abs(MA) + dir.M2, Math.abs(MA)) : Math.abs(MA));
  const minX = momentoTotal({ Nd, h: D, b: D, le: lex, c, i, Ac }).Md;
  const minY = momentoTotal({ Nd, h: D, b: D, le: ley, c, i, Ac }).Md;
  const pontosCalculo = [...envoltoriaMinima(minX, minY).map((p) => ({ ...p, tipo: 'minima', nome: 'Envoltória mínima com 2ª ordem' }))];
  const MAx = Math.abs(Mx.A ?? 0), MAy = Math.abs(My.A ?? 0);
  if (MAx > 1e-9 || MAy > 1e-9) {
    pontosCalculo.push({ Mx: MAx, My: MAy, tipo: 'extremidade', nome: 'Topo ou base (1ª ordem)' });
    pontosCalculo.push({ Mx: real(dirX, MAx), My: real(dirY, MAy), tipo: 'intermediaria', nome: 'Seção intermediária (com 2ª ordem)' });
  }
  // pontos sobre os eixos também com o momento total de cada direção (a seção é a mesma em qualquer direção)
  pontosCalculo.push({ Mx: dirX.Md, My: 0, tipo: 'direcao', nome: 'Direção x (com 2ª ordem)' }, { Mx: 0, My: dirY.Md, tipo: 'direcao', nome: 'Direção y (com 2ª ordem)' });

  const AsMin = Math.max((0.15 * Nd) / (s.fyd / 10), 0.004 * Ac);
  const AsMax = 0.04 * Ac;
  const contorno = contornoCircular(D);
  const candidatos = [];
  const bitolas = phiL ? [phiL] : BITOLAS.filter((f) => f >= 10 && f <= 25);
  for (const phi of bitolas.filter((f) => f / 10 <= D / 8)) {
    const phiT = phiTFixo ?? (phi >= 25 ? 6.3 : 5);
    const o = cob + phiT / 10 + phi / 20;
    for (let n = 6; n <= 30; n++) {
      const As = n * areaBarra(phi);
      if (As < AsMin - 1e-9) continue;
      if (As > AsMax) break;
      candidatos.push({ phi, n, As, phiT, o });
    }
  }
  candidatos.sort((a, b) => a.As - b.As || a.n - b.n);
  let escolha = null;
  for (const cand of candidatos) {
    // espaçamento entre eixos medido na corda entre barras vizinhas do círculo (18.4.2.2)
    const R = D / 2 - cand.o;
    const eixos = 2 * R * Math.sin(Math.PI / cand.n);
    if (eixos - cand.phi / 10 < espacamentoLivreMin(cand.phi, dmax)) continue;
    if (eixos > Math.min(2 * D, 40)) continue;
    const pontos = distribuirBarrasCirculo({ D, n: cand.n, o: cand.o });
    const A = areaBarra(cand.phi);
    const sec = { bx: D, by: D, contorno, barras: pontos.map((p) => ({ x: p.x, y: p.y, A })) };
    const curva = curvaInteracao(Nd, sec, c, s);
    if (!curva.ok) continue;
    const verif = verificarPontos(curva.pontos, pontosCalculo);
    if (!verif.ok) continue;
    const MRdx = resistenciaNaDirecao(curva.pontos, 1, 0).MRd, MRdy = resistenciaNaDirecao(curva.pontos, 0, 1).MRd;
    escolha = { ...cand, pontos, kx: 0, ky: 0, ccx: eixos, ccy: eixos, raio: R, MRdx, MRdy, Nmax: curva.Nmax, curva: curva.pontos, obliqua: verif };
    break;
  }
  const r = { forma: 'circular', D, bx: D, by: D, Ac, Nd, dirX, dirY, AsMin, AsMax, escolha, pontosCalculo, minimos: { x: minX, y: minY }, ok: !!escolha && dirX.ok && dirY.ok, avisos: [...dirX.avisos, ...dirY.avisos] };
  if (phiL && phiL / 10 > D / 8) r.avisos.push(`A bitola ø ${String(phiL).replace('.', ',')} passa de D/8 = ${String(Math.round(D * 12.5) / 10).replace('.', ',')} mm (18.4.2.1) — escolha uma bitola menor.`);
  else if (!escolha) r.avisos.push(phiL
    ? `Nenhum arranjo com ø ${String(phiL).replace('.', ',')} atende (As ≤ 4% Ac, mínimo de 6 barras e espaçamentos de 18.4.2.2) — troque a bitola ou aumente o diâmetro.`
    : 'Nenhum arranjo com As ≤ 4% Ac atende às solicitações — aumente o diâmetro ou o fck.');
  if (escolha) {
    escolha.rotulo = rotuloBarras(escolha.n, escolha.phi);
    const sEst = Math.floor(Math.min(20, D, 12 * escolha.phi / 10));
    escolha.estribo = { phi: escolha.phiT, s: sEst, rotulo: `ø ${String(escolha.phiT).replace('.', ',')} c/ ${sEst}`, circular: true };
    escolha.estribo.ok = escolha.phiT >= 5 && escolha.phiT >= escolha.phi / 4 - 1e-9;
    if (!escolha.estribo.ok) r.avisos.push(`Estribo ø ${String(escolha.phiT).replace('.', ',')} menor que ø/4 = ${String(escolha.phi / 4).replace('.', ',')} mm (18.4.3) — escolha um estribo maior.`);
  }
  return r;
}
