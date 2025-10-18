import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// This function is to store user details on successful sign up
export async function POST(req: Request) {
  try {
    const data = await req.json();

    // Basic input validation
    if (!data.email || !data.password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 }
      );
    }

    // Hash password before storing
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const newUser = await prisma.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        username: data.username || `${data.firstName}_${Date.now()}`,
        email: data.email,
        password: hashedPassword,
        country: data.country,
        sex: data.sex,
        dob: data.dob ? new Date(data.dob) : null,
        address: data.address,
        phoneNumber: data.phoneNumber,
        verified: false,
        role: "user",
      },
    });

    return NextResponse.json({ success: true, user: newUser }, { status: 201 });
  } catch (err: any) {
    console.error("❌ Error creating user:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const data = await req.json();

    if (!data.email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { email: data.email },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        username: data.username,
        country: data.country,
        sex: data.sex,
        dob: data.dob ? new Date(data.dob) : null,
        address: data.address,
      },
    });

    return NextResponse.json(
      { success: true, user: updatedUser },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("❌ Error updating user:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
