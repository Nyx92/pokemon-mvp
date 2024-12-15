declare module "docx-pdf" {
  const convertDocxToPdf: (
    inputPath: string,
    outputPath: string,
    callback: (err?: Error) => void
  ) => void;

  export default convertDocxToPdf;
}
