const { Category } = require('../../models/Category')

// Create a new Category
const createCategory = async (req, res, next) => {
  try {
    const { name, description, subjects } = req.body;
    const category = new Category({ name, description, subjects });
    await category.save();
    res.status(201).json({ status: 'success', data: category });
  } catch (err) {
    next(err);
  }
};

// Get all Categories
const getAllCategories = async (req, res, next) => {
  try {
    const categories = await Category.find();
    res.json({ status: 'success', data: categories });
  } catch (err) {
    next(err);
  }
};

// Get a single Category by ID
const getCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ status: 'fail', message: 'Not found' });
    res.json({ status: 'success', data: category });
  } catch (err) {
    next(err);
  }
};

// Update a Category by ID
const updateCategory = async (req, res, next) => {
  try {
    const updates = (({ name, description, subjects }) => ({ name, description, subjects }))(req.body);
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!category) return res.status(404).json({ status: 'fail', message: 'Not found' });
    res.json({ status: 'success', data: category });
  } catch (err) {
    next(err);
  }
};

// Delete a Category by ID
const deleteCategory = async (req, res, next) => {
    try {
      const category = await Category.findByIdAndDelete(req.params.id);
      if (!category) {
        return res
          .status(404)
          .json({ status: 'fail', message: 'Category not found' });
      }
      res
        .status(200)
        .json({ status: 'success', message: 'Category deleted successfully' });
    } catch (err) {
      next(err);
    }
  };
  


module.exports= {createCategory, getCategory, getAllCategories, updateCategory, deleteCategory}
