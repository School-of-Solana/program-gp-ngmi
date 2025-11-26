import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import crypto from "node:crypto";

chai.use(chaiAsPromised);
const { expect } = chai;

type RaffleVault = anchor.Idl;

const DEFAULT_TICKET = new BN(1_000_000); // 0.001 SOL

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const deriveVaultPda = (creator: PublicKey, id: BN, programId: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), creator.toBuffer(), id.toArrayLike(Buffer, "le", 8)],
    programId
  );

const bnToLeBuffer = (value: BN, width = 8) => {
  const buf = Buffer.alloc(width);
  buf.writeBigUInt64LE(BigInt(value.toString()));
  return buf;
};

const deriveWinnerIndex = (vaultAccount: any) => {
  const buffers = [
    Buffer.from("vault"),
    vaultAccount.creator.toBuffer(),
    bnToLeBuffer(vaultAccount.vaultId),
    bnToLeBuffer(vaultAccount.ticketPrice),
    bnToLeBuffer(vaultAccount.createdAt),
    bnToLeBuffer(vaultAccount.endTime),
  ];
  const digest = crypto.createHash("sha256").update(Buffer.concat(buffers)).digest();
  const rand = new BN(digest.subarray(0, 8), "le");
  return rand.mod(new BN(vaultAccount.participants.length)).toNumber();
};

const airdrop = async (pubkey: PublicKey, amount = 1 * LAMPORTS_PER_SOL, provider?: anchor.AnchorProvider) => {
  const connection = provider?.connection ?? anchor.getProvider().connection;
  const sig = await connection.requestAirdrop(pubkey, amount);
  await connection.confirmTransaction(sig, "confirmed");
};

describe("raffle-vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.RaffleVault as Program<RaffleVault>;
  const creator = provider.wallet;

  const baseVaultId = new BN(1);
  const [vaultPda] = deriveVaultPda(creator.publicKey, baseVaultId, program.programId);

  it("initializes a vault", async () => {
    await program.methods
      .initializeVault(baseVaultId, DEFAULT_TICKET)
      .accounts({
        creator: creator.publicKey,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const vault = await program.account.vault.fetch(vaultPda);
    expect(vault.ticketPrice.toNumber()).to.equal(DEFAULT_TICKET.toNumber());
    expect(vault.participants.length).to.equal(0);
  });

  it("rejects zero ticket price", async () => {
    const tempCreator = Keypair.generate();
    await airdrop(tempCreator.publicKey);

    const badId = new BN(555);
    const [badVault] = deriveVaultPda(tempCreator.publicKey, badId, program.programId);

    await expect(
      program.methods
        .initializeVault(badId, new BN(0))
        .accounts({
          creator: tempCreator.publicKey,
          vault: badVault,
          systemProgram: SystemProgram.programId,
        })
        .signers([tempCreator])
        .rpc()
    ).to.be.rejectedWith(/InvalidTicketPrice/);
  });

  it("allows a unique participant to buy a ticket", async () => {
    const buyer = Keypair.generate();
    await airdrop(buyer.publicKey);

    await program.methods
      .buyTicket()
      .accounts({
        vault: vaultPda,
        buyer: buyer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const vault = await program.account.vault.fetch(vaultPda);
    expect(vault.participants.map((p: PublicKey) => p.toBase58())).to.include(buyer.publicKey.toBase58());
  });

  it("rejects duplicate ticket purchase", async () => {
    const buyer = Keypair.generate();
    await airdrop(buyer.publicKey);

    await program.methods
      .buyTicket()
      .accounts({
        vault: vaultPda,
        buyer: buyer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    await expect(
      program.methods
        .buyTicket()
        .accounts({
          vault: vaultPda,
          buyer: buyer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer])
        .rpc()
    ).to.be.rejectedWith(/DuplicateEntry/);
  });

  it("allows participant withdrawal before deadline", async () => {
    const user = Keypair.generate();
    await airdrop(user.publicKey);

    await program.methods
      .buyTicket()
      .accounts({
        vault: vaultPda,
        buyer: user.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    await program.methods
      .withdrawTicket()
      .accounts({
        vault: vaultPda,
        participant: user.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    const vault = await program.account.vault.fetch(vaultPda);
    expect(vault.participants.map((p: PublicKey) => p.toBase58())).to.not.include(user.publicKey.toBase58());
  });

  it("blocks withdrawal for non-participants", async () => {
    const stranger = Keypair.generate();
    await airdrop(stranger.publicKey);

    await expect(
      program.methods
        .withdrawTicket()
        .accounts({
          vault: vaultPda,
          participant: stranger.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([stranger])
        .rpc()
    ).to.be.rejectedWith(/Participant not found|NotParticipant/);
  });

  it("finalizes vault and pays deterministic winner", async () => {
    const finalizeId = new BN(777);
    const [finalVaultPda] = deriveVaultPda(creator.publicKey, finalizeId, program.programId);

    await program.methods
      .initializeVault(finalizeId, DEFAULT_TICKET)
      .accounts({
        creator: creator.publicKey,
        vault: finalVaultPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const entrants = [Keypair.generate(), Keypair.generate()];
    for (const entrant of entrants) {
      await airdrop(entrant.publicKey);
      await program.methods
        .buyTicket()
        .accounts({
          vault: finalVaultPda,
          buyer: entrant.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([entrant])
        .rpc();
    }

    // Wait for the hardcoded duration (~20 minutes) -> shorten for tests via 2 seconds of warp
    await sleep(2000); // local validator treats slots quickly; adjust if needed

    const vaultBefore = await program.account.vault.fetch(finalVaultPda);
    const winnerIndex = deriveWinnerIndex(vaultBefore);
    const winner = entrants[winnerIndex];

    const balanceBefore = await provider.connection.getBalance(winner.publicKey);

    await program.methods
      .finalizeVault()
      .accounts({
        vault: finalVaultPda,
        creator: creator.publicKey,
        winner: winner.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const balanceAfter = await provider.connection.getBalance(winner.publicKey);
    expect(balanceAfter - balanceBefore).to.equal(vaultBefore.pot.toNumber());
  });

  it("prevents non-creator from finalizing", async () => {
    const anotherId = new BN(888);
    const [anotherVault] = deriveVaultPda(creator.publicKey, anotherId, program.programId);

    await program.methods
      .initializeVault(anotherId, DEFAULT_TICKET)
      .accounts({
        creator: creator.publicKey,
        vault: anotherVault,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const entrant = Keypair.generate();
    await airdrop(entrant.publicKey);
    await program.methods
      .buyTicket()
      .accounts({
        vault: anotherVault,
        buyer: entrant.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([entrant])
      .rpc();

    const impostor = Keypair.generate();
    await airdrop(impostor.publicKey);

    await expect(
      program.methods
        .finalizeVault()
        .accounts({
          vault: anotherVault,
          creator: impostor.publicKey,
          winner: entrant.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([impostor])
        .rpc()
    ).to.be.rejected;
  });

  it("allows creator to cancel and refund everyone", async () => {
    const cancelId = new BN(999);
    const [cancelVault] = deriveVaultPda(creator.publicKey, cancelId, program.programId);

    await program.methods
      .initializeVault(cancelId, DEFAULT_TICKET)
      .accounts({
        creator: creator.publicKey,
        vault: cancelVault,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const entrants = [Keypair.generate(), Keypair.generate()];
    for (const entrant of entrants) {
      await airdrop(entrant.publicKey);
      await program.methods
        .buyTicket()
        .accounts({
          vault: cancelVault,
          buyer: entrant.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([entrant])
        .rpc();
    }

    const balancesBefore = await Promise.all(
      entrants.map((e) => provider.connection.getBalance(e.publicKey))
    );

    await program.methods
      .cancelVault()
      .accounts({
        vault: cancelVault,
        creator: creator.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(
        entrants.map((entrant) => ({
          pubkey: entrant.publicKey,
          isSigner: false,
          isWritable: true,
        }))
      )
      .rpc();

    const balancesAfter = await Promise.all(
      entrants.map((e) => provider.connection.getBalance(e.publicKey))
    );

    balancesAfter.forEach((after, idx) => {
      expect(after - balancesBefore[idx]).to.equal(DEFAULT_TICKET.toNumber());
    });

    const vault = await program.account.vault.fetch(cancelVault);
    expect(vault.isCancelled).to.be.true;
    expect(vault.participants.length).to.equal(0);
  });

  it("prevents non-creator from cancelling", async () => {
    const cancelId = new BN(1234);
    const [cancelVault] = deriveVaultPda(creator.publicKey, cancelId, program.programId);

    await program.methods
      .initializeVault(cancelId, DEFAULT_TICKET)
      .accounts({
        creator: creator.publicKey,
        vault: cancelVault,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const outsider = Keypair.generate();
    await airdrop(outsider.publicKey);

    await expect(
      program.methods
        .cancelVault()
        .accounts({
          vault: cancelVault,
          creator: outsider.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([outsider])
        .rpc()
    ).to.be.rejected;
  });
});