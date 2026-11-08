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
 * Relatórios do projeto (0.32), em abas que saem em PDF:
 *  - Memorial do edifício: dados do projeto, situação, cargas na fundação, quantitativos e, por pavimento, cada
 *    elemento com as verificações e o memorial de cálculo;
 *  - Cargas na fundação: os pilares que chegam à fundação, com as normais características e de cálculo, a fundação
 *    ligada e a planta de locação.
 */
import { h, s } from '../ui/dom.js';
import * as ui from '../ui/componentes.js';
import { icone } from '../ui/icones.js';
import { estado } from '../core/estado.js';
import { modulos } from '../core/modulos.js';
import { num, dataHora } from '../core/formatar.js';
import { estadoDoResultado } from './elemento.js';
import { pilaresNaFundacao } from '../../modules/comum/pranchas.js';
import { cargasNaFundacao } from '../../modules/comum/relatorios.js';
import { quantitativosDoProjeto, acoTotal, pecasTotal } from '../../modules/comum/quantitativos.js';
import { cantosPilar, pavimentosOrdenados } from '../core/montagem.js';

const compararCodigos = (a, b) => String(a.codigo).localeCompare(String(b.codigo), 'pt-BR', { numeric: true });

/* ------------------------------------------------------------------ peças de interface */

function tabelaCargas(c, { abrirElemento } = {}) {
  return ui.tabela({
    classe: 'rel-cargas',
    colunas: [{ titulo: 'Pilar' }, { titulo: 'Seção (cm)' }, { titulo: 'x (m)', alinhar: 'dir' }, { titulo: 'y (m)', alinhar: 'dir' },
      { titulo: 'Ng (kN)', alinhar: 'dir' }, { titulo: 'Nq (kN)', alinhar: 'dir' }, { titulo: 'Nk (kN)', alinhar: 'dir' }, { titulo: 'Nd (kN)', alinhar: 'dir' }, { titulo: 'Fundação' }],
    linhas: [
      ...c.linhas.map((l) => ({
        classe: l.calculado ? '' : 'rel-pendente',
        celulas: [
          abrirElemento ? h('button', { class: 'link', onClick: () => abrirElemento(l.id) }, l.codigo) : h('b', null, l.codigo),
          `${num(l.bx, 0)} × ${num(l.by, 0)}`, num(l.x, 2), num(l.y, 2),
          l.Ng == null ? '—' : num(l.Ng, 1), l.Nq == null ? '—' : num(l.Nq, 1), l.Nk == null ? '—' : h('b', null, num(l.Nk, 1)), l.Nd == null ? '—' : num(l.Nd, 1),
          l.fundacao ? `${l.fundacao.codigo}${l.fundacao.ok === false ? ' (não atende)' : ''}` : '—',
        ],
      })),
      { classe: 'total', celulas: [h('b', null, 'Total'), '', '', '', h('b', null, num(c.total.Ng, 1)), h('b', null, num(c.total.Nq, 1)), h('b', null, num(c.total.Nk, 1)), h('b', null, num(c.total.Nd, 1)), ''] },
    ],
  });
}

/** Planta de locação dos pilares com a normal característica de cada um. */
function plantaLocacao(projeto, c) {
  const pils = pilaresNaFundacao(projeto);
  if (!pils.length) return null;
  const cantos = pils.flatMap((p) => cantosPilar(p));
  const xs = cantos.map((q) => q[0]), ys = cantos.map((q) => q[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const W = 900, marg = 70;
  const esc = Math.min((W - 2 * marg) / Math.max(x1 - x0, 1), 520 / Math.max(y1 - y0, 1));
  const H = (y1 - y0) * esc + 2 * marg;
  const X = (x) => marg + (x - x0) * esc, Y = (y) => H - marg - (y - y0) * esc;
  const porId = new Map(c.linhas.map((l) => [l.id, l]));
  const filhos = [];
  for (const p of pils) {
    const q = cantosPilar(p).map(([x, y]) => `${X(x)},${Y(y)}`).join(' ');
    const l = porId.get(p.id);
    filhos.push(s('polygon', { points: q, class: 'rel-pilar' }),
      s('text', { x: X(p.posicao.x), y: Y(p.posicao.y) - (p.by / 200) * esc - 8, class: 'rel-rot', 'text-anchor': 'middle' }, p.codigo),
      s('text', { x: X(p.posicao.x), y: Y(p.posicao.y) + (p.by / 200) * esc + 15, class: 'rel-carga', 'text-anchor': 'middle' }, l?.Nk == null ? '—' : `${num(l.Nk, 0)} kN`));
  }
  return s('svg', { class: 'desenho rel-planta', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMid meet' },
    s('text', { x: 0, y: 14, class: 'dg-titulo' }, 'LOCAÇÃO DOS PILARES — NORMAL CARACTERÍSTICA NA FUNDAÇÃO (Nk = Ng + Nq)'), ...filhos);
}

const avisoFase = () => h('p', { class: 'rel-aviso' }, icone('alerta', { tamanho: 14, traco: 1.8 }),
  'Relatório gerado pelo LEBR, software em fase inicial de desenvolvimento: os resultados precisam ser conferidos por um profissional habilitado antes de qualquer uso em projeto real.');

/* ------------------------------------------------------------------ aba: cargas na fundação */

export function abaCargasFundacao(acoes = {}) {
  return {
    id: 'cargas-fundacao', icone: 'sapata', titulo: () => 'Cargas na fundação',
    render(container) {
      const p = estado.projeto;
      if (!p) return;
      const c = cargasNaFundacao(p);
      const raiz = h('div', { class: 'pagina relatorio' });
      raiz.append(ui.cabecalhoObjeto({
        rotulo: 'Fundações', numero: 'Cargas', etiquetas: ['LEBR', 'Fundação', 'PDF'], simbolo: 'sapata',
        linha1: p.meta?.nome ?? 'Projeto', linha2: `${c.linhas.length} pilares chegam à fundação`,
        titulo: 'Cargas na fundação', subtitulo: 'Normais dos pilares na base: característica (Ng + Nq) e de cálculo (Nd)',
      }));
      raiz.append(h('div', { class: 'quant-acoes' },
        ui.botao({ texto: 'Exportar PDF', icone: 'pdf', tipo: 'primario', aoClicar: () => acoes.exportarPdf?.('cargas-fundacao', `${p.meta?.nome ?? 'Projeto'} - cargas na fundacao`, 'Cargas na fundação') }),
        c.pendentes ? ui.botao({ texto: `Calcular ${c.pendentes} pendente${c.pendentes > 1 ? 's' : ''}`, icone: 'calcular', aoClicar: () => acoes.calcularTodos?.() }) : null));
      if (c.pendentes) raiz.append(h('p', { class: 'combinacoes-nota' }, icone('alerta', { tamanho: 13 }), ` ${c.pendentes} pilar(es) sem cálculo atual — as cargas deles aparecem em cinza ou com "—".`));
      if (!c.linhas.length) {
        raiz.append(ui.vazio({ icone: 'sapata', titulo: 'Nenhum pilar chega à fundação', texto: 'Posicione os pilares do nível mais baixo na montagem para ver as cargas na fundação.' }));
      } else {
        raiz.append(ui.secao({ titulo: 'Cargas por pilar', descricao: 'kN · na base do lance que chega à fundação', filhos: [tabelaCargas(c, acoes)] }));
        const planta = plantaLocacao(p, c);
        if (planta) raiz.append(ui.secao({ titulo: 'Planta de locação', descricao: 'Coordenadas da montagem, em metros', filhos: [h('div', { class: 'desenho-caixa' }, planta)] }));
      }
      raiz.append(avisoFase());
      numerar(raiz);
      container.append(raiz);
    },
  };
}

/* ------------------------------------------------------------------ aba: memorial do edifício */

const opcoesMemorial = { verificacoes: true, memorial: true };

export function abaMemorialProjeto(acoes = {}) {
  const aba = {
    id: 'memorial-projeto', icone: 'documento', titulo: () => 'Memorial do edifício',
    render(container) {
      const p = estado.projeto;
      if (!p) return;
      const redesenhar = () => { container.replaceChildren(); aba.render(container); };
      const par = p.parametros;
      const els = p.elementos.filter((e) => modulos.obter(e.modulo));
      const pend = els.filter((e) => !e.resultado || e.resultado.desatualizado).length;
      const falhas = els.filter((e) => e.resultado && (e.resultado.erro || e.resultado.ok === false));
      const raiz = h('div', { class: 'pagina relatorio memorial-projeto' });
      raiz.append(ui.cabecalhoObjeto({
        rotulo: 'Projeto', numero: 'Memorial', etiquetas: ['LEBR', 'Memorial', 'PDF'], simbolo: 'documento',
        linha1: p.meta?.nome ?? 'Projeto', linha2: [p.meta?.autor, `emitido em ${dataHora(new Date().toISOString())}`].filter(Boolean).join(' · '),
        titulo: 'Memorial do edifício', subtitulo: `${els.length} elementos · ${par.norma ?? 'NBR 6118:2023'}`,
      }));
      raiz.append(h('div', { class: 'quant-acoes' },
        ui.botao({ texto: 'Exportar PDF', icone: 'pdf', tipo: 'primario', aoClicar: () => acoes.exportarPdf?.('memorial-projeto', `${p.meta?.nome ?? 'Projeto'} - memorial do edificio`, 'Memorial do edifício') }),
        pend ? ui.botao({ texto: `Calcular ${pend} pendente${pend > 1 ? 's' : ''}`, icone: 'calcular', aoClicar: () => acoes.calcularTodos?.() }) : null,
        ui.alternar({ rotulo: 'Verificações de cada elemento', valor: opcoesMemorial.verificacoes, aoMudar: (v) => { opcoesMemorial.verificacoes = v; redesenhar(); } }),
        ui.alternar({ rotulo: 'Memorial de cálculo de cada elemento', valor: opcoesMemorial.memorial, aoMudar: (v) => { opcoesMemorial.memorial = v; redesenhar(); } })));
      raiz.append(avisoFase());

      // 1. dados do projeto
      const cf = par.coeficientes ?? {};
      raiz.append(ui.secao({ titulo: 'Dados do projeto', descricao: 'Materiais, durabilidade e ações (Parâmetros do projeto)', filhos: [ui.ficha([
        { rotulo: 'Concreto', valor: `C${par.concreto?.fck}`, sub: `agregado ${par.concreto?.agregado ?? '—'} · dmáx ${num(par.agregadoDmax ?? 19, 0)} mm` },
        { rotulo: 'Aço', valor: `CA-${(par.aco?.fyk ?? 500) / 10}`, sub: `Es = ${num((par.aco?.Es ?? 210000) / 1000, 0)} GPa` },
        { rotulo: 'Agressividade', valor: `CAA ${par.classeAgressividade}`, sub: 'Tabela 6.1' },
        { rotulo: 'Cobrimentos', valor: `${num(par.cobrimento?.viga, 1)} · ${num(par.cobrimento?.pilar, 1)} · ${num(par.cobrimento?.laje, 1)} cm`, sub: 'viga · pilar · laje' },
        { rotulo: 'Coeficientes', valor: `γc ${num(cf.gc, 2)} · γs ${num(cf.gs, 2)}`, sub: `γg ${num(cf.gg, 2)} · γq ${num(cf.gq, 2)}` },
        { rotulo: 'Uso', valor: par.uso ?? '—', sub: `ψ0 ${num(cf.psi0, 2)} · ψ1 ${num(cf.psi1, 2)} · ψ2 ${num(cf.psi2, 2)}` },
        { rotulo: 'Pilares', valor: par.analiseGlobal?.pilares === 'portico' ? 'Pórtico espacial' : 'Cargas dos elementos', sub: 'análise global' },
        { rotulo: 'Vento', valor: par.vento?.ativo ? `V0 = ${num(par.vento.V0, 0)} m/s` : 'Não considerado', sub: par.vento?.ativo ? `categoria ${par.vento.categoria}` : 'NBR 6123' },
      ])] }));

      // 2. situação
      const situacao = falhas.length ? `${falhas.length} elemento(s) não atende(m) ou com erro de cálculo` : pend ? `${pend} elemento(s) sem cálculo atual` : 'Todos os elementos calculados e atendendo às verificações';
      raiz.append(ui.secao({ titulo: 'Situação do projeto', descricao: situacao, filhos: [
        h('div', { class: ['rel-situacao', falhas.length ? 'falha' : pend ? 'pendente' : 'ok'] }, icone(falhas.length ? 'alerta' : pend ? 'relogio2' : 'check', { tamanho: 18, traco: 2 }), situacao),
        falhas.length ? h('ul', { class: 'rel-lista' }, falhas.sort(compararCodigos).map((e) => h('li', null, h('b', null, e.codigo), ` ${e.nome !== e.codigo ? e.nome : ''} — ${e.resultado.erro ?? (e.resultado.verificacoes ?? []).filter((v) => !v.ok).map((v) => v.nome).join('; ')}`))) : null,
      ] }));

      // 3. cargas na fundação
      const c = cargasNaFundacao(p);
      if (c.linhas.length) raiz.append(ui.secao({ titulo: 'Cargas na fundação', descricao: 'Normais na base dos pilares (kN)', filhos: [tabelaCargas(c)] }));

      // 4. quantitativos
      const q = quantitativosDoProjeto(p, modulos);
      const t = q.total;
      raiz.append(ui.secao({ titulo: 'Quantitativos', descricao: 'Do projeto inteiro, sem perdas', filhos: [ui.ficha([
        { rotulo: 'Concreto', valor: `${num(t.concreto, 2)} m³`, sub: t.estacas.metros ? `+ ${num(t.estacas.volume, 2)} m³ nas estacas` : '' },
        { rotulo: 'Fôrma', valor: `${num(t.forma, 1)} m²` },
        { rotulo: 'Aço', valor: `${num(acoTotal(t), 0)} kg`, sub: t.concreto > 0 ? `${num(acoTotal(t) / t.concreto, 0)} kg/m³` : '' },
        { rotulo: 'Segmentos de barra', valor: num(pecasTotal(t), 0), sub: `${q.bitolas.length} bitolas` },
        ...q.bitolas.map((phi) => ({ rotulo: `ø ${String(phi).replace('.', ',')}`, valor: `${num(t.aco[phi] ?? 0, 1)} kg` })),
      ])] }));

      // 5. elementos, por pavimento (de cima para baixo) e categoria
      const pavs = pavimentosOrdenados(p).slice().reverse();
      const grupos = [...pavs.map((pv) => ({ nome: `${pv.nome} · cota ${num(pv.cota, 2)} m`, els: els.filter((e) => e.posicao?.pavimento === pv.id) })),
        { nome: 'Sem posição na montagem', els: els.filter((e) => !pavs.some((pv) => pv.id === e.posicao?.pavimento)) }].filter((g) => g.els.length);
      const ordemCat = new Map(modulos.categorias().map((c2, i) => [c2.id, i]));
      for (const g of grupos) {
        const lista = g.els.sort((a, b) => (ordemCat.get(modulos.obter(a.modulo)?.categoria) ?? 99) - (ordemCat.get(modulos.obter(b.modulo)?.categoria) ?? 99) || compararCodigos(a, b));
        raiz.append(ui.secao({ titulo: g.nome, descricao: `${lista.length} elemento${lista.length > 1 ? 's' : ''}`, classe: 'rel-pavimento', filhos: lista.map((e) => blocoElemento(e, acoes)) }));
      }
      numerar(raiz);
      container.append(raiz);
    },
  };
  return aba;
}

function blocoElemento(e, acoes) {
  const mod = modulos.obter(e.modulo);
  const st = estadoDoResultado(e);
  const r = e.resultado;
  const filhos = [h('header', { class: 'rel-el-cab' },
    acoes.abrirElemento ? h('button', { class: 'rel-el-cod link', onClick: () => acoes.abrirElemento(e.id) }, e.codigo) : h('span', { class: 'rel-el-cod' }, e.codigo),
    h('span', { class: 'rel-el-nome' }, e.nome !== e.codigo ? e.nome : ''),
    h('span', { class: 'rel-el-mod' }, `${mod?.nome ?? e.modulo}${mod?.resumo ? ` · ${mod.resumo(e)}` : ''}`),
    h('span', { class: ['obj-estado', st.tipo] }, st.texto))];
  if (!r) filhos.push(h('p', { class: 'combinacoes-nota' }, 'Não calculado.'));
  else if (r.erro) filhos.push(h('p', { class: 'combinacoes-nota' }, `Erro no cálculo: ${r.erro}`));
  else {
    if (r.desatualizado) filhos.push(h('p', { class: 'combinacoes-nota' }, 'Atenção: os dados mudaram depois deste cálculo.'));
    if (r.avisos?.length) filhos.push(h('ul', { class: 'avisos' }, r.avisos.map((a) => h('li', null, icone('alerta', { tamanho: 13, traco: 1.8 }), a))));
    if (opcoesMemorial.verificacoes && r.verificacoes?.length) filhos.push(ui.tabelaVerificacoes(r.verificacoes));
    if (opcoesMemorial.memorial && r.memorial?.length) {
      filhos.push(h('div', { class: 'memorial' }, r.memorial.map((m) => h('div', { class: 'memorial-bloco' }, h('h3', null, m.titulo), m.linhas.map((l) => h('p', null, l))))));
    }
  }
  return h('article', { class: 'rel-elemento' }, ...filhos);
}

function numerar(raiz) {
  raiz.querySelectorAll('.secao').forEach((sec, i) => {
    const cab = sec.querySelector(':scope > .secao-cab');
    if (!cab) return;
    let n = cab.querySelector('.secao-num');
    if (!n) { n = h('span', { class: 'secao-num' }); cab.prepend(n); }
    n.textContent = String(i + 1).padStart(2, '0');
  });
}
