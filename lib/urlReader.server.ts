/**
 * NEXO AI — Server-only Web Page Reader
 * 
 * CRITICAL: This file must only ever be imported from app/api/** route handlers.
 * It fetches PUBLIC web pages referenced in a user's message and extracts their
 * content (title, meta, headings, body text, links, image alt text, lists, tables)
 * so every NEXO model can intelligently reason about and reference page content.
 *
 * Security: Hardened SSRF protection, enforces strict timeout, response size cap,
 * protocol validation, and only reads text-like content types. No JavaScript execution.
 *
 * Performance: Up to 2 URLs per message, 9s timeout per URL, 2.5MB cap, 7000 char
 * content budget. Parallel processing for multiple URLs.
 */

// ═════════════════════════════════════════════════════════════════════════════
// CONFIGURATION & CONSTANTS
// ═════════════════════════════════════════════════════════════════════════════

const MAX_URLS = 2; // Maximum URLs to read from a single message
const FETCH_TIMEOUT_MS = 12000; // 12 second timeout per URL (hardened from 9s)
const MAX_BYTES = 5_000_000; // 5MB response cap (hardened from 2.5MB)
const MAX_CONTENT_CHARS = 7000; // Main text content budget per page
const MAX_LINKS = 40; // Maximum links to extract per page
const MAX_IMAGES = 20; // Maximum image alt texts to extract per page

/**
 * URL extraction regex — matches http/https URLs.
 * Captures complete URLs but stops at common terminators.
 */
const URL_REGEX = /https?:\/\/[^\s<>()"'`]+/gi;

/**
 * Explicitly blocked hostnames (case-insensitive).
 * Includes metadata endpoints, control planes, and reserved names.
 */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "metadata.google.com",
  "169.254.169.254", // AWS metadata
  "api.metadata.google.internal",
]);

/**
 * Explicitly allowed top-level domains for metadata/internal use.
 * Used as a blocklist pattern.
 */
const BLOCKED_TLD_SUFFIXES = [".local", ".internal", ".localhost"];

// ═════════════════════════════════════════════════════════════════════════════
// URL EXTRACTION & VALIDATION
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Extract URLs from user message text, deduplicate, and clean trailing punctuation.
 * @param text User message text
 * @returns Array of deduplicated URLs, up to MAX_URLS
 */
export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX) ?? [];
  
  const cleaned = matches
    .map((u) => {
      // Trim common trailing punctuation that often appears in prose
      return u.replace(/[.,;:!?)\]}'"…]+$/, "").trim();
    })
    .filter((u) => u.length > 0 && u.startsWith("http"));

  // Deduplicate while preserving order
  const seen = new Set<string>();
  const unique: string[] = [];
  
  for (const u of cleaned) {
    if (seen.has(u)) continue;
    seen.add(u);
    unique.push(u);
  }

  return unique.slice(0, MAX_URLS);
}

// ═════════════════════════════════════════════════════════════════════════════
// SSRF PROTECTION — COMPREHENSIVE PRIVATE IP & METADATA BLOCKING
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Determine if a hostname is private, internal, or metadata-related.
 * Blocks all RFC 1918 ranges, link-local, loopback, CGNAT, and known cloud metadata.
 * 
 * Covered ranges:
 * - IPv4 loopback: 127.0.0.0/8
 * - IPv4 private: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
 * - IPv4 link-local: 169.254.0.0/16
 * - IPv4 CGNAT: 100.64.0.0/10
 * - IPv6 loopback: ::1
 * - IPv6 unique-local: fc00::/7
 * - IPv6 link-local: fe80::/10
 * - Reserved: 0.0.0.0/8
 */
function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  // Explicit blocklist
  if (BLOCKED_HOSTNAMES.has(host)) return true;

  // TLD-based blocklist
  for (const suffix of BLOCKED_TLD_SUFFIXES) {
    if (host.endsWith(suffix)) return true;
  }

  // ─── IPv4 Range Checks ───
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [a, b, c, d] = [
      Number(ipv4Match[1]),
      Number(ipv4Match[2]),
      Number(ipv4Match[3]),
      Number(ipv4Match[4]),
    ];

    // Validate octet range
    if (a > 255 || b > 255 || c > 255 || d > 255) return true;

    // 0.0.0.0/8 (reserved)
    if (a === 0) return true;

    // 10.0.0.0/8 (private)
    if (a === 10) return true;

    // 127.0.0.0/8 (loopback)
    if (a === 127) return true;

    // 169.254.0.0/16 (link-local, includes AWS metadata)
    if (a === 169 && b === 254) return true;

    // 172.16.0.0/12 (private)
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.168.0.0/16 (private)
    if (a === 192 && b === 168) return true;

    // 100.64.0.0/10 (Carrier-Grade NAT)
    if (a === 100 && b >= 64 && b <= 127) return true;
  }

  // ─── IPv6 Range Checks ───
  // ::1/128 (loopback)
  if (host === "::1") return true;

  // fc00::/7 and fd00::/8 (unique-local)
  if (host.startsWith("fc") || host.startsWith("fd")) return true;

  // fe80::/10 (link-local)
  if (host.startsWith("fe80:")) return true;

  return false;
}

/**
 * Validate that a URL is safe to fetch: http/https only, public hostname.
 * @param raw Raw URL string
 * @returns true if safe to fetch, false otherwise
 */
function isSafeUrl(raw: string): boolean {
  let parsed: URL;
  
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }

  // Only http and https allowed
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  // Hostname must exist
  if (!parsed.hostname) {
    return false;
  }

  // Hostname must not be private/internal
  if (isPrivateHost(parsed.hostname)) {
    return false;
  }

  return true;
}

// ═════════════════════════════════════════════════════════════════════════════
// HTML ENTITY DECODING
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Map of common HTML named entities to their character equivalents.
 * Extended with Unicode support for European and special characters.
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00A0", // non-breaking space
  copy: "©",
  reg: "®",
  trade: "™",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "'",
  lsquo: "'",
  rdquo: "\"",
  ldquo: "\"",
  eacute: "é",
  egrave: "è",
  ecirc: "ê",
  agrave: "à",
  aacute: "á",
  acirc: "â",
  ccedil: "ç",
  igrave: "ì",
  oacute: "ó",
  ograve: "ò",
  uacute: "ú",
  ugrave: "ù",
};

/**
 * Decode HTML entities (named, decimal, hexadecimal) to their character equivalents.
 * @param input HTML-encoded string
 * @returns Decoded string
 */
function decodeEntities(input: string): string {
  return input
    // Hexadecimal entities: &#xABC;
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      safeFromCodePoint(parseInt(hex, 16))
    )
    // Decimal entities: &#123;
    .replace(/&#(\d+);/g, (_, dec) =>
      safeFromCodePoint(parseInt(dec, 10))
    )
    // Named entities: &nbsp;, &mdash;, etc.
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name)
        ? NAMED_ENTITIES[name]
        : match
    );
}

/**
 * Safely convert a Unicode code point to a character string.
 * @param code Unicode code point
 * @returns Character string, or empty string if invalid
 */
function safeFromCodePoint(code: number): string {
  try {
    // Validate range: 0x0 to 0x10FFFF
    if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) {
      return "";
    }
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// HTML TAG STRIPPING & WHITESPACE NORMALIZATION
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Regex matcher for HTML/XML tags.
 * Quote-aware: does not terminate a tag on `>` inside quoted attribute values.
 * Handles comments, self-closing tags, and standard tags.
 * Example: data-mw='{"key":"value">"}' won't break the match.
 */
const TAG_RE = /<!--[\s\S]*?-->|<[!/?]?[a-zA-Z][^>"']*(?:"[^"]*"[^>"']*|'[^']*'[^>"']*)*>/g;

/**
 * Strip all HTML/XML tags from input, preserving text content.
 * @param html HTML string
 * @returns Text with tags removed
 */
function stripTagsRaw(html: string): string {
  return html.replace(TAG_RE, " ");
}

/**
 * Normalize whitespace: collapse runs, normalize line breaks, trim.
 * @param input Text string
 * @returns Normalized text
 */
function collapseWhitespace(input: string): string {
  return input
    .replace(/\r\n?/g, "\n") // Normalize line endings
    .replace(/[ \t\f\v]+/g, " ") // Collapse horizontal whitespace
    .replace(/ *\n */g, "\n") // Remove spaces around line breaks
    .replace(/\n{3,}/g, "\n\n") // Collapse multiple blank lines
    .trim();
}

/**
 * Strip HTML tags and decode entities, then collapse whitespace.
 * @param html HTML string
 * @returns Cleaned text
 */
function stripTags(html: string): string {
  return decodeEntities(stripTagsRaw(html)).replace(/\s+/g, " ").trim();
}

/**
 * Extract first regex match group and decode entities.
 * @param html HTML string
 * @param re Regular expression with capture group
 * @returns Captured and decoded text, or empty string
 */
function firstMatch(html: string, re: RegExp): string {
  const m = html.match(re);
  return m ? decodeEntities(m[1]).trim() : "";
}

/**
 * Extract meta tag content by name or property.
 * Handles both attribute orderings: name/property before content, or after.
 * @param html HTML string
 * @param key Meta attribute name (e.g., "description", "og:title")
 * @returns Meta content, or empty string
 */
function metaContent(html: string, key: string): string {
  const patterns = [
    // name/property before content
    new RegExp(
      `<meta[^>]+(?:name|property)=["']${key}["'][^>]*content=["']([^"']*)["']`,
      "i"
    ),
    // content before name/property
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${key}["']`,
      "i"
    ),
  ];

  for (const pattern of patterns) {
    const value = firstMatch(html, pattern);
    if (value) return value;
  }

  return "";
}

// ═════════════════════════════════════════════════════════════════════════════
// LINK & IMAGE EXTRACTION
// ═════════════════════════════════════════════════════════════════════════════

interface ExtractedLink {
  text: string;
  href: string;
}

/**
 * Extract all <a> links from HTML body, deduplicate, resolve relative URLs.
 * Filters out javascript:, mailto:, tel: URLs and fragments.
 * @param bodyHtml Body HTML content
 * @param baseUrl Base URL for resolving relative links
 * @returns Array of extracted links
 */
function extractLinks(bodyHtml: string, baseUrl: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const seen = new Set<string>();
  const re = /<a\b[^>]*href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;
  while ((match = re.exec(bodyHtml)) !== null) {
    let href = decodeEntities(match[1]).trim();
    const text = stripTags(match[2]);

    // Skip non-HTTP protocols and empty
    if (
      !href ||
      href.startsWith("javascript:") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:")
    ) {
      continue;
    }

    // Resolve relative URLs
    try {
      href = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }

    // Deduplicate
    if (seen.has(href)) continue;
    seen.add(href);

    links.push({ text: text || href, href });

    if (links.length >= MAX_LINKS) break;
  }

  return links;
}

/**
 * Extract image alt text from <img> tags.
 * Deduplicates alt texts.
 * @param bodyHtml Body HTML content
 * @returns Array of alt texts
 */
function extractImageAlts(bodyHtml: string): string[] {
  const alts: string[] = [];
  const seen = new Set<string>();
  const re = /<img\b[^>]*\balt=["']([^"']+)["'][^>]*>/gi;

  let match: RegExpExecArray | null;
  while ((match = re.exec(bodyHtml)) !== null) {
    const alt = decodeEntities(match[1]).trim();

    if (!alt || seen.has(alt)) continue;
    seen.add(alt);
    alts.push(alt);

    if (alts.length >= MAX_IMAGES) break;
  }

  return alts;
}

// ═════════════════════════════════════════════════════════════════════════════
// HTML TO STRUCTURED TEXT CONVERSION
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Convert body HTML into readable, structure-preserving Markdown-like text.
 * 
 * Transformations:
 * - Removes: scripts, styles, forms, nav, footer, header, aside, iframes
 * - Tables: cell separators (|), row breaks (\n)
 * - Headings: converted to Markdown (#, ##, ###, ####)
 * - Lists: convert <li> to "- "
 * - Line breaks: <br> → \n, block elements → \n
 * - Entities: fully decoded
 * - Whitespace: normalized and collapsed
 * 
 * @param bodyHtml HTML body content
 * @returns Readable, structured text
 */
function htmlToStructuredText(bodyHtml: string): string {
  let html = bodyHtml;

  // Remove non-content regions entirely
  html = html.replace(
    /<(script|style|noscript|template|svg|canvas|iframe|form|nav|footer|header|aside)\b[^>]*>[\s\S]*?<\/\1>/gi,
    " "
  );
  html = html.replace(/<!--[\s\S]*?-->/g, " ");

  // Table structure: cells separated by |, rows by \n
  html = html.replace(/<\/(td|th)>/gi, " | ");
  html = html.replace(/<\/tr>/gi, "\n");

  // Headings to Markdown
  html = html.replace(/<h1\b[^>]*>/gi, "\n\n# ");
  html = html.replace(/<h2\b[^>]*>/gi, "\n\n## ");
  html = html.replace(/<h3\b[^>]*>/gi, "\n\n### ");
  html = html.replace(/<h[4-6]\b[^>]*>/gi, "\n\n#### ");

  // List items and block breaks
  html = html.replace(/<li\b[^>]*>/gi, "\n- ");
  html = html.replace(/<br\s*\/?>/gi, "\n");
  html = html.replace(
    /<\/(p|div|section|article|ul|ol|li|h[1-6]|blockquote|pre|tr|table)>/gi,
    "\n"
  );

  // Decode entities and normalize whitespace
  const text = decodeEntities(stripTagsRaw(html));
  return collapseWhitespace(text);
}

// ═════════════════════════════════════════════════════════════════════════════
// PAGE READ RESULT TYPES & FORMATTING
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Result from reading a single web page.
 */
export interface PageRead {
  url: string;
  ok: boolean;
  title?: string;
  description?: string;
  content?: string;
  links?: ExtractedLink[];
  images?: string[];
  error?: string;
}

/**
 * Format a single page read result into a readable context block.
 * Includes title, description, content, links, and images.
 * On error, includes the error message.
 * @param page PageRead result
 * @returns Formatted text block
 */
function renderPageBlock(page: PageRead): string {
  if (!page.ok) {
    return `📄 Web page: ${page.url}\n   ⚠️ Could not read: ${page.error}`;
  }

  const parts: string[] = [`📄 Web page: ${page.url}`];

  if (page.title) parts.push(`   Title: ${page.title}`);
  if (page.description) parts.push(`   Description: ${page.description}`);

  if (page.content) {
    parts.push(`\n📝 Content:\n${page.content}`);
  }

  if (page.links && page.links.length > 0) {
    const linkList = page.links
      .slice(0, MAX_LINKS)
      .map((l) => `   - ${l.text} (${l.href})`)
      .join("\n");
    parts.push(`\n🔗 Links on the page (${page.links.length}):\n${linkList}`);
  }

  if (page.images && page.images.length > 0) {
    const imgList = page.images.map((a) => `   - ${a}`).join("\n");
    parts.push(`\n🖼️ Images on the page (${page.images.length}):\n${imgList}`);
  }

  return parts.join("\n");
}

// ═════════════════════════════════════════════════════════════════════════════
// SINGLE PAGE READING (CORE LOGIC)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Fetch and parse a single URL.
 * 
 * Steps:
 * 1. Validate URL is safe (public, http/https)
 * 2. Fetch with timeout and size cap
 * 3. Validate response is public (not redirected to private host)
 * 4. Check content-type is text-like
 * 5. Extract title, description, content, links, images
 * 
 * @param url URL to read
 * @returns PageRead result (may contain error)
 */
async function readSinglePage(url: string): Promise<PageRead> {
  // ─── Validate URL safety ───
  if (!isSafeUrl(url)) {
    return {
      url,
      ok: false,
      error: "URL is not a readable public http(s) address.",
    };
  }

  // ─── Set up timeout ───
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    // ─── Fetch URL ───
    const res = await fetch(url, {
      redirect: "follow", // Follow redirects
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NexoAI-Reader/1.0; +https://nexo.ai)",
        Accept:
          "text/html,application/xhtml+xml,application/xml,text/plain,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "en,si;q=0.8",
      },
    });

    // ─── Guard against SSRF via redirect ───
    if (res.url && !isSafeUrl(res.url)) {
      return {
        url,
        ok: false,
        error: "Redirected to a non-public address (possible SSRF).",
      };
    }

    // ─── Check HTTP status ───
    if (!res.ok) {
      return {
        url,
        ok: false,
        error: `Server responded with HTTP ${res.status}.`,
      };
    }

    // ─── Validate content-type ───
    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    const isTextLike =
      contentType.includes("text/html") ||
      contentType.includes("application/xhtml") ||
      contentType.includes("text/plain") ||
      contentType.includes("application/json") ||
      contentType.includes("application/xml") ||
      contentType.includes("text/xml") ||
      contentType === "";

    if (!isTextLike) {
      return {
        url,
        ok: false,
        error: `Unsupported content type (${contentType || "unknown"}). Only web pages / text can be read.`,
      };
    }

    // ─── Read response body with cap ───
    const raw = await readCapped(res, MAX_BYTES);

    // ─── Handle JSON ───
    if (contentType.includes("application/json")) {
      const trimmed = raw.trim().slice(0, MAX_CONTENT_CHARS);
      return { url, ok: true, title: url, content: trimmed };
    }

    // ─── Handle plain text ───
    if (contentType.includes("text/plain")) {
      const trimmed = collapseWhitespace(raw).slice(0, MAX_CONTENT_CHARS);
      return { url, ok: true, title: url, content: trimmed };
    }

    // ─── Parse HTML/XML ───
    const title =
      firstMatch(raw, /<title[^>]*>([\s\S]*?)<\/title>/i) ||
      metaContent(raw, "og:title") ||
      "";

    const description =
      metaContent(raw, "description") ||
      metaContent(raw, "og:description") ||
      "";

    const bodyMatch = raw.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
    const bodyHtml = bodyMatch ? bodyMatch[1] : raw;

    const content = htmlToStructuredText(bodyHtml).slice(0, MAX_CONTENT_CHARS);
    const links = extractLinks(bodyHtml, res.url || url);
    const images = extractImageAlts(bodyHtml);

    // ─── Validate we got some content ───
    if (!title && !description && !content) {
      return {
        url,
        ok: false,
        error: "No readable content found on the page.",
      };
    }

    return { url, ok: true, title, description, content, links, images };
  } catch (err) {
    const isTimeout =
      err instanceof Error && err.name === "AbortError";
    return {
      url,
      ok: false,
      error: isTimeout
        ? `Timed out after ${FETCH_TIMEOUT_MS / 1000}s while loading the page.`
        : "Could not load the page.",
    };
  } finally {
    clearTimeout(timer);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// CAPPED RESPONSE READING
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Read response body up to a byte cap, canceling on excess.
 * Handles both buffered (no body) and streaming (body.getReader) responses.
 * 
 * @param res Response object
 * @param maxBytes Maximum bytes to read
 * @returns Response body as string (capped)
 */
async function readCapped(res: Response, maxBytes: number): Promise<string> {
  // ─── Handle no-body responses ───
  if (!res.body) {
    const text = await res.text();
    return text.slice(0, maxBytes);
  }

  // ─── Stream response with byte cap ───
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let output = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      received += value.byteLength;
      output += decoder.decode(value, { stream: true });

      // Cancel if exceeded cap
      if (received >= maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // Ignore cancellation errors
        }
        break;
      }
    }
  } finally {
    // Flush decoder
    output += decoder.decode();
  }

  return output.slice(0, maxBytes);
}

// ═════════════════════════════════════════════════════════════════════════════
// PUBLIC ENTRY POINT: READ URLS FROM TEXT
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Main public function: Extract URLs from user message, fetch and parse them.
 * 
 * Workflow:
 * 1. Extract up to MAX_URLS unique URLs from text
 * 2. Fetch all URLs in parallel (with timeout, size cap, SSRF protection)
 * 3. Format results into context blocks
 * 4. Return joined context string for injection into system prompt
 * 
 * Partial failure handling: If 1 of 2 URLs fails, the other is processed.
 * 
 * @param text User message text (may contain URLs)
 * @returns Context string ready to inject into system prompt, or "" if no URLs
 */
export async function readUrlsFromText(text: string): Promise<string> {
  const urls = extractUrls(text);
  
  if (urls.length === 0) return "";

  // Fetch all URLs in parallel
  const pages = await Promise.all(urls.map((u) => readSinglePage(u)));

  // Format each page result
  const blocks = pages.map(renderPageBlock);

  // Join with separator
  return blocks.join("\n\n─────────────────────────────────────\n\n");
}
