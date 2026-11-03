// Course-name dictionary: cleaned Hebrew name -> { en, ar }.
// Keys are matched after normalizeHe() (see names.js), so spelling variants
// such as לינארית/ליניארית or ״/" do not need separate entries.
// Moodle sometimes truncates long names (e.g. "הנדסת תוכנה בשירות הקהי");
// a truncated name still matches the full key below.
//
// Missing a course? Add a line here and open a pull request, or put a
// personal translations.json in your config folder (see README).
export const TRANSLATIONS = {
  'אלגברה ליניארית 1': { en: 'Linear Algebra 1', ar: 'الجبر الخطي 1' },
  'אלגברה ליניארית 2': { en: 'Linear Algebra 2', ar: 'الجبر الخطي 2' },
  'חדו"א 1': { en: 'Calculus 1', ar: 'التفاضل والتكامل 1' },
  'חדו"א 2': { en: 'Calculus 2', ar: 'التفاضل والتكامل 2' },
  'מבוא לחדו"א': { en: 'Introduction to Calculus', ar: 'مقدمة في التفاضل والتكامل' },
  'מתמטיקה בדידה 1': { en: 'Discrete Mathematics 1', ar: 'الرياضيات المتقطعة 1' },
  'מתמטיקה בדידה 2': { en: 'Discrete Mathematics 2', ar: 'الرياضيات المتقطعة 2' },
  'לוגיקה מתמטית': { en: 'Mathematical Logic', ar: 'المنطق الرياضي' },
  'הסתברות וסטטיסטיקה 1': { en: 'Probability and Statistics 1', ar: 'الاحتمالات والإحصاء 1' },
  'הסתברות וסטטיסטיקה 2': { en: 'Probability and Statistics 2', ar: 'الاحتمالات والإحصاء 2' },
  'פיסיקה למהנדסי תוכנה': { en: 'Physics for Software Engineers', ar: 'الفيزياء لمهندسي البرمجيات' },

  'מבוא לתכנות': { en: 'Introduction to Programming', ar: 'مقدمة في البرمجة' },
  'מבוא לתכנות מדעי': { en: 'Introduction to Scientific Programming', ar: 'مقدمة في البرمجة العلمية' },
  'תכנות בשפת C ו- C++': { en: 'Programming in C and C++', ar: 'البرمجة بلغتي C و C++' },
  'פיתוח תוכנה מונחה עצמים': { en: 'Object-Oriented Software Development', ar: 'تطوير البرمجيات الكائنية' },
  'תיכון מונחה עצמים': { en: 'Object-Oriented Design', ar: 'تصميم البرمجيات الكائنية' },
  'מבני נתונים': { en: 'Data Structures', ar: 'هياكل البيانات' },
  'אלגוריתמיקה 1': { en: 'Algorithms 1', ar: 'الخوارزميات 1' },
  'אלגוריתמיקה 2': { en: 'Algorithms 2', ar: 'الخوارزميات 2' },
  'אוטומטים ושפות פורמליות': { en: 'Automata and Formal Languages', ar: 'الأوتوماتا واللغات الصورية' },
  'חישוביות וסיבוכיות': { en: 'Computability and Complexity', ar: 'النظرية الحسابية والتعقيد' },
  'מבנה וארגון המחשב': { en: 'Computer Organization and Architecture', ar: 'بنية وتنظيم الحاسوب' },
  'מיתוג ומערכות ספרתיות': { en: 'Switching and Digital Systems', ar: 'التبديل والأنظمة الرقمية' },
  'מיקרופרוססורים': { en: 'Microprocessors', ar: 'المعالجات الدقيقة' },
  'מערכות הפעלה': { en: 'Operating Systems', ar: 'أنظمة التشغيل' },
  'מסדי נתונים': { en: 'Databases', ar: 'قواعد البيانات' },
  'תקשורת מחשבים': { en: 'Computer Networks', ar: 'شبكات الحاسوب' },
  'יישומי תקשורת מחשבים': { en: 'Computer Communication Applications', ar: 'تطبيقات اتصالات الحاسوب' },
  'יישומי תקשורת': { en: 'Computer Communication Applications', ar: 'تطبيقات اتصالات الحاسوب' },
  'תכנות בסביבת אינטרנט': { en: 'Web Programming', ar: 'برمجة الإنترنت' },
  'מבוא להנדסת תוכנה': { en: 'Introduction to Software Engineering', ar: 'مقدمة في هندسة البرمجيات' },
  'תכנון וניהול פרויקטי תוכנה': { en: 'Software Project Planning and Management', ar: 'تخطيط وإدارة مشاريع البرمجيات' },
  'הנדסת תוכנה בשירות הקהילה': { en: 'Software Engineering for the Community', ar: 'هندسة البرمجيات في خدمة المجتمع' },
  'אבטחת מערכות תוכנה': { en: 'Software Systems Security', ar: 'أمن أنظمة البرمجيات' },
  'מבוא ללמידת מכונה': { en: 'Introduction to Machine Learning', ar: 'مقدمة في تعلّم الآلة' },
  'למידה חישובית': { en: 'Computational Learning', ar: 'التعلّم الحسابي' },
  'מעבדה במחשבים - מחומרה לתוכנה': { en: 'Computer Lab – From Hardware to Software', ar: 'مختبر الحاسوب – من العتاد إلى البرمجيات' },
  'הנחיות-פרויקט גמר הנדסת תוכנה': { en: 'Final Project Guidelines – Software Engineering', ar: 'إرشادات مشروع التخرج – هندسة البرمجيات' },
  'ניהול מיזמים': { en: 'Project Management', ar: 'إدارة المشاريع' },
  'New Product and Service': { en: 'New Product and Service', ar: 'تطوير منتجات وخدمات جديدة' },

  'אנגלית - בסיסי': { en: 'English – Basic', ar: 'الإنجليزية – أساسي' },
  "אנגלית - מתקדמים א'": { en: 'English – Advanced A', ar: 'الإنجليزية – متقدم أ' },
  "אנגלית - מתקדמים ב'": { en: 'English – Advanced B', ar: 'الإنجليزية – متقدم ب' },
  "עברית - מתקדמים א'": { en: 'Hebrew – Advanced A', ar: 'العبرية – متقدم أ' },
  "עברית - מתקדמים ב'": { en: 'Hebrew – Advanced B', ar: 'العبرية – متقدم ب' },
  'נ"ז תמורת מעורבות חברתית': { en: 'Credits for Social Involvement', ar: 'ساعات معتمدة مقابل نشاط مجتمعي' },
  'שיעור עזר - מקצועות שנה': { en: 'Help Session – Year Courses', ar: 'حصة مساعدة – مواد السنة' },
};
