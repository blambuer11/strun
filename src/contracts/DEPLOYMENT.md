# Strun Smart Contract - Sui Deployment Guide

## Prerequisites

1. **Install Sui CLI**
```bash
# macOS/Linux
curl --proto '=https' --tlsv1.2 -sSf https://sh.sui.io/install | sh

# Windows
# Download from: https://github.com/MystenLabs/sui/releases
```

2. **Create Sui Wallet**
```bash
# Create new address
sui client new-address ed25519

# Get your address
sui client active-address

# Request test SUI from faucet
curl --location --request POST 'https://faucet.testnet.sui.io/gas' \
--header 'Content-Type: application/json' \
--data-raw '{
    "FixedAmountRequest": {
        "recipient": "YOUR_ADDRESS_HERE"
    }
}'
```

## Deployment Steps

### 1. Prepare the Contract

Create a new Sui Move project:
```bash
sui move new strun
cd strun
```

Copy the contract file:
```bash
# Copy strun.move to sources/strun.move
cp ../src/contracts/strun.move sources/
```

Update `Move.toml`:
```toml
[package]
name = "strun"
version = "0.1.0"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "testnet" }

[addresses]
strun = "0x0"
```

### 2. Build the Contract

```bash
# Build the package
sui move build

# Run tests (optional)
sui move test
```

### 3. Deploy to Testnet

```bash
# Deploy the package
sui client publish --gas-budget 100000000

# The output will show:
# - Package ID: 0x...
# - Transaction digest
# - Created objects
```

Save the Package ID! You'll need it for the frontend.

### 4. Verify Deployment

```bash
# View package details
sui client object PACKAGE_ID

# View transaction
sui client transaction TRANSACTION_DIGEST
```

### 5. Update Frontend Configuration

Update `src/lib/sui-config.ts`:
```typescript
export const PACKAGE_ID = '0x...'; // Your deployed package ID
```

## Interact with the Contract

### Create User Profile
```bash
sui client call \
  --package PACKAGE_ID \
  --module territory \
  --function create_profile \
  --args "username_bytes" "0x6" \
  --gas-budget 10000000
```

### Start Run Session
```bash
sui client call \
  --package PACKAGE_ID \
  --module territory \
  --function start_run \
  --args "0x6" \
  --gas-budget 10000000
```

### Claim Territory
```bash
sui client call \
  --package PACKAGE_ID \
  --module territory \
  --function claim_territory \
  --args GAME_STATE_ID PROFILE_ID "territory_name" \
         "[coordinates_array]" "distance" "rent_price" "0x6" \
  --gas-budget 10000000
```

## Important Addresses & Objects

After deployment, note these important objects:
- **GameState Object ID**: Shared object for game state
- **Package ID**: Your deployed package address
- **Profile Object ID**: User's profile NFT

## Mainnet Deployment

For mainnet deployment:

1. Switch to mainnet:
```bash
sui client switch --env mainnet
```

2. Get mainnet SUI tokens from exchanges

3. Update Move.toml dependencies to mainnet:
```toml
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "mainnet" }
```

4. Deploy with higher gas budget:
```bash
sui client publish --gas-budget 500000000
```

## Security Checklist

- [ ] Test thoroughly on testnet first
- [ ] Verify all permissions and access controls
- [ ] Check rent calculations and XP distribution
- [ ] Test edge cases (minimum territory size, etc.)
- [ ] Audit smart contract code
- [ ] Set appropriate gas budgets
- [ ] Document all object IDs and addresses

## Troubleshooting

**Error: Insufficient gas**
- Increase gas budget: `--gas-budget 200000000`

**Error: Address not found**
- Ensure you have SUI tokens: `sui client gas`
- Check active address: `sui client active-address`

**Error: Package build failed**
- Check Move.toml dependencies
- Verify Sui CLI version: `sui --version`
- Run `sui move build --skip-fetch-latest-git-deps`

## Support

- [Sui Documentation](https://docs.sui.io/)
- [Sui Discord](https://discord.gg/sui)
- [Move Language Book](https://move-book.com/)