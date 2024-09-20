import SegmentOne from "./SegmentOne";
import SegmentTwo from "./SegmentTwo";
import SegmentThree from "./SegmentThree";

export default function Programmes() {
  return (
    // The <main> tag helps improve the accessibility and SEO of your page by clearly defining where the central content starts and ends. Screen readers and search engines recognize this tag to id  entify the core information on the page.
    <main>
      <SegmentOne />
      <SegmentTwo />
      <SegmentThree />
    </main>
  );
}
