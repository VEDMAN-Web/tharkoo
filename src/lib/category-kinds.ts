/** Words and shapes of the Kinds manager that the admin screens and the server share. No server code here. */
export const PEOPLE_KEY = "people";
export const VIDEO_NEVER_FOR_PEOPLE = "Video is never allowed on listings about people.";

export type KindView = {
  key: string;
  name: string;
  icon: string;
  maxPhotos: number | null;
  showPrice: boolean;
  showMap: boolean;
  showContact: boolean;
  videoTours: boolean;
  builtIn: boolean;
  used: number;
};
