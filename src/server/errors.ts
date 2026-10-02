import { Prisma } from "@prisma/client";

export class ErpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErpError";
  }
}

export function asErp(error: unknown): ErpError | null {
  if (error instanceof ErpError) return error;
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return new ErpError("Bu kod veya numara zaten kullanılıyor.");
  }
  return null;
}

export function rethrowRedirect(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  ) {
    throw error;
  }
}
