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
/** Módulo: Telhado de madeira (NBR 7190-1:2022 · NBR 6120:2019) — telhas, ripas, caibros, terças e tesouras. */
import { calcularTelhado, criarTelhado, cargasTransmitidas, ligacoes, TELHAS, telhaDe, tesouraDoTelhado } from './calculo.js';
import { criarTesoura } from '../madeira-tesoura/calculo.js';
import { TIPOS_TESOURA } from '../../engine/tesoura.js';
import { secaoMaterial } from '../madeira-comum/material.js';
import { criarDesenhosTelhado } from '../madeira-comum/desenho-telhado.js';
import { novoId, proximoCodigo } from '../../renderer/core/projeto.js';

export default function moduloTelhado(api) {
  const { h } = api.dom;
  const ui = api.ui;
  const { num } = api.formatar;
  const d = criarDesenhosTelhado(api.dom);

  const secaoPeca = (ctx, chave, rotulo, dica) => ui.linhaCampos(
    h('span', { class: 'tl-rotulo-peca' }, rotulo),
    ui.campo({ rotulo: 'b', valor: ctx.elemento[chave].b, unidade: 'cm', casas: 1, min: 1, max: 40, largura: '110px', dica, aoMudar: (v) => ctx.alterar((e) => { e[chave] = { ...e[chave], b: v }; }, { estrutural: true }) }),
    ui.campo({ rotulo: 'h', valor: ctx.elemento[chave].h, unidade: 'cm', casas: 1, min: 1, max: 60, largura: '110px', aoMudar: (v) => ctx.alterar((e) => { e[chave] = { ...e[chave], h: v }; }, { estrutural: true }) }),
  );

  return {
    id: 'madeira.telhado',
    nome: 'Telhado de madeira',
    nomeCurto: 'Telhado',
    categoria: 'telhados',
    novaCategoria: { id: 'telhados', nome: 'Telhados', ordem: 3.6 },
    prefixo: 'TH',
    sigla: 'MTH',
    icone: 'casa',
    forma: 'telhado',
    material: 'Madeira',
    norma: 'NBR 7190-1:2022 · NBR 6120:2019',
    versao: '0.1.0',
    descricao: 'Telhado em duas águas: ripas, caibros, terças e tesouras, com as cargas nas tesouras e nas vigas de apoio.',
    montagem: false,

    criar: criarTelhado,
    calcular: calcularTelhado,
    cargasTransmitidas,
    ligacoes,
    resumo: (el) => `${num(el.vao, 2)} × ${num(el.comprimento, 2)} m · ${num(el.inclinacao, 0)}% · ${telhaDe(el).texto}`,

    renderEntrada(raiz, ctx) {
      const el = ctx.elemento;
      const telha = telhaDe(el);
      raiz.append(secaoMaterial(api, ctx, { numero: '01' }));
      raiz.append(ui.secao({
        numero: '02', titulo: 'Geometria', descricao: 'Duas águas simétricas; o vão é medido entre os apoios das tesouras (eixos das paredes ou vigas)',
        filhos: [
          ui.linhaCampos(
            ui.campo({ rotulo: 'Vão', valor: el.vao, unidade: 'm', casas: 2, min: 2, max: 30, largura: '120px', aoMudar: (v) => ctx.alterar((e) => { e.vao = v; }, { estrutural: true }) }),
            ui.campo({ rotulo: 'Comprimento', valor: el.comprimento, unidade: 'm', casas: 2, min: 1, max: 100, largura: '140px', dica: 'Ao longo da cumeeira', aoMudar: (v) => ctx.alterar((e) => { e.comprimento = v; }, { estrutural: true }) }),
            ui.campo({ rotulo: 'Inclinação', valor: el.inclinacao, unidade: '%', casas: 1, min: 5, max: 120, largura: '130px', dica: `Mínima usual da telha: ${num(telha.incMin, 0)}%`, aoMudar: (v) => ctx.alterar((e) => { e.inclinacao = v; }, { estrutural: true }) }),
            ui.campo({ rotulo: 'Beiral', valor: el.beiral, unidade: 'm', casas: 2, min: 0, max: 2, largura: '120px', aoMudar: (v) => ctx.alterar((e) => { e.beiral = v; }, { estrutural: true }) }),
            ui.campo({ rotulo: 'Beiral do oitão', valor: el.beiralOitao, unidade: 'm', casas: 2, min: 0, max: 2, largura: '150px', aoMudar: (v) => ctx.alterar((e) => { e.beiralOitao = v; }, { estrutural: true }) }),
          ),
          ui.segmentado({ rotulo: 'Pontas do telhado', valor: el.extremidades ?? 'tesouras', opcoes: [{ valor: 'tesouras', texto: 'Tesouras nas pontas' }, { valor: 'oitoes', texto: 'Oitões de alvenaria' }], aoMudar: (v) => ctx.alterar((e) => { e.extremidades = v; }, { estrutural: true }) }),
        ],
      }));
      const opTelha = TELHAS.map((t) => ({ valor: t.valor, texto: `${t.texto} — ${num(t.peso, 2)} kN/m²` }));
      raiz.append(ui.secao({
        numero: '03', titulo: 'Telha e estrutura', descricao: 'Pesos de catálogo (saturadas); as telhas onduladas e de aço apoiam direto nas terças',
        filhos: [
          ui.linhaCampos(
            ui.selecao({ rotulo: 'Telha', valor: el.telha, largura: '330px', opcoes: opTelha, aoMudar: (v) => ctx.alterar((e) => { e.telha = v; e.galga = null; }, { estrutural: true }) }),
            ui.campo({ rotulo: 'Peso da telha', valor: el.pesoTelha ?? telha.peso, unidade: 'kN/m²', casas: 2, min: 0.02, max: 2, largura: '150px', dica: 'Por m² de telhado, saturada', aoMudar: (v) => ctx.alterar((e) => { e.pesoTelha = v; }, { estrutural: true }) }),
            telha.ripas ? ui.campo({ rotulo: 'Galga (ripas)', valor: el.galga ?? telha.galga, unidade: 'm', casas: 3, min: 0.2, max: 0.6, largura: '140px', aoMudar: (v) => ctx.alterar((e) => { e.galga = v; }, { estrutural: true }) }) : null,
          ),
          ui.linhaCampos(
            ui.segmentado({ rotulo: 'Tesoura', valor: el.tipoTesoura ?? 'howe', compacto: true, opcoes: TIPOS_TESOURA.map((t) => ({ valor: t.valor, texto: t.texto })), aoMudar: (v) => ctx.alterar((e, p) => { e.tipoTesoura = v; const t = tesouraDoTelhado(p, e); if (t) t.geometria = { ...t.geometria, tipo: v }; }, { estrutural: true }) }),
            ui.campo({ rotulo: 'Painéis da tesoura', valor: el.paineis, casas: 0, min: 2, max: 16, largura: '150px', dica: 'Número par; uma terça em cada nó do banzo superior', aoMudar: (v) => ctx.alterar((e) => { e.paineis = Math.max(2, 2 * Math.round(v / 2)); }, { estrutural: true }) }),
            ui.campo({ rotulo: 'Tesouras a cada (máx.)', valor: el.espacTesouras, unidade: 'm', casas: 2, min: 0.8, max: 6, largura: '180px', aoMudar: (v) => ctx.alterar((e) => { e.espacTesouras = v; }, { estrutural: true }) }),
            telha.ripas ? ui.campo({ rotulo: 'Caibros a cada', valor: el.espacCaibros, unidade: 'm', casas: 2, min: 0.3, max: 1, largura: '150px', aoMudar: (v) => ctx.alterar((e) => { e.espacCaibros = v; }, { estrutural: true }) }) : null,
          ),
          telha.ripas ? secaoPeca(ctx, 'ripa', 'Ripas', 'b na água, h normal à água') : null,
          telha.ripas ? secaoPeca(ctx, 'caibro', 'Caibros', 'b horizontal, h normal à água') : null,
          secaoPeca(ctx, 'terca', 'Terças', 'Seção em pé: b horizontal, h vertical'),
        ].filter(Boolean),
      }));
      raiz.append(ui.secao({
        numero: '04', titulo: 'Cargas', descricao: 'NBR 6120:2019 — sobrecarga em projeção horizontal; vento como sucção normal às águas (NBR 6123)',
        filhos: [ui.linhaCampos(
          ui.campo({ rotulo: 'Sobrecarga', valor: el.cargas?.sobrecarga ?? 0.25, unidade: 'kN/m²', casas: 2, min: 0, max: 5, largura: '140px', aoMudar: (v) => ctx.alterar((e) => { e.cargas = { ...e.cargas, sobrecarga: v }; }, { estrutural: true }) }),
          ui.campo({ rotulo: 'Forro na tesoura', valor: el.cargas?.forro ?? 0, unidade: 'kN/m²', casas: 2, min: 0, max: 3, largura: '160px', dica: 'Forro pendurado no banzo inferior; 0 se houver laje de forro', aoMudar: (v) => ctx.alterar((e) => { e.cargas = { ...e.cargas, forro: v }; }, { estrutural: true }) }),
          ui.campo({ rotulo: 'Sucção do vento', valor: el.cargas?.vento ?? 0, unidade: 'kN/m²', casas: 2, min: 0, max: 5, largura: '160px', dica: 'Pressão de sucção característica (cpe·q) normal às águas; 0 para não verificar', aoMudar: (v) => ctx.alterar((e) => { e.cargas = { ...e.cargas, vento: v }; }, { estrutural: true }) }),
        )],
      }));
      const pavs = [...(ctx.projeto.pavimentos ?? [])].sort((a, b) => a.cota - b.cota);
      const pos = el.posicao;
      raiz.append(ui.secao({
        numero: '05', titulo: 'Posição na estrutura', descricao: 'Pavimento em que as tesouras apoiam e o canto do apoio A; o eixo x do telhado é o vão e o y é a cumeeira',
        filhos: [
          ui.linhaCampos(
            ui.selecao({ rotulo: 'Pavimento de apoio', valor: pos?.pavimento ?? '', largura: '240px', opcoes: [{ valor: '', texto: 'Sem posição (só o cálculo)' }, ...pavs.map((p) => ({ valor: p.id, texto: `${p.nome} — ${num(p.cota, 2)} m` }))],
              aoMudar: (v) => ctx.alterar((e) => { e.posicao = v ? { x: 0, y: 0, angulo: 0, ...(e.posicao ?? {}), pavimento: v } : null; }, { estrutural: true }) }),
            pos ? ui.campo({ rotulo: 'x', valor: pos.x ?? 0, unidade: 'm', casas: 2, largura: '110px', aoMudar: (v) => ctx.alterar((e) => { e.posicao.x = v; }, { estrutural: true }) }) : null,
            pos ? ui.campo({ rotulo: 'y', valor: pos.y ?? 0, unidade: 'm', casas: 2, largura: '110px', aoMudar: (v) => ctx.alterar((e) => { e.posicao.y = v; }, { estrutural: true }) }) : null,
            pos ? ui.campo({ rotulo: 'Ângulo', valor: pos.angulo ?? 0, unidade: '°', casas: 1, largura: '110px', aoMudar: (v) => ctx.alterar((e) => { e.posicao.angulo = v; }, { estrutural: true }) }) : null,
          ),
          h('p', { class: 'combinacoes-nota' }, 'Com o telhado posicionado, Estrutura › Conectar liga os beirais (e os oitões) às vigas que estão embaixo, no mesmo pavimento, e a visualização 3D mostra tesouras, terças, caibros, ripas e telhas.'),
        ],
      }));
      const tes = tesouraDoTelhado(ctx.projeto, el);
      raiz.append(ui.secao({
        numero: '06', titulo: 'Tesoura', descricao: 'Uma tesoura típica, com a geometria e as cargas deste telhado, vale para todas as posições',
        filhos: [ui.linhaCampos(
          tes ? ui.botao({ texto: `Abrir ${tes.codigo}`, icone: 'direita', aoClicar: () => ctx.abrirElemento(tes.id) })
            : ui.botao({ texto: 'Criar a tesoura do telhado', icone: 'mais', tipo: 'primario', aoClicar: () => {
              let id = null;
              ctx.alterar((e, p) => {
                id = novoId('ts');
                p.elementos.push({ id, modulo: 'madeira.tesoura', codigo: proximoCodigo(p, 'TS'), nome: `Tesoura de ${e.codigo}`, ...criarTesoura(p), classe: e.classe, carregamento: e.carregamento, tipo: e.tipo, telhadoId: e.id, geometria: { tipo: e.tipoTesoura ?? 'howe', vao: e.vao, inclinacao: e.inclinacao, paineis: e.paineis }, resultado: null });
              }, { estrutural: true, descricao: 'Criar a tesoura do telhado' });
              if (id) setTimeout(() => ctx.abrirElemento(id), 0);
            } }),
        )],
      }));
    },

    renderResultado(raiz, r, ctx) {
      const el = ctx.elemento;
      const g = r.geo;
      raiz.append(h('div', { class: 'instrumentos' },
        r.ripa ? ui.arco({ rotulo: 'Ripas', valor: `${num(r.ripa.uso * 100, 0)}%`, fracao: r.ripa.uso, legenda: `${num(el.ripa.b, 1)} × ${num(el.ripa.h, 1)} · flexão oblíqua` }) : null,
        r.caibro ? ui.arco({ rotulo: 'Caibros', valor: `${num(r.caibro.uso * 100, 0)}%`, fracao: r.caibro.uso, legenda: `${num(el.caibro.b, 1)} × ${num(el.caibro.h, 1)} c/ ${num(r.pesos.ec * 100, 0)} cm` }) : null,
        ui.arco({ rotulo: 'Terças', valor: `${num(r.terca.uso * 100, 0)}%`, fracao: r.terca.uso, legenda: `${num(el.terca.b, 1)} × ${num(el.terca.h, 1)} · vão ${num(g.et, 2)} m` }),
        ui.numeroGrande({ rotulo: 'Telhado', valor: num(r.quant.area, 1), unidade: 'm²', linhas: [`${g.tesouras.length} tesouras · ${g.n + 1} terças`, `${num(g.i, 0)}% (${num(g.alfaGraus, 1)}°) · ≈ ${r.quant.telhas} telhas`] }),
      ));
      raiz.append(ui.secao({ numero: '07', titulo: 'Desenhos', descricao: `${r.telha.texto} · ${num(r.telha.peso, 2)} kN/m²${r.telha.ripas ? ` · galga ${num(r.telha.galga, 3)} m` : ''}`,
        filhos: [h('div', { class: 'desenho-caixa' }, d.corteTelhado(el, r)), h('div', { class: 'desenho-caixa' }, d.plantaTelhado(el, r))] }));
      const linhas = [];
      if (r.ripa) linhas.push(['Ripas', `${num(el.ripa.b, 1)} × ${num(el.ripa.h, 1)}`, `${num(r.ripa.L, 2)} m (biapoiada)`, `${num(r.ripa.gL, 3)} / ${num(r.ripa.qL, 3)}`, `⊥ ${num(r.ripa.Mx, 4)} · ∥ ${num(r.ripa.My, 4)}`, `${num(r.ripa.uso * 100, 0)}%`, `${num(r.ripa.u, 1)} / ${num(r.ripa.ulim, 1)}`]);
      if (r.caibro) linhas.push(['Caibros', `${num(el.caibro.b, 1)} × ${num(el.caibro.h, 1)}`, `${num(g.lp, 2)} m (contínuo${g.beiralS > 0.05 ? ' + beiral' : ''})`, `${num(r.caibro.gL, 3)} / ${num(r.caibro.qL, 3)}`, `${num(r.caibro.Md, 3)} (1 kN: ${num(r.caibro.MdP, 3)})`, `${num(r.caibro.uso * 100, 0)}%`, `${num(r.caibro.u, 1)} / ${num(r.caibro.ulim, 1)}`]);
      linhas.push(['Terças', `${num(el.terca.b, 1)} × ${num(el.terca.h, 1)}`, `${num(r.terca.L, 2)} m (biapoiada)`, `${num(r.terca.gL, 3)} / ${num(r.terca.qL, 3)}`, `${num(r.terca.Md, 3)} (1 kN: ${num(r.terca.MdP, 3)})`, `${num(r.terca.uso * 100, 0)}%`, `${num(r.terca.u, 1)} / ${num(r.terca.ulim, 1)}`]);
      raiz.append(ui.secao({ numero: '08', titulo: 'Peças do telhado', descricao: 'Cargas características g / q por metro (normais à água nas ripas e nos caibros; verticais nas terças) e momentos de cálculo',
        filhos: [ui.tabela({ colunas: [{ titulo: 'Peça' }, { titulo: 'Seção (cm)' }, { titulo: 'Vão' }, { titulo: 'g / q (kN/m)', alinhar: 'dir' }, { titulo: 'Md (kN·m)', alinhar: 'dir' }, { titulo: 'Uso', alinhar: 'dir' }, { titulo: 'Flecha / limite (mm)', alinhar: 'dir' }], linhas })] }));
      raiz.append(ui.secao({ numero: '09', titulo: 'Cargas nos nós da tesoura', descricao: `Por tesoura (espaçamento ${num(g.et, 2)} m), valores característicos — a tesoura ligada usa estes valores`,
        filhos: [ui.tabela({ colunas: [{ titulo: 'Nó superior' }, { titulo: 'G (kN)', alinhar: 'dir' }, { titulo: 'Q (kN)', alinhar: 'dir' }, { titulo: 'Vento (kN)', alinhar: 'dir' }],
          linhas: r.nos.sup.map((c, k) => [k === 0 || k === g.n ? `${k} — apoio (frechal)` : k === g.np ? `${k} — cumeeira` : `${k}`, num(c.G, 2), num(c.Q, 2), `${num(c.W[0], 2)} ; ${num(c.W[1], 2)}`]) })] }));
      const re = r.reacoes;
      raiz.append(ui.secao({ numero: '10', titulo: 'Apoios e quantidades', descricao: 'Cargas por metro levadas às vigas ou paredes de apoio pela ligação do telhado',
        filhos: [ui.tabela({ colunas: [{ titulo: 'Item' }, { titulo: 'Valor', alinhar: 'dir' }], linhas: [
          ['Beirais A e B (g / q)', `${num(re.a.g, 2)} / ${num(re.a.q, 2)} kN/m`],
          ...(re.oitao ? [['Oitões (g / q)', `${num(re.oitao.g, 2)} / ${num(re.oitao.q, 2)} kN/m`]] : []),
          ['Peso total do telhado', `${num(re.Gtot, 1)} kN (${num(re.Gtot / r.quant.area, 2)} kN/m²)`],
          ['Tesouras', `${r.quant.tesouras} × ${num(re.pTes, 2)} kN`],
          ['Terças', `${r.quant.tercas.n} linhas · ${num(r.quant.tercas.comprimento, 1)} m · ${num(r.quant.tercas.volume, 3)} m³`],
          ...(r.quant.caibros ? [['Caibros', `${r.quant.caibros.n} · ${num(r.quant.caibros.comprimento, 0)} m · ${num(r.quant.caibros.volume, 3)} m³`]] : []),
          ...(r.quant.ripas ? [['Ripas', `${r.quant.ripas.n} linhas · ${num(r.quant.ripas.comprimento, 0)} m · ${num(r.quant.ripas.volume, 3)} m³`]] : []),
          ['Telhas (estimativa)', `${r.quant.telhas} un. (${num(r.telha.porM2, 1)}/m² de ${num(r.quant.area, 1)} m²)`],
        ] })] }));
    },
  };
}
