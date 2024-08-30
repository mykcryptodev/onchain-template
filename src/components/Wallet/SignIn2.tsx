import { getCsrfToken, signIn } from 'next-auth/react';
import React, { type FC, useCallback, useEffect, useMemo, useState } from 'react';
import { SiweMessage } from 'siwe';
import type { Hex } from 'viem';
import { useAccount, usePublicClient, useSignMessage } from 'wagmi';

const SignInWithEthereum: FC = () => {
  const [signature, setSignature] = useState<Hex | undefined>(undefined);
  const [valid, setValid] = useState<boolean | undefined>(undefined); 
  const client = usePublicClient(); 
  const { signMessageAsync } = useSignMessage({ mutation: { onSuccess: (sig) => setSignature(sig) } });
  const account = useAccount();
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);

  const getMessage = useCallback(async () => {
    const nonce = await getCsrfToken();
    return new SiweMessage({
      domain: document.location.host,
      address: account.address,
      chainId: account.chainId,
      uri: document.location.origin,
      version: '1',
      statement: 'Smart Wallet SIWE Example',
      nonce,
    });
  }, [account]);
 
  const checkValid = useCallback(async () => { 
    if (!signature || !account.address || !client) return;
    const preparedMessage = (await getMessage()).prepareMessage();
    const isValid = await client.verifyMessage({  
      address: account.address, 
      message: preparedMessage, 
      signature, 
    }); 
    setValid(isValid); 
  }, [signature, account]); 
 
  useEffect(() => { 
    void checkValid(); 
  }, [signature, account]); 
 
  const promptToSign = async () => {
    if (!account.address) return;
    setIsSigningIn(true);
    
    try {
      const nonce = await getCsrfToken();

      const message = new SiweMessage({
        domain: document.location.host,
        address: account.address,
        chainId: account.chainId,
        uri: document.location.origin,
        version: '1',
        statement: 'Smart Wallet SIWE Example',
        nonce,
      }).prepareMessage();

      const signature = await signMessageAsync({ message });
      console.log({ signature });
      const isValid = await client?.verifyMessage({  
        address: account.address, 
        message, 
        signature, 
      });
      console.log({ isValid });

      const response = await signIn("ethereum", {
        message,
        signature,
        address: account.address,
        redirect: false,
      });

      if (response?.error) {
        throw new Error(response.error);
      }
    } catch (e) {
      console.error('Error signing in:', e);
    } finally {
      setIsSigningIn(false);
    }
  };
  return (
    <div>
      <h2>SIWE Example</h2>
      <button onClick={promptToSign}>Sign In with Ethereum</button>
      {signature && <p>Signature: {signature}</p>}
      {valid !== undefined && <p>Is valid: {valid.toString()}</p>}
    </div>
  );
}

export default SignInWithEthereum;