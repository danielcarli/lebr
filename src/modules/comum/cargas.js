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
 * Editor de lista de cargas compartilhado pelos módulos de barra (viga, pilar).
 *
 * Tipos suportados:
 *   distribuida  { natureza, valor (kN/m), vao }
 *   concentrada  { natureza, valor (kN), vao, posicao (m) }
 *   alvenaria    { material, espessura (cm), revestimento (cm/face), altura (m), aberturas (%), vao }
 *                — `material` é um tipo da NBR 6120:2019, Tabela 2 (engine/cargas.js);
 *                sem `material` (arquivos até a 0.8): { espessura, altura, peso (kN/m³) }
 *   torcao       { natureza, valor (kN·m/m), vao }  — momento torçor distribuído (marquise, laje em balanço…)
 *   elemento     { elementoId, ligacao, vao, posicao? }  — reação de outro elemento (e torção, se for laje em balanço);
 *                com `posicao` (m no vão), a reação de uma faixa estreita (escada) entra como resultante concentrada;
 *                com `trecho` [x0, x1] (m no vão), a reação linear fica só nesse trecho (reservatório sobre parte do vão)
 */

const TIPOS = {
  distribuida: { rotulo: 'Distribuída', icone: 'carga' },
  concentrada: { rotulo: 'Concentrada', icone: 'direita' },
  alvenaria: { rotulo: 'Alvenaria', icone: 'laje' },
  torcao: { rotulo: 'Torção distribuída', icone: 'girar' },
  elemento: { rotulo: 'Reação de elemento', icone: 'globo' },
};

/** Fontes cujas reações chegam numa faixa estreita da viga (entram como resultante concentrada). */
const emFaixa = (fonte) => fonte?.modulo === 'concreto.escada';

const novoIdCarga = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/**
 * @param {object} api       API do LEBR
 * @param {object} ctx       contexto do editor do elemento
 * @param {object} op
 * @param {string[]} op.tipos           tipos permitidos
 * @param {'linear'|'pontual'} op.ligacao  tipo de ligação aceita para cargas de elemento
 * @param {boolean} op.porVao           exibe seleção de vão
 */
export function editorCargas(api, ctx, { tipos, ligacao, porVao = true }) {
  const { h } = api.dom;
  const ui = api.ui;
  const el = ctx.elemento;
  const lista = h('div', { class: 'cargas' });

  const opcoesVao = (incluirTodos) => [
    ...(incluirTodos ? [{ valor: 'todos', texto: 'Todos' }] : []),
    ...(el.vaos ?? []).map((v, i) => ({ valor: i, texto: `Vão ${i + 1}` })),
  ];
  const mudar = (i, fn, estrutural = false) => ctx.alterar((e) => fn(e.cargas[i]), { estrutural });

  const fontes = ctx.fontesDeCarga(ligacao);

  (el.cargas ?? []).forEach((c, i) => {
    const t = TIPOS[c.tipo] ?? TIPOS.distribuida;
    const campos = [];

    if (c.tipo === 'elemento') {
      const origem = fontes.find((x) => x.elemento.id === c.elementoId);
      campos.push(ui.selecao({
        rotulo: 'Origem', largura: '150px', valor: c.elementoId,
        opcoes: fontes.length ? fontes.map((x) => ({ valor: x.elemento.id, texto: `${x.elemento.codigo} · ${x.elemento.nome}` })) : [{ valor: c.elementoId, texto: '—' }],
        aoMudar: (v) => {
          const fx = fontes.find((x) => x.elemento.id === v);
          const lig = fx?.ligacoes[0]?.id;
          mudar(i, (cc) => {
            cc.elementoId = v; cc.ligacao = lig;
            if (emFaixa(fx?.elemento)) { if (cc.vao === 'todos' || cc.vao == null) cc.vao = 0; cc.posicao ??= (el.vaos?.[Number(cc.vao) || 0]?.L ?? 0) / 2; } else delete cc.posicao;
          }, true);
        },
      }));
      campos.push(ui.selecao({
        rotulo: ligacao === 'linear' ? 'Borda' : 'Apoio', largura: '170px', valor: c.ligacao,
        opcoes: (origem?.ligacoes ?? [{ id: c.ligacao, nome: c.ligacao }]).map((l) => ({ valor: l.id, texto: l.nome })),
        aoMudar: (v) => mudar(i, (cc) => { cc.ligacao = v; }),
      }));
      if (porVao && (c.posicao != null || emFaixa(origem?.elemento))) {
        const L = el.vaos?.[Number(c.vao) || 0]?.L ?? 0;
        campos.push(ui.campo({ rotulo: 'Posição', valor: c.posicao ?? L / 2, unidade: 'm', min: 0, max: L, largura: '104px', dica: 'Centro da faixa de apoio, a partir do início do vão', aoMudar: (v) => mudar(i, (cc) => { cc.posicao = v; }) }));
      }
      if (origem) campos.push(ui.botao({ texto: 'Abrir', icone: 'direita', tipo: 'fantasma', aoClicar: () => ctx.abrirElemento(origem.elemento.id) }));
      else campos.push(h('span', { class: 'carga-aviso' }, 'Elemento de origem não encontrado'));
    } else if (c.tipo === 'alvenaria') {
      // a linha mostra o total da parede: redesenha a cada mudança
      campos.push(...camposParede(api, c, (fn) => mudar(i, fn, true)));
    } else {
      campos.push(ui.segmentado({
        rotulo: 'Natureza', valor: c.natureza ?? 'g', compacto: true,
        opcoes: [{ valor: 'g', texto: 'g', dica: 'Permanente' }, { valor: 'q', texto: 'q', dica: 'Variável (acidental)' }],
        aoMudar: (v) => mudar(i, (cc) => { cc.natureza = v; }, true),
      }));
      campos.push(ui.campo({ rotulo: 'Valor', valor: c.valor, unidade: c.tipo === 'concentrada' ? 'kN' : c.tipo === 'torcao' ? 'kN·m/m' : 'kN/m', min: 0, largura: c.tipo === 'torcao' ? '132px' : '118px', dica: c.tipo === 'torcao' ? 'Momento torçor por metro de viga (valor característico)' : undefined, aoMudar: (v) => mudar(i, (cc) => { cc.valor = v; }) }));
      if (c.tipo === 'concentrada' && porVao) {
        const L = el.vaos?.[Number(c.vao) || 0]?.L ?? 0;
        campos.push(ui.campo({ rotulo: 'Posição', valor: c.posicao, unidade: 'm', min: 0, max: L, largura: '104px', dica: 'Distância ao início do vão', aoMudar: (v) => mudar(i, (cc) => { cc.posicao = v; }) }));
      }
    }

    if (porVao && el.vaos) {
      const todos = c.tipo !== 'concentrada' && !(c.tipo === 'elemento' && (c.posicao != null || emFaixa(fontes.find((x) => x.elemento.id === c.elementoId)?.elemento)));
      campos.push(ui.selecao({
        rotulo: 'Vão', largura: '96px', valor: todos ? c.vao ?? 'todos' : Number(c.vao) || 0, opcoes: opcoesVao(todos),
        aoMudar: (v) => mudar(i, (cc) => { cc.vao = v; }, c.tipo === 'concentrada'),
      }));
    }

    lista.append(h('div', { class: 'carga-linha' },
      h('div', { class: 'carga-tipo' },
        h('span', { class: 'carga-num' }, String(i + 1).padStart(2, '0')),
        h('div', { class: 'carga-desc' },
          h('span', { class: 'carga-rot' }, t.rotulo),
          h('input', {
            class: 'carga-nome', value: c.descricao ?? '', placeholder: 'Descrição', spellcheck: false,
            onKeydown: (e) => { if (e.key === 'Enter') e.target.blur(); },
            onChange: (e) => mudar(i, (cc) => { cc.descricao = e.target.value; }),
          }),
        ),
      ),
      h('div', { class: 'carga-campos' }, campos),
      ui.botaoIcone({ icone: 'lixeira', titulo: 'Remover carga', classe: 'perigo', aoClicar: () => ctx.alterar((e) => e.cargas.splice(i, 1), { estrutural: true }) }),
    ));
  });

  if (!el.cargas?.length) lista.append(h('div', { class: 'cargas-vazio' }, 'Nenhuma carga lançada.'));

  const adicionar = (tipo) => {
    const base = { id: novoIdCarga(), tipo, descricao: '' };
    if (tipo === 'distribuida') Object.assign(base, { natureza: 'g', valor: 5, vao: 'todos' });
    if (tipo === 'torcao') Object.assign(base, { natureza: 'g', valor: 2, vao: 'todos', descricao: 'Torção' });
    if (tipo === 'concentrada') Object.assign(base, { natureza: 'g', valor: 10, vao: 0, posicao: (el.vaos?.[0]?.L ?? 0) / 2 });
    if (tipo === 'alvenaria') Object.assign(base, { material: 'ceramico-vedacao', espessura: 14, revestimento: 2, altura: 2.7, aberturas: 0, vao: 'todos', descricao: 'Parede' });
    if (tipo === 'elemento') {
      const f = fontes[0];
      Object.assign(base, { elementoId: f.elemento.id, ligacao: f.ligacoes[0].id, vao: 'todos' });
      if (emFaixa(f.elemento)) Object.assign(base, { vao: 0, posicao: (el.vaos?.[0]?.L ?? 0) / 2 });
    }
    if (!porVao) delete base.vao;
    ctx.alterar((e) => { (e.cargas ??= []).push(base); }, { estrutural: true });
  };

  const botaoAdd = ui.botao({
    texto: 'Adicionar carga', icone: 'mais', tipo: 'secundario',
    aoClicar: (e) => api.menus.abrirMenu(tipos.map((tp) => ({
      rotulo: tp === 'elemento' ? (ligacao === 'linear' ? 'Reação de laje ou escada' : 'Reação de viga') : TIPOS[tp].rotulo,
      icone: TIPOS[tp].icone,
      desabilitado: tp === 'elemento' && !fontes.length,
      acao: () => adicionar(tp),
    })), { ancora: e.currentTarget }),
  });

  return { lista, botaoAdd };
}

/**
 * Campos de uma carga de parede: tipo de alvenaria da Tabela 2 da NBR 6120:2019, espessura,
 * revestimento por face, altura e aberturas. "Peso específico informado" mantém o modo antigo.
 */
function camposParede(api, c, mudar) {
  const { h } = api.dom;
  const ui = api.ui;
  const C = api.motor.cargas;
  const { num } = api.formatar;
  const campos = [];
  const tabela = !!c.material && !!C.alvenaria(c.material);

  const ajustar = (cc) => {
    const esp = C.espessurasAlvenaria(cc.material);
    if (!esp.includes(Number(cc.espessura))) {
      cc.espessura = esp.reduce((a, b) => (Math.abs(b - (Number(cc.espessura) || 14)) < Math.abs(a - (Number(cc.espessura) || 14)) ? b : a), esp[0]);
    }
    const revs = C.revestimentosAlvenaria(cc.material, cc.espessura);
    if (!revs.includes(Number(cc.revestimento ?? 1))) cc.revestimento = revs.includes(1) ? 1 : revs[0];
  };

  campos.push(ui.selecao({
    rotulo: 'Parede (NBR 6120, Tabela 2)', largura: '290px', valor: tabela ? c.material : 'peso',
    opcoes: [
      ...C.ALVENARIAS.map((a) => ({ valor: a.id, texto: `${a.uso === 'vedacao' ? 'Vedação' : 'Estrutural'} · ${a.nome}` })),
      { valor: 'peso', texto: 'Peso específico informado (kN/m³)' },
    ],
    aoMudar: (v) => mudar((cc) => {
      if (v === 'peso') {
        delete cc.material; delete cc.revestimento;
        cc.peso ??= 13;
      } else {
        cc.material = v;
        ajustar(cc);
      }
    }),
  }));

  if (tabela) {
    campos.push(ui.selecao({
      rotulo: 'Espessura', largura: '104px', valor: Number(c.espessura),
      opcoes: C.espessurasAlvenaria(c.material).map((e) => ({ valor: e, texto: `${String(e).replace('.', ',')} cm` })),
      aoMudar: (v) => mudar((cc) => { cc.espessura = v; ajustar(cc); }),
    }));
    const revs = C.revestimentosAlvenaria(c.material, Number(c.espessura));
    campos.push(ui.segmentado({
      rotulo: 'Revest./face', valor: Number(c.revestimento ?? 1), compacto: true,
      opcoes: revs.map((r) => ({ valor: r, texto: `${r} cm`, dica: `Revestimento de ${r} cm em cada face` })),
      aoMudar: (v) => mudar((cc) => { cc.revestimento = v; }),
    }));
  } else {
    campos.push(
      ui.campo({ rotulo: 'Espessura', valor: c.espessura, unidade: 'cm', casas: 1, min: 1, max: 60, largura: '104px', aoMudar: (v) => mudar((cc) => { cc.espessura = v; }) }),
      ui.campo({ rotulo: 'Peso esp.', valor: c.peso, unidade: 'kN/m³', casas: 1, min: 1, max: 30, largura: '118px', aoMudar: (v) => mudar((cc) => { cc.peso = v; }) }),
    );
  }
  campos.push(
    ui.campo({ rotulo: 'Altura', valor: c.altura, unidade: 'm', min: 0, max: 20, largura: '96px', aoMudar: (v) => mudar((cc) => { cc.altura = v; }) }),
    ui.campo({ rotulo: 'Aberturas', valor: c.aberturas ?? 0, unidade: '%', casas: 0, min: 0, max: 90, largura: '96px', dica: 'Parte da parede ocupada por portas e janelas, descontada do peso', aoMudar: (v) => mudar((cc) => { cc.aberturas = v; }) }),
  );

  let total;
  try {
    const p = C.cargaParede(c);
    total = h('span', { class: ['carga-total', p.conferir && 'conferir'], title: p.conferir ?? '' },
      p.porArea != null ? `${num(p.porArea)} kN/m² → ` : '', h('b', null, `${num(p.g)} kN/m`),
      p.conferir ? api.ui.icone('alerta', { tamanho: 13, traco: 1.8 }) : null);
  } catch (err) {
    total = h('span', { class: 'carga-aviso' }, err.message);
  }
  campos.push(total);
  return campos;
}
