import type { MenuIcon as MenuIconName } from "@/menus/types";

function Icon({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function MenuIcon({
  name,
  className = "size-5 opacity-80",
}: {
  name: MenuIconName;
  className?: string;
}) {
  switch (name) {
    case "home":
      return (
        <Icon className={className}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
        </Icon>
      );
    case "sparkles":
      return (
        <Icon className={className}>
          <path d="M12 2l1.2 3.6L17 7l-3.8 1.4L12 12l-1.2-3.6L7 7l3.8-1.4L12 2Z" />
          <path d="M5 12l.7 2.1L8 15l-2.3.9L5 18l-.7-2.1L2 15l2.3-.9L5 12Z" />
          <path d="M19 13l.8 2.4L22 16l-2.2.6L19 19l-.8-2.4L16 16l2.2-.6L19 13Z" />
        </Icon>
      );
    case "app":
      return (
        <Icon className={className}>
          <path d="M7 7h10v10H7z" />
          <path d="M4 7h3M4 12h3M4 17h3" />
          <path d="M17 7h3M17 12h3M17 17h3" />
        </Icon>
      );
    case "tools":
      return (
        <Icon className={className}>
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-3 3-3-3 3-3Z" />
        </Icon>
      );
    case "ipa":
      return (
        <Icon className={className}>
          <path d="M4 7h16" />
          <path d="M7 7v10" />
          <path d="M17 7v10" />
          <path d="M7 17h10" />
        </Icon>
      );
    case "anki":
      return (
        <Icon className={className}>
          <path d="M7 4h10v16H7z" />
          <path d="M9 8h6" />
          <path d="M9 12h6" />
        </Icon>
      );
    case "admin":
      return (
        <Icon className={className}>
          <path d="M12 2l7 4v6c0 5-3 9-7 10-4-1-7-5-7-10V6l7-4Z" />
          <path d="M9 12h6" />
          <path d="M12 9v6" />
        </Icon>
      );
    case "about":
      return (
        <Icon className={className}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 10v6" />
          <path d="M12 7h.01" />
        </Icon>
      );
    case "login":
      return (
        <Icon className={className}>
          <path d="M10 17l-1 0a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4h1" />
          <path d="M15 7l4 5-4 5" />
          <path d="M19 12H10" />
        </Icon>
      );
    case "account":
      return (
        <Icon className={className}>
          <path d="M20 21a8 8 0 0 0-16 0" />
          <circle cx="12" cy="9" r="4" />
        </Icon>
      );
    case "book":
      return (
        <Icon className={className}>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" />
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 8H20" />
        </Icon>
      );
    case "database":
      return (
        <Icon className={className}>
          <ellipse cx="12" cy="5" rx="7" ry="3" />
          <path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
          <path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
        </Icon>
      );
    case "settings":
      return (
        <Icon className={className}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.8 1.8 0 0 0 .36 2l.06.06-2.12 2.12-.06-.06a1.8 1.8 0 0 0-2-.36 1.8 1.8 0 0 0-1.1 1.66V20.5h-3v-.08A1.8 1.8 0 0 0 10.4 18.8a1.8 1.8 0 0 0-2 .36l-.06.06-2.12-2.12.06-.06a1.8 1.8 0 0 0 .36-2A1.8 1.8 0 0 0 5 13.9H4.5v-3H5A1.8 1.8 0 0 0 6.64 9.8a1.8 1.8 0 0 0-.36-2l-.06-.06 2.12-2.12.06.06a1.8 1.8 0 0 0 2 .36A1.8 1.8 0 0 0 11.5 4.5V4h3v.5a1.8 1.8 0 0 0 1.1 1.64 1.8 1.8 0 0 0 2-.36l.06-.06 2.12 2.12-.06.06a1.8 1.8 0 0 0-.36 2A1.8 1.8 0 0 0 21 11v3h-.5A1.8 1.8 0 0 0 19.4 15Z" />
        </Icon>
      );
    case "brain":
      return (
        <Icon className={className}>
          <path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3.5 3.5 0 0 0 3.5 5H9V4Z" />
          <path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3.5 3.5 0 0 1-3.5 5H15V4Z" />
          <path d="M9 8H7M15 8h2M9 13H6M15 13h3" />
        </Icon>
      );
    case "file":
      return (
        <Icon className={className}>
          <path d="M6 3h8l4 4v14H6z" />
          <path d="M14 3v5h4" />
          <path d="M9 13h6M9 17h6" />
        </Icon>
      );
    case "code":
      return (
        <Icon className={className}>
          <path d="m8 9-4 3 4 3" />
          <path d="m16 9 4 3-4 3" />
          <path d="m14 5-4 14" />
        </Icon>
      );
    case "search":
      return (
        <Icon className={className}>
          <circle cx="11" cy="11" r="7" />
          <path d="m16 16 4 4" />
        </Icon>
      );
    case "audio":
      return (
        <Icon className={className}>
          <path d="M4 10v4h4l5 4V6l-5 4H4Z" />
          <path d="M16 9a4 4 0 0 1 0 6" />
          <path d="M18.5 6.5a7.5 7.5 0 0 1 0 11" />
        </Icon>
      );
    case "image":
      return (
        <Icon className={className}>
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.5" />
          <path d="m5 17 4.5-4.5L13 16l2-2 4 4" />
        </Icon>
      );
    case "link":
      return (
        <Icon className={className}>
          <path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
          <path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1" />
        </Icon>
      );
    default:
      return null;
  }
}
