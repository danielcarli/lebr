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
 * Explorador do projeto (barra lateral): elementos agrupados por categoria.
 */
import { compararCodigos } from '../core/formatar.js';
import { h } from '../ui/dom.js';
import { icone } from '../ui/icones.js';
import * as ui from '../ui/componentes.js';
import { menuContexto, abrirMenu } from '../ui/menus.js';
import { estado } from '../core/estado.js';
import { modulos } from '../core/modulos.js';
import { comandos } from '../core/comandos.js';
import { estadoDoResultado } from './elemento.js';
import { montagemDoProjeto } from '../core/situacao-montagem.js';

const TITULO_MONTAGEM = { 'sem-posicao': 'Montagem: ainda não posicionado', ok: 'Montagem: apoios e ligações conferem', erro: 'Montagem com problema' };
/** Bolinha da montagem de um grupo: vermelha se algum tem erro, verde se todos estão certos, vazia se falta posicionar. */
function resumoMontagem(els, mapa) {
  const st = els.map((e) => mapa.get(e.id)?.estado).filter(Boolean);
  if (!st.length) return null;
  if (st.includes('erro')) return 'erro';
  if (st.every((x) => x === 'ok')) return 'ok';
  return 'sem-posicao';
}
const pontoMontagem = (st, titulo) => (st ? h('i', { class: ['ponto-montagem', st], title: titulo ?? TITULO_MONTAGEM[st] }) : null);

const recolhidos = new Set();
// pavimentos abertos no agrupamento (o padrão é recolhido quando há muitos pavimentos)
const abertos = new Set();

/** Agrupar os elementos posicionados por pavimento? (preferência do usuário, padrão: sim) */
const CHAVE_AGRUPAR = 'lebr.explorador.porPavimento';
export function agruparPorPavimento() {
  try { return localStorage.getItem(CHAVE_AGRUPAR) !== 'nao'; } catch { return true; }
}
export function alternarAgrupamento() {
  try { localStorage.setItem(CHAVE_AGRUPAR, agruparPorPavimento() ? 'nao' : 'sim'); } catch { /* sem armazenamento */ }
}

/** Mostrar só os elementos com pendências (não atende, não calculado, desatualizado ou erro de montagem)? */
const CHAVE_PENDENCIAS = 'lebr.explorador.soPendencias';
const CHAVE_LEGENDA = 'lebr.explorador.legenda';
const lerPref = (k) => { try { return localStorage.getItem(k) === 'sim'; } catch { return false; } };
const gravarPref = (k, v) => { try { localStorage.setItem(k, v ? 'sim' : 'nao'); } catch { /* sem armazenamento */ } };
export const soPendencias = () => lerPref(CHAVE_PENDENCIAS);
export function alternarPendencias(v = !soPendencias()) { gravarPref(CHAVE_PENDENCIAS, v); }
const legendaVisivel = () => lerPref(CHAVE_LEGENDA);

/** O elemento tem alguma pendência de cálculo ou de montagem? */
export function temPendencia(el, montagem = montagemDoProjeto()) {
  const r = el.resultado;
  return !r || r.desatualizado || !!r.erro || r.ok === false || montagem.get(el.id)?.estado === 'erro';
}

function legenda() {
  const item = (cls, txt) => h('span', { class: 'leg-item' }, h('i', { class: cls }), txt);
  return h('div', { class: 'explorador-legenda' },
    h('div', { class: 'leg-linha' }, h('span', { class: 'leg-tit' }, 'Cálculo'),
      item('ponto-estado ok', 'atende'), item('ponto-estado falha', 'não atende'), item('ponto-estado desatualizado', 'a calcular')),
    h('div', { class: 'leg-linha' }, h('span', { class: 'leg-tit' }, 'Montagem'),
      item('ponto-montagem ok', 'ligado'), item('ponto-montagem erro', 'erro'), item('ponto-montagem sem-posicao', 'sem posição')),
    h('div', { class: 'leg-nota' }, 'Losango = problema · círculo cheio = em ordem · anel = falta fazer. Nos grupos, o losango laranja indica que algum elemento não atende.'));
}

/**
 * @param {object} acoes  { abrirElemento(id), elementoAtivo(): id|null, criar(moduloId) }
 */
export function visaoExplorador(acoes) {
  return {
    id: 'explorador',
    titulo: 'Explorador',
    icone: 'explorador',
    acoes: () => estado.projeto ? [
      ui.botaoIcone({ icone: 'mais', titulo: 'Novo elemento', aoClicar: (e) => abrirMenu(menuNovo(acoes), { ancora: e.currentTarget }) }),
      ui.botaoIcone({ icone: 'planta', titulo: 'Montagem da estrutura (F6)', aoClicar: () => comandos.executar('estrutura.montagem') }),
      ui.botaoIcone({ icone: 'cubo', titulo: 'Visualização 3D (F7)', aoClicar: () => comandos.executar('estrutura.3d') }),
      ui.botaoIcone({ icone: 'vento', titulo: 'Vento — NBR 6123 (F8)', aoClicar: () => comandos.executar('estrutura.vento') }),
      ui.botaoIcone({ icone: 'estabilidade', titulo: 'Estabilidade global — α e γz (F9)', aoClicar: () => comandos.executar('estrutura.estabilidade') }),
      ui.botaoIcone({ icone: 'quantitativos', titulo: 'Quantitativos de materiais', aoClicar: () => comandos.executar('estrutura.quantitativos') }),
      ui.botaoIcone({ icone: 'camadas', titulo: agruparPorPavimento() ? 'Desagrupar (lista única por categoria)' : 'Agrupar por pavimento', classe: agruparPorPavimento() ? 'ligado' : '', aoClicar: () => comandos.executar('exibir.agruparPavimento') }),
      ui.botaoIcone({ icone: 'filtro', titulo: soPendencias() ? 'Mostrar todos os elementos' : 'Mostrar só os elementos com pendências', classe: soPendencias() ? 'ligado' : '', aoClicar: () => comandos.executar('exibir.soPendencias') }),
      ui.botaoIcone({ icone: 'info', titulo: legendaVisivel() ? 'Esconder a legenda' : 'Legenda das bolinhas', classe: legendaVisivel() ? 'ligado' : '', aoClicar: () => { gravarPref(CHAVE_LEGENDA, !legendaVisivel()); comandos.executar('exibir.legendaExplorador'); } }),
      ui.botaoIcone({ icone: 'calcular', titulo: 'Calcular todos (Shift+F5)', aoClicar: () => comandos.executar('elemento.calcularTodos') }),
      ui.botaoIcone({ icone: 'parametros', titulo: 'Parâmetros do projeto', aoClicar: () => comandos.executar('projeto.parametros') }),
    ] : [],
    render(raiz) {
      if (!estado.projeto) {
        raiz.append(ui.vazio({
          icone: 'explorador', titulo: 'Nenhum projeto aberto',
          texto: 'Crie um projeto novo ou abra um arquivo para lançar vigas, lajes e pilares.',
          acoes: [
            ui.botao({ texto: 'Novo projeto', icone: 'novo', tipo: 'primario', aoClicar: () => comandos.executar('projeto.novo') }),
            ui.botao({ texto: 'Abrir projeto…', icone: 'pasta', aoClicar: () => comandos.executar('projeto.abrir') }),
          ],
        }));
        return;
      }
      const ativo = acoes.elementoAtivo();
      const montagem = montagemDoProjeto();
      const filtrar = soPendencias();
      if (legendaVisivel()) raiz.append(legenda());
      if (filtrar) {
        const n = estado.projeto.elementos.filter((e) => modulos.obter(e.modulo) && temPendencia(e, montagem)).length;
        raiz.append(h('div', { class: 'explorador-filtro' },
          icone('filtro', { tamanho: 13, traco: 1.8 }),
          h('span', null, n ? `Só os ${n} elemento${n > 1 ? 's' : ''} com pendências` : 'Nenhuma pendência: tudo calculado e atendendo'),
          h('button', { class: 'link', onClick: () => comandos.executar('exibir.soPendencias') }, 'Mostrar todos')));
      }
      const arvore = h('div', { class: 'arvore', role: 'tree' });
      for (const cat of modulos.categorias()) {
        const mods = modulos.daCategoria(cat.id);
        const ids = new Set(mods.map((m) => m.id));
        // sempre em ordem alfabética natural dos códigos (V1, V2, … V10)
        const itens = estado.projeto.elementos.filter((e) => ids.has(e.modulo) && (!filtrar || temPendencia(e, montagem))).sort((a, b) => compararCodigos(a.codigo, b.codigo));
        if (!mods.length && !itens.length) continue;
        if (filtrar && !itens.length) continue;

        const grupo = h('div', { class: ['arvore-grupo', recolhidos.has(cat.id) && 'recolhido'] });
        const criar = (e) => {
          e.stopPropagation();
          if (mods.length === 1) acoes.criar(mods[0].id);
          else abrirMenu(mods.map((m) => ({ rotulo: m.nome, icone: m.icone, acao: () => acoes.criar(m.id) })), { ancora: e.currentTarget });
        };
        grupo.append(h('div', {
          class: 'arvore-grupo-cab', role: 'button', tabIndex: 0,
          onClick: () => { recolhidos.has(cat.id) ? recolhidos.delete(cat.id) : recolhidos.add(cat.id); grupo.classList.toggle('recolhido'); },
          onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } },
        },
          icone('baixo', { tamanho: 14, classe: 'icone chevron' }),
          cat.nome, h('span', { class: 'qtd' }, String(itens.length)),
          h('span', { class: 'acoes' }, ui.botaoIcone({ icone: 'mais', titulo: `Nova ${cat.nome.toLowerCase().replace(/s$/, '')}`, aoClicar: criar })),
          itens.length ? h('i', { class: ['ponto-estado', 'ponto-grupo', resumoEstado(itens)], title: tituloEstado[resumoEstado(itens)] }) : null,
          itens.length ? pontoMontagem(resumoMontagem(itens, montagem)) : null));

        const lista = h('div', { class: 'arvore-itens', role: 'group' });
        const item = (el) => {
          const st = estadoDoResultado(el);
          const mod = modulos.obter(el.modulo);
          const mt = montagem.get(el.id);
          const txtMont = mt ? (mt.estado === 'erro' ? `Montagem: ${mt.problemas.join(' · ')}` : TITULO_MONTAGEM[mt.estado]) : '';
          return h('button', {
            class: ['arvore-item', el.id === ativo && 'ativo'], role: 'treeitem', title: `${mod?.nome ?? el.modulo} — ${st.texto}${txtMont ? `\n${txtMont}` : ''}`,
            dataset: { id: el.id },
            onClick: () => acoes.abrirElemento(el.id),
            onContextmenu: (e) => menuContexto(e, menuElemento(el)),
            onKeydown: (e) => {
              if (e.key === 'Delete') { e.preventDefault(); comandos.executar('elemento.excluir', el.id); }
              if (e.key === 'F2') { e.preventDefault(); comandos.executar('elemento.renomear', el.id); }
              if (e.key === 'ArrowDown') { e.preventDefault(); e.currentTarget.nextElementSibling?.focus(); }
              if (e.key === 'ArrowUp') { e.preventDefault(); e.currentTarget.previousElementSibling?.focus(); }
            },
          },
            icone(mod?.icone ?? 'documento', { tamanho: 15 }),
            h('span', { class: 'codigo' }, el.codigo),
            h('span', { class: 'nome' }, el.nome !== el.codigo ? el.nome : (mod?.resumo?.(el) ?? '')),
            h('i', { class: ['ponto-estado', st.classe], title: st.texto }),
            mt ? pontoMontagem(mt.estado, txtMont) : h('i', { class: 'ponto-montagem nenhum' }));
        };
        // agrupamento por pavimento (de cima para baixo, como num corte do edifício); os sem posição no fim
        const pavs = [...(estado.projeto.pavimentos ?? [])].sort((a, b) => b.cota - a.cota);
        const porPav = agruparPorPavimento() && pavs.length > 0 && itens.some((e) => e.posicao?.pavimento);
        if (porPav) {
          const grupos = [...pavs.map((pv) => ({ id: pv.id, nome: pv.nome, cota: pv.cota, els: itens.filter((e) => e.posicao?.pavimento === pv.id) })),
            { id: '_sem', nome: 'Sem posição na montagem', cota: null, els: itens.filter((e) => !pavs.some((pv) => pv.id === e.posicao?.pavimento)) }]
            .filter((g) => g.els.length);
          const muitos = grupos.length > 4;
          for (const g of grupos) {
            const chave = `${cat.id}:${g.id}`;
            const fechado = muitos ? !abertos.has(chave) : recolhidos.has(chave);
            const sub = h('div', { class: ['arvore-subgrupo', fechado && 'recolhido'] });
            const ativoAqui = g.els.some((e) => e.id === ativo);
            sub.append(h('div', {
              class: ['arvore-subgrupo-cab', ativoAqui && 'tem-ativo'], role: 'button', tabIndex: 0,
              title: g.cota != null ? `${g.nome} · cota ${String(g.cota).replace('.', ',')} m` : g.nome,
              onClick: () => {
                const agoraFechado = !sub.classList.contains('recolhido');
                sub.classList.toggle('recolhido');
                if (muitos) { if (agoraFechado) abertos.delete(chave); else abertos.add(chave); } else if (agoraFechado) recolhidos.add(chave); else recolhidos.delete(chave);
              },
              onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } },
            }, icone('baixo', { tamanho: 12, classe: 'icone chevron' }), h('span', { class: 'pav-nome' }, g.nome), h('span', { class: 'qtd' }, String(g.els.length)),
              h('i', { class: ['ponto-estado', resumoEstado(g.els)], title: tituloEstado[resumoEstado(g.els)] }),
              pontoMontagem(resumoMontagem(g.els, montagem))));
            sub.append(h('div', { class: 'arvore-subitens' }, g.els.map(item)));
            // o elemento aberto fica visível mesmo com o pavimento recolhido por padrão
            if (fechado && ativoAqui && muitos) { sub.classList.remove('recolhido'); abertos.add(chave); }
            lista.append(sub);
          }
        } else for (const el of itens) lista.append(item(el));
        if (!itens.length) lista.append(h('div', { class: 'arvore-vazia' }, 'Nenhum elemento. ', h('button', { onClick: criar }, 'Criar')));
        grupo.append(lista);
        arvore.append(grupo);
      }
      // elementos de módulos não instalados: preservados e visíveis
      const conhecidos = new Set(modulos.lista().map((m) => m.id));
      const orfaos = estado.projeto.elementos.filter((e) => !conhecidos.has(e.modulo));
      if (orfaos.length) {
        arvore.append(h('div', { class: 'arvore-grupo' },
          h('div', { class: 'arvore-grupo-cab' }, icone('alerta', { tamanho: 14 }), 'Sem módulo', h('span', { class: 'qtd' }, String(orfaos.length))),
          h('div', { class: 'arvore-itens' }, orfaos.map((el) => h('button', {
            class: ['arvore-item', el.id === ativo && 'ativo'], title: `Módulo "${el.modulo}" não instalado`,
            onClick: () => acoes.abrirElemento(el.id),
            onContextmenu: (e) => menuContexto(e, menuElemento(el)),
          }, icone('documento', { tamanho: 15 }), h('span', { class: 'codigo' }, el.codigo), h('span', { class: 'nome' }, el.modulo))))));
      }
      raiz.append(arvore);
    },
  };
}

/**
 * Estado resumido de um grupo: laranja se algum elemento não passou (mesmo que desatualizado), verde se todos
 * passaram, anel vazio se algum ainda não foi calculado ou está desatualizado.
 */
function resumoEstado(els) {
  if (!els.length) return 'vazio';
  if (els.some((e) => e.resultado && e.resultado.ok === false)) return 'grupo-falha';
  if (els.every((e) => e.resultado?.ok && !e.resultado.desatualizado)) return 'ok';
  return 'desatualizado';
}
const tituloEstado = { 'grupo-falha': 'Algum elemento do grupo não atende', ok: 'Todos os elementos do grupo atendem', desatualizado: 'Há elementos não calculados ou desatualizados', vazio: '' };

function menuNovo(acoes) {
  const lista = modulos.lista().map((m) => ({ rotulo: m.nome, icone: m.icone, acao: () => acoes.criar(m.id) }));
  const i = lista.findIndex((x) => x.rotulo === 'Viga de concreto armado');
  lista.splice(i + 1, 0, { rotulo: 'Viga baldrame', icone: 'viga', acao: () => comandos.executar('estrutura.vigaBaldrame') });
  return lista;
}

function menuElemento(el) {
  return [
    { rotulo: 'Abrir', icone: 'documento', acao: () => comandos.executar('elemento.abrir', el.id) },
    { rotulo: 'Calcular', icone: 'calcular', tecla: 'F5', acao: () => comandos.executar('elemento.calcular', el.id) },
    { rotulo: 'Mostrar na montagem', icone: 'planta', acao: () => comandos.executar('estrutura.montagem', el.id) },
    { rotulo: 'Exportar PDF…', icone: 'pdf', acao: () => comandos.executar('elemento.exportarPdf', el.id) },
    '-',
    { rotulo: 'Editar código e nome…', icone: 'editar', tecla: 'F2', acao: () => comandos.executar('elemento.renomear', el.id) },
    { rotulo: 'Duplicar', icone: 'copiar', acao: () => comandos.executar('elemento.duplicar', el.id) },
    '-',
    { rotulo: 'Excluir', icone: 'lixeira', tecla: 'Delete', perigo: true, acao: () => comandos.executar('elemento.excluir', el.id) },
  ];
}

/** Lista de módulos instalados e planejados. */
export function visaoModulos({ planejados }) {
  return {
    id: 'modulos',
    titulo: 'Módulos',
    icone: 'modulos',
    acoes: () => [ui.botaoIcone({ icone: 'pasta', titulo: 'Abrir pasta de módulos externos', aoClicar: () => comandos.executar('modulos.abrirPasta') })],
    render(raiz) {
      const lista = h('div', { class: 'lista-lateral' });
      lista.append(h('span', { class: 'rotulo-caixa' }, `Instalados · ${modulos.lista().length}`));
      for (const m of modulos.lista()) {
        lista.append(h('div', { class: 'modulo-card' },
          h('div', { class: 'topo' }, icone(m.icone, { tamanho: 16 }), h('strong', null, m.nome)),
          h('div', { class: 'meta' }, h('span', null, m.sigla), h('span', null, m.norma), h('span', null, `v${m.versao}`), h('span', null, m.origem === 'interno' ? 'interno' : 'externo')),
          m.descricao && h('p', null, m.descricao)));
      }
      for (const f of modulos.falhas) {
        lista.append(h('div', { class: 'modulo-card planejado' },
          h('div', { class: 'topo' }, icone('alerta', { tamanho: 16 }), h('strong', null, 'Falha ao carregar')),
          h('p', null, `${f.origem}: ${f.erro}`)));
      }
      lista.append(h('span', { class: 'rotulo-caixa' }, 'Planejados'));
      for (const p of planejados) {
        lista.append(h('div', { class: 'modulo-card planejado' },
          h('div', { class: 'topo' }, icone(p.icone, { tamanho: 16 }), h('strong', null, p.nome)),
          h('div', { class: 'meta' }, h('span', null, p.categoria), h('span', null, p.norma)),
          h('p', null, p.descricao)));
      }
      lista.append(ui.botao({ texto: 'Como criar um módulo', icone: 'info', tipo: 'fantasma', aoClicar: () => comandos.executar('ajuda.modulos') }));
      raiz.append(lista);
    },
  };
}
