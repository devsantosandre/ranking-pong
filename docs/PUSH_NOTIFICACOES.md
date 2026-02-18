# Push Notifications (PWA)

Guia operacional para configuração, fluxo e troubleshooting das notificações push.

---

## Visão Geral

O sistema de push é usado para avisar pendências de partida quando o usuário não está com a tela aberta.

Eventos enviados no V1:

- `pending_created` (nova partida para confirmar)
- `pending_transferred` (partida contestada e ação transferida)

Entrega:

1. Backend envia push via `web-push`.
2. Browser/FCM entrega ao dispositivo inscrito.
3. `service worker` exibe a notificação.
4. Clique abre/foca URL do payload (default `/partidas`).

---

## Arquivos Envolvidos

- `src/lib/push.ts`
- `src/app/api/push/subscription/route.ts`
- `src/lib/hooks/use-push-subscription.ts`
- `src/components/providers.tsx`
- `public/sw.js`
- `src/app/perfil/configuracoes/page.tsx`

---

## Variáveis de Ambiente

Obrigatórias no ambiente de execução (dev e produção):

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<publicKey>
VAPID_PRIVATE_KEY=<privateKey>
VAPID_SUBJECT=mailto:seu-email@dominio.com
```

Gerar chaves:

```bash
npx web-push generate-vapid-keys --json
```

---

## Banco de Dados

Tabela: `public.push_subscriptions`

Campos principais:

- `user_id`
- `endpoint`
- `p256dh`
- `auth`
- `disabled_at`
- `last_error`

Regras importantes:

- Endpoint único (`idx_push_subscriptions_endpoint`)
- RLS por dono (`SELECT/INSERT/UPDATE/DELETE`)
- Assinaturas inválidas (`404/410`) são desativadas automaticamente

Migration:

- `20260218171000_push_notifications_pending_v1.sql`

---

## Fluxo de Inscrição

1. Usuário acessa app autenticado.
2. `PushSubscriptionProvider` verifica suporte e estado atual.
3. Se permitido, sincroniza assinatura com `/api/push/subscription`.
4. Se negado, desativa assinatura no backend (`DELETE`).
5. Se `default`, usa fluxo de soft ask com cooldown.

Soft ask:

- Chave local: `push-soft-ask-dismissed-until-v1:<userId>`
- Cooldown padrão: `7 dias`

---

## Payload Push

Payload padrão enviado ao SW:

```json
{
  "title": "Nova partida para confirmar",
  "body": "Seu adversário registrou o placar. Toque para revisar.",
  "url": "/partidas",
  "icon": "/icon-512.png",
  "badge": "/badge-72.png",
  "tag": "pending-match-<matchId>",
  "data": {
    "matchId": "<uuid>",
    "event": "pending_created"
  }
}
```

---

## Ícones de Notificação (Android)

Para evitar badge branco/genérico:

- `icon`: usar ícone colorido (`/icon-512.png`)
- `badge`: usar arquivo monocromático transparente (`/badge-72.png`)

Arquivos:

- `public/icon-512.png`
- `public/badge-72.png`

---

## Checklist de Teste

1. Confirmar status `Ativo` em `/perfil/configuracoes`.
2. Validar no banco:

```sql
select user_id, endpoint, disabled_at, last_error
from public.push_subscriptions
where user_id = '<user-id>';
```

3. Registrar partida para esse usuário.
4. Conferir entrega no dispositivo.

---

## Troubleshooting

### Status: `Indisponível`

Causa comum:

- Ambiente sem VAPID configurado.

Ação:

- Configurar envs no ambiente correto (produção/preview/local) e redeploy.

### Status: `Bloqueado`

Causa:

- Permissão de notificação negada no navegador/SO.

Ação:

- Reativar permissão nas configurações do app/navegador.
- Abrir `/perfil/configuracoes` e clicar `Atualizar status`.

### Push não chega, mas assinatura existe

Diagnóstico rápido:

1. Verificar `last_error` em `push_subscriptions`.
2. Validar se SW foi atualizado (versão query string em registro).
3. Reinstalar PWA se houver cache antigo persistente.
4. Garantir que teste foi em ambiente que recebeu deploy das envs VAPID.

---

## Comandos úteis (debug)

Contagem de assinaturas ativas:

```sql
select count(*) as total,
       count(*) filter (where disabled_at is null) as active
from public.push_subscriptions;
```

Últimas inscrições:

```sql
select user_id, endpoint, disabled_at, last_error, updated_at
from public.push_subscriptions
order by updated_at desc
limit 20;
```
