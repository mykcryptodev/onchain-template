import { type User } from "@prisma/client";
import type { NextAuthOptions } from "next-auth";
import { isAddressEqual,recoverMessageAddress } from "viem";

import { db } from "~/server/db";

type EthereumProviderConfig = {
  createUser: (credentials: { address: string }) => Promise<User>;
}
export const EthereumProvider = ({ createUser }: EthereumProviderConfig): NextAuthOptions["providers"][number] => ({
  id: "ethereum",
  name: "Ethereum",
  type: "credentials",
  credentials: {
    message: { label: "Message", type: "text" },
    signature: { label: "Signature", type: "text" },
    address: { label: "Address", type: "text" },
  },
  async authorize(credentials) {
    if (!credentials?.message || !credentials?.signature || !credentials?.address) {
      return null;
    }

    try {
      const recoveredAddress = await recoverMessageAddress({
        message: credentials.message,
        signature: credentials.signature as `0x${string}`,
      });

      if (isAddressEqual(recoveredAddress, credentials.address)) {
        // Check if user exists
        let user = await db.user.findFirst({
          where: { address: credentials.address },
        });

        // If user doesn't exist, create a new one
        if (!user) {
          user = await createUser({ address: credentials.address });
        }

        return {
          ...user,
          address: credentials.address,
        };
      }

      console.error("Signature verification failed: address mismatch");
      return null;
    } catch (error) {
      console.error("Error verifying message:", error);
      return null;
    }
  },
});