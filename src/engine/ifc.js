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
 * Leitura mínima de IFC (roteiro, etapa L15): arquivo STEP (ISO 10303-21) de IFC 2x3, IFC 4 ou IFC 4.3.
 *
 * Lê os pavimentos (IfcBuildingStorey), os pilares (IfcColumn), as lajes (IfcSlab), as paredes (IfcWall) e as vigas
 * (IfcBeam), cada um com a planta (contorno em xy) e a faixa de cotas (z), em metros, no sistema global do modelo.
 * Geometria aceita: sólido extrudado (perfis retangular, circular, poligonal e os perfis I, L, T, U, C pela caixa),
 * resultado booleano (o primeiro operando), item mapeado (tipos do Revit), B-rep facetado e malhas (IFC 4). Furos,
 * aberturas e cortes não entram — o contorno é o do sólido inteiro.
 */

/* ======================================================================== STEP */

/** Índice das entidades: id → { t: TIPO, i: início dos argumentos, f: fim }. Os argumentos são lidos sob demanda. */
export function lerStep(texto) {
  const ini = texto.indexOf('DATA;');
  if (ini < 0 || !/ISO-10303-21/.test(texto.slice(0, 200))) throw new Error('Não é um arquivo IFC (STEP) válido.');
  const cab = texto.slice(0, ini);
  const ents = new Map();
  const n = texto.length;
  let k = ini + 5;
  while (k < n) {
    const h = texto.indexOf('#', k);
    if (h < 0) break;
    // #123 = TIPO(
    let j = h + 1;
    while (j < n && texto.charCodeAt(j) >= 48 && texto.charCodeAt(j) <= 57) j++;
    const id = Number(texto.slice(h + 1, j));
    while (j < n && /\s/.test(texto[j])) j++;
    if (texto[j] !== '=') { k = j; continue; }
    j++;
    while (j < n && /\s/.test(texto[j])) j++;
    const t0 = j;
    while (j < n && /[A-Za-z0-9_]/.test(texto[j])) j++;
    const tipo = texto.slice(t0, j).toUpperCase();
    while (j < n && texto[j] !== '(') j++;
    const a0 = j;
    // fim: o ';' fora de texto
    let p = j, dentro = false;
    while (p < n) {
      const c = texto[p];
      if (c === "'") { if (dentro && texto[p + 1] === "'") { p += 2; continue; } dentro = !dentro; } else if (c === ';' && !dentro) break;
      p++;
    }
    ents.set(id, { t: tipo, i: a0, f: p });
    k = p + 1;
  }
  const cache = new Map();
  const arg = (id) => {
    if (cache.has(id)) return cache.get(id);
    const e = ents.get(id);
    if (!e) return null;
    const v = lerValor(texto, e.i, e.f).v;
    cache.set(id, v);
    return v;
  };
  const esquema = (/FILE_SCHEMA\s*\(\s*\(\s*'([^']*)'/i.exec(cab) ?? [])[1] ?? '';
  let aplicativo = '';
  const fn = /FILE_NAME\s*\(/i.exec(cab);
  if (fn) { try { const l = lerValor(cab, fn.index + fn[0].length - 1, cab.length).v; aplicativo = (Array.isArray(l) && (l[5] || l[4])) || ''; } catch { /* cabeçalho estranho */ } }
  return { ents, arg, tipo: (id) => ents.get(id)?.t ?? null, esquema, aplicativo };
}

/** Lê um valor STEP a partir de `i`: lista, texto, número, referência {r}, enumeração {e}, tipado {tipo, v}, $ ou *. */
function lerValor(s, i, fim) {
  const pula = () => { while (i < fim && /\s/.test(s[i])) i++; };
  const valor = () => {
    pula();
    const c = s[i];
    if (c === '(') {
      i++;
      const lista = [];
      pula();
      if (s[i] === ')') { i++; return lista; }
      for (;;) {
        lista.push(valor());
        pula();
        if (s[i] === ',') { i++; continue; }
        if (s[i] === ')') { i++; break; }
        if (i >= fim) break;
        i++;
      }
      return lista;
    }
    if (c === "'") {
      let j = i + 1, out = '';
      while (j < fim) {
        if (s[j] === "'") { if (s[j + 1] === "'") { out += "'"; j += 2; continue; } break; }
        out += s[j++];
      }
      i = j + 1;
      return decodificar(out);
    }
    if (c === '#') { let j = i + 1; while (j < fim && /\d/.test(s[j])) j++; const r = Number(s.slice(i + 1, j)); i = j; return { r }; }
    if (c === '$') { i++; return null; }
    if (c === '*') { i++; return null; }
    if (c === '.') { const j = s.indexOf('.', i + 1); const e = s.slice(i + 1, j); i = j + 1; return { e }; }
    if (/[A-Za-z]/.test(c)) {
      let j = i; while (j < fim && /[A-Za-z0-9_]/.test(s[j])) j++;
      const tipo = s.slice(i, j).toUpperCase(); i = j; pula();
      if (s[i] === '(') { i++; const v = valor(); pula(); if (s[i] === ')') i++; return { tipo, v }; }
      return { tipo, v: null };
    }
    let j = i; while (j < fim && /[-+0-9.eE]/.test(s[j])) j++;
    const num = Number(s.slice(i, j)); i = j;
    return num;
  };
  return { v: valor() };
}

/** Texto STEP: \X\hh (Latin-1), \X2\hhhh…\X0\ (UTF-16), \S\c (c + 128). */
function decodificar(t) {
  return String(t)
    .replace(/\\X2\\((?:[0-9A-Fa-f]{4})+)\\X0\\/g, (_, hex) => hex.match(/.{4}/g).map((x) => String.fromCharCode(parseInt(x, 16))).join(''))
    .replace(/\\X\\([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\S\\(.)/g, (_, ch) => String.fromCharCode(ch.charCodeAt(0) + 128));
}

/* ======================================================================== álgebra */

const IDENT = { o: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1], s: 1 };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const escalar = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
/** Aplica a transformação T ao ponto p. */
export const aplicar = (T, p) => [
  T.o[0] + T.s * (T.x[0] * p[0] + T.y[0] * p[1] + T.z[0] * (p[2] ?? 0)),
  T.o[1] + T.s * (T.x[1] * p[0] + T.y[1] * p[1] + T.z[1] * (p[2] ?? 0)),
  T.o[2] + T.s * (T.x[2] * p[0] + T.y[2] * p[1] + T.z[2] * (p[2] ?? 0)),
];
const direcao = (T, v) => [T.x[0] * v[0] + T.y[0] * v[1] + T.z[0] * v[2], T.x[1] * v[0] + T.y[1] * v[1] + T.z[1] * v[2], T.x[2] * v[0] + T.y[2] * v[1] + T.z[2] * v[2]];
/** A ∘ B (primeiro B, depois A). */
const compor = (A, B) => ({ o: aplicar(A, B.o), x: direcao(A, B.x), y: direcao(A, B.y), z: direcao(A, B.z), s: A.s * B.s });

/* ======================================================================== modelo */

const TIPOS = {
  pilar: ['IFCCOLUMN', 'IFCCOLUMNSTANDARDCASE'],
  laje: ['IFCSLAB', 'IFCSLABSTANDARDCASE', 'IFCSLABELEMENTEDCASE'],
  parede: ['IFCWALL', 'IFCWALLSTANDARDCASE', 'IFCWALLELEMENTEDCASE'],
  viga: ['IFCBEAM', 'IFCBEAMSTANDARDCASE'],
};
const CATEGORIA = new Map(Object.entries(TIPOS).flatMap(([k, ts]) => ts.map((t) => [t, k])));

/**
 * Modelo do IFC em metros: { esquema, aplicativo, unidade, fator, pavimentos: [{id, nome, cota}],
 * elementos: [{ id, categoria, nome, tipoIfc, pavimento, z0, z1, contorno: [[x,y]…], circular, ignorado }], avisos }.
 */
export function lerIfc(texto) {
  const m = lerStep(texto);
  const { ents, arg, tipo } = m;
  const ref = (v) => (v && typeof v === 'object' && 'r' in v ? v.r : null);
  const num = (v) => (typeof v === 'number' ? v : v && typeof v === 'object' && 'v' in v ? Number(v.v) : NaN);
  const doTipo = (lista) => { const out = []; for (const [id, e] of ents) if (lista.includes(e.t)) out.push(id); return out; };

  /* ------------------------------------------------ unidade de comprimento */
  let fator = 1, unidade = 'm';
  const projeto = doTipo(['IFCPROJECT'])[0];
  const unidades = projeto ? arg(ref(arg(projeto)[8]))?.[0] ?? [] : [];
  for (const u of unidades) {
    const id = ref(u), a = arg(id);
    if (!a) continue;
    if (tipo(id) === 'IFCSIUNIT' && a[1]?.e === 'LENGTHUNIT') {
      const pref = { MILLI: 0.001, CENTI: 0.01, DECI: 0.1, KILO: 1000 }[a[2]?.e] ?? 1;
      fator = pref; unidade = { 0.001: 'mm', 0.01: 'cm', 0.1: 'dm', 1000: 'km' }[pref] ?? 'm';
    }
    if (tipo(id) === 'IFCCONVERSIONBASEDUNIT' && a[1]?.e === 'LENGTHUNIT') {
      const nome = String(a[2] ?? '').toUpperCase();
      const medida = arg(ref(a[3]));
      const k = medida ? num(medida[0]) : NaN;
      fator = nome.includes('FOOT') ? 0.3048 : nome.includes('INCH') ? 0.0254 : Number.isFinite(k) ? k : 1;
      unidade = nome.toLowerCase() || 'conversão';
    }
  }

  /* ------------------------------------------------ posicionamento */
  const pto = (id) => { const a = arg(id); return a ? [num(a[0][0]) || 0, num(a[0][1]) || 0, num(a[0][2]) || 0] : [0, 0, 0]; };
  const dir = (id, padrao) => { if (id == null) return padrao; const a = arg(id); return a ? [num(a[0][0]) || 0, num(a[0][1]) || 0, num(a[0][2]) || 0] : padrao; };
  const eixos = (o, zv, xv, s = 1) => {
    const z = norm(zv);
    let x = sub(xv, escalar(z, dot(xv, z)));
    if (Math.hypot(...x) < 1e-9) x = Math.abs(z[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    x = norm(x);
    return { o, x, y: cross(z, x), z, s };
  };
  const posicao = (id) => {
    if (id == null) return IDENT;
    const a = arg(id), t = tipo(id);
    if (!a) return IDENT;
    if (t === 'IFCAXIS2PLACEMENT3D') return eixos(pto(ref(a[0])), dir(ref(a[1]), [0, 0, 1]), dir(ref(a[2]), [1, 0, 0]));
    if (t === 'IFCAXIS2PLACEMENT2D') { const xv = dir(ref(a[1]), [1, 0, 0]); return eixos(pto(ref(a[0])), [0, 0, 1], [xv[0], xv[1], 0]); }
    return IDENT;
  };
  const cacheLocal = new Map();
  const local = (id) => {
    if (id == null) return IDENT;
    if (cacheLocal.has(id)) return cacheLocal.get(id);
    cacheLocal.set(id, IDENT); // evita laço
    const a = arg(id);
    let T = IDENT;
    if (a && tipo(id) === 'IFCLOCALPLACEMENT') T = compor(local(ref(a[0])), posicao(ref(a[1])));
    cacheLocal.set(id, T);
    return T;
  };
  const operador = (id) => {
    const a = arg(id);
    if (!a) return IDENT;
    const x = dir(ref(a[0]), [1, 0, 0]), o = pto(ref(a[2])), s = Number.isFinite(num(a[3])) ? num(a[3]) : 1;
    const z = tipo(id).includes('3D') ? dir(ref(a[4]), [0, 0, 1]) : [0, 0, 1];
    return eixos(o, z, x, s);
  };

  /* ------------------------------------------------ geometria */
  const pontos2d = (lista) => (lista ?? []).map((p) => { const c = arg(ref(p)); return [num(c?.[0]?.[0]) || 0, num(c?.[0]?.[1]) || 0, 0]; });
  const circulo = (r, n = 24) => Array.from({ length: n }, (_, k) => [r * Math.cos((2 * Math.PI * k) / n), r * Math.sin((2 * Math.PI * k) / n), 0]);
  const caixa = (X, Y) => [[-X / 2, -Y / 2, 0], [X / 2, -Y / 2, 0], [X / 2, Y / 2, 0], [-X / 2, Y / 2, 0]];
  /** Contorno do perfil (no plano do perfil) e se é circular. */
  const perfil = (id) => {
    const a = arg(id), t = tipo(id);
    if (!a) return null;
    const P = posicao(ref(a[2]));
    const comPos = (pts, circ = false) => ({ pts: pts.map((p) => aplicar(P, p)), circular: circ });
    switch (t) {
      case 'IFCRECTANGLEPROFILEDEF': case 'IFCROUNDEDRECTANGLEPROFILEDEF': case 'IFCRECTANGLEHOLLOWPROFILEDEF':
        return comPos(caixa(num(a[3]), num(a[4])));
      case 'IFCCIRCLEPROFILEDEF': case 'IFCCIRCLEHOLLOWPROFILEDEF':
        return comPos(circulo(num(a[3])), true);
      case 'IFCELLIPSEPROFILEDEF': return comPos(caixa(2 * num(a[3]), 2 * num(a[4])));
      case 'IFCISHAPEPROFILEDEF': case 'IFCASYMMETRICISHAPEPROFILEDEF': return comPos(caixa(num(a[3]), num(a[4])));
      case 'IFCLSHAPEPROFILEDEF': case 'IFCTSHAPEPROFILEDEF': case 'IFCUSHAPEPROFILEDEF': case 'IFCCSHAPEPROFILEDEF': case 'IFCZSHAPEPROFILEDEF':
        return comPos(caixa(num(a[4]) || num(a[3]), num(a[3])));
      case 'IFCARBITRARYCLOSEDPROFILEDEF': case 'IFCARBITRARYPROFILEDEFWITHVOIDS': {
        const pts = curva(ref(a[2]));
        return pts.length ? { pts, circular: false } : null;
      }
      case 'IFCCOMPOSITEPROFILEDEF': {
        const pts = (a[2] ?? []).flatMap((p) => perfil(ref(p))?.pts ?? []);
        return pts.length ? { pts: casco(pts).map(([x, y]) => [x, y, 0]), circular: false } : null;
      }
      case 'IFCDERIVEDPROFILEDEF': {
        const base = perfil(ref(a[2]));
        if (!base) return null;
        const op = operador(ref(a[3]));
        return { pts: base.pts.map((p) => aplicar(op, p)), circular: base.circular };
      }
      default: return null;
    }
  };
  /** Pontos de uma curva fechada 2D (polilinha, polilinha indexada, círculo, curva composta). */
  const curva = (id) => {
    const a = arg(id), t = tipo(id);
    if (!a) return [];
    if (t === 'IFCPOLYLINE') return pontos2d(a[0]);
    if (t === 'IFCINDEXEDPOLYCURVE') {
      const lista = arg(ref(a[0]))?.[0] ?? [];
      return lista.map((c) => [num(c[0]) || 0, num(c[1]) || 0, 0]);
    }
    if (t === 'IFCCIRCLE') { const P = posicao(ref(a[0])); return circulo(num(a[1])).map((p) => aplicar(P, p)); }
    if (t === 'IFCCOMPOSITECURVE') return (a[0] ?? []).flatMap((sg) => { const s = arg(ref(sg)); return s ? curva(ref(s[2])) : []; });
    if (t === 'IFCTRIMMEDCURVE') return curva(ref(a[0]));
    return [];
  };
  /** Todos os IfcCartesianPoint abaixo de uma entidade (B-rep e afins), com limite. */
  const pontosAbaixo = (id, out = [], vistos = new Set(), limite = 20000) => {
    if (id == null || vistos.has(id) || out.length > limite) return out;
    vistos.add(id);
    const t = tipo(id), a = arg(id);
    if (!a) return out;
    if (t === 'IFCCARTESIANPOINT') { out.push([num(a[0][0]) || 0, num(a[0][1]) || 0, num(a[0][2]) || 0]); return out; }
    if (t === 'IFCCARTESIANPOINTLIST3D') { for (const c of a[0] ?? []) out.push([num(c[0]) || 0, num(c[1]) || 0, num(c[2]) || 0]); return out; }
    const percorrer = (v) => { if (Array.isArray(v)) v.forEach(percorrer); else if (v && typeof v === 'object' && 'r' in v) pontosAbaixo(v.r, out, vistos, limite); };
    percorrer(a);
    return out;
  };
  /**
   * Pontos 3D de um item de representação (no sistema do item) e, se for extrusão vertical, o contorno do perfil.
   * @returns [{ pts, planta?: [[x,y,z]…] (contorno no plano), circular }]
   */
  const item = (id, T) => {
    const a = arg(id), t = tipo(id);
    if (!a) return [];
    switch (t) {
      case 'IFCEXTRUDEDAREASOLID': case 'IFCEXTRUDEDAREASOLIDTAPERED': {
        const pf = perfil(ref(a[0]));
        if (!pf) return [];
        const P = compor(T, posicao(ref(a[1])));
        const d = dir(ref(a[2]), [0, 0, 1]), prof = num(a[3]) || 0;
        const topo = pf.pts.map((p) => [p[0] + d[0] * prof, p[1] + d[1] * prof, p[2] + d[2] * prof]);
        const pts = [...pf.pts, ...topo].map((p) => aplicar(P, p));
        const vertical = Math.abs(norm(direcao(P, d))[2]) > 0.99;
        return [{ pts, planta: vertical ? pf.pts.map((p) => aplicar(P, p)) : null, circular: pf.circular }];
      }
      case 'IFCBOOLEANCLIPPINGRESULT': case 'IFCBOOLEANRESULT':
        return item(ref(a[1]), T);
      case 'IFCMAPPEDITEM': {
        const mapa = arg(ref(a[0]));
        if (!mapa) return [];
        const M = compor(compor(T, operador(ref(a[1]))), posicao(ref(mapa[0])));
        const rep = arg(ref(mapa[1]));
        return (rep?.[3] ?? []).flatMap((it) => item(ref(it), M));
      }
      case 'IFCFACETEDBREP': case 'IFCFACETEDBREPWITHVOIDS': case 'IFCMANIFOLDSOLIDBREP': case 'IFCADVANCEDBREP':
      case 'IFCTRIANGULATEDFACESET': case 'IFCPOLYGONALFACESET': case 'IFCSHELLBASEDSURFACEMODEL': case 'IFCFACEBASEDSURFACEMODEL':
      case 'IFCCLOSEDSHELL': case 'IFCOPENSHELL': {
        const pts = pontosAbaixo(id).map((p) => aplicar(T, p));
        return pts.length ? [{ pts }] : [];
      }
      case 'IFCBOUNDINGBOX': {
        const c = pto(ref(a[0])), X = num(a[1]), Y = num(a[2]), Z = num(a[3]);
        const pts = [];
        for (const dx of [0, X]) for (const dy of [0, Y]) for (const dz of [0, Z]) pts.push(aplicar(T, [c[0] + dx, c[1] + dy, c[2] + dz]));
        return [{ pts }];
      }
      default: return [];
    }
  };
  /** Geometria de um produto: representação Body (ou a primeira com sólido) no sistema global. */
  const geometria = (a) => {
    const T = local(ref(a[5]));
    const forma = arg(ref(a[6]));
    if (!forma) return [];
    const reps = (forma[2] ?? []).map((r) => ({ id: ref(r), a: arg(ref(r)) })).filter((r) => r.a);
    const ordem = [...reps.filter((r) => /body/i.test(r.a[1] ?? '')), ...reps.filter((r) => !/body|axis|footprint|box/i.test(r.a[1] ?? '')), ...reps.filter((r) => /box/i.test(r.a[1] ?? ''))];
    for (const r of ordem) {
      const its = (r.a[3] ?? []).flatMap((it) => item(ref(it), T));
      if (its.length) return its;
    }
    return [];
  };

  /* ------------------------------------------------ pavimentos */
  const F = (v) => v * fator;
  const pavimentos = doTipo(['IFCBUILDINGSTOREY']).map((id) => {
    const a = arg(id);
    const T = local(ref(a[5]));
    const elev = num(a[9]);
    const cota = Math.abs(T.o[2]) > 1e-9 || !Number.isFinite(elev) ? T.o[2] : elev;
    return { id, nome: a[2] || a[7] || `Pavimento ${id}`, cota: F(cota) };
  }).sort((x, y) => x.cota - y.cota);

  const contido = new Map();
  for (const id of doTipo(['IFCRELCONTAINEDINSPATIALSTRUCTURE'])) {
    const a = arg(id);
    for (const e of a[4] ?? []) contido.set(ref(e), ref(a[5]));
  }

  /* ------------------------------------------------ elementos */
  const elementos = [];
  const avisos = [];
  for (const [id, e] of ents) {
    const categoria = CATEGORIA.get(e.t);
    if (!categoria) continue;
    const a = arg(id);
    const its = geometria(a);
    const nome = a[2] || a[7] || '';
    if (!its.length) { elementos.push({ id, categoria, nome, tipoIfc: e.t, ignorado: 'sem geometria legível' }); continue; }
    const pts = its.flatMap((g) => g.pts);
    const zs = pts.map((p) => p[2]);
    const plantas = its.filter((g) => g.planta);
    // contorno: o perfil da extrusão vertical quando há um só; senão, o casco convexo da projeção
    const contorno = plantas.length === 1 && its.length === 1 ? limparContorno(plantas[0].planta.map((p) => [F(p[0]), F(p[1])])) : casco(pts.map((p) => [F(p[0]), F(p[1])]));
    const tipoPre = a[8]?.e ?? a[9]?.e ?? null;
    elementos.push({
      id, categoria, nome, tipoIfc: e.t, predefinido: tipoPre,
      pavimento: contido.get(id) ?? null,
      z0: F(Math.min(...zs)), z1: F(Math.max(...zs)),
      contorno, circular: its.length === 1 && !!its[0].circular,
    });
  }
  const sem = elementos.filter((x) => x.ignorado).length;
  if (sem) avisos.push(`${sem} elemento(s) sem geometria legível (só sólidos extrudados, B-rep e malhas entram).`);
  return { esquema: m.esquema, aplicativo: m.aplicativo, unidade, fator, pavimentos, elementos, avisos };
}

/* ======================================================================== planta */

/** Tira pontos repetidos e o fechamento repetido do contorno. */
function limparContorno(pts) {
  const out = [];
  for (const p of pts) if (!out.length || Math.hypot(p[0] - out.at(-1)[0], p[1] - out.at(-1)[1]) > 1e-6) out.push(p);
  if (out.length > 1 && Math.hypot(out[0][0] - out.at(-1)[0], out[0][1] - out.at(-1)[1]) < 1e-6) out.pop();
  return out;
}

/** Casco convexo (cadeia monótona), no sentido anti-horário. */
export function casco(pts) {
  const p = [...new Map(pts.map((q) => [`${q[0].toFixed(5)},${q[1].toFixed(5)}`, [q[0], q[1]]])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const baixo = [], cima = [];
  for (const q of p) { while (baixo.length >= 2 && cr(baixo.at(-2), baixo.at(-1), q) <= 0) baixo.pop(); baixo.push(q); }
  for (const q of [...p].reverse()) { while (cima.length >= 2 && cr(cima.at(-2), cima.at(-1), q) <= 0) cima.pop(); cima.push(q); }
  return [...baixo.slice(0, -1), ...cima.slice(0, -1)];
}

export const areaPoligono = (pts) => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;

/**
 * Retângulo de menor área que contém os pontos (lados do casco): centro, lados a (na direção do ângulo) e b, ângulo (°).
 */
export function menorRetangulo(pts) {
  const h = casco(pts);
  if (h.length < 3) return null;
  let melhor = null;
  for (let i = 0; i < h.length; i++) {
    const p = h[i], q = h[(i + 1) % h.length];
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (L < 1e-9) continue;
    const u = [(q[0] - p[0]) / L, (q[1] - p[1]) / L], v = [-u[1], u[0]];
    let s0 = Infinity, s1 = -Infinity, t0 = Infinity, t1 = -Infinity;
    for (const r of h) { const s = r[0] * u[0] + r[1] * u[1], t = r[0] * v[0] + r[1] * v[1]; s0 = Math.min(s0, s); s1 = Math.max(s1, s); t0 = Math.min(t0, t); t1 = Math.max(t1, t); }
    const area = (s1 - s0) * (t1 - t0);
    if (!melhor || area < melhor.area - 1e-12) {
      const sc = (s0 + s1) / 2, tc = (t0 + t1) / 2;
      melhor = { area, a: s1 - s0, b: t1 - t0, angulo: (Math.atan2(u[1], u[0]) * 180) / Math.PI, centro: [u[0] * sc + v[0] * tc, u[1] * sc + v[1] * tc] };
    }
  }
  return melhor;
}
