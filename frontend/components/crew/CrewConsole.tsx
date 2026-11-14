"use client";
// Spacecraft console: what the astronaut sees on board. Fits without scrolling at 1440x900;
// details (alert checklist, space-weather events) expand in place.
import { useStore } from "@/lib/store";
import { Panel, Section } from "@/components/ui/Panel";
import { ProvenanceTag } from "@/components/ui/Status";
import { ActiveAlert } from "./ActiveAlert";
import { CheckIn } from "./CheckIn";
import { CrewBody } from "./CrewBody";
import { EmergencyCheck } from "./EmergencyCheck";
import { EarthLinkStatus } from "./EarthLinkStatus";
import { EarthMessages } from "./EarthMessages";
import { HeartRate } from "./HeartRate";
import { SpaceWeather } from "./SpaceWeather";

export function CrewConsole() {
  const sc = useStore((s) => s.spacecraft);
  const readings = sc?.readings ?? [];
  const last = readings.at(-1);
  // the most recent heart-rate alert (a later space-weather alert must not hide it); its baseline is
  // only trusted while it is recent: with live telemetry the reading moves on after the alert
  const hrAlert = [sc?.latest_alert, ...(sc?.alerts ?? [])].find((a) => a?.metric === "heart_rate") ?? null;
  const lastTs = last ? Date.parse(last.ts) : 0;
  const alertRecent = hrAlert?.ts != null && lastTs - Date.parse(hrAlert.ts) < 2 * 60_000;
  // the body view tints for a recent crew alert of any kind (heart rate, oxygen, missed check), not space weather
  const bodyAlert = [sc?.latest_alert, ...(sc?.alerts ?? [])].find((a) => a && a.metric !== "space_weather") ?? null;
  const bodyAlertRecent = bodyAlert?.ts != null && lastTs - Date.parse(bodyAlert.ts) < 2 * 60_000;

  return (
    <Panel title="Spacecraft console" meta="on board" className="h-full" bodyClassName="scroll-thin overflow-y-auto pb-3">
      <CrewBody
        readings={readings}
        alertBaseline={alertRecent ? hrAlert?.baseline ?? null : null}
        alertSeverity={bodyAlertRecent ? bodyAlert!.severity : null}
        alertOnHeart={bodyAlert?.metric === "heart_rate"}
        astronautId={sc?.astronaut_id ?? "crew-01"}
      />
      <Section title="Heart rate">
        <HeartRate readings={readings} alertBaseline={alertRecent ? hrAlert?.baseline ?? null : null} />
      </Section>
      <Section title="Alert"><EmergencyCheck /><ActiveAlert /></Section>
      <Section title="How do you feel?"><CheckIn /></Section>
      <Section title="Earth link"><EarthLinkStatus /></Section>
      <Section title="Space weather" right={<ProvenanceTag value="nasa-donki" />}><SpaceWeather /></Section>
      <Section title="Latest from Earth"><EarthMessages /></Section>
    </Panel>
  );
}
