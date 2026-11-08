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
 * Módulo: Laje maciça de concreto armado (NBR 6118:2023)
 */
import { camposCargasLaje } from '../comum/cargas-laje.js';
import { secaoArmadura } from '../comum/armadura.js';
import { calcularLaje, cargasTransmitidas, ligacoes, criarLaje, cargasLaje, BORDAS, temBordaLivre, emBalanco, POSICOES_PUNCAO, novaCargaConcentrada } from './calculo.js';
import { desenhoContornos, legendaContornos, tabelaPuncao } from '../comum/puncao.js';
import { placaEstavel } from '../../engine/placa.js';
import { detalhamentoLaje } from '../comum/detalhamento.js';
import { secaoListaDeFerros } from '../comum/detalhamento-ui.js';
import { modeloLaje } from '../comum/armadura3d.js';
import { criarDesenhoLaje } from './desenho.js';

/** Ordem do ciclo ao clicar numa borda da planta. */
const PROXIMO_VINCULO = { apoiada: 'engastada', engastada: 'livre', livre: 'apoiada' };
const ROTULO_VINCULO = { apoiada: 'APOIADA', engastada: 'ENGASTADA', livre: 'LIVRE' };

export default function moduloLajeMacica(api) {
  const { h, s } = api.dom;
  const desenhoLaje = criarDesenhoLaje(api.dom);
  const ui = api.ui;
  const { num } = api.formatar;

  /** Planta da laje: bordas clicáveis alternam apoiada → engastada → livre. */
  function planta(el, { aoAlternar, reacoes } = {}) {
    const W = 520, H = 360, m = 70;
    const esc = Math.min((W - 2 * m) / el.lx, (H - 2 * m) / el.ly);
    const w = el.lx * esc, hh = el.ly * esc;
    const x0 = (W - w) / 2, y0 = (H - hh) / 2;
    const pontas = {
      y0: [x0, y0 + hh, x0 + w, y0 + hh], y1: [x0, y0, x0 + w, y0],
      x0: [x0, y0, x0, y0 + hh], x1: [x0 + w, y0, x0 + w, y0 + hh],
    };
    const fora = { y0: [0, 1], y1: [0, -1], x0: [-1, 0], x1: [1, 0] };
    const filhos = [s('rect', { x: x0, y: y0, width: w, height: hh, class: 'pl-laje' })];

    // linhas de ruptura (processo das áreas): retas a 45° entre vínculos iguais e
    // a 60° a partir do engaste; cada ponto pertence à borda de menor distância ponderada.
    // Com borda livre o processo das áreas não se aplica: as reações vêm do modelo de placa.
    if (!temBordaLivre(el.bordas)) desenharRuptura();
    function desenharRuptura() {
      const peso = (b) => (el.bordas[b] === 'engastada' ? Math.sqrt(3) : 1);
      const distP = (px, py) => ({
        x0: (px - x0) / peso('x0'), x1: (x0 + w - px) / peso('x1'),
        y1: (py - y0) / peso('y1'), y0: (y0 + hh - py) / peso('y0'),
      });
      const maisProxima = (px, py) => Object.entries(distP(px, py)).sort((a, b) => a[1] - b[1])[0][0];
      const cantos = {
        BE: { p: [x0, y0 + hh], a: 'y0', b: 'x0' }, BD: { p: [x0 + w, y0 + hh], a: 'y0', b: 'x1' },
        TD: { p: [x0 + w, y0], a: 'y1', b: 'x1' }, TE: { p: [x0, y0], a: 'y1', b: 'x0' },
      };
      for (const c of Object.values(cantos)) {
        const ang = Math.atan2(peso(c.a), peso(c.b)); // ângulo medido a partir da borda horizontal
        const dx = c.p[0] < x0 + w / 2 ? 1 : -1, dy = c.p[1] > y0 + hh / 2 ? -1 : 1;
        let fim = c.p;
        for (let l = 1; l < w + hh; l += 0.5) {
          const px = c.p[0] + dx * l * Math.cos(ang), py = c.p[1] + dy * l * Math.sin(ang);
          if (![c.a, c.b].includes(maisProxima(px, py))) break;
          fim = [px, py];
        }
        c.fim = fim;
        filhos.push(s('line', { x1: c.p[0], y1: c.p[1], x2: fim[0], y2: fim[1], class: 'pl-ruptura' }));
      }
      for (const [ca, cb] of [['BE', 'BD'], ['TE', 'TD'], ['BE', 'TE'], ['BD', 'TD']]) {
        const [p1, p2] = [cantos[ca].fim, cantos[cb].fim];
        if (Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) > 1) filhos.push(s('line', { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], class: 'pl-ruptura' }));
      }
    }

    for (const b of BORDAS) {
      const [xa, ya, xb, yb] = pontas[b.id];
      const tipo = el.bordas[b.id];
      const eng = tipo === 'engastada';
      const [fx, fy] = fora[b.id];
      const g = s('g', { class: ['pl-borda', tipo, aoAlternar && 'clicavel'].filter(Boolean).join(' '), onClick: aoAlternar ? () => aoAlternar(b.id) : null },
        s('line', { x1: xa, y1: ya, x2: xb, y2: yb, class: 'pl-borda-linha' }),
        s('line', { x1: xa + fx * 12, y1: ya + fy * 12, x2: xb + fx * 12, y2: yb + fy * 12, class: 'pl-borda-alvo' }),
      );
      if (eng) {
        const len = Math.hypot(xb - xa, yb - ya), n = Math.floor(len / 10);
        for (let i = 0; i <= n; i++) {
          const px = xa + ((xb - xa) * i) / n, py = ya + ((yb - ya) * i) / n;
          g.append(s('line', { x1: px, y1: py, x2: px + fx * 9 + (fy ? 5 : 0), y2: py + fy * 9 + (fx ? 5 : 0), class: 'pl-hachura' }));
        }
      }
      const mx = (xa + xb) / 2 + fx * 50, my = (ya + yb) / 2 + fy * 30;
      g.append(s('text', { x: mx, y: my + 4, 'text-anchor': 'middle', class: 'pl-rot' }, ROTULO_VINCULO[tipo] ?? 'APOIADA'));
      if (reacoes && tipo !== 'livre') {
        const rr = reacoes.find((x) => x.id === b.id);
        g.append(s('text', { x: mx, y: my + 18, 'text-anchor': 'middle', class: 'pl-reacao' }, `${num(rr.d)} kN/m`));
      }
      filhos.push(g);
    }
    filhos.push(
      s('text', { x: x0 + w / 2, y: y0 + hh / 2 - 4, 'text-anchor': 'middle', class: 'pl-nome' }, el.codigo),
      s('text', { x: x0 + w / 2, y: y0 + hh / 2 + 16, 'text-anchor': 'middle', class: 'pl-dim' }, `${num(el.lx)} × ${num(el.ly)} m`),
      // eixos
      s('line', { x1: 18, y1: H - 18, x2: 54, y2: H - 18, class: 'pl-eixo' }),
      s('line', { x1: 18, y1: H - 18, x2: 18, y2: H - 54, class: 'pl-eixo' }),
      s('text', { x: 58, y: H - 14, class: 'pl-eixo-rot' }, 'x'),
      s('text', { x: 14, y: H - 58, class: 'pl-eixo-rot' }, 'y'),
    );
    return s('svg', { class: 'desenho planta', viewBox: `0 0 ${W} ${H}` }, ...filhos);
  }

  /** Situação dos vínculos, mostrada logo abaixo dos seletores de borda. */
  function avisoVinculos(bordas) {
    const linha = (texto, alerta) => h('li', { class: alerta ? '' : 'info' }, ui.icone(alerta ? 'alerta' : 'info', { tamanho: 14, traco: 1.8 }), texto);
    if (!placaEstavel(bordas)) return h('ul', { class: 'avisos' }, linha('Laje instável: use ao menos uma borda engastada ou duas bordas apoiadas.', true));
    if (emBalanco(bordas)) return h('ul', { class: 'avisos' }, linha('Laje em balanço: espessura mínima de 10 cm e γn para h < 19 cm (NBR 6118, 13.2.4.1).', false));
    if (temBordaLivre(bordas)) return h('ul', { class: 'avisos' }, linha('Borda livre: as reações nas vigas vêm do modelo de placa.', false));
    return null;
  }

  /** Cargas concentradas e pilares sobre a laje, verificados à punção (19.5). */
  function secaoCargasConcentradas(ctx) {
    const el = ctx.elemento;
    const lista = el.cargasConcentradas ?? [];
    const mudar = (i, fn, estrutural = false) => ctx.alterar((e) => fn(e.cargasConcentradas[i]), { estrutural });
    const linhas = lista.map((c, i) => h('div', { class: 'carga-linha' },
      h('div', { class: 'carga-tipo' },
        h('span', { class: 'carga-num' }, `P${i + 1}`),
        h('div', { class: 'carga-desc' },
          h('span', { class: 'carga-rot' }, 'Área carregada'),
          h('input', {
            class: 'carga-nome', value: c.descricao ?? '', placeholder: 'Descrição (pilar, equipamento…)', spellcheck: false,
            onKeydown: (e) => { if (e.key === 'Enter') e.target.blur(); },
            onChange: (e) => mudar(i, (cc) => { cc.descricao = e.target.value; }),
          }),
        ),
      ),
      h('div', { class: 'carga-campos' },
        ui.segmentado({ rotulo: 'Posição', valor: c.posicao ?? 'interna', compacto: true, opcoes: POSICOES_PUNCAO, aoMudar: (v) => mudar(i, (cc) => { cc.posicao = v; }, true) }),
        ui.campo({ rotulo: c.posicao === 'borda' ? 'c1 (⊥ borda)' : 'c1', valor: c.c1, unidade: 'cm', casas: 1, min: 5, max: 200, largura: '104px', dica: c.posicao === 'borda' ? 'Dimensão perpendicular à borda livre' : 'Dimensão da área carregada na direção x', aoMudar: (v) => mudar(i, (cc) => { cc.c1 = v; }) }),
        ui.campo({ rotulo: c.posicao === 'borda' ? 'c2 (∥ borda)' : 'c2', valor: c.c2, unidade: 'cm', casas: 1, min: 5, max: 200, largura: '104px', dica: c.posicao === 'borda' ? 'Dimensão paralela à borda livre' : 'Dimensão da área carregada na direção y', aoMudar: (v) => mudar(i, (cc) => { cc.c2 = v; }) }),
        ui.campo({ rotulo: 'Fg,k', valor: c.g, unidade: 'kN', min: 0, largura: '110px', dica: 'Parcela permanente (característica)', aoMudar: (v) => mudar(i, (cc) => { cc.g = v; }) }),
        ui.campo({ rotulo: 'Fq,k', valor: c.q, unidade: 'kN', min: 0, largura: '110px', dica: 'Parcela variável (característica)', aoMudar: (v) => mudar(i, (cc) => { cc.q = v; }) }),
        ui.selecao({
          rotulo: 'Conector', largura: '104px', valor: c.phi ?? 'auto',
          opcoes: [{ valor: 'auto', texto: 'Automático' }, ...[6.3, 8, 10, 12.5, 16].map((b) => ({ valor: b, texto: `ø ${String(b).replace('.', ',')}` }))],
          aoMudar: (v) => mudar(i, (cc) => { cc.phi = v; }),
        }),
      ),
      ui.botaoIcone({ icone: 'lixeira', titulo: 'Remover', classe: 'perigo', aoClicar: () => ctx.alterar((e) => e.cargasConcentradas.splice(i, 1), { estrutural: true }) }),
    ));
    return ui.secao({
      numero: '03', titulo: 'Cargas concentradas (punção)',
      descricao: 'Pilares ou cargas em área pequena — verificação nos contornos C, C\' e C\'\' (NBR 6118, 19.5)',
      acoes: [ui.botao({ texto: 'Adicionar', icone: 'mais', tipo: 'secundario', aoClicar: () => ctx.alterar((e) => { (e.cargasConcentradas ??= []).push(novaCargaConcentrada(e)); }, { estrutural: true }) })],
      filhos: [h('div', { class: 'cargas' }, linhas.length ? linhas : h('div', { class: 'cargas-vazio' }, 'Nenhuma carga concentrada. Use “Adicionar” para verificar a punção sob um pilar ou equipamento.'))],
    });
  }

  return {
    id: 'concreto.laje.macica',
    nome: 'Laje maciça',
    nomeCurto: 'Laje maciça',
    categoria: 'lajes',
    prefixo: 'L',
    sigla: 'CL1',
    icone: 'laje',
    material: 'Concreto armado',
    norma: 'NBR 6118:2023',
    versao: '0.1.0',
    descricao: 'Lajes retangulares com bordas apoiadas, engastadas ou livres (balanço); elementos finitos de placa.',

    criar: criarLaje,
    calcular: calcularLaje,
    cargasTransmitidas,
    ligacoes,
    resumo: (el) => `${num(el.lx)} × ${num(el.ly)} m · h = ${num(el.h, 0)} cm`,

    renderEntrada(raiz, ctx) {
      const el = ctx.elemento;
      const plantaSlot = h('div', { class: 'planta-slot' });
      const alternar = (b) => ctx.alterar((e) => { e.bordas[b] = PROXIMO_VINCULO[e.bordas[b]] ?? 'apoiada'; }, { estrutural: true });
      const desenhar = () => plantaSlot.replaceChildren(planta(ctx.elemento, { aoAlternar: alternar }));
      desenhar();
      const mudar = (fn) => { ctx.alterar(fn); desenhar(); };

      raiz.append(ui.secao({
        numero: '01', titulo: 'Geometria e vínculos', descricao: 'Clique numa borda para alternar apoiada, engastada e livre',
        filhos: [
          h('div', { class: 'laje-geo' },
            h('div', { class: 'laje-campos' },
              ui.linhaCampos(
                ui.campo({ rotulo: 'Vão lx', valor: el.lx, unidade: 'm', min: 0.5, max: 15, aoMudar: (v) => mudar((e) => { e.lx = v; }) }),
                ui.campo({ rotulo: 'Vão ly', valor: el.ly, unidade: 'm', min: 0.5, max: 15, aoMudar: (v) => mudar((e) => { e.ly = v; }) }),
                ui.campo({ rotulo: 'Espessura h', valor: el.h, unidade: 'cm', casas: 1, min: 7, max: 40, aoMudar: (v) => mudar((e) => { e.h = v; }) }),
              ),
              h('div', { class: 'bordas' }, BORDAS.map((b) => ui.segmentado({
                rotulo: b.nome, valor: el.bordas[b.id], compacto: true,
                opcoes: [
                  { valor: 'apoiada', texto: 'Apoiada' },
                  { valor: 'engastada', texto: 'Engastada' },
                  { valor: 'livre', texto: 'Livre', dica: 'Borda sem apoio (em balanço)' },
                ],
                aoMudar: (v) => ctx.alterar((e) => { e.bordas[b.id] = v; }, { estrutural: true }),
              }))),
              avisoVinculos(el.bordas),
            ),
            plantaSlot,
          ),
        ],
      }));

      raiz.append(secaoArmadura(api, ctx, [
        { chave: 'inferior', rotulo: 'Barras inferiores (positivas)', uso: 'laje' },
        { chave: 'superior', rotulo: 'Barras superiores (negativas)', uso: 'laje' },
      ], { descricao: 'Bitolas da malha — “Automática” escolhe a de menor consumo com ø ≤ h/8 e espaçamento de 8 cm a smáx' }));

      const pp = (ctx.materiais.gama * el.h) / 100;
      const { g, q } = cargasLaje(el, ctx);
      const cl = camposCargasLaje(api, ctx);
      raiz.append(ui.secao({
        numero: '02', titulo: 'Cargas', descricao: 'Valores característicos por m²',
        filhos: [
          ui.linhaCampos(cl.uso),
          ui.linhaCampos(
            cl.revestimento,
            ui.campo({ rotulo: 'Outras permanentes', valor: el.cargas.outras, unidade: 'kN/m²', min: 0, largura: '150px', dica: 'Forro, enchimento, alvenaria distribuída…', aoMudar: (v) => ctx.alterar((e) => { e.cargas.outras = v; }) }),
            cl.acidental,
            ui.alternar({ rotulo: `Peso próprio (${num(pp)} kN/m²)`, valor: el.pesoProprio, aoMudar: (v) => ctx.alterar((e) => { e.pesoProprio = v; }, { estrutural: true }) }),
          ),
          ...cl.composicao,
          h('div', { class: 'cargas-resumo' }, h('span', { class: 'rot' }, 'Total característico'), `g = ${num(g)} kN/m² · q = ${num(q)} kN/m²`),
        ],
      }));

      raiz.append(secaoCargasConcentradas(ctx));
    },

    renderResultado(raiz, res, ctx) {
      const el = ctx.elemento;
      const m = res.momentos;
      const neg = Math.min(m.Mxn, m.Myn);
      const prin = res.armaduras.find((a) => a.rotulo.startsWith(`Positiva ${res.principal}`));
      raiz.append(h('div', { class: 'instrumentos' },
        ui.numeroGrande({ rotulo: 'Momento positivo', valor: num(Math.max(m.Mx, m.My), 2), unidade: 'kN·m/m', linhas: [`Mx ${num(m.Mx)} · My ${num(m.My)}`, prin?.barras?.rotulo ?? '—'] }),
        ui.faixa({ rotulo: 'Momento negativo', valor: neg < 0 ? num(neg, 2) : '—', fracaoDegrade: 0.7, rotEsq: `M'x ${num(m.Mxn)}`, rotDir: `M'y ${num(m.Myn)}` }),
        ui.medidor({ rotulo: res.flecha.balanco ? 'Flecha na borda livre' : 'Flecha total', valor: `${num(res.flecha.ft, 1)} mm`, fracao: res.flecha.ft / res.flecha.lim, legenda: `limite ${res.flecha.balanco ? '2·l/250' : 'l/250'} = ${num(res.flecha.lim, 1)} mm` }),
        ui.arco({ rotulo: 'Cortante', valor: `${num((res.cortante.Vd / res.cortante.VRd1) * 100, 0)}%`, fracao: res.cortante.Vd / res.cortante.VRd1, legenda: 'VSd / VRd1' }),
      ));

      // mapa de deslocamentos (grade de pontos)
      const linhas = res.mapa.length, colunas = res.mapa[0].length;
      let maxI = 0, maxJ = 0;
      res.mapa.forEach((l, j) => l.forEach((v, i) => { if (v > res.mapa[maxJ][maxI]) { maxI = i; maxJ = j; } }));
      const celulas = res.mapa.flatMap((l, j) => l.map((v, i) => ({
        nivel: v < 0.08 ? null : v, destaque: i === maxI && j === maxJ, titulo: `${num(v * res.flecha.f0, 2)} mm`,
      })));
      raiz.append(ui.secao({
        numero: '04', titulo: 'Planta e deslocamentos', descricao: 'Reações nas bordas (cálculo) e mapa de flechas',
        filhos: [h('div', { class: 'laje-mapas' },
          h('div', { class: 'desenho-caixa' }, planta(el, { reacoes: res.reacoes })),
          h('div', { class: 'mapa-pontos', style: { '--proporcao': `${el.lx / el.ly}` } },
            ui.gradePontos({ colunas, celulas, classe: 'mapa' }),
            h('span', { class: 'mapa-leg' }, `Ponto terracota: flecha máxima ${num(res.flecha.f0, 2)} mm (imediata)`),
          ),
        )],
      }));

      raiz.append(ui.secao({
        numero: '05', titulo: 'Armaduras', descricao: res.balanco ? `Laje em balanço${res.gn > 1 ? ` · γn = ${num(res.gn)}` : ''}` : res.umaDirecao ? `Armada em uma direção (λ = ${num(res.lambda)})` : `Armada em duas direções (λ = ${num(res.lambda)})`,
        filhos: [ui.tabela({
          colunas: [{ titulo: 'Posição' }, { titulo: 'Md (kN·m/m)', alinhar: 'dir' }, { titulo: 'd (cm)', alinhar: 'dir' }, { titulo: 'As,calc', alinhar: 'dir' }, { titulo: 'As,mín', alinhar: 'dir' }, { titulo: 'As (cm²/m)', alinhar: 'dir' }, { titulo: 'Barras' }],
          linhas: res.armaduras.map((a) => [a.rotulo, num(a.Md), num(a.d), num(a.AsCalc), num(a.AsMin), num(a.As), a.barras?.rotulo ?? '—']),
        })],
      }));

      const det = detalhamentoLaje(ctx.elemento, res, ctx.projeto);
      if (det?.posicoes?.length) {
        raiz.append(secaoListaDeFerros(api, ctx, det, {
          descricao: 'Malhas positivas, negativas nas bordas engastadas e distribuição (NBR 6118, 19.3 e 20.1) · lista de ferros editável',
          volume: (ctx.elemento.lx * ctx.elemento.ly * ctx.elemento.h) / 100,
          desenho: (posicoes, destaque) => desenhoLaje.planta(ctx.elemento, det, posicoes, { destaque }),
          modelo3d: (posicoes) => modeloLaje(ctx.elemento, det, posicoes, { cob: ctx.projeto?.parametros?.cobrimento?.laje ?? 2.5 }),
          nota: `Positivas até a face oposta das vigas menos o cobrimento (na borda livre, até a borda menos o cobrimento), distribuídas no vão livre. Negativas com 0,25 do maior vão perpendicular à borda para cada lado (o balanço inteiro, quando a laje é em balanço) e dobras de ${num(det.dobra, 0)} cm (h − 2c); entre duas lajes a negativa é detalhada uma vez só, na de código menor, com a maior armadura das duas. Sem laje do outro lado, a negativa entra na viga até a face oposta menos o cobrimento. Distribuição dos negativos em ø 5 com ≥ 20 % da principal e ≥ 0,9 cm²/m (s ≤ 33 cm). O resumo soma as perdas adotadas no projeto.`,
        }));
      }

      raiz.append(ui.secao({
        numero: '06', titulo: 'Reações nas vigas',
        descricao: res.metodoReacoes === 'areas' ? 'Processo das áreas — transmitidas às vigas de apoio' : 'Modelo de placa (média por borda) — bordas livres não transmitem carga',
        filhos: [ui.tabela({
          colunas: [
            { titulo: 'Borda' }, { titulo: 'Vínculo' },
            ...(res.metodoReacoes === 'areas' ? [{ titulo: 'Área (m²)', alinhar: 'dir' }] : []),
            { titulo: 'g,k (kN/m)', alinhar: 'dir' }, { titulo: 'q,k (kN/m)', alinhar: 'dir' }, { titulo: 'Cálculo (kN/m)', alinhar: 'dir' },
          ],
          linhas: res.reacoes.map((r) => [
            r.nome, r.tipo,
            ...(res.metodoReacoes === 'areas' ? [num(r.area)] : []),
            ...(r.tipo === 'livre' ? ['—', '—', '—'] : [num(r.g), num(r.q), num(r.d)]),
          ]),
        })],
      }));

      for (const p of res.puncao ?? []) {
        const pos = { interna: 'interna', borda: 'de borda', canto: 'de canto' }[p.posicao];
        raiz.append(ui.secao({
          numero: '07', titulo: `Punção ${p.codigo}${p.descricao ? ` — ${p.descricao}` : ''}`,
          descricao: `Área ${pos} ${num(p.c1, 0)} × ${num(p.c2, 0)} cm · FSd = ${num(p.FSd)} kN (${p.comb}) · d = ${num(p.d)} cm · ρ = ${num(p.rho * 100, 3)} %`,
          filhos: [h('div', { class: 'puncao-res' },
            h('figure', { class: 'figura-secao' }, desenhoContornos(api, p), legendaContornos(api, p)),
            h('div', { class: 'puncao-dados' },
              tabelaPuncao(api, p),
              h('p', { class: 'combinacoes-nota' }, p.armadura
                ? `Armadura de punção: ${p.armadura.rotulo} — ${p.armadura.total} conectores, Asw = ${num(p.armadura.Asw, 2)} cm² por contorno (necessário ${num(p.armadura.AswNec, 2)} cm²), fywd = ${num(p.armadura.fywd, 0)} MPa.`
                : `Dispensa armadura de punção: τSd em C' ≤ τRd1. k = ${num(p.k, 2)}.`),
              p.armadura && el.h < 16 ? h('ul', { class: 'avisos' }, h('li', {}, ui.icone('alerta', { tamanho: 14, traco: 1.8 }), `Com armadura de punção a laje precisa de h ≥ 16 cm (h = ${num(el.h, 1)} cm).`)) : null,
            ),
          )],
        }));
      }
    },
  };
}
