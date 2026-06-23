# 01 — Visão & Produto

## 1. Visão
Transformar o Smash Pong de "ranking mobile-first roxo" em uma **plataforma-arena imersiva** de tênis de mesa: palco escuro, superfícies de vidro, glows neon por estado, tipografia de display esportiva e **movimento que conta a história de cada jogo**. O coração novo é o **módulo de Torneios** com bracket visual ao vivo, projetável na TV da escola.

## 2. Objetivos
- **Replicar praticamente tudo do Tourney** dentro do nosso contexto (TT, escola/clube, web/PWA).
- **Superar o Tourney** com o que só nós temos: ELO, divisões, temporadas, feed social, H2H e fluxo de confirmação de partida (ver `09-diferenciais.md`).
- **Experiência de transmissão** na TV (não slideshow).
- **Performance de produto**: 60fps, leve em celular fraco e TV.

## 3. Públicos
- **Jogador/aluno** — acompanha chave, lança placar do próprio celular (QR), recebe "é a sua vez", palpita.
- **Admin/professor** — monta torneio, semeia, lança resultados, projeta na TV.
- **Espectador** — assiste read-only por link/QR e na TV.

## 4. Inventário COMPLETO do Tourney (fonte oficial: tourneymaker.app + App Store v3.7.3)
> Veredito por item: **Replicar** (igual) · **Adaptar** (ao nosso contexto) · **Descartar**.

### 4.1 Formatos
| Formato | Tourney | Veredito | Fase | No Smash Pong |
|---|---|---|---|---|
| Eliminatória simples (+3º lugar) | ✅ | Replicar | MVP | árvore, vencedor avança |
| Eliminatória dupla | ✅ | Replicar | F4 | winners + losers |
| Fase de grupos | ✅ | Replicar | **F2** | rachão real da escola |
| Round-robin | ✅ | Replicar | F2 | tabela |
| Suíço (Swiss) | ✅ | Replicar | F4 | pareamento por pontuação |
| Scorecard (estatística em tabela) | ✅ | Adaptar | F2 | pontos corridos + leaderboard |
| **Americano** (duplas, parceiro rotativo) | ✅ | Adaptar | F3 | eventos de duplas |
| Promoção/rebaixamento (liga) | ✅ | Adaptar | F4 | ligado às **divisões** |
| Rei da mesa | (nosso) | Manter | MVP | desafiante × rei |

### 4.2 Semeadura
Bracket padrão (1×N) · sistema de **potes** (Champions) · sequencial · **drag&drop manual** · **+por ELO** (nosso). Todos replicar/adicionar.

### 4.3 Participantes
Conta **ou** convidado avulso · avatar/cor/bandeira · **listas reutilizáveis + merge** · **templates** · **importação por IA** (foto/manuscrito/CSV) [F3] · presets de imagem [F3]. **Descartado:** criador de camisa.

### 4.4 Inscrição
**Convite** direto **ou inscrição aberta com código de verificação** · lista de inscritos com status · limite de vagas. Replicar (F2).

### 4.5 Partida & estatística
Placar em **1 toque** · marcação automática do vencedor · **timer ao vivo** [F3] · **match events + timeline** com placar progressivo [F3]. **Descartado:** scoreboards de dardos/baseball/handball (somos TT → sets/melhor-de-N).

### 4.6 Compartilhamento & espectador
**Link + QR** · **espectador read-only sem login** · edição colaborativa multi-admin [F3] · **export PNG do bracket** [F3] · **OG images dinâmicas**. **Descartado:** embed em site.

### 4.7 Organização/admin
Workspace · **branding (logo+cor)** [F4] · múltiplos admins (já temos roles) · gestão de inscrições.

### 4.8 Agenda/calendário
**Deadlines por rodada** (igual à referência) · datas/horários/locais/mesa [F4] · **calendário .ics** [F4] · check-in [F4].

### 4.9 Dados
**Offline** (PWA, já temos fila de sync) · backup/sync na nuvem (Supabase).

### 4.10 Multi-esporte
**Descartado como produto** (somos TT), mas o **motor fica agnóstico** → outros joguinhos da escola cabem sem reescrever.

## 5. O que NÃO replicamos (de propósito)
Criador de camisa · scoreboards de outros esportes · embed · multi-esporte como produto · planos/preços de SaaS. Nada disso tira o "uau".

## 6. Princípios de produto
1. **Confiança** — placar entra pelo fluxo testado (confirmação/contestação).
2. **Ao vivo** — tudo é realtime; a TV é transmissão.
3. **Engajamento** — zebras, palpites, conquistas, feed.
4. **Inclusão** — daltônico, alto contraste, reduzir movimento.
5. **Leveza** — animação cinematográfica que roda a 60fps.
