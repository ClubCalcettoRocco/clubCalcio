# Calcetto Club

Web app privata/PWA per gestire partite di calcetto, calciotto e calcio a 11 con account personali, storico, marcatori, assist, voti, MVP e classifiche.

## Stack
- React + Vite
- Supabase Auth + PostgreSQL + RLS
- PWA con vite-plugin-pwa

## Avvio locale
```bash
npm install
cp .env.example .env
# compila .env con URL e anon key di Supabase
npm run dev
```

## Configurazione Supabase
1. Crea un nuovo progetto Supabase.
2. Vai su **SQL Editor**.
3. Incolla ed esegui tutto `supabase/schema.sql`.
4. Dalla schermata di registrazione della web app crea il primo account.
5. Nel SQL Editor assegna il primo admin:
```sql
update public.players
set app_role = 'ADMIN', approved = true
where email = 'la-tua-email@example.com';
```
6. Per gli altri amici: registrano il proprio account dalla pagina login; l'admin li approva da **Amministrazione**.

### Email confirmation
Per i test puoi disattivare temporaneamente la conferma email in Supabase Auth. In produzione è preferibile mantenerla attiva.

## Deploy
Puoi fare il deploy su Vercel, Netlify o un hosting statico compatibile con SPA. Configura le variabili:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Per un hosting SPA devi anche fare il fallback delle route a `index.html`.

## iPhone
Dopo il deploy:
1. apri il sito da Safari su iPhone;
2. Condividi → **Aggiungi alla schermata Home**;
3. l'app si apre come PWA.

## Note
- L'anon key di Supabase è destinata al client: la sicurezza viene dalle RLS policy.
- Non mettere mai la `service_role` key nel frontend.
- Le statistiche sono calcolate dalla view `player_stats`.
- Lo storico delle partite resta nel database finché un admin non elimina manualmente una partita.