# Navbar tree

Use this map when changing the main menu UI:

- `Navbar.tsx`: converts editable menu config items into navbar view items.
- `Navbar.client.tsx`: owns client state such as the mobile menu and close-on-route-change behavior.
- `NavbarView.tsx`: renders the shell of the navbar, brand, auth widget, and mobile overlay.
- `TopbarNavItems.tsx`: renders desktop top-level menu items.
- `DropdownNavItems.tsx`: renders opened desktop submenu items.
- `SidebarNavItems.tsx`: renders mobile menu items.
- `NavItemLink.tsx`: shared internal/external link renderer.
- `styles.ts`: Tailwind class names for navbar, dropdown, and mobile menu styling.
- `types.ts`: shared navbar item type.
