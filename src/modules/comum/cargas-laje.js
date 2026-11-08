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
 * Campos de carga das lajes ligados ao catálogo da NBR 6120:2019 (engine/cargas.js),
 * usados por todos os tipos de laje e pelo entrepiso de madeira.
 *
 * - Uso (Tabela 10): escolher o ambiente preenche a carga acidental; digitar outro valor
 *   volta para "valor informado".
 * - Revestimento: pode ser digitado ou composto por camadas (contrapiso, piso, teto e forro,
 *   pesos específicos da Tabela 1).
 *
 * O cálculo continua lendo `cargas.acidental` e `cargas.revestimento`: o catálogo só preenche
 * esses números e guarda de onde vieram (`cargas.uso`, `cargas.composicao`). Arquivos antigos,
 * sem esses campos, abrem com os valores que tinham.
 */
export function camposCargasLaje(api, ctx, { forro = true, larguraCampo = '150px' } = {}) {
  const { h } = api.dom;
  const ui = api.ui;
  const C = api.motor.cargas;
  const { num } = api.formatar;
  const el = ctx.elemento;
  const cg = el.cargas;
  const usoAtual = cg.uso ? C.cargaUso(cg.uso) : null;
  // estes campos preenchem outros (acidental, revestimento): a seção é redesenhada a cada mudança
  const redesenhar = { estrutural: true };

  /* ------------------------------------------------------------ uso (Tabela 10) */
  const grupos = [...new Set(C.CARGAS_USO.map((u) => u.grupo))];
  const uso = ui.selecao({
    rotulo: 'Uso do ambiente (NBR 6120, Tabela 10)', largura: '380px', valor: usoAtual ? usoAtual.id : '',
    opcoes: [
      { valor: '', texto: 'Valor informado' },
      ...grupos.flatMap((g) => C.CARGAS_USO.filter((u) => u.grupo === g).map((u) => ({ valor: u.id, texto: `${g} · ${u.local} — ${num(u.q, 1)} kN/m²` }))),
    ],
    aoMudar: (v) => ctx.alterar((e) => {
      if (!v) { delete e.cargas.uso; return; }
      e.cargas.uso = v;
      e.cargas.acidental = C.cargaUso(v).q;
    }, redesenhar),
  });

  const acidental = ui.campo({
    rotulo: 'Acidental (q)', valor: cg.acidental, unidade: 'kN/m²', min: 0, largura: larguraCampo,
    dica: usoAtual ? `NBR 6120, Tabela 10: ${C.rotuloUso(usoAtual)}` : 'Escolha o uso do ambiente para preencher pela Tabela 10',
    aoMudar: (v) => ctx.alterar((e) => {
      e.cargas.acidental = v;
      const u = e.cargas.uso && C.cargaUso(e.cargas.uso);
      if (u && Math.abs(u.q - v) > 1e-9) delete e.cargas.uso;
    }, redesenhar),
  });

  /* ------------------------------------------------------------ revestimento por camadas */
  const comp = cg.composicao ?? null;
  const revestimento = ui.campo({
    rotulo: 'Revestimento', valor: cg.revestimento, unidade: 'kN/m²', min: 0, largura: larguraCampo,
    desabilitado: !!comp, dica: comp ? 'Calculado pelas camadas abaixo' : undefined,
    aoMudar: (v) => ctx.alterar((e) => { e.cargas.revestimento = v; }),
  });

  const mudarComp = (fn) => ctx.alterar((e) => {
    const c = { ...C.COMPOSICAO_PADRAO, ...(e.cargas.composicao ?? {}) };
    fn(c);
    if (!forro) delete c.forro;
    e.cargas.composicao = c;
    e.cargas.revestimento = C.cargaRevestimento(c, { forro }).total;
  }, redesenhar);

  const alternar = ui.alternar({
    rotulo: 'Compor o revestimento por camadas (NBR 6120, Tabela 1)', valor: !!comp,
    aoMudar: (v) => (v
      ? mudarComp(() => {})
      : ctx.alterar((e) => { delete e.cargas.composicao; }, redesenhar)),
  });

  const composicao = [h('div', { class: 'cargas-composicao-alternar' }, alternar)];
  if (comp) {
    const c = { ...C.COMPOSICAO_PADRAO, ...comp };
    const r = C.cargaRevestimento(c, { forro });
    const campoCm = (rotulo, chave, max = 15) => ui.campo({ rotulo, valor: c[chave], unidade: 'cm', casas: 1, min: 0, max, largura: '104px', aoMudar: (v) => mudarComp((x) => { x[chave] = v; }) });
    composicao.push(
      ui.linhaCampos(
        campoCm('Contrapiso', 'contrapiso', 20),
        ui.selecao({ rotulo: 'Piso', largura: '190px', valor: c.piso, opcoes: C.PISOS.map((p) => ({ valor: p.id, texto: p.nome })), aoMudar: (v) => mudarComp((x) => { x.piso = v; }) }),
        c.piso !== 'nenhum' && campoCm('Esp. do piso', 'pisoEsp', 5),
        ui.selecao({ rotulo: 'Teto', largura: '220px', valor: c.teto, opcoes: C.TETOS.map((t) => ({ valor: t.id, texto: t.nome })), aoMudar: (v) => mudarComp((x) => { x.teto = v; }) }),
        c.teto !== 'nenhum' && campoCm('Esp. no teto', 'tetoEsp', 5),
        forro && ui.selecao({ rotulo: 'Forro', largura: '170px', valor: c.forro, opcoes: C.FORROS.map((f) => ({ valor: f.id, texto: f.nome })), aoMudar: (v) => mudarComp((x) => { x.forro = v; }) }),
      ),
      h('ul', { class: 'cargas-camadas' },
        r.camadas.map((k) => h('li', { title: k.conferir ?? '' },
          h('span', null, k.nome, k.conferir ? ui.icone('alerta', { tamanho: 12, traco: 1.8 }) : null),
          h('span', { class: 'num' }, k.espessura != null ? `${num(k.espessura, 1)} cm × ${num(k.gama, 1)} kN/m³ = ` : '', h('b', null, `${num(k.p)} kN/m²`)))),
        h('li', { class: 'total' }, h('span', null, 'Revestimento'), h('span', { class: 'num' }, h('b', null, `${num(r.total)} kN/m²`)))),
    );
  }

  // paredes lançadas da arquitetura (etapa L12): peso das paredes ÷ área da laje, somado às permanentes
  if (Number(cg.paredes) > 0) {
    composicao.push(ui.linhaCampos(
      ui.campo({
        rotulo: 'Paredes sobre a laje', valor: cg.paredes, unidade: 'kN/m²', min: 0, largura: larguraCampo,
        dica: 'Peso das paredes sem viga embaixo ÷ área da laje (Montagem → Paredes do DXF). Prática usual para laje armada em duas direções; em uma direção, confira a faixa de distribuição.',
        aoMudar: (v) => ctx.alterar((e) => { if (v > 0) e.cargas.paredes = v; else delete e.cargas.paredes; }, redesenhar),
      }),
    ));
  }

  return { uso, acidental, revestimento, composicao };
}
