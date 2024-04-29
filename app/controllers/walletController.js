const Wallet = require('../models/walletModel.js')
const { sendResponse } = require('../utils/response.js')
const { cleanAndValidateInput } = require('../utils/cleanAndValidateInput.js')
const Transaction = require('../models/transactionModel.js')
const Category = require('../models/categoryModel.js')
const { formatDate } = require('../utils/formatDate.js')

const createWallet = async (req, res) => {
  try {
    const loggedInUserId = req.decoded.user.id
    let { name, emoji, balance, bgWallet } = req.body

    name = cleanAndValidateInput(name)
    emoji = cleanAndValidateInput(emoji)
    balance = cleanAndValidateInput(balance)

    if (!name || !emoji || balance === undefined || !bgWallet) {
      sendResponse(res, false, 'Semua field harus diisi!', 400)
      return
    }

    // Konversi saldo awal menjadi angka
    balance = parseFloat(balance)

    const wallet = new Wallet({ name, emoji, balance, bgWallet, createBy: loggedInUserId })
    await wallet.save()

    // Jika saldo awal tidak nol, buat transaksi
    if (balance !== 0) {
      // Temukan kategori "Pemasukan Lainnya"
      const incomeCategory = await Category.findOne({ name: 'Pemasukan Lainnya' })

      if (!incomeCategory) {
        sendResponse(res, false, 'Kategori "Pemasukan Lainnya" tidak ditemukan', 404)
        return
      }

      // Membuat transaksi dengan kategori "Pemasukan Lainnya" untuk saldo awal
      const initialTransaction = new Transaction({
        walletId: wallet._id,
        date: formatDate(new Date(), 'yyyy-MM-dd'),
        amount: balance,
        type: incomeCategory.type,
        category: incomeCategory._id,
        description: 'Saldo Awal',
        createdBy: loggedInUserId,
      })
      await initialTransaction.save()
    }

    sendResponse(res, true, 'Yeay! dompet berhasil dibuat!', 200, wallet)
  } catch (error) {
    console.log(error)
    sendResponse(res, false, 'Gagal membuat dompet', 500)
  }
}

const getWallets = async (req, res) => {
  try {
    const loggedInUserId = req.decoded.user.id
    const wallet = await Wallet.find({ createBy: loggedInUserId })
    wallet.sort((a, b) => b.createdAt - a.createdAt)
    sendResponse(res, true, 'Berhasil get list wallet', 200, wallet)
  } catch (error) {
    sendResponse(res, false, 'Gagal get list wallet', 500)
  }
}

const getDetailWallet = async (req, res) => {
  try {
    const { id } = req.params
    const loggedInUserId = req.decoded.user.id

    if (!id) {
      sendResponse(res, false, 'Wallet id harus diisi', 400)
      return
    }

    const wallet = await Wallet.findOne({ _id: id, createBy: loggedInUserId })

    if (!wallet) {
      sendResponse(res, false, 'Wallet tidak ditemukan', 404)
      return
    }

    sendResponse(res, true, 'Get detail wallet success', 200, wallet)
  } catch (error) {
    sendResponse(res, false, 'Failed to get detail wallet', 500)
  }
}

const getTransactionByWallet = async (req, res) => {
  try {
    const { id } = req.params
    const loggedInUserId = req.decoded.user.id

    if (!id) {
      sendResponse(res, false, 'Wallet id is required', 400)
      return
    }

    const transactions = await Transaction.find({ walletId: id, createdBy: loggedInUserId })

    if (!transactions) {
      sendResponse(res, false, 'Transaction not found', 404)
      return
    }

    sendResponse(res, true, 'Get transaction by wallet success', 200, transactions)
  } catch (error) {
    sendResponse(res, false, 'Failed to get transaction by wallet', 500)
  }
}

const updateWallet = async (req, res) => {
  try {
    const { id } = req.params
    const loggedInUserId = req.decoded.user.id
    let { name, emoji, balance, bgWallet } = req.body

    name = cleanAndValidateInput(name)
    emoji = cleanAndValidateInput(emoji)
    balance = parseFloat(cleanAndValidateInput(balance)) // Ubah ke tipe data float

    if (!name || !emoji || !balance || !bgWallet) {
      sendResponse(res, false, 'Semua field harus diisi!', 400)
      return
    }

    const wallet = await Wallet.findById(id)

    if (!wallet) {
      sendResponse(res, false, 'Dompet tidak ditemukan', 404)
      return
    }

    if (wallet.createBy.toString() !== loggedInUserId.toString()) {
      sendResponse(res, false, 'Unauthorized', 401)
      return
    }

    // Perhitungan perubahan saldo
    const balanceDiff = balance - wallet.balance

    wallet.name = name
    wallet.emoji = emoji
    wallet.balance = balance
    wallet.bgWallet = bgWallet
    await wallet.save()

    // Temukan kategori "Pemasukan Lainnya"
    const pemasukanLainnyaCategory = await Category.findOne({
      name: 'Pemasukan Lainnya',
      createdBy: loggedInUserId,
    })

    if (!pemasukanLainnyaCategory) {
      sendResponse(res, false, 'Kategori "Pemasukan Lainnya" tidak ditemukan', 404)
      return
    }

    // Temukan kategori "Pengeluaran Lainnya"
    const pengeluaranLainnyaCategory = await Category.findOne({
      name: 'Pengeluaran Lainnya',
      createdBy: loggedInUserId,
    })

    if (!pengeluaranLainnyaCategory) {
      sendResponse(res, false, 'Kategori "Pengeluaran Lainnya" tidak ditemukan', 404)
      return
    }

    // Membuat transaksi baru jika ada perubahan saldo yang terjadi
    if (balanceDiff !== 0) {
      let category = null
      let description = null
      let amount = Math.abs(balanceDiff)

      if (balanceDiff > 0) {
        category = pemasukanLainnyaCategory._id
        description = 'Tambah Saldo'
        type = pemasukanLainnyaCategory.type
      } else {
        category = pengeluaranLainnyaCategory._id
        description = 'Kurangi Saldo'
        type = pengeluaranLainnyaCategory.type
      }

      const newTransaction = new Transaction({
        type,
        amount,
        category,
        description,
        date: formatDate(new Date(), 'yyyy-MM-dd'),
        walletId: wallet._id,
        createdBy: loggedInUserId,
      })

      await newTransaction.save()
    }

    sendResponse(res, true, 'Dompet berhasil diperbarui', 200, wallet)
  } catch (error) {
    console.log(error)
    sendResponse(res, false, 'Gagal memperbarui dompet', 500)
  }
}

const deleteWallet = async (req, res) => {
  try {
    const { id } = req.params
    const loggedInUserId = req.decoded.user.id

    await Wallet.deleteOne({ _id: id, createBy: loggedInUserId })
    await Transaction.deleteMany({ walletId: id, createdBy: loggedInUserId })

    sendResponse(res, true, 'Wallet berhasil dihapus!', 200, {})
  } catch (error) {
    console.log(error)
    sendResponse(res, false, 'Failed to delete wallet', 500)
  }
}

module.exports = {
  createWallet,
  getWallets,
  getTransactionByWallet,
  updateWallet,
  deleteWallet,
  getDetailWallet,
}
