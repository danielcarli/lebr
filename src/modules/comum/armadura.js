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
 * Escolha das bitolas pelo usuário — comum aos módulos de concreto armado.
 *
 * Cada elemento guarda em `armadura` a bitola de cada posição (em mm) ou 'auto',
 * quando o programa escolhe a de menor consumo que atende às regras da norma.
 * Ex.: { inferior: 'auto', superior: 12.5, estribo: 6.3 }.
 */
import { BITOLAS_USO, bitolaFixa, fmtPhi } from '../../engine/barras.js';
import { CRITERIOS, otimizavel, POSICOES_OTIMIZAVEIS, limiteAcoDe } from './otimizacao.js';

/** Bitola fixa (mm) de uma posição, ou null se automática. */
export const bitolaDe = (el, chave) => bitolaFixa(el?.armadura?.[chave]);

/** Texto curto de uma posição: "ø 10 (escolhida)" ou "automática". */
export const descreverBitola = (el, chave) => {
  const phi = bitolaDe(el, chave);
  return phi ? `ø ${fmtPhi(phi)} mm (escolhida)` : 'automática';
};

/**
 * Seção "Armadura" com um seletor por posição.
 * @param {object} api
 * @param {object} ctx  contexto do editor do elemento
 * @param {{chave:string, rotulo:string, uso:keyof BITOLAS_USO, dica?:string}[]} campos
 * @param {{descricao?:string, padrao?:object}} [op]  padrao: valores de armadura a manter ao gravar
 */
/**
 * A otimização não muda esforços nem reações: os elementos que recebem as cargas deste continuam valendo. A exceção é
 * a fundação sob um pilar, porque a bitola longitudinal do pilar entra na ancoragem das esperas na sapata ou no bloco.
 */
export const invalidarAoOtimizar = () => false;
const FUNDACOES = ['concreto.sapata', 'concreto.bloco'];
export function fundacoesDesatualizadas(projeto, el) {
  if (el?.modulo !== 'concreto.pilar') return;
  for (const x of projeto?.elementos ?? []) {
    if (FUNDACOES.includes(x.modulo) && x.resultado && Array.isArray(x.cargas) && x.cargas.some((c) => c.tipo === 'elemento' && c.elementoId === el.id)) x.resultado.desatualizado = true;
  }
}

export function secaoArmadura(api, ctx, campos, { descricao, padrao = {} } = {}) {
  const { ui, formatar: { num } } = api;
  const { h } = api.dom;
  const el = ctx.elemento;
  const res = el.resultado && !el.resultado.erro && !el.resultado.desatualizado ? el.resultado : null;
  const ot = res?.otimizacao && res.otimizacao.criterio === el.otimizacao ? res.otimizacao : null;
  const valorAtual = (chave) => {
    const phi = bitolaDe(el, chave);
    return phi ?? 'auto';
  };
  const mudar = (chave, v) => ctx.alterar((e) => {
    const base = Object.fromEntries(campos.map((c) => [c.chave, e.armadura?.[c.chave] ?? 'auto']));
    e.armadura = { ...padrao, ...e.armadura, ...base, [chave]: v };
  }, { descricao: 'Alterar bitola' });
  const phiTxt = (p) => `ø ${num(p, p % 1 ? 1 : 0)}`;
  // "Automática" mostra a bitola que a otimização adotou para a posição
  const textoAuto = (chave) => {
    const v = ot?.escolha?.[chave];
    return v != null && v !== 'auto' ? `Otimizada: ${phiTxt(v)} mm` : 'Automática';
  };

  const filhos = [ui.linhaCampos(...campos.map((c) => ui.selecao({
    rotulo: c.rotulo, valor: valorAtual(c.chave), largura: '190px',
    opcoes: [{ valor: 'auto', texto: textoAuto(c.chave) }, ...BITOLAS_USO[c.uso].map((p) => ({ valor: p, texto: `${phiTxt(p)} mm` }))],
    aoMudar: (v) => mudar(c.chave, v),
  })))];

  if (otimizavel(el.modulo)) {
    const criterio = CRITERIOS[el.otimizacao] ? el.otimizacao : '';
    const definir = (v) => {
      ctx.alterar((e, proj) => { if (v) e.otimizacao = v; else delete e.otimizacao; fundacoesDesatualizadas(proj, e); }, { descricao: v ? `Otimizar (${CRITERIOS[v].curto})` : 'Sem otimização', invalidar: invalidarAoOtimizar(el) });
      ctx.calcular?.();
    };
    const limite = criterio === 'segmentos' ? ui.campo({
      rotulo: 'Aço a mais aceito', valor: limiteAcoDe(el), unidade: '%', casas: 0, min: 0, max: 300, largura: '150px',
      dica: 'Quanto de aço, acima do peso da escolha automática, se aceita para reduzir o número de segmentos de barra',
      aoMudar: (v) => { ctx.alterar((e, proj) => { e.otimizacaoLimiteAco = v; fundacoesDesatualizadas(proj, e); }, { descricao: 'Acréscimo de aço aceito', invalidar: invalidarAoOtimizar(el) }); ctx.calcular?.(); },
    }) : null;
    filhos.push(ui.linhaCampos(ui.segmentado({
      rotulo: 'Otimização', valor: criterio,
      opcoes: [
        { valor: '', texto: 'Nenhuma', dica: 'Cada posição em “Automática” escolhe a sua bitola, sem olhar para as outras' },
        { valor: 'bitolas', texto: CRITERIOS.bitolas.nome, dica: CRITERIOS.bitolas.dica },
        { valor: 'aco', texto: CRITERIOS.aco.nome, dica: CRITERIOS.aco.dica },
        { valor: 'segmentos', texto: CRITERIOS.segmentos.nome, dica: CRITERIOS.segmentos.dica },
      ],
      aoMudar: definir,
    })));
    if (limite) filhos.push(ui.linhaCampos(limite));
    if (criterio) filhos.push(resumoOtimizacao());
  }

  return ui.secao({
    numero: '', titulo: 'Armadura',
    descricao: descricao ?? 'Bitolas das barras — “Automática” escolhe a de menor consumo que atende à norma',
    filhos,
  });

  function resumoOtimizacao() {
    if (!ot) return h('p', { class: 'otm-resumo pendente' }, 'Calcule o elemento (F5) para buscar a combinação de bitolas.');
    const lista = (b) => (b.length ? b.map((p) => phiTxt(p)).join(' · ') : '—');
    const kg = (v) => `${num(v ?? 0, 1)} kg`;
    const segs = (n) => (n == null ? '—' : `${num(n, 0)} segmento${n === 1 ? '' : 's'}`);
    const dif = ot.base.kg > 0 && ot.kg != null ? (ot.kg / ot.base.kg - 1) * 100 : 0;
    const difTxt = Math.abs(dif) < 0.05 ? 'mesmo peso' : `${dif > 0 ? '+' : '−'}${num(Math.abs(dif), 1)}% de aço`;
    const nomes = Object.fromEntries((POSICOES_OTIMIZAVEIS[el.modulo] ?? []).map((p) => [p.chave, p.rotulo]));
    const adotadas = Object.entries(ot.escolha).filter(([, v]) => v !== 'auto');
    const fixar = () => {
      ctx.alterar((e, proj) => {
        e.armadura = { ...padrao, ...e.armadura, ...Object.fromEntries(campos.map((c) => [c.chave, e.armadura?.[c.chave] ?? 'auto'])), ...ot.escolha };
        delete e.otimizacao;
        fundacoesDesatualizadas(proj, e);
      }, { descricao: 'Fixar as bitolas otimizadas', invalidar: invalidarAoOtimizar(el) });
      ctx.calcular?.();
    };
    if (ot.semAlternativa) {
      return h('p', { class: 'otm-resumo falha' }, `Nenhuma das ${ot.avaliadas} combinações de bitolas atende a todas as verificações — vale o cálculo automático. Revise a seção ou os materiais.`);
    }
    return h('div', { class: 'otm-resumo' },
      h('div', { class: 'otm-colunas' },
        h('div', { class: 'otm-col' },
          h('span', { class: 'otm-rot' }, 'Sem otimização'),
          h('strong', null, `${ot.base.bitolas.length} bitola${ot.base.bitolas.length === 1 ? '' : 's'} · ${kg(ot.base.kg)}`),
          h('span', { class: 'otm-phis' }, `${lista(ot.base.bitolas)} · ${segs(ot.base.segmentos)}`)),
        h('div', { class: 'otm-seta' }, '→'),
        h('div', { class: 'otm-col destaque' },
          h('span', { class: 'otm-rot' }, CRITERIOS[ot.criterio].nome),
          h('strong', null, ot.criterio === 'segmentos' ? `${segs(ot.segmentos)} · ${kg(ot.kg)}` : `${ot.bitolas.length} bitola${ot.bitolas.length === 1 ? '' : 's'} · ${kg(ot.kg)}`),
          h('span', { class: 'otm-phis' }, `${lista(ot.bitolas)} · ${ot.criterio === 'segmentos' ? '' : `${segs(ot.segmentos)} · `}${difTxt}`))),
      h('p', { class: 'otm-nota' },
        ot.melhorou
          ? `${ot.criterio === 'segmentos' ? `Até ${num(ot.limiteAco, 0)} % a mais de aço aceito. ` : ''}Adotadas: ${adotadas.length ? adotadas.map(([k, v]) => `${nomes[k] ?? k} ${phiTxt(v)}`).join(', ') : 'as bitolas automáticas'} · ${ot.avaliadas} combinações calculadas, todas as verificações atendidas. Peso pela lista de ferros, sem perdas.`
          : `A escolha automática já é a melhor para este critério${ot.criterio === 'segmentos' ? `, dentro de ${num(ot.limiteAco, 0)} % a mais de aço` : ''} (${ot.avaliadas} combinações calculadas).`),
      ot.melhorou && adotadas.length ? h('div', { class: 'otm-acoes' }, ui.botao({ texto: 'Fixar estas bitolas', icone: 'check', aoClicar: fixar, titulo: 'Grava as bitolas adotadas nas posições e desliga a otimização' })) : null,
    );
  }
}
