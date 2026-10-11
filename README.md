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

### Notifiche in app
Esegui `supabase/notifications.sql` nel SQL Editor di Supabase. I giocatori approvati vedranno una notifica nella campanella quando viene creata una partita, registrato un risultato o aperta la votazione.

#### Web Push (avvisi anche con l'app chiusa)
1. Genera una coppia VAPID una sola volta con `npx web-push generate-vapid-keys --json`. Conserva la chiave privata solo come segreto server; non inserirla in `VITE_` e non committarla.
2. In **Vercel → Settings → Environment Variables**, configura `VITE_VAPID_PUBLIC_KEY` (pubblica), `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (un indirizzo reale, per esempio `mailto:admin@tuodominio.it`), `SUPABASE_SECRET_KEY` (solo server, mai con prefisso `VITE_`) e `PUSH_WEBHOOK_SECRET` (un segreto casuale condiviso col webhook). La URL Supabase (`VITE_SUPABASE_URL`) deve già essere configurata.
3. Ridistribuisci il sito su Vercel. Poi, in **Database → Webhooks** di Supabase, crea un webhook sulla tabella `public.notifications`, evento `INSERT`, URL `https://<dominio-del-tuo-sito>/api/send-push` e header `Authorization: Bearer <PUSH_WEBHOOK_SECRET>`.
4. Esegui `supabase/notifications.sql` se non l'hai già fatto. Accedi dal sito e premi **Notifiche → Attiva** su ogni dispositivo.

La campanella in app continua a funzionare. Su iPhone aggiungi prima il sito alla schermata Home e consenti le notifiche; il Web Push per web app su iOS richiede iOS 16.4 o successivo.

### Email confirmation
Per i test puoi disattivare temporaneamente la conferma email in Supabase Auth. In produzione è preferibile mantenerla attiva.

### Assistente AI per le squadre
Nella creazione della partita, seleziona prima tutti i partecipanti e poi usa **Componi le squadre** per chiedere all'assistente una proposta in linguaggio naturale. La proposta resta modificabile dalla schermata.

Il builder usa Groq con il modello `openai/gpt-oss-20b`. Crea una chiave dalla [console Groq](https://console.groq.com/keys) e configúrala come `GROQ_API_KEY` nelle variabili di Vercel e nel `.env` locale. `GROQ_MODEL` è facoltativa. La chiave va impostata solo sul server, mai con prefisso `VITE_`. In locale avvia `npm run dev`: il server Vite inoltra l'endpoint alla stessa funzione.

### Rimozione sfondo dalle foto profilo
Le nuove foto vengono elaborate nel browser e poi caricate su Supabase Storage come PNG trasparenti. Le immagini non vengono inviate al servizio del modello; al primo utilizzo il browser scarica il modello di elaborazione.

Per elaborare le foto già presenti:
1. Esegui `supabase/avatar-background-history.sql` nel SQL Editor di Supabase.
2. Pubblica il progetto e apri **Amministrazione** come admin.
3. Usa **Rimuovi sfondo**. Gli URL originali vengono conservati e puoi ripristinarli da **Ripristina originali**.

La libreria `@imgly/background-removal` è distribuita sotto licenza AGPL; verifica la licenza del progetto prima di distribuire una versione modificata.

## Deploy
Puoi fare il deploy su Vercel, Netlify o un hosting statico compatibile con SPA. Configura le variabili:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

L'endpoint AI incluso in `api/` viene eseguito da Vercel Functions; per Netlify o altri hosting occorre aggiungere l'equivalente funzione serverless e instradare `/api/build-squads`.

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
