// Phones get smaller images. Unsplash photos are resized by the URL, other images are left as they are.
export const isPhone = () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

export function sized(url, width) {
  if (!url || !url.includes("images.unsplash.com")) return url;
  const u = new URL(url);
  u.searchParams.set("w", String(width));
  u.searchParams.set("auto", "format");
  u.searchParams.set("fit", "crop");
  u.searchParams.set("q", "70");
  return u.toString();
}
