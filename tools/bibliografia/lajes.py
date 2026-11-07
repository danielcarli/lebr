# Gera validacao/casos/30-bibliografia-lajes.json — exercícios resolvidos de lajes, punção, escadas e reservatórios.
from comum import item, caso, gravar, C, S

BASTOS = dict(fonte='BASTOS, P. S. S. Lajes de concreto (notas de aula, Estruturas de Concreto I). UNESP – Faculdade de Engenharia de Bauru, agosto de 2015 (cópia hospedada na PUC Goiás). NBR 6118:2014.',
              url='https://professor.pucgoias.edu.br/SiteDocente/admin/arquivosUpload/14280/material/Lajes%20de%20Concreto%20Armado.pdf')
CAMACHO = dict(fonte='CAMACHO, J. S. Curso de concreto armado (NBR 6118/2003): estudo das lajes. UNESP – Ilha Solteira (NEPAE), 2004.',
               url='https://www.feis.unesp.br/Home/departamentos/engenhariacivil/nepae/estudo-das-lajes.pdf')
ES013 = dict(fonte='SANTOS, L. M. (coord.) et al. ES-013 – Exemplo de um projeto completo de um edifício de concreto armado. EPUSP/FDTE, 2001 (cópia hospedada na PUC Goiás).',
             url='https://professor.pucgoias.edu.br/SiteDocente/admin/arquivosUpload/14280/material/ES-013%20-%20Exemplo%20de%20C%C3%A1lculo%20Completo%20Edificio.pdf')
FARIA = dict(fonte='FARIA, A. T. Software para verificação dos estados limites de serviço de lajes maciças de concreto armado (TCC). UTFPR – Campo Mourão, 2019. NBR 6118:2014.',
             url='https://repositorio.utfpr.edu.br/jspui/bitstream/1/25132/3/softwarelajesconcretoarmado.pdf')
REGGIANI = dict(fonte='REGGIANI, R. F. P. Verificação de lajes de concreto armado no estado limite de serviço de deformação excessiva (TCC). UFSC, 2016.',
                url='https://core.ac.uk/download/43284979.pdf')
RODRIGUES = dict(fonte='RODRIGUES, C. B. Estudo de flechas em lajes maciças de concreto armado (TCC). Universidade Federal do Ceará, 2020.',
                 url='https://repositorio.ufc.br/bitstream/riufc/60437/3/2020_tcc_cbrodrigues.pdf')
LEITE = dict(fonte='LEITE, K. Análise de lajes maciças de concreto armado utilizando analogia de grelhas (TCC). UTFPR – Toledo, 2017.',
             url='https://repositorio.utfpr.edu.br/jspui/bitstream/1/15782/1/lajesmacicasconcretoarmado.pdf')
ALMEIDA = dict(fonte='ALMEIDA, J. E. D. Análise quantitativa entre dimensionamentos manual e computacional de lajes maciças (TCC). IFPB – Cajazeiras, 2021.',
               url='https://repositorio.ifpb.edu.br/bitstream/177683/1339/1/TCC%20-%20Jos%c3%a9%20Erick%20Duarte%20Almeida.pdf')
ASSUNCAO = dict(fonte='ASSUNÇÃO, L. S. Análise comparativa entre as prescrições de cálculo nas principais normas para punção em lajes cogumelo (monografia de especialização). UFMG, 2022. NBR 6118:2014.',
                url='https://repositorio.ufmg.br/bitstream/1843/45313/3/Monografia_Especializa%c3%a7%c3%a3oEstruturas.pdf')
WEDER = dict(fonte='PINTO, W. L. Comparativo de laje maciça, nervurada e lisa maciça (trabalho de especialização). UFMG, 2015. NBR 6118:2003.',
             url='https://repositorio.ufmg.br/bitstream/1843/RAOA-BD9H2K/1/tfe_weder.pdf')
BOSCO = dict(fonte='COSTA, J. B. Estruturas de concreto armado II (apostila), cap. VI – Escadas. PUC Goiás, 2016. NBR 6118:2014.',
             url='https://professor.pucgoias.edu.br/sitedocente/admin/arquivosUpload/14280/material/Apostila%20de%20CA%20II%20-%20JBC.pdf')
OLIVEIRA = dict(fonte='OLIVEIRA, I. V. Métodos de dimensionamento de uma escada autoportante (TCC). Universidade Federal de Uberlândia, 2023.',
                url='https://repositorio.ufu.br/bitstream/123456789/37121/1/M%c3%a9todosDimensionamentoEscada.pdf')
BASSANEZI = dict(fonte='BASSANEZI, D. Dimensionamento de reservatórios elevados paralelepipédicos em concreto armado (TCC). UTFPR – Toledo, 2018.',
                 url='https://riut.utfpr.edu.br/jspui/bitstream/1/15762/1/dimensionamentoreservatorioselevadosconcretoarmado.pdf')
MCLARA = dict(fonte='RODRIGUES, M. C. O. Análise comparativa entre esforços solicitantes obtidos via cálculo manual e elementos finitos (especialização). UFMG, 2018.',
              url='https://repositorio.ufmg.br/bitstream/1843/50707/1/TCC%20-%20Especializa%c3%a7%c3%a3o%20em%20Estruturas%20-%20An%c3%a1lise%20Comparativa%20de%20Esfor%c3%a7os%20-%20Maria%20Clara.pdf')

A, G = 'apoiada', 'engastada'
NOTA_NEG = ('Compara-se só o momento negativo nas bordas engastadas, que não depende do coeficiente de Poisson. Os momentos positivos das tabelas de Bares usadas pela fonte '
            'correspondem a um ν menor que o 0,2 do LEBR (elementos finitos de placa) e ficam até 15 % abaixo; não são comparados. Tolerância de 3 % pela interpolação das tabelas.')
NOTA_REAC = ('Compara-se a área de influência das bordas engastadas (processo das áreas, 14.7.6.1): área = ν\'·lx·l/10, onde l é o comprimento da borda. '
             'Nas bordas apoiadas vizinhas de bordas engastadas os coeficientes publicados (por exemplo νy = 2,17 no tipo 3) não fecham o equilíbrio da laje e não são comparados.')

casos = []


def placa(id, titulo, ref, local, descricao, lx, ly, b, esperado, nota, nu=0.2):
    a = {'lx': lx, 'ly': ly, 'bordas': dict(zip(['x0', 'x1', 'y0', 'y1'], b))}
    if nu != 0.2:
        a['nu'] = nu
    casos.append(caso(id, titulo, ref, local, descricao, 'placa.analisarPlaca', [a], esperado, nota))


def neg(mx, my, tol=0.03):
    r = []
    if mx: r.append(item("μ'x/100 (m'x = μ'x·p·lx²/100)", 'coef.mxNeg', -mx / 100, '·p·lx²', tol))
    if my: r.append(item("μ'y/100 (m'y = μ'y·p·lx²/100)", 'coef.myNeg', -my / 100, '·p·lx²', tol))
    return r


# ------------------------------------------------------------------------------------------------ momentos negativos — Bastos (tabelas de Bares)
for id, nome, lx, ly, tipo, b, mx, my in [
    ('bastos-laje-l2', 'L2', 5.86, 6.06, '3', (G, A, G, A), 7.43, 7.18),
    ('bastos-laje-l3', 'L3', 5.86, 6.56, '3', (G, A, G, A), 7.87, 7.36),
    ('bastos-laje-l5', 'L5', 4.86, 4.86, '6', (G, G, G, G), 5.15, 5.15),
    ('bastos-laje-l6', 'L6', 2.56, 4.86, '6', (G, G, G, G), 8.24, 5.72),
    ('bastos-laje-l8', 'L8', 2.86, 4.86, '5A', (A, G, G, G), 10.34, 8.10),
    ('bastos-laje-l9', 'L9', 2.56, 2.86, '5B', (G, G, A, G), 6.76, 5.65),
    ('bastos-laje-l10', 'L10', 2.86, 3.86, '3', (G, A, G, A), 9.65, 7.88)]:
    placa(id, f'Laje {nome} {round(lx*100)}×{round(ly*100)} cm, tipo {tipo} — momentos negativos', BASTOS, 'Exemplo 3.18, Tabelas 16 a 18',
          f'Laje {nome} do pavimento do exemplo 3.18, tipo {tipo} da tabela de Bares, lx = {round(lx*100)} cm e ly = {round(ly*100)} cm (λ = {ly/lx:.2f}'.replace(f'{ly/lx:.2f}', f'{ly/lx:.2f}'.replace('.', ','))
          + "). Momento negativo M = μ'·p·lx²/100.",
          lx, ly, b, neg(mx, my), NOTA_NEG)

# ------------------------------------------------------------------------------------------------ áreas de influência (reações)
for id, nome, lx, ly, tipo, b, esp in [
    ('bastos-reac-l2', 'L2', 5.86, 6.06, '3', (G, A, G, A), [('x0', 3.32, 6.06), ('y0', 3.17, 5.86)]),
    ('bastos-reac-l5', 'L5', 4.86, 4.86, '6', (G, G, G, G), [('x0', 2.50, 4.86), ('y0', 2.50, 4.86)]),
    ('bastos-reac-l6', 'L6', 2.56, 4.86, '6', (G, G, G, G), [('x0', 3.68, 4.86), ('y0', 2.50, 2.56)]),
    ('bastos-reac-l8', 'L8', 2.86, 4.86, '5A', (A, G, G, G), [('x1', 3.98, 4.86), ('y0', 3.17, 2.86)]),
    ('bastos-reac-l9', 'L9', 2.56, 2.86, '5B', (G, G, A, G), [('x0', 3.21, 2.86), ('y1', 2.50, 2.56)]),
    ('bastos-reac-l10', 'L10', 2.86, 3.86, '3', (G, A, G, A), [('x0', 3.99, 3.86), ('y0', 3.17, 2.86)])]:
    casos.append(caso(id, f'Laje {nome}, tipo {tipo} — reações nas bordas engastadas (processo das áreas)', BASTOS, 'Exemplo 3.18, Tabelas 16 a 18',
                      f'Laje {nome}, {round(lx*100)}×{round(ly*100)} cm, tipo {tipo}: coeficientes de reação ν\' das bordas engastadas (V = ν\'·p·lx/10).',
                      'placa.areasDeInfluencia', [{'lx': lx, 'ly': ly, 'bordas': dict(zip(['x0', 'x1', 'y0', 'y1'], b))}],
                      [item(f"Área da borda {k} (ν' = {str(v).replace('.', ',')})", f'area.{k}', round(v * lx * l / 10, 4), 'm²', 0.02) for k, v, l in esp], NOTA_REAC))

# ------------------------------------------------------------------------------------------------ lajes apoiadas (ν = 0,2) — momentos e flechas
NOTA_BARES = 'α da tabela de Bares para a flecha elástica a = α·p·lx⁴/(100·E·h³); no LEBR, α = 1152·w/(p·lx⁴/D) com ν = 0,2.'
placa('faria-ex2', 'Laje 6×6 m apoiada nas quatro bordas (Czerny)', FARIA, 'Seção 7.2 (Exemplo 2)',
      'Laje tipo 1 de 6×6 m, h = 15 cm, C25: αx = αy = 22,7 (m = p·lx²/α).', 6, 6, (A, A, A, A),
      [item('1/αx (Czerny)', 'coef.mxPos', 1 / 22.7, '·p·lx²', 0.01), item('1/αy (Czerny)', 'coef.myPos', 1 / 22.7, '·p·lx²', 0.01)],
      'Tabelas de Czerny com ν = 0,2; o LEBR calcula a placa por elementos finitos com ν = 0,2.')
placa('faria-ex3', 'Laje 6×9 m apoiada nas quatro bordas (Czerny)', FARIA, 'Seção 7.3 (Exemplo 3)',
      'Laje tipo 1 de 6×9 m, h = 15 cm, C25: αx = 12,7 e αy = 23,5.', 6, 9, (A, A, A, A),
      [item('1/αx (Czerny)', 'coef.mxPos', 1 / 12.7, '·p·lx²', 0.01), item('1/αy (Czerny)', 'coef.myPos', 1 / 23.5, '·p·lx²', 0.01)],
      'Tabelas de Czerny com ν = 0,2.')
placa('faria-ex1', 'Laje 5×6,5 m com a borda maior engastada (Czerny 2B)', FARIA, 'Seção 7.1 (Exemplo 1)',
      'Laje tipo 2B de Czerny (três bordas apoiadas e uma das bordas maiores engastada), 5,0×6,5 m, h = 10 cm: αy = 35,4 e βx = 9,7.', 5, 6.5, (G, A, A, A),
      [item('1/βx (negativo)', 'coef.mxNeg', -1 / 9.7, '·p·lx²', 0.01), item('1/αy', 'coef.myPos', 1 / 35.4, '·p·lx²', 0.01)],
      'O positivo na direção x (αx = 20,7) corresponde a ν = 0 e não é comparado (o LEBR dá 1/19,2 com ν = 0,2).')
placa('rodrigues-ex1', 'Laje 7×7 m apoiada (Bares caso 1) — momentos e flecha', RODRIGUES, 'Exemplo 1 (L1)',
      'Laje isolada 7×7 m, h = 12 cm, C20, apoiada nas quatro bordas: μx = μy = 4,41 e α = 4,67 (Bares).', 7, 7, (A, A, A, A),
      [item('μx/100', 'coef.mxPos', 0.0441, '·p·lx²', 0.01), item('α/1152 (flecha)', 'coef.w', 4.67 / 1152, '·p·lx⁴/D', 0.01)], NOTA_BARES)
placa('rodrigues-ex2', 'Laje 7×8 m apoiada (Bares caso 1) — momentos e flecha', RODRIGUES, 'Exemplo 2 (L2)',
      'Laje isolada 7×8 m, h = 12 cm, C20: μx = 5,56, μy = 4,49 e α = 6,09 (Bares, λ = 1,15).', 7, 8, (A, A, A, A),
      [item('μx/100', 'coef.mxPos', 0.0556, '·p·lx²', 0.01), item('μy/100', 'coef.myPos', 0.0449, '·p·lx²', 0.01),
       item('α/1152 (flecha)', 'coef.w', 6.09 / 1152, '·p·lx⁴/D', 0.02)],
      NOTA_BARES + ' A fonte lê a tabela em λ = 1,15 (a laje tem 8/7 = 1,143); tolerância de 2 % na flecha.')
placa('rodrigues-ex3-l3', 'Laje 7×9 m com duas bordas adjacentes engastadas — momentos negativos', RODRIGUES, 'Exemplo 3 (L3/L4)',
      'Pavimento de 4 lajes contínuas; L3 de 7×9 m com as bordas internas engastadas e as externas apoiadas: μ\'x = 9,37 e μ\'y = 7,81.', 7, 9, (G, A, G, A),
      neg(9.37, 7.81), NOTA_NEG + ' A fonte lê a tabela em λ = 1,30 (a laje tem 9/7 = 1,286).')
for id, L, a in [('reggiani-6x6', 6, 4.67), ('reggiani-6x9', 9, 8.87), ('reggiani-6x12', 12, 11.68)]:
    placa(id, f'Laje 6×{L} m apoiada — coeficiente de flecha de Bares', REGGIANI, {6: 'Seção 7.1', 9: 'Seção 7.2', 12: 'Seção 7.3'}[L],
          f'Laje 6×{L} m simplesmente apoiada nas quatro bordas, h = 15 cm, C25: α = {str(a).replace(".", ",")} (Bares) para a flecha elástica.', 6, L, (A, A, A, A),
          [item('α/1152 (flecha)', 'coef.w', a / 1152, '·p·lx⁴/D', 0.01)], NOTA_BARES)
for id, caso_, b, a in [('leite-caso3', '3', (G, A, G, A), 4.46), ('leite-caso5a', '5A', (A, G, G, G), 3.98), ('leite-caso6', '6', (G, G, G, G), 2.56)]:
    placa(id, f'Laje 4×6 m, caso {caso_} de Bares — coeficiente de flecha', LEITE, 'Seções 3.1 e 4.2.1',
          f'Laje 4×6 m (λ = 1,5), h = 8 cm, caso {caso_}: α = {str(a).replace(".", ",")} para a flecha imediata.', 4, 6, b,
          [item('α/1152 (flecha)', 'coef.w', a / 1152, '·p·lx⁴/D', 0.035)], NOTA_BARES + ' Tolerância de 3,5 %: a fonte usa o α da tabela, arredondado e com ν da tabela.')
placa('bastos-laje-l2-flecha', 'Laje L2 586×606, tipo 3 — coeficiente de flecha', BASTOS, 'Exemplo 3.18, item 3.18.6.1',
      'Laje L2, tipo 3: α = 2,72 da Tabela A-1 (lida em λ = 1,05).', 5.86, 6.06, (G, A, G, A),
      [item('α/1152 (flecha)', 'coef.w', 2.72 / 1152, '·p·lx⁴/D', 0.02)], NOTA_BARES)

# ------------------------------------------------------------------------------------------------ cortante em lajes (VRd1)
NOTA_VRD1 = 'VRd1 = τRd·k·(1,2 + 40ρ1)·bw·d com τRd = 0,25·fctd, k = 1,6 − d (d em m) e σcp = 0 (19.4.1), por metro de largura.'
for id, titulo, ref, local, desc, d, As, fck, k, VRd1 in [
    ('bastos-l1-vrd1', 'Laje L1 em balanço, h = 11 cm — VRd1', BASTOS, 'Exemplo 3.18, laje L1, item 3.18.7', 'd = 9 cm, armadura ø 8 c/8 (6,25 cm²/m), C25.', 9, 6.25, 25, 1.51, 64.3),
    ('bastos-l4-vrd1', 'Laje L4 armada em uma direção, h = 9 cm — VRd1', BASTOS, 'Exemplo 3.18, laje L4, item 3.18.7', 'd = 6,5 cm, ø 5 c/9 (2,22 cm²/m), C25.', 6.5, 2.22, 25, 1.535, 42.7),
    ('camacho-l1-vrd1', 'Laje em balanço L1, d = 11,5 cm, C20 — VRd1', CAMACHO, 'Exercício 9.1, p. 48', 'h = 13,5 cm, d = 11,5 cm, As = 2,35 cm²/m, C20, VSd = 15,55 kN/m.', 11.5, 2.35, 20, 1.485, 60.43),
    ('bosco-escada-vrd1', 'Escada armada longitudinalmente, d = 8 cm — VRd1', BOSCO, 'Cap. VI, p. VI-13', 'h = 10 cm, d = 8 cm, ø 10 c/10 (8,00 cm²/m), C25.', 8, 8.0, 25, 1.52, 62.05),
    ('ifpb-l1-vrd1', 'Laje L1, d = 5,1 cm, C30 — VRd1', ALMEIDA, 'Apêndice, tabela de cisalhamento', 'd = 5,1 cm, ρ1 = 0,0065, C30.', 5.1, round(0.0065 * 510, 4), 30, 1.549, 41.78),
    ('ifpb-l4-vrd1', 'Laje L4, d = 8,1 cm, C30 — VRd1', ALMEIDA, 'Apêndice, tabela de cisalhamento', 'd = 8,1 cm, ρ1 = 0,0035, C30.', 8.1, round(0.0035 * 810, 4), 30, 1.519, 59.61),
    ('ifpb-l11-vrd1', 'Laje L11, d = 8,1 cm, C30 — VRd1', ALMEIDA, 'Apêndice, tabela de cisalhamento', 'd = 8,1 cm, ρ1 = 0,0041, C30.', 8.1, round(0.0041 * 810, 4), 30, 1.519, 60.80)]:
    nota = NOTA_VRD1 + (' A fonte usa k = 1,515 (d = 8,5 cm em algum passo); tolerância de 1 %.' if id.startswith('bosco') else '')
    casos.append(caso(id, titulo, ref, local, desc, 'cisalhamento.verificarCortanteLaje', [{'Vd': 10, 'd': d, 'As1': As, 'c': C(fck)}],
                      [item('k', 'k', k, '', 0.005), item('VRd1', 'VRd1', VRd1, 'kN/m', 0.01 if id.startswith('bosco') else 0.004)], nota))

# ------------------------------------------------------------------------------------------------ flexão em lajes (b = 100 cm)
NOTA_LF = 'Faixa de 1 m (b = 100 cm), diagrama retangular simplificado; compara-se a armadura calculada, antes da mínima.'
for id, titulo, ref, local, desc, Md, h, d, fck, As, tol in [
    ('bastos-l2-negativa', 'Laje L2, borda L2-L3: M = 1447 kN·cm/m, d = 10 cm', BASTOS, 'Exemplo 3.18, item 3.18.6.1', 'Mk = 1447 kN·cm/m (Md = 20,26 kN·m/m), h = 12 cm, d = 10 cm, C25: Kc = 4,9, Ks = 0,025.', 20.258, 12, 10, 25, 5.07, 0.02),
    ('bastos-l3-negativa', 'Laje L3, borda L3-L2: M = 1663 kN·cm/m, d = 11 cm', BASTOS, 'Exemplo 3.18, laje L3', 'Mk = 1663 kN·cm/m (Md = 23,28 kN·m/m), h = 13 cm, d = 11 cm, C25: Kc = 5,2, Ks = 0,025.', 23.282, 13, 11, 25, 5.30, 0.02),
    ('faria-ex1-x', 'Laje 5×6,5 m: mx,d = 11,55 kN·m/m, dx = 7,5 cm', FARIA, 'Seção 7.1', 'h = 10 cm, dx = 7,5 cm, C25, CA-50.', 11.55, 10, 7.5, 25, 3.83, 0.006),
    ('faria-ex1-y', 'Laje 5×6,5 m: my,d = 6,75 kN·m/m, dy = 6,6 cm', FARIA, 'Seção 7.1', 'h = 10 cm, dy = 6,6 cm, C25, CA-50.', 6.75, 10, 6.6, 25, 2.49, 0.006),
    ('faria-ex2-x', 'Laje 6×6 m: mx,d = 14,99 kN·m/m, dx = 12,1 cm', FARIA, 'Seção 7.2', 'h = 15 cm, dx = 12,1 cm, C25, CA-50.', 14.99, 15, 12.1, 25, 2.96, 0.006),
    ('faria-ex2-y', 'Laje 6×6 m: my,d = 14,99 kN·m/m, dy = 11,3 cm', FARIA, 'Seção 7.2', 'h = 15 cm, dy = 11,3 cm, C25, CA-50.', 14.99, 15, 11.3, 25, 3.18, 0.006),
    ('faria-ex3-x', 'Laje 6×9 m: mx,d = 26,79 kN·m/m, dx = 12 cm', FARIA, 'Seção 7.3', 'h = 15 cm, dx = 12 cm, C25, CA-50.', 26.79, 15, 12, 25, 5.50, 0.006),
    ('faria-ex3-y', 'Laje 6×9 m: my,d = 14,48 kN·m/m, dy = 11,1 cm', FARIA, 'Seção 7.3', 'h = 15 cm, dy = 11,1 cm, C25, CA-50.', 14.48, 15, 11.1, 25, 3.13, 0.006),
    ('rodrigues-ex1-as', 'Laje 7×7 m: Mxd = 22,69 kN·m/m, d = 9,5 cm, C20', RODRIGUES, 'Exemplo 1 (L1)', 'h = 12 cm, d = 9,5 cm, C20, CA-50: x = 2,785 cm.', 22.69, 12, 9.5, 20, 6.22, 0.006),
    ('rodrigues-ex2-as', 'Laje 7×8 m: Mdx = 28,61 kN·m/m, d = 9,5 cm, C20', RODRIGUES, 'Exemplo 2 (L2)', 'h = 12 cm, d = 9,5 cm, C20, CA-50: x = 3,665 cm.', 28.61, 12, 9.5, 20, 8.19, 0.006),
    ('bosco-escada-as', 'Escada: Md = 22,97 kN·m/m, d = 8 cm, C25', BOSCO, 'Cap. VI, p. VI-11', 'Escada biapoiada com vão horizontal de 3,82 m, h = 10 cm, d = 8 cm, C25, CA-50: Kc = 2,78, Ks = 0,027.', 22.97, 10, 8, 25, 7.75, 0.02)]:
    casos.append(caso(id, titulo, ref, local, desc, 'flexao.dimensionarFlexao', [{'Md': Md, 'b': 100, 'h': h, 'd': d, 'c': C(fck), 's': S}],
                      [item('As', 'AsCalc', As, 'cm²/m', tol)], NOTA_LF + (' A fonte usa as tabelas de Kc e Ks, com Ks de três casas decimais; tolerância de 2 %.' if tol > 0.006 else '')))

# ------------------------------------------------------------------------------------------------ punção
NOTA_PUN = ('O τRd1 não é comparado: a fonte usa k = 1 + √(20/d) sem limite ({k}), e o LEBR limita k a 2. '
            'Perímetros, tensões solicitantes sem momento e τRd2 = 0,27·αv2·fcd seguem a mesma formulação.')
def puncao(id, titulo, ref, local, descricao, a, esperado, nota):
    a = dict(a); fck = a.pop('fck')
    a.update({'c': C(fck), 's': S})
    casos.append(caso(id, titulo, ref, local, descricao, 'puncao.verificarPuncao', [a], esperado, nota))

puncao('camacho-puncao-ex1', 'Pilar interno 20×20, laje lisa h = 15 cm, FSd = 113,4 kN', CAMACHO, 'Exercício 9.2, Exemplo 1, p. 51–52',
       'Laje lisa h = 15 cm, d = 12 cm, pilar P3 20×20 cm com carga centrada (calculado como interno), C20, Fk = 81 kN (FSd = 113,4 kN), ρ = 0,0033.',
       {'FSd': 113.4, 'posicao': 'interna', 'c1': 20, 'c2': 20, 'd': 12, 'h': 15, 'rho': 0.0033, 'fck': 20},
       [item('u (contorno C)', 'C.u', 80, 'cm', 0.001), item('τSd no contorno C', 'C.tauSd', 1.18, 'MPa', 0.005), item('τRd2', 'tauRd2', 3.55, 'MPa', 0.003),
        item("u (contorno C')", 'C1.u', 230.72, 'cm', 0.001), item("τSd no contorno C'", 'C1.tauSd', 0.41, 'MPa', 0.005)],
       NOTA_PUN.format(k='2,29; τRd1 = 0,56 MPa contra 0,49 MPa no LEBR') + ' A fonte usa π = 3,14 no perímetro.')
puncao('assuncao-puncao-interno', 'Pilar interno 20×30, laje h = 16 cm, C30 — contornos e τRd2', ASSUNCAO, 'Cap. 4, pilar interno pela NBR 6118',
       'Laje cogumelo h = 16 cm, d ≈ 13 cm, pilar interno 20×30 cm, C30, ρ = 6,540×10⁻³, FSd = 280 kN com momentos nas duas direções.',
       {'FSd': 280, 'posicao': 'interna', 'c1': 20, 'c2': 30, 'd': 13, 'h': 16, 'rho': 0.00654, 'fck': 30},
       [item('u0 (contorno C)', 'C.u', 100, 'cm', 0.001), item("u1 (contorno C')", 'C1.u', 263.36, 'cm', 0.001), item('τRd2', 'tauRd2', 5.09, 'MPa', 0.003)],
       'As tensões solicitantes não são comparadas: a fonte soma os momentos das duas direções e o LEBR considera o momento num só plano. ' + NOTA_PUN.format(k='2,24; τRd1 = 0,786 MPa contra 0,701 MPa no LEBR'))
puncao('assuncao-puncao-borda', 'Pilar de borda 30×20, laje h = 16 cm — perímetros reduzidos', ASSUNCAO, 'Cap. 4, pilar de borda pela NBR 6118',
       'Mesma laje, pilar de borda com c1 = 30 cm (perpendicular à borda) e c2 = 20 cm: a = min(1,5d; c1/2) = 15 cm.',
       {'FSd': 204.96, 'posicao': 'borda', 'c1': 30, 'c2': 20, 'd': 13, 'h': 16, 'rho': 0.00654, 'fck': 30},
       [item('u* (contorno C)', 'C.u', 50, 'cm', 0.001), item("u* (contorno C')", 'C1.u', 131.68, 'cm', 0.001)],
       'Só os perímetros reduzidos são comparados: as tensões da fonte incluem o momento, que o LEBR não considera em pilares de borda.')
puncao('assuncao-puncao-canto', 'Pilar de canto 20×30, laje h = 16 cm, FSd = 105 kN', ASSUNCAO, 'Cap. 4, pilar de canto pela NBR 6118',
       'Mesma laje, pilar de canto 20 (x) × 30 (y) cm, FSd = 105 kN.',
       {'FSd': 105, 'posicao': 'canto', 'c1': 20, 'c2': 30, 'd': 13, 'h': 16, 'rho': 0.00654, 'fck': 30},
       [item("u* (contorno C')", 'C1.u', 65.84, 'cm', 0.001), item("τSd no contorno C'", 'C1.tauSd', 1.23, 'MPa', 0.005)],
       "Em C' a tensão da fonte (0,123 kN/cm²) é FSd/(u*·d), sem parcela de momento. " + NOTA_PUN.format(k='2,24'))
puncao('weder-puncao-p5', 'Pilar interno 40×40, laje lisa h = 22 cm, FSd = 806,4 kN', WEDER, 'Seção de punção, pilar P5',
       'Laje lisa h = 22 cm, d = 18,5 cm, pilar interno P5 40×40 cm com carga centrada FSd = 806,4 kN, C25.',
       {'FSd': 806.4, 'posicao': 'interna', 'c1': 40, 'c2': 40, 'd': 18.5, 'h': 22, 'rho': 0.005, 'fck': 25},
       [item('u0', 'C.u', 160, 'cm', 0.001), item('τRd2', 'tauRd2', 4.34, 'MPa', 0.003), item("u (C', 2d)", 'C1.u', 392.5, 'cm', 0.001),
        item("τSd em C'", 'C1.tauSd', 1.11, 'MPa', 0.005)],
       'A taxa ρ não é informada na fonte (o caso usa 0,5 %, que só afeta τRd1, não comparado). Os rótulos das tensões em C\' foram identificados por recálculo: 806,4/(392,5·18,5) = 1,11 MPa.')

# ------------------------------------------------------------------------------------------------ escadas
casos.append(caso('oliveira-escada-cargas', 'Escada com espelho 17,5 cm e piso 30 cm, h = 12 cm — espessura média e cargas', OLIVEIRA, 'Seção 3, p. 23–29, Eqs. 3 a 11',
                  'Escada com espelho 17,5 cm, passo 30 cm, h = 12 cm, revestimento 1,0 kN/m², q = 3,0 kN/m², concreto 25 kN/m³. h1 = h/cos α, hm = h1 + e/2.',
                  'escada.cargasEscada', [{'h': 12, 'e': 17.5, 'p': 30, 'revestimento': 1.0, 'q': 3.0}],
                  [item('hm', 'lance.hm', 22.64, 'cm', 0.002), item('Peso próprio do lance', 'lance.pp', 5.66, 'kN/m²', 0.002),
                   item('g do lance (pp + revestimento)', 'lance.g', 6.66, 'kN/m²', 0.002), item('Peso próprio do patamar', 'patamar.pp', 3.0, 'kN/m²', 0.001)]))
casos.append(caso('bosco-escada-cargas', 'Escada com h = 10 cm, espelho 17 cm e piso 30 cm — espessura média', BOSCO, 'Cap. VI, p. VI-7 a VI-9',
                  'Escada biapoiada, h = 10 cm, revestimento 1,5 kN/m², q = 3,0 kN/m²: hm = 20 cm, peso próprio do lance 5,0 kN/m² e do patamar 2,5 kN/m².',
                  'escada.cargasEscada', [{'h': 10, 'e': 17, 'p': 30, 'revestimento': 1.5, 'q': 3.0}],
                  [item('hm', 'lance.hm', 20, 'cm', 0.002), item('Peso próprio do lance', 'lance.pp', 5.0, 'kN/m²', 0.002), item('Peso próprio do patamar', 'patamar.pp', 2.5, 'kN/m²', 0.001)],
                  'Espelho e piso estão pouco legíveis no texto extraído (17/30 cm); são os valores que reproduzem hm = 20 cm.'))
casos.append(caso('bosco-escada-esforcos', 'Escada biapoiada patamar–lance–patamar, vão de 3,82 m — reações e momento máximo', BOSCO, 'Cap. VI, p. VI-9 a VI-11',
                  'Vão horizontal de 3,82 m: patamares de 0,86 m com 7,0 kN/m e lance de 2,10 m com 9,5 kN/m (cargas por metro de largura). VA = VB = 16 kN/m e Mk,máx = 16,41 kN·m/m em x = 1,91 m.',
                  'escada.tramoBiapoiado', [{'trechos': [{'a': 0, 'b': 0.86, 'w': 7.0}, {'a': 0.86, 'b': 2.96, 'w': 9.5}, {'a': 2.96, 'b': 3.82, 'w': 7.0}], 'L': 3.82}],
                  [item('VA', 'RA', 16.0, 'kN/m', 0.003), item('VB', 'RB', 16.0, 'kN/m', 0.003), item('Mk,máx', 'Mmax', 16.41, 'kN·m/m', 0.003), item('Posição do máximo', 'xM', 1.91, 'm', 0.003)],
                  'A extração da fonte traz a geometria de forma incoerente (2,96 m e 2,1 m); a disposição simétrica 0,86 + 2,10 + 0,86 m é a que reproduz as reações e o momento publicados.'))

# ------------------------------------------------------------------------------------------------ compatibilização de momentos negativos
for id, titulo, ref, local, desc, m1, m2, res in [
    ('bassanezi-parede12-fundo', 'Reservatório: parede 01/02 × fundo (9,285 e 15,264 kN·m/m)', BASSANEZI, 'Tabelas 9 a 12', 'Compatibilização na aresta parede 01/02 × fundo de reservatório de 2 células: max(0,8·Xmaior; média).', 9.285, 15.264, 12.275),
    ('bassanezi-parede34-fundo', 'Reservatório: parede 03/04 × fundo (7,580 e 13,880 kN·m/m)', BASSANEZI, 'Tabelas 9 a 12', 'Aresta parede 03/04 × fundo.', 7.580, 13.880, 11.104),
    ('bassanezi-paredes', 'Reservatório: parede 01/02 × parede 03/04 (12,690 e 11,032 kN·m/m)', BASSANEZI, 'Tabelas 9 a 12', 'Aresta vertical entre paredes.', 12.690, 11.032, 11.861),
    ('camacho-l3-l4', 'Lajes L3 × L4: 4,42 e 3,21 kN·m/m', CAMACHO, 'Exercício 9.1, p. 42–47', 'Negativos de L3 (Marcus, caso 3) e L4 (caso 5a) na borda comum.', 4.42, 3.21, 3.82),
    ('camacho-l2-l3', 'Lajes L2 × L3: 4,34 e 2,50 kN·m/m', CAMACHO, 'Exercício 9.1, p. 42–47', 'Negativo de L2 (armada em uma direção) e de L3 na borda comum.', 4.34, 2.50, 3.47),
    ('camacho-l4-l6', 'Lajes L4 × L6: 3,21 e 6,84 kN·m/m', CAMACHO, 'Exercício 9.1, p. 42–47', 'Negativo de L4 e de L6 (borda livre, tabelas de Polillo).', 3.21, 6.84, 5.47),
    ('es013-mb12', 'Lajes L1 × L2: 1856,6 e 1821,2 kN·cm/m', ES013, 'Cap. 1–2, Tabelas 1.18 e 2-3', 'Momentos de cálculo na borda comum L1-L2 (Czerny): média > 0,8·maior.', 1856.6, 1821.2, 1838.9),
    ('mclara-l3-l4', 'Lajes L3 × L4: 1,2675 e 7,497 kN·m/m', MCLARA, 'Tabelas 4 a 7', 'Borda comum de L3 (armada em uma direção) e L4 (Tepedino): Xmed = 4,3823 e 0,8·Xmáx = 5,9976.', 1.2675, 7.497, 5.9976)]:
    casos.append(caso(id, titulo, ref, local, desc, 'reservatorio.compatibilizar', [m1, m2], [item('Momento compatibilizado', '', res, '', 0.003)],
                      'Critério X = max(0,8·Xmaior; (X1 + X2)/2), igual ao da fonte.'))

gravar('30-bibliografia-lajes.json', 'Bibliografia — lajes, punção, escadas e reservatórios',
       'Exercícios resolvidos publicados (apostilas de P. S. S. Bastos/UNESP, J. S. Camacho/UNESP, ES-013/EPUSP, J. B. Costa/PUC Goiás e TCCs): momentos negativos, reações e flechas por tabela, VRd1, armadura de lajes, punção, escadas e compatibilização de momentos.',
       casos)
