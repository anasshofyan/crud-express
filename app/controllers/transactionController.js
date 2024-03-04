const Transaction = require('../models/transactionModel')
const Category = require('../models/categoryModel')
const { sendResponse } = require('../utils/response.js')
const { formatDate } = require('../utils/formatDate.js')

const create = async (req, res) => {
  const { amount, description, categoryId, date } = req.body

  const loggedInUserId = req.decoded.user.id

  try {
    const category = await Category.findById(categoryId)

    if (!category) {
      return sendResponse(res, false, 'Category Not Found', 400, {})
    }

    const type = category.type

    const newTransaction = new Transaction({
      amount,
      description,
      category: categoryId,
      date,
      type,
      createdBy: loggedInUserId,
    })

    const savedTransaction = await newTransaction.save()

    sendResponse(res, true, 'Transaction created successfully', 201, savedTransaction)
  } catch (err) {
    if (err.name === 'ValidationError') {
      sendResponse(res, false, 'Validation failed', 400, err.errors)
    } else {
      sendResponse(res, false, 'Failed to create transaction', 500)
    }
  }
}

const getList = async (req, res) => {
  try {
    const loggedInUserId = req.decoded.user.id
    const { startDate, endDate } = req.query

    const dateFilter = {
      createdBy: loggedInUserId,
    }

    if (startDate && endDate) {
      // Konversi string startDate dan endDate menjadi objek Date
      const start = new Date(startDate)
      const end = new Date(endDate)

      // Perhatikan bahwa kita menggunakan $gte (greater than or equal) dan $lte (less than or equal)
      dateFilter.date = { $gte: start, $lte: end }
    }

    const transactions = await Transaction.find(dateFilter).populate({
      path: 'category',
      model: 'Category',
    })

    // Hitung total pendapatan, total pengeluaran, dan sisa saldo
    let totalIncome = 0
    let totalExpense = 0

    transactions.forEach((transaction) => {
      // Hitung total pendapatan dan pengeluaran
      if (transaction.type === 'income') {
        totalIncome += transaction.amount
      } else if (transaction.type === 'expense') {
        totalExpense += transaction.amount
      }
    })

    // Hitung sisa saldo
    const remainingBalance = totalIncome - totalExpense

    // Objek untuk menyimpan transaksi yang dikelompokkan berdasarkan tanggal
    let groupedTransactions = {}

    transactions.forEach((transaction) => {
      // Menggunakan tanggal transaksi sebagai kunci untuk mengelompokkan transaksi
      const transactionDate = formatDate(transaction.date)
      if (!groupedTransactions[transactionDate]) {
        groupedTransactions[transactionDate] = []
      }
      groupedTransactions[transactionDate].push({
        ...transaction.toObject(),
        date: formatDate(transaction.date), // Format ulang tanggal di dalam setiap transaksi
      })
      // Setelah menambahkan transaksi baru, sort array berdasarkan tanggal transaksi yang terbaru
      groupedTransactions[transactionDate].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      )
    })

    // Konversi objek groupedTransactions menjadi array dengan tambahan field date
    const responseData = Object.entries(groupedTransactions)
      .sort(([dateA], [dateB]) => new Date(dateB) - new Date(dateA)) // Sorting descending berdasarkan tanggal
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
    sendResponse(res, false, 'Failed to get list transaction', 500)
  }
}

const getDetail = async (req, res) => {
  const { id } = req.params
  const loggedInUserId = req.decoded.user.id

  try {
    const transaction = await Transaction.findOne({ _id: id, createdBy: loggedInUserId })

    console.log('transaction', transaction)
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
  const { id } = req.params
  const loggedInUserId = req.decoded.user.id

  const { amount, description, categoryId, date } = req.body

  if (!amount || !description || !categoryId || !date) {
    return sendResponse(res, false, 'All fields are required', 400)
  }

  try {
    let transaction = await Transaction.findById(id).populate('category')

    if (!transaction) {
      return sendResponse(res, false, 'Transaction not found', 404)
    }

    if (transaction.createdBy.toString() !== loggedInUserId.toString()) {
      return sendResponse(res, false, 'Unauthorized', 401)
    }

    const category = await Category.findById(categoryId)

    if (!category) {
      return sendResponse(res, false, 'Category Not Found', 400, {})
    }

    transaction.amount = amount
    transaction.description = description
    transaction.categoryId = categoryId
    transaction.date = date
    transaction.type = category.type // Set tipe transaksi sesuai dengan tipe kategori
    transaction.category = category // Tambahkan informasi kategori ke objek transaksi

    transaction = await transaction.save() // Simpan perubahan dan dapatkan kembali transaksi dengan perubahan

    sendResponse(res, true, 'Update transaction success', 200, transaction)
  } catch (err) {
    if (err.name === 'ValidationError') {
      return sendResponse(res, false, 'Validation failed', 400, err.errors)
    }
    sendResponse(res, false, 'Failed to update transaction', 500)
  }
}

const deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params
    const transaction = await Transaction.findByIdAndDelete(id)
    sendResponse(res, true, 'Delete transaction success', 200, transaction)
  } catch (err) {
    sendResponse(res, false, 'Failed to delete transaction', 500)
  }
}

const formatDate1 = (date, format) => {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date)
}

// Fungsi untuk menghitung sisa saldo berdasarkan total pendapatan dan total pengeluaran
const calculateRemainingBalance = (totalIncome, totalExpense) => {
  return totalIncome - totalExpense
}

const getVisualizationData = async (req, res) => {
  try {
    const loggedInUserId = req.decoded.user.id
    const { startDate, endDate } = req.query

    const dateFilter = {
      createdBy: loggedInUserId,
    }

    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      dateFilter.date = { $gte: start, $lte: end }
    }

    const transactions = await Transaction.find(dateFilter).populate({
      path: 'category',
      model: 'Category',
    })

    let groupedData = {}
    transactions.forEach((transaction) => {
      const transactionMonthYear = formatDate1(transaction.date, 'MMMM YYYY')
      if (!groupedData[transactionMonthYear]) {
        groupedData[transactionMonthYear] = {
          totalIncome: 0,
          totalExpense: 0,
        }
      }
      if (transaction.type === 'income') {
        groupedData[transactionMonthYear].totalIncome += transaction.amount
      } else if (transaction.type === 'expense') {
        groupedData[transactionMonthYear].totalExpense += transaction.amount
      }
    })

    const chartData = Object.entries(groupedData)
      .map(([date, data]) => {
        const formattedDate = formatDate(new Date(date))
        return {
          date: formattedDate,
          totalIncome: data.totalIncome,
          totalExpense: data.totalExpense,
          remainingBalance: calculateRemainingBalance(data.totalIncome, data.totalExpense),
        }
      })
      .sort((a, b) => {
        const dateA = new Date(a.date)
        const dateB = new Date(b.date)
        return dateB - dateA
      })

    const totalIncome = chartData.reduce((acc, curr) => acc + curr.totalIncome, 0)
    const totalExpense = chartData.reduce((acc, curr) => acc + curr.totalExpense, 0)
    const remainingBalance = calculateRemainingBalance(totalIncome, totalExpense)

    sendResponse(res, true, 'Get visualization data success', 200, {
      chartData,
      totalIncome,
      totalExpense,
      remainingBalance,
    })
  } catch (err) {
    sendResponse(res, false, 'Failed to get visualization data', 500)
  }
}

const getPieChartData = async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query
    const loggedInUserId = req.decoded.user.id

    const dateFilter = {
      createdBy: loggedInUserId,
    }

    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      dateFilter.date = { $gte: start, $lte: end }
    }

    if (type && type !== 'all') {
      dateFilter.type = type
    }

    const transactions = await Transaction.find(dateFilter).populate({
      path: 'category',
      model: 'Category',
    })

    // Calculate total income, total expense, and remaining balance
    const totalIncome = transactions
      .filter((transaction) => transaction.type === 'income')
      .reduce((acc, transaction) => acc + transaction.amount, 0)

    const totalExpense = transactions
      .filter((transaction) => transaction.type === 'expense')
      .reduce((acc, transaction) => acc + transaction.amount, 0)

    const remainingBalance = totalIncome - totalExpense

    // Group transactions by category and sum the amounts
    const categoryTotals = transactions.reduce((acc, transaction) => {
      const category = transaction.category.name
      const amount = transaction.amount
      const type = transaction.type
      const monthYear = new Date(transaction.date).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
      })
      acc[category] = {
        total: ((acc[category] && acc[category].total) || 0) + amount,
        type,
        monthYear,
        emoji: transaction.category.emoji,
      }
      return acc
    }, {})

    // Convert categoryTotals object to array of objects
    const pieChartData = Object.keys(categoryTotals).map((category) => ({
      category,
      total: categoryTotals[category].total,
      type: categoryTotals[category].type,
      monthYear: categoryTotals[category].monthYear,
      emoji: categoryTotals[category].emoji,
    }))

    // Sort pieChartData by total in descending order
    pieChartData.sort((a, b) => b.total - a.total)

    sendResponse(res, true, 'Successfully retrieved pie chart data', 200, {
      listGroup: pieChartData,
      totalIncome,
      totalExpense,
      remainingBalance,
    })
  } catch (err) {
    sendResponse(res, false, 'Failed to get visualization data', 500)
  }
}

module.exports = {
  create,
  getList,
  getDetail,
  update,
  deleteTransaction,
  getVisualizationData,
  getPieChartData,
}
