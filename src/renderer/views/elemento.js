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
 * Editor de elemento — moldura comum a todos os módulos:
 * cabeçalho de ficha, entrada de dados (do módulo), barra de cálculo,
 * resultados (do módulo), verificações e memorial.
 */
import { h, limpar } from '../ui/dom.js';
import * as ui from '../ui/componentes.js';
import { icone } from '../ui/icones.js';
import { estado } from '../core/estado.js';
import { modulos } from '../core/modulos.js';
import { contextoCalculo } from '../core/calculo.js';
import { contextoConcreto } from '../../engine/materiais.js';
import { dataHora } from '../core/formatar.js';
import { montagemDoProjeto } from '../core/situacao-montagem.js';
import { comandos } from '../core/comandos.js';
import { abrirMenu } from '../ui/menus.js';
import { secaoSugestoes } from './sugestoes.js';
import { aceitaCriterios, criteriosDoElemento, criteriosEfetivos, avisosDeCriterios, CLASSES_FCK, tipoDeCobrimento } from '../core/criterios.js';
import { parametrosDoElemento } from '../core/criterios.js';

/* ------------------------------------------------------------------ estado "calculando" (cálculo no Worker, 0.32) */
const calculando = new Set(); // ids em cálculo
const instancias = new Map(); // id → { desenharBarra } das abas abertas
export const emCalculo = (id) => calculando.has(id);
/** Marca (ou desmarca) o elemento como "em cálculo" — chamado por quem dispara o cálculo. */
export function marcarCalculo(id, sim) {
  if (sim) calculando.add(id); else calculando.delete(id);
  instancias.get(id)?.desenharBarra();
}

export function estadoDoResultado(el) {
  const r = el?.resultado;
  if (!r) return { texto: 'Não calculado', tipo: 'desatualizado', classe: '' };
  // desatualizado: o anel fica terracota se o último cálculo não atendeu
  if (r.desatualizado) return { texto: 'Desatualizado', tipo: 'desatualizado', classe: r.ok === false ? 'desatualizado falhou' : 'desatualizado' };
  if (r.ok) return { texto: 'Atende', tipo: 'ok', classe: 'ok' };
  return { texto: 'Não atende', tipo: 'falha', classe: 'falha' };
}

/**
 * Cria a definição de aba para um elemento.
 * @param {string} id
 * @param {object} acoes  { calcular(id), abrirElemento(id), api }
 */
export function abaElemento(id, acoes) {
  return {
    id: `el:${id}`,
    elementoId: id,
    get icone() { return modulos.obter(estado.elemento(id)?.modulo)?.icone ?? 'documento'; },
    titulo: () => {
      const el = estado.elemento(id);
      if (!el) return '—';
      return el.nome && el.nome !== el.codigo ? `${el.codigo} · ${el.nome}` : el.codigo;
    },
    dica: () => modulos.obter(estado.elemento(id)?.modulo)?.nome ?? '',
    marcada: () => !!estado.elemento(id)?.resultado?.desatualizado,
    render: (container) => renderizar(container, id, acoes),
  };
}

function renderizar(container, id, acoes) {
  const el = estado.elemento(id);
  const mod = modulos.obter(el?.modulo);
  if (!el) return;
  if (!mod) {
    container.append(h('div', { class: 'pagina' }, ui.vazio({
      icone: 'alerta', titulo: `Módulo "${el.modulo}" não instalado`,
      texto: 'Este elemento foi criado por um módulo que não está disponível. Os dados continuam preservados no arquivo do projeto.',
    })));
    return;
  }

  const token = {};
  const ctx = {
    api: acoes.api,
    get elemento() { return estado.elemento(id); },
    get projeto() { return estado.projeto; },
    get materiais() { return contextoConcreto(parametrosDoElemento(estado.projeto.parametros, estado.elemento(id))); },
    contextoCalculo: () => contextoCalculo(estado.projeto, modulos, [id]),
    alterar(fn, op = {}) {
      estado.alterar((p) => fn(estado.elemento(id), p), {
        descricao: op.descricao ?? `Editar ${estado.elemento(id).codigo}`,
        elementoId: id, origem: token, estrutural: !!op.estrutural, invalidar: op.invalidar,
      });
    },
    /** Elementos que podem transmitir carga por ligações do tipo indicado. */
    fontesDeCarga(tipo) {
      return estado.projeto.elementos
        .filter((e) => e.id !== id)
        .map((e) => {
          const m = modulos.obter(e.modulo);
          const ligs = m?.ligacoes?.(e).filter((l) => l.tipo === tipo) ?? [];
          return { elemento: e, modulo: m, ligacoes: ligs };
        })
        .filter((x) => x.ligacoes.length);
    },
    abrirElemento: (outro) => acoes.abrirElemento(outro),
    calcular: () => acoes.calcular(id),
  };

  const pagina = h('div', { class: 'pagina' });
  const cabecalho = h('div');
  const barra = h('div', { class: 'barra-calculo' });
  const entrada = h('div', { class: 'bloco' });
  const resultados = h('div', { class: 'bloco' });
  const indice = h('nav', { class: 'indice-secoes', 'aria-label': 'Seções da página' });
  // a barra de cálculo fica logo abaixo do cabeçalho e acompanha a rolagem (estado sempre à vista)
  pagina.append(cabecalho, barra, entrada, resultados);
  container.append(h('div', { class: 'pagina-elemento' }, pagina, indice));
  const rolagem = () => container.closest?.('.editor') ?? container;

  function desenharCabecalho() {
    const e = estado.elemento(id);
    // o estado (Atende / Não atende / a calcular) fica só no chip da barra de cálculo, logo abaixo
    limpar(cabecalho).append(ui.cabecalhoObjeto({
      rotulo: mod.nome,          // o tipo de estrutura no lugar de "Elemento" (sem repetir abaixo)
      numero: e.codigo,
      compacto: true,
      etiquetas: ['LEBR', mod.nomeCurto ?? mod.nome, mod.material || 'Módulo'],
      simbolo: mod.forma || mod.icone || 'modulos',
      linha2: `${mod.norma} · Módulo ${mod.id} (${mod.sigla})`,
      titulo: e.nome,
      subtitulo: mod.resumo?.(e) ?? '',
      aoRenomear: (nome) => ctx.alterar((x) => { x.nome = nome; }, { descricao: 'Renomear', invalidar: false }),
      aoEditarCodigo: () => comandos.executar('elemento.renomear', id),
    }));
  }

  /** Seções da página, na ordem, com o grupo (dados ou resultados). */
  const secoes = () => [...pagina.querySelectorAll('.secao')].map((sec, i) => ({
    sec, i, titulo: sec.querySelector(':scope > .secao-cab .secao-titulo')?.textContent ?? `Seção ${i + 1}`,
    num: sec.querySelector(':scope > .secao-cab .secao-num')?.textContent ?? '', grupo: resultados.contains(sec) ? 'Resultados' : 'Dados',
  }));
  const irPara = (sec) => sec?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  const secaoVerificacoes = () => [...resultados.querySelectorAll('.secao')].find((x) => x.querySelector('.secao-titulo')?.textContent === 'Verificações');

  function chipEstado(e) {
    const r = e.resultado;
    if (calculando.has(id)) return h('span', { class: 'estado-chip calculando' }, h('i', { class: 'giro' }), 'Calculando…');
    if (!r) return h('span', { class: 'estado-chip pendente' }, icone('relogio2', { tamanho: 14, traco: 1.8 }), 'Não calculado');
    if (r.erro) return h('span', { class: 'estado-chip falha' }, icone('alerta', { tamanho: 14, traco: 1.8 }), 'Erro no cálculo');
    const falhas = (r.verificacoes ?? []).filter((v) => !v.ok);
    const desat = r.desatualizado ? ' (desatualizado)' : '';
    if (r.ok) return h('span', { class: ['estado-chip', r.desatualizado ? 'pendente' : 'ok'] }, icone(r.desatualizado ? 'relogio2' : 'check', { tamanho: 14, traco: 2 }), `Atende${desat}`);
    return h('button', {
      class: ['estado-chip', r.desatualizado ? 'pendente' : 'falha'],
      title: falhas.length ? `${falhas.map((v) => `✕ ${v.nome}`).join('\n')}\n\nClique para ir às verificações.` : 'Ir às verificações',
      onClick: () => irPara(secaoVerificacoes()),
    }, icone('alerta', { tamanho: 14, traco: 1.8 }),
    falhas.length ? `${falhas.length} verificação${falhas.length > 1 ? 'ões' : ''} não atendida${falhas.length > 1 ? 's' : ''}${desat}` : `Não atende${desat}`);
  }

  function desenharBarra() {
    const e = estado.elemento(id);
    if (!e) return;
    const r = e.resultado;
    const bloqueio = acoes.bloqueio?.(id) ?? [];
    const bloqueia = bloqueio.length > 0 && !!acoes.bloqueia?.();
    limpar(barra).append(
      ui.botao({ texto: 'Calcular', icone: 'calcular', tipo: 'primario', tecla: 'F5', desabilitado: calculando.has(id) || bloqueia, aoClicar: () => acoes.calcular(id) }),
      chipEstado(e),
      bloqueio.length ? h('span', { class: 'barra-info bloqueio' }, icone('alerta', { tamanho: 13, traco: 1.8 }), `${bloqueia ? 'Cálculo bloqueado' : 'Erro de montagem'}: ${bloqueio[0].texto} `,
        h('button', { class: 'link', onClick: () => acoes.verProblemas?.() }, 'Ver problemas')) : h('span', { class: 'barra-info' },
        !r ? 'Preencha os dados e calcule o elemento.'
          : r.desatualizado ? 'Os dados mudaram — recalcule para atualizar.'
            : `Calculado em ${dataHora(r.calculadoEm)}`),
      (() => {
        const mt = montagemDoProjeto().get(id);
        if (mt?.estado !== 'erro') return '';
        return h('button', { class: 'montagem-aviso', title: `${mt.problemas.join('\n')}\n\nClique para abrir a montagem.`, onClick: () => comandos.executar('estrutura.montagem', id) },
          h('i', { class: 'ponto-montagem erro' }), `Montagem: ${mt.problemas.length} problema${mt.problemas.length > 1 ? 's' : ''}`);
      })(),
      h('span', { style: { flex: '1' } }),
      ui.botaoIcone({ icone: 'reticencias', titulo: 'Ir para uma seção', classe: 'so-estreito', aoClicar: (ev) => abrirMenu(menuSecoes(), { ancora: ev.currentTarget }) }),
      /laje\.(macica|trelicada|nervurada|alveolar)$/.test(e?.modulo ?? '') ? ui.botao({ texto: 'Converter', icone: 'laje', tipo: 'fantasma', titulo: 'Converter em outro tipo de laje (maciça, treliçada, nervurada ou alveolar)', aoClicar: () => comandos.executar('elemento.converterLaje', id) }) : '',
      r && !r.erro ? ui.botao({ texto: 'Memorial', icone: 'painel', tipo: 'fantasma', titulo: 'Memorial de cálculo no painel', aoClicar: () => acoes.mostrarMemorial(id) }) : '',
      ui.botao({ texto: 'PDF', icone: 'pdf', tipo: 'fantasma', titulo: 'Exportar o elemento em PDF', aoClicar: () => acoes.exportarPdf(id) }),
    );
    resultados.classList.toggle('desatualizado', !!r?.desatualizado);
  }

  function menuSecoes() {
    const itens = [];
    let grupo = null;
    for (const x of secoes()) {
      if (x.grupo !== grupo) { if (grupo) itens.push('-'); itens.push({ cabecalho: x.grupo }); grupo = x.grupo; }
      itens.push({ rotulo: `${x.num} ${x.titulo}`, acao: () => irPara(x.sec) });
    }
    return itens;
  }

  /** Índice lateral (telas largas): as seções, com a atual em destaque enquanto a página rola. */
  function montarIndice() {
    const lista = secoes();
    limpar(indice).append(h('span', { class: 'indice-tit' }, 'Nesta página'));
    let grupo = null;
    for (const x of lista) {
      if (x.grupo !== grupo) { indice.append(h('span', { class: 'indice-grupo' }, x.grupo)); grupo = x.grupo; }
      const falhou = x.grupo === 'Resultados' && x.titulo === 'Verificações' && estado.elemento(id)?.resultado?.ok === false;
      indice.append(h('button', { class: ['indice-item', falhou && 'falha'], dataset: { i: String(x.i) }, onClick: () => irPara(x.sec) },
        h('span', { class: 'indice-num' }, x.num), h('span', { class: 'indice-txt' }, x.titulo)));
    }
    marcarAtual();
  }
  function marcarAtual() {
    const sc = rolagem();
    if (!sc?.getBoundingClientRect || !indice.isConnected) return;
    const topo = sc.getBoundingClientRect().top + 90;
    let atual = 0;
    secoes().forEach((x) => { if (x.sec.getBoundingClientRect().top <= topo) atual = x.i; });
    indice.querySelectorAll('.indice-item').forEach((b) => b.classList.toggle('atual', Number(b.dataset.i) === atual));
  }
  let quadro = 0;
  const aoRolar = () => { if (!quadro) quadro = requestAnimationFrame(() => { quadro = 0; marcarAtual(); }); };
  queueMicrotask(() => rolagem()?.addEventListener?.('scroll', aoRolar, { passive: true }));

  function desenharEntrada() {
    limpar(entrada);
    try { mod.renderEntrada(entrada, ctx); } catch (err) {
      console.error(err);
      entrada.append(ui.vazio({ icone: 'alerta', titulo: 'Erro ao montar o editor', texto: err.message }));
    }
    const e = estado.elemento(id);
    if (aceitaCriterios(e)) entrada.append(secaoCriterios(e));
  }

  /** Critérios do elemento (etapa L7): exceção de fck e de cobrimento sobre os parâmetros do projeto. */
  function secaoCriterios(e) {
    const par = estado.projeto.parametros;
    const c = criteriosDoElemento(e);
    const ef = criteriosEfetivos(par, e);
    const tipo = tipoDeCobrimento(e);
    const cobProjeto = tipo === 'solo' ? null : par.cobrimento?.[tipo];
    const mudar = (campo, v) => ctx.alterar((x) => {
      x.criterios = { ...(x.criterios ?? {}), [campo]: v };
      if (x.criterios[campo] == null) delete x.criterios[campo];
      if (!Object.keys(x.criterios).length) delete x.criterios;
    }, { descricao: campo === 'fck' ? 'Concreto do elemento' : 'Cobrimento do elemento', estrutural: true });
    const cm = (v) => `${String(v).replace('.', ',')} cm`;
    const avisos = avisosDeCriterios(par, e);
    return ui.secao({
      numero: '', titulo: 'Critérios do elemento',
      descricao: `Exceção aos parâmetros do projeto (C${par.concreto.fck}${cobProjeto ? `, cobrimento ${cm(cobProjeto)}` : ''}, CAA ${par.classeAgressividade})`,
      filhos: [
        ui.linhaCampos(
          ui.selecao({ rotulo: 'Concreto', valor: c.fck ?? 0, largura: '190px', opcoes: [{ valor: 0, texto: `Do projeto (C${par.concreto.fck})` }, ...CLASSES_FCK.map((f) => ({ valor: f, texto: `C${f}` }))], aoMudar: (v) => mudar('fck', v || null) }),
          tipo !== 'solo' ? ui.selecao({ rotulo: 'Cobrimento', valor: c.cobrimento ?? 0, largura: '190px', opcoes: [{ valor: 0, texto: `Do projeto (${cm(cobProjeto)})` }, ...[1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5].map((v) => ({ valor: v, texto: cm(v) }))], aoMudar: (v) => mudar('cobrimento', v || null) }) : null,
        ),
        h('p', { class: 'combinacoes-nota' }, `Vale no cálculo deste elemento: C${ef.fck}${ef.cobrimento ? ` e cobrimento ${cm(ef.cobrimento)}` : ''}${ef.fckOrigem === 'elemento' || ef.cobrimentoOrigem === 'elemento' ? ' (exceção do elemento)' : ' (do projeto)'}.`),
        avisos.length ? h('ul', { class: 'avisos' }, avisos.map((a) => h('li', null, icone('alerta', { tamanho: 14, traco: 1.8 }), a))) : null,
      ],
    });
  }

  function desenharResultados() {
    limpar(resultados);
    const r = estado.elemento(id).resultado;
    if (!r) return;
    if (r.erro) {
      resultados.append(ui.secao({ numero: '', titulo: 'Resultados', filhos: [ui.vazio({ icone: 'alerta', titulo: 'Não foi possível calcular', texto: r.erro })] }));
      return;
    }
    const corpo = h('div', { class: 'resultados-corpo' });
    const avisos = (r.avisos ?? []).length
      ? h('ul', { class: 'avisos' }, r.avisos.map((a) => h('li', null, icone('alerta', { tamanho: 14, traco: 1.8 }), a)))
      : null;
    // quando não atende: a menor alteração de seção que faz o elemento atender (0.32), logo no começo dos resultados
    const sug = r.ok === false && !r.desatualizado ? secaoSugestoes(ctx, { aoPronto: () => { numerar(); montarIndice(); } }) : null;
    resultados.append(ui.secao({ numero: '', titulo: 'Resultados', descricao: r.ok ? 'Todas as verificações atendidas' : 'Há verificações não atendidas', acoes: [ui.selo(r.ok, r.ok ? 'Atende' : 'Não atende')], filhos: [avisos, sug, corpo] }));
    try { mod.renderResultado(corpo, r, ctx); } catch (err) {
      console.error(err);
      corpo.append(ui.vazio({ icone: 'alerta', titulo: 'Erro ao exibir resultados', texto: err.message }));
    }
    if (r.verificacoes?.length) resultados.append(ui.secao({ numero: '', titulo: 'Verificações', descricao: `ABNT ${mod.norma}`, filhos: [ui.tabelaVerificacoes(r.verificacoes)] }));
    if (r.memorial?.length) {
      resultados.append(ui.secao({
        numero: '', titulo: 'Memorial de cálculo',
        filhos: [h('div', { class: 'memorial' }, r.memorial.map((m) => h('div', { class: 'memorial-bloco' },
          h('h3', null, m.titulo), m.linhas.map((l) => h('p', null, l)))))],
      }));
    }
  }

  /** Numera as seções na ordem em que aparecem: 01, 02, … */
  function numerar() {
    pagina.querySelectorAll('.secao').forEach((sec) => {
      if (!sec.querySelector(':scope > .secao-cab > .secao-num')) sec.querySelector(':scope > .secao-cab')?.prepend(h('span', { class: 'secao-num' }));
    });
    pagina.querySelectorAll('.secao-num').forEach((n, i) => { n.textContent = String(i + 1).padStart(2, '0'); });
  }

  /** Redesenha a página inteira no lugar, sem perder o campo em foco nem a rolagem (depois de um cálculo). */
  function redesenharNoLugar() {
    const sc = rolagem();
    const topo = sc?.scrollTop ?? 0;
    const focaveis = () => [...pagina.querySelectorAll('input, select, textarea, button, [contenteditable]')];
    const ativo = document.activeElement;
    const idx = ativo && pagina.contains(ativo) ? focaveis().indexOf(ativo) : -1;
    const sel = idx >= 0 && typeof ativo.selectionStart === 'number' ? [ativo.selectionStart, ativo.selectionEnd] : null;
    desenharCabecalho(); desenharBarra(); desenharEntrada(); desenharResultados(); numerar(); montarIndice();
    if (sc) sc.scrollTop = topo;
    if (idx >= 0) {
      const alvo = focaveis()[idx];
      alvo?.focus?.({ preventScroll: true });
      if (sel && alvo?.setSelectionRange) { try { alvo.setSelectionRange(...sel); } catch { /* campo sem seleção */ } }
    }
  }

  desenharCabecalho();
  desenharEntrada();
  desenharBarra();
  desenharResultados();
  numerar();
  montarIndice();
  instancias.set(id, { desenharBarra: () => { if (pagina.isConnected) { desenharBarra(); } } });

  return {
    aoAlterar(info) {
      if (!estado.elemento(id)) return false;
      if (info.historico || info.tipo === 'parametros') return false;
      // resultado novo deste elemento: redesenha no lugar, sem tirar o foco do campo
      if (info.calculo && info.elementoId === id) { redesenharNoLugar(); return true; }
      if (info.origem === token && !info.estrutural) {
        desenharCabecalho();
        desenharBarra();
        return true;
      }
      // mudanças em outros elementos que não alteram a estrutura: só atualiza o estado
      if (info.elementoId && info.elementoId !== id && !info.estrutural) {
        desenharCabecalho();
        desenharBarra();
        return true;
      }
      return false;
    },
  };
}
