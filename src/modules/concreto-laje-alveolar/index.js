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
 * Módulo: Laje alveolar pré-fabricada protendida (NBR 14861 · NBR 6118:2023)
 */
import { camposCargasLaje } from '../comum/cargas-laje.js';
import { calcularLajeAlveolar, cargasTransmitidas, ligacoes, criarLajeAlveolar, cargasAlveolar } from './calculo.js';
import { criarDesenhosLajes } from '../comum/desenho-lajes.js';
import { criarPlantaLaje } from '../comum/planta-laje.js';
import { bordasFaixa } from '../comum/bordas.js';

export default function moduloLajeAlveolar(api) {
  const { h } = api.dom;
  const ui = api.ui;
  const { num } = api.formatar;
  const desenho = criarDesenhosLajes(api.dom);
  const pl = criarPlantaLaje(api);

  return {
    id: 'concreto.laje.alveolar',
    nome: 'Laje alveolar',
    nomeCurto: 'Laje alveolar',
    categoria: 'lajes',
    prefixo: 'LA',
    sigla: 'CL4',
    icone: 'laje',
    material: 'Concreto protendido',
    norma: 'NBR 14861 · NBR 6118:2023',
    versao: '0.2.0',
    descricao: 'Painéis protendidos: verifica o vão contra MRd, VRd e EI do catálogo do fabricante; extremidades apoiadas, engastadas ou em balanço.',

    criar: criarLajeAlveolar,
    calcular: calcularLajeAlveolar,
    cargasTransmitidas,
    ligacoes,
    resumo: (el) => `Painel h = ${num(el.painel.h, 0)} cm · vão ${num(el.L)} m`,

    renderEntrada(raiz, ctx) {
      const el = ctx.elemento;
      const corte = h('div', { class: 'desenho-caixa' });
      const esquema = h('div', { class: 'esquema-slot' });
      const plantaSlot = h('div', { class: 'planta-slot' });
      const mudarBorda = (id, v) => ctx.alterar((e) => { e.bordas = { ...bordasFaixa(e), [id]: v }; }, { estrutural: true });
      const desenhar = () => {
        const e = ctx.elemento;
        const b = bordasFaixa(e);
        corte.replaceChildren(desenho.corteAlveolar({ h: e.painel.h, capa: e.capa, larguraPainel: e.painel.larguraPainel, alveolos: e.painel.alveolos }));
        esquema.replaceChildren(desenho.esquemaFaixa({ L: e.L, bordas: b }));
        plantaSlot.replaceChildren(pl.planta({ lx: e.L, ly: e.largura, bordas: b, codigo: e.codigo, nervuras: 'x', passo: e.painel.larguraPainel / 100,
          aoAlternar: (id) => mudarBorda(id, pl.proximo(id, b[id], { umaDirecao: true })) }));
      };
      desenhar();
      const mudar = (fn, op) => { ctx.alterar(fn, op); desenhar(); };
      const P = el.painel;

      raiz.append(ui.secao({
        numero: '01', titulo: 'Vão e bordas', descricao: 'Os painéis vencem o vão L (direção x) · clique numa borda para alternar o vínculo',
        filhos: [
          h('div', { class: 'laje-geo' },
            h('div', { class: 'laje-campos' },
              ui.linhaCampos(
                ui.campo({ rotulo: 'Vão L', valor: el.L, unidade: 'm', min: 1, max: 20, dica: 'Em balanço, é o comprimento do balanço', aoMudar: (v) => mudar((e) => { e.L = v; }) }),
                ui.campo({ rotulo: 'Largura da laje', valor: el.largura, unidade: 'm', min: 0.5, max: 60, dica: 'Usada para contar os painéis', aoMudar: (v) => mudar((e) => { e.largura = v; }) }),
              ),
              ui.linhaCampos(
                ui.campo({ rotulo: 'Comprimento de apoio', valor: el.apoio, unidade: 'cm', casas: 1, min: 0, max: 40, largura: '160px', aoMudar: (v) => ctx.alterar((e) => { e.apoio = v; }) }),
                ui.campo({ rotulo: 'Capa', valor: el.capa, unidade: 'cm', casas: 1, min: 0, max: 15, dica: '0 = sem capa', aoMudar: (v) => mudar((e) => { e.capa = v; }) }),
              ),
              pl.seletores(bordasFaixa(el), mudarBorda, { umaDirecao: true }),
              pl.aviso(bordasFaixa(el), { umaDirecao: true, textoBalanco: 'Balanço em laje alveolar: informe o MRd− da armadura negativa (capa armada ou alvéolos preenchidos) e confirme com o fabricante.' }),
            ),
            plantaSlot,
          ),
          esquema,
        ],
      }));

      raiz.append(ui.secao({
        numero: '02', titulo: 'Painel (dados do fabricante)', descricao: 'Copie do catálogo: os valores iniciais são apenas um exemplo',
        filhos: [
          ui.linhaCampos(
            ui.texto({ rotulo: 'Designação', valor: P.nome, largura: '300px', aoMudar: (v) => ctx.alterar((e) => { e.painel.nome = v; }) }),
            ui.campo({ rotulo: 'Altura h', valor: P.h, unidade: 'cm', casas: 1, min: 8, max: 60, aoMudar: (v) => mudar((e) => { e.painel.h = v; }) }),
            ui.campo({ rotulo: 'Largura do painel', valor: P.larguraPainel, unidade: 'cm', casas: 0, min: 40, max: 250, largura: '150px', aoMudar: (v) => mudar((e) => { e.painel.larguraPainel = v; }) }),
            ui.campo({ rotulo: 'Alvéolos', valor: P.alveolos, casas: 0, min: 1, max: 20, largura: '100px', dica: 'Só para o desenho', aoMudar: (v) => mudar((e) => { e.painel.alveolos = Math.round(v); }) }),
          ),
          ui.linhaCampos(
            ui.campo({ rotulo: 'Peso próprio', valor: P.peso, unidade: 'kN/m²', min: 0.5, max: 10, largura: '150px', aoMudar: (v) => ctx.alterar((e) => { e.painel.peso = v; }) }),
            ui.campo({ rotulo: 'MRd', valor: P.MRd, unidade: 'kN·m/m', min: 1, largura: '150px', dica: 'Momento resistente de cálculo por metro', aoMudar: (v) => ctx.alterar((e) => { e.painel.MRd = v; }) }),
            ui.campo({ rotulo: 'MRd− (negativo)', valor: P.MRdNeg ?? 0, unidade: 'kN·m/m', min: 0, largura: '160px', dica: 'Armadura negativa na capa ou em alvéolos preenchidos — necessário com engaste ou balanço', aoMudar: (v) => ctx.alterar((e) => { e.painel.MRdNeg = v; }) }),
            ui.campo({ rotulo: 'VRd', valor: P.VRd, unidade: 'kN/m', min: 1, largura: '150px', dica: 'Cortante resistente de cálculo por metro', aoMudar: (v) => ctx.alterar((e) => { e.painel.VRd = v; }) }),
            ui.campo({ rotulo: 'Rigidez EI', valor: P.EI, unidade: 'kN·m²/m', casas: 0, min: 100, largura: '170px', aoMudar: (v) => ctx.alterar((e) => { e.painel.EI = v; }) }),
          ),
          corte,
        ],
      }));

      const cg = cargasAlveolar(el, ctx);
      const cl = camposCargasLaje(api, ctx);
      raiz.append(ui.secao({
        numero: '03', titulo: 'Cargas', descricao: 'Valores característicos por m², além do painel e da capa',
        filhos: [
          ui.linhaCampos(cl.uso),
          ui.linhaCampos(
            cl.revestimento,
            ui.campo({ rotulo: 'Outras permanentes', valor: el.cargas.outras, unidade: 'kN/m²', min: 0, largura: '150px', aoMudar: (v) => ctx.alterar((e) => { e.cargas.outras = v; }) }),
            cl.acidental,
          ),
          ...cl.composicao,
          h('div', { class: 'cargas-resumo' }, h('span', { class: 'rot' }, 'Total característico'), `g = ${num(cg.g)} kN/m² (painel ${num(cg.painel)} + capa ${num(cg.capa)}) · q = ${num(cg.q)} kN/m²`),
        ],
      }));
    },

    renderResultado(raiz, res) {
      raiz.append(h('div', { class: 'instrumentos' },
        res.balanco || (res.MdNeg < 0 && -res.MdNeg / Math.max(res.MRdNeg, 1e-9) > res.Md / res.MRd)
          ? ui.arco({ rotulo: 'Momento negativo', valor: res.MRdNeg > 0 ? `${num((-res.MdNeg / res.MRdNeg) * 100, 0)}%` : 'sem MRd−', fracao: res.MRdNeg > 0 ? -res.MdNeg / res.MRdNeg : 1.2, legenda: `Md− ${num(-res.MdNeg, 1)} / MRd− ${num(res.MRdNeg, 1)}` })
          : ui.arco({ rotulo: 'Momento fletor', valor: `${num((res.Md / res.MRd) * 100, 0)}%`, fracao: res.Md / res.MRd, legenda: `Md ${num(res.Md, 1)} / MRd ${num(res.MRd, 1)}` }),
        ui.arco({ rotulo: 'Cortante no apoio', valor: `${num((res.Vd / res.VRd) * 100, 0)}%`, fracao: res.Vd / res.VRd, legenda: `VSd ${num(res.Vd, 1)} / VRd ${num(res.VRd, 1)}` }),
        ui.medidor({ rotulo: 'Vibração (flecha de q)', valor: `${num(res.flecha.q, 1)} mm`, fracao: res.flecha.q / res.flecha.lim, legenda: `limite ${res.balanco ? '2L' : 'L'}/350 = ${num(res.flecha.lim, 1)} mm` }),
        ui.numeroGrande({ rotulo: 'Painéis', valor: String(res.nPaineis), unidade: 'un', linhas: [`vão/altura ${num(res.esbeltez, 0)}`, `pd ${num(res.cargas.pd)} kN/m²`] }),
      ));
      raiz.append(ui.secao({
        numero: '05', titulo: 'Reações nas vigas', descricao: res.balanco ? 'Por metro de viga · a borda livre e as laterais não recebem carga' : 'Por metro de viga · as bordas laterais não recebem carga',
        filhos: [ui.tabela({
          colunas: [{ titulo: 'Borda' }, { titulo: 'Vínculo' }, { titulo: 'g,k (kN/m)', alinhar: 'dir' }, { titulo: 'q,k (kN/m)', alinhar: 'dir' }, { titulo: 'Cálculo (kN/m)', alinhar: 'dir' }],
          linhas: res.reacoes.map((r) => [r.nome, r.tipo ?? 'apoiada', num(r.g), num(r.q), num(r.d)]),
        })],
      }));
    },
  };
}
