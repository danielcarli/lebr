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
 * Reservatório retangular de concreto armado — cálculo (NBR 6118:2023).
 *
 * Caixa de uma célula, elevada (apoiada em vigas ou em pilares nos cantos) ou enterrada (apoiada no solo).
 * Paredes, fundo e tampa são placas (elementos finitos, engine/placa.js): paredes engastadas entre si e no fundo,
 * apoiadas na tampa (ou livres no topo, sem tampa); fundo engastado nas paredes; tampa apoiada.
 * Ações: pressão hidrostática (γw = 10 kN/m³), empuxo de terra em repouso (K0 = 1 − sen φ) com sobrecarga no
 * terreno, pesos próprios, revestimentos e sobrecarga na tampa. Casos: cheio; e, no enterrado, vazio com empuxo.
 * Momentos negativos compatibilizados nas arestas (14.7.6.2); tração nas paredes pela reação das vizinhas;
 * armaduras por face com a abertura de fissuras limitada (wk ≤ 0,1 mm por padrão, mais rígido que a Tabela 13.4).
 */
import { geometriaReservatorio, placaUnitaria, compatibilizar, bracoVigaParede, k0, GAMA_AGUA } from '../../engine/reservatorio.js';
import { dimensionarFlexao, armaduraMinima } from '../../engine/flexao.js';
import { verificarCortanteLaje } from '../../engine/cisalhamento.js';
import { escolherBarrasLaje, bitolaFixa, areaBarra, fmtPhi } from '../../engine/barras.js';
import { aberturaFissuras } from '../../engine/fissuracao.js';
import { FCK_MIN } from '../../engine/materiais.js';

const f = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');
const r2 = (v) => Math.round(v * 100) / 100 || 0;
const r3 = (v) => Math.round(v * 1000) / 1000 || 0;

export const TIPOS_RESERVATORIO = { elevado: 'Elevado', enterrado: 'Enterrado' };
export const APOIOS_RESERVATORIO = { vigas: 'Paredes sobre vigas', pilares: 'Pilares nos cantos', solo: 'Apoiado no solo' };

export function criarReservatorio() {
  return {
    tipo: 'elevado',
    a: 2.0, b: 3.0,          // dimensões internas em planta (m): a na direção x, b na direção y
    H: 1.5,                  // altura interna, do fundo à tampa (m)
    hAgua: 1.3,              // lâmina d'água máxima (m)
    e: 15, hf: 15, ht: 10,   // espessuras das paredes, do fundo e da tampa (cm)
    tampa: true,
    revestimento: { fundo: 0.5, tampa: 1.0 }, // kN/m² (regularização, impermeabilização)
    qTampa: 1.0,             // kN/m² — sobrecarga de manutenção na tampa
    apoio: 'vigas',
    solo: { gama: 18, phi: 30, sobrecarga: 10, sigmaAdm: 150 },
    cobrimento: 3.0,         // cm — faces em contato com a água
    wkLim: 0.1,              // mm
    posicao: null,           // { pavimento, x, y, angulo } — canto dos eixos das paredes
    armadura: { phi: 'auto' },
  };
}

const NOMES_BORDA = { y0: 'Parede inferior (y = 0)', x1: 'Parede direita', y1: 'Parede superior', x0: 'Parede esquerda (x = 0)' };
const CANTOS = [{ id: 'canto-1', nome: 'Canto (0, 0)' }, { id: 'canto-2', nome: 'Canto (a, 0)' }, { id: 'canto-3', nome: 'Canto (a, b)' }, { id: 'canto-4', nome: 'Canto (0, b)' }];

export function ligacoes(el) {
  const apoio = el?.tipo === 'enterrado' ? 'solo' : el?.apoio ?? 'vigas';
  if (apoio === 'vigas') return Object.entries(NOMES_BORDA).map(([id, nome]) => ({ id, nome, tipo: 'linear' }));
  if (apoio === 'pilares') return CANTOS.map((c) => ({ ...c, tipo: 'pontual' }));
  return [];
}

/** Dados de entrada normalizados. */
function dados(el, gama) {
  const tampa = el.tampa !== false;
  const enterrado = el.tipo === 'enterrado';
  const apoio = enterrado ? 'solo' : el.apoio ?? 'vigas';
  const a = Number(el.a) || 2, b = Number(el.b) || 3, H = Number(el.H) || 1.5;
  const hAgua = Math.min(Number(el.hAgua) || H, H);
  const e = Number(el.e) || 15, hf = Number(el.hf) || 15, ht = Number(el.ht) || 10;
  const geo = geometriaReservatorio({ a, b, H, hAgua, e, hf, ht, tampa, gama });
  return { tampa, enterrado, apoio, a, b, H, hAgua, e, hf, ht, geo, revF: Number(el.revestimento?.fundo) || 0, revT: Number(el.revestimento?.tampa) || 0, qT: tampa ? Number(el.qTampa) || 0 : 0 };
}

/** Cargas e reações (características) — base de cargasTransmitidas e do cálculo. */
function cargas(d, gama) {
  const { geo } = d;
  const Aint = d.a * d.b;
  const pf = { pp: (gama * d.hf) / 100, rev: d.revF, agua: GAMA_AGUA * d.hAgua };
  const pt = { pp: (gama * d.ht) / 100, rev: d.revT, q: d.qT };
  const fundoU = placaUnitaria({ lx: geo.Lx, ly: geo.Ly, bordas: { x0: 'engastada', x1: 'engastada', y0: 'engastada', y1: 'engastada' } });
  const tampaU = d.tampa ? placaUnitaria({ lx: geo.Lx, ly: geo.Ly, bordas: { x0: 'apoiada', x1: 'apoiada', y0: 'apoiada', y1: 'apoiada' } }) : null;
  // reação de cada borda do fundo e da tampa (kN/m), com a parede: linha de apoio sobre a viga
  const linha = {};
  for (const k of ['y0', 'x1', 'y1', 'x0']) {
    const gF = fundoU.reacoes[k] * (pf.pp + pf.rev + pf.agua);
    const gT = tampaU ? tampaU.reacoes[k] * (pt.pp + pt.rev) : 0;
    const qT = tampaU ? tampaU.reacoes[k] * pt.q : 0;
    linha[k] = { g: geo.pesoParede + gF + gT, q: qT, gFundo: gF, gTampa: gT, comp: k[0] === 'y' ? geo.Lx : geo.Ly };
  }
  const G = geo.Wparedes + geo.Wfundo + geo.Wtampa + geo.Wagua + d.revF * Aint + (d.tampa ? d.revT * Aint : 0);
  const Q = d.qT * geo.Lx * geo.Ly;
  return { pf, pt, fundoU, tampaU, linha, G, Q, Aint };
}

export function cargasTransmitidas(el, ctx) {
  const gama = ctx.materiais.gama;
  const d = dados(el, gama);
  const cg = cargas(d, gama);
  const out = {};
  if (d.apoio === 'vigas') for (const k of ['y0', 'x1', 'y1', 'x0']) out[k] = { g: cg.linha[k].g, q: cg.linha[k].q };
  if (d.apoio === 'pilares') for (const c of CANTOS) out[c.id] = { g: cg.G / 4, q: cg.Q / 4 };
  return out;
}

/** Vigas e pilares que recebem os apoios (pelas cargas de elemento). */
export function receptoresDe(el, projeto) {
  const out = {};
  for (const r of projeto?.elementos ?? []) for (const c of Array.isArray(r.cargas) ? r.cargas : []) {
    if (c?.tipo === 'elemento' && c.elementoId === el.id) (out[c.ligacao] ??= []).push({ id: r.id, codigo: r.codigo });
  }
  return out;
}

export function calcularReservatorio(el, ctx) {
  const { concreto: c, aco: s, gg, caa, gama } = ctx.materiais;
  const avisos = [], verificacoes = [], memorial = [];
  const d = dados(el, gama);
  const { geo } = d;
  if (!(d.hAgua > 0)) throw new Error('Informe a lâmina d’água do reservatório.');
  const cg = cargas(d, gama);
  const gf = 1.4;                                    // água e terra com γf = 1,4 (ação permanente de líquidos/solo)
  const fyd = s.fyd / 10;                            // kN/cm²
  const cob = Number(el.cobrimento) || 3;
  const wkLim = Number(el.wkLim) || 0.1;
  const phiFixa = bitolaFixa(el.armadura?.phi);
  const solo = { gama: Number(el.solo?.gama) || 18, phi: Number(el.solo?.phi) || 30, q: Number(el.solo?.sobrecarga) || 0, sigmaAdm: Number(el.solo?.sigmaAdm) || 150 };
  const K0 = k0(solo.phi);

  // ------------------------------------------------------------------ placas e casos
  const bParede = (L) => ({ lx: L, ly: geo.Hw, bordas: { x0: 'engastada', x1: 'engastada', y0: 'engastada', y1: d.tampa ? 'apoiada' : 'livre' } });
  const pAgua = GAMA_AGUA * d.hAgua;
  const pTerra = K0 * (solo.gama * geo.Hw + solo.q);
  const paredes = [
    { id: 'A', nome: `Paredes de ${f(geo.Lx)} m (y = 0 e y = b)`, L: geo.Lx, h: d.e, bordas: ['y0', 'y1'] },
    { id: 'B', nome: `Paredes de ${f(geo.Ly)} m (x = 0 e x = a)`, L: geo.Ly, h: d.e, bordas: ['x0', 'x1'] },
  ];
  const casos = [{ id: 'cheio', nome: 'Cheio', paredes: 'agua', p: pAgua }];
  if (d.enterrado) casos.push({ id: 'vazio', nome: 'Vazio com empuxo de terra', paredes: 'empuxo', p: pTerra });
  for (const pa of paredes) {
    pa.agua = placaUnitaria({ ...bParede(pa.L), tipo: 'hidrostatica', ate: d.hAgua });
    if (d.enterrado) pa.terra = placaUnitaria({ ...bParede(pa.L), tipo: 'empuxo', topo: solo.q > 0 ? (K0 * solo.q) / pTerra : 0 });
  }
  // fundo: elevado → água + pesos para baixo; enterrado → reação do solo menos o que está sobre o fundo (para cima)
  const pFundoEl = cg.pf.pp + cg.pf.rev + cg.pf.agua;
  const pFundoEnt = (geo.Wparedes + geo.Wtampa + (d.tampa ? d.revT * cg.Aint : 0) + cg.Q) / ((d.a + 2 * d.e / 100) * (d.b + 2 * d.e / 100));
  const pFundo = d.enterrado ? pFundoEnt : pFundoEl;
  const pTampa = cg.pt.pp + cg.pt.rev + cg.pt.q;
  const F = cg.fundoU, T = cg.tampaU;

  // ------------------------------------------------------------------ momentos característicos por caso, com as faces
  const linhas = []; // { placa, caso, dir, pos ('vão'|'aresta'), face, Mk, Nk }
  const faceParede = (caso, pos) => ((caso === 'agua') === (pos === 'vão') ? 'externa' : 'interna');
  const casosOut = [];
  for (const cs of casos) {
    const P = paredes.map((pa) => {
      const u = cs.paredes === 'agua' ? pa.agua : pa.terra;
      return { pa, u, Mh: u.mxPos * cs.p, Mv: u.myPos * cs.p, Mhn: -u.mxNeg * cs.p, Mvn: -u.myNeg * cs.p, R: u.reacoes, comp: {} };
    });
    const [A, B] = P;
    // aresta vertical entre paredes (momento horizontal)
    const MvA = A.Mhn, MvB = B.Mhn, Mvc = compatibilizar(MvA, MvB);
    A.comp.h = Mvc; B.comp.h = Mvc;
    // corrige o positivo de quem teve o negativo reduzido
    for (const X of [A, B]) if (X.Mhn > Mvc) X.Mh += (X.Mhn - Mvc) / 2;
    // aresta da base com o fundo, quando as faces tracionadas coincidem
    const faceFundoNeg = d.enterrado ? 'externa' : 'interna';
    const faceBase = faceParede(cs.paredes, 'aresta');
    const fundoMx = -F.mxNeg * pFundo, fundoMy = -F.myNeg * pFundo; // fundo: arestas x (paredes B) e y (paredes A)
    let fundoComp = null;
    if (faceBase === faceFundoNeg) {
      const cA = compatibilizar(A.Mvn, fundoMy), cB = compatibilizar(B.Mvn, fundoMx);
      fundoComp = { y: cA, x: cB };
      if (A.Mvn > cA) A.Mv += (A.Mvn - cA) / 2;
      if (B.Mvn > cB) B.Mv += (B.Mvn - cB) / 2;
      A.comp.v = cA; B.comp.v = cB;
    } else { A.comp.v = A.Mvn; B.comp.v = B.Mvn; }
    // tração horizontal: reação da vizinha na aresta vertical (só com água empurrando para fora)
    const NA = cs.paredes === 'agua' ? ((B.R.x0 + B.R.x1) / 2) * cs.p : 0;
    const NB = cs.paredes === 'agua' ? ((A.R.x0 + A.R.x1) / 2) * cs.p : 0;
    A.N = NA; B.N = NB;
    for (const X of P) {
      linhas.push(
        { placa: X.pa.id, caso: cs.id, dir: 'horizontal', pos: 'vão', face: faceParede(cs.paredes, 'vão'), Mk: X.Mh, Nk: X.N },
        { placa: X.pa.id, caso: cs.id, dir: 'vertical', pos: 'vão', face: faceParede(cs.paredes, 'vão'), Mk: X.Mv, Nk: 0 },
        { placa: X.pa.id, caso: cs.id, dir: 'horizontal', pos: 'aresta', face: faceBase, Mk: X.comp.h, Nk: X.N },
        { placa: X.pa.id, caso: cs.id, dir: 'vertical', pos: 'aresta', face: faceBase, Mk: X.comp.v, Nk: 0 },
      );
    }
    casosOut.push({ id: cs.id, nome: cs.nome, p: cs.p, paredes: P.map((X) => ({ id: X.pa.id, Mh: X.Mh, Mv: X.Mv, Mhn: X.Mhn, Mvn: X.Mvn, compH: X.comp.h, compV: X.comp.v, N: X.N, Vbase: X.R.y0 * cs.p })), fundoComp });
  }
  // fundo (um caso: elevado cheio ou enterrado pela reação do solo)
  const faceFpos = d.enterrado ? 'interna' : 'externa', faceFneg = d.enterrado ? 'externa' : 'interna';
  const fundoComp = casosOut.find((x) => x.fundoComp)?.fundoComp;
  let FMx = F.mxPos * pFundo, FMy = F.myPos * pFundo;
  const FMxn = -F.mxNeg * pFundo, FMyn = -F.myNeg * pFundo;
  const FMxnC = fundoComp ? fundoComp.x : FMxn, FMynC = fundoComp ? fundoComp.y : FMyn;
  if (FMxn > FMxnC) FMx += (FMxn - FMxnC) / 2;
  if (FMyn > FMynC) FMy += (FMyn - FMynC) / 2;
  linhas.push(
    { placa: 'F', caso: 'fundo', dir: 'x', pos: 'vão', face: faceFpos, Mk: FMx, Nk: 0 },
    { placa: 'F', caso: 'fundo', dir: 'y', pos: 'vão', face: faceFpos, Mk: FMy, Nk: 0 },
    { placa: 'F', caso: 'fundo', dir: 'x', pos: 'aresta', face: faceFneg, Mk: FMxnC, Nk: 0 },
    { placa: 'F', caso: 'fundo', dir: 'y', pos: 'aresta', face: faceFneg, Mk: FMynC, Nk: 0 },
  );
  if (T) linhas.push(
    { placa: 'T', caso: 'tampa', dir: 'x', pos: 'vão', face: 'inferior', Mk: T.mxPos * pTampa, Nk: 0 },
    { placa: 'T', caso: 'tampa', dir: 'y', pos: 'vão', face: 'inferior', Mk: T.myPos * pTampa, Nk: 0 },
  );

  // ------------------------------------------------------------------ armaduras por face com a fissuração limitada
  const espessura = (placa) => (placa === 'F' ? d.hf : placa === 'T' ? d.ht : d.e);
  const projetar = (ln) => {
    const h = espessura(ln.placa);
    const phiRef = (phiFixa ?? 10) / 10;
    const dd = h - cob - phiRef / 2;
    const Md = gf * ln.Mk, Nd = gf * (ln.Nk ?? 0);
    const flex = dimensionarFlexao({ Md, b: 100, h, d: dd, c, s });
    const AsTr = Nd > 0 ? Nd / fyd / 2 : 0;              // tração dividida entre as duas faces
    const rhoMin = armaduraMinima({ b: 100, h, d: dd, c, s }) / (100 * h);
    const AsMin = (ln.pos === 'vão' ? 0.67 : 1) * rhoMin * 100 * h;
    let As = Math.max(flex.AsCalc + AsTr, AsMin);
    // aumenta a armadura até wk ≤ limite (combinação com a água no nível máximo)
    let barras = null, wk = 0, it = 0;
    for (; it < 25; it++) {
      barras = escolherBarrasLaje({ As, h, principal: true, phi: phiFixa });
      if (!barras) break;
      const n = Math.max(2, Math.round(100 / barras.s));
      wk = ln.Mk > 0.01 ? aberturaFissuras({ Ms: ln.Mk, b: 100, h, d: h - cob - barras.phi / 20, phi: barras.phi, n, cob, phiT: 0, fctm: c.fctm }).wk : 0;
      if (wk <= wkLim + 1e-9) break;
      As = barras.AsEf * 1.08;
    }
    const AsEstr = Math.max(flex.AsCalc + AsTr, AsMin);
    return { ...ln, h, d: dd, Md, Nd, AsCalc: flex.AsCalc, AsTr, AsMin, AsELU: AsEstr, barras, wk, okFlex: flex.ok && !flex.dupla, porFissura: barras && barras.AsEf > AsEstr * 1.15 + 1e-9 };
  };
  const projetadas = linhas.map(projetar);
  // envoltória: por placa, direção, posição e face, a de maior armadura
  const env = new Map();
  for (const p of projetadas) {
    const k = `${p.placa}|${p.dir}|${p.pos}|${p.face}`;
    const atual = env.get(k);
    if (!atual || (p.barras?.AsEf ?? Infinity) > (atual.barras?.AsEf ?? Infinity) - 1e-9) env.set(k, p);
  }
  const armaduras = [...env.values()];

  // ------------------------------------------------------------------ cortante, suspensão, apoios
  const cortantes = [];
  for (const cs of casosOut) for (const pw of cs.paredes) {
    const pa = paredes.find((x) => x.id === pw.id);
    const dd = d.e - cob - 0.5;
    const As1 = armaduras.find((a) => a.placa === pw.id && a.dir === 'vertical' && a.pos === 'aresta')?.barras?.AsEf ?? 1;
    cortantes.push({ placa: pw.id, nome: pa.nome, caso: cs.nome, ...verificarCortanteLaje({ Vd: gf * pw.Vbase, d: dd, As1, c }) });
  }
  {
    const Rmax = Math.max(...Object.values(F.reacoes)) * pFundo;
    const As1 = Math.min(...armaduras.filter((a) => a.placa === 'F' && a.pos === 'aresta').map((a) => a.barras?.AsEf ?? 1));
    cortantes.push({ placa: 'F', nome: 'Fundo', caso: d.enterrado ? 'Reação do solo' : 'Cheio', ...verificarCortanteLaje({ Vd: gf * Rmax, d: d.hf - cob - 0.5, As1, c }) });
  }
  // suspensão do fundo (apoio nos pilares): as paredes trabalham como vigas-parede e o fundo fica pendurado na base delas
  const suspensao = d.apoio === 'pilares' ? ['y0', 'x0'].map((k) => {
    const Rd = gf * cg.linha[k].gFundo;
    return { borda: k, nome: k === 'y0' ? 'Paredes A' : 'Paredes B', Rd, As: Rd / fyd };
  }) : [];
  // vigas-parede nos pilares dos cantos
  const tirantes = d.apoio === 'pilares' ? ['y0', 'x0'].map((k) => {
    const L = cg.linha[k].comp, qd = gg * cg.linha[k].g + 1.4 * cg.linha[k].q;
    const Md = (qd * L * L) / 8;
    const { z, regime } = bracoVigaParede(L, geo.Htot);
    return { borda: k, nome: k === 'y0' ? 'Paredes A' : 'Paredes B', L, h: geo.Htot, qd, Md, z, regime, As: Md / (z * fyd) };
  }) : [];
  const sigmaSolo = d.enterrado ? (cg.G + cg.Q) / ((d.a + 2 * d.e / 100) * (d.b + 2 * d.e / 100)) : null;
  const rec = receptoresDe(el, ctx.projeto);
  const apoios = ligacoes(el).map((l) => {
    const v = d.apoio === 'vigas' ? { g: cg.linha[l.id].g, q: cg.linha[l.id].q, unidade: 'kN/m' } : { g: cg.G / 4, q: cg.Q / 4, unidade: 'kN' };
    return { id: l.id, nome: l.nome, ...v, recebe: rec[l.id] ?? [] };
  });

  // ------------------------------------------------------------------ verificações
  verificacoes.push({ nome: `Concreto mínimo (CAA ${caa})`, item: '7.4.2', valor: `C${c.fck}`, limite: `≥ C${FCK_MIN[caa]}`, ok: c.fck >= FCK_MIN[caa] });
  verificacoes.push({ nome: 'Lâmina d’água', item: '—', valor: `${f(d.hAgua)} m`, limite: `≤ altura interna ${f(d.H)} m`, ok: Number(el.hAgua) <= d.H + 1e-9 });
  const nomePlaca = (id) => (id === 'F' ? 'Fundo' : id === 'T' ? 'Tampa' : id === 'A' ? 'Paredes A' : 'Paredes B');
  for (const a of armaduras) {
    const nome = `${nomePlaca(a.placa)} — ${a.dir}, ${a.pos === 'vão' ? 'vão' : 'aresta'}, face ${a.face}`;
    verificacoes.push({ nome: `${nome}: flexão${a.Nd > 0 ? '-tração' : ''}`, item: '17.2 / 19.3', valor: `Md = ${f(a.Md)} kN·m/m${a.Nd > 0 ? `, Nd = ${f(a.Nd)} kN/m` : ''}`, limite: a.barras ? `${a.barras.rotulo} (${f(a.barras.AsEf)} cm²/m)` : 'sem barra que caiba', ok: a.okFlex && !!a.barras });
    if (a.Mk > 0.01) verificacoes.push({ nome: `${nome}: abertura de fissuras`, item: '17.3.3 (limite de estanqueidade)', valor: `wk = ${f(a.wk, 3)} mm`, limite: `≤ ${f(wkLim, 2)} mm`, ok: a.wk <= wkLim + 1e-9 });
  }
  for (const ct of cortantes) verificacoes.push({ nome: `${ct.nome} — cortante (${ct.caso})`, item: '19.4.1', valor: `VSd = ${f(ct.Vd)} kN/m`, limite: `VRd1 = ${f(ct.VRd1)} kN/m`, ok: ct.ok });
  if (sigmaSolo != null) verificacoes.push({ nome: 'Tensão no solo (cheio)', item: 'NBR 6122', valor: `σ = ${f(sigmaSolo, 1)} kPa`, limite: `≤ σadm = ${f(solo.sigmaAdm, 0)} kPa`, ok: sigmaSolo <= solo.sigmaAdm + 1e-9 });
  if (d.e < 12) avisos.push(`Paredes de ${f(d.e, 0)} cm: em reservatórios usam-se ao menos 12 a 15 cm para a concretagem e a estanqueidade.`);
  if (armaduras.some((a) => a.porFissura)) avisos.push(`Algumas armaduras foram aumentadas para limitar a abertura de fissuras a ${f(wkLim, 2)} mm (estanqueidade).`);
  if (d.apoio === 'vigas' && Object.keys(rec).length === 0) avisos.push('Nenhuma viga recebe as paredes: posicione o reservatório sobre as vigas na montagem (Conectar automaticamente) ou lance as reações nas vigas.');
  if (d.apoio === 'pilares' && Object.keys(rec).length === 0) avisos.push('Nenhum pilar recebe os cantos: posicione o reservatório sobre os pilares na montagem ou lance as reações nos pilares.');
  if (d.enterrado) avisos.push('Reservatório enterrado: o nível d’água do terreno (subpressão e flutuação) não é considerado.');

  // ------------------------------------------------------------------ memorial
  memorial.push({ titulo: 'Geometria e pesos', linhas: [
    `${TIPOS_RESERVATORIO[d.enterrado ? 'enterrado' : 'elevado']}, ${APOIOS_RESERVATORIO[d.apoio].toLowerCase()}: interno ${f(d.a)} × ${f(d.b)} × ${f(d.H)} m, lâmina d’água ${f(d.hAgua)} m → volume útil ${f(geo.volume, 2)} m³ (${f(geo.volume * 1000, 0)} L).`,
    `Espessuras: paredes ${f(d.e, 0)} cm, fundo ${f(d.hf, 0)} cm${d.tampa ? `, tampa ${f(d.ht, 0)} cm` : ', sem tampa'}; eixos ${f(geo.Lx)} × ${f(geo.Ly)} m, parede entre eixos ${f(geo.Hw)} m.`,
    `Pesos: água ${f(geo.Wagua, 1)} kN; paredes ${f(geo.Wparedes, 1)} kN (${f(geo.pesoParede)} kN/m); fundo ${f(geo.Wfundo, 1)} kN; tampa ${f(geo.Wtampa, 1)} kN; total G = ${f(cg.G, 1)} kN, Q (tampa) = ${f(cg.Q, 1)} kN.`,
  ] });
  memorial.push({ titulo: 'Ações', linhas: [
    `Pressão hidrostática no pé das paredes: γw·hágua = 10·${f(d.hAgua)} = ${f(pAgua)} kN/m², triangular até a lâmina.`,
    ...(d.enterrado ? [`Empuxo em repouso: K0 = 1 − sen ${f(solo.phi, 0)}° = ${f(K0, 3)}; no pé: K0·(γs·H + q) = ${f(K0, 3)}·(${f(solo.gama, 0)}·${f(geo.Hw)} + ${f(solo.q, 0)}) = ${f(pTerra)} kN/m².`] : []),
    `Fundo: ${d.enterrado ? `reação do solo menos as cargas apoiadas diretamente nele, (paredes + tampa)/área = ${f(pFundo)} kN/m² para cima` : `γc·hf + revestimento + água = ${f(cg.pf.pp)} + ${f(cg.pf.rev)} + ${f(cg.pf.agua)} = ${f(pFundo)} kN/m²`}${T ? `; tampa: ${f(pTampa)} kN/m²` : ''}.`,
    'ELU com γf = 1,4 para a água, a terra e os pesos; fissuração com a água no nível máximo (ação quase permanente).',
  ] });
  for (const cs of casosOut) {
    memorial.push({ titulo: `Paredes — caso ${cs.nome.toLowerCase()} (placas engastadas entre si e no fundo${d.tampa ? ', apoiadas na tampa' : ', livres no topo'})`, linhas: cs.paredes.map((pw) => {
      const pa = paredes.find((x) => x.id === pw.id);
      return `${pa.nome}: M horizontal vão ${f(pw.Mh)}, aresta ${f(pw.Mhn)} → compatibilizado ${f(pw.compH)}; M vertical vão ${f(pw.Mv)}, base ${f(pw.Mvn)} → ${f(pw.compV)} kN·m/m${pw.N > 0 ? `; tração horizontal ${f(pw.N)} kN/m` : ''}`;
    }) });
  }
  memorial.push({ titulo: 'Fundo e tampa', linhas: [
    `Fundo (engastado nas paredes): Mx = ${f(FMx)}, My = ${f(FMy)} kN·m/m no vão; arestas ${f(FMxn)} / ${f(FMyn)} → compatibilizadas ${f(FMxnC)} / ${f(FMynC)} kN·m/m.`,
    ...(T ? [`Tampa (apoiada): Mx = ${f(T.mxPos * pTampa)}, My = ${f(T.myPos * pTampa)} kN·m/m.`] : []),
    'Compatibilização nas arestas: M = máx(0,8·M maior; média) e o positivo da placa que teve o negativo reduzido aumentado da metade da redução (14.7.6.2).',
  ] });
  memorial.push({ titulo: `Armaduras (por metro, wk ≤ ${f(wkLim, 2)} mm)`, linhas: armaduras.map((a) =>
    `${nomePlaca(a.placa)} ${a.dir} ${a.pos} (face ${a.face}): Md = ${f(a.Md)}${a.Nd > 0 ? ` + Nd = ${f(a.Nd)} kN/m (As,tr = ${f(a.AsTr)} por face)` : ''} → As,ELU = ${f(a.AsELU)} cm²/m (mín. ${f(a.AsMin)}) → ${a.barras?.rotulo ?? '—'} (${f(a.barras?.AsEf)} cm²/m), wk = ${f(a.wk, 3)} mm${a.porFissura ? ' — aumentada pela fissuração' : ''}`) });
  if (suspensao.length) memorial.push({ titulo: 'Suspensão do fundo (18.3.6)', linhas: suspensao.map((x) => `${x.nome}: Rd = ${f(x.Rd)} kN/m → As,susp = Rd/fyd = ${f(x.As)} cm²/m em barras verticais (estribos) na parede`) });
  if (tirantes.length) memorial.push({ titulo: 'Paredes como vigas-parede entre os pilares (22.4)', linhas: tirantes.map((x) => `${x.nome}: l = ${f(x.L)} m, h = ${f(x.h)} m (${x.regime}), qd = ${f(x.qd)} kN/m, Md = qd·l²/8 = ${f(x.Md)} kN·m, z = ${f(x.z, 3)} m → As,tirante = ${f(x.As)} cm² junto ao fundo`) });
  memorial.push({ titulo: 'Reações nos apoios (características)', linhas: [
    ...apoios.map((a) => `${a.nome}: g = ${f(a.g)} ${a.unidade}, q = ${f(a.q)} ${a.unidade}${a.recebe.length ? ` → ${a.recebe.map((x) => x.codigo).join(', ')}` : ''}`),
    ...(sigmaSolo != null ? [`Solo: σ = (G + Q)/área = ${f(sigmaSolo, 1)} kPa.`] : []),
  ] });

  const out = (a) => ({ placa: a.placa, nome: nomePlaca(a.placa), dir: a.dir, pos: a.pos, face: a.face, Mk: r2(a.Mk), Md: r2(a.Md), Nd: r2(a.Nd), AsCalc: r2(a.AsCalc), AsTr: r2(a.AsTr), AsMin: r2(a.AsMin), AsELU: r2(a.AsELU), barras: a.barras ? { ...a.barras, AsEf: r2(a.barras.AsEf) } : null, wk: r3(a.wk), porFissura: !!a.porFissura });
  return {
    ok: verificacoes.every((v) => v.ok), avisos, verificacoes, memorial,
    tipo: d.enterrado ? 'enterrado' : 'elevado', apoio: d.apoio, tampa: d.tampa,
    a: d.a, b: d.b, H: d.H, hAgua: d.hAgua, e: d.e, hf: d.hf, ht: d.ht,
    geometria: { Lx: r3(geo.Lx), Ly: r3(geo.Ly), Hw: r3(geo.Hw), Htot: r3(geo.Htot) },
    volume: r3(geo.volume), litros: Math.round(geo.volume * 1000),
    pesos: { agua: r2(geo.Wagua), paredes: r2(geo.Wparedes), fundo: r2(geo.Wfundo), tampa: r2(geo.Wtampa), G: r2(cg.G), Q: r2(cg.Q) },
    pressoes: { agua: r2(pAgua), terra: d.enterrado ? r2(pTerra) : null, fundo: r2(pFundo), tampa: T ? r2(pTampa) : null, K0: d.enterrado ? r3(K0) : null },
    casos: casosOut.map((cs) => ({ ...cs, p: r2(cs.p), paredes: cs.paredes.map((pw) => Object.fromEntries(Object.entries(pw).map(([k, v]) => [k, typeof v === 'number' ? r2(v) : v]))), fundoComp: cs.fundoComp && { x: r2(cs.fundoComp.x), y: r2(cs.fundoComp.y) } })),
    fundo: { Mx: r2(FMx), My: r2(FMy), Mxn: r2(FMxnC), Myn: r2(FMynC), Mxn0: r2(FMxn), Myn0: r2(FMyn) },
    tampaM: T ? { Mx: r2(T.mxPos * pTampa), My: r2(T.myPos * pTampa) } : null,
    armaduras: armaduras.map(out),
    cortantes: cortantes.map((x) => ({ placa: x.placa, nome: x.nome, caso: x.caso, Vd: r2(x.Vd), VRd1: r2(x.VRd1), ok: x.ok })),
    suspensao: suspensao.map((x) => ({ ...x, Rd: r2(x.Rd), As: r2(x.As) })),
    tirantes: tirantes.map((x) => ({ ...x, L: r3(x.L), h: r3(x.h), qd: r2(x.qd), Md: r2(x.Md), z: r3(x.z), As: r2(x.As) })),
    apoios: apoios.map((a) => ({ ...a, g: r2(a.g), q: r2(a.q) })),
    sigmaSolo: sigmaSolo != null ? r2(sigmaSolo) : null,
    bitola: phiFixa ? fmtPhi(phiFixa) : 'auto', areaBarra: phiFixa ? areaBarra(phiFixa) : null,
  };
}
