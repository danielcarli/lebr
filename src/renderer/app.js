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
/**
 * LEBR — Laboratório de Estruturas Brasil — inicialização da interface.
 *
 * Liga as peças: estado do projeto, módulos de cálculo, comandos,
 * workbench (menus, explorador, abas, painel, status) e arquivos.
 */
import { h } from './ui/dom.js';
import { icone } from './ui/icones.js';
import * as ui from './ui/componentes.js';
import { Workbench, itemStatus } from './ui/workbench.js';
import { abrirPaleta } from './ui/paleta.js';
import { dialogo, confirmar, notificar } from './ui/dialogos.js';
import { menuContexto } from './ui/menus.js';

import { api } from './core/api.js';
import { estado } from './core/estado.js';
import { comandos } from './core/comandos.js';
import { modulos, instalar } from './core/modulos.js';
import { criarProjeto, lerProjeto, serializar } from './core/projeto.js';
import * as motor from './core/motor.js';
import { CRITERIOS, otimizavel } from '../modules/comum/otimizacao.js';
import { fundacoesDesatualizadas } from '../modules/comum/armadura.js';
import { lerNumero, dataHora, CODIGO_VALIDO, compararCodigos } from './core/formatar.js';

import { abaInicio } from './views/inicio.js';
import { abaElemento, estadoDoResultado, marcarCalculo } from './views/elemento.js';
import { abaMemorialProjeto, abaCargasFundacao } from './views/relatorios.js';
import { abaParametros } from './views/parametros.js';
import { abaRoteiro } from './views/roteiro.js';
import { abaValidacao } from './views/validacao.js';
import { abaCatalogoCargas } from './views/catalogo-cargas.js';
import { abaMontagem, selecionarNaMontagem } from './views/montagem.js';
import { aba3D, opcoes3D, alternarPainel3D } from './views/visualizacao3d.js';
import { abaVento } from './views/vento.js';
import { abaEstabilidade } from './views/estabilidade.js';
import { abaQuantitativos } from './views/quantitativos.js';
import { gerarPranchas } from '../modules/comum/pranchas.js';
import { montagemDoProjeto } from './core/situacao-montagem.js';
import { criarSapatasNosPilares, criarBlocosNosPilares, criarNivelBaldrame } from './core/fundacoes.js';
import { proximoCodigo, novoId } from './core/projeto.js';
import { criarConsole } from './views/console.js';
import { criarApiScript } from './core/script.js';
import { definirUnidadeComprimento, observarUnidades } from './core/unidades.js';
import { modoDoPavimento } from '../modules/comum/grelha.js';
import { porticoNosPilares } from '../modules/comum/portico-edificio.js';
import { visaoExplorador, visaoModulos, agruparPorPavimento, alternarAgrupamento, soPendencias, alternarPendencias } from './views/explorador.js';

import { MODULOS_INTERNOS, MODULOS_PLANEJADOS } from '../modules/index.js';

const lebr = window.lebr;
const plataforma = lebr?.plataforma ?? 'web';
const VERSAO = '0.34.3';

/* ====================================================================== tema */
function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  try { localStorage.setItem('lebr.tema', tema); } catch { /* ignora */ }
  lebr?.janela.definirTema(tema);
}
const temaAtual = () => document.documentElement.dataset.tema ?? 'claro';
aplicarTema((() => { try { return localStorage.getItem('lebr.tema'); } catch { return null; } })() ?? 'claro');

/* ====================================================================== workbench */
const wb = new Workbench(document.getElementById('app'), { plataforma });
const saida = [];

function registrarSaida(texto, tipo = '') {
  saida.push({ hora: new Date().toLocaleTimeString('pt-BR'), texto, tipo });
  if (saida.length > 600) saida.splice(0, saida.length - 600);
  wb.desenharPainel();
}
wb.aoLimparSaida = (aba) => { if (aba === 'console') consoleLebr?.limpar(); else saida.length = 0; };

/* ====================================================================== módulos */
async function carregarModulos() {
  instalar(MODULOS_INTERNOS.map((fabrica) => ({ fabrica, origem: 'interno' })), api);
  const externos = (await lebr?.modulos.externos().catch(() => [])) ?? [];
  for (const ext of externos) {
    try {
      const m = await import(ext.url);
      instalar([{ fabrica: m.default, origem: `externo:${ext.pasta}` }], api);
      registrarSaida(`Módulo externo carregado: ${ext.pasta}`);
    } catch (err) {
      modulos.falha({ origem: ext.pasta, erro: err.message });
      registrarSaida(`Falha ao carregar o módulo ${ext.pasta}: ${err.message}`, 'erro');
    }
  }
}

/* ====================================================================== projeto */
function resumoProjeto(p) {
  const conta = (cat) => p.elementos.filter((e) => modulos.obter(e.modulo)?.categoria === cat).length;
  return { vigas: conta('vigas'), lajes: conta('lajes'), pilares: conta('pilares'), sondagens: conta('sondagens'), sapatas: p.elementos.filter((e) => e.modulo === 'concreto.sapata').length, estacas: p.elementos.filter((e) => e.modulo === 'geotecnia.estaca').length, blocos: p.elementos.filter((e) => e.modulo === 'concreto.bloco').length, escadas: p.elementos.filter((e) => e.modulo === 'concreto.escada').length, reservatorios: p.elementos.filter((e) => e.modulo === 'concreto.reservatorio').length };
}

async function lembrarRecente() {
  if (!estado.caminho || !lebr) return;
  await lebr.recentes.adicionar({ caminho: estado.caminho, nome: estado.projeto.meta.nome, resumo: resumoProjeto(estado.projeto) });
}

/** Pergunta se deve salvar antes de descartar o projeto atual. @returns {Promise<boolean>} pode continuar */
async function liberarProjetoAtual() {
  if (!estado.projeto || !estado.sujo) return true;
  const r = await dialogo({
    rotulo: 'Alterações não salvas', titulo: `Salvar “${estado.projeto.meta.nome}”?`,
    texto: 'Suas alterações serão perdidas se você não salvá-las.',
    botoes: [
      { texto: 'Cancelar', tipo: 'fantasma', valor: 'cancelar' },
      { texto: 'Não salvar', valor: 'descartar' },
      { texto: 'Salvar', tipo: 'primario', valor: 'salvar', padrao: true },
    ],
  });
  if (r === 'salvar') return salvar();
  return r === 'descartar';
}

function abrirNaInterface(projeto, caminho) {
  wb.fecharAbasOnde((a) => a.id !== 'inicio');
  wb.esquecerFechadas(); // "Reabrir aba fechada" não traz abas de outro projeto
  estado.abrir(projeto, caminho);
  wb.mostrarVisao('explorador');
  const primeiro = projeto.elementos[0];
  if (primeiro) abrirElemento(primeiro.id); else abrirParametros();
  abrir3DFixado();
  registrarSaida(`Projeto aberto: ${projeto.meta.nome}${caminho ? ` (${caminho})` : ''}`);
}

async function novoProjeto() {
  if (!(await liberarProjetoAtual())) return;
  const dados = { nome: 'Novo projeto', autor: '', fck: 25, caa: 'II' };
  const ok = await dialogo({
    rotulo: 'Novo projeto', titulo: 'Criar projeto',
    corpo: () => [
      ui.texto({ rotulo: 'Nome do projeto', valor: dados.nome, largura: '100%', aoMudar: (v) => { dados.nome = v; } }),
      ui.texto({ rotulo: 'Responsável técnico', valor: dados.autor, largura: '100%', aoMudar: (v) => { dados.autor = v; } }),
      ui.linhaCampos(
        ui.selecao({ rotulo: 'Concreto', valor: 25, opcoes: [20, 25, 30, 35, 40, 45, 50].map((f) => ({ valor: f, texto: `C${f}` })), aoMudar: (v) => { dados.fck = v; } }),
        ui.segmentado({ rotulo: 'Agressividade', valor: 'II', opcoes: ['I', 'II', 'III', 'IV'].map((k) => ({ valor: k, texto: k })), aoMudar: (v) => { dados.caa = v; segmentoAtivo(v); } }),
      ),
    ],
    botoes: [{ texto: 'Cancelar', tipo: 'fantasma', valor: false }, { texto: 'Criar projeto', tipo: 'primario', valor: true, padrao: true }],
  });
  if (!ok) return;
  const cob = { I: [2.5, 2.5, 2.0], II: [3.0, 3.0, 2.5], III: [4.0, 4.0, 3.5], IV: [5.0, 5.0, 4.5] }[dados.caa];
  const p = criarProjeto({
    nome: dados.nome.trim() || 'Projeto sem título', autor: dados.autor,
    parametros: { classeAgressividade: dados.caa, concreto: { fck: dados.fck }, cobrimento: { viga: cob[0], pilar: cob[1], laje: cob[2] } },
  });
  abrirNaInterface(p, null);
}

/** Atualiza visualmente o segmentado do diálogo de novo projeto (ele não redesenha sozinho). */
function segmentoAtivo(v) {
  document.querySelectorAll('.dialogo .segmentado button').forEach((b) => b.classList.toggle('ativo', b.textContent === v));
}

async function abrirProjeto() {
  if (!(await liberarProjetoAtual())) return;
  const arq = await lebr.projeto.abrirDialogo();
  if (arq) carregarArquivo(arq);
}

async function abrirCaminho(caminho) {
  if (!(await liberarProjetoAtual())) return;
  try {
    carregarArquivo(await lebr.projeto.ler(caminho));
  } catch (err) {
    notificar(`Não foi possível abrir o arquivo: ${err.message}`, 'erro');
  }
}

function carregarArquivo({ caminho, conteudo }) {
  try {
    const p = lerProjeto(conteudo);
    abrirNaInterface(p, caminho);
    lembrarRecente();
  } catch (err) {
    notificar(err.message, 'erro', { duracao: 7000 });
    registrarSaida(`Erro ao abrir ${caminho}: ${err.message}`, 'erro');
  }
}

async function abrirExemplo(nome = 'padrao') {
  if (!(await liberarProjetoAtual())) return;
  const { conteudo } = await lebr.projeto.exemplo(nome);
  const p = lerProjeto(conteudo);
  p.meta.nome = `${p.meta.nome} (cópia)`;
  abrirNaInterface(p, null);
  calcularTodos();
  estado.marcarSujo(false);
}

async function salvar() {
  if (!estado.projeto) return false;
  if (!estado.caminho) return salvarComo();
  try {
    await lebr.projeto.salvar(estado.caminho, serializar(estado.projeto));
    estado.marcarSujo(false);
    lembrarRecente();
    registrarSaida(`Salvo em ${estado.caminho}`);
    return true;
  } catch (err) {
    notificar(`Erro ao salvar: ${err.message}`, 'erro');
    return false;
  }
}

async function salvarComo() {
  if (!estado.projeto) return false;
  const nome = estado.projeto.meta.nome.replace(/[\\/:*?"<>|]/g, '').trim() || 'projeto';
  const caminho = await lebr.projeto.salvarComo(serializar(estado.projeto), nome);
  if (!caminho) return false;
  estado.caminho = caminho;
  estado.marcarSujo(false);
  lembrarRecente();
  registrarSaida(`Salvo em ${caminho}`);
  notificar('Projeto salvo.', 'ok', { duracao: 2200 });
  return true;
}

async function fecharProjeto() {
  if (!(await liberarProjetoAtual())) return;
  estado.fechar();
  wb.fecharAbasOnde((a) => a.id !== 'inicio');
  wb.esquecerFechadas();
  mostrarInicio();
}

/* ====================================================================== elementos */
// com o editor dividido, o elemento do lado com o foco; se ele mostra outra coisa (3D, montagem), o do outro lado
const elementoAtivo = () => wb.abaAtiva()?.elementoId ?? wb.abasVisiveis().find((a) => a.elementoId)?.elementoId ?? null;

function abrirElemento(id) {
  if (!estado.elemento(id)) return;
  wb.abrirAba(abaElemento(id, { api, calcular, abrirElemento, mostrarMemorial, exportarPdf }));
}

function criarElemento(moduloId) {
  if (!estado.projeto) return notificar('Crie ou abra um projeto primeiro.');
  const el = estado.criarElemento(modulos.obter(moduloId));
  abrirElemento(el.id);
}

/** Viga baldrame: viga de concreto no nível da fundação, com o cobrimento de contato com o solo e a parede do térreo. */
function novaVigaBaldrame() {
  if (!estado.projeto) return notificar('Crie ou abra um projeto primeiro.');
  const mod = modulos.obter('concreto.viga');
  const codigo = proximoCodigo(estado.projeto, 'VB');
  const base = mod.criar(estado.projeto);
  const el = { id: novoId('vb'), modulo: mod.id, codigo, nome: 'Viga baldrame', ...base, secao: { b: 15, h: 40 }, baldrame: true,
    cargas: base.cargas.filter((c) => c.tipo === 'alvenaria').map((c) => ({ ...c, descricao: 'Parede do térreo' })), resultado: null };
  estado.alterar((p) => p.elementos.push(el), { descricao: `Criar ${codigo}`, estrutural: true, elementoId: el.id, invalidar: false });
  abrirElemento(el.id);
}

/** Sapatas sob os pilares da fundação que ainda não têm uma. */
async function criarSapatas() {
  if (!estado.projeto) return notificar('Crie ou abra um projeto primeiro.');
  let ids = [];
  estado.alterar((p) => { ids = criarSapatasNosPilares(p, modulos); }, { descricao: 'Criar sapatas', estrutural: true });
  if (!ids.length) return notificar('Todos os pilares que chegam à fundação já têm sapata (ou não há pilares posicionados).', 'info');
  for (const id of ids) await calcular(id);
  const falhas = ids.filter((id) => !estado.elemento(id)?.resultado?.ok).length;
  notificar(`${ids.length} sapata(s) criada(s) e ligada(s) aos pilares${falhas ? ` — ${falhas} com pendências` : ''}. Elas estão em Fundações, no explorador.`, falhas ? 'erro' : 'ok', { duracao: 5000 });
  registrarSaida(`Fundações: ${ids.length} sapata(s) criada(s) sob os pilares.`);
}

/** Blocos sobre estacas sob os pilares da fundação que ainda não têm sapata nem bloco. */
async function criarBlocos() {
  if (!estado.projeto) return notificar('Crie ou abra um projeto primeiro.');
  let ids = [];
  estado.alterar((p) => { ids = criarBlocosNosPilares(p, modulos); }, { descricao: 'Criar blocos sobre estacas', estrutural: true });
  if (!ids.length) return notificar('Todos os pilares que chegam à fundação já têm sapata ou bloco (ou não há pilares posicionados).', 'info');
  for (const id of ids) await calcular(id);
  const falhas = ids.filter((id) => !estado.elemento(id)?.resultado?.ok).length;
  const estacas = ids.reduce((s, id) => s + (estado.elemento(id)?.resultado?.n ?? 0), 0);
  notificar(`${ids.length} bloco(s) criado(s) e ligado(s) aos pilares, com ${estacas} estaca(s) no total${falhas ? ` — ${falhas} com pendências` : ''}. Eles estão em Fundações, no explorador.`, falhas ? 'erro' : 'ok', { duracao: 5000 });
  registrarSaida(`Fundações: ${ids.length} bloco(s) sobre estacas criado(s) sob os pilares.`);
}

/** Nível de baldrame com arranques e vigas baldrame no traçado do pavimento mais baixo. */
async function criarBaldrame() {
  if (!estado.projeto) return notificar('Crie ou abra um projeto primeiro.');
  const v = { arranque: 1, b: 15, h: 40 };
  const ok = await dialogo({
    rotulo: 'Fundações', titulo: 'Nível de baldrame',
    texto: 'Cria um pavimento "Baldrame" na base dos pilares do pavimento mais baixo, com um arranque sob cada pilar (até a sapata) e uma viga baldrame sob cada viga desse pavimento, com a parede do térreo como carga. As sapatas existentes passam para os arranques.',
    corpo: () => [ui.linhaCampos(
      ui.campo({ rotulo: 'Arranques', valor: v.arranque, unidade: 'm', casas: 2, min: 0.3, max: 5, largura: '130px', aoMudar: (x) => { v.arranque = x; } }),
      ui.campo({ rotulo: 'Largura das vigas', valor: v.b, unidade: 'cm', casas: 1, min: 10, max: 60, largura: '150px', aoMudar: (x) => { v.b = x; } }),
      ui.campo({ rotulo: 'Altura das vigas', valor: v.h, unidade: 'cm', casas: 1, min: 20, max: 120, largura: '150px', aoMudar: (x) => { v.h = x; } }),
    )],
    botoes: [{ texto: 'Cancelar', tipo: 'fantasma', valor: false }, { texto: 'Criar baldrame', tipo: 'primario', valor: true, padrao: true }],
  });
  if (!ok) return;
  let res;
  try {
    estado.alterar((p) => { res = criarNivelBaldrame(p, modulos, { arranque: v.arranque, secao: { b: v.b, h: v.h } }); }, { descricao: 'Criar nível de baldrame', estrutural: true });
  } catch (err) { return notificar(err.message, 'erro'); }
  notificar(`Baldrame criado: ${res.arranques.length} arranque(s), ${res.vigas.length} viga(s) baldrame e ${res.ligacoes} ligação(ões)${res.sapatas ? `; ${res.sapatas} sapata(s) passaram para os arranques` : ''}.`, 'ok', { duracao: 6000 });
  registrarSaida(`Baldrame: pavimento na cota ${String(res.pavimento.cota).replace('.', ',')} m com ${res.arranques.length} arranques e ${res.vigas.length} vigas baldrame.`);
  abrirMontagem();
}

/** Duplica um elemento; a cópia vai para "Não posicionados" e sem as ligações do original. */
function duplicar(id) {
  const orig = estado.elemento(id);
  const c = estado.duplicarElemento(id);
  if (!c) return;
  abrirElemento(c.id);
  const n = estado.ultimaDuplicacao?.ligacoesRemovidas ?? 0;
  const partes = [];
  if (orig?.posicao) partes.push('posicione a cópia na montagem');
  if (n) partes.push(`${n} reação(ões) de outros elementos não foram copiadas para não contar a mesma carga duas vezes — use "Conectar automaticamente" depois de posicionar`);
  notificar(`${c.codigo} criado a partir de ${orig?.codigo ?? ''}${partes.length ? `: ${partes.join('; ')}.` : '.'}`, 'ok', { duracao: n ? 8000 : 4000 });
}

/* Carimbos de edição: um resultado que chega depois de uma edição do elemento (ou do projeto) já nasce desatualizado. */
const carimbos = new Map();
let carimboGeral = 0;
const tocar = (id) => carimbos.set(id, (carimbos.get(id) ?? 0) + 1);
const marcaDe = (id) => `${carimbos.get(id) ?? 0}|${carimboGeral}`;

const resultadoDeErro = (err) => ({ ok: false, erro: err.message, calculadoEm: new Date().toISOString(), desatualizado: false, verificacoes: [], avisos: [err.message], memorial: [] });

/** Calcula um elemento (no Worker de cálculo, quando possível) e grava o resultado. */
async function calcular(id = elementoAtivo()) {
  const el = estado.elemento(id);
  if (!el) return;
  const projeto = estado.projeto;
  const marca = marcaDe(id);
  const inicio = performance.now();
  marcarCalculo(id, true);
  let r;
  try { r = await motor.calcularUm(el, projeto, modulos); } catch (err) { r = resultadoDeErro(err); } finally { marcarCalculo(id, false); }
  if (estado.projeto !== projeto || !estado.elemento(id)) return r;
  if (marcaDe(id) !== marca) r = { ...r, desatualizado: true }; // editado enquanto calculava
  estado.alterar((p) => { p.elementos.find((e) => e.id === id).resultado = r; }, { descricao: `Calcular ${el.codigo}`, elementoId: id, invalidar: false, estrutural: true, calculo: true });
  const ms = Math.round(performance.now() - inicio);
  if (r.erro) {
    registrarSaida(`${el.codigo}: erro — ${r.erro}`, 'erro');
    notificar(`${el.codigo}: ${r.erro}`, 'erro');
  } else {
    registrarSaida(`${el.codigo} calculado em ${ms} ms — ${r.ok ? 'todas as verificações atendidas' : `${r.verificacoes.filter((v) => !v.ok).length} verificação(ões) não atendida(s)`}`, r.ok ? '' : 'erro');
  }
  return r;
}

let calculandoTodos = null;
/** Calcula todos os elementos, em ordem, sem travar a janela (Worker de cálculo, com o progresso na tela). */
function calcularTodos() {
  if (!estado.projeto) return;
  if (calculandoTodos) return calculandoTodos;
  // lajes → vigas → pilares, para que as reações já estejam prontas na leitura
  const ordem = { sondagens: -1, lajes: 0, escadas: 0.5, reservatorios: 0.6, vigas: 1, pilares: 2, fundacoes: 3 };
  const projeto = estado.projeto;
  const els = [...projeto.elementos].sort((a, b) => (ordem[modulos.obter(a.modulo)?.categoria] ?? 9) - (ordem[modulos.obter(b.modulo)?.categoria] ?? 9));
  const marcas = new Map(els.map((e) => [e.id, marcaDe(e.id)]));
  const inicio = performance.now();
  let erros = 0;
  const otimizados = els.filter((e) => e.otimizacao && otimizavel(e.modulo)).length;
  let aviso = null, texto = null;
  const progresso = setTimeout(() => {
    texto = h('span', null, 'Calculando…');
    aviso = notificar(texto, 'info', { duracao: 0 });
  }, 400);
  calculandoTodos = (async () => {
    try {
      await motor.calcularVarios(els.map((e) => e.id), projeto, modulos, (id, r, i) => {
        const el = projeto.elementos.find((e) => e.id === id);
        if (!el) return;
        el.resultado = marcaDe(id) !== marcas.get(id) ? { ...r, desatualizado: true } : r;
        if (r.erro) { erros++; registrarSaida(`${el.codigo}: erro — ${r.erro}`, 'erro'); }
        else if (!r.ok) registrarSaida(`${el.codigo}: ${r.verificacoes.filter((v) => !v.ok).length} verificação(ões) não atendida(s)`, 'erro');
        if (texto) texto.textContent = `Calculando ${i + 1} de ${els.length} elementos${otimizados ? ` (${otimizados} com otimização das bitolas)` : ''}…`;
      });
    } catch (err) {
      notificar(`Não foi possível calcular: ${err.message}`, 'erro');
    } finally {
      clearTimeout(progresso);
      aviso?.remove();
      calculandoTodos = null;
    }
    if (estado.projeto !== projeto) return;
    estado.alterar(() => {}, { descricao: 'Calcular todos', invalidar: false, estrutural: true, calculo: true });
    registrarSaida(`${els.length} elementos calculados em ${Math.round(performance.now() - inicio)} ms${erros ? ` — ${erros} com erro` : ''}${motor.usandoWorker() ? ' (Worker de cálculo)' : ''}.`);
    const falhas = projeto.elementos.filter((e) => e.resultado && !e.resultado.ok).length;
    notificar(falhas ? `${els.length} elementos calculados — ${falhas} com pendências.` : `${els.length} elementos calculados — todos atendem.`, falhas ? 'erro' : 'ok', { duracao: 3000 });
  })();
  return calculandoTodos;
}

/* ====================================================================== otimização das bitolas */
/** Liga o critério de otimização (ou desliga, com null) no elemento e recalcula. */
async function otimizarElemento(criterio, id = elementoAtivo()) {
  const el = estado.elemento(id);
  if (!el) return;
  if (!otimizavel(el.modulo)) { notificar(`${el.codigo}: a otimização das bitolas ainda não está disponível para este tipo de elemento.`, 'info'); return; }
  estado.alterar((p) => {
    const e = p.elementos.find((x) => x.id === id);
    if (criterio) e.otimizacao = criterio; else delete e.otimizacao;
    fundacoesDesatualizadas(p, e);
  }, { descricao: `${el.codigo}: ${criterio ? `otimizar (${CRITERIOS[criterio].curto})` : 'sem otimização'}`, elementoId: id, invalidar: false });
  const r = await calcular(id);
  const o = r?.otimizacao;
  if (o && !r.erro) {
    const kg = (v) => `${(v ?? 0).toFixed(1).replace('.', ',')} kg`;
    notificar(o.semAlternativa
      ? `${el.codigo}: nenhuma combinação de bitolas atende a todas as verificações — mantido o cálculo automático.`
      : `${el.codigo} (${CRITERIOS[criterio].curto}): ${o.bitolas.length} bitola(s), ${kg(o.kg)}, ${o.segmentos} segmentos — antes ${o.base.bitolas.length} bitola(s), ${kg(o.base.kg)}, ${o.base.segmentos} segmentos.`, o.semAlternativa ? 'erro' : 'ok', { duracao: 5000 });
  }
}

/** Aplica o critério a todos os elementos que aceitam otimização e recalcula o projeto. */
function otimizarProjeto(criterio) {
  if (!estado.projeto) return;
  const alvo = estado.projeto.elementos.filter((e) => otimizavel(e.modulo));
  if (!alvo.length) { notificar('Nenhum elemento do projeto aceita a otimização das bitolas.', 'info'); return; }
  estado.alterar((p) => {
    for (const e of p.elementos) if (otimizavel(e.modulo)) { if (criterio) e.otimizacao = criterio; else delete e.otimizacao; }
  }, { descricao: criterio ? `Otimizar todos (${CRITERIOS[criterio].curto})` : 'Remover a otimização de todos', estrutural: true });
  calcularTodos();
}

/* ====================================================================== PDF */
const proximoQuadro = () => new Promise((ok) => requestAnimationFrame(() => ok()));

/**
 * Exporta a página inteira do elemento (dados, desenhos, resultados, verificações e
 * memorial) em PDF A4. A página é impressa sempre no tema claro, com resultados atuais.
 */
async function exportarPdf(id = elementoAtivo()) {
  const el = estado.elemento(id);
  if (!el) return notificar('Abra um elemento para exportar.');
  if (!lebr?.pdf) return notificar('Exportar PDF só funciona no aplicativo instalado.', 'erro');

  const destino = await lebr.pdf.escolherDestino(`${el.codigo} - ${el.nome}`, estado.caminho);
  if (!destino) return;

  abrirElemento(id);
  if (!el.resultado || el.resultado.desatualizado) await calcular(id);

  const raiz = document.documentElement;
  const temaAnterior = temaAtual();
  raiz.dataset.tema = 'claro';
  document.querySelectorAll('.notificacao').forEach((n) => n.remove());
  try {
    await document.fonts.ready;
    await proximoQuadro(); await proximoQuadro();
    const atual = estado.elemento(id);
    const mod = modulos.obter(atual.modulo);
    const caminho = await lebr.pdf.gravar({
      cabecalho: [
        `${estado.projeto.meta.nome}${estado.projeto.meta.autor ? ` · ${estado.projeto.meta.autor}` : ''}`,
        [atual.codigo, atual.nome !== atual.codigo ? atual.nome : null, mod?.nome].filter(Boolean).join(' · '),
      ],
      rodape: `LEBR ${VERSAO} · ${mod?.norma ?? ''} · emitido em ${dataHora(new Date().toISOString())}`,
    });
    registrarSaida(`${atual.codigo}: PDF exportado — ${caminho}`);
    notificar(`PDF de ${atual.codigo} salvo.`, 'ok', {
      duracao: 8000,
      acoes: [
        { texto: 'Abrir PDF', aoClicar: () => lebr.sistema.abrirArquivo(caminho) },
        { texto: 'Mostrar na pasta', aoClicar: () => lebr.sistema.mostrarArquivo(caminho) },
      ],
    });
  } catch (err) {
    notificar(`Não foi possível exportar o PDF: ${err.message}`, 'erro', { duracao: 7000 });
  } finally {
    raiz.dataset.tema = temaAnterior;
  }
}

/* ---------------------------------------------------------------- relatórios do projeto (0.32) */
const acoesRelatorio = () => ({ exportarPdf: exportarAbaPdf, calcularTodos: async () => { await calcularTodos(); wb.redesenharTodas(); }, abrirElemento: (id) => abrirElemento(id) });
function abrirMemorialProjeto() {
  if (!estado.projeto) return notificar('Crie ou abra um projeto primeiro.');
  wb.abrirAba(abaMemorialProjeto(acoesRelatorio()));
}
function abrirCargasFundacao() {
  if (!estado.projeto) return notificar('Crie ou abra um projeto primeiro.');
  wb.abrirAba(abaCargasFundacao(acoesRelatorio()));
}
/** Exporta em PDF uma aba de relatório (a aba fica em foco no tema claro durante a impressão). */
async function exportarAbaPdf(abaId, nome, titulo) {
  if (!lebr?.pdf) return notificar('Exportar PDF só funciona no aplicativo instalado.', 'erro');
  const destino = await lebr.pdf.escolherDestino(nome, estado.caminho);
  if (!destino) return;
  if (abaId === 'memorial-projeto') abrirMemorialProjeto(); else if (abaId === 'cargas-fundacao') abrirCargasFundacao();
  const raiz = document.documentElement;
  const temaAnterior = temaAtual();
  raiz.dataset.tema = 'claro';
  document.querySelectorAll('.notificacao').forEach((n) => n.remove());
  try {
    await document.fonts.ready;
    await proximoQuadro(); await proximoQuadro();
    const caminho = await lebr.pdf.gravar({
      cabecalho: [`${estado.projeto.meta.nome}${estado.projeto.meta.autor ? ` · ${estado.projeto.meta.autor}` : ''}`, titulo],
      rodape: `LEBR ${VERSAO} · ${estado.projeto.parametros.norma ?? 'NBR 6118:2023'} · emitido em ${dataHora(new Date().toISOString())}`,
    });
    registrarSaida(`${titulo}: PDF exportado — ${caminho}`);
    notificar(`${titulo}: PDF salvo.`, 'ok', { duracao: 8000, acoes: [
      { texto: 'Abrir PDF', aoClicar: () => lebr.sistema.abrirArquivo(caminho) },
      { texto: 'Mostrar na pasta', aoClicar: () => lebr.sistema.mostrarArquivo(caminho) },
    ] });
  } catch (err) {
    notificar(`Não foi possível exportar o PDF: ${err.message}`, 'erro', { duracao: 7000 });
  } finally {
    raiz.dataset.tema = temaAnterior;
  }
}

function mostrarMemorial(id) {
  const el = estado.elemento(id);
  if (!el?.resultado?.memorial) return;
  registrarSaida(`Memorial de cálculo — ${el.codigo} · ${el.nome}`, 'titulo-memorial');
  for (const bloco of el.resultado.memorial) {
    registrarSaida(bloco.titulo, 'titulo-memorial');
    for (const l of bloco.linhas) registrarSaida(l);
  }
  wb.mostrarPainel('saida');
}

/** Motivo de um código não servir para o elemento, ou null. */
function problemaCodigo(codigo, id) {
  if (!codigo) return 'Informe o código.';
  if (!CODIGO_VALIDO.test(codigo)) return 'Use até 12 caracteres: letras, algarismos, hífen, ponto ou barra, começando por letra ou algarismo.';
  const outro = estado.projeto.elementos.find((e) => e.id !== id && e.codigo.toLocaleLowerCase('pt-BR') === codigo.toLocaleLowerCase('pt-BR'));
  return outro ? `O código ${codigo} já é usado por ${outro.nome !== outro.codigo ? `“${outro.nome}”` : 'outro elemento'}.` : null;
}

/** Edita o código (V1, L2, P3…) e o nome de qualquer elemento. */
async function renomear(id = elementoAtivo()) {
  const el = estado.elemento(id);
  if (!el) return;
  let codigo = el.codigo, nome = el.nome, erro = null;
  for (;;) {
    const ok = await dialogo({
      rotulo: el.codigo, titulo: 'Código e nome do elemento',
      texto: erro ?? 'O código identifica o elemento nas pranchas, nas ligações e na árvore (ordem alfabética). As cargas entre elementos continuam ligadas ao trocar o código.',
      corpo: () => [ui.linhaCampos(
        ui.texto({ rotulo: 'Código', valor: codigo, largura: '130px', aoMudar: (v) => { codigo = v; } }),
        ui.texto({ rotulo: 'Nome', valor: nome, largura: '260px', aoMudar: (v) => { nome = v; } }),
      )],
      botoes: [{ texto: 'Cancelar', tipo: 'fantasma', valor: false }, { texto: 'Salvar', tipo: 'primario', valor: true, padrao: true }],
    });
    if (!ok) return;
    codigo = codigo.trim(); nome = nome.trim();
    erro = problemaCodigo(codigo, id);
    if (!erro) break;
  }
  const antigo = el.codigo;
  if (codigo === el.codigo && (nome || el.codigo) === el.nome) return;
  estado.alterar(() => {
    const e = estado.elemento(id);
    // o nome acompanha o código quando era igual a ele
    e.nome = nome && !(nome === antigo && e.nome === antigo) ? nome : codigo;
    e.codigo = codigo;
  }, { descricao: codigo !== antigo ? `Código ${antigo} → ${codigo}` : 'Renomear', elementoId: id, invalidar: false, estrutural: true });
  if (codigo !== antigo) registrarSaida(`${antigo} passou a se chamar ${codigo}`);
}

async function excluir(id = elementoAtivo()) {
  const el = estado.elemento(id);
  if (!el) return;
  const dep = estado.dependentesDe(id);
  const ok = await confirmar({
    rotulo: 'Excluir elemento', titulo: `Excluir ${el.codigo}?`, perigo: true, confirmarTexto: 'Excluir',
    texto: dep.length
      ? `${el.nome} transmite cargas para ${dep.map((d) => d.codigo).join(', ')}. Essas cargas também serão removidas. Você pode desfazer com Ctrl+Z.`
      : `${el.nome} será removido do projeto. Você pode desfazer com Ctrl+Z.`,
  });
  if (!ok) return;
  estado.removerElemento(id);
  wb.fecharAbasOnde((a) => a.elementoId === id);
  registrarSaida(`${el.codigo} excluído`);
}

/* ====================================================================== abas fixas */
function mostrarInicio() {
  wb.abrirAba(abaInicio({
    recentes: () => lebr?.recentes.listar() ?? Promise.resolve([]),
    abrirCaminho,
    removerRecente: (c) => lebr.recentes.remover(c),
  }));
}

/* ====================================================================== console de comandos */
/** Console JavaScript do painel inferior, com a API de core/script.js (viga(), laje(), pilar()…). */
const consoleLebr = criarConsole({
  criarApi: (imprimir) => criarApiScript({
    estado, modulos, imprimir,
    acoes: {
      calcular: (id) => calcular(id),
      calcularTodos: () => calcularTodos(),
      abrirElemento: (id) => abrirElemento(id),
      abrirMontagem: (id) => abrirMontagem(id),
      abrir3D: () => abrir3D(),
    },
  }),
});

/* ====================================================================== montagem e 3D */
const acoesMontagem = {
  abrirElemento: (id) => abrirElemento(id),
  abrir3D: () => abrir3D(),
  abrirVento: () => abrirVento(),
  abrirEstabilidade: () => abrirEstabilidade(),
  abrirMontagem: (id) => abrirMontagem(id),
  registrarSaida: (t, tipo) => registrarSaida(t, tipo),
  redesenhar: () => wb.redesenharAba('montagem'),
  fixado3D: () => fixar3DLigado(),
  fixar3D: (v) => fixar3D(v),
};

/* ---------------------------------------------------------------- 3D fixado à direita */
const PREF_FIXAR3D = 'lebr.fixar3D';
function fixar3DLigado() {
  try { return localStorage.getItem(PREF_FIXAR3D) === '1'; } catch { return false; }
}
/** Liga/desliga a visualização 3D fixa no lado direito do editor (lembrado entre sessões). */
function fixar3D(ligar = !fixar3DLigado()) {
  try { localStorage.setItem(PREF_FIXAR3D, ligar ? '1' : '0'); } catch { /* armazenamento indisponível */ }
  wb.fixarADireita(ligar ? 'visualizacao3d' : null);
  if (ligar && estado.projeto) {
    const voltar = wb.abaAtiva()?.id !== 'visualizacao3d' ? wb.ativa : null;
    if (wb.grupoDaAba('visualizacao3d') < 0) abrir3D();
    if (voltar && wb.grupoDaAba(voltar) >= 0) wb.focar(wb.grupoDaAba(voltar)); // o foco continua no que se estava fazendo
  }
  notificar(ligar ? 'Visualização 3D fixada à direita.' : 'Visualização 3D solta: as abas voltam a abrir onde estiver o foco.', 'info', { duracao: 2400 });
}
/** Ao abrir um projeto com o 3D fixado, ele já aparece à direita. */
function abrir3DFixado() {
  if (!fixar3DLigado() || !estado.projeto || wb.grupoDaAba('visualizacao3d') >= 0) return;
  const voltar = wb.ativa;
  abrir3D();
  if (voltar && wb.grupoDaAba(voltar) >= 0) wb.focar(wb.grupoDaAba(voltar));
}

function abrirMontagem(id) {
  if (!estado.projeto) return notificar('Crie ou abra um projeto primeiro.');
  if (typeof id === 'string') selecionarNaMontagem(id);
  if (wb.grupoDaAba('montagem') >= 0) { wb.ativarAba('montagem'); }
  else wb.abrirAba(abaMontagem(acoesMontagem));
}

function abrir3D() {
  if (!estado.projeto) return notificar('Crie ou abra um projeto primeiro.');
  wb.abrirAba(aba3D(acoesMontagem));
}

function abrirVento() {
  if (!estado.projeto) return notificar('Crie ou abra um projeto primeiro.');
  wb.abrirAba(abaVento({ abrir3D: (o) => { opcoes3D(o ?? {}); if (wb.grupoDaAba('visualizacao3d') >= 0) { wb.ativarAba('visualizacao3d'); } else abrir3D(); }, abrirParametros, abrirEstabilidade }));
}

/* ---------------------------------------------------------------- exportação DXF */
const PREF_DXF = 'lebr.dxf.opcoes';
async function exportarDXF() {
  if (!estado.projeto) return notificar('Crie ou abra um projeto primeiro.');
  let op = { formas: true, locacao: true, vigas: true, pilares: true, lajes: true };
  try { op = { ...op, ...JSON.parse(localStorage.getItem(PREF_DXF) ?? '{}') }; } catch { /* ignora */ }
  const pendentes = estado.projeto.elementos.filter((e) => !e.resultado || e.resultado.desatualizado).length;
  const itens = [
    ['formas', 'Plantas de fôrmas por pavimento', 'eixos, cotas, pilares, vigas, lajes, escadas e nível — escala 1:50'],
    ['locacao', 'Locação dos pilares e cargas na fundação', 'coordenadas, cotas a partir da origem, fundações e tabela de cargas — 1:50'],
    ['vigas', 'Armação das vigas', 'elevação, barras, estribos, cortes e tabela de aço — 1:25'],
    ['pilares', 'Armação dos pilares', 'lance, arranques, estribos, grampos, seção e tabela de aço — 1:25'],
    ['lajes', 'Armação das lajes maciças por pavimento', 'positivas, negativas e tabela de aço — 1:50'],
  ];
  const r = await dialogo({
    rotulo: 'Exportar', titulo: 'Pranchas em DXF',
    texto: 'Um arquivo DXF (R12, unidade cm) por prancha, com camadas separadas — abre no LibreCAD, QCAD, AutoCAD e similares.',
    corpo: () => [
      ...itens.map(([k, t, d]) => h('div', { class: 'dxf-opcao' }, ui.alternar({ rotulo: t, valor: op[k], dica: d, aoMudar: (v) => { op[k] = v; } }), h('span', { class: 'dxf-dica' }, d))),
      pendentes ? h('p', { class: 'combinacoes-nota' }, `${pendentes} elemento(s) sem cálculo atual serão calculados antes.`) : null,
    ],
    botoes: [{ texto: 'Cancelar', tipo: 'fantasma', valor: null }, { texto: 'Escolher pasta e exportar', tipo: 'primario', valor: () => true, padrao: true }],
    largura: '560px',
  });
  if (!r) return;
  try { localStorage.setItem(PREF_DXF, JSON.stringify(op)); } catch { /* ignora */ }
  if (pendentes) calcularTodos();
  const arquivos = gerarPranchas(estado.projeto, { ...op, versao: VERSAO });
  if (!arquivos.length) return notificar('Nada para exportar: posicione os elementos na montagem e calcule.', 'erro');
  if (!lebr?.dxf) {
    for (const a of arquivos) {
      const url = URL.createObjectURL(new Blob([Uint8Array.from(a.conteudo, (c) => c.charCodeAt(0) & 0xff)], { type: 'application/dxf' }));
      const el = Object.assign(document.createElement('a'), { href: url, download: a.nome });
      el.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
    return;
  }
  try {
    const res = await lebr.dxf.salvar(arquivos.map(({ nome, conteudo }) => ({ nome, conteudo })), estado.caminho);
    if (!res) return;
    notificar(`${res.arquivos.length} prancha(s) exportada(s) em DXF.`, 'ok', { duracao: 7000, acoes: [{ texto: 'Mostrar na pasta', aoClicar: () => lebr.sistema.mostrarArquivo(res.arquivos[0]) }] });
    for (const a of arquivos) registrarSaida(`DXF: ${a.nome} — ${a.entidades} entidades, camadas ${a.camadas.join(', ')}`);
  } catch (err) {
    notificar(`Erro ao exportar o DXF: ${err.message}`, 'erro');
  }
}

function abrirQuantitativos() {
  if (!estado.projeto) return notificar('Crie ou abra um projeto primeiro.');
  wb.abrirAba(abaQuantitativos({ abrirElemento, calcularTodos: async () => { await calcularTodos(); wb.redesenharAba('quantitativos'); }, exportarCSV }));
}

/** Grava o CSV dos quantitativos (separador ";", vírgula decimal, UTF-8 com BOM — abre direto nas planilhas). */
async function exportarCSV(texto) {
  if (!lebr?.csv) {
    // fora do aplicativo (navegador): baixa o arquivo
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${estado.projeto?.meta?.nome ?? 'quantitativos'} - quantitativos.csv` });
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    return;
  }
  try {
    const destino = await lebr.csv.salvar(texto, `${estado.projeto?.meta?.nome ?? 'projeto'} - quantitativos`, estado.caminho);
    if (!destino) return;
    notificar('Quantitativos exportados em CSV.', 'ok', { duracao: 6000, acoes: [{ texto: 'Mostrar na pasta', aoClicar: () => lebr.sistema.mostrarArquivo(destino) }] });
    registrarSaida(`Quantitativos exportados: ${destino}`);
  } catch (err) {
    notificar(`Erro ao exportar o CSV: ${err.message}`, 'erro');
  }
}

function abrirEstabilidade() {
  if (!estado.projeto) return notificar('Crie ou abra um projeto primeiro.');
  wb.abrirAba(abaEstabilidade({ abrirVento, abrir3D, abrirParametros }));
}

function abrirParametros() {
  if (!estado.projeto) return;
  wb.abrirAba(abaParametros());
}

/* ====================================================================== comandos */
const temProjeto = () => !!estado.projeto;
/** Há um elemento para o comando: o indicado (menu do explorador, montagem) ou o da aba ativa. */
const temElemento = (id) => !!estado.elemento(typeof id === 'string' ? id : elementoAtivo());

function registrarComandos() {
  const C = (c) => comandos.registrar(c);
  // Arquivo
  C({ id: 'projeto.novo', categoria: 'Arquivo', titulo: 'Novo projeto…', icone: 'novo', tecla: 'Ctrl+N', executar: novoProjeto });
  C({ id: 'projeto.abrir', categoria: 'Arquivo', titulo: 'Abrir projeto…', icone: 'pasta', tecla: 'Ctrl+O', executar: abrirProjeto });
  C({ id: 'projeto.abrirExemplo', categoria: 'Arquivo', titulo: 'Abrir projeto de exemplo', icone: 'documento', executar: () => abrirExemplo('padrao') });
  C({ id: 'projeto.abrirExemploTerreo', categoria: 'Arquivo', titulo: 'Abrir exemplo: residência térrea com baldrame e sapatas', icone: 'sapata', executar: () => abrirExemplo('terreo') });
  C({ id: 'projeto.abrirExemplo18', categoria: 'Arquivo', titulo: 'Abrir exemplo: edifício de 18 pavimentos (pórtico com vento)', icone: 'cubo', executar: () => abrirExemplo('18-pavimentos') });
  C({ id: 'projeto.abrirExemplo3', categoria: 'Arquivo', titulo: 'Abrir exemplo: edifício de 3 pavimentos', icone: 'cubo', executar: () => abrirExemplo('3-pavimentos') });
  C({ id: 'projeto.salvar', categoria: 'Arquivo', titulo: 'Salvar', icone: 'salvar', tecla: 'Ctrl+S', habilitado: temProjeto, executar: salvar });
  C({ id: 'projeto.salvarComo', categoria: 'Arquivo', titulo: 'Salvar como…', tecla: 'Ctrl+Shift+S', habilitado: temProjeto, executar: salvarComo });
  C({ id: 'projeto.exportarDXF', categoria: 'Arquivo', titulo: 'Exportar pranchas em DXF…', icone: 'planta', tecla: 'Ctrl+Shift+D', habilitado: temProjeto, executar: exportarDXF });
  C({ id: 'projeto.mostrarArquivo', categoria: 'Arquivo', titulo: 'Mostrar arquivo na pasta', habilitado: () => !!estado.caminho, executar: () => lebr.sistema.mostrarArquivo(estado.caminho) });
  C({ id: 'projeto.fechar', categoria: 'Arquivo', titulo: 'Fechar projeto', habilitado: temProjeto, executar: fecharProjeto });
  C({ id: 'projeto.parametros', categoria: 'Projeto', titulo: 'Parâmetros do projeto', icone: 'parametros', tecla: 'Ctrl+,', habilitado: temProjeto, executar: abrirParametros });
  // Editar
  C({ id: 'editar.desfazer', categoria: 'Editar', titulo: 'Desfazer', tecla: 'Ctrl+Z', respeitaCampo: true, habilitado: () => estado.podeDesfazer, executar: () => estado.desfazer() });
  C({ id: 'editar.refazer', categoria: 'Editar', titulo: 'Refazer', tecla: 'Ctrl+Y', respeitaCampo: true, habilitado: () => estado.podeRefazer, executar: () => estado.refazer() });
  C({ id: 'editar.refazer2', titulo: 'Refazer', tecla: 'Ctrl+Shift+Z', respeitaCampo: true, ocultoNaPaleta: true, habilitado: () => estado.podeRefazer, executar: () => estado.refazer() });
  // Estrutura — um comando "novo" por módulo instalado
  modulos.lista().forEach((m, i) => C({
    id: `elemento.novo.${m.id}`, categoria: 'Estrutura', titulo: `Novo: ${m.nome}`, icone: m.icone,
    tecla: i < 9 ? `Ctrl+Shift+${i + 1}` : undefined, habilitado: temProjeto, executar: () => criarElemento(m.id),
  }));
  C({ id: 'elemento.abrir', titulo: 'Abrir elemento', ocultoNaPaleta: true, executar: (id) => abrirElemento(id) });
  C({ id: 'elemento.renomear', categoria: 'Estrutura', titulo: 'Editar código e nome do elemento…', icone: 'editar', tecla: 'F2', habilitado: temElemento, executar: (id) => renomear(id) });
  C({ id: 'elemento.duplicar', categoria: 'Estrutura', titulo: 'Duplicar elemento', icone: 'copiar', habilitado: temElemento, executar: (id = elementoAtivo()) => duplicar(id) });
  C({ id: 'elemento.excluir', categoria: 'Estrutura', titulo: 'Excluir elemento', icone: 'lixeira', habilitado: temElemento, executar: (id) => excluir(id) });
  C({ id: 'estrutura.montagem', categoria: 'Estrutura', titulo: 'Montagem da estrutura (pavimentos e planta)', icone: 'planta', tecla: 'F6', habilitado: temProjeto, executar: (id) => abrirMontagem(id) });
  C({ id: 'estrutura.3d', categoria: 'Estrutura', titulo: 'Visualização 3D', icone: 'cubo', tecla: 'F7', habilitado: temProjeto, executar: abrir3D });
  C({ id: 'estrutura.vigaBaldrame', categoria: 'Estrutura', titulo: 'Nova viga baldrame', icone: 'viga', habilitado: temProjeto, executar: novaVigaBaldrame });
  C({ id: 'estrutura.baldrame', categoria: 'Estrutura', titulo: 'Criar nível de baldrame (arranques e vigas baldrame)…', icone: 'viga', habilitado: temProjeto, executar: criarBaldrame });
  C({ id: 'estrutura.sapatas', categoria: 'Estrutura', titulo: 'Criar sapatas nos pilares da fundação', icone: 'sapata', habilitado: temProjeto, executar: criarSapatas });
  C({ id: 'estrutura.blocos', categoria: 'Estrutura', titulo: 'Criar blocos sobre estacas nos pilares da fundação', icone: 'bloco', habilitado: temProjeto, executar: criarBlocos });
  C({ id: 'projeto.memorial', categoria: 'Estrutura', titulo: 'Memorial do edifício (PDF)', icone: 'documento', habilitado: temProjeto, executar: abrirMemorialProjeto });
  C({ id: 'projeto.cargasFundacao', categoria: 'Estrutura', titulo: 'Cargas na fundação (PDF)', icone: 'sapata', habilitado: temProjeto, executar: abrirCargasFundacao });
  C({ id: 'estrutura.quantitativos', categoria: 'Estrutura', titulo: 'Quantitativos de materiais (concreto, fôrma e aço)', icone: 'quantitativos', habilitado: temProjeto, executar: abrirQuantitativos });
  C({ id: 'estrutura.estabilidade', categoria: 'Estrutura', titulo: 'Estabilidade global (α e γz)', icone: 'estabilidade', tecla: 'F9', habilitado: temProjeto, executar: abrirEstabilidade });
  C({ id: 'estrutura.vento', categoria: 'Estrutura', titulo: 'Vento (NBR 6123)', icone: 'vento', tecla: 'F8', habilitado: temProjeto, executar: abrirVento });
  // Calcular
  C({ id: 'elemento.calcular', categoria: 'Calcular', titulo: 'Calcular elemento', icone: 'calcular', tecla: 'F5', habilitado: temElemento, executar: (id) => calcular(id) });
  C({ id: 'elemento.calcularTodos', categoria: 'Calcular', titulo: 'Calcular todos os elementos', icone: 'calcular', tecla: 'Shift+F5', habilitado: temProjeto, executar: calcularTodos });
  C({ id: 'elemento.exportarPdf', categoria: 'Arquivo', titulo: 'Exportar elemento em PDF…', icone: 'pdf', tecla: 'Ctrl+E', habilitado: temElemento, executar: (id) => exportarPdf(id) });
  const otimizavelAtivo = () => { const e = estado.elemento(elementoAtivo()); return !!e && otimizavel(e.modulo); };
  const critAtivo = () => estado.elemento(elementoAtivo())?.otimizacao ?? null;
  C({ id: 'elemento.otimizarBitolas', categoria: 'Calcular', titulo: 'Otimizar o elemento: menos bitolas diferentes', habilitado: otimizavelAtivo, marcado: () => critAtivo() === 'bitolas', executar: () => otimizarElemento('bitolas') });
  C({ id: 'elemento.otimizarAco', categoria: 'Calcular', titulo: 'Otimizar o elemento: menos aço', habilitado: otimizavelAtivo, marcado: () => critAtivo() === 'aco', executar: () => otimizarElemento('aco') });
  C({ id: 'elemento.otimizarSegmentos', categoria: 'Calcular', titulo: 'Otimizar o elemento: menos segmentos de barra', habilitado: otimizavelAtivo, marcado: () => critAtivo() === 'segmentos', executar: () => otimizarElemento('segmentos') });
  C({ id: 'elemento.semOtimizacao', categoria: 'Calcular', titulo: 'Elemento sem otimização das bitolas', habilitado: otimizavelAtivo, marcado: () => otimizavelAtivo() && !critAtivo(), executar: () => otimizarElemento(null) });
  C({ id: 'projeto.otimizarBitolas', categoria: 'Calcular', titulo: 'Otimizar todos os elementos: menos bitolas diferentes', icone: 'calcular', habilitado: temProjeto, executar: () => otimizarProjeto('bitolas') });
  C({ id: 'projeto.otimizarAco', categoria: 'Calcular', titulo: 'Otimizar todos os elementos: menos aço', icone: 'calcular', habilitado: temProjeto, executar: () => otimizarProjeto('aco') });
  C({ id: 'projeto.otimizarSegmentos', categoria: 'Calcular', titulo: 'Otimizar todos os elementos: menos segmentos de barra', icone: 'calcular', habilitado: temProjeto, executar: () => otimizarProjeto('segmentos') });
  C({ id: 'projeto.semOtimizacao', categoria: 'Calcular', titulo: 'Remover a otimização de todos os elementos', icone: 'calcular', habilitado: temProjeto, executar: () => otimizarProjeto(null) });
  C({ id: 'elemento.memorial', categoria: 'Calcular', titulo: 'Mostrar memorial no painel', icone: 'painel', habilitado: () => !!estado.elemento(elementoAtivo())?.resultado, executar: () => mostrarMemorial(elementoAtivo()) });
  // Exibir
  C({ id: 'paleta.abrir', categoria: 'Exibir', titulo: 'Paleta de comandos…', icone: 'busca', tecla: 'Ctrl+Shift+P', executar: () => abrirPaleta({ modo: 'comandos', fonteElementos }) });
  C({ id: 'paleta.abrirF1', titulo: 'Paleta de comandos', tecla: 'F1', ocultoNaPaleta: true, executar: () => abrirPaleta({ modo: 'comandos', fonteElementos }) });
  C({ id: 'paleta.elementos', categoria: 'Exibir', titulo: 'Ir para elemento…', icone: 'busca', tecla: 'Ctrl+P', executar: () => abrirPaleta({ modo: 'elementos', fonteElementos }) });
  C({ id: 'exibir.inicio', categoria: 'Exibir', titulo: 'Tela inicial', icone: 'lebr', executar: mostrarInicio });
  C({ id: 'exibir.soPendencias', categoria: 'Exibir', titulo: 'Explorador: mostrar só os elementos com pendências', icone: 'filtro', marcado: () => soPendencias(), executar: (v) => { alternarPendencias(typeof v === 'boolean' ? v : undefined); wb.mostrarVisao('explorador'); } });
  C({ id: 'exibir.legendaExplorador', titulo: 'Legenda do explorador', ocultoNaPaleta: true, executar: () => wb.mostrarVisao('explorador') });
  C({ id: 'exibir.agruparPavimento', categoria: 'Exibir', titulo: 'Agrupar elementos por pavimento no explorador', icone: 'camadas', executar: () => { alternarAgrupamento(); wb.mostrarVisao('explorador'); notificar(agruparPorPavimento() ? 'Explorador agrupado por pavimento.' : 'Explorador em lista única por categoria.', 'info', { duracao: 2000 }); } });
  C({ id: 'exibir.explorador', categoria: 'Exibir', titulo: 'Explorador', icone: 'explorador', tecla: 'Ctrl+Shift+E', executar: () => wb.mostrarVisao('explorador') });
  C({ id: 'exibir.modulos', categoria: 'Exibir', titulo: 'Módulos', icone: 'modulos', tecla: 'Ctrl+Shift+X', executar: () => wb.mostrarVisao('modulos') });
  C({ id: 'exibir.lateral', categoria: 'Exibir', titulo: 'Alternar barra lateral', icone: 'lateral', tecla: 'Ctrl+B', executar: () => wb.alternarLateral() });
  C({ id: 'exibir.painel', categoria: 'Exibir', titulo: 'Alternar painel', icone: 'painel', tecla: 'Ctrl+J', executar: () => wb.alternarPainel() });
  C({ id: 'exibir.console', categoria: 'Exibir', titulo: 'Console de comandos (JavaScript)', icone: 'console', tecla: 'Ctrl+Shift+Y', executar: () => { wb.mostrarPainel('console'); consoleLebr.focar(); } });
  C({ id: 'exibir.problemas', categoria: 'Exibir', titulo: 'Problemas', icone: 'alerta', tecla: 'Ctrl+Shift+M', executar: () => wb.mostrarPainel('problemas') });
  C({ id: 'exibir.tema', categoria: 'Exibir', titulo: 'Alternar tema claro / escuro', icone: 'tema', executar: () => { aplicarTema(temaAtual() === 'claro' ? 'escuro' : 'claro'); atualizarStatus(); } });
  C({ id: 'exibir.zoomMais', categoria: 'Exibir', titulo: 'Aumentar zoom', tecla: 'Ctrl+=', executar: () => lebr?.janela.zoom(0.5) });
  C({ id: 'exibir.zoomMenos', categoria: 'Exibir', titulo: 'Diminuir zoom', tecla: 'Ctrl+-', executar: () => lebr?.janela.zoom(-0.5) });
  C({ id: 'exibir.zoomPadrao', categoria: 'Exibir', titulo: 'Restaurar zoom', tecla: 'Ctrl+0', executar: () => lebr?.janela.zoom(0) });
  C({ id: 'aba.fechar', categoria: 'Exibir', titulo: 'Fechar aba', tecla: 'Ctrl+W', executar: () => wb.fecharAba() });
  C({ id: 'aba.dividir', categoria: 'Exibir', titulo: 'Dividir o editor (aba ativa para o outro lado)', icone: 'dividir', tecla: 'Ctrl+\\', habilitado: () => wb.dividido || wb.abas.length > 1, executar: () => wb.dividir() });
  C({ id: 'aba.juntar', categoria: 'Exibir', titulo: 'Juntar os lados do editor', icone: 'juntar', habilitado: () => wb.dividido, executar: () => wb.juntarGrupos() });
  C({ id: 'aba.focarOutroLado', categoria: 'Exibir', titulo: 'Ir para o outro lado do editor', tecla: 'Ctrl+K', habilitado: () => wb.dividido, executar: () => wb.focar(1 - wb.foco) });
  C({ id: 'exibir.painel3D', categoria: 'Exibir', titulo: 'Mostrar / ocultar o painel de controles do 3D', icone: 'lateral', executar: () => alternarPainel3D() });
  C({ id: 'exibir.fixar3D', categoria: 'Exibir', titulo: 'Fixar a visualização 3D à direita', icone: 'pino', marcado: () => fixar3DLigado(), executar: () => fixar3D() });
  // navegação entre as abas abertas (mesmos atalhos do VS Code)
  C({ id: 'aba.proxima', categoria: 'Exibir', titulo: 'Próxima aba', icone: 'direita', tecla: 'Ctrl+Tab', executar: () => wb.ativarVizinha(1) });
  C({ id: 'aba.anterior', categoria: 'Exibir', titulo: 'Aba anterior', tecla: 'Ctrl+Shift+Tab', executar: () => wb.ativarVizinha(-1) });
  C({ id: 'aba.proximaPg', titulo: 'Próxima aba', tecla: 'Ctrl+PageDown', ocultoNaPaleta: true, executar: () => wb.ativarVizinha(1) });
  C({ id: 'aba.anteriorPg', titulo: 'Aba anterior', tecla: 'Ctrl+PageUp', ocultoNaPaleta: true, executar: () => wb.ativarVizinha(-1) });
  for (let n = 1; n <= 8; n++) C({ id: `aba.ir${n}`, titulo: `Ir para a aba ${n}`, tecla: `Alt+${n}`, ocultoNaPaleta: true, executar: () => wb.ativarPosicao(n) });
  C({ id: 'aba.ultima', categoria: 'Exibir', titulo: 'Ir para a última aba', tecla: 'Alt+9', executar: () => wb.ativarPosicao(-1) });
  C({ id: 'aba.lista', categoria: 'Exibir', titulo: 'Abas abertas…', icone: 'busca', tecla: 'Alt+0', executar: () => abrirPaleta({ modo: 'elementos', fonteElementos: fonteAbas, dica: 'Ir para a aba aberta… (digite > para comandos)' }) });
  C({ id: 'aba.reabrir', categoria: 'Exibir', titulo: 'Reabrir aba fechada', tecla: 'Ctrl+Shift+T', executar: () => {
    const a = wb.reabrirAba((def) => !def.elementoId || !!estado.elemento(def.elementoId));
    if (!a) notificar('Nenhuma aba fechada para reabrir.');
  } });
  // Módulos e ajuda
  C({ id: 'modulos.abrirPasta', categoria: 'Módulos', titulo: 'Abrir pasta de módulos externos', icone: 'pasta', executar: () => lebr?.modulos.abrirPasta() });
  C({ id: 'ajuda.atalhos', categoria: 'Ajuda', titulo: 'Atalhos de teclado', icone: 'info', executar: mostrarAtalhos });
  C({ id: 'ajuda.modulos', categoria: 'Ajuda', titulo: 'Como criar um módulo', icone: 'modulos', executar: mostrarAjudaModulos });
  C({ id: 'ajuda.colaborar', categoria: 'Ajuda', titulo: 'Como colaborar (estudos de caso e validação)', icone: 'info', executar: () => mostrarColaborar() });
  C({ id: 'ajuda.validacao', categoria: 'Ajuda', titulo: 'Relatório de validação', icone: 'check', executar: () => wb.abrirAba(abaValidacao({
    versao: VERSAO,
    lerCasos: () => (lebr?.validacao ? lebr.validacao.casos() : Promise.reject(new Error('disponível só no app desktop'))),
    abrirPasta: lebr?.validacao ? () => lebr.validacao.abrirPasta() : null,
  })) });
  C({ id: 'ajuda.cargas', categoria: 'Ajuda', titulo: 'Catálogo de cargas (NBR 6120)', icone: 'carga', executar: () => wb.abrirAba(abaCatalogoCargas()) });
  C({ id: 'ajuda.roteiro', categoria: 'Ajuda', titulo: 'Roteiro (road map)', icone: 'roteiro', executar: () => wb.abrirAba(abaRoteiro({ versao: VERSAO })) });
  C({ id: 'ajuda.sobre', categoria: 'Ajuda', titulo: 'Sobre o LEBR', icone: 'info', executar: mostrarSobre });
  C({ id: 'ajuda.atualizar', categoria: 'Ajuda', titulo: 'Verificar atualizações', icone: 'atualizar', executar: () => lebr?.atualizacao?.verificar() });
}

/** Abas abertas, na ordem da barra, para a lista rápida (Alt+0). */
function fonteAbas() {
  const ativa = wb.abaAtiva()?.id;
  return wb.abas.map((a, i) => ({
    titulo: a.titulo(), detalhe: a.id === ativa ? 'aba atual' : '', atual: a.id === ativa,
    tecla: i < 8 ? `Alt+${i + 1}` : (i === wb.abas.length - 1 ? 'Alt+9' : null),
    icone: a.icone, acao: () => wb.ativarAba(a.id),
  }));
}

function fonteElementos() {
  const base = estado.projeto ? [...estado.projeto.elementos].sort((a, b) => compararCodigos(a.codigo, b.codigo)).map((e) => {
    const m = modulos.obter(e.modulo);
    return { titulo: `${e.codigo} · ${e.nome}`, detalhe: m?.nome, icone: m?.icone, acao: () => abrirElemento(e.id) };
  }) : [];
  return [...base, { titulo: 'Tela inicial', icone: 'lebr', acao: mostrarInicio }, ...(estado.projeto ? [{ titulo: 'Parâmetros do projeto', icone: 'parametros', acao: abrirParametros }] : [])];
}

/* ====================================================================== menus */
function definirMenus() {
  const novos = () => modulos.lista().map((m) => ({ comando: `elemento.novo.${m.id}` }));
  wb.definirMenus([
    { rotulo: 'Arquivo', itens: [
      { comando: 'projeto.novo' }, { comando: 'projeto.abrir' }, { comando: 'projeto.abrirExemplo' }, { comando: 'projeto.abrirExemploTerreo' }, { comando: 'projeto.abrirExemplo3' }, { comando: 'projeto.abrirExemplo18' },
      { cabecalho: 'Recentes' }, ...recentesMenu,
      '-', { comando: 'projeto.salvar' }, { comando: 'projeto.salvarComo' }, { comando: 'projeto.mostrarArquivo' },
      '-', { comando: 'elemento.exportarPdf' }, { comando: 'projeto.exportarDXF' },
      '-', { comando: 'projeto.parametros' }, '-', { comando: 'projeto.fechar' },
    ] },
    { rotulo: 'Editar', itens: [{ comando: 'editar.desfazer' }, { comando: 'editar.refazer' }, '-', { comando: 'elemento.renomear' }, { comando: 'elemento.duplicar' }, { comando: 'elemento.excluir', perigo: true }] },
    { rotulo: 'Exibir', itens: [
      { comando: 'paleta.abrir' }, { comando: 'paleta.elementos' }, '-',
      { comando: 'exibir.explorador' }, { comando: 'exibir.agruparPavimento' }, { comando: 'exibir.soPendencias' }, { comando: 'exibir.modulos' }, { comando: 'exibir.inicio' }, '-',
      { comando: 'exibir.lateral' }, { comando: 'exibir.painel' }, { comando: 'exibir.problemas' }, { comando: 'exibir.console' }, '-',
      { comando: 'aba.proxima' }, { comando: 'aba.anterior' }, { comando: 'aba.ultima' }, { comando: 'aba.lista' }, { comando: 'aba.reabrir' }, { comando: 'aba.fechar' }, '-',
      { comando: 'aba.dividir' }, { comando: 'aba.juntar' }, { comando: 'aba.focarOutroLado' }, { comando: 'exibir.fixar3D' }, { comando: 'exibir.painel3D' }, '-',
      { comando: 'exibir.tema' }, { comando: 'exibir.zoomMais' }, { comando: 'exibir.zoomMenos' }, { comando: 'exibir.zoomPadrao' },
    ] },
    { rotulo: 'Estrutura', itens: () => [{ comando: 'estrutura.montagem' }, { comando: 'estrutura.3d' }, { comando: 'estrutura.vento' }, { comando: 'estrutura.estabilidade' }, { comando: 'estrutura.quantitativos' }, { comando: 'projeto.memorial' }, { comando: 'projeto.cargasFundacao' }, '-', { comando: 'estrutura.sapatas' }, { comando: 'estrutura.blocos' }, { comando: 'estrutura.baldrame' }, { comando: 'estrutura.vigaBaldrame' }, { comando: 'ajuda.cargas' }, '-', ...novos(), '-', { comando: 'elemento.renomear' }, { comando: 'elemento.duplicar' }, { comando: 'elemento.excluir', perigo: true }] },
    { rotulo: 'Calcular', itens: [{ comando: 'elemento.calcular' }, { comando: 'elemento.calcularTodos' }, '-', { comando: 'elemento.otimizarBitolas' }, { comando: 'elemento.otimizarAco' }, { comando: 'elemento.otimizarSegmentos' }, { comando: 'elemento.semOtimizacao' }, '-', { comando: 'projeto.otimizarBitolas' }, { comando: 'projeto.otimizarAco' }, { comando: 'projeto.otimizarSegmentos' }, { comando: 'projeto.semOtimizacao' }, '-', { comando: 'elemento.memorial' }] },
    { rotulo: 'Módulos', itens: () => [
      ...modulos.lista().map((m) => ({ rotulo: `${m.nome} · v${m.versao}`, icone: m.icone, acao: () => wb.mostrarVisao('modulos') })),
      '-', { comando: 'exibir.modulos' }, { comando: 'modulos.abrirPasta' }, { comando: 'ajuda.modulos' },
    ] },
    { rotulo: 'Ajuda', itens: [{ comando: 'paleta.abrir', rotulo: 'Mostrar todos os comandos' }, { comando: 'ajuda.atalhos' }, { comando: 'ajuda.modulos' }, '-', { comando: 'ajuda.cargas' }, { comando: 'ajuda.roteiro' }, { comando: 'ajuda.validacao' }, { comando: 'ajuda.colaborar' }, { comando: 'ajuda.atualizar' }, { comando: 'ajuda.sobre' }] },
  ]);
}

let recentesMenu = [];
async function atualizarRecentesMenu() {
  const lista = (await lebr?.recentes.listar().catch(() => [])) ?? [];
  recentesMenu = lista.filter((r) => r.existe).slice(0, 5).map((r) => ({ rotulo: r.nome, icone: 'documento', acao: () => abrirCaminho(r.caminho) }));
  if (!recentesMenu.length) recentesMenu = [{ rotulo: 'Nenhum projeto recente', desabilitado: true }];
  definirMenus();
}

/* ====================================================================== painel e status */
function problemas() {
  if (!estado.projeto) return [];
  const out = [];
  for (const el of estado.projeto.elementos) {
    const r = el.resultado;
    if (!r) continue;
    if (r.erro) out.push({ el, texto: r.erro });
    for (const v of r.verificacoes ?? []) if (!v.ok) out.push({ el, texto: `${v.nome}: ${v.valor} (limite ${v.limite})` });
  }
  return out;
}

function configurarPainel() {
  wb.definirAbasPainel([
    {
      id: 'saida', titulo: 'Saída',
      render: (el) => {
        if (!saida.length) { el.append(h('div', { class: 'saida-linha' }, h('time', null, ''), h('span', null, 'Nenhuma mensagem.'))); return; }
        for (const s of saida) el.append(h('div', { class: ['saida-linha', s.tipo] }, h('time', null, s.hora), h('span', null, s.texto)));
      },
    },
    { id: 'console', titulo: 'Console', render: (el) => consoleLebr.render(el) },
    {
      id: 'problemas', titulo: 'Problemas', contador: () => problemas().length,
      render: (el) => {
        const lista = problemas();
        if (!lista.length) { el.append(h('div', { class: 'saida-linha' }, h('time', null, ''), h('span', null, 'Nenhum problema nos elementos calculados.'))); return; }
        el.append(ui.tabela({
          classe: 'problemas',
          colunas: [{ titulo: 'Elemento' }, { titulo: 'Descrição' }],
          linhas: lista.map((p) => ({ celulas: [h('button', { class: 'link', onClick: () => abrirElemento(p.el.id) }, `${p.el.codigo} · ${p.el.nome}`), p.texto] })),
        }));
      },
    },
  ]);
}

function atualizarStatus() {
  const p = estado.projeto;
  const probs = problemas().length;
  const esquerda = [itemStatus({ texto: 'NBR 6118:2023', icone: 'lebr', titulo: 'Norma de referência' })];
  const sit = situacaoDoProjeto();
  if (p) {
    const r = resumoProjeto(p);
    // a situação também em texto e ícone (não só pela cor da barra); clique mostra só as pendências no explorador
    esquerda.push(itemStatus({
      texto: sit.curto, icone: { ok: 'check', falha: 'alerta', pendente: 'relogio2' }[sit.situacao], titulo: `${sit.titulo}${sit.situacao === 'ok' ? '' : '\nClique para ver só os elementos com pendências no explorador'}`,
      aoClicar: sit.situacao === 'ok' ? undefined : () => comandos.executar('exibir.soPendencias', true),
    }));
    esquerda.push(
      itemStatus({ texto: `${r.vigas} vigas · ${r.lajes} lajes · ${r.pilares} pilares${r.escadas ? ` · ${r.escadas} escada${r.escadas > 1 ? 's' : ''}` : ''}${r.reservatorios ? ` · ${r.reservatorios} reservatório${r.reservatorios > 1 ? 's' : ''}` : ''}${r.sapatas ? ` · ${r.sapatas} sapata${r.sapatas > 1 ? 's' : ''}` : ''}${r.blocos ? ` · ${r.blocos} bloco${r.blocos > 1 ? 's' : ''}` : ''}${r.estacas ? ` · ${r.estacas} estaca${r.estacas > 1 ? 's' : ''}` : ''}${r.sondagens ? ` · ${r.sondagens} furo${r.sondagens > 1 ? 's' : ''}` : ''}`, icone: 'explorador', aoClicar: () => wb.mostrarVisao('explorador') }),
      itemStatus({ texto: String(probs), icone: 'alerta', titulo: 'Problemas', aoClicar: () => wb.mostrarPainel('problemas') }),
    );
  }
  const direita = [];
  if (p) {
    const par = p.parametros;
    direita.push(
      itemStatus({ texto: `C${par.concreto.fck} · CA-${par.aco.fyk / 10}`, titulo: 'Materiais do projeto', aoClicar: abrirParametros }),
      itemStatus({ texto: `CAA ${par.classeAgressividade}`, titulo: 'Classe de agressividade ambiental', aoClicar: abrirParametros }),
      itemStatus({ texto: estado.sujo ? 'Não salvo' : estado.caminho ? 'Salvo' : 'Novo', icone: estado.sujo ? 'editar' : 'check' }),
    );
  }
  direita.push(
    itemStatus({ texto: temaAtual() === 'claro' ? 'Claro' : 'Escuro', icone: 'tema', titulo: 'Alternar tema claro / escuro', aoClicar: () => comandos.executar('exibir.tema') }),
    itemStatus({ texto: `LEBR ${VERSAO}`, titulo: 'Laboratório de Estruturas Brasil' }),
  );
  wb.definirStatus({ esquerda, direita, situacao: sit.situacao, titulo: sit.titulo });
}

/**
 * Cor da barra de status: terracota se algum elemento não atende, deu erro no cálculo ou tem erro de montagem;
 * cinza-chumbo se ainda há elementos sem cálculo ou desatualizados (ou nenhum projeto aberto); verde se todos foram
 * calculados e atendem.
 */
function situacaoDoProjeto() {
  const p = estado.projeto;
  if (!p) return { situacao: 'pendente', titulo: 'Nenhum projeto aberto', curto: 'Sem projeto' };
  const els = p.elementos.filter((e) => modulos.obter(e.modulo));
  if (!els.length) return { situacao: 'pendente', titulo: 'Projeto sem elementos', curto: 'Sem elementos' };
  const falhas = els.filter((e) => e.resultado && (e.resultado.erro || e.resultado.ok === false));
  const mont = [...montagemDoProjeto().values()].filter((m) => m.estado === 'erro').length;
  if (falhas.length || mont) {
    return {
      situacao: 'falha',
      titulo: [falhas.length && `${falhas.length} elemento(s) não atende(m) ou com erro de cálculo`, mont && `${mont} elemento(s) com erro de montagem`].filter(Boolean).join(' · '),
      curto: [falhas.length && `${falhas.length} não atende${falhas.length > 1 ? 'm' : ''}`, mont && `${mont} na montagem`].filter(Boolean).join(' · '),
    };
  }
  const pend = els.filter((e) => !e.resultado || e.resultado.desatualizado).length;
  if (pend) return { situacao: 'pendente', titulo: `${pend} elemento(s) ainda não calculado(s) ou desatualizado(s) — Calcular todos (Shift+F5)`, curto: `${pend} a calcular` };
  return { situacao: 'ok', titulo: 'Todos os elementos calculados e atendendo às verificações', curto: 'Tudo atende' };
}

function atualizarTitulo() {
  const p = estado.projeto;
  const nomeArq = estado.caminho?.split(/[\\/]/).pop();
  wb.definirTitulo({ projeto: p?.meta.nome, sujo: estado.sujo, detalhe: nomeArq });
  lebr?.janela.definirTitulo(p ? `${estado.sujo ? '● ' : ''}${p.meta.nome} — LEBR` : 'LEBR — Laboratório de Estruturas Brasil');
  lebr?.janela.definirSujo(estado.sujo);
}

/* ====================================================================== diálogos de ajuda */
function mostrarAtalhos() {
  const linhas = comandos.lista().filter((c) => c.tecla && !c.ocultoNaPaleta).map((c) => [c.categoria ?? '', c.titulo, h('kbd', null, comandos.rotuloTecla(c.tecla))]);
  // atalhos sem entrada própria na paleta
  const extra = [['Exibir', 'Próxima / anterior aba (alternativa)', 'Ctrl+PageDown / Ctrl+PageUp'], ['Exibir', 'Ir para a aba 1 a 8', 'Alt+1 … Alt+8']];
  const pos = linhas.findIndex((l) => l[1] === 'Ir para a última aba');
  linhas.splice(pos < 0 ? linhas.length : pos, 0, ...extra.map(([g, t, k]) => [g, t, h('kbd', null, comandos.rotuloTecla(k))]));
  dialogo({ rotulo: 'Ajuda', titulo: 'Atalhos de teclado', largura: '620px', corpo: () => [h('div', { class: 'dialogo-rolagem' }, ui.tabela({ colunas: [{ titulo: 'Grupo' }, { titulo: 'Comando' }, { titulo: 'Atalho', alinhar: 'dir' }], linhas }))], botoes: [{ texto: 'Fechar', tipo: 'primario', padrao: true }] });
}

function mostrarAjudaModulos() {
  dialogo({
    rotulo: 'Módulos', titulo: 'Como criar um módulo', largura: '640px',
    corpo: () => [
      h('p', null, 'Um módulo é uma pasta com um arquivo index.js cuja exportação padrão é uma função que recebe a API do LEBR e devolve a definição do módulo: id, categoria, prefixo, criar(), calcular(), renderEntrada() e renderResultado().'),
      h('p', null, 'Coloque a pasta dentro da pasta de módulos externos e reinicie o programa. O repositório traz um esqueleto em exemplos/modulos/esqueleto-modulo e o contrato completo em docs/MODULOS.md.'),
      h('pre', { class: 'codigo' }, `export default (api) => ({\n  id: 'exemplo.minha.laje',\n  nome: 'Minha laje',\n  categoria: 'lajes', prefixo: 'ML',\n  criar: () => ({ ... }),\n  calcular: (el, ctx) => ({ ok, verificacoes, memorial }),\n  renderEntrada: (raiz, ctx) => { ... },\n  renderResultado: (raiz, res, ctx) => { ... },\n});`),
    ],
    botoes: [{ texto: 'Abrir pasta de módulos', valor: 'pasta' }, { texto: 'Fechar', tipo: 'primario', padrao: true }],
  }).then((v) => { if (v === 'pasta') comandos.executar('modulos.abrirPasta'); });
}

async function mostrarSobre() {
  const info = (await lebr?.sistema.info().catch(() => null)) ?? {};
  const r = await dialogo({
    rotulo: 'Sobre', titulo: 'LEBR', largura: '600px',
    corpo: () => [
      ui.ficha([
        { rotulo: 'Versão', valor: VERSAO }, { rotulo: 'Electron', valor: info.electron ?? '—' },
        { rotulo: 'Plataforma', valor: plataforma }, { rotulo: 'Licença', valor: 'GPL-3.0' },
      ], { colunas: 4 }),
      h('p', null, 'Laboratório de Estruturas Brasil — sistema aberto e modular para cálculo de estruturas segundo as normas brasileiras. Os resultados são de apoio ao projeto e devem ser verificados por profissional habilitado.'),
      h('div', { class: 'sobre-autoria' },
        h('span', { class: 'rot' }, 'Autoria'),
        h('p', null, 'Software idealizado e desenvolvido por ', h('strong', null, 'Daniel Michelon De Carli'), ' com uso do Claude com modelo Opus 5.5.')),
      h('div', { class: 'sobre-aviso' },
        icone('alerta', { tamanho: 16, traco: 1.8 }),
        h('p', null, 'O software ainda encontra-se em estágio inicial de desenvolvimento e não deve ser utilizado para cálculos reais de estruturas. Procuramos colaboradores para estudos de caso e validação independente das funções.')),
      h('p', { class: 'combinacoes-nota' }, 'Software livre: você pode redistribuí-lo e modificá-lo nos termos da GNU General Public License, versão 3 (arquivo LICENSE). É distribuído na esperança de ser útil, mas SEM NENHUMA GARANTIA, nem mesmo a implícita de COMERCIALIZAÇÃO ou de ADEQUAÇÃO A UMA FINALIDADE ESPECÍFICA.'),
    ],
    botoes: [{ texto: 'Como colaborar', tipo: 'fantasma', valor: 'colaborar' }, { texto: 'Ver roteiro', tipo: 'fantasma', valor: 'roteiro' }, { texto: 'Fechar', tipo: 'primario', padrao: true }],
  });
  if (r === 'roteiro') comandos.executar('ajuda.roteiro');
  if (r === 'colaborar') comandos.executar('ajuda.colaborar');
}

/** Convite para colaborar: estudos de caso e validação independente das funções. */
async function mostrarColaborar() {
  const r = await dialogo({
    rotulo: 'Colabore', titulo: 'Estudos de caso e validação independente', largura: '640px',
    corpo: () => [
      h('p', null, 'O LEBR está em fase inicial de desenvolvimento. Para chegar a projetos reais, cada função precisa ser conferida por outras pessoas, com cálculos feitos ', h('strong', null, 'à mão'), ' ou em ', h('strong', null, 'planilhas'), ', independentes do código.'),
      h('ul', { class: 'colaborar-lista' },
        h('li', null, h('strong', null, 'Estudos de caso: '), 'monte um elemento ou um edifício pequeno, calcule por fora e compare com o LEBR — viga, laje, pilar, sapata, bloco, escada, reservatório, vento, γz, quantitativos.'),
        h('li', null, h('strong', null, 'Validação de funções: '), 'escolha uma função do motor (por exemplo a ancoragem, a flexão ou a punção), refaça a conta com a norma e registre o caso no formato do banco de validação (pasta validacao/casos, um JSON por grupo, com fonte e tolerância — ver docs/VALIDACAO.md).'),
        h('li', null, h('strong', null, 'Diferenças: '), 'quando o LEBR e o seu cálculo não baterem, abra uma issue no repositório com o arquivo do projeto, a planilha e a referência da norma.'),
        h('li', null, h('strong', null, 'Revisão normativa: '), 'pontos marcados "a conferir" nos documentos (docs/) e nos avisos do programa.'),
      ),
      h('p', { class: 'combinacoes-nota' }, 'Ajuda › Relatório de validação mostra os casos atuais e a diferença de cada grandeza. O guia completo está em CONTRIBUTING.md e docs/APRESENTACAO.md.'),
    ],
    botoes: [{ texto: 'Relatório de validação', tipo: 'fantasma', valor: 'validacao' }, { texto: 'Fechar', tipo: 'primario', padrao: true }],
  });
  if (r === 'validacao') comandos.executar('ajuda.validacao');
}

/* ====================================================================== eventos */
function invalidarDependentes(id, vistos = new Set()) {
  const marcar = (d) => {
    if (vistos.has(d.id)) return;
    vistos.add(d.id);
    tocar(d.id);
    if (d.resultado && !d.resultado.desatualizado) d.resultado.desatualizado = true;
    invalidarDependentes(d.id, vistos);
  };
  for (const d of estado.dependentesDe(id)) marcar(d);
  // pavimento em grelha: qualquer viga ou laje dele muda os esforços de todas as vigas do pavimento
  const el = estado.elemento(id);
  const pav = el?.posicao?.pavimento;
  // pórtico espacial nos pilares: qualquer viga, laje ou pilar posicionado muda os esforços de todos os pilares
  if (pav && porticoNosPilares(estado.projeto)) {
    for (const pl of estado.projeto.elementos) if (pl.id !== id && pl.modulo === 'concreto.pilar' && pl.posicao) marcar(pl);
  }
  // sondagem: as sapatas com a tensão admissível pelo SPT dependem dos furos
  if (el?.modulo === 'geotecnia.sondagem') for (const s of estado.projeto.elementos) if ((s.modulo === 'concreto.sapata' && s.solo?.modo === 'spt') || s.modulo === 'geotecnia.estaca' || s.modulo === 'concreto.bloco') marcar(s);
  // pilares em pórtico: as sapatas sob eles mudam junto
  if (pav && porticoNosPilares(estado.projeto)) for (const s of estado.projeto.elementos) if (s.modulo === 'concreto.sapata' || s.modulo === 'geotecnia.estaca' || s.modulo === 'concreto.bloco') marcar(s);
  if (pav && modoDoPavimento(estado.projeto, pav) === 'grelha') {
    for (const v of estado.projeto.elementos) if (v.id !== id && v.modulo === 'concreto.viga' && v.posicao?.pavimento === pav) marcar(v);
  }
}

function ligarEventos() {
  const sincronizarUnidade = () => definirUnidadeComprimento(estado.projeto?.parametros?.unidades?.comprimento ?? 'cm');
  estado.on('projeto', () => {
    sincronizarUnidade();
    wb.redesenharVisao();
    atualizarStatus();
    atualizarTitulo();
    wb.desenharPainel();
  });
  estado.on('alterado', (info) => {
    if (sincronizarUnidade()) { wb.redesenharTodas(); wb.desenharAbas(); }
    if (!info.calculo && info.invalidar !== false) { if (info.elementoId) tocar(info.elementoId); else carimboGeral++; }
    if (info.elementoId && !info.calculo && info.invalidar !== false) invalidarDependentes(info.elementoId);
    if (info.historico) {
      // após desfazer/refazer, fecha abas de elementos que deixaram de existir
      wb.fecharAbasOnde((a) => a.elementoId && !estado.elemento(a.elementoId));
    }
    wb.notificarAba(info);
    wb.redesenharVisao();
    atualizarStatus();
    wb.desenharPainel();
  });
  estado.on('sujo', () => { atualizarTitulo(); atualizarStatus(); });
  wb.emitirMudancaAba = () => { wb.redesenharVisao(); };
  wb.vistasDeApoio = new Set(['visualizacao3d', 'montagem']);
  wb.fixarADireita(fixar3DLigado() ? 'visualizacao3d' : null);
  wb.aoMenuAba = (e, aba, grupo) => menuContexto(e, [
    { rotulo: 'Fechar', icone: 'fechar', acao: () => wb.fecharAba(aba.id) },
    { rotulo: 'Fechar as outras', acao: () => wb.fecharAbasOnde((a) => a.id !== aba.id && a.id !== wb.fixadaDireita) },
    { rotulo: 'Fechar todas', acao: () => wb.fecharAbasOnde(() => true) },
    { comando: 'aba.reabrir' },
    '-',
    grupo === 1
      ? { rotulo: 'Mover para a esquerda', icone: 'dividir', acao: () => wb.moverAba(aba.id, 0) }
      : { rotulo: wb.dividido ? 'Mover para a direita' : 'Abrir à direita', icone: 'dividir', desabilitado: !wb.dividido && wb.abas.length < 2, acao: () => wb.moverAba(aba.id, 1) },
    ...(wb.dividido ? [{ comando: 'aba.juntar' }] : []),
    ...(aba.id === 'visualizacao3d' ? [{ rotulo: fixar3DLigado() ? 'Soltar da direita' : 'Fixar à direita', icone: 'pino', acao: () => fixar3D() }] : []),
    ...(aba.elementoId ? ['-', { comando: 'elemento.calcular', rotulo: 'Calcular' }, { rotulo: 'Exportar PDF…', icone: 'pdf', acao: () => exportarPdf(aba.elementoId) }] : []),
  ]);
  comandos.on('erro', ({ comando, erro }) => { notificar(`${comando.titulo}: ${erro.message}`, 'erro'); registrarSaida(`${comando.titulo}: ${erro.message}`, 'erro'); });

  lebr?.janela.aoComandoDoMenu((id) => comandos.executar(id));
  // atualização automática pelo GitHub: avisa quando a nova versão já está baixada; a pedido, diz também o resto
  lebr?.atualizacao?.aoMudar((st) => {
    if (st.fase === 'disponivel') {
      notificar(`A versão ${st.versao} do LEBR está disponível no GitHub.`, 'info', { duracao: 0, acoes: [{ texto: 'Atualizar agora', aoClicar: () => lebr.atualizacao.instalar() }] });
    } else if (st.fase === 'pronto') {
      notificar(`A versão ${st.versao} do LEBR já foi baixada.`, 'ok', { duracao: 0, acoes: [{ texto: 'Reiniciar e atualizar', aoClicar: () => lebr.atualizacao.instalar() }] });
    } else if (st.manual) {
      if (st.fase === 'atualizado') notificar(`O LEBR já está na versão mais recente (${VERSAO}).`, 'ok');
      else if (st.fase === 'baixando' && st.progresso === 0) notificar(`Baixando a versão ${st.versao}…`, 'info');
      else if (st.fase === 'indisponivel') notificar('A atualização automática só funciona no LEBR instalado pelo instalador do Windows. Baixe a versão nova em github.com/danielcarli/lebr.', 'info', { duracao: 9000 });
      else if (st.fase === 'erro') notificar(`Não foi possível verificar atualizações: ${st.erro}`, 'erro', { duracao: 8000 });
    }
  });
  lebr?.projeto.aoPedirAbrir((caminho) => abrirCaminho(caminho));
  lebr?.janela.aoPedirSalvarEFechar(async () => { if (await salvar()) lebr.janela.fecharConfirmado(); });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault()); // evita navegar para arquivos soltos na janela
}

/* ====================================================================== atividade */
function configurarAtividade() {
  wb.registrarVisao(visaoExplorador({ abrirElemento, elementoAtivo, criar: criarElemento }));
  wb.registrarVisao(visaoModulos({ planejados: MODULOS_PLANEJADOS }));
  wb.visoes.get('explorador').contador = () => problemas().length;
  wb.adicionarBotaoAtividade({ icone: 'busca', titulo: 'Paleta de comandos (Ctrl+Shift+P)', aoClicar: () => comandos.executar('paleta.abrir') });
  wb.adicionarBotaoAtividade({
    icone: 'engrenagem', titulo: 'Gerenciar',
    aoClicar: (e, b) => {
      const r = b.getBoundingClientRect();
      menuContexto({ preventDefault() {}, stopPropagation() {}, clientX: r.right + 4, clientY: r.top - 150 }, [
        { comando: 'paleta.abrir' }, { comando: 'projeto.parametros' }, { comando: 'exibir.tema' }, '-', { comando: 'ajuda.atalhos' }, { comando: 'ajuda.roteiro' }, { comando: 'ajuda.validacao' }, { comando: 'ajuda.colaborar' }, { comando: 'ajuda.sobre' },
      ]);
    },
  });
}

/* ====================================================================== início */
async function iniciar() {
  await carregarModulos();
  registrarComandos();
  comandos.ouvirTeclado();
  configurarAtividade();
  configurarPainel();
  ligarEventos();
  observarUnidades(document.body);
  await atualizarRecentesMenu();
  wb.mostrarVisao('explorador');
  atualizarStatus();
  atualizarTitulo();
  mostrarInicio();
  registrarSaida(`LEBR ${VERSAO} iniciado — ${modulos.lista().length} módulos carregados.`);
  // recentes no menu acompanham as gravações
  estado.on('sujo', (v) => { if (!v) atualizarRecentesMenu(); });

  const info = await lebr?.sistema.info().catch(() => null);
  if (info?.arquivoInicial) abrirCaminho(info.arquivoInicial);
}

iniciar().catch((err) => {
  console.error(err);
  document.body.append(h('pre', { class: 'falha-inicial' }, `Falha ao iniciar: ${err.stack ?? err.message}`));
});

// exportado para depuração no console de desenvolvimento
window.__lebr = { estado, modulos, comandos, lerNumero, wb, motor };
