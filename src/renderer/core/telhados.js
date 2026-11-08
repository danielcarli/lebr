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
/** Telhado de madeira sobre o pavimento mais alto: contorno das vigas, cumeeira no sentido mais comprido. */
import { novoId, proximoCodigo } from './projeto.js';
import { pavimentosOrdenados, eixoViga, aplicarLigacoes, detectarLigacoes } from './montagem.js';
import { criarTelhado } from '../../modules/madeira-telhado/calculo.js';
import { criarTesoura } from '../../modules/madeira-tesoura/calculo.js';

/**
 * Cria um telhado de duas águas (com a tesoura típica ligada) apoiado nas vigas de contorno do pavimento mais alto que
 * tem vigas de concreto. O vão é a menor dimensão do contorno; a cumeeira corre na maior.
 * @returns {{telhado:string, tesoura:string, ligacoes:number}|null}
 */
export function criarTelhadoNaCobertura(projeto, registro) {
  const pavs = pavimentosOrdenados(projeto).filter((p) => p.tipo !== 'baldrame').reverse();
  for (const pav of pavs) {
    const vigas = projeto.elementos.filter((e) => e.modulo === 'concreto.viga' && e.posicao?.pavimento === pav.id);
    if (!vigas.length) continue;
    if (projeto.elementos.some((e) => e.modulo === 'madeira.telhado' && e.posicao?.pavimento === pav.id)) return null;
    const pts = vigas.flatMap((v) => { const e = eixoViga(v); return [e.a, e.b]; });
    const x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0]));
    const y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
    const Lx = x1 - x0, Ly = y1 - y0;
    if (!(Lx > 0.5 && Ly > 0.5)) continue;
    const vaoX = Lx <= Ly;                          // vão na direção x: cumeeira ao longo de y
    const vao = vaoX ? Lx : Ly, comp = vaoX ? Ly : Lx;
    const paineis = Math.max(2, 2 * Math.round(vao / 2 / 1.8));
    const idT = novoId('th'), idS = novoId('ts');
    const tel = { id: idT, modulo: 'madeira.telhado', codigo: proximoCodigo(projeto, 'TH'), nome: 'Telhado de madeira', ...criarTelhado(projeto),
      vao: Math.round(vao * 100) / 100, comprimento: Math.round(comp * 100) / 100, paineis,
      posicao: vaoX ? { pavimento: pav.id, x: x0, y: y0, angulo: 0 } : { pavimento: pav.id, x: x1, y: y0, angulo: 90 }, resultado: null };
    projeto.elementos.push(tel);
    projeto.elementos.push({ id: idS, modulo: 'madeira.tesoura', codigo: proximoCodigo(projeto, 'TS'), nome: `Tesoura de ${tel.codigo}`, ...criarTesoura(projeto),
      classe: tel.classe, telhadoId: idT, geometria: { tipo: 'howe', vao: tel.vao, inclinacao: tel.inclinacao, paineis }, resultado: null });
    const n = aplicarLigacoes(projeto, detectarLigacoes(projeto, registro).filter((l) => l.fonte.id === idT));
    return { telhado: idT, tesoura: idS, ligacoes: n };
  }
  return null;
}
