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
 * Situação de montagem dos elementos (a segunda bolinha do explorador), refeita só quando o modelo muda — um
 * cálculo não mexe nas posições nem nas ligações, então não invalida.
 */
import { estado } from './estado.js';
import { modulos } from './modulos.js';
import { estadoMontagem } from './montagem.js';
import { verificarConsistencia } from './consistencia.js';

let cache = null, cacheProblemas = null;
estado.on('alterado', (info) => { if (!info?.calculo) { cache = null; cacheProblemas = null; } });
estado.on('projeto', () => { cache = null; cacheProblemas = null; });

/** Problemas de consistência do projeto aberto (painel de problemas; os erros bloqueiam o cálculo). */
export function problemasDoProjeto() {
  if (!estado.projeto) return [];
  if (!cacheProblemas || cacheProblemas.projeto !== estado.projeto) cacheProblemas = { projeto: estado.projeto, lista: verificarConsistencia(estado.projeto, modulos) };
  return cacheProblemas.lista;
}

/** Mapa id → { estado: 'sem-posicao' | 'ok' | 'erro', problemas } do projeto aberto. */
export function montagemDoProjeto() {
  if (!estado.projeto) return new Map();
  if (!cache || cache.projeto !== estado.projeto) {
    const mapa = estadoMontagem(estado.projeto, modulos);
    // os erros do painel de problemas que a montagem por elemento não vê (cruzamentos, sobreposições…)
    for (const p of problemasDoProjeto()) {
      if (p.gravidade !== 'erro' || !p.elemento) continue;
      const m = mapa.get(p.elemento.id);
      if (!m || m.estado === 'sem-posicao') continue;
      if (!m.problemas.includes(p.texto)) m.problemas.push(p.texto);
      m.estado = 'erro';
    }
    cache = { projeto: estado.projeto, mapa };
  }
  return cache.mapa;
}
