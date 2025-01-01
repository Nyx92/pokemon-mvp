import path from "path";
import fs from "fs";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { exec } from "child_process";
import { NextApiRequest, NextApiResponse } from "next";
import { Stripe } from "stripe";
import { doctors } from "../../app/shared-components/data/doctors";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

interface FormData {
  firstName: string;
  lastName: string;
  nric: string;
  mcStartDate: string;
  mcEndDate: string;
  startDateNo: string;
  days: string;
  ran1: number;
  ran2: number;
  ran3: number;
  ran4: number;
  ran5: number;
}

export default async function handler(
  // req: NextApiRequest: Access the incoming request (e.g., body, query parameters, headers).
  req: NextApiRequest,

  // res: NextApiResponse: Send a response back to the client (e.g., set HTTP status, send data).
  res: NextApiResponse
) {
  if (req.method === "POST") {
    try {
      // Step 1: Retrieve the Stripe session ID from the request body
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({ error: "Missing Stripe session ID" });
      }

      // Step 2: Retrieve the session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (!session || !session.metadata) {
        return res
          .status(400)
          .json({ error: "Invalid session or metadata missing" });
      }

      // Step 3: Extract metadata (form data) from the Stripe session
      const formData: FormData = {
        firstName: session.metadata.firstName!,
        lastName: session.metadata.lastName!,
        nric: session.metadata.nric!,
        mcStartDate: session.metadata.mcStartDate!,
        mcEndDate: session.metadata.mcEndDate!,
        startDateNo: session.metadata.startDateNo!,
        days: session.metadata.days!,
        ran1: Math.floor(100 + Math.random() * 900),
        ran2: Math.floor(100 + Math.random() * 900),
        ran3: Math.floor(100 + Math.random() * 900),
        ran4: Math.floor(100 + Math.random() * 900),
        ran5: Math.floor(100 + Math.random() * 900),
      };

      // Select a random doctor from the list
      const randomDoctor = doctors[Math.floor(Math.random() * doctors.length)];

      // Step 2: Load the Word template (located in the `templates` directory)
      // path is a Node.js core module used for handling and manipulating file and directory paths
      // path.join joins multiple path segments into a single path string. It automatically handles the correct directory separator (/ or \) based on the operating system.
      // In other words, templatePath allows the application to find the template.docx so that it can be loaded
      const templatePath = path.join(
        process.cwd(), // Root of the project
        "src", // Navigate into 'src'
        "app", // Navigate into 'app'
        "templates", // Navigate into 'templates'
        "template.docx" // File name
      );

      // fs stands for File System. It is a Node.js core module for interacting with the file system (reading, writing, deleting files, etc.).
      // A synchronous method for reading the content of a file. It blocks the execution of the script until the file is fully read.
      // The "binary" option tells Node.js to read the file as raw binary data instead of converting it to a string. The file's contents are stored in the variable content as a string of raw binary data.
      const content = fs.readFileSync(templatePath, "binary");

      // Step 3: Load the template into Docxtemplater
      const zip = new PizZip(content);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });

      // Step 4: Dynamically replace values in word doc
      doc.render({
        name: `${formData.lastName} ${formData.firstName}`,
        nric: formData.nric,
        startDate: formData.mcStartDate,
        endDate: formData.mcEndDate,
        days: formData.days,
        startDateNo: formData.startDateNo,
        ran1: formData.ran1,
        ran2: formData.ran2,
        ran3: formData.ran3,
        ran4: formData.ran4,
        ran5: formData.ran5,
        drName: randomDoctor.name,
        drId: randomDoctor.id,
      });

      // Step 5: Generate the updated Word document
      const buffer = doc.getZip().generate({
        type: "nodebuffer", // Generate a Node.js buffer
      });

      // Step 6: Write the updated document to a temp folder
      const tempFolderPath = path.join(process.cwd(), "temp");
      if (!fs.existsSync(tempFolderPath)) {
        fs.mkdirSync(tempFolderPath);
      }

      // Step 7: Write the updated content to the temp folder
      const outputDocxPath = path.join(tempFolderPath, "output.docx");
      fs.writeFileSync(outputDocxPath, buffer);

      const outputPngPath = path.join(tempFolderPath, "output.png");

      // Step 8: Convert .docx to .png using LibreOffice CLI
      await new Promise<void>((resolve, reject) => {
        exec(
          `libreoffice --headless --convert-to png --outdir ${tempFolderPath} ${outputDocxPath}`,
          (err) => {
            if (err) {
              console.error("Error converting to PNG:", err);
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });

      // Step 9: Send the PNG file to the client
      const pngBuffer = fs.readFileSync(outputPngPath);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Content-Disposition", 'attachment; filename="output.png"');
      res.send(pngBuffer);

      // Step 9: Cleanup temporary files
      fs.unlinkSync(outputDocxPath);
      fs.unlinkSync(outputPngPath);
    } catch (error) {
      console.error("Error generating document:", error);
      res.status(500).json({ error: "Error generating document" });
    }
  } else {
    res.status(405).json({ error: "Method Not Allowed" });
  }
}
