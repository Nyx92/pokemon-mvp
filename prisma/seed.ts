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
  const adminPassword = await bcrypt.hash("admin", 10);
  const ashPassword = await bcrypt.hash("123", 10);
  const mistyPassword = await bcrypt.hash("123", 10);

  // Users
  const admin = await prisma.user.create({
    data: {
      firstName: "admin",
      lastName: "admin",
      email: "admin@pokemon.com",
      username: "admin",
      password: adminPassword,
      role: "admin",
      verified: true,
      country: "admin",
      sex: "Male",
      dob: new Date("1990-05-22"),
      address: "admin",
      phoneNumber: "123456789",
    },
  });

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

  console.log(
    "✅ Users created:",
    admin.username,
    ash.username,
    misty.username
  );

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
      // ── Venusaur V — raw grades ─────────────────────────────────────────────
      {
        title: "Venusaur V",
        price: dollarsToCents(120),
        condition: "Near Mint",
        description: "A Grass-type classic with nostalgic artwork.",
        imageUrls: [mockImageUrlTwo],
        forSale: true,
        setName: "Champion’s Path",
        rarity: "Rare",
        binderId: grassBinder.id,
        ownerId: ash.id,
        tcgPlayerId: "222990",
        language: "English",
        cardNumber: "01/73",
      },
      {
        title: "Venusaur V",
        price: dollarsToCents(90),
        condition: "Lightly Played",
        description: "A Grass-type classic with nostalgic artwork.",
        imageUrls: [mockImageUrlTwo],
        forSale: true,
        setName: "Champion’s Path",
        rarity: "Rare",
        binderId: grassBinder.id,
        ownerId: ash.id,
        tcgPlayerId: "222990",
        language: "English",
        cardNumber: "01/73",
      },
      {
        title: "Venusaur V",
        price: dollarsToCents(65),
        condition: "Moderately Played",
        description: "A Grass-type classic with nostalgic artwork.",
        imageUrls: [mockImageUrlTwo],
        forSale: true,
        setName: "Champion’s Path",
        rarity: "Rare",
        binderId: grassBinder.id,
        ownerId: ash.id,
        tcgPlayerId: "222990",
        language: "English",
        cardNumber: "01/73",
      },
      {
        title: "Venusaur V",
        price: dollarsToCents(40),
        condition: "Heavily Played",
        description: "A Grass-type classic with nostalgic artwork.",
        imageUrls: [mockImageUrlTwo],
        forSale: true,
        setName: "Champion’s Path",
        rarity: "Rare",
        binderId: grassBinder.id,
        ownerId: ash.id,
        tcgPlayerId: "222990",
        language: "English",
        cardNumber: "01/73",
      },
      {
        title: "Venusaur V",
        price: null,
        condition: "Damaged",
        description: "A Grass-type classic with nostalgic artwork.",
        imageUrls: [mockImageUrlTwo],
        forSale: false,
        setName: "Champion’s Path",
        rarity: "Rare",
        binderId: grassBinder.id,
        ownerId: ash.id,
        tcgPlayerId: "222990",
        language: "English",
        cardNumber: "01/73",
      },
      // ── Venusaur V — graded ─────────────────────────────────────────────────
      {
        title: "Venusaur V",
        price: dollarsToCents(380),
        condition: "PSA 10",
        description: "PSA 10 Gem Mint — flawless Grass-type classic.",
        imageUrls: [mockImageUrlTwo],
        forSale: true,
        setName: "Champion’s Path",
        rarity: "Rare",
        binderId: grassBinder.id,
        ownerId: ash.id,
        tcgPlayerId: "222990",
        language: "English",
        cardNumber: "01/73",
      },
      {
        title: "Venusaur V",
        price: dollarsToCents(220),
        condition: "PSA 9",
        description: "PSA 9 Mint — near-perfect Grass-type classic.",
        imageUrls: [mockImageUrlTwo],
        forSale: true,
        setName: "Champion’s Path",
        rarity: "Rare",
        binderId: grassBinder.id,
        ownerId: ash.id,
        tcgPlayerId: "222990",
        language: "English",
        cardNumber: "01/73",
      },
      {
        title: "Venusaur V",
        price: dollarsToCents(290),
        condition: "Beckett 9.5 Gem Mint",
        description: "BGS 9.5 Gem Mint — stunning sub-grade Grass-type classic.",
        imageUrls: [mockImageUrlTwo],
        forSale: true,
        setName: "Champion’s Path",
        rarity: "Rare",
        binderId: grassBinder.id,
        ownerId: ash.id,
        tcgPlayerId: "222990",
        language: "English",
        cardNumber: "01/73",
      },
      // ── Blastoise Holo Rare — raw grades ────────────────────────────────────
      {
        title: "Blastoise Holo Rare",
        price: dollarsToCents(120),
        condition: "Mint",
        description: "Classic Blastoise with vintage holo from Base Set.",
        imageUrls: [mockImageUrlThree],
        forSale: true,
        setName: "Base Set",
        rarity: "Holo Rare",
        binderId: rareBinder.id,
        ownerId: ash.id,
        tcgPlayerId: "42360",
        language: "English",
        cardNumber: "002/102",
      },
      {
        title: "Blastoise Holo Rare",
        price: dollarsToCents(100),
        condition: "Near Mint",
        description: "Classic Blastoise with vintage holo from Base Set.",
        imageUrls: [mockImageUrlThree],
        forSale: true,
        setName: "Base Set",
        rarity: "Holo Rare",
        binderId: rareBinder.id,
        ownerId: ash.id,
        tcgPlayerId: "42360",
        language: "English",
        cardNumber: "002/102",
      },
      {
        title: "Blastoise Holo Rare",
        price: dollarsToCents(50),
        condition: "Heavily Played",
        description: "Classic Blastoise with vintage holo from Base Set.",
        imageUrls: [mockImageUrlThree],
        forSale: true,
        setName: "Base Set",
        rarity: "Holo Rare",
        binderId: rareBinder.id,
        ownerId: ash.id,
        tcgPlayerId: "42360",
        language: "English",
        cardNumber: "002/102",
      },
      // ── Blastoise Holo Rare — graded ────────────────────────────────────────
      {
        title: "Blastoise Holo Rare",
        price: dollarsToCents(480),
        condition: "PSA 8",
        description: "PSA 8 NM-MT — classic Blastoise holo in excellent shape.",
        imageUrls: [mockImageUrlThree],
        forSale: true,
        setName: "Base Set",
        rarity: "Holo Rare",
        binderId: rareBinder.id,
        ownerId: ash.id,
        tcgPlayerId: "42360",
        language: "English",
        cardNumber: "002/102",
      },
      {
        title: "Blastoise Holo Rare",
        price: dollarsToCents(350),
        condition: "CGC 9 Mint",
        description: "CGC 9 Mint — classic Blastoise holo certified by CGC.",
        imageUrls: [mockImageUrlThree],
        forSale: true,
        setName: "Base Set",
        rarity: "Holo Rare",
        binderId: rareBinder.id,
        ownerId: ash.id,
        tcgPlayerId: "42360",
        language: "English",
        cardNumber: "002/102",
      },
      {
        title: "Blastoise Holo Rare",
        price: null,
        condition: "SGC 9 Mint",
        description: "SGC 9 Mint — classic Blastoise holo certified by SGC.",
        imageUrls: [mockImageUrlThree],
        forSale: false,
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
      // ── Starmie GX — raw grades ─────────────────────────────────────────────
      {
        title: "Starmie GX",
        price: dollarsToCents(60),
        condition: "Mint",
        description:
          "Misty’s loyal Water-type partner with a dazzling spin attack.",
        imageUrls: [mockImageUrlFour],
        forSale: true,
        setName: "Hidden Fates",
        rarity: "Ultra Rare",
        binderId: waterBinder.id,
        ownerId: misty.id,
        tcgPlayerId: "197658",
        language: "English",
        cardNumber: "14/68",
      },
      {
        title: "Starmie GX",
        price: dollarsToCents(45),
        condition: "Near Mint",
        description:
          "Misty’s loyal Water-type partner with a dazzling spin attack.",
        imageUrls: [mockImageUrlFour],
        forSale: true,
        setName: "Hidden Fates",
        rarity: "Ultra Rare",
        binderId: waterBinder.id,
        ownerId: misty.id,
        tcgPlayerId: "197658",
        language: "English",
        cardNumber: "14/68",
      },
      {
        title: "Starmie GX",
        price: dollarsToCents(28),
        condition: "Lightly Played",
        description:
          "Misty’s loyal Water-type partner with a dazzling spin attack.",
        imageUrls: [mockImageUrlFour],
        forSale: true,
        setName: "Hidden Fates",
        rarity: "Ultra Rare",
        binderId: waterBinder.id,
        ownerId: misty.id,
        tcgPlayerId: "197658",
        language: "English",
        cardNumber: "14/68",
      },
      {
        title: "Starmie GX",
        price: null,
        condition: "Damaged",
        description:
          "Misty’s loyal Water-type partner with a dazzling spin attack.",
        imageUrls: [mockImageUrlFour],
        forSale: false,
        setName: "Hidden Fates",
        rarity: "Ultra Rare",
        binderId: waterBinder.id,
        ownerId: misty.id,
        tcgPlayerId: "197658",
        language: "English",
        cardNumber: "14/68",
      },
      // ── Starmie GX — graded ─────────────────────────────────────────────────
      {
        title: "Starmie GX",
        price: dollarsToCents(180),
        condition: "PSA 9",
        description: "PSA 9 Mint — Misty’s Starmie GX in near-perfect shape.",
        imageUrls: [mockImageUrlFour],
        forSale: true,
        setName: "Hidden Fates",
        rarity: "Ultra Rare",
        binderId: waterBinder.id,
        ownerId: misty.id,
        tcgPlayerId: "197658",
        language: "English",
        cardNumber: "14/68",
      },
      {
        title: "Starmie GX",
        price: dollarsToCents(140),
        condition: "Beckett 9.5 Gem Mint",
        description: "BGS 9.5 Gem Mint — beautifully graded Starmie GX.",
        imageUrls: [mockImageUrlFour],
        forSale: true,
        setName: "Hidden Fates",
        rarity: "Ultra Rare",
        binderId: waterBinder.id,
        ownerId: misty.id,
        tcgPlayerId: "197658",
        language: "English",
        cardNumber: "14/68",
      },
      // ── Psyduck ─────────────────────────────────────────────────────────────
      {
        title: "Psyduck",
        price: null,
        condition: "Lightly Played",
        description: "A confused Psyduck that Misty adores.",
        imageUrls: [mockImageUrlFive],
        forSale: false,
        setName: "Platinum",
        rarity: "Common",
        binderId: waterBinder.id,
        ownerId: misty.id,
        tcgPlayerId: "88439",
        language: "English",
        cardNumber: "87/127",
      },
      {
        title: "Psyduck",
        price: dollarsToCents(8),
        condition: "Near Mint",
        description: "A confused Psyduck that Misty adores.",
        imageUrls: [mockImageUrlFive],
        forSale: true,
        setName: "Platinum",
        rarity: "Common",
        binderId: waterBinder.id,
        ownerId: misty.id,
        tcgPlayerId: "88439",
        language: "English",
        cardNumber: "87/127",
      },
      {
        title: "Psyduck",
        price: dollarsToCents(120),
        condition: "PSA 10",
        description: "PSA 10 Gem Mint — a surprisingly valuable Psyduck.",
        imageUrls: [mockImageUrlFive],
        forSale: true,
        setName: "Platinum",
        rarity: "Common",
        binderId: waterBinder.id,
        ownerId: misty.id,
        tcgPlayerId: "88439",
        language: "English",
        cardNumber: "87/127",
      },
      // ── Gyarados VMAX — raw grades ──────────────────────────────────────────
      {
        title: "Gyarados VMAX",
        price: dollarsToCents(95),
        condition: "Near Mint",
        description: "A mighty Gyarados that dominates Misty’s team.",
        imageUrls: [mockImageUrlSix],
        forSale: true,
        setName: "Evolving Skies",
        rarity: "Ultra Rare",
        binderId: waterBinder.id,
        ownerId: misty.id,
        tcgPlayerId: "246724",
        language: "English",
        cardNumber: "109/203",
      },
      {
        title: "Gyarados VMAX",
        price: dollarsToCents(70),
        condition: "Lightly Played",
        description: "A mighty Gyarados that dominates Misty’s team.",
        imageUrls: [mockImageUrlSix],
        forSale: true,
        setName: "Evolving Skies",
        rarity: "Ultra Rare",
        binderId: waterBinder.id,
        ownerId: misty.id,
        tcgPlayerId: "246724",
        language: "English",
        cardNumber: "109/203",
      },
      {
        title: "Gyarados VMAX",
        price: dollarsToCents(35),
        condition: "Heavily Played",
        description: "A mighty Gyarados that dominates Misty’s team.",
        imageUrls: [mockImageUrlSix],
        forSale: true,
        setName: "Evolving Skies",
        rarity: "Ultra Rare",
        binderId: waterBinder.id,
        ownerId: misty.id,
        tcgPlayerId: "246724",
        language: "English",
        cardNumber: "109/203",
      },
      // ── Gyarados VMAX — graded ──────────────────────────────────────────────
      {
        title: "Gyarados VMAX",
        price: dollarsToCents(320),
        condition: "PSA 10",
        description: "PSA 10 Gem Mint — the apex predator, perfectly graded.",
        imageUrls: [mockImageUrlSix],
        forSale: true,
        setName: "Evolving Skies",
        rarity: "Ultra Rare",
        binderId: waterBinder.id,
        ownerId: misty.id,
        tcgPlayerId: "246724",
        language: "English",
        cardNumber: "109/203",
      },
      {
        title: "Gyarados VMAX",
        price: dollarsToCents(210),
        condition: "CGC 9.5 Gem Mint",
        description: "CGC 9.5 Gem Mint — top-tier Gyarados VMAX.",
        imageUrls: [mockImageUrlSix],
        forSale: true,
        setName: "Evolving Skies",
        rarity: "Ultra Rare",
        binderId: waterBinder.id,
        ownerId: misty.id,
        tcgPlayerId: "246724",
        language: "English",
        cardNumber: "109/203",
      },
      {
        title: "Gyarados VMAX",
        price: dollarsToCents(175),
        condition: "SGC 9 Mint",
        description: "SGC 9 Mint — certified Gyarados VMAX.",
        imageUrls: [mockImageUrlSix],
        forSale: true,
        setName: "Evolving Skies",
        rarity: "Ultra Rare",
        binderId: waterBinder.id,
        ownerId: misty.id,
        tcgPlayerId: "246724",
        language: "English",
        cardNumber: "109/203",
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
      stripeEventId: "evt_test_seed_123",
      tcgPlayerId: "232496",
    },
  });

  await prisma.card.update({
    where: { id: charizard.id },
    data: {
      ownerId: misty.id,
      forSale: false,
      reservedById: null,
      reservedUntil: null,
      reservedCheckoutSessionId: null,
      binderId: null,
    },
  });

  console.log("✅ Seeded sample Order + CardTransaction");

  // ── Additional transactions so Highest Transacted has data ──────────────────
  // Look up one card per tcgPlayerId to use as the sold card reference
  const venusaurCard = await prisma.card.findFirst({
    where: { tcgPlayerId: "222990", ownerId: ash.id },
  });
  const blastoiseCard = await prisma.card.findFirst({
    where: { tcgPlayerId: "42360", ownerId: ash.id },
  });
  const starmieCard = await prisma.card.findFirst({
    where: { tcgPlayerId: "197658", ownerId: misty.id },
  });
  const gyaradosCard = await prisma.card.findFirst({
    where: { tcgPlayerId: "246724", ownerId: misty.id },
  });

  const extraTransactions = [
    // Venusaur V — 4 transactions (most transacted)
    { card: venusaurCard, tcgPlayerId: "222990", seller: ash, buyer: misty, events: ["evt_seed_ven_1", "evt_seed_ven_2", "evt_seed_ven_3", "evt_seed_ven_4"] },
    // Blastoise — 3 transactions
    { card: blastoiseCard, tcgPlayerId: "42360", seller: ash, buyer: misty, events: ["evt_seed_bla_1", "evt_seed_bla_2", "evt_seed_bla_3"] },
    // Starmie GX — 2 transactions
    { card: starmieCard, tcgPlayerId: "197658", seller: misty, buyer: ash, events: ["evt_seed_sta_1", "evt_seed_sta_2"] },
    // Gyarados VMAX — 2 transactions
    { card: gyaradosCard, tcgPlayerId: "246724", seller: misty, buyer: ash, events: ["evt_seed_gya_1", "evt_seed_gya_2"] },
  ];

  for (const { card, tcgPlayerId, seller, buyer, events } of extraTransactions) {
    if (!card) continue;
    for (const stripeEventId of events) {
      const extraOrder = await prisma.order.create({
        data: {
          cardId: card.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amount: card.price ?? dollarsToCents(50),
          currency: "sgd",
          status: "PAID",
        },
      });
      await prisma.cardTransaction.create({
        data: {
          orderId: extraOrder.id,
          cardId: card.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amount: extraOrder.amount,
          currency: extraOrder.currency,
          stripeEventId,
          tcgPlayerId,
        },
      });
    }
  }

  console.log("✅ Seeded extra transactions for Highest Transacted");

  // ── Best Sellers (admin-curated) ─────────────────────────────────────────────
  await prisma.bestSeller.createMany({
    data: [
      { tcgPlayerId: "232496", position: 1 }, // Charizard VMAX
      { tcgPlayerId: "42360",  position: 2 }, // Blastoise Holo Rare
      { tcgPlayerId: "222990", position: 3 }, // Venusaur V
      { tcgPlayerId: "197658", position: 4 }, // Starmie GX
      { tcgPlayerId: "246724", position: 5 }, // Gyarados VMAX
    ],
  });

  console.log("✅ Seeded Best Sellers");

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
