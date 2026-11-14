// Possible causes for an AEGIS alert, with simple first steps. Adapted from Mariam Saied's crew-console
// rule cards. General wellness guidance for a simulation, not medical advice; a doctor on Earth decides.
import type { Alert } from "./api";

export interface Cause { title: string; why: string; steps: string[] }

const HR_HIGH: Cause[] = [
  { title: "After exercise", why: "Pulse stays high for a while after a workout.", steps: ["Rest for 5 to 10 minutes.", "Drink water.", "Breathe slowly."] },
  { title: "Stress", why: "Mission pressure or a system fault raises pulse.", steps: ["Breathe 4 s in, 6 s out.", "Pause the task if it is safe.", "Tell the crew or Earth if it continues."] },
  { title: "Dehydration", why: "Low fluid makes the heart beat faster.", steps: ["Drink water now.", "Log today's fluid intake.", "Avoid caffeine for a few hours."] },
  { title: "Poor sleep", why: "Short or broken sleep raises resting pulse.", steps: ["Avoid caffeine for a few hours.", "Rest if the schedule allows.", "Report several short nights in a row."] },
  { title: "Space motion sickness", why: "Nausea and dizziness in the first days of microgravity.", steps: ["Keep your head still.", "Focus on a fixed point.", "Contact Earth if vomiting continues."] },
  { title: "Early fever", why: "A rising temperature can speed up the heart before other symptoms.", steps: ["Take your temperature if you can.", "Drink water and rest.", "Report above 38 °C."] },
];
const HR_LOW: Cause[] = [
  { title: "Resting state", why: "Pulse drops during deep rest or relaxation.", steps: ["Stand up and move slowly.", "Notice any dizziness.", "Report if dizziness continues."] },
  { title: "Cold or inactivity", why: "A cold module or long stillness can slow the pulse.", steps: ["Warm up and add a layer.", "Move lightly for a few minutes.", "Check your pulse again."] },
];
const SPO2_LOW: Cause[] = [
  { title: "Loose sensor", why: "A badly placed sensor can read lower than the real value.", steps: ["Re-seat the sensor on a clean, warm finger.", "Stay still for 30 s.", "Compare with a second reading."] },
  { title: "High CO₂ in the cabin", why: "CO₂ can build up in a poorly ventilated module, often with headache and drowsiness.", steps: ["Move to a well ventilated module.", "Check the cabin CO₂ reading.", "Report if the headache continues."] },
  { title: "Airway irritation", why: "Dust or dry air can irritate the airways.", steps: ["Drink water and breathe slowly.", "Check the air filters.", "Report coughing or breathing difficulty."] },
];

export function possibleCauses(a: Pick<Alert, "metric" | "value" | "baseline">, activity?: string): Cause[] {
  if (a.metric === "spo2") return SPO2_LOW;
  if (a.metric !== "heart_rate") return [];
  const low = a.baseline != null ? a.value < a.baseline : a.value <= 40;
  if (low) return HR_LOW;
  // a fast pulse during exercise is expected, so lead with the other causes at rest
  return activity === "exercise" ? HR_HIGH : HR_HIGH.filter((c) => c.title !== "After exercise").concat(HR_HIGH[0]);
}
