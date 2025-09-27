import SegmentTwo from "./home/segmenttwo/SegmentTwo";
import Carousell from "./home/Carousell/Carousell";

export default function Home() {
  return (
    // The <main> tag helps improve the accessibility and SEO of your page by clearly defining where the central content starts and ends. Screen readers and search engines recognize this tag to identify the core information on the page.
    <main>
      <Carousell />
      <SegmentTwo />
    </main>
  );
}
