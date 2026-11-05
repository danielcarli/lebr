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
 * Ajuda › Catálogo de cargas (NBR 6120:2019): as tabelas que o LEBR usa para preencher
 * cargas de uso, revestimentos e paredes, com busca.
 */
import { h, limpar } from '../ui/dom.js';
import { icone } from '../ui/icones.js';
import * as ui from '../ui/componentes.js';
import { num } from '../core/formatar.js';
import { CARGAS_USO, ALVENARIAS, PESOS_ESPECIFICOS, FORROS } from '../../engine/cargas.js';

const cm = (v) => `${String(v).replace('.', ',')} cm`;
const kn = (v) => (v == null ? '—' : num(v, v * 10 % 1 ? 2 : 1));

export function abaCatalogoCargas() {
  let busca = '';
  return {
    id: 'catalogo-cargas',
    icone: 'carga',
    titulo: () => 'Cargas NBR 6120',
    dica: () => 'Catálogo de cargas — NBR 6120:2019',
    render(container) {
      const pagina = h('div', { class: 'pagina catalogo-cargas' });
      container.append(pagina);
      const corpo = h('div', { class: 'catalogo-corpo' });
      const casa = (...t) => !busca || t.join(' ').toLowerCase().includes(busca);

      const desenharCorpo = () => {
        const usos = CARGAS_USO.filter((u) => casa(u.grupo, u.local));
        const alv = ALVENARIAS.filter((a) => casa(a.nome, a.uso === 'vedacao' ? 'vedação' : 'estrutural', a.ref));
        const pesos = PESOS_ESPECIFICOS.filter((m) => casa(m.grupo, m.nome));
        const forros = FORROS.filter((f) => f.p > 0 && casa('forro', f.nome));
        const secoes = [
          usos.length && ui.secao({
            numero: '01', titulo: 'Cargas variáveis de uso', descricao: 'Tabela 10 · valores característicos mínimos',
            filhos: [ui.tabela({
              classe: 'catalogo-tabela',
              colunas: [{ titulo: 'Grupo' }, { titulo: 'Local' }, { titulo: 'q (kN/m²)', alinhar: 'dir' }],
              linhas: usos.map((u) => [u.grupo, u.local, kn(u.q)]),
            }), h('p', { class: 'catalogo-nota' }, 'Nas lajes, o campo “Uso do ambiente” preenche a carga acidental com estes valores. Garagens e áreas técnicas seguem itens próprios da norma e não estão no catálogo.')],
          }),
          alv.length && ui.secao({
            numero: '02', titulo: 'Alvenarias', descricao: 'Tabela 2 · peso da parede por área (kN/m²) com revestimento de 0, 1 e 2 cm em cada face',
            filhos: [ui.tabela({
              classe: 'catalogo-tabela',
              colunas: [{ titulo: 'Alvenaria' }, { titulo: 'Espessura' }, { titulo: '0 cm', alinhar: 'dir' }, { titulo: '1 cm', alinhar: 'dir' }, { titulo: '2 cm', alinhar: 'dir' }],
              linhas: alv.flatMap((a) => Object.entries(a.espessuras).sort((x, y) => x[0] - y[0]).map(([e, v], i) => ({
                classe: i === 0 ? 'primeira' : '',
                celulas: [
                  i === 0 ? h('span', null, h('b', null, a.nome), h('span', { class: 'catalogo-sub' }, `${a.uso === 'vedacao' ? 'Vedação' : 'Estrutural'}${a.ref ? ` · ${a.ref}` : ''}`)) : '',
                  h('span', null, cm(e), a.conferir?.[e] ? h('span', { class: 'catalogo-conferir', title: a.conferir[e] }, icone('alerta', { tamanho: 12, traco: 1.8 }), 'conferir') : null),
                  kn(v[0]), kn(v[1]), kn(v[2]),
                ],
              }))),
            }), h('p', { class: 'catalogo-nota' }, 'Na viga, a carga de parede é o peso por área × altura × (1 − aberturas). Arquivos antigos que informam o peso específico (kN/m³) continuam calculando como antes.')],
          }),
          pesos.length && ui.secao({
            numero: '03', titulo: 'Pesos específicos', descricao: 'Tabela 1 · kN/m³ (seleção usada nos revestimentos)',
            filhos: [ui.tabela({
              classe: 'catalogo-tabela',
              colunas: [{ titulo: 'Grupo' }, { titulo: 'Material' }, { titulo: 'γ (kN/m³)', alinhar: 'dir' }, { titulo: 'Faixa da norma', alinhar: 'dir' }],
              linhas: pesos.map((m) => [m.grupo, m.nome, kn(m.gama), m.faixa ?? '']),
            })],
          }),
          forros.length && ui.secao({
            numero: '04', titulo: 'Forros', descricao: 'kN/m², incluindo a estrutura de suporte',
            filhos: [ui.tabela({
              classe: 'catalogo-tabela',
              colunas: [{ titulo: 'Forro' }, { titulo: 'Peso (kN/m²)', alinhar: 'dir' }, { titulo: '' }],
              linhas: forros.map((f) => [f.nome, kn(f.p), f.conferir ? h('span', { class: 'catalogo-conferir', title: f.conferir }, icone('alerta', { tamanho: 12, traco: 1.8 }), 'conferir') : '']),
            })],
          }),
        ].filter(Boolean);
        limpar(corpo).append(...(secoes.length ? secoes : [ui.vazio({ icone: 'busca', titulo: 'Nada encontrado', texto: `Nenhuma linha com “${busca}”.` })]));
      };

      const campoBusca = h('input', {
        class: 'campo-input', type: 'search', placeholder: 'Buscar: dormitório, cerâmico, porcelanato…', value: busca, spellcheck: false,
        onInput: (e) => { busca = e.target.value.trim().toLowerCase(); desenharCorpo(); },
      });

      pagina.append(
        ui.cabecalhoObjeto({
          rotulo: 'Ajuda', numero: 'NBR', simbolo: 'carga', etiquetas: ['LEBR', 'Ações', 'NBR 6120'],
          linha1: 'Catálogo de cargas', linha2: 'ABNT NBR 6120:2019 · Ações para o cálculo de estruturas de edificações',
          titulo: 'Cargas', subtitulo: 'Cargas de uso, alvenarias, pesos específicos e forros usados pelo LEBR',
        }),
        h('p', { class: 'catalogo-nota' },
          'Os valores reproduzem as tabelas da norma a partir de material técnico conferido entre fontes. ',
          'Os marcados com “conferir” divergem entre as fontes e devem ser checados no texto da norma. Detalhes em docs/CARGAS.md.'),
        h('label', { class: 'campo catalogo-busca' }, h('span', { class: 'campo-caixa' }, icone('busca', { tamanho: 14 }), campoBusca)),
        corpo,
      );
      desenharCorpo();
    },
  };
}
