import { ethers } from "https://esm.sh/ethers@6.13.1";

// Address of the deployed Voting contract on Sepolia.
const CONTRACT_ADDRESS = "0x300D4534e76A76780378E27483DB6935C8B4C57c";
const ABI = [
  { inputs: [], name: "getCandidates", outputs: [{ components: [{ internalType: "string", name: "name", type: "string" }, { internalType: "uint256", name: "voteCount", type: "uint256" }], internalType: "struct Voting.Candidate[]", name: "", type: "tuple[]" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "address", name: "voter", type: "address" }], name: "checkIfVoted", outputs: [{ internalType: "bool", name: "", type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "candidateIndex", type: "uint256" }], name: "vote", outputs: [], stateMutability: "nonpayable", type: "function" },
];

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
let provider;
let signer;
let contract;
let contractWithSigner;
let userAddress;

footerAddress.textContent = ethers.isAddress(CONTRACT_ADDRESS) ? CONTRACT_ADDRESS : "Not configured";
if (!window.ethereum) { connectBtn.textContent = "MetaMask required"; connectBtn.disabled = true; }

connectBtn.addEventListener("click", connectWallet);
async function connectWallet() {
  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    if (chainId !== "0xaa36a7") { showStatus("error", "⚠", "Switch MetaMask to the Sepolia testnet."); return; }
    if (!ethers.isAddress(CONTRACT_ADDRESS)) { showStatus("error", "⚙", "Set a valid deployed contract address in app.js."); return; }
    if (await provider.getCode(CONTRACT_ADDRESS) === "0x") { showStatus("error", "⚙", "No contract was found at this address on Sepolia."); return; }
    signer = await provider.getSigner();
    userAddress = await signer.getAddress();
    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
    contractWithSigner = contract.connect(signer);
    connectBtn.classList.add("hidden");
    walletInfo.classList.remove("hidden");
    walletAddress.textContent = truncateAddress(userAddress);
    await loadCandidates();
  } catch (error) {
    showStatus("error", "✕", error.code === 4001 ? "Connection was cancelled." : `Could not connect: ${error.message}`);
  }
}

async function loadCandidates() {
  connectPrompt.classList.add("hidden");
  candidatesGrid.classList.add("hidden");
  loadingState.classList.remove("hidden");
  try {
    const candidates = await contract.getCandidates();
    const alreadyVoted = await contract.checkIfVoted(userAddress);
    const totalVotes = candidates.reduce((total, candidate) => total + Number(candidate.voteCount), 0);
    loadingState.classList.add("hidden");
    candidatesGrid.classList.remove("hidden");
    renderCandidates(candidates, totalVotes, alreadyVoted);
    hideStatus();
  } catch (error) {
    loadingState.classList.add("hidden");
    const isWrongContract = error.code === "BAD_DATA" && error.info?.method === "getCandidates";
    showStatus("error", "⚙", isWrongContract ? "This address is not the current Voting contract." : `Could not load candidates: ${error.message}`);
  }
}

function renderCandidates(candidates, totalVotes, alreadyVoted) {
  if (!candidates.length) { candidatesGrid.innerHTML = "<p>No candidates found in this ballot.</p>"; return; }
  candidatesGrid.innerHTML = candidates.map((candidate, index) => {
    const count = Number(candidate.voteCount);
    const percent = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
    return `<article class="candidate-card ${alreadyVoted ? "voted-card" : ""}"><span class="card-index">CANDIDATE ${String(index + 1).padStart(2, "0")}</span><h3 class="candidate-name">${escapeHtml(candidate.name)}</h3><div class="vote-count-row"><strong class="vote-number">${count}</strong><span class="vote-label">votes · ${percent}%</span></div><div class="vote-bar-track"><div class="vote-bar-fill" style="width:${percent}%"></div></div><button class="btn-vote" data-index="${index}" ${alreadyVoted ? "disabled" : ""}>${alreadyVoted ? "Vote submitted" : "Vote for candidate"}</button></article>`;
  }).join("");
  candidatesGrid.querySelectorAll(".btn-vote:not(:disabled)").forEach((button) => button.addEventListener("click", () => castVote(Number(button.dataset.index))));
}

async function castVote(candidateIndex) {
  try {
    setVoteButtonsDisabled(true);
    showStatus("pending", "…", "Confirm your vote in MetaMask.");
    const transaction = await contractWithSigner.vote(candidateIndex);
    showStatus("pending", "…", `Vote pending (${truncateAddress(transaction.hash)}).`);
    await transaction.wait();
    showStatus("success", "✓", "Vote submitted successfully.");
    await loadCandidates();
  } catch (error) {
    setVoteButtonsDisabled(false);
    showStatus("error", "✕", error.code === 4001 ? "Vote was cancelled." : `Vote failed: ${error.reason || error.message}`);
  }
}

function showStatus(type, icon, message) { statusBar.className = `status-bar ${type}`; statusIcon.textContent = icon; statusMsg.textContent = message; }
function hideStatus() { statusBar.classList.add("hidden"); }
function setVoteButtonsDisabled(disabled) { document.querySelectorAll(".btn-vote").forEach((button) => { button.disabled = disabled; }); }
function truncateAddress(address) { return `${address.slice(0, 6)}...${address.slice(-4)}`; }
function escapeHtml(value) { const element = document.createElement("div"); element.textContent = value; return element.innerHTML; }
if (window.ethereum) { window.ethereum.on("accountsChanged", () => window.location.reload()); window.ethereum.on("chainChanged", () => window.location.reload()); }
