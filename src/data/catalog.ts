/** Owner-editable seed. Category names are Appendix B slots — rename here and re-seed. */

export const CATEGORIES = [
  {
    name: "Call Girls",
    slug: "call-girls",
    description:
      "Call girls and escort ads. Independent girls and escorts waiting to satisfy your sexual fantasies. Escort and women seeking men W4M. Enjoy their erotic services",
    icon: "call-girls",
    color: "#e20044",
    order: 1,
    starEnabled: true,
  },
  {
    name: "Massages",
    slug: "massages",
    description:
      "Enjoy the best erotic massages ads. All sexual services. The hottest girls offer you a relaxing and hot massage. Full body massages",
    icon: "massages",
    color: "#9b4dca",
    order: 2,
    starEnabled: false,
  },
  {
    name: "Male Escorts",
    slug: "male-escorts",
    description:
      "Male escort services, gigolos, gay escorts and call boys. Models and male adult services. Dating with male escorts",
    icon: "male-escorts",
    color: "#0077c8",
    order: 3,
    starEnabled: false,
  },
  {
    name: "Transsexual",
    slug: "transsexual",
    description:
      "Transsexual dating. Discover the new sexual services with the sexiest transsexual in India. Shemale, ladyboy and TS escorts",
    icon: "transsexual",
    color: "#00a88f",
    order: 4,
    starEnabled: false,
  },
  {
    name: "Adult Meetings",
    slug: "adult-meetings",
    description:
      "Casual dating, find your true love or NSA. Chat with local singles, girls or boys for a meeting. Meet with them and find a dating partner",
    icon: "adult-meetings",
    color: "#f5a623",
    order: 5,
    starEnabled: false,
  },
] as const;

export const TAG_GROUPS = [
  {
    key: "tag1",
    label: "Profile type",
    type: "select" as const,
    options: ["Independent", "Agency", "Student", "Housewife", "Mature", "Couple"],
  },
  { key: "tag2", label: "Meeting", type: "multi" as const, options: ["Incall", "Outcall"] },
  {
    key: "tag3",
    label: "Hours",
    type: "multi" as const,
    options: ["Morning", "Afternoon", "Evening", "Night", "24 hours"],
  },
  {
    key: "tag4",
    label: "Services",
    type: "multi" as const,
    options: ["Girlfriend experience", "Massage", "Overnight", "Video call", "Travel"],
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
  { key: "tag6", label: "Payment", type: "multi" as const, options: ["Cash", "UPI"] },
  { key: "tag7", label: "Body", type: "multi" as const, options: ["Slim", "Athletic", "Curvy", "Average"] },
];

export const TAG_PAGES = [
  { slug: "independent", label: "Independent" },
  { slug: "incall", label: "Incall" },
  { slug: "outcall", label: "Outcall" },
  { slug: "video-call", label: "Video call" },
  { slug: "massage", label: "Massage" },
];

/** Skokka-style region slugs for states that share a city name. */
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
