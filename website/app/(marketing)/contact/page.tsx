import { Mail } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CustomJsonLd } from "@/components/custom-json-ld";
import { LegalPage } from "@/components/legal-page";
import { buttonVariants } from "@/components/ui/button";
import { getLegalDoc, getPageMeta, getSiteSettings } from "@/lib/content/get";
import { metadataForPath } from "@/lib/content/metadata";

// Admin-managed (/seoteam/meta for SEO, /seoteam/legal for the copy); both fall
// back to the hardcoded defaults when no database is configured.
export function generateMetadata(): Promise<Metadata> {
  return metadataForPath("/contact");
}

export default async function ContactPage() {
  const [doc, meta, settings] = await Promise.all([
    getLegalDoc("contact"),
    getPageMeta("/contact"),
    getSiteSettings(),
  ]);
  // The email is one value, owned by Site settings — the contact card and the
  // Organization structured data both read it from there.
  const email = settings.identity.contactEmail;

  return (
    <>
      <CustomJsonLd json={meta.customJsonLd} />
      <LegalPage
        title={doc.title}
        updated={doc.updated || undefined}
        intro={doc.intro}
        html={doc.html}
      >
        {email && (
          <div className="not-prose flex flex-col items-start gap-4 rounded-lg border border-border-subtle bg-surface p-6">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-biro-tint text-biro">
              <Mail size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="font-display text-lg font-semibold text-ink">Email us</p>
              <p className="mt-1 text-sm text-ink-secondary">
                We usually reply within a couple of days.
              </p>
            </div>
            <Link href={`mailto:${email}`} className={buttonVariants()}>
              {email}
            </Link>
          </div>
        )}
        <ContactGuidance />
      </LegalPage>
    </>
  );
}

// `LegalPage` applies its prose classes to `html` only; children render in a
// plain stack beneath it, so the few elements below carry their own.
const headingClass = "mt-2 font-display text-xl font-semibold text-ink";
const linkClass = "text-biro underline underline-offset-2";

/**
 * The part of the page a reader actually needs: what an email to us can settle,
 * what they can do faster themselves, and how long we take.
 *
 * It lives here rather than in the admin-managed `contact` legal doc because it
 * describes the product's own screens (Settings, a person's profile, a shared
 * list) and has to move when those move, not when someone edits copy.
 */
function ContactGuidance() {
  return (
    <div className="flex flex-col gap-6 leading-relaxed text-ink-secondary">
      <h2 className={headingClass}>What to write to us about</h2>
      <p>
        Bugs, mostly. If a reminder never arrived, or turned up at the wrong hour, tell
        us the name it was for and roughly when you expected it. That&rsquo;s usually
        enough to find the run it belongs to and see what it did.
      </p>
      <p>
        Imports are the other common one. If a spreadsheet went in with ninety names and
        came out with sixty, send us the file and we&rsquo;ll tell you which rows the
        parser couldn&rsquo;t read.
      </p>
      <p>
        Feature requests are fine too. And if you think you&rsquo;ve found a security
        problem, say so in the subject line; that one gets read first.
      </p>

      <h2 className={headingClass}>Things you don&rsquo;t need us for</h2>
      <p>
        You can delete your account yourself, under Settings, then Danger zone, on the
        web or in the app. It erases your people, events, reminders and shared list
        memberships on the spot. You don&rsquo;t have to ask, and we can&rsquo;t put it
        back.
      </p>
      <p>
        The same goes for how reminders reach you: the channel, the lead time and the
        hour they fire are all in Settings, and any of it can be overridden for one
        person from their profile. To get out of a shared list, open it and leave. The
        reminders stop for you straight away, and nothing you added to your own list
        goes with it.
      </p>
      <p>
        If the question is what we store, that&rsquo;s written out in the{" "}
        <Link href="/privacy" className={linkClass}>
          privacy policy
        </Link>
        , down to what the notification providers see when a reminder goes out.
      </p>

      <h2 className={headingClass}>How long we take</h2>
      <p>
        There&rsquo;s no support desk behind this address. It&rsquo;s read by the people
        who build the app, and weekends are slower. If a week goes by with nothing back,
        send it again rather than assume we decided not to answer; mail does occasionally
        land in the wrong folder.
      </p>
    </div>
  );
}
