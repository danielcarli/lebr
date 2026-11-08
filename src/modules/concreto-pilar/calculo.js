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
 * Pilar de concreto armado, retangular ou circular (0.33) — cálculo (NBR 6118:2023)
 *
 * Seção: `forma` 'retangular' (bx × by) ou 'circular' (diâmetro D; bx = by = D ficam iguais ao diâmetro, para a
 * montagem, o pórtico e as fundações enxergarem o quadrado circunscrito).
 *
 * Flexo-compressão normal em cada direção com momento mínimo (11.3.3.4.3),
 * efeitos de 2ª ordem pelo pilar-padrão com curvatura aproximada (15.8.3.3.2)
 * e verificação da seção por compatibilidade de deformações.
 * Pilares com λ > 90 estão fora do escopo deste protótipo.
 */
import { extremo, doTipo } from '../../engine/combinacoes.js';
import { dimensionarPilar, dimensionarPilarCircular } from '../../engine/flexocompressao.js';
import { FCK_MIN } from '../../engine/materiais.js';
import { bitolaFixa, fmtPhi } from '../../engine/barras.js';
import { porticoDoPilar, porticoNosPilares, esforcosNaCombinacao } from '../comum/portico-edificio.js';

const f = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');

/** Pilar circular? */
export const ehCircular = (el) => el?.forma === 'circular';
/** Diâmetro (cm) do pilar circular. */
export const diametroDe = (el) => Number(el?.D) || Number(el?.bx) || 30;
/** Área da seção (cm²). */
export const areaPilar = (el) => (ehCircular(el) ? (Math.PI * diametroDe(el) ** 2) / 4 : el.bx * el.by);

/** Carga normal característica (kN) separada em g e q, com a origem de cada parcela. */
export function normalCaracteristica(el, ctx) {
  let g = 0, q = 0;
  const origem = [];
  if (el.pesoProprio) {
    const pp = (ctx.materiais.gama * areaPilar(el) * el.comprimento) / 1e4;
    g += pp;
    origem.push({ texto: 'Peso próprio', g: pp, q: 0 });
  }
  for (const c of el.cargas ?? []) {
    if (c.tipo === 'concentrada') {
      if (c.natureza === 'q') q += c.valor; else g += c.valor;
      origem.push({ texto: c.descricao || 'Carga concentrada', g: c.natureza === 'q' ? 0 : c.valor, q: c.natureza === 'q' ? c.valor : 0 });
    } else if (c.tipo === 'elemento') {
      const r = ctx.cargasDe(c.elementoId, c.ligacao);
      g += r.g; q += r.q;
      origem.push({ texto: `Reação de ${ctx.elemento(c.elementoId)?.codigo ?? '?'} (${c.ligacao})`, g: r.g, q: r.q });
    }
  }
  return { g, q, origem };
}

export function cargasTransmitidas(el, ctx) {
  const { g, q } = normalCaracteristica(el, ctx);
  return { base: { g, q } };
}

export const ligacoes = () => [{ id: 'base', nome: 'Base do pilar', tipo: 'pontual' }];

export function calcularPilar(el, ctx) {
  const { concreto: c, aco: s, gg, gq, dmax, caa } = ctx.materiais;
  const circular = ehCircular(el);
  const D = circular ? diametroDe(el) : null;
  const bx = circular ? D : el.bx, by = circular ? D : el.by;
  const cob = ctx.parametros.cobrimento.pilar;
  const bmin = Math.min(bx, by);
  const Asec = circular ? (Math.PI * D * D) / 4 : bx * by;
  const dimensionar = (op) => (circular ? dimensionarPilarCircular({ D, ...op }) : dimensionarPilar({ bx, by, ...op }));
  const verificacoes = [], avisos = [], memorial = [];

  // pórtico espacial do edifício (14.6): lance a lance; usado no dimensionamento quando o projeto pede
  const pt = porticoDoPilar(el, ctx);
  const usarPortico = porticoNosPilares(ctx.projeto) && pt && !pt.erro;
  // cargas dos elementos (reações das vigas e do pilar de cima): com o pórtico em uso, só o carregamento lançado no
  // próprio pilar — a soma pela prumada inteira repetiria, para cada pilar, o cálculo de todos os de cima
  const elem = usarPortico ? null : normalCaracteristica(el, ctx);
  if (porticoNosPilares(ctx.projeto) && pt?.erro) avisos.push(`Pórtico espacial indisponível (${pt.erro}): pilar calculado pelas cargas dos elementos.`);
  const lance = usarPortico ? pt.lance : null;
  const g = lance ? lance.porCaso.G.base.N : elem.g;
  const q = lance ? lance.porCaso.Q.base.N : elem.q;
  const origem = lance
    ? [{ texto: `Pórtico espacial — normal na base do lance (${lance.pavimento})`, g, q }]
    : elem.origem;
  if (!(g + q > 0)) throw new Error('O pilar não tem carga normal — adicione cargas ou reações de vigas.');

  // γn para pilares com menor dimensão < 19 cm (Tabela 13.1)
  const gn = bmin < 19 ? 1.95 - 0.05 * bmin : 1;
  // Nd: maior normal entre as combinações últimas (NBR 6118, 11.8.2), multiplicada por γn
  const combinacoes = ctx.materiais.combinacoes;
  const nMax = extremo(doTipo(combinacoes, 'ELU'), { G: g, Q: q });
  const Nd = gn * nMax.valor;
  const fM = gn * gg; // momentos informados tratados como permanentes
  const lex = (el.le?.x ?? el.comprimento) * 100;
  const ley = (el.le?.y ?? el.comprimento) * 100;
  let Mx = { A: fM * (el.momentos?.x?.A ?? 0), B: fM * (el.momentos?.x?.B ?? 0) };
  let My = { A: fM * (el.momentos?.y?.A ?? 0), B: fM * (el.momentos?.y?.B ?? 0) };
  let NdUsado = Nd;
  // bitolas escolhidas pelo usuário (null = automática)
  const phiL = bitolaFixa(el.armadura?.longitudinal), phiT = bitolaFixa(el.armadura?.estribo);
  let r, combPortico = null, candidatos = [];
  if (lance) {
    // momentos de 1ª ordem do pórtico nas pontas (MA = o maior em módulo; sinais na mesma convenção)
    const pontas = (m) => (Math.abs(m.topo) >= Math.abs(m.base) ? { A: gn * m.topo, B: gn * m.base } : { A: gn * m.base, B: gn * m.topo });
    if (['x', 'y'].some((d) => el.momentos?.[d]?.A || el.momentos?.[d]?.B)) avisos.push('Com o pórtico espacial, os momentos informados no pilar são substituídos pelos do pórtico.');
    for (const a of pt.estabilidade?.avisos ?? []) avisos.push(a); // γz acima de 1,3 ou estrutura instável
    // combinações candidatas: maior normal, maior e menor tensão normal elástica na seção (vento!)
    const todas = doTipo(pt.combinacoes, 'ELU').map((cb) => esforcosNaCombinacao(lance, cb));
    const Ac = Asec / 1e4, Wx = circular ? (Math.PI * (D / 100) ** 3) / 32 : ((by / 100) * (bx / 100) ** 2) / 6, Wy = circular ? Wx : ((bx / 100) * (by / 100) ** 2) / 6;
    const sig = (e, s) => e.Nd / Ac + s * (Math.max(Math.abs(e.Mx.topo), Math.abs(e.Mx.base)) / Wx + Math.max(Math.abs(e.My.topo), Math.abs(e.My.base)) / Wy);
    const pick = (fn, menor = false) => todas.reduce((a, e) => ((menor ? fn(e) < fn(a) : fn(e) > fn(a)) ? e : a), todas[0]);
    candidatos = [...new Map([pick((e) => e.Nd), pick((e) => sig(e, 1)), pick((e) => sig(e, -1), true)].map((e) => [e.comb, e])).values()];
    const tracionadas = candidatos.filter((e) => !(e.Nd > 0));
    for (const e of tracionadas) avisos.push(`Combinação ${e.comb}: normal de tração ou nula no pilar (${f(e.Nd)} kN) — não verificada; confira a ancoragem e a fundação.`);
    let pior = null;
    for (const e of candidatos.filter((x) => x.Nd > 0)) {
      const tent = dimensionar({ lex, ley, Nd: gn * e.Nd, Mx: pontas(e.Mx), My: pontas(e.My), cob, dmax, c, s, phiL, phiT });
      const peso = tent.escolha ? tent.escolha.As + 1e-3 * (tent.escolha.obliqua?.usoMax ?? 0) : Infinity; // empate de As: o maior uso
      e.As = tent.escolha?.As ?? null;
      if (!pior || peso > pior.peso + 1e-9) pior = { peso, tent, e };
    }
    r = pior.tent; combPortico = pior.e;
    Mx = pontas(combPortico.Mx); My = pontas(combPortico.My);
    NdUsado = gn * combPortico.Nd;
  } else {
    r = dimensionar({ lex, ley, Nd: NdUsado, Mx, My, cob, dmax, c, s, phiL, phiT });
  }

  verificacoes.push({ nome: circular ? 'Diâmetro da seção' : 'Menor dimensão da seção', item: '13.2.3', valor: `${f(bmin, 0)} cm`, limite: '≥ 14 cm (19 cm sem γn)', ok: bmin >= 14 });
  verificacoes.push({ nome: 'Área da seção', item: '13.2.3', valor: `${f(Asec, 0)} cm²`, limite: '≥ 360 cm²', ok: Asec >= 360 });
  if (circular && r.escolha) verificacoes.push({ nome: 'Número de barras (seção circular)', item: '18.4.2.1', valor: `${r.escolha.n} barras`, limite: '≥ 6', ok: r.escolha.n >= 6 });
  if (r.escolha) {
    const livre = Math.min(r.escolha.ccx, r.escolha.ccy) - r.escolha.phi / 10;
    const livreMin = Math.max(2, r.escolha.phi / 10, (1.2 * dmax) / 10);
    verificacoes.push({ nome: 'Espaçamento entre as barras', item: '18.4.2.2', valor: `${f(Math.max(r.escolha.ccx, r.escolha.ccy), 1)} cm entre eixos · ${f(livre, 1)} cm livres`, limite: `livre ≥ ${f(livreMin, 1)} cm · eixos ≤ ${f(Math.min(2 * bmin, 40), 0)} cm`, ok: livre >= livreMin - 1e-9 && Math.max(r.escolha.ccx, r.escolha.ccy) <= Math.min(2 * bmin, 40) + 1e-9 });
  }
  verificacoes.push({ nome: `Concreto mínimo (CAA ${caa})`, item: '7.4.2', valor: `C${c.fck}`, limite: `≥ C${FCK_MIN[caa]}`, ok: c.fck >= FCK_MIN[caa] });
  verificacoes.push({ nome: 'Esbeltez — direção x', item: '15.8.3.3', valor: `λx = ${f(r.dirX.lambda, 1)}`, limite: '≤ 90', ok: r.dirX.lambda <= 90 });
  verificacoes.push({ nome: 'Esbeltez — direção y', item: '15.8.3.3', valor: `λy = ${f(r.dirY.lambda, 1)}`, limite: '≤ 90', ok: r.dirY.lambda <= 90 });
  if (r.escolha) {
    verificacoes.push({ nome: 'Flexo-compressão — direção x', item: '17.2', valor: `Md = ${f(r.dirX.Md)} kN·m`, limite: `MRd = ${f(r.escolha.MRdx)} kN·m`, ok: r.escolha.MRdx >= r.dirX.Md });
    verificacoes.push({ nome: 'Flexo-compressão — direção y', item: '17.2', valor: `Md = ${f(r.dirY.Md)} kN·m`, limite: `MRd = ${f(r.escolha.MRdy)} kN·m`, ok: r.escolha.MRdy >= r.dirY.Md });
    const ob = r.escolha.obliqua;
    const porTipo = (tipo) => ob.pontos.filter((p) => p.tipo === tipo);
    const pior = (lista) => lista.reduce((a, p) => (p.uso > (a?.uso ?? -1) ? p : a), null);
    for (const [tipo, nome] of [['extremidade', 'topo e base'], ['intermediaria', 'seção intermediária'], ['minima', 'envoltória mínima']]) {
      const p = pior(porTipo(tipo));
      if (!p) continue;
      verificacoes.push({
        nome: `Flexão oblíqua — ${nome}`, item: tipo === 'minima' ? '11.3.3.4.3' : '17.2',
        valor: `(${f(Math.abs(p.Mx))}; ${f(Math.abs(p.My))}) kN·m`, limite: `MRd na direção = ${f(p.MRd)} kN·m · uso ${f(p.uso * 100, 0)} %`, ok: p.uso <= 1 + 1e-6,
      });
    }
    verificacoes.push({ nome: 'Armadura longitudinal', item: '17.3.5.3', valor: `${f(r.escolha.As)} cm²`, limite: `${f(r.AsMin)} a ${f(r.AsMax)} cm²`, ok: true });
    verificacoes.push({ nome: 'Diâmetro do estribo', item: '18.4.3', valor: `øt = ${f(r.escolha.phiT, 1)} mm`, limite: `≥ 5 mm e ≥ ø/4 = ${f(r.escolha.phi / 4, 1)} mm`, ok: r.escolha.estribo.ok });
  } else {
    verificacoes.push({ nome: 'Armadura longitudinal', item: '17.3.5.3', valor: 'sem solução', limite: `≤ ${f(r.AsMax)} cm²`, ok: false });
  }
  avisos.push(...r.avisos);
  if (gn > 1) avisos.push(`Menor dimensão ${f(bmin, 0)} cm < 19 cm: esforços majorados por γn = ${f(gn)}.`);

  memorial.push({ titulo: 'Cargas', linhas: [
    ...origem.map((o) => `${o.texto}: g = ${f(o.g)} kN · q = ${f(o.q)} kN`),
    combPortico
      ? `Nk = ${f(g + q)} kN (g = ${f(g)} · q = ${f(q)}) · γn = ${f(gn)} · combinação que governa: ${combPortico.comb} (${pt.combinacoes.find((x) => x.id === combPortico.comb)?.expressao}) → Nd = ${f(NdUsado)} kN · ν = ${f(r.dirX.nu, 3)}`
      : `Nk = ${f(g + q)} kN (g = ${f(g)} · q = ${f(q)}) · γn = ${f(gn)} · Nd = γn·(${combinacoes.find((x) => x.id === nMax.id)?.expressao}) = ${f(NdUsado)} kN (${nMax.id}) · ν = ${f(r.dirX.nu, 3)}`,
    ...(combPortico ? [`Combinações verificadas (maior normal e maiores tensões na seção): ${candidatos.map((e) => `${e.comb}: Nd = ${f(e.Nd)} kN, Mx = ${f(e.Mx.topo)}/${f(e.Mx.base)}, My = ${f(e.My.topo)}/${f(e.My.base)} kN·m${e.As != null ? ` → As = ${f(e.As)} cm²` : ''}`).join(' · ')}`] : []),
  ] });
  if (pt && !pt.erro) memorial.push({ titulo: `Pórtico espacial do edifício (14.6) — ${usarPortico ? 'usado no dimensionamento' : 'só para comparação'}`, linhas: [
    'Vigas e pilares de todos os pavimentos num modelo de barras com 6 graus de liberdade por nó; lajes como diafragma rígido em cada pavimento; pilares engastados na fundação; torção das vigas a 15 %.',
    ...pt.prumada.map((l) => `${l.codigo} (${l.pavimento}): Nk = ${f(l.porCaso.G.base.N)} + ${f(l.porCaso.Q.base.N)} kN · Nd = ${f(l.calculo.Nd)} kN (${l.calculo.comb}) · Mxd topo/base = ${f(l.calculo.Mx.topo)} / ${f(l.calculo.Mx.base)} kN·m · Myd topo/base = ${f(l.calculo.My.topo)} / ${f(l.calculo.My.base)} kN·m`),
    elem ? `Cargas dos elementos: Nd = ${f(gn * extremo(doTipo(combinacoes, 'ELU'), { G: elem.g, Q: elem.q }).valor)} kN · pórtico: Nd = ${f(gn * pt.lance.calculo.Nd)} kN` : `Pórtico: Nd = ${f(gn * pt.lance.calculo.Nd)} kN na combinação de maior normal (${pt.lance.calculo.comb}).`,
    `Cargas verticais do edifício: G = ${f(pt.totais.somaPavG)} kN · Q = ${f(pt.totais.somaPavQ)} kN · reações na fundação: G = ${f(pt.totais.reacoesG)} kN · Q = ${f(pt.totais.reacoesQ)} kN`,
    ...(pt.horizontais ? [`Ações horizontais (V1 a V4): em X ${({ vento: 'vento', desaprumo: 'desaprumo', combinado: 'vento + desaprumo' })[pt.horizontais.acao.x]}, em Y ${({ vento: 'vento', desaprumo: 'desaprumo', combinado: 'vento + desaprumo' })[pt.horizontais.acao.y]}${pt.estabilidade?.desaprumo ? ` · θa = 1/${f(1 / pt.estabilidade.desaprumo.thetaA, 0)} (11.3.3.4.1)` : ''}`] : []),
    ...(pt.estabilidade ? ['x', 'y'].filter((d) => !pt.estabilidade[d].erro).map((d) => { const e = pt.estabilidade[d]; return `Estabilidade em ${d.toUpperCase()} (15.5): α = ${f(e.alfa, 3)} (α1 = ${f(e.alfa1)}) · γz = ${f(e.gz, 3)} (${e.comb}) · ${e.fator > 1 ? `esforços horizontais × 0,95·γz = ${f(e.fator, 3)}` : 'sem majoração'}`; }) : []),
  ] });
  for (const [rot, dir, le, hdir] of [['x', r.dirX, lex, bx], ['y', r.dirY, ley, by]]) {
    memorial.push({ titulo: `Direção ${rot}`, linhas: [
      circular
        ? `D = ${f(D, 0)} cm · i = D/4 = ${f(D / 4, 2)} cm · le = ${f(le / 100)} m · λ = le/i = 4·le/D = ${f(dir.lambda, 1)} · λ1 = ${f(dir.lambda1, 1)} · αb = ${f(dir.alfaB)}`
        : `h = ${f(hdir, 0)} cm · le = ${f(le / 100)} m · λ = 3,46·le/h = ${f(dir.lambda, 1)} · λ1 = ${f(dir.lambda1, 1)} · αb = ${f(dir.alfaB)}`,
      `M1d,mín = Nd·(0,015 + 0,03h) = ${f(dir.M1min)} kN·m · M1d = ${f(dir.M1)} kN·m`,
      dir.segundaOrdem
        ? `${dir.metodo}: 1/r = ${f(dir.curvatura, 5)} m⁻¹ · M2d = ${f(dir.M2)} kN·m · Md,tot = ${f(dir.Md)} kN·m`
        : `${dir.metodo} · Md = ${f(dir.Md)} kN·m`,
    ] });
  }
  memorial.push({ titulo: 'Flexão oblíqua (17.2 e 11.3.3.4.3)', linhas: [
    'Curva de interação Mx–My para Nd com a linha neutra em todas as direções (passo de 5°), compatibilidade de deformações e diagrama retangular; com a linha neutra inclinada a tensão do bloco é 0,9·σcd (largura decrescente, 17.2.2).',
    `Envoltória mínima com 2ª ordem: (Mx/${f(r.minimos.x)})² + (My/${f(r.minimos.y)})² = 1 kN·m`,
    ...(r.escolha?.obliqua.pontos.filter((p) => p.tipo !== 'minima').map((p) => `${p.nome}: (Mx; My) = (${f(p.Mx)}; ${f(p.My)}) kN·m → MRd na direção = ${f(p.MRd)} kN·m · uso ${f(p.uso * 100, 0)} %`) ?? []),
    r.escolha ? `Envoltória mínima: maior uso ${f(Math.max(...r.escolha.obliqua.pontos.filter((p) => p.tipo === 'minima').map((p) => p.uso)) * 100, 0)} %` : 'Sem arranjo que atenda.',
  ] });
  if (r.escolha) memorial.push({ titulo: 'Armadura', linhas: [
    `As,mín = ${f(r.AsMin)} cm² · As,máx = ${f(r.AsMax)} cm² (4% Ac)`,
    `Bitolas: longitudinal ${phiL ? `ø ${fmtPhi(phiL)}` : 'automática'} · estribo ${phiT ? `ø ${fmtPhi(phiT)}` : 'automático'}`,
    `Adotado ${r.escolha.rotulo} = ${f(r.escolha.As)} cm² (ρ = ${f((r.escolha.As / Asec) * 100)} %) · estribos ${r.escolha.estribo.rotulo} cm${circular ? ' (circulares)' : ''}`,
    ...(circular ? [`Seção circular: ${r.escolha.n} barras igualmente espaçadas num círculo de raio ${f(r.escolha.raio, 1)} cm (centro das barras) · ${f(r.escolha.ccx, 1)} cm entre eixos (corda) · curva de interação da seção circular com a tensão do bloco 0,9·σcd em qualquer direção (17.2.2)`] : []),
    `MRd,x = ${f(r.escolha.MRdx)} kN·m · MRd,y = ${f(r.escolha.MRdy)} kN·m (compatibilidade de deformações)`,
  ] });

  const r2 = (v) => Math.round(v * 100) / 100 || 0; // || 0 evita "-0"
  const r3 = (v) => Math.round(v * 1000) / 1000 || 0;
  const dir = (d) => ({ lambda: r2(d.lambda), lambda1: r2(d.lambda1), M1min: r2(d.M1min), M2: r2(d.M2), Md: r2(d.Md), segundaOrdem: d.segundaOrdem, metodo: d.metodo });
  return {
    ok: verificacoes.every((v) => v.ok),
    avisos, verificacoes, memorial,
    Nk: { g: r2(g), q: r2(q) }, Nd: r2(NdUsado), gn: r2(gn),
    portico: pt && (pt.erro ? { erro: pt.erro, usado: false } : {
      usado: !!usarPortico,
      NdElementos: elem ? r2(gn * extremo(doTipo(combinacoes, 'ELU'), { G: elem.g, Q: elem.q }).valor) : null,
      NdPortico: r2(gn * pt.lance.calculo.Nd),
      prumada: pt.prumada.map((l) => ({ codigo: l.codigo, pavimento: l.pavimento, atual: l.atual, fundacao: l.fundacao, L: l.L, Ng: r2(l.porCaso.G.base.N), Nq: r2(l.porCaso.Q.base.N), comb: l.calculo.comb, Nd: r2(l.calculo.Nd),
        Mx: { topo: r2(l.calculo.Mx.topo), base: r2(l.calculo.Mx.base) }, My: { topo: r2(l.calculo.My.topo), base: r2(l.calculo.My.base) } })),
      totais: pt.totais, pavimentos: pt.pavimentos,
      // ações horizontais (vento e/ou desaprumo): valores característicos do lance do pilar em cada caso V1 a V4
      ...(() => {
        const lance = Object.fromEntries(Object.entries(pt.lance.porCaso).filter(([c]) => /^V\d$/.test(c)).map(([c, v]) => [c, {
          Vx: r3(v.base.Vx), Vy: r3(v.base.Vy), N: r3(v.base.N), Mx: { topo: r3(v.topo.Mx), base: r3(v.base.Mx) }, My: { topo: r3(v.topo.My), base: r3(v.base.My) } }]));
        return {
          vento: pt.vento && { ...pt.vento, lance },
          horizontais: pt.horizontais && { ...pt.horizontais, lance },
        };
      })(),
      estabilidade: pt.estabilidade,
    }), nu: r2(r.dirX.nu), comb: { Nd: combPortico?.comb ?? nMax.id },
    combinacoes: (combPortico ? pt.combinacoes : combinacoes).map(({ id, tipo, nome, expressao }) => ({ id, tipo, nome, expressao })),
    dirX: dir(r.dirX), dirY: dir(r.dirY),
    minimos: { x: r2(r.minimos.x), y: r2(r.minimos.y) },
    AsMin: r2(r.AsMin), AsMax: r2(r.AsMax),
    armadura: r.escolha && {
      phi: r.escolha.phi, n: r.escolha.n, As: r2(r.escolha.As), rotulo: r.escolha.rotulo,
      estribo: r.escolha.estribo, MRdx: r2(r.escolha.MRdx), MRdy: r2(r.escolha.MRdy),
      pontos: r.escolha.pontos.map((p) => ({ x: r2(p.x), y: r2(p.y) })), cobrimento: cob,
      forma: circular ? 'circular' : 'retangular', ...(circular ? { D, raio: r2(r.escolha.raio) } : {}),
      espacamento: r2(Math.max(r.escolha.ccx, r.escolha.ccy)),
      curva: r.escolha.curva.map((p) => ({ x: r2(p.x), y: r2(p.y) })),
      obliqua: { usoMax: r2(r.escolha.obliqua.usoMax), usoMinima: r2(Math.max(...r.escolha.obliqua.pontos.filter((p) => p.tipo === 'minima').map((p) => p.uso))), pontos: r.escolha.obliqua.pontos.filter((p) => p.tipo !== 'minima').map((p) => ({ nome: p.nome, tipo: p.tipo, Mx: r2(p.Mx), My: r2(p.My), MRd: r2(p.MRd), uso: r2(p.uso) })) },
    },
  };
}

/** Dados iniciais de um pilar novo. */
export function criarPilar() {
  return {
    bx: 20, by: 30, comprimento: 2.8,
    le: { x: null, y: null },
    pesoProprio: true,
    momentos: { x: { A: 0, B: 0 }, y: { A: 0, B: 0 } },
    armadura: { longitudinal: 'auto', estribo: 'auto' },
    cargas: [{ id: 'c1', tipo: 'concentrada', natureza: 'g', valor: 300, descricao: 'Pavimentos superiores' }],
  };
}
