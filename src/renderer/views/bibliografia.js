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
 * Ajuda › Exercícios resolvidos (LEBR × fontes): todos os problemas tirados da bibliografia publicada, com o
 * enunciado, a fonte, o resultado do material publicado e o do LEBR lado a lado, as diferenças de hipótese, as
 * divergências encontradas, os exercícios que ficaram de fora e a lista das fontes. Roda os casos na hora.
 */
import { h, limpar } from '../ui/dom.js';
import { icone } from '../ui/icones.js';
import * as ui from '../ui/componentes.js';
import { executarTodos, problemasDoArquivo } from '../../validacao/executar.js';
import { numeroBr, percentual } from '../../validacao/relatorio-html.js';
import { ehArquivoBibliografia, DIVERGENCIAS, EXCLUIDOS, SEM_EXERCICIOS } from '../../validacao/bibliografia-notas.js';

const dois = (n) => String(n).padStart(2, '0');
const abrirLink = (url) => (ev) => { ev.preventDefault(); window.lebr?.sistema?.abrirExterno?.(url); };
const curto = (g) => g.replace(/^Bibliografia — /, '');

/**
 * @param {object} p
 * @param {string} p.versao
 * @param {() => Promise<{arquivo:string, dados?:object, erro?:string}[]>} p.lerCasos
 * @param {() => void} [p.exportarPdf]
 */
export function abaBibliografia({ versao, lerCasos, exportarPdf }) {
  let ultimo = null;
  let grupoSel = 'todos';
  let busca = '';
  return {
    id: 'bibliografia',
    icone: 'documento',
    titulo: () => 'Exercícios resolvidos',
    dica: () => 'Problemas publicados por outros autores comparados com o LEBR',
    render(container) {
      const pagina = h('div', { class: 'pagina validacao bibliografia', 'data-unidade-fixa': '' });
      container.append(pagina);

      const rodar = async () => {
        limpar(pagina).append(cabecalho(null), h('p', { class: 'validacao-carregando' }, 'Rodando os exercícios…'));
        const arquivos = [], problemas = [];
        try {
          for (const a of await lerCasos()) {
            if (!ehArquivoBibliografia(a.arquivo)) continue;
            if (a.erro) { problemas.push(`${a.arquivo}: JSON inválido — ${a.erro}`); continue; }
            for (const p of problemasDoArquivo(a.dados)) problemas.push(`${a.arquivo}: ${p}`);
            arquivos.push({ arquivo: a.arquivo, ...a.dados });
          }
        } catch (err) {
          problemas.push(`Não foi possível ler os casos: ${err.message}`);
        }
        await new Promise((r) => setTimeout(r, 20));
        ultimo = { r: executarTodos(arquivos), problemas };
        desenhar();
      };

      const cabecalho = (r) => ui.cabecalhoObjeto({
        rotulo: 'Ajuda', numero: 'BIB', simbolo: 'documento', etiquetas: ['LEBR', 'Bibliografia'],
        linha1: 'Exercícios resolvidos publicados', linha2: `LEBR ${versao} · apostilas, livros, TCCs e dissertações`,
        titulo: 'LEBR × fontes',
        subtitulo: 'Cada problema com o enunciado, a fonte e os resultados do material publicado e do LEBR',
        estado: r ? { tipo: r.ok ? 'ok' : 'falha', texto: r.ok ? 'Todos dentro da tolerância' : `${r.falhas} fora da tolerância` } : null,
      });

      function fontesDe(r) {
        const m = new Map();
        for (const g of r.grupos) for (const c of g.casos) {
          const chave = c.url || c.referencia || c.fonte;
          const f = m.get(chave) ?? { referencia: c.referencia || c.fonte, url: c.url, grupos: new Set(), casos: 0 };
          f.grupos.add(curto(g.grupo)); f.casos++;
          m.set(chave, f);
        }
        return [...m.values()].sort((a, b) => a.referencia.localeCompare(b.referencia, 'pt-BR'));
      }

      function desenhar() {
        const { r, problemas } = ultimo;
        const fontes = fontesDe(r);
        const termo = busca.trim().toLowerCase();
        const passa = (c) => !termo || [c.titulo, c.descricao, c.fonte, c.nota, c.id].some((t) => String(t ?? '').toLowerCase().includes(termo));
        const grupos = r.grupos
          .filter((g) => grupoSel === 'todos' || g.arquivo === grupoSel)
          .map((g) => ({ ...g, visiveis: g.casos.filter(passa) }))
          .filter((g) => g.visiveis.length);
        const nVis = grupos.reduce((s, g) => s + g.visiveis.length, 0);
        let n = 0;

        const campoBusca = h('input', {
          class: 'biblio-busca', type: 'search', placeholder: 'Procurar por autor, tema, elemento…', value: busca,
          onInput: (e) => { busca = e.target.value; clearTimeout(campoBusca._t); campoBusca._t = setTimeout(() => { desenhar(); pagina.querySelector('.biblio-busca')?.focus(); }, 250); },
        });

        const filhos = [
          cabecalho(r),
          h('p', { class: 'validacao-intro' },
            'Exercícios resolvidos publicados por professores e alunos, refeitos no LEBR. Para cada problema aparecem o enunciado, ',
            'a fonte (com o link), o valor publicado no material, o valor do LEBR e a diferença, e as diferenças de hipótese entre os dois. ',
            'No fim estão as divergências que a comparação revelou e os exercícios que ficaram de fora.'),
          ui.ficha([
            { rotulo: 'Exercícios', valor: String(r.total), sub: `${r.aprovados} dentro da tolerância`, destaque: true },
            { rotulo: 'Fontes', valor: String(fontes.length), sub: 'apostilas, livros e trabalhos', destaque: true },
            { rotulo: 'Grandezas comparadas', valor: String(r.grandezas), destaque: true },
            { rotulo: 'Maior diferença', valor: percentual(r.maiorDiferenca), sub: new Date(r.executadoEm).toLocaleString('pt-BR') },
          ], { colunas: 4 }),
          h('div', { class: 'validacao-acoes' },
            ui.botao({ texto: 'Rodar de novo', icone: 'calcular', aoClicar: rodar }),
            exportarPdf && ui.botao({ texto: 'Exportar PDF', icone: 'pdf', tipo: 'fantasma', aoClicar: exportarPdf }),
            ui.selecao({
              rotulo: 'Tema', valor: grupoSel, largura: '230px',
              opcoes: [{ valor: 'todos', texto: `Todos (${r.total})` }, ...r.grupos.map((g) => ({ valor: g.arquivo, texto: `${curto(g.grupo)} (${g.casos.length})` }))],
              aoMudar: (v) => { grupoSel = v; desenhar(); },
            }),
            h('label', { class: 'biblio-busca-rot' }, h('span', null, 'Procurar'), campoBusca),
          ),
          problemas.length > 0 && h('ul', { class: 'avisos' }, problemas.map((p) => h('li', null, icone('alerta', { tamanho: 14, traco: 1.8 }), p))),
          termo && h('p', { class: 'validacao-desc' }, `${nVis} ${nVis === 1 ? 'exercício encontrado' : 'exercícios encontrados'} para "${busca.trim()}".`),
          grupos.map((g) => ui.secao({
            numero: dois(++n), titulo: curto(g.grupo), descricao: `${g.visiveis.length} ${g.visiveis.length === 1 ? 'exercício' : 'exercícios'}`,
            filhos: [h('p', { class: 'validacao-desc' }, g.descricao), h('div', { class: 'biblio-lista' }, g.visiveis.map(cartaoExercicio))],
          })),
          !nVis && ui.vazio({ icone: 'busca', titulo: 'Nenhum exercício', texto: 'Mude o tema ou o texto procurado.' }),
          ui.secao({
            numero: dois(++n), titulo: 'Divergências encontradas', descricao: 'Onde o LEBR e as fontes partem de hipóteses diferentes',
            filhos: [h('div', { class: 'biblio-diverg' }, DIVERGENCIAS.map((d) => h('div', { class: ['biblio-div', d.situacao] },
              h('div', { class: 'biblio-div-tit' },
                h('span', { class: ['biblio-tag', d.situacao] }, d.situacao === 'revisar' ? 'Precisa de revisão' : 'Hipótese diferente'),
                h('strong', null, d.tema)),
              h('p', null, d.texto),
              h('div', { class: 'validacao-fonte' }, h('span', null, 'Fontes: '), d.fontes))))],
          }),
          ui.secao({
            numero: dois(++n), titulo: 'Exercícios que ficaram de fora', descricao: 'Encontrados, mas não incluídos no banco',
            filhos: [ui.tabela({ classe: 'biblio-excl', colunas: [{ titulo: 'Fonte' }, { titulo: 'Motivo' }], linhas: EXCLUIDOS.map((x) => [x.fonte, x.motivo]) }),
              h('p', { class: 'validacao-desc' }, SEM_EXERCICIOS)],
          }),
          ui.secao({
            numero: dois(++n), titulo: 'Fontes consultadas', descricao: `${fontes.length} documentos publicados`,
            filhos: [h('ol', { class: 'biblio-fontes' }, fontes.map((f) => h('li', null,
              h('div', null, f.referencia),
              h('div', { class: 'biblio-fonte-meta' }, `${f.casos} ${f.casos === 1 ? 'exercício' : 'exercícios'} · ${[...f.grupos].join(', ')}`,
                f.url ? ' · ' : null, f.url && h('a', { href: '#', onclick: abrirLink(f.url) }, 'abrir o documento')))))],
          }),
        ];
        limpar(pagina).append(...filhos.flat().filter((x) => x instanceof Node));
      }

      if (ultimo) desenhar(); else rodar();
    },
  };
}

function cartaoExercicio(c) {
  return h('article', { class: ['biblio-ex', c.ok ? 'ok' : 'falha'] },
    h('header', { class: 'biblio-ex-cab' },
      ui.selo(c.ok, c.ok ? 'Confere' : 'Diverge'),
      h('strong', null, c.titulo),
      h('span', { class: 'validacao-id' }, c.id)),
    c.descricao && h('div', { class: 'biblio-bloco' }, h('span', { class: 'biblio-rot' }, 'Problema'), h('p', null, c.descricao)),
    h('div', { class: 'biblio-bloco' }, h('span', { class: 'biblio-rot' }, 'Fonte'),
      h('p', null, c.referencia || c.fonte, c.local ? h('span', { class: 'biblio-local' }, ` — ${c.local}`) : null,
        c.url ? ' · ' : null, c.url && h('a', { href: '#', onclick: abrirLink(c.url) }, 'abrir o documento'))),
    h('table', { class: 'tabela validacao-tabela biblio-tab' },
      h('thead', null, h('tr', null,
        h('th', null, 'Grandeza'), h('th', { class: 'dir' }, 'Material publicado'), h('th', { class: 'dir' }, 'LEBR'),
        h('th', null, 'Unidade'), h('th', { class: 'dir' }, 'Diferença'), h('th', { class: 'dir' }, 'Tolerância'), h('th', null, ''))),
      h('tbody', null, c.itens.map((i) => h('tr', { class: i.ok ? '' : 'falha' },
        h('td', null, i.grandeza),
        h('td', { class: 'dir num' }, numeroBr(i.esperado)),
        h('td', { class: 'dir num' }, numeroBr(i.obtido)),
        h('td', { class: 'unid' }, i.unidade),
        h('td', { class: 'dir num' }, percentual(i.diferenca)),
        h('td', { class: 'dir num tenue' }, percentual(i.tolerancia)),
        h('td', { class: 'st' }, i.ok ? icone('check', { tamanho: 14, traco: 2 }) : icone('alerta', { tamanho: 14, traco: 2 })))))),
    c.nota && h('div', { class: 'biblio-bloco' }, h('span', { class: 'biblio-rot' }, 'Diferenças de hipótese'), h('p', { class: 'biblio-nota' }, c.nota)),
    c.erro && h('div', { class: 'validacao-erro' }, `Erro ao rodar o exercício: ${c.erro}`));
}
