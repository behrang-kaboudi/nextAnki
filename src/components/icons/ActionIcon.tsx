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

export type ActionIconName = "play" | "pause" | "sparkles" | "mic" | "stop" | "trash";

export function ActionIcon({
  name,
  className = "size-4",
}: {
  name: ActionIconName;
  className?: string;
}) {
  switch (name) {
    case "play":
      return (
        <Icon className={className}>
          <path d="M9 7v10l8-5-8-5Z" />
        </Icon>
      );
    case "pause":
      return (
        <Icon className={className}>
          <path d="M9 7v10" />
          <path d="M15 7v10" />
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
    case "mic":
      return (
        <Icon className={className}>
          <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z" />
          <path d="M19 11a7 7 0 0 1-14 0" />
          <path d="M12 18v3" />
          <path d="M8 21h8" />
        </Icon>
      );
    case "stop":
      return (
        <Icon className={className}>
          <path d="M8 8h8v8H8z" />
        </Icon>
      );
    case "trash":
      return (
        <Icon className={className}>
          <path d="M4 7h16" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M6 7l1 14h10l1-14" />
          <path d="M9 7V4h6v3" />
        </Icon>
      );
    default:
      return null;
  }
}

