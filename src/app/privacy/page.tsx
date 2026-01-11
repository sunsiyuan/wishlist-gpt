export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto p-6 md:p-8">
      <h1 className="text-3xl font-bold mb-4 text-primary dark:text-primary-dark">Privacy Policy</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Effective: 2026-01-11</p>
      
      <div className="space-y-6 text-gray-700 dark:text-gray-300 leading-relaxed">
        <p>
          WishlistGPT is a personal wishlist tool. WishlistGPT collects and processes only what's
          needed to run the service:
        </p>
        
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>
            <strong>Account data:</strong> an account identifier and (if you sign in with email)
            your email address.
          </li>
          <li>
            <strong>Wishlist data:</strong> the product links you save and best-effort display
            metadata (e.g., title, image, price) plus any notes you add.
          </li>
          <li>
            <strong>Sharing data:</strong> share links you create to show a read-only list to
            others.
          </li>
          <li>
            <strong>Minimal diagnostics:</strong> basic request/log identifiers to troubleshoot
            issues and prevent abuse.
          </li>
        </ul>

        <div>
          <h2 className="text-xl font-semibold mb-2 mt-6">How we use data</h2>
          <p>
            We use this data to save and display your wishlist, enable sharing, operate the service,
            and keep it secure. We do not sell your personal information and we do not use it for
            targeted advertising.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2 mt-6">Third-party infrastructure</h2>
          <p>
            We use third-party cloud infrastructure providers to operate WishlistGPT (e.g., Vercel
            for hosting and Supabase for database/auth). They process data on our behalf to provide
            the service.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2 mt-6">Cookies</h2>
          <p>We use essential cookies for authentication/session. No advertising cookies.</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2 mt-6">Public sharing</h2>
          <p>
            If you create a share link, anyone with the link may view the shared list. Avoid
            including sensitive personal information in notes.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2 mt-6">Data retention & deletion</h2>
          <p>
            We keep data while your account is active. You can request deletion by contacting us.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2 mt-6">Contact</h2>
          <p>
            Questions or deletion requests:{" "}
            <a
              href="mailto:support@wishlistgpt.com"
              className="text-primary underline hover:text-primary/80 dark:text-primary-dark dark:hover:text-primary-dark/80"
            >
              support@wishlistgpt.com
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
