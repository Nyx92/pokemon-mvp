import { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

// This creates an instance of the Stripe client library, which provides methods to interact with the Stripe API.
// The stripe object is an instance of the Stripe Software Development Kit, and it exposes methods to interact with Stripe services.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// This is a configuration export that Next.js recognizes as specific to the current API route.
// It's used to adjust the behavior of the API endpoint
export const config = {
  api: {
    // Normally, Next.js parses the request body automatically into JSON or other formats for you to use (req.body)
    // If Next.js parses the body into JSON, the raw data is lost, and signature verification will fail.
    bodyParser: false, // Stripe requires the raw body for signature verification
  },
};

// Helper function to read the raw body
// ：Promise<Buffer> This defines the return type of the function. It means that getRawBody will return a Promise that resolves to a Buffer.
// A Buffer in Node.js represents a sequence of raw binary data.
// This function is necessary as raw body is not accessible through req by default in Next.js API routes.
async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // An empty array to store the incoming chunks of data from the request.
    const chunks: Buffer[] = [];
    // req.on("data"): Listens for the data event on the request object. This event is emitted when a chunk of data is received.
    // chunk: The raw data received in this event.
    // Buffer.from(chunk): Converts the chunk into a Buffer object
    // chunks.push(...): Adds the chunk to the chunks array.
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    //  Listens for the end event, which is emitted when all data has been received.
    // Buffer.concat(chunks): Combines all the chunks in the chunks array into a single Buffer
    // resolve(...): Resolves the promise with the combined Buffer.
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", (err) => reject(err));
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    let event: Stripe.Event;

    try {
      const rawBody = await getRawBody(req); // Get the raw body
      const signature = req.headers["stripe-signature"]; // Stripe signature

      if (!signature) {
        throw new Error("Missing Stripe signature header.");
      }

      // Verify the Stripe event
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET! // Add your webhook secret in `.env.local`
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
    }

    // Handle the event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      try {
        // Extract metadata (form data) from the Stripe session
        const formData = JSON.parse(session.metadata?.formData || "{}");
        console.log("Form Data:", formData);

        // Add your logic to generate PNG or process the form data
        console.log("Generating PNG for:", formData);

        // TODO: Implement PNG generation and storage or response logic
      } catch (err) {
        console.error("Error processing form data:", err);
      }
    }

    // Respond to Stripe to acknowledge the event
    res.status(200).json({ received: true });
  } else {
    res.setHeader("Allow", "POST");
    res.status(405).end("Method Not Allowed");
  }
}
