// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { dollarsToCents } from "@/lib/money";

const prisma = new PrismaClient();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function uploadMockImage(filename: string): Promise<string> {
  const filePath = path.join(process.cwd(), "public/seed-images", filename);
  const fileBuffer = fs.readFileSync(filePath);

  const { data, error } = await supabase.storage
    .from("card-images")
    .upload(`mock/${filename}`, fileBuffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (error) throw new Error(`Failed to upload ${filename}: ${error.message}`);

  const { data: publicUrl } = supabase.storage
    .from("card-images")
    .getPublicUrl(data.path);

  return publicUrl.publicUrl;
}

async function main() {
  console.log("🚀 Starting database seed...");

  // ✅ Clean up (child tables first)
  // CardTransaction references Order/Card/User
  await prisma.cardTransaction.deleteMany();
  // Offer references Card/User
  await prisma.offer.deleteMany();
  // Order references Card/User
  await prisma.order.deleteMany();
  // Card references Binder/User
  await prisma.card.deleteMany();
  // Binder references User
  await prisma.binder.deleteMany();
  // User references Account/Session (if you have these tables populated in dev)
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  // Hash passwords
  const ashPassword = await bcrypt.hash("123", 10);
  const mistyPassword = await bcrypt.hash("123", 10);

  // Users
  const ash = await prisma.user.create({
    data: {
      firstName: "Ash",
      lastName: "Ketchum",
      email: "ash@pokemon.com",
      username: "ashketchum",
      password: ashPassword,
      role: "admin",
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

  // Binders
  const rareBinder = await prisma.binder.create({
    data: { name: "Rare Holos", userId: ash.id },
  });
  const grassBinder = await prisma.binder.create({
    data: { name: "Grass-Type Binder", userId: ash.id },
  });
  const waterBinder = await prisma.binder.create({
    data: { name: "Water Wonders", userId: misty.id },
  });

  console.log(
    "✅ Binders created:",
    rareBinder.name,
    grassBinder.name,
    waterBinder.name
  );

  // Upload mock image
  const mockImageUrlOne = await uploadMockImage("charizard_vmax.png");
  const mockImageUrlTwo = await uploadMockImage("venusaur_v.png");
  const mockImageUrlThree = await uploadMockImage("blastoise.png");
  const mockImageUrlFour = await uploadMockImage("starmie_gx.png");
  const mockImageUrlFive = await uploadMockImage("psyduck.png");
  const mockImageUrlSix = await uploadMockImage("gyarados_vmax.png");

  console.log("✅ Uploaded all mock images");

  // Ash’s Cards
  // Create cards (use create() so we can capture ids easily)
  const charizard = await prisma.card.create({
    data: {
      title: "Charizard VMAX",
      price: dollarsToCents(120),
      condition: "Mint",
      description: "A stunning Charizard VMAX with fiery holo effect.",
      imageUrls: [mockImageUrlOne],
      forSale: true,
      status: "available",
      setName: "Shining Fates",
      rarity: "Ultra Rare",
      binderId: rareBinder.id,
      ownerId: ash.id,
      tcgPlayerId: "232496",
      language: "English",
      cardNumber: "SV107",
    },
  });

  await prisma.card.createMany({
    data: [
      {
        title: "Venusaur V",
        price: null,
        condition: "Good",
        description: "A Grass-type classic with nostalgic artwork.",
        imageUrls: [mockImageUrlTwo],
        forSale: false,
        status: "available",
        setName: "Champion’s Path",
        rarity: "Rare",
        binderId: grassBinder.id,
        ownerId: ash.id,
        tcgPlayerId: "222990",
        language: "English",
        cardNumber: "01/73",
      },
      {
        title: "Blastoise Holo Rare",
        price: dollarsToCents(120),
        condition: "Mint",
        description: "Classic Blastoise with vintage holo from Base Set.",
        imageUrls: [mockImageUrlThree],
        forSale: true,
        status: "available",
        setName: "Base Set",
        rarity: "Holo Rare",
        binderId: rareBinder.id,
        ownerId: ash.id,
        tcgPlayerId: "42360",
        language: "English",
        cardNumber: "002/102",
      },
    ],
  });

  // Misty’s Cards 💧
  await prisma.card.createMany({
    data: [
      {
        title: "Starmie GX",
        price: dollarsToCents(60),
        condition: "Mint",
        description:
          "Misty’s loyal Water-type partner with a dazzling spin attack.",
        imageUrls: [mockImageUrlFour],
        forSale: true,
        status: "available",
        setName: "Hidden Fates",
        rarity: "Ultra Rare",
        binderId: waterBinder.id,
        ownerId: misty.id,
        tcgPlayerId: "197658",
        language: "English",
        cardNumber: "14/68 ",
      },
      {
        title: "Psyduck",
        price: null,
        condition: "Lightly Played",
        description: "A confused Psyduck that Misty adores.",
        imageUrls: [mockImageUrlFive],
        forSale: false,
        status: "available",
        setName: "Platinum (PL)",
        rarity: "Common",
        binderId: waterBinder.id,
        ownerId: misty.id,
        tcgPlayerId: "88439",
        language: "English",
        cardNumber: "87/127",
      },
      {
        title: "Gyarados VMAX",
        price: dollarsToCents(95),
        condition: "Near Mint",
        description: "A mighty Gyarados that dominates Misty’s team.",
        imageUrls: [mockImageUrlSix],
        forSale: true,
        status: "available",
        setName: "Evolving Skies",
        rarity: "Ultra Rare",
        binderId: waterBinder.id,
        ownerId: misty.id,
        tcgPlayerId: "246724",
        language: "English",
        cardNumber: "87/127",
      },
    ],
  });

  console.log("✅ Cards created for Ash and Misty");

  // Offer (updated to priceCents)
  const offer = await prisma.offer.create({
    data: {
      price: dollarsToCents(100),
      message: null,
      status: "pending",
      cardId: charizard.id,
      buyerId: misty.id,
    },
  });

  console.log(
    "✅ Offer created from Misty on:",
    charizard.title,
    "Offer:",
    offer.id
  );

  // (Optional) Seed a fake completed purchase flow: Order + Transaction
  // Useful to test your "purchases" UI
  const order = await prisma.order.create({
    data: {
      cardId: charizard.id,
      sellerId: ash.id,
      buyerId: misty.id,
      amount: charizard.price ?? dollarsToCents(120),
      currency: "sgd",
      status: "PAID",
      stripeCheckoutSessionId: "cs_test_seed_123",
      stripePaymentIntentId: "pi_test_seed_123",
    },
  });

  await prisma.cardTransaction.create({
    data: {
      orderId: order.id,
      cardId: charizard.id,
      sellerId: ash.id,
      buyerId: misty.id,
      amount: order.amount,
      currency: order.currency,
      stripeEventId: "evt_test_seed_123", // must be unique
    },
  });

  await prisma.card.update({
    where: { id: charizard.id },
    data: {
      ownerId: misty.id,
      status: "sold",
      forSale: false,
      reservedById: null,
      reservedUntil: null,
      reservedCheckoutSessionId: null,
      binderId: null, // optional
    },
  });

  console.log("✅ Seeded sample Order + CardTransaction");

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
