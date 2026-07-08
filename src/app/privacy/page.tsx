export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto p-6 md:p-8">
      <h1 className="text-3xl font-bold mb-4 text-primary dark:text-primary-dark">Privacy Policy</h1>
      <p className="text-sm text-secondary dark:text-secondary-dark mb-8">Effective: 2026-07-08</p>

      <div className="space-y-6 text-secondary dark:text-secondary-dark leading-relaxed">
        <p>
          WishlistGPT is a personal wishlist tool. You use it inside ChatGPT (and on the web), and
          it collects and processes only what&apos;s needed to run the service:
        </p>

        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>
            <strong>Account data:</strong> an account identifier, your email address (if you sign in
            with email), a nickname, and any profile photo you upload.
          </li>
          <li>
            <strong>Wishlist data:</strong> the products you save — the link, the details you or the
            assistant provide (title, price, merchant, size/color), a saved copy of the cover image,
            and any notes you add.
          </li>
          <li>
            <strong>Sharing data:</strong> share links you create to show a read-only list to
            others.
          </li>
          <li>
            <strong>Minimal diagnostics:</strong> basic request/log identifiers to troubleshoot
            issues and prevent abuse.
          </li>
          <li>
            <strong>Early-access interest:</strong> if you tap &ldquo;Buy with AI&rdquo; or
            &ldquo;Gift with AI,&rdquo; we record that interest (including the product link) to
            gauge demand for the feature.
          </li>
        </ul>

        <div>
          <h2 className="text-xl font-semibold mb-2 mt-6">Using WishlistGPT inside ChatGPT</h2>
          <p>
            When you use WishlistGPT through ChatGPT, the ChatGPT assistant sends us the product
            details you choose to save (such as the link, title, image, and price). We receive and
            store only what is needed to add the item to your list. Your ChatGPT conversation itself
            stays with OpenAI and is governed by{" "}
            <a
              href="https://openai.com/policies/row-privacy-policy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80 dark:text-primary-dark dark:hover:text-primary-dark/80"
            >
              OpenAI&apos;s privacy policy
            </a>
            ; we do not receive your full chat history.
          </p>
        </div>

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
          <h2 className="text-xl font-semibold mb-2 mt-6">Your controls</h2>
          <p>
            You can delete individual items and revoke or rotate a share link at any time from the
            app. To delete your account and associated data, contact us using the address below.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2 mt-6">Data retention & deletion</h2>
          <p>
            We keep your wishlist and account data while your account is active. When you request
            account deletion, we remove your personal data within 30 days (backup copies are purged
            on our normal backup cycle). Minimal diagnostic logs are retained for roughly 90 days
            and then deleted.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2 mt-6">Children</h2>
          <p>
            WishlistGPT is not directed to children. You must be at least 13 years old (or the
            minimum age required in your country) to use it.
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
