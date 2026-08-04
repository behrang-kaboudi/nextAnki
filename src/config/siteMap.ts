export type SiteMapPage = {
  title: string;
  path: string;
  summary: string;
  menu: boolean;
};

export type SiteMapGroup = {
  id: string;
  category: "Information" | "Workspace" | "Administration" | "Tests" | "Account";
  title: string;
  summary: string;
  pages: SiteMapPage[];
};

/**
 * Human-readable inventory of canonical UI routes.
 *
 * Keep this file in sync whenever a page is added, moved, renamed, or removed.
 * Legacy redirect-only URLs belong in next.config.ts, not in this map.
 */
export const siteMapGroups: SiteMapGroup[] = [
  {
    id: "information",
    category: "Information",
    title: "Information",
    summary: "Entry points, product context, documentation, and project guidance.",
    pages: [
      { title: "Home", path: "/", summary: "Introduces Anki Bridge and links to the most common workflows.", menu: true },
      { title: "Features", path: "/features", summary: "Describes the product capabilities and intended Anki workflows.", menu: true },
      { title: "Guides", path: "/guides", summary: "Collects practical instructions and quick links for recurring tasks.", menu: true },
      { title: "Documentation", path: "/docs", summary: "Shows the project roadmap and documentation entry points.", menu: true },
      { title: "Site Map", path: "/site-map", summary: "Explains what every canonical page does and where it lives.", menu: true },
      { title: "About", path: "/about", summary: "Summarizes the purpose and technical foundation of Anki Bridge.", menu: true },
    ],
  },
  {
    id: "words",
    category: "Workspace",
    title: "Words",
    summary: "Create, enrich, review, and maintain vocabulary records.",
    pages: [
      { title: "Word Editor", path: "/words/editor", summary: "Searches vocabulary records and opens them for detailed editing.", menu: true },
      { title: "Word Details", path: "/words/editor/:id", summary: "Edits all fields, hints, and media for one vocabulary record.", menu: false },
      { title: "Persian Word Table", path: "/words/tables/persian-words", summary: "Browses and edits PersianWord records, including linked audio playback.", menu: true },
      { title: "Word Extraction", path: "/words/extraction", summary: "Runs the staged workflow that extracts and enriches words with AI prompts.", menu: true },
      { title: "Audio Hints", path: "/words/hints/audio", summary: "Reviews, generates, uploads, and cleans audio stored on word fields.", menu: true },
      { title: "JSON Hints", path: "/words/hints/json", summary: "Reviews and generates structured JSON hints for vocabulary records.", menu: true },
      { title: "Word Cleanup", path: "/words/cleanup", summary: "Finds and removes local words that no longer exist in Anki.", menu: true },
    ],
  },
  {
    id: "sentences",
    category: "Workspace",
    title: "Sentences",
    summary: "Review and edit sentence content used by vocabulary and Anki cards.",
    pages: [
      { title: "Sentence Editor", path: "/sentences/editor", summary: "Edits sentence text, Persian meaning, and related audio fields.", menu: true },
    ],
  },
  {
    id: "anki-cards",
    category: "Workspace",
    title: "Anki Cards",
    summary: "Manage study candidates, card placement, suspension, and card state.",
    pages: [
      { title: "Card Manager", path: "/anki/cards/manager", summary: "Finds Anki notes and manages their matching cards and study state.", menu: true },
      { title: "Add Cards for Study", path: "/anki/cards/study", summary: "Selects suitable words and adds their cards to the study workflow.", menu: true },
      { title: "Transfer Cards", path: "/anki/cards/transfer", summary: "Moves matching card types for a note from one Anki deck to another.", menu: true },
      { title: "Reset Equivalent Cards", path: "/anki/cards/reset", summary: "Reviews and resets equivalent English-to-Persian and Persian-to-English cards.", menu: true },
      { title: "Suspension Manager", path: "/anki/cards/suspensions", summary: "Finds and manages suspended Anki cards.", menu: true },
      { title: "Knowing Filter Manager", path: "/anki/cards/knowing-filter", summary: "Browses and manages cards in knowing-filter decks and tags.", menu: true },
    ],
  },
  {
    id: "anki-setup",
    category: "Workspace",
    title: "Anki Setup",
    summary: "Configure the Anki connection, structure, and one-time migrations.",
    pages: [
      { title: "Connection", path: "/anki/connection", summary: "Shows AnkiConnect settings, prerequisites, and the planned connection flow.", menu: true },
      { title: "Structure Builder", path: "/anki/structure", summary: "Inspects and creates required decks, note types, templates, and deck settings.", menu: true },
      { title: "Migrations", path: "/anki/migrations", summary: "Runs one-time Anki data migrations and displays their execution logs.", menu: true },
    ],
  },
  {
    id: "anki-synchronization",
    category: "Workspace",
    title: "Anki Synchronization",
    summary: "Run and monitor the primary synchronization workflow between local word data and Anki.",
    pages: [
      { title: "Anki Word Sync", path: "/anki/sync/words", summary: "Synchronizes word fields, media, identifiers, and complete word records with Anki.", menu: true },
    ],
  },
  {
    id: "ipa",
    category: "Workspace",
    title: "IPA Tools",
    summary: "Maintain pronunciation keywords, phrase matching, and picture-word media.",
    pages: [
      { title: "IPA Keywords", path: "/ipa/keywords", summary: "Manages IPA keyword mappings and their Persian-friendly forms.", menu: true },
      { title: "Phrase Builder", path: "/ipa/phrase-builder", summary: "Explores word-to-character phrase matches used to build pronunciation hints.", menu: true },
      { title: "Picture Words", path: "/ipa/picture-words", summary: "Maintains visual keyword associations used in pronunciation learning.", menu: true },
      { title: "Picture Word Audio", path: "/ipa/picture-words/audio", summary: "Records, uploads, lists, and removes audio for picture words.", menu: true },
    ],
  },
  {
    id: "ai",
    category: "Workspace",
    title: "AI Tools",
    summary: "Build and inspect reusable prompt files for AI-assisted workflows.",
    pages: [
      { title: "Prompt Builder", path: "/ai/prompt-builder", summary: "Combines prompt files and previews the resulting reusable AI prompt.", menu: true },
    ],
  },
  {
    id: "administration",
    category: "Administration",
    title: "Administration",
    summary: "Manage application data, navigation, and database comparisons.",
    pages: [
      { title: "Data Manager", path: "/admin/data", summary: "Browses Prisma models and performs controlled record management operations.", menu: true },
      { title: "Database Compare", path: "/admin/database-compare", summary: "Compares local database fingerprints with the version stored in GitHub.", menu: true },
      { title: "Navigation Manager", path: "/admin/navigation", summary: "Edits the nested site and dashboard menus from one interface.", menu: true },
    ],
  },
  {
    id: "tests-ai",
    category: "Tests",
    title: "AI Tests",
    summary: "Small pages for checking AI integrations in isolation.",
    pages: [
      { title: "AI Chat Test", path: "/tests/ai/chat", summary: "Sends test conversations through the configured AI chat endpoint.", menu: true },
    ],
  },
  {
    id: "tests-anki",
    category: "Tests",
    title: "Anki Tests",
    summary: "Inspect low-level AnkiConnect behavior and review history.",
    pages: [
      { title: "AnkiConnect Playground", path: "/tests/anki/connection", summary: "Calls AnkiConnect actions directly and displays their raw responses.", menu: true },
      { title: "Anki Review Log", path: "/tests/anki/review-log", summary: "Displays AnkiDroid review-log data returned for selected cards.", menu: true },
    ],
  },
  {
    id: "tests-editors",
    category: "Tests",
    title: "Editor Tests",
    summary: "Exercise rich-text editor behavior without changing production workflows.",
    pages: [
      { title: "Editor Test", path: "/tests/editors/basic", summary: "Provides a focused test surface for the shared rich-text editor.", menu: true },
      { title: "Editor Demo", path: "/tests/editors/demo", summary: "Demonstrates editor features with a fuller example configuration.", menu: true },
    ],
  },
  {
    id: "tests-ipa",
    category: "Tests",
    title: "IPA Tests",
    summary: "Inspect and repair IPA normalization data.",
    pages: [
      { title: "IPA Word Test", path: "/tests/ipa/words", summary: "Lists special IPA word records and runs normalization backfills.", menu: true },
    ],
  },
  {
    id: "tests-sync",
    category: "Tests",
    title: "Sync Tests",
    summary: "Exercise the sentence-card synchronization test workflow.",
    pages: [
      { title: "Sentence Card Sync", path: "/tests/sync/sentence-cards", summary: "Ensures sentence decks and synchronizes selected or all sentence cards.", menu: true },
    ],
  },
  {
    id: "tests-words",
    category: "Tests",
    title: "Word Tests",
    summary: "Run temporary or destructive vocabulary maintenance checks.",
    pages: [
      { title: "Sentence Fields", path: "/tests/words/sentence-fields", summary: "Temporarily reviews and updates sentence fields stored on word records.", menu: true },
      { title: "Clear Word Fields", path: "/tests/words/clear-fields", summary: "Clears selected word fields through a dedicated maintenance endpoint.", menu: true },
    ],
  },
  {
    id: "tests-utilities",
    category: "Tests",
    title: "Test Utilities",
    summary: "Shared samples and utilities used while developing test pages.",
    pages: [
      { title: "Tests Hub", path: "/tests", summary: "Searches and opens every internal test and development page.", menu: true },
      { title: "Test Functions", path: "/tests/functions", summary: "Demonstrates the reusable server-side test function helpers.", menu: true },
    ],
  },
  {
    id: "account",
    category: "Account",
    title: "Account and Authentication",
    summary: "Sign in, register, recover access, and inspect the active account.",
    pages: [
      { title: "Account", path: "/account", summary: "Shows the signed-in user and provides the sign-out action.", menu: true },
      { title: "Sign In", path: "/login", summary: "Authenticates an existing user and returns them to their requested page.", menu: true },
      { title: "Register", path: "/register", summary: "Creates a new user account and starts the sign-in flow.", menu: true },
      { title: "Forgot Password", path: "/forgot-password", summary: "Requests a password-reset email for an existing account.", menu: false },
      { title: "Reset Password", path: "/reset-password", summary: "Sets a new password using a valid reset token.", menu: false },
    ],
  },
];

export const testSiteMapGroups = siteMapGroups.filter((group) => group.category === "Tests");
