/* global ethers */
/* eslint prefer-const: "off" */
import { ethers } from "hardhat";
import { StakeToken__factory } from "../typechain-types";
import Selectors, {FacetCutAction, IFacetCut} from "./libraries/diamond";

async function deployDiamond () {
  console.log()
  const accounts = await ethers.getSigners()
  const contractOwner = accounts[0]

  const StakeToken = await ethers.getContractFactory('StakeToken') as StakeToken__factory;
  const stakeToken = await StakeToken.deploy(10 ** 9); //Mint 10 ** 9 tokens for the owner
  await stakeToken.waitForDeployment()
  console.log('StakeToken deployed:', (await stakeToken.getAddress()));

  // Deploy DiamondInit
  // DiamondInit provides a function that is called when the diamond is upgraded or deployed to initialize state variables
  // Read about how the diamondCut function works in the EIP2535 Diamonds standard
  const DiamondInit = await ethers.getContractFactory('DiamondInit')
  const diamondInit = await DiamondInit.deploy()
  await diamondInit.waitForDeployment()
  console.log('DiamondInit deployed:', (await diamondInit.getAddress()))
  

  // Deploy facets and set the `facetCuts` variable
  console.log('')
  console.log('Deploying facets')
  const FacetNames = [
    'DiamondCutFacet',
    'DiamondLoupeFacet',
    'OwnershipFacet',
    'StakeManager'
  ]
  // The `facetCuts` variable is the FacetCut[] that contains the functions to add during diamond deployment
  const facetCuts: IFacetCut[] = [];
  for (const FacetName of FacetNames) {
    const Facet = await ethers.getContractFactory(FacetName)
    const facet = await Facet.deploy()
    await facet.waitForDeployment()
    console.log(`${FacetName} deployed: ${(await facet.getAddress())}`)
    facetCuts.push({
      facetAddress: (await facet.getAddress()),
      action: FacetCutAction.Add,
      functionSelectors: Selectors.getSelectors((facet.interface))
    })
  }

  // Creating a function call
  // This call gets executed during deployment and can also be executed in upgrades
  // It is executed with delegatecall on the DiamondInit address.
  let functionCall = diamondInit.interface.encodeFunctionData('init')

  // Setting arguments that will be used in the diamond constructor
  const diamondArgs = {
    owner: contractOwner.address,
    init: (await diamondInit.getAddress()),
    initCalldata: functionCall
  }

  // deploy Diamond
  const Diamond = await ethers.getContractFactory('Diamond')
  const diamond = await Diamond.deploy(facetCuts, diamondArgs)
  await diamond.waitForDeployment()
  console.log()
  console.log('Diamond deployed:', (await diamond.getAddress())) 
  console.log()
  await stakeToken.transferOwnership((await diamond.getAddress()))

  // returning the address of the diamond
  return {
    diamondAddress: (await diamond.getAddress()),
    stakeTokenAddress: (await stakeToken.getAddress())
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
if (require.main === module) {
  deployDiamond()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error)
      process.exit(1)
    })
}

export default deployDiamond
