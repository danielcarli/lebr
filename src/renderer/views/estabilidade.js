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
 * Estabilidade global (NBR 6118, 11.3.3.4.1, 15.5 e 15.7): desaprumo comparado com o vento, parâmetro α,
 * coeficiente γz por direção com rigidez reduzida e a majoração dos esforços horizontais por 0,95·γz.
 */
import { h } from '../ui/dom.js';
import * as ui from '../ui/componentes.js';
import { icone } from '../ui/icones.js';
import { estado } from '../core/estado.js';
import { modulos } from '../core/modulos.js';
import { num } from '../core/formatar.js';
import { RIGIDEZ_REDUZIDA, CONTRAVENTAMENTOS, THETA1_MIN, THETA1_MAX } from '../../engine/estabilidade.js';
import { porticoDoEdificio, parametrosEstabilidade, ROTULO_ACAO } from '../../modules/comum/portico-edificio.js';

const CLASSE = {
  fixos: { texto: 'Nós fixos', ok: true },
  moveis: { texto: 'Nós móveis', ok: true },
  excede: { texto: 'Acima de 1,3', ok: false },
  instavel: { texto: 'Instável', ok: false },
};
const fracao = (t) => (t > 0 ? `1/${num(1 / t, 0)}` : '—');

export function abaEstabilidade(acoes = {}) {
  return {
    id: 'estabilidade',
    icone: 'estabilidade',
    titulo: () => 'Estabilidade global',
    render(container) {
      const p = estado.projeto;
      if (!p) return;
      const est = parametrosEstabilidade(p);
      const mudar = (fn) => estado.alterar((proj) => {
        proj.parametros.estabilidade = { ...parametrosEstabilidade(proj), ...(proj.parametros.estabilidade ?? {}) };
        fn(proj.parametros.estabilidade);
        if (proj.parametros.analiseGlobal?.pilares === 'portico') for (const e of proj.elementos) if (e.resultado && e.modulo === 'concreto.pilar') e.resultado.desatualizado = true;
      }, { descricao: 'Estabilidade global', tipo: 'parametros', estrutural: true });

      const g = porticoDoEdificio(p, modulos);
      const e = g.estabilidade;
      const hz = g.horizontais;
      const resumo = (d) => (d && !d.erro && Number.isFinite(d.alfa) ? d : null);
      const ex = resumo(e?.x), ey = resumo(e?.y);
      const usaPortico = p.parametros.analiseGlobal?.pilares === 'portico';

      const pagina = h('div', { class: 'pagina' },
        ui.cabecalhoObjeto({
          rotulo: 'Análise global', numero: 'γz', etiquetas: ['LEBR', 'NBR 6118', '15.5'], simbolo: 'estabilidade',
          linha1: 'Imperfeições e estabilidade global', linha2: ui.rotulo('Desaprumo, parâmetro α e coeficiente γz por direção'),
          titulo: 'Estabilidade global',
          subtitulo: ui.rotulo(ex && ey ? `γz = ${num(ex.gz, 3)} em X e ${num(ey.gz, 3)} em Y · α = ${num(ex.alfa, 3)} e ${num(ey.alfa, 3)} (α1 = ${num(ex.alfa1, 2)})` : 'Monte a estrutura na Montagem para avaliar a estabilidade'),
        }),
      );
      if (g.erro || !e || !ex || !ey) {
        const msg = g.erro ?? e?.erro ?? e?.x?.erro ?? 'Não há pavimentos com pilares acima da fundação.';
        pagina.append(ui.secao({ numero: '01', titulo: 'Estabilidade', filhos: [h('ul', { class: 'avisos' }, h('li', null, icone('alerta', { tamanho: 14, traco: 1.8 }), msg))] }));
        container.append(pagina);
        return { aoAlterar: () => false };
      }

      // ------------------------------------------------------------ resumo
      const cel = (d, eixo) => [
        { rotulo: `γz ${eixo}`, valor: Number.isFinite(d.gz) ? num(d.gz, 3) : '∞', sub: `${CLASSE[d.classe]?.texto ?? ''} · ${d.comb}`, destaque: true },
        { rotulo: `α ${eixo}`, valor: num(d.alfa, 3), sub: `α1 = ${num(d.alfa1, 2)} · ${d.nosFixos ? 'nós fixos' : 'nós móveis'}` },
      ];
      pagina.append(ui.ficha([...cel(ex, 'em X'), ...cel(ey, 'em Y')], { colunas: 4 }));
      const avisos = [...e.avisos, ...e.notas];
      if (avisos.length) pagina.append(h('ul', { class: 'avisos' }, avisos.map((a) => h('li', null, icone('alerta', { tamanho: 14, traco: 1.8 }), a))));

      // ------------------------------------------------------------ 01 parâmetros
      pagina.append(ui.secao({
        numero: '01', titulo: 'Parâmetros', descricao: 'Ficam no arquivo do projeto (parametros.estabilidade)',
        filhos: [
          ui.linhaCampos(
            ui.alternar({ rotulo: 'Considerar o desaprumo global (11.3.3.4.1)', valor: est.desaprumo, aoMudar: (x) => mudar((w) => { w.desaprumo = x; }) }),
            ui.alternar({ rotulo: 'Majorar os esforços horizontais por 0,95·γz (15.7.2)', valor: est.majorar, aoMudar: (x) => mudar((w) => { w.majorar = x; }) }),
          ),
          ui.linhaCampos(
            ui.selecao({ rotulo: 'Rigidez reduzida para o γz (15.7.3)', valor: est.rigidez, largura: '380px',
              opcoes: Object.entries(RIGIDEZ_REDUZIDA).map(([k, r]) => ({ valor: k, texto: r.desc })), aoMudar: (x) => mudar((w) => { w.rigidez = x; }) }),
            ui.selecao({ rotulo: 'Contraventamento (α1 com 4 níveis ou mais)', valor: est.contraventamento, largura: '400px',
              opcoes: Object.entries(CONTRAVENTAMENTOS).map(([k, c]) => ({ valor: k, texto: `${c.desc} — α1 = ${num(c.alfa1, 1)}` })), aoMudar: (x) => mudar((w) => { w.contraventamento = x; }) }),
          ),
          h('p', { class: 'combinacoes-nota' }, usaPortico
            ? 'Os pilares usam o pórtico espacial (Parâmetros › Análise global): as ações horizontais e a majoração por 0,95·γz entram no dimensionamento deles.'
            : 'Os pilares usam as cargas dos elementos: a estabilidade é só informativa. Para que as ações horizontais e a majoração entrem nos pilares, escolha "Pórtico espacial" em Parâmetros › Análise global.'),
        ],
      }));

      // ------------------------------------------------------------ 02 desaprumo
      const dp = hz.desaprumo;
      const dirs = hz.direcoes;
      const linhaAcao = (eixo, d) => [eixo, num(d.Mvento, 1), num(d.Mdesaprumo, 1), d.Mvento > 0 ? `${num(d.razao * 100, 0)} %` : '—', h('b', null, d.acao ? ROTULO_ACAO[d.acao] : 'Nenhuma'), d.theta ? fracao(d.theta) : '—'];
      pagina.append(ui.secao({
        numero: '02', titulo: 'Imperfeições globais — desaprumo', descricao: 'NBR 6118, 11.3.3.4.1 · θ1 = 1/(100·√H), θa = θ1·√((1 + 1/n)/2)',
        filhos: [
          ui.ficha([
            { rotulo: 'Altura H', valor: `${num(hz.H, 2)} m`, sub: `da fundação (cota ${num(hz.zBase, 2)}) ao último nível` },
            { rotulo: 'Pilares n', valor: String(dp.n), sub: 'que chegam à fundação' },
            { rotulo: 'θ1', valor: fracao(dp.theta1), sub: `1/(100√H) = ${fracao(dp.theta1Bruto)}; entre ${fracao(THETA1_MIN)} e ${fracao(THETA1_MAX)}` },
            { rotulo: 'θa', valor: fracao(dp.thetaA), sub: `sem θ1,mín: ${fracao(dp.thetaASemMin)}`, destaque: true },
          ], { colunas: 4 }),
          ui.tabela({
            classe: 'els-tabela',
            colunas: [{ titulo: 'Direção' }, { titulo: 'M vento (kN·m)', alinhar: 'dir' }, { titulo: 'M desaprumo (kN·m)', alinhar: 'dir' }, { titulo: 'Vento / desaprumo', alinhar: 'dir' }, { titulo: 'Ação considerada' }, { titulo: 'θ do desaprumo', alinhar: 'dir' }],
            linhas: [linhaAcao('X (0° e 180°)', dirs.x), linhaAcao('Y (90° e 270°)', dirs.y)],
          }),
          h('p', { class: 'combinacoes-nota' }, 'Momentos na base, característicos. Se 30 % do vento passa do desaprumo, fica só o vento; se o vento é menor que 30 % do desaprumo, fica só o desaprumo (com θ1,mín = 1/300); nos demais casos os dois somam na mesma direção, sem θ1,mín, como uma ação de vento. Força do desaprumo em cada nível: θa × (G + Q) do nível. Sozinho, o desaprumo entra nas combinações como ação horizontal exclusiva por direção com γq e ψ = 1.'),
          ui.tabela({
            classe: 'els-tabela',
            colunas: [{ titulo: 'Nível' }, { titulo: 'h (m)', alinhar: 'dir' }, { titulo: 'G + Q (kN)', alinhar: 'dir' }, { titulo: 'F em X (kN)', alinhar: 'dir' }, { titulo: 'F em Y (kN)', alinhar: 'dir' }, { titulo: 'parcela do desaprumo X / Y (kN)', alinhar: 'dir' }],
            linhas: [...(hz.casos ? hz.forcas : hz.forcasEstabilidade)].reverse().map((f) => [f.nome, num(f.h, 2), num(f.P, 1), num(f.Fx, 2), num(f.Fy, 2), hz.casos ? `${num(f.FxDesaprumo, 2)} / ${num(f.FyDesaprumo, 2)}` : '—']),
          }),
          hz.casos ? null : h('p', { class: 'combinacoes-nota' }, 'Sem vento e com o desaprumo desligado, não há ação horizontal no pórtico; as forças acima (desaprumo) servem só para avaliar α e γz.'),
        ].filter(Boolean),
      }));

      // ------------------------------------------------------------ 03 α
      const linhaAlfa = (eixo, d) => [eixo, num(e.Nk, 1), num(d.deltaTopo * 1000, 3), num(d.EI / 1000, 0), h('b', null, num(d.alfa, 3)), num(d.alfa1, 2), ui.selo(d.nosFixos, d.nosFixos ? 'nós fixos' : 'nós móveis')];
      pagina.append(ui.secao({
        numero: '03', titulo: ui.rotulo('Parâmetro de instabilidade α'), descricao: `NBR 6118, 15.5.2 · α = H·√(Nk/(Ecs·Ic)) · ${e.nNiveis} nível(is): α1 = ${e.nNiveis <= 3 ? `0,2 + 0,1·${e.nNiveis}` : `${num(ex.alfa1, 1)} (${CONTRAVENTAMENTOS[est.contraventamento].desc.toLowerCase()})`}`,
        filhos: [
          ui.tabela({
            classe: 'els-tabela',
            colunas: [{ titulo: 'Direção' }, { titulo: 'Nk (kN)', alinhar: 'dir' }, { titulo: 'δ topo (mm)', alinhar: 'dir' }, { titulo: 'Ecs·Ic equiv. (MN·m²)', alinhar: 'dir' }, { titulo: 'α', alinhar: 'dir' }, { titulo: 'α1', alinhar: 'dir' }, { titulo: '' }],
            linhas: [linhaAlfa('X', ex), linhaAlfa('Y', ey)],
          }),
          h('p', { class: 'combinacoes-nota' }, 'Ecs·Ic é a rigidez do pilar equivalente engastado na base e livre no topo que, sob as mesmas forças horizontais, tem o mesmo deslocamento do topo do pórtico (seções brutas, Ecs): Ecs·Ic = Σ F·h²·(3H − h) / (6·δtopo). Nk é a soma das cargas verticais características (G + Q) acima da fundação.'),
        ],
      }));

      // ------------------------------------------------------------ 04 γz
      const rz = e.rigidez;
      const linhaGz = (eixo, d) => [eixo, h('span', null, h('b', null, d.comb), ' ', h('span', { class: 'mono' }, d.expressao)), num(d.M1d, 1), num(d.dMd, 2), h('b', null, Number.isFinite(d.gz) ? num(d.gz, 3) : '∞'),
        ui.selo(CLASSE[d.classe]?.ok ?? false, CLASSE[d.classe]?.texto ?? d.classe), d.fator > 1 ? h('b', null, `× ${num(d.fator, 3)}`) : '—'];
      const niveisGz = ex.niveis.map((n, k) => [n.nome, num(n.h, 2), num(n.delta * 1000, 3), num(n.Pd, 1), num(ey.niveis[k]?.delta * 1000, 3), num(ey.niveis[k]?.Pd, 1)]).reverse();
      pagina.append(ui.secao({
        numero: '04', titulo: ui.rotulo('Coeficiente γz'), descricao: `NBR 6118, 15.5.3 · γz = 1/(1 − ΔMtot,d/M1,tot,d) · rigidez: vigas ${num(rz.viga, 1)}·Eci·Ic, pilares ${num(rz.pilar, 1)}·Eci·Ic (Eci = ${num(rz.Eci / 1000, 1)} GPa)`,
        filhos: [
          ui.tabela({
            classe: 'els-tabela',
            colunas: [{ titulo: 'Direção' }, { titulo: 'Combinação que governa' }, { titulo: 'M1,tot,d (kN·m)', alinhar: 'dir' }, { titulo: 'ΔMtot,d (kN·m)', alinhar: 'dir' }, { titulo: 'γz', alinhar: 'dir' }, { titulo: 'Classificação' }, { titulo: 'Esforços horizontais', alinhar: 'dir' }],
            linhas: [linhaGz('X', ex), linhaGz('Y', ey)],
          }),
          ui.tabela({
            classe: 'els-tabela',
            colunas: [{ titulo: 'Nível' }, { titulo: 'h (m)', alinhar: 'dir' }, { titulo: 'δ em X (mm)', alinhar: 'dir' }, { titulo: 'Pd X (kN)', alinhar: 'dir' }, { titulo: 'δ em Y (mm)', alinhar: 'dir' }, { titulo: 'Pd Y (kN)', alinhar: 'dir' }],
            linhas: niveisGz,
          }),
          h('p', { class: 'combinacoes-nota' }, `Deslocamentos horizontais de 1ª ordem de cada nível (média dos nós do diafragma) com as forças horizontais características e a rigidez reduzida; Pd é a carga vertical de cálculo do nível na combinação. O γz é o maior entre as combinações últimas com a ação horizontal da direção. γz ≤ 1,1: nós fixos, sem efeitos globais de 2ª ordem. 1,1 < γz ≤ 1,3: esforços horizontais da combinação × 0,95·γz (15.7.2). γz > 1,3: análise de 2ª ordem (P-Δ) — fica para a Fase 2.${e.nNiveis < 4 ? ' Com menos de 4 andares a classificação segue o α, e a majoração só se aplica quando α > α1.' : ''}`),
        ],
      }));

      // ------------------------------------------------------------ 05 efeito nas combinações
      const maj = e.combinacoes.filter((c) => c.majorada);
      pagina.append(ui.secao({
        numero: '05', titulo: 'Combinações do edifício', descricao: `${e.combinacoes.length} combinações (${e.combinacoes.filter((c) => c.tipo === 'ELU').length} últimas) · ${maj.length ? `${maj.length} com os esforços horizontais majorados` : 'sem majoração'}`,
        filhos: [
          ui.tabela({
            classe: 'combinacoes-tabela',
            colunas: [{ titulo: 'Combinação' }, { titulo: 'Expressão' }, { titulo: 'Descrição' }],
            linhas: e.combinacoes.filter((c) => c.tipo === 'ELU').map((c) => [h('b', null, c.id), h('span', { class: 'mono' }, c.expressao), `${c.nome}${c.majorada ? ' · majorada por 0,95·γz' : ''}`]),
          }),
          h('div', { class: 'vento-acoes' },
            ui.botao({ texto: 'Vento (NBR 6123)', icone: 'vento', tipo: 'secundario', aoClicar: () => acoes.abrirVento?.() }),
            ui.botao({ texto: 'Ver no 3D', icone: 'cubo', tipo: 'fantasma', aoClicar: () => acoes.abrir3D?.() }),
            ui.botao({ texto: 'Parâmetros do projeto', icone: 'parametros', tipo: 'fantasma', aoClicar: () => acoes.abrirParametros?.() })),
        ],
      }));

      container.append(pagina);
      return { aoAlterar: () => false };
    },
  };
}
