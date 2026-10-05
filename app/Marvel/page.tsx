"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { GitCompareArrows, LayoutGrid, Trophy } from "lucide-react";

import { DashboardShell, type DashboardTab } from "@/components/ui/dashboard-shell";
import { trackEvent } from "@/utils/mixpanel";
import { HeroModal } from "./components";
import { DATA_SOURCE, loadRoster, type Hero } from "./lib/roster";
import { CompareTab, LeaderboardTab, RosterTab, TabError, TabLoading } from "./tabs";

/* ------------------------------------------------------------------ */
/*  Tabs                                                               */
/* ------------------------------------------------------------------ */
type TabKey = "roster" | "compare" | "leaders";

const TABS: DashboardTab<TabKey>[] = [
  { key: "roster",  label: "Roster",      hint: "All characters", icon: <LayoutGrid       className="h-4 w-4" /> },
  { key: "compare", label: "Compare",     hint: "Head to head",   icon: <GitCompareArrows className="h-4 w-4" /> },
  { key: "leaders", label: "Leaderboard", hint: "Top 15",         icon: <Trophy           className="h-4 w-4" /> },
];

/* ------------------------------------------------------------------ */
/*  MarvelPage                                                         */
/* ------------------------------------------------------------------ */
export default function MarvelPage() {
  const [roster, setRoster] = useState<Hero[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const [selected, setSelected] = useState<Hero | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pair, setPair] = useState<[Hero | null, Hero | null]>([null, null]);
  const [requestTab, setRequestTab] = useState<{ key: TabKey; nonce: number } | null>(null);

  useEffect(() => {
    trackEvent("Marvel Page Viewed", { page: "Marvel" });
  }, []);

  useEffect(() => {
    let alive = true;
    setError(null);
    loadRoster()
      .then((list) => {
        if (!alive) return;
        setRoster(list);
        // Seed a classic matchup for the Compare tab
        const find = (n: string) => list.find((h) => h.name === n) ?? null;
        setPair([find("Spider-Man") ?? list[0], find("Venom") ?? list[1]]);
      })
      .catch((e) => alive && setError(e?.message ?? "Character data unavailable."));
    return () => {
      alive = false;
    };
  }, [attempt]);

  const openHero = useCallback((h: Hero) => {
    setSelected(h);
    setModalOpen(true);
    trackEvent("Marvel Character Opened", { name: h.name });
  }, []);

  const compareWith = useCallback((h: Hero) => {
    setModalOpen(false);
    setPair(([a, b]) => [h, a && a.id !== h.id ? a : b && b.id !== h.id ? b : null]);
    setRequestTab((r) => ({ key: "compare", nonce: (r?.nonce ?? 0) + 1 }));
  }, []);

  const renderPanel = (key: TabKey): ReactNode => {
    if (error) return <TabError message={error} onRetry={() => setAttempt((n) => n + 1)} />;
    if (!roster) return <TabLoading />;
    if (key === "roster") return <RosterTab roster={roster} onSelect={openHero} />;
    if (key === "compare") return <CompareTab roster={roster} pair={pair} setPair={setPair} onSelect={openHero} />;
    return <LeaderboardTab roster={roster} onSelect={openHero} />;
  };

  return (
    <>
      <DashboardShell
        id="marvel"
        path="~/marvel"
        liveLabel={roster ? `${roster.length} characters` : "loading roster"}
        title="Marvel Character Lab"
        description={
          <>
            Browse the roster, open any character&apos;s file, and pit two of them against each other on power stats.
            Marvel retired its public API, so this runs on the open-source{" "}
            <a href="https://github.com/akabab/superhero-api" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline decoration-indigo-300 underline-offset-2 hover:decoration-indigo-600 dark:text-indigo-300">
              {DATA_SOURCE}
            </a>{" "}
            dataset.
          </>
        }
        tabs={TABS}
        renderPanel={renderPanel}
        requestTab={requestTab}
        onTabChange={(key) => trackEvent("Marvel Tab Clicked", { tab: key })}
      />

      <HeroModal hero={selected} open={modalOpen} onClose={() => setModalOpen(false)} onCompare={compareWith} />
    </>
  );
}
