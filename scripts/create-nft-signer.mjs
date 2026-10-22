// Creates a NEW, dedicated, unfunded Wallet V4. Never imports an existing seed.
// The secret file stays ignored and must be backed up privately by the operator.
import {mnemonicNew,mnemonicToPrivateKey} from '@ton/crypto';
import {WalletContractV4} from '@ton/ton';
import {randomBytes} from 'node:crypto';
import {open} from 'node:fs/promises';
const path=new URL('../.env.nft.local',import.meta.url);
const file=await open(path,'wx',0o600);
try{
 const words=await mnemonicNew(24),key=await mnemonicToPrivateKey(words);
 const address=WalletContractV4.create({workchain:0,publicKey:key.publicKey}).address.toString({bounceable:false});
 await file.writeFile(`NFT_SIGNER_MNEMONIC=${words.join(' ')}\nNFT_SIGNER_ADDRESS=${address}\nNFT_WORKER_SECRET=${randomBytes(32).toString('hex')}\nNFT_AUTO_MINT_ENABLED=false\n`);
 console.log('New unfunded Wallet V4:',address);
 console.log('Private backup: .env.nft.local (mode 0600). No transaction sent.');
}finally{await file.close();}
