export type FieldHints = { title: string; text: string };

export const DEFAULT_HINTS: FieldHints = {
  title: "Give your ad a clear title",
  text: "Describe what you are offering. Be clear and honest.",
};

const HINTS: Record<string, FieldHints> = {
  dating: { title: "Looking for coffee and a walk this weekend", text: "Tell people about yourself and what you are looking for" },
  friendship: { title: "Looking for a friend to explore the city with", text: "Tell people about yourself and what you enjoy doing" },
  meetups: { title: "Sunday morning walking group", text: "Say what the meetup is, when it happens and who can join" },
  "personal-ads": { title: "Say hello to new people near you", text: "Tell people about yourself and what you are looking for" },
  jobs: { title: "Office assistant needed, weekdays", text: "Describe the work, the hours and what you are looking for" },
  wellness: { title: "Relaxing yoga class for beginners", text: "Describe what you offer, where and when" },
  property: { title: "2 BHK flat near Adajan", text: "Spacious 2 BHK on the 4th floor with lift and covered parking" },
  vehicles: { title: "Honda Activa 2022, one owner", text: "Describe the condition, the kilometres and the papers" },
  "buy-and-sell": { title: "Study table, teak wood", text: "Describe the item, its condition and how old it is" },
  pets: { title: "Friendly puppy looking for a home", text: "Describe the pet, its age and its care needs" },
  education: { title: "Maths tuition for classes 8 to 10", text: "Describe the classes, the timings and your experience" },
};

export function photoHelp(people: boolean): string {
  return people
    ? "Add clear photos of yourself. Your face should be in the frame. The first photo is your cover."
    : "Add photos of the item or place. Bright daylight photos look best. The first photo is your cover.";
}

export function hintsFor(slug: string | undefined): FieldHints {
  return (slug && HINTS[slug]) || DEFAULT_HINTS;
}
