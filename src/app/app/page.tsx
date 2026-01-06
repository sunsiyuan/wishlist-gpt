import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseUserId } from "../../server/auth/supabase";
import { listItems } from "../../server/items/store";

async function buildRequestFromHeaders() {
  const headerList = await headers();
  const requestHeaders = new Headers();
  const cookie = headerList.get("cookie");
  const authorization = headerList.get("authorization");
  if (cookie) {
    requestHeaders.set("cookie", cookie);
  }
  if (authorization) {
    requestHeaders.set("authorization", authorization);
  }
  return new Request("http://localhost", { headers: requestHeaders });
}

export default async function AppPage() {
  const request = await buildRequestFromHeaders();
  const userId = await getSupabaseUserId(request);
  if (!userId) {
    redirect("/login");
  }

  const items = await listItems({ userId });

  return (
    <main>
      <h1>Wishlist</h1>
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
