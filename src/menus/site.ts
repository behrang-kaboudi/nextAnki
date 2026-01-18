import type { Menu } from "./types";

export const siteMenu: Menu = {
  id: "marketing",
  primary: [
    {
      type: "group",
      label: "App",
      icon: "app",
      items: [
        { type: "link", href: "/features", label: "features", icon: "sparkles" },
        { type: "link", href: "/connect", label: "connect", icon: "tools" },
        { type: "link", href: "/docs", label: "docs", icon: "about" },
        { type: "link", href: "/editor-test", label: "editor-test", icon: "tools" },
        { type: "link", href: "/editor-demo", label: "editor-demo", icon: "tools" },
      ],
    },
    {
      type: "group",
      label: "Word",
      icon: "tools",
      items: [{ type: "link", href: "/words/word-cleanup", label: "Missing in DB", icon: "tools" }],
    },
    { type: "link", href: "/word-extraction", label: "Word Extraction", icon: "tools" },
    {
      type: "group",
      label: "AI",
      icon: "sparkles",
      items: [
        { type: "link", href: "/ai/test", label: "Test", icon: "sparkles" },
        {
          type: "link",
          href: "/ai/prompt-builder",
          label: "Prompt Builder",
          icon: "sparkles",
        },
      ],
    },
    {
      type: "group",
      label: "IPA",
      icon: "ipa",
      items: [
        { type: "link", href: "/ipa-test", label: "ipa-test", icon: "ipa" },
        { type: "link", href: "/ipa/keywords", label: "ipa-keywords", icon: "ipa" },
        { type: "link", href: "/ipa/picture-words", label: "picture-words", icon: "ipa" },
        { type: "link", href: "/ipa/picture-words/audio", label: "picture-words-audio", icon: "ipa" },
        { type: "link", href: "/ipa/phrase-building", label: "phrase-building", icon: "ipa" },
      ],
    },
    {
      type: "group",
      label: "Anki",
      icon: "anki",
      items: [
        { type: "link", href: "/anki-note", label: "anki-note", icon: "anki" },
        { type: "link", href: "/anki-deck", label: "anki-deck", icon: "anki" },
      ],
    },
    {
      type: "group",
      label: "Admin",
      icon: "admin",
      items: [
        { type: "link", href: "/admin/themes", label: "themes", icon: "admin" },
        { type: "link", href: "/admin/data", label: "data", icon: "admin" },
        {
          type: "link",
          href: "/admin/word/imageability",
          label: "word sentences",
          icon: "admin",
        },
      ],
    },
    { type: "link", href: "/about", label: "About", icon: "about" },
  ],
};
