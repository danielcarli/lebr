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
 * Planta de laje e seletores de borda, usados pelas lajes nervurada, treliçada,
 * alveolar e pelo entrepiso de madeira (a laje maciça tem a sua própria planta,
 * com as linhas de ruptura do processo das áreas).
 *
 * Cada borda clicável alterna o vínculo; as bordas laterais das lajes em uma
 * direção alternam só entre apoiada e livre.
 */
import { BORDAS_LAJE, OPCOES_VINCULO, OPCOES_LATERAL, PROXIMO, PROXIMO_LATERAL, problemaFaixa } from './bordas.js';

const NOME_PLANTA = { x0: 'Borda esquerda', x1: 'Borda direita', y0: 'Borda inferior', y1: 'Borda superior' };
/** Bordas laterais (paralelas às nervuras) conforme o sentido das nervuras na planta. */
const ehLateral = (id, direcao = 'x') => (direcao === 'y' ? id.startsWith('x') : id.startsWith('y'));
import { placaEstavel } from '../../engine/placa.js';

const ROTULO = { apoiada: 'APOIADA', engastada: 'ENGASTADA', livre: 'LIVRE' };
const NOME_FAIXA = {
  x0: 'Borda esquerda (x = 0)', x1: 'Borda direita (x = L)',
  y0: 'Borda inferior (lateral)', y1: 'Borda superior (lateral)',
};

export function criarPlantaLaje(api) {
  const { h, s } = api.dom;
  const ui = api.ui;
  const { num } = api.formatar;

  /**
   * @param {object} p
   * @param {number} p.lx  dimensão em x (m)   @param {number} p.ly  dimensão em y (m)
   * @param {object} p.bordas  { x0, x1, y0, y1 }
   * @param {string} [p.codigo]
   * @param {'x'|'y'|'duas'|null} [p.nervuras]  desenha linhas de nervuras/vigotas no sentido indicado
   * @param {number} [p.passo]  espaçamento das nervuras (m)
   * @param {(id:string)=>void} [p.aoAlternar]
   * @param {{id:string,d:number}[]} [p.reacoes]  reações de cálculo para escrever nas bordas
   */
  function planta({ lx, ly, bordas, codigo = '', nervuras = null, passo = 0, aoAlternar, reacoes }) {
    const W = 520, H = 360, m = 70;
    const esc = Math.min((W - 2 * m) / lx, (H - 2 * m) / ly);
    const w = lx * esc, hh = ly * esc, x0 = (W - w) / 2, y0 = (H - hh) / 2;
    const filhos = [s('rect', { x: x0, y: y0, width: w, height: hh, class: 'pl-laje' })];
    const p = passo * esc;
    if (nervuras && p > 3) {
      // nervuras na direção x são linhas horizontais (vencem lx); na direção y, verticais; em duas direções, ambas
      if (nervuras !== 'y') for (let y = y0 + p / 2; y < y0 + hh; y += p) filhos.push(s('line', { x1: x0, y1: y, x2: x0 + w, y2: y, class: 'pl-nervura' }));
      if (nervuras === 'duas' || nervuras === 'y') for (let x = x0 + p / 2; x < x0 + w; x += p) filhos.push(s('line', { x1: x, y1: y0, x2: x, y2: y0 + hh, class: 'pl-nervura' }));
    }
    const pontas = { y0: [x0, y0 + hh, x0 + w, y0 + hh], y1: [x0, y0, x0 + w, y0], x0: [x0, y0, x0, y0 + hh], x1: [x0 + w, y0, x0 + w, y0 + hh] };
    const fora = { y0: [0, 1], y1: [0, -1], x0: [-1, 0], x1: [1, 0] };
    for (const b of BORDAS_LAJE) {
      const [xa, ya, xb, yb] = pontas[b.id];
      const [fx, fy] = fora[b.id];
      const tipo = bordas[b.id] ?? 'apoiada';
      const g = s('g', { class: ['pl-borda', tipo, aoAlternar && 'clicavel'].filter(Boolean).join(' '), onClick: aoAlternar ? () => aoAlternar(b.id) : null },
        s('line', { x1: xa, y1: ya, x2: xb, y2: yb, class: 'pl-borda-linha' }),
        s('line', { x1: xa + fx * 12, y1: ya + fy * 12, x2: xb + fx * 12, y2: yb + fy * 12, class: 'pl-borda-alvo' }));
      if (tipo === 'engastada') {
        const n = Math.max(1, Math.floor(Math.hypot(xb - xa, yb - ya) / 10));
        for (let i = 0; i <= n; i++) {
          const px = xa + ((xb - xa) * i) / n, py = ya + ((yb - ya) * i) / n;
          g.append(s('line', { x1: px, y1: py, x2: px + fx * 9 + (fy ? 5 : 0), y2: py + fy * 9 + (fx ? 5 : 0), class: 'pl-hachura' }));
        }
      }
      const mx = (xa + xb) / 2 + fx * 50, my = (ya + yb) / 2 + fy * 30;
      g.append(s('text', { x: mx, y: my + 4, 'text-anchor': 'middle', class: 'pl-rot' }, ROTULO[tipo] ?? 'APOIADA'));
      const r = reacoes?.find((x) => x.id === b.id);
      if (r && tipo !== 'livre' && Math.abs(r.d) > 0.005) g.append(s('text', { x: mx, y: my + 18, 'text-anchor': 'middle', class: 'pl-reacao' }, `${num(r.d)} kN/m`));
      filhos.push(g);
    }
    // etiqueta no centro quando cabe; em lajes estreitas (balanços), embaixo do desenho
    if (w >= 124 && hh >= 60) {
      filhos.push(
        s('rect', { x: x0 + w / 2 - 54, y: y0 + hh / 2 - 26, width: 108, height: 46, rx: 6, class: 'pl-etiqueta' }),
        s('text', { x: x0 + w / 2, y: y0 + hh / 2 - 2, 'text-anchor': 'middle', class: 'pl-nome' }, codigo),
        s('text', { x: x0 + w / 2, y: y0 + hh / 2 + 14, 'text-anchor': 'middle', class: 'pl-dim' }, `${num(lx)} × ${num(ly)} m`),
      );
    } else {
      filhos.push(s('text', { x: W - 14, y: H - 14, 'text-anchor': 'end', class: 'pl-dim' }, `${codigo} · ${num(lx)} × ${num(ly)} m`));
    }
    filhos.push(
      s('line', { x1: 18, y1: H - 18, x2: 54, y2: H - 18, class: 'pl-eixo' }), s('line', { x1: 18, y1: H - 18, x2: 18, y2: H - 54, class: 'pl-eixo' }),
      s('text', { x: 58, y: H - 14, class: 'pl-eixo-rot' }, 'x'), s('text', { x: 14, y: H - 58, class: 'pl-eixo-rot' }, 'y'),
    );
    return s('svg', { class: 'desenho planta', viewBox: `0 0 ${W} ${H}` }, ...filhos);
  }

  /**
   * Seletores das quatro bordas.
   * @param {object} bordas
   * @param {(id:string, valor:string)=>void} aoMudar
   * @param {{umaDirecao?:boolean, direcao?:'x'|'y'}} [op]  em uma direção, as bordas onde as nervuras
   *   chegam são as extremidades e as outras duas são laterais (`direcao` = sentido das nervuras na planta)
   */
  function seletores(bordas, aoMudar, { umaDirecao = false, direcao = null } = {}) {
    const naPlanta = umaDirecao && direcao != null;
    const ordem = !umaDirecao ? ['y0', 'x1', 'y1', 'x0'] : naPlanta && direcao === 'y' ? ['y0', 'y1', 'x0', 'x1'] : ['x0', 'x1', 'y0', 'y1'];
    return h('div', { class: 'bordas' }, ordem.map((id) => {
      const lateral = umaDirecao && ehLateral(id, direcao ?? 'x');
      return ui.segmentado({
        rotulo: !umaDirecao ? BORDAS_LAJE.find((b) => b.id === id).nome
          : naPlanta ? `${NOME_PLANTA[id]} (${lateral ? 'lateral' : 'apoio das vigotas'})` : NOME_FAIXA[id],
        valor: lateral && bordas[id] === 'engastada' ? 'apoiada' : bordas[id], compacto: true,
        opcoes: lateral ? OPCOES_LATERAL : OPCOES_VINCULO,
        aoMudar: (v) => aoMudar(id, v),
      });
    }));
  }

  /** Próximo vínculo ao clicar na planta. */
  const proximo = (id, atual, { umaDirecao = false, direcao = 'x' } = {}) => ((umaDirecao && ehLateral(id, direcao)) ? PROXIMO_LATERAL : PROXIMO)[atual] ?? 'apoiada';

  /** Situação dos vínculos logo abaixo dos seletores. */
  function aviso(bordas, { umaDirecao = false, direcao = 'x', textoBalanco } = {}) {
    const linha = (texto, alerta) => h('li', { class: alerta ? '' : 'info' }, ui.icone(alerta ? 'alerta' : 'info', { tamanho: 14, traco: 1.8 }), texto);
    // bordas da planta → referencial das nervuras (x0/x1 = extremidades)
    const local = umaDirecao && direcao === 'y' ? { x0: bordas.y0, x1: bordas.y1, y0: bordas.x0, y1: bordas.x1 } : bordas;
    const nomes = direcao === 'y' ? { x0: 'inferior', x1: 'superior' } : undefined;
    const problema = umaDirecao ? problemaFaixa(local, nomes) : (!placaEstavel(bordas) ? 'Laje instável: use ao menos uma borda engastada ou duas bordas apoiadas.' : null);
    if (problema) return h('ul', { class: 'avisos' }, linha(problema, true));
    const balanco = umaDirecao ? (local.x0 === 'livre' || local.x1 === 'livre') : Object.values(bordas).includes('livre');
    if (balanco && textoBalanco) return h('ul', { class: 'avisos' }, linha(textoBalanco, false));
    return null;
  }

  return { planta, seletores, proximo, aviso };
}
