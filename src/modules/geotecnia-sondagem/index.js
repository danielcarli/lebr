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
 * Módulo: Sondagem SPT (NBR 6484:2020) — cadastro do furo (camadas, NSPT por metro, nível d'água) e perfil.
 * Os furos ficam no arquivo do projeto como elementos e servem às fundações (sapatas, estacas).
 */
import { calcularSondagem, criarSondagem } from './calculo.js';
import { analisarSondagem, SOLOS, SECUNDARIOS, ORIGENS, PARALISACOES, nomeDoSolo } from '../../engine/sondagem.js';
import { criarDesenhoSondagem } from './desenho.js';

const novoId = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export default function moduloSondagem(api) {
  const { h } = api.dom;
  const ui = api.ui;
  const { num, lerNumero } = api.formatar;
  const des = criarDesenhoSondagem(api.dom);

  const opSolos = Object.entries(SOLOS).map(([k, s]) => ({ valor: k, texto: s.nome }));
  const opSec = (solo) => Object.entries(SECUNDARIOS).map(([k, v]) => ({ valor: k, texto: k ? v[SOLOS[solo]?.fem ? 1 : 0] : '—' }));
  const opOrigens = Object.entries(ORIGENS).map(([k, v]) => ({ valor: k, texto: v || '—' }));
  const numOuNulo = (t) => { const v = lerNumero(t); return Number.isFinite(v) ? v : null; };

  return {
    id: 'geotecnia.sondagem',
    nome: 'Sondagem SPT',
    nomeCurto: 'Sondagem',
    categoria: 'sondagens',
    novaCategoria: { id: 'sondagens', nome: 'Sondagens', ordem: 10 },
    prefixo: 'SP',
    sigla: 'GS1',
    icone: 'sondagem',
    forma: 'sondagem',
    material: 'Solo',
    norma: 'NBR 6484:2020',
    versao: '0.1.0',
    descricao: 'Furo de sondagem de simples reconhecimento: camadas, NSPT por metro, nível d’água e perfil desenhado.',
    montagem: false, // não é posicionado nos pavimentos (a locação fica no próprio furo)

    criar: criarSondagem,
    calcular: (el) => calcularSondagem(el),
    resumo: (el) => {
      const n = el.camadas?.length ?? 0;
      return `${num(el.limite ?? 0)} m · ${n} camada${n === 1 ? '' : 's'} · ${el.nivelAgua?.seco ? 'seco' : el.nivelAgua?.inicial != null ? `NA ${num(el.nivelAgua.inicial)} m` : 'NA —'}`;
    },

    renderEntrada(raiz, ctx) {
      const el = ctx.elemento;
      const previa = h('div', { class: 'desenho-caixa sondagem-caixa' });
      const desenhar = () => {
        try { previa.replaceChildren(des.perfil(analisarSondagem(ctx.elemento), { codigo: ctx.elemento.codigo })); } catch (err) { previa.replaceChildren(h('p', null, err.message)); }
      };
      const mudar = (fn, op) => { ctx.alterar(fn, op); desenhar(); };

      // ---------------------------------------------------------------- 01 locação
      raiz.append(ui.secao({
        numero: '01', titulo: 'Locação do furo', descricao: 'Coordenadas na planta do projeto e cota da boca no mesmo referencial dos pavimentos',
        filhos: [
          ui.linhaCampos(
            ui.campo({ rotulo: 'x na planta', valor: el.local?.x ?? 0, unidade: 'm', casas: 2, min: -1000, max: 1000, largura: '130px', aoMudar: (v) => mudar((e) => { e.local = { ...(e.local ?? {}), x: v }; }) }),
            ui.campo({ rotulo: 'y na planta', valor: el.local?.y ?? 0, unidade: 'm', casas: 2, min: -1000, max: 1000, largura: '130px', aoMudar: (v) => mudar((e) => { e.local = { ...(e.local ?? {}), y: v }; }) }),
            ui.campo({ rotulo: 'Cota da boca', valor: el.cotaBoca ?? 0, unidade: 'm', casas: 2, min: -500, max: 3000, largura: '140px', dica: 'Terreno no ponto do furo, no referencial do projeto (os pavimentos usam o terreno = 0)', aoMudar: (v) => mudar((e) => { e.cotaBoca = v; }) }),
          ),
          ui.linhaCampos(
            ui.texto({ rotulo: 'Data', valor: el.data, largura: '140px', placeholder: 'dd/mm/aaaa', aoMudar: (v) => ctx.alterar((e) => { e.data = v; }) }),
            ui.texto({ rotulo: 'Empresa', valor: el.empresa, largura: '240px', aoMudar: (v) => ctx.alterar((e) => { e.empresa = v; }) }),
            ui.texto({ rotulo: 'Responsável técnico', valor: el.responsavel, largura: '240px', aoMudar: (v) => ctx.alterar((e) => { e.responsavel = v; }) }),
          ),
        ],
      }));

      // ---------------------------------------------------------------- 02 camadas
      const listaC = h('div', { class: 'cargas sondagem-camadas' });
      (el.camadas ?? []).forEach((c, i) => {
        const de = i ? el.camadas[i - 1].ate : 0;
        const mc = (fn, estrutural = false) => mudar((e) => fn(e.camadas[i]), { estrutural });
        listaC.append(h('div', { class: 'carga-linha' },
          h('div', { class: 'carga-tipo' },
            h('span', { class: 'carga-num' }, String(i + 1).padStart(2, '0')),
            h('div', { class: 'carga-desc' }, h('span', { class: 'carga-rot' }, `${num(de)} → ${num(c.ate)} m`), h('span', { class: 'sondagem-nome' }, nomeDoSolo(c)))),
          h('div', { class: 'carga-campos' },
            ui.campo({ rotulo: 'Até', valor: c.ate, unidade: 'm', casas: 2, min: 0.05, max: 200, largura: '100px', dica: 'Profundidade da base da camada', aoMudar: (v) => mc((x) => { x.ate = v; }, true) }),
            ui.selecao({ rotulo: 'Solo', valor: c.solo, largura: '150px', opcoes: opSolos, aoMudar: (v) => mc((x) => { x.solo = v; }, true) }),
            ui.selecao({ rotulo: 'Fração secundária', valor: c.secundario ?? '', largura: '160px', opcoes: opSec(c.solo), aoMudar: (v) => mc((x) => { x.secundario = v; }, true) }),
            ui.texto({ rotulo: 'Cor', valor: c.cor, largura: '110px', aoMudar: (v) => mc((x) => { x.cor = v; }) }),
            ui.selecao({ rotulo: 'Origem', valor: c.origem ?? '', largura: '130px', opcoes: opOrigens, aoMudar: (v) => mc((x) => { x.origem = v; }) }),
            ui.texto({ rotulo: 'Observação', valor: c.descricao, largura: '200px', placeholder: 'ex.: com raízes', aoMudar: (v) => mc((x) => { x.descricao = v; }) }),
          ),
          ui.botaoIcone({ icone: 'lixeira', titulo: 'Remover camada', classe: 'perigo', aoClicar: () => ctx.alterar((e) => e.camadas.splice(i, 1), { estrutural: true }) }),
        ));
      });
      if (!el.camadas?.length) listaC.append(h('div', { class: 'cargas-vazio' }, 'Nenhuma camada descrita.'));
      const addCamada = ui.botao({
        texto: 'Adicionar camada', icone: 'mais', tipo: 'secundario',
        aoClicar: () => ctx.alterar((e) => {
          const ult = e.camadas?.at(-1);
          (e.camadas ??= []).push({ id: novoId('k'), ate: Math.round(((ult?.ate ?? 0) + 1) * 100) / 100, solo: ult?.solo ?? 'argila', secundario: '', cor: '', origem: ult?.origem ?? '', descricao: '' });
        }, { estrutural: true }),
      });
      raiz.append(ui.secao({
        numero: '02', titulo: 'Camadas', descricao: 'Da boca para baixo; cada camada vai até a profundidade da sua base',
        acoes: [addCamada], filhos: [listaC],
      }));

      // ---------------------------------------------------------------- 03 SPT
      const listaS = h('div', { class: 'sondagem-spt' });
      (el.spt ?? []).forEach((e, i) => {
        const me = (fn, estrutural = false) => mudar((x) => fn(x.spt[i]), { estrutural });
        listaS.append(h('div', { class: 'sondagem-ensaio' },
          ui.campo({ rotulo: i ? null : 'Prof. (m)', valor: e.prof, casas: 2, min: 0, max: 200, largura: '92px', dica: 'Profundidade de início do ensaio', aoMudar: (v) => me((x) => { x.prof = v; }, true) }),
          ui.campo({ rotulo: i ? null : 'NSPT', valor: e.n, casas: 0, min: 0, max: 200, largura: '78px', dica: 'Golpes para cravar os últimos 30 cm', aoMudar: (v) => me((x) => { x.n = Math.round(v); }) }),
          ui.campo({ rotulo: i ? null : 'Penetração', valor: e.pen ?? 30, unidade: 'cm', casas: 0, min: 1, max: 30, largura: '108px', dica: 'Penetração correspondente aos golpes (30 cm, ou menos na paralisação: 50/10)', aoMudar: (v) => me((x) => { x.pen = Math.round(v); }) }),
          ui.botaoIcone({ icone: 'lixeira', titulo: 'Remover ensaio', classe: 'perigo', aoClicar: () => ctx.alterar((x) => x.spt.splice(i, 1), { estrutural: true }) }),
        ));
      });
      if (!el.spt?.length) listaS.append(h('div', { class: 'cargas-vazio' }, 'Nenhum ensaio registrado.'));
      const addEnsaio = ui.botao({
        texto: 'Adicionar ensaio', icone: 'mais', tipo: 'secundario',
        aoClicar: () => ctx.alterar((x) => { const u = x.spt?.at(-1); (x.spt ??= []).push({ prof: (u?.prof ?? 0) + 1, n: u?.n ?? 5, pen: 30 }); }, { estrutural: true }),
      });
      raiz.append(ui.secao({
        numero: '03', titulo: 'Ensaios de penetração (SPT)', descricao: 'Um ensaio por metro: golpes do martelo de 65 kg (queda de 75 cm) nos últimos 30 cm do amostrador (NBR 6484:2020)',
        acoes: [addEnsaio], filhos: [listaS],
      }));

      // ---------------------------------------------------------------- 04 NA e paralisação
      const na = el.nivelAgua ?? {};
      raiz.append(ui.secao({
        numero: '04', titulo: 'Nível d’água e fim do furo', descricao: 'Profundidades a partir da boca',
        filhos: [
          ui.linhaCampos(
            ui.alternar({ rotulo: 'Furo seco (sem nível d’água)', valor: !!na.seco, aoMudar: (v) => mudar((e) => { e.nivelAgua = { ...(e.nivelAgua ?? {}), seco: v }; }, { estrutural: true }) }),
          ),
          na.seco ? null : ui.linhaCampos(
            ui.texto({ rotulo: 'NA inicial (m)', valor: na.inicial != null ? num(na.inicial) : '', largura: '140px', placeholder: '—', aoMudar: (t) => mudar((e) => { e.nivelAgua = { ...(e.nivelAgua ?? {}), inicial: numOuNulo(t) }; }) }),
            ui.texto({ rotulo: 'NA final / 24 h (m)', valor: na.final != null ? num(na.final) : '', largura: '160px', placeholder: '—', aoMudar: (t) => mudar((e) => { e.nivelAgua = { ...(e.nivelAgua ?? {}), final: numOuNulo(t) }; }) }),
          ),
          ui.linhaCampos(
            ui.campo({ rotulo: 'Limite da sondagem', valor: el.limite, unidade: 'm', casas: 2, min: 0.5, max: 200, largura: '170px', aoMudar: (v) => mudar((e) => { e.limite = v; }) }),
            ui.selecao({ rotulo: 'Critério de paralisação', valor: el.paralisacao ?? 'projeto', largura: '340px', opcoes: Object.entries(PARALISACOES).map(([k, v]) => ({ valor: k, texto: v })), aoMudar: (v) => ctx.alterar((e) => { e.paralisacao = v; }) }),
          ),
          ui.texto({ rotulo: 'Observações', valor: el.observacoes, largura: '100%', placeholder: 'ex.: avanço por lavagem a partir de 6 m; furo revestido até 2 m', aoMudar: (v) => ctx.alterar((e) => { e.observacoes = v; }) }),
        ].filter(Boolean),
      }));

      raiz.append(ui.secao({ numero: '05', titulo: 'Perfil do furo', descricao: 'Prévia; atualiza a cada alteração', filhos: [previa] }));
      desenhar();
    },

    renderResultado(raiz, res, ctx) {
      const el = ctx.elemento;
      const cam = res.camadas ?? [];
      raiz.append(h('div', { class: 'instrumentos' },
        ui.numeroGrande({ rotulo: 'Profundidade', valor: num(res.limite), unidade: 'm', linhas: [`Boca ${num(res.cotaBoca)} · fundo ${num(res.cotaFundo)}`, `${cam.length} camada(s) · ${res.ensaios.length} ensaio(s)`] }),
        ui.numeroGrande({ rotulo: 'Nível d’água', valor: res.nivelAgua.seco ? 'seco' : res.nivelAgua.inicial != null ? num(res.nivelAgua.inicial) : '—', unidade: res.nivelAgua.seco || res.nivelAgua.inicial == null ? '' : 'm', linhas: [res.nivelAgua.cotaInicial != null ? `cota ${num(res.nivelAgua.cotaInicial)}` : 'sem registro de NA', res.nivelAgua.final != null ? `final ${num(res.nivelAgua.final)} m` : ''] }),
        ui.numeroGrande({ rotulo: 'NSPT máximo', valor: num(res.nMaximo, 0), unidade: 'golpes', linhas: [PARALISACOES[el.paralisacao] ?? ''] }),
      ));
      raiz.append(ui.secao({
        numero: '06', titulo: 'Perfil individual', descricao: `${el.codigo} · locação (${num(el.local?.x ?? 0)}; ${num(el.local?.y ?? 0)}) m`,
        filhos: [h('div', { class: 'desenho-caixa sondagem-caixa' }, des.perfil(res, { codigo: el.codigo }))],
      }));
      raiz.append(ui.secao({
        numero: '07', titulo: 'Camadas e estados', descricao: 'Compacidade (areias e siltes arenosos) ou consistência (argilas e siltes argilosos) pelo NSPT — NBR 6484:2020, Anexo A',
        filhos: [ui.tabela({
          classe: 'els-tabela',
          colunas: [{ titulo: 'De (m)', alinhar: 'dir' }, { titulo: 'Até (m)', alinhar: 'dir' }, { titulo: 'Cotas', alinhar: 'dir' }, { titulo: 'Material' }, { titulo: 'NSPT', alinhar: 'dir' }, { titulo: 'Médio', alinhar: 'dir' }, { titulo: 'Estado' }],
          linhas: cam.map((c) => [num(c.de), num(c.ate), `${num(c.cotaTopo)} / ${num(c.cotaBase)}`, [c.nome, c.cor, c.origem && c.origem !== 'aterro' ? c.origem : '', c.descricaoLivre].filter(Boolean).join(', '),
            c.nMin == null ? '—' : c.nMin === c.nMax ? num(c.nMin, 0) : `${num(c.nMin, 0)} a ${num(c.nMax, 0)}`, c.nMedio == null ? '—' : num(c.nMedio, 1), c.estado ?? (c.tipoEstado ? 'sem ensaio' : 'não se aplica')]),
        })],
      }));
    },
  };
}
