import Image from "next/image";
import styles from "./page.module.css";
import SegmentOne from "./home/SegmentOne";

export default function Home() {
  return (
    // The <main> tag helps improve the accessibility and SEO of your page by clearly defining where the central content starts and ends. Screen readers and search engines recognize this tag to identify the core information on the page.
    <main className={styles.main}>
      <SegmentOne />
    </main>
  );
}
