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
 * Ajuda › Relatório de validação: roda o banco de casos (validacao/casos/*.json)
 * dentro do app e mostra, caso a caso, o valor esperado, o do LEBR e a diferença.
 * É o mesmo executor do `npm run validar`.
 */
import { h, limpar } from '../ui/dom.js';
import { icone } from '../ui/icones.js';
import * as ui from '../ui/componentes.js';
import { executarTodos, problemasDoArquivo } from '../../validacao/executar.js';
import { numeroBr, percentual } from '../../validacao/relatorio-html.js';

const dois = (n) => String(n).padStart(2, '0');

/**
 * @param {object} p
 * @param {string} p.versao
 * @param {() => Promise<{arquivo:string, dados?:object, erro?:string}[]>} p.lerCasos
 * @param {() => void} [p.abrirPasta]
 */
export function abaValidacao({ versao, lerCasos, abrirPasta }) {
  let ultimo = null;
  let mostrar = 'todos'; // 'todos' | 'falhas'
  return {
    id: 'validacao',
    icone: 'check',
    titulo: () => 'Validação',
    dica: () => 'Relatório do banco de casos de validação',
    render(container) {
      const pagina = h('div', { class: 'pagina validacao', 'data-unidade-fixa': '' });
      container.append(pagina);

      const rodar = async () => {
        limpar(pagina).append(cabecalho(null), h('p', { class: 'validacao-carregando' }, 'Rodando os casos…'));
        let arquivos = [], problemas = [];
        try {
          const lidos = await lerCasos();
          for (const a of lidos) {
            if (a.erro) { problemas.push(`${a.arquivo}: JSON inválido — ${a.erro}`); continue; }
            for (const p of problemasDoArquivo(a.dados)) problemas.push(`${a.arquivo}: ${p}`);
            arquivos.push({ arquivo: a.arquivo, ...a.dados });
          }
        } catch (err) {
          problemas.push(`Não foi possível ler os casos: ${err.message}`);
        }
        // deixa a tela pintar "Rodando…" antes do cálculo
        await new Promise((r) => setTimeout(r, 20));
        ultimo = { r: executarTodos(arquivos), problemas };
        desenhar();
      };

      const cabecalho = (r) => ui.cabecalhoObjeto({
        rotulo: 'Ajuda', numero: 'VAL', simbolo: 'check', etiquetas: ['LEBR', 'Ajuda', 'Validação'],
        linha1: 'Banco de casos de validação', linha2: `LEBR ${versao} · validacao/casos/*.json`,
        titulo: 'Validação',
        subtitulo: 'Resultados do LEBR comparados com norma, tabelas clássicas e cálculo manual',
        estado: r ? { tipo: r.ok ? 'ok' : 'falha', texto: r.ok ? 'Todos os casos aprovados' : `${r.falhas} ${r.falhas === 1 ? 'caso com falha' : 'casos com falha'}` } : null,
      });

      function desenhar() {
        const { r, problemas } = ultimo;
        const acoes = [
          ui.botao({ texto: 'Rodar de novo', icone: 'calcular', aoClicar: rodar }),
          abrirPasta && ui.botao({ texto: 'Abrir a pasta dos casos', icone: 'pasta', tipo: 'fantasma', aoClicar: abrirPasta }),
          ui.segmentado({
            rotulo: 'Mostrar', valor: mostrar, compacto: true,
            opcoes: [{ valor: 'todos', texto: 'Todos' }, { valor: 'falhas', texto: `Só falhas (${r.falhas})` }],
            aoMudar: (v) => { mostrar = v; desenhar(); },
          }),
        ].filter(Boolean);

        const filhos = [
          cabecalho(r),
          h('p', { class: 'validacao-intro' },
            'Cada caso compara o resultado do LEBR com um valor de referência que não vem do próprio programa. ',
            'A diferença é relativa ao valor esperado e precisa ficar dentro da tolerância do caso. ',
            'O mesmo relatório sai no terminal com ', h('code', null, 'npm run validar'), '.'),
          ui.ficha([
            { rotulo: 'Casos aprovados', valor: `${r.aprovados} de ${r.total}`, destaque: true },
            { rotulo: 'Grandezas conferidas', valor: String(r.grandezas), destaque: true },
            { rotulo: 'Maior diferença', valor: percentual(r.maiorDiferenca), destaque: true },
            { rotulo: 'Executado em', valor: new Date(r.executadoEm).toLocaleTimeString('pt-BR'), sub: new Date(r.executadoEm).toLocaleDateString('pt-BR') },
          ], { colunas: 4 }),
          h('div', { class: 'validacao-acoes' }, acoes),
          problemas.length > 0 && h('ul', { class: 'avisos' }, problemas.map((p) => h('li', null, icone('alerta', { tamanho: 14, traco: 1.8 }), p))),
          r.grupos.map((g, i) => {
            const casos = mostrar === 'falhas' ? g.casos.filter((c) => !c.ok) : g.casos;
            if (!casos.length) return null;
            return ui.secao({
              numero: dois(i + 1), titulo: g.grupo, descricao: `${g.casos.filter((c) => c.ok).length} de ${g.casos.length} · ${g.arquivo}`,
              filhos: [h('p', { class: 'validacao-desc' }, g.descricao), tabelaGrupo(casos)],
            });
          }),
          mostrar === 'falhas' && r.falhas === 0 && ui.vazio({ icone: 'check', titulo: 'Nenhuma falha', texto: 'Todos os casos ficaram dentro da tolerância.' }),
        ];
        limpar(pagina).append(...filhos.flat().filter((x) => x instanceof Node));
      }

      if (ultimo) desenhar(); else rodar();
    },
  };
}

function tabelaGrupo(casos) {
  return h('table', { class: 'tabela validacao-tabela' },
    h('thead', null, h('tr', null,
      h('th', null, 'Grandeza'), h('th', { class: 'dir' }, 'Esperado'), h('th', { class: 'dir' }, 'LEBR'),
      h('th', null, 'Unidade'), h('th', { class: 'dir' }, 'Diferença'), h('th', { class: 'dir' }, 'Tolerância'), h('th', null, ''))),
    h('tbody', null, casos.flatMap((c) => [
      h('tr', { class: ['validacao-caso', c.ok ? 'ok' : 'falha'] },
        h('td', { colspan: 7 },
          h('div', { class: 'validacao-caso-tit' }, ui.selo(c.ok, c.ok ? 'Aprovado' : 'Falha'), h('strong', null, c.titulo), h('span', { class: 'validacao-id' }, `${c.id} · ${c.onde}`)),
          h('div', { class: 'validacao-fonte' }, h('span', null, 'Fonte: '), c.fonte),
          c.erro && h('div', { class: 'validacao-erro' }, `Erro ao rodar o caso: ${c.erro}`))),
      ...c.itens.map((i) => h('tr', { class: i.ok ? '' : 'falha' },
        h('td', null, i.grandeza),
        h('td', { class: 'dir num' }, numeroBr(i.esperado)),
        h('td', { class: 'dir num' }, numeroBr(i.obtido)),
        h('td', { class: 'unid' }, i.unidade),
        h('td', { class: 'dir num' }, percentual(i.diferenca)),
        h('td', { class: 'dir num tenue' }, percentual(i.tolerancia)),
        h('td', { class: 'st' }, i.ok ? icone('check', { tamanho: 14, traco: 2 }) : icone('alerta', { tamanho: 14, traco: 2 })))),
    ])));
}
