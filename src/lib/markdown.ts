/**
 * Lightweight Markdown → HTML renderer.
 * Supports: **bold**, *italic*, `inline code`, ```code blocks```, auto-link URLs.
 * HTML-escapes first, then applies transforms.
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderMarkdown(text: string): string {
  // Escape HTML
  let html = escapeHtml(text);

  // Code blocks: ```...```
  html = html.replace(
    /```([\s\S]*?)```/g,
    (_, code) =>
      `<pre class="bg-surface-hover rounded-md px-3 py-2 text-xs overflow-x-auto my-1"><code>${code.trim()}</code></pre>`
  );

  // Inline code: `...`
  html = html.replace(
    /`([^`\n]+)`/g,
    '<code class="bg-surface-hover rounded px-1 py-0.5 text-xs">$1</code>'
  );

  // Bold: **...**
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic: *...*
  html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");

  // Auto-link URLs
  html = html.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-accent-fg hover:underline break-all">$1</a>'
  );

  // Newlines to <br>
  html = html.replace(/\n/g, "<br>");

  return html;
}
