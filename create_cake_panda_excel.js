import ExcelJS from './Backend/node_modules/exceljs/excel.js';
import fs from 'fs';
import path from 'path';

// Complete transcribed menu items from all 3 menu card images
const ALL_MENU_ITEMS = [
  // ==========================================
  // IMAGE 1: STARTERS (Crispy · Spicy · Delicious)
  // ==========================================

  // --- Chicken Starters ---
  { name: 'Hot & Pepper Chicken', category: 'Chicken Starters', price: 240, type: 'Non-Veg', description: 'Tender chicken bites tossed with freshly cracked black pepper and fiery red chillies' },
  { name: 'Red Hot Chicken', category: 'Chicken Starters', price: 230, type: 'Non-Veg', description: 'Crispy fried chicken wok-tossed in a vibrant spicy red chilli sauce' },
  { name: 'Slice Chicken', category: 'Chicken Starters', price: 250, type: 'Non-Veg', description: 'Thinly sliced tender chicken breast glazed with aromatic oriental sauces' },
  { name: 'Bhutan Chicken', category: 'Chicken Starters', price: 260, type: 'Non-Veg', description: 'Specialty Himalayan-style spicy chicken tossed with dry red chillies and scallions' },
  { name: 'Pepper Chicken', category: 'Chicken Starters', price: 230, type: 'Non-Veg', description: 'Traditional South Indian style chicken dry fry coated in crushed black peppercorns and curry leaves' },
  { name: 'Szechuan Chicken', category: 'Chicken Starters', price: 260, type: 'Non-Veg', description: 'Wok-tossed chicken chunks in pungent Szechuan chilli paste with bell peppers' },
  { name: 'Basket Chicken', category: 'Chicken Starters', price: 290, type: 'Non-Veg', description: 'Crispy golden fried chicken served in a crunchy fried basket with house dips' },

  // --- Fish Starters ---
  { name: 'Fish Finger', category: 'Fish Starters', price: 250, type: 'Non-Veg', description: 'Crumb-coated boneless fish fingers fried to golden perfection, served with tartar dip' },
  { name: 'Ginger Fish', category: 'Fish Starters', price: 260, type: 'Non-Veg', description: 'Fresh fish fillets tossed in aromatic ginger glaze with green chillies and spring onions' },
  { name: 'Hong Kong Fish', category: 'Fish Starters', price: 270, type: 'Non-Veg', description: 'Crisp batter-fried fish tossed in sweet, tangy, and mildly spicy Hong Kong sauce' },
  { name: 'Apollo Fish', category: 'Fish Starters', price: 250, type: 'Non-Veg', description: 'Hyderabadi classic boneless fish tossed in spiced yoghurt tempering with curry leaves' },
  { name: 'Szechuan Fish', category: 'Fish Starters', price: 270, type: 'Non-Veg', description: 'Tender fish cubes tossed in spicy Szechuan sauce with garlic and bell peppers' },

  // --- Prawns Starters ---
  { name: 'Salt & Pepper Prawns', category: 'Prawns Starters', price: 250, type: 'Non-Veg', description: 'Crispy fried prawns seasoned with sea salt, crushed white pepper, and spring onions' },
  { name: 'Loose Prawns', category: 'Prawns Starters', price: 240, type: 'Non-Veg', description: 'Crisp light-battered succulent prawns tossed with onions, green chillies, and curry leaves' },
  { name: 'Chilli Prawns', category: 'Prawns Starters', price: 250, type: 'Non-Veg', description: 'Batter-fried prawns wok-glazed in fiery soy chilli garlic sauce' },
  { name: 'Prawns Manchurian', category: 'Prawns Starters', price: 240, type: 'Non-Veg', description: 'Crispy prawns tossed in classic dark soy, ginger, and garlic Manchurian sauce' },
  { name: 'Prawns 65', category: 'Prawns Starters', price: 250, type: 'Non-Veg', description: 'Juicy prawns marinated in South Indian spices and deep fried crisp' },
  { name: 'Golden Fried Prawns', category: 'Prawns Starters', price: 260, type: 'Non-Veg', description: 'Golden butterflied prawns crumb-coated and deep fried until super crunchy' },
  { name: 'Szechuan Prawns', category: 'Prawns Starters', price: 280, type: 'Non-Veg', description: 'Plump prawns sautéed in authentic spicy Szechuan pepper sauce' },

  // --- Veg · Paneer · Mushroom Starters ---
  { name: 'Veg Shangri-La', category: 'Veg Starters', price: 230, type: 'Veg', description: 'Exotic mixed vegetables tossed in sweet and spicy oriental Shangri-La sauce' },
  { name: 'Veg 65', category: 'Veg Starters', price: 200, type: 'Veg', description: 'Crisp fried mixed vegetable fritters tempered with yoghurt and curry leaves' },
  { name: 'Veg Chilli', category: 'Veg Starters', price: 200, type: 'Veg', description: 'Crispy vegetable dumplings tossed with capsicum, onion, and green chillies' },
  { name: 'Veg Manchurian', category: 'Veg Starters', price: 200, type: 'Veg', description: 'Classic vegetable balls deep-fried and glazed in ginger garlic soy reduction' },
  { name: 'Gobi Manchurian', category: 'Veg Starters', price: 200, type: 'Veg', description: 'Cauliflower florets batter-fried crisp and tossed in dark soy Manchurian gravy' },
  { name: 'Gobi Chilli', category: 'Veg Starters', price: 230, type: 'Veg', description: 'Crispy fried cauliflower florets tossed with onions and spicy green chillies' },
  { name: 'Baby Corn Manchurian', category: 'Veg Starters', price: 240, type: 'Veg', description: 'Tender baby corn fingers batter-fried and glazed in savoury Manchurian sauce' },
  { name: 'Baby Corn 65', category: 'Veg Starters', price: 230, type: 'Veg', description: 'Crunchy baby corn tossed in spicy South Indian 65 tempering' },
  { name: 'Baby Corn Chilli', category: 'Veg Starters', price: 240, type: 'Veg', description: 'Golden baby corn wok-tossed with capsicum, onion, and oriental chilli sauce' },
  { name: 'Golden Fried Baby Corn', category: 'Veg Starters', price: 200, type: 'Veg', description: 'Crunchy battered baby corn fried to golden perfection with house dip' },
  { name: 'Crispy Corn', category: 'Veg Starters', price: 200, type: 'Veg', description: 'Crisp fried sweet corn kernels tossed with spices, onion, and lemon juice' },
  { name: 'Paneer Dragon', category: 'Veg Starters', price: 230, type: 'Veg', description: 'Paneer fingers coated in fiery red chilli dragon sauce and roasted sesame' },
  { name: 'Paneer Chilli', category: 'Veg Starters', price: 230, type: 'Veg', description: 'Cottage cheese cubes tossed in spicy chilli soy reduction with bell peppers' },
  { name: 'Paneer 65', category: 'Veg Starters', price: 220, type: 'Veg', description: 'Spiced paneer cubes deep-fried and tossed with tempered curry leaves' },
  { name: 'Paneer Manchurian', category: 'Veg Starters', price: 260, type: 'Veg', description: 'Crispy paneer cubes tossed in garlic, ginger, and scallion Manchurian sauce' },
  { name: 'Paneer Basket', category: 'Veg Starters', price: 240, type: 'Veg', description: 'Crispy spiced cottage cheese fingers served in a crunchy fried edible basket' },
  { name: 'Pepper Paneer', category: 'Veg Starters', price: 240, type: 'Veg', description: 'Fresh paneer cubes dry-tossed in robust crushed black peppercorn seasoning' },
  { name: 'Mushroom Manchurian', category: 'Veg Starters', price: 220, type: 'Veg', description: 'Fresh button mushrooms fried crisp and tossed in dark soy Manchurian glaze' },
  { name: 'Mushroom Chilli', category: 'Veg Starters', price: 230, type: 'Veg', description: 'Juicy button mushrooms wok-seared with green chillies, onions, and capsicum' },
  { name: 'Mushroom 65', category: 'Veg Starters', price: 220, type: 'Veg', description: 'Battered button mushrooms deep-fried with aromatic Indian 65 spices' },
  { name: 'Mushroom Pepper', category: 'Veg Starters', price: 240, type: 'Veg', description: 'Whole button mushrooms sautéed with fresh ground black pepper and curry leaves' },
  { name: 'Mushroom Hot & Pepper', category: 'Veg Starters', price: 240, type: 'Veg', description: 'Spicy button mushrooms tossed in hot chilli sauce and black peppercorns' },

  // ==========================================
  // IMAGE 2: THE CAKE PANDA (Cakes, Pastries, Donuts, Buns)
  // ==========================================

  // --- Butter Cream Cakes (1/2 Kg & 1 Kg) ---
  { name: 'Vanilla Butter Cream Cake (1/2 Kg)', category: 'Butter Cream Cakes', price: 200, type: 'Veg', description: 'Soft vanilla sponge layered with velvety smooth vanilla buttercream' },
  { name: 'Vanilla Butter Cream Cake (1 Kg)', category: 'Butter Cream Cakes', price: 370, type: 'Veg', description: 'Classic vanilla celebration sponge frosted with rich vanilla buttercream' },
  { name: 'Pineapple Butter Cream Cake (1/2 Kg)', category: 'Butter Cream Cakes', price: 200, type: 'Veg', description: 'Fresh pineapple infused sponge layered with juicy pineapple buttercream' },
  { name: 'Pineapple Butter Cream Cake (1 Kg)', category: 'Butter Cream Cakes', price: 370, type: 'Veg', description: 'Tangy-sweet pineapple compote buttercream cake for celebrations' },
  { name: 'Strawberry Butter Cream Cake (1/2 Kg)', category: 'Butter Cream Cakes', price: 200, type: 'Veg', description: 'Pink strawberry sponge iced with delicious sweet strawberry buttercream' },
  { name: 'Strawberry Butter Cream Cake (1 Kg)', category: 'Butter Cream Cakes', price: 370, type: 'Veg', description: 'Fragrant strawberry cream layered celebration cake' },
  { name: 'Black Currant Butter Cream Cake (1/2 Kg)', category: 'Butter Cream Cakes', price: 200, type: 'Veg', description: 'Zesty purple black currant sponge filled with berry buttercream' },
  { name: 'Black Currant Butter Cream Cake (1 Kg)', category: 'Butter Cream Cakes', price: 400, type: 'Veg', description: 'Rich black currant buttercream celebration cake' },
  { name: 'Butter Scotch Butter Cream Cake (1/2 Kg)', category: 'Butter Cream Cakes', price: 200, type: 'Veg', description: 'Moist caramel sponge frosted with butterscotch buttercream and crunchy praline' },
  { name: 'Butter Scotch Butter Cream Cake (1 Kg)', category: 'Butter Cream Cakes', price: 400, type: 'Veg', description: 'Rich butterscotch celebration cake topped with crunchy caramel praline' },
  { name: 'Chocolate Butter Cream Cake (1/2 Kg)', category: 'Butter Cream Cakes', price: 200, type: 'Veg', description: 'Decadent cocoa sponge layered with luscious chocolate buttercream' },
  { name: 'Chocolate Butter Cream Cake (1 Kg)', category: 'Butter Cream Cakes', price: 420, type: 'Veg', description: 'Rich chocolate sponge with chocolate fudge buttercream frosting' },
  { name: 'Honey Butter Cream Cake (1/2 Kg)', category: 'Butter Cream Cakes', price: 200, type: 'Veg', description: 'Traditional honey-soaked sponge cake with buttercream and jam glaze' },
  { name: 'Honey Butter Cream Cake (1 Kg)', category: 'Butter Cream Cakes', price: 420, type: 'Veg', description: 'Sweet natural honey-soaked sponge cake frosted with vanilla buttercream' },

  // --- Pastry Cakes (600g & 1 Kg) ---
  { name: 'Vanilla Pastry Cake (600g)', category: 'Pastry Cakes', price: 300, type: 'Veg', description: 'Fluffy vanilla sponge layered with light dairy whipped cream' },
  { name: 'Vanilla Pastry Cake (1 Kg)', category: 'Pastry Cakes', price: 500, type: 'Veg', description: 'Soft vanilla sponge dressed with fresh whipped cream and white chocolate shavings' },
  { name: 'Pineapple Pastry Cake (600g)', category: 'Pastry Cakes', price: 350, type: 'Veg', description: 'Fresh pineapple pulp and cherries layered with light dairy cream' },
  { name: 'Pineapple Pastry Cake (1 Kg)', category: 'Pastry Cakes', price: 500, type: 'Veg', description: 'Tropical pineapple gateau topped with fresh pineapple slices and cherries' },
  { name: 'Strawberry Pastry Cake (600g)', category: 'Pastry Cakes', price: 350, type: 'Veg', description: 'Airy sponge with strawberry compote and pink whipped cream' },
  { name: 'Strawberry Pastry Cake (1 Kg)', category: 'Pastry Cakes', price: 500, type: 'Veg', description: 'Lush strawberry gateau layered with real fruit filling and cream' },
  { name: 'Butter Scotch Pastry Cake (600g)', category: 'Pastry Cakes', price: 350, type: 'Veg', description: 'Caramel sponge with crunchy nougat nuts and butterscotch cream' },
  { name: 'Butter Scotch Pastry Cake (1 Kg)', category: 'Pastry Cakes', price: 550, type: 'Veg', description: 'Celebration butterscotch gateau loaded with crunchy butterscotch bits' },
  { name: 'Black Currant Pastry Cake (600g)', category: 'Pastry Cakes', price: 350, type: 'Veg', description: 'Wild black currant fruit crush layered with fresh whipped cream' },
  { name: 'Black Currant Pastry Cake (1 Kg)', category: 'Pastry Cakes', price: 600, type: 'Veg', description: 'Rich berry gateau garnished with purple glaze and white chocolate curls' },
  { name: 'White Forest Pastry Cake (600g)', category: 'Pastry Cakes', price: 350, type: 'Veg', description: 'Vanilla sponge soaked with cherry syrup, whipped cream, and white chocolate curls' },
  { name: 'White Forest Pastry Cake (1 Kg)', category: 'Pastry Cakes', price: 600, type: 'Veg', description: 'Classic German white forest cake with red cherries and white chocolate shavings' },
  { name: 'Black Forest Pastry Cake (600g)', category: 'Pastry Cakes', price: 400, type: 'Veg', description: 'Rich dark chocolate sponge, cherry filling, and dark chocolate flakes' },
  { name: 'Black Forest Pastry Cake (1 Kg)', category: 'Pastry Cakes', price: 700, type: 'Veg', description: 'Authentic Black Forest gateau with layers of whipped cream, cherries, and dark chocolate' },
  { name: 'Chocolate Truffle Pastry Cake (600g)', category: 'Pastry Cakes', price: 400, type: 'Veg', description: 'Decadent dark chocolate ganache layered with moist chocolate fudge sponge' },
  { name: 'Chocolate Truffle Pastry Cake (1 Kg)', category: 'Pastry Cakes', price: 750, type: 'Veg', description: 'Pure Belgian dark chocolate ganache glaze over moist chocolate sponge' },
  { name: 'Red Velvet Pastry Cake (600g)', category: 'Pastry Cakes', price: 400, type: 'Veg', description: 'Crimson cocoa sponge layered with velvety cream cheese frosting' },
  { name: 'Red Velvet Pastry Cake (1 Kg)', category: 'Pastry Cakes', price: 750, type: 'Veg', description: 'Signature crimson red velvet sponge with rich cream cheese and crumb topping' },
  { name: 'Choco Chip Pastry Cake (600g)', category: 'Pastry Cakes', price: 450, type: 'Veg', description: 'Chocolate sponge loaded with semi-sweet chocolate chips and chocolate cream' },
  { name: 'Choco Chip Pastry Cake (1 Kg)', category: 'Pastry Cakes', price: 800, type: 'Veg', description: 'Rich chocolate gateau bursting with crunchy dark chocolate chips' },
  { name: 'Honey Almond Pastry Cake (600g)', category: 'Pastry Cakes', price: 450, type: 'Veg', description: 'Delicate honey soaked sponge layered with toasted roasted almond slivers' },
  { name: 'Honey Almond Pastry Cake (1 Kg)', category: 'Pastry Cakes', price: 800, type: 'Veg', description: 'Premium celebration cake topped with caramelized roasted California almonds' },
  { name: 'KitKat Pastry Cake (600g)', category: 'Pastry Cakes', price: 500, type: 'Veg', description: 'Chocolate sponge frosted with chocolate truffle and ringed with KitKat bars' },
  { name: 'KitKat Pastry Cake (1 Kg)', category: 'Pastry Cakes', price: 1000, type: 'Veg', description: 'Loaded chocolate celebration cake topped and bordered with crunchy KitKat wafers' },
  { name: 'Fresh Fruit Cake (600g)', category: 'Pastry Cakes', price: 500, type: 'Veg', description: 'Vanilla sponge generously topped with fresh seasonal kiwi, apple, grapes, and oranges' },
  { name: 'Fresh Fruit Cake (1 Kg)', category: 'Pastry Cakes', price: 1000, type: 'Veg', description: 'Exotic seasonal fruit gateau glazed in natural fruit glaze and fresh whipped cream' },
  { name: 'Dry Fruit Cake (600g)', category: 'Pastry Cakes', price: 500, type: 'Veg', description: 'Rich spiced sponge loaded with cashews, almonds, pistachios, and raisins' },
  { name: 'Dry Fruit Cake (1 Kg)', category: 'Pastry Cakes', price: 1000, type: 'Veg', description: 'Premium royal dry fruit cake packed with crunchy dry nuts' },
  { name: 'Rasmalai Cake (600g)', category: 'Pastry Cakes', price: 500, type: 'Veg', description: 'Indian fusion cake soaked in saffron cardamom rabri with spongy rasmalai pieces' },
  { name: 'Rasmalai Cake (1 Kg)', category: 'Pastry Cakes', price: 1000, type: 'Veg', description: 'Royal Indian fusion cake loaded with juicy rasmalai, saffron cream, and pistachios' },
  { name: 'Rainbow Cake (600g)', category: 'Pastry Cakes', price: 500, type: 'Veg', description: 'Vibrant multi-colored sponge layers frosted with light vanilla cream' },
  { name: 'Rainbow Cake (1 Kg)', category: 'Pastry Cakes', price: 1000, type: 'Veg', description: 'Stunning 6-layered colorful sponge celebration cake with white vanilla frosting' },
  { name: 'Chocolate Overloaded Cake (600g)', category: 'Pastry Cakes', price: 500, type: 'Veg', description: 'Overloaded with chocolate truffles, brownies, choco chips, and chocolate drizzle' },
  { name: 'Chocolate Overloaded Cake (1 Kg)', category: 'Pastry Cakes', price: 1000, type: 'Veg', description: 'The ultimate chocolate lovers dream cake loaded with truffles and toppings' },

  // --- New Add-Ons (Buns & Bakery Specials) ---
  { name: 'Blue Berry Cream Bun', category: 'Buns & Bakery Specials', price: 25, type: 'Veg', description: 'Soft golden bun stuffed with sweet blueberry cream filling' },
  { name: 'Pineapple Cream Bun', category: 'Buns & Bakery Specials', price: 20, type: 'Veg', description: 'Fluffy fresh baked bun with delicious pineapple cream core' },
  { name: 'Butterscotch Cream Bun', category: 'Buns & Bakery Specials', price: 20, type: 'Veg', description: 'Sweet bakery bun filled with butterscotch cream and crunch' },
  { name: 'Strawberry Cream Bun', category: 'Buns & Bakery Specials', price: 20, type: 'Veg', description: 'Soft bun packed with fragrant strawberry cream' },
  { name: 'Chocolate Cream Bun', category: 'Buns & Bakery Specials', price: 20, type: 'Veg', description: 'Fresh oven-baked bun filled with smooth chocolate cream' },
  { name: 'Kova Bun', category: 'Buns & Bakery Specials', price: 20, type: 'Veg', description: 'Traditional South bakery bun filled with sweetened milk kova/khoya' },
  { name: 'Lava Cake', category: 'Buns & Bakery Specials', price: 50, type: 'Veg', description: 'Warm chocolate mini cake with an oozing hot melted chocolate lava centre' },
  { name: 'Brownie Cake', category: 'Buns & Bakery Specials', price: 50, type: 'Veg', description: 'Fudgy cocoa brownie square packed with walnuts and chocolate chunks' },
  { name: 'Kova Dil Pasand', category: 'Buns & Bakery Specials', price: 80, type: 'Veg', description: 'Traditional flaky puff pastry stuffed with sweet kova, tutty fruity, and dry coconut' },

  // --- Pastry Pieces (Single Slices) ---
  { name: 'Vanilla Pastry (Piece)', category: 'Pastry Slices', price: 50, type: 'Veg', description: 'Single portion slice of fresh vanilla cream pastry' },
  { name: 'Pineapple Pastry (Piece)', category: 'Pastry Slices', price: 50, type: 'Veg', description: 'Single portion slice of tropical pineapple cream pastry' },
  { name: 'Butter Scotch Pastry (Piece)', category: 'Pastry Slices', price: 50, type: 'Veg', description: 'Single portion slice of crunchy butterscotch pastry' },
  { name: 'Strawberry Pastry (Piece)', category: 'Pastry Slices', price: 50, type: 'Veg', description: 'Single portion slice of pink strawberry cream pastry' },
  { name: 'Black Currant Pastry (Piece)', category: 'Pastry Slices', price: 50, type: 'Veg', description: 'Single portion slice of tangy sweet black currant pastry' },
  { name: 'Kiwi Pastry (Piece)', category: 'Pastry Slices', price: 50, type: 'Veg', description: 'Single portion slice of exotic kiwi fruit pastry' },
  { name: 'Chocolate Truffle Pastry (Piece)', category: 'Pastry Slices', price: 60, type: 'Veg', description: 'Single portion slice of rich dark chocolate ganache truffle pastry' },
  { name: 'Honey Almond Pastry (Piece)', category: 'Pastry Slices', price: 60, type: 'Veg', description: 'Single portion slice of honey soaked pastry with roasted almonds' },
  { name: 'White Forest Pastry (Piece)', category: 'Pastry Slices', price: 60, type: 'Veg', description: 'Single portion slice of white chocolate and cherry pastry' },
  { name: 'Black Forest Pastry (Piece)', category: 'Pastry Slices', price: 60, type: 'Veg', description: 'Single portion slice of classic Black Forest gateau' },
  { name: 'KitKat Pastry (Piece)', category: 'Pastry Slices', price: 60, type: 'Veg', description: 'Single portion slice of chocolate pastry topped with KitKat crunch' },
  { name: 'Red Velvet Pastry (Piece)', category: 'Pastry Slices', price: 60, type: 'Veg', description: 'Single portion slice of scarlet red velvet with cream cheese' },
  { name: 'Rasa Malai Pastry (Piece)', category: 'Pastry Slices', price: 60, type: 'Veg', description: 'Single portion slice of royal saffron rasmalai fusion pastry' },
  { name: 'Rainbow Cake (Piece)', category: 'Pastry Slices', price: 70, type: 'Veg', description: 'Single portion slice of vibrant 6-layer rainbow cake' },
  { name: 'Chocolate Overloaded Pastry (Piece)', category: 'Pastry Slices', price: 70, type: 'Veg', description: 'Single portion slice loaded with assorted chocolates and fudge' },

  // --- Jar Cakes ---
  { name: 'Pineapple Jar Cake', category: 'Jar Cakes', price: 50, type: 'Veg', description: 'Layered fresh pineapple sponge and cream served in a reusable dessert jar' },
  { name: 'Red Velvet Jar Cake', category: 'Jar Cakes', price: 60, type: 'Veg', description: 'Layers of crimson red velvet sponge and cream cheese in a dessert jar' },
  { name: 'Black Forest Jar Cake', category: 'Jar Cakes', price: 60, type: 'Veg', description: 'Layers of chocolate sponge, red cherries, and whipped cream in a jar' },

  // --- Donuts ---
  { name: 'Chocolate Donut', category: 'Donuts', price: 40, type: 'Veg', description: 'Soft ring donut dipped in dark chocolate glaze' },
  { name: 'Milk Chocolate Donut', category: 'Donuts', price: 40, type: 'Veg', description: 'Fresh yeast donut coated in creamy milk chocolate glaze' },
  { name: 'White Chocolate Donut', category: 'Donuts', price: 40, type: 'Veg', description: 'Fluffy donut coated in sweet white chocolate ganache' },
  { name: 'Butterscotch Donut', category: 'Donuts', price: 40, type: 'Veg', description: 'Ring donut glazed with butterscotch caramel drizzle' },
  { name: 'Strawberry Donut', category: 'Donuts', price: 40, type: 'Veg', description: 'Sweet donut dipped in pink strawberry chocolate glaze' },
  { name: 'Choco Chip Donut', category: 'Donuts', price: 45, type: 'Veg', description: 'Chocolate glazed donut sprinkled with dark chocolate chips' },
  { name: 'White Choco Chip Donut', category: 'Donuts', price: 45, type: 'Veg', description: 'White chocolate glazed donut topped with crunchy white choco chips' },
  { name: 'Almond Donut', category: 'Donuts', price: 45, type: 'Veg', description: 'Glazed ring donut topped with toasted sliced California almonds' },

  // --- Fondant Cakes ---
  { name: 'Fondant Cool Cake (1 Kg)', category: 'Fondant Cakes', price: 1300, type: 'Veg', description: 'Theme-based custom designer cake sculpted with smooth sugar fondant' },
  { name: 'Normal Fondant Cake (1 Kg)', category: 'Fondant Cakes', price: 1200, type: 'Veg', description: 'Standard designer celebration cake covered with handcrafted fondant' },

  // --- Extra Add-Ons (Cakes) ---
  { name: 'Eggless Cake Add-On', category: 'Cake Customization', price: 100, type: 'Veg', description: 'Upgrade cake preparation to 100% vegetarian eggless sponge' },
  { name: 'Step Cake Add-On', category: 'Cake Customization', price: 100, type: 'Veg', description: '2-tier or multi-tier tiered step cake arrangement fee' },
  { name: 'Garnishing Add-On', category: 'Cake Customization', price: 100, type: 'Veg', description: 'Special chocolate collars, edible glitter, and decorative toppers' },
  { name: 'Custom Shape Add-On', category: 'Cake Customization', price: 200, type: 'Veg', description: 'Heart, numeral, or character shaped sponge crafting fee' },
  { name: 'Edible Photo Print Add-On', category: 'Cake Customization', price: 200, type: 'Veg', description: 'High resolution edible sugar sheet customized photo topper' },
  { name: 'Custom Drawing Add-On', category: 'Cake Customization', price: 200, type: 'Veg', description: 'Handcrafted artist piping drawing and gel art on cake' },

  // ==========================================
  // IMAGE 3: THE CAKE PANDA (Pizza, Burgers, Sandwiches, Fries, Hot Dogs, Puffs, Cookies)
  // ==========================================

  // --- Pizzas (Small & Medium) ---
  { name: 'Chicken Pizza (Small)', category: 'Pizzas', price: 140, type: 'Non-Veg', description: 'Hand-stretched personal pizza topped with seasoned chicken cubes and mozzarella' },
  { name: 'Chicken Pizza (Medium)', category: 'Pizzas', price: 190, type: 'Non-Veg', description: 'Medium pizza loaded with seasoned shredded chicken, bell peppers, and melted cheese' },
  { name: 'BBQ Chicken Pizza (Small)', category: 'Pizzas', price: 140, type: 'Non-Veg', description: 'Personal pizza topped with smokey BBQ chicken, red onions, and mozzarella' },
  { name: 'BBQ Chicken Pizza (Medium)', category: 'Pizzas', price: 190, type: 'Non-Veg', description: 'Medium pizza with smokey barbecue chicken chunks, onions, and gooey cheese' },
  { name: 'Butter Chicken Pizza (Small)', category: 'Pizzas', price: 140, type: 'Non-Veg', description: 'Fusion pizza with rich butter chicken makhani gravy, chicken tikka, and cheese' },
  { name: 'Butter Chicken Pizza (Medium)', category: 'Pizzas', price: 190, type: 'Non-Veg', description: 'Medium fusion pizza layered with creamy makhani sauce and tandoori chicken' },
  { name: 'Fried Chicken Pizza (Small)', category: 'Pizzas', price: 140, type: 'Non-Veg', description: 'Personal pizza topped with crispy popcorn chicken nuggets and mozzarella' },
  { name: 'Fried Chicken Pizza (Medium)', category: 'Pizzas', price: 190, type: 'Non-Veg', description: 'Medium pizza loaded with crunchy batter-fried chicken bits and herbs' },
  { name: 'Cheese Corn Pizza (Small)', category: 'Pizzas', price: 140, type: 'Veg', description: 'Crisp crust loaded with sweet golden corn kernels and double mozzarella cheese' },
  { name: 'Cheese Corn Pizza (Medium)', category: 'Pizzas', price: 190, type: 'Veg', description: 'Medium pizza bursting with juicy sweet corn and stretchy mozzarella cheese' },
  { name: 'Paneer Pizza (Small)', category: 'Pizzas', price: 140, type: 'Veg', description: 'Personal pizza topped with spiced marinated paneer cubes, capsicum, and cheese' },
  { name: 'Paneer Pizza (Medium)', category: 'Pizzas', price: 190, type: 'Veg', description: 'Medium pizza loaded with tandoori spiced cottage cheese, onions, and cheese' },
  { name: 'Mushroom Pizza (Small)', category: 'Pizzas', price: 140, type: 'Veg', description: 'Personal pizza topped with seasoned button mushrooms, oregano, and cheese' },
  { name: 'Mushroom Pizza (Medium)', category: 'Pizzas', price: 190, type: 'Veg', description: 'Medium pizza topped with sautéed button mushrooms, herbs, and mozzarella' },
  { name: 'Cheese Pizza (Small)', category: 'Pizzas', price: 140, type: 'Veg', description: 'Classic personal Margherita pizza with rich tomato sauce and mozzarella' },
  { name: 'Cheese Pizza (Medium)', category: 'Pizzas', price: 190, type: 'Veg', description: 'Medium classic cheese pizza with 100% real stretchy mozzarella cheese' },
  { name: 'Veg Masala Pizza (Small)', category: 'Pizzas', price: 90, type: 'Veg', description: 'Desi spiced pizza topped with spiced tomato sauce, chopped veggies, and cheese' },
  { name: 'Veg Masala Pizza (Medium)', category: 'Pizzas', price: 140, type: 'Veg', description: 'Medium Indian-style spiced vegetable pizza with onions, tomatoes, and cheese' },

  // --- Burgers ---
  { name: 'Veg Burger', category: 'Burgers', price: 80, type: 'Veg', description: 'Crispy spiced vegetable patty nestled in a toasted bun with mayo and lettuce' },
  { name: 'Chicken Burger', category: 'Burgers', price: 100, type: 'Non-Veg', description: 'Juicy golden chicken patty topped with fresh cabbage slaw, mayo, and toasted buns' },
  { name: 'Double Decker Chicken Burger', category: 'Burgers', price: 140, type: 'Non-Veg', description: 'Two succulent chicken patties with double cheese, creamy mayo, and crisp lettuce' },
  { name: 'Paneer Burger', category: 'Burgers', price: 100, type: 'Veg', description: 'Thick grilled spicy paneer patty served with fresh onions, tomato, and tandoori mayo' },

  // --- Sandwiches ---
  { name: 'Chicken Sandwich', category: 'Sandwiches', price: 100, type: 'Non-Veg', description: 'Grilled sandwich stuffed with tender spiced chicken breast and creamy mayo' },
  { name: 'Veg Masala Sandwich', category: 'Sandwiches', price: 80, type: 'Veg', description: 'Street-style grilled sandwich packed with spiced potato masala and green chutney' },
  { name: 'Paneer Sandwich', category: 'Sandwiches', price: 100, type: 'Veg', description: 'Toasted bread loaded with marinated cottage cheese, bell peppers, and cheese' },
  { name: 'Mushroom Sandwich', category: 'Sandwiches', price: 100, type: 'Veg', description: 'Grilled sandwich filled with garlic sautéed button mushrooms and herbs' },
  { name: 'BBQ Chicken Sandwich', category: 'Sandwiches', price: 120, type: 'Non-Veg', description: 'Grilled bread filled with smoky pulled BBQ chicken and caramelized onions' },
  { name: 'Butter Chicken Sandwich', category: 'Sandwiches', price: 120, type: 'Non-Veg', description: 'Decadent grilled sandwich stuffed with creamy butter chicken makhani filling' },
  { name: 'Cheese Corn Sandwich', category: 'Sandwiches', price: 100, type: 'Veg', description: 'Golden toasted bread stuffed with sweet corn and melted mozzarella cheese' },
  { name: 'Veg Classic Sandwich', category: 'Sandwiches', price: 80, type: 'Veg', description: 'Classic cold or toasted sandwich with sliced cucumber, tomato, onion, and butter' },

  // --- Fries & Hot Dogs ---
  { name: 'Plain French Fries', category: 'Fries & Hot Dogs', price: 90, type: 'Veg', description: 'Crispy golden potato french fries sprinkled with sea salt' },
  { name: 'Peri Peri French Fries', category: 'Fries & Hot Dogs', price: 90, type: 'Veg', description: 'Crunchy golden fries dusted in zesty spicy African peri-peri seasoning' },
  { name: 'Chicken Hotdog', category: 'Fries & Hot Dogs', price: 80, type: 'Non-Veg', description: 'Soft hot dog bun filled with chicken sausage, mustard, ketchup, and mayo' },
  { name: 'Paneer Hotdog', category: 'Fries & Hot Dogs', price: 80, type: 'Veg', description: 'Soft hot dog roll filled with spiced grilled paneer finger and tasty sauces' },

  // --- Puffs ---
  { name: 'Egg Puff', category: 'Puffs & Savouries', price: 25, type: 'Non-Veg', description: 'Crispy golden baked flaky puff pastry filled with spiced boiled egg halves' },
  { name: 'Veg Puff', category: 'Puffs & Savouries', price: 20, type: 'Veg', description: 'Flaky golden puff stuffed with aromatic seasoned potatoes, peas, and carrots' },
  { name: 'Gobi Puff', category: 'Puffs & Savouries', price: 25, type: 'Veg', description: 'Crispy baked pastry stuffed with spicy cauliflower masala' },
  { name: 'Paneer Puff', category: 'Puffs & Savouries', price: 30, type: 'Veg', description: 'Layered buttery puff pastry filled with rich spiced paneer bhurji' },
  { name: 'Mushroom Puff', category: 'Puffs & Savouries', price: 30, type: 'Veg', description: 'Golden flaky puff pastry stuffed with peppery button mushroom filling' },
  { name: 'Chicken Puff', category: 'Puffs & Savouries', price: 35, type: 'Non-Veg', description: 'Crispy bakery puff pastry packed with delicious spiced chicken mince' },

  // --- Cookies (250g Packets) ---
  { name: 'Elaichi Crunch Cookies (250g)', category: 'Bakery Cookies', price: 80, type: 'Veg', description: 'Traditional aromatic green cardamom flavored crispy butter cookies (250g)' },
  { name: 'Badam Cookies (250g)', category: 'Bakery Cookies', price: 80, type: 'Veg', description: 'Nutty, rich baked cookies embedded with roasted almond bits (250g)' },
  { name: 'Ragi Cookies (250g)', category: 'Bakery Cookies', price: 80, type: 'Veg', description: 'Healthy and wholesome finger millet cookies sweetened naturally (250g)' },
  { name: 'Salt Cookies (250g)', category: 'Bakery Cookies', price: 80, type: 'Veg', description: 'Classic tea-time sweet and savoury salted butter biscuits (250g)' },
  { name: 'Bournvita Cookies (250g)', category: 'Bakery Cookies', price: 80, type: 'Veg', description: 'Malted chocolate cookies packed with crunchy Bournvita goodness (250g)' },
  { name: 'Chocolate Cookies (250g)', category: 'Bakery Cookies', price: 80, type: 'Veg', description: 'Double dark cocoa cookies baked to crispy crunch (250g)' },
  { name: 'Vamu Cookies (250g)', category: 'Bakery Cookies', price: 80, type: 'Veg', description: 'Digestive and savoury ajwain (carom seed) spiced tea-time biscuits (250g)' },
  { name: 'Almond Sticks (250g)', category: 'Bakery Cookies', price: 80, type: 'Veg', description: 'Crisp baked buttery cookie sticks encrusted with toasted almonds (250g)' },
  { name: 'Butter Cookies (250g)', category: 'Bakery Cookies', price: 80, type: 'Veg', description: 'Melt-in-the-mouth golden butter cookies baked to perfection (250g)' },

  // --- Fast Food Extra Add-Ons ---
  { name: 'Extra Chicken Add-On', category: 'Snack Add-Ons', price: 20, type: 'Non-Veg', description: 'Extra portion of seasoned shredded chicken topping' },
  { name: 'Extra Paneer Add-On', category: 'Snack Add-Ons', price: 20, type: 'Veg', description: 'Extra portion of fresh cottage cheese cubes' },
  { name: 'Extra Cheese Add-On', category: 'Snack Add-Ons', price: 20, type: 'Veg', description: 'Extra layer of melted gooey mozzarella cheese' },
  { name: 'Extra Mayo Add-On', category: 'Snack Add-Ons', price: 20, type: 'Veg', description: 'Extra dip / dollop of creamy garlic mayonnaise' },
  { name: 'Extra Olives Add-On', category: 'Snack Add-Ons', price: 20, type: 'Veg', description: 'Extra sliced Spanish black olives topping' }
];

async function generateMenuFiles() {
  console.log(`Generating files for ${ALL_MENU_ITEMS.length} menu items...`);

  // 1. Generate Excel (.xlsx)
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MS Billings';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Cake Panda Menu', {
    views: [{ showGridLines: true }]
  });

  worksheet.columns = [
    { header: 'Name', key: 'name', width: 36 },
    { header: 'Category', key: 'category', width: 26 },
    { header: 'Price', key: 'price', width: 14 },
    { header: 'Type', key: 'type', width: 14 },
    { header: 'Description', key: 'description', width: 65 },
    { header: 'Is Available', key: 'isAvailable', width: 16 },
    { header: 'Tax Rate', key: 'taxRate', width: 12 },
    { header: 'Image URL', key: 'image', width: 30 }
  ];

  ALL_MENU_ITEMS.forEach(item => {
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
  headerRow.height = 30;
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

      // Alignment rules
      if (colNumber === 1 || colNumber === 5) {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else if (colNumber === 3) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0.00';
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }

      // Format Veg / Non-Veg column
      if (colNumber === 4) {
        if (cell.value === 'Veg') {
          cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: '16A34A' } };
        } else {
          cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'DC2626' } };
        }
      }
    });
  });

  const outputXlsx = path.join(process.cwd(), 'Cake_Panda_Menu_Bulk_Import.xlsx');
  await workbook.xlsx.writeFile(outputXlsx);
  console.log(`✅ Successfully saved Excel file to: ${outputXlsx}`);

  // 2. Generate CSV (.csv)
  const outputCsv = path.join(process.cwd(), 'Cake_Panda_Menu_Bulk_Import.csv');
  const csvHeaders = ['Name', 'Category', 'Price', 'Type', 'Description', 'Is Available', 'Tax Rate', 'Image URL'];
  
  const csvRows = [csvHeaders.join(',')];
  ALL_MENU_ITEMS.forEach(item => {
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
  console.log(`✅ Successfully saved CSV file to: ${outputCsv}`);
}

generateMenuFiles().catch(err => {
  console.error('Error generating menu files:', err);
  process.exit(1);
});
