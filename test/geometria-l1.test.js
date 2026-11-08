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
 * Lançamento, etapa L1: tolerância geométrica, fusão de nós e "Limpar geometria".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { criarProjeto, lerProjeto } from '../src/renderer/core/projeto.js';
import {
  detectarLigacoes, avisosMontagem, estadoMontagem, limparGeometria, folgasGeometricas, toleranciaGeometrica,
  distanciaAoPilar, eixoViga,
} from '../src/renderer/core/montagem.js';
import * as viga from '../src/modules/concreto-viga/calculo.js';
import * as pilar from '../src/modules/concreto-pilar/calculo.js';

const registro = {
  mods: { 'concreto.viga': { categoria: 'vigas', ...viga }, 'concreto.pilar': { categoria: 'pilares', ...pilar } },
  obter(id) { return this.mods[id]; },
};
const perto = (a, b, msg, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${msg}: ${a} ≠ ${b}`);

function projeto() {
  const p = criarProjeto();
  p.pavimentos = [{ id: 't', nome: 'Térreo', cota: 0 }, { id: 'p1', nome: '1º', cota: 3 }];
  return p;
}
const add = (p, mod, codigo, extra) => {
  const base = mod === 'concreto.viga' ? viga.criarViga() : pilar.criarPilar?.() ?? {};
  const e = { id: codigo.toLowerCase(), modulo: mod, codigo, nome: codigo, ...base, ...extra };
  p.elementos.push(e);
  return e;
};
const pil = (p, codigo, x, y, pav = 'p1') => add(p, 'concreto.pilar', codigo, { bx: 20, by: 20, comprimento: 3, posicao: { pavimento: pav, x, y, angulo: 0 } });
/** Viga entre dois pilares 20×20 em (0, 0) e (4,3, 0), com uma folga g (m) em cada face. */
function vigaComFolga(g) {
  const p = projeto();
  pil(p, 'P1', 0, 0); pil(p, 'P2', 4.3, 0);
  const v = add(p, 'concreto.viga', 'V1', { vaos: [{ L: 4.1 - 2 * g }], posicao: { pavimento: 'p1', x: 0.1 + g, y: 0, angulo: 0 } });
  return { p, v };
}
const vigaPilar = (p) => detectarLigacoes(p, registro).filter((d) => d.tipo === 'viga-pilar').map((d) => `${d.fonte.codigo}:${d.ligacao}→${d.receptor.codigo}`).sort();

test('tolerância geométrica: padrão de 1 mm, gravada nos parâmetros e acrescentada a projetos antigos', () => {
  assert.equal(criarProjeto().parametros.montagem.tolerancia, 1);
  perto(toleranciaGeometrica(criarProjeto()), 0.001, 'em m');
  const antigo = JSON.stringify({ formato: 'lebr.projeto', versao: 1, meta: { nome: 'x' }, parametros: {}, elementos: [] });
  assert.equal(lerProjeto(antigo).parametros.montagem.tolerancia, 1);
  const p = criarProjeto(); p.parametros.montagem.tolerancia = 5;
  perto(toleranciaGeometrica(p), 0.005, '5 mm');
});

test('distância à seção do pilar: zero dentro, distância à face fora', () => {
  const P = { modulo: 'concreto.pilar', bx: 20, by: 40, posicao: { pavimento: 't', x: 1, y: 1, angulo: 0 } };
  assert.equal(distanciaAoPilar([1.05, 1.15], P).d, 0);
  perto(distanciaAoPilar([1.1008, 1], P).d, 0.0008, 'face em x', 1e-12);
  perto(distanciaAoPilar([1, 1.205], P).d, 0.005, 'face em y', 1e-12);
});

test('viga terminando a 0,8 mm da face do pilar fica apoiada, sem aviso', () => {
  const { p } = vigaComFolga(0.0008);
  assert.deepEqual(vigaPilar(p), ['V1:apoio-0→P1', 'V1:apoio-1→P2']);
  assert.deepEqual(folgasGeometricas(p, registro), []);
});

test('com 5 mm de folga o apoio não é ligado e o programa avisa', () => {
  const { p, v } = vigaComFolga(0.005);
  assert.deepEqual(vigaPilar(p), []);
  const av = avisosMontagem(p, registro).filter((a) => a.folga);
  assert.equal(av.length, 2);
  assert.match(av[0].texto, /V1 · apoio 1 a 5,0 mm da face de P1 — mais que a tolerância de 1 mm/);
  assert.ok(av.every((a) => a.folga.encostar));
  const est = estadoMontagem(p, registro).get(v.id);
  assert.equal(est.estado, 'erro');
  assert.ok(est.problemas.some((t) => /5,0 mm/.test(t)));
});

test('limpar geometria leva os apoios até a face do pilar ao longo do eixo', () => {
  const { p, v } = vigaComFolga(0.0008);
  const feitas = limparGeometria(p, registro);
  assert.deepEqual(feitas.map((f) => f.tipo), ['estender', 'estender']);
  perto(v.posicao.x, 0.1, 'início na face de P1', 1e-6);
  perto(v.vaos[0].L, 4.1, 'fim na face de P2', 1e-6);
  assert.equal(v.posicao.angulo, 0, 'a viga não gira');
  assert.deepEqual(limparGeometria(p, registro), [], 'uma segunda limpeza não muda nada');
});

test('limpar geometria com 5 mm de folga: nada com 1 mm; com 6 mm encosta e a ligação aparece', () => {
  const { p, v } = vigaComFolga(0.005);
  assert.deepEqual(limparGeometria(p, registro), []);
  assert.equal(limparGeometria(p, registro, { tol: 0.006 }).length, 2);
  perto(v.posicao.x, 0.1, 'x', 1e-6); perto(v.vaos[0].L, 4.1, 'L', 1e-6);
  assert.deepEqual(vigaPilar(p), ['V1:apoio-0→P1', 'V1:apoio-1→P2']);
  assert.deepEqual(folgasGeometricas(p, registro), []);
});

test('encostar uma folga só: o filtro limita a limpeza ao apoio escolhido', () => {
  const { p, v } = vigaComFolga(0.005);
  const [f] = folgasGeometricas(p, registro);
  const feitas = limparGeometria(p, registro, { tol: f.distancia + 1e-6, filtro: (el, k) => el.id === f.elemento.id && k === f.apoio });
  assert.equal(feitas.length, 1);
  perto(v.posicao.x, 0.1, 'apoio 1 na face', 1e-6);
  assert.equal(folgasGeometricas(p, registro).length, 1, 'o outro apoio continua com folga');
});

test('nó que cai a menos da tolerância do eixo de outra viga: a viga chega até o eixo', () => {
  const p = projeto();
  add(p, 'concreto.viga', 'V1', { vaos: [{ L: 4 }], posicao: { pavimento: 'p1', x: 0, y: 0, angulo: 0 } });
  const v2 = add(p, 'concreto.viga', 'V2', { vaos: [{ L: 2.9994 }], posicao: { pavimento: 'p1', x: 2, y: 3, angulo: -90 } });
  const [f] = limparGeometria(p, registro);
  assert.equal(f.tipo, 'estender');
  assert.match(f.texto, /V2 · apoio 2 levado até o eixo de V1 · 0,6 mm/);
  perto(eixoViga(v2).b[1], 0, 'fim de V2 sobre o eixo de V1', 1e-6);
});

test('nós próximos se fundem: cada viga anda ao longo do próprio eixo e nenhuma gira', () => {
  const p = projeto();
  const v1 = add(p, 'concreto.viga', 'V1', { vaos: [{ L: 4 }], posicao: { pavimento: 'p1', x: 0, y: 0, angulo: 0 } });
  const v3 = add(p, 'concreto.viga', 'V3', { vaos: [{ L: 3 }], posicao: { pavimento: 'p1', x: 4.0005, y: 0.0003, angulo: 90 } });
  const feitas = limparGeometria(p, registro);
  assert.deepEqual(feitas.map((f) => f.tipo), ['fundir', 'fundir']);
  perto(v1.vaos[0].L, 4.0005, 'V1 chega ao nó', 1e-6);
  perto(v3.posicao.y, 0, 'V3 desce até o nó', 1e-6); perto(v3.vaos[0].L, 3.0003, 'o fim de V3 fica onde estava', 1e-6);
  assert.deepEqual(eixoViga(v1).b.map((x) => Math.round(x * 1e6)), eixoViga(v3).a.map((x) => Math.round(x * 1e6)), 'o mesmo nó');
  assert.equal(v1.posicao.angulo, 0); assert.equal(v3.posicao.angulo, 90);
  assert.deepEqual(limparGeometria(p, registro), []);
});

test('vigas em linha com o nó de lado: a viga anda de lado, sem girar', () => {
  const p = projeto();
  const v1 = add(p, 'concreto.viga', 'V1', { vaos: [{ L: 4 }], posicao: { pavimento: 'p1', x: 0, y: 0, angulo: 0 } });
  const v2 = add(p, 'concreto.viga', 'V2', { vaos: [{ L: 3 }], posicao: { pavimento: 'p1', x: 4.0005, y: 0.0003, angulo: 0 } });
  limparGeometria(p, registro);
  assert.deepEqual(eixoViga(v1).b.map((x) => Math.round(x * 1e6)), eixoViga(v2).a.map((x) => Math.round(x * 1e6)), 'o mesmo nó');
  assert.equal(v2.posicao.angulo, 0);
  assert.deepEqual(limparGeometria(p, registro), []);
});

test('pilar de cima a menos da tolerância do prumo do de baixo: alinha; a 4 mm, avisa', () => {
  const p = projeto();
  pil(p, 'P1', 1, 1, 't');
  const sup = pil(p, 'P1A', 1.0006, 1, 'p1');
  assert.equal(limparGeometria(p, registro)[0]?.tipo, 'prumo');
  assert.equal(sup.posicao.x, 1);
  sup.posicao.x = 1.004;
  const [f] = folgasGeometricas(p, registro);
  assert.match(f.texto, /P1A a 4,0 mm do prumo de P1 \(Térreo\)/);
});

test('projetos de exemplo não têm folgas nem nada a limpar', () => {
  for (const nome of fs.readdirSync(new URL('../exemplos/', import.meta.url)).filter((f) => f.endsWith('.lebr.json'))) {
    const p = lerProjeto(fs.readFileSync(new URL(`../exemplos/${nome}`, import.meta.url), 'utf8'));
    assert.deepEqual(folgasGeometricas(p, registro).map((f) => f.texto), [], nome);
    assert.equal(limparGeometria(structuredClone(p), registro).length, 0, nome);
  }
});

test('girar em torno do centro: o elemento fica no lugar e o ângulo volta a 0–360°', async () => {
  const { girarElemento, centroDoElemento } = await import('../src/renderer/core/montagem.js');
  const laje = { lx: 4, ly: 2, h: 10, posicao: { pavimento: 'p1', x: 1, y: 1, angulo: 0 } };
  const c0 = centroDoElemento(laje, 'laje');
  girarElemento(laje, 'laje', 90);
  const c1 = centroDoElemento(laje, 'laje');
  perto(c1[0], c0[0], 'x do centro', 1e-6); perto(c1[1], c0[1], 'y do centro', 1e-6);
  assert.equal(laje.posicao.angulo, 90);
  const v = { vaos: [{ L: 4 }], posicao: { pavimento: 'p1', x: 0, y: 0, angulo: 0 } };
  girarElemento(v, 'viga', -30);
  assert.equal(v.posicao.angulo, 330);
  const m = centroDoElemento(v, 'viga');
  perto(m[0], 2, 'meio da viga em x', 1e-6); perto(m[1], 0, 'meio da viga em y', 1e-6);
});
