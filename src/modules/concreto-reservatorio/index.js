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
 * Módulo: Reservatório retangular de concreto armado (NBR 6118:2023).
 * Elevado (sobre vigas ou pilares) ou enterrado; paredes, fundo e tampa como placas, empuxo hidrostático e de terra,
 * fissuração com limite de estanqueidade e reações nos apoios.
 */
import { calcularReservatorio, criarReservatorio, ligacoes, cargasTransmitidas, TIPOS_RESERVATORIO, APOIOS_RESERVATORIO } from './calculo.js';
import { secaoArmadura } from '../comum/armadura.js';
import { pavimentosOrdenados } from '../../renderer/core/montagem.js';

const fmt = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');

export default function moduloReservatorio(api) {
  const { h, s } = api.dom;
  const ui = api.ui;
  const { num } = api.formatar;

  /** Planificação: fundo no centro, as quatro paredes rebatidas em volta, com os momentos (kN·m/m, característicos). */
  function planificacao(r) {
    const W = 520, H = 470;
    const { Lx, Ly, Hw } = r.geometria;
    const esc = Math.min((W - 60) / (Lx + 2 * Hw), (H - 70) / (Ly + 2 * Hw));
    const cx = W / 2, cy = H / 2 + 8;
    const fx = Lx * esc, fy = Ly * esc, hw = Hw * esc;
    const cheio = r.casos[0];
    const parede = (id) => cheio.paredes.find((p) => p.id === id);
    const A = parede('A'), B = parede('B');
    const f = [];
    const caixa = (x, y, w, hh, classe) => s('rect', { x, y, width: w, height: hh, class: classe });
    const txt = (x, y, t, classe = 'res-m', anc = 'middle') => s('text', { x, y, 'text-anchor': anc, class: classe }, t);
    // fundo
    f.push(caixa(cx - fx / 2, cy - fy / 2, fx, fy, 'res-placa fundo'));
    f.push(txt(cx, cy - 12, 'FUNDO', 'res-rot'), txt(cx, cy + 4, `Mx ${fmt(r.fundo.Mx)} · My ${fmt(r.fundo.My)}`), txt(cx, cy + 18, `arestas ${fmt(r.fundo.Mxn)} / ${fmt(r.fundo.Myn)}`, 'res-m neg'));
    // paredes A (em cima e embaixo do fundo), B (à esquerda e à direita)
    for (const lado of [-1, 1]) {
      const y0 = lado < 0 ? cy - fy / 2 - hw : cy + fy / 2;
      f.push(caixa(cx - fx / 2, y0, fx, hw, 'res-placa'));
      f.push(txt(cx, y0 + hw / 2 - 4, `Mh ${fmt(A.Mh)} · Mv ${fmt(A.Mv)}`), txt(cx, y0 + hw / 2 + 10, `base ${fmt(A.compV)} · cantos ${fmt(A.compH)}`, 'res-m neg'));
      const x0 = lado < 0 ? cx - fx / 2 - hw : cx + fx / 2;
      f.push(caixa(x0, cy - fy / 2, hw, fy, 'res-placa'));
      f.push(s('text', { x: x0 + hw / 2, y: cy, 'text-anchor': 'middle', class: 'res-m', transform: `rotate(-90 ${x0 + hw / 2} ${cy})` }, `Mh ${fmt(B.Mh)} · Mv ${fmt(B.Mv)}`),
        s('text', { x: x0 + hw / 2 + 14, y: cy, 'text-anchor': 'middle', class: 'res-m neg', transform: `rotate(-90 ${x0 + hw / 2 + 14} ${cy})` }, `base ${fmt(B.compV)} · cantos ${fmt(B.compH)}`));
    }
    f.push(txt(cx, cy - fy / 2 - hw - 8, `PAREDES A · ${fmt(Lx)} × ${fmt(Hw)} m`, 'res-rot'),
      s('text', { x: cx - fx / 2 - hw - 10, y: cy, 'text-anchor': 'middle', class: 'res-rot', transform: `rotate(-90 ${cx - fx / 2 - hw - 10} ${cy})` }, `PAREDES B · ${fmt(Ly)} × ${fmt(Hw)} m`),
      s('text', { x: 10, y: 16, class: 'dg-titulo' }, `MOMENTOS · ${cheio.nome.toUpperCase()} (kN·m/m)`),
      s('text', { x: W - 10, y: 16, class: 'dg-texto', 'text-anchor': 'end' }, 'em terracota: negativos compatibilizados'));
    return s('svg', { class: 'desenho res-planificacao', viewBox: `0 0 ${W} ${H}`, width: W, height: H }, ...f);
  }

  /** Corte: paredes, fundo, tampa, lâmina d'água e as pressões. */
  function corte(r) {
    const W = 440, H = 300, m = 50;
    const { Lx } = r.geometria;
    const larg = r.a + (2 * r.e) / 100, alt = r.geometria.Htot;
    const esc = Math.min((W - 2 * m - 40) / larg, (H - 2 * m) / alt);
    const x0 = m + 20, yb = H - m;
    const e = (r.e / 100) * esc, hf = (r.hf / 100) * esc, ht = (r.ht / 100) * esc;
    const wi = r.a * esc, hi = r.H * esc;
    const f = [
      s('rect', { x: x0, y: yb - hf, width: wi + 2 * e, height: hf, class: 'sap-concreto' }),
      s('rect', { x: x0, y: yb - hf - hi, width: e, height: hi, class: 'sap-concreto' }),
      s('rect', { x: x0 + e + wi, y: yb - hf - hi, width: e, height: hi, class: 'sap-concreto' }),
    ];
    if (r.tampa) f.push(s('rect', { x: x0, y: yb - hf - hi - ht, width: wi + 2 * e, height: ht, class: 'sap-concreto' }));
    const ha = r.hAgua * esc;
    f.push(s('rect', { x: x0 + e, y: yb - hf - ha, width: wi, height: ha, class: 'res-agua' }),
      s('line', { x1: x0 + e, y1: yb - hf - ha, x2: x0 + e + wi, y2: yb - hf - ha, class: 'res-na' }),
      s('text', { x: x0 + e + wi / 2, y: yb - hf - ha - 6, 'text-anchor': 'middle', class: 'dg-texto' }, `NA máx. · ${fmt(r.hAgua)} m`));
    // diagrama de pressão hidrostática (à direita)
    const pMax = r.pressoes.agua, escP = 30 / Math.max(pMax, 1);
    const xp = x0 + 2 * e + wi + 8;
    f.push(s('polygon', { points: `${xp},${yb - hf - ha} ${xp},${yb - hf} ${xp + pMax * escP},${yb - hf}`, class: 'res-pressao' }),
      s('text', { x: xp + pMax * escP + 4, y: yb - hf + 4, class: 'dg-texto' }, `${fmt(pMax, 1)} kN/m²`));
    if (r.tipo === 'enterrado') {
      f.push(s('line', { x1: x0 - 22, y1: yb - hf - hi - (r.tampa ? ht : 0), x2: x0, y2: yb - hf - hi - (r.tampa ? ht : 0), class: 'sap-terreno' }),
        s('text', { x: x0 - 4, y: yb - hf - hi - (r.tampa ? ht : 0) - 6, class: 'dg-texto', 'text-anchor': 'end' }, 'terreno'));
    }
    f.push(s('text', { x: x0 + e + wi / 2, y: yb + 18, 'text-anchor': 'middle', class: 'dg-texto' }, `a = ${fmt(r.a)} m (interno) · eixos ${fmt(Lx)} m`),
      s('text', { x: 10, y: 16, class: 'dg-titulo' }, `CORTE · ${fmt(r.litros / 1000, 1)} m³ (${num(r.litros, 0)} L)`));
    return s('svg', { class: 'desenho res-corte', viewBox: `0 0 ${W} ${H}`, width: W, height: H }, ...f);
  }

  return {
    id: 'concreto.reservatorio',
    nome: 'Reservatório',
    nomeCurto: 'Reservatório',
    categoria: 'reservatorios',
    novaCategoria: { id: 'reservatorios', nome: 'Reservatórios', ordem: 3.7 },
    prefixo: 'RS',
    sigla: 'CR1',
    icone: 'reservatorio',
    forma: 'reservatorio',
    material: 'Concreto armado',
    norma: 'NBR 6118:2023',
    versao: '0.1.0',
    descricao: 'Caixa d’água retangular elevada ou enterrada: paredes e fundo como placas, empuxo hidrostático e de terra, fissuração para estanqueidade e reações nos apoios.',
    montagem: false,

    criar: criarReservatorio,
    calcular: (el, ctx) => calcularReservatorio(el, ctx),
    ligacoes,
    cargasTransmitidas,
    resumo: (el) => (el.resultado && !el.resultado.erro ? `${num(el.resultado.litros / 1000, 1)} m³ · ${el.resultado.tipo} · ${APOIOS_RESERVATORIO[el.resultado.apoio].toLowerCase()}` : TIPOS_RESERVATORIO[el.tipo] ?? 'Reservatório'),

    renderEntrada(raiz, ctx) {
      const el = ctx.elemento;
      const mudar = (fn) => ctx.alterar(fn, { estrutural: true });
      const enterrado = el.tipo === 'enterrado';
      raiz.append(ui.secao({
        numero: '01', titulo: 'Tipo e apoio', descricao: enterrado ? 'Enterrado: casos cheio (antes do reaterro) e vazio com empuxo de terra' : 'Elevado: caso cheio; as paredes descarregam nas vigas ou nos pilares',
        filhos: [ui.linhaCampos(
          ui.segmentado({ rotulo: 'Tipo', valor: el.tipo ?? 'elevado', opcoes: Object.entries(TIPOS_RESERVATORIO).map(([k, v]) => ({ valor: k, texto: v })), aoMudar: (v) => mudar((e) => { e.tipo = v; }) }),
          enterrado ? null : ui.segmentado({ rotulo: 'Apoio', valor: el.apoio ?? 'vigas', opcoes: [{ valor: 'vigas', texto: 'Paredes sobre vigas' }, { valor: 'pilares', texto: 'Pilares nos cantos' }], aoMudar: (v) => mudar((e) => { e.apoio = v; }) }),
          ui.alternar({ rotulo: 'Com tampa de concreto', valor: el.tampa !== false, aoMudar: (v) => mudar((e) => { e.tampa = v; }) }),
        )],
      }));
      raiz.append(ui.secao({
        numero: '02', titulo: 'Dimensões', descricao: 'Medidas internas; a direção a corre em x na planta',
        filhos: [
          ui.linhaCampos(
            ui.campo({ rotulo: 'a (interno)', valor: el.a, unidade: 'm', casas: 2, min: 0.5, max: 20, largura: '130px', aoMudar: (v) => mudar((e) => { e.a = v; }) }),
            ui.campo({ rotulo: 'b (interno)', valor: el.b, unidade: 'm', casas: 2, min: 0.5, max: 20, largura: '130px', aoMudar: (v) => mudar((e) => { e.b = v; }) }),
            ui.campo({ rotulo: 'Altura interna', valor: el.H, unidade: 'm', casas: 2, min: 0.5, max: 10, largura: '140px', aoMudar: (v) => mudar((e) => { e.H = v; }) }),
            ui.campo({ rotulo: 'Lâmina d’água', valor: el.hAgua, unidade: 'm', casas: 2, min: 0.1, max: 10, largura: '140px', dica: 'Nível máximo (extravasor)', aoMudar: (v) => mudar((e) => { e.hAgua = v; }) }),
          ),
          ui.linhaCampos(
            ui.campo({ rotulo: 'Paredes', valor: el.e, unidade: 'cm', casas: 0, min: 8, max: 60, largura: '120px', aoMudar: (v) => mudar((e) => { e.e = v; }) }),
            ui.campo({ rotulo: 'Fundo', valor: el.hf, unidade: 'cm', casas: 0, min: 8, max: 60, largura: '120px', aoMudar: (v) => mudar((e) => { e.hf = v; }) }),
            el.tampa !== false ? ui.campo({ rotulo: 'Tampa', valor: el.ht, unidade: 'cm', casas: 0, min: 7, max: 40, largura: '120px', aoMudar: (v) => mudar((e) => { e.ht = v; }) }) : null,
            ui.campo({ rotulo: 'Cobrimento', valor: el.cobrimento, unidade: 'cm', casas: 1, min: 2, max: 8, largura: '130px', dica: 'Faces em contato com a água', aoMudar: (v) => mudar((e) => { e.cobrimento = v; }) }),
            ui.campo({ rotulo: 'wk limite', valor: el.wkLim, unidade: 'mm', casas: 2, min: 0.05, max: 0.4, largura: '130px', dica: 'Estanqueidade: usual 0,1 mm (a Tabela 13.4 é para durabilidade)', aoMudar: (v) => mudar((e) => { e.wkLim = v; }) }),
          ),
        ],
      }));
      raiz.append(ui.secao({
        numero: '03', titulo: 'Cargas', descricao: 'Água com γw = 10 kN/m³; revestimentos e sobrecarga de manutenção',
        filhos: [ui.linhaCampos(
          ui.campo({ rotulo: 'Revestimento do fundo', valor: el.revestimento?.fundo ?? 0, unidade: 'kN/m²', casas: 2, min: 0, max: 5, largura: '170px', aoMudar: (v) => mudar((e) => { e.revestimento = { ...(e.revestimento ?? {}), fundo: v }; }) }),
          el.tampa !== false ? ui.campo({ rotulo: 'Revestimento da tampa', valor: el.revestimento?.tampa ?? 0, unidade: 'kN/m²', casas: 2, min: 0, max: 5, largura: '170px', aoMudar: (v) => mudar((e) => { e.revestimento = { ...(e.revestimento ?? {}), tampa: v }; }) }) : null,
          el.tampa !== false ? ui.campo({ rotulo: 'Sobrecarga na tampa', valor: el.qTampa, unidade: 'kN/m²', casas: 2, min: 0, max: 10, largura: '160px', aoMudar: (v) => mudar((e) => { e.qTampa = v; }) }) : null,
        )],
      }));
      if (enterrado) raiz.append(ui.secao({
        numero: '04', titulo: 'Solo', descricao: 'Empuxo em repouso K0 = 1 − sen φ, com sobrecarga no terreno',
        filhos: [ui.linhaCampos(
          ui.campo({ rotulo: 'γ do solo', valor: el.solo?.gama ?? 18, unidade: 'kN/m³', casas: 1, min: 12, max: 24, largura: '130px', aoMudar: (v) => mudar((e) => { e.solo = { ...(e.solo ?? {}), gama: v }; }) }),
          ui.campo({ rotulo: 'Ângulo de atrito φ', valor: el.solo?.phi ?? 30, unidade: '°', casas: 0, min: 10, max: 45, largura: '150px', aoMudar: (v) => mudar((e) => { e.solo = { ...(e.solo ?? {}), phi: v }; }) }),
          ui.campo({ rotulo: 'Sobrecarga no terreno', valor: el.solo?.sobrecarga ?? 10, unidade: 'kN/m²', casas: 1, min: 0, max: 50, largura: '170px', aoMudar: (v) => mudar((e) => { e.solo = { ...(e.solo ?? {}), sobrecarga: v }; }) }),
          ui.campo({ rotulo: 'σadm do solo', valor: el.solo?.sigmaAdm ?? 150, unidade: 'kPa', casas: 0, min: 20, max: 1000, largura: '140px', aoMudar: (v) => mudar((e) => { e.solo = { ...(e.solo ?? {}), sigmaAdm: v }; }) }),
        )],
      }));
      const pavs = pavimentosOrdenados(ctx.projeto);
      const pos = el.posicao;
      raiz.append(ui.secao({
        numero: enterrado ? '05' : '04', titulo: 'Posição na montagem', descricao: 'Canto dos eixos das paredes (x = 0, y = 0); o fundo fica na cota do pavimento. Use Conectar automaticamente na montagem para ligar as vigas ou os pilares.',
        filhos: [ui.linhaCampos(
          ui.selecao({ rotulo: 'Pavimento', valor: pos?.pavimento ?? '', largura: '220px', opcoes: [{ valor: '', texto: 'Sem posição na montagem' }, ...pavs.map((p) => ({ valor: p.id, texto: `${p.nome} · ${num(p.cota)} m` }))],
            aoMudar: (v) => mudar((e) => { e.posicao = v ? { x: 0, y: 0, angulo: 0, ...(e.posicao ?? {}), pavimento: v } : null; }) }),
          pos ? ui.campo({ rotulo: 'x', valor: pos.x, unidade: 'm', casas: 2, largura: '110px', aoMudar: (v) => mudar((e) => { e.posicao.x = v; }) }) : null,
          pos ? ui.campo({ rotulo: 'y', valor: pos.y, unidade: 'm', casas: 2, largura: '110px', aoMudar: (v) => mudar((e) => { e.posicao.y = v; }) }) : null,
        )],
      }));
      raiz.append(secaoArmadura(api, ctx, [{ chave: 'phi', rotulo: 'Bitola das barras', uso: 'laje' }]));
    },

    renderResultado(raiz, r) {
      const wkMax = Math.max(...r.armaduras.map((a) => a.wk));
      const lim = r.armaduras.length ? r.verificacoes?.find?.((v) => /fissuras/.test(v.nome))?.limite : '';
      raiz.append(h('div', { class: 'instrumentos' },
        ui.numeroGrande({ rotulo: 'Volume útil', valor: num(r.volume, 2), unidade: 'm³', linhas: [`${num(r.litros, 0)} litros`, `${num(r.a)} × ${num(r.b)} × ${num(r.hAgua)} m de água`] }),
        ui.numeroGrande({ rotulo: 'Peso total', valor: num(r.pesos.G + r.pesos.Q, 0), unidade: 'kN', linhas: [`água ${num(r.pesos.agua, 0)} kN`, `concreto ${num(r.pesos.paredes + r.pesos.fundo + r.pesos.tampa, 0)} kN`] }),
        ui.numeroGrande({ rotulo: 'Pressão no fundo', valor: num(r.pressoes.agua, 1), unidade: 'kN/m²', linhas: [r.pressoes.terra != null ? `empuxo ${num(r.pressoes.terra, 1)} kN/m² (K0 = ${num(r.pressoes.K0, 3)})` : 'pressão hidrostática', `fundo ${num(r.pressoes.fundo, 1)} kN/m²`] }),
        ui.numeroGrande({ rotulo: 'Maior fissura', valor: num(wkMax, 3), unidade: 'mm', linhas: [lim ? `limite ${lim.replace('≤ ', '')}` : '', 'combinação com o reservatório cheio'] }),
      ));
      raiz.append(ui.secao({
        numero: '06', titulo: 'Momentos das paredes e do fundo', descricao: 'Placas por elementos finitos; negativos compatibilizados nas arestas (14.7.6.2)',
        filhos: [h('div', { class: 'sapata-desenhos' }, h('div', { class: 'desenho-caixa centro' }, planificacao(r)), h('div', { class: 'desenho-caixa centro' }, corte(r)))],
      }));
      if (r.casos.length > 1) raiz.append(ui.secao({
        numero: '', titulo: 'Caso vazio com empuxo de terra', descricao: `Pressão no pé das paredes ${num(r.casos[1].p, 1)} kN/m²`,
        filhos: [ui.tabela({ classe: 'els-tabela', colunas: [{ titulo: 'Parede' }, { titulo: 'Mh vão', alinhar: 'dir' }, { titulo: 'Mv vão', alinhar: 'dir' }, { titulo: 'Cantos', alinhar: 'dir' }, { titulo: 'Base', alinhar: 'dir' }],
          linhas: r.casos[1].paredes.map((p) => [`Paredes ${p.id}`, num(p.Mh), num(p.Mv), num(p.compH), num(p.compV)]) })],
      }));
      raiz.append(ui.secao({
        numero: '07', titulo: 'Armaduras', descricao: 'Por metro, em cada face; aumentadas quando a fissura passaria do limite',
        filhos: [ui.tabela({
          classe: 'els-tabela',
          colunas: [{ titulo: 'Placa' }, { titulo: 'Direção' }, { titulo: 'Região · face' }, { titulo: 'Md (kN·m/m)', alinhar: 'dir' }, { titulo: 'Nd (kN/m)', alinhar: 'dir' }, { titulo: 'As ELU', alinhar: 'dir' }, { titulo: 'Adotada' }, { titulo: 'wk (mm)', alinhar: 'dir' }],
          linhas: r.armaduras.map((a) => [a.nome, a.dir, `${a.pos} · ${a.face}`, num(a.Md), a.Nd ? num(a.Nd) : '—', num(a.AsELU), a.barras ? `${a.barras.rotulo}${a.porFissura ? ' ▲' : ''}` : '—', num(a.wk, 3)]),
        })],
      }));
      raiz.append(ui.secao({
        numero: '08', titulo: 'Reações nos apoios', descricao: r.apoio === 'vigas' ? 'Por metro de parede, sobre as vigas (características)' : r.apoio === 'pilares' ? 'Em cada canto, sobre os pilares (características)' : `Apoiado no solo: σ = ${num(r.sigmaSolo, 1)} kPa`,
        filhos: [
          r.apoios.length ? ui.tabela({ classe: 'els-tabela', colunas: [{ titulo: 'Apoio' }, { titulo: 'g', alinhar: 'dir' }, { titulo: 'q', alinhar: 'dir' }, { titulo: 'Recebe' }],
            linhas: r.apoios.map((a) => [a.nome, `${num(a.g)} ${a.unidade}`, `${num(a.q)} ${a.unidade}`, a.recebe.length ? a.recebe.map((x) => x.codigo).join(', ') : 'não ligado']) }) : null,
          r.tirantes.length ? ui.tabela({ classe: 'els-tabela', colunas: [{ titulo: 'Viga-parede' }, { titulo: 'l × h (m)', alinhar: 'dir' }, { titulo: 'Md (kN·m)', alinhar: 'dir' }, { titulo: 'z (m)', alinhar: 'dir' }, { titulo: 'As tirante (cm²)', alinhar: 'dir' }, { titulo: 'Suspensão do fundo' }],
            linhas: r.tirantes.map((t, i) => [t.nome, `${num(t.L)} × ${num(t.h)}`, num(t.Md), num(t.z, 3), num(t.As), `${num(r.suspensao[i]?.As)} cm²/m`]) }) : null,
        ].filter(Boolean),
      }));
    },
  };
}
