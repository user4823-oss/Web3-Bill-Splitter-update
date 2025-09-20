// Shardeum Network Configuration
const SHARDEUM_CONFIG = {
  // Shardeum Sphinx (Testnet) Configuration
  sphinx: {
    chainId: 8080,
    name: 'Shardeum Unstablenet',
    rpcUrl: 'https://api-unstable.shardeum.org',
    blockExplorer: 'https://explorer-unstable.shardeum.org',
    currency: {
      name: 'Shardeum',
      symbol: 'SHM',
      decimals: 18
    }
  },
  
  // Add network to MetaMask function
  async addToMetaMask() {
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: `0x${this.sphinx.chainId.toString(16)}`, // 0x1F8A in hex
          chainName: this.sphinx.name,
          nativeCurrency: this.sphinx.currency,
          rpcUrls: [this.sphinx.rpcUrl],
          blockExplorerUrls: [this.sphinx.blockExplorer]
        }]
      });
      console.log('Shardeum network added to MetaMask');
      return true;
    } catch (error) {
      console.error('Failed to add Shardeum network:', error);
      return false;
    }
  },

  // Switch to Shardeum network
  async switchToShardeum() {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${this.sphinx.chainId.toString(16)}` }]
      });
      return true;
    } catch (error) {
      // If network doesn't exist, add it
      if (error.code === 4902) {
        return await this.addToMetaMask();
      }
      console.error('Failed to switch to Shardeum:', error);
      return false;
    }
  },

  // Get network info
  getNetworkInfo() {
    return this.sphinx;
  }
};

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SHARDEUM_CONFIG;
}