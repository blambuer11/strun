🗺️ Strun – Running & Map NFT Platform

Strun is a Web3 platform where users can track their running routes in real-time on the map, calculate the covered areas, mint them as NFTs, and trade or rent those areas.
The project integrates zkLogin (Google OAuth) authentication, Sui blockchain NFT minting, MapTiler / MapLibre GL for maps, Walrus decentralized storage, and social running group features.

🚀 Features

🔑 zkLogin Authentication: Sign in securely with your Google account.

🗺️ Live Run Tracking: Your running route is drawn live on the map.

📍 Area Calculation: At the end of the run, the covered area is automatically calculated.

🎨 NFT Minting: The calculated area is minted as an NFT and cannot be minted again.

🗂️ Walrus Storage: Store run metadata, route data, and user-generated content permanently and verifiably on decentralized storage.

👥 Group Runs: Create group run points and join others on the map.

🏷️ Area Ownership: Owners’ usernames and profile pictures are displayed on their areas.

🔄 Trading & Renting: Trade or rent your NFT-owned areas with other users.

🛠️ Tech Stack

Frontend: React + TypeScript

Maps: MapTiler
 + MapLibre GL JS

Blockchain: Sui Move
 Smart Contracts

Auth: zkLogin
 (Google OAuth)

Storage: Walrus
 decentralized data layer

Backend: Node.js + Express (API & DB)

Database: PostgreSQL / Supabase

⚡ Installation
1. Clone the repo
git clone https://github.com/username/strun.git
cd strun

2. Install dependencies
npm install

3. Environment variables

Create a .env file in the root:

VITE_MAPTILER_KEY=your_maptiler_api_key
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_SUI_NETWORK=testnet
VITE_WALRUS_NODE=https://node.walrus.site

4. Run development server
npm run dev

5. Deploy Sui smart contracts
cd sui-contracts/map_land
sui move build
sui client publish --gas-budget 200000000

6. Store data on Walrus

Example (upload run metadata JSON):

curl -X POST https://node.walrus.site/store \
  -H "Content-Type: application/json" \
  -d '{"route":"geojson_data","owner":"0xUSER","timestamp":1234567890}'

📌 Usage

Login with Google (zkLogin).

Start running — your live route will appear on the map.

When you finish, the covered area is calculated.

Mint the area as an NFT (cannot be duplicated).

Store the run’s metadata & map data permanently on Walrus.

View owned areas in your profile and trade/rent them.

Join group runs and view other participants’ areas on the map.

👨‍💻 Contributing

Fork this repo 🍴

Create a new branch (feature/new-feature)

Commit your changes

Open a pull request

📄 License

This project is licensed under the MIT License.

💡 Note: You need SUI tokens in your wallet to deploy on mainnet. For testing, you can use the official Sui testnet faucet.
