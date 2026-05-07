import { extractPetCallingName } from "./chatUtils";
import type { GatherOrderField } from "./gatherOrderForm";

export type ChatHistoryListItem = {
  id: string;
  /** e.g. "March 7" */
  dateLabel: string;
  title: string;
};

function inferPetSpecies(petProfile: string): "cat" | "dog" | "other" {
  const t = (petProfile ?? "").toLowerCase();
  if (/\b(cat|cats|kitten|kittens|feline|tabby|shorthair|calico|siamese)\b/.test(t)) return "cat";
  if (/\b(dog|dogs|puppy|puppies|canine|lab|retriever|hound|shepherd)\b/.test(t)) return "dog";
  return "other";
}

/** Fake order id for demo copy when gather rows have no long digit string. */
function demoOrderDigits(rows: GatherOrderField[]): string {
  const link = rows.map((r) => r.productOrLink).find((s) => /\/dp\/\d+/.test(s));
  const m = link?.match(/\/dp\/(\d+)/);
  if (m?.[1] && m[1].length >= 6) return m[1];
  return "1234567890";
}

/**
 * Prototype-only seeded rows when “First-time experience with Cai” is off — personalized from gather context.
 * Figma reference: 3426:77197 Chat history sheet.
 */
export function buildPersonalizedMockChatHistory(
  petProfile: string,
  orderRows: GatherOrderField[],
): ChatHistoryListItem[] {
  const pet = extractPetCallingName(petProfile);
  const species = inferPetSpecies(petProfile);
  const orderRef = demoOrderDigits(orderRows);

  const t1 =
    species === "cat"
      ? `Treat ideas for ${pet}`
      : species === "dog"
        ? "Suggestions for dog collars"
        : `Product picks for ${pet}`;

  const t2 =
    species === "dog"
      ? "Help with puppy biting"
      : `Help with ${pet} (training, products, etc.)`;

  const t3 = `Return of order #${orderRef}`;
  const t4 =
    species === "cat"
      ? `Suggestions for grain-free cat treats`
      : "Suggestions for grain-free dog treats";

  return [
    { id: "mock-march-7", dateLabel: "March 7", title: t1 },
    { id: "mock-apr-15", dateLabel: "April 15", title: t2 },
    { id: "mock-apr-22", dateLabel: "April 22", title: t3 },
    { id: "mock-apr-28", dateLabel: "April 28", title: t4 },
  ];
}

export function titleFromArchivedMessages(userLines: string[]): string {
  const first = userLines.find((s) => s.trim());
  if (!first) return "Previous chat";
  const t = first.trim();
  return t.length > 52 ? `${t.slice(0, 49)}…` : t;
}

export function formatHistoryMonthDay(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}
