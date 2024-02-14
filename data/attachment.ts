import { logger } from "@/client";
import { downloadFile } from "@/utils/download-file";
import { prisma } from "@/utils/prisma";
import { Attachment } from "@prisma/client";

// Function to store the file in the database
export async function storeAttachment(attachment: {
  url: string;
  name: string;
  mimeType: string;
  size: number;
  oddJobId: string;
}) {
  // Download the file from Discord
  const fileBuffer = await downloadFile(attachment.url);

  // Store the file's metadata and data in the database
  const storedFile = await prisma.attachment.create({
    data: {
      name: attachment.name,
      mimeType: attachment.mimeType, // Use the contentType from the attachment
      data: fileBuffer, // The binary data of the file
      size: attachment.size, // The size of the file
      url: attachment.url, // The URL of the file
      oddJobId: attachment.oddJobId, // The odd job ID the file is associated with
    },
  });

  return storedFile;
}
