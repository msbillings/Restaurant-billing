import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { PHOTO_IDS_150 } from './prepare_pool.js';

// 150 Real, Distinct Restaurant Menu Items
const MENU_ITEMS = [
  // --- 1. SOUPS (10) ---
  { name: "Cream of Tomato Soup", category: "Soups", price: 130, type: "Veg", description: "Velvety roasted red vine tomato soup topped with golden butter croutons and fresh cream" },
  { name: "Sweet Corn Veg Soup", category: "Soups", price: 130, type: "Veg", description: "Delicate Chinese style broth simmered with tender sweet corn kernels and minced vegetables" },
  { name: "Hot and Sour Veg Soup", category: "Soups", price: 140, type: "Veg", description: "Spicy and tangy oriental broth loaded with shredded cabbage, carrots, and button mushrooms" },
  { name: "Veg Manchow Soup", category: "Soups", price: 140, type: "Veg", description: "Classic dark soy ginger broth packed with chopped vegetables and served with crispy fried noodles" },
  { name: "Cream of Wild Mushroom Soup", category: "Soups", price: 150, type: "Veg", description: "Earthy sauteed button mushrooms pureed in garlic herb butter and double cream" },
  { name: "Chicken Sweet Corn Soup", category: "Soups", price: 160, type: "Non-Veg", description: "Silky egg ribbon broth with shredded chicken breast, crushed sweet corn, and white pepper" },
  { name: "Chicken Manchow Soup", category: "Soups", price: 170, type: "Non-Veg", description: "Spicy Indo-Chinese chicken broth with ginger, garlic, coriander, and crispy noodle topping" },
  { name: "Chicken Hot and Sour Soup", category: "Soups", price: 170, type: "Non-Veg", description: "Hearty chicken soup accented with chili oil, dark vinegar, bamboo shoots, and mushrooms" },
  { name: "Mutton Paya Shorba", category: "Soups", price: 210, type: "Non-Veg", description: "Traditional slow-cooked lamb trotter bone broth infused with whole spices and fresh mint" },
  { name: "Lemon Coriander Chicken Soup", category: "Soups", price: 160, type: "Non-Veg", description: "Refreshing zesty clear soup infused with crushed coriander stalks, lemon juice, and chicken" },

  // --- 2. VEG STARTERS (20) ---
  { name: "Tandoori Paneer Tikka", category: "Veg Starters", price: 260, type: "Veg", description: "Succulent cottage cheese cubes marinated in mustard oil, ajwain, and Kashmiri chili, roasted in clay oven" },
  { name: "Paneer Malai Tikka", category: "Veg Starters", price: 280, type: "Veg", description: "Cottage cheese squares steeped in rich cashew cream, cardamom, and cheese, chargrilled to perfection" },
  { name: "Achari Paneer Tikka", category: "Veg Starters", price: 270, type: "Veg", description: "Tangy pickled spiced paneer cubes grilled over charcoal with bell peppers and Spanish onions" },
  { name: "Crispy Corn Salt and Pepper", category: "Veg Starters", price: 210, type: "Veg", description: "Crunchy golden fried American sweet corn tossed with spring onions, garlic, and cracked black pepper" },
  { name: "Veg Manchurian Dry", category: "Veg Starters", price: 220, type: "Veg", description: "Crispy vegetable dumplings wok-tossed in pungent ginger, garlic, green chili, and dark soy sauce" },
  { name: "Chilli Paneer Dry", category: "Veg Starters", price: 250, type: "Veg", description: "Batter-fried paneer cubes tossed in fiery Schezwan wok with bell peppers, onions, and green chilies" },
  { name: "Crispy Gobi 65", category: "Veg Starters", price: 190, type: "Veg", description: "Crispy battered cauliflower florets tempered with aromatic curry leaves, green chilies, and yogurt dip" },
  { name: "Baby Corn Manchurian Dry", category: "Veg Starters", price: 220, type: "Veg", description: "Crisp fried tender baby corn fingers glazed in spicy garlic scallion sauce" },
  { name: "Hara Bhara Kebab", category: "Veg Starters", price: 230, type: "Veg", description: "Healthy shallow-fried patties crafted with spinach, green peas, mashed potato, and aromatic herbs" },
  { name: "Dahi Ke Kebab", category: "Veg Starters", price: 260, type: "Veg", description: "Melt-in-mouth golden patties made from hung curd, crushed spices, and fresh coriander" },
  { name: "Crispy Veg Spring Rolls", category: "Veg Starters", price: 210, type: "Veg", description: "Golden crispy pastry rolls stuffed with shredded vegetables and served with sweet chili dip" },
  { name: "Kurkure Stuffed Mushroom", category: "Veg Starters", price: 250, type: "Veg", description: "Button mushrooms stuffed with spiced cheese and spinach, crumb-coated and deep fried crisp" },
  { name: "Cheese Corn Croquettes", category: "Veg Starters", price: 230, type: "Veg", description: "Golden crumbed croquettes bursting with melted mozzarella cheese, sweet corn, and herbs" },
  { name: "Veg Seekh Kebab", category: "Veg Starters", price: 240, type: "Veg", description: "Minced mixed vegetables and roasted gram flour seasoned with royal cumin and cooked on skewers" },
  { name: "Tandoori Soya Chaap", category: "Veg Starters", price: 240, type: "Veg", description: "Juicy soya chaap ribs infused with tandoori masala and charred in traditional tandoor oven" },
  { name: "Malai Soya Chaap", category: "Veg Starters", price: 260, type: "Veg", description: "Creamy chargrilled soya chaap rolled in rich clotted cream, black pepper, and cashew paste" },
  { name: "Honey Chilli Potato", category: "Veg Starters", price: 200, type: "Veg", description: "Crisp potato fingers glazed with natural honey, spicy red chili paste, and toasted sesame seeds" },
  { name: "Crispy Fried Baby Corn", category: "Veg Starters", price: 210, type: "Veg", description: "Crunchy batter fried baby corn tossed with dry spices and curry leaves" },
  { name: "Steamed Veg Momos (8 Pcs)", category: "Veg Starters", price: 160, type: "Veg", description: "Delicate Tibetan dumplings stuffed with cabbage, carrot, and onion, served with spicy red chutney" },
  { name: "Paneer 65 South Special", category: "Veg Starters", price: 250, type: "Veg", description: "Spicy South Indian style fried paneer tossed with curd, curry leaves, and crushed red chilies" },

  // --- 3. NON-VEG STARTERS & TANDOOR (25) ---
  { name: "Classic Tandoori Chicken (Full)", category: "Non-Veg Starters", price: 480, type: "Non-Veg", description: "Whole chicken steeped in Kashmiri red chili yogurt marinade, skewered and roasted in clay oven" },
  { name: "Murgh Tikka Kebab", category: "Non-Veg Starters", price: 310, type: "Non-Veg", description: "Tender boneless chicken morsels steeped in spicy yogurt marinade and charbroiled over coals" },
  { name: "Murgh Malai Kebab", category: "Non-Veg Starters", price: 330, type: "Non-Veg", description: "Velvety chicken chunks marinated in cream cheese, green cardamom, and garlic, flame roasted" },
  { name: "Chicken Seekh Kebab", category: "Non-Veg Starters", price: 320, type: "Non-Veg", description: "Spiced chicken mince infused with fresh mint, coriander, and garam masala, grilled on skewers" },
  { name: "Hyderabadi Chicken 65", category: "Non-Veg Starters", price: 290, type: "Non-Veg", description: "Authentic spicy deep-fried chicken cubes tossed with curry leaves, mustard seeds, and yogurt glaze" },
  { name: "Chilli Chicken Dry", category: "Non-Veg Starters", price: 290, type: "Non-Veg", description: "Wok-seared diced chicken tossed with crisp green peppers, onions, soy sauce, and fresh chilies" },
  { name: "Chicken Lollipop (6 Pcs)", category: "Non-Veg Starters", price: 280, type: "Non-Veg", description: "Frenched chicken winglets batter-fried crisp and tossed in sweet and fiery Szechuan sauce" },
  { name: "Chicken Majestic", category: "Non-Veg Starters", price: 300, type: "Non-Veg", description: "Crisp chicken tenders cooked with green chilies, mint leaves, and finished in a mild curd sauce" },
  { name: "Tangdi Kebab (3 Pcs)", category: "Non-Veg Starters", price: 330, type: "Non-Veg", description: "Chicken drumsticks stuffed with spiced minced meat, marinated in curd and roasted in clay oven" },
  { name: "Mutton Seekh Kebab", category: "Non-Veg Starters", price: 390, type: "Non-Veg", description: "Hand-pounded minced lamb blended with royal herbs, skewered and slow-charred over hot coals" },
  { name: "Mutton Galouti Kebab (4 Pcs)", category: "Non-Veg Starters", price: 410, type: "Non-Veg", description: "Royal Awadhi melt-in-mouth minced lamb patties infused with raw papaya and 32 secret spices" },
  { name: "Mutton Boti Kebab", category: "Non-Veg Starters", price: 390, type: "Non-Veg", description: "Boneless lamb cubes marinated in ginger, garlic, raw papaya, and tandoori spices, charbroiled" },
  { name: "Mutton Sukka Fry", category: "Non-Veg Starters", price: 390, type: "Non-Veg", description: "Dry roasted tender goat meat tossed with fresh grated coconut, shallots, and crushed peppercorns" },
  { name: "Tandoori Fish Tikka", category: "Non-Veg Starters", price: 360, type: "Non-Veg", description: "Boneless freshwater fish cubes marinated in carom seeds, yogurt, and mustard oil, clay-baked" },
  { name: "Apollo Fish Fry", category: "Non-Veg Starters", price: 360, type: "Non-Veg", description: "Popular Hyderabadi delicacy made with batter-coated fish fillets tossed in spicy yogurt tempering" },
  { name: "Amritsari Fish Fry", category: "Non-Veg Starters", price: 350, type: "Non-Veg", description: "Punjabi street style crispy gram flour-crusted fish fillets flavored with ajwain and lemon juice" },
  { name: "Chilli Fish Dry", category: "Non-Veg Starters", price: 350, type: "Non-Veg", description: "Crispy fried fish cubes tossed in spicy garlic soy reduction with bell peppers and spring onions" },
  { name: "Golden Fried Butterfly Prawns", category: "Non-Veg Starters", price: 390, type: "Non-Veg", description: "Jumbo prawns butterflied, batter dipped, crumb coated, and deep fried to golden perfection" },
  { name: "Tandoori Jheenga (Prawns)", category: "Non-Veg Starters", price: 420, type: "Non-Veg", description: "Fresh tiger prawns soaked in spiced carom seed marinade and roasted to smoky tenderness" },
  { name: "Loose Prawns Spiced", category: "Non-Veg Starters", price: 380, type: "Non-Veg", description: "Crispy light batter-coated prawns tossed with curry leaves, cracked pepper, and garlic chips" },
  { name: "Murgh Banjara Kebab", category: "Non-Veg Starters", price: 320, type: "Non-Veg", description: "Rustic nomad style spicy roasted chicken chunks coated with crushed coriander seeds and cumin" },
  { name: "Murgh Reshmi Kebab", category: "Non-Veg Starters", price: 330, type: "Non-Veg", description: "Silken chicken mince skewers coated with whisked egg whites and charbroiled till succulent" },
  { name: "Zesty Lemon Chicken", category: "Non-Veg Starters", price: 290, type: "Non-Veg", description: "Tender chicken pieces tossed with fresh lime extract, white pepper, and green chilies" },
  { name: "Fiery Dragon Chicken", category: "Non-Veg Starters", price: 300, type: "Non-Veg", description: "Crispy chicken strips tossed in spicy chili paste, cashews, and shredded ginger-garlic" },
  { name: "Mutton Pepper Fry", category: "Non-Veg Starters", price: 390, type: "Non-Veg", description: "Spicy Kerala style pan-fried tender lamb pieces tossed with freshly crushed Malabar black pepper" },

  // --- 4. MAIN COURSE - VEG (20) ---
  { name: "Paneer Butter Masala", category: "Veg Main Course", price: 280, type: "Veg", description: "Fresh cottage cheese cubes simmered in velvety tomato cream gravy finished with butter and kasuri methi" },
  { name: "Shahi Paneer Royale", category: "Veg Main Course", price: 290, type: "Veg", description: "Royal Mughlai style preparation of paneer cooked in cashew nut and melon seed cream gravy" },
  { name: "Kadai Paneer", category: "Veg Main Course", price: 270, type: "Veg", description: "Paneer cubes and crunchy bell peppers tossed in spicy onion tomato gravy with freshly roasted kadai masala" },
  { name: "Palak Paneer", category: "Veg Main Course", price: 260, type: "Veg", description: "Wholesome spinach puree tempered with garlic, ginger, and cumin, enriched with soft paneer cubes" },
  { name: "Paneer Lababdar", category: "Veg Main Course", price: 290, type: "Veg", description: "Rich tomato onion gravy folded with grated cottage cheese and succulent paneer batons" },
  { name: "Dal Makhani Imperial", category: "Veg Main Course", price: 240, type: "Veg", description: "Whole black urad lentils slow-cooked overnight on tandoor embers with butter, cream, and tomato" },
  { name: "Yellow Dal Tadka", category: "Veg Main Course", price: 190, type: "Veg", description: "Yellow arhar lentils tempered with pure desi ghee, cumin seeds, garlic, dried red chilies, and asafoetida" },
  { name: "Mix Vegetable Curry", category: "Veg Main Course", price: 230, type: "Veg", description: "Carrots, beans, florets, and peas cooked in mildly spiced homestyle onion tomato gravy" },
  { name: "Spicy Veg Kolhapuri", category: "Veg Main Course", price: 240, type: "Veg", description: "Fiery seasonal mixed vegetables braised in thick spicy Kolhapuri masala and roasted coconut paste" },
  { name: "Malai Kofta Curry", category: "Veg Main Course", price: 280, type: "Veg", description: "Delicate paneer and khoya dumplings simmered in luscious saffron-infused cashew cream gravy" },
  { name: "Kaju Paneer Masala", category: "Veg Main Course", price: 310, type: "Veg", description: "Crisp fried whole cashew nuts and fresh paneer batons cooked in decadent butter gravy" },
  { name: "Mushroom Do Pyaza", category: "Veg Main Course", price: 250, type: "Veg", description: "Tender button mushrooms tossed with double the quantity of caramelized shallots and tomato relish" },
  { name: "Aloo Gobi Adraki", category: "Veg Main Course", price: 210, type: "Veg", description: "Homestyle potatoes and cauliflower florets tossed with shredded ginger, cumin, and turmeric" },
  { name: "Amritsari Pindi Chana", category: "Veg Main Course", price: 220, type: "Veg", description: "Dark chickpea curry cooked with roasted anardana (pomegranate seed powder) and Punjabi spices" },
  { name: "Kashmiri Dum Aloo", category: "Veg Main Course", price: 240, type: "Veg", description: "Deep-fried baby potatoes slow-cooked in fennel and dry ginger infused curd gravy without onion or garlic" },
  { name: "Methi Malai Chaman", category: "Veg Main Course", price: 280, type: "Veg", description: "Fresh fenugreek leaves and soft paneer simmered in sweet creamy cashew gravy" },
  { name: "Veg Kadai Masala", category: "Veg Main Course", price: 230, type: "Veg", description: "Mixed garden vegetables wok-seared with crushed coriander seeds and dried red chilies" },
  { name: "Navratan Shahi Korma", category: "Veg Main Course", price: 270, type: "Veg", description: "Nine gem combination of vegetables, fruits, and nuts cooked in rich coconut almond sauce" },
  { name: "Bhindi Do Pyaza", category: "Veg Main Course", price: 210, type: "Veg", description: "Crispy pan-fried ladyfingers tossed with crunchy onion cubes and amchur spice mix" },
  { name: "Paneer Tikka Masala Gravy", category: "Veg Main Course", price: 290, type: "Veg", description: "Clay-oven chargrilled paneer cubes stewed in spicy and tangy roasted onion tomato gravy" },

  // --- 5. MAIN COURSE - NON-VEG (20) ---
  { name: "Murgh Makhani (Butter Chicken)", category: "Non-Veg Main Course", price: 360, type: "Non-Veg", description: "Smoky tandoori chicken pulled and simmered in satin smooth tomato gravy with pure butter and cream" },
  { name: "Chicken Tikka Masala Gravy", category: "Non-Veg Main Course", price: 360, type: "Non-Veg", description: "Chargrilled boneless chicken pieces cooked in thick, spicy onion, bell pepper, and tomato masala" },
  { name: "Kadai Chicken Special", category: "Non-Veg Main Course", price: 340, type: "Non-Veg", description: "Tender chicken cooked with coarsely crushed coriander, bell peppers, and dried red chilies in an iron wok" },
  { name: "Shahi Mughlai Chicken", category: "Non-Veg Main Course", price: 360, type: "Non-Veg", description: "Rich Mughlai delicacy cooked in fragrant cashew almond gravy with a hint of rose water and saffron" },
  { name: "Chettinad Pepper Chicken", category: "Non-Veg Main Course", price: 340, type: "Non-Veg", description: "Fiery South Indian curry with black peppercorns, star anise, curry leaves, and toasted coconut" },
  { name: "Dhaba Style Chicken Curry", category: "Non-Veg Main Course", price: 320, type: "Non-Veg", description: "Highway roadside dhaba style spicy bone-in chicken curry cooked with mustard oil and whole spices" },
  { name: "Murgh Rara Special", category: "Non-Veg Main Course", price: 380, type: "Non-Veg", description: "Chicken pieces slow cooked inside a spicy minced chicken keema gravy infused with cloves and cardamom" },
  { name: "Kolhapuri Chicken Masala", category: "Non-Veg Main Course", price: 340, type: "Non-Veg", description: "Zesty Maharashtrian chicken curry cooked with intensely hot stone-ground Kolhapuri spices" },
  { name: "Kashmiri Mutton Rogan Josh", category: "Non-Veg Main Course", price: 430, type: "Non-Veg", description: "Tender goat meat slow cooked in Kashmiri red chilies, maval flowers, and ratan jot infused gravy" },
  { name: "Homestyle Mutton Curry", category: "Non-Veg Main Course", price: 420, type: "Non-Veg", description: "Tender mutton pieces pressure-cooked in traditional homestyle brown onion and tomato broth" },
  { name: "Bhuna Gosht Karahi", category: "Non-Veg Main Course", price: 440, type: "Non-Veg", description: "Lamb meat pan-fried and braised on low flame in its own juices with dark roasted spices until tender" },
  { name: "Mutton Rara Gosht", category: "Non-Veg Main Course", price: 450, type: "Non-Veg", description: "Juicy mutton chops simmered in rich keema mince gravy flavored with nutmeg and mace" },
  { name: "Rajasthani Laal Maas", category: "Non-Veg Main Course", price: 450, type: "Non-Veg", description: "Royal fiery mutton curry from Rajasthan prepared with Mathania red chilies, garlic, and smoky ghee" },
  { name: "South Indian Fish Curry", category: "Non-Veg Main Course", price: 370, type: "Non-Veg", description: "Fresh catch simmered in tangy tamarind pulp, coconut milk, shallots, and fragrant curry leaves" },
  { name: "Fish Tikka Masala Gravy", category: "Non-Veg Main Course", price: 380, type: "Non-Veg", description: "Smoky tandoori fish chunks smothered in spiced onion-tomato reduction with dried fenugreek" },
  { name: "Goan Fish Curry Coconut", category: "Non-Veg Main Course", price: 380, type: "Non-Veg", description: "Coastal Goan specialty cooked with fresh ground coconut, kokum pods, and spicy peri-peri chillies" },
  { name: "Malabar Prawns Curry", category: "Non-Veg Main Course", price: 420, type: "Non-Veg", description: "Plump fresh prawns bathed in creamy spiced coconut milk, raw mango slices, and mustard seed tempering" },
  { name: "Dhaba Style Egg Curry", category: "Non-Veg Main Course", price: 220, type: "Egg", description: "Crispy fried boiled eggs stewed in robust spicy onion tomato gravy with fresh coriander" },
  { name: "Egg Masala Bhurji Gravy", category: "Non-Veg Main Course", price: 210, type: "Egg", description: "Scrambled eggs cooked with green chillies, ginger, tomatoes, and aromatic whole spices" },
  { name: "Awadhi Murgh Korma", category: "Non-Veg Main Course", price: 360, type: "Non-Veg", description: "Braised chicken cooked in velvety yoghurt and fried onion paste scented with kewra essence" },

  // --- 6. BIRYANI & RICE (15) ---
  { name: "Hyderabadi Chicken Dum Biryani", category: "Biryani & Rice", price: 290, type: "Non-Veg", description: "Aged long-grain basmati rice and marinated chicken cooked on slow 'dum' with saffron, ghee, and mint" },
  { name: "Chicken Fry Piece Biryani", category: "Biryani & Rice", price: 310, type: "Non-Veg", description: "Fragrant biryani rice served with Andhra spiced crispy pan-fried chicken pieces and mirchi ka salan" },
  { name: "Special Boneless Chicken Biryani", category: "Biryani & Rice", price: 330, type: "Non-Veg", description: "Tender succulent boneless chicken tikka tossed with basmati biryani rice and caramelized onions" },
  { name: "Hyderabadi Mutton Dum Biryani", category: "Biryani & Rice", price: 390, type: "Non-Veg", description: "Kachhi mutton layered with raw-spiced tender goat meat and fragrant basmati rice, slow cooked in sealed pot" },
  { name: "Mutton Ghee Roast Biryani", category: "Biryani & Rice", price: 420, type: "Non-Veg", description: "Mangalorean ghee roasted succulent lamb chunks served over rich aromatic biryani rice" },
  { name: "Coastal Prawns Biryani", category: "Biryani & Rice", price: 410, type: "Non-Veg", description: "Marinated juicy tiger prawns layered with saffron rice, caramelized onions, and fresh dill" },
  { name: "Tawa Fish Biryani", category: "Biryani & Rice", price: 380, type: "Non-Veg", description: "Pan-seared spiced fish fillets cooked with fragrant layered basmati rice and mild whole spices" },
  { name: "Nawabi Veg Dum Biryani", category: "Biryani & Rice", price: 240, type: "Veg", description: "Medley of garden fresh vegetables and golden potatoes layered with fragrant saffron basmati rice" },
  { name: "Paneer Tikka Biryani", category: "Biryani & Rice", price: 270, type: "Veg", description: "Smoky tandoor-roasted paneer cubes layered with aromatic spiced rice, mint leaves, and brown onions" },
  { name: "Shahi Kaju Biryani", category: "Biryani & Rice", price: 290, type: "Veg", description: "Crispy roasted whole cashews cooked with aromatic basmati rice, raisins, and pure desi ghee" },
  { name: "Mushroom Biryani Bowl", category: "Biryani & Rice", price: 260, type: "Veg", description: "Earthy button mushrooms cooked in dum style spicy masala layered with seasoned long grain rice" },
  { name: "Egg Dum Biryani", category: "Biryani & Rice", price: 230, type: "Egg", description: "Golden fried boiled eggs nestled inside fragrant biryani rice seasoned with biryani spices" },
  { name: "Fragrant Jeera Rice", category: "Biryani & Rice", price: 160, type: "Veg", description: "Fluffy basmati rice tempered with golden roasted cumin seeds and farm fresh desi ghee" },
  { name: "Traditional Ghee Rice", category: "Biryani & Rice", price: 180, type: "Veg", description: "South Indian style ghee rice cooked with fried onions, cashews, raisins, and whole cloves" },
  { name: "South Indian Curd Rice", category: "Biryani & Rice", price: 140, type: "Veg", description: "Comforting soft cooked rice blended with thick curd, tempered with mustard seeds, ginger, and curry leaves" },

  // --- 7. BREADS & ROTIS (10) ---
  { name: "Tandoori Roti Plain", category: "Breads & Rotis", price: 25, type: "Veg", description: "Traditional whole wheat flatbread freshly baked against clay tandoor walls" },
  { name: "Tandoori Butter Roti", category: "Breads & Rotis", price: 30, type: "Veg", description: "Clay-baked crisp whole wheat roti brushed generously with melted table butter" },
  { name: "Plain Tandoori Naan", category: "Breads & Rotis", price: 40, type: "Veg", description: "Soft and pillowy leavened refined flour bread baked in tandoor" },
  { name: "Classic Butter Naan", category: "Breads & Rotis", price: 50, type: "Veg", description: "Soft multi-layered tandoori naan glazed with creamy churned butter" },
  { name: "Roasted Garlic Naan", category: "Breads & Rotis", price: 65, type: "Veg", description: "Tandoori naan topped with finely minced garlic, fresh coriander leaves, and butter" },
  { name: "Cheese Stuffed Garlic Naan", category: "Breads & Rotis", price: 90, type: "Veg", description: "Decadent naan stuffed with gooey mozzarella cheese and crusted with roasted garlic" },
  { name: "Laccha Paratha Crisp", category: "Breads & Rotis", price: 55, type: "Veg", description: "Multi-layered crispy whole wheat paratha baked in tandoor and brushed with butter" },
  { name: "Pudina Laccha Paratha", category: "Breads & Rotis", price: 60, type: "Veg", description: "Flaky layered paratha infused with dry mint powder and roasted cumin seeds" },
  { name: "Soft Rumali Roti", category: "Breads & Rotis", price: 35, type: "Veg", description: "Ultra-thin, soft handkerchief style bread tossed and cooked over an inverted wok (karahi)" },
  { name: "Amritsari Stuffed Kulcha", category: "Breads & Rotis", price: 80, type: "Veg", description: "Crispy layered kulcha stuffed with spiced mashed potatoes, onions, and pomegranate seeds" },

  // --- 8. CHINESE & WOK (10) ---
  { name: "Classic Veg Fried Rice", category: "Chinese & Wok", price: 200, type: "Veg", description: "Fragrant rice stir-fried in smoking wok with finely diced carrots, beans, and spring onions" },
  { name: "Schezwan Veg Fried Rice", category: "Chinese & Wok", price: 220, type: "Veg", description: "Spicy wok-tossed fried rice infused with pungent homemade red chili Schezwan sauce and garlic" },
  { name: "Egg Fried Rice Wok", category: "Chinese & Wok", price: 230, type: "Egg", description: "Rice stir-fried with scrambled eggs, scallions, black pepper, and light soy sauce" },
  { name: "Chicken Fried Rice", category: "Chinese & Wok", price: 260, type: "Non-Veg", description: "Tender chicken shreds and egg wok-fried with fluffy rice, soy reduction, and green onions" },
  { name: "Schezwan Chicken Fried Rice", category: "Chinese & Wok", price: 270, type: "Non-Veg", description: "Spicy wok-tossed rice with shredded chicken, eggs, and fiery Sichuan chili pepper paste" },
  { name: "Veg Hakka Noodles", category: "Chinese & Wok", price: 200, type: "Veg", description: "Soft noodles tossed with julienned cabbage, bell peppers, carrots, and light seasonings" },
  { name: "Schezwan Veg Noodles", category: "Chinese & Wok", price: 220, type: "Veg", description: "Spicy wok-tossed noodles flavored with red Schezwan sauce, garlic, and fresh celery" },
  { name: "Chicken Hakka Noodles", category: "Chinese & Wok", price: 260, type: "Non-Veg", description: "Wok-fried noodles with seasoned chicken slivers, eggs, and crunchy oriental greens" },
  { name: "Schezwan Chicken Noodles", category: "Chinese & Wok", price: 270, type: "Non-Veg", description: "Fiery noodles tossed with shredded chicken, eggs, crushed red chilies, and scallions" },
  { name: "Chilli Garlic Veg Noodles", category: "Chinese & Wok", price: 210, type: "Veg", description: "Aromatic noodles loaded with golden fried burnt garlic bits and spicy chili oil" },

  // --- 9. DESSERTS & SWEETS (10) ---
  { name: "Warm Gulab Jamun (2 Pcs)", category: "Desserts & Sweets", price: 90, type: "Veg", description: "Golden fried khoya milk dumplings soaked in warm rose and cardamom scented sugar syrup" },
  { name: "Royal Rasmalai (2 Pcs)", category: "Desserts & Sweets", price: 120, type: "Veg", description: "Spongy cottage cheese patties steeped in sweetened thickened saffron milk garnished with pistachio" },
  { name: "Desi Ghee Gajar Ka Halwa", category: "Desserts & Sweets", price: 140, type: "Veg", description: "Slow-cooked grated red Delhi carrots simmered with khoya, mawa, cashew nuts, and pure desi ghee" },
  { name: "Hyderabadi Double Ka Meetha", category: "Desserts & Sweets", price: 120, type: "Veg", description: "Crispy fried bread slices soaked in thickened saffron-infused rabri and topped with sliced almonds" },
  { name: "Royal Shahi Tukda", category: "Desserts & Sweets", price: 130, type: "Veg", description: "Mughlai sweet bread crispies drizzled with cardamom syrup, thick rabri, and silver leaf vark" },
  { name: "Moong Dal Halwa", category: "Desserts & Sweets", price: 150, type: "Veg", description: "Rich traditional winter delicacy made by slow roasting split yellow lentils in pure desi ghee" },
  { name: "Royal Kulfi Falooda", category: "Desserts & Sweets", price: 160, type: "Veg", description: "Dense pistachio kulfi served over cornstarch vermicelli, sweet basil seeds, and fragrant rose syrup" },
  { name: "Matka Malai Kulfi", category: "Desserts & Sweets", price: 110, type: "Veg", description: "Traditional slow-boiled milk ice cream flavored with saffron and nuts, set in authentic clay pot" },
  { name: "Sizzling Chocolate Brownie", category: "Desserts & Sweets", price: 180, type: "Veg", description: "Hot walnut brownie served on a cast-iron sizzler plate topped with vanilla ice cream and warm fudge" },
  { name: "Alphonso Mango Kulfi", category: "Desserts & Sweets", price: 120, type: "Veg", description: "Creamy Indian ice cream prepared with pure Ratnagiri Alphonso mango pulp and condensed milk" },

  // --- 10. BEVERAGES & COOLERS (10) ---
  { name: "Punjabi Sweet Lassi", category: "Beverages", price: 90, type: "Veg", description: "Thick hand-churned yogurt beverage sweetened and finished with a dollop of fresh clotted cream (malai)" },
  { name: "Alphonso Mango Lassi", category: "Beverages", price: 110, type: "Veg", description: "Rich refreshing blend of curd and fragrant sweet Alphonso mango puree topped with chopped pistachios" },
  { name: "Spiced Masala Chaas", category: "Beverages", price: 60, type: "Veg", description: "Light salted churned buttermilk infused with roasted cumin, fresh ginger, mint, and black salt" },
  { name: "Fresh Lime Soda Sweet and Salt", category: "Beverages", price: 70, type: "Veg", description: "Freshly squeezed green lime juice mixed with sparkling chilled soda, rock salt, and simple syrup" },
  { name: "Virgin Mint Mojito", category: "Beverages", price: 120, type: "Veg", description: "Muddled fresh garden mint leaves and lime wedges topped with bubbly soda and crushed ice" },
  { name: "Blue Lagoon Cooler", category: "Beverages", price: 130, type: "Veg", description: "Electric blue mocktail crafted with blue curacao citrus syrup, lemon juice, and chilled Sprite" },
  { name: "Cold Coffee with Vanilla Scoop", category: "Beverages", price: 140, type: "Veg", description: "Creamy iced blended coffee crowned with a rich scoop of vanilla ice cream and cocoa dusting" },
  { name: "Kesar Badam Milk Chilled", category: "Beverages", price: 110, type: "Veg", description: "Sweet almond milk infused with pure Kashmiri saffron strands, green cardamom, and slivered almonds" },
  { name: "Kulhad Masala Chai", category: "Beverages", price: 50, type: "Veg", description: "Strong Indian milk tea brewed with crushed ginger, green cardamom, and cinnamon, served in clay kulhad" },
  { name: "Watermelon Mint Cooler", category: "Beverages", price: 110, type: "Veg", description: "Freshly cold-pressed sweet watermelon juice infused with crushed mint leaves and black rock salt" }
];

// Extract 150 strictly unique photo IDs
const uniquePool = [...new Set(PHOTO_IDS_150)];
if (uniquePool.length < 150) {
  console.error(`Not enough unique photo IDs! Need 150, have ${uniquePool.length}`);
  process.exit(1);
}

// Assign unique photo ID to each item (1-to-1 mapping)
const ITEMS = MENU_ITEMS.map((item, idx) => {
  const photoId = uniquePool[idx];
  return {
    ...item,
    photoId,
    imageUrl: `https://images.unsplash.com/${photoId}?w=500&auto=format&fit=crop&q=80`
  };
});

// STRICT VALIDATIONS
console.log(`Verifying ${ITEMS.length} items...`);
if (ITEMS.length !== 150) {
  console.error(`ERROR: Expected 150 items, but got ${ITEMS.length}!`);
  process.exit(1);
}

// 1. Verify 150 unique names
const nameSet = new Set(ITEMS.map(i => i.name.trim().toLowerCase()));
if (nameSet.size !== 150) {
  console.error(`ERROR: Duplicate names detected! Unique count: ${nameSet.size}/150`);
  process.exit(1);
}

// 2. Verify 150 unique photo IDs / image URLs
const urlSet = new Set(ITEMS.map(i => i.imageUrl));
if (urlSet.size !== 150) {
  console.error(`ERROR: Duplicate image URLs detected! Unique count: ${urlSet.size}/150`);
  process.exit(1);
}

console.log(`✅ VERIFIED: All 150 Item Names are 100% UNIQUE.`);
console.log(`✅ VERIFIED: All 150 Image URLs are 100% UNIQUE.`);

async function generate() {
  console.log('\nCreating Excel Workbook with styling and embedded image previews...');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MS Billings Restaurant Management System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Menu Items', {
    views: [{ showGridLines: true }]
  });

  // Define columns matching MS Billings Bulk Import specification
  worksheet.columns = [
    { header: 'Name', key: 'name', width: 34 },
    { header: 'Category', key: 'category', width: 24 },
    { header: 'Price', key: 'price', width: 14 },
    { header: 'Type', key: 'type', width: 14 },
    { header: 'Description', key: 'description', width: 56 },
    { header: 'Is Available', key: 'isAvailable', width: 16 },
    { header: 'Tax Rate', key: 'taxRate', width: 12 },
    { header: 'Image URL', key: 'image', width: 72 },
  ];

  // Populate data rows
  ITEMS.forEach(item => {
    worksheet.addRow({
      name: item.name,
      category: item.category,
      price: item.price,
      type: item.type,
      description: item.description,
      isAvailable: 'TRUE',
      taxRate: 5,
      image: item.imageUrl
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

  // Style Data Rows (Zebra striped with alternating light warm fill)
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.height = 26;
    const isEven = rowNumber % 2 === 0;
    const rowBgColor = isEven ? 'FFF7ED' : 'FFFFFF';

    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Segoe UI', size: 10, color: { argb: '1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FED7AA' } },
        bottom: { style: 'thin', color: { argb: 'FED7AA' } },
        left: { style: 'thin', color: { argb: 'FED7AA' } },
        right: { style: 'thin', color: { argb: 'FED7AA' } }
      };

      if (colNumber === 1) { // Item Name
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: '0F172A' } };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else if (colNumber === 3 || colNumber === 7) { // Price & Tax
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else if (colNumber === 4 || colNumber === 6) { // Type & Is Available
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  });

  // Save in Project Workspace Root
  const workspaceFile = 'd:\\restaurant\\Restaurant-billing\\MS_Billings_150_Menu_Items.xlsx';
  await workbook.xlsx.writeFile(workspaceFile);
  console.log(`✅ Saved master Excel file to: ${workspaceFile}`);

  // Also save a copy on Desktop for easy drag & drop
  const desktopFile = 'C:\\Users\\busar\\Desktop\\MS_Billings_150_Menu_Items.xlsx';
  try {
    await workbook.xlsx.writeFile(desktopFile);
    console.log(`✅ Saved copy to Desktop: ${desktopFile}`);
  } catch (err) {
    console.warn('Could not save to Desktop:', err.message);
  }

  // Also export as CSV format in workspace root
  const csvFile = 'd:\\restaurant\\Restaurant-billing\\MS_Billings_150_Menu_Items.csv';
  await workbook.csv.writeFile(csvFile);
  console.log(`✅ Saved CSV format to: ${csvFile}`);

  console.log('\nAll 150 items successfully generated with 100% unique names and image URLs!');
  process.exit(0);
}

generate();
