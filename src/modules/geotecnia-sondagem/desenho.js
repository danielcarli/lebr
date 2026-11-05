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
 * Perfil individual do furo de sondagem: escala de profundidade, cotas, coluna do perfil com a hachura de
 * cada solo, nível d'água, NSPT por metro, gráfico NSPT × profundidade e a descrição das camadas.
 */

const fmt = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');
let seq = 0;

/** Quebra um texto em linhas de até n caracteres. */
function quebrar(texto, n) {
  const linhas = [];
  let atual = '';
  for (const p of String(texto).split(/\s+/)) {
    if ((atual + ' ' + p).trim().length > n && atual) { linhas.push(atual); atual = p; } else atual = (atual + ' ' + p).trim();
  }
  if (atual) linhas.push(atual);
  return linhas;
}

export function criarDesenhoSondagem({ s }) {
  /** Padrões de hachura por solo (o id leva um sufixo por desenho). */
  function padroes(suf) {
    const p = (id, w, h, ...filhos) => s('pattern', { id: `sd-${id}-${suf}`, width: w, height: h, patternUnits: 'userSpaceOnUse' }, ...filhos);
    return s('defs', null,
      p('argila', 10, 6, s('line', { x1: 0, y1: 3, x2: 10, y2: 3, class: 'sd-hach' })),
      p('silte', 12, 7, s('line', { x1: 1, y1: 3.5, x2: 6, y2: 3.5, class: 'sd-hach' })),
      p('areia', 8, 8, s('circle', { cx: 2, cy: 2, r: 0.9, class: 'sd-ponto' }), s('circle', { cx: 6, cy: 6, r: 0.9, class: 'sd-ponto' })),
      p('pedregulho', 14, 12, s('circle', { cx: 4, cy: 4, r: 2.6, class: 'sd-hach' }), s('circle', { cx: 11, cy: 9.5, r: 1.8, class: 'sd-hach' })),
      p('aterro', 9, 9, s('path', { d: 'M0 9L9 0M-2 2L2 -2M7 11L11 7', class: 'sd-hach' }), s('path', { d: 'M0 0L9 9', class: 'sd-hach' })),
      p('organico', 14, 8, s('path', { d: 'M0 4q3.5 -3 7 0t7 0', class: 'sd-hach' })),
      p('turfa', 14, 8, s('path', { d: 'M0 4q3.5 -3 7 0t7 0', class: 'sd-hach' }), s('line', { x1: 0, y1: 7.5, x2: 14, y2: 7.5, class: 'sd-hach' })),
      p('rocha', 16, 10, s('path', { d: 'M0 0H16M0 5H16M4 0V5M12 5V10', class: 'sd-hach' })),
    );
  }

  /**
   * @param {object} a   resultado de analisarSondagem
   * @param {object} op  { codigo, compacto }
   */
  function perfil(a, { codigo = '', largura = 820 } = {}) {
    const suf = `${(++seq).toString(36)}`;
    const prof = Math.max(a.limite, a.camadas.at(-1)?.ate ?? 0, 1);
    const esc = Math.max(22, Math.min(42, 620 / prof)); // px por metro
    const y0 = 46, H = y0 + prof * esc + 34;
    const X = { prof: 30, cota: 92, colA: 112, colB: 178, na: 186, n: 278, gA: 310, gB: 506, desc: 530 };
    const y = (p) => y0 + p * esc;
    const filhos = [padroes(suf)];

    // cabeçalho das colunas
    const cab = (x, t, anc = 'middle') => s('text', { x, y: 22, 'text-anchor': anc, class: 'sd-cab' }, t);
    filhos.push(cab(X.prof - 6, 'PROF. (m)'), cab(X.cota - 2, 'COTA', 'end'), cab((X.colA + X.colB) / 2, 'PERFIL'), cab(X.n - 6, 'NSPT'),
      cab((X.gA + X.gB) / 2, 'NSPT (golpes / 30 cm)'), cab(X.desc, 'DESCRIÇÃO DO MATERIAL', 'start'));
    if (codigo) filhos.push(s('text', { x: X.colA, y: 38, class: 'sd-codigo' }, `${codigo} · boca ${fmt(a.cotaBoca)} m`));

    // grade do gráfico (0 a 50 golpes)
    for (let n = 0; n <= 50; n += 10) {
      const x = X.gA + ((X.gB - X.gA) * n) / 50;
      filhos.push(s('line', { x1: x, y1: y0, x2: x, y2: y(prof), class: n ? 'sd-grade' : 'sd-eixo' }),
        s('text', { x, y: y0 - 6, 'text-anchor': 'middle', class: 'sd-escala' }, String(n)));
    }
    // escala de profundidade (1 m)
    for (let p = 0; p <= Math.floor(prof + 1e-9); p++) {
      filhos.push(s('line', { x1: X.prof - 4, y1: y(p), x2: X.prof + 4, y2: y(p), class: 'sd-eixo' }),
        s('text', { x: X.prof - 9, y: y(p) + 4, 'text-anchor': 'end', class: 'sd-escala' }, String(p)),
        s('line', { x1: X.gA, y1: y(p), x2: X.gB, y2: y(p), class: 'sd-grade' }));
    }
    filhos.push(s('line', { x1: X.prof, y1: y0, x2: X.prof, y2: y(prof), class: 'sd-eixo' }));

    // camadas
    for (const c of a.camadas) {
      const ya = y(c.de), yb = y(c.ate), hh = yb - ya;
      filhos.push(
        s('rect', { x: X.colA, y: ya, width: X.colB - X.colA, height: hh, class: `sd-solo sd-${c.solo}` }),
        s('rect', { x: X.colA, y: ya, width: X.colB - X.colA, height: hh, fill: `url(#sd-${c.solo}-${suf})`, class: 'sd-padrao' }),
        s('line', { x1: X.colA, y1: yb, x2: largura - 8, y2: yb, class: 'sd-limite' }),
        s('text', { x: X.cota, y: yb + 4, 'text-anchor': 'end', class: 'sd-cota' }, fmt(c.cotaBase)),
        s('text', { x: X.colB + 4, y: yb - 3, class: 'sd-prof' }, fmt(c.ate)),
      );
      // descrição centrada na camada (até onde couber)
      const linhas = quebrar(c.descricao, 40);
      const cabe = Math.max(1, Math.floor((hh - 4) / 14));
      const vis = linhas.slice(0, cabe);
      if (linhas.length > cabe) vis[cabe - 1] = `${vis[cabe - 1].replace(/[,.;]?$/, '')}…`;
      const yt = ya + hh / 2 - ((vis.length - 1) * 14) / 2 + 4;
      filhos.push(s('text', { x: X.desc, y: yt, class: 'sd-desc' }, ...vis.map((l, i) => s('tspan', { x: X.desc, dy: i ? 14 : 0 }, l))));
    }
    filhos.push(s('rect', { x: X.colA, y: y0, width: X.colB - X.colA, height: (a.camadas.at(-1)?.ate ?? 0) * esc, class: 'sd-borda' }),
      s('text', { x: X.cota, y: y0 + 4, 'text-anchor': 'end', class: 'sd-cota' }, fmt(a.cotaBoca)));

    // fim do furo
    filhos.push(s('line', { x1: X.colA - 8, y1: y(a.limite), x2: X.gB, y2: y(a.limite), class: 'sd-fim' }),
      s('text', { x: X.gB, y: y(a.limite) + 15, 'text-anchor': 'end', class: 'sd-fim-rot' }, `Limite da sondagem ${fmt(a.limite)} m`));

    // nível d'água
    const marcarNA = (p, rot) => {
      const yy = y(p);
      filhos.push(s('path', { d: `M${X.na} ${yy - 9}h14l-7 9z`, class: 'sd-na' }),
        s('line', { x1: X.na - 2, y1: yy, x2: X.na + 16, y2: yy, class: 'sd-na-linha' }),
        s('line', { x1: X.na + 1, y1: yy + 3, x2: X.na + 13, y2: yy + 3, class: 'sd-na-linha' }),
        s('text', { x: X.na + 18, y: yy - 2, class: 'sd-na-rot' }, rot));
    };
    if (!a.nivelAgua.seco && a.nivelAgua.inicial != null) marcarNA(a.nivelAgua.inicial, `NA ${fmt(a.nivelAgua.inicial)}`);
    if (!a.nivelAgua.seco && a.nivelAgua.final != null && Math.abs((a.nivelAgua.final ?? 0) - (a.nivelAgua.inicial ?? -9)) > 0.25) marcarNA(a.nivelAgua.final, `NAf ${fmt(a.nivelAgua.final)}`);
    if (a.nivelAgua.seco) filhos.push(s('text', { x: X.na, y: y0 + 14, class: 'sd-na-rot' }, 'furo seco'));

    // NSPT: valores e gráfico
    const pts = [], marcas = [];
    for (const e of a.ensaios) {
      const yy = y(e.meio);
      const n = Math.min(50, e.neq);
      const x = X.gA + ((X.gB - X.gA) * n) / 50;
      pts.push(`${x},${yy}`);
      marcas.push(s('text', { x: X.n - 6, y: yy + 4, 'text-anchor': 'middle', class: 'sd-n' }, e.rotulo),
        s('circle', { cx: x, cy: yy, r: 3.2, class: e.neq > 50 || e.pen < 30 ? 'sd-ponto-n alto' : 'sd-ponto-n' }));
      if (e.neq > 50) marcas.push(s('path', { d: `M${x + 5} ${yy}l6 0m-3 -3l3 3l-3 3`, class: 'sd-seta' }));
    }
    if (pts.length > 1) filhos.push(s('polyline', { points: pts.join(' '), class: 'sd-curva' }));
    filhos.push(...marcas);

    return s('svg', { class: 'desenho sondagem-perfil', viewBox: `0 0 ${largura} ${H}`, width: largura, height: H }, ...filhos);
  }

  return { perfil };
}
