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
 * Quantitativos de materiais: volume de concreto (m³), área de fôrma (m²) e aço estimado por bitola (kg),
 * por elemento, por pavimento e do projeto, com exportação em CSV.
 *
 * As quantidades saem da geometria do elemento e das armaduras do último cálculo. Os comprimentos de barra são
 * estimados com regras simples (ancoragens e ganchos de 10·ø a 40·ø, negativos até l/4 de cada lado do apoio),
 * próprias para orçamento preliminar — não substituem a lista de ferros do detalhamento. Nas vigas calculadas a partir
 * da 0.27 o aço sai da própria lista de ferros do detalhamento (com as edições do usuário).
 *
 * Um módulo externo pode fornecer as suas quantidades com `quantitativos(el, resultado, projeto)`, devolvendo
 * { concreto, forma, aco: { [ø mm]: kg }, estacas?: { n, metros, volume }, notas?: string[] }.
 */

import { expandirTipos } from '../../renderer/core/tipos.js';
import { aplicarEdicoes } from '../../engine/detalhamento.js';
import { posicoesDe } from './detalhamento.js';
import { geometriaNervurada } from './nervurada-geometria.js';

export const BITOLAS_QUANT = [5, 6.3, 8, 10, 12.5, 16, 20, 25, 32];
/** Massa linear nominal (kg/m) — NBR 7480: 0,00617·ø² (ρ = 7850 kg/m³). */
export const massaLinear = (phi) => (Math.PI * (phi / 1000) ** 2 / 4) * 7850;
const KG_CM2_M = 0.785; // kg por cm² de seção e metro de comprimento

/** Lê "7 ø 8", "ø 10 c/ 15", "9 ø 12,5 c/ 14,5", "6 ø 10" → { n, phi, s }. */
export function lerBarras(rotulo) {
  const t = String(rotulo ?? '');
  const m = t.match(/(?:(\d+)\s*)?ø\s*([\d]+(?:[,.]\d+)?)(?:\s*c\/\s*([\d]+(?:[,.]\d+)?))?/);
  if (!m) return null;
  const num = (x) => (x == null ? null : Number(x.replace(',', '.')));
  return { n: num(m[1]), phi: num(m[2]), s: num(m[3]) };
}

/** Barras de 12 m: segmentos por barra de um comprimento (m), com as emendas do detalhamento quando houver. */
export const COMPRIMENTO_BARRA_M = 12;
export const segmentosPorBarra = (comprimento, emendas) => (emendas > 0 ? emendas + 1 : Math.max(1, Math.ceil(comprimento / COMPRIMENTO_BARRA_M - 1e-9)));

/** Acumulador de aço por bitola: peso (kg) e número de segmentos de barra (peças cortadas). */
function aco() {
  const kg = {}, pecas = {};
  const somaPecas = (phi, n) => { pecas[phi] = (pecas[phi] ?? 0) + n; };
  return {
    kg, pecas,
    barras(phi, n, comprimento, emendas = 0) {
      if (!(phi && n > 0 && comprimento > 0)) return;
      kg[phi] = (kg[phi] ?? 0) + n * comprimento * massaLinear(phi);
      somaPecas(phi, Math.ceil(n) * segmentosPorBarra(comprimento, emendas));
    },
    /** malha de As (cm²/m) com barras ø, numa faixa de `largura` m e `comprimento` m de barra */
    malha(phi, As, largura, comprimento) {
      if (!(phi && As > 0)) return;
      kg[phi] = (kg[phi] ?? 0) + KG_CM2_M * As * largura * comprimento;
      const nBarras = Math.ceil((As * largura) / ((Math.PI * (phi / 10) ** 2) / 4) - 1e-9);
      somaPecas(phi, nBarras * segmentosPorBarra(comprimento, 0));
    },
  };
}
const asDeRotulo = (b) => (b?.phi && b?.s ? (Math.PI * (b.phi / 10) ** 2 / 4) * (100 / b.s) : 0); // cm²/m

/* ------------------------------------------------------------------ por módulo */

function viga(el, r) {
  const b = el.secao?.b ?? 15, h = el.secao?.h ?? 40;
  const Ls = (el.vaos ?? []).map((v) => v.L ?? 0), L = Ls.reduce((s, x) => s + x, 0);
  const out = { concreto: (b * h * L) / 1e4, forma: ((el.baldrame ? 2 * h : b + 2 * h) * L) / 100, notas: [] };
  if (el.baldrame) out.notas.push('Baldrame: fôrma só nas laterais.');
  const a = aco();
  // com o detalhamento (0.27): a lista de ferros, já com as edições do usuário
  if (r && !r.erro && r.detalhamento?.posicoes?.length) {
    for (const q of aplicarEdicoes(r.detalhamento.posicoes, el.detalhamento?.edicoes)) a.barras(q.phi, q.n, q.comprimento / 100, q.emendas);
    out.notas.push('Aço pela lista de ferros do detalhamento.');
    return { ...out, aco: a.kg, pecas: a.pecas, detalhado: true };
  }
  if (r && !r.erro) {
    const cob = 3;
    (r.vaos ?? []).forEach((v, k) => {
      const pb = v.positiva?.barras;
      if (pb) a.barras(pb.phi, pb.n, Ls[k] + 2 * 20 * pb.phi / 1000);       // ancoragem nos apoios ≈ 20ø
      const e = v.estribos;
      if (e?.phi && e?.s) {
        const n = Math.ceil((Ls[k] * 100) / e.s) + 1;
        a.barras(e.phi, n, (2 * (b - 2 * cob) + 2 * (h - 2 * cob)) / 100 + 2 * 10 * e.phi / 1000);
      }
      // porta-estribos no trecho sem negativa
      const negEsq = r.apoios?.[k]?.negativa?.barras, negDir = r.apoios?.[k + 1]?.negativa?.barras;
      const livre = Ls[k] * (1 - (negEsq ? 0.25 : 0) - (negDir ? 0.25 : 0));
      if (livre > 0) a.barras(6.3, 2, livre);
      if (v.torcao?.Asl) a.malha(10, v.torcao.Asl, 1, Ls[k]); // Asl da torção (cm²) ao longo do vão
    });
    (r.apoios ?? []).forEach((ap, k) => {
      const nb = ap.negativa?.barras;
      if (!nb) return;
      const Le = Ls[k - 1] ?? 0, Ld = Ls[k] ?? 0;
      const c = 0.25 * Le + 0.25 * Ld + (Le && Ld ? 2 : 3) * 10 * nb.phi / 1000;
      a.barras(nb.phi, nb.n, c);
    });
  }
  return { ...out, aco: a.kg, pecas: a.pecas };
}

function lajeMacica(el, r, projeto) {
  const { lx = 1, ly = 1, h = 10, bordas = {} } = el;
  const out = { concreto: (lx * ly * h) / 100, forma: lx * ly, notas: [] };
  const a = aco();
  const pos = r && !r.erro && projeto ? posicoesDe(el, r, projeto) : null;
  if (pos) {
    for (const q of pos) a.barras(q.phi, q.n, q.comprimento / 100, q.emendas);
    out.notas.push('Aço pela lista de ferros do detalhamento (negativas entre lajes contadas uma vez).');
    return { ...out, aco: a.kg, pecas: a.pecas, detalhado: true };
  }
  for (const arm of r?.armaduras ?? []) {
    const b = arm.barras;
    if (!b?.phi) continue;
    const As = b.AsEf ?? asDeRotulo(b);
    const x = /x/.test(arm.rotulo.split(' ')[1] ?? arm.rotulo);
    if (/Positiva/.test(arm.rotulo)) {
      // barras na direção do rótulo, distribuídas na outra dimensão, com ganchos
      a.malha(b.phi, As, x ? ly : lx, (x ? lx : ly) + 0.2);
    } else {
      // negativa: cada borda engastada daquela direção leva l/4 desta laje (a vizinha conta a sua parte)
      const ids = x ? ['x0', 'x1'] : ['y0', 'y1'];
      const n = ids.filter((k) => bordas[k] === 'engastada').length;
      a.malha(b.phi, As, (x ? ly : lx) * n, 0.25 * Math.min(lx, ly) + 0.15);
    }
  }
  return { ...out, aco: a.kg, pecas: a.pecas };
}

function lajeNervurada(el, r, projeto) {
  const A = (el.lx ?? 1) * (el.ly ?? 1);
  // concreto pela geometria (capa, nervuras, faixas maciças de borda e travamentos)
  const geo = geometriaNervurada(el);
  const concreto = geo.caixas.filter((c) => c.tipo === 'concreto').reduce((s, c) => s + (c.max[0] - c.min[0]) * (c.max[1] - c.min[1]) * (c.max[2] - c.min[2]), 0) / 1e6;
  const out = { concreto, forma: A, notas: ['Nervurada: concreto pela geometria (capa, nervuras e faixas de borda); fôrma = área da laje (cubetas ou enchimento).'] };
  const a = aco();
  if (pelaLista(el, r, projeto, a)) return { ...out, aco: a.kg, pecas: a.pecas, notas: [...out.notas, 'Aço pela lista de ferros do detalhamento.'], detalhado: true };
  return { ...out, aco: {} };
}

function lajeTrelicada(el) {
  const e = (el.intereixo ?? 42) / 100, bw = (el.bw ?? 9) / 100, he = (el.he ?? 12) / 100, hf = (el.hf ?? 4) / 100;
  const A = (el.L ?? 1) * (el.largura ?? 1);
  return { concreto: (hf + (bw * he) / e) * A, forma: 0, aco: {}, notas: ['Treliçada: concreto da capa e das nervuras moldado na obra; vigotas, treliças e enchimento à parte.'] };
}

function lajeAlveolar(el) {
  const A = (el.L ?? 1) * (el.largura ?? 1);
  return { concreto: ((el.capa ?? 5) / 100) * A, forma: 0, aco: {}, notas: ['Alveolar: só a capa moldada na obra; painéis pré-fabricados à parte.'] };
}

function pilar(el, r, projeto) {
  const bx = el.bx ?? 20, by = el.by ?? 20, L = el.comprimento ?? 2.8;
  const D = el.forma === 'circular' ? Number(el.D) || bx : null;
  const out = D
    ? { concreto: ((Math.PI * D * D) / 4 * L) / 1e4, forma: (Math.PI * D * L) / 100, notas: ['Pilar circular: fôrma pelo perímetro πD.'] }
    : { concreto: (bx * by * L) / 1e4, forma: (2 * (bx + by) * L) / 100, notas: [] };
  const a = aco();
  const pos = r && !r.erro ? posicoesDe(el, r, projeto) : null;
  if (pos) {
    for (const q of pos) a.barras(q.phi, q.n, q.comprimento / 100, q.emendas);
    out.notas.push('Aço pela lista de ferros do detalhamento.');
    return { ...out, aco: a.kg, pecas: a.pecas, detalhado: true };
  }
  const arm = r?.armadura;
  if (arm?.phi && arm?.n) a.barras(arm.phi, arm.n, L + 40 * arm.phi / 1000);            // espera/emenda ≈ 40ø
  const e = arm?.estribo;
  if (e?.phi && e?.s) {
    const cob = 3;
    a.barras(e.phi, Math.ceil((L * 100) / e.s) + 1, (2 * (bx - 2 * cob) + 2 * (by - 2 * cob)) / 100 + 2 * 10 * e.phi / 1000);
  }
  return { ...out, aco: a.kg, pecas: a.pecas };
}

/** Aço pela lista de ferros do detalhamento (com as edições do usuário), ou null. */
function pelaLista(el, r, projeto, a) {
  const pos = r && !r.erro ? posicoesDe(el, r, projeto) : null;
  if (!pos) return false;
  for (const q of pos) a.barras(q.phi, q.n, q.comprimento / 100, q.emendas);
  return true;
}

function sapata(el, r, projeto) {
  if (!r || r.erro) return { concreto: 0, forma: 0, aco: {}, notas: ['Sapata sem cálculo.'] };
  const A = r.A / 100, B = r.B / 100, h0 = (r.h0 ?? 20) / 100, cob = (r.cobrimento ?? 4) / 100;
  const a = aco();
  if (pelaLista(el, r, projeto, a)) return { concreto: r.volume ?? 0, forma: 2 * (A + B) * h0, aco: a.kg, pecas: a.pecas, notas: ['Aço pela lista de ferros do detalhamento.'], detalhado: true };
  const mx = r.flexao?.x?.malha, my = r.flexao?.y?.malha;
  if (mx) a.barras(mx.phi, mx.n, A - 2 * cob + 2 * 0.15);
  if (my) a.barras(my.phi, my.n, B - 2 * cob + 2 * 0.15);
  return { concreto: r.volume ?? 0, forma: 2 * (A + B) * h0, aco: a.kg, pecas: a.pecas, notas: [] };
}

function bloco(el, r, projeto) {
  if (!r || r.erro) return { concreto: 0, forma: 0, aco: {}, notas: ['Bloco sem cálculo.'] };
  const A = r.A / 100, B = r.B / 100, h = r.h / 100;
  const a = aco();
  if (pelaLista(el, r, projeto, a)) {
    const D = (r.estaca?.D ?? 30) / 100, Le = r.estaca?.L ?? 0;
    return { concreto: A * B * h, forma: 2 * (A + B) * h, aco: a.kg, pecas: a.pecas, estacas: { n: r.n, metros: r.n * Le, volume: r.n * Le * Math.PI * D * D / 4 }, notas: ['Aço pela lista de ferros do detalhamento (bloco e gaiola das estacas).'], detalhado: true };
  }
  const arm = r.armadura ?? {};
  const gancho = 2 * Math.max(0.2, h - 0.15);
  for (const [k, L] of [['x', A], ['y', B]]) {
    const t = arm[k];
    const b = lerBarras(t?.rotulo);
    if (b?.phi) a.barras(b.phi, (b.n ?? 2) * (t.faixas ?? 1), L - 0.1 + gancho);
    const m = lerBarras(arm.malha?.[k]);
    if (m?.phi) a.barras(m.phi, m.n ?? Math.ceil(((k === 'x' ? B : A) * 100) / (m.s || 20)), L - 0.1 + 0.3);
  }
  if (arm.tipo === 'fendilhamento' && arm.As) a.malha(8, arm.As, 1, 2 * (A + B)); // estribos horizontais
  const D = (r.estaca?.D ?? 30) / 100, Le = r.estaca?.L ?? 0;
  return { concreto: A * B * h, forma: 2 * (A + B) * h, aco: a.kg, pecas: a.pecas, estacas: { n: r.n, metros: r.n * Le, volume: r.n * Le * Math.PI * D * D / 4 }, notas: [] };
}

function estaca(el, r, projeto) {
  const D = (el.D ?? 40) / 100, L = el.L ?? 8;
  const A = el.secao === 'quadrada' ? D * D : Math.PI * D * D / 4;
  const a = aco();
  if (pelaLista(el, r, projeto, a)) return { concreto: 0, forma: 0, aco: a.kg, pecas: a.pecas, estacas: { n: 1, metros: L, volume: A * L }, notas: ['Estaca: concreto em Estacas; aço pela gaiola calculada (NBR 6122).'], detalhado: true };
  return { concreto: 0, forma: 0, aco: {}, estacas: { n: 1, metros: L, volume: A * L }, notas: ['Estaca: concreto em Estacas; armadura não calculada.'] };
}

function sapataCorrida(el, r, projeto) {
  if (!r || r.erro) return { concreto: 0, forma: 0, aco: {}, notas: ['Sapata corrida sem cálculo.'] };
  const a = aco();
  const forma = 2 * r.L * (r.h0 / 100);
  if (pelaLista(el, r, projeto, a)) return { concreto: r.volume ?? 0, forma, aco: a.kg, pecas: a.pecas, notas: ['Aço pela lista de ferros do detalhamento.'], detalhado: true };
  return { concreto: r.volume ?? 0, forma, aco: {}, notas: [] };
}

function radier(el, r, projeto) {
  if (!r || r.erro) return { concreto: 0, forma: 0, aco: {}, notas: ['Radier sem cálculo.'] };
  const a = aco();
  const forma = 2 * (r.lx + r.ly) * (r.h / 100);
  if (pelaLista(el, r, projeto, a)) return { concreto: r.volume ?? 0, forma, aco: a.kg, pecas: a.pecas, notas: ['Aço pela lista de ferros do detalhamento.'], detalhado: true };
  return { concreto: r.volume ?? 0, forma, aco: {}, notas: [] };
}

function escada(el, r) {
  if (!r || r.erro) return { concreto: 0, forma: 0, aco: {}, notas: ['Escada sem cálculo.'] };
  const b = r.largura, h = r.h / 100, e = r.degraus.e / 100, p = r.degraus.p / 100;
  const cos = p / Math.hypot(p, e);
  let concreto = 0, forma = 0;
  for (const l of r.geometria.lances) {
    const proj = l.sentido[1] !== 0 ? l.y1 - l.y0 : l.x1 - l.x0;
    concreto += (proj / cos) * b * h + (l.espelhos - 1) * (e * p / 2) * b;
    forma += (proj / cos) * b + l.espelhos * e * b;     // fundo inclinado e espelhos
  }
  for (const pt of r.geometria.patamares) { const A = (pt.x1 - pt.x0) * (pt.y1 - pt.y0); concreto += A * h; forma += A; }
  const a = aco();
  for (const t of r.tramos) {
    const Linc = t.L / cos;
    if (t.barras) a.malha(t.barras.phi, t.barras.AsEf, b, Linc + 0.3);
    const d = lerBarras(t.dist);
    if (d?.phi) a.malha(d.phi, asDeRotulo(d), Linc, b);
    const n = lerBarras(t.neg);
    if (n?.phi) a.malha(n.phi, asDeRotulo(n), 2 * b, 0.25 * t.L + 0.3);
  }
  return { concreto, forma, aco: a.kg, pecas: a.pecas, notas: [] };
}

function reservatorio(el, r) {
  if (!r || r.erro) return { concreto: 0, forma: 0, aco: {}, notas: ['Reservatório sem cálculo.'] };
  const { Lx, Ly, Hw } = r.geometria;
  const gama = 25;
  const concreto = (r.pesos.paredes + r.pesos.fundo + r.pesos.tampa) / gama;
  const forma = 2 * (2 * (Lx + Ly)) * r.H + (r.tipo === 'elevado' ? (r.a + 2 * r.e / 100) * (r.b + 2 * r.e / 100) : 0) + (r.tampa ? r.a * r.b : 0);
  const a = aco();
  const dims = { A: [Lx, Hw, 2], B: [Ly, Hw, 2], F: [Lx, Ly, 1], T: [Lx, Ly, 1] };
  for (const arm of r.armaduras) {
    const bb = arm.barras;
    if (!bb?.phi) continue;
    const [L1, L2, nPlacas] = dims[arm.placa];
    // barras na direção de L1 (horizontal / x) ou L2 (vertical / y)
    const ao = arm.dir === 'horizontal' || arm.dir === 'x';
    const comp = ao ? L1 : L2, larg = ao ? L2 : L1;
    if (arm.pos === 'vão') a.malha(bb.phi, bb.AsEf, larg * nPlacas, comp + 0.3);
    else a.malha(bb.phi, bb.AsEf, (arm.placa === 'A' || arm.placa === 'B') && !ao ? larg * nPlacas : 2 * larg * nPlacas, 0.25 * comp + 0.3);
  }
  for (const t of r.tirantes ?? []) a.malha(12.5, t.As, 2, t.L + 0.5);
  return { concreto, forma, aco: a.kg, pecas: a.pecas, notas: [] };
}

const POR_MODULO = {
  'concreto.viga': viga, 'concreto.laje.macica': lajeMacica, 'concreto.laje.nervurada': lajeNervurada,
  'concreto.laje.trelicada': lajeTrelicada, 'concreto.laje.alveolar': lajeAlveolar, 'concreto.pilar': pilar,
  'concreto.sapata': sapata, 'concreto.bloco': bloco, 'geotecnia.estaca': estaca, 'concreto.escada': escada,
  'concreto.reservatorio': reservatorio, 'concreto.sapataCorrida': sapataCorrida, 'concreto.radier': radier,
};

const NOMES = {
  'concreto.viga': 'Viga', 'concreto.laje.macica': 'Laje maciça', 'concreto.laje.nervurada': 'Laje nervurada',
  'concreto.laje.trelicada': 'Laje treliçada', 'concreto.laje.alveolar': 'Laje alveolar', 'concreto.pilar': 'Pilar',
  'concreto.sapata': 'Sapata', 'concreto.bloco': 'Bloco sobre estacas', 'geotecnia.estaca': 'Estaca', 'concreto.escada': 'Escada',
  'concreto.reservatorio': 'Reservatório', 'concreto.sapataCorrida': 'Sapata corrida', 'concreto.radier': 'Radier',
};

/** Quantitativo de um elemento dos módulos internos (sem o registro), ou null se o módulo não estima. */
export function quantitativosDoElemento(el, resultado = el?.resultado, projeto = null) {
  const fn = POR_MODULO[el?.modulo];
  return fn ? fn(el, resultado, projeto) : null;
}

/* ------------------------------------------------------------------ agregação */

const vazio = () => ({ concreto: 0, forma: 0, aco: {}, pecas: {}, estacas: { n: 0, metros: 0, volume: 0 } });
function somar(t, q) {
  t.concreto += q.concreto ?? 0; t.forma += q.forma ?? 0;
  for (const [phi, kg] of Object.entries(q.aco ?? {})) t.aco[phi] = (t.aco[phi] ?? 0) + kg;
  for (const [phi, n] of Object.entries(q.pecas ?? {})) t.pecas[phi] = (t.pecas[phi] ?? 0) + n;
  if (q.estacas) { t.estacas.n += q.estacas.n ?? 0; t.estacas.metros += q.estacas.metros ?? 0; t.estacas.volume += q.estacas.volume ?? 0; }
  return t;
}
export const acoTotal = (q) => Object.values(q.aco ?? {}).reduce((s, v) => s + v, 0);
/** Número de segmentos de barra (peças cortadas de barras de 12 m). */
export const pecasTotal = (q) => Object.values(q.pecas ?? {}).reduce((s, v) => s + v, 0);

/** Grupo (pavimento) de um elemento: o da posição; fundações pelo pilar ligado vão para "Fundações". */
function grupoDe(el, projeto, categoria) {
  if (categoria === 'fundacoes') return { id: '_fund', nome: 'Fundações', ordem: -Infinity };
  const pav = el.posicao && projeto.pavimentos?.find((p) => p.id === el.posicao.pavimento);
  if (pav) return { id: pav.id, nome: pav.nome, ordem: pav.cota };
  return { id: '_sem', nome: 'Sem posição na montagem', ordem: Infinity };
}

/**
 * Quantitativos do projeto.
 * @param {object} projeto
 * @param {{obter(id):object}} registro  registro de módulos (categoria, nome, `quantitativos` opcional)
 * @returns {{ elementos, pavimentos, total, sem: string[], bitolas: number[] }}
 */
export function quantitativosDoProjeto(projeto0, registro) {
  // pavimento tipo (etapa L9): cada repetição conta, com o nome do nível ("Tipo (2/4)")
  const projeto = expandirTipos(projeto0);
  const elementos = [], sem = [];
  for (const el of projeto.elementos) {
    const mod = registro.obter(el.modulo);
    const fn = mod?.quantitativos ?? POR_MODULO[el.modulo];
    if (!fn) { if (mod?.categoria !== 'sondagens') sem.push(el.codigo); continue; }
    const q = fn(el, el.resultado, projeto);
    const grupo = grupoDe(el, projeto, mod?.categoria);
    elementos.push({ id: el.id, codigo: el.codigo, nome: el.nome, modulo: el.modulo, tipo: NOMES[el.modulo] ?? mod?.nomeCurto ?? mod?.nome ?? el.modulo, categoria: mod?.categoria,
      grupo, calculado: !!(el.resultado && !el.resultado.erro), ...vazio(), ...q, estacas: { ...vazio().estacas, ...(q.estacas ?? {}) } });
  }
  const mapa = new Map();
  for (const e of elementos) {
    if (!mapa.has(e.grupo.id)) mapa.set(e.grupo.id, { ...e.grupo, ...vazio(), elementos: [], porTipo: {} });
    const g = mapa.get(e.grupo.id);
    somar(g, e); g.elementos.push(e);
    g.porTipo[e.categoria] = somar(g.porTipo[e.categoria] ?? vazio(), e);
  }
  const pavimentos = [...mapa.values()].sort((a, b) => b.ordem - a.ordem);
  const total = elementos.reduce((t, e) => somar(t, e), vazio());
  const bitolas = BITOLAS_QUANT.filter((phi) => (total.aco[phi] ?? 0) > 0).concat(Object.keys(total.aco).map(Number).filter((x) => !BITOLAS_QUANT.includes(x)));
  return { elementos, pavimentos, total, sem, bitolas, resumoAco: resumoDoAco(total, elementos, projeto) };
}

/** Perdas de aço adotadas no projeto (%): pontas, cortes e emendas não previstas. */
export const perdasDoProjeto = (projeto) => (Number.isFinite(Number(projeto?.parametros?.perdasAco)) ? Number(projeto.parametros.perdasAco) : 10);

/**
 * Resumo do aço do projeto por bitola, com perdas: metros, massa, massa com perdas e barras de 12 m.
 * ø 5 e ø 6 em CA-60; as demais em CA-50.
 */
export function resumoDoAco(total, elementos, projeto) {
  const perdas = perdasDoProjeto(projeto), f = 1 + perdas / 100;
  const linhas = Object.entries(total.aco).filter(([, kg]) => kg > 0).map(([phi, kg]) => {
    const d = Number(phi), metros = kg / massaLinear(d);
    return { phi: d, aco: d <= 6 ? 'CA-60' : 'CA-50', metros, kg, kgPerdas: kg * f, barras12: Math.ceil((metros * f) / 12) };
  }).sort((a, b) => a.phi - b.phi);
  const kg = linhas.reduce((t, l) => t + l.kg, 0);
  const comAco = elementos.filter((e) => acoTotal(e) > 0);
  return {
    perdas, linhas, total: kg, totalPerdas: kg * f,
    porAco: ['CA-50', 'CA-60'].map((a) => ({ aco: a, kg: linhas.filter((l) => l.aco === a).reduce((t, l) => t + l.kg, 0) * f })).filter((x) => x.kg > 0),
    detalhados: comAco.filter((e) => e.detalhado).length, estimados: comAco.filter((e) => !e.detalhado).length,
  };
}

/* ------------------------------------------------------------------ CSV */

const nCsv = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '');
const tCsv = (s) => (/[;"\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));

/**
 * CSV no padrão das planilhas em português: separador ";", vírgula decimal, UTF-8 com BOM.
 * Uma linha por elemento, subtotal por pavimento e o total do projeto.
 */
export function quantitativosCSV(q, { projeto } = {}) {
  const fmtPhi = (phi) => `ø ${String(phi).replace('.', ',')} (kg)`;
  const cab = ['Pavimento', 'Tipo', 'Código', 'Nome', 'Concreto (m³)', 'Fôrma (m²)', 'Aço (kg)', ...q.bitolas.map(fmtPhi), 'Taxa de aço (kg/m³)', 'Segmentos de barra', 'Estacas (m)', 'Concreto das estacas (m³)'];
  const linha = (pav, tipo, codigo, nome, x) => {
    const at = acoTotal(x);
    return [pav, tipo, codigo, nome, nCsv(x.concreto, 3), nCsv(x.forma, 2), nCsv(at, 1), ...q.bitolas.map((phi) => nCsv(x.aco[phi] ?? 0, 1)), x.concreto > 0 ? nCsv(at / x.concreto, 1) : '', String(pecasTotal(x)), nCsv(x.estacas?.metros ?? 0, 2), nCsv(x.estacas?.volume ?? 0, 3)].map(tCsv).join(';');
  };
  const linhas = [];
  if (projeto) linhas.push(tCsv(`Quantitativos — ${projeto.meta?.nome ?? 'Projeto'}`), tCsv('Vigas, pilares e lajes maciças pela lista de ferros do detalhamento; demais elementos com comprimentos de barra aproximados (LEBR).'), '');
  linhas.push(cab.map(tCsv).join(';'));
  for (const g of q.pavimentos) {
    for (const e of [...g.elementos].sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'pt', { numeric: true }))) linhas.push(linha(g.nome, e.tipo, e.codigo, e.nome, e));
    linhas.push(linha(g.nome, 'Subtotal', '', '', g));
  }
  linhas.push(linha('Total do projeto', '', '', '', q.total));
  // resumo do aço por bitola, com perdas
  const r = q.resumoAco;
  if (r?.linhas?.length) {
    linhas.push('', tCsv(`Resumo do aço — perdas de ${nCsv(r.perdas, 0)} %`));
    linhas.push(['Aço', 'Bitola (mm)', 'Comprimento (m)', 'Massa (kg)', 'Massa com perdas (kg)', 'Barras de 12 m'].map(tCsv).join(';'));
    for (const l of r.linhas) linhas.push([l.aco, nCsv(l.phi, 1), nCsv(l.metros, 1), nCsv(l.kg, 1), nCsv(l.kgPerdas, 1), String(l.barras12)].map(tCsv).join(';'));
    linhas.push(['Total', '', '', nCsv(r.total, 1), nCsv(r.totalPerdas, 1), ''].map(tCsv).join(';'));
  }
  return `﻿${linhas.join('\r\n')}\r\n`;
}
