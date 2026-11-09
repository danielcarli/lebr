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
 * Ponte segura entre a interface e o processo principal.
 * A interface só enxerga o objeto `window.lebr` definido aqui.
 */
const { contextBridge, ipcRenderer, webFrame } = require('electron');

const ouvir = (canal) => (cb) => {
  const fn = (_e, ...args) => cb(...args);
  ipcRenderer.on(canal, fn);
  return () => ipcRenderer.removeListener(canal, fn);
};

contextBridge.exposeInMainWorld('lebr', {
  plataforma: process.platform,

  projeto: {
    abrirDialogo: () => ipcRenderer.invoke('projeto:abrir-dialogo'),
    ler: (caminho) => ipcRenderer.invoke('projeto:ler', caminho),
    salvar: (caminho, conteudo) => ipcRenderer.invoke('projeto:salvar', { caminho, conteudo }),
    salvarComo: (conteudo, nomeSugerido) => ipcRenderer.invoke('projeto:salvar-como', { conteudo, nomeSugerido }),
    exemplo: (nome) => ipcRenderer.invoke('projeto:exemplo', nome),
    aoPedirAbrir: ouvir('projeto:abrir-caminho'),
  },

  recentes: {
    listar: () => ipcRenderer.invoke('recentes:listar'),
    adicionar: (item) => ipcRenderer.invoke('recentes:adicionar', item),
    remover: (caminho) => ipcRenderer.invoke('recentes:remover', caminho),
    limpar: () => ipcRenderer.invoke('recentes:limpar'),
  },

  modulos: {
    externos: () => ipcRenderer.invoke('modulos:externos'),
    abrirPasta: () => ipcRenderer.invoke('modulos:abrir-pasta'),
  },

  janela: {
    definirSujo: (v) => ipcRenderer.send('janela:sujo', v),
    definirTitulo: (t) => ipcRenderer.send('janela:titulo', t),
    definirTema: (t) => ipcRenderer.send('janela:tema', t),
    fecharConfirmado: () => ipcRenderer.send('janela:fechar-confirmado'),
    aoPedirSalvarEFechar: ouvir('janela:salvar-e-fechar'),
    aoComandoDoMenu: ouvir('menu:comando'),
    zoom: (delta) => webFrame.setZoomLevel(delta === 0 ? 0 : webFrame.getZoomLevel() + delta),
  },

  dxf: {
    salvar: (arquivos, caminhoProjeto) => ipcRenderer.invoke('dxf:salvar', { arquivos, caminhoProjeto }),
    abrir: (caminhoProjeto) => ipcRenderer.invoke('dxf:abrir', { caminhoProjeto }),
  },
  ifc: {
    abrir: (caminhoProjeto) => ipcRenderer.invoke('ifc:abrir', { caminhoProjeto }),
    salvar: (conteudo, nomeSugerido, caminhoProjeto) => ipcRenderer.invoke('ifc:salvar', { conteudo, nomeSugerido, caminhoProjeto }),
  },
  tutorial: {
    abrir: (nome) => ipcRenderer.invoke('tutorial:abrir', nome),
    abrirPasta: () => ipcRenderer.invoke('tutorial:abrir-pasta'),
  },
  csv: {
    salvar: (conteudo, nomeSugerido, caminhoProjeto) => ipcRenderer.invoke('csv:salvar', { conteudo, nomeSugerido, caminhoProjeto }),
  },

  pdf: {
    escolherDestino: (nomeSugerido, caminhoProjeto) => ipcRenderer.invoke('pdf:escolher-destino', { nomeSugerido, caminhoProjeto }),
    gravar: (opcoes) => ipcRenderer.invoke('pdf:gravar', opcoes),
  },

  validacao: {
    casos: () => ipcRenderer.invoke('validacao:casos'),
    abrirPasta: () => ipcRenderer.invoke('validacao:abrir-pasta'),
  },

  sistema: {
    info: () => ipcRenderer.invoke('sistema:info'),
    abrirExterno: (url) => ipcRenderer.invoke('sistema:abrir-externo', url),
    mostrarArquivo: (caminho) => ipcRenderer.invoke('sistema:mostrar-arquivo', caminho),
    abrirArquivo: (caminho) => ipcRenderer.invoke('sistema:abrir-arquivo', caminho),
  },

  atualizacao: {
    estado: () => ipcRenderer.invoke('atualizacao:estado'),
    verificar: () => ipcRenderer.invoke('atualizacao:verificar'),
    instalar: () => ipcRenderer.invoke('atualizacao:instalar'),
    aoMudar: ouvir('atualizacao:estado'),
  },
});
