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
 * Quantitativos de materiais (concreto, fôrma e aço por bitola) por elemento, por pavimento e do projeto,
 * com exportação em CSV.
 */
import { h } from '../ui/dom.js';
import * as ui from '../ui/componentes.js';
import { icone } from '../ui/icones.js';
import { estado } from '../core/estado.js';
import { modulos } from '../core/modulos.js';
import { num } from '../core/formatar.js';
import { quantitativosDoProjeto, quantitativosCSV, acoTotal, pecasTotal } from '../../modules/comum/quantitativos.js';

const NOMES_CAT = { lajes: 'Lajes', vigas: 'Vigas', pilares: 'Pilares', escadas: 'Escadas', reservatorios: 'Reservatórios', fundacoes: 'Fundações' };
let modo = 'pavimento'; // 'pavimento' | 'elemento' | 'tipo'
const abertos = new Set();

/**
 * @param {object} acoes { exportarCSV(texto), abrirElemento(id), calcularTodos() }
 */
export function abaQuantitativos(acoes = {}) {
  const aba = {
    id: 'quantitativos',
    icone: 'quantitativos',
    titulo: () => 'Quantitativos',
    render(container) {
      const p = estado.projeto;
      if (!p) return;
      const redesenhar = () => { container.replaceChildren(); aba.render(container); };
      const q = quantitativosDoProjeto(p, modulos);
      const pendentes = p.elementos.filter((e) => q.elementos.some((x) => x.id === e.id) && (!e.resultado || e.resultado.erro || e.resultado.desatualizado)).length;
      const phis = q.bitolas;
      const fmtPhi = (phi) => `ø ${String(phi).replace('.', ',')}`;
      const linhaValores = (x) => [num(x.concreto, 2), num(x.forma, 1), num(acoTotal(x), 0), ...phis.map((phi) => (x.aco[phi] ? num(x.aco[phi], 0) : '—')), x.concreto > 0 ? num(acoTotal(x) / x.concreto, 0) : '—', pecasTotal(x) ? num(pecasTotal(x), 0) : '—'];
      const colunasNum = [{ titulo: 'Concreto (m³)', alinhar: 'dir' }, { titulo: 'Fôrma (m²)', alinhar: 'dir' }, { titulo: 'Aço (kg)', alinhar: 'dir' }, ...phis.map((phi) => ({ titulo: `${fmtPhi(phi)} (kg)`, alinhar: 'dir' })), { titulo: 'kg/m³', alinhar: 'dir' }, { titulo: 'Segmentos', alinhar: 'dir' }];

      const raiz = h('div', { class: 'pagina quantitativos' });
      raiz.append(ui.cabecalhoObjeto({
        rotulo: 'Estrutura', numero: 'Materiais', etiquetas: ['LEBR', 'Quantitativos', 'CSV'], simbolo: 'quantitativos',
        linha1: 'Concreto, fôrma e aço por bitola', linha2: 'Por elemento, por pavimento e do projeto',
        titulo: 'Quantitativos', subtitulo: 'Da geometria e da lista de ferros do detalhamento (estimativa onde ainda não há detalhamento)',
      }));
      raiz.append(h('div', { class: 'quant-acoes' },
        ui.botao({ texto: 'Exportar CSV', icone: 'documento', tipo: 'primario', aoClicar: () => acoes.exportarCSV?.(quantitativosCSV(q, { projeto: p })) }),
        pendentes ? ui.botao({ texto: `Calcular ${pendentes} pendente${pendentes > 1 ? 's' : ''}`, icone: 'calcular', tipo: 'secundario', aoClicar: () => acoes.calcularTodos?.() }) : null,
      ));
      const seletor = h('div', { class: 'quant-modo' }, ui.segmentado({ rotulo: 'Agrupar', valor: modo, opcoes: [{ valor: 'pavimento', texto: 'Por pavimento' }, { valor: 'tipo', texto: 'Por tipo' }, { valor: 'elemento', texto: 'Por elemento' }], aoMudar: (v) => { modo = v; redesenhar(); } }));

      const t = q.total;
      raiz.append(h('div', { class: 'instrumentos' },
        ui.numeroGrande({ rotulo: 'Concreto', valor: num(t.concreto, 1), unidade: 'm³', linhas: [`${q.elementos.length} elementos`, t.estacas.metros ? `+ ${num(t.estacas.volume, 1)} m³ nas estacas` : 'sem estacas'] }),
        ui.numeroGrande({ rotulo: 'Fôrma', valor: num(t.forma, 0), unidade: 'm²', linhas: [t.concreto > 0 ? `${num(t.forma / t.concreto, 1)} m² por m³` : '', 'faces moldadas'] }),
        ui.numeroGrande({ rotulo: 'Aço', valor: num(acoTotal(t), 0), unidade: 'kg', linhas: [`${t.concreto > 0 ? `taxa ${num(acoTotal(t) / t.concreto, 0)} kg/m³ · ` : ''}${phis.length} bitolas`, `${num(pecasTotal(t), 0)} segmentos de barra`] }),
        t.estacas.metros ? ui.numeroGrande({ rotulo: 'Estacas', valor: num(t.estacas.metros, 0), unidade: 'm', linhas: [`${t.estacas.n} estacas`, `${num(t.estacas.volume, 1)} m³ de concreto`] }) : null,
      ));
      if (pendentes) raiz.append(h('p', { class: 'combinacoes-nota' }, icone('alerta', { tamanho: 13 }), ` ${pendentes} elemento(s) sem cálculo atual: o aço deles fica de fora ou desatualizado até calcular.`));
      if (q.sem.length) raiz.append(h('p', { class: 'combinacoes-nota' }, `Sem quantitativo (módulo não estima): ${q.sem.join(', ')}.`));


      raiz.append(seletor);
      if (modo === 'pavimento') {
        const linhas = [];
        for (const g of q.pavimentos) {
          const aberto = abertos.has(g.id);
          linhas.push({ classe: 'quant-grupo', celulas: [h('button', { class: 'quant-abrir', onClick: () => { if (aberto) abertos.delete(g.id); else abertos.add(g.id); redesenhar(); } }, icone(aberto ? 'baixo' : 'direita', { tamanho: 12 }), ` ${g.nome}`), `${g.elementos.length}`, ...linhaValores(g)] });
          if (aberto) {
            for (const [cat, v] of Object.entries(g.porTipo)) linhas.push({ classe: 'quant-tipo', celulas: [`   ${NOMES_CAT[cat] ?? cat}`, `${g.elementos.filter((e) => e.categoria === cat).length}`, ...linhaValores(v)] });
          }
        }
        linhas.push({ classe: 'quant-total', celulas: ['Total do projeto', `${q.elementos.length}`, ...linhaValores(t)] });
        raiz.append(ui.secao({ numero: '01', titulo: 'Por pavimento', descricao: 'De cima para baixo; clique num pavimento para ver por tipo de elemento', filhos: [tabela([{ titulo: 'Pavimento' }, { titulo: 'Elementos', alinhar: 'dir' }, ...colunasNum], linhas)] }));
      } else if (modo === 'tipo') {
        const porTipo = {};
        for (const e of q.elementos) { const k = e.tipo; (porTipo[k] ??= { n: 0, concreto: 0, forma: 0, aco: {} }); const x = porTipo[k]; x.n++; x.concreto += e.concreto; x.forma += e.forma; for (const [phi, kg] of Object.entries(e.aco)) x.aco[phi] = (x.aco[phi] ?? 0) + kg; }
        const linhas = Object.entries(porTipo).sort((a, b) => b[1].concreto - a[1].concreto).map(([k, x]) => ({ celulas: [k, `${x.n}`, ...linhaValores(x)] }));
        linhas.push({ classe: 'quant-total', celulas: ['Total do projeto', `${q.elementos.length}`, ...linhaValores(t)] });
        raiz.append(ui.secao({ numero: '01', titulo: 'Por tipo de elemento', descricao: 'Todos os pavimentos', filhos: [tabela([{ titulo: 'Tipo' }, { titulo: 'Elementos', alinhar: 'dir' }, ...colunasNum], linhas)] }));
      } else {
        const linhas = [];
        for (const g of q.pavimentos) {
          linhas.push({ classe: 'quant-grupo', celulas: [g.nome, '', ...linhaValores(g)] });
          for (const e of [...g.elementos].sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'pt', { numeric: true }))) {
            linhas.push({ classe: e.calculado ? '' : 'quant-pendente', celulas: [h('button', { class: 'quant-link', onClick: () => acoes.abrirElemento?.(e.id), title: e.notas?.join(' ') || undefined }, `${e.codigo}`, h('span', null, ` ${e.tipo}`)), e.nome, ...linhaValores(e)] });
          }
        }
        linhas.push({ classe: 'quant-total', celulas: ['Total do projeto', '', ...linhaValores(t)] });
        raiz.append(ui.secao({ numero: '01', titulo: 'Por elemento', descricao: 'Clique no código para abrir o elemento', filhos: [tabela([{ titulo: 'Elemento' }, { titulo: 'Nome' }, ...colunasNum], linhas)] }));
      }

      // resumo do aço do projeto, por bitola, com perdas
      const r = q.resumoAco;
      if (r?.linhas?.length) {
        const campoPerdas = ui.campo({
          rotulo: 'Perdas de aço', valor: r.perdas, unidade: '%', casas: 1, min: 0, max: 50, largura: '160px',
          dica: 'Pontas, cortes e emendas não previstas — soma-se à massa da lista de ferros',
          aoMudar: (v) => estado.alterar((proj) => { proj.parametros.perdasAco = v; }, { descricao: `Perdas de aço: ${num(v, 1)} %`, invalidar: false }),
        });
        raiz.append(ui.secao({
          numero: '02', titulo: 'Resumo do aço do projeto', descricao: `Por bitola, com perdas · ${r.detalhados} elemento(s) pela lista de ferros do detalhamento${r.estimados ? `, ${r.estimados} por estimativa` : ''}`,
          filhos: [
            ui.linhaCampos(campoPerdas),
            tabela([{ titulo: 'Aço' }, { titulo: 'Bitola' }, { titulo: 'Comprimento (m)', alinhar: 'dir' }, { titulo: 'Massa (kg)', alinhar: 'dir' }, { titulo: `Com ${num(r.perdas, 0)} % de perdas (kg)`, alinhar: 'dir' }, { titulo: 'Barras de 12 m', alinhar: 'dir' }], [
              ...r.linhas.map((l) => [l.aco, `ø ${String(l.phi).replace('.', ',')} mm`, num(l.metros, 1), num(l.kg, 1), num(l.kgPerdas, 1), String(l.barras12)]),
              ...r.porAco.map((a) => ({ classe: 'quant-tipo', celulas: [`Total ${a.aco}`, '', '', '', num(a.kg, 1), ''] })),
              { classe: 'quant-total', celulas: ['Total do projeto', '', '', num(r.total, 1), num(r.totalPerdas, 1), ''] },
            ]),
          ],
        }));
      }

      raiz.append(ui.secao({ numero: '03', titulo: 'Critérios', descricao: 'Como as quantidades são estimadas', filhos: [h('ul', { class: 'quant-criterios' },
        h('li', null, 'Concreto: volume geométrico de cada peça (vigas pelo comprimento entre eixos, lajes pelos vãos, pilares pelo lance, escadas com degraus e patamares, reservatório pelas paredes, fundo e tampa). As estacas são contadas à parte.'),
        h('li', null, 'Fôrma: fundo e laterais das vigas (só laterais no baldrame), fundo das lajes maciças e cubetas das nervuradas, as quatro faces dos pilares, laterais das sapatas e dos blocos, fundo inclinado e espelhos das escadas, as duas faces das paredes dos reservatórios.'),
        h('li', null, 'Aço de vigas, pilares e lajes maciças: a lista de ferros do detalhamento de cada elemento, com as edições feitas nela (as negativas entre duas lajes contam uma vez). Massa nominal 0,00617·ø² kg/m (NBR 7480).'),
        h('li', null, 'Aço dos demais elementos (escadas, reservatórios, sapatas, blocos, lajes nervuradas e treliçadas): barras do último cálculo com ancoragens e ganchos aproximados — estimativa.'),
        h('li', null, 'Lajes treliçadas e alveolares: só o concreto moldado na obra; vigotas, treliças, painéis e enchimento à parte.'),
      )] }));
      container.append(raiz);
    },
  };
  return aba;
}

const tabela = (colunas, linhas) => h('div', { class: 'tabela-rolagem' }, ui.tabela({ classe: 'els-tabela quant-tabela', colunas, linhas }));
