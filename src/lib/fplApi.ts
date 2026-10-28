import {
  FPLBootstrap,
  FPLFixture,
  FPLDreamTeam,
  FPLEntry,
  FPLEntryPicksResponse,
} from '../types/fpl';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  lastUpdated?: string;
  fromCache?: boolean;
  message?: string;
  error?: string;
}

export async function fetchBootstrapStatic(): Promise<{ data: FPLBootstrap; lastUpdated: string; fromCache: boolean }> {
  const res = await fetch('/api/fpl/bootstrap-static');
  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.message || `Failed to fetch FPL data (Status ${res.status})`);
  }
  const json: ApiResponse<FPLBootstrap> = await res.json();
  if (!json.success || !json.data) {
    throw new Error(json.message || 'Invalid bootstrap response');
  }
  return {
    data: json.data,
    lastUpdated: json.lastUpdated || new Date().toISOString(),
    fromCache: Boolean(json.fromCache),
  };
}

export async function fetchFixtures(eventId?: number): Promise<FPLFixture[]> {
  const url = eventId ? `/api/fpl/fixtures?event=${eventId}` : '/api/fpl/fixtures';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch fixtures (Status ${res.status})`);
  }
  const json: ApiResponse<FPLFixture[]> = await res.json();
  return json.data || [];
}

export async function fetchDreamTeam(eventId: number): Promise<FPLDreamTeam> {
  const res = await fetch(`/api/fpl/dream-team/${eventId}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || `Dream team for GW${eventId} is not available.`);
  }
  const json: ApiResponse<FPLDreamTeam> = await res.json();
  return json.data;
}

export async function fetchEntryProfile(teamId: number): Promise<FPLEntry> {
  const res = await fetch(`/api/fpl/entry/${teamId}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || `Team ID ${teamId} not found.`);
  }
  const json: ApiResponse<FPLEntry> = await res.json();
  return json.data;
}

export async function fetchEntryPicks(teamId: number, eventId: number): Promise<FPLEntryPicksResponse> {
  const res = await fetch(`/api/fpl/entry/${teamId}/picks/${eventId}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || `Picks for Gameweek ${eventId} on team ${teamId} are not available.`);
  }
  const json: ApiResponse<FPLEntryPicksResponse> = await res.json();
  return json.data;
}

export async function fetchLiveEvent(eventId: number): Promise<{ elements: { id: number; stats: any }[] }> {
  const res = await fetch(`/api/fpl/event/${eventId}/live`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || `Live data for Gameweek ${eventId} not available.`);
  }
  const json = await res.json();
  return json.data;
}

