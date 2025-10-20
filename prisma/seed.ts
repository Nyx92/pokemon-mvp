// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function uploadMockImage(filename: string): Promise<string> {
  const filePath = path.join(process.cwd(), "public", filename);
  const fileBuffer = fs.readFileSync(filePath);

  const { data, error } = await supabase.storage
    .from("card-images")
    .upload(`mock/${filename}`, fileBuffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (error) throw new Error(`Failed to upload ${filename}: ${error.message}`);

  // ✅ Generate public URL
  const { data: publicUrl } = supabase.storage
    .from("card-images")
    .getPublicUrl(data.path);

  return publicUrl.publicUrl;
}

async function main() {
  console.log("🚀 Starting database seed...");

  // Optional cleanup (use carefully in production)
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.card.deleteMany();
  await prisma.binder.deleteMany();
  await prisma.user.deleteMany();

  // 🧂 Hash passwords before storing
  const ashPassword = await bcrypt.hash("123", 10);
  const mistyPassword = await bcrypt.hash("123", 10);

  // 🧍‍♂️ Create mock users
  const ash = await prisma.user.create({
    data: {
      firstName: "Ash",
      lastName: "Ketchum",
      email: "ash@pokemon.com",
      username: "ashketchum",
      password: ashPassword,
      role: "user",
      verified: true,
      country: "Japan",
      sex: "Male",
      dob: new Date("1990-05-22"),
      address: "Pallet Town",
      phoneNumber: "123456789",
    },
  });

  const misty = await prisma.user.create({
    data: {
      firstName: "Misty",
      lastName: "Waterflower",
      email: "misty@pokemon.com",
      username: "misty",
      password: mistyPassword,
      role: "user",
      verified: true,
      country: "Japan",
      sex: "Female",
      dob: new Date("1991-08-10"),
      address: "Cerulean City",
      phoneNumber: "987654321",
    },
  });

  console.log("✅ Users created:", ash.username, misty.username);

  // 📚 Create binders for Ash
  const rareBinder = await prisma.binder.create({
    data: {
      name: "Rare Holos",
      userId: ash.id,
    },
  });

  const grassBinder = await prisma.binder.create({
    data: {
      name: "Grass-Type Binder",
      userId: ash.id,
    },
  });

  console.log("✅ Binders created:", rareBinder.name, grassBinder.name);

  // Upload mock image to Supabase
  const mockImageUrl = await uploadMockImage("mock_inventory.png");
  console.log("✅ Uploaded mock image:", mockImageUrl);

  // 🃏 Create some cards
  const cards = await prisma.card.createMany({
    data: [
      {
        title: "Charizard VMAX",
        price: 120,
        condition: "Mint",
        description: "A stunning Charizard VMAX with fiery holo effect.",
        imageUrls: [mockImageUrl],
        forSale: true,
        status: "available",
        setName: "Shining Fates",
        rarity: "Ultra Rare",
        type: "Fire",
        binderId: rareBinder.id,
        ownerId: ash.id,
      },
      {
        title: "Venusaur V",
        price: 55,
        condition: "Good",
        description: "A Grass-type classic with nostalgic artwork.",
        imageUrls: [mockImageUrl],
        forSale: false,
        status: "available",
        setName: "Champion’s Path",
        rarity: "Rare",
        type: "Grass",
        binderId: grassBinder.id,
        ownerId: ash.id,
      },
      {
        title: "Blastoise Holo Rare",
        price: 80,
        condition: "Mint",
        description: "Classic Blastoise with vintage holo from Base Set.",
        imageUrls: [mockImageUrl],
        forSale: true,
        status: "available",
        setName: "Base Set",
        rarity: "Holo Rare",
        type: "Water",
        binderId: rareBinder.id,
        ownerId: ash.id,
      },
    ],
  });

  console.log("✅ Cards created:", cards.count);

  // 💸 Create an offer from Misty on one of Ash’s cards
  const charizard = await prisma.card.findFirst({
    where: { title: "Charizard VMAX" },
  });

  const offer = await prisma.offer.create({
    data: {
      price: 100,
      message: "Would you take 100 for this Charizard? It’s my favorite!",
      status: "pending",
      cardId: charizard!.id,
      buyerId: misty.id,
    },
  });

  console.log("✅ Offer created from Misty on:", charizard?.title);

  // 💬 Create a conversation between Ash and Misty about the Charizard
  const conversation = await prisma.conversation.create({
    data: {
      topic: "Negotiation about Charizard VMAX",
      cardId: charizard!.id,
      participants: {
        connect: [{ id: ash.id }, { id: misty.id }],
      },
    },
  });

  console.log("✅ Conversation created:", conversation.topic);

  // 💭 Add messages in the conversation
  await prisma.message.createMany({
    data: [
      {
        content:
          "Hey Ash! I saw your Charizard is for sale. Is it still available?",
        senderId: misty.id,
        conversationId: conversation.id,
      },
      {
        content: "Hey Misty! Yep, still available. It’s in mint condition.",
        senderId: ash.id,
        conversationId: conversation.id,
      },
      {
        content: "Awesome! Would you take 100 for it?",
        senderId: misty.id,
        conversationId: conversation.id,
      },
    ],
  });

  console.log("✅ Messages added to conversation");
  console.log("🌱 Seeding complete!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seeding failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
