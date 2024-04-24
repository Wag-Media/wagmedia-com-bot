const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

main()
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());

async function main() {
  // get all posts with multiple contentEarnings
  const posts = await prisma.$queryRaw`
  SELECT p.*
  FROM "Post" AS p
  JOIN (
    SELECT "postId", COUNT(*) AS "earningsCount"
    FROM "ContentEarnings"
    GROUP BY "postId"
    HAVING COUNT(*) > 1
  ) AS earnings ON earnings."postId" = p."id"
`;

  console.log("Posts with multiple contentEarnings:", posts);

  const postIds = posts.map((post) => post.id);
  const duplicateEarnings = await prisma.contentEarnings.findMany({
    where: {
      postId: {
        in: postIds,
      },
    },
  });

  console.log("Duplicate contentEarnings:", duplicateEarnings);
}
