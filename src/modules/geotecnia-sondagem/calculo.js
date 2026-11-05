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
 * Sondagem SPT (NBR 6484:2020) — dados do furo e conferência do boletim, sem interface.
 * O "cálculo" organiza as camadas com o NSPT de cada uma, classifica a compacidade ou consistência
 * (Anexo A) e confere o boletim (camadas, ensaios a cada metro, nível d'água).
 */
import { analisarSondagem, PARALISACOES } from '../../engine/sondagem.js';

const f = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');

export function criarSondagem() {
  return {
    local: { x: 0, y: 0 },        // m — posição na planta do projeto
    cotaBoca: 0,                  // m — cota da boca do furo no referencial do projeto (terreno = 0)
    data: '', empresa: '', responsavel: '', observacoes: '',
    nivelAgua: { inicial: 3.5, final: 3.6, seco: false },   // profundidades (m)
    limite: 10.45, paralisacao: 'impenetravel',
    camadas: [
      { id: 'k1', ate: 1.0, solo: 'aterro', secundario: '', cor: 'marrom', origem: 'aterro', descricao: 'argila arenosa com entulho' },
      { id: 'k2', ate: 4.2, solo: 'argila', secundario: 'siltoso', cor: 'vermelha', origem: 'coluvionar', descricao: '' },
      { id: 'k3', ate: 8.0, solo: 'silte', secundario: 'arenoso', cor: 'amarelo', origem: 'residual', descricao: '' },
      { id: 'k4', ate: 10.45, solo: 'areia', secundario: 'siltoso', cor: 'cinza', origem: 'residual', descricao: '' },
    ],
    spt: [
      { prof: 1, n: 3, pen: 30 }, { prof: 2, n: 4, pen: 30 }, { prof: 3, n: 5, pen: 30 }, { prof: 4, n: 7, pen: 30 },
      { prof: 5, n: 9, pen: 30 }, { prof: 6, n: 12, pen: 30 }, { prof: 7, n: 16, pen: 30 }, { prof: 8, n: 21, pen: 30 },
      { prof: 9, n: 29, pen: 30 }, { prof: 10, n: 50, pen: 15 },
    ],
  };
}

export function calcularSondagem(el) {
  const a = analisarSondagem(el);
  const memorial = [
    { titulo: 'Furo', linhas: [
      `Boca na cota ${f(a.cotaBoca)} m, em (${f(el.local?.x ?? 0)}; ${f(el.local?.y ?? 0)}) m da planta. Profundidade ${f(a.limite)} m (cota ${f(a.cotaFundo)} m).`,
      `Paralisação: ${PARALISACOES[el.paralisacao] ?? '—'}.`,
      a.nivelAgua.seco ? 'Nível d’água: furo seco.' : `Nível d’água: inicial ${a.nivelAgua.inicial != null ? `${f(a.nivelAgua.inicial)} m (cota ${f(a.nivelAgua.cotaInicial)})` : 'não informado'}${a.nivelAgua.final != null ? `, final ${f(a.nivelAgua.final)} m (cota ${f(a.nivelAgua.cotaFinal)})` : ''}.`,
      'Ensaio SPT (NBR 6484:2020): amostrador padrão cravado 45 cm com martelo de 65 kg caindo 75 cm; NSPT = golpes dos últimos 30 cm (golpes/penetração quando a cravação para antes).',
    ] },
    { titulo: 'Camadas (NBR 6484:2020, Anexo A)', linhas: a.camadas.map((c) => `${f(c.de)} a ${f(c.ate)} m (cotas ${f(c.cotaTopo)} a ${f(c.cotaBase)}): ${c.descricao}${c.nMin != null ? ` — NSPT ${f(c.nMin, 0)}${c.nMax !== c.nMin ? ` a ${f(c.nMax, 0)}` : ''}, médio ${f(c.nMedio, 1)}` : ''}`) },
  ];
  return {
    ok: a.verificacoes.every((v) => v.ok),
    avisos: a.avisos,
    verificacoes: a.verificacoes,
    memorial,
    ...a,
  };
}
