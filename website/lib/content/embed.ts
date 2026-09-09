/**
 * Turn a video URL an editor pasted into something renderable.
 *
 * The admin types the address they were given — a YouTube watch page, a `youtu.be`
 * short link, a Vimeo page, or a file they uploaded — and this resolves it to
 * either a privacy-preserving embed URL or a plain file. Anything it can't
 * recognise returns `null`, which the renderer shows as "unsupported" rather
 * than dropping an iframe onto an arbitrary host.
 *
 * YouTube resolves to `youtube-nocookie.com`, which is also the host the HTML
 * block's sanitizer prefers — one allow-list, one behaviour.
 */
export type ResolvedVideo =
  | { kind: "iframe"; src: string; title: string }
  | { kind: "file"; src: string };

const FILE_EXTENSIONS = /\.(mp4|webm|ogg|ogv|mov)(\?.*)?$/i;

export function resolveVideo(rawUrl: string): ResolvedVideo | null {
  const value = rawUrl.trim();
  if (!value) return null;

  // A file we host (or any direct media URL) needs no third party at all.
  if (FILE_EXTENSIONS.test(value)) return { kind: "file", src: value };

  let url: URL;
  try {
    url = new URL(value, "https://birthdayreminders.us");
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = url.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return id ? youTube(id, url.searchParams.get("t")) : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v");
      return id ? youTube(id, url.searchParams.get("t")) : null;
    }
    // /embed/<id>, /shorts/<id> and /live/<id> all carry the id in the path.
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length === 2 && ["embed", "shorts", "live", "v"].includes(parts[0])) {
      return youTube(parts[1], url.searchParams.get("t"));
    }
    return null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean).pop();
    return id && /^\d+$/.test(id)
      ? { kind: "iframe", src: `https://player.vimeo.com/video/${id}`, title: "Vimeo video player" }
      : null;
  }

  return null;
}

function youTube(rawId: string, start: string | null): ResolvedVideo | null {
  const id = rawId.replace(/[^\w-]/g, "");
  if (!id) return null;
  const seconds = start ? Number.parseInt(start, 10) : NaN;
  const query = Number.isFinite(seconds) && seconds > 0 ? `?start=${seconds}` : "";
  return {
    kind: "iframe",
    src: `https://www.youtube-nocookie.com/embed/${id}${query}`,
    title: "YouTube video player",
  };
}
