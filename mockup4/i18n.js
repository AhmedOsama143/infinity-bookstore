// i18n.js - Arabic/English language toggle for Infinity Bookstore
(function(){
  var translations = {
    // Nav
    'nav-home': { ar: 'الرئيسية', en: 'Home' },
    'nav-books': { ar: 'الكتب', en: 'Books' },
    'nav-teachers': { ar: 'المدرسين', en: 'Teachers' },
    'nav-search': { ar: 'البحث', en: 'Search' },
    'nav-cart': { ar: 'السلة', en: 'Cart' },
    'nav-login': { ar: 'تسجيل الدخول', en: 'Login' },
    'nav-wishlist': { ar: 'المفضلة', en: 'Wishlist' },
    'nav-about': { ar: 'من نحن', en: 'About Us' },
    'nav-stationery': { ar: 'الأدوات', en: 'Stationery' },
    // Hero
    'hero-title': { ar: 'اكتشف أفضل الكتب التعليمية', en: 'Discover the Best Educational Books' },
    'hero-desc': { ar: 'مجموعة مختارة من أفضل كتب المدرسين في مصر لجميع المراحل الدراسية. احجز نسختك الآن!', en: 'Books from the best teachers for all levels. Reserve your copy now!' },
    'hero-btn': { ar: 'تصفح الكتب', en: 'Browse Books' },
    // Section titles
    'featured-books': { ar: 'كتب مميزة', en: 'Featured Books' },
    'featured-books-sub': { ar: 'أحدث الإصدارات والأكثر مبيعاً', en: 'Latest releases and best sellers' },
    'available-books': { ar: 'الكتب المتاحة', en: 'Available Books' },
    'all-books': { ar: 'جميع الكتب', en: 'All Books' },
    'all-books-sub': { ar: 'تصفح مجموعتنا الكاملة من الكتب التعليمية', en: 'Browse our complete collection of educational books' },
    'top-teachers': { ar: 'أفضل المدرسين', en: 'Top Teachers' },
    'top-teachers-sub': { ar: 'نخبة من أفضل المعلمين في مصر', en: 'Elite group of the best teachers in Egypt' },
    'how-to-reserve': { ar: 'كيف تحجز كتابك؟', en: 'How to Reserve Your Book?' },
    'how-to-reserve-sub': { ar: '٤ خطوات بسيطة للحصول على كتابك', en: '4 simple steps to get your book' },
    'student-testimonials': { ar: 'آراء طلابنا', en: 'Student Testimonials' },
    'student-testimonials-sub': { ar: 'ماذا يقول طلابنا عن تجربتهم', en: 'What our students say about their experience' },
    'delivery-info': { ar: 'خدمة التوصيل', en: 'Delivery Service' },
    'delivery-info-sub': { ar: 'نوصل لجميع محافظات مصر', en: 'We deliver to all governorates in Egypt' },
    'student-reviews': { ar: 'تقييمات الطلاب', en: 'Student Reviews' },
    'related-books': { ar: 'كتب ذات صلة', en: 'You May Also Like' },
    // Badges
    'badge-new': { ar: 'وصل حديثاً', en: 'New Arrival' },
    'badge-bestseller': { ar: 'الأكثر مبيعاً', en: 'Best Seller' },
    // Actions
    'view-details': { ar: 'عرض التفاصيل', en: 'View Details' },
    'add-to-cart': { ar: 'أضف للسلة', en: 'Add to Cart' },
    'reserve-now': { ar: 'احجز الآن', en: 'Reserve Now' },
    'view-books': { ar: 'عرض الكتب', en: 'View Books' },
    'view-profile': { ar: 'عرض الملف الشخصي', en: 'View Profile' },
    'browse-books': { ar: 'تصفح الكتب', en: 'Browse Books' },
    'details': { ar: 'التفاصيل', en: 'Details' },
    'added': { ar: 'تمت الإضافة', en: 'Added' },
    // Cart
    'shopping-cart': { ar: 'سلة التسوق', en: 'Shopping Cart' },
    'cart-review': { ar: 'راجع طلباتك قبل إتمام الشراء', en: 'Review your orders before checkout' },
    'cart-empty': { ar: 'سلة التسوق فارغة', en: 'Your cart is empty' },
    'cart-empty-desc': { ar: 'لم تقم بإضافة أي كتب بعد', en: 'You have not added any books yet' },
    'continue-shopping': { ar: 'متابعة التسوق', en: 'Continue Shopping' },
    'checkout': { ar: 'إتمام الشراء', en: 'Checkout' },
    'subtotal': { ar: 'المجموع الفرعي', en: 'Subtotal' },
    'delivery-fee': { ar: 'التوصيل', en: 'Delivery Fee' },
    'discount': { ar: 'الخصم', en: 'Discount' },
    'total': { ar: 'الإجمالي', en: 'Total' },
    'order-summary': { ar: 'ملخص الطلب', en: 'Order Summary' },
    'book-count': { ar: 'عدد الكتب', en: 'Number of Books' },
    // Wishlist
    'wishlist': { ar: 'المفضلة', en: 'Wishlist' },
    'wishlist-sub': { ar: 'الكتب التي أعجبتك', en: 'Books you liked' },
    'wishlist-empty': { ar: 'قائمة المفضلة فارغة', en: 'Your wishlist is empty' },
    'wishlist-empty-desc': { ar: 'لم تقم بإضافة أي كتب للمفضلة بعد', en: 'No books in your wishlist' },
    // Auth
    'login': { ar: 'تسجيل الدخول', en: 'Login' },
    'login-welcome': { ar: 'مرحباً بعودتك! سجل دخولك للمتابعة', en: 'Welcome back! Log in to continue' },
    'full-name': { ar: 'الاسم الكامل', en: 'Full Name' },
    'email': { ar: 'البريد الإلكتروني', en: 'Email' },
    'phone': { ar: 'رقم الهاتف', en: 'Phone' },
    'password': { ar: 'كلمة المرور', en: 'Password' },
    'confirm-password': { ar: 'تأكيد كلمة المرور', en: 'Confirm Password' },
    'grade-level': { ar: 'الصف الدراسي', en: 'Grade Level' },
    'create-account': { ar: 'إنشاء الحساب', en: 'Create Account' },
    'create-account-title': { ar: 'إنشاء حساب جديد', en: 'Create New Account' },
    'create-account-sub': { ar: 'انضم إلينا واستمتع بتجربة تسوق مميزة', en: 'Join us and enjoy a great shopping experience' },
    'already-have-account': { ar: 'لديك حساب بالفعل؟', en: 'Already have an account?' },
    'no-account': { ar: 'ليس لديك حساب؟', en: "Don't have an account?" },
    'forgot-password': { ar: 'نسيت كلمة المرور؟', en: 'Forgot Password?' },
    'remember-me': { ar: 'تذكرني', en: 'Remember me' },
    'login-btn': { ar: 'تسجيل الدخول', en: 'Login' },
    'register-now': { ar: 'سجل الآن', en: 'Register Now' },
    'login-now': { ar: 'سجل الدخول', en: 'Login' },
    'or-login-via': { ar: 'أو سجل عن طريق', en: 'Or login via' },
    'facebook': { ar: 'فيسبوك', en: 'Facebook' },
    'google': { ar: 'جوجل', en: 'Google' },
    'terms-agree': { ar: 'بالتسجيل أنت توافق على', en: 'By registering you agree to' },
    'terms': { ar: 'الشروط والأحكام', en: 'Terms & Conditions' },
    'privacy': { ar: 'سياسة الخصوصية', en: 'Privacy Policy' },
    // Browse by Category
    'browse-categories': { ar: 'تصفح حسب التصنيف', en: 'Browse by Category' },
    'browse-categories-sub': { ar: 'اختر التصنيف الذي يناسبك وابدأ التصفح', en: 'Choose your category and start browsing' },
    'cat-math': { ar: 'الرياضيات', en: 'Mathematics' },
    'cat-math-count': { ar: '٤٥ كتاب', en: '45 Books' },
    'cat-physics': { ar: 'الفيزياء', en: 'Physics' },
    'cat-physics-count': { ar: '٣٨ كتاب', en: '38 Books' },
    'cat-chemistry': { ar: 'الكيمياء', en: 'Chemistry' },
    'cat-chemistry-count': { ar: '٣٢ كتاب', en: '32 Books' },
    'cat-biology': { ar: 'الأحياء', en: 'Biology' },
    'cat-biology-count': { ar: '٢٨ كتاب', en: '28 Books' },
    'cat-arabic': { ar: 'اللغة العربية', en: 'Arabic Language' },
    'cat-arabic-count': { ar: '٥٠ كتاب', en: '50 Books' },
    'cat-english': { ar: 'اللغة الإنجليزية', en: 'English Language' },
    'cat-english-count': { ar: '٤٢ كتاب', en: '42 Books' },
    'cat-history': { ar: 'التاريخ', en: 'History' },
    'cat-history-count': { ar: '٢٠ كتاب', en: '20 Books' },
    'cat-science': { ar: 'العلوم', en: 'Science' },
    'cat-science-count': { ar: '٣٥ كتاب', en: '35 Books' },
    // Category view books link
    'view-cat-books': { ar: 'عرض الكتب', en: 'View Books' },
    // New Arrivals section
    'new-arrivals': { ar: 'وصل حديثاً', en: 'New Arrivals' },
    'new-arrivals-sub': { ar: 'أحدث الكتب التي وصلت مكتبتنا', en: 'Latest books added to our store' },
    'new-book1-title': { ar: 'أساسيات الجبر الخطي', en: 'Linear Algebra Fundamentals' },
    'new-book1-author': { ar: 'أ/ خالد إبراهيم', en: 'Mr. Khaled Ibrahim' },
    'new-book2-title': { ar: 'الفيزياء الحديثة', en: 'Modern Physics' },
    'new-book2-author': { ar: 'أ/ سامي عبدالله', en: 'Mr. Sami Abdullah' },
    'new-book3-title': { ar: 'قواعد اللغة العربية', en: 'Arabic Grammar' },
    'new-book3-author': { ar: 'أ/ منى الشافعي', en: 'Ms. Mona Al-Shafei' },
    'new-book4-title': { ar: 'الكيمياء العضوية', en: 'Organic Chemistry' },
    'new-book4-author': { ar: 'أ/ هاني محمود', en: 'Mr. Hani Mahmoud' },
    'new-book5-title': { ar: 'تاريخ مصر المعاصر', en: 'Modern Egyptian History' },
    'new-book5-author': { ar: 'أ/ عادل حسين', en: 'Mr. Adel Hussein' },
    'new-book6-title': { ar: 'أحياء الخلية', en: 'Cell Biology' },
    'new-book6-author': { ar: 'أ/ ريم عبدالرحمن', en: 'Ms. Reem Abdulrahman' },
    'new-book7-title': { ar: 'English Grammar', en: 'English Grammar' },
    'new-book7-author': { ar: 'Mr. John Smith', en: 'Mr. John Smith' },
    'new-book8-title': { ar: 'الجغرافيا الطبيعية', en: 'Physical Geography' },
    'new-book8-author': { ar: 'أ/ نادية فؤاد', en: 'Ms. Nadia Fouad' },
    // Best Sellers section
    'best-sellers': { ar: 'الأكثر مبيعاً', en: 'Best Sellers' },
    'best-sellers-sub': { ar: 'الكتب الأكثر طلباً من طلابنا', en: 'Most popular books among our students' },
    'best-book1-title': { ar: 'الرياضيات للصف الثالث', en: 'Math for 3rd Year' },
    'best-book1-author': { ar: 'أ/ محمد السعيد', en: 'Mr. Mohamed Al-Saeed' },
    'best-book1-sales': { ar: '+٨٠٠ مبيعات', en: '800+ Sales' },
    'best-book2-title': { ar: 'الفيزياء للصف الثالث', en: 'Physics for 3rd Year' },
    'best-book2-author': { ar: 'أ/ أحمد فاروق', en: 'Mr. Ahmed Farouk' },
    'best-book2-sales': { ar: '+٦٥٠ مبيعات', en: '650+ Sales' },
    'best-book3-title': { ar: 'اللغة العربية الشاملة', en: 'Comprehensive Arabic' },
    'best-book3-author': { ar: 'أ/ فاطمة الزهراء', en: 'Ms. Fatma Al-Zahraa' },
    'best-book3-sales': { ar: '+٥٥٠ مبيعات', en: '550+ Sales' },
    'best-book4-title': { ar: 'الكيمياء المبسطة', en: 'Simplified Chemistry' },
    'best-book4-author': { ar: 'أ/ سارة المنصوري', en: 'Ms. Sara Al-Mansouri' },
    'best-book4-sales': { ar: '+٥٠٠ مبيعات', en: '500+ Sales' },
    'best-book5-title': { ar: 'English Mastery', en: 'English Mastery' },
    'best-book5-author': { ar: 'Mr. David Wilson', en: 'Mr. David Wilson' },
    'best-book5-sales': { ar: '+٤٨٠ مبيعات', en: '480+ Sales' },
    'best-book6-title': { ar: 'الأحياء للمرحلة الثانوية', en: 'Biology for Secondary' },
    'best-book6-author': { ar: 'أ/ ريم عبدالرحمن', en: 'Ms. Reem Abdulrahman' },
    'best-book6-sales': { ar: '+٤٢٠ مبيعات', en: '420+ Sales' },
    'best-book7-title': { ar: 'التفوق في الرياضيات', en: 'Excel in Mathematics' },
    'best-book7-author': { ar: 'أ/ خالد إبراهيم', en: 'Mr. Khaled Ibrahim' },
    'best-book7-sales': { ar: '+٣٨٠ مبيعات', en: '380+ Sales' },
    'best-book8-title': { ar: 'أساسيات الفيزياء', en: 'Physics Fundamentals' },
    'best-book8-author': { ar: 'أ/ سامي عبدالله', en: 'Mr. Sami Abdullah' },
    'best-book8-sales': { ar: '+٣٥٠ مبيعات', en: '350+ Sales' },
    // Subjects
    'math': { ar: 'الرياضيات', en: 'Mathematics' },
    'physics': { ar: 'الفيزياء', en: 'Physics' },
    'chemistry': { ar: 'الكيمياء', en: 'Chemistry' },
    'biology': { ar: 'الأحياء', en: 'Biology' },
    'arabic-lang': { ar: 'اللغة العربية', en: 'Arabic' },
    'english-lang': { ar: 'اللغة الإنجليزية', en: 'English' },
    'history': { ar: 'التاريخ', en: 'History' },
    'geography': { ar: 'الجغرافيا', en: 'Geography' },
    // Steps
    'step-search': { ar: 'ابحث عن كتابك', en: 'Browse Books' },
    'step-search-desc': { ar: 'تصفح مجموعتنا الواسعة من الكتب التعليمية', en: 'Browse our wide collection of educational books' },
    'step-add': { ar: 'أضف للسلة', en: 'Choose Your Book' },
    'step-add-desc': { ar: 'اختر الكتب التي تريدها وأضفها إلى سلة التسوق', en: 'Choose the books you want and add them to cart' },
    'step-complete': { ar: 'أكمل الطلب', en: 'Log In' },
    'step-complete-desc': { ar: 'أدخل بياناتك وعنوان التوصيل', en: 'Enter your details and delivery address' },
    'step-receive': { ar: 'استلم كتابك', en: 'Confirm Reservation' },
    'step-receive-desc': { ar: 'يصلك الكتاب لباب بيتك خلال ٢-٥ أيام', en: 'Your book arrives at your door in 2-5 days' },
    // Sidebar filters
    'filter-subject': { ar: 'المادة', en: 'Subject' },
    'filter-grade': { ar: 'الصف الدراسي', en: 'Grade' },
    'filter-price': { ar: 'السعر', en: 'Price' },
    'apply-filters': { ar: 'تطبيق الفلاتر', en: 'Apply Filters' },
    'all-grades': { ar: 'جميع الصفوف', en: 'All Grades' },
    'grade-1': { ar: 'الصف الأول الثانوي', en: '1st Year Secondary' },
    'grade-2': { ar: 'الصف الثاني الثانوي', en: '2nd Year Secondary' },
    'grade-3': { ar: 'الصف الثالث الثانوي', en: '3rd Year Secondary' },
    'price-up-to': { ar: 'حتى', en: 'Up to' },
    // Footer
    'footer-copyright': { ar: 'جميع الحقوق محفوظة \u00A9 2026 مكتبة إنفينيتي', en: 'All Rights Reserved \u00A9 2026 Infinity Bookstore' },
    'footer-desc': { ar: 'وجهتك الأولى للكتب التعليمية في مصر. نوفر أفضل كتب المدرسين لجميع المراحل الدراسية.', en: 'Your first destination for educational books in Egypt. We provide the best teacher books for all grade levels.' },
    'footer-desc-short': { ar: 'وجهتك الأولى للكتب التعليمية في مصر.', en: 'Your first destination for educational books in Egypt.' },
    'quick-links': { ar: 'روابط سريعة', en: 'Quick Links' },
    'services': { ar: 'خدمات', en: 'Services' },
    'contact-us': { ar: 'تواصل معنا', en: 'Contact Us' },
    'delivery': { ar: 'التوصيل', en: 'Delivery' },
    'by-grade': { ar: 'حسب المرحلة', en: 'By Grade' },
    'faq': { ar: 'الأسئلة الشائعة', en: 'FAQ' },
    'cart-footer': { ar: 'سلة التسوق', en: 'Shopping Cart' },
    'favorites': { ar: 'المفضلة', en: 'Wishlist' },
    // Search page
    'search-title': { ar: 'ابحث عن كتابك', en: 'Search for a Book' },
    'search-sub': { ar: 'ابحث بالعنوان، اسم المدرس، أو المادة', en: 'Search by title, teacher name, or subject' },
    'search-btn': { ar: 'بحث', en: 'Search' },
    'search-results': { ar: 'نتائج البحث', en: 'Search Results' },
    'no-results': { ar: 'لا توجد نتائج', en: 'No results found' },
    'no-results-desc': { ar: 'جرب البحث بكلمات مختلفة أو تصفح الكتب مباشرة', en: 'Try different keywords or browse books directly' },
    'filter-results': { ar: 'تصفية النتائج', en: 'Filter Results' },
    'sort-by': { ar: 'ترتيب حسب', en: 'Sort By' },
    'newest': { ar: 'الأحدث', en: 'Newest' },
    'best-selling': { ar: 'الأكثر مبيعاً', en: 'Best Selling' },
    'price-low': { ar: 'السعر: من الأقل', en: 'Price: Low to High' },
    'price-high': { ar: 'السعر: من الأعلى', en: 'Price: High to Low' },
    'rating': { ar: 'التقييم', en: 'Rating' },
    // Teachers page
    'teachers-title': { ar: 'المدرسين', en: 'Teachers' },
    'teachers-sub': { ar: 'نخبة من أفضل المعلمين في مصر - مرر الماوس لعرض التفاصيل', en: 'Elite teachers in Egypt - hover to see details' },
    'books-available': { ar: 'كتب متاحة', en: 'books available' },
    'student': { ar: 'طالب', en: 'Student' },
    'success': { ar: 'نجاح', en: 'Success' },
    'books': { ar: 'كتب', en: 'Books' },
    // Teacher profile
    'about-teacher': { ar: 'نبذة عن المدرس', en: 'About the Teacher' },
    'qualifications': { ar: 'المؤهلات', en: 'Qualifications' },
    'teacher-books': { ar: 'كتب المدرس', en: "Teacher's Books" },
    'years-exp': { ar: 'سنة خبرة', en: 'Years Exp.' },
    'success-rate': { ar: 'نسبة نجاح', en: 'Success Rate' },
    // Book details
    'add-to-cart-btn': { ar: 'أضف للسلة', en: 'Add to Cart' },
    'reserve-copy': { ar: 'احجز نسختك', en: 'Reserve Your Copy' },
    // Delivery page
    'delivery-title': { ar: 'خدمة التوصيل', en: 'Delivery Service' },
    'delivery-title-sub': { ar: 'نوصل كتبك لباب بيتك في جميع محافظات مصر', en: 'We deliver your books to your door across Egypt' },
    'fast-delivery': { ar: 'توصيل سريع', en: 'Fast Delivery' },
    'fast-delivery-desc': { ar: 'توصيل خلال ٢-٣ أيام عمل للقاهرة والجيزة', en: 'Delivery within 2-3 business days for Cairo and Giza' },
    'full-coverage': { ar: 'تغطية شاملة', en: 'Full Coverage' },
    'full-coverage-desc': { ar: 'نوصل لجميع محافظات مصر بدون استثناء', en: 'We deliver to all governorates without exception' },
    'safe-packaging': { ar: 'تغليف آمن', en: 'Safe Packaging' },
    'safe-packaging-desc': { ar: 'جميع الكتب مغلفة بعناية لضمان وصولها بحالة ممتازة', en: 'All books are carefully wrapped' },
    'cod': { ar: 'الدفع عند الاستلام', en: 'Cash on Delivery' },
    'cod-desc': { ar: 'ادفع كاش عند استلام طلبك', en: 'Pay cash when you receive your order' },
    'free-return': { ar: 'استرجاع مجاني', en: 'Free Returns' },
    'free-return-desc': { ar: 'إمكانية الاسترجاع خلال ٧ أيام', en: 'Returns within 7 days' },
    'support': { ar: 'دعم فني', en: 'Support' },
    'support-desc': { ar: 'فريق خدمة عملاء متاح للرد على استفساراتك', en: 'Customer support team available for your inquiries' },
    'delivery-prices': { ar: 'أسعار التوصيل', en: 'Delivery Prices' },
    'region': { ar: 'المنطقة', en: 'Region' },
    'duration': { ar: 'المدة', en: 'Duration' },
    'cost': { ar: 'التكلفة', en: 'Cost' },
    'order-journey': { ar: 'رحلة طلبك', en: 'Your Order Journey' },
    'order-confirm': { ar: 'تأكيد الطلب', en: 'Order Confirmation' },
    'order-confirm-desc': { ar: 'يتم تأكيد طلبك ومراجعته خلال ساعات', en: 'Your order is confirmed and reviewed within hours' },
    'order-prepare': { ar: 'تجهيز الطلب', en: 'Order Preparation' },
    'order-prepare-desc': { ar: 'يتم تجهيز كتبك وتغليفها بعناية', en: 'Your books are prepared and wrapped carefully' },
    'shipping': { ar: 'الشحن', en: 'Shipping' },
    'shipping-desc': { ar: 'يتم تسليم طلبك لشركة الشحن مع رقم تتبع', en: 'Your order is handed to the courier with a tracking number' },
    'delivery-step': { ar: 'التوصيل', en: 'Delivery' },
    'delivery-step-desc': { ar: 'يصلك الكتاب لباب بيتك والدفع عند الاستلام', en: 'Your book arrives and you pay on delivery' },
    'important-info': { ar: 'معلومات مهمة', en: 'Important Information' },
    'delivery-terms': { ar: 'شروط التوصيل', en: 'Delivery Terms' },
    'return-policy': { ar: 'سياسة الاسترجاع', en: 'Return Policy' },
    // FAQ page
    'faq-title': { ar: 'الأسئلة الشائعة', en: 'FAQ' },
    'faq-sub': { ar: 'إجابات على أكثر الأسئلة شيوعاً', en: 'Answers to the most common questions' },
    'faq-q1': { ar: 'كيف يمكنني طلب كتاب؟', en: 'How can I order a book?' },
    'faq-a1': { ar: 'يمكنك تصفح الكتب المتاحة في قسم الكتب، ثم إضافة الكتب المطلوبة إلى سلة التسوق وإتمام عملية الشراء. سيصلك الكتاب خلال ٢-٥ أيام عمل حسب موقعك.', en: 'You can browse available books, add them to cart and complete the purchase. Your book will arrive within 2-5 business days.' },
    'faq-q2': { ar: 'ما هي طرق الدفع المتاحة؟', en: 'What payment methods are available?' },
    'faq-a2': { ar: 'نوفر خدمة الدفع عند الاستلام (كاش) في جميع المحافظات. كما يمكنك الدفع عبر فودافون كاش أو التحويل البنكي.', en: 'We offer cash on delivery in all governorates. You can also pay via Vodafone Cash or bank transfer.' },
    'faq-q3': { ar: 'كم تستغرق عملية التوصيل؟', en: 'How long does delivery take?' },
    'faq-a3': { ar: 'القاهرة والجيزة: ٢-٣ أيام عمل. الإسكندرية والدلتا: ٣-٤ أيام. باقي المحافظات: ٤-٧ أيام عمل.', en: 'Cairo and Giza: 2-3 business days. Alexandria and Delta: 3-4 days. Other governorates: 4-7 business days.' },
    'faq-q4': { ar: 'هل يمكنني استرجاع الكتاب؟', en: 'Can I return a book?' },
    'faq-a4': { ar: 'نعم، يمكنك استرجاع الكتاب خلال ٧ أيام من تاريخ الاستلام بشرط أن يكون بحالته الأصلية. الاسترجاع مجاني في القاهرة والجيزة.', en: 'Yes, you can return within 7 days of receipt if the book is in its original condition. Free returns in Cairo and Giza.' },
    'faq-q5': { ar: 'هل الكتب أصلية؟', en: 'Are the books original?' },
    'faq-a5': { ar: 'نعم، جميع الكتب المتاحة على موقعنا أصلية ١٠٠% ومن المؤلفين مباشرة. نحن وكلاء معتمدون لجميع المدرسين.', en: 'Yes, all books on our site are 100% original and directly from the authors. We are authorized agents.' },
    'faq-q6': { ar: 'كيف يمكنني تتبع طلبي؟', en: 'How can I track my order?' },
    'faq-a6': { ar: 'بعد تأكيد طلبك ستحصل على رقم تتبع عبر رسالة SMS. يمكنك استخدام هذا الرقم لتتبع طلبك عبر موقع شركة الشحن.', en: 'After confirming your order, you will receive a tracking number via SMS to track your order.' },
    'faq-q7': { ar: 'هل يوجد حد أدنى للطلب؟', en: 'Is there a minimum order?' },
    'faq-a7': { ar: 'نعم، الحد الأدنى للطلب هو ١٠٠ ج.م. الطلبات التي تتجاوز ٥٠٠ ج.م تحصل على توصيل مجاني.', en: 'Yes, minimum order is 100 EGP. Orders over 500 EGP get free delivery.' },
    'faq-q8': { ar: 'كيف أتواصل مع خدمة العملاء؟', en: 'How can I contact customer service?' },
    'faq-a8': { ar: 'يمكنك التواصل معنا عبر واتساب على الرقم 01012345678، أو عبر البريد الإلكتروني info@infinity-books.com. فريقنا متاح يومياً من ٩ صباحاً حتى ٩ مساءً.', en: 'Contact us via WhatsApp at 01012345678 or email info@infinity-books.com. Available daily 9 AM - 9 PM.' },
    'faq-q9': { ar: 'هل يمكنني حجز كتاب قبل صدوره؟', en: 'Can I pre-order a book?' },
    'faq-a9': { ar: 'نعم، نوفر خدمة الحجز المسبق للكتب الجديدة. يمكنك الضغط على زر "احجز نسختك" في صفحة تفاصيل الكتاب وسنتواصل معك فور توفر الكتاب.', en: 'Yes, we offer pre-orders. Click "Reserve Your Copy" on the book page and we will contact you when available.' },
    'faq-q10': { ar: 'هل تتوفر خصومات أو عروض؟', en: 'Are there discounts or offers?' },
    'faq-a10': { ar: 'نعم، نقدم عروض وخصومات دورية خاصة في بداية العام الدراسي وفترات الامتحانات. تابعنا على وسائل التواصل الاجتماعي لمعرفة أحدث العروض.', en: 'Yes, we offer seasonal discounts especially at the start of school year and exam periods. Follow us on social media.' },
    'faq-contact': { ar: 'لم تجد إجابة لسؤالك؟', en: "Didn't find your answer?" },
    'faq-contact-desc': { ar: 'تواصل معنا مباشرة وسنرد عليك في أقرب وقت', en: 'Contact us directly and we will respond ASAP' },
    'faq-whatsapp': { ar: 'تواصل عبر واتساب', en: 'Contact via WhatsApp' },
    // Grade level page
    'grade-level-title': { ar: 'الكتب حسب المرحلة الدراسية', en: 'Books by Grade Level' },
    'grade-level-sub': { ar: 'اختر صفك الدراسي وتصفح الكتب المتاحة', en: 'Choose your grade and browse available books' },
    // Delivery info on index
    'fast-delivery-index': { ar: 'توصيل سريع', en: 'Fast Delivery' },
    'fast-delivery-index-desc': { ar: 'توصيل خلال ٢-٥ أيام عمل لجميع المحافظات', en: 'Delivery within 2-5 business days to all governorates' },
    'quality-guarantee': { ar: 'ضمان الجودة', en: 'Quality Guarantee' },
    'quality-guarantee-desc': { ar: 'جميع الكتب أصلية ومغلفة بعناية', en: 'All books are original and carefully wrapped' },
    'free-return-index': { ar: 'استرجاع مجاني', en: 'Free Returns' },
    'free-return-index-desc': { ar: 'إمكانية الاسترجاع خلال ٧ أيام من الاستلام', en: 'Returns within 7 days of receipt' },
    // Stationery page
    'stationery-title': { ar: 'الأدوات المدرسية', en: 'School Supplies' },
    'stationery-sub': { ar: 'كل ما يحتاجه الطالب من أدوات مدرسية عالية الجودة', en: 'Everything a student needs in high-quality school supplies' },
    'featured-stationery': { ar: 'أدوات مدرسية مميزة', en: 'Featured School Supplies' },
    'featured-stationery-sub': { ar: 'أفضل الأدوات المدرسية لجميع الطلاب', en: 'Best school supplies for all students' },
    'view-all-stationery': { ar: 'عرض جميع الأدوات', en: 'View All Supplies' },
    'filter-all': { ar: 'الكل', en: 'All' },
    // Stationery categories
    'cat-pens': { ar: 'أقلام', en: 'Pens' },
    'cat-notebooks': { ar: 'كراسات ودفاتر', en: 'Notebooks' },
    'cat-bags': { ar: 'حقائب مدرسية', en: 'School Bags' },
    'cat-colors': { ar: 'ألوان وفرش', en: 'Colors & Brushes' },
    'cat-geometry': { ar: 'أدوات هندسية', en: 'Geometry Tools' },
    'cat-files': { ar: 'ملفات ومجلدات', en: 'Files & Folders' },
    'cat-calculators': { ar: 'آلات حاسبة', en: 'Calculators' },
    // Stationery products
    'prod-pens-set': { ar: 'طقم أقلام جاف ملونة', en: 'Colored Ballpoint Pen Set' },
    'prod-pens-set-desc': { ar: '١٢ قلم بألوان متنوعة للكتابة والتلوين', en: '12 pens in various colors for writing and coloring' },
    'prod-parker-pen': { ar: 'قلم حبر باركر فضي', en: 'Silver Parker Ink Pen' },
    'prod-parker-pen-desc': { ar: 'قلم حبر فاخر بتصميم أنيق', en: 'Luxury ink pen with elegant design' },
    'prod-notebook-100': { ar: 'كراسة ١٠٠ ورقة سلك', en: 'Spiral Notebook 100 Pages' },
    'prod-notebook-100-desc': { ar: 'كراسة سلك عملية بغلاف متين', en: 'Practical spiral notebook with durable cover' },
    'prod-notebook-a5': { ar: 'دفتر ملاحظات A5 جلد', en: 'A5 Leather Notebook' },
    'prod-notebook-a5-desc': { ar: 'دفتر أنيق بغلاف جلدي فاخر', en: 'Elegant notebook with luxury leather cover' },
    'prod-backpack': { ar: 'حقيبة مدرسية ظهر كبيرة', en: 'Large School Backpack' },
    'prod-backpack-desc': { ar: 'حقيبة ظهر واسعة ومريحة للطلاب', en: 'Spacious and comfortable backpack for students' },
    'prod-laptop-bag': { ar: 'شنطة لاب توب ١٥ بوصة', en: '15-inch Laptop Bag' },
    'prod-laptop-bag-desc': { ar: 'حقيبة لاب توب مبطنة وعملية', en: 'Padded and practical laptop bag' },
    'prod-color-pencils': { ar: 'علبة ألوان خشب ٢٤ لون', en: '24-Color Wooden Pencil Set' },
    'prod-color-pencils-desc': { ar: 'ألوان خشبية زاهية وسهلة الاستخدام', en: 'Vibrant and easy-to-use wooden colors' },
    'prod-watercolors': { ar: 'طقم ألوان مائية ١٢ لون', en: '12-Color Watercolor Set' },
    'prod-watercolors-desc': { ar: 'ألوان مائية احترافية مع فرشاة', en: 'Professional watercolors with brush' },
    'prod-geometry-set': { ar: 'طقم أدوات هندسية كامل', en: 'Complete Geometry Tool Set' },
    'prod-geometry-set-desc': { ar: 'طقم كامل يشمل فرجار ومنقلة ومثلثات', en: 'Full set including compass, protractor, and triangles' },
    'prod-t-ruler': { ar: 'مسطرة T شفافة ٣٠ سم', en: 'Transparent T-Ruler 30cm' },
    'prod-t-ruler-desc': { ar: 'مسطرة شفافة دقيقة للرسم الهندسي', en: 'Precise transparent ruler for technical drawing' },
    'prod-plastic-file': { ar: 'ملف بلاستيك ٤٠ جيب', en: '40-Pocket Plastic File' },
    'prod-plastic-file-desc': { ar: 'ملف بلاستيك شفاف لحفظ الأوراق', en: 'Transparent plastic file for document storage' },
    'prod-calculator': { ar: 'آلة حاسبة علمية كاسيو', en: 'Casio Scientific Calculator' },
    'prod-calculator-desc': { ar: 'آلة حاسبة علمية متقدمة للطلاب', en: 'Advanced scientific calculator for students' },
    // Stationery details page
    'customer-reviews': { ar: 'تقييمات العملاء', en: 'Customer Reviews' },
    'similar-products': { ar: 'منتجات مشابهة', en: 'Similar Products' },
    'add-to-wishlist': { ar: 'أضف للمفضلة', en: 'Add to Wishlist' },
    'brand': { ar: 'العلامة التجارية:', en: 'Brand:' },
    'color': { ar: 'اللون:', en: 'Color:' },
    'material': { ar: 'المادة:', en: 'Material:' },
    'weight': { ar: 'الوزن:', en: 'Weight:' },
    'country-of-origin': { ar: 'بلد المنشأ:', en: 'Country of Origin:' },
    'quantity': { ar: 'الكمية:', en: 'Quantity:' },
    'in-stock': { ar: 'متوفر في المخزون', en: 'In Stock' },
    'product-specs': { ar: 'مواصفات المنتج', en: 'Product Specifications' },
    // Search placeholder
    'search-placeholder': { ar: 'اكتب كلمة البحث...', en: 'Search for a book...' },
    // Select placeholders
    'choose-grade': { ar: 'اختر الصف الدراسي', en: 'Choose Grade Level' },
    // Misc
    'continue-back': { ar: '← متابعة التسوق', en: 'Continue Shopping' },
    // About Us page
    'about-hero-title': { ar: 'من نحن', en: 'About Us' },
    'about-hero-sub': { ar: 'تعرف على مكتبة إنفينيتي وقصتنا', en: 'Learn about Infinity Bookstore and our story' },
    'about-story-title': { ar: 'قصتنا', en: 'Our Story' },
    'about-story-sub': { ar: 'كيف بدأت رحلتنا في عالم الكتب التعليمية', en: 'How our journey in educational books began' },
    'about-story-heading': { ar: 'رحلة مكتبة إنفينيتي', en: 'The Infinity Bookstore Journey' },
    'about-story-p1': { ar: 'تأسست مكتبة إنفينيتي في عام ٢٠٢٠ بهدف توفير أفضل الكتب التعليمية للطلاب في جميع أنحاء مصر. بدأنا كمشروع صغير بشغف كبير تجاه التعليم، وسرعان ما نمت مكتبتنا لتصبح واحدة من أبرز المكتبات التعليمية في البلاد.', en: 'Infinity Bookstore was founded in 2020 with the goal of providing the best educational books for students across Egypt. We started as a small project with a big passion for education, and our bookstore quickly grew to become one of the leading educational bookstores in the country.' },
    'about-story-p2': { ar: 'نؤمن بأن التعليم هو أساس بناء المستقبل، ولذلك نعمل جاهدين على توفير أفضل المحتويات التعليمية من أمهر المدرسين والمؤلفين لمساعدة كل طالب على تحقيق أحلامه وطموحاته الأكاديمية.', en: 'We believe that education is the foundation for building the future, which is why we work hard to provide the best educational content from the most skilled teachers and authors to help every student achieve their dreams and academic aspirations.' },
    'about-vm-title': { ar: 'رؤيتنا ورسالتنا', en: 'Our Vision & Mission' },
    'about-vm-sub': { ar: 'نطمح للأفضل دائماً', en: 'We always aspire to be the best' },
    'about-vision-title': { ar: 'الرؤية', en: 'Vision' },
    'about-vision-text': { ar: 'أن نكون المكتبة التعليمية الأولى في مصر والوطن العربي، ونساهم في بناء جيل متعلم ومثقف قادر على مواجهة تحديات المستقبل بثقة وعلم.', en: 'To be the leading educational bookstore in Egypt and the Arab world, contributing to building an educated and cultured generation capable of facing future challenges with confidence and knowledge.' },
    'about-mission-title': { ar: 'الرسالة', en: 'Mission' },
    'about-mission-text': { ar: 'توفير كتب تعليمية عالية الجودة بأسعار مناسبة لجميع الطلاب، مع ضمان وصولها لكل طالب في أي مكان في مصر بسهولة وسرعة.', en: 'Providing high-quality educational books at affordable prices for all students, ensuring they reach every student anywhere in Egypt easily and quickly.' },
    'about-why-title': { ar: 'لماذا تختارنا؟', en: 'Why Choose Us?' },
    'about-why-sub': { ar: 'مميزات تجعلنا الخيار الأفضل', en: 'Features that make us the best choice' },
    'about-feat1-title': { ar: 'كتب من أفضل المدرسين', en: 'Books from Top Teachers' },
    'about-feat1-desc': { ar: 'نتعاون مع نخبة من أفضل المعلمين والمؤلفين في مصر لتوفير محتوى تعليمي متميز', en: 'We collaborate with elite teachers and authors in Egypt to provide outstanding educational content' },
    'about-feat2-title': { ar: 'أسعار مناسبة', en: 'Affordable Prices' },
    'about-feat2-desc': { ar: 'نحرص على تقديم أفضل الأسعار التنافسية لتكون الكتب في متناول جميع الطلاب', en: 'We offer the best competitive prices to make books accessible to all students' },
    'about-feat3-title': { ar: 'توصيل لجميع المحافظات', en: 'Delivery to All Governorates' },
    'about-feat3-desc': { ar: 'نوصل كتبك لباب بيتك في أي محافظة في مصر خلال ٢-٥ أيام عمل', en: 'We deliver your books to your door in any governorate in Egypt within 2-5 business days' },
    'about-feat4-title': { ar: 'خدمة عملاء متميزة', en: 'Outstanding Customer Service' },
    'about-feat4-desc': { ar: 'فريق خدمة عملاء محترف متاح يومياً للرد على جميع استفساراتك ومساعدتك', en: 'A professional customer service team available daily to answer all your inquiries and assist you' },
    'about-counter1-num': { ar: '+٥٠٠', en: '500+' },
    'about-counter1-label': { ar: 'كتاب', en: 'Books' },
    'about-counter2-num': { ar: '+١٠٠', en: '100+' },
    'about-counter2-label': { ar: 'مدرس', en: 'Teachers' },
    'about-counter3-num': { ar: '+١٠,٠٠٠', en: '10,000+' },
    'about-counter3-label': { ar: 'طالب', en: 'Students' },
    'about-counter4-num': { ar: '+٢٠', en: '20+' },
    'about-counter4-label': { ar: 'محافظة', en: 'Governorates' },
    'about-team-title': { ar: 'فريق العمل', en: 'Our Team' },
    'about-team-sub': { ar: 'تعرف على فريقنا المتميز', en: 'Meet our outstanding team' },
    'about-team1-name': { ar: 'أحمد محمد', en: 'Ahmed Mohamed' },
    'about-team1-role': { ar: 'المدير العام', en: 'General Manager' },
    'about-team1-desc': { ar: 'خبرة أكثر من ١٠ سنوات في إدارة المشاريع التعليمية. يقود فريق مكتبة إنفينيتي بشغف ورؤية واضحة نحو التميز.', en: 'Over 10 years of experience in managing educational projects. He leads the Infinity Bookstore team with passion and a clear vision towards excellence.' },
    'about-team2-name': { ar: 'سارة أحمد', en: 'Sara Ahmed' },
    'about-team2-role': { ar: 'مدير المبيعات', en: 'Sales Manager' },
    'about-team2-desc': { ar: 'متخصصة في التسويق والمبيعات مع خبرة ٧ سنوات. تعمل على توسيع نطاق خدماتنا وتحسين تجربة العملاء.', en: 'Specialized in marketing and sales with 7 years of experience. She works on expanding our services and improving customer experience.' },
    'about-team3-name': { ar: 'محمد حسن', en: 'Mohamed Hassan' },
    'about-team3-role': { ar: 'خدمة العملاء', en: 'Customer Service' },
    'about-team3-desc': { ar: 'يضمن رضا عملائنا من خلال تقديم دعم استثنائي والرد السريع على جميع الاستفسارات والمشكلات.', en: 'Ensures customer satisfaction through exceptional support and quick responses to all inquiries and issues.' },
    'about-team4-name': { ar: 'نور الدين', en: 'Nour El-Din' },
    'about-team4-role': { ar: 'مدير التوصيل', en: 'Delivery Manager' },
    'about-team4-desc': { ar: 'يشرف على عمليات التوصيل لضمان وصول الكتب بأمان وسرعة إلى جميع محافظات مصر.', en: 'Oversees delivery operations to ensure books arrive safely and quickly to all governorates in Egypt.' },
    'about-cta-title': { ar: 'تواصل معنا', en: 'Contact Us' },
    'about-cta-address': { ar: 'القاهرة، مصر', en: 'Cairo, Egypt' },
    'about-cta-whatsapp': { ar: 'تواصل عبر واتساب', en: 'Contact via WhatsApp' }
  };

  function getLang() {
    return localStorage.getItem('lang') || 'ar';
  }

  function setLang(lang) {
    localStorage.setItem('lang', lang);
  }

  function applyLang(lang) {
    var html = document.documentElement;
    html.setAttribute('lang', lang);
    html.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.body.style.direction = lang === 'ar' ? 'rtl' : 'ltr';

    // Update all elements with data-i18n
    var elements = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      var key = el.getAttribute('data-i18n');
      if (translations[key] && translations[key][lang]) {
        var tag = el.tagName.toLowerCase();
        if (tag === 'input' && el.getAttribute('placeholder')) {
          el.setAttribute('placeholder', translations[key][lang]);
        } else {
          el.textContent = translations[key][lang];
        }
      }
    }

    // Update toggle button
    var toggleBtn = document.querySelector('.lang-toggle');
    if (toggleBtn) {
      toggleBtn.textContent = lang === 'ar' ? 'EN' : '\u0639\u0631\u0628\u064A';
    }

    // Adjust border directions for LTR/RTL
    var bookCards = document.querySelectorAll('.book-card, .related-card, .author-card, .info-card, .product-card, .feature-card');
    for (var j = 0; j < bookCards.length; j++) {
      if (lang === 'en') {
        bookCards[j].style.borderRight = 'none';
        bookCards[j].style.borderLeft = '4px solid var(--gold)';
      } else {
        bookCards[j].style.borderLeft = 'none';
        bookCards[j].style.borderRight = '4px solid var(--gold)';
      }
    }

    // Adjust profile body h2 border
    var profileH2s = document.querySelectorAll('.profile-body h2');
    for (var k = 0; k < profileH2s.length; k++) {
      if (lang === 'en') {
        profileH2s[k].style.borderRight = 'none';
        profileH2s[k].style.borderLeft = '4px solid var(--gold)';
        profileH2s[k].style.paddingRight = '0';
        profileH2s[k].style.paddingLeft = '12px';
      } else {
        profileH2s[k].style.borderLeft = 'none';
        profileH2s[k].style.borderRight = '4px solid var(--gold)';
        profileH2s[k].style.paddingLeft = '0';
        profileH2s[k].style.paddingRight = '12px';
      }
    }

    // Adjust FAQ border
    var faqItems = document.querySelectorAll('.faq-item');
    for (var m = 0; m < faqItems.length; m++) {
      if (lang === 'en') {
        faqItems[m].style.borderRight = 'none';
        faqItems[m].style.borderLeft = '4px solid var(--gold)';
      } else {
        faqItems[m].style.borderLeft = 'none';
        faqItems[m].style.borderRight = '4px solid var(--gold)';
      }
    }
  }

  function toggleLang() {
    var current = getLang();
    var next = current === 'ar' ? 'en' : 'ar';
    setLang(next);
    applyLang(next);
  }

  // Expose globally
  window.toggleLang = toggleLang;
  window.applyLang = applyLang;
  window.getLang = getLang;

  // Apply on load
  document.addEventListener('DOMContentLoaded', function() {
    applyLang(getLang());
  });
})();
