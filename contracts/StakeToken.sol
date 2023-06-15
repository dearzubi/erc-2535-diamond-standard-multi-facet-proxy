// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract StakeToken is ERC20, Ownable {

  constructor(uint256 initialSupply) ERC20("StakeToken", "ST") {
    _mint(msg.sender, initialSupply * (10**decimals()));
  }

  function mint(address to, uint256 amount) external onlyOwner {
    _mint(to, amount);
  }

  function burn(address account, uint256 amount) external onlyOwner {
    _burn(account, amount);
  }

}