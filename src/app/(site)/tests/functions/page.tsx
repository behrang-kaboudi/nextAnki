import Link from "next/link";

export const metadata = { title: "Test Functions" };

export default function TestFunctionsSamplePage() {
  return <main className="mx-auto w-full max-w-3xl p-4"><div className="flex items-baseline justify-between gap-3"><h1 className="text-xl font-semibold">Test Functions</h1><Link href="/tests" className="rounded border px-2.5 py-1.5 text-sm">Back to Tests</Link></div><p className="mt-3 text-sm opacity-80">Sample page for the test functions group.</p></main>;
}
