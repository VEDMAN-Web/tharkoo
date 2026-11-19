/**
 * H17.10: the title and text of a sample (demo) ad, written for the category it sits in. A template names the city ({city}) and, when
 * the ad's city has a known area, that area ({area}); a template with {area} is used only when there is one. The category NAMES are not here:
 * they come from the admin, and a template is found by the category's address (slug), which does not change when a category is renamed.
 *
 * Every line is plain and non-sexual, with no age or body focus and nothing about money for contact. A test runs every template through
 * the same word check as a real ad.
 */

export type DemoTextTemplate = { title: string; text: string };

export const DEMO_TEXT: Readonly<Record<string, readonly DemoTextTemplate[]>> = {
  // Friends & Dating: friendship and dating introductions.
  dating: [
    { title: "Coffee and conversation in {city}", text: "Would like to meet new people for a relaxed coffee and a good chat in {city}. Happy to start with messages and take it slowly." },
    { title: "Weekend walk near {area}", text: "Looking for a friendly weekend walk around {area} in {city}, followed by tea. Public places only, easy pace, good company." },
    { title: "Book lovers meet in {city}", text: "Enjoy novels and long talks about them. Would like to meet readers in {city} for a coffee at a bookshop and swap favourite titles." },
    { title: "Quiz night partner in {city}", text: "Looking for someone curious to join a quiz team and become friends in {city}. Fun first, anything more can grow from there." },
    { title: "Learning to cook, {city}", text: "Learning new recipes and would enjoy company for a weekend cooking session or a market visit in {city}. Beginners are welcome." },
    { title: "Music evenings around {area}", text: "Fond of live music and quiet evenings. Looking to share concert plans with someone friendly around {area} in {city}." },
    { title: "New in {city}, hello", text: "Recently moved to {city} and would like to make friends first, then see where things go. Coffee, walks and good conversation." },
    { title: "Food walk near {area}", text: "Planning a slow food walk near {area} in {city} and happy to share it. Good for a first meeting in a busy, public place." },
    { title: "Board games and chai, {city}", text: "A relaxed evening of board games and chai with new people in {city}. Come as you are, bring a favourite game if you like." },
    { title: "Weekend day trips from {city}", text: "Looking for a pleasant companion for short weekend day trips out of {city}: a lake, a hill, a temple town. Plans are shared in advance." },
  ],
  // LGBTQ+ Community: meetups, support groups, pride and art events, friendship.
  transgender: [
    { title: "Community meetup in {city}", text: "An open, friendly meetup for the LGBTQ+ community and allies in {city}. Come for tea and conversation, everyone is respected." },
    { title: "Support circle near {area}", text: "A welcoming peer support circle meets near {area} in {city}. Everyone is treated with respect and what is said stays in the group." },
    { title: "Pride planning group, {city}", text: "Volunteers are welcome to help plan this year's pride walk in {city}: banners, music, safety and a welcome desk. No experience needed." },
    { title: "Art and poetry evening in {city}", text: "An evening of poems, short stories and art by LGBTQ+ creators in {city}. Share a piece or just listen and enjoy the evening." },
    { title: "Film night and talk near {area}", text: "A monthly film screening followed by an open talk, near {area} in {city}. Everyone is welcome, snacks are shared." },
    { title: "Friendship group for new arrivals", text: "A friendly group for people new to {city} who would like to find supportive friends, share local tips and go out together." },
    { title: "Volunteers for a community kitchen", text: "A community kitchen in {city} is looking for volunteers to cook and serve on Sundays. Everyone is welcome, tasks for every ability." },
    { title: "Allies book club in {city}", text: "A book club that reads stories by and about LGBTQ+ people, open to allies too. Meets monthly in a quiet cafe in {city}." },
    { title: "Board games night near {area}", text: "A relaxed LGBTQ+ friendly board games night near {area} in {city}. Easy games, good snacks, and no pressure to talk." },
    { title: "Storytelling workshop in {city}", text: "A gentle storytelling workshop for the LGBTQ+ community in {city}: write, share and listen in a supportive circle." },
  ],
  // Spa & Salon: salon, day spa, beauty and grooming services. Strictly non-sexual.
  spa: [
    { title: "Haircut and styling in {city}", text: "Experienced stylist offering haircuts, blow dry and styling for women, men and children in {city}. Bookings by appointment." },
    { title: "Facial and skin care near {area}", text: "Skin care studio near {area} in {city}: cleanup, deep cleansing facials and glow treatments. Please book a slot in advance." },
    { title: "Manicure and pedicure in {city}", text: "A clean, quiet salon corner for manicure, pedicure and nail art in {city}. Fresh tools for every client." },
    { title: "Bridal makeup artist in {city}", text: "Bridal and party makeup with trial sessions, hairstyling and saree draping in {city}. Book early for wedding season." },
    { title: "Men's grooming near {area}", text: "Haircut, beard trim and shave for men near {area} in {city}. Walk-ins welcome on weekdays, appointments at weekends." },
    { title: "Day spa package in {city}", text: "A day spa package with a facial, hair spa and a foot soak in a calm room in {city}. Ideal before a family function." },
    { title: "Hair spa and colour in {city}", text: "Hair spa, root touch up and global colour done by a trained colourist in {city}. A patch test is done first." },
    { title: "Threading and waxing near {area}", text: "Eyebrow threading, waxing and simple beauty care near {area} in {city}. Hygienic kits and a ladies-only area." },
    { title: "Party makeup and hairstyling", text: "Makeup and hairstyling for parties, photo shoots and festivals in {city}. Visits to your home can be arranged." },
    { title: "Kids haircut and grooming near {area}", text: "A friendly salon near {area} in {city} for children's haircuts and first trims. Patient staff and short waiting time." },
  ],
  // Meet People: hobby, sport and activity partners.
  "personal-ads": [
    { title: "Badminton partner in {city}", text: "Looking for a regular badminton partner for early evening games in {city}. Any level, just keen to play and have fun." },
    { title: "Morning run group near {area}", text: "A small, friendly morning running group around {area} in {city}. Easy pace, new runners welcome, we start at 6 am." },
    { title: "Chess partner in {city}", text: "Would like to play chess in person on weekends in {city}. Casual games, tea and good company." },
    { title: "Cycling friends, {city}", text: "Looking for people to cycle with on Sunday mornings around {city}. Helmets on, steady speed, a stop for breakfast." },
    { title: "Photography walk near {area}", text: "A relaxed photography walk near {area} in {city}. Bring any camera or phone and share what you see." },
    { title: "Trekking buddy for weekends", text: "Looking for a trekking buddy for easy weekend trails around {city}. Plans are shared early and the pace is relaxed." },
    { title: "Cricket on weekends, {city}", text: "A friendly weekend cricket game needs a few more players in {city}. Tennis ball, all levels, come and play." },
    { title: "Guitar jam partner near {area}", text: "Looking for someone to jam with on guitar or any instrument near {area} in {city}. Cover songs and a bit of improvising." },
    { title: "Yoga in the park, {city}", text: "Would like company for a morning yoga session in a park in {city}. Beginners welcome, bring your own mat." },
    { title: "Table tennis partner in {city}", text: "Looking for a table tennis partner for a game after work in {city}. Casual, friendly and flexible timings." },
  ],
};

/** The category addresses (slugs) that have sample ad text of their own. */
export const DEMO_TEXT_CATEGORIES: readonly string[] = Object.keys(DEMO_TEXT);

export function hasDemoText(categorySlug: string): boolean {
  return Object.prototype.hasOwnProperty.call(DEMO_TEXT, categorySlug);
}

function fill(text: string, city: string, area: string | null): string {
  return text.split("{city}").join(city).split("{area}").join(area ?? "");
}

/**
 * The title and text for one sample ad: `n` (the number in its address, demo-0123 is 123) picks the template, so the same ad always gets the
 * same words. With an area, the templates that name it are used as well; without one, only the others.
 */
export function demoAdText(categorySlug: string, city: string, area: string | null, n: number): { title: string; description: string } | null {
  const templates = DEMO_TEXT[categorySlug];
  if (!templates || !city) return null;
  const usable = templates.filter((template) => area || !`${template.title} ${template.text}`.includes("{area}"));
  const pick = usable[Math.abs(Math.trunc(n)) % usable.length];
  return { title: fill(pick.title, city, area), description: fill(pick.text, city, area) };
}
