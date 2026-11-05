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
 * Worker de cálculo (0.32): roda os cálculos dos módulos internos fora da linha da interface, para que a janela
 * continue respondendo enquanto um projeto grande (ou uma otimização das bitolas) é calculado.
 *
 * Mensagens recebidas: { pedido, tipo: 'um' | 'varios' | 'sugerir', projeto, alvo?, ids? }.
 * Respostas: { pedido, resultado } · { pedido, parcial: { id, resultado, i } } · { pedido, fim: true } ·
 * { pedido, sugestoes } · { pedido, erro }.
 */
import { calcularElemento } from './calculo.js';
import { MODULOS_CALCULO } from '../../validacao/calculos.js';
import { sugerirCorrecao } from '../../modules/comum/sugestoes.js';

const registro = { obter: (id) => MODULOS_CALCULO[id] };

self.onmessage = (ev) => {
  const { pedido, tipo, projeto, alvo, ids } = ev.data ?? {};
  try {
    if (tipo === 'um') {
      const el = projeto.elementos.find((e) => e.id === alvo);
      if (!el) throw new Error('Elemento não encontrado.');
      self.postMessage({ pedido, resultado: calcularElemento(el, projeto, registro) });
    } else if (tipo === 'varios') {
      // em ordem: cada resultado fica no elemento antes do seguinte, como no cálculo na interface
      for (const [i, id] of ids.entries()) {
        const el = projeto.elementos.find((e) => e.id === id);
        if (!el) continue;
        el.resultado = calcularElemento(el, projeto, registro);
        self.postMessage({ pedido, parcial: { id, resultado: el.resultado, i } });
      }
      self.postMessage({ pedido, fim: true });
    } else if (tipo === 'sugerir') {
      const el = projeto.elementos.find((e) => e.id === alvo);
      if (!el) throw new Error('Elemento não encontrado.');
      self.postMessage({ pedido, sugestoes: sugerirCorrecao(el, projeto, (x) => calcularElemento(x, projeto, registro)) });
    } else {
      throw new Error(`Pedido desconhecido: ${tipo}`);
    }
  } catch (err) {
    self.postMessage({ pedido, erro: err?.message ?? String(err) });
  }
};
