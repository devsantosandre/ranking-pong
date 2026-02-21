export function getSingleEmoji(value: string | null | undefined): string {
  const text = (value ?? "").trim();
  if (!text) return "🏅";

  if (typeof Intl !== "undefined" && typeof Intl.Segmenter !== "undefined") {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    const iterator = segmenter.segment(text)[Symbol.iterator]();
    const first = iterator.next().value?.segment;
    if (first) return first;
  }

  return Array.from(text)[0] || "🏅";
}
