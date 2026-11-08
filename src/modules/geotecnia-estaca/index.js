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
 * Módulo: Estaca isolada (NBR 6122) — capacidade de carga pelo SPT por Aoki-Velloso e Décourt-Quaresma,
 * carga admissível com o fator de segurança da norma e curva carga × comprimento.
 */
import { calcularEstaca, criarEstaca } from './calculo.js';
import { TIPOS_ESTACA } from '../../engine/estacas.js';
import { pilaresDeFundacao } from '../concreto-sapata/calculo.js';
import { secaoListaDeFerros } from '../comum/detalhamento-ui.js';

const fmt = (v, c = 0) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');

export default function moduloEstaca(api) {
  const { h, s } = api.dom;
  const ui = api.ui;
  const { num } = api.formatar;

  /** Estaca no perfil do solo, com os NSPT do fuste. */
  function desenhoPerfil(r) {
    const W = 360, prof = Math.max(r.limiteFuro, r.pontaFuro + 1), esc = Math.min(30, 560 / prof), y0 = 30, H = y0 + prof * esc + 26;
    const x0 = 70, larg = 120;
    const y = (p) => y0 + p * esc;
    const f = [];
    for (const c of r.camadas) f.push(s('rect', { x: x0, y: y(c.de), width: larg, height: (c.ate - c.de) * esc, class: `sd-solo sd-${c.solo}` }),
      s('text', { x: x0 + larg + 8, y: y((c.de + c.ate) / 2) + 4, class: 'dg-texto est-solo' }, c.nome));
    f.push(s('rect', { x: x0, y: y0, width: larg, height: (r.camadas.at(-1)?.ate ?? 0) * esc, class: 'sd-borda' }));
    for (let p = 0; p <= Math.floor(prof); p++) f.push(s('text', { x: x0 - 8, y: y(p) + 4, 'text-anchor': 'end', class: 'sd-escala' }, String(p)));
    const dpx = Math.max(6, (r.D / 100) * esc * 1.2);
    const cx = x0 + larg / 2;
    f.push(s('rect', { x: cx - dpx / 2, y: y(r.topoFuro), width: dpx, height: r.L * esc, class: 'est-fuste' }));
    for (const t of r.trechos) f.push(s('text', { x: cx + dpx / 2 + 4, y: y((t.de + t.ate) / 2) + 4, class: 'est-n' }, t.N != null ? String(Math.round(t.N)) : ''));
    f.push(s('line', { x1: x0 - 4, y1: y(r.pontaFuro), x2: x0 + larg + 4, y2: y(r.pontaFuro), class: 'sd-fim' }),
      s('text', { x: x0, y: y(r.pontaFuro) + 14, class: 'dg-texto' }, `ponta ${fmt(r.pontaFuro, 2)} m`),
      s('text', { x: x0, y: 16, class: 'dg-titulo' }, `${r.furo.codigo} · ESTACA ${fmt(r.D)} cm × ${fmt(r.L, 1)} m`));
    if (!r.nivelAgua?.seco && r.nivelAgua?.inicial != null) f.push(s('path', { d: `M${x0 - 30} ${y(r.nivelAgua.inicial) - 8}h12l-6 8z`, class: 'sd-na' }));
    return s('svg', { class: 'desenho estaca-perfil', viewBox: `0 0 ${W} ${H}`, width: W, height: H }, ...f);
  }

  /** Curva carga admissível × comprimento pelos dois métodos. */
  function desenhoCurva(r) {
    const W = 560, H = 420, m = { e: 84, d: 20, t: 48, b: 92 };
    const pts = r.curva;
    if (pts.length < 2) return h('p', { class: 'combinacoes-nota' }, 'A sondagem não tem profundidade para a curva.');
    const Lmax = pts.at(-1).L, Lmin = pts[0].L;
    const Pmax = Math.max(...pts.flatMap((p) => [p.av, p.dq]), r.Nk ?? 0) * 1.08;
    const X = (L) => m.e + ((L - Lmin) / (Lmax - Lmin)) * (W - m.e - m.d), Y = (P) => H - m.b - (P / Pmax) * (H - m.t - m.b);
    const f = [];
    for (let k = 0; k <= 4; k++) { const P = (Pmax * k) / 4; f.push(s('line', { x1: m.e, y1: Y(P), x2: W - m.d, y2: Y(P), class: 'sd-grade' }), s('text', { x: m.e - 10, y: Y(P) + 8, 'text-anchor': 'end', class: 'sd-escala' }, fmt(P))); }
    for (const p of pts) f.push(s('text', { x: X(p.L), y: H - m.b + 28, 'text-anchor': 'middle', class: 'sd-escala' }, String(p.L)));
    const linha = (k, cls) => s('polyline', { points: pts.map((p) => `${X(p.L)},${Y(p[k])}`).join(' '), class: cls });
    f.push(linha('av', 'est-av'), linha('dq', 'est-dq'));
    if (r.Nk) f.push(s('line', { x1: m.e, y1: Y(r.Nk), x2: W - m.d, y2: Y(r.Nk), class: 'est-nk' }), s('text', { x: W - m.d, y: Y(r.Nk) - 8, 'text-anchor': 'end', class: 'est-nk-rot' }, `Nk = ${fmt(r.Nk)} kN`));
    f.push(s('circle', { cx: X(r.L), cy: Y(r.Padm), r: 6, class: 'est-atual' }),
      s('text', { x: 0, y: 24, class: 'dg-titulo' }, 'CARGA ADMISSÍVEL (kN) × COMPRIMENTO (m)'),
      s('text', { x: W - m.d, y: H - 8, 'text-anchor': 'end', class: 'est-leg' }, '— Aoki-Velloso   — Décourt-Quaresma'));
    return s('svg', { class: 'desenho estaca-curva', viewBox: `0 0 ${W} ${H}`, width: W, height: H }, ...f);
  }

  return {
    id: 'geotecnia.estaca',
    nome: 'Estaca isolada',
    nomeCurto: 'Estaca',
    categoria: 'fundacoes',
    novaCategoria: { id: 'fundacoes', nome: 'Fundações', ordem: 4 },
    prefixo: 'E',
    sigla: 'GE1',
    icone: 'estaca',
    forma: 'estaca',
    material: 'Concreto',
    norma: 'NBR 6122',
    versao: '0.1.0',
    descricao: 'Capacidade de carga de estacas pelo SPT (Aoki-Velloso e Décourt-Quaresma), carga admissível e comprimento.',
    montagem: false,

    criar: criarEstaca,
    calcular: (el, ctx) => calcularEstaca(el, ctx),
    resumo: (el) => `${TIPOS_ESTACA[el.tipo]?.nome ?? el.tipo} · ø ${num(el.D, 0)} cm · L ${num(el.L, 1)} m`,

    renderEntrada(raiz, ctx) {
      const el = ctx.elemento;
      const t = TIPOS_ESTACA[el.tipo] ?? TIPOS_ESTACA.helice;
      const fund = pilaresDeFundacao(ctx.projeto);
      const furos = ctx.projeto.elementos.filter((e) => e.modulo === 'geotecnia.sondagem');
      raiz.append(ui.secao({
        numero: '01', titulo: 'Tipo e geometria', descricao: 'NBR 6122 — estacas moldadas in loco e pré-moldadas',
        filhos: [
          ui.linhaCampos(
            ui.selecao({ rotulo: 'Tipo de estaca', valor: el.tipo, largura: '320px', opcoes: Object.entries(TIPOS_ESTACA).map(([k, v]) => ({ valor: k, texto: v.nome })),
              aoMudar: (v) => ctx.alterar((e) => { e.tipo = v; if (v === 'broca' && e.D > 30) e.D = 25; if (v !== 'premoldada') e.secao = 'circular'; }, { estrutural: true }) }),
            el.tipo === 'premoldada' ? ui.segmentado({ rotulo: 'Seção', valor: el.secao ?? 'circular', opcoes: [{ valor: 'circular', texto: 'Circular' }, { valor: 'quadrada', texto: 'Quadrada' }], aoMudar: (v) => ctx.alterar((e) => { e.secao = v; }, { estrutural: true }) }) : null,
          ),
          ui.linhaCampos(
            ui.campo({ rotulo: el.secao === 'quadrada' ? 'Lado' : 'Diâmetro', valor: el.D, unidade: 'cm', casas: 0, min: 15, max: 150, largura: '140px', aoMudar: (v) => ctx.alterar((e) => { e.D = v; }) }),
            ui.campo({ rotulo: 'Comprimento L', valor: el.L, unidade: 'm', casas: 1, min: 2, max: 60, largura: '150px', aoMudar: (v) => ctx.alterar((e) => { e.L = v; }) }),
            ui.campo({ rotulo: 'Topo (arrasamento)', valor: el.topo, unidade: 'm', casas: 2, min: 0, max: 10, largura: '170px', dica: 'Profundidade do topo da estaca abaixo do terreno (cota 0 do projeto)', aoMudar: (v) => ctx.alterar((e) => { e.topo = v; }) }),
          ),
          t.escavada ? ui.alternar({ rotulo: 'Limitar a ponta a 20 % da carga admissível (estacas escavadas, NBR 6122)', valor: el.limitarPonta ?? true, aoMudar: (v) => ctx.alterar((e) => { e.limitarPonta = v; }) }) : null,
        ].filter(Boolean),
      }));
      raiz.append(ui.secao({
        numero: '02', titulo: 'Locação, sondagem e carga', descricao: 'O furo mais próximo do pilar (ou da locação) dá o perfil e o NSPT',
        filhos: [
          ui.linhaCampos(
            ui.selecao({ rotulo: 'Pilar sobre a estaca', valor: el.pilarId ?? '', largura: '300px',
              opcoes: [{ valor: '', texto: 'Nenhum — locação e carga informadas' }, ...fund.map(({ pilar: p }) => ({ valor: p.id, texto: `${p.codigo} · ${num(p.bx, 0)} × ${num(p.by, 0)} cm` }))],
              aoMudar: (v) => ctx.alterar((e) => { e.pilarId = v || null; }, { estrutural: true }) }),
            ui.selecao({ rotulo: 'Furo de sondagem', valor: el.sondagemId ?? '', largura: '280px',
              opcoes: [{ valor: '', texto: furos.length ? 'O mais próximo' : 'Nenhum furo no projeto' }, ...furos.map((x) => ({ valor: x.id, texto: `${x.codigo} · ${x.nome}` }))],
              aoMudar: (v) => ctx.alterar((e) => { e.sondagemId = v || null; }) }),
          ),
          el.pilarId ? null : ui.linhaCampos(
            ui.campo({ rotulo: 'x na planta', valor: el.local?.x ?? 0, unidade: 'm', casas: 2, min: -1000, max: 1000, largura: '130px', aoMudar: (v) => ctx.alterar((e) => { e.local = { ...(e.local ?? {}), x: v }; }) }),
            ui.campo({ rotulo: 'y na planta', valor: el.local?.y ?? 0, unidade: 'm', casas: 2, min: -1000, max: 1000, largura: '130px', aoMudar: (v) => ctx.alterar((e) => { e.local = { ...(e.local ?? {}), y: v }; }) }),
            ui.texto({ rotulo: 'Carga de trabalho (kN)', valor: el.cargaTrabalho != null ? num(el.cargaTrabalho, 1) : '', largura: '180px', placeholder: 'opcional', aoMudar: (v) => ctx.alterar((e) => { const x = api.formatar.lerNumero(v); e.cargaTrabalho = Number.isFinite(x) && x > 0 ? x : null; }) }),
          ),
          el.pilarId ? h('p', { class: 'combinacoes-nota' }, 'A carga de trabalho é a normal característica do pilar (G + Q). Para dividir a carga de um pilar entre várias estacas, use o bloco sobre estacas (próxima etapa).') : null,
        ].filter(Boolean),
      }));
      raiz.append(ui.secao({
        numero: '03', titulo: 'Carga estrutural', descricao: t.fck ? 'Moldadas in loco: 0,85·fck/γc·A/1,4 (NBR 6122, Tabela 4 — conferir)' : 'Pré-moldadas: carga do catálogo do fabricante',
        filhos: [t.fck
          ? ui.linhaCampos(
            ui.campo({ rotulo: 'fck máximo', valor: el.estrutural?.fck ?? t.fck, unidade: 'MPa', casas: 0, min: 10, max: 50, largura: '140px', aoMudar: (v) => ctx.alterar((e) => { e.estrutural = { ...(e.estrutural ?? {}), fck: v }; }) }),
            ui.campo({ rotulo: 'γc', valor: el.estrutural?.gc ?? t.gc, casas: 2, min: 1.2, max: 2.5, largura: '110px', aoMudar: (v) => ctx.alterar((e) => { e.estrutural = { ...(e.estrutural ?? {}), gc: v }; }) }))
          : ui.linhaCampos(ui.texto({ rotulo: 'Carga estrutural de catálogo (kN)', valor: el.estrutural?.catalogo != null ? num(el.estrutural.catalogo, 0) : '', largura: '240px', placeholder: 'do fabricante', aoMudar: (v) => ctx.alterar((e) => { const x = api.formatar.lerNumero(v); e.estrutural = { ...(e.estrutural ?? {}), catalogo: Number.isFinite(x) && x > 0 ? x : null }; }) }))],
      }));
    },

    renderResultado(raiz, r, ctx) {
      raiz.append(h('div', { class: 'instrumentos' },
        ui.numeroGrande({ rotulo: 'Carga admissível', valor: num(r.Padm, 0), unidade: 'kN', linhas: [`governa: ${r.governa}`, r.Nk ? `carga de trabalho ${num(r.Nk, 0)} kN` : 'sem carga de trabalho'] }),
        ui.numeroGrande({ rotulo: 'Aoki-Velloso', valor: num(r.av.R, 0), unidade: 'kN', linhas: [`ponta ${num(r.av.Rp, 0)} + atrito ${num(r.av.Rl, 0)}`, `Padm = ${num(r.av.Padm, 0)} kN`] }),
        ui.numeroGrande({ rotulo: 'Décourt-Quaresma', valor: num(r.dq.R, 0), unidade: 'kN', linhas: [`ponta ${num(r.dq.Rp, 0)} + atrito ${num(r.dq.Rl, 0)}`, `Padm = ${num(r.dq.Padm, 0)} kN`] }),
        r.Nk ? ui.arco({ rotulo: 'Aproveitamento', valor: `${num((r.Nk / r.Padm) * 100, 0)}%`, fracao: r.Nk / r.Padm, legenda: `${num(r.Nk, 0)} de ${num(r.Padm, 0)} kN` }) : null,
      ));
      raiz.append(ui.secao({
        numero: '04', titulo: 'Capacidade de carga', descricao: `${r.nomeTipo} ø ${num(r.D, 0)} cm, L = ${num(r.L, 1)} m · furo ${r.furo.codigo}${r.furo.distancia != null ? ` a ${num(r.furo.distancia)} m` : ''} · ruptura R e admissível R/2 (NBR 6122, métodos semiempíricos)`,
        filhos: [ui.tabela({
          classe: 'els-tabela',
          colunas: [{ titulo: 'Método' }, { titulo: 'Np', alinhar: 'dir' }, { titulo: 'rp (kPa)', alinhar: 'dir' }, { titulo: 'Rp (kN)', alinhar: 'dir' }, { titulo: 'Rl (kN)', alinhar: 'dir' }, { titulo: 'R (kN)', alinhar: 'dir' }, { titulo: 'Padm (kN)', alinhar: 'dir' }],
          linhas: [
            [`Aoki-Velloso (F1 = ${num(r.av.F1)}, F2 = ${num(r.av.F2)})`, num(r.av.Np, 0), num(r.av.rp, 0), num(r.av.Rp, 1), num(r.av.Rl, 1), num(r.av.R, 1), h('b', null, `${num(r.av.Padm, 1)}${r.av.limitePonta ? ' *' : ''}`)],
            [`Décourt-Quaresma (α = ${num(r.dq.alfa)}, β = ${num(r.dq.beta)}, Nl = ${num(r.dq.Nl, 1)})`, num(r.dq.Np, 1), num(r.dq.rp, 0), num(r.dq.Rp, 1), num(r.dq.Rl, 1), num(r.dq.R, 1), h('b', null, `${num(r.dq.Padm, 1)}${r.dq.limitePonta ? ' *' : ''}`)],
            ...(r.estrutural ? [['Carga estrutural', '', '', '', '', '', num(r.estrutural, 1)]] : []),
          ],
        }),
        (r.av.limitePonta || r.dq.limitePonta) ? h('p', { class: 'combinacoes-nota' }, '* Limitada a 1,25·Rl/2: nas estacas escavadas, no máximo 20 % da carga admissível vem da ponta (NBR 6122).') : null,
        h('div', { class: 'sapata-desenhos' }, h('div', { class: 'desenho-caixa centro' }, desenhoPerfil(r)), h('div', { class: 'desenho-caixa centro' }, desenhoCurva(r))),
        ].filter(Boolean),
      }));
      raiz.append(ui.secao({
        numero: '05', titulo: 'Fuste por trecho', descricao: 'NSPT (limitado a 50) e atrito unitário do Aoki-Velloso; os marcados entram no Np do Décourt-Quaresma',
        filhos: [ui.tabela({
          classe: 'els-tabela',
          colunas: [{ titulo: 'De (m)', alinhar: 'dir' }, { titulo: 'Até (m)', alinhar: 'dir' }, { titulo: 'Solo' }, { titulo: 'NSPT', alinhar: 'dir' }, { titulo: 'rl AV (kPa)', alinhar: 'dir' }, { titulo: '' }],
          linhas: r.trechos.map((t) => [num(t.de), num(t.ate), t.solo.replace('-', ' '), num(t.N, 0), t.semAtrito ? 'desprezado' : num(t.rlAV, 1), t.ponta ? 'ponta (DQ)' : '']),
        }),
        ui.tabela({
          classe: 'els-tabela',
          colunas: [{ titulo: 'L (m)', alinhar: 'dir' }, { titulo: 'Aoki-Velloso (kN)', alinhar: 'dir' }, { titulo: 'Décourt-Quaresma (kN)', alinhar: 'dir' }, { titulo: 'Adotada (kN)', alinhar: 'dir' }],
          linhas: r.curva.map((c) => [c.L === r.L ? h('b', null, num(c.L, 0)) : num(c.L, 0), num(c.av, 1), num(c.dq, 1), h('b', null, num(c.adotada, 1))]),
        })],
      }));
      const ae = r.armadura;
      if (ae) raiz.append(ui.secao({
        numero: '06', titulo: 'Armadura da estaca', descricao: `NBR 6122:2019, 8.6.3 e Tabela 4${r.Nk ? '' : ' — sem carga de trabalho, calculada para a carga admissível'}`,
        filhos: [ui.tabela({ classe: 'els-tabela', colunas: [{ titulo: 'Grandeza' }, { titulo: 'Valor', alinhar: 'dir' }], linhas: [
          ['Concreto (Tabela 4)', `C${ae.fck}, γc = ${num(ae.gc, 1)} → fcd = ${num(ae.fck / ae.gc, 2)} MPa`],
          ['Tensão σ = Nk/Ac', `${num(ae.sigma, 2)} MPa ${ae.precisa ? '>' : '≤'} ${num(ae.sigmaLim, 1)} MPa`],
          ['Armadura', ae.precisa ? `Nd = ${num(ae.Nd, 1)} kN → As,nec = ${num(ae.AsNec)} cm² (mín. ${num(ae.AsMin)} cm²)` : `só a ligação com o bloco: 0,4 %·Ac = ${num(ae.AsMin)} cm²`],
          ['Gaiola', `${ae.barras?.rotulo ?? '—'} · estribo circular ${ae.estribo.rotulo}`],
          ['Comprimento armado', `${num(ae.Larm, 1)} m (mín. ${num(ae.Lmin, 1)} m) + espera de ${num(ae.espera, 0)} cm no bloco`],
        ] })],
      }));
      if (ctx && r.detalhamento?.posicoes?.length) raiz.append(secaoListaDeFerros(api, ctx, r.detalhamento, {
        titulo: 'Ferragem da estaca', descricao: 'Gaiola: barras longitudinais e estribo circular (NBR 6118, 18.4) · lista de ferros editável',
        nota: 'A espera entra no bloco com o comprimento de ancoragem básico (boa aderência). Estribos no trecho armado.',
      }));
    },
  };
}
