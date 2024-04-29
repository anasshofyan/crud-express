const Transaction = require('../models/transactionModel')
const Category = require('../models/categoryModel')
const { sendResponse } = require('../utils/response.js')
const { cleanAndValidateInput } = require('../utils/cleanAndValidateInput.js')
const Wallet = require('../models/walletModel.js')

const create = async (req, res) => {
  const loggedInUserId = req.decoded.user.id
  let { amount, description, categoryId, date, walletId } = req.body

  amount = cleanAndValidateInput(amount)
  description = cleanAndValidateInput(description)

  try {
    if (!amount || !description || !categoryId || !date || !walletId) {
      return sendResponse(res, false, 'Semua isian harus diisi, nih!', 400)
    }

    const category = await Category.findById(categoryId)
    const wallet = await Wallet.findById(walletId)

    if (!category) {
      return sendResponse(res, false, 'Kategori gak ditemukan, nih!', 400, {})
    }

    if (!wallet) {
      return sendResponse(res, false, 'Dompet gak ditemukan, nih!', 400, {})
    }

    const type = category.type

    const newTransaction = new Transaction({
      amount,
      description,
      category: categoryId,
      date,
      type,
      createdBy: loggedInUserId,
      walletId,
    })

    const savedTransaction = await newTransaction.save()

    await updateWalletBalance(walletId)

    sendResponse(res, true, 'Transaksi berhasil dibuat, nih!', 201, savedTransaction)
  } catch (err) {
    if (err.name === 'ValidationError') {
      sendResponse(res, false, 'Validasi gagal, nih!', 400, err.errors)
    } else {
      sendResponse(res, false, 'Gagal membuat transaksi, nih!', 500)
    }
  }
}

const getTransactionByWallet = async (req, res) => {
  try {
    const loggedInUserId = req.decoded.user.id
    const { startDate, endDate, walletId } = req.query

    const filter = {
      createdBy: loggedInUserId,
    }

    if (walletId) {
      filter.walletId = walletId
    }

    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)

      filter.date = { $gte: start, $lte: end }
    }

    const transactions = await Transaction.find(filter).populate([
      {
        path: 'category',
        model: 'Category',
      },
      {
        path: 'walletId',
        model: 'Wallet',
      },
    ])

    let totalIncome = 0
    let totalExpense = 0

    transactions.forEach((transaction) => {
      if (transaction.walletId && transaction.walletId.excludeFromTotal) return
      if (transaction.type === 'income') {
        totalIncome += transaction.amount
      } else if (transaction.type === 'expense') {
        totalExpense += transaction.amount
      }
    })

    const remainingBalance = totalIncome - totalExpense

    let groupedTransactions = {}

    transactions.forEach((transaction) => {
      const transactionDate = transaction.date
      if (!groupedTransactions[transactionDate]) {
        groupedTransactions[transactionDate] = []
      }
      groupedTransactions[transactionDate].push({
        ...transaction.toObject(),
        date: transaction.date,
      })
      groupedTransactions[transactionDate].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      )
    })

    const responseData = Object.entries(groupedTransactions)
      .sort(([dateA], [dateB]) => new Date(dateB) - new Date(dateA))
      .map(([date, transactions]) => ({
        date,
        transactions,
      }))

    sendResponse(res, true, 'Get list transaction success', 200, {
      listGroup: responseData,
      totalIncome,
      totalExpense,
      remainingBalance,
    })
  } catch (err) {
    console.log('err', err)
    sendResponse(res, false, 'Failed to get list transaction', 500)
  }
}

const getDetail = async (req, res) => {
  const { id } = req.params
  const loggedInUserId = req.decoded.user.id

  try {
    const transaction = await Transaction.findOne({ _id: id, createdBy: loggedInUserId })

    if (!transaction) {
      return sendResponse(
        res,
        false,
        'Transaction not found or you do not have permission to access',
        404,
      )
    }

    sendResponse(res, true, 'Get transaction detail success', 200, transaction)
  } catch (err) {
    sendResponse(res, false, 'Failed to get transaction detail', 500)
  }
}

const update = async (req, res) => {
  const loggedInUserId = req.decoded.user.id
  const { id } = req.params
  let { amount, description, categoryId, date, walletId } = req.body

  amount = cleanAndValidateInput(amount)
  description = cleanAndValidateInput(description)

  try {
    if (!amount || !description || !categoryId || !date || !walletId) {
      return sendResponse(res, false, 'All fields must be filled', 400)
    }

    const category = await Category.findById(categoryId)

    if (!category) {
      return sendResponse(res, false, 'Category not found', 400)
    }

    const transaction = await Transaction.findOne({ _id: id, createdBy: loggedInUserId })

    if (!transaction) {
      return sendResponse(
        res,
        false,
        'Transaction not found or you do not have permission to access',
        404,
      )
    }

    transaction.amount = amount
    transaction.description = description
    transaction.category = categoryId
    transaction.date = date

    const updatedTransaction = await transaction.save()

    await updateWalletBalance(transaction.walletId)

    sendResponse(
      res,
      true,
      `${updatedTransaction.description} telah diupdate!`,
      200,
      updatedTransaction,
    )
  } catch (err) {
    if (err.name === 'ValidationError') {
      sendResponse(res, false, 'Validation failed', 400, err.errors)
    } else {
      sendResponse(res, false, 'Failed to update transaction', 500)
    }
  }
}

const deleteTransaction = async (req, res) => {
  const transactionId = req.params.id

  try {
    const transaction = await Transaction.findById(transactionId)

    if (!transaction) {
      return sendResponse(res, false, 'Transaksi tidak ditemukan', 404)
    }

    await Transaction.findByIdAndDelete(transactionId)

    await updateWalletBalance(transaction.walletId)

    sendResponse(res, true, `${transaction.description} telah dihapus!`, 200)
  } catch (err) {
    console.log('err', err)
    sendResponse(res, false, 'Gagal menghapus transaksi', 500)
  }
}

const updateWalletBalance = async (walletId) => {
  try {
    const transactions = await Transaction.find({ walletId }).populate({
      path: 'category',
      model: 'Category',
    })

    let totalIncome = 0
    let totalExpense = 0

    transactions.forEach((transaction) => {
      if (transaction.type === 'income') {
        totalIncome += transaction.amount
      } else if (transaction.type === 'expense') {
        totalExpense += transaction.amount
      }
    })

    const remainingBalance = totalIncome - totalExpense
    await Wallet.findByIdAndUpdate(walletId, { balance: remainingBalance })
  } catch (err) {
    throw new Error('Gagal memperbarui saldo dompet')
  }
}

module.exports = {
  create,
  getTransactionByWallet,
  getDetail,
  update,
  deleteTransaction,
}
