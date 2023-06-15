/* global describe it before ethers */
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import Selectors from "../scripts/libraries/diamond";
import deployDiamond from '../scripts/deploy';
import { DiamondCutFacet__factory, DiamondCutFacet } from "../typechain-types";
import { DiamondLoupeFacet__factory, DiamondLoupeFacet } from "../typechain-types";
import { OwnershipFacet__factory, OwnershipFacet } from "../typechain-types";
import { StakeToken__factory, StakeToken } from "../typechain-types";
import { StakeManager__factory, StakeManager } from "../typechain-types";


describe('DiamondTest', async function () {
  let deployedAddresses: {diamondAddress: string, stakeTokenAddress: string}
  let diamondCutFacet: DiamondCutFacet
  let diamondLoupeFacet: DiamondLoupeFacet
  let ownershipFacet: OwnershipFacet
  let stakeManager: StakeManager
  let stakeToken: StakeToken
  let tx
  let receipt
  let result
  const addresses: string[] = []
  const lockDuration = 15 * 60 * 60 * 24; //15 Days

  before(async function () {
    deployedAddresses = await deployDiamond()
    diamondCutFacet = DiamondCutFacet__factory.connect(deployedAddresses.diamondAddress, (await ethers.getSigners())[0])
    diamondLoupeFacet = DiamondLoupeFacet__factory.connect(deployedAddresses.diamondAddress, (await ethers.getSigners())[0])
    ownershipFacet = OwnershipFacet__factory.connect(deployedAddresses.diamondAddress, (await ethers.getSigners())[0])
    stakeManager = StakeManager__factory.connect(deployedAddresses.diamondAddress, (await ethers.getSigners())[0])
    stakeToken = StakeToken__factory.connect(deployedAddresses.stakeTokenAddress, (await ethers.getSigners())[0])
  })

  it('diamond should have four facets', async () => {
    for (const address of await diamondLoupeFacet.facetAddresses()) {
      addresses.push(address)
    }
    expect(addresses.length).equal(4)
  })

  it('facets should have the right function selectors', async () => {
    let selectors = Selectors.getSelectors(diamondCutFacet.interface)
    result = Array.from((await diamondLoupeFacet.facetFunctionSelectors(addresses[0])))
    expect(result).to.have.members(selectors)

    selectors = Selectors.getSelectors(diamondLoupeFacet.interface)
    result = Array.from((await diamondLoupeFacet.facetFunctionSelectors(addresses[1])))
    expect(result).to.have.members(selectors)

    selectors = Selectors.getSelectors(ownershipFacet.interface)
    result = Array.from((await diamondLoupeFacet.facetFunctionSelectors(addresses[2])))
    expect(result).to.have.members(selectors)

    selectors = Selectors.getSelectors(stakeManager.interface)
    result = Array.from((await diamondLoupeFacet.facetFunctionSelectors(addresses[3])))
    expect(result).to.have.members(selectors)
  })

  it('diamond should be the owner of the stake token', async() => {
    const owner = await stakeToken.owner()
    expect(owner).to.equal(deployedAddresses.diamondAddress)
  })

  it('owner should be able to set stake lock duration', async() => {
    
    tx = await stakeManager.setstakeLockDuration(lockDuration)
    receipt = await tx.wait()
    if (!receipt!.status) {
      throw Error(`Tx failed: ${tx.hash}`)
    }
    result = await stakeManager.getStakeLockDuration();
    expect(result).to.equal(lockDuration);
  })

  it('owner should be able to set stake token only once', async() => {
    tx = await stakeManager.setStakeToken(deployedAddresses.stakeTokenAddress)
    receipt = await tx.wait()
    if (!receipt!.status) {
      throw Error(`Tx failed: ${tx.hash}`)
    }
    result = await stakeManager.getStakeTokenAddress();
    expect(result).to.equal(deployedAddresses.stakeTokenAddress);
    tx = stakeManager.setStakeToken(deployedAddresses.stakeTokenAddress)
    expect(tx).to.be.revertedWith('token already set')
  })

  it('user should be able to stake ethers and get equal amount of stake tokens', async() => {

    const user = (await ethers.getSigners())[1];
    const stakeAmount = "1.0";
    stakeManager = StakeManager__factory.connect(deployedAddresses.diamondAddress, user)
    
    tx = await stakeManager.stake({value: ethers.parseEther(stakeAmount)})
    receipt = await tx.wait()
    if (!receipt!.status) {
      throw Error(`Tx failed: ${tx.hash}`)
    }
    result = await stakeToken.balanceOf(user.address)
    expect(ethers.formatEther(result)).to.equal(stakeAmount);
  })

  it('user should not be able to withdraw stake before unlock time', async() => {
    tx = stakeManager.withdraw()
    expect(tx).to.be.revertedWith('Unlock time not reached')
  })

  it('user should not be able to withdraw stake if stake tokens are less than stake amount', async() => {

    const user = (await ethers.getSigners())[1];
    const user2 = (await ethers.getSigners())[2];

    stakeToken = StakeToken__factory.connect(deployedAddresses.stakeTokenAddress, user)

    const totalStakeTokenBalance = await stakeToken.balanceOf(user.address);
    await stakeToken.transfer(user2.address, totalStakeTokenBalance)

    const unlockTime = (await time.latest()) + lockDuration;
    time.increaseTo(unlockTime)

    tx = stakeManager.withdraw()
    expect(tx).to.be.revertedWith('Not enough stake tokens')

    stakeToken = StakeToken__factory.connect(deployedAddresses.stakeTokenAddress, user2)
    await stakeToken.transfer(user.address, totalStakeTokenBalance)

  })

  it('user should able to withdraw stake after unlock time reached', async() => {

    const user = (await ethers.getSigners())[1];

    const unlockTime = (await time.latest()) + lockDuration;
    time.increaseTo(unlockTime)

    tx = await stakeManager.withdraw()
    receipt = await tx.wait()
    if (!receipt!.status) {
      throw Error(`Tx failed: ${tx.hash}`)
    }

    result = await stakeToken.balanceOf(user.address)
    expect(ethers.formatEther(result)).to.equal("0.0");
    const stake = await stakeManager.getStake(user.address)
    expect(stake).to.equal(0n);

  });
})
