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
 * Material dos elementos de madeira: propriedades de cálculo a partir da classe
 * do elemento e dos parâmetros de madeira do projeto, e o bloco de interface
 * "Material" usado pelos três módulos (viga, pilar e entrepiso).
 */
import { madeira, parametrosMadeira, CLASSES_MADEIRA, GRUPOS_MADEIRA, CARREGAMENTOS, UMIDADES } from '../../engine/madeira.js';

/** Propriedades de cálculo do elemento. */
export function materialDoElemento(el, parametros) {
  const p = parametrosMadeira(parametros?.madeira);
  const m = madeira(el.classe ?? p.classe, {
    umidade: p.umidade, carregamento: el.carregamento ?? p.carregamento,
    tipo: el.tipo ?? p.tipo, gwc: p.gwc, gwv: p.gwv,
  });
  return { m, p, psi2: parametros?.coeficientes?.psi2 ?? 0.3 };
}

/** Campos comuns a todo elemento novo de madeira. */
export function materialInicial(projeto) {
  const p = parametrosMadeira(projeto?.parametros?.madeira);
  return { classe: p.classe, carregamento: p.carregamento, tipo: p.tipo };
}

const fmt = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');

/** Linhas do memorial com as propriedades de cálculo. */
export function memorialMaterial(m, p) {
  return {
    titulo: 'Material (NBR 7190-1:2022)',
    linhas: [
      `Classe ${m.nome} (${GRUPOS_MADEIRA[m.grupo]}) · ${m.tipo === 'mlc' ? 'madeira lamelada colada / LVL (βc = 0,1)' : 'madeira serrada ou roliça (βc = 0,2)'}`,
      `kmod = kmod1 · kmod2 = ${fmt(m.kmod1)} · ${fmt(m.kmod2)} = ${fmt(m.kmod, 3)} (carregamento ${m.carregamento}, umidade classe ${m.umidade})`,
      `fc0,d = ${fmt(m.fc0d)} MPa · fm,d = ${fmt(m.fmd)} MPa${m.fmk ? '' : ' (= fc0,d, espécie nativa)'} · fv,d = ${fmt(m.fvd)} MPa · fc90,d = ${fmt(m.fc90d)} MPa`,
      `γw = ${fmt(p.gwc, 2)} (normais) · ${fmt(p.gwv, 2)} (cisalhamento) · E0,med = ${fmt(m.E0m, 0)} MPa · E0,05 = ${fmt(m.E005, 0)} MPa · Ec0,ef = ${fmt(m.Eef, 0)} MPa`,
      `Peso específico ${fmt(m.peso)} kN/m³ · coeficiente de fluência φ = ${fmt(m.phi, 1)}`,
    ],
  };
}

/** Seção "Material" do editor: classe, duração da carga e tipo de peça. */
export function secaoMaterial(api, ctx, { numero = '01' } = {}) {
  const { h } = api.dom;
  const ui = api.ui;
  const { num } = api.formatar;
  const el = ctx.elemento;
  const { m } = materialDoElemento(el, ctx.projeto.parametros);

  const opcoesClasse = Object.entries(GRUPOS_MADEIRA).flatMap(([g, nome]) =>
    CLASSES_MADEIRA.filter((c) => c.grupo === g).map((c) => ({ valor: c.id, texto: `${c.nome} — ${nome.replace('Peças estruturais — ', '').replace(' (corpos de prova)', '')}` })));

  return ui.secao({
    numero, titulo: 'Material', descricao: 'Classe de umidade e coeficientes nos parâmetros do projeto',
    filhos: [
      ui.linhaCampos(
        ui.selecao({ rotulo: 'Classe de resistência', valor: el.classe, largura: '250px', opcoes: opcoesClasse, aoMudar: (v) => ctx.alterar((e) => { e.classe = v; }, { estrutural: true }) }),
        ui.selecao({ rotulo: 'Duração da carga variável', valor: el.carregamento, largura: '280px', opcoes: CARREGAMENTOS, aoMudar: (v) => ctx.alterar((e) => { e.carregamento = v; }, { estrutural: true }) }),
        ui.segmentado({ rotulo: 'Tipo de peça', valor: el.tipo ?? 'serrada', compacto: true, opcoes: [{ valor: 'serrada', texto: 'Serrada / roliça' }, { valor: 'mlc', texto: 'MLC / LVL' }], aoMudar: (v) => ctx.alterar((e) => { e.tipo = v; }, { estrutural: true }) }),
      ),
      ui.ficha([
        { rotulo: 'kmod', valor: num(m.kmod, 3), sub: `${num(m.kmod1)} × ${num(m.kmod2)}` },
        { rotulo: 'fm,d', valor: `${num(m.fmd)} MPa`, sub: m.fmk ? `fm,k ${num(m.fmk, 0)} MPa` : '= fc0,d (nativa)' },
        { rotulo: 'fc0,d', valor: `${num(m.fc0d)} MPa`, sub: `fc0,k ${num(m.fc0k, 0)} MPa` },
        { rotulo: 'fv,d', valor: `${num(m.fvd)} MPa`, sub: `fv,k ${num(m.fvk, 1)} MPa` },
        { rotulo: 'E0,med', valor: `${num(m.E0m, 0)} MPa`, sub: `E0,05 ${num(m.E005, 0)} MPa` },
        { rotulo: 'Umidade', valor: `Classe ${m.umidade}`, sub: UMIDADES.find((u) => u.valor === m.umidade)?.texto.slice(4) },
        { rotulo: 'Peso específico', valor: `${num(m.peso)} kN/m³` },
        { rotulo: 'Fluência φ', valor: num(m.phi, 1) },
      ], { colunas: 4 }),
    ],
  });
}
