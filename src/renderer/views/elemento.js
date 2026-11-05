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
    get materiais() { return contextoConcreto(estado.projeto.parametros); },
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
  pagina.append(cabecalho, entrada, barra, resultados);
  container.append(pagina);

  function desenharCabecalho() {
    const e = estado.elemento(id);
    const st = estadoDoResultado(e);
    limpar(cabecalho).append(ui.cabecalhoObjeto({
      rotulo: mod.nome,          // o tipo de estrutura no lugar de "Elemento" (sem repetir abaixo)
      numero: e.codigo,
      compacto: true,
      etiquetas: ['LEBR', mod.nomeCurto ?? mod.nome, mod.material || 'Módulo'],
      simbolo: mod.forma || mod.icone || 'modulos',
      linha2: `${mod.norma} · Módulo ${mod.id} (${mod.sigla})`,
      titulo: e.nome,
      subtitulo: mod.resumo?.(e) ?? '',
      estado: { texto: st.texto, tipo: st.tipo },
      aoRenomear: (nome) => ctx.alterar((x) => { x.nome = nome; }, { descricao: 'Renomear', invalidar: false }),
      aoEditarCodigo: () => comandos.executar('elemento.renomear', id),
    }));
  }

  function desenharBarra() {
    const e = estado.elemento(id);
    const r = e.resultado;
    limpar(barra).append(
      ui.botao({ texto: 'Calcular', icone: 'calcular', tipo: 'primario', tecla: 'F5', aoClicar: () => acoes.calcular(id) }),
      h('span', { class: 'barra-info' },
        !r ? 'Preencha os dados e calcule o elemento.'
          : r.desatualizado ? 'Os dados mudaram desde o último cálculo — recalcule para atualizar os resultados.'
            : `Calculado em ${dataHora(r.calculadoEm)}`),
      (() => {
        const mt = montagemDoProjeto().get(id);
        if (mt?.estado !== 'erro') return '';
        return h('button', { class: 'montagem-aviso', title: `${mt.problemas.join('\n')}\n\nClique para abrir a montagem.`, onClick: () => comandos.executar('estrutura.montagem', id) },
          h('i', { class: 'ponto-montagem erro' }), `Montagem: ${mt.problemas.length} problema${mt.problemas.length > 1 ? 's' : ''}`);
      })(),
      h('span', { style: { flex: '1' } }),
      r && !r.erro ? ui.botao({ texto: 'Memorial no painel', icone: 'painel', tipo: 'fantasma', aoClicar: () => acoes.mostrarMemorial(id) }) : '',
      ui.botao({ texto: 'Exportar PDF', icone: 'pdf', tipo: 'fantasma', aoClicar: () => acoes.exportarPdf(id) }),
    );
    resultados.classList.toggle('desatualizado', !!r?.desatualizado);
  }

  function desenharEntrada() {
    limpar(entrada);
    try { mod.renderEntrada(entrada, ctx); } catch (err) {
      console.error(err);
      entrada.append(ui.vazio({ icone: 'alerta', titulo: 'Erro ao montar o editor', texto: err.message }));
    }
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
    resultados.append(ui.secao({ numero: '', titulo: 'Resultados', descricao: r.ok ? 'Todas as verificações atendidas' : 'Há verificações não atendidas', acoes: [ui.selo(r.ok, r.ok ? 'Atende' : 'Não atende')], filhos: [avisos, corpo] }));
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

  desenharCabecalho();
  desenharEntrada();
  desenharBarra();
  desenharResultados();
  numerar();

  return {
    aoAlterar(info) {
      if (!estado.elemento(id)) return false;
      if (info.historico || info.tipo === 'parametros') return false;
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
