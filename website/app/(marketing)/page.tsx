import {
  Bell,
  CalendarDays,
  Gift,
  Globe,
  MessageCircle,
  PawPrint,
  Smartphone,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";

import { AnimatedRing } from "@/components/animated-ring";
import { AppPreview, ReminderPreview, WidgetPreview } from "@/components/app-preview";
import { TappableRing } from "@/components/interactive-ring";
import { Reveal } from "@/components/reveal";
import { buttonVariants } from "@/components/ui/button";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function Home() {
  const now = new Date();
  const today = { day: now.getDate(), month: MONTHS[now.getMonth()] };

  return (
    <>
      <Hero today={today} />
      <ValueProp />
      <Features />
      <HowItWorks />
      <GetTheApp />
    </>
  );
}

function Hero({ today }: { today: { day: number; month: string } }) {
  return (
    <section className="relative overflow-hidden">
      {/* A single, quiet biro-tint wash - no second accent (DESIGN.md §1). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(60%_60%_at_50%_0%,var(--biro-tint),transparent_70%)] opacity-70"
      />
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center px-5 pb-8 pt-16 text-center sm:pt-24">
        <span className="group inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-3 py-1 text-xs font-medium text-ink-secondary transition-colors duration-300 hover:border-biro/40">
          <Sparkles
            size={13}
            className="text-biro transition-transform duration-500 ease-out group-hover:rotate-90 group-hover:scale-110"
            aria-hidden="true"
          />
          Free birthday &amp; event reminders
        </span>

        <div className="mt-8">
          <AnimatedRing day={today.day} month={today.month} size="xl" />
        </div>

        <h1 className="mt-8 max-w-2xl font-display text-4xl font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-6xl">
          Remember, and act.
        </h1>
        <p className="mt-5 max-w-xl text-balance text-lg leading-relaxed text-ink-secondary">
          The free way to never miss a birthday and actually do something about it.
          Store the dates that matter, get reminded in time, and send a greeting in one tap.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className={`${buttonVariants({ size: "lg" })} hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-12px_rgba(44,75,216,0.6)]`}
          >
            Start for free
          </Link>
          <Link
            href="/login"
            className={`${buttonVariants({ variant: "secondary", size: "lg" })} hover:-translate-y-0.5`}
          >
            Log in
          </Link>
        </div>
        <p className="mt-4 text-sm text-ink-muted">
          Free on web, iOS, and Android. No ads, no paid tier.
        </p>
      </div>

      {/* Product shot - rendered from the real design system, light + dark. */}
      <div className="mx-auto w-full max-w-5xl px-5 pb-16 pt-4">
        <Reveal className="flex flex-wrap items-end justify-center gap-6">
          <AppPreview />
          <ReminderPreview className="hidden sm:block sm:max-w-xs" />
        </Reveal>
      </div>
    </section>
  );
}

function ValueProp() {
  return (
    <section className="border-y border-border-subtle bg-surface-sunken/60">
      <div className="mx-auto w-full max-w-3xl px-5 py-16 text-center">
        <Reveal>
          <h2 className="text-balance font-display text-2xl font-semibold leading-snug tracking-[-0.01em] text-ink sm:text-3xl">
            Most apps stop at <span className="text-ink-muted">remembering</span>.
            <br className="hidden sm:block" /> The point is to{" "}
            <span className="text-biro">do something</span> before the moment passes.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-ink-secondary">
            A reminder that arrives at the right time, in your timezone, with the
            person&apos;s name and age, plus a one-tap way to send the message. That&apos;s
            the whole idea.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="mx-auto w-full max-w-5xl scroll-mt-20 px-5 py-20">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-semibold tracking-[-0.01em] text-ink">
          Everything you need to never forget
        </h2>
        <p className="mt-4 text-ink-secondary">
          Built around one idea, counting down to a date for someone you care about,
          and nothing that gets in the way.
        </p>
      </Reveal>

      <div className="mt-14 flex flex-col gap-20">
        <FeatureRow
          icon={Bell}
          eyebrow="Reminders that reach you"
          title="On every channel, at the right local time"
          body="Push, email, SMS/WhatsApp, and an in-app feed: pick any combination, globally or per person. Reminders fire at the time you choose in your own timezone, and re-anchor automatically when you travel. Set them days ahead, on the day, or both."
          points={[
            "Multiple lead times per event (7 days before and on the day)",
            "WhatsApp/SMS with a fair-use cap, then it falls back to push & email",
            "A persistent in-app feed so nothing ever gets lost",
          ]}
          preview={<AppPreview />}
        />

        <FeatureRow
          reverse
          icon={MessageCircle}
          eyebrow="Act in one tap"
          title="Send a greeting before the moment passes"
          body="On the day, if you have their number, the reminder opens your messaging app with a friendly, editable message ready to go. You always review and send it yourself, never auto-sent."
          points={[
            "Pre-filled, editable template: “Happy birthday, [Name]! 🎉”",
            "Opens your own WhatsApp or SMS, addressed to them",
            "Mark as done or snooze right from the reminder",
          ]}
          preview={<ReminderPreview />}
        />

        <FeatureRow
          icon={Smartphone}
          eyebrow="Always in view"
          title="A home-screen widget for the next 3"
          body="Keep the next three birthdays and events one glance away. The widget updates itself as the days pass, and tapping a name jumps straight to their profile."
          points={[
            "Name, date, and days remaining at a glance",
            "Updates on its own, no need to open the app",
            "Tap a person to open their profile",
          ]}
          preview={<WidgetPreview />}
        />
      </div>

      <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FeatureCard
          icon={Users}
          title="Shared family lists"
          body="Track the same birthdays together. Invite family, everyone can add and edit, and each person keeps their own reminder settings."
        />
        <FeatureCard
          icon={CalendarDays}
          title="Calendar sync"
          body="Subscribe to your birthdays in Apple, Google, or Outlook. It stays in sync as you add, edit, and remove people."
        />
        <FeatureCard
          icon={Gift}
          title="Gift notes"
          body="Keep a running list of gift ideas, sizes, and preferences for each person, private to you and your list."
        />
        <FeatureCard
          icon={PawPrint}
          title="Pets & every event"
          body="Birthdays, anniversaries, and custom events, for people and pets. Each one reminds you independently."
        />
        <FeatureCard
          icon={CalendarDays}
          title="Smart dates"
          body="Year is optional, ages are shown only when known, and Feb 29 is handled the way you choose."
        />
        <FeatureCard
          icon={Globe}
          title="One account, everywhere"
          body="Web, iOS, and Android: same data, instantly synced. Log in anywhere and pick up where you left off."
        />
      </div>
    </section>
  );
}

function FeatureRow({
  icon: Icon,
  eyebrow,
  title,
  body,
  points,
  preview,
  reverse = false,
}: {
  icon: typeof Bell;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  preview: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2">
      <Reveal className={`group ${reverse ? "lg:order-2" : ""}`}>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-biro-tint text-biro transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-110">
          <Icon size={20} aria-hidden="true" />
        </span>
        <p className="mt-4 text-sm font-medium text-biro">{eyebrow}</p>
        <h3 className="mt-1 font-display text-2xl font-semibold tracking-[-0.01em] text-ink">
          {title}
        </h3>
        <p className="mt-3 text-pretty leading-relaxed text-ink-secondary">{body}</p>
        <ul className="mt-5 flex flex-col gap-2.5">
          {points.map((point) => (
            <li
              key={point}
              className="flex items-start gap-2.5 text-sm text-ink-secondary transition-colors duration-200 hover:text-ink [&:hover_span]:scale-150"
            >
              <span
                aria-hidden="true"
                className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-biro transition-transform duration-200 ease-out"
              />
              {point}
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal
        delay={0.05}
        className={`flex justify-center ${reverse ? "lg:order-1" : ""}`}
      >
        <div className="transition-transform duration-500 ease-out hover:scale-[1.02]">
          {preview}
        </div>
      </Reveal>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Bell;
  title: string;
  body: string;
}) {
  return (
    <Reveal>
      <div className="group h-full rounded-lg border border-border-subtle bg-surface p-5 transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:border-biro/40 hover:shadow-[0_14px_34px_-18px_rgba(44,75,216,0.45)]">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-biro-tint text-biro transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-110">
          <Icon size={20} aria-hidden="true" />
        </span>
        <h3 className="mt-4 font-display text-lg font-semibold text-ink transition-colors duration-300 group-hover:text-biro">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{body}</p>
      </div>
    </Reveal>
  );
}

function HowItWorks() {
  const steps = [
    {
      day: 5,
      title: "Add the people who matter",
      body: "Type a name and a date, or import from your contacts or a spreadsheet. Year is optional.",
    },
    {
      day: 11,
      title: "Get reminded in time",
      body: "Choose how far ahead and which channels. Reminders arrive at your time, in your timezone.",
    },
    {
      day: 12,
      title: "Send a greeting",
      body: "On the day, open your messages with a ready-to-send note, then mark it done.",
    },
  ];
  return (
    <section id="how" className="border-y border-border-subtle bg-surface-sunken/60">
      <div className="mx-auto w-full max-w-5xl scroll-mt-20 px-5 py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.01em] text-ink">
            Three steps, then you can forget about forgetting
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-8 sm:grid-cols-3">
          {steps.map((step, i) => (
            <Reveal key={step.title} delay={i * 0.05}>
              <div className="group flex flex-col items-center text-center sm:items-start sm:text-left">
                <div className="transition-transform duration-300 ease-out group-hover:-translate-y-1 group-hover:rotate-3">
                  <TappableRing
                    day={step.day}
                    month="Jun"
                    size="lg"
                    state={i === 2 ? "today" : "upcoming"}
                  />
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold text-ink transition-colors duration-300 group-hover:text-biro">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function GetTheApp() {
  return (
    <section id="get-the-app" className="mx-auto w-full max-w-5xl scroll-mt-20 px-5 py-20">
      <Reveal>
        <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-surface px-6 py-14 text-center sm:px-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(50%_100%_at_50%_0%,var(--biro-tint),transparent_70%)]"
          />
          <h2 className="font-display text-3xl font-semibold tracking-[-0.01em] text-ink sm:text-4xl">
            Start with the people you don&apos;t want to forget
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-ink-secondary">
            Free forever. Use it on the web right now, or get it on your phone for
            reminders and the home-screen widget.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className={`${buttonVariants({ size: "lg" })} hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-12px_rgba(44,75,216,0.6)]`}
            >
              Start for free
            </Link>
          </div>

          {/* Store badge placeholders - listings go live with the app (Stage 15). */}
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <StoreBadge platform="App Store" />
            <StoreBadge platform="Google Play" />
          </div>
          <p className="mt-4 text-xs text-ink-muted">Mobile apps coming soon.</p>
        </div>
      </Reveal>
    </section>
  );
}

function StoreBadge({ platform }: { platform: string }) {
  return (
    <span
      className="inline-flex h-12 cursor-default items-center gap-2.5 rounded-md border border-border-strong bg-surface px-4 text-ink-muted"
      aria-label={`${platform} - coming soon`}
    >
      <Smartphone size={20} aria-hidden="true" />
      <span className="flex flex-col items-start leading-none">
        <span className="text-[10px]">Coming soon to</span>
        <span className="text-sm font-medium text-ink-secondary">{platform}</span>
      </span>
    </span>
  );
}
