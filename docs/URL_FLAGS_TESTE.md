# URLs e Flags de Teste

Flags úteis para validar rapidamente fluxos de interface e realtime.

---

## `/partidas`

### Preview do alerta de erro

URL:
- `/partidas?previewAlert=1`

Uso:
- Exibe o alerta visual de erro no topo da tela sem precisar provocar falha real.
- Útil para validar estilo, contraste, espaçamento e comportamento do botão `Fechar`.

---

## `/tv`

### Modo de visualização

Parâmetro:
- `view=grid` (padrão)
- `view=table`

Exemplos:
- `/tv?view=grid`
- `/tv?view=table`

### Limite de jogadores no ranking TV

Parâmetro:
- `limit=<número>`

Exemplos:
- `/tv?limit=10`
- `/tv?view=table&limit=18`
- `/tv?view=grid&limit=50`

### Modo demo (simulação)

Parâmetro:
- `demo=true`

Exemplo:
- `/tv?demo=true`

Uso:
- Simula trocas de posições periódicas para validar comportamento visual/animações sem depender de novas partidas reais.

---

## Combinações comuns de QA

1. TV em tabela com foco em top 18:
   - `/tv?view=table&limit=18`
2. TV com simulação:
   - `/tv?view=grid&demo=true`
3. Partidas com alerta visual:
   - `/partidas?previewAlert=1`
