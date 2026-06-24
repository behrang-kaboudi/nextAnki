export function closeSiblingDetails(event: React.MouseEvent<HTMLElement>) {
  const nav = (event.currentTarget as HTMLElement).closest("nav");
  if (!nav) return;

  const currentDetails = (event.currentTarget as HTMLElement).closest("details");
  nav.querySelectorAll("details[open]").forEach((details) => {
    if (currentDetails && details === currentDetails) return;
    (details as HTMLDetailsElement).open = false;
  });
}

export function closeAllDetailsInNav(event: React.MouseEvent<HTMLElement>) {
  const nav = (event.currentTarget as HTMLElement).closest("nav");
  if (!nav) return;

  nav.querySelectorAll("details[open]").forEach((details) => {
    (details as HTMLDetailsElement).open = false;
  });
}
