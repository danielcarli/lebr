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
 * Módulo: Sapata isolada de concreto armado (NBR 6122:2019 · NBR 6118:2023, 22.6).
 * Ligada a um pilar que chega à fundação, recebe a carga dele; a tensão admissível é informada ou estimada
 * pelo SPT do furo mais próximo.
 */
import { calcularSapata, criarSapata, pilaresDeFundacao, COBRIMENTO_SOLO } from './calculo.js';
import { criarDesenhoSapata } from './desenho.js';
import { secaoListaDeFerros } from '../comum/detalhamento-ui.js';
import { vista3dFundacao } from '../comum/vista3d-fundacao.js';
import { modeloSapata } from '../comum/armadura3d-fundacoes.js';

export default function moduloSapata(api) {
  const { h } = api.dom;
  const ui = api.ui;
  const { num } = api.formatar;
  const des = criarDesenhoSapata(api.dom);

  return {
    id: 'concreto.sapata',
    nome: 'Sapata isolada',
    nomeCurto: 'Sapata',
    categoria: 'fundacoes',
    novaCategoria: { id: 'fundacoes', nome: 'Fundações', ordem: 4 },
    prefixo: 'S',
    sigla: 'CS1',
    icone: 'sapata',
    forma: 'sapata',
    material: 'Concreto armado',
    norma: 'NBR 6122:2019 · NBR 6118:2023',
    versao: '0.1.0',
    descricao: 'Sapata isolada sob pilar: tensão admissível informada ou pelo SPT, dimensões, flexão, cisalhamento e punção.',
    montagem: false, // fica sob o pilar ligado, não é posicionada nos pavimentos

    criar: criarSapata,
    calcular: (el, ctx) => calcularSapata(el, ctx),
    resumo: (el) => (el.resultado && !el.resultado.erro ? `${num(el.resultado.A, 0)} × ${num(el.resultado.B, 0)} × ${num(el.resultado.h, 0)} cm` : el.pilarId ? 'ligada a pilar' : 'sem pilar'),

    renderEntrada(raiz, ctx) {
      const el = ctx.elemento;
      const fund = pilaresDeFundacao(ctx.projeto);
      const ligada = el.pilarId ? ctx.projeto.elementos.find((e) => e.id === el.pilarId) ?? null : null;
      const outrasLigacoes = (id) => ctx.projeto.elementos.filter((e) => e.modulo === 'concreto.sapata' && e.id !== el.id && e.pilarId === id).map((e) => e.codigo);
      const opcoes = [{ valor: '', texto: 'Nenhum — cargas informadas' }, ...fund.map(({ pilar: p }) => {
        const outras = outrasLigacoes(p.id);
        return { valor: p.id, texto: `${p.codigo} · ${num(p.bx, 0)} × ${num(p.by, 0)} cm${outras.length ? ` (já em ${outras.join(', ')})` : ''}` };
      })];
      if (ligada && !fund.some((x) => x.pilar.id === ligada.id)) opcoes.push({ valor: ligada.id, texto: `${ligada.codigo} (não chega à fundação)` });

      raiz.append(ui.secao({
        numero: '01', titulo: 'Pilar e cargas', descricao: 'A sapata recebe a carga característica do pilar ligado (ligação pilar → sapata)',
        filhos: [
          ui.linhaCampos(
            ui.selecao({ rotulo: 'Pilar apoiado', valor: el.pilarId ?? '', largura: '320px', opcoes, aoMudar: (v) => ctx.alterar((e) => { e.pilarId = v || null; }, { estrutural: true }) }),
            ligada ? ui.botao({ texto: `Abrir ${ligada.codigo}`, icone: 'direita', tipo: 'fantasma', aoClicar: () => ctx.abrirElemento(ligada.id) }) : null,
          ),
          ligada ? null : ui.linhaCampos(
            ui.campo({ rotulo: 'Pilar ap', valor: el.ap, unidade: 'cm', casas: 1, min: 10, max: 300, largura: '120px', dica: 'Dimensão do pilar na direção de A', aoMudar: (v) => ctx.alterar((e) => { e.ap = v; }) }),
            ui.campo({ rotulo: 'Pilar bp', valor: el.bp, unidade: 'cm', casas: 1, min: 10, max: 300, largura: '120px', dica: 'Dimensão do pilar na direção de B', aoMudar: (v) => ctx.alterar((e) => { e.bp = v; }) }),
            ui.campo({ rotulo: 'Nk permanente (g)', valor: el.cargas?.g ?? 0, unidade: 'kN', min: 0, largura: '160px', aoMudar: (v) => ctx.alterar((e) => { e.cargas = { ...(e.cargas ?? {}), g: v }; }) }),
            ui.campo({ rotulo: 'Nk variável (q)', valor: el.cargas?.q ?? 0, unidade: 'kN', min: 0, largura: '150px', aoMudar: (v) => ctx.alterar((e) => { e.cargas = { ...(e.cargas ?? {}), q: v }; }) }),
          ),
          ui.linhaCampos(
            ui.campo({ rotulo: 'Momento Mx adicional', valor: el.momentos?.x ?? 0, unidade: 'kN·m', largura: '180px', dica: 'Característico, na base do pilar; flete na direção de A', aoMudar: (v) => ctx.alterar((e) => { e.momentos = { ...(e.momentos ?? {}), x: v }; }) }),
            ui.campo({ rotulo: 'Momento My adicional', valor: el.momentos?.y ?? 0, unidade: 'kN·m', largura: '180px', dica: 'Característico, na base do pilar; flete na direção de B', aoMudar: (v) => ctx.alterar((e) => { e.momentos = { ...(e.momentos ?? {}), y: v }; }) }),
          ),
          h('p', { class: 'combinacoes-nota' }, 'Com os pilares em "Pórtico espacial" (Parâmetros › Análise global), a normal e os momentos característicos (G + Q) vêm das reações do pórtico na base do pilar; os momentos informados acima se somam a eles.'),
        ].filter(Boolean),
      }));

      const solo = el.solo ?? {};
      const furos = ctx.projeto.elementos.filter((e) => e.modulo === 'geotecnia.sondagem');
      raiz.append(ui.secao({
        numero: '02', titulo: 'Solo', descricao: 'NBR 6122:2019 — tensão admissível e profundidade de apoio',
        filhos: [
          ui.linhaCampos(
            ui.campo({ rotulo: 'Profundidade da base', valor: el.profundidade, unidade: 'm', casas: 2, min: 0.3, max: 10, largura: '170px', dica: 'Abaixo do terreno (cota 0 do projeto)', aoMudar: (v) => ctx.alterar((e) => { e.profundidade = v; }) }),
            ui.campo({ rotulo: 'Peso específico do solo', valor: solo.gama ?? 18, unidade: 'kN/m³', casas: 1, min: 10, max: 25, largura: '190px', dica: 'Reaterro sobre a sapata', aoMudar: (v) => ctx.alterar((e) => { e.solo = { ...(e.solo ?? {}), gama: v }; }) }),
          ),
          ui.segmentado({ rotulo: 'Tensão admissível', valor: solo.modo ?? 'informada', opcoes: [{ valor: 'informada', texto: 'Informada' }, { valor: 'spt', texto: 'Estimada pelo SPT' }], aoMudar: (v) => ctx.alterar((e) => { e.solo = { ...(e.solo ?? {}), modo: v }; }, { estrutural: true }) }),
          solo.modo === 'spt'
            ? ui.linhaCampos(ui.selecao({ rotulo: 'Furo de sondagem', valor: solo.sondagemId ?? '', largura: '320px',
              opcoes: [{ valor: '', texto: furos.length ? 'O mais próximo do pilar' : 'Nenhum furo no projeto' }, ...furos.map((x) => ({ valor: x.id, texto: `${x.codigo} · ${x.nome}` }))],
              aoMudar: (v) => ctx.alterar((e) => { e.solo = { ...(e.solo ?? {}), sondagemId: v || null }; }) }))
            : ui.linhaCampos(ui.campo({ rotulo: 'σadm', valor: solo.tensao ?? 200, unidade: 'kPa', casas: 0, min: 20, max: 2000, largura: '150px', dica: 'Tensão admissível do solo na cota de apoio (kN/m²)', aoMudar: (v) => ctx.alterar((e) => { e.solo = { ...(e.solo ?? {}), tensao: v }; }) })),
          solo.modo === 'spt' ? h('p', { class: 'combinacoes-nota' }, 'Estimativa semiempírica usual (Teixeira e Godoy, 1996): σadm = 20·N kPa (0,02·N MPa), com N médio do SPT da cota de apoio até 2·B abaixo dela, válida para 5 ≤ N ≤ 20. É uma estimativa: confirme com o projetista de fundações e com a NBR 6122.') : null,
        ].filter(Boolean),
      }));

      const g = el.geometria ?? {};
      const manual = g.modo === 'manual';
      raiz.append(ui.secao({
        numero: '03', titulo: 'Geometria', descricao: 'A na direção x do pilar (bx), B na direção y (by); faces inclinadas do topo (h) à borda (h0)',
        filhos: [
          ui.segmentado({ rotulo: 'Dimensões', valor: manual ? 'manual' : 'automatica', opcoes: [{ valor: 'automatica', texto: 'Automáticas (rígida)' }, { valor: 'manual', texto: 'Informadas' }],
            aoMudar: (v) => ctx.alterar((e) => {
              const r = e.resultado;
              e.geometria = { ...(e.geometria ?? {}), modo: v, ...(v === 'manual' && r && !r.erro ? { A: r.A, B: r.B, h: r.h, h0: r.h0 } : {}) };
            }, { estrutural: true }) }),
          manual ? ui.linhaCampos(
            ui.campo({ rotulo: 'A', valor: g.A, unidade: 'cm', casas: 0, min: 40, max: 1000, largura: '120px', aoMudar: (v) => ctx.alterar((e) => { e.geometria.A = v; }) }),
            ui.campo({ rotulo: 'B', valor: g.B, unidade: 'cm', casas: 0, min: 40, max: 1000, largura: '120px', aoMudar: (v) => ctx.alterar((e) => { e.geometria.B = v; }) }),
            ui.campo({ rotulo: 'Altura h', valor: g.h, unidade: 'cm', casas: 0, min: 15, max: 300, largura: '130px', aoMudar: (v) => ctx.alterar((e) => { e.geometria.h = v; }) }),
            ui.campo({ rotulo: 'Borda h0', valor: g.h0, unidade: 'cm', casas: 0, min: 10, max: 300, largura: '130px', aoMudar: (v) => ctx.alterar((e) => { e.geometria.h0 = v; }) }),
          ) : h('p', { class: 'combinacoes-nota' }, 'Área pela tensão admissível com balanços iguais (A − B = ap − bp), múltiplos de 5 cm e no mínimo 60 cm; aumenta até a tensão na borda e a excentricidade atenderem. Altura de sapata rígida, h ≥ (A − ap)/3, e suficiente para ancorar as barras do pilar; h0 ≥ h/3 e ≥ 20 cm.'),
          ui.linhaCampos(
            ui.campo({ rotulo: 'Cobrimento', valor: el.cobrimento, unidade: 'cm', casas: 1, min: 2, max: 10, largura: '140px', dica: `Elementos em contato com o solo — NBR 6118, Tabela 7.2 (CAA ${ctx.projeto.parametros.classeAgressividade}: ${num(COBRIMENTO_SOLO[ctx.projeto.parametros.classeAgressividade] ?? 3, 1)} cm)`, aoMudar: (v) => ctx.alterar((e) => { e.cobrimento = v; }) }),
            ui.selecao({ rotulo: 'Barras do pilar (ancoragem)', valor: el.armadura?.phiPilar ?? '', largura: '220px',
              opcoes: [{ valor: '', texto: 'As do pilar calculado' }, ...[10, 12.5, 16, 20, 25].map((p) => ({ valor: p, texto: `ø ${String(p).replace('.', ',')} mm` }))],
              aoMudar: (v) => ctx.alterar((e) => { e.armadura = { ...(e.armadura ?? {}), phiPilar: v || null }; }) }),
          ),
        ],
      }));
    },

    renderResultado(raiz, r, ctx) {
      const uso = r.tensoes.med / r.sigmaAdm;
      raiz.append(h('div', { class: 'instrumentos' },
        ui.numeroGrande({ rotulo: 'Sapata', valor: `${num(r.A, 0)} × ${num(r.B, 0)}`, unidade: 'cm', linhas: [`h = ${num(r.h, 0)} cm · h0 = ${num(r.h0, 0)} cm`, r.rigida ? 'sapata rígida' : 'sapata flexível'] }),
        ui.arco({ rotulo: 'Tensão no solo', valor: `${num(uso * 100, 0)}%`, fracao: uso, legenda: `σméd ${num(r.tensoes.med, 0)} de ${num(r.sigmaAdm, 0)} kPa` }),
        ui.numeroGrande({ rotulo: 'Carga do pilar', valor: num(r.Nk.g + r.Nk.q, 1), unidade: 'kN', linhas: [r.pilar ? `${r.pilar.codigo} · ${r.origem === 'portico' ? 'pórtico espacial' : 'cargas dos elementos'}` : 'carga informada', `Nd = ${num(r.Nd, 1)} kN`] }),
        ui.numeroGrande({ rotulo: 'σadm', valor: num(r.sigmaAdm, 0), unidade: 'kPa', linhas: [r.tensao.modo === 'spt' ? `SPT ${r.tensao.furo?.codigo ?? ''}: N = ${num(r.tensao.N, 1)}` : 'informada', `base a ${num(r.profundidade)} m`] }),
      ));
      raiz.append(ui.secao({
        numero: '04', titulo: 'Desenho', descricao: `Volume de concreto ${num(r.volume, 3)} m³ · cobrimento ${num(r.cobrimento, 1)} cm`,
        filhos: [h('div', { class: 'sapata-desenhos' }, h('div', { class: 'desenho-caixa centro' }, des.planta(r)), h('div', { class: 'desenho-caixa centro' }, des.corte(r))),
          vista3dFundacao(api, ctx, r, (posicoes) => modeloSapata(r, posicoes), { titulo: 'VISTA 3D · SAPATA E MALHAS' })],
      }));
      raiz.append(ui.secao({
        numero: '05', titulo: 'Solo e estrutura', descricao: 'Tensões características no solo; esforços de cálculo na sapata',
        filhos: [
          ui.tabela({
            classe: 'els-tabela',
            colunas: [{ titulo: 'Grandeza' }, { titulo: 'Valor', alinhar: 'dir' }],
            linhas: [
              ['N do pilar + peso próprio + reaterro', `${num(r.Nk.g + r.Nk.q, 1)} + ${num(r.PP, 1)} + ${num(r.terra, 1)} = ${num(r.Ntot, 1)} kN`],
              ['Momentos característicos Mx / My', `${num(r.Mk.x)} / ${num(r.Mk.y)} kN·m (ex = ${num(r.tensoes.ex, 1)} cm, ey = ${num(r.tensoes.ey, 1)} cm)`],
              ['Tensões no solo (méd. / máx. / mín.)', `${num(r.tensoes.med, 0)} / ${num(r.tensoes.max, 0)} / ${num(r.tensoes.min, 0)} kPa`],
              ['Altura útil d', `${num(r.d, 1)} cm`],
            ],
          }),
          ui.tabela({
            classe: 'els-tabela',
            colunas: [{ titulo: 'Armadura de flexão' }, { titulo: 'Md (kN·m)', alinhar: 'dir' }, { titulo: 'As calc. (cm²)', alinhar: 'dir' }, { titulo: 'As mín. (cm²)', alinhar: 'dir' }, { titulo: 'Adotada' }],
            linhas: [['Barras paralelas a A (na largura B)', r.flexao.x], ['Barras paralelas a B (na largura A)', r.flexao.y]].map(([t, x]) => [t, num(x.Md, 1), num(x.As), num(x.AsMin), x.malha?.rotulo ?? '—']),
          }),
        ],
      }));
      if (ctx && r.detalhamento?.posicoes?.length) raiz.append(secaoListaDeFerros(api, ctx, r.detalhamento, {
        modelo3d: (posicoes) => modeloSapata(r, posicoes),
        titulo: 'Ferragem da sapata', descricao: 'Malhas de flexão de face a face, com gancho nas duas pontas (NBR 6118, 22.6.4.1.1) · lista de ferros editável',
        volume: r.volume,
        nota: 'Ganchos a 90° (+10ø em cada ponta). Os arranques (esperas) do pilar estão no detalhamento do pilar; a ancoragem deles na sapata é verificada acima.',
      }));
    },
  };
}
