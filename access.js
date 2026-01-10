import { createAppKit } from '@reown/appkit'
import { Ethers5Adapter } from '@reown/appkit-adapter-ethers5'
import { arbitrum, base } from '@reown/appkit/networks'
import { ethers } from 'ethers'

/**
 * G12 — AppKit integration (Ethers v5 adapter)
 * - Works with AppKit web components (<appkit-button />)
 * - Keeps your existing Ethers v5 contract code with minimal changes
 */

// ============================================
// CONFIG
// ============================================
const CONFIG = {
  // Reown Dashboard projectId (public)
  projectId: '5f9c4ad6a6cadf402f5815fa8f07308c',

  // Supabase API for vault data
  supabaseApi: 'https://ucrvaqztvfnphhoqcbpo.supabase.co/functions/v1/FIRECRAWL_DATA',

  vaults: {
    arbitrum: {
      key: 'arbitrum',
      name: 'G12 DeFi Yield',
      network: 'Arbitrum',
      chainId: 42161,
      rpc: 'https://arb1.arbitrum.io/rpc',
      vaultProxy: '0xc9e50e08739a4aec211f2e8e95f1ab45b923cc20',
      comptrollerProxy: '0xAc7e68A0c3Ecae1b8D889ca030863eCab63B587A',
      usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      explorer: 'https://arbiscan.io'
    },
    base: {
      key: 'base',
      name: 'G12 Stable Yield',
      network: 'Base',
      chainId: 8453,
      rpc: 'https://mainnet.base.org',
      vaultProxy: '0xbfa811e1f065c9b66b02d8ae408d4d9b9be70a22',
      comptrollerProxy: '0xEcd52026399297F65db08B65F2fF466DdF5a20eE',
      usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      explorer: 'https://basescan.org'
    }
  }
}

// ============================================
// ABIs
// ============================================
const VAULT_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)'
]

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)'
]

const COMPTROLLER_ABI = [
  'function buyShares(uint256 investmentAmount, uint256 minSharesQuantity) returns (uint256)',
  'function redeemSharesForSpecificAssets(address recipient, uint256 sharesQuantity, address[] payoutAssets, uint256[] payoutAssetPercentages) returns (uint256[])'
]

// ============================================
// APPKIT INIT (must run early)
// ============================================
const metadata = {
  name: 'G12 Labs',
  description: 'DeFi Investment Platform',
  // Origin must match your domain & subdomain (docs). Using origin avoids hardcoding.
  url: window.location.origin,
  icons: [`${window.location.origin}/fulllogo_transparent_nobuffer.png`]
}

export const modal = createAppKit({
  adapters: [new Ethers5Adapter()],
  networks: [arbitrum, base],
  projectId: CONFIG.projectId,
  metadata,
  features: {
    analytics: true,
    email: true,
    socials: ['google', 'apple', 'discord'],
    onramp: true,
    swaps: true
  },
  themeMode: 'dark'
})

// Make it accessible to inline handlers if needed
window.appKitModal = modal

// ============================================
// GLOBAL STATE
// ============================================
window.G12 = {
  userAddress: null,
  currentVault: 'arbitrum',
  pendingDeposit: null,

  balances: {
    arbitrum: { shares: 0, usdc: 0 },
    base: { shares: 0, usdc: 0 }
  },

  vaultData: {
    arbitrum: { sharePrice: 1, monthlyReturn: 0, aum: 0 },
    base: { sharePrice: 1, monthlyReturn: 0, aum: 0 }
  }
}

// ============================================
// VIEW SWITCHING
// ============================================
function showLoginView() {
  document.getElementById('loginView').style.display = 'flex'
  document.getElementById('dashboardView').style.display = 'none'
  document.getElementById('headerWallet').classList.add('hidden')
}

function showDashboardView() {
  document.getElementById('loginView').style.display = 'none'
  document.getElementById('dashboardView').style.display = 'block'
  document.getElementById('headerWallet').classList.remove('hidden')
}

// ============================================
// DATA LOADING
// ============================================
async function loadVaultData(networkKey) {
  try {
    const res = await fetch(`${CONFIG.supabaseApi}?action=get&network=${networkKey}`, { cache: 'no-store' })
    const data = await res.json()

    if (data && typeof data.share_price !== 'undefined') {
      window.G12.vaultData[networkKey] = {
        sharePrice: Number(data.share_price || 1),
        monthlyReturn: Number(data.monthly_return || 0),
        aum: Number(data.aum || 0)
      }
    }
  } catch (e) {
    console.error(`Error loading ${networkKey} vault data:`, e)
  }
}

async function loadUserBalances() {
  const address = window.G12.userAddress
  if (!address) return

  for (const [key, cfg] of Object.entries(CONFIG.vaults)) {
    try {
      const rpcProvider = new ethers.providers.JsonRpcProvider(cfg.rpc)
      const vault = new ethers.Contract(cfg.vaultProxy, VAULT_ABI, rpcProvider)
      const usdc = new ethers.Contract(cfg.usdc, ERC20_ABI, rpcProvider)

      const [shares, usdcBal] = await Promise.all([
        vault.balanceOf(address),
        usdc.balanceOf(address)
      ])

      window.G12.balances[key] = {
        shares: parseFloat(ethers.utils.formatUnits(shares, 18)),
        usdc: parseFloat(ethers.utils.formatUnits(usdcBal, 6))
      }
    } catch (e) {
      console.error(`Error loading ${key} balances:`, e)
    }
  }

  updateUI()
}

// ============================================
// UI UPDATE
// ============================================
function fmtUsd(n) {
  return `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function updateUI() {
  const addr = window.G12.userAddress || '0x...'
  const short = addr && addr.startsWith('0x') ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr
  const walletEl = document.getElementById('walletDisplay')
  if (walletEl) walletEl.textContent = short

  // Vault data
  const arb = window.G12.balances.arbitrum
  const baseBal = window.G12.balances.base
  const arbData = window.G12.vaultData.arbitrum
  const baseData = window.G12.vaultData.base

  const arbValue = (arb.shares || 0) * (arbData.sharePrice || 1)
  const baseValue = (baseBal.shares || 0) * (baseData.sharePrice || 1)
  const totalValue = arbValue + baseValue

  // Top stats
  const totalValueEl = document.getElementById('totalValue')
  if (totalValueEl) totalValueEl.textContent = fmtUsd(totalValue)

  // (placeholder PnL - will be real once you track cost basis)
  const totalPnlEl = document.getElementById('totalPnl')
  if (totalPnlEl) totalPnlEl.textContent = fmtUsd(0)

  // USDC balance (sum across chains is *not* real; keep as display per vault if you want later)
  const usdcBalanceEl = document.getElementById('usdcBalance')
  if (usdcBalanceEl) usdcBalanceEl.textContent = (arb.usdc || 0).toFixed(2)

  // Per vault cards
  document.getElementById('arbShares').textContent = (arb.shares || 0).toFixed(4)
  document.getElementById('arbValue').textContent = fmtUsd(arbValue)
  document.getElementById('arbSharePrice').textContent = `$${(arbData.sharePrice || 1).toFixed(4)}`
  document.getElementById('arbMonthly').textContent = `${(arbData.monthlyReturn || 0).toFixed(2)}%`

  document.getElementById('baseShares').textContent = (baseBal.shares || 0).toFixed(4)
  document.getElementById('baseValue').textContent = fmtUsd(baseValue)
  document.getElementById('baseSharePrice').textContent = `$${(baseData.sharePrice || 1).toFixed(4)}`
  document.getElementById('baseMonthly').textContent = `${(baseData.monthlyReturn || 0).toFixed(2)}%`
}

// ============================================
// MODALS (wired to existing inline onclick)
// ============================================
window.openDepositModal = function (networkKey) {
  window.G12.currentVault = networkKey
  const cfg = CONFIG.vaults[networkKey]

  document.getElementById('depositVaultName').textContent = cfg.name
  document.getElementById('depositVaultNetwork').textContent = cfg.network
  document.getElementById('depositAmount').value = ''
  document.getElementById('depositMessage').className = 'message'

  document.getElementById('depositModal').classList.add('active')
}

window.openRedeemModal = function (networkKey) {
  window.G12.currentVault = networkKey
  const cfg = CONFIG.vaults[networkKey]

  document.getElementById('redeemVaultName').textContent = cfg.name
  document.getElementById('redeemAmount').value = ''
  document.getElementById('redeemMessage').className = 'message'

  document.getElementById('redeemModal').classList.add('active')
}

window.closeModal = function (modalId) {
  document.getElementById(modalId).classList.remove('active')
}

window.setMaxDeposit = function () {
  const key = window.G12.currentVault
  const usdc = window.G12.balances[key]?.usdc || 0
  document.getElementById('depositAmount').value = usdc.toFixed(2)
}

window.setMaxRedeem = function () {
  const key = window.G12.currentVault
  const shares = window.G12.balances[key]?.shares || 0
  document.getElementById('redeemAmount').value = shares.toFixed(6)
}

// ============================================
// HELPERS
// ============================================
function showMessage(elementId, message, type = 'info') {
  const el = document.getElementById(elementId)
  el.textContent = message
  el.className = `message show ${type}`
}

function setButtonLoading(btnId, loading, text = '') {
  const btn = document.getElementById(btnId)
  if (!btn) return
  if (loading) {
    btn.disabled = true
    btn.innerHTML = `<span class="loader"></span> ${text}`
  } else {
    btn.disabled = false
    if (btnId === 'depositBtn') {
      btn.innerHTML = '<i class="ph ph-arrow-down"></i> Deposit'
    } else {
      btn.innerHTML = '<i class="ph ph-clock"></i> Request Withdrawal'
    }
  }
}

// ============================================
// DEPOSIT EXECUTION
// ============================================
window.executeDeposit = async function () {
  const networkKey = window.G12.currentVault
  const cfg = CONFIG.vaults[networkKey]
  const amountStr = document.getElementById('depositAmount').value

  if (!amountStr || parseFloat(amountStr) <= 0) {
    showMessage('depositMessage', 'Please enter a valid amount', 'error')
    return
  }

  const amount = parseFloat(amountStr)
  if (amount > (window.G12.balances[networkKey]?.usdc || 0)) {
    showMessage('depositMessage', 'Insufficient USDC balance', 'error')
    return
  }

  setButtonLoading('depositBtn', true, 'Preparing...')

  try {
    const walletProvider = modal.getWalletProvider?.()
    if (!walletProvider) throw new Error('Wallet not connected')

    const provider = new ethers.providers.Web3Provider(walletProvider)
    const signer = provider.getSigner()

    const usdc = new ethers.Contract(cfg.usdc, ERC20_ABI, signer)
    const comptroller = new ethers.Contract(cfg.comptrollerProxy, COMPTROLLER_ABI, signer)

    const depositAmount = ethers.utils.parseUnits(amountStr, 6)

    // Ensure right network
    const net = await provider.getNetwork()
    if (net.chainId !== cfg.chainId) {
      // AppKit has switchNetwork utility; if unavailable, throw with guidance.
      if (modal.switchNetwork) {
        await modal.switchNetwork(cfg.chainId)
      } else {
        throw new Error(`Wrong network. Please switch to ${cfg.network}.`)
      }
    }

    // Allowance
    setButtonLoading('depositBtn', true, 'Checking allowance...')
    const allowance = await usdc.allowance(window.G12.userAddress, cfg.comptrollerProxy)

    if (allowance.lt(depositAmount)) {
      setButtonLoading('depositBtn', true, 'Approving USDC...')
      showMessage('depositMessage', 'Please approve USDC spending in your wallet...', 'info')
      const approveTx = await usdc.approve(cfg.comptrollerProxy, ethers.constants.MaxUint256)
      await approveTx.wait()
    }

    // Buy shares
    setButtonLoading('depositBtn', true, 'Depositing...')
    showMessage('depositMessage', 'Please confirm the deposit in your wallet...', 'info')

    const minShares = depositAmount.mul(975).div(1000) // 2.5% slippage
    const tx = await comptroller.buyShares(depositAmount, minShares)
    setButtonLoading('depositBtn', true, 'Confirming...')
    await tx.wait()

    showMessage('depositMessage', '✅ Deposit successful!', 'success')
    document.getElementById('depositAmount').value = ''

    await loadUserBalances()
    setTimeout(() => window.closeModal('depositModal'), 1200)
  } catch (e) {
    console.error('Deposit error:', e)
    showMessage('depositMessage', e?.reason || e?.message || 'Transaction failed', 'error')
  }

  setButtonLoading('depositBtn', false)
}

// ============================================
// REDEEM EXECUTION (timelock not implemented here yet)
// ============================================
window.executeRedeem = async function () {
  const networkKey = window.G12.currentVault
  const cfg = CONFIG.vaults[networkKey]
  const amountStr = document.getElementById('redeemAmount').value

  if (!amountStr || parseFloat(amountStr) <= 0) {
    showMessage('redeemMessage', 'Please enter a valid amount', 'error')
    return
  }

  const amount = parseFloat(amountStr)
  if (amount > (window.G12.balances[networkKey]?.shares || 0)) {
    showMessage('redeemMessage', 'Insufficient shares balance', 'error')
    return
  }

  setButtonLoading('redeemBtn', true, 'Preparing...')

  try {
    const walletProvider = modal.getWalletProvider?.()
    if (!walletProvider) throw new Error('Wallet not connected')

    const provider = new ethers.providers.Web3Provider(walletProvider)
    const signer = provider.getSigner()

    const net = await provider.getNetwork()
    if (net.chainId !== cfg.chainId) {
      if (modal.switchNetwork) {
        await modal.switchNetwork(cfg.chainId)
      } else {
        throw new Error(`Wrong network. Please switch to ${cfg.network}.`)
      }
    }

    const comptroller = new ethers.Contract(cfg.comptrollerProxy, COMPTROLLER_ABI, signer)
    const sharesAmount = ethers.utils.parseUnits(amountStr, 18)

    setButtonLoading('redeemBtn', true, 'Redeeming...')
    showMessage('redeemMessage', 'Please confirm the redemption in your wallet...', 'info')

    const tx = await comptroller.redeemSharesForSpecificAssets(
      window.G12.userAddress,
      sharesAmount,
      [cfg.usdc],
      [10000] // 100%
    )

    setButtonLoading('redeemBtn', true, 'Confirming...')
    await tx.wait()

    showMessage('redeemMessage', '✅ Redemption successful!', 'success')
    document.getElementById('redeemAmount').value = ''

    await loadUserBalances()
    setTimeout(() => window.closeModal('redeemModal'), 1200)
  } catch (e) {
    console.error('Redeem error:', e)
    showMessage('redeemMessage', e?.reason || e?.message || 'Transaction failed', 'error')
  }

  setButtonLoading('redeemBtn', false)
}

// ============================================
// DEEP LINKING
// ============================================
function handleDeepLink() {
  const params = new URLSearchParams(window.location.search)
  const vault = params.get('vault')

  if (vault === 'defi' || vault === 'arbitrum') {
    window.G12.pendingDeposit = 'arbitrum'
  } else if (vault === 'stable' || vault === 'base') {
    window.G12.pendingDeposit = 'base'
  }
}

// ============================================
// ACCOUNT SUBSCRIPTION
// ============================================
modal.subscribeAccount(async (account) => {
  console.log('Account changed:', account)

  if (account?.isConnected && account?.address) {
    window.G12.userAddress = account.address
    showDashboardView()

    await Promise.all([
      loadVaultData('arbitrum'),
      loadVaultData('base')
    ])
    await loadUserBalances()

    if (window.G12.pendingDeposit) {
      setTimeout(() => {
        window.openDepositModal(window.G12.pendingDeposit)
        window.G12.pendingDeposit = null
      }, 300)
    }
  } else {
    window.G12.userAddress = null
    showLoginView()
  }
})

// ============================================
// INIT
// ============================================
handleDeepLink()

// Preload public vault stats (so you can show APY/share price even before login if you want)
loadVaultData('arbitrum')
loadVaultData('base')

// Initial state (if already connected)
const initialConnected = modal.getIsConnected?.() || Boolean(modal.getAddress?.())
if (initialConnected) {
  const initialAddress = modal.getAddress?.()
  if (initialAddress) {
    window.G12.userAddress = initialAddress
  }
  showDashboardView()
  loadUserBalances()
} else {
  showLoginView()
}

console.log('🚀 G12 Access initialized (Vite + AppKit)')
