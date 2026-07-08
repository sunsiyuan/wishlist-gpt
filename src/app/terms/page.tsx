export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto p-6 md:p-8">
      <h1 className="text-3xl font-bold mb-4 text-primary dark:text-primary-dark">Terms of Service</h1>
      <p className="text-sm text-secondary dark:text-secondary-dark mb-8">Effective: 2026-01-11</p>
      
      <div className="space-y-6 text-secondary dark:text-secondary-dark leading-relaxed">
        <p>By using WishlistGPT, you agree to these Terms.</p>

        <div>
          <h2 className="text-xl font-semibold mb-2 mt-6">1) Your account</h2>
          <p>
            You are responsible for maintaining account security and all activity under your
            account.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2 mt-6">2) Acceptable use</h2>
          <p>
            Use the service only for lawful purposes. Do not misuse the service (e.g., attempt
            unauthorized access, disrupt operations, or abuse rate limits).
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2 mt-6">3) Your content</h2>
          <p>
            You control what you save (links/notes). You are responsible for the content you
            provide and for not including sensitive personal information.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2 mt-6">4) Sharing</h2>
          <p>
            If you generate a share link, anyone with the link may access the shared list. You may
            revoke sharing, but you are responsible for how widely the link is distributed.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2 mt-6">5) Beta / "as is"</h2>
          <p>
            WishlistGPT may change or discontinue features at any time. The service is provided "as
            is" without warranties.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2 mt-6">6) Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, WishlistGPT is not liable for indirect or
            consequential damages, or losses due to incorrect product info, broken links, or service
            interruptions.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2 mt-6">7) Termination</h2>
          <p>
            We may suspend or terminate access if you violate these Terms or misuse the service.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2 mt-6">8) Changes</h2>
          <p>
            We may update these Terms as the product evolves. Continued use means you accept the
            updated Terms.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2 mt-6">9) Governing law</h2>
          <p>These Terms are governed by the laws of the State of Delaware, USA.</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2 mt-6">Contact</h2>
          <p>
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
