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
 * Tela inicial: escolher um projeto recente ou criar um novo.
 * Visual inspirado nas fichas de arquivo e no calendário de pontos.
 */
import { h, limpar } from '../ui/dom.js';
import { icone } from '../ui/icones.js';
import * as ui from '../ui/componentes.js';
import { comandos } from '../core/comandos.js';
import { modulos } from '../core/modulos.js';
import { tresDigitos, data } from '../core/formatar.js';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_COLUNAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export function abaInicio({ recentes, abrirCaminho, removerRecente }) {
  return {
    id: 'inicio',
    icone: 'lebr',
    titulo: () => 'Início',
    render(container) {
      const pagina = h('div', { class: 'pagina inicio' });
      container.append(pagina);
      const desenhar = (lista) => {
        limpar(pagina).append(
          h('div', { class: 'inicio-grade' },
            colunaPrincipal(lista ?? [], { abrirCaminho, removerRecente, redesenhar: () => recentes().then(desenhar) }),
            calendario(lista ?? []),
          ),
        );
      };
      desenhar(null);
      recentes().then(desenhar);
    },
  };
}

function colunaPrincipal(lista, { abrirCaminho, removerRecente, redesenhar }) {
  const acao = (id, texto, ic, desc) => {
    const c = comandos.obter(id);
    return h('button', { class: 'inicio-acao', onClick: () => comandos.executar(id) },
      h('span', { class: 'inicio-acao-ic' }, icone(ic, { tamanho: 20, traco: 1.5 })),
      h('span', { class: 'inicio-acao-txt' }, h('strong', null, texto), h('small', null, desc)),
      c?.tecla && h('kbd', null, comandos.rotuloTecla(c.tecla)));
  };

  const recentesEl = lista.length
    ? h('ol', { class: 'recentes' }, lista.map((r, i) => h('li', { class: ['recente', !r.existe && 'ausente'] },
        h('button', { class: 'recente-corpo', disabled: !r.existe, title: r.caminho, onClick: () => abrirCaminho(r.caminho) },
          h('span', { class: 'recente-num' }, `DOC ${tresDigitos(i + 1)}`),
          h('span', { class: 'recente-nome' }, r.nome),
          h('span', { class: 'recente-caminho' }, r.existe ? r.caminho : 'Arquivo não encontrado'),
          h('span', { class: 'recente-meta' }, r.resumo ? `${r.resumo.vigas ?? 0} V · ${r.resumo.lajes ?? 0} L · ${r.resumo.pilares ?? 0} P` : '', h('time', null, data(r.abertoEm)))),
        h('button', { class: 'botao-icone', title: 'Remover da lista', onClick: async () => { await removerRecente(r.caminho); redesenhar(); } }, icone('fechar', { tamanho: 14 })))))
    : h('div', { class: 'recentes-vazio' }, 'Nenhum projeto recente. Crie um projeto novo ou abra o exemplo para conhecer o sistema.');

  return h('div', { class: 'inicio-principal' },
    ui.cabecalhoObjeto({
      rotulo: 'Sistema', numero: 'LEBR', simbolo: 'lebr',
      etiquetas: ['Brasil'],
      linha1: 'Laboratório de Estruturas Brasil',
      linha2: 'Concreto armado e madeira · NBR 6118 · NBR 7190',
      subtitulo: 'Sistema aberto de cálculo estrutural · projetos em JSON aberto',
    }),
    avisoDesenvolvimento(),
    h('div', { class: 'inicio-colunas' },
      h('section', { class: 'inicio-bloco' },
        h('h2', { class: 'inicio-rot' }, 'Iniciar'),
        h('div', { class: 'inicio-acoes' },
          acao('projeto.novo', 'Novo projeto', 'novo', 'Começar com parâmetros da norma'),
          acao('projeto.abrir', 'Abrir projeto…', 'pasta', 'Arquivo .lebr.json do computador'),
          acao('projeto.abrirExemplo', 'Abrir exemplo', 'documento', 'Pavimento com lajes, vigas e pilares'),
          acao('projeto.abrirExemploTerreo', 'Exemplo térreo com baldrame', 'sapata', 'Casa de um pavimento, vigas baldrame e sapatas'),
          acao('projeto.abrirExemplo3', 'Exemplo de 3 pavimentos', 'cubo', 'Edifício com escadas, baldrame e blocos sobre estacas'),
          acao('projeto.abrirExemplo18', 'Exemplo de 18 pavimentos', 'cubo', 'Torre em pórtico espacial com vento e γz'),
        ),
      ),
      h('section', { class: 'inicio-bloco' },
        h('h2', { class: 'inicio-rot' }, 'Recentes'),
        recentesEl,
      ),
    ),
    ui.ficha([
      { rotulo: 'Módulos', valor: `${modulos.lista().length} INSTALADOS` },
      { rotulo: 'Normas', valor: 'NBR 6118 · NBR 7190' },
      { rotulo: 'Formato', valor: 'JSON ABERTO' },
      { rotulo: 'Licença', valor: 'GPL-3.0' },
      { rotulo: 'Descrição', valor: 'Projeto modular: novos tipos de laje, madeira e aço entram como módulos', largura: 3 },
      { rotulo: 'Documento nº', valor: `LEBR.000.${new Date().getFullYear()}` },
    ], { colunas: 4 }),
  );
}

/**
 * Aviso permanente: software em fase inicial, sem uso em projetos reais, e o convite para colaborar com estudos de
 * caso e validação independente das funções (cálculo manual ou planilha).
 */
function avisoDesenvolvimento() {
  return h('section', { class: 'inicio-aviso', role: 'note' },
    h('div', { class: 'inicio-aviso-cab' }, icone('alerta', { tamanho: 18, traco: 1.7 }), h('strong', null, 'Software em fase inicial de desenvolvimento')),
    h('p', null, 'O LEBR ainda ', h('b', null, 'não deve ser usado para calcular estruturas reais'), '. Cada função precisa ser conferida de forma independente antes de chegar a um projeto.'),
    h('p', null, h('b', null, 'Procuramos colaboradores'), ' para criar ', h('b', null, 'estudos de caso'), ' e fazer a ', h('b', null, 'validação independente de cada função'),
      ', com cálculos feitos à mão ou em planilhas, comparados com os resultados do programa. Engenheiros, professores e estudantes são bem-vindos.'),
    h('div', { class: 'inicio-aviso-acoes' },
      ui.botao({ texto: 'Como colaborar', icone: 'info', tipo: 'secundario', aoClicar: () => comandos.executar('ajuda.colaborar') }),
      ui.botao({ texto: 'Relatório de validação', icone: 'check', tipo: 'fantasma', aoClicar: () => comandos.executar('ajuda.validacao') }),
      ui.botao({ texto: 'Roteiro', icone: 'roteiro', tipo: 'fantasma', aoClicar: () => comandos.executar('ajuda.roteiro') })),
  );
}

/** Cartão de calendário: dia em destaque e grade de pontos do mês. */
function calendario(lista) {
  const hoje = new Date();
  const ano = hoje.getFullYear(), mes = hoje.getMonth(), dia = hoje.getDate();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const inicioSemana = (new Date(ano, mes, 1).getDay() + 6) % 7; // segunda = 0
  const ativos = new Set(lista.filter((r) => r.abertoEm).map((r) => new Date(r.abertoEm)).filter((d) => d.getFullYear() === ano && d.getMonth() === mes).map((d) => d.getDate()));

  const celulas = [
    ...Array(inicioSemana).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => {
      const d = i + 1;
      if (d === dia) return { destaque: true, titulo: 'Hoje' };
      return { nivel: ativos.has(d) ? 1 : null, titulo: ativos.has(d) ? `Projetos abertos em ${d}/${mes + 1}` : `${d}/${mes + 1}` };
    }),
  ];
  // completa a última semana para a malha fechar
  while (celulas.length % 7) celulas.push(null);

  return h('aside', { class: 'cal' },
    h('span', { class: 'cal-dia' }, String(dia)),
    h('div', { class: 'cal-linha' },
      h('div', null, h('strong', null, MESES[mes].toUpperCase()), h('span', null, String(ano))),
      h('strong', { class: 'cal-semana' }, DIAS[hoje.getDay()].toUpperCase())),
    ui.gradePontos({ colunas: 7, rotulosColunas: DIAS_COLUNAS, celulas }),
    h('p', { class: 'cal-leg' }, h('i', { class: 'leg-ponto' }), 'Dias com projetos abertos neste mês', h('i', { class: 'leg-ponto hoje' }), 'Hoje'),
  );
}
