// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/******************************************************************************\
* Author: Zubair Khalid <zubairkhalidce@gmail.com>
* Implementation of a stake management diamond facet.
/******************************************************************************/

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../StakeToken.sol";
import { LibDiamond } from "../libraries/LibDiamond.sol";

library StakeManagerLib {

  bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("diamond.standard.stakemanager.storage");
  
  struct Storage {
    StakeToken stakeToken;
    uint128 stakeLockDuration;
    mapping(address => uint256) stakes;
    mapping(address => uint256) stakeUnlockTime;
  }

  function diamondStorage() internal pure returns (Storage storage ds) {
    bytes32 position = DIAMOND_STORAGE_POSITION;
    assembly {
        ds.slot := position
    }
  }
}

contract StakeManager is ReentrancyGuard {

  /**
   * @dev Sets the stake token contract address
   * @param _stakeToken Address of the ERC20 Stake Token Contract
   * @notice Only diamond owner can call this function
   * @notice This function can only be called once
   */

  function setStakeToken(address _stakeToken) external{
    require(_stakeToken != address(0), "cannot set zero address");
    StakeManagerLib.Storage storage s = StakeManagerLib.diamondStorage();
    require(msg.sender == LibDiamond.diamondStorage().contractOwner, "not owner");
    require(address(s.stakeToken) == address(0), "token already set");
    s.stakeToken = StakeToken(_stakeToken);
  }

  /**
   * @dev Sets the stake lock duration and StakeLockDurationChanged event
   * @param duration Duration of the stake lock in seconds
   * @notice Only diamond owner can call this function
   */

  function setstakeLockDuration(uint128 duration) external {
    require(duration > 0, "duration shoud not be zero");
    StakeManagerLib.Storage storage s = StakeManagerLib.diamondStorage();
    require(msg.sender == LibDiamond.diamondStorage().contractOwner, "not owner");
    uint currentDuration = s.stakeLockDuration;
    s.stakeLockDuration = duration;
    emit StakeLockDurationChanged(currentDuration, duration);
  }

  /**
   * @dev Stakes the ethers sent to this contract and mints equal amount of stake tokens
   * @dev Emits Staked event
   */
  function stake() external payable {
    require(msg.value > 0, "can't stake zero amount");
    StakeManagerLib.Storage storage s = StakeManagerLib.diamondStorage();
    s.stakeToken.mint(msg.sender, msg.value);
    s.stakes[msg.sender] += msg.value;
    s.stakeUnlockTime[msg.sender] = block.timestamp + s.stakeLockDuration;
    emit Staked(msg.sender, msg.value);
  }

  /**
   * @dev Withdraws the staked ethers and burns the stake tokens
   * @dev Emits Withdrawn event
   * @notice Can only be called after the stake unlock time
   * @notice Can only be called if the staker has at least the amount of stake tokens equal to the staked ethers
   */

  function withdraw() external nonReentrant{
    StakeManagerLib.Storage storage s = StakeManagerLib.diamondStorage();
    require(s.stakeUnlockTime[msg.sender] <= block.timestamp, "Unlock time not reached");
    uint256 amount = s.stakes[msg.sender];
    require(amount > 0, "No stake");
    require(s.stakeToken.balanceOf(msg.sender) >= amount, "Not enough stake tokens");
    s.stakeToken.burn(msg.sender, amount);
    s.stakes[msg.sender] = 0;
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success, "Transfer failed");
    emit Withdrawn(msg.sender, amount);
  }
  
  /**
   * @dev Returns the staked ethers of the staker
   * @param _staker Address of the staker
   */

  function getStake(address _staker) external view returns (uint256) {
    return StakeManagerLib.diamondStorage().stakes[_staker];
  }

  /**
   * @dev Returns the time left to unlock the staked ethers of the staker
   */
  function getTimeLeftToUnlock(address _staker) external view returns (uint256) {
    StakeManagerLib.Storage storage s = StakeManagerLib.diamondStorage();
    if (s.stakeUnlockTime[_staker] <= block.timestamp) {
      return 0;
    }
    return s.stakeUnlockTime[_staker] - block.timestamp;
  }

  /**
   * @dev Returns the stake lock duration
   */
  function getStakeLockDuration() external view returns (uint256){
    return StakeManagerLib.diamondStorage().stakeLockDuration;
  }

  /**
   * @dev Returns the address of the stake token contract
   */
  function getStakeTokenAddress() external view returns(address) {
    return address(StakeManagerLib.diamondStorage().stakeToken);
  }
  
  event StakeLockDurationChanged(uint256 _prevValue, uint256 _newValue);
  event Staked(address indexed staker, uint256 amount);
  event Withdrawn(address indexed staker, uint256 amount);
}
