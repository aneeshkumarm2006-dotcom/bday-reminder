import Script from "next/script";

import type { SiteSettings } from "@/lib/content/types";

/**
 * Analytics tags, driven by IDs from Site settings.
 *
 * The admin is a single shared password, so a "paste your tracking snippet"
 * textarea would be a self-inflicted XSS hole: anyone with the password could
 * ship arbitrary JavaScript to every visitor. Instead the admin stores *IDs*
 * (validated against `G-…`, `GTM-…`, digits), and they're interpolated into
 * these fixed templates. The regex guards mean the interpolated value can't
 * contain quotes, angle brackets, or anything else script-shaped.
 */

/** Belt and braces: only ever emit an ID that still matches its format. */
function safeId(value: string, pattern: RegExp): string | null {
  const trimmed = value.trim();
  return trimmed && pattern.test(trimmed) ? trimmed : null;
}

export function AnalyticsScripts({ analytics }: { analytics: SiteSettings["analytics"] }) {
  const ga4 = safeId(analytics.ga4MeasurementId, /^G-[A-Z0-9]+$/i);
  const gtm = safeId(analytics.gtmContainerId, /^GTM-[A-Z0-9]+$/i);
  const pixel = safeId(analytics.metaPixelId, /^\d{8,20}$/);

  return (
    <>
      {ga4 && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${ga4}');
          `}
          </Script>
        </>
      )}

      {gtm && (
        <Script id="google-tag-manager" strategy="afterInteractive">
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${gtm}');
          `}
        </Script>
      )}

      {pixel && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window,document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${pixel}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}
    </>
  );
}
