export const config = {
  matcher: [
    "/((?!api/auth|api/ipa/keyword|ipa-test|_next/static|_next/image|favicon.ico).*)",
  ],
};

import { NextResponse } from "next/server";

export default function middleware() {
  // Auth is currently disabled: allow all routes for all users.
  return NextResponse.next();
}
