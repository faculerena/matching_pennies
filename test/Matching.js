const { expect } = require("chai");
const { ethers } = require("hardhat");

// Import necessary functions from ethers
const { keccak256 } = require("@ethersproject/keccak256");
const { defaultAbiCoder } = require("@ethersproject/abi");
const { toUtf8Bytes } = require("@ethersproject/strings");

describe("MatchingPennies Contract", function () {
  let MatchingPennies;
  let matchingPennies;
  let owner;
  let player1;
  let player2;

  beforeEach(async function () {
    [owner, player1, player2, player3] = await ethers.getSigners();

    // Deploy the contract
    MatchingPennies = await ethers.getContractFactory("MatchingPennies");
    matchingPennies = await MatchingPennies.deploy();
    // save address
    matchingPenniesAddress = matchingPennies.address;
  });

  // It deploys
  it("Should deploy the contract", async function () {
    expect(matchingPennies.address).to.not.equal(0);
  });

  it("Complete fair game", async function () {
    // Player 1 commits a move
    const move1 = false;
    const nonce1 = 1234;
    const move_hash1 = ethers.solidityPackedKeccak256(
      ["bool", "uint256"],
      [move1, nonce1]
    );
    const nonceBytes1 = ethers.solidityPackedKeccak256(["uint256"], [nonce1]);

    await matchingPennies
      .connect(player1)
      .commitJugada(move_hash1, nonceBytes1, {
        value: ethers.parseEther("1.0"),
      });

    // Player 2 commits a move
    const move2 = true;
    const nonce2 = 5678;
    const move_hash2 = ethers.solidityPackedKeccak256(
      ["bool", "uint256"],
      [move2, nonce2]
    );
    const nonceBytes2 = ethers.solidityPackedKeccak256(["uint256"], [nonce2]);

    await matchingPennies
      .connect(player2)
      .commitJugada(move_hash2, nonceBytes2, {
        value: ethers.parseEther("1.0"),
      });

    // Player 1 reveals their move
    await matchingPennies.connect(player1).revelarJugada(nonce1, move1);

    // Player 2 reveals their move
    await matchingPennies.connect(player2).revelarJugada(nonce2, move2);

    // check the rewards
    expect(await matchingPennies.pendientes(player1.address)).to.equal(0);
    expect(await matchingPennies.pendientes(player2.address)).to.equal(
      ethers.parseEther("1.1")
    );

    // withdraw the rewards with function cobrar
    await matchingPennies.connect(player2).cobrar();

    expect(await matchingPennies.pendientes(player2.address)).to.equal(0);

    expect(await ethers.provider.getBalance(player2.address)).to.be.greaterThan(
      ethers.parseEther("1.09")
    );

    // check the balance
    expect(await matchingPennies.balance()).to.equal(ethers.parseEther("0.9"));

    expect(await matchingPennies.pendientes(player1.address)).to.equal(0);

    await expect(matchingPennies.connect(player1).cobrar()).to.be.revertedWith(
      "No tenes nada para cobrar"
    );

    expect(await matchingPennies.balance()).to.equal(ethers.parseEther("0.9"));
  });

  it("A player lies when revealing the play", async function () {
    // Player 1 commits a move
    const move1 = true;
    const nonce1 = 1234;
    const move_hash1 = ethers.solidityPackedKeccak256(
      ["bool", "uint256"],
      [move1, nonce1]
    );
    const nonceBytes1 = ethers.solidityPackedKeccak256(["uint256"], [nonce1]);

    await matchingPennies
      .connect(player1)
      .commitJugada(move_hash1, nonceBytes1, {
        value: ethers.parseEther("1.0"),
      });

    // Player 2 commits a move
    const move2 = true;
    const nonce2 = 5678;
    const move_hash2 = ethers.solidityPackedKeccak256(
      ["bool", "uint256"],
      [move2, nonce2]
    );
    const nonceBytes2 = ethers.solidityPackedKeccak256(["uint256"], [nonce2]);

    await matchingPennies
      .connect(player2)
      .commitJugada(move_hash2, nonceBytes2, {
        value: ethers.parseEther("1.0"),
      });

    // Player 1 reveals their move but lies
    await matchingPennies.connect(player1).revelarJugada(nonce1, false);

    // Everyone receives their money back, but 1 receives 0.9 as a penalty
    expect(await matchingPennies.pendientes(player1.address)).to.equal(
      ethers.parseEther("0.9")
    );
    expect(await matchingPennies.pendientes(player2.address)).to.equal(
      ethers.parseEther("1")
    );

    expect(await matchingPennies.balance()).to.equal(ethers.parseEther("2"));

    //expect to fail if player 2 wants to reveal
    await expect(
      matchingPennies.connect(player2).revelarJugada(nonce2, move2)
    ).to.be.revertedWith("No hay dos jugadas");
  });

  it("A player lies when revealing the nonce", async function () {
    // Player 1 commits a move
    const move1 = true;
    const nonce1 = 1234;
    const move_hash1 = ethers.solidityPackedKeccak256(
      ["bool", "uint256"],
      [move1, nonce1]
    );
    const nonceBytes1 = ethers.solidityPackedKeccak256(["uint256"], [nonce1]);

    await matchingPennies
      .connect(player1)
      .commitJugada(move_hash1, nonceBytes1, {
        value: ethers.parseEther("1.0"),
      });

    // Player 2 commits a move
    const move2 = true;
    const nonce2 = 5678;
    const move_hash2 = ethers.solidityPackedKeccak256(
      ["bool", "uint256"],
      [move2, nonce2]
    );
    const nonceBytes2 = ethers.solidityPackedKeccak256(["uint256"], [nonce2]);

    await matchingPennies
      .connect(player2)
      .commitJugada(move_hash2, nonceBytes2, {
        value: ethers.parseEther("1.0"),
      });

    // Player 1 reveals their move
    await matchingPennies.connect(player1).revelarJugada(nonce1, move1);

    // Player 2 reveals their move but lies with the nonce
    await matchingPennies.connect(player2).revelarJugada(123456789, false);

    // Everyone receives their money back, but 2 receives 0.9 as a penalty
    expect(await matchingPennies.pendientes(player1.address)).to.equal(
      ethers.parseEther("1")
    );
    expect(await matchingPennies.pendientes(player2.address)).to.equal(
      ethers.parseEther("0.9")
    );

    expect(await matchingPennies.balance()).to.equal(ethers.parseEther("2"));

    //expect to fail if player 1 wants to reveal
    await expect(
      matchingPennies.connect(player1).revelarJugada(nonce1, move1)
    ).to.be.revertedWith("No hay dos jugadas");
  });

  it("Cant reveal without plays", async function () {
    // Player 1 commits a move
    const move1 = true;
    const nonce1 = 1234;

    await expect(
      matchingPennies.connect(player1).revelarJugada(nonce1, move1)
    ).to.be.revertedWith("No hay dos jugadas");
  });

  it("Cant commit after 2 plays", async function () {
    // Player 1 commits a move
    const move1 = false;
    const nonce1 = 1234;
    const move_hash1 = ethers.solidityPackedKeccak256(
      ["bool", "uint256"],
      [move1, nonce1]
    );
    const nonceBytes1 = ethers.solidityPackedKeccak256(["uint256"], [nonce1]);

    await matchingPennies
      .connect(player1)
      .commitJugada(move_hash1, nonceBytes1, {
        value: ethers.parseEther("1.0"),
      });

    // Player 2 commits a move
    const move2 = true;
    const nonce2 = 5678;
    const move_hash2 = ethers.solidityPackedKeccak256(
      ["bool", "uint256"],
      [move2, nonce2]
    );
    const nonceBytes2 = ethers.solidityPackedKeccak256(["uint256"], [nonce2]);

    await matchingPennies
      .connect(player2)
      .commitJugada(move_hash2, nonceBytes2, {
        value: ethers.parseEther("1.0"),
      });

    // Player 3 tries to commit a move
    const move3 = true;
    const nonce3 = 5678;
    const move_hash3 = ethers.solidityPackedKeccak256(
      ["bool", "uint256"],
      [move3, nonce3]
    );
    const nonceBytes3 = ethers.solidityPackedKeccak256(["uint256"], [nonce2]);

    await expect(
      matchingPennies.connect(player3).commitJugada(move_hash3, nonceBytes3, {
        value: ethers.parseEther("1.0"),
      })
    ).to.be.revertedWith("Ya hay dos jugadas");
  });

  it("Cant reveal if not player", async function () {
    // Player 1 commits a move
    const move1 = false;
    const nonce1 = 1234;
    const move_hash1 = ethers.solidityPackedKeccak256(
      ["bool", "uint256"],
      [move1, nonce1]
    );
    const nonceBytes1 = ethers.solidityPackedKeccak256(["uint256"], [nonce1]);

    await matchingPennies
      .connect(player1)
      .commitJugada(move_hash1, nonceBytes1, {
        value: ethers.parseEther("1.0"),
      });

    // Player 2 commits a move
    const move2 = true;
    const nonce2 = 5678;
    const move_hash2 = ethers.solidityPackedKeccak256(
      ["bool", "uint256"],
      [move2, nonce2]
    );
    const nonceBytes2 = ethers.solidityPackedKeccak256(["uint256"], [nonce2]);

    await matchingPennies
      .connect(player2)
      .commitJugada(move_hash2, nonceBytes2, {
        value: ethers.parseEther("1.0"),
      });

    await expect(
      matchingPennies.connect(player3).revelarJugada(1234, false)
    ).to.be.revertedWith("No sos jugador");
  });

  it("Cant play with yourself", async function () {
    // Player 1 commits a move
    const move1 = false;
    const nonce1 = 1234;
    const move_hash1 = ethers.solidityPackedKeccak256(
      ["bool", "uint256"],
      [move1, nonce1]
    );
    const nonceBytes1 = ethers.solidityPackedKeccak256(["uint256"], [nonce1]);

    await matchingPennies
      .connect(player1)
      .commitJugada(move_hash1, nonceBytes1, {
        value: ethers.parseEther("1.0"),
      });

    await expect(matchingPennies
      .connect(player1)
      .commitJugada(move_hash1, nonceBytes1, {
        value: ethers.parseEther("1.0"),
      })).to.be.revertedWith("Estas jugando contra vos mismo mismo, pedile a otro que juegue");


  });

});
