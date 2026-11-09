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
 * Converter uma laje em outro tipo (0.65): maciça, treliçada, nervurada ou alveolar. O contorno na planta, o código,
 * o nome, as bordas, as cargas de uso e as exceções do elemento ficam; os dados próprios do tipo novo começam pelo
 * padrão do módulo, com a altura pré-dimensionada pelo vão. As ligações da laje com as vigas são refeitas, porque
 * os nomes das bordas mudam entre as lajes em duas direções (x0, x1, y0, y1) e as em uma direção (apoio-a, apoio-b).
 */
import { dimensoesLaje, detectarLigacoes, aplicarLigacoes } from './montagem.js';
import { sugerirLaje } from './predimensionamento.js';

/** Tipos de laje entre os quais se converte, na ordem do menu. */
export const TIPOS_LAJE = [
  { modulo: 'concreto.laje.macica', nome: 'Laje maciça', dica: 'Concreto moldado no local, em uma ou duas direções; altura por Lx/40' },
  { modulo: 'concreto.laje.trelicada', nome: 'Laje treliçada', dica: 'Vigotas treliçadas com enchimento, armada no menor vão' },
  { modulo: 'concreto.laje.nervurada', nome: 'Laje nervurada', dica: 'Nervuras com cubetas, em duas direções (ou em x); boa para vãos maiores' },
  { modulo: 'concreto.laje.alveolar', nome: 'Laje alveolar', dica: 'Painéis protendidos de catálogo no maior comprimento; confira MRd, VRd e EI do fabricante' },
];

const UMA_DIRECAO = new Set(['concreto.laje.trelicada', 'concreto.laje.alveolar']);
const r2 = (v) => Math.round(v * 100) / 100;

/** Tipos para os quais a laje pode ser convertida (todos menos o atual), com os que o registro conhece. */
export function tiposParaConverter(el, registro = null) {
  return TIPOS_LAJE.filter((t) => t.modulo !== el?.modulo && (!registro || registro.obter(t.modulo)?.criar));
}

/** Altura inicial do tipo novo pelo menor vão (cm), seguindo as regras práticas de cada sistema. */
function alturaInicial(novo, el, menor) {
  if (novo.modulo === 'concreto.laje.macica') { const s = sugerirLaje(novo); if (s.h) novo.h = s.h; }
  else if (novo.modulo === 'concreto.laje.trelicada') { novo.he = novo.L > 5.5 ? 20 : novo.L > 4.5 ? 16 : 12; novo.hf = 4; }
  else if (novo.modulo === 'concreto.laje.nervurada') { novo.h = Math.max(20, Math.ceil((menor * 100) / 25 / 5 - 1e-9) * 5); novo.hf = Math.min(novo.hf ?? 5, novo.h - 10); }
  void el;
}

/**
 * Converte, no lugar, a laje `id` para o módulo `moduloNovo`.
 * @returns {{ de:string, para:string, removidas:number, ligacoes:number, receptores:string[], direcao:string|null, concentradas:number }}
 */
export function converterLaje(projeto, id, moduloNovo, registro) {
  const i = projeto.elementos.findIndex((e) => e.id === id);
  if (i < 0) throw new Error('Laje não encontrada.');
  const el = projeto.elementos[i];
  const modVelho = registro.obter(el.modulo), modNovo = registro.obter(moduloNovo);
  if (!modNovo?.criar) throw new Error(`Tipo de laje desconhecido: ${moduloNovo}.`);
  if (el.modulo === moduloNovo) return { de: el.modulo, para: moduloNovo, removidas: 0, ligacoes: 0, receptores: [], direcao: null, concentradas: 0 };
  const { lx, ly } = dimensoesLaje(el);
  const menor = Math.min(lx, ly);
  const novo = modNovo.criar();
  // o que não é próprio do tipo antigo (código, nome, posição, exceções de concreto e cobrimento, furos…) fica
  const proprios = new Set(Object.keys(modVelho?.criar?.() ?? {}).concat(['resultado', 'modulo', 'lx', 'ly', 'L', 'largura', 'direcao', 'vinculo', 'cargasConcentradas', 'planta']));
  // cargas concentradas só a laje maciça calcula (punção e momentos locais): saem e o aviso diz quantas
  const concentradas = moduloNovo === 'concreto.laje.macica' ? 0 : (Array.isArray(el.cargasConcentradas) ? el.cargasConcentradas.length : 0);
  for (const [k, v] of Object.entries(el)) if (!proprios.has(k)) novo[k] = structuredClone(v);
  novo.id = el.id; novo.modulo = moduloNovo;
  // contorno igual ao de antes
  let direcao = null;
  if (UMA_DIRECAO.has(moduloNovo)) {
    if (moduloNovo === 'concreto.laje.alveolar') { novo.L = r2(lx); novo.largura = r2(ly); delete novo.direcao; direcao = 'x'; }
    else {
      direcao = el.direcao === 'x' || el.direcao === 'y' ? el.direcao : lx <= ly ? 'x' : 'y';
      novo.direcao = direcao;
      if (direcao === 'y') { novo.L = r2(ly); novo.largura = r2(lx); } else { novo.L = r2(lx); novo.largura = r2(ly); }
    }
  } else {
    novo.lx = r2(lx); novo.ly = r2(ly);
    if (moduloNovo === 'concreto.laje.nervurada') { direcao = el.direcao === 'x' ? 'x' : 'duas'; novo.direcao = direcao; }
  }
  // bordas da planta (apoiada, engastada, livre) e cargas de uso ficam
  if (el.bordas && typeof el.bordas === 'object') novo.bordas = { ...novo.bordas, ...structuredClone(el.bordas) };
  if (el.cargas && typeof el.cargas === 'object') novo.cargas = { ...novo.cargas, ...structuredClone(el.cargas) };
  if (el.pesoProprio != null && 'pesoProprio' in novo) novo.pesoProprio = el.pesoProprio;
  alturaInicial(novo, el, menor);
  projeto.elementos[i] = novo;
  // ligações: as cargas desta laje nas vigas saem e voltam pelas bordas do tipo novo
  let removidas = 0;
  const receptores = new Set();
  for (const r of projeto.elementos) {
    if (!Array.isArray(r.cargas)) continue;
    const antes = r.cargas.length;
    r.cargas = r.cargas.filter((c) => !(c?.tipo === 'elemento' && c.elementoId === id));
    if (r.cargas.length !== antes) { removidas += antes - r.cargas.length; receptores.add(r.codigo ?? r.id); if (r.resultado) r.resultado.desatualizado = true; }
  }
  const det = detectarLigacoes(projeto, registro).filter((l) => l.fonte?.id === id);
  const n = aplicarLigacoes(projeto, det);
  for (const l of det) { const r = projeto.elementos.find((e) => e.id === l.receptor?.id); if (r) receptores.add(r.codigo ?? r.id); }
  if (moduloNovo === 'concreto.laje.macica' && Array.isArray(el.cargasConcentradas)) novo.cargasConcentradas = structuredClone(el.cargasConcentradas);
  return { de: el.modulo, para: moduloNovo, removidas, ligacoes: n, receptores: [...receptores], direcao, concentradas };
}
