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
    autoship: true,
    meta: "On Autoship — Expected delivery: Wed, Apr 29",
  },
  {
    id: "o2",
    orderNumber: "#5918374065",
    summary: "https://www.chewy.com/greenies-aging-care-large-dental-dog/dp/183796",
    status: "Delivered",
    placedAt: "2026-04-14T12:00:00.000Z",
    autoship: true,
    meta: "On Autoship — Expected delivery: Fri, Apr 17",
  },
  {
    id: "o3",
    orderNumber: "#4826193750",
    summary: "https://www.chewy.com/playology-all-natural-pork-sausage/dp/348131",
    status: "Delivered",
    placedAt: "2026-03-22T12:00:00.000Z",
    autoship: false,
    meta: "Expected delivery: Tue, Mar 24",
  },
];

const BUG_ORDER_HELP_ROWS: PrototypeOrderRow[] = [
  {
    id: "b1",
    orderNumber: "#9271503846",
    summary: "Purina ONE Whole Body Support Chicken Dry Cat Food, 22-lb bag",
    status: "Delivered",
    placedAt: "2026-02-01T12:00:00.000Z",
    autoship: true,
  },
  {
    id: "b2",
    orderNumber: "#3649281750",
    summary: "Tidy Cats Free & Clean Unscented Clumping Clay Cat Litter, 14-lb jug",
    status: "Processing",
    placedAt: "2026-04-10T10:00:00.000Z",
    autoship: true,
  },
  {
    id: "b3",
    orderNumber: "#8150394762",
    summary: "NexGard COMBO Topical for Cats, 5.6-16.5 lbs. (Yellow Box), 6 Doses (6-mos. supply)",
    status: "Delivered",
    placedAt: "2025-12-20T10:00:00.000Z",
    autoship: true,
  },
  {
    id: "b4",
    orderNumber: "#6492730158",
    summary: "Meow Mix Irresistibles White Meat Chicken Soft & Chewy Cat Treats, 12-oz bag",
    status: "Delivered",
    placedAt: "2026-04-08T10:00:00.000Z",
  },
  {
    id: "b5",
    orderNumber: "#5038264971",
    summary: "Potaroma Crinkle Fish Cat Toys with Catnip, Multi-Color, 7.8-in, 3 count",
    status: "Delivered",
    placedAt: "2026-04-08T10:00:00.000Z",
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
    browsingHistory: `Recent browsing (simulated):

Orthopedic dog bed, senior dog supplements`,
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
Prescriptions: NexGuard`,
    orderHistory: formatStructuredOrderHistoryAppend(BUG_ORDER_HELP_ROWS).replace(/^\n+/, ""),
    browsingHistory: `Recent browsing (simulated):

Cat scratching post, adult cat food`,
  },
];

export const SESSION_PERSONA_CUSTOM = "custom";

export function getSessionPersona(id: string): SessionPersona | undefined {
  return SESSION_PERSONAS.find((p) => p.id === id);
}
