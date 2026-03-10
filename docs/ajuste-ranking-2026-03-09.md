# Ajuste de Pontuação do Ranking

Em 9 de março de 2026 foi aplicada uma correção no cálculo de rating do ranking.

## O que aconteceu

Identificamos uma regra antiga no sistema que travava o rating mínimo em `100` pontos.
Quando um jogador deveria cair abaixo desse valor, o sistema mantinha `100` e seguia calculando os próximos jogos a partir dessa base incorreta.

Isso gerou dois efeitos:

- alguns jogadores ficaram com pontuação maior do que a real;
- adversários que jogaram depois contra esses jogadores também tiveram pequenas distorções no cálculo de ELO.

Importante: o problema não estava no registro de placar, vencedor, vitórias ou derrotas.
Essas informações continuaram corretas.
O erro estava apenas na regra de atualização dos pontos.

## O que foi corrigido

Foi feita uma auditoria completa do histórico de partidas validadas, respeitando:

- a ordem real em que cada jogo foi confirmado;
- o `k_factor` histórico salvo em cada partida;
- a variação de pontos correta do ELO em cada confronto.

Depois disso, os pontos do ranking foram recalculados e ajustados no banco.

## O que muda para os jogadores

Algumas pontuações podem aparecer menores do que antes.
Isso não significa perda nova de pontos.
Significa apenas que o sistema passou a refletir corretamente o histórico real das partidas já disputadas.

## O que permanece igual

Continuam válidos:

- os resultados das partidas;
- vitórias e derrotas;
- total de jogos;
- ordem histórica dos confrontos;
- fator K usado em cada jogo.

## Como fica daqui para frente

O cálculo foi corrigido para não travar mais em `100`.
A partir dessa correção, o rating passa a seguir o resultado real do histórico, inclusive podendo ficar abaixo de `100` e, se o desempenho levar a isso, também negativo.

## Resumo executivo

Foi uma correção técnica de consistência do ranking.
O sistema passou a refletir os pontos reais produzidos pelos jogos já realizados, sem alterar placares ou resultados.
