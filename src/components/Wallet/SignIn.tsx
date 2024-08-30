import { signIn, useSession } from 'next-auth/react';
import { type FC, useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';

const SignIn: FC = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage()
  const { data: session } = useSession();
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);

  const handleSignIn = async () => {
    if (!isConnected) return

    try {
      setIsSigningIn(true)
      const message = `Sign this message to prove you own the address ${address}`;
      const signature = await signMessageAsync({ message });

      const response = await signIn("ethereum", {
        message,
        signature,
        address,
        redirect: false,
      });

      if (response?.error) {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Error signing in:', error)
    } finally {
      setIsSigningIn(false)
    }
  }
  return (
    <div>
      {isConnected && !session && (
        <button onClick={handleSignIn} disabled={isSigningIn}>
          {isSigningIn ? 'Signing In...' : 'Sign In with Ethereum'}
        </button>
      )}
      {session && <p>Signed in as {session.user.address}</p>}
    </div>
  )
};

export default SignIn;

