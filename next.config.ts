import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/how-to-do", destination: "/guides", permanent: true },
      { source: "/connect", destination: "/anki/connection", permanent: true },
      {
        source: "/word-extraction",
        destination: "/words/extraction",
        permanent: true,
      },
      { source: "/word-hints", destination: "/words/editor", permanent: true },
      {
        source: "/word-hints/audio",
        destination: "/words/hints/audio",
        permanent: true,
      },
      {
        source: "/word-hints/json",
        destination: "/words/hints/json",
        permanent: true,
      },
      {
        source: "/words/word-cleanup",
        destination: "/words/cleanup",
        permanent: true,
      },
      {
        source: "/words/sentence-fields",
        destination: "/tests/words/sentence-fields",
        permanent: true,
      },
      {
        source: "/anki-note",
        destination: "/anki/cards/manager",
        permanent: true,
      },
      {
        source: "/add-cards-for-studying",
        destination: "/anki/cards/study",
        permanent: true,
      },
      {
        source: "/anki-card-transfer",
        destination: "/anki/cards/transfer",
        permanent: true,
      },
      {
        source: "/card-transfer-management",
        destination: "/anki/cards/reset",
        permanent: true,
      },
      {
        source: "/anki-suspend-management",
        destination: "/anki/cards/suspensions",
        permanent: true,
      },
      {
        source: "/anki-knowing-filter-management",
        destination: "/anki/cards/knowing-filter",
        permanent: true,
      },
      {
        source: "/structure-builder",
        destination: "/anki/structure",
        permanent: true,
      },
      {
        source: "/anki-migration",
        destination: "/anki/migrations",
        permanent: true,
      },
      { source: "/anki-deck", destination: "/anki/structure", permanent: true },
      { source: "/ai/test", destination: "/tests/ai/chat", permanent: true },
      {
        source: "/anki-connect-playground",
        destination: "/tests/anki/connection",
        permanent: true,
      },
      {
        source: "/tests/anki-revlog",
        destination: "/tests/anki/review-log",
        permanent: true,
      },
      {
        source: "/editor-test",
        destination: "/tests/editors/basic",
        permanent: true,
      },
      {
        source: "/editor-demo",
        destination: "/tests/editors/demo",
        permanent: true,
      },
      { source: "/ipa-test", destination: "/tests/ipa/words", permanent: true },
      {
        source: "/ipa/phrase-building",
        destination: "/ipa/phrase-builder",
        permanent: true,
      },
      {
        source: "/tests/sync-anki-words",
        destination: "/anki/sync/words",
        permanent: true,
      },
      {
        source: "/tests/sync/anki-words",
        destination: "/anki/sync/words",
        permanent: true,
      },
      {
        source: "/tests/sentence-deck-sync",
        destination: "/tests/sync/sentence-cards",
        permanent: true,
      },
      {
        source: "/tests/test-functions",
        destination: "/tests/functions",
        permanent: true,
      },
      {
        source: "/tests/word/clear-fields",
        destination: "/tests/words/clear-fields",
        permanent: true,
      },
      {
        source: "/admin/menu-manager",
        destination: "/admin/navigation",
        permanent: true,
      },
      {
        source: "/admin/db-compare",
        destination: "/admin/database-compare",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
