# MIRA Platform

Plataforma interna de gestão — Agência Funerária Mira & Pedras da Saudade.

## Estrutura

```
mira-platform/
├── index.html              ← Launcher (página principal)
├── assets/
│   └── firebase-config.js  ← ⚠ Preencher com config Firebase
├── apps/
│   ├── florista/
│   │   └── index.html      ← Gestor de orçamentos Florista Mira
│   └── catalogo/
│       └── index.html      ← Catálogo Arte Fúnebre 2024/2025
```

## Deploy (GitHub Pages)

1. Criar repositório `mira-platform` em github.com/nmir4
2. Push deste código
3. Settings → Pages → Source: main / root
4. URL: `nmir4.github.io/mira-platform`
5. Apontar domínio em Settings → Pages → Custom domain

## Firebase

Preencher `assets/firebase-config.js` com as credenciais do projecto
`mmira-tarefeiros` antes do deploy.

## Apps externas

- **Tarefeiros**: `https://nmir4.github.io/mmira-tarefeiros`
- **Simulador Lápides**: `https://pedrasdasaudade.pt`
