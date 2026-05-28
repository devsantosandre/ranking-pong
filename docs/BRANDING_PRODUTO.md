# Branding do Produto (White Label)

A partir da branch `feat/branding-template-generico`, toda a identidade visual
do app é configurável por variáveis de ambiente. Esta é a base para o produto
ser vendido como white label — o mesmo código serve a vários clientes, cada um
com sua marca, cores e logo.

## Princípio

- O **código** nunca contém referências hardcoded a "Smash Pong", "ALSS Tech",
  cores roxas ou paths de logo específicos. Tudo lê de `src/lib/product-config.ts`.
- A `productConfig` carrega valores de **variáveis NEXT_PUBLIC_** em build time.
- **Cada deploy** (Coolify HML, Vercel PROD, Coolify de cada cliente) define seu
  próprio conjunto de variáveis no painel do provider.
- Se uma variável não for definida, o app cai nos **defaults neutros**
  (`PRODUTO_NOME`, paleta azul/cinza, logo placeholder).

## Variáveis disponíveis

| Variável                              | Default                       | Propósito                                  |
|---------------------------------------|-------------------------------|--------------------------------------------|
| `NEXT_PUBLIC_PRODUCT_NAME`            | `PRODUTO_NOME`                | Nome do produto (header, PWA, login)       |
| `NEXT_PUBLIC_PRODUCT_SHORT_NAME`      | `PRODUTO_NOME`                | Nome curto (PWA mobile)                    |
| `NEXT_PUBLIC_PRODUCT_OWNER`           | `PRODUTO_OWNER`               | Rodapé / metadata `applicationName`        |
| `NEXT_PUBLIC_PRODUCT_DESCRIPTION`     | "Sistema de ranking..."       | Meta `description` SEO + PWA manifest      |
| `NEXT_PUBLIC_SPORT_LABEL`             | `esporte`                     | Substitui "tênis de mesa" nas strings      |
| `NEXT_PUBLIC_SPORT_EMOJI`             | `🏆`                          | Emoji de esporte (achievements, etc.)      |
| `NEXT_PUBLIC_PRIMARY_COLOR`           | `#2563eb` (azul-600)          | Cor primária light mode                    |
| `NEXT_PUBLIC_PRIMARY_DARK`            | `#60a5fa` (azul-400)          | Cor primária dark mode                     |
| `NEXT_PUBLIC_BACKGROUND_COLOR`        | `#f8fafc` (slate-50)          | Background light mode                      |
| `NEXT_PUBLIC_BACKGROUND_DARK`         | `#0f172a` (slate-900)         | Background dark mode                       |
| `NEXT_PUBLIC_THEME_COLOR_PWA`         | `#2563eb`                     | `theme_color` do manifest PWA              |
| `NEXT_PUBLIC_LOGO_PATH`               | `/branding/template/logo.png` | Logo principal (login)                     |
| `NEXT_PUBLIC_ICON_192_PATH`           | `/branding/template/icon-192.png` | PWA 192×192                            |
| `NEXT_PUBLIC_ICON_512_PATH`           | `/branding/template/icon-512.png` | PWA 512×512 + push                     |
| `NEXT_PUBLIC_ICON_MASKABLE_PATH`      | `/branding/template/icon-512-maskable.png` | PWA Android adaptive          |
| `NEXT_PUBLIC_BADGE_72_PATH`           | `/branding/template/badge-72.png` | Badge push monocromático               |
| `NEXT_PUBLIC_APPLE_TOUCH_PATH`        | `/branding/template/apple-touch-icon.png` | iOS home screen                |
| `NEXT_PUBLIC_STORAGE_PREFIX`          | `ranking-app`                 | Prefixo de chaves em storage/IndexedDB     |

## Como configurar um deploy existente

### Vercel PROD (manter identidade Smash Pong)

No painel Vercel → seu projeto → Settings → Environment Variables → Production,
adicione as variáveis listadas no bloco "Configuração de PROD" no `.env.example`.

Após salvar, dispare um redeploy. Os usuários do PROD continuam vendo o app
exatamente como antes — cores roxas, nome "Smash Pong App", logo original.

### Coolify HML (cara do produto)

No Coolify → sua aplicação HML → Environment Variables, defina as variáveis
com valores neutros (placeholders) ou customize com a marca real do produto
quando você definir o nome/cores.

Para deixar tudo no default, basta **não definir nenhuma variável** —
o `productConfig` usa os fallbacks neutros.

## Como criar um novo cliente

1. Crie a subpasta de assets: `public/branding/<slug>/`
2. Use [realfavicongenerator.net](https://realfavicongenerator.net) com a logo
   do cliente para gerar os 6 arquivos requeridos (ver
   `public/branding/README.md`).
3. Configure as 17 variáveis NEXT_PUBLIC_* no Coolify do deploy desse cliente,
   apontando paths para `/branding/<slug>/...`.
4. Dispare deploy.

A cara do cliente aparece imediatamente após o build.

## Como testar localmente

Sem nenhuma variável (identidade neutra):
```bash
npm run dev
```

Simulando PROD (identidade Smash Pong):
```bash
NEXT_PUBLIC_PRODUCT_NAME="Smash Pong App" \
NEXT_PUBLIC_PRODUCT_OWNER="ALSS Tech" \
NEXT_PUBLIC_PRIMARY_COLOR="#a421d2" \
NEXT_PUBLIC_PRIMARY_DARK="#d35eff" \
NEXT_PUBLIC_BACKGROUND_COLOR="#f8f1ff" \
NEXT_PUBLIC_BACKGROUND_DARK="#2b003c" \
NEXT_PUBLIC_THEME_COLOR_PWA="#a421d2" \
NEXT_PUBLIC_LOGO_PATH="/branding/smashpong/logo.png" \
NEXT_PUBLIC_ICON_192_PATH="/branding/smashpong/icon-192.png" \
NEXT_PUBLIC_ICON_512_PATH="/branding/smashpong/icon-512.png" \
NEXT_PUBLIC_ICON_MASKABLE_PATH="/branding/smashpong/icon-512-maskable.png" \
NEXT_PUBLIC_BADGE_72_PATH="/branding/smashpong/badge-72.png" \
NEXT_PUBLIC_APPLE_TOUCH_PATH="/branding/smashpong/apple-touch-icon.png" \
NEXT_PUBLIC_STORAGE_PREFIX="smash-pong" \
NEXT_PUBLIC_SPORT_LABEL="tênis de mesa" \
NEXT_PUBLIC_SPORT_EMOJI="🏓" \
  npm run dev
```

## Cuidados

- **Storage prefix:** trocar `NEXT_PUBLIC_STORAGE_PREFIX` em um deploy ativo
  faz com que toasts pendentes, queries persistidas e fila de sync sejam
  recriados (cache reset). Em PROD use `smash-pong` para preservar.
- **Service Worker (`public/sw.js`):** o fallback de push notification usa
  `/branding/template/icon-512.png` como ícone genérico, porque o SW é estático
  (sem env vars). O payload normal de push vem do servidor com `icon` correto.
- **CSS vars injetadas:** o `layout.tsx` injeta um `<style>` no `<head>` com
  as cores do tenant. Isso sobrescreve os defaults em `globals.css`. Se a env
  var for omitida, vale o default neutro de `globals.css`.

## Arquivos-chave

- `src/lib/product-config.ts` — config central
- `src/app/layout.tsx` — injeta CSS vars no `<head>`
- `src/app/manifest.ts` — PWA manifest lê do productConfig
- `src/app/globals.css` — defaults neutros das CSS vars
- `public/branding/` — assets por marca (ver README.md lá dentro)
- `.env.example` — variáveis documentadas

## Próximos passos (planejados)

- **Branch 2 (`infra/migracao-vps-coolify`):** PROD migra do Vercel para a VPS,
  com Coolify configurando estas mesmas variáveis para preservar Smash Pong.
- **Branch 3 (`feat/multitenancy-white-label`):** branding vira dinâmico, lido
  da tabela `tenants` em runtime via subdomínio (`clube1.app.com`). As env vars
  documentadas aqui viram fallback quando não há tenant resolvido.
