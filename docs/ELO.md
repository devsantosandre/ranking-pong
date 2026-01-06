# Sistema ELO

Sistema de pontuação baseado no algoritmo ELO, originalmente desenvolvido para xadrez e adaptado para o ranking de tênis de mesa.

---

## Visão Geral

O sistema ELO calcula pontos baseado na **probabilidade esperada de vitória**:
- Jogadores que vencem oponentes mais fortes ganham **mais pontos**
- Jogadores que perdem para oponentes mais fracos perdem **mais pontos**
- Vitórias contra oponentes de nível similar resultam em trocas moderadas

**Características:**
- Soma zero: pontos ganhos pelo vencedor = pontos perdidos pelo perdedor
- Determinístico: mesmo resultado sempre gera mesma variação
- Auditável: todas as transações são registradas

---

## Fórmula Matemática

### 1. Expectativa de Vitória

Calcula a probabilidade esperada de vitória (valor entre 0 e 1):

```
E = 1 / (1 + 10^((Ro - Rm) / 400))
```

Onde:
- `E` = Expectativa de vitória (0 a 1)
- `Rm` = Meu rating
- `Ro` = Rating do oponente
- `400` = Constante de sensibilidade ELO

### 2. Variação de Pontos

Após a partida, calcula-se a variação:

```
Δ = K × (R - E)
```

Onde:
- `Δ` = Variação de pontos
- `K` = Fator K (intensidade do ajuste)
- `R` = Resultado (1 para vitória, 0 para derrota)
- `E` = Expectativa calculada

**Para o vencedor:** `Δ = K × (1 - E)` (sempre positivo)
**Para o perdedor:** `Δ = K × (0 - E)` (sempre negativo)

---

## Configurações

| Parâmetro | Valor Padrão | Descrição |
|-----------|--------------|-----------|
| `K factor` | 24 | Intensidade do ajuste por partida |
| `Rating inicial` | 1000 | Pontuação de novos jogadores |
| `Rating mínimo` | 100 | Proteção contra valores muito baixos |

### Sobre o K Factor

O K factor controla a **volatilidade** do sistema:

| K Factor | Comportamento |
|----------|---------------|
| K = 16 | Muito estável (mudanças lentas) |
| K = 24 | Balanceado (padrão recomendado) |
| K = 32 | Mais sensível (mudanças rápidas) |

**Intervalo válido:** 1 a 100

---

## Exemplos de Cálculo

Usando K = 24 (padrão):

### Cenário 1: Favorito vence

**Situação:** Jogador A (1200 pts) vence Jogador B (800 pts)

```
Expectativa de A: E = 1/(1 + 10^((800-1200)/400))
                    = 1/(1 + 10^(-1))
                    = 1/(1 + 0.1)
                    = 0.909 (90.9% de chance)

Variação A (vencedor): Δ = 24 × (1 - 0.909) = +2 pts
Variação B (perdedor): Δ = 24 × (0 - 0.091) = -2 pts

Resultado: A sobe para 1202, B cai para 798
```

**Conclusão:** Vitória esperada = pouca variação

---

### Cenário 2: Jogo equilibrado

**Situação:** Jogador A (1000 pts) vence Jogador B (1000 pts)

```
Expectativa de A: E = 1/(1 + 10^((1000-1000)/400))
                    = 1/(1 + 10^0)
                    = 1/(1 + 1)
                    = 0.5 (50% de chance)

Variação A (vencedor): Δ = 24 × (1 - 0.5) = +12 pts
Variação B (perdedor): Δ = 24 × (0 - 0.5) = -12 pts

Resultado: A sobe para 1012, B cai para 988
```

**Conclusão:** Ratings iguais = variação moderada (metade do K)

---

### Cenário 3: Zebra! (Underdog vence)

**Situação:** Jogador A (800 pts) vence Jogador B (1200 pts)

```
Expectativa de A: E = 1/(1 + 10^((1200-800)/400))
                    = 1/(1 + 10^1)
                    = 1/(1 + 10)
                    = 0.091 (9.1% de chance)

Variação A (vencedor): Δ = 24 × (1 - 0.091) = +22 pts
Variação B (perdedor): Δ = 24 × (0 - 0.909) = -22 pts

Resultado: A sobe para 822, B cai para 1178
```

**Conclusão:** Vitória improvável = grande variação

---

## Tabela de Distribuição

Pontos ganhos/perdidos com K = 24:

| Diferença de Rating | Favorito vence | Underdog vence |
|---------------------|----------------|----------------|
| 0 (iguais) | +12 / -12 | +12 / -12 |
| 100 pts | +9 / -9 | +15 / -15 |
| 200 pts | +7 / -7 | +17 / -17 |
| 300 pts | +5 / -5 | +19 / -19 |
| 400 pts | +4 / -4 | +20 / -20 |
| 500+ pts | +2 / -2 | +22 / -22 |

---

## Fluxo de Confirmação

```
1. Jogador A registra partida
   └── Status: "pendente"

2. Jogador B confirma resultado
   ├── Busca ratings atuais
   ├── Busca K factor da tabela settings
   ├── Calcula ELO: calculateElo(winner, loser, K)
   ├── Atualiza match:
   │   ├── pontos_variacao_a (delta do jogador A)
   │   ├── pontos_variacao_b (delta do jogador B)
   │   ├── rating_final_a
   │   ├── rating_final_b
   │   └── k_factor_used (para auditoria)
   ├── Atualiza stats dos jogadores:
   │   ├── rating_atual
   │   ├── vitorias/derrotas
   │   └── jogos_disputados
   ├── Registra transações em rating_transactions
   ├── Verifica conquistas
   └── Status: "validado"
```

---

## Reversão (Cancelamento)

Quando um administrador cancela uma partida validada:

```
1. Recupera deltas armazenados
   ├── pontos_variacao_a
   └── pontos_variacao_b

2. Reverte ratings
   ├── Vencedor: rating_atual - pontos_vitoria
   └── Perdedor: rating_atual - pontos_derrota

3. Reverte estatísticas
   ├── vitorias - 1 (vencedor)
   ├── derrotas - 1 (perdedor)
   └── jogos_disputados - 1 (ambos)

4. Recalcula streak de ambos jogadores
   └── Busca últimas 20 partidas válidas (excluindo a cancelada)

5. Revoga conquistas vinculadas
   └── DELETE FROM user_achievements WHERE match_id = ?

6. Registra transações de reversão
   └── motivo: "reversao_admin"

7. Atualiza status
   └── Status: "cancelado"
```

**Importante:** O `k_factor_used` armazenado garante que a reversão seja precisa, mesmo que o K factor tenha sido alterado posteriormente.

---

## Proteções e Validações

| Proteção | Descrição |
|----------|-----------|
| Rating mínimo | Nenhum jogador cai abaixo de 100 pts |
| K factor válido | Aceita apenas valores entre 1 e 100 |
| Race condition | Usa `.in("status", [...])` para evitar confirmação duplicada |
| Rollback parcial | Se falhar ao atualizar stats, tenta reverter |
| Auditoria completa | Todos os K factors e deltas são armazenados |
| Logs admin | Toda ação administrativa é registrada com reason |

---

## Arquivos do Sistema

| Arquivo | Descrição |
|---------|-----------|
| `src/lib/elo.ts` | Funções de cálculo ELO |
| `src/app/actions/matches.ts` | Confirmação de partidas |
| `src/app/actions/admin.ts` | Cancelamento e reversão |
| `src/app/admin/configuracoes/page.tsx` | Interface de configuração do K factor |

### Funções Principais

```typescript
// Expectativa de vitória (0 a 1)
expectedScore(myRating, opponentRating): number

// Calcula variação de pontos
calculateElo(winnerRating, loserRating, kFactor): {
  winnerDelta: number,  // Sempre positivo
  loserDelta: number    // Sempre negativo
}

// Aplica rating mínimo
applyMinRating(rating): number  // Math.max(rating, 100)

// Calcula novos ratings completos
calculateNewRatings(winnerRating, loserRating, kFactor): {
  winnerNewRating: number,
  loserNewRating: number,
  winnerDelta: number,
  loserDelta: number
}
```

---

## Notas Importantes

1. **Soma zero**: Em cada partida, `winnerDelta + loserDelta = 0`
2. **Determinístico**: Mesma situação sempre gera mesma variação
3. **K factor dinâmico**: Pode ser alterado pelo admin a qualquer momento
4. **Histórico preservado**: Partidas antigas mantêm o K factor que foi usado
5. **Reversão precisa**: Usa valores armazenados, não recalculados
