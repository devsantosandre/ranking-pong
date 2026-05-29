# Branding por deploy

Esta pasta agrupa assets visuais por "marca" de deploy. Cada subpasta representa
uma identidade visual completa.

## Estrutura

```
public/branding/
├── smashpong/   ← assets do cliente Smash Pong (PROD atual)
└── template/    ← placeholders genéricos (HML e novos clientes)
```

Cada subpasta deve conter **7 arquivos com os mesmos nomes**:

| Arquivo                  | Uso                          | Tamanho/Formato      |
|--------------------------|------------------------------|----------------------|
| `logo.png`               | Logo da tela de login        | ~512×512, transparente |
| `icon-192.png`           | PWA standard                 | 192×192, fundo opaco |
| `icon-512.png`           | PWA standard / push          | 512×512, fundo opaco |
| `icon-512-maskable.png`  | PWA Android adaptive         | 512×512, padding 10% |
| `badge-72.png`           | Badge push monocromático     | 72×72, branco/preto  |
| `apple-touch-icon.png`   | iOS home screen              | 180×180, fundo opaco |
| `favicon.ico`            | Aba do navegador             | multi-size (16/32/48/64) |

## Como apontar um deploy para um branding

No painel do provider (Coolify, Vercel) configure as env vars:

```
NEXT_PUBLIC_LOGO_PATH=/branding/<marca>/logo.png
NEXT_PUBLIC_ICON_192_PATH=/branding/<marca>/icon-192.png
NEXT_PUBLIC_ICON_512_PATH=/branding/<marca>/icon-512.png
NEXT_PUBLIC_ICON_MASKABLE_PATH=/branding/<marca>/icon-512-maskable.png
NEXT_PUBLIC_BADGE_72_PATH=/branding/<marca>/badge-72.png
NEXT_PUBLIC_APPLE_TOUCH_PATH=/branding/<marca>/apple-touch-icon.png
NEXT_PUBLIC_FAVICON_PATH=/branding/<marca>/favicon.ico
```

Se nenhuma var for setada, o default em `src/lib/product-config.ts` aponta para
`/branding/template/`.

## Gerando um novo conjunto

Para criar branding de um novo cliente:

1. `mkdir public/branding/<slug>`
2. Use [realfavicongenerator.net](https://realfavicongenerator.net) com a logo
   do cliente para gerar todos os 6 arquivos.
3. Renomeie e salve em `public/branding/<slug>/` com os nomes da tabela acima.
4. Configure as env vars do deploy apontando para essa pasta.

## Notas

- Os arquivos atuais em `public/template/` são cópias temporárias do Smash Pong.
  Devem ser substituídos por placeholders genéricos quando a marca do produto
  for definida.
- Os arquivos na raiz de `/public/` (`smash-pong-logo.png`, `icon-512.png`,
  etc.) ficaram lá por compatibilidade com clients antigos em cache (PWA
  instalado antes da reorganização) e com `public/sw.js` em fallback. Podem
  ser removidos quando todos os caches estiverem renovados.
