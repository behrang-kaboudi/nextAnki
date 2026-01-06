export { auth as middleware } from "@/auth"

export const config = {
  matcher: [
    "/((?!api/ipa/keyword|ipa-test|_next/static|_next/image|favicon.ico).*)",
  ],
};
