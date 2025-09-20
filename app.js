// Web3 Bill Splitter App
class BillSplitterApp {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.userAddress = null;
        this.bills = [];
        this.currentBill = null;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.checkWalletConnection();
    }

    setupEventListeners() {
        // Wallet connection
        document.getElementById('connect-wallet').addEventListener('click', () => this.connectWallet());
        document.getElementById('disconnect-wallet').addEventListener('click', () => this.disconnectWallet());
        
        // Navigation
        document.getElementById('create-bill-btn').addEventListener('click', () => this.showCreateBill());
        document.getElementById('back-to-dashboard').addEventListener('click', () => this.showDashboard());
        document.getElementById('cancel-create').addEventListener('click', () => this.showDashboard());
        document.getElementById('back-from-detail').addEventListener('click', () => this.showDashboard());
        
        // Form handling
        document.getElementById('create-bill-form').addEventListener('submit', (e) => this.handleCreateBill(e));
        document.getElementById('add-participant').addEventListener('click', () => this.addParticipant());
        
        // Split method change
        document.querySelectorAll('input[name="split-method"]').forEach(radio => {
            radio.addEventListener('change', () => this.updateSplitMethod());
        });
        
        // Bill deletion
        document.getElementById('delete-bill').addEventListener('click', () => this.deleteBill());
    }

    async checkWalletConnection() {
        if (typeof window.ethereum !== 'undefined') {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    await this.connectWallet();
                }
            } catch (error) {
                console.error('Error checking wallet connection:', error);
            }
        }
    }

    async connectWallet() {
        try {
            if (typeof window.ethereum === 'undefined') {
                this.showToast('MetaMask is not installed. Please install MetaMask to use this app.', 'error');
                return;
            }

            // Check if we're on Shardeum network
            const currentNetwork = await window.ethereum.request({ method: 'eth_chainId' });
            const shardeumChainId = `0x${SHARDEUM_CONFIG.sphinx.chainId.toString(16)}`;
            
            if (currentNetwork !== shardeumChainId) {
                this.showToast('Switching to Shardeum network...', 'warning');
                const switched = await SHARDEUM_CONFIG.switchToShardeum();
                if (!switched) {
                    this.showToast('Failed to switch to Shardeum network', 'error');
                    return;
                }
            }

            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            
            this.provider = new ethers.BrowserProvider(window.ethereum);
            this.signer = await this.provider.getSigner();
            this.userAddress = accounts[0];

            // Get balance
            const balance = await this.provider.getBalance(this.userAddress);
            const balanceInEth = ethers.formatEther(balance);

            // Update UI
            document.getElementById('connect-wallet').style.display = 'none';
            document.getElementById('wallet-info').style.display = 'flex';
            document.getElementById('wallet-address').textContent = this.formatAddress(this.userAddress);
            document.getElementById('wallet-balance').textContent = `${parseFloat(balanceInEth).toFixed(4)} SHM`;

            // Show dashboard and load bills
            this.showDashboard();
            await this.loadUserBills();

            this.showToast('Wallet connected to Shardeum!', 'success');

            // Listen for network changes
            window.ethereum.on('chainChanged', (chainId) => {
                if (chainId !== shardeumChainId) {
                    this.showToast('Please switch back to Shardeum network', 'warning');
                }
            });

            // Listen for account changes
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) {
                    this.disconnectWallet();
                } else {
                    this.userAddress = accounts[0];
                    this.connectWallet();
                }
            });

        } catch (error) {
            console.error('Error connecting wallet:', error);
            this.showToast('Failed to connect wallet. Please try again.', 'error');
        }
    }

    disconnectWallet() {
        this.provider = null;
        this.signer = null;
        this.userAddress = null;
        this.bills = [];

        // Update UI
        document.getElementById('connect-wallet').style.display = 'block';
        document.getElementById('wallet-info').style.display = 'none';
        
        this.showWelcome();
        this.showToast('Wallet disconnected', 'warning');
    }

    formatAddress(address) {
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }

    showWelcome() {
        this.hideAllSections();
        document.getElementById('welcome-section').style.display = 'block';
    }

    showDashboard() {
        this.hideAllSections();
        document.getElementById('dashboard-section').style.display = 'block';
        this.updateDashboardStats();
    }

    showCreateBill() {
        this.hideAllSections();
        document.getElementById('create-bill-section').style.display = 'block';
        this.resetCreateBillForm();
    }

    showBillDetail(bill) {
        this.currentBill = bill;
        this.hideAllSections();
        document.getElementById('bill-detail-section').style.display = 'block';
        this.renderBillDetail(bill);
    }

    hideAllSections() {
        document.querySelectorAll('.section').forEach(section => {
            section.style.display = 'none';
        });
    }

    async loadUserBills() {
        try {
            const response = await fetch(`/api/bills/${this.userAddress}`);
            if (response.ok) {
                this.bills = await response.json();
                this.renderBills();
                this.updateDashboardStats();
            }
        } catch (error) {
            console.error('Error loading bills:', error);
            this.showToast('Failed to load bills', 'error');
        }
    }

    updateDashboardStats() {
        const totalBills = this.bills.length;
        let pendingPayments = 0;
        let totalOwed = 0;

        this.bills.forEach(bill => {
            const userParticipant = bill.participants.find(p => 
                p.address.toLowerCase() === this.userAddress.toLowerCase()
            );
            
            if (userParticipant && !userParticipant.paid) {
                pendingPayments++;
                totalOwed += userParticipant.share;
            }
        });

        document.getElementById('total-bills').textContent = totalBills;
        document.getElementById('pending-payments').textContent = pendingPayments;
        document.getElementById('total-owed').textContent = `${totalOwed.toFixed(4)} ETH`;
    }

    renderBills() {
        const container = document.getElementById('bills-container');
        const noBills = document.getElementById('no-bills');
        
        if (this.bills.length === 0) {
            noBills.style.display = 'block';
            return;
        }
        
        noBills.style.display = 'none';
        
        // Clear existing bills except the no-bills div
        const existingBills = container.querySelectorAll('.bill-card');
        existingBills.forEach(bill => bill.remove());

        this.bills.forEach(bill => {
            const billElement = this.createBillCard(bill);
            container.appendChild(billElement);
        });
    }

    createBillCard(bill) {
        const card = document.createElement('div');
        card.className = 'bill-card';
        card.addEventListener('click', () => this.showBillDetail(bill));

        const userParticipant = bill.participants.find(p => 
            p.address.toLowerCase() === this.userAddress.toLowerCase()
        );
        
        const isCreator = bill.creator.toLowerCase() === this.userAddress.toLowerCase();
        const userShare = userParticipant ? userParticipant.share : 0;
        const isPaid = userParticipant ? userParticipant.paid : false;

        card.innerHTML = `
            <div class="bill-header">
                <div>
                    <div class="bill-title">${bill.title}</div>
                    <div class="bill-meta">
                        <span>Created: ${new Date(bill.createdAt).toLocaleDateString()}</span>
                        <span>${bill.participants.length} participants</span>
                        ${isCreator ? '<span>👑 Your bill</span>' : ''}
                    </div>
                </div>
                <div class="bill-amount">${bill.totalAmount.toFixed(4)} ETH</div>
            </div>
            
            ${bill.description ? `<p style="color: var(--secondary); margin-bottom: 15px;">${bill.description}</p>` : ''}
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <span class="bill-status status-${bill.status}">${bill.status}</span>
                ${userParticipant ? `<span style="font-weight: 600;">Your share: ${userShare.toFixed(4)} ETH</span>` : ''}
            </div>
            
            <div class="bill-participants">
                ${bill.participants.map(participant => `
                    <span class="participant-tag ${participant.paid ? 'paid' : 'pending'}">
                        ${participant.name || this.formatAddress(participant.address)}
                        ${participant.paid ? '✓' : '⏳'}
                    </span>
                `).join('')}
            </div>
        `;

        return card;
    }

    resetCreateBillForm() {
        document.getElementById('create-bill-form').reset();
        const container = document.getElementById('participants-container');
        container.innerHTML = `
            <div class="participant-item">
                <input type="text" placeholder="Wallet Address (0x...)" class="participant-address" required>
                <input type="text" placeholder="Name (optional)" class="participant-name">
                <input type="number" placeholder="Amount" class="participant-amount" step="0.001" style="display: none;">
                <button type="button" class="remove-participant" style="display: none;">×</button>
            </div>
        `;
        this.updateSplitMethod();
    }

    addParticipant() {
        const container = document.getElementById('participants-container');
        const participantItem = document.createElement('div');
        participantItem.className = 'participant-item';
        
        const splitMethod = document.querySelector('input[name="split-method"]:checked').value;
        
        participantItem.innerHTML = `
            <input type="text" placeholder="Wallet Address (0x...)" class="participant-address" required>
            <input type="text" placeholder="Name (optional)" class="participant-name">
            <input type="number" placeholder="Amount" class="participant-amount" step="0.001" ${splitMethod === 'equal' ? 'style="display: none;"' : ''}>
            <button type="button" class="remove-participant">×</button>
        `;
        
        // Add remove functionality
        participantItem.querySelector('.remove-participant').addEventListener('click', () => {
            participantItem.remove();
            this.updateEqualSplit();
        });
        
        // Add input listener for equal split updates
        participantItem.querySelector('.participant-address').addEventListener('input', () => {
            this.updateEqualSplit();
        });
        
        container.appendChild(participantItem);
        this.updateEqualSplit();
    }

    updateSplitMethod() {
        const splitMethod = document.querySelector('input[name="split-method"]:checked').value;
        const amountInputs = document.querySelectorAll('.participant-amount');
        const removeButtons = document.querySelectorAll('.remove-participant');
        
        amountInputs.forEach((input, index) => {
            if (splitMethod === 'equal') {
                input.style.display = 'none';
                input.required = false;
            } else {
                input.style.display = 'block';
                input.required = true;
            }
        });

        // Show remove buttons for all except first participant
        removeButtons.forEach((button, index) => {
            button.style.display = index === 0 ? 'none' : 'block';
        });
        
        if (splitMethod === 'equal') {
            this.updateEqualSplit();
        }
    }

    updateEqualSplit() {
        const totalAmount = parseFloat(document.getElementById('total-amount').value) || 0;
        const participants = document.querySelectorAll('.participant-item');
        const validParticipants = Array.from(participants).filter(p => 
            p.querySelector('.participant-address').value.trim() !== ''
        );
        
        if (totalAmount > 0 && validParticipants.length > 0) {
            const sharePerPerson = totalAmount / (validParticipants.length + 1); // +1 for the creator
            
            validParticipants.forEach(participant => {
                const amountInput = participant.querySelector('.participant-amount');
                amountInput.value = sharePerPerson.toFixed(6);
            });
        }
    }

    async handleCreateBill(e) {
        e.preventDefault();
        
        const title = document.getElementById('bill-title').value.trim();
        const description = document.getElementById('bill-description').value.trim();
        const totalAmount = parseFloat(document.getElementById('total-amount').value);
        const splitMethod = document.querySelector('input[name="split-method"]:checked').value;
        
        // Collect participants
        const participantElements = document.querySelectorAll('.participant-item');
        const participants = [];
        
        for (let element of participantElements) {
            const address = element.querySelector('.participant-address').value.trim();
            const name = element.querySelector('.participant-name').value.trim();
            const amount = parseFloat(element.querySelector('.participant-amount').value) || 0;
            
            if (address) {
                if (!ethers.isAddress(address)) {
                    this.showToast(`Invalid Ethereum address: ${address}`, 'error');
                    return;
                }
                
                participants.push({
                    address,
                    name: name || address,
                    share: splitMethod === 'equal' ? (totalAmount / (participants.length + 2)) : amount
                });
            }
        }
        
        if (participants.length === 0) {
            this.showToast('Please add at least one participant', 'error');
            return;
        }
        
        // Validate custom amounts
        if (splitMethod === 'custom') {
            const totalCustom = participants.reduce((sum, p) => sum + p.share, 0);
            if (Math.abs(totalCustom - totalAmount) > 0.001) {
                this.showToast('Custom amounts must add up to the total amount', 'error');
                return;
            }
        } else {
            // Recalculate equal split including creator
            const equalShare = totalAmount / (participants.length + 1);
            participants.forEach(p => p.share = equalShare);
        }
        
        this.showLoading(true);
        
        try {
            const response = await fetch('/api/bills', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title,
                    description,
                    totalAmount,
                    creator: this.userAddress,
                    participants
                })
            });
            
            if (response.ok) {
                const newBill = await response.json();
                this.bills.unshift(newBill);
                this.showToast('Bill created successfully!', 'success');
                this.showDashboard();
            } else {
                const error = await response.json();
                this.showToast(error.error || 'Failed to create bill', 'error');
            }
        } catch (error) {
            console.error('Error creating bill:', error);
            this.showToast('Failed to create bill. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    renderBillDetail(bill) {
        const container = document.getElementById('bill-detail-content');
        const isCreator = bill.creator.toLowerCase() === this.userAddress.toLowerCase();
        const userParticipant = bill.participants.find(p => 
            p.address.toLowerCase() === this.userAddress.toLowerCase()
        );
        
        // Show delete button only for creator
        const deleteBtn = document.getElementById('delete-bill');
        deleteBtn.style.display = isCreator ? 'block' : 'none';
        
        container.innerHTML = `
            <div class="bill-detail-info">
                <div class="bill-detail-title">${bill.title}</div>
                <div class="bill-detail-amount">${bill.totalAmount.toFixed(4)} ETH</div>
                ${bill.description ? `<p style="color: var(--secondary); margin-bottom: 15px;">${bill.description}</p>` : ''}
                <div class="bill-detail-meta">
                    <p>Created by: ${isCreator ? 'You' : this.formatAddress(bill.creator)} on ${new Date(bill.createdAt).toLocaleDateString()}</p>
                    <p>Status: <span class="bill-status status-${bill.status}">${bill.status}</span></p>
                </div>
            </div>
            
            <div class="participants-list">
                <h3>Participants (${bill.participants.length + 1})</h3>
                
                <!-- Creator (if not in participants) -->
                ${!userParticipant && isCreator ? `
                <div class="participant-detail">
                    <div class="participant-info">
                        <h4>You (Creator) 👑</h4>
                        <p>${this.formatAddress(bill.creator)}</p>
                    </div>
                    <div class="participant-amount">
                        <div class="amount">Paid in full</div>
                        <div class="status" style="color: var(--success);">✓ Complete</div>
                    </div>
                </div>
                ` : ''}
                
                ${bill.participants.map(participant => {
                    const isCurrentUser = participant.address.toLowerCase() === this.userAddress.toLowerCase();
                    return `
                        <div class="participant-detail">
                            <div class="participant-info">
                                <h4>${isCurrentUser ? 'You' : (participant.name || 'Anonymous')} ${isCurrentUser && isCreator ? '👑' : ''}</h4>
                                <p>${this.formatAddress(participant.address)}</p>
                            </div>
                            <div class="participant-amount">
                                <div class="amount">${participant.share.toFixed(4)} ETH</div>
                                <div class="status ${participant.paid ? 'paid' : 'pending'}">
                                    ${participant.paid ? '✓ Paid' : '⏳ Pending'}
                                </div>
                                ${participant.paid && participant.txHash ? `
                                    <div style="margin-top: 5px;">
                                        <a href="https://etherscan.io/tx/${participant.txHash}" target="_blank" 
                                           style="color: var(--primary); font-size: 0.8rem;">View Transaction</a>
                                    </div>
                                ` : ''}
                                ${isCurrentUser && !participant.paid ? `
                                    <div class="payment-actions">
                                        <button class="btn btn-primary btn-small" onclick="app.payBill('${bill.id}', '${participant.address}', ${participant.share})">
                                            Pay Now
                                        </button>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    async payBill(billId, participantAddress, amount) {
        try {
            this.showLoading(true);
            
            // Get the bill to find the creator address
            const bill = this.bills.find(b => b.id === billId);
            if (!bill) {
                throw new Error('Bill not found');
            }
            
            // Send payment to the bill creator
            const tx = await this.signer.sendTransaction({
                to: bill.creator,
                value: ethers.parseEther(amount.toString())
            });
            
            this.showToast('Transaction sent! Waiting for confirmation...', 'success');
            
            // Wait for transaction confirmation
            const receipt = await tx.wait();
            
            // Update payment status on backend
            const response = await fetch(`/api/bills/${billId}/payment`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    participantAddress,
                    txHash: receipt.hash
                })
            });
            
            if (response.ok) {
                const updatedBill = await response.json();
                
                // Update local bill data
                const billIndex = this.bills.findIndex(b => b.id === billId);
                if (billIndex !== -1) {
                    this.bills[billIndex] = updatedBill;
                }
                
                this.showToast('Payment successful!', 'success');
                this.renderBillDetail(updatedBill);
                this.updateDashboardStats();
            } else {
                throw new Error('Failed to update payment status');
            }
            
        } catch (error) {
            console.error('Payment error:', error);
            
            if (error.code === 'ACTION_REJECTED') {
                this.showToast('Transaction cancelled by user', 'warning');
            } else if (error.code === 'INSUFFICIENT_FUNDS') {
                this.showToast('Insufficient funds for transaction', 'error');
            } else {
                this.showToast(`Payment failed: ${error.message}`, 'error');
            }
        } finally {
            this.showLoading(false);
        }
    }

    async deleteBill() {
        if (!this.currentBill) return;
        
        if (!confirm('Are you sure you want to delete this bill? This action cannot be undone.')) {
            return;
        }
        
        try {
            this.showLoading(true);
            
            const response = await fetch(`/api/bills/${this.currentBill.id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    walletAddress: this.userAddress
                })
            });
            
            if (response.ok) {
                // Remove from local bills array
                this.bills = this.bills.filter(b => b.id !== this.currentBill.id);
                
                this.showToast('Bill deleted successfully', 'success');
                this.showDashboard();
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete bill');
            }
        } catch (error) {
            console.error('Delete error:', error);
            this.showToast(error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'flex' : 'none';
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.remove();
        }, 5000);
        
        // Add click to dismiss
        toast.addEventListener('click', () => {
            toast.remove();
        });
    }
}

// Initialize app
const app = new BillSplitterApp();

// Add event listeners for total amount changes to update equal split
document.getElementById('total-amount').addEventListener('input', () => {
    const splitMethod = document.querySelector('input[name="split-method"]:checked').value;
    if (splitMethod === 'equal') {
        app.updateEqualSplit();
    }
});