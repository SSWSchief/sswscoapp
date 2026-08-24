export const dynamic = "force-dynamic";

/**
 * The build currently being served, for clients to compare against the release
 * baked into their own bundle. Deliberately tiny and unauthenticated: it is
 * polled by every open tab, it touches no database, and it discloses nothing a
 * visitor could not already read out of the deployed JavaScript.
 */
export function GET() {
  return new Response(
    JSON.stringify({
      release:
        process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
        process.env.NEXT_PUBLIC_RELEASE ||
        "local",
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    },
  );
}
