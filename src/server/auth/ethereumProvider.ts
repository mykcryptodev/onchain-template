import { type User } from "@prisma/client";
import { createConfig, getClient, getPublicClient,http,readContract } from "@wagmi/core";
import type { NextAuthOptions } from "next-auth";
import { getCsrfToken } from "next-auth/react"
import { SiweMessage } from "siwe";
import {type Address, hashMessage, isAddress, isAddressEqual,verifyMessage,zeroAddress } from 'viem'
import { base } from "wagmi/chains";

import { SUPPORTED_CHAINS } from "~/constants";
import { EIP1271_ABI } from "~/constants/abi/EIP1271";
import { env } from "~/env";
import { wagmiConfig } from "~/providers/OnchainProviders";
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
  async authorize(credentials, req) {
    if (!credentials?.message || !credentials?.signature || !credentials?.address) {
      return null;
    }
    console.log('got here...', credentials)

    // const siwe = credentials?.message
    //   ? typeof credentials.message === 'string'
    //     ? new SiweMessage(credentials.message)
    //     : isSiweMessage(credentials.message) // Type guard
    //       ? new SiweMessage(credentials.message)
    //       : null
    //   : null;
    // console.log({ siwe });

    // const nextAuthUrl = new URL(env.NEXTAUTH_URL)

    // const result = await siwe?.verify({
    //   signature: credentials?.signature || "",
    //   domain: nextAuthUrl.host,
    //   nonce: await getCsrfToken({ req }),
    // });
    // console.log({ result });

    // if (result?.success) {
    //   console.log('successful!', result);
    //   let user = await db.user.findFirst({
    //     where: { address: credentials.address },
    //   });

    //   if (!user) {
    //     user = await createUser({ address: credentials.address });
    //   }

    //   return {
    //     id: user.id,
    //     address: credentials.address,
    //   }
    // }

    // return null;

    try {
      const isValid = await verifySignature(
        credentials.message,
        credentials.signature,
        credentials.address,
      );

      if (isValid) {
        let user = await db.user.findFirst({
          where: { address: credentials.address },
        });

        if (!user) {
          user = await createUser({ address: credentials.address });
        }

        return {
          id: user.id,
          address: credentials.address,
        }
      }

      console.error("Signature verification failed")
      return null
    } catch (error) {
      console.error("Error verifying message:", error)
      return null
    }
  },
});

async function verifySignature(
  message: string,
  signature: string,
  address: Address,
  chainId: number = base.id,
): Promise<boolean> {
  // First, try standard EOA signature verification
  try {
    return await verifyMessage({
      message,
      address,
      signature: signature as `0x${string}`,
    });
  } catch (error) {
    console.log("Not an EOA signature, trying EIP-1271...", error);
  }

  // If EOA verification fails, try EIP-1271 verification
  if (isAddress(address) && !isAddressEqual(address, zeroAddress)) {
    try {
      // const messageHash = hashMessage(message)
      // const isValidSignature = await readContract(wagmiConfig, {
      //   address,
      //   abi: EIP1271_ABI,
      //   functionName: 'isValidSignature',
      //   args: [messageHash, signature],
      // });

      const chain = SUPPORTED_CHAINS.find(c => c.id === chainId);
      if (!chain) {
        throw new Error(`Chain ID ${chainId} not supported`);
      }
      const config = createConfig({ 
        chains: [chain], 
        transports: { 
          [chain.id]: http(),
        }, 
      });
      const client = getPublicClient(config);
      const isValid = await client?.verifyMessage({
        address, 
        message, 
        signature: signature as `0x${string}`,
      });
      console.log({ isValid });
      return isValid ?? false;
      // const isValid = verifyMessage({  
      //   address, 
      //   message: message.prepareMessage(), 
      //   signature, 
      // });
      // return isValidSignature === '0x1626ba7e' // Magic value for valid signatures
    } catch (error) {
      console.error("EIP-1271 verification failed:", error)
    }
  }

  return false
}

// Type guard function
function isSiweMessage(value: unknown): value is Partial<SiweMessage> {
  return typeof value === 'object' && value !== null;
}