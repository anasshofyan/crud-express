const Category = require('../models/categoryModel')
const { sendResponse } = require('../utils/response.js')
const jwt = require('jsonwebtoken')

const create = async (req, res) => {
  const { icon, name, type, subCategories } = req.body

  const loggedInUserId = req.decoded.user.id

  try {
    const newCategory = new Category({
      icon,
      name,
      type,
      subCategories,
      createdBy: loggedInUserId,
    })

    const savedCategory = await newCategory.save()

    sendResponse(res, true, 'Category created successfully', 201, savedCategory)
  } catch (err) {
    if (err.name === 'ValidationError') {
      sendResponse(res, false, 'Validation failed', 400, err.errors)
    } else {
      sendResponse(res, false, 'Failed to create category', 500)
    }
  }
}

const getList = async (req, res) => {
  try {
    const loggedInUserId = req.decoded.user.id

    const categories = await Category.find({ createdBy: loggedInUserId }).populate({
      path: 'subCategories',
      model: 'Subcategory',
    })

    sendResponse(res, true, 'Get list category success', 200, categories)
  } catch (err) {
    sendResponse(res, false, 'Failed to get list category', 500)
  }
}

const getDetail = async (req, res) => {
  const { id } = req.params
  const loggedInUserId = req.decoded.user.id

  try {
    const category = await Category.findOne({ _id: id, createdBy: loggedInUserId })

    if (!category) {
      return sendResponse(
        res,
        false,
        'Category not found or you do not have permission to access',
        404
      )
    }

    sendResponse(res, true, 'Get category detail success', 200, category)
  } catch (err) {
    sendResponse(res, false, 'Failed to get category detail', 500)
  }
}

const update = async (req, res) => {
  const { id } = req.params
  const { icon, name, type, subCategories } = req.body

  try {
    const loggedInUserId = req.decoded.user.id
    const category = await Category.findOneAndUpdate(
      { _id: id, subCategories: subCategories, createdBy: loggedInUserId },
      { icon, name, type },
      { new: true }
    )

    if (!category) {
      return sendResponse(
        res,
        false,
        'Category not found or you do not have permission to update',
        404
      )
    }

    sendResponse(res, true, 'Category updated successfully', 200, category)
  } catch (err) {
    if (err.name === 'ValidationError') {
      sendResponse(res, false, 'Validation failed', 400, err.errors)
    } else {
      sendResponse(res, false, 'Failed to update category', 500)
    }
  }
}

const deleteCategory = async (req, res) => {
  const { id } = req.params
  const loggedInUserId = req.decoded.user.id

  try {
    await Category.findByIdAndDelete({ _id: id, createdBy: loggedInUserId })
    sendResponse(res, true, 'Category deleted successfully', 200)
  } catch (err) {
    sendResponse(res, false, 'Failed to delete category', 500)
  }
}

module.exports = {
  create,
  getList,
  update,
  deleteCategory,
  getDetail,
}
