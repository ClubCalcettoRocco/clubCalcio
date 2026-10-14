# Calcetto Club

Calcetto Club è una web app privata per organizzare le partite del proprio gruppo. Funziona da browser su desktop e telefono e può essere installata come PWA sulla schermata Home.

## Funzionalità

### Partite e squadre

- Organizzazione di partite di calcetto a 5, calciotto a 8 e calcio a 11.
- Scelta di data, ora, campo, partecipanti e nomi delle squadre.
- Inserimento di ospiti senza account.
- Composizione manuale delle squadre oppure proposta dell’assistente AI, modificabile prima di salvare.
- Visualizzazione delle formazioni e dello storico delle partite.

### Risultati e votazioni

- Registrazione del risultato, dei marcatori, degli assist e degli autogol.
- Assegnazione dell’MVP e dei voti ai giocatori.
- Apertura delle votazioni dopo una partita e possibilità di votare i compagni.

### Giocatori e classifiche

- Profili personali con foto, ruolo, posizione, piede preferito e stile di gioco.
- Statistiche individuali su presenze, gol, assist, media voto e MVP.
- Classifiche aggiornate in base ai dati delle partite.
- Foto profilo con rimozione dello sfondo durante il caricamento, elaborata nel browser.

### Amministrazione

- Approvazione degli account registrati e gestione dei ruoli.
- Creazione e modifica delle partite, inserimento dei risultati e gestione dei giocatori.
- Le pagine amministrative sono accessibili solo agli account con ruolo admin.

### Notifiche e promemoria

- Campanella con notifiche in app per nuove partite, risultati e apertura delle votazioni.
- Notifiche push anche con il sito chiuso, dopo averle abilitate sul dispositivo.
- Promemoria automatici circa 24 ore e 3 ore prima della partita per i giocatori assegnati.
- Il controllo dei promemoria viene eseguito ogni 15 minuti tramite `pg_cron`.
- Alla creazione ogni giocatore approvato riceve una convocazione o un avviso che non è stato inserito in formazione.
- Quando vengono aggiornate le squadre, i giocatori ricevono una notifica con la propria squadra o un avviso di aggiornamento delle formazioni.
- Il risultato notifica anche il capocannoniere della partita; l’apertura delle votazioni invita a votare con serietà e un tocco di ironia.
- Se una partita viene eliminata, i giocatori ricevono l’avviso di annullamento, che resta nella campanella anche dopo la cancellazione.

### Assistente AI e aggiornamenti

- Assistente per bilanciare le squadre in base ai dati disponibili, ai ruoli e alle indicazioni scritte dall’utente. Le proposte restano modificabili.
- Aggiornamento PWA con avviso: quando è disponibile una nuova versione, l’utente sceglie quando ricaricare la pagina.

## Tecnologie

- React, Vite e React Router
- Supabase Auth, PostgreSQL, Row Level Security, Storage e Realtime
- Groq per l’assistente AI
- Web Push con service worker e VAPID
- Vercel Functions per gli endpoint server (`api/`)

## Avvio in locale

Servono Node.js e npm.

```bash
npm install
```

Copia `.env.example` in `.env` e inserisci URL e chiave pubblica di Supabase. Su Windows Prompt dei comandi puoi usare:

```cmd
copy .env.example .env
```

Poi avvia il server di sviluppo:

```bash
npm run dev
```

Per generare la build di produzione:

```bash
npm run build
```

L’endpoint AI `/api/build-squads` è gestito localmente dal server Vite durante lo sviluppo. L’invio delle push è invece configurato per l’ambiente server Vercel.

## Configurazione Supabase

1. Crea un progetto Supabase e configura l’URL e la chiave anon/publishable nell’app.
2. Esegui una sola volta `supabase/schema.sql` nel **SQL Editor**. Crea tabelle, viste statistiche, policy di sicurezza e il trigger che crea il profilo quando si registra un utente.
3. Registra il primo account dall’app e promuovilo ad admin dal SQL Editor, sostituendo l’indirizzo:

   ```sql
   update public.players
   set app_role = 'ADMIN', approved = true
   where email = 'admin@example.com';
   ```

4. Gli altri utenti possono registrarsi dall’app. L’admin approva i nuovi account dalla sezione **Amministrazione**.

Per gli account esistenti, non rieseguire `schema.sql`: contiene la struttura iniziale del database e non è una migrazione da applicare a ogni deploy.

## Variabili d’ambiente

| Variabile | Dove | Uso |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Client e server | URL del progetto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Client | Chiave pubblica Supabase; le policy RLS proteggono i dati |
| `GROQ_API_KEY` | Solo server | Chiave per l’assistente AI |
| `GROQ_MODEL` | Solo server, facoltativa | Modello Groq; predefinito `openai/gpt-oss-20b` |
| `VITE_VAPID_PUBLIC_KEY` | Client | Chiave pubblica per iscrivere il dispositivo alle push |
| `VAPID_PRIVATE_KEY` | Solo server | Chiave privata Web Push |
| `VAPID_SUBJECT` | Solo server | Contatto VAPID, per esempio `mailto:admin@example.com` |
| `SUPABASE_SECRET_KEY` | Solo server | Chiave server per leggere le sottoscrizioni push |
| `PUSH_WEBHOOK_SECRET` | Vercel e Supabase Vault | Segreto condiviso per proteggere l’endpoint push |

Le chiavi server non devono avere il prefisso `VITE_`, non vanno inserite nel codice frontend e non vanno committate. Non pubblicare mai il contenuto di `.env`.

## Configurare notifiche push e promemoria

Per le notifiche push su Vercel servono una coppia VAPID (generabile con `npx web-push generate-vapid-keys --json`), le variabili server descritte sopra e un segreto casuale `PUSH_WEBHOOK_SECRET`.

Nel progetto Supabase:

1. Abilita l’estensione `pg_net` in **Database → Extensions**.
2. In **Database → Vault** salva il valore `PUSH_WEBHOOK_SECRET` con nome esatto `push_webhook_secret`.
3. Esegui `supabase/notifications.sql` per creare le notifiche in app e le sottoscrizioni dei dispositivi.
4. Esegui `supabase/push-webhook-net.sql` per collegare le notifiche all’endpoint push Vercel usando `pg_net`. Se usi un dominio Vercel diverso da `club-calcio.vercel.app`, aggiorna l’URL nel file prima di eseguirlo.
5. Esegui `supabase/match-reminders.sql` per abilitare i promemoria 24 ore e circa 3 ore prima delle partite. Questo script abilita `pg_cron` e crea il controllo ogni 15 minuti.
6. Esegui `supabase/notification-messages-and-cancellations.sql` per personalizzare convocazioni, risultati e votazioni e conservare gli avvisi di annullamento.
7. Esegui `supabase/match-roster-update-notifications.sql` per notificare le modifiche alle formazioni.
8. Esegui `supabase/player-card-styles.sql` per permettere a ciascun giocatore di salvare l'estetica scelta per la propria carta.
9. Dopo aver configurato le variabili Vercel, fai un nuovo deploy. Ogni utente deve aprire la campanella e premere **Attiva** sul dispositivo da cui desidera ricevere le push.

Su iPhone il sito deve essere aggiunto alla schermata Home e le notifiche consentite; il Web Push per le web app su iOS richiede iOS 16.4 o successivo. Su Android si può attivare dal sito nel browser compatibile.

## Configurare l’assistente AI

Crea una chiave dalla [console Groq](https://console.groq.com/keys) e impostala come `GROQ_API_KEY` nelle variabili Vercel per Production (e Preview, se usata). La chiave è letta dalla funzione server e non deve essere esposta al client. `GROQ_MODEL` è facoltativa. Le richieste restano soggette ai limiti del provider.

## Deploy

Il progetto è predisposto per Vercel:

1. Collega la repository GitHub al progetto Vercel.
2. Imposta le variabili d’ambiente per gli ambienti necessari.
3. Esegui il push sul branch di produzione, normalmente `main`.
4. Vercel crea il deployment. Le modifiche alle variabili d’ambiente richiedono un nuovo deployment.

Per usare un hosting diverso da Vercel occorre configurare il fallback SPA su `index.html` e implementare gli endpoint serverless AI e push compatibili con l’hosting scelto.

## Sicurezza e dati

- Supabase Row Level Security limita l’accesso ai dati in base all’utente e al ruolo.
- La chiave pubblica Supabase è usata dal client; le chiavi segrete e la service role key sono esclusivamente server-side.
- Le statistiche sono calcolate dalla vista `player_stats`.
- I dati delle partite restano nel database fino a quando un admin non elimina la partita.
