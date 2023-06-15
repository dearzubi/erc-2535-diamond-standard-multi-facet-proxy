/* global ethers */
import { ethers } from "ethers"

export enum FacetCutAction { 
  Add = 0, 
  Replace = 1, 
  Remove = 2 
}

export interface IFacetCut{
  facetAddress: string;
  action: FacetCutAction;
  functionSelectors: string[];
}

export default class Selectors {

  selectors: string[];
  contract: ethers.Contract;

  constructor(selectors: string[], contract: ethers.Contract){
    this.selectors = selectors
    this.contract = contract
  }

  // get function selectors from ABI
  static getSelectors (contractInterface: ethers.Interface): string[] {
    const selectors: string[] = []
    contractInterface.fragments.forEach((fragment) => {
      if (fragment.type === 'function') {
        const funcFragment = fragment as ethers.FunctionFragment;
        if(funcFragment.format('sighash') !== 'init(bytes)'){
          selectors.push(funcFragment.selector)
        }
      }
    });
    return selectors
  }

  // get function selector from function signature
  static getSelector (func: string) {
    return ethers.FunctionFragment.from(func).selector;
  }

  // remove selectors using an array of signatures
  static removeSelectors (selectors: string[], signatures: string[]): string[] {
    const removeSelectors = signatures.map(v => Selectors.getSelector(v));
    selectors = selectors.filter(v => !removeSelectors.includes(v))
    return selectors
  }

  // find a particular address position in the return value of diamondLoupeFacet.facets()
  static findAddressPositionInFacets (facetAddress: string, facets: IFacetCut[]) {
    for (let i = 0; i < facets.length; i++) {
      if (facets[i].facetAddress === facetAddress) {
        return i
      }
    }
  }
  
  // used to remove selectors from an array of selectors
  // functionNames argument is an array of function signatures
  remove (functionNames: string[]) {
    this.selectors = this.selectors.filter((v) => {
      for (const functionName of functionNames) {
        if (v === Selectors.getSelector(functionName)) {
          return false
        }
      }
      return true
    })
  }

  // used to get selectors from an array of selectors
  // functionNames argument is an array of function signatures
  get (functionNames: string[]): string[] {
    const selectors = this.selectors.filter((v) => {
      for (const functionName of functionNames) {
        if (v === Selectors.getSelector(functionName)) {
          return true
        }
      }
      return false
    })
    return selectors
  }
  
}
