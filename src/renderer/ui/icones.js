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
 * Ícones em traço (24×24, currentColor). Mantidos como texto para não
 * depender de bibliotecas externas.
 */
import { deTexto } from './dom.js';

const P = {
  explorador: '<path d="M4 4h7l2 2h7v13H4z"/><path d="M4 9h16"/>',
  modulos: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><path d="M16.5 13v7M13 16.5h7"/>',
  parametros: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  engrenagem: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  viga: '<path d="M3 9h18v5H3z"/><path d="M5 14l-1.5 4h3zM19 14l-1.5 4h3z"/>',
  laje: '<path d="M3 8l9-4 9 4-9 4z"/><path d="M3 8v4l9 4 9-4V8"/>',
  pilar: '<rect x="8" y="3" width="8" height="18"/><path d="M8 7h8M8 17h8"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  lixeira: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  copiar: '<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V4H4v12h4"/>',
  editar: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
  calcular: '<path d="M7 5l12 7-12 7z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  filtro: '<path d="M4 5h16l-6 7.5V19l-4-2v-4.5z"/>',
  relogio2: '<circle cx="12" cy="12" r="8" stroke-dasharray="3 2.2"/>',
  alerta: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
  busca: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  direita: '<path d="M9 6l6 6-6 6"/>',
  esquerda: '<path d="M15 6l-6 6 6 6"/>',
  baixo: '<path d="M6 9l6 6 6-6"/>',
  pasta: '<path d="M3 6h7l2 2h9v11H3z"/>',
  documento: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  planta: '<rect x="3.5" y="3.5" width="17" height="17"/><path d="M3.5 10h9v10.5M12.5 3.5V7M16 10h4.5"/>',
  cubo: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  girar: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v4h-4"/>',
  console: '<rect x="3" y="4.5" width="18" height="15" rx="1.5"/><path d="M7 10l3 2.5L7 15M12.5 15.5H17"/>',
  atualizar: '<path d="M19.5 8.5A8 8 0 0 0 5 7.2M4.5 15.5A8 8 0 0 0 19 16.8"/><path d="M19.5 3.5v5h-5M4.5 20.5v-5h5"/>',
  pdf: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M12 10v7M9 14.5l3 3 3-3"/>',
  novo: '<path d="M6 3h8l4 4v14H6z"/><path d="M12 11v6M9 14h6"/>',
  salvar: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  tema: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
  painel: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 15h18"/>',
  lateral: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M9 4v16"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  globo: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  carga: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 20h16"/>',
  reticencias: '<circle cx="6" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18" cy="12" r="1.2" fill="currentColor"/>',
  madeira: '<path d="M4 20L20 4M8 20L20 8M4 16L16 4"/>',
  aco: '<path d="M4 5h16M4 19h16M12 5v14"/>',
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  vento: '<path d="M3 8h10a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h7"/>',
  estabilidade: '<path d="M7 21l3-17h4l3 17"/><path d="M8.4 13h7.2M9.4 8h5.2"/><path d="M3 21h18"/>',
  sondagem: '<path d="M12 2v20"/><path d="M8 6h8M8 11h8M8 16h8"/><path d="M9 22h6"/><circle cx="12" cy="6" r="0.6"/>',
  sapata: '<path d="M10 3h4v7h-4z"/><path d="M10 10l-6 5v4h16v-4l-6-5"/><path d="M3 21h18"/>',
  quantitativos: '<path d="M4 4h16v16H4z"/><path d="M4 9h16M4 14h16M9 9v11M15 9v11"/>',
  reservatorio: '<path d="M4 6h16v13H4z"/><path d="M4 11c2.7 1.2 5.3-1.2 8 0s5.3 1.2 8 0"/><path d="M8 19v2M16 19v2"/>',
  camadas: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 17.5l9 5 9-5"/>',
  escada: '<path d="M3 20h4v-4h4v-4h4V8h4V4h2"/><path d="M3 20h18"/>',
  bloco: '<path d="M10 2h4v5h-4z"/><path d="M4 7h16v6H4z"/><path d="M6 13v8M18 13v8M12 13v8"/>',
  estaca: '<path d="M9 3h6v15l-3 3-3-3z"/><path d="M4 7h16"/><path d="M9 11h6M9 15h6"/>',
  aprender: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5"/><path d="M22 9v6"/>',
  roteiro: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
  dividir: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M12 4v16"/>',
  pino: '<path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z"/><path d="M12 14v7"/>',
  juntar: '<rect x="3" y="4" width="18" height="16" rx="1"/>',
};

/** Logotipo do LEBR (o mesmo do ícone do aplicativo): quadrado terracota, "LE BR" e uma viga biapoiada. */
export function logoLebr({ tamanho = 28, classe = 'logo-lebr' } = {}) {
  return deTexto(
    `<svg class="${classe}" width="${tamanho}" height="${tamanho}" viewBox="0 0 1024 1024" aria-label="LEBR" role="img">`
    + '<rect width="1024" height="1024" rx="200" fill="#B85438"/>'
    + '<text x="92" y="404" fill="#fff" font-family="Livvic, sans-serif" font-weight="700" font-size="330" letter-spacing="-10">LE</text>'
    + '<text x="92" y="688" fill="#fff" font-family="Livvic, sans-serif" font-weight="700" font-size="330" letter-spacing="-10">BR</text>'
    + '<rect x="96" y="828" width="832" height="46" fill="#fff"/>'
    + '<path d="M120 944h80l-40-70zM824 944h80l-40-70z" fill="#fff"/></svg>',
  );
}

/** Retorna um elemento <svg> do ícone. */
export function icone(nome, { tamanho = 16, traco = 1.5, classe = 'icone' } = {}) {
  if (nome === 'lebr') return logoLebr({ tamanho, classe: `${classe} logo-lebr` });
  const corpo = P[nome] ?? P.documento;
  return deTexto(
    `<svg class="${classe}" width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${traco}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${corpo}</svg>`,
  );
}

export const nomesIcones = Object.keys(P);
