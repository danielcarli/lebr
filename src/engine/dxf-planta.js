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
 * Leitura de uma planta de arquitetura em DXF (ASCII) para servir de fundo na montagem (0.32).
 *
 * Lê LINE, LWPOLYLINE e POLYLINE (com arcos por "bulge"), CIRCLE, ARC, ELLIPSE, SPLINE (pelos pontos), TEXT, MTEXT,
 * e expande os blocos (INSERT, com escala, rotação e matrizes de linhas e colunas; também as cotas, DIMENSION). Ignora
 * hachuras, imagens, sólidos e o espaço de papel. Tudo vira linhas poligonais e textos, nas unidades do desenho;
 * `fatorMetros` diz quanto vale uma unidade em metros.
 *
 * Saída: { unidade, fatorMetros, unidadeLida, camadas: [nome], entidades: [{ c, p: [x0,y0,x1,y1,…], f }],
 *          textos: [{ c, x, y, h, r, t }], limites: { x0, y0, x1, y1 }, ignoradas: { TIPO: n }, cortado }
 */

const UNIDADES = { 1: ['pol', 0.0254], 2: ['pé', 0.3048], 4: ['mm', 0.001], 5: ['cm', 0.01], 6: ['m', 1] };
export const FATOR_UNIDADE = { mm: 0.001, cm: 0.01, m: 1, pol: 0.0254, 'pé': 0.3048 };
const LIMITE_PONTOS = 600000;

/** Pares (código, valor) do arquivo. */
function pares(texto) {
  const linhas = texto.split(/\r\n|\r|\n/);
  const out = [];
  for (let i = 0; i + 1 < linhas.length; i += 2) {
    const c = parseInt(linhas[i].trim(), 10);
    if (Number.isNaN(c)) { i -= 1; continue; } // linha em branco solta: realinha
    out.push([c, linhas[i + 1]]);
  }
  return out;
}

/** Agrupa os pares em entidades: { tipo, g: Map(código → [valores]), lista: [[c,v]…] } */
function entidadesDe(ps, ini, fim) {
  const ents = [];
  let atual = null;
  for (let i = ini; i < fim; i++) {
    const [c, v] = ps[i];
    if (c === 0) {
      atual = { tipo: v.trim(), lista: [] };
      ents.push(atual);
    } else if (atual) atual.lista.push([c, v]);
  }
  return ents;
}
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const primeiro = (e, c, padrao = null) => { const x = e.lista.find((p) => p[0] === c); return x ? x[1] : padrao; };
const numero = (e, c, padrao = 0) => { const x = primeiro(e, c); return x == null ? padrao : num(x); };

/** Limpa os códigos de formatação de um MTEXT. */
export function limparMtext(t) {
  return String(t)
    .replace(/\\P/g, ' ').replace(/\\~/g, ' ')
    .replace(/\\[ACcFfHhQqTtWw][^;]*;/g, '').replace(/\\[LlOoKk]/g, '')
    .replace(/\\S([^;]*)[#^/]([^;]*);/g, '$1/$2')
    .replace(/[{}]/g, '').replace(/\\\\/g, '\\')
    .replace(/%%[cC]/g, 'ø').replace(/%%[dD]/g, '°').replace(/%%[pP]/g, '±')
    .replace(/\s+/g, ' ').trim();
}

/** Arco de a0 a a1 (rad, anti-horário) em pontos. */
function arco(cx, cy, r, a0, a1) {
  let d = a1 - a0;
  while (d <= 0) d += 2 * Math.PI;
  const n = Math.max(4, Math.ceil((d / (2 * Math.PI)) * 48));
  const pts = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (d * i) / n; pts.push(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
  return pts;
}

/** Segmento com "bulge" (tan(θ/4), positivo = anti-horário) entre dois vértices: os pontos depois do primeiro. */
export function comBulge(x0, y0, x1, y1, b) {
  if (!b) return [x1, y1];
  const c = Math.hypot(x1 - x0, y1 - y0);
  if (c < 1e-12) return [x1, y1];
  const th = 4 * Math.atan(b);
  const r = c / (2 * Math.sin(Math.abs(th) / 2));
  const nx = -(y1 - y0) / c, ny = (x1 - x0) / c;      // normal à esquerda da corda
  const d = r * Math.cos(Math.abs(th) / 2) * Math.sign(b);
  const cx = (x0 + x1) / 2 + nx * d, cy = (y0 + y1) / 2 + ny * d;
  const a0 = Math.atan2(y0 - cy, x0 - cx);
  const n = Math.max(2, Math.ceil((Math.abs(th) / (2 * Math.PI)) * 48));
  const pts = [];
  for (let i = 1; i < n; i++) { const a = a0 + (th * i) / n; pts.push(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
  pts.push(x1, y1);
  return pts;
}

/**
 * @param {string} texto  conteúdo do DXF
 * @returns objeto descrito no topo do arquivo
 */
export function lerPlantaDxf(texto) {
  if (/^AutoCAD Binary DXF/.test(texto)) throw new Error('DXF binário não é aceito — salve o desenho como DXF ASCII (texto).');
  if (/^AC10\d\d/.test(texto)) throw new Error('Este é um arquivo DWG — salve o desenho como DXF (ASCII) no programa de CAD.');
  const ps = pares(texto);
  if (!ps.length) throw new Error('O arquivo não parece um DXF.');
  // seções
  const secoes = {};
  for (let i = 0; i < ps.length; i++) {
    if (ps[i][0] === 0 && ps[i][1].trim() === 'SECTION' && ps[i + 1]?.[0] === 2) {
      const nome = ps[i + 1][1].trim();
      let j = i + 2;
      while (j < ps.length && !(ps[j][0] === 0 && ps[j][1].trim() === 'ENDSEC')) j++;
      secoes[nome] = [i + 2, j];
      i = j;
    }
  }
  if (!secoes.ENTITIES) throw new Error('O DXF não tem a seção ENTITIES.');
  // unidade
  let unidadeLida = null;
  if (secoes.HEADER) {
    const [a, b] = secoes.HEADER;
    for (let i = a; i < b; i++) if (ps[i][0] === 9 && ps[i][1].trim() === '$INSUNITS') { unidadeLida = UNIDADES[parseInt(ps[i + 1]?.[1], 10)] ?? null; break; }
  }
  // blocos
  const blocos = new Map();
  if (secoes.BLOCKS) {
    const ents = entidadesDe(ps, ...secoes.BLOCKS);
    let bloco = null;
    for (const e of ents) {
      if (e.tipo === 'BLOCK') { bloco = { nome: (primeiro(e, 2) ?? '').trim(), base: [numero(e, 10), numero(e, 20)], ents: [] }; blocos.set(bloco.nome, bloco); }
      else if (e.tipo === 'ENDBLK') bloco = null;
      else if (bloco) bloco.ents.push(e);
    }
  }

  const camadas = [], idx = new Map();
  const camada = (nome) => { const n = (nome ?? '0').trim() || '0'; if (!idx.has(n)) { idx.set(n, camadas.length); camadas.push(n); } return idx.get(n); };
  const entidades = [], textos = [], ignoradas = {};
  let pontos = 0, cortado = false;

  /** transformação afim [a, b, c, d, e, f]: x' = a·x + c·y + e, y' = b·x + d·y + f */
  const aplicar = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const compor = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const ID = [1, 0, 0, 1, 0, 0];
  const escalaDe = (m) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
  const rotDe = (m) => Math.atan2(m[1], m[0]);

  const empurrar = (c, pts, fechada, m) => {
    if (cortado || pts.length < 4) return;
    if (pontos + pts.length / 2 > LIMITE_PONTOS) { cortado = true; return; }
    const p = [];
    for (let i = 0; i < pts.length; i += 2) { const [x, y] = aplicar(m, pts[i], pts[i + 1]); p.push(x, y); }
    pontos += p.length / 2;
    entidades.push({ c, p, f: fechada ? 1 : 0 });
  };

  function processar(lista, m, camadaPai, prof) {
    for (let i = 0; i < lista.length; i++) {
      const e = lista[i];
      if (cortado) return;
      if (primeiro(e, 67) != null && num(primeiro(e, 67)) === 1) continue;  // espaço de papel
      let nomeCamada = (primeiro(e, 8) ?? '0').trim();
      if (nomeCamada === '0' && camadaPai) nomeCamada = camadaPai;
      const c = () => camada(nomeCamada);
      switch (e.tipo) {
        case 'LINE': empurrar(c(), [numero(e, 10), numero(e, 20), numero(e, 11), numero(e, 21)], false, m); break;
        case 'LWPOLYLINE': {
          const vs = [];
          let atual = null;
          for (const [cc, v] of e.lista) {
            if (cc === 10) { atual = { x: num(v), y: 0, b: 0 }; vs.push(atual); }
            else if (cc === 20 && atual) atual.y = num(v);
            else if (cc === 42 && atual) atual.b = num(v);
          }
          const fechada = (numero(e, 70) & 1) === 1;
          const pts = [];
          vs.forEach((v, k) => {
            if (k === 0) pts.push(v.x, v.y);
            else pts.push(...comBulge(vs[k - 1].x, vs[k - 1].y, v.x, v.y, vs[k - 1].b));
          });
          if (fechada && vs.length > 2) pts.push(...comBulge(vs.at(-1).x, vs.at(-1).y, vs[0].x, vs[0].y, vs.at(-1).b));
          empurrar(c(), pts, fechada, m);
          break;
        }
        case 'POLYLINE': {
          const fechada = (numero(e, 70) & 1) === 1;
          const malha = (numero(e, 70) & (16 | 64)) !== 0;
          const vs = [];
          let j = i + 1;
          for (; j < lista.length && lista[j].tipo !== 'SEQEND'; j++) if (lista[j].tipo === 'VERTEX') vs.push({ x: numero(lista[j], 10), y: numero(lista[j], 20), b: numero(lista[j], 42) });
          i = j;
          if (malha) { (ignoradas['POLYLINE (malha)'] = (ignoradas['POLYLINE (malha)'] ?? 0) + 1); break; }
          const pts = [];
          vs.forEach((v, k) => { if (k === 0) pts.push(v.x, v.y); else pts.push(...comBulge(vs[k - 1].x, vs[k - 1].y, v.x, v.y, vs[k - 1].b)); });
          if (fechada && vs.length > 2) pts.push(...comBulge(vs.at(-1).x, vs.at(-1).y, vs[0].x, vs[0].y, vs.at(-1).b));
          empurrar(c(), pts, fechada, m);
          break;
        }
        case 'CIRCLE': { const pts = arco(numero(e, 10), numero(e, 20), numero(e, 40), 0, 2 * Math.PI); empurrar(c(), pts, true, m); break; }
        case 'ARC': {
          const r = numero(e, 40), a0 = (numero(e, 50) * Math.PI) / 180, a1 = (numero(e, 51) * Math.PI) / 180;
          empurrar(c(), arco(numero(e, 10), numero(e, 20), r, a0, a1), false, m);
          break;
        }
        case 'ELLIPSE': {
          const cx = numero(e, 10), cy = numero(e, 20), mx = numero(e, 11), my = numero(e, 21), k = numero(e, 40, 1);
          let t0 = numero(e, 41, 0), t1 = numero(e, 42, 2 * Math.PI);
          if (t1 <= t0) t1 += 2 * Math.PI;
          const n = Math.max(8, Math.ceil(((t1 - t0) / (2 * Math.PI)) * 64));
          const pts = [];
          for (let q = 0; q <= n; q++) { const t = t0 + ((t1 - t0) * q) / n; pts.push(cx + mx * Math.cos(t) - k * my * Math.sin(t), cy + my * Math.cos(t) + k * mx * Math.sin(t)); }
          empurrar(c(), pts, false, m);
          break;
        }
        case 'SPLINE': {
          const ajuste = [], controle = [];
          let ultimo = null;
          for (const [cc, v] of e.lista) {
            if (cc === 11) { ultimo = [num(v), 0]; ajuste.push(ultimo); } else if (cc === 21 && ultimo && ajuste.includes(ultimo)) ultimo[1] = num(v);
            if (cc === 10) { ultimo = [num(v), 0]; controle.push(ultimo); } else if (cc === 20 && ultimo && controle.includes(ultimo)) ultimo[1] = num(v);
          }
          const usar = ajuste.length >= 2 ? ajuste : controle;
          empurrar(c(), usar.flat(), false, m);
          break;
        }
        case 'TEXT': case 'MTEXT': case 'ATTRIB': {
          const alinhado = e.tipo === 'TEXT' && (numero(e, 72) || numero(e, 73)) && primeiro(e, 11) != null;
          const [x, y] = aplicar(m, alinhado ? numero(e, 11) : numero(e, 10), alinhado ? numero(e, 21) : numero(e, 20));
          const bruto = e.tipo === 'MTEXT' ? e.lista.filter((p) => p[0] === 3 || p[0] === 1).map((p) => p[1]).join('') : (primeiro(e, 1) ?? '');
          const t = e.tipo === 'MTEXT' ? limparMtext(bruto) : limparMtext(bruto.replace(/\\/g, '\\\\'));
          if (!t) break;
          let rot = (numero(e, 50) * Math.PI) / 180;
          if (e.tipo === 'MTEXT' && primeiro(e, 11) != null && primeiro(e, 50) == null) rot = Math.atan2(numero(e, 21), numero(e, 11));
          textos.push({ c: c(), x, y, h: numero(e, 40, 1) * escalaDe(m), r: rot + rotDe(m), t: t.slice(0, 200) });
          break;
        }
        case 'INSERT': case 'DIMENSION': {
          const nome = (primeiro(e, 2) ?? '').trim();
          const b = blocos.get(nome);
          if (!b || prof > 8) break;
          if (e.tipo === 'DIMENSION') { processar(b.ents, m, nomeCamada, prof + 1); break; }
          const sx = numero(e, 41, 1), sy = numero(e, 42, 1), ang = (numero(e, 50) * Math.PI) / 180;
          const cols = Math.max(1, numero(e, 70, 1)), lins = Math.max(1, numero(e, 71, 1));
          const dc = numero(e, 44), dl = numero(e, 45);
          const cs = Math.cos(ang), sn = Math.sin(ang);
          for (let ci = 0; ci < cols; ci++) for (let li = 0; li < lins; li++) {
            const ox = ci * dc, oy = li * dl; // na direção do bloco girado
            const ix = numero(e, 10) + ox * cs - oy * sn, iy = numero(e, 20) + ox * sn + oy * cs;
            const local = compor([cs * sx, sn * sx, -sn * sy, cs * sy, ix, iy], [1, 0, 0, 1, -b.base[0], -b.base[1]]);
            processar(b.ents, compor(m, local), nomeCamada, prof + 1);
          }
          break;
        }
        case 'SEQEND': case 'VERTEX': case 'ATTDEF': case 'VIEWPORT': break;
        default: ignoradas[e.tipo] = (ignoradas[e.tipo] ?? 0) + 1;
      }
    }
  }
  processar(entidadesDe(ps, ...secoes.ENTITIES), ID, null, 0);

  // limites e arredondamento (o arquivo do projeto guarda a planta)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const e of entidades) for (let i = 0; i < e.p.length; i += 2) { x0 = Math.min(x0, e.p[i]); x1 = Math.max(x1, e.p[i]); y0 = Math.min(y0, e.p[i + 1]); y1 = Math.max(y1, e.p[i + 1]); }
  for (const t of textos) { x0 = Math.min(x0, t.x); x1 = Math.max(x1, t.x); y0 = Math.min(y0, t.y); y1 = Math.max(y1, t.y); }
  if (!Number.isFinite(x0)) throw new Error('Nenhuma linha, polilinha, arco ou texto foi encontrado no espaço do modelo.');
  const ext = Math.max(x1 - x0, y1 - y0, 1e-9);
  const passo = 10 ** (Math.floor(Math.log10(ext)) - 5);
  const r = (v) => Math.round(v / passo) * passo;
  for (const e of entidades) e.p = e.p.map((v) => +r(v).toPrecision(12));
  for (const t of textos) { t.x = +r(t.x).toPrecision(12); t.y = +r(t.y).toPrecision(12); t.h = +t.h.toPrecision(4); t.r = +t.r.toFixed(4); }

  // unidade: a do cabeçalho ou, sem ela, pela extensão do desenho (um edifício tem de 5 a 200 m)
  let unidade = unidadeLida?.[0] ?? null;
  if (!unidade) unidade = ext > 2000 ? 'mm' : ext > 200 ? 'cm' : 'm';
  return {
    unidade, unidadeLida: unidadeLida?.[0] ?? null, fatorMetros: FATOR_UNIDADE[unidade],
    camadas, entidades, textos, limites: { x0, y0, x1, y1 }, ignoradas, cortado, pontos,
  };
}
