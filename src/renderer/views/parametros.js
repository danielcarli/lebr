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
 * Parâmetros globais do projeto: identificação, materiais, durabilidade e ações.
 * Qualquer mudança aqui invalida os resultados de todos os elementos.
 */
import { h } from '../ui/dom.js';
import * as ui from '../ui/componentes.js';
import { icone } from '../ui/icones.js';
import { estado } from '../core/estado.js';
import { num } from '../core/formatar.js';
import { concreto, aco, COBRIMENTO_MM, FCK_MIN } from '../../engine/materiais.js';
import { PSI_USO, coeficientesAcoes, casosPadrao, casosGlobais, gerarCombinacoes } from '../../engine/combinacoes.js';
import { porticoDoEdificio, ROTULO_ACAO } from '../../modules/comum/portico-edificio.js';
import { modulos } from '../core/modulos.js';
import { parametrosMadeira, CLASSES_MADEIRA, GRUPOS_MADEIRA, CARREGAMENTOS, UMIDADES } from '../../engine/madeira.js';

const CLASSES_FCK = [20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90];

export function abaParametros() {
  return {
    id: 'parametros',
    icone: 'parametros',
    titulo: () => 'Parâmetros do projeto',
    render(container) {
      const p = estado.projeto;
      if (!p) return;
      const par = p.parametros;
      const mudar = (fn, estrutural = false) => estado.alterar((proj) => {
        fn(proj);
        for (const e of proj.elementos) if (e.resultado) e.resultado.desatualizado = true;
      }, { descricao: 'Parâmetros do projeto', tipo: 'parametros', estrutural });
      const mudarMeta = (fn) => estado.alterar(fn, { descricao: 'Identificação do projeto', tipo: 'meta' });

      let c = null, s = null;
      try { c = concreto(par.concreto.fck, { gc: par.coeficientes.gc, agregado: par.concreto.agregado }); s = aco(par.aco.fyk, { gs: par.coeficientes.gs }); } catch { /* fck inválido */ }

      const pagina = h('div', { class: 'pagina' },
        ui.cabecalhoObjeto({
          rotulo: 'Projeto', numero: 'PRJ', etiquetas: ['LEBR', 'Projeto', 'Parâmetros'], simbolo: 'parametros',
          linha1: 'Parâmetros globais', linha2: `${par.norma} · formato aberto JSON`,
          titulo: p.meta.nome,
          subtitulo: `${p.elementos.length} elementos · alterar os parâmetros invalida os resultados calculados`,
          aoRenomear: (nome) => mudarMeta((proj) => { proj.meta.nome = nome; }),
        }),

        ui.secao({
          numero: '01', titulo: 'Identificação',
          filhos: [ui.linhaCampos(
            ui.texto({ rotulo: 'Nome do projeto', valor: p.meta.nome, largura: '280px', aoMudar: (v) => mudarMeta((proj) => { proj.meta.nome = v || 'Projeto sem título'; }) }),
            ui.texto({ rotulo: 'Responsável técnico', valor: p.meta.autor, largura: '240px', aoMudar: (v) => mudarMeta((proj) => { proj.meta.autor = v; }) }),
            ui.texto({ rotulo: 'Descrição', valor: p.meta.descricao, largura: '380px', aoMudar: (v) => mudarMeta((proj) => { proj.meta.descricao = v; }) }),
          )],
        }),

        ui.secao({
          numero: '02', titulo: 'Unidades', descricao: 'Como as dimensões aparecem na tela, no memorial e no PDF — o arquivo e o cálculo continuam em centímetros',
          filhos: [ui.linhaCampos(
            ui.segmentado({
              rotulo: 'Dimensões', valor: par.unidades?.comprimento ?? 'cm',
              opcoes: [
                { valor: 'cm', texto: 'Centímetros (cm)', dica: 'b = 20 cm, h = 50 cm, cobrimento 3 cm, estribos c/ 15' },
                { valor: 'mm', texto: 'Milímetros (mm)', dica: 'b = 200 mm, h = 500 mm, cobrimento 30 mm, estribos c/ 150' },
              ],
              aoMudar: (v) => estado.alterar((proj) => { proj.parametros.unidades = { ...(proj.parametros.unidades ?? {}), comprimento: v }; }, { descricao: 'Unidade das dimensões', tipo: 'unidades', estrutural: true }),
            }),
          ), h('p', { class: 'combinacoes-nota' }, 'Vale para larguras, alturas, espessuras, cobrimentos, alturas úteis, dimensões de pilares e cargas concentradas e espaçamentos das barras. Áreas de aço seguem em cm², vãos e cotas da planta em m, flechas e aberturas de fissura em mm.')],
        }),

        ui.secao({
          numero: '03', titulo: 'Materiais',
          filhos: [
            ui.linhaCampos(
              ui.selecao({ rotulo: 'Concreto', valor: par.concreto.fck, opcoes: CLASSES_FCK.map((f) => ({ valor: f, texto: `C${f}` })), aoMudar: (v) => mudar((proj) => { proj.parametros.concreto.fck = v; }, true) }),
              ui.selecao({ rotulo: 'Agregado graúdo', valor: par.concreto.agregado, largura: '150px', opcoes: [['basalto', 'Basalto / diabásio'], ['granito', 'Granito / gnaisse'], ['calcario', 'Calcário'], ['arenito', 'Arenito']].map(([v, t]) => ({ valor: v, texto: t })), aoMudar: (v) => mudar((proj) => { proj.parametros.concreto.agregado = v; }, true) }),
              ui.campo({ rotulo: 'Dimensão máx.', valor: par.agregadoDmax, unidade: 'mm', casas: 0, min: 9.5, max: 50, aoMudar: (v) => mudar((proj) => { proj.parametros.agregadoDmax = v; }) }),
              ui.selecao({ rotulo: 'Aço', valor: par.aco.fyk, opcoes: [{ valor: 500, texto: 'CA-50' }, { valor: 600, texto: 'CA-60' }, { valor: 250, texto: 'CA-25' }], aoMudar: (v) => mudar((proj) => { proj.parametros.aco.fyk = v; }, true) }),
              ui.campo({ rotulo: 'γc', valor: par.coeficientes.gc, casas: 2, min: 1, max: 2, largura: '90px', aoMudar: (v) => mudar((proj) => { proj.parametros.coeficientes.gc = v; }, true) }),
              ui.campo({ rotulo: 'γs', valor: par.coeficientes.gs, casas: 2, min: 1, max: 2, largura: '90px', aoMudar: (v) => mudar((proj) => { proj.parametros.coeficientes.gs = v; }, true) }),
            ),
            c && ui.ficha([
              { rotulo: 'fcd', valor: `${num(c.fcd)} MPa` },
              { rotulo: 'ηc (2023)', valor: num(c.etaC, 3) },
              { rotulo: 'σcd = αc·ηc·fcd', valor: `${num(c.sigmaCd)} MPa` },
              { rotulo: 'fctm', valor: `${num(c.fctm, 3)} MPa` },
              { rotulo: 'Eci', valor: `${num(c.Eci, 0)} MPa` },
              { rotulo: 'Ecs', valor: `${num(c.Ecs, 0)} MPa` },
              { rotulo: 'εcu', valor: `${num(c.ecu, 2)} ‰` },
              { rotulo: 'fyd', valor: `${num(s.fyd)} MPa` },
            ], { colunas: 4 }),
          ],
        }),

        ui.secao({
          numero: '04', titulo: 'Durabilidade e serviço', descricao: 'Classe de agressividade (Tabelas 6.1, 7.1 e 7.2) — também define o limite de abertura de fissuras (Tabela 13.4)',
          filhos: [
            ui.linhaCampos(
              ui.segmentado({
                rotulo: 'CAA', valor: par.classeAgressividade,
                opcoes: ['I', 'II', 'III', 'IV'].map((k) => ({ valor: k, texto: k, dica: `fck mínimo C${FCK_MIN[k]}` })),
                aoMudar: (v) => mudar((proj) => {
                  proj.parametros.classeAgressividade = v;
                  for (const t of ['viga', 'pilar', 'laje']) proj.parametros.cobrimento[t] = COBRIMENTO_MM[t][v] / 10;
                }, true),
              }),
              ui.campo({ rotulo: 'Cobrimento vigas', valor: par.cobrimento.viga, unidade: 'cm', casas: 1, min: 1, max: 10, aoMudar: (v) => mudar((proj) => { proj.parametros.cobrimento.viga = v; }) }),
              ui.campo({ rotulo: 'Cobrimento pilares', valor: par.cobrimento.pilar, unidade: 'cm', casas: 1, min: 1, max: 10, aoMudar: (v) => mudar((proj) => { proj.parametros.cobrimento.pilar = v; }) }),
              ui.campo({ rotulo: 'Cobrimento lajes', valor: par.cobrimento.laje, unidade: 'cm', casas: 1, min: 1, max: 10, aoMudar: (v) => mudar((proj) => { proj.parametros.cobrimento.laje = v; }) }),
              ui.campo({
                rotulo: 'Idade no carregamento', valor: par.els?.t0 ?? 1, unidade: 'meses', casas: 1, min: 0.5, max: 70, largura: '170px',
                dica: 'Quando a carga de longa duração passa a atuar (retirada do escoramento, alvenarias). Define αf da flecha diferida pela Tabela 17.1: 1 mês → αf = 1,32.',
                aoMudar: (v) => mudar((proj) => { proj.parametros.els = { ...(proj.parametros.els ?? {}), t0: v }; }),
              }),
            ),
            par.concreto.fck < FCK_MIN[par.classeAgressividade] && h('ul', { class: 'avisos' }, h('li', null, icone('alerta', { tamanho: 14, traco: 1.8 }), `A classe ${par.classeAgressividade} exige concreto C${FCK_MIN[par.classeAgressividade]} ou superior.`)),
          ],
        }),

        secaoCombinacoes(p, par, mudar),

        ui.secao({
          numero: '06', titulo: 'Análise global', descricao: 'Pórtico espacial do edifício (NBR 6118, 14.6): vigas e pilares de todos os pavimentos, lajes como diafragma rígido',
          filhos: [
            ui.linhaCampos(ui.segmentado({
              rotulo: 'Esforços nos pilares', valor: par.analiseGlobal?.pilares ?? 'elementos',
              opcoes: [
                { valor: 'elementos', texto: 'Cargas dos elementos', dica: 'Normal pela soma das reações das vigas e do pilar de cima; momentos informados no pilar' },
                { valor: 'portico', texto: 'Pórtico espacial', dica: 'Normal e momentos nas pontas de cada lance pelo pórtico do edifício' },
              ],
              aoMudar: (v) => mudar((proj) => { proj.parametros.analiseGlobal = { ...(proj.parametros.analiseGlobal ?? {}), pilares: v }; }, true),
            })),
            h('p', { class: 'combinacoes-nota' }, 'O pórtico é montado a partir da planta (Montagem da estrutura): pilares de concreto de todos os lances, engastados na fundação, e as vigas de concreto de cada pavimento com as mesmas cargas da grelha. Com "Pórtico espacial", cada pilar usa a normal e os momentos de 1ª ordem do seu lance; os dois resultados aparecem lado a lado no pilar. As vigas continuam pela análise escolhida em cada pavimento (isoladas ou grelha). A deformada aparece na Visualização 3D.'),
          ],
        }),

        secaoMadeira(par, mudar),

        ui.secao({
          numero: '08', titulo: 'Montagem', descricao: 'Tolerância geométrica do lançamento na planta',
          filhos: [
            ui.linhaCampos(ui.campo({
              rotulo: 'Tolerância geométrica', valor: par.montagem?.tolerancia ?? 1, unidade: 'mm', casas: 1, min: 0, max: 50, largura: '190px',
              dica: 'Um apoio de viga a menos disso da face de um pilar conta como apoiado nele, e Limpar geometria funde os nós mais próximos que isso. Folgas acima da tolerância (até 20 mm ou cinco vezes a tolerância) aparecem como aviso na montagem.',
              aoMudar: (v) => estado.alterar((proj) => { proj.parametros.montagem = { ...(proj.parametros.montagem ?? {}), tolerancia: v }; }, { descricao: 'Tolerância geométrica', tipo: 'parametros', estrutural: true }),
            })),
            ui.linhaCampos(ui.segmentado({
              rotulo: 'Calcular com erros de montagem', valor: par.montagem?.erros ?? 'perguntar',
              opcoes: [
                { valor: 'perguntar', texto: 'Perguntar', dica: 'Calcular todos mostra os erros e pergunta; o cálculo de um elemento roda e registra o aviso na Saída' },
                { valor: 'calcular', texto: 'Calcular mesmo assim', dica: 'Calcula sem perguntar; os erros continuam no painel Problemas e na barra de status' },
                { valor: 'bloquear', texto: 'Bloquear', dica: 'Como nos programas consolidados: nada é calculado enquanto houver erro de montagem' },
              ],
              aoMudar: (v) => estado.alterar((proj) => { proj.parametros.montagem = { ...(proj.parametros.montagem ?? {}), erros: v }; }, { descricao: 'Calcular com erros de montagem', tipo: 'parametros', estrutural: true }),
            })),
            h('p', { class: 'combinacoes-nota' }, 'Padrão de 1 mm, como nos programas de análise (um nó a menos de 1 mm de uma barra é considerado sobre ela). Use Estrutura › Limpar geometria para corrigir a planta com esta tolerância ou com uma maior.'),
          ],
        }),
      );
      container.append(pagina);
      return {
        aoAlterar: (info) => info.tipo === 'meta' || (info.tipo === 'parametros' && !info.estrutural),
      };
    },
  };
}

/** Parâmetros dos elementos de madeira (NBR 7190-1:2022). */
function secaoMadeira(par, mudar) {
  const pm = parametrosMadeira(par.madeira);
  const set = (k) => (v) => mudar((proj) => { proj.parametros.madeira = { ...parametrosMadeira(proj.parametros.madeira), [k]: v }; }, true);
  const classes = Object.entries(GRUPOS_MADEIRA).flatMap(([g, nome]) =>
    CLASSES_MADEIRA.filter((c) => c.grupo === g).map((c) => ({ valor: c.id, texto: `${c.nome} — ${nome.replace('Peças estruturais — ', '').replace(' (corpos de prova)', '')}` })));
  return ui.secao({
    numero: '07', titulo: 'Madeira', descricao: 'NBR 7190-1:2022 — valem para vigas, pilares e entrepisos de madeira',
    filhos: [
      ui.linhaCampos(
        ui.selecao({ rotulo: 'Classe de umidade', valor: pm.umidade, largura: '270px', opcoes: UMIDADES, aoMudar: set('umidade') }),
        ui.selecao({ rotulo: 'Classe padrão (novos elementos)', valor: pm.classe, largura: '250px', opcoes: classes, aoMudar: set('classe') }),
        ui.selecao({ rotulo: 'Duração padrão da carga', valor: pm.carregamento, largura: '280px', opcoes: CARREGAMENTOS, aoMudar: set('carregamento') }),
      ),
      ui.linhaCampos(
        ui.campo({ rotulo: 'γw normais', valor: pm.gwc, casas: 2, min: 1, max: 3, largura: '110px', aoMudar: set('gwc') }),
        ui.campo({ rotulo: 'γw cisalhamento', valor: pm.gwv, casas: 2, min: 1, max: 3, largura: '130px', aoMudar: set('gwv') }),
        ui.campo({ rotulo: 'γg madeira', valor: pm.gg, casas: 2, min: 1, max: 2, largura: '110px', aoMudar: set('gg') }),
        ui.campo({ rotulo: 'γq madeira', valor: pm.gq, casas: 2, min: 1, max: 2, largura: '110px', aoMudar: set('gq') }),
        ui.selecao({ rotulo: 'Limite de flecha', valor: pm.flecha, largura: '140px', opcoes: [200, 250, 300, 350].map((v) => ({ valor: v, texto: `L/${v}` })), aoMudar: set('flecha') }),
      ),
    ],
  });
}

/** Ações e combinações (NBR 8681 · NBR 6118, 11.7 e 11.8): coeficientes e a lista de combinações geradas. */
function secaoCombinacoes(p, par, mudar) {
  const k = coeficientesAcoes(par);
  // combinações do edifício (pórtico): G, Q e as ações horizontais V1 a V4 (vento e/ou desaprumo), já majoradas por 0,95·γz
  const g = porticoDoEdificio(p, modulos);
  const doEdificio = !g.erro && g.horizontais?.casos ? g : null;
  const comVento = !!par.vento?.ativo;
  const lista = doEdificio ? doEdificio.combinacoes : gerarCombinacoes(comVento ? casosGlobais(par) : casosPadrao(k), k);
  const coef = (chave, rotulo, { min = 0, max = 2, largura = '96px', dica } = {}) => ui.campo({
    rotulo, valor: k[chave], casas: 2, min, max, largura, dica,
    aoMudar: (v) => mudar((proj) => { proj.parametros.coeficientes[chave] = v; }, true),
  });
  const TIPO = { ELU: 'Última normal', QP: 'Quase permanente', FREQ: 'Frequente', RARA: 'Rara' };
  const USO = { ELU: 'Dimensionamento (envoltória)', QP: 'Flechas', FREQ: 'Abertura de fissuras (vigas)', RARA: 'Reservada (ELS-F)' };
  return ui.secao({
    numero: '05', titulo: 'Ações e combinações', descricao: 'NBR 8681 · NBR 6118, Tabelas 11.1 e 11.2 — γg e γq do concreto; ψ vale também para a madeira',
    filhos: [
      ui.linhaCampos(
        ui.selecao({
          rotulo: 'Uso da edificação (Tabela 11.2)', valor: par.uso, largura: '300px',
          opcoes: Object.entries(PSI_USO).map(([v, u]) => ({ valor: v, texto: `${{ residencial: 'Residencial', comercial: 'Comercial / escritórios', garagem: 'Bibliotecas / arquivos / garagens' }[v]} (ψ0 ${String(u.psi0).replace('.', ',')} · ψ1 ${String(u.psi1).replace('.', ',')} · ψ2 ${String(u.psi2).replace('.', ',')})` })),
          aoMudar: (v) => mudar((proj) => {
            const u = PSI_USO[v];
            proj.parametros.uso = v;
            Object.assign(proj.parametros.coeficientes, { psi0: u.psi0, psi1: u.psi1, psi2: u.psi2 });
          }, true),
        }),
        coef('psi0', 'ψ0', { max: 1, largura: '86px', dica: 'Combinação: variáveis secundárias no ELU' }),
        coef('psi1', 'ψ1', { max: 1, largura: '86px', dica: 'Valor frequente' }),
        coef('psi2', 'ψ2', { max: 1, largura: '86px', dica: 'Valor quase permanente' }),
      ),
      ui.linhaCampos(
        coef('gg', 'γg desfavorável', { min: 1, largura: '130px' }),
        coef('ggFav', 'γg favorável', { min: 0.8, max: 1.4, largura: '130px' }),
        coef('gq', 'γq (variável)', { min: 1, largura: '130px' }),
      ),
      h('p', { class: 'combinacoes-nota' }, `${PSI_USO[par.uso]?.nome ?? ''}. Casos de carga: G = ações permanentes (peso próprio e demais, agrupadas) e Q = variável de uso. ${doEdificio
        ? `Combinações do pórtico do edifício (pilares em "Pórtico espacial"): V1 a V4 são as ações horizontais nas quatro direções (${['x', 'y'].map((d) => `em ${d.toUpperCase()}: ${ROTULO_ACAO[doEdificio.horizontais.direcoes[d].acao].toLowerCase()}`).join('; ')}), exclusivas entre si — vento com ψ0 0,6 · ψ1 0,3 · ψ2 0, desaprumo sozinho com ψ = 1. ${doEdificio.combinacoes.some((c) => c.majorada) ? 'As combinações marcadas têm os esforços horizontais majorados por 0,95·γz. ' : ''}Vigas, lajes e pilares calculados pelas cargas dos elementos continuam com G e Q. Vento em F8, estabilidade global em F9.`
        : comVento ? 'Vento ativo: V1 a V4 (0°, 90°, 180° e 270°) entram nas combinações do pórtico do edifício.' : 'O vento (NBR 6123) é ligado na tela Vento (F8) e o desaprumo na tela Estabilidade global (F9); com eles, V1 a V4 entram nas combinações do pórtico do edifício.'}`),
      ui.tabela({
        classe: 'combinacoes-tabela',
        colunas: [{ titulo: 'Combinação' }, { titulo: 'Tipo' }, { titulo: 'Expressão' }, { titulo: 'Usada em' }, { titulo: 'Descrição' }],
        linhas: lista.map((c) => [h('b', null, c.id), TIPO[c.tipo], h('span', { class: 'mono' }, c.expressao), USO[c.tipo], `${c.nome}${c.majorada ? ' · majorada por 0,95·γz' : ''}`]),
      }),
    ],
  });
}
