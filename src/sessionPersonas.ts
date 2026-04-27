import { formatStructuredOrderHistoryAppend, type PrototypeOrderRow } from "./orderHistoryFromShopping";

/**
 * Pre-filled “Tell Cai about this session” bundles for the gather step.
 * Each persona maps to the three blocks merged into the welcome / chat context bundle.
 */

const SUNNY_ORDER_HELP_ROWS: PrototypeOrderRow[] = [
  {
    id: "o1",
    orderNumber: "#9001001",
    summary:
      "Iams Proactive Health Healthy Aging Large Breed Adult Senior with Real Chicken Dry Dog Food, 30-lb bag, bundle of 2",
    status: "Delivered",
    placedAt: "2026-04-08T14:00:00.000Z",
  },
  {
    id: "o2",
    orderNumber: "#9001002",
    summary: "Greenies Aging Care Natural Large Dental Dog Treats, 17 count",
    status: "In transit",
    placedAt: "2026-04-15T14:00:00.000Z",
  },
  {
    id: "o3",
    orderNumber: "#9001003",
    summary: "Playology Pork Sausage Scented Dental Chew Ball Dog Toy, Medium",
    status: "Delivered",
    placedAt: "2026-04-19T18:00:00.000Z",
  },
];

const BUG_ORDER_HELP_ROWS: PrototypeOrderRow[] = [
  {
    id: "b1",
    orderNumber: "#8002001",
    summary: "Purina ONE Whole Body Support Chicken Dry Cat Food, 22-lb bag",
    status: "Delivered",
    placedAt: "2026-02-01T12:00:00.000Z",
  },
  {
    id: "b2",
    orderNumber: "#8002002",
    summary: "Tidy Cats Free & Clean Unscented Clumping Clay Cat Litter, 14-lb jug",
    status: "Processing",
    placedAt: "2026-04-10T10:00:00.000Z",
  },
  {
    id: "b3",
    orderNumber: "#8002003",
    summary: "NexGard COMBO Topical for Cats, 5.6-16.5 lbs. (Yellow Box), 6 Doses (6-mos. supply)",
    status: "Delivered",
    placedAt: "2025-12-20T10:00:00.000Z",
  },
  {
    id: "b4",
    orderNumber: "#8002004",
    summary: "Meow Mix Irresistibles White Meat Chicken Soft & Chewy Cat Treats, 12-oz bag",
    status: "Delivered",
    placedAt: "2026-04-08T10:00:00.000Z",
  },
  {
    id: "b5",
    orderNumber: "#8002005",
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
  shoppingHistory: string;
  /** When true, selecting this persona checks “Recent order (last 7 days)” to match the story. */
  recentOrderWithin7Days?: boolean;
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
    shoppingHistory: `Recent order history:

Iams Proactive Health Healthy Aging Large Breed Adult Senior with Real Chicken Dry Dog Food, 30-lb bag, bundle of 2
On Autoship, every 5 weeks

Greenies Aging Care Natural Large Dental Dog Treats, 17 count
On Autoship, every 5 weeks

Playology Pork Sausage Scented Dental Chew Ball Dog Toy, Medium
Purchased 3 days ago, delivered today

Recent browsing queries:
Orthopedic dog bed, Senior dog supplements
${formatStructuredOrderHistoryAppend(SUNNY_ORDER_HELP_ROWS)}`,
    recentOrderWithin7Days: true,
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
    shoppingHistory: `Recent order history:

Purina ONE Whole Body Support Chicken Dry Cat Food, 22-lb bag
On Autoship, every 4 months

Tidy Cats Free & Clean Unscented Clumping Clay Cat Litter, 14-lb jug
On Autoship, every 4 months

NexGard COMBO Topical for Cats, 5.6-16.5 lbs. (Yellow Box), 6 Doses (6-mos. supply)
On Autoship, every 6 months

Meow Mix Irresistibles White Meat Chicken Soft & Chewy Cat Treats, 12-oz bag
Purchased 2 weeks ago

Potaroma Crinkle Fish Cat Toys with Catnip, Multi-Color, 7.8-in, 3 count
Purchased 2 weeks ago

Recent browsing queries:
Cat scratching post, Adult cat food
${formatStructuredOrderHistoryAppend(BUG_ORDER_HELP_ROWS)}`,
  },
];

export const SESSION_PERSONA_CUSTOM = "custom";

export function getSessionPersona(id: string): SessionPersona | undefined {
  return SESSION_PERSONAS.find((p) => p.id === id);
}
