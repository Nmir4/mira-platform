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

## Avisos TV (ecrã exterior)

- **Gestão:** `apps/avisos/` (com login) — criar, publicar, retirar e apagar avisos de falecimento.
- **Ecrã:** `tv/` (público, sem login) — abrir em ecrã inteiro no dispositivo ligado à TV.
  - Verifica novidades a cada 60 s; retira avisos expirados mesmo sem internet; recarrega a cada 6 h.
  - Sem avisos activos mostra o ecrã institucional com relógio.
  - `?rot=20` define os segundos por aviso quando há vários.
- **Firestore:** colecções `avisos-tv` (dados) e `avisos-tv-fotos` (fotografia 640×800 em JPEG/base64).
