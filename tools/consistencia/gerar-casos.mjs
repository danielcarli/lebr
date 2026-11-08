/*
 * LEBR — Laboratório de Estruturas Brasil
 * Copyright (C) 2026 Daniel Michelon De Carli
 *
 * Feito com uso da inteligência artificial Claude Opus 5.5, sob a orientação de Daniel Michelon De Carli.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * Gera os projetos de teste do painel de problemas (roteiro, etapa L2): um modelo correto de dois pavimentos e um
 * arquivo por defeito, cada um com exatamente um problema. Uso: node tools/consistencia/gerar-casos.mjs
 */
import fs from 'node:fs';
import { criarProjeto, serializar } from '../../src/renderer/core/projeto.js';
import { detectarLigacoes, aplicarLigacoes } from '../../src/renderer/core/montagem.js';
import { MODULOS_CALCULO } from '../../src/validacao/calculos.js';

const reg = { obter: (id) => MODULOS_CALCULO[id] };
const DESTINO = new URL('../../test/fixtures/consistencia/', import.meta.url);

function base() {
  const p = criarProjeto({ nome: 'Consistência — modelo correto', autor: 'LEBR (teste)' });
  p.meta.criadoEm = p.meta.modificadoEm = '2026-11-07T00:00:00.000Z';
  p.pavimentos = [{ id: 'ter', nome: 'Térreo', cota: 3 }, { id: 'p1', nome: '1º pavimento', cota: 6 }];
  const add = (modulo, codigo, extra) => {
    const e = { id: codigo.toLowerCase(), modulo, codigo, nome: codigo, ...reg.obter(modulo).criar(), ...extra };
    p.elementos.push(e);
    return e;
  };
  const cantos = [[0, 0], [4, 0], [4, 5], [0, 5]];
  cantos.forEach(([x, y], i) => add('concreto.pilar', `P${i + 1}`, { bx: 20, by: 20, comprimento: 3, posicao: { pavimento: 'ter', x, y, angulo: 0 } }));
  cantos.forEach(([x, y], i) => add('concreto.pilar', `P${i + 5}`, { bx: 20, by: 20, comprimento: 3, posicao: { pavimento: 'p1', x, y, angulo: 0 } }));
  add('concreto.viga', 'V1', { vaos: [{ L: 4 }], apoios: ['apoio', 'apoio'], posicao: { pavimento: 'p1', x: 0, y: 0, angulo: 0 } });
  add('concreto.viga', 'V2', { vaos: [{ L: 4 }], apoios: ['apoio', 'apoio'], posicao: { pavimento: 'p1', x: 0, y: 5, angulo: 0 } });
  add('concreto.viga', 'V3', { vaos: [{ L: 5 }], apoios: ['apoio', 'apoio'], posicao: { pavimento: 'p1', x: 0, y: 0, angulo: 90 } });
  add('concreto.viga', 'V4', { vaos: [{ L: 5 }], apoios: ['apoio', 'apoio'], posicao: { pavimento: 'p1', x: 4, y: 0, angulo: 90 } });
  add('concreto.laje.macica', 'L1', { lx: 4, ly: 5, posicao: { pavimento: 'p1', x: 0, y: 0, angulo: 0 } });
  aplicarLigacoes(p, detectarLigacoes(p, reg));
  return p;
}
const el = (p, c) => p.elementos.find((e) => e.codigo === c);

const CASOS = {
  'modelo-correto': () => {},
  // um pilar no 1º pavimento longe de tudo: não apoia em nada e nada apoia nele
  'elemento-solto': (p) => { p.elementos.push({ ...structuredClone(el(p, 'P5')), id: 'p9', codigo: 'P9', nome: 'P9', cargas: [], posicao: { pavimento: 'p1', x: 9, y: 9, angulo: 0 } }); },
  // V5 sai de P6 e termina no ar, 3 m adiante
  'viga-sem-apoio': (p) => {
    const v = { ...structuredClone(el(p, 'V1')), id: 'v5', codigo: 'V5', nome: 'V5', vaos: [{ L: 3 }], posicao: { pavimento: 'p1', x: 4, y: 0, angulo: 0 } };
    v.cargas = v.cargas.filter((c) => c.tipo !== 'elemento');
    p.elementos.push(v);
    el(p, 'P6').cargas.push({ id: 'cv5', tipo: 'elemento', elementoId: 'v5', ligacao: 'apoio-0', descricao: 'V5' });
  },
  // sem a V2, a borda superior da L1 fica sem viga
  'laje-contorno-aberto': (p) => {
    p.elementos = p.elementos.filter((e) => e.codigo !== 'V2');
    for (const e of p.elementos) if (Array.isArray(e.cargas)) e.cargas = e.cargas.filter((c) => c.elementoId !== 'v2');
  },
  // V5 é uma cópia da V1 no mesmo lugar, ligada aos mesmos pilares e à mesma laje
  sobreposicao: (p) => {
    const v = { ...structuredClone(el(p, 'V1')), id: 'v5', codigo: 'V5', nome: 'V5' };
    p.elementos.push(v);
    aplicarLigacoes(p, detectarLigacoes(p, reg));
  },
  // sem o P1 no térreo, o P5 de cima nasce no ar
  'pilar-sem-continuidade': (p) => {
    p.elementos = p.elementos.filter((e) => e.codigo !== 'P1');
    for (const e of p.elementos) if (Array.isArray(e.cargas)) e.cargas = e.cargas.filter((c) => c.elementoId !== 'p1');
  },
  // V5 (horizontal) e V6 (vertical) se apoiam nas vigas do contorno e se cruzam no meio da laje, sem definição
  'cruzamento-indefinido': (p) => {
    const nova = (id, x, y, ang, L) => { const v = { ...structuredClone(el(p, 'V1')), id, codigo: id.toUpperCase(), nome: id.toUpperCase(), vaos: [{ L }], posicao: { pavimento: 'p1', x, y, angulo: ang } }; v.cargas = v.cargas.filter((c) => c.tipo !== 'elemento'); p.elementos.push(v); };
    nova('v5', 0, 2.5, 0, 4);
    nova('v6', 2, 0, 90, 5);
  },
  // a V1 guarda a carga de um elemento que foi excluído
  'carga-inexistente': (p) => { el(p, 'V1').cargas.push({ id: 'cx', tipo: 'elemento', elementoId: 'l99', ligacao: 'y0', vao: 'todos', descricao: 'L99' }); },
};

for (const [nome, defeito] of Object.entries(CASOS)) {
  const p = base();
  defeito(p);
  p.meta.nome = nome === 'modelo-correto' ? p.meta.nome : `Consistência — ${nome}`;
  fs.writeFileSync(new URL(`${nome}.lebr.json`, DESTINO), serializar(p).replace(/"modificadoEm": "[^"]*"/, '"modificadoEm": "2026-11-07T00:00:00.000Z"'));
  console.log(nome);
}
