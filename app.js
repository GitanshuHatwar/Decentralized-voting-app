// DeVote - Decentralized Voting App
import { ethers } from "https://esm.sh/ethers@6.13.1";

// CONFIG: Paste the address of your Voting contract deployed on Sepolia here.
const CONTRACT_ADDRESS = "0xb421adA4A33443cFFB3B5cD58Ce484711cb31FD7";
const ABI = [
		{
			"inputs": [
				{
					"internalType": "string[]",
					"name": "candidateNames",
					"type": "string[]"
				}
			],
			"stateMutability": "nonpayable",
			"type": "constructor"
		},
		{
			"inputs": [
				{
					"internalType": "uint256",
					"name": "candidateIndex",
					"type": "uint256"
				}
			],
			"name": "vote",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": true,
					"internalType": "address",
					"name": "voter",
					"type": "address"
				},
				{
					"indexed": true,
					"internalType": "uint256",
					"name": "candidateIndex",
					"type": "uint256"
				}
			],
			"name": "VoteCast",
			"type": "event"
		},
		{
			"inputs": [
				{
					"internalType": "uint256",
					"name": "",
					"type": "uint256"
				}
			],
			"name": "candidates",
			"outputs": [
				{
					"internalType": "string",
					"name": "name",
					"type": "string"
				},
				{
					"internalType": "uint256",
					"name": "voteCount",
					"type": "uint256"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address",
					"name": "voter",
					"type": "address"
				}
			],
			"name": "checkIfVoted",
			"outputs": [
				{
					"internalType": "bool",
					"name": "",
					"type": "bool"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [],
			"name": "getCandidateCount",
			"outputs": [
				{
					"internalType": "uint256",
					"name": "",
					"type": "uint256"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [],
			"name": "getCandidates",
			"outputs": [
				{
					"components": [
						{
							"internalType": "string",
							"name": "name",
							"type": "string"
						},
						{
							"internalType": "uint256",
							"name": "voteCount",
							"type": "uint256"
						}
					],
					"internalType": "struct Voting.Candidate[]",
					"name": "",
					"type": "tuple[]"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address",
					"name": "",
					"type": "address"
				}
			],
			"name": "hasVoted",
			"outputs": [
				{
					"internalType": "bool",
					"name": "",
					"type": "bool"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [],
			"name": "owner",
			"outputs": [
				{
					"internalType": "address",
					"name": "",
					"type": "address"
				}
			],
			"stateMutability": "view",
			"type": "function"
		}
	];
// Global state
let provider = null;
let signer = null;
let contract = null;
let contractWithSigner = null;
let userAddress = null;

// DOM elements
const connectBtn = document.getElementById("connectBtn");
const walletInfo = document.getElementById("walletInfo");
const walletAddress = document.getElementById("walletAddress");
const statusBar = document.getElementById("statusBar");
const statusIcon = document.getElementById("statusIcon");
const statusMsg = document.getElementById("statusMsg");
const connectPrompt = document.getElementById("connectPrompt");
const loadingState = document.getElementById("loadingState");
const candidatesGrid = document.getElementById("candidatesGrid");
const footerAddress = document.getElementById("footerAddress");

// Initialize on page load
(function init() {
  if (!window.ethereum) {
    alert(
      "🦊 MetaMask not detected!\n\nPlease install MetaMask: https://metamask.io",
    );
    connectBtn.textContent = "MetaMask Required";
    connectBtn.disabled = true;
  }
  footerAddress.textContent = ethers.isAddress(CONTRACT_ADDRESS)
    ? CONTRACT_ADDRESS
    : "Paste your Sepolia contract address in app.js";
})();

// Connect wallet and load contract
window.connectWallet = async function () {
  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    userAddress = await signer.getAddress();
    // Check network using MetaMask directly
    const chainId = await window.ethereum.request({
      method: "eth_chainId",
    });

    // Sepolia chainId in HEX = 0xaa36a7
    if (chainId !== "0xaa36a7") {
      showStatus(
        "error",
        "⚠️",
        "Please switch to Sepolia testnet in MetaMask!",
      );
      return;
    }

    if (!ethers.isAddress(CONTRACT_ADDRESS)) {
      showStatus(
        "error",
        "⚙️",
        "Set a valid Sepolia contract address in app.js.",
      );
      return;
    }

    const deployedCode = await provider.getCode(CONTRACT_ADDRESS);
    if (deployedCode === "0x") {
      showStatus(
        "error",
        "⚙️",
        "No contract was found at this address on Sepolia. Check the deployed contract address.",
      );
      return;
    }

    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
    // console.log("Contract loaded at:", contract);
    contractWithSigner = contract.connect(signer);

    connectBtn.classList.add("hidden");
    walletInfo.classList.remove("hidden");
    walletAddress.textContent = truncateAddress(userAddress);

    await loadCandidates();
  } catch (err) {
    console.error("connectWallet error:", err);
    if (err.code === 4001) {
      showStatus("error", "❌", "Connection rejected by user.");
    } else {
      showStatus("error", "❌", "Failed to connect: " + err.message);
    }
  }
};

connectBtn.addEventListener("click", window.connectWallet);

// Load candidates from blockchain
async function loadCandidates() {
  connectPrompt.classList.add("hidden");
  candidatesGrid.classList.add("hidden");
  loadingState.classList.remove("hidden");

  try {
    const candidates = await contract.getCandidates();
    const alreadyVoted = await contract.checkIfVoted(userAddress);
    const totalVotes = candidates.reduce(
      (sum, c) => sum + Number(c.voteCount),
      0,
    );

    loadingState.classList.add("hidden");
    candidatesGrid.classList.remove("hidden");
    renderCandidates(candidates, totalVotes, alreadyVoted);
    hideStatus();
  } catch (err) {
    console.error("loadCandidates error:", err);
    loadingState.classList.add("hidden");
    if (err.code === "BAD_DATA" && err.info?.method === "getCandidates") {
      showStatus(
        "error",
        "⚙️",
        "This contract does not implement getCandidates(). Deploy the current Voting.sol on Sepolia and use that contract address.",
      );
    } else {
      showStatus("error", "❌", "Failed to load candidates: " + err.message);
    }
  }
}

// Render candidate cards
function renderCandidates(candidates, totalVotes, alreadyVoted) {
  candidatesGrid.innerHTML = "";

  if (candidates.length === 0) {
    candidatesGrid.innerHTML = `<p style="color:var(--text-muted);text-align:center;grid-column:1/-1;">No candidates found.</p>`;
    return;
  }

  candidates.forEach((candidate, index) => {
    const count = Number(candidate.voteCount);
    const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

    const card = document.createElement("div");
    card.className = "candidate-card" + (alreadyVoted ? " voted-card" : "");
    card.innerHTML = `
      <div class="card-index">// CANDIDATE_${String(index).padStart(3, "0")}</div>
      <div class="candidate-name">${escapeHtml(candidate.name)}</div>
      <div class="vote-count-row">
        <span class="vote-number">${count}</span>
        <span class="vote-label">votes · ${pct}%</span>
      </div>
      <div class="vote-bar-track">
        <div class="vote-bar-fill" style="width: ${pct}%"></div>
      </div>
      <button class="btn-vote" data-index="${index}" ${alreadyVoted ? 'disabled title="You already voted"' : ""} onclick="castVote(${index})">
        ${alreadyVoted ? "✓ Voted" : "Vote →"}
      </button>
    `;
    candidatesGrid.appendChild(card);
  });
}

// Cast vote transaction
window.castVote = async function (candidateIndex) {
  if (!contractWithSigner) {
    showStatus("error", "❌", "Please connect wallet first.");
    return;
  }

  try {
    setVoteButtonsDisabled(true);
    showStatus("pending", "⏳", "Waiting for MetaMask confirmation...");

    const tx = await contractWithSigner.vote(candidateIndex);
    showStatus("pending", "⛏️", `Tx pending... (${truncateAddress(tx.hash)})`);

    await tx.wait();
    showStatus("success", "✅", "Vote cast successfully!");
    await loadCandidates();
  } catch (err) {
    console.error("castVote error:", err);
    setVoteButtonsDisabled(false);

    if (err.code === 4001) {
      showStatus("error", "🚫", "Transaction cancelled by user.");
    } else if (err.message?.includes("already voted")) {
      showStatus("error", "🗳️", "You already voted! Each wallet votes once.");
    } else if (err.message?.includes("Invalid candidate")) {
      showStatus("error", "❌", "Invalid candidate - refresh and try again.");
    } else if (err.message?.includes("insufficient funds")) {
      showStatus("error", "💸", "Insufficient Sepolia ETH for gas.");
    } else {
      showStatus("error", "❌", "Vote failed: " + (err.reason || err.message));
    }
  }
};

// Utility functions
function showStatus(type, icon, message) {
  statusBar.classList.remove("pending", "success", "error", "hidden");
  statusBar.classList.add(type);
  statusIcon.textContent = icon;
  statusMsg.textContent = message;
}

function hideStatus() {
  statusBar.classList.add("hidden");
}

function setVoteButtonsDisabled(disabled) {
  document
    .querySelectorAll(".btn-vote")
    .forEach((btn) => (btn.disabled = disabled));
}

function truncateAddress(address) {
  if (!address) return "";
  return address.slice(0, 6) + "..." + address.slice(-4);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// Handle account/network changes
if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => window.location.reload());
  window.ethereum.on("chainChanged", () => window.location.reload());
}
