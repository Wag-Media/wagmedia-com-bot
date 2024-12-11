// migrateRoles.ts
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { ODDJOB_ROLE_OPTIONS } = require("../config");

async function migrateRoles() {
  const ODDJOB_ROLE_OPTIONS = [{ name: "Developer", value: "developer" }];

  try {
    // Create a map of valid roles for quick lookup
    const validRolesMap = ODDJOB_ROLE_OPTIONS.reduce(
      (acc, { name, value }) => {
        acc[name.toLowerCase()] = value;
        return acc;
      },
      {} as Record<string, string>,
    );

    // Fetch all OddJob roles
    const oddJobs = await prisma.oddJob.findMany();

    for (const oddJob of oddJobs) {
      const normalizedRole = validRolesMap[oddJob.role.toLowerCase()];
      if (normalizedRole && normalizedRole !== oddJob.role) {
        // Update the role if it needs normalization
        // await prisma.oddJob.update({
        //   where: { id: oddJob.id },
        //   data: { role: normalizedRole },
        // });
        console.log(
          `Updated role for OddJob ID ${oddJob.id} from ${oddJob.role} to ${normalizedRole}`,
        );
      }
    }
  } catch (err) {
    console.error("Error during migration:", err);
  } finally {
    await prisma.$disconnect();
  }
}

migrateRoles();
