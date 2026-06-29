import type { BlogTemplate, TemplateKey } from "./types";

/**
 * Ready-made SEO post templates. Each pre-fills a sensible heading structure
 * (h2/h3 — the post title is the page's only h1) plus inline guidance the team
 * can overwrite. Body is plain HTML compatible with the Tiptap editor schema.
 */
export const BLOG_TEMPLATES: BlogTemplate[] = [
  {
    key: "how-to",
    name: "How-To / Tutorial",
    description: "Step-by-step guide that answers a specific “how do I…” question.",
    excerptHint:
      "One sentence on what the reader will be able to do by the end (≈150–160 characters).",
    body: `<h2>What you'll need</h2>
<p>List any prerequisites, tools, or accounts the reader needs before starting.</p>
<h2>Step 1: Start here</h2>
<p>Explain the first action clearly. Keep each step to one idea.</p>
<h2>Step 2: Keep going</h2>
<p>Describe the next step. Add a screenshot or image where it helps.</p>
<h2>Step 3: Finish up</h2>
<p>Wrap up the final step and what success looks like.</p>
<h2>Troubleshooting</h2>
<p>Common problems and how to fix them.</p>
<h2>Summary</h2>
<p>Recap what the reader accomplished and a suggested next step.</p>`,
  },
  {
    key: "listicle",
    name: "Listicle (Top N …)",
    description: "A ranked or grouped list — “Top 7 …”, “10 best …”.",
    excerptHint:
      "Tease the list and the payoff. Include the number (e.g. “7 …”).",
    body: `<h2>Introduction</h2>
<p>Set up why this list matters and who it's for.</p>
<h2>1. First item</h2>
<p>Describe the first item and why it earns its place.</p>
<h2>2. Second item</h2>
<p>Describe the second item.</p>
<h2>3. Third item</h2>
<p>Describe the third item.</p>
<h2>How to choose</h2>
<p>Help the reader decide which option fits them.</p>
<h2>Conclusion</h2>
<p>Summarize and point to a clear next step.</p>`,
  },
  {
    key: "comparison",
    name: "Comparison / “X vs Y”",
    description: "Head-to-head comparison to help readers choose between options.",
    excerptHint:
      "State what's being compared and who each option suits best.",
    body: `<h2>Overview</h2>
<p>Briefly introduce both options and the decision the reader faces.</p>
<h2>X at a glance</h2>
<p>Key strengths and weaknesses of the first option.</p>
<h2>Y at a glance</h2>
<p>Key strengths and weaknesses of the second option.</p>
<h2>Head-to-head</h2>
<h3>Pricing</h3>
<p>Compare on price.</p>
<h3>Features</h3>
<p>Compare on features.</p>
<h3>Ease of use</h3>
<p>Compare on usability.</p>
<h2>Which should you choose?</h2>
<p>Give a clear recommendation for each type of reader.</p>`,
  },
  {
    key: "review",
    name: "Product / Service Review",
    description: "An honest, first-hand review with a verdict.",
    excerptHint:
      "Name the product and your one-line verdict.",
    body: `<h2>What it is</h2>
<p>Introduce the product or service and what it promises.</p>
<h2>Who it's for</h2>
<p>Describe the ideal user.</p>
<h2>What we liked</h2>
<p>The strongest points, ideally from first-hand use.</p>
<h2>What could be better</h2>
<p>Honest drawbacks and limitations.</p>
<h2>Pricing</h2>
<p>What it costs and whether it's good value.</p>
<h2>Verdict</h2>
<p>Your bottom-line recommendation.</p>`,
  },
  {
    key: "news",
    name: "News / Update",
    description: "A timely announcement or industry update.",
    excerptHint:
      "Summarize the news in one sentence — what changed and why it matters.",
    body: `<h2>What happened</h2>
<p>Lead with the most important fact. Answer the question up front.</p>
<h2>Why it matters</h2>
<p>Explain the impact for your readers.</p>
<h2>The details</h2>
<p>Add context, background, and any relevant figures.</p>
<h2>What's next</h2>
<p>What readers should expect or do now.</p>`,
  },
  {
    key: "generic",
    name: "Generic Article",
    description: "A flexible structure for any topic.",
    excerptHint:
      "Summarize the article's main takeaway in ≈150–160 characters.",
    body: `<h2>Introduction</h2>
<p>Introduce the topic and what the reader will learn.</p>
<h2>Main point</h2>
<p>Develop your core idea with supporting detail.</p>
<h2>Supporting point</h2>
<p>Add evidence, examples, or images.</p>
<h2>Conclusion</h2>
<p>Summarize and give the reader a clear next step.</p>`,
  },
];

const TEMPLATE_MAP = new Map<TemplateKey, BlogTemplate>(
  BLOG_TEMPLATES.map((t) => [t.key, t]),
);

export function getTemplate(key: TemplateKey): BlogTemplate {
  return TEMPLATE_MAP.get(key) ?? BLOG_TEMPLATES[BLOG_TEMPLATES.length - 1];
}
