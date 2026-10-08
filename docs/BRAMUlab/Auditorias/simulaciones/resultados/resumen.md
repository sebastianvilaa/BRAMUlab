# Resumen automático de resultados (generado por 05-resumen.mjs)

Réplicas por celda: 30 (semillas fijas 1000+, 5000+, 7000+, 9000+). Entre paréntesis: desvío entre réplicas.

## Validación

Anexo B (cifras del documento vs. simulador):

| Caso | P(A) simulada | Δ ganadora | Δ perdedora |
|---|---|---|---|
| 5,0 vs 5,0 (6-4 6-4)  doc: P=50% +0,08 | 0.50 | 0.079 | -0.079 |
| 5,0 vence a 6,0       doc: P=23% +0,12 | 0.23 | 0.121 | -0.121 |
| 6,0 vence a 5,0       doc: P=77% +0,04 | 0.77 | 0.036 | -0.036 |
| 4,5 vence a 6,5       doc: P=8%  +0,14 | 0.08 | 0.144 | -0.144 |

Curva del cuestionario (percepción exacta, sin ruido → Nivel inicial real):

| Percibido | Nivel inicial |
|---|---|
| 1.5 | 1.56 |
| 2 | 1.91 |
| 2.5 | 2.39 |
| 3 | 3.13 |
| 3.5 | 3.53 |
| 4 | 4.01 |
| 4.5 | 4.52 |
| 5 | 4.92 |
| 5.5 | 5.59 |
| 6 | 5.85 |
| 6.5 | 6.21 |
| 7 | 7.04 |
| 7.5 | 7.52 |
| 8 | 8 |
| 8.5 | 8 |
| 9 | 8.48 |

Sonda de círculo cerrado:

| Caso | Evaluaciones con factor círculo <1 | Evaluaciones |
|---|---|---|
| grupo12_40partidos_real | 0 | 480 |
| grupo12_40partidos_diccionarioCompleto | 32 | 480 |
| grupo8_40partidos_real | 0 | 320 |
| grupo8_40partidos_diccionarioCompleto | 60 | 320 |
| grupo24_40partidos_diccionarioCompleto | 0 | 960 |
| mismoCuarteto40partidos_real | 80 | 160 |
| mismoCuarteto40partidos_diccionarioCompleto | 120 | 160 |

## A — Mismo nivel real, cuestionarios distintos (2 grupos de 16, orquestador REAL)

**real, sesgo del grupo 2 = +0.5**

| Partidos/jugador | Brecha de Nivel medio G2−G1 | Brecha real (θ) | Distorsión de la brecha | Sesgo G1 | Sesgo G2 | Error orden G1 (rmse) | Spearman G1 | % calibrados |
|---|---|---|---|---|---|---|---|---|
| 0 | 0.35 (±0.33) | -0.05 (±0.31) | 0.40 (±0.21) | -0.04 | 0.36 | 0.56 | 0.78 | 0% |
| 5 | 0.35 (±0.33) | -0.05 (±0.31) | 0.40 (±0.21) | -0.04 | 0.36 | 0.57 | 0.80 | 100% |
| 10 | 0.35 (±0.33) | -0.05 (±0.31) | 0.40 (±0.22) | -0.04 | 0.36 | 0.56 | 0.81 | 100% |
| 20 | 0.35 (±0.33) | -0.05 (±0.31) | 0.40 (±0.22) | -0.04 | 0.36 | 0.51 | 0.84 | 100% |
| 30 | 0.36 (±0.33) | -0.05 (±0.31) | 0.40 (±0.22) | -0.04 | 0.36 | 0.46 | 0.86 | 100% |
| 50 | 0.35 (±0.33) | -0.05 (±0.31) | 0.40 (±0.22) | -0.04 | 0.36 | 0.40 | 0.89 | 100% |

**real, sesgo del grupo 2 = +1**

| Partidos/jugador | Brecha de Nivel medio G2−G1 | Brecha real (θ) | Distorsión de la brecha | Sesgo G1 | Sesgo G2 | Error orden G1 (rmse) | Spearman G1 | % calibrados |
|---|---|---|---|---|---|---|---|---|
| 0 | 0.81 (±0.33) | -0.05 (±0.31) | 0.85 (±0.21) | -0.04 | 0.81 | 0.56 | 0.78 | 0% |
| 5 | 0.81 (±0.33) | -0.05 (±0.31) | 0.85 (±0.21) | -0.04 | 0.81 | 0.57 | 0.80 | 100% |
| 10 | 0.81 (±0.33) | -0.05 (±0.31) | 0.86 (±0.21) | -0.04 | 0.81 | 0.56 | 0.81 | 100% |
| 20 | 0.81 (±0.33) | -0.05 (±0.31) | 0.86 (±0.21) | -0.04 | 0.81 | 0.51 | 0.84 | 100% |
| 30 | 0.81 (±0.33) | -0.05 (±0.31) | 0.86 (±0.21) | -0.04 | 0.81 | 0.46 | 0.86 | 100% |
| 50 | 0.81 (±0.33) | -0.05 (±0.31) | 0.86 (±0.21) | -0.04 | 0.81 | 0.40 | 0.89 | 100% |

**real, sesgo del grupo 2 = +1.5**

| Partidos/jugador | Brecha de Nivel medio G2−G1 | Brecha real (θ) | Distorsión de la brecha | Sesgo G1 | Sesgo G2 | Error orden G1 (rmse) | Spearman G1 | % calibrados |
|---|---|---|---|---|---|---|---|---|
| 0 | 1.24 (±0.35) | -0.05 (±0.31) | 1.29 (±0.21) | -0.04 | 1.25 | 0.56 | 0.78 | 0% |
| 5 | 1.24 (±0.35) | -0.05 (±0.31) | 1.29 (±0.21) | -0.04 | 1.25 | 0.57 | 0.80 | 100% |
| 10 | 1.24 (±0.35) | -0.05 (±0.31) | 1.29 (±0.21) | -0.04 | 1.25 | 0.56 | 0.81 | 100% |
| 20 | 1.24 (±0.35) | -0.05 (±0.31) | 1.29 (±0.21) | -0.04 | 1.25 | 0.51 | 0.84 | 100% |
| 30 | 1.25 (±0.35) | -0.05 (±0.31) | 1.29 (±0.21) | -0.04 | 1.25 | 0.46 | 0.86 | 100% |
| 50 | 1.24 (±0.35) | -0.05 (±0.31) | 1.29 (±0.21) | -0.04 | 1.25 | 0.40 | 0.89 | 100% |

**fullDict, sesgo del grupo 2 = +0.5**

| Partidos/jugador | Brecha de Nivel medio G2−G1 | Brecha real (θ) | Distorsión de la brecha | Sesgo G1 | Sesgo G2 | Error orden G1 (rmse) | Spearman G1 | % calibrados |
|---|---|---|---|---|---|---|---|---|
| 0 | 0.35 (±0.33) | -0.05 (±0.31) | 0.40 (±0.21) | -0.04 | 0.36 | 0.56 | 0.78 | 0% |
| 5 | 0.35 (±0.33) | -0.05 (±0.31) | 0.40 (±0.21) | -0.04 | 0.36 | 0.57 | 0.80 | 100% |
| 10 | 0.35 (±0.33) | -0.05 (±0.31) | 0.40 (±0.22) | -0.04 | 0.36 | 0.56 | 0.81 | 100% |
| 20 | 0.35 (±0.33) | -0.05 (±0.31) | 0.40 (±0.22) | -0.04 | 0.36 | 0.51 | 0.84 | 100% |
| 30 | 0.36 (±0.33) | -0.05 (±0.31) | 0.40 (±0.22) | -0.04 | 0.36 | 0.46 | 0.86 | 100% |
| 50 | 0.35 (±0.33) | -0.05 (±0.31) | 0.40 (±0.22) | -0.04 | 0.36 | 0.40 | 0.89 | 100% |

**fullDict, sesgo del grupo 2 = +1**

| Partidos/jugador | Brecha de Nivel medio G2−G1 | Brecha real (θ) | Distorsión de la brecha | Sesgo G1 | Sesgo G2 | Error orden G1 (rmse) | Spearman G1 | % calibrados |
|---|---|---|---|---|---|---|---|---|
| 0 | 0.81 (±0.33) | -0.05 (±0.31) | 0.85 (±0.21) | -0.04 | 0.81 | 0.56 | 0.78 | 0% |
| 5 | 0.81 (±0.33) | -0.05 (±0.31) | 0.85 (±0.21) | -0.04 | 0.81 | 0.57 | 0.80 | 100% |
| 10 | 0.81 (±0.33) | -0.05 (±0.31) | 0.86 (±0.21) | -0.04 | 0.81 | 0.56 | 0.81 | 100% |
| 20 | 0.81 (±0.33) | -0.05 (±0.31) | 0.86 (±0.21) | -0.04 | 0.81 | 0.51 | 0.84 | 100% |
| 30 | 0.81 (±0.33) | -0.05 (±0.31) | 0.86 (±0.21) | -0.04 | 0.81 | 0.46 | 0.86 | 100% |
| 50 | 0.81 (±0.33) | -0.05 (±0.31) | 0.86 (±0.21) | -0.04 | 0.81 | 0.40 | 0.89 | 100% |

**fullDict, sesgo del grupo 2 = +1.5**

| Partidos/jugador | Brecha de Nivel medio G2−G1 | Brecha real (θ) | Distorsión de la brecha | Sesgo G1 | Sesgo G2 | Error orden G1 (rmse) | Spearman G1 | % calibrados |
|---|---|---|---|---|---|---|---|---|
| 0 | 1.24 (±0.35) | -0.05 (±0.31) | 1.29 (±0.21) | -0.04 | 1.25 | 0.56 | 0.78 | 0% |
| 5 | 1.24 (±0.35) | -0.05 (±0.31) | 1.29 (±0.21) | -0.04 | 1.25 | 0.57 | 0.80 | 100% |
| 10 | 1.24 (±0.35) | -0.05 (±0.31) | 1.29 (±0.21) | -0.04 | 1.25 | 0.56 | 0.81 | 100% |
| 20 | 1.24 (±0.35) | -0.05 (±0.31) | 1.29 (±0.21) | -0.04 | 1.25 | 0.51 | 0.84 | 100% |
| 30 | 1.25 (±0.35) | -0.05 (±0.31) | 1.29 (±0.21) | -0.04 | 1.25 | 0.46 | 0.86 | 100% |
| 50 | 1.24 (±0.35) | -0.05 (±0.31) | 1.29 (±0.21) | -0.04 | 1.25 | 0.40 | 0.89 | 100% |

**sin detección de círculo (variante en memoria), β=+1,0**

| Partidos/jugador | Brecha de Nivel medio | Distorsión |
|---|---|---|
| 0 | 0.81 | 0.85 |
| 5 | 0.81 | 0.85 |
| 10 | 0.81 | 0.86 |
| 20 | 0.81 | 0.86 |
| 30 | 0.81 | 0.86 |
| 50 | 0.81 | 0.86 |

## B — Distinta capacidad real, cuestionarios que igualan niveles

**B gap 2.0**

| Partidos/jugador | Brecha real (θ2−θ1) | Brecha de Nivel (mu2−mu1) | P(jugador G1 > jugador G2): observada | verdadera | Spearman fusionado | Cuartil superior desde G1: observado | verdadero |
|---|---|---|---|---|---|---|---|
| 0 | 1.96 | -0.10 | 0.52 | 0.05 | 0.41 | 0.51 | 0.03 |
| 5 | 1.96 | -0.10 | 0.52 | 0.05 | 0.43 | 0.54 | 0.03 |
| 10 | 1.96 | -0.10 | 0.53 | 0.05 | 0.44 | 0.55 | 0.03 |
| 20 | 1.96 | -0.10 | 0.52 | 0.05 | 0.47 | 0.53 | 0.03 |
| 30 | 1.96 | -0.10 | 0.52 | 0.05 | 0.49 | 0.51 | 0.03 |
| 50 | 1.96 | -0.10 | 0.52 | 0.05 | 0.50 | 0.51 | 0.03 |

**B gap 1.0**

| Partidos/jugador | Brecha real (θ2−θ1) | Brecha de Nivel (mu2−mu1) | P(jugador G1 > jugador G2): observada | verdadera | Spearman fusionado | Cuartil superior desde G1: observado | verdadero |
|---|---|---|---|---|---|---|---|
| 0 | 0.96 | -0.10 | 0.52 | 0.20 | 0.60 | 0.51 | 0.15 |
| 5 | 0.96 | -0.10 | 0.52 | 0.20 | 0.63 | 0.54 | 0.15 |
| 10 | 0.96 | -0.10 | 0.53 | 0.20 | 0.64 | 0.55 | 0.15 |
| 20 | 0.96 | -0.10 | 0.52 | 0.20 | 0.68 | 0.53 | 0.15 |
| 30 | 0.96 | -0.10 | 0.52 | 0.20 | 0.70 | 0.51 | 0.15 |
| 50 | 0.96 | -0.10 | 0.52 | 0.20 | 0.71 | 0.51 | 0.15 |

**B control (sin sesgo, brecha real 2.0 declarada bien)**

| Partidos/jugador | Brecha real (θ2−θ1) | Brecha de Nivel (mu2−mu1) | P(jugador G1 > jugador G2): observada | verdadera | Spearman fusionado | Cuartil superior desde G1: observado | verdadero |
|---|---|---|---|---|---|---|---|
| 0 | 1.96 | 1.76 | 0.08 | 0.05 | 0.88 | 0.06 | 0.03 |
| 5 | 1.96 | 1.76 | 0.11 | 0.05 | 0.88 | 0.07 | 0.03 |
| 10 | 1.96 | 1.75 | 0.11 | 0.05 | 0.89 | 0.07 | 0.03 |
| 20 | 1.96 | 1.75 | 0.11 | 0.05 | 0.91 | 0.05 | 0.03 |
| 30 | 1.96 | 1.75 | 0.11 | 0.05 | 0.91 | 0.05 | 0.03 |
| 50 | 1.96 | 1.75 | 0.10 | 0.05 | 0.93 | 0.04 | 0.03 |

## C — Grupo cerrado único: tamaño del círculo

**Sesgo compartido del grupo = +1,0**

| Tamaño | sesgo @0 | sesgo @5 | sesgo @10 | sesgo @20 | sesgo @30 | sesgo @50 | rmse orden @0 | rmse @50 | Spearman @0 | Spearman @50 | % calibrados @5 | sd(mu)/sd(θ) @50 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5 | 0.83 | 0.83 | 0.83 | 0.83 | 0.83 | 0.83 | 0.52 | 0.42 | 0.62 | 0.79 | 94% | 1.22 |
| 8 | 0.89 | 0.89 | 0.89 | 0.89 | 0.89 | 0.89 | 0.55 | 0.39 | 0.73 | 0.84 | 100% | 1.19 |
| 12 | 0.87 | 0.87 | 0.87 | 0.87 | 0.87 | 0.87 | 0.56 | 0.38 | 0.74 | 0.87 | 100% | 1.20 |
| 16 | 0.86 | 0.86 | 0.86 | 0.86 | 0.86 | 0.86 | 0.57 | 0.40 | 0.76 | 0.90 | 100% | 1.19 |
| 24 | 0.85 | 0.85 | 0.85 | 0.85 | 0.85 | 0.85 | 0.60 | 0.40 | 0.75 | 0.90 | 100% | 1.18 |
| 48 | 0.81 | 0.81 | 0.81 | 0.81 | 0.81 | 0.81 | 0.60 | 0.42 | 0.77 | 0.91 | 100% | 1.20 |

**Sesgo compartido del grupo = 0 (control)**

| Tamaño | sesgo @0 | sesgo @5 | sesgo @10 | sesgo @20 | sesgo @30 | sesgo @50 | rmse orden @0 | rmse @50 | Spearman @0 | Spearman @50 | % calibrados @5 | sd(mu)/sd(θ) @50 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5 | -0.07 | -0.06 | -0.06 | -0.07 | -0.07 | -0.07 | 0.55 | 0.43 | 0.64 | 0.78 | 94% | 1.27 |
| 8 | -0.01 | -0.01 | -0.01 | -0.01 | -0.01 | -0.01 | 0.56 | 0.42 | 0.73 | 0.85 | 100% | 1.25 |
| 12 | -0.02 | -0.02 | -0.02 | -0.02 | -0.02 | -0.02 | 0.56 | 0.40 | 0.75 | 0.87 | 100% | 1.24 |
| 16 | -0.04 | -0.04 | -0.04 | -0.04 | -0.04 | -0.04 | 0.56 | 0.41 | 0.78 | 0.90 | 100% | 1.22 |
| 24 | -0.05 | -0.06 | -0.06 | -0.06 | -0.05 | -0.05 | 0.59 | 0.41 | 0.77 | 0.90 | 100% | 1.20 |
| 48 | -0.10 | -0.10 | -0.10 | -0.10 | -0.10 | -0.10 | 0.59 | 0.42 | 0.79 | 0.91 | 100% | 1.21 |

**Sensibilidad (sesgo +1,0; filas = variante)**

- C_n12_beta1.0: sesgo @0=0.87, @30=0.87, @50=0.87; rmse orden @50=0.38; sd(mu)/sd(θ)@50=1.20; % de evaluaciones con factor círculo<1 = 0.0%
- C_n12_beta1.0_rate2: sesgo @0=0.87, @30=0.87, @50=0.87; rmse orden @50=0.39; sd(mu)/sd(θ)@50=1.21; % de evaluaciones con factor círculo<1 = 0.0%
- C_n12_beta1.0_fullDict: sesgo @0=0.87, @30=0.87, @50=0.87; rmse orden @50=0.38; sd(mu)/sd(θ)@50=1.20; % de evaluaciones con factor círculo<1 = 0.0%
- C_n12_beta1.0_noCircle: sesgo @0=0.87, @30=0.87, @50=0.87; rmse orden @50=0.38; sd(mu)/sd(θ)@50=1.20; % de evaluaciones con factor círculo<1 = 0.0%
- C_n8_beta1.0: sesgo @0=0.89, @30=0.89, @50=0.89; rmse orden @50=0.39; sd(mu)/sd(θ)@50=1.19; % de evaluaciones con factor círculo<1 = 0.0%
- C_n8_beta1.0_fullDict: sesgo @0=0.89, @30=0.89, @50=0.89; rmse orden @50=0.39; sd(mu)/sd(θ)@50=1.19; % de evaluaciones con factor círculo<1 = 0.1%
- C_n16_beta1.0: sesgo @0=0.86, @30=0.86, @50=0.86; rmse orden @50=0.40; sd(mu)/sd(θ)@50=1.19; % de evaluaciones con factor círculo<1 = 0.0%
- C_n16_beta1.0_truthP0.7: sesgo @0=0.86, @30=0.86, @50=0.86; rmse orden @50=0.41; sd(mu)/sd(θ)@50=0.99; % de evaluaciones con factor círculo<1 = 0.0%
- C_n16_beta1.0_truthP0.92: sesgo @0=0.86, @30=0.86, @50=0.86; rmse orden @50=0.43; sd(mu)/sd(θ)@50=1.34; % de evaluaciones con factor círculo<1 = 0.0%

**Peso residual por repetición/compañero (factor medio sobre todas las evaluaciones, por tramo de partidos/jugador)**

| Tamaño | rep ≤5 | rep 6–10 | rep 11–20 | rep 21–30 | rep 31–50 | comp ≤5 | comp 6–10 | comp 11–20 | comp 21–30 | comp 31–50 |
|---|---|---|---|---|---|---|---|---|---|---|
| 5 | 0.88 | 0.62 | 0.47 | 0.45 | 0.45 | 0.97 | 0.91 | 0.82 | 0.71 | 0.70 |
| 8 | 0.93 | 0.81 | 0.64 | 0.50 | 0.48 | 0.98 | 0.95 | 0.89 | 0.83 | 0.82 |
| 12 | 0.96 | 0.89 | 0.78 | 0.66 | 0.64 | 0.99 | 0.97 | 0.93 | 0.89 | 0.89 |
| 16 | 0.97 | 0.92 | 0.84 | 0.75 | 0.74 | 0.99 | 0.98 | 0.95 | 0.92 | 0.91 |
| 24 | 0.98 | 0.95 | 0.90 | 0.84 | 0.83 | 1.00 | 0.99 | 0.97 | 0.95 | 0.94 |
| 48 | 0.99 | 0.97 | 0.95 | 0.92 | 0.92 | 1.00 | 0.99 | 0.98 | 0.97 | 0.97 |

## E — Desvíos individuales sin sesgo compartido, según tamaño del círculo

| Tamaño | rmse orden @0 | rmse orden @5 | rmse orden @10 | rmse orden @20 | rmse orden @30 | rmse orden @50 | Spearman @0 | Spearman @50 | Error abs. medio vs θ @0 | @50 |
|---|---|---|---|---|---|---|---|---|---|---|
| 6 | 0.86 | 0.84 | 0.81 | 0.73 | 0.70 | 0.64 | 0.60 | 0.80 | 0.77 | 0.61 |
| 12 | 0.95 | 0.91 | 0.85 | 0.76 | 0.70 | 0.62 | 0.65 | 0.83 | 0.80 | 0.55 |
| 24 | 1.00 | 0.97 | 0.92 | 0.82 | 0.75 | 0.63 | 0.62 | 0.84 | 0.81 | 0.53 |
| 48 | 1.03 | 1.00 | 0.93 | 0.84 | 0.75 | 0.62 | 0.62 | 0.85 | 0.84 | 0.51 |
| 96 | 1.01 | 0.98 | 0.92 | 0.82 | 0.75 | 0.61 | 0.66 | 0.87 | 0.81 | 0.50 |

## D — Grupos aislados que se conectan (brecha de sesgo G2−G1 tras 30 partidos internos; 0 = sin corrección aún)

| Conexión | +0 partidos | +10 partidos | +20 partidos | +30 partidos | +50 partidos | +100 partidos | +200 partidos | % de la brecha corregida a +100 | a +200 |
|---|---|---|---|---|---|---|---|---|---|
| sin conexión (control) | 0.88 | 0.88 | 0.88 | 0.88 | 0.88 | 0.89 | 0.89 | -1% | -1% |
| 1 puente(s) | 0.89 | 0.88 | 0.88 | 0.87 | 0.86 | 0.83 | 0.78 | 7% | 12% |
| 2 puente(s) | 0.89 | 0.88 | 0.87 | 0.86 | 0.84 | 0.79 | 0.69 | 12% | 22% |
| 4 puente(s) | 0.88 | 0.87 | 0.85 | 0.83 | 0.79 | 0.71 | 0.57 | 20% | 35% |
| 8 puente(s) | 0.86 | 0.84 | 0.81 | 0.79 | 0.75 | 0.64 | 0.42 | 25% | 51% |
| fracción mezclada 0.02 | 0.88 | 0.88 | 0.88 | 0.87 | 0.87 | 0.85 | 0.84 | 3% | 5% |
| fracción mezclada 0.05 | 0.88 | 0.88 | 0.87 | 0.87 | 0.86 | 0.83 | 0.79 | 6% | 11% |
| fracción mezclada 0.1 | 0.88 | 0.87 | 0.86 | 0.85 | 0.83 | 0.78 | 0.67 | 12% | 24% |
| fracción mezclada 0.25 | 0.88 | 0.86 | 0.83 | 0.80 | 0.75 | 0.64 | 0.46 | 27% | 48% |
| 2 puentes, diccionario completo | 0.89 | 0.88 | 0.87 | 0.86 | 0.84 | 0.79 | 0.69 | 12% | 22% |
| mezcla 10%, diccionario completo | 0.88 | 0.87 | 0.86 | 0.85 | 0.83 | 0.78 | 0.67 | 12% | 24% |
| mezcla 10%, sin círculo | 0.88 | 0.87 | 0.86 | 0.85 | 0.83 | 0.78 | 0.67 | 12% | 24% |

Sesgo propio de los jugadores puente (promedio):

| Variante | +0 | +10 | +20 | +30 | +50 | +100 | +200 |
|---|---|---|---|---|---|---|---|
| 1 puente(s) | 0.02 | 0.09 | 0.12 | 0.14 | 0.15 | 0.25 | 0.32 |
| 2 puente(s) | -0.02 | 0.06 | 0.09 | 0.12 | 0.20 | 0.23 | 0.33 |
| 4 puente(s) | -0.11 | -0.05 | 0.00 | 0.06 | 0.10 | 0.21 | 0.27 |
| 8 puente(s) | -0.12 | -0.08 | -0.03 | -0.00 | 0.04 | 0.15 | 0.24 |

Sesgo medio G1 (no puente) y G2 a +0 / +100 / +200:

| Variante | G1 +0 | G2 +0 | G1 +100 | G2 +100 | G1 +200 | G2 +200 |
|---|---|---|---|---|---|---|
| sin conexión (control) | -0.10 | 0.78 | -0.10 | 0.79 | -0.10 | 0.79 |
| 1 puente(s) | -0.11 | 0.78 | -0.08 | 0.75 | -0.06 | 0.72 |
| 2 puente(s) | -0.11 | 0.78 | -0.07 | 0.72 | -0.03 | 0.67 |
| 4 puente(s) | -0.09 | 0.78 | -0.04 | 0.66 | 0.03 | 0.59 |
| 8 puente(s) | -0.08 | 0.78 | -0.02 | 0.62 | 0.09 | 0.51 |
| fracción mezclada 0.02 | -0.10 | 0.78 | -0.09 | 0.77 | -0.08 | 0.76 |
| fracción mezclada 0.05 | -0.10 | 0.78 | -0.07 | 0.76 | -0.05 | 0.73 |
| fracción mezclada 0.1 | -0.10 | 0.78 | -0.04 | 0.73 | 0.01 | 0.68 |
| fracción mezclada 0.25 | -0.10 | 0.78 | 0.02 | 0.66 | 0.11 | 0.57 |
| 2 puentes, diccionario completo | -0.11 | 0.78 | -0.07 | 0.72 | -0.03 | 0.67 |
| mezcla 10%, diccionario completo | -0.10 | 0.78 | -0.04 | 0.73 | 0.01 | 0.68 |
| mezcla 10%, sin círculo | -0.10 | 0.78 | -0.04 | 0.73 | 0.01 | 0.68 |

## F — Ranking provincial/nacional con varias localidades

**provincia 6x24 σ=0 islas** (réplicas 30)

| Partidos/jugador | Ranking: Spearman con capacidad | Solapamiento top-K | Pares entre localidades mal ordenados (dif. real ≥1,0) | Desplazamiento medio de puesto | p90 | Peor puesto real dentro del top-K observado | Sesgo medio loc. más sobrevalorada | menos | % del top-K desde la localidad más sobrevalorada (esperable) | Spearman dentro de cada localidad |
|---|---|---|---|---|---|---|---|---|---|---|
| 10 | 0.86 | 0.60 | 0.03 | 16.8 | 37 | 35 | 0.04 | -0.25 | 16% (17%) | 0.84 |
| 30 | 0.90 | 0.68 | 0.01 | 14.2 | 32 | 28 | 0.04 | -0.25 | 15% (17%) | 0.88 |
| 50 | 0.92 | 0.70 | 0.01 | 12.6 | 28 | 26 | 0.04 | -0.25 | 15% (17%) | 0.91 |

**provincia 6x24 σ=0.3 islas** (réplicas 30)

| Partidos/jugador | Ranking: Spearman con capacidad | Solapamiento top-K | Pares entre localidades mal ordenados (dif. real ≥1,0) | Desplazamiento medio de puesto | p90 | Peor puesto real dentro del top-K observado | Sesgo medio loc. más sobrevalorada | menos | % del top-K desde la localidad más sobrevalorada (esperable) | Spearman dentro de cada localidad |
|---|---|---|---|---|---|---|---|---|---|---|
| 10 | 0.84 | 0.59 | 0.04 | 17.7 | 39 | 36 | 0.23 | -0.49 | 24% (17%) | 0.84 |
| 30 | 0.88 | 0.63 | 0.02 | 15.4 | 34 | 33 | 0.23 | -0.49 | 26% (17%) | 0.88 |
| 50 | 0.90 | 0.66 | 0.01 | 13.9 | 31 | 27 | 0.23 | -0.49 | 28% (17%) | 0.91 |

**provincia 6x24 σ=0.6 islas** (réplicas 30)

| Partidos/jugador | Ranking: Spearman con capacidad | Solapamiento top-K | Pares entre localidades mal ordenados (dif. real ≥1,0) | Desplazamiento medio de puesto | p90 | Peor puesto real dentro del top-K observado | Sesgo medio loc. más sobrevalorada | menos | % del top-K desde la localidad más sobrevalorada (esperable) | Spearman dentro de cada localidad |
|---|---|---|---|---|---|---|---|---|---|---|
| 10 | 0.79 | 0.53 | 0.06 | 20.4 | 45 | 43 | 0.51 | -0.86 | 35% (17%) | 0.84 |
| 30 | 0.83 | 0.57 | 0.05 | 18.4 | 41 | 39 | 0.51 | -0.86 | 37% (17%) | 0.88 |
| 50 | 0.85 | 0.59 | 0.04 | 17.3 | 38 | 32 | 0.51 | -0.86 | 38% (17%) | 0.90 |

**provincia 6x24 σ=1 islas** (réplicas 30)

| Partidos/jugador | Ranking: Spearman con capacidad | Solapamiento top-K | Pares entre localidades mal ordenados (dif. real ≥1,0) | Desplazamiento medio de puesto | p90 | Peor puesto real dentro del top-K observado | Sesgo medio loc. más sobrevalorada | menos | % del top-K desde la localidad más sobrevalorada (esperable) | Spearman dentro de cada localidad |
|---|---|---|---|---|---|---|---|---|---|---|
| 10 | 0.71 | 0.45 | 0.12 | 24.2 | 53 | 53 | 0.92 | -1.34 | 48% (17%) | 0.84 |
| 30 | 0.74 | 0.48 | 0.10 | 22.8 | 49 | 49 | 0.92 | -1.34 | 49% (17%) | 0.88 |
| 50 | 0.76 | 0.50 | 0.09 | 22.0 | 48 | 42 | 0.92 | -1.34 | 48% (17%) | 0.91 |

**provincia 6x24 σ=0.6 mezcla 0.02** (réplicas 30)

| Partidos/jugador | Ranking: Spearman con capacidad | Solapamiento top-K | Pares entre localidades mal ordenados (dif. real ≥1,0) | Desplazamiento medio de puesto | p90 | Peor puesto real dentro del top-K observado | Sesgo medio loc. más sobrevalorada | menos | % del top-K desde la localidad más sobrevalorada (esperable) | Spearman dentro de cada localidad |
|---|---|---|---|---|---|---|---|---|---|---|
| 10 | 0.80 | 0.53 | 0.06 | 20.2 | 45 | 46 | 0.51 | -0.86 | 38% (17%) | 0.84 |
| 30 | 0.83 | 0.57 | 0.04 | 18.2 | 40 | 35 | 0.50 | -0.86 | 37% (17%) | 0.88 |
| 50 | 0.85 | 0.60 | 0.04 | 17.0 | 38 | 33 | 0.50 | -0.85 | 38% (17%) | 0.91 |

**provincia 6x24 σ=0.6 mezcla 0.1** (réplicas 30)

| Partidos/jugador | Ranking: Spearman con capacidad | Solapamiento top-K | Pares entre localidades mal ordenados (dif. real ≥1,0) | Desplazamiento medio de puesto | p90 | Peor puesto real dentro del top-K observado | Sesgo medio loc. más sobrevalorada | menos | % del top-K desde la localidad más sobrevalorada (esperable) | Spearman dentro de cada localidad |
|---|---|---|---|---|---|---|---|---|---|---|
| 10 | 0.79 | 0.52 | 0.06 | 20.2 | 45 | 45 | 0.50 | -0.85 | 36% (17%) | 0.84 |
| 30 | 0.83 | 0.57 | 0.04 | 18.1 | 41 | 36 | 0.48 | -0.84 | 37% (17%) | 0.88 |
| 50 | 0.86 | 0.59 | 0.03 | 16.5 | 37 | 36 | 0.46 | -0.82 | 35% (17%) | 0.91 |

**nación 20x12 σ=0.6 islas** (réplicas 15)

| Partidos/jugador | Ranking: Spearman con capacidad | Solapamiento top-K | Pares entre localidades mal ordenados (dif. real ≥1,0) | Desplazamiento medio de puesto | p90 | Peor puesto real dentro del top-K observado | Sesgo medio loc. más sobrevalorada | menos | % del top-K desde la localidad más sobrevalorada (esperable) | Spearman dentro de cada localidad |
|---|---|---|---|---|---|---|---|---|---|---|
| 10 | 0.79 | 0.55 | 0.07 | 34.4 | 77 | 87 | 0.90 | -1.28 | 15% (5%) | 0.82 |
| 30 | 0.82 | 0.58 | 0.05 | 31.8 | 70 | 82 | 0.90 | -1.28 | 16% (5%) | 0.86 |
| 50 | 0.83 | 0.60 | 0.05 | 30.3 | 68 | 76 | 0.90 | -1.28 | 15% (5%) | 0.89 |

**nación 20x12 σ=0.3 islas** (réplicas 15)

| Partidos/jugador | Ranking: Spearman con capacidad | Solapamiento top-K | Pares entre localidades mal ordenados (dif. real ≥1,0) | Desplazamiento medio de puesto | p90 | Peor puesto real dentro del top-K observado | Sesgo medio loc. más sobrevalorada | menos | % del top-K desde la localidad más sobrevalorada (esperable) | Spearman dentro de cada localidad |
|---|---|---|---|---|---|---|---|---|---|---|
| 10 | 0.84 | 0.60 | 0.04 | 29.5 | 66 | 77 | 0.44 | -0.77 | 8% (5%) | 0.82 |
| 30 | 0.87 | 0.62 | 0.02 | 26.1 | 58 | 64 | 0.44 | -0.77 | 9% (5%) | 0.86 |
| 50 | 0.89 | 0.65 | 0.02 | 24.1 | 54 | 57 | 0.44 | -0.77 | 9% (5%) | 0.89 |

**provincia 6x24 σ=0.6 islas (diccionario completo)** (réplicas 15)

| Partidos/jugador | Ranking: Spearman con capacidad | Solapamiento top-K | Pares entre localidades mal ordenados (dif. real ≥1,0) | Desplazamiento medio de puesto | p90 | Peor puesto real dentro del top-K observado | Sesgo medio loc. más sobrevalorada | menos | % del top-K desde la localidad más sobrevalorada (esperable) | Spearman dentro de cada localidad |
|---|---|---|---|---|---|---|---|---|---|---|
| 10 | 0.79 | 0.51 | 0.06 | 20.5 | 46 | 46 | 0.45 | -0.99 | 35% (17%) | 0.84 |
| 30 | 0.83 | 0.57 | 0.05 | 18.6 | 42 | 45 | 0.45 | -0.99 | 34% (17%) | 0.88 |
| 50 | 0.84 | 0.60 | 0.04 | 17.6 | 40 | 34 | 0.45 | -0.99 | 34% (17%) | 0.90 |

## H — Subgrupo sobre/subdeclarante dentro de un grupo abierto (sesgo respecto de capacidad)

| Caso | declarantes @0 | declarantes @5 | declarantes @10 | declarantes @20 | declarantes @30 | declarantes @50 | declarantes @100 | resto @0 | resto @5 | resto @10 | resto @20 | resto @30 | resto @50 | resto @100 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| n=24, 1 sobredeclarantes +1,5 | 1.29 | 1.23 | 1.14 | 1.00 | 0.90 | 0.70 | 0.43 | -0.08 | -0.08 | -0.08 | -0.07 | -0.07 | -0.06 | -0.05 |
| n=24, 3 sobredeclarantes +1,5 | 1.17 | 1.11 | 1.00 | 0.87 | 0.80 | 0.65 | 0.41 | -0.07 | -0.06 | -0.04 | -0.03 | -0.02 | 0.01 | 0.04 |
| n=24, 6 sobredeclarantes +1,5 | 1.22 | 1.17 | 1.07 | 0.95 | 0.87 | 0.72 | 0.52 | -0.07 | -0.05 | -0.02 | 0.02 | 0.05 | 0.10 | 0.16 |
| n=24, 12 sobredeclarantes +1,5 | 1.28 | 1.25 | 1.19 | 1.11 | 1.05 | 0.95 | 0.80 | -0.07 | -0.03 | 0.02 | 0.10 | 0.17 | 0.27 | 0.42 |
| n=12, 3 sobredeclarantes +1,5 | 1.17 | 1.12 | 1.06 | 0.97 | 0.89 | 0.78 | 0.60 | -0.07 | -0.05 | -0.03 | 0.00 | 0.02 | 0.06 | 0.12 |
| n=48, 6 sobredeclarantes +1,5 | 1.22 | 1.15 | 1.06 | 0.93 | 0.82 | 0.66 | 0.38 | -0.09 | -0.08 | -0.07 | -0.05 | -0.03 | -0.01 | 0.03 |
| n=24, 3 subdeclarantes −1,5 | -1.60 | -1.52 | -1.45 | -1.27 | -1.12 | -0.94 | -0.62 | -0.07 | -0.08 | -0.09 | -0.11 | -0.14 | -0.16 | -0.21 |

## G — Ingresantes a un grupo veterano (12 veteranos con 30 partidos; 4 ingresantes; sesgo medio respecto de capacidad)

| Caso | ingresantes @0 | ingresantes @5 | ingresantes @10 | ingresantes @20 | ingresantes @30 | ingresantes @50 | ingresantes @100 | veteranos @0 | veteranos @5 | veteranos @10 | veteranos @20 | veteranos @30 | veteranos @50 | veteranos @100 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 12 veteranos con +1,0; 4 ingresantes honestos (β=0) | -0.03 | 0.11 | 0.19 | 0.25 | 0.29 | 0.35 | 0.45 | 0.80 | 0.78 | 0.77 | 0.76 | 0.74 | 0.72 | 0.69 |
| 12 veteranos honestos; 4 ingresantes con +1,0 | 0.86 | 0.85 | 0.81 | 0.73 | 0.66 | 0.55 | 0.37 | -0.12 | -0.11 | -0.11 | -0.09 | -0.07 | -0.03 | 0.03 |
| control: ingresantes con el mismo +1,0 que los veteranos | 0.86 | 0.96 | 0.99 | 0.99 | 0.97 | 0.94 | 0.89 | 0.80 | 0.79 | 0.78 | 0.78 | 0.79 | 0.80 | 0.81 |

## C2 — Círculo cerrado homogéneo (sesgo +1,0): ¿importa el factor de círculo cuando puede activarse?

| Variante | sesgo @80 | error de orden @50 | @80 | confiabilidad media @80 | % evaluaciones con factor círculo <1 (acum. a 80) |
|---|---|---|---|---|---|
| n=8, sd(θ)=0.45, real | 0.85 | 0.44 | 0.36 | 0.95 | 0.0% |
| n=8, sd(θ)=0.45, fullDict | 0.85 | 0.45 | 0.37 | 0.95 | 18.5% |
| n=8, sd(θ)=0.45, noCircle | 0.85 | 0.44 | 0.36 | 0.95 | 0.0% |
| n=12, sd(θ)=0.45, real | 0.86 | 0.39 | 0.30 | 0.95 | 0.0% |
| n=12, sd(θ)=0.45, fullDict | 0.86 | 0.39 | 0.31 | 0.95 | 12.3% |
| n=12, sd(θ)=0.45, noCircle | 0.86 | 0.39 | 0.30 | 0.95 | 0.0% |
| n=8, sd(θ)=0.9, real | 0.83 | 0.45 | 0.39 | 0.95 | 0.0% |
| n=8, sd(θ)=0.9, fullDict | 0.84 | 0.45 | 0.39 | 0.95 | 0.2% |
| n=8, sd(θ)=0.9, noCircle | 0.83 | 0.45 | 0.39 | 0.95 | 0.0% |

