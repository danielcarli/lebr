# Gera validacao/casos/28-bibliografia-fundacoes.json — exercícios resolvidos de fundações publicados online.
import math
from comum import item, caso, gravar

BASTOS = dict(fonte='BASTOS, P. S. S. Blocos de fundação (notas de aula, 2133 – Estruturas de Concreto III). UNESP – Faculdade de Engenharia de Bauru, outubro de 2023. NBR 6118:2023 e NBR 6122:2022; método das bielas (Blévot).',
              url='https://wwwp.feb.unesp.br/pbastos/concreto3/Blocos.pdf')
UFC = dict(fonte='ALMEIDA, M. M. R. Método das bielas e método das bielas e tirantes aplicados no dimensionamento de blocos de concreto armado (TCC, orient. M. M. C. Mota). Universidade Federal do Ceará, 2013.',
           url='https://repositorio.ufc.br/ri/bitstream/riufc/36409/1/2013_tcc_mmdralmeida.pdf')
ALONSO = dict(fonte='ALONSO, U. R. Exercícios de fundações. 3ª ed. São Paulo: Blucher, 2019 (amostra publicada pela editora).',
              url='https://storage.blucher.com.br/book/pdf_preview/9788521213840-amostra.pdf')
SFEIR = dict(fonte='SFEIR, A. L. F. Análise comparativa técnico e econômica de fundações superficiais e profundas de uma obra pública na cidade de Guarapuava (TCC). UTFPR – Guarapuava, 2021.',
             url='https://riut.utfpr.edu.br/jspui/bitstream/1/26937/1/analisefundacoessuperficiaisprofundas.pdf')
UFPR = dict(fonte='SANTOS, C. T.; DELL\'AVANZI, E.; SESTREM, L. P.; FARO, V. P. et al. Geotecnia de Fundações (TC 041) – Exercícios de capacidade de carga (aula 8). UFPR – Departamento de Construção Civil, 2019.',
            url='https://gegeo.ufpr.br/wp-content/uploads/2024/09/aula8.pdf')

NOTA_KR = ('A tensão-limite nas bielas não é conferida: a fonte usa KR = {kr} (σlim = {f}·{kr}·fcd) e o LEBR usa KR = 0,9. '
           'O ângulo, as tensões nas bielas e as forças nos tirantes não dependem de KR.')

casos = []


def arranjo(n, e):
    r3 = math.sqrt(3)
    if n == 2:
        return [{'x': -e / 2, 'y': 0}, {'x': e / 2, 'y': 0}]
    if n == 3:
        return [{'x': 0, 'y': e * r3 / 3}, {'x': -e / 2, 'y': -e * r3 / 6}, {'x': e / 2, 'y': -e * r3 / 6}]
    return [{'x': -e / 2, 'y': -e / 2}, {'x': e / 2, 'y': -e / 2}, {'x': -e / 2, 'y': e / 2}, {'x': e / 2, 'y': e / 2}]


def bloco(id, titulo, ref, local, descricao, n, e, ap, bp, d, D, Nd, fck, esperado, nota):
    pos = [{k: round(v, 6) for k, v in p.items()} for p in arranjo(n, e)]
    args = [{'n': n, 'e': e, 'ap': ap, 'bp': bp, 'd': d, 'D': D, 'Nd': Nd, 'R': [round(Nd / n, 6)] * n, 'pos': pos, 'fcd': round(fck / 1.4, 6)}]
    casos.append(caso(id, titulo, ref, local, descricao, 'bloco.bielasETirantes', args, esperado, nota))


def intervalo(id, titulo, ref, local, descricao, n, e, ap, bp, dmin, dmax, tol=0.005, nota=None):
    args = [{'n': n, 'e': e, 'ap': ap, 'bp': bp, 'pos': [{k: round(v, 6) for k, v in p.items()} for p in arranjo(n, e)]}]
    casos.append(caso(id, titulo, ref, local, descricao, 'bloco.intervaloAlturaUtil', args,
                      [item('d mínimo', 'min', dmin, 'cm', tol), item('d máximo', 'max', dmax, 'cm', tol)], nota))


# ------------------------------------------------------------------------------------------------ blocos — Bastos
bloco('bastos-bloco2-ex14-1', 'Bloco sobre 2 estacas ø 30, pilar 20×30, Nd = 920,4 kN (Blévot)', BASTOS, 'Exemplo 14.1, p. 36–40',
      'Bloco sobre duas estacas pré-moldadas ø 30 cm (e = 80 cm) sob pilar 20×30 cm, C25, CA-50. Com o peso próprio (1,02) e os momentos, a fonte adota Nk = 657,4 kN e Nd = 920,4 kN; d = 45 cm. Calcular o ângulo das bielas, as tensões nas bielas junto ao pilar e à estaca e a força no tirante.',
      2, 80, 30, 20, 45, 30, 920.4, 25,
      [item('Ângulo das bielas α (tg α = 1,3846)', 'alfa', 54.16, '°', 0.002),
       item('σcd na biela junto ao pilar', 'sigmaPil', 23.3, 'MPa', 0.005),
       item('σcd na biela junto à estaca', 'sigmaEst', 9.9, 'MPa', 0.01),
       item('Força no tirante Rs = Nd(2e − ap)/(8d), sem o acréscimo de 15 %', 'Tx', 332.37, 'kN', 0.002)],
      'A fonte multiplica a força no tirante por 1,15 (Rs ≈ 382 kN). O motor devolve Rs = Nd·(2e − ap)/(8d) = 332,4 kN e o módulo do bloco aplica os 15 % na armadura; compara-se a força sem o acréscimo (382,2/1,15). '
      + NOTA_KR.format(kr='0,95', f='1,4'))
intervalo('bastos-bloco2-ex14-1-d', 'Bloco sobre 2 estacas (e = 80, ap = 30): intervalo de d', BASTOS, 'Exemplo 14.1, p. 36',
          'dmín = 0,5·(e − ap/2) e dmáx = 0,71·(e − ap/2), para 45° ≤ α ≤ 55°.', 2, 80, 30, 20, 32.5, 46.2)

bloco('bastos-bloco3-ex14-2-est', 'Bloco sobre 3 tubulões ø 70, pilar 65×65, Nd = 7350 kN — biela na estaca e tirante', BASTOS, 'Exemplo 14.2, p. 41–48',
      'Bloco sobre três fustes de tubulão ø 70 cm (e = 250 cm) sob pilar 65×65 cm, C25, CA-50, d = 148 cm, Nk = 5000 kN e Nd = 1,05·1,4·5000 = 7350 kN (com o peso próprio). Ângulo das bielas, tensão na biela junto à estaca e armadura sobre os lados (As,lado = 27,43 cm², isto é, Rs,lado = 27,43·43,48 kN).',
      3, 250, 65, 65, 148, 70, 7350, 25,
      [item('Ângulo das bielas α (tg α = 1,1855)', 'alfa', 49.9, '°', 0.002),
       item('σcd na biela junto à estaca', 'sigmaEst', 10.9, 'MPa', 0.005),
       item('Força no tirante de cada lado (As,lado·fyd)', 'tirantes.lado', 1192.7, 'kN', 0.003)],
      NOTA_KR.format(kr='0,95', f='1,75'))
bloco('bastos-bloco3-ex14-2-pil', 'Bloco sobre 3 tubulões, pilar 65×65 — biela junto ao pilar (Nd = 7000 kN)', BASTOS, 'Exemplo 14.2, p. 41–48',
      'Mesmo bloco. Na verificação da biela junto ao pilar a fonte usa Nd = 1,4·5000 = 7000 kN, sem o peso próprio do bloco.',
      3, 250, 65, 65, 148, 70, 7000, 25,
      [item('σcd na biela junto ao pilar', 'sigmaPil', 28.3, 'MPa', 0.005)],
      'A fonte usa Nd diferentes em cada verificação (7000 kN no pilar, 7350 kN na estaca e no tirante); os casos seguem a fonte. ' + NOTA_KR.format(kr='0,95', f='1,75'))
intervalo('bastos-bloco3-ex14-2-d', 'Bloco sobre 3 tubulões (e = 250, ap = 65): intervalo de d', BASTOS, 'Exemplo 14.2, p. 41',
          'dmín = 0,58·(e − ap/2) e dmáx = 0,825·(e − ap/2).', 3, 250, 65, 65, 126.2, 179.4)

bloco('bastos-bloco4-ex14-3-est', 'Bloco sobre 4 estacas ø 30, pilar 20×75, Nd = 1888,5 kN — biela na estaca e tirante', BASTOS, 'Exemplo 14.3, p. 49–53',
      'Bloco sobre quatro estacas pré-moldadas ø 30 cm (e = 80 cm) sob pilar alongado 20×75 cm (ap,eq = √(20·75) = 38,73 cm), C20, CA-50, d = 54 cm, Nd = 1888,5 kN com o peso próprio. Ângulo das bielas, tensão na biela junto à estaca e armadura sobre os lados (As,lado = 6,10 cm²).',
      4, 80, 20, 75, 54, 30, 1888.5, 20,
      [item('Ângulo das bielas α (tg α = 1,259)', 'alfa', 51.55, '°', 0.002),
       item('σcd na biela junto à estaca', 'sigmaEst', 10.9, 'MPa', 0.005),
       item('Força no tirante de cada lado Nd(2e − a)/(16d)', 'tirantes.lado', 265.2, 'kN', 0.005)],
      'As,lado = 6,10 cm² corresponde a Rs = 6,10·43,48 = 265,2 kN. ' + NOTA_KR.format(kr='0,95', f='2,1'))
bloco('bastos-bloco4-ex14-3-pil', 'Bloco sobre 4 estacas, pilar 20×75 — biela junto ao pilar (Nd = 1824,2 kN)', BASTOS, 'Exemplo 14.3, p. 49–53',
      'Mesmo bloco. Na biela junto ao pilar a fonte usa Nd = 1,4·1303 = 1824,2 kN, sem o peso próprio.',
      4, 80, 20, 75, 54, 30, 1824.2, 20,
      [item('σcd na biela junto ao pilar', 'sigmaPil', 19.8, 'MPa', 0.005)],
      NOTA_KR.format(kr='0,95', f='2,1'))
intervalo('bastos-bloco4-ex14-3-d', 'Bloco sobre 4 estacas (e = 80, pilar 20×75): intervalo de d', BASTOS, 'Exemplo 14.3, p. 49',
          'Com ap,eq = √(20·75) = 38,73 cm: dmín = 0,71·(e − ap/2) e dmáx = e − ap/2.', 4, 80, 20, 75, 43.1, 60.6)

# ------------------------------------------------------------------------------------------------ blocos — UFC
bloco('ufc-bloco2', 'Bloco sobre 2 estacas ø 30, pilar 30×30, Nd = 980 kN', UFC, 'Seção 3.2.1',
      'Bloco sobre duas estacas ø 30 cm (e = 90 cm) sob pilar 30×30 cm com carga centrada N = 700 kN (Nd = 980 kN), C25, CA-50, h = 50 cm, d = 45 cm.',
      2, 90, 30, 30, 45, 30, 980, 25,
      [item('Ângulo das bielas θ', 'alfa', 50.19, '°', 0.002),
       item('Força no tirante (sem o acréscimo de 15 %)', 'Tx', 408.33, 'kN', 0.002),
       item('σcd na biela junto ao pilar', 'sigmaPil', 18.5, 'MPa', 0.005),
       item('σcd na biela junto à estaca', 'sigmaEst', 11.7, 'MPa', 0.005)],
      'A fonte também apresenta Rst com o acréscimo de 15 % (469,58 kN), que no LEBR entra na armadura, no módulo do bloco. ' + NOTA_KR.format(kr='0,85', f='1,4'))
bloco('ufc-bloco3', 'Bloco sobre 3 estacas ø 30, pilar 30×30, Nd = 1400 kN', UFC, 'Seção 3.2.2',
      'Bloco sobre três estacas ø 30 cm (e = 90 cm) sob pilar 30×30 cm, N = 1000 kN (Nd = 1400 kN), C25, CA-50, h = 60 cm, d = 55 cm. Rst = Nd(e√3 − 0,9ap)/(9d) nas medianas e Rst/√3 nos lados.',
      3, 90, 30, 30, 55, 30, 1400, 25,
      [item('Ângulo das bielas θ', 'alfa', 52.01, '°', 0.002),
       item('Força no tirante das medianas', 'tirantes.mediana', 364.52, 'kN', 0.002),
       item('Força no tirante dos lados', 'tirantes.lado', 210.46, 'kN', 0.002),
       item('σcd na biela junto ao pilar', 'sigmaPil', 25.0, 'MPa', 0.005),
       item('σcd na biela junto à estaca', 'sigmaEst', 10.6, 'MPa', 0.005)],
      NOTA_KR.format(kr='0,85', f='1,75'))
bloco('ufc-bloco4', 'Bloco sobre 4 estacas ø 30, pilar 30×30, Nd = 1820 kN', UFC, 'Seção 3.2.3',
      'Bloco sobre quatro estacas ø 30 cm (e = 90 cm) sob pilar 30×30 cm, N = 1300 kN (Nd = 1820 kN), C25, CA-50, h = 80 cm, d = 75 cm.',
      4, 90, 30, 30, 75, 30, 1820, 25,
      [item('Ângulo das bielas θ', 'alfa', 54.74, '°', 0.002),
       item('Força no tirante de cada lado', 'tirantes.lado', 227.5, 'kN', 0.002),
       item('σcd na biela junto ao pilar', 'sigmaPil', 30.3, 'MPa', 0.005),
       item('σcd na biela junto à estaca', 'sigmaEst', 9.7, 'MPa', 0.005)],
      'A fonte também dimensiona as diagonais (321,73 kN) e a malha (455,0 kN), arranjos que o LEBR não oferece. ' + NOTA_KR.format(kr='0,85', f='2,1'))
NOTA_D_UFC = 'A fonte usa coeficientes com mais casas ({c}); o LEBR usa os arredondados da literatura ({l}). Tolerância de 1,5 %.'
intervalo('ufc-bloco2-d', 'Bloco sobre 2 estacas (e = 90, ap = 30): intervalo de d', UFC, 'Seção 3.2.1', 'dmín = 0,50(e − ap/2), dmáx = 0,714(e − ap/2).',
          2, 90, 30, 30, 37.50, 53.55, 0.015, NOTA_D_UFC.format(c='0,714', l='0,71'))
intervalo('ufc-bloco3-d', 'Bloco sobre 3 estacas (e = 90, ap = 30): intervalo de d', UFC, 'Seção 3.2.2', 'dmín = 0,577(e − 0,52ap), dmáx = 0,825(e − 0,52ap).',
          3, 90, 30, 30, 42.93, 61.38, 0.015, NOTA_D_UFC.format(c='0,577 e a − 0,52ap', l='0,58 e e − ap/2'))
intervalo('ufc-bloco4-d', 'Bloco sobre 4 estacas (e = 90, ap = 30): intervalo de d', UFC, 'Seção 3.2.3', 'dmín = 0,707(e − ap/2), dmáx = e − ap/2.',
          4, 90, 30, 30, 53.02, 75.0, 0.015, NOTA_D_UFC.format(c='0,707', l='0,71'))

# ------------------------------------------------------------------------------------------------ reações nas estacas
pos6 = [{'x': x, 'y': y} for x in (-95, 0, 95) for y in (-15, 15)]
casos.append(caso('bastos-reacoes-6-estacas', 'Reações em bloco de 6 estacas sob N = 1300 kN e momento de 100 kN·m', BASTOS, 'Seção 13, exemplo numérico (Figura 40)',
                  'Bloco de 6 estacas Strauss em duas linhas, com xi = −95, 0 e +95 cm, sob N = 1300 kN (majorado em 10 % pelo peso próprio: 1430 kN) e momento de 100 kN·m em torno do eixo paralelo às linhas. Ni = N/n ± M·xi/Σxi².',
                  'bloco.reacoesEstacas', [{'N': 1430, 'Mx': 100, 'pos': pos6}],
                  [item('Estaca menos carregada (x = −95)', '0', 211.7, 'kN', 0.003), item('Estaca central (x = 0)', '2', 238.0, 'kN', 0.003),
                   item('Estaca mais carregada (x = +95)', '4', 264.3, 'kN', 0.003)],
                  'A fonte chama de My o momento que, no LEBR, é o Mx (o que multiplica as coordenadas x). O espaçamento entre as duas linhas (30 cm) não interfere. A fonte arredonda N/n para 238 kN.'))

# ------------------------------------------------------------------------------------------------ sapatas
casos.append(caso('alonso-sapata-quadrada', 'Sapata para pilar 30×30, P = 1500 kN, σs = 0,3 MPa', ALONSO, 'Cap. 1, 2º exercício, p. 16',
                  'Dimensionar em planta a sapata de um pilar quadrado 30×30 cm com carga de 1500 kN em solo com σs = 0,3 MPa, sem peso próprio: área de 5 m².',
                  'sapata.dimensoesBalancosIguais', [{'area': 5, 'ap': 30, 'bp': 30}],
                  [item('Lado A', 'A', 225, 'cm', 0.0001), item('Lado B', 'B', 225, 'cm', 0.0001)]))
casos.append(caso('alonso-sapata-retangular', 'Sapata com balanços iguais para pilar 30×100, P = 3000 kN', ALONSO, 'Cap. 1, 3º exercício, p. 16',
                  'Pilar 30×100 cm, carga de 3000 kN, σs = 0,3 MPa (área de 10 m²), balanços iguais: a − b = 70 cm, b(b + 70) = 100 000 cm².',
                  'sapata.dimensoesBalancosIguais', [{'area': 10, 'ap': 100, 'bp': 30}],
                  [item('Lado maior a', 'A', 355, 'cm', 0.0001), item('Lado menor b', 'B', 285, 'cm', 0.0001)]))
casos.append(caso('alonso-sapata-momento-t2', 'Sapata 4,00 × 1,00 m com N = 1200 kN e M = 200 kN·m', ALONSO, 'Cap. 1, 18º exercício, p. 37–38',
                  'Pilar 20×150 cm com N = 1200 kN e M = ±200 kN·m, σs = 300 kPa. Segunda tentativa, aceita: sapata 4,00 × 1,00 m, e = M/N = 0,167 m < a/6; σ = (N/A)(1 ± 6e/a).',
                  'sapata.tensoesNaBase', [{'N': 1200, 'A': 400, 'B': 100, 'Mx': 200}],
                  [item('σmáx', 'sMax', 377, 'kPa', 0.01), item('σmín', 'sMin', 224, 'kPa', 0.01)],
                  'A fonte arredonda a excentricidade para 0,17 m (≈ 377 e 224 kPa); com e = 0,1667 m o resultado exato é 375 e 225 kPa.'))
casos.append(caso('alonso-sapata-momento-t1', 'Sapata 3,50 × 1,00 m com N = 1200 kN e M = 200 kN·m (rejeitada)', ALONSO, 'Cap. 1, 18º exercício, p. 37',
                  'Primeira tentativa do mesmo exercício: σmáx ≈ 443 kPa > 1,3·σs = 390 kPa, rejeitada.',
                  'sapata.tensoesNaBase', [{'N': 1200, 'A': 350, 'B': 100, 'Mx': 200}],
                  [item('σmáx', 'sMax', 443, 'kPa', 0.01)], 'Excentricidade arredondada para 0,17 m na fonte (exato: 440,8 kPa).'))
for furo, N, sig in [('9', 9.67, 0.19), ('10', 5.67, 0.11), ('11', 6.00, 0.12)]:
    casos.append(caso(f'sfeir-spt-furo{furo}', f'Tensão admissível pelo SPT (N/50) — furo {furo}, N médio = {str(N).replace(".", ",")}', SFEIR, '§4.1.2.2, Eq. 5, Tabelas 5–7',
                      f'σs = N/50 (MPa) com o NSPT médio do furo {furo} (N = {str(N).replace(".", ",")}).',
                      'sapata.tensaoAdmissivelSPT', [N], [item('σadm', 'sigma', sig * 1000, 'kPa', 0.0, toleranciaAbs=5)],
                      'A fonte publica σ em MPa com duas casas: tolerância de ±5 kPa (meia unidade da última casa).'))

# ------------------------------------------------------------------------------------------------ estacas (Décourt-Quaresma, ponta)
spt = [6, 4, 2, 4, 2, 3, 4, 5, 10, 15, 25, 20, 22, 25, 23, 29, 30, 30]
sondagem = {'id': 'f1', 'modulo': 'geotecnia.sondagem', 'codigo': 'SP1', 'nome': 'SP1', 'local': {'x': 0, 'y': 0}, 'cotaBoca': 0.0, 'limite': 18.45,
            'nivelAgua': {'inicial': None, 'final': None, 'seco': True}, 'paralisacao': 'projeto',
            'camadas': [{'ate': 18.45, 'solo': 'silte', 'secundario': 'arenoso'}],
            'spt': [{'prof': i + 1, 'n': n, 'pen': 30 if i < 17 else 11} for i, n in enumerate(spt)]}
for id, tipo, nome, alfa, Rp in [('ufpr-dq-cravada', 'premoldada', 'cravada', 1.0, 455.6), ('ufpr-dq-helice', 'helice', 'hélice contínua', 0.3, 136.7)]:
    casos.append({'id': id, 'titulo': f'Décourt-Quaresma: estaca {nome} ø 30, L = 15 m, ponta em silte arenoso — resistência de ponta',
                  'fonte': f"{UFPR['fonte']} Exercício Décourt-Quaresma (1978){' — variante hélice contínua' if tipo == 'helice' else ''}.", 'url': UFPR['url'],
                  'descricao': f'Estaca {nome} ø 30 cm, L = 15 m, SPT de metro em metro: 6, 4, 2, 4, 2, 3, 4, 5, 10, 15, 25, 20, 22, 25, 23, 29, 30, 30/11. Ponta em silte arenoso (C = 250 kPa), α = {str(alfa).replace(".", ",")}. Np = média dos N a 14, 15 e 16 m = 25,67; Rp = α·C·Np·Ap.',
                  'nota': 'Só a resistência de ponta é conferida. No atrito lateral a fonte usa a média dos N de 1 a 15 m sem o limite N ≥ 3 e sem excluir os ensaios usados na ponta (NL = 11,33), e o LEBR aplica os dois critérios do método; o Rl não é comparável. A sondagem do caso tem uma só camada (silte arenoso): as faixas de solo do fuste não estão legíveis na fonte e não alteram Rp. A fonte usa Ap = 0,071 m² (exato: 0,0707).',
                  'alvo': 'elemento', 'modulo': 'geotecnia.estaca', 'outros': [sondagem],
                  'elemento': {'tipo': tipo, 'secao': 'circular', 'D': 30, 'L': 15, 'topo': 0.0, 'local': {'x': 0, 'y': 0}, 'pilarId': None, 'sondagemId': None,
                               'limitarPonta': None, 'cargaTrabalho': None, 'estrutural': {'fck': None, 'gc': None, 'catalogo': None}},
                  'esperado': [item('Np (média dos N junto à ponta)', 'dq.Np', 25.67, '', 0.002), item('C (silte arenoso)', 'dq.C', 250, 'kPa', 0.0001),
                               item('α (ponta)', 'dq.alfa', alfa, '', 0.0001), item('Rp', 'dq.Rp', Rp, 'kN', 0.01)]})

gravar('28-bibliografia-fundacoes.json', 'Bibliografia — fundações',
       'Exercícios resolvidos publicados (apostila de blocos de P. S. S. Bastos/UNESP, TCC da UFC, livro de U. R. Alonso, TCC da UTFPR, aula de exercícios da UFPR): blocos pelo método das bielas, reações em estacas, sapatas e capacidade de carga de estacas.',
       casos)
