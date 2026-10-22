import { supabase, songToDbRow, dbRowToSong, sessionToDbRow, dbRowToSession, type DbSongRow, type DbSessionRow } from './supabase';
import { getSongs, getSessions, type Song, type PracticeSession } from './library';
import { putRecords, STORE_CHANGE_EVENT } from './db';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error';

let syncState: SyncState = 'idle';
let lastSyncedTime: number | null = null;
const SYNC_CHANGE_EVENT = 'cadenza-sync-change';

export function getSyncStatus(): { state: SyncState; lastSyncedAt: number | null } {
  return { state: syncState, lastSyncedAt: lastSyncedTime };
}

function announceSync(state: SyncState) {
  syncState = state;
  if (state === 'synced') lastSyncedTime = Date.now();
  window.dispatchEvent(new CustomEvent(SYNC_CHANGE_EVENT, { detail: { state, lastSyncedAt: lastSyncedTime } }));
}

/**
 * Perform a two-way merge between local IndexedDB and Supabase cloud.
 */
export async function syncLibraryWithCloud(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    announceSync('idle');
    return false;
  }

  const userId = session.user.id;
  announceSync('syncing');

  try {
    // 1. Fetch cloud songs and practice sessions
    const [cloudSongsRes, cloudSessionsRes] = await Promise.all([
      supabase.from('songs').select('*').eq('user_id', userId),
      supabase.from('practice_sessions').select('*').eq('user_id', userId)
    ]);

    if (cloudSongsRes.error) throw cloudSongsRes.error;
    if (cloudSessionsRes.error) throw cloudSessionsRes.error;

    const cloudSongsMap = new Map<string, Song>(
      (cloudSongsRes.data as DbSongRow[]).map(row => {
        const s = dbRowToSong(row);
        return [s.id, s];
      })
    );

    const cloudSessionsMap = new Map<string, PracticeSession>(
      (cloudSessionsRes.data as DbSessionRow[]).map(row => {
        const p = dbRowToSession(row);
        return [p.id, p];
      })
    );

    // 2. Compare with local songs
    const localSongs = getSongs();
    const mergedSongs: Song[] = [];
    const songsToUpload: DbSongRow[] = [];

    const localSongsMap = new Map<string, Song>(localSongs.map(s => [s.id, s]));

    // Handle local songs
    for (const local of localSongs) {
      const cloud = cloudSongsMap.get(local.id);
      if (!cloud) {
        // Exists locally, but not in cloud -> upload to cloud
        songsToUpload.push(songToDbRow(local, userId));
        mergedSongs.push(local);
      } else {
        // Exists in both: newer updatedAt wins
        if (local.updatedAt >= cloud.updatedAt) {
          if (local.updatedAt > cloud.updatedAt) songsToUpload.push(songToDbRow(local, userId));
          mergedSongs.push(local);
        } else {
          mergedSongs.push(cloud);
        }
      }
    }

    // Handle cloud songs not present locally
    for (const [id, cloud] of cloudSongsMap.entries()) {
      if (!localSongsMap.has(id)) {
        mergedSongs.push(cloud);
      }
    }

    // 3. Compare with local practice sessions
    const localSessions = getSessions();
    const mergedSessions: PracticeSession[] = [];
    const sessionsToUpload: DbSessionRow[] = [];
    const localSessionsMap = new Map<string, PracticeSession>(localSessions.map(s => [s.id, s]));

    for (const local of localSessions) {
      const cloud = cloudSessionsMap.get(local.id);
      if (!cloud) {
        sessionsToUpload.push(sessionToDbRow(local, userId));
        mergedSessions.push(local);
      } else {
        mergedSessions.push(local);
      }
    }

    for (const [id, cloud] of cloudSessionsMap.entries()) {
      if (!localSessionsMap.has(id)) {
        mergedSessions.push(cloud);
      }
    }

    // 4. Batch uploads to cloud if needed
    if (songsToUpload.length > 0) {
      await supabase.from('songs').upsert(songsToUpload);
    }
    if (sessionsToUpload.length > 0) {
      await supabase.from('practice_sessions').upsert(sessionsToUpload);
    }

    // 5. Update local IndexedDB with merged records
    await putRecords('songs', mergedSongs);
    await putRecords('sessions', mergedSessions);

    // Announce store change so UI refreshes
    window.dispatchEvent(new Event(STORE_CHANGE_EVENT));
    announceSync('synced');
    return true;
  } catch (err) {
    console.warn('Cloud sync encountered an issue:', err);
    announceSync('error');
    return false;
  }
}

/**
 * Mirror a song creation or update directly to Supabase if authenticated.
 */
export async function syncUpsertSong(song: Song): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const row = songToDbRow(song, session.user.id);
    await supabase.from('songs').upsert(row);
  } catch (err) {
    console.warn('Background song upsert to cloud failed:', err);
  }
}

/**
 * Mirror a song deletion directly to Supabase if authenticated.
 */
export async function syncDeleteSong(songId: string): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    await supabase.from('songs').delete().eq('id', songId).eq('user_id', session.user.id);
    await supabase.from('practice_sessions').delete().eq('song_id', songId).eq('user_id', session.user.id);
  } catch (err) {
    console.warn('Background song deletion from cloud failed:', err);
  }
}
