import path from "path";
import fs from "fs";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { exec } from "child_process";
import { NextApiRequest, NextApiResponse } from "next";
import { Stripe } from "stripe";
import { doctors } from "../../app/shared-components/data/doctors";

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
      // Step 1: Extract form data from the request body
      const inputData = req.body;
      console.log("Submitted Form Data: ", inputData);

      if (!inputData || !inputData.formData) {
        return res.status(400).json({ error: "Missing form data" });
      }

      // Step 2: Process and extend the extracted form data
      const processedFormData: FormData = {
        ...inputData.formData, // Access the nested formData
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
      const renderValues = {
        name: `${processedFormData.lastName} ${processedFormData.firstName}`,
        nric: processedFormData.nric,
        startDate: processedFormData.mcStartDate,
        endDate: processedFormData.mcEndDate,
        days: processedFormData.days,
        startDateNo: processedFormData.startDateNo,
        ran1: processedFormData.ran1,
        ran2: processedFormData.ran2,
        ran3: processedFormData.ran3,
        ran4: processedFormData.ran4,
        ran5: processedFormData.ran5,
        drName: randomDoctor.name,
        drId: randomDoctor.id,
      };

      // Pass the values to the document renderer
      doc.render(renderValues);

      // Step 5: Generate the updated Word document
      const buffer = doc.getZip().generate({
        type: "nodebuffer", // Generate a Node.js buffer
      });

      // Step 6: Write the updated document to a temp folder
      const tempFolderPath = path.join(process.cwd(), "temp");
      if (!fs.existsSync(tempFolderPath)) {
        fs.mkdirSync(tempFolderPath);
      }

      const uniqueId = Date.now(); // Generate a unique ID for the session
      // Step 7: Write the updated content to the temp folder
      const outputDocxPath = path.join(
        tempFolderPath,
        `output_${uniqueId}.docx`
      );

      console.log("Checking file exists at:", outputDocxPath);
      console.log("File exists:", fs.existsSync(outputDocxPath));

      fs.writeFileSync(outputDocxPath, buffer as unknown as Uint8Array); // Assert the buffer as Uint8Array

      // const outputPngPath = path.join(tempFolderPath, "output.png");
      const outputPngPath = path.join(tempFolderPath, `output_${uniqueId}.png`);

      const validateFileAccess = async (
        filePath: string,
        retries = 5,
        delay = 500
      ) => {
        for (let i = 0; i < retries; i++) {
          if (fs.existsSync(filePath)) {
            try {
              await fs.promises.access(
                filePath,
                fs.constants.R_OK | fs.constants.W_OK
              );
              console.log("File is accessible:", filePath);
              return;
            } catch (err) {
              console.warn(
                `File not accessible yet (Attempt ${i + 1}/${retries})...`
              );
            }
          }
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        throw new Error(
          `File not accessible after ${retries} attempts: ${filePath}`
        );
      };

      // Validate before invoking LibreOffice
      await validateFileAccess(outputDocxPath);

      // Step 8: Convert .docx to .png using LibreOffice CLI
      await new Promise<void>((resolve, reject) => {
        exec(
          `libreoffice --headless --convert-to png --outdir ${path.dirname(
            outputPngPath
          )} ${outputDocxPath}`,
          (err, stdout, stderr) => {
            console.log("LibreOffice stdout:", stdout);
            console.error("LibreOffice stderr:", stderr);

            if (err) {
              console.error("LibreOffice Conversion Error:", stderr);
              reject(err);
            } else {
              console.log("LibreOffice Conversion Success:", stdout);
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
