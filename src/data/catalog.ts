/** Owner-editable seed. Neutral allow-list only. Rename here and re-seed. */

export const CATEGORIES = [
  {
    name: "Dating",
    slug: "dating",
    description: "People looking to date in their city. Say who you are and how you would like to meet.",
    icon: "dating",
    color: "#3d5a4c",
    order: 1,
    starEnabled: false,
  },
  {
    name: "Friendship",
    slug: "friendship",
    description: "Make friends for conversation, hobbies, and local company.",
    icon: "friendship",
    color: "#2f6f6a",
    order: 2,
    starEnabled: false,
  },
  {
    name: "Meetups and events",
    slug: "meetups",
    description: "Clubs, gatherings, and public events. Post the time, place, and who should come.",
    icon: "meetups",
    color: "#3e5c76",
    order: 3,
    starEnabled: false,
  },
  {
    name: "Personal ads",
    slug: "personal",
    description: "Personal notices: introductions, pen pals, and messages that are not a job or a sale.",
    icon: "personal",
    color: "#6b5b4b",
    order: 4,
    starEnabled: false,
  },
  {
    name: "Jobs",
    slug: "jobs",
    description: "Local job posts and people offering their skills for hire.",
    icon: "jobs",
    color: "#1f4e79",
    order: 5,
    starEnabled: false,
  },
  {
    name: "Wellness, spa and massage",
    slug: "wellness",
    description: "Wellness, spa, and massage businesses. Book a listed studio or an independent practitioner.",
    icon: "wellness",
    color: "#4d7c6a",
    order: 6,
    starEnabled: false,
  },
  {
    name: "Property",
    slug: "property",
    description: "Homes for rent or sale, rooms, and commercial space.",
    icon: "property",
    color: "#5c4d3c",
    order: 7,
    starEnabled: false,
  },
  {
    name: "Vehicles",
    slug: "vehicles",
    description: "Cars, bikes, and other vehicles for sale by private owners and dealers.",
    icon: "vehicles",
    color: "#3d4a5c",
    order: 8,
    starEnabled: false,
  },
  {
    name: "Buy and sell",
    slug: "buy-and-sell",
    description: "Goods for sale nearby: furniture, electronics, and household items.",
    icon: "buy-and-sell",
    color: "#6a5344",
    order: 9,
    starEnabled: false,
  },
  {
    name: "Pets",
    slug: "pets",
    description: "Pets looking for homes, and pet care such as walking and boarding.",
    icon: "pets",
    color: "#5b6b3a",
    order: 10,
    starEnabled: false,
  },
  {
    name: "Education",
    slug: "education",
    description: "Tutors, classes, and courses in your city.",
    icon: "education",
    color: "#3f4f6b",
    order: 11,
    starEnabled: false,
  },
] as const;

export const TAG_GROUPS = [
  {
    key: "tag1",
    label: "Posted by",
    type: "select" as const,
    options: ["Individual", "Business", "Student", "Family"],
  },
  { key: "tag2", label: "Format", type: "multi" as const, options: ["In person", "Online", "Either"] },
  {
    key: "tag3",
    label: "Hours",
    type: "multi" as const,
    options: ["Morning", "Afternoon", "Evening", "Flexible"],
  },
  {
    key: "tag4",
    label: "Offer",
    type: "multi" as const,
    options: ["Chat", "Meet in person", "Lesson", "Delivery", "Video call"],
  },
  {
    key: "tag5",
    label: "Languages",
    type: "multi" as const,
    options: [
      "Hindi", "English", "Gujarati", "Marathi", "Tamil", "Telugu", "Kannada",
      "Malayalam", "Bengali", "Punjabi", "Urdu", "Odia", "Assamese",
    ],
  },
  { key: "tag6", label: "Payment", type: "multi" as const, options: ["Cash", "UPI", "Bank transfer"] },
  { key: "tag7", label: "Listing style", type: "multi" as const, options: ["Casual", "Professional", "Community", "One-off"] },
];

export const TAG_PAGES = [
  { slug: "individual", label: "Individual" },
  { slug: "in-person", label: "In person" },
  { slug: "online", label: "Online" },
  { slug: "video-call", label: "Video call" },
  { slug: "lesson", label: "Lesson" },
];

/** Region slugs for states that share a city name. */
export const STATE_SLUGS: Record<string, string> = {
  Delhi: "delhi-region",
  Kerala: "kerala-region",
  Chandigarh: "chandigarh-region",
};

export const TOP_CITIES = [
  "Hyderabad", "Delhi", "Bangalore", "Mumbai", "Pune",
  "Chennai", "Kolkata", "Ahmedabad", "Surat", "Jaipur",
] as const;

export const CITY_STATE: Record<string, string> = {
  Agra: "Uttar Pradesh", Ahmedabad: "Gujarat", Ajmer: "Rajasthan", Alappuzha: "Kerala",
  Ambala: "Haryana", Amli: "Dadra and Nagar Haveli", Amritsar: "Punjab", Aurangabad: "Maharashtra",
  Bahadurgarh: "Haryana", Bangalore: "Karnataka", Bawana: "Delhi", Belgaum: "Karnataka",
  Berhampur: "Odisha", Bharuch: "Gujarat", Bhilai: "Chhattisgarh", Bhopal: "Madhya Pradesh",
  Bhubaneswar: "Odisha", Bhuj: "Gujarat", Chandigarh: "Chandigarh", Chennai: "Tamil Nadu",
  Coimbatore: "Tamil Nadu", Daman: "Daman and Diu", Dehradun: "Uttarakhand", Delhi: "Delhi",
  Dibrugarh: "Assam", Dimapur: "Nagaland", Erode: "Tamil Nadu", Faridabad: "Haryana",
  Ghaziabad: "Uttar Pradesh", Gorakhpur: "Uttar Pradesh", Guntur: "Andhra Pradesh",
  Gurgaon: "Haryana", Guwahati: "Assam", Gwalior: "Madhya Pradesh", Haridwar: "Uttarakhand",
  Hyderabad: "Telangana", Indore: "Madhya Pradesh", Jabalpur: "Madhya Pradesh", Jaipur: "Rajasthan",
  Jalandhar: "Punjab", Jammu: "Jammu and Kashmir", Jamnagar: "Gujarat", Jamshedpur: "Jharkhand",
  Jodhpur: "Rajasthan", Jorhat: "Assam", Kadapa: "Andhra Pradesh", Kanpur: "Uttar Pradesh",
  Kerala: "Kerala", Kochi: "Kerala", Kolkata: "West Bengal", Kota: "Rajasthan",
  Kumhari: "Chhattisgarh", Lucknow: "Uttar Pradesh", Ludhiana: "Punjab", Madurai: "Tamil Nadu",
  Manali: "Himachal Pradesh", Mangalore: "Karnataka", Mathura: "Uttar Pradesh", Meerut: "Uttar Pradesh",
  Mohali: "Punjab", Mumbai: "Maharashtra", Muzaffarpur: "Bihar", Mysore: "Karnataka",
  Nagapattinam: "Tamil Nadu", Nagpur: "Maharashtra", Nashik: "Maharashtra",
  "Navi Mumbai": "Maharashtra", Navsari: "Gujarat", Noida: "Uttar Pradesh", Palanpur: "Gujarat",
  Panvel: "Maharashtra", Patna: "Bihar", Pollachi: "Tamil Nadu", Pune: "Maharashtra",
  Puri: "Odisha", Raipur: "Chhattisgarh", Rajkot: "Gujarat", Ranchi: "Jharkhand",
  Rangia: "Assam", Ratanpur: "Chhattisgarh", Rishikesh: "Uttarakhand", Salem: "Tamil Nadu",
  Shimla: "Himachal Pradesh", Siliguri: "West Bengal", Surat: "Gujarat", Thane: "Maharashtra",
  Thiruvananthapuram: "Kerala", Tiruchirappalli: "Tamil Nadu", Tirupati: "Andhra Pradesh",
  Tiruppur: "Tamil Nadu", Udaipur: "Rajasthan", Vadodara: "Gujarat", Vapi: "Gujarat",
  Varanasi: "Uttar Pradesh", "Vasai-Virar": "Maharashtra", Vellore: "Tamil Nadu",
  Vijayawada: "Andhra Pradesh", Visakhapatnam: "Andhra Pradesh",
};

export const CITIES = Object.keys(CITY_STATE);

export const DISTRICTS: Record<string, string[]> = {
  Mumbai: ["Airoli", "Andheri", "Bandra", "Belapur", "Borivali", "Chembur", "Colaba", "Ghatkopar", "Goregaon", "Juhu", "Kandivali"],
  Delhi: ["Connaught Place", "Dwarka", "Karol Bagh", "Rohini", "Saket", "South Extension"],
  Bangalore: ["BTM", "Indiranagar", "Koramangala", "Whitefield", "Jayanagar", "HSR"],
  Pune: ["Viman Nagar", "Hinjewadi", "Koregaon Park", "Hadapsar", "Wakad", "Kalyani Nagar"],
  Hyderabad: ["Banjara Hills", "Gachibowli", "Hitech City", "Jubilee Hills", "Secunderabad"],
};
