export interface SignalAttribution {
  display_name: string | null;
  contributor_tier: string | null;
}

export interface SignalCasino {
  id: number;
  name: string;
  slug: string;
  tier?: string | null;
}

export interface SignalItem {
  id: number;
  title: string;
  content: string;
  item_type: string;
  created_at: string;
  expires_at: string | null;
  worked_count: number;
  didnt_work_count: number;
  signal_status: string;
  confidence?: string | null;
  casino: SignalCasino | null;
  attribution: SignalAttribution | null;
}

export interface TrackedCasino {
  casino_id: number;
  name: string;
  slug: string;
}
