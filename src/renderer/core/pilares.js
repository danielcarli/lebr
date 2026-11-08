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
 * Pilar com ponto fixo e lance (roteiro, etapa L10).
 *   - Ponto fixo: centro, um canto ou o meio de uma face da seção (no sistema do pilar, antes do giro). Quando a seção
 *     muda, o ponto fixo fica no lugar e o centro anda — `pilar.pontoFixo`; a última seção vista fica em
 *     `pilar.posicao.secaoRef`.
 *   - Prumada e lance: os pilares de vários pavimentos no mesmo prumo; "de um pavimento até outro" cria os lances que
 *     faltam e liga cada um ao de baixo.
 *   - Transição: pilar sem pilar embaixo que nasce sobre uma viga — a base vira carga concentrada na viga (ligação
 *     criada por montagem.detectarLigacoes) e o painel de problemas avisa.
 */
import { tipoDe, centroPilar, secaoPilar, pavimentosOrdenados, peDireito, detectarLigacoes, aplicarLigacoes } from './montagem.js';
import { novoId, proximoCodigo } from './projeto.js';

/** Pontos fixos: deslocamento do ponto em relação ao centro, em meias-dimensões (−1 a 1) nas direções bx e by. */
export const PONTOS_FIXOS = {
  'sup-esq': [-1, 1], sup: [0, 1], 'sup-dir': [1, 1],
  esq: [-1, 0], centro: [0, 0], dir: [1, 0],
  'inf-esq': [-1, -1], inf: [0, -1], 'inf-dir': [1, -1],
};
export const NOMES_PONTO_FIXO = {
  'sup-esq': 'canto superior esquerdo', sup: 'meio da face superior', 'sup-dir': 'canto superior direito',
  esq: 'meio da face esquerda', centro: 'centro', dir: 'meio da face direita',
  'inf-esq': 'canto inferior esquerdo', inf: 'meio da face inferior', 'inf-dir': 'canto inferior direito',
};

/**
 * Mantém o ponto fixo do pilar no lugar depois de mudar a seção (altera no lugar).
 * @returns {boolean} se o centro andou
 */
export function manterPontoFixo(el) {
  if (!el?.posicao || el.modulo !== 'concreto.pilar') return false;
  const { bx, by } = secaoPilar(el);
  const ref = el.posicao.secaoRef;
  el.posicao.secaoRef = { bx, by };
  const pf = PONTOS_FIXOS[el.pontoFixo];
  if (!pf || el.pontoFixo === 'centro' || !ref || (ref.bx === bx && ref.by === by)) return false;
  const dl = [(pf[0] * (ref.bx - bx)) / 200, (pf[1] * (ref.by - by)) / 200];
  const a = ((el.posicao.angulo ?? 0) * Math.PI) / 180;
  el.posicao.x = Math.round(((el.posicao.x ?? 0) + dl[0] * Math.cos(a) - dl[1] * Math.sin(a)) * 1e5) / 1e5;
  el.posicao.y = Math.round(((el.posicao.y ?? 0) + dl[0] * Math.sin(a) + dl[1] * Math.cos(a)) * 1e5) / 1e5;
  return true;
}

/** Normalizador para o estado: todo pilar com ponto fixo acompanha a própria seção. */
export function manterPontosFixos(projeto) {
  for (const e of projeto?.elementos ?? []) if (e.modulo === 'concreto.pilar' && e.posicao) manterPontoFixo(e);
}

/** Pilares no mesmo prumo, do pavimento mais baixo para o mais alto. */
export function prumada(projeto, registro, pilar, tol = 0.05) {
  const [x, y] = centroPilar(pilar);
  const ord = pavimentosOrdenados(projeto);
  const out = [];
  for (const pv of ord) {
    const p = projeto.elementos.find((e) => e.posicao?.pavimento === pv.id && tipoDe(e, registro) === 'pilar' && Math.hypot(centroPilar(e)[0] - x, centroPilar(e)[1] - y) <= tol);
    if (p) out.push({ pavimento: pv, pilar: p });
  }
  return out;
}

/** Código do lance novo: no esquema por pavimento (P101), troca o índice do pavimento; senão, o próximo livre. */
function codigoDoLance(projeto, codigo, indice) {
  const m = /^([A-Z]+?)(\d)(\d{2,})$/.exec(codigo ?? '');
  if (m) {
    const c = `${m[1]}${indice}${m[3]}`;
    if (!projeto.elementos.some((e) => e.codigo === c)) return c;
  }
  return proximoCodigo(projeto, String(codigo ?? 'P').replace(/\d+$/, '') || 'P');
}

/**
 * Lance do pilar: cria os pilares que faltam no mesmo prumo, do pavimento inicial ao final, com a mesma seção e o
 * comprimento do pé-direito de cada lance, e liga cada um ao de baixo (altera o projeto no lugar).
 * @returns {{criados:object[], ligacoes:number}}
 */
export function aplicarLance(projeto, registro, pilar, pavInicial, pavFinal) {
  const ord = pavimentosOrdenados(projeto);
  let i0 = ord.findIndex((p) => p.id === pavInicial), i1 = ord.findIndex((p) => p.id === pavFinal);
  if (i0 < 0 || i1 < 0) return { criados: [], ligacoes: 0 };
  if (i0 > i1) [i0, i1] = [i1, i0];
  const existentes = new Set(prumada(projeto, registro, pilar).map((x) => x.pavimento.id));
  const [x, y] = centroPilar(pilar);
  const criados = [];
  for (let i = i0; i <= i1; i++) {
    const pv = ord[i];
    if (existentes.has(pv.id)) continue;
    const novo = structuredClone(pilar);
    novo.id = novoId('p');
    novo.codigo = codigoDoLance(projeto, pilar.codigo, i);
    novo.nome = pilar.nome === pilar.codigo ? novo.codigo : pilar.nome;
    novo.cargas = (Array.isArray(pilar.cargas) ? pilar.cargas : []).filter((c) => c?.tipo !== 'elemento').map((c) => structuredClone(c));
    novo.resultado = null;
    novo.posicao = { ...pilar.posicao, pavimento: pv.id, x, y };
    const pd = peDireito(projeto, pv.id);
    if (pd > 0) novo.comprimento = pd;
    projeto.elementos.push(novo);
    criados.push(novo);
  }
  const ids = new Set(criados.map((e) => e.id));
  const ligacoes = criados.length ? aplicarLigacoes(projeto, detectarLigacoes(projeto, registro).filter((d) => ids.has(d.fonte.id) || ids.has(d.receptor.id))) : 0;
  return { criados, ligacoes };
}
