/**
 * Smoke tests for ```cai-products``` parsing (no test runner required).
 * Run: npm run smoke:products
 */
import { parseAssistantMessage, stripCaiStructuredFences } from "../src/chatUtils.ts";

const JSON_INNER = `{"layout":"category_options","heading":"Scratching Posts for Bug","items":[{"title":"Catit Vesper V-High Base Cat Tree","subtitle":"Stylish design with scratching surfaces","categoryLabel":"Tree"},{"title":"PetFusion Ultimate Cat Scratcher Lounge","subtitle":"Multi-functional and great for lounging","categoryLabel":"Lounge"},{"title":"Frisco Cat Scratching Post with Base","subtitle":"Sturdy and great for scratching","categoryLabel":"Post"}]}`;

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function runCase(name: string, content: string, expectChipCount = 0) {
  const p = parseAssistantMessage(content);
  assert(p.products !== null, `${name}: expected products block`);
  assert(p.products!.layout === "category_options", `${name}: layout`);
  assert(p.products!.items.length === 3, `${name}: item count`);
  assert(p.products!.heading === "Scratching Posts for Bug", `${name}: heading`);
  assert(!p.body.includes("```"), `${name}: body must not contain fence backticks`);
  assert(!p.body.includes("cai-products"), `${name}: body must not contain cai-products token`);
  if (expectChipCount > 0) {
    assert(p.chips.length === expectChipCount, `${name}: chips count ${p.chips.length} !== ${expectChipCount}`);
  }
  // eslint-disable-next-line no-console -- smoke script
  console.log(`ok  ${name}`);
}

function main() {
  runCase(
    "canonical",
    `\`\`\`cai-products\n${JSON_INNER}\n\`\`\`\n\nHere is why these fit Bug.\n\nCHIPS: Trees | Lounges | Posts`,
    3,
  );

  runCase(
    "ASCII-quoted full reply",
    `"\`\`\`cai-products\n${JSON_INNER}\n\`\`\`\n\nWhy copy.\n\nCHIPS: A | B | C"`,
    3,
  );

  runCase(
    "curly-quoted full reply",
    `\u201C\`\`\`cai-products\n${JSON_INNER}\n\`\`\`\n\nWhy copy.\n\nCHIPS: A | B | C\u201D`,
    3,
  );

  runCase("space after backticks", `   \`\`\` cai-products\n${JSON_INNER}\n\`\`\``, 0);

  runCase("language suffix", `\`\`\`cai-products json\n${JSON_INNER}\n\`\`\``, 0);

  runCase("case variant tag", `\`\`\`Cai-Products\n${JSON_INNER}\n\`\`\``, 0);

  runCase(
    "ZWSP inside",
    `\u200B\`\`\`cai-products\n${JSON_INNER}\n\`\`\`\u200B`,
    0,
  );

  const stripped = stripCaiStructuredFences(`Welcome\n\n\`\`\`cai-products\n${JSON_INNER}\n\`\`\``);
  assert(!stripped.includes("cai-products"), "stripCaiStructuredFences should remove fence");
  assert(!stripped.includes("Catit"), "stripCaiStructuredFences should remove JSON body");

  // eslint-disable-next-line no-console -- smoke script
  console.log("ok  stripCaiStructuredFences");
  // eslint-disable-next-line no-console -- smoke script
  console.log("smoke-product-parsing: all passed");
}

main();
