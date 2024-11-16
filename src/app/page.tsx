import SegmentOne from "./home/SegmentOne";
import SegmentTwo from "./home/SegmentTwo";

export default function Home() {
  return (
    // The <main> tag helps improve the accessibility and SEO of your page by clearly defining where the central content starts and ends. Screen readers and search engines recognize this tag to identify the core information on the page.
    <main>
      <SegmentOne />
      <SegmentTwo />
    </main>
  );
}
