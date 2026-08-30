/**
 * Go-live size: 1 theatre, 40 studios, 3000 members.
 * One evening beat, 40 stops. Not 10k orders. Not one cart.
 */
export const THEATRE = {
  id: "rajputana",
  name: "Rajputana Theatre",
  hub: "Sukh Store · Theatre North",
  area: "Theatre North",
  slot: "17:00"
};

export const STUDIO_COUNT = 40;
export const MEMBER_COUNT = 3000;
export const MEMBERS_PER_STUDIO = MEMBER_COUNT / STUDIO_COUNT;
export const BEAT_BAGS_PER_STOP = 5;

const STUDIO_NAMES = [
  "Ompal", "Shiv Kumar", "Ram Bhatari", "Jaswant Singh", "Vansh",
  "Kamala Devi", "Rekha Yadav", "Pradip Yadav", "Bal Kishan 01", "Binu",
  "Kaushlya", "Praveen", "Azad Singh", "Parul Yadav", "Bala Devi",
  "Narender", "Gulshan Yadav", "Subash Yadav", "Ravinder Yadav", "Naveen",
  "Rajender Kumar", "Dhanesh Kumar", "Kanwal Kumar", "Sunita Devi", "Bal Kishan 02",
  "Ankit Rao", "Ved Road 01", "Ved Road 02", "North Hall", "East Hall",
  "West Hall", "Gate 3", "Bunk 12", "Bunk 18", "Mess North",
  "Mess East", "Yard", "Terrace", "Back lane", "Office nest"
];

export function buildStudios() {
  return STUDIO_NAMES.slice(0, STUDIO_COUNT).map((name, i) => {
    const n = String(i + 1).padStart(2, "0");
    return {
      id: "S" + n,
      seq: i + 1,
      name: "Nia Nest " + name,
      theatre: THEATRE.id,
      theatreName: THEATRE.name,
      hub: THEATRE.hub,
      area: THEATRE.area,
      slot: THEATRE.slot
    };
  });
}

const FIRST = ["Ravi", "Priya", "Amit", "Lakshmi", "Suresh", "Kiran", "Deepa", "Arun", "Meena", "Vijay"];

export function buildMembers(studios) {
  const out = new Array(MEMBER_COUNT);
  for (let i = 0; i < MEMBER_COUNT; i++) {
    const studio = studios[Math.floor(i / MEMBERS_PER_STUDIO)];
    const n = String(i + 1).padStart(4, "0");
    const named = i < 5;
    const name = named ? FIRST[i] : FIRST[i % FIRST.length] + " " + n;
    const memberId = named ? FIRST[i].toLowerCase() : "m" + n;
    out[i] = {
      memberId,
      name,
      studioId: studio.id,
      nest: studio.name,
      hub: THEATRE.hub,
      theatre: THEATRE.id,
      hasMira: i % 7 === 0,
      friday_send: i % 11 === 0 ? "sent" : "pending",
      last_bag: i % 5 === 0 ? "2026-08-28" : "",
      last_mira: i % 7 === 0 ? "2026-08-27" : ""
    };
  }
  return out;
}

export function codeFor(stopId, kind, seq) {
  if (stopId === "S01" && kind === "R" && seq === 1) return "S1HOLD";
  return (stopId + kind + seq).slice(0, 8);
}

export function kindLetter(status) {
  if (status === "collected") return "C";
  if (status === "missed") return "M";
  if (status === "packed") return "P";
  if (status === "loaded") return "L";
  if (status === "at_stop") return "A";
  return "R";
}
