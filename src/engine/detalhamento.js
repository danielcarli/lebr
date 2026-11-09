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
 * Detalhamento das armaduras de vigas — NBR 6118:2023, 9.3 a 9.5, 17.4.2.2 e 18.3.
 *
 * Unidades: comprimentos em cm (posições ao longo da viga em m), bitolas em mm, tensões em MPa, forças em kN.
 *
 *   Aderência (9.3.2.1): fbd = η1·η2·η3·fctd, η1 = 2,25 (CA-50), η2 = 1,0 (boa) ou 0,7 (má), η3 = 1 (ø < 32).
 *   Ancoragem básica (9.4.2.4): lb = (ø/4)·(fyd/fbd) ≥ 25ø.
 *   Necessária (9.4.2.5): lb,nec = α·lb·As,calc/As,ef ≥ lb,mín = máx(0,3·lb; 10ø; 10 cm); α = 0,7 com gancho.
 *   Decalagem (17.4.2.2, modelo I): aℓ = d·VSd/[2·(VSd − Vc)], entre 0,5·d e d (aℓ = d com VSd ≤ Vc).
 *   Cortes (18.3.2.3): a barra termina aℓ + lb além do ponto em que deixa de ser necessária, no diagrama deslocado.
 *   Apoios extremos (18.3.2.4): As,apoio ≥ (aℓ/d)·VSd/fyd e ≥ 1/3 do As do vão; ancoragem a partir da face com gancho.
 *   Traspasse (9.5.2.2): l0t = α0t·lb,nec ≥ máx(0,3·α0t·lb; 15ø; 20 cm), α0t = 1,8 (50 % das barras emendadas na seção).
 *   Ganchos (9.4.2.3): a 90° com ponta reta de 8ø e pino da Tabela 9.1 (5ø; 8ø para ø ≥ 20) — 10ø de barra por gancho; estribos (9.4.6): ganchos
 *   a 45° (135°) com ponta de 5ø ≥ 5 cm — 8ø ≥ 6 cm de barra por gancho.
 */

export const COMPRIMENTO_COMERCIAL = 1200; // cm — barras de 12 m

/**
 * Diâmetro interno de dobramento dos ganchos (NBR 6118, Tabela 9.1), em múltiplos de ø:
 * CA-25 4ø (ø < 20) e 5ø; CA-50 5ø (ø < 20) e 8ø; CA-60 6ø.
 * @param {number} phi  bitola (mm)
 */
export function pinoGancho(phi, aco = 'CA-50') {
  if (aco === 'CA-60') return 6;
  if (aco === 'CA-25') return phi < 20 ? 4 : 5;
  return phi < 20 ? 5 : 8;
}
/** Raio da dobra medido no eixo da barra (cm): pino/2 + ø/2. */
export const raioDobraEixo = (phi, aco) => ((pinoGancho(phi, aco) + 1) / 2) * (phi / 10);
/**
 * Perna do gancho a 90° do eixo da barra à ponta (cm): raio da dobra no eixo + ponta reta de 8ø (9.4.2.3) —
 * 11ø com pino de 5ø e 12,5ø com pino de 8ø.
 */
export const pernaGancho90 = (phi, aco) => raioDobraEixo(phi, aco) + 8 * (phi / 10);
/** Diâmetro interno mínimo de dobramento dos estribos (9.4.6.1), em múltiplos de øt: 3øt (øt ≤ 10), 4øt (até 20), 5øt. */
export const pinoEstribo = (phiT) => (phiT <= 10 ? 3 : phiT < 20 ? 4 : 5);
export const massaLinear = (phi) => (Math.PI * (phi / 1000) ** 2 / 4) * 7850; // kg/m
export const areaBarra = (phi) => (Math.PI * (phi / 10) ** 2) / 4;          // cm²
const arred5 = (cm) => Math.ceil(cm / 5 - 1e-9) * 5;

/** Resistência de aderência de cálculo (MPa). */
export function fbd({ fctd, boa = true, phi = 10 }) {
  const eta3 = phi < 32 ? 1 : (132 - phi) / 100;
  return 2.25 * (boa ? 1 : 0.7) * eta3 * fctd;
}

/** Comprimento de ancoragem básico (cm). */
export function ancoragemBasica({ phi, fyd, fbd: f }) {
  return Math.max((phi / 10 / 4) * (fyd / f), 2.5 * phi);
}

/** Comprimento de ancoragem necessário (cm). */
export function ancoragemNecessaria({ lb, phi, AsCalc = 1, AsEf = 1, gancho = false }) {
  const alfa = gancho ? 0.7 : 1;
  return Math.max(alfa * lb * Math.min(1, AsCalc / AsEf), 0.3 * lb, phi, 10);
}

/** Decalagem do diagrama de momentos (cm). */
export function decalagem({ d, Vd, Vc }) {
  if (!(Vd > Vc)) return d;
  return Math.min(d, Math.max(0.5 * d, (d * Vd) / (2 * (Vd - Vc))));
}

/** Comprimento de traspasse de barras tracionadas (cm). */
export function traspasse({ lbNec, lb, phi, alfa0t = 1.8 }) {
  return Math.max(alfa0t * lbNec, 0.3 * alfa0t * lb, 1.5 * phi, 20);
}

/** Boa aderência? (9.3.1) — para a face da barra a partir da face inferior da peça. */
export function boaAderencia({ h, distanciaFundo }) {
  return h < 60 ? distanciaFundo <= 30 : distanciaFundo <= h - 30;
}

/** Intervalo contínuo em torno de x0 onde f(x) ≥ limiar, sobre pontos ordenados [{x, v}]. */
function intervalo(pontos, x0, limiar, [xmin, xmax]) {
  const dentro = pontos.filter((p) => p.x >= xmin - 1e-9 && p.x <= xmax + 1e-9);
  if (!dentro.length) return null;
  // parte do ponto mais próximo de x0 e cresce para os dois lados enquanto atende
  const ini = dentro.reduce((a, p) => (Math.abs(p.x - x0) < Math.abs(a.x - x0) ? p : a), dentro[0]);
  if (ini.v < limiar - 1e-9) return null;
  let i = dentro.indexOf(ini), j = i;
  while (i > 0 && dentro[i - 1].v >= limiar - 1e-9) i--;
  while (j < dentro.length - 1 && dentro[j + 1].v >= limiar - 1e-9) j++;
  // interpolação linear até o limiar nas pontas
  const corta = (a, b) => (b.v === a.v ? a.x : a.x + ((limiar - a.v) * (b.x - a.x)) / (b.v - a.v));
  const xa = i > 0 ? corta(dentro[i - 1], dentro[i]) : dentro[i].x;
  const xb = j < dentro.length - 1 ? corta(dentro[j], dentro[j + 1]) : dentro[j].x;
  return [xa, xb];
}

/** Divide n barras em grupos: as duas de canto correm a peça; as demais em pares, cortadas. */
function grupos(n, primeiro = 2) {
  const g = [Math.min(primeiro, n)];
  let r = n - g[0];
  while (r > 0) { const k = Math.min(2, r); g.push(k); r -= k; }
  return g;
}

/**
 * Detalhamento de uma viga.
 * @param {object} p
 * @param {number[]} p.L        vãos (m)
 * @param {string[]} p.apoios   'apoio' | 'engaste' | 'livre'
 * @param {number} p.b, p.h, p.cob (cm)
 * @param {{x:number, Md:number, MdMin:number, vao:number}[]} p.pts  envoltória de cálculo (x global, m)
 * @param {object[]} p.vaos     { barras:{phi,n}, d, Vd, Vc, estribo:{phi,s}, torcao:{Asl, ue, c1} }
 * @param {object[]} p.negs     por apoio: { barras:{phi,n}, d } ou null
 * @param {number[]} p.Rd       reações de cálculo (kN) — cortante junto aos apoios extremos
 * @param {number} p.fctd, p.fyd (MPa)
 * @param {number|number[]} [p.largura=20] largura dos apoios na direção da viga (cm) — um valor ou um por apoio
 */
export function detalharViga(p) {
  const { L, apoios, b, h, cob, pts, vaos, negs, fctd, fyd } = p;
  const nApoios = L.length + 1;
  const largs = Array.from({ length: nApoios }, (_, k) => (Array.isArray(p.largura) ? p.largura[k] : p.largura) || 20);
  const X = [0];
  for (const l of L) X.push(X[X.length - 1] + l);
  const Ltot = X[X.length - 1];
  // m além do eixo nos apoios extremos (até a face externa menos o cobrimento)
  const extIni = (largs[0] / 2 - cob) / 100, extFim = (largs[nApoios - 1] / 2 - cob) / 100;
  const livreIni = apoios[0] === 'livre', livreFim = apoios[nApoios - 1] === 'livre';
  const xIni = livreIni ? 0 : -extIni, xFim = livreFim ? Ltot : Ltot + extFim;
  const pontaIni = livreIni ? cob / 100 : 0, pontaFim = livreFim ? cob / 100 : 0;
  const lim = [xIni + pontaIni, xFim - pontaFim];
  const fyd10 = fyd / 10;                             // kN/cm²
  const posicoes = [], avisos = [], verificacoes = [];
  const pos = [...pts].sort((a, c) => a.x - c.x);

  // ---------------------------------------------------------------- seções por vão (b, h e níveis das faces, cm)
  const secs = p.secoes?.length === L.length ? p.secoes : L.map(() => ({ b, h, base: -h, topo: 0 }));
  const variavel = secs.some((s) => s.b !== secs[0].b || s.h !== secs[0].h || s.topo !== secs[0].topo || s.base !== secs[0].base);
  const meia = (i) => (apoios[i] === 'livre' ? 0 : largs[i] / 200);          // m, do eixo à face do apoio
  const dentro = (k) => largs[k] / 200 - cob / 100;                          // m, do eixo à face oposta menos o cobrimento
  // em cada apoio interno: a face superior (nível do topo), a inferior (nível da base ou largura) e as laterais mudam?
  const desc = Array.from({ length: nApoios }, (_, k) => {
    if (k === 0 || k === nApoios - 1) return { superior: false, inferior: false, lateral: false };
    const a = secs[k - 1], c = secs[k];
    const superior = Math.abs(a.topo - c.topo) > 0.5;
    const inferior = Math.abs(a.base - c.base) > 0.5 || Math.abs(a.b - c.b) > 0.5;
    return { superior, inferior, lateral: superior || inferior || Math.abs(a.h - c.h) > 0.5 };
  });
  /** vãos cujo trecho livre (entre as faces dos apoios) a barra ocupa */
  const vaosDe = (x0, x1) => L.map((_, v) => [v, Math.min(x1, X[v + 1] - meia(v + 1)) - Math.max(x0, X[v] + meia(v))]).filter(([, o]) => o > 0.01);
  /** seção em que a barra fica: a menor largura e altura dos vãos que ela atravessa e os níveis do vão principal */
  const secaoDaBarra = (x0, x1) => {
    const vs = vaosDe(x0, x1);
    if (!vs.length) { const v = Math.max(0, Math.min(L.length - 1, X.findIndex((x) => x > (x0 + x1) / 2) - 1)); return { ...secs[v] }; }
    const [vp] = vs.reduce((m, q) => (q[1] > m[1] ? q : m));
    return { b: Math.min(...vs.map(([v]) => secs[v].b)), h: Math.min(...vs.map(([v]) => secs[v].h)), topo: secs[vp].topo, base: secs[vp].base, vao: vp };
  };
  /**
   * Barra que atravessaria um apoio onde a sua face muda: vira duas, cada uma ancorada dentro do apoio até a face
   * oposta menos o cobrimento (com gancho nas faces superior e inferior). Pedaços que mal entram no vão são descartados.
   */
  const recortar = (q) => {
    if (!variavel || q.face === 'transversal' || !desc.some((d) => d[q.face])) return [q];
    let pecas = [{ ...q, gancho: [...(q.gancho ?? [false, false])] }];
    const comGancho = q.face !== 'lateral';
    for (let k = 1; k < nApoios - 1; k++) {
      if (!desc[k][q.face]) continue;
      const xe = X[k] - dentro(k), xd = X[k] + dentro(k);
      pecas = pecas.flatMap((pc) => (pc.x0 < xe - 1e-6 && pc.x1 > xd + 1e-6
        ? [{ ...pc, x1: xd, gancho: [pc.gancho[0], comGancho] }, { ...pc, x0: xe, gancho: [comGancho, pc.gancho[1]] }]
        : [pc]));
    }
    if (pecas.length === 1) return pecas;
    pecas = pecas.filter((pc) => vaosDe(pc.x0, pc.x1).some(([, o]) => o >= 0.05));
    return pecas.map((pc, i) => ({ ...pc, id: pecas.length > 1 ? `${q.id}-${i + 1}` : q.id, reto: (pc.x1 - pc.x0) * 100, ganchos: comGancho ? undefined : 0, ancoradaNoApoio: true }));
  };

  const adiciona = (q) => { for (const pc of recortar(q)) adicionaPeca(pc); };
  const adicionaPeca = (q0) => {
    const gancho = q0.gancho ?? [false, false];
    const q = { ...q0, gancho, ganchos: q0.ganchos ?? gancho.filter(Boolean).length };
    // emendas por traspasse nas barras mais longas que as comerciais
    let comprimento = q.reto + q.ganchos * q.phi; // gancho a 90°: 10ø de barra (ø em mm → 10ø em cm = ø)
    let emendas = 0, l0t = 0;
    if (comprimento > COMPRIMENTO_COMERCIAL) {
      emendas = Math.ceil(comprimento / COMPRIMENTO_COMERCIAL) - 1;
      l0t = traspasse({ lbNec: q.lb ?? 2.5 * q.phi, lb: q.lb ?? 2.5 * q.phi, phi: q.phi });
      comprimento += emendas * l0t;
    }
    posicoes.push({ ...q, comprimento: arred5(comprimento), emendas, l0t: emendas ? Math.round(l0t) : 0, sec: secaoDaBarra(q.x0, q.x1) });
  };

  // ---------------------------------------------------------------- positivas (face inferior, boa aderência)
  const FOLGA = 0.15; // m — um corte que economiza menos que isso não compensa: a barra corre até a ponta
  vaos.forEach((v, k) => {
    const bar = v.barras;
    if (!bar?.phi || !bar?.n) return;
    const { phi, n } = bar;
    const AsEf = n * areaBarra(phi);
    const f = fbd({ fctd, boa: true, phi });
    const lb = ancoragemBasica({ phi, fyd, fbd: f });
    const al = decalagem({ d: v.d, Vd: v.Vd, Vc: v.Vc });
    const perfil = pos.filter((q) => q.x >= X[k] - 1e-9 && q.x <= X[k + 1] + 1e-9).map((q) => ({ x: q.x, v: Math.max(0, q.Md) }));
    const Mmax = Math.max(0, ...perfil.map((q) => q.v));
    // extremidades: apoio extremo → até a face externa menos o cobrimento, com gancho; apoio interno → 10ø além da face
    const extremo = [k === 0 && !livreIni, k === L.length - 1 && !livreFim];
    // apoio interno em que a face inferior muda (nível ou largura): a barra entra 10ø no apoio, sem passar ao outro
    // vão; se 10ø não cabe até a face oposta menos o cobrimento, para ali com gancho
    const noApoio = (kk, lado) => {
      const x10 = X[kk] + lado * (largs[kk] / 200 - phi / 100), xMax = X[kk] - lado * dentro(kk);
      return lado > 0 ? Math.max(x10, xMax) : Math.min(x10, xMax);
    };
    const ganchoDesc = [
      k > 0 && desc[k].inferior && X[k] - dentro(k) > X[k] + largs[k] / 200 - phi / 100 + 1e-9,
      k < L.length - 1 && desc[k + 1].inferior && X[k + 1] + dentro(k + 1) < X[k + 1] - largs[k + 1] / 200 + phi / 100 - 1e-9,
    ];
    const ponta = [
      k === 0 ? lim[0] : desc[k].inferior ? noApoio(k, 1) : X[k] - (largs[k] / 2 + phi) / 100,
      k === L.length - 1 ? lim[1] : desc[k + 1].inferior ? noApoio(k + 1, -1) : X[k + 1] + (largs[k + 1] / 2 + phi) / 100,
    ];
    const gr = grupos(n);
    // pontos de corte de cada grupo (diagrama deslocado de aℓ + lb)
    let acumulado = 0;
    const cortes = gr.map((nb, gi) => {
      let c = [...ponta];
      if (gi > 0 && Mmax > 0) {
        const iv = intervalo(perfil, (X[k] + X[k + 1]) / 2, (Mmax * acumulado) / n, [X[k], X[k + 1]]);
        if (iv) c = [Math.max(ponta[0], iv[0] - (al + lb) / 100), Math.min(ponta[1], iv[1] + (al + lb) / 100)];
      }
      acumulado += nb;
      return [c[0] - ponta[0] < FOLGA ? ponta[0] : c[0], ponta[1] - c[1] < FOLGA ? ponta[1] : c[1]];
    });
    // ancoragem nos apoios extremos (18.3.2.4): se as barras de canto não bastam, mais grupos vão até o apoio
    [0, 1].forEach((lado) => {
      if (!extremo[lado]) return;
      const idx = lado === 0 ? 0 : nApoios - 1;
      const Vd = Math.abs(p.Rd?.[idx] ?? v.Vd);
      const AsNec = ((al / v.d) * Vd) / fyd10;
      const disp = largs[idx] - cob;
      const avalia = (nAp) => {
        const AsApoio = nAp * areaBarra(phi);
        const lbNec = ancoragemNecessaria({ lb, phi, AsCalc: Math.max(AsNec, 1e-6), AsEf: AsApoio, gancho: true });
        return { AsApoio, minimo: Math.max(lbNec, ((pinoGancho(phi) / 2) * phi + 5.5 * phi) / 10, 6) }; // ≥ r + 5,5ø (pino da Tabela 9.1) e ≥ 6 cm
      };
      const chegam = () => gr.reduce((s, nb, gi) => s + (cortes[gi][lado] === ponta[lado] ? nb : 0), 0);
      let r = avalia(chegam());
      for (let gi = 1; gi < gr.length && (r.minimo > disp + 1e-9 || r.AsApoio < Math.max(AsNec, AsEf / 3) - 1e-9); gi++) {
        if (cortes[gi][lado] !== ponta[lado]) { cortes[gi][lado] = ponta[lado]; r = avalia(chegam()); }
      }
      const fx = (x, c = 1) => x.toFixed(c).replace('.', ',');
      verificacoes.push({ nome: `Ancoragem no apoio ${idx + 1} (extremo)`, item: '18.3.2.4', valor: `lb,nec = ${fx(r.minimo)} cm com gancho`, limite: `≤ ${fx(disp)} cm disponíveis`, ok: r.minimo <= disp + 1e-9 });
      verificacoes.push({ nome: `Armadura que chega ao apoio ${idx + 1}`, item: '18.3.2.4', valor: `As = ${fx(r.AsApoio, 2)} cm²`, limite: `≥ máx(aℓ/d·VSd/fyd; As,vão/3) = ${fx(Math.max(AsNec, AsEf / 3), 2)} cm²`, ok: r.AsApoio >= Math.max(AsNec, AsEf / 3) - 1e-9 });
      if (r.minimo > disp + 1e-9) avisos.push(`Apoio ${idx + 1}: a ancoragem com gancho (${Math.round(r.minimo)} cm) passa dos ${Math.round(disp)} cm disponíveis no apoio de ${Math.round(largs[idx])} cm — use barras mais finas, grampos ou alargue o apoio.`);
    });
    gr.forEach((nb, gi) => {
      const [a, z] = cortes[gi];
      const gancho = [(extremo[0] || ganchoDesc[0]) && a === ponta[0], (extremo[1] || ganchoDesc[1]) && z === ponta[1]];
      adiciona({ id: `pos-v${k + 1}-g${gi + 1}`, tipo: 'positiva', face: 'inferior', local: `Vão ${k + 1}`, phi, n: nb, x0: a, x1: z, reto: (z - a) * 100, gancho, lb: Math.round(lb), al: Math.round(al), corrida: gi === 0 });
    });
  });

  // vãos sem armadura positiva (balanços): duas barras construtivas na face inferior
  vaos.forEach((v, k) => {
    if (v.barras?.phi && v.barras?.n) return;
    const phiC = secs[k].b <= 25 ? 6.3 : 8;
    const a = k === 0 ? lim[0] : desc[k].inferior ? Math.max(X[k] - 0.1, X[k] - dentro(k)) : X[k] - 0.1;
    const z = k === L.length - 1 ? lim[1] : desc[k + 1].inferior ? Math.min(X[k + 1] + 0.1, X[k + 1] + dentro(k + 1)) : X[k + 1] + 0.1;
    adiciona({ id: `inf-v${k + 1}`, tipo: 'construtiva', face: 'inferior', local: `Vão ${k + 1} (construtiva)`, phi: phiC, n: 2, x0: a, x1: z, reto: (z - a) * 100, ganchos: 0 });
  });

  // ---------------------------------------------------------------- negativas (face superior)
  const cobertoTopo = []; // trechos cobertos pelas negativas mais longas
  negs.forEach((ng, k) => {
    const bar = ng?.barras;
    if (!bar?.phi || !bar?.n) return;
    const { phi, n } = bar;
    const hAp = Math.min(...[secs[k - 1], secs[k]].filter(Boolean).map((s) => s.h));
    const boa = boaAderencia({ h: hAp, distanciaFundo: hAp - cob });
    const f = fbd({ fctd, boa, phi });
    const lb = ancoragemBasica({ phi, fyd, fbd: f });
    const vizinhos = [vaos[k - 1], vaos[k]].filter(Boolean);
    const al = Math.max(...vizinhos.map((v) => decalagem({ d: ng.d ?? v.d, Vd: v.Vd, Vc: v.Vc })));
    const xmin = k > 0 ? X[k - 1] : X[0], xmax = k < L.length ? X[k + 1] : X[nApoios - 1];
    const perfil = pos.filter((q) => q.x >= xmin - 1e-9 && q.x <= xmax + 1e-9).map((q) => ({ x: q.x, v: Math.max(0, -q.MdMin) }));
    // momento no próprio apoio (o maior entre os pontos sobre o eixo)
    const noApoio = perfil.filter((q) => Math.abs(q.x - X[k]) < 1e-6);
    const Mmax = Math.max(0, ...noApoio.map((q) => q.v));
    if (!(Mmax > 0)) return;
    const n1 = Math.ceil(n / 2);
    const gs = n > 2 ? [n1, n - n1] : [n];
    let acum = 0, primeira = null;
    gs.forEach((nb, gi) => {
      const iv = intervalo(perfil, X[k], gi === 0 ? Mmax * 0.02 : (Mmax * acum) / n, [xmin, xmax]) ?? [X[k] - 0.5, X[k] + 0.5];
      let a = iv[0] - (al + lb) / 100, z = iv[1] + (al + lb) / 100;
      if (primeira) {   // corte que economiza pouco: a barra acompanha a primeira
        if (a - primeira[0] < FOLGA) a = primeira[0];
        if (primeira[1] - z < FOLGA) z = primeira[1];
      }
      const gancho = [false, false];
      if (a <= lim[0] + 1e-6) { a = lim[0]; gancho[0] = true; }
      if (z >= lim[1] - 1e-6) { z = lim[1]; gancho[1] = true; }
      if (gi === 0) { cobertoTopo.push([a, z]); primeira = [a, z]; }
      acum += nb;
      adiciona({ id: `neg-a${k + 1}-g${gi + 1}`, tipo: 'negativa', face: 'superior', local: `Apoio ${k + 1}`, phi, n: nb, x0: a, x1: z, reto: (z - a) * 100, gancho, lb: Math.round(lb), al: Math.round(al), aderencia: boa ? 'boa' : 'má' });
    });
  });

  // ---------------------------------------------------------------- porta-estribos onde não há negativa
  const phiP = Math.min(...secs.map((s) => s.b)) <= 25 ? 6.3 : 8;
  const trechos = [];
  let cursor = lim[0];
  for (const [a, z] of [...cobertoTopo].sort((u, w) => u[0] - w[0])) {
    if (a > cursor + 0.05) trechos.push([cursor, a]);
    cursor = Math.max(cursor, z);
  }
  if (lim[1] > cursor + 0.05) trechos.push([cursor, lim[1]]);
  const lapP = 30 * phiP / 1000; // m de traspasse com a negativa (construtivo)
  trechos.forEach(([a0, z0], i) => {
    const naPontaIni = a0 <= lim[0] + 1e-6, naPontaFim = z0 >= lim[1] - 1e-6;
    const a = naPontaIni ? a0 : a0 - lapP, z = naPontaFim ? z0 : z0 + lapP;
    adiciona({ id: `porta-${i + 1}`, tipo: 'porta-estribo', face: 'superior', local: 'Construtiva', phi: phiP, n: 2, x0: a, x1: z, reto: (z - a) * 100, gancho: [naPontaIni, naPontaFim] });
  });

  // ---------------------------------------------------------------- armadura de pele (h > 60 cm) e longitudinal de torção
  // pele por trecho de vãos seguidos com a mesma seção e h > 60 cm (com a seção constante, um trecho só)
  const trechosPele = [];
  secs.forEach((sc, v) => {
    if (sc.h <= 60) return;
    const ult = trechosPele.at(-1);
    if (ult && ult[1] === v - 1 && !desc[v].lateral) ult[1] = v; else trechosPele.push([v, v]);
  });
  trechosPele.forEach(([v0, v1], i) => {
    const sc = secs[v0];
    const AsFace = 0.001 * sc.b * sc.h;
    const phiPele = 8;
    const porFace = Math.max(Math.ceil(AsFace / areaBarra(phiPele)), Math.ceil((sc.h - 2 * cob - 10) / 20) - 1, 1);
    const a = v0 === 0 ? lim[0] : X[v0] - dentro(v0), z = v1 === L.length - 1 ? lim[1] : X[v1 + 1] + dentro(v1 + 1);
    const um = trechosPele.length === 1 && v0 === 0 && v1 === L.length - 1;
    adiciona({ id: um ? 'pele' : `pele-${i + 1}`, tipo: 'pele', face: 'lateral', local: um ? 'Pele (17.3.5.2.3)' : `Pele (17.3.5.2.3) · vão ${v0 + 1}${v1 > v0 ? `–${v1 + 1}` : ''}`, phi: phiPele, n: 2 * porFace, x0: a, x1: z, reto: (z - a) * 100, ganchos: 0 });
  });
  vaos.forEach((v, k) => {
    const t = v.torcao;
    if (!(t?.Asl > 0)) return;
    const phiT = 10;
    // parcela de Asl nas faces laterais (proporcional ao perímetro), em barras ø10 de cada lado
    const lateral = (t.Asl * 2 * Math.max(0, secs[k].h - 2 * t.c1)) / t.ue;
    const porLado = Math.max(1, Math.ceil(lateral / 2 / areaBarra(phiT)));
    const lb = ancoragemBasica({ phi: phiT, fyd, fbd: fbd({ fctd, boa: false, phi: phiT }) });
    let a = Math.max(lim[0], X[k] - lb / 100), z = Math.min(lim[1], X[k + 1] + lb / 100);
    if (desc[k].lateral) a = Math.max(a, X[k] - dentro(k));               // seção muda no apoio: ancora dentro dele
    if (desc[k + 1].lateral) z = Math.min(z, X[k + 1] + dentro(k + 1));
    adiciona({ id: `torcao-v${k + 1}`, tipo: 'torção', face: 'lateral', local: `Vão ${k + 1} (Asl de torção)`, phi: phiT, n: 2 * porLado, x0: a, x1: z, reto: (z - a) * 100, ganchos: 0, lb: Math.round(lb) });
  });

  // ---------------------------------------------------------------- estribos (agrupados por bitola e forma)
  const estribos = new Map();
  vaos.forEach((v, k) => {
    const e = v.estribo;
    if (!e?.phi || !e?.s) return;
    const meia = (i) => (apoios[i] === 'livre' ? cob : largs[i] / 2);
    const livreVao = Math.max(0, L[k] * 100 - meia(k) - meia(k + 1));
    const qtd = Math.ceil(livreVao / e.s) + 1;
    const gancho = Math.max((8 * e.phi) / 10, 6);
    const { b: bv, h: hv } = secs[k];
    const comp = 2 * (bv - 2 * cob) + 2 * (hv - 2 * cob) + 2 * gancho;
    const chave = `${e.phi}|${bv}|${hv}`;
    const atual = estribos.get(chave) ?? { qtd: 0, vaos: [], trechos: [], phi: e.phi, comp, b: bv, h: hv };
    atual.qtd += qtd; atual.vaos.push(`vão ${k + 1}: ${qtd} c/ ${String(e.s).replace('.', ',')}`);
    atual.trechos.push({ vao: k, s: e.s, qtd, x0: X[k] + meia(k) / 100, x1: X[k + 1] - meia(k + 1) / 100 });
    estribos.set(chave, atual);
  });
  let ie = 0;
  for (const e of estribos.values()) {
    posicoes.push({ id: `estribo-${++ie}`, tipo: 'estribo', face: 'transversal', local: e.vaos.join('; '), phi: e.phi, n: e.qtd, comprimento: arred5(e.comp), reto: e.comp, ganchos: 2, forma: `${e.b - 2 * cob} × ${e.h - 2 * cob} cm`, trechos: e.trechos, emendas: 0, sec: { b: e.b, h: e.h } });
  }

  // barras iguais (mesma bitola, comprimento, ganchos e posição) viram uma só posição
  for (let i = 0; i < posicoes.length; i++) {
    const a = posicoes[i];
    if (a.tipo === 'estribo') continue;
    for (let j = posicoes.length - 1; j > i; j--) {
      const c = posicoes[j];
      if (c.tipo === a.tipo && c.face === a.face && c.local === a.local && c.phi === a.phi && c.comprimento === a.comprimento && c.ganchos === a.ganchos
        && Math.abs(c.x0 - a.x0) < 0.01 && Math.abs(c.x1 - a.x1) < 0.01) {
        a.n += c.n; a.corrida = a.corrida || c.corrida;
        posicoes.splice(j, 1);
      }
    }
  }

  // numeração N1, N2…: positivas, negativas, porta-estribos, pele/torção, estribos
  const ordem = { positiva: 0, construtiva: 0, negativa: 1, 'porta-estribo': 2, pele: 3, 'torção': 3, estribo: 4 };
  posicoes.sort((a, c) => (ordem[a.tipo] - ordem[c.tipo]) || ((a.x0 ?? 0) - (c.x0 ?? 0)));
  posicoes.forEach((q, i) => { q.N = `N${i + 1}`; });
  if (variavel) {
    desc.forEach((d, k) => {
      if (d.superior || d.inferior) avisos.push(`Apoio ${k + 1}: ${[d.superior && 'a face superior', d.inferior && 'a face inferior'].filter(Boolean).join(' e ')} muda${d.superior && d.inferior ? 'm' : ''} de um vão para o outro — as barras dessa face são ancoradas dentro do apoio (${Math.round(largs[k])} cm); confira se o apoio é um pilar capaz de recebê-las.`);
    });
  }
  return { posicoes, avisos, verificacoes, larguras: largs, comprimentoTotal: Ltot, limites: lim, secoes: secs.map((s) => ({ b: s.b, h: s.h, topo: s.topo, base: s.base, invertida: !!s.invertida })), X };
}

/** Aplica as edições do usuário ({ [id]: { phi?, n?, comprimento? } }) e recalcula as massas. */
export function aplicarEdicoes(posicoes, edicoes = {}) {
  return (posicoes ?? []).map((q) => {
    const ed = edicoes?.[q.id];
    const r = { ...q, ...(ed ? Object.fromEntries(Object.entries(ed).filter(([, v]) => v != null && v !== '')) : {}), editada: !!ed && Object.keys(ed).length > 0 };
    r.massa = r.n * (r.comprimento / 100) * massaLinear(r.phi);
    return r;
  });
}

/** Resumo do aço por bitola (comprimento total em m e massa em kg). */
export function resumoAco(posicoes) {
  const porPhi = new Map();
  for (const q of posicoes) {
    const m = q.n * (q.comprimento / 100);
    const a = porPhi.get(q.phi) ?? { phi: q.phi, metros: 0, kg: 0 };
    a.metros += m; a.kg += m * massaLinear(q.phi);
    porPhi.set(q.phi, a);
  }
  const linhas = [...porPhi.values()].sort((a, b) => a.phi - b.phi);
  return { linhas, total: linhas.reduce((s, l) => s + l.kg, 0) };
}

/* ======================================================================= pilares (18.4, 9.5.2.3) */

/** Traspasse de barras comprimidas (9.5.2.3): l0c = lb,nec ≥ máx(0,6·lb; 15ø; 20 cm). */
export function traspasseComprimido({ lb, phi, AsCalc = 1, AsEf = 1 }) {
  const lbNec = lb * Math.min(1, AsCalc / AsEf);
  return Math.max(lbNec, 0.6 * lb, 1.5 * phi, 20);
}

/**
 * Barras protegidas contra a flambagem pelos estribos (18.2.4): as dos cantos e as que estão a até 20·øt do canto,
 * se nesse trecho não houver mais de duas barras (sem contar a do canto). As demais pedem estribos suplementares.
 * @param {{x:number,y:number}[]} pontos  centros das barras (cm), origem num canto da seção
 * @param {number} phiT bitola do estribo (mm)
 * @returns {{protegidas:boolean[], grampos:{eixo:'x'|'y', em:number, de:number, ate:number}[]}}
 */
export function barrasProtegidas(pontos, phiT) {
  const xs = pontos.map((p) => p.x), ys = pontos.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const lim = (20 * phiT) / 10 + 1e-6;
  const perto = (a, b) => Math.abs(a - b) < 0.5;
  const protegidas = pontos.map(() => false);
  // em cada face, as barras entre os cantos, ordenadas pela distância ao canto mais próximo
  const faces = [
    { idx: pontos.map((p, i) => (perto(p.y, y0) ? i : -1)).filter((i) => i >= 0), coord: 'x', a: x0, b: x1 },
    { idx: pontos.map((p, i) => (perto(p.y, y1) ? i : -1)).filter((i) => i >= 0), coord: 'x', a: x0, b: x1 },
    { idx: pontos.map((p, i) => (perto(p.x, x0) ? i : -1)).filter((i) => i >= 0), coord: 'y', a: y0, b: y1 },
    { idx: pontos.map((p, i) => (perto(p.x, x1) ? i : -1)).filter((i) => i >= 0), coord: 'y', a: y0, b: y1 },
  ];
  pontos.forEach((p, i) => { if ((perto(p.x, x0) || perto(p.x, x1)) && (perto(p.y, y0) || perto(p.y, y1))) protegidas[i] = true; });
  for (const f of faces) {
    const meio = f.idx.filter((i) => !protegidas[i] || ![f.a, f.b].some((c) => perto(pontos[i][f.coord], c)));
    for (const canto of [f.a, f.b]) {
      const dentro = meio.filter((i) => Math.abs(pontos[i][f.coord] - canto) <= lim);
      if (dentro.length <= 2) for (const i of dentro) protegidas[i] = true;
    }
  }
  // um grampo por linha de barras desprotegidas, de face a face
  const grampos = [];
  const chave = new Set();
  pontos.forEach((p, i) => {
    if (protegidas[i]) return;
    const naFaceY = perto(p.y, y0) || perto(p.y, y1); // face inferior/superior → grampo na direção y
    const g = naFaceY ? { eixo: 'y', em: p.x, de: y0, ate: y1 } : { eixo: 'x', em: p.y, de: x0, ate: x1 };
    const k = `${g.eixo}${Math.round(g.em * 2)}`;
    if (!chave.has(k)) { chave.add(k); grampos.push(g); }
  });
  return { protegidas, grampos };
}

/**
 * Detalhamento de um lance de pilar.
 * @param {object} p
 * @param {number} p.bx, p.by, p.cob   seção e cobrimento (cm)
 * @param {number} p.L                  comprimento do lance (m), de piso a piso
 * @param {{phi:number,n:number}} p.barras
 * @param {{x:number,y:number}[]} p.pontos  barras na seção (cm)
 * @param {{phi:number,s:number}} p.estribo
 * @param {number} p.fctd, p.fyd (MPa)
 * @param {boolean} p.acima            há pilar no lance de cima (as barras sobem para o traspasse)
 * @param {{tipo:'fundacao'|'viga'|'pilar'|null, codigo?:string, h?:number, cob?:number}} p.base
 *        o que está embaixo: fundação ou viga (o lance leva arranques), pilar (as barras de baixo já sobem) ou nada
 */
export function detalharPilar(p) {
  const { bx, by, cob, L, barras, pontos = [], estribo, fctd, fyd, acima = false, base = {}, circular = false } = p;
  const posicoes = [], avisos = [], verificacoes = [];
  const fx = (x, c = 1) => x.toFixed(c).replace('.', ',');
  if (!barras?.phi || !barras?.n) return { posicoes, avisos: ['Pilar sem armadura calculada.'], verificacoes };
  const { phi, n } = barras;
  // barras verticais: região de boa aderência (9.3.1, inclinação > 45°)
  const lb = ancoragemBasica({ phi, fyd, fbd: fbd({ fctd, boa: true, phi }) });
  const l0c = traspasseComprimido({ lb, phi });
  const Lcm = L * 100;
  const comp = acima ? Lcm + l0c : Lcm - cob;
  posicoes.push({ id: 'long', tipo: 'longitudinal', face: 'vertical', local: acima ? `Lance + traspasse de ${Math.round(l0c)} cm com o lance de cima` : 'Lance (último: até o topo menos o cobrimento)',
    phi, n, comprimento: arred5(comp), reto: comp, ganchos: 0, gancho: [false, false], z0: 0, z1: comp / 100, lb: Math.round(lb), l0c: Math.round(l0c), emendas: 0 });
  // arranques (esperas) na fundação ou na viga em que o pilar nasce
  if (base.tipo === 'fundacao' || base.tipo === 'viga') {
    const hEmb = Number(base.h) || 50, cobEmb = Number(base.cob) || (base.tipo === 'fundacao' ? 5 : 3);
    const embutido = hEmb - cobEmb;
    const pe = base.tipo === 'fundacao' ? Math.max(1.5 * phi, 15) : 0; // ponta dobrada para apoiar e posicionar a espera
    const c = embutido + l0c + pe;
    posicoes.push({ id: 'arranque', tipo: 'arranque', face: 'vertical', local: `Arranque ${base.tipo === 'fundacao' ? 'na fundação' : 'na viga'}${base.codigo ? ` ${base.codigo}` : ''}: ${Math.round(embutido)} cm embutidos + ${Math.round(l0c)} cm de traspasse${pe ? ` + pé de ${Math.round(pe)} cm` : ''}`,
      phi, n, comprimento: arred5(c), reto: embutido + l0c, ganchos: pe ? 1 : 0, gancho: [!!pe, false], z0: -embutido / 100, z1: l0c / 100, pe, lb: Math.round(lb), l0c: Math.round(l0c), emendas: 0 });
    // a ancoragem da espera na sapata ou no bloco é verificada no próprio módulo da fundação (9.4.2.5 / 22.6)
    if (base.tipo === 'viga' && lb > embutido + 1e-9) avisos.push(`O arranque de ø ${String(phi).replace('.', ',')} pede lb = ${Math.round(lb)} cm e a viga oferece ${Math.round(embutido)} cm (h − c) — confira a ancoragem ou use barras mais finas.`);
  }
  if (!base.tipo) avisos.push('A base do pilar não está ligada a fundação, viga ou pilar: o lance sai sem arranques. Ligue o pilar na montagem (ou crie a fundação) para detalhar as esperas.');
  // estribos e suplementares
  if (estribo?.phi && estribo?.s) {
    const gancho = Math.max((8 * estribo.phi) / 10, 6);
    const qtd = Math.floor(Lcm / estribo.s) + 1;
    // pilar circular: estribo circular (anel fechado com os dois ganchos de 135° que se cruzam)
    const cEst = circular ? Math.PI * (bx - 2 * cob) + 2 * gancho : 2 * (bx - 2 * cob) + 2 * (by - 2 * cob) + 2 * gancho;
    posicoes.push({ id: 'estribo', tipo: 'estribo', face: 'transversal', local: `ø ${String(estribo.phi).replace('.', ',')} c/ ${String(estribo.s).replace('.', ',')} ao longo do lance${circular ? ' (circular)' : ''}`, phi: estribo.phi, n: qtd, comprimento: arred5(cEst), reto: cEst, ganchos: 2, gancho: [true, true], forma: circular ? `circular ø ${fx(bx - 2 * cob, 0)} cm` : `${fx(bx - 2 * cob, 0)} × ${fx(by - 2 * cob, 0)} cm`, s: estribo.s, circular, emendas: 0 });
    // no estribo circular todas as barras ficam encostadas no anel: não há barra a mais de 20·øt de um "canto"
    const prot = circular ? { protegidas: pontos.map(() => true), grampos: [] } : pontos.length ? barrasProtegidas(pontos, estribo.phi) : { protegidas: [], grampos: [] };
    prot.grampos.forEach((g, i) => {
      const vao = g.ate - g.de; // entre os eixos das barras de face oposta
      const c = vao + (phi / 10) + 2 * gancho;
      posicoes.push({ id: `grampo-${g.eixo}-${i + 1}`, tipo: 'suplementar', face: 'transversal', local: `Grampo na direção ${g.eixo} (barra a ${fx(g.em, 0)} cm do canto)`, phi: estribo.phi, n: qtd, comprimento: arred5(c), reto: vao, ganchos: 2, gancho: [true, true], grampo: g, emendas: 0 });
    });
    const nProt = prot.protegidas.filter(Boolean).length;
    if (pontos.length) verificacoes.push({ nome: 'Barras protegidas contra a flambagem', item: '18.2.4', valor: circular ? `${nProt} de ${pontos.length} encostadas no estribo circular` : `${nProt} de ${pontos.length} pelos cantos do estribo${prot.grampos.length ? ` · ${prot.grampos.length} grampo${prot.grampos.length > 1 ? 's' : ''} para as demais` : ''}`, limite: 'até 20·øt do canto, no máx. 2 barras', ok: true });
  }
  const ordem = { longitudinal: 0, arranque: 1, estribo: 2, suplementar: 3 };
  posicoes.sort((a, c) => ordem[a.tipo] - ordem[c.tipo]);
  posicoes.forEach((q, i) => { q.N = `N${i + 1}`; });
  return { posicoes, avisos, verificacoes, l0c: Math.round(l0c), lb: Math.round(lb), base, acima };
}

/* ======================================================================= lajes maciças (19.3, 20.1) */

/**
 * Detalhamento de uma laje maciça retangular.
 * @param {object} p
 * @param {number} p.lx, p.ly (m), p.h, p.cob (cm)
 * @param {{x0,x1,y0,y1}} p.bordas      'apoiada' | 'engastada' | 'livre'
 * @param {{x0,x1,y0,y1}} p.apoios      largura da viga em cada borda (cm); 0 na borda livre
 * @param {{x?:{phi,s}, y?:{phi,s}}} p.positivas
 * @param {object[]} p.negativos  [{ borda, phi, s, As, t0, t1 (m ao longo da borda), a1 (cm nesta laje), a2 (cm do outro lado), outro? (código) }]
 */
export function detalharLaje(p) {
  const { lx, ly, h, cob, bordas = {}, apoios = {}, positivas = {}, negativos = [] } = p;
  const posicoes = [], avisos = [], verificacoes = [];
  const fx = (x, c = 1) => x.toFixed(c).replace('.', ',');
  // até a face oposta do apoio menos o cobrimento; na borda livre, até a borda menos o cobrimento
  const alem = (b) => (bordas[b] === 'livre' || !(apoios[b] > 0) ? -cob : apoios[b] / 2 - cob);
  const recuo = (b) => (bordas[b] === 'livre' || !(apoios[b] > 0) ? cob : apoios[b] / 2); // início da distribuição
  const dobra = Math.max(5, h - 2 * cob);
  for (const dir of ['x', 'y']) {
    const b = positivas[dir];
    if (!b?.phi || !b?.s) continue;
    const [ia, ib, da, db] = dir === 'x' ? ['x0', 'x1', 'y0', 'y1'] : ['y0', 'y1', 'x0', 'x1'];
    const L = (dir === 'x' ? lx : ly) * 100, D = (dir === 'x' ? ly : lx) * 100;
    const c = L + alem(ia) + alem(ib);
    const faixa = Math.max(0, D - recuo(da) - recuo(db));
    const n = Math.ceil(faixa / b.s - 1e-9) + 1;
    posicoes.push({ id: `pos-${dir}`, tipo: 'positiva', face: 'inferior', dir, local: `Positiva ${dir} (${b.rotulo ?? `ø ${String(b.phi).replace('.', ',')} c/ ${String(b.s).replace('.', ',')}`})`,
      phi: b.phi, n, s: b.s, comprimento: arred5(c), reto: c, ganchos: 0, gancho: [false, false],
      a: -alem(ia) / 100, b: (L + alem(ib)) / 100, de: recuo(da) / 100, ate: (D - recuo(db)) / 100, emendas: 0 });
  }
  negativos.forEach((ng, i) => {
    const dir = ng.borda[0] === 'x' ? 'x' : 'y'; // bordas x0/x1: barras na direção x
    const comp = (ng.t1 - ng.t0) * 100;
    const n = Math.ceil(Math.max(0, comp - 2 * cob) / ng.s - 1e-9) + 1;
    const c = ng.a1 + ng.a2 + 2 * dobra;
    posicoes.push({ id: `neg-${ng.borda}-${i + 1}`, tipo: 'negativa', face: 'superior', dir, borda: ng.borda, local: `Negativa na borda ${ng.borda}${ng.outro ? ` (com ${ng.outro})` : ''}: ${Math.round(ng.a1)} + ${Math.round(ng.a2)} cm`,
      phi: ng.phi, n, s: ng.s, comprimento: arred5(c), reto: ng.a1 + ng.a2, ganchos: 2, gancho: [true, true], dobra, a1: ng.a1, a2: ng.a2, t0: ng.t0, t1: ng.t1, outro: ng.outro ?? null, emendas: 0 });
    // distribuição sob os negativos (19.3.3.2): ≥ 20 % da principal e ≥ 0,9 cm²/m, s ≤ 33 cm, em ø 5
    const As = ng.As ?? (areaBarra(ng.phi) * 100) / ng.s;
    const sd = Math.min(33, Math.floor((areaBarra(5) * 100) / Math.max(0.2 * As, 0.9)));
    const nd = Math.ceil(ng.a1 / sd) + Math.ceil(ng.a2 / sd);
    const cd = Math.max(0, comp - 2 * cob);
    posicoes.push({ id: `dist-${ng.borda}-${i + 1}`, tipo: 'distribuição', face: 'superior', dir: dir === 'x' ? 'y' : 'x', borda: ng.borda, local: `Distribuição da negativa ${ng.borda} (ø 5 c/ ${sd})`,
      phi: 5, n: nd, s: sd, comprimento: arred5(cd), reto: cd, ganchos: 0, gancho: [false, false], t0: ng.t0, t1: ng.t1, a1: ng.a1, a2: ng.a2, emendas: 0 });
  });
  if (Object.values(bordas).includes('livre')) avisos.push('Bordas livres: prever a armadura de reforço da borda (grampos em U envolvendo as barras), não incluída na lista.');
  const ordem = { positiva: 0, negativa: 1, 'distribuição': 2 };
  posicoes.sort((a, c) => ordem[a.tipo] - ordem[c.tipo]);
  posicoes.forEach((q, i) => { q.N = `N${i + 1}`; });
  return { posicoes, avisos, verificacoes, dobra, lx, ly, apoios, bordas };
}

/** Resumo do aço por bitola com perdas (%): CA-60 para ø 5 e ø 6, CA-50 para as demais. */
export function resumoComPerdas(posicoes, perdas = 10) {
  const r = resumoAco(posicoes);
  const f = 1 + (Number(perdas) || 0) / 100;
  const linhas = r.linhas.map((l) => ({ ...l, aco: l.phi <= 6 ? 'CA-60' : 'CA-50', kgPerdas: l.kg * f, barras12: Math.ceil((l.metros * f) / 12) }));
  return { linhas, total: r.total, totalPerdas: r.total * f, perdas: Number(perdas) || 0 };
}
