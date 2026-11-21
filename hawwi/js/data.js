/* Hawwi seed data (section 8). All names and businesses are fictional. */
(function () {
  'use strict';
  const H = (window.H = window.H || {});

  const CATEGORIES = [
    { id: 'food', emoji: '🍲', grad: ['#F2B66D', '#D9783B'] },
    { id: 'sweets', emoji: '🧁', grad: ['#F7C6D0', '#E58FA6'] },
    { id: 'perfume', emoji: '🌸', grad: ['#C9B6E4', '#8D6BB8'] },
    { id: 'abaya', emoji: '👗', grad: ['#5C5470', '#2B2738'] },
    { id: 'crafts', emoji: '🧶', grad: ['#9ED2C6', '#3E9C8F'] }
  ];

  const EMIRATES = ['dubai', 'sharjah', 'ajman', 'abudhabi', 'rak', 'fujairah'];

  const GRADIENTS = {
    saffron: ['#F6C760', '#D98A1F'],
    palm: ['#3F8F75', '#0F5B4D'],
    rose: ['#F4B6C2', '#D9668A'],
    oud: ['#8C6A52', '#4A3327'],
    lavender: ['#CDB8EA', '#7E5BB5'],
    sea: ['#8FD3E0', '#1E7F86'],
    night: ['#5C5470', '#22202D'],
    sand: ['#F1DFC0', '#C9A46C']
  };

  /* Businesses */
  const BIZ = [
    ['b01', 'مطبخ أم سعيد', "Um Saeed's Kitchen", 'food', 'أم سعيد', 'Um Saeed', 'dubai', 'البرشاء', 'Al Barsha', '🍲', 'saffron', 4.9, 318, 10, 40, 45, true],
    ['b02', 'حلويات ريم', "Reem's Sweets", 'sweets', 'ريم', 'Reem', 'dubai', 'الخوانيج', 'Al Khawaneej', '🧁', 'rose', 4.8, 212, 15, 60, 60, true],
    ['b03', 'دار العود', 'Dar Al Oud', 'perfume', 'أبو خالد', 'Abu Khalid', 'dubai', 'مردف', 'Mirdif', '🪵', 'oud', 4.7, 156, 12, 80, 30, false],
    ['b04', 'عبايات لمسة', 'Lamsa Abayas', 'abaya', 'شيخة', 'Shaikha', 'dubai', 'جميرا', 'Jumeirah', '👗', 'night', 4.6, 98, 20, 150, 120, false],
    ['b05', 'خبز وسمن', 'Bread & Ghee', 'food', 'أم راشد', 'Um Rashid', 'sharjah', 'الخان', 'Al Khan', '🫓', 'sand', 4.8, 241, 8, 30, 30, false],
    ['b06', 'بخور نسيم', 'Naseem Bakhoor', 'perfume', 'نسيم', 'Naseem', 'sharjah', 'النهدة', 'Al Nahda', '🪔', 'lavender', 4.7, 133, 10, 50, 20, false],
    ['b07', 'غُرزة', 'Ghurza Crafts', 'crafts', 'مريم', 'Maryam', 'sharjah', 'مويلح', 'Muwaileh', '🧶', 'sea', 4.9, 87, 15, 60, 90, true],
    ['b08', 'مطبخ هيا', "Haya's Kitchen", 'food', 'هيا', 'Haya', 'ajman', 'النعيمية', 'Al Nuaimiya', '🥘', 'saffron', 4.6, 174, 7, 35, 40, false],
    ['b09', 'كيكة سلمى', "Salma's Cakes", 'sweets', 'سلمى', 'Salma', 'ajman', 'الروضة', 'Al Rawda', '🎂', 'rose', 4.7, 145, 10, 50, 60, false],
    ['b10', 'مجبوس الوالدة', 'Al Walda Majboos', 'food', 'أم حمد', 'Um Hamad', 'abudhabi', 'مدينة خليفة', 'Khalifa City', '🍛', 'palm', 4.8, 289, 10, 45, 50, true],
    ['b11', 'دخون الدار', 'Dukhoon Al Dar', 'perfume', 'موزة', 'Moza', 'abudhabi', 'المشرف', 'Al Mushrif', '🏺', 'oud', 4.8, 176, 15, 100, 30, true],
    ['b12', 'عبايات مُزن', 'Muzn Abayas', 'abaya', 'مزنة', 'Muzna', 'abudhabi', 'البطين', 'Al Bateen', '🧕', 'night', 4.7, 112, 20, 200, 120, false],
    ['b13', 'طين ونور', 'Teen & Noor', 'crafts', 'نورة', 'Noura', 'rak', 'النخيل', 'Al Nakheel', '🕯️', 'sand', 4.6, 64, null, 0, 60, false],
    ['b14', 'حلويات الفريج', 'Fareej Sweets', 'sweets', 'أم علي', 'Um Ali', 'fujairah', 'الفصيل', 'Al Faseel', '🍯', 'saffron', 4.9, 203, 8, 30, 40, true]
  ];

  const HOURS = {
    b01: [['11:00', '22:00'], ['11:00', '22:00'], ['11:00', '22:00'], ['11:00', '22:00'], ['11:00', '22:00'], ['11:00', '22:00'], ['13:00', '23:00']],
    b02: [['10:00', '21:00'], ['10:00', '21:00'], ['10:00', '21:00'], ['10:00', '21:00'], ['10:00', '21:00'], ['10:00', '21:00'], null],
    b03: [['16:00', '01:00'], ['16:00', '01:00'], ['16:00', '01:00'], ['16:00', '01:00'], ['16:00', '01:00'], ['16:00', '01:00'], ['16:00', '01:00']],
    b04: [['10:00', '20:00'], ['10:00', '20:00'], ['10:00', '20:00'], ['10:00', '20:00'], ['10:00', '20:00'], ['10:00', '22:00'], null],
    b05: [['06:00', '12:00'], ['06:00', '12:00'], ['06:00', '12:00'], ['06:00', '12:00'], ['06:00', '12:00'], ['06:00', '12:00'], ['06:00', '12:00']],
    b06: [['09:00', '22:00'], ['09:00', '22:00'], ['09:00', '22:00'], ['09:00', '22:00'], ['09:00', '22:00'], ['09:00', '22:00'], ['15:00', '22:00']],
    b07: [['12:00', '18:00'], ['10:00', '18:00'], ['10:00', '18:00'], ['10:00', '18:00'], ['10:00', '18:00'], ['10:00', '18:00'], null],
    b08: [['12:00', '22:00'], ['12:00', '22:00'], ['12:00', '22:00'], ['12:00', '22:00'], ['12:00', '22:00'], ['12:00', '22:00'], ['13:00', '22:00']],
    b09: [['09:00', '21:00'], ['09:00', '21:00'], ['09:00', '21:00'], ['09:00', '21:00'], ['09:00', '21:00'], ['09:00', '21:00'], ['14:00', '21:00']],
    b10: [['11:30', '23:00'], ['11:30', '23:00'], ['11:30', '23:00'], ['11:30', '23:00'], ['11:30', '23:00'], ['11:30', '23:00'], ['11:30', '23:00']],
    b11: [['10:00', '22:00'], ['10:00', '22:00'], ['10:00', '22:00'], ['10:00', '22:00'], ['10:00', '22:00'], ['10:00', '22:00'], ['16:00', '23:00']],
    b12: [['10:00', '21:00'], ['10:00', '21:00'], ['10:00', '21:00'], ['10:00', '21:00'], ['10:00', '21:00'], ['10:00', '21:00'], null],
    b13: [['15:00', '21:00'], null, ['15:00', '21:00'], null, ['15:00', '21:00'], ['15:00', '22:00'], null],
    b14: [['14:00', '23:30'], ['14:00', '23:30'], ['14:00', '23:30'], ['14:00', '23:30'], ['14:00', '23:30'], ['14:00', '23:30'], ['14:00', '23:30']]
  };

  const BIOS = {
    b01: ['أكل إماراتي بنفس طعم بيت الأهل، نطبخ كل يوم من الصبح بمكونات طازجة.', 'Emirati home cooking that tastes like family, cooked fresh every morning.', 'مجبوس، هريس، ثريد، majboos, harees, emirati'],
    b02: ['كيك وحلويات بنكهات خليجية: زعفران، هيل، تمر وورد. نجهّز للمناسبات والعزايم.', 'Cakes and sweets with Gulf flavours: saffron, cardamom, dates and rose. Made for gatherings and occasions.', 'كيك، كنافة، cake, kunafa, eid'],
    b03: ['عود ودهن عود مختار بعناية، نخلط ونعبي في البيت بخبرة أكثر من 20 سنة.', 'Carefully selected oud and oud oils, blended and bottled at home with over 20 years of experience.', 'عود، دهن، oud, oil, gift'],
    b04: ['عبايات عصرية بقصّات مريحة، تفصيل حسب المقاس وتطريز بالاسم.', 'Modern abayas with comfortable cuts, made to measure with optional name embroidery.', 'عبايات، شيلة، abaya, shayla'],
    b05: ['فطور إماراتي أصيل: بلاليط، خمير، جباب وكرك بالزعفران، طازج كل صباح.', 'Authentic Emirati breakfast: balaleet, khameer, chebab and saffron karak, fresh every morning.', 'فطور، خمير، كرك، breakfast, karak'],
    b06: ['بخور ومعطرات بيت بخلطات خاصة تخلّي ريحة بيتك تفوح.', 'Bakhoor and home scents in our own blends to make your home smell wonderful.', 'بخور، معطر، bakhoor, spray'],
    b07: ['هدايا مصنوعة يدوياً: تطريز بالأسماء، كروشيه ونسيج سدو بلمسة عصرية.', 'Handmade gifts: name embroidery, crochet and Sadu weaving with a modern touch.', 'تطريز، كروشيه، سدو، embroidery, crochet, sadu'],
    b08: ['أطباق بيتية مشبعة من مطبخ هيا، تكفي العايلة وتفرح الضيوف.', "Hearty home dishes from Haya's kitchen, enough for the family and the guests.", 'برياني، مضروبة، biryani'],
    b09: ['كيك طري وحلى بارد بوصفات سلمى الخاصة، نزيّن حسب طلبك.', "Soft cakes and chilled desserts from Salma's own recipes, decorated the way you like.", 'كيك، براونيز، cake, brownies'],
    b10: ['مجبوس ومندي ومضغوط على أصوله، وصفات الوالدة من أبوظبي.', "Majboos, mandi and madghout done right, mum's recipes from Abu Dhabi.", 'مجبوس، مندي، majboos, mandi'],
    b11: ['دخون ومخمرية بخلطات إماراتية فاخرة، مثالية للهدايا والأعراس.', 'Luxurious Emirati dukhoon and mukhamaria blends, perfect for gifts and weddings.', 'دخون، مخمرية، عرس، dukhoon, wedding'],
    b12: ['عبايات أنيقة للمناسبات واليوم، أقمشة مختارة وتشطيب يدوي.', 'Elegant abayas for occasions and everyday, with selected fabrics and hand finishing.', 'عبايات، مناسبات، abaya, occasion'],
    b13: ['شموع معطّرة وفخار مرسوم باليد من رأس الخيمة.', 'Scented candles and hand-painted pottery from Ras Al Khaimah.', 'شموع، فخار، candles, pottery'],
    b14: ['لقيمات وخنفروش وحلويات الفريج زي ما كانت جدّاتنا يسوونها.', 'Luqaimat, khanfaroosh and neighbourhood sweets just like our grandmothers made.', 'لقيمات، خنفروش، luqaimat']
  };

  /* Option group helpers: S = single required, M = multi (optional max) */
  const S = (ar, en, choices) => ({ type: 'single', required: true, nameAr: ar, nameEn: en, choices });
  const M = (ar, en, choices, max) => ({ type: 'multi', required: false, nameAr: ar, nameEn: en, choices, max: max || undefined });
  const SIZE_B04 = () => S('المقاس', 'Size', [['52', '52', 0], ['54', '54', 0], ['56', '56', 0], ['58', '58', 20]]);
  const SIZE_B12 = () => S('المقاس', 'Size', [['50', '50', 0], ['52', '52', 0], ['54', '54', 0], ['56', '56', 0], ['58', '58', 25]]);
  const ADDONS_MAJ = () => M('إضافات', 'Add-ons', [['دقوس إضافي', 'Extra daqoos', 3], ['سلطة خضراء', 'Green salad', 8], ['لبن', 'Laban', 4]], 3);
  const GIFT = () => M('إضافات', 'Extras', [['تغليف هدية', 'Gift wrap', 15]]);

  /* [id, nameAr, nameEn, descAr, descEn, price, emoji, secAr, secEn, groups, soldOut] */
  const PRODUCTS = {
    b01: [
      ['b01-p1', 'مجبوس دجاج', 'Chicken Majboos', 'رز بسمتي مع دجاج متبّل بالبزار الإماراتي واللومي.', 'Basmati rice with chicken spiced with Emirati bezar and dried lime.', 45, '🍛', 'أطباق رئيسية', 'Mains', [S('الحجم', 'Size', [['فردي', 'Individual', 0], ['عائلي (4 أشخاص)', 'Family (serves 4)', 70]]), ADDONS_MAJ()]],
      ['b01-p2', 'مجبوس لحم', 'Lamb Majboos', 'لحم غنم محلي مطبوخ على نار هادية مع رز مبهّر.', 'Local lamb slow-cooked with spiced rice.', 65, '🍖', 'أطباق رئيسية', 'Mains', [S('الحجم', 'Size', [['فردي', 'Individual', 0], ['عائلي (4 أشخاص)', 'Family (serves 4)', 95]]), ADDONS_MAJ()]],
      ['b01-p3', 'هريس', 'Harees', 'قمح ولحم مضروب على الطريقة التقليدية مع سمن بلدي.', 'Wheat and meat slow-beaten the traditional way, topped with local ghee.', 35, '🥣', 'أطباق رئيسية', 'Mains', [S('الحجم', 'Size', [['صحن', 'Bowl', 0], ['قدر صغير (3 أشخاص)', 'Small pot (serves 3)', 50]]), M('إضافات', 'Add-ons', [['سمن بلدي إضافي', 'Extra local ghee', 5]])]],
      ['b01-p4', 'ثريد', 'Thareed', 'خبز رقاق مغموس بمرق الخضار واللحم.', 'Regag bread soaked in a rich vegetable and meat stew.', 40, '🥘', 'أطباق رئيسية', 'Mains', [S('البروتين', 'Protein', [['دجاج', 'Chicken', 0], ['لحم', 'Lamb', 12]])]],
      ['b01-p5', 'صالونة سمك', 'Fish Saloona', 'صالونة سمك بالطماط والبهارات تقدّم مع الرز.', 'Fish stew with tomato and spices, served with rice.', 48, '🐟', 'أطباق رئيسية', 'Mains', [S('الرز', 'Rice', [['رز أبيض', 'White rice', 0], ['رز مشخول', 'Mashkhool rice', 4]])]],
      ['b01-p6', 'سمبوسة (12 حبة)', 'Samboosa (12 pcs)', 'سمبوسة مقرمشة محشية ومقلية على الطلب.', 'Crispy samboosa, filled and fried to order.', 25, '🥟', 'مقبلات', 'Sides', [S('الحشوة', 'Filling', [['جبن', 'Cheese', 0], ['لحم', 'Meat', 5], ['خضار', 'Vegetable', 0]])]],
      ['b01-p7', 'خبز رقاق (5 حبات)', 'Regag Bread (5 pcs)', 'خبز رقيق مقرمش مخبوز على الصاج.', 'Thin, crispy bread baked on the saj.', 15, '🫓', 'خبز', 'Bread', [S('الإضافة', 'Topping', [['سادة', 'Plain', 0], ['بيض وجبن', 'Egg & cheese', 6], ['زعتر', "Za'atar", 3]])]],
      ['b01-p8', 'لقيمات (20 حبة)', 'Luqaimat (20 pcs)', 'كرات عجين ذهبية مقرمشة مع دبس التمر.', 'Golden crispy dough balls with date syrup.', 20, '🍯', 'حلا', 'Dessert', [S('الصوص', 'Syrup', [['دبس تمر', 'Date syrup', 0], ['عسل', 'Honey', 5]])], true]
    ],
    b02: [
      ['b02-p1', 'كيكة زعفران وهيل', 'Saffron & Cardamom Cake', 'كيكة إسفنجية بالزعفران والهيل مع كريمة خفيفة.', 'Saffron and cardamom sponge with light cream.', 120, '🎂', 'كيك', 'Cakes', [S('الحجم', 'Size', [['1 كيلو', '1 kg', 0], ['2 كيلو', '2 kg', 100]]), M('إضافات', 'Extras', [['كتابة على الكيك', 'Writing on cake', 10], ['شموع', 'Candles', 5], ['تغليف هدية', 'Gift wrap', 15]])]],
      ['b02-p2', 'كنافة بالجبن', 'Cheese Kunafa', 'كنافة ناعمة بالجبن العكاوي والقطر، تقدّم حارة.', 'Soft kunafa with akkawi cheese and syrup, served warm.', 24, '🥮', 'حلويات شرقية', 'Arabic sweets', [S('الحجم', 'Size', [['صحن فردي', 'Single plate', 0], ['صينية صغيرة', 'Small tray', 56]])]],
      ['b02-p3', 'تشيز كيك بالتمر', 'Date Cheesecake', 'تشيز كيك كريمي بقاعدة بسكويت وتمر.', 'Creamy cheesecake on a biscuit and date base.', 95, '🍰', 'كيك', 'Cakes', [S('الصوص', 'Topping', [['كراميل التمر', 'Date caramel', 0], ['فستق', 'Pistachio', 15]])]],
      ['b02-p4', 'كب كيك (6 حبات)', 'Cupcakes (6 pcs)', 'كب كيك طري بكريمة الزبدة.', 'Soft cupcakes with buttercream.', 45, '🧁', 'كيك', 'Cakes', [S('النكهة', 'Flavour', [['فانيلا', 'Vanilla', 0], ['شوكولاتة', 'Chocolate', 5], ['ريد فيلفيت', 'Red velvet', 8]]), M('إضافات', 'Extras', [['تزيين بالاسم', 'Name toppers', 12]])]],
      ['b02-p5', 'بسبوسة بالقشطة', 'Basbousa with Cream', 'بسبوسة بالسميد محشية قشطة ومزينة باللوز.', 'Semolina basbousa filled with cream and topped with almonds.', 35, '🍮', 'حلويات شرقية', 'Arabic sweets', [], true],
      ['b02-p6', 'علبة حلويات العيد', 'Eid Sweets Box', 'تشكيلة من حلوياتنا في علبة أنيقة للإهداء.', 'An assortment of our sweets in an elegant gift box.', 150, '🎁', 'علب وهدايا', 'Boxes & gifts', [S('الحجم', 'Size', [['صغيرة (20 قطعة)', 'Small (20 pcs)', 0], ['كبيرة (40 قطعة)', 'Large (40 pcs)', 130]]), M('إضافات', 'Extras', [['بطاقة إهداء', 'Gift card', 5]])]],
      ['b02-p7', 'ماكرون بنكهات خليجية (12)', 'Gulf-flavour Macarons (12)', 'ماكرون هش بنكهات الهيل والزعفران والورد والفستق.', 'Delicate macarons in cardamom, saffron, rose and pistachio.', 60, '🍬', 'علب وهدايا', 'Boxes & gifts', [M('النكهات', 'Flavours', [['هيل', 'Cardamom', 0], ['زعفران', 'Saffron', 0], ['ورد', 'Rose', 0], ['فستق', 'Pistachio', 0]], 3)]]
    ],
    b03: [
      ['b03-p1', 'دهن عود كمبودي', 'Cambodian Oud Oil', 'دهن عود معتّق بريحة عميقة وثبات عالي.', 'Aged oud oil with a deep, long-lasting scent.', 250, '🫙', 'دهن عود', 'Oud oils', [S('الحجم', 'Size', [['3 مل', '3 ml', 0], ['6 مل', '6 ml', 230], ['12 مل', '12 ml', 450]])]],
      ['b03-p2', 'بخور معمول (50 غ)', "Ma'amoul Bakhoor (50 g)", 'بخور معمول ناعم يدوم طويلاً في المجالس.', "Soft ma'amoul bakhoor that lingers in the majlis.", 85, '🪔', 'بخور', 'Bakhoor', [S('الريحة', 'Scent', [['كلاسيكي', 'Classic', 0], ['ورد', 'Rose', 10], ['عنبر', 'Amber', 15]])]],
      ['b03-p3', 'عود كلمنتان (تولة)', 'Kalimantan Oud Chips (tola)', 'قطع عود طبيعي للتبخير، تولة 12 غرام.', 'Natural oud chips for burning, one tola (12 g).', 180, '🪵', 'عود', 'Oud wood', [S('الدرجة', 'Grade', [['عادي', 'Standard', 0], ['ممتاز', 'Premium', 120]])]],
      ['b03-p4', 'عطر مسك أبيض (50 مل)', 'White Musk Perfume (50 ml)', 'مسك ناعم ونظيف يناسب كل يوم.', 'Soft, clean musk for every day.', 140, '🌸', 'عطور', 'Perfumes', [M('إضافات', 'Extras', [['تغليف هدية', 'Gift wrap', 15], ['بطاقة إهداء', 'Gift card', 5]])]],
      ['b03-p5', 'مخلط دار العود (30 مل)', 'Dar Al Oud Blend (30 ml)', 'خلطتنا الخاصة من العود والورد والعنبر.', 'Our signature blend of oud, rose and amber.', 175, '🧴', 'عطور', 'Perfumes', [GIFT()]],
      ['b03-p6', 'مبخرة سيراميك', 'Ceramic Burner', 'مبخرة سيراميك بتصميم عصري.', 'A ceramic burner with a modern design.', 95, '🏺', 'مباخر', 'Burners', [S('اللون', 'Colour', [['أبيض', 'White', 0], ['ذهبي', 'Gold', 20], ['أخضر', 'Green', 0]])]],
      ['b03-p7', 'طقم هدية العود', 'Oud Gift Set', 'دهن عود 3 مل وبخور معمول ومبخرة في صندوق هدية.', '3 ml oud oil, ma\'amoul bakhoor and a burner in a gift box.', 380, '🎁', 'هدايا', 'Gifts', [M('إضافات', 'Extras', [['بطاقة إهداء', 'Gift card', 5]])], true]
    ],
    b04: [
      ['b04-p1', 'عباية كلوش سادة', 'Plain Cloche Abaya', 'عباية كلوش بقماش ناعم وانسيابي لكل يوم.', 'A soft, flowing cloche abaya for every day.', 280, '👗', 'يومية', 'Everyday', [SIZE_B04(), M('تعديلات', 'Alterations', [['تقصير الطول', 'Hemming', 20], ['تطريز الاسم', 'Name embroidery', 40]])]],
      ['b04-p2', 'عباية مطرزة بالخرز', 'Beaded Abaya', 'عباية سوداء بتطريز خرز يدوي على الأكمام.', 'Black abaya with hand-beaded sleeves.', 520, '✨', 'مناسبات', 'Occasions', [SIZE_B04(), M('إضافات', 'Extras', [['شيلة مطابقة', 'Matching shayla', 60]])]],
      ['b04-p3', 'عباية كتان صيفية', 'Summer Linen Abaya', 'عباية كتان خفيفة ومريحة للصيف.', 'A light, breathable linen abaya for summer.', 340, '🌿', 'يومية', 'Everyday', [SIZE_B04(), S('اللون', 'Colour', [['بيج', 'Beige', 0], ['زيتي', 'Olive', 0], ['رمادي', 'Grey', 0]])]],
      ['b04-p4', 'عباية دانتيل للمناسبات', 'Lace Occasion Abaya', 'عباية فاخرة بتفاصيل دانتيل على الصدر والأطراف.', 'A luxurious abaya with lace detailing.', 690, '💎', 'مناسبات', 'Occasions', [SIZE_B04(), M('تعديلات', 'Alterations', [['تقصير الطول', 'Hemming', 20]])]],
      ['b04-p5', 'عباية بشت عصرية', 'Modern Bisht Abaya', 'عباية بقصّة البشت وحواف ذهبية.', 'Bisht-cut abaya with gold-trimmed edges.', 450, '🪡', 'مناسبات', 'Occasions', [SIZE_B04()]],
      ['b04-p6', 'شيلة شيفون', 'Chiffon Shayla', 'شيلة شيفون خفيفة لا تنزلق.', 'A light, non-slip chiffon shayla.', 55, '🧣', 'شيلات', 'Shaylas', [S('اللون', 'Colour', [['أسود', 'Black', 0], ['كحلي', 'Navy', 0], ['بيج', 'Beige', 0]])]],
      ['b04-p7', 'شيلة كريب', 'Crepe Shayla', 'شيلة كريب مطفية بلمسة ناعمة.', 'A matte crepe shayla with a soft feel.', 65, '🧕', 'شيلات', 'Shaylas', [S('اللون', 'Colour', [['أسود', 'Black', 0], ['رمادي', 'Grey', 0]])], true]
    ],
    b05: [
      ['b05-p1', 'بلاليط', 'Balaleet', 'شعيرية حلوة بالزعفران والهيل.', 'Sweet vermicelli with saffron and cardamom.', 22, '🍜', 'فطور', 'Breakfast', [M('إضافات', 'Add-ons', [['أومليت فوق البلاليط', 'Omelette on top', 5], ['زعفران إضافي', 'Extra saffron', 4]])]],
      ['b05-p2', 'خبز خمير (4 حبات)', 'Khameer Bread (4 pcs)', 'خبز خمير طري بالهيل والزعفران.', 'Soft khameer bread with cardamom and saffron.', 16, '🥯', 'خبز', 'Bread', [S('الحشوة', 'Filling', [['سادة', 'Plain', 0], ['جبن', 'Cheese', 4], ['تمر', 'Dates', 3]])]],
      ['b05-p3', 'جباب (6 حبات)', 'Chebab (6 pcs)', 'فطائر إماراتية خفيفة بالهيل.', 'Light Emirati pancakes with cardamom.', 18, '🥞', 'فطور', 'Breakfast', [S('الصوص', 'Syrup', [['دبس', 'Date syrup', 0], ['عسل', 'Honey', 5]]), M('إضافات', 'Add-ons', [['جبن كريمي', 'Cream cheese', 4]])]],
      ['b05-p4', 'خبز محلى (4 حبات)', 'Mahalla Bread (4 pcs)', 'خبز محلى ذهبي بالسمسم.', 'Golden sweet bread with sesame.', 14, '🍞', 'خبز', 'Bread', []],
      ['b05-p5', 'عصيدة', 'Aseeda', 'عصيدة بالسمن والزعفران.', 'Aseeda pudding with ghee and saffron.', 20, '🍮', 'فطور', 'Breakfast', [S('الحجم', 'Size', [['فردي', 'Individual', 0], ['عائلي', 'Family', 30]])]],
      ['b05-p6', 'بيض وطماط', 'Eggs with Tomato', 'بيض مع طماط وبصل بالطريقة البيتية.', 'Eggs with tomato and onion, home style.', 18, '🍳', 'فطور', 'Breakfast', [M('إضافات', 'Add-ons', [['خبز رقاق', 'Regag bread', 5]])]],
      ['b05-p7', 'كرك بالزعفران (لتر)', 'Saffron Karak (1 L)', 'شاي كرك بالزعفران والهيل في ترمس.', 'Saffron and cardamom karak tea in a flask.', 25, '☕', 'مشروبات', 'Drinks', [S('السكر', 'Sugar', [['عادي', 'Regular', 0], ['خفيف', 'Light', 0], ['بدون', 'None', 0]])]],
      ['b05-p8', 'قهوة عربية (دلة لتر)', 'Arabic Coffee (1 L dallah)', 'قهوة عربية بالهيل والزعفران.', 'Arabic coffee with cardamom and saffron.', 30, '🫖', 'مشروبات', 'Drinks', [M('إضافات', 'Add-ons', [['تمر خلاص (250 غ)', 'Khalas dates (250 g)', 15]])], true]
    ],
    b06: [
      ['b06-p1', 'بخور نسيم الورد', 'Naseem Rose Bakhoor', 'بخور بالورد الطائفي والمسك.', 'Bakhoor with Taifi rose and musk.', 65, '🌹', 'بخور', 'Bakhoor', [S('الوزن', 'Weight', [['50 غ', '50 g', 0], ['100 غ', '100 g', 55]])]],
      ['b06-p2', 'بخور العنبر', 'Amber Bakhoor', 'بخور دافي بالعنبر والفانيلا.', 'Warm bakhoor with amber and vanilla.', 70, '🟤', 'بخور', 'Bakhoor', [S('الوزن', 'Weight', [['50 غ', '50 g', 0], ['100 غ', '100 g', 55]])]],
      ['b06-p3', 'معطر مفارش (250 مل)', 'Linen Spray (250 ml)', 'معطر للمفارش والوسائد بريحة تدوم.', 'A long-lasting spray for linens and pillows.', 45, '🧴', 'معطرات', 'Home scents', [S('الريحة', 'Scent', [['ورد', 'Rose', 0], ['مسك', 'Musk', 0], ['عود', 'Oud', 10]])]],
      ['b06-p4', 'معطر جو', 'Room Spray', 'معطر جو بخلطة نسيم الصباح.', 'Room spray in our Morning Breeze blend.', 40, '🌬️', 'معطرات', 'Home scents', []],
      ['b06-p5', 'مسك الطهارة (20 غ)', 'Musk Tahara (20 g)', 'مسك أبيض كريمي ناعم.', 'Soft, creamy white musk.', 35, '🤍', 'عطور', 'Perfumes', []],
      ['b06-p6', 'عطر نسيم الصباح (50 مل)', 'Morning Breeze Perfume (50 ml)', 'عطر منعش بالحمضيات والمسك.', 'A fresh perfume of citrus and musk.', 160, '🌸', 'عطور', 'Perfumes', [GIFT()]],
      ['b06-p7', 'فحم سريع الاشتعال (10 أقراص)', 'Quick-light Charcoal (10 discs)', 'فحم للبخور يشتعل بسرعة وبدون ريحة.', 'Fast-lighting, odourless charcoal for bakhoor.', 12, '⚫', 'مستلزمات', 'Essentials', [], true]
    ],
    b07: [
      ['b07-p1', 'طارة تطريز بالاسم', 'Embroidered Name Hoop', 'طارة مطرزة يدوياً بالاسم والورد، اكتب الاسم في الملاحظات.', 'Hand-embroidered hoop with a name and flowers; write the name in the notes.', 120, '🪡', 'تطريز', 'Embroidery', [S('المقاس', 'Size', [['15 سم', '15 cm', 0], ['20 سم', '20 cm', 30]]), M('إضافات', 'Extras', [['إطار خشبي', 'Wooden frame', 25], ['تغليف هدية', 'Gift wrap', 15]])]],
      ['b07-p2', 'حقيبة كروشيه', 'Crochet Bag', 'حقيبة كتف كروشيه بخيوط قطنية.', 'A crochet shoulder bag in cotton yarn.', 150, '👜', 'كروشيه', 'Crochet', [S('اللون', 'Colour', [['بيج', 'Beige', 0], ['وردي', 'Pink', 0], ['أخضر', 'Green', 0]])]],
      ['b07-p3', 'دمية كروشيه', 'Crochet Plush Toy', 'دمية كروشيه ناعمة للأطفال.', 'A soft crochet toy for children.', 85, '🐪', 'كروشيه', 'Crochet', [S('الشكل', 'Shape', [['جمل', 'Camel', 0], ['صقر', 'Falcon', 10], ['غزال', 'Gazelle', 5]])]],
      ['b07-p4', 'مفرش طاولة سدو', 'Sadu Table Runner', 'مفرش منسوج بنقشة السدو التراثية.', 'A runner woven in traditional Sadu patterns.', 180, '🧶', 'سدو', 'Sadu', []],
      ['b07-p5', 'ميدالية بالاسم', 'Name Keychain', 'ميدالية مطرزة بالاسم.', 'An embroidered name keychain.', 30, '🔑', 'هدايا', 'Gifts', [M('إضافات', 'Extras', [['خرز ملون', 'Coloured beads', 5]])]],
      ['b07-p6', 'صندوق هدايا مواليد', 'Newborn Gift Box', 'بطانية كروشيه ولعبة وطارة باسم المولود.', 'A crochet blanket, toy and name hoop for a newborn.', 260, '🍼', 'هدايا', 'Gifts', [M('إضافات', 'Extras', [['تطريز اسم المولود على البطانية', "Baby's name on blanket", 35]])]],
      ['b07-p7', 'قواعد أكواب سدو (4)', 'Sadu Coasters (4)', 'أربع قواعد منسوجة بنقشة السدو.', 'Four coasters woven in Sadu patterns.', 60, '☕', 'سدو', 'Sadu', [], true]
    ],
    b08: [
      ['b08-p1', 'برياني لحم', 'Lamb Biryani', 'رز برياني بطبقات اللحم والبهارات والبصل المقرمش.', 'Layered biryani rice with lamb, spices and crispy onions.', 50, '🍛', 'رئيسي', 'Mains', [S('الحجم', 'Size', [['فردي', 'Individual', 0], ['عائلي', 'Family', 75]]), M('إضافات', 'Add-ons', [['رايتا', 'Raita', 4], ['بيض مسلوق', 'Boiled egg', 3]])]],
      ['b08-p2', 'مضروبة دجاج', 'Chicken Madrooba', 'دجاج ورز مضروب بالبهارات حتى النعومة.', 'Chicken and rice beaten smooth with spices.', 38, '🥣', 'رئيسي', 'Mains', []],
      ['b08-p3', 'مكبوس كنعد', 'Kingfish Machboos', 'كنعد طازج مع رز مكبوس بالبهارات.', 'Fresh kingfish with spiced machboos rice.', 55, '🐟', 'رئيسي', 'Mains', [S('الحجم', 'Size', [['فردي', 'Individual', 0], ['عائلي', 'Family', 80]])]],
      ['b08-p4', 'مرقوقة', 'Margoogat', 'مرق بالخضار وعجين رقيق.', 'A vegetable stew with thin dough.', 42, '🥘', 'رئيسي', 'Mains', [S('البروتين', 'Protein', [['دجاج', 'Chicken', 0], ['لحم', 'Lamb', 10]])]],
      ['b08-p5', 'شوربة عدس', 'Lentil Soup', 'شوربة عدس بالكمون والليمون.', 'Lentil soup with cumin and lemon.', 15, '🍲', 'شوربات', 'Soups', [M('إضافات', 'Add-ons', [['خبز محمص', 'Croutons', 3]])]],
      ['b08-p6', 'معكرونة بالبشاميل', 'Béchamel Pasta Tray', 'صينية معكرونة باللحم المفروم والبشاميل.', 'A tray of pasta with minced meat and béchamel.', 60, '🍝', 'رئيسي', 'Mains', [S('الحجم', 'Size', [['صينية صغيرة', 'Small tray', 0], ['صينية كبيرة', 'Large tray', 40]])]],
      ['b08-p7', 'محلبية (4 أكواب)', 'Muhallabia (4 cups)', 'محلبية بماء الورد.', 'Milk pudding with rose water.', 20, '🍮', 'حلا', 'Desserts', [M('الزينة', 'Toppings', [['فستق', 'Pistachio', 4], ['زعفران', 'Saffron', 3]], 2)]],
      ['b08-p8', 'ساقو (4 أكواب)', 'Sago Pudding (4 cups)', 'ساقو بالزعفران والهيل.', 'Sago with saffron and cardamom.', 18, '🍧', 'حلا', 'Desserts', [], true]
    ],
    b09: [
      ['b09-p1', 'كيكة الحليب', 'Milk Cake', 'كيكة الحليب بثلاث أنواع حليب، باردة وطرية.', 'Soft, chilled three-milk cake.', 85, '🍰', 'كيك', 'Cakes', [S('النكهة', 'Flavour', [['كلاسيكي', 'Classic', 0], ['كراميل', 'Caramel', 10], ['زعفران', 'Saffron', 10]])]],
      ['b09-p2', 'كيكة شوكولاتة', 'Chocolate Fudge Cake', 'كيكة شوكولاتة غنية بصوص الفدج.', 'Rich chocolate cake with fudge sauce.', 110, '🎂', 'كيك', 'Cakes', [S('الحجم', 'Size', [['1 كيلو', '1 kg', 0], ['2 كيلو', '2 kg', 90]]), M('إضافات', 'Extras', [['كتابة على الكيك', 'Writing on cake', 10], ['شموع', 'Candles', 5]])]],
      ['b09-p3', 'كيكة الجزر', 'Carrot Cake', 'كيكة الجزر بالجوز وكريمة الجبن.', 'Carrot cake with walnuts and cream cheese frosting.', 90, '🥕', 'كيك', 'Cakes', []],
      ['b09-p4', 'حلى التمر بالكراميل', 'Sticky Date Pudding', 'حلى تمر دافي مع صوص كراميل.', 'Warm date pudding with caramel sauce.', 40, '🍮', 'حلى بارد', 'Desserts', [M('إضافات', 'Extras', [['آيس كريم فانيلا', 'Vanilla ice cream', 8]])]],
      ['b09-p5', 'براونيز (9 قطع)', 'Brownies (9 pcs)', 'براونيز شوكولاتة كثيفة.', 'Dense chocolate brownies.', 45, '🍫', 'معجنات حلوة', 'Sweet bakes', [M('إضافات', 'Extras', [['جوز', 'Walnuts', 5], ['صوص البندق', 'Hazelnut sauce', 5]])]],
      ['b09-p6', 'كوكيز (12)', 'Cookies (12)', 'كوكيز طري من الداخل ومقرمش من برا.', 'Soft-centred, crispy-edged cookies.', 40, '🍪', 'معجنات حلوة', 'Sweet bakes', [S('النكهة', 'Flavour', [['شوكولاتة', 'Chocolate chip', 0], ['شوفان وزبيب', 'Oat & raisin', 0], ['تمر وهيل', 'Date & cardamom', 5]])]],
      ['b09-p7', 'رولات القرفة (6)', 'Cinnamon Rolls (6)', 'رولات قرفة بكريمة الجبن.', 'Cinnamon rolls with cream cheese glaze.', 38, '🌀', 'معجنات حلوة', 'Sweet bakes', [M('إضافات', 'Extras', [['كريمة إضافية', 'Extra glaze', 5]])], true]
    ],
    b10: [
      ['b10-p1', 'مجبوس دجاج', 'Chicken Majboos', 'مجبوس دجاج بوصفة الوالدة مع الدقوس.', "Mum's chicken majboos with daqoos.", 48, '🍛', 'أطباق رئيسية', 'Mains', [S('الحجم', 'Size', [['فردي', 'Individual', 0], ['عائلي (4 أشخاص)', 'Family (serves 4)', 72]]), M('إضافات', 'Add-ons', [['دقوس', 'Daqoos', 3], ['لبن', 'Laban', 4], ['سلطة', 'Salad', 8]], 3)]],
      ['b10-p2', 'مجبوس لحم', 'Lamb Majboos', 'لحم محلي طري مع رز مبهّر بالبزار.', 'Tender local lamb with bezar-spiced rice.', 70, '🍖', 'أطباق رئيسية', 'Mains', [S('الحجم', 'Size', [['فردي', 'Individual', 0], ['عائلي (4 أشخاص)', 'Family (serves 4)', 100]])]],
      ['b10-p3', 'مندي دجاج', 'Chicken Mandi', 'دجاج مدخّن على الطريقة اليمنية مع رز مندي.', 'Smoky Yemeni-style chicken with mandi rice.', 50, '🍗', 'مشويات', 'Grills', [S('القطعة', 'Portion', [['ربع', 'Quarter', 0], ['نص', 'Half', 18]])]],
      ['b10-p4', 'مضغوط لحم', 'Lamb Madghout', 'لحم ورز مطبوخ بالضغط مع الطماط والبهارات.', 'Pressure-cooked lamb and rice with tomato and spices.', 75, '🥘', 'أطباق رئيسية', 'Mains', []],
      ['b10-p5', 'صالونة خضار', 'Vegetable Saloona', 'صالونة خضار موسمية بالبهارات الإماراتية.', 'Seasonal vegetable stew with Emirati spices.', 28, '🥕', 'أطباق رئيسية', 'Mains', [S('الرز', 'Rice', [['مع رز', 'With rice', 0], ['بدون رز', 'Without rice', 0]])]],
      ['b10-p6', 'عيش أبيض ودقوس', 'White Rice & Daqoos', 'رز أبيض مع صوص الدقوس الحار.', 'White rice with spicy daqoos sauce.', 15, '🍚', 'جانبي', 'Sides', []],
      ['b10-p7', 'سلطة جرجير', 'Rocket Salad', 'جرجير وطماط وبصل بالليمون.', 'Rocket, tomato and onion with lemon.', 18, '🥗', 'جانبي', 'Sides', []],
      ['b10-p8', 'ليمون بالنعناع (لتر)', 'Lemon Mint (1 L)', 'عصير ليمون ونعناع طازج.', 'Fresh lemon and mint juice.', 18, '🍋', 'مشروبات', 'Drinks', [S('السكر', 'Sugar', [['عادي', 'Regular', 0], ['خفيف', 'Light', 0]])], true]
    ],
    b11: [
      ['b11-p1', 'دخون الدار الخاص', 'House Dukhoon', 'خلطة دخون الدار بالعود والزعفران والمسك.', 'Our house dukhoon with oud, saffron and musk.', 120, '🪔', 'دخون', 'Dukhoon', [S('الوزن', 'Weight', [['50 غ', '50 g', 0], ['100 غ', '100 g', 100]])]],
      ['b11-p2', 'دخون ملكي', 'Royal Dukhoon', 'دخون فاخر للمناسبات بدهن العود.', 'Luxurious occasion dukhoon with oud oil.', 160, '👑', 'دخون', 'Dukhoon', [S('الوزن', 'Weight', [['50 غ', '50 g', 0], ['100 غ', '100 g', 140]])]],
      ['b11-p3', 'مخمرية', 'Mukhamaria', 'عطر كريمي تقليدي بالزعفران والورد.', 'A traditional creamy perfume with saffron and rose.', 90, '🫙', 'عطور', 'Perfumes', [S('الحجم', 'Size', [['25 غ', '25 g', 0], ['50 غ', '50 g', 75]])]],
      ['b11-p4', 'عطر عود وورد (50 مل)', 'Oud & Rose Perfume (50 ml)', 'عطر يجمع العود الكمبودي والورد الطائفي.', 'Cambodian oud meets Taifi rose.', 220, '🌹', 'عطور', 'Perfumes', [GIFT()]],
      ['b11-p5', 'بخور السيارة (3 أكياس)', 'Car Bakhoor Sachets (3)', 'أكياس معطرة للسيارة بريحة الدخون.', 'Scented sachets for the car with a dukhoon aroma.', 30, '🚗', 'إكسسوارات', 'Accessories', []],
      ['b11-p6', 'مبخرة كهربائية', 'Electric Burner', 'مبخرة كهربائية قابلة للشحن.', 'A rechargeable electric burner.', 150, '🔌', 'إكسسوارات', 'Accessories', [S('اللون', 'Colour', [['أسود', 'Black', 0], ['ذهبي', 'Gold', 20], ['أبيض', 'White', 0]])]],
      ['b11-p7', 'طقم العروس', 'Bridal Scent Set', 'دخون ومخمرية ودهن عود ومبخرة في صندوق فاخر.', 'Dukhoon, mukhamaria, oud oil and a burner in a luxury box.', 650, '💍', 'هدايا', 'Gifts', [M('إضافات', 'Extras', [['نقش الأسماء على الصندوق', 'Names engraved on box', 50]])]],
      ['b11-p8', 'دهن مسك الغزال', 'Gazelle-style Musk Oil', 'دهن مسك نباتي بريحة دافئة.', 'A warm, plant-based musk oil.', 110, '🤎', 'عطور', 'Perfumes', [], true]
    ],
    b12: [
      ['b12-p1', 'عباية كريب ملكي', 'Royal Crepe Abaya', 'عباية كريب ثقيل بقصّة مستقيمة.', 'A heavy crepe abaya with a straight cut.', 390, '🧕', 'يومية', 'Everyday', [SIZE_B12(), M('تعديلات', 'Alterations', [['تقصير', 'Hemming', 20]])]],
      ['b12-p2', 'عباية فراشة', 'Butterfly Abaya', 'عباية واسعة بأكمام فراشة.', 'A loose abaya with butterfly sleeves.', 360, '🦋', 'يومية', 'Everyday', [SIZE_B12(), S('اللون', 'Colour', [['أسود', 'Black', 0], ['كحلي', 'Navy', 0]])]],
      ['b12-p3', 'عباية مطرزة بالزري', 'Zari-embroidered Abaya', 'تطريز زري ذهبي يدوي على الأطراف.', 'Hand-stitched gold zari embroidery along the edges.', 750, '🌟', 'مناسبات', 'Occasions', [SIZE_B12(), M('إضافات', 'Extras', [['شيلة مطابقة', 'Matching shayla', 70]])]],
      ['b12-p4', 'عباية حرير بالكريستال', 'Silk Crystal Abaya', 'حرير ناعم بلمسات كريستال.', 'Soft silk with crystal accents.', 890, '💎', 'مناسبات', 'Occasions', [SIZE_B12()]],
      ['b12-p5', 'عباية أطفال', "Girls' Abaya", 'عباية للبنات من 4 إلى 12 سنة.', 'An abaya for girls aged 4 to 12.', 180, '👧', 'أطفال', 'Kids', [S('العمر', 'Age', [['4–6 سنوات', '4–6 years', 0], ['7–9 سنوات', '7–9 years', 20], ['10–12 سنة', '10–12 years', 40]])]],
      ['b12-p6', 'شيلة مطرزة', 'Embroidered Shayla', 'شيلة شيفون بتطريز على الطرف.', 'Chiffon shayla with an embroidered edge.', 85, '🧣', 'شيلات', 'Shaylas', [], true]
    ],
    b13: [
      ['b13-p1', 'شمعة العود', 'Oud Candle', 'شمعة صويا معطّرة بالعود في وعاء فخار.', 'A soy candle scented with oud in a clay pot.', 75, '🕯️', 'شموع', 'Candles', [S('الحجم', 'Size', [['صغيرة', 'Small', 0], ['كبيرة', 'Large', 45]])]],
      ['b13-p2', 'مبخرة فخار مرسومة', 'Painted Clay Burner', 'مبخرة فخار مرسومة باليد بنقوش تراثية.', 'A hand-painted clay burner with heritage motifs.', 70, '🏺', 'فخار', 'Pottery', []],
      ['b13-p3', 'صحن فخار مرسوم', 'Painted Clay Plate', 'صحن تقديم مرسوم يدوياً، للزينة.', 'A hand-painted decorative serving plate.', 95, '🍽️', 'فخار', 'Pottery', [S('النقشة', 'Pattern', [['نخيل', 'Palms', 0], ['سدو', 'Sadu', 0], ['ورد', 'Flowers', 0]])]],
      ['b13-p4', 'فانوس فخار', 'Clay Lantern', 'فانوس فخار مخرّم يعكس الضوء.', 'A pierced clay lantern that scatters light.', 120, '🏮', 'ديكور', 'Decor', []],
      ['b13-p5', 'طقم شموع رمضان', 'Ramadan Candle Set', 'ثلاث شموع بنقوش الهلال والفانوس.', 'Three candles with crescent and lantern motifs.', 140, '🌙', 'شموع', 'Candles', [GIFT()]],
      ['b13-p6', 'عدّة رسم فخار', 'Pottery Painting Kit', 'قطعتين فخار وألوان وفرش للأطفال والكبار.', 'Two clay pieces with paints and brushes for kids and adults.', 85, '🎨', 'ورش', 'Kits', [S('عدد القطع', 'Pieces', [['قطعتين', '2 pieces', 0], ['أربع قطع', '4 pieces', 60]])]],
      ['b13-p7', 'شمعة الورد', 'Rose Candle', 'شمعة معطرة بالورد الطائفي.', 'A candle scented with Taifi rose.', 70, '🌷', 'شموع', 'Candles', [], true]
    ],
    b14: [
      ['b14-p1', 'لقيمات (20 حبة)', 'Luqaimat (20 pcs)', 'لقيمات مقرمشة من برا وطرية من داخل.', 'Crispy outside, soft inside.', 18, '🍯', 'حلويات الفريج', 'Classics', [S('الصوص', 'Syrup', [['دبس تمر', 'Date syrup', 0], ['عسل', 'Honey', 5], ['شوكولاتة', 'Chocolate', 5]]), M('إضافات', 'Extras', [['سمسم', 'Sesame', 0]])]],
      ['b14-p2', 'خنفروش (10 حبات)', 'Khanfaroosh (10 pcs)', 'كعك إماراتي بالزعفران وماء الورد.', 'Emirati saffron and rose-water fritters.', 22, '🍩', 'حلويات الفريج', 'Classics', []],
      ['b14-p3', 'بثيثة', 'Bitheetha', 'تمر وطحين محمّص بالسمن والهيل.', 'Dates and toasted flour with ghee and cardamom.', 30, '🥮', 'حلويات الفريج', 'Classics', [S('الحجم', 'Size', [['علبة صغيرة', 'Small box', 0], ['علبة كبيرة', 'Large box', 25]])]],
      ['b14-p4', 'كيكة عقيلي', 'Eqaili Cake', 'كيكة عقيلي بالزعفران والهيل والسمسم.', 'Eqaili cake with saffron, cardamom and sesame.', 45, '🍰', 'كيك', 'Cakes', []],
      ['b14-p5', 'حلوى بالزعفران (علبة)', 'Saffron Halwa (box)', 'حلوى عربية لزجة بالزعفران والمكسرات.', 'Sticky Arabic halwa with saffron and nuts.', 55, '🍬', 'علب', 'Boxes', [S('المكسرات', 'Nuts', [['لوز', 'Almonds', 0], ['كاجو', 'Cashews', 5], ['فستق', 'Pistachios', 12]])]],
      ['b14-p6', 'تمر محشي (500 غ)', 'Stuffed Dates (500 g)', 'تمر خلاص محشي بالمكسرات.', 'Khalas dates stuffed with nuts.', 65, '🌴', 'علب', 'Boxes', [M('الحشوات', 'Fillings', [['لوز', 'Almond', 0], ['جوز', 'Walnut', 0], ['طحينية', 'Tahini', 0]], 2)]],
      ['b14-p7', 'ساقو بالزعفران', 'Saffron Sago', 'ساقو بارد بالزعفران والهيل.', 'Chilled sago with saffron and cardamom.', 16, '🍧', 'حلويات الفريج', 'Classics', []],
      ['b14-p8', 'عصيدة بالتمر', 'Date Aseeda', 'عصيدة بالتمر والسمن.', 'Aseeda with dates and ghee.', 25, '🍮', 'حلويات الفريج', 'Classics', [], true]
    ]
  };

  /* [bid, authorAr, authorEn, stars, lang, textAr, textEn, daysAgo] */
  const REVIEWS = [
    ['b01', 'فاطمة', 'Fatima', 5, 'ar', 'المجبوس يذكرني بأكل أمي، الكمية كبيرة والدقوس خطير.', "The majboos reminds me of my mum's cooking. Generous portion and amazing daqoos.", 2],
    ['b01', 'جيمس', 'James', 5, 'en', 'ممتاز. الهريس كان ناعم جداً وانطبخ بحب. سأطلب مرة ثانية أكيد.', 'Fantastic. The harees was so smooth and clearly made with love. Ordering again for sure.', 6],
    ['b01', 'سعيد', 'Saeed', 4, 'ar', 'الأكل لذيذ بس التوصيل تأخر ربع ساعة.', 'Delicious food, but delivery was 15 minutes late.', 13],
    ['b02', 'نورة', 'Noura', 5, 'ar', 'كيكة الزعفران كانت نجمة العزيمة، الكل سأل عنها.', 'The saffron cake was the star of the party; everyone asked about it.', 1],
    ['b02', 'بريا', 'Priya', 5, 'en', 'الكنافة كانت حارة ولذيذة والكب كيك بالاسم كان لطيف جداً.', 'Kunafa arrived warm and delicious, and the name cupcakes were adorable.', 9],
    ['b02', 'منى', 'Mona', 4, 'ar', 'طعم رائع لكن الكريمة كانت حالية شوي بالنسبة لي.', 'Great taste, though the cream was a bit sweet for me.', 20],
    ['b03', 'خالد', 'Khalid', 5, 'ar', 'دهن العود ثابت وريحته فخمة، تعامل راقي.', 'The oud oil lasts all day and smells luxurious. Very professional.', 3],
    ['b03', 'عمر', 'Omar', 4, 'en', 'بخور جميل، والمبخرة أصغر شوي مما توقعت.', 'Lovely bakhoor; the burner was a little smaller than I expected.', 11],
    ['b04', 'شيخة', 'Shaikha', 5, 'ar', 'القصّة مريحة والقماش ما يحر، والتطريز بالاسم ناعم.', 'Comfortable cut, breathable fabric and delicate name embroidery.', 4],
    ['b04', 'سارة', 'Sara', 4, 'en', 'العباية حلوة جداً، التفصيل أخذ وقت أطول من المتوقع.', 'Beautiful abaya; tailoring took a little longer than expected.', 17],
    ['b05', 'راشد', 'Rashid', 5, 'ar', 'أحلى فطور يوم الجمعة، الخمير طازج والكرك يعدّل المزاج.', 'Best Friday breakfast. Fresh khameer and karak that makes your day.', 2],
    ['b05', 'آنا', 'Anna', 5, 'en', 'أول مرة أجرّب البلاليط، طلع حلو ومالح بشكل رهيب!', 'My first time trying balaleet. Sweet and savoury and brilliant!', 8],
    ['b06', 'عائشة', 'Aisha', 5, 'ar', 'بخور الورد ريحته تفوح بالبيت كله، والسعر ممتاز.', 'The rose bakhoor fills the whole house and the price is great.', 5],
    ['b06', 'لينا', 'Lina', 4, 'en', 'معطر المفارش جميل، أتمنى يكون فيه حجم أكبر.', 'Lovely linen spray; I wish it came in a bigger size.', 15],
    ['b07', 'مريم', 'Maryam', 5, 'ar', 'طارة اسم بنتي طلعت تحفة، شغل يدوي متقن.', "My daughter's name hoop is a masterpiece. Beautiful handwork.", 6],
    ['b07', 'هانا', 'Hannah', 5, 'en', 'دمية الجمل صارت اللعبة المفضلة عند ولدي.', "The crochet camel is now my son's favourite toy.", 12],
    ['b08', 'ماجد', 'Majid', 5, 'ar', 'البرياني فيه بهارات مضبوطة واللحم ذايب.', 'Perfectly spiced biryani and the lamb melts in your mouth.', 3],
    ['b08', 'رافي', 'Ravi', 4, 'en', 'المضروبة لذيذة ومشبعة، الكمية تكفي شخصين تقريباً.', 'Tasty, filling madrooba; enough for almost two people.', 10],
    ['b09', 'هند', 'Hind', 5, 'ar', 'كيكة الحليب بالزعفران ولا أروع، طرية وباردة.', 'The saffron milk cake is wonderful, soft and chilled.', 2],
    ['b09', 'كلوي', 'Chloe', 4, 'en', 'البراونيز لذيذ جداً، والكوكيز بالتمر مفاجأة حلوة.', 'The brownies are delicious and the date cookies are a lovely surprise.', 14],
    ['b10', 'حمد', 'Hamad', 5, 'ar', 'مجبوس اللحم على أصوله، ذكرني بغداء الجمعة عند جدتي.', "Proper lamb majboos, like Friday lunch at grandma's.", 1],
    ['b10', 'مايكل', 'Michael', 5, 'en', 'المندي مدخّن بشكل رائع والتغليف ممتاز.', 'Wonderfully smoky mandi, and the packaging was excellent.', 7],
    ['b10', 'علياء', 'Alia', 4, 'ar', 'الأكل ممتاز، بس ودي يكون فيه خيار رز بني.', "Excellent food; I'd love a brown rice option.", 19],
    ['b11', 'موزة', 'Moza', 5, 'ar', 'طقم العروس كان أحلى هدية لأختي، الدخون فخم.', 'The bridal set was the best gift for my sister; the dukhoon is luxurious.', 4],
    ['b11', 'فاطمة ز.', 'Fatima Z.', 5, 'en', 'المخمرية ريحتها تجنن وتثبت على الملابس أيام.', 'The mukhamaria smells amazing and stays on clothes for days.', 9],
    ['b12', 'مزنة', 'Muzna', 5, 'ar', 'عباية الزري لبستها في عرس وكل الحضور سألوا عنها.', 'I wore the zari abaya to a wedding and everyone asked about it.', 5],
    ['b12', 'ليلى', 'Leila', 4, 'en', 'جودة الحرير ممتازة، المقاس يحتاج تعديل بسيط.', 'Excellent silk quality; the size needed a small alteration.', 16],
    ['b13', 'نورة', 'Noura', 5, 'ar', 'الفانوس الفخار يعطي إضاءة دافئة بالمجلس، شغل جميل.', 'The clay lantern gives a warm glow in the majlis. Beautiful work.', 6],
    ['b13', 'توم', 'Tom', 4, 'en', 'عدّة الرسم كانت نشاط ممتع للعائلة يوم الجمعة.', 'The painting kit was a fun Friday family activity.', 21],
    ['b14', 'علي', 'Ali', 5, 'ar', 'اللقيمات مقرمشة والدبس أصلي، طعم الفريج صدق.', 'Crispy luqaimat with real date syrup. True neighbourhood taste.', 1],
    ['b14', 'صوفي', 'Sophie', 5, 'en', 'الخنفروش خفيف وريحته زعفران، أحسن من أي مخبز.', 'Light khanfaroosh with a lovely saffron aroma, better than any bakery.', 8]
  ];

  const STAR_DIST = {
    4.9: [90, 7, 2, 1, 0],
    4.8: [82, 13, 3, 1, 1],
    4.7: [75, 18, 4, 2, 1],
    4.6: [70, 20, 6, 2, 2]
  };

  const SEED_CUSTOMERS = [['عبدالله', 'Abdulla'], ['حصة', 'Hessa'], ['دانيال', 'Daniel'], ['مها', 'Maha'], ['أرجون', 'Arjun'], ['شما', 'Shamma']];

  const POPULAR = { ar: ['مجبوس', 'كنافة', 'لقيمات', 'بخور', 'عبايات', 'دخون', 'كيك', 'شموع'], en: ['Majboos', 'Kunafa', 'Luqaimat', 'Bakhoor', 'Abayas', 'Dukhoon', 'Cake', 'Candles'] };

  /* Emoji choices per category for the owner product form (24 each) */
  const EMOJI_SETS = {
    food: ['🍲', '🍛', '🍖', '🥘', '🥣', '🐟', '🥟', '🫓', '🍯', '🍚', '🥗', '🍗', '🍳', '🥞', '🍜', '🥯', '🍞', '☕', '🫖', '🍮', '🍝', '🍋', '🥕', '🌶️'],
    sweets: ['🧁', '🎂', '🍰', '🥮', '🍮', '🎁', '🍬', '🍫', '🍪', '🍩', '🍯', '🌴', '🍧', '🍨', '🥧', '🌀', '🍓', '🍒', '🥥', '🍌', '🍦', '🥐', '🧇', '🍭'],
    perfume: ['🌸', '🪔', '🫙', '🪵', '🧴', '🏺', '🌹', '🌬️', '🤍', '🟤', '⚫', '👑', '💍', '🔌', '🚗', '🤎', '🌷', '🌺', '💐', '🕯️', '🎁', '✨', '💎', '🌙'],
    abaya: ['👗', '🧕', '✨', '💎', '🪡', '🧣', '🌿', '🦋', '🌟', '👧', '👘', '🥻', '👜', '👛', '🎀', '🧵', '🪢', '👠', '💍', '🌙', '🖤', '🤍', '🤎', '💜'],
    crafts: ['🧶', '🪡', '👜', '🐪', '🔑', '🍼', '☕', '🕯️', '🏺', '🍽️', '🏮', '🌙', '🎨', '🌷', '🧵', '🪢', '🖼️', '🪴', '🧸', '🎁', '🦅', '🌴', '📿', '🪆']
  };

  /* Build normalised seed structures */
  function buildGroups(pid, groups) {
    return (groups || []).map((g, gi) => ({
      id: 'g' + (gi + 1),
      nameAr: g.nameAr,
      nameEn: g.nameEn,
      type: g.type,
      required: g.required,
      max: g.max,
      choices: g.choices.map((c, ci) => ({ id: 'c' + (ci + 1), nameAr: c[0], nameEn: c[1], delta: c[2] }))
    }));
  }

  const SEED_BUSINESSES = BIZ.map((r) => ({
    id: r[0], nameAr: r[1], nameEn: r[2], category: r[3], ownerAr: r[4], ownerEn: r[5],
    emirate: r[6], areaAr: r[7], areaEn: r[8], logo: r[9], colors: r[10],
    rating: r[11], reviewCount: r[12],
    delivery: r[13] != null, deliveryFee: r[13] != null ? r[13] : 0, minOrder: r[14],
    pickup: true, prep: r[15], featured: r[16],
    hours: HOURS[r[0]], bioAr: BIOS[r[0]][0], bioEn: BIOS[r[0]][1], tags: BIOS[r[0]][2],
    acceptingOrders: true
  }));

  const SEED_PRODUCTS = [];
  Object.keys(PRODUCTS).forEach((bid) => {
    PRODUCTS[bid].forEach((r, idx) => {
      SEED_PRODUCTS.push({
        id: r[0], businessId: bid, order: idx, nameAr: r[1], nameEn: r[2], descAr: r[3], descEn: r[4],
        price: r[5], emoji: r[6], section: { ar: r[7], en: r[8] }, groups: buildGroups(r[0], r[9]),
        available: !r[10], hidden: false
      });
    });
  });

  const SEED_REVIEWS = REVIEWS.map((r, i) => ({
    id: 'sr' + (i + 1), businessId: r[0], authorAr: r[1], authorEn: r[2], stars: r[3], lang: r[4],
    textAr: r[5], textEn: r[6], daysAgo: r[7]
  }));

  H.SEED = {
    categories: CATEGORIES,
    emirates: EMIRATES,
    gradients: GRADIENTS,
    businesses: SEED_BUSINESSES,
    products: SEED_PRODUCTS,
    reviews: SEED_REVIEWS,
    starDist: STAR_DIST,
    customers: SEED_CUSTOMERS,
    popular: POPULAR,
    emojiSets: EMOJI_SETS
  };
})();
