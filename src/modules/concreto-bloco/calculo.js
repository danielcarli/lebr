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
 * Bloco sobre estacas — cálculo (NBR 6118:2023, 22.7 · NBR 6122).
 *
 * O bloco recebe a carga do pilar ligado e a distribui entre as estacas (reações com os momentos); cada estaca
 * tem a capacidade calculada pelo SPT (módulo Estaca). O bloco é dimensionado pelo método das bielas e
 * tirantes (Blévot) — inclinação e tensões das bielas, tirantes sobre as estacas — com a malha de distribuição.
 */
import { arranjoEstacas, dimensoesBloco, reacoesEstacas, intervaloAlturaUtil, bielasETirantes, KR, D_LINHA } from '../../engine/bloco.js';
import { escolherBarrasViga, fmtPhi } from '../../engine/barras.js';
import { ancoragemBasica } from '../../engine/sapata.js';
import { dadosDoPilar, escolherMalha, COBRIMENTO_SOLO } from '../concreto-sapata/calculo.js';
import { calcularEstaca, criarEstaca } from '../geotecnia-estaca/calculo.js';
import { TIPOS_ESTACA } from '../../engine/estacas.js';
import { armaduraEstaca, detalharBloco } from '../../engine/fundacoes-armadura.js';
import { COBRIMENTO_MM } from '../../engine/materiais.js';
import { resumoArmaduraEstaca } from '../geotecnia-estaca/calculo.js';

const f = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');
const r1 = (v) => Math.round(v * 10) / 10 || 0;
const r2 = (v) => Math.round(v * 100) / 100 || 0;
const arred5 = (v) => Math.ceil((v - 1e-6) / 5) * 5;

export function criarBloco(projeto) {
  return {
    pilarId: null,
    ap: 20, bp: 30, cargas: { g: 400, q: 100 },     // sem pilar ligado
    momentos: { x: 0, y: 0 },                       // kN·m característicos adicionais
    n: 'auto',                                      // número de estacas (1 a 6) ou 'auto'
    espacamento: null,                              // cm entre eixos (null = 3·D, ou 2,5·D nas pré-moldadas)
    profundidade: 1.5,                              // m — fundo do bloco abaixo do terreno
    geometria: { modo: 'automatica', A: 160, B: 70, h: 60 },
    cobrimento: COBRIMENTO_SOLO[projeto?.parametros?.classeAgressividade ?? 'II'] ?? 3.0,
    estaca: { tipo: 'helice', secao: 'circular', D: 30, L: 8, sondagemId: null, limitarPonta: null, estrutural: { fck: null, gc: null, catalogo: null } },
    armadura: { phiPilar: null },
  };
}

/** Capacidade (carga admissível) de uma estaca do bloco, pelo furo mais próximo. */
function capacidadeDaEstaca(el, ctx, ponto) {
  const est = { ...criarEstaca(), ...(el.estaca ?? {}), topo: Math.max(0, (Number(el.profundidade) || 0) - 0.1), local: { x: ponto[0], y: ponto[1] }, pilarId: null, cargaTrabalho: null };
  return calcularEstaca(est, ctx);
}

/** Geometria automática para n estacas. */
function geometriaAutomatica({ n, e, D, ap, bp, lb }) {
  const pos = arranjoEstacas(n, e);
  const { A, B } = dimensoesBloco(pos, D, { ap, bp });
  let h;
  if (n === 1) h = Math.max(40, arred5(1.2 * D + 5), arred5(lb + D_LINHA));
  else {
    const iv = intervaloAlturaUtil({ n, e, ap, bp, pos });
    h = Math.max(40, arred5((iv.min + Math.max(iv.min, iv.max)) / 2 + D_LINHA), arred5(lb + D_LINHA));
  }
  return { pos, A, B, h };
}

export function calcularBloco(el, ctx) {
  const { concreto: c, aco: s, gg, gq, gama } = ctx.materiais;
  const avisos = [], verificacoes = [], memorial = [];
  const dp = dadosDoPilar(el, ctx);
  const { ap, bp } = dp;
  const Mx = Math.abs(dp.Mx) + Math.abs(el.momentos?.x ?? 0), My = Math.abs(dp.My) + Math.abs(el.momentos?.y ?? 0);
  const Nk = dp.g + dp.q;
  if (!(Nk > 0)) throw new Error('O bloco não recebe carga: ligue um pilar ou informe g e q.');
  const est = el.estaca ?? {};
  const tipo = TIPOS_ESTACA[est.tipo] ?? TIPOS_ESTACA.helice;
  const D = Number(est.D) || 30;
  const e = Number(el.espacamento) || (est.tipo === 'premoldada' ? 2.5 : 3) * D;
  const cob = Number(el.cobrimento) || 3;
  const phiPilar = Number(el.armadura?.phiPilar) || dp.pilar?.resultado?.armadura?.phi || 12.5;
  const anc = ancoragemBasica({ phi: phiPilar, c, s });
  const ponto = dp.centro ?? [0, 0];

  // capacidade de cada estaca (o furo mais próximo do pilar)
  const cap = capacidadeDaEstaca(el, ctx, ponto);
  const Padm = cap.Padm;

  // número de estacas e geometria
  const manual = el.geometria?.modo === 'manual';
  const tentar = (n) => {
    const g = manual ? { pos: arranjoEstacas(n, e), A: el.geometria.A, B: el.geometria.B, h: el.geometria.h } : geometriaAutomatica({ n, e, D, ap, bp, lb: anc.lb });
    const PP = (gama * g.A * g.B * g.h) / 1e6;
    const Rk = reacoesEstacas({ N: Nk + PP, Mx, My, pos: g.pos });
    return { n, ...g, PP, Rk };
  };
  let sol;
  if (el.n === 'auto' || el.n == null) {
    for (let n = 1; n <= 6; n++) {
      const t = tentar(n);
      if (Math.max(...t.Rk) <= Padm + 1e-6 && Math.min(...t.Rk) >= 0) { sol = t; break; }
    }
    if (!sol) {
      sol = tentar(6);
      avisos.push(`Nem 6 estacas de ${f(Padm, 0)} kN atendem: aumente o diâmetro ou o comprimento das estacas.`);
    }
  } else sol = tentar(Math.max(1, Math.min(6, Math.round(Number(el.n)))));
  const { n, pos, A, B, h, PP, Rk } = sol;
  const d = h - D_LINHA;

  // ---------------------------------------------------------------- estacas (característico)
  const Rmax = Math.max(...Rk), Rmin = Math.min(...Rk);
  verificacoes.push(
    { nome: 'Reação máxima na estaca', item: 'NBR 6122', valor: `${f(Rmax, 1)} kN`, limite: `≤ Padm = ${f(Padm, 1)} kN`, ok: Rmax <= Padm + 1e-6 },
    { nome: 'Estacas sem tração', item: 'NBR 6122', valor: `Rmín = ${f(Rmin, 1)} kN`, limite: '≥ 0', ok: Rmin >= -1e-6 },
  );
  const sMin = n >= 2 ? Math.min(...pos.flatMap((p, i) => pos.slice(i + 1).map((q) => Math.hypot(p.x - q.x, p.y - q.y)))) : null;
  if (sMin != null) {
    const emin = (est.tipo === 'premoldada' ? 2.5 : 3) * D;
    verificacoes.push({ nome: 'Espaçamento entre estacas', item: 'NBR 6122', valor: `${f(sMin, 0)} cm`, limite: `≥ ${est.tipo === 'premoldada' ? '2,5' : '3'}·D = ${f(emin, 0)} cm`, ok: sMin >= emin - 1e-6 });
  }

  // ---------------------------------------------------------------- bielas e tirantes (cálculo)
  const Nd = gg * dp.g + gq * dp.q;
  const fd = Nd / Nk;
  const Rd = reacoesEstacas({ N: Nd, Mx: fd * Mx, My: fd * My, pos });
  const bt = bielasETirantes({ n, e, ap, bp, d, D, Nd, R: Rd, pos, fcd: c.fcd });
  const fyd = s.fyd / 10; // kN/cm²
  const faixa = 1.2 * D;  // largura da faixa sobre as estacas (cm)
  const linhas = (eixo) => new Set(pos.filter((p) => Math.abs(eixo === 'x' ? p.x : p.y) > (eixo === 'x' ? ap : bp) / 4).map((p) => Math.round(eixo === 'x' ? p.y : p.x))).size;
  let armad;
  if (n === 1) {
    const Tdx = 0.25 * Nd * (A - ap) / A, Tdy = 0.25 * Nd * (B - bp) / B;
    const As = Math.max(Tdx, Tdy) / fyd;
    armad = { tipo: 'fendilhamento', Td: { x: Tdx, y: Tdy }, As, estribos: escolherBarrasViga({ As: As / 2, bw: 30, cob: 0, phiT: 0, min: 2 }) };
  } else {
    const fat = n === 2 ? 1.15 : 1.0;                       // Blévot: 15 % a mais no tirante dos blocos de 2 estacas
    const dir = (eixo, T) => {
      if (!(T > 0)) return null;
      const As = (fat * T) / fyd;
      if (bt.tirantes.tipo === 'lados') {
        const AsLado = (fat * bt.tirantes.lado) / fyd;
        return { As, faixas: n === 3 ? 3 : 2, AsFaixa: AsLado, barras: escolherBarrasViga({ As: AsLado, bw: faixa + 2 * cob, cob, phiT: 0, min: 2 }) };
      }
      const k = Math.max(1, linhas(eixo));
      return { As, faixas: k, AsFaixa: As / k, barras: escolherBarrasViga({ As: As / k, bw: faixa + 2 * cob, cob, phiT: 0, min: 2 }) };
    };
    const x = dir('x', bt.Tx), y = n === 3 ? null : dir('y', bt.Ty);
    // malha de distribuição: 20 % dos esforços totais em cada direção (22.7.4.1.2)
    const Ast = Math.max(x?.As ?? 0, y?.As ?? 0, n === 3 ? x.As : 0);
    const malha = { As: 0.2 * Ast, x: escolherMalha({ As: 0.2 * Ast, largura: B, cob }), y: escolherMalha({ As: 0.2 * Ast, largura: A, cob }) };
    armad = { tipo: bt.tirantes.tipo, x, y, malha, fator: fat };
    if (n === 3) armad.lados = x;
  }
  const susp = sMin != null && sMin > 3 * D + 0.5 ? Nd / (1.5 * n * fyd) : null;
  if (susp) avisos.push(`Espaçamento entre estacas maior que 3·D: prever armadura de suspensão (22.7.4.1.3), As,susp ≈ Nd/(1,5·n·fyd) = ${f(susp)} cm².`);

  if (n >= 2) {
    // 5 e 6 estacas: as bielas das estacas próximas do pilar ficam mais íngremes; a que governa os tirantes é a
    // mais abatida (estaca mais afastada), que deve ficar entre 45° e 55°
    const okAng = n >= 5 ? bt.alfaMin >= 45 - 0.05 && bt.alfaMin <= 55 + 0.05 : bt.alfaMin >= 45 - 0.05 && bt.alfaMax <= 55 + 0.05;
    verificacoes.push(
      { nome: 'Inclinação das bielas', item: '22.7 (Blévot)', valor: n >= 5 ? `${f(bt.alfaMin, 1)}° (estaca mais afastada; demais até ${f(bt.alfaMax, 1)}°)` : `${f(bt.alfa, 1)}°`, limite: 'entre 45° e 55°', ok: okAng },
      { nome: 'Biela junto ao pilar', item: '22.7 (Blévot)', valor: `σ = ${f(bt.sigmaPil)} MPa`, limite: `≤ ${f(bt.fator, 2)}·KR·fcd = ${f(bt.limite)} MPa`, ok: bt.sigmaPil <= bt.limite + 1e-9 },
      { nome: 'Biela junto à estaca', item: '22.7 (Blévot)', valor: `σ = ${f(bt.sigmaEst)} MPa`, limite: `≤ ${f(bt.limite)} MPa`, ok: bt.sigmaEst <= bt.limite + 1e-9 },
    );
  }
  const rigido = (A - ap) / 3 <= h + 1e-6 && (B - bp) / 3 <= h + 1e-6;
  verificacoes.push(
    { nome: 'Bloco rígido', item: '22.7.1', valor: `h = ${f(h, 0)} cm`, limite: `≥ (a − ap)/3 = ${f(Math.max((A - ap) / 3, (B - bp) / 3), 1)} cm`, ok: rigido },
    { nome: `Ancoragem das barras do pilar (ø ${fmtPhi(phiPilar)})`, item: '22.7.4.1', valor: `d = ${f(d, 1)} cm`, limite: `≥ lb = ${f(anc.lb, 1)} cm`, ok: d >= anc.lb - 1e-6 },
  );
  const semBarras = n >= 2 && [armad.x, armad.y].some((a) => a && !a.barras);
  if (semBarras) avisos.push('A armadura do tirante não cabe na faixa sobre as estacas com as bitolas usuais: aumente a altura do bloco.');

  // ---------------------------------------------------------------- armadura das estacas (NBR 6122:2019) e lista de ferros
  let armEst = null;
  try {
    armEst = armaduraEstaca({
      tipo: est.tipo ?? 'helice', D, secao: est.secao, L: Number(est.L) || 8, Nk: Math.max(0, Rmax), caa: ctx.materiais.caa, fck: est.estrutural?.fck, gc: est.estrutural?.gc,
      aco: s, fctd: c.fctd, cob: (COBRIMENTO_MM.solo[ctx.materiais.caa] ?? 30) / 10, dmax: ctx.materiais.dmax ?? 19, atrito: cap.perfilAtrito,
    });
  } catch (err) { avisos.push(`Armadura das estacas: ${err.message}`); }
  if (armEst?.aplicavel) verificacoes.push(...armEst.verificacoes.map((v) => ({ ...v, nome: `${v.nome} (Rmáx)` })));
  if (armEst) for (const a of armEst.avisos) if (!avisos.includes(a)) avisos.push(a);
  const emLinha = n >= 2 && (new Set(pos.map((p) => Math.round(p.y))).size === 1 || new Set(pos.map((p) => Math.round(p.x))).size === 1);
  const armSaida = n === 1
    ? { tipo: 'fendilhamento', rotulo: armad.estribos?.rotulo ?? null }
    : { tipo: armad.tipo, x: armad.x && { rotulo: armad.x.barras?.rotulo, faixas: armad.x.faixas }, y: armad.y && { rotulo: armad.y.barras?.rotulo, faixas: armad.y.faixas }, malha: { x: armad.malha.x?.rotulo ?? null, y: armad.malha.y?.rotulo ?? null } };
  const detalhamento = detalharBloco({ n, A, B, h, cob, e, D, armadura: armSaida, suspensao: susp, emLinha, estaca: armEst?.aplicavel ? armEst : null });

  // ---------------------------------------------------------------- memorial
  memorial.push(
    { titulo: 'Pilar e estacas', linhas: [
      dp.pilar ? `Pilar ${dp.pilar.codigo} (${f(ap, 0)} × ${f(bp, 0)} cm): Nk = ${f(dp.g)} + ${f(dp.q)} kN (${dp.origem === 'portico' ? 'pórtico espacial' : 'cargas dos elementos'}); Mx = ${f(Mx)} kN·m, My = ${f(My)} kN·m.` : `Carga informada: Nk = ${f(dp.g)} + ${f(dp.q)} kN, pilar ${f(ap, 0)} × ${f(bp, 0)} cm.`,
      `Estacas: ${tipo.nome} ø ${f(D, 0)} cm, L = ${f(est.L ?? 8, 1)} m, furo ${cap.furo.codigo}: Padm = ${f(Padm, 1)} kN (${cap.governa}).`,
      `${n} estaca(s), espaçamento ${f(e, 0)} cm; bloco ${f(A, 0)} × ${f(B, 0)} × ${f(h, 0)} cm, peso próprio ${f(PP, 1)} kN.`,
      `Reações características: ${Rk.map((r) => f(r, 1)).join(' · ')} kN (Ri = N/n + Mx·xi/Σx² + My·yi/Σy²).`,
    ] },
    { titulo: 'Bielas e tirantes (Blévot)', linhas: n === 1
      ? [`Bloco de transição sobre uma estaca: Td = 0,25·Nd·(A − ap)/A = ${f(armad.Td.x, 1)} kN (x) e ${f(armad.Td.y, 1)} kN (y); As = Td/fyd = ${f(armad.As)} cm² em estribos horizontais.`]
      : [
        `Nd = ${f(Nd, 1)} kN; d = h − ${D_LINHA} = ${f(d, 1)} cm; α = ${f(bt.alfaMin, 1)}°${bt.alfaMax !== bt.alfaMin ? ` a ${f(bt.alfaMax, 1)}°` : ''}.`,
        `${bt.tirantes.texto}: ${bt.tirantes.tipo === 'lados' ? `${f(bt.tirantes.lado, 1)} kN por lado` : `${f(bt.Tx, 1)} kN em x${bt.Ty ? `, ${f(bt.Ty, 1)} kN em y` : ''}`}${armad.fator > 1 ? ' (armadura com 15 % a mais)' : ''}.`,
        `Bielas: junto ao pilar σ = Nd/(Ap·sen²α) = ${f(bt.sigmaPil)} MPa; junto à estaca σ = Rd/(Ae·sen²α) = ${f(bt.sigmaEst)} MPa; limite ${f(bt.fator, 2)}·KR·fcd = ${f(bt.limite)} MPa (KR = ${f(KR)}).`,
        `Malha de distribuição: 20 % dos esforços totais (22.7.4.1.2) = ${f(armad.malha.As)} cm² em cada direção.`,
      ] },
  );

  if (detalhamento.notas.length) memorial.push({ titulo: 'Armaduras laterais e superior (22.7.4.1.5)', linhas: [...detalhamento.notas, ...detalhamento.posicoes.filter((q) => ['superior', 'pele', 'estribo-vertical'].includes(q.id)).map((q) => `${q.N}: ${q.local} → ${q.n} ø ${String(q.phi).replace('.', ',')}`)] });
  if (armEst?.aplicavel) memorial.push({ titulo: `Armadura das estacas — Rmáx = ${f(Rmax, 1)} kN (NBR 6122:2019, 8.6.3 e Tabela 4)`, linhas: armEst.memorial });
  const barra = (a) => a && { As: r2(a.As), faixas: a.faixas, AsFaixa: r2(a.AsFaixa), rotulo: a.barras?.rotulo ?? null };
  return {
    ok: verificacoes.every((v) => v.ok) && !semBarras,
    avisos, verificacoes, memorial,
    pilar: dp.pilar ? { id: dp.pilar.id, codigo: dp.pilar.codigo } : null, origem: dp.origem, ap, bp,
    Nk: { g: r2(dp.g), q: r2(dp.q) }, Mk: { x: r2(Mx), y: r2(My) }, Nd: r2(Nd), PP: r2(PP),
    n, e: r2(e), pos: pos.map((p) => ({ x: r2(p.x), y: r2(p.y) })), A, B, h, d: r2(d), rigido,
    Rk: Rk.map(r1), Rd: Rd.map(r1), Padm: r1(Padm),
    estaca: { tipo: est.tipo, nome: tipo.nome, D, L: est.L, furo: cap.furo, av: cap.av.Padm, dq: cap.dq.Padm, governa: cap.governa },
    bielas: { alfa: r2(bt.alfa), alfaMin: r2(bt.alfaMin), alfaMax: r2(bt.alfaMax), sigmaPil: r2(bt.sigmaPil), sigmaEst: r2(bt.sigmaEst), limite: r2(bt.limite), Tx: r1(bt.Tx), Ty: r1(bt.Ty), lado: bt.tirantes.lado != null ? r1(bt.tirantes.lado) : null, mediana: bt.tirantes.mediana != null ? r1(bt.tirantes.mediana) : null },
    armadura: n === 1
      ? { tipo: 'fendilhamento', Td: { x: r1(armad.Td.x), y: r1(armad.Td.y) }, As: r2(armad.As), rotulo: armad.estribos?.rotulo ?? null }
      : { tipo: armad.tipo, x: barra(armad.x), y: barra(armad.y), malha: { As: r2(armad.malha.As), x: armad.malha.x?.rotulo ?? null, y: armad.malha.y?.rotulo ?? null } },
    suspensao: susp != null ? r2(susp) : null,
    emLinha,
    armaduraEstaca: armEst?.aplicavel ? resumoArmaduraEstaca(armEst) : null,
    detalhamento,
    profundidade: el.profundidade, cobrimento: cob,
  };
}
