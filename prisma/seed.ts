// prisma/seed.ts
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  // clear existing users (optional for testing)
  await prisma.user.deleteMany();

  // insert a mock user
  await prisma.user.create({
    data: {
      name: "Ash Ketchum",
      email: "ash@pokemon.com",
      password: "pikachu1234", // ⚠️ plain text for now, hash later with bcrypt
      role: "user",
    },
  });

  console.log("✅ Mock user created: ash@pokemon.com / pikachu123");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
