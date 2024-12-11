import { Payment } from "@prisma/client";
// migrateRoles.ts
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { ODDJOB_ROLE_OPTIONS } = require("../config");

async function migrateRoles() {
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
    const oddJobs = await prisma.oddJob.findMany({
      include: {
        payments: true,
      },
    });

    for (const oddJob of oddJobs) {
      if (
        ODDJOB_ROLE_OPTIONS.map((role) => role.value).includes(oddJob.role) ||
        oddJob.payments.some(
          (payment) => payment.fundingSource === "OpenGov-365",
        )
      ) {
        continue;
      }

      let normalizedRole = ODDJOB_ROLE_OPTIONS.find(
        (role) =>
          role.name.toLowerCase() === oddJob.role.toLowerCase() ||
          role.name.toLowerCase() ===
            oddJob.role.replace(/ /g, "_").toLowerCase(),
      )?.value;

      if (!normalizedRole && oddJob.role.toLowerCase().includes("wagtool")) {
        normalizedRole = "wagtool";
      }

      // console.log("normalizedRole", normalizedRole, "🥂🥂🥂🥂", oddJob.role);

      if (normalizedRole && normalizedRole !== oddJob.role) {
        // Update the role if it needs normalization
        // await prisma.oddJob.update({
        //   where: { id: oddJob.id },
        //   data: { role: normalizedRole },
        // });
        console.log(
          `Updated role for OddJob ID ${oddJob.id} from ${oddJob.role} to ${normalizedRole}`,
        );
      } else {
        console.warn(
          `No valid role found for OddJob ID ${oddJob.id} with role ${oddJob.role}`,
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
