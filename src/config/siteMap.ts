export type SiteMapPage = {
  title: string;
  path: string;
  summary: string;
  menu: boolean;
};

export type SiteMapGroup = {
  id: string;
  category: "Information" | "Workspace" | "Administration" | "Less Used" | "Tests" | "Account";
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
      { title: "WordSense Editor", path: "/words/editor", summary: "Searches vocabulary records and opens them for detailed editing.", menu: true },
      { title: "WordSense Details", path: "/words/editor/:id", summary: "Edits all fields, hints, and media for one WordSense record.", menu: false },
      { title: "Word Tables", path: "/words/tables", summary: "Opens the five primary vocabulary tables and explains how their records connect.", menu: true },
      { title: "WordSense Table", path: "/words/tables/words", summary: "Browses WordSense records with search, sorting, and direct editing.", menu: true },
      { title: "Persian Word Table", path: "/words/tables/persian-words", summary: "Browses and edits PersianWord records, including linked audio playback.", menu: true },
      { title: "English Word Table", path: "/words/tables/english-words", summary: "Browses canonical English words and phrases with US IPA, JSON hints, one audio file, and WordSense links.", menu: true },
      { title: "Sentence Table", path: "/words/tables/sentences", summary: "Browses and edits unique sentences, Persian meanings, and both persisted sentence-owned audio files.", menu: true },
      { title: "WordSenseStory Table", path: "/words/tables/stories", summary: "Browses reviewed mnemonic stories with their exact WordSense, sound symbols, sentence anchor, version, and owned audio.", menu: true },
    ],
  },
  {
    id: "word-extraction",
    category: "Workspace",
    title: "Word Extraction",
    summary: "Create new vocabulary records or complete selected fields on existing records with AI-assisted workflows.",
    pages: [
      { title: "Overview", path: "/words/extraction", summary: "Explains the two extraction workflows and routes users to the appropriate one.", menu: true },
      { title: "New Word Intake", path: "/words/extraction/new", summary: "Cleans raw words and meanings, generates example sentences and translations, and creates new vocabulary records.", menu: true },
      { title: "Legacy Word Extraction", path: "/words/extraction/legacy", summary: "Preserves the previous new-word extraction workflow for comparison while its replacement is being designed.", menu: false },
      { title: "Custom Word Extraction", path: "/words/extraction/custom", summary: "Completes selected missing fields on existing WordSense records using configurable input context and AI outputs.", menu: true },
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
      { title: "Reset Equivalent Cards", path: "/anki/cards/reset", summary: "Reviews and resets equivalent English-to-Persian and Persian-to-English cards.", menu: true },
      { title: "Knowing Filter Manager", path: "/anki/cards/knowing-filter", summary: "Browses and manages cards in knowing-filter decks and tags.", menu: true },
    ],
  },
  {
    id: "anki-setup",
    category: "Workspace",
    title: "Anki Setup",
    summary: "Configure the primary Anki deck, note-type, template, and settings structure.",
    pages: [
      { title: "Structure Builder", path: "/anki/structure", summary: "Inspects and creates required decks, note types, templates, and deck settings.", menu: true },
    ],
  },
  {
    id: "anki-synchronization",
    category: "Workspace",
    title: "Anki Synchronization",
    summary: "Run and monitor the primary synchronization workflow between local word data and Anki.",
    pages: [
      { title: "Anki Word Sync", path: "/anki/sync/words", summary: "Synchronizes word fields, media, identifiers, and complete word records with Anki.", menu: true },
      { title: "Audio Studio", path: "/anki/media/audio", summary: "Records, uploads, trims, fades, adjusts, renames, replaces, and organizes reusable audio files for Anki media synchronization.", menu: true },
    ],
  },
  {
    id: "ai",
    category: "Workspace",
    title: "AI Tools",
    summary: "Build reusable prompts and work with locally served AI models.",
    pages: [
      { title: "AI Commands", path: "/ai/commands", summary: "Lists the current and planned tasks that can be requested from AI in plain language.", menu: true },
      { title: "Prompt Builder", path: "/ai/prompt-builder", summary: "Combines prompt files and previews the resulting reusable AI prompt.", menu: true },
    ],
  },
  {
    id: "administration",
    category: "Administration",
    title: "Administration",
    summary: "Manage application data, database backups, navigation, and comparisons.",
    pages: [
      { title: "Data Manager", path: "/admin/data", summary: "Browses Prisma models and performs controlled record management operations.", menu: true },
      { title: "Database Compare", path: "/admin/database-compare", summary: "Compares local database fingerprints with the version stored in GitHub.", menu: true },
      { title: "Database Backup", path: "/admin/database-backup", summary: "Preserves unchanged local database archives, explicitly pushes backup changes, and restores from GitHub.", menu: true },
      { title: "Navigation Manager", path: "/admin/navigation", summary: "Edits the nested site and dashboard menus from one interface.", menu: true },
    ],
  },
  {
    id: "less-used-anki",
    category: "Less Used",
    title: "Anki Utilities",
    summary: "Open occasional Anki configuration, maintenance, inspection, and card utilities.",
    pages: [
      { title: "Connection", path: "/anki/connection", summary: "Shows AnkiConnect settings, prerequisites, and the planned connection flow.", menu: true },
      { title: "Migrations", path: "/anki/migrations", summary: "Runs one-time Anki data migrations and displays their execution logs.", menu: true },
      { title: "Suspension Manager", path: "/anki/cards/suspensions", summary: "Finds and manages suspended Anki cards.", menu: true },
      { title: "Transfer Cards", path: "/anki/cards/transfer", summary: "Moves matching card types for a note from one Anki deck to another.", menu: true },
      { title: "AnkiConnect Console", path: "/tests/anki/connection", summary: "Calls AnkiConnect actions directly and displays their raw responses.", menu: true },
      { title: "Anki Review Log Inspector", path: "/tests/anki/review-log", summary: "Displays AnkiDroid review-log data returned for selected cards.", menu: true },
      { title: "Sentence Card Sync", path: "/tests/sync/sentence-cards", summary: "Ensures sentence decks and synchronizes selected or all sentence cards.", menu: true },
    ],
  },
  {
    id: "less-used-words",
    category: "Less Used",
    title: "Word Utilities",
    summary: "Open occasional vocabulary hint, cleanup, field, and source-catalog utilities.",
    pages: [
      { title: "Audio Hints", path: "/words/hints/audio", summary: "Reviews and manages WordSense-owned audio plus Sentence-owned audio stored by filename on Sentence records.", menu: true },
      { title: "JSON Hints", path: "/words/hints/json", summary: "Reviews and generates structured JSON hints for vocabulary records.", menu: true },
      { title: "Word Cleanup", path: "/words/cleanup", summary: "Finds and removes local words that no longer exist in Anki.", menu: true },
      { title: "Sentence Fields", path: "/tests/words/sentence-fields", summary: "Temporarily reviews and updates sentence fields stored on word records.", menu: true },
      { title: "External Source Catalog", path: "/tests/words/external-sources", summary: "Browses the read-only, deduplicated B-amooz and TTWordBank catalog with quality categories, search, source filters, evidence, and unresolved items.", menu: true },
    ],
  },
  {
    id: "less-used-ipa",
    category: "Less Used",
    title: "IPA Tools",
    summary: "Maintain pronunciation keywords, picture-word media, and IPA normalization data.",
    pages: [
      { title: "IPA Keywords", path: "/ipa/keywords", summary: "Manages IPA keyword mappings and their Persian-friendly forms.", menu: true },
      { title: "Picture Words", path: "/ipa/picture-words", summary: "Maintains visual keyword associations used in pronunciation learning.", menu: true },
      { title: "Picture Word Audio", path: "/ipa/picture-words/audio", summary: "Records, uploads, lists, and removes audio for picture words.", menu: true },
      { title: "IPA Word Inspector", path: "/tests/ipa/words", summary: "Lists special IPA word records and runs normalization backfills.", menu: true },
    ],
  },
  {
    id: "less-used-editors",
    category: "Less Used",
    title: "Editor Tools",
    summary: "Exercise rich-text editor behavior outside the primary editing workflows.",
    pages: [
      { title: "Editor Playground", path: "/tests/editors/basic", summary: "Provides a focused surface for the shared rich-text editor.", menu: true },
      { title: "Editor Demo", path: "/tests/editors/demo", summary: "Demonstrates editor features with a fuller example configuration.", menu: true },
    ],
  },
  {
    id: "less-used-local-ai",
    category: "Less Used",
    title: "Local AI",
    summary: "Work with locally served AI models and saved generation settings.",
    pages: [
      { title: "Local AI Studio", path: "/ai/local-chat", summary: "Manages LM Studio models and their saved generation settings, then exercises multi-turn local chat.", menu: true },
    ],
  },
  {
    id: "less-used-development",
    category: "Less Used",
    title: "Development Tools",
    summary: "Open the overview and focused utilities used during development.",
    pages: [
      { title: "Less Used Overview", path: "/tests", summary: "Searches and opens less frequently used tools and internal utilities.", menu: true },
      { title: "Function Playground", path: "/tests/functions", summary: "Demonstrates reusable server-side function helpers.", menu: true },
      { title: "Azure IPA Audio Test", path: "/tests/tts/azure-ipa", summary: "Pastes aligned written and IPA segments and generates temporary Azure audio for individually selected rows.", menu: true },
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

export const lessUsedSiteMapGroups = siteMapGroups.filter((group) => group.category === "Less Used");
export const testSiteMapGroups = lessUsedSiteMapGroups;
