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
 * Lista de projetos recentes, guardada em <userData>/recentes.json.
 */
const path = require('node:path');
const fs = require('node:fs');

const MAXIMO = 12;
let arquivo = null;

function iniciar(pastaUsuario) {
  arquivo = path.join(pastaUsuario, 'recentes.json');
}

function ler() {
  try { return JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch { return []; }
}

function gravar(lista) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, JSON.stringify(lista, null, 2), 'utf8');
}

/** Devolve a lista marcando os arquivos que não existem mais. */
function listar() {
  return ler().map((r) => ({ ...r, existe: fs.existsSync(r.caminho) }));
}

/** @param {{caminho:string, nome:string, resumo?:object}} item */
function adicionar(item) {
  const lista = ler().filter((r) => r.caminho !== item.caminho);
  lista.unshift({ ...item, abertoEm: new Date().toISOString() });
  gravar(lista.slice(0, MAXIMO));
  return listar();
}

function remover(caminho) {
  gravar(ler().filter((r) => r.caminho !== caminho));
  return listar();
}

function limpar() {
  gravar([]);
  return [];
}

module.exports = { iniciar, listar, adicionar, remover, limpar };
