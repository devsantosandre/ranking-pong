# 09 — Diferenciais ("não pensei nisso") — além do Tourney

> O Tourney é genérico/multi-esporte. Nós temos o que ele nunca terá: **ELO, divisões, temporadas, feed social, H2H e fluxo de confirmação/contestação de partida já testado**. Cruzar isso com torneios cria recursos sem concorrência. Esforço: **S/M/L** · Fase.

## 1. Inteligência de ELO no bracket (o grande trunfo)
- **Barra de probabilidade ao vivo** por partida (eval-bar do xadrez), `P(A)=1/(1+10^((Rb-Ra)/400))`, atualiza em realtime. **[M · F2]**
- **Detecção de "UPSET"/Zebra:** seed/ELO baixo vence alto → partida **pulsa dourado**, badge `ZEBRA 🔥`, **feed posta automaticamente** ("Maria #12 eliminou o favorito João #1"). **[S · F2]**
- **Semeadura justa por ELO** (snake nos grupos) + **"evitar confronto cedo"** entre mesma divisão/professor. **[M · F2]**
- **Índice de surpresa** do torneio (quantas zebras) → manchete na TV. **[S · F3]**

## 2. Predições / Bracket Challenge (engajamento viral)
- Espectadores **preenchem o palpite** do mata-mata (March Madness). Pontua acertos, **leaderboard de palpiteiros**, badge `Vidente`. Usa realtime + conquistas. **[L · F3]**
- Enquete rápida por partida ("quem ganha?") na TV. **[S · F3]**

## 3. Score@Table — placar pelo celular, com confiança (reuso do nosso ouro)
- Cada mesa tem **QR**; jogador escaneia, abre a partida, lança o set **do próprio celular** — passando pelo **fluxo de confirmação/contestação já testado**. Resolve o gargalo do admin. Offline-first (`match-sync-queue`). **[M · F2]**
- **Ready-check / "é a sua vez":** push chama os dois + mesa; TV mostra "CHAMANDO: Mesa 3 — João × Maria". **[M · F3]**

## 4. Modo Narrativa & Recap ("Wrapped" do torneio, Claude por baixo)
- Ao encerrar: **recap cinematográfico** (chave preenchendo em fast-forward, zebras, `road to final` do campeão) + **narração curta em PT-BR por LLM (Claude)**. Exportável p/ compartilhar. **[L · F3]**
- **Comentário automático** por partida no feed (1 frase, opcional). **[M · F3]**
- **OG images dinâmicas** (`ImageResponse`): torneio/partida compartilhado vira **card lindo**, não print torto. **[M · F2]**
> Implementação LLM: ver skill/local `claude-api`. Chamadas server-side, cacheadas, com fallback textual se a API falhar.

## 5. "Road to Final" & rivalidade
- Selecionar um jogador **ilumina o caminho** dele na chave. **[S · F2]**
- Confronto → **overlay de H2H histórico** (já temos H2H): "3º encontro — 1×1". **[S · F3]**
- **Cartela do confronto** na TV antes de final/semi (foto, divisão, ELO, sequência, retrospecto). **[M · F3]**

## 6. Hype na TV (transmissão de verdade)
- **Momento decisivo** (match point/final/virada) → **spotlight automático** + som opcional. **[M · F3]**
- **Chuva de reações** ao vivo (emoji do celular cai na TV). **[M · F3]**
- **Ticker** esportivo (próximos confrontos, últimos resultados, zebra do dia). **[S · F3]**

## 7. Eventos multi-chave (o dia real da escola)
- Um **"Evento"** agrupa vários torneios/categorias no mesmo dia (Iniciante/Intermediário/Avançado ou por divisão); **TV cicla** entre chaves + **placar geral do evento**. O Tourney faz um por vez; nós orquestramos o **dia inteiro**. **[L · F4]**
- **Otimização de mesas** (minimiza espera, inspirado no TTHub). **[L · F4]**

## 8. Integração com o ecossistema (o que nos torna plataforma)
- **Conquistas de torneio:** `tournament_champion`, `zebra_master`, `invicto`, `vidente`. **[S · F3]**
- **Pontos de temporada por rachão** (configurável). **[M · F4]**
- **Histórico de torneios no perfil** + vitrine de troféus. **[M · F3]**
- **Liga ↔ Divisões:** formato liga pode **promover/rebaixar** divisão real (com confirm). **[L · F4]**

## 9. Acessibilidade como diferencial
- **Modo daltônico** (estado por ícone+padrão, não só cor), **alto contraste**, **reduzir movimento**, **narração por leitor de tela** do avanço da chave. A maioria dos apps de torneio ignora isso. **[M · F3]**

---
**Resumo do "uau":** ELO ao vivo + zebras automáticas + palpites + score pelo QR no fluxo confiável + recap narrado + TV de transmissão + orquestração do dia inteiro. Ninguém junta tudo isso porque ninguém tem a base que **já existe** aqui.
