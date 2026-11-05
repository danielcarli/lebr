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
/** Exportação DXF: gravador R12, camadas, cotas que conferem com a montagem e pranchas de armação. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lerProjeto } from '../src/renderer/core/projeto.js';
import { calcularElemento } from '../src/renderer/core/calculo.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { Dxf, lerDxf, textoCad } from '../src/engine/dxf.js';
import { gerarPranchas, plantaDeFormas, plantaDeLocacao, pilaresNaFundacao } from '../src/modules/comum/pranchas.js';

const reg = { obter: (id) => MODULOS_CALCULO[id] };
const ordem = { sondagens: -1, lajes: 0, escadas: 0.5, reservatorios: 0.6, vigas: 1, pilares: 2, fundacoes: 3 };
function calculado(arq) {
  const p = lerProjeto(fs.readFileSync(new URL(`../exemplos/${arq}`, import.meta.url), 'utf8'));
  for (const e of [...p.elementos].sort((a, b) => (ordem[MODULOS_CALCULO[a.modulo].categoria] ?? 5) - (ordem[MODULOS_CALCULO[b.modulo].categoria] ?? 5))) e.resultado = calcularElemento(e, p, reg);
  return p;
}
const textos = (d, camada) => d.entidades.filter((e) => e.tipo === 'TEXT' && (!camada || e.g['8'][0] === camada)).map((e) => e.g['1'][0]);

test('gravador R12: seções, só as camadas usadas, texto em ANSI e %%c para o diâmetro', () => {
  const d = new Dxf();
  d.camada('A', { cor: 1, linha: 'CENTER' }).camada('B', { cor: 3 }).camada('VAZIA');
  d.linha('A', [0, 0], [100, 0]).retangulo('B', [0, 0], [20, 30]).circulo('B', [10, 10], 2).texto('B', [0, 0], 'N1 · 2 ø 10 — C = 440', { alinhar: 'centro' });
  const s = d.toString();
  assert.ok(s.includes('AC1009') && s.includes('ANSI_1252') && s.trim().endsWith('EOF'));
  const r = lerDxf(s);
  assert.deepEqual(r.camadas.sort(), ['0', 'A', 'B']);
  assert.equal(r.entidades.filter((e) => e.tipo === 'LINE').length, 1);
  assert.equal(r.entidades.filter((e) => e.tipo === 'POLYLINE').length, 1);
  assert.equal(r.vertices.length, 4);
  assert.equal(textos(r)[0], 'N1 . 2 %%c 10 - C = 440');
  assert.ok([...s].every((c) => c.charCodeAt(0) <= 0xff), 'cabe em latin1');
  assert.equal(textoCad('ø ≤ ≥ °'), '%%c <= >= %%d');
});

test('planta de fôrmas: pilares, vigas e lajes do pavimento, camadas separadas e cotas iguais às distâncias da montagem', () => {
  const p = calculado('edificio-3-pavimentos.lebr.json');
  const pav = p.pavimentos.find((x) => x.id === 'pav1');
  const r = lerDxf(plantaDeFormas(p, pav, { versao: 'teste' }).toString());
  for (const c of ['EIXOS', 'PILARES', 'VIGAS', 'LAJES', 'COTAS', 'TEXTOS', 'NIVEIS', 'CARIMBO']) assert.ok(r.camadas.includes(c), c);
  const doPav = (m) => p.elementos.filter((e) => e.modulo === m && e.posicao?.pavimento === 'pav1');
  const polis = (c) => r.entidades.filter((e) => e.tipo === 'POLYLINE' && e.g['8'][0] === c).length;
  assert.equal(polis('PILARES'), doPav('concreto.pilar').length);
  assert.equal(polis('VIGAS'), doPav('concreto.viga').length);
  assert.ok(polis('LAJES') >= doPav('concreto.laje.macica').length);
  const t = textos(r, 'TEXTOS');
  for (const e of [...doPav('concreto.pilar'), ...doPav('concreto.viga')]) assert.ok(t.some((x) => x.startsWith(e.codigo)), e.codigo);
  // cotas entre eixos de pilares = diferenças das coordenadas da montagem (cm)
  const xs = [...new Set(doPav('concreto.pilar').map((e) => Math.round(e.posicao.x * 100)))].sort((a, b) => a - b);
  const esperadas = xs.slice(1).map((x, i) => String(x - xs[i]));
  const cotas = textos(r, 'COTAS');
  for (const c of esperadas) assert.ok(cotas.includes(c), `cota ${c}`);
  assert.ok(cotas.includes(String(xs.at(-1) - xs[0])), 'cota total');
  assert.ok(textos(r, 'NIVEIS').some((x) => x.includes('+3,00')));
});

test('locação: todos os pilares que chegam à fundação, com a tabela de cargas', () => {
  const p = calculado('edificio-3-pavimentos.lebr.json');
  const pils = pilaresNaFundacao(p);
  assert.ok(pils.length >= 9 && pils.every((x) => x.codigo.startsWith('PB')));
  const r = lerDxf(plantaDeLocacao(p, { versao: 'teste' }).toString());
  const t = textos(r);
  for (const x of pils) {
    assert.ok(t.includes(x.codigo));
    const nk = (x.resultado.Nk.g + x.resultado.Nk.q).toFixed(1).replace('.', ',');
    assert.ok(t.includes(nk), `${x.codigo}: Nk ${nk}`);
  }
  assert.ok(r.camadas.includes('FUNDACOES'));
});

test('pranchas do projeto: fôrmas por pavimento, locação e armação de vigas, pilares e lajes, com tabela de aço', () => {
  const p = calculado('edificio-3-pavimentos.lebr.json');
  const arqs = gerarPranchas(p, { versao: 'teste' });
  const nomes = arqs.map((a) => a.nome);
  assert.equal(nomes.filter((n) => n.includes('Formas')).length, p.pavimentos.length);
  for (const k of ['Locacao dos pilares', 'Armacao das vigas', 'Armacao dos pilares', 'Armacao das lajes']) assert.ok(nomes.some((n) => n.includes(k)), k);
  for (const a of arqs) {
    assert.ok([...a.conteudo].every((c) => c.charCodeAt(0) <= 0xff), a.nome);
    assert.ok(a.entidades > 10);
  }
  const vigas = lerDxf(arqs.find((a) => a.nome.includes('Armacao das vigas')).conteudo);
  const tv = textos(vigas);
  for (const v of p.elementos.filter((e) => e.modulo === 'concreto.viga')) assert.ok(tv.some((x) => x.startsWith(`${v.codigo} (`)), v.codigo);
  assert.ok(tv.some((x) => x.startsWith('TABELA DE AÇO')) && tv.some((x) => x.startsWith('RESUMO DO AÇO')));
  for (const c of ['ARMADURA-LONGITUDINAL', 'ARMADURA-NEGATIVA', 'ARMADURA-TRANSVERSAL', 'CONCRETO', 'TABELAS']) assert.ok(vigas.camadas.includes(c), c);
  // as edições da lista de ferros chegam ao DXF
  const v = p.elementos.find((e) => e.codigo === 'V101');
  const N1 = v.resultado.detalhamento.posicoes[0];
  v.detalhamento = { edicoes: { [N1.id]: { n: 7 } } };
  const t2 = textos(lerDxf(gerarPranchas(p, { formas: false, locacao: false, pilares: false, lajes: false }).at(0).conteudo));
  assert.ok(t2.some((x) => x.startsWith(`N1 7 %%c`)), 'N1 com 7 barras');
});
