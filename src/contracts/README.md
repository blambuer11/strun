# Strun Smart Contract - Sui Blockchain

## Overview
This smart contract powers the Strun gamified running application on the Sui blockchain. It manages territories, XP tokens, and rent payments.

## Features
- **Territory NFTs**: Claim real-world areas as blockchain territories
- **XP Token System**: Earn XP for running and claiming territories
- **Rent Mechanism**: Pay rent when entering other users' territories
- **User Profiles**: Track stats, XP balance, and owned territories
- **Run Sessions**: Record and verify running activities

## Deployment Instructions

### Prerequisites
1. Install Sui CLI:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.sui.io/install | sh
```

2. Set up a Sui wallet:
```bash
sui client new-address ed25519
```

3. Get test SUI tokens from faucet:
```bash
sui client faucet
```

### Deploy Contract

1. Create a new Move project:
```bash
sui move new strun
cd strun
```

2. Copy the contract code to `sources/strun.move`

3. Update `Move.toml`:
```toml
[package]
name = "strun"
version = "0.0.1"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "mainnet" }

[addresses]
strun = "0x0"
```

4. Build the contract:
```bash
sui move build
```

5. Deploy to testnet:
```bash
sui client publish --gas-budget 100000000
```

6. Note the Package ID from the deployment output

### Interaction Examples

#### Create User Profile
```bash
sui client call --package <PACKAGE_ID> --module territory --function create_profile \
  --args "username_bytes" <CLOCK_OBJECT> --gas-budget 10000000
```

#### Start a Run
```bash
sui client call --package <PACKAGE_ID> --module territory --function start_run \
  --args <CLOCK_OBJECT> --gas-budget 10000000
```

#### Claim Territory
```bash
sui client call --package <PACKAGE_ID> --module territory --function claim_territory \
  --args <GAME_STATE> <USER_PROFILE> "territory_name" "[coordinates]" 1000 100 <CLOCK_OBJECT> \
  --gas-budget 10000000
```

## Contract Structure

### Main Components
- **XP Token**: In-game currency earned through running
- **Territory NFT**: Owned areas that generate rent
- **UserProfile**: Tracks user stats and XP balance
- **GameState**: Global game statistics
- **RunSession**: Temporary object for tracking runs

### Key Functions
- `create_profile`: Initialize a new user account
- `start_run`: Begin a running session
- `claim_territory`: Convert completed run into territory NFT
- `pay_rent`: Pay XP to enter another user's territory
- `complete_run`: Finalize run and earn rewards

## Security Considerations
- Minimum territory size enforcement (100m)
- Ownership verification for all transfers
- Balance checks before transactions
- Event emission for transparency

## Gas Optimization
- Use of native Sui types for efficiency
- Batch operations where possible
- Minimal storage for coordinate data

## Future Enhancements
- Territory battles and challenges
- Seasonal events and rewards
- Territory upgrades and customization
- Social features and teams

## License
MIT