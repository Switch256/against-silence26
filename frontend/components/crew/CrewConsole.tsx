"use client";
// Spacecraft console: what the astronaut sees on board. Fits without scrolling at 1440x900;
// details (alert checklist, space-weather events) expand in place.
import { useStore } from "@/lib/store";
import { Panel, Section } from "@/components/ui/Panel";
import { ProvenanceTag, provenanceOf } from "@/components/ui/Status";
import { ActiveAlert } from "./ActiveAlert";
import { AstronautThumb } from "./AstronautThumb";
import { CheckIn } from "./CheckIn";
import { EmergencyCheck } from "./EmergencyCheck";
import { EarthLinkStatus } from "./EarthLinkStatus";
import { EarthMessages } from "./EarthMessages";
import { HeartRate } from "./HeartRate";
import { SpaceWeather } from "./SpaceWeather";
import { VitalsLine } from "./VitalsLine";

export function CrewConsole() {
  const sc = useStore((s) => s.spacecraft);
  const readings = sc?.readings ?? [];
  const last = readings.at(-1);
  // the most recent heart-rate alert (a later space-weather alert must not hide it); its baseline is
  // only trusted while it is recent: with live telemetry the reading moves on after the alert
  const hrAlert = [sc?.latest_alert, ...(sc?.alerts ?? [])].find((a) => a?.metric === "heart_rate") ?? null;
  const lastTs = last ? Date.parse(last.ts) : 0;
  const alertRecent = hrAlert?.ts != null && lastTs - Date.parse(hrAlert.ts) < 2 * 60_000;

  return (
    <Panel title="Spacecraft console" meta="on board" className="h-full" bodyClassName="scroll-thin overflow-y-auto pb-3">
      <div className="flex items-center gap-2.5 px-4 pt-2.5">
        <AstronautThumb />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[13px] font-semibold">Crew member 1</div>
          <div className="text-[11px] text-fg-3">{sc?.astronaut_id ?? "crew-01"} · AEGIS-1</div>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] text-fg-3">Vitals <ProvenanceTag value={provenanceOf(last?.source)} /></span>
      </div>
      <Section title="Heart rate">
        <HeartRate readings={readings} alertBaseline={alertRecent ? hrAlert?.baseline ?? null : null} />
        <div className="mt-1.5"><VitalsLine last={last} /></div>
      </Section>
      <Section title="Alert"><EmergencyCheck /><ActiveAlert /></Section>
      <Section title="How do you feel?"><CheckIn /></Section>
      <Section title="Earth link"><EarthLinkStatus /></Section>
      <Section title="Space weather" right={<ProvenanceTag value="nasa-donki" />}><SpaceWeather /></Section>
      <Section title="Latest from Earth"><EarthMessages /></Section>
    </Panel>
  );
}
