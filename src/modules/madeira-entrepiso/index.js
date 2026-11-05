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
 * Módulo: Entrepiso de madeira — light wood frame (NBR 16936:2023 · NBR 7190-1:2022)
 */
import { camposCargasLaje } from '../comum/cargas-laje.js';
import { calcularEntrepiso, cargasTransmitidas, ligacoes, criarEntrepiso, cargasEntrepiso, PAINEIS } from './calculo.js';
import { criarDesenhosLajes } from '../comum/desenho-lajes.js';
import { criarPlantaLaje } from '../comum/planta-laje.js';
import { bordasFaixa } from '../comum/bordas.js';
import { criarDesenhosMadeira } from '../madeira-comum/desenho.js';
import { secaoMaterial, materialDoElemento } from '../madeira-comum/material.js';

export default function moduloEntrepiso(api) {
  const { h } = api.dom;
  const ui = api.ui;
  const { num } = api.formatar;
  const dLaje = criarDesenhosLajes(api.dom);
  const dMad = criarDesenhosMadeira(api.dom);
  const pl = criarPlantaLaje(api);

  return {
    id: 'madeira.entrepiso',
    nome: 'Entrepiso de madeira (light wood frame)',
    nomeCurto: 'Entrepiso de madeira',
    categoria: 'lajes',
    prefixo: 'EM',
    sigla: 'ML1',
    icone: 'madeira',
    forma: 'laje', // ícone do tipo de elemento no cabeçalho
    material: 'Madeira',
    norma: 'NBR 16936:2023 · NBR 7190-1:2022',
    versao: '0.2.0',
    descricao: 'Vigotas sob painel OSB ou compensado: flexão, cisalhamento, apoio, flecha com fluência e frequência; bordas apoiadas, engastadas ou em balanço.',

    criar: criarEntrepiso,
    calcular: calcularEntrepiso,
    cargasTransmitidas,
    ligacoes,
    resumo: (el) => `${el.classe} · vigotas ${num(el.vigota.b, 1)} × ${num(el.vigota.h, 1)} c/ ${num(el.espacamento, 0)} · vão ${num(el.L)} m`,

    renderEntrada(raiz, ctx) {
      const el = ctx.elemento;
      const esquema = h('div', { class: 'esquema-slot' });
      const corte = h('div', { class: 'desenho-caixa' });
      const plantaSlot = h('div', { class: 'planta-slot' });
      const mudarBorda = (id, v) => ctx.alterar((e) => { e.bordas = { ...bordasFaixa(e), [id]: v }; delete e.vinculo; }, { estrutural: true });
      const desenhar = () => {
        const e = ctx.elemento;
        const b = bordasFaixa(e);
        esquema.replaceChildren(dLaje.esquemaFaixa({ L: e.L, bordas: b }));
        plantaSlot.replaceChildren(pl.planta({ lx: e.L, ly: e.largura, bordas: b, codigo: e.codigo, nervuras: 'x', passo: e.espacamento / 100,
          aoAlternar: (id) => mudarBorda(id, pl.proximo(id, b[id], { umaDirecao: true })) }));
        corte.replaceChildren(dMad.corteEntrepiso({ b: e.vigota.b, h: e.vigota.h, s: e.espacamento, painel: e.painel.espessura }));
      };
      desenhar();
      const mudar = (fn, op) => { ctx.alterar(fn, op); desenhar(); };

      raiz.append(secaoMaterial(api, ctx, { numero: '01' }));
      raiz.append(ui.secao({
        numero: '02', titulo: 'Vão e bordas', descricao: 'As vigotas vencem o vão L (direção x) · clique numa borda para alternar o vínculo',
        filhos: [
          h('div', { class: 'laje-geo' },
            h('div', { class: 'laje-campos' },
              ui.linhaCampos(
                ui.campo({ rotulo: 'Vão L', valor: el.L, unidade: 'm', min: 0.5, max: 8, dica: 'Em balanço, é o comprimento do balanço', aoMudar: (v) => mudar((e) => { e.L = v; }) }),
                ui.campo({ rotulo: 'Largura do piso', valor: el.largura, unidade: 'm', min: 0.3, max: 30, dica: 'Usada para contar as vigotas', aoMudar: (v) => mudar((e) => { e.largura = v; }) }),
              ),
              pl.seletores(bordasFaixa(el), mudarBorda, { umaDirecao: true }),
              pl.aviso(bordasFaixa(el), { umaDirecao: true, textoBalanco: 'Vigotas em balanço: engaste por vigota contínua sobre o apoio ou ligação rígida.' }),
            ),
            plantaSlot,
          ),
          esquema,
        ],
      }));

      raiz.append(ui.secao({
        numero: '03', titulo: 'Vigotas e painel',
        filhos: [
          ui.linhaCampos(
            ui.campo({ rotulo: 'Vigota b', valor: el.vigota.b, unidade: 'cm', casas: 1, min: 2, max: 30, aoMudar: (v) => mudar((e) => { e.vigota.b = v; }) }),
            ui.campo({ rotulo: 'Vigota h', valor: el.vigota.h, unidade: 'cm', casas: 1, min: 5, max: 60, aoMudar: (v) => mudar((e) => { e.vigota.h = v; }) }),
            ui.selecao({ rotulo: 'Espaçamento', valor: el.espacamento, largura: '120px', opcoes: [30, 40, 50, 60].map((v) => ({ valor: v, texto: `${v} cm` })), aoMudar: (v) => mudar((e) => { e.espacamento = v; }, { estrutural: true }) }),
            ui.campo({ rotulo: 'Apoio c', valor: el.apoioC, unidade: 'cm', casas: 1, min: 2, max: 30, dica: 'Comprimento de apoio da vigota', aoMudar: (v) => ctx.alterar((e) => { e.apoioC = v; }) }),
            ui.campo({ rotulo: 'Bloqueadores a cada', valor: el.bloqueio, unidade: 'm', min: 0.2, max: 8, largura: '150px', dica: 'Travam a borda inferior (relevante com momento negativo)', aoMudar: (v) => ctx.alterar((e) => { e.bloqueio = v; }) }),
          ),
          ui.linhaCampos(
            ui.selecao({ rotulo: 'Painel', valor: el.painel.tipo, largura: '200px', opcoes: Object.entries(PAINEIS).map(([k, v]) => ({ valor: k, texto: v.nome })), aoMudar: (v) => mudar((e) => { e.painel.tipo = v; e.painel.peso = PAINEIS[v].peso; }, { estrutural: true }) }),
            ui.campo({ rotulo: 'Espessura', valor: el.painel.espessura, unidade: 'mm', casas: 1, min: 6, max: 40, aoMudar: (v) => mudar((e) => { e.painel.espessura = v; }) }),
            ui.campo({ rotulo: 'Peso do painel', valor: el.painel.peso, unidade: 'kN/m³', min: 1, max: 12, largura: '140px', aoMudar: (v) => ctx.alterar((e) => { e.painel.peso = v; }) }),
          ),
          corte,
        ],
      }));

      const { m } = materialDoElemento(el, ctx.projeto.parametros);
      const cg = cargasEntrepiso(el, m);
      const cl = camposCargasLaje(api, ctx, { forro: false, larguraCampo: '140px' });
      raiz.append(ui.secao({
        numero: '04', titulo: 'Cargas', descricao: 'Valores característicos por m²',
        filhos: [
          ui.linhaCampos(cl.uso),
          ui.linhaCampos(
            cl.revestimento,
            ui.campo({ rotulo: 'Forro', valor: el.cargas.forro, unidade: 'kN/m²', min: 0, largura: '140px', aoMudar: (v) => ctx.alterar((e) => { e.cargas.forro = v; }) }),
            ui.campo({ rotulo: 'Outras permanentes', valor: el.cargas.outras, unidade: 'kN/m²', min: 0, largura: '150px', dica: 'Divisórias leves, instalações', aoMudar: (v) => ctx.alterar((e) => { e.cargas.outras = v; }) }),
            cl.acidental,
            ui.alternar({ rotulo: `Peso próprio (${num(cg.pp)} kN/m²)`, valor: el.pesoProprio, aoMudar: (v) => ctx.alterar((e) => { e.pesoProprio = v; }, { estrutural: true }) }),
          ),
          ...cl.composicao,
          h('div', { class: 'cargas-resumo' }, h('span', { class: 'rot' }, 'Total característico'), `g = ${num(cg.g)} kN/m² · q = ${num(cg.q)} kN/m²`),
        ],
      }));
    },

    renderResultado(raiz, res) {
      raiz.append(h('div', { class: 'instrumentos' },
        ui.arco({ rotulo: 'Flexão da vigota', valor: `${num(res.usoFlexao * 100, 0)}%`, fracao: res.usoFlexao, legenda: 'σM,d / fm,d' }),
        ui.medidor({ rotulo: 'Flecha final', valor: `${num(res.flecha.ufin, 1)} mm`, fracao: res.flecha.ufin / res.flecha.lim, legenda: `limite ${num(res.flecha.lim, 1)} mm · com fluência` }),
        res.f1 != null
          ? ui.numeroGrande({ rotulo: 'Frequência natural', valor: num(res.f1, 1), unidade: 'Hz', linhas: ['Recomendado ≥ 8 Hz', `Cisalhamento ${num(res.usoCis * 100, 0)}%`], alerta: res.f1 < 8 })
          : ui.arco({ rotulo: 'Cisalhamento', valor: `${num(res.usoCis * 100, 0)}%`, fracao: res.usoCis, legenda: 'τd / fv,d' }),
        ui.numeroGrande({ rotulo: 'Vigotas', valor: String(res.vigotas), unidade: 'un', linhas: [`Classe ${res.classe}`, `pp ${num(res.cargas.pp)} kN/m²`] }),
      ));
      raiz.append(ui.secao({
        numero: '06', titulo: 'Reações nas vigas', descricao: 'Por metro de viga ou travessa de apoio',
        filhos: [ui.tabela({
          colunas: [{ titulo: 'Borda' }, { titulo: 'Vínculo' }, { titulo: 'g,k (kN/m)', alinhar: 'dir' }, { titulo: 'q,k (kN/m)', alinhar: 'dir' }, { titulo: 'Cálculo (kN/m)', alinhar: 'dir' }, { titulo: 'Por vigota (kN)', alinhar: 'dir' }],
          linhas: res.reacoes.map((r) => [r.nome, r.tipo ?? 'apoiada', num(r.g), num(r.q), num(r.d), num(r.porVigota)]),
        })],
      }));
    },
  };
}
