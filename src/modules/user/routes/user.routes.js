const express = require('express');
const UserController = require('../controller/user.controller');
const { validate } = require('../../../shared/middleware/validation');
const { authenticate, authorize } = require('../../../shared/middleware/auth');
const { asyncHandler } = require('../../../shared/middleware/errorHandler');
const {
  getUsersSchema,
  getUserByIdSchema,
  updateUserSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
  deleteUserSchema,
  getUserStatsSchema,
} = require('../validator/user.validator');
const { SYSTEM } = require('../../../shared/constants');

const router = express.Router();
const userController = new UserController();

/**
 * @route   GET /api/v1/users/stats
 * @desc    Get user statistics
 * @access  Private (Admin only)
 */
router.get(
  '/stats',
  authenticate,
  authorize(SYSTEM.USER_ROLE.ADMIN),
  validate(getUserStatsSchema, 'query'),
  asyncHandler(userController.getUserStatistics)
);

/**
 * @route   GET /api/v1/users
 * @desc    Get all users with filters
 * @access  Private (Admin only)
 */
router.get(
  '/',
  authenticate,
  authorize(SYSTEM.USER_ROLE.ADMIN),
  validate(getUsersSchema, 'query'),
  asyncHandler(userController.getUsers)
);

/**
 * @route   GET /api/v1/users/:id
 * @desc    Get user by ID
 * @access  Private (Own profile or Admin)
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(userController.getUserById)
);

/**
 * @route   PUT /api/v1/users/:id
 * @desc    Update user details
 * @access  Private (Own profile or Admin)
 */
router.put(
  '/:id',
  authenticate,
  validate(updateUserSchema),
  asyncHandler(userController.updateUser)
);

/**
 * @route   PATCH /api/v1/users/:id/role
 * @desc    Update user role
 * @access  Private (Admin only)
 */
router.patch(
  '/:id/role',
  authenticate,
  authorize(SYSTEM.USER_ROLE.ADMIN),
  validate(updateUserRoleSchema),
  asyncHandler(userController.updateUserRole)
);

/**
 * @route   PATCH /api/v1/users/:id/status
 * @desc    Update user status
 * @access  Private (Admin only)
 */
router.patch(
  '/:id/status',
  authenticate,
  authorize(SYSTEM.USER_ROLE.ADMIN),
  validate(updateUserStatusSchema),
  asyncHandler(userController.updateUserStatus)
);

/**
 * @route   DELETE /api/v1/users/:id
 * @desc    Delete user
 * @access  Private (Admin only)
 */
router.delete(
  '/:id',
  authenticate,
  authorize(SYSTEM.USER_ROLE.ADMIN),
  asyncHandler(userController.deleteUser)
);

module.exports = router;