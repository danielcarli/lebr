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
 * Laje maciça retangular — cálculo (NBR 6118:2023)
 *
 * Cada borda pode ser apoiada, engastada ou livre (em balanço, sem apoio).
 * Momentos e flechas pela teoria das placas (elementos finitos, ver
 * engine/placa.js); reações pelo processo das áreas (14.7.6.1) quando todas
 * as bordas são vinculadas, ou pelas reações do modelo de placa quando há
 * borda livre; armaduras mínimas pela Tabela 19.1; cortante sem armadura (19.4.1);
 * lajes em balanço com espessura mínima de 10 cm e γn (13.2.4.1, Tabela 13.2);
 * punção sob cargas concentradas e pilares (19.5, engine/puncao.js).
 */
import { torcaoDoBalancoPlaca } from '../comum/bordas.js';
import { alfaFluencia } from '../../engine/fissuracao.js';
import { analisarPlaca } from '../../engine/placa.js';
import { temBordaLivre, emBalanco, fatoresDeReacaoPlaca } from '../comum/bordas.js';
import { dimensionarFlexao, armaduraMinima } from '../../engine/flexao.js';
import { verificarCortanteLaje } from '../../engine/cisalhamento.js';
import { escolherBarrasLaje, bitolaFixa, motivoBarraLaje, fmtPhi } from '../../engine/barras.js';
import { FCK_MIN } from '../../engine/materiais.js';
import { verificarPuncao } from '../../engine/puncao.js';
import { extremo, doTipo } from '../../engine/combinacoes.js';

const f = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');

export const BORDAS = [
  { id: 'y0', nome: 'Borda inferior', eixo: 'x' },
  { id: 'x1', nome: 'Borda direita', eixo: 'y' },
  { id: 'y1', nome: 'Borda superior', eixo: 'x' },
  { id: 'x0', nome: 'Borda esquerda', eixo: 'y' },
];

/** Cargas características por m² (g, q). */
export function cargasLaje(el, ctx) {
  const pp = el.pesoProprio ? (ctx.materiais.gama * el.h) / 100 : 0;
  const g = pp + (el.cargas?.revestimento ?? 0) + (el.cargas?.outras ?? 0) + (el.cargas?.paredes ?? 0);
  const q = el.cargas?.acidental ?? 0;
  return { pp, g, q };
}

export { temBordaLivre, emBalanco };

/**
 * Reação por borda para carga unitária (kN/m por kN/m²).
 * Sem borda livre: processo das áreas. Com borda livre: reações do modelo de placa.
 */
export const fatoresDeReacao = (el, nu = 0.2) => fatoresDeReacaoPlaca({ lx: el.lx, ly: el.ly, bordas: el.bordas, nu });

/** Reações características nas bordas (kN/m) — consumidas pelas vigas. */
export function cargasTransmitidas(el, ctx) {
  const { g, q } = cargasLaje(el, ctx);
  const { fator } = fatoresDeReacao(el, ctx.materiais.concreto.nu);
  const out = {};
  for (const b of BORDAS) out[b.id] = { g: g * fator[b.id], q: q * fator[b.id] };
  torcaoDoBalancoPlaca(out, el.bordas, el.lx, el.ly);
  return out;
}

/** Bordas que podem apoiar em vigas (as livres não transmitem carga). */
export function ligacoes(el) {
  return BORDAS.filter((b) => el?.bordas?.[b.id] !== 'livre').map((b) => ({ id: b.id, nome: b.nome, tipo: 'linear' }));
}

export function calcularLaje(el, ctx) {
  const { concreto: c, aco: s, gg, gq, psi2, caa } = ctx.materiais;
  const { lx, ly, h, bordas } = el;
  const cob = ctx.parametros.cobrimento.laje;
  if (!(lx > 0 && ly > 0)) throw new Error('Os vãos da laje devem ser positivos.');
  const avisos = [], verificacoes = [], memorial = [];

  const { pp, g, q } = cargasLaje(el, ctx);
  const livre = temBordaLivre(bordas);
  const balanco = emBalanco(bordas);
  // lajes em balanço com h < 19 cm: esforços de cálculo multiplicados por γn (Tabela 13.2)
  const gn = balanco && h < 19 ? 1.95 - 0.05 * h : 1;
  const pd = gn * (gg * g + gq * q);
  const pser = g + psi2 * q;

  const placa = analisarPlaca({ lx, ly, bordas, nu: c.nu });
  const u = placa.unit;
  const lmenor = Math.min(lx, ly), lmaior = Math.max(lx, ly);
  const lambda = lmaior / lmenor;
  const umaDirecao = !livre && lambda > 2;
  const principal = lx <= ly ? 'x' : 'y'; // direção do menor vão

  // bitolas escolhidas pelo usuário (null = automática)
  const phiInf = bitolaFixa(el.armadura?.inferior), phiSup = bitolaFixa(el.armadura?.superior);
  // alturas úteis (barras de ~10 mm ou a bitola escolhida): direção principal na camada inferior
  const phiEst = (phiInf ?? 10) / 10;
  const d1 = h - cob - phiEst / 2;
  const d2 = d1 - phiEst;
  const dPos = { x: principal === 'x' ? d1 : d2, y: principal === 'y' ? d1 : d2 };
  const dNeg = h - cob - (phiSup ?? 10) / 20;

  const AsMinBase = armaduraMinima({ b: 100, h, d: d1, c, s }); // ρmín·b·h
  const rhoMin = AsMinBase / (100 * h);

  const projetar = (Md, d, AsMin, rotulo, eh, phi) => {
    const flex = dimensionarFlexao({ Md: Math.abs(Md), b: 100, h, d, c, s });
    const As = Math.max(flex.AsCalc, AsMin);
    const barras = escolherBarrasLaje({ As, h, principal: eh, phi });
    return { rotulo, Md, d, AsCalc: flex.AsCalc, AsMin, As, barras, ok: flex.ok && !flex.dupla && !!barras, flex, phi };
  };

  const Mx = u.mxPos * pd, My = u.myPos * pd;
  const Mxn = u.mxNeg * pd, Myn = u.myNeg * pd;

  // Tabela 19.1
  const minPos = (dir) => {
    if (!umaDirecao) return 0.67 * rhoMin * 100 * h;
    return dir === principal ? rhoMin * 100 * h : 0; // secundária tratada abaixo
  };
  const armX = projetar(Mx, dPos.x, minPos('x'), 'Positiva x', !umaDirecao || principal === 'x', phiInf);
  const armY = projetar(My, dPos.y, minPos('y'), 'Positiva y', !umaDirecao || principal === 'y', phiInf);
  if (umaDirecao) {
    const sec = principal === 'x' ? armY : armX;
    const prin = principal === 'x' ? armX : armY;
    sec.AsMin = Math.max(0.2 * prin.As, 0.9, 0.5 * rhoMin * 100 * h);
    sec.As = Math.max(sec.AsCalc, sec.AsMin);
    sec.barras = escolherBarrasLaje({ As: sec.As, h, principal: false, phi: phiInf });
    sec.ok = !!sec.barras;
    sec.rotulo += ' (distribuição)';
  }
  const negativas = [];
  if (Mxn < -1e-6) negativas.push(projetar(Mxn, dNeg, rhoMin * 100 * h, 'Negativa x (bordas esquerda/direita)', true, phiSup));
  if (Myn < -1e-6) negativas.push(projetar(Myn, dNeg, rhoMin * 100 * h, 'Negativa y (bordas inferior/superior)', true, phiSup));
  const armaduras = [armX, armY, ...negativas];

  // reações e cortante
  const fr = fatoresDeReacao(el, c.nu);
  const reacoes = BORDAS.map((b) => {
    const k = fr.fator[b.id];
    return { id: b.id, nome: b.nome, tipo: bordas[b.id], g: g * k, q: q * k, d: pd * k, area: fr.area ? fr.area[b.id] : null };
  });
  const VdMax = Math.max(...reacoes.map((r) => r.d));
  const AsApoio = Math.min(armX.As, armY.As);
  const cort = verificarCortanteLaje({ Vd: VdMax, d: d2, As1: AsApoio, c });

  // flecha
  const D = (c.Ecs * 1000 * (h / 100) ** 3) / (12 * (1 - c.nu ** 2)); // kN·m
  // em balanço, a fissuração que governa a flecha é a do engaste (momento negativo)
  const negPrin = negativas.slice().sort((a, b) => a.Md - b.Md)[0];
  const usarNeg = balanco && negPrin;
  const Ma = (usarNeg ? Math.max(-u.mxNeg, -u.myNeg) : Math.max(u.mxPos, u.myPos)) * pser; // kN·m/m
  const Ic = (100 * h ** 3) / 12;
  const Mr = ((1.5 * (c.fctm / 10) * Ic) / (h / 2)) / 100;
  const armPrin = usarNeg ? negPrin : principal === 'x' ? armX : armY;
  const As = armPrin.barras?.AsEf ?? armPrin.As;
  const ae = s.Es / c.Ecs;
  const dd = armPrin.d;
  const xII = (-ae * As + Math.sqrt((ae * As) ** 2 + 200 * ae * As * dd)) / 100;
  const III = (100 * xII ** 3) / 3 + ae * As * (dd - xII) ** 2;
  const fissurada = Ma > Mr;
  const r = fissurada ? (Mr / Ma) ** 3 : 1;
  const Ieq = Math.min(Ic, r * Ic + (1 - r) * III);
  const f0 = (u.wMax * pser / D) * (Ic / Ieq) * 1000; // mm
  const alfaF = alfaFluencia(ctx.parametros.els?.t0 ?? 1).alfaF; // Tabela 17.1: 1,32 com carga aos 30 dias
  const ft = f0 * (1 + alfaF);
  // flecha máxima numa borda livre: limite de balanço 2·l/250, com l até a borda vinculada mais próxima
  const fmax = placa.flechaMaxima;
  const flechaBalanco = fmax.naBordaLivre;
  const lref = flechaBalanco ? fmax.distanciaApoio : lmenor;
  const flim = ((flechaBalanco ? 2 : 1) * lref * 1000) / 250;

  // punção nas cargas concentradas (19.5): ρ e d da malha inferior na região da carga
  const puncao = calcularPuncaoLaje(el, ctx, { armX, armY, h });

  // verificações
  const hMin = balanco ? 10 : 8;
  verificacoes.push({ nome: balanco ? 'Espessura mínima (laje em balanço)' : 'Espessura mínima (laje de piso)', item: '13.2.4.1', valor: `h = ${f(h, 1)} cm`, limite: `≥ ${hMin} cm`, ok: h >= hMin });
  verificacoes.push({ nome: `Concreto mínimo (CAA ${caa})`, item: '7.4.2', valor: `C${c.fck}`, limite: `≥ C${FCK_MIN[caa]}`, ok: c.fck >= FCK_MIN[caa] });
  for (const a of armaduras) {
    verificacoes.push({ nome: `Flexão — ${a.rotulo}`, item: '17.2 / 19.3', valor: `Md = ${f(Math.abs(a.Md))} kN·m/m`, limite: `As = ${f(a.As)} cm²/m`, ok: a.ok });
  }
  verificacoes.push({ nome: 'Cortante sem armadura transversal', item: '19.4.1', valor: `VSd = ${f(cort.Vd)} kN/m`, limite: `VRd1 = ${f(cort.VRd1)} kN/m`, ok: cort.ok });
  verificacoes.push({ nome: flechaBalanco ? 'Flecha total na borda livre' : 'Flecha total', item: '13.3', valor: `${f(ft, 1)} mm`, limite: `${flechaBalanco ? '2·l/250' : 'l/250'} = ${f(flim, 1)} mm`, ok: ft <= flim });
  for (const p of puncao) {
    const r = p.r, nome = p.codigo;
    verificacoes.push({ nome: `Punção ${nome} — contorno C (compressão diagonal)`, item: '19.5.3.1', valor: `τSd = ${f(r.C.tauSd, 3)} MPa`, limite: `τRd2 = ${f(r.C.tauRd, 3)} MPa`, ok: r.C.ok });
    verificacoes.push({ nome: `Punção ${nome} — contorno C' ${r.armadura ? '(com armadura)' : '(sem armadura)'}`, item: r.armadura ? '19.5.3.3' : '19.5.3.2', valor: `τSd = ${f(r.C1.tauSd, 3)} MPa`, limite: `${r.armadura ? 'τRd3' : 'τRd1'} = ${f(r.C1.tauRd, 3)} MPa`, ok: r.armadura ? r.C1.ok : r.C1.dispensa });
    if (r.C2) verificacoes.push({ nome: `Punção ${nome} — contorno C''`, item: '19.5.3.4', valor: `τSd = ${f(r.C2.tauSd, 3)} MPa`, limite: `τRd1 = ${f(r.C2.tauRd, 3)} MPa`, ok: r.C2.ok });
    if (r.armadura && h < 16) verificacoes.push({ nome: `Punção ${nome} — espessura com armadura de punção`, item: '13.2.4.1', valor: `h = ${f(h, 1)} cm`, limite: '≥ 16 cm', ok: false });
  }

  for (const a of armaduras) {
    if (a.flex.dupla) avisos.push(`${a.rotulo}: x/d acima do limite — aumente a espessura da laje.`);
    if (!a.barras) avisos.push(a.phi
      ? `${a.rotulo}: ${motivoBarraLaje({ As: a.As, h, phi: a.phi }) ?? `ø ${fmtPhi(a.phi)} não atende`} — escolha outra bitola.`
      : `${a.rotulo}: armadura elevada para a espessura adotada.`);
  }
  if (!cort.ok) avisos.push('Cortante acima de VRd1: aumente a espessura ou prever armadura transversal.');
  if (gn > 1) avisos.push(`Laje em balanço com h = ${f(h, 0)} cm < 19 cm: esforços de cálculo majorados por γn = ${f(gn)} (Tabela 13.2).`);
  if (livre) avisos.push('Bordas livres: prever armadura de reforço de borda (grampos em U e barras longitudinais), conforme as prescrições de detalhamento da NBR 6118.');
  for (const p of puncao) for (const a of p.r.avisos) avisos.push(`Punção ${p.codigo}: ${a}`);
  if (puncao.length) avisos.push('Cargas concentradas: entram só na verificação da punção; os momentos e as flechas da laje continuam só com as cargas distribuídas.');
  if (balanco) avisos.push('Laje em balanço: a armadura negativa do engaste deve ser ancorada na laje ou viga adjacente; confira o equilíbrio do apoio.');

  memorial.push({ titulo: 'Geometria e cargas', linhas: [
    `lx = ${f(lx)} m · ly = ${f(ly)} m · λ = ${f(lambda)} → ${umaDirecao ? 'armada em uma direção' : 'armada em duas direções'} · h = ${f(h, 1)} cm`,
    `Bordas: esquerda ${bordas.x0}, direita ${bordas.x1}, inferior ${bordas.y0}, superior ${bordas.y1}${balanco ? ' → laje em balanço' : ''}`,
    `g = ${f(g)} kN/m² (peso próprio ${f(pp)}) · q = ${f(q)} kN/m² · pd = ${gn > 1 ? `γn·(γg·g + γq·q) = ${f(gn)}·${f(pd / gn)} = ` : ''}${f(pd)} kN/m² · pser = ${f(pser)} kN/m²`,
  ] });
  memorial.push({ titulo: 'Momentos (teoria das placas, ν = 0,2)', linhas: [
    `${placa.metodo}: malha ${placa.nx} × ${placa.ny}`,
    `μx = ${f(placa.coef.mxPos * 100, 2)} · μy = ${f(placa.coef.myPos * 100, 2)} · μ'x = ${f(-placa.coef.mxNeg * 100, 2)} · μ'y = ${f(-placa.coef.myNeg * 100, 2)} (m = μ·p·l²/100, l = ${f(lmenor)} m)`,
    `Mx = ${f(Mx)} · My = ${f(My)} · M'x = ${f(Mxn)} · M'y = ${f(Myn)} kN·m/m`,
  ] });
  memorial.push({ titulo: 'Armaduras (por metro)', linhas: [`Bitolas: inferior ${phiInf ? `ø ${fmtPhi(phiInf)}` : 'automática'} · superior ${phiSup ? `ø ${fmtPhi(phiSup)}` : 'automática'}`, ...armaduras.map((a) =>
    `${a.rotulo}: d = ${f(a.d)} cm · As,calc = ${f(a.AsCalc)} · As,mín = ${f(a.AsMin)} → ${a.barras?.rotulo ?? '—'} (${f(a.barras?.AsEf)} cm²/m)`)] });
  memorial.push({ titulo: fr.metodo === 'areas' ? 'Reações de apoio (processo das áreas)' : 'Reações de apoio (modelo de placa, média por borda)', linhas: reacoes.map((r) =>
    r.tipo === 'livre' ? `${r.nome}: livre, sem reação` : `${r.nome} (${r.tipo}): g = ${f(r.g)} · q = ${f(r.q)} · total de cálculo ${f(r.d)} kN/m`) });
  for (const p of puncao) memorial.push(memorialPuncao(p));
  memorial.push({ titulo: 'Flecha', linhas: [
    `D = ${f(D, 0)} kN·m · Ma = ${f(Ma)} kN·m/m · Mr = ${f(Mr)} kN·m/m · ${fissurada ? `fissurada, Ieq/Ic = ${f(Ieq / Ic, 3)}` : 'Estádio I'}`,
    `f0 = ${f(f0)} mm · αf = ${f(alfaF)} · f∞ = ${f(ft)} mm ≤ ${flechaBalanco ? `2·l/250 (balanço, l = ${f(lref)} m)` : 'l/250'} = ${f(flim)} mm`,
  ] });

  // mapa de momentos para a grade de pontos (amostrado em até 12 × 12)
  const amostrar = (n, max) => Array.from({ length: Math.min(max, n + 1) }, (_, i) => Math.round((i * n) / (Math.min(max, n + 1) - 1)));
  const is = amostrar(placa.nx, 13), js = amostrar(placa.ny, 13);
  const mapa = js.slice().reverse().map((j) => is.map((i) => Math.round(placa.grade[j][i].w / u.wMax * 1000) / 1000));

  const r2 = (v) => Math.round(v * 100) / 100 || 0; // || 0 evita "-0"
  return {
    ok: verificacoes.every((v) => v.ok),
    avisos, verificacoes, memorial,
    cargas: { pp: r2(pp), g: r2(g), q: r2(q), pd: r2(pd), pser: r2(pser) },
    lambda: r2(lambda), umaDirecao, principal, balanco, livre, gn: r2(gn), metodoReacoes: fr.metodo,
    momentos: { Mx: r2(Mx), My: r2(My), Mxn: r2(Mxn), Myn: r2(Myn) },
    armaduras: armaduras.map((a) => ({ rotulo: a.rotulo, Md: r2(a.Md), d: r2(a.d), As: r2(a.As), AsCalc: r2(a.AsCalc), AsMin: r2(a.AsMin), barras: a.barras && { ...a.barras, AsEf: r2(a.barras.AsEf) }, ok: a.ok })),
    reacoes: reacoes.map((r) => ({ ...r, g: r2(r.g), q: r2(r.q), d: r2(r.d), area: r.area == null ? null : r2(r.area) })),
    cortante: { Vd: r2(cort.Vd), VRd1: r2(cort.VRd1) },
    flecha: { f0: r2(f0), ft: r2(ft), lim: r2(flim), fissurada, balanco: flechaBalanco },
    puncao: puncao.map(resumoPuncao),
    mapa,
  };
}

/* ------------------------------------------------------------------ punção */

export const POSICOES_PUNCAO = [
  { valor: 'interna', texto: 'Interna' },
  { valor: 'borda', texto: 'Borda', dica: 'Junto a uma borda livre: c1 perpendicular à borda' },
  { valor: 'canto', texto: 'Canto', dica: 'No canto de duas bordas livres' },
];

/** Nova carga concentrada (ou pilar) para a verificação da punção. */
export function novaCargaConcentrada(el) {
  return { id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, descricao: '', posicao: 'interna', c1: 20, c2: 20, g: 20, q: 10, x: (el?.lx ?? 4) / 2, y: (el?.ly ?? 5) / 2, phi: 'auto' };
}

/**
 * Punção para cada carga concentrada da laje. FSd pela combinação última que governa (Tabela 11.3);
 * ρ = √(ρx·ρy) com as barras inferiores adotadas e d médio das duas camadas (19.5.3.2).
 */
export function calcularPuncaoLaje(el, ctx, { armX, armY, h }) {
  const lista = el.cargasConcentradas ?? [];
  if (!lista.length) return [];
  const { concreto: c, aco: s } = ctx.materiais;
  const elu = doTipo(ctx.materiais.combinacoes ?? [], 'ELU');
  const AsX = armX.barras?.AsEf ?? armX.As, AsY = armY.barras?.AsEf ?? armY.As;
  const rhoX = AsX / (100 * armX.d), rhoY = AsY / (100 * armY.d);
  const rho = Math.sqrt(rhoX * rhoY);
  const d = (armX.d + armY.d) / 2;
  return lista.map((p, i) => {
    const g = Number(p.g) || 0, q = Number(p.q) || 0;
    const comb = elu.length ? extremo(elu, { G: g, Q: q }) : { valor: (ctx.materiais.gg ?? 1.4) * g + (ctx.materiais.gq ?? 1.4) * q, id: 'ELU' };
    const phi = bitolaFixa(p.phi);
    const r = verificarPuncao({ FSd: comb.valor, posicao: p.posicao ?? 'interna', c1: Number(p.c1), c2: Number(p.c2), d, h, rho, c, s, phi });
    return { id: p.id, codigo: p.codigo || `P${i + 1}`, descricao: p.descricao ?? '', posicao: p.posicao ?? 'interna', c1: Number(p.c1), c2: Number(p.c2), g, q, comb: comb.id, rhoX, rhoY, r };
  });
}

function memorialPuncao(p) {
  const { r } = p;
  const pos = { interna: 'interna', borda: 'de borda', canto: 'de canto' }[p.posicao];
  const linhas = [
    `Área carregada ${pos}: c1 = ${f(p.c1, 1)} cm · c2 = ${f(p.c2, 1)} cm · Fk: g = ${f(p.g)} kN · q = ${f(p.q)} kN → FSd = ${f(r.FSd)} kN (${p.comb})`,
    `d = ${f(r.d)} cm · ρx = ${f(p.rhoX * 100, 3)} % · ρy = ${f(p.rhoY * 100, 3)} % · ρ = √(ρx·ρy) = ${f(r.rho * 100, 3)} % · k = 1 + √(20/d) = ${f(r.k, 3)}`,
    `Contorno C: u = ${f(r.C.u, 1)} cm · τSd = FSd/(u·d) = ${f(r.C.tauSd, 3)} MPa ≤ τRd2 = 0,27·αv2·fcd = ${f(r.tauRd2, 3)} MPa`,
    `Contorno C' (2d = ${f(2 * r.d, 1)} cm): u = ${f(r.C1.u, 1)} cm · τSd = ${f(r.C1.tauSd, 3)} MPa · τRd1 = 0,13·k·(100·ρ·fck)^(1/3) = ${f(r.tauRd1, 3)} MPa${r.armadura ? ' → precisa de armadura de punção' : ' → dispensa armadura de punção'}`,
  ];
  if (r.armadura) {
    const a = r.armadura;
    linhas.push(
      `Armadura (19.5.3.3): sr = ${f(a.sr, 1)} cm ≤ 0,75·d · s0 = ${f(a.s0, 1)} cm ≤ 0,5·d · fywd = ${f(a.fywd, 0)} MPa · Asw,nec = ${f(a.AswNec, 3)} cm² por contorno`,
      `${a.rotulo} · Asw = ${f(a.Asw, 3)} cm² · τRd3 = ${f(a.tauRd3, 3)} MPa ${r.C1.ok ? '≥' : '<'} τSd`,
      `Contorno C'' a ${f(r.C2.distancia, 1)} cm da face: u = ${f(r.C2.u, 1)} cm · τSd = ${f(r.C2.tauSd, 3)} MPa ${r.C2.ok ? '≤' : '>'} τRd1 = ${f(r.C2.tauRd, 3)} MPa`,
    );
  }
  return { titulo: `Punção ${p.codigo}${p.descricao ? ` — ${p.descricao}` : ''} (19.5)`, linhas };
}

function resumoPuncao(p) {
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const r = p.r;
  const cont = (x) => x && { u: Math.round(x.u * 10) / 10, tauSd: r3(x.tauSd), tauRd: r3(x.tauRd), ok: x.ok ?? x.dispensa, ...(x.distancia != null ? { distancia: Math.round(x.distancia * 10) / 10 } : {}) };
  return {
    id: p.id, codigo: p.codigo, descricao: p.descricao, posicao: p.posicao, c1: p.c1, c2: p.c2, comb: p.comb,
    FSd: Math.round(r.FSd * 100) / 100, d: Math.round(r.d * 100) / 100, rho: Math.round(r.rho * 1e5) / 1e5, k: r3(r.k),
    tauRd1: r3(r.tauRd1), tauRd2: r3(r.tauRd2),
    C: cont(r.C), C1: { ...cont(r.C1), dispensa: r.C1.dispensa }, C2: cont(r.C2) ?? null,
    armadura: r.armadura ? { ...r.armadura, AswNec: r3(r.armadura.AswNec), Asw: r3(r.armadura.Asw), tauRd3: r3(r.armadura.tauRd3), fywd: Math.round(r.armadura.fywd) } : null,
    ok: r.ok,
  };
}

/** Dados iniciais de uma laje nova. */
export function criarLaje() {
  return {
    lx: 4, ly: 5, h: 10,
    bordas: { x0: 'apoiada', x1: 'apoiada', y0: 'apoiada', y1: 'apoiada' },
    pesoProprio: true,
    armadura: { inferior: 'auto', superior: 'auto' },
    cargas: { uso: 'res-sala', revestimento: 1.0, acidental: 1.5, outras: 0 },
  };
}
