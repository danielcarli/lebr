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
/** Exportação IFC4 (0.64): escrita STEP, GUIDs, geometria e ida e volta pelo importador do próprio LEBR. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { calcularProjeto } from '../src/validacao/caminho-cargas.js';
import { exportarIfc, modeloIfcDoProjeto } from '../src/modules/comum/modelo-ifc.js';
import { guidIfc, textoStep, escreverIfc } from '../src/engine/ifc-escrever.js';
import { lerIfc, lerStep } from '../src/engine/ifc.js';

const registro = { obter: (id) => MODULOS_CALCULO[id] };
const exemplo = (n) => calcularProjeto(JSON.parse(fs.readFileSync(new URL(`../exemplos/${n}.lebr.json`, import.meta.url), 'utf8')));
const DATA = '2026-11-09T00:00:00Z';

test('IFC: GlobalId de 22 caracteres, determinístico e sem colisão; textos com acento e apóstrofo', () => {
  const g = guidIfc('V1|vão');
  assert.match(g, /^[0-3][0-9A-Za-z_$]{21}$/);
  assert.equal(guidIfc('V1|vão'), g);
  const muitos = new Set(Array.from({ length: 5000 }, (_, i) => guidIfc(`el|${i}`)));
  assert.equal(muitos.size, 5000);
  assert.equal(textoStep("Caixa d'Água"), "'Caixa d''\\X2\\00C1\\X0\\gua'");
  // o leitor STEP do LEBR desfaz a codificação
  const m = lerStep(`ISO-10303-21;\nHEADER;\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n#1=IFCLABEL(${textoStep("Caixa d'Água ø 10 — ação")});\nENDSEC;`);
  assert.deepEqual(m.arg(1), ["Caixa d'Água ø 10 — ação"]);
});

test('IFC: projeto de exemplo — cabeçalho IFC4, pavimentos, elementos, propriedades e armaduras', () => {
  const p = exemplo('edificio-exemplo');
  const r = exportarIfc(p, registro, { versao: 'teste', data: DATA });
  assert.ok(r.texto.startsWith('ISO-10303-21;'));
  assert.ok(r.texto.includes("FILE_SCHEMA(('IFC4'));"));
  assert.ok(!/NaN|undefined|Infinity/.test(r.texto));
  const pilares = p.elementos.filter((e) => e.modulo === 'concreto.pilar').length;
  const vigas = p.elementos.filter((e) => e.modulo === 'concreto.viga').length;
  assert.equal(r.contagem.IFCCOLUMN, pilares);
  assert.equal(r.contagem.IFCBEAM, vigas);
  assert.ok(r.contagem.IFCREINFORCINGBAR > 10, 'barras do detalhamento');
  for (const t of ['Pset_ColumnCommon', 'Pset_ConcreteElementGeneral', 'LEBR_Calculo', 'IFCMATERIAL', 'IFCRELASSOCIATESMATERIAL', 'IFCSWEPTDISKSOLID', 'IFCBUILDINGSTOREY']) assert.ok(r.texto.includes(t), t);
  // sem armaduras: nenhuma barra
  const s = exportarIfc(p, registro, { armaduras: false, data: DATA });
  assert.ok(!s.contagem.IFCREINFORCINGBAR);
  // exportar de novo dá o mesmo arquivo (identificadores estáveis)
  assert.equal(exportarIfc(p, registro, { versao: 'teste', data: DATA }).texto, r.texto);
});

test('IFC: ida e volta pelo importador — pavimentos, pilares, vigas e lajes nas mesmas posições', () => {
  const p = exemplo('sobrado-garagem');
  const r = exportarIfc(p, registro, { data: DATA });
  const m = lerIfc(r.texto);
  assert.equal(m.esquema, 'IFC4');
  assert.equal(m.unidade, 'm');
  assert.deepEqual(m.pavimentos.map((x) => x.cota), [...p.pavimentos].sort((a, b) => a.cota - b.cota).map((x) => x.cota));
  const cat = (c) => m.elementos.filter((e) => e.categoria === c);
  assert.equal(cat('pilar').length, p.elementos.filter((e) => /pilar$/.test(e.modulo) && e.posicao).length);
  assert.equal(cat('viga').length, p.elementos.filter((e) => /viga$/.test(e.modulo) && e.posicao).length);
  assert.equal(cat('laje').length, p.elementos.filter((e) => /laje|entrepiso/.test(e.modulo) && e.posicao).length);
  // cada pilar: centro e topo do lance
  const pav = (id) => p.pavimentos.find((x) => x.id === id);
  for (const pl of p.elementos.filter((e) => e.modulo === 'concreto.pilar')) {
    const c = cat('pilar').find((x) => x.nome === pl.codigo);
    assert.ok(c, pl.codigo);
    const cx = c.contorno.reduce((s, q) => s + q[0], 0) / c.contorno.length, cy = c.contorno.reduce((s, q) => s + q[1], 0) / c.contorno.length;
    assert.ok(Math.abs(cx - pl.posicao.x) < 1e-3 && Math.abs(cy - pl.posicao.y) < 1e-3, `${pl.codigo}: centro`);
    assert.ok(Math.abs(c.z1 - pav(pl.posicao.pavimento).cota) < 1e-3, `${pl.codigo}: topo`);
  }
});

test('IFC: viga com seção por vão vira um sólido por vão, cada um no seu nível', () => {
  const p = exemplo('sobrado-garagem');
  const m = modeloIfcDoProjeto(p, registro);
  const v = m.elementos.find((e) => e.nome === 'V202');
  assert.equal(v.solidos.length, 2);
  const z0 = v.solidos.map((s) => s.origem[2]), topo = v.solidos.map((s) => s.origem[2] + s.prof);
  assert.ok(z0[1] > z0[0] && topo[1] > topo[0], 'vão 2 invertido: sobe acima do piso');
  const v105 = m.elementos.find((e) => e.nome === 'V105');
  const alturas = v105.solidos.map((s) => Math.round(s.prof * 100));
  assert.equal(new Set(alturas).size, 2, `alturas ${alturas}`);
  assert.ok(v105.solidos.every((s) => Math.abs(s.origem[2] + s.prof - 3) < 1e-9), 'vãos normais com o topo no piso');
});

test('IFC: telhado agregado (peças, telhas e oitões sobre o prédio) e fundações', () => {
  const p = exemplo('sobrado-garagem');
  const m = modeloIfcDoProjeto(p, registro);
  const th = m.elementos.find((e) => e.classe === 'IFCROOF');
  assert.ok(th.partes.length > 50);
  const xs = th.partes.flatMap((q) => q.solidos.map((s) => s.origem[0]));
  assert.ok(Math.min(...xs) > -1 && Math.max(...xs) < 9, 'telhado dentro da projeção do sobrado (0 a 8 m em x)');
  assert.ok(m.elementos.filter((e) => e.classe === 'IFCFOOTING').every((e) => e.solidos[0].origem[2] < 0), 'sapatas abaixo do térreo');
  const r = escreverIfc({ ...m, data: DATA });
  assert.ok(r.contagem.IFCMEMBER > 0 && r.contagem.IFCFOOTING > 0 && r.contagem.IFCSTAIR === 1);
});
