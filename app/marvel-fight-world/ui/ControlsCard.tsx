"use client";

import { specialList } from "../engine/fighters";
import type { FighterDef } from "../engine/types";
import type { Settings } from "../data/storage";
import { keyLabel } from "../input/input";
import type { ReactNode } from "react";
import { Gamepad2 } from "lucide-react";
import { Keycap, P_COLORS, PadBtn } from "./kit";
import { usePadConnected } from "./usePad";

/** Key map + move list for one or both players. */
export function ControlsCard({ settings, versus, p1, p2 }: { settings: Settings; versus: boolean; p1?: FighterDef; p2?: FighterDef }) {
  const players: (0 | 1)[] = versus ? [0, 1] : [0];
  const pad = usePadConnected();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {pad && <PadCard name={pad} def={p1} />}
      {players.map((p) => {
        const b = settings.bindings[p];
        const k = (a: keyof typeof b) => keyLabel(b[a][0] ?? "");
        const def = p === 0 ? p1 : p2;
        return (
          <div key={p} className="rounded-2xl bg-white/[0.05] p-5 ring-1 ring-white/10">
            <p className="fw-display mb-3 text-xl font-[650] uppercase" style={{ color: P_COLORS[p] }}>
              {versus ? `Player ${p + 1}` : "Controls"} {def && <span className="text-white/60">· {def.name}</span>}
            </p>
            <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm text-white/80">
              <Row label="Move">
                <Keycap>{k("left")}</Keycap>
                <Keycap>{k("right")}</Keycap>
              </Row>
              <Row label="Jump / crouch">
                <Keycap>{k("up")}</Keycap>
                <Keycap>{k("down")}</Keycap>
              </Row>
              <Row label="Light punch"><Keycap>{k("lp")}</Keycap></Row>
              <Row label="Heavy punch"><Keycap>{k("hp")}</Keycap></Row>
              <Row label="Kick"><Keycap>{k("kick")}</Keycap></Row>
              <Row label="Block"><Keycap>{k("block")}</Keycap></Row>
              <Row label="Special"><Keycap>{k("special")}</Keycap></Row>
              <Row label="Ultimate"><Keycap color="#fde047">{k("ult")}</Keycap></Row>
            </div>
            <div className="mt-4 space-y-1.5 border-t border-white/10 pt-3 text-[13px] text-white/70">
              <Tip keys={[k("down"), k("hp")]} text="Uppercut (launches)" />
              <Tip keys={[k("down"), k("kick")]} text="Sweep (beats standing block)" />
              <Tip keys={[k("lp"), k("kick")]} text="Throw (beats blocking)" />
              <Tip keys={[`${k("right")}${k("right")}`]} text="Run · double-tap back to dodge" />
              <Tip keys={[k("block"), `${k("left")}/${k("right")}`]} text="Dodge roll" />
              <Tip keys={[`${k("lp")}→${k("lp")}→${k("kick")}`]} text="Chain hits into a combo" />
            </div>
            {def && (
              <div className="mt-4 space-y-1 border-t border-white/10 pt-3">
                {specialList(def).map(({ input, move }) => (
                  <div key={move.id} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="font-semibold text-white">{move.name}</span>
                    <span className="font-mono text-[11px] text-white/50">{input.replace("Special", k("special")).replace("Ultimate (full meter)", `${k("ult")} · full meter`)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Xbox layout (standard mapping) - the same for every fighter. */
function PadCard({ name, def }: { name: string; def?: FighterDef }) {
  const rows: [ReactNode, string][] = [
    [<PadBtn key="l">LS</PadBtn>, "Move; down to crouch (or D-pad)"],
    [<PadBtn key="rs">RS</PadBtn>, "World mode: press for random challenge"],
    [<PadBtn key="jump" c="#22c55e">A</PadBtn>, "Jump (or D-Pad / Left Stick up)"],
    [<PadBtn key="crouch">↓</PadBtn>, "Crouch"],
    [<PadBtn key="x" c="#3b82f6">X</PadBtn>, "Light punch"],
    [<PadBtn key="y" c="#eab308">Y</PadBtn>, "Heavy punch"],
    [<PadBtn key="b" c="#ef4444">B</PadBtn>, "Kick"],
    [<PadBtn key="rb">RB</PadBtn>, "Special (↓ + RB / → + RB for variants)"],
    [<PadBtn key="rt">RT</PadBtn>, "Block · + left/right to dodge"],
    [<span key="grab" className="flex gap-1"><PadBtn c="#3b82f6">X</PadBtn><PadBtn c="#ef4444">B</PadBtn></span>, "Grab at close range"],
    [<span key="dodge" className="flex gap-1"><PadBtn>RT</PadBtn><PadBtn>←/→</PadBtn></span>, "Dodge away from a strike"],
    [<span key="ult" className="flex gap-1"><PadBtn>LT</PadBtn><PadBtn>RT</PadBtn></span>, "Ultimate (full meter)"],
    [<PadBtn key="lb">LB</PadBtn>, "Previous character filter in select"],
    [<PadBtn key="s">Menu</PadBtn>, "Pause"],
    [<PadBtn key="v">View</PadBtn>, "World map"],
  ];
  return (
    <div className="rounded-2xl bg-emerald-400/[0.06] p-5 ring-1 ring-emerald-400/25">
      <p className="fw-display mb-3 flex items-center gap-2 text-xl font-[650] uppercase text-emerald-300">
        <Gamepad2 className="h-5 w-5" /> {name} {def && <span className="text-white/60">· {def.name}</span>}
      </p>
      <div className="grid gap-2 text-sm text-white/80">
        {rows.map(([k, label], i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="flex w-16 shrink-0 justify-end">{k}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 border-t border-white/10 pt-3 text-[12px] text-white/50">↓ + Y uppercut · ↓ + B sweep · X + B grab · chain attacks for combos</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <span className="flex gap-1">{children}</span>
    </div>
  );
}

function Tip({ keys, text }: { keys: string[]; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex shrink-0 gap-1">
        {keys.map((k) => (
          <Keycap key={k}>{k}</Keycap>
        ))}
      </span>
      <span>{text}</span>
    </div>
  );
}
