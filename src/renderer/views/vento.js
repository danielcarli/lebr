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
 * Vento (NBR 6123) — dados do projeto, fatores S1, S2 e S3, coeficientes de arrasto e forças por pavimento.
 * As forças entram no pórtico espacial do edifício como os casos V1 a V4 (0°, 90°, 180° e 270°).
 */
import { h } from '../ui/dom.js';
import * as ui from '../ui/componentes.js';
import { icone } from '../ui/icones.js';
import { estado } from '../core/estado.js';
import { modulos } from '../core/modulos.js';
import { num, lerNumero } from '../core/formatar.js';
import { CATEGORIAS, CLASSES, GRUPOS_S3, TOPOGRAFIAS } from '../../engine/vento.js';
import { ventoDoProjeto, porticoDoEdificio, parametrosVento } from '../../modules/comum/portico-edificio.js';
import { CASOS_VENTO } from '../../engine/combinacoes.js';

export function abaVento(acoes = {}) {
  return {
    id: 'vento',
    icone: 'vento',
    titulo: () => 'Vento (NBR 6123)',
    render(container) {
      const p = estado.projeto;
      if (!p) return;
      const pv = parametrosVento(p);
      const bruto = p.parametros.vento ?? {};
      const mudar = (fn) => estado.alterar((proj) => {
        proj.parametros.vento = { ...(proj.parametros.vento ?? {}) };
        fn(proj.parametros.vento);
        // o vento entra só no pórtico do edifício: invalida os pilares quando eles usam o pórtico
        if (proj.parametros.analiseGlobal?.pilares === 'portico') for (const e of proj.elementos) if (e.resultado && e.modulo === 'concreto.pilar') e.resultado.desatualizado = true;
      }, { descricao: 'Vento', tipo: 'parametros', estrutural: true });
      const v = ventoDoProjeto(p, modulos);
      const pagina = h('div', { class: 'pagina' },
        ui.cabecalhoObjeto({
          rotulo: 'Ações', numero: 'NBR 6123', etiquetas: ['LEBR', 'Vento', 'Pórtico'], simbolo: 'vento',
          linha1: 'Forças devidas ao vento', linha2: 'Casos V1 a V4 no pórtico espacial do edifício',
          titulo: 'Vento', subtitulo: pv.ativo ? 'Ativo: as combinações do edifício incluem o vento' : 'Desligado: o pórtico e as combinações não têm vento',
        }),
        ui.secao({
          numero: '01', titulo: 'Dados do vento', descricao: 'Velocidade básica, topografia, rugosidade e uso (5.1 a 5.4)',
          filhos: [
            ui.linhaCampos(
              ui.alternar({ rotulo: 'Considerar o vento no pórtico do edifício', valor: pv.ativo, aoMudar: (x) => mudar((w) => { w.ativo = x; }) }),
            ),
            ui.linhaCampos(
              ui.campo({ rotulo: 'V0 (isopletas)', valor: pv.V0, unidade: 'm/s', casas: 1, min: 20, max: 60, largura: '140px', dica: 'Velocidade básica do vento (rajada de 3 s, 50 anos, 10 m, terreno aberto), lida no mapa de isopletas da Figura 1', aoMudar: (x) => mudar((w) => { w.V0 = x; }) }),
              ui.texto({ rotulo: 'Local / referência da isopleta', valor: pv.referencia, largura: '320px', placeholder: 'ex.: Santa Maria – RS, isopleta de 45 m/s', aoMudar: (x) => mudar((w) => { w.referencia = x; }) }),
            ),
            ui.linhaCampos(
              ui.selecao({ rotulo: 'Topografia — S1 (5.2)', valor: bruto.topografia ?? 'plano', largura: '320px',
                opcoes: [...Object.entries(TOPOGRAFIAS).map(([k, t]) => ({ valor: k, texto: `${t.desc} (S1 = ${num(t.S1, 2)})` })), { valor: 'informado', texto: 'Taludes e morros: S1 informado' }],
                aoMudar: (x) => mudar((w) => { w.topografia = x; }) }),
              bruto.topografia === 'informado' ? ui.campo({ rotulo: 'S1', valor: bruto.S1 ?? 1, casas: 2, min: 0.5, max: 2, largura: '100px', aoMudar: (x) => mudar((w) => { w.S1 = x; }) }) : null,
            ),
            ui.linhaCampos(
              ui.selecao({ rotulo: 'Rugosidade do terreno — S2 (5.3.1)', valor: pv.categoria, largura: '520px',
                opcoes: Object.entries(CATEGORIAS).map(([k, c]) => ({ valor: k, texto: `${c.nome}: ${c.desc}` })),
                aoMudar: (x) => mudar((w) => { w.categoria = x; }) }),
            ),
            ui.linhaCampos(
              ui.selecao({ rotulo: 'Classe da edificação (5.3.2)', valor: bruto.classe ?? 'auto', largura: '320px',
                opcoes: [{ valor: 'auto', texto: `Pela maior dimensão${v.classe ? ` (classe ${v.classe})` : ''}` }, ...Object.entries(CLASSES).map(([k, d]) => ({ valor: k, texto: `Classe ${k}: ${d}` }))],
                aoMudar: (x) => mudar((w) => { w.classe = x; }) }),
              ui.selecao({ rotulo: 'Grupo — S3 (Tabela 3)', valor: pv.grupo, largura: '380px',
                opcoes: Object.entries(GRUPOS_S3).map(([k, g]) => ({ valor: Number(k), texto: `Grupo ${k} (S3 = ${num(g.S3, 2)}): ${g.desc}` })),
                aoMudar: (x) => mudar((w) => { w.grupo = Number(x); }) }),
            ),
            h('p', { class: 'combinacoes-nota' }, 'Valores de S2 (Tabela 1) e S3 (Tabela 3) da NBR 6123:1988. A norma foi revisada em dezembro de 2023 (NBR 6123:2023): confira os parâmetros e a isopleta na edição em vigor. O terreno está na cota 0; z é a cota de cada pavimento.'),
          ],
        }),
      );

      if (v.erro) {
        pagina.append(ui.secao({ numero: '02', titulo: 'Forças', filhos: [h('ul', { class: 'avisos' }, h('li', null, icone('alerta', { tamanho: 14, traco: 1.8 }), v.erro))] }));
        container.append(pagina);
        return { aoAlterar: () => false };
      }

      const dirs = v.direcoes;
      const linhaDir = (d, rot, ang) => [rot, ang, num(d.l1, 2), num(d.l2, 2), num(d.l1l2, 2), num(d.hl1, 2), num(d.CaEstimado, 2),
        ui.texto({ valor: d.informado ? num(d.Ca, 2) : '', largura: '96px', placeholder: 'estimativa',
          aoMudar: (t) => { const x = lerNumero(t); mudar((w) => { w.Ca = { ...(w.Ca ?? {}), [d.eixo]: Number.isFinite(x) && x >= 0.5 && x <= 2.5 ? x : null }; }); } }),
        h('b', null, num(d.Ca, 2))];
      pagina.append(ui.secao({
        numero: '02', titulo: 'Edifício e coeficiente de arrasto', descricao: `Planta ${num(v.Lx, 2)} × ${num(v.Ly, 2)} m (envoltória dos elementos posicionados) · altura h = ${num(v.h, 2)} m · classe ${v.classe} · S1 = ${num(v.S1, 2)} · S3 = ${num(v.S3, 2)}`,
        filhos: [
          ui.tabela({
            classe: 'els-tabela vento-ca',
            colunas: [{ titulo: 'Vento' }, { titulo: 'Casos' }, { titulo: 'l1 (m)', alinhar: 'dir' }, { titulo: 'l2 (m)', alinhar: 'dir' }, { titulo: 'l1/l2', alinhar: 'dir' }, { titulo: 'h/l1', alinhar: 'dir' }, { titulo: 'Ca estimado', alinhar: 'dir' }, { titulo: 'Ca informado' }, { titulo: 'Ca', alinhar: 'dir' }],
            linhas: [linhaDir(dirs.x, 'Ao longo de X', '0° (V1) · 180° (V3)'), linhaDir(dirs.y, 'Ao longo de Y', '90° (V2) · 270° (V4)')],
          }),
          h('p', { class: 'combinacoes-nota' }, 'l1 é a largura da face exposta (perpendicular ao vento) e l2 a profundidade. A estimativa de Ca interpola o ábaco de baixa turbulência (Figura 4) de forma aproximada — leia o valor no ábaco e informe-o para o projeto. Edificações em zonas urbanas com obstáculos altos podem usar a Figura 5 (alta turbulência), com Ca menor.'),
        ],
      }));

      // forças por pavimento e conferência no pórtico
      const g = pv.ativo ? porticoDoEdificio(p, modulos) : null;
      const eq = (caso) => g?.resultado?.porCaso?.[caso]?.equilibrio;
      pagina.append(ui.secao({
        numero: '03', titulo: 'Forças por pavimento', descricao: 'F em X para 0° e 180° (V1, V3), F em Y para 90° e 270° (V2, V4); Fa = Ca · q · l1 · altura de influência, com q = 0,613·Vk² e Vk = V0·S1·S2·S3, aplicada no centro da planta (diafragma rígido)',
        filhos: [
          ui.tabela({
            classe: 'els-tabela',
            colunas: [{ titulo: 'Pavimento' }, { titulo: 'z (m)', alinhar: 'dir' }, { titulo: 'S2', alinhar: 'dir' }, { titulo: 'Vk (m/s)', alinhar: 'dir' }, { titulo: 'q (kN/m²)', alinhar: 'dir' }, { titulo: 'h infl. (m)', alinhar: 'dir' }, { titulo: 'F em X (kN)', alinhar: 'dir' }, { titulo: 'F em Y (kN)', alinhar: 'dir' }],
            linhas: [
              ...[...v.pavimentos].reverse().map((x) => [x.nome, num(x.z, 2), num(x.S2, 3), num(x.Vk, 2), num(x.q, 3), num(x.hInf, 2), num(x.Fx, 2), num(x.Fy, 2)]),
              [h('b', null, 'Total (cortante na base)'), '', '', '', '', '', h('b', null, num(v.totais.Fx, 2)), h('b', null, num(v.totais.Fy, 2))],
              [h('b', null, 'Momento de tombamento (kN·m)'), '', '', '', '', '', h('b', null, num(v.totais.Mx, 1)), h('b', null, num(v.totais.My, 1))],
            ],
          }),
          pv.ativo && g?.horizontais?.casos && ['x', 'y'].some((d) => g.horizontais.direcoes[d].acao !== 'vento')
            ? h('p', { class: 'combinacoes-nota' }, `Desaprumo (NBR 6118, 11.3.3.4.1): ${['x', 'y'].map((d) => `em ${d.toUpperCase()}, ${{ vento: 'só o vento', desaprumo: 'só o desaprumo', combinado: 'vento + desaprumo' }[g.horizontais.direcoes[d].acao]}`).join('; ')} — as forças aplicadas no pórtico incluem a parcela do desaprumo (tela Estabilidade global).`)
            : null,
          pv.ativo
            ? (g?.erro
              ? h('ul', { class: 'avisos' }, h('li', null, icone('alerta', { tamanho: 14, traco: 1.8 }), `Pórtico: ${g.erro}`))
              : ui.tabela({
                classe: 'els-tabela',
                colunas: [{ titulo: 'Caso no pórtico' }, { titulo: 'Forças aplicadas (kN)', alinhar: 'dir' }, { titulo: 'Reação horizontal na fundação (kN)', alinhar: 'dir' }, { titulo: '' }],
                linhas: CASOS_VENTO.map((cv) => {
                  const e = eq(cv.id);
                  const nome = g?.horizontais?.lista?.find((x) => x.id === cv.id)?.nome ?? cv.nome;
                  const F = e ? Math.hypot(e.cargas[0], e.cargas[1]) : 0, R = e ? Math.hypot(e.reacoes[0], e.reacoes[1]) : 0;
                  return [`${cv.id} — ${nome}`, num(F, 2), num(R, 2), ui.selo(!!e && e.erro < 1e-4, e && e.erro < 1e-4 ? 'confere' : '—')];
                }),
              }))
            : h('p', { class: 'combinacoes-nota' }, 'Ligue "Considerar o vento" para aplicar estas forças no pórtico e incluir V1 a V4 nas combinações do edifício.'),
          h('div', { class: 'vento-acoes' },
            ui.botao({ texto: 'Ver no 3D', icone: 'cubo', tipo: 'secundario', aoClicar: () => acoes.abrir3D?.({ vento: true }) }),
            ui.botao({ texto: 'Estabilidade global (γz)', icone: 'estabilidade', tipo: 'fantasma', aoClicar: () => acoes.abrirEstabilidade?.() }),
            ui.botao({ texto: 'Combinações e análise global', icone: 'parametros', tipo: 'fantasma', aoClicar: () => acoes.abrirParametros?.() })),
        ],
      }));

      container.append(pagina);
      return { aoAlterar: () => false };
    },
  };
}
