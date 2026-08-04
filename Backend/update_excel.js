import ExcelJS from 'exceljs';

// Curated real Unsplash photo IDs for each item - matched by food category/name
// These are specific real food photos from Unsplash (free to use)
const itemImageMap = {
  // Starters & Soups
  "Sweet Corn Soup": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop",
  "Tomato Soup": "https://images.unsplash.com/photo-1603105037880-880cd4edfb0d?w=400&h=300&fit=crop",
  "Mix Veg Soup": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop",
  "Chicken Soup": "https://images.unsplash.com/photo-1613844237701-8f3664fc2eff?w=400&h=300&fit=crop",
  "Mutton Soup": "https://images.unsplash.com/photo-1613844237701-8f3664fc2eff?w=400&h=300&fit=crop",
  "Paya Soup": "https://images.unsplash.com/photo-1534482421-64566f976cfa?w=400&h=300&fit=crop",
  "Haleem": "https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=400&h=300&fit=crop",
  "Veg. Haleem": "https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=400&h=300&fit=crop",
  "Chicken Keema": "https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400&h=300&fit=crop",

  // Salads
  "Green Salad": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop",
  "Fattoush Salad": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&h=300&fit=crop",
  "Tabbouleh Salad": "https://images.unsplash.com/photo-1529059997568-3d847b1154f0?w=400&h=300&fit=crop",
  "Hummus": "https://images.unsplash.com/photo-1577805947697-89e18249d767?w=400&h=300&fit=crop",
  "Mutabbal": "https://images.unsplash.com/photo-1623428187969-5da2dcea5ebf?w=400&h=300&fit=crop",

  // Breads / Rotis
  "Garlic Naan": "https://images.unsplash.com/photo-1607532941433-304659e8198a?w=400&h=300&fit=crop",
  "Butter Naan": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop",
  "Tandoori Roti": "https://images.unsplash.com/photo-1585937421612-70a008356c36?w=400&h=300&fit=crop",
  "Plain Naan": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop",
  "Lacha Parotha": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop",
  "Masala Kulcha": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&h=300&fit=crop",
  "Plain Kulcha": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&h=300&fit=crop",

  // Chicken Mandi variants
  "Chicken Afghani Mandi (Single)": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&h=300&fit=crop",
  "Chicken Afghani Mandi (Half)": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&h=300&fit=crop",
  "Chicken Afghani Mandi (Full)": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&h=300&fit=crop",
  "Chicken AL-Faham Mandi (Single)": "https://images.unsplash.com/photo-1598103442097-8b74394b95c8?w=400&h=300&fit=crop",
  "Chicken AL-Faham Mandi (Half)": "https://images.unsplash.com/photo-1598103442097-8b74394b95c8?w=400&h=300&fit=crop",
  "Chicken AL-Faham Mandi (Full)": "https://images.unsplash.com/photo-1598103442097-8b74394b95c8?w=400&h=300&fit=crop",
  "Chicken Fry Mandi (Single)": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop",
  "Chicken Fry Mandi (Half)": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop",
  "Chicken Fry Mandi (Full)": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop",
  "Tandoori Mandi (Single)": "https://images.unsplash.com/photo-1598514983318-2f64f8f4796c?w=400&h=300&fit=crop",
  "Tandoori Mandi (Half)": "https://images.unsplash.com/photo-1598514983318-2f64f8f4796c?w=400&h=300&fit=crop",
  "Tandoori Mandi (Full)": "https://images.unsplash.com/photo-1598514983318-2f64f8f4796c?w=400&h=300&fit=crop",
  "Chicken Joint Pice Mandi (Single)": "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&h=300&fit=crop",
  "Chicken Joint Pice Mandi (Half)": "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&h=300&fit=crop",
  "Chicken Joint Pice Mandi (Full)": "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&h=300&fit=crop",
  "Tangdi Mandi (Half)": "https://images.unsplash.com/photo-1598514983318-2f64f8f4796c?w=400&h=300&fit=crop",
  "Tangdi Mandi (Full)": "https://images.unsplash.com/photo-1598514983318-2f64f8f4796c?w=400&h=300&fit=crop",
  "BBQ Mandi (Half)": "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop",
  "BBQ Mandi (Full)": "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop",

  // Mutton Mandi
  "Mutton Fry Mandi (Single)": "https://images.unsplash.com/photo-1574484284002-952d92456975?w=400&h=300&fit=crop",
  "Mutton Fry Mandi (Half)": "https://images.unsplash.com/photo-1574484284002-952d92456975?w=400&h=300&fit=crop",
  "Mutton Fry Mandi (Full)": "https://images.unsplash.com/photo-1574484284002-952d92456975?w=400&h=300&fit=crop",
  "Mutton Juicy Mandi (Single)": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&h=300&fit=crop",
  "Mutton Juicy Mandi (Half)": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&h=300&fit=crop",
  "Mutton Juicy Mandi (Full)": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&h=300&fit=crop",
  "Mutton Afghani Mandi (Single)": "https://images.unsplash.com/photo-1607532941433-304659e8198a?w=400&h=300&fit=crop",
  "Mutton Afghani Mandi (Half)": "https://images.unsplash.com/photo-1607532941433-304659e8198a?w=400&h=300&fit=crop",
  "Mutton Afghani Mandi (Full)": "https://images.unsplash.com/photo-1607532941433-304659e8198a?w=400&h=300&fit=crop",

  // Fish Mandi
  "Fish Fry Mandi (Half)": "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=300&fit=crop",
  "Fish Fry Mandi (Full)": "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=300&fit=crop",
  "Prawns Mandi (Half)": "https://images.unsplash.com/photo-1599974579688-8dbdd335c77f?w=400&h=300&fit=crop",
  "Prawns Mandi (Full)": "https://images.unsplash.com/photo-1599974579688-8dbdd335c77f?w=400&h=300&fit=crop",

  // Main Course Veg
  "Paneer Butter Masala": "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&h=300&fit=crop",
  "Veg. Kadai": "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop",
  "Paneer Kadai": "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&h=300&fit=crop",
  "Bhej Kadai": "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop",
  "Palak Paneer": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop",

  // Main Course Non-Veg
  "Egg Burji": "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=400&h=300&fit=crop",
  "Butter Chicken": "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400&h=300&fit=crop",
  "Kadai Chicken": "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&h=300&fit=crop",
  "Chicken Masala": "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop",
  "Chicken Kanthari": "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&h=300&fit=crop",
  "Hyderabadi Chicken": "https://images.unsplash.com/photo-1610057099431-d73a1c9d2f2f?w=400&h=300&fit=crop",
  "Chicken Punjabi": "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400&h=300&fit=crop",
  "Chicken Kolhapuri": "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&h=300&fit=crop",
  "Andhra Special Chicken Curry": "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop",

  // Rice
  "Curd Rice": "https://images.unsplash.com/photo-1536304447766-da0ed4ce1b73?w=400&h=300&fit=crop",

  // Extras
  "Extra Rice (Mandi)": "https://images.unsplash.com/photo-1536304447766-da0ed4ce1b73?w=400&h=300&fit=crop",
  "Extra Chicken Fry Piece": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop",
  "Extra Mutton Fry Piece": "https://images.unsplash.com/photo-1574484284002-952d92456975?w=400&h=300&fit=crop",
  "Extra Chicken Afghani": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&h=300&fit=crop",
  "Extra Chicken AL-Faham": "https://images.unsplash.com/photo-1598103442097-8b74394b95c8?w=400&h=300&fit=crop",
  "Extra Myonnaise": "https://images.unsplash.com/photo-1572715376701-98568319fd0b?w=400&h=300&fit=crop",
  "Extra Mutton Juice": "https://images.unsplash.com/photo-1613844237701-8f3664fc2eff?w=400&h=300&fit=crop",
  "Extra Chicken Juice": "https://images.unsplash.com/photo-1613844237701-8f3664fc2eff?w=400&h=300&fit=crop",
  "Extra Mutton Juice Piece": "https://images.unsplash.com/photo-1574484284002-952d92456975?w=400&h=300&fit=crop",
  "Extra Mutton Afghani Piece": "https://images.unsplash.com/photo-1574484284002-952d92456975?w=400&h=300&fit=crop",
  "Extra Dry Fruits": "https://images.unsplash.com/photo-1516684732162-798a0062be99?w=400&h=300&fit=crop",

  // Platters / Combos
  "Spl. AL-Mandi Starter Platter": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop",
  "Chowki - Chicken": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&h=300&fit=crop",
  "Chowki - Mutton": "https://images.unsplash.com/photo-1574484284002-952d92456975?w=400&h=300&fit=crop",
  "AL-Mandi Mix Chowki": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&h=300&fit=crop",

  // Special Mandi
  "Special Zurbian Mandi (Half)": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&h=300&fit=crop",
  "Special Zurbian Mandi (Full)": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&h=300&fit=crop",
  "Spl. Mutton Shoulder Mandi": "https://images.unsplash.com/photo-1574484284002-952d92456975?w=400&h=300&fit=crop",
  "Spl. Mutton Leg Mandi": "https://images.unsplash.com/photo-1574484284002-952d92456975?w=400&h=300&fit=crop",

  // Biryani
  "Chicken Dum Biryani (Regular)": "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=400&h=300&fit=crop",
  "Chicken Dum Biryani (Family Pack)": "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=400&h=300&fit=crop",
  "Chicken Fry Biryani (Regular)": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&h=300&fit=crop",
  "Chicken Fry Biryani (Family Pack)": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&h=300&fit=crop",
  "Chicken Lollipop Biryani (Regular)": "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=400&h=300&fit=crop",
  "Chicken Lollipop Biryani (Family Pack)": "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=400&h=300&fit=crop",
  "Spl. Chicken Biryani (Regular)": "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=400&h=300&fit=crop",
  "Spl. Chicken Biryani (Family Pack)": "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=400&h=300&fit=crop",

  // Desserts
  "Apricot Desert": "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop",
  "Shahadut Malai": "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=300&fit=crop",
  "Passion Delight": "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=400&h=300&fit=crop",
  "Arabian Delight": "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop",

  // Drinks
  "Drinks & Water Bottles": "https://images.unsplash.com/photo-1546173159-315724a31696?w=400&h=300&fit=crop",
};

// Category fallback images when item name not in map
const categoryFallbacks = {
  "Starters": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop",
  "Soups": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop",
  "Salads": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop",
  "Rotis": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop",
  "Mandi (Veg)": "https://images.unsplash.com/photo-1536304447766-da0ed4ce1b73?w=400&h=300&fit=crop",
  "Mandi (Non-Veg) - Chicken Mandi": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&h=300&fit=crop",
  "Mandi (Non-Veg) - Mutton Mandi": "https://images.unsplash.com/photo-1574484284002-952d92456975?w=400&h=300&fit=crop",
  "Fish Mandi": "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=300&fit=crop",
  "Main Course (Veg)": "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&h=300&fit=crop",
  "Main Course (Non-Veg)": "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400&h=300&fit=crop",
  "Rice": "https://images.unsplash.com/photo-1536304447766-da0ed4ce1b73?w=400&h=300&fit=crop",
  "Extras": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&h=300&fit=crop",
  "Platters (Combo)": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop",
  "Special Mandi": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&h=300&fit=crop",
  "Desert": "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop",
  "Soft Drinks": "https://images.unsplash.com/photo-1546173159-315724a31696?w=400&h=300&fit=crop",
};

async function updateExcel() {
  const filePath = '../AL Mandi Palace (1).xlsx';
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  const worksheet = workbook.worksheets[0];
  let count = 0;
  let notFound = [];
  
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    
    const name = typeof row.getCell(1).value === 'string' ? row.getCell(1).value.trim() : null;
    const category = typeof row.getCell(2).value === 'string' ? row.getCell(2).value.trim() : null;
    
    if (!name) return;
    
    let imageUrl = itemImageMap[name];
    
    if (!imageUrl && category) {
      // Find category fallback by checking if any category key is contained in the category string
      for (const [key, url] of Object.entries(categoryFallbacks)) {
        if (category.includes(key) || key.includes(category)) {
          imageUrl = url;
          break;
        }
      }
    }
    
    if (!imageUrl) {
      // Generic food fallback
      imageUrl = "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&h=300&fit=crop";
      notFound.push(name);
    }
    
    row.getCell(8).value = imageUrl;
    count++;
  });
  
  await workbook.xlsx.writeFile(filePath);
  console.log(`✅ Updated ${count} items with real food images.`);
  if (notFound.length > 0) {
    console.log(`⚠️  Items using generic fallback (${notFound.length}):`, notFound);
  }
}

updateExcel().catch(console.error);
