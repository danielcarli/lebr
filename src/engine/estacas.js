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
 * Capacidade de carga de estacas isoladas pelo SPT — métodos semiempíricos de Aoki-Velloso e Décourt-Quaresma
 * (NBR 6122: carga admissível com fator de segurança global 2 para métodos semiempíricos).
 *
 * Aoki-Velloso (1975), com F1 e F2 de Cintra e Aoki (2010):
 *   rp = K·Np/F1 ; rl = α·K·Nl/F2 ; R = rp·Ap + U·Σ rl·Δl ; F2 = 2·F1
 *   K (MPa) e α (%) pelo solo; Np = NSPT na cota da ponta; Nl = NSPT de cada trecho do fuste.
 * Décourt-Quaresma (1978, com α e β de Décourt, 1996):
 *   rp = α·C·Np ; rl = β·10·(Nl/3 + 1) kPa ; R = rp·Ap + rl·U·L
 *   Np = média dos NSPT da ponta, do metro acima e do metro abaixo; Nl = média ao longo do fuste (sem os da ponta),
 *   com 3 ≤ N ≤ 50; C (kPa) pelo solo da ponta.
 * Unidades: diâmetro/lado em cm; profundidades e comprimentos em m; forças em kN; tensões em kPa.
 */

/** Tipos de estaca: F1 do Aoki-Velloso, grupo do Décourt-Quaresma e dados para a carga estrutural. */
export const TIPOS_ESTACA = {
  helice: { nome: 'Hélice contínua', F1: () => 2.0, dq: 'helice', escavada: true, fck: 20, gc: 1.8 },
  escavada: { nome: 'Escavada mecanicamente (sem fluido)', F1: () => 3.0, dq: 'escavada', escavada: true, fck: 15, gc: 1.9 },
  broca: { nome: 'Broca (trado manual)', F1: () => 3.0, dq: 'escavada', escavada: true, fck: 15, gc: 1.9 },
  premoldada: { nome: 'Pré-moldada de concreto (cravada)', F1: (D) => 1 + D / 0.8, dq: 'cravada', escavada: false, fck: null, gc: null },
};

/** Aoki-Velloso (1975): K (kPa) e α por solo. */
export const AV_SOLOS = {
  areia: { K: 1000, alfa: 0.014 }, 'areia-siltoso': { K: 800, alfa: 0.020 }, 'areia-argiloso': { K: 600, alfa: 0.030 },
  silte: { K: 400, alfa: 0.030 }, 'silte-arenoso': { K: 550, alfa: 0.022 }, 'silte-argiloso': { K: 230, alfa: 0.034 },
  argila: { K: 200, alfa: 0.060 }, 'argila-arenoso': { K: 350, alfa: 0.024 }, 'argila-siltoso': { K: 220, alfa: 0.040 },
};

/** Décourt-Quaresma: C (kPa) pelo solo da ponta. */
export const DQ_C = { argila: 120, 'silte-argiloso': 200, 'silte-arenoso': 250, areia: 400 };

/** Décourt (1996): α (ponta) e β (atrito) por tipo de estaca e grupo de solo. */
export const DQ_AB = {
  cravada: { argila: [1, 1], intermediario: [1, 1], areia: [1, 1] },
  escavada: { argila: [0.85, 0.8], intermediario: [0.6, 0.65], areia: [0.5, 0.5] },
  helice: { argila: [0.3, 1.0], intermediario: [0.3, 1.0], areia: [0.3, 1.0] },
};

export const FS_SEMIEMPIRICO = 2.0;

/**
 * Chave do solo para as tabelas a partir de uma camada da sondagem ({ solo, secundario }).
 * Pedregulho vai com as areias; rocha alterada com os siltes arenosos; aterro, solo orgânico e turfa não têm atrito.
 */
export function soloDaCamada(c) {
  if (!c) return { av: 'argila', dq: 'argila', grupo: 'argila', semAtrito: false };
  const sec = c.secundario ?? '';
  let base = c.solo;
  if (base === 'pedregulho') base = 'areia';
  if (base === 'rocha') return { av: 'silte-arenoso', dq: 'silte-arenoso', grupo: 'intermediario', semAtrito: false };
  if (['aterro', 'organico', 'turfa'].includes(base)) return { av: 'argila', dq: 'argila', grupo: 'argila', semAtrito: true };
  const av = AV_SOLOS[`${base}-${sec}`] ? `${base}-${sec}` : AV_SOLOS[base] ? base : 'argila';
  const dq = base === 'areia' ? 'areia' : base === 'argila' ? 'argila' : sec === 'argiloso' ? 'silte-argiloso' : 'silte-arenoso';
  const grupo = base === 'areia' ? 'areia' : base === 'argila' ? 'argila' : 'intermediario';
  return { av, dq, grupo, semAtrito: false };
}

/** Geometria da seção: circular (diâmetro) ou quadrada (lado), em cm → U (m) e Ap (m²). */
export function geometriaEstaca({ secao = 'circular', D }) {
  const d = D / 100;
  return secao === 'quadrada' ? { U: 4 * d, Ap: d * d, D: d } : { U: Math.PI * d, Ap: (Math.PI * d * d) / 4, D: d };
}

/**
 * Capacidade de carga pelos dois métodos.
 * @param {object} p
 * @param {'helice'|'escavada'|'broca'|'premoldada'} p.tipo
 * @param {number} p.D  diâmetro ou lado (cm) @param {'circular'|'quadrada'} [p.secao]
 * @param {number} p.topo  profundidade do topo (arrasamento) no furo (m) @param {number} p.L  comprimento (m)
 * @param {(prof:number)=>{n:number, prof:number}|null} p.nspt  ensaio SPT mais próximo de uma profundidade
 * @param {(prof:number)=>object|null} p.camada  camada da sondagem numa profundidade
 * @param {boolean} [p.limitarPonta]  estacas escavadas: ponta ≤ 20 % da carga admissível (padrão: sim nas escavadas)
 */
export function capacidadeEstaca({ tipo, D, secao = 'circular', topo, L, nspt, camada, limitarPonta = null }) {
  const t = TIPOS_ESTACA[tipo];
  if (!t) throw new Error(`Tipo de estaca desconhecido: ${tipo}.`);
  if (!(L > 0)) throw new Error('O comprimento da estaca precisa ser positivo.');
  const g = geometriaEstaca({ secao, D });
  const F1 = t.F1(g.D), F2 = 2 * F1;
  const ponta = topo + L;
  const avisos = [];
  const N = (p) => { const e = nspt(p); return e ? Math.min(50, e.neq ?? e.n) : null; };

  // trechos do fuste: de metro em metro (fronteiras inteiras na profundidade do furo)
  const trechos = [];
  for (let a = topo; a < ponta - 1e-9;) {
    const b = Math.min(ponta, Math.floor(a + 1e-9) + 1);
    const meio = (a + b) / 2;
    const ens = nspt(Math.floor(meio));
    const s = soloDaCamada(camada(meio));
    trechos.push({ de: a, ate: b, dl: b - a, meio, N: ens ? Math.min(50, ens.neq ?? ens.n) : null, profEnsaio: ens?.prof ?? null, solo: s });
    a = b;
  }
  if (trechos.some((x) => x.N == null)) throw new Error('Faltam ensaios SPT ao longo do fuste.');
  const soloPonta = soloDaCamada(camada(ponta - 0.01));

  // ---------------------------------------------------------------- Aoki-Velloso
  const Np = N(ponta);
  if (Np == null) throw new Error('Não há ensaio SPT na cota da ponta.');
  const kp = AV_SOLOS[soloPonta.av];
  const rpAV = (kp.K * Np) / F1;
  let RlAV = 0;
  for (const x of trechos) {
    const k = AV_SOLOS[x.solo.av];
    x.rlAV = x.solo.semAtrito ? 0 : (k.alfa * k.K * x.N) / F2;
    RlAV += g.U * x.rlAV * x.dl;
  }
  const av = { F1, F2, Np, K: kp.K, rp: rpAV, Rp: rpAV * g.Ap, Rl: RlAV, R: rpAV * g.Ap + RlAV };

  // ---------------------------------------------------------------- Décourt-Quaresma
  const ab = DQ_AB[t.dq];
  const usados = new Set();
  const nsPonta = [];
  for (const dz of [-1, 0, 1]) {
    const e = nspt(ponta + dz);
    if (e && !usados.has(e.prof)) { usados.add(e.prof); nsPonta.push(Math.min(50, e.neq ?? e.n)); }
  }
  const NpDQ = nsPonta.reduce((s, v) => s + v, 0) / nsPonta.length;
  const fuste = trechos.filter((x) => !usados.has(x.profEnsaio) && !x.solo.semAtrito);
  const comp = fuste.reduce((s, x) => s + x.dl, 0);
  const Nl = comp > 0 ? fuste.reduce((s, x) => s + Math.min(50, Math.max(3, x.N)) * x.dl, 0) / comp : 3;
  const [aP] = ab[soloPonta.grupo];
  const C = DQ_C[soloPonta.dq];
  const rpDQ = aP * C * NpDQ;
  // β pelo solo predominante (média ponderada pelo comprimento dos trechos)
  const beta = comp > 0 ? fuste.reduce((s, x) => s + ab[x.solo.grupo][1] * x.dl, 0) / comp : ab[soloPonta.grupo][1];
  const rlDQ = beta * 10 * (Nl / 3 + 1);
  const RlDQ = rlDQ * g.U * comp;
  for (const x of trechos) x.usadoPontaDQ = usados.has(x.profEnsaio);
  const dq = { Np: NpDQ, C, alfa: aP, beta, Nl, rp: rpDQ, rl: rlDQ, Rp: rpDQ * g.Ap, Rl: RlDQ, R: rpDQ * g.Ap + RlDQ, comprimentoAtrito: comp };

  // ---------------------------------------------------------------- cargas admissíveis (NBR 6122)
  const admissivel = (m) => {
    let P = m.R / FS_SEMIEMPIRICO, limitePonta = false;
    if (limitarPonta ?? t.escavada) {
      const lim = (1.25 * m.Rl) / FS_SEMIEMPIRICO; // escavadas: no máximo 20 % da carga admissível pela ponta
      if (lim < P) { P = lim; limitePonta = true; }
    }
    return { P, limitePonta };
  };
  av.adm = admissivel(av); dq.adm = admissivel(dq);
  if (trechos.some((x) => x.solo.semAtrito)) avisos.push('Trechos em aterro ou solo orgânico: o atrito lateral foi desprezado neles.');
  return { tipo, nomeTipo: t.nome, geometria: g, topo, ponta, L, trechos, soloPonta, av, dq, avisos };
}

/** Carga estrutural admissível de estacas moldadas in loco (kN): 0,85·fck/γc·A/γf, com γf = 1,4. */
export function cargaEstrutural({ tipo, D, secao = 'circular', fck = null, gc = null }) {
  const t = TIPOS_ESTACA[tipo];
  const f = fck ?? t.fck, g = gc ?? t.gc;
  if (!f || !g) return null;
  return (0.85 * f * 1000 / g) * geometriaEstaca({ secao, D }).Ap / 1.4;
}
