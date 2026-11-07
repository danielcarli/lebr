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
 * Módulo: Pilar retangular de concreto armado (NBR 6118:2023)
 */
import { secaoCombinacoes } from '../comum/combinacoes.js';
import { secaoArmadura } from '../comum/armadura.js';
import { calcularPilar, cargasTransmitidas, ligacoes, criarPilar, normalCaracteristica, areaPilar } from './calculo.js';
import { editorCargas } from '../comum/cargas.js';
import { detalhamentoPilar } from '../comum/detalhamento.js';
import { secaoListaDeFerros } from '../comum/detalhamento-ui.js';
import { modeloPilar } from '../comum/armadura3d.js';
import { criarDesenhoPilar } from './desenho.js';

export default function moduloPilar(api) {
  const { h, s } = api.dom;
  const ui = api.ui;
  const { num } = api.formatar;
  const desenhoPilar = criarDesenhoPilar(api.dom);

  /** Seção transversal com barras (pontos) e estribo. */
  function secao(el, arm) {
    if (el.forma === 'circular') return secaoCircular(el, arm);
    const caixa = 250, m = 34;
    const esc = Math.min((caixa - 2 * m) / el.bx, (caixa - 2 * m) / el.by);
    const w = el.bx * esc, hh = el.by * esc;
    const W = w + 2 * m + 40, H = hh + 2 * m;
    const x0 = m + 10, y0 = m;
    const filhos = [s('rect', { x: x0, y: y0, width: w, height: hh, class: 'sec-concreto' })];
    if (arm) {
      // estribo pelo eixo, encostado nas barras de canto (raio da dobra = ø/2 + øt/2)
      const xs = arm.pontos.map((p) => p.x), ys = arm.pontos.map((p) => p.y);
      const pt = (arm.estribo?.phi ?? 5) / 10, r = (arm.phi / 20 + pt / 2) * esc;
      const ex0 = x0 + (Math.min(...xs) - arm.phi / 20 - pt / 2) * esc, ex1 = x0 + (Math.max(...xs) + arm.phi / 20 + pt / 2) * esc;
      const ey0 = y0 + (el.by - Math.max(...ys) - arm.phi / 20 - pt / 2) * esc, ey1 = y0 + (el.by - Math.min(...ys) + arm.phi / 20 + pt / 2) * esc;
      filhos.push(s('rect', { x: ex0, y: ey0, width: ex1 - ex0, height: ey1 - ey0, rx: r, class: 'sec-estribo' }));
      const rb = Math.max(3, (arm.phi / 20) * esc);
      for (const p of arm.pontos) filhos.push(s('circle', { cx: x0 + p.x * esc, cy: y0 + (el.by - p.y) * esc, r: rb, class: 'sec-barra' }));
    }
    filhos.push(
      s('text', { x: x0 + w / 2, y: y0 + hh + 20, 'text-anchor': 'middle', class: 'dg-texto' }, `bx = ${num(el.bx, 0)} cm`),
      s('text', { x: x0 - 12, y: y0 + hh / 2, 'text-anchor': 'middle', class: 'dg-texto', transform: `rotate(-90 ${x0 - 12} ${y0 + hh / 2})` }, `by = ${num(el.by, 0)} cm`),
      s('line', { x1: x0 + w + 14, y1: y0 + hh, x2: x0 + w + 38, y2: y0 + hh, class: 'pl-eixo' }),
      s('line', { x1: x0 + w + 14, y1: y0 + hh, x2: x0 + w + 14, y2: y0 + hh - 24, class: 'pl-eixo' }),
      s('text', { x: x0 + w + 41, y: y0 + hh + 4, class: 'pl-eixo-rot' }, 'x'),
      s('text', { x: x0 + w + 10, y: y0 + hh - 28, class: 'pl-eixo-rot' }, 'y'),
    );
    return s('svg', { class: 'desenho secao-pilar', viewBox: `0 0 ${W} ${H}`, width: W, height: H }, ...filhos);
  }

  /** Seção circular: concreto, estribo circular e barras igualmente espaçadas no contorno. */
  function secaoCircular(el, arm) {
    const D = Number(el.D) || el.bx;
    const caixa = 250, m = 34;
    const esc = (caixa - 2 * m) / D, R = (D / 2) * esc;
    const W = 2 * R + 2 * m + 40, H = 2 * R + 2 * m + 10;
    const cx = m + 10 + R, cy = m + R;
    const filhos = [s('circle', { cx, cy, r: R, class: 'sec-concreto' })];
    if (arm) {
      const pt = (arm.estribo?.phi ?? 5) / 10;
      const Re = (arm.raio ?? D / 2 - arm.cobrimento - pt - arm.phi / 20) + arm.phi / 20 + pt / 2;
      filhos.push(s('circle', { cx, cy, r: Re * esc, class: 'sec-estribo' }));
      const rb = Math.max(3, (arm.phi / 20) * esc);
      for (const p of arm.pontos) filhos.push(s('circle', { cx: m + 10 + p.x * esc, cy: m + (D - p.y) * esc, r: rb, class: 'sec-barra' }));
    }
    filhos.push(
      s('line', { x1: cx - R, y1: cy + R + 12, x2: cx + R, y2: cy + R + 12, class: 'pl-eixo' }),
      s('text', { x: cx, y: cy + R + 26, 'text-anchor': 'middle', class: 'dg-texto' }, `D = ${num(D, 0)} cm`),
      s('line', { x1: cx + R + 14, y1: cy + R, x2: cx + R + 38, y2: cy + R, class: 'pl-eixo' }),
      s('line', { x1: cx + R + 14, y1: cy + R, x2: cx + R + 14, y2: cy + R - 24, class: 'pl-eixo' }),
      s('text', { x: cx + R + 41, y: cy + R + 4, class: 'pl-eixo-rot' }, 'x'),
      s('text', { x: cx + R + 10, y: cy + R - 28, class: 'pl-eixo-rot' }, 'y'),
    );
    return s('svg', { class: 'desenho secao-pilar', viewBox: `0 0 ${W} ${H}`, width: W, height: H }, ...filhos);
  }

  /** Pórtico espacial do edifício: o pilar lance a lance, a prumada e a conferência das cargas verticais. */
  function secaoPortico(pt, ctx, comb) {
    const mudar = (v) => ctx.alterar((e, proj) => {
      proj.parametros.analiseGlobal = { ...(proj.parametros.analiseGlobal ?? {}), pilares: v };
      for (const x of proj.elementos) if (x.resultado) x.resultado.desatualizado = true;
    }, { descricao: `Esforços nos pilares: ${v}`, estrutural: true });
    const seletor = ui.linhaCampos(ui.segmentado({
      rotulo: 'Esforços nos pilares do projeto', valor: pt.usado ? 'portico' : (ctx.projeto.parametros.analiseGlobal?.pilares ?? 'elementos'),
      opcoes: [{ valor: 'elementos', texto: 'Cargas dos elementos' }, { valor: 'portico', texto: 'Pórtico espacial' }], aoMudar: mudar,
    }));
    if (pt.erro) {
      return ui.secao({ numero: '08', titulo: 'Pórtico espacial', descricao: 'NBR 6118, 14.6', filhos: [seletor, h('ul', { class: 'avisos' }, h('li', null, ui.icone('alerta', { tamanho: 14, traco: 1.8 }), `O pórtico não pôde ser montado: ${pt.erro}`))] });
    }
    const tot = pt.totais;
    const okEq = Math.abs(tot.somaPavG - tot.reacoesG) < 0.01 * Math.max(1, tot.somaPavG) && Math.abs(tot.somaPavQ - tot.reacoesQ) < 0.01 * Math.max(1, tot.somaPavQ);
    return ui.secao({
      numero: '08', titulo: 'Pórtico espacial do edifício',
      descricao: `${pt.usado ? 'Normal e momentos do pórtico usados no dimensionamento' : 'Só para comparação — o pilar usa as cargas dos elementos'} · Nd: ${pt.NdElementos != null ? `elementos ${num(pt.NdElementos)} kN · ` : ''}pórtico ${num(pt.NdPortico)} kN`,
      filhos: [
        seletor,
        ui.tabela({
          classe: 'els-tabela portico-prumada',
          colunas: [{ titulo: 'Lance' }, { titulo: 'Pilar' }, { titulo: 'Ng,k (kN)', alinhar: 'dir' }, { titulo: 'Nq,k (kN)', alinhar: 'dir' }, { titulo: 'Nd (kN)', alinhar: 'dir' }, { titulo: 'Comb.' },
            { titulo: 'Mxd topo', alinhar: 'dir' }, { titulo: 'Mxd base', alinhar: 'dir' }, { titulo: 'Myd topo', alinhar: 'dir' }, { titulo: 'Myd base', alinhar: 'dir' }],
          linhas: pt.prumada.map((l) => ({
            classe: l.atual ? 'governa' : '',
            celulas: [`${l.pavimento}${l.fundacao ? ' (fundação)' : ''}`, l.atual ? h('b', null, l.codigo) : l.codigo, num(l.Ng), num(l.Nq), h('b', null, num(l.Nd)), l.comb, num(l.Mx.topo), num(l.Mx.base), num(l.My.topo), num(l.My.base)],
          })),
        }),
        h('p', { class: 'combinacoes-nota' }, 'Prumada do pilar, de cima para baixo; momentos de cálculo de 1ª ordem (kN·m) nas pontas de cada lance, na combinação da maior normal. Mx flete com a dimensão bx e My com by; topo e base com sinais opostos indicam curvatura dupla.'),
        ui.tabela({
          classe: 'els-tabela',
          colunas: [{ titulo: 'Cargas verticais' }, { titulo: 'G (kN)', alinhar: 'dir' }, { titulo: 'Q (kN)', alinhar: 'dir' }],
          linhas: [
            ...[...pt.pavimentos].reverse().map((pv) => [pv.nome, num(pv.G), num(pv.Q)]),
            [h('b', null, 'Soma dos pavimentos'), h('b', null, num(tot.somaPavG)), h('b', null, num(tot.somaPavQ))],
            [h('span', null, 'Reações na fundação ', ui.selo(okEq, okEq ? 'confere' : 'diferente')), num(tot.reacoesG), num(tot.reacoesQ)],
          ],
        }),
        pt.horizontais ? ui.tabela({
          classe: 'els-tabela',
          colunas: [{ titulo: 'Ações horizontais no lance (característico)' }, { titulo: 'N (kN)', alinhar: 'dir' }, { titulo: 'Mx topo', alinhar: 'dir' }, { titulo: 'Mx base', alinhar: 'dir' }, { titulo: 'My topo', alinhar: 'dir' }, { titulo: 'My base', alinhar: 'dir' }],
          linhas: Object.entries(pt.horizontais.lance).map(([c, v]) => { const n = (x) => num(Math.abs(x) < 0.005 ? 0 : x); return [`${c} — ${pt.horizontais.lista?.find((x) => x.id === c)?.nome ?? c}`, n(v.N), n(v.Mx.topo), n(v.Mx.base), n(v.My.topo), n(v.My.base)]; }),
        }) : null,
        pt.horizontais ? h('p', { class: 'combinacoes-nota' }, `${pt.vento ? `Vento (NBR 6123) ativo: cortante na base do edifício ${num(pt.vento.totais.Fx)} kN em X e ${num(pt.vento.totais.Fy)} kN em Y. ` : ''}Os casos V1 a V4 (vento e/ou desaprumo) entram nas combinações; o dimensionamento usa a combinação determinante (${comb ?? 'ver memorial'}).`) : null,
        pt.estabilidade ? (() => {
          const e = pt.estabilidade;
          const d = (x, eixo) => (x.erro ? `${eixo}: ${x.erro}` : `${eixo}: γz = ${num(x.gz, 3)}, α = ${num(x.alfa, 3)} (α1 = ${num(x.alfa1, 2)}) — ${{ fixos: 'nós fixos', moveis: 'nós móveis', excede: 'γz acima de 1,3', instavel: 'instável' }[x.classe] ?? x.classe}${x.fator > 1 ? `, esforços horizontais × ${num(x.fator, 3)}` : ''}`);
          const ruim = [e.x, e.y].some((x) => x.classe === 'excede' || x.classe === 'instavel');
          return h('p', { class: ['combinacoes-nota', ruim && 'alerta'] }, `Estabilidade global (15.5): ${d(e.x, 'X')}; ${d(e.y, 'Y')}. Detalhes em Estrutura › Estabilidade global (F9).`);
        })() : null,
      ].filter(Boolean),
    });
  }

  return {
    id: 'concreto.pilar',
    nome: 'Pilar de concreto armado',
    nomeCurto: 'Pilar',
    categoria: 'pilares',
    prefixo: 'P',
    sigla: 'CP1',
    icone: 'pilar',
    material: 'Concreto armado',
    norma: 'NBR 6118:2023',
    versao: '0.1.0',
    descricao: 'Pilares retangulares ou circulares com λ ≤ 90: momento mínimo, 2ª ordem por curvatura aproximada.',

    criar: criarPilar,
    calcular: calcularPilar,
    cargasTransmitidas,
    ligacoes,
    resumo: (el) => `${el.forma === 'circular' ? `Seção circular ø ${num(Number(el.D) || el.bx, 0)}` : `Seção ${num(el.bx, 0)} × ${num(el.by, 0)}`} cm · L = ${num(el.comprimento)} m`,

    renderEntrada(raiz, ctx) {
      const el = ctx.elemento;
      const previa = h('div', { class: 'previa-secao' });
      const desenhar = () => previa.replaceChildren(secao(ctx.elemento, null));
      desenhar();
      const mudar = (fn) => { ctx.alterar(fn); desenhar(); };
      const leIgual = el.le?.x == null && el.le?.y == null;
      const circular = el.forma === 'circular';

      raiz.append(ui.secao({
        numero: '01', titulo: 'Seção e comprimento',
        filhos: [h('div', { class: 'pilar-geo' },
          h('div', { class: 'laje-campos' },
            ui.segmentado({
              rotulo: 'Forma da seção', valor: circular ? 'circular' : 'retangular',
              opcoes: [{ valor: 'retangular', texto: 'Retangular' }, { valor: 'circular', texto: 'Circular' }],
              aoMudar: (v) => ctx.alterar((e) => {
                if (v === 'circular') { e.forma = 'circular'; e.D = Math.max(e.bx, e.by, 25); e.bx = e.by = e.D; } else { e.forma = 'retangular'; }
              }, { estrutural: true }),
            }),
            circular
              ? ui.linhaCampos(
                ui.campo({ rotulo: 'Diâmetro D', valor: Number(el.D) || el.bx, unidade: 'cm', casas: 1, min: 20, max: 300, aoMudar: (v) => mudar((e) => { e.D = v; e.bx = e.by = v; }) }),
                ui.campo({ rotulo: 'Comprimento L', valor: el.comprimento, unidade: 'm', min: 0.5, max: 30, aoMudar: (v) => mudar((e) => { e.comprimento = v; }) }),
              )
              : ui.linhaCampos(
                ui.campo({ rotulo: 'Dimensão bx', valor: el.bx, unidade: 'cm', casas: 1, min: 12, max: 200, aoMudar: (v) => mudar((e) => { e.bx = v; }) }),
                ui.campo({ rotulo: 'Dimensão by', valor: el.by, unidade: 'cm', casas: 1, min: 12, max: 200, aoMudar: (v) => mudar((e) => { e.by = v; }) }),
                ui.campo({ rotulo: 'Comprimento L', valor: el.comprimento, unidade: 'm', min: 0.5, max: 30, aoMudar: (v) => mudar((e) => { e.comprimento = v; }) }),
              ),
            ui.alternar({
              rotulo: 'Comprimento de flambagem igual a L nas duas direções', valor: leIgual,
              aoMudar: (v) => ctx.alterar((e) => { e.le = v ? { x: null, y: null } : { x: e.comprimento, y: e.comprimento }; }, { estrutural: true }),
            }),
            !leIgual && ui.linhaCampos(
              ui.campo({ rotulo: 'le,x', valor: el.le.x, unidade: 'm', min: 0.3, max: 40, aoMudar: (v) => ctx.alterar((e) => { e.le.x = v; }) }),
              ui.campo({ rotulo: 'le,y', valor: el.le.y, unidade: 'm', min: 0.3, max: 40, aoMudar: (v) => ctx.alterar((e) => { e.le.y = v; }) }),
            ),
          ),
          previa,
        )],
      }));

      const { lista, botaoAdd } = editorCargas(api, ctx, { tipos: ['concentrada', 'elemento'], ligacao: 'pontual', porVao: false });
      let total = null;
      try { const n = normalCaracteristica(el, ctx.contextoCalculo()); total = `Nk = ${num(n.g)} (g) + ${num(n.q)} (q) = ${num(n.g + n.q)} kN`; } catch { /* ignora */ }
      raiz.append(secaoArmadura(api, ctx, [
        { chave: 'longitudinal', rotulo: 'Barras longitudinais', uso: 'pilar' },
        { chave: 'estribo', rotulo: 'Estribos', uso: 'estribo' },
      ], { descricao: 'Bitolas — “Automática” busca o arranjo de menor área; a bitola escolhida respeita ø ≤ b/8 e o estribo ≥ ø/4' }));

      raiz.append(ui.secao({
        numero: '02', titulo: 'Cargas', descricao: 'Normais características no topo',
        acoes: [botaoAdd],
        filhos: [
          ui.alternar({ rotulo: `Peso próprio (${num((ctx.materiais.gama * areaPilar(el) * el.comprimento) / 1e4)} kN)`, valor: el.pesoProprio, aoMudar: (v) => ctx.alterar((e) => { e.pesoProprio = v; }, { estrutural: true }) }),
          lista,
          total && h('div', { class: 'cargas-resumo' }, h('span', { class: 'rot' }, 'Total'), total),
        ],
      }));

      const mom = (dir, ext, rot) => ui.campo({ rotulo: rot, valor: el.momentos[dir][ext], unidade: 'kN·m', largura: '130px', aoMudar: (v) => ctx.alterar((e) => { e.momentos[dir][ext] = v; }) });
      raiz.append(ui.secao({
        numero: '03', titulo: 'Momentos de 1ª ordem', descricao: 'Característicos, nas extremidades (0 = apenas momento mínimo)',
        filhos: [ui.linhaCampos(mom('x', 'A', 'Mx topo'), mom('x', 'B', 'Mx base'), mom('y', 'A', 'My topo'), mom('y', 'B', 'My base'))],
      }));
    },

    renderResultado(raiz, res, ctx) {
      const el = ctx.elemento;
      const arm = res.armadura;
      const taxa = arm ? arm.As / areaPilar(el) : 0;
      raiz.append(h('div', { class: 'instrumentos' },
        ui.numeroGrande({ rotulo: 'Normal de cálculo', valor: num(res.Nd, 0), unidade: 'kN', linhas: [`Nk = ${num(res.Nk.g + res.Nk.q, 0)} kN`, `ν = ${num(res.nu, 2)}`] }),
        ui.numeroGrande({ rotulo: 'Armadura longitudinal', valor: arm ? arm.rotulo : '—', linhas: arm ? [`${num(arm.As)} cm²`, `Estribos ${arm.estribo.rotulo}`] : ['Sem solução', ''], alerta: !arm }),
        ui.mostrador({ rotulo: 'Esbeltez x', valor: num(res.dirX.lambda, 1), numero: res.dirX.lambda, maximo: 120, limite: res.dirX.lambda1, sigla: 'λx' }),
        ui.mostrador({ rotulo: 'Esbeltez y', valor: num(res.dirY.lambda, 1), numero: res.dirY.lambda, maximo: 120, limite: res.dirY.lambda1, sigla: 'λy' }),
        ui.medidor({ rotulo: 'Taxa de armadura', valor: `${num(taxa * 100, 2)}%`, fracao: taxa / 0.04, legenda: `mín. ${num((res.AsMin / areaPilar(el)) * 100, 2)}% · máx. 4%` }),
        arm && (() => {
          const uso = Math.max(res.dirX.Md / arm.MRdx, res.dirY.Md / arm.MRdy, arm.obliqua?.usoMax ?? 0);
          return ui.arco({ rotulo: 'Aproveitamento', valor: `${num(uso * 100, 0)}%`, fracao: uso, legenda: arm.obliqua ? 'MSd / MRd (inclui flexão oblíqua)' : 'Md / MRd' });
        })(),
      ));

      raiz.append(ui.secao({
        numero: '04', titulo: 'Seção e esforços', descricao: 'Flexo-compressão normal em cada direção (a flexão oblíqua vem a seguir)',
        filhos: [h('div', { class: 'pilar-res' },
          h('div', { class: 'desenho-caixa centro' }, secao(el, arm)),
          ui.tabela({
            colunas: [{ titulo: 'Grandeza' }, { titulo: 'Direção x', alinhar: 'dir' }, { titulo: 'Direção y', alinhar: 'dir' }],
            linhas: [
              ['Esbeltez λ', num(res.dirX.lambda, 1), num(res.dirY.lambda, 1)],
              ['Esbeltez limite λ1', num(res.dirX.lambda1, 1), num(res.dirY.lambda1, 1)],
              ['M1d,mín (kN·m)', num(res.dirX.M1min), num(res.dirY.M1min)],
              ['M2d (kN·m)', num(res.dirX.M2), num(res.dirY.M2)],
              ['Md,tot (kN·m)', num(res.dirX.Md), num(res.dirY.Md)],
              ['MRd (kN·m)', arm ? num(arm.MRdx) : '—', arm ? num(arm.MRdy) : '—'],
              ['Método', res.dirX.segundaOrdem ? 'Curvatura aprox.' : '1ª ordem', res.dirY.segundaOrdem ? 'Curvatura aprox.' : '1ª ordem'],
            ],
          }),
        )],
      }));
      if (arm?.curva?.length) {
        raiz.append(ui.secao({
          numero: '05', titulo: 'Flexão oblíqua', descricao: `Curva de interação Mx–My para Nd = ${num(res.Nd, 0)} kN (17.2) e envoltória mínima (11.3.3.4.3)`,
          filhos: [h('div', { class: 'pilar-res' },
            h('div', { class: 'desenho-caixa centro' }, diagramaInteracao(api, res)),
            ui.tabela({
              colunas: [{ titulo: 'Ponto' }, { titulo: 'MSd,x', alinhar: 'dir' }, { titulo: 'MSd,y', alinhar: 'dir' }, { titulo: 'MRd na direção', alinhar: 'dir' }, { titulo: 'Uso', alinhar: 'dir' }, { titulo: '' }],
              linhas: [
                ['Envoltória mínima (semieixos)', `${num(res.minimos.x)}`, `${num(res.minimos.y)}`, '—', `${num(arm.obliqua.usoMinima * 100, 0)} %`, ui.selo(arm.obliqua.usoMinima <= 1)],
                ...arm.obliqua.pontos.map((p) => [p.nome, num(p.Mx), num(p.My), num(p.MRd), `${num(p.uso * 100, 0)} %`, ui.selo(p.uso <= 1)]),
              ],
            }),
          )],
        }));
      }
      const det = detalhamentoPilar(ctx.elemento, res, ctx.projeto);
      if (det?.posicoes?.length) {
        raiz.append(secaoListaDeFerros(api, ctx, det, {
          descricao: 'Barras longitudinais, traspasse, arranques, estribos e suplementares (NBR 6118, 9.5.2.3, 18.2.4 e 18.4) · lista de ferros editável',
          volume: (areaPilar(ctx.elemento) * ctx.elemento.comprimento) / 1e4,
          tituloVerificacoes: 'Estribos e barras protegidas',
          desenho: (posicoes, destaque) => desenhoPilar.detalhe(ctx.elemento, det, posicoes, { destaque }),
          modelo3d: (posicoes) => modeloPilar(ctx.elemento, det, posicoes, { pontos: res.armadura?.pontos ?? [], cob: res.armadura?.cobrimento ?? 3, dmax: ctx.materiais?.dmax ?? 19 }),
          nota: `Barras verticais em boa aderência. Traspasse de compressão l0c = lb,nec ≥ máx(0,6·lb; 15ø; 20 cm) = ${num(det.l0c, 0)} cm (lb = ${num(det.lb, 0)} cm): as barras deste lance sobem para emendar com as do lance de cima; no último lance terminam no topo menos o cobrimento. Na fundação ou na viga em que o pilar nasce, os arranques (esperas) ficam embutidos até o fundo menos o cobrimento, com pé dobrado para apoio, e sobem l0c — a ancoragem da espera na sapata ou no bloco é verificada no módulo da fundação. Estribos ao longo do lance; os grampos suplementares seguram as barras a mais de 20·øt do canto (18.2.4). O resumo soma as perdas adotadas no projeto.`,
        }));
      }
      if (res.portico) raiz.append(secaoPortico(res.portico, ctx, res.comb?.Nd));
      if (res.combinacoes) raiz.append(secaoCombinacoes(api, res, { governa: [[res.comb.Nd, 'Nd']], usoEls: 'Momentos aplicados tratados como permanentes (γg).' }));
    },
  };
}

/**
 * Diagrama de interação Mx–My: curva resistente (polígono), envoltória mínima (elipse tracejada)
 * e pontos de cálculo (topo/base e seção intermediária).
 */
function diagramaInteracao(api, res) {
  const { s } = api.dom;
  const { num } = api.formatar;
  const curva = res.armadura.curva;
  const pts = res.armadura.obliqua.pontos;
  const W = 480, H = 520, m = 64, HG = 470;   // HG: altura do gráfico (a legenda fica embaixo)
  const lim = Math.max(...curva.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y))), res.minimos.x, res.minimos.y, ...pts.map((p) => Math.max(p.Mx, p.My))) * 1.08 || 1;
  const esc = (Math.min(W, HG) / 2 - m) / lim;
  const X = (v) => W / 2 + v * esc, Y = (v) => HG / 2 - v * esc;
  const filhos = [];
  // eixos e grade leve
  filhos.push(s('line', { x1: m / 3, y1: HG / 2, x2: W - m / 3, y2: HG / 2, class: 'ia-eixo' }), s('line', { x1: W / 2, y1: m / 2, x2: W / 2, y2: HG - m / 3, class: 'ia-eixo' }));
  filhos.push(s('text', { x: W - 4, y: HG / 2 - 10, 'text-anchor': 'end', class: 'ia-rot' }, 'Mx (kN·m)'), s('text', { x: W / 2 + 10, y: 24, class: 'ia-rot' }, 'My (kN·m)'));
  // curva resistente
  filhos.push(s('path', { d: `M${curva.map((p) => `${X(p.x)},${Y(p.y)}`).join(' L')} Z`, class: 'ia-curva' }));
  // envoltória mínima
  filhos.push(s('ellipse', { cx: W / 2, cy: HG / 2, rx: res.minimos.x * esc, ry: res.minimos.y * esc, class: 'ia-minima' }));
  // marcas dos eixos: MRd nas direções principais
  const ex = curva.reduce((a, p) => (Math.abs(p.y) < Math.abs(a.y) && p.x > 0 ? p : a), { x: 0, y: Infinity });
  const ey = curva.reduce((a, p) => (Math.abs(p.x) < Math.abs(a.x) && p.y > 0 ? p : a), { x: Infinity, y: 0 });
  if (Number.isFinite(ex.y)) filhos.push(s('text', { x: X(ex.x) - 6, y: HG / 2 + 28, 'text-anchor': 'end', class: 'ia-valor' }, num(ex.x, 1)));
  if (Number.isFinite(ey.x)) filhos.push(s('text', { x: W / 2 - 10, y: Y(ey.y) + 8, 'text-anchor': 'end', class: 'ia-valor' }, num(ey.y, 1)));
  // pontos de cálculo
  // pontos coincidentes (sem 2ª ordem) recebem um rótulo só
  const grupos = [];
  for (const p of pts) {
    const g = grupos.find((q) => Math.abs(q.Mx - p.Mx) < 1e-6 && Math.abs(q.My - p.My) < 1e-6);
    if (g) g.nomes.push(p.tipo); else grupos.push({ ...p, nomes: [p.tipo] });
  }
  for (const p of grupos) {
    filhos.push(s('circle', { cx: X(p.Mx), cy: Y(p.My), r: 6, class: `ia-ponto ${p.nomes.length > 1 ? 'intermediaria' : p.tipo} ${p.uso > 1 ? 'falha' : ''}` }));
    const rot = p.nomes.length > 1 ? 'topo/base e intermediária' : p.tipo === 'extremidade' ? 'topo/base' : 'intermediária';
    filhos.push(s('text', { x: X(p.Mx) + 12, y: Y(p.My) - 10, class: 'ia-valor' }, rot));
  }
  filhos.push(s('text', { x: 4, y: H - 34, class: 'ia-legenda' }, 'linha cheia: resistente'), s('text', { x: 4, y: H - 6, class: 'ia-legenda' }, 'tracejada: envoltória mínima'));
  return s('svg', { class: 'desenho interacao', viewBox: `0 0 ${W} ${H}`, width: W, style: 'max-width: 100%' }, ...filhos);
}
