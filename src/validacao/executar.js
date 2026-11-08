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
 * Banco de casos de validação — executor.
 *
 * Cada caso (validacao/casos/*.json) descreve uma entrada, a fonte do resultado
 * esperado e as grandezas a conferir, cada uma com a sua tolerância. O executor
 * roda o caso no motor de cálculo ou no módulo indicado e compara.
 *
 * Roda igual no Node (npm run validar, npm test) e no app (Ajuda › Relatório de validação).
 *
 * Formato de um arquivo de casos:
 *   { grupo, descricao, casos: [caso] }
 * Caso:
 *   { id, titulo, fonte, descricao?, url?, nota?, referencia?, local?,  (referencia: a obra sem o lugar; local: exemplo/página)    (descricao: enunciado do problema; url: onde a fonte está
 *                                                     publicada; nota: diferenças de hipótese entre a fonte e o LEBR)
 *     alvo: 'motor',    funcao: 'viga.analisarViga', args: [...]
 *   | alvo: 'elemento', modulo: 'concreto.viga', elemento: {...}, parametros?: {...}, pavimentos?: [...], outros?: [...],
 *     esperado: [{ grandeza, caminho, valor, unidade?, tolerancia?, toleranciaAbs?, ausenteVale? }] }
 *
 * Nos `args`, objetos especiais viram materiais: {"$concreto": 25} ou {"$concreto": {"fck": 25, "agregado": "basalto"}},
 * {"$aco": 500} e {"$madeira": "C24"}.
 * O `caminho` aponta para o valor no resultado: "vaos.0.Mpos", "coef.w", "reacoes[id=x0].d"; vazio = o próprio resultado.
 */
import { concreto, aco } from '../engine/materiais.js';
import { dimensionarFlexao, armaduraMinima } from '../engine/flexao.js';
import { dimensionarEstribos, verificarCortanteLaje } from '../engine/cisalhamento.js';
import { analisarViga } from '../engine/viga-solver.js';
import { analisarPlaca, areasDeInfluencia } from '../engine/placa.js';
import { momentoTotal, dimensionarPilar, armaduraDuasFaces } from '../engine/flexocompressao.js';
import { madeira, flexaoMadeira, cisalhamentoMadeira, compressaoMadeira } from '../engine/madeira.js';
import { pesoAlvenaria, cargaParede, cargaRevestimento, cargaUso } from '../engine/cargas.js';
import { gerarCombinacoes, envolvente } from '../engine/combinacoes.js';
import { estadioII, aberturaFissuras, alfaFluencia } from '../engine/fissuracao.js';
import { secaoVazada, dimensionarTorcao } from '../engine/torcao.js';
import { esforcosObliqua, curvaInteracao } from '../engine/flexao-obliqua.js';
import { perimetro, resistenciaConcreto, coeficienteK, verificarPuncao } from '../engine/puncao.js';
import { analisarPortico } from '../engine/portico.js';
import { fatorS2, pressaoDinamica, forcasDeVento, coefArrastoEstimado } from '../engine/vento.js';
import { desaprumo, acaoHorizontal, parametroAlfa, gamaZ, rigidezEquivalente } from '../engine/estabilidade.js';
import { estadoPeloN, analisarSondagem } from '../engine/sondagem.js';
import { tensaoAdmissivelSPT, dimensoesBalancosIguais, tensoesNaBase, momentoS1 } from '../engine/sapata.js';
import { cargaEstrutural } from '../engine/estacas.js';
import { bielasETirantes, reacoesEstacas, intervaloAlturaUtil } from '../engine/bloco.js';
import { degraus, cargasEscada, tramoBiapoiado } from '../engine/escada.js';
import { placaUnitaria, compatibilizar, bracoVigaParede } from '../engine/reservatorio.js';
import { quantitativosDoElemento, massaLinear, lerBarras } from '../modules/comum/quantitativos.js';
import * as detalhamento from '../engine/detalhamento.js';
import { criarProjeto } from '../renderer/core/projeto.js';
import { calcularElemento } from '../renderer/core/calculo.js';
import { MODULOS_CALCULO } from './calculos.js';

/** Funções dos motores que os casos podem chamar. */
export const MOTORES = {
  'materiais.concreto': concreto,
  'materiais.aco': aco,
  'flexao.dimensionarFlexao': dimensionarFlexao,
  'flexao.armaduraMinima': armaduraMinima,
  'cisalhamento.dimensionarEstribos': dimensionarEstribos,
  'cisalhamento.verificarCortanteLaje': verificarCortanteLaje,
  'viga.analisarViga': analisarViga,
  'placa.analisarPlaca': analisarPlaca,
  'placa.areasDeInfluencia': areasDeInfluencia,
  'pilar.momentoTotal': momentoTotal,
  'pilar.dimensionarPilar': dimensionarPilar,
  'pilar.armaduraDuasFaces': armaduraDuasFaces,
  'madeira.madeira': madeira,
  'madeira.flexaoMadeira': flexaoMadeira,
  'madeira.cisalhamentoMadeira': cisalhamentoMadeira,
  'madeira.compressaoMadeira': compressaoMadeira,
  'cargas.pesoAlvenaria': pesoAlvenaria,
  'cargas.cargaParede': cargaParede,
  'cargas.cargaRevestimento': cargaRevestimento,
  'cargas.cargaUso': cargaUso,
  'combinacoes.gerarCombinacoes': gerarCombinacoes,
  'combinacoes.envolvente': envolvente,
  'fissuracao.estadioII': estadioII,
  'fissuracao.aberturaFissuras': aberturaFissuras,
  'fissuracao.alfaFluencia': alfaFluencia,
  'torcao.secaoVazada': secaoVazada,
  'torcao.dimensionarTorcao': dimensionarTorcao,
  'obliqua.esforcosObliqua': esforcosObliqua,
  'obliqua.curvaInteracao': curvaInteracao,
  'puncao.perimetro': perimetro,
  'puncao.resistenciaConcreto': resistenciaConcreto,
  'puncao.coeficienteK': coeficienteK,
  'puncao.verificarPuncao': verificarPuncao,
  'portico.analisarPortico': analisarPortico,
  'vento.fatorS2': fatorS2,
  'vento.pressaoDinamica': pressaoDinamica,
  'vento.forcasDeVento': forcasDeVento,
  'vento.coefArrastoEstimado': coefArrastoEstimado,
  'estabilidade.desaprumo': desaprumo,
  'estabilidade.acaoHorizontal': acaoHorizontal,
  'estabilidade.parametroAlfa': parametroAlfa,
  'estabilidade.gamaZ': gamaZ,
  'estabilidade.rigidezEquivalente': rigidezEquivalente,
  'sondagem.estadoPeloN': estadoPeloN,
  'sondagem.analisarSondagem': analisarSondagem,
  'sapata.tensaoAdmissivelSPT': tensaoAdmissivelSPT,
  'sapata.dimensoesBalancosIguais': dimensoesBalancosIguais,
  'sapata.tensoesNaBase': tensoesNaBase,
  'sapata.momentoS1': momentoS1,
  'estacas.cargaEstrutural': cargaEstrutural,
  'bloco.bielasETirantes': bielasETirantes,
  'bloco.reacoesEstacas': reacoesEstacas,
  'bloco.intervaloAlturaUtil': intervaloAlturaUtil,
  'escada.degraus': degraus,
  'escada.cargasEscada': cargasEscada,
  'escada.tramoBiapoiado': tramoBiapoiado,
  'reservatorio.placaUnitaria': placaUnitaria,
  'reservatorio.compatibilizar': compatibilizar,
  'reservatorio.bracoVigaParede': bracoVigaParede,
  'quantitativos.doElemento': quantitativosDoElemento,
  'quantitativos.massaLinear': massaLinear,
  'quantitativos.lerBarras': lerBarras,
  'detalhamento.fbd': detalhamento.fbd,
  'detalhamento.ancoragemBasica': detalhamento.ancoragemBasica,
  'detalhamento.ancoragemNecessaria': detalhamento.ancoragemNecessaria,
  'detalhamento.decalagem': detalhamento.decalagem,
  'detalhamento.traspasse': detalhamento.traspasse,
  'detalhamento.detalharViga': detalhamento.detalharViga,
  'detalhamento.traspasseComprimido': detalhamento.traspasseComprimido,
  'detalhamento.barrasProtegidas': detalhamento.barrasProtegidas,
  'detalhamento.detalharPilar': detalhamento.detalharPilar,
  'detalhamento.detalharLaje': detalhamento.detalharLaje,
  'detalhamento.resumoComPerdas': detalhamento.resumoComPerdas,
};

/** Registro de cálculo no formato que calcularElemento espera. */
const registro = {
  obter: (id) => MODULOS_CALCULO[id] ?? null,
};

/* ------------------------------------------------------------------ entradas */

function materializar(v) {
  if (Array.isArray(v)) return v.map(materializar);
  if (!v || typeof v !== 'object') return v;
  if ('$concreto' in v) {
    const a = v.$concreto;
    return typeof a === 'number' ? concreto(a) : concreto(a.fck, a);
  }
  if ('$aco' in v) {
    const a = v.$aco;
    return typeof a === 'number' ? aco(a) : aco(a.fyk, a);
  }
  if ('$madeira' in v) {
    const a = v.$madeira;
    return typeof a === 'string' ? madeira(a) : madeira(a.classe, a);
  }
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, materializar(x)]));
}

/** Mescla profunda de objetos simples (listas são substituídas). */
function mesclar(base, extra) {
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return extra ?? base;
  const r = { ...base };
  for (const [k, v] of Object.entries(extra)) {
    r[k] = v && typeof v === 'object' && !Array.isArray(v) && base?.[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) ? mesclar(base[k], v) : v;
  }
  return r;
}

function rodarElemento(caso) {
  const mod = MODULOS_CALCULO[caso.modulo];
  if (!mod) throw new Error(`Módulo desconhecido: ${caso.modulo}.`);
  const projeto = criarProjeto({ nome: `Validação ${caso.id}` });
  if (caso.parametros) projeto.parametros = mesclar(projeto.parametros, caso.parametros);
  if (caso.pavimentos) projeto.pavimentos = structuredClone(caso.pavimentos);
  const base = mod.criar(projeto);
  const el = { id: 'caso', modulo: caso.modulo, codigo: 'CASO', nome: caso.titulo, ...base, ...structuredClone(caso.elemento ?? {}) };
  for (const outro of caso.outros ?? []) {
    const m = MODULOS_CALCULO[outro.modulo];
    projeto.elementos.push({ ...m.criar(projeto), ...structuredClone(outro) });
  }
  projeto.elementos.push(el);
  const r = calcularElemento(el, projeto, registro);
  if (r?.erro) throw new Error(r.erro);
  return r;
}

function rodarMotor(caso) {
  const f = MOTORES[caso.funcao];
  if (!f) throw new Error(`Função de motor desconhecida: ${caso.funcao}.`);
  return f(...materializar(caso.args ?? []));
}

/* ------------------------------------------------------------------ caminhos */

/** Lê um valor por caminho: "a.b.0.c", "lista[id=x0].d". */
export function lerCaminho(obj, caminho) {
  if (!caminho) return obj;
  let atual = obj;
  // "\." escapa um ponto dentro da chave (ex.: aco.6\.3 → a chave "6.3")
  for (const parte of caminho.split(/(?<!\\)\./).map((x) => x.replace(/\\\./g, '.'))) {
    if (atual == null) return undefined;
    const m = parte.match(/^([^[\]]*)\[([^=\]]+)=([^\]]*)\]$/);
    if (m) {
      const lista = m[1] ? atual[m[1]] : atual;
      atual = Array.isArray(lista) ? lista.find((x) => String(x?.[m[2]]) === m[3]) : undefined;
    } else {
      atual = atual[parte];
    }
  }
  return atual;
}

/* ------------------------------------------------------------------ comparação */

/** Compara um valor obtido com o esperado. Tolerância relativa padrão de 1 %. */
export function comparar(e, obtido) {
  const tol = e.tolerancia ?? 0.01;
  if (typeof e.valor !== 'number') {
    const ok = obtido === e.valor;
    return { ok, diferenca: null };
  }
  if (typeof obtido !== 'number' || !Number.isFinite(obtido)) return { ok: false, diferenca: null };
  const dif = obtido - e.valor;
  const rel = e.valor !== 0 ? Math.abs(dif / e.valor) : null;
  const limiteAbs = e.toleranciaAbs ?? (e.valor === 0 ? 1e-9 : 0);
  const ok = (rel != null && rel <= tol + 1e-12) || Math.abs(dif) <= limiteAbs;
  return { ok, diferenca: rel, diferencaAbs: dif };
}

/** Resultado completo de um caso (o objeto devolvido pelo motor ou pelo módulo), para o memorial dos exercícios. */
export function resultadoBruto(caso) {
  return caso.alvo === 'elemento' ? rodarElemento(caso) : rodarMotor(caso);
}

/** Argumentos do motor com os materiais já montados (concreto, aço, madeira). */
export const argumentosDoCaso = (caso) => materializar(caso.args ?? []);

/** Roda um caso e devolve o relatório dele. */
export function executarCaso(caso) {
  const base = { id: caso.id, titulo: caso.titulo, fonte: caso.fonte, descricao: caso.descricao ?? '', url: caso.url ?? '', nota: caso.nota ?? '', referencia: caso.referencia ?? '', local: caso.local ?? '', alvo: caso.alvo, onde: caso.alvo === 'motor' ? caso.funcao : caso.modulo };
  let r;
  try {
    r = caso.alvo === 'elemento' ? rodarElemento(caso) : rodarMotor(caso);
  } catch (err) {
    return { ...base, ok: false, erro: err?.message ?? String(err), itens: [] };
  }
  const itens = (caso.esperado ?? []).map((e) => {
    let obtido = lerCaminho(r, e.caminho);
    if (obtido === undefined && 'ausenteVale' in e) obtido = e.ausenteVale; // ex.: fator omitido = 0
    const c = comparar(e, obtido);
    return { grandeza: e.grandeza, caminho: e.caminho, unidade: e.unidade ?? '', esperado: e.valor, obtido, tolerancia: e.tolerancia ?? 0.01, ...c };
  });
  return { ...base, ok: itens.length > 0 && itens.every((i) => i.ok), itens };
}

/**
 * Roda todos os arquivos de casos.
 * @param {{arquivo:string, grupo:string, descricao?:string, casos:object[]}[]} arquivos
 */
export function executarTodos(arquivos) {
  const grupos = arquivos.map((a) => {
    const casos = (a.casos ?? []).map(executarCaso);
    return { arquivo: a.arquivo, grupo: a.grupo, descricao: a.descricao ?? '', casos, ok: casos.every((c) => c.ok) };
  });
  const todos = grupos.flatMap((g) => g.casos);
  const itens = todos.flatMap((c) => c.itens);
  return {
    executadoEm: new Date().toISOString(),
    grupos,
    total: todos.length,
    aprovados: todos.filter((c) => c.ok).length,
    falhas: todos.filter((c) => !c.ok).length,
    grandezas: itens.length,
    maiorDiferenca: Math.max(0, ...itens.filter((i) => i.diferenca != null).map((i) => i.diferenca)),
    ok: todos.every((c) => c.ok),
  };
}

/** Confere a estrutura de um arquivo de casos; devolve a lista de problemas. */
export function problemasDoArquivo(a) {
  const p = [];
  if (!a || typeof a !== 'object') return ['Arquivo não é um objeto JSON.'];
  if (!a.grupo) p.push('Falta "grupo".');
  if (!Array.isArray(a.casos) || !a.casos.length) p.push('Falta a lista "casos".');
  const ids = new Set();
  for (const c of a.casos ?? []) {
    const nome = c?.id ?? '(sem id)';
    if (!c?.id) p.push('Caso sem "id".');
    else if (ids.has(c.id)) p.push(`Id repetido: ${c.id}.`);
    ids.add(c?.id);
    if (!c?.fonte) p.push(`${nome}: falta a "fonte" do resultado esperado.`);
    if (!['motor', 'elemento'].includes(c?.alvo)) p.push(`${nome}: "alvo" deve ser "motor" ou "elemento".`);
    if (c?.alvo === 'motor' && !MOTORES[c.funcao]) p.push(`${nome}: função de motor desconhecida "${c.funcao}".`);
    if (c?.alvo === 'elemento' && !MODULOS_CALCULO[c.modulo]) p.push(`${nome}: módulo desconhecido "${c.modulo}".`);
    if (!Array.isArray(c?.esperado) || !c.esperado.length) p.push(`${nome}: falta a lista "esperado".`);
    for (const e of c?.esperado ?? []) if (!e.grandeza || !('valor' in e)) p.push(`${nome}: grandeza esperada sem "grandeza" ou "valor".`);
  }
  return p;
}
