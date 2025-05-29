# BabyBet v3

En betting-applikasjon for å tippe på baby-relaterte hendelser.

## Oppsett

1. Installer avhengigheter:
```bash
npm install
```

2. Opprett en `.env` fil i rot-mappen med følgende innhold:
```
PORT=3005
ADMIN_PASSWORD=your-admin-password
SESSION_SECRET=your-secret-key
NODE_ENV=development
```

3. Start utviklingsserver:
```bash
npm run dev
```

## Deployment på Render

1. Opprett en ny Web Service på Render
2. Koble til GitHub-repositoriet
3. Konfigurer følgende:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment Variables: Legg til alle variablene fra `.env` filen

## Sikkerhet

- Bruker Helmet for sikkerhetsheaders
- Rate limiting for å forhindre brute force
- CORS beskyttelse
- Miljøvariabler for sensitive data