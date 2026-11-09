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
 * Copiar, colar e duplicar na montagem (0.66): elementos estruturais (pilar, viga, laje, escada, reservatório…) e
 * eixos de projeto. A cópia guarda o elemento inteiro; ao colar, ganha id e código novos, vai para o pavimento da
 * vista, deslocada (ou com o ponto de inserção no cursor), sem as ligações do original — que contariam a mesma carga
 * duas vezes —, e fica a calcular.
 */
import { novoId } from './projeto.js';
import { criarEixo } from './eixos.js';

const r4 = (v) => Math.round(v * 1e4) / 1e4;

/**
 * Próximo código livre seguindo a numeração do original: P210 → P211, P212…; V1 → V2…; com zeros à esquerda
 * mantidos (VB001 → VB002). Sem número, P → P1, P2…
 */
export function proximoCodigoApos(projeto, codigo) {
  const usados = new Set(projeto.elementos.map((e) => e.codigo));
  const m = /^(.*?)(\d+)$/.exec(String(codigo ?? 'E'));
  const prefixo = m ? m[1] : String(codigo ?? 'E'), largura = m ? m[2].length : 0;
  let i = m ? Number(m[2]) + 1 : 1;
  const fmt = (k) => `${prefixo}${String(k).padStart(largura, '0')}`;
  while (usados.has(fmt(i))) i++;
  return fmt(i);
}

/** O que a área de transferência guarda de um elemento posicionado (ou null se não dá para copiar). */
export function copiaDoElemento(el) {
  if (!el?.posicao) return null;
  // fundações presas a um pilar ou viga acompanham o apoio: copiar criaria uma segunda fundação para ele
  if (el.pilarId || el.vigaId) return null;
  const c = structuredClone(el);
  delete c.resultado;
  return { tipo: 'elemento', el: c };
}

/** O que a área de transferência guarda de um eixo (da listaEixos): o ponto, a direção e a normal. */
export function copiaDoEixo(eixo) {
  if (!eixo) return null;
  return { tipo: 'eixo', p: [...eixo.p], ang: eixo.ang, n: [...eixo.n], nome: eixo.nome };
}

/**
 * Cola o elemento copiado no projeto (no lugar).
 * @param {object} op { pavimento, dx, dy, peDireito } — deslocamento em m do ponto de inserção; peDireito (m) ajusta o
 *                    comprimento do pilar quando muda de pavimento
 * @returns {{ el:object, ligacoesRemovidas:number }}
 */
export function colarElemento(projeto, copia, { pavimento = null, dx = 0, dy = 0, peDireito = 0 } = {}) {
  const orig = copia.el;
  const prefixo = String(orig.codigo ?? 'E').replace(/\d+$/, '') || 'E';
  const el = structuredClone(orig);
  el.id = novoId(prefixo.toLowerCase());
  el.codigo = proximoCodigoApos(projeto, orig.codigo);
  el.nome = el.codigo;
  el.resultado = null;
  let ligacoesRemovidas = 0;
  if (Array.isArray(el.cargas)) {
    const antes = el.cargas.length;
    el.cargas = el.cargas.filter((c) => c?.tipo !== 'elemento');
    ligacoesRemovidas = antes - el.cargas.length;
  }
  const pav = pavimento ?? orig.posicao.pavimento;
  el.posicao = { ...orig.posicao, pavimento: pav, x: r4((orig.posicao.x ?? 0) + dx), y: r4((orig.posicao.y ?? 0) + dy) };
  if (pav !== orig.posicao.pavimento && peDireito > 0 && el.comprimento != null && /pilar/.test(el.modulo)) el.comprimento = peDireito;
  projeto.elementos.push(el);
  return { el, ligacoesRemovidas };
}

/**
 * Cola o eixo copiado: paralelo ao original, passando pelo ponto dado ou deslocado `desloc` m na normal.
 * @returns {string} id do eixo novo
 */
export function colarEixo(projeto, copia, { ponto = null, desloc = 0 } = {}) {
  const p = ponto ?? [r4(copia.p[0] + copia.n[0] * desloc), r4(copia.p[1] + copia.n[1] * desloc)];
  return criarEixo(projeto, p, copia.ang);
}
