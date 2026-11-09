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
 * Exportação IFC: o projeto vira um modelo neutro de peças em coordenadas globais (m, z para cima) — a mesma
 * geometria da visualização 3D do edifício — e as armaduras do detalhamento, que `escreverIfc` grava em IFC4.
 *
 * Pilares → IfcColumn; vigas → IfcBeam (um sólido por vão, com a seção e o nível de cada um); lajes → IfcSlab
 * (nervurada com capa e nervuras); escadas → IfcStair; reservatórios → IfcBuildingElementProxy; telhado → IfcRoof
 * com as peças de madeira (IfcMember), as telhas (IfcCovering) e os oitões (IfcWall); sapatas, sapatas corridas e
 * blocos → IfcFooting; estacas → IfcPile; radier → IfcSlab (BASESLAB). Barras de aço → IfcReinforcingBar agregadas
 * ao elemento (uma por posição N1, N2…, com cada barra como IfcSweptDiskSolid).
 */
import { pavimentosOrdenados, pavimento, tipoDe, dimensoesLaje, espessuraLaje, eixoViga, secaoPilar, escadaNaPlanta } from '../../renderer/core/montagem.js';
import { expandirTipos } from '../../renderer/core/tipos.js';
import { secoesDaViga, espessuraApoiada, rotuloSecao } from '../../engine/viga-secoes.js';
import { geometriaNervurada } from './nervurada-geometria.js';
import { eixoSapataCorrida } from '../concreto-sapata-corrida/calculo.js';
import { tesouraDoTelhado, SECOES_TESOURA_PADRAO } from '../madeira-telhado/calculo.js';
import { modeloTelhado } from '../madeira-comum/telhado3d.js';
import { modeloViga, modeloPilar, modeloLaje } from './armadura3d.js';
import { modeloSapata, modeloBloco } from './armadura3d-fundacoes.js';
import { posicoesDe, detalhamentoDe } from './detalhamento.js';
import { quantitativosDoElemento, acoTotal } from './quantitativos.js';
import { escreverIfc, T, R } from '../../engine/ifc-escrever.js';

const RAD = Math.PI / 180;

/** Referencial local de um elemento: origem (m), giro em planta (graus); P leva (x, y, z) local em m ao global. */
function referencial(o, angulo = 0) {
  const c = Math.cos(angulo * RAD), s = Math.sin(angulo * RAD);
  return {
    P: (x, y, z = 0) => [o[0] + x * c - y * s, o[1] + x * s + y * c, o[2] + z],
    dir: (x, y, z = 0) => [x * c - y * s, x * s + y * c, z],
  };
}
/** Caixa alinhada ao referencial (m): retângulo em planta extrudado para cima. */
const caixa = (F, min, max) => ({
  tipo: 'extrusao', perfil: { ret: [max[0] - min[0], max[1] - min[1]] },
  origem: F.P((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, min[2]), eixo: [0, 0, 1], ref: F.dir(1, 0), prof: max[2] - min[2],
});
const cilindro = (c, z0, L, r) => ({ tipo: 'extrusao', perfil: { circ: r }, origem: [c[0], c[1], z0], eixo: [0, 0, 1], ref: [1, 0, 0], prof: L });

/**
 * Armaduras de um elemento a partir do modelo 3D da armadura (cm, no referencial do elemento), levadas ao global
 * por `paraGlobal(p)`; uma IfcReinforcingBar por posição.
 */
function armadurasDe(el, modelo, posicoes, paraGlobal) {
  if (!modelo?.barras?.length) return [];
  const porId = new Map();
  for (const b of modelo.barras) { if (!porId.has(b.id)) porId.set(b.id, []); porId.get(b.id).push(b); }
  return (posicoes ?? []).filter((q) => porId.has(q.id)).map((q) => ({
    chave: `${el.id}|arm|${q.id}`,
    nome: `${el.codigo} ${q.N}`,
    descricao: `${q.N} — ${q.n} ø${String(q.phi).replace('.', ',')} · C = ${Math.round(q.comprimento)} cm${q.local ? ` · ${q.local}` : ''}`,
    tag: q.N,
    objectType: q.tipo,
    diametro: q.phi / 1000,
    comprimento: (q.comprimento ?? 0) / 100,
    tipo: q.tipo === 'estribo' || q.tipo === 'grampo' ? 'LIGATURE' : 'MAIN',
    solidos: porId.get(q.id).map((b) => ({ tipo: 'tubo', r: q.phi / 2000, pts: b.pts.map(paraGlobal) })),
  }));
}

/**
 * Modelo neutro do projeto para `escreverIfc`.
 * @param {object} projeto0
 * @param {{obter(id):object}} registro  registro dos módulos (categoria e, se houver, resumo)
 * @param {{armaduras?: boolean, telhas?: boolean, versao?: string, autor?: string}} [op]
 */
export function modeloIfcDoProjeto(projeto0, registro, { armaduras = true, telhas = true, versao = '', autor = '', data = null } = {}) {
  const proj = expandirTipos(projeto0);
  const pavs = pavimentosOrdenados(proj);
  const avisos = [];
  const par = proj.parametros ?? {};
  const fck = par.concreto?.fck ?? 25, caa = par.classeAgressividade ?? 'II';
  const matConcreto = `Concreto C${fck}`, matAco = `Aço CA-${Math.round((par.aco?.fyk ?? 500) / 10)}`;
  const matMadeira = (el) => `Madeira ${el?.classe ?? par.madeira?.classe ?? ''}`.trim();
  const achar = (id) => proj.elementos.find((e) => e.id === id);
  const pavBase = pavs[0]?.id ?? null;
  /** pavimento em que o pilar nasce (a cota da base do lance); senão o da posição */
  const pavDaBase = (cota) => pavs.find((p) => Math.abs(p.cota - cota) < 0.05)?.id;

  const comum = (el, classe, tipo, extra = {}) => {
    const mod = registro?.obter?.(el.modulo);
    let resumo = '';
    try { resumo = mod?.resumo?.(el) ?? ''; } catch { resumo = ''; }
    let q = null;
    try { q = el.resultado && !el.resultado.erro ? quantitativosDoElemento(el, el.resultado, proj) : null; } catch { q = null; }
    const concreto = /^concreto\.|^geotecnia\.estaca/.test(el.modulo ?? '');
    const nomePset = { IFCCOLUMN: 'Pset_ColumnCommon', IFCBEAM: 'Pset_BeamCommon', IFCSLAB: 'Pset_SlabCommon', IFCFOOTING: 'Pset_FootingCommon', IFCPILE: 'Pset_PileCommon', IFCSTAIR: 'Pset_StairCommon', IFCROOF: 'Pset_RoofCommon', IFCMEMBER: 'Pset_MemberCommon', IFCBUILDINGELEMENTPROXY: 'Pset_BuildingElementProxyCommon' }[classe];
    const atende = el.resultado && !el.resultado.erro && !el.resultado.desatualizado ? !!el.resultado.ok : null;
    return {
      chave: el.id, classe, tipo, nome: el.codigo ?? el.nome ?? el.id, descricao: [el.nome && el.nome !== el.codigo ? el.nome : null, resumo || null].filter(Boolean).join(' — ') || null,
      tag: el.codigo ?? null, material: concreto ? matConcreto : /^madeira\./.test(el.modulo ?? '') ? matMadeira(el) : null,
      psets: {
        ...(nomePset ? { [nomePset]: { Reference: T('IFCIDENTIFIER', el.codigo ?? el.id), LoadBearing: true } } : {}),
        ...(concreto ? { Pset_ConcreteElementGeneral: { StrengthClass: `C${fck}`, ExposureClass: `CAA ${caa}` } } : {}),
        LEBR_Calculo: {
          Modulo: mod?.nome ?? el.modulo, Norma: mod?.norma ?? null, Resumo: resumo || null,
          Situacao: atende === null ? 'não calculado' : atende ? 'atende' : 'não atende',
          ...(q ? {
            VolumeConcreto: q.concreto ? T('IFCVOLUMEMEASURE', R(q.concreto)) : null,
            AreaForma: q.forma ? T('IFCAREAMEASURE', R(q.forma)) : null,
            MassaAco: acoTotal(q) ? T('IFCMASSMEASURE', R(acoTotal(q))) : null,
          } : {}),
        },
      },
      ...extra,
    };
  };

  const elementos = [];
  const posDe = (el) => { try { return armaduras ? posicoesDe(el, el.resultado, proj) : null; } catch { return null; } };

  for (const el of proj.elementos) {
    const t = tipoDe(el, registro);
    const pos = el.posicao;
    const pav = pos && pavimento(proj, pos.pavimento);
    try {
      if (el.modulo === 'madeira.telhado' && pav) { elementos.push(telhado(el, pav)); continue; }
      if (!pav || !t) continue;
      const cota = pav.cota;
      if (t === 'pilar') {
        const { bx, by, D } = secaoPilar(el);
        const L = Number(el.comprimento) || 2.8;
        const F = referencial([pos.x ?? 0, pos.y ?? 0, cota - L], pos.angulo ?? 0);
        const sol = D ? cilindro(F.P(0, 0, 0), cota - L, L, D / 200) : caixa(F, [-bx / 200, -by / 200, 0], [bx / 200, by / 200, L]);
        const e = comum(el, 'IFCCOLUMN', 'COLUMN', { pavimento: pavDaBase(cota - L) ?? pav.id, origem: F.P(0, 0, 0), solidos: [sol] });
        const ps = posDe(el);
        if (ps && el.modulo === 'concreto.pilar') {
          const det = detalhamentoDe(el, el.resultado, proj);
          const m = modeloPilar(el, det, ps, { pontos: el.resultado?.armadura?.pontos ?? [], cob: el.resultado?.armadura?.cobrimento ?? 3 });
          const lx = D ?? bx, ly = D ?? by;
          e.armaduras = armadurasDe(el, m, ps, (p) => F.P((p[0] - lx / 2) / 100, (p[1] - ly / 2) / 100, p[2] / 100));
        }
        elementos.push(e);
      } else if (t === 'viga') {
        const eixo = eixoViga(el);
        const ss = secoesDaViga(el, { hLaje: espessuraApoiada(el, achar) });
        const F = referencial([eixo.a[0], eixo.a[1], cota], pos.angulo ?? 0);
        const solidos = eixo.vaos.map(([s0, s1], k) => caixa(F, [s0, -ss[k].b / 200, ss[k].base / 100], [Math.max(s1, s0 + 0.01), ss[k].b / 200, ss[k].topo / 100]));
        const e = comum(el, 'IFCBEAM', 'BEAM', { pavimento: pav.id, origem: F.P(0, 0, 0), solidos });
        e.psets.LEBR_Calculo.Secao = rotuloSecao(el);
        const ps = posDe(el);
        if (ps && el.modulo === 'concreto.viga') {
          const det = el.resultado?.detalhamento;
          const m = modeloViga(el, det, ps, { cob: par.cobrimento?.viga ?? 3 });
          const sd = det?.secoes?.length ? det.secoes : ss;
          const bMax = Math.max(...sd.map((x) => x.b)), zRef = Math.min(...sd.map((x) => x.base));
          e.armaduras = armadurasDe(el, m, ps, (p) => F.P(p[0] / 100, (p[1] - bMax / 2) / 100, (p[2] + zRef) / 100));
        }
        elementos.push(e);
      } else if (t === 'laje' && el.modulo === 'concreto.laje.nervurada') {
        const g = geometriaNervurada(el);
        const F = referencial([pos.x ?? 0, pos.y ?? 0, cota - g.h / 100], pos.angulo ?? 0);
        const solidos = g.caixas.filter((c) => c.tipo === 'concreto').map((c) => caixa(F, c.min.map((v) => v / 100), c.max.map((v) => v / 100)));
        elementos.push(comum(el, 'IFCSLAB', 'FLOOR', { pavimento: pav.id, origem: F.P(0, 0, 0), solidos }));
      } else if (t === 'laje') {
        const { lx, ly } = dimensoesLaje(el);
        const e0 = espessuraLaje(el) / 100;
        const F = referencial([pos.x ?? 0, pos.y ?? 0, cota - e0], pos.angulo ?? 0);
        const e = comum(el, 'IFCSLAB', 'FLOOR', { pavimento: pav.id, origem: F.P(0, 0, 0), solidos: [caixa(F, [0, 0, 0], [lx, ly, e0])] });
        const ps = posDe(el);
        if (ps && el.modulo === 'concreto.laje.macica') {
          const det = detalhamentoDe(el, el.resultado, proj);
          const m = modeloLaje(el, det, ps, { cob: par.cobrimento?.laje ?? 2.5 });
          e.armaduras = armadurasDe(el, m, ps, (p) => F.P(p[0] / 100, p[1] / 100, p[2] / 100));
        }
        elementos.push(e);
      } else if (t === 'escada') {
        const e = escada(el, pav);
        if (e) elementos.push(e);
      } else if (t === 'reservatorio') {
        elementos.push(reservatorio(el, pav));
      }
    } catch (err) {
      avisos.push(`${el.codigo ?? el.id}: ficou fora do IFC (${err.message}).`);
    }
  }

  /** Escada: um bloco por degrau e os patamares como lajes, do nível de baixo ao de chegada (como no 3D). */
  function escada(el, pav) {
    const pl = escadaNaPlanta(el, proj);
    if (!pl) return null;
    const g = pl.geometria, e = g.dg.e / 100, p = g.dg.p / 100, hl = (Number(el.h) || 12) / 100;
    const solidos = [];
    const bloco = (r, zTopo, alt) => {
      const c = pl.T([(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2]);
      const F = referencial([c[0], c[1], zTopo - alt], pl.angulo);
      solidos.push(caixa(F, [-(r.x1 - r.x0) / 2, -(r.y1 - r.y0) / 2, 0], [(r.x1 - r.x0) / 2, (r.y1 - r.y0) / 2, alt]));
    };
    let z = pl.cotaBase;
    const patamar = (nivel) => g.geo.patamares.find((x) => x.nivel === nivel);
    const pi = patamar('inferior');
    if (pi) bloco(pi, z, hl);
    g.geo.lances.forEach((l, i) => {
      for (let k = 1; k <= l.espelhos - 1; k++) {
        const r = l.sentido[1] > 0 ? { x0: l.x0, x1: l.x1, y0: l.y0 + (k - 1) * p, y1: l.y0 + k * p }
          : l.sentido[1] < 0 ? { x0: l.x0, x1: l.x1, y0: l.y1 - k * p, y1: l.y1 - (k - 1) * p }
            : { y0: l.y0, y1: l.y1, x0: l.x0 + (k - 1) * p, x1: l.x0 + k * p };
        bloco(r, z + k * e, e + hl);
      }
      z += l.espelhos * e;
      if (i === 0 && g.geo.lances.length > 1) { const pm = patamar('intermediario'); if (pm) bloco(pm, z, hl); }
    });
    const ps = patamar('superior');
    if (ps) bloco(ps, z, hl);
    const base = pavDaBase(pl.cotaBase) ?? pav.id;
    return comum(el, 'IFCSTAIR', 'NOTDEFINED', { pavimento: base, origem: solidos[0]?.origem, solidos });
  }

  /** Reservatório: fundo, quatro paredes e tampa, do fundo na cota do pavimento para cima. */
  function reservatorio(el, pav) {
    const e = (Number(el.e) || 15) / 100, hf = (Number(el.hf) || 15) / 100, ht = el.tampa !== false ? (Number(el.ht) || 10) / 100 : 0;
    const a = Number(el.a) || 2, b = Number(el.b) || 3, H = Number(el.H) || 1.5;
    const Lx = a + e, Ly = b + e, W = Lx + e, D = Ly + e;
    const F = referencial([el.posicao.x ?? 0, el.posicao.y ?? 0, pav.cota], el.posicao.angulo ?? 0);
    const peca = (dx, dz, dy, u, v, z0) => caixa(F, [u - dx / 2, v - dy / 2, z0], [u + dx / 2, v + dy / 2, z0 + dz]);
    const solidos = [
      peca(W, hf, D, Lx / 2, Ly / 2, 0),
      peca(W, H, e, Lx / 2, 0, hf), peca(W, H, e, Lx / 2, Ly, hf),
      peca(e, H, Ly - e, 0, Ly / 2, hf), peca(e, H, Ly - e, Lx, Ly / 2, hf),
      ...(ht ? [peca(W, ht, D, Lx / 2, Ly / 2, hf + H)] : []),
    ];
    return comum(el, 'IFCBUILDINGELEMENTPROXY', 'NOTDEFINED', { objectType: 'Reservatório de concreto', pavimento: pav.id, origem: F.P(0, 0, 0), solidos });
  }

  /** Telhado: IfcRoof com as peças de madeira, as telhas e os oitões agregados. */
  function telhado(el, pav) {
    const tes = tesouraDoTelhado(proj, el);
    const modelo = modeloTelhado(el, { secoes: tes?.secoes ?? SECOES_TESOURA_PADRAO, tipo: tes?.geometria?.tipo ?? el.tipoTesoura ?? 'howe' });
    const { x = 0, y = 0, angulo = 0 } = el.posicao;
    const F = referencial([x, y, pav.cota], angulo);
    const W = (p) => F.P(p[0] / 100, p[1] / 100, p[2] / 100);
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const CLASSE = { tesoura: ['IFCMEMBER', 'MEMBER', 'Tesoura'], terca: ['IFCMEMBER', 'PURLIN', 'Terça'], caibro: ['IFCMEMBER', 'RAFTER', 'Caibro'], ripa: ['IFCMEMBER', 'MEMBER', 'Ripa'], telha: ['IFCCOVERING', 'ROOFING', 'Telha'] };
    const partes = [];
    const contador = {};
    modelo.pecas.forEach((q, i) => {
      if (q.tipo === 'telha' && !telhas) return;
      const a = W(q.p), b = W(q.q), d = sub(b, a), L = Math.hypot(...d);
      if (L < 1e-4) return;
      const [classe, tipo, nome] = CLASSE[q.tipo] ?? ['IFCMEMBER', 'MEMBER', q.tipo];
      contador[nome] = (contador[nome] ?? 0) + 1;
      const cima = F.dir(...(q.cima ?? [0, 0, 1]));
      partes.push({
        chave: `${el.id}|peca|${i}`, classe, tipo, nome: `${el.codigo} ${nome} ${contador[nome]}`, descricao: q.rotulo ?? null, objectType: nome,
        material: q.tipo === 'telha' ? null : `Madeira ${tes?.classe ?? el.classe ?? par.madeira?.classe ?? ''}`.trim(), cor: q.tipo === 'telha' ? 'tile' : 'wood',
        origem: a, solidos: [{ tipo: 'extrusao', perfil: { ret: [q.h / 100, q.b / 100] }, origem: a, eixo: d, ref: cima, prof: L }],
      });
    });
    modelo.empenas.forEach((e, i) => {
      const o = W([0, e.y + e.esp / 2, 0]);
      const ex = F.dir(1, 0, 0);
      partes.push({
        chave: `${el.id}|oitao|${i}`, classe: 'IFCWALL', tipo: 'NOTDEFINED', nome: `${el.codigo} Oitão ${i + 1}`, objectType: 'Oitão de alvenaria', origem: o,
        solidos: [{ tipo: 'extrusao', perfil: { poli: [[0, 0], [e.L / 100, 0], [e.L / 200, e.H / 100]] }, origem: o, eixo: [ex[1], -ex[0], 0], ref: ex, prof: e.esp / 100 }],
      });
    });
    return comum(el, 'IFCROOF', 'GABLE_ROOF', { pavimento: pav.id, origem: F.P(0, 0, 0), solidos: [], partes, material: null });
  }

  // ---------------------------------------------------------------- fundações
  const fund = (pl) => pl ? pavDaBase(pavimento(proj, pl.posicao?.pavimento)?.cota - (Number(pl.comprimento) || 2.8)) ?? pavBase : pavBase;
  for (const sp of proj.elementos.filter((e) => e.modulo === 'concreto.sapata' && e.pilarId)) {
    const pl = achar(sp.pilarId);
    const pav = pl?.posicao && pavimento(proj, pl.posicao.pavimento);
    if (!pav) continue;
    const r = sp.resultado && !sp.resultado.erro ? sp.resultado : null;
    const A = (r?.A ?? sp.geometria?.A ?? 150) / 100, B = (r?.B ?? sp.geometria?.B ?? 150) / 100, hs = (r?.h ?? sp.geometria?.h ?? 50) / 100;
    const h0 = Math.min(hs, (r?.h0 ?? sp.geometria?.h0 ?? r?.h ?? 50) / 100);
    const topo = pav.cota - (Number(pl.comprimento) || 2.8);
    const a0 = Math.min(A, (r?.ap ?? pl.bx ?? 20) / 100 + 0.05), b0 = Math.min(B, (r?.bp ?? pl.by ?? 20) / 100 + 0.05);
    const F = referencial([pl.posicao.x, pl.posicao.y, topo - hs], pl.posicao.angulo ?? 0);
    const solidos = [caixa(F, [-A / 2, -B / 2, 0], [A / 2, B / 2, h0])];
    if (hs - h0 > 0.005) solidos.push({ tipo: 'tronco', base: [A, B], topo: [a0, b0], origem: F.P(0, 0, h0), eixo: [0, 0, 1], ref: F.dir(1, 0), prof: hs - h0 });
    const e = comum(sp, 'IFCFOOTING', 'PAD_FOOTING', { pavimento: fund(pl), origem: F.P(0, 0, 0), solidos });
    const ps = posDe(sp);
    if (ps && r) e.armaduras = armadurasDe(sp, modeloSapata(r, ps), ps, (p) => F.P((p[0] - r.A / 2) / 100, (p[1] - r.B / 2) / 100, p[2] / 100));
    elementos.push(e);
  }
  for (const b of proj.elementos.filter((e) => e.modulo === 'concreto.bloco' && e.pilarId)) {
    const pl = achar(b.pilarId);
    const pav = pl?.posicao && pavimento(proj, pl.posicao.pavimento);
    if (!pav) continue;
    const r = b.resultado && !b.resultado.erro ? b.resultado : null;
    const A = (r?.A ?? b.geometria?.A ?? 160) / 100, B = (r?.B ?? b.geometria?.B ?? 70) / 100, hb = (r?.h ?? b.geometria?.h ?? 60) / 100;
    const topo = pav.cota - (Number(pl.comprimento) || 2.8);
    const F = referencial([pl.posicao.x, pl.posicao.y, topo - hb], pl.posicao.angulo ?? 0);
    const e = comum(b, 'IFCFOOTING', 'PILE_CAP', { pavimento: fund(pl), origem: F.P(0, 0, 0), solidos: [caixa(F, [-A / 2, -B / 2, 0], [A / 2, B / 2, hb])] });
    const L = r?.estaca?.L ?? b.estaca?.L ?? 8, rr = (r?.estaca?.D ?? b.estaca?.D ?? 30) / 200;
    e.partes = (r?.pos ?? []).map((p, i) => {
      const c = F.P(p.x / 100, p.y / 100, 0);
      return { chave: `${b.id}|estaca|${i}`, classe: 'IFCPILE', tipo: 'BORED', nome: `${b.codigo} E${i + 1}`, objectType: 'Estaca', material: matConcreto, origem: [c[0], c[1], topo - hb + 0.1 - L], solidos: [cilindro(c, topo - hb + 0.1 - L, L, rr)] };
    });
    const ps = posDe(b);
    if (ps && r) e.armaduras = armadurasDe(b, modeloBloco(r, ps), ps, (p) => F.P((p[0] - r.A / 2) / 100, (p[1] - r.B / 2) / 100, p[2] / 100));
    elementos.push(e);
  }
  for (const ea of proj.elementos.filter((e) => e.modulo === 'geotecnia.estaca')) {
    const pl = ea.pilarId ? achar(ea.pilarId) : null;
    const c = pl?.posicao ? [pl.posicao.x, pl.posicao.y] : [ea.local?.x ?? 0, ea.local?.y ?? 0];
    const L = Number(ea.L) || 8, rr = (Number(ea.D) || 40) / 200, topo = -(ea.topo ?? 1.5);
    elementos.push(comum(ea, 'IFCPILE', ea.tipo === 'premoldada' ? 'DRIVEN' : 'BORED', { pavimento: fund(pl), origem: [c[0], c[1], topo - L], solidos: [cilindro(c, topo - L, L, rr)] }));
  }
  for (const sc of proj.elementos.filter((e) => e.modulo === 'concreto.sapataCorrida')) {
    const r = sc.resultado && !sc.resultado.erro ? sc.resultado : null;
    const eixo = eixoSapataCorrida(sc, proj);
    if (!(eixo.L > 0)) continue;
    const B = (r?.B ?? sc.geometria?.B ?? 80) / 100, hs = (r?.h ?? sc.geometria?.h ?? 30) / 100, h0 = Math.min(hs, (r?.h0 ?? sc.geometria?.h0 ?? 20) / 100);
    const bw = (r?.bw ?? sc.bw ?? 20) / 100, b0 = Math.min(B, bw + 0.05);
    const base = -(r?.profundidade ?? sc.profundidade ?? 1);
    const ax = [Math.cos(eixo.angulo * RAD), Math.sin(eixo.angulo * RAD), 0];
    const o = [eixo.x, eixo.y, base];
    elementos.push(comum(sc, 'IFCFOOTING', 'STRIP_FOOTING', {
      pavimento: eixo.pavimento ? fund(null) : pavBase, origem: o,
      solidos: [{ tipo: 'extrusao', perfil: { poli: [[-B / 2, 0], [B / 2, 0], [B / 2, h0], [b0 / 2, hs], [-b0 / 2, hs], [-B / 2, h0]] }, origem: o, eixo: ax, ref: [-ax[1], ax[0], 0], prof: eixo.L }],
    }));
  }
  for (const ra of proj.elementos.filter((e) => e.modulo === 'concreto.radier')) {
    const r = ra.resultado && !ra.resultado.erro ? ra.resultado : null;
    if (!r) { avisos.push(`${ra.codigo}: radier sem cálculo ficou fora do IFC.`); continue; }
    const pl = achar(r.pilares?.[0]?.id);
    const pav = pl?.posicao && pavimento(proj, pl.posicao.pavimento);
    const hr = r.h / 100;
    const topo = pav ? pav.cota - (Number(pl.comprimento) || 2.8) : -(r.profundidade ?? 0.5) + hr;
    const F = referencial([r.local.x, r.local.y, topo - hr], 0);
    elementos.push(comum(ra, 'IFCSLAB', 'BASESLAB', { pavimento: fund(pl), origem: F.P(0, 0, 0), solidos: [caixa(F, [0, 0, 0], [r.lx, r.ly, hr])] }));
  }

  // as barras herdam o material de aço do projeto
  for (const e of elementos) for (const a of e.armaduras ?? []) a.material = matAco;

  return {
    id: projeto0.id ?? projeto0.meta?.nome ?? 'lebr',
    nome: projeto0.meta?.nome ?? 'Projeto LEBR', descricao: projeto0.meta?.descricao || null, autor: autor || projeto0.meta?.autor || '', versao,
    data: data ?? new Date().toISOString(),
    pavimentos: pavs.map((p) => ({ id: p.id, nome: p.nome, cota: p.cota })),
    elementos, avisos,
  };
}

/** Atalho: projeto → texto IFC4 e um resumo do que foi exportado. */
export function exportarIfc(projeto, registro, op = {}) {
  const m = modeloIfcDoProjeto(projeto, registro, op);
  const r = escreverIfc({ ...m, arquivo: op.arquivo });
  return { texto: r.texto, contagem: r.contagem, entidades: r.entidades, avisos: m.avisos };
}
