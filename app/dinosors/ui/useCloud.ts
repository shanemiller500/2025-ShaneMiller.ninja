"use client";

import { useMemo } from "react";
import { useEmailCloud, type LocalProgress } from "@/utils/firebase/useEmailCloud";
import type { Engine } from "../game/engine";
import type { DinoMeta } from "../cloud/cloud";

const loadApi = () => import("../cloud/cloud").then((m) => m.dinoCloud);

/** Real play, not just the world ticking by itself for a few seconds. */
export function hasDinoProgress(engine: Engine | null) {
  if (!engine) return false;
  const w = engine.world;
  return w.day > 1 || w.elapsed > 90 || w.discoveries.size >= 3 || w.camp.learned.size >= 2;
}

/** Dinosaur Land's hook into the shared email-linked cloud saves. */
export function useCloud(engine: Engine | null, onToast: (icon: string, text: string) => void) {
  const local = useMemo<LocalProgress<DinoMeta>>(
    () => ({
      exportSave() {
        if (!engine) return null;
        const { data, meta } = engine.exportSave();
        return { data, meta: { ...meta, raidsWon: engine.world.tribe.raidsWon } };
      },
      importSave: (data) => !!engine && engine.importSave(data),
      // worth saving once they've played a little or found something
      hasProgress: () => hasDinoProgress(engine),
    }),
    [engine],
  );
  return useEmailCloud<DinoMeta>("dinosors", loadApi, local, onToast);
}
