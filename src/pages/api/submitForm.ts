import path from "path";
import fs from "fs";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { differenceInDays } from "date-fns";
import { NextApiRequest, NextApiResponse } from "next";

interface FormData {
  firstName: string;
  lastName: string;
  nric: string;
  mcStartDate: string;
  mcEndDate: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    try {
      // Step 1: Parse the form data from the request body
      const { firstName, lastName, nric, mcStartDate, mcEndDate }: FormData =
        req.body;

      // Step 2: Load the Word template (located in the `templates` directory)
      const templatePath = path.join(
        process.cwd(),
        "templates",
        "template.docx"
      );
      const content = fs.readFileSync(templatePath, "binary");

      // Step 3: Load the template into Docxtemplater
      const zip = new PizZip(content); // Use PizZip instead of JSZip
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });

      // Step 4: Replace placeholders in the template
      const days =
        differenceInDays(new Date(mcEndDate), new Date(mcStartDate)) + 1;
      doc.setData({
        name: `${firstName} ${lastName}`,
        nric: nric,
        startDate: mcStartDate,
        endDate: mcEndDate,
        days: days,
      });

      // Step 5: Render the document with replacements
      doc.render();

      // Step 6: Generate the updated Word document
      const buffer = doc.getZip().generate({
        type: "nodebuffer", // Generate a Node.js buffer
      });

      // Step 7: Save the updated document temporarily
      const tempFolderPath = path.join(process.cwd(), "temp");
      if (!fs.existsSync(tempFolderPath)) {
        fs.mkdirSync(tempFolderPath);
      }

      const outputPath = path.join(tempFolderPath, "output.docx");
      fs.writeFileSync(outputPath, buffer);

      // Step 8: Send the updated Word document back to the client
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="output.docx"'
      );
      res.send(buffer);

      // Clean up temporary files (optional)
      fs.unlinkSync(outputPath);
    } catch (error) {
      console.error("Error generating document:", error);
      res.status(500).json({ error: "Error generating document" });
    }
  } else {
    res.status(405).json({ error: "Method Not Allowed" });
  }
}
