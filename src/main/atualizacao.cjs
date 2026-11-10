/*
 * LEBR — Laboratório de Estruturas Brasil
 * Copyright (C) 2026 Daniel Michelon De Carli
 *
 * Feito com uso da inteligência artificial Claude, sob a orientação de Daniel Michelon De Carli.
 *
 * Este programa é software livre: você pode redistribuí-lo e/ou modificá-lo nos termos da GNU Affero General
 * Public License, versão 3, publicada pela Free Software Foundation. É distribuído na esperança de ser útil, mas
 * SEM NENHUMA GARANTIA, nem mesmo a garantia implícita de COMERCIALIZAÇÃO ou de ADEQUAÇÃO A UMA FINALIDADE
 * ESPECÍFICA. Veja o arquivo LICENSE ou <https://www.gnu.org/licenses/agpl-3.0.html>.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * Atualização do LEBR, conforme a forma como ele foi instalado:
 *
 * - **Instalador que monta o programa no computador** (LEBR-Instalador.exe, Inno Setup): o programa consulta a
 *   última release em api.github.com/repos/danielcarli/lebr e, havendo versão mais nova, oferece "Atualizar agora",
 *   que fecha o LEBR e roda de novo o instalador guardado em %LOCALAPPDATA%\LEBR-Instalador (/ATUALIZAR: baixa o
 *   código-fonte novo, confere, testa, monta e reabre o programa).
 * - **Instalador com o programa pronto** (electron-builder, quando houver app-update.yml nos recursos — no Linux, o
 *   AppImage e o pacote .deb): o electron-updater baixa a versão nova em segundo plano e oferece "Reiniciar e
 *   atualizar" (no .deb, o sistema pede a senha de administrador para instalar o pacote novo).
 * - **macOS** (.dmg sem assinatura da Apple): o atualizador automático do macOS exige app assinado, então a
 *   verificação avisa da versão nova e abre a página de download, como no código-fonte.
 *
 * - Código-fonte (npm start) e executável portátil: a verificação só avisa da versão nova e abre a página de download.
 *
 * Ao abrir (e a cada 6 h), a verificação é silenciosa; a versão aparece na barra inferior, onde um clique verifica
 * a pedido e, havendo versão nova, atualiza depois de confirmar (comando ajuda.atualizar).
 */
const { app, ipcMain, net, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const REPOSITORIO = 'danielcarli/lebr';
let autoUpdater = null;
let atualizador = null;   // caminho do LEBR-Instalador.exe (modo instalador)
let soAviso = false;      // código-fonte ou portátil: só avisa da versão nova e abre a página de download
let janela = null;
let estado = { fase: 'ocioso', versao: null, progresso: 0, erro: null };
const SEIS_HORAS = 6 * 3600 * 1000;   // com o programa aberto por muito tempo, verifica de novo

function enviar() { janela?.webContents.send('atualizacao:estado', estado); }
function mudar(parcial) { estado = { ...estado, ...parcial }; enviar(); }

/** compara versões x.y.z: > 0 quando a é mais nova que b */
function compararVersoes(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0), pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}

/** Tag da última release pela API do GitHub; em instabilidade (5xx, 403/429 do limite, rede), pela página de releases. */
async function ultimaTag() {
  try {
    const r = await net.fetch(`https://api.github.com/repos/${REPOSITORIO}/releases/latest`, {
      headers: { 'User-Agent': 'LEBR', Accept: 'application/vnd.github+json' },
    });
    if (r.ok) return String((await r.json()).tag_name ?? '');
    if (r.status === 404) throw new Error('nenhuma release publicada');
  } catch (err) {
    if (/nenhuma release/.test(err?.message)) throw err;
  }
  // github.com/<repo>/releases/latest redireciona para .../releases/tag/<tag>: lê o destino sem segui-lo
  const destino = await new Promise((ok, falha) => {
    const req = net.request({ url: `https://github.com/${REPOSITORIO}/releases/latest`, redirect: 'manual' });
    req.setHeader('User-Agent', 'LEBR');
    req.on('redirect', (_status, _metodo, url) => { ok(url); req.abort(); });
    req.on('response', (res) => { res.on('data', () => {}); ok(null); });
    req.on('error', falha);
    req.end();
  });
  const m = /\/releases\/tag\/([^/?#]+)$/.exec(destino ?? '');
  if (!m) throw new Error('o GitHub não respondeu; tente de novo em alguns minutos');
  return decodeURIComponent(m[1]);
}

async function verificarNoGitHub(manual) {
  mudar({ fase: 'verificando', erro: null, manual });
  try {
    const tag = await ultimaTag();
    const versao = tag.replace(/^v/, '');
    if (!/^\d+\.\d+\.\d+$/.test(versao)) throw new Error(`tag inesperada: ${tag}`);
    mudar(compararVersoes(versao, app.getVersion()) > 0 ? { fase: 'disponivel', versao, instalavel: !!atualizador } : { fase: 'atualizado', versao });
  } catch (err) {
    mudar({ fase: 'erro', erro: String(err?.message ?? err) });
  }
}

function iniciar(j) {
  janela = j;
  const yml = path.join(process.resourcesPath ?? '', 'app-update.yml');
  const exe = path.join(process.env.LOCALAPPDATA ?? '', 'LEBR-Instalador', 'LEBR-Instalador.exe');
  if (app.isPackaged && process.platform === 'win32' && !fs.existsSync(yml) && fs.existsSync(exe)) {
    atualizador = exe;
    registrar();
    setTimeout(() => verificarNoGitHub(false), 8000);
    setInterval(() => { if (estado.fase !== 'disponivel') verificarNoGitHub(false); }, SEIS_HORAS);
    return;
  }
  // macOS sem assinatura não se atualiza sozinho; no Linux, o electron-updater só trata o AppImage e o .deb
  const semAutomatico = process.platform === 'darwin'
    || (process.platform === 'linux' && !process.env.APPIMAGE && !fs.existsSync(path.join(process.resourcesPath ?? '', 'package-type')));
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR || !fs.existsSync(yml) || semAutomatico) {
    estado = { ...estado, fase: 'indisponivel' };
    soAviso = true;
    registrar();
    // portátil e macOS: avisam sozinhos; pelo código-fonte (npm start) só a pedido
    if (app.isPackaged) setTimeout(() => verificarNoGitHub(false), 8000);
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
  setInterval(() => { if (!['baixando', 'pronto'].includes(estado.fase)) verificar(false); }, SEIS_HORAS);
}

function verificar(manual) {
  if (atualizador || soAviso) { verificarNoGitHub(manual); return; }
  if (!autoUpdater) { mudar({ fase: 'indisponivel', manual }); return; }
  mudar({ manual });
  autoUpdater.checkForUpdates().catch((err) => mudar({ fase: 'erro', erro: String(err?.message ?? err) }));
}

function registrar() {
  ipcMain.handle('atualizacao:estado', () => estado);
  ipcMain.handle('atualizacao:verificar', () => { verificar(true); return estado; });
  ipcMain.handle('atualizacao:instalar', () => {
    if (atualizador && estado.fase === 'disponivel') {
      // roda o instalador em modo de atualização (pula as telas iniciais e reabre o LEBR no fim) e fecha o programa
      spawn(atualizador, ['/ATUALIZAR', '/SP-'], { detached: true, stdio: 'ignore' }).unref();
      setTimeout(() => app.quit(), 300);
    } else if (autoUpdater && estado.fase === 'pronto') autoUpdater.quitAndInstall(false, true);
    else if (soAviso && estado.fase === 'disponivel') shell.openExternal(`https://github.com/${REPOSITORIO}/releases/latest`);
  });
}

module.exports = { iniciar };
