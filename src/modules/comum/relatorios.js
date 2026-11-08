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
/** Dados dos relatórios do projeto (0.32): cargas na fundação. Sem interface, para os testes e o PDF. */
import { pilaresNaFundacao } from './pranchas.js';
import { radierDoPilar } from '../../renderer/core/montagem.js';

const FUNDACOES = ['concreto.sapata', 'concreto.bloco'];
/** Linhas da tabela de cargas na fundação: pilares que chegam à fundação, normais e a fundação ligada. */
export function cargasNaFundacao(projeto) {
  const fundacao = (p) => projeto.elementos.find((e) => FUNDACOES.includes(e.modulo) && (e.pilarId === p.id || (Array.isArray(e.cargas) && e.cargas.some((c) => c.tipo === 'elemento' && c.elementoId === p.id)))) ?? radierDoPilar(projeto, p);
  const linhas = pilaresNaFundacao(projeto).map((p) => {
    const r = p.resultado && !p.resultado.erro ? p.resultado : null;
    const F = fundacao(p);
    return {
      id: p.id, codigo: p.codigo, nome: p.nome, bx: p.bx, by: p.by, x: p.posicao?.x, y: p.posicao?.y,
      Ng: r?.Nk?.g ?? null, Nq: r?.Nk?.q ?? null, Nk: r?.Nk ? r.Nk.g + r.Nk.q : null, Nd: r?.Nd ?? null,
      calculado: !!r && !r.desatualizado, fundacao: F ? { codigo: F.codigo, ok: F.resultado?.ok ?? null } : null,
    };
  });
  const soma = (k) => linhas.reduce((t, l) => t + (l[k] ?? 0), 0);
  return { linhas, total: { Ng: soma('Ng'), Nq: soma('Nq'), Nk: soma('Nk'), Nd: soma('Nd') }, pendentes: linhas.filter((l) => !l.calculado).length };
}

