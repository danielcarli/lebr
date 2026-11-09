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
 * Mesa colaborante a partir da montagem: as lajes moldadas no local ligadas à viga dão a espessura da mesa (hf) e,
 * de cada lado, a distância livre até a nervura vizinha (b2 ≈ vão da laje perpendicular à viga − bw).
 * Lajes de um lado só → viga L; dos dois lados → viga T. Lajes pré-moldadas (alveolares) e de madeira não contam.
 */
import { secaoEnvolvente } from '../../engine/viga-secoes.js';
import { eixoViga, cantosLaje, espessuraLaje } from '../../renderer/core/montagem.js';

const MOLDADAS = ['concreto.laje.macica', 'concreto.laje.nervurada', 'concreto.laje.trelicada'];

/** Espessura que trabalha como mesa: a laje maciça inteira; nas nervuradas e treliçadas, só a capa. */
export function hfDaLaje(laje) {
  if (laje.modulo === 'concreto.laje.macica') return espessuraLaje(laje);
  return Number(laje.hf) || null;
}

/** @returns {{ tipo: 'T'|'L', hf, b2a?, b2b?, b2?, b4: 0, lajes: string[] } | null} */
export function mesaDasLajes(projeto, viga) {
  if (!viga?.posicao) return null;
  const { a, u } = eixoViga(viga);
  const n = [-u[1], u[0]];
  const bw = secaoEnvolvente(viga).b / 100;
  const ligadas = (projeto.elementos ?? []).filter((l) => MOLDADAS.includes(l.modulo) && l.posicao
    && (Array.isArray(viga.cargas) ? viga.cargas : []).some((c) => c?.tipo === 'elemento' && c.elementoId === l.id));
  const lados = { '1': [], '-1': [] };
  for (const l of ligadas) {
    const cs = cantosLaje(l);
    const dist = cs.map(([x, y]) => (x - a[0]) * n[0] + (y - a[1]) * n[1]);
    const meio = dist.reduce((s, d) => s + d, 0) / dist.length;
    const lado = meio >= 0 ? '1' : '-1';
    const hf = hfDaLaje(l);
    if (!(hf > 0)) continue;
    lados[lado].push({ l, hf, larg: Math.max(...dist.map(Math.abs)) });
  }
  const todos = [...lados['1'], ...lados['-1']];
  if (!todos.length) return null;
  const hf = Math.round(Math.min(...todos.map((x) => x.hf)) * 10) / 10;
  const b2 = (lista) => (lista.length ? Math.max(0, Math.round((Math.min(...lista.map((x) => x.larg)) - bw) * 100)) : 0);
  const ids = todos.map((x) => x.l.codigo);
  if (lados['1'].length && lados['-1'].length) return { tipo: 'T', hf, b2a: b2(lados['1']), b2b: b2(lados['-1']), lajes: ids };
  return { tipo: 'L', hf, b2: b2(todos), b4: 0, lajes: ids };
}
