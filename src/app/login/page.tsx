import AuthPanel from "./AuthPanel";

type LoginPageProps = {
  searchParams?: Promise<{ next?: string; error?: string }>;
};

function getErrorMessage(error?: string) {
  if (!error) {
    return null;
  }
  if (error === "oauth_callback_failed") {
    return "OAuth sign-in failed. Please try again.";
  }
  return "Login failed. Please try again.";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const errorMessage = getErrorMessage(resolvedParams?.error);
  const nextPath = resolvedParams?.next;

  return (
    <main style={{ padding: "2rem", maxWidth: "420px", margin: "0 auto" }}>
      <h1>Sign in</h1>
      <p>Secure login powered by Supabase.</p>
      {errorMessage ? (
        <p style={{ color: "#b91c1c" }} role="alert">
          {errorMessage}
        </p>
      ) : null}
      <AuthPanel nextPath={nextPath} />
    </main>
  );
}
