export const TRADE_CATEGORY_GROUPS = [
  {
    label: "INTERIOR",
    options: [
      "Plumbing",
      "Electrical",
      "HVAC / HVAC Repair",
      "Drywall",
      "Painting",
      "Flooring",
      "Carpentry",
      "House Cleaning",
      "Masonry"
    ]
  },
  {
    label: "EXTERIOR",
    options: [
      "Roofing",
      "Siding",
      "Gutters",
      "Concrete",
      "Decks",
      "Fencing",
      "Landscaping",
      "Masonry"
    ]
  },
  {
    label: "SPECIALTY",
    options: [
      "Appliance Repair",
      "Garage Doors",
      "Pressure Washing",
      "Junk Removal",
      "Handyman",
      "Mechanic",
      "General Contractor Builder"
    ]
  }
]

const LEGACY_TRADE_ALIASES = {
  plumbers: "Plumbing",
  plumber: "Plumbing",
  electricians: "Electrical",
  electrician: "Electrical",
  roofers: "Roofing",
  roofer: "Roofing",
  carpenters: "Carpentry",
  carpenter: "Carpentry",
  painters: "Painting",
  painter: "Painting",
  remodelers: "General Contractor Builder",
  remodeler: "General Contractor Builder",
  excavation: "General Contractor Builder",
  hvac: "HVAC / HVAC Repair",
  "hvac repair": "HVAC / HVAC Repair",
  landscaping: "Landscaping",
  handyman: "Handyman",
  concrete: "Concrete",
  masonry: "Masonry",
  siding: "Siding",
  gutters: "Gutters",
  decks: "Decks",
  fencing: "Fencing",
  flooring: "Flooring",
  drywall: "Drywall",
  "house cleaning": "House Cleaning",
  cleaning: "House Cleaning",
  "appliance repair": "Appliance Repair",
  "garage doors": "Garage Doors",
  "pressure washing": "Pressure Washing",
  "junk removal": "Junk Removal",
  mechanic: "Mechanic",
  mechanics: "Mechanic",
  "general contractor": "General Contractor Builder",
  "general contractor builder": "General Contractor Builder"
}

const TRADE_KEYWORDS = {
  "Plumbing": ["plumbing", "plumber", "pipe", "drain"],
  "Electrical": ["electrical", "electrician", "wiring", "panel"],
  "HVAC / HVAC Repair": ["hvac", "heating", "cooling", "air conditioning", "furnace"],
  "Drywall": ["drywall", "sheetrock"],
  "Painting": ["painting", "painter", "interior paint", "exterior paint"],
  "Flooring": ["flooring", "tile", "hardwood", "laminate"],
  "Carpentry": ["carpentry", "carpenter", "framing", "woodwork"],
  "House Cleaning": ["house cleaning", "cleaning", "maid", "deep clean"],
  "Masonry": ["masonry", "brick", "block", "stone"],
  "Roofing": ["roofing", "roofer", "shingle", "roof"],
  "Siding": ["siding", "vinyl siding", "fiber cement"],
  "Gutters": ["gutters", "gutter", "downspout"],
  "Concrete": ["concrete", "foundation", "slab", "driveway"],
  "Decks": ["deck", "decks", "patio deck"],
  "Fencing": ["fence", "fencing", "gate"],
  "Landscaping": ["landscaping", "yard", "lawn", "hardscape"],
  "Appliance Repair": ["appliance", "appliance repair"],
  "Garage Doors": ["garage door", "garage doors", "opener"],
  "Pressure Washing": ["pressure washing", "power washing"],
  "Junk Removal": ["junk", "debris haul", "junk removal"],
  "Handyman": ["handyman", "repairs", "maintenance"],
  "Mechanic": ["mechanic", "auto repair", "vehicle repair", "engine"],
  "General Contractor Builder": ["general contractor", "builder", "remodel", "renovation"]
}

const toSlug = (value) => String(value || "")
  .trim()
  .toLowerCase()
  .replace(/\s*\/\s*/g, "-")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")

export const ALL_TRADE_CATEGORIES = Array.from(
  new Set(TRADE_CATEGORY_GROUPS.flatMap((group) => group.options))
)

const tradeBySlug = new Map(ALL_TRADE_CATEGORIES.map((category) => [toSlug(category), category]))
const tradeByLowerLabel = new Map(ALL_TRADE_CATEGORIES.map((category) => [category.toLowerCase(), category]))

export const normalizeTradeCategory = (value) => {
  const raw = String(value || "").trim()
  if (!raw) return ""

  const lower = raw.toLowerCase()
  if (tradeByLowerLabel.has(lower)) return tradeByLowerLabel.get(lower)

  const slug = toSlug(raw)
  if (tradeBySlug.has(slug)) return tradeBySlug.get(slug)

  if (LEGACY_TRADE_ALIASES[lower]) return LEGACY_TRADE_ALIASES[lower]
  if (LEGACY_TRADE_ALIASES[slug]) return LEGACY_TRADE_ALIASES[slug]

  return raw
}

export const normalizeTradeCategories = (input) => {
  const values = Array.isArray(input)
    ? input
    : String(input || "")
      .split(",")
      .map((value) => value.trim())

  const normalized = values
    .map(normalizeTradeCategory)
    .filter(Boolean)

  return Array.from(new Set(normalized))
}

export const tradeFilterOptions = [
  { label: "All Trades", value: "all", category: null },
  ...ALL_TRADE_CATEGORIES.map((category) => ({
    label: category,
    value: toSlug(category),
    category
  }))
]

export const matchesTradeFilter = ({ title = "", description = "", category = "" }, tradeFilterValue) => {
  if (!tradeFilterValue || tradeFilterValue === "all") return true

  const selected = tradeFilterOptions.find((option) => option.value === tradeFilterValue)?.category
  if (!selected) return true

  const normalizedCategory = normalizeTradeCategory(category)
  if (normalizedCategory === selected) return true

  const haystack = `${title} ${description} ${category}`.toLowerCase()
  return (TRADE_KEYWORDS[selected] || []).some((keyword) => haystack.includes(keyword.toLowerCase()))
}

export const getPrimaryTrade = (categories = []) => normalizeTradeCategories(categories)[0] || "Contractor"

export const toTradeValue = toSlug
