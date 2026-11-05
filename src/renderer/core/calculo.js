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
 * Contexto de cálculo entregue aos módulos.
 *
 * Mantido sem dependências de interface para que os cálculos possam ser
 * executados e testados fora do Electron (ver test/modulos.test.js).
 */
import { contextoConcreto } from '../../engine/materiais.js';
import { criterioDe, otimizarBitolas, memorialOtimizacao, POSICOES_OTIMIZAVEIS } from '../../modules/comum/otimizacao.js';

/**
 * @param {object} projeto
 * @param {{obter(id:string):object}} registro  registro de módulos
 * @param {string[]} pilha  elementos já em cálculo (detecta dependência circular)
 */
export function contextoCalculo(projeto, registro, pilha = []) {
  const ctx = {
    projeto,
    parametros: projeto.parametros,
    materiais: contextoConcreto(projeto.parametros),
    elemento: (id) => projeto.elementos.find((e) => e.id === id) ?? null,
    modulo: (id) => registro.obter(id),

    /**
     * Cargas características que um elemento transmite por uma ligação
     * (ex.: reação da laje na borda "x0", reação da viga no "apoio-1").
     * @returns {{g:number, q:number}}  kN/m para ligações lineares, kN para pontuais
     */
    cargasDe(elementoId, ligacao) {
      if (pilha.includes(elementoId)) throw new Error('Dependência circular entre cargas de elementos.');
      const el = ctx.elemento(elementoId);
      if (!el) throw new Error('A carga referencia um elemento que não existe mais.');
      const mod = registro.obter(el.modulo);
      if (!mod?.cargasTransmitidas) throw new Error(`O módulo de ${el.codigo} não transmite cargas.`);
      const r = mod.cargasTransmitidas(el, contextoCalculo(projeto, registro, [...pilha, elementoId]));
      if (!r[ligacao]) throw new Error(`${el.codigo} não possui a ligação "${ligacao}".`);
      return r[ligacao];
    },
  };
  return ctx;
}

/** Executa o cálculo de um elemento e devolve o resultado (ou um resultado de erro). */
export function calcularElemento(el, projeto, registro) {
  const mod = registro.obter(el.modulo);
  if (!mod) throw new Error(`Módulo "${el.modulo}" não instalado.`);
  try {
    const criterio = criterioDe(el);
    // na otimização, as cargas vindas de outros elementos não mudam entre as combinações: um contexto só, com cache
    const ctxCalc = contextoCalculo(projeto, registro, [el.id]);
    if (criterio) {
      const cache = new Map(), original = ctxCalc.cargasDe;
      ctxCalc.cargasDe = (id, lig) => {
        const k = `${id}\u0000${lig}`;
        if (!cache.has(k)) cache.set(k, original(id, lig));
        return cache.get(k);
      };
    }
    const calcular = (e) => mod.calcular(e, ctxCalc);
    if (criterio) {
      // otimização das bitolas (0.30): recalcula com as combinações e fica com a melhor que atende
      const { resultado, otimizacao } = otimizarBitolas(el, projeto, calcular, criterio);
      if (resultado?.erro) throw new Error(resultado.erro);
      return {
        ...resultado, otimizacao,
        memorial: [...(resultado.memorial ?? []), memorialOtimizacao(otimizacao, POSICOES_OTIMIZAVEIS[el.modulo])],
        calculadoEm: new Date().toISOString(), desatualizado: false,
      };
    }
    const r = calcular(el);
    return { ...r, calculadoEm: new Date().toISOString(), desatualizado: false };
  } catch (err) {
    return {
      ok: false, erro: err.message, calculadoEm: new Date().toISOString(), desatualizado: false,
      verificacoes: [], avisos: [err.message], memorial: [],
    };
  }
}
