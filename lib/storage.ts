import { promises as fs } from "fs";
import path from "path";
import { getKv, isKvConfigured } from "@/lib/kv";
import type {
  Registration, RegistrationStatus,
  Country, Sponsor, RecapItem, PromoCode,
  EventSettings, FooterSettings, QuickLink
} from "@/lib/types";

// ─── why this file changed ────────────────────────────────────────────────────
// The previous version of this file read/wrote JSON files on the local disk
// (process.cwd()/data/*.json). That works on your own computer, but Vercel's
// production servers use a READ-ONLY filesystem — every write silently fails
// (or throws), so nothing you changed in the admin panel (countries, sponsors,
// promo codes, registrations, settings) was ever actually being saved once
// deployed. Locally it looked fine because your local disk IS writable.
//
// This version stores all data in Redis (Upstash, connected via the Vercel
// Marketplace) so writes actually persist between requests and deployments.
// The bundled data/*.json files are now only used as one-time "seed" data —
// read once to pre-populate Redis the first time each key is accessed, so you
// don't lose the content you already have.
// ────────────────────────────────────────────────────────────────────────────

const DATA = path.join(process.cwd(), "data");

async function readSeedFile<T>(fileName: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(path.join(DATA, fileName), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Read a value from Redis; if it has never been set, seed it from the bundled JSON file. */
async function readValue<T>(key: string, seedFile: string, fallback: T): Promise<T> {
  if (!isKvConfigured()) {
    // No database connected yet — fall back to read-only bundled data so the
    // site still renders something sensible instead of crashing.
    return readSeedFile<T>(seedFile, fallback);
  }
  const kv = getKv();
  const existing = await kv.get<T>(key);
  if (existing !== null && existing !== undefined) return existing;
  const seed = await readSeedFile<T>(seedFile, fallback);
  await kv.set(key, seed);
  return seed;
}

async function writeValue(key: string, data: unknown) {
  const kv = getKv(); // throws a clear error if no DB is connected — see lib/kv.ts
  await kv.set(key, data);
}

// ─── Event Settings ───────────────────────────────────────────────────────────
const defaultSettings: EventSettings = {
  eventName: "Global Village Street'26",
  eventDate: "2026-08-11",
  eventTime: "10:00",
  eventLocation: "Suez, Egypt",
  ticketPrice: 140,
  registrationOpen: true,
  maxRegistrations: 300,
  hero: { eventName: "Global Village Street'26", tagline: "One World. One Crew. One Vibe.", date: "11 August 2026", location: "Suez, Egypt" },
  footer: {
    socials: {},
    contact: { address: "Suez, Egypt" },
    quickLinks: [
      { id: "ql-1", label: "Home", href: "/", sortOrder: 1 },
      { id: "ql-2", label: "Countries", href: "#countries", sortOrder: 2 },
      { id: "ql-3", label: "Shows", href: "#shows", sortOrder: 3 },
      { id: "ql-4", label: "Tickets", href: "#tickets", sortOrder: 4 },
      { id: "ql-5", label: "Register", href: "/register", sortOrder: 5 },
      { id: "ql-6", label: "Track Registration", href: "/track", sortOrder: 6 },
    ],
  },
};

export async function getEventSettings(): Promise<EventSettings> {
  return readValue("event-settings", "event-settings.json", defaultSettings);
}
export async function saveEventSettings(settings: EventSettings) {
  await writeValue("event-settings", settings);
}

// ─── Registrations ────────────────────────────────────────────────────────────
export async function listRegistrations(): Promise<Registration[]> {
  return readValue<Registration[]>("registrations", "registrations.json", []);
}
async function writeRegistrations(regs: Registration[]) {
  await writeValue("registrations", regs);
}
export async function nextReferenceId() {
  const regs = await listRegistrations();
  const last = regs.map((r) => Number(r.referenceId.split("-").at(-1))).filter(Number.isFinite).sort((a, b) => b - a)[0];
  return `GV-2026-${String((last ?? 0) + 1).padStart(4, "0")}`;
}
export async function saveRegistration(reg: Registration) {
  const regs = await listRegistrations(); regs.push(reg); await writeRegistrations(regs); return reg;
}
export async function updateRegistration(referenceId: string, patch: Partial<Registration>) {
  const regs = await listRegistrations();
  const idx = regs.findIndex((r) => r.referenceId === referenceId);
  if (idx === -1) throw new Error("Registration not found");
  regs[idx] = { ...regs[idx], ...patch };
  await writeRegistrations(regs); return regs[idx];
}
export async function setRegistrationStatus(referenceId: string, status: RegistrationStatus, extra?: Partial<Registration>) {
  return updateRegistration(referenceId, { status, ...extra });
}
export async function getRegistrationCount() {
  return (await listRegistrations()).length;
}

// ─── Countries ────────────────────────────────────────────────────────────────
export async function listCountries(): Promise<Country[]> {
  const data = await readValue<Country[]>("countries", "countries.json", []);
  return data.sort((a, b) => a.sortOrder - b.sortOrder);
}
export async function saveCountry(country: Country) {
  const countries = await listCountries();
  const idx = countries.findIndex((c) => c.id === country.id);
  if (idx === -1) countries.push(country); else countries[idx] = country;
  await writeValue("countries", countries);
}
export async function deleteCountry(id: string) {
  const countries = await listCountries();
  await writeValue("countries", countries.filter((c) => c.id !== id));
}

// ─── Sponsors ─────────────────────────────────────────────────────────────────
export async function listSponsors(): Promise<Sponsor[]> {
  const data = await readValue<Sponsor[]>("sponsors", "sponsors.json", []);
  return data.sort((a, b) => a.sortOrder - b.sortOrder);
}
export async function listActiveSponsors(): Promise<Sponsor[]> {
  return (await listSponsors()).filter((s) => s.active);
}
export async function saveSponsor(sponsor: Sponsor) {
  const sponsors = await listSponsors();
  const idx = sponsors.findIndex((s) => s.id === sponsor.id);
  if (idx === -1) sponsors.push(sponsor); else sponsors[idx] = sponsor;
  await writeValue("sponsors", sponsors);
}
export async function deleteSponsor(id: string) {
  const sponsors = await listSponsors();
  await writeValue("sponsors", sponsors.filter((s) => s.id !== id));
}

// ─── Recap ────────────────────────────────────────────────────────────────────
export async function listRecapItems(): Promise<RecapItem[]> {
  const data = await readValue<RecapItem[]>("recap", "recap.json", []);
  return data.sort((a, b) => a.year - b.year || a.sortOrder - b.sortOrder);
}
export async function saveRecapItem(item: RecapItem) {
  const items = await listRecapItems();
  const idx = items.findIndex((r) => r.id === item.id);
  if (idx === -1) items.push(item); else items[idx] = item;
  await writeValue("recap", items);
}
export async function deleteRecapItem(id: string) {
  const items = await listRecapItems();
  await writeValue("recap", items.filter((r) => r.id !== id));
}

// ─── Promo Codes ──────────────────────────────────────────────────────────────
export async function listPromoCodes(): Promise<PromoCode[]> {
  return readValue<PromoCode[]>("promo-codes", "promo-codes.json", []);
}
export async function savePromoCode(code: PromoCode) {
  const codes = await listPromoCodes();
  const idx = codes.findIndex((c) => c.id === code.id);
  if (idx === -1) codes.push(code); else codes[idx] = code;
  await writeValue("promo-codes", codes);
}
export async function deletePromoCode(id: string) {
  const codes = await listPromoCodes();
  await writeValue("promo-codes", codes.filter((c) => c.id !== id));
}
export async function getPromoCodeByString(codeStr: string): Promise<PromoCode | null> {
  const codes = await listPromoCodes();
  const now = new Date();
  return codes.find((c) =>
    c.code === codeStr.toUpperCase() &&
    c.status === "Active" &&
    new Date(c.expirationDate) >= now &&
    (c.usageLimit === 0 || c.usageCount < c.usageLimit)
  ) ?? null;
}
export async function getPromoCodeDiscount(codeStr: string): Promise<number> {
  return (await getPromoCodeByString(codeStr))?.discountAmount ?? 0;
}
export async function incrementPromoUsage(codeStr: string) {
  const codes = await listPromoCodes();
  const found = codes.find((c) => c.code === codeStr.toUpperCase());
  if (!found) return;
  found.usageCount += 1;
  if (found.usageLimit > 0 && found.usageCount >= found.usageLimit) found.status = "Disabled";
  await writeValue("promo-codes", codes);
}
