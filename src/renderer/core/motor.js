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
 * Motor de cálculo da interface (0.32): manda os cálculos para um Web Worker quando todos os elementos do projeto
 * são de módulos internos; senão (módulo externo instalado, Worker indisponível), calcula aqui mesmo, como antes.
 * Os resultados são os mesmos nos dois caminhos — o Worker usa as mesmas funções de cálculo.
 */
import { calcularElemento } from './calculo.js';
import { sugerirCorrecao } from '../../modules/comum/sugestoes.js';

let worker = null;
let indisponivel = false;
let seq = 0;
const pendentes = new Map(); // pedido → { ok, falha, parcial }

function obterWorker() {
  if (worker || indisponivel || typeof Worker === 'undefined') return worker;
  try {
    worker = new Worker(new URL('./calculo-worker.js', import.meta.url), { type: 'module', name: 'lebr-calculo' });
    worker.onmessage = (ev) => {
      const m = ev.data ?? {};
      const p = pendentes.get(m.pedido);
      if (!p) return;
      if (m.parcial) { p.parcial?.(m.parcial); return; }
      pendentes.delete(m.pedido);
      if (m.erro) p.falha(new Error(m.erro));
      else p.ok(m.fim ? true : m.sugestoes ?? m.resultado);
    };
    worker.onerror = (ev) => {
      // o Worker não carregou (ou caiu): tudo volta a ser calculado na interface
      ev.preventDefault?.();
      indisponivel = true;
      worker?.terminate();
      worker = null;
      for (const [k, p] of pendentes) { pendentes.delete(k); p.falha(Object.assign(new Error('Worker indisponível'), { semWorker: true })); }
    };
  } catch {
    indisponivel = true;
    worker = null;
  }
  return worker;
}

/** O projeto pode ir para o Worker? (só módulos internos, que o Worker conhece) */
function podeUsarWorker(projeto, registro) {
  if (indisponivel) return false;
  return projeto.elementos.every((e) => registro.obter(e.modulo)?.origem === 'interno');
}

function pedir(msg, parcial) {
  const w = obterWorker();
  if (!w) return Promise.reject(Object.assign(new Error('Worker indisponível'), { semWorker: true }));
  const pedido = ++seq;
  return new Promise((ok, falha) => {
    pendentes.set(pedido, { ok, falha, parcial });
    // só dados: o projeto vai como JSON (sem funções nem objetos da interface)
    w.postMessage({ ...msg, pedido, projeto: JSON.parse(JSON.stringify(msg.projeto)) });
  });
}

const comCarimbo = (r) => ({ ...r, calculadoEm: r.calculadoEm ?? new Date().toISOString(), desatualizado: false });

/** Calcula um elemento (Promise do resultado). */
export async function calcularUm(el, projeto, registro) {
  if (podeUsarWorker(projeto, registro)) {
    try { return comCarimbo(await pedir({ tipo: 'um', alvo: el.id, projeto })); } catch (err) { if (!err.semWorker) throw err; }
  }
  return calcularElemento(el, projeto, registro);
}

/**
 * Calcula vários elementos em ordem. `aoResultado(id, resultado, i)` é chamado a cada um (para aplicar no projeto e
 * mostrar o progresso). Na interface, dá a vez para a janela entre os elementos.
 */
export async function calcularVarios(ids, projeto, registro, aoResultado) {
  if (podeUsarWorker(projeto, registro)) {
    try {
      await pedir({ tipo: 'varios', ids, projeto }, ({ id, resultado, i }) => aoResultado(id, resultado, i));
      return;
    } catch (err) { if (!err.semWorker) throw err; }
  }
  let marca = performance.now();
  for (const [i, id] of ids.entries()) {
    const el = projeto.elementos.find((e) => e.id === id);
    if (!el) continue;
    const r = calcularElemento(el, projeto, registro);
    el.resultado = r;
    aoResultado(id, r, i);
    if (performance.now() - marca > 60) { await new Promise((ok) => setTimeout(ok, 0)); marca = performance.now(); }
  }
}

/** Sugestões para fazer o elemento atender (ver modules/comum/sugestoes.js). */
export async function sugerir(el, projeto, registro) {
  if (podeUsarWorker(projeto, registro)) {
    try { return await pedir({ tipo: 'sugerir', alvo: el.id, projeto }); } catch (err) { if (!err.semWorker) throw err; }
  }
  return sugerirCorrecao(el, projeto, (x) => calcularElemento(x, projeto, registro));
}

/** Diagnóstico (console): o cálculo está indo para o Worker? */
export const usandoWorker = () => !!worker && !indisponivel;
