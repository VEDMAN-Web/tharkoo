export type TrustCopy = {
  title: string;
  description: string;
  paragraphs: string[];
};

const POSTAL = "Postal address: [placeholder: Ved to confirm the full registered office address before publication].";

export const TRUST: Record<string, TrustCopy> = {
  terms: {
    title: "Terms of use",
    description: "The rules for posting and browsing free classifieds on Tharkoo in India, including ID checks, promotions, and how we handle reports.",
    paragraphs: [
      "Tharkoo is a free classifieds board for people in India. These terms cover browsing, posting, promoting, and contacting someone through an ad. By using the site you agree to post only what you have the right to offer, and to treat other people the way you would want to be treated in a public marketplace.",
      "You must be 18 or older to create an account or to post an ad. We ask for a date of birth at registration and we may ask for an ID check before a listing goes live. An ID check confirms the account holder. It does not mean Tharkoo has inspected the item, the job, or the person in the photos.",
      "A free ad stays within the weekly limit shown in your account. Paid options, such as a star, a bump, or a longer highlight, change where the ad sits and for how long. They do not change these terms, and they do not promise a reply. Prices for those options are shown before you pay.",
      "You keep ownership of the words and photos you upload. You give Tharkoo permission to display them on the listing, in search, and in the places the site uses to describe a public ad. Do not upload a photo of someone else unless you have their permission, and do not copy another person’s listing.",
      "We can refuse, pause, or remove an ad that breaks these terms, that we cannot verify, or that a report gives us reason to review. We can also close an account that repeats the same problem. If we remove an ad, the public URL stops working. You can write to us through the contact page if you think that was a mistake.",
      POSTAL,
      "These terms are a draft for review. They are not a substitute for advice from a lawyer, and the wording can change before the site is opened to search engines. The version on this page is the one that applies on the day you read it.",
    ],
  },
  privacy: {
    title: "Privacy",
    description: "What Tharkoo stores when you browse, register, or post a classified in India, and how to ask about your account data.",
    paragraphs: [
      "This page explains what Tharkoo stores when you browse, register, or post. We keep the account email, a password hash, the date of birth you enter, and the ads you create. If you complete an ID check, we store the result of that check and the document image only for as long as we need it to review the account.",
      "A public ad shows the title, description, photos, city, and the contact method you choose. It does not show your email. Do not put a phone number or a home address in the description if you do not want strangers to read it. You can delete an ad from your account, and we then stop showing it.",
      "We use cookies to keep you signed in and to remember the age and cookie choices on this browser. The cookies page lists those choices. We do not sell account lists. If a payment provider is used for a promotion, that provider handles the card details and we store the result, not the full card number.",
      "Staff can see account and listing records in the admin tools so they can review reports, ID checks, and promotions. Access is limited to people with an admin role. We keep a short audit note when an admin changes the homepage or a public URL.",
      "You can ask what we hold about your account by writing through the contact page. We will reply to the email on the account. If the law requires us to keep a record, for example a payment or a report, we keep that record even after the ad is gone.",
      POSTAL,
      "This privacy note is a draft for review. It describes the product as it works today and will be updated if the data we collect changes. Read it with the terms and the cookies page.",
    ],
  },
  cookies: {
    title: "Cookies",
    description: "Which cookies Tharkoo uses to keep you signed in and to remember age and cookie choices on this browser.",
    paragraphs: [
      "Tharkoo uses a small number of cookies. A session cookie keeps you signed in after you enter your email and password. Without it, the account pages would ask you to sign in on every visit. The cookie is sent only to this site.",
      "Two choices are saved in this browser: that you confirmed you are 18 or older, and that you closed the cookie note. Those values stay on the device. They are not an account, and clearing the browser data brings the notes back.",
      "We do not use a cookie to follow you across other websites, and we do not load an advertising network on the public pages. If that changes, this page will name the extra cookie and what it is for before it is switched on.",
      "You can block cookies in the browser. If you block the session cookie, you can still read public ads, and you will need to sign in again each time you want to post or to open your account. The age check will also appear again.",
      "The cookie note at the bottom of the page is there so you can see this explanation before you continue. Choosing OK stores that choice. It does not change the terms or the privacy page.",
      "If you use more than one browser, each one keeps its own choice. A public computer should be signed out when you leave, because the session cookie lasts until you log out or the browser clears it. We do not use the cookie to build a profile of the cities you open.",
      POSTAL,
      "This cookies note is a draft for review. It covers the cookies the site sets today. A lawyer should read it before the site is indexed.",
    ],
  },
  contact: {
    title: "Contact",
    description: "How to reach Tharkoo about your account, a listing, or a report. We reply by email. We do not arrange meetings.",
    paragraphs: [
      "Write to us about an account, a listing, a payment for a promotion, or a report that did not go through the form. Use the email on your account so we can match the message to the right person. We reply by email. We do not call, and we do not arrange meetings.",
      "For a listing that looks misleading, stolen, or unsafe, use the report link on the ad as well. That form keeps the ad id with your note, which is faster than a general email. Safety tips for meeting someone you found on a classified live on the safety page.",
      "If you are asking about an ID check, tell us the email on the account and what the screen showed. Do not send the identity document again by email if you already uploaded it. Staff can see the upload in the review queue.",
      "We read messages on business days. A promotion question includes the ad link and the option you paid for. A privacy question can ask what we store, or ask us to close the account. Closing an account removes the public ads.",
      "Please do not send copies of bank cards, one-time passwords, or identity documents in the first email. Tell us the account email and the page you were on. If the matter is a listing, the report form on the ad is still the fastest way for the review queue to see it. A short note is enough. We do not need a long story to find the right account.",
      POSTAL,
      "This contact page is a draft for review. The postal line above is a placeholder until the registered office address is confirmed. Until then, email is the way to reach the team.",
    ],
  },
  safety: {
    title: "Safety",
    description: "How to stay safe when you reply to a classified on Tharkoo, and where to report a listing that looks wrong.",
    paragraphs: [
      "Tharkoo is a place to post and to find ads. We do not meet people for you, and we do not check every photo in person. Read the listing, use the contact method on the ad, and keep the first conversation on the details that are already public.",
      "Meet in a busy public place if you decide to meet at all. Tell a friend where you are going. Do not send money, a deposit, or a code to someone you have not met, and do not share a copy of an identity document in a chat. A real poster can wait.",
      "ID checks on Tharkoo confirm an account. They are not a promise that an offer is honest. If a message asks you to leave the site, to pay an unknown account, or to ignore the details on the ad, stop and use the report link.",
      "Report an ad that uses someone else’s photos, that asks for payment before any contact, or that offers something the prohibited items page does not allow. Reports go to the review queue. We can remove the ad and close the account.",
      "The help centre has short guides on reading a listing and on reporting. The scam report page is the form. If you are in immediate danger, contact local emergency services first. Tharkoo cannot send help to a street address.",
      "A careful reply stays specific. Ask about the item, the job, or the plan that is already written on the ad. If the answers change the offer, or the photos do not match the description, stop. You can leave the conversation without explaining yourself. Take the time you need today. A genuine poster can wait for a reply before you decide.",
      POSTAL,
    ],
  },
  "how-it-works": {
    title: "How Tharkoo works",
    description: "How to browse city pages, post a free classified, pass an ID check, and use a promotion on Tharkoo.",
    paragraphs: [
      "Start on the home page or open a category and a city. Each city page lists the ads posted for that category, with promoted ads first while their paid time is running. A district page is the same list narrowed to one area. Search is there when you already know a word in the title.",
      "Posting starts at the post button. If you are not signed in, we ask you to log in or to register, and then we bring you back to the form. You choose a category, a city, a title, photos you have the right to use, and how you want to be contacted. A free weekly limit applies.",
      "New accounts confirm an email. Before a listing is public we may ask for an ID check. Until that check is approved, the ad stays off the city page. After approval it has a public link, a place in the city list, and a line in the account so you can edit or remove it.",
      "A promotion is optional. A star, a bump, or a highlight changes the order and the badge for a fixed number of days. The price is shown before you pay. When the time ends, the ad returns to the ordinary order. It does not disappear unless it has also expired or you removed it.",
      "City, category, and ad links are built from the public names you see in the address bar. If an admin renames one, the old address points to the new one. You do not need to keep a private copy of the link for it to keep working.",
      "When an ad expires, the city page drops it. For 30 days the old link explains that the listing has ended. After that, the link answers that the listing is gone. Removing an ad yourself ends it immediately.",
      POSTAL,
    ],
  },
  "prohibited-items": {
    title: "Prohibited items",
    description: "What you can post on Tharkoo, and the ads we remove, including illegal goods and ads that sell sex.",
    paragraphs: [
      "Tharkoo accepts ordinary classifieds. The categories you can post in are dating, friendship, meetups, personal ads, jobs, wellness, property, vehicles, buy and sell, pets, and education. Wellness means a spa, yoga, or fitness offer. It does not mean an offer of sex.",
      "Do not post illegal goods, weapons, stolen property, or anything you are not allowed to sell or to give away. Do not post an ad that sells sex. Dating and friendship ads are allowed when they are not an offer of sex for money. If a listing crosses that line, we remove it.",
      "Do not post a job that asks for money from the applicant, a property you do not have the right to let, or a vehicle you cannot show. Do not use another person’s photos. Do not write a title that hides what the ad actually is.",
      "We remove ads that break this list, and we can close the account. Reporting a listing helps us see it sooner. The safety page explains how to report, and the terms explain what happens after a review.",
      "A title should describe the same thing as the body. Do not hide a banned offer behind an ordinary category. Staff can move, refuse, or delete a listing during review, including after it has been public. Repeating a removed offer from a new account is still a breach of these rules and can close that account too.",
      "If you are not sure a listing fits, do not post it. Write through the contact page and describe the offer in plain words. We would rather answer first than take an ad down after it is public. A clear description saves a review and keeps the city page useful for everyone else.",
      POSTAL,
    ],
  },
};

export function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function trustWords(key: string) {
  const page = TRUST[key];
  return page ? wordCount(page.paragraphs.join(" ")) : 0;
}
