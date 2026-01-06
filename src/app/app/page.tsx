import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { listItems } from "../../server/items/store";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) {
    redirect("/login");
  }

  const email = claimsData?.claims?.email ?? "unknown";
  const items = await listItems({ userId });

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Welcome</h1>
      <p>Logged in as {email}.</p>
      <p>
        <a href="/app">View wishlist items</a>
      </p>
      <form action="/auth/signout" method="post">
        <button type="submit">Sign out</button>
      </form>
      <h2 style={{ marginTop: "2rem" }}>Your wishlist</h2>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <a href={item.url_original}>{item.url_original}</a>
            {item.updated_at ? ` (${item.updated_at})` : null}
          </li>
        ))}
      </ul>
    </main>
  );
}
