import { setupWalletSelector } from '@near-wallet-selector/core';
import { setupMeteorWallet } from '@near-wallet-selector/meteor-wallet';
import { Buffer } from 'buffer';

let selector, networkId;
export async function prepareWallet(network, onChange) {
  if (selector && networkId !== network) throw new Error('Reload to change network.');
  if (!selector) {
    networkId = network;
    selector = await setupWalletSelector({ network, modules: [setupMeteorWallet()], debug: false, languageCode: 'en' });
    for (const event of ['signedOut', 'accountsChanged', 'networkChanged']) selector.on(event, onChange);
  }
  const wallet = await selector.wallet('meteor-wallet');
  return {
    // NEP-413 alone authenticates the account chosen in Meteor. Do not call signIn:
    // it can create a function-call key. No transaction methods are used here.
    sign: challenge => wallet.signMessage({ message: challenge.message, recipient: challenge.recipient, nonce: Buffer.from(challenge.nonce, 'base64') })
  };
}
