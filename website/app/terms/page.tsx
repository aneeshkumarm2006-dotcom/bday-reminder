import type { Metadata } from "next";

import { LegalPage } from "@/components/legal-page";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms",
  description: `The terms of using ${siteConfig.name} — a free birthday and event reminder app.`,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      updated="June 2026"
      intro={`The basics of using ${siteConfig.name}. Plain language, no surprises.`}
    >
      <p>
        This is a starting template and should be reviewed by a professional before launch.
        By using {siteConfig.name}, you agree to the following.
      </p>

      <h2>The service</h2>
      <p>
        {siteConfig.name} helps you store birthdays and events and reminds you about them. It
        is provided free of charge, with no paid tier at launch. We may add, change, or remove
        features over time.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You&apos;re responsible for keeping your login secure.</li>
        <li>You must be old enough to consent to this in your country.</li>
        <li>Keep the information you add accurate, and only add details you&apos;re allowed to.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>
        Use {siteConfig.name} for its purpose — remembering and acting on the dates that matter
        to you and your shared lists. Don&apos;t use it to harass anyone, to send unsolicited
        bulk messages, or in any unlawful way.
      </p>

      <h2>Reminders &amp; messaging</h2>
      <p>
        We make a best effort to deliver reminders on time, but can&apos;t guarantee delivery —
        networks, devices, and third-party providers can fail. The &ldquo;send greeting&rdquo;
        action only ever opens your own messaging app; you choose to send.
      </p>

      <h2>No warranty</h2>
      <p>
        The service is provided &ldquo;as is.&rdquo; To the extent permitted by law, we
        disclaim warranties and aren&apos;t liable for missed reminders or indirect damages.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? Email{" "}
        <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
      </p>
    </LegalPage>
  );
}
