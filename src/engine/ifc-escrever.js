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
 * Escrita de arquivos IFC4 (ISO 10303-21, "STEP físico") a partir de um modelo neutro de peças — sem dependências.
 *
 * Modelo de entrada (`escreverIfc`): pavimentos com cota (m) e elementos com classe IFC, tipo predefinido, sólidos em
 * coordenadas globais (m, z para cima), material, conjuntos de propriedades e armaduras. Sólidos aceitos:
 *  - { tipo: 'extrusao', perfil, origem, eixo, ref, prof }   perfil retangular { ret: [x, y] } (centrado),
 *    circular { circ: r } ou poligonal { poli: [[x, y]…] }, no plano local (ref = X, eixo × ref = Y), extrudado ao
 *    longo de `eixo` por `prof`;
 *  - { tipo: 'tronco', base: [x, y], topo: [x, y], origem, eixo, ref, prof }  retângulo que afina (sapata);
 *  - { tipo: 'tubo', pts: [[x, y, z]…], r }   barra de aço (IfcSweptDiskSolid ao longo de uma polilinha).
 */

const B64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';

/** 128 bits determinísticos de um texto (quatro hashes de 32 bits com sementes diferentes). */
function bytesDe(texto) {
  const out = [];
  for (const semente of [0x811c9dc5, 0x2f6b3a91, 0x9e3779b9, 0x7f4a7c15]) {
    let h = semente >>> 0;
    for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; }
    h ^= h >>> 15;
    out.push((h >>> 24) & 255, (h >>> 16) & 255, (h >>> 8) & 255, h & 255);
  }
  out[6] = (out[6] & 0x0f) | 0x40; out[8] = (out[8] & 0x3f) | 0x80;   // forma de um UUID v4
  return out;
}

/** GlobalId do IFC (22 caracteres na base 64 do IFC) a partir de um texto — o mesmo texto dá sempre o mesmo id. */
export function guidIfc(texto) {
  const bs = bytesDe(String(texto));
  const b64 = (v, l) => { let s = ''; for (let i = 0; i < l; i++) { s = B64[v % 64] + s; v = Math.floor(v / 64); } return s; };
  let g = b64(bs[0], 2);
  for (let i = 1; i < 16; i += 3) g += b64((bs[i] << 16) + (bs[i + 1] << 8) + bs[i + 2], 4);
  return g;
}

/** Texto STEP: apóstrofo e barra dobrados, fora do ASCII em \X2\…\X0\ (UTF-16). */
export function textoStep(s) {
  let out = '';
  let ext = '';
  const fecha = () => { if (ext) { out += `\\X2\\${ext}\\X0\\`; ext = ''; } };
  for (const ch of String(s ?? '')) {
    const c = ch.codePointAt(0);
    if (c >= 0x20 && c <= 0x7e) {
      fecha();
      out += ch === "'" ? "''" : ch === '\\' ? '\\\\' : ch;
    } else if (c < 0x20) { fecha(); out += ' '; } else {
      const u = c > 0xffff ? [0xd800 + ((c - 0x10000) >> 10), 0xdc00 + ((c - 0x10000) & 0x3ff)] : [c];
      for (const x of u) ext += x.toString(16).toUpperCase().padStart(4, '0');
    }
  }
  fecha();
  return `'${out}'`;
}

/** Real STEP: sempre com ponto decimal e até 6 casas (m → µm). */
const real = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0.';
  const r = Math.round(n * 1e6) / 1e6;
  const s = String(r === 0 ? 0 : r);
  return /[.eE]/.test(s) ? s.replace(/e/, 'E') : `${s}.`;
};

/** Valores especiais na escrita. */
export const E = (nome) => ({ enum: nome });                      // .NOME.
export const R = (v) => ({ real: v });                            // real explícito
export const T = (tipo, v) => ({ tipo, v });                      // valor tipado: IFCLABEL('…')
const fmt = (a) => {
  if (a === null || a === undefined) return '$';
  if (a === '*') return '*';
  if (typeof a === 'string') return textoStep(a);
  if (typeof a === 'boolean') return a ? '.T.' : '.F.';
  if (typeof a === 'number') return real(a);
  if (Array.isArray(a)) return `(${a.map(fmt).join(',')})`;
  if (a.ref != null) return `#${a.ref}`;
  if (a.enum) return `.${a.enum}.`;
  if (a.real != null) return real(a.real);
  if (a.int != null) return String(Math.round(a.int));
  if (a.tipo) return `${a.tipo}(${fmt(a.v)})`;
  return '$';
};

/** Montador de entidades: cada `add` devolve uma referência {ref: n}. */
export class Step {
  constructor() { this.linhas = []; this.n = 0; this.cache = new Map(); }
  add(tipo, args) {
    const id = ++this.n;
    this.linhas.push(`#${id}=${tipo}(${args.map(fmt).join(',')});`);
    return { ref: id };
  }
  /** entidade idêntica reaproveitada (pontos e direções repetidos) */
  unico(tipo, args) {
    const chave = `${tipo}(${args.map(fmt).join(',')})`;
    if (!this.cache.has(chave)) this.cache.set(chave, this.add(tipo, args));
    return this.cache.get(chave);
  }
  ponto(p) { return this.unico('IFCCARTESIANPOINT', [p.map((v) => R(v))]); }
  direcao(d) {
    const L = Math.hypot(...d) || 1;
    return this.unico('IFCDIRECTION', [d.map((v) => R(Math.round((v / L) * 1e9) / 1e9))]);
  }
  eixos(origem, eixo = [0, 0, 1], ref = [1, 0, 0]) {
    return this.add('IFCAXIS2PLACEMENT3D', [this.ponto(origem), this.direcao(eixo), this.direcao(ref)]);
  }
  texto(nome = 'modelo.ifc', { autor = '', aplicativo = 'LEBR', versao = '', data = new Date().toISOString() } = {}) {
    return [
      'ISO-10303-21;',
      'HEADER;',
      "FILE_DESCRIPTION(('ViewDefinition [ReferenceView_V1.2]'),'2;1');",
      `FILE_NAME(${textoStep(nome)},${textoStep(data.slice(0, 19))},(${textoStep(autor)}),(${textoStep(aplicativo)}),${textoStep(`${aplicativo} ${versao}`)},${textoStep(`${aplicativo} ${versao}`)},'');`,
      "FILE_SCHEMA(('IFC4'));",
      'ENDSEC;',
      'DATA;',
      ...this.linhas,
      'ENDSEC;',
      'END-ISO-10303-21;',
      '',
    ].join('\n');
  }
}

/** Produto vetorial e normalização (direções locais dos perfis). */
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const L = Math.hypot(...a) || 1; return a.map((v) => v / L); };
/** Uma direção de referência perpendicular ao eixo, para quando a informada é paralela a ele. */
function refValida(eixo, ref) {
  const e = norm(eixo);
  let r = ref ?? [1, 0, 0];
  const d = r[0] * e[0] + r[1] * e[1] + r[2] * e[2];
  r = [r[0] - d * e[0], r[1] - d * e[1], r[2] - d * e[2]];
  if (Math.hypot(...r) < 1e-6) r = Math.abs(e[2]) < 0.9 ? cruz(e, [0, 0, 1]) : cruz(e, [1, 0, 0]);
  return norm(r);
}

/**
 * Escreve o modelo inteiro em IFC4.
 * @param {object} modelo { nome, autor, versao, pavimentos: [{id, nome, cota}], elementos: [...] }
 *   elemento: { chave, classe, tipo, nome, descricao, tag, pavimento, origem: [x,y,z], solidos: [...],
 *               material, psets: { nome: { prop: valor } }, armaduras: [{ chave, nome, phi, n, comprimento, tipo, tubos }],
 *               partes: [elemento…] (decomposição: telhado → peças) }
 * @returns {{ texto: string, contagem: object }}
 */
export function escreverIfc(modelo) {
  const s = new Step();
  const nomeProj = modelo.nome || 'Projeto';
  const guid = (k) => guidIfc(`${modelo.id ?? nomeProj}|${k}`);
  // ---------------------------------------------------------------- cabeçalho do modelo
  const pessoa = s.add('IFCPERSON', [null, modelo.autor || null, null, null, null, null, null, null]);
  const org = s.add('IFCORGANIZATION', [null, 'LEBR — Laboratório de Estruturas Brasil', null, null, null]);
  const po = s.add('IFCPERSONANDORGANIZATION', [pessoa, org, null]);
  const app = s.add('IFCAPPLICATION', [org, modelo.versao || '0', 'LEBR', 'LEBR']);
  const oh = s.add('IFCOWNERHISTORY', [po, app, null, E('ADDED'), null, null, null, { int: Math.floor((modelo.data ? Date.parse(modelo.data) : Date.now()) / 1000) }]);
  const unidades = s.add('IFCUNITASSIGNMENT', [[
    s.add('IFCSIUNIT', ['*', E('LENGTHUNIT'), null, E('METRE')]),
    s.add('IFCSIUNIT', ['*', E('AREAUNIT'), null, E('SQUARE_METRE')]),
    s.add('IFCSIUNIT', ['*', E('VOLUMEUNIT'), null, E('CUBIC_METRE')]),
    s.add('IFCSIUNIT', ['*', E('PLANEANGLEUNIT'), null, E('RADIAN')]),
    s.add('IFCSIUNIT', ['*', E('MASSUNIT'), E('KILO'), E('GRAM')]),
  ]]);
  const origem = s.eixos([0, 0, 0]);
  const ctx = s.add('IFCGEOMETRICREPRESENTATIONCONTEXT', [null, 'Model', { int: 3 }, R(1e-5), origem, s.direcao([0, 1, 0])]);
  const corpo = s.add('IFCGEOMETRICREPRESENTATIONSUBCONTEXT', ['Body', 'Model', '*', '*', '*', '*', ctx, null, E('MODEL_VIEW'), null]);
  const projeto = s.add('IFCPROJECT', [guid('projeto'), oh, nomeProj, modelo.descricao || null, null, null, null, [ctx], unidades]);
  const plSite = s.add('IFCLOCALPLACEMENT', [null, s.eixos([0, 0, 0])]);
  const site = s.add('IFCSITE', [guid('terreno'), oh, 'Terreno', null, null, plSite, null, null, E('ELEMENT'), null, null, null, null, null]);
  const plEd = s.add('IFCLOCALPLACEMENT', [plSite, s.eixos([0, 0, 0])]);
  const edificio = s.add('IFCBUILDING', [guid('edificio'), oh, nomeProj, null, null, plEd, null, null, E('ELEMENT'), null, null, null]);
  s.add('IFCRELAGGREGATES', [guid('agr-projeto'), oh, null, null, projeto, [site]]);
  s.add('IFCRELAGGREGATES', [guid('agr-terreno'), oh, null, null, site, [edificio]]);

  const pavs = [...(modelo.pavimentos ?? [])].sort((a, b) => a.cota - b.cota);
  const andar = new Map();
  for (const p of pavs) {
    const pl = s.add('IFCLOCALPLACEMENT', [plEd, s.eixos([0, 0, p.cota])]);
    andar.set(p.id, { ent: s.add('IFCBUILDINGSTOREY', [guid(`pav|${p.id}`), oh, p.nome, null, null, pl, null, null, E('ELEMENT'), R(p.cota)]), pl, cota: p.cota, filhos: [] });
  }
  if (andar.size) s.add('IFCRELAGGREGATES', [guid('agr-edificio'), oh, null, null, edificio, [...andar.values()].map((a) => a.ent)]);

  // ---------------------------------------------------------------- materiais e cor
  const materiais = new Map();
  const material = (nome) => {
    if (!nome) return null;
    if (!materiais.has(nome)) materiais.set(nome, { ent: s.add('IFCMATERIAL', [nome, null, /aço/i.test(nome) ? 'steel' : /madeira/i.test(nome) ? 'wood' : 'concrete']), els: [] });
    return materiais.get(nome);
  };
  const CORES = { concrete: [0.75, 0.75, 0.73], steel: [0.72, 0.2, 0.15], wood: [0.62, 0.43, 0.25], tile: [0.72, 0.38, 0.24] };
  const estilos = new Map();
  const estilo = (chave) => {
    if (!estilos.has(chave)) {
      const c = CORES[chave] ?? CORES.concrete;
      const cor = s.add('IFCCOLOURRGB', [null, R(c[0]), R(c[1]), R(c[2])]);
      const sombra = s.add('IFCSURFACESTYLESHADING', [cor, R(0)]);
      estilos.set(chave, s.add('IFCSURFACESTYLE', [chave, E('BOTH'), [sombra]]));
    }
    return estilos.get(chave);
  };

  // ---------------------------------------------------------------- geometria
  const perfil = (p) => {
    if (p.ret) return s.add('IFCRECTANGLEPROFILEDEF', [E('AREA'), null, s.add('IFCAXIS2PLACEMENT2D', [s.unico('IFCCARTESIANPOINT', [[R(p.cx ?? 0), R(p.cy ?? 0)]]), null]), R(Math.max(p.ret[0], 1e-4)), R(Math.max(p.ret[1], 1e-4))]);
    if (p.circ) return s.add('IFCCIRCLEPROFILEDEF', [E('AREA'), null, s.add('IFCAXIS2PLACEMENT2D', [s.unico('IFCCARTESIANPOINT', [[R(0), R(0)]]), null]), R(p.circ)]);
    const pts = p.poli.map((q) => s.unico('IFCCARTESIANPOINT', [[R(q[0]), R(q[1])]]));
    return s.add('IFCARBITRARYCLOSEDPROFILEDEF', [E('AREA'), null, s.add('IFCPOLYLINE', [[...pts, pts[0]]])]);
  };
  const solido = (sl, o) => {
    const rel = (p) => [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
    if (sl.tipo === 'tubo') {
      const pts = sl.pts.map((p) => s.ponto(rel(p)));
      return { ent: s.add('IFCSWEPTDISKSOLID', [s.add('IFCPOLYLINE', [pts]), R(sl.r), null, null, null]), rep: 'AdvancedSweptSolid' };
    }
    const eixo = norm(sl.eixo ?? [0, 0, 1]);
    const pos = s.eixos(rel(sl.origem), eixo, refValida(eixo, sl.ref));
    if (sl.tipo === 'tronco') {
      return { ent: s.add('IFCEXTRUDEDAREASOLIDTAPERED', [perfil({ ret: sl.base }), pos, s.direcao([0, 0, 1]), R(sl.prof), perfil({ ret: sl.topo })]), rep: 'SweptSolid' };
    }
    return { ent: s.add('IFCEXTRUDEDAREASOLID', [perfil(sl.perfil), pos, s.direcao([0, 0, 1]), R(sl.prof)]), rep: 'SweptSolid' };
  };
  const forma = (solidos, o, chaveCor) => {
    const itens = solidos.filter((x) => x && (x.tipo === 'tubo' ? x.pts?.length >= 2 : x.prof > 1e-5)).map((x) => solido(x, o));
    if (!itens.length) return null;
    const st = estilo(chaveCor);
    for (const it of itens) s.add('IFCSTYLEDITEM', [it.ent, [st], null]);
    const tipos = [...new Set(itens.map((i) => i.rep))];
    const rep = s.add('IFCSHAPEREPRESENTATION', [corpo, 'Body', tipos.length === 1 ? tipos[0] : 'SolidModel', itens.map((i) => i.ent)]);
    return s.add('IFCPRODUCTDEFINITIONSHAPE', [null, null, [rep]]);
  };

  // ---------------------------------------------------------------- propriedades
  const valorProp = (v) => {
    if (typeof v === 'boolean') return T('IFCBOOLEAN', v);
    if (v && typeof v === 'object' && v.tipo) return v;
    if (typeof v === 'number') return T('IFCREAL', R(v));
    return T('IFCLABEL', String(v));
  };
  const psets = (dono, chave, mapa) => {
    for (const [nome, props] of Object.entries(mapa ?? {})) {
      const lista = Object.entries(props).filter(([, v]) => v !== null && v !== undefined && v !== '');
      if (!lista.length) continue;
      const ps = s.add('IFCPROPERTYSET', [guid(`pset|${chave}|${nome}`), oh, nome, null, lista.map(([k, v]) => s.add('IFCPROPERTYSINGLEVALUE', [k, null, valorProp(v), null]))]);
      s.add('IFCRELDEFINESBYPROPERTIES', [guid(`relpset|${chave}|${nome}`), oh, null, null, [dono], ps]);
    }
  };

  const contagem = {};
  const conta = (classe) => { contagem[classe] = (contagem[classe] ?? 0) + 1; };

  /** Produto: placement relativo ao pai (pavimento, edifício ou o elemento que o agrega), forma, material, psets. */
  const produto = (e, plPai, origemPai) => {
    const o = e.origem ?? e.solidos?.[0]?.origem ?? e.solidos?.[0]?.pts?.[0] ?? [0, 0, 0];
    const pl = s.add('IFCLOCALPLACEMENT', [plPai, s.eixos([o[0] - origemPai[0], o[1] - origemPai[1], o[2] - origemPai[2]])]);
    const rep = e.solidos?.length ? forma(e.solidos, o, e.cor ?? (/madeira/i.test(e.material ?? '') ? 'wood' : 'concrete')) : null;
    const g = guid(`el|${e.chave}`);
    let ent;
    switch (e.classe) {
      case 'IFCREINFORCINGBAR':
        ent = s.add('IFCREINFORCINGBAR', [g, oh, e.nome, e.descricao ?? null, e.objectType ?? null, pl, rep, e.tag ?? null, null, R(e.diametro), R(Math.PI * e.diametro ** 2 / 4), R(e.comprimento ?? 0), E(e.tipo ?? 'MAIN'), E('TEXTURED')]);
        break;
      case 'IFCPILE':
        ent = s.add('IFCPILE', [g, oh, e.nome, e.descricao ?? null, e.objectType ?? null, pl, rep, e.tag ?? null, E(e.tipo ?? 'NOTDEFINED'), null]);
        break;
      case 'IFCBUILDINGELEMENTPROXY': case 'IFCROOF': case 'IFCSTAIR': case 'IFCCOVERING': case 'IFCWALL': case 'IFCMEMBER':
      case 'IFCCOLUMN': case 'IFCBEAM': case 'IFCSLAB': case 'IFCFOOTING':
        ent = s.add(e.classe, [g, oh, e.nome, e.descricao ?? null, e.objectType ?? null, pl, rep, e.tag ?? null, E(e.tipo ?? 'NOTDEFINED')]);
        break;
      default: throw new Error(`Classe IFC não suportada: ${e.classe}`);
    }
    conta(e.classe);
    if (e.material) material(e.material).els.push(ent);
    psets(ent, e.chave, e.psets);
    // decomposição: peças do telhado e armaduras ficam agregadas ao elemento
    const filhos = [
      ...(e.partes ?? []).map((p) => produto(p, pl, o)),
      ...(e.armaduras ?? []).map((a) => produto({ ...a, classe: 'IFCREINFORCINGBAR', material: a.material ?? 'Aço CA-50', cor: 'steel' }, pl, o)),
    ];
    if (filhos.length) s.add('IFCRELAGGREGATES', [guid(`agr|${e.chave}`), oh, null, null, ent, filhos]);
    return ent;
  };

  for (const e of modelo.elementos ?? []) {
    const a = andar.get(e.pavimento) ?? [...andar.values()][0];
    const ent = produto(e, a ? a.pl : plEd, [0, 0, a ? a.cota : 0]);
    (a ?? { filhos: [] }).filhos.push(ent);
  }
  for (const [id, a] of andar) if (a.filhos.length) s.add('IFCRELCONTAINEDINSPATIALSTRUCTURE', [guid(`cont|${id}`), oh, null, null, a.filhos, a.ent]);
  for (const [nome, m] of materiais) if (m.els.length) s.add('IFCRELASSOCIATESMATERIAL', [guid(`mat|${nome}`), oh, null, null, m.els, m.ent]);

  return { texto: s.texto(modelo.arquivo ?? `${nomeProj}.ifc`, { autor: modelo.autor, versao: modelo.versao, data: modelo.data }), contagem, entidades: s.n };
}
