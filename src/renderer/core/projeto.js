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
 * Formato aberto do projeto (JSON) — documentado em docs/FORMATO.md.
 *
 * O arquivo guarda os parâmetros globais e uma lista plana de elementos.
 * Cada elemento indica o módulo que o calcula (`modulo`), de modo que novos
 * tipos de laje, madeira ou aço entram no mesmo arquivo sem mudar o esquema.
 */

import { pavimentosPadrao } from './montagem.js';

export const FORMATO = 'lebr.projeto';
/** Identificadores antigos aceitos na leitura (o programa se chamava OpenLabViga). */
const FORMATOS_ANTIGOS = ['openlabviga.projeto'];
export const VERSAO_FORMATO = 1;

export function parametrosPadrao() {
  return {
    norma: 'NBR 6118:2023',
    classeAgressividade: 'II',
    concreto: { fck: 25, agregado: 'granito', pesoEspecifico: 25 },
    aco: { fyk: 500, Es: 210000 },
    agregadoDmax: 19,
    cobrimento: { viga: 3.0, pilar: 3.0, laje: 2.5 },
    coeficientes: { gc: 1.4, gs: 1.15, gg: 1.4, ggFav: 1.0, gq: 1.4, psi0: 0.5, psi1: 0.4, psi2: 0.3 },
    uso: 'residencial',
    els: { t0: 1 },
    // unidade de exibição das dimensões das seções (o arquivo e o cálculo continuam em cm)
    unidades: { comprimento: 'cm' },
    // análise global: esforços dos pilares pelas cargas dos elementos ou pelo pórtico espacial do edifício
    analiseGlobal: { pilares: 'elementos' },
    // vento (NBR 6123): forças por pavimento nas quatro direções, aplicadas no pórtico espacial
    vento: { ativo: false, V0: 45, referencia: '', topografia: 'plano', S1: 1, categoria: 'IV', classe: 'auto', grupo: 2, Ca: { x: null, y: null } },
    estabilidade: { desaprumo: true, rigidez: 'separada', contraventamento: 'porticos', majorar: true },
    // montagem: nós a menos da tolerância (mm) se fundem e os apoios encostados na face contam como apoiados
    // erros: com erros de montagem, 'perguntar' antes de calcular tudo, 'calcular' direto ou 'bloquear' o cálculo
    montagem: { tolerancia: 1, erros: 'perguntar' },
    // estruturas de madeira (NBR 7190-1:2022)
    madeira: { classe: 'C24', umidade: 2, carregamento: 'longa', tipo: 'serrada', gwc: 1.4, gwv: 1.8, gg: 1.4, gq: 1.5, flecha: 200 },
  };
}

export function criarProjeto({ nome = 'Projeto sem título', autor = '', descricao = '', parametros = {} } = {}) {
  const agora = new Date().toISOString();
  const base = parametrosPadrao();
  return {
    formato: FORMATO,
    versao: VERSAO_FORMATO,
    meta: { nome, autor, descricao, criadoEm: agora, modificadoEm: agora, aplicativo: 'LEBR 0.57.1' },
    parametros: { ...base, ...parametros, concreto: { ...base.concreto, ...parametros.concreto } },
    pavimentos: pavimentosPadrao(),
    elementos: [],
  };
}

/** Lê o texto de um arquivo e devolve um projeto válido (lança erro descritivo se não for). */
export function lerProjeto(texto) {
  let obj;
  try { obj = JSON.parse(texto); } catch (e) { throw new Error(`O arquivo não é um JSON válido: ${e.message}`); }
  if (FORMATOS_ANTIGOS.includes(obj?.formato)) obj.formato = FORMATO;
  if (obj?.formato !== FORMATO) throw new Error('O arquivo não é um projeto do LEBR.');
  if (obj.versao > VERSAO_FORMATO) throw new Error(`Projeto criado em versão mais nova do formato (${obj.versao}).`);
  return migrar(obj);
}

/** Atualizações de esquema entre versões do formato entram aqui. */
function migrar(obj) {
  const base = parametrosPadrao();
  obj.parametros = { ...base, ...obj.parametros };
  obj.parametros.coeficientes = { ...base.coeficientes, ...obj.parametros.coeficientes };
  obj.parametros.cobrimento = { ...base.cobrimento, ...obj.parametros.cobrimento };
  obj.parametros.madeira = { ...base.madeira, ...obj.parametros.madeira };
  obj.parametros.montagem = { ...base.montagem, ...obj.parametros.montagem };
  obj.elementos ??= [];
  // até a versão 0.6 não havia pavimentos: cria um nível e deixa os elementos sem posição
  if (!Array.isArray(obj.pavimentos) || !obj.pavimentos.length) obj.pavimentos = pavimentosPadrao();
  return obj;
}

export function serializar(projeto) {
  projeto.meta.modificadoEm = new Date().toISOString();
  return JSON.stringify(projeto, null, 2) + '\n';
}

export const novoId = (prefixo = 'el') => `${prefixo}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

/** Próximo código livre da categoria: V1, V2… */
export function proximoCodigo(projeto, prefixo) {
  const usados = new Set(projeto.elementos.map((e) => e.codigo));
  let i = 1;
  while (usados.has(`${prefixo}${i}`)) i++;
  return `${prefixo}${i}`;
}
