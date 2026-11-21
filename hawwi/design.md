# Hawwi (حووي) — Product & Design Specification

Version 1.0 · Status: ready to build · Audience: the developer building the single-page web app

"Hawwi" (حووي) comes from the Gulf word for a trader's carry-pouch and the habit of gathering good things from home kitchens and workshops. The app connects customers in the UAE with home-based businesses (المشاريع المنزلية) and lets them order ahead for pickup or delivery.

Everything in this document is original: name, logo, copy, palette and demo data. No existing app's branding is referenced or imitated.

---

## Table of contents

1. Product summary and principles
2. Information architecture
3. Customer screens
4. Business-owner screens
5. Visual system
6. Components
7. Copy (string table)
8. Demo data
9. Persistence
10. Accessibility
11. Build notes and acceptance checklist

---

## 1. Product summary and principles

### 1.1 Summary

Hawwi is a mobile-first, order-ahead web app. Customers:

- browse home businesses by emirate and category (Home cooking, Sweets, Perfumes & bakhoor, Abayas, Crafts),
- open a business, pick products with options and add-ons,
- choose pickup or delivery and a time slot (ASAP or a 30-minute slot today/tomorrow within opening hours),
- pay with a simulated card, Apple Pay or cash,
- track the order through a timed, animated status flow.

Business owners switch into owner mode from the profile to see a dashboard, accept and progress incoming orders, manage products and edit their business profile and weekly hours. Customer and owner views share the same `localStorage`, so the full loop works in one browser.

There is no backend. All data is seeded from the demo data in section 8, with user changes stored as overrides in `localStorage`.

### 1.2 Principles

1. **Arabic first.** The default language is Arabic (`<html lang="ar" dir="rtl">`). Every label has an English equivalent; the English toggle flips the entire app to LTR (`lang="en" dir="ltr"`). No mixed-direction layout bugs: use CSS logical properties (`margin-inline-start`, `padding-inline-end`, `inset-inline-start`, `text-align: start`) everywhere.
2. **Modern Gulf look.** Warm sand backgrounds, deep date-palm green as the brand colour, saffron/gold accents, generous rounded corners, soft shadows, a subtle geometric (mashrabiya-inspired) pattern only on the splash and the home header. Clean, not ornamental.
3. **Mobile-first frame.** The app renders inside a 390px-wide phone frame. On viewports wider than 480px the frame is centred horizontally, has a height of `min(100vh, 844px)`, `border-radius: 32px`, a shadow, and the page background shows the sand pattern. On viewports 480px and below the frame fills the screen (100% width, `100dvh`, no radius). The frame is the scroll container; the top app bar and bottom tab bar are sticky inside it.
4. **Order-ahead, honest timing.** Every time shown is real local time (`Asia/Dubai` assumption: use the device clock). Slots respect each business's weekly hours. Closed businesses can still be browsed and pre-ordered for a future slot, but not "ASAP".
5. **Trust in home businesses.** Show the owner's first name, the area, rating and review count everywhere a business appears. Copy is warm and personal ("من مطبخ أم سعيد" / "From Um Saeed's kitchen").
6. **Fast and forgiving.** Instant feedback with toasts, undo where cheap (remove from cart), confirms only for destructive actions (delete product, reset demo data, clearing a cart from another business).
7. **Demo-complete.** Everything works offline in one HTML file: fake OTP (any 4 digits), fake payment, simulated order progression, owner mode on the same data.

### 1.3 Tech assumptions for the builder

- One `index.html` (inline CSS and JS are acceptable; splitting into `styles.css` and `app.js` is also fine). No frameworks required. No build step.
- Fonts from Google Fonts only: `IBM Plex Sans Arabic` (400, 500, 600, 700) and `Inter` (400, 500, 600, 700).
- Hash router (`window.onhashchange`). Unknown routes redirect to `#/home` (or `#/owner/dashboard` in owner mode).
- Icons: emoji or inline SVG only. No icon fonts, no external images.
- Currency formatting: see section 7.3.

---

## 2. Information architecture

### 2.1 Route list

| Route | Screen | Tab bar | Auth needed |
|---|---|---|---|
| `#/splash` | Splash (auto → onboarding or home after 1.2s) | none | no |
| `#/onboarding` | Onboarding, 3 slides | none | no |
| `#/login` | Phone entry | none | no |
| `#/otp` | OTP entry (reads pending phone from memory) | none | no |
| `#/signup-name` | Name step for new users | none | no |
| `#/home` | Home | customer | no (browse as guest) |
| `#/search?q=&cat=&emirate=&sort=` | Search results and filters | customer | no |
| `#/category/:catId` | Shortcut: same screen as search with `cat` preset | customer | no |
| `#/business/:id` | Business page (tabs: Products, Reviews, About) | none (back bar + floating cart bar) | no |
| `#/business/:id/reviews` | Business page with Reviews tab active | none | no |
| `#/product/:bid/:pid` | Product details (full-screen sheet style) | none | no |
| `#/cart` | Cart | customer | no |
| `#/checkout` | Checkout | none | **yes** |
| `#/order-placed/:orderId` | Success screen | none | yes |
| `#/track/:orderId` | Order tracking | none | yes |
| `#/orders` | Order history (Active / Past tabs) | customer | yes (shows login prompt otherwise) |
| `#/favorites` | Favourites | customer | yes (login prompt otherwise) |
| `#/profile` | Profile | customer | no (guest card with "Log in") |
| `#/settings` | Settings | none (back bar) | no |
| `#/owner/select` | Choose which business to manage (demo) | none | yes |
| `#/owner/dashboard` | Owner dashboard | owner | yes + owner mode |
| `#/owner/orders` | Incoming orders (tabs: New, In progress, Ready, Done) | owner | yes + owner mode |
| `#/owner/orders/:orderId` | Owner order detail | none | yes + owner mode |
| `#/owner/products` | Manage products | owner | yes + owner mode |
| `#/owner/products/new` | Add product form | none | yes + owner mode |
| `#/owner/products/:pid/edit` | Edit product form | none | yes + owner mode |
| `#/owner/profile` | Business profile and weekly hours editor | owner | yes + owner mode |

Guard rules:

- If a route needs auth and there is no user, store the intended route in memory as `returnTo`, go to `#/login`, and after a successful login/sign-up navigate to `returnTo`.
- If a route starts with `#/owner/` and owner mode is off, go to `#/profile`.
- If `onboardingSeen` is false on first load, start at `#/splash` → `#/onboarding`. Otherwise `#/splash` → `#/home` (or `#/owner/dashboard` if `ownerMode` is on).
- Unknown `:id` (business, product, order): render the "not found" empty state with a button back to Home.

### 2.2 Customer bottom tab bar (5 items)

Order follows reading direction (in RTL the first item sits at the right edge).

| # | Icon | Arabic | English | Route | Badge |
|---|---|---|---|---|---|
| 1 | 🏠 | الرئيسية | Home | `#/home` | — |
| 2 | 🔍 | استكشف | Explore | `#/search` | — |
| 3 | 🛍️ | السلة | Cart | `#/cart` | item count (saffron badge) |
| 4 | 🧾 | طلباتي | Orders | `#/orders` | count of active orders (green dot with number) |
| 5 | 👤 | حسابي | Account | `#/profile` | — |

Favourites are reached from Home (heart icon in the header) and from Profile.

### 2.3 Owner bottom tab bar (4 items)

| # | Icon | Arabic | English | Route | Badge |
|---|---|---|---|---|---|
| 1 | 📊 | لوحة التحكم | Dashboard | `#/owner/dashboard` | — |
| 2 | 📥 | الطلبات | Orders | `#/owner/orders` | count of orders with status `received` (red badge) |
| 3 | 🧺 | المنتجات | Products | `#/owner/products` | — |
| 4 | 🏪 | متجري | My shop | `#/owner/profile` | — |

The owner app bar shows a pill "وضع صاحب المشروع / Owner mode" and a button "العودة للتسوق / Back to shopping" that turns owner mode off and goes to `#/home`.

### 2.4 Screen map

```
Splash → Onboarding → Home ─┬─ Search/Category ─ Business ─ Product ─┐
                            ├─ Business ─────────────────────────────┤
                            │                                        ▼
                            │                                      Cart ─ (Login→OTP→Name) ─ Checkout ─ Order placed ─ Track
                            ├─ Favorites
                            ├─ Orders ─ Track / Reorder→Cart
                            └─ Profile ─ Settings
                                       └─ Owner mode → Owner select → Dashboard ⇄ Orders ⇄ Products ⇄ My shop
```

---
## 3. Customer screens

Wireframes are drawn in RTL (Arabic) unless noted. "←" back arrow in RTL points right (→); see mirroring rules in 6.17. Width of every wireframe = 390px frame.

Common states used below:

- **Loading:** every data screen shows skeletons for 400ms on first render (simulated latency), so the skeleton component is exercised. Subsequent visits within the session render immediately.
- **Error:** data is local, so the realistic error is corrupted or unavailable storage. If parsing a stored key fails, fall back to seed data, log a console warning and show a one-time toast "تعذّر تحميل بعض البيانات المحفوظة، استعدنا البيانات الافتراضية" / "Some saved data couldn't be loaded; defaults restored". Unknown IDs show the "not found" empty state.

### 3.1 Splash

```
┌──────────────────────────────┐
│                              │
│      (geometric pattern)     │
│                              │
│           ┌──────┐           │
│           │  🧺  │  logo     │
│           └──────┘           │
│            حووي              │
│     من البيت… إلى بابك        │
│                              │
│            • • •             │
└──────────────────────────────┘
```

- Background: `--c-primary` with the pattern at 8% opacity. Logo mark: 88px rounded square (`--r-xl`), `--c-sand-50` fill, 🧺 emoji at 48px. Wordmark "حووي" 36px/700 in sand; in English mode "Hawwi".
- Tagline: "من البيت… إلى بابك" / "From home kitchens to your door".
- Three dots pulse (motion `--m-slow`, staggered 150ms). After 1200ms navigate (see guard rules). Tapping anywhere skips the wait.
- No empty/error states.

### 3.2 Onboarding (3 slides)

```
┌──────────────────────────────┐
│ English                تخطي  │  ← language link (start), Skip (end)
│                              │
│      ┌──────────────────┐    │
│      │   gradient card  │    │
│      │       🍲 🧁       │    │
│      └──────────────────┘    │
│                              │
│   أطيب ما في البيوت           │
│   اكتشف مشاريع منزلية…        │
│                              │
│           ●  ○  ○            │
│ ┌──────────────────────────┐ │
│ │          التالي          │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

Slides:

| # | Art (emoji on gradient) | Title AR / EN | Body AR / EN |
|---|---|---|---|
| 1 | 🍲🧁 on green→teal | أطيب ما في البيوت / The best of home-made | اكتشف مشاريع منزلية قريبة منك: أكل بيت، حلويات، عطور، عبايات وأشغال يدوية. / Discover home businesses near you: home cooking, sweets, perfumes, abayas and crafts. |
| 2 | ⏰🛍️ on saffron→sand | اطلب مسبقاً على راحتك / Order ahead, your way | اختر وقت الاستلام أو التوصيل، اليوم أو بكرة، وخلّ الباقي علينا. / Pick a pickup or delivery time, today or tomorrow, and leave the rest to us. |
| 3 | 📍✅ on teal→green | تابع طلبك لحظة بلحظة / Track every step | من استلام الطلب إلى باب بيتك، تعرف وين وصل طلبك. / From the kitchen to your door, always know where your order is. |

Interactions:

- Horizontal swipe (pointer events; threshold 50px) and the primary button both advance. In RTL, swiping left-to-right goes to the *next* slide (direction mirrors).
- Dots: 8px circles, active dot widens to 24px pill in `--c-primary`. Dots are buttons (`aria-label="الشريحة 2 من 3"`).
- Last slide button reads "ابدأ الآن / Get started" → sets `onboardingSeen=true` → `#/home`.
- "تخطي / Skip" sets `onboardingSeen=true` → `#/home`.
- Language link toggles AR/EN immediately (persisted).

### 3.3 Phone login

```
┌──────────────────────────────┐
│ →                            │
│  أهلاً فيك 👋                 │
│  سجّل دخولك برقم جوالك        │
│                              │
│  رقم الجوال                   │
│ ┌────────────┬─────────────┐ │
│ │ 50 123 4567│ 🇦🇪 +971    │ │  (dir="ltr" input group)
│ └────────────┴─────────────┘ │
│  مثال: 50 123 4567            │
│                              │
│ ┌──────────────────────────┐ │
│ │      أرسل رمز التحقق      │ │
│ └──────────────────────────┘ │
│  بالمتابعة أنت توافق على      │
│  الشروط وسياسة الخصوصية       │
└──────────────────────────────┘
```

- The phone input group is always `dir="ltr"` (numbers read LTR in both languages); the "+971" prefix chip is fixed and non-editable.
- Input: `inputmode="numeric"`, `autocomplete="tel-national"`, max 9 digits after removing spaces; leading 0 is stripped automatically ("050…" → "50…"). Display formatting: `5X XXX XXXX`.
- Validation regex on the 9 digits: `^5[024568]\d{7}$` (UAE mobile prefixes 50, 52, 54, 55, 56, 58). Error text under the field: "أدخل رقم جوال إماراتي صحيح يبدأ بـ 5" / "Enter a valid UAE mobile number starting with 5".
- Button disabled until 9 digits. On tap: 600ms spinner in the button → store pending phone `+9715XXXXXXXX` in memory → `#/otp`.
- Arabic-Indic digits typed (٠-٩) are normalised to Latin digits.

### 3.4 OTP

```
┌──────────────────────────────┐
│ →                            │
│  أدخل رمز التحقق              │
│  أرسلنا رمزاً من 4 أرقام إلى   │
│  +971 50 123 4567  تعديل      │
│                              │
│   ┌──┐ ┌──┐ ┌──┐ ┌──┐        │  (dir="ltr")
│   │ 1│ │ 2│ │  │ │  │        │
│   └──┘ └──┘ └──┘ └──┘        │
│                              │
│ للتجربة: أي 4 أرقام عدا 0000  │  (info chip)
│  إعادة الإرسال بعد 0:30        │
│ ┌──────────────────────────┐ │
│ │          تحقّق            │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

- Four 56×56 boxes, `inputmode="numeric"`, `autocomplete="one-time-code"`, each takes one digit, auto-advance on input, Backspace on an empty box moves to the previous one, paste of 4 digits fills all.
- Any 4 digits are valid, except `0000`, which is reserved to demonstrate the error state. When the 4th digit is entered, auto-submit after 300ms.
- Resend countdown 30s; when 0, link "إعادة إرسال الرمز / Resend code" → toast "أرسلنا رمزاً جديداً / New code sent", restart countdown.
- "تعديل / Edit" returns to `#/login` with the number pre-filled.
- Submit: spinner 500ms → if a user with this phone exists in `hawwi.user` (same phone), log in (toast "أهلاً بعودتك، {name}" / "Welcome back, {name}") → `returnTo` or `#/home`. Otherwise → `#/signup-name`.
- Error state (`0000`): boxes shake (300ms), red border, boxes clear and the first is focused, text "الرمز غير صحيح، حاول مرة ثانية" / "Incorrect code, please try again". Info chip copy: "للتجربة: أي 4 أرقام عدا 0000" / "Demo: any 4 digits except 0000".

### 3.5 Sign-up name step

```
┌──────────────────────────────┐
│  آخر خطوة! ✨                  │
│  وش نناديك؟                   │
│ ┌──────────────────────────┐ │
│ │ الاسم                     │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ البريد الإلكتروني (اختياري)│ │
│ └──────────────────────────┘ │
│  الإمارة:  [دبي ▾]            │
│ ┌──────────────────────────┐ │
│ │       إنشاء الحساب        │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

- Name: required, 2–40 chars, trimmed. Email optional, validated with a simple `^[^\s@]+@[^\s@]+\.[^\s@]+$`. Emirate select defaults to Dubai.
- Create: save `hawwi.user` → toast "حياك الله يا {name}! 🎉" / "Welcome, {name}! 🎉" → `returnTo` or `#/home`.

### 3.6 Home

```
┌──────────────────────────────┐
│ مساء الخير، نورة 🌙      ♡  🔔│  greeting (start) · favourites · notifications
│ 📍 التوصيل إلى: دبي، البرشاء ▾ │  emirate/location picker
│ ┌──────────────────────────┐ │
│ │ 🔍 ابحث عن مشروع أو منتج   │ │
│ └──────────────────────────┘ │
│ [الكل][🍲 أكل بيت][🧁 حلويات] →│  category chips (horizontal scroll)
│                              │
│  مميز هذا الأسبوع      عرض الكل │
│ ┌────────────────────┐┌───   │  featured carousel (snap)
│ │ cover gradient 🍲   ││      │
│ │ مطبخ أم سعيد ⭐4.9   ││      │
│ │ البرشاء · مفتوح      ││      │
│ └────────────────────┘└───   │
│        ● ○ ○ ○               │
│                              │
│  قريب منك               (12)  │
│ ┌──────────────────────────┐ │
│ │[🧁] حلويات ريم            │ │  list row card
│ │     ⭐4.8 (212) · الخان    │ │
│ │     استلام · توصيل 10 د.إ │♡│
│ └──────────────────────────┘ │
│ ...                          │
├──────────────────────────────┤
│ 🏠    🔍    🛍️²   🧾    👤   │
└──────────────────────────────┘
```

Contents:

- **Greeting** by hour: 05:00–11:59 "صباح الخير" / "Good morning"; 12:00–17:59 "مساء الخير" / "Good afternoon"; 18:00–04:59 "مساء النور" / "Good evening". Append ", {firstName}" if logged in; guest: "أهلاً فيك" / "Welcome". Emoji: ☀️ morning, 🌤️ afternoon, 🌙 evening.
- **Header icons:** ♡ → `#/favorites`; 🔔 → toast "ما عندك إشعارات جديدة" / "No new notifications" (if notifications setting off: "الإشعارات متوقفة من الإعدادات" / "Notifications are off in Settings").
- **Location picker:** tap opens a bottom sheet with the emirates as radio rows (Dubai, Sharjah, Ajman, Abu Dhabi, Ras Al Khaimah, Fujairah, plus "كل الإمارات / All emirates" at top) and under the selected emirate a list of area chips from businesses in that emirate. Selection stored in `hawwi.prefs.emirate` / `area`. Default: user's emirate or "All emirates".
- **Search field:** read-only on Home; tap → `#/search` with input focused.
- **Category chips:** All, 🍲 Home cooking, 🧁 Sweets, 🌸 Perfumes & bakhoor, 👗 Abayas, 🧶 Crafts. Tapping a chip → `#/category/:catId`.
- **Featured carousel:** businesses with `featured: true` filtered by emirate (if none in emirate, show all featured). Cards 300×168, horizontal scroll-snap, 12px gap, dots below synced with scroll position (IntersectionObserver). Auto-advance every 5s, paused on touch/hover and when `prefers-reduced-motion`.
- **Nearby list:** all businesses in the selected emirate (and area, if chosen, first), sorted: open now first, then rating desc. Each row: logo tile 56px, name, rating + count, area, open/closed badge, fulfilment line (e.g. "استلام · توصيل 10 د.إ"), favourite heart button.

States:

- Loading: skeleton greeting line, 3 chip skeletons, 1 carousel card skeleton, 4 list-row skeletons.
- Empty (no businesses in emirate/area): empty state 🏜️ "ما في مشاريع في هذه المنطقة بعد" / "No businesses in this area yet" + button "عرض كل الإمارات / Show all emirates".

Interactions: tap card/row → `#/business/:id`; heart toggles favourite (requires login → login flow with `returnTo` = current); pull-to-refresh not required.

### 3.7 Search results and category filter

```
┌──────────────────────────────┐
│ → ┌────────────────────────┐ │
│   │ 🔍 كنافة            ✕  │ │
│   └────────────────────────┘ │
│ [الكل][أكل بيت][حلويات●]...   │
│ [📍 دبي ▾] [ترتيب: الأعلى تقييماً ▾] [مفتوح الآن] [توصيل] │
│ مشاريع (2)                    │
│ ┌ row ┐                      │
│ منتجات (5)                    │
│ ┌──────┐ ┌──────┐            │  2-col product grid
│ │ 🍮   │ │ 🍮   │            │
│ │كنافة…│ │…     │            │
│ │24 د.إ│ │      │            │
│ └──────┘ └──────┘            │
├──────────────────────────────┤
│ tab bar                      │
└──────────────────────────────┘
```

- Query matching: case-insensitive, diacritics-insensitive for Arabic (strip tashkeel `[ً-ْ]`, normalise أ/إ/آ→ا, ة→ه, ى→ي) on both Arabic and English names, product names, and business tags. Debounce 250ms. Query and filters reflected in the hash query string.
- Filters: category chips (single select), emirate dropdown, sort (Top rated / Nearest = same emirate & area first / Price low→high for products / Most reviewed), toggle chips "مفتوح الآن / Open now" and "توصيل / Delivery".
- Results in two sections: Businesses (list rows) and Products (2-column grid cards: emoji tile, name, business name small, price). Product card → `#/product/:bid/:pid`.
- Empty query with no category: show "عمليات بحث رائجة / Popular searches" chips: مجبوس، كنافة، لقيمات، بخور، عبايات، دخون، كيك، شموع.
- Empty results: 🔍 "ما لقينا نتائج لـ '{q}'" / "No results for '{q}'" + "جرّب كلمة ثانية أو امسح الفلاتر" / "Try another word or clear filters" + button "مسح الفلاتر / Clear filters".
- Recent searches (last 5) stored in memory only (not required to persist).

### 3.8 Business page

```
┌──────────────────────────────┐
│ ┌──────────────────────────┐ │
│ │ cover gradient + emoji    │ │  180px cover
│ │ (→)                (♡)(⤴)│ │  back, favourite, share
│ └──────────────────────────┘ │
│   ┌────┐                     │
│   │ 🍲 │ مطبخ أم سعيد  [مفتوح]│  logo overlaps cover by 28px
│   └────┘ أم سعيد · البرشاء، دبي│
│ ⭐ 4.9 (318 تقييم) · 🛵 توصيل 10 د.إ · 🏃 استلام │
│ 🕘 اليوم 11:00 ص – 10:00 م  ▾ │  expandable weekly hours
│ ┌───────┬────────┬────────┐  │
│ │المنتجات│التقييمات│ عن المشروع│  │  tabs
│ └───────┴────────┴────────┘  │
│ [الكل][أطباق رئيسية][مقبلات]  │  product section chips
│ ┌──────┐ ┌──────┐            │
│ │  🍛  │ │  🥘  │            │
│ │مجبوس │ │هريس  │            │
│ │45 د.إ│ │35 د.إ│ (+)        │
│ └──────┘ └──────┘            │
│ ┌──────────────────────────┐ │
│ │ 🛍️ 2 · عرض السلة   92 د.إ │ │  floating cart bar if cart has items from this business
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

Contents:

- Cover: 180px, linear gradient from the business's `colors[0]` to `colors[1]` at 135°, large emoji (72px, 25% opacity) placed at inline-end, plus the pattern overlay. Buttons are 40px circles with `rgba(255,255,255,.9)` background.
- Share: uses `navigator.share` when available, else copies `location.href` and toasts "تم نسخ الرابط / Link copied".
- Open/closed badge: computed from weekly hours and the current time. States: "مفتوح / Open" (green), "يسكّر قريباً / Closing soon" (amber, within 30 minutes of closing), "مغلق · يفتح {day} {time}" / "Closed · opens {day} {time}" (grey).
- Hours: one row for today; tap to expand all 7 days (both languages list the week starting **Saturday**: السبت…الجمعة / Saturday…Friday, matching the data order). Today is bold. Closed days show "مغلق / Closed".
- Tabs: Products (default), Reviews, About.
  - Products: section chips derived from product `section` values; 2-column grid; hidden products (owner-hidden) are not shown; sold-out products (`available:false`) show a "نفدت الكمية / Sold out" overlay and are not tappable for add.
  - Quick add "+" button on a card: if the product has required options, open the product page; otherwise add 1 with defaults and toast "أضفنا {product} للسلة / Added {product} to cart".
  - Reviews: summary block (big average, 5 bars for star distribution, count), then review list (avatar initial circle, name, stars, relative date "قبل 3 أيام" / "3 days ago", text in its original language with a "ترجمة / Translate" toggle that swaps to the other-language text we supply in demo data). "Write a review" button appears only if the user has a completed order from this business; opens a bottom sheet with a 5-star input and a textarea (10–300 chars); saved to `hawwi.reviews` and merged into the list.
  - About: short bio (AR/EN), owner name, area and emirate, fulfilment details (pickup address area, delivery fee, minimum order, prep time), and a licence line "مرخّص ضمن برنامج المشاريع المنزلية" / "Licensed home business" (generic; no real authority named).
- Floating cart bar: visible when cart's business = this business; shows count and subtotal; tap → `#/cart`.

States: loading skeleton (cover block, logo circle, 3 text lines, 4 grid cards); not found → empty state 🏚️ "المشروع غير موجود / Business not found"; no products (all hidden) → 🧺 "ما في منتجات متاحة حالياً / No products available right now".

### 3.9 Product details

```
┌──────────────────────────────┐
│ ┌──────────────────────────┐ │
│ │ (✕)   gradient + 🍛 120px │ │  260px hero
│ └──────────────────────────┘ │
│ مجبوس دجاج                    │
│ من مطبخ أم سعيد               │
│ رز بسمتي مع دجاج متبّل…        │
│ 45 د.إ                        │
│ ───────────────────────────── │
│ الحجم            (إجباري)     │
│ ◉ فردي                  —     │
│ ○ عائلي (4 أشخاص)   +70 د.إ   │
│ ───────────────────────────── │
│ إضافات           (اختياري)     │
│ ☐ دقوس إضافي         +3 د.إ   │
│ ☑ سلطة خضراء         +8 د.إ   │
│ ───────────────────────────── │
│ ملاحظات للمطبخ                 │
│ ┌──────────────────────────┐ │
│ │ مثلاً: بدون بصل…           │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│ [ − 1 + ]  [ أضف للسلة · 53 د.إ ] │  sticky footer
└──────────────────────────────┘
```

Rules:

- Option groups (`type: "single"`): radio list; `required: true` groups get a "إجباري / Required" pill and the first choice is preselected; each choice shows its price delta ("+70 د.إ", or "—" for 0).
- Add-on groups (`type: "multi"`): checkbox list with optional `max` (e.g. "اختر حتى 3 / Choose up to 3"); when max reached, remaining unchecked boxes are disabled.
- Unit price = base price + selected option deltas + selected add-on deltas. Line total = unit price × quantity. The button shows the line total and updates live.
- Quantity stepper: 1–20. "−" disabled at 1.
- Notes: textarea, max 140 chars with a live counter "0/140".
- Add to cart flow:
  1. If cart is empty or cart business = this product's business: add the line. If an identical line exists (same product, same options, same add-ons, same notes), increase its quantity instead.
  2. **One business per cart rule.** If the cart contains items from a different business, show a modal: title "تبي تبدأ سلة جديدة؟" / "Start a new cart?", body "سلتك فيها منتجات من {otherBusiness}. إذا أضفت هذا المنتج بنفرّغ السلة ونبدأ من جديد." / "Your cart has items from {otherBusiness}. Adding this item will clear it and start a new cart.", buttons "ابدأ سلة جديدة / Start new cart" (primary, destructive tone) and "إلغاء / Cancel". Confirm clears cart (and promo, slot) then adds.
  3. After adding: toast "تمت الإضافة للسلة ✓ / Added to cart ✓" with action "عرض السلة / View cart", then navigate back (history.back, or to the business page if there is no history).
- Sold out product: the footer button is disabled and reads "نفدت الكمية / Sold out".
- Business closed: allowed (order ahead); show info strip "المشروع مغلق الآن، تقدر تطلب لوقت لاحق" / "This business is closed now; you can order for later".

States: not found → empty state; loading skeleton.

### 3.10 Cart

```
┌──────────────────────────────┐
│ السلة               تفريغ     │
│ ┌──────────────────────────┐ │
│ │ [🍲] مطبخ أم سعيد    ›   │ │
│ └──────────────────────────┘ │
│ [🍛] مجبوس دجاج · عائلي       │
│      + سلطة خضراء             │
│      "بدون بصل"               │
│      123 د.إ       [− 1 +] 🗑 │
│ ───────────────────────────── │
│ طريقة الاستلام                 │
│ [ 🏃 استلام ] [ 🛵 توصيل +10 ]  │  segmented control
│ ───────────────────────────── │
│ وقت الطلب                      │
│ (•) بأسرع وقت (~45 د)          │
│ ( ) جدولة: [اليوم][بكرة]        │
│     [4:00 م][4:30 م][5:00 م]…  │  slot chips (wrap)
│ ───────────────────────────── │
│ 🏷️ [ كود الخصم      ][تطبيق]  │
│ ───────────────────────────── │
│ المجموع الفرعي        123 د.إ  │
│ رسوم التوصيل           10 د.إ  │
│ الخصم (HAWWI10)     −12.30 د.إ │
│ الإجمالي             120.70 د.إ│
├──────────────────────────────┤
│ [ متابعة للدفع · 120.70 د.إ ]  │
└──────────────────────────────┘
```

Contents and rules:

- Business header row links to the business.
- Line items: emoji tile, name, chosen option names, add-on names, notes in quotes, line total, stepper (quantity 0 removes the line, with toast "حذفنا {product}" / "Removed {product}" and action "تراجع / Undo", 4s), trash icon.
- **Fulfilment:** segmented "استلام / Pickup" and "توصيل / Delivery". Only show options the business supports; if only one, show it as a fixed info row. Delivery adds the business `deliveryFee` (AED). If subtotal < business `minOrder` for delivery, show warning "الحد الأدنى للتوصيل {min}" / "Minimum for delivery is {min}" and disable checkout.
- **Time slots:**
  - "بأسرع وقت / ASAP" is available only if the business is open now and now + prepMinutes is before closing time. Label shows estimate "~{prepMinutes} د / ~{prepMinutes} min" (+15 min for delivery).
  - Scheduled: day toggle "اليوم / Today" and "بكرة / Tomorrow". Slots are generated every 30 minutes from `max(openTime, roundUpTo30(now + prepMinutes))` (for today) or `openTime` (tomorrow) to `closeTime − 30min`, inclusive of start times. Each slot is labelled with its start time ("4:30 م" / "4:30 PM"). Hours spanning midnight (close < open, e.g. 16:00–01:00) are supported: slots continue past midnight and still belong to that day's opening.
  - If today has no slots, Today chip is disabled with tooltip text "ما في أوقات متاحة اليوم / No slots left today", and Tomorrow is preselected. If both days are closed: message "المشروع مغلق اليوم وبكرة" / "This business is closed today and tomorrow" and checkout disabled.
  - Default: ASAP if available, else the first available slot.
- **Promo code:** input (auto-uppercased, `dir="ltr"`) + Apply. Codes:

  | Code | Effect | Condition |
  |---|---|---|
  | `HAWWI10` | 10% off subtotal, max 30 AED | none |
  | `WELCOME15` | 15 AED off | subtotal ≥ 60 AED |
  | `FREEDEL` | delivery fee = 0 | delivery selected |

  Valid → chip "HAWWI10 ✓ ✕" replaces the input and toast "تم تطبيق الكود 🎉 / Code applied 🎉". Invalid → inline error "الكود غير صالح / Invalid code". Unmet condition → "الكود يتطلب طلب بقيمة 60 د.إ أو أكثر" / "This code needs an order of 60 AED or more" or "الكود للتوصيل فقط" / "This code is for delivery only". Only one code at a time. If conditions stop being met after edits, remove the code and toast.
- **Totals:** subtotal, delivery fee, discount (negative), total. All amounts rounded to 2 decimals; display without decimals when whole (see 7.3). VAT is assumed included in prices; show footnote "الأسعار شاملة الضريبة / Prices include VAT".
- Checkout button → `#/checkout` (auth guard applies).

States: empty cart → 🛍️ "سلتك فاضية / Your cart is empty", "تصفّح المشاريع وأضف اللي يعجبك" / "Browse businesses and add what you like", button "تصفّح الآن / Browse now" → `#/home`. Loading: none (instant).

### 3.11 Checkout

```
┌──────────────────────────────┐
│ → إتمام الطلب                  │
│ ملخّص: مطبخ أم سعيد · 2 منتج ▾ │
│ 🛵 توصيل · اليوم 4:30 م  تعديل │
│ ───────────────────────────── │
│ عنوان التوصيل                  │
│ [🏠 البيت ✓] [🏢 الدوام] [+ جديد]│  saved address chips
│ الإمارة [دبي ▾]  المنطقة [____]│
│ الشارع/المبنى [______________] │
│ فيلا/شقة [____]  ملاحظات [____]│
│ ───────────────────────────── │
│ طريقة الدفع                    │
│ (•) 💳 بطاقة                   │
│     رقم البطاقة [4242 4242 …]  │
│     الاسم [______] MM/YY [__/__] CVV [___] │
│ ( )  Pay (Apple Pay)        │
│ ( ) 💵 الدفع عند الاستلام       │
│ ───────────────────────────── │
│ الإجمالي             120.70 د.إ│
├──────────────────────────────┤
│ [   تأكيد الطلب · 120.70 د.إ  ]│
└──────────────────────────────┘
```

- Summary collapsible: lines and totals (same as cart).
- Address (delivery only): fields Emirate (select), Area (required), Street/Building (required), Villa/Apartment (required), Notes (optional), Label (Home/Work/Other chips). "حفظ العنوان / Save address" checkbox (default on) saves to `hawwi.user.addresses`. Saved addresses appear as chips; selecting fills the form. Validation on submit, errors inline, first invalid field focused. If the address emirate differs from the business emirate, show a warning (not blocking): "التوصيل بين الإمارات قد يتأخر / Cross-emirate delivery may take longer".
- Pickup: show pickup card instead: business name, area, "سيصلك الموقع الدقيق بعد قبول الطلب / Exact location is shared once the order is accepted".
- **Payment methods:**
  - **Card (fake):** Number (`inputmode="numeric"`, formatted in groups of 4, `dir="ltr"`, Luhn check, 16 digits; detect brand from first digit: 4 → Visa label, 5 → Mastercard label, shown as text badges), Name (required, ≥2 chars), Expiry MM/YY (month 01–12, not in the past), CVV (3 digits, `type="password"`-style masking optional). Helper "بطاقة تجريبية: 4242 4242 4242 4242" / "Test card: 4242 4242 4242 4242". Never store full number: store `{brand, last4}` only on the order.
  - **Apple Pay (fake):** shown as a black row labelled with text only, "Apple Pay" in Inter 600 (no logo, no imitation of the real payment sheet's branding). On confirm, a bottom sheet slides up (300ms) styled neutrally: merchant "Hawwi · حووي", amount, a card "•••• 1234", and a side-button hint "اضغط مرتين للتأكيد / Double-click to confirm" with a pulsing outline; after 1200ms auto-show a check animation (circle draws in 400ms, tick 250ms), "تم / Done", then sheet closes after 600ms and the order is placed.
  - **Cash:** "الدفع نقداً عند الاستلام / Pay cash on pickup/delivery". Disabled if total > 500 AED with hint.
- Confirm button: validates, shows spinner 900ms ("جاري تأكيد طلبك…" / "Placing your order…"), creates the order (see 9.2 shape) with status `received`, clears cart and promo, navigates to `#/order-placed/:orderId`.
- Error state demo: card number `4000 0000 0000 0002` → payment declined: toast error "تم رفض البطاقة، جرّب بطاقة ثانية" / "Card declined, try another card"; no order created.

### 3.12 Order placed (success)

Centered: animated check in a green circle (scale 0.6→1 with spring), title "تم استلام طلبك! 🎉 / Order placed! 🎉", order number "#HW-1042", business name, ETA line ("الاستلام اليوم 4:30 م" / "Pickup today 4:30 PM", or "~45 دقيقة"), buttons "تتبّع الطلب / Track order" (primary) and "العودة للرئيسية / Back to home" (secondary). Light confetti of 20 emoji particles (✨🎉) unless reduced motion.

### 3.13 Order tracking

```
┌──────────────────────────────┐
│ → تتبّع الطلب      #HW-1042   │
│ ┌──────────────────────────┐ │
│ │  🍳 (animated)            │ │
│ │  يتم تجهيز طلبك            │ │
│ │  الوقت المتوقع 4:30 م      │ │
│ │ ▓▓▓▓▓▓▓▓░░░░░░░░ 50%     │ │  progress bar
│ └──────────────────────────┘ │
│  ● تم استلام الطلب    3:58 م  │  vertical stepper
│  │                           │
│  ◉ قيد التجهيز        4:01 م  │  (pulsing current)
│  │                           │
│  ○ جاهز                       │
│  │                           │
│  ○ تم التوصيل                  │
│ ───────────────────────────── │
│ [🍲] مطبخ أم سعيد   📞 💬      │
│ الطلب: 2 منتج · 120.70 د.إ ▾   │
│ [ إلغاء الطلب ]                │  only while status = received
└──────────────────────────────┘
```

Status flow (`order.status`):

| Step | Key | AR | EN | Hero emoji | Progress |
|---|---|---|---|---|---|
| 1 | `received` | تم استلام الطلب | Order received | 🧾 | 15% |
| 2 | `preparing` | قيد التجهيز | Preparing | 🍳 (or 🧵 for abayas/crafts, 🫙 for perfume) | 45% |
| 3 | `ready` | جاهز للاستلام / في الطريق | Ready for pickup / Out for delivery | 📦 / 🛵 | 75% |
| 4 | `completed` | تم الاستلام / تم التوصيل | Picked up / Delivered | ✅ | 100% |
| — | `rejected` | اعتذر المشروع عن الطلب | Business declined the order | 😔 | — |
| — | `cancelled` | تم إلغاء الطلب | Order cancelled | ✖️ | — |

For delivery, step 3 label is "في الطريق إليك / On the way"; step 4 "تم التوصيل / Delivered". For pickup: "جاهز للاستلام / Ready for pickup" and "تم الاستلام / Picked up".

**Simulated timed advancement:**

- Each order has `simulate: true` by default. A global ticker (`setInterval` every 1000ms, started at app boot, runs regardless of the current screen) checks every order with `simulate: true` and status not terminal, and advances it when `now >= order.nextAt`.
- Timings (measured from the moment the previous status was set):
  - `received` → `preparing`: **8 seconds** (simulates the business accepting).
  - `preparing` → `ready`: **20 seconds**.
  - `ready` → `completed`: **15 seconds** for delivery, **12 seconds** for pickup.
  - Total demo time ≈ 40–43 seconds.
- For scheduled (non-ASAP) orders the same demo timings are used (the app is a demo); the ETA text still shows the chosen slot.
- Each transition appends `{status, at}` to `order.history`, persists, and if the notifications setting is on and the tracking screen is not showing this order, shows a toast "طلبك من {business}: {statusLabel}" with action "تتبّع / Track".
- **Owner override:** when an owner acts on an order (accept, reject, mark ready, mark completed), set `simulate: false` on that order. From then on only the owner moves it. This lets the developer demo the owner flow: place an order, quickly switch to owner mode, and accept it within 8 seconds; or turn off "تقدّم الطلبات تلقائياً / Auto-advance orders" in Settings (setting `hawwi.prefs.autoAdvance`, default `true`), which makes new orders get `simulate: false` so they wait for the owner.
- Cross-tab sync: listen to the `storage` event so a second tab (e.g. owner mode in another tab) updates live.

**Animation:**

- Hero emoji: `received` gentle bounce (translateY 0 → −6px, 1.2s loop); `preparing` wobble rotate ±6°, 1s loop, plus 3 small steam puffs (💨 fading up); `ready` slide in from inline-start for delivery (🛵 moves 0→12px loop); `completed` pop scale 0.8→1.1→1 once.
- Progress bar: width animates with `transition: width 800ms var(--ease-out)`; while non-terminal, a diagonal stripe shimmer moves across (2s linear infinite).
- Stepper: completed dots fill green with a ✓; the current dot pulses (box-shadow ring 0→8px, 1.4s loop); the connecting line fills from top to bottom over 600ms when a step completes.
- All loops are disabled under `prefers-reduced-motion: reduce` (static states only).

Other interactions:

- Cancel order: visible only while `received`; confirm modal "متأكد تبي تلغي الطلب؟ / Cancel this order?" → status `cancelled`.
- 📞 and 💬: toast "التواصل متاح بعد قبول الطلب (تجريبي)" / "Contact available after acceptance (demo)" while `received`; afterwards toast "هذه نسخة تجريبية 🙂 / This is a demo 🙂".
- When `completed`: show "قيّم طلبك / Rate your order" card with 5 tappable stars → opens the review sheet (3.8) prefilled with stars.
- Rejected: show reason text from owner (if any) and button "تصفّح مشاريع ثانية / Browse other businesses".

States: not found → 🧾 "ما لقينا هذا الطلب / Order not found".

### 3.14 Order history

```
┌──────────────────────────────┐
│ طلباتي                         │
│ [ الحالية (1) ][ السابقة (4) ]  │  tabs
│ ┌──────────────────────────┐ │
│ │[🍲] مطبخ أم سعيد  [قيد التجهيز]│ │
│ │ #HW-1042 · اليوم 3:58 م     │ │
│ │ مجبوس دجاج ×1، …            │ │
│ │ 120.70 د.إ        تتبّع ›   │ │
│ └──────────────────────────┘ │
│ Past card: … [✅ تم التوصيل]    │
│   [ إعادة الطلب ] [ تقييم ]     │
└──────────────────────────────┘
```

- Active = `received | preparing | ready`. Past = `completed | rejected | cancelled`. Sorted newest first.
- Status badges coloured: received (info blue), preparing (saffron), ready (teal), completed (green), rejected/cancelled (grey/red).
- **Reorder:** copies the order's lines into the cart (respecting the one-business rule modal), skipping products that are now hidden/deleted/sold-out (toast "بعض المنتجات غير متوفرة الآن / Some items are no longer available"), re-pricing at current prices, then → `#/cart`.
- Guest: empty state 🔒 "سجّل دخولك عشان تشوف طلباتك" / "Log in to see your orders" + Log in button.
- Empty: active → 🛵 "ما عندك طلبات حالية" / "No active orders"; past → 🧾 "ما عندك طلبات سابقة" / "No past orders" + "اطلب الآن / Order now".

### 3.15 Favourites

- Grid/list of favourited businesses (same row component as Home) with heart filled; unfavourite with an undo toast. Optional second segment "منتجات / Products" for favourited products (heart on product page header). Both are stored in `hawwi.favorites`.
- Empty: 💚 "ما أضفت مفضلة بعد" / "No favourites yet", "اضغط ♡ على أي مشروع عشان تلقاه هنا" / "Tap ♡ on any business to find it here".

### 3.16 Profile

```
┌──────────────────────────────┐
│ حسابي                          │
│ ┌──────────────────────────┐ │
│ │ (ن) نورة أحمد               │ │
│ │ +971 50 123 4567  تعديل     │ │
│ └──────────────────────────┘ │
│ 🧾 طلباتي                   › │
│ 💚 المفضلة                  › │
│ 📍 عناويني                  › │  (bottom sheet list with delete)
│ 🌐 اللغة: العربية           › │  (quick toggle)
│ ⚙️ الإعدادات                ›  │
│ ───────────────────────────── │
│ ┌──────────────────────────┐ │
│ │ 🏪 عندك مشروع منزلي؟        │ │
│ │ انتقل لوضع صاحب المشروع  ›  │ │
│ └──────────────────────────┘ │
│ ❓ المساعدة                 › │
│ حووي · الإصدار 1.0 (تجريبي)    │
└──────────────────────────────┘
```

- Guest: top card "سجّل دخولك عشان تطلب وتتابع طلباتك" / "Log in to order and track your orders" + Log in button. Owner-mode card hidden for guests (tapping shows login).
- "تعديل / Edit" opens a sheet to edit name and email.
- **Switch to owner mode:** → `#/owner/select`: a list of all businesses with "إدارة / Manage" buttons (demo: the user can manage any business). Selecting sets `hawwi.prefs.ownerMode = true`, `hawwi.prefs.ownerBusinessId = id`, toast "أهلاً {ownerName}! أنت الآن في وضع صاحب المشروع" / "Hi {ownerName}! You're now in owner mode", → `#/owner/dashboard`. Explanatory line at top: "للتجربة: اختر أي مشروع لإدارته" / "Demo: pick any business to manage".
- Help: toast or modal with 3 FAQ items (how ordering works, payment is simulated, how to demo owner mode).

### 3.17 Settings

| Row | Control | Behaviour |
|---|---|---|
| اللغة / Language | segmented: العربية / English | switches immediately; persists `hawwi.lang` |
| الإشعارات / Notifications | switch | persists `hawwi.prefs.notifications` (default on); controls status toasts |
| تقدّم الطلبات تلقائياً / Auto-advance orders | switch | `hawwi.prefs.autoAdvance` (default on); helper "لتجربة وضع صاحب المشروع أطفئ هذا الخيار" / "Turn off to demo owner mode" |
| المظهر / Appearance | segmented: فاتح / داكن / تلقائي (Light/Dark/Auto) | `hawwi.prefs.theme` (default `light`) |
| إعادة ضبط البيانات التجريبية / Reset demo data | destructive row | confirm modal "سيتم حذف الطلبات والسلة والمفضلة وأي تعديلات. متأكد؟" / "This clears orders, cart, favourites and any edits. Are you sure?" → removes every `hawwi.*` key except `hawwi.lang` and `hawwi.onboardingSeen`, then reloads at `#/home` and toasts "تمت إعادة الضبط / Demo data reset" |
| تسجيل الخروج / Log out | row in red text | confirm modal → removes `hawwi.user` (keeps orders), turns owner mode off → `#/home` |

Footer: "صُنع بحب للمشاريع المنزلية في الإمارات 🇦🇪" / "Made with love for UAE home businesses 🇦🇪".

---
## 4. Business-owner screens

Owner mode is a second shell of the same app. The owner manages one business at a time (`hawwi.prefs.ownerBusinessId`). The app bar shows the business logo, its name, the "وضع صاحب المشروع / Owner mode" pill, and an open/closed toggle ("استقبال الطلبات / Accepting orders"), which writes `acceptingOrders` to the business override. When it is off, customers see the business as "متوقف مؤقتاً / Paused" and cannot check out (cart shows the message "المشروع متوقف عن استقبال الطلبات حالياً" / "This business isn't taking orders right now").

### 4.1 Data sync between owner and customer

- There is one orders store: `hawwi.orders` (array). A customer order has `businessId`. The owner queue is `orders.filter(o => o.businessId === ownerBusinessId)`.
- Owner actions write status changes into the same array, append to `history`, set `simulate: false` and save. The customer tracking screen re-renders from storage on every ticker tick (1s) and on the `storage` event (other tabs), so changes appear within a second in the same tab and instantly across tabs.
- Product edits are saved as overrides in `hawwi.productOverrides` and business edits in `hawwi.businessOverrides` (section 9). The customer screens always read merged data (`seed` + overrides), so an owner hiding a product removes it from the customer business page immediately.
- Seed orders: on first run, generate 6 historical orders per business (see 8.5) so dashboards and charts are not empty. Mark them `seed: true`, `simulate: false`.

### 4.2 Owner select (`#/owner/select`)

List of all businesses (row component) with a "إدارة / Manage" button each, grouped by emirate. Top note "للتجربة: اختر أي مشروع لإدارته" / "Demo: pick any business to manage". Back arrow returns to `#/profile`.

### 4.3 Dashboard (`#/owner/dashboard`)

```
┌──────────────────────────────┐
│ [🍲] مطبخ أم سعيد  [وضع صاحب المشروع] │
│ استقبال الطلبات  (●━━) مفعّل     │
│ ───────────────────────────── │
│ صباح الخير يا أم سعيد ☀️        │
│ ┌───────────┐ ┌────────────┐ │
│ │ طلبات اليوم│ │ إيرادات اليوم│ │  stat tiles
│ │    7      │ │  842 د.إ    │ │
│ │ ▲2 عن أمس │ │ ▲ 12%       │ │
│ └───────────┘ └────────────┘ │
│ ┌───────────┐ ┌────────────┐ │
│ │ بانتظار    │ │ التقييم     │ │
│ │ القبول 2 ›│ │ ⭐ 4.9      │ │
│ └───────────┘ └────────────┘ │
│ المبيعات آخر 7 أيام (د.إ)       │
│  ▁ ▃ ▅ ▂ ▇ ▆ █                │  CSS bar chart
│  س ح ن ث ر خ ج                │
│ الأكثر مبيعاً                    │
│ 1. 🍛 مجبوس دجاج   ×14  630 د.إ│
│ 2. 🥘 هريس         ×9   315 د.إ│
│ 3. 🫓 خبز رقاق      ×8   120 د.إ│
│ آخر الطلبات             عرض الكل │
│ [order row] …                  │
├──────────────────────────────┤
│ 📊    📥²    🧺    🏪          │
└──────────────────────────────┘
```

Definitions:

- **Today's orders:** count of this business's orders with `createdAt` on today's local date and status not `rejected`/`cancelled`. Delta vs yesterday shown as "▲2 عن أمس / ▲2 vs yesterday" (green), "▼" in red, "— " when equal.
- **Today's revenue:** sum of `total` for today's orders whose status is not `rejected`/`cancelled` (in-progress orders count). Formatted as AED (7.3). Percent delta vs yesterday (hidden when yesterday was 0).
- **Pending:** count with status `received`; tapping → `#/owner/orders` (New tab).
- **Rating:** business rating and count.
- **Bar chart (last 7 days):** 7 columns, oldest at the start edge (in RTL, oldest at right) — data order follows reading direction. Each bar: `div` with `height: calc(var(--v) / max * 120px)`, min 4px, width 28px, radius `6px 6px 2px 2px`, colour `--c-primary`; today's bar `--c-accent`. Value label above each bar (small, e.g. "312"), day initial below (AR: س ح ن ث ر خ ج for Sat..Fri; EN: Sat Sun Mon Tue Wed Thu Fri abbreviations). Bars animate height from 0 on mount (600ms, staggered 40ms) unless reduced motion. Container has `role="img"` and `aria-label` summarising values ("المبيعات آخر 7 أيام: السبت 312 درهم، …").
- **Best sellers:** top 3 products by quantity over the last 30 days, with quantity and revenue. Empty: "ما في مبيعات بعد / No sales yet".
- **Recent orders:** latest 3 order rows → `#/owner/orders/:id`.

States: loading skeleton tiles; no orders at all → tiles show 0 and the empty chart shows a dashed baseline with "ما في بيانات بعد / No data yet".

### 4.4 Incoming orders (`#/owner/orders`)

```
┌──────────────────────────────┐
│ الطلبات                        │
│ [جديدة 2][قيد التجهيز 1][جاهزة 0][مكتملة]│
│ ┌──────────────────────────┐ │
│ │ #HW-1042 · 🛵 توصيل  ⏱ 0:42 │ │  timer since received
│ │ نورة أحمد · اليوم 4:30 م     │ │
│ │ 1× مجبوس دجاج (عائلي)       │ │
│ │    + سلطة خضراء · "بدون بصل" │ │
│ │ البرشاء، شارع 12، فيلا 7     │ │
│ │ 💳 بطاقة ••4242  120.70 د.إ │ │
│ │ [ رفض ]        [ قبول ✓ ]   │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

Tabs and actions:

| Tab | Statuses shown | Primary action | Secondary action |
|---|---|---|---|
| جديدة / New | `received` | قبول / Accept → `preparing` | رفض / Reject → `rejected` (sheet with reason chips: "نفدت الكمية / Out of stock", "مشغولين حالياً / Too busy", "خارج منطقة التوصيل / Outside delivery area", "سبب آخر / Other" + text) |
| قيد التجهيز / In progress | `preparing` | جاهز / Mark ready → `ready` | — |
| جاهزة / Ready | `ready` | تم التسليم / Mark completed → `completed` (label "تم الاستلام / Picked up" or "تم التوصيل / Delivered" by fulfilment) | — |
| مكتملة / Done | `completed`, `rejected`, `cancelled` (last 30 days) | — | — |

- Every action: optimistic update, toast ("قبلت الطلب #HW-1042 / Accepted order #HW-1042"), sets `simulate:false`, appends history, saves. The card animates out of the tab (fade + collapse 250ms), counts update.
- Orders sorted: New by oldest first (FIFO); others newest first. Scheduled orders show a "مجدول / Scheduled" badge and the slot time.
- New orders arriving while the owner is on this screen (from another tab or the customer flow in the same tab) slide in at the top with a highlight flash (background `--c-accent-soft` fading over 1.5s) and the tab badge increments. A short "ding" is **not** used (no audio).
- Order detail (`#/owner/orders/:orderId`): full lines, customer name and masked phone "+971 50 *** 4567", fulfilment, address, payment, history timeline, same action buttons.
- Empty per tab: New → 📭 "ما في طلبات جديدة الحين" / "No new orders right now"; In progress → 🍳 "ما في طلبات قيد التجهيز" / "Nothing in preparation"; Ready → 📦 "ما في طلبات جاهزة" / "No orders ready"; Done → 🗂️ "ما في طلبات مكتملة" / "No completed orders".

### 4.5 Manage products (`#/owner/products`)

```
┌──────────────────────────────┐
│ المنتجات (9)        [+ منتج جديد] │
│ 🔍 [ابحث في منتجاتك      ]     │
│ ┌──────────────────────────┐ │
│ │[🍛] مجبوس دجاج     45 د.إ  │ │
│ │     أطباق رئيسية           │ │
│ │ ظاهر (●━) متوفر (●━)  ✏️  🗑 │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │[🥗] سلطة… (مخفي)  … faded  │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

- Each row: emoji tile, name (current language), section, price, two switches: "ظاهر / Visible" (`hidden` flag) and "متوفر / In stock" (`available` flag), edit ✏️ and delete 🗑 icon buttons (44px tap targets, aria-labels "تعديل {name}" / "حذف {name}").
- Hidden rows render at 55% opacity with a "مخفي / Hidden" badge.
- Delete → confirm modal: title "حذف المنتج؟ / Delete product?", body "سيتم حذف {name} نهائياً من متجرك." / "{name} will be permanently removed from your shop.", buttons "حذف / Delete" (danger) and "إلغاء / Cancel". Deleted seed products are recorded as `{deleted:true}` overrides; custom products are removed from the array. Any cart lines referencing the deleted product are removed on next cart render with a toast.
- **Add / Edit form** (`#/owner/products/new`, `#/owner/products/:pid/edit`):

  | Field | Control | Validation |
  |---|---|---|
  | الاسم بالعربي / Arabic name | text | required, 2–50 |
  | الاسم بالإنجليزي / English name | text (`dir="ltr"`) | required, 2–50 |
  | الوصف بالعربي / Arabic description | textarea | optional, ≤200 |
  | الوصف بالإنجليزي / English description | textarea (`dir="ltr"`) | optional, ≤200 |
  | السعر (د.إ) / Price (AED) | number, step 0.5 | required, 1–5000 |
  | القسم / Section | select from existing sections + "قسم جديد / New section" text | required |
  | الإيموجي / Emoji | grid picker of 24 relevant emoji (per category) + free text (1 emoji) | required |
  | الخيارات / Options | repeatable groups: group name AR/EN, type (single/multi), required toggle, max (multi), choices list (name AR/EN, price delta ≥0) | each group ≥1 choice |
  | ظاهر / Visible, متوفر / In stock | switches | — |

  Live preview card at the top updates as fields change. Save → toast "تم حفظ المنتج / Product saved" → back to list. Unsaved changes + back → confirm "تجاهل التعديلات؟ / Discard changes?". New product IDs: `"c-" + Date.now().toString(36)`.

- Empty list: 🧺 "ما أضفت منتجات بعد" / "You haven't added products yet" + "أضف أول منتج / Add your first product".

### 4.6 Business profile and weekly hours (`#/owner/profile`)

```
┌──────────────────────────────┐
│ متجري                          │
│ [cover preview with gradient] │
│ [🍲] change emoji · colours ● ●│
│ اسم المشروع (ع) [مطبخ أم سعيد ] │
│ Business name (EN) [Um Saeed's Kitchen] │
│ نبذة (ع/EN) [……]               │
│ الإمارة [دبي ▾] المنطقة [البرشاء]│
│ ☑ استلام   ☑ توصيل  رسوم [10] د.إ│
│ الحد الأدنى للتوصيل [40] د.إ    │
│ وقت التجهيز [45] دقيقة           │
│ ───── ساعات العمل ─────         │
│ السبت    (●━) [11:00]–[22:00]  │
│ الأحد    (●━) [11:00]–[22:00]  │
│ …                              │
│ الجمعة   (━○) مغلق              │
│ [نسخ ساعات السبت لكل الأيام]     │
│ [         حفظ التعديلات       ] │
└──────────────────────────────┘
```

- Fields: names (AR/EN), bios (AR/EN), emoji logo, two colours (choose from 8 preset swatch pairs listed in 5.1 "business gradients"), emirate, area, pickup/delivery toggles (at least one must be on), delivery fee (0–50), minimum delivery order (0–200), prep time (10–180 minutes, step 5).
- **Weekly hours editor:** 7 rows Saturday→Friday. Each row: day name, open switch, `<input type="time">` for open and close (15-minute step). Close earlier than open means it closes after midnight; show a hint "يسكّر بعد منتصف الليل / Closes after midnight". Equal times are invalid ("وقت الفتح والإغلاق متطابقان / Open and close times are the same"). Button "نسخ ساعات السبت لكل الأيام / Copy Saturday to all days". 
- Save → writes `hawwi.businessOverrides[businessId]` → toast "تم حفظ بيانات المتجر / Shop details saved". Customer views use the new hours for badges and slots immediately.
- "عرض متجري كزبون / View my shop as a customer" link → `#/business/:id`. Customer routes are allowed while owner mode is on; the business page has no tab bar, and back returns to `#/owner/profile`.
- "الخروج من وضع صاحب المشروع / Exit owner mode" button at the bottom.

---

## 5. Visual system

### 5.1 Colour tokens (light mode, required)

| Token | Hex | Use |
|---|---|---|
| `--c-primary` | `#0F5B4D` | Brand date-palm green: primary buttons, active tab, links |
| `--c-primary-700` | `#0A4339` | Pressed primary, headings on sand |
| `--c-primary-100` | `#DCEDE8` | Selected chip background, soft fills |
| `--c-teal` | `#1E7F86` | Secondary accent, "ready" status |
| `--c-accent` | `#E0A526` | Saffron: badges, highlights, today's bar, rating stars |
| `--c-accent-700` | `#9A6A0B` | Accent text on light backgrounds (AA contrast) |
| `--c-accent-soft` | `#FBF0D6` | Highlight flash, promo chip background |
| `--c-gold` | `#C8A15A` | Decorative lines, pattern strokes, featured border |
| `--c-sand-50` | `#FBF8F3` | App background (off-white) |
| `--c-sand-100` | `#F4EDE1` | Section background, skeleton base |
| `--c-sand-200` | `#E8DCC8` | Borders on sand, skeleton shimmer |
| `--c-sand-300` | `#D6C4A6` | Dividers, disabled outlines |
| `--c-surface` | `#FFFFFF` | Cards, sheets, inputs |
| `--c-ink` | `#1D2321` | Primary text |
| `--c-ink-2` | `#4F5A56` | Secondary text |
| `--c-ink-3` | `#7D8783` | Tertiary text, placeholders (use only ≥14px) |
| `--c-border` | `#E6E1D8` | Card and input borders |
| `--c-success` | `#2E8B57` | Open badge, completed |
| `--c-success-soft` | `#E2F3E9` | Success badge background |
| `--c-warning` | `#B7791F` | Closing soon |
| `--c-warning-soft` | `#FCEFD9` | |
| `--c-danger` | `#C0392B` | Errors, delete, rejected |
| `--c-danger-soft` | `#FBE5E2` | |
| `--c-info` | `#2B6CB0` | "Received" status |
| `--c-info-soft` | `#E3EEFA` | |
| `--c-overlay` | `rgba(16, 24, 22, 0.48)` | Modal/sheet scrim |
| `--c-page` | `#EDE4D3` | Desktop page background behind the phone frame |

Category colours (chip icon backgrounds and placeholder gradients):

| Category id | AR / EN | Emoji | Gradient (from → to) |
|---|---|---|---|
| `food` | أكل بيت / Home cooking | 🍲 | `#F2B66D` → `#D9783B` |
| `sweets` | حلويات / Sweets | 🧁 | `#F7C6D0` → `#E58FA6` |
| `perfume` | عطور وبخور / Perfumes & bakhoor | 🌸 | `#C9B6E4` → `#8D6BB8` |
| `abaya` | عبايات / Abayas | 👗 | `#5C5470` → `#2B2738` |
| `crafts` | أشغال يدوية / Crafts | 🧶 | `#9ED2C6` → `#3E9C8F` |

Business gradient presets (owner can pick; demo data uses these ids):

| Preset | From | To |
|---|---|---|
| `saffron` | `#F6C760` | `#D98A1F` |
| `palm` | `#3F8F75` | `#0F5B4D` |
| `rose` | `#F4B6C2` | `#D9668A` |
| `oud` | `#8C6A52` | `#4A3327` |
| `lavender` | `#CDB8EA` | `#7E5BB5` |
| `sea` | `#8FD3E0` | `#1E7F86` |
| `night` | `#5C5470` | `#22202D` |
| `sand` | `#F1DFC0` | `#C9A46C` |

Placeholder imagery = `linear-gradient(135deg, from, to)` + emoji centred (product tiles 44px emoji in 96px tiles; hero 120px) + a soft white radial highlight at top-start (`radial-gradient(circle at 20% 15%, rgba(255,255,255,.35), transparent 60%)`; mirror to 80% in RTL).

### 5.2 Dark mode (optional; implement if time allows)

Apply under `[data-theme="dark"]` and under `@media (prefers-color-scheme: dark)` when theme is `auto`.

| Token | Dark hex |
|---|---|
| `--c-sand-50` (bg) | `#121715` |
| `--c-sand-100` | `#1A211E` |
| `--c-sand-200` | `#252E2A` |
| `--c-surface` | `#1C2421` |
| `--c-ink` | `#F1ECE3` |
| `--c-ink-2` | `#C3C9C5` |
| `--c-ink-3` | `#8E9893` |
| `--c-border` | `#2E3834` |
| `--c-primary` | `#3FB495` |
| `--c-primary-700` | `#7FD3BC` |
| `--c-primary-100` | `#173A32` |
| `--c-accent` | `#F0BA45` |
| `--c-accent-700` | `#F0BA45` |
| `--c-accent-soft` | `#3A2F14` |
| `--c-page` | `#0B0F0E` |

Primary button text in dark mode: `#0B1F1A`.

### 5.3 Typography

- Arabic: `"IBM Plex Sans Arabic", "Segoe UI", Tahoma, "Geeza Pro", sans-serif`.
- Latin: `"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- Set `font-family` on `html[lang="ar"]` to Arabic stack first then Inter (so numerals/Latin inside Arabic use Inter); on `html[lang="en"]` Inter first then IBM Plex Sans Arabic (so any Arabic names render well).
- Numbers: always Latin digits (0–9) in both languages for prices, times and phones. Use `font-variant-numeric: tabular-nums` in prices, timers and the chart.
- Arabic line-height is taller.

| Token | Size / line-height (EN) | Line-height (AR) | Weight | Use |
|---|---|---|---|---|
| `--t-display` | 28 / 34 | 42 | 700 | Splash, success |
| `--t-h1` | 22 / 28 | 36 | 700 | Screen titles |
| `--t-h2` | 18 / 24 | 30 | 600 | Section titles, business name |
| `--t-h3` | 16 / 22 | 26 | 600 | Card titles |
| `--t-body` | 15 / 22 | 26 | 400 | Body |
| `--t-body-strong` | 15 / 22 | 26 | 600 | Prices, emphasis |
| `--t-small` | 13 / 18 | 22 | 400 | Meta, captions |
| `--t-micro` | 11 / 14 | 16 | 600 | Badges, tab labels |

Minimum input font size 16px (prevents iOS zoom).

### 5.4 Spacing scale (4px base)

`--s-1: 4px`, `--s-2: 8px`, `--s-3: 12px`, `--s-4: 16px`, `--s-5: 20px`, `--s-6: 24px`, `--s-8: 32px`, `--s-10: 40px`, `--s-12: 48px`.

Screen side padding: 16px. Gap between sections: 24px. Card inner padding: 12–16px. Gap in grids: 12px.

### 5.5 Radii

`--r-xs: 6px` (badges), `--r-sm: 10px` (inputs, small tiles), `--r-md: 14px` (cards, buttons), `--r-lg: 20px` (featured cards, sheets' top corners), `--r-xl: 28px` (splash logo, phone frame inner), `--r-pill: 999px` (chips, pills, steppers).

### 5.6 Shadows

| Token | Value | Use |
|---|---|---|
| `--sh-1` | `0 1px 2px rgba(29,35,33,.06), 0 1px 1px rgba(29,35,33,.04)` | Cards at rest |
| `--sh-2` | `0 4px 12px rgba(29,35,33,.08)` | Raised cards, floating cart bar |
| `--sh-3` | `0 12px 32px rgba(29,35,33,.16)` | Sheets, modals, toasts |
| `--sh-frame` | `0 30px 80px rgba(60,45,20,.25)` | Desktop phone frame |
| `--focus-ring` | `0 0 0 3px #FFFFFF, 0 0 0 5px #0F5B4D` | Focus visible |

### 5.7 Motion

| Token | Value |
|---|---|
| `--m-fast` | 120ms (press states, toggles) |
| `--m-base` | 200ms (chips, tabs, fades) |
| `--m-slow` | 320ms (sheets, modals, page transitions) |
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` |
| `--ease-in-out` | `cubic-bezier(.4,0,.2,1)` |
| `--ease-spring` | `cubic-bezier(.34,1.56,.64,1)` (success check, add-to-cart badge bump) |

- Page transitions: new screen fades in and slides 12px in from the inline-end side (from the left in RTL, from the right in LTR) over `--m-base`. Back navigation slides from the start side.
- Buttons: `transform: scale(.97)` on `:active`.
- Cart badge bumps (scale 1→1.25→1, spring) when items are added.
- Skeleton shimmer: 1.2s linear infinite gradient sweep in the reading direction.
- `@media (prefers-reduced-motion: reduce)`: all durations 0.01ms, no loops, no carousel auto-advance, no confetti.

### 5.8 Iconography

- Emoji for category, status and decorative icons (listed per screen).
- Inline SVG (24×24, `stroke="currentColor"`, stroke-width 2, round caps) for UI chrome: back arrow, close ✕, search, heart (outline/filled), share, chevron, plus, minus, trash, edit pencil, check, clock, location pin, phone, chat. Directional SVGs (back arrow, chevrons) mirror in RTL via `[dir="rtl"] .icon-dir { transform: scaleX(-1); }`.
- No raster images anywhere.

### 5.9 Brand mark

Logo = rounded-square tile in `--c-primary` with a sand 🧺 emoji, or as inline SVG: a simple woven-basket outline (three horizontal arcs and a handle) in `--c-sand-50`. Wordmark "حووي" in IBM Plex Sans Arabic 700; "Hawwi" in Inter 700 with letter-spacing −0.01em. The geometric pattern is an inline SVG of an 8-point star lattice (stroke `--c-gold`, 1px, 10% opacity) used as `background-image` data URI.

---

## 6. Components

All components use logical CSS properties; specific RTL rules are listed per component and summarised in 6.17.

### 6.1 Buttons

| Variant | Style |
|---|---|
| Primary | bg `--c-primary`, text white, height 52px (large) or 44px (default), radius `--r-md`, `--t-body-strong`. Hover (desktop) `--c-primary-700`. |
| Secondary | bg `--c-primary-100`, text `--c-primary-700`. |
| Outline | transparent, 1.5px border `--c-primary`, text `--c-primary`. |
| Ghost / text | transparent, text `--c-primary`, min 44×44 hit area. |
| Danger | bg `--c-danger`, white text; danger-outline variant for "Reject". |
| Icon button | 44×44 circle, transparent or `--c-surface` with `--sh-1`. Always has `aria-label`. |

States: disabled (opacity .45, `cursor: not-allowed`, `aria-disabled="true"`), loading (label replaced by a 18px spinner, width locked, `aria-busy="true"`), focus-visible (`--focus-ring`). Buttons with price use a split layout: label at start, price at end (`justify-content: space-between`), which mirrors automatically.

### 6.2 Chips

Height 36px, padding-inline 14px, radius pill, border 1px `--c-border`, bg surface. Selected: bg `--c-primary`, text white, border transparent. Optional leading emoji. Filter chips with dropdown have a trailing chevron. Horizontal chip rows scroll with `overflow-x: auto; scroll-snap-type: x proximity;` and hide the scrollbar; first chip aligned to the start padding (16px). Chips use `role="tab"` or `aria-pressed` depending on use.

### 6.3 Cards

- **Business featured card:** 300×168, cover gradient full-bleed, bottom gradient scrim, logo 40px at bottom-start, name/rating/area in white. Featured border 1.5px `--c-gold`.
- **Business row card:** surface, radius `--r-md`, `--sh-1`, padding 12px, logo tile 56px at start, text column, heart button at end.
- **Product card (grid):** surface, radius `--r-md`; emoji tile on gradient (aspect 1:1, radius `--r-sm`), name (2 lines max, ellipsis), price; quick-add "+" 32px circle (44px hit area) at the bottom-end corner of the tile.
- **Order card:** surface, header row (logo, name, status badge at end), meta line, items summary (1 line ellipsis), footer row (total at start, action at end).
- **Stat tile (owner):** surface, radius `--r-md`, label `--t-small` `--c-ink-2`, value `--t-h1` tabular, delta `--t-micro` coloured.

### 6.4 List rows

Min height 56px, padding 12px 16px, leading icon/emoji (24px) at start, title + optional subtitle, trailing element (chevron, switch, value) at end. Divider 1px `--c-border` inset from the start by 56px. Whole row is a `<button>` or `<a>`.

### 6.5 Bottom sheet

- Container: absolute within the phone frame (not the viewport), bottom 0, width 100%, max-height 85%, radius `--r-lg --r-lg 0 0`, bg surface, `--sh-3`, padding 16px + safe-area bottom.
- Grab handle 36×4px pill, `--c-sand-300`, centred.
- Header: title (`--t-h2`) at start, close ✕ icon button at end.
- Opens by sliding from 100% → 0 translateY (`--m-slow`, `--ease-out`) with scrim fade. Close by ✕, scrim tap, Escape, or drag down > 80px.
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` the title; focus moves to the first focusable element; focus is trapped; on close, focus returns to the opener.

### 6.6 Toast

- Position: inside frame, bottom 88px (above the tab bar; 24px when no tab bar), centred, max width 358px.
- Style: bg `--c-ink` (dark), text `--c-sand-50`, radius `--r-md`, `--sh-3`, padding 12px 16px, optional leading emoji, optional action button at end (text `--c-accent`).
- Variants: default, success (leading ✓ in green circle), error (leading ! in red circle).
- Enter: fade + translateY 16px→0 (`--m-base`); auto-dismiss after 2.8s (4s with an action); one at a time (queue). Container `role="status" aria-live="polite"`; error toasts use `role="alert"`.

### 6.7 Modal (dialog)

Centered card, width 320px, radius `--r-lg`, padding 24px, title `--t-h2`, body `--t-body` `--c-ink-2`, buttons stacked full-width (primary on top) or side by side (primary at end). Scale .95→1 + fade (`--m-base`). Same a11y rules as the sheet. Escape and scrim tap = cancel (except while a loading action runs).

### 6.8 Stepper (quantity)

Pill, height 40px, border 1px `--c-border`; "−" button, value (tabular, min-width 32px, `aria-live="polite"`), "+" button. Buttons are 40×40 visual with 44px hit area. Order is always [− value +] in reading order: in RTL the "−" appears at the right (start) and "+" at the left (end). This is the agreed mirroring: decrement at the start, increment at the end in both directions. `aria-label`s "إنقاص الكمية / Decrease quantity", "زيادة الكمية / Increase quantity".

### 6.9 Tabs

- **Segmented tabs** (orders, business page, settings language): container `--c-sand-100`, radius pill, 4px padding; selected segment surface + `--sh-1`, sliding indicator animates `inset-inline-start` (`--m-base`).
- **Underline tabs** (business page Products/Reviews/About): 2px underline `--c-primary` under the selected label.
- ARIA: `role="tablist"`, `role="tab"` with `aria-selected` and `aria-controls`, `role="tabpanel"`. Arrow keys move between tabs; in RTL, ArrowLeft moves to the *next* tab and ArrowRight to the previous one.

### 6.10 Badge

- **Count badge:** min 18×18, radius pill, `--t-micro`, bg `--c-accent`, text `#1D2321` (cart) or bg `--c-danger` white text (owner new orders); positioned at top-end of the icon (`inset-inline-end: -6px; top: -4px`). 99+ cap.
- **Status badge:** height 24px, padding-inline 8px, radius `--r-xs`, soft background + strong text from the status colour pairs (info/warning/teal/success/danger). Includes a 6px dot at start.
- **Open/closed badge:** same style: Open = success, Closing soon = warning, Closed = grey (`--c-sand-100` bg, `--c-ink-2` text), Paused = danger-soft.

### 6.11 Rating stars

- Display: 5 inline SVG stars 14px (or ★ characters) in `--c-accent`, empty stars `--c-sand-300`; half star via a clip-path on the 50% point. Half stars fill from the start side (right in RTL). Compact form: "⭐ 4.9 (318)". `aria-label="التقييم 4.9 من 5، 318 تقييم" / "Rated 4.9 out of 5, 318 reviews"`.
- Input: 5 buttons 44×44, `role="radiogroup"`, each `role="radio"` with `aria-label="4 نجوم / 4 stars"`; arrow keys follow the RTL rule from 6.9.

### 6.12 Skeleton

Blocks with `--c-sand-100` background and a shimmer gradient (`--c-sand-100` → `--c-sand-200` → `--c-sand-100`) sweeping in reading direction; radius matching the component they replace. `aria-hidden="true"`; the screen container has `aria-busy="true"` while skeletons show.

### 6.13 Empty state

Centered column, padding 40px 24px: emoji 56px in a 96px circle (`--c-sand-100`), title `--t-h2`, body `--t-body` `--c-ink-2` (max 280px), optional primary button.

### 6.14 Tab bar

- Sticky at the bottom of the frame, height 64px + safe-area, bg surface at 95% with `backdrop-filter: blur(12px)`, top border 1px `--c-border`.
- Items equal width (`flex: 1`), each a link with emoji icon (22px) above label (`--t-micro`). Active: label and an indicator pill (24×3px, `--c-primary`) above the icon, emoji at full opacity; inactive: label `--c-ink-3`, emoji at 60% opacity with `filter: grayscale(.4)`.
- `<nav aria-label="التنقل الرئيسي / Main navigation">`, active link has `aria-current="page"`.
- Flex direction follows `dir`, so items reverse order automatically in RTL (Home at right).

### 6.15 Inputs and form controls

Height 48px, radius `--r-sm`, border 1px `--c-border`, bg surface, padding-inline 14px, label above (`--t-small`, `--c-ink-2`), helper/error text below (error `--c-danger`, with `aria-describedby`; field gets `aria-invalid="true"` and red border). Focus: border `--c-primary` + `--focus-ring`. Fields for phone, card, CVV, expiry, promo and English text use `dir="ltr"` and `text-align: start` within their own direction. Switches: 48×28 track, 24px knob; knob moves toward the inline-end when on (left in RTL); `role="switch"` with `aria-checked`.

### 6.16 App bar

Height 56px, sticky top, bg `--c-sand-50` (transparent over covers), back button at start, title (`--t-h2`) next to it, actions at end.

### 6.17 RTL mirroring rules (summary)

| Element | RTL behaviour |
|---|---|
| Layout, flex rows, grids | Follow `dir` automatically; never use `left/right`, use logical properties |
| Back arrow, chevrons ›, "next" arrows, carousel progress | Mirrored (scaleX(-1)) |
| Search, heart, share, trash, check, ✕, plus/minus, clock, emoji | Not mirrored |
| Progress bars, sliders, skeleton shimmer | Fill from the start edge (right in RTL) |
| Onboarding/carousel swipe | Next slide enters from the end side (left in RTL); use native horizontal scroll, which is direction-aware |
| Switch knob | "On" = knob at the end side |
| Stepper | [− value +] in reading order |
| Bar chart | Oldest day at the start edge |
| Numbers, phone, card, prices, times | Latin digits; numeric inputs `dir="ltr"`; inline price strings wrapped in `<bdi>` |
| Keyboard arrows in tabs/radiogroups | ArrowLeft = next in RTL, previous in LTR |
| Text alignment | `text-align: start` |
| Badges on icons | `inset-inline-end` |
| Toast action | at the end side |
| Page transitions | New page enters from the end side; back enters from the start side |

---
## 7. Copy

### 7.1 Voice

- Arabic: clear Modern Standard Arabic with a light, friendly Gulf touch where it feels natural (حياك، وش، بكرة، تبي، فاضية). Never slang that's hard to read. Address the user in the masculine-neutral default form common in Gulf apps.
- English: short, warm, plain.
- Keys are used in code as `t('key')`; placeholders in `{braces}`.

### 7.2 String table

**General and navigation**

| Key | Arabic | English |
|---|---|---|
| app.name | حووي | Hawwi |
| app.tagline | من البيت… إلى بابك | From home kitchens to your door |
| nav.home | الرئيسية | Home |
| nav.explore | استكشف | Explore |
| nav.cart | السلة | Cart |
| nav.orders | طلباتي | Orders |
| nav.account | حسابي | Account |
| nav.main | التنقل الرئيسي | Main navigation |
| owner.nav.dashboard | لوحة التحكم | Dashboard |
| owner.nav.orders | الطلبات | Orders |
| owner.nav.products | المنتجات | Products |
| owner.nav.shop | متجري | My shop |
| common.back | رجوع | Back |
| common.close | إغلاق | Close |
| common.cancel | إلغاء | Cancel |
| common.confirm | تأكيد | Confirm |
| common.save | حفظ | Save |
| common.edit | تعديل | Edit |
| common.delete | حذف | Delete |
| common.undo | تراجع | Undo |
| common.retry | حاول مرة ثانية | Try again |
| common.seeAll | عرض الكل | See all |
| common.required | إجباري | Required |
| common.optional | اختياري | Optional |
| common.loading | جاري التحميل… | Loading… |
| common.notFound | ما لقينا الصفحة المطلوبة | We couldn't find that page |
| common.goHome | العودة للرئيسية | Back to home |
| common.demo | هذه نسخة تجريبية 🙂 | This is a demo 🙂 |
| common.storageError | تعذّر تحميل بعض البيانات المحفوظة، استعدنا البيانات الافتراضية | Some saved data couldn't be loaded; defaults restored |
| common.linkCopied | تم نسخ الرابط | Link copied |
| common.share | مشاركة | Share |

**Onboarding**

| Key | Arabic | English |
|---|---|---|
| onb.skip | تخطي | Skip |
| onb.next | التالي | Next |
| onb.start | ابدأ الآن | Get started |
| onb.langSwitch | English | العربية |
| onb.slideLabel | الشريحة {n} من 3 | Slide {n} of 3 |
| onb.s1.title | أطيب ما في البيوت | The best of home-made |
| onb.s1.body | اكتشف مشاريع منزلية قريبة منك: أكل بيت، حلويات، عطور، عبايات وأشغال يدوية. | Discover home businesses near you: home cooking, sweets, perfumes, abayas and crafts. |
| onb.s2.title | اطلب مسبقاً على راحتك | Order ahead, your way |
| onb.s2.body | اختر وقت الاستلام أو التوصيل، اليوم أو بكرة، وخلّ الباقي علينا. | Pick a pickup or delivery time, today or tomorrow, and leave the rest to us. |
| onb.s3.title | تابع طلبك لحظة بلحظة | Track every step |
| onb.s3.body | من استلام الطلب إلى باب بيتك، تعرف وين وصل طلبك. | From the kitchen to your door, always know where your order is. |

**Auth**

| Key | Arabic | English |
|---|---|---|
| auth.title | أهلاً فيك 👋 | Welcome 👋 |
| auth.subtitle | سجّل دخولك برقم جوالك | Log in with your mobile number |
| auth.phoneLabel | رقم الجوال | Mobile number |
| auth.phoneHint | مثال: 50 123 4567 | e.g. 50 123 4567 |
| auth.phoneError | أدخل رقم جوال إماراتي صحيح يبدأ بـ 5 | Enter a valid UAE mobile number starting with 5 |
| auth.sendCode | أرسل رمز التحقق | Send code |
| auth.terms | بالمتابعة أنت توافق على الشروط وسياسة الخصوصية | By continuing you agree to the Terms and Privacy Policy |
| otp.title | أدخل رمز التحقق | Enter verification code |
| otp.sentTo | أرسلنا رمزاً من 4 أرقام إلى | We sent a 4-digit code to |
| otp.demoHint | للتجربة: أي 4 أرقام عدا 0000 | Demo: any 4 digits except 0000 |
| otp.resendIn | إعادة الإرسال بعد {time} | Resend in {time} |
| otp.resend | إعادة إرسال الرمز | Resend code |
| otp.resent | أرسلنا رمزاً جديداً | New code sent |
| otp.verify | تحقّق | Verify |
| otp.error | الرمز غير صحيح، حاول مرة ثانية | Incorrect code, please try again |
| otp.digitLabel | الرقم {n} من 4 | Digit {n} of 4 |
| signup.title | آخر خطوة! ✨ | One last step! ✨ |
| signup.subtitle | وش نناديك؟ | What should we call you? |
| signup.name | الاسم | Name |
| signup.nameError | اكتب اسمك (حرفين على الأقل) | Enter your name (at least 2 letters) |
| signup.email | البريد الإلكتروني (اختياري) | Email (optional) |
| signup.emailError | البريد الإلكتروني غير صحيح | Invalid email address |
| signup.emirate | الإمارة | Emirate |
| signup.create | إنشاء الحساب | Create account |
| auth.welcomeNew | حياك الله يا {name}! 🎉 | Welcome, {name}! 🎉 |
| auth.welcomeBack | أهلاً بعودتك، {name} | Welcome back, {name} |
| auth.loginToContinue | سجّل دخولك عشان تكمل | Log in to continue |
| auth.login | تسجيل الدخول | Log in |

**Home, search, categories, emirates**

| Key | Arabic | English |
|---|---|---|
| home.morning | صباح الخير | Good morning |
| home.afternoon | مساء الخير | Good afternoon |
| home.evening | مساء النور | Good evening |
| home.guest | أهلاً فيك | Welcome |
| home.deliverTo | التوصيل إلى: | Delivering to: |
| home.searchPlaceholder | ابحث عن مشروع أو منتج | Search businesses or products |
| home.featured | مميز هذا الأسبوع | Featured this week |
| home.nearby | قريب منك | Near you |
| home.noBusinesses | ما في مشاريع في هذه المنطقة بعد | No businesses in this area yet |
| home.showAllEmirates | عرض كل الإمارات | Show all emirates |
| home.noNotifications | ما عندك إشعارات جديدة | No new notifications |
| home.notificationsOff | الإشعارات متوقفة من الإعدادات | Notifications are off in Settings |
| home.chooseLocation | اختر منطقتك | Choose your area |
| cat.all | الكل | All |
| cat.food | أكل بيت | Home cooking |
| cat.sweets | حلويات | Sweets |
| cat.perfume | عطور وبخور | Perfumes & bakhoor |
| cat.abaya | عبايات | Abayas |
| cat.crafts | أشغال يدوية | Crafts |
| em.all | كل الإمارات | All emirates |
| em.dubai | دبي | Dubai |
| em.sharjah | الشارقة | Sharjah |
| em.ajman | عجمان | Ajman |
| em.abudhabi | أبوظبي | Abu Dhabi |
| em.rak | رأس الخيمة | Ras Al Khaimah |
| em.fujairah | الفجيرة | Fujairah |
| search.placeholder | ابحث… | Search… |
| search.clear | مسح البحث | Clear search |
| search.popular | عمليات بحث رائجة | Popular searches |
| search.businesses | مشاريع ({n}) | Businesses ({n}) |
| search.products | منتجات ({n}) | Products ({n}) |
| search.noResults | ما لقينا نتائج لـ "{q}" | No results for "{q}" |
| search.noResultsHint | جرّب كلمة ثانية أو امسح الفلاتر | Try another word or clear filters |
| search.clearFilters | مسح الفلاتر | Clear filters |
| search.sort | ترتيب: {x} | Sort: {x} |
| sort.rating | الأعلى تقييماً | Top rated |
| sort.nearest | الأقرب | Nearest |
| sort.price | السعر: من الأقل | Price: low to high |
| sort.reviews | الأكثر تقييمات | Most reviewed |
| filter.openNow | مفتوح الآن | Open now |
| filter.delivery | توصيل | Delivery |

**Business page**

| Key | Arabic | English |
|---|---|---|
| biz.open | مفتوح | Open |
| biz.closingSoon | يسكّر قريباً | Closing soon |
| biz.closedOpens | مغلق · يفتح {day} {time} | Closed · opens {day} {time} |
| biz.closed | مغلق | Closed |
| biz.paused | متوقف مؤقتاً | Paused |
| biz.today | اليوم | Today |
| biz.tomorrow | بكرة | Tomorrow |
| biz.hours | ساعات العمل | Opening hours |
| biz.reviewsCount | {n} تقييم | {n} reviews |
| biz.pickup | استلام | Pickup |
| biz.delivery | توصيل | Delivery |
| biz.deliveryFee | توصيل {fee} | Delivery {fee} |
| biz.freeDelivery | توصيل مجاني | Free delivery |
| biz.minOrder | الحد الأدنى {amount} | Minimum {amount} |
| biz.prepTime | وقت التجهيز ~{n} دقيقة | Prep time ~{n} min |
| biz.tab.products | المنتجات | Products |
| biz.tab.reviews | التقييمات | Reviews |
| biz.tab.about | عن المشروع | About |
| biz.by | من {owner} | By {owner} |
| biz.licensed | مرخّص ضمن برنامج المشاريع المنزلية | Licensed home business |
| biz.notFound | المشروع غير موجود | Business not found |
| biz.noProducts | ما في منتجات متاحة حالياً | No products available right now |
| biz.soldOut | نفدت الكمية | Sold out |
| biz.viewCart | عرض السلة | View cart |
| biz.addFav | أضف للمفضلة | Add to favourites |
| biz.removeFav | إزالة من المفضلة | Remove from favourites |
| biz.favAdded | أضفنا {name} للمفضلة 💚 | {name} added to favourites 💚 |
| biz.favRemoved | شلنا {name} من المفضلة | {name} removed from favourites |
| biz.closedOrderAhead | المشروع مغلق الآن، تقدر تطلب لوقت لاحق | This business is closed now; you can order for later |
| rev.writeReview | اكتب تقييمك | Write a review |
| rev.translate | ترجمة | Translate |
| rev.original | النص الأصلي | Show original |
| rev.placeholder | شاركنا تجربتك… | Share your experience… |
| rev.submit | نشر التقييم | Post review |
| rev.thanks | شكراً على تقييمك! | Thanks for your review! |
| rev.none | ما في تقييمات بعد، كن أول من يقيّم | No reviews yet. Be the first! |
| rev.rateOrder | قيّم طلبك | Rate your order |
| rel.today | اليوم | Today |
| rel.yesterday | أمس | Yesterday |
| rel.daysAgo | قبل {n} أيام | {n} days ago |
| rel.weeksAgo | قبل {n} أسابيع | {n} weeks ago |

**Product**

| Key | Arabic | English |
|---|---|---|
| prod.from | من {business} | From {business} |
| prod.chooseUpTo | اختر حتى {n} | Choose up to {n} |
| prod.notes | ملاحظات | Notes |
| prod.notesPlaceholder | مثلاً: بدون بصل، أو اكتب الاسم على الكيك | e.g. no onions, or a name for the cake |
| prod.addToCart | أضف للسلة · {price} | Add to cart · {price} |
| prod.added | تمت الإضافة للسلة ✓ | Added to cart ✓ |
| prod.addedNamed | أضفنا {product} للسلة | Added {product} to cart |
| prod.decrease | إنقاص الكمية | Decrease quantity |
| prod.increase | زيادة الكمية | Increase quantity |
| prod.notFound | المنتج غير موجود | Product not found |
| cart.newCartTitle | تبي تبدأ سلة جديدة؟ | Start a new cart? |
| cart.newCartBody | سلتك فيها منتجات من {business}. إذا أضفت هذا المنتج بنفرّغ السلة ونبدأ من جديد. | Your cart has items from {business}. Adding this item will clear it and start a new cart. |
| cart.newCartConfirm | ابدأ سلة جديدة | Start new cart |

**Cart**

| Key | Arabic | English |
|---|---|---|
| cart.title | السلة | Cart |
| cart.clear | تفريغ | Clear |
| cart.clearConfirm | تبي تفرّغ السلة؟ | Clear your cart? |
| cart.empty | سلتك فاضية | Your cart is empty |
| cart.emptyHint | تصفّح المشاريع وأضف اللي يعجبك | Browse businesses and add what you like |
| cart.browse | تصفّح الآن | Browse now |
| cart.removed | حذفنا {product} | Removed {product} |
| cart.fulfilment | طريقة الاستلام | How to get it |
| cart.pickup | استلام | Pickup |
| cart.delivery | توصيل | Delivery |
| cart.time | وقت الطلب | When |
| cart.asap | بأسرع وقت (~{n} د) | ASAP (~{n} min) |
| cart.schedule | جدولة | Schedule |
| cart.noSlotsToday | ما في أوقات متاحة اليوم | No slots left today |
| cart.closedBoth | المشروع مغلق اليوم وبكرة | This business is closed today and tomorrow |
| cart.paused | المشروع متوقف عن استقبال الطلبات حالياً | This business isn't taking orders right now |
| cart.minDelivery | الحد الأدنى للتوصيل {amount} | Minimum for delivery is {amount} |
| cart.promoPlaceholder | كود الخصم | Promo code |
| cart.apply | تطبيق | Apply |
| cart.promoApplied | تم تطبيق الكود 🎉 | Code applied 🎉 |
| cart.promoInvalid | الكود غير صالح | Invalid code |
| cart.promoMin | الكود يتطلب طلب بقيمة {amount} أو أكثر | This code needs an order of {amount} or more |
| cart.promoDeliveryOnly | الكود للتوصيل فقط | This code is for delivery only |
| cart.promoRemoved | تمت إزالة الكود لأن الشروط تغيّرت | Code removed because its conditions are no longer met |
| cart.subtotal | المجموع الفرعي | Subtotal |
| cart.deliveryFee | رسوم التوصيل | Delivery fee |
| cart.discount | الخصم ({code}) | Discount ({code}) |
| cart.total | الإجمالي | Total |
| cart.vatNote | الأسعار شاملة الضريبة | Prices include VAT |
| cart.checkout | متابعة للدفع · {total} | Continue to checkout · {total} |
| cart.unavailableItems | بعض المنتجات غير متوفرة الآن | Some items are no longer available |

**Checkout and payment**

| Key | Arabic | English |
|---|---|---|
| co.title | إتمام الطلب | Checkout |
| co.summary | ملخّص: {business} · {n} منتج | Summary: {business} · {n} items |
| co.address | عنوان التوصيل | Delivery address |
| co.area | المنطقة | Area |
| co.street | الشارع / المبنى | Street / building |
| co.unit | فيلا / شقة | Villa / apartment |
| co.addrNotes | ملاحظات للسائق | Notes for the driver |
| co.label.home | البيت | Home |
| co.label.work | الدوام | Work |
| co.label.other | آخر | Other |
| co.newAddress | عنوان جديد | New address |
| co.saveAddress | حفظ العنوان | Save address |
| co.fieldRequired | هذا الحقل مطلوب | This field is required |
| co.crossEmirate | التوصيل بين الإمارات قد يتأخر | Cross-emirate delivery may take longer |
| co.pickupFrom | الاستلام من {business} | Pickup from {business} |
| co.pickupNote | سيصلك الموقع الدقيق بعد قبول الطلب | The exact location is shared once the order is accepted |
| co.payment | طريقة الدفع | Payment method |
| pay.card | بطاقة | Card |
| pay.applePay | Apple Pay | Apple Pay |
| pay.cash | الدفع عند الاستلام | Cash on pickup/delivery |
| pay.cashLimit | الدفع النقدي متاح للطلبات حتى 500 د.إ | Cash is available for orders up to 500 AED |
| pay.cardNumber | رقم البطاقة | Card number |
| pay.cardName | الاسم على البطاقة | Name on card |
| pay.expiry | تاريخ الانتهاء (MM/YY) | Expiry (MM/YY) |
| pay.cvv | رمز الأمان CVV | CVV |
| pay.testCard | بطاقة تجريبية: 4242 4242 4242 4242 | Test card: 4242 4242 4242 4242 |
| pay.cardInvalid | رقم البطاقة غير صحيح | Invalid card number |
| pay.expiryInvalid | تاريخ الانتهاء غير صحيح | Invalid expiry date |
| pay.cvvInvalid | رمز الأمان من 3 أرقام | CVV must be 3 digits |
| pay.declined | تم رفض البطاقة، جرّب بطاقة ثانية | Card declined, try another card |
| pay.sheetConfirm | اضغط مرتين للتأكيد | Double-click to confirm |
| pay.done | تم | Done |
| co.placeOrder | تأكيد الطلب · {total} | Place order · {total} |
| co.placing | جاري تأكيد طلبك… | Placing your order… |
| placed.title | تم استلام طلبك! 🎉 | Order placed! 🎉 |
| placed.pickupAt | الاستلام {day} {time} | Pickup {day} {time} |
| placed.deliveryAt | التوصيل {day} {time} | Delivery {day} {time} |
| placed.eta | خلال ~{n} دقيقة | In about {n} min |
| placed.track | تتبّع الطلب | Track order |

**Tracking and orders**

| Key | Arabic | English |
|---|---|---|
| trk.title | تتبّع الطلب | Track order |
| st.received | تم استلام الطلب | Order received |
| st.preparing | قيد التجهيز | Preparing |
| st.readyPickup | جاهز للاستلام | Ready for pickup |
| st.readyDelivery | في الطريق إليك | On the way |
| st.completedPickup | تم الاستلام | Picked up |
| st.completedDelivery | تم التوصيل | Delivered |
| st.rejected | اعتذر المشروع عن الطلب | Business declined the order |
| st.cancelled | تم إلغاء الطلب | Order cancelled |
| trk.hero.received | وصل طلبك إلى {business} | {business} has your order |
| trk.hero.preparing | يتم تجهيز طلبك بكل حب | Your order is being prepared with care |
| trk.hero.readyPickup | طلبك جاهز! تقدر تستلمه الحين | Your order is ready to collect |
| trk.hero.readyDelivery | المندوب في الطريق إليك | Your driver is on the way |
| trk.hero.completed | بالعافية! نتمنى يعجبك 💚 | Enjoy! We hope you love it 💚 |
| trk.eta | الوقت المتوقع {time} | Estimated {time} |
| trk.cancel | إلغاء الطلب | Cancel order |
| trk.cancelConfirm | متأكد تبي تلغي الطلب؟ | Cancel this order? |
| trk.contactLater | التواصل متاح بعد قبول الطلب (تجريبي) | Contact available after acceptance (demo) |
| trk.statusToast | طلبك من {business}: {status} | Your {business} order: {status} |
| trk.track | تتبّع | Track |
| trk.browseOthers | تصفّح مشاريع ثانية | Browse other businesses |
| trk.notFound | ما لقينا هذا الطلب | Order not found |
| ord.title | طلباتي | My orders |
| ord.active | الحالية ({n}) | Active ({n}) |
| ord.past | السابقة ({n}) | Past ({n}) |
| ord.reorder | إعادة الطلب | Reorder |
| ord.rate | تقييم | Rate |
| ord.emptyActive | ما عندك طلبات حالية | No active orders |
| ord.emptyPast | ما عندك طلبات سابقة | No past orders |
| ord.orderNow | اطلب الآن | Order now |
| ord.loginPrompt | سجّل دخولك عشان تشوف طلباتك | Log in to see your orders |
| ord.items | {n} منتج | {n} items |
| ord.scheduled | مجدول | Scheduled |

**Favourites, profile, settings**

| Key | Arabic | English |
|---|---|---|
| fav.title | المفضلة | Favourites |
| fav.businesses | مشاريع | Businesses |
| fav.products | منتجات | Products |
| fav.empty | ما أضفت مفضلة بعد | No favourites yet |
| fav.emptyHint | اضغط ♡ على أي مشروع عشان تلقاه هنا | Tap ♡ on any business to find it here |
| prof.title | حسابي | My account |
| prof.guest | سجّل دخولك عشان تطلب وتتابع طلباتك | Log in to order and track your orders |
| prof.orders | طلباتي | My orders |
| prof.favorites | المفضلة | Favourites |
| prof.addresses | عناويني | My addresses |
| prof.noAddresses | ما عندك عناوين محفوظة | No saved addresses |
| prof.language | اللغة: {lang} | Language: {lang} |
| prof.settings | الإعدادات | Settings |
| prof.help | المساعدة | Help |
| prof.ownerCardTitle | عندك مشروع منزلي؟ | Run a home business? |
| prof.ownerCardCta | انتقل لوضع صاحب المشروع | Switch to owner mode |
| prof.version | حووي · الإصدار 1.0 (تجريبي) | Hawwi · version 1.0 (demo) |
| prof.editProfile | تعديل الملف الشخصي | Edit profile |
| help.q1 | كيف أطلب؟ | How do I order? |
| help.a1 | اختر مشروعاً، أضف المنتجات للسلة، حدّد الاستلام أو التوصيل والوقت، ثم أكّد الطلب. | Pick a business, add items to your cart, choose pickup or delivery and a time, then place your order. |
| help.q2 | هل الدفع حقيقي؟ | Is payment real? |
| help.a2 | لا، هذه نسخة تجريبية وكل عمليات الدفع وهمية. | No. This is a demo and all payments are simulated. |
| help.q3 | كيف أجرّب وضع صاحب المشروع؟ | How do I try owner mode? |
| help.a3 | من حسابي اختر "انتقل لوضع صاحب المشروع" ثم أي مشروع. اطفئ "تقدّم الطلبات تلقائياً" من الإعدادات لتتحكم بالطلبات بنفسك. | From Account choose "Switch to owner mode", then any business. Turn off "Auto-advance orders" in Settings to move orders yourself. |
| set.title | الإعدادات | Settings |
| set.language | اللغة | Language |
| set.arabic | العربية | العربية |
| set.english | English | English |
| set.notifications | الإشعارات | Notifications |
| set.autoAdvance | تقدّم الطلبات تلقائياً | Auto-advance orders |
| set.autoAdvanceHint | لتجربة وضع صاحب المشروع أطفئ هذا الخيار | Turn off to demo owner mode |
| set.appearance | المظهر | Appearance |
| set.light | فاتح | Light |
| set.dark | داكن | Dark |
| set.auto | تلقائي | Auto |
| set.reset | إعادة ضبط البيانات التجريبية | Reset demo data |
| set.resetConfirm | سيتم حذف الطلبات والسلة والمفضلة وأي تعديلات. متأكد؟ | This clears orders, cart, favourites and any edits. Are you sure? |
| set.resetDone | تمت إعادة الضبط | Demo data reset |
| set.logout | تسجيل الخروج | Log out |
| set.logoutConfirm | تبي تسجّل خروج؟ | Log out now? |
| set.footer | صُنع بحب للمشاريع المنزلية في الإمارات 🇦🇪 | Made with love for UAE home businesses 🇦🇪 |

**Owner mode**

| Key | Arabic | English |
|---|---|---|
| own.mode | وضع صاحب المشروع | Owner mode |
| own.backToShopping | العودة للتسوق | Back to shopping |
| own.selectTitle | اختر مشروعك | Choose your business |
| own.selectNote | للتجربة: اختر أي مشروع لإدارته | Demo: pick any business to manage |
| own.manage | إدارة | Manage |
| own.welcome | أهلاً {name}! أنت الآن في وضع صاحب المشروع | Hi {name}! You're now in owner mode |
| own.accepting | استقبال الطلبات | Accepting orders |
| own.greeting | {greeting} يا {name} | {greeting}, {name} |
| own.todayOrders | طلبات اليوم | Today's orders |
| own.todayRevenue | إيرادات اليوم | Today's revenue |
| own.pending | بانتظار القبول | Awaiting acceptance |
| own.rating | التقييم | Rating |
| own.vsYesterday | عن أمس | vs yesterday |
| own.sales7 | المبيعات آخر 7 أيام (د.إ) | Sales, last 7 days (AED) |
| own.bestSellers | الأكثر مبيعاً | Best sellers |
| own.noSales | ما في مبيعات بعد | No sales yet |
| own.noData | ما في بيانات بعد | No data yet |
| own.recentOrders | آخر الطلبات | Recent orders |
| own.tab.new | جديدة | New |
| own.tab.progress | قيد التجهيز | In progress |
| own.tab.ready | جاهزة | Ready |
| own.tab.done | مكتملة | Done |
| own.accept | قبول | Accept |
| own.reject | رفض | Reject |
| own.markReady | جاهز | Mark ready |
| own.markPicked | تم الاستلام | Picked up |
| own.markDelivered | تم التوصيل | Delivered |
| own.accepted | قبلت الطلب {id} | Accepted order {id} |
| own.rejected | رفضت الطلب {id} | Declined order {id} |
| own.markedReady | الطلب {id} جاهز | Order {id} is ready |
| own.completed | اكتمل الطلب {id} | Order {id} completed |
| own.rejectTitle | سبب الرفض | Reason for declining |
| own.reason.stock | نفدت الكمية | Out of stock |
| own.reason.busy | مشغولين حالياً | Too busy right now |
| own.reason.area | خارج منطقة التوصيل | Outside delivery area |
| own.reason.other | سبب آخر | Other reason |
| own.empty.new | ما في طلبات جديدة الحين | No new orders right now |
| own.empty.progress | ما في طلبات قيد التجهيز | Nothing in preparation |
| own.empty.ready | ما في طلبات جاهزة | No orders ready |
| own.empty.done | ما في طلبات مكتملة | No completed orders |
| own.products | المنتجات ({n}) | Products ({n}) |
| own.newProduct | منتج جديد | New product |
| own.searchProducts | ابحث في منتجاتك | Search your products |
| own.visible | ظاهر | Visible |
| own.hidden | مخفي | Hidden |
| own.inStock | متوفر | In stock |
| own.deleteTitle | حذف المنتج؟ | Delete product? |
| own.deleteBody | سيتم حذف {name} نهائياً من متجرك. | {name} will be permanently removed from your shop. |
| own.productSaved | تم حفظ المنتج | Product saved |
| own.productDeleted | تم حذف المنتج | Product deleted |
| own.discardTitle | تجاهل التعديلات؟ | Discard changes? |
| own.noProducts | ما أضفت منتجات بعد | You haven't added products yet |
| own.addFirst | أضف أول منتج | Add your first product |
| own.f.nameAr | الاسم بالعربي | Arabic name |
| own.f.nameEn | الاسم بالإنجليزي | English name |
| own.f.descAr | الوصف بالعربي | Arabic description |
| own.f.descEn | الوصف بالإنجليزي | English description |
| own.f.price | السعر (د.إ) | Price (AED) |
| own.f.section | القسم | Section |
| own.f.newSection | قسم جديد | New section |
| own.f.emoji | الإيموجي | Emoji |
| own.f.options | الخيارات والإضافات | Options and add-ons |
| own.f.addGroup | أضف مجموعة | Add group |
| own.f.groupName | اسم المجموعة | Group name |
| own.f.single | اختيار واحد | Single choice |
| own.f.multi | اختيار متعدد | Multiple choice |
| own.f.max | الحد الأقصى | Maximum |
| own.f.addChoice | أضف خياراً | Add choice |
| own.f.priceDelta | فرق السعر | Price difference |
| own.shopTitle | متجري | My shop |
| own.f.bizNameAr | اسم المشروع (عربي) | Business name (Arabic) |
| own.f.bizNameEn | اسم المشروع (إنجليزي) | Business name (English) |
| own.f.bioAr | نبذة (عربي) | About (Arabic) |
| own.f.bioEn | نبذة (إنجليزي) | About (English) |
| own.f.colours | ألوان الغلاف | Cover colours |
| own.f.deliveryFee | رسوم التوصيل (د.إ) | Delivery fee (AED) |
| own.f.minOrder | الحد الأدنى للتوصيل (د.إ) | Delivery minimum (AED) |
| own.f.prep | وقت التجهيز (دقيقة) | Prep time (minutes) |
| own.f.oneMethod | لازم تختار الاستلام أو التوصيل على الأقل | Choose at least pickup or delivery |
| own.hours | ساعات العمل | Opening hours |
| own.afterMidnight | يسكّر بعد منتصف الليل | Closes after midnight |
| own.sameTimes | وقت الفتح والإغلاق متطابقان | Open and close times are the same |
| own.copySaturday | نسخ ساعات السبت لكل الأيام | Copy Saturday to all days |
| own.saveShop | حفظ التعديلات | Save changes |
| own.shopSaved | تم حفظ بيانات المتجر | Shop details saved |
| own.viewAsCustomer | عرض متجري كزبون | View my shop as a customer |
| own.exit | الخروج من وضع صاحب المشروع | Exit owner mode |

**Days and time**

| Key | Arabic | English |
|---|---|---|
| day.sat | السبت | Saturday |
| day.sun | الأحد | Sunday |
| day.mon | الاثنين | Monday |
| day.tue | الثلاثاء | Tuesday |
| day.wed | الأربعاء | Wednesday |
| day.thu | الخميس | Thursday |
| day.fri | الجمعة | Friday |
| dayShort (Sat→Fri) | س ح ن ث ر خ ج | Sat Sun Mon Tue Wed Thu Fri |
| time.am | ص | AM |
| time.pm | م | PM |
| time.min | دقيقة | min |

### 7.3 Formatting rules

- **Prices:** Arabic: `{amount} د.إ` (e.g. "45 د.إ", "120.70 د.إ"). English: `AED {amount}` (e.g. "AED 45", "AED 120.70"). Whole numbers show no decimals; otherwise exactly 2 decimals. Discounts prefix with "−" (U+2212). Wrap the whole price in `<bdi>` so it never reorders in mixed text. Implementation: ``fmtPrice(n) = lang === 'ar' ? `${num} د.إ` : `AED ${num}` ``, where `num = Number.isInteger(r) ? r : r.toFixed(2)` and `r = Math.round(n*100)/100`.
- **Times:** 12-hour clock with Latin digits: Arabic "4:30 م", "11:00 ص"; English "4:30 PM". Midnight is "12:00 ص"/"12:00 AM".
- **Order numbers:** `#HW-` + incrementing integer starting at 1001 (seed orders use 1001–1084; new orders continue from `hawwi.orderSeq`).
- **Phones:** `+971 50 123 4567`; owner views mask as `+971 50 *** 4567`.
- **Plurals:** keep the simple forms above ("{n} منتج", "{n} تقييم") which read naturally for all n in UI labels.

---
## 8. Demo data

All names, owners and businesses are fictional. 14 businesses across 6 emirates, covering all 5 categories.

### 8.1 Conventions

- IDs: businesses `b01`–`b14`; products `b01-p1` … (product id is unique globally, route uses `#/product/b01/b01-p1`).
- Prices in AED, VAT included.
- **Hours** are a 7-item array in the order **Sat, Sun, Mon, Tue, Wed, Thu, Fri**. Each item is `["HH:MM","HH:MM"]` or `null` (closed). A close time earlier than the open time means it closes after midnight.
- **Options notation** used in the product tables:
  - `◉ GroupAr / GroupEn [single, required]: ChoiceAr / ChoiceEn +delta; …` — single choice. The first choice is the default.
  - `☐ GroupAr / GroupEn [multi, max N]: ChoiceAr / ChoiceEn +delta; …` — add-ons (no max = unlimited).
  - `+0` is shown as "—" in the UI.
- Every business supports pickup unless noted. `delivery` lists the fee; "no" means pickup only.
- `prep` = prep minutes used for ASAP and slot generation.
- `colors` refers to a gradient preset id from 5.1.

### 8.2 Businesses

| id | Name AR / EN | Category | Owner AR / EN | Emirate · Area AR / EN | Logo | colors | Rating (reviews) | Delivery fee · min | Pickup | prep | Featured |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b01 | مطبخ أم سعيد / Um Saeed's Kitchen | food | أم سعيد / Um Saeed | Dubai · البرشاء / Al Barsha | 🍲 | saffron | 4.9 (318) | 10 · 40 | yes | 45 | yes |
| b02 | حلويات ريم / Reem's Sweets | sweets | ريم / Reem | Dubai · الخوانيج / Al Khawaneej | 🧁 | rose | 4.8 (212) | 15 · 60 | yes | 60 | yes |
| b03 | دار العود / Dar Al Oud | perfume | أبو خالد / Abu Khalid | Dubai · مردف / Mirdif | 🪵 | oud | 4.7 (156) | 12 · 80 | yes | 30 | no |
| b04 | عبايات لمسة / Lamsa Abayas | abaya | شيخة / Shaikha | Dubai · جميرا / Jumeirah | 👗 | night | 4.6 (98) | 20 · 150 | yes | 120 | no |
| b05 | خبز وسمن / Bread & Ghee | food | أم راشد / Um Rashid | Sharjah · الخان / Al Khan | 🫓 | sand | 4.8 (241) | 8 · 30 | yes | 30 | no |
| b06 | بخور نسيم / Naseem Bakhoor | perfume | نسيم / Naseem | Sharjah · النهدة / Al Nahda | 🪔 | lavender | 4.7 (133) | 10 · 50 | yes | 20 | no |
| b07 | غُرزة / Ghurza Crafts | crafts | مريم / Maryam | Sharjah · مويلح / Muwaileh | 🧶 | sea | 4.9 (87) | 15 · 60 | yes | 90 | yes |
| b08 | مطبخ هيا / Haya's Kitchen | food | هيا / Haya | Ajman · النعيمية / Al Nuaimiya | 🥘 | saffron | 4.6 (174) | 7 · 35 | yes | 40 | no |
| b09 | كيكة سلمى / Salma's Cakes | sweets | سلمى / Salma | Ajman · الروضة / Al Rawda | 🎂 | rose | 4.7 (145) | 10 · 50 | yes | 60 | no |
| b10 | مجبوس الوالدة / Al Walda Majboos | food | أم حمد / Um Hamad | Abu Dhabi · مدينة خليفة / Khalifa City | 🍛 | palm | 4.8 (289) | 10 · 45 | yes | 50 | yes |
| b11 | دخون الدار / Dukhoon Al Dar | perfume | موزة / Moza | Abu Dhabi · المشرف / Al Mushrif | 🏺 | oud | 4.8 (176) | 15 · 100 | yes | 30 | yes |
| b12 | عبايات مُزن / Muzn Abayas | abaya | مزنة / Muzna | Abu Dhabi · البطين / Al Bateen | 🧕 | night | 4.7 (112) | 20 · 200 | yes | 120 | no |
| b13 | طين ونور / Teen & Noor | crafts | نورة / Noura | Ras Al Khaimah · النخيل / Al Nakheel | 🕯️ | sand | 4.6 (64) | no | yes | 60 | no |
| b14 | حلويات الفريج / Fareej Sweets | sweets | أم علي / Um Ali | Fujairah · الفصيل / Al Faseel | 🍯 | saffron | 4.9 (203) | 8 · 30 | yes | 40 | yes |

**Hours (Sat, Sun, Mon, Tue, Wed, Thu, Fri)**

| id | Hours |
|---|---|
| b01 | 11:00–22:00 ×6 (Sat–Thu), Fri 13:00–23:00 |
| b02 | 10:00–21:00 Sat–Thu, Fri closed |
| b03 | 16:00–01:00 every day (closes after midnight) |
| b04 | 10:00–20:00 Sat–Wed, Thu 10:00–22:00, Fri closed |
| b05 | 06:00–12:00 every day |
| b06 | 09:00–22:00 Sat–Thu, Fri 15:00–22:00 |
| b07 | 10:00–18:00 Sun–Thu, Sat 12:00–18:00, Fri closed |
| b08 | 12:00–22:00 Sat–Thu, Fri 13:00–22:00 |
| b09 | 09:00–21:00 Sat–Thu, Fri 14:00–21:00 |
| b10 | 11:30–23:00 every day |
| b11 | 10:00–22:00 Sat–Thu, Fri 16:00–23:00 |
| b12 | 10:00–21:00 Sat–Thu, Fri closed |
| b13 | 15:00–21:00 Sat, Mon, Wed; 15:00–22:00 Thu; Sun, Tue, Fri closed |
| b14 | 14:00–23:30 every day |

As arrays (copy directly):

```js
b01: [["11:00","22:00"],["11:00","22:00"],["11:00","22:00"],["11:00","22:00"],["11:00","22:00"],["11:00","22:00"],["13:00","23:00"]]
b02: [["10:00","21:00"],["10:00","21:00"],["10:00","21:00"],["10:00","21:00"],["10:00","21:00"],["10:00","21:00"],null]
b03: [["16:00","01:00"],["16:00","01:00"],["16:00","01:00"],["16:00","01:00"],["16:00","01:00"],["16:00","01:00"],["16:00","01:00"]]
b04: [["10:00","20:00"],["10:00","20:00"],["10:00","20:00"],["10:00","20:00"],["10:00","20:00"],["10:00","22:00"],null]
b05: [["06:00","12:00"],["06:00","12:00"],["06:00","12:00"],["06:00","12:00"],["06:00","12:00"],["06:00","12:00"],["06:00","12:00"]]
b06: [["09:00","22:00"],["09:00","22:00"],["09:00","22:00"],["09:00","22:00"],["09:00","22:00"],["09:00","22:00"],["15:00","22:00"]]
b07: [["12:00","18:00"],["10:00","18:00"],["10:00","18:00"],["10:00","18:00"],["10:00","18:00"],["10:00","18:00"],null]
b08: [["12:00","22:00"],["12:00","22:00"],["12:00","22:00"],["12:00","22:00"],["12:00","22:00"],["12:00","22:00"],["13:00","22:00"]]
b09: [["09:00","21:00"],["09:00","21:00"],["09:00","21:00"],["09:00","21:00"],["09:00","21:00"],["09:00","21:00"],["14:00","21:00"]]
b10: [["11:30","23:00"],["11:30","23:00"],["11:30","23:00"],["11:30","23:00"],["11:30","23:00"],["11:30","23:00"],["11:30","23:00"]]
b11: [["10:00","22:00"],["10:00","22:00"],["10:00","22:00"],["10:00","22:00"],["10:00","22:00"],["10:00","22:00"],["16:00","23:00"]]
b12: [["10:00","21:00"],["10:00","21:00"],["10:00","21:00"],["10:00","21:00"],["10:00","21:00"],["10:00","21:00"],null]
b13: [["15:00","21:00"],null,["15:00","21:00"],null,["15:00","21:00"],["15:00","22:00"],null]
b14: [["14:00","23:30"],["14:00","23:30"],["14:00","23:30"],["14:00","23:30"],["14:00","23:30"],["14:00","23:30"],["14:00","23:30"]]
```

Day index mapping from JS: `satIndex = (date.getDay() + 1) % 7` (JS Sunday=0 → index 1; Saturday=6 → index 0).

**Bios and tags (About tab; tags feed search)**

| id | Bio AR | Bio EN | Tags |
|---|---|---|---|
| b01 | أكل إماراتي بنفس طعم بيت الأهل، نطبخ كل يوم من الصبح بمكونات طازجة. | Emirati home cooking that tastes like family, cooked fresh every morning. | مجبوس، هريس، ثريد، majboos, harees, emirati |
| b02 | كيك وحلويات بنكهات خليجية: زعفران، هيل، تمر وورد. نجهّز للمناسبات والعزايم. | Cakes and sweets with Gulf flavours: saffron, cardamom, dates and rose. Made for gatherings and occasions. | كيك، كنافة، cake, kunafa, eid |
| b03 | عود ودهن عود مختار بعناية، نخلط ونعبي في البيت بخبرة أكثر من 20 سنة. | Carefully selected oud and oud oils, blended and bottled at home with over 20 years of experience. | عود، دهن، oud, oil, gift |
| b04 | عبايات عصرية بقصّات مريحة، تفصيل حسب المقاس وتطريز بالاسم. | Modern abayas with comfortable cuts, made to measure with optional name embroidery. | عبايات، شيلة، abaya, shayla |
| b05 | فطور إماراتي أصيل: بلاليط، خمير، جباب وكرك بالزعفران، طازج كل صباح. | Authentic Emirati breakfast: balaleet, khameer, chebab and saffron karak, fresh every morning. | فطور، خمير، كرك، breakfast, karak |
| b06 | بخور ومعطرات بيت بخلطات خاصة تخلّي ريحة بيتك تفوح. | Bakhoor and home scents in our own blends to make your home smell wonderful. | بخور، معطر، bakhoor, spray |
| b07 | هدايا مصنوعة يدوياً: تطريز بالأسماء، كروشيه ونسيج سدو بلمسة عصرية. | Handmade gifts: name embroidery, crochet and Sadu weaving with a modern touch. | تطريز، كروشيه، سدو، embroidery, crochet, sadu |
| b08 | أطباق بيتية مشبعة من مطبخ هيا، تكفي العايلة وتفرح الضيوف. | Hearty home dishes from Haya's kitchen, enough for the family and the guests. | برياني، مضروبة، biryani |
| b09 | كيك طري وحلى بارد بوصفات سلمى الخاصة، نزيّن حسب طلبك. | Soft cakes and chilled desserts from Salma's own recipes, decorated the way you like. | كيك، براونيز، cake, brownies |
| b10 | مجبوس ومندي ومضغوط على أصوله، وصفات الوالدة من أبوظبي. | Majboos, mandi and madghout done right, mum's recipes from Abu Dhabi. | مجبوس، مندي، majboos, mandi |
| b11 | دخون ومخمرية بخلطات إماراتية فاخرة، مثالية للهدايا والأعراس. | Luxurious Emirati dukhoon and mukhamaria blends, perfect for gifts and weddings. | دخون، مخمرية، عرس، dukhoon, wedding |
| b12 | عبايات أنيقة للمناسبات واليوم، أقمشة مختارة وتشطيب يدوي. | Elegant abayas for occasions and everyday, with selected fabrics and hand finishing. | عبايات، مناسبات، abaya, occasion |
| b13 | شموع معطّرة وفخار مرسوم باليد من رأس الخيمة. | Scented candles and hand-painted pottery from Ras Al Khaimah. | شموع، فخار، candles, pottery |
| b14 | لقيمات وخنفروش وحلويات الفريج زي ما كانت جدّاتنا يسوونها. | Luqaimat, khanfaroosh and neighbourhood sweets just like our grandmothers made. | لقيمات، خنفروش، luqaimat |

### 8.3 Products

Columns: id · Name AR / EN · Description AR / EN · Price · Emoji · Section AR / EN · Options/add-ons.

One product per business is seeded with `available: false` (sold out) to exercise that state; it is marked **(sold out)**.

#### b01 — مطبخ أم سعيد / Um Saeed's Kitchen

| id | Name AR / EN | Description AR / EN | Price | Emoji | Section | Options |
|---|---|---|---|---|---|---|
| b01-p1 | مجبوس دجاج / Chicken Majboos | رز بسمتي مع دجاج متبّل بالبزار الإماراتي واللومي. / Basmati rice with chicken spiced with Emirati bezar and dried lime. | 45 | 🍛 | أطباق رئيسية / Mains | ◉ الحجم / Size [single, required]: فردي / Individual +0; عائلي (4 أشخاص) / Family (serves 4) +70 · ☐ إضافات / Add-ons [multi, max 3]: دقوس إضافي / Extra daqoos +3; سلطة خضراء / Green salad +8; لبن / Laban +4 |
| b01-p2 | مجبوس لحم / Lamb Majboos | لحم غنم محلي مطبوخ على نار هادية مع رز مبهّر. / Local lamb slow-cooked with spiced rice. | 65 | 🍖 | أطباق رئيسية / Mains | ◉ الحجم / Size [single, required]: فردي / Individual +0; عائلي (4 أشخاص) / Family (serves 4) +95 · ☐ إضافات / Add-ons [multi, max 3]: دقوس إضافي / Extra daqoos +3; سلطة خضراء / Green salad +8; لبن / Laban +4 |
| b01-p3 | هريس / Harees | قمح ولحم مضروب على الطريقة التقليدية مع سمن بلدي. / Wheat and meat slow-beaten the traditional way, topped with local ghee. | 35 | 🥣 | أطباق رئيسية / Mains | ◉ الحجم / Size [single, required]: صحن / Bowl +0; قدر صغير (3 أشخاص) / Small pot (serves 3) +50 · ☐ إضافات / Add-ons [multi]: سمن بلدي إضافي / Extra local ghee +5 |
| b01-p4 | ثريد / Thareed | خبز رقاق مغموس بمرق الخضار واللحم. / Regag bread soaked in a rich vegetable and meat stew. | 40 | 🥘 | أطباق رئيسية / Mains | ◉ البروتين / Protein [single, required]: دجاج / Chicken +0; لحم / Lamb +12 |
| b01-p5 | صالونة سمك / Fish Saloona | صالونة سمك بالطماط والبهارات تقدّم مع الرز. / Fish stew with tomato and spices, served with rice. | 48 | 🐟 | أطباق رئيسية / Mains | ◉ الرز / Rice [single, required]: رز أبيض / White rice +0; رز مشخول / Mashkhool rice +4 |
| b01-p6 | سمبوسة (12 حبة) / Samboosa (12 pcs) | سمبوسة مقرمشة محشية ومقلية على الطلب. / Crispy samboosa, filled and fried to order. | 25 | 🥟 | مقبلات / Sides | ◉ الحشوة / Filling [single, required]: جبن / Cheese +0; لحم / Meat +5; خضار / Vegetable +0 |
| b01-p7 | خبز رقاق (5 حبات) / Regag Bread (5 pcs) | خبز رقيق مقرمش مخبوز على الصاج. / Thin, crispy bread baked on the saj. | 15 | 🫓 | خبز / Bread | ◉ الإضافة / Topping [single, required]: سادة / Plain +0; بيض وجبن / Egg & cheese +6; زعتر / Za'atar +3 |
| b01-p8 | لقيمات (20 حبة) / Luqaimat (20 pcs) **(sold out)** | كرات عجين ذهبية مقرمشة مع دبس التمر. / Golden crispy dough balls with date syrup. | 20 | 🍯 | حلا / Dessert | ◉ الصوص / Syrup [single, required]: دبس تمر / Date syrup +0; عسل / Honey +5 |

#### b02 — حلويات ريم / Reem's Sweets

| id | Name AR / EN | Description AR / EN | Price | Emoji | Section | Options |
|---|---|---|---|---|---|---|
| b02-p1 | كيكة زعفران وهيل / Saffron & Cardamom Cake | كيكة إسفنجية بالزعفران والهيل مع كريمة خفيفة. / Saffron and cardamom sponge with light cream. | 120 | 🎂 | كيك / Cakes | ◉ الحجم / Size [single, required]: 1 كيلو / 1 kg +0; 2 كيلو / 2 kg +100 · ☐ إضافات / Extras [multi]: كتابة على الكيك / Writing on cake +10; شموع / Candles +5; تغليف هدية / Gift wrap +15 |
| b02-p2 | كنافة بالجبن / Cheese Kunafa | كنافة ناعمة بالجبن العكاوي والقطر، تقدّم حارة. / Soft kunafa with akkawi cheese and syrup, served warm. | 24 | 🥮 | حلويات شرقية / Arabic sweets | ◉ الحجم / Size [single, required]: صحن فردي / Single plate +0; صينية صغيرة / Small tray +56 |
| b02-p3 | تشيز كيك بالتمر / Date Cheesecake | تشيز كيك كريمي بقاعدة بسكويت وتمر. / Creamy cheesecake on a biscuit and date base. | 95 | 🍰 | كيك / Cakes | ◉ الصوص / Topping [single, required]: كراميل التمر / Date caramel +0; فستق / Pistachio +15 |
| b02-p4 | كب كيك (6 حبات) / Cupcakes (6 pcs) | كب كيك طري بكريمة الزبدة. / Soft cupcakes with buttercream. | 45 | 🧁 | كيك / Cakes | ◉ النكهة / Flavour [single, required]: فانيلا / Vanilla +0; شوكولاتة / Chocolate +5; ريد فيلفيت / Red velvet +8 · ☐ إضافات / Extras [multi]: تزيين بالاسم / Name toppers +12 |
| b02-p5 | بسبوسة بالقشطة / Basbousa with Cream **(sold out)** | بسبوسة بالسميد محشية قشطة ومزينة باللوز. / Semolina basbousa filled with cream and topped with almonds. | 35 | 🍮 | حلويات شرقية / Arabic sweets | — |
| b02-p6 | علبة حلويات العيد / Eid Sweets Box | تشكيلة من حلوياتنا في علبة أنيقة للإهداء. / An assortment of our sweets in an elegant gift box. | 150 | 🎁 | علب وهدايا / Boxes & gifts | ◉ الحجم / Size [single, required]: صغيرة (20 قطعة) / Small (20 pcs) +0; كبيرة (40 قطعة) / Large (40 pcs) +130 · ☐ إضافات / Extras [multi]: بطاقة إهداء / Gift card +5 |
| b02-p7 | ماكرون بنكهات خليجية (12) / Gulf-flavour Macarons (12) | ماكرون هش بنكهات الهيل والزعفران والورد والفستق. / Delicate macarons in cardamom, saffron, rose and pistachio. | 60 | 🍬 | علب وهدايا / Boxes & gifts | ☐ النكهات / Flavours [multi, max 3]: هيل / Cardamom +0; زعفران / Saffron +0; ورد / Rose +0; فستق / Pistachio +0 |

#### b03 — دار العود / Dar Al Oud

| id | Name AR / EN | Description AR / EN | Price | Emoji | Section | Options |
|---|---|---|---|---|---|---|
| b03-p1 | دهن عود كمبودي / Cambodian Oud Oil | دهن عود معتّق بريحة عميقة وثبات عالي. / Aged oud oil with a deep, long-lasting scent. | 250 | 🫙 | دهن عود / Oud oils | ◉ الحجم / Size [single, required]: 3 مل / 3 ml +0; 6 مل / 6 ml +230; 12 مل / 12 ml +450 |
| b03-p2 | بخور معمول (50 غ) / Ma'amoul Bakhoor (50 g) | بخور معمول ناعم يدوم طويلاً في المجالس. / Soft ma'amoul bakhoor that lingers in the majlis. | 85 | 🪔 | بخور / Bakhoor | ◉ الريحة / Scent [single, required]: كلاسيكي / Classic +0; ورد / Rose +10; عنبر / Amber +15 |
| b03-p3 | عود كلمنتان (تولة) / Kalimantan Oud Chips (tola) | قطع عود طبيعي للتبخير، تولة 12 غرام. / Natural oud chips for burning, one tola (12 g). | 180 | 🪵 | عود / Oud wood | ◉ الدرجة / Grade [single, required]: عادي / Standard +0; ممتاز / Premium +120 |
| b03-p4 | عطر مسك أبيض (50 مل) / White Musk Perfume (50 ml) | مسك ناعم ونظيف يناسب كل يوم. / Soft, clean musk for every day. | 140 | 🌸 | عطور / Perfumes | ☐ إضافات / Extras [multi]: تغليف هدية / Gift wrap +15; بطاقة إهداء / Gift card +5 |
| b03-p5 | مخلط دار العود (30 مل) / Dar Al Oud Blend (30 ml) | خلطتنا الخاصة من العود والورد والعنبر. / Our signature blend of oud, rose and amber. | 175 | 🧴 | عطور / Perfumes | ☐ إضافات / Extras [multi]: تغليف هدية / Gift wrap +15 |
| b03-p6 | مبخرة سيراميك / Ceramic Burner | مبخرة سيراميك بتصميم عصري. / A ceramic burner with a modern design. | 95 | 🏺 | مباخر / Burners | ◉ اللون / Colour [single, required]: أبيض / White +0; ذهبي / Gold +20; أخضر / Green +0 |
| b03-p7 | طقم هدية العود / Oud Gift Set **(sold out)** | دهن عود 3 مل وبخور معمول ومبخرة في صندوق هدية. / 3 ml oud oil, ma'amoul bakhoor and a burner in a gift box. | 380 | 🎁 | هدايا / Gifts | ☐ إضافات / Extras [multi]: بطاقة إهداء / Gift card +5 |

#### b04 — عبايات لمسة / Lamsa Abayas

Size option used below = `◉ المقاس / Size [single, required]: 52 +0; 54 +0; 56 +0; 58 +20`.

| id | Name AR / EN | Description AR / EN | Price | Emoji | Section | Options |
|---|---|---|---|---|---|---|
| b04-p1 | عباية كلوش سادة / Plain Cloche Abaya | عباية كلوش بقماش ناعم وانسيابي لكل يوم. / A soft, flowing cloche abaya for every day. | 280 | 👗 | يومية / Everyday | Size · ☐ تعديلات / Alterations [multi]: تقصير الطول / Hemming +20; تطريز الاسم / Name embroidery +40 |
| b04-p2 | عباية مطرزة بالخرز / Beaded Abaya | عباية سوداء بتطريز خرز يدوي على الأكمام. / Black abaya with hand-beaded sleeves. | 520 | ✨ | مناسبات / Occasions | Size · ☐ إضافات / Extras [multi]: شيلة مطابقة / Matching shayla +60 |
| b04-p3 | عباية كتان صيفية / Summer Linen Abaya | عباية كتان خفيفة ومريحة للصيف. / A light, breathable linen abaya for summer. | 340 | 🌿 | يومية / Everyday | Size · ◉ اللون / Colour [single, required]: بيج / Beige +0; زيتي / Olive +0; رمادي / Grey +0 |
| b04-p4 | عباية دانتيل للمناسبات / Lace Occasion Abaya | عباية فاخرة بتفاصيل دانتيل على الصدر والأطراف. / A luxurious abaya with lace detailing. | 690 | 💎 | مناسبات / Occasions | Size · ☐ تعديلات / Alterations [multi]: تقصير الطول / Hemming +20 |
| b04-p5 | عباية بشت عصرية / Modern Bisht Abaya | عباية بقصّة البشت وحواف ذهبية. / Bisht-cut abaya with gold-trimmed edges. | 450 | 🪡 | مناسبات / Occasions | Size |
| b04-p6 | شيلة شيفون / Chiffon Shayla | شيلة شيفون خفيفة لا تنزلق. / A light, non-slip chiffon shayla. | 55 | 🧣 | شيلات / Shaylas | ◉ اللون / Colour [single, required]: أسود / Black +0; كحلي / Navy +0; بيج / Beige +0 |
| b04-p7 | شيلة كريب / Crepe Shayla **(sold out)** | شيلة كريب مطفية بلمسة ناعمة. / A matte crepe shayla with a soft feel. | 65 | 🧕 | شيلات / Shaylas | ◉ اللون / Colour [single, required]: أسود / Black +0; رمادي / Grey +0 |

#### b05 — خبز وسمن / Bread & Ghee

| id | Name AR / EN | Description AR / EN | Price | Emoji | Section | Options |
|---|---|---|---|---|---|---|
| b05-p1 | بلاليط / Balaleet | شعيرية حلوة بالزعفران والهيل. / Sweet vermicelli with saffron and cardamom. | 22 | 🍜 | فطور / Breakfast | ☐ إضافات / Add-ons [multi]: أومليت فوق البلاليط / Omelette on top +5; زعفران إضافي / Extra saffron +4 |
| b05-p2 | خبز خمير (4 حبات) / Khameer Bread (4 pcs) | خبز خمير طري بالهيل والزعفران. / Soft khameer bread with cardamom and saffron. | 16 | 🥯 | خبز / Bread | ◉ الحشوة / Filling [single, required]: سادة / Plain +0; جبن / Cheese +4; تمر / Dates +3 |
| b05-p3 | جباب (6 حبات) / Chebab (6 pcs) | فطائر إماراتية خفيفة بالهيل. / Light Emirati pancakes with cardamom. | 18 | 🥞 | فطور / Breakfast | ◉ الصوص / Syrup [single, required]: دبس / Date syrup +0; عسل / Honey +5 · ☐ إضافات / Add-ons [multi]: جبن كريمي / Cream cheese +4 |
| b05-p4 | خبز محلى (4 حبات) / Mahalla Bread (4 pcs) | خبز محلى ذهبي بالسمسم. / Golden sweet bread with sesame. | 14 | 🍞 | خبز / Bread | — |
| b05-p5 | عصيدة / Aseeda | عصيدة بالسمن والزعفران. / Aseeda pudding with ghee and saffron. | 20 | 🍮 | فطور / Breakfast | ◉ الحجم / Size [single, required]: فردي / Individual +0; عائلي / Family +30 |
| b05-p6 | بيض وطماط / Eggs with Tomato | بيض مع طماط وبصل بالطريقة البيتية. / Eggs with tomato and onion, home style. | 18 | 🍳 | فطور / Breakfast | ☐ إضافات / Add-ons [multi]: خبز رقاق / Regag bread +5 |
| b05-p7 | كرك بالزعفران (لتر) / Saffron Karak (1 L) | شاي كرك بالزعفران والهيل في ترمس. / Saffron and cardamom karak tea in a flask. | 25 | ☕ | مشروبات / Drinks | ◉ السكر / Sugar [single, required]: عادي / Regular +0; خفيف / Light +0; بدون / None +0 |
| b05-p8 | قهوة عربية (دلة لتر) / Arabic Coffee (1 L dallah) **(sold out)** | قهوة عربية بالهيل والزعفران. / Arabic coffee with cardamom and saffron. | 30 | 🫖 | مشروبات / Drinks | ☐ إضافات / Add-ons [multi]: تمر خلاص (250 غ) / Khalas dates (250 g) +15 |

#### b06 — بخور نسيم / Naseem Bakhoor

| id | Name AR / EN | Description AR / EN | Price | Emoji | Section | Options |
|---|---|---|---|---|---|---|
| b06-p1 | بخور نسيم الورد / Naseem Rose Bakhoor | بخور بالورد الطائفي والمسك. / Bakhoor with Taifi rose and musk. | 65 | 🌹 | بخور / Bakhoor | ◉ الوزن / Weight [single, required]: 50 غ / 50 g +0; 100 غ / 100 g +55 |
| b06-p2 | بخور العنبر / Amber Bakhoor | بخور دافي بالعنبر والفانيلا. / Warm bakhoor with amber and vanilla. | 70 | 🟤 | بخور / Bakhoor | ◉ الوزن / Weight [single, required]: 50 غ / 50 g +0; 100 غ / 100 g +55 |
| b06-p3 | معطر مفارش (250 مل) / Linen Spray (250 ml) | معطر للمفارش والوسائد بريحة تدوم. / A long-lasting spray for linens and pillows. | 45 | 🧴 | معطرات / Home scents | ◉ الريحة / Scent [single, required]: ورد / Rose +0; مسك / Musk +0; عود / Oud +10 |
| b06-p4 | معطر جو / Room Spray | معطر جو بخلطة نسيم الصباح. / Room spray in our Morning Breeze blend. | 40 | 🌬️ | معطرات / Home scents | — |
| b06-p5 | مسك الطهارة (20 غ) / Musk Tahara (20 g) | مسك أبيض كريمي ناعم. / Soft, creamy white musk. | 35 | 🤍 | عطور / Perfumes | — |
| b06-p6 | عطر نسيم الصباح (50 مل) / Morning Breeze Perfume (50 ml) | عطر منعش بالحمضيات والمسك. / A fresh perfume of citrus and musk. | 160 | 🌸 | عطور / Perfumes | ☐ إضافات / Extras [multi]: تغليف هدية / Gift wrap +15 |
| b06-p7 | فحم سريع الاشتعال (10 أقراص) / Quick-light Charcoal (10 discs) **(sold out)** | فحم للبخور يشتعل بسرعة وبدون ريحة. / Fast-lighting, odourless charcoal for bakhoor. | 12 | ⚫ | مستلزمات / Essentials | — |

#### b07 — غُرزة / Ghurza Crafts

| id | Name AR / EN | Description AR / EN | Price | Emoji | Section | Options |
|---|---|---|---|---|---|---|
| b07-p1 | طارة تطريز بالاسم / Embroidered Name Hoop | طارة مطرزة يدوياً بالاسم والورد، اكتب الاسم في الملاحظات. / Hand-embroidered hoop with a name and flowers; write the name in the notes. | 120 | 🪡 | تطريز / Embroidery | ◉ المقاس / Size [single, required]: 15 سم / 15 cm +0; 20 سم / 20 cm +30 · ☐ إضافات / Extras [multi]: إطار خشبي / Wooden frame +25; تغليف هدية / Gift wrap +15 |
| b07-p2 | حقيبة كروشيه / Crochet Bag | حقيبة كتف كروشيه بخيوط قطنية. / A crochet shoulder bag in cotton yarn. | 150 | 👜 | كروشيه / Crochet | ◉ اللون / Colour [single, required]: بيج / Beige +0; وردي / Pink +0; أخضر / Green +0 |
| b07-p3 | دمية كروشيه / Crochet Plush Toy | دمية كروشيه ناعمة للأطفال. / A soft crochet toy for children. | 85 | 🐪 | كروشيه / Crochet | ◉ الشكل / Shape [single, required]: جمل / Camel +0; صقر / Falcon +10; غزال / Gazelle +5 |
| b07-p4 | مفرش طاولة سدو / Sadu Table Runner | مفرش منسوج بنقشة السدو التراثية. / A runner woven in traditional Sadu patterns. | 180 | 🧶 | سدو / Sadu | — |
| b07-p5 | ميدالية بالاسم / Name Keychain | ميدالية مطرزة بالاسم. / An embroidered name keychain. | 30 | 🔑 | هدايا / Gifts | ☐ إضافات / Extras [multi]: خرز ملون / Coloured beads +5 |
| b07-p6 | صندوق هدايا مواليد / Newborn Gift Box | بطانية كروشيه ولعبة وطارة باسم المولود. / A crochet blanket, toy and name hoop for a newborn. | 260 | 🍼 | هدايا / Gifts | ☐ إضافات / Extras [multi]: تطريز اسم المولود على البطانية / Baby's name on blanket +35 |
| b07-p7 | قواعد أكواب سدو (4) / Sadu Coasters (4) **(sold out)** | أربع قواعد منسوجة بنقشة السدو. / Four coasters woven in Sadu patterns. | 60 | ☕ | سدو / Sadu | — |

#### b08 — مطبخ هيا / Haya's Kitchen

| id | Name AR / EN | Description AR / EN | Price | Emoji | Section | Options |
|---|---|---|---|---|---|---|
| b08-p1 | برياني لحم / Lamb Biryani | رز برياني بطبقات اللحم والبهارات والبصل المقرمش. / Layered biryani rice with lamb, spices and crispy onions. | 50 | 🍛 | رئيسي / Mains | ◉ الحجم / Size [single, required]: فردي / Individual +0; عائلي / Family +75 · ☐ إضافات / Add-ons [multi]: رايتا / Raita +4; بيض مسلوق / Boiled egg +3 |
| b08-p2 | مضروبة دجاج / Chicken Madrooba | دجاج ورز مضروب بالبهارات حتى النعومة. / Chicken and rice beaten smooth with spices. | 38 | 🥣 | رئيسي / Mains | — |
| b08-p3 | مكبوس كنعد / Kingfish Machboos | كنعد طازج مع رز مكبوس بالبهارات. / Fresh kingfish with spiced machboos rice. | 55 | 🐟 | رئيسي / Mains | ◉ الحجم / Size [single, required]: فردي / Individual +0; عائلي / Family +80 |
| b08-p4 | مرقوقة / Margoogat | مرق بالخضار وعجين رقيق. / A vegetable stew with thin dough. | 42 | 🥘 | رئيسي / Mains | ◉ البروتين / Protein [single, required]: دجاج / Chicken +0; لحم / Lamb +10 |
| b08-p5 | شوربة عدس / Lentil Soup | شوربة عدس بالكمون والليمون. / Lentil soup with cumin and lemon. | 15 | 🍲 | شوربات / Soups | ☐ إضافات / Add-ons [multi]: خبز محمص / Croutons +3 |
| b08-p6 | معكرونة بالبشاميل / Béchamel Pasta Tray | صينية معكرونة باللحم المفروم والبشاميل. / A tray of pasta with minced meat and béchamel. | 60 | 🍝 | رئيسي / Mains | ◉ الحجم / Size [single, required]: صينية صغيرة / Small tray +0; صينية كبيرة / Large tray +40 |
| b08-p7 | محلبية (4 أكواب) / Muhallabia (4 cups) | محلبية بماء الورد. / Milk pudding with rose water. | 20 | 🍮 | حلا / Desserts | ☐ الزينة / Toppings [multi, max 2]: فستق / Pistachio +4; زعفران / Saffron +3 |
| b08-p8 | ساقو (4 أكواب) / Sago Pudding (4 cups) **(sold out)** | ساقو بالزعفران والهيل. / Sago with saffron and cardamom. | 18 | 🍧 | حلا / Desserts | — |

#### b09 — كيكة سلمى / Salma's Cakes

| id | Name AR / EN | Description AR / EN | Price | Emoji | Section | Options |
|---|---|---|---|---|---|---|
| b09-p1 | كيكة الحليب / Milk Cake | كيكة الحليب بثلاث أنواع حليب، باردة وطرية. / Soft, chilled three-milk cake. | 85 | 🍰 | كيك / Cakes | ◉ النكهة / Flavour [single, required]: كلاسيكي / Classic +0; كراميل / Caramel +10; زعفران / Saffron +10 |
| b09-p2 | كيكة شوكولاتة / Chocolate Fudge Cake | كيكة شوكولاتة غنية بصوص الفدج. / Rich chocolate cake with fudge sauce. | 110 | 🎂 | كيك / Cakes | ◉ الحجم / Size [single, required]: 1 كيلو / 1 kg +0; 2 كيلو / 2 kg +90 · ☐ إضافات / Extras [multi]: كتابة على الكيك / Writing on cake +10; شموع / Candles +5 |
| b09-p3 | كيكة الجزر / Carrot Cake | كيكة الجزر بالجوز وكريمة الجبن. / Carrot cake with walnuts and cream cheese frosting. | 90 | 🥕 | كيك / Cakes | — |
| b09-p4 | حلى التمر بالكراميل / Sticky Date Pudding | حلى تمر دافي مع صوص كراميل. / Warm date pudding with caramel sauce. | 40 | 🍮 | حلى بارد / Desserts | ☐ إضافات / Extras [multi]: آيس كريم فانيلا / Vanilla ice cream +8 |
| b09-p5 | براونيز (9 قطع) / Brownies (9 pcs) | براونيز شوكولاتة كثيفة. / Dense chocolate brownies. | 45 | 🍫 | معجنات حلوة / Sweet bakes | ☐ إضافات / Extras [multi]: جوز / Walnuts +5; صوص البندق / Hazelnut sauce +5 |
| b09-p6 | كوكيز (12) / Cookies (12) | كوكيز طري من الداخل ومقرمش من برا. / Soft-centred, crispy-edged cookies. | 40 | 🍪 | معجنات حلوة / Sweet bakes | ◉ النكهة / Flavour [single, required]: شوكولاتة / Chocolate chip +0; شوفان وزبيب / Oat & raisin +0; تمر وهيل / Date & cardamom +5 |
| b09-p7 | رولات القرفة (6) / Cinnamon Rolls (6) **(sold out)** | رولات قرفة بكريمة الجبن. / Cinnamon rolls with cream cheese glaze. | 38 | 🌀 | معجنات حلوة / Sweet bakes | ☐ إضافات / Extras [multi]: كريمة إضافية / Extra glaze +5 |

#### b10 — مجبوس الوالدة / Al Walda Majboos

| id | Name AR / EN | Description AR / EN | Price | Emoji | Section | Options |
|---|---|---|---|---|---|---|
| b10-p1 | مجبوس دجاج / Chicken Majboos | مجبوس دجاج بوصفة الوالدة مع الدقوس. / Mum's chicken majboos with daqoos. | 48 | 🍛 | أطباق رئيسية / Mains | ◉ الحجم / Size [single, required]: فردي / Individual +0; عائلي (4 أشخاص) / Family (serves 4) +72 · ☐ إضافات / Add-ons [multi, max 3]: دقوس / Daqoos +3; لبن / Laban +4; سلطة / Salad +8 |
| b10-p2 | مجبوس لحم / Lamb Majboos | لحم محلي طري مع رز مبهّر بالبزار. / Tender local lamb with bezar-spiced rice. | 70 | 🍖 | أطباق رئيسية / Mains | ◉ الحجم / Size [single, required]: فردي / Individual +0; عائلي (4 أشخاص) / Family (serves 4) +100 |
| b10-p3 | مندي دجاج / Chicken Mandi | دجاج مدخّن على الطريقة اليمنية مع رز مندي. / Smoky Yemeni-style chicken with mandi rice. | 50 | 🍗 | مشويات / Grills | ◉ القطعة / Portion [single, required]: ربع / Quarter +0; نص / Half +18 |
| b10-p4 | مضغوط لحم / Lamb Madghout | لحم ورز مطبوخ بالضغط مع الطماط والبهارات. / Pressure-cooked lamb and rice with tomato and spices. | 75 | 🥘 | أطباق رئيسية / Mains | — |
| b10-p5 | صالونة خضار / Vegetable Saloona | صالونة خضار موسمية بالبهارات الإماراتية. / Seasonal vegetable stew with Emirati spices. | 28 | 🥕 | أطباق رئيسية / Mains | ◉ الرز / Rice [single, required]: مع رز / With rice +0; بدون رز / Without rice +0 |
| b10-p6 | عيش أبيض ودقوس / White Rice & Daqoos | رز أبيض مع صوص الدقوس الحار. / White rice with spicy daqoos sauce. | 15 | 🍚 | جانبي / Sides | — |
| b10-p7 | سلطة جرجير / Rocket Salad | جرجير وطماط وبصل بالليمون. / Rocket, tomato and onion with lemon. | 18 | 🥗 | جانبي / Sides | — |
| b10-p8 | ليمون بالنعناع (لتر) / Lemon Mint (1 L) **(sold out)** | عصير ليمون ونعناع طازج. / Fresh lemon and mint juice. | 18 | 🍋 | مشروبات / Drinks | ◉ السكر / Sugar [single, required]: عادي / Regular +0; خفيف / Light +0 |

#### b11 — دخون الدار / Dukhoon Al Dar

| id | Name AR / EN | Description AR / EN | Price | Emoji | Section | Options |
|---|---|---|---|---|---|---|
| b11-p1 | دخون الدار الخاص / House Dukhoon | خلطة دخون الدار بالعود والزعفران والمسك. / Our house dukhoon with oud, saffron and musk. | 120 | 🪔 | دخون / Dukhoon | ◉ الوزن / Weight [single, required]: 50 غ / 50 g +0; 100 غ / 100 g +100 |
| b11-p2 | دخون ملكي / Royal Dukhoon | دخون فاخر للمناسبات بدهن العود. / Luxurious occasion dukhoon with oud oil. | 160 | 👑 | دخون / Dukhoon | ◉ الوزن / Weight [single, required]: 50 غ / 50 g +0; 100 غ / 100 g +140 |
| b11-p3 | مخمرية / Mukhamaria | عطر كريمي تقليدي بالزعفران والورد. / A traditional creamy perfume with saffron and rose. | 90 | 🫙 | عطور / Perfumes | ◉ الحجم / Size [single, required]: 25 غ / 25 g +0; 50 غ / 50 g +75 |
| b11-p4 | عطر عود وورد (50 مل) / Oud & Rose Perfume (50 ml) | عطر يجمع العود الكمبودي والورد الطائفي. / Cambodian oud meets Taifi rose. | 220 | 🌹 | عطور / Perfumes | ☐ إضافات / Extras [multi]: تغليف هدية / Gift wrap +15 |
| b11-p5 | بخور السيارة (3 أكياس) / Car Bakhoor Sachets (3) | أكياس معطرة للسيارة بريحة الدخون. / Scented sachets for the car with a dukhoon aroma. | 30 | 🚗 | إكسسوارات / Accessories | — |
| b11-p6 | مبخرة كهربائية / Electric Burner | مبخرة كهربائية قابلة للشحن. / A rechargeable electric burner. | 150 | 🔌 | إكسسوارات / Accessories | ◉ اللون / Colour [single, required]: أسود / Black +0; ذهبي / Gold +20; أبيض / White +0 |
| b11-p7 | طقم العروس / Bridal Scent Set | دخون ومخمرية ودهن عود ومبخرة في صندوق فاخر. / Dukhoon, mukhamaria, oud oil and a burner in a luxury box. | 650 | 💍 | هدايا / Gifts | ☐ إضافات / Extras [multi]: نقش الأسماء على الصندوق / Names engraved on box +50 |
| b11-p8 | دهن مسك الغزال / Gazelle-style Musk Oil **(sold out)** | دهن مسك نباتي بريحة دافئة. / A warm, plant-based musk oil. | 110 | 🤎 | عطور / Perfumes | — |

#### b12 — عبايات مُزن / Muzn Abayas

Size option = `◉ المقاس / Size [single, required]: 50 +0; 52 +0; 54 +0; 56 +0; 58 +25`.

| id | Name AR / EN | Description AR / EN | Price | Emoji | Section | Options |
|---|---|---|---|---|---|---|
| b12-p1 | عباية كريب ملكي / Royal Crepe Abaya | عباية كريب ثقيل بقصّة مستقيمة. / A heavy crepe abaya with a straight cut. | 390 | 🧕 | يومية / Everyday | Size · ☐ تعديلات / Alterations [multi]: تقصير / Hemming +20 |
| b12-p2 | عباية فراشة / Butterfly Abaya | عباية واسعة بأكمام فراشة. / A loose abaya with butterfly sleeves. | 360 | 🦋 | يومية / Everyday | Size · ◉ اللون / Colour [single, required]: أسود / Black +0; كحلي / Navy +0 |
| b12-p3 | عباية مطرزة بالزري / Zari-embroidered Abaya | تطريز زري ذهبي يدوي على الأطراف. / Hand-stitched gold zari embroidery along the edges. | 750 | 🌟 | مناسبات / Occasions | Size · ☐ إضافات / Extras [multi]: شيلة مطابقة / Matching shayla +70 |
| b12-p4 | عباية حرير بالكريستال / Silk Crystal Abaya | حرير ناعم بلمسات كريستال. / Soft silk with crystal accents. | 890 | 💎 | مناسبات / Occasions | Size |
| b12-p5 | عباية أطفال / Girls' Abaya | عباية للبنات من 4 إلى 12 سنة. / An abaya for girls aged 4 to 12. | 180 | 👧 | أطفال / Kids | ◉ العمر / Age [single, required]: 4–6 سنوات / 4–6 years +0; 7–9 سنوات / 7–9 years +20; 10–12 سنة / 10–12 years +40 |
| b12-p6 | شيلة مطرزة / Embroidered Shayla **(sold out)** | شيلة شيفون بتطريز على الطرف. / Chiffon shayla with an embroidered edge. | 85 | 🧣 | شيلات / Shaylas | — |

#### b13 — طين ونور / Teen & Noor (pickup only)

| id | Name AR / EN | Description AR / EN | Price | Emoji | Section | Options |
|---|---|---|---|---|---|---|
| b13-p1 | شمعة العود / Oud Candle | شمعة صويا معطّرة بالعود في وعاء فخار. / A soy candle scented with oud in a clay pot. | 75 | 🕯️ | شموع / Candles | ◉ الحجم / Size [single, required]: صغيرة / Small +0; كبيرة / Large +45 |
| b13-p2 | مبخرة فخار مرسومة / Painted Clay Burner | مبخرة فخار مرسومة باليد بنقوش تراثية. / A hand-painted clay burner with heritage motifs. | 70 | 🏺 | فخار / Pottery | — |
| b13-p3 | صحن فخار مرسوم / Painted Clay Plate | صحن تقديم مرسوم يدوياً، للزينة. / A hand-painted decorative serving plate. | 95 | 🍽️ | فخار / Pottery | ◉ النقشة / Pattern [single, required]: نخيل / Palms +0; سدو / Sadu +0; ورد / Flowers +0 |
| b13-p4 | فانوس فخار / Clay Lantern | فانوس فخار مخرّم يعكس الضوء. / A pierced clay lantern that scatters light. | 120 | 🏮 | ديكور / Decor | — |
| b13-p5 | طقم شموع رمضان / Ramadan Candle Set | ثلاث شموع بنقوش الهلال والفانوس. / Three candles with crescent and lantern motifs. | 140 | 🌙 | شموع / Candles | ☐ إضافات / Extras [multi]: تغليف هدية / Gift wrap +15 |
| b13-p6 | عدّة رسم فخار / Pottery Painting Kit | قطعتين فخار وألوان وفرش للأطفال والكبار. / Two clay pieces with paints and brushes for kids and adults. | 85 | 🎨 | ورش / Kits | ◉ عدد القطع / Pieces [single, required]: قطعتين / 2 pieces +0; أربع قطع / 4 pieces +60 |
| b13-p7 | شمعة الورد / Rose Candle **(sold out)** | شمعة معطرة بالورد الطائفي. / A candle scented with Taifi rose. | 70 | 🌷 | شموع / Candles | — |

#### b14 — حلويات الفريج / Fareej Sweets

| id | Name AR / EN | Description AR / EN | Price | Emoji | Section | Options |
|---|---|---|---|---|---|---|
| b14-p1 | لقيمات (20 حبة) / Luqaimat (20 pcs) | لقيمات مقرمشة من برا وطرية من داخل. / Crispy outside, soft inside. | 18 | 🍯 | حلويات الفريج / Classics | ◉ الصوص / Syrup [single, required]: دبس تمر / Date syrup +0; عسل / Honey +5; شوكولاتة / Chocolate +5 · ☐ إضافات / Extras [multi]: سمسم / Sesame +0 |
| b14-p2 | خنفروش (10 حبات) / Khanfaroosh (10 pcs) | كعك إماراتي بالزعفران وماء الورد. / Emirati saffron and rose-water fritters. | 22 | 🍩 | حلويات الفريج / Classics | — |
| b14-p3 | بثيثة / Bitheetha | تمر وطحين محمّص بالسمن والهيل. / Dates and toasted flour with ghee and cardamom. | 30 | 🥮 | حلويات الفريج / Classics | ◉ الحجم / Size [single, required]: علبة صغيرة / Small box +0; علبة كبيرة / Large box +25 |
| b14-p4 | كيكة عقيلي / Eqaili Cake | كيكة عقيلي بالزعفران والهيل والسمسم. / Eqaili cake with saffron, cardamom and sesame. | 45 | 🍰 | كيك / Cakes | — |
| b14-p5 | حلوى بالزعفران (علبة) / Saffron Halwa (box) | حلوى عربية لزجة بالزعفران والمكسرات. / Sticky Arabic halwa with saffron and nuts. | 55 | 🍬 | علب / Boxes | ◉ المكسرات / Nuts [single, required]: لوز / Almonds +0; كاجو / Cashews +5; فستق / Pistachios +12 |
| b14-p6 | تمر محشي (500 غ) / Stuffed Dates (500 g) | تمر خلاص محشي بالمكسرات. / Khalas dates stuffed with nuts. | 65 | 🌴 | علب / Boxes | ☐ الحشوات / Fillings [multi, max 2]: لوز / Almond +0; جوز / Walnut +0; طحينية / Tahini +0 |
| b14-p7 | ساقو بالزعفران / Saffron Sago | ساقو بارد بالزعفران والهيل. / Chilled sago with saffron and cardamom. | 16 | 🍧 | حلويات الفريج / Classics | — |
| b14-p8 | عصيدة بالتمر / Date Aseeda **(sold out)** | عصيدة بالتمر والسمن. / Aseeda with dates and ghee. | 25 | 🍮 | حلويات الفريج / Classics | — |

**Totals:** 103 products (b01 8, b02 7, b03 7, b04 7, b05 8, b06 7, b07 7, b08 8, b09 7, b10 8, b11 8, b12 6, b13 7, b14 8).

### 8.4 Reviews

`authorAr / authorEn` are the same person's name written in each script. `lang` is the language the review was written in; both texts are supplied for the Translate toggle. `daysAgo` sets the date relative to the first app run.

| Business | Author AR / EN | Stars | lang | Text AR | Text EN | daysAgo |
|---|---|---|---|---|---|---|
| b01 | فاطمة / Fatima | 5 | ar | المجبوس يذكرني بأكل أمي، الكمية كبيرة والدقوس خطير. | The majboos reminds me of my mum's cooking. Generous portion and amazing daqoos. | 2 |
| b01 | James / جيمس | 5 | en | ممتاز. الهريس كان ناعم جداً وانطبخ بحب. سأطلب مرة ثانية أكيد. | Fantastic. The harees was so smooth and clearly made with love. Ordering again for sure. | 6 |
| b01 | سعيد / Saeed | 4 | ar | الأكل لذيذ بس التوصيل تأخر ربع ساعة. | Delicious food, but delivery was 15 minutes late. | 13 |
| b02 | نورة / Noura | 5 | ar | كيكة الزعفران كانت نجمة العزيمة، الكل سأل عنها. | The saffron cake was the star of the party; everyone asked about it. | 1 |
| b02 | Priya / بريا | 5 | en | الكنافة كانت حارة ولذيذة والكب كيك بالاسم كان لطيف جداً. | Kunafa arrived warm and delicious, and the name cupcakes were adorable. | 9 |
| b02 | منى / Mona | 4 | ar | طعم رائع لكن الكريمة كانت حالية شوي بالنسبة لي. | Great taste, though the cream was a bit sweet for me. | 20 |
| b03 | خالد / Khalid | 5 | ar | دهن العود ثابت وريحته فخمة، تعامل راقي. | The oud oil lasts all day and smells luxurious. Very professional. | 3 |
| b03 | Omar / عمر | 4 | en | بخور جميل، والمبخرة أصغر شوي مما توقعت. | Lovely bakhoor; the burner was a little smaller than I expected. | 11 |
| b04 | شيخة / Shaikha | 5 | ar | القصّة مريحة والقماش ما يحر، والتطريز بالاسم ناعم. | Comfortable cut, breathable fabric and delicate name embroidery. | 4 |
| b04 | Sara / سارة | 4 | en | العباية حلوة جداً، التفصيل أخذ وقت أطول من المتوقع. | Beautiful abaya; tailoring took a little longer than expected. | 17 |
| b05 | راشد / Rashid | 5 | ar | أحلى فطور يوم الجمعة، الخمير طازج والكرك يعدّل المزاج. | Best Friday breakfast. Fresh khameer and karak that makes your day. | 2 |
| b05 | Anna / آنا | 5 | en | أول مرة أجرّب البلاليط، طلع حلو ومالح بشكل رهيب! | My first time trying balaleet. Sweet and savoury and brilliant! | 8 |
| b06 | عائشة / Aisha | 5 | ar | بخور الورد ريحته تفوح بالبيت كله، والسعر ممتاز. | The rose bakhoor fills the whole house and the price is great. | 5 |
| b06 | Lina / لينا | 4 | en | معطر المفارش جميل، أتمنى يكون فيه حجم أكبر. | Lovely linen spray; I wish it came in a bigger size. | 15 |
| b07 | مريم / Maryam | 5 | ar | طارة اسم بنتي طلعت تحفة، شغل يدوي متقن. | My daughter's name hoop is a masterpiece. Beautiful handwork. | 6 |
| b07 | Hannah / هانا | 5 | en | دمية الجمل صارت اللعبة المفضلة عند ولدي. | The crochet camel is now my son's favourite toy. | 12 |
| b08 | ماجد / Majid | 5 | ar | البرياني فيه بهارات مضبوطة واللحم ذايب. | Perfectly spiced biryani and the lamb melts in your mouth. | 3 |
| b08 | Ravi / رافي | 4 | en | المضروبة لذيذة ومشبعة، الكمية تكفي شخصين تقريباً. | Tasty, filling madrooba; enough for almost two people. | 10 |
| b09 | هند / Hind | 5 | ar | كيكة الحليب بالزعفران ولا أروع، طرية وباردة. | The saffron milk cake is wonderful, soft and chilled. | 2 |
| b09 | Chloe / كلوي | 4 | en | البراونيز لذيذ جداً، والكوكيز بالتمر مفاجأة حلوة. | The brownies are delicious and the date cookies are a lovely surprise. | 14 |
| b10 | حمد / Hamad | 5 | ar | مجبوس اللحم على أصوله، ذكرني بغداء الجمعة عند جدتي. | Proper lamb majboos, like Friday lunch at grandma's. | 1 |
| b10 | Michael / مايكل | 5 | en | المندي مدخّن بشكل رائع والتغليف ممتاز. | Wonderfully smoky mandi, and the packaging was excellent. | 7 |
| b10 | علياء / Alia | 4 | ar | الأكل ممتاز، بس ودي يكون فيه خيار رز بني. | Excellent food; I'd love a brown rice option. | 19 |
| b11 | موزة / Moza | 5 | ar | طقم العروس كان أحلى هدية لأختي، الدخون فخم. | The bridal set was the best gift for my sister; the dukhoon is luxurious. | 4 |
| b11 | Fatima Z. / فاطمة ز. | 5 | en | المخمرية ريحتها تجنن وتثبت على الملابس أيام. | The mukhamaria smells amazing and stays on clothes for days. | 9 |
| b12 | مزنة / Muzna | 5 | ar | عباية الزري لبستها في عرس وكل الحضور سألوا عنها. | I wore the zari abaya to a wedding and everyone asked about it. | 5 |
| b12 | Leila / ليلى | 4 | en | جودة الحرير ممتازة، المقاس يحتاج تعديل بسيط. | Excellent silk quality; the size needed a small alteration. | 16 |
| b13 | نورة / Noura | 5 | ar | الفانوس الفخار يعطي إضاءة دافئة بالمجلس، شغل جميل. | The clay lantern gives a warm glow in the majlis. Beautiful work. | 6 |
| b13 | Tom / توم | 4 | en | عدّة الرسم كانت نشاط ممتع للعائلة يوم الجمعة. | The painting kit was a fun Friday family activity. | 21 |
| b14 | علي / Ali | 5 | ar | اللقيمات مقرمشة والدبس أصلي، طعم الفريج صدق. | Crispy luqaimat with real date syrup. True neighbourhood taste. | 1 |
| b14 | Sophie / صوفي | 5 | en | الخنفروش خفيف وريحته زعفران، أحسن من أي مخبز. | Light khanfaroosh with a lovely saffron aroma, better than any bakery. | 8 |

Note on the bilingual pairs: for rows with `lang: en`, the English text is the original and the Arabic is the translation; for `lang: ar`, the reverse. Display the original by default; the Translate link swaps.

**Star distribution** (percent of `reviewCount`, for the Reviews summary bars; the listed reviews are a sample of that count):

| Rating | 5★ | 4★ | 3★ | 2★ | 1★ |
|---|---|---|---|---|---|
| 4.9 | 90 | 7 | 2 | 1 | 0 |
| 4.8 | 82 | 13 | 3 | 1 | 1 |
| 4.7 | 75 | 18 | 4 | 2 | 1 |
| 4.6 | 70 | 20 | 6 | 2 | 2 |

When a user posts a review, add it to the list, increment `reviewCount`, and recompute the displayed rating as `(rating × count + stars) / (count + 1)` rounded to 1 decimal (store the result in `hawwi.businessOverrides[bid].rating` / `reviewCount`).

### 8.5 Seed orders (generated on first run)

Generated deterministically for each business `b` (index `i` 0–13) so owner dashboards and charts have data. Six orders per business, order numbers `1001 + i*6 + k` for `k = 0…5`; `hawwi.orderSeq` starts at 1084 (next new order = 1085).

| k | createdAt | Status | Lines (by visible, available product order) | Fulfilment | Payment |
|---|---|---|---|---|---|
| 0 | today, now − 20 min | `received` (`simulate:false`) | product[0] ×1 with default options | delivery if supported else pickup | card ••4242 |
| 1 | today, 3 hours ago (or 09:00 if earlier than opening) | `completed` | product[1] ×2 | pickup | cash |
| 2 | yesterday 13:00 | `completed` | product[0] ×1, product[2] ×1 | delivery/pickup | applepay |
| 3 | 2 days ago 19:00 | `completed` | product[3] ×2 | pickup | card ••1881 |
| 4 | 4 days ago 12:30 | `completed` | product[0] ×3 | delivery/pickup | cash |
| 5 | 6 days ago 18:15 | `rejected` (reason "مشغولين حالياً / Too busy") | product[1] ×1 | pickup | card ••4242 |

Customer names for seed orders cycle through: عبدالله / Abdulla, حصة / Hessa, Daniel / دانيال, مها / Maha, Arjun / أرجون, شما / Shamma, with phones `+97150000{1000+n}`. Seed orders are **not** shown in the logged-in user's order history (history filters by `order.customer.phone === user.phone`). Totals use current prices, delivery fee where applicable, no promo.

---
## 9. Persistence

### 9.1 Storage wrapper

All persistence goes through one module. Every read and write is wrapped in `try/catch`; if `localStorage` is unavailable (private mode, blocked, quota) the module silently switches to an in-memory `Map` for the rest of the session.

```js
const store = (() => {
  const mem = new Map();
  let useMem = false;
  try { const k = '__hawwi_test__'; localStorage.setItem(k, '1'); localStorage.removeItem(k); }
  catch (e) { useMem = true; }
  return {
    get(key, fallback) {
      try {
        const raw = useMem ? mem.get(key) : localStorage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { console.warn('hawwi: bad value for', key, e); notifyStorageErrorOnce(); return fallback; }
    },
    set(key, value) {
      const raw = JSON.stringify(value);
      try { if (useMem) mem.set(key, raw); else localStorage.setItem(key, raw); }
      catch (e) { useMem = true; mem.set(key, raw); }
    },
    remove(key) {
      try { if (useMem) mem.delete(key); else localStorage.removeItem(key); } catch (e) { mem.delete(key); }
    },
    isMemory: () => useMem,
  };
})();
```

- All keys are prefixed `hawwi.`. Every stored object includes nothing derived that can be recomputed (e.g. open/closed state is always computed).
- A schema version key `hawwi.version = 1`. If a different version is found on boot, clear all `hawwi.*` keys except `hawwi.lang` and `hawwi.onboardingSeen`, then seed again.
- Listen to `window.addEventListener('storage', e => { if (e.key?.startsWith('hawwi.')) rerender(); })` for cross-tab sync.

### 9.2 Keys and shapes

| Key | Shape | Default |
|---|---|---|
| `hawwi.version` | `1` | `1` |
| `hawwi.lang` | `"ar" \| "en"` | `"ar"` |
| `hawwi.onboardingSeen` | `boolean` | `false` |
| `hawwi.user` | `User \| null` | `null` |
| `hawwi.prefs` | `Prefs` | see below |
| `hawwi.cart` | `Cart` | empty cart |
| `hawwi.orders` | `Order[]` | seed orders (8.5) |
| `hawwi.orderSeq` | `number` | `1084` |
| `hawwi.favorites` | `{ businesses: string[], products: string[] }` | `{businesses:[],products:[]}` |
| `hawwi.productOverrides` | `{ [productId]: ProductOverride }` | `{}` |
| `hawwi.customProducts` | `Product[]` (owner-created, includes `businessId`) | `[]` |
| `hawwi.businessOverrides` | `{ [businessId]: BusinessOverride }` | `{}` |
| `hawwi.reviews` | `Review[]` (user-written only) | `[]` |
| `hawwi.seededAt` | ISO string (anchor for review `daysAgo` and seed orders) | set on first run |

Shapes (TypeScript-style for clarity):

```ts
type User = {
  phone: string;            // "+971501234567"
  name: string;
  email?: string;
  emirate: EmirateId;       // "dubai" | "sharjah" | "ajman" | "abudhabi" | "rak" | "fujairah"
  addresses: Address[];
  createdAt: string;        // ISO
};

type Address = {
  id: string; label: "home" | "work" | "other";
  emirate: EmirateId; area: string; street: string; unit: string; notes?: string;
};

type Prefs = {
  emirate: EmirateId | "all";   // default "all" (or user's emirate after sign-up)
  area: string | null;          // default null
  notifications: boolean;       // default true
  autoAdvance: boolean;         // default true
  theme: "light" | "dark" | "auto"; // default "light"
  ownerMode: boolean;           // default false
  ownerBusinessId: string | null;
};

type Cart = {
  businessId: string | null;
  lines: CartLine[];
  fulfilment: "pickup" | "delivery";
  slot: { type: "asap" } | { type: "scheduled", day: "today" | "tomorrow", start: string /* "16:30" */, date: string /* YYYY-MM-DD */ };
  promo: string | null;        // "HAWWI10"
  updatedAt: string;
};

type CartLine = {
  lineId: string;
  productId: string;
  qty: number;                 // 1–20
  options: { [groupId: string]: string };     // single-choice: groupId → choiceId
  addons:  { [groupId: string]: string[] };   // multi-choice: groupId → choiceIds
  notes: string;
  unitPrice: number;           // recomputed on render from current data; stored for reference
};

type OrderStatus = "received" | "preparing" | "ready" | "completed" | "rejected" | "cancelled";

type Order = {
  id: string;                  // "HW-1085"
  businessId: string;
  customer: { name: string; phone: string };
  lines: Array<{ productId: string; nameAr: string; nameEn: string; emoji: string; qty: number;
                 optionLabels: { ar: string[]; en: string[] }; notes: string; unitPrice: number; lineTotal: number }>;
  fulfilment: "pickup" | "delivery";
  address: Address | null;
  slot: Cart["slot"];
  etaAt: string;               // ISO: ASAP → now + prep (+15 delivery); scheduled → slot start
  payment: { method: "card" | "applepay" | "cash"; brand?: "visa" | "mastercard" | "card"; last4?: string };
  subtotal: number; deliveryFee: number; discount: number; total: number; promo: string | null;
  status: OrderStatus;
  history: Array<{ status: OrderStatus; at: string }>;
  simulate: boolean;           // auto-advance timers active
  nextAt: number | null;       // epoch ms of next simulated transition
  rejectReason?: string;
  reviewed?: boolean;
  seed?: boolean;
  createdAt: string;
};

type ProductOverride = Partial<{
  nameAr: string; nameEn: string; descAr: string; descEn: string;
  price: number; emoji: string; section: { ar: string; en: string };
  groups: OptionGroup[]; hidden: boolean; available: boolean; deleted: boolean;
}>;

type OptionGroup = {
  id: string; nameAr: string; nameEn: string;
  type: "single" | "multi"; required: boolean; max?: number;
  choices: Array<{ id: string; nameAr: string; nameEn: string; delta: number }>;
};

type BusinessOverride = Partial<{
  nameAr: string; nameEn: string; bioAr: string; bioEn: string; logo: string; colors: string;
  emirate: EmirateId; areaAr: string; areaEn: string;
  pickup: boolean; delivery: boolean; deliveryFee: number; minOrder: number; prep: number;
  hours: Array<[string, string] | null>; acceptingOrders: boolean;
  rating: number; reviewCount: number;
}>;

type Review = {
  id: string; businessId: string; orderId?: string;
  authorAr: string; authorEn: string; stars: 1|2|3|4|5;
  lang: "ar" | "en"; textAr: string; textEn: string;   // user reviews: both fields hold the same text
  createdAt: string;
};
```

Merge rules: `getBusiness(id) = {...seed, ...businessOverrides[id]}`; `getProducts(bid) = [...seedProducts(bid), ...customProducts(bid)].map(p => ({...p, ...productOverrides[p.id]})).filter(p => !p.deleted)`; customer views also filter `!hidden`.

Lifecycle:

- Cart is saved on every change. Prices in cart lines are recomputed from current product data on each render; if a product disappears, the line is removed with a toast.
- When an order is placed: `orderSeq += 1`, push order, clear cart (keep fulfilment preference), save.
- Simulation: on creation `simulate = prefs.autoAdvance`, `nextAt = now + 8000`. On each transition, `nextAt = now + duration(nextStatus)` (see 3.13), or `null` for terminal states. On boot, orders whose `nextAt` is in the past are advanced one step per tick (so a reload mid-flow continues naturally).
- Log out: remove `hawwi.user`, set `prefs.ownerMode=false`. Orders, cart and favourites stay.
- Reset demo data: see 3.17.

---

## 10. Accessibility

- **Language and direction:** `<html lang="ar" dir="rtl">` by default. Switching language sets `document.documentElement.lang` and `.dir`, updates `<title>` ("حووي" / "Hawwi"), re-renders all strings, and preserves the current route and scroll position. Mixed-language content (an English review in Arabic UI, an Arabic business name in English UI) is wrapped in an element with its own `lang` and `dir="auto"`. Numbers and prices are wrapped in `<bdi>`.
- **Semantics:** one `<main>` per screen with an `<h1>` (visually the screen title; on Home the greeting is the h1). Use real `<button>` and `<a href="#/…">` elements, `<nav>` for tab bars, `<form>` with `<label for>` for every input. Lists of cards use `<ul>`/`<li>`.
- **Focus:** visible focus ring on all interactive elements via `:focus-visible` using `--focus-ring` (white inner ring + 2px green outer ring, so it is visible on both light surfaces and coloured covers). On route change, move focus to the screen's `<h1>` (`tabindex="-1"`) and announce the title through a polite live region. Sheets and modals trap focus and restore it on close. Escape closes overlays.
- **Tap targets:** every interactive element is at least 44×44px (use padding or a pseudo-element to extend small visual controls such as the quick-add "+", heart, stepper buttons, chip close icons and rating stars). Minimum 8px spacing between adjacent targets.
- **ARIA labels:** icon-only buttons have `aria-label` in the current language (e.g. back "رجوع / Back", favourite "أضف {name} للمفضلة / Add {name} to favourites" with `aria-pressed`, share, close, delete). Cart tab label includes count: "السلة، 2 منتج / Cart, 2 items". Badges are `aria-hidden` when the count is already in the label. Status changes on the tracking screen are announced through `aria-live="polite"`. Toasts use `role="status"` (errors `role="alert"`). Carousels have `aria-roledescription="carousel"`, slides `aria-label="{n} من {total}"`. Skeleton containers set `aria-busy="true"`. Decorative emoji in tiles are `aria-hidden="true"` and the tile has a text alternative from the product name.
- **Forms:** errors linked by `aria-describedby`, fields get `aria-invalid`, the first invalid field receives focus on submit, and required fields carry `aria-required="true"`. OTP boxes each have `aria-label="الرقم {n} من 4 / Digit {n} of 4"`.
- **Contrast** (WCAG 2.1 AA): body text `--c-ink` #1D2321 on `--c-sand-50` #FBF8F3 ≈ 15:1; `--c-ink-2` #4F5A56 on white ≈ 7:1; white on `--c-primary` #0F5B4D ≈ 8:1; `--c-accent-700` #9A6A0B on white ≈ 4.9:1 (use it, not `--c-accent`, for accent text); `--c-ink` on `--c-accent` #E0A526 ≈ 9:1 (cart badge). `--c-ink-3` #7D8783 on white ≈ 3.8:1, so use it only for text 18px+ or non-essential placeholders. White text on cover gradients always sits on a dark scrim (`linear-gradient(to top, rgba(0,0,0,.55), transparent)`). Status badges use the strong colour on the soft background (all ≥ 4.5:1).
- **Motion:** honour `prefers-reduced-motion` (5.7). No auto-playing loops longer than 5s without a pause control: the featured carousel pauses on focus/hover and has a pause button for screen-reader users (visually hidden until focused).
- **Zoom and text size:** layout uses `rem` for type; supports 200% browser zoom without horizontal scroll inside the frame; do not disable pinch zoom (`<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`).
- **Keyboard:** everything works with Tab/Shift+Tab/Enter/Space/Escape; tabs and radio groups support arrow keys with the RTL rule in 6.9; horizontal chip rows are reachable by Tab (each chip is focusable).

---

## 11. Build notes and acceptance checklist

### 11.1 Suggested code structure (single file is fine)

1. `I18N` (string table from section 7) and `t(key, vars)`.
2. `SEED` (businesses, products, reviews from section 8).
3. `store` (9.1) and data accessors with merge rules.
4. Utilities: price/time formatting, hours/open-state, slot generation, Arabic normalisation for search, Luhn.
5. Components as functions returning HTML strings or DOM nodes (cards, rows, sheet, modal, toast, stepper, tabs, badges, stars, skeleton, empty state, tab bars).
6. Screens keyed by route pattern; router with guards (2.1).
7. Order simulation ticker (3.13) and `storage` listener.

### 11.2 Key algorithms

- **isOpen(business, date):** take today's entry `hours[satIndex(date)]`; if null, check yesterday's entry for an after-midnight closing (`close < open` and current time < close). Open if `open ≤ now < close` (with the midnight wrap). "Closing soon" when `close − now ≤ 30 min`. "Opens next" = the first non-null day entry after now (search up to 7 days).
- **Slots(business, day):** see 3.10; slots exist only when `acceptingOrders !== false`.
- **Promo validation:** see 3.10 table; recheck on every cart change.
- **Search normalise:** lowercase; remove tashkeel and tatweel (`ـ`); map أإآ→ا, ة→ه, ى→ي, ؤ→و, ئ→ي; convert Arabic-Indic digits to Latin.

### 11.3 Acceptance checklist

- [ ] App loads in Arabic RTL, shows splash then onboarding on first run; skip and dots work; onboarding never shows again after completion.
- [ ] English toggle flips everything to LTR with no layout breakage (check back arrows, steppers, chart, switches, tab bar order).
- [ ] 390px phone frame centred on desktop; full-screen on phones.
- [ ] Phone login validates UAE numbers; OTP accepts any 4 digits except 0000; new users get the name step; returning phone logs straight in.
- [ ] Home greeting by time; emirate picker filters lists; chips, carousel (with dots and auto-advance) and nearby list work; the "no businesses" empty state renders when the filtered list is empty (test by hiding data or via a dev override).
- [ ] Search matches Arabic with or without hamza/taa marbuta differences, and English.
- [ ] Business page shows correct open/closed badge from hours (including b03 after midnight), tabs, reviews with translate, favourites.
- [ ] Product options/add-ons update price live; max add-ons enforced; sold-out products cannot be added.
- [ ] Adding from a second business shows the new-cart modal.
- [ ] Cart: pickup/delivery fee, ASAP availability, today/tomorrow 30-minute slots within hours, HAWWI10 / WELCOME15 / FREEDEL rules, minimum delivery order.
- [ ] Checkout: address validation, card validation with Luhn (4242… works, 4000 0000 0000 0002 declines), Apple Pay sheet animation, cash limit; order placed and cart cleared.
- [ ] Tracking auto-advances in ~8s/20s/15s (12s pickup) with animated progress; cancel works while received; toasts on status change when elsewhere.
- [ ] Orders tabs, reorder (with unavailable-item handling), favourites, profile, settings (language, notifications, auto-advance, theme, reset with confirm, log out).
- [ ] Owner mode: pick a business; dashboard stats, CSS bar chart and best sellers reflect seed + new orders; incoming order from the customer flow appears in the owner queue; accept/reject/ready/complete update the customer tracking screen within 1 second (and across tabs).
- [ ] Owner products: add, edit (including option groups), hide/show, sold out toggle, delete with confirm; changes visible on the customer business page immediately.
- [ ] Owner profile: edit details and weekly hours (after-midnight hint, copy Saturday); badges and slots update.
- [ ] Works with `localStorage` blocked (in-memory fallback, no crashes).
- [ ] All tap targets ≥ 44px, focus visible, labels on icon buttons, contrast as specified, reduced motion respected.
