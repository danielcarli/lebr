# Gera validacao/casos/31-bibliografia-madeira-acoes.json — exercícios resolvidos de madeira (NBR 7190-1:2022), vento e estabilidade global.
from comum import item, caso, gravar

NUNES = dict(fonte='NUNES, B. L. Projeto estrutural da Casa da Acolhida do HU-UEPG: adaptação da estrutura de concreto para madeira, de acordo com a NBR 7190:2022 (TCC). Universidade Estadual de Ponta Grossa, 2022.',
             url='https://ri.uepg.br/monografias/bitstream/handle/123456789/227/TCC_Bruno%20Leonardo%20Nunes.pdf?sequence=1')
UFAL = dict(fonte='SANTOS, L. B. Peças compostas em estruturas de madeira (com exercícios resolvidos). UFAL / eduCAPES, 2026. NBR 7190-1:2022.',
            url='https://educapes.capes.gov.br/bitstream/capes/1179761/2/Pe%c3%a7asCompostas.Madeira%20-%20Vers%c3%a3o%201.pdf')
UNESP = dict(fonte='CARROCIÈRE, D. G. Estudo comparativo dos sistemas de fôrmas e cimbramentos em madeira para uso em estruturas de concreto armado (monografia). UNESP – Ilha Solteira, 2025. NBR 7190-1:2022.',
             url='https://repositorio.unesp.br/bitstreams/7934faf7-fcff-4e97-8de3-916e1b84e952/download')
UFPB = dict(fonte='SANTOS, L. C. L. Cálculo e verificação de elementos estruturais de um edifício de madeira de acordo com a NBR 7190-1:2022: um estudo de caso (TCC). UFPB, 2024.',
            url='https://repositorio.ufpb.br/jspui/bitstream/123456789/35936/1/TCC_LUIZ_CARLOS_LIRA_DOS_SANTOS_20190096359_%28VOLUME%20FINAL%29.pdf')
UTFPR = dict(fonte='SANTOS, R. M. P. Análise estrutural de um edifício de múltiplos pavimentos considerando a ação do vento via método estático, simplificado e discreto conforme NBR 6123 (TCC). UTFPR – Campo Mourão, 2019.',
             url='https://riut.utfpr.edu.br/jspui/bitstream/1/25471/1/analiseestruturaledificio.pdf')
ZUMAETA = dict(fonte='ZUMAETA, W. Análise da estabilidade de edifícios com estrutura de concreto armado (e-book). TQS, 2016.',
               url='https://dl.tqs.com.br/files/Ebook_Analise_da_Estabilidade_Edificios.pdf')

NOTA_KC = ('NBR 7190-1:2022: λrel = (λ/π)·√(fc0,k/E0,05), k = 0,5·[1 + βc(λrel − 0,3) + λrel²] e kc = 1/(k + √(k² − λrel²)). '
           'O material entra no caso com os valores da fonte (fc0,k, E0,05, βc e fc0,d), sem passar pelas tabelas de classes do LEBR.')

casos = []


def comp(id, titulo, ref, local, descricao, Nd, b, h, L0x, L0y, m, esperado, nota=NOTA_KC):
    mm = {'kM': 0.7, 'fmd': m['fc0d']}
    mm.update(m)
    casos.append(caso(id, titulo, ref, local, descricao, 'madeira.compressaoMadeira',
                      [{'Nd': Nd, 'b': b, 'h': h, 'L0x': L0x, 'L0y': L0y, 'm': mm}], esperado, nota))


comp('nunes-pilar-15x15', 'Pilar de pinus 15×15 cm, L0 = 3,0 m, carga centrada', NUNES, 'Seção 4.4.2, p. 53–55',
     'Pré-dimensionamento de pilar biarticulado de pinus 15×15 cm, L0 = 3,0 m, fc0,k = 14 MPa, E0,05 = 3500 MPa, kmod = 0,54 (fc0,d = 5,40 MPa), βc = 0,2, Nd = 801,4 N.',
     0.8014, 15, 15, 300, 300, {'fc0k': 14, 'E005': 3500, 'betaC': 0.2, 'fc0d': 5.40},
     [item('λ', 'lambdaX', 69.282, '', 0.001), item('λrel', 'relX', 1.395, '', 0.002), item('kc', 'kcx', 0.4292, '', 0.002),
      item('σc,Nd', 'sigmaN', 0.036, 'MPa', 0.02), item('Razão de verificação', 'interacaoX', 0.0155, '', 0.01)])
comp('ufal-ex4-1-mlc', 'Banzo comprimido de MLC 250×150 mm, Nd = 150 kN', UFAL, 'Exemplo 4.1, p. 51',
     'Banzo comprimido de treliça em madeira lamelada colada, seção 250×150 mm (6 lamelas de 25 mm), Nc,Sd = 150 kN, L0 = 150 cm no plano da dimensão de 15 cm e 450 cm no plano da de 25 cm; fc0,k = 26 MPa, E0,05 = 9400 MPa, kmod = 0,532 (fc0,d = 9,88 MPa), βc = 0,1 (MLC).',
     150, 25, 15, 150, 450, {'fc0k': 26, 'E005': 9400, 'betaC': 0.1, 'fc0d': 9.88},
     [item('λx', 'lambdaX', 34.64, '', 0.001), item('λy', 'lambdaY', 62.33, '', 0.001), item('λrel,x', 'relX', 0.580, '', 0.002), item('λrel,y', 'relY', 1.044, '', 0.002),
      item('kc,x', 'kcx', 0.961, '', 0.002), item('kc,y', 'kcy', 0.732, '', 0.002), item('σc', 'sigmaN', 4.0, 'MPa', 0.001),
      item('Razão x', 'interacaoX', 0.42, '', 0.01), item('Razão y', 'interacaoY', 0.55, '', 0.01)],
     NOTA_KC + ' A fonte chama a madeira de C40, mas usa fc0,k = 26 MPa (D40 de floresta plantada).')
comp('unesp-pontalete', 'Pontalete de cimbramento 7,5×7,5 cm, Le = 280 cm', UNESP, 'Seção 7.3.5, p. 86–88',
     'Pontalete de cimbramento 7,5×7,5 cm, Le = 280 cm, Nd = 3,07 kN, fc0,k = 22 MPa, E0,05 = 7700 MPa, kmod = 0,63 (fc0,d = 9,9 MPa), βc = 0,2.',
     3.07, 7.5, 7.5, 280, 280, {'fc0k': 22, 'E005': 7700, 'betaC': 0.2, 'fc0d': 9.9},
     [item('λ', 'lambdaX', 129.6, '', 0.003), item('λrel', 'relX', 2.20, '', 0.003), item('kc', 'kcx', 0.187, '', 0.01), item('Razão de verificação', 'interacaoX', 0.30, '', 0.03)],
     NOTA_KC + ' A fonte usa i = 2,16 cm (λ = 129,6); com i = 7,5/√12 = 2,165 cm, λ = 129,3. Ela arredonda a razão para 0,30 (com os valores dela, 0,297).')
casos.append(caso('ufpb-v18-flexao', 'Viga V18 20×37,5 cm em D30, Md = 39,964 kN·m — tensão de flexão', UFPB, 'Viga V18, p. 71–76',
                  'Viga 20×37,5 cm de dicotiledônea D30 (kmod = 0,456, fm,d = 9,77 MPa), Mxd = 39,964 kN·m: σM,d = Md/W.',
                  'madeira.flexaoMadeira', [{'Md': 39.964, 'b': 20, 'h': 37.5, 'm': {'fmd': 9.77}}],
                  [item('σM,d', 'sigma', 8.53, 'MPa', 0.002), item('Razão σ/fm,d', 'uso', 0.8725, '', 0.003)]))
casos.append(caso('ufpb-v18-cisalhamento', 'Viga V18 20×37,5 cm em D30, Vd = 45,174 kN — cisalhamento', UFPB, 'Viga V18, p. 71–76',
                  'Mesma viga, Vd = 45,174 kN, fv,d = 1,01 MPa: τd = 1,5·Vd/(b·h).',
                  'madeira.cisalhamentoMadeira', [{'Vd': 45.174, 'b': 20, 'h': 37.5, 'm': {'fvd': 1.01}}],
                  [item('τd', 'tau', 0.90, 'MPa', 0.005), item('Razão τ/fv,d', 'uso', 0.8916, '', 0.005)],
                  'A fonte dá a razão em porcentagem (89,16 %).'))

# ------------------------------------------------------------------------------------------------ vento
for z, S2, q in [(3.8, 0.70, 608.74), (19.0, 0.87, 940.06), (38.0, 0.96, 1133.53), (79.8, 1.06, 1384.94)]:
    zs = str(z).replace('.', ',')
    casos.append(caso(f'utfpr-vento-s2-{str(z).replace(".", "-")}', f'Vento: S2 a z = {zs} m (categoria IV, classe C)', UTFPR, 'Tabela 6, §5.2.1 (método estático)',
                      f'Edifício de 21 pavimentos (H = 79,8 m), categoria IV, classe C (b = 0,84, p = 0,135, Fr = 0,95): S2 = b·Fr·(z/10)^p na cota z = {zs} m.',
                      'vento.fatorS2', [{'z': z, 'categoria': 'IV', 'classe': 'C'}], [item('S2', '', S2, '', 0.006)],
                      'A fonte publica S2 com duas casas; a pressão dinâmica correspondente é conferida no caso seguinte.'))
    casos.append(caso(f'utfpr-vento-q-{str(z).replace(".", "-")}', f'Vento: pressão dinâmica a z = {zs} m (V0 = 45 m/s)', UTFPR, 'Tabela 6, §5.2.1 (método estático)',
                      f'V0 = 45 m/s, S1 = S3 = 1,0: Vk = 45·S2 e q = 0,613·Vk². Com S2 = 0,84·0,95·({zs}/10)^0,135.',
                      'vento.pressaoDinamica', [round(45 * 0.84 * 0.95 * (z / 10) ** 0.135, 6)], [item('q', '', q / 1000, 'kN/m²', 0.001)],
                      'A velocidade característica do caso é calculada com o mesmo S2 da norma (Vk = 45·0,84·0,95·(z/10)^0,135), conferido no caso anterior.'))

# ------------------------------------------------------------------------------------------------ estabilidade global
casos.append(caso('zumaeta-gz-1', 'γz de pilar em balanço 50×100, 5 m, Fd = 70 kN e Pd = 840 kN', ZUMAETA, 'Seção 2.5, p. 43–48',
                  'Pilar em balanço de 5 m, seção 0,5×1,0 m, C25 (Eci = 28 000 MPa, rigidez 0,7·Eci·Ic), F = 50 kN no topo e P = 600 kN (γf = 1,4). Deslocamento horizontal do topo 0,0036 m: M1 = 70·5 = 350 kN·m e ΔM = 840·0,0036.',
                  'estabilidade.gamaZ', [{'M1': 350, 'dM': 840 * 0.0036}], [item('γz', 'gz', 1.009, '', 0.0005)]))
casos.append(caso('zumaeta-gz-2', 'γz de pilar em balanço 100×50, 5 m, P = 10 000 kN', ZUMAETA, 'Seção 3.2, p. 53–63',
                  'Pilar 100×50 cm em balanço de 5 m, P = 10 000 kN e F = 50 kN (γf = 1,4): Δ = 3,572×10⁻³ m, M1 = 350 kN·m, ΔM = 14 000·Δ = 50,008 kN·m. O P-Δ iterativo converge para 408,34 kN·m; com γz, 408,45 kN·m.',
                  'estabilidade.gamaZ', [{'M1': 350, 'dM': 50.008}], [item('γz', 'gz', 1.167, '', 0.0005), item('Fator para os esforços horizontais', 'fator', 0.95 * 1.167, '', 0.001)],
                  'Na faixa 1,1 < γz ≤ 1,3, os esforços horizontais são majorados por 0,95·γz (15.7.2); a fonte mostra F = 55,43 kN = 0,95·γz·50.'))

gravar('31-bibliografia-madeira-acoes.json', 'Bibliografia — madeira, vento e estabilidade global',
       'Exercícios resolvidos publicados: compressão com kc pela NBR 7190-1:2022 (TCCs da UEPG e da UFPB, monografia da UNESP, apostila da UFAL), S2 e pressão dinâmica pela NBR 6123 (TCC da UTFPR) e γz (e-book de W. Zumaeta/TQS).',
       casos)
