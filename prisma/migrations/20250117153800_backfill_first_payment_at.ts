import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Update Posts
  const posts = await prisma.post.findMany({
    where: {
      firstPaymentAt: null,
      payments: {
        some: {}, // has at least one payment
      },
    },
    include: {
      payments: {
        orderBy: {
          createdAt: "asc",
        },
        take: 1,
      },
    },
  });

  for (const post of posts) {
    if (post.payments[0]) {
      console.log(
        "updating post",
        post.id,
        ": ",
        post.createdAt,
        "with",
        post.payments[0].createdAt,
      );
      // await prisma.post.update({
      //   where: { id: post.id },
      //   data: { firstPaymentAt: post.payments[0].createdAt },
      // });
    }
  }

  // Update OddJobs
  const oddJobs = await prisma.oddJob.findMany({
    where: {
      firstPaymentAt: null,
      payments: {
        some: {}, // has at least one payment
      },
    },
    include: {
      payments: {
        orderBy: {
          createdAt: "asc",
        },
        take: 1,
      },
    },
  });

  for (const oddJob of oddJobs) {
    if (oddJob.payments[0]) {
      console.log(
        "updating oddJob",
        oddJob.id,
        ": ",
        oddJob.createdAt,
        "with",
        oddJob.payments[0].createdAt,
      );
      // await prisma.oddJob.update({
      //   where: { id: oddJob.id },
      //   data: { firstPaymentAt: oddJob.payments[0].createdAt },
      // });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
