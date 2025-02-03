import { prisma } from "../utils/prisma";

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

  const postIds = posts as { id: string }[];
  const duplicateEarnings = await prisma.contentEarnings.findMany({
    where: {
      postId: {
        in: postIds.map((post) => post.id),
      },
    },
  });

  console.log("Duplicate contentEarnings:", duplicateEarnings);
}
