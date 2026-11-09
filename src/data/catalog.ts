/** Owner-editable seed. Category names are Appendix B slots — rename here and re-seed. */

export const CATEGORIES = [
  {
    name: "Local Services",
    slug: "local-services",
    description: "Find trusted local services in your city. Independent providers and small teams.",
    icon: "wrench",
    order: 1,
    starEnabled: true,
  },
  {
    name: "Wellness",
    slug: "wellness",
    description: "Wellness, therapy and body-care listings near you.",
    icon: "leaf",
    order: 2,
    starEnabled: false,
  },
  {
    name: "Professionals",
    slug: "professionals",
    description: "Hire professionals for short assignments and on-site work.",
    icon: "briefcase",
    order: 3,
    starEnabled: false,
  },
  {
    name: "Community",
    slug: "community",
    description: "Community notices, groups and local help.",
    icon: "users",
    order: 4,
    starEnabled: false,
  },
  {
    name: "Meetups",
    slug: "meetups",
    description: "City meetups and casual local get-togethers.",
    icon: "calendar",
    order: 5,
    starEnabled: false,
  },
] as const;

export const TAG_GROUPS = [
  {
    key: "tag1",
    label: "Service type",
    type: "select" as const,
    options: [
      "Cleaning", "Plumbing", "Electrical", "Carpentry", "Painting", "AC repair",
      "Appliance", "Packers", "Driver", "Cook", "Tutor", "Beauty", "Fitness",
      "Photography", "Event help", "IT support", "Legal", "Accounting", "Delivery",
      "Other",
    ],
  },
  { key: "tag2", label: "Availability", type: "multi" as const, options: ["Today", "This week"] },
  { key: "tag3", label: "Hours", type: "multi" as const, options: ["Morning", "Afternoon", "Evening", "Night"] },
  { key: "tag4", label: "Visit type", type: "multi" as const, options: ["At your place", "At their place"] },
  {
    key: "tag5",
    label: "Languages",
    type: "multi" as const,
    options: [
      "Hindi", "English", "Gujarati", "Marathi", "Tamil", "Telugu", "Kannada",
      "Malayalam", "Bengali", "Punjabi", "Urdu", "Odia", "Assamese",
    ],
  },
  { key: "tag6", label: "Payment", type: "multi" as const, options: ["Cash", "UPI", "Card", "Invoice"] },
  { key: "tag7", label: "Audience", type: "multi" as const, options: ["Home", "Office", "Shop", "Event", "Online"] },
];

export const TOP_CITIES = [
  "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Pune",
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
