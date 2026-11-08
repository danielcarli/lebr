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
 * ESQUELETO DE MÓDULO EXTERNO — Laje treliçada (exemplo didático)
 *
 * Mostra como um módulo novo entra no LEBR sem tocar no código
 * principal. Para instalar: copie esta pasta para a pasta de módulos
 * externos (menu Módulos → Abrir pasta de módulos externos) e reinicie.
 *
 * ATENÇÃO: o cálculo abaixo é uma simplificação ilustrativa (nervura como
 * viga biapoiada de seção retangular equivalente). Não usar em projeto
 * real sem implementar as verificações da NBR 6118 e da NBR 14859.
 *
 * O módulo só usa o que recebe em `api` — nenhum import de arquivos internos.
 */
export default function moduloLajeTrelicada(api) {
  const { h } = api.dom;
  const ui = api.ui;
  const { num } = api.formatar;
  const { dimensionarFlexao } = api.motor.flexao;

  return {
    id: 'exemplo.esqueleto',
    nome: 'Esqueleto de módulo (exemplo)',
    nomeCurto: 'Esqueleto',
    categoria: 'lajes',            // aparece no grupo "Lajes" do explorador
    prefixo: 'EX',                 // códigos EX1, EX2…
    sigla: 'XE1',                  // 3 letras/algarismos no cabeçalho (material + tipo + nº); opcional
    icone: 'laje',
    material: 'Concreto armado',
    norma: 'NBR 6118 · NBR 14859',
    versao: '0.0.1',
    descricao: 'Exemplo de módulo externo. Cálculo simplificado, apenas para demonstração.',

    /** Dados iniciais gravados no JSON do projeto. */
    criar: () => ({ vao: 4, altura: 12, capa: 4, intereixo: 42, cargas: { g: 1.5, q: 1.5 } }),

    /** Linha de resumo no explorador e no cabeçalho. */
    resumo: (el) => `Vão ${num(el.vao)} m · h = ${num(el.altura, 0)} cm`,

    /** Bordas que transmitem carga às vigas (opcional). */
    ligacoes: () => [{ id: 'apoio-a', nome: 'Apoio inicial', tipo: 'linear' }, { id: 'apoio-b', nome: 'Apoio final', tipo: 'linear' }],
    cargasTransmitidas: (el) => {
      const pp = 25 * (el.capa / 100) + 1.2; // estimativa grosseira (capa + enchimento)
      const g = (pp + el.cargas.g) * el.vao / 2, q = el.cargas.q * el.vao / 2;
      return { 'apoio-a': { g, q }, 'apoio-b': { g, q } };
    },

    /** Cálculo: recebe o elemento e o contexto (materiais, parâmetros…). Deve ser puro. */
    calcular(el, ctx) {
      const { concreto: c, aco: s, gg, gq } = ctx.materiais;
      const pp = 25 * (el.capa / 100) + 1.2;
      const pd = gg * (pp + el.cargas.g) + gq * el.cargas.q;     // kN/m²
      const Md = (pd * (el.intereixo / 100) * el.vao ** 2) / 8;  // por nervura
      const d = el.altura + el.capa - 2.5;
      const flex = dimensionarFlexao({ Md, b: el.intereixo, h: el.altura + el.capa, d, c, s });
      const okLinha = flex.x * c.lambda <= el.capa; // linha neutra na capa
      return {
        ok: okLinha && flex.ok,
        avisos: ['Módulo de exemplo — cálculo simplificado, não usar em projeto.'],
        verificacoes: [
          { nome: 'Linha neutra na capa', item: '—', valor: `${num(flex.x * c.lambda)} cm`, limite: `≤ ${num(el.capa)} cm`, ok: okLinha },
        ],
        memorial: [{ titulo: 'Nervura', linhas: [`pd = ${num(pd)} kN/m² · Md = ${num(Md)} kN·m por nervura · As = ${num(flex.As)} cm²`] }],
        Md, As: flex.As,
      };
    },

    renderEntrada(raiz, ctx) {
      const el = ctx.elemento;
      raiz.append(ui.secao({
        numero: '01', titulo: 'Geometria',
        filhos: [ui.linhaCampos(
          ui.campo({ rotulo: 'Vão', valor: el.vao, unidade: 'm', min: 1, max: 9, aoMudar: (v) => ctx.alterar((e) => { e.vao = v; }) }),
          ui.campo({ rotulo: 'Altura da vigota', valor: el.altura, unidade: 'cm', min: 8, max: 30, aoMudar: (v) => ctx.alterar((e) => { e.altura = v; }) }),
          ui.campo({ rotulo: 'Capa', valor: el.capa, unidade: 'cm', min: 3, max: 8, aoMudar: (v) => ctx.alterar((e) => { e.capa = v; }) }),
          ui.campo({ rotulo: 'Intereixo', valor: el.intereixo, unidade: 'cm', min: 30, max: 60, aoMudar: (v) => ctx.alterar((e) => { e.intereixo = v; }) }),
        )],
      }));
      raiz.append(ui.secao({
        numero: '02', titulo: 'Cargas',
        filhos: [ui.linhaCampos(
          ui.campo({ rotulo: 'Permanente', valor: el.cargas.g, unidade: 'kN/m²', min: 0, aoMudar: (v) => ctx.alterar((e) => { e.cargas.g = v; }) }),
          ui.campo({ rotulo: 'Acidental', valor: el.cargas.q, unidade: 'kN/m²', min: 0, aoMudar: (v) => ctx.alterar((e) => { e.cargas.q = v; }) }),
        )],
      }));
    },

    renderResultado(raiz, res) {
      raiz.append(h('div', { class: 'instrumentos' },
        ui.numeroGrande({ rotulo: 'Momento por nervura', valor: num(res.Md), unidade: 'kN·m', linhas: ['As necessária', `${num(res.As)} cm²`] }),
      ));
    },
  };
}
