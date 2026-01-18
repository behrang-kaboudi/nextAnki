import type { MenuIcon as MenuIconName } from "@/menus";

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
    default:
      return null;
  }
}

