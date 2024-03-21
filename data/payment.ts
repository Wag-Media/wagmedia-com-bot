import { prisma } from "@/utils/prisma";

export async function findFirstPayment(
  where:
    | {
        postId: string;
        oddJobId?: undefined;
      }
    | {
        oddJobId: string;
        postId?: undefined;
      },
) {
  const payment = await prisma.payment.findFirst({
    where,
    include: {
      reaction: {
        include: {
          emoji: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });
  return payment;
}
