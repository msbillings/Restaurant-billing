/**
 * UI Test Scenarios Runner
 * This file contains test scenarios that can be executed manually
 * or integrated with testing frameworks like Cypress
 */

// Test Scenarios Configuration
export const TEST_SCENARIOS = {
  // Scenario 1: Single Item Order
  singleItemOrder: {
    name: "Single Item Order",
    steps: [
      { action: "selectTable", value: "TBL-01" },
      { action: "addItem", itemName: "Tea", quantity: 1 },
      { action: "saveOrder" },
      { action: "generateBill", discount: 0, tax: 5 },
      { action: "processPayment", mode: "Cash" }
    ]
  },

  // Scenario 2: Medium Order with Discount
  mediumOrderWithDiscount: {
    name: "Medium Order with Discount",
    steps: [
      { action: "selectTable", value: "TBL-05" },
      { action: "addItem", itemName: "Veg Manchurian", quantity: 2 },
      { action: "addItem", itemName: "Paneer Butter Masala", quantity: 1 },
      { action: "addItem", itemName: "Butter Naan", quantity: 2 },
      { action: "addItem", itemName: "Extra Cheese", quantity: 1 },
      { action: "saveOrder" },
      { action: "generateBill", discount: 10, tax: 12 },
      { action: "processPayment", mode: "UPI" }
    ]
  },

  // Scenario 3: Large Order with High Tax
  largeOrderHighTax: {
    name: "Large Order with High Tax",
    steps: [
      { action: "selectTable", value: "TBL-10" },
      { action: "addItem", itemName: "Chicken 65", quantity: 2 },
      { action: "addItem", itemName: "Chicken Curry", quantity: 1 },
      { action: "addItem", itemName: "Mutton Curry", quantity: 1 },
      { action: "addItem", itemName: "Chicken Biryani", quantity: 2 },
      { action: "addItem", itemName: "Roti", quantity: 4 },
      { action: "addItem", itemName: "Garlic Naan", quantity: 2 },
      { action: "addItem", itemName: "Soft Drinks", quantity: 2 },
      { action: "addItem", itemName: "Ice Cream", quantity: 2 },
      { action: "addItem", itemName: "Extra Gravy", quantity: 2 },
      { action: "saveOrder" },
      { action: "generateBill", discount: 5, tax: 18 },
      { action: "processPayment", mode: "Card" }
    ]
  },

  // Scenario 4: High Quantity Single Item
  highQuantityOrder: {
    name: "High Quantity Order",
    steps: [
      { action: "selectTable", value: "TBL-15" },
      { action: "addItem", itemName: "Coffee", quantity: 15 },
      { action: "saveOrder" },
      { action: "generateBill", discount: 0, tax: 5 },
      { action: "processPayment", mode: "Cash" }
    ]
  },

  // Scenario 5: Maximum Discount
  maximumDiscount: {
    name: "Maximum Discount Order",
    steps: [
      { action: "selectTable", value: "TBL-20" },
      { action: "addItem", itemName: "Veg Thali", quantity: 5 },
      { action: "addItem", itemName: "Non-Veg Thali", quantity: 3 },
      { action: "saveOrder" },
      { action: "generateBill", discount: 50, tax: 12 },
      { action: "processPayment", mode: "UPI" }
    ]
  },

  // Scenario 6: Zero Tax Order
  zeroTaxOrder: {
    name: "Zero Tax Order",
    steps: [
      { action: "selectTable", value: "TBL-03" },
      { action: "addItem", itemName: "Tomato Soup", quantity: 2 },
      { action: "addItem", itemName: "Plain Rice", quantity: 2 },
      { action: "saveOrder" },
      { action: "generateBill", discount: 0, tax: 0 },
      { action: "processPayment", mode: "Cash" }
    ]
  },

  // Scenario 7: Order with Multiple Add-ons
  orderWithAddons: {
    name: "Order with Multiple Add-ons",
    steps: [
      { action: "selectTable", value: "TBL-07" },
      { action: "addItem", itemName: "Pizza", quantity: 2 },
      { action: "addItem", itemName: "Extra Cheese", quantity: 3 },
      { action: "addItem", itemName: "Extra Butter", quantity: 2 },
      { action: "addItem", itemName: "Extra Gravy", quantity: 1 },
      { action: "saveOrder" },
      { action: "generateBill", discount: 5, tax: 12 },
      { action: "processPayment", mode: "Card" }
    ]
  },

  // Scenario 8: Mixed Veg and Non-Veg
  mixedOrder: {
    name: "Mixed Veg and Non-Veg Order",
    steps: [
      { action: "selectTable", value: "TBL-12" },
      { action: "addItem", itemName: "Veg Manchurian", quantity: 1 },
      { action: "addItem", itemName: "Chicken 65", quantity: 1 },
      { action: "addItem", itemName: "Dal Tadka", quantity: 1 },
      { action: "addItem", itemName: "Chicken Curry", quantity: 1 },
      { action: "saveOrder" },
      { action: "generateBill", discount: 8, tax: 12 },
      { action: "processPayment", mode: "UPI" }
    ]
  }
};

// Edge Case Scenarios
export const EDGE_CASE_SCENARIOS = {
  emptyCart: {
    name: "Empty Cart Prevention",
    steps: [
      { action: "trySaveOrderWithoutItems", expectedError: "Cart is empty" },
      { action: "tryGenerateBillWithoutItems", expectedError: "No items in cart" }
    ]
  },

  noTableSelected: {
    name: "No Table Selected",
    steps: [
      { action: "tryAddItemWithoutTable", expectedError: "Please select a table first" },
      { action: "trySaveOrderWithoutTable", expectedError: "Please select a table first" }
    ]
  },

  lockedOrder: {
    name: "Locked Order Modification",
    steps: [
      { action: "createAndBillOrder" },
      { action: "tryAddItemToBilledOrder", expectedError: "Order is locked" },
      { action: "tryUpdateQuantityInBilledOrder", expectedError: "Order is locked" }
    ]
  },

  longItemName: {
    name: "Very Long Item Name",
    steps: [
      { action: "createItemWithLongName", name: "This is an Extremely Long Menu Item Name That Might Break the UI Layout" },
      { action: "addToCart" },
      { action: "verifyLayoutNotBroken" }
    ]
  },

  decimalPrices: {
    name: "Decimal Price Calculations",
    steps: [
      { action: "createItemWithDecimalPrice", price: 99.99 },
      { action: "addMultipleQuantities", quantity: 3 },
      { action: "verifyCalculationsAccurate" }
    ]
  }
};

// Test Data Validator
export function validateOrderData(order) {
  const errors = [];

  // Validate items
  if (!order.items || order.items.length === 0) {
    errors.push("Order must have at least one item");
  }

  // Validate calculations
  const calculatedSubtotal = order.items.reduce((sum, item) => {
    return sum + (item.price * item.quantity);
  }, 0);

  if (Math.abs(order.subtotal - calculatedSubtotal) > 0.01) {
    errors.push(`Subtotal mismatch: Expected ${calculatedSubtotal}, got ${order.subtotal}`);
  }

  // Validate discount
  if (order.discount < 0 || order.discount > order.subtotal) {
    errors.push(`Invalid discount: ${order.discount}`);
  }

  // Validate tax
  if (order.tax < 0 || order.tax > 100) {
    errors.push(`Invalid tax: ${order.tax}%`);
  }

  // Validate total
  const taxableAmount = order.subtotal - order.discount;
  const taxAmount = (taxableAmount * order.tax) / 100;
  const expectedTotal = Math.round(taxableAmount + taxAmount);

  if (Math.abs(order.total - expectedTotal) > 1) {
    errors.push(`Total mismatch: Expected ${expectedTotal}, got ${order.total}`);
  }

  return errors;
}

// UI Element Selectors (for automated testing)
export const SELECTORS = {
  // Billing Page
  tableSelector: 'select[value*="TBL-"]',
  menuGrid: '[data-testid="menu-grid"]',
  cartItem: '[data-testid="cart-item"]',
  subtotal: '[data-testid="subtotal"]',
  discountInput: '[data-testid="discount-input"]',
  taxInput: '[data-testid="tax-input"]',
  total: '[data-testid="total"]',
  saveOrderButton: '[data-testid="save-order"]',
  generateBillButton: '[data-testid="generate-bill"]',
  
  // Payment Modal
  paymentModal: '[data-testid="payment-modal"]',
  paymentModeCash: '[data-testid="payment-cash"]',
  paymentModeUPI: '[data-testid="payment-upi"]',
  paymentModeCard: '[data-testid="payment-card"]',
  
  // Bill History
  billHistoryTable: '[data-testid="bill-history-table"]',
  searchInput: '[data-testid="bill-search"]',
  filterDropdown: '[data-testid="bill-filter"]',
  paginationNext: '[data-testid="pagination-next"]',
  paginationPrev: '[data-testid="pagination-prev"]',
  
  // Menu Management
  addItemButton: '[data-testid="add-item-button"]',
  itemForm: '[data-testid="item-form"]',
  categoryDropdown: '[data-testid="category-dropdown"]',
  priceInput: '[data-testid="price-input"]',
  
  // Toast
  toast: '[data-testid="toast"]',
  toastSuccess: '[data-testid="toast-success"]',
  toastError: '[data-testid="toast-error"]'
};

// Helper Functions for Testing
export const TestHelpers = {
  // Calculate expected totals
  calculateSubtotal: (items) => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  },

  calculateDiscount: (subtotal, discountPercent) => {
    return (subtotal * discountPercent) / 100;
  },

  calculateTax: (taxableAmount, taxPercent) => {
    return (taxableAmount * taxPercent) / 100;
  },

  calculateTotal: (subtotal, discount, taxPercent) => {
    const discountAmount = discount;
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = (taxableAmount * taxPercent) / 100;
    return Math.round(taxableAmount + taxAmount);
  },

  // Format currency
  formatCurrency: (amount) => {
    return `₹${amount.toFixed(2)}`;
  },

  // Generate random order
  generateRandomOrder: (menuItems) => {
    const numItems = Math.floor(Math.random() * 10) + 1;
    const items = [];
    const usedNames = new Set();

    for (let i = 0; i < numItems; i++) {
      let item;
      do {
        item = menuItems[Math.floor(Math.random() * menuItems.length)];
      } while (usedNames.has(item.name) && usedNames.size < menuItems.length);

      if (item) {
        usedNames.add(item.name);
        const quantity = Math.floor(Math.random() * 5) + 1;
        items.push({
          name: item.name,
          price: item.price,
          quantity: quantity,
          total: item.price * quantity
        });
      }
    }

    return items;
  }
};

// Export for use in test files
export default {
  TEST_SCENARIOS,
  EDGE_CASE_SCENARIOS,
  validateOrderData,
  SELECTORS,
  TestHelpers
};

