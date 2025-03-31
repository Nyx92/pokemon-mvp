"use client";
import { useEffect, useState, useRef } from "react";
import axios from "axios";
import SegmentOne from "./SegmentOne";
import SegmentTwo from "./SegmentTwo";

const Success = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false); // Ref to track API call

  useEffect(() => {
    if (hasFetched.current) return; // Ensure only one call

    const fetchDocument = async () => {
      // Retrieve sessionId from the URL query parameter
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get("session_id");

      if (!sessionId) {
        alert("Session ID missing in the URL!");
        setLoading(false);
        return;
      }

      hasFetched.current = true; // Set flag to true only after validation

      try {
        // Fetch session details from backend retrieve-session
        const sessionResponse = await axios.get(
          `/api/retrieve-session?session_id=${sessionId}`
        );

        const formDataString = sessionResponse.data.metadata?.formData;

        if (!formDataString) {
          alert("Form data missing in Stripe session metadata!");
          setLoading(false);
          return;
        }

        const formData = JSON.parse(formDataString);

        // Make a POST request to the API to process the form and generate the PNG
        const response = await axios.post(
          "/api/submitForm",
          { formData },
          { responseType: "blob" } // Important to handle the binary response (PNG file)
        );

        // Create a blob from the response
        // creating a new Blob allows you to explicitly set its type, without specifying the type, the file might not be handled correctly when displayed or downloaded.
        const blob = new Blob([response.data], {
          type: response.headers["content-type"],
        });
        // URL.createObjectURL(blob) generates a temporary URL that represents the data contained in the blob.
        // This "Blob URL" serves as a reference to the raw data stored in memory, and by attaching it to an anchor (<a>) element with the download attribute, you effectively instruct the browser to: Recognize the Blob data as a file and allow the user to download the file when they click the link.
        const url = window.URL.createObjectURL(blob);

        // Creates an HTML <a> (anchor) element dynamically using JavaScript.
        const link = document.createElement("a");
        // Assigns the temporary blob: URL to the href attribute of the <a> element.
        link.href = url;
        // Sets the download attribute of the <a> element to "certificate.png".
        link.download = "certificate.png";
        // Sets the download attribute of the <a> element to "certificate.png".
        document.body.appendChild(link);
        // Simulates a user clicking the link.
        link.click();
        //Removes the <a> element from the DOM after the download starts.
        link.remove();

        // Revoke the URL to release memory
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Error generating document:", error);
        alert("Failed to generate document. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [hasFetched]);

  return (
    // The <main> tag helps improve the accessibility and SEO of your page by clearly defining where the central content starts and ends. Screen readers and search engines recognize this tag to id  entify the core information on the page.
    <main>
      <SegmentOne />
      <SegmentTwo />
    </main>
  );
};

export default Success;
