"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/session";
import type { ActionState } from "@/lib/types";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  next: z.string().optional(),
});

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Enter a valid email."),
  phone: z.string().min(8, "Enter a valid phone number.").optional().or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function loginAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    return {
      message: "Please check your email and password.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });

  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return { message: "Invalid email or password." };
  }

  await createSession({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });

  redirect(parsed.data.next || (user.role === "ADMIN" ? "/admin" : "/account"));
}

export async function registerAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || "",
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      message: "Please check the details and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });

  if (existingUser) {
    return { message: "An account with this email already exists." };
  }

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      phone: parsed.data.phone || null,
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
    },
  });

  await createSession({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });

  redirect("/account");
}

export async function logoutAction() {
  await deleteSession();
  redirect("/");
}
