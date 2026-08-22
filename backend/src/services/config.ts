import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export async function getSystemConfig(key: string, defaultValue: string = ''): Promise<string> {
  const cfg = await prisma.config.findUnique({ where: { key } });
  return cfg ? cfg.value : defaultValue;
}

export async function setSystemConfig(key: string, value: string): Promise<void> {
  await prisma.config.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}
