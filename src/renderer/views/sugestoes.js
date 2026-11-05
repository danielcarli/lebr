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
/** Seção "Como fazer atender" (0.32): sugestões de seção para o elemento que não atende, com o botão de aplicar. */
import { h, limpar } from '../ui/dom.js';
import * as ui from '../ui/componentes.js';
import { icone } from '../ui/icones.js';
import { estado } from '../core/estado.js';
import { modulos } from '../core/modulos.js';
import * as motor from '../core/motor.js';
import { sugestoesDisponiveis, gravar } from '../../modules/comum/sugestoes.js';

// a busca recalcula o elemento várias vezes: guarda o resultado enquanto os dados do elemento não mudam
const cache = new Map();
const assinatura = (el) => JSON.stringify({ ...el, resultado: undefined, nome: undefined }) + (el.resultado?.calculadoEm ?? '');

/**
 * @param {object} ctx  contexto do editor do elemento
 * @param {{aoPronto?: () => void}} [op]
 */
export function secaoSugestoes(ctx, { aoPronto } = {}) {
  const el = ctx.elemento;
  if (!sugestoesDisponiveis(el.modulo)) return null;
  const corpo = h('div', { class: 'sug-corpo' }, h('p', { class: 'sug-buscando' }, h('i', { class: 'giro' }), 'Procurando a menor alteração que faz o elemento atender…'));
  const secao = ui.secao({ numero: '', titulo: 'Como fazer atender', descricao: 'A menor seção que passa em todas as verificações deste elemento', classe: 'secao-sugestoes', filhos: [corpo] });
  const chave = `${el.id}|${assinatura(el)}`;
  const mostrar = (s) => {
    if (!corpo.isConnected && !secao.isConnected) return;
    limpar(corpo);
    if (s.erro) { corpo.append(h('p', { class: 'sug-nada' }, `Não foi possível procurar sugestões: ${s.erro}`)); return; }
    if (!s.opcoes.length) { corpo.append(h('p', { class: 'sug-nada' }, icone('info', { tamanho: 14, traco: 1.8 }), s.semSugestao)); return; }
    corpo.append(h('div', { class: 'sug-lista' }, s.opcoes.map((o, i) => h('div', { class: ['sug-opcao', i === 0 && 'melhor'] },
      h('div', { class: 'sug-txt' },
        h('span', { class: 'sug-rot' }, i === 0 ? 'Menor alteração' : `Alternativa ${i}`),
        h('strong', null, o.rotulo),
        h('span', { class: 'sug-fam' }, o.familia === 'bitolas' ? 'sem mudar a seção' : `mudando ${o.familia}`)),
      ui.botao({
        texto: 'Aplicar', icone: 'check', tipo: i === 0 ? 'primario' : 'secundario',
        titulo: 'Grava a alteração no elemento e recalcula',
        aoClicar: () => {
          ctx.alterar((e) => { for (const a of o.alteracoes) gravar(e, a.caminho, a.valor); }, { descricao: `Sugestão: ${o.rotulo}`, estrutural: true });
          ctx.calcular?.();
        },
      })))),
    h('p', { class: 'sug-nota' }, `${s.avaliadas} combinações calculadas, com as cargas atuais vindas dos outros elementos. Depois de aplicar, o elemento é recalculado — o peso próprio maior entra na conta, e os elementos que recebem as cargas dele ficam para recalcular.`));
    aoPronto?.();
  };
  if (cache.has(chave)) queueMicrotask(() => mostrar(cache.get(chave)));
  else {
    motor.sugerir(el, estado.projeto, modulos)
      .then((s) => { cache.set(chave, s); if (cache.size > 40) cache.delete(cache.keys().next().value); mostrar(s); })
      .catch((err) => mostrar({ erro: err.message, opcoes: [] }));
  }
  return secao;
}
