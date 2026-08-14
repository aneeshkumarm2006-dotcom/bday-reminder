import { CustomJsonLd } from "@/components/custom-json-ld";
import { jsonLdScript } from "@/lib/blog/url";
import { getSiteSettings } from "@/lib/content/get";
import {
  buildPageGraph,
  graphIds,
  graphTypes,
  type PageGraphInput,
} from "@/lib/content/page-graph";

/**
 * The single structured-data block for a public page.
 *
 * Every public route renders exactly one of these. It reads the admin's site
 * settings (React-cached, so it costs nothing on a page that already loaded
 * them), builds the graph, and escapes it through `jsonLdScript()`.
 *
 * The admin's per-page custom JSON-LD is emitted from here too, rather than
 * being a sibling element each route remembers to add. That's deliberate: the
 * de-duplication needs the list of `@id`s and types this graph just claimed, and
 * a route that forgot to pass them would silently allow a second Organization
 * onto the page.
 */
export async function PageGraph({
  customJsonLd = "",
  ...input
}: Omit<PageGraphInput, "settings"> & { customJsonLd?: string }) {
  const settings = await getSiteSettings();
  const graph = buildPageGraph({ ...input, settings });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(graph) }}
      />
      <CustomJsonLd
        json={customJsonLd}
        reserved={{ ids: graphIds(graph), types: graphTypes(graph) }}
      />
    </>
  );
}
