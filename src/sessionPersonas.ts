import { formatStructuredOrderHistoryAppend, type PrototypeOrderRow } from "./orderHistoryFromShopping";

/**
 * Pre-filled “Tell Cai about this session” bundles for the gather step.
 * Each persona maps to pet parent, pet, order history, and browsing history (welcome / chat context bundle).
 */

const SUNNY_ORDER_HELP_ROWS: PrototypeOrderRow[] = [
  {
    id: "o1",
    orderNumber: "#7309518462",
    summary: "https://www.chewy.com/iams-proactive-health-healthy-aging/dp/46729",
    status: "Delivered",
    placedAt: "2026-04-27T12:00:00.000Z",
    deliveredAt: "2026-04-30T12:00:00.000Z",
    autoship: true,
    meta: "On Autoship",
  },
  {
    id: "o2",
    orderNumber: "#5918374065",
    summary: "https://www.chewy.com/greenies-aging-care-large-dental-dog/dp/183796",
    status: "Delivered",
    placedAt: "2026-04-14T12:00:00.000Z",
    deliveredAt: "2026-04-17T12:00:00.000Z",
    autoship: true,
    meta: "On Autoship",
  },
  {
    id: "o3",
    orderNumber: "#4826193750",
    summary: "https://www.chewy.com/playology-all-natural-pork-sausage/dp/348131",
    status: "Delivered",
    placedAt: "2026-03-22T12:00:00.000Z",
    deliveredAt: "2026-03-25T12:00:00.000Z",
    autoship: false,
  },
];

const BUG_ORDER_HELP_ROWS: PrototypeOrderRow[] = [
  {
    id: "b1",
    orderNumber: "#8473920156",
    summary: "https://www.chewy.com/purina-one-whole-body-support-chicken/dp/3730174",
    status: "Delivered",
    placedAt: "2026-04-27T12:00:00.000Z",
    deliveredAt: "2026-04-29T12:00:00.000Z",
    autoship: true,
    meta: "On Autoship",
  },
  {
    id: "b2",
    orderNumber: "#9284710365",
    summary: "https://www.chewy.com/tidy-cats-free-clean-unscented/dp/168308",
    status: "Delivered",
    placedAt: "2026-04-27T14:00:00.000Z",
    deliveredAt: "2026-04-29T12:00:00.000Z",
    autoship: true,
    meta: "On Autoship",
  },
  {
    id: "b3",
    orderNumber: "#5568291730",
    summary: "https://www.chewy.com/nexgard-combo-topical-cats-56-165-lbs/dp/851790",
    status: "Delivered",
    placedAt: "2026-02-12T12:00:00.000Z",
    deliveredAt: "2026-02-18T12:00:00.000Z",
    autoship: true,
    meta: "On Autoship",
  },
  {
    id: "b4",
    orderNumber: "#6928475103",
    summary: "https://www.chewy.com/meow-mix-irresistibles-white-meat/dp/986838",
    status: "Delivered",
    placedAt: "2026-03-22T12:00:00.000Z",
    deliveredAt: "2026-03-24T12:00:00.000Z",
    autoship: false,
  },
  {
    id: "b5",
    orderNumber: "#3819264750",
    summary: "https://www.chewy.com/potaroma-crinkle-fish-cat-toys-catnip/dp/2277670",
    status: "Delivered",
    placedAt: "2026-03-18T12:00:00.000Z",
    deliveredAt: "2026-03-20T12:00:00.000Z",
    autoship: false,
  },
];

export type SessionPersona = {
  id: string;
  /** Short label in the persona picker. */
  title: string;
  parentProfile: string;
  petProfile: string;
  /** Order bundle string with `### Structured order history (prototype)` (from `formatStructuredOrderHistoryAppend`). */
  orderHistory: string;
  /** Browsing / search / category signals (non-order). */
  browsingHistory: string;
};

export const SESSION_PERSONAS: SessionPersona[] = [
  {
    id: "sunny-senior",
    title: "Sunny - Senior, mixed-breed dog",
    parentProfile: `Name: Marco
Location: Plantation, FL
Chewy customer: Yes, 10 months
Pet profile: Yes, 1 dog
Chewy+: No`,
    petProfile: `Pet type: Dog
Pet name: Sunny
Breed: American Pit Bull Terrier/Labrador Retriever mix
Age: 12 years
Weight: 74 lbs
Health Conditions: Diabetes
Allergies: Dust mites
Medications: None`,
    orderHistory: formatStructuredOrderHistoryAppend(SUNNY_ORDER_HELP_ROWS).replace(/^\n+/, ""),
    browsingHistory: `Orthopedic dog bed, senior dog supplements`,
  },
  {
    id: "bug-himalayan-cat",
    title: "Bug - Adult, Himalayan cat",
    parentProfile: `Name: Jennifer
Location: Calabasas, CA
Chewy customer: Yes, 4 years
Pet profile: Yes, 1 cat
Chewy+: Yes`,
    petProfile: `Pet type: Cat
Pet name: Bug
Breed: Himalayan
Age: 6 years
Weight: 10 lbs
Health conditions: none
Allergies: none
Prescriptions: NexGuard
Veterinary clinic: Pacific Coast Veterinary Specialists`,
    orderHistory: formatStructuredOrderHistoryAppend(BUG_ORDER_HELP_ROWS).replace(/^\n+/, ""),
    browsingHistory: `Cat scratching post, adult cat food`,
  },
];

export const SESSION_PERSONA_CUSTOM = "custom";

export function getSessionPersona(id: string): SessionPersona | undefined {
  return SESSION_PERSONAS.find((p) => p.id === id);
}
