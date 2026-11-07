/*
 * LEBR — Laboratório de Estruturas Brasil
 * Copyright (C) 2026 Daniel Michelon De Carli
 *
 * Feito com uso da inteligência artificial Claude, sob a orientação de Daniel Michelon De Carli.
 *
 * Este programa é software livre: você pode redistribuí-lo e/ou modificá-lo nos termos da GNU General Public
 * License, versão 3, publicada pela Free Software Foundation. É distribuído na esperança de ser útil, mas SEM
 * NENHUMA GARANTIA, nem mesmo a garantia implícita de COMERCIALIZAÇÃO ou de ADEQUAÇÃO A UMA FINALIDADE
 * ESPECÍFICA. Veja o arquivo LICENSE ou <https://www.gnu.org/licenses/gpl-3.0.html>.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 */
/**
 * Atualização automática pelo GitHub (releases de https://github.com/danielcarli/lebr).
 *
 * Só funciona no aplicativo instalado (instalador do Windows); no código-fonte e no executável portátil o
 * electron-updater não tem onde instalar, então nada é verificado. O fluxo: ao abrir, o programa consulta o
 * latest.yml da última release; se houver versão mais nova, baixa em segundo plano e avisa a interface, que
 * oferece "Reiniciar e atualizar". O comando ajuda.atualizar faz a verificação a pedido.
 */
const { app, ipcMain } = require('electron');

let autoUpdater = null;
let janela = null;
let estado = { fase: 'ocioso', versao: null, progresso: 0, erro: null };

function enviar() { janela?.webContents.send('atualizacao:estado', estado); }
function mudar(parcial) { estado = { ...estado, ...parcial }; enviar(); }

function iniciar(j) {
  janela = j;
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR) {
    estado = { ...estado, fase: 'indisponivel' };
    registrar();
    return;
  }
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch {
    estado = { ...estado, fase: 'indisponivel' };
    registrar();
    return;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = null;
  autoUpdater.on('checking-for-update', () => mudar({ fase: 'verificando', erro: null }));
  autoUpdater.on('update-available', (info) => mudar({ fase: 'baixando', versao: info.version, progresso: 0 }));
  autoUpdater.on('update-not-available', () => mudar({ fase: 'atualizado' }));
  autoUpdater.on('download-progress', (p) => mudar({ fase: 'baixando', progresso: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (info) => mudar({ fase: 'pronto', versao: info.version, progresso: 100 }));
  autoUpdater.on('error', (err) => mudar({ fase: 'erro', erro: String(err?.message ?? err) }));
  registrar();
  // verificação silenciosa alguns segundos depois de abrir (não atrasa a janela)
  setTimeout(() => verificar(false), 8000);
}

function verificar(manual) {
  if (!autoUpdater) { mudar({ fase: 'indisponivel', manual }); return; }
  mudar({ manual });
  autoUpdater.checkForUpdates().catch((err) => mudar({ fase: 'erro', erro: String(err?.message ?? err) }));
}

function registrar() {
  ipcMain.handle('atualizacao:estado', () => estado);
  ipcMain.handle('atualizacao:verificar', () => { verificar(true); return estado; });
  ipcMain.handle('atualizacao:instalar', () => { if (autoUpdater && estado.fase === 'pronto') autoUpdater.quitAndInstall(false, true); });
}

module.exports = { iniciar };
