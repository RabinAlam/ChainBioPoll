# 🗳️ ChainBioPoll: Blockchain-Integrated Biometric E-Voting System

<p align="center">
  <img src="https://img.shields.io/badge/Blockchain-Ethereum-blue" alt="Ethereum">
  <img src="https://img.shields.io/badge/Smart%20Contracts-Solidity-363636" alt="Solidity">
  <img src="https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB" alt="React">
  <img src="https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933" alt="Node.js">
  <img src="https://img.shields.io/badge/Database-MongoDB-47A248" alt="MongoDB">
</p>

**ChainBioPoll** is a full-stack decentralized application (dApp) that demonstrates a secure, privacy-preserving electronic voting architecture. It combines off-chain biometric identity simulation with on-chain Ethereum smart contracts to ensure transparency, prevent duplicate voting, and preserve voter pseudonymity.

---

## ✨ System Architecture & Key Features

This repository implements a hybrid architecture where sensitive identity data is kept off-chain, and only cryptographic proofs (hashes) are published to the blockchain.

### 1. Privacy-Preserving Identity (Off-Chain)
- **Data Segregation:** The Node.js/MongoDB backend securely stores raw National IDs (NID), Names, and simulated Biometric Vectors.
- **Cryptographic Hashing:** During registration, the backend generates a random `salt`, encrypts it using AES-256, and derives a `voterHash` using **SHA-256(NID + Salt)**.
- **Zero Raw Data On-Chain:** The Ethereum smart contract never sees a voter's NID or face data, protecting against on-chain data scraping and preserving voter privacy.

### 2. Smart Contract Integrity (On-Chain)
- **One-Person-One-Vote:** The `LocalVoting.sol` smart contract enforces that a registered `voterHash` can only cast a single vote.
- **Access Control:** The Election Commission (contract deployer) is the only entity that can register candidates, register eligible voter hashes, and start/end the election lifecycle.
- **Security Audited:** The contract has been audited (via Slither and manual review) to prevent front-running vote theft, mid-election state manipulation, and event-log privacy leaks.

### 3. End-to-End Voting Flow
- **Registration:** Admin inputs NID into the frontend → Backend generates `voterHash` → Admin triggers MetaMask transaction to call `registerVoter(voterHash)` on the blockchain.
- **Authentication:** Voter provides their NID → Backend simulates biometric scanning and matches the record → Returns the `voterHash` to the frontend state.
- **Vote Casting:** The frontend unlocks. The voter selects a candidate, and the app calls `castVote(candidateId, voterHash)` on the blockchain.

---

## 🛠️ Technology Stack

| Component | Tech Used | Description |
| :--- | :--- | :--- |
| **Frontend** | React, TypeScript, Vite, Tailwind CSS | Glassmorphism UI, real-time toast notifications, responsive dashboards. |
| **Web3 Integration** | Ethers.js (v6), MetaMask | Connects the UI to the blockchain, handles contract abstractions. |
| **Smart Contracts** | Solidity (`^0.8.24`), Foundry | `LocalVoting.sol` handles election state and vote tallying. |
| **Backend API** | Node.js, Express.js | Exposes `/api/register` and `/api/authenticate` endpoints. |
| **Database** | MongoDB (Mongoose) | Stores encrypted off-chain voter records. |
| **Cryptography** | `crypto-js` | SHA-256 hashing and AES encryption for salts. |

---

## 🚀 Installation & Local Development Guide

### Prerequisites
- Node.js (v18+)
- MongoDB (running locally on port 27017 or via Atlas)
- [Foundry](https://getfoundry.sh/) (Forge, Anvil, Cast)
- MetaMask browser extension

---

### Step 1: Start the Local Blockchain & Deploy Contract

1. Open a terminal and start the local Anvil testnet:
   ```bash
   anvil
   ```
2. Open a second terminal, navigate to the `contracts` directory, and deploy:
   ```bash
   cd contracts
   forge build
   forge create src/LocalVoting.sol:LocalVoting \
       --rpc-url http://127.0.0.1:8545 \
       --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
   ```
   *(Note down the Deployed To: `CONTRACT_ADDRESS` output)*

---

### Step 2: Start the Backend Server

1. Open a third terminal and navigate to the `server` directory:
   ```bash
   cd server
   npm install
   ```
2. Create a `.env` file in the `server` directory:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://127.0.0.1:27017/chainbiopoll
   ENCRYPTION_KEY=your_super_secret_32_byte_aes_key_here
   ```
3. Start the Express server:
   ```bash
   npm run dev
   ```
   *The backend will be running at `http://localhost:5000`.*

---

### Step 3: Configure and Start the Frontend

1. Open a fourth terminal in the root project directory:
   ```bash
   npm install
   ```
2. Create a `.env` file in the root directory (update with your deployed contract address):
   ```env
   VITE_CONTRACT_ADDRESS=0x5fbdb2315678afecb367f032d93f642f64180aa3
   VITE_API_URL=http://localhost:5000/api
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The app will be running at `http://localhost:5173`.*

---

### Step 4: MetaMask Setup

1. Open MetaMask and add a custom network:
   - **Network Name:** Anvil Local
   - **RPC URL:** `http://127.0.0.1:8545`
   - **Chain ID:** `31337`
   - **Currency Symbol:** `ETH`
2. Import an Anvil private key (e.g., `0xac09...ff80` - the default account #0) to act as the **Admin / Election Commission**.
3. Import a second Anvil private key to act as a **Voter**.

---

## 📂 Repository Structure

```text
ChainBioPoll/
├── contracts/                  # Foundry environment
│   ├── src/LocalVoting.sol     # Core voting logic
│   └── test/LocalVoting.t.sol  # Comprehensive test suite
├── server/                     # Express/MongoDB backend
│   ├── src/models/Voter.js     # Mongoose schema
│   ├── src/routes/voter.js     # API endpoints
│   └── src/utils/crypto.js     # Hashing & AES utilities
├── src/                        # React Frontend
│   ├── components/             # Reusable UI (Navbar, Toast)
│   ├── context/                # Web3 & Contract state management
│   ├── lib/                    # API clients and contract abstractions
│   └── pages/                  # Admin, Voter, and Public Results views
└── package.json                # Frontend dependencies
```

---

## 🛡️ Security Audit
This repository contains a thoroughly audited smart contract. Fixes include:
- Binding `voterHash` to `msg.sender` to prevent mempool front-running (Vote Theft).
- `whenNotActive` modifiers to prevent mid-election ballot manipulation.
- Removal of indexed hashes in event logs to prevent voter de-anonymization.

---

## 📄 License
This project is licensed under the MIT License.
