const ExcelJS = require('./Backend/node_modules/exceljs');
const fs = require('fs');
const path = require('path');
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']); } catch (e) {}
const mongoose = require('./Backend/node_modules/mongoose');
const bcrypt = require('./Backend/node_modules/bcryptjs');

// Complete transcribed menu items from Viraj Cafe (Opposite Sagar Restaurant, Gandhi Road, Proddatur)
const VIRAJ_MENU_ITEMS = [
  // ==========================================
  // 1. Soups (Page 1)
  // ==========================================
  { name: 'Veg Hot and Sour', category: 'Soups', price: 89, type: 'Veg', description: 'Spicy and tangy vegetable broth loaded with shredded cabbage, carrots, and mushrooms' },
  { name: 'Veg Manchow', category: 'Soups', price: 99, type: 'Veg', description: 'Classic dark soy garlic broth packed with chopped vegetables, served with crispy noodles' },
  { name: 'Veg Sweet Corn', category: 'Soups', price: 119, type: 'Veg', description: 'Silky comforting sweet corn soup with tender corn kernels and mild herbs' },
  { name: 'Tomato Shorba', category: 'Soups', price: 99, type: 'Veg', description: 'Traditional spiced Indian tomato soup infused with herbs, cumin, and fresh coriander' },
  { name: 'Chicken Sweet Corn', category: 'Soups', price: 119, type: 'Non-Veg', description: 'Rich egg drop broth with tender shredded chicken breast and sweet corn' },
  { name: 'Chicken Hot and Sour', category: 'Soups', price: 129, type: 'Non-Veg', description: 'Fiery chicken soup accented with chili paste, vinegar, mushrooms, and shredded chicken' },
  { name: 'Chicken Manchow', category: 'Soups', price: 129, type: 'Non-Veg', description: 'Spicy Indo-Chinese dark soy chicken broth topped with crispy fried noodles' },

  // ==========================================
  // 2. Sea food Starters (Page 1)
  // ==========================================
  { name: 'Andhra Fish Fry', category: 'Sea food Starters', price: 280, type: 'Non-Veg', description: 'Boneless fish fillets marinated in traditional Andhra spices and pan-fried crisp' },
  { name: 'Chilli Glazed Fish', category: 'Sea food Starters', price: 299, type: 'Non-Veg', description: 'Crispy batter-fried fish fillets wok-glazed in sweet and spicy chilli sauce' },
  { name: 'Fish Manchuria', category: 'Sea food Starters', price: 299, type: 'Non-Veg', description: 'Crisp fish nuggets tossed in dark soy, garlic, and ginger Manchurian gravy' },
  { name: 'Fish Finger', category: 'Sea food Starters', price: 319, type: 'Non-Veg', description: 'Golden crumb-coated boneless fish fingers fried crisp, served with dipping sauce' },
  { name: 'Garlic Fish', category: 'Sea food Starters', price: 319, type: 'Non-Veg', description: 'Fresh fish fillets tossed with sautéed roasted garlic, green chillies, and herbs' },
  { name: 'Loose Prawns', category: 'Sea food Starters', price: 340, type: 'Non-Veg', description: 'Crisp light-battered succulent prawns tossed with onions, green chillies, and curry leaves' },
  { name: 'Chilli Prawns', category: 'Sea food Starters', price: 340, type: 'Non-Veg', description: 'Batter-fried juicy prawns wok-glazed in spicy soy chilli garlic sauce with capsicum' },
  { name: 'Prawns Manchuria', category: 'Sea food Starters', price: 320, type: 'Non-Veg', description: 'Crispy prawns tossed in classic oriental ginger garlic Manchurian reduction' },
  { name: 'Garlic Prawns', category: 'Sea food Starters', price: 340, type: 'Non-Veg', description: 'Plump prawns sautéed in rich garlic herb butter with a touch of crushed pepper' },
  { name: 'Golden Fried Prawns', category: 'Sea food Starters', price: 360, type: 'Non-Veg', description: 'Golden butterflied prawns crumb-coated and deep fried until super crunchy' },
  { name: 'Prawns Fry', category: 'Sea food Starters', price: 360, type: 'Non-Veg', description: 'Traditional coastal style spiced prawns pan-fried with onions and curry leaves' },
  { name: 'Gongura Prawns', category: 'Sea food Starters', price: 340, type: 'Non-Veg', description: 'Fresh prawns tossed with authentic tangy Andhra Gongura roselle leaf masala' },

  // ==========================================
  // 3. Veg Starters (Page 1)
  // ==========================================
  { name: 'Gobi Manchuria', category: 'Veg Starters', price: 119, type: 'Veg', description: 'Crispy cauliflower florets batter-fried and tossed in dark soy Manchurian glaze' },
  { name: 'Gobi 65', category: 'Veg Starters', price: 129, type: 'Veg', description: 'Cauliflower florets marinated in South Indian spices and deep fried crisp with curry leaves' },
  { name: 'Gobi Chilli', category: 'Veg Starters', price: 139, type: 'Veg', description: 'Crispy fried cauliflower florets tossed with onions, capsicum, and green chillies' },
  { name: 'Gobi Pepper', category: 'Veg Starters', price: 149, type: 'Veg', description: 'Cauliflower dry-fried with freshly cracked black peppercorns and curry leaves' },
  { name: 'Mushroom Manchuria', category: 'Veg Starters', price: 149, type: 'Veg', description: 'Fresh button mushrooms fried crisp and tossed in dark soy Manchurian sauce' },
  { name: 'Mushroom 65', category: 'Veg Starters', price: 159, type: 'Veg', description: 'Battered button mushrooms deep-fried with aromatic Indian 65 spices and curry leaves' },
  { name: 'Mushroom Chilli', category: 'Veg Starters', price: 159, type: 'Veg', description: 'Juicy button mushrooms wok-seared with green chillies, onions, and capsicum' },
  { name: 'Mushroom Pepper', category: 'Veg Starters', price: 169, type: 'Veg', description: 'Whole button mushrooms sautéed with fresh ground black pepper and curry leaves' },
  { name: 'Baby Corn Manchuria', category: 'Veg Starters', price: 169, type: 'Veg', description: 'Tender baby corn fingers batter-fried and glazed in savoury Manchurian sauce' },
  { name: 'Baby Corn 65', category: 'Veg Starters', price: 179, type: 'Veg', description: 'Crunchy baby corn tossed in spicy South Indian 65 tempering and curry leaves' },
  { name: 'Baby Corn Chilli', category: 'Veg Starters', price: 179, type: 'Veg', description: 'Golden baby corn wok-tossed with capsicum, onion, and oriental chilli sauce' },
  { name: 'Baby Corn Pepper', category: 'Veg Starters', price: 179, type: 'Veg', description: 'Crisp baby corn tossed in freshly crushed black pepper and aromatics' },
  { name: 'Paneer Manchuria', category: 'Veg Starters', price: 220, type: 'Veg', description: 'Crispy paneer cubes tossed in garlic, ginger, and scallion Manchurian sauce' },
  { name: 'Paneer 65', category: 'Veg Starters', price: 240, type: 'Veg', description: 'Spiced paneer cubes deep-fried and tossed with tempered curry leaves and chillies' },
  { name: 'Paneer Chilli', category: 'Veg Starters', price: 240, type: 'Veg', description: 'Cottage cheese cubes tossed in spicy chilli soy reduction with bell peppers' },
  { name: 'Paneer Pepper', category: 'Veg Starters', price: 250, type: 'Veg', description: 'Fresh paneer cubes dry-tossed in robust crushed black peppercorn seasoning' },
  { name: 'Crispy Corn', category: 'Veg Starters', price: 160, type: 'Veg', description: 'Crisp fried sweet corn kernels tossed with spices, onion, and fresh lemon juice' },

  // ==========================================
  // 4. Egg Items (Page 1)
  // ==========================================
  { name: 'Omlet', category: 'Egg Items', price: 60, type: 'Non-Veg', description: 'Fluffy beaten egg omelette with chopped onions, green chillies, and fresh coriander' },
  { name: 'Egg Burji', category: 'Egg Items', price: 80, type: 'Non-Veg', description: 'Spicy Indian style scrambled eggs sautéed with onions, tomatoes, and aromatic herbs' },
  { name: 'Chilli Egg', category: 'Egg Items', price: 120, type: 'Non-Veg', description: 'Crispy battered boiled egg wedges tossed in spicy chilli garlic soya sauce' },
  { name: 'Egg Manchuria', category: 'Egg Items', price: 149, type: 'Non-Veg', description: 'Batter-fried egg pieces glazed in savoury ginger garlic Manchurian reduction' },

  // ==========================================
  // 5. Chicken Starter (Page 2)
  // ==========================================
  { name: 'Chicken Manchuria', category: 'Chicken Starter', price: 180, type: 'Non-Veg', description: 'Crisp chicken morsels wok-tossed in classic ginger garlic Manchurian sauce' },
  { name: 'Chicken 65', category: 'Chicken Starter', price: 220, type: 'Non-Veg', description: 'Authentic spicy deep-fried chicken cubes tossed with curry leaves and green chillies' },
  { name: 'Chicken Chilli', category: 'Chicken Starter', price: 220, type: 'Non-Veg', description: 'Wok-seared diced chicken tossed with crisp green peppers, onions, and soy chilli glaze' },
  { name: 'Rayalseema Chicken', category: 'Chicken Starter', price: 230, type: 'Non-Veg', description: 'Authentic spicy Rayalaseema style rustic chicken fry cooked with native spices' },
  { name: 'Schezwan Chicken Dry', category: 'Chicken Starter', price: 240, type: 'Non-Veg', description: 'Wok-tossed chicken chunks in pungent spicy Schezwan chilli paste and bell peppers' },
  { name: 'Chicken Drumstick', category: 'Chicken Starter', price: 250, type: 'Non-Veg', description: 'Juicy spiced chicken drumsticks roasted and fried crisp with herb seasonings' },
  { name: 'Chicken Lollipop (6pc)', category: 'Chicken Starter', price: 260, type: 'Non-Veg', description: 'Frenched chicken winglets batter-fried crisp served with spicy house dip (6 pcs)' },
  { name: 'Chicken Majestic', category: 'Chicken Starter', price: 240, type: 'Non-Veg', description: 'Crisp chicken tenders cooked with green chillies, mint leaves, and mild spiced curd' },
  { name: 'Dragon Chicken', category: 'Chicken Starter', price: 240, type: 'Non-Veg', description: 'Crispy chicken strips tossed in fiery sweet chilli paste, cashews, and garlic' },
  { name: 'Pepper Chicken', category: 'Chicken Starter', price: 250, type: 'Non-Veg', description: 'Traditional South Indian style chicken dry fry coated in crushed black peppercorns' },
  { name: 'Chicken 555', category: 'Chicken Starter', price: 240, type: 'Non-Veg', description: 'Tender chicken strips tossed in a mildly spicy creamy garlic and green chilli dressing' },
  { name: 'Hyd Chicken Ghee Roast', category: 'Chicken Starter', price: 250, type: 'Non-Veg', description: 'Chicken roasted in pure aromatic desi ghee with freshly ground Hyderabadi spices' },
  { name: 'Lemon Chicken', category: 'Chicken Starter', price: 229, type: 'Non-Veg', description: 'Succulent chicken morsels flavored with fresh lemon juice, white pepper, and green chillies' },
  { name: 'Gongura Chicken Dry', category: 'Chicken Starter', price: 249, type: 'Non-Veg', description: 'Dry roasted chicken tossed with tangy authentic Andhra Gongura leaf masala' },
  { name: 'Golden Chicken (SPL)', category: 'Chicken Starter', price: 259, type: 'Non-Veg', description: 'Chef special crunchy crumb-coated golden fried chicken fillets with dips' },
  { name: 'Garlic Chicken', category: 'Chicken Starter', price: 259, type: 'Non-Veg', description: 'Tender chicken pieces sautéed in aromatic roasted garlic and herb sauce' },
  { name: 'Velluli Kodi vepudu(SPL)', category: 'Chicken Starter', price: 260, type: 'Non-Veg', description: 'Special Rayalaseema style garlic-infused dry chicken fry with native spices' },
  { name: 'Kothimeera Kodi Vepudu(SPL)', category: 'Chicken Starter', price: 260, type: 'Non-Veg', description: 'Special chicken fry tossed in freshly ground green coriander masala paste' },

  // ==========================================
  // 6. Biryani's (Page 2)
  // ==========================================
  { name: 'Veg Biryani', category: "Biryani's", price: 150, type: 'Veg', description: 'Fragrant basmati rice layered with garden vegetables, saffron, and aromatic spices' },
  { name: 'Lollipop Biryani', category: "Biryani's", price: 240, type: 'Non-Veg', description: 'Aromatic dum basmati biryani served with crispy spiced chicken lollipops' },
  { name: 'Chicken 65 Biryani', category: "Biryani's", price: 240, type: 'Non-Veg', description: 'Flavourful basmati biryani topped with fiery juicy Chicken 65 morsels' },
  { name: 'Egg Biryani', category: "Biryani's", price: 190, type: 'Non-Veg', description: 'Fragrant basmati biryani layered with roasted spiced boiled eggs and herbs' },
  { name: 'Fish Biryani', category: "Biryani's", price: 280, type: 'Non-Veg', description: 'Royal basmati rice dum cooked with marinated boneless fish fillets and spices' },
  { name: 'Prawns Biryani', category: "Biryani's", price: 320, type: 'Non-Veg', description: 'Aromatic basmati rice cooked with succulent marinated fresh prawns and saffron' },

  // ==========================================
  // 7. Noodles (Page 2)
  // ==========================================
  { name: 'Veg Soft Noodles', category: 'Noodles', price: 99, type: 'Veg', description: 'Stir-fried soft noodles tossed with shredded cabbage, carrots, and spring onions' },
  { name: 'Veg Hakka Noodles', category: 'Noodles', price: 129, type: 'Veg', description: 'Traditional Hakka style wok noodles tossed with fresh crisp vegetables and soy' },
  { name: 'Schezwan Soft Noodles', category: 'Noodles', price: 139, type: 'Veg', description: 'Spicy wok-tossed noodles laced with fiery Schezwan chili paste and veggies' },
  { name: 'Chilli Garlic Noodles', category: 'Noodles', price: 149, type: 'Veg', description: 'Stir-fried noodles infused with robust roasted garlic and spicy red chillies' },
  { name: 'Gobi Noodles', category: 'Noodles', price: 129, type: 'Veg', description: 'Wok-tossed noodles mixed with crispy seasoned cauliflower florets and veggies' },
  { name: 'Egg Soft Noodles', category: 'Noodles', price: 120, type: 'Non-Veg', description: 'Soft noodles stir-fried with fluffy scrambled eggs and garden vegetables' },
  { name: 'Chicken Soft Noodles', category: 'Noodles', price: 140, type: 'Non-Veg', description: 'Classic stir-fried noodles loaded with shredded chicken and seasoned veggies' },
  { name: 'Schezwan Chicken Noodles', category: 'Noodles', price: 149, type: 'Non-Veg', description: 'Spicy Schezwan noodles wok-tossed with tender chicken chunks and vegetables' },
  { name: 'Chicken Hakka Noodles', category: 'Noodles', price: 149, type: 'Non-Veg', description: 'Traditional Hakka style wok noodles tossed with tender chicken strips and soy sauce' },
  { name: 'Mixed Soft Noodles', category: 'Noodles', price: 240, type: 'Non-Veg', description: 'Loaded wok noodles featuring chicken, egg, juicy prawns, and assorted vegetables' },
  { name: 'Prawns Soft Noodles', category: 'Noodles', price: 249, type: 'Non-Veg', description: 'Soft noodles stir-fried with tender sautéed prawns, spring onions, and garlic' },

  // ==========================================
  // 8. Fried Rice (Page 2)
  // ==========================================
  { name: 'Jeera Rice', category: 'Fried Rice', price: 99, type: 'Veg', description: 'Aromatic basmati rice tempered with roasted cumin seeds and pure desi ghee' },
  { name: 'Veg Fried Rice', category: 'Fried Rice', price: 120, type: 'Veg', description: 'Wok-tossed basmati rice with finely diced seasonal vegetables and mild seasoning' },
  { name: 'Gobi Fried Rice', category: 'Fried Rice', price: 129, type: 'Veg', description: 'Flavourful fried rice tossed with crispy seasoned cauliflower florets' },
  { name: 'Mushroom Fried Rice', category: 'Fried Rice', price: 149, type: 'Veg', description: 'Savoury basmati fried rice cooked with fresh button mushrooms and spring onions' },
  { name: 'Schezwan Fried Rice', category: 'Fried Rice', price: 159, type: 'Veg', description: 'Fiery wok-fried rice tossed in zesty red Schezwan sauce and crisp vegetables' },
  { name: 'Mixed Fried Rice', category: 'Fried Rice', price: 180, type: 'Veg', description: 'Rich fried rice packed with assorted vegetables, paneer, and mushrooms' },
  { name: 'Chilli Garlic Fried Rice', category: 'Fried Rice', price: 159, type: 'Veg', description: 'Aromatic fried rice packed with roasted garlic and crushed dry red chillies' },
  { name: 'Paneer Fried Rice', category: 'Fried Rice', price: 179, type: 'Veg', description: 'Wok-tossed basmati fried rice loaded with golden spiced cottage cheese cubes' },
  { name: 'Kaju Fried Rice', category: 'Fried Rice', price: 199, type: 'Veg', description: 'Rich basmati fried rice loaded with crunchy roasted golden cashew nuts' },
  { name: 'Egg Fried Rice', category: 'Fried Rice', price: 139, type: 'Non-Veg', description: 'Classic wok-fried rice tossed with fluffy scrambled eggs and spring onions' },
  { name: 'Chicken Fried Rice', category: 'Fried Rice', price: 149, type: 'Non-Veg', description: 'Popular Indo-Chinese fried rice tossed with tender shredded chicken and vegetables' },
  { name: 'Schezwan Chicken Rice', category: 'Fried Rice', price: 169, type: 'Non-Veg', description: 'Spicy Schezwan fried rice wok-tossed with tender chicken morsels and egg' },
  { name: 'Chicken Ginger Garlic Rice', category: 'Fried Rice', price: 220, type: 'Non-Veg', description: 'Aromatic chicken fried rice infused with freshly crushed ginger and garlic' },
  { name: 'Mixed Non Veg Fried Rice', category: 'Fried Rice', price: 259, type: 'Non-Veg', description: 'Grand feast fried rice loaded with tender chicken, egg, and juicy prawns' },

  // ==========================================
  // 9. Burgers (Page 3)
  // ==========================================
  { name: 'Classic Veg Burger', category: 'Burgers', price: 49, type: 'Veg', description: 'Fresh toasted sesame bun with seasoned vegetable patty, lettuce, and creamy spread' },
  { name: 'Aloo Tikki Burger', category: 'Burgers', price: 59, type: 'Veg', description: 'Crispy spiced potato patty topped with creamy burger sauce, onion, and tomato' },
  { name: 'Grilled Paneer Burger', category: 'Burgers', price: 89, type: 'Veg', description: 'Marinated grilled cottage cheese slice layered with crisp lettuce and sauce' },
  { name: 'Crispy Paneer Burger', category: 'Burgers', price: 89, type: 'Veg', description: 'Crunchy golden crumb-fried paneer patty topped with rich creamy dressing' },
  { name: 'BBQ Paneer Burger', category: 'Burgers', price: 99, type: 'Veg', description: 'Grilled paneer slab smothered in smoky barbecue sauce and fresh greens' },
  { name: 'Paneer Peri Peri Burger', category: 'Burgers', price: 99, type: 'Veg', description: 'Spicy peri peri seasoned paneer patty with creamy spicy dressing in toasted bun' },
  { name: 'Classic Chicken Burger', category: 'Burgers', price: 59, type: 'Non-Veg', description: 'Soft bun layered with juicy seasoned chicken patty, fresh lettuce, and house mayo' },
  { name: 'Crunchy Chicken Burger', category: 'Burgers', price: 59, type: 'Non-Veg', description: 'Super crispy golden crumbed chicken patty with crunchy lettuce and special sauce' },
  { name: 'BBQ Chicken Burger', category: 'Burgers', price: 69, type: 'Non-Veg', description: 'Tender chicken patty glazed with rich smoky BBQ sauce and creamy spread' },
  { name: 'Peri Peri Chicken Burger', category: 'Burgers', price: 79, type: 'Non-Veg', description: 'Crispy spiced chicken patty dusted with fiery peri peri seasoning and sauce' },

  // ==========================================
  // 10. Snacks (Page 3)
  // ==========================================
  { name: 'Salted French Fries', category: 'Snacks', price: 89, type: 'Veg', description: 'Classic crispy golden potato fries seasoned with fine sea salt' },
  { name: 'Peri Peri French Fries', category: 'Snacks', price: 99, type: 'Veg', description: 'Crunchy golden fries tossed in zesty and fiery peri peri spice mix' },
  { name: 'Potato Wedges', category: 'Snacks', price: 109, type: 'Veg', description: 'Thick-cut skin-on potato wedges seasoned with herbs and fried golden' },
  { name: 'Veg Nuggets', category: 'Snacks', price: 99, type: 'Veg', description: 'Golden crispy crumbed vegetable nuggets served with tangy dip' },
  { name: 'Paneer Popcorn', category: 'Snacks', price: 179, type: 'Veg', description: 'Bite-sized paneer cubes crumb-coated and fried to super crunch' },
  { name: 'Paneer Fingers', category: 'Snacks', price: 169, type: 'Veg', description: 'Crispy crumbed cottage cheese batons served with herb mayonnaise dip' },
  { name: 'Crispy Corn (Snacks)', category: 'Snacks', price: 160, type: 'Veg', description: 'Crunchy batter-fried sweet corn kernels tossed in spices and lemon' },
  { name: 'Chicken Popcorn (Small)', category: 'Snacks', price: 100, type: 'Non-Veg', description: 'Crunchy bite-sized chicken popcorn nuggets (Small portion)' },
  { name: 'Chicken Popcorn (Large)', category: 'Snacks', price: 189, type: 'Non-Veg', description: 'Generous portion of crunchy bite-sized chicken popcorn nuggets (Large portion)' },
  { name: 'Fish Popcorn', category: 'Snacks', price: 199, type: 'Non-Veg', description: 'Bite-sized crispy fried fish nuggets served with creamy dip' },
  { name: 'Mushroom Popcorn', category: 'Snacks', price: 139, type: 'Veg', description: 'Crispy bite-sized button mushroom nuggets seasoned with herbs' },
  { name: 'Chicken Strips (Small)', category: 'Snacks', price: 100, type: 'Non-Veg', description: 'Juicy boneless chicken breast tenders crumb-fried crisp (Small portion)' },
  { name: 'Chicken Strips (Large)', category: 'Snacks', price: 189, type: 'Non-Veg', description: 'Large portion of crunchy golden fried boneless chicken breast tenders' },
  { name: 'Chicken and Chips', category: 'Snacks', price: 159, type: 'Non-Veg', description: 'Crispy fried chicken tenders served with a hearty side of salted fries' },
  { name: 'Chicken Nuggets', category: 'Snacks', price: 89, type: 'Non-Veg', description: 'Crispy golden fried chicken nuggets served with dipping sauces' },

  // ==========================================
  // 11. Pasta (Page 3)
  // ==========================================
  { name: 'Alfredo White Sauce Pasta (Veg)', category: 'Pasta', price: 189, type: 'Veg', description: 'Penne pasta in rich creamy parmesan and garlic butter white sauce with veggies' },
  { name: 'Alfredo White Sauce Pasta (Non-Veg)', category: 'Pasta', price: 229, type: 'Non-Veg', description: 'Penne pasta in creamy Alfredo white sauce loaded with seasoned chicken morsels' },
  { name: 'Pink Sauce Pasta (Veg)', category: 'Pasta', price: 229, type: 'Veg', description: 'Pasta tossed in delicious creamy blend of tangy tomato red sauce and white sauce' },
  { name: 'Pink Sauce Pasta (Non-Veg)', category: 'Pasta', price: 249, type: 'Non-Veg', description: 'Creamy pink sauce pasta tossed with succulent chicken chunks and Italian herbs' },
  { name: 'Red Sauce Arrabiata Pasta (Veg)', category: 'Pasta', price: 229, type: 'Veg', description: 'Spicy Italian tomato sauce pasta simmered with garlic, basil, and red chillies' },
  { name: 'Red Sauce Arrabiata Pasta (Non-Veg)', category: 'Pasta', price: 239, type: 'Non-Veg', description: 'Fiery Arrabiata tomato pasta tossed with grilled seasoned chicken pieces' },
  { name: 'Mac and Cheese Pasta (Veg)', category: 'Pasta', price: 179, type: 'Veg', description: 'Classic macaroni baked in rich gooey melted cheddar cheese sauce' },
  { name: 'Mac and Cheese Pasta (Non-Veg)', category: 'Pasta', price: 199, type: 'Non-Veg', description: 'Macaroni in cheesy cheddar sauce baked with seasoned tender chicken bits' },

  // ==========================================
  // 12. Momos (Page 3)
  // ==========================================
  { name: 'VEG Momo (6 Pcs)', category: 'Momos', price: 99, type: 'Veg', description: 'Steamed vegetable dumplings stuffed with seasoned minced garden veggies (6 pcs)' },
  { name: 'Chicken Momo (6 Pcs)', category: 'Momos', price: 120, type: 'Non-Veg', description: 'Steamed dumplings packed with juicy minced spiced chicken (6 pcs)' },

  // ==========================================
  // 13. Garlic Breads (Page 3)
  // ==========================================
  { name: 'Cheese Garlic Bread', category: 'Garlic Breads', price: 99, type: 'Veg', description: 'Toasted garlic bread topped with rich melted mozzarella cheese and oregano' },
  { name: 'Cheese & Corn Garlic Bread', category: 'Garlic Breads', price: 99, type: 'Veg', description: 'Toasted garlic bread topped with sweet corn kernels and melted mozzarella' },
  { name: 'Cheese Paneer Garlic Bread', category: 'Garlic Breads', price: 119, type: 'Veg', description: 'Garlic bread topped with spiced cottage cheese cubes and gooey melted cheese' },
  { name: 'Cheese Chicken Garlic Bread', category: 'Garlic Breads', price: 119, type: 'Non-Veg', description: 'Garlic bread topped with seasoned chicken bits and melted mozzarella cheese' },

  // ==========================================
  // 14. Wraps (Page 3)
  // ==========================================
  { name: 'Crunchy Paneer Wrap', category: 'Wraps', price: 99, type: 'Veg', description: 'Crispy paneer strips, fresh veggies, and spicy dressing rolled in soft tortilla' },
  { name: 'Crunchy Chicken Wrap', category: 'Wraps', price: 99, type: 'Non-Veg', description: 'Golden crispy chicken tenders rolled with lettuce and sauce in a soft wrap' },
  { name: 'BBQ Paneer Wrap', category: 'Wraps', price: 120, type: 'Veg', description: 'Grilled paneer glazed in smoky barbecue sauce wrapped with crisp onions' },
  { name: 'BBQ Chicken Wrap', category: 'Wraps', price: 120, type: 'Non-Veg', description: 'Juicy BBQ glazed chicken breast strips rolled in toasted tortilla wrap' },
  { name: 'Peri Peri Paneer Wrap', category: 'Wraps', price: 120, type: 'Veg', description: 'Spiced paneer cubes in fiery peri peri sauce with crunchy greens in a wrap' },
  { name: 'Peri Peri Chicken Wrap', category: 'Wraps', price: 120, type: 'Non-Veg', description: 'Tender chicken tenders coated in spicy peri peri sauce rolled in flatbread' },
  { name: 'Aloo Tikki Wrap', category: 'Wraps', price: 99, type: 'Veg', description: 'Crispy spiced potato patty with mint mayo and onions rolled in flatbread' },

  // ==========================================
  // 15. Beverages (Page 4)
  // ==========================================
  { name: 'Thums Up', category: 'Beverages', price: 25, type: 'Veg', description: 'Strong, fizzy refreshing cola soft drink (MRP)' },
  { name: 'Coca-Cola', category: 'Beverages', price: 25, type: 'Veg', description: 'Classic refreshing fizzy Coca-Cola (MRP)' },
  { name: 'Sprite', category: 'Beverages', price: 25, type: 'Veg', description: 'Crisp, clean lemon-lime flavoured soda (MRP)' },
  { name: 'Maaza', category: 'Beverages', price: 25, type: 'Veg', description: 'Sweet and refreshing Alphonso mango fruit drink (MRP)' },
  { name: 'Water Bottle (MRP)', category: 'Beverages', price: 20, type: 'Veg', description: 'Packaged purified mineral drinking water (MRP)' },

  // ==========================================
  // 16. Mocktails (Page 4)
  // ==========================================
  { name: 'Virgin Mojito', category: 'Mocktails', price: 79, type: 'Veg', description: 'Refreshing mocktail with muddled mint leaves, fresh lime juice, and sparkling soda' },
  { name: 'Blue Curacao', category: 'Mocktails', price: 79, type: 'Veg', description: 'Vibrant citrus blue curacao mocktail topped with soda and lemon slice' },
  { name: 'Mint Lemon', category: 'Mocktails', price: 79, type: 'Veg', description: 'Cool zesty mocktail blended with crushed mint and fresh tangy lemon juice' },
  { name: 'Watermelon Mocktail', category: 'Mocktails', price: 89, type: 'Veg', description: 'Juicy fresh watermelon extract topped with mint, lime, and chilled soda' },
  { name: 'Strawberry Mocktail', category: 'Mocktails', price: 89, type: 'Veg', description: 'Sweet strawberry puree mixed with tangy lemon juice and fizzy soda' },
  { name: 'Orange Mocktail', category: 'Mocktails', price: 89, type: 'Veg', description: 'Zesty citrus orange blend served chilled with ice and a splash of soda' },

  // ==========================================
  // 17. Milk Shakes (Page 4)
  // ==========================================
  { name: '5 Star Milkshake', category: 'Milk Shakes', price: 90, type: 'Veg', description: 'Rich milkshake blended with chocolatey 5 Star candy bars and chilled milk' },
  { name: 'Mango Milkshake', category: 'Milk Shakes', price: 100, type: 'Veg', description: 'Sweet and fruity milkshake blended with luscious mango pulp and ice cream' },
  { name: 'Kit Kat Milkshake', category: 'Milk Shakes', price: 100, type: 'Veg', description: 'Crunchy Kit Kat wafers blended with creamy vanilla and chocolate milk' },
  { name: 'Oreo Milkshake', category: 'Milk Shakes', price: 120, type: 'Veg', description: 'Creamy shake blended with crushed Oreo cookies and rich chocolate sauce' },
  { name: 'Snickers Milkshake', category: 'Milk Shakes', price: 120, type: 'Veg', description: 'Decadent shake with Snickers bar, caramel, roasted peanuts, and cocoa' },
  { name: 'Butterscotch Milkshake', category: 'Milk Shakes', price: 120, type: 'Veg', description: 'Creamy shake infused with sweet butterscotch syrup and crunchy pralines' },
  { name: 'Strawberry Milkshake', category: 'Milk Shakes', price: 120, type: 'Veg', description: 'Fresh strawberry fruit crush blended with velvety smooth chilled milk' },
  { name: 'Black Currant Milkshake', category: 'Milk Shakes', price: 150, type: 'Veg', description: 'Exotic black currant berry shake with real fruit extract and ice cream' },
  { name: 'Red Velvet Milkshake', category: 'Milk Shakes', price: 150, type: 'Veg', description: 'Luxurious red velvet cake crumbs blended into a creamy rich milkshake' },

  // ==========================================
  // 18. Thick Shakes (Page 4)
  // ==========================================
  { name: '5 Star Thick Shake', category: 'Thick Shakes', price: 150, type: 'Veg', description: 'Ultra rich thick shake blended with 5 Star candy and chocolate ice cream' },
  { name: 'Mango Thick Shake', category: 'Thick Shakes', price: 160, type: 'Veg', description: 'Super thick gourmet shake made with pure mango pulp and rich cream' },
  { name: 'Kit Kat Thick Shake', category: 'Thick Shakes', price: 160, type: 'Veg', description: 'Decadent thick shake loaded with crunchy Kit Kat wafer chunks and cream' },
  { name: 'Oreo Thick Shake', category: 'Thick Shakes', price: 180, type: 'Veg', description: 'Dense thick shake blended with generous whole Oreo cookies and fudge' },
  { name: 'Snickers Thick Shake', category: 'Thick Shakes', price: 200, type: 'Veg', description: 'Rich thick shake bursting with peanut nougat Snickers and caramel' },
  { name: 'Butterscotch Thick Shake', category: 'Thick Shakes', price: 200, type: 'Veg', description: 'Creamy dense butterscotch thick shake topped with crunchy nut praline' },
  { name: 'Strawberry Thick Shake', category: 'Thick Shakes', price: 200, type: 'Veg', description: 'Rich strawberry thick shake crafted with strawberry puree and ice cream' },
  { name: 'Black Currant Thick Shake', category: 'Thick Shakes', price: 230, type: 'Veg', description: 'Premium dark berry thick shake made with wild black currants' },
  { name: 'Red Velvet Thick Shake', category: 'Thick Shakes', price: 230, type: 'Veg', description: 'Decadent red velvet sponge and cream cheese blended into a thick shake' },

  // ==========================================
  // 19. Ice Creams (Page 4)
  // ==========================================
  { name: 'Fruit Twist Ice Cream', category: 'Ice Creams', price: 180, type: 'Veg', description: 'Medley of tropical fruit scoops drizzled with fruit syrup and roasted nuts' },
  { name: 'Purple Rain Ice Cream', category: 'Ice Creams', price: 180, type: 'Veg', description: 'Exotic black currant and berry ice cream sundae with sweet berry coulis' },
  { name: 'Honey Moon Ice Cream', category: 'Ice Creams', price: 180, type: 'Veg', description: 'Premium vanilla and butterscotch scoops topped with natural honey and nuts' },
  { name: 'All In One Ice Cream', category: 'Ice Creams', price: 240, type: 'Veg', description: 'Grand sundae featuring multi-flavour ice cream scoops, fudge, and toppings' },
  { name: '3 in One Ice Cream', category: 'Ice Creams', price: 220, type: 'Veg', description: 'Trio of classic ice cream scoops served with chocolate syrup and cherries' },
  { name: 'Melody Ice Cream', category: 'Ice Creams', price: 200, type: 'Veg', description: 'Velvety chocolate and vanilla sundae loaded with fudge and chocolate drops' },
  { name: 'Crunchy Choco Ice Cream', category: 'Ice Creams', price: 220, type: 'Veg', description: 'Decadent chocolate ice cream topped with crunchy choco chips and syrup' },

  // ==========================================
  // 20. Desserts (Page 4)
  // ==========================================
  { name: 'Basanti', category: 'Desserts', price: 100, type: 'Veg', description: 'Traditional chilled sweet rabdi dessert infused with saffron and cardamom' },
  { name: 'Brownie', category: 'Desserts', price: 79, type: 'Veg', description: 'Rich fudge chocolate brownie baked to soft gooey perfection' },
  { name: 'Brownie with Vanilla', category: 'Desserts', price: 139, type: 'Veg', description: 'Warm chocolate brownie served with a scoop of creamy vanilla ice cream' },
  { name: 'Brownie Choco Dip', category: 'Desserts', price: 149, type: 'Veg', description: 'Decadent brownie drenched in warm melted dark chocolate ganache' },
  { name: 'DBC (Death By Chocolate)', category: 'Desserts', price: 200, type: 'Veg', description: 'Loaded chocolate sundae with warm brownie, fudge ice cream, and chocolate sauce' },
  { name: 'Gulab Jamun with Vanilla', category: 'Desserts', price: 220, type: 'Veg', description: 'Warm golden fried gulab jamuns served with a scoop of vanilla ice cream' },

  // ==========================================
  // 21. Combos (Page 5)
  // ==========================================
  { name: '2 Burgers (Veg / NV) Combo', category: 'Combos', price: 100, type: 'Non-Veg', description: 'Combo meal with 2 delicious burgers of your choice (Veg or Non-Veg)' },
  { name: '2 Veg/NV Burgers + 1 Mocktail Combo', category: 'Combos', price: 159, type: 'Non-Veg', description: 'Meal combo of 2 burgers served with 1 refreshing cool mocktail' },
  { name: '1 Leg Piece + 1 Thigh Piece Combo', category: 'Combos', price: 170, type: 'Non-Veg', description: 'Crispy fried chicken combo featuring 1 leg piece and 1 juicy thigh piece' },
  { name: '2 Leg Piece + 2 Thigh Piece Combo', category: 'Combos', price: 349, type: 'Non-Veg', description: 'Chicken feast combo with 2 crunchy leg pieces and 2 succulent thigh pieces' },
  { name: '4 Wings + 1 Full Popcorn Combo', category: 'Combos', price: 300, type: 'Non-Veg', description: 'Crispy snack combo of 4 crunchy chicken wings and 1 full chicken popcorn' },
  { name: '1 Burger + 1 Wrap + 6 Strips + 250ml Coke Combo', category: 'Combos', price: 329, type: 'Non-Veg', description: 'Loaded meal with 1 burger, 1 wrap, 6 chicken strips, and 250ml Coca-Cola' },
  { name: '3 Lollipop + 3 Strips + 3 Wings + 250ml Coke Combo', category: 'Combos', price: 369, type: 'Non-Veg', description: 'Party snack combo of 3 chicken lollipops, 3 strips, 3 wings, and 250ml Coke' },
  { name: '2 Legs + 2 Strips + 2 Thighs + 2 Lollipop + 2 Wings + 250ml Coke Combo', category: 'Combos', price: 520, type: 'Non-Veg', description: 'Mega platter with 2 legs, 2 strips, 2 thighs, 2 lollipops, 2 wings, and 250ml Coke' },
  { name: '4 Wings + 3 Lollipop + 3 Leg Pieces Combo', category: 'Combos', price: 559, type: 'Non-Veg', description: 'Jumbo fried chicken bucket with 4 wings, 3 lollipops, and 3 crispy leg pieces' },
  { name: '12 Wings Combo', category: 'Combos', price: 299, type: 'Non-Veg', description: 'Value pack of 12 crispy fried seasoned chicken wings' },

  // ==========================================
  // 22. Fried Chicken Specials (Pieces) (Page 5)
  // ==========================================
  { name: 'Chicken Wings (4 Pc)', category: 'Fried Chicken Specials', price: 129, type: 'Non-Veg', description: 'Crispy seasoned golden fried chicken wings (4 pcs)' },
  { name: 'Chicken Wings (8 Pc)', category: 'Fried Chicken Specials', price: 230, type: 'Non-Veg', description: 'Crispy seasoned golden fried chicken wings (8 pcs)' },
  { name: 'Chicken Wings (12 Pc)', category: 'Fried Chicken Specials', price: 299, type: 'Non-Veg', description: 'Crispy seasoned golden fried chicken wings (12 pcs)' },
  { name: 'Chicken Lollipop (4 Pc)', category: 'Fried Chicken Specials', price: 189, type: 'Non-Veg', description: 'Golden fried crunchy chicken lollipops (4 pcs)' },
  { name: 'Chicken Lollipop (8 Pc)', category: 'Fried Chicken Specials', price: 349, type: 'Non-Veg', description: 'Golden fried crunchy chicken lollipops (8 pcs)' },
  { name: 'Chicken Lollipop (12 Pc)', category: 'Fried Chicken Specials', price: 429, type: 'Non-Veg', description: 'Golden fried crunchy chicken lollipops (12 pcs)' },
  { name: 'Chicken Thigh (1 Pc)', category: 'Fried Chicken Specials', price: 89, type: 'Non-Veg', description: 'Succulent crispy battered fried chicken thigh (1 pc)' },
  { name: 'Chicken Thigh (2 Pc)', category: 'Fried Chicken Specials', price: 179, type: 'Non-Veg', description: 'Succulent crispy battered fried chicken thigh (2 pcs)' },
  { name: 'Chicken Thigh (4 Pc)', category: 'Fried Chicken Specials', price: 350, type: 'Non-Veg', description: 'Succulent crispy battered fried chicken thigh (4 pcs)' },
  { name: 'Chicken Leg (1 Pc)', category: 'Fried Chicken Specials', price: 89, type: 'Non-Veg', description: 'Classic crunchy batter-fried juicy chicken drumstick leg (1 pc)' },
  { name: 'Chicken Leg (2 Pc)', category: 'Fried Chicken Specials', price: 179, type: 'Non-Veg', description: 'Classic crunchy batter-fried juicy chicken drumstick leg (2 pcs)' },
  { name: 'Chicken Leg (4 Pc)', category: 'Fried Chicken Specials', price: 350, type: 'Non-Veg', description: 'Classic crunchy batter-fried juicy chicken drumstick leg (4 pcs)' }
];

async function generateVirajCafeAndSeedDb() {
  console.log('====================================================');
  console.log('  VIRAJ CAFE - SPREADSHEET & DATABASE GENERATION     ');
  console.log('====================================================\n');

  // 1. Generate Excel (.xlsx)
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MS Billings Restaurant Management System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Menu Items', {
    views: [{ showGridLines: true }]
  });

  worksheet.columns = [
    { header: 'Name', key: 'name', width: 36 },
    { header: 'Category', key: 'category', width: 24 },
    { header: 'Price', key: 'price', width: 14 },
    { header: 'Type', key: 'type', width: 14 },
    { header: 'Description', key: 'description', width: 70 },
    { header: 'Is Available', key: 'isAvailable', width: 16 },
    { header: 'Tax Rate', key: 'taxRate', width: 12 },
    { header: 'Image URL', key: 'image', width: 30 }
  ];

  VIRAJ_MENU_ITEMS.forEach(item => {
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

  const outputXlsx = path.join(process.cwd(), 'Viraj_Cafe_Menu_Bulk_Import.xlsx');
  await workbook.xlsx.writeFile(outputXlsx);
  console.log(`✅ Successfully generated Excel file: ${outputXlsx}`);

  // Also save a copy on Desktop for easy user access
  const desktopFile = 'C:\\Users\\busar\\Desktop\\Viraj_Cafe_Menu_Bulk_Import.xlsx';
  try {
    await workbook.xlsx.writeFile(desktopFile);
    console.log(`✅ Saved copy to Desktop: ${desktopFile}`);
  } catch (err) {
    console.warn('Could not save to Desktop:', err.message);
  }

  // 2. Generate CSV (.csv)
  const outputCsv = path.join(process.cwd(), 'Viraj_Cafe_Menu_Bulk_Import.csv');
  const csvHeaders = ['Name', 'Category', 'Price', 'Type', 'Description', 'Is Available', 'Tax Rate', 'Image URL'];
  const csvRows = [csvHeaders.join(',')];

  VIRAJ_MENU_ITEMS.forEach(item => {
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

  // 3. Connect to MongoDB to provision SuperAdmin client & tenant database
  const superAdminUri = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0';
  const tenantDbName = 'client_virajcafe_db';
  const tenantUri = superAdminUri.replace('/mscurechain?', `/${tenantDbName}?`);

  const shopEmail = 'viswaskafe@gmail.com';
  const shopPhone = '7095124976';
  const shopPassword = 'Viraj@2026';
  const licenseKey = 'MSBILL-VIRAJ-CAFE-PRODDATUR-2026';
  const validUntil = new Date('2126-12-31T23:59:59Z');
  const shopAddress = 'Opposite Sagar restaurant, Gandhi road, Proddatur 516360';

  console.log('\n--- 3. Provisioning SuperAdmin Client & License ---');
  await mongoose.connect(superAdminUri);
  const Client = mongoose.connection.collection('clients');
  const License = mongoose.connection.collection('licenses');

  const clientDoc = {
    restaurantName: 'Viraj Cafe',
    ownerName: 'Viswas',
    email: shopEmail,
    phone: shopPhone,
    plainTextPassword: shopPassword,
    licenseKey: licenseKey,
    databaseName: tenantDbName,
    status: 'Active',
    hardwareId: null, // Exempt from HWID lock
    plan: 'Lifetime Premium',
    location: {
      address: shopAddress,
      city: 'Proddatur',
      postalCode: '516360',
      region: 'Andhra Pradesh',
      country: 'India'
    },
    features: {
      kds: true,
      inventory: true,
      crm: true,
      staff: true,
      analytics: true,
      daybook: true,
      qrcode: true,
      delivery: true,
      expenses: true
    },
    staffAccounts: [
      { role: 'Admin', username: shopEmail, plainTextPassword: shopPassword },
      { role: 'Admin', username: 'virajcafe', plainTextPassword: shopPassword },
      { role: 'Admin', username: 'admin', plainTextPassword: shopPassword },
      { role: 'Cashier', username: 'cashier', plainTextPassword: shopPassword },
      { role: 'Captain', username: 'captain', plainTextPassword: shopPassword }
    ],
    updatedAt: new Date()
  };

  const existingClient = await Client.findOne({ email: shopEmail });
  let clientId;
  if (!existingClient) {
    clientDoc.createdAt = new Date();
    const result = await Client.insertOne(clientDoc);
    clientId = result.insertedId;
    console.log('✅ Created new SuperAdmin Client record for Viraj Cafe');
  } else {
    clientId = existingClient._id;
    await Client.updateOne({ _id: clientId }, { $set: clientDoc });
    console.log('✅ Updated existing SuperAdmin Client record for Viraj Cafe');
  }

  // Provision License
  await License.updateOne(
    { key: licenseKey },
    {
      $set: {
        key: licenseKey,
        client: clientId,
        plan: 'Lifetime Premium',
        validUntil: validUntil,
        status: 'active',
        updatedAt: new Date()
      },
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true }
  );
  console.log('✅ SuperAdmin License provisioned successfully');
  await mongoose.disconnect();

  // 4. Seed Tenant Database
  console.log(`\n--- 4. Seeding Tenant DB (${tenantDbName}) ---`);
  await mongoose.connect(tenantUri);
  const db = mongoose.connection;

  // Update restaurant settings
  await db.collection('settings').updateOne(
    { key: 'restaurantSettings' },
    {
      $set: {
        'value.restaurantName': 'Viraj Cafe',
        'value.restaurantType': 'Café & Restaurant',
        'value.ownerName': 'Viswas',
        'value.address': shopAddress,
        'value.city': 'Proddatur',
        'value.pincode': '516360',
        'value.phone': shopPhone,
        'value.whatsappNumber': shopPhone,
        'value.secondaryPhone': shopPhone,
        'value.email': shopEmail,
        'value.gstin': ''
      }
    },
    { upsert: true }
  );

  // Seed Users
  const hashedPassword = await bcrypt.hash(shopPassword, 10);
  const usersToSeed = [
    { username: shopEmail, role: 'Admin' },
    { username: 'virajcafe', role: 'Admin' },
    { username: 'admin', role: 'Admin' },
    { username: 'cashier', role: 'Cashier' },
    { username: 'captain', role: 'Captain' }
  ];

  for (const u of usersToSeed) {
    await db.collection('users').updateOne(
      { username: u.username },
      {
        $set: {
          username: u.username,
          password: hashedPassword,
          role: u.role,
          activeSessions: [],
          updatedAt: new Date()
        },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );
  }
  console.log('✅ Tenant users provisioned (Admin, Cashier, Captain)');

  // Seed Categories
  const categoryCollection = db.collection('categories');
  const uniqueCategories = [...new Set(VIRAJ_MENU_ITEMS.map(i => i.category))];
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

  // Ensure all categories have valid IDs in map
  const allCats = await categoryCollection.find({}).toArray();
  allCats.forEach(c => categoryMap.set(c.name, c._id));

  // Seed Menu Items
  const menuCollection = db.collection('menus');
  let inserted = 0;
  let updated = 0;

  for (const item of VIRAJ_MENU_ITEMS) {
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

  console.log(`✅ Menu items seeded: ${inserted} inserted, ${updated} updated (Total: ${VIRAJ_MENU_ITEMS.length} items across ${uniqueCategories.length} categories)`);
  await mongoose.disconnect();

  console.log('\n====================================================');
  console.log('   VIRAJ CAFE CREDENTIALS & SPREADSHEETS COMPLETE!   ');
  console.log('====================================================');
  console.log('Restaurant Name  : Viraj Cafe');
  console.log('Database Name    : client_virajcafe_db');
  console.log('Email / Username : viswaskafe@gmail.com');
  console.log('Password         : Viraj@2026');
  console.log('Phone Number     : 7095124976');
  console.log('Address          : Opposite Sagar restaurant, Gandhi road, Proddatur 516360');
  console.log('License Key      : MSBILL-VIRAJ-CAFE-PRODDATUR-2026');
  console.log('Valid Until      : Lifetime (2126)');
  console.log('----------------------------------------------------');
  console.log('POS Login Accounts:');
  console.log('  1. viswaskafe@gmail.com | Password: Viraj@2026 (Admin)');
  console.log('  2. virajcafe            | Password: Viraj@2026 (Admin)');
  console.log('  3. admin                | Password: Viraj@2026 (Admin)');
  console.log('  4. cashier              | Password: Viraj@2026 (Cashier)');
  console.log('  5. captain              | Password: Viraj@2026 (Captain)');
  console.log('----------------------------------------------------');
  console.log('Excel Files Created:');
  console.log('  • Viraj_Cafe_Menu_Bulk_Import.xlsx');
  console.log('  • Viraj_Cafe_Menu_Bulk_Import.csv');
  console.log('  • Saved copy to Desktop: C:\\Users\\busar\\Desktop\\Viraj_Cafe_Menu_Bulk_Import.xlsx');
  console.log('====================================================');
}

generateVirajCafeAndSeedDb().catch(err => {
  console.error('❌ Error executing script:', err);
  process.exit(1);
});
