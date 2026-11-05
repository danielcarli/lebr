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
 * Gravador de DXF ASCII (R12, AC1009) — formato aberto lido por LibreCAD, QCAD, AutoCAD, BricsCAD e DraftSight.
 *
 * Só o necessário para pranchas: camadas com cor e tipo de linha, LINE, POLYLINE (aberta ou fechada), CIRCLE e
 * TEXT com alinhamento. Unidade do desenho: centímetro. O texto vai em ANSI 1252 (o arquivo deve ser gravado em
 * latin1); "ø" vira o código %%c do CAD e caracteres fora da página de código são trocados por equivalentes.
 */

/** Cores ACI usuais. */
export const COR = { vermelho: 1, amarelo: 2, verde: 3, ciano: 4, azul: 5, magenta: 6, branco: 7, cinza: 8, cinzaClaro: 9 };

const TIPOS_LINHA = {
  CONTINUOUS: { descricao: 'Solid line', padrao: [] },
  DASHED: { descricao: '__ __ __', padrao: [0.5, -0.25] },
  CENTER: { descricao: '____ _ ____', padrao: [1.25, -0.25, 0.25, -0.25] },
  HIDDEN: { descricao: '- - - -', padrao: [0.25, -0.125] },
};

const JUST_H = { esquerda: 0, centro: 1, direita: 2 };
const JUST_V = { base: 0, baixo: 1, meio: 2, cima: 3 };

/** Troca o que não cabe em ANSI 1252 e usa os códigos do CAD para diâmetro e grau. */
export function textoCad(t) {
  return String(t ?? '')
    .replace(/[øØ⌀]/g, '%%c').replace(/°/g, '%%d').replace(/±/g, '%%p')
    .replace(/[—–]/g, '-').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/[·•]/g, '.')
    .replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/…/g, '...')
    .replace(/[^\x20-\x7E -ÿ]/g, '?');
}

const n = (v) => {
  const x = Math.abs(v) < 1e-9 ? 0 : v;
  return Number.isFinite(x) ? String(Math.round(x * 10000) / 10000) : '0';
};

export class Dxf {
  #ents = [];
  camadas = new Map();
  #min = [Infinity, Infinity];
  #max = [-Infinity, -Infinity];

  /** @param {{escalaLinhas?:number}} op  $LTSCALE (tamanho dos traços em unidades do desenho) */
  constructor({ escalaLinhas = 20 } = {}) { this.escalaLinhas = escalaLinhas; }

  camada(nome, { cor = COR.branco, linha = 'CONTINUOUS' } = {}) {
    this.camadas.set(nome, { cor, linha });
    return this;
  }

  #usadas = new Set();
  #usar(c) { if (!this.camadas.has(c)) this.camada(c); this.#usadas.add(c); }
  #ext(x, y) { this.#min = [Math.min(this.#min[0], x), Math.min(this.#min[1], y)]; this.#max = [Math.max(this.#max[0], x), Math.max(this.#max[1], y)]; }

  linha(c, [x1, y1], [x2, y2]) {
    this.#usar(c); this.#ext(x1, y1); this.#ext(x2, y2);
    this.#ents.push(['0', 'LINE', '8', c, '10', n(x1), '20', n(y1), '30', '0', '11', n(x2), '21', n(y2), '31', '0']);
    return this;
  }

  /** Polilinha 2D; `fechada` liga o último ponto ao primeiro. */
  polilinha(c, pontos, { fechada = false } = {}) {
    if (!pontos?.length) return this;
    this.#usar(c);
    const e = ['0', 'POLYLINE', '8', c, '66', '1', '70', fechada ? '1' : '0', '10', '0', '20', '0', '30', '0'];
    for (const [x, y] of pontos) { this.#ext(x, y); e.push('0', 'VERTEX', '8', c, '10', n(x), '20', n(y), '30', '0'); }
    e.push('0', 'SEQEND', '8', c);
    this.#ents.push(e);
    return this;
  }

  retangulo(c, [x0, y0], [x1, y1]) { return this.polilinha(c, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], { fechada: true }); }

  circulo(c, [x, y], r) {
    this.#usar(c); this.#ext(x - r, y - r); this.#ext(x + r, y + r);
    this.#ents.push(['0', 'CIRCLE', '8', c, '10', n(x), '20', n(y), '30', '0', '40', n(r)]);
    return this;
  }

  /**
   * Texto. `alinhar`: 'esquerda' | 'centro' | 'direita'; `vertical`: 'base' | 'baixo' | 'meio' | 'cima'; `angulo` em graus.
   */
  texto(c, [x, y], conteudo, { altura = 10, alinhar = 'esquerda', vertical = 'base', angulo = 0 } = {}) {
    const t = textoCad(conteudo);
    if (!t) return this;
    this.#usar(c);
    const largura = t.length * altura * 0.62;
    this.#ext(x, y); this.#ext(x + largura * Math.cos((angulo * Math.PI) / 180), y + largura * Math.sin((angulo * Math.PI) / 180) + altura);
    const h = JUST_H[alinhar] ?? 0, v = JUST_V[vertical] ?? 0;
    const e = ['0', 'TEXT', '8', c, '10', n(x), '20', n(y), '30', '0', '40', n(altura), '1', t];
    if (angulo) e.push('50', n(angulo));
    if (h || v) e.push('72', String(h), '11', n(x), '21', n(y), '31', '0', '73', String(v));
    this.#ents.push(e);
    return this;
  }

  /** Cota alinhada entre dois pontos, com linhas de chamada, traços a 45° e o texto sobre a linha. */
  cota(c, p1, p2, { afastamento = 30, texto = null, altura = 10, casas = 0, unidade = 1 } = {}) {
    const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
    const L = Math.hypot(dx, dy);
    if (!(L > 1e-6)) return this;
    const u = [dx / L, dy / L], nrm = [-u[1], u[0]];
    const a = [p1[0] + nrm[0] * afastamento, p1[1] + nrm[1] * afastamento];
    const b = [p2[0] + nrm[0] * afastamento, p2[1] + nrm[1] * afastamento];
    const sinal = Math.sign(afastamento) || 1;
    const ext = (p, q) => this.linha(c, [p[0] + nrm[0] * sinal * 4, p[1] + nrm[1] * sinal * 4], [q[0] + nrm[0] * sinal * 6, q[1] + nrm[1] * sinal * 6]);
    ext(p1, a); ext(p2, b);
    this.linha(c, a, b);
    const tk = altura * 0.45;
    for (const p of [a, b]) this.linha(c, [p[0] - (u[0] + nrm[0]) * tk, p[1] - (u[1] + nrm[1]) * tk], [p[0] + (u[0] + nrm[0]) * tk, p[1] + (u[1] + nrm[1]) * tk]);
    let ang = (Math.atan2(u[1], u[0]) * 180) / Math.PI;
    if (ang > 90.001 || ang < -89.999) ang += 180;
    const m = [(a[0] + b[0]) / 2 + nrm[0] * altura * 0.4 * (ang === (Math.atan2(u[1], u[0]) * 180) / Math.PI ? 1 : -1), (a[1] + b[1]) / 2 + nrm[1] * altura * 0.4 * (ang === (Math.atan2(u[1], u[0]) * 180) / Math.PI ? 1 : -1)];
    const valor = texto ?? (L * unidade).toFixed(casas).replace('.', ',');
    return this.texto(c, m, valor, { altura, alinhar: 'centro', vertical: 'baixo', angulo: ang });
  }

  /** Extensão do desenho [[xmin, ymin], [xmax, ymax]]. */
  get extensao() { return [[...this.#min], [...this.#max]]; }

  get entidades() { return this.#ents.length; }

  /** Camadas com desenho. */
  get camadasUsadas() { return [...this.#usadas]; }

  toString() {
    const out = [];
    const [mn, mx] = Number.isFinite(this.#min[0]) ? [this.#min, this.#max] : [[0, 0], [100, 100]];
    out.push('0', 'SECTION', '2', 'HEADER',
      '9', '$ACADVER', '1', 'AC1009',
      '9', '$DWGCODEPAGE', '3', 'ANSI_1252',
      '9', '$INSBASE', '10', '0', '20', '0', '30', '0',
      '9', '$EXTMIN', '10', n(mn[0]), '20', n(mn[1]), '30', '0',
      '9', '$EXTMAX', '10', n(mx[0]), '20', n(mx[1]), '30', '0',
      '9', '$LTSCALE', '40', n(this.escalaLinhas),
      '0', 'ENDSEC');
    out.push('0', 'SECTION', '2', 'TABLES');
    out.push('0', 'TABLE', '2', 'LTYPE', '70', String(Object.keys(TIPOS_LINHA).length));
    for (const [nome, t] of Object.entries(TIPOS_LINHA)) {
      const total = t.padrao.reduce((s, v) => s + Math.abs(v), 0);
      out.push('0', 'LTYPE', '2', nome, '70', '0', '3', t.descricao, '72', '65', '73', String(t.padrao.length), '40', n(total));
      for (const v of t.padrao) out.push('49', n(v));
    }
    out.push('0', 'ENDTAB');
    // só as camadas que têm desenho (mais a 0, obrigatória)
    const camadas = [['0', { cor: COR.branco, linha: 'CONTINUOUS' }], ...[...this.camadas].filter(([k]) => k !== '0' && this.#usadas.has(k))];
    out.push('0', 'TABLE', '2', 'LAYER', '70', String(camadas.length));
    for (const [nome, c] of camadas) out.push('0', 'LAYER', '2', nome, '70', '0', '62', String(c.cor), '6', c.linha);
    out.push('0', 'ENDTAB');
    out.push('0', 'TABLE', '2', 'STYLE', '70', '1', '0', 'STYLE', '2', 'STANDARD', '70', '0', '40', '0', '41', '1', '50', '0', '71', '0', '42', '2.5', '3', 'txt', '4', '', '0', 'ENDTAB');
    out.push('0', 'ENDSEC');
    out.push('0', 'SECTION', '2', 'ENTITIES');
    for (const e of this.#ents) out.push(...e);
    out.push('0', 'ENDSEC', '0', 'EOF');
    return `${out.join('\r\n')}\r\n`;
  }
}

/** Lê um DXF gerado (ou qualquer R12 simples) em entidades — usado nos testes. */
export function lerDxf(texto) {
  const l = texto.split(/\r?\n/);
  const pares = [];
  for (let i = 0; i + 1 < l.length; i += 2) pares.push([l[i].trim(), l[i + 1]]);
  const ents = [], camadas = [];
  let sec = null, atual = null, tabela = null;
  for (const [c, v] of pares) {
    if (c === '0') {
      if (atual) (tabela === 'LAYER' && atual.tipo === 'LAYER' ? camadas : sec === 'ENTITIES' ? ents : []).push(atual);
      atual = null;
      if (v === 'SECTION' || v === 'ENDSEC' || v === 'EOF') { if (v === 'ENDSEC') sec = null; continue; }
      if (v === 'TABLE') { tabela = 'pendente'; continue; }
      if (v === 'ENDTAB') { tabela = null; continue; }
      atual = { tipo: v, g: {} };
      continue;
    }
    if (c === '2' && !atual && sec === null) { sec = v; continue; }
    if (c === '2' && tabela === 'pendente') { tabela = v; continue; }
    if (atual) (atual.g[c] ??= []).push(v);
  }
  return { entidades: ents.filter((e) => !['VERTEX', 'SEQEND'].includes(e.tipo)), vertices: ents.filter((e) => e.tipo === 'VERTEX'), camadas: camadas.map((x) => x.g['2']?.[0]) };
}
