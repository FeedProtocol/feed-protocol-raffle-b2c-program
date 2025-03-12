import { AccountMeta, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, createInitializeMintInstruction, createMintToCheckedInstruction, getAssociatedTokenAddress, getMinimumBalanceForRentExemptMint, getMint, MINT_SIZE, TOKEN_PROGRAM_ID, TokenInstruction } from "@solana/spl-token";
import { connection } from "./connection";
import fs from 'fs';
import { raffle_program } from "./accounts";
import { get_participation_pda_by_raffle_no_and_winner_no } from "./get_info";
import { RaffleSchema, Raffle } from "./models";
import { numberToLEBytes8 } from "./utils";
import * as borsh from "borsh";


function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const create_and_mint_token = async (privateKey:Keypair,mint:Keypair) => {

  const decimals:number = 6;
  const amount:number = 1000;

    const ix = SystemProgram.createAccount({
        fromPubkey: privateKey.publicKey,
        newAccountPubkey: mint.publicKey,
        space: MINT_SIZE,
        lamports: await getMinimumBalanceForRentExemptMint(connection),
        programId: TOKEN_PROGRAM_ID,
      });
    
    const ix_2 = createInitializeMintInstruction(
        mint.publicKey,
        decimals,
        privateKey.publicKey,
       null, 
      );

      const ata = await getAssociatedTokenAddress(
        mint.publicKey, 
        privateKey.publicKey, 
      );


    const ix_3 = createAssociatedTokenAccountInstruction(
          privateKey.publicKey,
          ata, 
          privateKey.publicKey, 
          mint.publicKey,
        );

    const powerOfTen = Math.pow(10, decimals)
      
    const ix_4 = createMintToCheckedInstruction(
            mint.publicKey, // mint
            ata, // receiver (should be a token account)
            privateKey.publicKey, // mint authority
            powerOfTen*amount, // amount. if your decimals is 9, you mint 10^9 for 1 token.
            decimals, // decimals
          );

      const latestBlockhash = await connection.getLatestBlockhash();

      const message = new TransactionMessage({
        instructions: [ix,ix_2,ix_3,ix_4],
        payerKey: privateKey.publicKey,
        recentBlockhash: latestBlockhash.blockhash
      }).compileToV0Message();

  
      const tx = new VersionedTransaction(message);
      tx.sign([privateKey,mint]);

      try {
      await connection.sendTransaction(tx);
        
      } catch (error) {
      console.log(error)
        
      }


    
return delay(600)
}

export const create_ata_and_mint_token = async (amount:number,privateKey:Keypair,mint:PublicKey,owner:PublicKey) => {

  const mint_info = await getMint(connection,mint)

  const ata = await getAssociatedTokenAddress(
    mint, 
    owner, 
  );


const ix_3 = createAssociatedTokenAccountInstruction(
      privateKey.publicKey,
      ata, 
      owner, 
      mint,
    );


    const powerOfTen = Math.pow(10, mint_info.decimals)
      
    const ix_4 = createMintToCheckedInstruction(
            mint, // mint
            ata, // receiver (should be a token account)
            privateKey.publicKey, // mint authority
            powerOfTen*amount, // amount. if your decimals is 9, you mint 10^9 for 1 token.
            mint_info.decimals, // decimals
          );

      const latestBlockhash = await connection.getLatestBlockhash();

      const message = new TransactionMessage({
        instructions: [ix_3,ix_4],
        payerKey: privateKey.publicKey,
        recentBlockhash: latestBlockhash.blockhash
      }).compileToV0Message();

      const tx = new VersionedTransaction(message);
      tx.sign([privateKey]);

      try {
       await connection.sendTransaction(tx);
        
      } catch (error) {
        console.log("error")
        console.log(error)
      }
}

export const get_token_balance = async (mint:PublicKey,owner:PublicKey) => {

    const ata = await getAssociatedTokenAddress(
        mint, 
        owner,false,TOKEN_PROGRAM_ID,ASSOCIATED_TOKEN_PROGRAM_ID
      );
    
    const tokenAmount = await connection.getTokenAccountBalance(ata);
    console.log(`amount: ${tokenAmount.value.amount}`);
    console.log(`decimals: ${tokenAmount.value.decimals}`);

    return delay(600)
} 


export const get_winners = async (raffle_no:bigint,authority:Keypair) => {


  const le_bytes = numberToLEBytes8(raffle_no)

  const raffle_account = PublicKey.findProgramAddressSync([Buffer.from("raffle"),le_bytes],raffle_program)[0];

  const raffle_account_info = await connection.getAccountInfo(raffle_account);

  const raffle = borsh.deserialize(RaffleSchema,raffle_account_info?.data!) as Raffle;

  const keys:AccountMeta[] = [];
       
  const raffle_pda_meta = { isSigner: false, isWritable: true, pubkey: raffle_account }

  keys.push(raffle_pda_meta)

  for (let index = 0; index < raffle.winners.length; index++) {

      const winner_no = raffle.winners[index];

      const winner_no_bytes = numberToLEBytes8(winner_no);

      if(raffle.multiple_participation_allowed == 1){
          const winner_pda = PublicKey.findProgramAddressSync([Buffer.from("raf"),le_bytes,Buffer.from("par"),winner_no_bytes],raffle_program)[0];
          const winner_pda_meta = { isSigner: false, isWritable: true, pubkey: winner_pda };
          keys.push(winner_pda_meta)

      }else{
          const winner_pda = await get_participation_pda_by_raffle_no_and_winner_no(BigInt(raffle_no),BigInt(winner_no));
          const winner_pda_meta = { isSigner: false, isWritable: true, pubkey: winner_pda };
          keys.push(winner_pda_meta)
      }
      
  }

}