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
 * Seção "Detalhamento das barras" comum a vigas, pilares e lajes: desenho, lista de ferros editável (bitola,
 * quantidade e comprimento), resumo do aço por bitola com perdas e verificações do detalhamento.
 *
 * As edições ficam em elemento.detalhamento.edicoes[id] e não invalidam o cálculo: só esta seção se redesenha.
 */
import { aplicarEdicoes, resumoComPerdas } from '../../engine/detalhamento.js';
import { BITOLAS } from '../../engine/barras.js';
import { vistaArmadura3D } from '../../renderer/ui/armadura3d.js';

// elementos com a vista 3D da armadura aberta (no lugar do desenho 2D), enquanto o programa está aberto
const com3D = new Set();

const TIPOS = {
  positiva: 'Positiva', negativa: 'Negativa', 'porta-estribo': 'Porta-estribo', construtiva: 'Construtiva', pele: 'Pele',
  'torção': 'Torção', estribo: 'Estribo', longitudinal: 'Longitudinal', arranque: 'Arranque', suplementar: 'Suplementar',
  'distribuição': 'Distribuição',
};

/**
 * @param {object} api   API do LEBR (dom, ui, formatar)
 * @param {object} ctx   contexto do editor do elemento
 * @param {object} det   { posicoes, avisos, verificacoes }
 * @param {object} op
 * @param {(posicoes:object[], destaque:string|null) => Node} op.desenho   desenho com as posições (edições aplicadas)
 * @param {string} [op.titulo], [op.descricao], [op.nota], [op.tituloVerificacoes]
 * @param {number} [op.volume]   volume de concreto (m³) para a taxa kg/m³
 * @param {Node[]} [op.antes]    campos acima do desenho
 * @param {(posicoes:object[]) => object} [op.modelo3d]  geometria da armadura em 3D (modules/comum/armadura3d.js)
 */
export function secaoListaDeFerros(api, ctx, det, op = {}) {
  const { h } = api.dom;
  const ui = api.ui;
  const { num } = api.formatar;
  const corpo = h('div', { class: 'det-corpo' });
  const phiTxt = (phi) => num(phi, 1).replace(',0', '');
  const perdas = Number.isFinite(Number(ctx.projeto?.parametros?.perdasAco)) ? Number(ctx.projeto.parametros.perdasAco) : 10;
  let destaque = null;

  const alterar = (fn, descricao) => {
    ctx.alterar((e) => { const d = (e.detalhamento ??= {}); d.edicoes ??= {}; fn(d.edicoes); }, { descricao: `Detalhamento ${ctx.elemento.codigo}: ${descricao}`, invalidar: false });
    desenhar();
  };
  const editar = (q, campo, valor) => alterar((ed) => {
    const atual = { ...(ed[q.id] ?? {}) };
    const original = det.posicoes.find((p) => p.id === q.id)?.[campo];
    if (valor === original || valor == null) delete atual[campo]; else atual[campo] = valor;
    if (Object.keys(atual).length) ed[q.id] = atual; else delete ed[q.id];
  }, q.N);
  const restaurar = (q) => alterar((ed) => { delete ed[q.id]; }, `restaurar ${q.N}`);
  const restaurarTudo = () => alterar((ed) => { for (const k of Object.keys(ed)) delete ed[k]; }, 'restaurar tudo');

  const entradaNum = (valor, { casas = 0, min = 1, max = 99999, aoMudar }) => h('input', {
    class: 'det-input', type: 'text', inputMode: 'decimal', value: num(valor, casas), spellcheck: false,
    onKeydown: (ev) => { if (ev.key === 'Enter') ev.target.blur(); if (ev.key === 'Escape') { ev.target.value = num(valor, casas); ev.target.blur(); } },
    onChange: (ev) => {
      const v = Number(String(ev.target.value).replace(/\./g, '').replace(',', '.'));
      if (!Number.isFinite(v) || v < min || v > max) { ev.target.value = num(valor, casas); ev.target.classList.add('erro'); setTimeout(() => ev.target.classList.remove('erro'), 1600); return; }
      aoMudar(casas ? v : Math.round(v));
    },
  });
  const entradaPhi = (q) => h('select', { class: 'det-input det-phi', onChange: (ev) => editar(q, 'phi', BITOLAS[ev.target.selectedIndex]) },
    BITOLAS.map((b) => h('option', { selected: b === q.phi }, `ø ${phiTxt(b)}`)));

  function marcarTabela() {
    corpo.querySelectorAll('.det-tabela tbody tr').forEach((tr) => tr.classList.toggle('det-destaque', tr.dataset.pos === destaque));
  }
  function marcar() {
    corpo.querySelectorAll('.det-pos').forEach((g) => g.classList.toggle('destaque', g.dataset.pos === destaque));
    marcarTabela();
    corpo.querySelector('.vista-3d-armadura')?.destacar?.(destaque);
  }

  function desenhar() {
    const el = ctx.elemento;
    const posicoes = aplicarEdicoes(det.posicoes, el.detalhamento?.edicoes ?? {});
    const resumo = resumoComPerdas(posicoes, perdas);
    const nEd = posicoes.filter((q) => q.editada).length;
    const linhas = posicoes.map((q) => ({
      classe: [q.editada ? 'det-editada' : '', destaque === q.id ? 'det-destaque' : ''].filter(Boolean).join(' '),
      celulas: [
        h('b', { class: 'det-n', onMouseenter: () => { destaque = q.id; marcar(); }, onMouseleave: () => { destaque = null; marcar(); } }, q.N),
        TIPOS[q.tipo] ?? q.tipo,
        h('span', { class: 'det-local', title: q.local }, q.local),
        entradaPhi(q),
        entradaNum(q.n, { aoMudar: (v) => editar(q, 'n', v) }),
        entradaNum(q.comprimento, { min: 10, max: 10000, aoMudar: (v) => editar(q, 'comprimento', v) }),
        q.forma ?? [q.ganchos ? `${q.ganchos} × ${q.dobra ? 'dobra' : q.tipo === 'arranque' ? 'pé' : '90°'}` : '—', q.emendas ? ` · ${q.emendas} emenda${q.emendas > 1 ? 's' : ''} (${q.l0t} cm)` : ''].join(''),
        num((q.n * q.comprimento) / 100, 2),
        num(q.massa, 2),
        q.editada ? h('button', { class: 'link', title: 'Voltar ao valor calculado', onClick: () => restaurar(q) }, 'restaurar') : '',
      ],
    }));
    const tabelaPos = ui.tabela({
      classe: 'det-tabela',
      colunas: [{ titulo: 'N' }, { titulo: 'Tipo' }, { titulo: 'Local' }, { titulo: 'Bitola' }, { titulo: 'Qtd.', alinhar: 'dir' }, { titulo: 'C unit. (cm)', alinhar: 'dir' }, { titulo: 'Ganchos / forma' }, { titulo: 'C total (m)', alinhar: 'dir' }, { titulo: 'Massa (kg)', alinhar: 'dir' }, { titulo: '' }],
      linhas,
    });
    // marca as linhas com o id da posição (para o destaque cruzado com o desenho)
    tabelaPos.querySelectorAll('tbody tr').forEach((tr, i) => { tr.dataset.pos = posicoes[i].id; });
    const tabelaResumo = ui.tabela({
      classe: 'det-resumo',
      colunas: [{ titulo: 'Aço' }, { titulo: 'Bitola' }, { titulo: 'Comprimento (m)', alinhar: 'dir' }, { titulo: 'Massa (kg)', alinhar: 'dir' }, { titulo: `+ ${num(perdas, 0)} % (kg)`, alinhar: 'dir' }, { titulo: 'Barras de 12 m', alinhar: 'dir' }],
      linhas: [
        ...resumo.linhas.map((l) => [l.aco, `ø ${phiTxt(l.phi)} mm`, num(l.metros, 2), num(l.kg, 2), num(l.kgPerdas, 2), String(l.barras12)]),
        { classe: 'total', celulas: [h('b', null, 'Total'), '', '', h('b', null, num(resumo.total, 2)), h('b', null, num(resumo.totalPerdas, 2)), ''] },
      ],
    });
    const verifs = det.verificacoes?.length ? ui.tabelaVerificacoes(det.verificacoes) : null;
    const taxa = op.volume > 0 ? resumo.total / op.volume : null;
    corpo.replaceChildren(
      det.avisos?.length ? h('ul', { class: 'avisos' }, det.avisos.map((a) => h('li', null, ui.icone('alerta', { tamanho: 14, traco: 1.8 }), a))) : '',
      op.modelo3d ? h('div', { class: 'det-alternar-vista' }, ui.segmentado({
        valor: com3D.has(el.id) ? '3d' : '2d', compacto: true,
        opcoes: [{ valor: '2d', texto: 'Desenho' }, { valor: '3d', texto: 'Armadura em 3D', dica: 'Vista 3D isolada das barras deste elemento' }],
        aoMudar: (v) => { if (v === '3d') com3D.add(el.id); else com3D.delete(el.id); desenhar(); },
      })) : '',
      op.modelo3d && com3D.has(el.id)
        ? (() => {
          let modelo = null;
          try { modelo = op.modelo3d(posicoes); } catch (err) { console.error(err); }
          return modelo ? h('div', null, vistaArmadura3D(modelo, { aoDestacar: (id) => { destaque = id; marcarTabela(); } }), modelo.legenda ? h('p', { class: 'combinacoes-nota a3d-legenda' }, modelo.legenda) : '') : h('p', { class: 'combinacoes-nota' }, 'Não foi possível montar a vista 3D deste detalhamento.');
        })()
        : '',
      // o desenho 2D vai sempre para o PDF (com a vista 3D aberta, fica só na impressão)
      op.desenho ? h('div', { class: ['desenho-caixa', 'det-elevacao', op.modelo3d && com3D.has(el.id) && 'so-impressao'] }, op.desenho(posicoes, destaque)) : '',
      h('div', { class: 'det-barra-acoes' },
        h('span', { class: 'det-info' }, `${posicoes.length} posições · ${num(resumo.total, 1)} kg de aço${taxa ? ` · ${num(taxa, 0)} kg/m³` : ''}${nEd ? ` · ${nEd} ${nEd > 1 ? 'posições editadas' : 'posição editada'}` : ''}`),
        nEd ? ui.botao({ texto: 'Restaurar o detalhamento calculado', icone: 'atualizar', tipo: 'fantasma', aoClicar: restaurarTudo }) : ''),
      h('div', { class: 'det-rolagem' }, tabelaPos),
      h('div', { class: 'det-rodape' },
        h('div', { class: 'det-rodape-resumo' }, h('h4', { class: 'det-sub' }, 'Resumo do aço'), tabelaResumo),
        verifs && h('div', { class: 'det-rodape-verif' }, h('h4', { class: 'det-sub' }, op.tituloVerificacoes ?? 'Verificações do detalhamento'), verifs)),
      op.nota ? h('p', { class: 'combinacoes-nota' }, op.nota) : '',
    );
    // destaque ao passar o mouse sobre o desenho
    corpo.querySelectorAll('.det-pos').forEach((g) => {
      g.addEventListener('mouseenter', () => { destaque = g.dataset.pos; marcar(); });
      g.addEventListener('mouseleave', () => { destaque = null; marcar(); });
    });
  }
  desenhar();

  return ui.secao({
    titulo: op.titulo ?? 'Detalhamento das barras',
    descricao: op.descricao ?? 'Lista de ferros editável',
    filhos: [...(op.antes ?? []), corpo],
  });
}
