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
 * Estaca isolada — capacidade de carga pelo SPT (Aoki-Velloso e Décourt-Quaresma) e carga admissível (NBR 6122).
 */
import { capacidadeEstaca, cargaEstrutural, TIPOS_ESTACA, FS_SEMIEMPIRICO } from '../../engine/estacas.js';
import { armaduraEstaca } from '../../engine/fundacoes-armadura.js';
import { COBRIMENTO_MM } from '../../engine/materiais.js';
import { analisarSondagem, nsptNa, camadaNa, furoMaisProximo } from '../../engine/sondagem.js';
import { centroPilar } from '../../renderer/core/montagem.js';
import { porticoDoPilar, porticoNosPilares } from '../comum/portico-edificio.js';

const f = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');
const r1 = (v) => Math.round(v * 10) / 10 || 0;
const r2 = (v) => Math.round(v * 100) / 100 || 0;

export function criarEstaca() {
  return {
    tipo: 'helice', secao: 'circular', D: 40, L: 8,
    topo: 1.5,                         // m — profundidade do topo (arrasamento) abaixo do terreno (cota 0)
    local: { x: 0, y: 0 },             // m — posição na planta (quando não há pilar ligado)
    pilarId: null,                     // pilar sobre a estaca (carga de trabalho e posição)
    sondagemId: null,                  // furo usado (null = o mais próximo)
    limitarPonta: null,                // escavadas: ponta ≤ 20 % da carga admissível (null = sim nas escavadas)
    cargaTrabalho: null,               // kN — carga característica a verificar, sem pilar ligado
    estrutural: { fck: null, gc: null, catalogo: null }, // fck e γc das moldadas in loco; carga de catálogo das pré-moldadas (kN)
  };
}

/** Furo e análise da sondagem para a estaca. */
function furoDaEstaca(el, ctx, ponto) {
  const furos = ctx.projeto.elementos.filter((e) => e.modulo === 'geotecnia.sondagem');
  if (!furos.length) throw new Error('Não há furos de sondagem no projeto: cadastre um (Novo: Sondagem SPT) para calcular a estaca.');
  let furo = el.sondagemId ? furos.find((x) => x.id === el.sondagemId) : null, distancia = null;
  if (!furo) { const m = furoMaisProximo(furos, ponto[0], ponto[1]); furo = m?.furo ?? furos[0]; distancia = m?.distancia ?? null; }
  return { furo, distancia, an: analisarSondagem(furo) };
}

/** Capacidade para um comprimento L (usada também na curva carga × comprimento). */
function capacidade(el, an, topoFuro, L) {
  return capacidadeEstaca({ tipo: el.tipo, D: el.D, secao: el.secao, topo: topoFuro, L, nspt: (p) => nsptNa(an, p), camada: (p) => camadaNa(an, p), limitarPonta: el.limitarPonta ?? null });
}

export function calcularEstaca(el, ctx) {
  const t = TIPOS_ESTACA[el.tipo];
  if (!t) throw new Error('Tipo de estaca desconhecido.');
  const avisos = [], verificacoes = [];
  const pilar = el.pilarId ? ctx.elemento(el.pilarId) : null;
  if (el.pilarId && !pilar) throw new Error('O pilar ligado a esta estaca não existe mais.');
  const ponto = pilar?.posicao ? centroPilar(pilar) : [el.local?.x ?? 0, el.local?.y ?? 0];
  const { furo, distancia, an } = furoDaEstaca(el, ctx, ponto);
  const topoFuro = an.cotaBoca + Number(el.topo || 0);            // profundidade do topo no furo (m)
  const pontaFuro = topoFuro + el.L;
  const ultimo = an.ensaios.at(-1)?.prof ?? 0;
  if (pontaFuro > an.limite + 0.01) throw new Error(`A ponta (${f(pontaFuro)} m no furo ${furo.codigo}) passa do fim da sondagem (${f(an.limite)} m): diminua o comprimento ou use um furo mais profundo.`);
  if (pontaFuro + 1 > ultimo + 0.45) avisos.push(`Não há ensaio 1 m abaixo da ponta no furo ${furo.codigo}: no Décourt-Quaresma, Np usa só os ensaios disponíveis.`);
  const r = capacidade(el, an, topoFuro, el.L);
  avisos.push(...r.avisos);

  // carga estrutural
  const estrut = t.fck ? cargaEstrutural({ tipo: el.tipo, D: el.D, secao: el.secao, fck: el.estrutural?.fck, gc: el.estrutural?.gc }) : (Number(el.estrutural?.catalogo) || null);
  if (!t.fck && !estrut) avisos.push('Pré-moldada: informe a carga estrutural do catálogo do fabricante para limitar a carga admissível.');

  // carga de trabalho
  let Nk = Number(el.cargaTrabalho) || null, origemCarga = Nk ? 'informada' : null;
  if (pilar) {
    if (porticoNosPilares(ctx.projeto)) {
      const pt = porticoDoPilar(pilar, ctx);
      if (pt && !pt.erro && pt.lance?.fundacao) { Nk = pt.lance.porCaso.G.base.N + pt.lance.porCaso.Q.base.N; origemCarga = `${pilar.codigo} (pórtico)`; }
    }
    if (origemCarga == null || origemCarga === 'informada') { const c = ctx.cargasDe(pilar.id, 'base'); Nk = c.g + c.q; origemCarga = pilar.codigo; }
  }

  const Pgeo = Math.min(r.av.adm.P, r.dq.adm.P);
  const Padm = estrut ? Math.min(Pgeo, estrut) : Pgeo;
  const governa = estrut && estrut < Pgeo ? 'estrutural' : r.av.adm.P <= r.dq.adm.P ? 'Aoki-Velloso' : 'Décourt-Quaresma';

  // curva carga admissível × comprimento (de metro em metro, até 1 m antes do fim da sondagem)
  const curva = [];
  for (let L = 3; topoFuro + L <= an.limite - 0.45 + 1e-9; L += 1) {
    try {
      const c = L === el.L ? r : capacidade(el, an, topoFuro, L);
      curva.push({ L, av: r1(c.av.adm.P), dq: r1(c.dq.adm.P), adotada: r1(Math.min(c.av.adm.P, c.dq.adm.P, estrut ?? Infinity)) });
    } catch { /* trecho sem ensaio */ }
  }
  const Lmin = Nk ? curva.find((c) => c.adotada >= Nk)?.L ?? null : null;

  verificacoes.push({ nome: 'Ponta dentro da sondagem', item: 'NBR 6122', valor: `${f(pontaFuro)} m`, limite: `≤ ${f(an.limite)} m`, ok: true });
  if (Nk) {
    verificacoes.push(
      { nome: 'Carga admissível — Aoki-Velloso', item: 'NBR 6122', valor: `Nk = ${f(Nk, 1)} kN`, limite: `≤ ${f(r.av.adm.P, 1)} kN`, ok: Nk <= r.av.adm.P + 1e-6 },
      { nome: 'Carga admissível — Décourt-Quaresma', item: 'NBR 6122', valor: `Nk = ${f(Nk, 1)} kN`, limite: `≤ ${f(r.dq.adm.P, 1)} kN`, ok: Nk <= r.dq.adm.P + 1e-6 },
    );
    if (estrut) verificacoes.push({ nome: 'Carga estrutural', item: 'NBR 6122', valor: `Nk = ${f(Nk, 1)} kN`, limite: `≤ ${f(estrut, 1)} kN`, ok: Nk <= estrut + 1e-6 });
    if (Nk > Padm && Lmin) avisos.push(`Com ${f(el.L, 1)} m a estaca não atende; o menor comprimento que atende pelos dois métodos é ${f(Lmin, 0)} m.`);
    if (Nk > Padm && !Lmin) avisos.push('Nenhum comprimento dentro da sondagem atende: aumente o diâmetro, troque o tipo ou use mais estacas (bloco).');
  }

  const g = r.geometria;
  // ---------------------------------------------------------------- armadura (NBR 6122:2019, 8.6.3 e Tabela 4)
  const atrito = perfilAtrito(r);
  const NkArm = Nk ?? Padm;
  let arm = null;
  try {
    arm = armaduraEstaca({
      tipo: el.tipo, D: el.D, secao: el.secao, L: el.L, Nk: NkArm, caa: ctx.materiais.caa, fck: el.estrutural?.fck, gc: el.estrutural?.gc,
      aco: ctx.materiais.aco, fctd: ctx.materiais.concreto.fctd, cob: (COBRIMENTO_MM.solo[ctx.materiais.caa] ?? 30) / 10, dmax: ctx.materiais.dmax ?? 19, atrito,
    });
  } catch (err) { avisos.push(`Armadura da estaca: ${err.message}`); }
  if (arm?.aplicavel) {
    verificacoes.push(...arm.verificacoes);
    if (!Nk) avisos.push('Sem carga de trabalho: a armadura foi calculada para a carga admissível da estaca.');
  }
  if (arm) avisos.push(...arm.avisos);
  const memorial = [
    { titulo: 'Estaca', linhas: [
      `${t.nome}, ${el.secao === 'quadrada' ? 'seção quadrada' : 'diâmetro'} ${f(el.D, 0)} cm: U = ${f(g.U, 3)} m, Ap = ${f(g.Ap, 4)} m²; comprimento ${f(el.L)} m, topo a ${f(el.topo)} m do terreno.`,
      `Furo ${furo.codigo}${distancia != null ? ` (a ${f(distancia)} m)` : ''}, boca na cota ${f(an.cotaBoca)}: topo a ${f(topoFuro)} m e ponta a ${f(pontaFuro)} m de profundidade no furo; ponta em ${r.soloPonta.av.replace('-', ' ')}.`,
    ] },
    { titulo: 'Aoki-Velloso (1975)', linhas: [
      `F1 = ${f(r.av.F1)}, F2 = 2·F1 = ${f(r.av.F2)} (Cintra e Aoki, 2010). Ponta: K = ${f(r.av.K / 1000)} MPa, Np = ${f(r.av.Np, 0)} → rp = K·Np/F1 = ${f(r.av.rp, 1)} kPa, Rp = ${f(r.av.Rp, 1)} kN.`,
      `Atrito: Σ U·α·K·Nl/F2·Δl = ${f(r.av.Rl, 1)} kN. R = ${f(r.av.R, 1)} kN → Padm = R/${f(FS_SEMIEMPIRICO, 1)} = ${f(r.av.R / FS_SEMIEMPIRICO, 1)} kN${r.av.adm.limitePonta ? `, limitada a 1,25·Rl/2 = ${f(r.av.adm.P, 1)} kN (escavada: ponta ≤ 20 % da carga admissível)` : ''}.`,
    ] },
    { titulo: 'Décourt-Quaresma (1978, 1996)', linhas: [
      `Ponta: Np = ${f(r.dq.Np, 1)} (média da ponta, 1 m acima e 1 m abaixo), C = ${f(r.dq.C, 0)} kPa, α = ${f(r.dq.alfa)} → rp = ${f(r.dq.rp, 1)} kPa, Rp = ${f(r.dq.Rp, 1)} kN.`,
      `Atrito: Nl = ${f(r.dq.Nl, 1)} (3 ≤ N ≤ 50), β = ${f(r.dq.beta)} → rl = β·10·(Nl/3 + 1) = ${f(r.dq.rl, 1)} kPa em ${f(r.dq.comprimentoAtrito)} m: Rl = ${f(r.dq.Rl, 1)} kN. R = ${f(r.dq.R, 1)} kN → Padm = ${f(r.dq.adm.P, 1)} kN${r.dq.adm.limitePonta ? ' (limitada pela ponta das escavadas)' : ''}.`,
    ] },
    { titulo: 'Carga admissível adotada', linhas: [
      `Fator de segurança global ${f(FS_SEMIEMPIRICO, 1)} para métodos semiempíricos (NBR 6122). Geotécnica: ${f(Pgeo, 1)} kN (o menor dos dois métodos)${estrut ? `; estrutural: ${f(estrut, 1)} kN${t.fck ? ` (0,85·fck/γc·A/1,4 com fck = ${f(el.estrutural?.fck ?? t.fck, 0)} MPa e γc = ${f(el.estrutural?.gc ?? t.gc, 1)})` : ' (catálogo)'}` : ''}. Adotada: ${f(Padm, 1)} kN (${governa}).`,
      Nk ? `Carga de trabalho: ${f(Nk, 1)} kN (${origemCarga}).` : 'Sem carga de trabalho informada.',
    ] },
    ...(arm?.aplicavel ? [{ titulo: 'Armadura da estaca (NBR 6122:2019, 8.6.3 e Tabela 4)', linhas: arm.memorial }] : []),
  ];

  return {
    ok: verificacoes.every((v) => v.ok),
    avisos, verificacoes, memorial,
    nomeTipo: t.nome, D: el.D, secao: el.secao, L: el.L, topo: el.topo,
    furo: { id: furo.id, codigo: furo.codigo, distancia: distancia != null ? r2(distancia) : null }, topoFuro: r2(topoFuro), pontaFuro: r2(pontaFuro), cotaBoca: an.cotaBoca,
    U: r2(g.U * 1000) / 1000, Ap: Math.round(g.Ap * 1e5) / 1e5,
    av: { F1: Math.round(r.av.F1 * 1000) / 1000, F2: Math.round(r.av.F2 * 1000) / 1000, Np: r.av.Np, rp: r1(r.av.rp), Rp: r1(r.av.Rp), Rl: r1(r.av.Rl), R: r1(r.av.R), Padm: r1(r.av.adm.P), limitePonta: r.av.adm.limitePonta },
    dq: { Np: r2(r.dq.Np), Nl: r2(r.dq.Nl), C: r.dq.C, alfa: r.dq.alfa, beta: r2(r.dq.beta), rp: r1(r.dq.rp), rl: r1(r.dq.rl), Rp: r1(r.dq.Rp), Rl: r1(r.dq.Rl), R: r1(r.dq.R), Padm: r1(r.dq.adm.P), limitePonta: r.dq.adm.limitePonta },
    estrutural: estrut != null ? r1(estrut) : null, Padm: r1(Padm), governa, Nk: Nk != null ? r1(Nk) : null, origemCarga, Lmin,
    trechos: r.trechos.map((x) => ({ de: r2(x.de), ate: r2(x.ate), N: x.N, solo: x.solo.av, semAtrito: x.solo.semAtrito, rlAV: r1(x.rlAV), ponta: x.usadoPontaDQ })),
    armadura: arm?.aplicavel ? resumoArmaduraEstaca(arm) : null,
    detalhamento: arm?.aplicavel && arm.posicoes.length ? { posicoes: arm.posicoes, avisos: [], verificacoes: [] } : null,
    perfilAtrito: atrito,
    curva, camadas: an.camadas.map((c) => ({ de: c.de, ate: c.ate, solo: c.solo, nome: c.nome })), nivelAgua: an.nivelAgua, limiteFuro: an.limite,
  };
}

/**
 * Atrito lateral último por trecho do fuste (kN), a partir do topo: o menor entre Aoki-Velloso e Décourt-Quaresma,
 * para a queda da carga ao longo da estaca (comprimento armado).
 */
export function perfilAtrito(r) {
  const U = r.geometria.U;
  return r.trechos.map((x) => {
    const av = x.solo.semAtrito ? 0 : U * x.rlAV * x.dl;
    const dq = x.solo.semAtrito || x.usadoPontaDQ ? 0 : U * r.dq.rl * x.dl;
    return { de: Math.round((x.de - r.topo) * 1000) / 1000, ate: Math.round((x.ate - r.topo) * 1000) / 1000, R: Math.min(av, dq) };
  });
}

/** Saída compacta da armadura da estaca. */
export function resumoArmaduraEstaca(a) {
  const r2 = (v) => Math.round(v * 100) / 100 || 0;
  return {
    sigma: r2(a.sigma), sigmaLim: a.sigmaLim, precisa: a.precisa, fck: a.fck, gc: a.gc, Nk: r2(a.Nk), Nd: r2(a.Nd),
    AsMin: r2(a.AsMin), AsNec: r2(a.AsNec), As: r2(a.As), Larm: a.Larm, Lmin: a.Lmin,
    barras: a.barras && { n: a.barras.n, phi: a.barras.phi, AsEf: r2(a.barras.AsEf), rotulo: `${a.barras.n} ø ${String(a.barras.phi).replace('.', ',')}` },
    estribo: { ...a.estribo, rotulo: `ø ${String(a.estribo.phi).replace('.', ',')} c/ ${String(a.estribo.s).replace('.', ',')}` }, espera: Math.round(a.espera),
  };
}
