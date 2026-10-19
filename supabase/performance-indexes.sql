-- Indici aggiuntivi per le query ricorrenti dell'app.
-- Eseguire una volta nel SQL Editor Supabase dopo tutte le migrazioni,
-- in particolare notifications.sql, match-polls.sql e match-mvp-voting.sql.

-- Il job ogni 15 minuti cerca le partite programmate nelle finestre dei promemoria.
create index if not exists matches_scheduled_kickoff_idx
  on public.matches (kickoff)
  where status = 'scheduled';

-- La vista player_stats raggruppa gli MVP per giocatore; serve anche
-- per trovare rapidamente le partite che referenziano un giocatore eliminato.
create index if not exists matches_mvp_player_idx
  on public.matches (mvp_player_id)
  where mvp_player_id is not null;

-- La vista player_stats raggruppa gli assist per giocatore; l'indice
-- supporta anche il controllo della foreign key di goals.assist_id.
create index if not exists goals_assist_player_idx
  on public.goals (assist_id)
  where assist_id is not null;

-- Il job di retention elimina le notifiche più vecchie di 48 ore.
create index if not exists notifications_created_at_idx
  on public.notifications (created_at);

-- Indici per le azioni ON DELETE SET NULL delle foreign key.
create index if not exists notifications_match_id_idx
  on public.notifications (match_id)
  where match_id is not null;

create index if not exists notifications_poll_id_idx
  on public.notifications (poll_id)
  where poll_id is not null;

-- L'indice primario dei voti parte da poll_id; questo supporta invece
-- il controllo della foreign key e la cancellazione dei voti di un giocatore.
create index if not exists match_poll_votes_player_idx
  on public.match_poll_votes (player_id);

analyze public.matches;
analyze public.goals;
analyze public.notifications;
analyze public.match_poll_votes;
