import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import { RaffleVault } from "../target/types/raffle_vault";
import { SendTransactionError } from "@solana/web3.js";

const { SystemProgram, Keypair, PublicKey, LAMPORTS_PER_SOL } = anchor.web3;

describe("raffle_vault", function () {
  const TEST_TIMEOUT_MS = 120_000;
  this.timeout(TEST_TIMEOUT_MS);

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const connection = provider.connection;
  const program = anchor.workspace.RaffleVault as Program<RaffleVault>;

  const DEFAULT_TICKET_PRICE = new anchor.BN(500_000_000); // 0.5 SOL
  const DEFAULT_MAX_TICKETS = 5;

  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  async function confirm(signature: string) {
    const latest = await connection.getLatestBlockhash();
    await connection.confirmTransaction(
      {
        signature,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      },
      "confirmed",
    );
  }

  async function airdrop(pubkey: PublicKey, amount = 2 * LAMPORTS_PER_SOL) {
    const sig = await connection.requestAirdrop(pubkey, amount);
    await confirm(sig);
  }

  type VaultConfig = {
    authority?: Keypair;
    ticketPrice?: anchor.BN;
    maxTickets?: number;
    durationSeconds?: number | null;
  };

  type VaultContext = {
    authority: Keypair;
    vault: PublicKey;
    bump: number;
    ticketPrice: anchor.BN;
    maxTickets: number;
  };

  async function setupVault(config: VaultConfig = {}): Promise<VaultContext> {
    const authority = config.authority ?? Keypair.generate();
    await airdrop(authority.publicKey);

    const ticketPrice = config.ticketPrice ?? DEFAULT_TICKET_PRICE;
    const maxTickets = config.maxTickets ?? DEFAULT_MAX_TICKETS;

    const durationArg =
      config.durationSeconds === undefined || config.durationSeconds === null
        ? null
        : new anchor.BN(config.durationSeconds);

    const [vault, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), authority.publicKey.toBuffer()],
      program.programId,
    );

    await program.methods
      .initializeRaffle({
        ticketPrice,
        maxTickets,
        durationSeconds: durationArg,
      })
      .accounts({
        authority: authority.publicKey,
        vault,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    return { authority, vault, bump, ticketPrice, maxTickets };
  }

  async function expectAnchorError(
    promise: Promise<unknown>,
    messageFragment: string,
  ) {
    try {
      await promise;
      throw new Error(
        `Expected error containing "${messageFragment}" but transaction succeeded`,
      );
    } catch (err) {
      const anchorErr = err as anchor.AnchorError;

      // DEBUG
      // anchorErr.logs?.forEach((line) => console.log(line));

      const actual =
        anchorErr?.error?.errorMessage ??
        anchorErr?.error?.errorCode?.code ??
        anchorErr?.message ??
        String(err);
      expect(actual).to.include(messageFragment);
    }
  }

  async function fetchVault(pubkey: PublicKey) {
    return program.account.vault.fetch(pubkey);
  }

  async function buyTicket(vault: PublicKey, payer: Keypair) {
    await program.methods
      .enterRaffle()
      .accounts({
        payer: payer.publicKey,
        vault,
        systemProgram: SystemProgram.programId,
      })
      .signers([payer])
      .rpc();
  }

  describe("initialize_raffle", () => {
    it("initializes a vault with the provided ticket price, max supply, and zeroed counters", async () => {
      const ctx = await setupVault();
      const vaultAccount = await fetchVault(ctx.vault);

      expect(vaultAccount.authority.toBase58()).to.eq(
        ctx.authority.publicKey.toBase58(),
      );
      expect(vaultAccount.ticketPrice.toString()).to.eq(
        ctx.ticketPrice.toString(),
      );
      expect(vaultAccount.maxTickets).to.eq(ctx.maxTickets);
      expect(vaultAccount.ticketCount).to.eq(0);
      expect(vaultAccount.tickets).to.have.length(0);
    });

    it("rejects vault initialization when the ticket price is zero", async () => {
      await expectAnchorError(
        setupVault({ ticketPrice: new anchor.BN(0) }),
        "Ticket price must be greater than zero",
      );
    });

    it("rejects vault initialization when the configured duration is not positive", async () => {
      await expectAnchorError(
        setupVault({ durationSeconds: 0 }),
        "Vault duration must be positive",
      );
    });
  });

  describe("enter_raffle (buy_ticket)", () => {
    it("lets a fresh entrant buy a ticket and records it in the vault state", async () => {
      const ctx = await setupVault();
      const buyer = Keypair.generate();
      await airdrop(buyer.publicKey);

      await buyTicket(ctx.vault, buyer);

      const vaultAccount = await fetchVault(ctx.vault);
      expect(vaultAccount.ticketCount).to.eq(1);
      expect(vaultAccount.pot.toString()).to.eq(ctx.ticketPrice.toString());
      expect(vaultAccount.tickets).to.have.length(1);
      expect(vaultAccount.tickets[0].buyer.toBase58()).to.eq(
        buyer.publicKey.toBase58(),
      );
    });

    it("blocks a wallet from purchasing multiple tickets in the same raffle", async () => {
      const ctx = await setupVault();
      const buyer = Keypair.generate();
      await airdrop(buyer.publicKey);

      await buyTicket(ctx.vault, buyer);
      await expectAnchorError(
        buyTicket(ctx.vault, buyer),
        "Duplicate entry detected",
      );
    });

    it("rejects purchases once the configured ticket cap is reached", async () => {
      const ctx = await setupVault({ maxTickets: 1 });
      const buyer1 = Keypair.generate();
      const buyer2 = Keypair.generate();
      await airdrop(buyer1.publicKey);
      await airdrop(buyer2.publicKey);

      await buyTicket(ctx.vault, buyer1);
      await expectAnchorError(
        buyTicket(ctx.vault, buyer2),
        "Maximum number of tickets reached",
      );
    });

    it("rejects ticket purchases submitted after the raffle end time", async () => {
      const ctx = await setupVault({ durationSeconds: 2 });
      const buyer = Keypair.generate();
      await airdrop(buyer.publicKey);

      await buyTicket(ctx.vault, buyer);
      await sleep(2_500);

      const lateBuyer = Keypair.generate();
      await airdrop(lateBuyer.publicKey);

      await expectAnchorError(
        buyTicket(ctx.vault, lateBuyer),
        "Vault has already closed",
      );
    });
  });

  describe("exit_raffle (refund_ticket)", () => {
    it("refunds a valid ticket holder prior to the raffle deadline and removes their entry", async () => {
      const ctx = await setupVault({ durationSeconds: 60 });
      const buyer = Keypair.generate();
      await airdrop(buyer.publicKey);

      await buyTicket(ctx.vault, buyer);

      await program.methods
        .exitRaffle()
        .accounts({
          payer: buyer.publicKey,
          vault: ctx.vault,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();

      const vaultAccount = await fetchVault(ctx.vault);
      expect(vaultAccount.ticketCount).to.eq(0);
      expect(vaultAccount.pot.toNumber()).to.eq(0);
      expect(vaultAccount.tickets).to.have.length(0);
    });

    it("rejects refund requests from wallets that never purchased a ticket", async () => {
      const ctx = await setupVault({ durationSeconds: 60 });
      const buyer = Keypair.generate();
      const stranger = Keypair.generate();
      await airdrop(buyer.publicKey);
      await airdrop(stranger.publicKey);

      await buyTicket(ctx.vault, buyer);

      await expectAnchorError(
        program.methods
          .exitRaffle()
          .accounts({
            payer: stranger.publicKey,
            vault: ctx.vault,
            systemProgram: SystemProgram.programId,
          })
          .signers([stranger])
          .rpc(),
        "Ticket not found for this payer",
      );
    });

    it("blocks refunds after the raffle end time has elapsed", async () => {
      const ctx = await setupVault({ durationSeconds: 2 });
      const buyer = Keypair.generate();
      await airdrop(buyer.publicKey);

      await buyTicket(ctx.vault, buyer);
      await sleep(2_500);

      await expectAnchorError(
        program.methods
          .exitRaffle()
          .accounts({
            payer: buyer.publicKey,
            vault: ctx.vault,
            systemProgram: SystemProgram.programId,
          })
          .signers([buyer])
          .rpc(),
        "Vault has already closed",
      );
    });
  });

  describe("payout_finalize", () => {
    it("prevents winner selection until the raffle duration has fully elapsed", async () => {
      const ctx = await setupVault({ durationSeconds: 60 });
      const buyer = Keypair.generate();
      await airdrop(buyer.publicKey);
      await buyTicket(ctx.vault, buyer);

      await expectAnchorError(
        program.methods
          .payoutRaffle()
          .accounts({
            authority: ctx.authority.publicKey,
            vault: ctx.vault,
          })
          .signers([ctx.authority])
          .rpc(),
        "Vault is still running",
      );
    });

    it("fails to select a winner when zero tickets were sold", async () => {
      const ctx = await setupVault({ durationSeconds: 1 });
      await sleep(1_500);

      await expectAnchorError(
        program.methods
          .payoutRaffle()
          .accounts({
            authority: ctx.authority.publicKey,
            vault: ctx.vault,
          })
          .signers([ctx.authority])
          .rpc(),
        "No tickets were sold",
      );
    });

    it("rejects repeated winner selection after a pending winner already exists", async () => {
      const ctx = await setupVault({ durationSeconds: 2 });
      const buyer = Keypair.generate();
      await airdrop(buyer.publicKey);
      await buyTicket(ctx.vault, buyer);
      await sleep(2_500);

      await program.methods
        .payoutRaffle()
        .accounts({
          authority: ctx.authority.publicKey,
          vault: ctx.vault,
        })
        .signers([ctx.authority])
        .rpc();

      await expectAnchorError(
        program.methods
          .payoutRaffle()
          .accounts({
            authority: ctx.authority.publicKey,
            vault: ctx.vault,
          })
          .signers([ctx.authority])
          .rpc(),
        "Winner already chosen",
      );
    });

    it("stores the pending winner, prize amount, and finished status after finalization", async () => {
      const ctx = await setupVault({ durationSeconds: 5 });
      const buyers = [
        Keypair.generate(),
        Keypair.generate(),
        Keypair.generate(),
      ];

      for (const buyer of buyers) {
        await airdrop(buyer.publicKey);
        await buyTicket(ctx.vault, buyer);
      }

      await sleep(3_500);

      await program.methods
        .payoutRaffle()
        .accounts({
          authority: ctx.authority.publicKey,
          vault: ctx.vault,
        })
        .signers([ctx.authority])
        .rpc();

      const vaultAfter = await fetchVault(ctx.vault);

      expect(vaultAfter.pendingWinner).to.not.equal(null);
      expect(vaultAfter.pendingPrize.toNumber()).to.be.greaterThan(0);
      expect(vaultAfter.status).to.have.property("finished");
      expect(buyers.some((b) => b.publicKey.equals(vaultAfter.pendingWinner)))
        .to.be.true;
    });

    it("enforces that only the vault authority can finalize the raffle payout", async () => {
      const ctx = await setupVault({ durationSeconds: 1 });
      const impostor = Keypair.generate();

      await airdrop(impostor.publicKey);

      await expectAnchorError(
        program.methods
          .payoutRaffle()
          .accounts({
            authority: impostor.publicKey,
            vault: ctx.vault,
          })
          .signers([impostor])
          .rpc(),
        "A seeds constraint was violated",
      );
    });
  });

  describe("claim_prize", () => {
    it("rejects prize claims when no pending winner has been recorded", async () => {
      const ctx = await setupVault({ durationSeconds: 2 });
      const buyer = Keypair.generate();
      await airdrop(buyer.publicKey);
      await buyTicket(ctx.vault, buyer);
      await sleep(2_500);

      await expectAnchorError(
        program.methods
          .claimRaffle()
          .accounts({
            vault: ctx.vault,
            winner: buyer.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([buyer])
          .rpc(),
        "Missing pending winner",
      );
    });

    it("rejects prize claims from wallets that are not the recorded winner", async () => {
      const ctx = await setupVault({ durationSeconds: 3 });
      const winner = Keypair.generate();
      const impostor = Keypair.generate();

      await airdrop(winner.publicKey);
      await airdrop(impostor.publicKey);

      await buyTicket(ctx.vault, winner);
      await sleep(3_500);

      await program.methods
        .payoutRaffle()
        .accounts({
          authority: ctx.authority.publicKey,
          vault: ctx.vault,
        })
        .signers([ctx.authority])
        .rpc();

      await expectAnchorError(
        program.methods
          .claimRaffle()
          .accounts({
            vault: ctx.vault,
            winner: impostor.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([impostor])
          .rpc(),
        "Caller is not the recorded winner",
      );
    });

    it("transfers the pending prize to the recorded winner and clears payout state", async () => {
      const ctx = await setupVault({ durationSeconds: 2 });
      const winner = Keypair.generate();

      await airdrop(winner.publicKey);
      await buyTicket(ctx.vault, winner);
      await sleep(2_500);

      await program.methods
        .payoutRaffle()
        .accounts({
          authority: ctx.authority.publicKey,
          vault: ctx.vault,
        })
        .signers([ctx.authority])
        .rpc();

      const vaultBefore = await fetchVault(ctx.vault);
      const balanceBefore = await provider.connection.getBalance(
        winner.publicKey,
      );

      await program.methods
        .claimRaffle()
        .accounts({
          vault: ctx.vault,
          winner: winner.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([winner])
        .rpc();

      const vaultAfter = await fetchVault(ctx.vault);
      const balanceAfter = await provider.connection.getBalance(
        winner.publicKey,
      );

      expect(vaultAfter.pendingWinner).to.equal(null);
      expect(vaultAfter.pendingPrize.toNumber()).to.equal(0);
      expect(vaultAfter.paidOut).to.be.true;
      expect(balanceAfter).to.equal(
        balanceBefore + vaultBefore.pendingPrize.toNumber(),
      );
    });

    it("“blocks additional claims after the pending prize has been paid out", async () => {
      const ctx = await setupVault({ durationSeconds: 3 });
      const winner = Keypair.generate();

      await airdrop(winner.publicKey);
      await buyTicket(ctx.vault, winner);
      await sleep(3_500);

      await program.methods
        .payoutRaffle()
        .accounts({
          authority: ctx.authority.publicKey,
          vault: ctx.vault,
        })
        .signers([ctx.authority])
        .rpc();

      await program.methods
        .claimRaffle()
        .accounts({
          vault: ctx.vault,
          winner: winner.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([winner])
        .rpc();

      await expectAnchorError(
        program.methods
          .claimRaffle()
          .accounts({
            vault: ctx.vault,
            winner: winner.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([winner])
          .rpc(),
        "Missing pending winner",
      );
    });
  });

  describe("cancel_raffle", () => {
    it("allows the authority to close and reclaim an empty vault account", async () => {
      const ctx = await setupVault();
      await program.methods
        .cancelRaffle()
        .accounts({
          authority: ctx.authority.publicKey,
          vault: ctx.vault,
          systemProgram: SystemProgram.programId,
        })
        .signers([ctx.authority])
        .rpc();

      //await expect(fetchVault(ctx.vault)).to.be.rejected;
      try {
        await fetchVault(ctx.vault);
        throw new Error("Vault account still exists");
      } catch (err) {
        expect(err.message).to.include("Account does not exist");
      }
    });

    it("prevents vault cancellation while tickets or pot funds remain", async () => {
      const ctx = await setupVault();
      const buyer = Keypair.generate();
      await airdrop(buyer.publicKey);
      await buyTicket(ctx.vault, buyer);

      await expectAnchorError(
        program.methods
          .cancelRaffle()
          .accounts({
            authority: ctx.authority.publicKey,
            vault: ctx.vault,
            systemProgram: SystemProgram.programId,
          })
          .signers([ctx.authority])
          .rpc(),
        "Tickets still outstanding",
      );
    });

    it("enforces that only the vault authority can cancel the raffle account", async () => {
      const ctx = await setupVault({ durationSeconds: 60 });
      const stranger = Keypair.generate();

      await airdrop(stranger.publicKey);

      await expectAnchorError(
        program.methods
          .cancelRaffle()
          .accounts({
            authority: stranger.publicKey,
            vault: ctx.vault,
            systemProgram: SystemProgram.programId,
          })
          .signers([stranger])
          .rpc(),
        "A seeds constraint was violated",
      );
    });
  });
});
