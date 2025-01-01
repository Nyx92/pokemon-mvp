import { useEffect, useState } from "react";
import axios from "axios";

const Success = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        // Make a POST request to the API to process the form and generate the PNG
        const response = await axios.post(
          "/api/submitForm",
          {},
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
  }, []);

  return (
    <div>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <p>Your document has been successfully downloaded!</p>
      )}
    </div>
  );
};

export default Success;
