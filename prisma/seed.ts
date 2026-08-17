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
  // Bid references Auction
  await prisma.bid.deleteMany();
  // CardTransaction references Order/Listing/User
  await prisma.cardTransaction.deleteMany();
  // Offer references Listing/User
  await prisma.offer.deleteMany();
  // Order references Listing/User
  await prisma.order.deleteMany();
  // Auction references Listing/User
  await prisma.auction.deleteMany();
  // Listing references Binder/User/catalog tables
  await prisma.listing.deleteMany();
  // Catalog tables are standalone (only referenced by Listing, already cleared above)
  await prisma.pokemonCardCatalog.deleteMany();
  await prisma.riftboundCardCatalog.deleteMany();
  // Binder references User
  await prisma.binder.deleteMany();
  // User references Account/Session (if you have these tables populated in dev)
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  // BestSeller is standalone
  await prisma.bestSeller.deleteMany();
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
  const mockImageUrlSix   = await uploadMockImage("gyarados_vmax.png");
  const mockImageUrlShuckle = await uploadMockImage("shuckle_psa10.png");

  console.log("✅ Uploaded all mock images");

  // ── Pokémon catalog — one row per real card, shared by every listing of it ──
  // externalId values are invented "mock-*" slugs: this seed data predates any
  // real card-index import, so there's no real source-index id to carry over.
  // setId is likewise an invented short set code (schema requires it as a
  // non-nullable field alongside setNameEn) paired one-to-one with setNameEn,
  // the same way the Riftbound catalog below pairs setId "UNL" with setLabel
  // "Unleashed" — not sourced from a real card index.
  const pokemonCatalog = {
    charizardVmax: await prisma.pokemonCardCatalog.create({
      data: {
        externalId: "mock-shining-fates-charizard-vmax",
        nameEn: "Charizard VMAX",
        localId: "SV107",
        setId: "SHF",
        setNameEn: "Shining Fates",
        rarity: "Ultra Rare",
        language: "English",
        tcgPlayerId: "232496",
      },
    }),
    venusaurV: await prisma.pokemonCardCatalog.create({
      data: {
        externalId: "mock-champions-path-venusaur-v",
        nameEn: "Venusaur V",
        localId: "01/73",
        setId: "CPA",
        setNameEn: "Champion's Path",
        rarity: "Rare",
        language: "English",
        tcgPlayerId: "222990",
      },
    }),
    blastoiseHoloRare: await prisma.pokemonCardCatalog.create({
      data: {
        externalId: "mock-base-set-blastoise-holo-rare",
        nameEn: "Blastoise Holo Rare",
        localId: "002/102",
        setId: "BS",
        setNameEn: "Base Set",
        rarity: "Holo Rare",
        language: "English",
        tcgPlayerId: "42360",
      },
    }),
    starmieGxEn: await prisma.pokemonCardCatalog.create({
      data: {
        externalId: "mock-hidden-fates-starmie-gx-en",
        nameEn: "Starmie GX",
        localId: "14/68",
        setId: "HIF",
        setNameEn: "Hidden Fates",
        rarity: "Ultra Rare",
        language: "English",
        tcgPlayerId: "197658",
      },
    }),
    // Separate catalog row for the Japanese print — language is catalog-level
    // (per the design spec), so a different-language print of the same card
    // is a different catalog row, not a per-listing field.
    starmieGxJp: await prisma.pokemonCardCatalog.create({
      data: {
        externalId: "mock-hidden-fates-starmie-gx-jp",
        nameEn: "Starmie GX",
        localId: "14/68",
        setId: "HIF",
        setNameEn: "Hidden Fates",
        rarity: "Ultra Rare",
        language: "Japanese",
        tcgPlayerId: "197659",
      },
    }),
    psyduck: await prisma.pokemonCardCatalog.create({
      data: {
        externalId: "mock-platinum-psyduck",
        nameEn: "Psyduck",
        localId: "87/127",
        setId: "PL",
        setNameEn: "Platinum",
        rarity: "Common",
        language: "English",
        tcgPlayerId: "88439",
      },
    }),
    gyaradosVmax: await prisma.pokemonCardCatalog.create({
      data: {
        externalId: "mock-evolving-skies-gyarados-vmax",
        nameEn: "Gyarados VMAX",
        localId: "109/203",
        setId: "EVS",
        setNameEn: "Evolving Skies",
        rarity: "Ultra Rare",
        language: "English",
        tcgPlayerId: "246724",
      },
    }),
    shuckle: await prisma.pokemonCardCatalog.create({
      data: {
        externalId: "mock-neo-revelation-shuckle",
        nameEn: "Shuckle",
        localId: "70/64",
        setId: "NRV",
        setNameEn: "Neo Revelation",
        rarity: "Common",
        language: "English",
        tcgPlayerId: "14936",
      },
    }),
    psyduckV: await prisma.pokemonCardCatalog.create({
      data: {
        externalId: "mock-fusion-strike-psyduck-v",
        nameEn: "Psyduck V",
        localId: "062/100",
        setId: "FST",
        setNameEn: "Fusion Strike",
        rarity: "Rare",
        language: "Japanese",
        tcgPlayerId: "441629",
      },
    }),
    // The "quick-expiry test auctions" section (below) originally had three
    // listings whose tcgPlayerId/set/number didn't match any of the cards
    // above. Two of them — Psyduck (Base Set) and Gyarados VMAX (Vivid
    // Voltage), the two catalog rows below — get their own new catalog rows
    // rather than silently pointing at the wrong card's identity now that
    // identity is normalized. The third (the 7-minute test auction,
    // auctionCard10, originally labeled "Starmie GX" with a stray
    // tcgPlayerId that actually belonged to Shuckle) has set/card-number
    // data that matches the existing starmieGxEn row exactly, so it's
    // re-pointed at starmieGxEn instead, dropping the stray tcgPlayerId.
    psyduckBaseSet: await prisma.pokemonCardCatalog.create({
      data: {
        externalId: "mock-base-set-psyduck",
        nameEn: "Psyduck",
        localId: "053/102",
        setId: "BS",
        setNameEn: "Base Set",
        rarity: "Common",
        language: "English",
        tcgPlayerId: "88900",
      },
    }),
    gyaradosVmaxVividVoltage: await prisma.pokemonCardCatalog.create({
      data: {
        externalId: "mock-vivid-voltage-gyarados-vmax",
        nameEn: "Gyarados VMAX",
        localId: "022/185",
        setId: "VIV",
        setNameEn: "Vivid Voltage",
        rarity: "Ultra Rare",
        language: "English",
        tcgPlayerId: "246800",
      },
    }),
  };

  console.log("✅ Pokémon catalog created:", Object.keys(pokemonCatalog).length, "cards");

  // Ash’s Cards
  // Create listings (use create() so we can capture ids easily)
  const charizard = await prisma.listing.create({
    data: {
      game: "POKEMON",
      pokemonCardId: pokemonCatalog.charizardVmax.id,
      price: dollarsToCents(120),
      condition: "Mint",
      description: "A stunning Charizard VMAX with fiery holo effect.",
      imageUrls: [mockImageUrlOne],
      forSale: true,
      binderId: rareBinder.id,
      ownerId: ash.id,
    },
  });

  await prisma.listing.createMany({
    data: [
      // ── Venusaur V — raw grades ─────────────────────────────────────────────
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.venusaurV.id,
        price: dollarsToCents(120),
        condition: "Near Mint",
        description: "A Grass-type classic with nostalgic artwork.",
        imageUrls: [mockImageUrlTwo],
        forSale: true,
        binderId: grassBinder.id,
        ownerId: ash.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.venusaurV.id,
        price: dollarsToCents(90),
        condition: "Lightly Played",
        description: "A Grass-type classic with nostalgic artwork.",
        imageUrls: [mockImageUrlTwo],
        forSale: true,
        binderId: grassBinder.id,
        ownerId: ash.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.venusaurV.id,
        price: dollarsToCents(65),
        condition: "Moderately Played",
        description: "A Grass-type classic with nostalgic artwork.",
        imageUrls: [mockImageUrlTwo],
        forSale: true,
        binderId: grassBinder.id,
        ownerId: ash.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.venusaurV.id,
        price: dollarsToCents(40),
        condition: "Heavily Played",
        description: "A Grass-type classic with nostalgic artwork.",
        imageUrls: [mockImageUrlTwo],
        forSale: true,
        binderId: grassBinder.id,
        ownerId: ash.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.venusaurV.id,
        price: null,
        condition: "Damaged",
        description: "A Grass-type classic with nostalgic artwork.",
        imageUrls: [mockImageUrlTwo],
        forSale: false,
        binderId: grassBinder.id,
        ownerId: ash.id,
      },
      // ── Venusaur V — graded ─────────────────────────────────────────────────
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.venusaurV.id,
        price: dollarsToCents(380),
        condition: "PSA 10",
        description: "PSA 10 Gem Mint — flawless Grass-type classic.",
        imageUrls: [mockImageUrlTwo],
        forSale: true,
        binderId: grassBinder.id,
        ownerId: ash.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.venusaurV.id,
        price: dollarsToCents(220),
        condition: "PSA 9",
        description: "PSA 9 Mint — near-perfect Grass-type classic.",
        imageUrls: [mockImageUrlTwo],
        forSale: true,
        binderId: grassBinder.id,
        ownerId: ash.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.venusaurV.id,
        price: dollarsToCents(290),
        condition: "Beckett 9.5 Gem Mint",
        description: "BGS 9.5 Gem Mint — stunning sub-grade Grass-type classic.",
        imageUrls: [mockImageUrlTwo],
        forSale: true,
        binderId: grassBinder.id,
        ownerId: ash.id,
      },
      // ── Blastoise Holo Rare — raw grades ────────────────────────────────────
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.blastoiseHoloRare.id,
        price: dollarsToCents(120),
        condition: "Mint",
        description: "Classic Blastoise with vintage holo from Base Set.",
        imageUrls: [mockImageUrlThree],
        forSale: true,
        binderId: rareBinder.id,
        ownerId: ash.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.blastoiseHoloRare.id,
        price: dollarsToCents(100),
        condition: "Near Mint",
        description: "Classic Blastoise with vintage holo from Base Set.",
        imageUrls: [mockImageUrlThree],
        forSale: true,
        binderId: rareBinder.id,
        ownerId: ash.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.blastoiseHoloRare.id,
        price: dollarsToCents(50),
        condition: "Heavily Played",
        description: "Classic Blastoise with vintage holo from Base Set.",
        imageUrls: [mockImageUrlThree],
        forSale: true,
        binderId: rareBinder.id,
        ownerId: ash.id,
      },
      // ── Blastoise Holo Rare — graded ────────────────────────────────────────
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.blastoiseHoloRare.id,
        price: dollarsToCents(480),
        condition: "PSA 8",
        description: "PSA 8 NM-MT — classic Blastoise holo in excellent shape.",
        imageUrls: [mockImageUrlThree],
        forSale: true,
        binderId: rareBinder.id,
        ownerId: ash.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.blastoiseHoloRare.id,
        price: dollarsToCents(350),
        condition: "CGC 9 Mint",
        description: "CGC 9 Mint — classic Blastoise holo certified by CGC.",
        imageUrls: [mockImageUrlThree],
        forSale: true,
        binderId: rareBinder.id,
        ownerId: ash.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.blastoiseHoloRare.id,
        price: null,
        condition: "SGC 9 Mint",
        description: "SGC 9 Mint — classic Blastoise holo certified by SGC.",
        imageUrls: [mockImageUrlThree],
        forSale: false,
        binderId: rareBinder.id,
        ownerId: ash.id,
      },
    ],
  });

  // Misty’s Cards 💧
  await prisma.listing.createMany({
    data: [
      // ── Starmie GX — raw grades ─────────────────────────────────────────────
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.starmieGxEn.id,
        price: dollarsToCents(60),
        condition: "Mint",
        description: "Misty’s loyal Water-type partner with a dazzling spin attack.",
        imageUrls: [mockImageUrlFour],
        forSale: true,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.starmieGxEn.id,
        price: dollarsToCents(45),
        condition: "Near Mint",
        description: "Misty’s loyal Water-type partner with a dazzling spin attack.",
        imageUrls: [mockImageUrlFour],
        forSale: true,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.starmieGxEn.id,
        price: dollarsToCents(28),
        condition: "Lightly Played",
        description: "Misty’s loyal Water-type partner with a dazzling spin attack.",
        imageUrls: [mockImageUrlFour],
        forSale: true,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.starmieGxEn.id,
        price: null,
        condition: "Damaged",
        description: "Misty’s loyal Water-type partner with a dazzling spin attack.",
        imageUrls: [mockImageUrlFour],
        forSale: false,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
      // ── Starmie GX — graded ─────────────────────────────────────────────────
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.starmieGxEn.id,
        price: dollarsToCents(180),
        condition: "PSA 9",
        description: "PSA 9 Mint — Misty’s Starmie GX in near-perfect shape.",
        imageUrls: [mockImageUrlFour],
        forSale: true,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.starmieGxEn.id,
        price: dollarsToCents(140),
        condition: "Beckett 9.5 Gem Mint",
        description: "BGS 9.5 Gem Mint — beautifully graded Starmie GX.",
        imageUrls: [mockImageUrlFour],
        forSale: true,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
      // ── Psyduck ─────────────────────────────────────────────────────────────
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.psyduck.id,
        price: null,
        condition: "Lightly Played",
        description: "A confused Psyduck that Misty adores.",
        imageUrls: [mockImageUrlFive],
        forSale: false,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.psyduck.id,
        price: dollarsToCents(8),
        condition: "Near Mint",
        description: "A confused Psyduck that Misty adores.",
        imageUrls: [mockImageUrlFive],
        forSale: true,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.psyduck.id,
        price: dollarsToCents(120),
        condition: "PSA 10",
        description: "PSA 10 Gem Mint — a surprisingly valuable Psyduck.",
        imageUrls: [mockImageUrlFive],
        forSale: true,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
      // ── Gyarados VMAX — raw grades ──────────────────────────────────────────
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.gyaradosVmax.id,
        price: dollarsToCents(95),
        condition: "Near Mint",
        description: "A mighty Gyarados that dominates Misty’s team.",
        imageUrls: [mockImageUrlSix],
        forSale: true,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.gyaradosVmax.id,
        price: dollarsToCents(70),
        condition: "Lightly Played",
        description: "A mighty Gyarados that dominates Misty’s team.",
        imageUrls: [mockImageUrlSix],
        forSale: true,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.gyaradosVmax.id,
        price: dollarsToCents(35),
        condition: "Heavily Played",
        description: "A mighty Gyarados that dominates Misty’s team.",
        imageUrls: [mockImageUrlSix],
        forSale: true,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
      // ── Gyarados VMAX — graded ──────────────────────────────────────────────
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.gyaradosVmax.id,
        price: dollarsToCents(320),
        condition: "PSA 10",
        description: "PSA 10 Gem Mint — the apex predator, perfectly graded.",
        imageUrls: [mockImageUrlSix],
        forSale: true,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.gyaradosVmax.id,
        price: dollarsToCents(210),
        condition: "CGC 9.5 Gem Mint",
        description: "CGC 9.5 Gem Mint — top-tier Gyarados VMAX.",
        imageUrls: [mockImageUrlSix],
        forSale: true,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.gyaradosVmax.id,
        price: dollarsToCents(175),
        condition: "SGC 9 Mint",
        description: "SGC 9 Mint — certified Gyarados VMAX.",
        imageUrls: [mockImageUrlSix],
        forSale: true,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
    ],
  });

  console.log("✅ Listings created for Ash and Misty");

  // ── Extra best-seller listings ─────────────────────────────────────────────
  // Two more listings to fill positions 6 and 7 in the Best Sellers row.
  await prisma.listing.createMany({
    data: [
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.shuckle.id,
        price: dollarsToCents(220),
        condition: "PSA 10",
        description: "PSA 10 Gem Mint — the rarest Shuckle you'll ever see.",
        imageUrls: [mockImageUrlShuckle],
        forSale: true,
        binderId: rareBinder.id,
        ownerId: ash.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.shuckle.id,
        price: dollarsToCents(90),
        condition: "Near Mint",
        description: "Shuckle from Neo Revelation in great shape.",
        imageUrls: [mockImageUrlShuckle],
        forSale: true,
        binderId: rareBinder.id,
        ownerId: ash.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.psyduckV.id,
        price: dollarsToCents(55),
        condition: "Mint",
        description: "Psyduck V — a modern staple with confusing energy.",
        imageUrls: [mockImageUrlFive],
        forSale: true,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
      {
        game: "POKEMON",
        pokemonCardId: pokemonCatalog.psyduckV.id,
        price: dollarsToCents(40),
        condition: "Near Mint",
        description: "Psyduck V in near-mint condition.",
        imageUrls: [mockImageUrlFive],
        forSale: true,
        binderId: waterBinder.id,
        ownerId: misty.id,
      },
    ],
  });

  console.log("✅ Extra best-seller listings created");

  // ── Auction cards — 6 cards in live auctions ──────────────────────────────
  // 3 ending soon (within 6h → appear in homepage "Ending Soon" row),
  // 3 ending later (only visible on /auctions page).
  const nowMs = Date.now();
  const mins  = (m: number) => new Date(nowMs + m * 60 * 1000);
  const hours = (h: number) => new Date(nowMs + h * 60 * 60 * 1000);
  const days  = (d: number) => new Date(nowMs + d * 24 * 60 * 60 * 1000);

  const auctionCard1 = await prisma.listing.create({
    data: {
      game: "POKEMON",
      pokemonCardId: pokemonCatalog.charizardVmax.id,
      price: null,
      condition: "Near Mint",
      description: "Auction-only Charizard VMAX — rare chance to own this fire holo.",
      imageUrls: [mockImageUrlOne],
      forSale: false,
      inAuction: true,
      binderId: rareBinder.id,
      ownerId: ash.id,
    },
  });

  const auctionCard2 = await prisma.listing.create({
    data: {
      game: "POKEMON",
      pokemonCardId: pokemonCatalog.blastoiseHoloRare.id,
      price: null,
      condition: "Lightly Played",
      description: "Vintage Base Set Blastoise in auction — light play only.",
      imageUrls: [mockImageUrlThree],
      forSale: false,
      inAuction: true,
      binderId: rareBinder.id,
      ownerId: ash.id,
    },
  });

  const auctionCard3 = await prisma.listing.create({
    data: {
      game: "POKEMON",
      pokemonCardId: pokemonCatalog.gyaradosVmax.id,
      price: null,
      condition: "Mint",
      description: "Mint-condition Gyarados VMAX in auction — closing soon.",
      imageUrls: [mockImageUrlSix],
      forSale: false,
      inAuction: true,
      binderId: waterBinder.id,
      ownerId: misty.id,
    },
  });

  const auctionCard4 = await prisma.listing.create({
    data: {
      game: "POKEMON",
      pokemonCardId: pokemonCatalog.venusaurV.id,
      price: null,
      condition: "Near Mint",
      description: "Venusaur V — Grass-type powerhouse in a multi-day auction.",
      imageUrls: [mockImageUrlTwo],
      forSale: false,
      inAuction: true,
      binderId: grassBinder.id,
      ownerId: ash.id,
    },
  });

  const auctionCard5 = await prisma.listing.create({
    data: {
      game: "POKEMON",
      pokemonCardId: pokemonCatalog.starmieGxJp.id,
      price: null,
      condition: "Mint",
      description: "Starmie GX in a 2-day auction — get your bids in early.",
      imageUrls: [mockImageUrlFour],
      forSale: false,
      inAuction: true,
      binderId: waterBinder.id,
      ownerId: misty.id,
    },
  });

  const auctionCard6 = await prisma.listing.create({
    data: {
      game: "POKEMON",
      pokemonCardId: pokemonCatalog.shuckle.id,
      price: null,
      condition: "PSA 10",
      description: "PSA 10 Shuckle in a 3-day auction — a true collector's gem.",
      imageUrls: [mockImageUrlShuckle],
      forSale: false,
      inAuction: true,
      binderId: rareBinder.id,
      ownerId: ash.id,
    },
  });

  // ── Quick-expiry test auctions (5 / 6 / 7 / 10 min) ─────────────────────
  // All owned by Ash. Log in as Misty to place bids and test the different paths.
  //
  //  Listing 7  (10 min) — has RP $80, BO $150 → bid below RP → pending_seller_decision
  //  Listing 8  ( 5 min) — no RP, no BO        → let expire untouched → expiredNoBids
  //  Listing 9  ( 6 min) — has RP $50, BO $120 → bid above $50 RP → cron auto-settles
  //  Listing 10 ( 7 min) — has RP $80, no BO   → bid below $80 RP → pending_seller_decision
  const auctionCard7 = await prisma.listing.create({
    data: {
      game: "POKEMON",
      pokemonCardId: pokemonCatalog.blastoiseHoloRare.id,
      price: null,
      condition: "Mint",
      description: "TEST (10 min) — bid below S$80 RP to trigger pending_seller_decision, or S$150 BO for instant win.",
      imageUrls: [mockImageUrlThree],
      forSale: false,
      inAuction: true,
      binderId: rareBinder.id,
      ownerId: ash.id,
    },
  });

  const auctionCard8 = await prisma.listing.create({
    data: {
      game: "POKEMON",
      pokemonCardId: pokemonCatalog.psyduckBaseSet.id,
      price: null,
      condition: "Near Mint",
      description: "TEST (5 min) — no RP, no BO. Leave it with zero bids and fire the cron to test the expiredNoBids path.",
      imageUrls: [mockImageUrlFive],
      forSale: false,
      inAuction: true,
      binderId: rareBinder.id,
      ownerId: ash.id,
    },
  });

  const auctionCard9 = await prisma.listing.create({
    data: {
      game: "POKEMON",
      pokemonCardId: pokemonCatalog.gyaradosVmaxVividVoltage.id,
      price: null,
      condition: "Near Mint",
      description: "TEST (6 min) — has RP $50, BO $120. Bid above S$50 RP (e.g. S$60) and let it expire — cron should auto-settle without seller action.",
      imageUrls: [mockImageUrlSix],
      forSale: false,
      inAuction: true,
      binderId: rareBinder.id,
      ownerId: ash.id,
    },
  });

  const auctionCard10 = await prisma.listing.create({
    data: {
      game: "POKEMON",
      pokemonCardId: pokemonCatalog.starmieGxEn.id,
      price: null,
      condition: "Mint",
      description: "TEST (7 min) — has RP $80, no BO. Bid below S$80 RP (e.g. S$40) and let it expire — cron should move to pending_seller_decision.",
      imageUrls: [mockImageUrlFour],
      forSale: false,
      inAuction: true,
      binderId: rareBinder.id,
      ownerId: ash.id,
    },
  });

  await prisma.auction.createMany({
    data: [
      // ── Ending soon (≤6 h) — appear in homepage row ───────────────────────
      {
        listingId:    auctionCard1.id,
        sellerId:     ash.id,
        startingBid:  dollarsToCents(80),
        reservePrice: dollarsToCents(150),
        buyOutPrice:  dollarsToCents(300),
        status:       "active",
        endsAt:       hours(2),
      },
      {
        listingId:    auctionCard2.id,
        sellerId:     ash.id,
        startingBid:  dollarsToCents(60),
        buyOutPrice:  dollarsToCents(200),
        status:       "active",
        endsAt:       hours(4),
      },
      {
        listingId:    auctionCard3.id,
        sellerId:     misty.id,
        startingBid:  dollarsToCents(50),
        reservePrice: dollarsToCents(100),
        status:       "active",
        endsAt:       hours(5),
      },
      // ── Ending later — only on /auctions page ─────────────────────────────
      {
        listingId:    auctionCard4.id,
        sellerId:     ash.id,
        startingBid:  dollarsToCents(40),
        reservePrice: dollarsToCents(80),
        buyOutPrice:  dollarsToCents(150),
        status:       "active",
        endsAt:       days(1),
      },
      {
        listingId:    auctionCard5.id,
        sellerId:     misty.id,
        startingBid:  dollarsToCents(30),
        buyOutPrice:  dollarsToCents(120),
        status:       "active",
        endsAt:       days(2),
      },
      {
        listingId:    auctionCard6.id,
        sellerId:     ash.id,
        startingBid:  dollarsToCents(80),
        reservePrice: dollarsToCents(160),
        status:       "active",
        endsAt:       days(3),
      },
      // ── Quick-expiry test auctions (5–10 min) — all owned by Ash ────────────
      // Card 7 (10 min): bid below S$80 RP → pending_seller_decision, or S$150 BO → instant win
      {
        listingId:    auctionCard7.id,
        sellerId:     ash.id,
        startingBid:  dollarsToCents(20),
        reservePrice: dollarsToCents(80),
        buyOutPrice:  dollarsToCents(150),
        status:       "active",
        endsAt:       mins(10),
      },
      // Card 8 (5 min): no RP, no BO — leave with zero bids → expiredNoBids
      {
        listingId:    auctionCard8.id,
        sellerId:     ash.id,
        startingBid:  dollarsToCents(10),
        reservePrice: null,
        buyOutPrice:  null,
        status:       "active",
        endsAt:       mins(5),
      },
      // Card 9 (6 min): bid above S$50 RP (e.g. S$60) → cron auto-settles at endsAt
      {
        listingId:    auctionCard9.id,
        sellerId:     ash.id,
        startingBid:  dollarsToCents(20),
        reservePrice: dollarsToCents(50),
        buyOutPrice:  dollarsToCents(120),
        status:       "active",
        endsAt:       mins(6),
      },
      // Card 10 (7 min): bid below S$80 RP (e.g. S$40) → pending_seller_decision
      {
        listingId:    auctionCard10.id,
        sellerId:     ash.id,
        startingBid:  dollarsToCents(30),
        reservePrice: dollarsToCents(80),
        buyOutPrice:  null,
        status:       "active",
        endsAt:       mins(7),
      },
    ],
  });

  console.log("✅ Seeded 10 auction cards (including 5/6/7/10-min quick-expiry test auctions)");

  // Offer — Misty (buyer) offers on Ash's Charizard (seller)
  const offer = await prisma.offer.create({
    data: {
      price: dollarsToCents(100),
      message: null,
      status: "pending",
      listingId: charizard.id,
      buyerId: misty.id,
      sellerId: ash.id,
    },
  });

  console.log(
    "✅ Offer created from Misty on:",
    pokemonCatalog.charizardVmax.nameEn,
    "Offer:",
    offer.id
  );

  // (Optional) Seed a fake completed purchase flow: Order + Transaction
  // Useful to test your "purchases" UI
  const order = await prisma.order.create({
    data: {
      listingId: charizard.id,
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
      listingId: charizard.id,
      sellerId: ash.id,
      buyerId: misty.id,
      amount: order.amount,
      currency: order.currency,
      stripeEventId: "evt_test_seed_123",
      tcgPlayerId: "232496",
    },
  });

  await prisma.$transaction([
    prisma.listing.update({
      where: { id: charizard.id },
      data: {
        ownerId: misty.id,
        forSale: false,
        reservedById: null,
        reservedUntil: null,
        reservedCheckoutSessionId: null,
        binderId: null,
      },
    }),
    // Mark the specific offer as paid and archive it
    prisma.offer.update({
      where: { id: offer.id },
      data: { archivedAt: new Date(), status: "paid", orderId: order.id },
    }),
  ]);

  console.log("✅ Seeded sample Order + CardTransaction");

  // ── Additional transactions so Highest Transacted has data ──────────────────
  // Look up one listing per catalog card to use as the sold-listing reference.
  // tcgPlayerId now lives on the catalog row, so the filter reaches it through
  // the pokemonCard relation instead of a flat column on Listing.
  const venusaurListing = await prisma.listing.findFirst({
    where: { pokemonCard: { tcgPlayerId: "222990" }, ownerId: ash.id },
  });
  const blastoiseListing = await prisma.listing.findFirst({
    where: { pokemonCard: { tcgPlayerId: "42360" }, ownerId: ash.id },
  });
  const starmieListing = await prisma.listing.findFirst({
    where: { pokemonCard: { tcgPlayerId: "197658" }, ownerId: misty.id },
  });
  const gyaradosListing = await prisma.listing.findFirst({
    where: { pokemonCard: { tcgPlayerId: "246724" }, ownerId: misty.id },
  });

  const extraTransactions = [
    // Venusaur V — 4 transactions (most transacted)
    { listing: venusaurListing, tcgPlayerId: "222990", seller: ash, buyer: misty, events: ["evt_seed_ven_1", "evt_seed_ven_2", "evt_seed_ven_3", "evt_seed_ven_4"] },
    // Blastoise — 3 transactions
    { listing: blastoiseListing, tcgPlayerId: "42360", seller: ash, buyer: misty, events: ["evt_seed_bla_1", "evt_seed_bla_2", "evt_seed_bla_3"] },
    // Starmie GX — 2 transactions
    { listing: starmieListing, tcgPlayerId: "197658", seller: misty, buyer: ash, events: ["evt_seed_sta_1", "evt_seed_sta_2"] },
    // Gyarados VMAX — 2 transactions
    { listing: gyaradosListing, tcgPlayerId: "246724", seller: misty, buyer: ash, events: ["evt_seed_gya_1", "evt_seed_gya_2"] },
  ];

  for (const { listing, tcgPlayerId, seller, buyer, events } of extraTransactions) {
    if (!listing) continue;
    for (const stripeEventId of events) {
      const extraOrder = await prisma.order.create({
        data: {
          listingId: listing.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amount: listing.price ?? dollarsToCents(50),
          currency: "sgd",
          status: "PAID",
        },
      });
      await prisma.cardTransaction.create({
        data: {
          orderId: extraOrder.id,
          listingId: listing.id,
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

  // ── Riftbound catalog + listing ──────────────────────────────────────────
  // Real card data (not invented) — matches the sample row used when
  // designing the catalog schema. No flavour/rules text is seeded since none
  // was available; textFlavour/textPlain stay null.
  const riftboundVi = await prisma.riftboundCardCatalog.create({
    data: {
      riftboundId: "unl-176-219",
      name: "Vi - Peacekeeper",
      type: "Unit",
      supertype: "Champion",
      rarity: "Rare",
      domain: "Order",
      energy: 5,
      might: 5,
      power: 1,
      artist: "Envar Studio",
      alternateArt: false,
      signature: false,
      overnumbered: false,
      tags: ["Vi", "Piltover"],
      setId: "UNL",
      setLabel: "Unleashed",
      collectorNumber: "176",
      imageUrl:
        "https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/51610bbdecd77b15f58b9a968611e536ebdf445e-744x1039.png",
    },
  });

  await prisma.listing.create({
    data: {
      game: "RIFTBOUND",
      riftboundCardId: riftboundVi.id,
      price: dollarsToCents(15),
      condition: "Near Mint",
      description: "Vi - Peacekeeper from the Unleashed set.",
      imageUrls: [riftboundVi.imageUrl],
      forSale: true,
      ownerId: ash.id,
    },
  });

  console.log("✅ Riftbound catalog + listing created");

  // ── Best Sellers (admin-curated) ─────────────────────────────────────────────
  await prisma.bestSeller.createMany({
    data: [
      { tcgPlayerId: "232496", position: 1 }, // Charizard VMAX
      { tcgPlayerId: "42360",  position: 2 }, // Blastoise Holo Rare
      { tcgPlayerId: "222990", position: 3 }, // Venusaur V
      { tcgPlayerId: "197658", position: 4 }, // Starmie GX
      { tcgPlayerId: "246724", position: 5 }, // Gyarados VMAX
      { tcgPlayerId: "14936",  position: 6 }, // Shuckle PSA 10
      { tcgPlayerId: "441629", position: 7 }, // Psyduck V (Japanese)
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
