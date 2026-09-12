const ExcelJS = require('./Backend/node_modules/exceljs');
const fs = require('fs');
const path = require('path');
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']); } catch (e) {}
const mongoose = require('./Backend/node_modules/mongoose');
const bcrypt = require('./Backend/node_modules/bcryptjs');

// Complete transcribed menu items from Thanvi's Café Brews & Bites (New Boyanapalli, Rajampet)
const THANVIS_MENU_ITEMS = [
  // ==========================================
  // 1. Pizza (Medium 9")
  // ==========================================
  {
    name: 'Margherita Pizza (Medium 9")',
    category: 'Pizza (Medium 9")',
    price: 189,
    type: 'Veg',
    description: 'Classic 9-inch medium crust pizza topped with rich herb-infused tomato sauce and gooey melted mozzarella cheese'
  },
  {
    name: 'Cheese Corn Pizza (Medium 9")',
    category: 'Pizza (Medium 9")',
    price: 199,
    type: 'Veg',
    description: 'Golden sweet corn kernels and generous mozzarella cheese over freshly baked 9-inch crust'
  },
  {
    name: 'Paneer Pizza (Medium 9")',
    category: 'Pizza (Medium 9")',
    price: 209,
    type: 'Veg',
    description: 'Tender marinated spiced cottage cheese cubes, crisp bell peppers, and melted cheese on 9-inch base'
  },
  {
    name: 'Chicken Pizza (Medium 9")',
    category: 'Pizza (Medium 9")',
    price: 219,
    type: 'Non-Veg',
    description: 'Succulent spiced chicken chunks, bell peppers, sliced onions, and mozzarella on 9-inch crust'
  },
  {
    name: 'Crispy Chicken Pizza (Medium 9")',
    category: 'Pizza (Medium 9")',
    price: 229,
    type: 'Non-Veg',
    description: 'Crunchy golden fried chicken bites layered over zesty tomato pizza sauce and melted cheese'
  },
  {
    name: 'Special Chicken Pizza (Medium 9")',
    category: 'Pizza (Medium 9")',
    price: 249,
    type: 'Non-Veg',
    description: 'Special loaded chicken feast with seasoned shredded chicken, crispy bites, and double mozzarella cheese'
  },

  // ==========================================
  // 2. Sandwich
  // ==========================================
  {
    name: 'Veg Sandwich',
    category: 'Sandwich',
    price: 99,
    type: 'Veg',
    description: 'Crisp garden fresh vegetables, cucumber, tomatoes, and seasoned mint spread in grilled toasted bread'
  },
  {
    name: 'Paneer Sandwich',
    category: 'Sandwich',
    price: 129,
    type: 'Veg',
    description: 'Grilled cottage cheese slices seasoned with aromatic herbs and melted cheese in toasted sandwich bread'
  },
  {
    name: 'Cheese Corn Sandwich',
    category: 'Sandwich',
    price: 129,
    type: 'Veg',
    description: 'Juicy golden sweet corn sautéed with melted cheese, herbs, and crushed black pepper in toasted bread'
  },
  {
    name: 'Egg Sandwich (Scrambled)',
    category: 'Sandwich',
    price: 129,
    type: 'Non-Veg',
    description: 'Fluffy butter-scrambled eggs seasoned with black pepper and mild herbs tucked in toasted sandwich bread'
  },
  {
    name: 'Chicken Sandwich',
    category: 'Sandwich',
    price: 139,
    type: 'Non-Veg',
    description: 'Tender shredded chicken tossed in creamy seasoned mayonnaise and lettuce inside toasted bread'
  },
  {
    name: 'Chicken Sandwich (Crispy)',
    category: 'Sandwich',
    price: 159,
    type: 'Non-Veg',
    description: 'Golden crispy crumb-fried chicken fillet topped with burger sauce and lettuce in toasted bread'
  },
  {
    name: 'Chicken Sandwich (Jumbo)',
    category: 'Sandwich',
    price: 169,
    type: 'Non-Veg',
    description: 'Multi-layered jumbo toasted sandwich packed with double chicken filling, cheese, and crunchy veggies'
  },

  // ==========================================
  // 3. Crispy Fried Chicken
  // ==========================================
  {
    name: 'Chicken Popcorn',
    category: 'Crispy Fried Chicken',
    price: 150,
    type: 'Non-Veg',
    description: 'Bite-sized crunchy golden fried chicken nuggets tossed with chef special savoury seasoning'
  },
  {
    name: 'Chicken Wings (5 Pcs)',
    category: 'Crispy Fried Chicken',
    price: 150,
    type: 'Non-Veg',
    description: '5 pieces of crispy crumb-coated chicken wings fried golden with crunchy crust and juicy meat'
  },
  {
    name: 'Chicken Lollipops (4 Pcs)',
    category: 'Crispy Fried Chicken',
    price: 200,
    type: 'Non-Veg',
    description: '4 pieces of crispy frenched chicken wingettes seasoned in aromatic spices, fried to golden perfection'
  },
  {
    name: 'Chicken Strips (4 Pcs)',
    category: 'Crispy Fried Chicken',
    price: 160,
    type: 'Non-Veg',
    description: '4 pieces of succulent boneless chicken breast tenders coated in crunchy breadcrumbs'
  },

  // ==========================================
  // 4. Burger
  // ==========================================
  {
    name: 'Veg Burger',
    category: 'Burger',
    price: 100,
    type: 'Veg',
    description: 'Crispy vegetable patty layered with fresh lettuce, sliced tomatoes, onions, and creamy burger mayo'
  },
  {
    name: 'Chicken Burger',
    category: 'Burger',
    price: 120,
    type: 'Non-Veg',
    description: 'Juicy spiced chicken patty topped with fresh lettuce, onions, and tangy sauce in toasted bun'
  },
  {
    name: 'Crispy Chicken Burger',
    category: 'Burger',
    price: 150,
    type: 'Non-Veg',
    description: 'Crunchy golden fried whole chicken fillet crowned with cheese sauce and fresh coleslaw'
  },

  // ==========================================
  // 5. Fries
  // ==========================================
  {
    name: 'French Fries Salted',
    category: 'Fries',
    price: 100,
    type: 'Veg',
    description: 'Classic deep-fried golden potato fingers lightly seasoned with fine sea salt'
  },
  {
    name: 'French Fries Peri Peri',
    category: 'Fries',
    price: 120,
    type: 'Veg',
    description: 'Crunchy French fries tossed in fiery and tangy African peri peri spice seasoning'
  },

  // ==========================================
  // 6. Wraps
  // ==========================================
  {
    name: 'Veg Wrap',
    category: 'Wraps',
    price: 99,
    type: 'Veg',
    description: 'Sautéed farm-fresh vegetables, crunchy cabbage, and spiced sauces rolled in warm tortilla wrap'
  },
  {
    name: 'Paneer Wrap',
    category: 'Wraps',
    price: 119,
    type: 'Veg',
    description: 'Spiced cottage cheese cubes with bell peppers, sliced onions, and mint mayo wrapped in soft flatbread'
  },
  {
    name: 'Chicken Wrap',
    category: 'Wraps',
    price: 129,
    type: 'Non-Veg',
    description: 'Grilled shredded chicken, crisp lettuce, and creamy garlic dressing rolled inside warm tortilla'
  },

  // ==========================================
  // 7. Momos
  // ==========================================
  {
    name: 'Veg Momos',
    category: 'Momos',
    price: 109,
    type: 'Veg',
    description: 'Steamed Himalayan dumplings stuffed with finely minced vegetables, cabbage, and ginger'
  },
  {
    name: 'Corn Momos',
    category: 'Momos',
    price: 129,
    type: 'Veg',
    description: 'Steamed delicate dumplings filled with sweet corn kernels, melted cheese, and mild spices'
  },
  {
    name: 'Paneer Momos',
    category: 'Momos',
    price: 139,
    type: 'Veg',
    description: 'Steamed dumplings loaded with seasoned fresh cottage cheese, herbs, and scallions'
  },
  {
    name: 'Mushroom Momos',
    category: 'Momos',
    price: 149,
    type: 'Veg',
    description: 'Steamed savory dumplings packed with finely chopped button mushrooms, onions, and garlic'
  },
  {
    name: 'Chicken Momos',
    category: 'Momos',
    price: 149,
    type: 'Non-Veg',
    description: 'Classic steamed dumplings stuffed with juicy seasoned minced chicken and spring onions'
  },
  {
    name: 'Chicken Barbeque Momos',
    category: 'Momos',
    price: 149,
    type: 'Non-Veg',
    description: 'Steamed chicken momos generously tossed and glazed in smoky sweet barbeque sauce'
  },
  {
    name: 'Chicken Cheese Momos',
    category: 'Momos',
    price: 159,
    type: 'Non-Veg',
    description: 'Steamed dumplings bursting with tender minced chicken and molten mozzarella cheese'
  },

  // ==========================================
  // 8. Starters
  // ==========================================
  {
    name: 'Sweet Corn',
    category: 'Starters',
    price: 49,
    type: 'Veg',
    description: 'Steamed fresh sweet corn kernels tossed with butter, salt, black pepper, and lemon juice'
  },
  {
    name: 'Bread Omelette',
    category: 'Starters',
    price: 69,
    type: 'Non-Veg',
    description: 'Street-style double-egg spiced omelette folded and toasted with fresh bread slices'
  },
  {
    name: 'Garlic Cheese Bread',
    category: 'Starters',
    price: 79,
    type: 'Veg',
    description: 'Crispy toasted baguette bread infused with garlic herb butter and crowned with melted cheese'
  },
  {
    name: 'Scrambled Egg with Bread',
    category: 'Starters',
    price: 89,
    type: 'Non-Veg',
    description: 'Soft buttery scrambled eggs cooked with green chillies and onions, served with toasted bread'
  },

  // ==========================================
  // 9. Rolls
  // ==========================================
  {
    name: 'Veg Roll',
    category: 'Rolls',
    price: 109,
    type: 'Veg',
    description: 'Crunchy stir-fried vegetables, onions, and tangy chaat masala rolled inside golden paratha'
  },
  {
    name: 'Paneer Roll',
    category: 'Rolls',
    price: 129,
    type: 'Veg',
    description: 'Pan-seared spiced cottage cheese chunks with crunchy capsicum and onions in flaky paratha'
  },
  {
    name: 'Chicken Roll',
    category: 'Rolls',
    price: 139,
    type: 'Non-Veg',
    description: 'Tender chicken pieces cooked in tawa masala rolled with crunchy onions in warm paratha'
  },

  // ==========================================
  // 10. Maggie
  // ==========================================
  {
    name: 'Plain Maggie',
    category: 'Maggie',
    price: 59,
    type: 'Veg',
    description: 'Classic 2-minute instant noodles cooked with the authentic original masala tastemaker'
  },
  {
    name: 'Veg Masala Maggie',
    category: 'Maggie',
    price: 79,
    type: 'Veg',
    description: 'Spicy Maggie noodles cooked with sautéed onions, tomatoes, green peas, and extra seasonings'
  },
  {
    name: 'Corn Maggie',
    category: 'Maggie',
    price: 79,
    type: 'Veg',
    description: 'Steaming hot Maggie noodles enriched with juicy sweet corn kernels and dollop of butter'
  },
  {
    name: 'Egg Maggie',
    category: 'Maggie',
    price: 79,
    type: 'Non-Veg',
    description: 'Hot masala Maggie noodles tossed and scrambled with fresh farm eggs and spices'
  },
  {
    name: 'Chicken Maggie',
    category: 'Maggie',
    price: 89,
    type: 'Non-Veg',
    description: 'Spicy noodles cooked with succulent shredded chicken pieces and savoury herbs'
  },
  {
    name: 'Cheese Maggie',
    category: 'Maggie',
    price: 89,
    type: 'Veg',
    description: 'Hot masala noodles smothered in a thick, velvety layer of melted cheese'
  },
  {
    name: 'Paneer Maggie',
    category: 'Maggie',
    price: 99,
    type: 'Veg',
    description: 'Delicious masala noodles tossed with tender pan-fried cottage cheese cubes and butter'
  },

  // ==========================================
  // 11. Snack Up
  // ==========================================
  {
    name: 'Veg Lollipops',
    category: 'Snack Up',
    price: 99,
    type: 'Veg',
    description: 'Crispy crumb-fried vegetable balls served on skewers with sweet and spicy dipping sauce'
  },
  {
    name: 'Cheese Corn Nuggets',
    category: 'Snack Up',
    price: 119,
    type: 'Veg',
    description: 'Golden crunchy nuggets filled with rich molten cheese and juicy sweet corn'
  },
  {
    name: 'Potato Pops',
    category: 'Snack Up',
    price: 99,
    type: 'Veg',
    description: 'Crisp bite-sized golden potato poppers seasoned with savoury herbs and spices'
  },
  {
    name: 'Onion Rings',
    category: 'Snack Up',
    price: 99,
    type: 'Veg',
    description: 'Fresh sliced onion rings coated in crispy seasoned golden batter, deep fried crisp'
  },
  {
    name: 'Chicken Fingers',
    category: 'Snack Up',
    price: 129,
    type: 'Non-Veg',
    description: 'Crispy elongated crumb-coated chicken breast fillets served with creamy dipping sauce'
  },
  {
    name: 'Chicken Nuggets',
    category: 'Snack Up',
    price: 129,
    type: 'Non-Veg',
    description: 'Golden fried bite-sized tender chicken nuggets served with tangy tomato dip'
  }
];

async function generateMenuFilesAndSeedDb() {
  console.log('========================================================');
  console.log("   THANVI'S CAFÉ BREWS & BITES - MENU CREATION SCRIPT   ");
  console.log('========================================================');
  console.log(`Total Menu Items Transcribed: ${THANVIS_MENU_ITEMS.length}`);

  // 1. Generate Excel (.xlsx)
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MS Billings";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Thanvi's Cafe Menu", {
    views: [{ showGridLines: true }]
  });

  worksheet.columns = [
    { header: 'Name', key: 'name', width: 34 },
    { header: 'Category', key: 'category', width: 26 },
    { header: 'Price', key: 'price', width: 14 },
    { header: 'Type', key: 'type', width: 14 },
    { header: 'Description', key: 'description', width: 68 },
    { header: 'Is Available', key: 'isAvailable', width: 16 },
    { header: 'Tax Rate', key: 'taxRate', width: 12 },
    { header: 'Image URL', key: 'image', width: 25 }
  ];

  THANVIS_MENU_ITEMS.forEach(item => {
    worksheet.addRow({
      name: item.name,
      category: item.category,
      price: item.price,
      type: item.type,
      description: item.description,
      isAvailable: 'TRUE',
      taxRate: 5,
      image: ''
    });
  });

  // Style Header Row (Brand Orange with white bold text)
  const headerRow = worksheet.getRow(1);
  headerRow.height = 32;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EA580C' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'medium', color: { argb: 'C2410C' } },
      bottom: { style: 'medium', color: { argb: 'C2410C' } },
      left: { style: 'thin', color: { argb: 'F97316' } },
      right: { style: 'thin', color: { argb: 'F97316' } }
    };
  });

  // Style Data Rows
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.height = 24;
    const isEven = rowNumber % 2 === 0;
    const rowBgColor = isEven ? 'FFFBF7' : 'FFFFFF';

    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Segoe UI', size: 10, color: { argb: '1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FED7AA' } },
        bottom: { style: 'thin', color: { argb: 'FED7AA' } },
        left: { style: 'thin', color: { argb: 'FFEDD5' } },
        right: { style: 'thin', color: { argb: 'FFEDD5' } }
      };

      if (colNumber === 1 || colNumber === 5) {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else if (colNumber === 3) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0.00';
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }

      // Veg / Non-Veg colors
      if (colNumber === 4) {
        if (cell.value === 'Veg') {
          cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: '16A34A' } };
        } else {
          cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'DC2626' } };
        }
      }
    });
  });

  const outputXlsx = path.join(process.cwd(), 'Thanvis_Cafe_Menu_Bulk_Import.xlsx');
  await workbook.xlsx.writeFile(outputXlsx);
  console.log(`✅ Successfully generated Excel file: ${outputXlsx}`);

  // 2. Generate CSV (.csv)
  const outputCsv = path.join(process.cwd(), 'Thanvis_Cafe_Menu_Bulk_Import.csv');
  const csvHeaders = ['Name', 'Category', 'Price', 'Type', 'Description', 'Is Available', 'Tax Rate', 'Image URL'];
  const csvRows = [csvHeaders.join(',')];

  THANVIS_MENU_ITEMS.forEach(item => {
    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const row = [
      escapeCsv(item.name),
      escapeCsv(item.category),
      item.price,
      escapeCsv(item.type),
      escapeCsv(item.description),
      'TRUE',
      5,
      ''
    ];
    csvRows.push(row.join(','));
  });

  fs.writeFileSync(outputCsv, csvRows.join('\n'), 'utf8');
  console.log(`✅ Successfully generated CSV file: ${outputCsv}`);

  // 3. Connect to MongoDB to seed directly into database
  const superAdminUri = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0';
  const tenantDbName = 'client_udaivikas_db';
  const tenantUri = superAdminUri.replace('/mscurechain?', `/${tenantDbName}?`);

  console.log('\n--- 3. Updating SuperAdmin Client Details ---');
  await mongoose.connect(superAdminUri);
  const Client = mongoose.connection.collection('clients');
  await Client.updateOne(
    { email: 'udaivikas.m@gmail.com' },
    {
      $set: {
        restaurantName: "Thanvi's Café - Brews & Bites",
        ownerName: 'Udai Vikas',
        location: {
          city: 'Rajampet',
          region: 'Andhra Pradesh',
          country: 'India',
          address: 'New Boyanapalli, Rajampet, Andhra Pradesh'
        }
      },
      $addToSet: {
        staffAccounts: {
          role: 'Admin',
          username: 'thanviscafe',
          plainTextPassword: 'Udai@2008'
        }
      }
    }
  );
  console.log("✅ SuperAdmin Client updated with name Thanvi's Café - Brews & Bites");
  await mongoose.disconnect();

  console.log(`\n--- 4. Seeding Tenant DB (${tenantDbName}) ---`);
  await mongoose.connect(tenantUri);
  const db = mongoose.connection;

  // Update restaurant settings
  await db.collection('settings').updateOne(
    { key: 'restaurantSettings' },
    {
      $set: {
        'value.restaurantName': "Thanvi's Café - Brews & Bites",
        'value.restaurantType': 'Café, Brews & Bites',
        'value.address': 'New Boyanapalli, Rajampet, Andhra Pradesh',
        'value.city': 'Rajampet',
        'value.email': 'udaivikas.m@gmail.com'
      }
    },
    { upsert: true }
  );

  // Add username 'thanviscafe' to users
  const hashedPassword = await bcrypt.hash('Udai@2008', 10);
  await db.collection('users').updateOne(
    { username: 'thanviscafe' },
    {
      $set: {
        username: 'thanviscafe',
        password: hashedPassword,
        role: 'Admin',
        activeSessions: [],
        updatedAt: new Date()
      },
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true }
  );

  // Seed Categories
  const categoryCollection = db.collection('categories');
  const uniqueCategories = [...new Set(THANVIS_MENU_ITEMS.map(i => i.category))];
  const categoryMap = new Map();

  for (const catName of uniqueCategories) {
    const res = await categoryCollection.findOneAndUpdate(
      { name: catName },
      {
        $set: { name: catName, isActive: true },
        $setOnInsert: { description: '', createdAt: new Date() }
      },
      { upsert: true, returnDocument: 'after' }
    );
    categoryMap.set(catName, res?._id || res?.value?._id);
  }

  // If any id wasn't returned by findOneAndUpdate, fetch them all
  const allCats = await categoryCollection.find({}).toArray();
  allCats.forEach(c => categoryMap.set(c.name, c._id));

  // Seed Menus
  const menuCollection = db.collection('menus');
  let inserted = 0;
  let updated = 0;

  for (const item of THANVIS_MENU_ITEMS) {
    const catId = categoryMap.get(item.category);
    const itemData = {
      name: item.name,
      category: catId,
      price: item.price,
      type: item.type === 'Veg' ? 'veg' : 'non-veg',
      description: item.description,
      isAvailable: true,
      taxRate: 5,
      image: '',
      updatedAt: new Date()
    };

    const existing = await menuCollection.findOne({ name: item.name });
    if (existing) {
      await menuCollection.updateOne({ _id: existing._id }, { $set: itemData });
      updated++;
    } else {
      itemData.createdAt = new Date();
      await menuCollection.insertOne(itemData);
      inserted++;
    }
  }

  console.log(`✅ Menu seeding complete: ${inserted} inserted, ${updated} updated (Total: ${THANVIS_MENU_ITEMS.length} items)`);
  await mongoose.disconnect();

  console.log('\n====================================================');
  console.log("  ALL FILES & DATABASE SEEDED SUCCESSFULLY!         ");
  console.log('====================================================');
  console.log('Files Created:');
  console.log('1. Thanvis_Cafe_Menu_Bulk_Import.xlsx');
  console.log('2. Thanvis_Cafe_Menu_Bulk_Import.csv');
  console.log('Database Status:');
  console.log('52 items live in client_udaivikas_db (menus collection)');
  console.log('====================================================');
}

generateMenuFilesAndSeedDb().catch(err => {
  console.error('❌ Error generating menu files / seeding DB:', err);
  process.exit(1);
});
