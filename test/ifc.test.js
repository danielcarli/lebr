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
/** Etapa L15: importar IFC (mínimo) — pavimentos, pilares, lajes e as paredes como cargas pela L12. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarProjeto } from '../src/renderer/core/projeto.js';
import { MODULOS_CALCULO } from '../src/validacao/calculos.js';
import { lerIfc, lerStep, menorRetangulo } from '../src/engine/ifc.js';
import { planoIfc, aplicarIfc, secaoDoContorno } from '../src/renderer/core/importar-ifc.js';
import { segmentosDoFundo, paredesDeSegmentos, camadasProvaveis } from '../src/renderer/core/paredes.js';
import { transformacaoFundo, plantaDe } from '../src/renderer/views/montagem-fundo.js';
import { verificarConsistencia } from '../src/renderer/core/consistencia.js';
import { gerarIfc } from './fixtures/ifc/gerar-ifc.mjs';

const reg = { obter: (id) => MODULOS_CALCULO[id] };
const perto = (a, b, msg, tol = 1e-3) => assert.ok(Math.abs(a - b) < tol, `${msg}: ${a} ≠ ${b}`);

test('L15: STEP — textos com apóstrofo e acentos codificados, referências, enumerações e tipados', () => {
  const m = lerStep(`ISO-10303-21;\nHEADER;\nFILE_NAME('a.ifc','',(''),(''),'x','Revit','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n#1=IFCLABEL('D''\\X2\\00C1\\X0\\gua; ok');\n#2 = IFCX(#1,.T.,$,*,(1.5,-2.E-1),IFCLENGTHMEASURE(3.));\nENDSEC;`);
  assert.equal(m.esquema, 'IFC4');
  assert.equal(m.aplicativo, 'Revit');
  assert.deepEqual(m.arg(1), ["D'Água; ok"]);
  assert.deepEqual(m.arg(2), [{ r: 1 }, { e: 'T' }, null, null, [1.5, -0.2], { tipo: 'IFCLENGTHMEASURE', v: 3 }]);
});

test('L15: retângulo de menor área de um contorno girado 30°', () => {
  const a = (30 * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const pts = [[-1, -0.5], [1, -0.5], [1, 0.5], [-1, 0.5]].map(([x, y]) => [5 + x * c - y * s, 3 + x * s + y * c]);
  const r = menorRetangulo(pts);
  perto(r.a * r.b, 2, 'área');
  perto(Math.max(r.a, r.b), 2, 'lado');
  const sec = secaoDoContorno(pts);
  perto(sec.centro[0], 5, 'x'); perto(sec.centro[1], 3, 'y');
  perto(sec.a, 2, 'bx'); perto(sec.b, 1, 'by'); perto(sec.angulo, 30, 'ângulo', 0.01);
});

test('L15: modelo do Revit (mm, coordenadas de levantamento) — níveis, pilares, lajes, paredes e viga', () => {
  const m = lerIfc(gerarIfc());
  assert.equal(m.unidade, 'mm');
  assert.deepEqual(m.pavimentos.map((p) => [p.nome, p.cota]), [['Térreo', 0], ['1º pavimento', 3], ['Cobertura', 6]]);
  const cat = (c) => m.elementos.filter((e) => e.categoria === c);
  assert.equal(cat('pilar').length, 12);
  assert.equal(cat('laje').length, 3);
  assert.equal(cat('parede').length, 3);
  assert.equal(cat('viga').length, 1);
  assert.ok(m.elementos.every((e) => !e.ignorado));
  const v = cat('viga')[0];
  perto(v.z1, 3, 'topo da viga'); perto(v.z0, 2.6, 'fundo da viga');
});

test('L15: num projeto novo, entra com as cotas e os pilares no lugar; lajes retangulares viram laje maciça', () => {
  const p = criarProjeto();
  const plano = planoIfc(p, lerIfc(gerarIfc()));
  assert.deepEqual(plano.deslocamento, [-712345, -6712345].map((v) => v), 'trazido para perto da origem');
  const r = aplicarIfc(p, reg, plano, { nomeArquivo: 'predio-revit.ifc' });
  assert.equal(r.pilares, 12);
  assert.equal(r.lajes, 2);
  assert.deepEqual(p.pavimentos.map((x) => [x.nome, x.cota]), [['Térreo', 0], ['1º pavimento', 3], ['Cobertura', 6]]);
  const pav = (nome) => p.pavimentos.find((x) => x.nome === nome).id;
  const pils = (nome) => p.elementos.filter((e) => e.modulo === 'concreto.pilar' && e.posicao.pavimento === pav(nome));
  assert.equal(pils('1º pavimento').length, 6);
  assert.equal(pils('Cobertura').length, 6);
  const em = (nome, x, y) => pils(nome).find((e) => Math.hypot(e.posicao.x - x, e.posicao.y - y) < 0.01);
  // P1 20 × 40 no canto (0, 0); P2 girado 90° pela posição → 40 × 20 sem ângulo; P5 circular ø 30; P6 por item mapeado
  const p1 = em('1º pavimento', 0, 0);
  assert.deepEqual([p1.bx, p1.by, p1.posicao.angulo, p1.comprimento], [20, 40, 0, 3]);
  const p2 = em('1º pavimento', 5, 0);
  assert.deepEqual([p2.bx, p2.by, p2.posicao.angulo], [40, 20, 0]);
  const p5 = em('Cobertura', 2.5, 4);
  assert.equal(p5.forma, 'circular'); assert.equal(p5.D, 30);
  assert.ok(em('1º pavimento', 2.5, 0), 'pilar do item mapeado em (2,5; 0)');
  assert.ok(pils('1º pavimento').every((e) => e.cargas.every((c) => c.tipo === 'elemento')), 'sem a carga de exemplo do módulo');
  // os pilares da cobertura descarregam nos do 1º pavimento
  const p1c = em('Cobertura', 0, 0);
  assert.ok(p1.cargas.some((c) => c.elementoId === p1c.id), 'continuidade do pilar');
  // códigos por pavimento num projeto que começou vazio
  assert.match(p1.codigo, /^P1\d\d$/);
  // laje: 5,2 × 4,2 m, 12 cm, canto em (−0,1; −0,1)
  const lajes = p.elementos.filter((e) => e.modulo === 'concreto.laje.macica');
  assert.equal(lajes.length, 2);
  const l = lajes.find((e) => e.posicao.pavimento === pav('1º pavimento'));
  assert.deepEqual([l.lx, l.ly, l.h, l.posicao.x, l.posicao.y, l.posicao.angulo], [5.2, 4.2, 12, -0.1, -0.1, 0]);
  assert.deepEqual(plano.lajes.filter((x) => !x.criar).map((x) => x.motivo), ['contorno recortado']);
  // só os do 1º lance ficam sem continuidade (falta a fundação); os da cobertura descem nos de baixo
  const sem = verificarConsistencia(p, reg).filter((x) => x.regra === 'pilar-sem-continuidade').map((x) => x.elemento.codigo);
  assert.equal(sem.length, 6);
  assert.ok(sem.every((c) => /^P1/.test(c)), sem.join(' '));
});

test('L15: as paredes do IFC ficam na planta de fundo do térreo e a L12 acha as três de 14 cm', () => {
  const p = criarProjeto();
  aplicarIfc(p, reg, planoIfc(p, lerIfc(gerarIfc())), { nomeArquivo: 'predio-revit.ifc' });
  const terreo = p.pavimentos.find((x) => x.nome === 'Térreo');
  const planta = plantaDe(p, terreo);
  assert.ok(planta, 'planta de fundo do térreo');
  const { aplicar } = transformacaoFundo(terreo, planta);
  assert.equal(camadasProvaveis(planta, aplicar)[0].nome, 'IFC-PAREDES');
  const paredes = paredesDeSegmentos(segmentosDoFundo(planta, aplicar, ['IFC-PAREDES']));
  assert.equal(paredes.length, 3);
  for (const w of paredes) perto(w.espessura, 0.14, 'espessura');
  // a viga do 1º pavimento está no fundo dele
  const pv1 = p.pavimentos.find((x) => x.nome === '1º pavimento');
  const pl1 = plantaDe(p, pv1);
  assert.equal(pl1.entidades.filter((e) => pl1.camadas[e.c] === 'IFC-VIGAS').length, 1);
});

test('L15: num projeto com pavimentos, os níveis de mesma cota são reaproveitados', () => {
  const p = criarProjeto();
  p.pavimentos = [{ id: 'a', nome: 'Primeiro', cota: 3 }];
  p.elementos.push({ id: 'x', modulo: 'concreto.pilar', codigo: 'P99', nome: 'P99', ...MODULOS_CALCULO['concreto.pilar'].criar(), cargas: [], posicao: { pavimento: 'a', x: 50, y: 50, angulo: 0 } });
  const plano = planoIfc(p, lerIfc(gerarIfc()));
  assert.equal(plano.niveis.find((n) => n.cota === 3).pavimento, 'a');
  aplicarIfc(p, reg, plano);
  assert.deepEqual(p.pavimentos.map((x) => x.nome).sort(), ['Cobertura', 'Primeiro', 'Térreo']);
  assert.ok(p.elementos.some((e) => e.codigo === 'P99'), 'o projeto não é renumerado');
});
