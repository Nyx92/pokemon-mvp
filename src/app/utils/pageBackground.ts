// Darkened full-bleed background for a page — low opacity so it reads as
// atmosphere behind the page content, not a focal element.
export function pageBackgroundSx(imageUrl: string) {
  return {
    backgroundColor: "#0a0c10",
    backgroundImage: `linear-gradient(rgba(8, 10, 14, 0.8), rgba(8, 10, 14, 0.8)), url('${imageUrl}')`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundAttachment: "fixed",
  };
}
