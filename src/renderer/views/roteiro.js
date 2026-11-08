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
 * Ajuda › Roteiro (road map): o que falta para o LEBR servir a projetos reais,
 * por área e em três fases. O conteúdo está em roteiro-dados.js.
 */
import { h } from '../ui/dom.js';
import { icone } from '../ui/icones.js';
import * as ui from '../ui/componentes.js';
import { ROTEIRO, estadoDe, contarEstados, chavesDaArea, ROTULO_ESTADO } from './roteiro-dados.js';

const dataBr = (iso) => iso.split('-').reverse().join('/');
const dois = (n) => String(n).padStart(2, '0');
const chip = (t) => { const e = estadoDe(t); return h('span', { class: ['roteiro-estado', e], title: ROTULO_ESTADO[e] }, ROTULO_ESTADO[e]); };
const resumo = (chaves) => {
  const c = { feito: 0, parcial: 0, falta: 0 };
  for (const t of chaves) c[estadoDe(t)]++;
  return [c.feito && `${c.feito} feito${c.feito > 1 ? 's' : ''}`, c.parcial && `${c.parcial} parcia${c.parcial > 1 ? 'is' : 'l'}`, c.falta && `${c.falta} a fazer`].filter(Boolean).join(' · ');
};

export function abaRoteiro({ versao }) {
  return {
    id: 'roteiro',
    icone: 'roteiro',
    titulo: () => 'Roteiro',
    dica: () => 'Roteiro de desenvolvimento (road map)',
    render(container) {
      const r = ROTEIRO;
      const pagina = h('div', { class: 'pagina roteiro' },
        ui.cabecalhoObjeto({
          rotulo: 'Ajuda', numero: 'MAP', simbolo: 'roteiro', etiquetas: ['LEBR', 'Ajuda', 'Road map'],
          linha1: 'Roteiro de desenvolvimento', linha2: `Atualizado em ${dataBr(r.data)} · versão atual ${versao}`,
          titulo: 'Roteiro', subtitulo: 'Do protótipo a projetos reais: módulos e funcionalidades que faltam',
        }),

        h('div', { class: 'roteiro-intro' }, r.introducao.map((p) => h('p', null, p))),
        (() => { const t = contarEstados(r); return ui.ficha([
          { rotulo: 'Feitos', valor: String(t.feito), destaque: true },
          { rotulo: 'Parciais', valor: String(t.parcial), destaque: true },
          { rotulo: 'A fazer', valor: String(t.falta), destaque: true },
          { rotulo: 'Fase atual', valor: 'Fase 1', sub: 'itens feitos · falta o edifício de teste conferido' },
        ], { colunas: 4 }); })(),

        ui.secao({
          numero: '00', titulo: 'O que existe hoje', descricao: `LEBR ${versao}`,
          filhos: [
            h('ul', { class: 'roteiro-hoje' }, r.hoje.map((x) => h('li', null, icone('check', { tamanho: 13, traco: 2 }), x))),
            h('p', { class: 'roteiro-nota' }, r.hojeNota),
          ],
        }),

        ui.secao({
          numero: '01', titulo: 'Fases', descricao: 'Primeiro o residencial pequeno, depois edifícios, por fim outros materiais',
          filhos: [
            h('div', { class: 'roteiro-fases' }, r.fases.map((f, i) => [
              i > 0 && h('div', { class: 'roteiro-portao', 'aria-hidden': 'true' }, icone('direita', { tamanho: 18, traco: 1.6 })),
              h('article', { class: ['roteiro-fase', f.atual && 'atual'] },
                h('header', null,
                  h('span', { class: 'roteiro-fase-nome' }, f.nome),
                  f.atual && h('span', { class: 'roteiro-fase-marca' }, f.marca ?? 'próxima'),
                  h('span', { class: 'roteiro-fase-sub' }, f.sub)),
                h('ul', null, f.itens.map((x) => h('li', { class: ['roteiro-item', estadoDe(x)] }, chip(x), h('span', null, x)))),
                h('footer', null, f.saida)),
            ])),
            h('p', { class: 'roteiro-nota' }, r.fasesNota),
          ],
        }),

        r.areas.map((a, i) => ui.secao({
          numero: dois(i + 2), titulo: a.titulo, descricao: resumo(chavesDaArea(a)),
          filhos: [
            h('p', { class: 'roteiro-desc' }, a.descricao),
            a.linhas && ui.tabela({
              classe: 'roteiro-tabela',
              colunas: [{ titulo: 'Estado' }, ...a.colunas.map((t) => ({ titulo: t }))],
              linhas: a.linhas.map((l) => [chip(l[0]), ...l.map((v, j) => (j === 0 ? h('strong', null, v) : v))]),
            }),
            a.grupos && h('div', { class: 'roteiro-grupos' }, a.grupos.map((g) => h('div', null,
              h('h3', null, g.titulo),
              h('ul', { class: 'roteiro-lista com-estado' }, g.itens.map((x) => h('li', null, chip(x), h('span', null, x))))))),
            a.itens && h('ul', { class: 'roteiro-lista com-estado' }, a.itens.map(([t, d]) => h('li', null, chip(t), h('span', null, h('strong', null, `${t}: `), d)))),
          ],
        })),

        (r.planos ?? []).map(([t, ps], k) => ui.secao({
          numero: dois(r.areas.length + 2 + k), titulo: t,
          filhos: [h('div', { class: 'roteiro-plano' }, ps.map((p) => (p.startsWith('- ') ? h('p', { class: 'roteiro-plano-item' }, p.slice(2)) : h('p', null, p))))],
        })),

        h('p', { class: 'roteiro-rodape' }, 'O roteiro também está em docs/ROTEIRO.md. Sugestões e módulos novos são bem-vindos no repositório do projeto.'),
      );
      container.append(pagina);
    },
  };
}
