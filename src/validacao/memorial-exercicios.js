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
 * Memorial de cálculo dos exercícios resolvidos: para cada caso do banco de bibliografia, os passos da solução do
 * LEBR com as fórmulas e os valores, e a descrição de um desenho que ajuda a entender a solução (o desenho é feito
 * em renderer/views/bibliografia-desenhos.js). Sem DOM: roda também no Node (testes).
 *
 * @returns {{ secoes: {titulo:string, linhas:string[]}[], desenho: object|null }}
 */
import { resultadoBruto, argumentosDoCaso, MOTORES } from './executar.js';

const n = (v, c = 2) => (Number.isFinite(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c }) : '—');
const MPa = (kNcm2) => kNcm2 * 10;

/** fcd e fyd (MPa) de um material montado pelo executor. */
const fcdDe = (c) => c?.fcd ?? (c?.fck ? c.fck / 1.4 : null);
const fydDe = (s) => s?.fyd ?? (s?.fyk ? s.fyk / 1.15 : null);

const FAMILIAS = {
  'pilar.momentoTotal': (a, r) => ({
    secoes: [
      { titulo: 'Dados', linhas: [`Nd = ${n(a.Nd, 1)} kN; seção na direção estudada h = ${n(a.h, 0)} cm (b = ${n(a.b, 0)} cm); le = ${n(a.le, 0)} cm; fck = ${n(a.c?.fck, 0)} MPa${a.MA ? `; M1d,A = ${n(a.MA)} kN·m, M1d,B = ${n(a.MB ?? 0)} kN·m` : ''}.`] },
      { titulo: 'Esbeltez (15.8.2)', linhas: [
        `λ = 3,46·le/h = 3,46·${n(a.le, 0)}/${n(a.h, 0)} = ${n(r.lambda, 2)}.`,
        `λ1 = (25 + 12,5·e1/h)/αb, entre 35 e 90 → λ1 = ${n(r.lambda1, 2)} (αb = ${n(r.alfaB, 2)}).`,
        r.segundaOrdem ? `λ > λ1: considerar os efeitos de 2ª ordem (${r.metodo}).` : 'λ ≤ λ1: dispensados os efeitos locais de 2ª ordem.',
      ] },
      { titulo: 'Momentos (11.3.3.4.3 e 15.8.3.3.2)', linhas: [
        `M1d,mín = Nd·(0,015 + 0,03·h), com h em m = ${n(a.Nd, 1)}·(0,015 + 0,03·${n(a.h / 100, 2)}) = ${n(r.M1min, 2)} kN·m; M1d adotado = ${n(r.M1, 2)} kN·m.`,
        r.segundaOrdem ? `ν = Nd/(Ac·fcd) = ${n(r.nu, 3)}; 1/r = 0,005/[h·(ν + 0,5)] = ${n(r.curvatura, 5)} m⁻¹ (≤ 0,005/h).` : null,
        r.segundaOrdem ? `M2d = Nd·le²/10·(1/r) = ${n(r.M2, 2)} kN·m.` : null,
        `Md,tot = αb·M1d + M2d = ${n(r.Md ?? r.M1, 2)} kN·m (≥ M1d).`,
      ].filter(Boolean) },
    ],
    desenho: { tipo: 'pilar', le: a.le, h: a.h, b: a.b, Nd: a.Nd, M1: r.M1, M1min: r.M1min, M2: r.M2 ?? 0, Md: r.Md ?? r.M1, lambda: r.lambda, lambda1: r.lambda1 },
  }),

  'pilar.armaduraDuasFaces': (a, r) => ({
    secoes: [
      { titulo: 'Dados', linhas: [`Nd = ${n(a.Nd, 1)} kN, Md = ${n(a.Md, 2)} kN·m; seção ${n(a.b, 0)} × ${n(a.h, 0)} cm, d′ = ${n(a.dl, 1)} cm; fcd = ${n(fcdDe(a.c), 2)} MPa.`] },
      { titulo: 'Ábaco adimensional (flexo-compressão, armadura simétrica em duas faces)', linhas: [
        `ν = Nd/(Ac·fcd) = ${n(r.nu, 3)}; μ = Md/(Ac·h·fcd) = ${n(r.mu, 3)}; d′/h = ${n(a.dl / a.h, 2)}.`,
        `Do equilíbrio da seção: ω = ${n(r.omega, 3)} → As,tot = ω·Ac·fcd/fyd = ${n(r.As, 2)} cm² (metade em cada face).`,
      ] },
    ],
    desenho: { tipo: 'secao-duas-faces', b: a.b, h: a.h, dl: a.dl, Nd: a.Nd, Md: a.Md, As: r.As },
  }),

  'flexao.dimensionarFlexao': (a, r) => {
    const fcd = fcdDe(a.c), fyd = fydDe(a.s);
    return {
      secoes: [
        { titulo: 'Dados', linhas: [`Md = ${n(a.Md, 2)} kN·m; b = ${n(a.b, 0)} cm, h = ${n(a.h, 0)} cm, d = ${n(a.d, 1)} cm; fcd = ${n(fcd, 2)} MPa, fyd = ${n(fyd, 1)} MPa.`] },
        { titulo: 'Linha neutra (17.2.2: retângulo 0,8·x com 0,85·fcd)', linhas: [
          `Kmd = Md/(b·d²·σcd) = ${n(r.Kmd, 4)} (limite de ductilidade ${n(r.KmdLim, 4)}).`,
          `ξ = x/d = [1 − √(1 − 2·Kmd)]/0,8 = ${n(r.xi, 4)} → x = ${n(r.x, 2)} cm, domínio ${r.dominio}.`,
          `z = d − 0,4·x = ${n(r.z, 2)} cm.`,
        ] },
        { titulo: 'Armadura', linhas: [
          r.dupla ? `Armadura dupla: As = ${n(r.As, 2)} cm², A′s = ${n(r.Asl, 2)} cm².` : `As = Md/(z·fyd) = ${n(r.AsCalc, 3)} cm².`,
          `As,mín (17.3.5.2) = ${n(r.AsMin, 2)} cm² → As adotada = ${n(r.As, 2)} cm².`,
        ] },
      ],
      desenho: { tipo: 'secao-flexao', b: a.b, h: a.h, d: a.d, x: r.x, z: r.z, As: r.As, Asl: r.Asl, Md: a.Md, dominio: r.dominio },
    };
  },

  'cisalhamento.dimensionarEstribos': (a, r) => ({
    secoes: [
      { titulo: 'Dados', linhas: [`VSd = ${n(a.Vd, 1)} kN; bw = ${n(a.bw, 0)} cm, d = ${n(a.d, 1)} cm; fck = ${n(a.c?.fck, 0)} MPa (modelo I, 17.4.2.2).`] },
      { titulo: 'Biela comprimida', linhas: [`VRd2 = 0,27·αv2·fcd·bw·d = ${n(r.VRd2, 1)} kN ${a.Vd <= r.VRd2 ? '≥' : '<'} VSd.`] },
      { titulo: 'Armadura transversal', linhas: [
        `Vc = 0,6·fctd·bw·d = ${n(r.Vc, 1)} kN; Vsw = VSd − Vc = ${n(r.Vsw, 1)} kN.`,
        `Asw/s = Vsw/(0,9·d·fywd) = ${n(r.aswCalc, 2)} cm²/m; mínimo (17.4.1.1.1) ${n(r.aswMin, 2)} cm²/m → ${n(r.asw, 2)} cm²/m.`,
        r.estribo ? `Estribo ø ${String(r.estribo.phi).replace('.', ',')} c/ ${n(r.estribo.s, 0)} (${r.estribo.ramos} ramos) = ${n(r.estribo.aswEf, 2)} cm²/m; s ≤ ${n(r.sMax, 0)} cm.` : null,
      ].filter(Boolean) },
    ],
    desenho: { tipo: 'barras', titulo: 'Cortante (kN)', itens: [['VSd', a.Vd, 'sol'], ['VRd2', r.VRd2, 'res'], ['Vc', r.Vc, 'par'], ['Vsw', r.Vsw, 'par']] },
  }),

  'cisalhamento.verificarCortanteLaje': (a, r) => ({
    secoes: [{ titulo: 'Laje sem armadura transversal (19.4.1)', linhas: [
      `τRd = 0,25·fctd; k = |1,6 − d| = ${n(r.k, 3)} (d em m, ≥ 1); ρ1 = As1/(bw·d) = ${n(r.rho1, 4)} (≤ 0,02).`,
      `VRd1 = τRd·k·(1,2 + 40·ρ1)·bw·d = ${n(r.VRd1, 2)} kN/m ${a.Vd <= r.VRd1 ? '≥' : '<'} VSd = ${n(a.Vd, 2)} kN/m.`,
    ] }],
    desenho: { tipo: 'barras', titulo: 'Cortante por metro (kN/m)', itens: [['VSd', a.Vd, 'sol'], ['VRd1', r.VRd1, 'res']] },
  }),

  'puncao.verificarPuncao': (a, r) => ({
    secoes: [
      { titulo: 'Dados', linhas: [`FSd = ${n(a.FSd, 1)} kN; pilar ${a.posicao} ${n(a.c1, 0)} × ${n(a.c2, 0)} cm; d = ${n(a.d, 1)} cm, h = ${n(a.h, 0)} cm; ρ = ${n(a.rho, 4)}.`] },
      { titulo: 'Contorno C (face do pilar, 19.5.3.1)', linhas: [`u0 = ${n(r.C.u, 1)} cm; τSd = FSd/(u0·d) = ${n(r.C.tauSd, 3)} MPa ≤ τRd2 = 0,27·αv·fcd = ${n(r.tauRd2, 3)} MPa?`] },
      { titulo: 'Contorno C′ (a 2d, 19.5.3.2)', linhas: [
        `u = ${n(r.C1.u, 1)} cm; τSd = ${n(r.C1.tauSd, 3)} MPa.`,
        `τRd1 = 0,13·(1 + √(20/d))·(100·ρ·fck)^(1/3) = ${n(r.tauRd1, 3)} MPa (k = ${n(r.k, 2)}) → ${r.C1.tauSd <= r.tauRd1 ? 'dispensa armadura de punção' : 'precisa de armadura de punção'}.`,
      ] },
    ],
    desenho: { tipo: 'puncao', c1: a.c1, c2: a.c2, d: a.d, posicao: a.posicao, tauC: r.C.tauSd, tauRd2: r.tauRd2, tauC1: r.C1.tauSd, tauRd1: r.tauRd1 },
  }),

  'placa.analisarPlaca': (a, r) => ({
    secoes: [
      { titulo: 'Dados', linhas: [`lx = ${n(a.lx, 2)} m, ly = ${n(a.ly, 2)} m (λ = ly/lx = ${n(a.ly / a.lx, 3)}); bordas: x0 ${a.bordas.x0}, x1 ${a.bordas.x1}, y0 ${a.bordas.y0}, y1 ${a.bordas.y1}.`] },
      { titulo: `Placa por ${r.metodo} (${r.nx} × ${r.ny})`, linhas: [
        `Coeficientes adimensionais (m = coef·p·lx²): μx = ${n(r.coef.mxPos, 4)}, μy = ${n(r.coef.myPos, 4)}, μ′x = ${n(r.coef.mxNeg, 4)}, μ′y = ${n(r.coef.myNeg, 4)}.`,
        `Para p = 1 kN/m²: mx = ${n(r.unit.mxPos, 3)}, my = ${n(r.unit.myPos, 3)}, m′x = ${n(r.unit.mxNeg, 3)}, m′y = ${n(r.unit.myNeg, 3)} kN·m/m.`,
        `Reações por metro (p = 1): x0 ${n(r.reacoes.x0, 3)}, x1 ${n(r.reacoes.x1, 3)}, y0 ${n(r.reacoes.y0, 3)}, y1 ${n(r.reacoes.y1, 3)} kN/m.`,
      ] },
    ],
    desenho: { tipo: 'placa', lx: a.lx, ly: a.ly, bordas: a.bordas, m: r.unit },
  }),

  'placa.areasDeInfluencia': (a, r) => ({
    secoes: [{ titulo: 'Charneiras plásticas (14.7.6.1): 45° entre bordas iguais, 60° a partir da engastada', linhas: [
      `lx = ${n(a.lx, 2)} m, ly = ${n(a.ly, 2)} m; bordas: x0 ${a.bordas.x0}, x1 ${a.bordas.x1}, y0 ${a.bordas.y0}, y1 ${a.bordas.y1}.`,
      ...['x0', 'x1', 'y0', 'y1'].map((b) => `Borda ${b}: área ${n(r.area[b], 3)} m² sobre ${n(r.comprimento[b], 2)} m → reação = p·${n(r.area[b] / r.comprimento[b], 3)} kN/m.`),
    ] }],
    desenho: { tipo: 'areas', lx: a.lx, ly: a.ly, bordas: a.bordas, area: r.area },
  }),

  'bloco.bielasETirantes': (a, r) => ({
    secoes: [
      { titulo: 'Dados', linhas: [`${a.n} estacas ø ${n(a.D, 0)} cm a ${n(a.e, 0)} cm; pilar ${n(a.ap, 0)} × ${n(a.bp, 0)} cm; d = ${n(a.d, 1)} cm; Nd = ${n(a.Nd, 1)} kN.`] },
      { titulo: 'Bielas e tirantes (Blévot)', linhas: [
        `Inclinação das bielas α = ${n(r.alfa, 2)}° (recomendado entre 45° e 55°).`,
        `Tensão na biela junto ao pilar σ = ${n(r.sigmaPil, 2)} MPa e junto à estaca σ = ${n(r.sigmaEst, 2)} MPa, limite ${n(r.fator, 2)}·fcd = ${n(r.limite, 2)} MPa.`,
        `Força no tirante: Tx = ${n(r.Tx, 1)} kN${r.Ty ? `, Ty = ${n(r.Ty, 1)} kN` : ''} → As = 1,15·T/fyd.`,
      ] },
    ],
    desenho: { tipo: 'bloco', n: a.n, e: a.e, ap: a.ap, d: a.d, D: a.D, alfa: r.alfa, T: r.Tx, pos: a.pos },
  }),

  'bloco.intervaloAlturaUtil': (a, r) => ({
    secoes: [{ titulo: 'Altura útil para bielas entre 45° e 55°', linhas: [
      `${a.n} estacas a ${n(a.e, 0)} cm, pilar ${n(a.ap, 0)} cm: d = (distância até a estaca − ap/4)·tg α.`,
      `α = 45° → d mín = ${n(r.min, 2)} cm; α = 55° → d máx = ${n(r.max, 2)} cm.`,
    ] }],
    desenho: { tipo: 'bloco', n: a.n, e: a.e, ap: a.ap, d: r.max, dMin: r.min, D: 30, alfa: 55, pos: a.pos },
  }),

  'bloco.reacoesEstacas': (a, r) => ({
    secoes: [{ titulo: 'Reação em cada estaca (bloco rígido)', linhas: [
      `Ri = N/n ± Mx·xi/Σx² ± My·yi/Σy², com N = ${n(a.N, 1)} kN${a.Mx ? `, Mx = ${n(a.Mx, 1)} kN·m` : ''}${a.My ? `, My = ${n(a.My, 1)} kN·m` : ''}.`,
      ...r.map((R, i) => `E${i + 1} (${n(a.pos[i].x, 0)}; ${n(a.pos[i].y, 0)}) cm: R = ${n(R, 2)} kN.`),
    ] }],
    desenho: { tipo: 'reacoes', pos: a.pos, R: r },
  }),

  'sapata.dimensoesBalancosIguais': (a, r) => ({
    secoes: [{ titulo: 'Balanços iguais', linhas: [
      `A − B = ap − bp e A·B = área = ${n(a.area, 3)} m²: A = (ap − bp)/2 + √[(ap − bp)²/4 + área].`,
      `A = ${n(r.A, 0)} cm, B = ${n(r.B, 0)} cm (múltiplos de 5); balanços (A − ap)/2 = ${n((r.A - a.ap) / 2, 1)} cm e (B − bp)/2 = ${n((r.B - a.bp) / 2, 1)} cm.`,
    ] }],
    desenho: { tipo: 'sapata-planta', A: r.A, B: r.B, ap: a.ap, bp: a.bp },
  }),

  'sapata.tensoesNaBase': (a, r) => ({
    secoes: [{ titulo: 'Tensões na base', linhas: [
      `σméd = N/(A·B) = ${n(r.sMed, 1)} kPa; ex = M/N = ${n(r.ex * 100, 1)} cm${r.ey ? `, ey = ${n(r.ey * 100, 1)} cm` : ''}.`,
      `σ = N/(A·B)·(1 ± 6·ex/A ± 6·ey/B): σmáx = ${n(r.sMax, 1)} kPa, σmín = ${n(r.sMin, 1)} kPa → ${r.nucleo ? 'base inteiramente comprimida (núcleo central)' : 'fora do núcleo central'}.`,
    ] }],
    desenho: { tipo: 'tensoes-base', A: a.A, sMax: r.sMax, sMin: r.sMin, sMed: r.sMed, N: a.N },
  }),

  'sapata.tensaoAdmissivelSPT': (a, r) => ({
    secoes: [{ titulo: 'Estimativa semiempírica (Teixeira e Godoy)', linhas: [`σadm = 20·N kPa com 5 ≤ N ≤ 20: N = ${n(r.N, 2)}${r.Nusado !== r.N ? ` (usado ${n(r.Nusado, 2)})` : ''} → σadm = ${n(r.sigma, 1)} kPa.`] }],
    desenho: { tipo: 'spt', N: r.Nusado ?? r.N, sigma: r.sigma },
  }),

  'detalhamento.decalagem': (a, r) => ({
    secoes: [{ titulo: 'Decalagem do diagrama de momentos (17.4.2.2, modelo I)', linhas: [
      `al = d·VSd,máx/[2·(VSd,máx − Vc)] = ${n(a.d, 1)}·${n(a.Vd, 1)}/[2·(${n(a.Vd, 1)} − ${n(a.Vc, 1)})] = ${n(r, 2)} cm (≥ 0,5·d e ≤ d).`,
      'O diagrama de Md é deslocado de al para os dois lados: as barras só podem ser interrompidas onde o diagrama deslocado já não precisa delas.',
    ] }],
    desenho: { tipo: 'decalagem', d: a.d, al: r },
  }),

  'torcao.secaoVazada': (a, r) => ({
    secoes: [{ titulo: 'Seção vazada equivalente (17.5.1.4)', linhas: [
      `A = b·h = ${n(r.A, 0)} cm², u = 2·(b + h) = ${n(r.u, 0)} cm; he ≤ A/u e ≥ 2·c1 → he = ${n(r.he, 2)} cm.`,
      `Ae (dentro da linha média) = ${n(r.Ae, 1)} cm², ue = ${n(r.ue, 1)} cm.`,
    ] }],
    desenho: { tipo: 'torcao', b: a.b, h: a.h, he: r.he },
  }),

  'fissuracao.estadioII': (a, r) => ({
    secoes: [{ titulo: 'Seção fissurada (estádio II)', linhas: [
      `αe = ${n(a.ae, 2)}; da equação b·x²/2 = αe·As·(d − x): x = ${n(r.x, 2)} cm.`,
      `I_II = b·x³/3 + αe·As·(d − x)² = ${n(r.I, 0)} cm⁴.`,
    ] }],
    desenho: { tipo: 'estadio2', b: a.b, d: a.d, h: a.d + 4, x: r.x },
  }),

  'fissuracao.aberturaFissuras': (a, r) => ({
    secoes: [{ titulo: 'Abertura de fissuras (17.3.3.2)', linhas: [
      `Estádio II: x = ${n(r.x, 2)} cm, I = ${n(r.I, 0)} cm⁴ → σs = αe·Ms·(d − x)/I = ${n(r.sigma, 1)} MPa.`,
      `Área de envolvimento Acr = ${n(r.Acr, 1)} cm² por barra (ρr = ${n(r.rho, 4)}).`,
      `w1 = ${n(r.w1, 3)} mm, w2 = ${n(r.w2, 3)} mm → wk = ${n(r.wk, 3)} mm.`,
    ] }],
    desenho: { tipo: 'estadio2', b: a.b, d: a.d, h: a.h, x: r.x, acr: r.alturaAcr, nBarras: a.n },
  }),

  'reservatorio.compatibilizar': (a, r) => ({
    secoes: [{ titulo: 'Compatibilização dos momentos negativos na aresta', linhas: [
      `M1 = ${n(a[0], 3)}, M2 = ${n(a[1], 3)} kN·m/m: M = máx[(M1 + M2)/2; 0,8·máx(M1, M2)] = máx(${n((a[0] + a[1]) / 2, 3)}; ${n(0.8 * Math.max(a[0], a[1]), 3)}) = ${n(r, 3)} kN·m/m.`,
    ] }],
    desenho: { tipo: 'barras', titulo: 'Momento na aresta (kN·m/m)', itens: [['M1', a[0], 'par'], ['M2', a[1], 'par'], ['média', (a[0] + a[1]) / 2, 'ref'], ['0,8·máx', 0.8 * Math.max(a[0], a[1]), 'ref'], ['adotado', r, 'res']] },
  }),

  'escada.cargasEscada': (a, r) => ({
    secoes: [{ titulo: 'Cargas da escada', linhas: [
      `Degrau e = ${n(a.e, 1)} cm, p = ${n(a.p, 1)} cm → α = ${n(r.alfa, 2)}°, cos α = ${n(r.cos, 4)}.`,
      `Altura média do lance hm = h/cos α + e/2 = ${n(r.lance.hm, 2)} cm → pp = ${n(r.lance.pp, 3)} kN/m²; g = ${n(r.lance.g, 3)}, q = ${n(r.lance.q, 2)} kN/m².`,
      `Patamar: pp = ${n(r.patamar.pp, 2)}, g = ${n(r.patamar.g, 2)} kN/m².`,
    ] }],
    desenho: { tipo: 'escada', e: a.e, p: a.p, h: a.h, hm: r.lance.hm },
  }),

  'escada.tramoBiapoiado': (a, r) => ({
    secoes: [{ titulo: 'Tramo biapoiado com cargas por trecho', linhas: [
      ...a.trechos.map((t) => `De ${n(t.a, 2)} a ${n(t.b, 2)} m: ${n(t.w, 2)} kN/m.`),
      `Resultante W = ${n(r.W, 2)} kN; RA = ${n(r.RA, 2)} kN, RB = ${n(r.RB, 2)} kN; Mmáx = ${n(r.Mmax, 3)} kN·m em x = ${n(r.xM, 2)} m.`,
    ] }],
    desenho: { tipo: 'tramo', L: a.L, trechos: a.trechos, RA: r.RA, RB: r.RB, Mmax: r.Mmax, xM: r.xM },
  }),

  'madeira.compressaoMadeira': (a, r) => ({
    secoes: [{ titulo: 'Compressão com flambagem (NBR 7190-1)', linhas: [
      `σNd = Nd/A = ${n(r.sigmaN, 3)} kN/cm²; λ = ${n(r.lambdaX, 1)} (x) e ${n(r.lambdaY, 1)} (y); λrel = ${n(r.relX, 3)} / ${n(r.relY, 3)}.`,
      `kc = ${n(r.kcx, 3)} / ${n(r.kcy, 3)} → σNd/(kc·fc0,d) = ${n(r.interacaoX, 3)} / ${n(r.interacaoY, 3)} ≤ 1?`,
    ] }],
    desenho: { tipo: 'barras', titulo: 'Uso da resistência', itens: [['x', r.interacaoX, 'sol'], ['y', r.interacaoY, 'sol'], ['limite', 1, 'res']] },
  }),
  'madeira.flexaoMadeira': (a, r) => ({
    secoes: [{ titulo: 'Flexão (NBR 7190-1)', linhas: [`σ = Md/W = ${n(r.sigma, 3)} MPa ≤ fmd = ${n(r.f, 2)} MPa → uso ${n(r.uso * 100, 1)} %.`] }],
    desenho: { tipo: 'barras', titulo: 'Tensão normal (MPa)', itens: [['σMd', r.sigma, 'sol'], ['fmd', r.f, 'res']] },
  }),
  'madeira.cisalhamentoMadeira': (a, r) => ({
    secoes: [{ titulo: 'Cisalhamento (NBR 7190-1)', linhas: [`τ = 1,5·Vd/(b·h) = ${n(r.tau, 3)} MPa ≤ fvd = ${n(r.f, 2)} MPa → uso ${n(r.uso * 100, 1)} %.`] }],
    desenho: { tipo: 'barras', titulo: 'Tensão de cisalhamento (MPa)', itens: [['τd', r.tau, 'sol'], ['fvd', r.f, 'res']] },
  }),

  'vento.fatorS2': (a, r) => {
    const zs = Array.from({ length: 31 }, (_, i) => Math.max(1, (Math.max(30, a.z * 2) * i) / 30));
    return {
      secoes: [{ titulo: 'Fator S2 (NBR 6123, 5.3)', linhas: [`Categoria ${a.categoria}, classe ${a.classe}: S2 = b·Fr·(z/10)^p para z = ${n(a.z, 2)} m → S2 = ${n(r, 4)}.`] }],
      desenho: { tipo: 'curva', titulo: 'S2 ao longo da altura', x: 'S2', y: 'z (m)', pontos: zs.map((z) => [MOTORES['vento.fatorS2']({ ...a, z }), z]), destaque: [r, a.z] },
    };
  },
  'vento.pressaoDinamica': (a, r) => {
    const vk = a;
    const vs = Array.from({ length: 31 }, (_, i) => (vk * 1.5 * i) / 30);
    return {
      secoes: [{ titulo: 'Pressão dinâmica (NBR 6123, 4.2)', linhas: [`q = 0,613·Vk² = 0,613·${n(vk, 2)}² = ${n(r * 1000, 1)} N/m² = ${n(r, 4)} kN/m².`] }],
      desenho: { tipo: 'curva', titulo: 'q em função de Vk', x: 'Vk (m/s)', y: 'q (kN/m²)', pontos: vs.map((v) => [v, 0.613 * v * v / 1000]), destaque: [vk, r], xy: true },
    };
  },
  'estabilidade.gamaZ': (a, r) => ({
    secoes: [{ titulo: 'Coeficiente γz (15.5.3)', linhas: [`γz = 1/(1 − ΔMtot,d/M1,tot,d) = 1/(1 − ${n(a.dM, 3)}/${n(a.M1, 1)}) = ${n(r.gz, 4)} → estrutura de nós ${r.classe}.`] }],
    desenho: { tipo: 'regua', titulo: 'γz', valor: r.gz, min: 1, max: 1.4, faixas: [[1, 1.1, 'nós fixos'], [1.1, 1.3, 'nós móveis (2ª ordem)'], [1.3, 1.4, 'acima do usual']] },
  }),
};

/** Elemento (módulo) — por enquanto a estaca: memorial do módulo e o perfil da estaca. */
function memorialElemento(caso, r) {
  const secoes = (r.memorial ?? []).map((m) => ({ titulo: m.titulo, linhas: m.linhas }));
  if (caso.modulo === 'geotecnia.estaca') {
    return { secoes, desenho: { tipo: 'estaca', D: r.D, L: r.L, perfil: r.perfilAtrito ?? [], camadas: r.camadas ?? [], Rp: r.dq?.Rp ?? r.av?.Rp ?? 0, Padm: r.Padm, metodo: r.governa } };
  }
  return { secoes, desenho: null };
}

/** Linhas genéricas para os motores sem memorial próprio. */
function generico(caso, a, r) {
  const plano = (o, pref = '') => Object.entries(o ?? {}).flatMap(([k, v]) => (typeof v === 'number' ? [`${pref}${k} = ${n(v, 4)}`] : v && typeof v === 'object' && !Array.isArray(v) ? plano(v, `${pref}${k}.`) : []));
  return {
    secoes: [
      { titulo: 'Entradas', linhas: [Array.isArray(a) ? a.map((x) => (typeof x === 'number' ? n(x, 4) : plano(x).join('; '))).join(' · ') : plano(a).join('; ')] },
      { titulo: 'Resultado do LEBR', linhas: [typeof r === 'number' ? n(r, 4) : Array.isArray(r) ? r.map((x) => n(x, 3)).join(' · ') : plano(r).join('; ')] },
    ],
    desenho: null,
  };
}

export function memorialDoCaso(caso) {
  const r = resultadoBruto(caso);
  if (caso.alvo === 'elemento') return memorialElemento(caso, r);
  const args = argumentosDoCaso(caso);
  const fam = FAMILIAS[caso.funcao];
  const a = caso.funcao === 'reservatorio.compatibilizar' || caso.funcao === 'vento.pressaoDinamica' || caso.funcao === 'sapata.tensaoAdmissivelSPT' ? (caso.funcao === 'reservatorio.compatibilizar' ? args : args[0]) : args[0];
  if (!fam) return generico(caso, args, r);
  const m = fam(a, r);
  void MPa;
  return m;
}

export const FAMILIAS_COM_MEMORIAL = Object.keys(FAMILIAS);
