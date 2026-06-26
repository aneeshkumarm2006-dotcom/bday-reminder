import type { Metadata } from "next";

import { LegalPage } from "@/components/legal-page";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: `How ${siteConfig.name} handles your data. We don't sell it, and you can delete it anytime.`,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="June 2026"
      intro={`${siteConfig.name} is built to help you remember the people who matter, not to harvest your data. Here's exactly what we store and why.`}
    >
      <p>
        This is a plain-language summary of how we handle your information. It is a starting
        template and should be reviewed by a professional before launch.
      </p>

      <h2>What we store</h2>
      <ul>
        <li>
          <strong>Your account:</strong> your name, email and/or phone number, timezone, and
          notification preferences, used to sign you in and send reminders.
        </li>
        <li>
          <strong>The people you add:</strong> names, dates, optional photos, relationships,
          phone numbers, and any notes you write. This is your data; we only use it to power
          your reminders and your shared lists.
        </li>
        <li>
          <strong>Reminders:</strong> the scheduled and sent reminders generated from your
          events, so your in-app feed persists.
        </li>
      </ul>

      <h2>What we don&apos;t do</h2>
      <ul>
        <li>We don&apos;t sell your data or share it with advertisers.</li>
        <li>We don&apos;t show ads.</li>
        <li>
          We never message the people you track on your behalf. The &ldquo;send greeting&rdquo;
          action opens <strong>your</strong> messaging app for you to send yourself.
        </li>
      </ul>

      <h2>Notifications</h2>
      <p>
        We use third parties to deliver push and email, and (where enabled) SMS/WhatsApp.
        Those providers process only what&apos;s needed to deliver a message. SMS/WhatsApp is
        capped each month to keep the app free; past the cap, reminders fall back to push and
        email automatically.
      </p>

      <h2>Your control</h2>
      <ul>
        <li>You can edit or delete any person, event, or note at any time.</li>
        <li>Deleting a person removes their events and pending reminders.</li>
        <li>You can leave a shared list, which stops its reminders for you immediately.</li>
        <li>You can request deletion of your account and associated data.</li>
      </ul>

      <h2>Contact</h2>
      <p>
        Questions about privacy? Email{" "}
        <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
      </p>
    </LegalPage>
  );
}
