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
 * LEBR — Laboratório de Estruturas Brasil — processo principal (Electron)
 *
 * Responsável apenas pelo que exige acesso ao sistema operacional:
 * janela, diálogos de arquivo, leitura/gravação de projetos, lista de
 * projetos recentes e pasta de módulos externos. Toda a lógica de
 * interface e de cálculo vive no processo de renderização.
 */
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, nativeTheme } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const fss = require('node:fs');
const { pathToFileURL } = require('node:url');
const recentes = require('./recentes.cjs');
const atualizacao = require('./atualizacao.cjs');

const RAIZ = path.join(__dirname, '..', '..');
const EH_MAC = process.platform === 'darwin';
const EXTENSAO = 'lebr.json';
const FILTROS = [
  { name: 'Projeto LEBR', extensions: ['json'] },
  { name: 'Todos os arquivos', extensions: ['*'] },
];

/** Cores da barra de título nativa (Windows/Linux) para cada tema. */
const OVERLAY = {
  claro: { color: '#DCD6CC', symbolColor: '#161514', height: 36 },
  escuro: { color: '#0A0A0A', symbolColor: '#E8E8E8', height: 36 },
  blueprint: { color: '#0E3670', symbolColor: '#FFFFFF', height: 36 },
};

let janela = null;
let sujo = false;
let fechamentoConfirmado = false;

const pastaModulos = () => path.join(app.getPath('userData'), 'modulos');

function criarJanela() {
  janela = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 620,
    title: 'LEBR — Laboratório de Estruturas Brasil',
    backgroundColor: '#EEEBE4',
    titleBarStyle: 'hidden',
    ...(EH_MAC ? { trafficLightPosition: { x: 14, y: 11 } } : { titleBarOverlay: OVERLAY.claro }),
    show: false,
    // Ícone da janela e da barra de tarefas (no macOS o ícone vem do próprio Electron).
    ...(EH_MAC ? {} : { icon: path.join(__dirname, 'icone.png') }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  janela.loadFile(path.join(RAIZ, 'src', 'renderer', 'index.html'));
  janela.once('ready-to-show', () => janela.show());
  if (process.argv.includes('--dev')) janela.webContents.openDevTools({ mode: 'detach' });

  // Links externos abrem no navegador do sistema, nunca dentro do app
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  janela.webContents.on('will-navigate', (e) => e.preventDefault());

  janela.on('close', async (e) => {
    if (!sujo || fechamentoConfirmado) return;
    e.preventDefault();
    const { response } = await dialog.showMessageBox(janela, {
      type: 'warning',
      buttons: ['Salvar', 'Não salvar', 'Cancelar'],
      defaultId: 0,
      cancelId: 2,
      message: 'Deseja salvar as alterações do projeto?',
      detail: 'Suas alterações serão perdidas se você não salvá-las.',
    });
    if (response === 0) janela.webContents.send('janela:salvar-e-fechar');
    if (response === 1) { fechamentoConfirmado = true; janela.close(); }
  });
}

/* ---------------------------------------------------------------- menus */

/**
 * No Windows e no Linux o menu é desenhado pela própria interface (como no VS Code).
 * No macOS mantemos um menu nativo mínimo: ele é necessário para os atalhos de
 * copiar/colar e encaminha os demais itens para a paleta de comandos.
 */
function configurarMenuNativo() {
  if (!EH_MAC) { Menu.setApplicationMenu(null); return; }
  const cmd = (id) => () => janela?.webContents.send('menu:comando', id);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' },
    { label: 'Arquivo', submenu: [
      { label: 'Novo projeto…', accelerator: 'Cmd+N', click: cmd('projeto.novo') },
      { label: 'Abrir projeto…', accelerator: 'Cmd+O', click: cmd('projeto.abrir') },
      { type: 'separator' },
      { label: 'Salvar', accelerator: 'Cmd+S', click: cmd('projeto.salvar') },
      { label: 'Salvar como…', accelerator: 'Shift+Cmd+S', click: cmd('projeto.salvarComo') },
      { type: 'separator' },
      { label: 'Importar modelo IFC…', click: cmd('projeto.importarIFC') },
      { type: 'separator' },
      { label: 'Exportar elemento em PDF…', accelerator: 'Cmd+E', click: cmd('elemento.exportarPdf') },
      { label: 'Exportar pranchas em DXF…', accelerator: 'Shift+Cmd+D', click: cmd('projeto.exportarDXF') },
    ] },
    { role: 'editMenu' },
    { label: 'Exibir', submenu: [
      { label: 'Paleta de comandos…', accelerator: 'Shift+Cmd+P', click: cmd('paleta.abrir') },
      { type: 'separator' },
      { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' },
      { type: 'separator' }, { role: 'togglefullscreen' },
    ] },
    { label: 'Aprender', submenu: [
      { label: 'Todas as lições', click: cmd('ajuda.aprender') },
      { type: 'separator' },
      ...['caminho', 'esforcos', 'flexao', 'viga', 'laje', 'pilar'].map((id, k) => ({
        label: ['01 · O caminho das cargas', '02 · Esforços na viga', '03 · Flexão na seção', '04 · A viga completa', '05 · Laje maciça', '06 · Pilar'][k], click: cmd(`aprender.${id}`),
      })),
      { type: 'separator' },
      { label: 'Tutorial: casa térrea (PDF)', click: cmd('ajuda.tutorialCasa') },
    ] },
    { role: 'windowMenu' },
  ]));
}

/* ------------------------------------------------------------------ IPC */

async function lerProjeto(caminho) {
  const conteudo = await fs.readFile(caminho, 'utf8');
  return { caminho, conteudo };
}

let destinoPdf = null;

const escaparHtml = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Faixa de cabeçalho/rodapé do PDF (o Chromium exige estilos e tamanho de fonte explícitos). */
function modeloFaixa(esquerda, direitaHtml, direitaJaEhHtml = false) {
  const dir = direitaJaEhHtml ? direitaHtml : escaparHtml(direitaHtml);
  return `<div style="width:100%;margin:0 0.55in;display:flex;justify-content:space-between;gap:24px;`
    + `font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:8px;color:#6b6259;`
    + `border-bottom:0;-webkit-print-color-adjust:exact;"><span>${escaparHtml(esquerda)}</span><span>${dir}</span></div>`;
}

function registrarIPC() {
  ipcMain.handle('projeto:abrir-dialogo', async () => {
    const r = await dialog.showOpenDialog(janela, { title: 'Abrir projeto', filters: FILTROS, properties: ['openFile'] });
    if (r.canceled || !r.filePaths[0]) return null;
    return lerProjeto(r.filePaths[0]);
  });

  ipcMain.handle('projeto:ler', (_e, caminho) => lerProjeto(caminho));

  ipcMain.handle('projeto:salvar', async (_e, { caminho, conteudo }) => {
    await fs.writeFile(caminho, conteudo, 'utf8');
    return caminho;
  });

  ipcMain.handle('projeto:salvar-como', async (_e, { conteudo, nomeSugerido }) => {
    const r = await dialog.showSaveDialog(janela, {
      title: 'Salvar projeto',
      defaultPath: path.join(app.getPath('documents'), `${nomeSugerido || 'projeto'}.${EXTENSAO}`),
      filters: FILTROS,
    });
    if (r.canceled || !r.filePath) return null;
    await fs.writeFile(r.filePath, conteudo, 'utf8');
    return r.filePath;
  });

  const EXEMPLOS = { padrao: 'edificio-exemplo.lebr.json', '3-pavimentos': 'edificio-3-pavimentos.lebr.json', terreo: 'residencia-terrea-baldrame.lebr.json', sobrado: 'sobrado-garagem.lebr.json', '18-pavimentos': 'edificio-18-pavimentos.lebr.json', aeroporto: 'terminal-aeroporto.lebr.json', satelite: 'aeroporto-terminal-satelite.lebr.json' };
  ipcMain.handle('projeto:exemplo', (_e, nome) => lerProjeto(path.join(RAIZ, 'exemplos', EXEMPLOS[nome] ?? EXEMPLOS.padrao)));

  ipcMain.handle('recentes:listar', () => recentes.listar());
  ipcMain.handle('recentes:adicionar', (_e, item) => recentes.adicionar(item));
  ipcMain.handle('recentes:remover', (_e, caminho) => recentes.remover(caminho));
  ipcMain.handle('recentes:limpar', () => recentes.limpar());

  ipcMain.handle('modulos:externos', async () => {
    const pasta = pastaModulos();
    if (!fss.existsSync(pasta)) return [];
    const itens = await fs.readdir(pasta, { withFileTypes: true });
    return itens
      .filter((d) => d.isDirectory() && fss.existsSync(path.join(pasta, d.name, 'index.js')))
      .map((d) => ({ pasta: d.name, url: pathToFileURL(path.join(pasta, d.name, 'index.js')).href }));
  });

  ipcMain.handle('modulos:abrir-pasta', async () => {
    await fs.mkdir(pastaModulos(), { recursive: true });
    return shell.openPath(pastaModulos());
  });

  ipcMain.handle('sistema:abrir-externo', (_e, url) => (url.startsWith('https://') ? shell.openExternal(url) : null));
  ipcMain.handle('sistema:mostrar-arquivo', (_e, caminho) => shell.showItemInFolder(caminho));

  // Exportar planilha CSV (quantitativos): o usuário escolhe o destino; o texto vem pronto da interface
  ipcMain.handle('csv:salvar', async (_e, { conteudo, nomeSugerido, caminhoProjeto }) => {
    const pasta = caminhoProjeto && fss.existsSync(path.dirname(caminhoProjeto)) ? path.dirname(caminhoProjeto) : app.getPath('documents');
    const nome = String(nomeSugerido || 'quantitativos').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'quantitativos';
    const r = await dialog.showSaveDialog(janela, { title: 'Exportar quantitativos', defaultPath: path.join(pasta, `${nome}.csv`), filters: [{ name: 'Planilha CSV', extensions: ['csv'] }] });
    if (r.canceled || !r.filePath) return null;
    const destino = r.filePath.toLowerCase().endsWith('.csv') ? r.filePath : `${r.filePath}.csv`;
    await fs.writeFile(destino, String(conteudo), 'utf8');
    return destino;
  });

  // Exportar DXF: escolhe a pasta e grava cada prancha (texto em ANSI 1252, como pede o DXF R12)
  ipcMain.handle('dxf:salvar', async (_e, { arquivos, caminhoProjeto }) => {
    const pasta = caminhoProjeto && fss.existsSync(path.dirname(caminhoProjeto)) ? path.dirname(caminhoProjeto) : app.getPath('documents');
    const r = await dialog.showOpenDialog(janela, { title: 'Exportar pranchas em DXF — escolha a pasta', defaultPath: pasta, properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths?.[0]) return null;
    const destino = r.filePaths[0];
    const gravados = [];
    for (const a of arquivos ?? []) {
      const nome = String(a.nome || 'prancha.dxf').replace(/[\\/:*?"<>|]+/g, '-').trim();
      const caminho = path.join(destino, nome.toLowerCase().endsWith('.dxf') ? nome : `${nome}.dxf`);
      await fs.writeFile(caminho, Buffer.from(String(a.conteudo), 'latin1'));
      gravados.push(caminho);
    }
    return { pasta: destino, arquivos: gravados };
  });

  // Planta de arquitetura em DXF para o fundo da montagem (0.32): só leitura do arquivo escolhido pelo usuário
  ipcMain.handle('dxf:abrir', async (_e, { caminhoProjeto } = {}) => {
    const pasta = caminhoProjeto && fss.existsSync(path.dirname(caminhoProjeto)) ? path.dirname(caminhoProjeto) : app.getPath('documents');
    const r = await dialog.showOpenDialog(janela, { title: 'Planta de arquitetura (DXF)', defaultPath: pasta, properties: ['openFile'], filters: [{ name: 'Desenho DXF', extensions: ['dxf'] }] });
    if (r.canceled || !r.filePaths?.[0]) return null;
    const buf = await fs.readFile(r.filePaths[0]);
    if (buf.length > 60 * 1024 * 1024) throw new Error('Arquivo DXF maior que 60 MB.');
    let texto;
    try { texto = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { texto = new TextDecoder('windows-1252').decode(buf); }
    return { nome: path.basename(r.filePaths[0]), texto };
  });

  // Modelo IFC (etapa L15): só leitura do arquivo escolhido pelo usuário
  ipcMain.handle('ifc:abrir', async (_e, { caminhoProjeto } = {}) => {
    const pasta = caminhoProjeto && fss.existsSync(path.dirname(caminhoProjeto)) ? path.dirname(caminhoProjeto) : app.getPath('documents');
    const r = await dialog.showOpenDialog(janela, { title: 'Modelo BIM (IFC)', defaultPath: pasta, properties: ['openFile'], filters: [{ name: 'Modelo IFC', extensions: ['ifc'] }] });
    if (r.canceled || !r.filePaths?.[0]) return null;
    const buf = await fs.readFile(r.filePaths[0]);
    if (buf.length > 300 * 1024 * 1024) throw new Error('Arquivo IFC maior que 300 MB.');
    let texto;
    try { texto = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { texto = new TextDecoder('windows-1252').decode(buf); }
    return { nome: path.basename(r.filePaths[0]), texto };
  });

  // Exportar modelo IFC4 (0.64): o texto vem pronto da interface (STEP em ASCII, acentos em \X2\); o usuário escolhe o destino
  ipcMain.handle('ifc:salvar', async (_e, { conteudo, nomeSugerido, caminhoProjeto }) => {
    const pasta = caminhoProjeto && fss.existsSync(path.dirname(caminhoProjeto)) ? path.dirname(caminhoProjeto) : app.getPath('documents');
    const nome = String(nomeSugerido || 'modelo').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'modelo';
    const r = await dialog.showSaveDialog(janela, { title: 'Exportar modelo IFC', defaultPath: path.join(pasta, `${nome}.ifc`), filters: [{ name: 'Modelo IFC', extensions: ['ifc'] }] });
    if (r.canceled || !r.filePath) return null;
    const destino = r.filePath.toLowerCase().endsWith('.ifc') ? r.filePath : `${r.filePath}.ifc`;
    await fs.writeFile(destino, String(conteudo), 'utf8');
    return destino;
  });

  // Exportar PDF em duas etapas: a interface pede o destino, prepara a página e só então
  // pede a gravação. O caminho fica guardado aqui, então a interface nunca escolhe onde gravar.
  ipcMain.handle('pdf:escolher-destino', async (_e, { nomeSugerido, caminhoProjeto }) => {
    const pasta = caminhoProjeto && fss.existsSync(path.dirname(caminhoProjeto)) ? path.dirname(caminhoProjeto) : app.getPath('documents');
    const nome = String(nomeSugerido || 'elemento').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'elemento';
    const r = await dialog.showSaveDialog(janela, {
      title: 'Exportar PDF',
      defaultPath: path.join(pasta, `${nome}.pdf`),
      filters: [{ name: 'Documento PDF', extensions: ['pdf'] }],
    });
    destinoPdf = r.canceled || !r.filePath ? null : (r.filePath.toLowerCase().endsWith('.pdf') ? r.filePath : `${r.filePath}.pdf`);
    return destinoPdf;
  });
  ipcMain.handle('pdf:gravar', async (e, { cabecalho = [], rodape = '' } = {}) => {
    if (!destinoPdf) throw new Error('Nenhum destino escolhido para o PDF.');
    const caminho = destinoPdf;
    destinoPdf = null;
    // A cor de fundo da janela pintaria as margens da folha; durante a impressão ela fica branca.
    const fundoAnterior = janela?.getBackgroundColor?.();
    janela?.setBackgroundColor('#FFFFFF');
    const dados = await e.sender.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      scale: 0.78,
      margins: { top: 0.75, bottom: 0.7, left: 0.55, right: 0.55 }, // polegadas
      displayHeaderFooter: true,
      headerTemplate: modeloFaixa(cabecalho[0] ?? '', cabecalho[1] ?? ''),
      footerTemplate: modeloFaixa(rodape, 'Página <span class="pageNumber"></span> de <span class="totalPages"></span>', true),
    }).finally(() => { if (fundoAnterior) janela?.setBackgroundColor(fundoAnterior); });
    await fs.writeFile(caminho, dados);
    return caminho;
  });
  ipcMain.handle('sistema:abrir-arquivo', (_e, caminho) => (String(caminho).toLowerCase().endsWith('.pdf') ? shell.openPath(caminho) : null));
  // Banco de casos de validação (Ajuda › Relatório de validação): só leitura dos JSON da pasta do app
  // no programa empacotado, a pasta fica fora do app.asar (asarUnpack) para poder ser aberta no explorador
  const pastaCasos = path.join(RAIZ, 'validacao', 'casos').replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
  ipcMain.handle('validacao:casos', async () => {
    if (!fss.existsSync(pastaCasos)) return [];
    const nomes = (await fs.readdir(pastaCasos)).filter((n) => n.endsWith('.json')).sort();
    return Promise.all(nomes.map(async (arquivo) => {
      try { return { arquivo, dados: JSON.parse(await fs.readFile(path.join(pastaCasos, arquivo), 'utf8')) }; }
      catch (err) { return { arquivo, erro: err.message }; }
    }));
  });
  ipcMain.handle('validacao:abrir-pasta', () => shell.openPath(pastaCasos));

  // Tutoriais em PDF (pasta tutoriais/, fora do app.asar no programa empacotado)
  const pastaTutoriais = path.join(RAIZ, 'tutoriais').replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
  const TUTORIAIS = { 'casa-terrea': '01-casa-terrea.pdf' };
  ipcMain.handle('tutorial:abrir', (_e, nome) => (TUTORIAIS[nome] ? shell.openPath(path.join(pastaTutoriais, TUTORIAIS[nome])) : null));
  ipcMain.handle('tutorial:abrir-pasta', () => shell.openPath(pastaTutoriais));

  ipcMain.handle('sistema:info', () => ({
    versao: app.getVersion(),
    plataforma: process.platform,
    electron: process.versions.electron,
    arquivoInicial: arquivoDosArgumentos(process.argv),
  }));

  ipcMain.on('janela:sujo', (_e, valor) => { sujo = !!valor; janela?.setDocumentEdited?.(sujo); });
  ipcMain.on('janela:titulo', (_e, titulo) => janela?.setTitle(titulo));
  ipcMain.on('janela:tema', (_e, tema) => {
    nativeTheme.themeSource = tema === 'claro' ? 'light' : 'dark';
    if (!EH_MAC && janela) janela.setTitleBarOverlay(OVERLAY[tema] ?? OVERLAY.claro);
  });
  ipcMain.on('janela:fechar-confirmado', () => { fechamentoConfirmado = true; janela?.close(); });
}

/**
 * O programa se chamava OpenLabViga: na primeira execução com o nome novo,
 * copia a lista de recentes e os módulos externos da pasta de dados antiga.
 */
function migrarDadosAntigos() {
  const novo = app.getPath('userData');
  const antigo = path.join(app.getPath('appData'), 'OpenLabViga');
  if (antigo === novo || !fss.existsSync(antigo)) return;
  fss.mkdirSync(novo, { recursive: true });
  for (const item of ['recentes.json', 'modulos']) {
    const de = path.join(antigo, item), para = path.join(novo, item);
    try { if (fss.existsSync(de) && !fss.existsSync(para)) fss.cpSync(de, para, { recursive: true }); } catch { /* segue sem migrar */ }
  }
}

function arquivoDosArgumentos(argv) {
  return argv.slice(1).find((a) => a.endsWith('.json') && fss.existsSync(a)) ?? null;
}

/* ------------------------------------------------------------ ciclo de vida */

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    if (!janela) return;
    if (janela.isMinimized()) janela.restore();
    janela.focus();
    const arq = arquivoDosArgumentos(argv);
    if (arq) janela.webContents.send('projeto:abrir-caminho', arq);
  });

  app.whenReady().then(() => {
    migrarDadosAntigos();
    recentes.iniciar(app.getPath('userData'));
    registrarIPC();
    configurarMenuNativo();
    criarJanela();
    atualizacao.iniciar(janela);
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) criarJanela(); });
  });

  app.on('window-all-closed', () => { if (!EH_MAC) app.quit(); });
}
